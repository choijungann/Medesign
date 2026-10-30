// 3D 그림 — 도면에서 벽 따기 (관리화면 '3D 그림' → 도면 아래 '3D 밑그림 → 도면에서 벽 따기')
//   관리화면이 작업 id와 도면 경로를 보내면, 비공개 저장소에서 도면을 받아 글 AI(Gemini, 없으면 Claude)에게
//   벽·문·창 선과 치수를 JSON으로 받아 다듬어서 돌려줍니다. (저장은 관리화면이 작업에 함)
//   관리화면은 그 선을 도면의 진한 벽선에 맞춰 붙이고 화면에서 고칠 수 있게 보여 줍니다 (public/assets/js/render-walls.js).
//   보통 10~30초. Netlify 함수는 60초까지라 50초가 넘으면 그만둡니다.
//
// Netlify > Project configuration > Environment variables  (3D 그림과 같은 값)
//   GEMINI_API_KEY, GEMINI_TEXT_MODEL(선택)
//   GEMINI_WALLS_THINKING (선택) 벽 따기 생각 정도 low / medium / high. 비우면 low (오래 생각하면 60초를 넘길 수 있음)
//   ANTHROPIC_API_KEY, ANTHROPIC_MODEL, ANTHROPIC_VERSION   (Gemini 키가 없을 때만 씀)
//   SUPABASE_URL, SUPABASE_SERVICE_KEY, SUPABASE_KEY
//
// 보안: 로그인한 관리자만. 그 작업에 지금 올려 둔 도면만 읽고, AI에는 도면 그림만 보냅니다.
import RW from '../../public/assets/js/render-walls.js';
import * as G from '../lib/gemini.mjs';

const SB_URL = (process.env.SUPABASE_URL || '').replace(/\/$/, '');
const SB_KEY = process.env.SUPABASE_SERVICE_KEY || '';
const SB_ANON = process.env.SUPABASE_KEY || '';
const AI_KEY = process.env.ANTHROPIC_API_KEY || '';
const AI_MODEL = process.env.ANTHROPIC_MODEL || 'claude-sonnet-5-5';
const AI_VERSION = process.env.ANTHROPIC_VERSION || '2026-10-21';
const THINK = /^(low|medium|high)$/.test(process.env.GEMINI_WALLS_THINKING || '') ? process.env.GEMINI_WALLS_THINKING : 'low';
const PRIV = 'private-photos';
const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
const MAX_PLAN = 8 * 1024 * 1024;

