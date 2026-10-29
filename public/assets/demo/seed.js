/* 데모 모드 전용 예시 데이터 — 실제 Supabase 연결 후에는 쓰이지 않습니다.
   사진은 실제 현장 사진이 아닌 '자리표시 그림'입니다. */
(function () {
  function p(n) {
    var k = (n < 10 ? '0' : '') + n;
    return { full: 'demo/sample-' + k + '.jpg', thumb: 'demo/sample-' + k + '_t.jpg', w: 1600, h: 1200 };
  }
  function d(daysAgo) { return new Date(Date.now() - daysAgo * 864e5).toISOString(); }
  function ymd(daysLater) {
    var x = new Date(Date.now() + daysLater * 864e5);
    return x.getFullYear() + '-' + String(x.getMonth() + 1).padStart(2, '0') + '-' + String(x.getDate()).padStart(2, '0');
  }

  window.DEMO_SEED = {
    works: [
      {
        id: 'demo-w1', created_at: d(6), published: true, featured: true,
        title: '햇살이 드는 거실, 32평 아파트 전체 리모델링',
        place: '○○동 ○○아파트', size: '32평', building: '아파트',
        scopes: ['전체 리모델링', '도배', '바닥', '주방', '욕실', '조명'], period: '5주',
        body: '입주 20년 차 아파트를 전체 리모델링했습니다.\n거실 쪽 몰딩과 걸레받이를 얇게 정리하고, 바닥은 밝은 원목 톤 강마루로 바꿔 거실이 한결 넓어 보이도록 했습니다.\n주방은 상부장을 천장까지 올려 수납을 늘렸고, 욕실은 방수부터 새로 했습니다.',
        photos: [p(1), p(5), p(8), p(11), p(13)], blog_url: '',
      },
      {
        id: 'demo-w2', created_at: d(20), published: true, featured: true,
        title: '아이 방까지 새로, 24평 아파트 리모델링',
        place: '○○동 ○○마을', size: '24평', building: '아파트',
        scopes: ['전체 리모델링', '도배', '바닥', '샷시·창호'], period: '4주',
        body: '아이가 초등학교에 들어가기 전에 집 전체를 정리하고 싶다고 하셔서 진행한 현장입니다.\n오래된 샷시를 교체해 겨울 외풍을 잡고, 아이 방은 밝은 벽지와 넉넉한 붙박이장으로 꾸몄습니다.',
        photos: [p(2), p(12), p(14), p(6)], blog_url: '',
      },
      {
        id: 'demo-w3', created_at: d(41), published: true, featured: true,
        title: '어두웠던 주방을 밝게, 주방·거실 부분 시공',
        place: '○○동 ○○아파트', size: '34평', building: '아파트',
        scopes: ['주방', '도배', '조명'], period: '2주',
        body: '살면서 공사를 하셔야 해서 주방과 거실만 2주 안에 마쳤습니다.\n짙은 색 상부장으로 무게를 잡고, 다운라이트를 추가해 저녁에도 어둡지 않게 했습니다.',
        photos: [p(6), p(5), p(3)], blog_url: '',
      },
      {
        id: 'demo-w4', created_at: d(63), published: true, featured: true,
        title: '20년 된 욕실 두 곳 전면 교체',
        place: '○○동 ○○아파트', size: '28평', building: '아파트',
        scopes: ['욕실', '타일'], period: '10일',
        body: '기존 타일을 모두 철거하고 방수층부터 다시 시공했습니다.\n벽은 큰 사이즈 포세린 타일로 줄눈을 줄여 청소가 쉽게 했고, 수납형 세면대를 달았습니다.',
        photos: [p(9), p(8), p(10)], blog_url: '',
      },
      {
        id: 'demo-w5', created_at: d(90), published: true, featured: true,
        title: '단독주택 1층 거실·안방 리모델링',
        place: '○○읍 단독주택', size: '40평', building: '주택·빌라',
        scopes: ['도배', '바닥', '목공', '도장·필름'], period: '3주',
        body: '오래된 단독주택의 1층 공간을 손봤습니다.\n벽체 단열을 보강한 뒤 도장으로 마감했고, 안방은 헤드보드 벽을 따로 만들어 아늑하게 했습니다.',
        photos: [p(4), p(11), p(13)], blog_url: '',
      },
      {
        id: 'demo-w6', created_at: d(120), published: true, featured: true,
        title: '동네 카페 겸 작업실 인테리어',
        place: '○○동 상가 1층', size: '18평', building: '상가·사무실',
        scopes: ['목공', '조명', '바닥', '도장·필름'], period: '3주',
        body: '영업 시작일에 맞춰 일정을 역산해 진행했습니다.\n바 테이블과 수납장은 현장 목공으로 짜 맞췄습니다.',
        photos: [p(7), p(3), p(14)], blog_url: '',
      },
      {
        id: 'demo-w7', created_at: d(150), published: true, featured: false,
        title: '현관과 중문만 바꿔도 달라지는 첫인상',
        place: '○○동 ○○아파트', size: '33평', building: '아파트',
        scopes: ['중문', '타일'], period: '3일',
        body: '현관 바닥 타일과 중문만 교체한 소규모 공사입니다.',
        photos: [p(14), p(13)], blog_url: '',
      },
    ],
    inquiries: [
      {
        id: 'demo-q1', created_at: new Date(Date.now() - 2 * 3600e3).toISOString(), status: 'new', notified: true,
        name: '김○○ (예시)', phone: '010-0000-1234', space_type: '아파트', build_type: '구축',
        region: '서울 송파구', site_name: '○○동 ○○아파트', size: '32평', scopes: ['도배', '욕실', '주방'], budget: '4000만원 정도', planned_date: ymd(95),
        method: '방문 상담', preferred_date: ymd(4), preferred_time: '',
        message: '입주 20년 된 아파트입니다. 내년 2월 전에 공사를 마치고 싶어요.',
      },
      {
        id: 'demo-q2', created_at: d(3), status: 'done', notified: true,
        name: '이○○ (예시)', phone: '010-0000-5678', space_type: '상가·사무실', build_type: '신축',
        region: '경기 남양주시', site_name: '○○동 상가 1층', size: '18평', scopes: ['목공', '조명', '기타: 간판 조명'], budget: '아직 모르겠어요', planned_undecided: true,
        method: '전화 상담', preferred_date: null, preferred_time: '', message: '',
      },
    ],
    // 예시 견적서 — 금액은 화면을 보여 주기 위한 예시일 뿐, 실제 단가가 아닙니다
    estimates: [
      {
        id: 'demo-e1', created_at: d(2), updated_at: d(2), inquiry_id: 'demo-q2', customer_id: 'demo-c1', customer_name: '이○○ (예시)',
        title: '○○동 상가 1층 18평 인테리어 공사 (예시)', total: 5379000,
        doc: {
          no: 'MD-DEMO-01', date: ymd(-2), validDays: 7, title: '○○동 상가 1층 18평 인테리어 공사 (예시)',
          customer: { name: '이○○ (예시)', phone: '010-0000-5678' }, site: { region: '경기 남양주시', name: '○○동 상가 1층', unit: '102호', size: '18' },
          period: '약 2주 (예시)', plannedHint: '미정', staff: 0,
          cats: [
            { key: 'elec', name: '전기·조명', lines: [
              { name: '매입등(다운라이트)', spec: 'LED 3인치', unit: '개', qty: '24', price: '35000', note: '예시 금액' },
              { name: '전기 배선 공사', spec: '', unit: '식', qty: '1', price: '900000', note: '' }] },
            { key: 'carp', name: '목공공사', lines: [
              { name: '가벽 설치', spec: '석고보드 2겹', unit: '식', qty: '1', price: '1800000', note: '예시 금액' },
              { name: '천장 평탄화', spec: '', unit: '평', qty: '18', price: '60000', note: '' }] },
            { key: 'custom-demo', name: '간판 조명', added: 0, lines: [
              { name: '간판 간접조명', spec: 'LED 바', unit: 'm', qty: '6', price: '45000', note: '' }] },
          ],
          overhead: { on: false, rate: '' }, discount: '', round: 'none', vat: 'add',
          payment: '계약금 30% · 중도금 40% · 잔금 30% (예시)',
          notes: '현장 상황(철거 후 드러나는 누수·배관·벽체 상태 등)에 따라 추가 공사가 필요하면 미리 말씀드리고 협의한 뒤 진행합니다.\n견적서에 적히지 않은 공사와 자재는 포함되지 않습니다.',
          confidential: { on: true, text: '이 견적서는 고객님께만 드리는 자료입니다. 외부 유출과 무단 복제를 금합니다.' },
        },
      },
    ],
    // 예시 고객·계약서·하자·일정 (고객 관리 · 계약서 · 일정 달력)
    customers: [
      { id: 'demo-c1', created_at: d(3), updated_at: d(1), name: '이○○ (예시)', phone: '010-0000-5678', phone_digits: '01000005678', address: '경기 남양주시 ○○동 상가 1층, 102호', memo: '오픈 날짜가 정해져 있어 일정 엄수 (예시)' },
      { id: 'demo-c2', created_at: d(130), updated_at: d(2), name: '박○○ (예시)', phone: '010-0000-2468', phone_digits: '01000002468', address: '서울 강동구 ○○아파트 34평, 103동 502호', memo: '' },
      { id: 'demo-c3', created_at: d(20), updated_at: d(4), name: '최○○ (예시)', phone: '010-0000-1357', phone_digits: '01000001357', address: '경기 의정부시 ○○동 ○○아파트 24평, 101동 1001호', memo: '' },
    ],
    contracts: [
      {
        id: 'demo-k1', created_at: d(1), updated_at: d(1), customer_id: 'demo-c1', estimate_id: 'demo-e1', customer_name: '이○○ (예시)',
        title: '○○동 상가 1층 18평 인테리어 공사 (예시)', total: 5379000, start_date: ymd(5), end_date: ymd(18), status: 'draft',
        doc: {
          mode: 'standard', no: 'MC-DEMO-01', date: ymd(-1), title: '○○동 상가 1층 18평 인테리어 공사 (예시)', site: '경기 남양주시 ○○동 상가 1층, 102호',
          customer: { name: '이○○ (예시)', phone: '010-0000-5678', address: '경기 남양주시 ○○동' },
          start: ymd(5), end: ymd(18), amount: '5379000', vat: 'included',
          payments: [{ label: '계약금', pct: 10, amount: '540000', when: '계약할 때' }, { label: '중도금', pct: 40, amount: '2150000', when: '공사 중간 (목공 마친 뒤)' },
            { label: '잔금', pct: 50, amount: '2689000', when: '공사를 마치고 함께 확인한 뒤' }],
          account: '', warranty: { n: 1, unit: '년', note: '방수 공사는 3년' }, lateRate: '연 6%', delayRate: '하루에 총 공사금액의 1,000분의 1',
          attach: { estimate: true, detail: true, drawing: false, other: '' }, specials: '영업 시작일에 맞춰 마감 (예시)',
          estimate: {
            id: 'demo-e1', no: 'MD-DEMO-01', date: ymd(-2), title: '○○동 상가 1층 18평 인테리어 공사 (예시)', site: '경기 남양주시 ○○동 상가 1층 18평', period: '약 2주 (예시)',
            vatMode: 'add', vatLabel: '부가세 10% 포함', overheadRate: 0, roundLabel: '', showDetail: true, region: '경기 남양주시', siteName: '○○동 상가 1층',
            customer: { name: '이○○ (예시)', phone: '010-0000-5678' },
            totals: { sum: 4890000, overhead: 0, discount: 0, roundAdj: 0, supply: 4890000, vat: 489000, total: 5379000 },
            cats: [
              { no: 1, name: '전기·조명', sum: 1740000, lines: [
                { name: '매입등(다운라이트)', spec: 'LED 3인치', unit: '개', qty: 24, qtyText: '24', price: 35000, amount: 840000, note: '예시 금액' },
                { name: '전기 배선 공사', spec: '', unit: '식', qty: 1, qtyText: '1', price: 900000, amount: 900000, note: '' }] },
              { no: 2, name: '목공공사', sum: 2880000, lines: [
                { name: '가벽 설치', spec: '석고보드 2겹', unit: '식', qty: 1, qtyText: '1', price: 1800000, amount: 1800000, note: '예시 금액' },
                { name: '천장 평탄화', spec: '', unit: '평', qty: 18, qtyText: '18', price: 60000, amount: 1080000, note: '' }] },
              { no: 3, name: '간판 조명', sum: 270000, lines: [
                { name: '간판 간접조명', spec: 'LED 바', unit: 'm', qty: 6, qtyText: '6', price: 45000, amount: 270000, note: '' }] },
            ],
          },
          signs: { customer: null, supplier: null },
        },
      },
      {
        id: 'demo-k2', created_at: d(130), updated_at: d(95), customer_id: 'demo-c2', estimate_id: null, customer_name: '박○○ (예시)',
        title: '○○아파트 34평 욕실·주방 공사 (예시)', total: 12800000, start_date: ymd(-120), end_date: ymd(-98), status: 'done',
        doc: {
          mode: 'simple', no: 'MC-DEMO-02', date: ymd(-130), title: '○○아파트 34평 욕실·주방 공사 (예시)', site: '서울 강동구 ○○아파트 34평, 103동 502호',
          customer: { name: '박○○ (예시)', phone: '010-0000-2468', address: '서울 강동구 ○○아파트' },
          start: ymd(-120), end: ymd(-98), amount: '12800000', vat: 'excluded',
          payments: [{ label: '계약금', pct: 10, amount: '1280000', when: '계약할 때' }, { label: '중도금', pct: 40, amount: '5120000', when: '공사 중간' },
            { label: '잔금', pct: 50, amount: '6400000', when: '공사를 마치고 함께 확인한 뒤' }],
          account: '', warranty: { n: 1, unit: '년', note: '방수 공사는 3년' }, lateRate: '', delayRate: '',
          attach: { estimate: false, detail: false, drawing: false, other: '' }, specials: '', estimate: null,
          paperSigned: true, signs: { customer: null, supplier: null },
        },
      },
      {
        id: 'demo-k3', created_at: d(12), updated_at: d(4), customer_id: 'demo-c3', estimate_id: null, customer_name: '최○○ (예시)',
        title: '○○아파트 24평 도배·장판·필름 공사 (예시)', total: 8600000, start_date: ymd(-4), end_date: ymd(9), status: 'signed',
        doc: {
          mode: 'simple', no: 'MC-DEMO-03', date: ymd(-12), title: '○○아파트 24평 도배·장판·필름 공사 (예시)', site: '경기 의정부시 ○○동 ○○아파트 24평, 101동 1001호',
          customer: { name: '최○○ (예시)', phone: '010-0000-1357', address: '경기 의정부시 ○○동' },
          start: ymd(-4), end: ymd(9), amount: '8600000', vat: 'excluded',
          payments: [{ label: '계약금', pct: 10, amount: '860000', when: '계약할 때' }, { label: '중도금', pct: 40, amount: '3440000', when: '공사 중간' },
            { label: '잔금', pct: 50, amount: '4300000', when: '공사를 마치고 함께 확인한 뒤' }],
          account: '', warranty: { n: 1, unit: '년', note: '' }, lateRate: '', delayRate: '',
          attach: { estimate: false, detail: false, drawing: false, other: '' }, specials: '', estimate: null,
          paperSigned: true, signs: { customer: null, supplier: null },
          // 세부 공사일정 (예시)
          phases: [
            { name: '철거', start: '', days: '1', from: ymd(-4), to: ymd(-4) },
            { name: '전기공사', start: '', days: '3', from: ymd(-3), to: ymd(-1) },
            { name: '도배', start: '', days: '3', from: ymd(0), to: ymd(2) },
            { name: '장판', start: '', days: '2', from: ymd(3), to: ymd(4) },
            { name: '필름', start: '', days: '3', from: ymd(5), to: ymd(7) },
            { name: '입주 청소', start: '', days: '2', from: ymd(8), to: ymd(9) },
          ],
        },
      },
    ],
    defects: [
      { id: 'demo-d1', created_at: d(2), updated_at: d(2), customer_id: 'demo-c2', contract_id: 'demo-k2', received_on: ymd(-2), title: '욕실 실리콘 곰팡이 (예시)',
        body: '샤워부스 아래 실리콘에 검은 곰팡이가 생겼다고 연락 주심 (예시)', status: 'check', check_on: ymd(1), check_time: '오전 10시', check_note: '',
        repair_on: null, repair_end: null, repair_time: '', repair_note: '', done_on: null },
    ],
    schedules: [
      { id: 'demo-s1', created_at: d(1), updated_at: d(1), start_on: ymd(0), end_on: null, time: '오후 2시', title: '김○○ 고객님 댁 실측 (예시)', kind: 'visit',
        place: '서울 송파구 ○○아파트, 105동 803호', memo: '욕실·주방 사진도 같이 찍기', customer_id: null },
      { id: 'demo-s2', created_at: d(1), updated_at: d(1), start_on: ymd(3), end_on: null, time: '오전 11시', title: '타일 자재 고르러 가기 (예시)', kind: 'etc',
        place: '', memo: '', customer_id: 'demo-c1' },
    ],
    reviews: [
      {
        id: 'demo-r1', created_at: d(4), published: true, rating: 5, work_id: 'demo-w1',
        author: '김○○', place: '○○아파트 32평 · 예시',
        body: '처음 상담 때 대표님이 직접 오셔서 꼼꼼히 재 보시고, 견적서도 항목별로 하나하나 설명해 주셔서 믿음이 갔어요. 공사 중에도 매일 사진을 보내 주셔서 따로 가 보지 않아도 안심이 됐습니다.',
        photos: [],
      },
      {
        id: 'demo-r2', created_at: d(18), published: true, rating: 5, work_id: 'demo-w2',
        author: '이○○', place: '○○마을 24평 · 예시',
        body: '샷시 바꾸고 나서 올겨울 난방비가 확 줄었어요. 아이 방 붙박이장도 딱 맞게 짜 주셔서 정리가 훨씬 편해졌습니다.',
        photos: [],
      },
      {
        id: 'demo-r3', created_at: d(39), published: true, rating: 5, work_id: 'demo-w3',
        author: '박○○', place: '○○아파트 34평 · 예시',
        body: '살면서 하는 공사라 걱정이 많았는데, 매일 정리하고 가셔서 생활하는 데 큰 불편이 없었어요.',
        photos: [],
      },
      {
        id: 'demo-r4', created_at: d(60), published: true, rating: 5, work_id: 'demo-w4',
        author: '최○○', place: '○○아파트 28평 · 예시',
        body: '욕실 공사 후에 물이 조금 고이는 곳이 있어서 연락드렸더니 바로 다음 날 와서 고쳐 주셨어요. 끝까지 책임지시는 모습이 좋았습니다.',
        photos: [],
      },
      {
        id: 'demo-r5', created_at: d(118), published: true, rating: 4, work_id: 'demo-w6',
        author: '정○○', place: '○○동 상가 · 예시',
        body: '오픈 날짜가 빠듯했는데 일정 맞춰 주셔서 감사했어요. 목공 마감이 깔끔하다는 말을 손님들께 자주 듣습니다.',
        photos: [],
      },
    ],
  };
})();
