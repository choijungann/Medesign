/* =====================================================================
   관리화면 — 일정 달력
   · 직접 적는 일정(실측·방문, 공사, 상담, 기타)
   · 자동으로 나오는 일정: 계약서의 공사 기간, 하자 현장 확인·보수 날짜, 상담 신청의 희망 상담일
   · 공사일정 화면(#/calendar/k/<계약서 id>): 한 공사만 걸러 보고, 달력에서 끌어서 공정 기간 정하기
   ===================================================================== */
(function () {
  'use strict';
  var K = window.AdminKit;
  if (!K) return;
  var DB = K.DB, I = K.I, esc = K.esc, $ = K.$, $$ = K.$$;
  var app = document.getElementById('app');

  var KINDS = {
    visit: { label: '실측·방문' },
    work: { label: '공사' },
    meet: { label: '상담' },
    defect: { label: '하자' },
    etc: { label: '기타' },
  };
  var MANUAL = ['visit', 'work', 'meet', 'defect', 'etc'];   // 직접 적을 때 고르는 종류 (하자 추가 — 하자 기록 없이 일정만 잡을 때)
  var MAX_SPAN = 120;                             // 공사 기간이 아주 길게 잘못 적혀도 달력이 느려지지 않게

  function parse(iso) { var m = /^(\d{4})-(\d{2})-(\d{2})$/.exec(iso || ''); return m ? new Date(+m[1], +m[2] - 1, +m[3]) : null; }
  function days(a, b) {   // a~b 사이 날짜 목록 (b 없으면 a 하루)
    var out = [], d = parse(a), e = parse(b) || d;
    if (!d) return out;
    if (e < d) e = d;
    for (var i = 0; d <= e && i < MAX_SPAN; i++) { out.push(K.ymd(d)); d = new Date(d.getFullYear(), d.getMonth(), d.getDate() + 1); }
    return out;
  }
  function md(iso) { var m = /^(\d{4})-(\d{2})-(\d{2})$/.exec(iso || ''); return m ? (+m[2]) + '/' + (+m[3]) : ''; }

  /* ---------- 일정 모으기 ---------- */
  function load() {
    return Promise.all([K.soft(DB.listSchedules), K.soft(DB.listContracts), K.soft(DB.listDefects), K.soft(DB.listInquiries), K.soft(DB.listCustomers)])
      .then(function (r) { return { schedules: r[0], contracts: r[1], defects: r[2], inquiries: r[3], customers: r[4] }; });
  }
  // 날짜별 항목: { date, kind, title, sub, time, href, src, id, from, to }
  // 공사명에서 현장(아파트 이름·평수)과 겹치는 말을 빼고 공사 내용만: '○○아파트 24평 도배·장판·필름 공사' → '도배·장판·필름 공사'
  function workDetail(title, site) {
    var st = String(site || '');
    return String(title || '').split(/\s+/).filter(function (w) { return w && !/^\d+(\.\d+)?평$/.test(w) && st.indexOf(w) < 0; }).join(' ');
  }
  function collect(D) {
    var cust = {}; D.customers.forEach(function (c) { cust[c.id] = c; });
    var SL = K.siteLabel || function (x) { return x || ''; };   // 아파트 이름 + 동·호수 + 평수
    function PY() { for (var i = 0; i < arguments.length; i++) { var m = /(\d+(?:\.\d+)?)\s*평/.exec(String(arguments[i] || '')); if (m) return m[1] + '평'; } return ''; }
    // 현장(굵은 글씨): a(계약서 공사 장소·일정 장소)를 먼저, 없으면 b(고객 주소). a에 동·호수가 없는데 b가 같은 아파트이고 동·호수가 있으면 붙임
    function SLU(a, b, py) { return SL(K.fillUnit ? K.fillUnit(a, b) : a, py) || SL(b, py); }
    var out = [];
    function push(list, base) { list.forEach(function (d) { var x = Object.assign({}, base); x.date = d; out.push(x); }); }
    D.schedules.forEach(function (s) {
      var c = s.customer_id && cust[s.customer_id];
      push(days(s.start_on, s.end_on), { kind: s.kind || 'etc', title: s.title, short: s.title, time: s.time || '', sub: [s.place, c ? c.name + ' 고객님' : ''].filter(Boolean).join(' · '),
        site: SLU(s.place, c && c.address, PY(s.place, s.title)), task: s.title, detail: '', who: c ? c.name + ' 고객님' : '', content: s.title,
        src: 'schedule', id: s.id, from: s.start_on, to: s.end_on || s.start_on, memo: s.memo || '' });
    });
    D.contracts.forEach(function (k) {
      if (k.status === 'canceled' || k.status === 'terminated') return;   // 계약 중단·파기는 달력에서 빠짐
      if (!k.start_date && !(Array.isArray(k.phases) && k.phases.some(function (h) { return h && h.name && h.from; }))) return;   // 착공일이 없어도 날짜를 정한 공정은 보임
      var name = k.customer_name ? k.customer_name + ' 고객님' : '';
      var who = k.customer_name || k.title || '계약서', covered = {}, href = '#/contract/' + encodeURIComponent(k.id);
      var kc = k.customer_id && cust[k.customer_id], kpy = PY(k.site, k.title, kc && kc.address), ksite = SLU(k.site, kc && kc.address, kpy), kdet = workDetail(k.title, k.site || ksite);
      (Array.isArray(k.phases) ? k.phases : []).forEach(function (h) {
        if (!h || !h.name || !h.from) return;
        days(h.from, h.to || h.from).forEach(function (d) { covered[d] = true; });
        push(days(h.from, h.to || h.from), { kind: 'work', title: h.name + ' · ' + who, short: h.name, sub: [k.title, '세부 공사일정'].filter(Boolean).join(' · '),
          site: ksite, task: h.name, detail: kdet, who: name, content: h.name,
          src: 'phase', id: k.id + ':' + h.name + ':' + h.from, kid: k.id, href: href, from: h.from, to: h.to || h.from, dim: k.status === 'done' });
      });
      if (k.start_date) push(days(k.start_date, k.end_date || k.start_date).filter(function (d) { return !covered[d]; }), { kind: 'work', title: '공사 · ' + (k.customer_name || k.title || '계약서'), short: k.customer_name || k.title || '공사',
        sub: [k.title, k.status === 'draft' ? '계약 전' : k.status === 'done' ? '공사 완료' : ''].filter(Boolean).join(' · ') || name,
        site: ksite, task: k.status === 'draft' ? '계약 전' : '', detail: kdet, who: name, content: k.items || kdet || k.title || '공사',
        src: 'contract', id: k.id, kid: k.id, href: '#/contract/' + encodeURIComponent(k.id), from: k.start_date, to: k.end_date || k.start_date, dim: k.status === 'done' });
    });
    D.defects.forEach(function (d) {
      var c = cust[d.customer_id], who = c ? c.name || c.phone : '';
      var href = '#/defect/' + encodeURIComponent(d.id);
      var dk = d.contract_id && D.contracts.filter(function (x) { return x.id === d.contract_id; })[0], dpy = PY(dk && dk.site, dk && dk.title, c && c.address);
      var dsite = SLU(dk && dk.site, c && c.address, dpy);
      if (d.check_on) out.push({ date: d.check_on, kind: 'defect', title: '하자 현장 확인 · ' + who, short: '확인 ' + who, sub: d.title, time: d.check_time || '', src: 'defect', id: d.id, href: href, dim: d.status === 'done' || !!d.done_on,
        site: dsite, task: '현장 확인', detail: d.title || '', who: who, content: '현장 확인' + (d.title ? ' · ' + d.title : '') });
      // 하자 보수: 시작일 ~ 끝나는 날
      if (d.repair_on) {
        var rEnd = d.repair_end && d.repair_end > d.repair_on ? d.repair_end : d.repair_on;
        push(days(d.repair_on, rEnd), { kind: 'defect', title: '하자 보수 · ' + who, short: '보수 ' + who, sub: d.title, time: d.repair_time || '', src: 'defect', id: d.id, href: href,
          from: d.repair_on, to: rEnd, dim: d.status === 'done' || !!d.done_on, site: dsite, task: '하자 보수', detail: d.title || '', who: who, content: '하자 보수' + (d.title ? ' · ' + d.title : '') });
      }
    });
    D.inquiries.forEach(function (q) {
      if (!q.preferred_date || q.status === 'dropped') return;   // 상담 포기한 신청은 달력에서 뺌
      out.push({ date: q.preferred_date, kind: 'meet', title: '상담 희망 · ' + q.name, short: q.name, sub: [q.method, q.region].filter(Boolean).join(' · '),
        site: SL(q.site_name, q.size), task: (q.method || '상담') + ' 희망', detail: (q.scopes || []).join(', '), who: q.name ? q.name + ' 고객님' : '', content: q.method || '상담',
        time: q.preferred_time || '', src: 'inquiry', id: q.id, href: '#/inquiries', dim: q.status === 'done' });
    });
    out.sort(function (a, b) { return a.date === b.date ? timeKey(a.time).localeCompare(timeKey(b.time)) : a.date.localeCompare(b.date); });
    return out;
  }
  // '오전 10시', '14:00', '오후 2시 반' 등을 대략 순서대로 (시간 없는 건 맨 앞)
  function timeKey(t) {
    t = String(t || '');
    if (!t) return '00';
    var m = /(\d{1,2})(?::(\d{2}))?/.exec(t), h = m ? +m[1] : 12, mi = m && m[2] ? +m[2] : 0;
    if (/오후|저녁|밤/.test(t) && h < 12) h += 12;
    if (!m && /오후/.test(t)) h = 13;
    if (!m && /오전/.test(t)) h = 9;
    return '1' + String(h).padStart(2, '0') + String(mi).padStart(2, '0');
  }

  /* ---------- 처음 화면에 쓰는 '다가오는 일정' ---------- */
  // D: 이미 불러 둔 { schedules, contracts, defects, inquiries, customers } 가 있으면 다시 불러오지 않음
  // 종류 이름표(하자·공사·상담·실측)가 붙는 곳에서는 제목에서 같은 말을 뺌 — 예) [하자] 현장 확인 · 박○○, [공사] 이○○, [상담] 김○○ · 희망일
  function labelTitle(kind, t) {
    var o = String(t || '').trim(), s0 = o;
    if (kind === 'defect') s0 = s0.replace(/^하자\s*/, '');
    else if (kind === 'work') s0 = s0.replace(/^공사\s*·\s*/, '');
    else if (kind === 'meet') s0 = /^상담\s*희망\s*·\s*/.test(s0) ? s0.replace(/^상담\s*희망\s*·\s*/, '') + ' · 희망일' : s0.replace(/\s*상담(\s*\([^)]*\))?$/, '$1');
    else if (kind === 'visit') s0 = s0.replace(/\s*(실측|방문)(\s*\([^)]*\))?$/, '$2').replace(/^(실측|방문)\s*·?\s*/, '');
    return s0.trim() || o;
  }
  function upcoming(n, D0) { var t0 = K.today(); return rangeRows(t0, K.addDays(t0, (n || 7) - 1), D0); }
  // 첫 화면 작은 달력에서 고른 날 하루의 일정 (같은 모양의 줄)
  function dayRows(day, D0) { return rangeRows(day, day, D0); }
  function rangeRows(t0, t1, D0) {
    var today = K.today(), tomorrow = K.addDays(today, 1);
    return (D0 ? Promise.resolve(D0) : load()).then(function (D) {
      var seen = {}, list = [], grp = {};
      function dl(d) { return d === today ? '오늘' : d === tomorrow ? '내일' : K.sDate(d).replace(/^(\d+)월 (\d+)일/, '$1/$2'); }
      collect(D).forEach(function (x) {
        if (x.date < t0 || x.date > t1 || x.dim) return;
        var key = x.src + ':' + x.id + (x.src === 'defect' ? ':' + x.title : '');
        if (seen[key]) return;      // 여러 날짜에 걸친 공사는 한 번만
        seen[key] = true;
        var ongoing = x.from && x.from < t0;
        // 같은 공사(계약서)의 같은 날 공정은 한 줄로 합침 — 오늘 줄에 '철거·전기공사·도배' (전부터 이어지는 공정도 같이), 내일 시작하는 공정은 내일 줄에
        var gk = x.kid ? x.kid + '@' + x.date : '';
        if (gk && grp[gk]) {
          grp[gk].parts.push(x.src === 'phase' ? { n: x.task, len: spanDays(x.from, x.to) } : null);
          if (!ongoing) { grp[gk].row.dayLabel = dl(x.date); grp[gk].row.href = '#/calendar/k/' + encodeURIComponent(x.kid); }
          return;
        }
        // 공사일정은 '공사일정' 화면, 직접 적은 일정은 달력에서 '고치기' 창 (계약서 작성 화면으로 가지 않음)
        var day = x.date < t0 ? t0 : x.date;
        var href = x.kid ? '#/calendar/k/' + encodeURIComponent(x.kid) : x.src === 'schedule' ? '#/calendar/' + day + '/s/' + encodeURIComponent(x.id) : (x.href || '#/calendar/' + x.date.slice(0, 7));
        // 첫 화면 한 줄: 굵게 = 현장(아파트 이름 + 동·호수, 없으면 고객·제목) / 아래 = 시간 · 할 일 · 상세 공사 내용
        var big = x.site || (x.src === 'schedule' ? x.title : x.who) || labelTitle(x.kind, x.title);
        var line2 = [x.time, x.site || x.src !== 'schedule' ? x.task : '', x.detail, !x.site && x.src === 'schedule' ? x.who : ''].filter(Boolean).join(' · ');
        // 새 모양(첫 화면): 맨 위 시간(작게) / 현장(굵게, 없으면 고객·제목) / 내용(하자 내용 · 공정 이름 · 전화·방문 상담 · 일정 내용)
        var cnt = x.content && x.content !== big ? x.content : '';
        var row = { kind: x.kind, title: x.title, plain: labelTitle(x.kind, x.title), big: big, line2: line2, time: x.time || '', content: cnt, href: href, today: x.date === today,
          dayLabel: ongoing ? '진행 중' : dl(x.date),
          sub: [x.time, x.sub, x.to && x.to !== x.from ? '~' + md(x.to) : ''].filter(Boolean).join(' · ') };
        list.push(row);
        if (gk) grp[gk] = { row: row, big: big, parts: [x.src === 'phase' ? { n: x.task, len: spanDays(x.from, x.to) } : null] };
      });
      Object.keys(grp).forEach(function (k) {
        var g = grp[k], names = [];
        g.parts.filter(Boolean).map(function (p, i) { p.i = i; return p; }).sort(function (a, b) { return b.len - a.len || a.i - b.i; })   // 긴 공정(장기)부터
          .forEach(function (p) { if (names.indexOf(p.n) < 0) names.push(p.n); });
        if (names.length > 1) g.row.content = names.join('·');
      });
      return list;
    });
  }

  /* =====================================================================
     달력 화면
     ===================================================================== */
  function viewCalendar(args) {
    // #/calendar/2026-10 · #/calendar/2026-10-30 (그날 고르기) · …/s/<일정 id> (일정 고치기) · #/calendar/k/<계약서 id>[/2026-10] (공사일정 화면)
    if (args[0] === 'k') return viewJob(decodeURIComponent(args[1] || ''), args[2]);
    if (args[1] === 'work' && args[2]) {   // 예전 주소(…/work/<계약서 id>) → 공사일정 화면
      var h = '#/calendar/k/' + args[2];
      K.setHash(h);
      return viewJob(decodeURIComponent(args[2]));
    }
    if (/^\d{4}-\d{2}-\d{2}$/.test(args[0] || '')) K.state.calDay = args[0];
    var mon = /^\d{4}-\d{2}(-\d{2})?$/.test(args[0] || '') ? args[0].slice(0, 7) : (K.state.calMonth || K.today().slice(0, 7));
    var openAfter = (args[1] === 's' || args[1] === 'q') && args[2] ? { type: args[1], id: decodeURIComponent(args[2]) } : null;   // s: 일정 고치기, q: 상담 신청으로 일정 추가
    K.state.calMonth = mon;
    K.frame('일정 달력', false, 'calendar');
    app.innerHTML = '<div class="page"><div class="loading">불러오는 중…</div></div>';
    load().then(function (D) {
      var items = collect(D);
      var page = document.createElement('div');
      page.className = 'page cal-page cal-month';
      app.innerHTML = ''; app.appendChild(page);
      var sel = K.state.calDay && K.state.calDay.slice(0, 7) === mon ? K.state.calDay : (K.today().slice(0, 7) === mon ? K.today() : mon + '-01');

      function byDay() { var o = {}; items.forEach(function (x) { (o[x.date] = o[x.date] || []).push(x); }); return o; }
      function draw() {
        var map = byDay();
        var y = +mon.slice(0, 4), m = +mon.slice(5, 7);
        var first = new Date(y, m - 1, 1), start = new Date(y, m - 1, 1 - first.getDay());
        var cells = '';
        for (var i = 0; i < 42; i++) {
          var d = new Date(start.getFullYear(), start.getMonth(), start.getDate() + i), iso = K.ymd(d), list = map[iso] || [];
          if (i === 35 && d.getMonth() !== m - 1) break;   // 마지막 줄이 다음 달뿐이면 그리지 않음
          var cls = 'cal-cell' + (d.getMonth() !== m - 1 ? ' out' : '') + (iso === K.today() ? ' today' : '') + (iso === sel ? ' sel' : '') +
            (d.getDay() === 0 ? ' sun' : d.getDay() === 6 ? ' sat' : '');
          cells += '<button type="button" class="' + cls + '" data-day="' + iso + '" data-n="' + list.length + '" aria-label="' + esc(K.sDate(iso)) + (list.length ? ' 일정 ' + list.length + '건' : '') + '"' + (iso === sel ? ' aria-pressed="true"' : '') + '>' +
            '<span class="cal-n">' + d.getDate() + '</span><span class="cal-evs">' +
            // 휴대폰은 2개(짧은 이름), 태블릿·PC는 3개까지 — 넓은 화면(왼쪽 달력)은 칸 높이에 들어가는 만큼(6개까지) fitCal 이 골라 보여 줌
            list.slice(0, 6).map(function (x, j) { return '<span class="ev k-' + esc(x.kind) + (x.dim ? ' dim' : '') + (j === 1 ? ' ev2' : j === 2 ? ' ev3' : j > 2 ? ' evx' : '') + '"><em class="s">' + esc(x.short || x.title) + '</em><em class="f">' + esc(x.title) + '</em></span>'; }).join('') +
            (list.length > 1 ? '<span class="ev more c"><em>+' + (list.length - 1) + '</em></span>' : '') +   // 칸이 낮은 컴퓨터(넓은 화면): 1개 + 나머지 수
            (list.length > 2 ? '<span class="ev more m"><em>+' + (list.length - 2) + '</em></span>' : '') +
            (list.length > 3 ? '<span class="ev more d"><em>+' + (list.length - 3) + '</em></span>' : '') +
            (list.length > 1 ? '<span class="ev more x"><em></em></span>' : '') + '</span></button>';   // 넓은 화면: 넘치는 수 (fitCal 이 채움)
        }
        var prev = K.ymd(new Date(y, m - 2, 1)).slice(0, 7), next = K.ymd(new Date(y, m, 1)).slice(0, 7);
        var dayList = map[sel] || [];
        // 넓은 화면(1100px~): 왼쪽 달력(세로로 길게) · 오른쪽 고른 날 일정 목록
        page.innerHTML = '<div class="cal-main">' +
          '<div class="cal-top"><div class="cal-nav">' +
          '<a class="icon-btn" href="#/calendar/' + prev + '" data-replace aria-label="이전 달">' + I.left + '</a>' +
          '<h2>' + y + '년 ' + m + '월</h2>' +
          '<a class="icon-btn" href="#/calendar/' + next + '" data-replace aria-label="다음 달">' + I.right + '</a></div>' +
          (mon !== K.today().slice(0, 7) ? '<a class="btn btn-outline btn-sm cal-today" href="#/calendar/' + K.today().slice(0, 7) + '" data-replace>오늘로</a>' : '') +
          '<button type="button" class="btn btn-primary cal-add" data-add>' + I.plus + '일정 추가</button></div>' +
          (jobList(D).length ? '<div class="field cal-job"><span class="label" id="cal-job-l">공사별로 보기</span>' + K.finderField('cal-job', { ph: '공사 찾아서 그 공사일정만 보기', labelledby: 'cal-job-l' }) + '</div>' : '') +
          '<div class="cal-legend">' + ['visit', 'work', 'meet', 'defect', 'etc'].map(function (k) { return '<span><i class="k-' + k + '"></i>' + KINDS[k].label + '</span>'; }).join('') + '</div>' +
          '<div class="cal-grid" role="grid"><div class="cal-wk">' + '일월화수목금토'.split('').map(function (w, i) { return '<span' + (i === 0 ? ' class="sun"' : i === 6 ? ' class="sat"' : '') + '>' + w + '</span>'; }).join('') + '</div>' +
          '<div class="cal-days" style="--rows:' + Math.round((cells.match(/class="cal-cell/g) || []).length / 7) + '">' + cells + '</div></div></div>' +
          '<section class="cal-day" id="cal-day"><div class="cal-day-head"><h2>' + esc(K.sDate(sel)) + (sel === K.today() ? ' <small>오늘</small>' : '') + '</h2>' +
          '<button type="button" class="btn btn-outline btn-sm" data-add="' + sel + '">' + I.plus + '이 날 일정 추가</button></div>' +
          (dayList.length ? '<ul class="cal-list">' + dayList.map(itemHtml).join('') + '</ul>'
            : '<div class="empty-box">이 날은 일정이 없어요.</div>') + '</section>';
        fitCal();
      }
      function itemHtml(x) {
        // 여러 날 일정은 '시작일 / ~끝나는 날' 두 줄로 (한 줄이면 칸을 넘침)
        var when = x.time ? esc(x.time) : x.from && x.to && x.from !== x.to ? '<span>' + esc(md(x.from)) + '</span><span>~' + esc(md(x.to)) + '</span>' : '하루';
        // 줄: ① 할 일(공정 이름 · 현장 확인 · 하자 보수 · 방문/전화 상담 · 일정 제목) + 아파트 이름 ② 현장(아파트 이름 + 평수, 동·호수) ③ 세부 내용(하자 내용 · 공사 항목 · 고른 공사) ④ 메모 ⑤ 맨 아래 고객 이름
        var apt = String(x.site || '').split(',')[0].replace(/\s*\d+(?:\.\d+)?\s*평\s*$/, '').trim();
        var task = x.src === 'defect' ? x.task : x.src === 'schedule' ? labelTitle(x.kind, x.title) : (x.content || x.task || labelTitle(x.kind, x.title));
        var who = x.src === 'defect' && x.who && !/\d{3}/.test(x.who) ? x.who + ' 고객님' : x.who;
        var det = (x.src === 'defect' || x.src === 'inquiry' ? [x.detail] : x.src === 'schedule' ? []
          : [x.src === 'contract' ? x.task : '', x.src === 'phase' ? x.detail : '']).filter(Boolean).join(' · ');
        var inner = '<span class="cal-time">' + when + '</span>' +
          '<span class="cal-kind k-' + esc(x.kind) + '">' + esc(KINDS[x.kind] ? KINDS[x.kind].label : '기타') + '</span>' +
          '<span class="cal-t"><b>' + esc([task, apt].filter(Boolean).join(' · ') || labelTitle(x.kind, x.title)) + '</b>' +
          (x.site ? '<small class="c-site">' + esc(x.site) + '</small>' : '') + (det ? '<small>' + esc(det) + '</small>' : '') +
          (x.memo ? '<small class="memo">' + esc(x.memo) + '</small>' : '') + (who ? '<small class="c-who">' + esc(who) + '</small>' : '') + '</span>';
        if (x.src === 'schedule') return '<li class="' + (x.dim ? 'dim' : '') + '"><button type="button" data-edit="' + esc(x.id) + '">' + inner + '<span class="go">고치기</span></button></li>';
        if (x.src === 'defect') return '<li class="' + (x.dim ? 'dim' : '') + '"><button type="button" data-dedit="' + esc(x.id) + '">' + inner + '<span class="go">고치기</span></button></li>';
        if (x.src === 'inquiry') return '<li class="' + (x.dim ? 'dim' : '') + '"><button type="button" data-qedit="' + esc(x.id) + '">' + inner + '<span class="go">고치기</span></button></li>';   // 상담 희망일: 오른쪽 창에서 날짜·시간 고치기   // 하자 일정: 화면 이동 없이 오른쪽 창에서 날짜·시간 고치기
        if (x.kid) return '<li class="' + (x.dim ? 'dim' : '') + '"><a href="#/calendar/k/' + encodeURIComponent(x.kid) + '">' + inner + '<span class="go">공사일정</span></a></li>';
        return '<li class="' + (x.dim ? 'dim' : '') + '"><a href="' + esc(x.href) + '">' + inner + '<span class="go">열기</span></a></li>';
      }
      draw();
      // 넓은 화면: 달력 칸 높이를 이 컴퓨터의 창 높이에 맞춤 (화면 배율·창 크기가 컴퓨터마다 달라서 그때그때 계산 — 맨 아랫줄이 잘리지 않게)
      function fitCal() {
        if (!page.isConnected) { window.removeEventListener('resize', onFit); return; }
        var g = $('.cal-days', page); if (!g) return;
        page.style.setProperty('--cal-off', Math.round(g.getBoundingClientRect().top + window.scrollY + 28) + 'px');
        // 칸마다 보이는 일정 수 = 그 칸 높이에 실제로 들어가는 만큼 (재서 정함 — 전에는 칸 높이 구간으로 3·2·1개라 빈자리가 남았음)
        // 다 안 들어가면 들어가는 만큼만 보이고 나머지 수 '+n'은 날짜 옆 오른쪽 위에 (줄을 따로 쓰지 않아 한 개라도 더 보이게)
        var c = $('.cal-cell', g), h = c ? c.getBoundingClientRect().height : 999, wide = window.innerWidth >= 1100;
        page.classList.remove('fit1', 'fit2');
        page.classList.toggle('fitjs', wide);
        if (!wide) return;
        $$('.cal-cell', g).forEach(function (cell) {
          var n = +cell.getAttribute('data-n') || 0, evs = $$('.ev:not(.more)', cell), mx = $('.ev.more.x', cell);
          if (!evs.length) return;
          evs.forEach(function (e) { e.classList.remove('xh'); }); if (mx) mx.classList.add('xh');
          var box = $('.cal-evs', cell), cb = cell.getBoundingClientRect(), cs = getComputedStyle(cell);
          var avail = cb.bottom - (parseFloat(cs.paddingBottom) || 0) - (parseFloat(cs.borderBottomWidth) || 0) - box.getBoundingClientRect().top;
          var gap = parseFloat(getComputedStyle(box).rowGap) || 2, eh = evs[0].getBoundingClientRect().height + gap;
          if (n <= evs.length && n * eh - gap <= avail + 0.5) return;   // 다 들어감
          var k = Math.max(1, Math.min(evs.length, Math.floor((avail + gap + 0.5) / eh)));
          evs.forEach(function (e, i) { e.classList.toggle('xh', i >= k); });
          if (mx) { mx.classList.remove('xh'); $('em', mx).textContent = '+' + (n - k); }
        });
      }
      var fitT = null;
      function onFit() { clearTimeout(fitT); fitT = setTimeout(fitCal, 120); }
      window.addEventListener('resize', onFit);

      page.addEventListener('click', function (e) {
        var t = e.target, x;
        if ((x = t.closest('[data-day]'))) {
          sel = x.getAttribute('data-day'); K.state.calDay = sel;
          if (sel.slice(0, 7) !== mon) { K.replaceTo('#/calendar/' + sel.slice(0, 7)); return; }
          draw();
          var box = $('#cal-day', page);
          if (box && window.innerWidth < 1100) box.scrollIntoView({ behavior: 'smooth', block: 'start' });   // 넓은 화면은 오른쪽에 바로 보임
          return;
        }
        if ((x = t.closest('[data-add]'))) return openForm(null, x.getAttribute('data-add') || sel, D, reload);
        if ((x = t.closest('[data-qedit]'))) {
          var qq = (D.inquiries || []).filter(function (z) { return z.id === x.getAttribute('data-qedit'); })[0];
          if (qq) openInquiryForm(qq, reload);
          return;
        }
        if ((x = t.closest('[data-dedit]'))) {
          var dd = (D.defects || []).filter(function (z) { return z.id === x.getAttribute('data-dedit'); })[0];
          if (dd) openDefectForm(dd, D, reload);
          return;
        }
        if ((x = t.closest('[data-edit]'))) {
          var s = D.schedules.filter(function (z) { return z.id === x.getAttribute('data-edit'); })[0];
          if (s) openForm(s, null, D, reload);
        }
      });
      page.addEventListener('click', function (e) { var b = e.target.closest('[data-fdopen="cal-job"]'); if (b) openJobFinder(D, '', b, ''); });
      // 첫 화면·고객 화면에서 일정을 눌러 들어왔으면 그 일정의 고치기 창을 바로 열고, 주소는 달력으로 돌려 둠
      if (openAfter) {
        var plain = '#/calendar/' + mon;
        K.setHash(plain);
        if (openAfter.type === 'q') {
          var q0 = D.inquiries.filter(function (z) { return z.id === openAfter.id; })[0];
          if (q0) openForm(null, sel, D, reload, inquiryPreset(q0, D));
        } else { var s0 = D.schedules.filter(function (z) { return z.id === openAfter.id; })[0]; if (s0) openForm(s0, null, D, reload); }
      }
      function reload(focusDay) {
        if (focusDay) { K.state.calDay = focusDay; if (focusDay.slice(0, 7) !== mon) return K.replaceTo('#/calendar/' + focusDay.slice(0, 7)); sel = focusDay; }
        load().then(function (D2) { D = D2; items = collect(D); draw(); });
      }
    }).catch(function (err) {
      app.innerHTML = '<div class="page"><div class="empty-box">일정을 불러오지 못했어요.<br>' + esc(K.friendlyError(err)) + '</div></div>';
    });
  }

  // 상담 신청 카드의 '일정 등록': 희망 상담일·시간, 지역·현장, 같은 전화번호 고객을 채운 일정 (방문 상담이면 실측·방문)
  // '무슨 일정인가요?' 칸의 종류별 예시와, 비워 두고 저장할 때 들어가는 이름
  var TPH = { visit: '예) 안방 붙박이장 길이 실측', meet: '예) 주방 상판 색 고르기', work: '예) 타일 자재 들어오는 날', defect: '예) 욕실 실리콘 다시 쏘기', etc: '예) 타일 자재 고르러 가기' };
  var TDEF = { visit: '실측', meet: '상담', work: '공사', defect: '하자 보수', etc: '일정' };
  function inquiryPreset(q, D) {
    var dg = String(q.phone || '').replace(/[^0-9]/g, ''), cu = (D.customers || []).filter(function (c) { return dg && String(c.phone || '').replace(/[^0-9]/g, '') === dg; })[0];
    var visit = /방문/.test(q.method || '');
    return { kind: visit ? 'visit' : 'meet', title: q.method || (visit ? '방문 상담' : '상담'), time: q.preferred_time || '',   // 고객 이름은 고객 칸에 (제목에 넣지 않음)
      place: [q.region, q.site_name].filter(Boolean).join(' '), customer_id: cu ? cu.id : null, qid: q.id,
      memo: ['상담 신청: ' + [q.space_type, q.size ? q.size : '', (q.scopes || []).join(', ')].filter(Boolean).join(' · '), q.budget ? '예산 ' + q.budget : '', q.phone ? '연락처 ' + q.phone : ''].filter(function (x) { return x && x !== '상담 신청: '; }).join('\n') };
  }

  /* ---------- 일정 적기·고치기 (아래에서 올라오는 창) ---------- */
  function openForm(rec, day, D, done, preset) {
    var isNew = !rec;
    rec = rec || Object.assign({ start_on: day || K.today(), end_on: null, time: '', title: '', kind: 'visit', place: '', memo: '', customer_id: null }, preset || {});
    var custs = (D.customers || []).slice();   // 최근 고친 순 (찾아서 고르기 창의 '최근')
    function custOf(id) { return id ? custs.filter(function (c) { return c.id === id; })[0] || null : null; }
    var ov = document.createElement('div');
    ov.className = 'overlay sf-ov';   // 넓은 화면: 오른쪽에 붙어서 왼쪽 달력을 보면서 적을 수 있게
    ov.innerHTML = '<form class="sheet form-sheet" role="dialog" aria-modal="true" aria-labelledby="sf-t" novalidate>' +
      '<h3 id="sf-t">' + (isNew ? '일정 추가' : '일정 고치기') + '</h3>' +
      // 종류는 맨 위 (고르는 종류에 따라 아래 칸이 바뀌어도 종류 자리는 그대로)
      '<div class="field sf-kindf"><span class="label" id="sf-kind-l">종류</span><div class="choices sf-kinds" role="radiogroup" aria-labelledby="sf-kind-l">' + MANUAL.map(function (k) {
        return '<label class="choice"><input type="radio" name="sf-kind" value="' + k + '"' + (rec.kind === k ? ' checked' : '') + '><span>' + KINDS[k].label + '</span></label>';
      }).join('') + '</div></div>' +
      // 찾기 칸은 종류 바로 아래 한 칸으로 통일 — 종류와 상관없이 견적서·계약서·고객을 탭으로 나눠 찾음
      // 고른 것에서 공사면 계약서, 하자·상담이면 고객을 알아내서 일원화 (없으면 아래 체크: 계약서 없는 공사 / 고객 없는 하자 / 고객 없는 상담)
      '<div class="field sf-imp"><span class="sr-only" id="sf-imp-l">견적서·계약서·고객 찾기</span>' +
      K.finderField('sf-imp', { ph: '견적서·계약서·고객 찾기', labelledby: 'sf-imp-l', clear: '고른 것 풀기 (고객 연결 안 함)' }) +
      '<label class="sf-none" id="sf-none-w" hidden><input type="checkbox" id="sf-none"><span id="sf-none-t"></span></label>' +   // 체크하면 아래 칸이 풀려 따로 적음
      '<p class="hint" id="sf-imp-h" hidden></p></div>' +
      // 공사 + 계약서를 불러오면: 공사일정 화면의 '새 공정 추가'와 같은 칸(공정 이름 · 자주 쓰는 공정 · 날짜) → 그 계약서의 세부 공사일정에 들어감
      '<div class="sf-kpick" hidden></div>' +   // 고른 고객의 계약서가 여럿이면 여기서 한 번 더 고름
      '<div class="sf-ph" hidden>' +
      '<div class="field"><label for="sf-pname">공정 이름</label><input class="input" id="sf-pname" maxlength="30" placeholder="예) 전기공사" autocomplete="off"></div>' +
      '<div class="ap-chips" id="sf-pchips" role="group" aria-label="자주 쓰는 공정"></div>' +
      '<div class="field"><span class="label" id="sf-pdl">날짜</span><button type="button" class="jp-datebtn" data-sfpdate aria-describedby="sf-pdl">' + I.cal + '<span class="jp-date" id="sf-pdate"></span><span class="jp-dgo">바꾸기</span></button></div>' +
      '</div>' +
      // 공사는 계약서의 공사일정으로 일원화: 계약서를 고르거나 '계약서 없는 공사'에 체크해야 아래 칸이 풀림
      // 하자·상담도 고객이 있으면 일원화: 하자는 그 고객의 하자 기록(현장 확인·하자 보수 날짜)으로, 상담은 그 고객의 상담 신청(상담 날짜)으로 — '고객 없음'에 체크하면 따로 적기
      '<div class="sf-link" hidden><div class="sf-lbody"></div></div>' +
      '<div class="sf-man">' +
      '<div class="field"><label for="sf-title">무슨 일정인가요?</label><input class="input" id="sf-title" maxlength="120" value="' + esc(rec.title) + '" placeholder="' + esc(TPH[rec.kind] || TPH.etc) + '"></div>' +
      '<div class="sf-row"><div class="field"><label for="sf-start">날짜</label><input class="input" type="date" id="sf-start" value="' + esc(rec.start_on) + '"></div>' +
      '<div class="field"><label for="sf-end">끝나는 날 <span class="opt">(여러 날이면)</span></label><input class="input" type="date" id="sf-end" data-min-from="sf-start" value="' + esc(rec.end_on || '') + '"></div></div>' +
      '<div class="field"><label for="sf-time">시간 <span class="opt">(선택)</span></label><input class="input" id="sf-time" data-time data-ph="시간 고르기" maxlength="20" value="' + esc(rec.time) + '" placeholder="예) 오전 10시"></div>' +
      '<div class="field"><label for="sf-place">장소 <span class="opt">(선택)</span></label><input class="input" id="sf-place" maxlength="120" value="' + esc(rec.place) + '" placeholder="예) 송파구 ○○아파트 101동"></div>' +
      // 고객은 위 찾기 칸 하나로 (고객 · 견적서 · 계약서를 고르면 그 고객이 연결됨) — 아래에 고객 칸을 따로 두지 않음
      '<div class="field"><label for="sf-memo">메모 <span class="opt">(선택)</span></label><textarea class="textarea" id="sf-memo" rows="3" maxlength="1000">' + esc(rec.memo) + '</textarea></div>' +
      '</div>' +
      '<p class="msg error-msg" id="sf-msg" hidden></p>' +
      '<div class="btn-row"><button class="btn btn-outline" type="button" data-close>닫기</button><button class="btn btn-primary" type="submit">저장</button></div>' +
      (isNew ? '' : '<button class="btn btn-text-danger sf-del" type="button" data-sdel>이 일정 지우기</button>') +
      '</form>';
    document.body.appendChild(ov);
    var form = $('form', ov);
    // 휴대폰은 열자마자 자판이 올라와 위의 '불러오기'를 가리므로, 마우스 쓰는 화면에서만 제목 칸에 바로 커서
    if (window.matchMedia && matchMedia('(hover: hover) and (pointer: fine)').matches) setTimeout(function () { $('#sf-title', ov).focus(); }, 60);
    function close() { ov.remove(); }

    /* ----- 견적서·계약서에서 불러오기: 일정 이름·장소·고객 채우기 ----- */
    var src = [];
    function md(d) { var m = /^\d{4}-(\d{2})-(\d{2})/.exec(d || ''); return m ? (+m[1]) + '/' + (+m[2]) : ''; }
    function pickedKind() { return (($('input[name=sf-kind]:checked', ov) || {}).value) || 'etc'; }
    var srcP = K.soft(DB.listEstimates).then(function (ests) {
      var EK = window.EstimateKit;
      ests.forEach(function (e) {
        var st = EK ? EK.stageOf(e, D.contracts || []) : (e.status === 'stopped' ? 'stopped' : 'open');
        if (st === 'stopped') return;
        src.push({ id: 'e:' + e.id, group: '견적서', di: K.dealItem('e', e), name: e.customer_name || '', title: e.title || '', place: [e.region, e.site_name].filter(Boolean).join(' ') + (e.site_unit ? ', ' + e.site_unit : ''),
          spot: e.site_name || '', customer_id: e.customer_id || null, phone: e.customer_phone || '', when: e.estimate_date || String(e.created_at || '').slice(0, 10), label: (st === 'won' ? '계약됨 · ' : '') + '견적 ' + md(e.estimate_date || String(e.created_at || '').slice(0, 10)) });
      });
      (D.contracts || []).forEach(function (k) {
        if (k.status === 'canceled' || k.status === 'terminated') return;
        var site = k.site || '', sp = site.split(/\s+/);
        src.push({ id: 'k:' + k.id, group: '계약서', di: K.dealItem('k', k), name: k.customer_name || '', title: k.title || '', place: site, spot: sp.slice(2).join(' ') || site,
          customer_id: k.customer_id || null, phone: k.customer_phone || '', when: k.start_date || '', label: (function () { var r = K.workRange ? K.workRange(k) : null; return r ? '공사 ' + md(r.from) + '~' + md(r.to) : '공사 날짜 미정'; })() });
      });
      custs.forEach(function (c) {   // 고객 탭 (최근 고친 순)
        src.push({ id: 'c:' + c.id, group: '고객', di: { label: c.name || '이름 없음', sub: [c.phone, c.address].filter(Boolean).join(' · ') }, name: c.name || '', title: '', place: c.address || '', spot: '', customer_id: c.id, phone: c.phone || '', when: String(c.updated_at || c.created_at || ''), label: [c.phone, c.address].filter(Boolean).join(' · ') });
      });
      src.loaded = true;
      if (!src.length && $('.sf-imp', ov)) $('.sf-imp', ov).hidden = true;
      src.sort(function (a, b) { return String(b.when).localeCompare(String(a.when)); });   // 탭마다 최근 순
      return src;
    });
    var IMP_PH = '견적서·계약서·고객 찾기', TAB0 = { work: '계약서', defect: '고객', meet: '고객' };
    // 목록 한 줄: 견적서·계약서는 현장 / 품목 · 기간 · 고객 이름, 고객은 고객 이름 / 전화번호 · 주소 (K.dealItem)
    function srcLabel(x) { return x.di.label + (x.di.sub ? ' · ' + x.di.sub : ''); }
    ov.addEventListener('click', function (e) {
      var b;
      if ((b = e.target.closest('[data-fdopen="sf-imp"]'))) {   // 처음 여는 탭만 종류에 맞게 (공사 → 계약서, 하자·상담 → 고객, 그 밖 → 견적서)
        return K.finder({ title: IMP_PH, ph: '고객 이름·전화번호·현장으로 찾기', cur: impId(), focus: b, tabs: true, tab: TAB0[pickedKind()] || '견적서',
          items: srcP.then(function (l) { return l.map(function (x) { return { id: x.id, tag: x.group, tagKey: x.id.charAt(0), label: x.di.label, sub: x.di.sub, keys: [x.name, x.phone, x.place].join(' ') }; }); }),
          onPick: function (it) { if (!it) return; none[pickedKind()] = false; K.finderSet(ov, 'sf-imp', it.id, it.label + (it.sub ? ' · ' + it.sub : '')); applyImport(it.id); } });
      }
      if (e.target.closest('[data-fdclear="sf-imp"]')) { K.finderSet(ov, 'sf-imp', '', '', IMP_PH); phMode(); }   // ✕: 고른 것 풀기 (고객 연결도 끊김)
    });
    ov.addEventListener('change', function (e) {
      if (e.target.name === 'sf-kind') {   // 불러온 제목을 그대로 두었으면 종류에 맞게 바꿔 줌 (실측 ↔ 상담 ↔ 공사)
        $('#sf-title', ov).placeholder = TPH[pickedKind()] || TPH.etc;   // 종류에 맞는 예시 (예: 실측이면 '안방 붙박이장 길이 실측')
        phMode();
        return;
      }
    });
    function applyImport(xid) {
      var x = srcOf(xid);
      if (!x) return;
      // 일정 이름은 채우지 않음 — 고객·현장은 아래 칸과 목록에 따로 나오므로 '무슨 일정인가요?'에는 할 일만 (예: 안방 붙박이장 길이 실측)
      // 장소는 고른 견적서·계약서·고객 것으로 바로 바꿈 — 새 일정이든 고치는 일정이든 묻지 않음
      var el = $('#sf-place', ov);
      if (el && x.place) el.value = x.place;
      phMode();
    }

    /* ----- 공정 모드 (새 일정 + 종류 공사 + 계약서를 불러옴): 공사일정 화면의 '새 공정 추가'와 같은 칸 ----- */
    var ph = { on: false, kid: '', from: '', to: '', picked: false, chips: false, gate: false, ksel: '', kfor: '', multi: false };
    function impId() { var h = $('#sf-imp', ov); return h ? h.value : ''; }
    /* ----- 하자·상담 일원화 ----- */
    var lk = { cust: '', target: '', step: 'check', on: false, hydrated: false, qid: preset && preset.qid || '' };
    var none = { work: false, defect: false, meet: false };   // 종류별 '없음' 체크 (계약서 없는 공사 · 고객 없는 하자 · 고객 없는 상담)
    // 따로 적어 둔 일정을 고칠 때는 '없음'에 체크된 채로 열어서 바로 고칠 수 있게 (위에서 계약서·고객을 고르면 그쪽으로 옮김). 고객이 연결된 하자·상담은 그 고객으로
    if (!isNew) none[rec.kind] = rec.kind === 'work' || !custOf(rec.customer_id);
    var NONE_T = { work: '계약서 없는 공사', defect: '고객 없는 하자', meet: '고객 없는 상담' };
    function digits(v) { return String(v || '').replace(/[^0-9]/g, ''); }
    function cLabel(c) { return (c.name || '이름 없음') + ([c.phone, c.address].filter(Boolean).length ? ' · ' + [c.phone, c.address].filter(Boolean).join(' · ') : ''); }
    function srcOf(id) { return src.filter(function (z) { return z.id === id; })[0] || null; }
    // 고른 것의 고객: 고객이면 그대로, 견적서·계약서면 연결된 고객 → 없으면 같은 전화번호 고객
    function custOfSrc(x) {
      if (x.customer_id && custOf(x.customer_id)) return x.customer_id;
      var dg = digits(x.phone), c0 = dg ? custs.filter(function (c) { return digits(c.phone) === dg; })[0] : null;
      return c0 ? c0.id : '';
    }
    function impCust() {
      var id = impId(); if (!id) return '';
      if (/^c:/.test(id)) return custOf(id.slice(2)) ? id.slice(2) : '';
      var x = srcOf(id); return x ? custOfSrc(x) : '';
    }
    function activeK(k) { return k && k.status !== 'canceled' && k.status !== 'terminated'; }
    // 고른 것의 공사 계약서: 계약서면 그대로, 견적서면 그 견적서로 만든 계약서, 고객이면 그 고객의 가장 최근 계약서
    // 고른 것의 공사 계약서 후보: 계약서면 그 계약서, 견적서면 그 견적서로 만든 계약서, 고객이면 그 고객(같은 전화번호 포함)의 계약서 — 최근 공사 순
    function impKs() {
      var id = impId(); if (!id) return [];
      if (/^k:/.test(id)) return [id.slice(2)];
      var ks = (D.contracts || []).filter(activeK), hit;
      if (/^e:/.test(id)) hit = ks.filter(function (k) { return k.estimate_id === id.slice(2); });
      else {
        var cid = impCust(), dg = cid && digits((custOf(cid) || {}).phone);
        hit = cid ? ks.filter(function (k) { return k.customer_id === cid || (dg && digits(k.customer_phone) === dg); }) : [];
      }
      var wr = function (k) { var r = K.workRange ? K.workRange(k) : null; return r ? r.from : String(k.updated_at || ''); };
      return hit.sort(function (a, b) { return String(wr(b)).localeCompare(String(wr(a))); }).map(function (k) { return k.id; });
    }
    // 후보가 하나면 그 계약서, 여럿이면 아래 '어느 계약서인가요?'에서 고른 것 (고르기 전에는 '')
    function impK() { var ks = impKs(); return ks.length === 1 ? ks[0] : ks.indexOf(ph.ksel) >= 0 ? ph.ksel : ''; }
    function kById(id) { return (D.contracts || []).filter(function (k) { return k.id === id; })[0] || null; }
    function drawKpick(list) {   // 고른 고객(견적서)의 계약서가 여럿일 때 한 번 더 고르기
      var box = $('.sf-kpick', ov), sig = list.join(',');
      box.hidden = list.length < 2;
      if (list.length < 2) { box.innerHTML = ''; box.removeAttribute('data-sig'); return; }
      if (box.getAttribute('data-sig') !== sig) {
        box.setAttribute('data-sig', sig);
        box.innerHTML = '<div class="field"><span class="label" id="sf-kpk-l">어느 계약서인가요?</span><div class="sf-lopts" role="radiogroup" aria-labelledby="sf-kpk-l">' +
          list.map(function (id) {
            var di = K.dealItem('k', kById(id) || {});   // 현장 / 품목 · 기간 · 고객 이름
            return '<label class="sf-lopt"><input type="radio" name="sf-kpk" value="' + esc(id) + '"><span><b>' + esc(di.label) + '</b><small>' + esc(di.sub) + '</small></span></label>';
          }).join('') + '</div></div>';
      }
      $$('input[name=sf-kpk]', box).forEach(function (x) { x.checked = x.value === ph.ksel; });
    }
    function defectsOf(cid) { return (D.defects || []).filter(function (d) { return d.customer_id === cid && d.status !== 'done' && !d.done_on; }).sort(function (a, b) { return String(b.received_on || '').localeCompare(String(a.received_on || '')); }); }
    function inquiriesOf(cid) {
      var c = custOf(cid), dg = c && digits(c.phone);
      return dg ? (D.inquiries || []).filter(function (q) { return q.status !== 'dropped' && digits(q.phone) === dg; }).sort(function (a, b) { return (a.status === 'new' ? 0 : 1) - (b.status === 'new' ? 0 : 1) || String(b.created_at || '').localeCompare(String(a.created_at || '')); }) : [];
    }
    function linkKind() { var k = pickedKind(); return (k === 'defect' || k === 'meet') && custs.length ? k : ''; }   // 하자·상담 + 고객 목록이 있을 때 (고객 없음 체크는 none[종류])
    function lkDate(v) { return v || (!isNew ? rec.start_on : '') || day || K.today(); }
    function drawLink() {
      var k = linkKind(), body = $('.sf-lbody', ov);
      lk.on = false;
      if (!lk.cust || none[k]) { body.innerHTML = ''; return; }
      var ttime = !isNew ? rec.time : '';
      if (k === 'defect') {
        var list = defectsOf(lk.cust);
        if (!lk.target) lk.target = list.length ? list[0].id : 'new';
        var cur = list.filter(function (d) { return d.id === lk.target; })[0];
        if (!lk.hydrated) lk.step = cur && cur.check_on ? 'repair' : 'check';   // 다음 할 일: 현장 확인을 했으면 하자 보수
        lk.hydrated = true;
        var v = cur ? (lk.step === 'check' ? { a: cur.check_on, b: '', t: cur.check_time } : { a: cur.repair_on, b: cur.repair_end, t: cur.repair_time }) : { a: '', b: '', t: '' };
        body.innerHTML = '<div class="field"><span class="label" id="sf-ld-l">어느 하자인가요?</span><div class="sf-lopts" role="radiogroup" aria-labelledby="sf-ld-l">' +
          list.map(function (d) {
            return '<label class="sf-lopt"><input type="radio" name="sf-ldef" value="' + esc(d.id) + '"' + (lk.target === d.id ? ' checked' : '') + '><span><b>' + esc(d.title || '하자') + '</b><small>접수 ' + esc(md(d.received_on)) +
              (d.check_on ? ' · 현장 확인 ' + esc(md(d.check_on)) : '') + (d.repair_on ? ' · 보수 ' + esc(md(d.repair_on)) : '') + '</small></span></label>';
          }).join('') +
          '<label class="sf-lopt"><input type="radio" name="sf-ldef" value="new"' + (lk.target === 'new' ? ' checked' : '') + '><span><b>새 하자 접수</b></span></label></div></div>' +
          (lk.target === 'new' ? '<div class="field"><label for="sf-dtitle">하자 내용</label><input class="input" id="sf-dtitle" maxlength="120" placeholder="예) 욕실 타일 들뜸" value="' + esc(!isNew && rec.title !== TDEF.defect ? rec.title : '') + '"></div>' : '') +
          '<div class="field"><span class="label" id="sf-ls-l">무슨 일정인가요?</span><div class="choices sf-kinds sf-dsteps" role="radiogroup" aria-labelledby="sf-ls-l">' +
          [['check', '현장 확인'], ['repair', '하자 보수']].map(function (o) { return '<label class="choice"><input type="radio" name="sf-lstep" value="' + o[0] + '"' + (lk.step === o[0] ? ' checked' : '') + '><span>' + o[1] + '</span></label>'; }).join('') + '</div></div>' +
          '<div class="sf-row"><div class="field"><label for="sf-ld1">' + (lk.step === 'check' ? '확인 날짜' : '시작일') + '</label><input class="input" type="date" id="sf-ld1" value="' + esc(lkDate(v.a)) + '"></div>' +
          (lk.step === 'repair' ? '<div class="field"><label for="sf-ld2">끝나는 날 <span class="opt">(선택)</span></label><input class="input" type="date" id="sf-ld2" data-min-from="sf-ld1" value="' + esc(v.b || (!isNew ? rec.end_on || '' : '')) + '"></div>' : '') + '</div>' +
          '<div class="field"><label for="sf-ldt">시간 <span class="opt">(선택)</span></label><input class="input" id="sf-ldt" data-time data-ph="시간 고르기" maxlength="20" value="' + esc(v.t || ttime || '') + '"></div>';
        lk.on = true;
      } else {
        var qs = inquiriesOf(lk.cust);
        if (!qs.length) {   // 상담 신청 기록이 없는 고객: 일정으로 따로 (고객은 연결)
          body.innerHTML = '<p class="sf-lnone">이 고객은 상담 신청 기록이 없어서 일정으로 적어요.</p>';
          return;
        }
        if (!lk.target && lk.qid && qs.some(function (q) { return q.id === lk.qid; })) lk.target = lk.qid;   // 상담 신청 카드의 '일정 등록'으로 열었으면 그 신청
        if (!lk.target || !qs.some(function (q) { return q.id === lk.target; })) lk.target = qs[0].id;
        var q0 = qs.filter(function (q) { return q.id === lk.target; })[0];
        body.innerHTML = '<div class="field"><span class="label" id="sf-lq-l">어느 상담 신청인가요?</span><div class="sf-lopts" role="radiogroup" aria-labelledby="sf-lq-l">' +
          qs.map(function (q) {
            return '<label class="sf-lopt"><input type="radio" name="sf-linq" value="' + esc(q.id) + '"' + (lk.target === q.id ? ' checked' : '') + '><span><b>' + esc(q.method || '상담') + (q.site_name ? ' · ' + esc(q.site_name) : '') + '</b><small>신청 ' + esc(md(String(q.created_at || '').slice(0, 10))) +
              (q.preferred_date ? ' · 상담일 ' + esc(md(q.preferred_date)) : '') + (q.status === 'done' ? ' · 상담 완료' : '') + '</small></span></label>';
          }).join('') + '</div></div>' +
          '<div class="sf-row"><div class="field"><label for="sf-lq1">상담 날짜</label><input class="input" type="date" id="sf-lq1" value="' + esc(!isNew ? rec.start_on : (q0.preferred_date || lkDate(''))) + '"></div>' +
          '<div class="field"><label for="sf-lqt">시간 <span class="opt">(선택)</span></label><input class="input" id="sf-lqt" data-time data-ph="시간 고르기" maxlength="20" value="' + esc(!isNew ? rec.time || '' : q0.preferred_time || '') + '"></div></div>';
        lk.on = true;
      }
    }
    function saveLink() {
      var msg = $('#sf-msg', ov), k = linkKind(), btn = $('button[type=submit]', ov);
      var after = function (dayTo, text) {
        return (!isNew && rec.id ? DB.deleteSchedule(rec.id) : Promise.resolve()).then(function () { close(); K.state.counts = null; K.toast(text); done(dayTo); });
      };
      var fail = function (err) { btn.disabled = false; msg.textContent = /permission|denied|42501/i.test(String((err && (err.message || err.code)) || '')) ? '고칠 권한이 아직 없어요. Supabase에서 최신 schema.sql 을 한 번 더 실행해 주세요.' : K.friendlyError(err); msg.hidden = false; };
      if (k === 'defect') {
        var a = $('#sf-ld1', ov).value, b2 = $('#sf-ld2', ov) ? $('#sf-ld2', ov).value : '', tm = $('#sf-ldt', ov).value.trim();
        if (!a) { msg.textContent = '날짜를 골라 주세요.'; msg.hidden = false; return; }
        var d0 = lk.target === 'new' ? null : (D.defects || []).filter(function (d) { return d.id === lk.target; })[0];
        var row = d0 ? Object.assign({}, d0) : { customer_id: lk.cust, received_on: K.today(), title: ($('#sf-dtitle', ov) || {}).value ? $('#sf-dtitle', ov).value.trim() : '', body: '', photos: [],
          contract_id: ((D.contracts || []).filter(function (x) { return x.customer_id === lk.cust; }).sort(function (x, y) { return String(y.end_date || y.start_date || '').localeCompare(String(x.end_date || x.start_date || '')); })[0] || {}).id || null };
        if (!d0 && !row.title) { msg.textContent = '하자 내용을 적어 주세요. (예: 욕실 타일 들뜸)'; msg.hidden = false; $('#sf-dtitle', ov).focus(); return; }
        if (lk.step === 'check') { row.check_on = a; row.check_time = tm; }
        else { row.repair_on = a; row.repair_end = b2 && b2 > a ? b2 : null; row.repair_time = tm; }
        if (window.CustomerKit && window.CustomerKit.defectStatus) row.status = window.CustomerKit.defectStatus(row);
        btn.disabled = true;
        return DB.saveDefect(row).then(function () { return after(a, d0 ? '하자 기록에 저장했어요' : '새 하자를 접수했어요 · 하자 기록에 들어갔어요'); }).catch(fail);
      }
      var qd = $('#sf-lq1', ov).value, qt = $('#sf-lqt', ov).value.trim().slice(0, 20);
      if (!qd) { msg.textContent = '상담 날짜를 골라 주세요.'; msg.hidden = false; return; }
      btn.disabled = true;
      DB.updateInquiry(lk.target, { preferred_date: qd, preferred_time: qt }).then(function () { return after(qd, '상담 신청에 저장했어요'); }).catch(fail);
    }
    ov.addEventListener('change', function (e) {
      if (e.target.id === 'sf-none') {
        var kk = pickedKind(); none[kk] = e.target.checked;
        if (none[kk]) {
          // '없음'과 맞지 않는 고른 것은 풀기 — 계약서 없는 공사: 고른 계약서만 (고객·견적서는 고객·장소로 그대로) / 고객 없는 하자·상담: 고객이 잡히는 것
          if (kk === 'work' ? /^k:/.test(impId()) : impCust()) K.finderSet(ov, 'sf-imp', '', '', IMP_PH);
        }
        phMode(); if (none[kk]) { var t2 = $('#sf-title', ov); if (t2) t2.focus(); } return;
      }
      var n = e.target.name;
      if (n === 'sf-kpk') { ph.ksel = e.target.value; phMode(); return; }
      if (n === 'sf-ldef') { lk.target = e.target.value; lk.hydrated = false; drawLink(); }
      else if (n === 'sf-lstep') { lk.step = e.target.value; drawLink(); }
      else if (n === 'sf-linq') { lk.target = e.target.value; drawLink(); }
    });
    function hasK() { return (D.contracts || []).some(activeK); }
    function phMode() {
      var kind = pickedKind(), id = impId(), nn = !!none[kind];
      var kOK = kind === 'work' && hasK(), lkK = linkKind();
      // '없음' 체크는 찾기 칸 바로 아래 같은 자리 (공사 · 하자 · 상담일 때만, 글자만 종류에 맞게)
      $('#sf-none-w', ov).hidden = !(kOK || lkK); $('#sf-none-t', ov).textContent = NONE_T[kind] || ''; $('#sf-none', ov).checked = nn;
      if (ph.kfor !== id) { ph.kfor = id; ph.ksel = ''; }   // 찾기 칸에서 다른 것을 고르면 계약서 고르기도 처음부터
      var ks = kOK && !nn ? impKs() : [];
      ph.multi = ks.length > 1; drawKpick(ph.multi ? ks : []);
      var kid = kOK && !nn ? impK() : '', on = !!kid;
      var gate = kOK && !on && !nn;   // 공사인데 계약서를 아직 못 찾았고 '계약서 없는 공사'도 아님 → 아래 칸 잠금
      ph.on = on; ph.gate = gate; ph.kid = kid;
      var cid = lkK && !nn ? impCust() : '';
      if (cid !== lk.cust) { lk.cust = cid; lk.target = ''; lk.hydrated = false; }
      if (lkK) drawLink();
      var lkOn = !!lkK && !nn, linkManual = lkOn && lkK === 'meet' && lk.cust && !lk.on;   // 상담 신청 기록이 없는 고객 → 일정으로 따로
      var lgate = lkOn && !lk.cust;   // 하자·상담인데 고객을 아직 못 찾았고 '고객 없음'도 아님 → 아래 칸 잠금
      $('.sf-link', ov).hidden = !lkK || !$('.sf-lbody', ov).innerHTML;
      $('.sf-ph', ov).hidden = !on;
      var man = $('.sf-man', ov), locked = gate || lgate;
      man.hidden = on || (lkOn && !!lk.cust && !linkManual);
      man.classList.toggle('is-locked', locked); if (locked) man.setAttribute('inert', ''); else man.removeAttribute('inert');
      $('.sf-imp', ov).hidden = src.loaded && !src.length;
      if (!id) K.finderSet(ov, 'sf-imp', '', '', IMP_PH);
      // 설명: 고른 것에서 계약서·고객을 못 찾았을 때, 따로 적은 일정을 옮길 때만
      var ih = '', what = lkK === 'defect' ? '하자 기록' : '상담 신청';
      if (id && !nn && kOK && !on && !ph.multi) ih = /^e:/.test(id) ? '이 견적서로 만든 공사 계약서가 없어요.' : '이 고객의 공사 계약서가 없어요.';
      else if (id && lkOn && !lk.cust) ih = '이 ' + (/^e:/.test(id) ? '견적서' : '계약서') + '에 연결된 고객이 없어요.';
      else if (!isNew && kOK && !nn) ih = on ? '저장하면 이 일정이 계약서의 세부 공사일정(공정)으로 옮겨져요.' : '계약서를 고르면 그 계약서의 공사일정으로 옮겨요.';
      else if (!isNew && lkOn && (lk.on || !lk.cust)) ih = lk.on ? '저장하면 이 일정이 고른 고객의 ' + what + '으로 옮겨져요.' : '고객을 고르면 그 고객의 ' + what + '으로 옮겨요.';
      $('#sf-imp-h', ov).textContent = ih; $('#sf-imp-h', ov).hidden = !ih;
      $('#sf-msg', ov).hidden = true;
      if (!on) return;
      if (!isNew && !$('#sf-pname', ov).value && rec.title && rec.title !== TDEF.work) $('#sf-pname', ov).value = String(rec.title).slice(0, 30);   // 옮길 때 공정 이름 = 일정 이름
      if (!ph.from) { ph.from = $('#sf-start', ov).value || rec.start_on || K.today(); ph.to = $('#sf-end', ov).value && $('#sf-end', ov).value > ph.from ? $('#sf-end', ov).value : ph.from; ph.picked = ph.to !== ph.from; }
      showPh();
      if (!ph.chips) {
        ph.chips = true;
        phaseChoices().then(function (list) {
          var box = $('#sf-pchips', ov); if (!box) return;
          box.innerHTML = list.map(function (q) { return '<button type="button" class="ap-chip" data-sfpn="' + esc(q.name) + '" data-sfpd="' + esc(String(q.days || 1)) + '"><span class="ph-box" aria-hidden="true">' + I.check + '</span><b>' + esc(q.name) + '</b></button>'; }).join('');
        });
      }
    }
    function showPh() { $('#sf-pdate', ov).textContent = sd(ph.from) + (ph.to !== ph.from ? ' ~ ' + sd(ph.to) : '') + ' · ' + spanDays(ph.from, ph.to) + '일'; }
    function phKon() { return (D.contracts || []).filter(function (z) { return z.id === ph.kid; })[0] || null; }
    ov.addEventListener('click', function (e) {
      var x;
      if (!ph.on) return;
      if ((x = e.target.closest('[data-sfpn]'))) {
        $('#sf-pname', ov).value = x.getAttribute('data-sfpn');
        $$('[data-sfpn]', ov).forEach(function (b) { b.classList.toggle('on', b === x); });
        if (!ph.picked) { ph.to = K.addDays(ph.from, Math.max(1, +x.getAttribute('data-sfpd') || 1) - 1); showPh(); }
        $('#sf-msg', ov).hidden = true;
        return;
      }
      if (e.target.closest('[data-sfpdate]')) {
        var k0 = phKon(), marks = {};
        (k0 && Array.isArray(k0.phases) ? k0.phases : []).forEach(function (h, j) { if (!h || !h.from) return; days(h.from, h.to || h.from).forEach(function (d) { (marks[d] = marks[d] || []).push({ t: h.name || (j + 1) + '번 공정', c: phColor(j) }); }); });
        return openRangePicker({ title: ($('#sf-pname', ov).value.trim() || '새 공정') + ' 날짜', from: ph.from, to: ph.to, band: k0 && k0.start_date ? { from: k0.start_date, to: k0.end_date || k0.start_date } : null, marks: marks,
          done: function (a, b2) { ph.from = a; ph.to = b2; ph.picked = true; showPh(); } });
      }
    });
    $('#sf-pname', ov).addEventListener('input', function () { var v = this.value.trim(); $$('[data-sfpn]', ov).forEach(function (b) { b.classList.toggle('on', b.getAttribute('data-sfpn') === v); }); });
    function savePhase() {
      var msg = $('#sf-msg', ov), nm = $('#sf-pname', ov).value.trim();
      if (!nm) { msg.textContent = '공정 이름을 적거나 위에서 골라 주세요.'; msg.hidden = false; $('#sf-pname', ov).focus(); return; }
      var btn = $('button[type=submit]', ov); btn.disabled = true;
      DB.getContract(ph.kid).then(function (k) {
        if (!k) throw new Error('이 계약서를 찾을 수 없어요. 이미 지웠을 수 있어요.');
        var dc = k.doc || {}, st = dc.start || k.start_date || '';
        var list = (Array.isArray(dc.phases) ? dc.phases : []).filter(function (h) { return h && String(h.name || '').trim(); })
          .map(function (h) { return { name: String(h.name).trim(), start: h.start || '', days: String(h.days || '1') }; });
        list.push({ name: nm, start: ph.from, days: String(spanDays(ph.from, ph.to)) });
        dc.phases = resolveRows(list, st); k.doc = dc;
        return DB.saveContract(k);
      }).then(function () {
        if (!isNew && rec.id) return DB.deleteSchedule(rec.id).then(function () { K.toast('계약서 공사일정으로 옮겼어요'); });   // 따로 있던 공사 일정은 휴지통으로 (30일 보관)
      }).then(function () { close(); K.state.counts = null; done(ph.from); })
        .catch(function (err) { btn.disabled = false; msg.textContent = K.friendlyError(err); msg.hidden = false; });
    }
    // 고객이 연결된 일정(상담 신청 카드·고객 화면의 '일정 추가' 포함)은 그 고객을 찾기 칸에 미리 — 고객 칸이 따로 없으므로 종류와 상관없이
    // (따로 적은 공사 일정은 '계약서 없는 공사'에 체크된 채라 계약서로 옮겨지지 않고 고객 연결만)
    if (custOf(rec.customer_id)) K.finderSet(ov, 'sf-imp', 'c:' + rec.customer_id, cLabel(custOf(rec.customer_id)));
    phMode();   // 처음 열 때도 (종류가 공사인 일정 · 공사로 시작하는 창은 계약서부터)
    ov.addEventListener('click', function (e) {
      if (e.target === ov || e.target.closest('[data-close]')) return close();
      if (e.target.closest('[data-sdel]')) {
        K.ask({ title: '이 일정을 지울까요?', text: esc(rec.title) + '<br><small>휴지통에 <b>30일</b> 동안 보관돼서 그동안은 <b>설정 → 휴지통</b>에서 되살릴 수 있어요.</small>', cancel: '그만두기', ok: '지우기', okClass: 'btn-danger' }).then(function (ok) {
          if (!ok) return;
          DB.deleteSchedule(rec.id).then(function () { close(); K.toast('휴지통으로 옮겼어요'); done(); }).catch(function (err) { K.ask({ title: '지우지 못했어요', text: esc(K.friendlyError(err)), cancel: false, ok: '확인' }); });
        });
      }
    });
    ov.addEventListener('keydown', function (e) { if (e.key === 'Escape') close(); });
    form.addEventListener('submit', function (e) {
      e.preventDefault();
      if (ph.on) return savePhase();
      var msg = $('#sf-msg', ov);
      if (ph.gate && ph.multi) { msg.textContent = '어느 계약서의 공사일정에 넣을지 골라 주세요.'; msg.hidden = false; return; }
      if (ph.gate) { msg.textContent = '위 찾기 칸에서 공사 계약서를 고르거나, 계약서가 없으면 \'계약서 없는 공사\'에 체크해 주세요.'; msg.hidden = false; return; }
      if (linkKind() && !none[pickedKind()]) {
        if (!lk.cust) { msg.textContent = '위 찾기 칸에서 고객을 고르거나, 고객이 없으면 \'' + NONE_T[pickedKind()] + '\'에 체크해 주세요.'; msg.hidden = false; return; }
        if (lk.on) return saveLink();
      }
      var row = {
        id: rec.id, kind: (($('input[name=sf-kind]:checked', ov) || {}).value) || 'etc', title: $('#sf-title', ov).value.trim(),
        start_on: $('#sf-start', ov).value, end_on: $('#sf-end', ov).value || null, time: $('#sf-time', ov).value.trim(),
        place: $('#sf-place', ov).value.trim(), memo: $('#sf-memo', ov).value, customer_id: none[pickedKind()] && pickedKind() !== 'work' ? null : impCust() || null,   // 고객 = 위 찾기 칸에서 고른 것의 고객
      };
      if (!row.title) row.title = TDEF[row.kind] || '일정';   // 비워 두면 종류 이름으로 (실측 · 상담 · 공사 · 하자 보수 · 일정)
      if (!row.start_on) { msg.textContent = '날짜를 골라 주세요.'; msg.hidden = false; $('#sf-start', ov).focus(); return; }
      if (row.end_on && row.end_on < row.start_on) { msg.textContent = '끝나는 날이 시작하는 날보다 빨라요.'; msg.hidden = false; $('#sf-end', ov).focus(); return; }
      var btn = $('button[type=submit]', ov); btn.disabled = true;
      DB.saveSchedule(row).then(function () { close(); K.toast('일정을 저장했어요'); done(row.start_on); })
        .catch(function (err) { btn.disabled = false; msg.textContent = K.friendlyError(err); msg.hidden = false; });
    });
  }

  /* =====================================================================
     공사일정 화면  #/calendar/k/<계약서 id>
     한 공사만 달력에 걸러 보고, 달력에서 끌어서(또는 두 번 눌러) 고른 기간을 공정·공사 기간에 넣음.
     서명한 계약서는 착공일·준공일이 계약 내용이라 여기서 못 바꾸고(계약서에서 서명 지우고), 세부 공사일정은 고칠 수 있음
     ===================================================================== */
  /* ----- 하자 일정 고치기 창 (일정 달력에서): 현장 확인 날짜·시간, 하자 보수 시작일~끝나는 날·시간만. 나머지(사진·결과·보수 내용)는 '하자 기록 전체 보기' ----- */
  function openDefectForm(d, D, done) {
    var c = (D.customers || []).filter(function (z) { return z.id === d.customer_id; })[0] || {};
    var dk = d.contract_id && (D.contracts || []).filter(function (k) { return k.id === d.contract_id; })[0];
    var site = (K.siteLabel ? K.siteLabel(K.fillUnit ? K.fillUnit(dk && dk.site, c.address) : (dk && dk.site), '') : '') || c.address || '';
    function fld(id, label, val, o) {
      o = o || {};
      return '<div class="field"><label for="' + id + '">' + label + (o.opt ? ' <span class="opt">(선택)</span>' : '') + '</label><input class="input" id="' + id + '"' +
        (o.date ? ' type="date"' : ' data-time data-ph="시간 고르기" maxlength="20"') + (o.minFrom ? ' data-min-from="' + o.minFrom + '"' : '') + ' value="' + esc(val || '') + '"></div>';
    }
    var ov = document.createElement('div');
    ov.className = 'overlay sf-ov';
    ov.innerHTML = '<form class="sheet form-sheet df-sheet" role="dialog" aria-modal="true" aria-labelledby="df-t" novalidate>' +
      '<h3 id="df-t">하자 일정 고치기</h3>' +
      '<div class="df-head"><b>' + esc(d.title || '하자') + '</b>' + (site ? '<span>' + esc(site) + '</span>' : '') + (c.name ? '<span>' + esc(c.name) + ' 고객님' + (c.phone ? ' · ' + esc(c.phone) : '') + '</span>' : '') + '</div>' +
      '<h4 class="df-sec">현장 확인</h4><div class="sf-row">' + fld('df-cdate', '확인 날짜', d.check_on, { date: true }) + fld('df-ctime', '시간', d.check_time, { opt: true }) + '</div>' +
      '<h4 class="df-sec">하자 보수</h4><div class="sf-row">' + fld('df-rdate', '시작일', d.repair_on, { date: true }) + fld('df-rend', '끝나는 날', d.repair_end, { date: true, opt: true, minFrom: 'df-rdate' }) + '</div>' +
      fld('df-rtime', '시간', d.repair_time, { opt: true }) +
      '<a class="df-full" href="#/defect/' + encodeURIComponent(d.id) + '">하자 기록 전체 보기 (사진 · 확인 결과 · 보수 내용) ›</a>' +
      '<p class="msg error-msg" id="df-msg" hidden></p>' +
      '<div class="btn-row"><button class="btn btn-outline" type="button" data-close>닫기</button><button class="btn btn-primary" type="submit">저장</button></div></form>';
    document.body.appendChild(ov);
    var form = $('form', ov), changed = false;
    function close() { ov.remove(); }
    ov.addEventListener('input', function () { changed = true; });
    ov.addEventListener('change', function () { changed = true; });
    ov.addEventListener('click', function (e) {
      if (e.target === ov || e.target.closest('[data-close]')) return close();
      if (e.target.closest('.df-full')) close();   // 전체 보기로 가면 창은 닫고, 저장하면 이 달력으로 돌아옴
    });
    ov.addEventListener('keydown', function (e) { if (e.key === 'Escape') close(); });
    form.addEventListener('submit', function (e) {
      e.preventDefault();
      if (!changed) return close();
      var row = Object.assign({}, d, {
        check_on: $('#df-cdate', ov).value || null, check_time: $('#df-ctime', ov).value.trim(),
        repair_on: $('#df-rdate', ov).value || null, repair_end: $('#df-rend', ov).value || null, repair_time: $('#df-rtime', ov).value.trim(),
      });
      if (row.repair_end && row.repair_on && row.repair_end < row.repair_on) row.repair_end = null;
      if (window.CustomerKit && window.CustomerKit.defectStatus) row.status = window.CustomerKit.defectStatus(row);
      var btn = $('button[type=submit]', ov); btn.disabled = true;
      DB.saveDefect(row).then(function () {
        close(); K.state.counts = null;
        K.toast('하자 일정을 저장했어요');
        if (done) done(row.check_on && row.check_on !== d.check_on ? row.check_on : row.repair_on && row.repair_on !== d.repair_on ? row.repair_on : null);
      }).catch(function (err) {
        btn.disabled = false;
        var m = $('#df-msg', ov); m.textContent = K.friendlyError(err); m.hidden = false;
      });
    });
  }
  /* ----- 상담 일정 고치기 창 (일정 달력에서): 상담 희망 날짜·시간만. 신청 내용은 '상담 신청 보기' ----- */
  function openInquiryForm(q, done) {
    var site = K.siteLabel ? K.siteLabel(q.site_name, q.size) : (q.site_name || '');
    var ov = document.createElement('div');
    ov.className = 'overlay sf-ov';
    ov.innerHTML = '<form class="sheet form-sheet df-sheet" role="dialog" aria-modal="true" aria-labelledby="qf-t" novalidate>' +
      '<h3 id="qf-t">상담 일정 고치기</h3>' +
      '<div class="df-head"><b>' + esc(q.method || '상담') + (q.name ? ' · ' + esc(q.name) + ' 고객님' : '') + '</b>' + (site ? '<span>' + esc(site) + '</span>' : '') +
        (q.phone ? '<span>' + esc(q.phone) + '</span>' : '') + ((q.scopes || []).length ? '<span>' + esc(q.scopes.join(', ')) + '</span>' : '') + '</div>' +
      '<div class="sf-row"><div class="field"><label for="qf-date">상담 날짜</label><input class="input" type="date" id="qf-date" value="' + esc(q.preferred_date || '') + '"></div>' +
      '<div class="field"><label for="qf-time">시간 <span class="opt">(선택)</span></label><input class="input" id="qf-time" data-time data-ph="시간 고르기" maxlength="20" value="' + esc(q.preferred_time || '') + '"></div></div>' +
      '<a class="df-full" href="#/inquiries">상담 신청 보기 ›</a>' +
      '<p class="msg error-msg" id="qf-msg" hidden></p>' +
      '<div class="btn-row"><button class="btn btn-outline" type="button" data-close>닫기</button><button class="btn btn-primary" type="submit">저장</button></div></form>';
    document.body.appendChild(ov);
    var form = $('form', ov), changed = false;
    function close() { ov.remove(); }
    ov.addEventListener('input', function () { changed = true; });
    ov.addEventListener('change', function () { changed = true; });
    ov.addEventListener('click', function (e) {
      if (e.target === ov || e.target.closest('[data-close]')) return close();
      if (e.target.closest('.df-full')) close();
    });
    ov.addEventListener('keydown', function (e) { if (e.key === 'Escape') close(); });
    form.addEventListener('submit', function (e) {
      e.preventDefault();
      if (!changed) return close();
      var patch = { preferred_date: $('#qf-date', ov).value || null, preferred_time: $('#qf-time', ov).value.trim().slice(0, 20) };
      var m = $('#qf-msg', ov);
      if (!patch.preferred_date) { m.textContent = '상담 날짜를 골라 주세요.'; m.hidden = false; return; }
      var btn = $('button[type=submit]', ov); btn.disabled = true;
      DB.updateInquiry(q.id, patch).then(function () {
        close(); K.state.counts = null;
        K.toast('상담 일정을 저장했어요');
        if (done) done(patch.preferred_date !== q.preferred_date ? patch.preferred_date : null);
      }).catch(function (err) {
        btn.disabled = false;
        // 실서비스: 상담 날짜·시간을 고칠 권한은 최신 schema.sql 에 있음
        m.textContent = /permission|denied|42501/i.test(String((err && (err.message || err.code)) || '')) ? '상담 날짜를 고칠 권한이 아직 없어요. Supabase에서 최신 schema.sql 을 한 번 더 실행해 주세요.' : K.friendlyError(err);
        m.hidden = false;
      });
    });
  }
  function phaseChoices() {   // 계약서 설정의 '공정 기본 일수' 목록 (새 공정 추가 창 · 일정 추가 창의 공정 고르기)
    var CKit = window.ContractKit;
    return (CKit && CKit.loadSettings ? CKit.loadSettings().catch(function () { return null; }) : Promise.resolve(null)).then(function (S) {
      return (S && Array.isArray(S.phases) && S.phases.length ? S.phases : ['철거', '전기', '설비', '목공', '타일', '도장', '필름', '도배', '마루·장판', '가구·주방', '조명', '청소'].map(function (n) { return { name: n, days: 1 }; }))
        .filter(function (q) { return q && String(q.name || '').trim(); });
    });
  }
  function signedDoc(dc) { return !!(dc.paperSigned || (dc.signs && (dc.signs.customer || dc.signs.supplier))); }
  function resolveRows(list, start) {   // admin-contract.js 의 resolvePhases 와 같은 규칙
    var prevEnd = '';
    return (list || []).map(function (h) {
      var n = Math.max(1, Math.min(365, parseInt(h.days, 10) || 1));
      var from = /^\d{4}-\d{2}-\d{2}$/.test(h.start || '') ? h.start : prevEnd ? K.addDays(prevEnd, 1) : (start || '');
      var to = from ? K.addDays(from, n - 1) : '';
      if (to) prevEnd = to;
      return { name: String(h.name || '').slice(0, 30), start: h.start || '', days: String(n), from: from, to: to };
    });
  }
  var UP = '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.6" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M12 19V5M5.5 11.5 12 5l6.5 6.5"/></svg>';
  var DOWN = '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.6" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M12 5v14M5.5 12.5 12 19l6.5-6.5"/></svg>';
  var GRIP = '<svg viewBox="0 0 24 24" fill="currentColor"><circle cx="9" cy="6" r="1.6"/><circle cx="15" cy="6" r="1.6"/><circle cx="9" cy="12" r="1.6"/><circle cx="15" cy="12" r="1.6"/><circle cx="9" cy="18" r="1.6"/><circle cx="15" cy="18" r="1.6"/></svg>';
  var PH_COLORS = ['#2F5D9B', '#B4530F', '#2E7D4F', '#8E44AD', '#C0392B', '#0E7C86', '#8A6440', '#5D6D7E'];
  function phColor(i) { return PH_COLORS[i % PH_COLORS.length]; }
  function sd(d) { return d ? K.sDate(d).replace(/^(\d+)월 (\d+)일/, '$1/$2') : ''; }   // 10/22(목)
  function spanDays(a, b) { var x = parse(a), y = parse(b); return x && y ? Math.round((y - x) / 864e5) + 1 : 0; }
  // 공사 고르기 목록: 지금·앞으로 공사(시작일 순) → 지난 공사(최근 순)
  function jobList(D) {
    var t = K.today();
    var list = D.contracts.filter(function (k) { return k.start_date && k.status !== 'canceled' && k.status !== 'terminated'; });
    var now = list.filter(function (k) { return (k.end_date || k.start_date) >= t && k.status !== 'done'; }).sort(function (a, b) { return a.start_date.localeCompare(b.start_date); });
    var past = list.filter(function (k) { return now.indexOf(k) < 0; }).sort(function (a, b) { return b.start_date.localeCompare(a.start_date); });
    return now.concat(past);
  }
  function jobLabel(k) {
    return (k.customer_name || '이름 없음') + (k.title ? ' · ' + k.title : '') + ' (' + md(k.start_date) + '~' + md(k.end_date || k.start_date) + ')' + (k.status === 'done' ? ' · 공사 완료' : k.status === 'draft' ? ' · 계약 전' : '');
  }
  // 찾아서 고르기 목록: 지금·앞으로 공사는 처음부터 다 보이고, 지난 공사는 최근 것 몇 개만 (나머지는 찾기)
  // 공사 고르기 목록: 줄마다 상태 표시(공사 중 · 착공 전 · 계약 전 / 공사 완료 · 기간 끝남), 지난 공사는 흐리게, 묶음 제목은 색 띠로
  function jobItems(D) {
    var t = K.today();
    return jobList(D).map(function (k) {
      var now = (k.end_date || k.start_date) >= t && k.status !== 'done';
      var st = k.status === 'done' ? ['done', '공사 완료'] : !now ? ['late', k.status === 'draft' ? '계약 전' : '계약 완료'] : k.status === 'draft' ? ['draft', '계약 전']
        : t < k.start_date ? ['pre', '착공 전'] : ['now', '공사 중'];
      var di = K.dealItem('k', k);   // 현장 / 품목 · 기간 · 고객 이름
      return { id: k.id, label: di.label, grp: now ? '지금·앞으로 공사' : '지난 공사', grpKey: now ? 'now' : 'past', pin: now, dim: !now,
        tag: st[1], tagKey: 's-' + st[0], sub: di.sub,
        keys: [k.customer_name, k.customer_phone, k.site, k.start_date, k.end_date].join(' ') };
    });
  }
  function openJobFinder(D, cur, focus, allHref) {
    K.finder({ title: '공사 고르기', ph: '고객 이름·전화번호·현장으로 찾기', items: jobItems(D), cur: cur || '', focus: focus, recent: 6,
      none: allHref ? '모든 일정 보기' : '', empty: '공사 기간을 적은 계약서가 아직 없어요.',
      onPick: function (it) { if (it) K.go('#/calendar/k/' + encodeURIComponent(it.id)); else if (allHref) K.go(allHref); } });
  }

  function viewJob(kid, monArg) {
    K.frame('공사일정', true, 'calendar');
    app.innerHTML = '<div class="page"><div class="loading">불러오는 중…</div></div>';
    Promise.all([load(), kid ? DB.getContract(kid) : Promise.resolve(null)]).then(function (r) {
      var D = r[0], k = r[1];
      var page = document.createElement('div');
      page.className = 'page cal-page job-page';
      app.innerHTML = ''; app.appendChild(page);
      if (!k) {
        page.innerHTML = '<div class="field job-pick"><span class="label" id="job-sel-l">공사 고르기</span>' + K.finderField('job-sel', { ph: '고객 이름·현장으로 공사 찾기', labelledby: 'job-sel-l' }) + '</div>' +
          '<div class="empty-box">' + (kid ? '이 계약서를 찾을 수 없어요. 이미 지웠을 수 있어요.' : '위에서 공사를 찾아 골라 주세요.') + '</div>';
        page.addEventListener('click', function (e) { var b = e.target.closest('[data-fdopen="job-sel"]'); if (b) openJobFinder(D, '', b, '#/calendar'); });
        return;
      }
      var dc = k.doc || {}, locked = signedDoc(dc);
      var start = dc.start || k.start_date || '', end = dc.end || k.end_date || '';
      function shownRange() {   // 위 카드에 보이는 공사 기간: 착공·준공일, 비었으면 세부 공사일정 처음~끝
        if (start) return { from: start, to: end, byPhase: false };
        var r = K.workRange ? K.workRange({ phases: resolveRows(rows || [], '') }) : null;
        return r ? { from: r.from, to: r.to, byPhase: true } : { from: '', to: '', byPhase: false };
      }
      var rows = (Array.isArray(dc.phases) ? dc.phases : []).map(function (h) { return { name: h.name || '', start: h.start || '', days: String(h.days || '1') }; });
      var t0 = K.today();
      var mon = /^\d{4}-\d{2}$/.test(monArg || '') ? monArg : (start && start <= t0 && t0 <= (end || start) ? t0 : start || t0).slice(0, 7);
      K.state.backTo = '#/calendar/' + mon;
      var pick = null;       // 고른 기간 { from, to, single }
      var active = null;     // 고른 기간을 넣을 공정 번호 (마지막으로 누른 공정)
      // 이 공사와 관련된 다른 일정 (하자 확인·보수, 같은 고객의 직접 적은 일정) — 보기만
      var others = collect(D).filter(function (x) {
        if (x.src === 'defect') { var d = D.defects.filter(function (z) { return z.id === x.id; })[0]; return d && (d.contract_id === k.id || (!d.contract_id && k.customer_id && d.customer_id === k.customer_id)); }
        if (x.src === 'schedule') { var s0 = D.schedules.filter(function (z) { return z.id === x.id; })[0]; return s0 && k.customer_id && s0.customer_id === k.customer_id; }
        return false;
      });

      function dirty() { K.setDirty(true); var b = $('#job-save', page); if (b && b.hidden) { b.hidden = false; dock(); } }
      function res() { return resolveRows(rows, start); }
      function lateOf(r) { return !!(end && r.to && r.to > end); }

      /* ----- 달력 ----- */
      function gridHtml() {
        var y = +mon.slice(0, 4), m = +mon.slice(5, 7), R = res(), map = {};
        R.forEach(function (h, i) { if (!h.from) return; days(h.from, h.to).forEach(function (d) { (map[d] = map[d] || []).push({ t: h.name || (i + 1) + '번 공정', c: phColor(i), late: lateOf(h) }); }); });
        others.forEach(function (x) { (map[x.date] = map[x.date] || []).push({ t: x.short || x.title, k: x.kind, dim: x.dim }); });
        var first = new Date(y, m - 1, 1), st = new Date(y, m - 1, 1 - first.getDay()), cells = '';
        var pf = pick ? pick.from : '', pt = pick ? pick.to : '';
        for (var i = 0; i < 42; i++) {
          var d = new Date(st.getFullYear(), st.getMonth(), st.getDate() + i), iso = K.ymd(d), list = map[iso] || [];
          if (i === 35 && d.getMonth() !== m - 1) break;
          var inJob = start && iso >= start && iso <= (end || start);
          var cls = 'cal-cell' + (d.getMonth() !== m - 1 ? ' out' : '') + (iso === t0 ? ' today' : '') + (inJob ? ' in-job' : '') +
            (iso === start ? ' job-s' : '') + (iso === end ? ' job-e' : '') + (pf && iso >= pf && iso <= pt ? ' jpick' : '') + (iso === pf ? ' jpick-s' : '') + (iso === pt ? ' jpick-e' : '') +
            (d.getDay() === 0 ? ' sun' : d.getDay() === 6 ? ' sat' : '');
          cells += '<button type="button" class="' + cls + '" data-jday="' + iso + '" aria-label="' + esc(K.sDate(iso)) + (inJob ? ', 공사 기간' : '') + (list.length ? ', ' + list.map(function (x) { return x.t; }).join(', ') : '') + '">' +
            '<span class="cal-n">' + d.getDate() + '</span><span class="cal-evs">' +
            list.slice(0, 3).map(function (x, j) {
              return '<span class="ev' + (x.k ? ' k-' + esc(x.k) : '') + (x.dim ? ' dim' : '') + (x.late ? ' late' : '') + (j === 2 ? ' ev3' : '') + '"' + (x.c ? ' style="--k:' + x.c + '"' : '') + '><em class="s">' + esc(x.t) + '</em><em class="f">' + esc(x.t) + '</em></span>';
            }).join('') +
            (list.length > 2 ? '<span class="ev more m"><em>+' + (list.length - 2) + '</em></span>' : '') +
            (list.length > 3 ? '<span class="ev more d"><em>+' + (list.length - 3) + '</em></span>' : '') + '</span></button>';
        }
        return '<div class="cal-wk">' + '일월화수목금토'.split('').map(function (w, i) { return '<span' + (i === 0 ? ' class="sun"' : i === 6 ? ' class="sat"' : '') + '>' + w + '</span>'; }).join('') + '</div>' +
          '<div class="cal-days job-days' + (pick && !pick.single ? ' locked' : '') + '">' + cells + '</div>';   // 기간을 다 골랐으면 '선택 취소' 전까지 달력을 눌러도 안 바뀜
      }
      function navHtml() {
        var y = +mon.slice(0, 4), m = +mon.slice(5, 7);
        return '<button type="button" class="icon-btn" data-jmon="-1" aria-label="이전 달">' + I.left + '</button><h2>' + y + '년 ' + m + '월</h2>' +
          '<button type="button" class="icon-btn" data-jmon="1" aria-label="다음 달">' + I.right + '</button>';
      }
      function drawGrid() { $('#job-grid', page).innerHTML = gridHtml(); $('#job-nav', page).innerHTML = navHtml(); }

      /* ----- 고른 기간 넣기 막대 ----- */
      function targetOptions() {
        var R = res(), def = active != null && active < rows.length ? 'p' + active : 'new';
        return R.map(function (h, i) {
          return '<option value="p' + i + '"' + (def === 'p' + i ? ' selected' : '') + '>' + (i + 1) + '. ' + esc(h.name || '이름 없는 공정') + (h.from ? ' (지금 ' + esc(md(h.from)) + (h.to !== h.from ? '~' + esc(md(h.to)) : '') + ')' : '') + '</option>';
        }).join('') + '<option value="new"' + (def === 'new' ? ' selected' : '') + '>＋ 새 공정 추가</option>' +
          (locked ? '' : '<option value="period">공사 기간 (착공일~준공일)</option>');
      }
      function drawBar() {
        var bar = $('#job-bar', page);
        if (!pick) { bar.hidden = true; bar.innerHTML = ''; dock(); return; }
        var n = spanDays(pick.from, pick.to);
        bar.hidden = false;
        bar.innerHTML = '<div class="jb-range"><b>' + esc(sd(pick.from)) + (pick.to !== pick.from ? ' ~ ' + esc(sd(pick.to)) : '') + '</b><span>' + n + '일</span>' +
          '<button type="button" class="btn-link jb-x" data-jcancel>선택 취소</button></div>' +

          // 단추 하나: 누르면 창에서 이름 등을 적고 이 날짜로 공정 추가 (있던 공정 날짜는 공정을 펼쳐 날짜 단추로)
          '<button type="button" class="btn btn-primary jb-new" data-jnew>' + I.plus + '이 날짜로 새 공정 추가</button>';
        dock();
      }
      /* ----- 새 공정 추가 창: 공정 이름(자주 쓰는 공정 고르기) · 날짜(바꾸기 → 날짜 고르기 창) ----- */
      function openAddPhase(o) {
        var from = o.from, to = o.to || o.from, picked = !!o.picked;
        var ov = document.createElement('div');
        ov.className = 'overlay';
        ov.innerHTML = '<form class="sheet form-sheet ap-sheet" role="dialog" aria-modal="true" aria-labelledby="ap-t" novalidate><h3 id="ap-t">새 공정 추가</h3>' +
          '<div class="field"><label for="ap-name">공정 이름</label><input class="input" id="ap-name" maxlength="30" placeholder="예) 전기공사" autocomplete="off"></div>' +
          '<div class="ap-chips" id="ap-chips" role="group" aria-label="자주 쓰는 공정"></div>' +
          '<div class="field"><span class="label" id="ap-dl">날짜</span><button type="button" class="jp-datebtn" data-apdate aria-describedby="ap-dl">' + I.cal + '<span class="jp-date" id="ap-date"></span><span class="jp-dgo">바꾸기</span></button></div>' +
          '<p class="msg error-msg" id="ap-msg" hidden></p>' +
          '<div class="btn-row"><button class="btn btn-outline" type="button" data-close>취소</button><button class="btn btn-primary" type="submit">추가</button></div></form>';
        document.body.appendChild(ov);
        function showDate() { $('#ap-date', ov).textContent = sd(from) + (to !== from ? ' ~ ' + sd(to) : '') + ' · ' + spanDays(from, to) + '일'; }
        showDate();
        // 계약서 설정의 '공정 기본 일수' 목록을 고르기 칸으로 (달력에서 고른 날짜가 없으면 그 공정의 기본 일수로 끝나는 날을 맞춤)
        phaseChoices().then(function (list) {
          var box = $('#ap-chips', ov); if (!box) return;
          box.innerHTML = list.map(function (q) { return '<button type="button" class="ap-chip" data-apn="' + esc(q.name) + '" data-apd="' + esc(String(q.days || 1)) + '"><span class="ph-box" aria-hidden="true">' + I.check + '</span><b>' + esc(q.name) + '</b></button>'; }).join('');
        });
        if (window.matchMedia && matchMedia('(hover: hover) and (pointer: fine)').matches) setTimeout(function () { $('#ap-name', ov).focus(); }, 60);
        function close() { ov.remove(); }
        ov.addEventListener('click', function (e) {
          var x;
          if (e.target === ov || e.target.closest('[data-close]')) return close();
          if ((x = e.target.closest('[data-apn]'))) {
            $('#ap-name', ov).value = x.getAttribute('data-apn');
            $$('[data-apn]', ov).forEach(function (b) { b.classList.toggle('on', b === x); });
            if (!picked) { to = K.addDays(from, Math.max(1, +x.getAttribute('data-apd') || 1) - 1); showDate(); }
            $('#ap-msg', ov).hidden = true;
            return;
          }
          if (e.target.closest('[data-apdate]')) {
            var R0 = res(), marks = {};
            R0.forEach(function (h, j) { if (!h.from) return; days(h.from, h.to).forEach(function (d) { (marks[d] = marks[d] || []).push({ t: h.name || (j + 1) + '번 공정', c: phColor(j) }); }); });
            return openRangePicker({ title: ($('#ap-name', ov).value.trim() || '새 공정') + ' 날짜', from: from, to: to, band: { from: start, to: end }, marks: marks,
              done: function (a, b2) { from = a; to = b2; picked = true; showDate(); } });
          }
        });
        ov.addEventListener('keydown', function (e) { if (e.key === 'Escape' && !document.querySelector('.rp-sheet')) close(); });
        $('form', ov).addEventListener('submit', function (e) {
          e.preventDefault();
          var nm = $('#ap-name', ov).value.trim();
          if (!nm) { var m = $('#ap-msg', ov); m.textContent = '공정 이름을 적거나 위에서 골라 주세요.'; m.hidden = false; $('#ap-name', ov).focus(); return; }
          rows.push({ name: nm, start: from, days: String(spanDays(from, to)) });
          pick = null; dirty(); close(); drawAll();
        });
      }
      function setPick(a, b, single) { pick = { from: a < b ? a : b, to: a < b ? b : a, single: !!single }; drawGrid(); drawBar(); }
      function clearPick() { pick = null; drawGrid(); drawBar(); }
      function apply() {
        var v = $('#jb-target', page).value, n = spanDays(pick.from, pick.to), msg;
        if (v === 'period') {
          start = pick.from; end = pick.to;
          var si = $('#job-start', page), ei = $('#job-end', page); if (si) si.value = start; if (ei) ei.value = end;
          msg = '공사 기간: ' + sd(start) + ' ~ ' + sd(end);
        } else if (v === 'new') {
          rows.push({ name: '', start: pick.from, days: String(n) }); active = rows.length - 1;
          msg = '';
        } else {
          var i = +v.slice(1); rows[i].start = pick.from; rows[i].days = String(n); active = i;
          msg = (i + 1) + '. ' + (rows[i].name || '공정') + ': ' + sd(pick.from) + (n > 1 ? ' ~ ' + sd(pick.to) : '');
        }
        pick = null; dirty(); drawAll();
        if (msg) K.toast(msg);
        if (v === 'new') { var r = $('[data-wi="' + active + '"] [data-wf="name"]', page); if (r) K.focusNear(r); }
      }

      /* ----- 세부 공사일정 목록: 한 줄씩(번호·이름·날짜·일수) 보이고, 누르면 그 줄만 펼쳐서 고침 ----- */
      function rangeText(r) {
        if (!r || !r.from) return '착공일을 정하면 날짜가 나와요';
        return sd(r.from) + (r.to !== r.from ? ' ~ ' + sd(r.to) : '');
      }
      function rowsHtml() {
        var R = res();
        if (!rows.length) return '<p class="hint wk-none">아직 세부 공사일정이 없어요. 위 달력에서 기간을 고른 뒤 <b>공정 추가</b>를 누르면 그 날짜로 들어가요.</p>';
        return rows.map(function (h, i) {
          var r = R[i], open = active === i, late = lateOf(r), nm = h.name || '';
          return '<div class="jp-item' + (open ? ' open' : '') + (late ? ' late' : '') + '" data-wi="' + i + '" style="--k:' + phColor(i) + '">' +
            '<div class="jp-line"><span class="jp-grip" data-wgrip title="잡고 끌어서 순서 바꾸기" aria-hidden="true">' + GRIP + '</span>' +
            '<button type="button" class="jp-head" data-wopen aria-expanded="' + open + '" aria-controls="jp-body-' + i + '">' +
            '<span class="wk-no">' + (i + 1) + '</span>' +
            '<span class="jp-t"><span class="jp-tt"><b' + (nm ? '' : ' class="none"') + '>' + esc(nm || '이름 없는 공정') + '</b><span class="jp-days">' + esc(h.days || '1') + '일</span></span>' +
            '<small>' + esc(rangeText(r)) + (late ? ' · 준공일 넘음' : '') + '</small></span>' +
            '<span class="jp-chev" aria-hidden="true">' + I.right + '</span></button>' +
            '<span class="jp-mv"><button type="button" data-wmv="-1" aria-label="' + (i + 1) + '번 공정 위로"' + (i === 0 ? ' disabled' : '') + '>' + UP + '</button>' +
            '<button type="button" data-wmv="1" aria-label="' + (i + 1) + '번 공정 아래로"' + (i === rows.length - 1 ? ' disabled' : '') + '>' + DOWN + '</button></span></div>' +
            (open ? '<div class="jp-body" id="jp-body-' + i + '">' +
              '<div class="field"><label for="jp-name-' + i + '">공정 이름</label><input class="input" id="jp-name-' + i + '" data-wf="name" maxlength="30" value="' + esc(nm) + '" placeholder="예) 전기공사"></div>' +
              // 기간(일수)은 − ＋ 로, 날짜는 단추를 누르면 따로 달력 창이 열려 시작~끝을 고름 (공정끼리 겹쳐도 됨)
              '<div class="field"><span class="label" id="jp-sl-' + i + '">기간</span><div class="jp-step" role="group" aria-labelledby="jp-sl-' + i + '">' +
              '<button type="button" data-wstep="-1" aria-label="하루 줄이기"' + ((+h.days || 1) <= 1 ? ' disabled' : '') + '>−</button>' +
              '<div class="est-suffix"><input class="input" data-wf="days" inputmode="numeric" maxlength="3" value="' + esc(h.days) + '" aria-label="기간(일)"><span>일</span></div>' +
              '<button type="button" data-wstep="1" aria-label="하루 늘리기">＋</button></div></div>' +
              '<div class="field"><span class="label" id="jp-dl-' + i + '">날짜</span>' +
              '<button type="button" class="jp-datebtn' + (late ? ' late' : '') + '" data-wdate aria-describedby="jp-dl-' + i + '">' + I.cal +
              '<span class="jp-date">' + esc(r.from ? rangeText(r) + ' · ' + spanDays(r.from, r.to) + '일' : '날짜 고르기') + (late ? ' · 준공일 넘음' : '') + '</span><span class="jp-dgo">바꾸기</span></button></div>' +
              '<div class="jp-acts"><button type="button" class="btn btn-sm jp-del" data-wdel>' + I.trash + '빼기</button></div></div>' : '') +
            '</div>';
        }).join('');
      }
      function refreshRanges() {   // 이름·일수를 고치는 동안 칸을 다시 그리지 않고 글자만 바꿈 (입력 중인 칸 유지)
        res().forEach(function (r, i) {
          var it = $('[data-wi="' + i + '"]', page); if (!it) return;
          var late = lateOf(r), txt = rangeText(r) + (late ? ' · 준공일 넘음' : '');
          it.classList.toggle('late', late);
          var sm = $('.jp-t small', it); if (sm) sm.textContent = txt;
          var dt = $('.jp-date', it); if (dt) dt.textContent = r.from ? rangeText(r) + ' · ' + spanDays(r.from, r.to) + '일' + (late ? ' · 준공일 넘음' : '') : '날짜 고르기';
          var db = $('.jp-datebtn', it); if (db) db.classList.toggle('late', late);
          var dy = $('.jp-days', it); if (dy) dy.textContent = (rows[i].days || '1') + '일';
          var bt = $('.jp-t b', it); if (bt) { bt.textContent = rows[i].name || '이름 없는 공정'; bt.classList.toggle('none', !rows[i].name); }
          var mn = $('[data-wstep="-1"]', it); if (mn) mn.disabled = (+rows[i].days || 1) <= 1;
        });
      }
      function drawRows(focusAt) {
        $('#wk-list', page).innerHTML = rowsHtml();
        if (focusAt != null) { var r = $('[data-wi="' + focusAt + '"] [data-wf="name"]', page); if (r) r.focus(); }
      }
      function drawAll() { drawGrid(); drawBar(); drawRows(); }
      // 맨 위 공사 카드: 상태 · 공사명 · 고객 · 공사 기간 + 다른 공사 / 고객 정보 / 계약서
      function jobCardHtml() {
        var sr = shownRange(), s0 = sr.from, e0 = sr.to;
        var st = k.status === 'done' ? ['done', '공사 완료'] : k.status === 'draft' || !locked ? ['draft', '계약 전'] : !s0 ? ['pre', '착공일 미정']
          : t0 < s0 ? ['pre', '착공 전'] : t0 <= (e0 || s0) ? ['now', '공사 중'] : ['late', '공사 기간 끝남'];
        var who = k.customer_name || (dc.customer && dc.customer.name) || '', ph = k.customer_phone || (dc.customer && dc.customer.phone) || '';
        return '<section class="txt-card job-card">' +
          '<div class="jc-top"><div class="jc-who"><span class="jc-st s-' + st[0] + '">' + st[1] + '</span>' +
          '<h2 class="jc-t">' + esc(k.title || dc.title || '공사') + '</h2>' +
          (who || ph ? '<p class="jc-c">' + esc(who ? who + ' 고객님' : '') + (ph ? (who ? ' · ' : '') + '<a href="' + esc(K.telHref(ph)) + '">' + esc(ph) + '</a>' : '') + '</p>' : '') + '</div>' +
          '<button type="button" class="btn btn-outline btn-sm jc-switch" data-jswitch>다른 공사</button></div>' +
          '<div class="jc-period">' + (locked
            ? '<p class="jp-line"><span class="label">공사 기간</span><b>' + esc(s0 ? sd(s0) : '착공일 미정') + (s0 && e0 === s0 ? '' : ' ~ ' + esc(e0 ? sd(e0) : '준공일 미정')) + '</b>' + (s0 && e0 ? '<span class="jp-n">' + spanDays(s0, e0) + '일' + (sr.byPhase ? ' · 세부 공사일정 기준' : '') + '</span>' : '') + '</p>'
            : '<div class="sf-row"><div class="field"><label for="job-start">착공일</label><input class="input" type="date" id="job-start" value="' + esc(start) + '"></div>' +
              '<div class="field"><label for="job-end">준공일</label><input class="input" type="date" id="job-end" data-min-from="job-start" value="' + esc(end) + '"></div></div>') + '</div>' +
          '<div class="jc-links">' + (k.customer_id ? '<a href="#/customer/' + encodeURIComponent(k.customer_id) + '">' + I.users + '<span>고객 정보</span></a>' : '') +
          '<a href="#/contract/' + encodeURIComponent(k.id) + '">' + I.doc + '<span>계약서 보기</span></a></div></section>';
      }

      page.innerHTML =
        jobCardHtml() +
        '<section class="job-cal"><div class="cal-top"><div class="cal-nav" id="job-nav">' + navHtml() + '</div></div>' +
        '<p class="hint job-tip">' + I.info + '<span>날짜를 <b>눌러서 끌거나</b>, 첫날과 끝날을 <b>차례로 누르면</b> 기간이 골라져요.</span></p>' +
        '<div class="cal-grid job-grid" id="job-grid">' + gridHtml() + '</div></section>' +
        '<section class="txt-card job-phases"><h3 class="job-h">세부 공사일정</h3><div class="wk-list" id="wk-list">' + rowsHtml() + '</div>' +
        '<button type="button" class="btn btn-outline est-addline" data-wadd>' + I.plus + '공정 추가</button></section>' +
        (others.length ? '<section class="job-others"><h3 class="job-h">이 공사의 다른 일정</h3><ul class="cal-list">' + others.filter(function (x, i, a) {
          return a.findIndex(function (y) { return y.src === x.src && y.id === x.id && y.title === x.title; }) === i;
        }).map(function (x) {
          var href = x.src === 'schedule' ? '#/calendar/' + x.from + '/s/' + encodeURIComponent(x.id) : x.href;
          return '<li class="' + (x.dim ? 'dim' : '') + '"><a href="' + esc(href) + '"><span class="cal-time">' + esc(md(x.from || x.date)) + (x.to && x.to !== x.from ? '<span>~' + esc(md(x.to)) + '</span>' : '') + '</span>' +
            '<span class="cal-kind k-' + esc(x.kind) + '">' + esc(KINDS[x.kind] ? KINDS[x.kind].label : '기타') + '</span><span class="cal-t"><b>' + esc(labelTitle(x.kind, x.title)) + '</b>' + (x.time ? '<small>' + esc(x.time) + '</small>' : '') + '</span><span class="go">열기</span></a></li>';
        }).join('') + '</ul></section>' : '') +
        // 고른 날짜 막대: 화면 맨 아래(저장 막대가 있으면 그 바로 위)에 붙음 — 달력 칸 밖에 둬야 PC에서도 화면 끝까지 따라옴
        '<div class="job-bar" id="job-bar" hidden></div>' +
        '<div class="savebar job-save" id="job-save" hidden><p class="msg" id="job-msg" hidden></p><span class="est-saved" id="job-state">저장 안 한 내용 있음</span><button type="button" class="btn btn-primary" data-jsave>저장</button></div>';   // 바꾼 게 있을 때만 보임

      /* ----- 아래에 붙는 두 막대(고른 날짜 막대 · 저장 막대): 실제 높이를 재서 겹치지 않게 차곡차곡 ----- */
      function dock() {
        var sb = $('#job-save', page), jb = $('#job-bar', page);
        page.style.setProperty('--sbh', (sb && !sb.hidden ? sb.offsetHeight : 0) + 'px');
        page.style.setProperty('--jbh', (jb && !jb.hidden ? jb.offsetHeight : 0) + 'px');
      }
      if (window.ResizeObserver) { var ro = new ResizeObserver(dock); ro.observe($('#job-save', page)); ro.observe($('#job-bar', page)); }
      window.addEventListener('resize', function onRz() { if (!page.isConnected) return window.removeEventListener('resize', onRz); dock(); });

      /* ----- 달력 끌기 · 누르기 ----- */
      var grid = $('#job-grid', page), drag = null;
      function dayAt(x, y) { var el = document.elementFromPoint(x, y); el = el && el.closest ? el.closest('[data-jday]') : null; return el && grid.contains(el) ? el.getAttribute('data-jday') : null; }
      function paintDrag() {   // 끄는 동안은 칸 색만 바꿈 (다시 그리면 손가락 아래 칸이 바뀜)
        var a = drag.a < drag.b ? drag.a : drag.b, b = drag.a < drag.b ? drag.b : drag.a;
        $$('[data-jday]', grid).forEach(function (c) { var d = c.getAttribute('data-jday'); c.classList.toggle('jpick', d >= a && d <= b); c.classList.toggle('jpick-s', d === a); c.classList.toggle('jpick-e', d === b); });   // 'pick' 은 사진 고르기 칸 이름과 겹쳐서 jpick
      }
      grid.addEventListener('pointerdown', function (e) {
        var c = e.target.closest('[data-jday]');
        if (!c || (e.pointerType === 'mouse' && e.button !== 0)) return;
        if (pick && !pick.single) return;       // 기간을 다 골랐으면 '선택 취소'를 누르기 전까지 달력은 그대로 (화면은 밀 수 있게)
        e.preventDefault();                     // 글자 선택·길게 누르기 메뉴 막기
        drag = { a: c.getAttribute('data-jday'), b: c.getAttribute('data-jday'), moved: false, id: e.pointerId };
        try { grid.setPointerCapture(e.pointerId); } catch (er) {}
        paintDrag();
      });
      grid.addEventListener('pointermove', function (e) {
        if (!drag || e.pointerId !== drag.id) return;
        var d = dayAt(e.clientX, e.clientY);
        if (d && d !== drag.b) { drag.b = d; drag.moved = true; paintDrag(); }
      });
      function endDrag(e, cancel) {
        if (!drag || (e && e.pointerId !== drag.id)) return;
        var d = drag; drag = null;
        if (cancel) { drawGrid(); return; }
        if (d.moved && d.a !== d.b) return setPick(d.a, d.b, false);
        // 눌렀다 뗌: 한 날만 고름 → 다음에 다른 날을 누르면 그날까지
        if (pick && pick.single && pick.from !== d.a) return setPick(pick.from, d.a, false);
        setPick(d.a, d.a, true);
      }
      grid.addEventListener('pointerup', function (e) { endDrag(e, false); });
      grid.addEventListener('pointercancel', function (e) { endDrag(e, true); });
      grid.addEventListener('contextmenu', function (e) { e.preventDefault(); });
      // 키보드(Enter·스페이스)로 누를 때 — 포인터 없이 오는 click 만
      grid.addEventListener('click', function (e) {
        if (e.detail !== 0) return;
        var c = e.target.closest('[data-jday]'); if (!c) return;
        if (pick && !pick.single) return;
        var d = c.getAttribute('data-jday');
        if (pick && pick.single && pick.from !== d) setPick(pick.from, d, false); else setPick(d, d, true);
        var again = $('[data-jday="' + d + '"]', grid); if (again) again.focus();
      });

      page.addEventListener('change', function (e) {
        var el = e.target;
        if (el.id === 'job-start' || el.id === 'job-end') {
          if (el.id === 'job-start') start = el.value; else end = el.value;
          dirty(); refreshRanges(); drawGrid(); if (pick) drawBar();
        }
      });
      page.addEventListener('input', function (e) {
        var el = e.target, f = el.getAttribute('data-wf');
        if (!f) return;
        var i = +el.closest('[data-wi]').getAttribute('data-wi'), row = rows[i];
        row[f] = f === 'days' ? String(Math.min(365, parseInt(String(el.value).replace(/[^0-9]/g, ''), 10) || 0) || '') : el.value;
        if (f === 'days' && el.value !== row.days) el.value = row.days;
        dirty();
        K.keepPos(el, function () { refreshRanges(); drawGrid(); if (pick) drawBar(); });   // 위 달력을 다시 그려도 쓰는 칸이 움직이지 않게
      });
      /* ----- 공정 줄을 손잡이(⋮⋮)로 잡고 끌어서 순서 바꾸기 -----
         잡은 줄은 손가락을 그대로 따라오고, 나머지 줄은 빈자리를 만들며 부드럽게 비켜남(transform 애니메이션).
         놓으면 잡은 줄이 빈자리로 미끄러져 들어간 뒤 순서를 바꿔 다시 그림 */
      var sortDrag = null;
      function sortLayout(d) {   // 지금 끼울 자리(to)에 맞춰 다른 줄들을 옮겨 놓고, 잡은 줄이 들어갈 자리 위치를 기억
        var order = d.items.map(function (x, i) { return i; }), top = d.rects[0].top;
        order.splice(d.from, 1); order.splice(d.to, 0, d.from);
        order.forEach(function (i) {
          if (i === d.from) d.slotTop = top; else d.items[i].style.transform = 'translateY(' + (top - d.rects[i].top) + 'px)';
          top += d.rects[i].h + d.gap;
        });
        return order;
      }
      function sortMove(clientY) {
        var d = sortDrag; d.y = clientY;
        var dy = clientY + window.scrollY - d.y0;
        if (Math.abs(dy) > 4) d.moved = true;
        d.it.style.transform = 'translateY(' + dy + 'px) scale(1.02)';
        var c = d.rects[d.from].top + dy + d.rects[d.from].h / 2, to = 0;
        d.rects.forEach(function (r, i) { if (i !== d.from && r.top + r.h / 2 < c) to++; });
        if (to !== d.to) { d.to = to; sortLayout(d); }
      }
      function sortScroll() {   // 화면 끝에 가까이 가면 저절로 올리기·내리기 (가까울수록 빠르게)
        if (!sortDrag) return;
        var y = sortDrag.y, h = window.innerHeight, v = y < 100 ? -Math.ceil((100 - y) / 6) : y > h - 120 ? Math.ceil((y - (h - 120)) / 6) : 0;
        if (v) { window.scrollBy(0, v); sortMove(y); }
        sortDrag.raf = requestAnimationFrame(sortScroll);
      }
      page.addEventListener('pointerdown', function (e) {
        var g = e.target.closest && e.target.closest('[data-wgrip]');
        if (!g || sortDrag || (e.pointerType === 'mouse' && e.button !== 0)) return;
        var it = g.closest('.jp-item'), box = $('#wk-list', page), items = $$('.jp-item', box);
        e.preventDefault();
        var rects = items.map(function (x) { var r = x.getBoundingClientRect(); return { top: r.top + window.scrollY, h: r.height }; });
        sortDrag = { it: it, box: box, items: items, rects: rects, gap: items.length > 1 ? rects[1].top - rects[0].top - rects[0].h : 8,
          from: items.indexOf(it), to: items.indexOf(it), y0: e.clientY + window.scrollY, y: e.clientY, id: e.pointerId, moved: false };
        try { g.setPointerCapture(e.pointerId); } catch (er) {}
        it.classList.add('dragging'); box.classList.add('sorting');
        items.forEach(function (x) { x.style.transition = x === it ? 'box-shadow .15s ease' : 'transform .2s cubic-bezier(.2,.7,.3,1)'; });
        sortDrag.raf = requestAnimationFrame(sortScroll);
      });
      page.addEventListener('pointermove', function (e) {
        if (!sortDrag || e.pointerId !== sortDrag.id) return;
        e.preventDefault(); sortMove(e.clientY);
      });
      function endSort(e, cancel) {
        if (!sortDrag || (e && e.pointerId !== sortDrag.id)) return;
        var d = sortDrag; sortDrag = null; cancelAnimationFrame(d.raf);
        var order = sortLayout(d);
        var same = cancel || !d.moved || order.every(function (v, i) { return v === i; });
        // 잡은 줄을 들어갈 자리(취소면 제자리)로 미끄러지게 한 뒤 다시 그림
        d.it.style.transition = 'transform .16s ease, box-shadow .16s ease';
        d.it.style.transform = 'translateY(' + ((same ? d.rects[d.from].top : d.slotTop) - d.rects[d.from].top) + 'px)';
        if (same) d.items.forEach(function (x) { if (x !== d.it) x.style.transform = ''; });
        setTimeout(function () {
          d.it.classList.remove('dragging'); d.box.classList.remove('sorting');
          if (same) { drawRows(); return; }
          var was = active;
          rows = order.map(function (i) { return rows[i]; });
          active = was == null ? null : order.indexOf(was);
          dirty(); drawAll();   // 안내 상자 없이 — 날짜는 순서대로 다시 이어짐
        }, 170);
      }
      page.addEventListener('pointerup', function (e) { endSort(e, false); });
      page.addEventListener('pointercancel', function (e) { endSort(e, true); });
      page.addEventListener('focusout', function (e) {   // 기간 칸을 비워 두고 나가면 1일로
        var el = e.target; if (el.getAttribute && el.getAttribute('data-wf') === 'days' && !el.value) { var i = +el.closest('[data-wi]').getAttribute('data-wi'); rows[i].days = '1'; el.value = '1'; refreshRanges(); drawGrid(); }
      });
      page.addEventListener('click', function (e) {
        var t = e.target, x;
        if ((x = t.closest('[data-jmon]'))) { var y = +mon.slice(0, 4), m = +mon.slice(5, 7) + +x.getAttribute('data-jmon'); mon = K.ymd(new Date(y, m - 1, 1)).slice(0, 7); K.state.backTo = '#/calendar/' + mon; drawGrid(); return; }
        if (t.closest('[data-jcancel]')) return clearPick();
        if (t.closest('[data-japply]')) return apply();
        if (t.closest('[data-jnew]') && pick) return openAddPhase({ from: pick.from, to: pick.to, picked: true });
        if (t.closest('[data-wadd]')) {   // 위 달력에서 고른 기간이 있으면 그 날짜로, 없으면 마지막 공정 다음 날(없으면 착공일·오늘)부터
          if (pick) return openAddPhase({ from: pick.from, to: pick.to, picked: true });
          var R1 = res(), last = R1.filter(function (h) { return h.to; }).map(function (h) { return h.to; }).sort().pop();
          var f0 = last ? K.addDays(last, 1) : (start || K.today());
          return openAddPhase({ from: f0, to: f0, picked: false });
        }
        if ((x = t.closest('[data-wopen]'))) {   // 줄을 누르면 펼치기 / 다시 누르면 접기
          var oi = +x.closest('[data-wi]').getAttribute('data-wi');
          active = active === oi ? null : oi;
          if (pick && active === oi) { pick = null; drawGrid(); drawBar(); }   // 있던 공정을 고치려고 펼치면 달력에서 고른 기간과 아래 '새 공정 추가' 막대는 닫음
          drawRows();
          var it = $('[data-wi="' + oi + '"]', page); if (it && active === oi && it.scrollIntoView) it.scrollIntoView({ block: 'nearest', behavior: 'smooth' });
          return;
        }
        if ((x = t.closest('[data-wstep]'))) {
          var si = +x.closest('[data-wi]').getAttribute('data-wi');
          rows[si].days = String(Math.max(1, Math.min(365, (+rows[si].days || 1) + +x.getAttribute('data-wstep'))));
          var inp = $('[data-wi="' + si + '"] [data-wf="days"]', page); if (inp) inp.value = rows[si].days;
          dirty(); K.keepPos(x, function () { refreshRanges(); drawGrid(); if (pick) drawBar(); }); return;
        }
        if ((x = t.closest('[data-wdel]'))) {
          var di = +x.closest('[data-wi]').getAttribute('data-wi');
          K.ask({ title: '이 공정을 뺄까요?', text: '<b>' + esc(rows[di].name || '이름 없는 공정') + '</b> · ' + esc(rangeText(res()[di])) + '<br><small>저장을 눌러야 계약서에 반영돼요.</small>', cancel: '그만두기', ok: '빼기', okClass: 'btn-danger' }).then(function (ok) {
            if (!ok) return;
            rows.splice(di, 1); active = null; dirty(); drawAll();
          });
          return;
        }
        if ((x = t.closest('[data-wdate]'))) {   // 공정 날짜 고르기 창
          var wi = +x.closest('[data-wi]').getAttribute('data-wi'), R0 = res(), r0 = R0[wi];
          var marks = {};
          R0.forEach(function (h, j) { if (j === wi || !h.from) return; days(h.from, h.to).forEach(function (d) { (marks[d] = marks[d] || []).push({ t: h.name || (j + 1) + '번 공정', c: phColor(j) }); }); });
          return openRangePicker({ title: (wi + 1) + '. ' + (rows[wi].name || '이름 없는 공정') + ' 날짜', from: r0.from, to: r0.to, color: phColor(wi),
            band: { from: start, to: end }, marks: marks,
            done: function (a, b2) { rows[wi].start = a; rows[wi].days = String(spanDays(a, b2)); active = wi; dirty(); drawAll(); K.toast((wi + 1) + '. ' + (rows[wi].name || '공정') + ': ' + sd(a) + (a !== b2 ? ' ~ ' + sd(b2) : '')); } });
        }
        if ((x = t.closest('[data-wfree]'))) { var fi = +x.closest('[data-wi]').getAttribute('data-wi'); rows[fi].start = ''; active = fi; dirty(); drawAll(); K.toast('앞 공정 다음 날로 이었어요'); return; }
        if ((x = t.closest('[data-wmv]'))) {
          var i = +x.closest('[data-wi]').getAttribute('data-wi'), j = i + +x.getAttribute('data-wmv');
          if (j < 0 || j >= rows.length) return;
          // 펼친 줄은 그대로 펼친 채 따라가고, 옮긴 줄은 손가락 밑에 그대로 남게 화면을 맞춤 (여러 번 눌러 계속 옮길 수 있게)
          var it0 = x.closest('[data-wi]'), top0 = it0.getBoundingClientRect().top, dir = x.getAttribute('data-wmv');
          var tmp = rows[i]; rows[i] = rows[j]; rows[j] = tmp;
          if (active === i) active = j; else if (active === j) active = i;
          dirty(); drawAll();
          var it1 = $('[data-wi="' + j + '"]', page);
          if (it1) {
            var d = it1.getBoundingClientRect().top - top0; if (Math.abs(d) > 1) window.scrollBy(0, d);
            it1.classList.add('moved'); setTimeout(function () { it1.classList.remove('moved'); }, 700);
            var nb = $('[data-wmv="' + dir + '"]', it1); if (nb && !nb.disabled) nb.focus({ preventScroll: true });
          }
          return;
        }
        if ((x = t.closest('[data-wr]'))) {   // 달력에서 날짜 바꾸기: 달력을 그 달로 옮기고 지금 기간을 골라 둠 → 끌어서 바꾸고 '여기에 넣기'
          var ri = +x.getAttribute('data-wr'), rr = res()[ri];
          active = ri;
          if (rr && rr.from) { mon = rr.from.slice(0, 7); pick = { from: rr.from, to: rr.to, single: false }; }
          drawAll();
          var g = $('.job-cal', page); if (g) g.scrollIntoView({ behavior: 'smooth', block: 'start' });
          return;
        }
        if (t.closest('[data-jsave]')) return save();
        if (t.closest('[data-jswitch]')) return openJobFinder(D, k.id, t.closest('[data-jswitch]'), '#/calendar/' + mon);
      });

      function save() {
        var msg = $('#job-msg', page); msg.hidden = true;
        if (!locked && start && end && end < start) { msg.textContent = '준공일이 착공일보다 빨라요.'; msg.hidden = false; return; }
        var out = rows.filter(function (h) { return String(h.name || '').trim(); }).map(function (h) { return { name: String(h.name).trim(), start: h.start || '', days: h.days || '1' }; });
        if (out.length < rows.length && rows.some(function (h) { return !String(h.name || '').trim() && h.start; })) {
          msg.textContent = '이름이 빈 공정이 있어요. 이름을 적거나 지워 주세요.'; msg.hidden = false; return;
        }
        dc.phases = resolveRows(out, start);
        if (!locked) { dc.start = start || ''; dc.end = end || ''; k.start_date = start || null; k.end_date = end || null; }
        k.doc = dc;
        var btn = $('[data-jsave]', page); btn.disabled = true;
        DB.saveContract(k).then(function (saved) {
          if (saved && saved.updated_at) k.updated_at = saved.updated_at;
          rows = out; if (active != null && active >= rows.length) active = null;
          K.setDirty(false); K.state.counts = null; btn.disabled = false;
          $('#job-save', page).hidden = true; dock();   // 저장하면 막대가 내려감 (검은 안내 상자는 띄우지 않음)
          drawAll();
        }).catch(function (err) { btn.disabled = false; msg.textContent = K.friendlyError(err); msg.hidden = false; });
      }
    }).catch(function (err) {
      app.innerHTML = '<div class="page"><div class="empty-box">공사일정을 불러오지 못했어요.<br>' + esc(K.friendlyError(err)) + '</div></div>';
    });
  }
  /* ---------- 날짜 고르기 창: 달력에서 첫날~끝날을 누르거나 끌어서 고름 ----------
     o = { title, from, to, color, band: { from, to } (공사 기간 바탕색), marks: { 날짜: [{ t, c }] } (다른 공정), done(from, to) } */
  function openRangePicker(o) {
    var t0 = K.today(), pick = o.from ? { from: o.from, to: o.to || o.from, single: false } : null;
    var mon = (o.from || (o.band && o.band.from) || t0).slice(0, 7);
    var ov = document.createElement('div');
    ov.className = 'overlay';
    ov.innerHTML = '<div class="sheet form-sheet rp-sheet" role="dialog" aria-modal="true" aria-labelledby="rp-t">' +
      '<h3 id="rp-t">' + esc(o.title || '날짜 고르기') + '</h3>' +
      '<p class="hint rp-tip"><b>눌러서 끌거나</b> 첫날·끝날을 <b>차례로 누르세요</b>. 다른 공정과 겹쳐도 돼요.</p>' +
      '<div class="cal-top"><div class="cal-nav" id="rp-nav"></div></div>' +
      '<div class="cal-grid job-grid rp-grid" id="rp-grid"></div>' +
      '<p class="rp-sum" id="rp-sum" aria-live="polite"></p>' +
      '<div class="btn-row"><button class="btn btn-outline" type="button" data-rpclose>취소</button><button class="btn btn-primary" type="button" data-rpok>이 날짜로</button></div></div>';
    document.body.appendChild(ov);
    var grid = $('#rp-grid', ov);
    function draw() {
      var y = +mon.slice(0, 4), m = +mon.slice(5, 7), first = new Date(y, m - 1, 1), st = new Date(y, m - 1, 1 - first.getDay()), cells = '';
      var pf = pick ? pick.from : '', pt = pick ? pick.to : '', bf = o.band && o.band.from, bt = o.band && (o.band.to || o.band.from);
      for (var i = 0; i < 42; i++) {
        var d = new Date(st.getFullYear(), st.getMonth(), st.getDate() + i), iso = K.ymd(d), list = (o.marks && o.marks[iso]) || [];
        var on = pf && iso >= pf && iso <= pt;   // 창 높이가 달마다 바뀌지 않게 늘 6주
        cells += '<button type="button" class="cal-cell' + (d.getMonth() !== m - 1 ? ' out' : '') + (iso === t0 ? ' today' : '') + (bf && iso >= bf && iso <= bt ? ' in-job' : '') +
          (on ? ' jpick' : '') + (iso === pf ? ' jpick-s' : '') + (iso === pt ? ' jpick-e' : '') + (d.getDay() === 0 ? ' sun' : d.getDay() === 6 ? ' sat' : '') + '" data-rday="' + iso + '" aria-label="' + esc(K.sDate(iso)) + '"' + (on ? ' aria-pressed="true"' : '') + '>' +
          // 칸 높이를 고정하려고 공정은 한 개만, 나머지는 오른쪽 위 '+n'
          '<span class="cal-n">' + d.getDate() + '</span>' + (list.length > 1 ? '<span class="rp-more" aria-hidden="true">+' + (list.length - 1) + '</span>' : '') +
          '<span class="cal-evs">' + list.slice(0, 1).map(function (x) {
            return '<span class="ev" style="--k:' + x.c + '"><em class="s">' + esc(x.t) + '</em><em class="f">' + esc(x.t) + '</em></span>';
          }).join('') + '</span></button>';
      }
      grid.innerHTML = '<div class="cal-wk">' + '일월화수목금토'.split('').map(function (w, i) { return '<span' + (i === 0 ? ' class="sun"' : i === 6 ? ' class="sat"' : '') + '>' + w + '</span>'; }).join('') + '</div><div class="cal-days job-days">' + cells + '</div>';
      $('#rp-nav', ov).innerHTML = '<button type="button" class="icon-btn" data-rpmon="-1" aria-label="이전 달">' + I.left + '</button><h2>' + y + '년 ' + m + '월</h2><button type="button" class="icon-btn" data-rpmon="1" aria-label="다음 달">' + I.right + '</button>';
      // 두 줄 자리를 늘 잡아 둬서 고를 때마다 창 높이가 바뀌지 않게
      $('#rp-sum', ov).innerHTML = '<span class="rp-s1">' + (pick ? '<b>' + esc(sd(pick.from) + (pick.to !== pick.from ? ' ~ ' + sd(pick.to) : '')) + '</b> · ' + spanDays(pick.from, pick.to) + '일' : '날짜를 골라 주세요.') + '</span>' +
        '<small class="rp-s2">' + (pick && pick.single ? '끝나는 날을 누르면 그날까지 골라져요.' : '') + '</small>';
      $('[data-rpok]', ov).disabled = !pick;
    }
    function setPick(a, b, single) { pick = { from: a < b ? a : b, to: a < b ? b : a, single: !!single }; draw(); }
    var drag = null;
    function dayAt(x, y) { var el = document.elementFromPoint(x, y); el = el && el.closest ? el.closest('[data-rday]') : null; return el && grid.contains(el) ? el.getAttribute('data-rday') : null; }
    function paint() {
      var a = drag.a < drag.b ? drag.a : drag.b, b = drag.a < drag.b ? drag.b : drag.a;
      $$('[data-rday]', grid).forEach(function (c) { var d = c.getAttribute('data-rday'); c.classList.toggle('jpick', d >= a && d <= b); c.classList.toggle('jpick-s', d === a); c.classList.toggle('jpick-e', d === b); });
    }
    grid.addEventListener('pointerdown', function (e) {
      var c = e.target.closest('[data-rday]');
      if (!c || (e.pointerType === 'mouse' && e.button !== 0)) return;
      e.preventDefault();
      drag = { a: c.getAttribute('data-rday'), b: c.getAttribute('data-rday'), moved: false, id: e.pointerId };
      try { grid.setPointerCapture(e.pointerId); } catch (er) {}
      paint();
    });
    grid.addEventListener('pointermove', function (e) {
      if (!drag || e.pointerId !== drag.id) return;
      var d = dayAt(e.clientX, e.clientY);
      if (d && d !== drag.b) { drag.b = d; drag.moved = true; paint(); }
    });
    grid.addEventListener('pointerup', function (e) {
      if (!drag || e.pointerId !== drag.id) return;
      var d = drag; drag = null;
      if (d.moved && d.a !== d.b) return setPick(d.a, d.b, false);
      if (pick && pick.single && pick.from !== d.a) return setPick(pick.from, d.a, false);
      setPick(d.a, d.a, true);
    });
    grid.addEventListener('pointercancel', function () { drag = null; draw(); });
    grid.addEventListener('contextmenu', function (e) { e.preventDefault(); });
    grid.addEventListener('click', function (e) {   // 키보드(Enter·스페이스)
      if (e.detail !== 0) return;
      var c = e.target.closest('[data-rday]'); if (!c) return;
      var d = c.getAttribute('data-rday');
      if (pick && pick.single && pick.from !== d) setPick(pick.from, d, false); else setPick(d, d, true);
      var again = $('[data-rday="' + d + '"]', grid); if (again) again.focus();
    });
    function close() { ov.remove(); }
    ov.addEventListener('click', function (e) {
      var x;
      if (e.target === ov || e.target.closest('[data-rpclose]')) return close();
      if ((x = e.target.closest('[data-rpmon]'))) { var y = +mon.slice(0, 4), m = +mon.slice(5, 7) + +x.getAttribute('data-rpmon'); mon = K.ymd(new Date(y, m - 1, 1)).slice(0, 7); draw(); return; }
      if (e.target.closest('[data-rpok]') && pick) { close(); o.done(pick.from, pick.to); }
    });
    ov.addEventListener('keydown', function (e) { if (e.key === 'Escape') close(); });
    draw();
    var f = $('.jpick-s', grid) || $('[data-rday]', grid); if (f && window.matchMedia && matchMedia('(hover: hover) and (pointer: fine)').matches) f.focus();
  }

  // 예전 주소·다른 화면에서 부르던 이름 그대로: 공사일정 화면으로 이동
  function openWork(kid) { K.go('#/calendar/k/' + encodeURIComponent(kid)); }

  K.routes.calendar = viewCalendar;
  /* ---------- 구글 캘린더에 일정 보이기 (구독 주소) ----------
     Netlify 함수 /api/calendar.ics 가 이 주소로 일정을 내보냄. 비밀 열쇠는 관리자 전용 설정(admin_settings 의 calendar_feed)에 저장 */
  var FEED_KEY = 'calendar_feed';
  function newToken() {
    var a = new Uint8Array(32); crypto.getRandomValues(a);
    return btoa(String.fromCharCode.apply(null, a)).replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/, '');
  }
  function feedUrl(token) { return new URL(K.siteUrl ? K.siteUrl('api/calendar.ics') : '/api/calendar.ics', location.href).href + '?key=' + encodeURIComponent(token); }
  function viewFeed() {
    K.frame('구글 캘린더에 일정 보이기', true, 'settings');
    K.state.backTo = '#/settings';
    app.innerHTML = '<div class="page"><div class="loading">불러오는 중…</div></div>';
    var live = !!DB.live;
    (live && DB.getAdminSetting ? DB.getAdminSetting(FEED_KEY).catch(function () { return null; }) : Promise.resolve(null)).then(function (cfg) {
      var token = cfg && cfg.token;
      var page = document.createElement('div');
      page.className = 'page set-page gcal-page';
      function draw() {
        page.innerHTML =
          '<div class="tip">' + I.info + '<span>일정 달력의 일정(공사 기간·세부 공사일정, 하자 현장 확인·보수, 상담 희망일, 직접 적은 일정)을 <b>구글 캘린더</b>에서도 볼 수 있게 하는 주소예요. ' +
          '<b>한 방향</b>이에요: 관리화면에서 바꾼 건 구글 캘린더에 반영되지만, 구글 캘린더에서 고친 건 여기로 오지 않아요.</span></div>' +
          '<div class="setting-box"><p class="setting-title">구독 주소</p>' +
          (!live ? '<p class="hint">미리보기(데모)에서는 주소를 만들 수 없어요. 실제 홈페이지(Netlify)에 올린 뒤 이 화면에서 만들어 주세요.</p>'
            : token ? '<div class="gcal-url"><input class="input" id="gcal-url" readonly value="' + esc(feedUrl(token)) + '" aria-label="구독 주소"></div>' +
              '<div class="gcal-btns"><button type="button" class="btn btn-primary" data-gcopy>' + I.copy + '주소 복사</button>' +
              '<button type="button" class="btn btn-outline" data-gnew>새 주소로 바꾸기</button>' +
              '<button type="button" class="btn btn-outline" data-goff>연결 끊기</button></div>' +
              '<p class="hint">이 주소를 아는 사람은 누구나 일정을 볼 수 있어요. 다른 사람에게 보내지 마세요. 새면 <b>새 주소로 바꾸기</b>를 누르세요(예전 주소는 바로 안 돼요).</p>'
              : '<button type="button" class="btn btn-primary" data-gnew>' + I.plus + '구독 주소 만들기</button>') +
          '</div>' +
          '<div class="setting-box"><p class="setting-title">구글 캘린더에 넣는 방법 (처음 한 번)</p><ol class="gcal-steps">' +
          '<li><b>컴퓨터</b>에서 구글 캘린더(calendar.google.com)를 열어요. 휴대폰 앱에서는 이 방법으로 넣을 수 없어요.</li>' +
          '<li>왼쪽 <b>다른 캘린더</b> 옆 <b>＋</b> → <b>URL로 추가</b>를 눌러요.</li>' +
          '<li>위의 주소를 붙여 넣고 <b>캘린더 추가</b>를 눌러요. 왼쪽에 <b>미디자인 일정</b>이 생겨요.</li>' +
          '<li>휴대폰 구글 캘린더 앱에 안 보이면 앱 설정에서 그 캘린더가 켜져 있는지 확인해요.</li></ol>' +
          '<p class="hint">구글 캘린더는 이 주소를 <b>몇 시간에 한 번</b>씩만 다시 읽어요. 바로 바뀐 일정은 관리화면 일정 달력에서 확인하세요.</p></div>' +
          '<div class="setting-box"><p class="setting-title">구글 캘린더에 나가는 내용</p><ul class="gcal-steps">' +
          '<li>날짜, 일정 이름, <b>손님 이름</b>이 나가요. 전화번호·주소·메모는 넣지 않아요.</li>' +
          '<li>주소를 아는 사람은 손님 이름과 일정을 볼 수 있으니, 주소는 부모님 구글 캘린더에만 넣고 다른 사람에게 보내지 마세요.</li>' +
          '<li>계약 중단·파기한 계약서와 상담 포기한 신청은 빠져요. 지난 90일 ~ 앞으로 400일 일정만 나가요.</li></ul></div>';
      }
      draw();
      app.innerHTML = ''; app.appendChild(page);
      function save(v, msg) {
        return DB.saveAdminSetting(FEED_KEY, v).then(function () { token = v.token; draw(); K.toast(msg); },
          function (err) { K.ask({ title: '저장하지 못했어요', text: esc(K.friendlyError(err)), cancel: false, ok: '확인' }); });
      }
      page.addEventListener('click', function (e) {
        if (e.target.closest('[data-gcopy]')) {
          K.copyFlash(e.target.closest('[data-gcopy]'), feedUrl(token), '주소');
          var inp = $('#gcal-url', page); if (inp) inp.select();
          return;
        }
        if (e.target.closest('[data-gnew]')) {
          if (!token) return save({ token: newToken(), at: new Date().toISOString() }, '구독 주소를 만들었어요');
          K.ask({ title: '새 주소로 바꿀까요?', text: '예전 주소는 <b>바로 안 돼요</b>. 구글 캘린더에서 예전 캘린더를 지우고 새 주소로 다시 넣어야 해요.', cancel: '그만두기', ok: '바꾸기' })
            .then(function (ok) { if (ok) save({ token: newToken(), at: new Date().toISOString() }, '새 주소로 바꿨어요'); });
          return;
        }
        if (e.target.closest('[data-goff]')) {
          K.ask({ title: '연결을 끊을까요?', text: '구글 캘린더에서 더는 새 일정을 받지 못해요. 구글 캘린더의 <b>미디자인 일정</b>도 지워 주세요.', cancel: '그만두기', ok: '끊기', okClass: 'btn-danger' })
            .then(function (ok) { if (ok) save({ token: null, at: new Date().toISOString() }, '연결을 끊었어요'); });
        }
      });
    });
  }
  K.routes.calfeed = viewFeed;

  window.CalendarKit = { labelTitle: labelTitle, upcoming: upcoming, dayRows: dayRows, load: load, collect: collect, openForm: openForm, openWork: openWork, KINDS: KINDS };
})();
