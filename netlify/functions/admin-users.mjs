// 관리자 추가·삭제 (관리화면 '설정 → 관리자')
//  · 관리자 명단(admins 표)과 로그인 계정(Supabase Auth)을 함께 만들고 지웁니다.
//  · 로그인한 관리자만 쓸 수 있고, 자기 자신이나 마지막 관리자는 지울 수 없습니다.
//
// Netlify 환경변수 (상담 신청 함수와 같은 값)
//   SUPABASE_URL, SUPABASE_SERVICE_KEY (secret 키 — 계정을 만들고 지우는 데 필요, 절대 공개 파일에 넣지 말 것)
//   SUPABASE_KEY (선택) anon/publishable 키 — 로그인 확인에 씀. 없으면 SUPABASE_SERVICE_KEY 로 확인

const SB_URL = (process.env.SUPABASE_URL || '').replace(/\/$/, '');
const SB_KEY = process.env.SUPABASE_SERVICE_KEY || '';
const SB_ANON = process.env.SUPABASE_KEY || '';
const PW_MIN = 10;          // 관리화면 '비밀번호 바꾸기'와 같은 최소 길이
const MAX_ADMINS = 10;
const MAX_BODY = 4 * 1024;

export const config = {
  path: '/api/admin-users',
  method: ['POST'],
  rateLimit: { windowLimit: 20, windowSize: 60, aggregateBy: ['ip', 'domain'] },
};

const json = (status, body) => new Response(JSON.stringify(body), {
  status, headers: { 'content-type': 'application/json; charset=utf-8', 'cache-control': 'no-store' },
});
// 데이터베이스(REST): 예전 JWT 키면 Authorization 도, 새 secret 키는 apikey 만
function rest(extra = {}) {
  const h = { apikey: SB_KEY, 'content-type': 'application/json', ...extra };
  if (SB_KEY.startsWith('eyJ')) h.authorization = `Bearer ${SB_KEY}`;
  return h;
}
// 계정 관리(Auth admin): supabase-js 서버 클라이언트와 같은 방식으로 두 헤더 모두 보냄
const authAdmin = () => ({ apikey: SB_KEY, authorization: `Bearer ${SB_KEY}`, 'content-type': 'application/json' });
const low = (e) => String(e || '').trim().toLowerCase();
export const validEmail = (e) => /^[^\s@<>()",;:]+@[^\s@<>()",;:]+\.[a-z]{2,}$/i.test(String(e || '')) && String(e).length <= 120;

async function callerEmail(token) {
  const res = await fetch(`${SB_URL}/auth/v1/user`, { headers: { apikey: SB_ANON || SB_KEY, authorization: `Bearer ${token}` } });
  if (!res.ok) return '';
  const u = await res.json().catch(() => null);
  return low(u && u.email);
}
async function listAdmins() {
  const res = await fetch(`${SB_URL}/rest/v1/admins?select=email`, { headers: rest() });
  if (!res.ok) throw new Error('admins ' + res.status);
  return (await res.json()).map((r) => r.email);
}
async function listUsers() {
  const res = await fetch(`${SB_URL}/auth/v1/admin/users?page=1&per_page=1000`, { headers: authAdmin() });
  if (!res.ok) throw new Error('users ' + res.status);
  const d = await res.json().catch(() => ({}));
  return Array.isArray(d.users) ? d.users : Array.isArray(d) ? d : [];
}

