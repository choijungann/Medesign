/* =====================================================================
   관리화면 — 계약서
   · 계약서 종류(카드 결제용·현금영수증용·현금 계좌이체용 + 직접 만든 종류) 중에서 골라 씀 — 종류마다 모양(표준/간단)을 정함
     표준 조항은 공정거래위원회 2018년 실내건축·창호공사 표준계약서의 항목을 참고해 쉬운 말로 쓰되, 업체에 불리한 내용은 뺌
   · 견적서에서 금액·공사 내역을 불러옴 (계약할 때의 내역을 계약서 안에 복사해 둠)
   · 손님·업체가 화면에 손가락으로 서명하거나, 인쇄해서 서명·도장
   · A4 미리보기 · 인쇄 · 워드 파일
   ★ 조항 문구는 표준계약서 원문이 아니라, 공정위 발표 자료의 주요 내용을 쉬운 말로 옮긴 것입니다.
     실제로 쓰기 전에 한 번 읽어 보고, 필요하면 '계약서 설정 → 계약서 종류'에서 고치세요. 계약서마다 '3. 조건'에서 따로 고칠 수도 있어요.
   ===================================================================== */
(function () {
  'use strict';
  var K = window.AdminKit, EK = window.EstimateKit;
  if (!K || !EK) return;
  var C = K.C, DB = K.DB, I = K.I, esc = K.esc, $ = K.$, $$ = K.$$;
  var CC = C.contract || {};
  var app = document.getElementById('app');
  var num = K.num, won = K.won;
  var STATUS = { draft: '작성 중', signed: '계약 완료', done: '공사 완료', canceled: '계약 중단', terminated: '계약 파기' };
  // 계약 파기 때 위약금: 없음 / 고객이 냄(업체가 받음) / 업체가 냄(고객에게 줌)
  var PENALTY = [['none', '위약금 없음'], ['in', '고객이 냄 (업체가 받음)'], ['out', '업체가 냄 (고객에게 줌)']];
  function termSummary(t) {
    if (!t) return '';
    var d = t.date ? K.sDate(t.date) + ' 파기' : '파기';
    if (!t.penalty || t.penalty === 'none') return d + ' · 위약금 없음';
    var amt = Math.round(num(t.amount)) ? won(num(t.amount)) + '원 ' : '';
    return d + ' · 위약금 ' + amt + (t.penalty === 'in' ? (t.settled ? '받음' : '받을 예정') : (t.settled ? '줌' : '줄 예정'));
  }
  var CFILTERS = [['all', '전체'], ['draft', '작성 중'], ['signed', '계약 완료'], ['done', '공사 완료'], ['canceled', '계약 중단'], ['terminated', '계약 파기']];
  var VATS = [['excluded', '부가세 별도'], ['included', '부가세 포함'], ['none', '적지 않기']];

  /* ---------- 기본 조항 ---------- */
  // 업체(수급인)에게 불리한 내용은 뺐어요 — 총액 인상 금지, 자재 같은 가격 이상, 지체상금, 하자 금액 지급 미루기,
  // 도급인의 해제권, 업체 쪽 위약금, 안전·손해배상, 내역서 제조사·규격 약속 (빼도 법에 있는 의무는 그대로 — README 4-4 ★)
  var STD_CLAUSES = [
    ['목적', '이 계약은 도급인(고객)과 수급인(시공업자)이 위 공사를 완성하고 그 대금을 지급하는 데 필요한 사항을 정하는 것을 목적으로 한다.'],
    ['계약 문서', '이 계약서와 공사 내역서(견적서), 설계도면(있는 경우)을 계약 문서로 하며, 서로 보완한다.'],
    ['중요 내용 설명', '수급인은 계약을 맺기 전에 공사 장소와 일정, 공사대금과 지급 방법, 공사 범위와 내역, 지연손해금, 계약 해제와 위약금, 공사 변경, 하자보수에 대하여 도급인에게 설명하였다.'],
    ['공사대금', '도급인은 위 대금 지급 일정에 따라 공사대금을 지급한다.'],
    ['공사 변경', '① 도급인이 공사 내용을 바꾸거나 더하기를 원하면, 수급인과 바뀌는 내용과 금액을 협의하여 문서(문자·메신저 포함)로 남긴다.\n② 계약한 자재를 구할 수 없게 되면 수급인은 도급인과 협의하여 비슷한 품질의 다른 자재로 바꿀 수 있으며, 이에 따라 금액이 달라지면 서로 협의하여 정한다.'],
    ['착공과 준공', '① 수급인은 착공일에 공사를 시작하여 준공일까지 마친다.\n② 천재지변이나 도급인의 요청 등 수급인에게 책임이 없는 사유로 공사가 늦어지면 서로 협의하여 공사 기간을 늘릴 수 있다.\n③ 수급인은 공사를 마치면 도급인과 함께 공사 결과를 확인한다.'],
    ['지연손해금', '도급인이 공사대금 지급을 늦추면 늦춘 금액에 위 표의 지연손해금 비율을 적용한 금액을 수급인에게 지급한다.'],
    ['하자보수', '수급인은 공사를 마친 날부터 위 표의 하자보수 기간 동안 생긴 하자를 무상으로 보수한다. 다만 도급인의 잘못된 사용이나 관리로 생긴 하자는 그렇지 않다.'],
    ['계약 해제', '도급인이 정당한 이유 없이 공사대금을 지급하지 않으면 수급인은 기간을 정하여 지급을 요구하고, 그 기간 안에 지급하지 않으면 공사를 멈추거나 계약을 해제할 수 있다.'],
    ['위약금', '도급인의 사정이나 잘못으로 계약이 해제되면 도급인은 수급인에게 위약금을 지급한다. 공사를 시작하기 전(계약이나 실측만 한 경우)에는 총 공사금액의 10% 이내, 공사를 시작한 뒤에는 실제 손해액으로 한다.'],
    ['권리·의무의 양도', '도급인과 수급인은 상대방의 동의 없이 이 계약의 권리와 의무를 다른 사람에게 넘기지 않는다.'],
    ['그 밖의 사항', '이 계약에서 정하지 않은 사항은 서로 협의하여 정하고, 협의가 되지 않으면 관계 법령과 일반 관례에 따른다.'],
  ];
  // 예전 문구(2026-10-25 이전) → 새 문구. 설정에 저장해 둔 종류의 조항이 예전 문구 그대로면 새 문구로 바꿔 줌 (고친 조항·이미 만든 계약서는 그대로)
  var OLD_STD = [
    ['목적', '이 계약은 도급인(고객)과 수급인(시공업자)이 위 공사를 완성하고 그 대금을 지급하는 데 필요한 사항을 정하는 것을 목적으로 한다.'],
    ['계약 문서', '① 이 계약서와 공사 내역서(견적서), 설계도면(있는 경우)을 계약 문서로 하며, 서로 보완한다.\n② 수급인은 공사 범위와 물량, 시공 자재의 제조사·규격 등을 적은 공사 내역서를 도급인에게 준다.'],
    ['중요 내용 설명', '수급인은 계약을 맺기 전에 공사 장소와 일정, 공사대금과 지급 방법, 공사 범위와 내역, 지연손해금과 지체상금, 계약 해제와 위약금, 공사 변경, 하자보수에 대하여 도급인에게 설명하였다.'],
    ['공사대금', '① 도급인은 위 대금 지급 일정에 따라 공사대금을 지급한다.\n② 수급인은 원자재 가격이 올랐다는 등의 이유로 계약한 총 공사금액을 올리지 않는다.'],
    ['공사 변경', '① 도급인이 공사 내용을 바꾸거나 더하기를 원하면, 수급인과 바뀌는 내용과 금액을 협의하여 문서(문자·메신저 포함)로 남긴다.\n② 계약한 자재를 구할 수 없게 되면 수급인은 도급인과 협의하여 같은 품질·같은 가격 이상의 자재로 시공하며, 이를 이유로 공사금액을 올리지 않는다.'],
    ['착공과 준공', '① 수급인은 착공일에 공사를 시작하여 준공일까지 마친다.\n② 천재지변이나 도급인의 요청 등 수급인에게 책임이 없는 사유로 공사가 늦어지면 서로 협의하여 공사 기간을 늘릴 수 있다.\n③ 수급인은 공사를 마치면 도급인과 함께 공사 결과를 확인한다.'],
    ['지연손해금과 지체상금', '① 도급인이 공사대금 지급을 늦추면 늦춘 금액에 위 표의 지연손해금 비율을 적용한 금액을 수급인에게 지급한다.\n② 수급인이 준공일까지 공사를 마치지 못하면 늦어진 날수에 위 표의 지체상금 비율을 적용한 금액을 도급인에게 지급한다. 다만 수급인에게 책임이 없는 사유로 늦어진 날은 빼고 계산한다.'],
    ['하자보수', '① 공사 중이나 공사대금을 모두 지급하기 전에 하자가 발견되면 도급인은 하자보수를 요구할 수 있고, 보수가 끝날 때까지 그 하자에 해당하는 금액의 지급을 미룰 수 있다.\n② 수급인은 공사를 마친 날부터 위 표의 하자보수 기간 동안 생긴 하자를 무상으로 보수한다. 다만 도급인의 잘못된 사용이나 관리로 생긴 하자는 그렇지 않다.'],
    ['계약 해제', '① 수급인이 정당한 이유 없이 착공을 늦추거나 준공일까지 공사를 마칠 수 없음이 분명하면 도급인은 계약을 해제할 수 있다.\n② 도급인이 정당한 이유 없이 공사대금을 지급하지 않으면 수급인은 기간을 정하여 지급을 요구하고, 그 기간 안에 지급하지 않으면 공사를 멈추거나 계약을 해제할 수 있다.'],
    ['위약금', '한쪽의 사정이나 잘못으로 계약이 해제되면 그쪽이 상대방에게 위약금을 지급한다. 공사를 시작하기 전(계약이나 실측만 한 경우)에는 총 공사금액의 10% 이내, 공사를 시작한 뒤에는 실제 손해액으로 한다.'],
    ['안전과 손해배상', '수급인은 공사 중 안전과 이웃 피해 예방에 주의하며, 수급인의 잘못으로 도급인이나 다른 사람에게 손해가 생기면 배상한다.'],
    ['권리·의무의 양도', '도급인과 수급인은 상대방의 동의 없이 이 계약의 권리와 의무를 다른 사람에게 넘기지 않는다.'],
    ['그 밖의 사항', '이 계약에서 정하지 않은 사항은 서로 협의하여 정하고, 협의가 되지 않으면 관계 법령과 일반 관례에 따른다.'],
  ];

  var SIMPLE_CLAUSES = [
    ['공사 내용', '공사의 범위와 내역은 첨부한 공사 내역서(견적서)와 같다.'],
    ['공사대금', '도급인은 위 대금 지급 일정에 따라 공사대금을 지급한다.'],
    ['공사 변경', '공사 내용이 바뀌면 바뀌는 내용과 금액을 서로 협의하여 정하고 문서(문자·메신저 포함)로 남긴다.'],
    ['하자보수', '수급인은 공사를 마친 날부터 위 표의 하자보수 기간 동안 생긴 하자를 무상으로 보수한다. 다만 도급인의 잘못된 사용이나 관리로 생긴 하자는 그렇지 않다.'],
    ['그 밖의 사항', '이 계약에서 정하지 않은 사항은 서로 협의하여 정한다.'],
  ];
  var CLOSING = '이 계약을 증명하기 위하여 계약서 2부를 작성하여 도급인과 수급인이 서명(날인)한 뒤 각 1부씩 보관한다.';
  function cl(list) { return list.map(function (c) { return { title: c[0], body: c[1] }; }); }

  /* ---------- 계약서 종류 (설정 → 계약서 종류: 종류마다 이름·모양·부가세·대금 비율·특약·조항을 따로 저장)
     처음 넣어 두는 종류: 표준 / 간단 / 카드 결제용 / 현금영수증용 / 현금 계좌이체용 — 고치거나 지우거나 새로 만들 수 있음
     ★ 결제 방법 조항에는 업체에 불리한 약속을 넣지 않았어요. 다만 아래 의무는 계약서에 안 적어도 법으로 그대로 있음 (세금 처리는 세무사와 확인)
       · 여신전문금융업법 제19조 ①④ — 카드로 거래한다는 이유로 결제를 거절하거나 불리하게 대우하면 안 되고,
         가맹점수수료를 손님(카드회원)에게 부담시키면 안 됨
       · 소득세법 시행령 별표 3의3 — 실내건축 및 건축마무리 공사업(도배만 하는 경우 제외)은 현금영수증 의무발행업종:
         건당 10만원 이상(부가세 포함)을 현금(계좌이체 포함)으로 받으면 손님이 원하지 않아도 발급,
         번호를 모르면 받은 날부터 5일 안에 국세청 지정번호(010-000-1234)로 발급. 세금계산서를 발급한 거래는 현금영수증을 따로 안 해도 됨 */
  var PAY_CLAUSES = {
    card: ['결제 방법', '① 도급인은 공사대금을 신용카드(체크카드 포함)로 결제한다.\n② 할부 개월 수는 도급인이 정하며, 할부 수수료는 도급인과 카드사 사이의 약정에 따른다.\n③ 계약이 해제되거나 공사대금이 줄어 돌려줄 금액이 생기면 카드 결제를 취소(부분 취소 포함)하는 방법으로 돌려준다.'],
    receipt: ['결제 방법과 현금영수증', '① 도급인은 공사대금을 현금(계좌이체 포함)으로 지급하고, 현금영수증을 받을 번호(휴대전화 번호 또는 사업자등록번호)를 수급인에게 알려 준다.\n② 도급인이 사업자로서 세금계산서를 받는 금액에는 현금영수증을 따로 발급하지 않는다.'],
    transfer: ['결제 방법', '① 도급인은 공사대금을 위 입금 계좌로 이체하여 지급하며, 입금자 이름은 도급인 이름으로 한다. 다른 이름으로 보낼 때는 미리 수급인에게 알린다.\n② 위 입금 계좌가 아닌 곳으로 보낸 돈은 수급인이 받았다고 문서(문자·메신저 포함)로 확인한 경우에만 공사대금으로 본다.'],
  };
  var OLD_PAY = {
    card: ['결제 방법', '① 도급인은 공사대금을 신용카드(체크카드 포함)로 결제하며, 카드로 결제하는 금액은 위 공사대금과 같다.\n② 수급인은 카드로 결제한다는 이유로 공사대금을 올리거나 카드 수수료를 도급인에게 따로 받지 않는다.\n③ 할부 개월 수는 도급인이 정하며, 할부 수수료는 도급인과 카드사 사이의 약정에 따른다.\n④ 계약이 해제되거나 공사대금이 줄어 돌려줄 금액이 생기면 카드 결제를 취소(부분 취소 포함)하는 방법으로 돌려준다.'],
    receipt: ['결제 방법과 현금영수증', '① 도급인은 공사대금을 현금(계좌이체 포함)으로 지급한다.\n② 수급인은 공사대금을 받을 때마다 현금영수증을 발급한다. 도급인은 현금영수증을 받을 번호(휴대전화 번호 또는 사업자등록번호)를 수급인에게 알려 준다.\n③ 도급인이 번호를 알려 주지 않으면 수급인은 관련 법령에 따라 국세청이 정한 번호로 현금영수증을 발급한다.\n④ 도급인이 사업자로서 세금계산서를 받는 금액에는 현금영수증을 따로 발급하지 않는다.'],
    transfer: ['결제 방법', '① 도급인은 공사대금을 위 입금 계좌로 이체하여 지급하며, 입금자 이름은 도급인 이름으로 한다. 다른 이름으로 보낼 때는 미리 수급인에게 알린다.\n② 위 입금 계좌가 아닌 곳으로 보낸 돈은 수급인이 받았다고 문서(문자·메신저 포함)로 확인한 경우에만 공사대금으로 본다.\n③ 수급인은 입금을 확인하면 도급인에게 알리고, 관련 법령에 따라 현금영수증(도급인이 사업자로서 세금계산서를 받으면 세금계산서)을 발급한다.'],
  };
  // 예전 문구 → 새 문구 (제목이 같은 새 조항이 없으면 빼기)
  var CLAUSE_FIX = (function () {
    var m = [], newStd = {}, i;
    STD_CLAUSES.forEach(function (c) { newStd[c[0]] = c; });
    var ren = { '지연손해금과 지체상금': '지연손해금' };
    OLD_STD.forEach(function (c) { var n = newStd[ren[c[0]] || c[0]] || null; if (!n || n[1] !== c[1] || n[0] !== c[0]) m.push([c[0], c[1], n]); });
    for (i in OLD_PAY) if (OLD_PAY[i][1] !== PAY_CLAUSES[i][1]) m.push([OLD_PAY[i][0], OLD_PAY[i][1], PAY_CLAUSES[i]]);
    return m;
  })();
  function fixClauses(list) {
    if (!Array.isArray(list)) return list;
    var out = [];
    list.forEach(function (c) {
      var hit = c && CLAUSE_FIX.filter(function (f) { return f[0] === c.title && f[1] === c.body; })[0];
      if (!hit) out.push(c); else if (hit[2]) out.push({ title: hit[2][0], body: hit[2][1] });
    });
    return out;
  }

  // [id, 이름, 모양, 부가세] — 종류는 결제 방법으로 나누고, 표준/간단은 종류마다 고르는 '계약서 모양'
  var KIND_PRESETS = [
    ['card', '카드 결제용', 'standard', 'included'], ['receipt', '현금영수증용', 'standard', 'included'], ['transfer', '현금 계좌이체용', 'standard', 'included'],
  ];
  // 결제 방법 조항은 '공사대금' 조항 바로 뒤에
  function withPayClause(list, c) {
    var at = list.findIndex(function (x) { return String(x.title || '').replace(/\s+/g, '') === '공사대금'; });
    list.splice(at >= 0 ? at + 1 : Math.min(4, list.length), 0, { title: c[0], body: c[1] });
    return list;
  }
  // 모양(표준/간단)의 처음 조항 + (결제용이면) 결제 방법 조항
  function baseClauses(base, preset) {
    var list = base === 'simple' ? cl(SIMPLE_CLAUSES) : cl(STD_CLAUSES);
    return PAY_CLAUSES[preset] ? withPayClause(list, PAY_CLAUSES[preset]) : list;
  }
  function filled(c) { return c && (String(c.title || '').trim() || String(c.body || '').trim()); }
  var PAY_TITLES = ['결제 방법', '결제 방법과 현금영수증'];

  /* ---------- 조항 묶음 (설정 → 조항) ----------
     clauseSets: [{ id, name, base: 'standard'|'simple', clauses: [{ title, body }] }] — 예: 표준 계약서, 간단 v1, 간단 v2
     결제 방법 조항은 묶음에 넣지 않고 계약서 종류(kinds[].payClause)에 따로 둠 → 계약서를 만들 때 '공사대금' 바로 뒤에 끼워 넣음.
     그래서 같은 묶음을 카드용·계좌이체용이 같이 쓸 수 있음 */
  function presetSet(id, S) {
    S = S || {};
    var simple = id === 'simple', old = simple ? S.simpleClauses : S.clauses;
    return { id: id, name: simple ? '간단 계약서' : '표준 계약서', base: simple ? 'simple' : 'standard',
      clauses: Array.isArray(old) && old.filter(filled).length ? clone(old.filter(filled)) : (simple ? cl(SIMPLE_CLAUSES) : cl(STD_CLAUSES)) };
  }
  function setOf(id, S) { S = S || SET; return S && S.clauseSets ? S.clauseSets.filter(function (x) { return x.id === id; })[0] || null : null; }
  // 처음 넣어 두는 종류 하나 만들기 — 조항은 'std' 묶음(없으면 첫 묶음), 결제 방법 조항은 종류에
  function presetKind(id, S) {
    S = S || {};
    var p = KIND_PRESETS.filter(function (x) { return x[0] === id; })[0];
    if (!p) return null;
    var pays = Array.isArray(S.payments) && S.payments.length ? S.payments : defaultSettings().payments;
    var sets = S.clauseSets || [], set = sets.filter(function (x) { return x.id === 'std'; })[0] || sets[0];
    return { id: id, preset: id, name: p[1], clauseSet: set ? set.id : 'std', vat: p[3], specials: S.specials || '',
      payClause: PAY_CLAUSES[id] ? { title: PAY_CLAUSES[id][0], body: PAY_CLAUSES[id][1] } : null,
      payments: pays.map(function (q) { return { label: q.label || '', pct: q.pct, when: q.when || '' }; }) };
  }
  // 예전 설정을 지금 모양으로: 조항 묶음이 없으면 만들고(예전 종류마다 들어 있던 조항에서 결제 방법 조항을 빼고 같은 내용끼리 합침),
  // 예전에 있던 '표준 계약서'·'간단 계약서' 종류는 뺌 (표준/간단은 조항 묶음의 모양이라)
  function ensureKinds(S) {
    S.clauses = fixClauses(S.clauses); S.simpleClauses = fixClauses(S.simpleClauses);
    var raw = (Array.isArray(S.kinds) ? S.kinds : []).filter(function (k) { return k && k.id; });
    raw.forEach(function (k) { if (Array.isArray(k.clauses)) k.clauses = fixClauses(k.clauses); });
    var sets = Array.isArray(S.clauseSets) ? S.clauseSets.filter(function (x) { return x && x.id; }) : [];
    sets.forEach(function (x) { x.clauses = fixClauses(Array.isArray(x.clauses) ? x.clauses : []); });
    if (!sets.length) {
      var sig = {};
      var addSet = function (base, list, prefer) {
        var key = base + '|' + JSON.stringify(list.map(function (c) { return [String(c.title || '').trim(), String(c.body || '').trim()]; }));
        if (sig[key]) return sig[key].id;
        var nm = base === 'simple' ? '간단 계약서' : '표준 계약서', same = sets.filter(function (x) { return x.name.indexOf(nm) === 0; }).length;
        var id = prefer && !sets.some(function (x) { return x.id === prefer; }) ? prefer : 'cs' + (sets.length + 1);
        var set = { id: id, name: same ? nm + ' ' + (same + 1) : nm, base: base, clauses: clone(list) };
        sets.push(set); sig[key] = set; return id;
      };
      raw.forEach(function (k) {
        if (k.clauseSet || !Array.isArray(k.clauses) || !k.clauses.filter(filled).length) return;
        var list = k.clauses.filter(filled), pay = null;
        list = list.filter(function (c) { if (!pay && PAY_TITLES.indexOf(String(c.title || '').trim()) >= 0) { pay = c; return false; } return true; });
        if (pay && !k.payClause) k.payClause = { title: pay.title, body: pay.body };
        var base = k.base === 'simple' ? 'simple' : 'standard';
        k.clauseSet = addSet(base, list, base === 'simple' ? 'simple' : 'std');
      });
      if (!sets.some(function (x) { return x.base === 'standard'; })) sets.unshift(presetSet('std', S));
      if (!sets.some(function (x) { return x.base === 'simple'; })) sets.push(presetSet('simple', S));
    }
    S.clauseSets = sets.map(function (x, i) {
      return { id: String(x.id), name: String(x.name || '').trim() || '조항 묶음 ' + (i + 1), base: x.base === 'simple' ? 'simple' : 'standard', clauses: x.clauses.filter(filled) };
    });
    var list = raw.filter(function (k) { return k.id !== 'std' && k.id !== 'simple'; });
    S.kinds = list.length ? list : KIND_PRESETS.map(function (p) { return presetKind(p[0], S); });
    S.kinds = S.kinds.map(function (k, i) {
      var pc = k.payClause && filled(k.payClause) ? { title: String(k.payClause.title || ''), body: String(k.payClause.body || '') } : null;
      return { id: String(k.id), preset: k.preset || null, name: String(k.name || '').trim() || '계약서 종류 ' + (i + 1),
        clauseSet: setOf(k.clauseSet, S) ? k.clauseSet : (setOf('std', S) || S.clauseSets[0]).id, payClause: pc,
        vat: VATS.some(function (v) { return v[0] === k.vat; }) ? k.vat : 'excluded', specials: String(k.specials || ''),
        payments: Array.isArray(k.payments) && k.payments.length ? k.payments : clone(S.payments || defaultSettings().payments) };
    });
    if (!S.kinds.some(function (k) { return k.id === S.defaultKind; })) S.defaultKind = S.kinds.some(function (k) { return k.id === 'transfer'; }) ? 'transfer' : S.kinds[0].id;
    return S;
  }
  function kindOf(id, S) { S = S || SET; return S && S.kinds ? S.kinds.filter(function (k) { return k.id === id; })[0] || null : null; }
  function defaultKind() { return SET && SET.kinds ? kindOf(SET.defaultKind) || SET.kinds[0] : null; }
  // 종류의 조항 = 조항 묶음 + (있으면) 결제 방법 조항을 '공사대금' 바로 뒤에
  function kindClauses(k, S) {
    var set = setOf(k && k.clauseSet, S) || ((S || SET) && (S || SET).clauseSets || [])[0];
    var base = set && set.base === 'simple' ? 'simple' : 'standard';
    var list = set && set.clauses.filter(filled).length ? clone(set.clauses.filter(filled)) : baseClauses(base, null);
    if (k && k.payClause && filled(k.payClause)) withPayClause(list, [k.payClause.title, k.payClause.body]);
    return { base: base, list: list, set: set };
  }
  function kindSummary(k, S) {
    var r = kindClauses(k, S);
    return (r.set ? r.set.name : '표준 계약서') + ' · 조항 ' + r.list.length + '개 · ' + ((VATS.filter(function (v) { return v[0] === k.vat; })[0] || ['', ''])[1].replace('적지 않기', '부가세 안 적음'));
  }
  // 계약서에 종류 넣기: 모양·조항(묶음 + 결제 방법)·대금 비율·특약 (+ 부가세 — 견적서에서 불러온 계약서는 견적서 부가세를 그대로)
  function applyKind(doc, k, keepVat) {
    if (!k) return doc;
    var r = kindClauses(k);
    doc.kind = k.id; doc.kindName = k.name; doc.clauseSet = r.set ? r.set.id : ''; doc.clauseSetName = r.set ? r.set.name : '';
    doc.mode = r.base;
    if (doc.mode === 'simple') doc.simpleClauses = r.list; else doc.clauses = r.list;
    if (!keepVat && k.vat) doc.vat = k.vat;
    if (Array.isArray(k.payments) && k.payments.length) {
      doc.payments = k.payments.map(function (p) { return { label: p.label || '', pct: p.pct, when: p.when || '', amount: '' }; });
      splitPayments(doc);
    }
    doc.specials = k.specials || '';
    return doc;
  }

  /* ---------- 계약서 설정 (관리자 전용 admin_settings 'contract_settings') ---------- */
  function defaultSettings() {
    return {
      mode: 'standard',
      account: '',                                         // 입금 계좌 — 공개 파일(config.js)이 아니라 여기에만 저장
      license: '',                                         // 건설업 등록번호 (있으면)
      payments: (CC.payments || [['계약금', 10, '계약할 때'], ['중도금', 40, '공사 중간 (목공 마친 뒤)'], ['잔금', 50, '공사를 마치고 함께 확인한 뒤']])
        .map(function (p) { return { label: p[0], pct: p[1], when: p[2] }; }),
      warranty: CC.warranty || { n: 1, unit: '년', note: '방수 공사는 3년' },
      lateRate: CC.lateRate != null ? CC.lateRate : '연 6%',
      delayRate: '',            // 지체상금(공사가 늦을 때 업체가 냄)은 업체에 불리해서 넣지 않음 — 예전 계약서에 적힌 값만 그대로 보여 줌
      specials: '',
      clauses: null,            // (예전 설정) 고친 표준 조항 — 지금은 계약서 종류(kinds)로 옮겨 씀
      simpleClauses: null,
      clauseSets: null,         // 조항 묶음 [{ id, name, base, clauses }] — null 이면 표준·간단 두 묶음으로
      kinds: null,              // 계약서 종류 [{ id, preset, name, clauseSet, payClause, vat, payments, specials }] — null 이면 위 KIND_PRESETS 로
      defaultKind: 'transfer',  // 새 계약서를 만들 때 처음 고를 종류 (기본값)
      supplierSign: null,       // 저장해 둔 업체 서명 그림 (data:image/png)
      phases: null,             // 공정 기본 일수 [{ name, days }] — null 이면 아래 PHASE_QUICK 를 모두 1일로
      phaseSets: [],            // 공정 순서 묶음 [{ name, items: [{ name, days }] }] — 세부 공사일정에서 한 번에 불러오기
    };
  }
  var SET = null, setP = null;
  function loadSettings(force) {
    if (setP && !force) return setP;
    setP = (DB.getAdminSetting ? DB.getAdminSetting('contract_settings') : Promise.resolve(null)).then(function (v) {
      var d = defaultSettings();
      SET = Object.assign(d, v || {});
      if (!Array.isArray(SET.payments) || !SET.payments.length) SET.payments = d.payments;
      return ensureKinds(SET);
    }).catch(function () { SET = ensureKinds(defaultSettings()); setP = null; return SET; });
    return setP;
  }
  function saveSettings(v) { return DB.saveAdminSetting('contract_settings', v).then(function () { SET = v; setP = Promise.resolve(v); }); }

  /* ---------- 숫자·날짜 ---------- */
  function daysBetween(a, b) {
    var x = /^(\d{4})-(\d{2})-(\d{2})$/.exec(a || ''), y = /^(\d{4})-(\d{2})-(\d{2})$/.exec(b || '');
    if (!x || !y) return 0;
    return Math.round((Date.UTC(+y[1], +y[2] - 1, +y[3]) - Date.UTC(+x[1], +x[2] - 1, +x[3])) / 864e5) + 1;
  }
  function clone(o) { return JSON.parse(JSON.stringify(o)); }
  /* ---------- 세부 공사일정 (공정): [{ name, start, days }] → 날짜 채우기
     시작일을 비우면 앞 공정 다음 날(첫 공정은 착공일)부터. from·to 를 함께 저장해 달력·대시보드가 그대로 씀 */
  var PHASE_QUICK = ['철거', '전기', '설비', '목공', '타일', '도장', '필름', '도배', '마루·장판', '가구·주방', '조명', '청소'];
  // 계약서 설정 '공정 기본 일수'에 저장한 목록 (공정 고르기 칸 · 이름을 쓰면 기간이 저절로)
  // 을/를 (받침 있으면 '을')
  function eulReul(w) { var c = String(w || '').charCodeAt(String(w || '').length - 1); return c >= 0xAC00 && c <= 0xD7A3 && (c - 0xAC00) % 28 ? '을' : '를'; }
  function phaseList() {
    var l = SET && Array.isArray(SET.phases) && SET.phases.length ? SET.phases : null;
    return (l || PHASE_QUICK.map(function (n) { return { name: n, days: 1 }; })).filter(function (p) { return p && String(p.name || '').trim(); });
  }
  function phaseSets() { return SET && Array.isArray(SET.phaseSets) ? SET.phaseSets.filter(function (x) { return x && x.name && Array.isArray(x.items) && x.items.length; }) : []; }
  function phaseDays(name) {
    var n = String(name || '').replace(/\s+/g, ''), m = phaseList().filter(function (p) { return String(p.name).replace(/\s+/g, '') === n; })[0];
    return m ? String(Math.max(1, Math.round(num(m.days)) || 1)) : '';
  }
  // 공정 고르기 칸 (네모 체크 칸 · 누르면 넣고 다시 누르면 빼기). attr: 계약서 data-hq / 설정 순서 묶음 data-psq
  function nkey(v) { return String(v || '').replace(/\s+/g, ''); }
  function pickTile(name, days, on, attr) {
    return '<button type="button" class="ph-opt' + (on ? ' on' : '') + '" ' + attr + '="' + esc(name) + '" aria-pressed="' + on + '">' +
      '<span class="ph-box" aria-hidden="true">' + I.check + '</span><b>' + esc(name) + '</b></button>';   // 일수는 고른 뒤 아래 줄에서 보이므로 칸에는 이름만
  }
  // 고른 공정은 공정 목록 순서대로 제자리에 넣기 (예: 철거·도배가 있을 때 목공을 고르면 철거와 도배 사이). 목록에 없는 이름 뒤로는 끝에
  function insertByOrder(list, row, order) {
    var gi = order.indexOf(nkey(row.name));
    if (gi >= 0) for (var i = 0; i < list.length; i++) { if (order.indexOf(nkey(list[i].name)) > gi) { list.splice(i, 0, row); return i; } }
    list.push(row); return list.length - 1;
  }
  function addDaysIso(iso, n) { return K.addDays(iso, n); }
  function resolvePhases(list, start) {
    var prevEnd = '';
    return (list || []).map(function (h) {
      var days = Math.max(1, Math.min(365, parseInt(h.days, 10) || 1));
      var from = /^\d{4}-\d{2}-\d{2}$/.test(h.start || '') ? h.start : prevEnd ? addDaysIso(prevEnd, 1) : (start || '');
      var to = from ? addDaysIso(from, days - 1) : '';
      if (to) prevEnd = to;
      return { name: String(h.name || '').slice(0, 30), start: h.start || '', days: String(days), from: from, to: to };
    });
  }

  /* ---------- 계약서 내용 ---------- */
  function supplierNow() {
    return { name: C.name || '', legalName: C.legalName || '', ceo: C.ceo || '', bizNumber: C.bizNumber || '', address: C.address || '',
      phone: C.phone || '', license: (SET && SET.license) || '' };
  }
  function blankDoc() {
    var S = SET || defaultSettings();
    return {
      mode: S.mode || 'standard', kind: '', kindName: '', no: '', date: K.today(), title: '', site: '',
      customer: { name: '', phone: '', address: '' },
      start: '', end: '', amount: '', vat: 'excluded',
      payments: S.payments.map(function (p) { return { label: p.label, pct: p.pct, when: p.when, amount: '' }; }),
      account: S.account || '', warranty: clone(S.warranty || { n: 1, unit: '년', note: '' }),
      lateRate: S.lateRate || '', delayRate: '',
      attach: { estimate: true, detail: true, drawing: false, other: '' },
      specials: S.specials || '',
      clauses: cl(STD_CLAUSES), simpleClauses: cl(SIMPLE_CLAUSES),
      estimate: null, supplier: supplierNow(), signs: { customer: null, supplier: null },
    };
  }
  // 견적서 → 계약서 (금액·공사 내역 복사)
  function snapEstimate(rec) {
    var ed = Object.assign(EK.blankDoc(), rec.doc || {});
    var m = EK.model(ed, rec);
    return {
      id: rec.id, no: m.no, date: m.date, dateK: m.dateK, title: m.title, titleAuto: !String(ed.title || '').trim(), site: m.site, period: m.period,
      cats: m.cats, totals: m.totals, overheadRate: m.overheadRate, roundLabel: m.roundLabel, vatMode: m.vatMode, vatLabel: m.vatLabel,
      showDetail: m.showDetail !== false,
      customer: m.customer, region: (ed.site && ed.site.region) || '', siteName: (ed.site && ed.site.name) || '', siteUnit: (ed.site && ed.site.unit) || '',
    };
  }
  function fromEstimate(doc, snap) {
    doc.estimate = snap;
    doc.title = snap.title || doc.title;
    doc.titleAuto = !!snap.titleAuto;   // 견적서에서 공사명을 비워 둬 자동으로 생긴 이름이면 표시 (기록용 — 지금은 화면 표시에 쓰지 않음)
    doc.site = K.joinRegion(Object.assign(K.splitRegion(snap.region || '', true), { rest: snap.siteName || '', unit: snap.siteUnit || '' })) || doc.site;
    if (snap.customer) { doc.customer.name = snap.customer.name || doc.customer.name; doc.customer.phone = snap.customer.phone || doc.customer.phone; }
    doc.amount = String(snap.totals.total || '');
    doc.vat = snap.vatMode === 'add' ? 'included' : snap.vatMode === 'none' ? 'none' : 'excluded';
    doc.attach.estimate = true; doc.attach.detail = snap.showDetail !== false;
    splitPayments(doc);
  }
  // 비율대로 나누기: 만원 단위로 맞추고 남는 금액은 마지막(잔금)에
  function splitPayments(doc) {
    var total = Math.round(num(doc.amount)), rows = doc.payments, acc = 0;
    if (!total || !rows.length) return;
    rows.forEach(function (p, i) {
      if (i === rows.length - 1) { p.amount = String(Math.max(0, total - acc)); return; }
      var a = Math.round(total * num(p.pct) / 100 / 10000) * 10000;
      p.amount = String(a); acc += a;
    });
  }
  function paySum(doc) { return doc.payments.reduce(function (a, p) { return a + Math.round(num(p.amount)); }, 0); }
  // 화면 서명이 하나라도 있거나 '종이에 서명 받음'이면 내용을 잠금
  function signed(doc) { return !!(doc.paperSigned || (doc.signs && (doc.signs.customer || doc.signs.supplier))); }
  function bothSigned(doc) { return !!(doc.paperSigned || (doc.signs && doc.signs.customer && doc.signs.supplier)); }

  function model(doc, rec) {
    var total = Math.round(num(doc.amount)), sup = doc.supplier || supplierNow();
    var d = daysBetween(doc.start, doc.end);
    var w = doc.warranty || {};
    var clauses = (doc.mode === 'simple' ? doc.simpleClauses : doc.clauses) || [];
    var attach = [];
    if (doc.estimate && doc.attach.estimate) attach.push('공사 내역서' + (doc.estimate.no ? '(견적번호 ' + doc.estimate.no + ')' : '') + ' — 별첨');
    if (doc.attach.drawing) attach.push('설계도면');
    if (String(doc.attach.other || '').trim()) attach.push(String(doc.attach.other).trim());
    return {
      mode: doc.mode === 'simple' ? 'simple' : 'standard', no: doc.no || '', date: doc.date, dateK: K.kDate(doc.date),
      docTitle: doc.mode === 'simple' ? '공 사 계 약 서' : '공사 계약서',   // 표준 계약서 제목 (예전 '실내건축 공사 계약서')
      title: doc.title || (doc.site ? String(doc.site).split(',')[0].trim() + ' 인테리어 공사' : '인테리어 공사'), site: doc.site || '',   // 공사 장소 + 인테리어 공사 — 상세 주소(동·호수, 쉼표 뒤)는 공사명에 넣지 않음 (견적서와 같게)
      customer: { name: doc.customer.name || '', phone: doc.customer.phone || '', address: doc.customer.address || '' },
      supplier: sup,
      start: doc.start, end: doc.end, startK: K.kDate(doc.start), endK: K.kDate(doc.end), days: d,
      period: doc.start || doc.end ? (doc.start ? '착공 ' + K.kDate(doc.start) : '착공일 미정') + ' ~ ' + (doc.end ? '준공 ' + K.kDate(doc.end) : '준공일 미정') + (d > 0 ? ' (' + d + '일)' : '') : '',
      total: total, amountWords: '일금 ' + EK.hangul(total) + '원정', vatLabel: (VATS.filter(function (v) { return v[0] === doc.vat; })[0] || ['', ''])[1].replace('적지 않기', ''),
      payments: doc.payments.filter(function (p) { return String(p.label || '').trim() || num(p.amount); })
        .map(function (p) { return { label: String(p.label || '').trim(), amount: Math.round(num(p.amount)), when: String(p.when || '').trim() }; }),
      paySum: paySum(doc), account: String(doc.account || '').trim(),
      warranty: Number(w.n) > 0 ? '공사를 마친 날부터 ' + w.n + w.unit + (String(w.note || '').trim() ? ' (' + String(w.note).trim() + ')' : '') : String(w.note || '').trim(),
      lateRate: String(doc.lateRate || '').trim(), delayRate: String(doc.delayRate || '').trim(),
      attach: attach, specials: String(doc.specials || '').split('\n').map(function (s) { return s.trim(); }).filter(Boolean),
      clauses: clauses.filter(function (c) { return String(c.title || '').trim() || String(c.body || '').trim(); })
        .map(function (c, i) { return { no: i + 1, title: String(c.title || '').trim(), body: String(c.body || '').trim() }; }),
      closing: CLOSING,
      estimate: doc.estimate && doc.attach.estimate ? Object.assign({}, doc.estimate, { showDetail: !!doc.attach.detail }) : null,
      signs: doc.signs || {},
    };
  }

  function fail(title, err) { return K.ask({ title: title, text: esc(K.friendlyError(err)), cancel: false, ok: '확인' }); }

  /* =====================================================================
     목록
     ===================================================================== */
  function viewList() {
    K.frame('계약서', false, 'contracts');
    app.innerHTML = '<div class="page"><div class="loading">불러오는 중…</div></div>';
    Promise.all([DB.listContracts(), K.soft(DB.listCustomers)]).then(function (r) {
      var list = r[0], custs = {};
      (r[1] || []).forEach(function (c) { custs[c.id] = c; });
      function findRec(k) {
        var c = custs[k.customer_id] || {}, d = k.contract_date || K.ymd(new Date(k.created_at));
        return { phone: k.customer_phone || c.phone, text: [k.title, k.customer_name, k.site, c.name, c.address].join(' '), date: d,
          region: K.regionOf(k.site) || K.regionOf(c.address) || K.regionOf(k.title), status: k.status };
      }
      var page = document.createElement('div');
      page.className = 'page est-list-page';
      page.innerHTML =
        '<div class="est-top-actions"><a class="btn btn-primary est-new" href="#/contract/new">' + I.plus + '새 계약서 만들기</a>' +
        '<a class="btn btn-outline est-set-link" href="#/contracts/settings">' + I.gear + '계약서 설정<small>계약서 종류 · 입금 계좌 · 조항</small></a></div>' +
        // 목록 위 안내 상자는 지움 (2026-10-26 대표님 요청)
        '<div class="sec-head sh-1"><div class="sec-title"><h2>만든 계약서</h2></div></div>' +
        (list.length ? K.filterHtml('ctrF', { ph: '이름·전화번호·아파트', dateLabel: '계약일', regions: list.map(function (k) { return findRec(k).region; }),
          statuses: CFILTERS.filter(function (f) { return f[0] !== 'all'; }).map(function (f) { return [f[0], f[1], list.filter(function (k) { return k.status === f[0]; }).length]; }) }) : '') +
        K.listTools('ct-n', list.length ? 'ctr' : '') + '<div id="ct-list"></div>';
      app.innerHTML = ''; app.appendChild(page);
      function draw() {
        var finding = K.filterActive('ctrF');
        var shown = list.filter(function (k) { return K.filterMatch('ctrF', findRec(k)); });
        $('#ct-n', page).innerHTML = K.listCount(list.length, shown.length, finding);
        var table = K.viewMode('ctr') === 'table';
        $('#ct-list', page).innerHTML = shown.length ? (table ? K.dataTable('ctr', [
          { label: '고객', sort: function (k) { return k.customer_name || ''; }, html: function (k) { return '<b>' + esc(k.customer_name || '-') + '</b>'; }, cls: 'stick' },
          { label: '상태', sort: function (k) { return k.status; }, html: function (k) { return '<span class="pill c-' + esc(k.status) + '">' + esc(STATUS[k.status] || '') + '</span>'; } },
          { label: '현장', sort: function (k) { return cardName(k); }, html: function (k) { return esc(cardName(k)); }, cls: 'wide' },   // 카드 이름과 같게 (2026-10-26)
          { label: '계약일', sort: function (k) { return findRec(k).date; }, html: function (k) { return esc(findRec(k).date.replace(/-/g, '.')); } },
          { label: '연락처', html: function (k) { return esc(findRec(k).phone || ''); } },
          { label: '공사 기간', sort: function (k) { return k.start_date || ''; }, html: function (k) { return k.start_date ? esc(k.start_date.slice(5).replace('-', '/') + (k.end_date ? ' ~ ' + k.end_date.slice(5).replace('-', '/') : '')) : ''; } },
          { label: '금액', sort: function (k) { return Number(k.total) || 0; }, html: function (k) { return won(k.total); }, cls: 'n' },
        ], shown, function (k) { return '#/contract/' + encodeURIComponent(k.id); }, function (k) { return k.id; }) : '<div class="items">' + shown.map(card).join('') + '</div>')
          : '<div class="empty-box">' + (!list.length ? '아직 만든 계약서가 없어요.<br>위의 <b>새 계약서 만들기</b>를 눌러 시작해 보세요.'
            : '조건에 맞는 계약서가 없어요.<br>위 <b>조건 모두 지우기</b>를 누르면 전체가 보여요.') + '</div>';
        if (bk) bk.refresh();
      }
      function cardTitle(k) { return K.ctrTitle(k); }   // 공사명 그대로
      // 카드 이름(카드 첫 줄 굵은 글씨) = 현장(아파트 이름 + 동·호수 + 평수), 없으면 고객 이름, 그것도 없으면 공사명 — 전체 보기 표의 '공사명' 자리도 이것
      function cardName(k) {   // 공사 장소에 동·호수가 없고 고객 주소(같은 아파트)에 있으면 붙여서
        var nm = k.customer_name || '', pm = /(\d+(?:\.\d+)?)\s*평/.exec(String(k.site || '') + ' ' + String(k.title || ''));
        var c = custs[k.customer_id];
        return K.siteLabel(K.fillUnit(k.site || '', c && c.address), pm ? pm[1] + '평' : '') || (nm ? nm + ' 고객님' : cardTitle(k));
      }
      function card(k) {
          var off = k.status === 'canceled' || k.status === 'terminated';
          // 견적서 카드와 같은 모양: ① 현장(아파트 이름 + 동·호수 + 평수) ② 공사 항목 ③ 고객 이름 ④ 공사일정 ⑤ 금액 + 오른쪽 동그라미 상태
          var nm = k.customer_name || '', big = cardName(k);
          var items = k.items || K.workItems(k.title, k.site);   // 공사 항목: 견적서 항목 → 세부 공사일정의 공정 이름 (없으면 공사명에서)
          // 날짜가 '11월 13일 / (금)'처럼 중간에서 꺾이지 않게 날짜 하나씩 묶음 (좁으면 '~' 뒤에서 줄바꿈)
          var wr = K.workRange ? K.workRange(k) : (k.start_date ? { from: k.start_date, to: k.end_date || k.start_date } : null);   // 착공일이 없으면 세부 공사일정 처음~끝
          var when = wr ? '<span class="nw">' + esc(K.sDate(wr.from)) + '</span>' + (wr.to && wr.to !== wr.from ? ' ~ <span class="nw">' + esc(K.sDate(wr.to)) + '</span>' : '') : '미정';
          var circ = { draft: '작성 중', signed: '계약<br>완료', done: '공사<br>완료', canceled: '계약<br>중단', terminated: '계약<br>파기' }[k.status] || esc(STATUS[k.status] || '');
          return '<div class="item has-del est-item ct-card k-card st-' + esc(k.status) + (off ? ' is-off' : '') + '">' +
            '<label class="bulk-pick"><input type="checkbox" data-bid="' + esc(k.id) + '" aria-label="' + esc(big) + ' 고르기"></label>' +
            '<button class="item-del" type="button" data-del="' + esc(k.id) + '" aria-label="이 계약서 지우기">' + I.trash + '<span>지우기</span></button>' +
            '<button class="item-copy" type="button" data-copy="' + esc(k.id) + '" aria-label="이 계약서를 복사해서 새로 만들기">' + I.copy + '<span>복사</span></button>' +
            '<a class="est-open item-txt e4" href="#/contract/' + encodeURIComponent(k.id) + '"><div class="item-title">' + esc(big) + '</div>' +
            (items && items !== big ? '<span class="e4-item">' + esc(items) + '</span>' : '') +
            (nm && big !== nm + ' 고객님' ? '<span class="e4-who">' + esc(nm) + ' 고객님</span>' : '') +
            '<span class="e4-date">공사일정 <b>' + when + '</b></span>' +
            (k.status === 'terminated' ? '<p class="ct-term">' + esc(termSummary(k.termination)) + '</p>' : '') +
            '<div class="e4-foot"><span class="est-total">' + won(k.total) + '원</span><span class="st-circ c-' + esc(k.status) + '" role="img" aria-label="상태: ' + esc(STATUS[k.status] || '') + '">' + circ + '</span></div></a>' +
            // 단추는 언제나 네 칸(2 × 2): 이어 쓰기·열기 / 견적서 보기 / 계약 완료(마지막 화면)·공사 완료 / 계약 중단·계약 파기
            '<div class="item-actions ct-acts"><a class="btn ' + (k.status === 'draft' ? 'btn-draft' : 'btn-outline') + '" href="#/contract/' + encodeURIComponent(k.id) + '">' + (k.status === 'draft' ? '이어 쓰기' : '열기') + '</a>' + ctrActs(k) + '</div></div>';
      }
      function estBtn(k) {
        return k.estimate_id ? '<a class="btn btn-outline" href="#/estimate/' + encodeURIComponent(k.estimate_id) + '" aria-label="이 계약서의 견적서 보러 가기">견적서 보기</a>'
          : '<button class="btn btn-outline" type="button" disabled title="견적서 없이 만든 계약서예요">견적서 보기</button>';
      }
      function ctrActs(k) {
        var b = function (attr, label) { return '<button class="btn btn-outline" type="button" ' + attr + '="' + esc(k.id) + '">' + label + '</button>'; };
        var off = function (label, why) { return '<button class="btn btn-outline" type="button" disabled title="' + esc(why) + '">' + label + '</button>'; };
        // 셋째 칸: 서명하기(작성 중 → 4. 서명 화면, 맨 위에 '실물 도장을 받았나요?') / 공사 완료(계약 완료) / 공사 중으로(공사 완료) — 중단·파기한 계약서는 흐리게
        var third = k.status === 'draft' ? '<a class="btn btn-ok" href="#/contract/' + encodeURIComponent(k.id) + '/sign">서명하기</a>'
          : k.status === 'signed' ? b('data-done', '공사 완료') : k.status === 'done' ? b('data-undone', '공사 중으로')
          : k.status === 'canceled' ? off('서명하기', '다시 진행한 뒤에 쓸 수 있어요') : off('공사 완료', '계약 파기한 계약서예요');
        // 넷째 칸: 계약 중단(작성 중) / 계약 파기(계약 완료) — 중단한 계약서는 다시 진행, 파기한 계약서는 파기 내용
        var fourth = k.status === 'draft' ? b('data-cancel', '계약 중단') : k.status === 'signed' ? b('data-term', '계약 파기')
          : k.status === 'canceled' ? b('data-reopen', '다시 진행') : k.status === 'terminated' ? b('data-term', '파기 내용') : off('계약 파기', '공사를 마친 계약서예요');
        return estBtn(k) + third + fourth;
      }
      var bk = list.length ? K.bulk({ page: page, host: $('.lt-btns', page), noun: '계약서', warn: '서명·첨부 파일도 같이 휴지통으로 가요.', del: function (id) { return DB.deleteContract(id); }, after: viewList }) : null;
      if (list.length) { K.filterBind(page, 'ctrF', draw); K.dataTableBind(page, draw); }
      draw();
      page.addEventListener('click', function (e) {
        var x;
        if ((x = e.target.closest('[data-term]'))) { openTerminate(x.getAttribute('data-term'), viewList); return; }
        if ((x = e.target.closest('[data-cancel]')) || (x = e.target.closest('[data-reopen]'))) {
          var kid = x.getAttribute('data-cancel') || x.getAttribute('data-reopen'), stop = x.hasAttribute('data-cancel'), btn = x;
          (stop ? K.ask({ title: '계약하지 않고 중단할까요?', text: '계약서는 지우지 않고 <b>계약 중단</b>으로 남겨 둬요. 일정 달력의 공사 기간에서도 빠져요.<br>나중에 <b>다시 진행</b>을 누르면 되살릴 수 있어요.', cancel: '그만두기', ok: '중단하기' }) : Promise.resolve(true))
            .then(function (ok) {
              if (!ok) return;
              btn.disabled = true;
              return DB.getContract(kid).then(function (k) { k.status = stop ? 'canceled' : bothSigned(k.doc || {}) ? 'signed' : 'draft'; return DB.saveContract(k); })
                .then(function () { K.toast(stop ? '계약 중단으로 바꿨어요' : '다시 진행으로 바꿨어요 · 작성 중'); K.state.counts = null; viewList(); })
                .catch(function (err) { btn.disabled = false; fail('바꾸지 못했어요', /canceled|check/i.test(String(err && err.message)) ? new Error('계약 중단을 쓰려면 Supabase에서 설정 SQL(schema.sql)을 한 번 더 실행해야 해요. 앤에게 알려 주세요.') : err); });
            });
          return;
        }
        if ((x = e.target.closest('[data-copy]'))) return K.go('#/contract/copy/' + encodeURIComponent(x.getAttribute('data-copy')));
        if ((x = e.target.closest('[data-del]'))) {
          var id = x.getAttribute('data-del');
          K.ask({ title: '이 계약서를 지울까요?', text: '서명·첨부 파일까지 같이 휴지통으로 옮겨져 <b>30일</b> 동안 보관돼서 그동안은 <b>설정 → 휴지통</b>에서 되살릴 수 있어요.', cancel: '그만두기', ok: '지우기', okClass: 'btn-danger' })
            .then(function (ok) { if (ok) DB.deleteContract(id).then(function () { K.toast('휴지통으로 옮겼어요'); K.state.counts = null; viewList(); }).catch(function (err) { fail('지우지 못했어요', err); }); });
        }
        if ((x = e.target.closest('[data-done]')) || (x = e.target.closest('[data-undone]'))) {
          var cid = x.getAttribute('data-done') || x.getAttribute('data-undone'), to = x.hasAttribute('data-done') ? 'done' : 'signed';
          x.disabled = true;
          DB.getContract(cid).then(function (k) { k.status = to; return DB.saveContract(k); })
            .then(function () { viewList(); })
            .catch(function (err) { x.disabled = false; fail('바꾸지 못했어요', err); });
        }
      });
    }).catch(function (err) {
      app.innerHTML = '<div class="page"><div class="empty-box">계약서를 불러오지 못했어요.<br>' + esc(K.friendlyError(err)) + '</div></div>';
    });
  }
  /* ---------- 계약 파기: 날짜·위약금(없음/받음/줌, 금액, 정산 끝남)·사유를 기록 ---------- */
  function openTerminate(kid, done) {
    DB.getContract(kid).then(function (k) {
      if (!k) throw new Error('계약서를 찾을 수 없어요.');
      var doc = k.doc || {}, t = doc.termination || { date: K.today(), penalty: 'none', amount: '', settled: false, memo: '' }, was = k.status === 'terminated';
      var total = Math.round(num(doc.amount || k.total));
      var ov = document.createElement('div');
      ov.className = 'overlay';
      ov.innerHTML = '<div class="sheet form-sheet ct-term-sheet" role="dialog" aria-modal="true" aria-labelledby="tm-h"><h3 id="tm-h">' + (was ? '계약 파기 내용' : '계약 파기') + '</h3>' +
        '<p class="hint">' + esc(k.title || '계약서') + (k.customer_name ? ' · ' + esc(k.customer_name) + ' 고객님' : '') + '<br>계약서는 지우지 않고 <b>계약 파기</b>로 남겨요. 일정 달력·공사 중에서 빠져요.</p>' +
        '<div class="field"><label for="tm-date">파기한 날</label><input class="input" type="date" id="tm-date" data-label="파기한 날" value="' + esc(t.date || K.today()) + '"></div>' +
        '<div class="field"><span class="label">위약금</span><div class="choices tm-pen">' + PENALTY.map(function (p) {
          return '<label class="choice"><input type="radio" name="tm-pen" value="' + p[0] + '"' + ((t.penalty || 'none') === p[0] ? ' checked' : '') + '><span>' + p[1] + '</span></label>';
        }).join('') + '</div></div>' +
        '<div class="tm-more"' + ((t.penalty || 'none') === 'none' ? ' hidden' : '') + '>' +
        '<div class="field"><label for="tm-amt">위약금 금액</label><div class="est-suffix"><input class="input" id="tm-amt" inputmode="numeric" maxlength="15" value="' + esc(Math.round(num(t.amount)) ? won(num(t.amount)) : '') + '"><span>원</span></div>' +
        '<p class="hint">총 공사금액 ' + won(total) + '원 · 금액은 계약서의 해제·위약금 조항을 보고 정해 주세요.</p></div>' +
        '<label class="est-check"><input type="checkbox" id="tm-settled"' + (t.settled ? ' checked' : '') + '><span>위약금을 주고받기 끝났어요</span></label></div>' +
        '<div class="field"><label for="tm-memo">사유·메모 <span class="opt">(선택)</span></label><textarea class="textarea" id="tm-memo" rows="3" maxlength="500" placeholder="예) 고객 사정으로 착공 전 해제">' + esc(t.memo || '') + '</textarea></div>' +
        '<p class="error-msg" id="tm-err" hidden></p>' +
        '<div class="btn-row"><button type="button" class="btn btn-outline" data-tmx>그만두기</button><button type="button" class="btn btn-danger" data-tmok>' + (was ? '저장' : '계약 파기로 바꾸기') + '</button></div>' +
        (was ? '<button type="button" class="btn btn-text-danger tm-undo" data-tmundo>파기 취소 (계약 완료로 되돌리기)</button>' : '') + '</div>';
      document.body.appendChild(ov);
      function close() { ov.remove(); }
      ov.addEventListener('change', function (e) { if (e.target.name === 'tm-pen') $('.tm-more', ov).hidden = e.target.value === 'none'; });
      ov.addEventListener('input', function (e) { if (e.target.id === 'tm-amt') { var v = Math.round(num(e.target.value)); e.target.value = v ? won(v) : ''; } });
      ov.addEventListener('click', function (e) {
        if (e.target === ov || e.target.closest('[data-tmx]')) return close();
        var undo = e.target.closest('[data-tmundo]'), ok = e.target.closest('[data-tmok]');
        if (!undo && !ok) return;
        var pen = ($('input[name=tm-pen]:checked', ov) || {}).value || 'none';
        var amt = Math.round(num($('#tm-amt', ov).value));
        if (ok && pen !== 'none' && !amt) { var er = $('#tm-err', ov); er.textContent = '위약금 금액을 적어 주세요. (모르면 위약금 없음을 고르고 메모에 적어 주세요)'; er.hidden = false; return; }
        var btn = undo || ok; btn.disabled = true;
        if (undo) { k.status = bothSigned(doc) ? 'signed' : 'draft'; delete doc.termination; }
        else {
          k.status = 'terminated';
          doc.termination = { date: $('#tm-date', ov).value || K.today(), penalty: pen, amount: pen === 'none' ? '' : String(amt), settled: pen !== 'none' && $('#tm-settled', ov).checked,
            memo: $('#tm-memo', ov).value.trim().slice(0, 500) };
        }
        k.doc = doc;
        DB.saveContract(k).then(function () {
          close(); K.state.counts = null;
          K.toast(undo ? '파기를 취소했어요 · ' + STATUS[k.status] : was ? '저장했어요' : '계약 파기로 바꿨어요');
          if (done) done();
        }).catch(function (err) {
          btn.disabled = false;
          fail('저장하지 못했어요', /terminated|check/i.test(String(err && err.message)) ? new Error('계약 파기를 쓰려면 Supabase에서 설정 SQL(schema.sql)을 한 번 더 실행해야 해요. 앤에게 알려 주세요.') : err);
        });
      });
    }).catch(function (err) { fail('열지 못했어요', err); });
  }
  function nextNo(list, date) {
    var d = String(date || K.today()).replace(/-/g, '');
    var n = (list || []).filter(function (e) { return K.ymd(new Date(e.created_at || 0)).replace(/-/g, '') === d; }).length + 1;
    return 'MC-' + d + '-' + String(n).padStart(2, '0');
  }

  /* =====================================================================
     작성
     ===================================================================== */
  function viewEditor(args) {
    var mode = args[0] || 'new';      // 'new' | <id>
    K.frame('계약서', true, 'contracts');
    K.state.backTo = '#/contracts';
    app.innerHTML = '<div class="page"><div class="loading">불러오는 중…</div></div>';
    var rec = { id: null, estimate_id: null, customer_id: null, status: 'draft' };
    var first = Promise.all([loadSettings(), EK.loadCatalog ? EK.loadCatalog() : null]);
    var load;
    if (mode === 'new') {
      load = first.then(function () { return DB.listContracts(); }).then(function (list) {
        var doc = applyKind(blankDoc(), defaultKind()); doc.no = nextNo(list, doc.date);
        if (args[1] === 'e' && args[2]) {
          return DB.getEstimate(decodeURIComponent(args[2])).then(function (e) {
            if (e) { fromEstimate(doc, snapEstimate(e)); rec.estimate_id = e.id; rec.customer_id = e.customer_id || null; }
            return rec.customer_id && DB.getCustomer ? DB.getCustomer(rec.customer_id).then(function (c) { if (c && c.address && !doc.customer.address) doc.customer.address = c.address; return doc; }) : doc;
          });
        }
        if (args[1] === 'c' && args[2]) {
          return DB.getCustomer(decodeURIComponent(args[2])).then(function (c) {
            if (c) { doc.customer = { name: c.name || '', phone: c.phone || '', address: c.address || '' }; doc.site = c.address || ''; rec.customer_id = c.id; }
            return doc;
          });
        }
        return doc;
      });
    } else if (mode === 'copy') {
      // 복사해서 새로 만들기: 내용(고객·현장·금액·지급·조항·특약·공정)은 그대로, 서명·종이 서명·첨부 파일·파기 기록은 빼고 계약일은 오늘, 계약번호는 새로
      load = first.then(function () { return Promise.all([DB.getContract(decodeURIComponent(args[1] || '')), DB.listContracts()]); }).then(function (r) {
        if (!r[0]) throw new Error('복사할 계약서를 찾을 수 없어요.');
        var doc = Object.assign(blankDoc(), JSON.parse(JSON.stringify(r[0].doc || {})));
        doc.date = K.today(); doc.no = nextNo(r[1], doc.date);
        doc.title = doc.title ? doc.title + ' (복사)' : doc.title;
        doc.signs = { customer: null, supplier: null }; doc.paperSigned = false; doc.files = []; delete doc.termination;
        doc.attach = Object.assign({ estimate: true, detail: true, drawing: false, other: '' }, doc.attach || {});
        rec.customer_id = r[0].customer_id || null; rec.estimate_id = null;   // 견적서 연결은 원래 계약서에만 (복사본이 견적서의 '계약서'로 잡히지 않게)
        return doc;
      });
    } else {
      load = first.then(function () { return DB.getContract(decodeURIComponent(mode)); }).then(function (r) {
        if (!r) throw new Error('계약서를 찾을 수 없어요. 이미 지웠을 수 있어요.');
        rec = { id: r.id, estimate_id: r.estimate_id || null, customer_id: r.customer_id || null, status: r.status || 'draft', updated_at: r.updated_at };
        var doc = Object.assign(blankDoc(), r.doc || {});
        doc.signs = doc.signs || { customer: null, supplier: null };
        doc.attach = Object.assign({ estimate: true, detail: true, drawing: false, other: '' }, doc.attach || {});
        return doc;
      });
    }
    load.then(function (doc) {
      var startStep = args[1] === 'sign' ? 3 : args[1] === 'final' ? 4 : 0;   // 목록의 '서명하기' → 4. 서명(맨 위 실물 도장 확인) · final: 마지막 화면
      // 계약 완료(서명 끝)·공사 완료·계약 파기 계약서는 '보기' 화면부터 — 수정을 눌러야(#/contract/<id>/edit) 1단계부터 고침
      if (mode === 'copy') startStep = 0;
      var view = mode !== 'new' && mode !== 'copy' && !args[1] && (rec.status === 'signed' || rec.status === 'done' || rec.status === 'terminated');
      if (mode !== 'new' && args[1] === 'edit' && rec.status !== 'draft' && rec.status !== 'canceled') K.state.backTo = '#/contract/' + encodeURIComponent(rec.id);
      editor(rec, doc, mode === 'new' || mode === 'copy', startStep, view);
    }).catch(function (err) {
      app.innerHTML = '<div class="page"><div class="empty-box">' + esc(K.friendlyError(err)) + '<br><a href="#/contracts">계약서 목록으로</a></div></div>';
    });
  }

  function editor(rec, doc, isNew, startStep, viewing) {
    var autoDays = new WeakSet();   // 이름을 보고 기간을 저절로 넣은 공정 줄
    var clOpen = false;             // '계약서 조항 보기·고치기' 펼침 상태 (다시 그려도 그대로)
    var STEPS = [{ id: 'info', label: '1. 기본 정보' }, { id: 'money', label: '2. 금액·지급' }, { id: 'terms', label: '3. 조건' }, { id: 'sign', label: '4. 서명' }, { id: 'preview', label: '5. 미리보기·받기' }];
    var step = startStep || 0, saving = null, estList = null;
    var page = document.createElement('div');
    page.className = 'page est-page ct-page';
    app.innerHTML = ''; app.appendChild(page);
    K.titleEl.textContent = isNew ? '새 계약서' : viewing ? '계약서 보기' : '계약서';
    var custRec = null;   // 보기 화면의 고객 정보 (고객 관리에 있는 고객이면 메모까지)
    function dirty() { K.setDirty(true); var st = $('#est-saved', page); if (st) st.textContent = '고친 내용 저장 전'; }

    function save(quiet) {
      if (saving) return saving;
      var m = model(doc, rec);
      // 상태: 두 분 다 서명(또는 종이 서명) → 계약 완료, 아니면 작성 중. '공사 완료'는 직접 눌렀을 때만
      doc.phases = resolvePhases((doc.phases || []).filter(function (h) { return String(h.name || '').trim(); }), doc.start);
      if (rec.status === 'canceled' || rec.status === 'terminated') { /* 계약 중단·파기: 목록에서 바꾸기 전까지 그대로 */ }
      else if (!bothSigned(doc)) rec.status = 'draft';
      else if (rec.status !== 'done') rec.status = 'signed';
      var row = { id: rec.id || DB.newId(), customer_id: rec.customer_id, estimate_id: rec.estimate_id, customer_name: String(doc.customer.name || '').slice(0, 30),
        title: String(m.title).slice(0, 120), total: m.total, start_date: doc.start || null, end_date: doc.end || null, status: rec.status, doc: doc };
      var link = DB.ensureCustomer && K.digits(doc.customer.phone).length >= 9
        ? DB.ensureCustomer({ name: doc.customer.name, phone: doc.customer.phone, address: doc.customer.address || doc.site })
          .then(function (c) { if (c) row.customer_id = rec.customer_id = c.id; }).catch(function () {})
        : Promise.resolve();
      saving = link.then(function () { return DB.saveContract(row); }).then(function (saved) {
        rec.id = saved.id; rec.updated_at = saved.updated_at;
        K.setDirty(false); K.state.counts = null;
        var h = '#/contract/' + encodeURIComponent(rec.id);
        if (location.hash.indexOf(h) !== 0) K.setHash(h);
        var st = $('#est-saved', page); if (st) st.textContent = '저장됨 ' + new Date().toLocaleTimeString('ko-KR', { hour: 'numeric', minute: '2-digit' });
        if (!quiet) K.toast('저장했어요');
        return saved;
      }).catch(function (err) { fail('저장하지 못했어요', err); throw err; })
        .then(function (r) { saving = null; return r; }, function (e) { saving = null; throw e; });
      return saving;
    }
    function go(i) {
      i = Math.max(0, Math.min(STEPS.length - 1, i));
      var move = function () { step = i; render(); window.scrollTo(0, 0); };
      if (K.state.dirty || (!rec.id && i > 0)) save(true).then(move, function () {}); else move();
    }

    function frameHtml(inner) {
      return '<nav class="est-steps" aria-label="계약서 단계">' + STEPS.map(function (s, i) {
        return '<button type="button" class="est-step' + (i === step ? ' on' : '') + (i < step ? ' past' : '') + '" data-step="' + i + '"' + (i === step ? ' aria-current="step"' : '') + '>' + esc(s.label) + '</button>';
      }).join('') + '</nav><div class="est-body">' +
        (rec.status === 'canceled' ? '<div class="tip warn ct-canceled">' + I.info + '<span><b>계약하지 않고 중단한 계약서예요.</b> 다시 진행하려면 계약서 목록에서 <b>다시 진행</b>을 눌러 주세요.</span></div>' : '') +
        (rec.status === 'terminated' ? '<div class="tip warn ct-canceled">' + I.info + '<span><b>계약 파기한 계약서예요.</b> ' + esc(termSummary(doc.termination)) + (doc.termination && doc.termination.memo ? ' · ' + esc(doc.termination.memo) : '') + ' <button type="button" class="btn-link" data-term="' + esc(rec.id || '') + '">파기 내용 보기·고치기</button></span></div>' : '') +
        inner + '</div>' +
        '<div class="savebar est-bar"><div class="est-sum"><small>' + esc(STATUS[rec.status] || '작성 중') + ' · 총 공사금액</small><b id="ct-total">' + won(num(doc.amount)) + '원</b>' +
        '<span class="est-saved" id="est-saved">' + (rec.id ? '저장됨' : '아직 저장 안 됨') + '</span></div>' +
        // 어느 단계에서든 바로 저장: 첫 단계 '다음 · 저장', 가운데 '이전 · 다음 · 저장', 마지막 '이전 · 저장하고 마치기'
        '<div class="est-nav' + (step > 0 && step < STEPS.length - 1 ? ' three' : '') + '">' + (step > 0 ? '<button class="btn btn-outline" type="button" data-prev>이전</button>' : '') +
        (step < STEPS.length - 1 ? '<button class="btn btn-primary" type="button" data-next aria-label="다음: ' + esc(STEPS[step + 1].label.replace(/^\d\.\s*/, '')) + '">다음</button>'
          : '<button class="btn btn-primary" type="button" data-finish>저장하고 마치기</button>') +
        (step < STEPS.length - 1 ? '<button class="btn btn-outline" type="button" data-save>저장</button>' : '') + '</div></div>';   // 마지막 단계: 저장한 뒤 서명했으면 보기 화면, 아니면 계약서 목록으로
    }
    // 서명한 뒤에는 내용 칸을 잠금
    function lockWrap(html) {
      if (!signed(doc)) return html;
      return '<div class="ct-lock">' + I.info + '<span><b>서명된 계약서예요.</b> 내용을 고치려면 서명을 먼저 지워야 해요.</span>' +
        '<button type="button" class="btn btn-outline btn-sm" data-unsign>서명 지우고 고치기</button></div><fieldset class="ct-fs" disabled>' + html + '</fieldset>';
    }
    function fld(id, label, val, o) {
      o = o || {};
      var input = o.area ? '<textarea class="textarea" id="' + id + '" rows="' + (o.rows || 3) + '" maxlength="' + (o.max || 2000) + '"' + (o.ph ? ' placeholder="' + esc(o.ph) + '"' : '') + '>' + esc(val || '') + '</textarea>'
        : '<input class="input" id="' + id + '" type="' + (o.type || 'text') + '"' + (o.minFrom ? ' data-min-from="' + o.minFrom + '"' : '') + (o.mode ? ' inputmode="' + o.mode + '"' : '') + ' maxlength="' + (o.max || 120) + '" value="' + esc(val == null ? '' : val) + '"' + (o.ph ? ' placeholder="' + esc(o.ph) + '"' : '') + (o.type === 'tel' ? ' autocomplete="off"' : '') + '>';
      return '<div class="field' + (o.wide ? ' est-wide' : '') + '"><label for="' + id + '">' + label + (o.opt ? ' <span class="opt">(선택)</span>' : '') + '</label>' +
        (o.suffix ? '<div class="est-suffix">' + input + '<span>' + esc(o.suffix) + '</span></div>' : input) + (o.hint || o.hintId ? '<p class="hint"' + (o.hintId ? ' id="' + o.hintId + '"' : '') + (o.hint ? '' : ' hidden') + '>' + (o.hint || '') + '</p>' : '') + '</div>';
    }

    /* ----- 1) 기본 정보 ----- */
    function infoHtml() {
      var d = daysBetween(doc.start, doc.end);
      return '<h2 class="est-h">기본 정보</h2>' + lockWrap(
        kindsCardHtml() +
        '<div class="txt-card est-card"><span class="label ct-label">견적서에서 불러오기</span>' +
        // 불러온 견적서: 누르면 그 견적서로 (고친 게 있으면 먼저 저장)
        (doc.estimate ? ((doc.estimate.id || rec.estimate_id) ? '<a class="ct-est ct-est-go" href="#/estimate/' + encodeURIComponent(doc.estimate.id || rec.estimate_id) + '" data-estgo>' : '<p class="ct-est">') +
          I.doc + '<span><b>' + esc(doc.estimate.title) + '</b><small>' + esc(doc.estimate.no || '') + ' · ' + won(doc.estimate.totals.total) + '원</small></span>' +
          ((doc.estimate.id || rec.estimate_id) ? '<em class="ct-est-more">견적서 보기' + I.right + '</em></a>' : '</p>') : '') +
        K.finderField('ct-est', { ph: doc.estimate ? '다른 견적서 찾기' : '견적서 찾기 (고객 이름·전화번호·현장)', go: doc.estimate ? '바꾸기' : '찾기' }) +
        '</div>' +   // 아래 부가 설명(고르면 … 채워지고 …)은 뺌 (2026-10-26 요청)
        '<div class="txt-card est-card"><div class="est-grid">' +
        fld('ct-cname', '고객(도급인) 이름', doc.customer.name, { ph: '예) 김○○', max: 30 }) +
        fld('ct-cphone', '연락처', doc.customer.phone, { type: 'tel', ph: '010-0000-0000', max: 20 }) +
        '<div class="est-wide bl-slot" id="bl-slot"></div>' +   // 블랙리스트 연락처면 경고
        '<div class="field est-wide"><label for="ct-caddr-sido">고객 주소</label>' + K.regionPick('ct-caddr', doc.customer.address, { detail: { ph: '동네 · 아파트 이름 (예: ○○동 ○○아파트)', label: '고객 주소 동네 · 아파트 이름' }, unit: { ph: '동·호수 (예: 101동 1001호)', label: '상세 주소 (동·호수)' } }) + '</div>' +
        fld('ct-title', '공사명', doc.title, { ph: '비워 두면: 공사 장소 + 인테리어 공사', wide: true }) +
        '<div class="field est-wide"><label for="ct-site-sido">공사 장소</label>' + K.regionPick('ct-site', doc.site, { detail: { ph: '동네 · 아파트 이름 (예: ○○동 ○○아파트)', label: '공사 장소 동네 · 아파트 이름' }, unit: { ph: '동·호수 (예: 101동 1001호)', label: '상세 주소 (동·호수)' } }) + '</div>' +
        '</div></div>' +
        '<div class="txt-card est-card"><div class="est-grid">' +
        fld('ct-date', '계약일', doc.date, { type: 'date' }) + '<div class="field only-wide"></div>' +
        fld('ct-start', '착공일', doc.start, { type: 'date' }) +
        fld('ct-end', '준공일 (공사 마치는 날)', doc.end, { type: 'date', minFrom: 'ct-start', hint: d > 0 ? '공사 기간 ' + d + '일' : '', hintId: 'ct-days' }) +   // 부가 설명(날짜를 적으면 … 달력에 …)은 뺌 — 공사 기간 일수만 (2026-10-26)
        (doc.estimate && doc.estimate.period ? '<p class="hint est-wide">견적서에 적은 예상 시공기간: ' + esc(doc.estimate.period) + '</p>' : '') +
        '</div></div>') + phasesHtml() + filesHtml();
    }
    /* ----- 첨부 파일 (종이 계약서 스캔·도면·엑셀 등) — 서명한 뒤에도 올리고 지울 수 있음. 관리자만 보는 저장소 ----- */
    var fileBusy = false;
    var FBADGE = [[/pdf/, 'PDF', 'pdf'], [/^image\//, '사진', 'img'], [/hwp/, '한글', 'hwp'], [/word/, '워드', 'doc'], [/excel|spreadsheet|csv/, '엑셀', 'xls'],
      [/powerpoint|presentation/, 'PPT', 'ppt'], [/zip/, 'ZIP', 'zip']];
    function fileBadge(f) {
      var ext = (/\.([a-z0-9]+)$/i.exec(f.name || '') || [])[1] || '';
      if (/^(dwg|dxf)$/i.test(ext)) return '<span class="cf-ico t-cad">CAD</span>';
      if (/^hwpx?$/i.test(ext)) return '<span class="cf-ico t-hwp">한글</span>';
      var b = FBADGE.filter(function (x) { return x[0].test(f.type || ''); })[0];
      return '<span class="cf-ico t-' + (b ? b[2] : 'etc') + '">' + (b ? b[1] : '파일') + '</span>';
    }
    function sizeText(n) { n = +n || 0; return n >= 1048576 ? (n / 1048576).toFixed(1) + 'MB' : Math.max(1, Math.round(n / 1024)) + 'KB'; }
    function filesHtml() {
      var files = Array.isArray(doc.files) ? doc.files : [];
      return '<div class="txt-card est-card ct-files" id="ct-files"><div class="ct-pay-head"><span class="label ct-label">첨부 파일 <span class="opt">(선택)</span></span>' + (files.length ? '<span class="cf-n">' + files.length + '개</span>' : '') + '</div>' +
        // 제목 바로 아래 파일 올리기 → 짧은 설명 두 줄 → 올린 파일 목록 (2026-10-26 요청)
        '<label class="btn btn-outline cf-add' + (fileBusy ? ' busy' : '') + '">' + I.plus + '<span>' + (fileBusy ? '올리는 중…' : '파일 올리기') + '</span>' +
        '<input type="file" class="cf-input" id="ct-file" multiple accept="' + esc(DB.fileAccept || '') + '"' + (fileBusy ? ' disabled' : '') + '></label>' +
        '<p class="hint cf-limit">종이 계약서를 찍은 사진·스캔본, 도면, 견적 엑셀 같은 파일.<br>PDF·사진·한글·워드·엑셀·파워포인트·CAD·ZIP. 20MB까지</p>' +
        '<p class="hint cf-prog" id="cf-prog" role="status"' + (fileBusy ? '' : ' hidden') + '></p>' +
        (files.length ? '<ul class="cf-list">' + files.map(function (f, i) {
          var at = f.at ? K.ymd(new Date(f.at)).replace(/-/g, '.') : '';
          return '<li class="cf-row" data-fi="' + i + '">' + fileBadge(f) +
            '<button type="button" class="cf-name" data-fopen title="열기"><b>' + esc(f.name) + '</b><small>' + esc([sizeText(f.size), at].filter(Boolean).join(' · ')) + '</small></button>' +
            '<button type="button" class="btn btn-outline btn-sm cf-get" data-fget aria-label="' + esc(f.name) + ' 받기">' + I.down + '<span>받기</span></button>' +
            '<button type="button" class="est-x" data-fdel aria-label="' + esc(f.name) + ' 지우기">' + I.trash + '</button></li>';
        }).join('') + '</ul>' : '') + '</div>';
    }
    function fileProg(t) { var el = $('#cf-prog', page); if (el) { el.hidden = !t; el.textContent = t || ''; } }
    function addFiles(list) {
      list = Array.prototype.slice.call(list || []);
      if (!list.length || fileBusy) return;
      var bad = [], ok = [], have = (doc.files || []).length;
      list.forEach(function (f) { try { DB.fileCheck(f); ok.push(f); } catch (e) { bad.push(esc(e.message)); } });
      if (have + ok.length > 30) { bad.push('한 계약서에 파일은 30개까지 붙일 수 있어요.'); ok = ok.slice(0, Math.max(0, 30 - have)); }
      var report = function () { if (bad.length) K.ask({ title: '올리지 못한 파일이 있어요', text: bad.join('<br>'), cancel: false, ok: '확인' }); };
      if (!ok.length) return report();
      fileBusy = true; render();
      fileProg('올리는 중… 0 / ' + ok.length);
      var added = [];
      // 새 계약서는 먼저 저장해야 파일을 계약서에 붙일 수 있음 (저장소 폴더 = 계약서 번호)
      (rec.id ? Promise.resolve() : save(true)).then(function () {
        return ok.reduce(function (p, f) {
          return p.then(function () {
            return DB.uploadFile('contracts/' + rec.id, f).then(function (meta) { added.push(meta); fileProg('올리는 중… ' + added.length + ' / ' + ok.length); },
              function (err) { bad.push(esc('"' + f.name + '" — ' + K.friendlyError(err))); });
          });
        }, Promise.resolve());
      }).then(function () {
        if (!added.length) return;
        doc.files = (doc.files || []).concat(added);
        return save(true).then(function () { K.toast('파일 ' + added.length + '개를 올렸어요'); });
      }).catch(function () {}).then(function () { fileBusy = false; render(); report(); });
    }
    function openFile(i, download) {
      var f = (doc.files || [])[i];
      if (!f) return;
      var view = !download && /^(application\/pdf|image\/(jpeg|png|webp))$/.test(f.type || '');
      var w = null;
      if (view) {   // 새 창은 누르는 순간에 열어야 막히지 않음 → 파일을 받은 뒤 그 창에 보여 줌
        try { w = window.open('', '_blank'); if (w) { w.document.title = f.name; w.document.body.innerHTML = '<p style="font:16px sans-serif;padding:24px">불러오는 중…</p>'; } } catch (e) { w = null; }
      }
      if (w && DB.fileUrl) {   // 보기: 저장소의 2분짜리 주소로 새 창에서 (PDF·사진)
        return DB.fileUrl(f.path).then(function (u) { if (!w.closed) w.location.href = u; })
          .catch(function (err) { try { w.close(); } catch (e) {} fail('파일을 열지 못했어요', err); });
      }
      K.toast('파일을 받는 중…');   // 받기: 원래 파일 이름 그대로 저장
      DB.getFile(f.path).then(function (blob) {
        K.saveBlob(blob.type === f.type ? blob : blob.slice(0, blob.size, f.type), f.name);
      }).catch(function (err) { fail('파일을 받지 못했어요', err); });
    }
    function delFile(i) {
      var f = (doc.files || [])[i];
      if (!f) return;
      K.ask({ title: '이 파일을 지울까요?', text: '<b>' + esc(f.name) + '</b><br>휴지통에 <b>30일</b> 동안 보관돼서 그동안은 <b>설정 → 휴지통</b>에서 되살릴 수 있어요.', cancel: '그만두기', ok: '지우기', okClass: 'btn-danger' }).then(function (ok) {
        if (!ok) return;
        // 휴지통에 먼저 적고(파일은 저장소에 그대로) 계약서에서 뺌 — 30일 뒤 완전히 지워짐
        var title = [doc.customer && doc.customer.name, doc.title].filter(Boolean).join(' · ');
        (DB.trashFile ? DB.trashFile(rec.id, f, title) : Promise.resolve()).then(function () {
          doc.files.splice(i, 1);
          return save(true).then(function () {
            if (!DB.trashFile) DB.removeFiles([f.path]).catch(function () {});
            render(); K.toast('파일을 휴지통으로 옮겼어요');
          }, function () { doc.files.splice(i, 0, f); render(); });
        }).catch(function (err) { fail('파일을 지우지 못했어요', err); });
      });
    }
    // 계약서 종류 카드 (설정 → 계약서 종류에서 만든 것). 설정에서 지운 종류로 만든 계약서는 '지금 내용'을 따로 보여 줌
    function kindsCardHtml() {
      var kinds = (SET && SET.kinds) || [], cur = kindOf(doc.kind);
      var curList = (doc.mode === 'simple' ? doc.simpleClauses : doc.clauses) || [], kn = doc.kindName && !/^(표준|간단) 계약서$/.test(doc.kindName) ? doc.kindName + ' · ' : '';
      // 지금 설정 목록에 없는 종류(예전에 만들었거나 설정에서 지운 종류)로 만든 계약서: 그 이름과 '이 계약서 조항 그대로'라고 알려 줌
      var oldName = (doc.kindName && doc.kindName.trim()) || (doc.mode === 'simple' ? '간단 계약서' : '표준 계약서');
      var sum = cur ? kindSummary(cur) : '이 계약서를 만들 때 쓴 종류예요(지금 종류 목록에는 없어요) · 조항 ' + curList.length + '개. 다른 종류를 고르면 조항이 그 종류로 바뀌어요.';
      // 이 계약서의 부가세가 종류 기본값과 다르면(견적서에서 불러왔거나 2단계에서 바꿈) 실제 값을 함께 — '부가세 포함'이라고만 보여 헷갈리지 않게
      // 조항 묶음을 따로 불러왔으면(3. 조건 → 조항 묶음 불러오기) 실제 조항 묶음·개수로
      if (cur && doc.clauseSet && setOf(doc.clauseSet) && doc.clauseSet !== cur.clauseSet) {
        var kr = kindClauses(cur), kpre = (kr.set ? kr.set.name : '표준 계약서') + ' · 조항 ' + kr.list.length + '개';
        sum = sum.replace(kpre, setOf(doc.clauseSet).name + ' · 조항 ' + ((doc.mode === 'simple' ? doc.simpleClauses : doc.clauses) || []).length + '개 (직접 고름)');
      }
      if (cur && doc.vat && cur.vat && doc.vat !== cur.vat) {
        var vn = function (v) { return ((VATS.filter(function (x) { return x[0] === v; })[0] || ['', ''])[1]).replace('적지 않기', '부가세 안 적음'); };
        sum = sum.replace(vn(cur.vat), vn(doc.vat) + ' (' + (rec.estimate_id ? '견적서대로' : '직접 바꿈') + ' — 종류 기본은 ' + vn(cur.vat) + ')');
      }
      return '<div class="txt-card est-card"><div class="ct-pay-head ck-head"><label class="label ct-label" for="ct-kind">계약서 종류</label>' +
        '<a class="btn btn-outline btn-sm ck-setbtn" href="#/contracts/settings/kinds">' + I.gear + '종류 설정</a></div>' +
        '<select class="select ck-sel" id="ct-kind">' + (cur ? '' : '<option value="" selected>' + esc(oldName) + ' (이 계약서 조항)</option>') +
        kinds.map(function (k) { return '<option value="' + esc(k.id) + '"' + (cur && cur.id === k.id ? ' selected' : '') + '>' + esc(k.name) + '</option>'; }).join('') +
        '</select><p class="hint ck-cur" id="ct-kind-sum">' + esc(sum) + '</p></div>';
    }
    // 세부 공사일정 — 서명한 뒤에도 고칠 수 있음 (계약 내용이 아니라 진행 일정)
    function phasesHtml() {
      var rows = resolvePhases(doc.phases, doc.start);
      return '<div class="txt-card est-card ct-phases-card"><div class="ct-pay-head"><span class="label ct-label">세부 공사일정 <span class="opt">(선택)</span></span></div>' +
        '<p class="hint">한 공사 안의 순서를 적어요. 예) 철거 1일 → 전기 3일 → 목공 4일 → 청소 2일. <b>시작일을 비워 두면 앞 일정 다음 날</b>로 이어지고, 일정 달력에 공정 이름으로 나와요.</p>' + phaseSetsLoad() +   // 순서 묶음 불러오기를 맨 위에서 먼저 (2026-10-26 요청)
        '<div class="ph-pick" role="group" aria-label="공정 고르기 — 누르면 넣고, 다시 누르면 빼요">' + phaseList().map(function (q) {
          return pickTile(q.name, phaseDays(q.name), rows.some(function (h) { return nkey(h.name) === nkey(q.name); }), 'data-hq');
        }).join('') + '</div>' +
        '<div class="ct-phases">' + rows.map(function (h, i) {
          return '<div class="ct-phase" data-hi="' + i + '"><div class="ph-top"><span class="ph-no">' + (i + 1) + '</span>' +
            '<label class="sr-only" for="ph-name-' + i + '">' + (i + 1) + '번 공정 이름</label><input class="input ph-name" id="ph-name-' + i + '" data-h="name" maxlength="30" value="' + esc(h.name) + '" placeholder="공정 이름 (예: 전기공사)">' +
            '<button type="button" class="est-x" data-hdel aria-label="이 일정 지우기">' + I.trash + '</button></div>' +
            '<div class="ph-row"><div class="field"><label for="ph-start-' + i + '">시작일</label><input class="input" type="date" id="ph-start-' + i + '" data-h="start" data-label="' + (i + 1) + '번 공정 시작일" value="' + esc(h.start) + '"></div>' +
            '<div class="field"><label for="ph-days-' + i + '">기간</label><div class="est-suffix"><input class="input" id="ph-days-' + i + '" data-h="days" inputmode="numeric" maxlength="3" value="' + esc(h.days) + '"><span>일</span></div></div></div>' +
            '<small class="ph-range" data-hr="' + i + '">' + phaseRange(h) + '</small></div>';
        }).join('') + '</div>' +
        '<button type="button" class="btn btn-outline est-addline" data-hadd>' + I.plus + '일정 추가</button>' + phaseSetsBar(rows) + '</div>';
    }
    // 순서 묶음 불러오기 (드롭다운에서 고르면 바로) — 이미 적은 일정이 있으면 바꿀지 물어봄, '그만두기'면 드롭다운도 원래대로
    function loadPhaseSet(i) {
      var S1 = phaseSets()[i]; if (!S1) return render();
      var apply = function () {
        doc.phases = S1.items.map(function (it) { return { name: String(it.name), start: '', days: String(Math.max(1, Math.round(num(it.days)) || 1)) }; });
        dirty(); render(); K.toast('‘' + S1.name + '’ 순서를 불러왔어요 · 착공일부터 이어져요');
      };
      if ((doc.phases || []).length) return K.ask({ title: '이 순서로 바꿀까요?', text: '지금 적은 세부 공사일정 ' + doc.phases.length + '개가 <b>‘' + esc(S1.name) + '’</b>(' + S1.items.length + '개)로 바뀌어요.', cancel: '그만두기', ok: '바꾸기' }).then(function (ok) { if (ok) apply(); else render(); });
      return apply();
    }
    function phaseRange(h) {
      if (!h.from) return '착공일이나 시작일을 정하면 날짜가 나와요';
      var late = doc.end && h.to > doc.end;
      return K.sDate(h.from) + (h.to !== h.from ? ' ~ ' + K.sDate(h.to) : '') + (late ? ' <b class="warn">· 준공일보다 늦어요</b>' : '');
    }
    // 순서 묶음 (설명 바로 아래 · 공정 고르기 칸 위) — 견적서 '묶음으로 한 번에 고르기'와 같은 모양: 자체 드롭다운에서 고르면 바로 불러옴 + 전체 해제
    // 드롭다운에는 지금 세부 공사일정과 똑같은(공정 이름·일수·순서) 묶음이 보이고, 아니면 '순서 묶음 고르기'
    function phaseSetsLoad() {
      var sets = phaseSets();
      if (!sets.length) return '';
      var sig = function (list) { return list.map(function (h) { return nkey(h.name) + ':' + Math.max(1, Math.round(num(h.days)) || 1); }).join('|'); };
      var now = sig((doc.phases || []).filter(function (h) { return String(h.name || '').trim(); })), cur = -1;
      sets.forEach(function (x, i) { if (cur < 0 && now && sig(x.items) === now) cur = i; });
      return '<div class="est-sets ct-msets"><span class="label" id="ph-set-l">순서 묶음으로 한 번에 고르기</span><div class="est-sets-r">' +
        K.dsel('ph-set', sets.map(function (x, i) { return { v: i, t: x.name, sub: x.items.length + '개 · ' + x.items.reduce(function (a, it) { return a + (Math.round(num(it.days)) || 1); }, 0) + '일' }; }), cur >= 0 ? cur : '', { ph: '순서 묶음 고르기', labelledby: 'ph-set-l' }) +
        '<button type="button" class="btn btn-outline est-clear" data-hclear' + ((doc.phases || []).length ? '' : ' disabled') + '>전체 해제</button></div></div>';
    }
    // 맨 아래: 지금 순서를 묶음으로 저장 (묶음이 하나도 없으면 만드는 방법 안내)
    function phaseSetsBar(rows) {
      var sets = phaseSets();
      return '<div class="ph-sets">' +
        (rows.length ? '<button type="button" class="btn-link" data-hsetsave>지금 순서를 묶음으로 저장</button>' : (sets.length ? '' : '<p class="hint">자주 쓰는 공정 순서는 일정을 넣은 뒤 <b>지금 순서를 묶음으로 저장</b>을 누르거나, 계약서 설정 → 공정·순서에서 만들어 두면 다음부터 한 번에 불러올 수 있어요.</p>')) +
        '</div>';
    }
    // 공정 고르기 칸의 체크 표시만 다시 (공정 이름을 직접 고칠 때)
    function chipSync() {
      var names = (doc.phases || []).map(function (h) { return String(h.name || '').replace(/\s+/g, ''); });
      $$('[data-hq]', page).forEach(function (b) {
        var n = b.getAttribute('data-hq'), on = names.indexOf(n.replace(/\s+/g, '')) >= 0;
        if ((b.getAttribute('aria-pressed') === 'true') === on) return;
        b.classList.toggle('on', on); b.setAttribute('aria-pressed', String(on));
        var box = $('.ph-box', b); if (box) box.innerHTML = on ? I.check : '';
      });
    }
    function phaseRefresh() {
      resolvePhases(doc.phases, doc.start).forEach(function (h, i) { var el = $('[data-hr="' + i + '"]', page); if (el) el.innerHTML = phaseRange(h); });
    }
    /* ----- 2) 금액·지급 ----- */
    function moneyHtml() {
      return '<h2 class="est-h">금액·지급</h2>' + lockWrap(
        '<div class="txt-card est-card">' +
        fld('ct-amount', '총 공사금액', doc.amount ? won(num(doc.amount)) : '', { mode: 'numeric', max: 15, suffix: '원', hint: '<span id="ct-words">' + (num(doc.amount) ? esc('일금 ' + EK.hangul(num(doc.amount)) + '원정') : '숫자만 적어요') + '</span>' }) +
        '<div class="field"><span class="label">부가세</span><div class="choices">' + VATS.map(function (v) {
          return '<label class="choice"><input type="radio" name="ct-vat" value="' + v[0] + '"' + (doc.vat === v[0] ? ' checked' : '') + '><span>' + v[1] + '</span></label>';
        }).join('') + '</div></div></div>' +
        '<div class="txt-card est-card"><div class="ct-pay-head"><span class="label ct-label">대금 지급 일정</span>' +
        '<button type="button" class="btn btn-outline btn-sm" data-split>비율대로 나누기</button></div>' +
        '<div class="ct-pays">' + doc.payments.map(function (p, i) {
          return '<div class="ct-pay" data-pi="' + i + '"><div class="ct-pay-top"><input class="input" data-p="label" value="' + esc(p.label) + '" maxlength="20" aria-label="구분">' +
            '<div class="est-suffix ct-pct"><input class="input" data-p="pct" value="' + esc(p.pct) + '" inputmode="decimal" maxlength="5" aria-label="비율"><span>%</span></div>' +
            '<button type="button" class="est-x" data-pdel aria-label="이 줄 지우기">' + I.trash + '</button></div>' +
            '<div class="ct-pay-grid"><label><span>금액 (원)</span><input class="input" data-p="amount" value="' + esc(p.amount ? won(num(p.amount)) : '') + '" inputmode="numeric" maxlength="15" placeholder="0"></label>' +
            '<label><span>지급 시기</span><input class="input" data-p="when" value="' + esc(p.when) + '" maxlength="60" placeholder="예) 계약할 때"></label></div></div>';
        }).join('') + '</div>' +
        '<button type="button" class="btn btn-outline est-addline" data-padd>' + I.plus + '지급 줄 추가</button>' +
        '<p class="ct-paycheck" id="ct-paycheck"></p></div>' +
        '<div class="txt-card est-card">' + fld('ct-account', '입금 계좌', doc.account, { ph: '예) ○○은행 000-000000-00 (예금주 최원진)', wide: true, opt: true, hint: '계약서 설정에 적어 두면 새 계약서마다 저절로 들어가요.' }) + '</div>');
    }
    function payCheck() {
      var el = $('#ct-paycheck', page); if (!el) return;
      var total = Math.round(num(doc.amount)), sum = paySum(doc);
      if (!total) { el.className = 'ct-paycheck'; el.textContent = '총 공사금액을 먼저 적어 주세요.'; return; }
      if (sum === total) { el.className = 'ct-paycheck ok'; el.textContent = '지급 합계 ' + won(sum) + '원 = 총 공사금액과 같아요'; return; }
      el.className = 'ct-paycheck bad';
      el.textContent = '지급 합계 ' + won(sum) + '원 — 총 공사금액보다 ' + won(Math.abs(total - sum)) + '원 ' + (sum < total ? '적어요' : '많아요');
    }
    /* ----- 3) 조건 ----- */
    function termsHtml() {
      var w = doc.warranty || {}, clauses = doc.mode === 'simple' ? doc.simpleClauses : doc.clauses;
      return '<h2 class="est-h">조건</h2>' + lockWrap(
        '<div class="txt-card est-card"><span class="label ct-label">하자보수 기간</span><div class="ct-warr">' +
        '<span>공사를 마친 날부터</span><input class="input" id="ct-wn" inputmode="numeric" maxlength="2" value="' + esc(w.n || '') + '" aria-label="기간">' +
        '<select class="select" id="ct-wu" aria-label="단위"><option' + (w.unit !== '개월' ? ' selected' : '') + '>년</option><option' + (w.unit === '개월' ? ' selected' : '') + '>개월</option></select></div>' +
        fld('ct-wnote', '덧붙이는 말', w.note, { opt: true, ph: '예) 방수 공사는 3년', max: 80 }) + '</div>' +
        (doc.mode === 'standard' ? '<div class="txt-card est-card">' +
          fld('ct-late', '지연손해금 (손님이 대금을 늦게 줄 때)', doc.lateRate, { ph: '예) 연 6%', max: 60 }) +
          (String(doc.delayRate || '').trim() ? fld('ct-delay', '지체상금 (예전 계약서에 적힌 값)', doc.delayRate, { max: 80 }) : '') + '</div>' : '') +
        '<div class="txt-card est-card"><span class="label ct-label">첨부 서류</span>' +
        (doc.estimate ? '<label class="est-check"><input type="checkbox" id="ct-att-est"' + (doc.attach.estimate ? ' checked' : '') + '><span>공사 내역서(견적서) 붙이기</span></label>' +
          '<label class="est-check ct-sub"' + (doc.attach.estimate ? '' : ' hidden') + '><input type="checkbox" id="ct-att-det"' + (doc.attach.detail ? ' checked' : '') + '><span>세부 내역(품명·수량·단가)까지</span></label>'
          : '<p class="hint">견적서를 불러오면 공사 내역서를 계약서 뒤에 붙일 수 있어요.' + (doc.mode === 'simple' ? ' <b>간단 계약서 제1조가 ‘첨부한 공사 내역서’를 가리키니 붙이는 걸 권해요.</b>' : '') + '</p>') +
        '<label class="est-check"><input type="checkbox" id="ct-att-draw"' + (doc.attach.drawing ? ' checked' : '') + '><span>설계도면 있음</span></label>' +
        fld('ct-att-other', '그 밖의 첨부', doc.attach.other, { opt: true, ph: '예) 자재 샘플 사진', max: 80 }) + '</div>' +
        '<div class="txt-card est-card">' + fld('ct-specials', '특약사항', doc.specials, { area: true, rows: 4, max: 2000, opt: true, ph: '예) 기존 붙박이장은 철거하지 않음\n예) 엘리베이터 보양비는 수급인이 부담', hint: '한 줄에 하나씩 적으면 줄마다 번호가 붙어요.' }) + '</div>' +
        '<details class="more ct-clauses ct-cedit"' + (clOpen ? ' open' : '') + '><summary><span>계약서 조항 보기·고치기 (<span id="ct-cl-n">' + (clauses || []).length + '</span>개)</span></summary><div class="in">' +   // 제목을 한 덩어리로 (전에는 '( 13 개)'가 벌어져 보였음)
        clauseSetsLoad() +   // 조항 묶음(계약서 설정에 만들어 둔 프리셋) 불러오기 — 순서 묶음과 같은 모양
        '<p class="hint ct-cl-tip">여기서 고친 조항은 <b>이 계약서에만</b> 들어가요.</p>' +
        '<div id="ct-cl-list">' + clauseRows() + '</div>' +
        '<button type="button" class="btn btn-outline est-addline" data-ccadd>' + I.plus + '조항 추가</button>' +
        // '계약서 종류 설정' 단추는 뺌 — 종류는 1단계 맨 위에서 이미 고름 (그 옆 '종류 설정' 단추는 그대로) (2026-10-26)
        '<button type="button" class="btn btn-text-danger set-reset" data-ccreset>‘' + esc(kindLabel()) + '’ 조항으로 되돌리기</button></div></details>');
    }
    // 조항 묶음 (계약서 조항 보기·고치기 맨 위) — 견적서 '묶음으로 한 번에 고르기'와 같은 자체 드롭다운: 고르면 바로 이 계약서 조항을 그 묶음으로 (물어봄)
    // 드롭다운에는 지금 조항과 똑같은 묶음이 보이고, 조항을 고쳤으면 '조항 묶음 고르기'. 개수는 지금 종류의 결제 방법 조항까지 셈
    function clauseSetsLoad() {
      var sets = (SET && SET.clauseSets) || [];
      if (!sets.length) return '';
      var ck = kindOf(doc.kind), sig = function (list) { return JSON.stringify((list || []).map(function (c) { return [String(c.title || '').trim(), String(c.body || '').trim()]; })); };
      var now = sig(activeClauses()), cur = '';
      sets.forEach(function (x) { if (!cur && sig(kindClauses({ clauseSet: x.id, payClause: ck && ck.payClause }).list) === now) cur = x.id; });
      return '<div class="est-sets ct-msets ct-cl-sets"><span class="label" id="ct-clset-l">조항 묶음으로 한 번에 고르기</span><div class="est-sets-r">' +
        K.dsel('ct-clset', sets.map(function (x) { return { v: x.id, t: x.name, sub: kindClauses({ clauseSet: x.id, payClause: ck && ck.payClause }).list.length + '개' }; }), cur, { ph: '조항 묶음 고르기', labelledby: 'ct-clset-l' }) +
        '</div></div>';
    }
    function loadClauseSet(id) {
      var lcs = setOf(id); if (!lcs) return render();
      return K.ask({ title: '‘' + esc(lcs.name) + '’ 조항으로 바꿀까요?', text: '이 계약서의 조항 ' + activeClauses().length + '개가 ‘' + esc(lcs.name) + '’ 조항으로 바뀌어요. 특약사항·금액은 그대로예요.', cancel: '그만두기', ok: '바꾸기' }).then(function (ok) {
        if (!ok) return render();   // 드롭다운도 원래대로
        var lk = kindOf(doc.kind), r = kindClauses({ clauseSet: lcs.id, payClause: lk && lk.payClause });
        doc.mode = r.base; doc.clauseSet = lcs.id; doc.clauseSetName = lcs.name;
        if (doc.mode === 'simple') doc.simpleClauses = r.list; else doc.clauses = r.list;
        clOpen = true; dirty(); render();
      });
    }
    function activeClauses() {
      var key = doc.mode === 'simple' ? 'simpleClauses' : 'clauses';
      if (!Array.isArray(doc[key])) doc[key] = [];
      return doc[key];
    }
    function kindLabel() { var k = kindOf(doc.kind); return k ? k.name : doc.kindName || (doc.mode === 'simple' ? '간단 계약서' : '표준 계약서'); }
    function clauseRows() {
      var list = activeClauses();
      return list.map(function (c, i) {
        return '<div class="ct-clause ct-cl" data-cci="' + i + '"><div class="ct-clause-head"><b>제' + (i + 1) + '조</b>' +
          '<div class="set-move"><button type="button" data-ccmv="-1"' + (i === 0 ? ' disabled' : '') + '>위로</button><button type="button" data-ccmv="1"' + (i === list.length - 1 ? ' disabled' : '') + '>아래로</button>' +
          '<button type="button" class="danger" data-ccdel>지우기</button></div></div>' +
          '<input class="input" data-ccf="title" maxlength="40" value="' + esc(c.title) + '" placeholder="조항 제목" aria-label="제' + (i + 1) + '조 제목">' +
          '<textarea class="textarea" data-ccf="body" rows="' + Math.min(8, Math.max(3, String(c.body || '').split('\n').length + 1)) + '" maxlength="2000" placeholder="조항 내용" aria-label="제' + (i + 1) + '조 내용">' + esc(c.body) + '</textarea></div>';
      }).join('');
    }
    function clauseRedraw(focusAt) {
      var box = $('#ct-cl-list', page); if (!box) return;
      box.innerHTML = clauseRows();
      var n = $('#ct-cl-n', page); if (n) n.textContent = activeClauses().length;
      if (focusAt != null) { var row = $('[data-cci="' + focusAt + '"]', page); if (row) { var f = $('input', row); if (f) K.focusNear(f); else row.scrollIntoView({ block: 'nearest' }); } }
    }
    /* ----- 4) 서명 ----- */
    function signHtml() {
      var s = doc.signs || {};
      function box(who, label, name) {
        var sg = s[who];
        return '<div class="txt-card est-card ct-signbox"><div class="ct-sign-head"><b>' + label + '</b><span>' + esc(name || '') + '</span></div>' +
          '<div class="ct-sign-img">' + (sg ? '<img src="' + esc(sg.img) + '" alt="' + esc(label) + ' 서명">' : '<span>아직 서명 안 함</span>') + '</div>' +
          (sg ? '<p class="hint">' + esc(new Date(sg.at).toLocaleString('ko-KR')) + ' 서명</p>' : '') +
          '<div class="ct-sign-btns">' + (sg ? '<button type="button" class="btn btn-outline btn-sm" data-signdel="' + who + '">서명 지우기</button>'
            : '<button type="button" class="btn btn-primary" data-sign="' + who + '">' + I.pen + (who === 'customer' ? '손님 서명 받기' : '업체 서명하기') + '</button>' +
              (who === 'supplier' && SET && SET.supplierSign ? '<button type="button" class="btn btn-outline" data-savedsign>저장해 둔 업체 서명 넣기</button>' : '')) + '</div></div>';
      }
      var m = model(doc, rec), problems = [];
      if (!m.customer.name) problems.push('고객 이름');
      if (!m.total) problems.push('총 공사금액');
      if (!doc.start || !doc.end) problems.push('착공일·준공일');
      return '<h2 class="est-h">서명</h2>' + stampHtml() +   // 실물 도장 확인을 맨 위에 먼저
        '<div class="tip">' + I.info + '<span>' + (needStamp() ? '종이 계약서에 도장을 받았으면 위 <b>받았어요 · 계약 완료</b>를 눌러요. 화면 서명은 휴대폰이나 태블릿에 손가락으로 해요.' : '휴대폰이나 태블릿 화면에 손가락으로 서명해요.') + '<br>서명한 뒤에는 내용을 고칠 수 없어요.</span></div>' +
        (problems.length ? '<div class="tip warn">' + I.info + '<span>아직 비어 있는 칸: <b>' + esc(problems.join(', ')) + '</b> — 서명 전에 채워 주세요.</span></div>' : '') +
        box('customer', '도급인 (고객)', m.customer.name) + box('supplier', '수급인 (업체)', [m.supplier.legalName || m.supplier.name, m.supplier.ceo ? '대표 ' + m.supplier.ceo : ''].filter(Boolean).join(' · ')) +
        filesHtml() +
        '<p class="hint ct-sign-note">' + (bothSigned(doc) ? '<b>' + (doc.paperSigned ? '실물 도장을 받았어요.' : '두 분 모두 서명했어요.') + '</b> 목록에 <b>계약 완료</b>로 표시돼요.' : '두 분 모두 서명하면 <b>계약 완료</b>로 바뀌어요.') + '</p>';
    }
    /* ----- 5) 미리보기·받기 ----- */
    // 화면 서명을 다 받지 않고 넘어왔으면: 인쇄한 계약서에 실물 도장을 받았는지 묻기 (받았어요 → 계약 완료)
    function needStamp() { return rec.status === 'draft' && !bothSigned(doc); }
    function stampHtml() {
      if (doc.paperSigned && rec.status === 'signed') return '<div class="txt-card est-card ct-stamp done">' + I.check + '<div><b>실물 도장 받음 · 계약 완료</b>' +
        '<p class="hint">도장 받은 종이 계약서는 사진을 찍거나 스캔해서 이 화면 맨 아래 <b>첨부 파일</b>에 올려 두세요.</p></div><button type="button" class="btn-link" data-stampundo>되돌리기</button></div>';
      if (!needStamp()) return '';
      var s = doc.signs || {}, miss = !s.customer && !s.supplier ? '화면 서명을 받지 않았어요.' : !s.customer ? '손님 화면 서명이 없어요.' : '업체 화면 서명이 없어요.';
      return '<div class="txt-card est-card ct-stamp"><h3>실물 도장을 받았나요?</h3>' +
        '<p>' + miss + ' 인쇄한 계약서에 도장(서명)을 받았다면 <b>받았어요</b>를 눌러 주세요. <b>계약 완료</b>로 바뀌고 내용이 잠겨요.</p>' +   // 비어 있는 칸은 바로 아래 노란 안내에
        '<div class="ct-stamp-btns"><button type="button" class="btn btn-primary" data-stampok>' + I.check + '받았어요 · 계약 완료</button>' +
        '<button type="button" class="btn btn-outline" data-stampno>아직이에요</button></div></div>';   // 아래 '워드 파일로 받기 | 인쇄하기'와 같은 차례 (진한 단추가 왼쪽·위)
    }
    function previewHtml() {
      return '<h2 class="est-h">미리보기·받기</h2>' +
        (Math.round(num(doc.amount)) && paySum(doc) !== Math.round(num(doc.amount)) ? '<div class="tip warn">' + I.info + '<span>대금 지급 합계가 총 공사금액과 달라요. <b>2. 금액·지급</b>에서 확인해 주세요.</span></div>' : '') +
        '<div class="est-dl ct-dl"><button type="button" class="btn btn-primary" data-dl="docx">' + I.doc + '워드 파일로 받기</button>' +
        '<button type="button" class="btn btn-outline" data-print>인쇄하기</button>' +
        (rec.status === 'signed' ? '<button type="button" class="btn btn-outline" data-markdone>공사 완료</button>' : rec.status === 'done' ? '<button type="button" class="btn btn-outline" data-markundone>공사 중으로 되돌리기</button>' : '') + '</div>' +
        '<div class="est-paper"><div class="est-pages" id="est-pages"></div></div>';
    }

    /* ----- 보기 화면 (계약 완료된 계약서): 완료된 계약서와 고객 정보만, 고치려면 '수정' ----- */
    function viewHtml() {
      var m = model(doc, rec), c = doc.customer || {}, days = daysBetween(doc.start, doc.end);
      var signTxt = doc.paperSigned ? '실물 도장 받음 (종이 계약서)' : (doc.signs && doc.signs.customer && doc.signs.supplier)
        ? '화면 서명 · ' + new Date(Math.max(+new Date(doc.signs.customer.at || 0), +new Date(doc.signs.supplier.at || 0))).toLocaleDateString('ko-KR') : '';
      var kv = function (k, v) { return v ? '<div><dt>' + k + '</dt><dd>' + v + '</dd></div>' : ''; };
      var digits = String(c.phone || '').replace(/[^0-9]/g, '');
      return (rec.status === 'terminated' ? '<div class="tip warn ct-canceled">' + I.info + '<span><b>계약 파기한 계약서예요.</b> ' + esc(termSummary(doc.termination)) + (doc.termination && doc.termination.memo ? ' · ' + esc(doc.termination.memo) : '') + ' <button type="button" class="btn-link" data-term="' + esc(rec.id || '') + '">파기 내용 보기·고치기</button></span></div>' : '') +
        '<section class="txt-card ctv-head"><div class="ctv-top"><span class="pill c-' + esc(rec.status) + '">' + esc(STATUS[rec.status] || '') + '</span>' + (m.no ? '<span class="ctv-no">' + esc(m.no) + '</span>' : '') + '</div>' +
        '<h2 class="ctv-title">' + esc(m.title || '제목 없는 계약서') + '</h2>' +
        '<dl class="ctv-kv">' + kv('계약일', esc(doc.date ? K.sDate(doc.date) : '')) +
        kv('공사 기간', (function () {   // 착공·준공일이 비었으면 세부 공사일정(공정) 처음~끝을 대신 보여 줌
          var wr = !doc.start && K.workRange ? K.workRange(rec, doc) : null;
          if (wr && wr.byPhase) return esc(K.sDate(wr.from) + (wr.to !== wr.from ? ' ~ ' + K.sDate(wr.to) : '')) + ' <small>(' + daysBetween(wr.from, wr.to) + '일 · 세부 공사일정 기준)</small>';
          return esc((doc.start ? K.sDate(doc.start) : '미정') + ' ~ ' + (doc.end ? K.sDate(doc.end) : '미정')) + (days > 0 ? ' <small>(' + days + '일)</small>' : '');
        })()) +
        kv('공사 장소', esc(doc.site || '')) + kv('총 공사금액', '<b>' + won(m.total) + '원</b> <small>' + esc(m.vatLabel || '') + '</small>') +
        kv('계약서 종류', esc(kindLabel())) + kv('서명', esc(signTxt)) + '</dl>' +
        '<div class="ctv-btns"><button type="button" class="btn btn-outline" data-dl="docx">' + I.doc + '<span>워드 파일로 받기</span></button>' +
        '<button type="button" class="btn btn-outline" data-print>' + I.down + '<span>인쇄하기</span></button>' +
        // 공사일정 단추는 착공일이 없어도 늘 보이게 (단추 수가 바뀌어 칸이 비지 않게)
        '<a class="btn btn-outline" href="#/calendar/k/' + encodeURIComponent(rec.id) + '">' + I.cal + '<span>공사일정</span></a>' +
        (rec.status === 'signed' ? '<button type="button" class="btn btn-outline" data-markdone>' + I.check + '<span>공사 완료</span></button>'
          : rec.status === 'done' ? '<button type="button" class="btn btn-outline" data-markundone><span>공사 중으로</span></button>' : '') + '</div></section>' +
        '<section class="txt-card ctv-cust"><div class="ctv-h"><h3>고객 정보</h3>' + (rec.customer_id ? '<a class="btn btn-outline btn-sm" href="#/customer/' + encodeURIComponent(rec.customer_id) + '">' + I.users + '고객 화면</a>' : '') + '</div>' +
        '<dl class="ctv-kv">' + kv('이름', esc(c.name ? c.name + ' 고객님' : '')) +
        kv('연락처', digits ? '<a href="tel:' + esc(digits) + '">' + esc(c.phone) + '</a> <button type="button" class="btn-link" data-copyphone="' + esc(c.phone) + '">번호 복사</button>' : '') +
        kv('주소', esc(c.address || '')) + (custRec && custRec.memo ? kv('메모', esc(custRec.memo).replace(/\n/g, '<br>')) : '') + '</dl>' +
        (!c.name && !digits ? '<p class="hint">고객 정보가 비어 있어요. 수정을 눌러 1단계에서 적어 주세요.</p>' : '') + '</section>' +
        filesHtml() +
        '<section class="ctv-doc"><h3 class="ctv-doc-h">완료된 계약서 <small id="est-pagecount"></small></h3><div class="est-paper"><div class="est-pages" id="est-pages"></div></div></section>' +
        '</div><div class="savebar est-bar ctv-bar"><div class="est-sum"><small>' + esc(STATUS[rec.status] || '') + ' · 총 공사금액</small><b>' + won(m.total) + '원</b></div>' +
        '<div class="est-nav"><a class="btn btn-primary" href="#/contract/' + encodeURIComponent(rec.id) + '/edit">' + I.pen + '수정</a></div></div>';
    }
    function render() {
      if (viewing) {
        page.innerHTML = '<div class="ct-view">' + viewHtml();   // viewHtml 끝에서 .ct-view 를 닫고 아래 막대를 붙임
        drawPages();
        if (rec.customer_id && DB.getCustomer && custRec === null) {   // 고객 메모는 나중에 채움
          custRec = false;
          DB.getCustomer(rec.customer_id).then(function (cr) { if (cr && cr.memo && page.isConnected) { custRec = cr; render(); } }).catch(function () {});
        }
        return;
      }
      var cur = STEPS[step];
      var inner = cur.id === 'info' ? infoHtml() : cur.id === 'money' ? moneyHtml() : cur.id === 'terms' ? termsHtml() : cur.id === 'sign' ? signHtml() : previewHtml();
      page.innerHTML = frameHtml(inner);
      if (cur.id === 'info') K.blacklistCheck(doc.customer.phone, $('#bl-slot', page));
      if (cur.id === 'money') payCheck();
      if (cur.id === 'preview') drawPages();
      var on = $('.est-step.on', page);
      if (on) { var nav = on.parentNode; nav.scrollLeft = on.offsetLeft - 16; }
    }
    function fitPaper() {
      var paper = $('.est-paper', page), d = $('.est-pages', page);
      if (!paper || !d) return;
      d.style.zoom = '';
      var cs = getComputedStyle(paper), avail = paper.clientWidth - parseFloat(cs.paddingLeft) - parseFloat(cs.paddingRight), need = d.offsetWidth;
      if (need > avail && avail > 0) d.style.zoom = String(Math.max(0.3, avail / need));
    }
    function drawPages() {
      var box = $('#est-pages', page); if (!box) return;
      var go2 = function () {
        if (!box.isConnected) return;
        box.innerHTML = EK.paginateParts(ctParts(model(doc, rec)), 'ct-doc');
        var info = $('#est-pagecount', page); if (info) info.textContent = 'A4 ' + box.children.length + '쪽';
        fitPaper();
      };
      if (document.fonts && document.fonts.ready) document.fonts.ready.then(go2); else go2();
    }
    window.addEventListener('resize', function () { if (page.isConnected && (viewing || STEPS[step].id === 'preview')) fitPaper(); });

    /* ----- 입력 ----- */
    var MAP = { 'ct-cname': ['customer', 'name'], 'ct-cphone': ['customer', 'phone'], 'ct-caddr': ['customer', 'address'], 'ct-title': ['title'], 'ct-site': ['site'],
      'ct-date': ['date'], 'ct-start': ['start'], 'ct-end': ['end'], 'ct-account': ['account'], 'ct-late': ['lateRate'], 'ct-delay': ['delayRate'],
      'ct-specials': ['specials'], 'ct-wnote': ['warranty', 'note'], 'ct-wn': ['warranty', 'n'], 'ct-att-other': ['attach', 'other'] };
    var blT = null;
    page.addEventListener('input', function (e) {
      var el = e.target, p = MAP[el.id];
      if (p) {
        if (el.id === 'ct-title') doc.titleAuto = false;   // 공사명을 직접 고치면 그 이름 그대로
        if (p.length === 1) doc[p[0]] = el.value; else { doc[p[0]] = doc[p[0]] || {}; doc[p[0]][p[1]] = el.id === 'ct-wn' ? String(Math.round(num(el.value)) || '') : el.value; }
        if (el.id === 'ct-cphone') { clearTimeout(blT); blT = setTimeout(function () { K.blacklistCheck(doc.customer.phone, $('#bl-slot', page)); }, 400); }
        if (el.id === 'ct-start' || el.id === 'ct-end') {
          phaseRefresh();
          var d = daysBetween(doc.start, doc.end), h = $('#ct-days', page);
          if (h) { h.textContent = d > 0 ? '공사 기간 ' + d + '일' : (doc.start && doc.end ? '준공일이 착공일보다 빨라요' : ''); h.hidden = !h.textContent; }
        }
        dirty(); return;
      }
      if (el.id === 'ct-amount') {
        doc.amount = String(Math.round(num(el.value)) || '');
        $('#ct-words', page).textContent = num(doc.amount) ? '일금 ' + EK.hangul(num(doc.amount)) + '원정' : '숫자만 적어요';
        $('#ct-total', page).textContent = won(num(doc.amount)) + '원';
        dirty(); payCheck(); return;
      }
      var hk = el.getAttribute('data-h');
      if (hk) {
        var hi = +el.closest('[data-hi]').getAttribute('data-hi'), hrow = doc.phases[hi];
        hrow[hk] = hk === 'days' ? String(parseInt(String(el.value).replace(/[^0-9]/g, ''), 10) || '') : el.value;
        if (hk === 'days') autoDays.delete(hrow);   // 기간을 직접 고치면 그대로 둠
        if (hk === 'name' && (autoDays.has(hrow) || !hrow.days || hrow.days === '1')) {
          // 설정에 있는 공정 이름을 쓰면 기본 일수를 저절로 (기간을 직접 고친 줄은 그대로)
          var dd = phaseDays(el.value), din = $('#ph-days-' + hi, page);
          if (dd && din && hrow.days !== dd) { hrow.days = dd; din.value = dd; autoDays.add(hrow); }
        }
        if (hk === 'name') chipSync();
        dirty(); phaseRefresh(); return;
      }
      var pk = el.getAttribute('data-p');
      if (pk) {
        var row = doc.payments[+el.closest('[data-pi]').getAttribute('data-pi')];
        row[pk] = pk === 'amount' ? String(Math.round(num(el.value)) || '') : pk === 'pct' ? String(num(el.value) || '') : el.value;
        dirty(); payCheck(); return;
      }
      var ck = el.getAttribute('data-ccf');
      if (ck) {
        var crow = activeClauses()[+el.closest('[data-cci]').getAttribute('data-cci')];
        if (crow) { crow[ck] = el.value; dirty(); }
      }
    });
    page.addEventListener('toggle', function (e) { if (e.target.classList && e.target.classList.contains('ct-cedit')) clOpen = e.target.open; }, true);
    page.addEventListener('change', function (e) {
      var el = e.target;
      if (el.id === 'ph-set') return loadPhaseSet(+el.value);     // 순서 묶음 드롭다운에서 고름
      if (el.id === 'ct-clset') return loadClauseSet(el.value);   // 조항 묶음 드롭다운에서 고름
      if (el.id === 'ct-kind') {
        var kd = kindOf(el.value);
        if (!kd) return;
        var put = function () {
          applyKind(doc, kd, !!doc.estimate); dirty(); render();
          K.toast('‘' + kd.name + '’ 내용으로 바꿨어요' + (num(doc.amount) ? ' · 지급 금액도 비율대로 다시 나눴어요' : ''));
        };
        if (!rec.id && !K.state.dirty) return put();
        return K.ask({ title: '‘' + esc(kd.name) + '’(으)로 바꿀까요?',
          text: '조항·대금 지급 비율·특약사항' + (doc.estimate ? '이' : '·부가세가') + ' <b>' + esc(kd.name) + '</b> 설정 내용으로 바뀌어요. 이 계약서에서 고친 조항·특약사항은 없어져요.<br>고객·금액·날짜' + (doc.estimate ? '·부가세(견적서에서 불러온 것)' : '') + '는 그대로예요.',
          cancel: '그만두기', ok: '바꾸기' }).then(function (ok) {
          if (ok) return put();
          el.value = kindOf(doc.kind) ? doc.kind : '';
        });
      }
      if (el.name === 'ct-vat') { doc.vat = el.value; dirty(); return; }
      if (el.id === 'ct-wu') { doc.warranty.unit = el.value; dirty(); return; }
      if (el.id === 'ct-att-est') { doc.attach.estimate = el.checked; var sub = $('.ct-sub', page); if (sub) sub.hidden = !el.checked; dirty(); return; }
      if (el.id === 'ct-att-det') { doc.attach.detail = el.checked; dirty(); return; }
      if (el.id === 'ct-att-draw') { doc.attach.drawing = el.checked; dirty(); return; }
      if (el.id === 'ct-paper') {
        doc.paperSigned = el.checked; dirty();
        save(true).then(function () { render(); }, function () {});
      }
    });
    page.addEventListener('focusout', function (e) { var el = e.target; if (el.id === 'ct-amount' || el.getAttribute('data-p') === 'amount') { var n = num(el.value); el.value = n ? won(n) : ''; } });
    page.addEventListener('focusin', function (e) { var el = e.target; if (el.id === 'ct-amount' || el.getAttribute('data-p') === 'amount') { var n = num(el.value); el.value = n ? String(Math.round(n)) : ''; } });
    page.addEventListener('click', function (e) {
      var t = e.target, x;
      if (t.closest('[data-term]') && rec.id) {
        var sid = rec.id;   // 고친 내용이 있으면 먼저 저장하고 파기 창 열기
        return (K.state.dirty ? save(true) : Promise.resolve()).then(function () { openTerminate(sid, function () { K.setDirty(false); viewEditor([sid]); }); }, function () {});
      }
      if ((x = t.closest('[data-step]'))) return go(+x.getAttribute('data-step'));
      if (t.closest('[data-next]')) return go(step + 1);
      if (t.closest('[data-prev]')) return go(step - 1);
      if ((x = t.closest('[data-estgo]'))) {   // 불러온 견적서 보러 가기 — 고친 게 있으면 저장하고 이동 (뒤로 가면 이 계약서로)
        e.preventDefault(); var eh = x.getAttribute('href');
        return (K.state.dirty ? save(true) : Promise.resolve()).then(function () { K.go(eh); }, function () {});
      }
      if (t.closest('[data-save]')) return save(true).then(function () {}, function () {});   // 단추 글자는 그대로 — 저장한 시각은 왼쪽 '저장됨 오전 9:58'
      if (t.closest('[data-finish]') || t.closest('[data-stampno]')) {
        var finish = function () { return save(true).then(function () {
          K.leave(rec.status === 'signed' || rec.status === 'done' || rec.status === 'terminated' ? '#/contract/' + encodeURIComponent(rec.id) : '#/contracts');
        }, function () {}); };
        if (t.closest('[data-stampno]') || !needStamp()) return finish();
        // 화면 서명 없이 마치면: 실물 도장을 받았는지 한 번 더 확인
        return K.ask({ title: '실물 도장을 받았나요?', text: '화면 서명이 다 되지 않았어요. 인쇄한 계약서에 도장(서명)을 받았다면 <b>계약 완료</b>로 저장해요.<br>아직이면 <b>작성 중</b>으로 저장해요.',
          cancel: '아직이에요', ok: '받았어요 · 계약 완료' }).then(function (yes) { if (yes) { doc.paperSigned = true; dirty(); } return finish(); });
      }
      if (t.closest('[data-stampok]')) { doc.paperSigned = true; dirty(); return save(true).then(function () { render(); window.scrollTo(0, 0); }, function () {}); }
      if (t.closest('[data-stampundo]')) { doc.paperSigned = false; rec.status = 'draft'; dirty(); return save(true).then(function () { render(); }, function () {}); }
      if ((x = t.closest('[data-fdopen="ct-est"]'))) {   // 견적서 찾아서 고르기 → 고르면 바로 불러옴
        if (!estList) estList = DB.listEstimates().catch(function () { return []; });
        var kd = function (d) { var m = /^(\d{4})-(\d{2})-(\d{2})/.exec(d || ''); return m ? m[1] + '.' + m[2] + '.' + m[3] : ''; };
        return K.finder({ title: '견적서에서 불러오기', ph: '고객 이름·전화번호·현장으로 찾기', cur: rec.estimate_id || '', focus: x, empty: '만든 견적서가 없어요.',
          items: estList.then(function (l) { return l.map(function (e) {
            var di = K.dealItem('e', e);   // 현장 / 품목 · 기간(견적 날짜) · 고객 이름 — 견적 중단은 흐리게
            return { id: e.id, label: di.label, sub: di.sub, dim: e.status === 'stopped',
              keys: [e.customer_name, e.customer_phone, e.site_name, e.region, kd(e.estimate_date || String(e.created_at || '').slice(0, 10))].join(' ') };
          }); }),
          onPick: function (it) { if (it) loadEst(it.id); } });
      }
    });
    function loadEst(id) {
        return DB.getEstimate(id).then(function (r) {
          if (!r) throw new Error('견적서를 찾을 수 없어요.');
          var go3 = function () {
            fromEstimate(doc, snapEstimate(r)); rec.estimate_id = r.id; if (r.customer_id) rec.customer_id = r.customer_id;
            dirty(); render();
          };
          if (doc.estimate || num(doc.amount)) {
            return K.ask({ title: '이 견적서로 바꿀까요?', text: '공사명·현장·고객·금액·지급 금액이 이 견적서 내용으로 바뀌어요.', cancel: '그만두기', ok: '바꾸기' }).then(function (ok) { if (ok) go3(); });
          }
          go3();
        }).catch(function (err) { fail('불러오지 못했어요', err); });
    }
    page.addEventListener('click', function (e) {
      var t = e.target, x;
      // 이 계약서의 조항 고치기
      if (t.closest('[data-ccadd]')) { var AL = activeClauses(); AL.push({ title: '', body: '' }); dirty(); clauseRedraw(AL.length - 1); return; }
      if ((x = t.closest('[data-ccmv]'))) {
        var CL = activeClauses(), ci = +x.closest('[data-cci]').getAttribute('data-cci'), cj = ci + +x.getAttribute('data-ccmv');
        if (cj >= 0 && cj < CL.length) {
          var ctmp = CL[ci]; CL[ci] = CL[cj]; CL[cj] = ctmp; dirty(); clauseRedraw();
          var mv = $('[data-cci="' + cj + '"] [data-ccmv="' + x.getAttribute('data-ccmv') + '"]', page) || $('[data-cci="' + cj + '"] [data-ccmv]', page);
          if (mv) { mv.scrollIntoView({ block: 'nearest' }); if (!mv.disabled) mv.focus(); }
        }
        return;
      }
      if ((x = t.closest('[data-ccdel]'))) {
        var DL = activeClauses(), di = +x.closest('[data-cci]').getAttribute('data-cci'), dc = DL[di] || {};
        var drop = function () { DL.splice(di, 1); dirty(); clauseRedraw(); };
        if (!String(dc.title || '').trim() && !String(dc.body || '').trim()) return drop();
        return K.ask({ title: '제' + (di + 1) + '조를 지울까요?', text: '<b>' + esc(dc.title || '제목 없음') + '</b> — 이 계약서에서만 빠져요.', cancel: '그만두기', ok: '지우기', okClass: 'btn-danger' })
          .then(function (ok) { if (ok) drop(); });
      }
      if (t.closest('[data-ccreset]')) {
        var rk = kindOf(doc.kind);
        return K.ask({ title: '‘' + esc(kindLabel()) + '’ 조항으로 되돌릴까요?', text: '이 계약서에서 고친 조항이 ' + (rk ? '계약서 설정에 저장된 문구' : '처음 문구') + '로 돌아가요. 특약사항·금액은 그대로예요.', cancel: '그만두기', ok: '되돌리기' }).then(function (ok) {
          if (!ok) return;
          var r = rk ? kindClauses(rk) : { base: doc.mode === 'simple' ? 'simple' : 'standard', list: baseClauses(doc.mode, null) }, modeChanged = r.base !== (doc.mode === 'simple' ? 'simple' : 'standard');
          doc.mode = r.base;
          if (doc.mode === 'simple') doc.simpleClauses = r.list; else doc.clauses = r.list;
          dirty(); if (modeChanged) render(); else clauseRedraw(); K.toast('조항을 되돌렸어요');
        });
      }
      if (t.closest('[data-split]')) {
        if (!num(doc.amount)) { K.notice('총 공사금액을 먼저 적어 주세요'); return; }
        splitPayments(doc); dirty(); render(); K.toast('비율대로 나눴어요 · 만원 단위로 맞추고 남는 금액은 마지막 줄에 넣었어요');
        return;
      }
      if (t.closest('[data-hclear]')) {   // 세부 공사일정 전체 해제
        var hn = (doc.phases || []).length; if (!hn) return;
        return K.ask({ title: '세부 공사일정을 모두 뺄까요?', text: '지금 적은 세부 공사일정 <b>' + hn + '개</b>가 모두 빠져요.', cancel: '그만두기', ok: '빼기', okClass: 'btn-danger' })
          .then(function (ok) { if (ok) { doc.phases = []; dirty(); } render(); });
      }
      if (t.closest('[data-hsetsave]')) {
        var cur = (doc.phases || []).filter(function (h) { return String(h.name || '').trim(); });
        if (!cur.length) { K.notice('공정 이름을 먼저 적어 주세요'); return; }
        var pr = K.ask({ title: '지금 순서를 묶음으로 저장', text: '이름을 붙여 두면 다음 계약서에서 한 번에 불러올 수 있어요.<br><input class="input ps-name-in" id="ps-name-in" maxlength="30" placeholder="예) 아파트 전체 리모델링" aria-label="순서 묶음 이름">' +
          '<small class="ps-name-sub">' + esc(cur.map(function (h) { return h.name + ' ' + (h.days || 1) + '일'; }).join(' → ')) + '</small>', cancel: '그만두기', ok: '저장' });
        var pin = document.getElementById('ps-name-in'); if (pin) setTimeout(function () { pin.focus(); }, 60);
        return pr.then(function (ok) {
          var nm2 = pin ? pin.value.trim() : '';
          if (!ok) return;
          if (!nm2) { K.notice('이름을 적어야 저장돼요', '이름을 적고 다시 눌러 주세요.'); return; }
          var items = cur.map(function (h) { return { name: String(h.name).trim(), days: Math.max(1, Math.round(num(h.days)) || 1) }; });
          return loadSettings().then(function (cfg0) {
            var next = clone(cfg0), list = Array.isArray(next.phaseSets) ? next.phaseSets : [];
            var at = list.findIndex(function (x) { return x && x.name === nm2; });
            var go2 = function () { if (at >= 0) list[at] = { name: nm2, items: items }; else list.push({ name: nm2, items: items }); next.phaseSets = list; return saveSettings(next).then(function () { render(); K.toast('‘' + nm2 + '’ 순서 묶음을 저장했어요'); }); };
            if (at >= 0) return K.ask({ title: '같은 이름이 있어요', text: '<b>' + esc(nm2) + '</b> 순서 묶음을 지금 순서로 바꿀까요?', cancel: '그만두기', ok: '바꾸기' }).then(function (y) { if (y) return go2(); });
            return go2();
          }).catch(function (err) { fail('저장하지 못했어요', err); });
        });
      }
      if ((x = t.closest('[data-hq]')) || t.closest('[data-hadd]')) {
        doc.phases = doc.phases || [];
        var nq = x ? x.getAttribute('data-hq') : '';
        // 공정 고르기: 이미 넣은 공정이면 다시 눌렀을 때 빼기 (같은 이름이 여러 줄이면 마지막 줄)
        if (x && x.getAttribute('aria-pressed') === 'true') {
          for (var qi = doc.phases.length - 1; qi >= 0; qi--) {
            if (String(doc.phases[qi].name || '').replace(/\s+/g, '') === nq.replace(/\s+/g, '')) { doc.phases.splice(qi, 1); break; }
          }
          dirty(); render(); K.toast(nq + eulReul(nq) + ' 뺐어요');
          return;
        }
        var nrow = { name: nq, start: '', days: phaseDays(nq) || '1' }, at;
        if (x) at = insertByOrder(doc.phases, nrow, phaseList().map(function (q) { return nkey(q.name); }));
        else { doc.phases.push(nrow); autoDays.add(nrow); at = doc.phases.length - 1; }
        dirty(); render();
        if (x) K.toast(nq + ' ' + nrow.days + '일을 넣었어요');
        var nm = $('#ph-name-' + at, page); if (nm && !x) nm.focus();
        return;
      }
      if ((x = t.closest('[data-hdel]'))) { doc.phases.splice(+x.closest('[data-hi]').getAttribute('data-hi'), 1); dirty(); render(); return; }
      if (t.closest('[data-padd]')) { doc.payments.push({ label: '', pct: '', amount: '', when: '' }); dirty(); render(); return; }
      if ((x = t.closest('[data-pdel]'))) {
        if (doc.payments.length <= 1) { K.notice('지급 줄은 하나 이상 있어야 해요'); return; }
        doc.payments.splice(+x.closest('[data-pi]').getAttribute('data-pi'), 1); dirty(); render(); return;
      }
      if (t.closest('[data-unsign]')) {
        return K.ask({ title: '서명을 지우고 고칠까요?', text: '손님·업체 서명이 <b>모두 지워져요.</b> 고친 뒤 다시 서명을 받아야 해요.', cancel: '그만두기', ok: '서명 지우기', okClass: 'btn-danger' }).then(function (ok) {
          if (!ok) return;
          doc.signs = { customer: null, supplier: null }; doc.paperSigned = false; rec.status = 'draft';
          dirty(); save(true).then(function () { render(); K.toast('서명을 지웠어요 · 이제 고칠 수 있어요'); }, function () {});
        });
      }
      if ((x = t.closest('[data-sign]'))) {
        var who = x.getAttribute('data-sign'), m = model(doc, rec);
        return signPad({ who: who, name: who === 'customer' ? m.customer.name : (m.supplier.legalName || m.supplier.name) + (m.supplier.ceo ? ' 대표 ' + m.supplier.ceo : ''),
          title: m.title, total: m.total }).then(function (res) {
          if (!res) return;
          doc.signs = doc.signs || {};
          doc.signs[who] = { img: res.img, at: new Date().toISOString(), name: who === 'customer' ? m.customer.name : m.supplier.ceo || m.supplier.name };
          if (who === 'supplier' && res.remember) { var v = Object.assign({}, SET, { supplierSign: res.img }); saveSettings(v).catch(function () {}); }
          dirty(); save(true).then(function () { render(); K.toast('서명을 저장했어요'); }, function () { render(); });
        });
      }
      if (t.closest('[data-savedsign]')) {
        var m2 = model(doc, rec);
        doc.signs.supplier = { img: SET.supplierSign, at: new Date().toISOString(), name: m2.supplier.ceo || m2.supplier.name };
        dirty(); return save(true).then(function () { render(); K.toast('업체 서명을 넣었어요'); }, function () {});
      }
      if ((x = t.closest('[data-signdel]'))) {
        var w2 = x.getAttribute('data-signdel');
        return K.ask({ title: '이 서명을 지울까요?', cancel: '그만두기', ok: '지우기', okClass: 'btn-danger' }).then(function (ok) {
          if (!ok) return; doc.signs[w2] = null; rec.status = 'draft'; dirty(); save(true).then(function () { render(); }, function () {});
        });
      }
      if (t.closest('[data-markdone]') || t.closest('[data-markundone]')) {
        rec.status = t.closest('[data-markdone]') ? 'done' : 'signed'; dirty();
        return save(true).then(function () { render(); }, function () {});
      }
      if ((x = t.closest('[data-copyphone]'))) return K.copyFlash(x, x.getAttribute('data-copyphone'), '전화번호');
      if ((x = t.closest('[data-dl]'))) return download(x);
      if (t.closest('[data-print]')) return (K.state.dirty || !rec.id ? save(true) : Promise.resolve()).then(function () { window.print(); }, function () {});
    });

    function download(btn) {
      btn.disabled = true;
      var label = btn.lastChild.textContent; btn.lastChild.textContent = '만드는 중…';
      (K.state.dirty || !rec.id ? save(true) : Promise.resolve()).then(function () { return Promise.all([loadContractExport(), EK.loadLogo()]); }).then(function (r) {
        var m = model(doc, rec); m.logo = r[1];
        var blob = r[0].docx(m);
        var base = String(m.no || '').replace(/[^A-Za-z0-9_-]+/g, '').replace(/^-+|-+$/g, '');
        var name = (base || 'contract-' + String(m.date || '').replace(/-/g, '')) + '.docx';
        K.saveBlob(blob, name);
        K.toast(name + ' 파일을 받았어요');
      }).catch(function (err) { if (err) fail('파일을 만들지 못했어요', err); })
        .then(function () { btn.disabled = false; btn.lastChild.textContent = label; });
    }
    // 첨부 파일: 고르기 · 끌어다 놓기 · 열기 · 받기 · 지우기
    page.addEventListener('change', function (e) { if (e.target.id === 'ct-file') { var fl = e.target.files; addFiles(fl); e.target.value = ''; } });
    page.addEventListener('dragover', function (e) {
      var box = e.target.closest && e.target.closest('#ct-files');
      if (!box || fileBusy || !e.dataTransfer || [].indexOf.call(e.dataTransfer.types || [], 'Files') < 0) return;
      e.preventDefault(); box.classList.add('drop');
    });
    page.addEventListener('dragleave', function (e) { var box = e.target.closest && e.target.closest('#ct-files'); if (box && !box.contains(e.relatedTarget)) box.classList.remove('drop'); });
    page.addEventListener('drop', function (e) {
      var box = e.target.closest && e.target.closest('#ct-files');
      if (!box || !e.dataTransfer || !e.dataTransfer.files.length) return;
      e.preventDefault(); box.classList.remove('drop'); addFiles(e.dataTransfer.files);
    });
    page.addEventListener('click', function (e) {
      var row = e.target.closest && e.target.closest('.cf-row');
      if (!row) return;
      var i = +row.getAttribute('data-fi');
      if (e.target.closest('[data-fopen]')) return openFile(i, false);
      if (e.target.closest('[data-fget]')) return openFile(i, true);
      if (e.target.closest('[data-fdel]')) return delFile(i);
    });
    render();
  }

  /* ---------- 서명 받기 (화면 가득 손가락으로) ---------- */
  function signPad(o) {
    return new Promise(function (resolve) {
      var ov = document.createElement('div');
      ov.className = 'sign-ov';
      ov.setAttribute('role', 'dialog'); ov.setAttribute('aria-modal', 'true'); ov.setAttribute('aria-label', '서명');
      ov.innerHTML = '<div class="sign-top"><b>' + (o.who === 'customer' ? '도급인(고객) 서명' : '수급인(업체) 서명') + '</b>' +
        '<p>' + esc(o.title || '') + (o.total ? ' · 총 ' + won(o.total) + '원' : '') + '<br>위 계약 내용을 확인하였으며 이에 서명합니다.</p></div>' +
        '<div class="sign-area"><canvas aria-label="여기에 손가락으로 서명하세요"></canvas><span class="sign-ph">여기에 서명하세요</span><span class="sign-name">' + esc(o.name || '') + '</span></div>' +
        (o.who === 'supplier' ? '<label class="est-check sign-remember"><input type="checkbox" id="sign-rem"><span>이 서명을 다음 계약서에도 쓰기</span></label>' : '') +
        '<div class="sign-btns"><button type="button" class="btn btn-outline" data-x>취소</button><button type="button" class="btn btn-outline" data-clear>다시 쓰기</button>' +
        '<button type="button" class="btn btn-primary" data-ok disabled>서명 완료</button></div>';
      document.body.appendChild(ov);
      document.documentElement.style.overflow = 'hidden';
      var cv = $('canvas', ov), area = $('.sign-area', ov), ctx = cv.getContext('2d'), dpr = Math.max(1, window.devicePixelRatio || 1);
      var ink = false, drawing = false, last = null, bb = null;
      function size() {
        var r = area.getBoundingClientRect();
        var keep = ink ? cv.toDataURL() : null;
        cv.width = Math.round(r.width * dpr); cv.height = Math.round(r.height * dpr);
        cv.style.width = r.width + 'px'; cv.style.height = r.height + 'px';
        ctx.lineCap = 'round'; ctx.lineJoin = 'round'; ctx.strokeStyle = '#111'; ctx.lineWidth = 3.2 * dpr;
        if (keep) { var im = new Image(); im.onload = function () { ctx.drawImage(im, 0, 0, cv.width, cv.height); }; im.src = keep; bb = { x0: 0, y0: 0, x1: cv.width, y1: cv.height }; }
      }
      size();
      window.addEventListener('resize', size);
      function pt(e) { var r = cv.getBoundingClientRect(); return { x: (e.clientX - r.left) * dpr, y: (e.clientY - r.top) * dpr }; }
      function grow(p) {
        var m = 8 * dpr;
        if (!bb) bb = { x0: p.x, y0: p.y, x1: p.x, y1: p.y };
        bb.x0 = Math.min(bb.x0, p.x - m); bb.y0 = Math.min(bb.y0, p.y - m); bb.x1 = Math.max(bb.x1, p.x + m); bb.y1 = Math.max(bb.y1, p.y + m);
      }
      cv.addEventListener('pointerdown', function (e) {
        e.preventDefault(); drawing = true; last = pt(e); grow(last);
        try { cv.setPointerCapture(e.pointerId); } catch (er) {}
        ctx.beginPath(); ctx.arc(last.x, last.y, ctx.lineWidth / 2, 0, Math.PI * 2); ctx.fillStyle = '#111'; ctx.fill();
      });
      cv.addEventListener('pointermove', function (e) {
        if (!drawing) return;
        e.preventDefault();
        var evs = e.getCoalescedEvents ? e.getCoalescedEvents() : [e];
        evs.forEach(function (ev) {
          var p = pt(ev);
          ctx.beginPath(); ctx.moveTo(last.x, last.y);
          ctx.quadraticCurveTo(last.x, last.y, (last.x + p.x) / 2, (last.y + p.y) / 2); ctx.lineTo(p.x, p.y); ctx.stroke();
          last = p; grow(p);
        });
        if (!ink) { ink = true; $('[data-ok]', ov).disabled = false; $('.sign-ph', ov).hidden = true; }
      });
      function end() { drawing = false; }
      cv.addEventListener('pointerup', end); cv.addEventListener('pointercancel', end);
      function close(v) {
        window.removeEventListener('resize', size);
        document.documentElement.style.overflow = '';
        ov.remove(); resolve(v);
      }
      ov.addEventListener('click', function (e) {
        if (e.target.closest('[data-x]')) return close(null);
        if (e.target.closest('[data-clear]')) { ctx.clearRect(0, 0, cv.width, cv.height); ink = false; bb = null; $('[data-ok]', ov).disabled = true; $('.sign-ph', ov).hidden = false; return; }
        if (e.target.closest('[data-ok]') && ink) {
          // 서명한 부분만 잘라서, 높이 160px 안팎의 그림으로 (계약서 안에 저장)
          var x0 = Math.max(0, Math.floor(bb.x0)), y0 = Math.max(0, Math.floor(bb.y0));
          var w = Math.min(cv.width, Math.ceil(bb.x1)) - x0, h = Math.min(cv.height, Math.ceil(bb.y1)) - y0;
          var s = Math.min(1, 160 / h, 600 / w);
          var out = document.createElement('canvas');
          out.width = Math.max(1, Math.round(w * s)); out.height = Math.max(1, Math.round(h * s));
          out.getContext('2d').drawImage(cv, x0, y0, w, h, 0, 0, out.width, out.height);
          close({ img: out.toDataURL('image/png'), remember: !!($('#sign-rem', ov) && $('#sign-rem', ov).checked) });
        }
      });
      ov.addEventListener('keydown', function (e) { if (e.key === 'Escape') close(null); });
    });
  }

  /* =====================================================================
     미리보기·인쇄용 계약서 (A4 쪽 단위 — 견적서와 같은 쪽 나누기 사용)
     ===================================================================== */
  function ctParts(m) {
    var sup = m.supplier;
    var logo = (window.SITE_LOGO && window.SITE_LOGO.horizontal) || '<b>' + esc(sup.name) + '</b>';
    function kv(rows) { return rows.map(function (r) { return '<tr><th>' + esc(r[0]) + '</th><td>' + r[1] + '</td></tr>'; }).join(''); }
    var terms = [
      ['공사명', esc(m.title)], ['공사 장소', esc(m.site)], ['공사 기간', esc(m.period)],
      ['총 공사금액', '<b>' + esc(m.amountWords) + '</b> (₩' + won(m.total) + ')' + (m.vatLabel ? ' · ' + esc(m.vatLabel) : '')],
      ['입금 계좌', esc(m.account)], ['하자보수 기간', esc(m.warranty)],
    ];
    if (m.mode === 'standard') { terms.push(['지연손해금', esc(m.lateRate ? '대금 지급이 늦어진 금액에 ' + m.lateRate : '')]); if (m.delayRate) terms.push(['지체상금', esc('공사가 늦어진 날수에 ' + m.delayRate)]); }
    terms.push(['첨부 서류', esc(m.attach.join(', ') || '없음')]);
    var flow = [];
    flow.push({ block: '<div class="est-doc-brand"><span class="est-doc-logo">' + logo + '</span><span class="est-doc-meta">' + (m.no ? '계약번호 ' + esc(m.no) + '<br>' : '') + '계약일 ' + esc(m.dateK) + '</span></div>' +
      '<h1 class="ct-h1">' + esc(m.docTitle) + '</h1>' +
      '<p class="ct-intro">도급인(고객) <b>' + esc(m.customer.name || '　　　　') + '</b>과(와) 수급인(시공업자) <b>' + esc(sup.legalName || sup.name) + '</b>은(는) 아래 공사에 관하여 다음과 같이 계약을 맺는다.</p>' });
    flow.push({ block: '<h2>계약 내용</h2><table class="kv ct-terms">' + kv(terms) + '</table>' });
    flow.push({ section: { title: '공사대금 지급', cls: 'grid ct-pay-t', cols: [18, 26, 56], head: '<tr><th>구분</th><th>금액</th><th>지급 시기</th></tr>',
      groups: (m.payments.length ? m.payments : [{ label: '', amount: 0, when: '' }]).map(function (p) {
        return { rows: ['<tr><td class="c">' + esc(p.label) + '</td><td class="n">' + (p.amount ? won(p.amount) + '원' : '') + '</td><td>' + esc(p.when) + '</td></tr>'] };
      }).concat([{ keep: true, rows: ['<tr class="tot"><th>합계</th><td class="n">' + won(m.paySum) + '원</td><td>' + (m.paySum === m.total ? '' : '총 공사금액과 ' + won(Math.abs(m.total - m.paySum)) + '원 차이') + '</td></tr>'] }]) } });
    m.clauses.forEach(function (c, i) {
      flow.push({ block: (i === 0 ? '<h2>계약 조항</h2>' : '') + '<div class="ct-art"><h3>제' + c.no + '조' + (c.title ? '(' + esc(c.title) + ')' : '') + '</h3>' +
        c.body.split('\n').map(function (ln) { return '<p' + (/^[①-⑳]/.test(ln) ? ' class="hang"' : '') + '>' + esc(ln) + '</p>'; }).join('') + '</div>' });
    });
    if (m.specials.length) flow.push({ block: '<h2>특약사항</h2><ol class="ct-specials">' + m.specials.map(function (s) { return '<li>' + esc(s) + '</li>'; }).join('') + '</ol>' });
    function signCell(who) {
      var s = m.signs[who];
      return '<td class="ct-sigcell">' + (s ? '<img src="' + esc(s.img) + '" alt="서명">' : '<span>(서명 또는 인)</span>') + '</td>';
    }
    // 도급인·수급인을 한 표에 나란히 (좌우 상자 높이가 같게 — 고객 주소 칸을 세로로 늘림)
    var R = [['상호', sup.legalName || sup.name], ['대표', sup.ceo], ['사업자번호', sup.bizNumber], ['주소', sup.address], ['연락처', sup.phone]]
      .concat(sup.license ? [['건설업 등록', sup.license]] : []);
    var Lt = [['이름', m.customer.name], ['연락처', m.customer.phone], ['주소', m.customer.address]];
    var prow = '';
    R.forEach(function (r, i) {
      var left = i < 2 ? '<th>' + Lt[i][0] + '</th><td>' + esc(Lt[i][1]) + '</td>'
        : i === 2 ? '<th rowspan="' + (R.length - 2) + '">주소</th><td rowspan="' + (R.length - 2) + '">' + esc(Lt[2][1]) + '</td>' : '';
      prow += '<tr>' + left + '<th>' + r[0] + '</th><td>' + esc(r[1]) + '</td></tr>';
    });
    prow += '<tr><th>서명</th>' + signCell('customer') + '<th>서명</th>' + signCell('supplier') + '</tr>';
    flow.push({ block: '<p class="ct-closing">' + esc(m.closing) + '</p><p class="ct-date">' + esc(m.dateK || '　　　　년　　월　　일') + '</p>' +
      '<table class="kv kv2 ct-parties"><colgroup><col style="width:13%"><col style="width:37%"><col style="width:14%"><col style="width:36%"></colgroup>' +
      '<thead><tr><th colspan="2">도급인 (고객)</th><th colspan="2">수급인 (시공업자)</th></tr></thead><tbody>' + prow + '</tbody></table>' });
    // 별첨: 공사 내역서
    var e = m.estimate;
    if (e) {
      var t = e.totals;
      flow.push({ pageBreak: true });
      flow.push({ block: '<h1 class="ct-h1 sm">별첨 · 공사 내역서</h1><p class="ct-annex">' + esc([e.title, e.no ? '견적번호 ' + e.no : '', e.dateK ? '견적일 ' + e.dateK : ''].filter(Boolean).join('  ·  ')) + '</p>' });
      var adj = [];
      if (t.overhead) adj.push(['현장관리비·공과잡비 (' + e.overheadRate + '%)', t.overhead]);
      if (t.discount) adj.push(['할인', -t.discount]);
      if (t.roundAdj) adj.push(['끝자리 정리', t.roundAdj]);
      var foot = ['<tr class="tot"><th colspan="2">공사비 합계</th><td class="n">' + won(t.sum) + '</td></tr>']
        .concat(adj.map(function (r) { return '<tr class="tot"><th colspan="2">' + esc(r[0]) + '</th><td class="n">' + won(r[1]) + '</td></tr>'; }))
        .concat(adj.length || e.vatMode === 'add' ? ['<tr class="tot"><th colspan="2">공급가액</th><td class="n">' + won(t.supply) + '</td></tr>'] : [])
        .concat(e.vatMode === 'add' ? ['<tr class="tot"><th colspan="2">부가세 (10%)</th><td class="n">' + won(t.vat) + '</td></tr>'] : [])
        .concat(['<tr class="tot grand"><th colspan="2">견적 금액' + (e.vatMode === 'excluded' ? ' (부가세 별도)' : '') + '</th><td class="n">' + won(t.total) + '</td></tr>']);
      flow.push({ section: { title: '공사 항목별 합계', cls: 'grid sum', cols: [8, 62, 30], head: '<tr><th>No</th><th>공사 항목</th><th>금액</th></tr>',
        groups: e.cats.map(function (c) { return { rows: ['<tr><td class="c">' + c.no + '</td><td>' + esc(c.name) + '</td><td class="n">' + won(c.sum) + '</td></tr>'] }; }).concat([{ keep: true, rows: foot }]) } });
      if (e.showDetail) {
        flow.push({ section: { title: '세부 내역', cls: 'grid lines', cols: [26, 17, 7, 8, 13, 15, 14],
          head: '<tr><th>품명</th><th>규격·자재</th><th>단위</th><th>수량</th><th>단가</th><th>금액</th><th>비고</th></tr>',
          groups: e.cats.map(function (c) {
            var catRow = '<tr class="cat"><td colspan="7">' + c.no + '. ' + esc(c.name) + '</td></tr>';
            return { cat: catRow, cont: '<tr class="cat"><td colspan="7">' + c.no + '. ' + esc(c.name) + ' <small>(이어서)</small></td></tr>',
              rows: [catRow].concat(c.lines.length ? c.lines.map(function (l) {
                return '<tr><td>' + esc(l.name) + '</td><td>' + esc(l.spec) + '</td><td class="c">' + esc(l.unit) + '</td><td class="n">' + esc(l.qtyText) + '</td><td class="n">' + (l.price ? won(l.price) : '') + '</td><td class="n">' + won(l.amount) + '</td><td>' + esc(l.note) + '</td></tr>';
              }) : ['<tr><td colspan="7" class="muted">적은 항목 없음</td></tr>'], ['<tr class="sub"><td colspan="5">소계</td><td class="n">' + won(c.sum) + '</td><td></td></tr>']) };
          }).concat([{ keep: true, rows: ['<tr class="sub grand"><td colspan="5">공사비 합계</td><td class="n">' + won(t.sum) + '</td><td></td></tr>'] }]) } });
      }
    }
    return { flow: flow, gapMm: 2.5, footer: [sup.name, m.no ? '계약번호 ' + m.no : ''].filter(Boolean).join(' · ') };
  }

  var cexP = null;
  function loadContractExport() {
    if (window.ContractExport) return Promise.resolve(window.ContractExport);
    if (cexP) return cexP;
    cexP = EK.loadExport().then(function () {
      return new Promise(function (resolve, reject) {
        var s = document.createElement('script');
        s.src = DB.base + 'assets/js/contract-export.js';
        s.onload = function () { window.ContractExport ? resolve(window.ContractExport) : reject(new Error('파일 만들기 도구를 불러오지 못했어요.')); };
        s.onerror = function () { cexP = null; reject(new Error('인터넷 연결을 확인해 주세요. (파일 만들기 도구를 불러오지 못했어요)')); };
        document.head.appendChild(s);
      });
    });
    return cexP;
  }

  /* =====================================================================
     계약서 설정
     ===================================================================== */
  function viewSettings(firstTab) {
    K.frame('계약서 설정', true, 'contracts');
    K.state.backTo = '#/contracts';
    app.innerHTML = '<div class="page"><div class="loading">불러오는 중…</div></div>';
    loadSettings(true).then(function () {
      var cfg = ensureKinds(clone(SET)), tab = ['basic', 'clauses', 'kinds', 'phases'].indexOf(firstTab) >= 0 ? firstTab : 'basic';
      var kSel = cfg.defaultKind;   // 계약서 종류 탭에서 고치는 종류
      var csSel = (kindOf(cfg.defaultKind, cfg) || {}).clauseSet || cfg.clauseSets[0].id;   // 조항 탭에서 고치는 조항 묶음
      var psSel = 0;                // 공정·순서 탭에서 고치는 순서 묶음 (번호)
      function defPhases() { return PHASE_QUICK.map(function (n) { return { name: n, days: 1 }; }); }
      if (!Array.isArray(cfg.phases) || !cfg.phases.length) cfg.phases = defPhases();
      if (!Array.isArray(cfg.phaseSets)) cfg.phaseSets = [];
      var page = document.createElement('div');
      page.className = 'page est-page est-set ct-set';
      app.innerHTML = ''; app.appendChild(page);
      function curKind() { var k = kindOf(kSel, cfg) || cfg.kinds[0]; kSel = k.id; return k; }
      function curSet() { var x = setOf(csSel, cfg) || cfg.clauseSets[0]; csSel = x.id; return x; }
      function setLabel(x) { return x.name + ' (조항 ' + x.clauses.length + '개)'; }
      function usedBy(id) { return cfg.kinds.filter(function (k) { return k.clauseSet === id; }); }
      function basicHtml() {
        var w = cfg.warranty || {};
        return '<div class="tip">' + I.info + '<span>모든 계약서에 똑같이 들어가는 값이에요. 조항은 <a href="#/contracts/settings/clauses" data-tab="clauses">조항</a>, 대금 지급 비율·특약사항·부가세는 <a href="#/contracts/settings/kinds" data-tab="kinds">계약서 종류</a>에서 정해요.</span></div>' +
          '<div class="txt-card est-card">' +
          '<div class="field"><label for="s-defkind">새 계약서를 만들 때 처음 고를 종류</label><select class="select" id="s-defkind">' + cfg.kinds.map(function (k) {
            return '<option value="' + esc(k.id) + '"' + (k.id === cfg.defaultKind ? ' selected' : '') + '>' + esc(k.name) + '</option>';
          }).join('') + '</select></div>' +
          '<div class="field"><label for="s-account">입금 계좌</label><input class="input" id="s-account" data-s="account" maxlength="80" value="' + esc(cfg.account || '') + '" placeholder="예) ○○은행 000-000000-00 (예금주 최원진)"><p class="hint">관리자만 볼 수 있는 곳에 저장돼요 (홈페이지에는 나오지 않아요).</p></div>' +
          '<div class="field"><label for="s-license">건설업 등록번호 <span class="opt">(있으면)</span></label><input class="input" id="s-license" data-s="license" maxlength="60" value="' + esc(cfg.license || '') + '"></div></div>' +
          '<div class="txt-card est-card"><span class="label ct-label">하자보수 기간</span><div class="ct-warr"><span>공사를 마친 날부터</span>' +
          '<input class="input" id="s-wn" inputmode="numeric" maxlength="2" value="' + esc(w.n || '') + '" aria-label="기간"><select class="select" id="s-wu" aria-label="단위"><option' + (w.unit !== '개월' ? ' selected' : '') + '>년</option><option' + (w.unit === '개월' ? ' selected' : '') + '>개월</option></select></div>' +
          '<div class="field"><label for="s-wnote">덧붙이는 말</label><input class="input" id="s-wnote" maxlength="80" value="' + esc(w.note || '') + '"></div>' +
          '<p class="hint">★ 건설산업기본법 시행령의 하자담보책임기간은 공사 종류마다 달라요(예: 실내의장·미장·타일·도장·창호 1년, 방수 3년). 부모님 공사 기준으로 확인해 주세요.</p></div>' +
          '<div class="txt-card est-card"><div class="field"><label for="s-late">지연손해금 (손님이 대금을 늦게 줄 때)</label><input class="input" id="s-late" data-s="lateRate" maxlength="60" value="' + esc(cfg.lateRate || '') + '"></div>' +
          '<p class="hint">★ 지연손해금 비율은 예시예요. 부모님과 정해 주세요. 표준 모양 계약서에만 들어가요.</p></div>' +
          (cfg.supplierSign ? '<div class="txt-card est-card"><span class="label ct-label">저장해 둔 업체 서명</span><div class="ct-sign-img"><img src="' + esc(cfg.supplierSign) + '" alt="업체 서명"></div>' +
            '<button type="button" class="btn btn-outline btn-sm" data-signforget>저장해 둔 서명 지우기</button></div>' : '');
      }
      // 계약서 종류: 드롭다운으로 고른 종류의 이름·조항 묶음(드롭다운)·결제 방법 조항·부가세·대금 비율·특약
      function kindsHtml() {
        var k = curKind();
        var missing = KIND_PRESETS.filter(function (p) { return !cfg.kinds.some(function (x) { return x.id === p[0]; }); });
        return '<div class="txt-card est-card ck-pick"><label class="label ct-label" for="s-kind">고칠 계약서 종류</label>' +
          '<select class="select ck-sel" id="s-kind">' + cfg.kinds.map(function (x) {
            return '<option value="' + esc(x.id) + '"' + (x.id === k.id ? ' selected' : '') + '>' + esc(x.name) + (x.id === cfg.defaultKind ? ' - 기본값' : '') + '</option>';
          }).join('') + '</select>' +
          '<div class="ck-btns"><button type="button" class="btn btn-outline" data-kcopy>' + I.plus + '이 종류를 복사해서 새로 만들기</button>' +
          '<button type="button" class="btn btn-text-danger" data-kdel>이 종류 지우기</button></div>' +
          (missing.length ? '<button type="button" class="btn btn-outline btn-sm ck-restore" data-krestore>지운 기본 종류 다시 넣기 (' + esc(missing.map(function (p) { return p[1]; }).join(', ')) + ')</button>' : '') + '</div>' +
          '<div class="txt-card est-card">' +
          '<div class="field"><label for="s-kname">종류 이름</label><input class="input" id="s-kname" data-k="name" maxlength="20" value="' + esc(k.name) + '" placeholder="예) 카드 결제용"></div>' +
          '<div class="field"><div class="ct-pay-head ck-head"><label class="label ct-label" for="k-cs">조항 묶음</label><button type="button" class="btn btn-outline btn-sm ck-setbtn" data-tab="clauses" data-csgo>' + I.gear + '조항 고치기</button></div>' +
          '<select class="select ck-sel" id="k-cs">' + cfg.clauseSets.map(function (x) { return '<option value="' + esc(x.id) + '"' + (x.id === k.clauseSet ? ' selected' : '') + '>' + esc(setLabel(x)) + '</option>'; }).join('') + '</select></div>' +
          '<div class="field"><span class="label">부가세</span><div class="choices">' + VATS.map(function (v) {
            return '<label class="choice"><input type="radio" name="s-kvat" value="' + v[0] + '"' + (k.vat === v[0] ? ' checked' : '') + '><span>' + v[1] + '</span></label>';
          }).join('') + '</div><p class="hint">견적서에서 불러온 계약서는 견적서의 부가세 방식이 그대로 들어가요.</p></div></div>' +
          '<div class="txt-card est-card"><span class="label ct-label">대금 지급 비율</span>' +
          k.payments.map(function (p, i) {
            return '<div class="ct-pay" data-si="' + i + '"><div class="ct-pay-top"><input class="input" data-sp="label" value="' + esc(p.label) + '" maxlength="20" aria-label="구분">' +
              '<div class="est-suffix ct-pct"><input class="input" data-sp="pct" value="' + esc(p.pct) + '" inputmode="decimal" maxlength="5" aria-label="비율"><span>%</span></div>' +
              '<button type="button" class="est-x" data-spdel aria-label="이 줄 지우기">' + I.trash + '</button></div>' +
              '<label class="ct-when"><span>지급 시기</span><input class="input" data-sp="when" value="' + esc(p.when) + '" maxlength="60"></label></div>';
          }).join('') + '<button type="button" class="btn btn-outline est-addline" data-spadd>' + I.plus + '지급 줄 추가</button>' +
          '<p class="hint" id="s-pctsum"></p></div>' +
          '<div class="txt-card est-card"><div class="field"><label for="s-kspec">특약사항</label><textarea class="textarea" id="s-kspec" data-k="specials" rows="3" maxlength="2000" placeholder="한 줄에 하나씩">' + esc(k.specials || '') + '</textarea></div></div>' +
          '<div class="txt-card est-card"><div class="ct-pay-head"><span class="label ct-label">결제 방법 조항</span>' +
          (PAY_CLAUSES[k.preset] ? '<button type="button" class="btn btn-text-danger btn-sm" data-kpreset>처음 문구로</button>' : '') + '</div>' +
          '<p class="hint ck-paytip">계약서를 만들 때 조항 묶음의 ‘공사대금’ 조항 바로 뒤에 들어가요. 비워 두면 넣지 않아요.</p>' +
          '<input class="input ck-paytitle" data-kp="title" maxlength="40" value="' + esc((k.payClause || {}).title || '') + '" placeholder="조항 제목 (예: 결제 방법)" aria-label="결제 방법 조항 제목">' +
          '<textarea class="textarea" data-kp="body" rows="5" maxlength="2000" placeholder="조항 내용" aria-label="결제 방법 조항 내용">' + esc((k.payClause || {}).body || '') + '</textarea></div>';
      }
      // 조항 묶음: 드롭다운으로 고른 묶음의 이름·모양(표준/간단)·조항
      function setsHtml() {
        var x = curSet(), users = usedBy(x.id);
        return '<div class="txt-card est-card ck-pick"><label class="label ct-label" for="cs-sel">고칠 조항 묶음</label>' +
          '<select class="select ck-sel" id="cs-sel">' + cfg.clauseSets.map(function (y) { return '<option value="' + esc(y.id) + '"' + (y.id === x.id ? ' selected' : '') + '>' + esc(setLabel(y)) + '</option>'; }).join('') + '</select>' +
          '<div class="ck-btns"><button type="button" class="btn btn-outline" data-cscopy>' + I.plus + '이 묶음을 복사해서 새로 만들기</button>' +
          '<button type="button" class="btn btn-text-danger" data-csdel>이 묶음 지우기</button></div></div>' +
          '<div class="txt-card est-card">' +
          '<div class="field"><label for="cs-name">묶음 이름</label><input class="input" id="cs-name" data-csn maxlength="20" value="' + esc(x.name) + '" placeholder="예) 간단 v2"></div>' +
          // '계약서 모양(표준/간단)' 고르기는 없앰 (2026-10-26) — 묶음마다 처음 만든 바탕(표준 계약서 / 간단 계약서)을 그대로 따르고, 복사하면 같이 복사됨

          '<p class="hint">' + (users.length ? '쓰는 계약서 종류: <b>' + esc(users.map(function (k) { return k.name; }).join(', ')) + '</b>' : '아직 이 묶음을 쓰는 계약서 종류가 없어요.') + '</p></div>' +
          '<h2 class="est-h ck-h">조항 <small>(' + x.clauses.length + '개)</small></h2>' + clausesHtml(x);
      }
      function clausesHtml(k) {
        var list = k.clauses;
        return '<div class="tip">' + I.info + '<span>고친 조항은 <b>새로 만드는 계약서부터</b> 들어가요. 결제 방법 조항은 <b>계약서 종류</b>마다 따로 정해요.</span></div>' +
          list.map(function (c, i) {
            return '<div class="txt-card est-card ct-clause" data-ci="' + i + '"><div class="ct-clause-head"><b>제' + (i + 1) + '조</b>' +
              '<div class="set-move"><button type="button" data-cmv="-1"' + (i === 0 ? ' disabled' : '') + '>위로</button><button type="button" data-cmv="1"' + (i === list.length - 1 ? ' disabled' : '') + '>아래로</button>' +
              '<button type="button" class="danger" data-cdel>지우기</button></div></div>' +
              '<input class="input" data-cf="title" maxlength="40" value="' + esc(c.title) + '" aria-label="조항 제목">' +
              '<textarea class="textarea" data-cf="body" rows="4" maxlength="2000" aria-label="조항 내용">' + esc(c.body) + '</textarea></div>';
          }).join('') +
          '<button type="button" class="btn btn-outline est-addline" data-cadd>' + I.plus + '조항 추가</button>' +
          // 지금 조항을 (새) 조항 묶음으로 저장 — 계약서 '지금 순서를 묶음으로 저장'·견적서 '지금 고른 공사를 묶음으로 저장'과 같은 글자 단추
          '<button type="button" class="btn-link cs-saveas" data-cssaveas>지금 조항을 묶음으로 저장</button>' +
          '<button type="button" class="btn btn-text-danger set-reset" data-creset>처음 조항으로 되돌리기</button>';
      }
      // 공정 기본 일수: 계약서 '세부 공사일정'의 공정 고르기 칸과, 공정 이름을 쓸 때 저절로 들어가는 기간
      function phasesSetHtml() {
        return '<h2 class="est-h">공정 기본 일수</h2><div class="tip">' + I.info + '<span>계약서 <b>세부 공사일정</b>에서 공정을 넣을 때 처음 들어가는 기간이에요. 예) 도배 3일, 장판 2일. ' +
          '<b>공정 고르기</b> 칸도 이 목록 순서대로 나오고(고른 공정도 이 순서대로 들어가요), 공정 이름을 직접 써도 같은 이름이면 기간이 저절로 들어가요. 계약서마다 따로 고칠 수 있어요.</span></div>' +
          '<div class="txt-card est-card"><div class="ct-psets">' + cfg.phases.map(function (p, i) {
            return '<div class="ct-pset" data-pi="' + i + '">' + '<span class="set-grip" data-sgrip title="잡고 끌어서 순서 바꾸기" aria-hidden="true">' + K.GRIP + '</span>' + '<input class="input" data-pf="name" maxlength="30" value="' + esc(p.name) + '" placeholder="공정 이름" aria-label="' + (i + 1) + '번 공정 이름">' +
              '<div class="est-suffix"><input class="input" data-pf="days" inputmode="numeric" maxlength="3" value="' + esc(p.days) + '" aria-label="' + (i + 1) + '번 공정 기본 일수"><span>일</span></div>' +
              '<div class="set-move"><button type="button" data-pmv="-1"' + (i === 0 ? ' disabled' : '') + ' aria-label="위로">▲</button><button type="button" data-pmv="1"' + (i === cfg.phases.length - 1 ? ' disabled' : '') + ' aria-label="아래로">▼</button>' +
              '<button type="button" class="est-x" data-pdel aria-label="이 공정 지우기">' + I.trash + '</button></div></div>';
          }).join('') + '</div>' +
          '<button type="button" class="btn btn-outline est-addline" data-padd>' + I.plus + '공정 추가</button></div>' +
          '<button type="button" class="btn btn-text-danger set-reset" data-preset>처음 목록으로 되돌리기 (모두 1일)</button>' + phaseSetsHtml();
      }
      // 순서 묶음 (예: 아파트 전체 리모델링 = 철거 1일 → 설비 2일 → … → 청소 1일)
      function phaseSetsHtml() {
        return '<h2 class="est-h ps-h">순서 묶음</h2>' +
          '<div class="tip">' + I.info + '<span>자주 하는 공사의 <b>공정 순서와 일수</b>를 이름 붙여 저장해 두면, 계약서 세부 공사일정에서 <b>불러오기</b> 한 번으로 다 들어가요. 계약서 화면의 <b>지금 순서를 묶음으로 저장</b>으로도 만들 수 있어요.</span></div>' +
          (cfg.phaseSets.length ? (function () {
            if (psSel >= cfg.phaseSets.length) psSel = cfg.phaseSets.length - 1;
            if (psSel < 0) psSel = 0;
            var si = psSel, S1 = cfg.phaseSets[si];
            var total = S1.items.reduce(function (a, it) { return a + (Math.round(num(it.days)) || 0); }, 0);
            return '<div class="txt-card est-card ck-pick"><label class="label ct-label" for="ps-sel">고칠 순서 묶음</label>' +
              '<select class="select ck-sel" id="ps-sel">' + cfg.phaseSets.map(function (x, i) { return '<option value="' + i + '"' + (i === si ? ' selected' : '') + '>' + esc(psLabel(x, i)) + '</option>'; }).join('') + '</select>' +
              '<div class="ck-btns"><button type="button" class="btn btn-outline" data-psadd>' + I.plus + '새 순서 묶음 만들기</button>' +
              '<button type="button" class="btn btn-text-danger" data-psdel>이 묶음 지우기</button></div></div>' +
              '<div class="txt-card est-card ps-card" data-psi="' + si + '"><div class="field ps-name"><label for="ps-name">묶음 이름</label><input class="input" id="ps-name" data-psn maxlength="30" value="' + esc(S1.name) + '" placeholder="예: 아파트 전체 리모델링"></div>' +
              '<div class="ph-pick ps-pick" role="group" aria-label="이 묶음에 넣을 공정 고르기">' + psTiles(S1) + '</div>' +
              '<div class="ct-psets">' + S1.items.map(function (it, ii) {
                return '<div class="ct-pset ps-item" data-pii="' + ii + '">' + '<span class="set-grip" data-sgrip title="잡고 끌어서 순서 바꾸기" aria-hidden="true">' + K.GRIP + '</span>' + '<input class="input" data-psf="name" maxlength="30" value="' + esc(it.name) + '" placeholder="공정 이름" aria-label="' + (ii + 1) + '번 공정">' +
                  '<div class="est-suffix"><input class="input" data-psf="days" inputmode="numeric" maxlength="3" value="' + esc(it.days) + '" aria-label="' + (ii + 1) + '번 공정 일수"><span>일</span></div>' +
                  '<div class="set-move"><button type="button" data-psmv="-1"' + (ii === 0 ? ' disabled' : '') + ' aria-label="위로">▲</button><button type="button" data-psmv="1"' + (ii === S1.items.length - 1 ? ' disabled' : '') + ' aria-label="아래로">▼</button>' +
                  '<button type="button" class="est-x" data-psidel aria-label="이 공정 빼기">' + I.trash + '</button></div></div>';
              }).join('') + '</div>' +
              '<p class="hint ps-total">공정 ' + S1.items.length + '개 · 모두 ' + total + '일</p></div>';
          })() : '<button type="button" class="btn btn-outline est-addline" data-psadd>' + I.plus + '순서 묶음 만들기</button>');
      }
      // 순서 묶음에 넣을 공정 고르기 칸 = 위 '공정 기본 일수' 목록 (목록에 공정을 넣거나 이름을 바꾸면 바로 반영)
      function psTiles(S1) {
        return cfg.phases.filter(function (p) { return String(p.name || '').trim(); }).map(function (p) {
          return pickTile(p.name, p.days, S1.items.some(function (it) { return nkey(it.name) === nkey(p.name); }), 'data-psq');
        }).join('');
      }
      var psT = null;
      function psTilesSync() { var box = $('.ps-pick', page), S1 = cfg.phaseSets[psSel]; if (box && S1) box.innerHTML = psTiles(S1); }
      function psLabel(x, i) {
        var d = (x.items || []).reduce(function (a, it) { return a + (Math.round(num(it.days)) || 0); }, 0);
        return (String(x.name || '').trim() || '순서 묶음 ' + (i + 1)) + ' (' + (x.items || []).length + '개 · ' + d + '일)';
      }
      function render(toTop) {
        var y0 = toTop ? 0 : window.scrollY;   // 다시 그려도 보던 자리 그대로 (탭을 바꿀 때만 맨 위로)
        setTimeout(function () { if (Math.abs(window.scrollY - y0) > 2) window.scrollTo(0, y0); }, 0);
        page.innerHTML = '<nav class="est-steps set-tabs" aria-label="계약서 설정">' +
          [['basic', '기본값'], ['clauses', '조항'], ['kinds', '계약서 종류'], ['phases', '공정·순서']].map(function (t) {
            return '<button type="button" class="est-step' + (tab === t[0] ? ' on' : '') + '" data-tab="' + t[0] + '">' + t[1] + '</button>';
          }).join('') + '</nav><div class="est-body">' +
          (tab === 'basic' ? basicHtml() : tab === 'phases' ? phasesSetHtml() : tab === 'clauses' ? setsHtml() : kindsHtml()) +
          '</div><div class="savebar est-bar set-bar"' + (K.state.dirty ? '' : ' hidden') + '><div class="est-sum"><small>계약서 설정</small><b id="set-state">저장 안 한 내용 있음</b></div>' +
          '<div class="est-nav"><button class="btn btn-primary" type="button" data-setsave>' + I.check + '설정 저장</button></div></div>';
        pctSum();
      }
      function pctSum() {
        var el = $('#s-pctsum', page); if (!el) return;
        var s = curKind().payments.reduce(function (a, p) { return a + num(p.pct); }, 0);
        el.textContent = '비율 합계 ' + s + '%' + (s === 100 ? '' : ' — 100%가 되게 맞춰 주세요');
        el.style.color = s === 100 ? '' : 'var(--danger)';
      }
      function mark() { K.setDirty(true); var sb = $('.set-bar', page); if (sb) sb.hidden = false; }   // 저장 막대는 바꾼 게 있을 때만
      // 공정 기본 일수 · 순서 묶음 줄: ⋮⋮ 손잡이를 잡고 끌어서 순서 바꾸기 (▲▼ 단추도 그대로)
      K.sortable(page, { grip: '[data-sgrip]', item: '.ct-pset', done: function (box, order) {
        if ($('[data-pi]', box)) { var P0 = cfg.phases; cfg.phases = order.map(function (i) { return P0[i]; }); }
        else { var S0 = cfg.phaseSets[+box.closest('[data-psi]').getAttribute('data-psi')], L0 = S0.items; S0.items = order.map(function (i) { return L0[i]; }); }
        mark(); render();
      } });
      page.addEventListener('input', function (e) {
        var el = e.target, k;
        if ((k = el.getAttribute('data-s'))) { cfg[k] = el.value; return mark(); }
        if ((k = el.getAttribute('data-sp'))) { curKind().payments[+el.closest('[data-si]').getAttribute('data-si')][k] = k === 'pct' ? (num(el.value) || '') : el.value; pctSum(); return mark(); }
        if ((k = el.getAttribute('data-cf'))) { curSet().clauses[+el.closest('[data-ci]').getAttribute('data-ci')][k] = el.value; return mark(); }
        if (el.hasAttribute('data-csn')) { var cx = curSet(); cx.name = el.value; var co = $('#cs-sel option[value="' + cx.id + '"]', page); if (co) co.textContent = setLabel({ name: el.value.trim() || '이름 없는 묶음', base: cx.base, clauses: cx.clauses }); return mark(); }
        if ((k = el.getAttribute('data-kp'))) { var kq = curKind(); kq.payClause = kq.payClause || { title: '', body: '' }; kq.payClause[k] = el.value; return mark(); }
        if ((k = el.getAttribute('data-k'))) {
          var kk = curKind(); kk[k] = el.value;
          if (k === 'name') { var op = $('#s-kind option[value="' + kk.id + '"]', page); if (op) op.textContent = (el.value.trim() || '이름 없는 종류') + (kk.id === cfg.defaultKind ? ' - 기본값' : ''); }
          return mark();
        }
        if (el.hasAttribute('data-psn')) { var nsi = +el.closest('[data-psi]').getAttribute('data-psi'); cfg.phaseSets[nsi].name = el.value; var po = $('#ps-sel option[value="' + nsi + '"]', page); if (po) po.textContent = psLabel(cfg.phaseSets[nsi], nsi); return mark(); }
        if ((k = el.getAttribute('data-psf'))) {
          var sit = cfg.phaseSets[+el.closest('[data-psi]').getAttribute('data-psi')].items[+el.closest('[data-pii]').getAttribute('data-pii')];
          sit[k] = k === 'days' ? (parseInt(String(el.value).replace(/[^0-9]/g, ''), 10) || '') : el.value;
          if (k === 'days' && String(el.value) !== String(sit.days)) el.value = sit.days;
          if (k === 'name') { clearTimeout(psT); psT = setTimeout(psTilesSync, 250); }
          return mark();
        }
        if ((k = el.getAttribute('data-pf'))) {
          var prow = cfg.phases[+el.closest('[data-pi]').getAttribute('data-pi')];
          prow[k] = k === 'days' ? (parseInt(String(el.value).replace(/[^0-9]/g, ''), 10) || '') : el.value;
          if (k === 'days' && String(el.value) !== String(prow.days)) el.value = prow.days;
          clearTimeout(psT); psT = setTimeout(psTilesSync, 250);   // 아래 순서 묶음의 고르기 칸에 바로 보이게
          return mark();
        }
        if (el.id === 's-wn' || el.id === 's-wnote') { cfg.warranty = cfg.warranty || {}; if (el.id === 's-wn') cfg.warranty.n = Math.round(num(el.value)) || ''; else cfg.warranty.note = el.value; return mark(); }
      });
      page.addEventListener('change', function (e) {
        var el = e.target;
        if (el.id === 's-defkind') { cfg.defaultKind = el.value; return mark(); }
        if (el.id === 's-kind') { kSel = el.value; render(); return; }
        if (el.id === 'ps-sel') { psSel = +el.value; render(); return; }
        if (el.name === 's-kvat') { curKind().vat = el.value; return mark(); }
        if (el.id === 'cs-sel') { csSel = el.value; render(); return; }
        if (el.id === 'k-cs') { curKind().clauseSet = el.value; return mark(); }
        if (el.name === 'cs-base') {
          var xb = curSet(), nb = el.value;
          xb.base = nb; mark();
          return K.ask({ title: '조항도 ' + (nb === 'simple' ? '간단' : '표준') + ' 계약서 조항으로 바꿀까요?', text: '지금 조항 ' + xb.clauses.length + '개가 ' + (nb === 'simple' ? '간단 계약서 처음 조항(5개)' : '표준 계약서 처음 조항(12개)') + '으로 바뀌어요.', cancel: '모양만 바꾸기', ok: '조항도 바꾸기' })
            .then(function (ok) { if (ok) xb.clauses = baseClauses(nb, null); render(); });
        }
        if (el.id === 's-wu') { cfg.warranty = cfg.warranty || {}; cfg.warranty.unit = el.value; mark(); }
      });
      page.addEventListener('click', function (e) {
        var t = e.target, x;
        if (t.closest('[data-csgo]')) csSel = curKind().clauseSet;   // '조항 고치기' → 이 종류가 쓰는 묶음을 열기
        if ((x = t.closest('[data-tab]'))) { e.preventDefault(); tab = x.getAttribute('data-tab'); render(true); window.scrollTo(0, 0); return; }
        // 조항 묶음: 복사해서 새로 만들기 · 지우기 (쓰는 종류가 있으면 다른 묶음으로 바꿀지 물음)
        // 지금 조항을 묶음으로 저장: 이름을 받아 지금 보이는 조항으로 새 묶음을 만듦(같은 이름이 있으면 그 묶음을 바꿀지 물어봄)
        // 고치던 묶음은 마지막으로 저장한 조항으로 돌려놓아 '다른 이름으로 저장'처럼 동작. 설정 저장을 눌러야 적용
        if (t.closest('[data-cssaveas]')) {
          var sx = curSet(), scl = clone(sx.clauses).filter(function (c) { return String(c.title || '').trim() || String(c.body || '').trim(); });
          if (!scl.length) { K.notice('조항을 먼저 적어 주세요'); return; }
          var spr = K.ask({ title: '지금 조항을 묶음으로 저장', text: '이름을 붙여 두면 계약서 종류와 계약서에서 이 조항 묶음을 고를 수 있어요.<br><input class="input ps-name-in" id="cs-saveas-in" maxlength="20" placeholder="예) 간단 v2" aria-label="조항 묶음 이름">' +
            '<small class="ps-name-sub">조항 ' + scl.length + '개 · 설정 저장을 누르면 적용돼요</small>', cancel: '그만두기', ok: '저장' });
          var sin = document.getElementById('cs-saveas-in'); if (sin) setTimeout(function () { sin.focus(); }, 60);
          return spr.then(function (ok) {
            var snm = sin ? sin.value.trim().slice(0, 20) : '';
            if (!ok) return;
            if (!snm) { K.notice('이름을 적어야 저장돼요', '이름을 적고 다시 눌러 주세요.'); return; }
            var same = cfg.clauseSets.filter(function (y) { return String(y.name || '').trim() === snm; })[0];
            var put = function () {
              var saved = setOf(sx.id, SET);   // 고치던 묶음은 마지막 저장본으로 (새 묶음과 같은 묶음이면 그대로)
              if (same) { same.clauses = scl; csSel = same.id; }
              else { var nn = clone(sx); nn.id = 'cs' + Date.now().toString(36); nn.name = snm; nn.clauses = scl; cfg.clauseSets.push(nn); csSel = nn.id; }
              if (saved && (!same || same.id !== sx.id)) sx.clauses = clone(saved.clauses);
              mark(); render();
            };
            if (same && same.id !== sx.id) return K.ask({ title: '같은 이름이 있어요', text: '<b>' + esc(snm) + '</b> 조항 묶음을 지금 조항으로 바꿀까요?', cancel: '그만두기', ok: '바꾸기' }).then(function (y) { if (y) put(); });
            put();
          });
        }
        if (t.closest('[data-cscopy]')) {
          var cs0 = curSet(), ncs = clone(cs0);
          ncs.id = 'cs' + Date.now().toString(36); ncs.name = (cs0.name + ' 복사').slice(0, 20);
          cfg.clauseSets.push(ncs); csSel = ncs.id; mark(); render();
          var cin = $('#cs-name', page); if (cin) { cin.focus(); cin.select(); }
          K.toast('‘' + cs0.name + '’을(를) 복사했어요 · 이름부터 바꿔 주세요');
          return;
        }
        if (t.closest('[data-csdel]')) {
          if (cfg.clauseSets.length <= 1) { K.notice('조항 묶음은 하나는 있어야 해요'); return; }
          var dcs = curSet(), users = usedBy(dcs.id), others = cfg.clauseSets.filter(function (y) { return y.id !== dcs.id; });
          // 이 묶음을 쓰는 종류가 있으면, 그 종류들을 어느 묶음으로 바꿀지 먼저 고르게 함
          var pick = users.length ? '<br><br>이 묶음을 쓰는 <b>' + esc(users.map(function (k) { return k.name; }).join(', ')) + '</b>은(는) 아래 묶음으로 바꿔요.' +
            '<select class="select cs-alt" id="cs-alt" aria-label="대신 쓸 조항 묶음">' + others.map(function (y) { return '<option value="' + esc(y.id) + '">' + esc(setLabel(y)) + '</option>'; }).join('') + '</select>' : '';
          var pr2 = K.ask({ title: '이 조항 묶음을 지울까요?', text: '<b>' + esc(dcs.name) + '</b>' + pick + '<br>이미 만든 계약서는 그대로예요. (설정 저장을 눌러야 적용돼요)', cancel: '그만두기', ok: users.length ? '바꾸고 지우기' : '지우기', okClass: 'btn-danger' });
          var altSel = document.getElementById('cs-alt');
          return pr2.then(function (ok) {
            if (!ok) return;
            var alt = (altSel && altSel.value) || others[0].id;
            users.forEach(function (k) { k.clauseSet = alt; });
            cfg.clauseSets = cfg.clauseSets.filter(function (y) { return y.id !== dcs.id; });
            csSel = alt; mark(); render();
            if (users.length) K.notice('이 묶음을 쓰던 종류를 바꿨어요', esc(users.map(function (k) { return k.name; }).join(', ')) + ' → <b>' + esc((setOf(alt, cfg) || {}).name) + '</b>');
          });
        }
        if (t.closest('[data-kpreset]')) {
          var kr = curKind(), pc0 = PAY_CLAUSES[kr.preset]; if (!pc0) return;
          return K.ask({ title: '결제 방법 조항을 처음 문구로 되돌릴까요?', text: '(설정 저장을 눌러야 적용돼요)', cancel: '그만두기', ok: '되돌리기' }).then(function (ok) {
            if (ok) { kr.payClause = { title: pc0[0], body: pc0[1] }; mark(); render(); }
          });
        }
        if (t.closest('[data-spadd]')) { curKind().payments.push({ label: '', pct: '', when: '' }); mark(); render(); return; }
        if ((x = t.closest('[data-spdel]'))) { var KP = curKind().payments; if (KP.length > 1) { KP.splice(+x.closest('[data-si]').getAttribute('data-si'), 1); mark(); render(); } return; }
        // 계약서 종류: 복사해서 새로 만들기 · 지우기 · 지운 기본 종류 다시 넣기
        if (t.closest('[data-kcopy]')) {
          var src = curKind(), nk = clone(src);
          nk.id = 'k' + Date.now().toString(36); nk.preset = null; nk.name = (src.name + ' 복사').slice(0, 20);
          cfg.kinds.push(nk); kSel = nk.id; mark(); render();
          var nin = $('#s-kname', page); if (nin) { nin.focus(); nin.select(); }
          K.toast('‘' + src.name + '’을(를) 복사했어요 · 이름부터 바꿔 주세요');
          return;
        }
        if (t.closest('[data-kdel]')) {
          if (cfg.kinds.length <= 1) { K.notice('계약서 종류는 하나는 있어야 해요'); return; }
          var dk = curKind();
          return K.ask({ title: '이 계약서 종류를 지울까요?', text: '<b>' + esc(dk.name) + '</b> — 이미 만든 계약서는 그대로예요. (설정 저장을 눌러야 적용돼요)', cancel: '그만두기', ok: '지우기', okClass: 'btn-danger' }).then(function (ok) {
            if (!ok) return;
            cfg.kinds = cfg.kinds.filter(function (q) { return q.id !== dk.id; });
            if (cfg.defaultKind === dk.id) cfg.defaultKind = cfg.kinds[0].id;
            kSel = cfg.defaultKind; mark(); render();
          });
        }
        if (t.closest('[data-krestore]')) {
          var base0 = curKind(), added = [];
          KIND_PRESETS.forEach(function (p) {
            if (cfg.kinds.some(function (q) { return q.id === p[0]; })) return;
            var pk = presetKind(p[0], { payments: base0.payments, clauseSets: cfg.clauseSets });
            cfg.kinds.push(pk); added.push(pk.name);
          });
          if (added.length) { kSel = cfg.kinds[cfg.kinds.length - 1].id; mark(); render(); K.toast(added.join(', ') + '을(를) 다시 넣었어요'); }
          return;
        }
        if (t.closest('[data-cadd]')) { curSet().clauses.push({ title: '', body: '' }); mark(); render(); var last = $$('.ct-clause', page).pop(); if (last) setTimeout(function () { K.focusNear($('input', last)); }, 10); return; }
        if ((x = t.closest('[data-cmv]'))) {
          var dir = x.getAttribute('data-cmv'), i = +x.closest('[data-ci]').getAttribute('data-ci'), j = i + +dir, L = curSet().clauses;
          if (j >= 0 && j < L.length) {
            var tmp = L[i]; L[i] = L[j]; L[j] = tmp; mark(); render();
            var mb = $('[data-ci="' + j + '"] [data-cmv="' + dir + '"]', page);
            if (mb) setTimeout(function () { if (!mb.disabled) K.focusNear(mb); else mb.scrollIntoView({ block: 'nearest' }); }, 10);
          }
          return;
        }
        if ((x = t.closest('[data-cdel]'))) {
          var CK = curSet().clauses, ci2 = +x.closest('[data-ci]').getAttribute('data-ci'), cc = CK[ci2] || {};
          if (!String(cc.title || '').trim() && !String(cc.body || '').trim()) { CK.splice(ci2, 1); mark(); render(); return; }
          return K.ask({ title: '제' + (ci2 + 1) + '조를 지울까요?', text: '<b>' + esc(cc.title || '제목 없음') + '</b> (설정 저장을 눌러야 적용돼요)', cancel: '그만두기', ok: '지우기', okClass: 'btn-danger' })
            .then(function (ok) { if (ok) { CK.splice(ci2, 1); mark(); render(); } });
        }
        if (t.closest('[data-creset]')) {
          var rs = curSet();
          return K.ask({ title: '처음 조항으로 되돌릴까요?', text: '<b>' + esc(rs.name) + '</b>의 조항이 ' + (rs.base === 'simple' ? '간단' : '표준') + ' 계약서 처음 문구로 돌아가요. (설정 저장을 눌러야 적용돼요)', cancel: '그만두기', ok: '되돌리기' }).then(function (ok) {
            if (ok) { rs.clauses = baseClauses(rs.base, null); mark(); render(); }
          });
        }
        if (t.closest('[data-signforget]')) { cfg.supplierSign = null; mark(); render(); return; }
        if (t.closest('[data-psadd]')) { cfg.phaseSets.push({ name: '', items: [] }); psSel = cfg.phaseSets.length - 1; mark(); render(); var lc = $('.ps-card', page); if (lc) setTimeout(function () { lc.scrollIntoView({ block: 'nearest' }); K.focusNear($('[data-psn]', lc)); }, 10); return; }
        if ((x = t.closest('[data-psdel]'))) {
          var dsi = psSel;
          return K.ask({ title: '이 순서 묶음을 지울까요?', text: '<b>' + esc(cfg.phaseSets[dsi].name || '이름 없는 묶음') + '</b> (설정 저장을 눌러야 적용돼요)', cancel: '그만두기', ok: '지우기', okClass: 'btn-danger' })
            .then(function (ok) { if (ok) { cfg.phaseSets.splice(dsi, 1); psSel = Math.max(0, dsi - 1); mark(); render(); } });
        }
        if ((x = t.closest('[data-psq]'))) {
          var PSI = cfg.phaseSets[+x.closest('[data-psi]').getAttribute('data-psi')].items, pqn = x.getAttribute('data-psq');
          if (x.getAttribute('aria-pressed') === 'true') {
            for (var pq = PSI.length - 1; pq >= 0; pq--) { if (nkey(PSI[pq].name) === nkey(pqn)) { PSI.splice(pq, 1); break; } }
          } else {
            var pd = cfg.phases.filter(function (p) { return nkey(p.name) === nkey(pqn); })[0];
            insertByOrder(PSI, { name: pqn, days: (pd && pd.days) || 1 }, cfg.phases.map(function (p) { return nkey(p.name); }));
          }
          mark(); render(); return;
        }
        if ((x = t.closest('[data-psidel]'))) { cfg.phaseSets[+x.closest('[data-psi]').getAttribute('data-psi')].items.splice(+x.closest('[data-pii]').getAttribute('data-pii'), 1); mark(); render(); return; }
        if ((x = t.closest('[data-psmv]'))) {
          var SL = cfg.phaseSets[+x.closest('[data-psi]').getAttribute('data-psi')].items, a1 = +x.closest('[data-pii]').getAttribute('data-pii'), a2 = a1 + +x.getAttribute('data-psmv');
          if (a2 >= 0 && a2 < SL.length) { var tt = SL[a1]; SL[a1] = SL[a2]; SL[a2] = tt; mark(); render(); }
          return;
        }
        if (t.closest('[data-padd]')) { cfg.phases.push({ name: '', days: 1 }); mark(); render(); var lp = $$('.ct-pset[data-pi]', page).pop(); /* 공정 목록의 새 줄 — 아래 순서 묶음 줄도 .ct-pset 이라, 전에는 순서 묶음 마지막 줄로 커서가 가던 문제 */ if (lp) setTimeout(function () { K.focusNear($('input', lp)); }, 10); return; }
        if ((x = t.closest('[data-pdel]'))) { cfg.phases.splice(+x.closest('[data-pi]').getAttribute('data-pi'), 1); if (!cfg.phases.length) cfg.phases = defPhases(); mark(); render(); return; }
        if ((x = t.closest('[data-pmv]'))) {
          var pi = +x.closest('[data-pi]').getAttribute('data-pi'), pj = pi + +x.getAttribute('data-pmv'), PL = cfg.phases;
          if (pj >= 0 && pj < PL.length) { var pt = PL[pi]; PL[pi] = PL[pj]; PL[pj] = pt; mark(); render(); }
          return;
        }
        if (t.closest('[data-preset]')) {
          return K.ask({ title: '처음 목록으로 되돌릴까요?', text: '공정 목록이 처음 12개로 돌아가고 기간은 모두 1일이 돼요. (설정 저장을 눌러야 적용돼요)', cancel: '그만두기', ok: '되돌리기' }).then(function (ok) {
            if (ok) { cfg.phases = defPhases(); mark(); render(); }
          });
        }
        if (t.closest('[data-setsave]')) {
          var off = cfg.kinds.filter(function (k) { return k.payments.reduce(function (a, p) { return a + num(p.pct); }, 0) !== 100; });
          (off.length ? K.ask({ title: '대금 비율 합계가 100%가 아닌 종류가 있어요', text: off.map(function (k) { return '<b>' + esc(k.name) + '</b> ' + k.payments.reduce(function (a, p) { return a + num(p.pct); }, 0) + '%'; }).join('<br>') + '<br>그대로 저장할까요?', cancel: '다시 맞추기', ok: '그대로 저장' }) : Promise.resolve(true)).then(function (ok) {
            if (!ok) { if (off.length) { kSel = off[0].id; tab = 'kinds'; render(); } return; }
            var out = clone(cfg);
            var keep = function (c) { return String(c.title || '').trim() || String(c.body || '').trim(); };
            out.clauseSets = out.clauseSets.map(function (x, i) {
              return { id: x.id, name: String(x.name || '').trim() || '조항 묶음 ' + (i + 1), base: x.base === 'simple' ? 'simple' : 'standard',
                clauses: x.clauses.filter(keep).map(function (c) { return { title: String(c.title || '').trim(), body: String(c.body || '').trim() }; }) };
            });
            out.kinds = out.kinds.map(function (k, i) {
              var pc = k.payClause && keep(k.payClause) ? { title: String(k.payClause.title || '').trim(), body: String(k.payClause.body || '').trim() } : null;
              return { id: k.id, preset: k.preset || null, name: String(k.name || '').trim() || '계약서 종류 ' + (i + 1),
                clauseSet: setOf(k.clauseSet, out) ? k.clauseSet : out.clauseSets[0].id, payClause: pc, vat: k.vat, specials: String(k.specials || ''),
                payments: k.payments.filter(function (p) { return String(p.label || '').trim() || num(p.pct); }).map(function (p) { return { label: String(p.label || '').trim(), pct: num(p.pct) || '', when: String(p.when || '').trim() }; }) };
            });
            // 예전 칸도 처음 고르는 종류에 맞춰 둠 (옛 화면·백업과 맞추기)
            var dk = kindOf(out.defaultKind, out) || out.kinds[0], dset = setOf(dk.clauseSet, out);
            out.mode = dset && dset.base === 'simple' ? 'simple' : 'standard'; out.payments = dk.payments.length ? clone(dk.payments) : out.payments; out.specials = dk.specials;
            out.delayRate = '';
            out.phases = out.phases.filter(function (p) { return String(p.name || '').trim(); })
              .map(function (p) { return { name: String(p.name).trim(), days: Math.min(365, Math.max(1, Math.round(num(p.days)) || 1)) }; });
            out.phaseSets = (out.phaseSets || []).map(function (S1) {
              return { name: String(S1.name || '').trim(), items: (S1.items || []).filter(function (it) { return String(it.name || '').trim(); })
                .map(function (it) { return { name: String(it.name).trim(), days: Math.min(365, Math.max(1, Math.round(num(it.days)) || 1)) }; }) };
            }).filter(function (S1) { return S1.items.length; }).map(function (S1, i) { if (!S1.name) S1.name = '순서 묶음 ' + (i + 1); return S1; });
            var sb = $('[data-setsave]', page); if (sb) sb.disabled = true;
            // 저장한 뒤에도 이 화면(같은 탭·같은 선택)에 그대로 있고, 저장된 값으로 다시 그림
            saveSettings(out).then(function () { cfg = ensureKinds(clone(SET)); K.setDirty(false); render(); }).catch(function (err) { if (sb) sb.disabled = false; fail('저장하지 못했어요', err); });
          });
        }
      });
      render();
    }).catch(function (err) {
      app.innerHTML = '<div class="page"><div class="empty-box">' + esc(K.friendlyError(err)) + '</div></div>';
    });
  }

  K.routes.contracts = function (args) {
    if (args[0] === 'settings') return viewSettings(args[1]);
    // #/contracts/open (진행 중: 작성 중 + 계약 완료) · #/contracts/<상태>
    var pre = args[0] === 'open' ? ['draft', 'signed'] : CFILTERS.some(function (f) { return f[0] === args[0]; }) ? (args[0] === 'all' ? [] : [args[0]]) : null;
    if (pre) { var st = K.filterState('ctrF', []); st.q = ''; st.reg = ''; st.from = ''; st.to = ''; st.st = pre; }
    return viewList();
  };
  K.routes.contract = viewEditor;
  window.ContractKit = { termSummary: termSummary, resolvePhases: resolvePhases, model: model, ctParts: ctParts, blankDoc: blankDoc, snapEstimate: snapEstimate, fromEstimate: fromEstimate, loadSettings: loadSettings, STD_CLAUSES: STD_CLAUSES, SIMPLE_CLAUSES: SIMPLE_CLAUSES };
})();
