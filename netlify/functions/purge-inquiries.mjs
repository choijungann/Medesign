// ★ 휴지통(관리화면에서 지운 자료) 중 30일 지난 것은 매일 완전히 지웁니다(아래 sweepTrash, AUTO_PURGE 와 상관없음).
// ★ 지금은 꺼져 있습니다: 보관 기간이 지난 자료는 자동으로 지우지 않고, 관리화면 '설정 → 보관 기간 지난 자료'에
//   모아 보여 준 뒤 부모님이 확인해서 지웁니다(관리화면 첫 화면에 알림). 다시 자동으로 지우려면
//   Netlify 환경변수 AUTO_PURGE 에 on 을 넣고 다시 배포하세요.
//
// (AUTO_PURGE=on 일 때) 보관 기간이 지난 개인정보를 매일 한 번 자동으로 지웁니다 (개인정보 처리방침 '보유·이용 기간'을 지키기 위해).
//  · 상담 완료한 상담 신청: '상담 완료'를 누른 날부터 INQUIRY_KEEP_DAYS 일 뒤
//  · 상담 완료를 누르지 않은 상담 신청: 접수한 날부터 INQUIRY_KEEP_DAYS 일 뒤
//  · 견적서: 마지막으로 고친 날부터 INQUIRY_KEEP_DAYS 일 뒤
//  · 계약서·하자 기록: 공사 완료일(없으면 마지막으로 고친 날)부터 CONTRACT_KEEP_DAYS 일 뒤
//  · 직접 적은 일정: 끝난 날부터 SCHEDULE_KEEP_DAYS 일 뒤
//  · 고객: 견적서·계약서·하자 기록·일정이 하나도 남지 않고 INQUIRY_KEEP_DAYS 일 동안 고친 적 없으면
//  · 하자 사진: 하자 기록이 지워져 주인이 없어진 사진 파일 (비공개 저장소 private-photos)
//  · 계약서 첨부 파일: 계약서가 지워져 주인이 없어진 파일 (비공개 저장소 private-files 의 contracts/(계약서 id)/…)
//  · 3D 그림 작업: 마지막으로 고친 날부터 INQUIRY_KEEP_DAYS 일 뒤 (견적서와 같은 기간)
//  · 3D 그림·도면 파일: 3D 그림 작업이 지워져 주인이 없어진 파일 (비공개 저장소 private-photos 의 renders/(작업 id)/…)
// 실제 지우기는 Supabase 함수 purge_old_* (supabase/schema.sql) 가 하고, 최소 기간(30일·1년)은 항상 남깁니다.
//
// Netlify 환경변수 (inquiry 함수와 같은 값을 그대로 씁니다)
//   SUPABASE_URL, SUPABASE_SERVICE_KEY
//   INQUIRY_KEEP_DAYS    (선택) 상담 신청·견적서·고객 보관 일수. 비우면 365일 — 처리방침의 '상담 종료 후 1년'과 맞춤.
//   CONTRACT_KEEP_DAYS   (선택) 계약서·하자 기록 보관 일수. 비우면 2190일(6년).
//   SCHEDULE_KEEP_DAYS   (선택) 직접 적은 일정 보관 일수. 비우면 730일(2년).
//   ★ 처리방침(make_pages.py 의 보유 기간 표)을 바꾸면 이 값도 같이 바꾸세요.

const days = (name, def) => parseInt(process.env[name] || String(def), 10) || def;

// 고객은 맨 마지막에 (견적서·계약서가 먼저 지워져야 '남은 기록 없는 고객'이 됨)
const JOBS = () => [
  ['purge_old_inquiries', '상담 신청', days('INQUIRY_KEEP_DAYS', 365)],
  ['purge_old_estimates', '견적서', days('INQUIRY_KEEP_DAYS', 365)],
  ['purge_old_render_projects', '3D 그림', days('INQUIRY_KEEP_DAYS', 365)],
  ['purge_old_contracts', '계약서', days('CONTRACT_KEEP_DAYS', 2190)],
  ['purge_old_defects', '하자 기록', days('CONTRACT_KEEP_DAYS', 2190)],
  ['purge_old_schedules', '일정', days('SCHEDULE_KEEP_DAYS', 730)],
  ['purge_old_customers', '고객', days('INQUIRY_KEEP_DAYS', 365)],
];