export default async (req) => {
  if (req.method !== 'POST') return json(405, { ok: false, error: '잘못된 요청입니다.' });
  if ((req.headers.get('sec-fetch-site') || '') === 'cross-site') return json(403, { ok: false, error: '잘못된 요청입니다.' });
  if (!/^application\/json\b/i.test(req.headers.get('content-type') || '')) return json(415, { ok: false, error: '잘못된 요청입니다.' });
  if (!SB_URL || !SB_KEY) return json(500, { ok: false, code: 'no_config', error: '서버 설정이 아직 끝나지 않았어요. 앤에게 알려 주세요.' });
  const token = (req.headers.get('authorization') || '').replace(/^Bearer\s+/i, '');
  if (!token) return json(401, { ok: false, error: '로그인이 풀렸어요. 다시 로그인해 주세요.' });
  let body;
  try {
    const raw = await req.text();
    if (raw.length > MAX_BODY) return json(413, { ok: false, error: '요청이 너무 길어요.' });
    body = JSON.parse(raw);
  } catch { return json(400, { ok: false, error: '잘못된 요청입니다.' }); }
  const action = String((body && body.action) || '');

  try {
    const me = await callerEmail(token);
    const admins = await listAdmins();
    if (!me || !admins.some((a) => low(a) === me)) return json(403, { ok: false, error: '관리자만 쓸 수 있어요. 다시 로그인해 주세요.' });

    if (action === 'list') {
      let users = [], usersOk = true;
      try { users = await listUsers(); } catch { usersOk = false; }
      const byEmail = new Map(users.map((u) => [low(u.email), u]));
      return json(200, { ok: true, usersOk, admins: admins.map((e) => {
        const u = byEmail.get(low(e));
        return { email: e, me: low(e) === me, account: usersOk ? !!u : null, last_sign_in_at: (u && u.last_sign_in_at) || null };
      }) });
    }

    if (action === 'add') {
      const email = low(body.email);
      const password = String(body.password || '');
      if (!validEmail(email)) return json(400, { ok: false, error: '이메일 주소를 다시 확인해 주세요.' });
      if (admins.some((a) => low(a) === email)) return json(409, { ok: false, error: '이미 관리자로 등록된 이메일이에요.' });
      if (admins.length >= MAX_ADMINS) return json(400, { ok: false, error: `관리자는 ${MAX_ADMINS}명까지 둘 수 있어요.` });
      // 1) 로그인 계정 만들기 (이미 있으면 그 계정을 그대로 씀 — 비밀번호는 바꾸지 않음)
      let created = false;
      const users = await listUsers();
      if (!users.some((u) => low(u.email) === email)) {
        if (password.length < PW_MIN) return json(400, { ok: false, error: `처음 비밀번호는 ${PW_MIN}자 이상으로 정해 주세요.` });
        const cr = await fetch(`${SB_URL}/auth/v1/admin/users`, {
          method: 'POST', headers: authAdmin(),
          body: JSON.stringify({ email, password, email_confirm: true }),
        });
        if (!cr.ok) {
          const d = await cr.json().catch(() => ({}));
          const code = d.error_code || d.code || '';
          console.log('[admin-users] 계정 만들기 실패', cr.status, code);   // 이메일·비밀번호는 기록하지 않음
          if (code === 'weak_password' || /weak|pwned|leaked/i.test(JSON.stringify(d))) return json(400, { ok: false, error: '비밀번호가 너무 쉽거나 유출된 적이 있어요. 다른 비밀번호로 정해 주세요.' });
          return json(502, { ok: false, error: '로그인 계정을 만들지 못했어요. 잠시 후 다시 눌러 주세요.' });
        }
        created = true;
      }
      // 2) 관리자 명단에 넣기
      const ins = await fetch(`${SB_URL}/rest/v1/admins`, {
        method: 'POST', headers: rest({ prefer: 'resolution=ignore-duplicates,return=minimal' }), body: JSON.stringify({ email }),
      });
      if (!ins.ok) { console.log('[admin-users] 명단 추가 실패', ins.status); return json(502, { ok: false, error: '관리자 명단에 넣지 못했어요. 잠시 후 다시 눌러 주세요.' }); }
      return json(200, { ok: true, created });
    }

    if (action === 'remove') {
      const email = low(body.email);
      const stored = admins.find((a) => low(a) === email);
      if (!stored) return json(404, { ok: false, error: '관리자 명단에 없는 이메일이에요.' });
      if (email === me) return json(400, { ok: false, error: '자기 자신은 지울 수 없어요. 다른 관리자에게 부탁해 주세요.' });
      if (admins.length <= 1) return json(400, { ok: false, error: '마지막 관리자는 지울 수 없어요.' });
      const del = await fetch(`${SB_URL}/rest/v1/admins?email=eq.${encodeURIComponent(stored)}`, { method: 'DELETE', headers: rest({ prefer: 'return=minimal' }) });
      if (!del.ok) { console.log('[admin-users] 명단 삭제 실패', del.status); return json(502, { ok: false, error: '관리자 명단에서 빼지 못했어요.' }); }
      // 로그인 계정도 지움 (명단에서 빠지면 이미 아무것도 볼 수 없지만, 로그인 자체도 못 하게)
      let accountRemoved = false;
      try {
        const u = (await listUsers()).find((x) => low(x.email) === email);
        if (u) {
          const r = await fetch(`${SB_URL}/auth/v1/admin/users/${encodeURIComponent(u.id)}`, { method: 'DELETE', headers: authAdmin() });
          accountRemoved = r.ok;
          if (!r.ok) console.log('[admin-users] 계정 삭제 실패', r.status);
        }
      } catch (e) { console.log('[admin-users] 계정 삭제 실패', e && e.message); }
      return json(200, { ok: true, accountRemoved });
    }
    return json(400, { ok: false, error: '잘못된 요청입니다.' });
  } catch (e) {
    console.log('[admin-users] 실패', e && e.message);
    return json(500, { ok: false, error: '처리하지 못했어요. 잠시 후 다시 눌러 주세요.' });
  }
};
