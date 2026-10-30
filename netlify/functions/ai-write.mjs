// AI 글쓰기 (Google Gemini 또는 Anthropic Claude) — 관리화면 'SNS' 메뉴와 '시공사례 올리기 → AI로 글 완성하기'
//   kind = blog(네이버 블로그) · instagram(인스타그램 피드) · shorts(유튜브 쇼츠 대본) : 저장된 시공사례(workId)의 글·사진으로
//   kind = work(시공사례 제목·설명 완성) : 올리기 화면에 적은 내용(fields)과 사진(images, 작은 사진)으로
// 요청문은 public/assets/js/ai-prompts.js 한 곳에서 관리합니다 (관리화면의 '요청문 복사'와 같은 내용).
//
// Netlify > Project configuration > Environment variables
//   GEMINI_API_KEY        Google Gemini API 키 (3D 그림과 같은 키) — 절대 config.js 같은 공개 파일에 넣지 말 것
//   GEMINI_TEXT_MODEL     (선택) 쓸 모델. 비우면 gemini-3.8-flash   · GEMINI_THINKING (선택) low/medium/high, 비우면 low
//   AI_PROVIDER           (선택) gemini 또는 anthropic. 비우면 ANTHROPIC_API_KEY 가 있으면 Claude, 없으면 Gemini
//   ANTHROPIC_API_KEY     Anthropic(Claude) API 키 — 같은 주의. 두 키가 다 없으면 '요청문 복사' 방식으로 바뀝니다.
//   ANTHROPIC_MODEL       (선택) 쓸 모델. 비우면 claude-sonnet-5-5
//   ANTHROPIC_VERSION     (선택) API 버전 헤더. 비우면 2026-10-21
//   SUPABASE_URL, SUPABASE_SERVICE_KEY   (상담 신청 함수와 같은 값)
//   SUPABASE_KEY          (선택) anon/publishable 키 — 로그인 확인에 씀. 없으면 SUPABASE_SERVICE_KEY 로 확인
//
// 보안: 로그인한 관리자(admins 표에 있는 이메일)만 쓸 수 있습니다. AI에는 시공사례 글·사진만 보내고 손님 개인정보는 보내지 않습니다.
import AIPrompts from '../../public/assets/js/ai-prompts.js';
import * as G from '../lib/gemini.mjs';

const SB_URL = (process.env.SUPABASE_URL || '').replace(/\/$/, '');
const SB_KEY = process.env.SUPABASE_SERVICE_KEY || '';
const SB_ANON = process.env.SUPABASE_KEY || '';
const AI_KEY = process.env.ANTHROPIC_API_KEY || '';
const MODEL = process.env.ANTHROPIC_MODEL || 'claude-sonnet-5-5';
const AI_VERSION = process.env.ANTHROPIC_VERSION || '2026-10-21';
const MAX_PHOTOS = 10;                 // 저장된 시공사례: 작은 사진(가로 800px) 최대 10장
const MAX_UPLOAD = 6;                  // 올리기 화면에서 보내는 사진 최대 6장
const MAX_IMAGE_B64 = 700 * 1024;      // 사진 한 장(base64) 최대 크기
const MAX_BODY = 4.5 * 1024 * 1024;
const KINDS = ['blog', 'instagram', 'shorts', 'work'];
const PROVIDER = G.provider();   // 'gemini' | 'anthropic' | ''

// 관리자만 쓰는 기능이지만, 같은 IP에서 1분에 6번 넘게 누르면 Netlify가 막습니다(429).
export const config = {
  path: '/api/ai-write',
  method: ['POST'],
  rateLimit: { windowLimit: 6, windowSize: 60, aggregateBy: ['ip', 'domain'] },
};

const json = (status, body) => new Response(JSON.stringify(body), {
  status, headers: { 'content-type': 'application/json; charset=utf-8', 'cache-control': 'no-store' },
});
function sbHeaders(key, extra = {}) {
  const h = { apikey: key, ...extra };
  if (key.startsWith('eyJ')) h.authorization = `Bearer ${key}`;
  return h;
}
const t = (v, n) => String(v ?? '').replace(/\s+/g, ' ').trim().slice(0, n);