// 휴지통: 지운 지 30일 지난 것은 AUTO_PURGE 와 상관없이 매일 완전히 지움 (사진·첨부 파일 포함)
const TRASH_DAYS = 30;
export async function sweepTrash(url, headers) {
  const cut = new Date(Date.now() - TRASH_DAYS * 864e5).toISOString();
  const r = await fetch(`${url}/rest/v1/trash?select=id,files&deleted_at=lt.${encodeURIComponent(cut)}`, { headers });
  if (!r.ok) throw new Error('trash ' + r.status);
  const rows = await r.json();
  if (!rows.length) return 0;
  const byBucket = {};
  rows.forEach((t) => (t.files || []).forEach((f) => { if (f && f.bucket && f.path) (byBucket[f.bucket] = byBucket[f.bucket] || []).push(f.path); }));
  for (const [bucket, paths] of Object.entries(byBucket)) {
    for (let i = 0; i < paths.length; i += 500) {
      await fetch(`${url}/storage/v1/object/${bucket}`, { method: 'DELETE', headers, body: JSON.stringify({ prefixes: paths.slice(i, i + 500) }) }).catch(() => null);
    }
  }
  const ids = rows.map((t) => t.id);
  for (let i = 0; i < ids.length; i += 200) {
    await fetch(`${url}/rest/v1/trash?id=in.(${ids.slice(i, i + 200).join(',')})`, { method: 'DELETE', headers });
  }
  return rows.length;
}

export default async () => {
  {
    const url = (process.env.SUPABASE_URL || '').replace(/\/$/, '');
    const key = process.env.SUPABASE_SERVICE_KEY || '';
    if (url && key) {
      const h = { apikey: key, 'content-type': 'application/json' };
      if (key.startsWith('eyJ')) h.authorization = `Bearer ${key}`;
      try { console.log('[purge] 휴지통 30일 지난 것', await sweepTrash(url, h), '건 완전히 삭제'); }
      catch (e) { console.log('[purge] 휴지통 정리 실패:', e && e.message); }
    }
  }
  if ((process.env.AUTO_PURGE || '').toLowerCase() !== 'on') {
    console.log('[purge] 자동 삭제 꺼짐 (AUTO_PURGE 가 on 이 아님) — 관리화면에서 확인 후 지웁니다.');
    return;
  }
  const url = (process.env.SUPABASE_URL || '').replace(/\/$/, '');
  const key = process.env.SUPABASE_SERVICE_KEY || '';
  if (!url || !key) {
    console.log('[purge] SUPABASE_URL / SUPABASE_SERVICE_KEY 환경변수가 비어 있어 건너뜁니다.');
    return;
  }
  const headers = { apikey: key, 'content-type': 'application/json' };
  if (key.startsWith('eyJ')) headers.authorization = `Bearer ${key}`; // 예전 방식 service_role 키(JWT)
  for (const [fn, label, keep] of JOBS()) {
    try {
      const res = await fetch(`${url}/rest/v1/rpc/${fn}`, {
        method: 'POST', headers, body: JSON.stringify({ keep_days: keep }),
      });
      const out = await res.json().catch(() => null);
      if (!res.ok) {
        // 예: schema.sql 을 새로 실행하지 않아 함수가 없을 때 (404). 손님 정보는 기록하지 않습니다.
        console.log('[purge]', label, '실패', res.status, (out && out.code) || '');
        continue;
      }
      console.log('[purge] 보관 기간', keep, '일 지난', label, Number(out) || 0, '건 삭제');
    } catch (e) {
      console.log('[purge]', label, '실패:', e && e.message);
    }
  }
  // 지워진 하자 기록의 사진(비공개 저장소 private-photos 의 defects/(하자 id)/…)도 정리
  try { console.log('[purge] 주인 없는 하자 사진', await sweepDefectPhotos(url, headers), '개 삭제'); }
  catch (e) { console.log('[purge] 하자 사진 정리 실패:', e && e.message); }
  try { console.log('[purge] 주인 없는 계약서 첨부 파일', await sweepContractFiles(url, headers), '개 삭제'); }
  catch (e) { console.log('[purge] 계약서 첨부 파일 정리 실패:', e && e.message); }
  try { console.log('[purge] 주인 없는 3D 그림·도면', await sweepRenderFiles(url, headers), '개 삭제'); }
  catch (e) { console.log('[purge] 3D 그림 정리 실패:', e && e.message); }
};

