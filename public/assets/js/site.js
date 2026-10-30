/* =====================================================================
   공개 홈페이지 — 공통 머리/바닥글 + 페이지별 화면 그리기
   ===================================================================== */
(function () {
  'use strict';
  var C = window.SITE_CONFIG || {};
  var DB = window.DB;
  var body = document.body;
  var PAGE = body.getAttribute('data-page') || '';
  // 페이지 주소는 .html 없이 (/about, /work?id=…) — Netlify 가 about.html 을 /about 으로 보여 줌.
  // 미리보기(그냥 파일로 여는 곳)에서만 EXT 를 '.html' 로 바꿔 씀.
  var EXT = '';
  function pg(name) { return name === 'index' ? (EXT ? 'index' + EXT : './') : name + EXT; }

  /* ---------- 아이콘 ---------- */
  var I = {
    phone: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.7" stroke-linecap="round" stroke-linejoin="round"><path d="M5 4h3.2l1.6 4-2 1.3a11 11 0 0 0 6.9 6.9l1.3-2 4 1.6V19a1.6 1.6 0 0 1-1.7 1.6A16.5 16.5 0 0 1 3.4 5.7 1.6 1.6 0 0 1 5 4Z"/></svg>',
    chat: '<svg viewBox="0 0 24 24" fill="currentColor"><path d="M12 3.5c-5 0-9 3.2-9 7.1 0 2.5 1.6 4.7 4.1 6l-.9 3.4c-.1.3.3.6.6.4l4-2.6c.4 0 .8.1 1.2.1 5 0 9-3.2 9-7.2S17 3.5 12 3.5Z"/></svg>',
    arrow: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.7" stroke-linecap="round" stroke-linejoin="round"><path d="M5 12h14M13 6l6 6-6 6"/></svg>',
    menu: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.6" stroke-linecap="round"><path d="M4 7h16M4 12h16M4 17h16"/></svg>',
    close: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.6" stroke-linecap="round"><path d="M6 6l12 12M18 6 6 18"/></svg>',
    ext: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M14 4h6v6M20 4l-9 9M18 14v5a1 1 0 0 1-1 1H5a1 1 0 0 1-1-1V7a1 1 0 0 1 1-1h5"/></svg>',
    copy: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><rect x="9" y="9" width="11" height="11" rx="2"/><path d="M5 15H4a1 1 0 0 1-1-1V4a1 1 0 0 1 1-1h10a1 1 0 0 1 1 1v1"/></svg>',
    check: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="m5 12.5 4.5 4.5L19 7.5"/></svg>',
    photo: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><rect x="3" y="5" width="18" height="14" rx="2"/><circle cx="9" cy="10" r="1.6"/><path d="m21 16-5-5-8 8"/></svg>',
    form: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round"><rect x="5" y="4" width="14" height="17" rx="2"/><path d="M9 4V3h6v1M9 10h6M9 14h6M9 18h3"/></svg>',
    star: '<svg viewBox="0 0 24 24" fill="currentColor"><path d="m12 3 2.7 5.6 6.1.8-4.5 4.2 1.1 6.1L12 16.8l-5.4 2.9 1.1-6.1-4.5-4.2 6.1-.8L12 3Z"/></svg>',
  };
  window.SITE_ICONS = I;

  function esc(s) {
    return String(s == null ? '' : s).replace(/[&<>"']/g, function (c) {
      return { '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c];
    });
  }
  function tel() { return 'tel:' + String(C.phone || '').replace(/[^0-9+]/g, ''); }
  function q(sel, root) { return (root || document).querySelector(sel); }
  function qa(sel, root) { return Array.prototype.slice.call((root || document).querySelectorAll(sel)); }
  function param(k) { return new URLSearchParams(location.search).get(k); }
  function copyText(t) {
    if (navigator.clipboard && window.isSecureContext) return navigator.clipboard.writeText(t);
    return new Promise(function (ok, no) {
      var ta = document.createElement('textarea');
      ta.value = t; ta.setAttribute('readonly', ''); ta.style.cssText = 'position:fixed;top:0;left:0;opacity:0';
      document.body.appendChild(ta); ta.select();
      var done = false; try { done = document.execCommand('copy'); } catch (e) { /* 막힘 */ }
      document.body.removeChild(ta);
      if (done) ok(); else no();
    });
  }
  function fmtDate(iso) {
    if (!iso) return '';
    var d = new Date(iso);
    return d.getFullYear() + '.' + String(d.getMonth() + 1).padStart(2, '0');
  }
  function stars(n) {
    n = Math.max(0, Math.min(5, Number(n) || 5));
    var h = '';
    for (var i = 1; i <= 5; i++) h += '<span class="' + (i <= n ? '' : 'off') + '">' + I.star + '</span>';
    return '<div class="stars" aria-label="별점 ' + n + '점">' + h + '</div>';
  }
  function cover(w) { return (w.photos && w.photos[0]) || null; }
  /** 경력 햇수: careerSince(1995)부터 올해까지 — 매년 자동으로 바뀜 */
  var YEARS = C.careerSince ? new Date().getFullYear() - Number(C.careerSince) : null;
  function tok(v) {
    if (typeof v !== 'string') return v;
    if (YEARS != null) v = v.replace(/\{years\}/g, YEARS);
    return v.replace(/\{name\}/g, C.name || '').replace(/\{ceo\}/g, C.ceo || '');
  }

  /* ---------- 홈페이지 문구 (관리화면 '홈페이지 문구'에서 고친 값 > config.js 의 texts 처음 값) ---------- */
  var TXT_KEY = 'midesign-texts';
  var HOURS0 = C.hours, STAT0 = C.stats && C.stats[0] ? C.stats[0].value : null;
  var T = {}, txtCache = null;
  function setTexts(o) {
    o = o || {};
    T = Object.assign({}, C.texts || {}, o);
    C.hours = o.hours || HOURS0;
    if (STAT0 != null) C.stats[0].value = o.statSites || STAT0;
  }
  try { txtCache = JSON.parse(localStorage.getItem(TXT_KEY) || 'null'); } catch (e) {}
  setTexts(txtCache);
  function fillTexts() {
    qa('[data-edit]').forEach(function (el) {
      var v = tok(T[el.getAttribute('data-edit')]);
      if (typeof v !== 'string' || !v) return;
      v = v.replace(/(\S) 수 (있|없)/g, '$1\u00A0수\u00A0$2');   // '보실 / 수 있습니다' 처럼 '수'만 떨어지지 않게
      var mode = el.getAttribute('data-edit-mode');
      if (mode === 'paras') el.innerHTML = v.split(/\n\s*\n/).map(function (p) { return '<p>' + esc(p.trim()).replace(/\n/g, '<br>') + '</p>'; }).join('');
      else if (mode === 'lines') el.innerHTML = esc(v).replace(/\n/g, '<br>');
      else el.textContent = v.replace(/\s*\n\s*/g, ' ');
    });
  }

  /* ---------- 상담 신청 버튼 보이기/숨기기 (관리화면 '상담 신청' 칸의 스위치) ----------
     상담 신청으로 가는 버튼·링크에는 inq-only 를 붙여 두고, 꺼져 있으면 <html class="inq-off"> 로 한꺼번에 숨김 */
  var ROOT = document.documentElement, INQ_KEY = 'midesign-inq';
  // 관리화면 스위치: 상담 신청(inquiry_enabled) · 전화번호(phone_enabled) · 카카오톡(kakao_enabled)
  var SHOW = { inq: 'inquiry_enabled', tel: 'phone_enabled', kakao: 'kakao_enabled' };
  function unpend() { Object.keys(SHOW).forEach(function (k) { ROOT.classList.remove(k + '-pending'); }); }
  var inqTimer = setTimeout(unpend, 2500);  // 확인이 늦어지면 일단 보여 줌
  var settingsP = DB && DB.getSettings ? DB.getSettings() : Promise.resolve({});
  var inqReady = settingsP.then(function (s) {
    Object.keys(SHOW).forEach(function (k) {
      var on = !(s && s[SHOW[k]] === false);
      ROOT.classList.toggle(k + '-off', !on);
      try { localStorage.setItem('midesign-' + k, on ? '1' : '0'); } catch (e) {}
    });
    closedTitle();
    return !ROOT.classList.contains('inq-off');
  }, function () { return !ROOT.classList.contains('inq-off'); }).then(function (on) {
    clearTimeout(inqTimer); unpend(); return on;
  });
  // 상담 신청을 꺼 둔 때의 안내 제목: 켜 둔 연락 방법에 맞춰
  function closedTitle() {
    var el = document.getElementById('q-closed-title'); if (!el) return;
    var tel = !ROOT.classList.contains('tel-off'), kakao = !ROOT.classList.contains('kakao-off');
    el.textContent = tel && kakao ? '전화·카카오톡으로 상담받고 있어요' : tel ? '전화로 상담받고 있어요' : kakao ? '카카오톡으로 상담받고 있어요' : '지금은 상담을 잠시 쉬고 있어요';
  }
  window.SITE_INQ_READY = inqReady;

  /* ---------- 공통: 헤더 · 메뉴 · 푸터 · 상담 버튼 ---------- */
  var NAV = [
    [pg('works'), '시공사례', 'works'],
    [pg('process'), '시공과정', 'process'],
    [pg('reviews'), '고객후기', 'reviews'],
    [pg('about'), '회사소개', 'about'],
  ];
  function navCurrent(key) { return (PAGE === key || (PAGE === 'work' && key === 'works')) ? ' aria-current="page"' : ''; }
  /** 로고 SVG (logo.js) — 글자색(currentColor)을 따라가므로 히어로 위에서는 흰색, 스크롤하면 진한색 */
  function logoSvg(kind) {
    var L = window.SITE_LOGO;
    if (!L || !L[kind]) return '';
    return L[kind].replace(/ role="img" aria-label="[^"]*"/, '').replace(/<title>[\s\S]*?<\/title>/, '').replace('<svg ', '<svg aria-hidden="true" focusable="false" ');
  }
  function logoHtml() {
    var svg = logoSvg('horizontal');
    return '<a class="logo" href="' + pg('index') + '" aria-label="' + esc(C.name) + ' 처음 화면">' + (svg || '<b>' + esc(C.name) + '</b>') + '</a>';
  }

  function renderChrome() {
    if (!DB.live) {
      var bar = document.createElement('div');
      bar.className = 'demo-bar';
      bar.innerHTML = '<b>데모 화면</b> · 지금 보이는 시공사례·후기·사진은 예시입니다';
      body.insertBefore(bar, body.firstChild);
      body.classList.add('demo');
    }
    var header = q('#site-header');
    if (header) {
      header.innerHTML = '<div class="wrap">' + logoHtml() +
        '<nav class="gnb" aria-label="주 메뉴">' +
        NAV.map(function (n) { return '<a href="' + n[0] + '"' + navCurrent(n[2]) + '>' + n[1] + '</a>'; }).join('') +
        (C.blogUrl ? '<a class="ext" href="' + esc(C.blogUrl) + '" target="_blank" rel="noopener">블로그' + I.ext + '</a>' : '') +
        '</nav>' +
        '<a class="header-tel tel-only" href="' + tel() + '">' + I.phone + esc(C.phone) + '</a>' +
        '<a class="header-cta inq-only" href="' + pg('contact') + '"' + (PAGE === 'contact' ? ' aria-current="page"' : '') + '>상담 신청</a>' +
        '<button class="menu-btn" type="button" aria-label="메뉴 열기" aria-expanded="false">' + I.menu + '</button>' +
        '</div>';
    }

    // 카카오톡 표시: 단추 전체를 노랗게 칠하지 않고 노란 동그라미 아이콘으로만
    var KK = '<span class="kk-ico" aria-hidden="true">' + I.chat + '</span>';
    var mnav = document.createElement('div');
    mnav.className = 'mnav';
    mnav.setAttribute('role', 'dialog');
    mnav.setAttribute('aria-label', '메뉴');
    mnav.innerHTML = '<div class="mnav-top">' + logoHtml() + '<button class="menu-btn" type="button" aria-label="메뉴 닫기">' + I.close + '</button></div>' +
      '<ul>' + NAV.map(function (n) { return '<li><a href="' + n[0] + '">' + n[1] + I.arrow + '</a></li>'; }).join('') +
      // 상담 신청은 아래 큰 버튼(mnav-cta)으로만 — 목록에 같은 메뉴를 두 번 두지 않음
      (C.blogUrl ? '<li><a href="' + esc(C.blogUrl) + '" target="_blank" rel="noopener">네이버 블로그' + I.ext + '</a></li>' : '') + '</ul>' +
      '<div class="mnav-cta"><a class="btn btn-dark btn-go inq-only" href="' + pg('contact') + '"><span class="go-txt">' + I.form + '상담 신청</span><span class="go">' + I.arrow + '</span></a>' +
      '<a class="btn btn-quiet tel-only" href="' + tel() + '">' + I.phone + '전화 상담</a>' +
      '<a class="btn btn-quiet btn-kakao kakao-only" href="' + esc(C.kakaoUrl) + '" target="_blank" rel="noopener">' + KK + '카카오톡 상담</a></div>' +
      '<p class="mnav-info" data-c="hours">' + esc(C.hours) + '</p>';
    body.appendChild(mnav);
    var openBtn = header && q('.menu-btn', header);
    function setMenu(open) {
      mnav.classList.toggle('open', open);
      if (openBtn) openBtn.setAttribute('aria-expanded', open ? 'true' : 'false');
      document.documentElement.style.overflow = open ? 'hidden' : '';
    }
    if (openBtn) openBtn.addEventListener('click', function () { setMenu(true); });
    q('.menu-btn', mnav).addEventListener('click', function () { setMenu(false); });

    var footer = q('#site-footer');
    if (footer) {
      footer.innerHTML = '<div class="wrap">' + logoHtml() +
        '<div class="foot-info"><span>상호 ' + esc(C.legalName || C.name) + '</span><span>대표 ' + esc(C.ceo) + '</span><span>사업자등록번호 ' + esc(C.bizNumber) + '</span></div>' +
        '<div class="foot-info"><span>' + esc(C.address) + '</span><span class="tel-only">전화 <a href="' + tel() + '">' + esc(C.phone) + '</a></span><span data-c="hours">' + esc(C.hours) + '</span></div>' +
        '<div class="foot-links">' + NAV.map(function (n) { return '<a href="' + n[0] + '">' + n[1] + '</a>'; }).join('') + '<a class="inq-only" href="' + pg('contact') + '">상담 신청</a>' +
        (C.blogUrl ? '<a href="' + esc(C.blogUrl) + '" target="_blank" rel="noopener">네이버 블로그</a>' : '') +
        '<a class="kakao-only" href="' + esc(C.kakaoUrl) + '" target="_blank" rel="noopener">카카오톡 채널</a></div>' +
        '<div class="foot-copy"><span>' + (C.careerSince ? 'Since ' + esc(C.careerSince) + ' · ' : '') + '© ' + new Date().getFullYear() + ' ' + esc(C.name) + '</span>' +
        '<span class="foot-legal"><a class="foot-privacy" href="' + pg('privacy') + '">개인정보 처리방침</a><a href="admin/">관리자</a></span></div>' +
        '</div>';
    }

    var mc = document.createElement('div');
    mc.className = 'mobile-cta';
    // 아래 고정 단추: 전화·카톡은 흰 바탕 선 단추(작게), 상담 신청만 진한 단추(넓게) — 색을 3가지로 섞지 않음
    mc.innerHTML = '<a class="btn btn-quiet tel-only" href="' + tel() + '">' + I.phone + '전화</a>' +
      '<a class="btn btn-quiet btn-kakao kakao-only" href="' + esc(C.kakaoUrl) + '" target="_blank" rel="noopener">' + KK + '카톡</a>' +
      (PAGE === 'contact' ? '' : '<a class="btn btn-dark btn-go inq-only" href="' + pg('contact') + '"><span>상담 신청</span><span class="go">' + I.arrow + '</span></a>');
    if (PAGE === 'contact') mc.classList.add('two');
    body.appendChild(mc);
    var fc = document.createElement('div');
    fc.className = 'float-cta';
    fc.innerHTML = '<a class="f-kakao kakao-only" href="' + esc(C.kakaoUrl) + '" target="_blank" rel="noopener" aria-label="카카오톡 상담">' + I.chat + '<span>카톡<br>상담</span></a>' +
      '<a class="f-tel tel-only" href="' + tel() + '" aria-label="전화 상담">' + I.phone + '<span>전화</span></a>';
    body.appendChild(fc);

    // 설정값 채우기: data-c="phone" → 텍스트, data-href="tel|kakao|blog|map"
    fillConfig();
    // 페이지 안 상담 단추(아래 검은 상담 안내 등): 아이콘 맞추기
    qa('.btn-kakao').forEach(function (el) { if (!q('.kk-ico', el)) el.insertAdjacentHTML('afterbegin', KK); });
    qa('.cta-actions .tel-only, .q-closed-actions .tel-only').forEach(function (el) { if (!q('svg', el)) el.insertAdjacentHTML('afterbegin', I.phone); });
    qa('.cta-actions .inq-only').forEach(function (el) {
      if (q('.go', el)) return;
      el.classList.add('btn-go'); el.innerHTML = '<span class="go-txt">' + I.form + el.innerHTML + '</span><span class="go">' + I.arrow + '</span>';
    });
    if (YEARS != null) qa('[data-years]').forEach(function (el) { el.textContent = YEARS; });
    qa('[data-inq]').forEach(function (el) { var v = (C.inquiry || {})[el.getAttribute('data-inq')]; if (typeof v === 'string' && v) el.textContent = v; });
    qa('[data-href]').forEach(function (el) {
      var k = el.getAttribute('data-href');
      var map = C.naverMapUrl || ('https://map.naver.com/p/search/' + encodeURIComponent(C.address || ''));
      el.setAttribute('href', { tel: tel(), kakao: C.kakaoUrl, blog: C.blogUrl, map: map }[k] || '#');
    });
    // 복사 단추: data-copy="address" → 같은 줄의 data-c="address" 글자를 복사
    qa('[data-copy]').forEach(function (b) {
      var base = b.getAttribute('aria-label') || '복사';
      var label = function (done) {
        b.innerHTML = (done ? I.check : I.copy) + '<span>' + (done ? '복사됨' : '복사') + '</span>';
        b.classList.toggle('done', done); b.setAttribute('aria-label', done ? base + '됨' : base);
      };
      var timer = null;
      label(false);
      b.addEventListener('click', function () {
        var src = q('[data-c="' + b.getAttribute('data-copy') + '"]', b.parentNode);
        var text = src ? src.textContent.trim() : '';
        if (!text) return;
        copyText(text).then(function () {
          label(true);
          clearTimeout(timer); timer = setTimeout(function () { label(false); }, 1600);
        }, function () {   // 복사가 막힌 브라우저: 글자를 선택해 두어 길게 눌러 복사할 수 있게
          var r = document.createRange(); r.selectNodeContents(src);
          var s = window.getSelection(); s.removeAllRanges(); s.addRange(r);
        });
      });
    });
    qa('[data-title]').forEach(function (el) { el.textContent = el.textContent.replace(/○○인테리어/g, C.name); });

    // 히어로 위 투명 헤더 → 스크롤하면 불투명
    if (body.classList.contains('has-hero') && header) {
      var onScroll = function () { header.classList.toggle('solid', window.scrollY > 40); };
      window.addEventListener('scroll', onScroll, { passive: true });
      onScroll();
    }
  }

  /* ---------- 등장 애니메이션 ---------- */
  var io = 'IntersectionObserver' in window ? new IntersectionObserver(function (es) {
    es.forEach(function (e) { if (e.isIntersecting) { e.target.classList.add('in'); io.unobserve(e.target); } });
  }, { rootMargin: '0px 0px -8% 0px' }) : null;
  function reveal(root) {
    qa('.reveal:not(.in)', root).forEach(function (el) { if (io) io.observe(el); else el.classList.add('in'); });
  }

  /* ---------- 사진 크게 보기 ---------- */
  var LB = (function () {
    var el, img, count, list = [], idx = 0, sx = null;
    function build() {
      el = document.createElement('div');
      el.className = 'lightbox';
      el.setAttribute('role', 'dialog');
      el.setAttribute('aria-label', '사진 크게 보기');
      el.innerHTML = '<img alt="">' +
        '<button class="lb-btn lb-close" type="button" aria-label="닫기">' + I.close + '</button>' +
        '<button class="lb-btn lb-prev" type="button" aria-label="이전 사진">' + I.arrow + '</button>' +
        '<button class="lb-btn lb-next" type="button" aria-label="다음 사진">' + I.arrow + '</button>' +
        '<div class="lb-count"></div>';
      body.appendChild(el);
      img = q('img', el); count = q('.lb-count', el);
      q('.lb-close', el).onclick = close;
      q('.lb-prev', el).onclick = function () { go(-1); };
      q('.lb-next', el).onclick = function () { go(1); };
      el.addEventListener('click', function (e) { if (e.target === el) close(); });
      el.addEventListener('touchstart', function (e) { sx = e.touches[0].clientX; }, { passive: true });
      el.addEventListener('touchend', function (e) {
        if (sx == null) return;
        var dx = e.changedTouches[0].clientX - sx; sx = null;
        if (Math.abs(dx) > 50) go(dx < 0 ? 1 : -1);
      });
      document.addEventListener('keydown', function (e) {
        if (!el.classList.contains('open')) return;
        if (e.key === 'Escape') close();
        if (e.key === 'ArrowLeft') go(-1);
        if (e.key === 'ArrowRight') go(1);
      });
    }
    function show() {
      img.src = list[idx];
      count.textContent = (idx + 1) + ' / ' + list.length;
      q('.lb-prev', el).style.display = q('.lb-next', el).style.display = list.length > 1 ? '' : 'none';
    }
    function go(d) { idx = (idx + d + list.length) % list.length; show(); }
    function open(urls, i) { if (!el) build(); list = urls; idx = i || 0; show(); el.classList.add('open'); document.documentElement.style.overflow = 'hidden'; q('.lb-close', el).focus(); }
    function close() { el.classList.remove('open'); document.documentElement.style.overflow = ''; }
    return { open: open };
  })();

  /* ---------- 카드 ---------- */
  // 홈페이지에 보이는 현장: 아파트 이름 + 평수 (동·호수는 빼고 — 관리화면에서 실수로 적어도 안 보이게)
  function pubPlace(place, size) {
    var p = String(place || '').split(',')[0].split(/\s+/).filter(function (t) {
      return t && !/^(제)?[A-Za-z]?\d+([-~]\d+)*(동|호|호실)$/.test(t) && !/^[A-Za-z]동$/.test(t);
    }).join(' ').trim();
    var z = String(size || '').trim(); if (z && !/평$/.test(z)) z += '평';
    return p && z && p.indexOf(z) < 0 ? p + ' ' + z : (p || z);
  }
  function workCard(w, opt) {
    opt = opt || {};
    var c = cover(w);
    var src = c ? DB.photoUrl(c.thumb || c.full) : '';
    var srcset = c && c.thumb ? DB.photoUrl(c.thumb) + ' 800w, ' + DB.photoUrl(c.full) + ' 1600w' : '';
    var sizes = opt.big ? '(min-width:1024px) 66vw, 100vw' : '(min-width:1024px) 33vw, (min-width:640px) 50vw, 100vw';
    var meta = [w.building, pubPlace(w.place, w.size)].filter(Boolean).map(function (m) { return '<span>' + esc(m) + '</span>'; }).join('');
    var tags = (w.scopes || []).slice(0, 5).map(function (t) { return '#' + esc(t); }).join(' ');
    var n = (w.photos || []).length;
    return '<a class="work-card reveal" href="' + pg('work') + '?id=' + encodeURIComponent(w.id) + '">' +
      '<div class="thumb">' + (src ? '<img src="' + esc(src) + '"' + (srcset ? ' srcset="' + esc(srcset) + '" sizes="' + sizes + '"' : '') + ' alt="' + esc(w.title) + '" loading="lazy" decoding="async">' : '') +
      (n > 1 ? '<span class="count">' + I.photo + n + '</span>' : '') + '</div>' +
      (meta ? '<div class="meta">' + meta + '</div>' : '') +
      '<h3>' + esc(w.title) + '</h3>' +
      (tags ? '<div class="tags">' + tags + '</div>' : '') + '</a>';
  }
  function skeletonCards(n) {
    var h = '';
    for (var i = 0; i < n; i++) h += '<div class="work-card skeleton"><div class="thumb"></div><div class="bar"></div><div class="bar w"></div></div>';
    return h;
  }
  function reviewCard(r, worksById, opt) {
    opt = opt || {};
    var w = r.work_id && worksById ? worksById[r.work_id] : null;
    var photos = (r.photos || []);
    return '<article class="review reveal' + (opt.clamp ? ' clamp' : '') + '">' + stars(r.rating) +
      '<blockquote>' + esc(r.body) + '</blockquote>' +
      (photos.length && !opt.clamp ? '<div class="review-photos">' + photos.map(function (p, i) {
        return '<button type="button" data-rv="' + esc(r.id) + '" data-i="' + i + '" aria-label="후기 사진 크게 보기"><img src="' + esc(DB.photoUrl(p.thumb || p.full)) + '" alt="" loading="lazy"></button>';
      }).join('') + '</div>' : '') +
      '<div class="who"><span><b>' + esc(r.author) + ' 고객님</b>' + esc(pubPlace(r.place, w && w.size)) + '</span>' +
      (w ? '<a class="to-work" href="' + pg('work') + '?id=' + encodeURIComponent(w.id) + '">시공사례 보기</a>' : '<span>' + fmtDate(r.created_at) + '</span>') +
      '</div></article>';
  }
  function errorBox(el, e) {
    el.innerHTML = '<div class="empty">내용을 불러오지 못했습니다. 잠시 후 새로고침해 주세요.</div>';
    if (window.console) console.error(e);
  }

  function fillConfig() {
    qa('[data-c]').forEach(function (el) { var v = tok(C[el.getAttribute('data-c')]); if (v != null) el.innerHTML = el.hasAttribute('data-html') ? v : esc(v); });
  }
  function fillStats() {
    var st = q('#stats');
    if (st) {
      // '31년' 밑 설명줄: 인테리어 경력 | 누적 시공 현장 200+
      st.innerHTML = (C.stats || []).slice(0, 3).map(function (s) {
        return '<span class="sep">|</span>' + esc(tok(s.label)) + ' <b>' + esc(tok(s.value)) + '</b>';
      }).join('');
    }
  }

  /* ---------- 페이지: 메인 ---------- */
  function pageHome() {
    var grid = q('#featured-works');
    var rv = q('#home-reviews');
    fillStats();
    if (grid) grid.innerHTML = skeletonCards(3);
    Promise.all([DB.listWorks(), DB.listReviews()]).then(function (res) {
      var works = res[0], reviews = res[1];
      var featured = works.filter(function (w) { return w.featured; });
      works.forEach(function (w) { if (featured.length < 6 && featured.indexOf(w) < 0) featured.push(w); });
      featured = featured.slice(0, 6);

      // 히어로 사진 = '메인에 크게 보여주기' 시공사례들의 대표 사진이 번갈아 나옴
      var hs = C.heroSlides || {};
      heroSlider(featured.filter(function (w) { return cover(w); }).slice(0, hs.max || 5), (hs.seconds || 6) * 1000);
      if (grid) {
        grid.innerHTML = featured.length ? featured.map(function (w, i) { return workCard(w, { big: i === 0 }); }).join('')
          : '<div class="empty" style="grid-column:1/-1">아직 등록된 시공사례가 없습니다.</div>';
      }
      if (rv) {
        var byId = {};
        works.forEach(function (w) { byId[w.id] = w; });
        rv.innerHTML = reviews.length ? reviews.slice(0, 3).map(function (r) { return reviewCard(r, byId, { clamp: true }); }).join('')
          : '<div class="empty">첫 후기를 기다리고 있습니다.</div>';
        if (!reviews.length) q('#reviews-section').style.display = 'none';
      }
      reveal();
    }).catch(function (e) { if (grid) errorBox(grid, e); });
  }

  /* ---------- 메인 큰 사진: 천천히 바뀌는 슬라이드 ---------- */
  function heroSlider(works, interval) {
    var media = q('.hero-media'), cap = q('.hero-caption'), hero = q('.hero');
    if (!media || !works.length) return;
    var reduced = window.matchMedia && window.matchMedia('(prefers-reduced-motion: reduce)').matches;
    media.innerHTML = works.map(function (w, i) {
      var url = esc(DB.photoUrl(cover(w).full));
      return '<img class="hero-slide" ' + (i === 0 ? 'src="' + url + '" fetchpriority="high"' : 'data-src="' + url + '"') +
        ' alt="' + esc(w.title) + '"' + (i ? ' aria-hidden="true"' : '') + '>';
    }).join('');
    var imgs = qa('.hero-slide', media), idx = 0, timer = null, visible = true, busy = false;
    function caption(n) {
      if (!cap) return;
      var w = works[n];
      cap.href = pg('work') + '?id=' + encodeURIComponent(w.id);
      cap.innerHTML = '시공사례 &nbsp;|&nbsp; ' + esc(pubPlace(w.place, w.size) || w.title) + I.arrow;
    }
    function ready(img) {
      if (!img.getAttribute('src')) img.src = img.getAttribute('data-src');
      return (img.decode ? img.decode() : Promise.resolve()).catch(function () {});
    }
    function show(n) {
      if (busy || n === idx) return;
      busy = true;
      ready(imgs[n]).then(function () {
        imgs[idx].classList.remove('on'); imgs[idx].setAttribute('aria-hidden', 'true');
        imgs[n].classList.add('on'); imgs[n].removeAttribute('aria-hidden');
        idx = n; caption(n); busy = false;
        if (imgs[(n + 1) % imgs.length]) ready(imgs[(n + 1) % imgs.length]); // 다음 사진 미리 받아두기
      });
    }
    function stop() { clearTimeout(timer); timer = null; }
    function play() {
      stop();
      if (reduced || imgs.length < 2 || !visible || document.hidden) return;
      timer = setTimeout(function () { show((idx + 1) % imgs.length); play(); }, interval);
    }
    caption(0);
    ready(imgs[0]).then(function () {
      requestAnimationFrame(function () { imgs[0].classList.add('on'); });
      if (imgs[1] && !reduced) ready(imgs[1]);
      play();
    });
    // 화면에서 안 보이거나 다른 탭으로 가면 멈춤 (데이터 절약)
    document.addEventListener('visibilitychange', play);
    if ('IntersectionObserver' in window && hero) {
      new IntersectionObserver(function (es) { visible = es[0].isIntersecting; play(); }).observe(hero);
    }
  }

  /* ---------- 페이지: 시공사례 목록 ---------- */
  function pageWorks() {
    var grid = q('#works-grid'), chips = q('#works-chips'), info = q('#works-info'), more = q('#works-more');
    var PER = 12, shown = PER, all = [], type = param('type') || '';
    grid.innerHTML = skeletonCards(6);
    function draw() {
      var list = type ? all.filter(function (w) { return w.building === type; }) : all;
      info.textContent = '총 ' + list.length + '개의 현장';
      grid.innerHTML = list.length ? list.slice(0, shown).map(function (w) { return workCard(w); }).join('')
        : '<div class="empty" style="grid-column:1/-1">해당하는 시공사례가 아직 없습니다.</div>';
      more.style.display = list.length > shown ? '' : 'none';
      qa('.chip', chips).forEach(function (c) { c.setAttribute('aria-pressed', c.getAttribute('data-type') === type ? 'true' : 'false'); });
      reveal(grid);
    }
    DB.listWorks().then(function (works) {
      all = works;
      var counts = {};
      works.forEach(function (w) { if (w.building) counts[w.building] = (counts[w.building] || 0) + 1; });
      var types = (C.buildingTypes || []).filter(function (t) { return counts[t]; });
      chips.innerHTML = '<button class="chip" type="button" data-type="">전체<span class="n">' + works.length + '</span></button>' +
        types.map(function (t) { return '<button class="chip" type="button" data-type="' + esc(t) + '">' + esc(t) + '<span class="n">' + counts[t] + '</span></button>'; }).join('');
      chips.addEventListener('click', function (e) {
        var b = e.target.closest('.chip'); if (!b) return;
        type = b.getAttribute('data-type'); shown = PER;
        var u = new URL(location.href);
        if (type) u.searchParams.set('type', type); else u.searchParams.delete('type');
        history.replaceState(null, '', u);
        draw();
      });
      more.querySelector('button').addEventListener('click', function () { shown += PER; draw(); });
      draw();
    }).catch(function (e) { errorBox(grid, e); });
  }

  /* ---------- 페이지: 시공사례 상세 ---------- */
  function pageWork() {
    var root = q('#work-root');
    var id = param('id');
    if (!id) { location.replace(pg('works')); return; }
    Promise.all([DB.getWork(id), DB.listWorks(), DB.listReviews()]).then(function (res) {
      var w = res[0], works = res[1], reviews = res[2];
      if (!w || (!w.published)) {
        root.innerHTML = '<div class="wrap page-head"><h1>시공사례를 찾을 수 없습니다</h1><p>삭제되었거나 비공개로 바뀐 글입니다.</p><p style="margin-top:28px"><a class="btn btn-line" href="' + pg('works') + '">시공사례 목록으로</a></p></div>';
        return;
      }
      document.title = w.title + ' | ' + C.name + ' 시공사례';
      var md = q('meta[name="description"]');
      if (md) md.setAttribute('content', (w.body || w.title).slice(0, 120));
      var photos = w.photos || [];
      var urls = photos.map(function (p) { return DB.photoUrl(p.full); });
      var c = photos[0];
      var specs = [['위치', pubPlace(w.place)], ['평형', w.size], ['건물', w.building], ['공사 내용', (w.scopes || []).join(', ')], ['공사 기간', w.period]]
        .filter(function (s) { return s[1]; });
      var linked = reviews.filter(function (r) { return r.work_id === w.id; });
      var others = works.filter(function (o) { return o.id !== w.id; });
      var same = others.filter(function (o) { return o.building === w.building; });
      others = same.concat(others.filter(function (o) { return same.indexOf(o) < 0; })).slice(0, 3);
      var byId = {}; works.forEach(function (o) { byId[o.id] = o; });

      root.innerHTML =
        '<div class="wrap detail-head"><a class="crumb" href="' + pg('works') + '">' + I.arrow + '시공사례 목록</a>' +
        '<h1>' + esc(w.title) + '</h1>' +
        ((w.scopes || []).length ? '<div class="tags">' + w.scopes.map(function (t) { return '#' + esc(t); }).join(' ') + '</div>' : '') + '</div>' +
        (c ? '<div class="wrap"><button class="detail-cover" type="button" data-i="0" style="padding:0;border:0;width:100%;cursor:zoom-in;display:block" aria-label="대표 사진 크게 보기"><img src="' + esc(DB.photoUrl(c.full)) + '" alt="' + esc(w.title) + '"></button></div>' : '') +
        '<div class="wrap detail-grid">' +
        '<aside class="detail-side">' + (specs.length ? '<dl class="spec">' + specs.map(function (s) { return '<div><dt>' + s[0] + '</dt><dd>' + esc(s[1]) + '</dd></div>'; }).join('') + '</dl>' : '') +
        '<div class="side-cta"><a class="btn btn-dark tel-only" href="' + tel() + '">' + I.phone + '비슷한 공사 전화 상담</a>' +
        '<a class="btn btn-kakao kakao-only" href="' + esc(C.kakaoUrl) + '" target="_blank" rel="noopener">' + I.chat + '카카오톡으로 문의</a></div></aside>' +
        '<div>' + (w.body ? '<p class="detail-body">' + esc(w.body) + '</p>' : '') +
        (/^https?:\/\//i.test(w.blog_url || '') ? '<a class="blog-link" href="' + esc(w.blog_url) + '" target="_blank" rel="noopener">네이버 블로그에서 시공 과정 자세히 보기' + I.ext + '</a>' : '') +
        (photos.length > 1 ? '<div class="photo-stack">' + photos.slice(1).map(function (p, i) {
          return '<button type="button" data-i="' + (i + 1) + '" aria-label="사진 크게 보기"><img src="' + esc(DB.photoUrl(p.full)) + '" alt="' + esc(w.title) + ' 사진 ' + (i + 2) + '" loading="lazy" decoding="async"' + (p.w && p.h ? ' width="' + p.w + '" height="' + p.h + '"' : '') + '></button>';
        }).join('') + '</div>' : '') +
        (linked.length ? '<div class="detail-review"><span class="eyebrow">Review</span>' + linked.map(function (r) { return reviewCard(r, null); }).join('') + '</div>' : '') +
        '</div></div>' +
        (others.length ? '<section class="section" style="padding-bottom:40px"><div class="wrap"><div class="section-head"><div><span class="eyebrow">More</span><h2 class="section-title">다른 시공사례</h2></div><a class="more-link" href="' + pg('works') + '">전체 보기' + I.arrow + '</a></div>' +
          '<div class="works-grid">' + others.map(function (o) { return workCard(o); }).join('') + '</div></div></section>' : '');

      qa('[data-i]', root).forEach(function (b) {
        if (b.hasAttribute('data-rv')) return;
        b.addEventListener('click', function () { LB.open(urls, Number(b.getAttribute('data-i'))); });
      });
      bindReviewPhotos(root, linked);
      reveal(root);
    }).catch(function (e) { errorBox(root, e); });
  }

  function bindReviewPhotos(root, reviews) {
    var map = {}; reviews.forEach(function (r) { map[r.id] = r; });
    qa('[data-rv]', root).forEach(function (b) {
      b.addEventListener('click', function () {
        var r = map[b.getAttribute('data-rv')]; if (!r) return;
        LB.open(r.photos.map(function (p) { return DB.photoUrl(p.full); }), Number(b.getAttribute('data-i')));
      });
    });
  }

  /* ---------- 페이지: 고객 후기 ---------- */
  function pageReviews() {
    var list = q('#reviews-list');
    Promise.all([DB.listReviews(), DB.listWorks()]).then(function (res) {
      var reviews = res[0], byId = {};
      res[1].forEach(function (w) { byId[w.id] = w; });
      if (!reviews.length) { list.innerHTML = '<div class="empty">첫 후기를 기다리고 있습니다.</div>'; return; }
      list.innerHTML = reviews.map(function (r) { return reviewCard(r, byId); }).join('');
      bindReviewPhotos(list, reviews);
      reveal(list);
    }).catch(function (e) { errorBox(list, e); });
  }

  /* ---------- 페이지: 회사소개 / 시공과정 (사진만 채움) ---------- */
  function pageStatic() {
    var slots = qa('[data-photo-slot]');
    if (!slots.length) { reveal(); return; }
    DB.listWorks().then(function (works) {
      var pool = [];
      works.forEach(function (w) { (w.photos || []).forEach(function (p) { pool.push(p); }); });
      slots.forEach(function (el, i) {
        var p = pool[(Number(el.getAttribute('data-photo-slot')) || i) % Math.max(1, pool.length)];
        if (p && !el.querySelector('img')) el.innerHTML = '<img src="' + esc(DB.photoUrl(p.full)) + '" alt="" loading="lazy">';
      });
    }).catch(function () {}).then(function () { reveal(); });
  }

  /* ---------- 날짜 고르기: 달력 (머리에 년·월 드롭다운) ----------
     <div class="q-cal" data-days="90" aria-label="희망 상담일"> → 오늘부터 data-days일 뒤까지 고를 수 있음 */
  var CAL_ICON = '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.7" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><rect x="3.5" y="5" width="17" height="15.5" rx="2"/><path d="M3.5 10h17M8 3v4M16 3v4"/></svg>';
  var openCal = null;
  document.addEventListener('click', function (e) { if (openCal && !openCal.box.contains(e.target)) openCal.close(); });
  document.addEventListener('keydown', function (e) { if (e.key === 'Escape' && openCal) { var c = openCal; c.close(); c.btn.focus(); } });
  function calPick(box) {
    var W = '일월화수목금토';
    var pad = function (n) { return String(n).padStart(2, '0'); };
    var key = function (d) { return d.getFullYear() + '-' + pad(d.getMonth() + 1) + '-' + pad(d.getDate()); };
    var now = new Date(), min = new Date(now.getFullYear(), now.getMonth(), now.getDate());
    var max = new Date(min); max.setDate(max.getDate() + (Number(box.getAttribute('data-days')) || 90));
    var name = box.getAttribute('aria-label') || '날짜';
    var sel = null, view = new Date(min.getFullYear(), min.getMonth(), 1), off = false;
    box.innerHTML =
      '<button type="button" class="q-input q-cal-btn" aria-haspopup="dialog" aria-expanded="false"><span class="v">' + esc(name) + '을 골라 주세요</span>' + CAL_ICON + '</button>' +
      '<div class="q-cal-pop" role="dialog" aria-label="' + esc(name) + ' 달력" hidden>' +
      '<div class="q-cal-head"><button type="button" class="q-cal-nav" data-nav="-1" aria-label="이전 달">‹</button>' +
      '<select class="q-cal-y" aria-label="년"></select><select class="q-cal-m" aria-label="월"></select>' +
      '<button type="button" class="q-cal-nav" data-nav="1" aria-label="다음 달">›</button></div>' +
      '<div class="q-cal-week" aria-hidden="true">' + W.split('').map(function (w) { return '<span>' + w + '</span>'; }).join('') + '</div>' +
      '<div class="q-cal-grid"></div>' +
      '<div class="q-cal-foot"><button type="button" data-act="clear">지우기</button><button type="button" data-act="close">닫기</button></div></div>';
    var btn = q('.q-cal-btn', box), pop = q('.q-cal-pop', box), ys = q('.q-cal-y', box), ms = q('.q-cal-m', box), grid = q('.q-cal-grid', box);
    var yh = '';
    for (var y = min.getFullYear(); y <= max.getFullYear(); y++) yh += '<option value="' + y + '">' + y + '년</option>';
    ys.innerHTML = yh;
    function label(d) { return d.getFullYear() + '년 ' + (d.getMonth() + 1) + '월 ' + d.getDate() + '일 (' + W.charAt(d.getDay()) + ')'; }
    function inRange(d) { return d >= min && d <= max; }
    function draw(focusKey) {
      var y = view.getFullYear(), m = view.getMonth();
      ys.value = y;
      ms.innerHTML = '';
      for (var i = 0; i < 12; i++) {
        var first = new Date(y, i, 1), last = new Date(y, i + 1, 0);
        var ok = last >= min && first <= max;
        ms.insertAdjacentHTML('beforeend', '<option value="' + i + '"' + (ok ? '' : ' disabled') + '>' + (i + 1) + '월</option>');
      }
      ms.value = m;
      q('[data-nav="-1"]', box).disabled = new Date(y, m, 0) < min;
      q('[data-nav="1"]', box).disabled = new Date(y, m + 1, 1) > max;
      var h = '', lead = new Date(y, m, 1).getDay(), days = new Date(y, m + 1, 0).getDate(), tk = key(min), sk = sel ? key(sel) : '';
      for (var b = 0; b < lead; b++) h += '<span></span>';
      for (var d = 1; d <= days; d++) {
        var dt = new Date(y, m, d), k = key(dt), ok2 = inRange(dt);
        h += '<button type="button" data-d="' + k + '"' + (ok2 ? '' : ' disabled') + ' tabindex="-1"' +
          ' class="' + ['', dt.getDay() === 0 ? 'sun' : '', dt.getDay() === 6 ? 'sat' : '', k === tk ? 'today' : '', k === sk ? 'on' : ''].join(' ').trim() + '"' +
          ' aria-label="' + esc(label(dt)) + (k === tk ? ', 오늘' : '') + '"' + (k === sk ? ' aria-pressed="true"' : '') + '>' + d + '</button>';
      }
      grid.innerHTML = h;
      // 키보드로 움직일 칸: 고른 날 → 오늘 → 고를 수 있는 첫날
      var target = (focusKey && q('[data-d="' + focusKey + '"]:not(:disabled)', grid)) || (sk && q('[data-d="' + sk + '"]', grid)) || q('[data-d="' + tk + '"]', grid) || q('[data-d]:not(:disabled)', grid);
      if (target) target.tabIndex = 0;
      return target;
    }
    function open() {
      if (off) return;
      if (openCal && openCal !== api) openCal.close();
      var base = sel || min;
      view = new Date(base.getFullYear(), base.getMonth(), 1);
      draw();
      pop.hidden = false; btn.setAttribute('aria-expanded', 'true'); openCal = api;
      // 달력 아래쪽이 화면(휴대폰 아래 고정 버튼 포함)에 가리면 그만큼 올려 줌
      var bar = q('.mobile-cta'), barH = bar && getComputedStyle(bar).display !== 'none' ? bar.offsetHeight : 0;
      var r = pop.getBoundingClientRect(), limit = window.innerHeight - barH - 12;
      if (r.bottom > limit) window.scrollBy({ top: Math.min(r.bottom - limit, r.top - 80), behavior: 'smooth' });
    }
    function close() { pop.hidden = true; btn.setAttribute('aria-expanded', 'false'); if (openCal === api) openCal = null; }
    function setSel(d) {
      sel = d;
      q('.v', btn).textContent = d ? label(d) : name + '을 골라 주세요';
      btn.classList.toggle('has', !!d);
      box.dispatchEvent(new Event('input', { bubbles: true }));
    }
    btn.addEventListener('click', function () { pop.hidden ? open() : close(); });
    ys.addEventListener('change', function () {
      var y = Number(ys.value), m = view.getMonth();
      var t = new Date(y, m, 1);
      if (new Date(y, m + 1, 0) < min) t = new Date(min.getFullYear(), min.getMonth(), 1);
      if (t > max) t = new Date(max.getFullYear(), max.getMonth(), 1);
      view = t; draw();
    });
    ms.addEventListener('change', function () { view = new Date(view.getFullYear(), Number(ms.value), 1); draw(); });
    pop.addEventListener('click', function (e) {
      var nav = e.target.closest('[data-nav]');
      if (nav) { view = new Date(view.getFullYear(), view.getMonth() + Number(nav.getAttribute('data-nav')), 1); draw(); return; }
      var day = e.target.closest('[data-d]');
      if (day && !day.disabled) { var p = day.getAttribute('data-d').split('-'); setSel(new Date(+p[0], +p[1] - 1, +p[2])); close(); btn.focus(); return; }
      var act = e.target.closest('[data-act]');
      if (act) { if (act.getAttribute('data-act') === 'clear') setSel(null); close(); btn.focus(); }
    });
    grid.addEventListener('keydown', function (e) {
      var cur = e.target.closest('[data-d]'); if (!cur) return;
      var step = { ArrowLeft: -1, ArrowRight: 1, ArrowUp: -7, ArrowDown: 7 }[e.key];
      if (!step) return;
      e.preventDefault();
      var p = cur.getAttribute('data-d').split('-'), nd = new Date(+p[0], +p[1] - 1, +p[2] + step);
      if (!inRange(nd)) return;
      if (nd.getMonth() !== view.getMonth() || nd.getFullYear() !== view.getFullYear()) view = new Date(nd.getFullYear(), nd.getMonth(), 1);
      var t = draw(key(nd)); if (t) t.focus();
    });
    var api = {
      box: box, btn: btn, close: close,
      value: function () { return sel ? key(sel) : ''; },
      disable: function (on) { off = on; if (on) { setSel(null); close(); } btn.disabled = on; box.classList.toggle('off', on); },
    };
    return api;
  }

  /* ---------- 페이지: 상담 신청 ---------- */
  function pageContact() {
    var form = q('#inquiry-form'); if (!form) return;
    var Q = C.inquiry || {};
    var opts = { spaceTypes: Q.spaceTypes, buildTypes: Q.buildTypes, methods: Q.methods, workScopes: C.workScopes };
    qa('.q-chips', form).forEach(function (box) {
      var name = box.getAttribute('data-name'), type = box.getAttribute('data-type');
      box.innerHTML = (opts[box.getAttribute('data-opts')] || []).map(function (o, i) {
        var id = 'q-' + name + '-' + i;
        return '<label class="q-chip" for="' + id + '"><input type="' + type + '" id="' + id + '" name="' + name + '" value="' + esc(o) + '"><span>' + esc(o) + '</span></label>';
      }).join('');
    });
    qa('[data-inq]').forEach(function (el) { var v = Q[el.getAttribute('data-inq')]; if (v) el.textContent = v; });

    /* 지역: 시·도 → 시·군·구 드롭다운, '그 외 지역'은 직접 입력 */
    var RG = Q.regions || {}, sido = q('#q-sido', form), sgg = q('#q-sigungu', form), rEtc = q('#q-region-etc', form);
    if (sido) {
      sido.innerHTML = '<option value="">시·도</option>' + Object.keys(RG).map(function (k) { return '<option>' + esc(k) + '</option>'; }).join('') + '<option value="etc">그 외 지역</option>';
      sido.addEventListener('change', function () {
        var v = sido.value, list = RG[v] || [];
        sgg.innerHTML = '<option value="">시·군·구</option>' + list.map(function (x) { return '<option>' + esc(x) + '</option>'; }).join('');
        sgg.disabled = !list.length;
        sgg.hidden = v === 'etc'; rEtc.hidden = v !== 'etc';
        if (v === 'etc') rEtc.focus();
      });
    }
    function regionValue() {
      if (!sido || !sido.value) return '';
      if (sido.value === 'etc') { var t = rEtc.value.trim(); return t ? '그 외: ' + t : ''; }
      return sido.value + (sgg.value ? ' ' + sgg.value : '');
    }

    /* 시공 품목: 네모 체크박스 + 기타(직접 입력) */
    qa('.q-checks', form).forEach(function (box) {
      var name = box.getAttribute('data-name');
      box.innerHTML = (opts[box.getAttribute('data-opts')] || []).concat(['기타']).map(function (o, i) {
        var id = 'q-' + name + '-' + i;
        return '<label class="q-box" for="' + id + '"><input type="checkbox" id="' + id + '" name="' + name + '" value="' + esc(o) + '"><span>' + esc(o) + '</span></label>';
      }).join('');
    });
    var etcIn = q('#q-scope-etc', form), etcBox = q('[name="scopes"][value="기타"]', form);
    if (etcIn && etcBox) etcIn.addEventListener('input', function () { if (etcIn.value.trim()) etcBox.checked = true; });

    /* 예산 조절바 */
    var B = Q.budget || { min: 1000, max: 10000, step: 500, start: 5000, mark: 5000 };
    var range = q('#q-budget-range', form), bWrap = q('#q-budget', form), bText = q('#q-budget-text', form), bUnknown = q('#q-budget-unknown', form);
    var budgetTouched = false;
    function won(v) { return v >= 10000 && v % 10000 === 0 ? (v / 10000) + '억원' : v + '만원'; }
    function budgetLabel(v) { return v <= B.min ? won(B.min) + ' 이하' : v >= B.max ? won(B.max) + ' 이상' : won(v); }
    function budgetValue() {
      if (bUnknown && bUnknown.checked) return '아직 모르겠어요';
      if (!budgetTouched) return '';
      var v = Number(range.value);
      return budgetLabel(v) + (v > B.min && v < B.max ? ' 정도' : '');
    }
    function paintBudget() {
      var v = Number(range.value), pct = (v - B.min) / (B.max - B.min) * 100;
      range.style.setProperty('--pct', pct + '%');
      range.setAttribute('aria-valuetext', budgetLabel(v));
      if (!budgetTouched) return;
      bWrap.classList.remove('untouched');
      var lab = '<b>' + esc(budgetLabel(v)) + '</b>';
      bText.innerHTML = v <= B.min || v >= B.max ? lab + '의 예산으로 인테리어를 하고 싶어요.' : lab + ' 정도의 예산 내에서 인테리어를 하고 싶어요.';
    }
    if (range) {
      range.min = B.min; range.max = B.max; range.step = B.step; range.value = B.start;
      var markPct = (B.mark - B.min) / (B.max - B.min) * 100;
      q('#q-budget-scale', form).innerHTML = '<span>' + esc(budgetLabel(B.min)) + '</span>' +
        '<span class="mid" style="left:' + markPct + '%">' + esc(won(B.mark)) + '</span><span>' + esc(budgetLabel(B.max)) + '</span>';
      ['input', 'change'].forEach(function (t) { range.addEventListener(t, function () { budgetTouched = true; paintBudget(); }); });
      paintBudget();
      if (bUnknown) bUnknown.addEventListener('change', function () {
        bWrap.classList.toggle('off', bUnknown.checked); range.disabled = bUnknown.checked;
      });
    }

    /* 날짜 고르기 (달력) — 시공 예정일은 2년, 희망 상담일은 3개월 안에서만 고를 수 있음 */
    var whenPick = q('#q-when', form) && calPick(q('#q-when', form));
    var planPick = q('#q-plan', form) && calPick(q('#q-plan', form));
    var planNo = q('#q-plan-undecided', form);
    if (planNo && planPick) planNo.addEventListener('change', function () { planPick.disable(planNo.checked); });
    var opened = Date.now();
    var err = q('#q-error', form), btn = q('.q-submit', form);
    function val(n) { var el = form.querySelector('[name="' + n + '"]:checked') || form.querySelector('[name="' + n + '"]:not([type=radio]):not([type=checkbox])'); return el ? el.value.trim() : ''; }
    function fail(msg, focusSel) {
      err.textContent = msg; err.hidden = false;
      var el = focusSel && q(focusSel, form);
      if (el) { el.scrollIntoView({ behavior: 'smooth', block: 'center' }); var f = el.matches('input,textarea,select') ? el : el.querySelector('input,select,button'); if (f) setTimeout(function () { f.focus({ preventScroll: true }); }, 300); }
    }
    form.addEventListener('input', function () { err.hidden = true; });
    form.addEventListener('submit', function (e) {
      e.preventDefault();
      var data = {
        name: val('name'), phone: val('phone'), space_type: val('space_type'), build_type: val('build_type'),
        region: regionValue(), site_name: val('site_name'), size: val('size'), budget: budgetValue(), method: val('method'), message: val('message'),
        preferred_date: whenPick ? whenPick.value() : '',
        planned_date: planPick ? planPick.value() : '', planned_undecided: !!(planNo && planNo.checked),
        scopes: qa('[name="scopes"]:checked', form).map(function (x) {
          if (x.value !== '기타') return x.value;
          var etc = etcIn ? etcIn.value.trim() : '';
          return etc ? '기타: ' + etc : '기타';
        }),
        company_website: val('company_website'), elapsed: Date.now() - opened,
      };
      var digits = data.phone.replace(/[^0-9]/g, '');
      if (!data.name) return fail('이름을 적어 주세요.', '#q-name');
      if (!/^0\d{8,10}$/.test(digits)) return fail('연락처를 다시 확인해 주세요. (예: 010-1234-5678)', '#q-phone');
      if (!data.space_type) return fail('아파트·주택·상가 중 어떤 공간인지 골라 주세요.', '#f-space');
      if (!data.method) return fail('전화 상담과 방문 상담 중 하나를 골라 주세요.', '#f-method');
      if (!q('#q-agree', form).checked) return fail('개인정보 수집·이용에 동의해 주셔야 접수할 수 있어요.', '#f-agree');
      btn.disabled = true; btn.textContent = '보내는 중…';
      DB.submitInquiry(data).then(function (res) {
        form.hidden = true;
        var done = q('#q-done'); done.hidden = false;
        done.scrollIntoView({ behavior: 'smooth', block: 'start' });
      }).catch(function (e2) {
        btn.disabled = false; btn.textContent = '상담 신청하기';
        fail((e2 && e2.message ? e2.message : '접수하지 못했어요.') + (ROOT.classList.contains('tel-off') ? '' : ' 급하시면 ' + C.phone + '로 전화 주세요.'));
      });
    });
  }

  /* ---------- 시작 ---------- */
  renderChrome();
  var run = { home: pageHome, works: pageWorks, work: pageWork, reviews: pageReviews, contact: pageContact }[PAGE] || pageStatic;
  run();
  closedTitle();
  fillTexts();
  // 저장해 둔 문구가 있으면 바로 보여 주고, 처음 온 방문자는 최신 문구를 받은 뒤 보여 줌(최대 1.5초)
  var txtTimer = setTimeout(function () { ROOT.classList.remove('txt-pending'); }, 1500);
  if (txtCache) { clearTimeout(txtTimer); ROOT.classList.remove('txt-pending'); }
  settingsP.then(function (s) {
    var o = (s && s.texts && typeof s.texts === 'object') ? s.texts : {};
    if (JSON.stringify(o) !== JSON.stringify(txtCache || {})) {
      setTexts(o); fillConfig(); fillStats(); fillTexts();
    }
    try { localStorage.setItem(TXT_KEY, JSON.stringify(o)); } catch (e) {}
  }, function () {}).then(function () { clearTimeout(txtTimer); ROOT.classList.remove('txt-pending'); });
  reveal();
})();

/* 평수 ↔ ㎡ (상담 신청 — 2026-10-30): 한쪽을 적으면 다른 쪽이 저절로 (1평 = 400/121㎡). ㎡ 칸은 이름이 없어 보내지 않음 — 평수만 보냄 */
(function () {
  var K2 = 400 / 121;
  function n1(v) { var m = /(\d+(?:\.\d+)?)/.exec(String(v || '').replace(/,/g, '')); return m ? parseFloat(m[1]) : NaN; }
  function r1(n) { return isFinite(n) && n > 0 ? String(Math.round(n * 10) / 10) : ''; }
  document.addEventListener('input', function (e) {
    var el = e.target, pair = el && el.closest && el.closest('.py-pair'); if (!pair) return;
    var py = pair.querySelector('[data-py]'), m2 = pair.querySelector('[data-m2]'); if (!py || !m2) return;
    if (el === py) m2.value = r1(n1(py.value) * K2);
    else if (el === m2) py.value = r1(n1(m2.value) / K2);
  });
})();

