// 구글 캘린더 구독 주소 — 관리화면 '일정 달력'의 일정을 구글 캘린더(또는 아이폰·삼성 캘린더)가 읽어 가는 .ics 주소
//   주소: https://(홈페이지)/api/calendar.ics?key=(비밀 열쇠)
//   비밀 열쇠는 관리화면 '설정 → 구글 캘린더에 일정 보이기'에서 만들고(admin_settings 의 calendar_feed), 거기서 새 열쇠로 바꾸면 예전 주소는 바로 안 됩니다.
//   한 방향입니다: 관리화면 → 구글 캘린더. 구글 캘린더에서 고친 내용은 관리화면으로 오지 않습니다.
//   구글 캘린더는 이 주소를 몇 시간에 한 번씩만 다시 읽습니다(실시간 아님).
//
// 개인정보: 주소만 알면 누구나 볼 수 있습니다. 손님 이름은 그대로 나가고(대표님 요청 — 이름 가리기는 홈페이지 고객 후기에서만),
//           전화번호·주소·메모는 넣지 않습니다. 주소가 새면 관리화면에서 '새 주소로 바꾸기'.
//
// Netlify 환경변수: SUPABASE_URL, SUPABASE_SERVICE_KEY (상담 신청 함수와 같은 값). URL 은 Netlify 가 자동으로 넣어 줌.
import crypto from 'node:crypto';

const SB_URL = (process.env.SUPABASE_URL || '').replace(/\/$/, '');
const SB_KEY = process.env.SUPABASE_SERVICE_KEY || '';
const SITE = (process.env.URL || 'https://www.medesign.co.kr').replace(/\/$/, '');
const PAST_DAYS = 90, FUTURE_DAYS = 400, MAX_SPAN = 120;

export const config = {
  path: '/api/calendar.ics',
  method: ['GET', 'HEAD'],
  rateLimit: { windowLimit: 30, windowSize: 60, aggregateBy: ['ip', 'domain'] },
};

const notFound = () => new Response('not found', { status: 404, headers: { 'content-type': 'text/plain; charset=utf-8', 'cache-control': 'no-store' } });
function sbHeaders() {
  const h = { apikey: SB_KEY };
  if (SB_KEY.startsWith('eyJ')) h.authorization = `Bearer ${SB_KEY}`;
  return h;
}
async function rows(path) {
  const r = await fetch(`${SB_URL}/rest/v1/${path}`, { headers: sbHeaders() });
  if (!r.ok) throw new Error(`supabase ${r.status} ${path.split('?')[0]}`);
  return r.json();
}
async function rowsSoft(path) { try { return await rows(path); } catch (e) { console.log('[calendar-feed]', e.message); return []; } }

/* ---------- 도움 함수 ---------- */
// 손님 이름 (가리지 않음 — '고객님'만 떼어 냄)
export function custName(n) { return String(n || '').replace(/\s*고객님$/, '').trim(); }
const isDay = (d) => /^\d{4}-\d{2}-\d{2}$/.test(String(d || ''));
function addDays(iso, n) { const d = new Date(iso + 'T00:00:00Z'); d.setUTCDate(d.getUTCDate() + n); return d.toISOString().slice(0, 10); }
function kstToday() { return new Date(Date.now() + 9 * 3600e3).toISOString().slice(0, 10); }
// iCalendar 글자 다루기 (RFC 5545 3.3.11): \ ; , 줄바꿈
export function icsText(s) { return String(s == null ? '' : s).replace(/\\/g, '\\\\').replace(/;/g, '\\;').replace(/,/g, '\\,').replace(/\r?\n/g, '\\n'); }
// 한 줄 75바이트 넘으면 접기 (한글이 깨지지 않게 글자 단위로)
export function fold(line) {
  const out = []; let cur = '', bytes = 0, limit = 75;
  for (const ch of line) {
    const b = Buffer.byteLength(ch);
    if (bytes + b > limit) { out.push(cur); cur = ' ' + ch; bytes = 1 + b; limit = 75; }
    else { cur += ch; bytes += b; }
  }
  out.push(cur);
  return out.join('\r\n');
}
const ymd = (iso) => iso.replace(/-/g, '');