async function adminEmail(token) {
  const res = await fetch(`${SB_URL}/auth/v1/user`, { headers: { apikey: SB_ANON || SB_KEY, authorization: `Bearer ${token}` } });
  if (!res.ok) return null;
  const user = await res.json().catch(() => null);
  const email = String((user && user.email) || '').toLowerCase();
  if (!email) return null;
  const a = await fetch(`${SB_URL}/rest/v1/admins?select=email`, { headers: sbHeaders(SB_KEY) });
  if (!a.ok) return null;
  const rows = await a.json().catch(() => []);
  return rows.some((r) => String(r.email || '').toLowerCase() === email) ? email : null;
}
export function photoUrl(path) {
  if (!path) return '';
  if (/^https?:/.test(path)) return path;
  return `${SB_URL}/storage/v1/object/public/photos/${String(path).split('/').map(encodeURIComponent).join('/')}`;
}
// 올리기 화면에서 보낸 내용 정리
export function cleanFields(f) {
  f = f && typeof f === 'object' ? f : {};
  return {
    title: t(f.title, 80), place: t(f.place, 60), size: t(f.size, 12), building: t(f.building, 20), period: t(f.period, 20),
    scopes: (Array.isArray(f.scopes) ? f.scopes : []).slice(0, 30).map((x) => t(x, 20)).filter(Boolean),
    body: String(f.body || '').slice(0, 3000),
  };
}
export function cleanImages(list) {
  return (Array.isArray(list) ? list : []).slice(0, MAX_UPLOAD).map((x) => {
    const type = (x && x.type) || 'image/jpeg';
    if (!/^image\/(jpeg|png|webp)$/.test(type)) return null;
    const data = String((x && x.data) || '').replace(/^data:[^,]*,/, '');
    return /^[A-Za-z0-9+/=]+$/.test(data) && data.length <= MAX_IMAGE_B64 ? { type, data } : null;
  }).filter(Boolean);
}

/* ---------- Claude (Anthropic) ---------- */
async function viaClaude(kind, work, site, extra, pics, deadline) {
  const images = pics.map((x) => (x.b64 ? { type: 'image', source: { type: 'base64', media_type: x.b64.type, data: x.b64.data } } : { type: 'image', source: { type: 'url', url: x.url } }));
  const p = AIPrompts.build(kind, { work, site, extra, photoCount: images.length });
  const content = [];
  images.forEach((img, i) => { content.push({ type: 'text', text: `사진 ${i + 1}` }); content.push(img); });
  content.push({ type: 'text', text: p.user });
  const ctl = new AbortController();
  const timer = setTimeout(() => ctl.abort(), Math.max(1000, deadline - Date.now()));
  let res;
  try {
    res = await fetch('https://api.anthropic.com/v1/messages', {
      method: 'POST', signal: ctl.signal,
      headers: { 'content-type': 'application/json', 'anthropic-version': AI_VERSION, 'x-api-key': AI_KEY },
      body: JSON.stringify({ model: MODEL, max_tokens: p.maxTokens, system: p.system, messages: [{ role: 'user', content }] }),
    });
  } finally { clearTimeout(timer); }
  const data = await res.json().catch(() => ({}));
  if (!res.ok) {
    const type = (data.error && data.error.type) || '';
    console.log('[ai-write] Claude 오류', kind, res.status, type);   // 키·내용은 기록하지 않음
    const msg = res.status === 401 || res.status === 403 ? 'AI 키(Claude)가 맞지 않아요. 앤에게 알려 주세요.'
      : res.status === 429 ? 'AI 사용량이 잠시 꽉 찼어요. 1~2분 뒤에 다시 눌러 주세요.'
        : res.status === 529 || res.status >= 500 ? 'AI 쪽이 잠시 바빠요. 조금 뒤에 다시 눌러 주세요.'
          : /credit|billing/i.test(JSON.stringify(data)) ? 'AI 이용 요금(Claude 크레딧)이 부족해요. 앤에게 알려 주세요.'
            : 'AI가 글을 쓰지 못했어요. 잠시 후 다시 눌러 주세요.';
    return { error: msg, claudeFail: true };
  }
  return { text: (data.content || []).filter((b) => b.type === 'text').map((b) => b.text).join('\n'), photos: images.length, model: data.model || MODEL, cut: data.stop_reason === 'max_tokens' };
}

