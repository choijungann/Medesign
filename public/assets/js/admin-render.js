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
  var K = window.AdminKit, RP = window.RenderPrompts;
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
  // 이미 알기 쉬운 우리말 오류(이 화면·서버 함수가 만든 것)는 그대로, 아니면 공통 안내로
  function friendly(e) { var m = String((e && e.message) || e || '').trim(); return /^[가-힣0-9‘'"]/.test(m) ? m : K.friendlyError(e); }
  function oops(title, err) { return K.ask({ title: title, text: esc(friendly(err)), cancel: false, ok: '확인' }); }
  function sign(paths) { paths = (paths || []).filter(Boolean); return paths.length && DB.signPhotos ? DB.signPhotos(paths) : Promise.resolve({}); }
  // 견적서 → 작업 이름 (고객 이름 · 공사명) — 관리화면에서만 보이고 AI에는 보내지 않음
  function titleOf(e) { return [e && e.customer_name, K.estTitle(e)].filter(Boolean).join(' · ').slice(0, 120); }
  // 견적서가 마지막으로 불러온 뒤에 고쳐졌는지
  function estChanged(p, e) { return !!(e && (!p.est_synced_at || ms(e.updated_at) > ms(p.est_synced_at) + 1000)); }
  function blankDoc() { return { size: '', sizeEst: '', items: [], custom: [], style: '', memo: '', views: ['overview'], cams: {} }; }
  function normDoc(d) {
    d = Object.assign(blankDoc(), d || {});
    d.items = Array.isArray(d.items) ? d.items : []; d.custom = Array.isArray(d.custom) ? d.custom : [];
    d.views = (Array.isArray(d.views) ? d.views : []).filter(function (k) { return RP.viewOf(k); });
    // 카메라 위치: 공간마다 { x, y, tx, ty } (도면 그림 안의 비율 0~1, 전체 조감도는 없음)
    var cams = {}; Object.keys(d.cams && typeof d.cams === 'object' ? d.cams : {}).forEach(function (k) { var c = RP.camOf(d.cams[k]); if (c && k !== 'overview' && RP.viewOf(k)) cams[k] = c; });
    d.cams = cams;
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
    var st = { rows: images.slice().sort(byNewest), urls: {}, working: false, timer: null, saveT: null, saving: null, planBusy: false, open: {}, pal: '', cam: '', camStep: '' };

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
          '<button type="button" class="rd-pal-btn' + (pal ? ' on' : '') + '" data-mpkey="' + key + '" data-mp="' + k + '" aria-expanded="' + pal + '" aria-label="' + esc(l.text) + ' 색 고르기">' + PAL + '<span>색</span></button></div>' +
          (pal ? '<div class="rd-pal" role="group" aria-label="색·마감 고르기">' +
            RP.COLORS.map(function (c) { return '<button type="button" class="rd-sw' + (hasWord(l.note, c.name) ? ' on' : '') + '" data-sw="' + esc(c.name) + '" aria-pressed="' + hasWord(l.note, c.name) + '"><i style="background:' + esc(c.hex) + '"></i><span>' + esc(c.name) + '</span></button>'; }).join('') +
            RP.FINISHES.map(function (f) { return '<button type="button" class="rd-sw rd-fin' + (hasWord(l.note, f) ? ' on' : '') + '" data-sw="' + esc(f) + '" aria-pressed="' + hasWord(l.note, f) + '"><span>' + esc(f) + '</span></button>'; }).join('') + '</div>' : '') : '') +
        '</div>';
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
      // 표시 크기를 화면 픽셀로 맞춤 (도면이 커도 작아도 점·글자가 같은 크기로 보이게)
      var W = img.naturalWidth, H = img.naturalHeight, bx = img.getBoundingClientRect(), sc = Math.min(bx.width / W, bx.height / H), R = sc > 0 ? 1 / sc : Math.max(W, H) / 400;
      svg.setAttribute('viewBox', '0 0 ' + W + ' ' + H);
      var mk = function (id) { return '<marker id="' + id + '" class="' + id + '" viewBox="0 0 10 10" refX="6" refY="5" markerWidth="4" markerHeight="4" orient="auto"><path d="M0 0 10 5 0 10z"/></marker>'; };
      svg.innerHTML = '<defs>' + mk('rd-ah') + mk('rd-ah-on') + '</defs>' +
        camKeys().filter(function (k) { return d.cams[k]; }).map(function (k) {
          var c = d.cams[k], x = c.x * W, y = c.y * H, on = st.cam === k ? ' on' : '';
          var arrow = c.tx != null ? '<line x1="' + x + '" y1="' + y + '" x2="' + (c.tx * W) + '" y2="' + (c.ty * H) + '" stroke-width="' + (2.5 * R) + '" marker-end="url(#rd-ah' + (on ? '-on' : '') + ')"/>' : '';
          return '<g class="rd-cam-mk' + on + '">' + arrow + '<circle cx="' + x + '" cy="' + y + '" r="' + (7 * R) + '" stroke-width="' + (2.5 * R) + '"/>' +
            '<text x="' + x + '" y="' + (y - 12 * R) + '" font-size="' + (13 * R) + '" stroke-width="' + (3.5 * R) + '">' + esc(viewName(k)) + '</text></g>';
        }).join('');
    }
    function drawPlan() { var el = $('#rd-plan-card', page); if (!el) return; el.outerHTML = planCard(); drawCams(); }
    function camTap(e) {
      var img = $('#rd-plan-img', page); if (!img || !img.naturalWidth || !st.cam) return;
      var b = img.getBoundingClientRect(), s = Math.min(b.width / img.naturalWidth, b.height / img.naturalHeight);
      var w = img.naturalWidth * s, h = img.naturalHeight * s, x = (e.clientX - b.left - (b.width - w) / 2) / w, y = (e.clientY - b.top - (b.height - h) / 2) / h;
      if (x < 0 || x > 1 || y < 0 || y > 1) return;
      if (st.camStep !== 'dir') { d.cams[st.cam] = RP.camOf({ x: x, y: y }); st.camStep = 'dir'; }
      else {
        var c = RP.camOf({ x: d.cams[st.cam].x, y: d.cams[st.cam].y, tx: x, ty: y });
        if (c.tx == null) return;   // 서 있는 곳과 너무 가까우면 다시
        d.cams[st.cam] = c; st.cam = ''; st.camStep = '';
      }
      persist(); drawPlan();
    }
    function planCard() {
      var src = p.plan_path && st.urls[p.plan_path];
      var inp = '<input type="file" class="cf-input" id="rd-file" accept="image/jpeg,image/png,image/webp,image/heic,image/heif"' + (st.planBusy ? ' disabled' : '') + '>';
      return '<div class="txt-card est-card rd-plan" id="rd-plan-card"><span class="label ct-label">도면</span>' +
        (p.plan_path ? '<div class="rd-plan-box' + (st.cam ? ' cam-on' : '') + '">' + (src ? '<div class="rd-cam-wrap"><img id="rd-plan-img" src="' + esc(src) + '" alt="올린 도면"' + (st.cam ? '' : ' data-rzoom data-rname="도면"') + '>' +
          '<svg class="rd-cam-svg" id="rd-cam-svg" aria-hidden="true"' + (st.cam ? ' data-camtap' : '') + '></svg></div>' : '<p class="hint">도면 불러오는 중…</p>') + '</div>' + camRow() : '') +
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
          (inp.cam ? '<p>카메라: 도면에서 찍은 곳' + (inp.cam.tx != null ? '·방향' : '') + '</p>' : '') +
          (r.status === 'done' ? '<p>' + (r.caption ? 'AI가 도면을 읽고 공간 설명을 써서 그렸어요' : '도면을 읽지 못해 기본 설명으로 그렸어요') + '</p>' : '')) + '</details></div>' +
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
        srcCard() + matCard() + planCard() + pickCard() + styleCard() +
        '<button type="button" class="btn btn-primary rd-go" data-rgo' + (canGo() ? '' : ' disabled') + '>' + esc(goLabel()) + '</button>' +
        '<div id="rd-results">' + listHtml() + '</div>';
      markPart(); drawCams();
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
        var need = list.map(function (r) { return r.image_path; }).concat([p.plan_path]).filter(function (x) { return x && !st.urls[x]; });
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
        var input = current();
        // 공간마다 찍어 둔 카메라 위치를 그 그림의 input 에 같이 (공사 내용 비교에는 안 씀)
        return DB.addRenderImages(views.map(function (v) {
          var c = v !== 'overview' && d.cams[v];
          return { project_id: p.id, view: v, plan_path: p.plan_path, input: c ? Object.assign({}, input, { cam: c }) : input, status: 'queued' };
        }));
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
          d.cams = {}; st.cam = ''; st.camStep = '';   // 찍어 둔 카메라 위치는 예전 도면 기준이라 지움
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
      fetch(url).then(function (res) { if (!res.ok) throw new Error('fetch'); return res.blob(); }).then(function (b) {
        K.saveBlob(b, '3d-' + r.view + (day ? '-' + day : '') + '.' + ext);   // 파일 이름은 영문·숫자만 (한글 이름은 브라우저에 따라 'download'로 바뀜)
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
      if (el.id === 'rd-size' || el.hasAttribute('data-cin') || el.hasAttribute('data-mn')) drawList();   // 공사 내용이 바뀌면 '예전 공사 내용' 표시도 다시
    });
    page.addEventListener('click', function (e) {
      var t = e.target, x;
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
      if ((x = t.closest('[data-cam]'))) { var ck = x.getAttribute('data-cam'); st.cam = st.cam === ck ? '' : ck; st.camStep = ''; return drawPlan(); }
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