/* ---------- 일정 모으기 (관리화면 일정 달력과 같은 규칙) ---------- */
export function collect(D, today) {
  const from = addDays(today, -PAST_DAYS), to = addDays(today, FUTURE_DAYS);
  const cust = {}; (D.customers || []).forEach((c) => { cust[c.id] = c; });
  const ev = [];
  function add(uid, start, end, title, desc) {
    if (!isDay(start)) return;
    let e = isDay(end) && end >= start ? end : start;
    if (addDays(start, MAX_SPAN) < e) e = addDays(start, MAX_SPAN);
    if (e < from || start > to) return;
    ev.push({ uid, start, end: e, title, desc });
  }
  const t = (time, s) => (time ? String(time).trim() + ' ' : '') + s;
  (D.schedules || []).forEach((s) => {
    const c = s.customer_id && cust[s.customer_id];
    add('schedule-' + s.id, s.start_on, s.end_on, t(s.time, s.title + (c && c.name ? ' · ' + custName(c.name) : '')), '직접 적은 일정');
  });
  (D.contracts || []).forEach((k) => {
    if (!isDay(k.start_date) || k.status === 'canceled' || k.status === 'terminated') return;
    const who = custName(k.customer_name) || '고객', note = k.status === 'draft' ? ' (계약 전)' : '';
    const phases = (Array.isArray(k.phases) ? k.phases : []).filter((h) => h && h.name && isDay(h.from));
    if (phases.length) phases.forEach((h, i) => add('phase-' + k.id + '-' + i, h.from, h.to, String(h.name) + ' · ' + who + note, [k.title, '세부 공사일정'].filter(Boolean).join(' · ')));
    else add('contract-' + k.id, k.start_date, k.end_date, '공사 · ' + who + note, k.title || '');
  });
  (D.defects || []).forEach((d) => {
    const c = cust[d.customer_id], who = c ? custName(c.name) : '';
    const done = d.status === 'done' ? ' (완료)' : '';
    add('defect-check-' + d.id, d.check_on, null, t(d.check_time, '하자 현장 확인' + (who ? ' · ' + who : '') + done), d.title || '');
    // 하자 보수: 시작일 ~ 끝나는 날
    add('defect-repair-' + d.id, d.repair_on, d.repair_end || null, t(d.repair_time, '하자 보수' + (who ? ' · ' + who : '') + done), d.title || '');
  });
  (D.inquiries || []).forEach((q) => {
    if (q.status === 'dropped') return;   // 상담 포기한 신청은 빼기
    add('inquiry-' + q.id, q.preferred_date, null, t(q.preferred_time, '상담 희망 · ' + (custName(q.name) || '손님') + (q.method ? ' (' + q.method + ')' : '')), '');
  });
  ev.sort((a, b) => a.start.localeCompare(b.start));
  return ev;
}

export function toIcs(events, opt = {}) {
  const stamp = new Date().toISOString().replace(/[-:]/g, '').replace(/\.\d+Z$/, 'Z');
  const L = ['BEGIN:VCALENDAR', 'VERSION:2.0', 'PRODID:-//medesign.co.kr//admin calendar//KO', 'CALSCALE:GREGORIAN', 'METHOD:PUBLISH',
    'X-WR-CALNAME:' + icsText(opt.name || '미디자인 일정'), 'X-WR-TIMEZONE:Asia/Seoul',
    'REFRESH-INTERVAL;VALUE=DURATION:PT1H', 'X-PUBLISHED-TTL:PT1H'];   // 다시 읽는 간격 안내(구글은 이 값을 따르지 않을 수 있음)
  const link = opt.link || '';
  events.forEach((e) => {
    L.push('BEGIN:VEVENT', 'UID:' + e.uid + '@medesign.co.kr', 'DTSTAMP:' + stamp,
      'DTSTART;VALUE=DATE:' + ymd(e.start), 'DTEND;VALUE=DATE:' + ymd(addDays(e.end, 1)),   // 하루 종일 일정: 끝나는 날은 다음 날로 적음
      'SUMMARY:' + icsText(e.title), 'DESCRIPTION:' + icsText([e.desc, link ? '고칠 때는 관리화면에서: ' + link : ''].filter(Boolean).join('\n')),
      'TRANSP:TRANSPARENT', 'END:VEVENT');
  });
  L.push('END:VCALENDAR');
  return L.map(fold).join('\r\n') + '\r\n';
}

function sameKey(a, b) {
  const x = Buffer.from(String(a)), y = Buffer.from(String(b));
  return x.length === y.length && crypto.timingSafeEqual(x, y);
}

export default async (req) => {
  if (!SB_URL || !SB_KEY) return new Response('server not configured', { status: 500 });
  const key = new URL(req.url).searchParams.get('key') || '';
  if (!/^[A-Za-z0-9_-]{32,128}$/.test(key)) return notFound();
  try {
    const set = await rows('admin_settings?select=value&key=eq.calendar_feed');
    const token = set && set[0] && set[0].value && set[0].value.token;
    if (!token || !sameKey(token, key)) return notFound();
    const [schedules, contracts, defects, inquiries, customers] = await Promise.all([
      rowsSoft('schedules?select=id,title,start_on,end_on,time,customer_id'),
      rowsSoft('contracts?select=id,title,customer_name,start_date,end_date,status,phases:doc->phases'),
      // repair_end 칸은 최신 schema.sql 을 실행해야 생김 — 없으면 그 칸 없이
      rows('defects?select=id,title,customer_id,check_on,check_time,repair_on,repair_end,repair_time,status').catch(() => rowsSoft('defects?select=id,title,customer_id,check_on,check_time,repair_on,repair_time,status')),
      rowsSoft('inquiries?select=id,name,preferred_date,preferred_time,method,status'),
      rowsSoft('customers?select=id,name'),
    ]);
    const body = toIcs(collect({ schedules, contracts, defects, inquiries, customers }, kstToday()), { link: SITE + '/admin/#/calendar' });
    return new Response(req.method === 'HEAD' ? null : body, {
      status: 200,
      headers: { 'content-type': 'text/calendar; charset=utf-8', 'content-disposition': 'inline; filename="medesign.ics"', 'cache-control': 'private, max-age=300', 'x-robots-tag': 'noindex' },
    });
  } catch (e) {
    console.log('[calendar-feed] 실패', e && e.message);
    return new Response('error', { status: 500, headers: { 'cache-control': 'no-store' } });
  }
};