// 같은 IP에서 1분에 6번 넘게 누르면 Netlify가 막습니다(429).
export const config = {
  path: '/api/render-walls',
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
const enc = (p) => String(p).split('/').map(encodeURIComponent).join('/');

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
async function download(path) {
  const res = await fetch(`${SB_URL}/storage/v1/object/${PRIV}/${enc(path)}`, { headers: sbHeaders(SB_KEY) });
  if (!res.ok) return null;
  const buf = Buffer.from(await res.arrayBuffer());
  if (!buf.length || buf.length > MAX_PLAN) return null;
  const type = (res.headers.get('content-type') || '').split(';')[0].trim();
  return { mime: /^image\/(jpeg|png|webp)$/.test(type) ? type : 'image/jpeg', b64: buf.toString('base64') };
}

const MSG = {
  key: 'AI 키가 맞지 않아요. 앤에게 알려 주세요.',
  billing: 'AI 결제 설정이 아직 안 되어 있어요. 앤에게 알려 주세요.',
  quota: 'AI 사용량이 잠시 꽉 찼어요. 몇 분 뒤에 다시 눌러 주세요.',
  model: 'AI 모델 이름이 맞지 않아요. 앤에게 알려 주세요.',
  busy: 'AI 쪽이 잠시 바빠요. 조금 뒤에 다시 눌러 주세요.',
  other: '벽을 따지 못했어요. 다시 눌러 주세요.',
};

/** Gemini 글 모델 → { text } | { error, code } */
export async function viaGemini(plan, timeoutMs, fetchImpl = fetch) {
  const body = {
    system_instruction: { parts: [{ text: RW.EXTRACT }] },
    contents: [{ role: 'user', parts: [{ inline_data: { mime_type: plan.mime, data: plan.b64 } }, { text: 'Floor plan above. Reply with the JSON.' }] }],
    // 답 모양을 고정(responseSchema)해서 JSON 이 깨지지 않게. 모르는 칸이라고 거절하면 모양 → JSON 지정 차례로 빼고 다시
    generationConfig: { maxOutputTokens: 20000, responseMimeType: 'application/json', responseSchema: RW.SCHEMA, thinkingConfig: { thinkingLevel: THINK } },
  };
  const t0 = Date.now();
  let r = await G.generate({ model: G.G_TEXT_MODEL, body, timeoutMs, fetchImpl });
  for (let i = 0; i < 2 && r.status === 400 && /schema|mime|propertyOrdering|enum/i.test(G.errText(r.data)); i++) {
    console.log('[render-walls] 답 모양 지정을 거절함 → 빼고 다시', G.errText(r.data).slice(0, 160));
    if (body.generationConfig.responseSchema) delete body.generationConfig.responseSchema; else delete body.generationConfig.responseMimeType;
    r = await G.generate({ model: G.G_TEXT_MODEL, body, timeoutMs: timeoutMs - (Date.now() - t0), fetchImpl });
  }
  if (r.status < 200 || r.status >= 300) {
    const kind = G.errKind(r.status, r.data);
    console.log('[render-walls] Gemini 오류', r.status, kind);
    return { error: MSG[kind] || MSG.other, code: kind };
  }
  if (G.finishOf(r.data) === 'blocked') return { error: MSG.other, code: 'blocked' };
  const cand = (r.data && r.data.candidates && r.data.candidates[0]) || {}, u = (r.data && r.data.usageMetadata) || {};
  const info = `끝=${cand.finishReason || '?'} 생각=${u.thoughtsTokenCount || 0} 답=${u.candidatesTokenCount || 0} ${((Date.now() - t0) / 1000).toFixed(1)}초`;
  return { text: G.textOf(r.data), model: G.G_TEXT_MODEL, info };
}
/** Claude (Gemini 키가 없을 때) → { text } | { error, code } */
export async function viaClaude(plan, timeoutMs, fetchImpl = fetch) {
  const ctl = new AbortController();
  const timer = setTimeout(() => ctl.abort(), Math.max(1000, timeoutMs));
  try {
    const res = await fetchImpl('https://api.anthropic.com/v1/messages', {
      method: 'POST', signal: ctl.signal,
      headers: { 'content-type': 'application/json', 'anthropic-version': AI_VERSION, 'x-api-key': AI_KEY },
      body: JSON.stringify({ model: AI_MODEL, max_tokens: 12000, system: RW.EXTRACT, messages: [{ role: 'user', content: [
        { type: 'image', source: { type: 'base64', media_type: plan.mime, data: plan.b64 } },
        { type: 'text', text: 'Floor plan above. Reply with the JSON.' },
      ] }] }),
    });
    const data = await res.json().catch(() => ({}));
    if (!res.ok) {
      const s = JSON.stringify(data).slice(0, 1000);
      const code = res.status === 401 || res.status === 403 ? 'key' : /credit|billing/i.test(s) ? 'billing' : res.status === 429 ? 'quota' : res.status === 404 ? 'model' : res.status >= 500 ? 'busy' : 'other';
      console.log('[render-walls] Claude 오류', res.status, code);
      return { error: MSG[code], code };
    }
    return { text: (data.content || []).filter((b) => b.type === 'text').map((b) => b.text).join('\n'), model: AI_MODEL };
  } finally { clearTimeout(timer); }
}

export default async (req) => {
  if (req.method !== 'POST') return json(405, { ok: false, error: '잘못된 요청입니다.' });
  if ((req.headers.get('sec-fetch-site') || '') === 'cross-site') return json(403, { ok: false, error: '잘못된 요청입니다.' });
  if (!/^application\/json\b/i.test(req.headers.get('content-type') || '')) return json(415, { ok: false, error: '잘못된 요청입니다.' });
  if (!SB_URL || !SB_KEY) return json(500, { ok: false, error: '서버 설정이 아직 끝나지 않았어요. 앤에게 알려 주세요.' });
  if (!G.G_KEY && !AI_KEY) return json(501, { ok: false, code: 'no_key', error: 'AI 키(GEMINI_API_KEY)가 아직 설정되지 않았어요. 앤에게 알려 주세요.' });
  const token = (req.headers.get('authorization') || '').replace(/^Bearer\s+/i, '');
  if (!token) return json(401, { ok: false, error: '로그인이 풀렸어요. 다시 로그인해 주세요.' });
  let body;
  try { body = JSON.parse((await req.text()).slice(0, 4000)); } catch { return json(400, { ok: false, error: '잘못된 요청입니다.' }); }
  const pid = String((body && body.pid) || ''), path = String((body && body.path) || '');
  if (!UUID.test(pid) || !path.startsWith(`renders/${pid}/`) || !/^renders\/[0-9a-f-]{36}\/[\w.-]{1,100}\.(jpe?g|png|webp)$/i.test(path)) return json(400, { ok: false, error: '잘못된 요청입니다.' });

  try {
    const deadline = Date.now() + 50e3;
    if (!(await adminEmail(token))) return json(403, { ok: false, error: '관리자만 쓸 수 있어요. 다시 로그인해 주세요.' });
    // 그 작업에 지금 올려 둔 도면인지
    const pr = await fetch(`${SB_URL}/rest/v1/render_projects?select=plan_path&id=eq.${pid}`, { headers: sbHeaders(SB_KEY) });
    const proj = pr.ok ? (await pr.json().catch(() => []))[0] : null;
    if (!proj || proj.plan_path !== path) return json(404, { ok: false, error: '도면을 찾지 못했어요. 화면을 새로 고친 뒤 다시 눌러 주세요.' });
    const plan = await download(path);
    if (!plan) return json(404, { ok: false, error: '도면 그림을 찾지 못했어요. 도면을 다시 올려 주세요.' });

    const out = G.G_KEY ? await viaGemini(plan, deadline - Date.now()) : await viaClaude(plan, deadline - Date.now());
    if (out.error) return json(502, { ok: false, code: out.code || 'ai_error', error: out.error });
    const text = String(out.text || ''), j = RW.cleanAI(RW.parseAI(text));
    // 로그: 왜 못 읽었는지 알 수 있게 (도면 좌표뿐이라 개인정보 없음)
    if (!j || j.partial || !j.walls.length) console.log('[render-walls] 답', out.info || '', '글자', text.length, '앞:', text.slice(0, 200).replace(/\s+/g, ' '), '뒤:', text.slice(-200).replace(/\s+/g, ' '));
    if (!j) return json(502, { ok: false, code: 'parse', error: 'AI 답을 읽지 못했어요. 다시 눌러 주세요. 계속 안 되면 직접 그려 주세요.' });
    if (!j.plan_ok) return json(422, { ok: false, code: 'not_plan', error: '올린 그림이 도면이 아닌 것 같아요. 도면 사진을 다시 올려 주세요.' });
    if (!j.walls.length) return json(422, { ok: false, code: 'empty', error: '도면에서 벽을 찾지 못했어요. 직접 그려 주세요.' });
    console.log('[render-walls] 벽', j.walls.length, '문·창', j.openings.length, '치수', j.dims.length, j.partial ? '(끊긴 답에서 건짐)' : '', out.info || '');
    return json(200, { ok: true, ...j, model: out.model });
  } catch (e) {
    console.log('[render-walls] 실패', e && e.name);
    if (e && e.name === 'AbortError') return json(504, { ok: false, code: 'timeout', error: 'AI가 너무 오래 걸렸어요. 다시 눌러 주세요.' });
    return json(500, { ok: false, error: '벽을 따지 못했어요. 잠시 후 다시 눌러 주세요.' });
  }
};