const PRIV = 'private-photos';
const FILES = 'private-files';
async function listFolder(url, headers, prefix, bucket = PRIV) {
  const out = [];
  for (let offset = 0; offset < 20000; offset += 1000) {
    const r = await fetch(`${url}/storage/v1/object/list/${bucket}`, { method: 'POST', headers, body: JSON.stringify({ prefix, limit: 1000, offset }) });
    if (!r.ok) throw new Error('list ' + r.status);
    const page = await r.json();
    out.push(...page);
    if (page.length < 1000) break;
  }
  return out;
}
// 휴지통에 있는 자료의 사진·파일은 30일 동안 남겨 둠 (주인 없는 파일로 보고 지우지 않게)
async function trashPaths(url, headers) {
  const r = await fetch(`${url}/rest/v1/trash?select=files`, { headers });
  if (!r.ok) return new Set();
  const keep = new Set();
  (await r.json()).forEach((t) => (t.files || []).forEach((f) => { if (f && f.path) keep.add(f.path); }));
  return keep;
}
export async function sweepDefectPhotos(url, headers) {
  const ids = new Set(), keep = await trashPaths(url, headers);
  const dr = await fetch(`${url}/rest/v1/defects?select=id`, { headers });
  if (!dr.ok) throw new Error('defects ' + dr.status);
  (await dr.json()).forEach((d) => ids.add(d.id));
  const folders = (await listFolder(url, headers, 'defects')).filter((x) => x && x.name && !x.id).map((x) => x.name);   // id 가 없으면 폴더
  let n = 0;
  for (const f of folders) {
    if (ids.has(f)) continue;
    const files = (await listFolder(url, headers, `defects/${f}`)).filter((x) => x && x.id).map((x) => `defects/${f}/${x.name}`).filter((p) => !keep.has(p));
    if (!files.length) continue;
    const r = await fetch(`${url}/storage/v1/object/${PRIV}`, { method: 'DELETE', headers, body: JSON.stringify({ prefixes: files }) });
    if (r.ok) n += files.length;
  }
  return n;
}

// 계약서가 지워졌는데 남은 첨부 파일 (관리화면에서 지우면 같이 지우지만, 자동 삭제·도중 실패에 대비)
export async function sweepContractFiles(url, headers) {
  const ids = new Set(), keep = await trashPaths(url, headers);
  const cr = await fetch(`${url}/rest/v1/contracts?select=id`, { headers });
  if (!cr.ok) throw new Error('contracts ' + cr.status);
  (await cr.json()).forEach((k) => ids.add(k.id));
  const folders = (await listFolder(url, headers, 'contracts', FILES)).filter((x) => x && x.name && !x.id).map((x) => x.name);
  let n = 0;
  for (const f of folders) {
    if (ids.has(f)) continue;
    const files = (await listFolder(url, headers, `contracts/${f}`, FILES)).filter((x) => x && x.id).map((x) => `contracts/${f}/${x.name}`).filter((p) => !keep.has(p));
    if (!files.length) continue;
    const r = await fetch(`${url}/storage/v1/object/${FILES}`, { method: 'DELETE', headers, body: JSON.stringify({ prefixes: files }) });
    if (r.ok) n += files.length;
  }
  return n;
}

// 3D 그림 작업이 지워졌는데 남은 그림·도면 (비공개 저장소 private-photos 의 renders/(작업 id)/…)
//  · 작업을 지우면 그림 줄은 같이 지워지고(데이터베이스 설정), 관리화면에서 지울 때는 파일도 같이 지우지만 자동 삭제·도중 실패에 대비
export async function sweepRenderFiles(url, headers) {
  const ids = new Set(), keep = await trashPaths(url, headers);
  const er = await fetch(`${url}/rest/v1/render_projects?select=id`, { headers });
  if (!er.ok) throw new Error('render_projects ' + er.status);
  (await er.json()).forEach((k) => ids.add(k.id));
  const folders = (await listFolder(url, headers, 'renders')).filter((x) => x && x.name && !x.id).map((x) => x.name);
  let n = 0;
  for (const f of folders) {
    if (ids.has(f)) continue;
    const files = (await listFolder(url, headers, `renders/${f}`)).filter((x) => x && x.id).map((x) => `renders/${f}/${x.name}`).filter((p) => !keep.has(p));
    if (!files.length) continue;
    const r = await fetch(`${url}/storage/v1/object/${PRIV}`, { method: 'DELETE', headers, body: JSON.stringify({ prefixes: files }) });
    if (r.ok) n += files.length;
  }
  return n;
}

// 매일 18:43 UTC (한국 시간 새벽 3:43)
export const config = { schedule: '43 18 * * *' };
