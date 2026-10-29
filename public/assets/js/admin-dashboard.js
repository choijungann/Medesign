/* =====================================================================
   관리화면 — 첫 화면(대시보드)
   (새 상담 신청 알림) · 바로 하기 · 오늘·다가오는 일정 · 공사 중 현장과 하자 · 계약 완료 · 진행 중인 견적
   목록 화면(상담 신청 · 시공사례 · 고객 후기)은 admin.js 의 viewHome 이 그대로 맡습니다.
   ===================================================================== */
(function () {
  'use strict';
  var K = window.AdminKit;
  if (!K) return;
  var DB = K.DB, I = K.I, esc = K.esc, $ = K.$, $$ = K.$$;
  var app = document.getElementById('app');
  var WEEK = '일월화수목금토';

  function parse(iso) { var m = /^(\d{4})-(\d{2})-(\d{2})/.exec(iso || ''); return m ? new Date(+m[1], +m[2] - 1, +m[3]) : null; }
  function diff(a, b) { var x = parse(a), y = parse(b); return x && y ? Math.round((y - x) / 864e5) : 0; }   // b - a (일)
  function localDay(ts) { return ts ? K.ymd(new Date(ts)) : ''; }                                           // 저장 시각 → 한국 날짜
  function md(iso) { var d = parse(iso); return d ? (d.getMonth() + 1) + '/' + d.getDate() : ''; }
  // 굵은 글씨 = 현장(아파트 이름 + 동·호수): 주소 앞 '시·도 시·군·구'와 끝 'n평'은 빼고 (없으면 고객 이름)
  function siteOf(str, size) {   // 아파트 이름 + 동·호수 + 평수
    var s0 = String(str || '').trim(); if (!s0) return '';
    return K.siteLabel ? K.siteLabel(s0, size) : s0;
  }
  function sizeOf() {   // 'n평' 찾기 (주소·공사명 어디든)
    for (var i = 0; i < arguments.length; i++) { var m = /(\d+(?:\.\d+)?)\s*평/.exec(String(arguments[i] || '')); if (m) return m[1] + '평'; }
    return '';
  }
  // 공사명에서 현장(아파트 이름·평수)과 겹치는 말을 빼고 공사 항목만: '○○아파트 24평 도배·장판·필름 공사' → '도배·장판·필름 공사'
  function workItems(title, site) {
    var st = String(site || '');
    return String(title || '').split(/\s+/).filter(function (w) { return w && !/^\d+(\.\d+)?평$/.test(w) && st.indexOf(w) < 0; }).join(' ');
  }
  function mdKo(iso) { var d = parse(iso); return d ? (d.getMonth() + 1) + '월\u00a0' + d.getDate() + '일' : ''; }   // 진행 중인 견적: '10월 26일 견적' (오늘·어제 없이)

  function load() {
    return Promise.all([DB.listWorks({ all: true }), DB.listReviews({ all: true }), K.soft(DB.listInquiries), K.soft(DB.listEstimates), K.soft(DB.listContracts),
      K.soft(DB.listDefects), K.soft(DB.listCustomers), K.soft(DB.listSchedules), DB.getSettings ? DB.getSettings().catch(function () { return {}; }) : Promise.resolve({})])
      .then(function (r) {
        return { works: r[0], reviews: r[1], inquiries: r[2], estimates: r[3], contracts: r[4], defects: r[5], customers: r[6], schedules: r[7], settings: r[8] || {} };
      });
  }

  // 공사 중 현장: 오늘이 계약서 공사 기간(공사 완료 표시 전) 또는 '공사' 일정 안
  // 공사 기간 = 착공일~준공일(비었으면 세부 공사일정 처음~끝 — 계약 완료 탭과 같은 K.workRange), 공정이 그 앞뒤로 나가면 그 공정까지 넓힘
  function workingSites(D, today) {
    var cust = {}, seen = {}, out = [];
    D.customers.forEach(function (c) { cust[c.id] = c; });
    D.contracts.forEach(function (k) {
      if (k.status === 'done' || k.status === 'canceled' || k.status === 'terminated') return;
      var r = K.workRange(k); if (!r) return;
      var phs = (Array.isArray(k.phases) && k.phases.length ? k.phases : (k.doc && Array.isArray(k.doc.phases) ? k.doc.phases : [])).filter(function (h) { return h && h.name && h.from; });
      var kFrom = r.from, kTo = r.to;
      phs.forEach(function (h) { if (h.from < kFrom) kFrom = h.from; if ((h.to || h.from) > kTo) kTo = h.to || h.from; });
      if (kFrom > today || kTo < today) return;
      if (k.customer_id) seen[k.customer_id] = true;
      var c = cust[k.customer_id];
      // 오늘 하는 공정(여러 개면 여러 개), 없으면 다음 공정
      var now = phs.filter(function (h) { return h.from <= today && today <= (h.to || h.from); })
        .map(function (h, i) { return { name: h.name, nth: diff(h.from, today) + 1, total: diff(h.from, h.to || h.from) + 1, i: i }; })
        .sort(function (a, b) { return b.total - a.total || a.i - b.i; });   // 긴 공정(장기)부터 — 같은 길이면 공정 순서대로
      var nx = now.length ? null : phs.filter(function (h) { return h.from > today; }).sort(function (a, b) { return a.from.localeCompare(b.from); })[0];
      var ksz = sizeOf(k.site, k.title, c && c.address);
      out.push({ name: k.customer_name || (c && c.name) || '', site: siteOf(K.fillUnit(k.site, c && c.address), ksz) || siteOf(c && c.address, ksz), size: ksz,
        items: k.items || workItems(k.title, k.site) || k.title || '', title: k.title || '공사', from: kFrom, to: kTo, draft: k.status === 'draft',
        now: now, next: nx ? { name: nx.name, from: nx.from } : null,
        href: '#/calendar/k/' + encodeURIComponent(k.id) });
    });
    D.schedules.forEach(function (s) {
      var to = s.end_on || s.start_on;
      if (s.kind !== 'work' || !s.start_on || s.start_on > today || to < today) return;
      if (s.customer_id && seen[s.customer_id]) return;
      var c = cust[s.customer_id];
      var ssz = sizeOf(s.place, s.title, c && c.address);
      out.push({ name: c ? c.name : '', site: siteOf(K.fillUnit(s.place, c && c.address), ssz) || siteOf(c && c.address, ssz), size: ssz, items: s.title || '', title: s.title || '공사',
        from: s.start_on, to: to, now: [], next: null, href: '#/calendar/' + s.start_on.slice(0, 7) });
    });
    return out.sort(function (a, b) { return a.to.localeCompare(b.to); });
  }

  function view() {
    K.frame('홈', false, 'home', true);
    app.innerHTML = '<div class="page"><div class="loading">불러오는 중…</div></div>';
    // 휴지통: 30일 지난 것은 관리화면을 열 때 한 번씩 완전히 지움 (사진·파일 포함)
    if (!K.state.trashSwept && DB.purgeOldTrash) { K.state.trashSwept = true; DB.purgeOldTrash().catch(function () {}); }
    load().then(function (D) {
      var today = K.today(), month = today.slice(0, 7), t = parse(today);
      var CK = window.CustomerKit;
      K.state.counts = K.countsOf(D.works, D.reviews, D.inquiries, D.estimates, D.contracts, D.defects);
      K.renderSide('home');

      var newInq = D.inquiries.filter(K.isNewInq)
        .sort(function (a, b) { return String(b.created_at).localeCompare(String(a.created_at)); });
      var sites = workingSites(D, today);
      var openDef = D.defects.filter(function (d) { return d.status !== 'done'; })
        .sort(function (a, b) { return String(a.repair_on || a.check_on || '9').localeCompare(String(b.repair_on || b.check_on || '9')); });
      var cust = {}; D.customers.forEach(function (c) { cust[c.id] = c; });

      function sec(title, more, body, cls) {
        return '<section class="dash-sec ' + (cls || '') + '"><div class="dash-head"><h2>' + emo(cls) + title + '</h2>' + (more || '') + '</div>' + body + '</section>';
      }
      // 칸 제목 앞 그림 — 칸마다 한눈에 구별 (바로 하기 ⚡ · 일정 📅 · 현장 🔨 · 계약 ✍️ · 견적 📝)
      var EMO = { 'dash-act': '⚡', 'dash-up': '📅', 'dash-sites-sec': '🔨', 'dash-ctr': '✍️', 'dash-est': '📝', 'dash-deals': '📋', 'sub-work': '🏗️', 'sub-def': '🔧' };
      function emo(k) { return EMO[k] ? '<span class="dash-emo" aria-hidden="true">' + EMO[k] + '</span>' : ''; }
      function moreLink(href, text) { return '<a class="dash-more" href="' + href + '">' + text + '</a>'; }
      function empty(text) { return '<p class="dash-empty">' + text + '</p>'; }
      // 공사 중·하자가 비었을 때: 카드 한 장과 같은 크기의 빈 칸(점선)에 안내 — 비어 있어도 칸 크기가 그대로(공사 1장 · 하자 1장), 늘어나면 카드만큼 길어짐
      // 보이지 않는 줄을 카드와 똑같이 넣어서 화면 너비·글자 크기가 달라도 카드와 같은 높이
      function ghost(text, def) {
        return '<div class="dash-sites"><div class="dash-site ds-ghost' + (def ? ' ds-def' : '') + '"><div class="ds-top" aria-hidden="true"><b>&nbsp;</b></div><span class="ds-item" aria-hidden="true">&nbsp;</span>' +
          '<div class="ds-now" aria-hidden="true"><span class="ds-badge">&nbsp;</span></div>' + '<progress max="1" value="0" aria-hidden="true"></progress>' +
          '<div class="ds-foot" aria-hidden="true"><small class="ds-m">&nbsp;</small></div><p class="ds-ghost-t">' + text + '</p></div></div>';
      }
      // 견적 및 계약이 비었을 때도 같은 모양: 목록 한 줄(현장 · 공사 항목 · 고객 · 날짜)과 같은 크기의 점선 빈 칸
      function dghost(text) {
        return '<div class="drows"><div class="drow ds-ghost"><span class="t" aria-hidden="true"><b>&nbsp;</b><small>&nbsp;</small><small>&nbsp;</small><small>&nbsp;</small></span>' +
          '<p class="ds-ghost-t">' + text + '</p></div></div>';
      }
      function extra() { return ''; }   // '외 n건 더 있어요' 줄은 안 보임 (2026-10-25 대표님 요청 — 칸 제목을 누르면 전체 목록)
      // 한 줄: [표시] 이름 / 작은 설명 · 오른쪽 숫자 · >
      function drow(o) {
        // 견적 및 계약 줄 (세 줄): ① 현장 이름 — 칸 너비를 다 씀  ② 공사 항목 | 오른쪽 금액  ③ 날짜 · 고객 | 오른쪽 남은 날 이름표(계약 완료)
        // 금액은 가운데 줄과 같은 높이(오른쪽 > 와도 같은 높이)에 — 제목 줄 옆을 비워서 현장 이름 자리가 넓음
        if (o.lines) {
          var L = o.lines.filter(Boolean).map(function (l) { return [l[0] || '&nbsp;', l[1]]; });   // 빈 줄도 자리는 남김 (같은 종류 줄은 높이가 같게)
          return '<a class="drow dgrid' + (o.badge ? '' : ' nob') + '" href="' + esc(o.href) + '"><span class="t"><b>' + o.title + '</b>' +
            L.map(function (l) { return '<small class="' + l[1] + '">' + l[0] + '</small>'; }).join('') +
            '<span class="r-n">' + (o.right || '') + '</span><span class="go">' + I.right + '</span>' + (o.badge ? '<span class="ddb">' + o.badge + '</span>' : '') +
            '</span></a>';   // > 는 금액 옆, 남은 날 이름표는 박스 오른쪽 끝(공사 중 카드와 같은 자리)
        }
        return '<a class="drow' + (o.cls ? ' ' + o.cls : '') + (o.pill ? ' has-pill' : '') + (o.badge ? ' has-dd' : '') + '" href="' + esc(o.href) + '">' + (o.pill || '') +
          '<span class="t"><b>' + o.title + '</b>' + (o.lines ? o.lines.filter(Boolean).map(function (l) { return '<small class="' + l[1] + '">' + (l[0] || '&nbsp;') + '</small>'; }).join('')
            : (o.sub ? '<small>' + o.sub + '</small>' : '') + (o.sub2 ? '<small class="s2">' + o.sub2 + '</small>' : '')) + '</span>' +
          (o.right || o.badge ? '<span class="r">' + (o.badge || '') + (o.right ? '<span class="r-n">' + o.right + '</span>' : '') + '</span>' : '') + '<span class="go">' + I.right + '</span></a>';
      }
      function money(n) { return n ? K.won(n) + '원' : ''; }

      // ---------- 새 상담 신청: 알림 한 줄 (있을 때만) ----------
      var inqAlert = newInq.length ? '<a class="new-alert" href="#/inquiries"><span class="dot" aria-hidden="true"></span>' +
        '<span>새 상담 신청이 <b>' + newInq.length + '건</b> 있어요</span><span class="go">확인하기 ›</span></a>' : '';
      // 블랙리스트 고객과 같은 연락처로 들어온 새 상담 신청 (있을 때만)
      var blD = {}; D.customers.forEach(function (c) { var d = K.digits(c.phone); if (c.blacklist && d) blD[d] = c; });
      var blInq = newInq.filter(function (q) { return blD[K.digits(q.phone)]; });
      if (blInq.length) inqAlert += '<a class="new-alert bl-alert" href="#/inquiries">' + I.ban + '<span>블랙리스트 연락처로 상담 신청이 들어왔어요 · <b>' +
        esc(blInq.map(function (q) { return q.name || q.phone; }).slice(0, 3).join(', ')) + '</b></span><span class="go">확인하기 ›</span></a>';

      // ---------- 공사 중 현장 + 처리 중인 하자 ----------
      // 공사 중·하자 카드 (다섯 줄): ① 현장(아파트 이름 + 동·호수 + 평수) 굵게 ② 공사 항목 / 하자 내용 ③ 지금(예정) 하는 일 이름표 ④ 진행 막대 ⑤ 기간·날짜
      function place(site, size, fb) { return site || fb || ''; }   // site 에 평수까지 들어 있음
      // 오른쪽 위 남은 날 이름표: 'D-n' 대신 '공사완료까지 n일'처럼 무엇까지인지 (그날이면 todayWord)
      function dBadge(n, what, todayWord) { return n < 0 ? '' : '<span class="ds-d' + (n <= 1 ? ' soon' : '') + '">' + (n === 0 ? todayWord : what + '까지 ' + n + '일') + '</span>'; }
      var siteHtml = sites.length ? '<div class="dash-sites">' + sites.slice(0, 4).map(function (s) {
        var total = diff(s.from, s.to) + 1, nth = Math.min(total, diff(s.from, today) + 1), left = diff(today, s.to);
        var now = (s.now || []).map(function (h) { return '<span class="ds-badge">' + esc(h.name) + (h.total > 1 ? ' <small>' + h.total + '일 중 ' + h.nth + '일째</small>' : '') + '</span>'; }).join('');
        var task = now || (s.next ? '<span class="ds-badge next">' + esc(s.next.name) + ' <small>' + esc(md(s.next.from)) + '부터</small></span>' : '');   // '지금' 글자 없이 이름표만
        return '<a class="dash-site" href="' + esc(s.href) + '"><div class="ds-top"><b>' + esc(place(s.site, s.size, s.name ? s.name + ' 고객님' : s.title)) + '</b></div>' +   // 남은 날 이름표는 맨 아래 줄 오른쪽 (현장 이름 칸을 넓게)
          '<span class="ds-item">' + (s.items ? esc(s.items) : '&nbsp;') + '</span>' +   // 줄 수를 늘 같게 (빈 줄은 자리만)
          '<div class="ds-now">' + (task || '<span class="ds-badge ds-hid">&nbsp;</span>') + '</div>' +
          '<progress max="' + total + '" value="' + nth + '" aria-label="공사 ' + total + '일 중 ' + nth + '일째"></progress>' +
          '<div class="ds-foot"><small class="ds-m">' + esc(md(s.from) + ' ~ ' + md(s.to)) + ' · <span class="ds-tot">' + total + '일 중 </span><b>' + nth + '일째</b></small>' +   // 좁은 휴대폰은 'n일 중' 을 빼고 '5일째'만   // '계약 전' 글자는 안 씀 (2026-10-26 요청)
          dBadge(left, '공사완료', '오늘 공사완료') + '</div></a>';
      }).join('') + '</div>' + extra(sites.length, 4) : ghost('지금 공사 중인 현장이 없어요.');
      var kById = {}; D.contracts.forEach(function (k) { kById[k.id] = k; });
      var defHtml = openDef.length ? '<div class="dash-sites">' + openDef.slice(0, 4).map(function (d) {
        var c = cust[d.customer_id], k = d.contract_id && kById[d.contract_id], who = c ? (c.name || c.phone || '') : '';
        var size = sizeOf(k && k.site, k && k.title, c && c.address), site = siteOf(K.fillUnit(k && k.site, c && c.address), size) || siteOf(c && c.address, size);
        // 하자 보수 기간 (시작일 ~ 끝나는 날)
        var rs = d.repair_on || '', re = rs && d.repair_end && d.repair_end > rs ? d.repair_end : rs;
        var inRep = rs && rs <= today && today <= re, before = rs && today < rs;
        var ck = d.check_on || '', ckNext = ck && ck >= today && (!rs || ck <= rs);   // 현장 확인이 다음 할 일인지 (오늘이거나 앞으로, 보수보다 먼저)
        // 이름표: 현장 확인이 다음이면 [현장 확인], 보수 기간 중이면 [하자 보수 n일 중 m일째], 보수 전이면 [하자 보수] — 날짜는 오른쪽 위 D-n 으로만
        // 아래 회색 줄: 현장 확인 날짜 / 하자 보수 기간(보수 중이면 'n일 중 m일째'), 정해진 날짜가 없으면 이름표 없이 '날짜 미정'
        // 진행 막대는 보수 기간 중에만 차오름 (보수 전이면 빈 막대, 현장 확인 차례면 막대 없음)
        var badge = '', bar = '', line = '';
        if (ckNext) {
          badge = '<span class="ds-badge def">현장 확인</span>';
          line = '<small class="ds-m">' + esc(md(ck)) + '</small>';   // 아래 회색 줄: 현장 확인 날짜 (시간은 안 씀)
        }
        else if (inRep) {
          var tot = diff(rs, re) + 1, nth = Math.min(tot, diff(rs, today) + 1);
          badge = '<span class="ds-badge def">하자 보수' + (tot > 1 ? ' <small>' + tot + '일 중 ' + nth + '일째</small>' : '') + '</span>';
          bar = '<progress max="' + tot + '" value="' + nth + '" aria-label="하자 보수 ' + tot + '일 중 ' + nth + '일째"></progress>';
          line = '<small class="ds-m">' + esc(md(rs) + (re !== rs ? ' ~ ' + md(re) : '')) + ' · ' + tot + '일 중 <b>' + nth + '일째</b></small>';
        } else if (before) {
          badge = '<span class="ds-badge def">하자 보수</span>';
          bar = '<progress max="1" value="0" aria-label="하자 보수 시작 전"></progress>';
          line = '<small class="ds-m">' + esc(md(rs) + (re !== rs ? ' ~ ' + md(re) + ' · ' + (diff(rs, re) + 1) + '일' : '')) + '</small>';   // 아래 회색 줄: 보수 기간 (시간은 안 씀)
        } else if (!rs && !(ck && ck >= today)) line = '<small class="ds-m">날짜 미정</small>';
        // 오른쪽 이름표: 보수 전이면 '보수시작까지 n일', 보수 중이면 '보수완료까지 n일' — 공사 카드('공사완료까지 n일')처럼 오늘은 빼고 셈
        // (10/27~10/28 이틀 보수: 10/26 '보수시작까지 1일' → 10/27 '보수완료까지 1일' → 10/28 '오늘 보수완료' — 2026-10-26 요청)
        var dB = ckNext ? dBadge(diff(today, ck), '현장 확인', '오늘') : before ? dBadge(diff(today, rs), '보수시작', '오늘 보수시작')
          : inRep ? dBadge(diff(today, re), '보수완료', '오늘 보수완료') : '';
        return '<a class="dash-site ds-def" href="#/defect/' + encodeURIComponent(d.id) + '"><div class="ds-top"><b>' + esc(place(site, size, who ? who + ' 고객님' : '하자')) + '</b></div>' +
          '<span class="ds-item">' + (d.title ? esc(d.title) : '&nbsp;') + '</span>' +   // 하자 카드도 줄 수를 늘 같게: 내용 · 이름표 · 막대 · 날짜 (없는 줄은 자리만)
          '<div class="ds-now">' + (badge || '<span class="ds-badge ds-hid">&nbsp;</span>') + '</div>' + (bar || '<progress class="ds-hid" max="1" value="0" aria-hidden="true"></progress>') +
          '<div class="ds-foot">' + (line || '<small class="ds-m">&nbsp;</small>') + dB + '</div></a>';   // 남은 날 이름표는 맨 아래 줄 오른쪽
      }).join('') + '</div>' + extra(openDef.length, 4) : ghost('처리 중인 하자가 없어요.', true);
      var fieldHtml =
        '<div class="dash-sub"><h3>' + emo('sub-work') + '공사 중 <small>' + sites.length + '</small></h3>' + (sites.length > 4 ? moreLink('#/customers/work', '모두 보기') : '') + '</div>' + siteHtml +
        '<div class="dash-sub"><h3>' + emo('sub-def') + '하자 처리 중 <small>' + openDef.length + '</small></h3>' + (openDef.length ? moreLink('#/customers/defect', '모두 보기') : '') + '</div>' + defHtml;

      // ---------- 계약 완료 (서명했고 공사 완료 전) — 서명 전 계약서는 계약서 목록에서 ----------
      var signedCtr = D.contracts.filter(function (k) { return k.status === 'signed'; })
        .sort(function (a, b) { return String((wr0(a) || {}).from || '9').localeCompare(String((wr0(b) || {}).from || '9')); });
      // 공사 기간: 착공·준공일, 비었으면 세부 공사일정(공정) 처음~끝
      function wr0(k) { return K.workRange ? K.workRange(k) : (k.start_date ? { from: k.start_date, to: k.end_date || k.start_date } : null); }
      function ctrStage(k) {
        var r = wr0(k); if (!r) return '공사 날짜 미정';
        var to = r.to;
        k = { start_date: r.from };
        if (k.start_date > today) { var n = diff(today, k.start_date); return '공사 시작 ' + (n === 1 ? '내일' : n + '일 남음') + ' (' + md(k.start_date) + ')'; }
        if (to >= today) return '공사 중 · ' + (diff(k.start_date, to) + 1) + '일 중 ' + (diff(k.start_date, today) + 1) + '일째';
        return '';   // 공사 기간이 지난 계약: 안내 문구 없이 (2026-10-26 요청)
      }
      // 세 줄: 현장(굵게) / 공사 항목 / 날짜(요일) · 고객 이름
      function rowLines(st, nm, title, items, when, tail) {
        var big = st || (nm ? nm + ' 고객님' : title), who = nm && big !== nm + ' 고객님' ? nm + ' 고객님' : '';
        // 날짜 옆에 고객 이름 (한 줄로 합침): '10월 25일(일) · 김○○ 고객님' (+ 견적은 '연락해 볼까요?')
        var last = [when, who ? '<span class="l-who-in">' + esc(who) + '</span>' : '', tail || ''].filter(Boolean).join(' · ');
        return { title: esc(big), lines: [[esc(items && items !== big ? items : ''), 'l-item'], [last, 'l-date']] };
      }
      var ctrHtml = signedCtr.length ? '<div class="drows">' + signedCtr.slice(0, 5).map(function (k) {
        var kc0 = cust[k.customer_id], nm = k.customer_name || (kc0 && kc0.name) || '', st = siteOf(K.fillUnit(k.site, kc0 && kc0.address), sizeOf(k.site, k.title));
        // 공사 기간: 하루면 '10월 27일(화)', 여러 날이면 짧게 '10/22(목) ~ 11/4(수)' (오른쪽 이름표·금액 옆 한 줄에 들어가게)
        var mdw = function (iso) { var d0 = parse(iso); return d0 ? md(iso) + '(' + WEEK.charAt(d0.getDay()) + ')' : ''; };
        var wr = wr0(k), when = wr ? (wr.to !== wr.from ? esc(mdw(wr.from)) + ' ~ ' + esc(mdw(wr.to)) : esc(K.sDate(wr.from))) : '공사 날짜 미정';
        var o = rowLines(st, nm, k.title || '계약서', k.items || workItems(k.title, k.site) || k.title || '', when);   // 공사 항목: 견적서 항목·공정 이름 (없으면 공사명에서)
        // 오른쪽 위 이름표: 공사 시작 전 '공사시작까지 n일', 공사 중이면 '공사완료까지 n일' (날짜 미정·기간 지남은 없음)
        var kEnd = wr ? wr.to : '', dd = !wr ? '' : today < wr.from ? dBadge(diff(today, wr.from), '공사시작', '오늘 공사시작')
          : today <= kEnd ? dBadge(diff(today, kEnd), '공사완료', '오늘 공사완료') : '';
        return drow({ href: '#/contract/' + encodeURIComponent(k.id), title: o.title, lines: o.lines, right: money(k.total), badge: dd });
      }).join('') + '</div>' + extra(signedCtr.length, 5) : dghost('공사를 기다리거나 공사 중인 계약이 없어요.');

      // ---------- 진행 중인 견적 (답을 기다리는 견적) — 계약 완료·견적 중단은 견적서 목록에서 ----------
      var EK = window.EstimateKit;
      function eDay(e) { return e.estimate_date || localDay(e.created_at); }
      var openEst = D.estimates.filter(function (e) { return (EK ? EK.stageOf(e, D.contracts) : (e.status === 'stopped' ? 'stopped' : 'open')) === 'open'; })
        .sort(function (a, b) { return eDay(b).localeCompare(eDay(a)); });
      var estHtml = openEst.length ? '<div class="drows">' + openEst.slice(0, 5).map(function (e) {
        var nm = e.customer_name || (cust[e.customer_id] && cust[e.customer_id].name) || '', st = siteOf((e.site_name || '') + (e.site_unit ? ', ' + e.site_unit : ''), e.site_size || sizeOf(e.title));
        var days = diff(eDay(e), today);
        var when = eDay(e) ? esc(K.sDate(eDay(e))) : '', warn = eDay(e) && days >= 14 ? '<span class="warn">연락해 볼까요?</span>' : '';
        var o = rowLines(st, nm, e.title || '견적서', e.items || workItems(e.title, (e.site_name || '') + ' ' + (e.region || '')) || e.title || '', when, warn);   // 공사 항목: 견적서 항목 이름
        return drow({ href: '#/estimate/' + encodeURIComponent(e.id), title: o.title, lines: o.lines, right: money(e.total) });
      }).join('') + '</div>' + extra(openEst.length, 5) : dghost('답을 기다리는 견적이 없어요.');

      // 진행 중(견적) · 계약 완료: 한 상자에 탭 두 개 (가운데 정렬, 탭 이름 아래 숫자만 크게). 고른 탭은 이 화면을 다시 열어도 그대로
      function dealsHtml() {
        var cur = K.state.dashDeal === 'ctr' ? 'ctr' : 'est';
        var tab = function (k, label, n) {
          return '<button type="button" class="deal-tab' + (cur === k ? ' on' : '') + '" role="tab" id="deal-t-' + k + '" aria-controls="deal-p-' + k + '" aria-selected="' + (cur === k) + '" data-deal="' + k + '">' +
            '<span class="dt-l">' + label + '</span><b class="dt-n">' + n + '</b></button>';
        };
        // 두 탭 목록을 같은 자리에 겹쳐 두고 안 보이는 탭은 투명하게 — 상자 높이가 탭을 바꿔도 그대로(긴 쪽에 맞춤)
        var panel = function (k, body, href) {
          return '<div class="deal-p' + (cur === k ? '' : ' off') + '" role="tabpanel" id="deal-p-' + k + '" aria-labelledby="deal-t-' + k + '"' + (cur === k ? '' : ' inert aria-hidden="true"') + '>' + body +
            '<a class="deal-more" href="' + href + '">' + (k === 'est' ? '진행 중 견적' : '계약 완료') + ' 모두 보기 ›</a></div>';
        };
        return '<section class="dash-sec dash-deals"><div class="dash-head"><h2>' + emo('dash-deals') + '견적 및 계약</h2></div><div class="deal-tabs" role="tablist" aria-label="견적 및 계약">' +
          tab('est', '진행 중', openEst.length) + tab('ctr', '계약 완료', signedCtr.length) + '</div>' +
          '<div class="deal-ps">' + panel('est', estHtml, '#/estimates/open') + panel('ctr', ctrHtml, '#/contracts/signed') + '</div></section>';
      }

      var page = document.createElement('div');
      page.className = 'page dash';
      page.innerHTML =
        '<div class="dash-hello"><h2>안녕하세요!</h2><p>' + (t.getMonth() + 1) + '월 ' + t.getDate() + '일 ' + WEEK.charAt(t.getDay()) + '요일</p></div>' +
        // 처음 한 번만 하는 설정 — 다른 알림과 섞지 않고 맨 위에 따로
        '<a class="setup-banner" id="pw-alert" href="#/password" hidden><span class="ico">' + I.key + '</span><span class="t"><b>처음 한 번만: 내 비밀번호로 바꿔 주세요</b><small>지금은 처음 받은 비밀번호예요</small></span><span class="btn btn-primary btn-sm">바꾸기</span></a>' +
        '<a class="setup-banner note" id="priv-alert" href="#/privacy" hidden><span class="ico">' + I.trash + '</span><span class="t"><b>보관 기간 지난 손님 정보 <em id="priv-n"></em></b><small>확인하고 지워 주세요</small></span><span class="btn btn-outline btn-sm">확인</span></a>' +
        inqAlert +
        '<a class="new-alert us-alert" id="us-alert" href="#/usage" hidden>' + I.db + '<span id="us-alert-t"></span><span class="go">확인하기 ›</span></a>' +
        // 바로 하기: 한 줄 따로
        '<section class="dash-sec dash-act" aria-label="바로 하기"><div class="act-grid">' +   // 칸 제목(⚡ 바로 하기)은 안 씀 — 단추 네 개만
        '<a class="act-btn primary" href="#/work/new">' + I.camera + '<span>시공사례 올리기</span></a>' +
        '<a class="act-btn" href="#/review/new">' + I.chat + '<span>후기 올리기</span></a>' +
        '<a class="act-btn" href="#/estimate/new">' + I.doc + '<span>견적서 만들기</span></a>' +
        '<a class="act-btn" href="#/contract/new">' + I.sign + '<span>계약서 만들기</span></a>' +
        '</div></section>' +
        '<div class="dash-main">' +
        // 넓은 화면: 이 칸이 한 줄을 다 쓰고, 왼쪽 이번 달 달력 · 오른쪽 일정 목록 (휴대폰·태블릿은 목록만)
        sec('오늘·다가오는 일정', moreLink('#/calendar', '달력 보기'), '<div class="up-split"><div class="up-cal" id="dash-cal"></div><div class="up-week" id="dash-week"></div><div id="dash-up"><p class="dash-empty">불러오는 중…</p></div></div>', 'dash-up') +
        sec('공사 중 현장 · 하자', '', fieldHtml, 'dash-sites-sec') +
        dealsHtml() +
        '</div>';
      app.innerHTML = '';
      app.appendChild(page);
      page.addEventListener('click', function (e) {
        var b = e.target.closest('[data-deal]'); if (!b) return;
        var k = b.getAttribute('data-deal'); K.state.dashDeal = k;
        $$('[data-deal]', page).forEach(function (x) { var on = x === b; x.classList.toggle('on', on); x.setAttribute('aria-selected', String(on)); });
        $$('.deal-p', page).forEach(function (p) {
          var off = p.id !== 'deal-p-' + k; p.classList.toggle('off', off);
          if (off) { p.setAttribute('inert', ''); p.setAttribute('aria-hidden', 'true'); } else { p.removeAttribute('inert'); p.removeAttribute('aria-hidden'); }
        });
      });

      if (DB.needsPasswordChange) DB.needsPasswordChange().then(function (need) { var a = $('#pw-alert', page); if (a) a.hidden = !need; }).catch(function () {});
      // 보관 기간 지난 손님 정보 (나중에 셈)
      if (window.PrivacyKit) window.PrivacyKit.count().then(function (n) {
        if (!n || !page.isConnected) return;
        $('#priv-n', page).textContent = n + '건';
        $('#priv-alert', page).hidden = false;
      }).catch(function () {});
      // 저장 공간이 80% 넘게 찼을 때만 알림 (한 번 센 값은 5분 동안 다시 씀, 세지 못하면 아무것도 안 띄움)
      if (window.UsageKit) window.UsageKit.check().then(function (v) {
        var a = $('#us-alert', page); if (!a || v.max < 80) return;
        $('#us-alert-t', page).innerHTML = '저장 공간이 <b>' + v.max + '%</b> 찼어요 · 무료 한도에 가까워요'; a.hidden = false;
      }).catch(function () {});
      // 오늘부터 7일 일정 (공사 중 현장은 아래 칸에 따로 있으므로 '진행 중'은 빼고) — 종류는 색 점 대신 네모 이름표로
      var UP_KIND = { visit: '실측', work: '공사', meet: '상담', defect: '하자', etc: '기타' };
      var box = $('#dash-up', page);
      if (!window.CalendarKit) { box.innerHTML = empty('일정 달력을 불러오지 못했어요.'); return; }
      var calBox = $('#dash-cal', page);
      if (calBox && window.CalendarKit.collect) { try { calBox.innerHTML = miniCal(window.CalendarKit.collect(D)); } catch (e) { calBox.remove(); calBox = null; } }
      // 휴대폰·태블릿: 오늘부터 7일 달력 한 줄 (넓은 화면은 위 이번 달 달력) — 날짜를 누르면 아래 목록이 그날 일정으로
      var weekBox = $('#dash-week', page);
      if (weekBox && window.CalendarKit.collect) { try { weekBox.innerHTML = weekCal(window.CalendarKit.collect(D)); } catch (e) { weekBox.remove(); weekBox = null; } }
      function upRow(x, noDay) {
        // 종류 이름표: 넓은 화면은 날짜 옆 칸, 휴대폰은 내용 맨 윗줄에 '이름표 + 시간' (글 칸을 넓게) — 둘 중 하나만 보임
        var kl = esc(UP_KIND[x.kind] || '기타');
        return '<li><a href="' + esc(x.href || '#/calendar') + '">' + (noDay ? '' : '<span class="up-day' + (x.today ? ' today' : '') + '">' + esc(x.dayLabel) + '</span>') +
          '<span class="up-kind up-kind-col k-' + esc(x.kind) + '">' + kl + '</span><span class="up-t">' +
          '<span class="up-top"><span class="up-kind k-' + esc(x.kind) + '" aria-hidden="true">' + kl + '</span>' + '<small class="up-time">' + (x.time ? esc(x.time) : '&nbsp;') + '</small>' + '</span>' +
          '<b>' + esc(x.big || x.plain || x.title) + '</b>' +
          '<small>' + (x.big ? (x.content ? esc(x.content) : '&nbsp;') : (x.sub ? esc(x.sub) : '&nbsp;')) + '</small></span></a></li>';   // 둘째 줄은 비어도 자리 남김
      }
      // 기본: 오늘부터 7일 · 작은 달력에서 날짜를 누르면 그날 일정을 이 자리에서 바로 (다시 누르거나 '다가오는 일정'을 누르면 돌아옴)
      function showUpcoming() {
        $$('.mc-d.sel, .wk-d.sel', page).forEach(function (b) { b.classList.remove('sel'); b.setAttribute('aria-pressed', 'false'); });
        return window.CalendarKit.upcoming(7, D).then(function (list) {
          if (!box.isConnected) return;
          list = list.filter(function (x) { return x.dayLabel !== '진행 중'; });
          box.innerHTML = list.length ? '<ul class="dash-uplist">' + list.slice(0, 6).map(function (x) { return upRow(x); }).join('') + '</ul>' : empty('7일 안에 잡힌 일정이 없어요.');
        }).catch(function () { box.innerHTML = empty('일정을 불러오지 못했어요.'); });
      }
      function showDay(day) {
        $$('.mc-d, .wk-d', page).forEach(function (b) { var on = b.getAttribute('data-mday') === day; b.classList.toggle('sel', on); b.setAttribute('aria-pressed', String(on)); });
        return window.CalendarKit.dayRows(day, D).then(function (list) {
          if (!box.isConnected) return;
          box.innerHTML = '<div class="up-dayhead"><b>' + esc(K.sDate(day)) + (day === K.today() ? ' <small>오늘</small>' : '') + '</b>' +
            '<button type="button" class="btn-link" data-mback>다가오는 일정 보기</button></div>' +
            (list.length ? '<ul class="dash-uplist up-dayview">' + list.map(function (x) { return upRow(x, true); }).join('') + '</ul>' : empty('이 날은 일정이 없어요.'));
        }).catch(function () { box.innerHTML = empty('일정을 불러오지 못했어요.'); });
      }
      [calBox, weekBox].forEach(function (cb) {
        if (cb) cb.addEventListener('click', function (e) {
          var b = e.target.closest('[data-mday]'); if (!b) return;
          if (b.classList.contains('sel')) showUpcoming(); else showDay(b.getAttribute('data-mday'));
        });
      });
      box.addEventListener('click', function (e) { if (e.target.closest('[data-mback]')) showUpcoming(); });
      showUpcoming();
    }).catch(function (err) {
      app.innerHTML = '<div class="page"><div class="error-msg">' + esc(K.friendlyError(err)) + '</div><button class="btn btn-primary" type="button" data-reload>다시 불러오기</button></div>';
    });
  }

  // 첫 화면 이번 달 달력: 날짜 + 그날 일정(짧은 이름 2개까지, 나머지 '+n'). 날짜를 누르면 오른쪽에 그날 일정을 바로 보여 줌 (화면은 그대로)
  function miniCal(items) {
    var t0 = K.today(), y = +t0.slice(0, 4), m = +t0.slice(5, 7), map = {};
    items.forEach(function (x) { if (x.dim) return; (map[x.date] = map[x.date] || []).push(x); });
    var first = new Date(y, m - 1, 1), start = new Date(y, m - 1, 1 - first.getDay()), cells = '';
    for (var i = 0; i < 42; i++) {
      var d = new Date(start.getFullYear(), start.getMonth(), start.getDate() + i);
      if (i === 35 && d.getMonth() !== m - 1) break;   // 마지막 줄이 다음 달뿐이면 그리지 않음
      var iso = K.ymd(d), ks = map[iso] || [];
      cells += '<button type="button" class="mc-d' + (d.getMonth() !== m - 1 ? ' out' : '') + (iso === t0 ? ' today' : '') + (d.getDay() === 0 ? ' sun' : d.getDay() === 6 ? ' sat' : '') +
        '" data-mday="' + iso + '" aria-pressed="false" aria-label="' + esc(K.sDate(iso)) + (ks.length ? ' · 일정 ' + ks.length + '건' : '') + ' — 누르면 오른쪽에 그날 일정"><span class="mc-n">' + d.getDate() + '</span>' +
        '<span class="mc-evs" aria-hidden="true">' + ks.slice(0, 2).map(function (x) { return '<span class="mc-ev k-' + esc(x.kind) + '">' + esc(x.short || x.title) + '</span>'; }).join('') +
        (ks.length > 2 ? '<span class="mc-more">+' + (ks.length - 2) + '</span>' : '') + '</span></button>';
    }
    return '<div class="mc-h">' + y + '년 ' + m + '월</div><div class="mc-wk" aria-hidden="true">' + '일월화수목금토'.split('').map(function (w, i) { return '<span' + (i === 0 ? ' class="sun"' : i === 6 ? ' class="sat"' : '') + '>' + w + '</span>'; }).join('') + '</div>' +
      '<div class="mc-grid">' + cells + '</div>';
  }

  // 휴대폰·태블릿 첫 화면 7일 달력: 오늘부터 7일, 칸마다 요일 · 날짜(오늘은 빨간 동그라미) · 그날 일정 짧은 이름 2개까지(종류 색)
  function weekCal(items) {
    var t0 = K.today(), map = {}, WK = '일월화수목금토', out = '';
    items.forEach(function (x) { if (x.dim) return; (map[x.date] = map[x.date] || []).push(x); });
    for (var i = 0; i < 7; i++) {
      var iso = K.addDays(t0, i), d = new Date(+iso.slice(0, 4), +iso.slice(5, 7) - 1, +iso.slice(8, 10)), ks = map[iso] || [], dw = d.getDay();
      out += '<button type="button" class="wk-d' + (i === 0 ? ' today' : '') + (dw === 0 ? ' sun' : dw === 6 ? ' sat' : '') + (ks.length ? ' has' : '') + '" data-mday="' + iso + '" aria-pressed="false" aria-label="' +
        esc(K.sDate(iso)) + (ks.length ? ' · 일정 ' + ks.length + '건' : ' · 일정 없음') + ' — 누르면 아래에 그날 일정">' +
        '<span class="wk-w">' + (i === 0 ? '오늘' : WK.charAt(dw)) + '</span><span class="wk-n">' + d.getDate() + '</span>' +
        '<span class="wk-evs" aria-hidden="true">' + ks.slice(0, 2).map(function (x) { return '<span class="wk-ev k-' + esc(x.kind) + '">' + esc(x.short || x.title) + '</span>'; }).join('') +
        '</span></button>';   // 점 대신 짧은 이름(공정 이름 등) 2개까지 — 나머지 수(+n)는 안 씀 (날짜를 누르면 아래 목록에 전부)
    }
    return out;
  }

  K.routes.dashboard = view;
})();
