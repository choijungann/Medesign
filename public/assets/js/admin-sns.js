/* =====================================================================
   관리화면 — SNS (시공사례 → 인스타그램 피드 · 유튜브 쇼츠 대본 · 네이버 블로그 원고)
   · #/sns : 시공사례 목록에서 만들 글 고르기
   · #/sns/<시공사례id>/<instagram|shorts|blog> : AI로 쓰기 → 고치기 → 복사해서 올리기
   · AI는 admin-ai.js(AIKit)가 부름: 실제 홈페이지는 서버 함수(Gemini 또는 Claude), 미리보기는 보고 있는 사람의 Claude 계정, 안 되면 요청문 복사
   · 쓴 글은 관리자 전용 저장소(admin_settings)에 저장: blog:<id> · insta:<id> · shorts:<id> (+ 목록 표시용 sns:index)
   ===================================================================== */
(function () {
  'use strict';
  var K = window.AdminKit, P = window.AIPrompts;
  if (!K || !P) return;
  var C = K.C, DB = K.DB, I = K.I, esc = K.esc, $ = K.$, $$ = K.$$;
  var app = document.getElementById('app');
  var KINDS = [['instagram', '인스타그램', '피드 글 · 해시태그 · 사진 순서'], ['shorts', '유튜브 쇼츠', '장면별 대본 · 화면 글자 · 내레이션'], ['blog', '블로그', '네이버 블로그 원고']];
  var KEY = { blog: 'blog:', instagram: 'insta:', shorts: 'shorts:' };
  var TONES = [['warm', '친근하게'], ['calm', '차분하게'], ['info', '정보 위주로']];
  var LENS = { blog: [['short', '짧게'], ['normal', '보통'], ['long', '길게']], instagram: [['short', '짧게'], ['normal', '보통'], ['long', '길게']], shorts: [['short', '20~30초'], ['normal', '30~45초'], ['long', '45~60초']] };
  function label(kind) { var k = KINDS.filter(function (x) { return x[0] === kind; })[0]; return k ? k[1] : ''; }
  function getSet(key) { return DB.getAdminSetting ? DB.getAdminSetting(key).catch(function () { return null; }) : Promise.resolve(null); }
  function putSet(key, v) { return DB.saveAdminSetting ? DB.saveAdminSetting(key, v) : Promise.resolve(); }
  function modeTip(m) {
    if (m === 'claude') return '<div class="tip sns-mode">' + I.spark + '<span>이 미리보기에서는 <b>지금 보고 있는 분의 Claude 계정</b>으로 바로 써요. 처음 한 번 허락 창이 떠요.</span></div>';
    if (m === 'none') return '<div class="tip warn sns-mode">' + I.info + '<span>여기서는 AI를 바로 부를 수 없어서, 요청문을 복사해 AI 앱(Gemini·ChatGPT·Claude)에 붙여 넣는 방법으로 써요.</span></div>';
    return '';
  }

  /* =====================================================================
     목록
     ===================================================================== */
  function viewList() {
    K.frame('SNS', false, 'sns');
    app.innerHTML = '<div class="page"><div class="loading">불러오는 중…</div></div>';
    Promise.all([DB.listWorks({ all: true }), getSet('sns:index'), window.AIKit ? window.AIKit.mode() : Promise.resolve('none')]).then(function (r) {
      var works = r[0] || [], idx = r[1] || {}, mode = r[2];
      var page = document.createElement('div');
      page.className = 'page sns-page';
      page.innerHTML =
        '<div class="tip">' + I.info + '<span>올린 시공사례를 골라 <b>인스타그램 피드 글</b>, <b>유튜브 쇼츠 대본</b>, <b>네이버 블로그 원고</b>를 AI로 만들어요. AI는 적어 둔 내용과 사진에 보이는 것만 써요. 올리기 전에 꼭 읽어 보고 고쳐 주세요.</span></div>' +
        modeTip(mode) +
        '<div class="sec-head"><div class="sec-title"><h2>시공사례 고르기</h2><p>' + works.length + '건</p></div></div>' +
        (works.length ? '<div class="items sns-items">' + works.map(function (w) {
          var c = w.photos && w.photos[0], done = idx[w.id] || {};
          return '<div class="item">' +
            '<div class="item-top"><div class="item-thumb">' + (c ? '<img src="' + esc(DB.photoUrl(c.thumb || c.full)) + '" alt="" loading="lazy">' : '') + '</div>' +
            '<div class="item-txt"><div class="item-title">' + esc(w.title) + '</div><div class="item-meta"><span>' + K.fmtDate(w.created_at) + '</span><span>사진 ' + (w.photos || []).length + '장</span>' +
            (w.published ? '' : '<span class="pill off">숨김</span>') + '</div></div></div>' +
            '<div class="item-actions sns-acts">' + KINDS.map(function (k) {
              return '<a class="btn btn-outline' + (done[k[0]] ? ' done' : '') + '" href="#/sns/' + encodeURIComponent(w.id) + '/' + k[0] + '">' + (done[k[0]] ? I.check : '') + '<span>' + (k[0] === 'shorts' ? '쇼츠' : k[1]) + '</span></a>';
            }).join('') + '</div></div>';
        }).join('') + '</div>' : '<div class="empty-box">아직 올린 시공사례가 없어요.<br><a href="#/work/new">시공사례 올리기</a>를 먼저 해 주세요.</div>') +
        '<p class="hint">✓ 표시는 이미 만들어 둔 글이 있다는 뜻이에요. 눌러서 다시 보거나 고칠 수 있어요.</p>';
      app.innerHTML = ''; app.appendChild(page);
    }).catch(function (err) {
      app.innerHTML = '<div class="page"><div class="empty-box">' + esc(K.friendlyError(err)) + '</div></div>';
    });
  }

  /* =====================================================================
     글 만들기
     ===================================================================== */
  function viewWrite(id, kind) {
    if (!KEY[kind]) kind = 'instagram';
    K.frame(label(kind) + ' 글 만들기', true, 'works');
    K.state.backTo = '#/works';
    app.innerHTML = '<div class="page"><div class="loading">불러오는 중…</div></div>';
    Promise.all([DB.getWork(id), getSet(KEY[kind] + id), window.AIKit ? window.AIKit.mode() : Promise.resolve('none')]).then(function (r) {
      var w = r[0], draft = r[1], mode = r[2];
      if (!w) throw new Error('시공사례를 찾을 수 없어요. 이미 지웠을 수 있어요.');
      var photos = (w.photos || []).slice(0, 10);
      var urls = photos.map(function (p) { return DB.photoUrl(p.thumb || p.full); });
      var opt = (draft && draft.opt) || { tone: 'warm', length: kind === 'shorts' ? 'normal' : 'normal', note: '' };
      var busy = false, stream = '', fallback = null, saveT = null, ctl = null;
      var page = document.createElement('div');
      page.className = 'page blog-page sns-write';
      app.innerHTML = ''; app.appendChild(page);

      function headHtml() {
        var c = photos[0];
        return '<div class="blog-work">' + (c ? '<img src="' + esc(urls[0]) + '" alt="">' : '') +
          '<div><b>' + esc(w.title) + '</b><small>' + esc([w.place, w.size, (w.scopes || []).slice(0, 4).join(', ')].filter(Boolean).join(' · ')) + '</small>' +
          '<small>사진 ' + (w.photos || []).length + '장' + ((w.photos || []).length > 10 ? ' (AI에는 앞 10장만 보내요)' : '') + '</small></div></div>' +
          '<nav class="sns-tabs" aria-label="만들 글 종류">' + KINDS.map(function (k) {
            return '<a href="#/sns/' + encodeURIComponent(id) + '/' + k[0] + '"' + (k[0] === kind ? ' aria-current="page" class="on"' : '') + '>' + (k[0] === 'shorts' ? '쇼츠' : k[1]) + '</a>';
          }).join('') + '</nav>' + modeTip(mode);
      }
      function optHtml() {
        return '<details class="more blog-opt"' + (draft ? '' : ' open') + '><summary>글 분위기·길이 고르기</summary><div class="in">' +
          '<div class="field"><span class="label">분위기</span><div class="choices">' + TONES.map(function (o) {
            return '<label class="choice"><input type="radio" name="b-tone" value="' + o[0] + '"' + (opt.tone === o[0] ? ' checked' : '') + '><span>' + o[1] + '</span></label>';
          }).join('') + '</div></div>' +
          '<div class="field"><span class="label">' + (kind === 'shorts' ? '영상 길이' : '길이') + '</span><div class="choices">' + LENS[kind].map(function (o) {
            return '<label class="choice"><input type="radio" name="b-len" value="' + o[0] + '"' + (opt.length === o[0] ? ' checked' : '') + '><span>' + o[1] + '</span></label>';
          }).join('') + '</div></div>' +
          '<div class="field"><label for="b-note">더 넣고 싶은 말 <span class="opt">(선택)</span></label><textarea class="textarea" id="b-note" rows="3" maxlength="600" placeholder="예) 30년 된 아파트라 배관도 같이 바꿨어요">' + esc(opt.note || '') + '</textarea>' +
          '<p class="hint">AI는 적어 준 내용과 사진에 보이는 것만 써요. 가격이나 자재 이름을 넣고 싶으면 여기에 적어 주세요.</p></div></div></details>';
      }
      function thumb(n) { var u = urls[n - 1]; return u ? '<img src="' + esc(u) + '" alt="사진 ' + n + '" loading="lazy">' : '<span class="no-ph">사진 ' + n + '</span>'; }
      function copyRow(btns) {
        return '<div class="blog-copy"><button type="button" class="btn btn-primary" data-copy="all">' + I.copy + btns[0] + '</button>' +
          '<div class="btn-row' + (btns.length > 2 ? ' three' : '') + '">' + btns.slice(1).map(function (b) { return '<button type="button" class="btn btn-outline btn-sm" data-copy="' + b[0] + '">' + b[1] + '</button>'; }).join('') + '</div></div>';
      }
      function zipBtn(n) { return n ? '<button type="button" class="btn btn-outline only-mouse" data-zip>' + I.down + '사진 이 순서로 한꺼번에 받기 (zip)</button>' : ''; }
      function warnTips() {
        return (draft.cut ? '<div class="tip warn">' + I.info + '<span>글이 길어서 끝이 조금 잘렸을 수 있어요. 마지막 부분을 확인해 주세요.</span></div>' : '');
      }

      function resultHtml() {
        if (!draft) return '';
        var h = '<section class="blog-result">' + warnTips();
        if (kind === 'instagram') {
          var order = (draft.order && draft.order.length ? draft.order : photos.map(function (_, i) { return { photo: i + 1, why: '' }; })).filter(function (o) { return o.photo >= 1 && o.photo <= photos.length; });
          h += '<div class="txt-card"><div class="field"><label for="i-cap">캡션 (피드 글)</label><textarea class="textarea blog-body" id="i-cap" rows="12">' + esc(draft.cap || '') + '</textarea>' +
            '<p class="hint">첫 줄이 피드에서 가장 먼저 보여요. 마음에 안 드는 문장은 여기서 바로 고치세요.</p></div>' +
            '<div class="field"><label for="b-tags">해시태그</label><textarea class="textarea" id="b-tags" rows="3">' + esc((draft.tags || []).join(' ')) + '</textarea></div></div>' +
            copyRow(['캡션·해시태그 한꺼번에 복사', ['cap', '캡션만'], ['tags', '해시태그만']]) +
            (order.length ? '<h2 class="est-h">올릴 사진 순서</h2><div class="sns-order">' + order.map(function (o, i) {
              return '<div class="sns-ph"><span class="n">' + (i + 1) + '</span>' + thumb(o.photo) + '<small>사진 ' + o.photo + (o.why ? ' · ' + esc(o.why) : '') + '</small></div>';
            }).join('') + '</div><p class="hint">인스타그램에서 사진 여러 장을 고를 때 이 순서대로 골라 주세요.</p>' + zipBtn(order.length) : '');
        } else if (kind === 'shorts') {
          h += '<div class="txt-card"><div class="field"><label for="b-title">영상 제목</label>' +
            (draft.titles && draft.titles.length ? '<div class="blog-titles">' + draft.titles.map(function (t, i) { return '<button type="button" class="est-chip' + (t === draft.title ? ' on' : '') + '" data-pick-title="' + i + '">' + esc(t) + '</button>'; }).join('') + '</div>' : '') +
            '<input class="input" id="b-title" maxlength="100" value="' + esc(draft.title || '') + '"></div></div>' +
            '<h2 class="est-h">장면 <small>' + (draft.scenes || []).length + '개</small></h2><div class="sns-scenes">' + (draft.scenes || []).map(function (sc, i) {
              return '<div class="sns-scene" data-sc="' + i + '"><div class="sc-ph">' + (sc.photo ? thumb(sc.photo) : '<span class="no-ph">화면</span>') + '<span class="n">' + (i + 1) + '</span></div>' +
                '<div class="sc-txt"><small class="sc-time">' + esc([sc.time, sc.photo ? '사진 ' + sc.photo : ''].filter(Boolean).join(' · ')) + '</small>' +
                '<label class="sr-only" for="sc-cap-' + i + '">' + (i + 1) + '번 장면 화면 글자</label><input class="input sc-cap" id="sc-cap-' + i + '" data-scf="caption" maxlength="40" value="' + esc(sc.caption || '') + '" placeholder="화면 글자">' +
                '<label class="sr-only" for="sc-nar-' + i + '">' + (i + 1) + '번 장면 내레이션</label><textarea class="textarea sc-nar" id="sc-nar-' + i + '" data-scf="narration" rows="2" placeholder="내레이션">' + esc(sc.narration || '') + '</textarea></div></div>';
            }).join('') + '</div>' +
            '<p class="hint">휴대폰 영상 편집 앱에서 세로(9:16) 영상으로 사진을 이 순서대로 넣고, 화면 글자와 내레이션(직접 녹음하거나 글자 읽어 주기)을 붙이면 돼요.</p>' +
            '<div class="txt-card"><div class="field"><label for="s-desc">영상 설명</label><textarea class="textarea" id="s-desc" rows="4">' + esc(draft.desc || '') + '</textarea></div>' +
            '<div class="field"><label for="b-tags">태그</label><textarea class="textarea" id="b-tags" rows="2">' + esc((draft.tags || []).join(' ')) + '</textarea></div></div>' +
            copyRow(['대본 전체 복사', ['meta', '제목·설명·태그만']]) + zipBtn((draft.scenes || []).filter(function (s) { return s.photo; }).length);
        } else {
          h += '<div class="txt-card"><div class="field"><label for="b-title">제목</label>' +
            (draft.titles && draft.titles.length ? '<div class="blog-titles">' + draft.titles.map(function (t, i) { return '<button type="button" class="est-chip' + (t === draft.title ? ' on' : '') + '" data-pick-title="' + i + '">' + esc(t) + '</button>'; }).join('') + '</div>' : '') +
            '<input class="input" id="b-title" maxlength="100" value="' + esc(draft.title || '') + '"></div>' +
            '<div class="field"><label for="b-body">본문</label><textarea class="textarea blog-body" id="b-body" rows="16">' + esc(draft.body || '') + '</textarea>' +
            '<p class="hint">[사진 1] 자리에 아래 1번 사진을 넣으면 돼요. 마음에 안 드는 문장은 여기서 바로 고치세요.</p></div>' +
            '<div class="field"><label for="b-tags">해시태그</label><textarea class="textarea" id="b-tags" rows="2">' + esc((draft.tags || []).join(' ')) + '</textarea></div></div>' +
            copyRow(['제목·본문·태그 한꺼번에 복사', ['title', '제목만'], ['body', '본문만'], ['tags', '태그만']]) +
            (photos.length ? '<h2 class="est-h">사진 순서</h2><div class="blog-photos">' + photos.map(function (p, i) {
              return '<a href="' + esc(DB.photoUrl(p.full || p.thumb)) + '" target="_blank" rel="noopener"><img src="' + esc(urls[i]) + '" alt="사진 ' + (i + 1) + '" loading="lazy"><span>' + (i + 1) + '</span></a>';
            }).join('') + '</div><p class="hint">사진을 누르면 큰 사진이 열려요. 휴대폰에서는 길게 눌러 저장하세요.</p>' + zipBtn(photos.length) : '') +
            '<div class="txt-card blog-post"><div class="field"><span class="label">네이버 블로그에 올리기</span>' +
            (C.blogUrl ? '<a class="btn btn-outline" href="' + esc(C.blogUrl) + '" target="_blank" rel="noopener">네이버 블로그 열기</a>' : '') +
            '<p class="hint">블로그 앱이나 사이트에서 새 글을 열고, 복사한 원고를 붙여 넣은 뒤 [사진 n] 자리에 사진을 넣어 주세요.</p></div>' +
            '<div class="field"><label for="b-url">올린 블로그 글 주소 <span class="opt">(선택)</span></label><div class="est-addcat"><input class="input" id="b-url" type="url" maxlength="300" value="' + esc(w.blog_url || '') + '" placeholder="https://blog.naver.com/...">' +
            '<button type="button" class="btn btn-outline" data-saveurl>저장</button></div><p class="hint">적어 두면 홈페이지 시공사례에 ‘네이버 블로그에서 시공 과정 자세히 보기’ 링크가 생겨요.</p></div></div>';
        }
        return h + '<p class="hint blog-saved" id="b-saved">' + (draft.at ? esc(new Date(draft.at).toLocaleString('ko-KR')) + ' · ' + (draft.via === 'claude' ? 'Claude 계정으로 씀 · ' : '') + '고친 내용은 저절로 저장돼요' : '') + '</p></section>';
      }
      function fallbackHtml() {
        if (!fallback) return '';
        var prompt = window.AIKit ? window.AIKit.promptText(kind, { work: w, photos: urls, extra: opt }) : '';
        return '<section class="txt-card blog-fallback"><h2>' + esc(fallback.title) + '</h2><p class="hint">' + fallback.text + '</p>' +
          '<ol class="blog-steps"><li>아래 <b>요청문 복사</b>를 눌러요.</li><li>Gemini·ChatGPT·Claude 같은 AI 앱을 열고 붙여 넣어요. 사진도 순서대로 같이 올리면 더 잘 써요.</li><li>받은 답을 복사해서 아래 <b>받은 글 붙여 넣기</b> 칸에 넣어요.</li></ol>' +
          '<textarea class="textarea" id="b-prompt" rows="6" readonly>' + esc(prompt) + '</textarea>' +
          '<div class="btn-row"><button type="button" class="btn btn-primary" data-copyprompt>' + I.copy + '요청문 복사</button>' +
          '<button type="button" class="btn btn-outline" data-paste>받은 글 붙여 넣기</button></div>' +
          '<div class="blog-paste" hidden><textarea class="textarea" id="b-pasted" rows="6" placeholder="AI가 써 준 답을 여기에 붙여 넣으세요"></textarea>' +
          '<button type="button" class="btn btn-primary" data-usepaste>이 글로 정리하기</button></div></section>';
      }
      function busyHtml() {
        if (!busy) return '';
        return '<div class="blog-busy"><div class="spinner"></div><p>AI가 ' + (photos.length ? '사진 ' + Math.min(10, photos.length) + '장과 ' : '') + '시공 내용을 보고 ' + label(kind) + ' 글을 쓰고 있어요.<br>보통 30초~1분 걸려요. 화면을 끄지 말고 기다려 주세요.</p>' +
          '<pre class="sns-stream" id="sns-stream"' + (stream ? '' : ' hidden') + '>' + esc(stream) + '</pre>' +
          (ctl ? '<button type="button" class="btn btn-outline btn-sm" data-stop>멈추기</button>' : '') + '</div>';
      }
      function render() {
        page.innerHTML = headHtml() + optHtml() +
          '<button type="button" class="btn btn-primary blog-go" data-go' + (busy ? ' disabled' : '') + '>' + I.spark + (busy ? 'AI가 쓰는 중…' : draft ? '다시 쓰기' : 'AI로 ' + label(kind) + ' 글 쓰기') + '</button>' +
          busyHtml() + fallbackHtml() + resultHtml();
        autosize();
      }
      function autosize() { $$('.blog-body', page).forEach(function (b) { b.style.height = 'auto'; b.style.height = Math.min(1400, b.scrollHeight + 4) + 'px'; }); }
      function readOpt() {
        var tn = $('input[name=b-tone]:checked', page), ln = $('input[name=b-len]:checked', page), nt = $('#b-note', page);
        opt = { tone: tn ? tn.value : opt.tone, length: ln ? ln.value : opt.length, note: nt ? nt.value : opt.note };
      }
      function readFields() {
        if (!draft) return;
        var v = function (sel) { var e = $(sel, page); return e ? e.value : null; };
        var tg = v('#b-tags'); if (tg != null) draft.tags = tg.match(/#[^\s#]+/g) || [];
        if (kind === 'instagram') { var cp = v('#i-cap'); if (cp != null) draft.cap = cp; }
        if (kind === 'shorts') {
          var st = v('#b-title'); if (st != null) draft.title = st;
          var sd = v('#s-desc'); if (sd != null) draft.desc = sd;
          $$('.sns-scene', page).forEach(function (el) { var sc = draft.scenes[+el.getAttribute('data-sc')]; if (!sc) return; $$('[data-scf]', el).forEach(function (f) { sc[f.getAttribute('data-scf')] = f.value; }); });
        }
        if (kind === 'blog') { var bt = v('#b-title'); if (bt != null) draft.title = bt; var bb = v('#b-body'); if (bb != null) draft.body = bb; }
      }
      function store() {
        if (!draft) return Promise.resolve();
        readFields(); draft.opt = opt;
        return putSet(KEY[kind] + id, draft).then(function () {
          var s = $('#b-saved', page); if (s) s.textContent = '저장됨 ' + new Date().toLocaleTimeString('ko-KR', { hour: 'numeric', minute: '2-digit' });
          return getSet('sns:index').then(function (ix) { ix = ix || {}; ix[id] = ix[id] || {}; if (ix[id][kind]) return; ix[id][kind] = new Date().toISOString(); return putSet('sns:index', ix); });
        }).catch(function () {});
      }
      function useResult(res, extra) {
        var now = new Date().toISOString(), d;
        if (kind === 'instagram') d = { kind: kind, cap: [res.hook, res.body].filter(Boolean).join('\n\n'), tags: res.tags || [], order: res.order || [] };
        else if (kind === 'shorts') d = { kind: kind, titles: res.titles || [], title: (res.titles || [])[0] || w.title, scenes: res.scenes || [], desc: res.desc || '', tags: res.tags || [] };
        else d = { titles: res.titles || [], title: (res.titles || [])[0] || w.title, body: res.body || '', tags: res.tags || [] };
        draft = Object.assign(d, { at: now, opt: opt }, extra || {});
        fallback = null; render(); store();
        var el = $('.blog-result', page); if (el) el.scrollIntoView({ behavior: 'smooth', block: 'start' });
      }
      function generate() {
        readOpt(); readFields();
        if (draft) return K.ask({ title: '글을 다시 쓸까요?', text: '지금 글(고친 내용 포함)은 새 글로 바뀌어요.', cancel: '그만두기', ok: '다시 쓰기' }).then(function (ok) { if (ok) run(); });
        run();
      }
      function run() {
        if (!window.AIKit) { fallback = { title: '요청문을 만들었어요', text: '아래 방법으로 쓸 수 있어요.' }; return render(); }
        busy = true; stream = ''; fallback = null; render();
        window.AIKit.write(kind, { work: w, workId: id, photos: urls, extra: opt, onText: function (t) {
          stream = t; var el = $('#sns-stream', page); if (el) { el.hidden = !t; el.textContent = t; el.scrollTop = el.scrollHeight; }
        } }).then(function (res) {
          busy = false; useResult(res.result, { cut: !!res.cut, via: res.via });
          K.toast('글이 나왔어요. 읽어 보고 고쳐서 쓰세요');
        }).catch(function (err) {
          busy = false;
          var c = err && err.code;
          if (c === 'none' || c === 'demo') fallback = { title: '요청문을 만들었어요', text: '여기서는 AI를 바로 부를 수 없어요. 아래 방법으로 쓸 수 있어요.' };
          else if (c === 'no_key' || c === 'no_function') fallback = { title: 'AI 키가 아직 없어서 요청문을 만들었어요', text: 'Netlify에 AI 키(GEMINI_API_KEY 또는 ANTHROPIC_API_KEY)를 넣으면 버튼 한 번에 글이 나와요. 그 전에는 아래 방법으로 쓸 수 있어요.' };
          else if (c === 'not_granted') fallback = { title: 'Claude 사용을 허락하지 않았어요', text: '다음에 다시 열면 허락 창이 다시 떠요. 지금은 아래 방법으로 쓸 수 있어요.' };
          render();
          if (!fallback && c !== 'cancelled') K.ask({ title: '글을 쓰지 못했어요', text: esc(err.message || K.friendlyError(err)), cancel: false, ok: '확인' });
        });
      }
      function copyText() {
        readFields();
        var tags = (draft.tags || []).join(' ');
        if (kind === 'instagram') return { all: [draft.cap || '', '', tags].join('\n'), cap: draft.cap || '', tags: tags };
        if (kind === 'shorts') {
          var sc = (draft.scenes || []).map(function (s, i) { return (i + 1) + ') ' + [s.time, s.photo ? '사진 ' + s.photo : ''].filter(Boolean).join(' · ') + '\n   화면 글자: ' + (s.caption || '') + '\n   내레이션: ' + (s.narration || ''); }).join('\n');
          var meta = ['[제목] ' + (draft.title || ''), '', '[설명]', draft.desc || '', '', tags].join('\n');
          return { all: ['[제목] ' + (draft.title || ''), '', '[장면]', sc, '', '[설명]', draft.desc || '', '', '[태그] ' + tags].join('\n'), meta: meta };
        }
        return { all: [draft.title || '', '', draft.body || '', '', tags].join('\n'), title: draft.title || '', body: draft.body || '', tags: tags };
      }
      function zipOrder() {
        if (kind === 'instagram' && draft.order && draft.order.length) return draft.order.map(function (o) { return o.photo; });
        if (kind === 'shorts') { var seen = {}; return (draft.scenes || []).map(function (s) { return s.photo; }).filter(function (n) { if (!n || seen[n]) return false; seen[n] = 1; return true; }); }
        return photos.map(function (_, i) { return i + 1; });
      }
      function zipPhotos(btn) {
        var order = zipOrder().filter(function (n) { return n >= 1 && n <= photos.length; });
        if (!order.length) return;
        btn.disabled = true;
        var X;
        window.EstimateKit.loadExport().then(function (x) {
          X = x;
          return Promise.all(order.map(function (n) {
            var p = photos[n - 1];
            return fetch(DB.photoUrl(p.full || p.thumb)).then(function (res) { if (!res.ok) throw new Error('사진을 받지 못했어요'); return res.arrayBuffer(); });
          }));
        }).then(function (bufs) {
          var files = bufs.map(function (b, i) { return { name: String(i + 1).padStart(2, '0') + '_사진' + order[i] + '.jpg', data: new Uint8Array(b) }; });
          K.saveBlob(new Blob([X.lib.zip(files)], { type: 'application/zip' }), kind + '-photos-' + K.today().replace(/-/g, '') + '.zip');
          K.toast('사진 ' + files.length + '장을 받았어요');
        }).catch(function (err) { K.ask({ title: '사진을 받지 못했어요', text: esc(K.friendlyError(err)), cancel: false, ok: '확인' }); })
          .then(function () { btn.disabled = false; });
      }
      page.addEventListener('click', function (e) {
        var t = e.target, x;
        if (t.closest('[data-go]')) return generate();
        if (t.closest('[data-stop]')) { if (ctl) ctl.abort(); return; }
        if ((x = t.closest('[data-pick-title]'))) { var tt = draft.titles[+x.getAttribute('data-pick-title')]; $('#b-title', page).value = tt; draft.title = tt; $$('.blog-titles .est-chip', page).forEach(function (b) { b.classList.toggle('on', b === x); }); store(); return; }
        if ((x = t.closest('[data-copy]'))) {
          var parts = copyText(), k = x.getAttribute('data-copy');
          return K.copyFlash(x, parts[k] != null ? parts[k] : parts.all);
        }
        if ((x = t.closest('[data-copyprompt]'))) { K.copyFlash(x, $('#b-prompt', page).value); return; }
        if (t.closest('[data-paste]')) { var bp = $('.blog-paste', page); bp.hidden = false; $('#b-pasted', page).focus(); return; }
        if (t.closest('[data-usepaste]')) {
          var v = $('#b-pasted', page).value.trim();
          if (!v) { K.notice('받은 글을 먼저 붙여 넣어 주세요'); return; }
          var res = P.parse(kind, v);
          useResult(res, { via: 'paste' }); K.toast('글을 정리했어요'); return;
        }
        if ((x = t.closest('[data-zip]'))) return zipPhotos(x);
        if (t.closest('[data-saveurl]')) {
          var u = $('#b-url', page).value.trim();
          if (u && !/^https:\/\/\S+$/i.test(u)) { K.notice('https:// 로 시작하는 주소를 넣어 주세요'); return; }
          w.blog_url = u;
          DB.saveWork(w).then(function () { K.toast(u ? '블로그 주소를 저장했어요 · 홈페이지에 링크가 생겨요' : '블로그 주소를 지웠어요'); })
            .catch(function (err) { K.ask({ title: '저장하지 못했어요', text: esc(K.friendlyError(err)), cancel: false, ok: '확인' }); });
        }
      });
      page.addEventListener('change', function (e) { if (e.target.name === 'b-tone' || e.target.name === 'b-len') readOpt(); });
      page.addEventListener('input', function (e) {
        if (e.target.id === 'b-note') { readOpt(); return; }
        if (e.target.classList && e.target.classList.contains('blog-body')) autosize();
        if (draft && (/^(b-title|b-body|b-tags|i-cap|s-desc)$/.test(e.target.id) || e.target.hasAttribute('data-scf'))) { clearTimeout(saveT); saveT = setTimeout(store, 800); }
      });
      render();
      if (!draft && mode !== 'none') run();      // 처음 들어오면 바로 쓰기 시작
      else if (!draft) { fallback = { title: '요청문을 만들었어요', text: '여기서는 AI를 바로 부를 수 없어요. 아래 방법으로 쓸 수 있어요.' }; render(); }
    }).catch(function (err) {
      app.innerHTML = '<div class="page"><div class="empty-box">' + esc(K.friendlyError(err)) + '<br><a href="#/sns">SNS 목록으로</a></div></div>';
    });
  }

  // SNS 메뉴는 시공사례에 합침 (2026-10-26): #/sns 는 시공사례 목록으로, 글 만들기는 시공사례 카드의 'SNS 글'에서
  K.routes.sns = function (args) { if (args && args[0]) return viewWrite(decodeURIComponent(args[0]), args[1] || 'instagram'); K.replaceTo('#/works'); };
  // 예전 주소(#/blog/<id>)는 SNS 블로그로
  K.routes.blog = function (args) { K.replaceTo('#/sns/' + (args[0] || '') + '/blog'); };
})();