/* ---------- Gemini (Google) ---------- */
// 저장된 시공사례 사진은 주소만 있어서, 우리 Supabase 공개 사진만 받아서 그림 데이터로 보냄 (못 받은 사진은 빼고)
const GEMINI_MSG = {
  key: 'AI 키(Gemini)가 맞지 않아요. 앤에게 알려 주세요.',
  billing: 'AI 결제 설정이 아직 안 되어 있어요. 앤에게 알려 주세요.',
  quota: 'AI 사용량이 잠시 꽉 찼어요. 1~2분 뒤에 다시 눌러 주세요.',
  model: 'AI 모델 이름이 맞지 않아요. 앤에게 알려 주세요.',
  busy: 'AI 쪽이 잠시 바빠요. 조금 뒤에 다시 눌러 주세요.',
  other: 'AI가 글을 쓰지 못했어요. 잠시 후 다시 눌러 주세요.',
};
async function viaGemini(kind, work, site, extra, pics, deadline) {
  const allow = `${SB_URL}/storage/v1/object/public/`;
  const got = (await Promise.all(pics.map((x) => (x.b64 ? { mime: x.b64.type, data: x.b64.data } : G.inlineFrom(x.url, { allow })))))
    .filter(Boolean);
  const p = AIPrompts.build(kind, { work, site, extra, photoCount: got.length });
  const parts = [];
  got.forEach((img, i) => { parts.push({ text: `사진 ${i + 1}` }); parts.push({ inline_data: { mime_type: img.mime, data: img.data } }); });
  parts.push({ text: p.user });
  const r = await G.generate({
    model: G.G_TEXT_MODEL, timeoutMs: deadline - Date.now(),
    body: {
      system_instruction: { parts: [{ text: p.system }] },
      contents: [{ role: 'user', parts }],
      // 생각(thinking)도 이 한도 안에서 써서 넉넉히 (한국어는 글자당 토큰이 더 들 수 있음)
      generationConfig: { maxOutputTokens: Math.min(32768, p.maxTokens * 2 + 4000), thinkingConfig: { thinkingLevel: G.G_THINKING } },
    },
  });
  if (r.status < 200 || r.status >= 300) {
    console.log('[ai-write] Gemini 오류', kind, r.status, (r.data && r.data.error && r.data.error.status) || '');
    return { error: GEMINI_MSG[G.errKind(r.status, r.data)] };
  }
  const fin = G.finishOf(r.data);
  if (fin === 'blocked') return { code: 'blocked', error: 'AI가 이 내용으로는 글을 쓰지 않았어요. 더 넣을 말을 바꿔서 다시 눌러 주세요.' };
  return { text: G.textOf(r.data), photos: got.length, model: (r.data && r.data.modelVersion) || G.G_TEXT_MODEL, cut: fin === 'cut' };
}

