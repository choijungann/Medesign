// Supabase 무료 플랜은 7일 동안 데이터베이스 사용이 거의 없으면 프로젝트를 일시정지합니다.
// 방문자가 적은 기간에도 멈추지 않도록, 하루 한 번 시공사례 1건을 조회합니다.
// Netlify > Project configuration > Environment variables 에 SUPABASE_URL, SUPABASE_KEY 를 넣어 주세요.

export default async () => {
  const url = (process.env.SUPABASE_URL || '').replace(/\/$/, '');
  const key = process.env.SUPABASE_KEY || '';
  if (!url || !key) {
    console.log('[keepalive] SUPABASE_URL / SUPABASE_KEY 환경변수가 비어 있습니다.');
    return;
  }
  const headers = { apikey: key };
  if (key.startsWith('eyJ')) headers.Authorization = `Bearer ${key}`; // 예전 방식 anon 키(JWT)일 때
  try {
    const res = await fetch(`${url}/rest/v1/works?select=id&limit=1`, { headers });
    console.log('[keepalive]', res.status, new Date().toISOString());
  } catch (e) {
    console.log('[keepalive] 실패:', e.message);
  }
};

// 매일 03:17 UTC (한국 시간 12:17)
export const config = { schedule: '17 3 * * *' };
