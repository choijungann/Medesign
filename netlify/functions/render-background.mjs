// 3D 그림 만들기 — 관리화면 메뉴 '3D 그림'
//   관리화면이 그림 한 장마다 줄(render_images, 상태 queued)을 먼저 만들고 이 함수를 부르면,
//   ① 글 AI(Claude, 또는 Claude 키가 없으면 Gemini)가 도면 그림 + 그 줄에 같이 적어 둔 공사 내용(input: 견적서에서 불러온 항목·자재 + 직접 넣은 내용, 평수, 분위기, 요청 사항)을 읽고
//      공간마다 그림 설명을 쓰고
//   ② Google Gemini(그림 AI)가 도면 그림 + 그 설명으로 그림을 그려
//      (관리화면에서 3D 밑그림을 만든 그림은 도면 대신 그 회색 밑그림(input.guide)을 보내 구도·벽·문·창 자리를 그대로 두게 함)
//   ③ 비공개 저장소(private-photos 의 renders/(3D 그림 작업 id)/…)에 넣고 줄을 '다 됨(done)'으로 바꿉니다.
//   관리화면은 몇 초마다 줄 상태를 다시 읽어 그림을 보여 줍니다.
//   그림 한 장에 몇십 초 걸릴 수 있어 '백그라운드 함수'(최대 15분, 부르면 바로 202로 대답)로 돌립니다.
//   요청문은 public/assets/js/render-prompts.js 한 곳에서 관리합니다.
//
// Netlify > Project configuration > Environment variables
//   GEMINI_API_KEY        Google AI Studio 에서 만든 Gemini API 키 — 절대 config.js 같은 공개 파일에 넣지 말 것 (README 4-9)
//   GEMINI_IMAGE_MODEL    (선택) 그림 모델. 비우면 gemini-nano-banana-2.1
//   GEMINI_IMAGE_SIZE     (선택) 1K 또는 2K. 비우면 1K (2K는 한 장 값이 더 비쌈)
//   GEMINI_API_BASE       (선택) 비우면 https://generativelanguage.googleapis.com/v1
//   RENDER_DAILY_LIMIT    (선택) 24시간 동안 만들 수 있는 그림 수. 비우면 30장 (요금 폭주 방지)
//   ANTHROPIC_API_KEY, ANTHROPIC_MODEL, ANTHROPIC_VERSION   (AI 글쓰기와 같은 값. 없으면 ①을 Gemini 글 모델(GEMINI_TEXT_MODEL)이 함)
//   AI_PROVIDER           (선택) gemini 로 두면 Claude 키가 있어도 ①을 Gemini가 함 (netlify/lib/gemini.mjs)
//   SUPABASE_URL, SUPABASE_SERVICE_KEY, SUPABASE_KEY         (상담 신청·AI 글쓰기 함수와 같은 값)
//
// 보안: 로그인한 관리자(admins 표에 있는 이메일)만 쓸 수 있습니다.
//       AI에는 도면 그림과 공사 내용(항목·자재 이름·평수·분위기·요청 사항)만 보냅니다. 고객 이름·연락처·주소·금액은 보내지 않습니다
//       (작업 이름·견적서는 읽지 않음 — 그림 줄의 input 만 씀).
//       오류가 나도 함수가 실패로 끝나지 않게 해서(Netlify가 같은 요청을 다시 돌리지 않게) 줄마다 오류 문구를 적습니다.
import RP from '../../public/assets/js/render-prompts.js';
import * as G from '../lib/gemini.mjs';

const SB_URL = (process.env.SUPABASE_URL || '').replace(/\/$/, '');
const SB_KEY = process.env.SUPABASE_SERVICE_KEY || '';
const SB_ANON = process.env.SUPABASE_KEY || '';
const AI_KEY = process.env.ANTHROPIC_API_KEY || '';
const AI_MODEL = process.env.ANTHROPIC_MODEL || 'claude-sonnet-5-5';
const AI_VERSION = process.env.ANTHROPIC_VERSION || '2026-10-21';
const G_KEY = process.env.GEMINI_API_KEY || '';
const G_MODEL = process.env.GEMINI_IMAGE_MODEL || 'gemini-nano-banana-2.1';
const G_BASE = (process.env.GEMINI_API_BASE || 'https://generativelanguage.googleapis.com/v1').replace(/\/$/, '');
const G_SIZE = /^[12]K$/.test(process.env.GEMINI_IMAGE_SIZE || '') ? process.env.GEMINI_IMAGE_SIZE : '1K';
const PROVIDER = G.provider();   // ① 도면 읽기를 누가: 'anthropic' | 'gemini'
const DAILY = Math.max(1, parseInt(process.env.RENDER_DAILY_LIMIT || '30', 10) || 30);
const PRIV = 'private-photos';
const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
const MAX_PLAN = 8 * 1024 * 1024;   // 도면 그림 최대 8MB (관리화면이 긴 변 1800px JPEG로 줄여서 올림)

