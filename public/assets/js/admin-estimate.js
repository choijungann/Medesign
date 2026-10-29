/* =====================================================================
   관리화면 — 견적서 만들기
   목록(#/estimates) → 작성(#/estimate/…): 기본 정보 → 공사 항목별 1, 2, 3 … → 마무리 → 미리보기
   엑셀·워드 파일 만들기는 estimate-export.js (받기를 누를 때만 불러옴)
   ===================================================================== */
(function () {
  'use strict';
  var K = window.AdminKit;
  if (!K) return;
  var C = K.C, DB = K.DB, I = K.I, esc = K.esc, $ = K.$, $$ = K.$$;
  var EC = C.estimate || {};
  var STAFF = (C.staff && C.staff.length) ? C.staff : [{ name: C.ceo || '', title: '대표', phone: C.phone || '' }];
  var app = document.getElementById('app');

  /* ---------- 처음 공사 항목 목록 (명함 시공 항목 + 상담 신청 항목, 보통 공사 순서) ----------
     부모님이 '견적서 설정'에서 항목·단가·기본 수량·평수별 수량을 바꾸면 그 목록(admin_settings 의 estimate_catalog)을 씀.
     items: [품명, 규격, 단위] */
  var BASE_CATS = [
    { key: 'demo', name: '철거·폐기물', items: [['기존 마감재 철거', '', '식'], ['폐기물 처리', '', '식'], ['엘리베이터·복도 보양', '', '식']] },
    { key: 'expand', name: '확장공사', items: [['발코니 확장 철거', '', '식'], ['단열재 보강', '', '㎡'], ['바닥 난방 연장', '', '㎡'], ['방수', '', '㎡']] },
    { key: 'sash', name: '샤시', items: [['거실 샤시 교체', '이중창', '틀'], ['방 샤시 교체', '', '틀'], ['발코니 샤시 교체', '', '틀'], ['기존 샤시 철거·폐기', '', '틀']] },
    { key: 'elec', name: '전기·조명', items: [['조명 기구', '', '개'], ['매입등(다운라이트)', '', '개'], ['스위치·콘센트 교체', '', '개'], ['전기 배선 공사', '', '식']] },
    { key: 'carp', name: '목공공사', items: [['천장 평탄화', '', '평'], ['가벽 설치', '', '식'], ['문틀 교체', '', '틀'], ['방문 교체', '', '짝'], ['걸레받이', '', 'm']] },
    { key: 'mold', name: '몰딩', items: [['천장 몰딩', '', 'm'], ['걸레받이', '', 'm'], ['마이너스 몰딩', '', 'm']] },
    { key: 'well', name: '우물등박스', items: [['우물천장 박스', '', '개'], ['간접조명 라인', '', 'm']] },
    { key: 'tile', name: '타일', items: [['욕실 벽 타일', '', '㎡'], ['욕실 바닥 타일', '', '㎡'], ['주방 벽 타일', '', '㎡'], ['현관 바닥 타일', '', '㎡']] },
    { key: 'marble', name: '대리석공사', items: [['현관 바닥 대리석', '', '㎡'], ['아트월', '', '㎡'], ['창대', '', 'm'], ['상판', '', 'm']] },
    { key: 'bath', name: '욕실', items: [['양변기', '', '개'], ['세면대·수전', '', '세트'], ['샤워 수전', '', '세트'], ['욕실장', '', '개'], ['욕실 천장재', '', '식'], ['욕실 방수', '', '식']] },
    { key: 'kitchen', name: '주방', items: [['싱크대', '', '식'], ['주방 상판', '', 'm'], ['후드', '', '개'], ['주방 수전', '', '개']] },
    { key: 'film', name: '필름·도장', items: [['방문 필름', '', '짝'], ['문틀 필름', '', '틀'], ['샤시 필름', '', '틀'], ['도장', '', '㎡']] },
    { key: 'paper', name: '도배', items: [['실크 벽지', '', '평'], ['합지 벽지', '', '평'], ['천장 도배', '', '평']] },
    { key: 'floor', name: '마루', items: [['강마루', '', '평'], ['강화마루', '', '평'], ['원목마루', '', '평'], ['기존 바닥재 철거', '', '평']] },
    { key: 'jangpan', name: '장판', items: [['장판', '', '평'], ['기존 바닥재 철거', '', '평'], ['걸레받이', '', 'm']] },
    { key: 'builtin', name: '붙박이장', items: [['붙박이장', '', '자']] },
    { key: 'dress', name: '드레스룸 행거', items: [['시스템 행거', '', '자'], ['선반', '', '개']] },
    { key: 'jamb', name: '중문', items: [['3연동 중문', '', '세트'], ['여닫이 중문', '', '세트'], ['슬라이딩 중문', '', '세트']] },
    { key: 'storage', name: '창고문', items: [['창고문', '', '짝']] },
    { key: 'grout', name: '줄눈시공', items: [['욕실 줄눈', '', '곳'], ['현관 줄눈', '', '곳'], ['주방 벽 줄눈', '', '곳']] },
    { key: 'ceramic', name: '세라믹탄성', items: [['발코니 탄성코트', '', '곳'], ['다용도실 탄성코트', '', '곳']] },
    { key: 'curtain', name: '커튼', items: [['커튼', '', '창'], ['커튼 레일', '', 'm']] },
    { key: 'combi', name: '콤비 블라인드', items: [['콤비 블라인드', '', '창']] },
    { key: 'clean', name: '입주청소', items: [['입주청소', '', '평'], ['새집증후군 시공', '', '평']] },
  ];
  // '토탈인테리어'를 누르면 한 번에 고르는 항목 (설정에서 바꿀 수 있음)
  var BASE_TOTAL = ['demo', 'elec', 'carp', 'mold', 'tile', 'bath', 'kitchen', 'film', 'paper', 'floor', 'jamb', 'clean'];
  // 상담 신청서의 '시공 품목' → 견적 공사 항목 ('TOTAL' = 토탈인테리어 묶음)
  //   (명함 시공 항목 + 장판·주방·욕실. 예전 이름(전체 리모델링·바닥·샷시·창호·목공·도장·필름)도 그대로 받음)
  var FROM_SCOPE = { '토탈인테리어': 'TOTAL', '확장공사': ['expand'], '샤시': ['sash'], '목공공사': ['carp'], '몰딩': ['mold'], '우물등박스': ['well'],
    '타일': ['tile'], '대리석공사': ['marble'], '필름': ['film'], '도배': ['paper'], '마루': ['floor'], '장판': ['jangpan'], '중문': ['jamb'],
    '붙박이장': ['builtin'], '드레스룸 행거': ['dress'], '창고문': ['storage'], '조명': ['elec'], '줄눈시공': ['grout'], '세라믹탄성': ['ceramic'],
    '커튼': ['curtain'], '콤비 블라인드': ['combi'], '입주청소': ['clean'], '주방': ['kitchen'], '욕실': ['bath'],
    '전체 리모델링': 'TOTAL', '바닥': ['floor'], '샷시·창호': ['sash'], '목공': ['carp'], '도장·필름': ['film'] };
  function uid() { return 'i' + Date.now().toString(36) + Math.random().toString(36).slice(2, 6); }
  function defaultCatalog() {
    return {
      version: 1,
      cats: BASE_CATS.map(function (c) {
        return { key: c.key, name: c.name, total: BASE_TOTAL.indexOf(c.key) >= 0, items: c.items.map(function (it, i) {
          return { id: c.key + '-' + i, name: it[0], spec: it[1], unit: it[2], price: '', qty: '', kind: 'option' };
        }) };
      }),
      presets: [],      // [{ id, size, qty: { 항목id: 수량 } }]
      sets: [{ id: 'set-total', name: '토탈인테리어', keys: BASE_TOTAL.slice() }],   // 공사 묶음: 견적서 '공사 항목 고르기'에서 버튼 하나로 여러 공사를 한 번에
      jangpanAdded: true,
      defaults: {},     // 견적서 기본값 (유효기간·부가세·결제 조건·특기사항·외부 유출 문구)
    };
  }
  function normCatalog(cat) {
    if (!cat || !Array.isArray(cat.cats)) return defaultCatalog();
    cat.presets = Array.isArray(cat.presets) ? cat.presets : [];
    cat.defaults = cat.defaults || {};
    cat.cats.forEach(function (c) {
      if (!c.key) c.key = 'c-' + uid();
      c.items = Array.isArray(c.items) ? c.items : [];
      c.items.forEach(function (it) { if (!it.id) it.id = uid(); if (it.kind !== 'default') it.kind = 'option'; });
    });
    cat.presets.forEach(function (p) { if (!p.id) p.id = uid(); p.qty = p.qty || {}; });
    // 공사 묶음 (예전 설정: 공사 항목마다 '토탈인테리어 버튼에 포함' 체크 → '토탈인테리어' 묶음 하나로 옮김)
    if (!Array.isArray(cat.sets)) {
      var tk0 = cat.cats.filter(function (c) { return c.total; }).map(function (c) { return c.key; });
      cat.sets = tk0.length ? [{ id: 'set-total', name: '토탈인테리어', keys: tk0 }] : [];
    }
    cat.sets.forEach(function (st) { if (!st.id) st.id = uid(); st.name = String(st.name || ''); st.keys = Array.isArray(st.keys) ? st.keys : []; delete st.order; });   // 묶음은 공사 항목 순서를 따름 (묶음마다 순서는 두지 않음 — 2026-10-26)
    // 예전에 저장한 설정에도 '장판' 공사 항목을 한 번 넣어 줌 (지운 뒤에는 다시 넣지 않음)
    if (!cat.jangpanAdded) {
      cat.jangpanAdded = true;
      if (!cat.cats.some(function (c) { return c.key === 'jangpan' || c.name === '장판'; })) {
        var base = BASE_CATS.filter(function (c) { return c.key === 'jangpan'; })[0];
        var at = cat.cats.map(function (c) { return c.key; }).indexOf('floor');
        cat.cats.splice(at >= 0 ? at + 1 : cat.cats.length, 0, { key: 'jangpan', name: base.name, total: false,
          items: base.items.map(function (it, i) { return { id: 'jangpan-' + i, name: it[0], spec: it[1], unit: it[2], price: '', qty: '', kind: 'option' }; }) });
      }
    }
    return cat;
  }
  var CATALOG, CAT = {};
  function setCatalog(cat) {
    CATALOG = normCatalog(cat);
    CAT = {};
    CATALOG.cats.forEach(function (c, i) { c.order = i; CAT[c.key] = c; });
  }
  setCatalog(defaultCatalog());
  var catalogP = null;
  function loadCatalog(force) {
    if (catalogP && !force) return catalogP;
    catalogP = (DB.getAdminSetting ? DB.getAdminSetting('estimate_catalog') : Promise.resolve(null)).then(function (v) {
      setCatalog(v ? JSON.parse(JSON.stringify(v)) : defaultCatalog());
      return CATALOG;
    }).catch(function () {   // 표가 아직 없거나(설정 SQL 실행 전) 인터넷 문제 → 처음 목록으로
      setCatalog(defaultCatalog()); catalogP = null; return CATALOG;
    });
    return catalogP;
  }
  // 묶음에 넣은 공사 (공사 항목·단가 탭 순서대로)
  function setKeys(st) { return (st && st.keys || []).filter(function (k) { return CAT[k]; }).sort(function (a, b) { return CAT[a].order - CAT[b].order; }); }
  // 상담 신청의 '토탈인테리어' → 이름이 '토탈인테리어'인 묶음 (없으면 맨 위 묶음)
  function totalSet() { var sets = CATALOG.sets || []; return sets.filter(function (st) { return st.name.replace(/\s/g, '') === '토탈인테리어'; })[0] || sets[0]; }
  function totalKeys() { return setKeys(totalSet()); }
  function presetLabel(p) { return p ? num(p.size) + '평형' : ''; }
  var UNITS = ['식', '평', '㎡', 'm', '자', '개', '짝', '틀', '세트', '곳', '창', '롤', '일', '인'];
  var VAT = { excluded: '부가세 별도', add: '부가세 10% 포함', none: '' };

  /* ---------- 숫자·날짜 ---------- */
  function num(v) { var n = parseFloat(String(v == null ? '' : v).replace(/[^0-9.\-]/g, '')); return isFinite(n) ? n : 0; }
  function won(n) { return Math.round(n || 0).toLocaleString('ko-KR'); }
  function pad(n) { return String(n).padStart(2, '0'); }
  function today() { var d = new Date(); return d.getFullYear() + '-' + pad(d.getMonth() + 1) + '-' + pad(d.getDate()); }
  function addDays(iso, n) {
    var m = /^(\d{4})-(\d{2})-(\d{2})$/.exec(iso || ''); if (!m) return '';
    var d = new Date(+m[1], +m[2] - 1, +m[3] + (n || 0));
    return d.getFullYear() + '-' + pad(d.getMonth() + 1) + '-' + pad(d.getDate());
  }
  function kDate(iso) {
    var m = /^(\d{4})-(\d{2})-(\d{2})$/.exec(iso || ''); if (!m) return '';
    return m[1] + '년 ' + (+m[2]) + '월 ' + (+m[3]) + '일';
  }
  // 52300000 → '오천이백삼십만' (일금 …원정)
  function hangul(n) {
    n = Math.floor(Math.abs(n || 0));
    if (!n) return '영';
    var D = ['', '일', '이', '삼', '사', '오', '육', '칠', '팔', '구'], P = ['', '십', '백', '천'], G = ['', '만', '억', '조'];
    var out = '', g = 0;
    while (n > 0) {
      var part = n % 10000, s = '';
      for (var i = 3; i >= 0; i--) { var d = Math.floor(part / Math.pow(10, i)) % 10; if (d) s += D[d] + P[i]; }
      if (s) out = s + G[g] + out;
      n = Math.floor(n / 10000); g++;
    }
    return out;
  }

  /* ---------- 견적서 내용 ---------- */
  // 세부 항목(설정의 단가·단위·기본 수량, 평수별 수량)으로 견적 한 줄 만들기
  function presetQty(item, preset) {
    if (preset && preset.qty && preset.qty[item.id] != null && String(preset.qty[item.id]) !== '') return preset.qty[item.id];
    return item.qty == null ? '' : item.qty;
  }
  function newLine(item, preset) {
    if (!item) return { name: '', spec: '', unit: '', qty: '', price: '', note: '' };
    var q = presetQty(item, preset);
    return { itemId: item.id, name: item.name || '', spec: item.spec || '', unit: item.unit || '', qty: q === '' || q == null ? '' : String(q),
      price: num(item.price) ? String(num(item.price)) : '', note: '' };
  }
  // 이 견적서에 쓸 평수별 수량: 직접 고른 평형, 또는 평수와 가장 가까운 평형(같으면 큰 쪽)
  function pickPreset(doc) {
    var ps = CATALOG.presets || [];
    if (!ps.length || doc.preset === 'none') return null;
    if (doc.preset && doc.preset !== 'auto') return ps.filter(function (p) { return p.id === doc.preset; })[0] || null;
    var size = num(doc.site && doc.site.size);
    if (!size) return null;
    var best = null;
    ps.forEach(function (p) {
      var d = Math.abs(num(p.size) - size);
      if (!best || d < best.d || (d === best.d && num(p.size) > num(best.p.size))) best = { p: p, d: d };
    });
    return best ? best.p : null;
  }
  // 공사 항목을 고르면 '기본 항목'으로 정해 둔 줄이 미리 들어감
  function catOf(key, name, preset) {
    var c = CAT[key], cat = { key: key, name: name || (c ? c.name : '기타'), lines: [] };
    if (c) c.items.forEach(function (it) { if (it.kind === 'default') cat.lines.push(newLine(it, preset)); });
    return cat;
  }
  // 견적서 공사 순서: 공사 항목 목록 순서, 직접 넣은 공사는 맨 뒤 (order: 예전 견적서에 남은 doc.catOrder 가 있으면 그 순서 먼저)
  function sortCats(cats, order) {
    var rank = function (c) {
      var i = Array.isArray(order) ? order.indexOf(c.key) : -1;
      return i >= 0 ? i : CAT[c.key] ? 5000 + CAT[c.key].order : 10000 + (c.added || 0);
    };
    return cats.slice().sort(function (a, b) { return rank(a) - rank(b); });
  }
  function blankDoc() {
    var D = (CATALOG && CATALOG.defaults) || {};
    return {
      no: '', date: today(), validDays: D.validDays || EC.validDays || 7, title: '',
      customer: { name: '', phone: '' }, site: { region: '', name: '', unit: '', size: '' }, period: '', plannedHint: '',
      staff: 0, cats: [], preset: 'auto',
      overhead: { on: false, rate: '' }, discount: '', round: 'none', vat: D.vat || EC.vat || 'excluded',
      payment: D.payment || '', notes: D.notes != null ? D.notes : (EC.notes || ''),
      showDetail: D.showDetail !== false,    // 세부 내역 넣기 (끄면 공사 항목별 합계만)
      confidential: { on: true, text: D.confidential || EC.confidential || '이 견적서는 고객님께만 드리는 자료입니다. 외부 유출과 무단 복제를 금합니다.' },
    };
  }
  function lineAmount(l) { return Math.round(num(l.qty) * num(l.price)); }
  function isEmptyLine(l) { return !String(l.name || '').trim() && !lineAmount(l) && !String(l.spec || '').trim() && !String(l.note || '').trim(); }
  function calc(doc) {
    var cats = doc.cats.map(function (c) {
      var sum = 0; c.lines.forEach(function (l) { sum += lineAmount(l); });
      return { key: c.key, name: c.name, sum: sum, count: c.lines.filter(function (l) { return !isEmptyLine(l); }).length };
    });
    var sum = cats.reduce(function (a, c) { return a + c.sum; }, 0);
    var overhead = doc.overhead && doc.overhead.on ? Math.round(sum * num(doc.overhead.rate) / 100) : 0;
    var discount = Math.min(Math.max(0, Math.round(num(doc.discount))), sum + overhead);
    var base = sum + overhead - discount;
    var unit = doc.round === '10000' ? 10000 : doc.round === '1000' ? 1000 : 1;
    var roundAdj = unit > 1 ? -(base % unit) : 0;
    var supply = base + roundAdj;
    var vat = doc.vat === 'add' ? Math.floor(supply * 0.1) : 0;
    return { cats: cats, sum: sum, overhead: overhead, discount: discount, roundAdj: roundAdj, supply: supply, vat: vat, total: supply + vat };
  }
  // 화면·파일이 같이 쓰는 '완성본' 모양
  function model(doc, rec) {
    var t = calc(doc), st = STAFF[doc.staff] || STAFF[0];
    var vd = Math.max(1, Math.round(num(doc.validDays)) || 7);
    var sz = doc.site.size ? String(doc.site.size).replace(/평$/, '') + '평' : '';
    var site = [doc.site.region, doc.site.name, sz].filter(Boolean).join(' ');                       // 공사명(비워 둘 때)에는 동·호수를 넣지 않음
    var siteFull = [doc.site.region, doc.site.name, doc.site.unit, sz].filter(Boolean).join(' ');   // 견적서 '현장' 칸에는 동·호수까지
    return {
      no: doc.no || '', date: doc.date, dateK: kDate(doc.date), validDays: vd, validUntilK: kDate(addDays(doc.date, vd)),
      validText: '견적일로부터 ' + vd + '일 (' + kDate(addDays(doc.date, vd)) + '까지)',   // 예) 견적일로부터 7일 (2026년 11월 1일까지)
      title: doc.title || (site ? site + ' 인테리어 공사' : '인테리어 공사'),
      customer: { name: doc.customer.name || '', phone: doc.customer.phone || '' }, site: siteFull, period: doc.period || '',
      supplier: { name: C.name || '', legalName: C.legalName || '', ceo: C.ceo || '', bizNumber: C.bizNumber || '', address: C.address || '',
        staff: st ? st.name || '' : '', email: C.email || '',   // 담당: 이름만 (직함 빼기)
        phone: st ? st.phone : (C.phone || ''), domain: C.siteDomain || '', slogan: C.slogan || '' },
      cats: doc.cats.map(function (c, i) {
        var lines = c.lines.filter(function (l) { return !isEmptyLine(l); }).map(function (l) {
          return { name: String(l.name || '').trim(), spec: String(l.spec || '').trim(), unit: String(l.unit || '').trim(),
            qty: num(l.qty), qtyText: String(l.qty || '').trim(), price: Math.round(num(l.price)), amount: lineAmount(l), note: String(l.note || '').trim() };
        });
        return { no: i + 1, name: c.name, lines: lines, sum: t.cats[i].sum };
      }),
      totals: t, overheadRate: doc.overhead && doc.overhead.on ? num(doc.overhead.rate) : 0,
      roundLabel: doc.round === '10000' ? '만원 단위 정리' : doc.round === '1000' ? '천원 단위 정리' : '',
      roundUnit: doc.round === '10000' ? 10000 : doc.round === '1000' ? 1000 : 1,
      vatMode: doc.vat, vatLabel: VAT[doc.vat] || '', amountWords: '일금 ' + hangul(t.total) + '원정',
      payment: String(doc.payment || '').trim(), notes: String(doc.notes || '').split('\n').map(function (s) { return s.trim(); }).filter(Boolean),
      confidential: { on: !!(doc.confidential && doc.confidential.on), text: (doc.confidential && doc.confidential.text) || '' },
      showDetail: doc.showDetail !== false,
      updated_at: rec && rec.updated_at,
    };
  }

  function friendly(err) { return esc(K.friendlyError(err)); }
  function fail(title, err) { return K.ask({ title: title, text: friendly(err), cancel: false, ok: '확인' }); }

  /* =====================================================================
     목록
     ===================================================================== */
  // 견적 진행 상태: 계약 완료(이 견적서로 만든 계약서가 계약 완료·공사 완료) · 견적 중단 · 진행 중
  var STAGES = { open: '진행 중', won: '계약 완료', stopped: '견적 중단' };
  var EFILTERS = [['all', '전체'], ['open', '진행 중'], ['won', '계약 완료'], ['stopped', '견적 중단']];
  function stageOf(e, contracts) {
    var linked = (contracts || []).filter(function (k) { return k.estimate_id && k.estimate_id === e.id; });
    if (linked.some(function (k) { return k.status === 'signed' || k.status === 'done'; })) return 'won';
    if (e.status === 'stopped' || (linked.length && linked.every(function (k) { return k.status === 'canceled' || k.status === 'terminated'; }))) return 'stopped';
    return 'open';
  }
  function viewList() {
    K.frame('견적서', false, 'estimates');
    app.innerHTML = '<div class="page"><div class="loading">불러오는 중…</div></div>';
    Promise.all([DB.listEstimates(), K.soft(DB.listContracts), K.soft(DB.listCustomers)]).then(function (r) {
      var list = r[0], contracts = r[1] || [], custs = {};
      (r[2] || []).forEach(function (c) { custs[c.id] = c; });
      function findRec(e) {
        var c = custs[e.customer_id] || {}, d = e.estimate_date || K.ymd(new Date(e.created_at));
        return { phone: e.customer_phone || c.phone, text: [e.title, e.customer_name, e.site_name, e.region, c.name, c.address].join(' '), date: d,
          region: K.regionOf(e.region) || K.regionOf(c.address) || K.regionOf(e.title), status: stage[e.id] };
      }
      var stage = {}, ctrOf = {};
      list.forEach(function (e) { stage[e.id] = stageOf(e, contracts); });
      contracts.forEach(function (k) { if (k.estimate_id && (!ctrOf[k.estimate_id] || k.status === 'signed' || k.status === 'done')) ctrOf[k.estimate_id] = k; });
      var page = document.createElement('div');
      page.className = 'page est-list-page';
      page.innerHTML =
        '<div class="est-top-actions"><a class="btn btn-primary est-new" href="#/estimate/new">' + I.plus + '새 견적서 만들기</a>' +
        '<a class="btn btn-outline est-set-link" href="#/estimates/settings">' + I.gear + '견적서 설정<small>항목 · 단가 · 묶음 · 평수별 수량</small></a></div>' +
        // 목록 위 안내 상자는 지움 (2026-10-26 대표님 요청)
        '<div class="sec-head sh-1"><div class="sec-title"><h2>만든 견적서</h2></div></div>' +
        (list.length ? K.filterHtml('estF', { ph: '이름·전화번호·아파트', dateLabel: '견적일', regions: list.map(function (e) { return findRec(e).region; }),
          statuses: EFILTERS.filter(function (f) { return f[0] !== 'all'; }).map(function (f) { return [f[0], f[1], list.filter(function (e) { return stage[e.id] === f[0]; }).length]; }) }) : '') +
        K.listTools('est-n', list.length ? 'est' : '') + '<div id="est-list"></div>';
      app.innerHTML = '';
      app.appendChild(page);
      function cardTitle(e) { return K.estTitle(e); }   // 공사명 그대로
      // 카드 이름(카드 첫 줄 굵은 글씨) = 현장(아파트 이름 + 동·호수 + 평수), 없으면 고객 이름, 그것도 없으면 공사명 — 전체 보기 표의 '공사명' 자리도 이것
      function cardName(e) {
        var site = K.siteLabel((e.site_name || '') + (e.site_unit ? ', ' + e.site_unit : ''), e.site_size), nm = e.customer_name || '';
        return site || (nm ? nm + ' 고객님' : cardTitle(e));
      }
      // 카드 (첫 화면과 같은 네 줄 + 금액): ① 현장(아파트 이름 + 동·호수 + 평수) ② 공사 항목 ③ 고객 이름 ④ 견적서 작성일 ⑤ 금액 · 오른쪽 동그라미 상태
      function card(e) {
        var st = stage[e.id], k = ctrOf[e.id];
        var nm = e.customer_name || '', big = cardName(e);
        var items = e.items || K.workItems(e.title, [e.site_name, e.region, e.site_unit].join(' '));   // 공사 항목: 견적서에 넣은 항목 이름 (예: 전기·조명, 목공공사)
        var day = e.estimate_date || K.ymd(new Date(e.created_at || Date.now()));
        var circ = { open: '진행 중', won: '계약<br>완료', stopped: '견적<br>중단' }[st] || esc(STAGES[st] || '');
        return '<div class="item has-del est-item ct-card st-' + esc(st) + (st === 'stopped' ? ' is-off' : '') + '">' +
          '<label class="bulk-pick"><input type="checkbox" data-bid="' + esc(e.id) + '" aria-label="' + esc(big) + ' 고르기"></label>' +
          // 지우기 · 복사(이 견적서를 복사해서 새로 만들기)는 오른쪽 위에 같은 너비로 위아래
          '<button class="item-del" type="button" data-del="' + esc(e.id) + '" aria-label="이 견적서 지우기">' + I.trash + '<span>지우기</span></button>' +
          '<button class="item-copy" type="button" data-copy="' + esc(e.id) + '" aria-label="이 견적서를 복사해서 새로 만들기">' + I.copy + '<span>복사</span></button>' +
          '<a class="est-open item-txt e4" href="#/estimate/' + encodeURIComponent(e.id) + '"><div class="item-title">' + esc(big) + '</div>' +
          (items && items !== big ? '<span class="e4-item">' + esc(items) + '</span>' : '') +
          (nm && big !== nm + ' 고객님' ? '<span class="e4-who">' + esc(nm) + ' 고객님</span>' : '') +
          '<span class="e4-date">작성일 <b>' + esc(K.sDate(day)) + '</b></span>' +
          '<div class="e4-foot"><span class="est-total">' + won(e.total) + '원</span><span class="st-circ c-' + esc(st) + '" role="img" aria-label="상태: ' + esc(STAGES[st] || '') + '">' + circ + '</span></div></a>' +
          // 단추: 윗줄은 어느 상태든 '열기 · (계약서 단추)' 같은 자리 — 진행 중은 계약서 만들기(이어 쓰기), 계약 완료는 계약서 보기, 중단은 다시 진행
          // 진행 중일 때만 아랫줄에 '견적 중단'을 길게
          '<div class="item-actions e-row"><a class="btn btn-outline" href="#/estimate/' + encodeURIComponent(e.id) + '">열기</a>' +
          (st === 'won' && k ? '<a class="btn btn-outline" href="#/contract/' + encodeURIComponent(k.id) + '">계약서 보기</a>'
            : st === 'stopped' ? (e.status === 'stopped' ? '<button class="btn btn-outline" type="button" data-reopen="' + esc(e.id) + '">다시 진행</button>' : '<a class="btn btn-outline" href="#/contract/' + encodeURIComponent(k ? k.id : '') + '">계약서 보기</a>')
              : (window.ContractKit ? (k ? '<a class="btn btn-primary" href="#/contract/' + encodeURIComponent(k.id) + '">계약서 이어 쓰기</a>'
                : '<a class="btn btn-primary" href="#/contract/new/e/' + encodeURIComponent(e.id) + '">계약서 만들기</a>') : '') +
                '<button class="btn btn-outline e-stop" type="button" data-stop="' + esc(e.id) + '">견적 중단</button>') + '</div></div>';
      }
      function draw() {
        var finding = K.filterActive('estF');
        var shown = list.filter(function (e) { return K.filterMatch('estF', findRec(e)); });
        $('#est-n', page).innerHTML = K.listCount(list.length, shown.length, finding);
        var table = K.viewMode('est') === 'table';
        $('#est-list', page).innerHTML = shown.length ? (table ? K.dataTable('est', [
          { label: '고객', sort: function (e) { return e.customer_name || ''; }, html: function (e) { return '<b>' + esc(e.customer_name || '-') + '</b>'; }, cls: 'stick' },
          { label: '상태', sort: function (e) { return stage[e.id]; }, html: function (e) { return '<span class="pill e-' + stage[e.id] + '">' + STAGES[stage[e.id]] + '</span>'; } },
          { label: '현장', sort: function (e) { return cardName(e); }, html: function (e) { return esc(cardName(e)); }, cls: 'wide' },   // 카드 이름과 같게 (2026-10-26)
          { label: '견적일', sort: function (e) { return findRec(e).date; }, html: function (e) { return esc(findRec(e).date.replace(/-/g, '.')); } },
          { label: '연락처', html: function (e) { return esc(findRec(e).phone || ''); } },
          { label: '금액', sort: function (e) { return Number(e.total) || 0; }, html: function (e) { return won(e.total); }, cls: 'n' },
          { label: '고친 날', sort: function (e) { return e.updated_at || ''; }, html: function (e) { return esc(K.fmtDate(e.updated_at)); } },
        ], shown, function (e) { return '#/estimate/' + encodeURIComponent(e.id); }, function (e) { return e.id; }) : '<div class="items">' + shown.map(card).join('') + '</div>')
          : '<div class="empty-box">' + (!list.length ? '아직 만든 견적서가 없어요.<br>위의 <b>새 견적서 만들기</b>를 눌러 시작해 보세요.'
            : '조건에 맞는 견적서가 없어요.<br>위 <b>조건 모두 지우기</b>를 누르면 전체가 보여요.') + '</div>';
        if (bk) bk.refresh();
      }
      var bk = list.length ? K.bulk({ page: page, host: $('.lt-btns', page), noun: '견적서', del: function (id) { return DB.deleteEstimate(id); }, after: viewList }) : null;
      if (list.length) { K.filterBind(page, 'estF', draw); K.dataTableBind(page, draw); }
      draw();
      page.addEventListener('click', function (ev) {
        var sp = ev.target.closest('[data-stop]') || ev.target.closest('[data-reopen]');
        if (sp) {
          var sid = sp.getAttribute('data-stop') || sp.getAttribute('data-reopen'), stop = sp.hasAttribute('data-stop');
          (stop ? K.ask({ title: '견적을 중단할까요?', text: '손님이 계약하지 않기로 했을 때 눌러요. 견적서는 지우지 않고 <b>견적 중단</b>으로 남겨 둬요.<br>나중에 <b>다시 진행</b>을 누르면 되살릴 수 있어요.', cancel: '그만두기', ok: '중단하기' }) : Promise.resolve(true))
            .then(function (ok) {
              if (!ok) return;
              sp.disabled = true;
              return DB.setEstimateStatus(sid, stop ? 'stopped' : 'open').then(function () { K.toast(stop ? '견적 중단으로 바꿨어요' : '진행 중으로 되돌렸어요'); viewList(); })
                .catch(function (err) { sp.disabled = false; fail('바꾸지 못했어요', /status|column|schema/i.test(String(err && err.message)) ? new Error('견적 중단을 쓰려면 Supabase에서 설정 SQL(schema.sql)을 한 번 더 실행해야 해요. 앤에게 알려 주세요.') : err); });
            });
          return;
        }
        var cp = ev.target.closest('[data-copy]'), dl = ev.target.closest('[data-del]');
        if (cp) K.go('#/estimate/copy/' + encodeURIComponent(cp.getAttribute('data-copy')));
        if (dl) {
          var id = dl.getAttribute('data-del');
          K.ask({ title: '이 견적서를 지울까요?', text: '휴지통에 <b>30일</b> 동안 보관돼서 그동안은 <b>설정 → 휴지통</b>에서 되살릴 수 있어요.', cancel: '그만두기', ok: '지우기', okClass: 'btn-danger' })
            .then(function (ok) {
              if (!ok) return;
              DB.deleteEstimate(id).then(function () { K.toast('휴지통으로 옮겼어요'); K.state.counts = null; viewList(); })
                .catch(function (err) { fail('지우지 못했어요', err); });
            });
        }
      });
    }).catch(function (err) {
      app.innerHTML = '<div class="page"><div class="empty-box">견적서를 불러오지 못했어요.<br>' + friendly(err) + '</div></div>';
    });
  }

  /* =====================================================================
     작성
     ===================================================================== */
  function nextNo(list, date) {
    var d = String(date || today()).replace(/-/g, '');
    var n = (list || []).filter(function (e) {
      var c = new Date(e.created_at || 0);
      return c.getFullYear() + pad(c.getMonth() + 1) + pad(c.getDate()) === d;
    }).length + 1;
    return 'MD-' + d + '-' + pad(n);
  }
  function fromInquiry(doc, q) {
    doc.customer.name = q.name || ''; doc.customer.phone = q.phone || '';
    doc.site.region = q.region || ''; doc.site.name = q.site_name || ''; doc.site.size = String(q.size || '').replace(/[^0-9.]/g, '');
    if (q.planned_date && DB.fmtPlan) doc.plannedHint = DB.fmtPlan(q.planned_date, q.planned_undecided);
    else if (q.planned_undecided) doc.plannedHint = '아직 정하지 않음';
    var keys = [], customs = [], preset = pickPreset(doc);
    (q.scopes || []).forEach(function (s) {
      var f = FROM_SCOPE[s];
      if (f) (f === 'TOTAL' ? totalKeys() : f).forEach(function (k) { if (CAT[k] && keys.indexOf(k) < 0) keys.push(k); });
      else {
        var m = /^기타\s*[:：]\s*(.+)$/.exec(s), name = m && m[1].trim().slice(0, 30);
        if (!name) return;
        var same = CATALOG.cats.filter(function (c) { return c.name === name; })[0];
        if (same) { if (keys.indexOf(same.key) < 0) keys.push(same.key); } else customs.push(name);
      }
    });
    doc.cats = keys.map(function (k) { return catOf(k, null, preset); });
    customs.forEach(function (n, i) { var c = catOf('custom-' + Date.now().toString(36) + i, n); c.added = i; doc.cats.push(c); });
    doc.cats = sortCats(doc.cats, doc.catOrder);
    if (q.message) doc.memo = String(q.message).slice(0, 300);
  }

  function viewEditor(args) {
    var mode = args[0] || 'new';           // 'new' | 'copy' | <id>
    K.frame('견적서 만들기', true, 'estimates');
    K.state.backTo = '#/estimates';
    app.innerHTML = '<div class="page"><div class="loading">불러오는 중…</div></div>';
    var rec = { id: null, inquiry_id: null, customer_id: null };
    var load;
    var first = loadCatalog();   // 견적서 설정(항목·단가·평수별 수량)을 먼저 읽음
    if (mode === 'new') {
      load = first.then(function () { return DB.listEstimates(); }).then(function (list) {
        var doc = blankDoc(); doc.no = nextNo(list, doc.date);
        if (args[1] === 'q' && args[2]) {
          return DB.listInquiries().then(function (qs) {
            var q = qs.filter(function (x) { return x.id === decodeURIComponent(args[2]); })[0];
            if (q) { fromInquiry(doc, q); rec.inquiry_id = q.id; }
            return doc;
          });
        }
        // 고객 관리에서 '견적서 만들기': 이름·연락처·주소를 미리 채움
        if (args[1] === 'c' && args[2] && DB.getCustomer) {
          return DB.getCustomer(decodeURIComponent(args[2])).then(function (c) {
            if (c) {
              doc.customer.name = c.name || ''; doc.customer.phone = c.phone || ''; rec.customer_id = c.id;
              var ap = K.splitRegion(c.address || ''), rg = K.joinRegion({ sido: ap.sido, sgg: ap.sgg, etc: ap.etc, rest: '' });   // 고객 주소 → 지역 / 아파트 이름 / 동·호수
              if (rg && !doc.site.region) doc.site.region = rg; doc.site.name = rg ? ap.rest : (c.address || '').split(',')[0].trim(); doc.site.unit = ap.unit || '';
            }
            return doc;
          });
        }
        return doc;
      });
    } else if (mode === 'copy') {
      load = first.then(function () { return Promise.all([DB.getEstimate(decodeURIComponent(args[1] || '')), DB.listEstimates()]); }).then(function (r) {
        if (!r[0]) throw new Error('복사할 견적서를 찾을 수 없어요.');
        var doc = JSON.parse(JSON.stringify(r[0].doc || blankDoc()));
        doc.date = today(); doc.no = nextNo(r[1], doc.date);
        doc.title = (doc.title || '') + (doc.title ? ' (복사)' : '');
        rec.inquiry_id = r[0].inquiry_id || null; rec.customer_id = r[0].customer_id || null;
        return doc;
      });
    } else {
      load = first.then(function () { return DB.getEstimate(decodeURIComponent(mode)); }).then(function (r) {
        if (!r) throw new Error('견적서를 찾을 수 없어요. 이미 지웠을 수 있어요.');
        rec.id = r.id; rec.inquiry_id = r.inquiry_id || null; rec.customer_id = r.customer_id || null; rec.updated_at = r.updated_at;
        return Object.assign(blankDoc(), r.doc || {});
      });
    }
    load.then(function (doc) {
      doc.cats = (doc.cats || []).map(function (c) { c.lines = c.lines || []; return c; });
      editor(rec, doc, mode === 'new' || mode === 'copy');
    }).catch(function (err) {
      app.innerHTML = '<div class="page"><div class="empty-box">' + friendly(err) + '<br><a href="#/estimates">견적서 목록으로</a></div></div>';
    });
  }

  function editor(rec, doc, isNew) {
    var step = 0;
    var saving = null;
    var page = document.createElement('div');
    page.className = 'page est-page';
    app.innerHTML = '';
    app.appendChild(page);
    K.titleEl.textContent = isNew ? '새 견적서' : '견적서 수정';

    function steps() {
      var s = [{ id: 'info', label: '기본 정보' }];
      doc.cats.forEach(function (c, i) { s.push({ id: 'cat', idx: i, label: (i + 1) + '. ' + c.name }); });
      s.push({ id: 'finish', label: '마무리' });
      s.push({ id: 'preview', label: '미리보기·받기' });
      return s;
    }
    function dirty() { K.setDirty(true); }

    /* ----- 저장 ----- */
    function save(quiet) {
      if (saving) return saving;
      var m = model(doc, rec);
      var row = { id: rec.id || DB.newId(), inquiry_id: rec.inquiry_id, customer_id: rec.customer_id, customer_name: String(doc.customer.name || '').slice(0, 30),
        title: String(m.title).slice(0, 120), total: m.totals.total, doc: doc };
      // 연락처가 있으면 고객 관리에 같은 번호 고객을 찾아(없으면 만들어) 연결
      var link = DB.ensureCustomer && String(doc.customer.phone || '').replace(/[^0-9]/g, '').length >= 9
        ? DB.ensureCustomer({ name: doc.customer.name, phone: doc.customer.phone, address: [doc.site.region, doc.site.name].filter(Boolean).join(' ') + (doc.site.unit ? ', ' + doc.site.unit : '') })
          .then(function (c) { if (c) row.customer_id = rec.customer_id = c.id; }).catch(function () {})
        : Promise.resolve();
      saving = link.then(function () { return DB.saveEstimate(row); }).then(function (saved) {
        rec.id = saved.id; rec.updated_at = saved.updated_at;
        K.setDirty(false);
        K.state.counts = null;
        var h = '#/estimate/' + encodeURIComponent(rec.id);
        if (location.hash !== h) K.setHash(h);
        var st = $('#est-saved', page); if (st) st.textContent = '저장됨 ' + new Date().toLocaleTimeString('ko-KR', { hour: 'numeric', minute: '2-digit' });
        if (!quiet) K.toast('저장했어요');
        return saved;
      }).catch(function (err) {
        fail('저장하지 못했어요', err);
        throw err;
      }).then(function (r) { saving = null; return r; }, function (e) { saving = null; throw e; });
      return saving;
    }
    function go(i) {
      var list = steps();
      i = Math.max(0, Math.min(list.length - 1, i));
      var move = function () { step = i; render(); window.scrollTo(0, 0); };
      // 단계를 옮길 때마다 자동 저장 (처음 화면에서 아무것도 안 적었으면 건너뜀)
      if (K.state.dirty || (!rec.id && i > 0)) save(true).then(move, function () {}); else move();
    }

    /* ----- 위 단계 표시 + 아래 합계·이동 막대 ----- */
    function frameHtml(inner) {
      var list = steps(), t = calc(doc);
      var cur = list[step];
      return '<nav class="est-steps" aria-label="견적서 단계">' + list.map(function (s, i) {
        return '<button type="button" class="est-step' + (i === step ? ' on' : '') + (i < step ? ' past' : '') + '" data-step="' + i + '"' + (i === step ? ' aria-current="step"' : '') + '>' + esc(s.label) + '</button>';
      }).join('') + '</nav>' +
        '<div class="est-body">' + inner + '</div>' +
        '<div class="savebar est-bar"><div class="est-sum"><small>' + esc(cur.id === 'cat' ? doc.cats[cur.idx].name + ' ' + won(t.cats[cur.idx].sum) + '원 · ' : '') + '합계' + (VAT[doc.vat] ? ' (' + VAT[doc.vat] + ')' : '') + '</small>' +
        '<b id="est-total">' + won(t.total) + '원</b><span class="est-saved" id="est-saved">' + (rec.id ? '저장됨' : '아직 저장 안 됨') + '</span></div>' +
        // 어느 단계에서든 바로 저장: 첫 단계 '다음 · 저장', 가운데 '이전 · 다음 · 저장', 마지막 '이전 · 저장하고 마치기'
        '<div class="est-nav' + (step > 0 && step < list.length - 1 ? ' three' : '') + '">' + (step > 0 ? '<button class="btn btn-outline" type="button" data-prev>이전</button>' : '') +
        (step < list.length - 1 ? '<button class="btn btn-primary" type="button" data-next aria-label="다음: ' + esc(list[step + 1].label) + '">다음</button>' : '<button class="btn btn-primary" type="button" data-finish>저장하고 마치기</button>') +   // 마지막 단계: 저장한 뒤 견적서 목록으로
        (step < list.length - 1 ? '<button class="btn btn-outline" type="button" data-save>저장</button>' : '') +
        '</div></div>';
    }
    function refreshTotals() {
      var t = calc(doc), el = $('#est-total', page);
      if (el) el.textContent = won(t.total) + '원';
      var cur = steps()[step];
      var sm = $('.est-sum small', page);
      if (sm) sm.textContent = (cur.id === 'cat' ? doc.cats[cur.idx].name + ' ' + won(t.cats[cur.idx].sum) + '원 · ' : '') + '합계' + (VAT[doc.vat] ? ' (' + VAT[doc.vat] + ')' : '');
      $$('[data-cat-sum]', page).forEach(function (x) { x.textContent = won(t.cats[+x.getAttribute('data-cat-sum')].sum) + '원'; });
      if (cur.id === 'finish') drawBreakdown();
      var st = $('#est-saved', page); if (st && K.state.dirty) st.textContent = '고친 내용 저장 전';
    }

    /* ----- 1) 기본 정보 ----- */
    function infoHtml() {
      var picked = {}; doc.cats.forEach(function (c) { picked[c.key] = true; });
      var custom = doc.cats.filter(function (c) { return !CAT[c.key]; });
      // 저장된 견적서면 제목 오른쪽에 '복사해서 새로 만들기' (고친 게 있으면 저장하고 복사)
      return (rec.id ? '<div class="est-cat-head est-info-head"><h2 class="est-h">기본 정보</h2>' +
          '<button type="button" class="est-copy" data-estcopy>' + I.copy + '<span>복사해서 새로 만들기</span></button></div>' : '<h2 class="est-h">기본 정보</h2>') +
        (doc.memo ? '<div class="tip">' + I.info + '<span>손님이 남긴 말: ' + esc(doc.memo) + '</span></div>' : '') +
        '<div class="txt-card est-card">' +
        '<div class="est-grid">' +
        fld('customer.name', '고객 이름', doc.customer.name, { ph: '예) 김○○', max: 30 }) +
        fld('customer.phone', '연락처', doc.customer.phone, { ph: '010-0000-0000', type: 'tel', max: 20 }) +
        '<div class="est-wide bl-slot" id="bl-slot"></div>' +   // 블랙리스트 연락처면 경고
        '<div class="field"><label for="f-site-region-sido">지역</label>' + K.regionPick('f-site-region', doc.site.region, { bind: 'site.region' }) + '</div>' +
        fld('site.name', '아파트(건물) 이름·주소', doc.site.name, { ph: '예) 헬리오시티', max: 80 }) +
        fld('site.unit', '상세 주소 (동·호수)', doc.site.unit || '', { ph: '예) 101동 1001호', max: 40 }) +
        fld('site.size', '평수', doc.site.size, { ph: '예) 32', mode: 'decimal', max: 8, suffix: '평' }) +
        presetField() +
        fld('title', '공사명', doc.title, { ph: '비워 두면: 지역 + 건물 + 평수 + 인테리어 공사', max: 120, wide: true }) +
        '</div></div>' +
        '<div class="txt-card est-card"><div class="est-grid">' +
        fld('date', '견적일', doc.date, { type: 'date' }) +
        fld('validDays', '견적유효기간', doc.validDays, { mode: 'numeric', max: 3, suffix: '일', hint: '<span id="valid-until">' + esc(validLine()) + '</span>' }) +
        fld('period', '예상 시공기간', doc.period, { ph: '예) 약 3주 (2027년 3월 2일 ~ 3월 20일)', max: 80, wide: true,
          hint: doc.plannedHint ? '손님이 적은 시공 예정일: ' + esc(doc.plannedHint) : '공사 시작일과 걸리는 기간을 적어요.' }) +
        '<div class="field est-wide"><span class="label">담당</span><div class="choices">' + STAFF.map(function (s, i) {
          return '<label class="choice"><input type="radio" name="est-staff" value="' + i + '"' + (+doc.staff === i ? ' checked' : '') + '><span>' + esc(s.name) + ' · ' + esc(s.phone) + '</span></label>';
        }).join('') + '</div></div>' +
        '</div></div>' +
        '<h2 class="est-h">공사 항목 고르기</h2>' +
        '<p class="txt-desc">고른 항목마다 한 단계씩 넘기면서 금액을 적어요. 나중에 다시 와서 더 고를 수도 있어요. <a href="#/estimates/settings">항목·단가 미리 정하기</a></p>' +
        '<div class="txt-card est-card">' +
        // 공사 묶음 드롭다운 (견적서 설정 → 공사 묶음) + 전체 해제: 묶음을 고르면 아래 칸이 그 묶음 공사로 바뀜
        // 드롭다운에는 지금 고른 공사와 똑같은 묶음이 보이고, 아니면 '묶음 고르기'. 고른 게 없으면 전체 해제는 흐리게
        (function () {
          var sets = (CATALOG.sets || []).filter(function (st) { return setKeys(st).length; });
          var keysNow = doc.cats.map(function (c) { return c.key; }).sort().join('|');
          var cur = sets.filter(function (st) { return setKeys(st).slice().sort().join('|') === keysNow; })[0];
          var clr = '<button type="button" class="btn btn-outline est-clear" data-clearcats' + (doc.cats.length ? '' : ' disabled') + '>전체 해제</button>';
          if (!sets.length) return '<div class="est-sets est-sets-r only">' + clr + '</div>';
          // 드롭다운은 휴대폰 기본 창 대신 자체 목록 (K.dsel — 묶음 이름 아래 'n가지')
          return '<div class="est-sets"><span class="label" id="est-cset-l">묶음으로 한 번에 고르기</span><div class="est-sets-r">' +
            K.dsel('est-cset', sets.map(function (st) { return { v: st.id, t: st.name || '이름 없는 묶음', sub: setKeys(st).length + '가지' }; }), cur ? cur.id : '', { ph: '묶음 고르기', labelledby: 'est-cset-l' }) +
            clr + '</div></div>';
        })() +
        '<div class="est-cboxes" role="group" aria-label="공사 항목">' + CATALOG.cats.map(function (c) {
          return '<label class="est-cbox' + (picked[c.key] ? ' on' : '') + '"><input type="checkbox" data-pickc="' + esc(c.key) + '"' + (picked[c.key] ? ' checked' : '') + '><span class="ph-box" aria-hidden="true">' + I.check + '</span><span class="pk-t">' + esc(c.name) + '</span></label>';
        }).join('') + custom.map(function (c) {
          return '<label class="est-cbox on"><input type="checkbox" data-pickc="' + esc(c.key) + '" checked><span class="ph-box" aria-hidden="true">' + I.check + '</span><span class="pk-t">' + esc(c.name) + '</span></label>';
        }).join('') + '</div>' +
        '<div class="est-addcat"><input class="input" id="new-cat" maxlength="30" placeholder="목록에 없는 공사 (예: 방범창)"><button type="button" class="btn btn-outline" data-addcat>' + I.plus + '항목 추가</button></div>' +
        // 지금 고른 공사를 묶음으로 저장 (계약서 '지금 순서를 묶음으로 저장'과 같은 자리·모양) — 공사를 하나라도 골랐을 때만 (목록에 없는 공사도 같이 저장)
        (doc.cats.length ? '<button type="button" class="btn-link est-setsave" data-esetsave>지금 고른 공사를 묶음으로 저장</button>' : '') +
        '</div>';
    }
    // 평수별 수량 프리셋 (견적서 설정에 평형을 만들어 둔 경우에만)
    function validLine() { var v = Math.max(1, Math.round(num(doc.validDays)) || 7); return '견적서에는 “견적일로부터 ' + v + '일 (' + kDate(addDays(doc.date, v)) + '까지)”로 들어가요.'; }
    function presetField() {
      var ps = CATALOG.presets || [];
      if (!ps.length) return '';
      var cur = pickPreset(doc);
      return '<div class="field"><label for="f-preset">평수별 수량</label><select class="select" id="f-preset" data-bind="preset">' +
        '<option value="auto"' + (!doc.preset || doc.preset === 'auto' ? ' selected' : '') + '>평수에 맞춰 자동</option>' +
        ps.slice().sort(function (a, b) { return num(a.size) - num(b.size); }).map(function (p) {
          return '<option value="' + esc(p.id) + '"' + (doc.preset === p.id ? ' selected' : '') + '>' + esc(presetLabel(p)) + '</option>';
        }).join('') + '<option value="none"' + (doc.preset === 'none' ? ' selected' : '') + '>쓰지 않기</option></select>' +
        '<p class="hint" id="preset-hint">' + presetHint(cur) + '</p></div>';
    }
    function presetHint(cur) {
      return cur ? '<b>' + esc(presetLabel(cur)) + '</b> 수량으로 넣어요. <button type="button" class="est-link" data-reqty>이미 넣은 줄 수량도 다시 맞추기</button>'
        : (doc.preset === 'none' ? '평수별 수량을 쓰지 않아요.' : '평수를 적으면 가장 가까운 평형 수량이 들어가요.');
    }
    function fld(path, label, val, o) {
      o = o || {};
      var id = 'f-' + path.replace(/\./g, '-');
      var input = '<input class="input" id="' + id + '" data-bind="' + path + '" value="' + esc(val == null ? '' : val) + '"' +
        (o.type ? ' type="' + o.type + '"' : ' type="text"') + (o.mode ? ' inputmode="' + o.mode + '"' : '') + (o.max ? ' maxlength="' + o.max + '"' : '') +
        (o.ph ? ' placeholder="' + esc(o.ph) + '"' : '') + (o.type === 'tel' ? ' autocomplete="off"' : '') + '>';
      return '<div class="field' + (o.wide ? ' est-wide' : '') + '"><label for="' + id + '">' + esc(label) + '</label>' +
        (o.suffix ? '<div class="est-suffix">' + input + '<span>' + esc(o.suffix) + '</span></div>' : input) +
        (o.hint ? '<p class="hint">' + o.hint + '</p>' : '') + '</div>';
    }
    function setPath(path, v) {
      var parts = path.split('.'), o = doc;
      for (var i = 0; i < parts.length - 1; i++) o = o[parts[i]] = o[parts[i]] || {};
      o[parts[parts.length - 1]] = v;
    }
    // 다시 그려도 화면 위치와 누른 칸을 그대로 (체크박스로 고를 때 화면이 튀지 않게)
    function rerenderKeep(key) {
      var y = window.scrollY; render(); window.scrollTo(0, y);
      var cb = key && $('[data-pickc="' + key + '"]', page); if (cb) cb.focus({ preventScroll: true });
    }
    function pick(key, on) {
      var has = doc.cats.filter(function (c) { return c.key === key; })[0];
      if (on && !has) { doc.cats.push(catOf(key, null, pickPreset(doc))); doc.cats = sortCats(doc.cats, doc.catOrder); dirty(); rerenderKeep(key); return; }
      if (!on && has) {
        var n = has.lines.filter(function (l) { return !isEmptyLine(l); }).length;
        (n ? K.ask({ title: '‘' + has.name + '’을 뺄까요?', text: '이 공사에 적어 둔 <b>' + n + '줄</b>이 함께 지워져요.', cancel: '그대로 두기', ok: '빼기', okClass: 'btn-danger' }) : Promise.resolve(true))
          .then(function (ok) { if (ok) { doc.cats = doc.cats.filter(function (c) { return c !== has; }); dirty(); } rerenderKeep(key); });
        return;
      }
      rerenderKeep(key);
    }
    // 고른 공사를 keys 로 통째로 바꿈 (묶음 드롭다운 · 전체 해제) — 남는 공사는 적어 둔 줄 그대로, 빠지는 공사에 적어 둔 줄이 있으면 물어봄
    function setCats(keys, title) {
      var pr = pickPreset(doc), full = function (c) { return c.lines.filter(function (l) { return !isEmptyLine(l); }).length; };
      var lost = doc.cats.filter(function (c) { return keys.indexOf(c.key) < 0 && full(c); });   // 빠지면서 적어 둔 줄이 지워지는 공사만 이름을 보여 줌
      var n = lost.reduce(function (s, c) { return s + full(c); }, 0);
      (n ? K.ask({ title: title, text: '<b>' + lost.map(function (c) { return esc(c.name); }).join(', ') + '</b>에 적어 둔 <b>' + n + '줄</b>이 함께 지워져요.', cancel: '그대로 두기', ok: '빼기', okClass: 'btn-danger' }) : Promise.resolve(true))
        .then(function (ok) {
          if (ok) {
            doc.cats = doc.cats.filter(function (c) { return keys.indexOf(c.key) >= 0; });
            keys.forEach(function (k) { if (!doc.cats.some(function (c) { return c.key === k; })) doc.cats.push(catOf(k, null, pr)); });
            doc.catOrder = null;   // 공사 항목 목록 순서로
            doc.cats = sortCats(doc.cats, doc.catOrder); dirty();
          }
          var y = window.scrollY; render(); window.scrollTo(0, y);
        });
    }

    // 지금 고른 공사를 공사 묶음으로 저장 (견적서 설정 → 공사 묶음에 바로 들어감). 같은 이름이 있으면 바꿀지 물어봄
    // 목록에 없는 공사(이 견적서에서 직접 넣은 것)도 같이 저장 — 견적서 설정 '공사 항목' 목록에 새 공사로 넣고(이 견적서에 적은 세부 항목을
    // 기본 항목으로 · 수량은 빼고) 묶음에 넣음. 이 견적서의 그 공사도 새 항목으로 이어 둠 (2026-10-26)
    function saveAsSet() {
      if (!doc.cats.length) { K.notice('공사 항목을 먼저 골라 주세요'); return; }
      var custom = doc.cats.filter(function (c) { return !CAT[c.key]; });
      var pr = K.ask({ title: '지금 고른 공사를 묶음으로 저장', text: '이름을 붙여 두면 다음 견적서에서 한 번에 고를 수 있어요.<br><input class="input ps-name-in" id="es-name-in" maxlength="20" placeholder="예) 욕실 리모델링" aria-label="공사 묶음 이름">' +
        '<small class="ps-name-sub">' + esc(doc.cats.map(function (c) { return c.name; }).join(', ')) + ' (' + doc.cats.length + '가지)' +
        (custom.length ? '<br>목록에 없던 공사(' + esc(custom.map(function (c) { return c.name; }).join(', ')) + ')는 견적서 설정의 공사 항목에도 새로 넣어요.' : '') + '</small>', cancel: '그만두기', ok: '저장' });
      var pin = document.getElementById('es-name-in'); if (pin) setTimeout(function () { pin.focus(); }, 60);
      return pr.then(function (ok) {
        var nm = pin ? pin.value.trim().slice(0, 20) : '';
        if (!ok) return;
        if (!nm) { K.notice('이름을 적어야 저장돼요', '이름을 적고 다시 눌러 주세요.'); return; }
        return loadCatalog(true).then(function () {
          var cfg = JSON.parse(JSON.stringify(CATALOG)); cfg.cats.forEach(function (c) { delete c.order; });
          var list = cfg.sets = Array.isArray(cfg.sets) ? cfg.sets : [];
          var at = list.findIndex(function (x) { return x && String(x.name || '').trim() === nm; });
          var go = function () {
            // 목록에 없던 공사 → 공사 항목 목록에 (같은 이름이 이미 있으면 그 항목을 씀)
            var remap = [];
            doc.cats.forEach(function (c) {
              if (cfg.cats.some(function (x) { return x.key === c.key; })) return;
              var same = cfg.cats.filter(function (x) { return String(x.name || '').trim() === String(c.name || '').trim(); })[0];
              if (same) { remap.push([c, same.key, null]); return; }
              var key = 'c-' + uid(), items = [];
              c.lines.filter(function (l) { return String(l.name || '').trim(); }).forEach(function (l) {
                var it = { id: uid(), name: String(l.name).trim().slice(0, 60), spec: String(l.spec || '').slice(0, 60), unit: String(l.unit || '').slice(0, 8), price: num(l.price) ? String(num(l.price)) : '', qty: '', kind: 'default' };
                items.push(it); l.itemId = it.id;
              });
              if (!items.length) items.push({ id: uid(), name: c.name, spec: '', unit: '식', price: '', qty: '1', kind: 'default' });
              cfg.cats.push({ key: key, name: String(c.name || '').trim().slice(0, 30) || '이름 없는 공사', total: false, items: items });
              remap.push([c, key, items]);
            });
            var keys = doc.cats.map(function (c) { var r = remap.filter(function (x) { return x[0] === c; })[0]; return r ? r[1] : c.key; });
            if (at >= 0) list[at].keys = keys; else list.push({ id: uid(), name: nm, keys: keys });
            cfg.updated_at = new Date().toISOString();
            return DB.saveAdminSetting('estimate_catalog', cfg).then(function () {
              setCatalog(JSON.parse(JSON.stringify(cfg))); catalogP = Promise.resolve(CATALOG);
              if (remap.length) { remap.forEach(function (r) { r[0].key = r[1]; delete r[0].added; }); doc.cats = sortCats(doc.cats, doc.catOrder); dirty(); }   // 이 견적서의 그 공사도 새 항목으로
              var y = window.scrollY; render(); window.scrollTo(0, y);
              K.toast('‘' + nm + '’ 공사 묶음을 저장했어요');
            });
          };
          if (at >= 0) return K.ask({ title: '같은 이름이 있어요', text: '<b>' + esc(nm) + '</b> 묶음을 지금 고른 공사로 바꿀까요?', cancel: '그만두기', ok: '바꾸기' }).then(function (y) { if (y) return go(); });
          return go();
        }).catch(function (err) { fail('저장하지 못했어요', err); });
      });
    }

    /* ----- 2) 공사 항목별 ----- */
    function catHtml(idx) {
      var c = doc.cats[idx], info = CAT[c.key], total = steps().length - 2;
      var t = calc(doc);
      if (!c.lines.length) c.lines.push(newLine());
      return '<div class="est-cat-head"><p class="est-count">' + (idx + 1) + ' / ' + total + '</p><h2 class="est-h">' + esc(c.name) + '</h2>' +
        '<button type="button" class="est-drop" data-dropcat>' + I.trash + '<span>이 공사 빼기</span></button></div>' +
        (info && info.items.length ? '<div class="est-quick"><span>세부 항목 — 누르면 한 줄이 생겨요' + (pickPreset(doc) ? ' (' + esc(presetLabel(pickPreset(doc))) + ' 수량)' : '') + '</span><div class="est-chips">' + info.items.map(function (it, i) {
          return '<button type="button" class="est-chip" data-quick="' + i + '">' + I.plus + esc(it.name) + (num(it.price) ? '<small>' + won(num(it.price)) + '</small>' : '') + '</button>';
        }).join('') + '</div></div>' : '<p class="hint est-quick">자주 쓰는 세부 항목과 단가는 <a href="#/estimates/settings">견적서 설정</a>에서 미리 넣어 둘 수 있어요.</p>') +
        '<div class="est-lines">' + c.lines.map(function (l, i) { return lineHtml(l, i); }).join('') + '</div>' +
        '<button type="button" class="btn btn-outline est-addline" data-addline>' + I.plus + '항목 추가</button>' +
        '<div class="est-catsum"><span>' + esc(c.name) + ' 합계</span><b data-cat-sum="' + idx + '">' + won(t.cats[idx].sum) + '원</b></div>' +
        '<datalist id="est-units">' + UNITS.map(function (u) { return '<option value="' + u + '">'; }).join('') + '</datalist>';
    }
    function lineHtml(l, i) {
      var amt = lineAmount(l);
      return '<div class="est-line" data-line="' + i + '">' +
        '<div class="est-line-top"><span class="est-ln">' + (i + 1) + '</span><input class="input" data-l="name" value="' + esc(l.name) + '" maxlength="60" placeholder="품명 (예: 실크 벽지)" aria-label="품명">' +
        '<button type="button" class="est-x" data-delline aria-label="이 줄 지우기">' + I.trash + '</button></div>' +
        '<div class="est-line-grid">' +
        '<label><span>규격·자재</span><input class="input" data-l="spec" value="' + esc(l.spec) + '" maxlength="60" placeholder="예) LG 베스띠"></label>' +
        '<label><span>단위</span><input class="input" data-l="unit" value="' + esc(l.unit) + '" maxlength="8" list="est-units" placeholder="식"></label>' +
        '<label><span>수량</span><input class="input" data-l="qty" value="' + esc(l.qty) + '" inputmode="decimal" maxlength="10" placeholder="0"></label>' +
        '<label><span>단가 (원)</span><input class="input" data-l="price" value="' + esc(l.price ? won(num(l.price)) : '') + '" inputmode="numeric" maxlength="15" placeholder="0"></label>' +
        '</div>' +
        '<div class="est-line-foot"><input class="input est-note" data-l="note" value="' + esc(l.note) + '" maxlength="80" placeholder="비고 (선택)" aria-label="비고">' +
        '<div class="est-amt"><span>금액</span><b data-amt>' + won(amt) + '원</b><small data-man>' + manHint(amt) + '</small></div></div>' +
        '</div>';
    }
    function manHint(n) {
      if (n < 10000) return '';
      var eok = Math.floor(n / 100000000), man = Math.floor((n % 100000000) / 10000), rest = n % 10000;
      return '= ' + (eok ? eok + '억 ' : '') + (man ? man.toLocaleString('ko-KR') + '만' : '') + (rest ? ' ' + rest.toLocaleString('ko-KR') : '') + '원';
    }

    /* ----- 3) 마무리 ----- */
    function finishHtml() {
      var t = calc(doc);
      return '<h2 class="est-h">마무리</h2>' +
        '<div class="txt-card est-card"><p class="est-sub">공사 항목별 합계 — 누르면 그 단계로 가요</p>' +
        (doc.cats.length ? '<ul class="est-sumlist">' + doc.cats.map(function (c, i) {
          return '<li><button type="button" data-step="' + (i + 1) + '"><span>' + (i + 1) + '. ' + esc(c.name) + (t.cats[i].sum ? '' : ' <em>금액 없음</em>') + '</span><b>' + won(t.cats[i].sum) + '원</b></button></li>';
        }).join('') + '</ul>' : '<p class="hint">아직 고른 공사 항목이 없어요. <b>기본 정보</b>에서 골라 주세요.</p>') +
        '</div>' +
        '<div class="txt-card est-card">' +
        '<label class="est-check"><input type="checkbox" id="oh-on"' + (doc.overhead.on ? ' checked' : '') + '><span>현장관리비·공과잡비 넣기</span></label>' +
        '<div class="est-suffix est-rate"' + (doc.overhead.on ? '' : ' hidden') + '><input class="input" id="oh-rate" inputmode="decimal" maxlength="5" value="' + esc(doc.overhead.rate) + '" placeholder="예) 5" aria-label="현장관리비 비율"><span>%</span></div>' +
        '<div class="field"><label for="disc">할인 (원)</label><input class="input" id="disc" inputmode="numeric" maxlength="15" value="' + esc(doc.discount ? won(num(doc.discount)) : '') + '" placeholder="없으면 비워 두세요"></div>' +
        '<div class="field"><label for="round">끝자리 정리</label><select class="select" id="round">' +
        [['none', '안 함'], ['1000', '천원 단위 버림'], ['10000', '만원 단위 버림']].map(function (o) { return '<option value="' + o[0] + '"' + (doc.round === o[0] ? ' selected' : '') + '>' + o[1] + '</option>'; }).join('') + '</select></div>' +
        '<div class="field"><span class="label">부가세</span><div class="choices">' +
        [['excluded', '부가세 별도라고 적기'], ['add', '10% 더해서 합계'], ['none', '적지 않기']].map(function (o) {
          return '<label class="choice"><input type="radio" name="vat" value="' + o[0] + '"' + (doc.vat === o[0] ? ' checked' : '') + '><span>' + o[1] + '</span></label>';
        }).join('') + '</div></div>' +
        '<div class="est-break" id="est-break"></div>' +
        '</div>' +
        '<div class="txt-card est-card">' +
        '<div class="field"><label for="pay">결제 조건 <span class="opt">(선택)</span></label><textarea class="textarea" id="pay" rows="2" maxlength="300" placeholder="예) 계약금 30% · 중도금 40% · 잔금 30%">' + esc(doc.payment) + '</textarea></div>' +
        '<div class="field"><label for="notes">특기사항</label><textarea class="textarea" id="notes" rows="4" maxlength="1500">' + esc(doc.notes) + '</textarea><p class="hint">한 줄에 하나씩 적으면 견적서에 줄마다 나눠서 들어가요.</p></div>' +
        '</div>' +
        '<div class="txt-card est-card">' +
        '<label class="est-check"><input type="checkbox" id="conf-on"' + (doc.confidential.on ? ' checked' : '') + '><span>외부 유출 금지 문구 넣기</span></label>' +
        '<textarea class="textarea" id="conf-text" rows="2" maxlength="200"' + (doc.confidential.on ? '' : ' hidden') + '>' + esc(doc.confidential.text) + '</textarea>' +
        '<p class="hint">켜 두면 견적서 아래와 워드 파일 모든 쪽 아래에 이 문구가 들어가요.</p>' +
        '</div>';
    }
    function drawBreakdown() {
      var box = $('#est-break', page); if (!box) return;
      var t = calc(doc), m = model(doc, rec);
      var rows = [['공사비 합계', t.sum]];
      if (t.overhead) rows.push(['현장관리비·공과잡비 (' + num(doc.overhead.rate) + '%)', t.overhead]);
      if (t.discount) rows.push(['할인', -t.discount]);
      if (t.roundAdj) rows.push(['끝자리 정리', t.roundAdj]);
      if (t.overhead || t.discount || t.roundAdj || doc.vat === 'add') rows.push(['공급가액', t.supply]);
      if (doc.vat === 'add') rows.push(['부가세 (10%)', t.vat]);
      box.innerHTML = '<table>' + rows.map(function (r) { return '<tr><th>' + esc(r[0]) + '</th><td>' + won(r[1]) + '원</td></tr>'; }).join('') +
        '<tr class="grand"><th>견적 금액' + (doc.vat === 'excluded' ? ' (부가세 별도)' : '') + '</th><td>' + won(t.total) + '원</td></tr></table>' +
        '<p class="est-words">' + esc(m.amountWords) + '</p>';
    }

    /* ----- 4) 미리보기·받기 ----- */
    function previewHtml() {
      var m = model(doc, rec);
      var empty = m.cats.filter(function (c) { return !c.lines.length; }).map(function (c) { return c.name; });
      return '<h2 class="est-h">미리보기·받기</h2>' +
        (empty.length ? '<div class="tip warn">' + I.info + '<span>적은 항목이 없는 공사: <b>' + esc(empty.join(', ')) + '</b> — 견적서에는 금액 0원으로 들어가요.</span></div>' : '') +
        '<label class="switch-row est-detail-sw"><span class="txt"><b>세부 내역 넣기</b><small>끄면 품명·수량·단가 없이 <b>공사 항목별 합계</b>만 들어가요. 미리보기·인쇄·엑셀·워드 모두 같아요.</small></span>' +
        '<input type="checkbox" id="show-detail"' + (doc.showDetail !== false ? ' checked' : '') + '><span class="switch" aria-hidden="true"></span></label>' +
        '<div class="est-dl">' +
        '<button type="button" class="btn btn-primary" data-dl="xlsx">' + I.doc + '엑셀 파일로 받기</button>' +
        '<button type="button" class="btn btn-primary" data-dl="docx">' + I.doc + '워드 파일로 받기</button>' +
        '<button type="button" class="btn btn-outline" data-print>인쇄하기</button>' +
        '</div>' +
        (window.ContractKit ? '<button type="button" class="btn btn-outline est-to-ctr" data-toctr>' + I.sign + '이 견적서로 계약서 만들기</button>' : '') +
        '<div class="est-paper"><div class="est-pages" id="est-pages"></div></div>';
    }

    /* ----- 그리기 ----- */
    function render() {
      var list = steps();
      if (step >= list.length) step = list.length - 1;
      var cur = list[step];
      var inner = cur.id === 'info' ? infoHtml() : cur.id === 'cat' ? catHtml(cur.idx) : cur.id === 'finish' ? finishHtml() : previewHtml();
      page.innerHTML = frameHtml(inner);
      if (cur.id === 'finish') drawBreakdown();
      if (cur.id === 'preview') drawPages();
      if (cur.id === 'info') K.blacklistCheck(doc.customer.phone, $('#bl-slot', page));
      var on = $('.est-step.on', page);
      if (on && on.scrollIntoView) { var nav = on.parentNode; nav.scrollLeft = on.offsetLeft - 16; }
    }

    // 휴대폰에서는 A4 모양 견적서를 화면 폭에 맞게 줄여서 보여 줌 (인쇄·파일에는 영향 없음)
    function fitPaper() {
      var paper = $('.est-paper', page), d = $('.est-pages', page);
      if (!paper || !d) return;
      d.style.zoom = '';
      var cs = getComputedStyle(paper);
      var avail = paper.clientWidth - parseFloat(cs.paddingLeft) - parseFloat(cs.paddingRight), need = d.offsetWidth;
      if (need > avail && avail > 0) d.style.zoom = String(Math.max(0.3, avail / need));
    }
    // A4 쪽으로 나눈 미리보기 (글꼴을 다 불러온 뒤 재야 쪽 나눔이 정확함)
    function drawPages() {
      var box = $('#est-pages', page); if (!box) return;
      var go2 = function () {
        if (!box.isConnected) return;
        box.innerHTML = paginate(model(doc, rec));
        var n = box.children.length, info = $('#est-pagecount', page);
        if (info) info.textContent = 'A4 ' + n + '쪽';
        fitPaper();
      };
      if (document.fonts && document.fonts.ready) document.fonts.ready.then(go2); else go2();
    }
    window.addEventListener('resize', function () { if (page.isConnected && steps()[step].id === 'preview') fitPaper(); });

    /* ----- 입력 ----- */
    var blT = null;
    page.addEventListener('input', function (e) {
      var el = e.target, cur = steps()[step];
      var b = el.getAttribute('data-bind');
      if (b) {
        setPath(b, b === 'staff' ? +el.value : el.value); dirty();
        if (b === 'date' || b === 'validDays') { var vu = $('#valid-until', page); if (vu) vu.textContent = validLine(); }
        if (b === 'preset' || b === 'site.size') { var ph = $('#preset-hint', page); if (ph) ph.innerHTML = presetHint(pickPreset(doc)); }
        if (b === 'customer.phone') { clearTimeout(blT); blT = setTimeout(function () { K.blacklistCheck(doc.customer.phone, $('#bl-slot', page)); }, 400); }
        return;
      }
      var lk = el.getAttribute('data-l');
      if (lk && cur.id === 'cat') {
        var row = el.closest('[data-line]'), li = +row.getAttribute('data-line'), line = doc.cats[cur.idx].lines[li];
        line[lk] = lk === 'price' ? String(num(el.value) || '') : el.value;
        if (lk === 'qty' || lk === 'price') {
          var a = lineAmount(line);
          $('[data-amt]', row).textContent = won(a) + '원';
          $('[data-man]', row).textContent = manHint(a);
        }
        dirty(); refreshTotals();
        return;
      }
      if (cur.id === 'finish') {
        if (el.id === 'oh-rate') doc.overhead.rate = el.value;
        if (el.id === 'disc') doc.discount = String(num(el.value) || '');
        if (el.id === 'pay') doc.payment = el.value;
        if (el.id === 'notes') doc.notes = el.value;
        if (el.id === 'conf-text') doc.confidential.text = el.value;
        dirty(); refreshTotals();
      }
    });
    page.addEventListener('change', function (e) {
      var el = e.target, cur = steps()[step];
      if (el.name === 'est-staff') { doc.staff = +el.value; dirty(); }
      if (el.hasAttribute('data-pickc')) { pick(el.getAttribute('data-pickc'), el.checked); return; }
      if (el.id === 'est-cset') {   // 공사 묶음 드롭다운: 고른 묶음의 공사로 바꿈 ('묶음 고르기'를 다시 고르면 그대로)
        var st = (CATALOG.sets || []).filter(function (z) { return z.id === el.value; })[0];
        if (st) setCats(setKeys(st), '‘' + (st.name || '묶음') + '’으로 바꿀까요?'); else rerenderKeep();
        return;
      }
      if (el.id === 'show-detail') { doc.showDetail = el.checked; dirty(); drawPages(); K.toast(el.checked ? '세부 내역을 넣었어요' : '세부 내역을 뺐어요 · 공사 항목별 합계만 들어가요'); return; }
      if (cur.id === 'finish') {
        if (el.id === 'oh-on') { doc.overhead.on = el.checked; $('.est-rate', page).hidden = !el.checked; if (el.checked) $('#oh-rate', page).focus(); }
        if (el.id === 'round') doc.round = el.value;
        if (el.name === 'vat') doc.vat = el.value;
        if (el.id === 'conf-on') { doc.confidential.on = el.checked; $('#conf-text', page).hidden = !el.checked; }
        dirty(); refreshTotals();
      }
    });
    // 금액 칸은 칸을 벗어나면 1,000 단위 쉼표로
    page.addEventListener('focusout', function (e) {
      var el = e.target;
      if (el.getAttribute('data-l') === 'price' || el.id === 'disc') { var n = num(el.value); el.value = n ? won(n) : ''; }
    });
    page.addEventListener('focusin', function (e) {
      var el = e.target;
      if (el.getAttribute('data-l') === 'price' || el.id === 'disc') { var n = num(el.value); el.value = n ? String(Math.round(n)) : ''; }
    });
    page.addEventListener('keydown', function (e) {
      if (e.key === 'Enter' && e.target.id === 'new-cat') { e.preventDefault(); addCat(); }
    });
    function addCat() {
      var inp = $('#new-cat', page), name = String(inp.value || '').trim().slice(0, 30);
      if (!name) { inp.focus(); return; }
      var exist = doc.cats.filter(function (c) { return c.name === name; })[0];
      if (exist) { K.notice('이미 있는 항목이에요'); return; }
      var cat = CATALOG.cats.filter(function (c) { return c.name === name; })[0];
      if (cat) { pick(cat.key, true); return; }
      var c = catOf('custom-' + Date.now().toString(36), name);
      c.added = doc.cats.filter(function (x) { return !CAT[x.key]; }).length;
      doc.cats.push(c); doc.cats = sortCats(doc.cats, doc.catOrder); dirty(); render();
      K.toast('‘' + name + '’ 항목을 넣었어요');
    }
    page.addEventListener('click', function (e) {
      var t = e.target, cur = steps()[step], x;
      if ((x = t.closest('[data-step]'))) return go(+x.getAttribute('data-step'));
      if (t.closest('[data-next]')) return go(step + 1);
      if (t.closest('[data-prev]')) return go(step - 1);
      if (t.closest('[data-save]')) return save(true).then(function () {}, function () {});   // 단추 글자는 그대로 — 저장한 시각은 왼쪽 '저장됨 오전 9:58'
      if (t.closest('[data-finish]')) return save(true).then(function () { K.leave('#/estimates'); }, function () {});
      if (t.closest('[data-estcopy]') && rec.id) return (K.state.dirty ? save(true) : Promise.resolve()).then(function () { K.go('#/estimate/copy/' + encodeURIComponent(rec.id)); }, function () {});
      if ((x = t.closest('[data-pick]'))) return pick(x.getAttribute('data-pick'), !x.classList.contains('on'));
      if ((x = t.closest('[data-unpick]'))) return pick(x.getAttribute('data-unpick'), false);
      if (t.closest('[data-clearcats]')) return setCats([], '고른 공사를 모두 뺄까요?');   // 전체 해제
      if (t.closest('[data-esetsave]')) return saveAsSet();   // 지금 고른 공사를 묶음으로 저장
      if (t.closest('[data-addcat]')) return addCat();
      if (t.closest('[data-reqty]')) {
        var pr2 = pickPreset(doc); if (!pr2) return;
        var n = 0;
        doc.cats.forEach(function (c) {
          var info = CAT[c.key]; if (!info) return;
          c.lines.forEach(function (l) {
            var it = l.itemId && info.items.filter(function (x) { return x.id === l.itemId; })[0];
            if (!it) return;
            var q = presetQty(it, pr2);
            if (q !== '' && q != null && String(q) !== String(l.qty)) { l.qty = String(q); n++; }
          });
        });
        dirty(); render();
        return n ? K.toast(presetLabel(pr2) + ' 수량으로 ' + n + '줄을 바꿨어요') : K.notice('바꿀 수량이 없어요');
      }
      if (cur.id === 'cat') {
        var c = doc.cats[cur.idx];
        if ((x = t.closest('[data-quick]'))) {
          var it = CAT[c.key].items[+x.getAttribute('data-quick')], nl = newLine(it, pickPreset(doc));
          // 맨 끝 줄이 비어 있으면 그 줄을 채움
          var last = c.lines[c.lines.length - 1];
          if (last && isEmptyLine(last) && !last.unit) c.lines[c.lines.length - 1] = nl; else c.lines.push(nl);
          dirty(); render(); focusLine(c.lines.length - 1, !nl.qty ? 'qty' : !nl.price ? 'price' : null);
          return;
        }
        if (t.closest('[data-addline]')) { c.lines.push(newLine()); dirty(); render(); focusLine(c.lines.length - 1, 'name'); return; }
        if ((x = t.closest('[data-delline]'))) {
          var li = +x.closest('[data-line]').getAttribute('data-line'), line = c.lines[li];
          (isEmptyLine(line) ? Promise.resolve(true) : K.ask({ title: '이 줄을 지울까요?', text: esc(line.name || '이름 없는 항목') + ' · ' + won(lineAmount(line)) + '원', cancel: '그대로 두기', ok: '지우기', okClass: 'btn-danger' }))
            .then(function (ok) { if (!ok) return; c.lines.splice(li, 1); dirty(); render(); });
          return;
        }
        if (t.closest('[data-dropcat]')) return pick(c.key, false);
      }
      if ((x = t.closest('[data-dl]'))) return download(x.getAttribute('data-dl'), x);
      if (t.closest('[data-toctr]')) {
        return (K.state.dirty || !rec.id ? save(true) : Promise.resolve()).then(function () { K.go('#/contract/new/e/' + encodeURIComponent(rec.id)); }, function () {});
      }
      if (t.closest('[data-print]')) {
        return (K.state.dirty || !rec.id ? save(true) : Promise.resolve()).then(function () { window.print(); }, function () {});
      }
    });
    function focusLine(i, key) {
      var row = $('[data-line="' + i + '"]', page), el = key && row && $('[data-l="' + key + '"]', row);
      if (el) setTimeout(function () { K.focusNear(el); }, 30);
      else if (row) row.scrollIntoView({ block: 'nearest' });
    }

    /* ----- 파일 받기 ----- */
    function download(kind, btn) {
      btn.disabled = true;
      var label = btn.lastChild.textContent;
      btn.lastChild.textContent = '만드는 중…';
      var done = function () { btn.disabled = false; btn.lastChild.textContent = label; };
      (K.state.dirty || !rec.id ? save(true) : Promise.resolve()).then(function () { return Promise.all([loadExport(), loadLogo()]); }).then(function (r) {
        var X = r[0], m = model(doc, rec);
        m.logo = r[1];
        var blob = kind === 'xlsx' ? X.xlsx(m) : X.docx(m);
        // 파일 이름은 견적번호로 (예: MD-20261025-01.xlsx). 한글 이름은 브라우저에 따라 'download'로 바뀌어
        // 확장자가 사라지는 경우가 있어(시험 환경에서 확인) 영문·숫자만 씀
        var base = String(m.no || '').replace(/[^A-Za-z0-9_-]+/g, '').replace(/^-+|-+$/g, '');
        var name = (base || 'estimate-' + String(m.date || '').replace(/-/g, '')) + '.' + kind;
        var url = URL.createObjectURL(blob), a = document.createElement('a');
        a.href = url; a.download = name; document.body.appendChild(a); a.click(); a.remove();
        setTimeout(function () { URL.revokeObjectURL(url); }, 60000);
        K.toast(name + ' 파일을 받았어요');
      }).catch(function (err) {
        if (err) fail('파일을 만들지 못했어요', err);
      }).then(done);
    }

    render();
  }

  // 견적서 파일에 넣는 로고 그림 (assets/img/logo-estimate.png, 1169×202). 못 불러오면 로고 없이 만듦
  var logoP = null;
  function loadLogo() {
    if (!logoP) {
      logoP = fetch(DB.base + 'assets/img/logo-estimate.png').then(function (res) {
        if (!res.ok) throw new Error('logo');
        return res.arrayBuffer();
      }).then(function (buf) { return { bytes: new Uint8Array(buf), w: 1169, h: 202 }; })
        .catch(function () { logoP = null; return null; });
    }
    return logoP;
  }

  var exportP = null;
  function loadExport() {
    if (window.EstimateExport) return Promise.resolve(window.EstimateExport);
    if (exportP) return exportP;
    exportP = new Promise(function (resolve, reject) {
      var s = document.createElement('script');
      s.src = DB.base + 'assets/js/estimate-export.js';
      s.onload = function () { window.EstimateExport ? resolve(window.EstimateExport) : reject(new Error('파일 만들기 도구를 불러오지 못했어요.')); };
      s.onerror = function () { exportP = null; reject(new Error('인터넷 연결을 확인해 주세요. (파일 만들기 도구를 불러오지 못했어요)')); };
      document.head.appendChild(s);
    });
    return exportP;
  }

  /* ---------- 미리보기·인쇄용 견적서 — A4 쪽으로 나눠서 그림 ----------
     표가 쪽 끝에서 잘리면 다음 쪽에 머리줄을 다시 넣고, 공사 항목 이름·소계가 혼자 떨어지지 않게 나눔 */
  function docParts(m) {
    var t = m.totals, sup = m.supplier;
    var info = [
      ['고객', m.customer.name ? m.customer.name + ' 귀하' : ''], ['연락처', m.customer.phone], ['현장', m.site], ['공사명', m.title],
      ['예상 시공기간', m.period],
    ];   // 현장 다음 공사명 (2026-10-25 대표님 요청). 유효기간은 표 맨 아래 줄(두 칸 다 씀)
    var sp = [
      ['상호', sup.legalName || sup.name],
      ['대표', sup.ceo], ['사업자번호', sup.bizNumber], ['주소', sup.address], ['담당', [sup.staff, sup.email || sup.phone].filter(Boolean).join(' · ')],
    ];
    // 받는 분·공급자를 한 표에 나란히 (줄 높이가 같아져 좌우 상자가 맞음 — 엑셀·워드와 같은 모양)
    function pairRows(a, b) {
      var out = '';
      for (var i = 0; i < Math.max(a.length, b.length); i++) {
        var x = a[i] || ['', ''], y = b[i] || ['', ''];
        out += '<tr><th>' + esc(x[0]) + '</th><td>' + esc(x[1] || '') + '</td><th>' + esc(y[0]) + '</th><td>' + esc(y[1] || '') + '</td></tr>';
      }
      return out;
    }
    var logo = (window.SITE_LOGO && window.SITE_LOGO.horizontal) || '<b>' + esc(sup.name) + '</b>';
    var adj = [];
    if (t.overhead) adj.push(['현장관리비·공과잡비 (' + m.overheadRate + '%)', t.overhead]);
    if (t.discount) adj.push(['할인', -t.discount]);
    if (t.roundAdj) adj.push(['끝자리 정리', t.roundAdj]);
    // 합계부 줄들 (한 줄씩 따로 — 쪽 나눔 때 줄마다 높이를 잼)
    var foot = ['<tr class="tot"><th colspan="2">공사비 합계</th><td class="n">' + won(t.sum) + '</td></tr>']
      .concat(adj.map(function (r) { return '<tr class="tot"><th colspan="2">' + esc(r[0]) + '</th><td class="n">' + won(r[1]) + '</td></tr>'; }))
      .concat(adj.length || m.vatMode === 'add' ? ['<tr class="tot"><th colspan="2">공급가액</th><td class="n">' + won(t.supply) + '</td></tr>'] : [])
      .concat(m.vatMode === 'add' ? ['<tr class="tot"><th colspan="2">부가세 (10%)</th><td class="n">' + won(t.vat) + '</td></tr>'] : [])
      .concat(['<tr class="tot grand"><th colspan="2">견적 금액' + (m.vatMode === 'excluded' ? ' (부가세 별도)' : '') + '</th><td class="n">' + won(t.total) + '</td></tr>']);
    // 유효기간은 위 표 맨 아래 줄에만 (특기사항에 같은 말을 또 쓰지 않음)
    var notes = m.notes.map(function (n) { return '<li>' + esc(n) + '</li>'; }).join('');
    return {
      blocks: [
        '<div class="est-doc-brand"><span class="est-doc-logo">' + logo + '</span><span class="est-doc-meta">' + (m.no ? '견적번호 ' + esc(m.no) + '<br>' : '') + '견적일 ' + esc(m.dateK) + '</span></div><h1>견 적 서</h1>',
        '<table class="kv kv2"><colgroup><col style="width:17%"><col style="width:33%"><col style="width:13%"><col style="width:37%"></colgroup>' +
          '<thead><tr><th colspan="2">받는 분</th><th colspan="2">공급자</th></tr></thead><tbody>' + pairRows(info, sp) +
          (m.validText ? '<tr class="kv-valid"><th>견적 유효기간</th><td colspan="3">' + esc(m.validText) + '</td></tr>' : '') + '</tbody></table>',
        '<div class="est-doc-amount"><span>견적 금액</span><b>' + esc(m.amountWords) + '</b><em>(₩' + won(t.total) + ')</em>' + (m.vatLabel ? '<small>' + esc(m.vatLabel) + '</small>' : '') + '</div>',
      ],
      sections: [
        { title: '공사 항목별 합계', cls: 'grid sum', cols: [8, 62, 30], head: '<tr><th>No</th><th>공사 항목</th><th>금액</th></tr>',
          groups: m.cats.map(function (c) { return { rows: ['<tr><td class="c">' + c.no + '</td><td>' + esc(c.name) + '</td><td class="n">' + won(c.sum) + '</td></tr>'] }; })
            .concat([{ keep: true, rows: foot }]) },
        m.showDetail === false ? null : { title: '세부 내역', cls: 'grid lines', cols: [26, 17, 7, 8, 13, 15, 14],
          head: '<tr><th>품명</th><th>규격·자재</th><th>단위</th><th>수량</th><th>단가</th><th>금액</th><th>비고</th></tr>',
          groups: m.cats.map(function (c) {
            var catRow = '<tr class="cat"><td colspan="7">' + c.no + '. ' + esc(c.name) + '</td></tr>';
            return {
              cat: catRow, cont: '<tr class="cat"><td colspan="7">' + c.no + '. ' + esc(c.name) + ' <small>(이어서)</small></td></tr>',
              rows: [catRow].concat(c.lines.length ? c.lines.map(function (l) {
                return '<tr><td>' + esc(l.name) + '</td><td>' + esc(l.spec) + '</td><td class="c">' + esc(l.unit) + '</td><td class="n">' + esc(l.qtyText) + '</td><td class="n">' + (l.price ? won(l.price) : '') + '</td><td class="n">' + won(l.amount) + '</td><td>' + esc(l.note) + '</td></tr>';
              }) : ['<tr><td colspan="7" class="muted">적은 항목 없음</td></tr>'], ['<tr class="sub"><td colspan="5">소계</td><td class="n">' + won(c.sum) + '</td><td></td></tr>']),
            };
          }).concat([{ keep: true, rows: ['<tr class="sub grand"><td colspan="5">공사비 합계</td><td class="n">' + won(t.sum) + '</td><td></td></tr>'] }]) },
      ].filter(Boolean),
      tail: [
        m.payment ? '<h2>결제 조건</h2><p class="est-doc-text">' + esc(m.payment).replace(/\n/g, '<br>') + '</p>' : '',
        notes ? '<h2>특기사항</h2><ul class="est-doc-notes">' + notes + '</ul>' : '',
        (m.confidential.on && m.confidential.text ? '<p class="est-doc-conf">' + esc(m.confidential.text) + '</p>' : '') +
          '<p class="est-doc-foot">' + esc([sup.slogan, sup.name, sup.domain].filter(Boolean).join('  ·  ')) + '</p>',
      ].filter(Boolean),
      footer: [sup.name, sup.domain].filter(Boolean).join(' · ') + (m.confidential.on ? '  |  외부 유출 금지' : ''),
    };
  }
  function colgroup(cols) { return '<colgroup>' + cols.map(function (w) { return '<col style="width:' + w + '%">'; }).join('') + '</colgroup>'; }
  function tableHtml(sec, rows) { return '<table class="' + sec.cls + '">' + colgroup(sec.cols) + '<thead>' + sec.head + '</thead><tbody>' + rows.join('') + '</tbody></table>'; }

  // 쪽 나누기: 실제 크기(A4, mm)로 숨겨 둔 상자에 그려서 높이를 잰 뒤 쪽마다 채움
  function paginate(m) { return paginateParts(docParts(m)); }
  // P: { blocks, sections, tail, footer } 또는 { flow: [{ block: html } | { section: sec } | { pageBreak: true }], footer }
  //    (계약서처럼 '본문 → 새 쪽에 별첨 표' 순서가 필요한 문서는 flow 로 넘김)
  function paginateParts(P, cls) {
    var flow = P.flow || [].concat(
      P.blocks.map(function (b) { return { block: b }; }),
      P.sections.map(function (sec) { return { section: sec }; }),
      P.tail.map(function (b) { return { block: b }; }));
    var box = document.createElement('div');
    box.className = 'est-doc est-measure' + (cls ? ' ' + cls : '');
    document.body.appendChild(box);
    // 조각(.pc) 하나의 높이. 조각 사이 간격은 GAP(4mm), 쪽 본문 높이는 265mm에서 여유 3mm를 뺌
    function h(html) { box.innerHTML = '<div class="pc">' + html + '</div>'; return box.firstElementChild.getBoundingClientRect().height; }
    // 조각 사이 간격: 기본 4mm (계약서는 조항이 많아 P.gapMm 으로 좁힘 — CSS 의 .pc + .pc 간격과 같아야 함)
    box.innerHTML = '<div style="height:262mm"></div><div style="height:' + (P.gapMm || 4) + 'mm"></div>';
    var PAGE = box.firstElementChild.getBoundingClientRect().height, GAP = box.children[1].getBoundingClientRect().height;
    var pages = [[]], rem = PAGE;
    function newPage() { if (pages[pages.length - 1].length) pages.push([]); rem = PAGE; }
    function put(html, height) { pages[pages.length - 1].push('<div class="pc">' + html + '</div>'); rem -= height + GAP; }
    function block(html) { var bh = h(html); if (bh > rem && pages[pages.length - 1].length) newPage(); put(html, bh); }
    function section(sec) {
      var titleH = sec.title ? h('<h2>' + esc(sec.title) + '</h2><div></div>') : 0;
      // 표의 머리줄·각 줄 높이 재기
      var all = []; sec.groups.forEach(function (g) { all = all.concat(g.rows); if (g.cont) all.push(g.cont); });
      box.innerHTML = '<div class="pc">' + tableHtml(sec, all) + '</div>';
      var headH = box.querySelector('thead').getBoundingClientRect().height;
      var trs = box.querySelectorAll('tbody > tr'), hs = [], k = 0;
      sec.groups.forEach(function (g) {
        g.hs = g.rows.map(function () { return trs[k++].getBoundingClientRect().height; });
        if (g.cont) g.contH = trs[k++].getBoundingClientRect().height;
      });
      var chunk = null, carryTitle = false;
      function openChunk(withTitle) {
        if (chunk) closeChunk();
        withTitle = withTitle || carryTitle; carryTitle = false;
        chunk = { rows: [], title: withTitle };
        rem -= (withTitle ? titleH : 0) + headH;
      }
      function closeChunk() {
        if (!chunk) return;
        // 줄이 하나도 없으면 그리지 않고, 제목은 다음 쪽 표로 넘김
        if (!chunk.rows.length) { carryTitle = carryTitle || chunk.title; chunk = null; return; }
        pages[pages.length - 1].push('<div class="pc">' + (chunk.title && sec.title ? '<h2>' + esc(sec.title) + '</h2>' : '') + tableHtml(sec, chunk.rows) + '</div>');
        rem -= GAP; chunk = null;
      }
      function sum(a, i, j) { var x = 0; for (var n = i; n < j; n++) x += a[n]; return x; }
      // 제목 + 머리줄 + 첫 묶음의 앞 두 줄이 안 들어가면 다음 쪽에서 시작
      var g0 = sec.groups[0], need = titleH + headH + (g0 ? sum(g0.hs, 0, Math.min(2, g0.hs.length)) : 0);
      if (need > rem && pages[pages.length - 1].length) newPage();
      openChunk(true);
      sec.groups.forEach(function (g) {
        var total = sum(g.hs, 0, g.hs.length);
        if (total <= rem) { g.rows.forEach(function (r) { chunk.rows.push(r); }); rem -= total; return; }
        // 묶음 전체가 새 쪽 하나에 들어가면 통째로 다음 쪽으로 (작은 묶음·합계부는 나누지 않음)
        if (total + headH <= PAGE && (g.keep || g.rows.length <= 12 || chunk.rows.length === 0)) {
          closeChunk(); newPage(); openChunk(false);
          g.rows.forEach(function (r) { chunk.rows.push(r); }); rem -= total; return;
        }
        // 긴 묶음은 쪽마다 나눔: 공사 이름 줄이 쪽 끝에 혼자 남지 않게, 소계 줄이 쪽 처음에 혼자 오지 않게
        for (var i = 0; i < g.rows.length; i++) {
          var hi = g.hs[i];
          var last = i === g.rows.length - 1, first = i === 0;
          var needHere = hi + (first && g.rows.length > 1 ? g.hs[1] : 0) + (!last && i === g.rows.length - 2 ? g.hs[i + 1] : 0);
          if (needHere > rem && chunk.rows.length) {
            closeChunk(); newPage(); openChunk(false);
            if (!first && g.cont) { chunk.rows.push(g.cont); rem -= g.contH; }
          }
          chunk.rows.push(g.rows[i]); rem -= hi;
        }
      });
      closeChunk();
    }
    flow.forEach(function (it) {
      if (it.pageBreak) return newPage();
      if (it.section) return section(it.section);
      if (it.block) block(it.block);
    });
    box.remove();
    var n = pages.length;
    return pages.map(function (pg, i) {
      return '<section class="est-sheet"><div class="est-doc est-sheet-body' + (cls ? ' ' + cls : '') + '">' + pg.join('') + '</div>' +
        '<div class="est-sheet-foot"><span>' + esc(P.footer) + '</span><span>' + (i + 1) + ' / ' + n + '</span></div></section>';
    }).join('');
  }
  // 한 장짜리 흐름 (시험·다른 곳에서 쓰는 용도)
  function docHtml(m) {
    var P = docParts(m);
    return '<article class="est-doc">' + P.blocks.join('') + P.sections.map(function (sec) {
      var rows = []; sec.groups.forEach(function (g) { rows = rows.concat(g.rows); });
      return '<h2>' + esc(sec.title) + '</h2>' + tableHtml(sec, rows);
    }).join('') + P.tail.join('') + '</article>';
  }

  /* =====================================================================
     견적서 설정 — 공사 항목·세부 항목(기본/선택, 단위·단가·기본 수량), 평수별 수량, 기본 문구
     관리자만 읽고 쓰는 admin_settings 표의 'estimate_catalog' 에 저장 (단가가 들어 있어 홈페이지 방문자는 못 봄)
     ===================================================================== */
  function viewCatalog() {
    K.frame('견적서 설정', true, 'estimates');
    K.state.backTo = '#/estimates';
    app.innerHTML = '<div class="page"><div class="loading">불러오는 중…</div></div>';
    loadCatalog(true).then(function () {
      var cfg = JSON.parse(JSON.stringify(CATALOG));
      cfg.cats.forEach(function (c) { delete c.order; });
      var tab = 'items', open = {}, sel = null, csSel = 0;   // csSel: 공사 묶음 탭에서 고치는 묶음 (번호)
      var page = document.createElement('div');
      page.className = 'page est-page est-set';
      app.innerHTML = '';
      app.appendChild(page);
      function sorted() { return cfg.presets.slice().sort(function (a, b) { return num(a.size) - num(b.size); }); }
      function dirty() { K.setDirty(true); var sb = $('.set-bar', page); if (sb) sb.hidden = false; }   // 저장 막대는 바꾼 게 있을 때만

      function itemHtml(it, ii) {
        var amt = Math.round(num(it.qty) * num(it.price));
        return '<div class="est-line set-item" data-ii="' + ii + '">' +
          '<div class="est-line-top"><span class="est-ln">' + (ii + 1) + '</span><input class="input" data-if="name" value="' + esc(it.name) + '" maxlength="60" placeholder="품명 (예: 실크 벽지)" aria-label="품명">' +
          '<button type="button" class="est-x" data-idel aria-label="이 세부 항목 지우기">' + I.trash + '</button></div>' +
          '<div class="choices set-kind">' +
          '<label class="choice"><input type="radio" name="k-' + esc(it.id) + '" value="default" data-if="kind"' + (it.kind === 'default' ? ' checked' : '') + '><span>기본 항목</span></label>' +
          '<label class="choice"><input type="radio" name="k-' + esc(it.id) + '" value="option" data-if="kind"' + (it.kind !== 'default' ? ' checked' : '') + '><span>선택 항목</span></label></div>' +
          '<div class="est-line-grid">' +
          '<label><span>규격·자재</span><input class="input" data-if="spec" value="' + esc(it.spec) + '" maxlength="60" placeholder="예) LG 베스띠"></label>' +
          '<label><span>단위</span><input class="input" data-if="unit" value="' + esc(it.unit) + '" maxlength="8" list="est-units" placeholder="식"></label>' +
          '<label><span>기본 수량</span><input class="input" data-if="qty" value="' + esc(it.qty) + '" inputmode="decimal" maxlength="10" placeholder="비워도 됨"></label>' +
          '<label><span>단가 (원)</span><input class="input" data-if="price" value="' + esc(num(it.price) ? won(num(it.price)) : '') + '" inputmode="numeric" maxlength="15" placeholder="0"></label>' +
          '</div>' +
          '<div class="est-line-foot"><div class="set-move"><button type="button" data-imove="-1" aria-label="위로">▲</button><button type="button" data-imove="1" aria-label="아래로">▼</button></div>' +
          '<div class="est-amt"><span>금액 (기본 수량 × 단가)</span><b data-amt>' + won(amt) + '원</b></div></div></div>';
      }
      function itemsHtml() {
        return '<div class="tip">' + I.info + '<span><b>기본 항목</b>은 견적서에서 그 공사를 고르면 바로 한 줄로 들어가요. <b>선택 항목</b>은 버튼으로 보이고 누를 때만 들어가요. 단위·단가·기본 수량을 적어 두면 견적서에 미리 채워져요(견적서마다 고칠 수 있어요).</span></div>' +
          cfg.cats.map(function (c, ci) {
            var d = c.items.filter(function (x) { return x.kind === 'default'; }).length, priced = c.items.filter(function (x) { return num(x.price); }).length;
            return '<details class="set-cat" data-ci="' + ci + '"' + (open[c.key] ? ' open' : '') + '><summary><span class="set-grip cat-grip" data-cgrip title="잡고 끌어서 순서 바꾸기" aria-hidden="true">' + K.GRIP + '</span><span class="t"><b>' + esc(c.name || '이름 없는 공사') + '</b>' +
              '<small>세부 ' + c.items.length + '개 · 기본 ' + d + ' · 단가 ' + priced + '</small></span><span class="chev">' + I.right + '</span></summary>' +
              '<div class="set-cat-in">' +
              '<div class="field"><label>공사 항목 이름</label><input class="input" data-cf="name" value="' + esc(c.name) + '" maxlength="30"></div>' +
              '<div class="set-move set-cat-move"><button type="button" data-cmove="-1">▲ 위로</button><button type="button" data-cmove="1">▼ 아래로</button><button type="button" class="danger" data-cdel>이 공사 항목 지우기</button></div>' +
              '<div class="est-lines">' + c.items.map(itemHtml).join('') + '</div>' +
              '<button type="button" class="btn btn-outline est-addline" data-iadd>' + I.plus + '세부 항목 추가</button>' +
              '</div></details>';
          }).join('') +
          '<div class="est-addcat"><input class="input" id="set-newcat" maxlength="30" placeholder="새 공사 항목 (예: 방범창)"><button type="button" class="btn btn-outline" data-cadd>' + I.plus + '공사 항목 추가</button></div>' +
          '<button type="button" class="est-drop set-reset" data-reset>처음 목록으로 되돌리기</button>' +
          '<datalist id="est-units">' + UNITS.map(function (u) { return '<option value="' + u + '">'; }).join('') + '</datalist>';
      }
      function presetsHtml() {
        var ps = sorted();
        if (!sel || !ps.some(function (p) { return p.id === sel; })) sel = ps.length ? ps[0].id : null;
        var p = ps.filter(function (x) { return x.id === sel; })[0];
        return '<div class="tip">' + I.info + '<span>평형마다 들어가는 수량을 적어 두면, 견적서 <b>기본 정보</b>에 평수를 적었을 때 <b>가장 가까운 평형</b>의 수량이 자동으로 들어가요. 비워 둔 칸은 세부 항목의 <b>기본 수량</b>을 써요.</span></div>' +
          '<div class="est-chips set-psizes">' + ps.map(function (x) {
            return '<button type="button" class="est-chip' + (x.id === sel ? ' on' : '') + '" data-psel="' + esc(x.id) + '">' + esc(presetLabel(x)) + '</button>';
          }).join('') + '</div>' +
          '<div class="est-addcat"><div class="est-suffix"><input class="input" id="set-newsize" inputmode="decimal" maxlength="5" placeholder="평형 (예: 32)"><span>평</span></div>' +
          '<button type="button" class="btn btn-outline" data-padd>' + I.plus + '평형 추가</button></div>' +
          (p ? '<div class="set-phead"><h2 class="est-h">' + esc(presetLabel(p)) + '일 때 수량</h2><button type="button" class="est-drop" data-pdel>이 평형 지우기</button></div>' +
            cfg.cats.filter(function (c) { return c.items.length; }).map(function (c) {
              return '<div class="txt-card set-pcat"><h3>' + esc(c.name) + '</h3>' + c.items.map(function (it) {
                var v = p.qty[it.id];
                return '<label class="set-prow"><span>' + esc(it.name || '이름 없는 항목') + (it.unit ? ' <small>(' + esc(it.unit) + ')</small>' : '') + '</span>' +
                  '<input class="input" data-pq="' + esc(it.id) + '" inputmode="decimal" maxlength="10" value="' + esc(v == null ? '' : v) + '" placeholder="' + esc(it.qty ? '기본 ' + it.qty : '') + '"></label>';
              }).join('') + '</div>';
            }).join('')
            : '<div class="empty-box">아직 만든 평형이 없어요.<br>위에 평형(예: 24, 32, 40)을 적고 <b>평형 추가</b>를 눌러 주세요.</div>');
      }
      // 공사 묶음 (예: 토탈인테리어, 욕실 리모델링, 주방 리모델링) — 계약서 설정 '순서 묶음'처럼 위 드롭다운(자체 목록)으로 고칠 묶음을 고르고,
      // 아래는 견적서 '공사 항목 고르기'와 같은 타일(휴대폰 한 줄 3칸 · PC 4칸): 누르면 이 묶음에 넣기/빼기. 순서는 공사 항목·단가 탭 순서
      function csName(st, i) { return String(st.name || '').trim() || '묶음 ' + (i + 1); }
      function csCount(st) { return st.keys.filter(function (k) { return cfg.cats.some(function (c) { return c.key === k; }); }).length; }
      // 위 드롭다운의 이 묶음 줄(이름 · n가지)을 바로 고침
      function csSync(i) {
        var st = cfg.sets[i], opt = $('#cs-sel', page) && $('.dsel-opt[data-dv="' + i + '"]', page); if (!st || !opt) return;
        opt.setAttribute('data-dt', csName(st, i)); opt.querySelector('.dsel-t').innerHTML = esc(csName(st, i)) + '<small>' + csCount(st) + '가지</small>';
        if (i === csSel) $('#cs-sel-v', page).textContent = csName(st, i);
      }
      function setsHtml() {
        var tip = '<div class="tip">' + I.info + '<span>견적서 <b>공사 항목 고르기</b>의 드롭다운에서 묶음을 고르면 여러 공사가 한 번에 골라져요. 예) 토탈인테리어, 욕실 리모델링. ' +
          '상담 신청에서 <b>토탈인테리어</b>를 고른 손님은 이름이 ‘토탈인테리어’인 묶음(없으면 맨 위 묶음)으로 들어가요.</span></div>';
        if (!cfg.sets.length) return tip + '<button type="button" class="btn btn-outline est-addline" data-sadd>' + I.plus + '묶음 만들기</button>';
        if (csSel >= cfg.sets.length) csSel = cfg.sets.length - 1;
        if (csSel < 0) csSel = 0;
        var si = csSel, st = cfg.sets[si], on = {};
        st.keys.forEach(function (k) { on[k] = true; });
        var n = cfg.cats.filter(function (c) { return on[c.key]; }).length;
        return tip +
          '<div class="txt-card est-card ck-pick"><span class="label ct-label" id="cs-sel-l">고칠 공사 묶음</span>' +
          K.dsel('cs-sel', cfg.sets.map(function (x, i) { return { v: i, t: csName(x, i), sub: csCount(x) + '가지' }; }), si, { labelledby: 'cs-sel-l' }) +
          '<div class="ck-btns"><button type="button" class="btn btn-outline" data-sadd>' + I.plus + '새 묶음 만들기</button>' +
          '<button type="button" class="btn btn-text-danger" data-sdel>이 묶음 지우기</button></div></div>' +
          '<div class="txt-card est-card set-cset" data-si="' + si + '">' +
          '<div class="field"><label for="cs-n">묶음 이름</label><input class="input" id="cs-n" data-sn value="' + esc(st.name) + '" maxlength="20" placeholder="예) 욕실 리모델링"></div>' +
          '<div class="est-cboxes" role="group" aria-label="이 묶음에 넣을 공사">' + cfg.cats.map(function (c) {
            return '<label class="est-cbox' + (on[c.key] ? ' on' : '') + '"><input type="checkbox" data-sk="' + esc(c.key) + '"' + (on[c.key] ? ' checked' : '') + '><span class="ph-box" aria-hidden="true">' + I.check + '</span><span class="pk-t">' + esc(c.name || '이름 없는 공사') + '</span></label>';
          }).join('') + '</div>' +
          '<div class="cset-foot"><span class="hint cs-total">공사 ' + n + '가지</span><div class="set-move"><span class="sm-l">묶음 순서</span><button type="button" data-smove="-1"' + (si === 0 ? ' disabled' : '') + ' aria-label="이 묶음을 드롭다운에서 위로">▲</button><button type="button" data-smove="1"' + (si === cfg.sets.length - 1 ? ' disabled' : '') + ' aria-label="이 묶음을 드롭다운에서 아래로">▼</button></div></div></div>';
      }
      function defaultsHtml() {
        var D = cfg.defaults;
        return '<div class="tip">' + I.info + '<span>새 견적서를 만들 때 처음에 들어가는 값이에요. 견적서마다 따로 고칠 수 있어요.</span></div>' +
          '<div class="txt-card est-card">' +
          '<div class="field"><label for="d-valid">유효기간</label><div class="est-suffix"><input class="input" id="d-valid" data-df="validDays" inputmode="numeric" maxlength="3" value="' + esc(D.validDays || '') + '" placeholder="' + esc(EC.validDays || 7) + '"><span>일</span></div></div>' +
          '<div class="field"><span class="label">부가세</span><div class="choices">' + [['excluded', '부가세 별도라고 적기'], ['add', '10% 더해서 합계'], ['none', '적지 않기']].map(function (o) {
            var curV = D.vat || EC.vat || 'excluded';
            return '<label class="choice"><input type="radio" name="d-vat" value="' + o[0] + '" data-df="vat"' + (curV === o[0] ? ' checked' : '') + '><span>' + o[1] + '</span></label>';
          }).join('') + '</div></div>' +
          '<div class="field"><label for="d-pay">결제 조건</label><textarea class="textarea" id="d-pay" data-df="payment" rows="2" maxlength="300" placeholder="예) 계약금 30% · 중도금 40% · 잔금 30%">' + esc(D.payment || '') + '</textarea></div>' +
          '<div class="field"><label for="d-notes">특기사항</label><textarea class="textarea" id="d-notes" data-df="notes" rows="4" maxlength="1500">' + esc(D.notes != null ? D.notes : (EC.notes || '')) + '</textarea></div>' +
          '<div class="field"><span class="label">세부 내역</span><label class="est-check"><input type="checkbox" data-df="showDetail"' + (D.showDetail !== false ? ' checked' : '') + '><span>새 견적서에 세부 내역 넣기</span></label>' +
          '<p class="hint">끄면 새 견적서가 공사 항목별 합계만 들어간 모양으로 시작해요. 견적서마다 <b>미리보기·받기</b>에서 바꿀 수 있어요.</p></div>' +
          '<div class="field"><label for="d-conf">외부 유출 금지 문구</label><textarea class="textarea" id="d-conf" data-df="confidential" rows="2" maxlength="200">' + esc(D.confidential || EC.confidential || '') + '</textarea></div>' +
          '</div>';
      }
      function render() {
        page.innerHTML = '<nav class="est-steps set-tabs" aria-label="견적서 설정">' +
          [['items', '공사 항목·단가'], ['sets', '공사 묶음'], ['presets', '평수별 수량'], ['defaults', '기본 문구']].map(function (t) {
            return '<button type="button" class="est-step' + (tab === t[0] ? ' on' : '') + '" data-tab="' + t[0] + '">' + t[1] + '</button>';
          }).join('') + '</nav><div class="est-body">' +
          (tab === 'items' ? itemsHtml() : tab === 'sets' ? setsHtml() : tab === 'presets' ? presetsHtml() : defaultsHtml()) +
          '</div><div class="savebar est-bar set-bar"' + (K.state.dirty ? '' : ' hidden') + '><div class="est-sum"><small>새로 만드는 견적서부터 적용돼요</small><b id="set-state">저장 안 한 내용 있음</b></div>' +
          '<div class="est-nav"><button class="btn btn-primary" type="button" data-setsave>' + I.check + '설정 저장</button></div></div>';
        $$('details.set-cat', page).forEach(function (d) {
          d.addEventListener('toggle', function () { var c = cfg.cats[+d.getAttribute('data-ci')]; if (c) open[c.key] = d.open; });
        });
      }
      function markDirty() { dirty(); }
      function where(el) {
        var d = el.closest('[data-ci]'), r = el.closest('[data-ii]');
        var c = d ? cfg.cats[+d.getAttribute('data-ci')] : null;
        return { c: c, ci: d ? +d.getAttribute('data-ci') : -1, it: c && r ? c.items[+r.getAttribute('data-ii')] : null, ii: r ? +r.getAttribute('data-ii') : -1, row: r };
      }
      page.addEventListener('input', function (e) {
        var el = e.target, w;
        if (el.hasAttribute('data-cf') && el.type !== 'checkbox') { w = where(el); w.c.name = el.value.slice(0, 30); markDirty(); return; }
        if (el.hasAttribute('data-if') && el.type !== 'radio') {
          w = where(el); var f = el.getAttribute('data-if');
          w.it[f] = f === 'price' ? String(num(el.value) || '') : el.value;
          if (f === 'qty' || f === 'price') $('[data-amt]', w.row).textContent = won(Math.round(num(w.it.qty) * num(w.it.price))) + '원';
          markDirty(); return;
        }
        if (el.hasAttribute('data-sn')) {
          var sni = +el.closest('[data-si]').getAttribute('data-si'); cfg.sets[sni].name = el.value.slice(0, 20);
          csSync(sni);   // 위 드롭다운 이름도 바로
          markDirty(); return;
        }
        if (el.hasAttribute('data-pq')) {
          var p = cfg.presets.filter(function (x) { return x.id === sel; })[0], id = el.getAttribute('data-pq');
          if (p) { if (String(el.value).trim() === '') delete p.qty[id]; else p.qty[id] = String(el.value).trim(); }
          markDirty(); return;
        }
        if (el.hasAttribute('data-df') && el.type !== 'radio' && el.type !== 'checkbox') {
          var k = el.getAttribute('data-df');
          cfg.defaults[k] = k === 'validDays' ? (Math.round(num(el.value)) || '') : el.value;
          markDirty();
        }
      });
      page.addEventListener('change', function (e) {
        var el = e.target, w;
        if (el.hasAttribute('data-sk')) {   // 공사 묶음에 넣기·빼기
          var cs = cfg.sets[+el.closest('[data-si]').getAttribute('data-si')], sk = el.getAttribute('data-sk');
          cs.keys = cs.keys.filter(function (k) { return k !== sk; }); if (el.checked) cs.keys.push(sk);
          el.closest('.est-cbox').classList.toggle('on', el.checked);
          var csi = +el.closest('[data-si]').getAttribute('data-si'), cnt = $('.cs-total', page);
          if (cnt) cnt.textContent = '공사 ' + csCount(cs) + '가지';
          csSync(csi);
          markDirty(); return;
        }
        if (el.id === 'cs-sel') { if (+el.value !== csSel) { csSel = +el.value; render(); } return; }   // 고칠 공사 묶음 바꾸기
        if (el.getAttribute('data-if') === 'kind') { w = where(el); w.it.kind = el.value; markDirty(); }
        if (el.getAttribute('data-df') === 'vat') { cfg.defaults.vat = el.value; markDirty(); }
        if (el.getAttribute('data-df') === 'showDetail') { cfg.defaults.showDetail = el.checked; markDirty(); }
      });
      page.addEventListener('focusout', function (e) { var el = e.target; if (el.getAttribute('data-if') === 'price') { var n = num(el.value); el.value = n ? won(n) : ''; } });
      page.addEventListener('focusin', function (e) { var el = e.target; if (el.getAttribute('data-if') === 'price') { var n = num(el.value); el.value = n ? String(Math.round(n)) : ''; } });
      function move(arr, i, d) { var j = i + d; if (j < 0 || j >= arr.length) return false; var t = arr[i]; arr[i] = arr[j]; arr[j] = t; return true; }
      // 공사 항목·단가 탭: 공사 항목 카드 왼쪽 ⋮⋮ 를 잡고 위아래로 끌어서 순서 바꾸기 (견적서 공사 항목 칸·단계 순서도 이 순서 — 끌어서 순서를 바꾼 공사 묶음은 그 묶음 순서)
      K.sortable(page, { grip: '[data-cgrip]', item: '.set-cat', done: function (box, order) {
        var c0 = cfg.cats.slice(); cfg.cats = order.map(function (i) { return c0[i]; });
        markDirty(); var y = window.scrollY; render(); window.scrollTo(0, y);
      } });
      page.addEventListener('click', function (e) {
        var t = e.target, x, w;
        if (t.closest('[data-cgrip]')) { e.preventDefault(); return; }   // ⋮⋮ 손잡이를 눌러도 카드가 펼쳐지지 않게 (끌기 전용)
        if ((x = t.closest('[data-tab]'))) { tab = x.getAttribute('data-tab'); render(); window.scrollTo(0, 0); return; }
        if (t.closest('[data-setsave]')) return saveCfg();
        if ((x = t.closest('[data-cmove]'))) { w = where(x); if (move(cfg.cats, w.ci, +x.getAttribute('data-cmove'))) { markDirty(); render(); } return; }
        if ((x = t.closest('[data-imove]'))) { w = where(x); if (move(w.c.items, w.ii, +x.getAttribute('data-imove'))) { markDirty(); render(); } return; }
        if ((x = t.closest('[data-iadd]'))) {
          w = where(x); w.c.items.push({ id: uid(), name: '', spec: '', unit: '', price: '', qty: '', kind: 'option' }); open[w.c.key] = true; markDirty(); render();
          var last = $$('[data-ci="' + w.ci + '"] [data-if="name"]', page).pop(); if (last) setTimeout(function () { K.focusNear(last); }, 30);
          return;
        }
        if ((x = t.closest('[data-idel]'))) {
          w = where(x);
          (w.it.name || num(w.it.price) ? K.ask({ title: '이 세부 항목을 지울까요?', text: esc(w.it.name || '이름 없는 항목') + ' — 이미 만든 견적서에는 영향이 없어요.', cancel: '그대로 두기', ok: '지우기', okClass: 'btn-danger' }) : Promise.resolve(true))
            .then(function (ok) { if (!ok) return; w.c.items.splice(w.ii, 1); markDirty(); render(); });
          return;
        }
        if ((x = t.closest('[data-cdel]'))) {
          w = where(x);
          K.ask({ title: '‘' + (w.c.name || '이 공사') + '’ 항목을 지울까요?', text: '세부 항목 ' + w.c.items.length + '개가 함께 지워져요. 이미 만든 견적서에는 영향이 없어요.', cancel: '그대로 두기', ok: '지우기', okClass: 'btn-danger' })
            .then(function (ok) { if (!ok) return; cfg.cats.splice(w.ci, 1); markDirty(); render(); });
          return;
        }
        if (t.closest('[data-cadd]')) {
          var inp = $('#set-newcat', page), name = String(inp.value || '').trim().slice(0, 30);
          if (!name) { inp.focus(); return; }
          if (cfg.cats.some(function (c) { return c.name === name; })) { K.notice('이미 있는 공사 항목이에요'); return; }
          var key = 'c-' + uid();
          cfg.cats.push({ key: key, name: name, total: false, items: [{ id: uid(), name: name, spec: '', unit: '식', price: '', qty: '1', kind: 'default' }] });
          open[key] = true; markDirty(); render();
          K.toast('‘' + name + '’ 공사 항목을 넣었어요. 세부 항목과 단가를 적어 주세요.');
          return;
        }
        if (t.closest('[data-reset]')) {
          return K.ask({ title: '처음 목록으로 되돌릴까요?', text: '공사 항목·세부 항목·단가가 <b>처음 목록</b>으로 바뀌어요. 평수별 수량과 기본 문구는 그대로 두고, 저장을 눌러야 적용돼요.', cancel: '그만두기', ok: '되돌리기', okClass: 'btn-danger' })
            .then(function (ok) { if (!ok) return; cfg.cats = defaultCatalog().cats; open = {}; markDirty(); render(); });
        }
        if (t.closest('[data-sadd]')) {
          cfg.sets.push({ id: uid(), name: '', keys: [], order: [] }); csSel = cfg.sets.length - 1; markDirty(); render();
          var ns = $('#cs-n', page); if (ns) setTimeout(function () { K.focusNear(ns); }, 30);
          return;
        }
        if ((x = t.closest('[data-smove]'))) { var smi = +x.closest('[data-si]').getAttribute('data-si'), smd = +x.getAttribute('data-smove'); if (move(cfg.sets, smi, smd)) { csSel = smi + smd; markDirty(); render(); } return; }
        if ((x = t.closest('[data-sdel]'))) {
          var sdi = csSel, sd = cfg.sets[sdi]; if (!sd) return;
          return K.ask({ title: '‘' + (sd.name || '이름 없는 묶음') + '’ 묶음을 지울까요?', text: '공사 항목은 그대로 있고, 견적서 드롭다운의 이 묶음만 없어져요. (설정 저장을 눌러야 적용돼요)', cancel: '그대로 두기', ok: '지우기', okClass: 'btn-danger' })
            .then(function (ok) { if (!ok) return; cfg.sets.splice(sdi, 1); csSel = Math.max(0, sdi - 1); markDirty(); render(); });
        }
        if ((x = t.closest('[data-psel]'))) { sel = x.getAttribute('data-psel'); render(); return; }
        if (t.closest('[data-padd]')) {
          var si = $('#set-newsize', page), size = num(si.value);
          if (!(size > 0 && size < 1000)) { si.focus(); return K.notice('평형을 숫자로 적어 주세요', '예) 32'); }
          if (cfg.presets.some(function (p) { return num(p.size) === size; })) { K.notice('이미 있는 평형이에요'); return; }
          var np = { id: uid(), size: size, qty: {} };
          // 가장 가까운 평형의 수량을 복사해서 시작 (없으면 빈 칸)
          var near = null; cfg.presets.forEach(function (p) { if (!near || Math.abs(num(p.size) - size) < Math.abs(num(near.size) - size)) near = p; });
          if (near) np.qty = JSON.parse(JSON.stringify(near.qty));
          cfg.presets.push(np); sel = np.id; markDirty(); render();
          return K.toast(presetLabel(np) + '을 만들었어요' + (near ? ' (' + presetLabel(near) + ' 수량을 복사해 두었어요)' : ''));
        }
        if (t.closest('[data-pdel]')) {
          var cur = cfg.presets.filter(function (p) { return p.id === sel; })[0]; if (!cur) return;
          return K.ask({ title: presetLabel(cur) + '을 지울까요?', text: '이 평형에 적어 둔 수량이 지워져요.', cancel: '그대로 두기', ok: '지우기', okClass: 'btn-danger' })
            .then(function (ok) { if (!ok) return; cfg.presets = cfg.presets.filter(function (p) { return p !== cur; }); sel = null; markDirty(); render(); });
        }
      });
      function saveCfg() {
        var btn = $('[data-setsave]', page); btn.disabled = true;
        cfg.cats.forEach(function (c) {
          c.name = String(c.name || '').trim() || '이름 없는 공사';
          c.items = c.items.filter(function (it) { return String(it.name || '').trim() || num(it.price); });
        });
        cfg.sets = (cfg.sets || []).map(function (st, i) { return { id: st.id, name: String(st.name || '').trim() || '묶음 ' + (i + 1), keys: st.keys.filter(function (k) { return cfg.cats.some(function (c) { return c.key === k; }); }) }; });
        cfg.updated_at = new Date().toISOString();
        DB.saveAdminSetting('estimate_catalog', cfg).then(function () {
          setCatalog(JSON.parse(JSON.stringify(cfg)));
          catalogP = Promise.resolve(CATALOG);
          K.setDirty(false); render();   // 저장하면 막대가 내려감
        }).catch(function (err) {
          btn.disabled = false;
          fail('저장하지 못했어요', err);
        });
      }
      render();
    }).catch(function (err) {
      app.innerHTML = '<div class="page"><div class="empty-box">' + friendly(err) + '</div></div>';
    });
  }

  /* ---------- 화면 등록 ---------- */
  K.routes.estimates = function (args) {
    if (args[0] === 'settings') return viewCatalog();
    // #/estimates/open · won · stopped (첫 화면 '견적서 현황'에서 누르면 그 상태만)
    if (EFILTERS.some(function (f) { return f[0] === args[0]; })) { var st = K.filterState('estF', []); st.q = ''; st.reg = ''; st.from = ''; st.to = ''; st.st = args[0] === 'all' ? [] : [args[0]]; }
    return viewList();
  };
  K.routes.estimate = function (args) { return viewEditor(args); };
  // 시험·다른 파일에서 쓰도록
  window.EstimateKit = { stageOf: stageOf, STAGES: STAGES, paginateParts: paginateParts, tableHtml: tableHtml, loadExport: loadExport, loadLogo: loadLogo, kDate: kDate, addDays: addDays, today: today, num: num, won: won,
    loadCatalog: loadCatalog, defaultCatalog: defaultCatalog, catalog: function () { return CATALOG; }, FROM_SCOPE: FROM_SCOPE, calc: calc, model: model, hangul: hangul, blankDoc: blankDoc, docHtml: docHtml, pickPreset: pickPreset };
})();
