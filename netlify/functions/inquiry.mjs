// 상담 신청 접수 → Supabase에 저장만 (문자 알림·외부 발송 없음 — 2026-10-25 대표님 결정)
//   새 신청은 관리화면 첫 화면 알림과 '상담 신청' 목록(빨간 숫자)으로 확인합니다.
//   손님 정보를 다른 업체(문자 발송 업체 등)로 보내지 않으므로 개인정보 처리방침의 위탁 업체도 Netlify·Supabase 뿐입니다.
//   나중에 문자·알림톡을 다시 붙이면 처리방침 5항(처리 위탁)과 6항(국외 이전)도 같이 고쳐야 합니다.
//
// Netlify > Project configuration > Environment variables 에 넣을 값
//   SUPABASE_URL                Supabase Project URL
//   SUPABASE_SERVICE_KEY        Supabase secret(service_role) 키 — 절대 config.js 같은 공개 파일에 넣지 말 것

const SB_URL = (process.env.SUPABASE_URL || '').replace(/\/$/, '');
const SB_KEY = process.env.SUPABASE_SERVICE_KEY || '';

const PER_PHONE_10MIN = 2;   // 같은 번호로 10분 안에 2건까지만 접수
const MAX_PER_HOUR = 40;     // 한 시간에 전체 40건이 넘으면 잠시 접수를 멈춤 (대량 장난 접수로 저장소가 차는 것 방지)
const MAX_BODY = 16 * 1024;  // 신청서 한 건은 몇 KB면 충분 — 그보다 크면 받지 않음

// 같은 인터넷 주소(IP)에서 1분에 5번 넘게 보내면 Netlify가 이 함수에 닿기 전에 막습니다(429).
// 경로를 정하면 예전 주소(/.netlify/functions/inquiry)로는 부를 수 없고, 화면(data.js)은 /api/inquiry 로 보냅니다.
export const config = {
  path: '/api/inquiry',
  rateLimit: { windowLimit: 5, windowSize: 60, aggregateBy: ['ip', 'domain'] },
};

const json = (status, body) => new Response(JSON.stringify(body), {
  status, headers: { 'content-type': 'application/json; charset=utf-8', 'cache-control': 'no-store' },
});

// 기록(로그)에는 손님 정보가 남지 않도록 오류 종류만 적습니다.
async function errInfo(res) {
  const d = await res.json().catch(() => ({}));
  return `${res.status} ${d.code || ''}`.trim();
}

function sbHeaders(extra = {}) {
  const h = { apikey: SB_KEY, 'content-type': 'application/json', ...extra };
  if (SB_KEY.startsWith('eyJ')) h.authorization = `Bearer ${SB_KEY}`; // 예전 방식 service_role 키(JWT)
  return h;
}

const t = (v, n) => String(v ?? '').replace(/\s+/g, ' ').trim().slice(0, n);

export function cleanInquiry(b) {
  const digits = String(b.phone || '').replace(/[^0-9]/g, '');
  const phone = digits.length === 11 ? digits.replace(/(\d{3})(\d{4})(\d{4})/, '$1-$2-$3')
    : digits.length === 10 ? digits.replace(/(\d{3})(\d{3})(\d{4})/, '$1-$2-$3') : t(b.phone, 20);
  const size = t(String(b.size || '').replace(/[^0-9.]/g, ''), 6);
  return {
    name: t(b.name, 30),
    phone,
    space_type: t(b.space_type, 20),
    build_type: t(b.build_type, 20),
    region: t(b.region, 40),
    site_name: t(b.site_name, 60),
    size: size ? `${size}평` : '',
    scopes: (Array.isArray(b.scopes) ? b.scopes : []).slice(0, 30).map((x) => t(x, 50)).filter(Boolean),
    budget: t(b.budget, 30),
    method: t(b.method, 20),
    preferred_date: validDate(b.preferred_date, 120),
    preferred_time: t(b.preferred_time, 20),
    planned_date: validDate(b.planned_date, 800),
    planned_undecided: !!b.planned_undecided && !validDate(b.planned_date, 800),
    message: String(b.message || '').trim().slice(0, 1000),
  };
}

// 'YYYY-MM-DD' 이고 실제 있는 날짜이며, 이틀 전 ~ maxDays일 뒤 사이일 때만 받음 (그 외는 비움)
function validDate(v, maxDays) {
  const m = /^(\d{4})-(\d{2})-(\d{2})$/.exec(String(v || ''));
  if (!m) return null;
  const ms = Date.UTC(+m[1], +m[2] - 1, +m[3]);
  const back = new Date(ms).toISOString().slice(0, 10);
  if (back !== v) return null;                          // 2월 30일 같은 없는 날짜
  const diff = (ms - Date.now()) / 864e5;
  return diff >= -2 && diff <= maxDays ? v : null;
}

// '2027-03-02' → '2027년 3월 2일(화)', 날짜 없이 미정이면 '미정'
export function fmtPlan(date, undecided) {
  const m = /^(\d{4})-(\d{2})-(\d{2})$/.exec(date || '');
  if (!m) return undecided ? '미정' : '';
  return `${m[1]}년 ${+m[2]}월 ${+m[3]}일(${'일월화수목금토'[new Date(Date.UTC(+m[1], +m[2] - 1, +m[3])).getUTCDay()]})`;
}

