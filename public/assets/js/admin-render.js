/* =====================================================================
   관리화면 — 3D 그림 (왼쪽 메뉴 '3D 그림')
   목록(#/renders) → 작업 화면(#/render/(작업 id))
   · 견적서를 고르면 공사 항목·자재·평수를 자동으로 불러옴 (금액·고객 정보는 그림에 쓰지 않음)
   · 그림에 넣을 공사 고르기(넣기/빼기) · 직접 넣을 내용 · 평수 · 도면 · 만들 공간 · 분위기 · 요청 사항
   · 견적서를 고치면 다음에 열 때 바뀐 내용을 저절로 다시 불러오고(넣기/빼기·직접 넣은 내용은 그대로),
     예전 내용으로 만든 그림에는 '예전 공사 내용' 표시 + '바뀐 내용으로 다시 만들기'
   · 그림 만들기: 서버 함수(/api/render)가 Claude 또는 Gemini(도면·공사 내용 읽기) + Gemini(그림)로 만들고, 이 화면은 몇 초마다 다시 읽음
   · 견적서 화면에는 아무것도 붙이지 않음 (견적서는 견적서대로)
   요청문·공간·분위기 목록·견적서에서 불러오는 방법은 render-prompts.js
   ===================================================================== */
(function () {
  'use strict';
  var K = window.AdminKit, RP = window.RenderPrompts, RW = window.RenderWalls || null;   // RW: 3D 밑그림 (render-walls.js)
  if (!K || !RP) return;
  var DB = K.DB, I = K.I, esc = K.esc, $ = K.$, $$ = K.$$;
  var app = document.getElementById('app');
  var POLL_MS = 3000;
  var PAL = '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round"><path d="M12 3a9 9 0 1 0 0 18c1.2 0 1.8-.8 1.8-1.7 0-1-.8-1.4-.8-2.4 0-1 .8-1.7 1.8-1.7H17a4 4 0 0 0 4-4C21 6.6 17 3 12 3Z"/><circle cx="7.5" cy="11" r="1.2"/><circle cx="10.5" cy="7.2" r="1.2"/><circle cx="15" cy="7.5" r="1.2"/></svg>';
  var STALE_QUEUED = 120e3;      // 2분이 지나도 시작을 안 했으면 → 시작하지 못한 것
  var STALE_RUNNING = 15 * 60e3; // 서버 함수는 15분까지만 돎

  var VI = {}; RP.VIEWS.forEach(function (v, i) { VI[v.key] = i; });
  function vi(r) { return VI[r.view] != null ? VI[r.view] : 99; }
  // 최근에 만든 것부터, 한 번에 만든 그림은 공간 순서(전체 조감도 → 거실 → …)대로
  function byNewest(a, b) { return (b.created_at || '').localeCompare(a.created_at || '') || vi(a) - vi(b) || (a.id < b.id ? -1 : 1); }
  function viewName(k) { var v = RP.viewOf(k); return v ? v.name : '3D 그림'; }
  function styleName(k) { return k ? RP.styleOf(k).name : ''; }
  function ms(iso) { var t = Date.parse(iso || ''); return isFinite(t) ? t : 0; }
  function age(r, col) { var t = ms(r[col] || r.created_at); return t ? Date.now() - t : 0; }
  function busy(r) { return r.status === 'queued' || r.status === 'running'; }
  // 이미 알기 쉬운 우리말 오류(이 화면·서버 함수가 만든 것 — 'AI 답을…'처럼 영어로 시작해도)는 그대로, 아니면 공통 안내로
  function friendly(e) { var m = String((e && e.message) || e || '').trim(); return /[가-힣]/.test(m) ? m : K.friendlyError(e); }
  function oops(title, err) { return K.ask({ title: title, text: esc(friendly(err)), cancel: false, ok: '확인' }); }
  function sign(paths) { paths = (paths || []).filter(Boolean); return paths.length && DB.signPhotos ? DB.signPhotos(paths) : Promise.resolve({}); }
  // 견적서 → 작업 이름 (고객 이름 · 공사명) — 관리화면에서만 보이고 AI에는 보내지 않음
  function titleOf(e) { return [e && e.customer_name, K.estTitle(e)].filter(Boolean).join(' · ').slice(0, 120); }
  // 견적서가 마지막으로 불러온 뒤에 고쳐졌는지
  function estChanged(p, e) { return !!(e && (!p.est_synced_at || ms(e.updated_at) > ms(p.est_synced_at) + 1000)); }
  function blankDoc() { return { size: '', sizeEst: '', items: [], custom: [], style: '', memo: '', views: ['overview'], cams: {}, walls: null, furn: {}, refs: [] }; }
  function normDoc(d) {
    d = Object.assign(blankDoc(), d || {});
    d.items = Array.isArray(d.items) ? d.items : []; d.custom = Array.isArray(d.custom) ? d.custom : [];
    d.views = (Array.isArray(d.views) ? d.views : []).filter(function (k) { return RP.viewOf(k); });
    // 카메라 위치: 공간마다 { x, y, tx, ty } (도면 그림 안의 비율 0~1, 전체 조감도는 없음)
    var cams = {}; Object.keys(d.cams && typeof d.cams === 'object' ? d.cams : {}).forEach(function (k) { var c = RP.camOf(d.cams[k]); if (c && k !== 'overview' && RP.viewOf(k)) cams[k] = c; });
    d.cams = cams;
    d.walls = RW ? RW.clean(d.walls) : (d.walls || null);   // 3D 밑그림용 벽 선 (도면 그림 안의 비율 0~1)
    d.furn = RP.furnOf(d.furn);    // 가구 위치 (카메라와 같은 방식: 놓을 곳 → 앞쪽)
    d.refs = RP.refsOf(d.refs);    // 현재 집 사진 (참고용) [{ path, view }]
    return d;
  }
  /** 견적서 내용을 작업에 넣기 (keep: 같은 견적서를 다시 불러올 때 넣기/빼기를 그대로) → 바뀐 점 목록 */
  function importEstimate(p, e, keep) {
    var f = RP.fromEstimate(e.doc), d = p.doc;
    var ch = keep ? RP.changes(d.items, f.items, d.sizeEst, f.size) : [];
    d.items = keep ? RP.mergeItems(d.items, f.items) : f.items;
    if (!keep || f.size !== d.sizeEst) { d.size = f.size; d.sizeEst = f.size; }   // 평수는 견적서 평수가 바뀌었을 때만 (직접 고친 값은 그대로)
    p.estimate_id = e.id; p.title = titleOf(e); p.est_synced_at = e.updated_at || new Date().toISOString();
    return ch;
  }

  /* ---------- 견적서 고르기 (찾아서 고르기 창) ---------- */
  var kd = function (d) { var m = /^(\d{4})-(\d{2})-(\d{2})/.exec(d || ''); return m ? m[1] + '.' + m[2] + '.' + m[3] : ''; };
  function pickEstimate(o) {
    return K.finder({ title: o.title || '견적서 고르기', ph: '고객 이름·전화번호·현장으로 찾기', cur: o.cur || '', focus: o.focus, empty: '만든 견적서가 없어요.', none: o.none,
      items: DB.listEstimates().then(function (l) {
        return l.map(function (e) {
          var di = K.dealItem('e', e);
          return { id: e.id, label: di.label, sub: di.sub, dim: e.status === 'stopped', keys: [e.customer_name, e.customer_phone, e.site_name, e.region, kd(e.estimate_date || String(e.created_at || '').slice(0, 10))].join(' ') };
        });
      }),
      onPick: o.onPick });
  }
  /** 견적서로 새 작업 (그 견적서로 만든 작업이 이미 있으면 그 작업으로) / 견적서 없이 */
  function startNew(focus) {
    pickEstimate({ title: '3D 그림 만들 견적서 고르기', focus: focus, none: '견적서 없이 직접 적기', onPick: function (it) {
      var make = it ? DB.listRenderProjects().then(function (ps) {
        var have = ps.filter(function (p) { return p.estimate_id === it.id; })[0];
        if (have) return have.id;
        return DB.getEstimate(it.id).then(function (e) {
          if (!e) throw new Error('견적서를 찾을 수 없어요. 이미 지웠을 수 있어요.');
          var p = { id: DB.newId(), doc: blankDoc() }; importEstimate(p, e, false);
          return DB.saveRenderProject(p).then(function (r) { return r.id; });
        });
      }) : DB.saveRenderProject({ id: DB.newId(), title: NOEST, doc: blankDoc() }).then(function (r) { return r.id; });
      make.then(function (id) { K.go('#/render/' + encodeURIComponent(id)); }, function (err) { oops('3D 그림을 시작하지 못했어요', err); });
    } });
  }

  /* =====================================================================
     목록
     ===================================================================== */
  var NOEST = '견적서 없이 만든 3D 그림';
  function viewList() {
    K.frame('3D 그림', false, 'renders');
    app.innerHTML = '<div class="page"><div class="loading">불러오는 중…</div></div>';
    Promise.all([DB.listRenderProjects(), K.soft(DB.listEstimates)]).then(function (r) {
      var list = r[0], est = {};
      (r[1] || []).forEach(function (e) { est[e.id] = e; });
      // 카드 이름: 연결된 견적서의 현장(아파트 이름 + 평수, 동·호수) — 견적서 목록 카드와 같게. 없으면 고객 이름, 그것도 없으면 저장된 이름
      function info(p) {
        var e = p.estimate_id && est[p.estimate_id];
        if (!e) return { e: null, name: p.title || NOEST, who: '' };
        var site = K.siteLabel((e.site_name || '') + (e.site_unit ? ', ' + e.site_unit : ''), e.site_size);
        return { e: e, name: site || (e.customer_name ? e.customer_name + ' 고객님' : K.estTitle(e)), who: site && e.customer_name ? e.customer_name + ' 고객님' : '' };
      }
      function findRec(p) {
        var x = info(p), e = x.e || {};
        return { phone: e.customer_phone || '', text: [x.name, p.title, e.customer_name, e.site_name, e.region, e.title].join(' '), date: K.ymd(new Date(p.updated_at)) };
      }
      function card(p) {
        var x = info(p);
        var pills = (p.busy_count ? '<span class="pill star">만드는 중 ' + p.busy_count + '장</span>' : '') +
          (x.e && estChanged(p, x.e) ? '<span class="pill warn">견적서가 바뀌었어요</span>' : '') +
          (!x.e && p.title && p.title.indexOf('견적서 없이') !== 0 ? '<span class="pill off">견적서 없음</span>' : '');   // 견적서가 지워진 것만 (처음부터 견적서 없이 만든 것은 이름에 나옴)
        return '<div class="item has-del rd-card">' +
          '<button class="item-del" type="button" data-pdel="' + esc(p.id) + '" aria-label="이 3D 그림 지우기">' + I.trash + '<span>지우기</span></button>' +
          '<a class="item-top rd-open" href="#/render/' + encodeURIComponent(p.id) + '"><div class="item-thumb rd-thumb" data-cover="' + esc(p.cover || '') + '">' + (p.cover ? '' : I.cube) + '</div>' +
          '<div class="item-txt"><div class="item-title">' + esc(x.name) + '</div>' +
          (x.who ? '<div class="rd-who">' + esc(x.who) + '</div>' : '') +
          '<div class="item-meta"><span>그림 ' + (p.image_count || 0) + '장 · ' + esc(K.sDate(K.ymd(new Date(p.updated_at))).replace(/\(.\)$/, '')) + ' 고침</span></div>' +
          (pills ? '<div class="rd-pills">' + pills + '</div>' : '') + '</div></a></div>';
      }
      var page = document.createElement('div');
      page.className = 'page rd-list-page';
      page.innerHTML =
        '<button type="button" class="btn btn-primary rd-new" data-rnew>' + I.plus + '<span>견적서로 3D 그림 만들기</span></button>' +
        '<div class="sec-head sh-1"><div class="sec-title"><h2>만든 3D 그림</h2></div></div>' +
        // 찾기: 이름·전화번호·아파트 한 칸만 (다른 메뉴와 같은 찾기 상자 모양)
        (list.length ? K.filterHtml('rdF', { ph: '이름·전화번호·아파트' }) + '<div class="list-tools"><p class="list-count" id="rd-n"></p></div>' : '') +
        '<div class="items rd-items" id="rd-items"></div>';
      app.innerHTML = ''; app.appendChild(page);
      var urls = {};
      function draw() {
        var shown = list.filter(function (p) { return K.filterMatch('rdF', findRec(p)); });
        var n = $('#rd-n', page); if (n) n.innerHTML = K.listCount(list.length, shown.length, K.filterActive('rdF'));
        $('#rd-items', page).innerHTML = list.length ? (shown.length ? shown.map(card).join('') : '<div class="empty-box">찾는 3D 그림이 없어요.<br>위 <b>조건 모두 지우기</b>를 누르면 전체가 보여요.</div>')
          : '<div class="empty-box">아직 만든 3D 그림이 없어요.<br>위의 <b>견적서로 3D 그림 만들기</b>를 눌러 시작해 보세요.</div>';
        // 작은 그림 (비공개 저장소 → 1시간짜리 주소)
        $$('[data-cover]', page).forEach(function (b) { var k = b.getAttribute('data-cover'); if (k && urls[k]) b.innerHTML = '<img src="' + esc(urls[k]) + '" alt="" loading="lazy">'; });
      }
      draw();
      if (list.length) K.filterBind(page, 'rdF', draw);
      sign(list.map(function (p) { return p.cover; })).then(function (u) { urls = u || {}; draw(); });
      page.addEventListener('click', function (ev) {
        var x;
        if ((x = ev.target.closest('[data-rnew]'))) return startNew(x);
        if ((x = ev.target.closest('[data-pdel]'))) {
          var id = x.getAttribute('data-pdel'), p = list.filter(function (y) { return y.id === id; })[0], nm = p ? info(p).name : '3D 그림';
          return K.ask({ title: '이 3D 그림을 지울까요?', text: '<b>' + esc(nm) + '</b> · 그림 ' + ((p && p.image_count) || 0) + '장<br>휴지통에 <b>30일</b> 동안 보관돼서 그동안은 <b>설정 → 휴지통</b>에서 되살릴 수 있어요. 견적서는 그대로예요.',
            cancel: '그만두기', ok: '지우기', okClass: 'btn-danger' }).then(function (ok) {
            if (!ok) return;
            DB.deleteRenderProject(id).then(function () { K.toast('휴지통으로 옮겼어요'); viewList(); }, function (err) { oops('지우지 못했어요', err); });
          });
        }
      });
    }).catch(function (err) {
      app.innerHTML = '<div class="page"><div class="empty-box">' + esc(friendly(err)) + '</div></div>';
    });
  }

  /* =====================================================================
     작업 화면
     ===================================================================== */
  function viewProject(id) {
    K.frame('3D 그림', true, 'renders');
    K.state.backTo = '#/renders';
    app.innerHTML = '<div class="page"><div class="loading">불러오는 중…</div></div>';
    Promise.all([DB.getRenderProject(id), DB.listRenderImages(id)]).then(function (r) {
      var p = r[0];
      if (!p) throw new Error('3D 그림을 찾을 수 없어요. 이미 지웠을 수 있어요.');
      return (p.estimate_id ? DB.getEstimate(p.estimate_id).catch(function () { return null; }) : Promise.resolve(null)).then(function (e) {
        // 예전 모양(세부 줄 없이 공사 항목만)으로 저장된 것은 견적서에서 세부 줄을 다시 불러옴
        var oldForm = ((p.doc && p.doc.items) || []).some(function (x) { return !Array.isArray(x.lines); });
        p.doc = normDoc(p.doc);
        // 견적서가 고쳐졌으면 바뀐 내용을 저절로 다시 불러옴 (넣기/빼기·직접 넣은 내용은 그대로)
        var note = null;
        if (e && (estChanged(p, e) || oldForm)) {
          var ch = importEstimate(p, e, true);
          if (ch.length && !oldForm) note = { at: e.updated_at, ch: ch };
          return DB.saveRenderProject(p).then(function (s) { p.updated_at = s.updated_at; return [p, e, r[1], note]; }, function () { return [p, e, r[1], note]; });
        }
        return [p, e, r[1], note];
      });
    }).then(function (x) { screen(x[0], x[1], x[2], x[3]); }).catch(function (err) {
      app.innerHTML = '<div class="page"><div class="empty-box">' + esc(friendly(err)) + '<br><a href="#/renders">3D 그림 목록으로</a></div></div>';
    });
  }

  function screen(p, est, images, note) {
    var page = document.createElement('div');
    page.className = 'page rd-page';
    app.innerHTML = ''; app.appendChild(page);
    var d = p.doc;
    var st = { rows: images.slice().sort(byNewest), urls: {}, working: false, timer: null, saveT: null, saving: null, planBusy: false, open: {}, pal: '', cam: '', camStep: '',
      // 3D 밑그림: wall 벽 고치는 중 · wtool 'pick'(고르기) | 'draw'(선 긋기) · wkind 그을 선 종류 · wsel 고른 선 · wa 긋기 시작점 · wh 되돌리기 · wbusy 벽 따는 중
      furn: '', add: '', refBusy: false,   // furn: 고른 가구(열쇠) · add: 새로 놓으려고 누른 가구 종류 · refBusy: 현재 집 사진 올리는 중
      wall: false, wtool: 'pick', wkind: 'w', wsel: -1, wa: null, wh: [], wbusy: false, ptr: null, drag: null, hover: null, gcache: {} };

    /* ----- 저장 (고칠 때마다 잠깐 뒤에 저절로) ----- */
    function persist(now) {
      clearTimeout(st.saveT);
      var run = function () {
        st.saving = DB.saveRenderProject(p).then(function (s) { p.updated_at = s.updated_at; }, function (err) { if (!now) oops('저장하지 못했어요', err); throw err; })
          .then(function () { st.saving = null; }, function (e) { st.saving = null; throw e; });
        return st.saving;
      };
      if (now) return (st.saving || Promise.resolve()).catch(function () {}).then(run);
      st.saveT = setTimeout(function () { run().catch(function () {}); }, 600);
      return Promise.resolve();
    }
    function picked() { return RP.VIEWS.filter(function (v) { return d.views.indexOf(v.key) >= 0; }).map(function (v) { return v.key; }); }
    function current() { return RP.compose(d); }
    function isOld(r) { return r.status === 'done' && !RP.sameContent(r.input, current()); }
    // 공간마다 가장 최근 그림이 예전 공사 내용이면 → '바뀐 내용으로 다시 만들기' 대상
    function staleViews() {
      var seen = {}, out = [];
      st.rows.forEach(function (r) {   // 최근 것부터
        if (seen[r.view] || r.status !== 'done') return;
        seen[r.view] = true; if (isOld(r)) out.push(r.view);
      });
      return out.sort(function (a, b) { return (VI[a] || 0) - (VI[b] || 0); });
    }

    /* ----- 그리기 ----- */
    function srcCard() {
      return '<div class="txt-card est-card rd-src"><span class="label ct-label" id="rd-src-l">견적서</span>' +
        (est ? '<a class="ct-est ct-est-go rd-est-link" href="#/estimate/' + encodeURIComponent(est.id) + '"><span>' + esc(titleOf(est)) + '</span><em class="ct-est-more">견적서 보기' + I.right + '</em></a>'
          : '<div class="field rd-name"><label for="rd-title">이름</label><input class="input" id="rd-title" maxlength="60" value="' + esc(p.title && p.title !== NOEST ? p.title : '') + '" placeholder="예) 김○○ 상담용"></div>' +   // 견적서 없이 만든 것은 목록에서 알아보게 이름
            '<p class="hint rd-noest">연결된 견적서가 없어요. 견적서를 고르면 공사 항목·자재·평수를 불러와요.</p>') +
        K.finderField('rd-est', { ph: est ? '다른 견적서로 바꾸기' : '견적서 찾기 (고객 이름·전화번호·현장)', go: est ? '바꾸기' : '찾기' }) +
        '</div>';
    }
    // 견적서 공사 항목(큰 단위)마다 체크 → 누르면 그 항목의 세부 줄 전체를 넣기/빼기. '세부 n/n'을 누르면 세부 줄을 펼쳐 하나씩 넣기/빼기
    function matsHtml() {
      return d.items.map(function (x) {
        var ls = RP.linesOf(x), stt = RP.itemState(x), open = !!st.open[x.key];
        var on = ls.filter(function (l) { return l.on; });
        var sum = stt === 'none' ? '그림에 안 넣음' : on.map(RP.lineText).join(', ');   // 색상·상세는 [ ] 로
        return '<div class="rd-mat st-' + stt + (open ? ' open' : '') + '">' +
          '<div class="rd-mat-h"><label class="rd-mat-c"><input type="checkbox" data-mk="' + esc(x.key) + '"' + (stt === 'all' ? ' checked' : '') + (stt === 'part' ? ' data-part' : '') + '>' +
          '<span class="t"><b>' + esc(x.name) + '</b>' + (sum && !open ? '<small>' + esc(sum) + '</small>' : '') + '</span></label>' +
          (ls.length ? '<button type="button" class="rd-mat-more" data-mopen="' + esc(x.key) + '" aria-expanded="' + open + '" aria-label="' + esc(x.name) + ' 세부 ' + (open ? '접기' : '펼치기') + '">세부 ' + on.length + '/' + ls.length + I.right + '</button>' : '') + '</div>' +
          (ls.length && open ? '<div class="rd-mat-ls">' + ls.map(function (l) { return lineHtml(x, l); }).join('') + '</div>' : '') + '</div>';
      }).join('');
    }
    // 세부 줄: 체크 + (넣은 줄이면) 색상·상세 칸 + 팔레트(누르면 색 이름·마감이 칸에 들어감)
    function lineHtml(x, l) {
      var key = esc(x.key), k = esc(l.k), pal = st.pal === x.key + '\n' + l.k;
      return '<div class="rd-mat-l' + (l.on ? ' on' : '') + '">' +
        '<label class="rd-mat-lc"><input type="checkbox" data-mkey="' + key + '" data-ml="' + k + '"' + (l.on ? ' checked' : '') + '><span>' + esc(l.text) + '</span></label>' +
        (l.on ? '<div class="rd-note"><input class="input" data-mnkey="' + key + '" data-mn="' + k + '" maxlength="' + RP.NOTE_MAX + '" value="' + esc(l.note || '') + '" placeholder="예) 화이트 무광" aria-label="' + esc(l.text) + ' 색상·상세">' +
          '<button type="button" class="rd-pal-btn' + (pal ? ' on' : '') + '" data-mpkey="' + key + '" data-mp="' + k + '" aria-expanded="' + pal + '" aria-label="' + esc(l.text) + ' 색 고르기">' + PAL + '<span>색</span></button>' + matPhoto(x, l) + '</div>' +
          (pal ? '<div class="rd-pal" role="group" aria-label="색·마감 고르기">' +
            RP.COLORS.map(function (c) { return '<button type="button" class="rd-sw' + (hasWord(l.note, c.name) ? ' on' : '') + '" data-sw="' + esc(c.name) + '" aria-pressed="' + hasWord(l.note, c.name) + '"><i style="background:' + esc(c.hex) + '"></i><span>' + esc(c.name) + '</span></button>'; }).join('') +
            RP.FINISHES.map(function (f) { return '<button type="button" class="rd-sw rd-fin' + (hasWord(l.note, f) ? ' on' : '') + '" data-sw="' + esc(f) + '" aria-pressed="' + hasWord(l.note, f) + '"><span>' + esc(f) + '</span></button>'; }).join('') + '</div>' : '') : '') +
        '</div>';
    }
    // 자재 사진 (선택): 세부 줄마다 한 장, 전부 합쳐 RP.MATS_MAX장까지 — 그림 AI가 그 색·무늬를 따라 그림
    function photoCount() { var n = 0; d.items.forEach(function (x) { RP.linesOf(x).forEach(function (l) { if (l.photo) n++; }); }); return n; }
    function matPhoto(x, l) {
      var key = esc(x.key), k = esc(l.k);
      if (l.photo) {
        var u = st.urls[l.photo];
        return '<span class="rd-mph">' + (u ? '<img src="' + esc(u) + '" alt="' + esc(l.text) + ' 자재 사진" data-rzoom data-rname="' + esc(l.text) + '">' : '') +
          '<button type="button" class="rd-mph-x" data-mphdel data-mphkey="' + key + '" data-mph="' + k + '" aria-label="' + esc(l.text) + ' 자재 사진 빼기">' + I.close + '</button></span>';
      }
      if (photoCount() >= RP.MATS_MAX || st.mphBusy === x.key + '\n' + l.k) return st.mphBusy === x.key + '\n' + l.k ? '<span class="rd-pal-btn rd-mph-wait" role="status">올리는 중…</span>' : '';
      return '<label class="rd-pal-btn rd-mph-add" aria-label="' + esc(l.text) + ' 자재 사진 넣기">' + I.camera + '<span>사진</span>' +
        '<input type="file" class="cf-input" data-mphkey="' + key + '" data-mph="' + k + '" accept="image/jpeg,image/png,image/webp,image/heic,image/heif"></label>';
    }
    function setMatPhoto(key, k, file) {
      var ln = lineOf(key, k); if (!ln || !window.ImageTools || st.mphBusy) return;
      st.mphBusy = key + '\n' + k; drawMats();
      window.ImageTools.single(file, 1200, 0.85).then(function (img) {
        return DB.uploadRenderPlan(p.id, img.blob).then(function (path) { st.urls[path] = URL.createObjectURL(img.blob); var l2 = lineOf(key, k); if (l2) l2.photo = path; return persist(true); });
      }).catch(function (err) { oops('자재 사진을 올리지 못했어요', err); }).then(function () { st.mphBusy = ''; drawMats(); });
    }
    function hasWord(note, w) { return (' ' + String(note || '').replace(/\s+/g, ' ').trim() + ' ').indexOf(' ' + w + ' ') >= 0; }
    function lineOf(key, k) { var it = itemOf(key); return it ? RP.linesOf(it).filter(function (l) { return l.k === k; })[0] : null; }
    function markPart() { $$('[data-part]', page).forEach(function (el) { el.indeterminate = true; }); }   // 세부 줄을 일부만 넣은 항목은 체크 칸에 '−'
    function drawMats() {
      var box = $('#rd-mats', page); if (!box) return;
      // 다시 그린 뒤에도 누르던 칸에 그대로 (자판으로 옮기는 중일 때)
      var a = document.activeElement, sel = '';
      if (a && box.contains(a)) [['data-ml', 'data-mkey'], ['data-mn', 'data-mnkey'], ['data-mp', 'data-mpkey'], ['data-mk'], ['data-mopen']].some(function (ks) {
        if (!a.hasAttribute(ks[0])) return false;
        sel = ks.map(function (k2) { return '[' + k2 + '="' + String(a.getAttribute(k2)).replace(/["\\]/g, '\\$&') + '"]'; }).join(''); return true;
      });
      box.innerHTML = matsHtml(); markPart();
      if (sel) { try { var f = box.querySelector(sel); if (f) f.focus({ preventScroll: true }); } catch (e) {} }
    }
    function itemOf(k) { return d.items.filter(function (x) { return x.key === k; })[0]; }
    function matCard() {
      return '<div class="txt-card est-card rd-mats-card"><span class="label ct-label">그림에 넣을 공사 내용</span>' +
        (d.items.length ? '<div class="rd-mats" id="rd-mats" role="group" aria-label="견적서에서 불러온 공사">' + matsHtml() + '</div>' : '') +
        '<span class="label rd-sub-l" id="rd-cust-l">직접 넣을 내용</span>' +
        (d.custom.length ? '<div class="rd-custs" aria-labelledby="rd-cust-l">' + d.custom.map(function (c, i) {
          return '<div class="rd-cust"><input class="input" data-cin="' + i + '" maxlength="' + RP.CUSTOM_LEN + '" value="' + esc(c) + '" aria-label="직접 넣을 내용 ' + (i + 1) + '">' +
            '<button type="button" class="est-x" data-cdel="' + i + '" aria-label="이 줄 지우기">' + I.trash + '</button></div>';
        }).join('') + '</div>' : '') +
        (d.custom.length < RP.CUSTOM_MAX ? '<div class="est-addcat rd-addc"><input class="input" id="rd-new" maxlength="' + RP.CUSTOM_LEN + '" placeholder="예) 거실 한쪽 벽 우드 포인트" aria-labelledby="rd-cust-l">' +
          '<button type="button" class="btn btn-outline" data-cadd>' + I.plus + '추가</button></div>' : '') +
        '<div class="field rd-size"><label for="rd-size">평수</label><div class="est-suffix"><input class="input" id="rd-size" inputmode="decimal" maxlength="6" value="' + esc(d.size) + '" placeholder="예) 32"><span>평</span></div></div>' +
        '</div>';
    }
    /* ----- 카메라 위치: 공간 단추를 누르고 도면에서 서 있을 곳 → 바라볼 곳을 차례로 누름 ----- */
    function camKeys() { return picked().filter(function (k) { return k !== 'overview'; }); }
    function camRow() {
      var ks = camKeys(); if (!ks.length || !p.plan_path) return '';
      if (st.cam && ks.indexOf(st.cam) < 0) { st.cam = ''; st.camStep = ''; }
      var tip = !st.cam ? '' : '<div class="rd-cam-tip" role="status"><span><b>' + esc(viewName(st.cam)) + '</b> · ' + (st.camStep === 'dir' ? '바라볼 쪽을 누르세요' : '도면에서 서 있을 곳을 누르세요') + '</span>' +
        (d.cams[st.cam] ? '<button type="button" class="rd-cam-clear" data-camclear>자동으로</button>' : '') + '</div>';
      return '<div class="rd-cam"><span class="rd-cam-l" id="rd-cam-l">카메라 위치 <span class="opt">(선택)</span></span>' +
        '<div class="rd-cam-chips" role="group" aria-labelledby="rd-cam-l">' + ks.map(function (k) {
          var on = st.cam === k, set = !!d.cams[k];
          return '<button type="button" class="rd-cam-chip' + (on ? ' on' : '') + (set ? ' set' : '') + '" data-cam="' + esc(k) + '" aria-pressed="' + on + '">' + (set ? I.check : '') + '<span>' + esc(viewName(k)) + '</span></button>';
        }).join('') + '</div>' + tip + '</div>';
    }
    // 도면 위에 카메라 표시 (그림과 같은 비율로 겹치는 svg — 도면은 object-fit: contain)
    function drawCams() {
      var img = $('#rd-plan-img', page), svg = $('#rd-cam-svg', page);
      if (!img || !svg) return;
      if (!img.naturalWidth) { img.addEventListener('load', drawCams, { once: true }); return; }
      applyZoom();
      // 표시 크기를 화면 픽셀로 맞춤 (도면이 커도 작아도 점·글자가 같은 크기로 보이게)
      var W = img.naturalWidth, H = img.naturalHeight, bx = img.getBoundingClientRect(), sc = Math.min(bx.width / W, bx.height / H), R = sc > 0 ? 1 / sc : Math.max(W, H) / 400;
      svg.setAttribute('viewBox', '0 0 ' + W + ' ' + H);
      var mk = function (id) { return '<marker id="' + id + '" class="' + id + '" viewBox="0 0 10 10" refX="6" refY="5" markerWidth="4" markerHeight="4" orient="auto"><path d="M0 0 10 5 0 10z"/></marker>'; };
      svg.innerHTML = '<defs>' + mk('rd-ah') + mk('rd-ah-on') + mk('rd-fah') + '</defs>' + furnSvg(W, H, R) +
        camKeys().filter(function (k) { return d.cams[k]; }).map(function (k) {
          var c = d.cams[k], x = c.x * W, y = c.y * H, on = st.cam === k ? ' on' : '';
          var arrow = c.tx != null ? '<line x1="' + x + '" y1="' + y + '" x2="' + (c.tx * W) + '" y2="' + (c.ty * H) + '" stroke-width="' + (2.5 * R) + '" marker-end="url(#rd-ah' + (on ? '-on' : '') + ')"/>' : '';
          return '<g class="rd-cam-mk' + on + '">' + arrow + '<circle cx="' + x + '" cy="' + y + '" r="' + (7 * R) + '" stroke-width="' + (2.5 * R) + '"/>' +
            '<text x="' + x + '" y="' + (y - 12 * R) + '" font-size="' + (13 * R) + '" stroke-width="' + (3.5 * R) + '">' + esc(viewName(k)) + '</text></g>';
        }).join('');
    }
    /* ----- 가구 위치: 단추를 누르고 도면에서 놓을 곳 → 앞쪽을 차례로 누름 (카메라와 같은 방식) -----
       기둥은 한 번(놓을 곳)만, 가벽은 한쪽 끝 → 다른 쪽 끝. 하부장·기둥·가벽은 여러 개(st.furn = 'col', 'col#2' …) */
    function keysOf(kind) { return RP.furnKeys(d.furn).filter(function (k) { return k.split('#')[0] === kind; }); }
    function nextKey(kind) { for (var n = 1; n <= RP.FURN_MULTI; n++) { var k = n === 1 ? kind : kind + '#' + n; if (!d.furn[k]) return k; } return ''; }
    var ROT_L = '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M4 4v6h6"/><path d="M4.5 10A8 8 0 1 1 6 17"/></svg>';
    var ROT_R = '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M20 4v6h-6"/><path d="M19.5 10A8 8 0 1 0 18 17"/></svg>';
    function numIn(attr, label, val, ph, name) {
      return '<label class="rd-wnum">' + label + '<input class="input" ' + attr + ' inputmode="decimal" maxlength="4" value="' + (val != null ? Number(val).toFixed(2).replace(/0$/, '') : '') + '"' + (ph ? ' placeholder="' + esc(ph) + '"' : '') + ' aria-label="' + esc(name + ' ' + label) + '(미터)"><span>m</span></label>';
    }
    function furnRow() {
      if (!p.plan_path || !st.urls[p.plan_path]) return '';
      var cur = st.furn && d.furn[st.furn], def = cur ? RP.furnDef(st.furn) : st.add ? RP.furnDef(st.add) : null, box = '';
      if (st.add && def) box = '<div class="rd-cam-tip rd-furn-tip" role="status"><span class="rd-furn-msg"><b>' + esc(def.name) + '</b> · ' +
        (def.fin ? (hasWalls() ? '마감할 벽의 방 쪽 가까이를 누르세요' : '도면에서 놓을 곳을 누르세요') : '도면에서 놓을 곳을 누르세요' + (hasWalls() && !def.axis && !def.nodir && !def.line ? ' (벽 가까이 누르면 벽에 붙어요)' : '')) + '</span></div>';
      else if (cur) {   // 고른 가구: 늘 같은 모양 — 이름 · 돌리기 · 크기 · 빼기 (옮기기·돌리기·크기는 도면에서 바로 끌어도 됨)
        var nm = def.name, ht = def.ht == null ? '천장' : String(def.ht), idx = def.multi && keysOf(def.key).length > 1 ? ' ' + (keysOf(def.key).indexOf(st.furn) + 1) : '';
        var size = def.line ? (hasWalls() ? numIn('data-fl', '길이', cur.L * d.walls.m, '', nm) : '') + numIn('data-fh', '높이', cur.h, '천장', nm)
          : def.nodir ? numIn('data-fw', '크기', cur.w, '', nm) + numIn('data-fh', '높이', cur.h, ht, nm)
            : def.mount ? numIn('data-fw', '크기', cur.w, '', nm) + numIn('data-fh', '거는 높이', cur.h, ht, nm)
            : numIn('data-fw', '가로', cur.w, '', nm) + numIn('data-fdp', '깊이', cur.dp, String(def.d), nm) + numIn('data-fh', '높이', cur.h, ht, nm);
        box = '<div class="rd-cam-tip rd-furn-tip" role="group" aria-label="' + esc(nm) + ' 고치기"><div class="rd-furn-hd"><span class="rd-furn-msg"><b>' + esc(nm + idx) + '</b> · 도면에서 끌어서 ' +
          (def.line ? '옮기고 양 끝 동그라미로 늘려요' : def.nodir ? '옮겨요' : '옮기고 동그라미로 돌려요') + '</span>' +
          '<button type="button" class="rd-cam-clear rd-furn-x" data-furnclear>빼기</button></div>' +
          '<div class="rd-furn-row">' + (def.nodir || def.fin ? '' : '<button type="button" class="rd-wbtn" data-frot="-90" aria-label="왼쪽으로 90도 돌리기">' + ROT_L + '<span>90°</span></button>' +
            '<button type="button" class="rd-wbtn" data-frot="90" aria-label="오른쪽으로 90도 돌리기">' + ROT_R + '<span>90°</span></button>') +
          (def.fin ? '<button type="button" class="rd-wbtn" data-fflip aria-label="벽의 반대쪽 면으로 옮기기">반대쪽 면</button>' : '') + size + '</div></div>';
      }
      var selKind = cur ? def.key : st.add;
      if (!st.ftab) st.ftab = cur || st.add ? def.g : RP.FURN_GROUPS[0].g;
      var gr = RP.FURN_GROUPS.filter(function (g) { return g.g === st.ftab; })[0] || RP.FURN_GROUPS[0];
      // 분류 탭 (거실 / 방 / 주방 / 욕실 / 구조·벽 / 조명·소품) — 놓은 개수를 작게
      var tabs = '<div class="fd-tabs rd-ftabs" role="tablist" aria-labelledby="rd-furn-l">' + RP.FURN_GROUPS.map(function (g) {
        var n = RP.furnKeys(d.furn).filter(function (k) { return RP.furnDef(k).g === g.g; }).length, on = g.g === gr.g;
        return '<button type="button" role="tab" class="fd-tab' + (on ? ' on' : '') + '" aria-selected="' + on + '" id="rd-ftab-' + g.g + '" data-ftab="' + g.g + '">' + esc(g.name) + (n ? '<small>' + n + '</small>' : '') + '</button>';
      }).join('') + '</div>';
      return '<div class="rd-cam rd-furn"><span class="rd-cam-l" id="rd-furn-l">가구·구조 위치 <span class="opt">(선택)</span></span>' + tabs +
        '<div class="rd-cam-chips rd-furn-chips" role="tabpanel" aria-labelledby="rd-ftab-' + gr.g + '">' + RP.FURN.filter(function (f) { return f.g === gr.g; }).map(function (f) {
          var on = selKind === f.key, n = keysOf(f.key).length;
          return '<button type="button" class="rd-cam-chip' + (on ? ' on' : '') + (n ? ' set' : '') + '" data-furn="' + esc(f.key) + '" aria-pressed="' + on + '">' + (n ? I.check : '') + '<span>' + esc(f.name) + (n > 1 ? ' ' + n : '') + '</span></button>';
        }).join('') + '</div>' + box + '</div>';
    }
    // 새로 놓기: 한 번 누르면 바로 놓이고 골라짐. 벽 선이 있으면 가까운 벽(1.2m 안)에 등을 붙이고 방 쪽을 보게
    function snapToWall(x, y, def) {
      var w = d.walls, ar = w.ar, m = w.m, best = null;
      w.s.forEach(function (g) {
        if (g[4] === 'o') return;
        var n = RW.nearSeg(x, y, g, ar);
        if (n.d * m < 1.2 && (!best || n.d < best.n.d)) best = { n: n, g: g };
      });
      if (!best) return null;
      var g = best.g, sx = g[2] - g[0], sy = (g[3] - g[1]) * ar, sl = Math.hypot(sx, sy) || 1, ux = -sy / sl, uy = sx / sl;   // 벽에 직각
      var vx = x - best.n.x, vy = (y - best.n.y) * ar; if (ux * vx + uy * vy < 0) { ux = -ux; uy = -uy; }   // 누른 쪽(방 쪽)으로
      var off = (0.075 + def.d / 2) / m, cx = best.n.x + ux * off, cy = (best.n.y * ar + uy * off) / ar;
      return { x: cl01(cx), y: cl01(cy), tx: cl01(cx + ux * 0.05), ty: cl01(cy + uy * 0.05 / ar) };
    }
    // 벽 마감 자리: 가까운 벽(1.2m 안)의 누른 쪽 면. 그 벽에 다른 벽이 만나는 곳(방 쪽으로 뻗은 벽)까지만 — 거실 벽을 누르면 거실 안 길이만큼
    // 선 방향: 가운데 → 끝(tx, ty)을 시계 방향으로 90° 돌린 쪽이 마감한 면 (render-prompts.js finNormal)
    function finLine(x, y) {
      var w = d.walls, ar = w.ar, m = w.m, best = null;
      w.s.forEach(function (g, i) { if (g[4] !== 'w') return; var n = RW.nearSeg(x, y, g, ar); if (n.d * m < 1.2 && (!best || n.d < best.n.d)) best = { n: n, i: i }; });
      if (!best) return null;
      var g = w.s[best.i], A = [g[0], g[1] * ar], ex = g[2] - g[0], ey = (g[3] - g[1]) * ar, sl = Math.hypot(ex, ey); if (sl < 1e-6) return null;
      var ux = ex / sl, uy = ey / sl, nx = -uy, ny = ux;
      if ((x - A[0]) * nx + (y * ar - A[1]) * ny < 0) { nx = -nx; ny = -ny; }   // 누른 쪽(방 쪽)
      var t0 = (x - A[0]) * ux + (y * ar - A[1]) * uy, lo = 0, hi = sl, th = 0.15 / m;
      w.s.forEach(function (h, j) {
        if (j === best.i) return;
        var loc = function (px, py) { var vx = px - A[0], vy = py * ar - A[1]; return [vx * ux + vy * uy, vx * nx + vy * ny]; };
        var P1 = loc(h[0], h[1]), P2 = loc(h[2], h[3]);
        if (Math.max(P1[1], P2[1]) < th || Math.min(P1[1], P2[1]) > th || Math.abs(P2[1] - P1[1]) < 1e-9) return;   // 방 쪽으로 뻗어 이 벽에 닿는 벽만
        var sc = P1[0] + (P2[0] - P1[0]) * (0 - P1[1]) / (P2[1] - P1[1]);
        if (sc < t0 - th && sc > lo) lo = sc; else if (sc > t0 + th && sc < hi) hi = sc;
      });
      if ((hi - lo) * m < 0.3) { lo = 0; hi = sl; }
      var off = (0.075 + 0.015) / m, mx = A[0] + ux * (lo + hi) / 2 + nx * off, my = A[1] + uy * (lo + hi) / 2 + ny * off, half = (hi - lo) / 2;
      var vx = ny, vy = -nx;   // 이쪽 끝을 tx 로 하면 마감 면 = 시계 방향 90°
      return { x: cl01(mx), y: cl01(my / ar), tx: cl01(mx + vx * half), ty: cl01((my + vy * half) / ar), L: Math.round(half * 2 * 1e4) / 1e4 };
    }
    function placeNew(kind, x, y, ar) {
      var def = RP.furnDef(kind), key = def.multi ? nextKey(kind) : kind; if (!key) return;
      var m = hasWalls() ? d.walls.m : 0, c = { x: x, y: y, ar: ar, w: def.w };
      var fl = def.fin && m ? finLine(x, y) : null;
      if (fl) Object.assign(c, fl);   // 벽 마감: 누른 쪽 벽면, 그 방 안의 길이만큼
      else if (def.line) { var half = (m ? 1.5 / m : 0.1) / 2; c.tx = cl01(x + half); c.ty = y; c.L = half * 2; }   // 가벽: 가로로 1.5m (양 끝을 끌어 고침)
      else if (def.axis) { c.tx = cl01(x + 0.05); c.ty = y; }   // 식탁·낮은 테이블: 긴 쪽이 가로
      else if (!def.nodir) {
        var sn = m ? snapToWall(x, y, def) : null;
        if (sn) Object.assign(c, sn); else { c.tx = x; c.ty = cl01(y + 0.05 / ar); }   // 벽이 없으면 앞쪽이 아래
      }
      var nf = {}; nf[key] = c;
      d.furn = RP.furnOf(Object.assign({}, d.furn, nf)); st.furn = d.furn[key] ? key : ''; st.add = ''; st.gcache = {};
      persist(); drawPlan();
    }
    // 놓은 가구 돌리기 (도면 그림 기준 시계 방향 +, 가벽은 가운데를 축으로)
    function rotFurn(key, deg) {
      var c = d.furn[key], f = RP.furnDef(key); if (!c || c.tx == null) return;
      var ar = c.ar || 1, dx = c.tx - c.x, dy = (c.ty - c.y) * ar, a = deg * Math.PI / 180;
      var nx = dx * Math.cos(a) - dy * Math.sin(a), ny = dx * Math.sin(a) + dy * Math.cos(a);
      if (!f.line) { var L = Math.hypot(nx, ny) || 1; nx = nx / L * 0.05; ny = ny / L * 0.05; }
      var cl = function (v) { return Math.max(0, Math.min(1, v)); };
      c.tx = cl(c.x + nx); c.ty = cl(c.y + ny / ar);
    }
    // 도면 위 가구: 벽 선이 있으면 실제 크기 네모(앞쪽은 굵은 선), 없으면 작은 네모 + 화살표. 가벽은 굵은 선, 기둥은 네모
    function furnPlacing() { return !!st.add; }
    function furnSvg(W, H, R) {
      var m = hasWalls() ? d.walls.m : 0, edit = !furnPlacing() && !st.wall;
      var hdl = function (key, role, hx, hy, shape) {   // 손잡이 (화면에서 같은 크기)
        var a = ' class="rd-fhd rd-fhd-' + role + (RP.furnDef(key).fin ? ' fin' : '') + '" data-fkey="' + esc(key) + '" data-fhd="' + role + '" stroke-width="' + (2.2 * R).toFixed(2) + '"';
        return shape === 'rect' ? '<rect' + a + ' x="' + (hx - 6.5 * R).toFixed(1) + '" y="' + (hy - 6.5 * R).toFixed(1) + '" width="' + (13 * R).toFixed(1) + '" height="' + (13 * R).toFixed(1) + '" rx="' + (2 * R).toFixed(1) + '"/>'
          : '<circle' + a + ' cx="' + hx.toFixed(1) + '" cy="' + hy.toFixed(1) + '" r="' + (8 * R).toFixed(1) + '"/>';
      };
      return RP.furnKeys(d.furn).map(function (key) {
        var f = RP.furnDef(key), c = d.furn[key], X = c.x * W, Y = c.y * H, on = st.furn === key ? ' on' : '', fx = 0, fy = 1;
        var label = '<text x="' + X.toFixed(1) + '" y="' + (Y + 4.5 * R).toFixed(1) + '" font-size="' + (12 * R) + '" stroke-width="' + (3.2 * R) + '">' + esc(f.name) + '</text>';
        if (f.line) {
          var ex = (2 * c.x - c.tx) * W, ey = (2 * c.y - c.ty) * H, sw = f.fin ? 6 * R : m ? Math.max(4 * R, 0.12 / m * W) : 5 * R;
          if (f.fin) {   // 이름은 마감한 면 쪽(방 안)으로 조금 띄워서
            var vx0 = (c.tx - c.x) * W, vy0 = (c.ty - c.y) * H, vl = Math.hypot(vx0, vy0) || 1, lx0 = X - vy0 / vl * 15 * R, ly0 = Y + vx0 / vl * 15 * R;
            label = '<text x="' + lx0.toFixed(1) + '" y="' + (ly0 + 4.5 * R).toFixed(1) + '" font-size="' + (12 * R) + '" stroke-width="' + (3.2 * R) + '">' + esc(f.name) + '</text>';
          }
          var hl = on && edit ? hdl(key, 'e1', ex, ey, 'circle') + hdl(key, 'e2', c.tx * W, c.ty * H, 'circle') : '';
          var dash = f.key === 'tile' ? ' stroke-dasharray="' + (6 * R).toFixed(1) + ' ' + (3 * R).toFixed(1) + '"' : f.key === 'brick' ? ' stroke-dasharray="' + (2.5 * R).toFixed(1) + ' ' + (2.5 * R).toFixed(1) + '"' : '';
          return '<g class="rd-fu rd-fu-line' + (f.fin ? ' rd-fu-fin' : '') + on + '" data-fkey="' + esc(key) + '"><line class="rd-fu-hit" x1="' + ex.toFixed(1) + '" y1="' + ey.toFixed(1) + '" x2="' + (c.tx * W).toFixed(1) + '" y2="' + (c.ty * H).toFixed(1) + '" stroke-width="' + Math.max(sw, 16 * R).toFixed(1) + '"/>' +
            '<line x1="' + ex.toFixed(1) + '" y1="' + ey.toFixed(1) + '" x2="' + (c.tx * W).toFixed(1) + '" y2="' + (c.ty * H).toFixed(1) + '" stroke-width="' + sw.toFixed(1) + '"' + dash + '/>' + label + '</g>' + hl;
        }
        if (c.tx != null) { var dx = (c.tx - c.x) * W, dy = (c.ty - c.y) * H, L = Math.hypot(dx, dy); if (L) { fx = dx / L; fy = dy / L; } }
        if (f.axis) { var lx = fx, ly = fy; fx = ly; fy = -lx; }   // 식탁: 화살표 쪽이 긴 쪽
        var rx = -fy, ry = fx, hw, hd;
        if (m) { hw = c.w / m * W / 2; hd = (f.nodir ? c.w : c.dp || f.d) / m * W / 2; } else { hw = f.nodir ? 6 * R : 10 * R; hd = 6 * R; }
        var P = function (a, b2) { return (X + rx * a + fx * b2).toFixed(1) + ',' + (Y + ry * a + fy * b2).toFixed(1); };
        var front = f.axis || f.nodir ? '' : '<line class="rd-fu-front" x1="' + P(-hw, hd).replace(',', '" y1="') + '" x2="' + P(hw, hd).replace(',', '" y2="') + '" stroke-width="' + (3.5 * R) + '"/>';
        var ax = f.axis ? rx : fx, ay = f.axis ? ry : fy, al = Math.max((f.axis ? hw : hd) + 12 * R, 22 * R);   // 앞쪽 화살표 (식탁은 긴 쪽 방향)
        var arrow = c.tx != null ? '<line class="rd-fu-arr" x1="' + X.toFixed(1) + '" y1="' + Y.toFixed(1) + '" x2="' + (X + ax * al).toFixed(1) + '" y2="' + (Y + ay * al).toFixed(1) + '" stroke-width="' + (2.2 * R) + '" marker-end="url(#rd-fah)"/>' : '';
        // 고른 가구: 동그라미(돌리기) · 네모(가로·깊이 — 벽 선이 있어 실제 크기를 알 때)
        var hl = '';
        if (on && edit) {
          if (!f.nodir) hl += hdl(key, 'rot', X + ax * (al + 4 * R), Y + ay * (al + 4 * R), 'circle');
          if (m) hl += f.nodir ? hdl(key, 'w', X + rx * hw + fx * hd, Y + ry * hw + fy * hd, 'rect') : hdl(key, 'w', X + rx * hw, Y + ry * hw, 'rect') + (f.mount ? '' : hdl(key, 'd', X - fx * hd, Y - fy * hd, 'rect'));
        }
        return '<g class="rd-fu' + on + '" data-fkey="' + esc(key) + '"><polygon points="' + [P(-hw, hd), P(hw, hd), P(hw, -hd), P(-hw, -hd)].join(' ') + '" stroke-width="' + (1.8 * R) + '"/>' + front + arrow + label + '</g>' + hl;
      }).join('');
    }
    // 밑그림에 넣을 가구 목록 (종류 이름 k, 가벽·식탁 표시)
    function furnList() {
      return RP.furnKeys(d.furn).map(function (key) { var f = RP.furnDef(key), c = d.furn[key]; return Object.assign({ k: f.key, line: !!f.line, axis: !!f.axis, dk: c.dp && f.d ? c.dp / f.d : 1 }, c); });
    }
    // 이 카메라에서 벽에 가리지 않는 가구·벽 마감 열쇠 (벽 선이 있을 때만 — 없으면 null: 거르지 않음). 가구는 가운데·네 모서리, 가벽·벽 마감은 선 위 다섯 곳 중 하나라도 보이면
    function visKeys(cam) {
      if (!hasWalls() || !RW || !RW.blocked || !cam) return null;
      var w = d.walls, m = w.m, ar = w.ar;
      return RP.furnKeys(d.furn).filter(function (key) {
        var f = RP.furnDef(key), c = d.furn[key], pts = [];
        if (f.line) { var ax = 2 * c.x - c.tx, ay = 2 * c.y - c.ty; [0.1, 0.3, 0.5, 0.7, 0.9].forEach(function (s) { pts.push([ax + (c.tx - ax) * s, ay + (c.ty - ay) * s]); }); }
        else {
          var fx = 0, fy = 1; if (c.tx != null) { var dx = c.tx - c.x, dy = (c.ty - c.y) * ar, L = Math.hypot(dx, dy); if (L) { fx = dx / L; fy = dy / L; } }
          if (f.axis) { var lx = fx; fx = fy; fy = -lx; }
          var hw = c.w / m / 2 * 0.8, hd = (f.nodir ? c.w : c.dp || f.d) / m / 2 * 0.8, rx = -fy, ry = fx;
          pts.push([c.x, c.y]); [[-1, -1], [1, -1], [1, 1], [-1, 1]].forEach(function (q) { pts.push([c.x + rx * hw * q[0] + fx * hd * q[1], c.y + (ry * hw * q[0] + fy * hd * q[1]) / ar]); });
        }
        return pts.some(function (q) { return !RW.blocked(w, cam.x, cam.y, q[0], q[1]); });
      });
    }
    // 그림 줄에 같이 저장할 것: 가구 자리, 크기(벽 선이 있을 때), 현재 집 사진
    function extras() {
      var x = {};
      if (Object.keys(d.furn).length) x.furn = d.furn;
      if (hasWalls()) x.scale = d.walls.m;
      if (d.refs.length) x.refs = d.refs;
      return x;
    }
    /* ----- 현재 집 사진 (참고용, 6장까지) — 공간을 고르면 그 공간 그림에 같이 보냄 ----- */
    var REF_VIEWS = [{ v: '', t: '공간 모름' }].concat(RP.VIEWS.filter(function (v) { return v.key !== 'overview'; }).map(function (v) { return { v: v.key, t: v.name }; }));
    function refsCard() {
      var rs = d.refs;
      return '<div class="txt-card est-card rd-refs" id="rd-refs-card"><span class="label ct-label">현재 집 사진 <span class="opt">(선택)</span></span>' +
        (rs.length ? '<div class="rd-ref-list">' + rs.map(function (r, i) {
          var u = st.urls[r.path];
          return '<div class="rd-ref"><div class="rd-ref-img">' + (u ? '<img src="' + esc(u) + '" alt="현재 집 사진 ' + (i + 1) + '" data-rzoom data-rname="현재 집 사진">' : '') +
            '<button type="button" class="rd-ref-x" data-refdel="' + i + '" aria-label="이 사진 빼기">' + I.close + '</button></div>' +
            K.dsel('rd-refv-' + i, REF_VIEWS, r.view, {}) + '</div>';
        }).join('') + '</div>' : '') +
        (rs.length < RP.REFS_MAX ? '<label class="btn btn-outline cf-add rd-ref-add' + (st.refBusy ? ' busy' : '') + '">' + I.plus + '<span>' + (st.refBusy ? '사진 올리는 중…' : '사진 추가 (' + rs.length + '/' + RP.REFS_MAX + ')') + '</span>' +
          '<input type="file" class="cf-input" id="rd-ref-file" accept="image/jpeg,image/png,image/webp,image/heic,image/heif" multiple' + (st.refBusy ? ' disabled' : '') + '></label>' : '') +
        '<p class="hint">창 크기·천장·기둥 모양을 AI가 참고해요. 사람·가족사진·주소가 보이지 않게 올려 주세요.</p></div>';
    }
    function drawRefs() { var el = $('#rd-refs-card', page); if (el) el.outerHTML = refsCard(); }
    function addRefs(files) {
      if (!window.ImageTools || st.refBusy) return;
      files = files.slice(0, RP.REFS_MAX - d.refs.length); if (!files.length) return;
      st.refBusy = true; drawRefs();
      var chain = Promise.resolve(), bad = 0;
      files.forEach(function (f) {
        chain = chain.then(function () {
          return window.ImageTools.single(f, 1600, 0.85).then(function (img) {
            return DB.uploadRenderPlan(p.id, img.blob).then(function (path) { st.urls[path] = URL.createObjectURL(img.blob); d.refs.push({ path: path, view: '' }); });
          }).catch(function () { bad++; });
        });
      });
      chain.then(function () { return persist(true); }).catch(function (err) { oops('사진을 저장하지 못했어요', err); })
        .then(function () { st.refBusy = false; drawRefs(); if (bad) oops('올리지 못한 사진이 있어요', new Error(bad + '장을 올리지 못했어요. 사진(JPG·PNG)인지 확인해 주세요.')); });
    }
    function drawPlan() { var el = $('#rd-plan-card', page); if (!el) return; el.outerHTML = planCard(); drawCams(); drawWalls(); }
    /* ----- 도면 확대·축소 (＋ − 단추, 두 손가락 벌리기·오므리기, Ctrl+휠) — 확대하면 도면 칸 안에서 밀어서 봄 ----- */
    var ZOOMS = [1, 1.5, 2, 3, 4], ZMAX = 4;
    var MINUS = '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.4" stroke-linecap="round"><path d="M5 12h14"/></svg>';
    var PLUS = '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.4" stroke-linecap="round"><path d="M12 5v14M5 12h14"/></svg>';
    function zoomBtns() {
      var z = st.zoom || 1;
      return '<div class="rd-zoom" role="group" aria-label="도면 크기"><button type="button" data-pzoom="-1" aria-label="도면 작게 보기"' + (z <= 1 ? ' disabled' : '') + '>' + MINUS + '</button>' +
        '<button type="button" data-pzoom="1" aria-label="도면 크게 보기"' + (z >= ZMAX ? ' disabled' : '') + '>' + PLUS + '</button></div>';
    }
    function zoomEls() {
      var box = $('.rd-plan-box', page), sc = box && $('.rd-plan-scroll', box), wrap = sc && $('.rd-cam-wrap', sc), img = $('#rd-plan-img', page);
      return box && sc && wrap && img ? { box: box, sc: sc, wrap: wrap, img: img } : null;
    }
    // 확대 배율을 화면에 맞춤: 도면 칸 높이는 그대로, 안쪽 그림만 z배 (좌표 계산은 그림 위치로 하므로 그대로 맞음)
    function applyZoom() {
      var e = zoomEls(); if (!e) return;
      var z = st.zoom || 1;
      e.box.classList.toggle('zoomed', z > 1);
      if (z <= 1) { e.sc.style.height = ''; e.wrap.style.width = ''; e.img.style.maxHeight = ''; return; }
      if (!e.img.naturalWidth) return;
      var bw = e.box.clientWidth, maxH = st.wall ? innerHeight * 0.72 : 360, baseH = Math.min(maxH, bw * e.img.naturalHeight / e.img.naturalWidth);
      e.sc.style.height = Math.round(baseH) + 'px';
      e.wrap.style.width = Math.round(bw * z) + 'px';
      e.img.style.maxHeight = Math.round(maxH * z) + 'px';
      if (!e.sc.hasAttribute('data-zr')) { e.sc.setAttribute('data-zr', ''); e.sc.scrollLeft = st.zsx || 0; e.sc.scrollTop = st.zsy || 0; }   // 다시 그려도 보던 곳 그대로
    }
    // z배로 (cx, cy: 화면에서 그 자리를 그대로 두고 키울 점 — 없으면 가운데)
    function setZoom(z, cx, cy, live) {
      var e = zoomEls(); if (!e || !e.img.naturalWidth) return;
      var z0 = st.zoom || 1; z = Math.max(1, Math.min(ZMAX, z)); if (Math.abs(z - z0) < 0.001) return;
      var r = e.sc.getBoundingClientRect(); if (cx == null) { cx = r.left + e.sc.clientWidth / 2; cy = r.top + e.sc.clientHeight / 2; }
      var px = (e.sc.scrollLeft + cx - r.left) / z0, py = (e.sc.scrollTop + cy - r.top) / z0;
      st.zoom = z; applyZoom();
      e.sc.scrollLeft = px * z - (cx - r.left); e.sc.scrollTop = py * z - (cy - r.top);
      st.zsx = e.sc.scrollLeft; st.zsy = e.sc.scrollTop;
      drawCams(); drawWalls();
      if (!live) { var zb = $('.rd-zoom', e.box); if (zb) zb.outerHTML = zoomBtns(); }
    }
    page.addEventListener('scroll', function (e) { var t = e.target; if (t.classList && t.classList.contains('rd-plan-scroll')) { st.zsx = t.scrollLeft; st.zsy = t.scrollTop; } }, true);
    page.addEventListener('wheel', function (e) {   // Ctrl(또는 ⌘)+휠 · 노트북 터치패드 벌리기
      if (!(e.ctrlKey || e.metaKey) || !e.target.closest || !e.target.closest('.rd-plan-scroll')) return;
      e.preventDefault(); setZoom((st.zoom || 1) * Math.exp(-e.deltaY * 0.01), e.clientX, e.clientY);
    }, { passive: false });
    page.addEventListener('touchstart', function (e) {   // 두 손가락: 벌리면 크게, 오므리면 작게, 같이 밀면 옮겨 봄
      if (e.touches.length !== 2) return;
      var sc = e.target.closest && e.target.closest('.rd-plan-scroll'); if (!sc) return;
      if (st.fdrag) { d.furn[st.fdrag.key] = st.fdrag.start; st.fdrag = null; }   // 한 손가락으로 끌던 것은 원래대로
      if (st.drag && d.walls) { d.walls = JSON.parse(st.drag.snap); st.drag = null; }
      st.ptr = null;
      var a = e.touches[0], b = e.touches[1], r = sc.getBoundingClientRect(), z0 = st.zoom || 1, mx = (a.clientX + b.clientX) / 2, my = (a.clientY + b.clientY) / 2;
      st.pinch = { d0: Math.hypot(a.clientX - b.clientX, a.clientY - b.clientY) || 1, z0: z0, px: (sc.scrollLeft + mx - r.left) / z0, py: (sc.scrollTop + my - r.top) / z0 };
    }, { passive: true });
    page.addEventListener('touchmove', function (e) {
      var g = st.pinch; if (!g || e.touches.length !== 2) return;
      e.preventDefault();
      var a = e.touches[0], b = e.touches[1], z = Math.max(1, Math.min(ZMAX, g.z0 * Math.hypot(a.clientX - b.clientX, a.clientY - b.clientY) / g.d0));
      var el = zoomEls(); if (!el) return;
      st.zoom = z; applyZoom();
      var r = el.sc.getBoundingClientRect();
      el.sc.scrollLeft = g.px * z - ((a.clientX + b.clientX) / 2 - r.left); el.sc.scrollTop = g.py * z - ((a.clientY + b.clientY) / 2 - r.top);
      st.zsx = el.sc.scrollLeft; st.zsy = el.sc.scrollTop;
      if (!st.pinchRaf) st.pinchRaf = requestAnimationFrame(function () { st.pinchRaf = 0; drawCams(); drawWalls(); });
    }, { passive: false });
    page.addEventListener('touchend', function (e) {
      if (!st.pinch || e.touches.length >= 2) return;
      st.pinch = null; st.pjust = Date.now();
      if ((st.zoom || 1) < 1.05) st.zoom = 1;
      drawPlan();
    });
    // 마우스: 확대했을 때 도면 빈 곳을 끌면 옮겨 봄 (가구 위에서 끌면 가구가 옮겨짐, 벽 고칠 때는 안 함)
    page.addEventListener('pointerdown', function (e) {
      if (e.pointerType !== 'mouse' || e.button !== 0 || (st.zoom || 1) <= 1 || st.wall || st.pinch || !e.target.closest) return;
      var sc = e.target.closest('.rd-plan-scroll'); if (!sc || e.target.closest('[data-fkey]')) return;
      st.pan = { sc: sc, sx: e.clientX, sy: e.clientY, l: sc.scrollLeft, t: sc.scrollTop, moved: false };
    });
    page.addEventListener('pointermove', function (e) {
      var g = st.pan; if (!g) return;
      if (!g.moved && Math.hypot(e.clientX - g.sx, e.clientY - g.sy) < 5) return;
      g.moved = true; g.sc.scrollLeft = g.l - (e.clientX - g.sx); g.sc.scrollTop = g.t - (e.clientY - g.sy);
    });
    page.addEventListener('pointerup', function () { var g = st.pan; if (!g) return; st.pan = null; if (g.moved) st.pjust = Date.now(); });
    function onResize() {
      if (!page.isConnected) { removeEventListener('resize', onResize); return; }
      if ((st.zoom || 1) > 1) { drawCams(); drawWalls(); }
    }
    addEventListener('resize', onResize);
    function camTap(e) {
      var img = $('#rd-plan-img', page); if (!img || !img.naturalWidth || !(st.cam || st.furn || st.add)) return;
      var b = img.getBoundingClientRect(), s = Math.min(b.width / img.naturalWidth, b.height / img.naturalHeight);
      var w = img.naturalWidth * s, h = img.naturalHeight * s, x = (e.clientX - b.left - (b.width - w) / 2) / w, y = (e.clientY - b.top - (b.height - h) / 2) / h;
      if (x < 0 || x > 1 || y < 0 || y > 1) return;
      var ar = img.naturalHeight / img.naturalWidth;   // 도면 세로/가로 — 바라보는 방위를 정확히 재려고
      if (st.add) return placeNew(st.add, x, y, ar);   // 가구 새로 놓기 (한 번에)
      if (!st.cam) { if (st.furn) { st.furn = ''; drawPlan(); } return; }   // 가구를 고른 채로 빈 곳을 누름 → 고르기 끝
      if (st.camStep !== 'dir') { d.cams[st.cam] = RP.camOf({ x: x, y: y, ar: ar }); st.camStep = 'dir'; }
      else {
        var c = RP.camOf({ x: d.cams[st.cam].x, y: d.cams[st.cam].y, tx: x, ty: y, ar: ar });
        if (c.tx == null) return;   // 서 있는 곳과 너무 가까우면 다시
        d.cams[st.cam] = c; st.cam = ''; st.camStep = '';
      }
      persist(); drawPlan();
    }
    // 카메라를 찍은 그림: 도면에 빨간 점·화살표·시야(부채꼴)를 그린 JPEG → AI가 방향을 그림으로도 봄
    // 도면 그림 불러오기 (그림으로 읽음 — 보안 설정(CSP)이 막는 fetch(blob:) 대신. 방금 올린 도면은 blob:, 다시 연 도면은 Supabase 주소)
    function planImage() {
      var src = st.urls[p.plan_path];
      if (!src) return Promise.reject(new Error('no plan'));
      return new Promise(function (ok, no) {
        var im = new Image(); im.crossOrigin = 'anonymous';
        im.onload = function () { ok(im); };
        im.onerror = function () { no(new Error('plan image')); };
        im.src = src;
      });
    }
    function markedPlan(c) {
      if (!c) return Promise.reject(new Error('no cam'));
      return planImage().then(function (im) {
        return new Promise(function (ok, no) {
            var W = im.naturalWidth, H = im.naturalHeight, M = Math.max(W, H), U = M / 100;
            var cv = document.createElement('canvas'); cv.width = W; cv.height = H;
            var x = cv.getContext('2d'); x.fillStyle = '#fff'; x.fillRect(0, 0, W, H); x.drawImage(im, 0, 0);
            var X = c.x * W, Y = c.y * H, RED = '#E0201C';
            if (c.tx != null) {
              var a = Math.atan2(c.ty * H - Y, c.tx * W - X), L = Math.max(Math.hypot(c.tx * W - X, c.ty * H - Y), 0.12 * M), R = Math.max(L * 1.15, 0.18 * M), h = ((RW ? RW.FOV : 70) / 2) * Math.PI / 180;   // 밑그림 시야각과 같게
              x.beginPath(); x.moveTo(X, Y); x.arc(X, Y, R, a - h, a + h); x.closePath();
              x.fillStyle = 'rgba(224,32,28,0.16)'; x.fill(); x.lineWidth = 0.25 * U; x.strokeStyle = 'rgba(224,32,28,0.55)'; x.stroke();
              var ex = X + Math.cos(a) * L, ey = Y + Math.sin(a) * L, hd = 2.4 * U;
              x.beginPath(); x.moveTo(X, Y); x.lineTo(ex - Math.cos(a) * hd * 0.6, ey - Math.sin(a) * hd * 0.6); x.lineWidth = 0.7 * U; x.strokeStyle = RED; x.lineCap = 'round'; x.stroke();
              x.beginPath(); x.moveTo(ex, ey); x.lineTo(ex - Math.cos(a - 0.45) * hd, ey - Math.sin(a - 0.45) * hd); x.lineTo(ex - Math.cos(a + 0.45) * hd, ey - Math.sin(a + 0.45) * hd); x.closePath(); x.fillStyle = RED; x.fill();
            }
            x.beginPath(); x.arc(X, Y, 1.3 * U, 0, Math.PI * 2); x.fillStyle = RED; x.fill(); x.lineWidth = 0.45 * U; x.strokeStyle = '#fff'; x.stroke();
            try { cv.toBlob(function (bl) { if (bl) ok(bl); else no(new Error('jpeg')); }, 'image/jpeg', 0.9); } catch (e) { no(e); }
        });
      });
    }
    /* ----- 3D 밑그림: 도면에서 벽 선을 따서(AI) 고치고, 카메라 자리에서 본 회색 밑그림을 그림 AI에 같이 보냄 ----- */
    var UNDO = '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M9 14 4 9l5-5"/><path d="M4 9h10.5a5.5 5.5 0 0 1 0 11H11"/></svg>';
    var SRC_TXT = { dims: '도면 치수로 크기 맞춤', size: '평수로 크기 어림', guess: '크기 어림', user: '크기 직접 맞춤' };
    function hasWalls() { return !!(RW && RW.has(d.walls)); }
    function canGuide(c) { return hasWalls() && c && c.tx != null; }
    function wallSum(w) {
      var n = { w: 0, d: 0, n: 0, g: 0 }; w.s.forEach(function (g) { n[g[4] === 'o' ? 'd' : g[4]]++; });
      var x0 = 1, x1 = 0, y0 = 1, y1 = 0; w.s.forEach(function (g) { x0 = Math.min(x0, g[0], g[2]); x1 = Math.max(x1, g[0], g[2]); y0 = Math.min(y0, g[1], g[3]); y1 = Math.max(y1, g[1], g[3]); });
      var size = x1 > x0 ? ' · 약 ' + ((x1 - x0) * w.m).toFixed(1) + '×' + ((y1 - y0) * w.ar * w.m).toFixed(1) + 'm' : '';
      return '벽 ' + n.w + ' · 문 ' + n.d + ' · 반창 ' + n.n + ' · 전체창 ' + n.g + size + ' (' + SRC_TXT[w.src] + ')';
    }
    function wallRow() {
      if (!RW || !p.plan_path || !st.urls[p.plan_path]) return '';
      if (st.wall && d.walls) return wallEditor();
      var head = '<span class="rd-cam-l">3D 밑그림 <span class="opt">(선택)</span></span>';
      var body = st.wbusy ? '<div class="rd-wall-busy" role="status"><span class="rd-spin" aria-hidden="true"></span><span>도면에서 벽을 따는 중… (30초쯤)</span></div>'
        : !d.walls || !d.walls.s.length ? '<div class="rd-wall-btns"><button type="button" class="btn btn-outline btn-sm" data-wauto>도면에서 벽 따기</button><button type="button" class="btn btn-outline btn-sm" data-wdraw>직접 그리기</button></div>'
          : '<p class="rd-wall-sum">' + esc(wallSum(d.walls)) + '</p><div class="rd-wall-btns"><button type="button" class="btn btn-outline btn-sm" data-wedit>벽 고치기</button>' +
            '<button type="button" class="btn btn-outline btn-sm" data-wauto>다시 따기</button><button type="button" class="btn btn-outline btn-sm rd-wall-x" data-wclear>' + I.trash + '<span>지우기</span></button></div>';
      return '<div class="rd-wall" id="rd-wall-row">' + head + body + '</div>';
    }
    function wallEditor() {
      var w = d.walls, sel = w.s[st.wsel], cur = sel ? sel[4] : st.wkind, kn = RW.KIND[st.wkind].name;
      var tip = st.wtool === 'draw' ? (st.wa ? '끝점을 누르세요' : '<b>' + esc(kn) + '</b> 선의 시작점을 누르세요' + (st.wkind !== 'w' ? ' · 벽 위에 그으면 그 부분이 ' + esc(kn) + '으로 바뀌어요' : ''))
        : sel ? '' : '선을 누르면 고를 수 있어요 · 고른 선은 끝점을 끌어 옮겨요';
      var tool = function (k, t) { var on = st.wtool === k; return '<button type="button" class="rd-wt' + (on ? ' on' : '') + '" data-wtool="' + k + '" aria-pressed="' + on + '">' + t + '</button>'; };
      return '<div class="rd-wall rd-wall-ed" id="rd-wall-row">' +
        '<div class="rd-wall-top"><span class="rd-cam-l">벽 고치기</span><button type="button" class="btn btn-primary btn-sm rd-wall-done" data-wdone>다 했어요</button></div>' +
        '<div class="rd-wall-tools"><div class="rd-seg" role="group" aria-label="고르기·선 긋기">' + tool('pick', '고르기') + tool('draw', '선 긋기') + '</div>' +
          '<button type="button" class="rd-wbtn" data-wundo' + (st.wh.length ? '' : ' disabled') + '>' + UNDO + '<span>되돌리기</span></button></div>' +
        '<div class="rd-wkinds" role="group" aria-label="선 종류">' + RW.KINDS.map(function (k) {
          var on = cur === k.k;
          return '<button type="button" class="rd-wk' + (on ? ' on' : '') + '" data-wk="' + k.k + '" aria-pressed="' + on + '"><i class="k-' + k.k + '" aria-hidden="true"></i><span>' + esc(k.name) + '</span></button>';
        }).join('') + '</div>' +
        (tip ? '<div class="rd-cam-tip rd-wall-tip" role="status"><span>' + tip + '</span>' + (st.wa ? '<button type="button" class="rd-cam-clear" data-wcancel>그만</button>' : '') + '</div>' : '') +
        (sel ? '<div class="rd-wsel"><span class="rd-wsel-k"><i class="k-' + sel[4] + '" aria-hidden="true"></i>고른 ' + esc(RW.KIND[sel[4]].name) + '</span>' +
          '<label class="rd-wnum">길이<input class="input" data-wlen inputmode="decimal" maxlength="6" value="' + RW.metres(sel, w).toFixed(2) + '" aria-label="고른 선의 실제 길이(미터)"><span>m</span></label>' +
          '<button type="button" class="rd-wbtn rd-wdel" data-wdel>' + I.trash + '<span>지우기</span></button></div>' +
          (w.src === 'size' || w.src === 'guess' ? '<p class="rd-wnote">크기가 어림값이에요 · 고른 선의 실제 길이를 넣으면 맞춰져요</p>' : '') : '') +
        '<label class="rd-wnum rd-wceil">천장 높이<input class="input" data-wceil inputmode="decimal" maxlength="4" value="' + w.h.toFixed(2) + '"><span>m</span></label>' +
        '</div>';
    }
    // 도면 위 벽 선 (카메라 표시와 같은 방식 — 그림 크기 그대로의 viewBox, 굵기는 화면 픽셀 기준)
    function drawWalls() {
      var img = $('#rd-plan-img', page), svg = $('#rd-wall-svg', page);
      if (!img || !svg) return;
      if (!img.naturalWidth) { img.addEventListener('load', drawWalls, { once: true }); return; }
      var W = img.naturalWidth, H = img.naturalHeight, bx = img.getBoundingClientRect(), sc = Math.min(bx.width / W, bx.height / H), R = sc > 0 ? 1 / sc : Math.max(W, H) / 400;
      svg.setAttribute('viewBox', '0 0 ' + W + ' ' + H);
      var w = d.walls; if (!w) { svg.innerHTML = ''; return; }
      var line = function (g, cls, sw) {
        return '<line class="' + cls + '" x1="' + (g[0] * W).toFixed(1) + '" y1="' + (g[1] * H).toFixed(1) + '" x2="' + (g[2] * W).toFixed(1) + '" y2="' + (g[3] * H).toFixed(1) + '" stroke-width="' + (sw * R).toFixed(2) + '"' +
          (g[4] === 'o' ? ' stroke-dasharray="' + (7 * R).toFixed(1) + ' ' + (5 * R).toFixed(1) + '"' : '') + '/>';
      };
      var dot = function (x, y, r, cls, extra) { return '<circle class="' + cls + '" cx="' + (x * W).toFixed(1) + '" cy="' + (y * H).toFixed(1) + '" r="' + (r * R).toFixed(1) + '"' + (extra || '') + '/>'; };
      var html = w.s.map(function (g, i) { return line(g, 'rd-wl k-' + g[4] + (st.wall && i === st.wsel ? ' sel' : ''), st.wall && i === st.wsel ? 7 : 4); }).join('');
      if (st.wall) {
        if (st.wtool === 'draw') w.s.forEach(function (g) { html += dot(g[0], g[1], 3, 'rd-wdot') + dot(g[2], g[3], 3, 'rd-wdot'); });
        var sel = w.s[st.wsel];
        var hs = ' stroke-width="' + (2.5 * R).toFixed(2) + '"';
        if (sel && st.wtool === 'pick') html += dot(sel[0], sel[1], 8, 'rd-whd', hs) + dot(sel[2], sel[3], 8, 'rd-whd', hs);
        if (st.wa) html += '<line class="rd-wrub" id="rd-wrub" x1="' + (st.wa[0] * W) + '" y1="' + (st.wa[1] * H) + '" x2="' + (st.wa[0] * W) + '" y2="' + (st.wa[1] * H) + '" stroke-width="' + (3 * R) + '"/>' + dot(st.wa[0], st.wa[1], 6, 'rd-wstart');
        if (st.wtool === 'draw') html += dot(-1, -1, 6, 'rd-whov', ' id="rd-whov"' + hs);
      }
      svg.innerHTML = html;
      svg.classList.toggle('dim', !st.wall);
      if (st.hover) drawHover();
    }
    // 선 긋는 중: 마우스를 따라 미리 보기 (붙는 자리 표시)
    function drawHover() {
      var img = $('#rd-plan-img', page), hv = $('#rd-whov', page), rb = $('#rd-wrub', page), q = st.hover;
      if (!img || !q || !img.naturalWidth) return;
      if (hv) { hv.setAttribute('cx', q[0] * img.naturalWidth); hv.setAttribute('cy', q[1] * img.naturalHeight); }
      if (rb) { rb.setAttribute('x2', q[0] * img.naturalWidth); rb.setAttribute('y2', q[1] * img.naturalHeight); }
    }
    function planPt(e) {   // 화면 → 도면 비율 0~1 (k = 화면에서 도면 가로 길이 px)
      var img = $('#rd-plan-img', page); if (!img || !img.naturalWidth) return null;
      var b = img.getBoundingClientRect(), s = Math.min(b.width / img.naturalWidth, b.height / img.naturalHeight), w = img.naturalWidth * s, h = img.naturalHeight * s;
      var x = (e.clientX - b.left - (b.width - w) / 2) / w, y = (e.clientY - b.top - (b.height - h) / 2) / h;
      return { x: Math.max(0, Math.min(1, x)), y: Math.max(0, Math.min(1, y)), k: w, out: x < -0.02 || x > 1.02 || y < -0.02 || y > 1.02 };
    }
    var TAN6 = Math.tan(6 * Math.PI / 180);
    // 붙이기: ① 가까운 끝점 ② (시작점·반대쪽 끝이 있으면) 가로·세로 맞춤 ③ 가까운 선 위
    function snapPt(pt, anchor, skip) {
      var w = d.walls, ar = w.ar, tE = 13 / pt.k, tS = 9 / pt.k, x = pt.x, y = pt.y, best = null;
      w.s.forEach(function (g, i) { [0, 2].forEach(function (e) {
        if (skip && skip(i, e)) return;
        var dd = Math.hypot(g[e] - x, (g[e + 1] - y) * ar); if (dd < tE && (!best || dd < best.d)) best = { d: dd, x: g[e], y: g[e + 1] };
      }); });
      if (best) return [best.x, best.y];
      if (anchor) { var dx = x - anchor[0], dy = (y - anchor[1]) * ar; if (Math.abs(dy) < Math.abs(dx) * TAN6) y = anchor[1]; else if (Math.abs(dx) < Math.abs(dy) * TAN6) x = anchor[0]; }
      var bs = null;
      w.s.forEach(function (g, i) { if (skip && skip(i)) return; var n = RW.nearSeg(x, y, g, ar); if (n.d < tS && (!bs || n.d < bs.d)) bs = n; });
      return bs ? [bs.x, bs.y] : [x, y];
    }
    function hitSeg(pt) {
      var w = d.walls, best = -1, bd = 14 / pt.k;
      w.s.forEach(function (g, i) { var n = RW.nearSeg(pt.x, pt.y, g, w.ar); if (n.d < bd) { bd = n.d; best = i; } });
      return best;
    }
    function wallSnap() { st.wh.push(JSON.stringify(d.walls)); if (st.wh.length > 40) st.wh.shift(); }
    function wallChanged() { st.gcache = {}; persist(); refreshWalls(); }
    // 벽 고치는 칸·도면 위 선·밑그림 미리보기만 다시 (도면 그림은 그대로)
    function refreshWalls() {
      var row = $('#rd-wall-row', page), html = wallRow();
      if (row && html) row.outerHTML = html;
      var gr = $('#rd-guide-row', page), gh = guideRow();
      if (gr) gr.outerHTML = gh || '<div id="rd-guide-row" hidden></div>';
      drawWalls();
    }
    function wallTap(pt) {
      var w = d.walls;
      if (st.wtool === 'pick') { st.wsel = hitSeg(pt); return refreshWalls(); }
      var q = snapPt(pt, st.wa);
      if (!st.wa) { st.wa = q; return refreshWalls(); }
      if (Math.hypot(q[0] - st.wa[0], (q[1] - st.wa[1]) * w.ar) * pt.k < 8) return;   // 같은 자리를 또 누름
      wallSnap();
      w.s = RW.cut(w.s, [st.wa[0], st.wa[1], q[0], q[1], st.wkind], w.ar);
      st.wa = null; st.hover = null; wallChanged();
    }
    // 도면 글자 대신 밝기만 (진한 벽선에 맞춰 붙이기 — 못 읽으면 붙이기 없이)
    function planPixels() {
      return planImage().then(function (im) {
        return new Promise(function (ok) {
          var W = im.naturalWidth, H = im.naturalHeight;
          try {
            var s = Math.min(1, 1400 / Math.max(W, H)), w = Math.max(1, Math.round(W * s)), h = Math.max(1, Math.round(H * s));
            var cv = document.createElement('canvas'); cv.width = w; cv.height = h;
            var x = cv.getContext('2d'); x.fillStyle = '#fff'; x.fillRect(0, 0, w, h); x.drawImage(im, 0, 0, w, h);
            var a = x.getImageData(0, 0, w, h).data, lum = new Uint8Array(w * h);
            for (var i = 0; i < w * h; i++) lum[i] = (a[i * 4] * 299 + a[i * 4 + 1] * 587 + a[i * 4 + 2] * 114) / 1000;
            ok({ W: W, H: H, px: { lum: lum, w: w, h: h } });
          } catch (e) { ok({ W: W, H: H, px: null }); }
        });
      }).catch(function () { return null; });
    }
    function extract() {
      if (!RW || !p.plan_path || st.wbusy) return;
      var go = d.walls && d.walls.s.length ? K.ask({ title: '벽을 다시 딸까요?', text: '지금 벽 선은 지워지고 AI가 도면에서 새로 따요.', cancel: '그만두기', ok: '다시 따기' }) : Promise.resolve(true);
      go.then(function (ok) {
        if (!ok) return;
        var path = p.plan_path;
        st.wbusy = true; st.wall = false; st.cam = ''; st.camStep = ''; drawPlan();
        return Promise.all([DB.extractWalls(p.id, path), planPixels()]).then(function (r) {
          if (p.plan_path !== path || !page.isConnected) return;   // 그사이 도면을 바꿈
          var img = $('#rd-plan-img', page), px = r[1];
          var W = (px && px.W) || (img && img.naturalWidth), H = (px && px.H) || (img && img.naturalHeight);
          var w = RW.fromAI(r[0], W, H, { px: px && px.px, size: d.size });
          if (!w || !w.s.length) throw new Error('도면에서 벽을 찾지 못했어요. 직접 그려 주세요.');
          d.walls = w; st.wh = []; st.wsel = -1; st.wa = null; st.wall = true; st.wtool = 'pick'; st.gcache = {};
          return persist(true).then(function () {
            if (r[0] && r[0].partial) return K.ask({ title: '벽을 일부만 땄어요', text: 'AI 답이 길어서 중간에 끊겼어요. 빠진 벽은 <b>선 긋기</b>로 그려 주세요.', cancel: false, ok: '확인' });
          });
        }).catch(function (err) { oops('벽을 따지 못했어요', err); })
          .then(function () { st.wbusy = false; if (page.isConnected) drawPlan(); });
      });
    }
    function startDraw() {
      var img = $('#rd-plan-img', page); if (!RW || !img || !img.naturalWidth) return;
      d.walls = RW.clean({ ar: img.naturalHeight / img.naturalWidth, m: 12, h: RW.CEIL, src: 'guess', s: [] });
      st.wall = true; st.wtool = 'draw'; st.wkind = 'w'; st.wsel = -1; st.wa = null; st.wh = []; st.cam = ''; st.camStep = '';
      drawPlan();
    }
    function endWalls() {
      st.wall = false; st.wa = null; st.wsel = -1; st.hover = null; st.drag = null;
      if (d.walls && !d.walls.s.length) d.walls = null;
      st.gcache = {}; persist(); drawPlan();
    }
    // 밑그림 미리보기 (카메라 위치·바라볼 쪽을 찍은 공간마다)
    function guideUrl(k, big) {
      var c = d.cams[k], key = (big ? 'B' : 's') + k + JSON.stringify(c) + JSON.stringify(d.furn);
      if (!big && st.gcache[key]) return st.gcache[key];
      var r = RW.raster(d.walls, c, big ? { ss: 2, furn: furnList() } : { w: 320, h: 240, furn: furnList() });
      if (!r) return '';
      var cv = document.createElement('canvas'); cv.width = r.w; cv.height = r.h;
      cv.getContext('2d').putImageData(new ImageData(r.data, r.w, r.h), 0, 0);
      var u = cv.toDataURL('image/jpeg', big ? 0.9 : 0.85);
      if (!big) st.gcache[key] = u;
      return u;
    }
    function guideRow() {
      if (!hasWalls() || st.wall) return '';
      var ks = camKeys().filter(function (k) { return canGuide(d.cams[k]); });
      if (!ks.length) return camKeys().length ? '<p class="rd-guide-none" id="rd-guide-row">카메라 위치와 바라볼 쪽을 찍은 공간은 밑그림대로 그려요</p>' : '';
      return '<div class="rd-guides" id="rd-guide-row"><span class="rd-cam-l">밑그림 미리보기</span><div class="rd-guide-list">' + ks.map(function (k) {
        var u = guideUrl(k);
        return '<button type="button" class="rd-guide" data-gzoom="' + esc(k) + '" aria-label="' + esc(viewName(k)) + ' 밑그림 크게 보기">' + (u ? '<img src="' + esc(u) + '" alt="">' : '') + '<span>' + esc(viewName(k)) + '</span></button>';
      }).join('') + '</div></div>';
    }
    // 그림 AI에 보낼 밑그림 (1024×768 JPEG)
    function guideBlob(c) {
      return new Promise(function (ok, no) {
        var r = RW.raster(d.walls, c, { ss: 2, furn: furnList() }); if (!r) return no(new Error('no guide'));
        var cv = document.createElement('canvas'); cv.width = r.w; cv.height = r.h;
        cv.getContext('2d').putImageData(new ImageData(r.data, r.w, r.h), 0, 0);
        cv.toBlob(function (b) { if (b) ok(b); else no(new Error('jpeg')); }, 'image/jpeg', 0.9);
      });
    }
    /* ----- 도면 위 가구를 바로 고르고 끌기: 몸통 = 옮기기, 동그라미 = 돌리기(가벽은 양 끝), 네모 = 가로·깊이 ----- */
    function fgeo(key) {   // 도면 가로 단위(X = x, Y = y·ar)의 가구 모양 — 그리기와 같은 계산
      var f = RP.furnDef(key), c = d.furn[key], img = $('#rd-plan-img', page);
      var ar = c.ar || (img && img.naturalWidth ? img.naturalHeight / img.naturalWidth : 1), fx = 0, fy = 1;
      if (c.tx != null) { var dx = c.tx - c.x, dy = (c.ty - c.y) * ar, L = Math.hypot(dx, dy); if (L) { fx = dx / L; fy = dy / L; } }
      if (f.axis) { var lx = fx, ly = fy; fx = ly; fy = -lx; }
      return { f: f, c: c, ar: ar, X: c.x, Y: c.y * ar, fx: fx, fy: fy, rx: -fy, ry: fx };
    }
    var cl01 = function (v) { return Math.max(0, Math.min(1, v)); };
    page.addEventListener('pointerdown', function (e) {
      if (st.pinch || st.wall || furnPlacing() || st.cam || !e.target.closest) return;
      var el = e.target.closest('[data-fkey]'); if (!el) return;
      var key = el.getAttribute('data-fkey'); if (!d.furn[key]) return;
      var pt = planPt(e); if (!pt) return;
      e.preventDefault();
      st.fdrag = { key: key, role: el.getAttribute('data-fhd') || 'body', sx: e.clientX, sy: e.clientY, moved: false, start: JSON.parse(JSON.stringify(d.furn[key])), px: pt.x, py: pt.y, was: st.furn };
      st.furn = key; st.add = '';
      try { el.setPointerCapture(e.pointerId); } catch (x) {}
    });
    page.addEventListener('pointermove', function (e) {
      var g = st.fdrag; if (!g) return;
      if (!g.moved && Math.hypot(e.clientX - g.sx, e.clientY - g.sy) < 4) return;
      g.moved = true;
      var pt = planPt(e); if (!pt) return;
      var s0 = g.start, c = d.furn[g.key]; if (!c) return;
      var G = fgeo(g.key), ar = G.ar, m = hasWalls() ? d.walls.m : 0;
      if (g.role === 'body') {   // 옮기기 (방향·크기 그대로)
        var mx = pt.x - g.px, my = pt.y - g.py;
        c.x = cl01(s0.x + mx); c.y = cl01(s0.y + my);
        if (s0.tx != null) { c.tx = cl01(s0.tx + mx); c.ty = cl01(s0.ty + my); }
      } else if (g.role === 'rot') {   // 돌리기: 가운데 → 손가락 쪽 (45°에 가까우면 딱 맞춤)
        var vx = pt.x - c.x, vy = (pt.y - c.y) * ar, a = Math.atan2(vy, vx), q = Math.PI / 4, sn = Math.round(a / q) * q;
        if (Math.abs(a - sn) < 0.1) a = sn;
        c.tx = cl01(c.x + Math.cos(a) * 0.05); c.ty = cl01(c.y + Math.sin(a) * 0.05 / ar);
      } else if (g.role === 'e1' || g.role === 'e2') {   // 가벽 한쪽 끝 옮기기 (다른 쪽 끝은 그대로)
        var A = [2 * s0.x - s0.tx, 2 * s0.y - s0.ty], B = [s0.tx, s0.ty], P = [pt.x, pt.y];
        if (g.role === 'e1') A = P; else B = P;
        var Lw = Math.hypot(B[0] - A[0], (B[1] - A[1]) * ar); if (Lw < 0.006) return;
        c.x = (A[0] + B[0]) / 2; c.y = (A[1] + B[1]) / 2; c.tx = B[0]; c.ty = B[1]; c.L = Math.round(Lw * 1e4) / 1e4;
      } else if (m && (g.role === 'w' || g.role === 'd')) {   // 가로·깊이 (가운데 기준 양쪽으로, 5cm 단위)
        var px2 = pt.x - G.X, py2 = pt.y * ar - G.Y, along = g.role === 'w' && !G.f.nodir ? px2 * G.rx + py2 * G.ry : g.role === 'd' ? px2 * G.fx + py2 * G.fy : Math.max(Math.abs(px2 * G.rx + py2 * G.ry), Math.abs(px2 * G.fx + py2 * G.fy));
        var v = Math.round(Math.abs(along) * 2 * m / 0.05) * 0.05;
        if (g.role === 'w') c.w = Math.max(0.2, Math.min(8, Math.round(v * 100) / 100)); else c.dp = Math.max(0.05, Math.min(5, Math.round(v * 100) / 100));
      }
      drawCams();
    });
    page.addEventListener('pointerup', function () {
      var g = st.fdrag; if (!g) return;
      st.fdrag = null; st.fjust = Date.now();   // 뒤따르는 click 은 무시 (도면 누르기로 처리되지 않게)
      if (g.moved) { d.furn = RP.furnOf(d.furn); st.gcache = {}; persist(); }
      drawPlan();   // 고른 가구의 칸·손잡이·밑그림 미리보기
    });
    page.addEventListener('pointercancel', function () { var g = st.fdrag; if (g) { d.furn[g.key] = g.start; st.fdrag = null; drawCams(); } });

    // 끌어 옮기기·누르기 (벽 고치는 중일 때 도면 위)
    page.addEventListener('pointerdown', function (e) {
      if (st.pinch || !st.wall || !d.walls || !e.target.closest || !e.target.closest('#rd-wall-svg')) return;
      var pt = planPt(e); if (!pt || pt.out) return;
      e.preventDefault();
      st.ptr = { id: e.pointerId, sx: e.clientX, sy: e.clientY, moved: false };
      var w = d.walls, sel = w.s[st.wsel];
      if (st.wtool !== 'pick' || !sel) return;
      var end = [0, 2].filter(function (k) { return Math.hypot(sel[k] - pt.x, (sel[k + 1] - pt.y) * w.ar) * pt.k < 16; })[0];
      if (end == null) return;
      // 같은 자리에 붙은 다른 선 끝도 같이 옮김
      var ox = sel[end], oy = sel[end + 1], pts = [];
      w.s.forEach(function (g, i) { [0, 2].forEach(function (k) { if (Math.abs(g[k] - ox) < 1e-4 && Math.abs(g[k + 1] - oy) < 1e-4) pts.push({ i: i, e: k }); }); });
      st.drag = { pts: pts, anchor: [sel[2 - end], sel[3 - end]], snap: JSON.stringify(w) };
      try { e.target.closest('#rd-wall-svg').setPointerCapture(e.pointerId); } catch (x) {}
    });
    page.addEventListener('pointermove', function (e) {
      if (!st.wall || !d.walls) return;
      var pt;
      if (st.drag && st.ptr && e.pointerId === st.ptr.id) {
        if (!st.ptr.moved && Math.hypot(e.clientX - st.ptr.sx, e.clientY - st.ptr.sy) < 4) return;
        st.ptr.moved = true;
        if (!(pt = planPt(e))) return;
        var mv = st.drag.pts, q = snapPt(pt, st.drag.anchor, function (i, k) { return mv.some(function (m) { return m.i === i && (k == null || m.e === k); }); });
        mv.forEach(function (m) { var g = d.walls.s[m.i]; g[m.e] = q[0]; g[m.e + 1] = q[1]; });
        return drawWalls();
      }
      if (st.wtool === 'draw' && e.target.closest && e.target.closest('#rd-wall-svg') && (pt = planPt(e))) { st.hover = snapPt(pt, st.wa); drawHover(); }
    });
    page.addEventListener('pointerup', function (e) {
      if (!st.ptr || e.pointerId !== st.ptr.id) return;
      var ptr = st.ptr, dr = st.drag; st.ptr = null; st.drag = null;
      if (!st.wall || !d.walls) return;
      if (dr && ptr.moved) {   // 다 옮김 → 길이 0인 선은 지움
        st.wh.push(dr.snap); if (st.wh.length > 40) st.wh.shift();
        d.walls.s = d.walls.s.filter(function (g) { return RW.segLen(g, d.walls.ar) > 0.002; });
        if (!d.walls.s[st.wsel]) st.wsel = -1;
        return wallChanged();
      }
      if (Math.hypot(e.clientX - ptr.sx, e.clientY - ptr.sy) > 8) return;   // 누르기만
      var pt = planPt(e); if (pt && !pt.out) wallTap(pt);
    });
    page.addEventListener('pointercancel', function () { if (st.drag) { d.walls = JSON.parse(st.drag.snap); st.drag = null; drawWalls(); } st.ptr = null; });
    function onKey(e) {
      if (!page.isConnected) { document.removeEventListener('keydown', onKey); return; }
      if (!st.wall || !d.walls || /^(INPUT|TEXTAREA|SELECT)$/.test((e.target && e.target.tagName) || '')) return;
      if (e.key === 'Escape') { if (st.wa) st.wa = null; else st.wsel = -1; st.hover = null; refreshWalls(); }
      else if ((e.key === 'Delete' || e.key === 'Backspace') && d.walls.s[st.wsel]) { e.preventDefault(); wallSnap(); d.walls.s.splice(st.wsel, 1); st.wsel = -1; wallChanged(); }
      else if ((e.ctrlKey || e.metaKey) && /^z$/i.test(e.key) && st.wh.length) { e.preventDefault(); undoWall(); }
    }
    document.addEventListener('keydown', onKey);
    function undoWall() { d.walls = RW.clean(JSON.parse(st.wh.pop())); st.wsel = -1; st.wa = null; wallChanged(); }

    function planCard() {
      var src = p.plan_path && st.urls[p.plan_path];
      var inp = '<input type="file" class="cf-input" id="rd-file" accept="image/jpeg,image/png,image/webp,image/heic,image/heif"' + (st.planBusy ? ' disabled' : '') + '>';
      var mode = st.wall ? ' wall-on' : st.cam ? ' cam-on cam-pick' : st.add ? ' cam-on placing' : st.furn ? ' cam-on' : '';
      return '<div class="txt-card est-card rd-plan" id="rd-plan-card"><span class="label ct-label">도면</span>' +
        (p.plan_path ? '<div class="rd-plan-box' + mode + ((st.zoom || 1) > 1 ? ' zoomed' : '') + '">' + (src ? '<div class="rd-plan-scroll"><div class="rd-cam-wrap"><img id="rd-plan-img" src="' + esc(src) + '" alt="올린 도면" draggable="false"' + (mode ? '' : ' data-rzoom data-rname="도면"') + '>' +
          '<svg class="rd-wall-svg" id="rd-wall-svg" aria-hidden="true"></svg>' +
          '<svg class="rd-cam-svg" id="rd-cam-svg" aria-hidden="true"' + (st.cam || st.furn || st.add ? ' data-camtap' : '') + '></svg></div></div>' + zoomBtns() : '<p class="hint">도면 불러오는 중…</p>') + '</div>' + (st.wall ? wallRow() : camRow() + furnRow() + wallRow() + guideRow()) : '') +
        '<label class="btn btn-outline cf-add rd-plan-add' + (st.planBusy ? ' busy' : '') + '">' + I.plus + '<span>' + (st.planBusy ? '도면 올리는 중…' : p.plan_path ? '다른 도면 올리기' : '도면 사진 올리기') + '</span>' + inp + '</label>' +
        '<p class="hint">주소·동호수가 적혀 있으면 가리고 올려 주세요.</p>' +
        '</div>';
    }
    function pickCard() {
      return '<div class="txt-card est-card"><span class="label ct-label" id="rd-views-l">만들 그림</span>' +
        '<div class="est-cboxes rd-views" role="group" aria-labelledby="rd-views-l">' + RP.VIEWS.map(function (v) {
          var on = d.views.indexOf(v.key) >= 0;
          return '<label class="est-cbox' + (on ? ' on' : '') + '"><input type="checkbox" data-rv="' + esc(v.key) + '"' + (on ? ' checked' : '') + '><span class="ph-box" aria-hidden="true">' + I.check + '</span><span class="pk-t">' + esc(v.name) + '</span></label>';
        }).join('') + '</div></div>';
    }
    function styleCard() {
      return '<div class="txt-card est-card">' +
        '<div class="field"><span class="label" id="rd-style-l">분위기</span>' +
        K.dsel('rd-style', RP.STYLES.map(function (s) { return { v: s.key, t: s.name, sub: s.sub }; }), d.style, { labelledby: 'rd-style-l' }) + '</div>' +
        '<div class="field"><label for="rd-memo">요청 사항 <span class="opt">(선택)</span></label>' +
        '<textarea class="textarea" id="rd-memo" rows="2" maxlength="' + RP.MEMO_MAX + '" placeholder="예) 주방 상판은 화이트, 거실 조명은 따뜻하게">' + esc(d.memo) + '</textarea></div>' +
        '</div>';
    }
    function canGo() { return !st.working && !st.planBusy && picked().length && p.plan_path; }
    function goLabel() { var n = picked().length; return st.working ? '준비하는 중…' : n ? '그림 ' + n + '장 만들기' : '만들 그림을 골라 주세요'; }

    function itemHtml(r) {
      var src = r.image_path && st.urls[r.image_path], name = viewName(r.view), inp = RP.cleanInput(r.input), old = isOld(r);
      var img = r.status === 'done' && src ? '<img src="' + esc(src) + '" alt="' + esc(name) + ' 3D 그림" data-rzoom data-rname="' + esc(name) + '">'
        : busy(r) ? '<div class="rd-wait" role="status"><span class="rd-spin" aria-hidden="true"></span><b>' + (r.status === 'queued' ? '기다리는 중…' : '만드는 중…') + '</b><small>한 장에 1~2분쯤 걸려요</small></div>'
          : r.status === 'failed' ? '<div class="rd-fail">' + I.info + '<span>' + esc(r.error || '그림을 만들지 못했어요.') + '</span></div>'
            : '<div class="rd-wait"><small>그림 불러오는 중…</small></div>';
      var sub = [styleName(inp.style), K.fmtWhen ? K.fmtWhen(r.created_at) : ''].filter(Boolean).join(' · ');
      return '<article class="rd-item' + (old ? ' old' : '') + '" data-rid="' + esc(r.id) + '">' +
        '<div class="rd-img' + (r.status === 'done' ? '' : ' empty') + '">' + img + (old ? '<span class="rd-old">예전 공사 내용</span>' : '') + '</div>' +
        '<div class="rd-meta"><b>' + esc(name) + '</b>' + (sub ? '<small>' + esc(sub) + '</small>' : '') + (r.caption ? '<p>' + esc(r.caption) + '</p>' : '') +
        '<details class="rd-in"><summary>만든 내용 보기</summary><ul>' + (inp.lines.length ? inp.lines.map(function (l) { return '<li>' + esc(l) + '</li>'; }).join('') : '<li>공사 내용 없음</li>') + '</ul>' +
        ((inp.size ? '<p>평수 ' + esc(inp.size) + '평</p>' : '') + (inp.memo ? '<p>요청 사항: ' + esc(inp.memo) + '</p>' : '') +
          (inp.cam ? '<p>카메라: 도면에서 찍은 곳' + (inp.cam.tx != null ? '·방향(' + RP.camDirKo(inp.cam) + '쪽을 봄)' : '') + (inp.guide ? ' · 3D 밑그림대로' : '') + '</p>' : '') +
          (inp.furn ? '<p>가구·구조 위치: ' + esc(RP.FURN.map(function (f) { var n = RP.furnKeys(inp.furn).filter(function (k) { return k.split('#')[0] === f.key; }).length; return n ? f.name + (n > 1 ? ' ' + n : '') : ''; }).filter(Boolean).join('·')) + '</p>' : '') +
          (inp.refs ? '<p>현재 집 사진 ' + inp.refs.length + '장 참고</p>' : '') +
          (inp.mats ? '<p>자재 사진 ' + inp.mats.length + '장 참고</p>' : '') +
          (inp.guide && st.urls[inp.guide] ? '<img class="rd-in-guide" src="' + esc(st.urls[inp.guide]) + '" alt="' + esc(name) + ' 밑그림" data-rzoom data-rname="' + esc(name) + ' 밑그림">' : '') +
          (r.status === 'done' ? '<p>' + (r.caption ? 'AI가 도면을 읽고 공간 설명을 써서 그렸어요' : '도면을 읽지 못해 기본 설명으로 그렸어요') + '</p>' : '') +
          (r.status === 'done' && r.prompt ? '<p class="rd-prompt" lang="en">' + esc(r.prompt) + '</p>' : '')) + '</details></div>' +
        '<div class="rd-acts">' +
        (r.status === 'done' && src ? '<button type="button" class="btn btn-outline btn-sm" data-rsave>' + I.down + '<span>저장</span></button>' : '') +
        (busy(r) ? '' : '<button type="button" class="btn btn-outline btn-sm" data-ragain>다시 만들기</button>') +
        '<button type="button" class="est-x" data-rdel aria-label="' + esc(name) + ' 그림 지우기"' + (busy(r) ? ' disabled' : '') + '>' + I.trash + '</button>' +
        '</div></article>';
    }
    function listHtml() {
      if (!st.rows.length) return '';
      var n = st.rows.filter(function (r) { return r.status === 'done'; }).length, sv = staleViews();
      return '<h2 class="est-h rd-h">만든 그림 <small>' + n + '장</small></h2>' +
        (sv.length ? '<button type="button" class="btn btn-outline rd-redo" data-rredo' + (!st.working && !st.planBusy && p.plan_path ? '' : ' disabled') + '>바뀐 내용으로 다시 만들기 (' + sv.length + '장)</button>' : '') +
        '<div class="rd-list">' + st.rows.map(itemHtml).join('') + '</div>';
    }
    function render() {
      page.innerHTML =
        (note ? '<div class="tip rd-sync">' + I.info + '<span>견적서가 고쳐져서' + (note.at ? '(' + esc(K.fmtWhen(note.at)) + ')' : '') + ' 바뀐 내용을 불러왔어요 · ' + esc(note.ch.slice(0, 6).join(' · ') + (note.ch.length > 6 ? ' 외 ' + (note.ch.length - 6) + '가지' : '')) + '</span></div>' : '') +
        srcCard() + matCard() + planCard() + refsCard() + pickCard() + styleCard() +
        '<button type="button" class="btn btn-primary rd-go" data-rgo' + (canGo() ? '' : ' disabled') + '>' + esc(goLabel()) + '</button>' +
        '<div id="rd-results">' + listHtml() + '</div>';
      markPart(); drawCams(); drawWalls();
    }
    function drawList() { var box = $('#rd-results', page); if (box) box.innerHTML = listHtml(); }
    function syncGo() { var b = $('[data-rgo]', page); if (b) { b.textContent = goLabel(); b.disabled = !canGo(); } }
    function rerender() { var y = window.scrollY; render(); window.scrollTo(0, y); }

    /* ----- 다시 읽기 (만드는 중인 그림이 있으면 몇 초마다) ----- */
    function refresh() {
      return DB.listRenderImages(p.id).then(function (list) {
        // 너무 오래 멈춰 있는 그림은 '못 만듦'으로 (서버 함수가 시작하지 못했거나 도중에 끊긴 경우)
        var fix = list.filter(function (r) { return (r.status === 'queued' && age(r, 'created_at') > STALE_QUEUED) || (r.status === 'running' && age(r, 'updated_at') > STALE_RUNNING); });
        return Promise.all(fix.map(function (r) {
          var msg = r.status === 'queued' ? '그림 만들기가 시작되지 않았어요. 다시 만들어 주세요.' : '시간이 너무 오래 걸려서 멈췄어요. 다시 만들어 주세요.';
          r.status = 'failed'; r.error = msg;
          return DB.updateRenderImage(r.id, { status: 'failed', error: msg }).catch(function () {});
        })).then(function () { return list; });
      }).then(function (list) {
        st.rows = list.slice().sort(byNewest);
        var need = list.map(function (r) { return r.image_path; }).concat(list.map(function (r) { return RP.cleanInput(r.input).guide; }), [p.plan_path], d.refs.map(function (r) { return r.path; }), [].concat.apply([], d.items.map(function (x) { return RP.linesOf(x).map(function (l) { return l.photo; }); }))).filter(function (x) { return x && !st.urls[x]; });
        return sign(need).then(function (u) { Object.keys(u).forEach(function (k) { st.urls[k] = u[k]; }); });
      });
    }
    function poll() {
      clearTimeout(st.timer);
      if (!page.isConnected || !st.rows.some(busy)) return;
      st.timer = setTimeout(function () {
        if (!page.isConnected) return;
        var sig = function () { return st.rows.map(function (r) { return r.id + r.status + (r.image_path || ''); }).join('|'); }, before = sig();
        refresh().then(function () { if (!page.isConnected) return; if (sig() !== before) drawList(); poll(); }, function () { poll(); });
      }, POLL_MS);
    }

    /* ----- 만들기 ----- */
    function start(views, stay) {
      if (!views.length || st.working) return;
      if (!p.plan_path) return K.notice ? K.notice('도면 사진을 먼저 올려 주세요') : null;
      st.working = true; syncGo();
      var made = [];
      return persist(true).then(function () {
        var input = Object.assign(current(), extras());
        // 공간마다 찍어 둔 카메라 위치를 그 그림의 input 에 같이 (공사 내용 비교에는 안 씀)
        // + 빨간 표시를 그린 도면을 따로 올려 그 그림의 도면으로 (못 만들면 원래 도면 + 좌표만)
        // + 벽 선이 있고 바라볼 쪽까지 찍었으면 3D 밑그림을 그려 올림 (input.guide — 못 만들면 밑그림 없이)
        return Promise.all(views.map(function (v) {
          var c = v !== 'overview' && d.cams[v];
          if (!c) return { v: v, plan: p.plan_path, input: input };
          var mk = markedPlan(c).then(function (blob) { return DB.uploadRenderPlan(p.id, blob); }).then(function (path) { return path; }, function (e) {
            try { console.warn('[3D] 카메라 표시 도면을 만들지 못함', e && e.message); } catch (x) {}
            return '';
          });
          var gd = canGuide(c) ? guideBlob(c).then(function (blob) { return DB.uploadRenderPlan(p.id, blob); }).catch(function (e) {
            try { console.warn('[3D] 밑그림을 만들지 못함', e && e.message); } catch (x) {}
            return '';
          }) : Promise.resolve('');
          return Promise.all([mk, gd]).then(function (r) {
            var vk = input.furn && c.tx != null ? visKeys(c) : null;   // 벽 너머(다른 방) 가구·벽 마감은 이 그림 글에서 뺌
            return { v: v, plan: r[0] || p.plan_path, input: Object.assign({}, input, { cam: c }, vk ? { vis: vk } : {}, r[0] ? { camMark: true } : {}, r[1] ? { guide: r[1] } : {}) };
          });
        })).then(function (list) {
          return DB.addRenderImages(list.map(function (x) { return { project_id: p.id, view: x.v, plan_path: x.plan, input: x.input, status: 'queued' }; }));
        });
      }).then(function (list) {
        made = list;
        return DB.startRenders(list.map(function (r) { return r.id; }));
      }).then(function () {
        st.working = false;
        return refresh().then(function () { rerender(); poll(); var h = $('.rd-h', page); if (h && !stay) h.scrollIntoView({ behavior: 'smooth', block: 'start' }); });
      }).catch(function (err) {
        st.working = false;
        return Promise.all(made.map(function (r) { return DB.updateRenderImage(r.id, { status: 'failed', error: friendly(err).slice(0, 290) }).catch(function () {}); }))
          .then(function () { return refresh().catch(function () {}); }).then(function () { rerender(); oops('그림을 만들지 못했어요', err); });
      });
    }
    // 도면 올리기: 고르면 바로 올리고 작업에 저장. 예전 도면은 그 도면으로 만든 그림이 없으면 지움
    function setPlan(file) {
      if (/pdf$/i.test(file.name) || file.type === 'application/pdf') return K.ask({ title: 'PDF 도면은 아직 안 돼요', text: '도면을 사진(JPG·PNG)으로 저장하거나 화면을 캡처해서 올려 주세요.', cancel: false, ok: '확인' });
      if (!window.ImageTools) return;
      st.planBusy = true; rerender();
      var old = p.plan_path;
      window.ImageTools.single(file, 2000, 0.88).then(function (img) {
        return DB.uploadRenderPlan(p.id, img.blob).then(function (path) {
          st.urls[path] = URL.createObjectURL(img.blob);
          p.plan_path = path;
          d.cams = {}; st.cam = ''; st.camStep = '';   // 찍어 둔 카메라 위치·벽 선은 예전 도면 기준이라 지움
          d.walls = null; st.wall = false; st.wh = []; st.wsel = -1; st.wa = null; st.gcache = {};
          d.furn = {}; st.furn = ''; st.add = '';
          return persist(true);
        });
      }).then(function () {
        if (old && !st.rows.some(function (r) { return r.plan_path === old; })) DB.removeRenderPlan(old);
      }).catch(function (err) { oops('도면을 올리지 못했어요', err); })
        .then(function () { st.planBusy = false; rerender(); });
    }
    // 다른 견적서로 바꾸기 (그 견적서로 만든 작업이 이미 있으면 그쪽으로)
    function changeEstimate(eid) {
      if (est && eid === est.id) return;
      DB.listRenderProjects().then(function (ps) {
        var have = ps.filter(function (x) { return x.estimate_id === eid && x.id !== p.id; })[0];
        if (have) {
          return K.ask({ title: '그 견적서로 만든 3D 그림이 이미 있어요', text: '<b>' + esc(have.title || '3D 그림') + '</b> · 그림 ' + (have.image_count || 0) + '장', cancel: '그대로 두기', ok: '그 3D 그림 열기' })
            .then(function (ok) { if (ok) K.go('#/render/' + encodeURIComponent(have.id)); });
        }
        return DB.getEstimate(eid).then(function (e) {
          if (!e) throw new Error('견적서를 찾을 수 없어요. 이미 지웠을 수 있어요.');
          var go2 = function () { importEstimate(p, e, false); est = e; note = null; return persist(true).then(rerender); };
          if (!d.items.length) return go2();
          return K.ask({ title: '이 견적서 내용으로 바꿀까요?', text: '<b>' + esc(titleOf(e)) + '</b><br>그림에 넣을 공사 내용과 평수가 이 견적서 것으로 바뀌어요. 직접 넣은 내용·도면·만든 그림은 그대로예요.', cancel: '그만두기', ok: '바꾸기' })
            .then(function (ok) { if (ok) return go2(); });
        });
      }).catch(function (err) { oops('견적서를 불러오지 못했어요', err); });
    }
    function download(r, btn) {
      var url = st.urls[r.image_path]; if (!url) return;
      btn.disabled = true;
      var ext = (/\.(png|jpg|jpeg|webp)$/i.exec(r.image_path || '') || [0, 'png'])[1].toLowerCase();
      var day = r.created_at ? K.ymd(new Date(r.created_at)).replace(/-/g, '') : '';   // 한국 날짜로
      var name = '3d-' + r.view + (day ? '-' + day : '') + '.' + ext;   // 파일 이름은 영문·숫자만 (한글 이름은 브라우저에 따라 'download'로 바뀜)
      // 이 화면에서 만든 그림(blob: — 미리보기)은 보안 설정(CSP)이 fetch 를 막아서 링크로 바로 받음
      var got = /^blob:/.test(url) ? Promise.resolve().then(function () { var a = document.createElement('a'); a.href = url; a.download = name; document.body.appendChild(a); a.click(); a.remove(); })
        : fetch(url).then(function (res) { if (!res.ok) throw new Error('fetch'); return res.blob(); }).then(function (b) { K.saveBlob(b, name); });
      got.then(function () {
        if (K.flash) K.flash(btn, '저장했어요');
      }).catch(function (err) { oops('그림을 저장하지 못했어요', err); }).then(function () { btn.disabled = false; });
    }

    /* ----- 입력 ----- */
    page.addEventListener('input', function (e) {
      var el = e.target, i;
      if (el.id === 'rd-memo') { d.memo = el.value.slice(0, RP.MEMO_MAX); persist(); return; }
      if ((i = el.getAttribute('data-mn')) != null) { var ln = lineOf(el.getAttribute('data-mnkey'), i); if (ln) { ln.note = el.value.slice(0, RP.NOTE_MAX); persist(); } return; }
      if (el.id === 'rd-title') { p.title = el.value.replace(/\s+/g, ' ').trim().slice(0, 60) || NOEST; persist(); return; }
      if (el.id === 'rd-size') { d.size = el.value.replace(/[^0-9.]/g, '').slice(0, 6); persist(); return; }
      if ((i = el.getAttribute('data-cin')) != null) { d.custom[+i] = el.value.slice(0, RP.CUSTOM_LEN); persist(); }
    });
    page.addEventListener('focusout', function (e) {
      var el = e.target, i;
      if ((i = el.getAttribute('data-cin')) != null && !String(el.value).trim()) { d.custom.splice(+i, 1); persist(); rerender(); }   // 비운 줄은 지움
    });
    page.addEventListener('keydown', function (e) { if (e.key === 'Enter' && e.target.id === 'rd-new') { e.preventDefault(); addCustom(); } });
    function addCustom() {
      var inp = $('#rd-new', page), v = String((inp && inp.value) || '').replace(/\s+/g, ' ').trim().slice(0, RP.CUSTOM_LEN);
      if (!v) { if (inp) inp.focus(); return; }
      if (d.custom.length >= RP.CUSTOM_MAX) return;
      d.custom.push(v); persist(); rerender();   // '예전 공사 내용' 표시도 같이 바뀜
      var n = $('#rd-new', page); if (n) K.focusNear ? K.focusNear(n) : n.focus();
    }
    page.addEventListener('change', function (e) {
      var el = e.target, x;
      if (el.id === 'rd-file') { var f = el.files && el.files[0]; el.value = ''; if (f) setPlan(f); return; }
      if (el.hasAttribute('data-mph') && el.type === 'file') { var mf = el.files && el.files[0], mk2 = el.getAttribute('data-mphkey'), ml2 = el.getAttribute('data-mph'); el.value = ''; if (mf) setMatPhoto(mk2, ml2, mf); return; }
      if (el.id === 'rd-ref-file') { var fs = Array.prototype.slice.call(el.files || []); el.value = ''; if (fs.length) addRefs(fs); return; }
      if (/^rd-refv-\d+$/.test(el.id)) { var rf = d.refs[+el.id.slice(8)]; if (rf) { rf.view = el.value; persist(); } return; }
      if (el.hasAttribute('data-fw')) {
        var fwv = parseFloat(String(el.value).replace(',', '.')), cf = d.furn[st.furn];
        if (cf && fwv >= 0.2 && fwv <= 8) { cf.w = Math.round(fwv * 100) / 100; st.gcache = {}; persist(); drawPlan(); } else if (cf) el.value = cf.w.toFixed(1);
        return;
      }
      if (el.hasAttribute('data-fh') || el.hasAttribute('data-fdp')) {   // 높이·깊이 (비우면 기본 — 높이는 천장까지인 것도 있음)
        var isH = el.hasAttribute('data-fh'), fname = isH ? 'h' : 'dp', fv = String(el.value).trim() === '' ? null : parseFloat(String(el.value).replace(',', '.')), ch = d.furn[st.furn];
        var ok2 = fv == null || (isH ? fv >= 0.1 && fv <= 4 : fv >= 0.02 && fv <= 5);
        if (ch && ok2) { if (fv == null) delete ch[fname]; else ch[fname] = Math.round(fv * 100) / 100; st.gcache = {}; persist(); drawPlan(); } else if (ch) el.value = ch[fname] != null ? ch[fname] : '';
        return;
      }
      if (el.hasAttribute('data-fl')) {   // 가벽 길이(m) → 가운데는 그대로, 양쪽 끝을 늘이고 줄임
        var flv = parseFloat(String(el.value).replace(',', '.')), cl2 = d.furn[st.furn];
        if (cl2 && hasWalls() && flv >= 0.1 && flv <= 30) {
          var nL = flv / d.walls.m, ar2 = cl2.ar || 1, hx = cl2.tx - cl2.x, hy = (cl2.ty - cl2.y) * ar2, hl = Math.hypot(hx, hy) || 1;
          cl2.L = Math.round(nL * 1e4) / 1e4; cl2.tx = Math.max(0, Math.min(1, cl2.x + hx / hl * nL / 2)); cl2.ty = Math.max(0, Math.min(1, cl2.y + hy / hl * nL / 2 / ar2));
          st.gcache = {}; persist(); drawPlan();
        } else if (cl2 && hasWalls()) el.value = (cl2.L * d.walls.m).toFixed(1);
        return;
      }
      if ((x = el.getAttribute('data-rv'))) {
        d.views = d.views.filter(function (k) { return k !== x; }); if (el.checked) d.views.push(x);
        el.closest('.est-cbox').classList.toggle('on', el.checked); syncGo(); persist(); drawPlan(); return;
      }
      if ((x = el.getAttribute('data-mk'))) {   // 공사 항목 전체 넣기/빼기 (일부만 넣은 항목을 누르면 전부 넣기)
        var it = itemOf(x); if (!it) return;
        var ls = RP.linesOf(it);
        if (ls.length) ls.forEach(function (l) { l.on = el.checked; }); else it.on = el.checked;
        persist(); drawMats(); drawList(); return;
      }
      if ((x = el.getAttribute('data-ml'))) {   // 세부 줄 하나 넣기/빼기
        var it2 = itemOf(el.getAttribute('data-mkey')); if (!it2) return;
        RP.linesOf(it2).forEach(function (l) { if (l.k === x) l.on = el.checked; });
        persist(); drawMats(); drawList(); return;
      }
      if (el.id === 'rd-style') { d.style = el.value; persist(); return; }
      if (el.hasAttribute('data-wlen') || el.hasAttribute('data-wceil')) {   // 고른 선의 실제 길이 → 도면 전체 크기 / 천장 높이
        var wv = parseFloat(String(el.value).replace(',', '.')), w = d.walls, sl = w && w.s[st.wsel];
        if (!w) return;
        if (el.hasAttribute('data-wceil')) { if (wv >= 2 && wv <= 4) { wallSnap(); w.h = Math.round(wv * 100) / 100; } }
        else if (sl && wv >= 0.2 && wv <= 100 && RW.segLen(sl, w.ar) > 0) { wallSnap(); w.m = Math.round(wv / RW.segLen(sl, w.ar) * 1000) / 1000; w.src = 'user'; }
        return wallChanged();
      }
      if (el.id === 'rd-size' || el.hasAttribute('data-cin') || el.hasAttribute('data-mn')) drawList();   // 공사 내용이 바뀌면 '예전 공사 내용' 표시도 다시
    });
    page.addEventListener('click', function (e) {
      var t = e.target, x;
      if ((x = t.closest && t.closest('[data-pzoom]'))) {   // 도면 크게·작게
        var zc = st.zoom || 1, up = +x.getAttribute('data-pzoom') > 0;
        return setZoom(up ? ZOOMS.filter(function (v) { return v > zc + 0.01; })[0] || ZMAX : ZOOMS.filter(function (v) { return v < zc - 0.01; }).pop() || 1);
      }
      if (((st.fjust && Date.now() - st.fjust < 450) || (st.pjust && Date.now() - st.pjust < 450)) && t.closest && t.closest('.rd-plan-box')) return;   // 도면 위 가구를 누르거나 끈 바로 뒤, 두 손가락으로 키운 바로 뒤 (도면 누르기로 처리되지 않게)
      if (t.closest && t.closest('[data-fkey]')) return;
      if ((x = t.closest('[data-rzoom]'))) return K.ask({ title: x.getAttribute('data-rname') || '그림', text: '<img class="zoom-img" src="' + esc(x.getAttribute('src')) + '" alt="">', cancel: false, ok: '닫기' });
      if ((x = t.closest('[data-fdopen="rd-est"]'))) return pickEstimate({ title: est ? '다른 견적서로 바꾸기' : '견적서 고르기', cur: est ? est.id : '', focus: x, onPick: function (it) { if (it) changeEstimate(it.id); } });
      if ((x = t.closest('[data-mopen]'))) { var mk = x.getAttribute('data-mopen'); st.open[mk] = !st.open[mk]; return drawMats(); }
      if ((x = t.closest('[data-mp]'))) { var pk = x.getAttribute('data-mpkey') + '\n' + x.getAttribute('data-mp'); st.pal = st.pal === pk ? '' : pk; return drawMats(); }   // 팔레트 열기·닫기 (하나만)
      if ((x = t.closest('[data-sw]'))) {   // 색·마감 이름을 칸에 더하기 / 이미 있으면 빼기
        var row = x.closest('.rd-mat-l'), inp = row && $('[data-mn]', row); if (!inp) return;
        var w = x.getAttribute('data-sw'), cur = String(inp.value || '').replace(/\s+/g, ' ').trim(), had = hasWord(cur, w);
        inp.value = had ? (' ' + cur + ' ').replace(' ' + w + ' ', ' ').trim() : (cur ? cur + ' ' + w : w).slice(0, RP.NOTE_MAX);
        x.classList.toggle('on', !had); x.setAttribute('aria-pressed', String(!had));
        var ln2 = lineOf(inp.getAttribute('data-mnkey'), inp.getAttribute('data-mn')); if (ln2) { ln2.note = inp.value; persist(); drawList(); }
        return;
      }
      if ((x = t.closest('[data-cam]'))) { var ck = x.getAttribute('data-cam'); st.cam = st.cam === ck ? '' : ck; st.camStep = ''; st.wall = false; st.furn = ''; st.add = ''; return drawPlan(); }
      if ((x = t.closest('[data-ftab]'))) { var tg = x.getAttribute('data-ftab'); if (st.ftab !== tg) { st.ftab = tg; st.add = ''; drawPlan(); } return; }   // 가구 분류 탭
      if ((x = t.closest('[data-furn]'))) {   // 가구 단추: 놓은 것(하나만 놓는 종류)은 고르기, 아니면 새로 놓기 — 같은 단추를 다시 누르면 그만
        var fk = x.getAttribute('data-furn'), fdef = RP.furnDef(fk), have = keysOf(fk), selK = st.furn ? st.furn.split('#')[0] : '';
        st.cam = ''; st.camStep = ''; st.wall = false;
        if (st.add === fk) st.add = '';   // 놓기 그만
        else if (fdef.multi && nextKey(fk)) { st.add = fk; st.furn = ''; }   // 기둥·가벽·하부장: 누를 때마다 하나 더
        else if (selK === fk) st.furn = '';   // 고른 걸 다시 누르면 고르기 끝
        else if (have.length) { st.furn = have[0]; st.add = ''; }   // 이미 놓은 건 고르기
        else { st.add = fk; st.furn = ''; }
        return drawPlan();
      }
      if ((x = t.closest('[data-frot]'))) { rotFurn(st.furn, +x.getAttribute('data-frot')); st.gcache = {}; persist(); return drawPlan(); }
      if (t.closest('[data-fflip]')) {   // 벽 마감: 벽 건너편 면으로 (선을 벽 너머로 옮기고 방향을 뒤집음)
        var fc = d.furn[st.furn]; if (!fc || fc.tx == null) return;
        var far = fc.ar || 1, fvx = fc.tx - fc.x, fvy = (fc.ty - fc.y) * far, fl0 = Math.hypot(fvx, fvy) || 1, fnx = -fvy / fl0, fny = fvx / fl0, foff = hasWalls() ? 2 * (0.075 + 0.015) / d.walls.m : 0;
        var fmx = fc.x - fnx * foff, fmy = fc.y * far - fny * foff;
        fc.x = cl01(fmx); fc.y = cl01(fmy / far); fc.tx = cl01(fmx - fvx); fc.ty = cl01((fmy - fvy) / far);
        st.gcache = {}; persist(); return drawPlan();
      }
      if (t.closest('[data-furnclear]')) { delete d.furn[st.furn]; st.furn = ''; st.gcache = {}; persist(); return drawPlan(); }
      if ((x = t.closest('[data-mphdel]'))) {
        var ml3 = lineOf(x.getAttribute('data-mphkey'), x.getAttribute('data-mph')); if (!ml3 || !ml3.photo) return;
        var mp = ml3.photo; delete ml3.photo; persist(); drawMats();
        if (!st.rows.some(function (y) { var mm = RP.cleanInput(y.input).mats; return busy(y) && mm && mm.some(function (z) { return z.path === mp; }); })) DB.removeRenderPlan(mp);   // 만드는 중인 그림이 쓰면 남김
        return;
      }
      if ((x = t.closest('[data-refdel]'))) {
        var ri = +x.getAttribute('data-refdel'), rr = d.refs[ri]; if (!rr) return;
        d.refs.splice(ri, 1); persist(); drawRefs();
        if (!st.rows.some(function (y) { return RP.cleanInput(y.input).refs && RP.cleanInput(y.input).refs.some(function (z) { return z.path === rr.path; }) && busy(y); })) DB.removeRenderPlan(rr.path);   // 만드는 중인 그림이 쓰면 남김
        return;
      }
      if ((x = t.closest('[data-gzoom]'))) { var gk = x.getAttribute('data-gzoom'), gu = guideUrl(gk, true); return gu ? K.ask({ title: viewName(gk) + ' 밑그림', text: '<img class="zoom-img" src="' + esc(gu) + '" alt="">', cancel: false, ok: '닫기' }) : null; }
      if (t.closest('[data-wauto]')) return extract();
      if (t.closest('[data-wdraw]')) return startDraw();
      if (t.closest('[data-wedit]')) { st.furn = ''; st.add = ''; st.wall = true; st.wtool = 'pick'; st.wsel = -1; st.wa = null; st.wh = []; st.cam = ''; st.camStep = ''; return drawPlan(); }
      if (t.closest('[data-wdone]')) return endWalls();
      if (t.closest('[data-wclear]')) {
        return K.ask({ title: '벽 선을 지울까요?', text: '3D 밑그림 없이 예전처럼 도면만 보고 그려요. 이미 만든 그림은 그대로예요.', cancel: '그대로 두기', ok: '지우기', okClass: 'btn-danger' }).then(function (ok) {
          if (!ok) return; d.walls = null; st.gcache = {}; persist(); drawPlan();
        });
      }
      if ((x = t.closest('[data-wtool]'))) { st.wtool = x.getAttribute('data-wtool'); st.wa = null; st.hover = null; if (st.wtool === 'draw') st.wsel = -1; return refreshWalls(); }
      if ((x = t.closest('[data-wk]'))) {
        var wk = x.getAttribute('data-wk'), sg = d.walls && d.walls.s[st.wsel];
        if (st.wtool === 'pick' && sg) { if (sg[4] !== wk) { wallSnap(); sg[4] = wk; wallChanged(); } return; }   // 고른 선의 종류 바꾸기
        st.wkind = wk; st.wtool = 'draw'; st.wsel = -1; st.wa = null; return refreshWalls();   // 그 종류로 선 긋기
      }
      if (t.closest('[data-wundo]')) { if (st.wh.length) undoWall(); return; }
      if (t.closest('[data-wdel]')) { if (d.walls && d.walls.s[st.wsel]) { wallSnap(); d.walls.s.splice(st.wsel, 1); st.wsel = -1; wallChanged(); } return; }
      if (t.closest('[data-wcancel]')) { st.wa = null; st.hover = null; return refreshWalls(); }
      if (t.closest('[data-camclear]')) { delete d.cams[st.cam]; st.cam = ''; st.camStep = ''; persist(); return drawPlan(); }
      if (t.closest('[data-camtap]')) return camTap(e);
      if (t.closest('[data-cadd]')) return addCustom();
      if ((x = t.closest('[data-cdel]'))) { d.custom.splice(+x.getAttribute('data-cdel'), 1); persist(); return rerender(); }
      if (t.closest('[data-rgo]')) return start(picked());
      if (t.closest('[data-rredo]')) return start(staleViews());
      var item = t.closest('[data-rid]'); if (!item) return;
      var r = st.rows.filter(function (y) { return y.id === item.getAttribute('data-rid'); })[0]; if (!r) return;
      if ((x = t.closest('[data-rsave]'))) return download(r, x);
      if (t.closest('[data-ragain]')) return start([r.view], true);   // 지금 공사 내용·분위기·요청 사항으로 한 장 더 (지금 그림은 그대로 남음)
      if (t.closest('[data-rdel]')) {
        return K.ask({ title: viewName(r.view) + ' 그림을 지울까요?', text: '지우면 되살릴 수 없어요.', cancel: '그대로 두기', ok: '지우기', okClass: 'btn-danger' }).then(function (ok) {
          if (!ok) return;
          return DB.deleteRenderImage(r.id).then(function () {
            st.rows = st.rows.filter(function (y) { return y.id !== r.id; });
            drawList(); K.toast('그림을 지웠어요');
          }).catch(function (err) { oops('지우지 못했어요', err); });
        });
      }
    });

    render();
    refresh().then(function () { if (page.isConnected) { rerender(); poll(); } }, function () {});
  }

  K.routes.renders = function () { return viewList(); };
  K.routes.render = function (args) {
    var id = decodeURIComponent(args[0] || '');
    if (!id || id === 'new') { K.replaceTo('#/renders'); return; }
    return viewProject(id);
  };
})();