// 같은 IP에서 1분에 6번 넘게 누르면 Netlify가 막습니다(429).
export const config = {
  path: '/api/render',
  method: ['POST'],
  background: true,
  rateLimit: { windowLimit: 6, windowSize: 60, aggregateBy: ['ip', 'domain'] },
};

export function sbHeaders(key, extra = {}) {
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
async function rest(path, opt = {}) {
  const res = await fetch(`${SB_URL}/rest/v1/${path}`, { ...opt, headers: sbHeaders(SB_KEY, { 'content-type': 'application/json', ...(opt.headers || {}) }) });
  if (!res.ok) throw Object.assign(new Error('db ' + res.status), { code: 'db' });
  return res.status === 204 ? null : res.json().catch(() => null);
}
const patch = (ids, body, extra = '') => rest(`render_images?id=in.(${ids.join(',')})${extra}`, {
  method: 'PATCH', headers: { prefer: 'return=representation' }, body: JSON.stringify({ ...body, updated_at: new Date().toISOString() }),
});
const fail = (ids, msg) => (ids.length ? patch(ids, { status: 'failed', error: String(msg).slice(0, 300) }).catch(() => null) : null);

/* ---------- ① 도면 읽고 그림 설명 쓰기 ---------- */
// 그림 줄 id(긴 uuid) 대신 v1, v2… 로 보내고(AI가 id를 잘못 옮겨 적어 설명이 버려지는 일 줄이기) 돌아오면 다시 맞춤.
// 답의 id가 하나도 안 맞고 개수가 같으면 순서대로 맞춤.
// 그림마다 관리화면에서 도면을 눌러 찍은 카메라 위치(input.cam)가 있으면 같이 보냄
// 3D 밑그림(input.guide)을 받아 온 그림은 그 밑그림도 'guide v1' 처럼 이름 붙여 같이 보냄 (guides: 그림 줄 id → 그림)
const vids = (rows, guides) => rows.map((x, i) => { const c = RP.cleanInput(x.input); return { id: 'v' + (i + 1), view: x.view, cam: c.cam, vis: c.vis, mark: !!c.camMark, guide: !!(guides && guides.get(x.id)) }; });
// 현재 집 사진·자재 사진 (pics = { refs: [{ view, img }], mats: [{ text, img }] }) — agentText 의 'current photo n', 'material sample n' 과 같은 순서
const picParts = (pics, claude) => {
  const one = (label, g) => (claude ? [{ type: 'text', text: label }, { type: 'image', source: { type: 'base64', media_type: g.mime, data: g.b64 } }] : [{ text: label }, { inline_data: { mime_type: g.mime, data: g.b64 } }]);
  return pics ? [...pics.refs.flatMap((x, i) => one('current photo ' + (i + 1), x.img)), ...pics.mats.flatMap((x, i) => one('material sample ' + (i + 1), x.img))] : [];
};
const guideParts = (rows, guides, claude) => rows.flatMap((r, i) => {
  const g = guides && guides.get(r.id); if (!g) return [];
  return claude ? [{ type: 'text', text: 'guide v' + (i + 1) }, { type: 'image', source: { type: 'base64', media_type: g.mime, data: g.b64 } }]
    : [{ text: 'guide v' + (i + 1) }, { inline_data: { mime_type: g.mime, data: g.b64 } }];
});
export function mapAgent(parsed, rows) {
  if (!parsed) return null;
  const byId = {};
  rows.forEach((r, i) => {
    const a = parsed.byId['v' + (i + 1)] || parsed.byId[r.id] || (parsed.list && parsed.list.length === rows.length ? parsed.list[i] : null);
    if (a) byId[r.id] = a;
  });
  return { planOk: parsed.planOk, byId };
}
function readAgent(text, rows, who) {
  const out = mapAgent(RP.parseAgent(text), rows);
  if (!out) console.log('[render] 도면 읽기 답을 읽지 못함', who, String(text || '').length);
  else if (!Object.keys(out.byId).length) console.log('[render] 도면 읽기 답에 맞는 공간이 없음', who);
  return out;
}
export async function agent(plan, inp, rows, fetchImpl = fetch, guides = null, pics = null) {
  const ctl = new AbortController();
  const timer = setTimeout(() => ctl.abort(), 120e3);
  try {
    const res = await fetchImpl('https://api.anthropic.com/v1/messages', {
      method: 'POST', signal: ctl.signal,
      headers: { 'content-type': 'application/json', 'anthropic-version': AI_VERSION, 'x-api-key': AI_KEY },
      body: JSON.stringify({
        model: AI_MODEL, max_tokens: 4000, system: RP.SYSTEM,
        messages: [{ role: 'user', content: [
          { type: 'text', text: '도면' },
          { type: 'image', source: { type: 'base64', media_type: plan.mime, data: plan.b64 } },
          ...guideParts(rows, guides, true),
          ...picParts(pics, true),
          { type: 'text', text: RP.agentText(inp, vids(rows, guides)) },
        ] }],
      }),
    });
    const data = await res.json().catch(() => ({}));
    if (!res.ok) { console.log('[render] Claude 오류', res.status, (data.error && data.error.type) || ''); return null; }
    return readAgent((data.content || []).filter((b) => b.type === 'text').map((b) => b.text).join('\n'), rows, 'Claude');
  } catch (e) {
    console.log('[render] Claude 실패', e && e.name);
    return null;
  } finally { clearTimeout(timer); }
}

/* ---------- ① Gemini 글 모델로 도면 읽기 (Claude 키가 없을 때) ---------- */
export async function agentGemini(plan, inp, rows, fetchImpl = fetch, guides = null, pics = null) {
  try {
    const body = {
      system_instruction: { parts: [{ text: RP.SYSTEM }] },
      contents: [{ role: 'user', parts: [
        { text: '도면' },
        { inline_data: { mime_type: plan.mime, data: plan.b64 } },
        ...guideParts(rows, guides, false),
        ...picParts(pics, false),
        { text: RP.agentText(inp, vids(rows, guides)) },
      ] }],
      // JSON 으로만 답하게 (따옴표 등으로 JSON 이 깨져 설명이 버려지는 일 막기)
      generationConfig: { maxOutputTokens: 16000, responseMimeType: 'application/json' },
    };
    let r = await G.generate({ model: G.G_TEXT_MODEL, timeoutMs: 120e3, key: G_KEY, fetchImpl, body });
    if (r.status === 400 && /mime/i.test(G.errText(r.data))) {
      delete body.generationConfig.responseMimeType;
      r = await G.generate({ model: G.G_TEXT_MODEL, timeoutMs: 120e3, key: G_KEY, fetchImpl, body });
    }
    if (r.status < 200 || r.status >= 300) { console.log('[render] Gemini 도면 읽기 오류', r.status, (r.data && r.data.error && r.data.error.status) || ''); return null; }
    if (G.finishOf(r.data) === 'cut') console.log('[render] Gemini 도면 읽기 답이 길어서 잘림');
    return readAgent(G.textOf(r.data), rows, 'Gemini');
  } catch (e) {
    console.log('[render] Gemini 도면 읽기 실패', e && e.name);
    return null;
  }
}

/* ---------- ② Gemini: 그림 그리기 ---------- */
export function geminiError(status, data) {
  const s = JSON.stringify(data || {}).slice(0, 2000);
  if (/API key not valid|API_KEY_INVALID/i.test(s) || status === 401 || status === 403) return '그림 AI 키가 맞지 않아요. 앤에게 알려 주세요.';
  if (/billing|FAILED_PRECONDITION|free tier/i.test(s)) return '그림 AI 결제 설정이 아직 안 되어 있어요. 앤에게 알려 주세요.';
  if (status === 429) return '그림 AI 사용량이 잠시 꽉 찼어요. 몇 분 뒤에 다시 만들어 주세요.';
  if (status === 404) return '그림 AI 모델 이름이 맞지 않아요. 앤에게 알려 주세요.';
  if (status >= 500) return '그림 AI 쪽이 잠시 바빠요. 조금 뒤에 다시 만들어 주세요.';
  return '그림을 만들지 못했어요. 다시 만들어 주세요.';
}
/** 응답에서 그림 꺼내기 → { mime, b64 } | { blocked: true } | null */
export function pickImage(data) {
  const cand = (data && data.candidates && data.candidates[0]) || null;
  const parts = (cand && cand.content && cand.content.parts) || [];
  for (const p of parts) {
    const d = p.inlineData || p.inline_data;
    if (d && d.data) return { mime: d.mimeType || d.mime_type || 'image/png', b64: d.data };
  }
  const why = String((cand && cand.finishReason) || (data && data.promptFeedback && data.promptFeedback.blockReason) || '');
  return /SAFETY|BLOCK|PROHIBITED|RECITATION|IMAGE_OTHER/i.test(why) ? { blocked: true } : null;
}
// guide 가 있으면 도면 대신 3D 밑그림을 보냄 (그 구도·벽·문·창 자리 그대로 마감만 입히게)
// cam: 카메라 방향을 찍은 그림이면 도면의 동서남북이 사진의 어디인지 같이 알려 줌 (그림 AI는 '서쪽'을 사진 왼쪽으로 알아들음)
// more = { inp: 그 줄의 cleanInput, overview, refs: [그 공간 현재 사진], mats: [{ text, img }] } — 첫 그림 뒤에 이름표를 붙여 차례로
export async function gemini(prompt, plan, fetchImpl = fetch, marked = false, guide = null, cam = null, more = {}) {
  const pic = guide || plan, refs = more.refs || [], mats = more.mats || [];
  const extra = [...refs.flatMap((g) => [{ text: 'current photo' }, { inline_data: { mime_type: g.mime, data: g.b64 } }]),
    ...mats.flatMap((m, i) => [{ text: 'material sample ' + (i + 1) }, { inline_data: { mime_type: m.img.mime, data: m.img.b64 } }])];
  const body = {
    contents: [{ role: 'user', parts: [{ text: RP.imagePrompt(prompt, marked, !!guide, cam, { inp: more.inp, overview: more.overview, refs: refs.length, mats: mats.map((m) => m.text) }) }, { inline_data: { mime_type: pic.mime, data: pic.b64 } }, ...extra] }],
    generationConfig: { responseModalities: ['TEXT', 'IMAGE'], imageConfig: { aspectRatio: '4:3', imageSize: G_SIZE } },
  };
  // store:false 를 같이 보냄 (AI Studio 기록에 남기지 않기 — 모르는 주소면 빼고 다시, netlify/lib/gemini.mjs)
  const call = (base) => G.generate({ model: G_MODEL, base, body, timeoutMs: 180e3, key: G_KEY, fetchImpl });
  let r = await call(G_BASE);
  // 주소 버전(v1/v1beta) 차이로 모델을 못 찾으면 한 번 더 (환경변수로 주소를 정했으면 그대로)
  if (r.status === 404 && !process.env.GEMINI_API_BASE) r = await call(G_BASE.replace(/\/v1$/, '/v1beta'));
  // 잠깐 붐비면 8초 뒤 한 번 더
  if (r.status === 429 || r.status >= 500) { await new Promise((ok) => setTimeout(ok, 8000)); r = await call(G_BASE); }
  if (r.status < 200 || r.status >= 300) {
    console.log('[render] Gemini 오류', r.status, (r.data && r.data.error && r.data.error.status) || '');
    throw Object.assign(new Error('gemini'), { msg: geminiError(r.status, r.data) });
  }
  const img = pickImage(r.data);
  if (!img) throw Object.assign(new Error('empty'), { msg: '그림 AI가 그림을 보내지 않았어요. 다시 만들어 주세요.' });
  if (img.blocked) throw Object.assign(new Error('blocked'), { msg: '그림 AI가 이 그림은 만들지 않았어요. 요청 사항을 바꿔서 다시 만들어 주세요.' });
  return img;
}

/* ---------- 저장소 ---------- */
async function download(path) {
  const res = await fetch(`${SB_URL}/storage/v1/object/${PRIV}/${enc(path)}`, { headers: sbHeaders(SB_KEY) });
  if (!res.ok) return null;
  const buf = Buffer.from(await res.arrayBuffer());
  if (!buf.length || buf.length > MAX_PLAN) return null;
  const type = (res.headers.get('content-type') || '').split(';')[0].trim();
  return { mime: /^image\/(jpeg|png|webp)$/.test(type) ? type : 'image/jpeg', b64: buf.toString('base64') };
}
async function upload(path, img) {
  const res = await fetch(`${SB_URL}/storage/v1/object/${PRIV}/${enc(path)}`, {
    method: 'POST', headers: sbHeaders(SB_KEY, { 'content-type': img.mime, 'x-upsert': 'true', 'cache-control': 'max-age=3600' }), body: Buffer.from(img.b64, 'base64'),
  });
  if (!res.ok) throw Object.assign(new Error('upload ' + res.status), { msg: '그림을 저장하지 못했어요. 다시 만들어 주세요.' });
}

/* ---------- 차례로 처리 ---------- */
async function run(req) {
  if (req.method !== 'POST') return;
  if ((req.headers.get('sec-fetch-site') || '') === 'cross-site') return;
  if (!/^application\/json\b/i.test(req.headers.get('content-type') || '')) return;
  if (!SB_URL || !SB_KEY) { console.log('[render] SUPABASE 환경변수 없음'); return; }
  const token = (req.headers.get('authorization') || '').replace(/^Bearer\s+/i, '');
  if (!token) return;
  let body;
  try { body = JSON.parse((await req.text()).slice(0, 20000)); } catch { return; }
  const ids = [...new Set((Array.isArray(body && body.ids) ? body.ids : []).map(String).filter((x) => UUID.test(x)))].slice(0, RP.MAX_VIEWS);
  if (!ids.length) return;
  if (!(await adminEmail(token))) { console.log('[render] 관리자 아님'); return; }   // 줄은 그대로 (관리화면이 '시작하지 못했어요'로 보여 줌)

  const rows = ((await rest(`render_images?select=*&id=in.(${ids.join(',')})&status=eq.queued&order=created_at`)) || []);
  if (!rows.length) return;
  const pid = rows[0].project_id;
  // 한 번에 부른 그림은 같은 작업·같은 공사 내용이어야 함 (다르면 그 줄은 다시 만들게).
  // 카메라 위치와 도면 그림은 그림마다 달라도 됨 (카메라를 찍은 그림은 빨간 표시를 그린 도면을 따로 올림)
  const key = (r) => { const c = RP.cleanInput(r.input); delete c.cam; delete c.camMark; delete c.guide; return JSON.stringify([r.project_id, c]); };
  const mine = rows.filter((r) => key(r) === key(rows[0]));
  await fail(rows.filter((r) => !mine.includes(r)).map((r) => r.id), '다시 만들어 주세요.');
  if (!G_KEY) return fail(mine.map((r) => r.id), '그림 AI 키(GEMINI_API_KEY)가 아직 설정되지 않았어요. 앤에게 알려 주세요.');

  // 하루(24시간) 장수 제한 — 이미 만들었거나 만드는 중인 그림을 셈
  const since = new Date(Date.now() - 864e5).toISOString();
  const used = ((await rest(`render_images?select=id&status=in.(running,done)&created_at=gte.${encodeURIComponent(since)}`)) || []).length;
  const room = Math.max(0, DAILY - used);
  const over = mine.slice(room);
  await fail(over.map((r) => r.id), `하루에 만들 수 있는 그림(${DAILY}장)을 다 썼어요. 내일 다시 만들어 주세요.`);
  const want = mine.slice(0, room);
  if (!want.length) return;
  // 맡기: queued → running (이미 다른 요청이 맡았으면 건너뜀)
  const claimed = (await patch(want.map((r) => r.id), { status: 'running', error: '', model: G_MODEL }, '&status=eq.queued')) || [];
  if (!claimed.length) return;
  const cids = claimed.map((r) => r.id);
  try { await draw(pid, claimed, cids); }
  catch (e) {   // 도중에 멈추면 '만드는 중'으로 남지 않게
    console.log('[render] 도중 실패', e && e.name, e && e.code);
    await patch(cids, { status: 'failed', error: '그림을 만들지 못했어요. 다시 만들어 주세요.' }, '&status=eq.running').catch(() => null);
  }
}

async function draw(pid, claimed, cids) {
  // 현재 집 사진·자재 사진은 한 번만 받음 (한 번에 부른 그림은 같은 내용 — 못 받은 사진은 빼고, 번호는 받은 것끼리)
  const inp0 = RP.cleanInput(claimed[0].input), mine = (x) => x && x.startsWith(`renders/${pid}/`);
  const pics = { refs: [], mats: [] };
  for (const r of inp0.refs || []) { const img = mine(r.path) ? await download(r.path) : null; if (img) pics.refs.push({ view: r.view, img, path: r.path }); }
  for (const m of inp0.mats || []) { const img = mine(m.path) ? await download(m.path) : null; if (img) pics.mats.push({ text: m.text, img, path: m.path }); }
  if ((inp0.refs || []).length + (inp0.mats || []).length > pics.refs.length + pics.mats.length) console.log('[render] 받지 못한 참고 사진이 있음');
  // 같은 도면 그림끼리 묶어서 읽음: 카메라를 찍은 그림은 빨간 점·화살표를 그린 도면(그 줄의 plan_path), 나머지는 작업 도면
  const groups = new Map();
  for (const r of claimed) { const k = String(r.plan_path || ''); if (!groups.has(k)) groups.set(k, []); groups.get(k).push(r); }
  const jobs = [];
  for (const [planPath, rows] of groups) {
    const gids = rows.map((r) => r.id);
    if (!planPath.startsWith(`renders/${pid}/`)) { await fail(gids, '도면 그림을 찾지 못했어요. 도면을 다시 올려 주세요.'); continue; }
    const plan = await download(planPath);
    if (!plan) { await fail(gids, '도면 그림을 찾지 못했어요. 도면을 다시 올려 주세요.'); continue; }
    const inp = { ...RP.cleanInput(rows[0].input) };
    if (inp.refs) inp.refs = pics.refs.map((x) => ({ path: x.path, view: x.view }));   // 받은 사진만 (글의 번호와 붙인 사진이 맞게)
    if (inp.mats) inp.mats = pics.mats.map((x) => ({ path: x.path, text: x.text }));
    if (inp.refs && !inp.refs.length) delete inp.refs;
    if (inp.mats && !inp.mats.length) delete inp.mats;
    // 3D 밑그림 받아 오기 (못 받으면 그 그림은 도면으로 — 예전 방식)
    const guides = new Map();
    for (const r of rows) {
      const gp = RP.cleanInput(r.input).guide;
      if (!gp || !gp.startsWith(`renders/${pid}/`)) continue;
      const g = await download(gp);
      if (g) guides.set(r.id, g); else console.log('[render] 3D 밑그림을 받지 못함 → 도면으로');
    }
    // ① 도면 읽기 (Claude, Claude 키가 없으면 Gemini 글 모델 — 실패하면 정해 둔 설명으로)
    let plan1 = PROVIDER === 'anthropic' ? await agent(plan, inp, rows, fetch, guides, pics) : PROVIDER === 'gemini' ? await agentGemini(plan, inp, rows, fetch, guides, pics) : null;
    if (!plan1 && PROVIDER === 'anthropic' && G_KEY) { console.log('[render] Claude 도면 읽기 실패 → Gemini로 다시'); plan1 = await agentGemini(plan, inp, rows, fetch, guides, pics); }
    if (plan1 && !plan1.planOk) { await fail(gids, '올린 그림이 도면이 아닌 것 같아요. 도면 사진을 다시 올려 주세요.'); continue; }
    rows.forEach((r) => jobs.push({ r, plan, a: plan1 && plan1.byId[r.id], guide: guides.get(r.id) || null }));
  }

  // ② 두 장씩 동시에 그리기
  const work = async () => {
    for (let j = jobs.shift(); j; j = jobs.shift()) {
      const { r, plan, a, guide } = j;
      const v = RP.viewOf(r.view) || RP.VIEWS[0], ri = RP.cleanInput(r.input);
      if (a && !a.found && !guide) { await fail([r.id], `도면에서 ‘${v.name}’을(를) 찾지 못했어요.`); continue; }   // 밑그림이 있으면 찍은 자리대로 그림
      const prompt = (a && a.found && a.prompt) || RP.fallback(ri, r.view, !!guide);
      try {
        const ov = v.key === 'overview';
        const img = await gemini(prompt, plan, fetch, !!ri.camMark, guide, ov ? null : ri.cam, {
          inp: ri, overview: ov,
          refs: ov ? [] : pics.refs.filter((x) => x.view === r.view).slice(0, 2).map((x) => x.img),   // 그 공간 현재 사진 2장까지
          mats: pics.mats.slice(0, 3),   // 자재 사진 3장까지
        });
        const path = `renders/${pid}/${r.id}.${/png/.test(img.mime) ? 'png' : /webp/.test(img.mime) ? 'webp' : 'jpg'}`;
        await upload(path, img);
        await patch([r.id], { status: 'done', image_path: path, caption: (a && a.caption) || '', prompt: prompt.slice(0, 4000), error: '' });
      } catch (e) {
        await fail([r.id], (e && e.msg) || '그림을 만들지 못했어요. 다시 만들어 주세요.');
      }
    }
  };
  await Promise.all([work(), work()]);
}

export default async (req) => {
  try { await run(req); } catch (e) { console.log('[render] 실패', e && e.name, e && e.code); }
  // 오류가 나도 정상 종료 (Netlify가 다시 돌리면 같은 그림 값을 또 냄)
};