// '2026-10-28' + '오전 9~12시' → '10월 28일(수) 오전 9~12시'
export function fmtPref(date, time) {
  const m = /^(\d{4})-(\d{2})-(\d{2})$/.exec(date || '');
  const d = m ? `${+m[2]}월 ${+m[3]}일(${'일월화수목금토'[new Date(Date.UTC(+m[1], +m[2] - 1, +m[3])).getUTCDay()]})` : '';
  return [d, time].filter(Boolean).join(' ');
}

// 관리화면에서 '상담 신청 버튼 보이기'를 끈 상태면 접수하지 않음 (설정 표가 없거나 읽기 실패면 받음)
async function inquiryEnabled() {
  const res = await fetch(`${SB_URL}/rest/v1/site_settings?select=value&key=eq.inquiry_enabled`, { headers: sbHeaders() });
  if (!res.ok) return true;
  const rows = await res.json().catch(() => []);
  return !(rows[0] && rows[0].value === false);
}

async function countSince(filter, minutes) {
  const since = new Date(Date.now() - minutes * 60e3).toISOString();
  const res = await fetch(`${SB_URL}/rest/v1/inquiries?select=id&limit=1&created_at=gte.${encodeURIComponent(since)}${filter}`, {
    headers: sbHeaders({ prefer: 'count=exact' }),
  });
  const range = res.headers.get('content-range') || '';   // 예: 0-0/3 또는 */0
  return Number(range.split('/')[1] || 0);
}

export default async (req, context) => {
  if (req.method !== 'POST') return json(405, { ok: false, error: '잘못된 요청입니다.' });
  // 다른 사이트에 몰래 심은 코드가 방문자 브라우저로 신청을 보내는 것 막기
  // (브라우저는 다른 사이트에서 보낸 요청에 sec-fetch-site: cross-site 를 붙이고, JSON 요청은 사전 확인을 거칩니다)
  if ((req.headers.get('sec-fetch-site') || '') === 'cross-site') return json(403, { ok: false, error: '잘못된 요청입니다.' });
  if (!/^application\/json\b/i.test(req.headers.get('content-type') || '')) return json(415, { ok: false, error: '잘못된 요청입니다.' });
  if (!SB_URL || !SB_KEY) return json(500, { ok: false, error: '상담 접수 설정이 아직 끝나지 않았어요.' });

  let body;
  try {
    const raw = await req.text();
    if (raw.length > MAX_BODY) return json(413, { ok: false, error: '신청 내용이 너무 길어요.' });
    body = JSON.parse(raw);
  } catch { return json(400, { ok: false, error: '잘못된 요청입니다.' }); }
  if (!body || typeof body !== 'object' || Array.isArray(body)) return json(400, { ok: false, error: '잘못된 요청입니다.' });

  // 자동 등록 프로그램 거르기: 숨은 칸이 채워졌거나 3초 안에 제출되면 접수한 척만 함
  if (body.company_website || !(Number(body.elapsed) >= 3000)) return json(200, { ok: true });

  const rec = cleanInquiry(body);
  const digits = rec.phone.replace(/[^0-9]/g, '');
  if (!rec.name) return json(400, { ok: false, error: '이름을 적어 주세요.' });
  if (!/^0\d{8,10}$/.test(digits)) return json(400, { ok: false, error: '연락처를 다시 확인해 주세요.' });
  if (!rec.space_type || !rec.method) return json(400, { ok: false, error: '공간과 상담 방법을 골라 주세요.' });

  try {
    if (!(await inquiryEnabled())) {
      return json(403, { ok: false, error: '지금은 홈페이지 상담 신청을 받지 않고 있어요.' });
    }
    if (await countSince(`&phone=eq.${encodeURIComponent(rec.phone)}`, 10) >= PER_PHONE_10MIN) {
      return json(429, { ok: false, error: '조금 전에 이미 접수되었어요. 잠시 후 다시 시도해 주세요.' });
    }
    const recent = await countSince('', 60);
    if (recent >= MAX_PER_HOUR) {
      console.log('[inquiry] 시간당 접수 한도 초과 — 잠시 접수 중지', recent);
      return json(429, { ok: false, error: '지금은 신청이 몰려 잠시 접수가 어려워요. 조금 뒤에 다시 보내거나 전화로 연락 주세요.' });
    }

    // 저장한 뒤 돌려받는 값은 id 하나만 (손님 정보를 다시 주고받지 않도록)
    const ins = await fetch(`${SB_URL}/rest/v1/inquiries?select=id`, {
      method: 'POST', headers: sbHeaders({ prefer: 'return=representation' }), body: JSON.stringify(rec),
    });
    if (!ins.ok) {
      console.log('[inquiry] 저장 실패', await errInfo(ins));
      return json(500, { ok: false, error: '접수하지 못했어요. 잠시 후 다시 시도해 주세요.' });
    }
    await ins.json().catch(() => null);
    return json(200, { ok: true });
  } catch (e) {
    console.log('[inquiry] 오류', e && e.message);
    return json(500, { ok: false, error: '접수하지 못했어요. 잠시 후 다시 시도해 주세요.' });
  }
};
