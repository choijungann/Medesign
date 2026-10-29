/* =====================================================================
   관리화면 — 고객 관리
   · 고객 목록 · 이름/연락처 검색 → 이전 견적서·계약서·상담 신청 보기
   · 고객 전체를 엑셀로 받기
   · 하자 접수 → 현장 확인 → 하자 보수 일정 → 완료 기록
   고객은 견적서·계약서를 저장할 때 전화번호로 저절로 만들어지고 연결됩니다.
   ===================================================================== */
(function () {
  'use strict';
  var K = window.AdminKit;
  if (!K) return;
  var C = K.C, DB = K.DB, I = K.I, esc = K.esc, $ = K.$, $$ = K.$$;
  var app = document.getElementById('app');
  var STATUS = { draft: '작성 중', signed: '계약 완료', done: '공사 완료', canceled: '계약 중단', terminated: '계약 파기' };
  var MAX_DEFECT_PHOTOS = 20;
  var DSTEP = [['new', '접수'], ['check', '현장 확인'], ['repair', '하자 보수'], ['done', '완료']];

  function fail(title, err) { return K.ask({ title: title, text: esc(K.friendlyError(err)), cancel: false, ok: '확인' }); }
  function errPage(err, back) {
    app.innerHTML = '<div class="page"><div class="empty-box">' + esc(K.friendlyError(err)) + '<br><a href="' + (back || '#/customers') + '">고객 목록으로</a></div></div>';
  }
  function dupMsg(err) { return /duplicate|unique|customers_phone/i.test(String(err && err.message)) ? '같은 전화번호로 등록된 고객이 이미 있어요. 고객 목록에서 그 번호를 찾아 주세요.' : K.friendlyError(err); }
  function defectStatus(d) { return d.done_on ? 'done' : d.repair_on ? 'repair' : d.check_on ? 'check' : 'new'; }
  // 하자 보수 기간 글: '10월 28일(수) ~ 10월 30일(금)' (하루면 하루만)
  function repairRange(d) { return d.repair_on ? K.sDate(d.repair_on) + (d.repair_end && d.repair_end > d.repair_on ? ' ~ ' + K.sDate(d.repair_end) : '') : ''; }
  function stepLabel(st) { var x = DSTEP.filter(function (s) { return s[0] === st; })[0]; return x ? x[1] : '접수'; }
  // 하자 다음 할 일 한 줄
  function defectNext(d) {
    if (d.status === 'done') return '완료 ' + K.sDate(d.done_on || '');
    if (d.repair_on) return '보수 ' + repairRange(d) + (d.repair_time ? ' ' + d.repair_time : '');
    if (d.check_on) return '현장 확인 ' + K.sDate(d.check_on) + (d.check_time ? ' ' + d.check_time : '');
    return '접수 ' + K.sDate(d.received_on) + ' · 현장 확인 날짜를 정해 주세요';
  }

  function loadAll() {
    return Promise.all([K.soft(DB.listCustomers), K.soft(DB.listEstimates), K.soft(DB.listContracts), K.soft(DB.listDefects), K.soft(DB.listInquiries), K.soft(DB.listSchedules)])
      .then(function (r) { return { customers: r[0], estimates: r[1], contracts: r[2], defects: r[3], inquiries: r[4], schedules: r[5] }; });
  }
  function byCustomer(D) {
    var o = {};
    D.customers.forEach(function (c) { o[c.id] = { est: [], ctr: [], def: [], sch: [] }; });
    D.estimates.forEach(function (e) { if (e.customer_id && o[e.customer_id]) o[e.customer_id].est.push(e); });
    D.contracts.forEach(function (k) { if (k.customer_id && o[k.customer_id]) o[k.customer_id].ctr.push(k); });
    D.defects.forEach(function (d) { if (o[d.customer_id]) o[d.customer_id].def.push(d); });
    D.schedules.forEach(function (s) { if (s.customer_id && o[s.customer_id]) o[s.customer_id].sch.push(s); });
    return o;
  }
  // 고객 상태: 공사 중(오늘이 계약서 공사 기간 또는 '공사' 일정 안) · 하자 처리 중 · 계약 완료 · 견적 완료(견적만 있고 계약 전)
  function statusOf(r, today) {
    r = r || { est: [], ctr: [], def: [], sch: [] };
    var work = r.ctr.filter(function (k) { return k.start_date && k.status !== 'done' && k.status !== 'canceled' && k.status !== 'terminated' && k.start_date <= today && today <= (k.end_date || k.start_date); })[0];
    var wsch = work ? null : r.sch.filter(function (s) { return s.kind === 'work' && s.start_on <= today && today <= (s.end_on || s.start_on); })[0];
    var contracted = r.ctr.some(function (k) { return k.status === 'signed' || k.status === 'done'; });
    var estAt = r.est.reduce(function (a, e) { var t = String(e.created_at || e.updated_at || ''); return t > a ? t : a; }, '');
    return {
      working: !!(work || wsch),
      workTo: work ? (work.end_date || work.start_date) : wsch ? (wsch.end_on || wsch.start_on) : '',
      defects: r.def.filter(function (d) { return d.status !== 'done'; }).length,
      contracted: contracted,
      // 견적 완료: 계약 전이고, 중단하지 않은 견적서가 있음
      estimated: !contracted && r.est.some(function (e) { return !window.EstimateKit || window.EstimateKit.stageOf(e, r.ctr) === 'open'; }),
      estAt: estAt,
    };
  }
  // 필터: [키, 이름, 설명]
  var FILTERS = [
    ['all', '전체', ''],
    ['work', '공사 중', '오늘이 공사 기간(계약서의 착공일~준공일, 또는 일정 달력의 공사일정)인 고객이에요.'],
    ['defect', '하자 처리 중', '완료하지 않은 하자 접수가 있는 고객이에요.'],
    ['contract', '계약 완료', '계약 완료·공사 완료인 계약서가 있는 고객이에요.'],
    ['estimate', '견적 완료', '견적서만 있고 아직 계약하지 않은 고객이에요. (견적 중단한 건 빼고)'],
  ];
  function inFilter(f, st) {
    return f === 'work' ? st.working : f === 'defect' ? st.defects > 0 : f === 'contract' ? st.contracted : f === 'estimate' ? st.estimated : true;
  }
  // 정렬: 공사 중 → 하자 처리 중 → 나머지는 최근 견적서 순 (견적서 없는 고객은 맨 뒤, 최근에 고친 순)
  function rank(st) { return st.working ? 0 : st.defects ? 1 : 2; }
  function sortCustomers(list, stOf) {
    return list.slice().sort(function (a, b) {
      var x = stOf[a.id], y = stOf[b.id];
      return rank(x) - rank(y) || (!x.estAt) - (!y.estAt) || y.estAt.localeCompare(x.estAt) || String(b.updated_at || '').localeCompare(String(a.updated_at || ''));
    });
  }

  /* ---------- 찾기: 이름·전화번호·아파트 이름·지역 (띄어 쓴 낱말은 모두 들어간 고객만) ---------- */
  function norm(s) { return String(s || '').toLowerCase().replace(/\s+/g, ''); }
  function searchTokens(q) { return String(q || '').trim().split(/\s+/).filter(Boolean).map(norm); }
  function inqHay(x) { return [x.name, x.region, x.site_name, x.size, x.space_type].join(' '); }
  function matches(toks, phone, text) {
    var t = norm(text), pd = K.digits(phone);
    return toks.every(function (k) {
      var kd = K.digits(k);
      if (/^[0-9-]+$/.test(k)) return (kd.length >= 3 && pd.indexOf(kd) >= 0) || t.indexOf(k) >= 0;   // 숫자만: 전화번호(3자리 이상) 또는 '101동' 같은 주소
      return t.indexOf(k) >= 0;
    });
  }

  /* =====================================================================
     고객 목록 + 검색
     ===================================================================== */
  function viewCustomers() {
    K.frame('고객 관리', false, 'customers');
    app.innerHTML = '<div class="page"><div class="loading">불러오는 중…</div></div>';
    loadAll().then(function (D) {
      var rel = byCustomer(D), today = K.today(), stOf = {}, hay = {};
      // 찾기용 글자: 이름·주소·메모 + 견적서·계약서 제목(현장 이름) + 같은 번호의 상담 신청(지역·현장)
      var inqByPhone = {};
      D.inquiries.forEach(function (x) { var d = K.digits(x.phone); if (d) (inqByPhone[d] = inqByPhone[d] || []).push(x); });
      D.customers.forEach(function (c) {
        var r = rel[c.id];
        stOf[c.id] = statusOf(r, today);
        hay[c.id] = [c.name, c.address, c.memo, c.blacklist ? '블랙리스트 ' + (c.blacklist_note || '') : ''].concat(r.est.map(function (e) { return e.title; }), r.ctr.map(function (k) { return k.title; }),
          (inqByPhone[K.digits(c.phone)] || []).map(inqHay)).join(' ');
      });
      // 고객 한 명의 찾기용 정보: 지역(주소 → 상담 신청 지역 → 견적서 지역), 날짜(견적일·계약일), 상태(여러 개)
      function rec(c) {
        var r = rel[c.id], st = stOf[c.id];
        var reg = K.regionOf(c.address) || ((inqByPhone[K.digits(c.phone)] || []).map(function (q) { return K.regionOf(q.region); }).filter(Boolean)[0]) ||
          r.est.map(function (e) { return K.regionOf(e.region); }).filter(Boolean)[0] || r.ctr.map(function (k) { return K.regionOf(k.site); }).filter(Boolean)[0] || '';
        var dates = r.est.map(function (e) { return e.estimate_date || K.ymd(new Date(e.created_at)); }).concat(r.ctr.map(function (k) { return k.contract_date || K.ymd(new Date(k.created_at)); }));
        var stt = []; if (st.working) stt.push('work'); if (st.defects) stt.push('defect'); if (st.contracted) stt.push('contract'); if (st.estimated) stt.push('estimate');
        return { text: hay[c.id], phone: c.phone, region: reg, dates: dates, status: stt };
      }
      var page = document.createElement('div');
      page.className = 'page cust-page';
      page.innerHTML =
        '<div class="cust-top"><div class="cust-btns"><a class="btn btn-primary" href="#/customer/new">' + I.plus + '고객 추가</a>' +
        '<button class="btn btn-outline" type="button" data-xlsx>' + I.down + '전체 엑셀로 받기</button></div></div>' +
        '<div class="sec-head sh-1"><div class="sec-title"><h2>고객</h2></div></div>' +
        (D.customers.length ? K.filterHtml('custF', { ph: '이름·전화번호·아파트', dateLabel: '견적·계약', regions: D.customers.map(function (c) { return rec(c).region; }),
          statuses: FILTERS.filter(function (f) { return f[0] !== 'all'; }).map(function (f) { return [f[0], f[1], D.customers.filter(function (c) { return inFilter(f[0], stOf[c.id]); }).length]; }) }) : '') +
        K.listTools('cust-n', D.customers.length ? 'cust' : '') + '<div id="cust-list"></div>' +
        '<p class="hint inq-keep">견적서·계약서를 저장하면 전화번호로 고객이 저절로 만들어지고 연결돼요. 순서: 공사 중 → 하자 처리 중 → 최근 견적 순.</p>';
      app.innerHTML = ''; app.appendChild(page);

      function draw() {
        var finding = K.filterActive('custF'), toks = K.findTokens((K.state.custF || {}).q);
        var list = sortCustomers(D.customers.filter(function (c) { return K.filterMatch('custF', rec(c)); }), stOf);
        // 고객으로 아직 없는 상담 신청 (찾기 칸에 글자를 넣었을 때)
        var known = {}; D.customers.forEach(function (c) { known[K.digits(c.phone)] = true; });
        var inqs = toks.length ? D.inquiries.filter(function (x) { return !known[K.digits(x.phone)] && matches(toks, x.phone, inqHay(x)); }) : [];
        $('#cust-n', page).innerHTML = K.listCount(D.customers.length, list.length, finding, '명');
        var table = K.viewMode('cust') === 'table';
        var html = list.length ? (table ? K.dataTable('cust', [
          { label: '이름', sort: function (c) { return c.name || ''; }, html: function (c) { return '<b>' + esc(c.name || '이름 없음') + '</b>'; }, cls: 'stick' },
          { label: '연락처', html: function (c) { return esc(c.phone || ''); } },
          { label: '상태', sort: function (c) { return rank(stOf[c.id]); }, html: function (c) { return stPills(stOf[c.id]); } },
          { label: '지역', sort: function (c) { return rec(c).region; }, html: function (c) { return esc(rec(c).region); } },
          { label: '주소', sort: function (c) { return c.address || ''; }, html: function (c) { return esc(c.address || ''); }, cls: 'wide' },
          { label: '견적', sort: function (c) { return rel[c.id].est.length; }, html: function (c) { return String(rel[c.id].est.length); }, cls: 'n' },
          { label: '계약', sort: function (c) { return rel[c.id].ctr.length; }, html: function (c) { return String(rel[c.id].ctr.length); }, cls: 'n' },
          { label: '최근 견적', sort: function (c) { return stOf[c.id].estAt || ''; }, html: function (c) { return stOf[c.id].estAt ? esc(K.fmtDate(stOf[c.id].estAt)) : ''; } },
        ], list, function (c) { return '#/customer/' + encodeURIComponent(c.id); }, function (c) { return c.id; })
          : '<div class="items cust-items">' + list.map(function (c) { return custCard(c, rel[c.id], stOf[c.id]); }).join('') + '</div>')
          : '<div class="empty-box">' + (!D.customers.length ? '아직 고객이 없어요.<br>견적서나 계약서를 만들면 저절로 생겨요.' : '조건에 맞는 고객이 없어요.<br>위 <b>조건 모두 지우기</b>를 누르면 전체가 보여요.') + '</div>';
        if (inqs.length) {
          html += '<div class="sec-head"><div class="sec-title"><h2>상담 신청에서 찾았어요</h2><p>아직 고객으로 등록되지 않은 분이에요</p></div></div><div class="items">' +
            inqs.map(function (x) {
              return '<div class="item"><div class="cust-name">' + esc(x.name) + '<span>' + esc(x.phone) + '</span></div>' +
                '<p class="cust-sub">' + esc(K.fmtDate(x.created_at)) + ' 상담 신청 · ' + esc([x.region, x.site_name, (x.scopes || []).join(', ')].filter(Boolean).join(' · ')) + '</p>' +
                '<div class="item-actions two"><a class="btn btn-outline" href="#/customer/new/q/' + encodeURIComponent(x.id) + '">고객으로 등록</a>' +
                '<a class="btn btn-outline" href="#/estimate/new/q/' + encodeURIComponent(x.id) + '">견적서 만들기</a></div></div>';
            }).join('') + '</div>';
        }
        $('#cust-list', page).innerHTML = html;
        if (bk) bk.refresh();
      }
      var bk = D.customers.length ? K.bulk({ page: page, host: $('.lt-btns', page), noun: '고객', warn: '고객의 <b>하자 기록</b>도 같이 휴지통으로 가요. 견적서·계약서는 남고 연결만 끊겨요(되살리면 다시 이어져요).',
        del: function (id) { return DB.deleteCustomer(id); }, after: viewCustomers }) : null;
      if (D.customers.length) K.filterBind(page, 'custF', draw);
      K.dataTableBind(page, draw);
      draw();
      page.addEventListener('click', function (e) {
        var x = e.target.closest('[data-xlsx]');
        if (x) exportExcel(D, x);
        var cp = e.target.closest('[data-copy]');
        if (cp) K.copyFlash(cp, cp.getAttribute('data-copy'), '전화번호');
      });
    }).catch(function (err) { errPage(err, '#/'); });
  }
  function stPills(st) {
    return [st.working ? '<span class="pill work">공사 중</span>' : '', st.defects ? '<span class="pill warn">하자 처리 중</span>' : '',
      st.contracted ? '<span class="pill c-signed">계약</span>' : st.estimated ? '<span class="pill e-open">견적</span>' : ''].join('');
  }
  function custCard(c, r, st) {
    r = r || { est: [], ctr: [], def: [], sch: [] };
    st = st || statusOf(r, K.today());
    var open = r.def.filter(function (d) { return d.status !== 'done'; });
    var docs = r.ctr.map(function (k) { return { t: k.updated_at, html: '<a href="#/contract/' + encodeURIComponent(k.id) + '"><span class="doc-k ctr">계약서</span><span class="doc-t">' + esc(K.ctrTitle(k)) + '</span><span class="doc-m">' + K.won(k.total) + '원 · ' + esc(STATUS[k.status] || '') + '</span></a>' }; })
      .concat(r.est.map(function (e) { return { t: e.updated_at, html: '<a href="#/estimate/' + encodeURIComponent(e.id) + '"><span class="doc-k est">견적서</span><span class="doc-t">' + esc(K.estTitle(e)) + '</span><span class="doc-m">' + K.won(e.total) + '원 · ' + esc(K.fmtDate(e.updated_at)) + '</span></a>' }; }))
      .sort(function (a, b) { return String(b.t).localeCompare(String(a.t)); });
    return '<div class="item cust-item">' + '<label class="bulk-pick"><input type="checkbox" data-bid="' + esc(c.id) + '" aria-label="' + esc(c.name || '고객') + ' 고르기"></label>' +
      '<a class="cust-open" href="#/customer/' + encodeURIComponent(c.id) + '"><div class="cust-name">' + esc(c.name || '이름 없음') + '<span>' + esc(c.phone || '') + '</span></div>' +
      (c.address ? '<p class="cust-sub">' + esc(c.address) + '</p>' : '') +
      '<div class="item-meta">' + (c.blacklist ? '<span class="pill bl">블랙리스트</span>' : '') + (st.working ? '<span class="pill work">공사 중' + (st.workTo ? ' · ' + esc(K.sDate(st.workTo)) + '까지' : '') + '</span>' : '') +
      (open.length ? '<span class="pill warn">하자 처리 중</span>' : '') +
      '<span>견적서 ' + r.est.length + '</span><span>계약서 ' + r.ctr.length + '</span>' +
      (!open.length && r.def.length ? '<span>하자 기록 ' + r.def.length + '</span>' : '') + '</div></a>' +
      (docs.length ? '<div class="cust-docs">' + docs.slice(0, 3).map(function (d) { return d.html; }).join('') + (docs.length > 3 ? '<a class="more" href="#/customer/' + encodeURIComponent(c.id) + '">' + (docs.length - 3) + '건 더 보기</a>' : '') + '</div>' : '') +
      '</div>';
  }

  /* ---------- 고객 전체 엑셀 ---------- */
  function exportExcel(D, btn) {
    K.ask({ title: '고객 전체를 엑셀로 받을까요?', text: '받은 파일에는 <b>고객 이름·연락처·주소</b>가 들어 있어요.<br>다른 사람에게 보내지 말고, 다 쓰면 지워 주세요.', cancel: '그만두기', ok: '받기' }).then(function (ok) {
      if (!ok) return;
      btn.disabled = true;
      window.EstimateKit.loadExport().then(function (X) {
        var L = X.lib, S = L.S, rel = byCustomer(D), cust = {};
        D.customers.forEach(function (c) { cust[c.id] = c; });
        function sheet(title, head, rows, widths) {
          var sh = new L.Sheet(), r = 1;
          sh.merge(r, 0, head.length - 1, title + '  (' + K.kDate(K.today()) + ' 기준)', S.h2); sh.height(r, 24); r++;
          head.forEach(function (h, i) { sh.put(r, i, h, S.head); }); sh.height(r, 22);
          var headRow = r; r++;
          rows.forEach(function (row) {
            row.forEach(function (v, i) { sh.put(r, i, v, typeof v === 'number' ? S.num : S.text); });
            var lines = Math.max.apply(null, row.map(function (v, i) { return typeof v === 'string' ? L.rowsFor(v, Math.max(4, Math.floor(widths[i] / 1.7))) : 1; }));
            if (lines > 1) sh.height(r, Math.min(15 * lines + 6, 160));
            r++;
          });
          if (!rows.length) { sh.merge(r, 0, head.length - 1, '없음', S.center); }
          return { xml: sh.xml({ widths: widths, freeze: headRow, footer: '&L' + (C.name || '') + '&C&P / &N&R개인정보 — 외부 유출 금지', tab: false }), headRow: headRow };
        }
        var custRows = D.customers.slice().sort(function (a, b) { return String(a.name).localeCompare(String(b.name), 'ko'); }).map(function (c) {
          var r = rel[c.id], last = r.ctr.slice().sort(function (a, b) { return String(b.start_date || '').localeCompare(String(a.start_date || '')); })[0];
          return [c.name || '', c.phone || '', c.address || '', r.est.length, r.ctr.length,
            r.ctr.reduce(function (a, k) { return a + (Number(k.total) || 0); }, 0),
            last && last.start_date ? K.kDate(last.start_date) + (last.end_date ? ' ~ ' + K.kDate(last.end_date) : '') : '',
            r.def.filter(function (d) { return d.status !== 'done'; }).length, c.memo || '', c.blacklist ? '블랙리스트' + (c.blacklist_note ? ' · ' + c.blacklist_note : '') : '', K.fmtDate(c.created_at), K.fmtDate(c.updated_at)];
        });
        var s1 = sheet('고객 목록', ['이름', '연락처', '주소', '견적서', '계약서', '계약 금액 합계', '최근 공사 기간', '처리 중 하자', '메모', '블랙리스트', '등록일', '고친 날'], custRows,
          [12, 15, 30, 7, 7, 14, 26, 9, 30, 20, 11, 11]);
        var s2 = sheet('계약서', ['고객', '연락처', '공사명', '착공일', '준공일', '계약 금액', '상태', '파기·위약금', '고친 날'], D.contracts.map(function (k) {
          var c = cust[k.customer_id] || {};
          return [k.customer_name || c.name || '', c.phone || '', k.title || '', k.start_date ? K.kDate(k.start_date) : '', k.end_date ? K.kDate(k.end_date) : '',
            Number(k.total) || 0, STATUS[k.status] || '', k.status === 'terminated' && window.ContractKit ? window.ContractKit.termSummary(k.termination) : '', K.fmtDate(k.updated_at)];
        }), [12, 15, 34, 15, 15, 14, 10, 26, 11]);
        var s3 = sheet('하자 기록', ['고객', '연락처', '접수일', '하자 내용', '자세한 내용', '현장 확인', '확인 결과', '하자 보수 기간', '보수 내용', '완료일', '상태'], D.defects.map(function (d) {
          var c = cust[d.customer_id] || {};
          return [c.name || '', c.phone || '', K.kDate(d.received_on), d.title || '', d.body || '',
            d.check_on ? K.kDate(d.check_on) + (d.check_time ? ' ' + d.check_time : '') : '', d.check_note || '',
            d.repair_on ? K.kDate(d.repair_on) + (d.repair_end && d.repair_end > d.repair_on ? ' ~ ' + K.kDate(d.repair_end) : '') + (d.repair_time ? ' ' + d.repair_time : '') : '', d.repair_note || '',
            d.done_on ? K.kDate(d.done_on) : '', stepLabel(defectStatus(d))];
        }), [12, 15, 14, 22, 30, 18, 26, 30, 26, 14, 9]);
        s1.xml = s1.xml.replace('<sheetView workbookViewId="0" showGridLines="0">', '<sheetView workbookViewId="0" showGridLines="0" tabSelected="1">');
        var bytes = L.xlsxPackage([{ name: '고객 목록', xml: s1.xml }, { name: '계약서', xml: s2.xml }, { name: '하자 기록', xml: s3.xml }], {
          title: '고객 목록', creator: C.name || '',
          printTitles: [{ sheet: 0, row: s1.headRow }, { sheet: 1, row: s2.headRow }, { sheet: 2, row: s3.headRow }],
        });
        var name = 'customers-' + K.today().replace(/-/g, '') + '.xlsx';
        K.saveBlob(new Blob([bytes], { type: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet' }), name);
        K.toast(name + ' 파일을 받았어요 · 고객 ' + D.customers.length + '명');
      }).catch(function (err) { fail('파일을 만들지 못했어요', err); }).then(function () { btn.disabled = false; });
    });
  }

  /* =====================================================================
     고객 한 명
     ===================================================================== */
  function viewCustomer(id) {
    K.frame('고객', true, 'customers');
    K.state.backTo = '#/customers';
    app.innerHTML = '<div class="page"><div class="loading">불러오는 중…</div></div>';
    loadAll().then(function (D) {
      var c = D.customers.filter(function (x) { return x.id === id; })[0];
      if (!c) throw new Error('고객을 찾을 수 없어요. 이미 지웠을 수 있어요.');
      var r = byCustomer(D)[c.id], dg = K.digits(c.phone), st = statusOf(r, K.today());
      var inqs = dg ? D.inquiries.filter(function (q) { return K.digits(q.phone) === dg; }) : [];
      K.titleEl.textContent = (c.name || '고객') + ' 고객님';
      var defs = r.def.slice().sort(function (a, b) { return (a.status === 'done') - (b.status === 'done') || String(b.received_on).localeCompare(String(a.received_on)); });
      var schs = r.sch.slice().sort(function (a, b) { return String(b.start_on).localeCompare(String(a.start_on)); });
      var page = document.createElement('div');
      page.className = 'page cust-detail';
      page.innerHTML =
        '<div class="cust-card' + (c.blacklist ? ' is-bl' : '') + '">' +
        (c.blacklist ? '<div class="bl-banner">' + I.ban + '<span><b>블랙리스트</b>' + (c.blacklist_note ? '<small>' + esc(c.blacklist_note) + '</small>' : '') +
          (c.blacklist_at ? '<em>' + esc(K.fmtDate(c.blacklist_at)) + ' 등록</em>' : '') + '</span><button type="button" class="btn btn-outline btn-sm" data-blset>고치기·해제</button></div>' : '') +
        '<div class="cust-name big">' + esc(c.name || '이름 없음') + '<span>' + esc(c.phone || '연락처 없음') + '</span></div>' +
        (st.working || st.defects ? '<div class="item-meta cust-st">' + (st.working ? '<span class="pill work">공사 중' + (st.workTo ? ' · ' + esc(K.sDate(st.workTo)) + '까지' : '') + '</span>' : '') +
          (st.defects ? '<span class="pill warn">하자 처리 중</span>' : '') + '</div>' : '') +
        (c.address ? '<p class="cust-sub">' + esc(c.address) + '</p>' : '') +
        '<div class="cust-call">' + (c.phone ? '<a class="btn btn-primary only-phone" href="' + K.telHref(c.phone) + '">' + I.phone + '전화 걸기</a>' +
          '<button class="btn btn-primary only-pc" type="button" data-copy="' + esc(c.phone) + '">' + I.copy + '번호 복사</button>' : '') +
        '<a class="btn btn-outline" href="#/customer/' + encodeURIComponent(c.id) + '/edit">' + I.pen + '정보 고치기</a></div></div>' +
        '<div class="cust-acts">' +
        '<a class="work-tile" href="#/estimate/new/c/' + encodeURIComponent(c.id) + '">' + I.doc + '<b>견적서 만들기</b></a>' +
        '<a class="work-tile" href="#/contract/new/c/' + encodeURIComponent(c.id) + '">' + I.sign + '<b>계약서 만들기</b></a>' +
        '<a class="work-tile" href="#/defect/new/' + encodeURIComponent(c.id) + '">' + I.wrench + '<b>하자 접수</b></a>' +
        '<button class="work-tile" type="button" data-sch>' + I.cal + '<b>일정 추가</b></button></div>' +
        // 고객 메모: 여기서 바로 적고, 고친 게 있을 때만 저장 단추
        '<section class="cust-sec cust-memo-sec"><h2><label for="cm-memo">메모</label></h2><div class="memo-card">' +
        '<textarea class="textarea" id="cm-memo" rows="3" maxlength="2000" placeholder="예) 낮에는 문자 먼저 · 주차는 지하 2층 · 잔금은 공사 끝나고 바로">' + esc(c.memo || '') + '</textarea>' +
        '<div class="memo-bar" id="cm-bar" hidden><span class="memo-st">저장 안 한 메모가 있어요</span><button type="button" class="btn btn-outline btn-sm" data-memoundo>되돌리기</button><button type="button" class="btn btn-primary btn-sm" data-memosave>메모 저장</button></div>' +
        '<p class="hint">관리자 화면에서만 보여요. 건강·가족 사정 같은 민감한 내용은 적지 않아요.</p></div></section>' +
        sec('하자 접수·보수', defs.length, defs.map(function (d) {
          return '<a class="cust-row" href="#/defect/' + encodeURIComponent(d.id) + '"><span class="pill d-' + esc(defectStatus(d)) + '">' + esc(stepLabel(defectStatus(d))) + '</span>' +
            '<span class="t"><b>' + esc(d.title) + '</b><small>' + esc(defectNext(d)) + ((d.photos || []).length ? ' · 사진 ' + d.photos.length + '장' : '') + '</small></span><span class="go">' + I.right + '</span></a>';
        }), '하자 신청이 들어오면 위의 <b>하자 접수</b>를 눌러 적어 두세요.') +
        sec('계약서', r.ctr.length, r.ctr.map(function (k) {
          return '<a class="cust-row" href="#/contract/' + encodeURIComponent(k.id) + '"><span class="pill c-' + esc(k.status) + '">' + esc(STATUS[k.status] || '') + '</span>' +
            '<span class="t"><b>' + esc(K.ctrTitle(k)) + '</b><small>' + K.won(k.total) + '원' + (k.start_date ? ' · ' + esc(K.sDate(k.start_date)) + (k.end_date ? ' ~ ' + esc(K.sDate(k.end_date)) : '') : '') + '</small></span><span class="go">' + I.right + '</span></a>';
        }), '아직 계약서가 없어요.') +
        sec('견적서', r.est.length, r.est.map(function (e) {
          return '<a class="cust-row" href="#/estimate/' + encodeURIComponent(e.id) + '"><span class="pill off">견적</span>' +
            '<span class="t"><b>' + esc(K.estTitle(e)) + '</b><small>' + K.won(e.total) + '원 · ' + esc(K.fmtDate(e.updated_at)) + ' 고침</small></span><span class="go">' + I.right + '</span></a>';
        }), '아직 견적서가 없어요.') +
        (inqs.length ? sec('상담 신청', inqs.length, inqs.map(function (q) {
          return '<a class="cust-row" href="#/inquiries"><span class="pill ' + (q.status === 'done' ? 'off">상담 완료' : q.status === 'dropped' ? 'drop">상담 포기' : 'new">새 상담') + '</span>' +
            '<span class="t"><b>' + esc(K.fmtDate(q.created_at)) + ' · ' + esc([q.site_name, q.size].filter(Boolean).join(' ') || q.region || '상담') + '</b><small>' + esc((q.scopes || []).join(', ') || q.message || '') + '</small></span><span class="go">' + I.right + '</span></a>';
        })) : '') +
        (schs.length ? sec('일정', schs.length, schs.map(function (s) {
          return '<a class="cust-row" href="#/calendar/' + esc(String(s.start_on)) + '/s/' + encodeURIComponent(s.id) + '"><span class="pill off">' + esc(K.sDate(s.start_on)) + '</span>' +
            '<span class="t"><b>' + esc(s.title) + '</b><small>' + esc([s.time, s.place].filter(Boolean).join(' · ')) + '</small></span><span class="go">' + I.right + '</span></a>';
        })) : '') +
        '<div class="cust-foot">' + (c.blacklist ? '' : '<button class="btn btn-text-danger cust-bl" type="button" data-blset>' + I.ban + '블랙리스트 등록</button>') +
        '<button class="btn btn-text-danger cust-del" type="button" data-cdel>이 고객 지우기</button></div>';
      app.innerHTML = ''; app.appendChild(page);
      var memo0 = c.memo || '', memoEl = $('#cm-memo', page), memoBar = $('#cm-bar', page);
      memoEl.addEventListener('input', function () { var ch = memoEl.value !== memo0; memoBar.hidden = !ch; K.setDirty(ch); });
      function saveMemo(btn) {
        btn.disabled = true;
        DB.saveCustomer({ id: c.id, name: c.name, phone: c.phone, address: c.address || '', memo: memoEl.value }).then(function (saved) {
          memo0 = c.memo = saved.memo; memoBar.hidden = true; K.setDirty(false); btn.disabled = false;
        }).catch(function (err) { btn.disabled = false; fail('메모를 저장하지 못했어요', err); });
      }
      page.addEventListener('click', function (e) {
        var x;
        if ((x = e.target.closest('[data-memosave]'))) return saveMemo(x);
        if (e.target.closest('[data-memoundo]')) { memoEl.value = memo0; memoBar.hidden = true; K.setDirty(false); return; }
        if (e.target.closest('[data-blset]')) return openBlacklist(c, function () { K.blacklistReset(); K.state.counts = null; viewCustomer(id); });
        if ((x = e.target.closest('[data-copy]'))) return K.copyFlash(x, x.getAttribute('data-copy'), '전화번호');
        if (e.target.closest('[data-sch]')) {
          if (!window.CalendarKit) return;
          return window.CalendarKit.openForm(null, K.today(), D, function (day) { K.toast('일정 달력에서도 볼 수 있어요'); viewCustomer(id); },
            { customer_id: c.id, title: (c.name || '') + ' 고객님 ', place: c.address || '' });
        }
        if (e.target.closest('[data-cdel]')) {
          K.ask({ title: (c.name || '이 고객') + ' 고객님을 지울까요?', okClass: 'btn-danger', cancel: '그만두기', ok: '지우기',
            text: '고객 정보와 <b>하자 기록 ' + r.def.length + '건</b>이 함께 휴지통으로 옮겨져요(30일 안에 되살리면 같이 돌아와요).<br>견적서·계약서는 지워지지 않고 고객 연결만 끊겨요.' }).then(function (ok) {
            if (!ok) return;
            DB.deleteCustomer(c.id).then(function () { K.toast('휴지통으로 옮겼어요'); K.state.counts = null; K.leave('#/customers'); }).catch(function (err) { fail('지우지 못했어요', err); });
          });
        }
      });
    }).catch(function (err) { errPage(err); });
  }
  /* 블랙리스트 등록·고치기·해제 창 (사유는 관리자 화면에만 보임) */
  function openBlacklist(c, done) {
    var on = !!c.blacklist;
    var ov = document.createElement('div');
    ov.className = 'overlay';
    ov.innerHTML = '<form class="sheet form-sheet bl-sheet" role="dialog" aria-modal="true" aria-labelledby="bl-t" novalidate>' +
      '<h3 id="bl-t">' + (on ? '블랙리스트 고치기' : '블랙리스트로 등록할까요?') + '</h3>' +
      '<p class="bl-who"><b>' + esc(c.name || '이름 없음') + '</b> · ' + esc(c.phone || '') + '</p>' +
      '<p class="hint">등록하면 <b>같은 연락처</b>로 상담 신청이 들어오거나 견적서·계약서를 만들 때 경고가 떠요.</p>' +
      '<div class="field"><label for="bl-note">사유 <span class="opt">(선택)</span></label><textarea class="textarea" id="bl-note" rows="3" maxlength="500" placeholder="예) 잔금 미지급, 무리한 추가 공사 요구">' + esc(c.blacklist_note || '') + '</textarea>' +
      '<p class="hint">관리자 화면에서만 보여요. 있었던 일만 짧게 적어 주세요.</p></div>' +
      '<p class="msg error-msg" id="bl-msg" hidden></p>' +
      '<div class="btn-row"><button class="btn btn-outline" type="button" data-close>취소</button><button class="btn btn-danger" type="submit">' + (on ? '사유 저장' : '블랙리스트 등록') + '</button></div>' +
      (on ? '<button class="btn btn-text-danger bl-off" type="button" data-bloff>블랙리스트 해제</button>' : '') + '</form>';
    document.body.appendChild(ov);
    function close() { ov.remove(); }
    function put(flag) {
      var btns = $$('button', ov); btns.forEach(function (b) { b.disabled = true; });
      DB.setBlacklist(c.id, flag, $('#bl-note', ov).value).then(function () { close(); done(); })
        .catch(function (err) { btns.forEach(function (b) { b.disabled = false; }); var m = $('#bl-msg', ov); m.textContent = K.friendlyError(err); m.hidden = false; });
    }
    ov.addEventListener('click', function (e) {
      if (e.target === ov || e.target.closest('[data-close]')) return close();
      if (e.target.closest('[data-bloff]')) return put(false);
    });
    ov.addEventListener('keydown', function (e) { if (e.key === 'Escape') close(); });
    $('form', ov).addEventListener('submit', function (e) { e.preventDefault(); put(true); });
    if (window.matchMedia && matchMedia('(hover: hover) and (pointer: fine)').matches) setTimeout(function () { $('#bl-note', ov).focus(); }, 60);
  }
  function sec(title, n, rows, empty) {
    return '<section class="cust-sec"><h2>' + esc(title) + ' <small>' + n + '</small></h2>' +
      (rows.length ? '<div class="cust-rows">' + rows.join('') + '</div>' : '<p class="hint">' + (empty || '') + '</p>') + '</section>';
  }

  /* ---------- 고객 추가·고치기 ---------- */
  function viewCustomerForm(id, fromInq) {
    K.frame(id ? '고객 정보 고치기' : '고객 추가', true, 'customers');
    K.state.backTo = id ? '#/customer/' + encodeURIComponent(id) : '#/customers';
    app.innerHTML = '<div class="page"><div class="loading">불러오는 중…</div></div>';
    var load = id ? DB.getCustomer(id) : fromInq ? DB.listInquiries().then(function (qs) {
      var q = qs.filter(function (x) { return x.id === fromInq; })[0];
      return q ? { name: q.name, phone: q.phone, address: [q.region, q.site_name].filter(Boolean).join(' '), memo: q.message ? '상담 신청 메모: ' + q.message : '' } : {};
    }) : Promise.resolve({});
    load.then(function (c) {
      if (id && !c) throw new Error('고객을 찾을 수 없어요.');
      c = c || {};
      var page = document.createElement('form');
      page.className = 'page cust-form';
      page.noValidate = true;
      page.innerHTML = '<div class="txt-card">' +
        '<div class="field"><label for="c-name">이름 <span class="req">*</span></label><input class="input" id="c-name" maxlength="30" value="' + esc(c.name || '') + '" placeholder="예) 김○○"></div>' +
        '<div class="field"><label for="c-phone">연락처 <span class="req">*</span></label><input class="input" id="c-phone" type="tel" maxlength="20" autocomplete="off" value="' + esc(c.phone || '') + '" placeholder="010-0000-0000"><p class="hint">같은 번호로는 한 명만 등록돼요. 견적서·계약서도 이 번호로 연결돼요.</p></div>' +
        '<div class="field"><label for="c-addr-sido">주소 <span class="opt">(선택)</span></label>' + K.regionPick('c-addr', c.address || '', { detail: { ph: '동네 · 아파트 이름 (예: ○○동 ○○아파트)', label: '주소 동네 · 아파트 이름', max: 100 }, unit: { ph: '동·호수 (예: 101동 1001호)', label: '상세 주소 (동·호수)' } }) + '</div>' +
        '<div class="field"><label for="c-memo">메모 <span class="opt">(선택)</span></label><textarea class="textarea" id="c-memo" rows="4" maxlength="2000" placeholder="예) 낮에는 문자 먼저">' + esc(c.memo || '') + '</textarea><p class="hint">건강·가족 사정 같은 민감한 내용은 적지 마세요.</p></div>' +
        '</div>' +
        '<div class="savebar"><p class="msg" id="c-msg" hidden></p><button class="btn btn-primary" type="submit">' + I.check + '저장</button></div>';
      app.innerHTML = ''; app.appendChild(page);
      page.addEventListener('input', function () { K.setDirty(true); $('#c-msg', page).hidden = true; });
      page.addEventListener('submit', function (e) {
        e.preventDefault();
        var msg = $('#c-msg', page);
        var row = { id: id || undefined, name: $('#c-name', page).value.trim(), phone: $('#c-phone', page).value.trim(), address: $('#c-addr', page).value.trim(), memo: $('#c-memo', page).value };
        function bad(t, el) { msg.textContent = t; msg.hidden = false; el.focus(); }
        if (!row.name) return bad('이름을 적어 주세요.', $('#c-name', page));
        var d = K.digits(row.phone);
        if (d.length < 9 || d.length > 11) return bad('연락처를 다시 확인해 주세요.', $('#c-phone', page));
        var btn = $('button[type=submit]', page); btn.disabled = true;
        DB.saveCustomer(row).then(function (saved) {
          K.setDirty(false); K.toast('저장했어요');
          K.leave('#/customer/' + encodeURIComponent(saved.id));
        }).catch(function (err) { btn.disabled = false; msg.textContent = dupMsg(err); msg.hidden = false; });
      });
      setTimeout(function () { var f = $('#c-name', page); if (f && !f.value) f.focus(); }, 60);
    }).catch(function (err) { errPage(err); });
  }

  /* =====================================================================
     하자 접수 → 현장 확인 → 하자 보수 → 완료
     ===================================================================== */
  function viewDefect(args) {
    var isNew = args[0] === 'new', custId = isNew ? decodeURIComponent(args[1] || '') : null, defId = isNew ? null : decodeURIComponent(args[0] || '');
    K.frame(isNew ? '하자 접수' : '하자 기록', true, 'customers');
    app.innerHTML = '<div class="page"><div class="loading">불러오는 중…</div></div>';
    Promise.all([K.soft(DB.listDefects), K.soft(DB.listCustomers), K.soft(DB.listContracts)]).then(function (r) {
      var d = isNew ? { customer_id: custId, received_on: K.today(), title: '', body: '', status: 'new', check_on: null, check_time: '', check_note: '', repair_on: null, repair_end: null, repair_time: '', repair_note: '', done_on: null, contract_id: null }
        : r[0].filter(function (x) { return x.id === defId; })[0];
      if (!d) throw new Error('하자 기록을 찾을 수 없어요. 이미 지웠을 수 있어요.');
      var c = r[1].filter(function (x) { return x.id === d.customer_id; })[0];
      if (!c) throw new Error('고객을 찾을 수 없어요.');
      // 저장·지우기 뒤 돌아갈 곳: 들어온 화면(일정 달력·첫 화면 등)이 있으면 거기로, 없으면 고객 화면
      var from = K.prevHash ? K.prevHash() : null, home = '#/customer/' + encodeURIComponent(c.id);
      var back = from && !/^#\/defect\//.test(from) ? from : home;
      K.state.backTo = back;
      var ctrs = r[2].filter(function (k) { return k.customer_id === c.id; });
      if (isNew && !d.contract_id && ctrs.length) {   // 가장 최근 공사 계약서를 미리 골라 둠
        var latest = ctrs.slice().sort(function (a, b) { return String(b.end_date || b.start_date || '').localeCompare(String(a.end_date || a.start_date || '')); })[0];
        d.contract_id = latest.id;
      }
      function ctrOf(id) { return id ? ctrs.filter(function (k) { return k.id === id; })[0] || null : null; }
      function ctrLabel(id) { var k = ctrOf(id); return k ? K.ctrTitle(k) + (k.end_date ? ' (' + K.fmtDate(k.end_date) + (k.end_date > K.today() ? ' 완료 예정)' : ' 완료)') : '') : ''; }   // 준공일이 아직이면 '완료 예정'
      function setCtr(id) { K.finderSet(page, 'd-ctr', ctrOf(id) ? id : '', ctrLabel(id), '계약서 고르기 (고르지 않음)'); K.setDirty(true); drawWarranty(); drawSteps(); }
      var page = document.createElement('form');
      page.className = 'page defect-page';
      page.noValidate = true;
      function f(id, label, val, o) {
        o = o || {};
        return '<div class="field' + (o.cls ? ' ' + o.cls : '') + '"><label for="' + id + '">' + label + (o.opt ? ' <span class="opt">(선택)</span>' : '') + '</label>' +
          (o.area ? '<textarea class="textarea" id="' + id + '" rows="' + (o.rows || 3) + '" maxlength="3000" placeholder="' + esc(o.ph || '') + '">' + esc(val || '') + '</textarea>'
            : '<input class="input" id="' + id + '"' + (o.type ? ' type="' + o.type + '"' : '') + (o.time ? ' data-time data-ph="시간 고르기"' : '') + (o.minFrom ? ' data-min-from="' + o.minFrom + '"' : '') + (o.short ? ' data-short' : '') + ' maxlength="' + (o.max || 120) + '" value="' + esc(val || '') + '" placeholder="' + esc(o.ph || '') + '">') + '</div>';
      }
      page.innerHTML =
        '<div class="cust-card slim"><div class="cust-name">' + esc(c.name || '') + '<span>' + esc(c.phone || '') + '</span></div>' +
        (c.address ? '<p class="cust-sub">' + esc(c.address) + '</p>' : '') +
        (c.phone ? '<a class="btn btn-outline btn-sm only-phone" href="' + K.telHref(c.phone) + '">' + I.phone + '전화 걸기</a>' : '') + '</div>' +
        '<ol class="d-steps" id="d-steps"></ol>' +
        '<div class="warranty" id="warranty" hidden></div>' +
        '<h2 class="est-h">1. 접수</h2><div class="txt-card">' +
        f('d-recv', '접수일', d.received_on, { type: 'date', cls: 'd-date' }) +
        (ctrs.length ? '<div class="field"><span class="label" id="d-ctr-l">관련 계약서 <span class="opt">(선택)</span></span>' +   // 드롭다운 대신 고르기 창
          K.finderField('d-ctr', { ph: '계약서 고르기 (고르지 않음)', labelledby: 'd-ctr-l', clear: '관련 계약서 고르지 않기', value: ctrOf(d.contract_id) ? d.contract_id : '', label: ctrLabel(d.contract_id) }) + '</div>' : '') +
        f('d-title', '하자 내용 <span class="req">*</span>', d.title, { ph: '예) 욕실 타일 들뜸' }) +
        f('d-body', '자세한 내용', d.body, { area: true, opt: true, ph: '손님이 말씀하신 내용, 위치, 언제부터인지 등' }) + '</div>' +
        '<h2 class="est-h">사진 <span class="opt">(선택 · ' + MAX_DEFECT_PHOTOS + '장까지)</span></h2><div class="txt-card">' +
        '<p class="hint d-photo-hint">하자 부위, 보수 전·후 사진을 올려 두세요. 손님 집 사진이라 <b>홈페이지에는 나오지 않고 관리자만</b> 볼 수 있어요. 사진을 누르면 크게 보여요.</p>' +
        '<div id="d-photos"><p class="hint">' + ((d.photos || []).length ? '사진 불러오는 중…' : '') + '</p></div></div>' +
        '<h2 class="est-h">2. 현장 확인</h2><div class="txt-card">' +
        '<div class="sf-row">' + f('d-cdate', '확인 날짜', d.check_on, { type: 'date', short: true }) + f('d-ctime', '시간', d.check_time, { max: 20, opt: true, time: true, ph: '예) 오전 10시' }) + '</div>' +
        f('d-cnote', '확인 결과', d.check_note, { area: true, opt: true, ph: '현장에서 본 원인, 보수 방법, 필요한 자재 등' }) + '</div>' +
        // 하자 보수는 시작일 ~ 끝나는 날 (여러 날 공사)
        '<h2 class="est-h">3. 하자 보수</h2><div class="txt-card">' +
        '<div class="sf-row">' + f('d-rdate', '시작일', d.repair_on, { type: 'date', short: true }) + f('d-rend', '끝나는 날', d.repair_end, { type: 'date', opt: true, minFrom: 'd-rdate', short: true }) + '</div>' +
        f('d-rtime', '시간', d.repair_time, { max: 20, opt: true, time: true, ph: '예) 오후 2시' }) +
        f('d-rnote', '보수 내용', d.repair_note, { area: true, opt: true, ph: '어떻게 고쳤는지' }) + '</div>' +
        '<h2 class="est-h">4. 완료</h2><div class="txt-card">' +
        f('d-done', '완료일', d.done_on, { type: 'date', cls: 'd-date' }) +
        '<button class="btn btn-outline d-today" type="button" data-donetoday>' + I.check + '오늘 완료로 적기</button>' +
        '<p class="hint">날짜를 적으면 <b>일정 달력</b>에 저절로 나와요.</p></div>' +
        (isNew ? '' : '<button class="btn btn-text-danger cust-del" type="button" data-ddel>이 하자 기록 지우기</button>') +
        '<div class="savebar"><p class="msg" id="d-msg" hidden></p><button class="btn btn-primary" type="submit">' + I.check + '저장</button></div>';
      app.innerHTML = ''; app.appendChild(page);

      function read() {
        return {
          id: d.id, customer_id: c.id, contract_id: $('#d-ctr', page) ? $('#d-ctr', page).value || null : d.contract_id,
          received_on: $('#d-recv', page).value || K.today(), title: $('#d-title', page).value.trim(), body: $('#d-body', page).value,
          check_on: $('#d-cdate', page).value || null, check_time: $('#d-ctime', page).value.trim(), check_note: $('#d-cnote', page).value,
          repair_on: $('#d-rdate', page).value || null, repair_end: $('#d-rend', page).value || null, repair_time: $('#d-rtime', page).value.trim(), repair_note: $('#d-rnote', page).value,
          done_on: $('#d-done', page).value || null,
        };
      }
      function drawSteps() {
        var cur = defectStatus(read()), idx = DSTEP.map(function (s) { return s[0]; }).indexOf(cur);
        $('#d-steps', page).innerHTML = DSTEP.map(function (s, i) {
          return '<li class="' + (i < idx ? 'past' : i === idx ? 'on' : '') + '"><span>' + (i + 1) + '</span>' + s[1] + '</li>';
        }).join('');
      }
      // 하자보수 기간 안인지 (관련 계약서의 준공일 + 계약서에 적은 하자보수 기간)
      function drawWarranty() {
        var box = $('#warranty', page), cid = $('#d-ctr', page) ? $('#d-ctr', page).value : d.contract_id;
        if (!cid) { box.hidden = true; return; }
        DB.getContract(cid).then(function (k) {
          var w = k && k.doc && k.doc.warranty, end = k && (k.end_date || (k.doc && k.doc.end));
          if (!w || !end || !(Number(w.n) > 0)) { box.hidden = true; return; }
          var m = /^(\d{4})-(\d{2})-(\d{2})$/.exec(end), months = w.unit === '개월' ? Number(w.n) : Number(w.n) * 12;
          var until = K.ymd(new Date(+m[1], +m[2] - 1 + months, +m[3]));
          var recv = $('#d-recv', page).value || K.today(), inside = recv <= until, during = recv < end;   // 공사가 끝나기 전에 접수한 하자 (공사 중)
          box.hidden = false;
          box.className = 'warranty ' + (inside ? 'in' : 'out');
          box.innerHTML = '<b>' + (during ? '아직 공사 기간이에요' : inside ? '하자보수 기간 안이에요' : '하자보수 기간이 지났어요') + '</b><span>공사 ' + (during ? '마치는 날 ' : '완료 ') + esc(K.kDate(end)) + ' · 보수 기간 ' + esc(w.n + w.unit) +
            ' → ' + esc(K.kDate(until)) + '까지' + (w.note ? ' (' + esc(w.note) + ')' : '') + '</span>';
        }).catch(function () { box.hidden = true; });
      }
      drawSteps(); drawWarranty();
      // 사진: 비공개 저장소라 볼 때마다 1시간짜리 주소를 받아서 보여 줌
      var picker = null, started = false;
      (DB.signPhotos ? DB.signPhotos([].concat.apply([], (d.photos || []).map(function (p) { return [p.thumb, p.full]; }))) : Promise.resolve({})).then(function (urls) {
        if (!page.isConnected) return;
        picker = K.PhotoPicker($('#d-photos', page), d.photos || [], MAX_DEFECT_PHOTOS, function () { if (started) { K.setDirty(true); $('#d-msg', page).hidden = true; } }, { private: true, urls: urls, noCover: true, zoom: true });
        started = true;
      });
      page.addEventListener('input', function () { K.setDirty(true); $('#d-msg', page).hidden = true; drawSteps(); });
      page.addEventListener('change', function (e) { if (e.target.id === 'd-ctr' || e.target.id === 'd-recv') drawWarranty(); drawSteps(); });
      page.addEventListener('click', function (e) {
        var fb = e.target.closest('[data-fdopen="d-ctr"]');
        if (e.target.closest('[data-fdclear="d-ctr"]')) return setCtr('');
        if (fb) return K.finder({ title: '관련 계약서', ph: '공사명으로 찾기', cur: $('#d-ctr', page).value, focus: fb, none: '고르지 않음', recent: 20,
          items: ctrs.map(function (k) { var di = K.dealItem('k', k); return { id: k.id, label: di.label, sub: di.sub, keys: K.ctrTitle(k) }; }),   // 현장 / 품목 · 기간 · 고객 이름
          onPick: function (it) { setCtr(it ? it.id : ''); } });
        if (e.target.closest('[data-donetoday]')) { $('#d-done', page).value = K.today(); K.setDirty(true); drawSteps(); return; }
        if (e.target.closest('[data-ddel]')) {
          K.ask({ title: '이 하자 기록을 지울까요?', text: esc(d.title) + '<br>휴지통에 <b>30일</b> 동안 보관돼서 그동안은 <b>설정 → 휴지통</b>에서 되살릴 수 있어요.', cancel: '그만두기', ok: '지우기', okClass: 'btn-danger' }).then(function (ok) {
            if (!ok) return;
            DB.deleteDefect(d.id).then(function () { K.setDirty(false); K.toast('휴지통으로 옮겼어요'); K.state.counts = null; K.leave(back); })
              .catch(function (err) { fail('지우지 못했어요', err); });
          });
        }
      });
      page.addEventListener('submit', function (e) {
        e.preventDefault();
        var row = read(), msg = $('#d-msg', page);
        if (!row.title) { msg.textContent = '하자 내용을 적어 주세요. (예: 욕실 타일 들뜸)'; msg.hidden = false; $('#d-title', page).focus(); return; }
        row.status = defectStatus(row);
        if (!picker && (d.photos || []).length) { msg.textContent = '사진을 불러오는 중이에요. 잠시 뒤에 다시 눌러 주세요.'; msg.hidden = false; return; }
        if (picker && picker.busy()) { msg.textContent = '사진을 줄이는 중이에요. 잠시 뒤에 다시 눌러 주세요.'; msg.hidden = false; return; }
        if (!row.id) row.id = DB.newId ? DB.newId() : undefined;
        var btn = $('button[type=submit]', page); btn.disabled = true;
        var hasNew = picker && picker.items().some(function (x) { return x.status === 'ready' && !x.existing && !x.uploaded; });
        var prog = hasNew ? K.progress('사진을 올리는 중이에요') : { set: function () {}, close: function () {} };
        (picker ? picker.upload('defects/' + row.id, prog) : Promise.resolve(d.photos || [])).then(function (photos) {
          row.photos = photos;
          return DB.saveDefect(row);
        }).then(function (saved) {
          prog.close();
          if (picker && picker.removed().length) DB.removePhotos(picker.removed(), { private: true }).catch(function () {});
          K.setDirty(false); K.state.counts = null;
          K.toast(row.status === 'done' ? '보수 완료로 저장했어요' : (row.check_on || row.repair_on) ? '저장했어요 · 일정 달력에도 나와요' : '저장했어요');
          K.leave(back);   // 들어온 화면으로 (일정 달력에서 왔으면 달력)
          return saved;
        }).catch(function (err) {
          prog.close(); btn.disabled = false;
          msg.textContent = /photos/.test(String((err && err.message) || '')) ? '하자 사진을 저장할 칸이 아직 없어요. Supabase에서 최신 schema.sql 을 한 번 더 실행해 주세요.' : K.friendlyError(err);
          msg.hidden = false;
        });
      });
      if (isNew) setTimeout(function () { $('#d-title', page).focus(); }, 60);
    }).catch(function (err) { errPage(err); });
  }

  // #/customers/work 처럼 골라 보기를 정해서 열 수 있음 (대시보드에서)
  K.routes.customers = function (args) {
    if (args && args[0] && FILTERS.some(function (f) { return f[0] === args[0]; })) {
      var st = K.filterState('custF', []); st.q = ''; st.reg = ''; st.from = ''; st.to = ''; st.st = args[0] === 'all' ? [] : [args[0]];
    }
    viewCustomers();
  };
  K.routes.customer = function (args) {
    if (args[0] === 'new') return viewCustomerForm(null, args[1] === 'q' ? decodeURIComponent(args[2] || '') : null);
    if (args[1] === 'edit') return viewCustomerForm(decodeURIComponent(args[0]));
    return viewCustomer(decodeURIComponent(args[0] || ''));
  };
  K.routes.defect = viewDefect;
  window.CustomerKit = { defectNext: defectNext, defectStatus: defectStatus, repairRange: repairRange, STATUS: STATUS, statusOf: statusOf, byCustomer: byCustomer, stepLabel: stepLabel };
})();
