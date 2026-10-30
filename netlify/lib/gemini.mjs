// Google Gemini API 공통 — AI 글쓰기(ai-write)와 3D 그림(render-background)이 같이 씀 (함수가 아니라 함수들이 불러 쓰는 파일)
//   REST generateContent 를 키 헤더(x-goog-api-key)로 부릅니다. 키는 Netlify 환경변수 GEMINI_API_KEY 에만.
//
// Netlify > Project configuration > Environment variables
//   GEMINI_API_KEY      Google AI Studio 에서 만든 키 (3D 그림과 같은 키)
//   GEMINI_TEXT_MODEL   (선택) 글·도면 읽기 모델. 비우면 gemini-3.8-flash
//   GEMINI_THINKING     (선택) 글쓰기 생각 정도 low / medium / high. 비우면 low (빨리 끝나게 — 함수는 60초까지)
//   AI_PROVIDER         (선택) gemini 또는 anthropic. 비우면 ANTHROPIC_API_KEY 가 있으면 Claude, 없으면 Gemini
//
// store:false — 구글이 2026-10-26부터 새 유료 프로젝트의 요청을 AI Studio 기록(로그)에 기본으로 저장해서, 요청마다 끕니다.
//               이 칸을 모르는 주소(v1 등)가 400으로 거절하면 빼고 한 번 더 보냅니다. 생각(thinkingConfig)도 같은 방식.
export const G_KEY = process.env.GEMINI_API_KEY || '';
export const G_TEXT_MODEL = process.env.GEMINI_TEXT_MODEL || 'gemini-3.8-flash';
export const G_THINKING = /^(low|medium|high)$/.test(process.env.GEMINI_THINKING || '') ? process.env.GEMINI_THINKING : 'low';
export const G_TEXT_BASE = (process.env.GEMINI_API_BASE || 'https://generativelanguage.googleapis.com/v1beta').replace(/\/$/, '');

/** 글 AI 고르기: 'anthropic' | 'gemini' | '' */
export function provider(env = process.env) {
  const want = String(env.AI_PROVIDER || '').toLowerCase();
  const a = !!env.ANTHROPIC_API_KEY, g = !!env.GEMINI_API_KEY;
  if (want === 'gemini' && g) return 'gemini';
  if (want === 'anthropic' && a) return 'anthropic';
  return a ? 'anthropic' : g ? 'gemini' : '';
}

const noStore = new Set(), noThinking = new Set();   // 한 번 거절된 주소(base)에는 이 함수가 도는 동안 빼고 보냄
export function errText(data) { return String((data && data.error && (data.error.message || data.error.status)) || '').slice(0, 500); }

/** generateContent 부르기 → { status, data } (네트워크 오류·시간 초과는 throw) */
export async function generate({ model, base = G_TEXT_BASE, body, timeoutMs = 55e3, key = G_KEY, fetchImpl = fetch }) {
  const send = async (b) => {
    const ctl = new AbortController();
    const timer = setTimeout(() => ctl.abort(), Math.max(1000, timeoutMs));
    try {
      const res = await fetchImpl(`${base}/models/${encodeURIComponent(model)}:generateContent`, {
        method: 'POST', signal: ctl.signal, headers: { 'content-type': 'application/json', 'x-goog-api-key': key }, body: JSON.stringify(b),
      });
      return { status: res.status, data: await res.json().catch(() => ({})) };
    } finally { clearTimeout(timer); }
  };
  const b = { ...body, generationConfig: body.generationConfig ? { ...body.generationConfig } : undefined };
  if (!b.generationConfig) delete b.generationConfig;
  if (!noStore.has(base)) b.store = false;
  if (noThinking.has(base) && b.generationConfig) delete b.generationConfig.thinkingConfig;
  let r = await send(b);
  for (let i = 0; i < 2 && r.status === 400; i++) {
    const msg = errText(r.data);
    if ('store' in b && /\bstore\b/i.test(msg)) { noStore.add(base); delete b.store; }
    else if (b.generationConfig && b.generationConfig.thinkingConfig && /thinking/i.test(msg)) { noThinking.add(base); delete b.generationConfig.thinkingConfig; }
    else break;
    r = await send(b);
  }
  return r;
}

/** 오류 종류: 'key' | 'billing' | 'quota' | 'model' | 'busy' | 'other' */
export function errKind(status, data) {
  const s = JSON.stringify(data || {}).slice(0, 2000);
  if (/API key not valid|API_KEY_INVALID/i.test(s)) return 'key';
  if (/billing|FAILED_PRECONDITION|free tier/i.test(s)) return 'billing';
  if (status === 401 || status === 403) return 'key';
  if (status === 429) return 'quota';
  if (status === 404) return 'model';
  if (status >= 500) return 'busy';
  return 'other';
}

/** 응답의 글만 (생각 부분은 뺌) */
export function textOf(data) {
  const cand = (data && data.candidates && data.candidates[0]) || null;
  const parts = (cand && cand.content && cand.content.parts) || [];
  return parts.filter((p) => typeof p.text === 'string' && !p.thought).map((p) => p.text).join('');
}
/** 끝난 까닭: 'cut'(길이 초과) | 'blocked'(안전 필터) | '' */
export function finishOf(data) {
  const cand = (data && data.candidates && data.candidates[0]) || null;
  const why = String((cand && cand.finishReason) || (data && data.promptFeedback && data.promptFeedback.blockReason) || '');
  if (/MAX_TOKENS/i.test(why)) return 'cut';
  if (/SAFETY|BLOCK|PROHIBITED|RECITATION|SPII/i.test(why)) return 'blocked';
  return '';
}

/** 우리 Supabase 공개 사진 주소만 받아서 base64 로 (다른 주소는 받지 않음) → { mime, data } | null */
export async function inlineFrom(url, { allow, maxBytes = 1.5 * 1024 * 1024, timeoutMs = 8000, fetchImpl = fetch } = {}) {
  if (!url || !allow || !String(url).startsWith(allow)) return null;
  const ctl = new AbortController();
  const timer = setTimeout(() => ctl.abort(), timeoutMs);
  try {
    const res = await fetchImpl(url, { signal: ctl.signal });
    if (!res.ok) return null;
    const mime = (res.headers.get('content-type') || '').split(';')[0].trim();
    if (!/^image\/(jpeg|png|webp)$/.test(mime)) return null;
    const buf = Buffer.from(await res.arrayBuffer());
    if (!buf.length || buf.length > maxBytes) return null;
    return { mime, data: buf.toString('base64') };
  } catch { return null; } finally { clearTimeout(timer); }
}
