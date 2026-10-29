/* =====================================================================
   관리화면 — 보관 기간이 지난 개인정보 확인·삭제
   자동으로 지우지 않고, 보관 기간이 지난 자료를 여기에 모아 보여 줍니다. 부모님이 확인한 뒤 지웁니다.
   ★ 개인정보 보호법 제21조 제1항: 보유기간이 지나 필요 없게 된 개인정보는 '지체 없이' 파기해야 함
     (다른 법령에 보존 의무가 있으면 그 기간 동안 보관 가능). 이 화면에 뜬 자료는 미루지 말고 지워 주세요.
   보관 기간은 config.js 의 retention 과 개인정보 처리방침(privacy.html 2항)에 적은 기간과 같아야 합니다.
   ===================================================================== */
(function () {
  'use strict';
  var K = window.AdminKit;
  if (!K) return;
  var C = K.C, DB = K.DB, I = K.I, esc = K.esc, $ = K.$, $$ = K.$$;
  var app = document.getElementById('app');
  var R = Object.assign({ inquiryDays: 365, estimateDays: 365, contractDays: 2190, scheduleDays: 730, customerDays: 365 }, C.retention || {});

  function day(iso) { return iso ? String(iso).slice(0, 10) : ''; }
  function latest() { return Array.prototype.slice.call(arguments).filter(Boolean).map(day).sort().pop() || ''; }
  // 기준일 + 보관 일수 = 지워야 하는 날. 오늘보다 앞이면 '기간 지남'
  function due(base, days) { return base ? K.addDays(day(base), days) : ''; }

  function load() {
    return Promise.all([K.soft(DB.listInquiries), K.soft(DB.listEstimates), K.soft(DB.listContracts), K.soft(DB.listDefects), K.soft(DB.listSchedules), K.soft(DB.listCustomers), K.soft(DB.listRenderProjects)])
      .then(function (r) { return { inquiries: r[0], estimates: r[1], contracts: r[2], defects: r[3], schedules: r[4], customers: r[5], renders: r[6] }; });
  }
  // 그룹마다 기간이 지난 것만: [{ key, label, rule, items: [{ id, title, sub, due }] }]
  function expired(D) {
    var today = K.today(), cust = {};
    D.customers.forEach(function (c) { cust[c.id] = c; });
    function g(key, label, rule, list, fn) {
      var items = [];
      list.forEach(function (x) { var it = fn(x); if (it && it.due && it.due < today) items.push(it); });
      items.sort(function (a, b) { return a.due.localeCompare(b.due); });
      return { key: key, label: label, rule: rule, items: items };
    }
    var groups = [
      g('inquiries', '상담 신청', '상담 완료·상담 포기한 날(안 눌렀으면 신청한 날)부터 ' + R.inquiryDays + '일', D.inquiries, function (q) {
        return { id: q.id, title: q.name + ' · ' + (q.phone || ''), sub: K.fmtDate(q.created_at) + ' 신청' + (q.status === 'done' ? ' · 상담 완료' : q.status === 'dropped' ? ' · 상담 포기' : ''), due: due(q.done_at || q.created_at, R.inquiryDays) };
      }),
      g('estimates', '견적서', '마지막으로 고친 날부터 ' + R.estimateDays + '일', D.estimates, function (e) {
        return { id: e.id, title: (e.customer_name ? e.customer_name + ' · ' : '') + (e.title || '견적서'), sub: K.fmtDate(e.updated_at) + ' 고침 · ' + K.won(e.total) + '원', due: due(e.updated_at, R.estimateDays) };
      }),
      g('contracts', '계약서', '공사를 마친 날(없으면 마지막으로 고친 날)부터 ' + R.contractDays + '일 · 계약 중단은 마지막으로 고친 날부터 ' + R.estimateDays + '일', D.contracts, function (k) {
        if (k.status === 'canceled') return { id: k.id, title: (k.customer_name ? k.customer_name + ' · ' : '') + (k.title || '계약서'), sub: K.fmtDate(k.updated_at) + ' 계약 중단', due: due(k.updated_at, R.estimateDays) };
        return { id: k.id, title: (k.customer_name ? k.customer_name + ' · ' : '') + (k.title || '계약서'), sub: (k.end_date ? K.fmtDate(k.end_date) + ' 공사 완료' : K.fmtDate(k.updated_at) + ' 고침'),
          due: due(latest(k.end_date || k.updated_at, k.updated_at), R.contractDays) };
      }),
      g('defects', '하자 기록', '마지막 처리일부터 ' + R.contractDays + '일', D.defects, function (d) {
        var c = cust[d.customer_id];
        return { id: d.id, title: (c ? (c.name || c.phone) + ' · ' : '') + d.title, sub: K.fmtDate(d.received_on) + ' 접수', due: due(latest(d.done_on || d.repair_end || d.repair_on || d.check_on || d.received_on, d.updated_at), R.contractDays) };
      }),
      g('schedules', '일정', '일정 날짜가 지난 뒤 ' + R.scheduleDays + '일', D.schedules, function (s) {
        return { id: s.id, title: s.title, sub: K.fmtDate(s.start_on) + (s.place ? ' · ' + s.place : ''), due: due(s.end_on || s.start_on, R.scheduleDays) };
      }),
      // 3D 그림 (도면·그림 — 견적서와 같은 기간, 2026-10-28)
      g('render_projects', '3D 그림', '마지막으로 고친 날부터 ' + R.estimateDays + '일', D.renders || [], function (p) {
        return { id: p.id, title: p.title || '3D 그림', sub: K.fmtDate(p.updated_at) + ' 고침 · 그림 ' + (p.image_count || 0) + '장', due: due(p.updated_at, R.estimateDays) };
      }),
    ];
    // 고객: 남은 견적서·계약서·하자 기록·일정이 하나도 없고 오래 고치지 않은 경우
    var linked = {};
    [D.estimates, D.contracts, D.defects, D.schedules].forEach(function (list) { list.forEach(function (x) { if (x.customer_id) linked[x.customer_id] = true; }); });
    groups.push(g('customers', '고객', '남은 견적서·계약서·하자 기록·일정이 없고 마지막으로 고친 날부터 ' + R.customerDays + '일', D.customers.filter(function (c) { return !linked[c.id]; }), function (c) {
      return { id: c.id, title: (c.name || '이름 없음') + ' · ' + (c.phone || ''), sub: K.fmtDate(c.updated_at) + ' 고침', due: due(c.updated_at, R.customerDays) };
    }));
    return groups;
  }
  function count() { return load().then(function (D) { return expired(D).reduce(function (a, g) { return a + g.items.length; }, 0); }); }

  var DEL = { inquiries: 'deleteInquiry', estimates: 'deleteEstimate', contracts: 'deleteContract', defects: 'deleteDefect', schedules: 'deleteSchedule', customers: 'deleteCustomer', render_projects: 'deleteRenderProject' };

  function view() {
    K.frame('보관 기간 지난 자료', true, 'settings');
    K.state.backTo = '#/settings';
    app.innerHTML = '<div class="page"><div class="loading">불러오는 중…</div></div>';
    load().then(function (D) {
      var groups = expired(D), total = groups.reduce(function (a, g) { return a + g.items.length; }, 0);
      var page = document.createElement('div');
      page.className = 'page priv-page';
      page.innerHTML =
        '<div class="tip">' + I.info + '<span>보관 기간이 지난 손님 정보는 <b>바로 지워야</b> 해요(개인정보 보호법 제21조). 자동으로 지우지 않고 여기에 모아 두니, 확인하고 지워 주세요. 지운 자료는 되살릴 수 없어요.</span></div>' +
        (total ? '<div class="priv-top"><label class="est-check"><input type="checkbox" id="priv-all" checked><span>모두 고르기</span></label>' +
          '<span class="priv-n" id="priv-n"></span></div>' +
          groups.filter(function (g) { return g.items.length; }).map(function (g) {
            return '<section class="cust-sec priv-sec"><h2>' + esc(g.label) + ' <small>' + g.items.length + '건</small></h2><p class="hint">보관 기간: ' + esc(g.rule) + '</p>' +
              '<div class="cust-rows">' + g.items.map(function (it) {
                return '<label class="cust-row priv-row"><input type="checkbox" data-g="' + g.key + '" data-id="' + esc(it.id) + '" checked>' +
                  '<span class="t"><b>' + esc(it.title) + '</b><small>' + esc(it.sub) + ' · ' + esc(K.fmtDate(it.due)) + '에 기간 끝남</small></span></label>';
              }).join('') + '</div></section>';
          }).join('') +
          '<div class="savebar"><p class="msg" id="priv-msg" hidden></p><button class="btn btn-danger" type="button" data-pdel>' + I.trash + '<span id="priv-btn">고른 자료 지우기</span></button></div>'
          : '<div class="empty-box">보관 기간이 지난 자료가 없어요.<br>기간이 지난 자료가 생기면 관리화면 첫 화면에 알려 드려요.</div>') +
        '<section class="cust-sec"><h2>보관 기간</h2><ul class="priv-rules">' +
        groups.map(function (g) { return '<li><b>' + esc(g.label) + '</b> — ' + esc(g.rule) + '</li>'; }).join('') + '</ul>' +
        '<p class="hint">기간은 개인정보 처리방침에 적은 기간과 같아요. 바꾸려면 앤에게 알려 주세요(처리방침도 같이 고쳐야 해요).</p></section>';
      app.innerHTML = ''; app.appendChild(page);
      function picked() { return $$('[data-g]:checked', page); }
      function upd() {
        var n = picked().length, b = $('#priv-btn', page), t = $('#priv-n', page);
        if (b) b.textContent = n ? '고른 ' + n + '건 지우기' : '지울 자료를 골라 주세요';
        if (t) t.textContent = '전체 ' + total + '건 중 ' + n + '건 고름';
        var all = $('#priv-all', page); if (all) all.checked = n === total;
        $$('[data-pdel]', page).forEach(function (x) { x.disabled = !n; });
      }
      upd();
      page.addEventListener('change', function (e) {
        if (e.target.id === 'priv-all') $$('[data-g]', page).forEach(function (x) { x.checked = e.target.checked; });
        upd();
      });
      page.addEventListener('click', function (e) {
        if (!e.target.closest('[data-pdel]')) return;
        var list = picked().map(function (x) { return { g: x.getAttribute('data-g'), id: x.getAttribute('data-id') }; });
        if (!list.length) return;
        K.ask({ title: list.length + '건을 지울까요?', text: '보관 기간이 지난 자료라 <b>휴지통을 거치지 않고 바로</b> 지워요. 되돌릴 수 없어요.', cancel: '그만두기', ok: '지우기', okClass: 'btn-danger' }).then(function (ok) {
          if (!ok) return;
          var prog = K.progress('지우는 중');
          // 고객은 맨 마지막에 (하자 기록이 같이 지워지므로)
          list.sort(function (a, b) { return (a.g === 'customers') - (b.g === 'customers'); });
          var done = 0, failed = 0, chain = Promise.resolve();
          list.forEach(function (it) {
            chain = chain.then(function () {
              return DB[DEL[it.g]](it.id, { hard: true }).catch(function () { failed++; }).then(function () { done++; prog.set(done, list.length, done + ' / ' + list.length); });
            });
          });
          chain.then(function () {
            prog.close(); K.state.counts = null;
            if (failed) K.ask({ title: '일부를 지우지 못했어요', text: (list.length - failed) + '건은 지웠고 ' + failed + '건은 못 지웠어요. 인터넷 연결을 확인하고 다시 눌러 주세요.', cancel: false, ok: '확인' });
            else K.toast(list.length + '건을 지웠어요');
            view();
          });
        });
      });
    }).catch(function (err) {
      app.innerHTML = '<div class="page"><div class="empty-box">' + esc(K.friendlyError(err)) + '</div></div>';
    });
  }

  /* =====================================================================
     휴지통 (#/trash): 관리화면에서 지운 자료를 30일 동안 보관 → 되살리기 · 완전히 지우기
     ===================================================================== */
  var OPEN = { works: function (t) { return '#/work/' + t.item_id; }, reviews: function (t) { return '#/review/' + t.item_id; }, inquiries: function () { return '#/inquiries'; },
    estimates: function (t) { return '#/estimate/' + t.item_id; }, contracts: function (t) { return '#/contract/' + t.item_id; }, customers: function (t) { return '#/customer/' + t.item_id; },
    defects: function (t) { return '#/defect/' + t.item_id; }, schedules: function () { return '#/calendar'; }, files: function (t) { return '#/contract/' + t.item_id; },
    render_projects: function (t) { return '#/render/' + t.item_id; } };
  function viewTrash() {
    K.frame('휴지통', true, 'settings');
    K.state.backTo = '#/settings';
    app.innerHTML = '<div class="page"><div class="loading">불러오는 중…</div></div>';
    var DAYS = DB.TRASH_DAYS || 30, KINDS = DB.TRASH_KINDS || {};
    var kindSel = K.state.trashKind || '';
    // 열 때마다 30일 지난 것부터 정리
    (DB.purgeOldTrash ? DB.purgeOldTrash().catch(function () { return 0; }) : Promise.resolve(0)).then(function () { return DB.listTrash(); }).then(function (list) {
      var page = document.createElement('div');
      page.className = 'page priv-page trash-page';
      app.innerHTML = ''; app.appendChild(page);
      function left(t) { var n = Math.ceil((new Date(t.deleted_at).getTime() + DAYS * 864e5 - Date.now()) / 864e5); return Math.max(0, n); }
      function draw() {
        var kinds = {}; list.forEach(function (t) { kinds[t.kind] = (kinds[t.kind] || 0) + 1; });
        if (kindSel && !kinds[kindSel]) kindSel = '';
        var shown = list.filter(function (t) { return !kindSel || t.kind === kindSel; });
        page.innerHTML =
          '<div class="tip">' + I.info + '<span>관리화면에서 지운 자료는 여기에 <b>' + DAYS + '일</b> 동안 보관돼요. <b>되살리기</b>를 누르면 원래 자리로 돌아가요(사진·첨부 파일·연결된 하자 기록 포함). ' + DAYS + '일이 지나면 사진·파일까지 <b>완전히</b> 지워져요.</span></div>' +
          (list.length
            ? '<div class="trash-top"><label class="sr-only" for="trash-kind">종류</label><select class="select" id="trash-kind"><option value="">전체 (' + list.length + ')</option>' +
              Object.keys(KINDS).filter(function (k) { return kinds[k]; }).map(function (k) { return '<option value="' + k + '"' + (k === kindSel ? ' selected' : '') + '>' + esc(KINDS[k]) + ' (' + kinds[k] + ')</option>'; }).join('') + '</select>' +
              '<button type="button" class="btn btn-outline btn-sm trash-empty" data-tempty>' + I.trash + (kindSel ? '이 종류 비우기' : '휴지통 비우기') + '</button></div>' +
              '<div class="trash-list">' + shown.map(function (t) {
                var n = left(t);
                return '<div class="trash-row" data-tid="' + esc(t.id) + '"><div class="t"><span class="pill off">' + esc(KINDS[t.kind] || t.kind) + '</span><b>' + esc(t.title || '(이름 없음)') + '</b>' +
                  '<small>' + esc(K.fmtDate(t.deleted_at)) + ' 지움 · <span class="' + (n <= 3 ? 'warn' : '') + '">' + (n ? n + '일 뒤 완전히 지워져요' : '곧 완전히 지워져요') + '</span>' + ((t.files || []).length ? ' · 사진·파일 ' + t.files.length + '개' : '') + '</small></div>' +
                  '<div class="acts"><button type="button" class="btn btn-primary btn-sm" data-trestore>되살리기</button><button type="button" class="btn btn-outline btn-sm" data-tpurge>완전히 지우기</button></div></div>';
              }).join('') + '</div>'
            : '<div class="empty-box">휴지통이 비어 있어요.</div>');   // 비었을 때: 보관 기간 안내는 위 설명에 이미 있음 (같은 말 두 번 안 함)
      }
      draw();
      function reload(msg) { if (msg) K.toast(msg); K.state.counts = null; DB.listTrash().then(function (l) { list = l; draw(); }).catch(function () {}); }
      page.addEventListener('change', function (e) { if (e.target.id === 'trash-kind') { kindSel = K.state.trashKind = e.target.value; draw(); } });
      page.addEventListener('click', function (e) {
        var row = e.target.closest('[data-tid]'), t = row && list.filter(function (x) { return x.id === row.getAttribute('data-tid'); })[0], b;
        if ((b = e.target.closest('[data-trestore]')) && t) {
          b.disabled = true;
          return DB.restoreTrash(t.id).then(function () {
            var href = OPEN[t.kind] ? OPEN[t.kind](t) : '';
            reload('되살렸어요 · ' + (KINDS[t.kind] || '') + ' ' + (t.title || ''));
            if (href) setTimeout(function () { var tt = document.querySelector('.toast'); if (tt) tt.setAttribute('data-href', href); }, 0);
          }).catch(function (err) { b.disabled = false; K.ask({ title: '되살리지 못했어요', text: esc(err && err.message ? err.message : K.friendlyError(err)), cancel: false, ok: '확인' }); });
        }
        if ((b = e.target.closest('[data-tpurge]')) && t) {
          return K.ask({ title: '완전히 지울까요?', text: '<b>' + esc(t.title || '') + '</b><br>사진·파일까지 지워지고 <b>되돌릴 수 없어요.</b>', cancel: '그만두기', ok: '완전히 지우기', okClass: 'btn-danger' }).then(function (ok) {
            if (!ok) return;
            DB.purgeTrash([t.id]).then(function () { reload('완전히 지웠어요'); }).catch(function (err) { K.ask({ title: '지우지 못했어요', text: esc(K.friendlyError(err)), cancel: false, ok: '확인' }); });
          });
        }
        if (e.target.closest('[data-tempty]')) {
          var ids = list.filter(function (x) { return !kindSel || x.kind === kindSel; }).map(function (x) { return x.id; });
          if (!ids.length) return;
          return K.ask({ title: (kindSel ? (KINDS[kindSel] || '') + ' ' : '휴지통 ') + ids.length + '건을 완전히 지울까요?', text: '사진·파일까지 지워지고 <b>되돌릴 수 없어요.</b>', cancel: '그만두기', ok: '완전히 지우기', okClass: 'btn-danger' }).then(function (ok) {
            if (!ok) return;
            DB.purgeTrash(ids).then(function () { reload('휴지통을 비웠어요'); }).catch(function (err) { K.ask({ title: '지우지 못했어요', text: esc(K.friendlyError(err)), cancel: false, ok: '확인' }); });
          });
        }
      });
    }).catch(function (err) {
      app.innerHTML = '<div class="page"><div class="empty-box">휴지통을 열지 못했어요.<br>' + esc(err && err.message ? err.message : K.friendlyError(err)) + '</div></div>';
    });
  }
  K.routes.trash = viewTrash;

  /* =====================================================================
     저장 공간 — Supabase 무료 요금제에서 얼마나 썼고 얼마나 남았는지
     무료 한도(2026년 10월 Supabase 요금 안내 기준): 데이터베이스 500MB · 파일 저장소 1GB · 전송량 한 달 5GB
     데이터베이스·파일은 schema.sql 의 admin_usage 로 직접 셈. 전송량은 SQL로 알 수 없어 Supabase 화면에서 확인.
     ===================================================================== */
  var MB = 1024 * 1024, FREE = { db: 500 * MB, files: 1024 * MB, egress: 5 * 1024 * MB };
  var TABLE_KO = { works: '시공사례', reviews: '고객 후기', inquiries: '상담 신청', estimates: '견적서', contracts: '계약서', customers: '고객', defects: '하자 기록', render_projects: '3D 그림 작업', render_images: '3D 그림',
    schedules: '일정', trash: '휴지통', admin_settings: '관리 설정', site_settings: '홈페이지 설정', admins: '관리자 명단' };
  var BUCKET_KO = { photos: '홈페이지 사진 (시공사례·후기)', 'private-photos': '하자 사진·3D 그림', 'private-files': '계약서 첨부 파일' };
  function fmtBytes(n) {
    n = Number(n) || 0;
    if (!n) return '0 MB';
    if (n < MB) return Math.max(1, Math.round(n / 1024)) + ' KB';
    if (n < 1024 * MB) return (Math.round(n / MB * 10) / 10) + ' MB';
    return (Math.round(n / 1024 / MB * 100) / 100) + ' GB';
  }
  function pct(n, max) { return Math.min(100, Math.round((Number(n) || 0) / max * 1000) / 10); }
  // 첫 화면 알림·설정 카드용 (5분 동안은 다시 묻지 않음)
  function usageCheck(force) {
    var c = K.state.usage;
    if (!force && c && Date.now() - c.t < 300000) return Promise.resolve(c.v);
    if (!DB.usage) return Promise.reject(new Error('저장 공간을 확인할 수 없어요.'));
    return DB.usage().then(function (u) {
      var files = (u.buckets || []).reduce(function (a, b) { return a + (Number(b.bytes) || 0); }, 0);
      var v = { u: u, files: files, dbPct: pct(u.db_bytes, FREE.db), filesPct: pct(files, FREE.files) };
      v.max = Math.max(v.dbPct, v.filesPct);
      K.state.usage = { t: Date.now(), v: v };
      return v;
    });
  }
  function bar(p) { return '<div class="us-bar' + (p >= 80 ? ' hi' : p >= 60 ? ' mid' : '') + '" role="img" aria-label="' + p + '% 사용"><i style="width:' + Math.max(p, p > 0 ? 1 : 0) + '%"></i></div>'; }
  function viewUsage() {
    K.frame('저장 공간', true, 'settings');
    K.state.backTo = '#/settings';
    app.innerHTML = '<div class="page"><div class="loading">사용량을 세는 중…</div></div>';
    usageCheck(true).then(function (v) {
      var u = v.u, ref = (/^https:\/\/([a-z0-9]+)\.supabase\.co/i.exec(C.supabaseUrl || '') || [])[1];
      var known = (u.tables || []).filter(function (t) { return TABLE_KO[t.name]; }), etc = (u.tables || []).filter(function (t) { return !TABLE_KO[t.name]; });
      var etcBytes = etc.reduce(function (a, t) { return a + (Number(t.bytes) || 0); }, 0);
      var page = document.createElement('div');
      page.className = 'page us-page';
      page.innerHTML =
        (u.demo ? '<div class="tip">' + I.info + '<span><b>데모 화면</b>이라 이 브라우저에 저장된 양으로 어림한 값이에요. 실제 사이트에서는 Supabase에서 직접 센 값이 나와요.</span></div>' : '') +
        '<p class="us-lead">Supabase <b>무료 요금제</b> 한도: 데이터베이스 <b>500MB</b> · 파일 저장소 <b>1GB</b> · 전송량 한 달 <b>5GB</b> <small>(2026년 10월 Supabase 요금 안내 기준)</small></p>' +
        // 데이터베이스
        '<section class="txt-card us-card"><h2>데이터베이스 <small>글자로 된 자료</small></h2>' +
        '<p class="us-big"><b>' + fmtBytes(u.db_bytes) + '</b> / 500 MB <span class="us-p">' + v.dbPct + '%</span></p>' + bar(v.dbPct) +
        '<p class="us-left">남은 공간 약 <b>' + fmtBytes(Math.max(0, FREE.db - u.db_bytes)) + '</b></p>' +
        '<details class="us-more"><summary>어디에 쓰였나요</summary><ul class="us-list">' +
        known.map(function (t) { return '<li><span>' + esc(TABLE_KO[t.name]) + '</span><b>' + fmtBytes(t.bytes) + '</b></li>'; }).join('') +
        (etcBytes ? '<li><span>기타</span><b>' + fmtBytes(etcBytes) + '</b></li>' : '') +
        '</ul><p class="hint">상담 신청·견적서·계약서·고객 같은 글자 자료예요. 전체 크기에는 Supabase가 기본으로 쓰는 공간도 들어 있어서 위 목록을 더한 것보다 커요.</p></details></section>' +
        // 파일 저장소
        '<section class="txt-card us-card"><h2>파일 저장소 <small>사진·첨부 파일</small></h2>' +
        '<p class="us-big"><b>' + fmtBytes(v.files) + '</b> / 1 GB <span class="us-p">' + v.filesPct + '%</span></p>' + bar(v.filesPct) +
        '<p class="us-left">남은 공간 약 <b>' + fmtBytes(Math.max(0, FREE.files - v.files)) + '</b></p>' +
        '<ul class="us-list">' + ['photos', 'private-photos', 'private-files'].map(function (k) {
          var b = (u.buckets || []).filter(function (x) { return x.bucket === k; })[0] || { bytes: 0, files: 0 };
          return '<li><span>' + esc(BUCKET_KO[k]) + ' <small>' + (Number(b.files) || 0) + '개</small></span><b>' + fmtBytes(b.bytes) + '</b></li>';
        }).join('') + '</ul>' +
        '<p class="hint">휴지통에 있는 자료의 사진·파일도 30일 동안은 여기에 들어가요. 사진 한 장은 올릴 때 줄여서 보통 0.2~0.6MB예요(휴대폰 사진 기준 어림).</p></section>' +
        // 전송량
        '<section class="txt-card us-card"><h2>전송량 <small>한 달 5GB</small></h2>' +
        '<p>홈페이지에서 사진을 보거나 관리화면에서 자료를 불러올 때 오가는 양이에요. 이 화면에서는 셀 수 없어서 <b>Supabase 화면 → Usage</b>에서 확인해요.</p>' +
        '<div class="us-links"><a class="btn btn-outline" href="https://supabase.com/dashboard/org/_/usage" target="_blank" rel="noopener">사용량(Usage) 화면 열기</a>' +
        (ref ? '<a class="btn btn-outline" href="https://supabase.com/dashboard/project/' + esc(ref) + '" target="_blank" rel="noopener">이 프로젝트 열기</a>' : '') + '</div>' +
        '<p class="hint">무료 프로젝트는 1주일 동안 아무도 쓰지 않으면 일시 중지돼요. 무료 한도를 넘기면 Supabase가 요청을 막을 수 있어요(공정 사용 정책).</p></section>' +
        '<p class="hint us-at">' + esc(K.fmtWhen ? K.fmtWhen(u.at) : String(u.at || '')) + ' 기준 · <button type="button" class="btn-link" data-usre>다시 세기</button></p>';
      app.innerHTML = ''; app.appendChild(page);
      page.addEventListener('click', function (e) { if (e.target.closest('[data-usre]')) viewUsage(); });
    }).catch(function (err) {
      app.innerHTML = '<div class="page"><div class="empty-box">' + esc(K.friendlyError(err)) + '</div></div>';
    });
  }
  K.routes.usage = viewUsage;
  window.UsageKit = { check: usageCheck, fmt: fmtBytes };

  K.routes.privacy = view;
  window.PrivacyKit = { count: count, expired: expired, load: load, R: R };
})();