export default async (req) => {
  if (req.method !== 'POST') return json(405, { ok: false, error: '잘못된 요청입니다.' });
  if ((req.headers.get('sec-fetch-site') || '') === 'cross-site') return json(403, { ok: false, error: '잘못된 요청입니다.' });
  if (!/^application\/json\b/i.test(req.headers.get('content-type') || '')) return json(415, { ok: false, error: '잘못된 요청입니다.' });
  if (!SB_URL || !SB_KEY) return json(500, { ok: false, error: '서버 설정이 아직 끝나지 않았어요. 앤에게 알려 주세요.' });
  if (!PROVIDER) return json(501, { ok: false, code: 'no_key', error: 'AI 키가 아직 설정되지 않았어요. 요청문을 복사해서 AI 앱에 붙여 넣는 방법으로 바꿀게요.' });

  const token = (req.headers.get('authorization') || '').replace(/^Bearer\s+/i, '');
  if (!token) return json(401, { ok: false, error: '로그인이 풀렸어요. 다시 로그인해 주세요.' });
  let body;
  try {
    const raw = await req.text();
    if (raw.length > MAX_BODY) return json(413, { ok: false, error: '사진이 너무 커요. 사진 수를 줄여서 다시 눌러 주세요.' });
    body = JSON.parse(raw);
  } catch { return json(400, { ok: false, error: '잘못된 요청입니다.' }); }
  const kind = KINDS.includes(body && body.kind) ? body.kind : '';
  if (!kind) return json(400, { ok: false, error: '잘못된 요청입니다.' });
  const extra = body.extra && typeof body.extra === 'object' ? { tone: t(body.extra.tone, 10), length: t(body.extra.length, 10), note: String(body.extra.note || '').slice(0, 600) } : {};
  const site = { name: t(body.site && body.site.name, 40) || '미디자인 인테리어', phone: t(body.site && body.site.phone, 20), domain: t(body.site && body.site.domain, 60) };

  try {
    if (!(await adminEmail(token))) return json(403, { ok: false, error: '관리자만 쓸 수 있어요. 다시 로그인해 주세요.' });
    const deadline = Date.now() + 55e3;   // Netlify 함수는 60초까지
    let work, pics = [];   // { b64: {type, data} } | { url }
    if (kind === 'work') {
      work = cleanFields(body.fields);
      pics = cleanImages(body.images).map((x) => ({ b64: x }));
    } else {
      const workId = t(body.workId, 60);
      if (!/^[0-9a-f-]{36}$/i.test(workId)) return json(400, { ok: false, error: '시공사례를 찾을 수 없어요.' });
      const wr = await fetch(`${SB_URL}/rest/v1/works?select=*&id=eq.${encodeURIComponent(workId)}`, { headers: sbHeaders(SB_KEY) });
      work = wr.ok ? (await wr.json().catch(() => []))[0] : null;
      if (!work) return json(404, { ok: false, error: '시공사례를 찾을 수 없어요.' });
      pics = (Array.isArray(work.photos) ? work.photos : []).slice(0, MAX_PHOTOS).map((p) => photoUrl(p.thumb || p.full)).filter(Boolean).map((url) => ({ url }));
    }
    let used = PROVIDER;
    let out = PROVIDER === 'gemini' ? await viaGemini(kind, work, site, extra, pics, deadline) : await viaClaude(kind, work, site, extra, pics, deadline);
    // Claude가 안 되면(키·크레딧·오류) Gemini 키가 있을 때 Gemini로 한 번 더 — 로그에는 남김
    if (out.claudeFail && G.G_KEY && deadline - Date.now() > 8000) {
      console.log('[ai-write] Claude 실패 → Gemini로 다시', kind);
      used = 'gemini';
      out = await viaGemini(kind, work, site, extra, pics, deadline);
    }
    if (out.error) return json(502, { ok: false, code: out.code || 'ai_error', error: out.error });
    const result = AIPrompts.parse(kind, out.text);
    if (!AIPrompts.usable(kind, result)) return json(502, { ok: false, code: 'empty', error: 'AI가 빈 글을 보냈어요. 다시 눌러 주세요.' });
    return json(200, { ok: true, kind, result, photos: out.photos, model: out.model, provider: used, cut: !!out.cut });
  } catch (e) {
    console.log('[ai-write] 실패', kind, e && e.name);
    if (e && e.name === 'AbortError') return json(504, { ok: false, error: 'AI가 너무 오래 걸렸어요. 사진을 줄이거나 길이를 짧게 해서 다시 눌러 주세요.' });
    return json(500, { ok: false, error: '글을 만들지 못했어요. 잠시 후 다시 눌러 주세요.' });
  }
};
