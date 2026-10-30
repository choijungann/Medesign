/* =====================================================================
   관리화면 — 부모님이 휴대폰으로 시공사례·후기를 올리고 고치는 화면
   ===================================================================== */
(function () {
  'use strict';
  var C = window.SITE_CONFIG || {};
  var DB = window.DB;
  var IT = window.ImageTools;
  var app = document.getElementById('app');
  var topbar = document.getElementById('topbar');
  var titleEl = document.getElementById('top-title');
  var backBtn = document.getElementById('back-btn');
  var side = document.getElementById('side');
  var layout = document.getElementById('layout');
  var menuBtn = document.getElementById('menu-btn');
  var backdrop = document.getElementById('side-backdrop');
  var MAX_WORK_PHOTOS = 30, MAX_REVIEW_PHOTOS = 6;

  var I = {
    list: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.9" stroke-linecap="round"><path d="M9 6h11M9 12h11M9 18h11"/><path d="M4 6h.01M4 12h.01M4 18h.01" stroke-width="2.6"/></svg>',
    camera: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round"><path d="M4 8h3l1.5-2.5h7L17 8h3a1 1 0 0 1 1 1v9a1 1 0 0 1-1 1H4a1 1 0 0 1-1-1V9a1 1 0 0 1 1-1Z"/><circle cx="12" cy="13" r="3.6"/></svg>',
    chat: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round"><path d="M4 5h16v11H9l-5 4V5Z"/><path d="M8 9.5h8M8 12.5h5"/></svg>',
    plus: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round"><rect x="3" y="3" width="18" height="18" rx="4"/><path d="M12 8v8M8 12h8"/></svg>',
    left: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.4" stroke-linecap="round" stroke-linejoin="round"><path d="M15 5l-7 7 7 7"/></svg>',
    right: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.4" stroke-linecap="round" stroke-linejoin="round"><path d="M9 5l7 7-7 7"/></svg>',
    trash: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M4 7h16M10 11v6M14 11v6M6 7l1 13h10l1-13M9 7V4h6v3"/></svg>',
    check: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.6" stroke-linecap="round" stroke-linejoin="round"><path d="m5 12.5 4.5 4.5L19 7.5"/></svg>',
    star: '<svg viewBox="0 0 24 24" fill="currentColor"><path d="m12 3 2.7 5.6 6.1.8-4.5 4.2 1.1 6.1L12 16.8l-5.4 2.9 1.1-6.1-4.5-4.2 6.1-.8L12 3Z"/></svg>',
    mic: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.9" stroke-linecap="round" stroke-linejoin="round"><rect x="9" y="3" width="6" height="11" rx="3"/><path d="M5.5 11a6.5 6.5 0 0 0 13 0M12 17.5V21"/></svg>',
    info: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.9" stroke-linecap="round"><circle cx="12" cy="12" r="9"/><path d="M12 11v6M12 7.5v.5"/></svg>',
    inbox: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round"><path d="M4 13.5 6.5 5h11L20 13.5V19H4v-5.5Z"/><path d="M4 13.5h4.5l1.5 2.5h4l1.5-2.5H20"/></svg>',
    home: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round"><path d="M3 11 12 4l9 7"/><path d="M5 10v10h14V10"/></svg>',
    logout: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round"><path d="M14 4h4a2 2 0 0 1 2 2v12a2 2 0 0 1-2 2h-4"/><path d="M10 16l-4-4 4-4M6 12h10"/></svg>',
    close: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round"><path d="M6 6l12 12M18 6 6 18"/></svg>',
    db: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round"><ellipse cx="12" cy="6" rx="7" ry="2.8"/><path d="M5 6v12c0 1.5 3.1 2.8 7 2.8s7-1.3 7-2.8V6"/><path d="M5 12c0 1.5 3.1 2.8 7 2.8s7-1.3 7-2.8"/></svg>',
    ban: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round"><circle cx="12" cy="12" r="8.5"/><path d="m6 6 12 12"/></svg>',
    doc: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round"><path d="M6 3h9l4 4v14H6V3Z"/><path d="M14 3v5h5M9 12h7M9 15.5h7M9 19h4"/></svg>',
    gear: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round"><circle cx="12" cy="12" r="3"/><path d="M19.4 15a1.7 1.7 0 0 0 .3 1.8l.1.1a2 2 0 1 1-2.8 2.8l-.1-.1a1.7 1.7 0 0 0-1.8-.3 1.7 1.7 0 0 0-1 1.5V21a2 2 0 1 1-4 0v-.1a1.7 1.7 0 0 0-1.1-1.5 1.7 1.7 0 0 0-1.8.3l-.1.1a2 2 0 1 1-2.8-2.8l.1-.1a1.7 1.7 0 0 0 .3-1.8 1.7 1.7 0 0 0-1.5-1H3a2 2 0 1 1 0-4h.1a1.7 1.7 0 0 0 1.5-1.1 1.7 1.7 0 0 0-.3-1.8l-.1-.1a2 2 0 1 1 2.8-2.8l.1.1a1.7 1.7 0 0 0 1.8.3H9a1.7 1.7 0 0 0 1-1.5V3a2 2 0 1 1 4 0v.1a1.7 1.7 0 0 0 1 1.5 1.7 1.7 0 0 0 1.8-.3l.1-.1a2 2 0 1 1 2.8 2.8l-.1.1a1.7 1.7 0 0 0-.3 1.8V9a1.7 1.7 0 0 0 1.5 1H21a2 2 0 1 1 0 4h-.1a1.7 1.7 0 0 0-1.5 1Z"/></svg>',
    key: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round"><circle cx="8" cy="15" r="4"/><path d="m11 12 8.5-8.5M16 7l2.5 2.5M14 9l2 2"/></svg>',
    pen: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round"><path d="M4 20h4L19 9l-4-4L4 16v4Z"/><path d="m13.5 6.5 4 4"/></svg>',
    lock2: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round"><rect x="5" y="10.5" width="14" height="10" rx="2"/><path d="M8 10.5V7.5a4 4 0 0 1 8 0v3"/><path d="M12 14.5v2.5"/></svg>',
    users: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round"><circle cx="9" cy="8" r="3.5"/><path d="M2.5 20c.6-3.6 3.2-5.5 6.5-5.5s5.9 1.9 6.5 5.5"/><path d="M16 4.8a3.3 3.3 0 0 1 0 6.4M18 14.8c2 .7 3.2 2.4 3.5 5.2"/></svg>',
    cal: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round"><rect x="3.5" y="5" width="17" height="15.5" rx="2.5"/><path d="M3.5 10h17M8 3v4M16 3v4"/><path d="M7.5 14h2M11 14h2M14.5 14h2M7.5 17.2h2M11 17.2h2"/></svg>',
    sign: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round"><path d="M6 3h9l4 4v6"/><path d="M14 3v5h5M6 3v18h6M9 12h6M9 15.5h3"/><path d="M14.5 20.5c1.2-2.2 2.2-3.4 3-3.4 1.2 0-.6 3.2.6 3.2.8 0 1.5-1.2 2.4-1.2"/></svg>',
    cube: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round"><path d="M12 3 20 7.5v9L12 21l-8-4.5v-9L12 3Z"/><path d="M4 7.5 12 12l8-4.5M12 12v9"/></svg>',
    spark: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round"><path d="M12 3.5 13.8 9l5.7 1.8-5.7 1.8L12 18.2l-1.8-5.6L4.5 10.8 10.2 9 12 3.5Z"/><path d="M19 3v3M17.5 4.5h3M5 17v3M3.5 18.5h3"/></svg>',
    phone: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round"><path d="M6.6 3.5h2.6l1.6 4.2-2 1.3a11 11 0 0 0 6.2 6.2l1.3-2 4.2 1.6v2.6a2 2 0 0 1-2.2 2A16.5 16.5 0 0 1 4.6 5.7a2 2 0 0 1 2-2.2Z"/></svg>',
    copy: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round"><rect x="8.5" y="8.5" width="12" height="12" rx="2"/><path d="M15.5 8.5V5.5a2 2 0 0 0-2-2h-8a2 2 0 0 0-2 2v8a2 2 0 0 0 2 2h3"/></svg>',
    down: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.9" stroke-linecap="round" stroke-linejoin="round"><path d="M12 4v11M7 10.5l5 5 5-5M5 20h14"/></svg>',
    wrench: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round"><path d="M14.5 6.5a4 4 0 0 0 5 5l-8.8 8.8a2.1 2.1 0 0 1-3-3l8.8-8.8Z"/><path d="M14.5 6.5 17 4l3 3-2.5 2.5"/></svg>',
    lock: '<svg viewBox="0 0 64 64"><rect width="64" height="64" rx="16" fill="#475F7B"/><path d="M15 31 32 17l17 14" fill="none" stroke="#FFFFFF" stroke-width="4" stroke-linecap="round" stroke-linejoin="round"/><path d="M20 28v19h24V28" fill="none" stroke="#FFFFFF" stroke-width="4" stroke-linejoin="round"/><path d="M28 47V37h8v10" fill="none" stroke="#C9D4E0" stroke-width="4" stroke-linejoin="round"/></svg>',
  };

  /* ---------- 작은 도구들 ---------- */
  function esc(s) {
    return String(s == null ? '' : s).replace(/[&<>"']/g, function (c) {
      return { '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c];
    });
  }
  function $(sel, root) { return (root || document).querySelector(sel); }
  function $$(sel, root) { return Array.prototype.slice.call((root || document).querySelectorAll(sel)); }
  function fmtDate(iso) {
    if (!iso) return '';
    var d = new Date(iso);
    return d.getFullYear() + '.' + String(d.getMonth() + 1).padStart(2, '0') + '.' + String(d.getDate()).padStart(2, '0');
  }
  function store(k, v) { try { if (v === undefined) return localStorage.getItem(k); localStorage.setItem(k, v); } catch (e) { return null; } }
  function siteUrl(path) { return DB.base + (path || ''); }
  function friendlyError(e) {
    var m = String((e && e.message) || e || '');
    if (/row-level security|permission|not authorized|403|401|JWT/i.test(m)) return '저장 권한이 없어요. 로그아웃했다가 다시 로그인해 보세요. 계속 안 되면 앤에게 알려주세요.';
    if (/fetch|network|Failed|load|인터넷/i.test(m)) return '인터넷 연결이 불안정해요. 와이파이나 데이터가 켜져 있는지 확인한 뒤 다시 눌러 주세요.';
    if (/quota|storage|space/i.test(m)) return '저장 공간이 부족해요. 앤에게 알려주세요.';
    return '저장하지 못했어요. 잠시 후 다시 눌러 주세요. (' + m + ')';
  }

  /* 검은 안내 상자(토스트)는 화면에 띄우지 않음 (2026-10-25 대표님 요청).
     '저장했어요'·'옮겼어요' 같은 알림은 화면이 바뀌는 것으로 알 수 있으니 눈에는 안 보이고, 화면 읽기 프로그램에만 읽어 줌.
     꼭 알려야 하는 안내(입력 확인·실패)는 notice() 흰 확인 창, 복사는 flash() 로 단추 글자를 잠깐 바꿈 */
  var toastEl;
  function toast(msg) {
    if (!toastEl) { toastEl = document.createElement('div'); toastEl.className = 'sr-only'; toastEl.setAttribute('role', 'status'); toastEl.setAttribute('aria-live', 'polite'); document.body.appendChild(toastEl); }
    toastEl.textContent = msg || '';
  }
  // 새로 넣은 칸으로 커서: 화면을 가운데로 끌어오지 않고, 안 보일 때만 살짝 (휴대폰에서 화면이 왔다 갔다 하지 않게)
  function focusNear(el) {
    if (!el) return;
    try { el.focus({ preventScroll: true }); } catch (e) { el.focus(); }
    var r = el.getBoundingClientRect(), vh = (window.visualViewport && window.visualViewport.height) || window.innerHeight;
    if (r.top < 80 || r.bottom > vh - 110) el.scrollIntoView({ block: 'nearest' });
  }
  // 화면 위쪽을 다시 그려도 지금 쓰고 있는 칸이 화면에서 움직이지 않게 (위가 길어지거나 짧아지면 그만큼 스크롤을 맞춤)
  function keepPos(el, fn) {
    var t0 = el && el.isConnected ? el.getBoundingClientRect().top : null;
    fn();
    if (t0 != null && el.isConnected) { var d = el.getBoundingClientRect().top - t0; if (Math.abs(d) > 1) window.scrollBy(0, d); }
  }
  function notice(title, text) { return ask({ title: title, text: text || '', cancel: false, ok: '확인' }); }
  function flash(btn, text) {
    if (!btn || btn._flash) return;
    var old = btn.innerHTML; btn._flash = true; btn.classList.add('flashed');
    btn.innerHTML = I.check + '<span>' + esc(text) + '</span>';
    setTimeout(function () { btn.innerHTML = old; btn._flash = false; btn.classList.remove('flashed'); }, 1600);
  }
  // 복사 + 단추에 '복사했어요' (못 하면 흰 창으로 내용을 보여 줌)
  function copyFlash(btn, value, label) {
    return copyText(value).then(function (ok) {
      if (ok) flash(btn, btn && btn.classList.contains('btn-link') ? '복사됨' : '복사했어요');   // 작은 글자 단추는 짧게 (줄이 바뀌지 않게)
      else notice('복사하지 못했어요', (label ? esc(label) + ': ' : '') + '<b>' + esc(value).slice(0, 300) + '</b><br><small>칸을 길게 눌러 직접 복사해 주세요.</small>');
      return ok;
    });
  }

  /** 확인 창: Promise<boolean> */
  function ask(o) {
    return new Promise(function (resolve) {
      var ov = document.createElement('div');
      ov.className = 'overlay';
      ov.innerHTML = '<div class="sheet" role="alertdialog" aria-modal="true" aria-labelledby="ask-t">' +
        '<h3 id="ask-t">' + esc(o.title) + '</h3>' + (o.text ? '<p>' + o.text + '</p>' : '') +
        '<div class="btn-row">' + (o.cancel === false ? '' : '<button class="btn btn-outline" type="button" data-v="0">' + esc(o.cancel || '아니요') + '</button>') +
        '<button class="btn ' + (o.okClass || 'btn-primary') + '" type="button" data-v="1">' + esc(o.ok || '네') + '</button></div></div>';
      if (o.cancel === false) $('.btn-row', ov).style.gridTemplateColumns = '1fr';
      document.body.appendChild(ov);
      $$('button', ov).forEach(function (b) {
        b.addEventListener('click', function () { ov.remove(); resolve(b.getAttribute('data-v') === '1'); });
      });
      $('button[data-v="1"]', ov).focus();
    });
  }

  /** 진행 창 */
  function progress(title) {
    var ov = document.createElement('div');
    ov.className = 'overlay';
    ov.innerHTML = '<div class="sheet" role="dialog" aria-modal="true" aria-live="polite"><h3>' + esc(title) + '</h3>' +
      '<p>화면을 끄거나 다른 앱으로 넘어가지 말고 잠시만 기다려 주세요.</p>' +
      '<div class="progress"><div></div></div><div class="progress-txt">준비 중…</div></div>';
    document.body.appendChild(ov);
    return {
      set: function (done, total, label) {
        $('.progress div', ov).style.width = (total ? Math.round(done / total * 100) : 100) + '%';
        $('.progress-txt', ov).textContent = label;
      },
      close: function () { ov.remove(); },
    };
  }

  /* ---------- 찾아서 고르기 (계약서·고객·견적서·시공사례가 수백·수천 건이 돼도 드롭다운에 다 늘어놓지 않음) ----------
     o = { title, ph, items: [..] 또는 Promise, recent: 처음에 보일 개수(기본 8), none: '연결 안 함' 같은 맨 위 줄(선택), cur: 지금 고른 id, onPick(item|null) }
     item = { id, tag: '계약서', label, sub, keys: 찾기용 글(전화번호·현장 등), grp: 묶음 이름(선택), pin: true면 처음 화면에 늘 보임 }
     찾기: 띄어 쓴 낱말마다 모두 맞아야 함 · 숫자는 전화번호 일부(뒷자리)로도 · ㄱㅁㅅ 처럼 초성만 적어도 됨 */
  var CHO = 'ㄱㄲㄴㄷㄸㄹㅁㅂㅃㅅㅆㅇㅈㅉㅊㅋㅌㅍㅎ';
  function choseong(x) { return String(x || '').replace(/[가-힣]/g, function (c) { return CHO.charAt(Math.floor((c.charCodeAt(0) - 0xAC00) / 588)); }); }
  function fdNorm(x) { return String(x || '').toLowerCase().replace(/[\s·.,\-()\[\]\/~]+/g, ''); }
  function fdIndex(it) {
    if (!it._ix) { var t = fdNorm([it.label, it.sub, it.tag, it.keys].join(' ')); it._ix = { t: t, c: choseong(t), d: String([it.label, it.sub, it.keys].join(' ')).replace(/\D/g, '') }; }
    return it._ix;
  }
  function fdMatch(it, q) {
    var ix = fdIndex(it);
    return String(q || '').trim().split(/\s+/).filter(Boolean).every(function (w) {
      var n = fdNorm(w); if (!n) return true;
      if (/^[0-9-]+$/.test(w)) return ix.d.indexOf(w.replace(/\D/g, '')) >= 0 || ix.t.indexOf(n) >= 0;
      if (/^[ㄱ-ㅎ]+$/.test(n)) return ix.c.indexOf(n) >= 0;
      return ix.t.indexOf(n) >= 0;
    });
  }
  var FD_MAX = 30;
  function finder(o) {
    var ov = document.createElement('div');
    ov.className = 'overlay fd-ov';
    ov.innerHTML = '<div class="sheet fd-sheet" role="dialog" aria-modal="true" aria-labelledby="fd-t">' +
      '<div class="fd-head"><h3 id="fd-t">' + esc(o.title || '찾아서 고르기') + '</h3><button type="button" class="icon-btn fd-x" data-fdx aria-label="닫기">' + I.close + '</button></div>' +
      '<div class="cust-search fd-q"><label class="sr-only" for="fd-q">찾기</label><input class="input" id="fd-q" type="search" inputmode="search" enterkeyhint="search" autocomplete="off" placeholder="' + esc(o.ph || '이름·전화번호·현장으로 찾기') + '"></div>' +
      '<div class="fd-tabs" id="fd-tabs" role="tablist" aria-label="종류" hidden></div>' +
      '<div class="fd-list" id="fd-list"><p class="fd-note">불러오는 중…</p></div></div>';
    document.body.appendChild(ov);
    var input = $('#fd-q', ov), box = $('#fd-list', ov), items = null, all = null, shown = [];
    // o.tabs: 종류(tag)가 둘 이상이면 한 줄로 섞지 않고 탭(견적서 · 계약서 · 고객)으로 나눠서 찾기 — 탭마다 개수(찾는 중이면 찾은 개수)
    var tabOn = false, tab = '', tabList = [];
    function row(it, i) {
      return '<button type="button" class="fd-item' + (o.cur && it.id === o.cur ? ' on' : '') + (it.dim ? ' fd-dim' : '') + '" data-fdi="' + i + '">' +
        (it.tag && !tabOn ? '<span class="fd-tag fd-' + esc(it.tagKey || '') + '">' + esc(it.tag) + '</span>' : '') +
        '<span class="fd-main"><b>' + esc(it.label || '이름 없음') + '</b>' + (it.sub ? '<small>' + esc(it.sub) + '</small>' : '') + '</span>' +
        (o.cur && it.id === o.cur ? '<span class="fd-on">' + I.check + '</span>' : '') + '</button>';
    }
    function drawTabs(q) {
      var tb = $('#fd-tabs', ov);
      tb.hidden = !tabOn; if (!tabOn) return;
      tb.innerHTML = tabList.map(function (t) {
        var n = all.filter(function (it) { return it.tag === t && (!q || fdMatch(it, q)); }).length;
        return '<button type="button" role="tab" class="fd-tab' + (t === tab ? ' on' : '') + '" aria-selected="' + (t === tab) + '" data-fdtab="' + esc(t) + '">' + esc(t) + ' <small>' + n + '</small></button>';
      }).join('');
    }
    function draw() {
      if (!all) return;
      var q0 = input.value.trim();
      drawTabs(q0);
      items = tabOn ? all.filter(function (it) { return it.tag === tab; }) : all;
      var q = q0, list, html = '', grp = null, more = 0;
      if (!items.length) { box.innerHTML = (o.none ? '<button type="button" class="fd-item fd-none" data-fdnone>' + esc(o.none) + '</button>' : '') + '<p class="fd-note">' + esc(tabOn ? '아직 없어요.' : (o.empty || '아직 고를 게 없어요.')) + '</p>'; shown = []; return; }
      if (q) {
        list = items.filter(function (it) { return fdMatch(it, q); });
        more = Math.max(0, list.length - FD_MAX); list = list.slice(0, FD_MAX);
        html += '<p class="fd-h">' + (list.length ? '찾은 결과 ' + (list.length + more) + '건' : '') + '</p>';
      } else {
        var n = o.recent || 8, rest = 0;
        list = items.filter(function (it) { if (it.pin) return true; rest++; return rest <= n; });
        more = -1;
        if (o.none) html += '<button type="button" class="fd-item fd-none' + (!o.cur ? ' on' : '') + '" data-fdnone>' + esc(o.none) + (!o.cur ? '<span class="fd-on">' + I.check + '</span>' : '') + '</button>';
        if (!list.some(function (it) { return it.grp; })) html += '<p class="fd-h">' + (items.length > list.length ? '최근 ' + list.length + '건 · 전체 ' + items.length + '건' : '전체 ' + items.length + '건') + '</p>';
      }
      shown = list;
      html += list.map(function (it, i) {
        var h = it.grp && it.grp !== grp ? '<p class="fd-h' + (it.grpKey ? ' fd-g fd-g-' + esc(it.grpKey) : '') + '">' + esc(it.grp) + '</p>' : '';
        grp = it.grp || grp; return h + row(it, i);
      }).join('');
      if (q && !list.length) html += '<p class="fd-note">찾는 게 없어요. 이름 한두 글자나 전화번호 뒷자리로 찾아보세요.</p>';
      else if (more > 0) html += '<p class="fd-note">' + more + '건 더 있어요. 더 자세히 적어 보세요.</p>';
      else if (more < 0 && items.length > list.length) html += '<p class="fd-note">나머지는 위 찾기 칸에 이름·전화번호·현장을 적어 찾아요.</p>';
      box.innerHTML = html;
    }
    function close() { ov.remove(); if (o.focus && o.focus.focus) o.focus.focus(); }
    function pick(it) { ov.remove(); if (o.focus && o.focus.focus) o.focus.focus(); o.onPick(it); }
    Promise.resolve(typeof o.items === 'function' ? o.items() : o.items).then(function (l) {
      all = l || [];
      if (o.tabs) {
        all.forEach(function (it) { if (it.tag && tabList.indexOf(it.tag) < 0) tabList.push(it.tag); });
        var ORD = ['견적서', '계약서', '고객'], oi = function (t) { var i = ORD.indexOf(t); return i < 0 ? 99 : i; };
        tabList.sort(function (a, b) { return oi(a) - oi(b); });   // 일 순서대로: 견적서 → 계약서 → 고객
        tabOn = tabList.length > 1;
        var c0 = o.cur && all.filter(function (it) { return it.id === o.cur; })[0];
        tab = c0 && c0.tag ? c0.tag : (o.tab && tabList.indexOf(o.tab) >= 0 ? o.tab : tabList[0]);
      }
      draw();
    })
      .catch(function (err) { box.innerHTML = '<p class="fd-note">불러오지 못했어요. ' + esc(friendlyError(err)) + '</p>'; });
    input.addEventListener('input', draw);
    input.addEventListener('keydown', function (e) {
      if (e.key === 'Enter') { e.preventDefault(); if (shown.length === 1 || (shown.length && input.value.trim())) pick(shown[0]); }
      if (e.key === 'ArrowDown') { e.preventDefault(); var f = $('.fd-item', box); if (f) f.focus(); }
    });
    box.addEventListener('keydown', function (e) {
      if (e.key !== 'ArrowDown' && e.key !== 'ArrowUp') return;
      var all = $$('.fd-item', box), i = all.indexOf(document.activeElement); if (i < 0) return;
      e.preventDefault();
      if (e.key === 'ArrowUp' && i === 0) return input.focus();
      var nx = all[i + (e.key === 'ArrowDown' ? 1 : -1)]; if (nx) nx.focus();
    });
    ov.addEventListener('click', function (e) {
      var x;
      if (e.target === ov || e.target.closest('[data-fdx]')) return close();
      if (e.target.closest('[data-fdnone]')) return pick(null);
      if ((x = e.target.closest('[data-fdtab]'))) { tab = x.getAttribute('data-fdtab'); draw(); return; }
      if ((x = e.target.closest('[data-fdi]'))) return pick(shown[+x.getAttribute('data-fdi')]);
    });
    ov.addEventListener('keydown', function (e) { if (e.key === 'Escape') { e.stopPropagation(); close(); } });
    // 휴대폰은 자판이 목록을 가리므로 바로 커서를 두지 않음 (찾기 칸을 누르면 그때 자판)
    if (window.matchMedia && matchMedia('(hover: hover) and (pointer: fine)').matches) setTimeout(function () { input.focus(); }, 30);
    return { close: close };
  }
  /* ---------- 블랙리스트: 같은 연락처로 상담 신청·견적서·계약서가 오면 경고 ---------- */
  var blCache = null, blAt = 0;
  function blacklistMap(force) {
    if (!blCache || force || Date.now() - blAt > 120000) blAt = Date.now(), blCache = soft(DB.listCustomers).then(function (cs) {   // 2분마다 새로 (다른 기기에서 등록한 것도 반영)
      var m = {}; (cs || []).forEach(function (c) { var d = digits(c.phone); if (c.blacklist && d) m[d] = c; }); return m;
    });
    return blCache;
  }
  function blacklistOf(phone) { var d = digits(phone); return d.length < 9 ? Promise.resolve(null) : blacklistMap().then(function (m) { return m[d] || null; }); }
  function blacklistBanner(c, lead) {
    return '<div class="bl-warn" role="alert">' + I.ban + '<span><b>' + esc(lead || '블랙리스트 고객이에요') + '</b>' +
      '<small>' + esc((c.name || '이름 없음') + ' · ' + (c.phone || '')) + (c.blacklist_note ? ' · 사유: ' + esc(c.blacklist_note) : '') + '</small>' +
      '<a href="#/customer/' + encodeURIComponent(c.id) + '">고객 정보 보기</a></span></div>';
  }
  // 같은 고객은 한 번만 창으로 알림 (화면을 다시 그려도 또 뜨지 않게)
  function blacklistWarn(c) {
    state.blWarned = state.blWarned || {};
    if (!c || state.blWarned[c.id]) return;
    state.blWarned[c.id] = 1;
    ask({ title: '블랙리스트 고객이에요', text: '<b>' + esc(c.name || '이름 없음') + '</b> · ' + esc(c.phone || '') + (c.blacklist_note ? '<br>사유: ' + esc(c.blacklist_note) : '') +
      '<br><small>고객 관리에서 블랙리스트로 등록한 연락처와 같아요.</small>', cancel: false, ok: '확인했어요', okClass: 'btn-danger' });
  }
  // 칸(slot)에 경고 줄을 넣고, 처음이면 창으로도 알림
  function blacklistCheck(phone, slot, lead) {
    return blacklistOf(phone).then(function (c) {
      if (slot) slot.innerHTML = c ? blacklistBanner(c, lead) : '';
      if (c) blacklistWarn(c);
      return c;
    });
  }

  // 목록 개수: 찾기 칸과 목록 사이에 '총 n건' (찾는 중이면 '찾은 결과 n건 · 전체 n건')
  // 목록 바로 위 한 줄: 왼쪽 '총 n건' · 오른쪽 [전체 보기] [여러 개 지우기] (제목 줄에 단추를 몰아넣지 않음)
  function homeCount(all, shown, key) {   // 시공사례·후기: '총 n건 · 숨김 n건' / 찾는 중이면 '찾은 결과 n건 · 전체 n건'
    var el = document.getElementById('home-n'); if (!el) return;
    var f = filterActive(key), h = all.filter(function (x) { return !x.published; }).length;
    el.innerHTML = listCount(all.length, shown.length, f) + (!f && h ? ' · 숨김 ' + h + '건' : '');
  }
  function listTools(countId, viewKey) {
    return '<div class="list-tools"><p class="list-count" id="' + countId + '"></p>' + (viewKey ? '<div class="lt-btns">' + viewToggle(viewKey) + '</div>' : '') + '</div>';
  }
  function listCount(total, shown, finding, unit) {
    unit = unit || '건';
    if (!total) return '';
    return finding ? '<b>찾은 결과 ' + shown + unit + '</b> · 전체 ' + total + unit : '<b>총 ' + total + unit + '</b>';
  }
  // 드롭다운 대신 쓰는 칸: 누르면 finder 창. id 의 숨은 입력칸에 고른 값이 들어감 (.value 로 읽기)
  function finderField(id, o) {
    o = o || {};
    return '<div class="fd-field" data-fdfield="' + esc(id) + '"><input type="hidden" id="' + esc(id) + '" value="' + esc(o.value || '') + '">' +
      '<button type="button" class="fd-btn' + (o.label ? ' has' : '') + '" data-fdopen="' + esc(id) + '"' + (o.labelledby ? ' aria-labelledby="' + esc(o.labelledby) + ' ' + esc(id) + '-v"' : '') + (o.disabled ? ' disabled' : '') + '>' +
      '<span class="fd-val" id="' + esc(id) + '-v">' + esc(o.label || o.ph || '찾아서 고르기') + '</span><span class="fd-go">' + esc(o.go || (o.label ? '바꾸기' : '찾기')) + '</span></button>' +
      (o.clear ? '<button type="button" class="fd-clear" data-fdclear="' + esc(id) + '" aria-label="' + esc(o.clear) + '"' + (o.value ? '' : ' hidden') + '>' + I.close + '</button>' : '') + '</div>';
  }
  function finderSet(scope, id, value, label, ph) {
    var box = $('[data-fdfield="' + id + '"]', scope); if (!box) return;
    $('#' + id, box).value = value || '';
    var b = $('.fd-btn', box); b.classList.toggle('has', !!value);
    $('.fd-val', box).textContent = value ? label : (ph || $('.fd-val', box).getAttribute('data-ph') || '찾아서 고르기');
    var go = $('.fd-go', box); if (go && go.textContent !== '찾기' && go.textContent !== '바꾸기') { /* 따로 정한 글자는 그대로 */ } else if (go) go.textContent = value ? '바꾸기' : '찾기';
    var c = $('.fd-clear', box); if (c) c.hidden = !value;
  }

  /* ---------- 화면 이동 + 작성 중 보호 ---------- */
  var state = { dirty: false, hash: '', ignore: false, tab: null };
  function go(h) { location.hash = h; }
  function setDirty(v) { state.dirty = v; }

  /* ---------- 뒤로 가기 = 바로 전에 보던 화면 ----------
     관리화면 안에서 지나온 화면마다 번호(kIdx)를 붙여 둠 → 뒤로 단추는 브라우저 뒤로 가기와 똑같이 전 화면으로.
     처음 들어온 화면(주소로 바로 열었거나 새로 고침 전 기록이 없을 때)만 그 메뉴 목록·처음 화면으로. */
  var nav = { idx: 0, seq: {}, keep: false, on: false };
  function navStamp() {
    var st = null; try { st = history.state; } catch (e) {}
    if (st && typeof st.kIdx === 'number') nav.idx = st.kIdx;
    else {
      nav.idx = !nav.on ? 0 : nav.keep ? nav.idx : nav.idx + 1;
      try { history.replaceState({ kIdx: nav.idx }, '', location.href); } catch (e) {}
    }
    nav.keep = false; nav.on = true; nav.seq[nav.idx] = location.hash || '#/';
  }
  function replaceTo(h) { nav.keep = true; location.replace(h); }   // 같은 화면 안에서 주소만 바꿈 (뒤로 가기 기록 안 남김)
  function setHash(h) {   // 화면을 다시 그리지 않고 주소 글자만 바꿈
    try { history.replaceState(history.state, '', h); } catch (e) {}
    state.hash = h; nav.seq[nav.idx] = h;
  }
  // 저장·지우기를 마치고 돌아갈 때: 바로 전 화면이 거기면 뒤로, 아니면 지금 화면을 그 화면으로 바꿈 (끝낸 화면이 뒤로 가기에 남지 않게)
  function leave(h) {
    if (nav.idx > 0 && nav.seq[nav.idx - 1] === h) history.back();
    else if ((location.hash || '#/') !== h) replaceTo(h);
    else route();
  }
  function goBack() {
    if (nav.idx > 0) history.back();
    else replaceTo(state.backTo || '#/');
  }
  window.addEventListener('beforeunload', function (e) { if (state.dirty) { e.preventDefault(); e.returnValue = ''; } });
  window.addEventListener('hashchange', function () {
    if (state.ignore) { state.ignore = false; navStamp(); return; }
    var target = location.hash;
    if (state.dirty && target !== state.hash) {
      navStamp();
      state.ignore = true;
      location.hash = state.hash;
      ask({ title: '작성 중인 내용이 있어요', text: leaveText(), cancel: '계속 쓰기', ok: '나가기', okClass: 'btn-danger' })
        .then(function (ok) { if (ok) { setDirty(false); location.hash = target; } });
      return;
    }
    route();
  });
  backBtn.addEventListener('click', function () {
    if (!state.dirty) return goBack();
    ask({ title: '작성 중인 내용이 있어요', text: leaveText(), cancel: '계속 쓰기', ok: '나가기', okClass: 'btn-danger' })
      .then(function (ok) { if (ok) { setDirty(false); goBack(); } });
  });
  // 같은 화면 안에서 바꾸는 링크(달력 이전 달·다음 달 등)는 data-replace, 다 하고 돌아가는 링크(목록으로)는 data-leave
  document.addEventListener('click', function (e) {
    if (e.defaultPrevented || e.button || e.metaKey || e.ctrlKey || e.shiftKey || e.altKey) return;
    var a = e.target.closest && e.target.closest('a[data-replace], a[data-leave]'); if (!a) return;
    var h = a.getAttribute('href') || ''; if (h.charAt(0) !== '#') return;
    e.preventDefault();
    if (state.dirty) { location.hash = h; return; }   // 작성 중이면 늘 하던 대로 물어봄
    if (a.hasAttribute('data-leave')) leave(h); else replaceTo(h);
  });

  /* ---------- PC 화면 왼쪽 메뉴 (휴대폰에서는 CSS로 숨김) ---------- */
  var SECTION = { inquiries: '상담 신청', works: '시공사례', reviews: '고객 후기' };
  function renderSide(active) {
    var c = state.counts || {};
    function link(key, href, label, ico, extra) {
      var on = active === key;
      return '<a class="side-link' + (on ? ' on' : '') + '" href="' + href + '"' + (on ? ' aria-current="page"' : '') + '>' + ico + '<span class="t">' + label + '</span>' + (extra || '') + '</a>';
    }
    side.innerHTML =
      '<div class="side-top"><a class="side-logo" href="#/" aria-label="관리 처음 화면">' + ((window.SITE_LOGO && window.SITE_LOGO.horizontal) || '<b>' + esc(C.name) + '</b>') + '</a>' +
      '<button class="side-close" type="button" data-close aria-label="메뉴 닫기">' + I.close + '<span>닫기</span></button></div>' +
      '<nav class="side-nav" aria-label="목록">' +
      link('home', '#/', '홈', I.home) +
      link('calendar', '#/calendar', '일정 달력', I.cal) +
      link('inquiries', '#/inquiries', '상담 신청', I.inbox, c.inq ? '<span class="badge" aria-label="새 상담 ' + c.inq + '건">' + c.inq + '</span>' : '') +
      link('estimates', '#/estimates', '견적서', I.doc) +
      link('contracts', '#/contracts', '계약서', I.sign) +
      link('customers', '#/customers', '고객 관리', I.users) +
      link('works', '#/works', '시공사례', I.camera) +
      link('reviews', '#/reviews', '고객 후기', I.chat) +
      link('renders', '#/renders', '3D 그림', I.cube) +   // 견적서를 골라 도면으로 3D 예시 그림 — 설정 바로 위 (2026-10-28)
      link('settings', '#/settings', '설정', I.gear) +
      '</nav>' +
      '<div class="side-foot">' +
      link('help', '#/help', '사용 방법', I.info) +
      '<a class="side-link" href="' + esc(siteUrl('')) + '" target="_blank" rel="noopener">' + I.home + '<span class="t">홈페이지 보기</span></a>' +
      '<button class="side-link" type="button" data-logout>' + I.logout + '<span class="t">로그아웃</span></button>' +
      '</div>';
  }
  /* 휴대폰: 오른쪽 위 '메뉴' 버튼 → 오른쪽에서 열리는 메뉴 */
  function openMenu() {
    side.classList.add('open'); backdrop.hidden = false;
    menuBtn.setAttribute('aria-expanded', 'true');
    document.documentElement.style.overflow = 'hidden';
    var c = $('.side-close', side); if (c) setTimeout(function () { c.focus(); }, 50);
  }
  function closeMenu(focusBack) {
    if (!side.classList.contains('open')) return;
    side.classList.remove('open'); backdrop.hidden = true;
    menuBtn.setAttribute('aria-expanded', 'false');
    document.documentElement.style.overflow = '';
    if (focusBack) menuBtn.focus();
  }
  menuBtn.addEventListener('click', openMenu);
  backdrop.addEventListener('click', function () { closeMenu(true); });
  document.addEventListener('keydown', function (e) { if (e.key === 'Escape' && side.classList.contains('open')) closeMenu(true); });
  if (window.matchMedia) {
    var wide = window.matchMedia('(min-width: 1024px)');
    var onWide = function () { if (wide.matches) closeMenu(); };
    if (wide.addEventListener) wide.addEventListener('change', onWide); else if (wide.addListener) wide.addListener(onWide);
  }
  side.addEventListener('click', function (e) {
    if (e.target.closest('[data-close]')) return closeMenu(true);
    if (e.target.closest('[data-logout]')) { closeMenu(); return confirmLogout(); }
    if (e.target.closest('a')) closeMenu();
  });
  function showSide(on) { side.hidden = !on; layout.classList.toggle('has-side', on); menuBtn.hidden = !on; if (!on) closeMenu(); }
  function confirmLogout() {
    ask({ title: '로그아웃할까요?', text: '다음에 들어올 때 이메일과 비밀번호를 다시 넣어야 해요.', cancel: '그대로 두기', ok: '로그아웃' }).then(function (ok) {
      if (ok) DB.signOut().then(function () { viewLogin(); });
    });
  }

  function frame(title, showBack, active, isHome) {
    topbar.hidden = false;
    titleEl.textContent = title;
    backBtn.hidden = !showBack;
    var hl = document.getElementById('home-link'); if (hl) hl.hidden = active === 'home';   // 오른쪽 위 '홈'(대시보드) — 첫 화면에서는 숨김
    state.active = active || '';
    state.backTo = SECTION[active] ? '#/' + active : '#/';
    showSide(true);
    renderSide(state.active);
    // 다른 화면에서 바로 들어왔거나 새로고침했을 때도 왼쪽 메뉴 숫자 채우기
    if (!isHome && !state.counts && !state.countsLoading) {
      state.countsLoading = true;
      Promise.all([DB.listWorks({ all: true }), DB.listReviews({ all: true }), soft(DB.listInquiries), soft(DB.listEstimates), soft(DB.listContracts), soft(DB.listDefects)])
        .then(function (r) {
          if (!state.counts) state.counts = countsOf(r[0], r[1], r[2], r[3], r[4], r[5]);
          renderSide(state.active);
        }).catch(function () {}).then(function () { state.countsLoading = false; });
    }
    window.scrollTo(0, 0);
  }

  // 표가 아직 없거나(설정 SQL 실행 전) 실패해도 빈 목록으로
  function soft(fn) { return fn ? fn.call(DB).catch(function () { return []; }) : Promise.resolve([]); }
  // 상담 신청 상태: new 새 상담 · done 상담 완료 · dropped 상담 포기
  var INQ_ST = { new: '새 상담', done: '상담 완료', dropped: '상담 포기' };
  function isNewInq(q) { return q.status !== 'done' && q.status !== 'dropped'; }
  function countsOf(works, reviews, inq, est, ctr, defects) {
    return { works: works.length, reviews: reviews.length, inq: inq.filter(isNewInq).length, est: est.length,
      ctr: ctr.length, defect: defects.filter(function (d) { return d.status !== 'done'; }).length };
  }

  // 나가기 확인 창 문구: 사진을 고르는 화면(시공사례·후기·하자 기록)에서만 '고른 사진'까지 말함
  function leaveText() { return document.querySelector('#app input[type=file][accept^="image"]') ? '지금 나가면 입력한 내용과 고른 사진이 사라져요.' : '지금 나가면 입력한 내용이 사라져요.'; }
  function route() {
    navStamp();
    state.hash = location.hash || '#/';
    var parts = state.hash.replace(/^#\/?/, '').split('/');
    var v = parts[0] || '', id = parts[1] || '';
    setDirty(false);
    if (v === 'work') return viewWorkForm(id === 'new' ? null : decodeURIComponent(id));
    if (v === 'review') return viewReviewForm(id === 'new' ? null : decodeURIComponent(id));
    if (v === 'help') return viewHelp();
    if (v === 'settings') return parts[1] === 'contact' ? viewContact() : parts[1] === 'lists' ? viewListDefs() : parts[1] === 'calendar' && KIT.routes.calfeed ? KIT.routes.calfeed() : viewSettings();
    if (v === 'texts') return viewTexts();
    if (v === 'password') return viewPassword();
    if (v && KIT.routes[v]) return KIT.routes[v](parts.slice(1));
    if (SECTION[v]) { state.tab = v; return viewHome(); }
    if (v === 'done') return viewDone(parts[1], decodeURIComponent(parts[2] || ''), parts[3] === 'hidden');
    // 첫 화면 = 대시보드 (admin-dashboard.js)
    if (KIT.routes.dashboard) return KIT.routes.dashboard();
    state.tab = state.tab || 'works';
    return viewHome();
  }

  /* ---------- 앱 안 브라우저 (카톡·네이버 등) ----------
     2026-10-29 제보: 카톡 안에서 이메일 칸에 한 글자 칠 때마다 키보드가 내려가고 화면이 오르내림.
     앱 안에서는 이메일 전용 키보드(inputmode)를 쓰지 않고, 기본 브라우저로 여는 단추를 보여 줌. */
  var UA = navigator.userAgent || '';
  var INAPP = /KAKAOTALK/i.test(UA) ? 'kakao' : /NAVER\(inapp|NAVER\//.test(UA) ? 'naver' : /; wv\)|Instagram|FBAN|FBAV|Line\/|DaumApps|BAND\//.test(UA) ? 'app' : '';
  function outsideLink() {
    var url = location.origin + location.pathname + location.search;   // '#…' 은 빼고 (intent 주소와 겹침)
    if (INAPP === 'kakao') return 'kakaotalk://web/openExternal?url=' + encodeURIComponent(url);
    if (/Android/i.test(UA)) return 'intent://' + url.replace(/^https?:\/\//, '') + '#Intent;scheme=https;package=com.android.chrome;S.browser_fallback_url=' + encodeURIComponent(url) + ';end';
    return '';
  }
  function inAppBox() {
    if (!INAPP) return '';
    var name = INAPP === 'kakao' ? '카카오톡' : INAPP === 'naver' ? '네이버 앱' : '다른 앱';
    var href = outsideLink();
    return '<div class="inapp-box"><p><b>' + name + ' 안에서 열려 있어요.</b> 여기서는 글자 입력이나 로그인 유지가 잘 안 될 수 있어요.</p>' +
      (href ? '<a class="btn btn-outline btn-sm" href="' + esc(href) + '">' + (INAPP === 'kakao' ? '기본 브라우저로 열기' : '크롬으로 열기') + '</a>'
        : '<p>메뉴(⋯)에서 <b>다른 브라우저로 열기</b>를 눌러 주세요.</p>') + '</div>';
  }

  /* ---------- 로그인 ---------- */
  function viewLogin(msg, keepEmail) {
    topbar.hidden = true;
    showSide(false);
    var last = keepEmail != null ? keepEmail : (store('admin-email') || '');
    app.innerHTML = '<div class="login"><div class="login-card">' +
      '<div class="login-brand"><div class="brand">' + ((window.SITE_LOGO && window.SITE_LOGO.stacked) || I.lock) + '</div></div>' +
      '<div class="login-main">' +
      '<h2>관리화면</h2>' + inAppBox() +
      (msg ? '<div class="error-msg">' + esc(msg) + '</div>' : '') +
      '<form id="login-form" novalidate>' +
      '<div class="field"><label for="email">이메일</label><input class="input" id="email" type="text"' + (INAPP ? '' : ' inputmode="email"') + ' autocomplete="username" autocapitalize="none" autocorrect="off" spellcheck="false" value="' + esc(last) + '" required></div>' +
      '<div class="field"><label for="pw">비밀번호</label><div class="pw-wrap"><input class="input" id="pw" type="password" autocomplete="current-password" required><button type="button" id="pw-toggle">보기</button></div></div>' +
      '<button class="btn btn-primary" type="submit">들어가기</button>' +
      (DB.live ? '' : '<p class="hint" style="text-align:center;margin-top:16px">데모 화면이라 아무 값이나 넣고 눌러도 들어가져요.</p>') +
      '</form>' +
      '</div></div></div>';
    if (msg) setTimeout(function () { var f = last ? $('#pw') : $('#email'); if (f) f.focus(); }, 50);
    $('#pw-toggle').addEventListener('click', function () {
      var pw = $('#pw'); var show = pw.type === 'password';
      pw.type = show ? 'text' : 'password'; this.textContent = show ? '숨기기' : '보기';
    });
    $('#login-form').addEventListener('submit', function (e) {
      e.preventDefault();
      var email = $('#email').value.trim(), pw = $('#pw').value;
      if (DB.live && (!email || !pw)) return viewLogin('이메일과 비밀번호를 모두 넣어 주세요.', email);
      var btn = $('button[type=submit]', this);
      btn.disabled = true; btn.textContent = '확인하는 중…';
      DB.signIn(email, pw).then(function () {
        store('admin-email', email);
        loadListDefs().then(route, route);
      }).catch(function (err) { viewLogin(err.message, email); });
    });
  }

  /* ---------- 첫 화면 ---------- */
  function fmtWhen(iso) {
    if (!iso) return '';
    var d = new Date(iso), h = d.getHours(), m = String(d.getMinutes()).padStart(2, '0');
    var day = '일월화수목금토'.charAt(d.getDay());
    return (d.getMonth() + 1) + '월 ' + d.getDate() + '일 (' + day + ') ' + (h < 12 ? '오전 ' : '오후 ') + ((h % 12) || 12) + ':' + m;
  }
  // 손님 이름 가리기 — 홈페이지 고객 후기에만 씀 ('김철수' → '김○○', 이미 ○가 있으면 그대로)
  function maskName(n) {
    var t = String(n || '').replace(/\s*고객님$/, '').trim();
    if (!t || /[○*]/.test(t)) return t;
    var two = /^(남궁|황보|제갈|선우|독고|동방|사공|서문|어금|망절|장곡)/.exec(t);   // 두 글자 성
    return (two && Array.from(t).length > 2 ? two[1] : Array.from(t)[0]) + '○○';
  }
  function telHref(p) { return 'tel:' + String(p || '').replace(/[^0-9+]/g, ''); }
  function copyText(t) {
    function legacy() {
      var ta = document.createElement('textarea');
      ta.value = t; ta.setAttribute('readonly', ''); ta.style.position = 'fixed'; ta.style.opacity = '0';
      document.body.appendChild(ta); ta.select();
      var ok = false; try { ok = document.execCommand('copy'); } catch (e) {}
      ta.remove(); return ok;
    }
    if (navigator.clipboard && navigator.clipboard.writeText) {
      return navigator.clipboard.writeText(t).then(function () { return true; }, function () { return legacy(); });
    }
    return Promise.resolve(legacy());
  }

  // 상담 신청 · 시공사례 · 고객 후기 목록 (#/inquiries · #/works · #/reviews)
  function viewHome() {
    if (!SECTION[state.tab]) state.tab = 'works';
    frame(SECTION[state.tab], false, state.tab, true);
    app.innerHTML = '<div class="page"><div class="loading">불러오는 중…</div></div>';
    Promise.all([DB.listWorks({ all: true }), DB.listReviews({ all: true }), soft(DB.listInquiries),
      DB.getSettings ? DB.getSettings().catch(function () { return {}; }) : Promise.resolve({}),
      soft(DB.listEstimates), soft(DB.listContracts), soft(DB.listDefects), soft(DB.listCustomers)]).then(function (r) {
      var works = r[0], reviews = r[1], inquiries = r[2], settings = r[3] || {}, estimates = r[4] || [], contracts = r[5] || [], defects = r[6] || [];
      var custByDigits = {}; (r[7] || []).forEach(function (c) { var d = String(c.phone || '').replace(/[^0-9]/g, ''); if (d) custByDigits[d] = c; });   // 상담 카드: 이미 고객으로 있는지
      var estByInq = {};
      // 이 상담에서 만든 견적서 (여러 개면 금액이 적힌 것, 그중 최근 것)
      estimates.forEach(function (e) { var o = e.inquiry_id && estByInq[e.inquiry_id]; if (e.inquiry_id && (!o || (!(+o.total > 0) && +e.total > 0))) estByInq[e.inquiry_id] = e; });
      var inqOn = settings.inquiry_enabled !== false;
      var shows = { 's-inq': inqOn, 's-tel': settings.phone_enabled !== false, 's-kakao': settings.kakao_enabled !== false };
      function newCount() { return inquiries.filter(isNewInq).length; }
      var page = document.createElement('div');
      page.className = 'page';
      // 찾기 막대(이름·지역·날짜·상태) + 시공사례·후기는 전체 보기(표)
      var fkey = state.tab === 'works' ? 'workF' : state.tab === 'reviews' ? 'revF' : 'inqF';
      function wSt(w) { var a = [w.published ? 'pub' : 'hid']; if (w.featured) a.push('main'); if (w.blog_url) a.push('blog'); return a; }
      function cnt(list, fn, v) { return list.filter(function (x) { return [].concat(fn(x)).indexOf(v) >= 0; }).length; }
      function qRec(q) { return { text: [q.name, q.region, q.site_name, q.size, (q.scopes || []).join(' '), q.message].join(' '), phone: q.phone, region: regionOf(q.region), date: ymd(new Date(q.created_at)), status: INQ_ST[q.status] ? q.status : 'new' }; }
      function wRec(w) { return { text: [w.title, w.place, w.size, w.building, (w.scopes || []).join(' '), w.period, w.body].join(' '), region: regionOf(w.place), date: ymd(new Date(w.created_at)), status: wSt(w) }; }
      // 후기의 지역 = 고른 시공사례의 지역 (시공사례를 고르지 않았거나 그 시공사례에 지역이 없으면 '지역 없음')
      var workById = {}; works.forEach(function (w) { workById[w.id] = w; });
      function rRec(rv) {
        var w = rv.work_id && workById[rv.work_id];
        return { text: [rv.author, rv.place, rv.body, w ? w.title : '', w ? w.place : ''].join(' '), region: w ? wRec(w).region : '', date: ymd(new Date(rv.created_at)), status: rv.published ? 'pub' : 'hid' };
      }
      var fopt = state.tab === 'inquiries'
        ? { ph: '이름·전화번호·아파트', dateLabel: '신청일', regions: inquiries.map(function (q) { return qRec(q).region; }), def: ['new'],
          statuses: ['new', 'done', 'dropped'].map(function (k) { return [k, INQ_ST[k], cnt(inquiries, function (q) { return qRec(q).status; }, k)]; }) }
        : state.tab === 'works'
          ? { ph: '제목·아파트 이름·공사 내용', dateLabel: '올린 날', regions: works.map(function (w) { return wRec(w).region; }),
            statuses: [['pub', '공개 중', cnt(works, wSt, 'pub')], ['hid', '숨김', cnt(works, wSt, 'hid')], ['main', '메인에 크게', cnt(works, wSt, 'main')], ['blog', '블로그 연결', cnt(works, wSt, 'blog')]] }
          : { ph: '고객 이름·현장·후기 내용', dateLabel: '올린 날', regions: reviews.map(function (r) { return rRec(r).region; }),
            statuses: [['pub', '공개 중', cnt(reviews, function (r) { return rRec(r).status; }, 'pub')], ['hid', '숨김', cnt(reviews, function (r) { return rRec(r).status; }, 'hid')]] };
      var listLen = state.tab === 'inquiries' ? inquiries.length : state.tab === 'works' ? works.length : reviews.length;
      page.innerHTML =
        '<div class="sec-head list-head" id="sec-head"><div class="sec-title" id="sec-title"></div>' +
        (state.tab !== 'inquiries' ? '<div class="sec-btns" id="sec-btns">' + (state.tab === 'works' ? '<a class="btn btn-primary" href="#/work/new">' + I.plus + '시공사례 올리기</a>'
          : '<a class="btn btn-primary" href="#/review/new">' + I.plus + '후기 올리기</a>') + '</div>' : '') + '</div>' +
        (listLen ? filterHtml(fkey, fopt) : '') +
        (state.tab !== 'inquiries' && listLen ? listTools('home-n', fkey) : '') +
        '<div class="items" id="items"></div>';
      app.innerHTML = '';
      app.appendChild(page);

      function drawTabs() {
        var n = newCount();
        // 메뉴 숫자 · 목록 머리
        state.counts = countsOf(works, reviews, inquiries, estimates, contracts, defects);
        renderSide(state.tab);
        titleEl.textContent = SECTION[state.tab];
        var hidden = function (list) { var h = list.filter(function (x) { return !x.published; }).length; return h ? ' · 숨김 ' + h + '건' : ''; };
        var head = state.tab === 'inquiries'
          ? '<p><span class="only-wide">홈페이지 상담 신청서로 들어온 상담이에요. </span>새 상담 <b>' + n + '건</b> · 전체 ' + inquiries.length + '건</p>'
          : '';   // 시공사례·후기 개수는 목록 바로 위 줄('총 n건 · 숨김 n건')에 — 견적서·계약서 목록과 같은 자리
        $('#sec-title', page).innerHTML = head;
        // 상태 칸 옆 숫자 새로 (상담 완료·숨기기를 바꾼 뒤)
        $$('[data-fst]', page).forEach(function (b) {
          var v = b.getAttribute('data-fst'), em = $('em', b.closest('label') || b); if (!em) return;
          em.textContent = state.tab === 'inquiries' ? cnt(inquiries, function (q) { return qRec(q).status; }, v) : state.tab === 'works' ? cnt(works, wSt, v) : cnt(reviews, function (r) { return rRec(r).status; }, v);
        });
        state.backTo = '#/' + state.tab;
      }

      function inquiryCard(q) {
        var st = INQ_ST[q.status] ? q.status : 'new', done = st !== 'new';
        var rows = [
          ['공간', [q.space_type, q.build_type].filter(Boolean).join(' · ')],
          ['지역', q.region],
          ['현장', [q.site_name, q.size].filter(Boolean).join(' · ')],
          ['품목', (q.scopes || []).join(', ')],
          ['예산', q.budget],
          ['시공일', DB.fmtPlan ? DB.fmtPlan(q.planned_date, q.planned_undecided) : ''],
          ['상담', q.method],
          ['상담일', DB.fmtPref ? DB.fmtPref(q.preferred_date, q.preferred_time) : ''],
          ['견적', estByInq[q.id] ? (+estByInq[q.id].total > 0 ? Number(estByInq[q.id].total).toLocaleString('ko-KR') + '원' : '작성 중 (금액 아직 없음)') : ''],
          ['메모', q.message],
        ].filter(function (x) { return x[1]; });
        var cuB = custByDigits[String(q.phone || '').replace(/[^0-9]/g, '')], bl = cuB && cuB.blacklist ? cuB : null;
        return '<div class="item inq' + (done ? ' inq-done' : ' inq-new') + (st === 'dropped' ? ' inq-drop' : '') + (bl ? ' inq-bl' : '') + '">' +
          '<div class="inq-head"><span class="pill ' + (st === 'new' ? 'new' : st === 'dropped' ? 'drop' : 'off') + '">' + INQ_ST[st] + '</span><span class="inq-when">' + esc(fmtWhen(q.created_at)) + '</span>' +
          '<button class="inq-del" type="button" data-qdel="' + esc(q.id) + '" aria-label="이 상담 신청 지우기">' + I.trash + '<span>지우기</span></button></div>' +
          '<div class="inq-name">' + esc(q.name) + '<span>' + esc(q.phone) + '</span></div>' +
          (bl ? blacklistBanner(bl, '블랙리스트 고객과 같은 연락처예요') : '') +
          '<dl class="inq-info">' + rows.map(function (x) { return '<div><dt>' + x[0] + '</dt><dd>' + esc(x[1]) + '</dd></div>'; }).join('') + '</dl>' +
          '<div class="item-actions' + (st === 'dropped' ? '' : ' three') + '">' +
          '<a class="btn btn-primary only-phone" href="' + telHref(q.phone) + '">전화 걸기</a>' +
          '<button class="btn btn-primary only-pc" type="button" data-qcopy="' + esc(q.phone) + '">번호 복사</button>' +
          '<button class="btn btn-outline" type="button" data-qdone="' + esc(q.id) + '">' + (done ? '상담 미완료로' : '상담 완료') + '</button>' +
          (st === 'dropped' ? '' : '<button class="btn btn-outline btn-drop" type="button" data-qdrop="' + esc(q.id) + '">상담 포기</button>') +
          '</div>' +
          // 둘째 줄: 일정 등록(희망 상담일·시간·장소가 채워진 일정 추가 창) · 고객 등록(이미 있으면 고객 정보) · 견적(없으면 견적 내기, 있으면 견적서 열기 — 색을 달리)
          (function () {
            var cu = custByDigits[String(q.phone || '').replace(/[^0-9]/g, '')], es = estByInq[q.id];
            return '<div class="inq-links"><a class="inq-link" href="#/calendar/' + esc(q.preferred_date || ymd()) + '/q/' + encodeURIComponent(q.id) + '">' + I.cal + '<span>일정 등록</span></a>' +
              (cu ? '<a class="inq-link" href="#/customer/' + encodeURIComponent(cu.id) + '">' + I.users + '<span>고객 정보</span></a>'
                : '<button type="button" class="inq-link" data-qcust="' + esc(q.id) + '">' + I.users + '<span>고객 등록</span></button>') +
              // 견적: 없음 → 견적 내기 / 저장만 하고 금액이 0원(공사 항목 없음) → 견적 이어 쓰기 / 금액 있음 → 견적서 열기
              (es && +es.total > 0 ? '<a class="inq-link est-open" href="#/estimate/' + encodeURIComponent(es.id) + '">' + I.doc + '<span>견적서 열기</span></a>'
                : es ? '<a class="inq-link est-new" href="#/estimate/' + encodeURIComponent(es.id) + '">' + I.doc + '<span>견적 이어 쓰기</span></a>'
                : '<a class="inq-link est-new" href="#/estimate/new/q/' + encodeURIComponent(q.id) + '">' + I.doc + '<span>견적 내기</span></a>') + '</div>';
          })() +
          '</div>';
      }


      function drawItems() {
        var box = $('#items', page);
        box.className = 'items tab-' + state.tab;
        if (state.tab === 'inquiries') {
          var hidden = SHOW_SW.filter(function (sw) { return !shows[sw.id]; }).map(function (sw) { return sw.short; });
          box.innerHTML = (hidden.length
            ? '<a class="pw-alert ch-alert" href="#/settings/contact"><span>홈페이지에서 숨겨 둔 연락 방법이 있어요.<br><b>' + esc(hidden.join(' · ')) + '</b></span><span class="go">상담 경로</span></a>' : '') +
            (function () {
              // 처음에는 '새 상담'만 골라져 있음 — 상태 칸에서 '상담 완료'도 누르면 같이 보임
              var shown = inquiries.filter(function (q) { return filterMatch('inqF', qRec(q)); });
              if (shown.length) return shown.map(inquiryCard).join('');
              if (inquiries.length) return '<div class="empty-box">' + (filterActive('inqF') ? '조건에 맞는 상담 신청이 없어요.' : '새 상담 신청이 없어요.<br>상담을 마친 신청은 위 상태에서 <b>상담 완료</b>를 누르면 보여요.') + '</div>';
              return '<div class="empty-box">아직 들어온 상담 신청이 없어요.<br>손님이 홈페이지에서 상담 신청서를 보내면 여기에 쌓여요.</div>';
            })();
        } else if (state.tab === 'works') {
          var wl = works.filter(function (w) { return filterMatch('workF', wRec(w)); });
          homeCount(works, wl, 'workF');
          if (works.length && viewMode('workF') === 'table') {
            box.className = 'items tab-works is-table';
            box.innerHTML = wl.length ? dataTable('workF', [
              { label: '올린 날', sort: function (w) { return w.created_at || ''; }, html: function (w) { return esc(fmtDate(w.created_at)); } },
              { label: '공개', sort: function (w) { return w.published ? 0 : 1; }, html: function (w) { return '<span class="pill ' + (w.published ? 'on">공개' : 'off">숨김') + '</span>' + (w.featured ? '<span class="pill star">메인</span>' : ''); } },
              // 표로 볼 때도 SNS 글을 만들 수 있게 제목 아래 작은 단추 (카드의 'SNS 글'과 같음)
              { label: '제목', sort: function (w) { return w.title || ''; }, html: function (w) { return '<b>' + esc(w.title || '') + '</b>' + (window.AIPrompts ? '<button type="button" class="dt-sns" data-sns="' + esc(w.id) + '">' + I.spark + '<span>SNS 글</span></button>' : ''); }, cls: 'wide' },
              { label: '위치', sort: function (w) { return w.place || ''; }, html: function (w) { return esc(w.place || ''); } },
              { label: '평수', sort: function (w) { return parseFloat(w.size) || 0; }, html: function (w) { return esc(w.size || ''); }, cls: 'n' },
              { label: '사진', sort: function (w) { return (w.photos || []).length; }, html: function (w) { return (w.photos || []).length + '장'; }, cls: 'n' },
              { label: '블로그', html: function (w) { return w.blog_url ? '<span class="pill blog">연결</span>' : ''; } },
            ], wl, function (w) { return '#/work/' + encodeURIComponent(w.id); }, function (w) { return w.id; }) : '<div class="empty-box">조건에 맞는 시공사례가 없어요.</div>';
            if (bk) bk.refresh(); return;
          }
          if (works.length && !wl.length) { box.innerHTML = '<div class="empty-box">조건에 맞는 시공사례가 없어요.<br>위 <b>조건 모두 지우기</b>를 누르면 전체가 보여요.</div>'; return; }
          box.innerHTML = works.length ? wl.map(function (w) {
            var c = w.photos && w.photos[0];
            // 지우기는 오른쪽 위로 따로, 아래 줄은 [고치기] [숨기기]
            return '<div class="item has-del' + (w.published ? '' : ' hidden-item') + '">' +
              '<label class="bulk-pick"><input type="checkbox" data-bid="' + esc(w.id) + '" aria-label="' + esc(w.title) + ' 고르기"></label>' +
              '<button class="item-del" type="button" data-del="' + esc(w.id) + '" aria-label="이 시공사례 지우기">' + I.trash + '<span>지우기</span></button>' +
              '<div class="item-top"><div class="item-thumb">' + (c ? '<img src="' + esc(DB.photoUrl(c.thumb || c.full)) + '" alt="" loading="lazy">' : '') + '</div>' +
              '<div class="item-txt"><div class="item-title">' + esc(w.title) + '</div>' +
              '<div class="item-meta"><span>' + fmtDate(w.created_at) + '</span><span>사진 ' + (w.photos || []).length + '장</span>' +
              '<span class="pill ' + (w.published ? 'on">공개 중' : 'off">숨김') + '</span>' + (w.featured ? '<span class="pill star">메인</span>' : '') +
              (w.blog_url ? '<span class="pill blog">블로그</span>' : '') + '</div></div></div>' +
              '<div class="item-actions work-actions">' +
              '<a class="btn btn-outline" href="#/work/' + encodeURIComponent(w.id) + '">고치기</a>' +
              '<button class="btn btn-outline" type="button" data-toggle="' + esc(w.id) + '">' + (w.published ? '숨기기' : '보이기') + '</button>' +
              (window.AIPrompts ? '<button class="btn btn-outline btn-sns" type="button" data-sns="' + esc(w.id) + '">' + I.spark + '<span>SNS 글</span></button>' : '') +   // 예전 'SNS' 메뉴를 시공사례에 합침
              '</div></div>';
          }).join('') : '<div class="empty-box">아직 올린 시공사례가 없어요.<br>위의 <b>시공사례 올리기</b>를 눌러 시작해 보세요.</div>';
        } else {
          var rl = reviews.filter(function (rv) { return filterMatch('revF', rRec(rv)); });
          homeCount(reviews, rl, 'revF');
          if (reviews.length && viewMode('revF') === 'table') {
            box.className = 'items tab-reviews is-table';
            box.innerHTML = rl.length ? dataTable('revF', [
              { label: '올린 날', sort: function (r) { return r.created_at || ''; }, html: function (r) { return esc(fmtDate(r.created_at)); } },
              { label: '공개', sort: function (r) { return r.published ? 0 : 1; }, html: function (r) { return '<span class="pill ' + (r.published ? 'on">공개' : 'off">숨김') + '</span>'; } },
              { label: '고객', sort: function (r) { return r.author || ''; }, html: function (r) { return '<b>' + esc(r.author || '') + '</b>'; }, cls: 'stick' },
              { label: '현장', sort: function (r) { return r.place || ''; }, html: function (r) { return esc(r.place || ''); } },
              { label: '별점', sort: function (r) { return r.rating || 5; }, html: function (r) { return '★ ' + (r.rating || 5); }, cls: 'n' },
              { label: '후기', html: function (r) { return esc(String(r.body || '').slice(0, 60)) + (String(r.body || '').length > 60 ? '…' : ''); }, cls: 'wide' },
            ], rl, function (r) { return '#/review/' + encodeURIComponent(r.id); }, function (r) { return r.id; }) : '<div class="empty-box">조건에 맞는 후기가 없어요.</div>';
            if (bk) bk.refresh(); return;
          }
          if (reviews.length && !rl.length) { box.innerHTML = '<div class="empty-box">조건에 맞는 후기가 없어요.<br>위 <b>조건 모두 지우기</b>를 누르면 전체가 보여요.</div>'; return; }
          box.innerHTML = reviews.length ? rl.map(function (rv) {
            var c = rv.photos && rv.photos[0];
            return '<div class="item has-del' + (rv.published ? '' : ' hidden-item') + '">' +
              '<label class="bulk-pick"><input type="checkbox" data-bid="' + esc(rv.id) + '" aria-label="' + esc(rv.author) + ' 후기 고르기"></label>' +
              '<button class="item-del" type="button" data-del="' + esc(rv.id) + '" aria-label="이 후기 지우기">' + I.trash + '<span>지우기</span></button>' +
              '<div class="item-top">' + (c ? '<div class="item-thumb"><img src="' + esc(DB.photoUrl(c.thumb || c.full)) + '" alt="" loading="lazy"></div>' : '') +
              '<div class="item-txt"><div class="item-title">' + esc(rv.author) + ' 고객님 · ' + esc((rv.body || '').slice(0, 40)) + '</div>' +
              '<div class="item-meta"><span>' + fmtDate(rv.created_at) + '</span><span>별 ' + (rv.rating || 5) + '개</span>' +
              '<span class="pill ' + (rv.published ? 'on">공개 중' : 'off">숨김') + '</span></div></div></div>' +
              '<div class="item-actions two">' +
              '<a class="btn btn-outline" href="#/review/' + encodeURIComponent(rv.id) + '">고치기</a>' +
              '<button class="btn btn-outline" type="button" data-toggle="' + esc(rv.id) + '">' + (rv.published ? '숨기기' : '보이기') + '</button>' +
              '</div></div>';
          }).join('') : '<div class="empty-box">아직 올린 후기가 없어요.</div>';
        }
      }
      function redraw() { drawTabs(); drawItems(); if (bk) bk.refresh(); }
      // 시공사례·후기: 여러 개 골라 지우기 (사진까지 지워짐)
      var bk = state.tab !== 'inquiries' && listLen ? bulk({ page: page, host: $('.lt-btns', page), noun: state.tab === 'works' ? '시공사례' : '후기', warn: '사진도 같이 휴지통으로 가요. 잠깐 안 보이게만 하려면 <b>숨기기</b>를 쓰세요.',
        del: function (id) { return state.tab === 'works' ? DB.deleteWork(id) : DB.deleteReview(id); }, after: viewHome }) : null;
      redraw();
      if (listLen) filterBind(page, fkey, redraw);
      if (state.tab !== 'inquiries') dataTableBind(page, redraw);

      $('#items', page).addEventListener('click', function (e) {
        var qcu = e.target.closest('[data-qcust]');
        if (qcu) {
          var cq = inquiries.filter(function (z) { return z.id === qcu.getAttribute('data-qcust'); })[0];
          if (!cq || !DB.ensureCustomer) return;
          qcu.disabled = true;
          DB.ensureCustomer({ name: cq.name, phone: cq.phone, address: [cq.region, cq.site_name].filter(Boolean).join(' ') }).then(function (c) {
            if (!c) throw new Error('전화번호가 맞지 않아 고객으로 등록하지 못했어요.');
            state.counts = null; toast('고객으로 등록했어요 · ' + (c.name || cq.name));
            go('#/customer/' + encodeURIComponent(c.id));
          }).catch(function (err) { qcu.disabled = false; ask({ title: '고객으로 등록하지 못했어요', text: esc(friendlyError(err)), cancel: false, ok: '확인' }); });
          return;
        }
        var qc = e.target.closest('[data-qcopy]');
        if (qc) {
          var num = qc.getAttribute('data-qcopy');
          copyFlash(qc, num, '전화번호');
          return;
        }
        var sn = e.target.closest('[data-sns]');
        if (sn) { var sw = works.filter(function (x) { return x.id === sn.getAttribute('data-sns'); })[0]; if (sw) openSnsPick(sw); return; }
        var qd = e.target.closest('[data-qdone]') || e.target.closest('[data-qdrop]');
        var qx = e.target.closest('[data-qdel]');
        var t = e.target.closest('[data-toggle]');
        var d = e.target.closest('[data-del]');
        if (qd) {
          var qid2 = qd.getAttribute('data-qdone') || qd.getAttribute('data-qdrop');
          var q = inquiries.filter(function (x) { return x.id === qid2; })[0];
          if (!q) return;
          var next = qd.hasAttribute('data-qdrop') ? 'dropped' : isNewInq(q) ? 'done' : 'new';
          qd.disabled = true;
          DB.updateInquiry(q.id, { status: next }).then(function () {
            q.status = next; redraw();   // 안내 상자(토스트)는 띄우지 않음 (2026-10-25 대표님 요청)
          }).catch(function (err) {
            qd.disabled = false;
            var msg = friendlyError(err);
            if (next === 'dropped' && /check|constraint|status/i.test(String((err && err.message) || ''))) msg = '데이터베이스에 \'상담 포기\' 상태가 아직 없어요. Supabase에서 최신 schema.sql 을 한 번 더 실행해 주세요.';
            ask({ title: '바꾸지 못했어요', text: esc(msg), cancel: false, ok: '확인' });
          });
          return;
        }
        if (qx) {
          var qid = qx.getAttribute('data-qdel');
          ask({ title: '이 상담 신청을 지울까요?', text: '휴지통에 <b>30일</b> 동안 보관돼서 그동안은 <b>설정 → 휴지통</b>에서 되살릴 수 있어요. 연락을 마쳤다면 지우지 않고 <b>상담 완료</b>로 두셔도 돼요.', cancel: '그만두기', ok: '지우기', okClass: 'btn-danger' })
            .then(function (ok) {
              if (!ok) return;
              DB.deleteInquiry(qid).then(function () {
                inquiries = inquiries.filter(function (x) { return x.id !== qid; }); redraw(); toast('휴지통으로 옮겼어요');
              }).catch(function (err) { ask({ title: '지우지 못했어요', text: esc(friendlyError(err)), cancel: false, ok: '확인' }); });
            });
          return;
        }
        var isWork = state.tab === 'works';
        var list = isWork ? works : reviews;
        if (t) {
          var rec = list.filter(function (x) { return x.id === t.getAttribute('data-toggle'); })[0];
          if (!rec) return;
          rec.published = !rec.published;
          t.disabled = true;
          (isWork ? DB.saveWork(rec) : DB.saveReview(rec)).then(function () {
            toast(rec.published ? '다시 보이게 했어요' : '숨겼어요 — 홈페이지에서 안 보여요');
            redraw();
          }).catch(function (err) { rec.published = !rec.published; t.disabled = false; ask({ title: '바꾸지 못했어요', text: esc(friendlyError(err)), cancel: false, ok: '확인' }); });
        }
        if (d) {
          var id = d.getAttribute('data-del');
          ask({
            title: isWork ? '이 시공사례를 지울까요?' : '이 후기를 지울까요?',
            text: '사진까지 같이 휴지통으로 옮겨져 <b>30일</b> 동안 보관돼서 그동안은 <b>설정 → 휴지통</b>에서 되살릴 수 있어요.<br>잠깐 안 보이게만 하려면 <b>숨기기</b>를 누르세요.',
            cancel: '그만두기', ok: '지우기', okClass: 'btn-danger',
          }).then(function (ok) {
            if (!ok) return;
            (isWork ? DB.deleteWork(id) : DB.deleteReview(id)).then(function () {
              if (isWork) works = works.filter(function (x) { return x.id !== id; });
              else reviews = reviews.filter(function (x) { return x.id !== id; });
              redraw();
              toast('휴지통으로 옮겼어요');
            }).catch(function (err) { ask({ title: '지우지 못했어요', text: esc(friendlyError(err)), cancel: false, ok: '확인' }); });
          });
        }
      });
    }).catch(function (err) {
      app.innerHTML = '<div class="page"><div class="error-msg">' + esc(friendlyError(err)) + '</div><button class="btn btn-primary" type="button" data-reload>다시 불러오기</button></div>';
    });
  }

  /* ---------- 사진 고르기 (시공사례·후기 공용) ---------- */
  // o = { private: 하자 사진처럼 비공개 저장소에, urls: { 경로: 보기 주소 } (비공개 사진), noCover: '대표 사진' 표시 없이, zoom: 누르면 크게 }
  function PhotoPicker(box, existing, max, onChange, o) {
    o = o || {};
    var items = (existing || []).map(function (p) { return { key: Math.random().toString(36).slice(2), existing: p, preview: (o.urls && (o.urls[p.thumb] || o.urls[p.full])) || DB.photoUrl(p.thumb || p.full), status: 'ready' }; });
    var removed = [];
    var queue = Promise.resolve();

    function render() {
      var ready = items.length;
      box.innerHTML =
        (items.length ? '<div class="photos">' + items.map(function (it, i) {
          var cover = i === 0 && !o.noCover;
          return '<div class="ph' + (cover ? ' cover' : '') + '" data-k="' + it.key + '">' +
            '<div class="img">' + (it.preview ? '<img src="' + esc(it.preview) + '" alt="사진 ' + (i + 1) + '"' + (o.zoom ? ' data-zoom role="button" tabindex="0"' : '') + '>' : '') +
            '<span class="badge">' + (cover ? '대표 사진' : (i + 1)) + '</span>' +
            (it.status === 'processing' ? '<div class="state"><div><div class="spinner"></div>사진 줄이는 중</div></div>' : '') +
            (it.status === 'error' ? '<div class="state err">' + esc(it.err || '열 수 없는 사진') + '</div>' : '') +
            '</div><div class="tools">' +
            '<button type="button" data-a="left" aria-label="앞으로 옮기기"' + (i === 0 ? ' disabled' : '') + '>' + I.left + '</button>' +
            '<button type="button" class="del" data-a="del" aria-label="이 사진 빼기">' + I.trash + '</button>' +
            '<button type="button" data-a="right" aria-label="뒤로 옮기기"' + (i === items.length - 1 ? ' disabled' : '') + '>' + I.right + '</button>' +
            '</div></div>';
        }).join('') + '</div>' : '') +
        (ready < max ? '<label class="pick' + (items.length ? ' compact' : '') + '">' + I.plus +
          '<span><b>' + (items.length ? '사진 더 넣기' : '사진 고르기') + '</b>' +
          (items.length ? '<small class="only-mouse"> · 사진 파일을 여기로 끌어다 놓아도 돼요</small>'
            : '<br><small>여러 장을 한 번에 골라도 돼요<span class="only-mouse"> · 사진 파일을 여기로 끌어다 놓아도 돼요</span></small>') + '</span>' +
          '<input type="file" accept="image/*" multiple aria-label="사진 고르기"></label>' : '<p class="hint">사진은 ' + max + '장까지 넣을 수 있어요.</p>');
      var inp = $('input[type=file]', box);
      if (inp) inp.addEventListener('change', function () { add(Array.prototype.slice.call(inp.files)); });
      onChange && onChange();
    }

    function add(files) {
      var room = max - items.length;
      if (files.length > room) notice('사진은 ' + max + '장까지만 넣을 수 있어요', '그래서 ' + room + '장만 넣었어요.');
      files.slice(0, Math.max(0, room)).forEach(function (f) {
        var it = { key: Math.random().toString(36).slice(2), status: 'processing' };
        items.push(it);
        queue = queue.then(function () {
          return IT.prepare(f).then(function (p) {
            it.prep = p; it.preview = URL.createObjectURL(p.thumb); it.status = 'ready';
          }).catch(function (e) { it.status = 'error'; it.err = e.message; })
            .then(render);
        });
      });
      render();
    }

    // PC: 폴더에서 사진 파일을 끌어다 놓기
    function hasFiles(e) { return e.dataTransfer && Array.prototype.indexOf.call(e.dataTransfer.types || [], 'Files') >= 0; }
    box.addEventListener('dragover', function (e) {
      if (!hasFiles(e)) return;
      e.preventDefault(); e.dataTransfer.dropEffect = 'copy'; box.classList.add('drop-on');
    });
    box.addEventListener('dragleave', function (e) { if (!e.relatedTarget || !box.contains(e.relatedTarget)) box.classList.remove('drop-on'); });
    box.addEventListener('drop', function (e) {
      if (!hasFiles(e)) return;
      e.preventDefault(); e.stopPropagation(); box.classList.remove('drop-on');
      var files = Array.prototype.filter.call(e.dataTransfer.files, function (f) { return /^image\//.test(f.type) || /\.(heic|heif)$/i.test(f.name); });
      if (!files.length) return notice('사진 파일만 넣을 수 있어요');
      if (items.length >= max) return notice('사진은 ' + max + '장까지만 넣을 수 있어요');
      add(files);
    });

    box.addEventListener('click', function (e) {
      var zi = o.zoom && e.target.closest('img[data-zoom]');
      if (zi) {
        var zk = zi.closest('.ph').getAttribute('data-k'), zit = items.filter(function (x) { return x.key === zk; })[0];
        var big = zit && zit.existing ? ((o.urls && o.urls[zit.existing.full]) || DB.photoUrl(zit.existing.full)) : (zit && zit.prep ? URL.createObjectURL(zit.prep.full) : zi.src);
        ask({ title: '사진 보기', text: '<img class="zoom-img" src="' + esc(big || zi.src) + '" alt="">', cancel: false, ok: '닫기' });
        return;
      }
      var b = e.target.closest('button[data-a]');
      if (!b) return;
      var k = b.closest('.ph').getAttribute('data-k');
      var i = items.findIndex(function (x) { return x.key === k; });
      if (i < 0) return;
      var a = b.getAttribute('data-a');
      if (a === 'left' && i > 0) { var t = items[i - 1]; items[i - 1] = items[i]; items[i] = t; }
      if (a === 'right' && i < items.length - 1) { var t2 = items[i + 1]; items[i + 1] = items[i]; items[i] = t2; }
      if (a === 'del') {
        var it = items[i];
        if (it.status === 'processing') return notice('사진을 줄이는 중이에요', '잠시 뒤에 빼 주세요.');
        if (it.existing) { removed.push(it.existing.full); if (it.existing.thumb) removed.push(it.existing.thumb); }
        items.splice(i, 1);
        toast('사진을 뺐어요');
      }
      render();
    });

    render();
    return {
      items: function () { return items; },
      busy: function () { return items.some(function (x) { return x.status === 'processing'; }); },
      goodCount: function () { return items.filter(function (x) { return x.status === 'ready'; }).length; },
      removed: function () { return removed.filter(function (p) { return !/^demo\//.test(p); }); },
      /** 새 사진을 올리고, 최종 순서대로 사진 목록을 돌려줌 */
      upload: function (folder, prog) {
        var todo = items.filter(function (x) { return x.status === 'ready' && !x.existing && !x.uploaded; });
        var n = 0, total = todo.length;
        var chain = Promise.resolve();
        if (total) prog.set(0, total, '사진 올리는 중 0 / ' + total);
        todo.forEach(function (it) {
          chain = chain.then(function () {
            return DB.uploadPhoto(folder, it.prep, o.private ? { private: true } : undefined).then(function (r) {
              it.uploaded = r; n++;
              prog.set(n, total, '사진 올리는 중 ' + n + ' / ' + total);
            });
          });
        });
        return chain.then(function () {
          return items.filter(function (x) { return x.status === 'ready'; }).map(function (x) { return x.existing || x.uploaded; });
        });
      },
    };
  }

  function choiceGroup(name, options, selected, multi) {
    // 목록이 바뀌어도 이미 골라 둔 옛 이름(예: 전체 리모델링)은 그대로 보이게
    if (multi) options = options.concat((selected || []).filter(function (o) { return options.indexOf(o) < 0; }));
    else if (selected && options.indexOf(selected) < 0) options = options.concat([selected]);
    return '<div class="choices">' + options.map(function (o) {
      var on = multi ? (selected || []).indexOf(o) >= 0 : selected === o;
      return '<label class="choice"><input type="' + (multi ? 'checkbox' : 'radio') + '" name="' + name + '" value="' + esc(o) + '"' + (on ? ' checked' : '') + '><span>' + esc(o) + '</span></label>';
    }).join('') + '</div>';
  }
  function switchRow(id, title, desc, on) {
    return '<label class="switch-row"><input type="checkbox" id="' + id + '"' + (on ? ' checked' : '') + '><span class="txt"><b>' + title + '</b><small>' + desc + '</small></span><span class="switch" aria-hidden="true"></span></label>';
  }

  /* ---------- 계약서·고객에서 불러오기 (시공사례·고객 후기 화면 위쪽) ----------
     홈페이지에 공개되는 글이라 전화번호·동/호수는 넣지 않음. 후기 성함은 저장할 때 성만 남김(김○○).
     공사 내용·건물 종류·같은 현장 시공사례는 글자를 보고 짐작해서 채우므로, 넣은 뒤 확인하도록 알려 줌 */
  var SCOPE_KW = { '토탈인테리어': ['토탈', '전체 리모델링', '전체리모델링', '올수리'], '확장공사': ['확장'], '샤시': ['샤시', '새시', '창호'], '목공공사': ['목공'],
    '몰딩': ['몰딩'], '우물등박스': ['우물'], '타일': ['타일'], '대리석공사': ['대리석'], '필름': ['필름'], '도배': ['도배', '벽지'], '마루': ['마루'], '장판': ['장판'],
    '중문': ['중문'], '붙박이장': ['붙박이'], '드레스룸 행거': ['드레스룸', '행거'], '창고문': ['창고문'], '조명': ['조명', '전등'], '줄눈시공': ['줄눈'],
    '세라믹탄성': ['탄성'], '커튼': ['커튼'], '콤비 블라인드': ['블라인드'], '입주청소': ['청소'], '주방': ['주방', '싱크'], '욕실': ['욕실', '화장실'] };
  // '○○아파트 101동 1203호' → '○○아파트' (동 번호·호수·층·번지·건물 번호는 뺌)
  function publicPlace(str) {
    return String(str || '').split(/\s+/).filter(function (t) {
      return t && !/^(제)?[A-Za-z]?\d+([-~]\d+)*(동|호|호실|층|번지|번)?$/.test(t) && !/^[A-Za-z]동$/.test(t) && !/^(지하|B)\d+층?$/i.test(t);
    }).join(' ').replace(/[,·]\s*$/, '').trim();
  }
  function sizeFrom(list) {
    for (var i = 0; i < list.length; i++) { var m = /(\d+(?:\.\d+)?)\s*평/.exec(String(list[i] || '')); if (m) return m[1]; if (/^\d+(\.\d+)?$/.test(String(list[i] || '').trim())) return String(list[i]).trim(); }
    return '';
  }
  function buildingFrom(text) {
    if (/아파트|APT/i.test(text)) return '아파트';
    if (/빌라|주택|단독|다세대|연립|타운하우스/.test(text)) return '주택·빌라';
    if (/상가|사무실|오피스|점포|매장|학원|병원|카페|식당|공장/.test(text)) return '상가·사무실';
    return '';
  }
  function scopesFrom(text) {
    var t = String(text || '').replace(/\s+/g, '');
    return (C.workScopes || []).filter(function (sc) { return (SCOPE_KW[sc] || [sc]).some(function (k) { return t.indexOf(k.replace(/\s+/g, '')) >= 0; }); });
  }
  // 견적서 공사 항목·계약서 공정 이름 중 '공사 내용' 목록에 없는 것 → 시공사례 공사 내용에 새로 만들어 고름 (예: 전기, 설비, 철거)
  // 비용·관리 항목(기타·부대비용·공과잡비 등)은 빼고, '철거'와 '철거·폐기물'처럼 겹치면 짧은 쪽만
  function extraScopes(names) {
    var SKIP = /^(기타|부대|공과|잡비|경비|현장\s*관리|관리비|운반|보양|설계|디자인|할인|부가세)/, nk = function (n) { return n.replace(/[\s·\/,.]/g, ''); };
    var out = [];
    names.forEach(function (n) {
      n = String(n || '').trim().replace(/\s+/g, ' ');
      if (!n || n.length > 12 || SKIP.test(n) || scopesFrom(n).length) return;
      if (out.some(function (o) { return nk(o) === nk(n); })) return;
      out.push(n);
    });
    return out.filter(function (n) { return !out.some(function (o) { return nk(o) !== nk(n) && nk(n).indexOf(nk(o)) >= 0; }); });
  }
  function catNames(cats) { return (Array.isArray(cats) ? cats : []).map(function (c) { return c && (c.name || c.title) || ''; }); }
  function catText(cats) {   // 견적서 공사 항목 이름들
    var out = [];
    (Array.isArray(cats) ? cats : []).forEach(function (c) { if (!c) return; out.push(c.name || c.title || ''); (c.items || c.rows || []).forEach(function (it) { if (it) out.push(it.name || it.title || ''); }); });
    return out.join(' ');
  }
  function periodText(a, b) {
    var x = /^(\d{4})-(\d{2})-(\d{2})$/.exec(a || ''), y = /^(\d{4})-(\d{2})-(\d{2})$/.exec(b || a || '');
    if (!x || !y) return '';
    var n = Math.round((Date.UTC(+y[1], +y[2] - 1, +y[3]) - Date.UTC(+x[1], +x[2] - 1, +x[3])) / 864e5) + 1;
    return n < 1 ? '' : n % 7 === 0 ? (n / 7) + '주' : n + '일';
  }
  // 계약서(없으면 견적서, 그것도 없으면 고객 주소)에서 공개해도 되는 내용만 모음
  function importInfo(sel, L) {
    var kind = sel.slice(0, 2), id = sel.slice(2), k = null, cust = null;
    if (kind === 'k:') k = L.contracts.filter(function (x) { return x.id === id; })[0];
    else {
      cust = L.customers.filter(function (x) { return x.id === id; })[0];
      k = L.contracts.filter(function (x) { return x.customer_id === id && x.status !== 'canceled' && x.status !== 'terminated'; })
        .sort(function (a, b) { return String(b.updated_at || '').localeCompare(String(a.updated_at || '')); })[0] || null;
    }
    var est = !k && cust ? L.estimates.filter(function (e) { return e.customer_id === cust.id; })[0] : null;
    return Promise.all([k ? DB.getContract(k.id) : null, est && DB.getEstimate ? DB.getEstimate(est.id).catch(function () { return null; }) : null]).then(function (r) {
      var row = r[0], e = r[1], dc = (row && row.doc) || {}, snap = dc.estimate || {}, ed = (e && e.doc) || {};
      if (!cust && row && row.customer_id) cust = L.customers.filter(function (x) { return x.id === row.customer_id; })[0] || null;
      var site = dc.site || [ed.site && ed.site.region, ed.site && ed.site.name].filter(Boolean).join(' ') || (cust && cust.address) || '';
      var sp = splitRegion(site), region = joinRegion({ sido: sp.sido, sgg: sp.sgg, etc: sp.etc, rest: '' });
      var spot = publicPlace(sp.rest).slice(0, 40);
      var size = sizeFrom([ed.site && ed.site.size, snap.site, row && row.title, dc.title, site, e && e.title]);
      var phases = (Array.isArray(dc.phases) ? dc.phases : []).map(function (h) { return h && h.name; }).filter(Boolean);
      var text = [row && row.title, dc.title, snap.title, catText(snap.cats), catText(ed.cats), e && e.title, phases.join(' ')].join(' ');
      var titleSrc = publicPlace(splitRegion((row && row.title) || dc.title || (e && e.title) || '', false, true).rest).replace(/\s*인테리어 공사$/, ' 인테리어');
      var scopes = scopesFrom(text);
      var extra = extraScopes(catNames(snap.cats).concat(catNames(ed.cats), phases));   // 목록에 없는 공사 내용 (새로 만들어 고름)
      scopes = scopes.concat(extra.filter(function (x) { return scopes.indexOf(x) < 0; }));
      var who = (dc.customer && dc.customer.name) || (row && row.customer_name) || (cust && cust.name) || '';
      if (who && who.length >= 2) titleSrc = titleSrc.split(who).join('').replace(/\s*(고객님|님)\s*(댁)?/g, ' ').replace(/\s+/g, ' ').trim();   // 제목에 손님 이름이 있으면 뺌
      return {
        name: (dc.customer && dc.customer.name) || (row && row.customer_name) || (cust && cust.name) || (e && e.customer_name) || '',
        region: region, spot: spot, place: [region, spot].filter(Boolean).join(' '), size: size,
        building: buildingFrom([site, text].join(' ')), scopes: scopes,
        period: row ? periodText(row.start_date || dc.start, row.end_date || dc.end) : (ed.period || ''),
        title: titleSrc && titleSrc.length > 3 ? titleSrc.slice(0, 80) : [spot.split(' ').pop(), size ? size + '평' : '', scopes.slice(0, 3).join('·'), '공사'].filter(Boolean).join(' '),
        phases: phases, from: row ? 'contract' : e ? 'estimate' : 'customer', newScopes: extra,
      };
    });
  }
  function importLists() {
    return Promise.all([soft(DB.listContracts), soft(DB.listCustomers), soft(DB.listEstimates)]).then(function (r) { return { contracts: r[0], customers: r[1], estimates: r[2] }; });
  }
  // 찾아서 고르기 목록: 계약서(최근 공사 순) 다음 고객(최근 고친 순)
  function importItems(L) {
    var md = function (d) { var m = /^\d{4}-(\d{2})-(\d{2})/.exec(d || ''); return m ? (+m[1]) + '/' + (+m[2]) : ''; };
    var ks = L.contracts.filter(function (k) { return k.status !== 'canceled' && k.status !== 'terminated'; })
      .sort(function (a, b) { return String(b.end_date || b.updated_at || '').localeCompare(String(a.end_date || a.updated_at || '')); });
    return ks.map(function (k) {
      var di = dealItem('k', k);   // 현장 / 품목 · 기간 · 고객 이름
      return { id: 'k:' + k.id, tag: '계약서', tagKey: 'k', label: di.label, sub: di.sub,
        keys: [k.customer_name, k.customer_phone, k.site, dateKeys(k.start_date)].join(' ') };
    }).concat(L.customers.map(function (c) {
      return { id: 'c:' + c.id, tag: '고객', tagKey: 'c', label: c.name || '이름 없음', sub: [c.phone, c.address].filter(Boolean).join(' · '), keys: c.memo ? String(c.memo).slice(0, 200) : '' };
    }));
  }
  // 고르면 run(내용) — 채운 뒤 안내는 칸 아래 글로 (검은 안내 상자 대신)
  function importBind(page, run) {
    var impL = null, lp = importLists().then(function (L) { impL = L; return L; });
    page.addEventListener('click', function (e) {
      var b = e.target.closest('[data-fdopen="imp-sel"]'); if (!b) return;
      finder({ title: '계약서·고객에서 불러오기', ph: '이름·전화번호·현장으로 찾기', items: lp.then(importItems), cur: $('#imp-sel', page).value, focus: b, tabs: true,
        empty: '아직 계약서나 고객이 없어요.', onPick: function (it) {
          if (!it) return;
          finderSet(page, 'imp-sel', it.id, it.label + (it.sub ? ' · ' + it.sub : ''));
          importInfo(it.id, impL).then(run).catch(function (err) { ask({ title: '불러오지 못했어요', text: esc(friendlyError(err)), cancel: false, ok: '확인' }); });
        } });
    });
  }
  function importNote(page, html) { var n = $('#imp-done', page); if (n) { n.innerHTML = html; n.hidden = false; } }
  function importCard(hint, plain) {   // plain: 상자 없이 다른 칸과 같은 모양 (후기 화면 — 계약서 연동이 덜 중요해서 아래쪽에)
    if (plain) return '<div class="field imp-field"><span class="label" id="imp-l">계약서·고객에서 불러오기 <span class="opt">(선택)</span></span>' +
      finderField('imp-sel', { ph: '계약서나 고객 찾기', labelledby: 'imp-l' }) + '<p class="hint imp-done" id="imp-done" hidden></p>' + (hint ? '<p class="hint">' + hint + '</p>' : '') + '</div>';
    return '<div class="imp-card" id="imp-card"><span class="label" id="imp-l">' + I.users + '계약서·고객에서 불러오기 <span class="opt">(선택)</span></span>' +
      finderField('imp-sel', { ph: '계약서나 고객 찾기', labelledby: 'imp-l' }) + '<p class="hint imp-done" id="imp-done" hidden></p><p class="hint">' + hint + '</p></div>';
  }
  // 칸 채우기: 비어 있는 칸만 바로 채우고, 이미 적은 칸이 다르면 바꿀지 물어봄. fields = [{ label, cur, val, set }]
  function importFill(fields, done) {
    fields = fields.filter(function (f) { return f.val && String(f.val) !== String(f.cur || ''); });
    var empty = fields.filter(function (f) { return !String(f.cur || '').trim(); }), diff = fields.filter(function (f) { return String(f.cur || '').trim(); });
    var go = function (all) { (all ? fields : empty).forEach(function (f) { f.set(f.val); }); setDirty(true); done((all ? fields : empty).length); };
    go(!!diff.length);   // 고른 계약서·고객 내용으로 바로 바꿈 (묻지 않음)
  }

  /* ---------- 시공사례 쓰기 / 고치기 ---------- */
  function viewWorkForm(id) {
    frame(id ? '시공사례 고치기' : '시공사례 올리기', true, 'works');
    app.innerHTML = '<div class="page"><div class="loading">불러오는 중…</div></div>';
    (id ? DB.getWork(id) : Promise.resolve(null)).then(function (w) {
      if (id && !w) { app.innerHTML = '<div class="page"><div class="error-msg">이 시공사례를 찾을 수 없어요. 이미 지워졌을 수 있어요.</div><a class="btn btn-primary" href="#/">처음 화면으로</a></div>'; return; }
      w = w || { published: true, featured: false, scopes: [], photos: [] };
      var sizeNum = String(w.size || '').replace(/[^0-9.]/g, '');
      var page = document.createElement('form');
      page.className = 'page';
      page.noValidate = true;
      page.innerHTML =
        '<div class="form-grid"><div class="form-side">' +
        '<div class="step"><span class="num">1</span><h2>사진 넣기</h2></div>' +
        '<div id="photo-box"></div>' +
        '<div class="tip">' + I.info + '<span>맨 앞 사진이 목록에 보이는 <b>대표 사진</b>이 돼요. 화살표로 순서를 바꿀 수 있어요. 사진은 자동으로 알맞은 크기로 줄여서 올라가요.</span></div>' +
        '</div><div class="form-main">' +

        importCard('고르면 <b>지역·동네·아파트 이름, 평수, 건물 종류, 공사 내용, 공사 기간</b>을 채워요. 손님 이름·전화번호·동/호수는 넣지 않아요.') +
        '<div class="step"><span class="num">2</span><h2>제목</h2></div>' +
        '<div class="field"><label for="f-title" class="sr-only">제목</label><input class="input" id="f-title" maxlength="80" placeholder="예) ○○아파트 32평 전체 리모델링" value="' + esc(w.title || '') + '"></div>' +

        '<div class="step"><span class="num">3</span><h2>현장 정보<span class="opt">(몰라도 괜찮아요)</span></h2></div>' +
        '<div class="field"><label for="f-place-sido">지역 · 동네 · 아파트 이름</label>' + regionPick('f-place', w.place || '', { detail: { ph: '예) 영통동 ○○아파트', label: '동네 · 아파트 이름', max: 40 } }) +
        '<p class="hint">고객님 집이 너무 자세히 드러나지 않게 동·단지 이름까지만 써 주세요. (호수는 쓰지 않기)</p></div>' +
        '<div class="field"><label for="f-size">평수</label><div class="py-pair"><div class="input-suffix"><input class="input" id="f-size" data-py inputmode="decimal" maxlength="6" placeholder="예) 32" value="' + esc(sizeNum) + '"><span>평</span></div>' + m2Field(sizeNum, 'input-suffix') + '</div></div>' +
        '<div class="field"><span class="label">건물 종류</span>' + choiceGroup('building', C.buildingTypes || [], w.building, false) + '</div>' +
        '<div class="field"><span class="label">공사 내용 <span class="opt">(여러 개 고를 수 있어요)</span></span>' + choiceGroup('scopes', C.workScopes || [], w.scopes, true) + '</div>' +
        '<div class="field"><label for="f-period">공사 기간</label><input class="input" id="f-period" maxlength="20" placeholder="예) 4주" value="' + esc(w.period || '') + '"></div>' +

        '<div class="step"><span class="num">4</span><h2>설명<span class="opt">(안 써도 돼요)</span></h2></div>' +
        '<div class="field"><label for="f-body" class="sr-only">설명</label><textarea class="textarea" id="f-body" maxlength="3000" placeholder="어떤 공사였는지 편하게 적어 주세요. 말하듯이 써도 괜찮아요.">' + esc(w.body || '') + '</textarea>' +
        (window.AIKit ? '<button type="button" class="btn btn-outline ai-fill" data-aifill>' + I.spark + '<span>AI로 글 완성하기</span></button>' +
          '<p class="hint">사진·현장 정보·메모를 보고 AI가 <b>제목과 설명</b>을 다듬어 써 줘요. 몇 줄만 적어도 돼요. 넣기 전에 먼저 보여 드려요.</p>' : '') +
        '<div class="tip only-touch">' + I.mic + '<span>글자 치기가 번거로우면 휴대폰 키보드의 <b>마이크 버튼</b>을 누르고 말로 해 보세요. 말한 내용이 글자로 들어가요.</span></div></div>' +

        '<details class="more"' + (w.blog_url ? ' open' : '') + '><summary>네이버 블로그 글 연결하기</summary><div class="in">' +
        '<div class="field"><label for="f-blog">블로그 글 주소 <span class="opt">(있을 때만)</span></label><input class="input" id="f-blog" type="url" inputmode="url" placeholder="https://blog.naver.com/..." value="' + esc(w.blog_url || '') + '">' +
        '<p class="hint">블로그에 같은 현장 글을 올렸다면, <span class="only-touch">블로그 앱에서 <b>공유 → 링크 복사</b> 후</span><span class="only-mouse">그 글을 열고 <b>주소창의 주소를 복사</b>해서</span> 여기에 붙여 넣으세요. 홈페이지에 "블로그에서 자세히 보기" 버튼이 생겨요.</p></div></div></details>' +

        '<div class="step"><span class="num">5</span><h2>보여주기 설정</h2></div>' +
        switchRow('f-pub', '홈페이지에 공개하기', '끄면 저장만 되고 홈페이지에는 안 보여요', w.published !== false) +
        switchRow('f-feat', '메인 화면에 크게 보여주기', '첫 화면 큰 사진(번갈아 바뀜)과 "최근 시공사례"에 먼저 나와요', !!w.featured) +
        '</div></div>' +

        '<div class="savebar"><div class="msg" id="save-msg" hidden></div><button class="btn btn-primary" type="submit">' + I.check + (id ? '고친 내용 저장하기' : '홈페이지에 올리기') + '</button></div>';
      app.innerHTML = '';
      app.appendChild(page);

      var started = false;
      var picker = PhotoPicker($('#photo-box', page), w.photos, MAX_WORK_PHOTOS, function () { if (started) setDirty(true); });
      started = true;
      // 계약서·고객에서 불러오기
      importBind(page, function (inf) {
          var bld = $('input[name=building]:checked', page);
          var fields = [
            { label: '제목', cur: $('#f-title', page).value.trim(), val: inf.title, set: function (x) { $('#f-title', page).value = x; } },
            { label: '지역 · 동네 · 아파트', cur: $('#f-place', page).value.trim(), val: inf.place, set: function (x) {
              var box = $('#f-place', page).closest('[data-rg]'); box.outerHTML = regionPick('f-place', x, { detail: { ph: '예) 영통동 ○○아파트', label: '동네 · 아파트 이름', max: 40 } }); } },
            { label: '평수', cur: $('#f-size', page).value.trim(), val: inf.size, set: function (x) { var fs = $('#f-size', page); fs.value = x; fs.dispatchEvent(new Event('input', { bubbles: true })); } },   // ㎡ 칸도 같이
            { label: '건물 종류', cur: bld ? bld.value : '', val: inf.building, set: function (x) { $$('input[name=building]', page).forEach(function (r) { r.checked = r.value === x; }); } },
            { label: '공사 기간', cur: $('#f-period', page).value.trim(), val: inf.period, set: function (x) { $('#f-period', page).value = x; } },
          ];
          importFill(fields, function () {
            // 공사 내용은 더하기만 (이미 고른 건 그대로). 목록에 없는 공사(견적서 공사 항목·계약서 공정)는 칸을 새로 만들어 고름
            var added = 0, made = [], first = $('input[name=scopes]', page), box = first && first.closest('.choices');
            inf.scopes.forEach(function (sc) {
              if (!box || $$('input[name=scopes]', page).some(function (c) { return c.value === sc; })) return;
              var l = document.createElement('label'); l.className = 'choice';
              l.innerHTML = '<input type="checkbox" name="scopes" value="' + esc(sc) + '"><span>' + esc(sc) + '</span>';
              box.appendChild(l); made.push(sc);
            });
            $$('input[name=scopes]', page).forEach(function (c) { if (inf.scopes.indexOf(c.value) >= 0 && !c.checked) { c.checked = true; added++; } });
            if (added) setDirty(true);
            importNote(page, '불러왔어요. <b>건물 종류·공사 내용</b>은 글자를 보고 짐작해 고른 거라 맞는지 확인해 주세요.' +
              (made.length ? '<br>목록에 없던 공사 내용도 새로 만들어 골라 뒀어요: <b>' + made.map(esc).join(' · ') + '</b>' : ''));
          });
      });
      // AI로 글 완성하기: 지금 적은 내용 + 사진(작은 사진)으로 제목·설명 쓰기
      page.addEventListener('click', function (e) {
        var btn = e.target.closest('[data-aifill]'); if (!btn || !window.AIKit) return;
        if (picker.busy()) return notice('사진을 줄이는 중이에요', '잠시 뒤에 눌러 주세요.');
        var sz = $('#f-size', page).value.trim(), bld = $('input[name=building]:checked', page);
        var f = { title: $('#f-title', page).value.trim(), place: $('#f-place', page).value.trim(), size: sz ? sz + (/평$/.test(sz) ? '' : '평') : '',
          building: bld ? bld.value : '', scopes: $$('input[name=scopes]:checked', page).map(function (x) { return x.value; }),
          period: $('#f-period', page).value.trim(), body: $('#f-body', page).value.trim() };
        var photos = picker.items().filter(function (it) { return it.status === 'ready'; }).slice(0, 6)
          .map(function (it) { return it.prep && it.prep.thumb ? it.prep.thumb : it.preview; }).filter(Boolean);
        if (!f.body && !f.place && !f.scopes.length && !photos.length) return notice('먼저 조금 적어 주세요', '사진이나 현장 정보, 메모를 조금이라도 넣고 눌러 주세요.');
        var lbl = $('span', btn); btn.disabled = true; lbl.textContent = 'AI가 쓰는 중… (30초쯤)';
        window.AIKit.write('work', { work: f, photos: photos }).then(function (res) {
          var r = res.result || {};
          return ask({ title: 'AI가 쓴 글이에요', cancel: '그만두기', ok: '이 글로 넣기',
            text: '<span class="ai-prev"><b>제목</b><br>' + esc(r.title || f.title || '') + '<br><br><b>설명</b><br>' + esc(r.body || '').replace(/\n/g, '<br>') + '</span>' +
              (res.cut ? '<br><small>글이 길어서 끝이 조금 잘렸을 수 있어요.</small>' : '') }).then(function (ok) {
            if (!ok) return;
            if (r.title) $('#f-title', page).value = r.title;
            if (r.body) $('#f-body', page).value = r.body;
            setDirty(true); toast('넣었어요 · 읽어 보고 고쳐서 올려 주세요');
          });
        }).catch(function (err) {
          var c = err && err.code;
          if (c === 'none' || c === 'demo' || c === 'no_key' || c === 'no_function' || c === 'not_granted') {
            return ask({ title: 'AI를 바로 쓸 수 없어요', cancel: '닫기', ok: '요청문 복사',
              text: (c === 'no_key' ? 'Netlify에 AI 키(GEMINI_API_KEY 또는 ANTHROPIC_API_KEY)를 넣으면 버튼 한 번에 써 줘요.<br>' : '') + '요청문을 복사해서 AI 앱(Gemini·ChatGPT·Claude)에 사진과 함께 붙여 넣고, 받은 글을 설명 칸에 붙여 넣어 주세요.' }).then(function (ok) {
              if (ok) copyText(window.AIKit.promptText('work', { work: f, photos: photos })).then(function (done) { if (!done) notice('복사하지 못했어요'); else notice('요청문을 복사했어요', 'AI 앱(Claude·ChatGPT)에 붙여 넣으세요.'); });
            });
          }
          if (c !== 'cancelled') ask({ title: '글을 쓰지 못했어요', text: esc(err.message || friendlyError(err)), cancel: false, ok: '확인' });
        }).then(function () { btn.disabled = false; lbl.textContent = 'AI로 글 완성하기'; });
      });
      page.addEventListener('input', function () { setDirty(true); $('#save-msg', page).hidden = true; });
      page.addEventListener('change', function () { setDirty(true); });

      page.addEventListener('submit', function (e) {
        e.preventDefault();
        var msg = $('#save-msg', page);
        function fail(t, focusSel) {
          msg.textContent = t; msg.hidden = false;
          if (focusSel) { var el = $(focusSel, page); el.scrollIntoView({ behavior: 'smooth', block: 'center' }); if (el.focus) setTimeout(function () { el.focus(); }, 350); }
        }
        if (picker.busy()) return fail('사진을 줄이는 중이에요. 잠시 뒤에 다시 눌러 주세요.');
        if (!picker.goodCount()) return fail('사진을 1장 이상 넣어 주세요.', '#photo-box');
        var title = $('#f-title', page).value.trim();
        if (!title) return fail('제목을 써 주세요.', '#f-title');

        var recId = w.id || DB.newId();
        var size = $('#f-size', page).value.replace(/[^0-9.]/g, '');
        var sel = $('input[name=building]:checked', page);
        var prog = progress(id ? '고친 내용을 저장하는 중이에요' : '홈페이지에 올리는 중이에요');
        picker.upload('works/' + recId, prog).then(function (photos) {
          prog.set(1, 1, '거의 다 됐어요…');
          var rec = {
            id: recId,
            title: title,
            place: $('#f-place', page).value.trim(),
            size: size ? size + '평' : '',
            building: sel ? sel.value : '',
            scopes: $$('input[name=scopes]:checked', page).map(function (x) { return x.value; }),
            period: $('#f-period', page).value.trim(),
            body: $('#f-body', page).value.trim(),
            blog_url: $('#f-blog', page).value.trim(),
            published: $('#f-pub', page).checked,
            featured: $('#f-feat', page).checked,
            photos: photos,
          };
          if (w.created_at) rec.created_at = w.created_at;
          return DB.saveWork(rec).then(function () { return DB.removePhotos(picker.removed()); }).then(function () { return rec; });
        }).then(function (rec) {
          prog.close();
          setDirty(false);
          state.counts = null;
          if (!id) filterReset('workF');
          replaceTo('#/done/work/' + encodeURIComponent(rec.id) + (rec.published ? '' : '/hidden'));
        }).catch(function (err) {
          prog.close();
          ask({ title: '아직 저장되지 않았어요', text: esc(friendlyError(err)) + '<br><br>입력한 내용은 그대로 있어요.', cancel: false, ok: '확인' });
        });
      });
    }).catch(function (err) {
      app.innerHTML = '<div class="page"><div class="error-msg">' + esc(friendlyError(err)) + '</div><a class="btn btn-primary" href="#/">처음 화면으로</a></div>';
    });
  }

  /* ---------- 후기 쓰기 / 고치기 ---------- */
  function viewReviewForm(id) {
    frame(id ? '후기 고치기' : '후기 올리기', true, 'reviews');
    app.innerHTML = '<div class="page"><div class="loading">불러오는 중…</div></div>';
    Promise.all([id ? DB.getReview(id) : Promise.resolve(null), DB.listWorks({ all: true })]).then(function (res) {
      var rv = res[0], works = res[1];
      if (id && !rv) { app.innerHTML = '<div class="page"><div class="error-msg">이 후기를 찾을 수 없어요.</div><a class="btn btn-primary" href="#/">처음 화면으로</a></div>'; return; }
      rv = rv || { rating: 5, published: true, photos: [] };
      var rating = Number(rv.rating) || 5;
      function workOf(wid) { return wid ? works.filter(function (w) { return w.id === wid; })[0] || null : null; }
      function setWork(wid) { var w = workOf(wid); finderSet(page, 'r-work', w ? w.id : '', w ? w.title || '제목 없음' : '', '시공사례 찾기'); setDirty(true); }
      var page = document.createElement('form');
      page.className = 'page';
      page.noValidate = true;
      page.innerHTML =
        '<div class="form-grid review-grid"><div class="form-main">' +
        // 계약서·고객에서 불러오기는 맨 위 (고르면 아래 칸을 채워 줘서 따로 안 적어도 됨) — 점선 상자 없이 오른쪽 '사진' 칸과 같은 모양·높이로
        importCard('고르면 고객님 성함·현장을 채우고, 같은 현장의 시공사례를 골라 둬요.', true) +
        '<div class="field"><label for="r-author">고객님 성함<span class="req">*</span></label><input class="input" id="r-author" maxlength="20" placeholder="예) 김철수" value="' + esc(rv.author || '') + '">' +
        '<p class="hint">이름을 그대로 써도 홈페이지에는 "<b>김○○ 고객님</b>"처럼 성만 보여요. (저장할 때 저절로 가려요)</p></div>' +
        '<div class="field"><label for="r-place">현장 <span class="opt">(선택)</span></label><input class="input" id="r-place" maxlength="40" placeholder="예) ○○아파트 32평" value="' + esc(rv.place || '') + '"></div>' +
        '<div class="field"><span class="label">별점</span><div class="rating" id="r-rating">' + [1, 2, 3, 4, 5].map(function (n) {
          return '<button type="button" data-n="' + n + '" aria-label="별 ' + n + '개"' + (n <= rating ? ' class="on"' : '') + '>' + I.star + '</button>';
        }).join('') + '</div></div>' +
        '<div class="field"><label for="r-body">후기 내용<span class="req">*</span></label><textarea class="textarea" id="r-body" maxlength="2000" placeholder="고객님이 보내주신 후기를 그대로 옮겨 주세요.">' + esc(rv.body || '') + '</textarea>' +
        '<div class="tip">' + I.info + '<span><span class="only-touch">카톡으로 받은 후기는 메시지를 <b>길게 눌러 복사</b>한 뒤, 이 칸을 길게 눌러 <b>붙여넣기</b> 하면 돼요.</span><span class="only-mouse">카톡 PC에서 후기 메시지를 <b>복사(Ctrl + C)</b>한 뒤, 이 칸을 누르고 <b>붙여넣기(Ctrl + V)</b> 하면 돼요.</span> 올리기 전에 고객님께 홈페이지에 올려도 되는지 꼭 여쭤봐 주세요.</span></div></div>' +
        '</div><div class="form-side">' +
        '<div class="field"><span class="label">사진 <span class="opt">(선택 · ' + MAX_REVIEW_PHOTOS + '장까지)</span></span><div id="photo-box"></div></div>' +
        '<div class="field"><span class="label" id="r-work-l">어느 시공사례의 후기인가요? <span class="opt">(선택)</span></span>' +
        finderField('r-work', { ph: '시공사례 찾기', labelledby: 'r-work-l', clear: '시공사례 고르지 않기', value: workOf(rv.work_id) ? rv.work_id : '', label: workOf(rv.work_id) ? workOf(rv.work_id).title : '' }) +
        '<p class="hint">고르면 그 시공사례 화면에도 후기가 함께 보이고, 후기 목록에서 그 시공사례의 지역으로 찾을 수 있어요.</p></div>' +
        switchRow('r-pub', '홈페이지에 공개하기', '끄면 저장만 되고 홈페이지에는 안 보여요', rv.published !== false) +
        '</div></div>' +
        '<div class="savebar"><div class="msg" id="save-msg" hidden></div><button class="btn btn-primary" type="submit">' + I.check + (id ? '고친 내용 저장하기' : '후기 올리기') + '</button></div>';
      app.innerHTML = '';
      app.appendChild(page);

      var started = false;
      var picker = PhotoPicker($('#photo-box', page), rv.photos, MAX_REVIEW_PHOTOS, function () { if (started) setDirty(true); });
      started = true;
      importBind(page, function (inf) {
          var place = [inf.spot || inf.region.split(' ').pop() || '', inf.size ? inf.size + '평' : ''].filter(Boolean).join(' ').slice(0, 40);
          // 같은 현장으로 보이는 시공사례: 아파트·단지 이름(동네 이름 뒤 마지막 낱말)이 시공사례 지역·제목에 들어 있는 것이 하나뿐일 때만
          var key = (inf.spot.split(' ').pop() || '').replace(/\s+/g, ''), match = '';
          if (key.length >= 2) {
            var hits = works.filter(function (w) { return (String(w.place || '') + ' ' + String(w.title || '')).replace(/\s+/g, '').indexOf(key) >= 0; });
            if (hits.length === 1) match = hits[0].id;
          }
          var fields = [
            { label: '고객님 성함', cur: $('#r-author', page).value.trim(), val: inf.name, set: function (x) { $('#r-author', page).value = x; } },
            { label: '현장', cur: $('#r-place', page).value.trim(), val: place, set: function (x) { $('#r-place', page).value = x; } },
            { label: '시공사례', cur: $('#r-work', page).value, val: match, set: function (x) { setWork(x); } },
          ];
          importFill(fields, function () {
            importNote(page, match ? '불러왔어요. 같은 현장으로 보이는 <b>시공사례</b>를 골라 뒀으니 맞는지 확인해 주세요.' : '불러왔어요. 후기 내용은 고객님이 보내 주신 글을 붙여 넣어 주세요.');
          });
      });
      // 어느 시공사례의 후기: 찾아서 고르기
      page.addEventListener('click', function (e) {
        var b = e.target.closest('[data-fdopen="r-work"]'), c = e.target.closest('[data-fdclear="r-work"]');
        if (c) return setWork('');
        if (!b) return;
        var md = function (d) { var m = /^(\d{4})-(\d{2})/.exec(d || ''); return m ? m[1] + '.' + m[2] : ''; };
        finder({ title: '어느 시공사례의 후기인가요?', ph: '제목·지역·아파트로 찾기', cur: $('#r-work', page).value, focus: b, none: '고르지 않음', empty: '아직 올린 시공사례가 없어요.',
          items: works.map(function (w) { return { id: w.id, label: w.title || '제목 없음', sub: [w.place, w.size ? String(w.size).replace(/평$/, '') + '평' : '', md(w.created_at), w.published === false ? '숨김' : ''].filter(Boolean).join(' · '), keys: (w.scopes || []).join(' ') + ' ' + (w.building || '') }; }),
          onPick: function (it) { setWork(it ? it.id : ''); } });
      });
      $('#r-rating', page).addEventListener('click', function (e) {
        var b = e.target.closest('button[data-n]'); if (!b) return;
        rating = Number(b.getAttribute('data-n'));
        $$('#r-rating button', page).forEach(function (x) { x.classList.toggle('on', Number(x.getAttribute('data-n')) <= rating); });
        setDirty(true);
      });
      page.addEventListener('input', function () { setDirty(true); $('#save-msg', page).hidden = true; });
      page.addEventListener('change', function () { setDirty(true); });

      page.addEventListener('submit', function (e) {
        e.preventDefault();
        var msg = $('#save-msg', page);
        function fail(t, sel) { msg.textContent = t; msg.hidden = false; if (sel) { var el = $(sel, page); el.scrollIntoView({ behavior: 'smooth', block: 'center' }); setTimeout(function () { el.focus(); }, 350); } }
        var author = $('#r-author', page).value.trim();
        var body = $('#r-body', page).value.trim();
        if (!author) return fail('고객님 성함을 써 주세요.', '#r-author');
        if (!body) return fail('후기 내용을 써 주세요.', '#r-body');
        if (picker.busy()) return fail('사진을 줄이는 중이에요. 잠시 뒤에 다시 눌러 주세요.');
        var recId = rv.id || DB.newId();
        var prog = progress('후기를 올리는 중이에요');
        picker.upload('reviews/' + recId, prog).then(function (photos) {
          prog.set(1, 1, '거의 다 됐어요…');
          var rec = {
            id: recId,
            author: maskName(author),   // 홈페이지 고객 후기에는 성만 (김철수 → 김○○)
            place: $('#r-place', page).value.trim(),
            rating: rating,
            body: body,
            work_id: $('#r-work', page).value || null,
            published: $('#r-pub', page).checked,
            photos: photos,
          };
          if (rv.created_at) rec.created_at = rv.created_at;
          return DB.saveReview(rec).then(function () { return DB.removePhotos(picker.removed()); }).then(function () { return rec; });
        }).then(function (rec) {
          prog.close();
          setDirty(false);
          state.counts = null;
          if (!id) filterReset('revF');
          replaceTo('#/done/review/' + encodeURIComponent(rec.id) + (rec.published ? '' : '/hidden'));
        }).catch(function (err) {
          prog.close();
          ask({ title: '아직 저장되지 않았어요', text: esc(friendlyError(err)) + '<br><br>입력한 내용은 그대로 있어요.', cancel: false, ok: '확인' });
        });
      });
    }).catch(function (err) {
      app.innerHTML = '<div class="page"><div class="error-msg">' + esc(friendlyError(err)) + '</div><a class="btn btn-primary" href="#/">처음 화면으로</a></div>';
    });
  }

  /* ---------- 저장 완료 ---------- */
  function viewDone(kind, id, hidden) {
    var isWork = kind === 'work';
    frame('저장 완료', false, isWork ? 'works' : 'reviews');
    var link = isWork ? siteUrl('work?id=' + encodeURIComponent(id)) : siteUrl('reviews');
    app.innerHTML = '<div class="page"><div class="done">' +
      '<div class="check">' + I.check + '</div>' +
      '<h2>' + (hidden ? '저장했어요' : '홈페이지에 올렸어요') + '</h2>' +
      '<p>' + (hidden ? '지금은 <b>숨김</b> 상태라 홈페이지에는 안 보여요.' : '이제 손님들이 홈페이지에서 볼 수 있어요.') + '</p>' +
      '<div class="btns">' +
      (hidden ? '' : '<a class="btn btn-primary" href="' + esc(link) + '" target="_blank" rel="noopener">홈페이지에서 확인하기</a>') +
      '<a class="btn btn-outline" href="#/' + (isWork ? 'work' : 'review') + '/new">' + (isWork ? '시공사례' : '후기') + ' 하나 더 올리기</a>' +
      '<a class="btn btn-outline" href="#/' + (isWork ? 'works' : 'reviews') + '" data-leave>목록으로</a>' +
      '</div></div></div>';
  }

  /* ---------- 홈페이지에 보이는 연락 방법 (설정 → 상담 경로) ---------- */
  var SHOW_SW = [
    { id: 's-inq', key: 'inquiry_enabled', cache: 'midesign-inq', name: '상담 신청 버튼을', short: '상담 신청 버튼', title: '상담 신청 버튼 보이기',
      on: '켜져 있어요. 손님이 홈페이지에서 상담 신청서를 보낼 수 있어요', off: '꺼져 있어요. 상담 신청 버튼과 신청서가 안 보여요',
      ask: '상담 신청 버튼을 숨길까요?', askText: '홈페이지 모든 화면에서 <b>상담 신청 버튼과 신청서</b>가 안 보여요. 언제든 다시 켤 수 있어요.' },
    { id: 's-tel', key: 'phone_enabled', cache: 'midesign-tel', name: '전화번호를', short: '전화번호', title: '전화번호 보이기',
      on: '켜져 있어요. 전화번호와 전화 걸기 버튼이 보여요', off: '꺼져 있어요. 전화번호와 전화 걸기 버튼이 안 보여요',
      ask: '전화번호를 숨길까요?', askText: '홈페이지 모든 화면에서 <b>전화번호와 전화 걸기 버튼</b>이 안 보여요. (개인정보 처리방침의 연락처는 법에 따라 그대로 둬요) 언제든 다시 켤 수 있어요.' },
    { id: 's-kakao', key: 'kakao_enabled', cache: 'midesign-kakao', name: '카카오톡 버튼을', short: '카카오톡 버튼', title: '카카오톡 버튼 보이기',
      on: '켜져 있어요. 카카오톡 상담 버튼이 보여요', off: '꺼져 있어요. 카카오톡 상담 버튼이 안 보여요',
      ask: '카카오톡 버튼을 숨길까요?', askText: '홈페이지 모든 화면에서 <b>카카오톡 상담 버튼</b>이 안 보여요. 언제든 다시 켤 수 있어요.' },
  ];

  /* ---------- 설정 ---------- */
  function viewSettings() {
    frame('설정', false, 'settings');
    app.innerHTML = '<div class="page"><div class="loading">불러오는 중…</div></div>';
    (DB.getSettings ? DB.getSettings().catch(function () { return {}; }) : Promise.resolve({})).then(function (st) {
      var hidden = SHOW_SW.filter(function (sw) { return st[sw.key] === false; }).map(function (sw) { return sw.short; });
      // 카드는 모두 같은 높이: 제목(+ 상태 표시) 한 줄, 설명 한 줄
      var card = function (href, ico, title, desc, pill) {
        return '<a class="set-card" href="' + href + '"><span class="ico">' + ico + '</span><span class="t"><b>' + title + (pill || '') + '</b><small>' + desc + '</small></span><span class="go">' + I.right + '</span></a>';
      };
      app.innerHTML = '<div class="page set-page">' +
        card('#/settings/contact', I.inbox, '상담 경로', '상담 신청 · 전화번호 · 카카오톡',
          '<em class="' + (hidden.length ? 'off' : 'on') + '">' + (hidden.length ? '숨김: ' + esc(hidden.join(' · ')) : '모두 보임') + '</em>') +
        card('#/settings/lists', I.list, '목록 처음 보기', '메뉴를 열 때 처음 골라 둘 상태') +
        card('#/texts', I.pen, '홈페이지 문구', '메인 제목 · 상담 시간 · 대표 인사말') +
        card('#/estimates/settings', I.doc, '견적서 설정', '공사 항목 · 단가 · 평수별 수량') +
        card('#/contracts/settings', I.sign, '계약서 설정', '계약서 종류 · 입금 계좌 · 조항') +
        card('#/renders/settings', I.cube, '3D 그림 가구 크기', '가구를 도면에 처음 놓을 때의 크기') +
        card('#/settings/calendar', I.cal, '구글 캘린더에 일정 보이기', '일정 달력을 구글 캘린더에서도 보기') +
        card('#/admins', I.users, '관리자', '관리자 추가 · 삭제') +
        card('#/privacy', I.lock2, '보관 기간 지난 자료', '기간이 지난 손님 정보 확인 · 삭제', '<em class="on" id="priv-pill">확인 중</em>') +
        card('#/trash', I.trash, '휴지통', '지운 자료 ' + (DB.TRASH_DAYS || 30) + '일 보관 · 되살리기', '<em class="on" id="trash-pill" hidden></em>') +
        card('#/usage', I.db, '저장 공간', 'Supabase 무료 용량 · 얼마나 남았는지', '<em class="on" id="usage-pill" hidden></em>') +
        card('#/password', I.key, '비밀번호 바꾸기', '내 로그인 비밀번호 바꾸기') +
        '</div>';
      if (window.PrivacyKit) window.PrivacyKit.count().then(function (n) {
        var e = $('#priv-pill'); if (!e) return;
        e.className = n ? 'off' : 'on'; e.textContent = n ? n + '건 지워야 해요' : '없음';
      }).catch(function () { var e = $('#priv-pill'); if (e) e.remove(); });
      if (DB.listTrash) DB.listTrash().then(function (l) { var e = $('#trash-pill'); if (e && l.length) { e.hidden = false; e.textContent = l.length + '건'; } }).catch(function () {});
      if (window.UsageKit) window.UsageKit.check().then(function (v) { var e = $('#usage-pill'); if (!e) return; e.hidden = false; e.className = v.max >= 80 ? 'off' : 'on'; e.textContent = v.max + '% 사용'; }).catch(function () {});
    });
  }

  /* ---------- 시공사례 카드의 'SNS 글': 인스타그램 · 유튜브 쇼츠 · 블로그 중 고르기 (✓ 는 이미 만든 글) ---------- */
  function openSnsPick(w) {
    var KINDS = [['instagram', '인스타그램', '피드 글 · 해시태그 · 사진 순서'], ['shorts', '유튜브 쇼츠', '장면별 대본 · 화면 글자 · 내레이션'], ['blog', '네이버 블로그', '원고 · 사진 자리 · 태그']];
    var ov = document.createElement('div');
    ov.className = 'overlay';
    function draw(done) {
      ov.innerHTML = '<div class="sheet sns-pick" role="dialog" aria-modal="true" aria-labelledby="snp-t"><h3 id="snp-t">SNS 글 만들기</h3>' +
        '<p class="snp-w">' + esc(w.title || '시공사례') + '</p>' +
        '<div class="snp-list">' + KINDS.map(function (k) {
          var has = done && done[k[0]];
          return '<a class="snp-item" href="#/sns/' + encodeURIComponent(w.id) + '/' + k[0] + '"><b>' + k[1] + '</b><small>' + k[2] + '</small><span class="snp-st' + (has ? ' on' : '') + '">' + (has ? I.check + '만든 글 있음' : '새로 쓰기') + '</span></a>';
        }).join('') + '</div><p class="hint">AI가 사진과 시공사례 내용을 보고 글을 써 줘요. 고쳐서 복사해 올리면 돼요.</p>' +
        '<div class="btn-row"><button class="btn btn-outline" type="button" data-close>닫기</button></div></div>';
      $('.btn-row', ov).style.gridTemplateColumns = '1fr';
    }
    draw(null);
    document.body.appendChild(ov);
    ov.addEventListener('click', function (e) { if (e.target === ov || e.target.closest('[data-close]') || e.target.closest('.snp-item')) ov.remove(); });
    ov.addEventListener('keydown', function (e) { if (e.key === 'Escape') ov.remove(); });
    if (DB.getAdminSetting) DB.getAdminSetting('sns:index').then(function (idx) { if (ov.isConnected) draw((idx || {})[w.id] || null); }).catch(function () {});
  }

  /* ---------- 설정 → 목록 처음 보기: 메뉴마다 처음 골라 둘 상태 ---------- */
  function viewListDefs() {
    frame('목록 처음 보기', true, 'settings');
    state.backTo = '#/settings';
    app.innerHTML = '<div class="page"><div class="loading">불러오는 중…</div></div>';
    loadListDefs().then(function () {
      var cur = {};
      LIST_DEFS.forEach(function (L) { cur[L.key] = listDef(L.key, L.def); });
      function nowText(L) {
        var names = L.opts.filter(function (o) { return cur[L.key].indexOf(o[0]) >= 0; }).map(function (o) { return o[1]; });
        return !names.length || names.length === L.opts.length ? '전체가 보여요' : esc(names.join(', ')) + '만 보여요';
      }
      var page = document.createElement('div');
      page.className = 'page ld-page';
      page.innerHTML = '<p class="us-lead">메뉴를 열었을 때 <b>상태</b> 칸에 처음 골라 둘 것을 정해요. 아무것도 안 고르면 <b>전체</b>가 보여요. 목록에서는 언제든 바꿔 볼 수 있어요.</p>' +
        LIST_DEFS.map(function (L) {
          return '<section class="txt-card ld-card"><h2>' + esc(L.title) + '</h2><div class="ld-opts">' + L.opts.map(function (o) {
            return '<label class="msel-opt"><input type="checkbox" data-lk="' + L.key + '" value="' + esc(o[0]) + '"' + (cur[L.key].indexOf(o[0]) >= 0 ? ' checked' : '') + '><span>' + esc(o[1]) + '</span></label>';
          }).join('') + '</div><p class="hint ld-now" data-ln="' + L.key + '">처음에 ' + nowText(L) + '</p></section>';
        }).join('') +
        '<div class="savebar" id="ld-bar" hidden><p class="msg" id="ld-msg" hidden></p><button class="btn btn-primary" type="button" data-ldsave>' + I.check + '저장</button></div>';
      app.innerHTML = ''; app.appendChild(page);
      page.addEventListener('change', function (e) {
        var el = e.target, k = el.getAttribute('data-lk'); if (!k) return;
        var L = LIST_DEFS.filter(function (x) { return x.key === k; })[0];
        cur[k] = L.opts.map(function (o) { return o[0]; }).filter(function (v) { return $('[data-lk="' + k + '"][value="' + v + '"]', page).checked; });
        $('[data-ln="' + k + '"]', page).innerHTML = '처음에 ' + nowText(L);
        $('#ld-bar', page).hidden = false; setDirty(true);
      });
      page.addEventListener('click', function (e) {
        var b = e.target.closest('[data-ldsave]'); if (!b) return;
        b.disabled = true;
        (DB.saveAdminSetting ? DB.saveAdminSetting('list_defaults', cur) : Promise.resolve()).then(function () {
          state.listDefs = JSON.parse(JSON.stringify(cur));
          LIST_DEFS.forEach(function (L) { delete state[L.key]; });   // 다음에 목록을 열면 새 기본값으로
          setDirty(false); b.disabled = false; $('#ld-bar', page).hidden = true;
        }).catch(function (err) { b.disabled = false; var m = $('#ld-msg', page); m.textContent = friendlyError(err); m.hidden = false; });
      });
    });
  }

  function viewContact() {
    frame('상담 경로', true, 'settings');
    state.backTo = '#/settings';
    app.innerHTML = '<div class="page"><div class="loading">불러오는 중…</div></div>';
    (DB.getSettings ? DB.getSettings().catch(function () { return {}; }) : Promise.resolve({})).then(function (st) {
      var shows = {};
      SHOW_SW.forEach(function (sw) { shows[sw.id] = st[sw.key] !== false; });
      var page = document.createElement('div');
      page.className = 'page set-page';
      function draw() {
        page.innerHTML = '<div class="tip">' + I.info + '<span>손님이 홈페이지에서 연락하는 방법을 고르는 곳이에요. 바쁠 때 <b>상담 신청 버튼</b>을 잠시 끄는 식으로 써요. 끄면 홈페이지 모든 화면에서 바로 사라지고, 다시 켜면 돌아와요.</span></div>' +
          '<div class="setting-box">' +
          '<p class="setting-title">홈페이지에 보이는 연락 방법</p>' +
          SHOW_SW.map(function (sw) {
            var on = shows[sw.id];
            return '<div class="' + (on ? '' : 'sw-off') + '">' + switchRow(sw.id, sw.title, on ? sw.on : sw.off, on) + '</div>';
          }).join('') + '</div>';
      }
      draw();
      app.innerHTML = '';
      app.appendChild(page);
      page.addEventListener('change', function (e) {
        var conf = SHOW_SW.filter(function (x) { return x.id === e.target.id; })[0];
        if (!conf) return;
        var sw = e.target, want = sw.checked;
        var othersOn = SHOW_SW.filter(function (x) { return x.id !== conf.id && shows[x.id]; }).length;
        (want ? Promise.resolve(true) : ask({
          title: conf.ask,
          text: conf.askText + (othersOn ? '' : '<br><br><b>이것까지 끄면 손님이 홈페이지에서 연락할 방법이 하나도 없어요.</b>'),
          cancel: '그만두기', ok: '숨기기', okClass: othersOn ? '' : 'btn-danger',
        })).then(function (ok) {
          if (!ok) { sw.checked = true; return; }
          sw.disabled = true;
          return DB.saveSetting(conf.key, want).then(function () {
            shows[conf.id] = want;
            try { localStorage.setItem(conf.cache, want ? '1' : '0'); } catch (err) {}
            draw();
            toast(want ? conf.name + ' 다시 보이게 했어요' : conf.name + ' 숨겼어요');
          }).catch(function (err) {
            sw.checked = !want; sw.disabled = false;
            ask({ title: '바꾸지 못했어요', text: esc(friendlyError(err)), cancel: false, ok: '확인' });
          });
        });
      });
    });
  }

  /* ---------- 홈페이지 문구 고치기 ---------- */
  // [키, 이름, 형식(line 한 줄 / lines 줄바꿈 / paras 문단), 최대 글자, 도움말]
  var TEXT_GROUPS = [
    { title: '메인 첫 화면', desc: '홈페이지를 열면 맨 처음 큰 사진 위에 보이는 글씨예요.', items: [
      ['heroEyebrow', '작은 글씨', 'line', 40],
      ['heroTitle', '큰 제목', 'lines', 60, '줄을 바꾸려면 Enter를 누르세요. 두 줄이 가장 보기 좋아요.'],
      ['heroSub', '설명 한 줄', 'line', 60],
    ] },
    { title: '메인 회사 소개', desc: '큰 "31년" 숫자 옆에 보이는 소개예요.', items: [
      ['statSites', '누적 시공 현장 수', 'line', 12, '예) 200+ · "누적 시공 현장 200+" 처럼 보여요.'],
      ['aboutTitle', '소개 제목', 'lines', 40, '줄을 바꾸려면 Enter를 누르세요.'],
      ['aboutText', '소개 글', 'lines', 400],
    ] },
    { title: '이렇게 일합니다', desc: '메인과 회사소개에 함께 보이는 세 가지 약속이에요.', items: [
      ['promise1Title', '약속 1 제목', 'line', 30], ['promise1Text', '약속 1 설명', 'lines', 200],
      ['promise2Title', '약속 2 제목', 'line', 30], ['promise2Text', '약속 2 설명', 'lines', 200],
      ['promise3Title', '약속 3 제목', 'line', 30], ['promise3Text', '약속 3 설명', 'lines', 200],
    ] },
    { title: '화면 아래 상담 안내', desc: '모든 화면 맨 아래 검은 칸에 보여요.', items: [
      ['ctaTitle', '제목', 'line', 40],
      ['ctaText', '설명 한 줄', 'line', 80],
      ['hours', '상담 시간', 'line', 60, '맨 아래 업체 정보, 회사소개, 상담 신청 화면의 상담 시간도 함께 바뀌어요.'],
    ] },
    { title: '회사소개 인사말', desc: '회사소개 화면의 대표 인사말이에요.', items: [
      ['greetingTitle', '제목', 'line', 40],
      ['greetingBody', '인사말', 'paras', 1500, '문단을 나누려면 한 줄을 비워 주세요.'],
    ] },
  ];
  function tok(v) {
    if (typeof v !== 'string') return '';
    var years = C.careerSince ? new Date().getFullYear() - Number(C.careerSince) : '';
    return v.replace(/\{years\}/g, years).replace(/\{name\}/g, C.name || '').replace(/\{ceo\}/g, C.ceo || '');
  }
  function textDefault(key) {
    if (key === 'hours') return C.hours || '';
    if (key === 'statSites') return (C.stats && C.stats[0] && C.stats[0].value) || '';
    return tok((C.texts || {})[key]);
  }
  function cleanText(v, kind) {
    v = String(v || '').replace(/\r/g, '');
    if (kind === 'line') return v.replace(/\s+/g, ' ').trim();
    v = v.split('\n').map(function (l) { return l.replace(/[ \t]+/g, ' ').trim(); }).join('\n').trim();
    return kind === 'paras' ? v.replace(/\n{3,}/g, '\n\n') : v.replace(/\n{2,}/g, '\n');
  }

  function viewTexts() {
    frame('홈페이지 문구', true, 'settings');
    state.backTo = '#/settings';
    app.innerHTML = '<div class="page"><div class="loading">불러오는 중…</div></div>';
    (DB.getSettings ? DB.getSettings() : Promise.resolve({})).then(function (s) {
      var saved = (s && s.texts && typeof s.texts === 'object') ? s.texts : {};
      var page = document.createElement('form');
      page.className = 'page texts-page';
      page.noValidate = true;
      page.innerHTML =
        '<div class="tip texts-intro">' + I.info + '<span>여기서 글을 고치고 맨 아래 <b>홈페이지에 반영하기</b>를 누르면 바로 홈페이지에 보여요. ' +
        '잘못 고쳤으면 칸 아래 <b>처음 문구로</b>를 누르세요.</span></div>' +
        TEXT_GROUPS.map(function (g) {
          return '<section class="txt-group"><h2>' + esc(g.title) + '</h2><p class="txt-desc">' + esc(g.desc) + '</p><div class="txt-card">' +
            g.items.map(function (it) {
              var key = it[0], def = textDefault(key), val = saved[key] != null ? saved[key] : def;
              var id = 't-' + key, rows = it[2] === 'line' ? 0 : (it[2] === 'paras' ? 8 : Math.min(5, Math.max(2, Math.ceil(it[3] / 60))));
              var input = it[2] === 'line'
                ? '<input class="input" id="' + id + '" data-key="' + key + '" data-kind="line" maxlength="' + it[3] + '" value="' + esc(val) + '">'
                : '<textarea class="textarea txt-area" id="' + id + '" data-key="' + key + '" data-kind="' + it[2] + '" maxlength="' + it[3] + '" rows="' + rows + '">' + esc(val) + '</textarea>';
              return '<div class="field txt-field"><label for="' + id + '">' + esc(it[1]) + '</label>' + input +
                '<div class="txt-under">' + (it[4] ? '<p class="hint">' + esc(it[4]) + '</p>' : '<span></span>') +
                '<button type="button" class="txt-reset" data-reset="' + key + '"' + (cleanText(val, it[2]) === cleanText(def, it[2]) ? ' hidden' : '') + '>처음 문구로</button></div></div>';
            }).join('') + '</div></section>';
        }).join('') +
        '<div class="savebar"><div class="msg" id="save-msg" hidden></div><button class="btn btn-primary" type="submit">' + I.check + '홈페이지에 반영하기</button></div>';
      app.innerHTML = '';
      app.appendChild(page);

      var kinds = {};
      TEXT_GROUPS.forEach(function (g) { g.items.forEach(function (it) { kinds[it[0]] = it[2]; }); });
      function syncReset(el) {
        var key = el.getAttribute('data-key'), b = $('[data-reset="' + key + '"]', page);
        if (b) b.hidden = cleanText(el.value, kinds[key]) === cleanText(textDefault(key), kinds[key]) || !el.value.trim();
      }
      page.addEventListener('input', function (e) { if (e.target.hasAttribute('data-key')) { setDirty(true); syncReset(e.target); } });
      page.addEventListener('click', function (e) {
        var r = e.target.closest('[data-reset]'); if (!r) return;
        var el = $('[data-key="' + r.getAttribute('data-reset') + '"]', page);
        el.value = textDefault(r.getAttribute('data-reset')); syncReset(el); setDirty(true); el.focus();
      });
      page.addEventListener('submit', function (e) {
        e.preventDefault();
        var out = {};
        $$('[data-key]', page).forEach(function (el) {
          var key = el.getAttribute('data-key'), v = cleanText(el.value, kinds[key]);
          if (v && v !== cleanText(textDefault(key), kinds[key])) out[key] = v;
        });
        var btn = $('button[type=submit]', page);
        btn.disabled = true;
        DB.saveSetting('texts', out).then(function () {
          setDirty(false);
          try { localStorage.setItem('midesign-texts', JSON.stringify(out)); } catch (err) {}
          btn.disabled = false;
          var n = Object.keys(out).length;
          ask({ title: '홈페이지에 반영했어요', text: n ? '고친 문구 <b>' + n + '곳</b>이 지금부터 홈페이지에 보여요.' : '모든 문구가 처음 문구로 돌아갔어요.', cancel: '닫기', ok: '홈페이지에서 확인하기' })
            .then(function (ok) { if (ok) window.open(siteUrl(''), '_blank', 'noopener'); });
        }).catch(function (err) {
          btn.disabled = false;
          ask({ title: '반영하지 못했어요', text: esc(friendlyError(err)) + '<br><br>고친 내용은 그대로 있어요.', cancel: false, ok: '확인' });
        });
      });
    }).catch(function (err) {
      app.innerHTML = '<div class="page"><div class="error-msg">' + esc(friendlyError(err)) + '</div><a class="btn btn-primary" href="#/">처음 화면으로</a></div>';
    });
  }

  /* ---------- 비밀번호 바꾸기 ---------- */
  var PW_MIN = 10;
  function viewPassword() {
    frame('비밀번호 바꾸기', true, 'settings');
    state.backTo = '#/settings';
    DB.session().then(function (s) {
      var email = (s && s.user && s.user.email) || store('admin-email') || '';
      var page = document.createElement('form');
      page.className = 'page pw-page';
      page.noValidate = true;
      function pwField(id, label, ac, hint) {
        return '<div class="field"><label for="' + id + '">' + label + '</label><div class="pw-wrap"><input class="input" id="' + id + '" type="password" autocomplete="' + ac + '" autocapitalize="off" spellcheck="false" required>' +
          '<button type="button" data-show="' + id + '">보기</button></div>' + (hint ? '<p class="hint">' + hint + '</p>' : '') + '</div>';
      }
      page.innerHTML =
        '<div class="tip">' + I.info + '<span>새 비밀번호는 <b>' + PW_MIN + '자 이상</b>, 다른 사이트에서 쓰지 않는 것으로 정해 주세요. 전화번호·생일처럼 남이 알 수 있는 숫자는 피하는 게 좋아요.</span></div>' +
        '<div class="txt-card pw-card">' +
        (email ? '<p class="pw-who">' + esc(email) + '</p>' : '') +
        '<input type="email" name="username" autocomplete="username" value="' + esc(email) + '" hidden>' +
        pwField('pw-now', '지금 비밀번호', 'current-password') +
        pwField('pw-new', '새 비밀번호', 'new-password', '예) 우리집 강아지 이름 + 좋아하는 숫자처럼, 나만 기억하기 쉬운 긴 말') +
        pwField('pw-new2', '새 비밀번호 한 번 더', 'new-password') +
        '<ul class="pw-checks" aria-live="polite">' +
        '<li data-c="len">' + I.check + PW_MIN + '자 이상</li>' +
        '<li data-c="diff">' + I.check + '지금 비밀번호와 다름</li>' +
        '<li data-c="same">' + I.check + '새 비밀번호 두 칸이 같음</li></ul>' +
        '</div>' +
        '<div class="savebar"><div class="msg" id="save-msg" hidden></div><button class="btn btn-primary" type="submit">' + I.key + '비밀번호 바꾸기</button></div>';
      app.innerHTML = '';
      app.appendChild(page);

      var now = $('#pw-now', page), nw = $('#pw-new', page), nw2 = $('#pw-new2', page), msg = $('#save-msg', page);
      function checks() {
        var c = { len: nw.value.length >= PW_MIN, diff: !!nw.value && nw.value !== now.value, same: !!nw2.value && nw.value === nw2.value };
        Object.keys(c).forEach(function (k) { $('[data-c="' + k + '"]', page).classList.toggle('ok', c[k]); });
        return c;
      }
      page.addEventListener('input', function () { checks(); msg.hidden = true; });
      page.addEventListener('click', function (e) {
        var b = e.target.closest('[data-show]'); if (!b) return;
        var f = $('#' + b.getAttribute('data-show'), page), show = f.type === 'password';
        f.type = show ? 'text' : 'password'; b.textContent = show ? '숨기기' : '보기';
      });
      function fail(t, el) { msg.textContent = t; msg.hidden = false; if (el) el.focus(); }
      page.addEventListener('submit', function (e) {
        e.preventDefault();
        var c = checks();
        if (!now.value) return fail('지금 쓰는 비밀번호를 넣어 주세요.', now);
        if (!c.len) return fail('새 비밀번호를 ' + PW_MIN + '자 이상으로 정해 주세요.', nw);
        if (!c.diff) return fail('지금 비밀번호와 다른 비밀번호로 정해 주세요.', nw);
        if (!c.same) return fail('새 비밀번호 두 칸이 서로 달라요. 다시 확인해 주세요.', nw2);
        var btn = $('button[type=submit]', page);
        btn.disabled = true; btn.lastChild.textContent = '바꾸는 중…';
        DB.changePassword(now.value, nw.value).then(function () {
          now.value = nw.value = nw2.value = '';
          return ask({ title: '비밀번호를 바꿨어요', text: '다음부터는 새 비밀번호로 들어오세요.<br>다른 휴대폰이나 컴퓨터에 로그인해 둔 곳은 로그아웃되니, 그곳에서는 새 비밀번호로 다시 로그인해 주세요.', cancel: false, ok: '확인' })
            .then(function () { leave('#/'); });
        }).catch(function (err) {
          btn.disabled = false; btn.lastChild.textContent = '비밀번호 바꾸기';
          fail(err.message, /지금 비밀번호/.test(err.message) ? now : nw);
        });
      });
      setTimeout(function () { now.focus(); }, 50);
    });
  }

  /* ---------- 사용 방법 ---------- */
  function viewHelp() {
    frame('사용 방법', true, 'help');
    app.innerHTML = '<div class="page help">' +
      '<section class="help-sec only-mouse"><h2>컴퓨터에서 쓰기</h2><div class="card"><ol>' +
      '<li>사진은 <b>사진 고르기</b>를 눌러 고르거나, 폴더에서 사진 파일을 <b>끌어다 놓아도</b> 돼요.</li>' +
      '<li>상담 신청의 <b>번호 복사</b>를 누르면 손님 전화번호가 복사돼요.</li>' +
      '<li>자주 쓰려면 이 화면에서 <b>Ctrl + D</b>(맥은 ⌘ + D)를 눌러 즐겨찾기에 넣어 두세요.</li>' +
      '<li>글씨가 작으면 <b>Ctrl 누른 채 +</b>, 크면 <b>Ctrl 누른 채 −</b>를 눌러요.</li></ol></div></section>' +
      '<section class="help-sec"><h2>첫 화면(홈)</h2><div class="card"><ol>' +
      '<li>새 상담이 있으면 맨 위에 <b>새 상담 신청이 n건 있어요</b>가 떠요. 그 아래 <b>바로 하기</b>(시공사례·후기 올리기, 견적서·계약서 만들기), <b>오늘·다가오는 일정</b>, <b>공사 중 현장 · 하자</b>, <b>진행 중인 계약</b>(서명 전·공사 전·공사 중), <b>견적서 현황</b>(진행 중·계약 완료·견적 중단, 답을 기다리는 견적)이 보여요.</li>' +
      '<li>줄을 누르면 그 서류로 바로 가요. <b>계약 완료</b>에는 서명한 뒤 공사를 기다리거나 공사 중인 계약이, <b>진행 중인 견적</b>에는 답을 기다리는 견적이 나와요. 나머지는 <b>모두 보기</b>에서 봐요. 보관 기간 지난 손님 정보가 있으면 맨 위에 알림이 떠요. 다른 메뉴에서 돌아올 때는 <b>메뉴 → 홈</b>.</li></ol></div></section>' +
      '<section class="help-sec"><h2>시공사례 올리기</h2><div class="card"><ol>' +
      '<li>첫 화면이나 <b>메뉴 → 시공사례</b>에서 <b>시공사례 올리기</b>를 눌러요.</li>' +
      '<li><b>사진 고르기</b>를 누르고 현장 사진을 여러 장 골라요.</li>' +
      '<li>제일 잘 나온 사진이 맨 앞에 오도록 <b>◀ ▶</b> 화살표로 순서를 바꿔요.</li>' +
      '<li>위쪽 <b>계약서·고객에서 불러오기</b>에서 계약서나 고객을 고르면 지역·평수·공사 내용·기간이 채워져요. 전화번호·동·호수는 넣지 않아요. (후기 올리기에서도 성함·현장을 불러올 수 있어요)</li>' +
      '<li><b>제목</b>을 쓰고, 아는 만큼만 현장 정보를 골라요.</li>' +
      '<li>설명 쓰기가 어려우면 몇 줄만 적고 <b>AI로 글 완성하기</b>를 눌러요. AI가 사진과 메모를 보고 제목·설명을 써 주고, 넣기 전에 먼저 보여 줘요.</li>' +
      '<li>맨 아래 <b>홈페이지에 올리기</b>를 누르면 끝이에요.</li></ol></div></section>' +
      '<section class="help-sec"><h2>상담 신청 확인하기</h2><div class="card"><ol>' +
      '<li>손님이 홈페이지에서 상담 신청서를 보내면 <b>메뉴 → 상담 신청</b> 목록에 쌓이고, 관리화면 첫 화면에 <b>새 상담 신청이 n건 있어요</b> 알림이 떠요(문자는 오지 않아요). 휴대폰은 오른쪽 위 <b>☰ 메뉴</b>, 컴퓨터는 왼쪽 메뉴예요.</li>' +
      '<li class="only-phone"><b>전화 걸기</b>를 누르면 바로 손님께 전화가 걸려요.</li>' +
      '<li class="only-pc"><b>번호 복사</b>를 누르면 손님 전화번호가 복사돼요. (전화 걸기 버튼은 휴대폰 화면에서만 보여요)</li>' +
      '<li>통화를 마치면 <b>상담 완료</b>를 눌러 두세요. 손님이 상담을 그만두기로 했으면 <b>상담 포기</b>를 눌러요. 잘못 눌렀으면 <b>상담 미완료로</b>를 누르면 새 상담으로 돌아가요.</li>' +
      '<li>바쁠 때는 <b>메뉴 → 설정 → 상담 경로</b>에서 <b>상담 신청 버튼 보이기</b>를 끄면 홈페이지에서 상담 신청 버튼이 잠시 사라져요. 전화번호·카카오톡 버튼도 같은 곳에서 따로 끄고 켤 수 있어요.</li></ol></div></section>' +
      '<section class="help-sec"><h2>손님 개인정보 지키기</h2><div class="card"><ol>' +
      '<li>통화를 마친 상담은 <b>상담 완료</b>(그만둔 상담은 <b>상담 포기</b>)를 눌러 주세요. 그 날부터 ' + esc((C.inquiry && C.inquiry.retention || '상담 종료 후 1년').replace(/^상담 종료 후\s*/, '')) + '이 보관 기간이에요. (둘 다 누르지 않은 신청은 신청한 날부터 계산해요)</li>' +
      '<li>손님 정보를 사진으로 찍거나 다른 사람에게 보내지 마세요. 필요하면 화면을 보며 바로 전화해요.</li>' +
      '<li>견적서는 마지막으로 고친 날부터 1년, 계약서·하자 기록은 공사를 마친 날부터 6년(계약하지 않고 중단한 계약서는 1년)이 보관 기간이에요. 기간이 지나면 첫 화면에 알림이 뜨니 <b>메뉴 → 설정 → 보관 기간 지난 자료</b>에서 확인하고 바로 지워 주세요. (자동으로 지우지 않아요)</li>' +
      '<li>다른 사람과 같이 쓰는 컴퓨터에서는 다 보고 나서 꼭 <b>로그아웃</b>을 눌러요.</li>' +
      '<li>비밀번호는 <b>메뉴 → 설정 → 비밀번호 바꾸기</b>에서 바꿀 수 있어요. 다른 곳과 다르게 10자 이상으로 정하고, 문자나 카톡으로 주고받지 마세요.</li>' +
      '<li>비밀번호를 잊어버리면 앤에게 알려 주세요. 새로 만들어 드려요.</li></ol></div></section>' +
      '<section class="help-sec"><h2>견적서 만들기</h2><div class="card"><ol>' +
      '<li><b>메뉴 → 견적서 → 새 견적서 만들기</b>를 눌러요. 상담 신청 카드의 <b>견적 내기</b>를 누르면 손님 정보가 미리 채워져요.</li>' +
      '<li><b>기본 정보</b>에서 손님·현장·유효기간·예상 시공기간을 적고, 아래에서 할 <b>공사 항목</b>을 골라요. 목록에 없으면 이름을 적고 <b>항목 추가</b>.</li>' +
      '<li><b>다음</b>을 누르면 공사 항목마다 한 장씩 넘어가요. <b>자주 쓰는 항목</b>을 누르거나 <b>항목 추가</b>로 줄을 만들고 수량·단가를 적으면 금액과 합계가 저절로 계산돼요.</li>' +
      '<li><b>마무리</b>에서 할인·부가세·외부 유출 금지 문구를 정하고, <b>미리보기·받기</b>에서 엑셀이나 워드 파일로 받거나 바로 인쇄해요.</li>' +
      '<li>단계를 넘길 때마다 저절로 저장돼요. 나중에 <b>견적서</b> 목록에서 다시 열어 고칠 수 있어요.</li>' +
      '<li>손님께 공사 항목별 합계만 보여 드리려면 <b>미리보기·받기</b>에서 <b>세부 내역 넣기</b>를 꺼요.</li>' +
      '<li>손님이 계약하지 않기로 했으면 목록에서 <b>견적 중단</b>을 눌러요. 위의 <b>진행 중 · 계약 완료 · 견적 중단</b>을 눌러 나눠 볼 수 있어요.</li></ol></div></section>' +
      '<section class="help-sec"><h2>3D 그림 만들기</h2><div class="card"><ol>' +
      '<li><b>메뉴 → 3D 그림</b>(설정 바로 위) <b>→ 견적서로 3D 그림 만들기</b>를 누르고 견적서를 골라요. 그 견적서의 공사 항목·자재·평수가 저절로 들어와요. 견적서는 그대로예요.</li>' +
      '<li><b>그림에 넣을 공사 내용</b>에서 그림과 상관없는 공사는 체크를 빼요. 오른쪽 <b>세부</b>를 누르면 세부 항목을 하나씩 넣고 뺄 수 있고, 항목마다 아래 칸에 색·마감(예: 화이트 무광)을 적거나 <b>색</b> 단추로 골라요. 견적서에 없는 내용(예: 거실 한쪽 벽 우드 포인트)은 <b>직접 넣을 내용</b>에 적어요.</li>' +
      '<li><b>도면 사진</b>을 올리고(주소·동호수는 가리고), 만들 공간과 분위기를 골라 <b>그림 만들기</b>를 눌러요. 한 장에 1~2분쯤 걸리고, 화면을 닫아도 계속 만들어요.</li>' +
      '<li>견적서를 고친 뒤 3D 그림을 다시 열면 바뀐 내용이 저절로 들어오고, 예전 내용으로 만든 그림에는 <b>예전 공사 내용</b>이 붙어요. <b>바뀐 내용으로 다시 만들기</b>를 누르면 새로 그려요.</li>' +
      '<li>그림은 AI가 그린 <b>예시</b>라 실제와 다를 수 있어요. 손님께 보낼 때는 <b>저장</b>을 눌러 휴대폰·컴퓨터에 받아서 보내요.</li></ol></div></section>' +
      '<section class="help-sec"><h2>찾기 · 전체 보기 · 여러 개 선택</h2><div class="card"><ol>' +
      '<li>상담 신청·견적서·계약서·고객 관리·시공사례·후기 목록 위 <b>찾기 상자</b>에서 골라요. 이름이나 전화번호 뒷자리, 아파트 이름은 칸에 적고, <b>지역</b>은 목록에서 고르고(지역이 안 적힌 것은 <b>지역 없음</b>으로 찾아요. 후기는 고른 시공사례의 지역이에요), <b>날짜</b>는 시작일·종료일을 달력에서 눌러요.</li>' +
      '<li><b>상태</b>는 여러 개를 같이 고를 수 있어요(예: 계약 완료 + 공사 완료). 아무것도 안 고르면 전부 보여요. <b>조건 모두 지우기</b>를 누르면 처음으로 돌아가요.</li>' +
      '<li><b>전체 보기</b>를 누르면 표처럼 한 줄씩 짧게 보여요. 컴퓨터에서는 화면 넓이를 다 써요. 칸 이름을 누르면 그 순서로 정렬되고, 줄을 누르면 열려요.</li>' +
      '<li><b>여러 개 선택</b>을 누르고 지울 것을 골라 한꺼번에 지울 수 있어요(카드·표 모두). 지운 것은 <b>설정 → 휴지통</b>에 30일 동안 보관돼서 되살릴 수 있어요.</li></ol></div></section>' +
      '<section class="help-sec"><h2>계약서 만들기·서명 받기</h2><div class="card"><ol>' +
      '<li>견적서 목록에서 <b>계약서 만들기</b>를 누르거나(만들던 계약서가 있으면 <b>계약서 이어 쓰기</b>), 견적서의 <b>미리보기·받기</b>에서 <b>이 견적서로 계약서 만들기</b>를 누르면 금액·공사 내역이 그대로 들어가요. <b>메뉴 → 계약서 → 새 계약서 만들기</b>로 시작해도 돼요.</li>' +
      '<li><b>계약서 종류</b>를 드롭다운에서 골라요. 처음에는 <b>카드 결제용</b>, <b>현금영수증용</b>, <b>현금 계좌이체용</b>이 있고, 고르면 그 종류의 조항·대금 비율·특약사항이 들어가요.</li>' +
      '<li>조항은 <b>계약서 설정 → 조항</b>에서 <b>표준 계약서</b>, <b>간단 v1</b>처럼 묶음으로 만들어 두고, <b>계약서 설정 → 계약서 종류</b>에서 종류마다 어떤 묶음을 쓸지 골라요. 카드·현금영수증·계좌이체 같은 <b>결제 방법 조항</b>은 종류마다 따로 정하면 ‘공사대금’ 조항 바로 뒤에 저절로 들어가요.</li>' +
      '<li>이 계약서에만 조항을 바꾸려면 <b>3. 조건</b>의 <b>계약서 조항 보기·고치기</b>를 열어 고치거나, 순서를 바꾸거나, 조항을 더하고 빼요.</li>' +
      '<li>착공일·준공일, 대금 지급 일정(계약금·중도금·잔금)을 적어요. <b>비율대로 나누기</b>를 누르면 금액이 저절로 나뉘어요.</li>' +
      '<li><b>세부 공사일정</b>에 철거 1일 → 전기 3일 → 청소 2일처럼 공정을 순서대로 넣으면 날짜가 저절로 이어지고, 일정 달력에 공정 이름으로 나와요. 서명한 뒤에도 고칠 수 있어요. 공정마다 처음 들어가는 기간은 <b>계약서 설정 → 공정·순서</b>에서 정해 둘 수 있어요(예: 도배 3일). 자주 하는 순서는 <b>지금 순서를 묶음으로 저장</b>해 두면 다음부터 <b>불러오기</b> 한 번으로 들어가요.</li>' +
      '<li>계약하지 않기로 했으면 계약서 목록에서 <b>중단</b>을 눌러요. 지우지 않고 남겨 두고, 달력에서는 빠져요.</li>' +
      '<li>서명한 계약을 깨기로 했으면 <b>계약 파기</b>를 눌러 파기한 날, <b>위약금</b>(없음 / 고객이 냄 / 업체가 냄)과 금액, 정산이 끝났는지, 사유를 적어요. 잘못 눌렀으면 <b>파기 내용</b> → <b>파기 취소</b>로 되돌려요.</li>' +
      '<li><b>4. 서명</b>에서 휴대폰·태블릿을 손님께 드리고 손가락으로 서명을 받아요. 종이에 인쇄해서 받아도 돼요.</li>' +
      '<li>서명을 마친 계약서는 열면 <b>보기 화면</b>(완료된 계약서와 고객 정보)이 먼저 나와요. 고치려면 아래 <b>수정</b>을 누르고, 내용은 <b>서명 지우고 고치기</b>를 누른 뒤 다시 서명을 받아요.</li>' +
      '<li>종이 계약서 사진·스캔본, 도면, 엑셀 같은 파일은 <b>첨부 파일 → 파일 올리기</b>로 계약서에 붙여 둬요(한 파일 20MB까지). 서명한 뒤에도 올릴 수 있고, 관리자만 볼 수 있어요.</li></ol></div></section>' +
      '<section class="help-sec"><h2>고객 관리·하자 접수</h2><div class="card"><ol>' +
      '<li>견적서·계약서를 저장하면 전화번호로 고객이 저절로 만들어져요. <b>메뉴 → 고객 관리</b>에서 이름이나 전화번호 뒷자리로 찾으면 이전 견적서·계약서가 같이 나와요.</li>' +
      '<li>하자 연락이 오면 고객을 찾아 <b>하자 접수</b>를 눌러 내용을 적어요.</li>' +
      '<li>현장에 가 볼 날, 고치러 갈 날을 적으면 <b>일정 달력</b>에 저절로 나와요. 다 고치면 <b>오늘 완료로 적기</b>를 누르고 저장해요.</li>' +
      '<li><b>전체 엑셀로 받기</b>를 누르면 고객·계약서·하자 기록이 엑셀 파일로 받아져요. 개인정보가 들어 있으니 다른 사람에게 보내지 마세요.</li></ol></div></section>' +
      '<section class="help-sec"><h2>일정 달력</h2><div class="card"><ol>' +
      '<li><b>메뉴 → 일정 달력</b>에서 날짜를 누르면 그날 일정이 아래에 나와요.</li>' +
      '<li>실측·방문, 상담 같은 일정은 <b>일정 추가</b>로 적어요. 창 맨 위 <b>견적서·계약서에서 불러오기</b>로 고르면 일정 이름·장소·고객이 채워져요.</li>' +
      '<li>계약서의 공사 기간(세부 공사일정이 있으면 공정 이름), 하자 현장 확인·보수 날짜, 상담 신청의 희망 상담일은 따로 적지 않아도 저절로 나와요.</li>' +
      '<li>공사일정을 누르거나 위의 <b>공사별로 보기</b>에서 공사를 고르면 <b>그 공사만 보이는 달력</b>이 나와요. 달력에서 날짜를 <b>눌러서 끌거나</b> 첫날과 끝날을 차례로 누른 뒤, 넣을 공정을 골라 <b>여기에 넣기</b> → <b>저장</b>.</li></ol></div></section>' +
      '<section class="help-sec"><h2>SNS 글 만들기 (인스타그램·쇼츠·블로그)</h2><div class="card"><ol>' +
      '<li><b>메뉴 → 시공사례</b>에서 카드의 <b>SNS 글</b>을 누르고 <b>인스타그램</b>, <b>유튜브 쇼츠</b>, <b>네이버 블로그</b> 중 하나를 고르면 AI가 사진과 내용을 보고 글을 써 줘요. (30초~1분)</li>' +
      '<li>인스타그램은 피드 글·해시태그와 <b>올릴 사진 순서</b>, 쇼츠는 <b>장면별 화면 글자·내레이션</b>과 제목·설명·태그가 나와요.</li>' +
      '<li>AI는 적어 준 내용과 사진에 보이는 것만 쓰도록 했지만, 올리기 전에 꼭 한 번 읽고 틀린 곳은 고쳐 주세요.</li>' +
      '<li><b>한꺼번에 복사</b>를 누르고 네이버 블로그 글쓰기 화면에 붙여 넣은 뒤, [사진 1] 자리에 1번 사진을 넣어요.</li>' +
      '<li>다 올렸으면 블로그 글 주소를 적어 두세요. 홈페이지 시공사례에 블로그 링크가 생겨요.</li></ol></div></section>' +
      '<section class="help-sec"><h2>홈페이지 문구 고치기</h2><div class="card"><ol>' +
      '<li><b>메뉴 → 설정 → 홈페이지 문구</b>를 눌러요.</li>' +
      '<li>바꾸고 싶은 칸의 글을 고쳐요. 메인 큰 제목, 상담 시간, 대표 인사말 등을 고칠 수 있어요.</li>' +
      '<li>맨 아래 <b>홈페이지에 반영하기</b>를 누르면 바로 바뀌어요. 잘못 고쳤으면 칸 아래 <b>처음 문구로</b>를 누르세요.</li></ol></div></section>' +
      '<section class="help-sec"><h2>고치거나 숨기기</h2><div class="card"><ol>' +
      '<li><b>메뉴</b>에서 <b>시공사례</b>나 <b>고객 후기</b> 목록을 고른 뒤 <b>고치기</b>를 누르면 내용과 사진을 바꿀 수 있어요.</li>' +
      '<li><b>숨기기</b>는 지우지 않고 홈페이지에서만 안 보이게 해요. 언제든 <b>보이기</b>로 되돌릴 수 있어요.</li>' +
      '<li>카드 오른쪽 위 <b>지우기</b>를 누르면 휴지통으로 가요(30일 안에 <b>설정 → 휴지통</b>에서 되살릴 수 있어요). 잠깐 안 보이게만 하려면 숨기기를 쓰세요.</li></ol></div></section>' +
      '<section class="help-sec only-touch"><h2>휴대폰 홈 화면에 아이콘 만들기</h2><div class="card">' +
      '<h3>갤럭시(삼성 인터넷)</h3><ol><li>오른쪽 아래 <b>≡ 메뉴</b>를 눌러요.</li><li><b>현재 페이지 추가</b> → <b>홈 화면</b>을 눌러요.</li></ol>' +
      '<h3>크롬</h3><ol><li>오른쪽 위 <b>⋮</b>를 눌러요.</li><li><b>홈 화면에 추가</b>를 눌러요.</li></ol>' +
      '<h3>아이폰(사파리)</h3><ol><li>아래쪽 <b>공유 버튼(네모에 화살표)</b>을 눌러요.</li><li><b>홈 화면에 추가</b>를 눌러요.</li></ol>' +
      '<p class="hint" style="margin-bottom:10px">휴대폰 기종이나 앱 버전에 따라 메뉴 이름이 조금 다를 수 있어요.</p></div></section>' +
      '<section class="help-sec"><h2>사진 잘 찍는 요령</h2><div class="card"><ol>' +
      '<li>불을 모두 켜고, 커튼을 열어 밝게 찍어요.</li>' +
      '<li>휴대폰을 <b>가로로</b> 들고, 방 모서리에서 방 전체가 보이게 찍어요.</li>' +
      '<li>공구·박스·쓰레기는 치우고 찍어요.</li>' +
      '<li>공사 전 사진이 있으면 함께 올리면 좋아요.</li></ol></div></section>' +
      (DB.live ? '' : '<section class="help-sec"><h2>데모 초기화</h2><div class="card"><p style="color:var(--ink-2);font-size:17px;margin-bottom:14px">데모에서 올리고 지운 내용을 처음 예시 상태로 되돌려요.</p><button class="btn btn-outline btn-sm" type="button" id="reset-demo" style="margin-bottom:12px">처음 상태로 되돌리기</button></div></section>') +
      '</div>';
    var rb = $('#reset-demo');
    if (rb) rb.addEventListener('click', function () {
      ask({ title: '데모를 처음 상태로 되돌릴까요?', text: '데모에서 올린 내용이 모두 사라져요.', cancel: '그만두기', ok: '되돌리기' }).then(function (ok) {
        if (ok) DB.resetDemo().then(function () { toast('처음 상태로 되돌렸어요'); leave('#/'); });
      });
    });
  }

  /* ---------- 다른 파일(견적서 등)에서 쓰는 도구 ---------- */
  function pad2(n) { return String(n).padStart(2, '0'); }
  function ymd(d) { d = d || new Date(); return d.getFullYear() + '-' + pad2(d.getMonth() + 1) + '-' + pad2(d.getDate()); }
  function addDays(iso, n) {
    var m = /^(\d{4})-(\d{2})-(\d{2})$/.exec(iso || ''); if (!m) return '';
    return ymd(new Date(+m[1], +m[2] - 1, +m[3] + (n || 0)));
  }
  function kDate(iso, withDay) {
    var m = /^(\d{4})-(\d{2})-(\d{2})$/.exec(iso || ''); if (!m) return '';
    return m[1] + '년 ' + (+m[2]) + '월 ' + (+m[3]) + '일' + (withDay ? '(' + '일월화수목금토'.charAt(new Date(+m[1], +m[2] - 1, +m[3]).getDay()) + ')' : '');
  }
  function sDate(iso) {   // '10월 28일(수)'
    var m = /^(\d{4})-(\d{2})-(\d{2})$/.exec(iso || ''); if (!m) return '';
    return (+m[2]) + '월 ' + (+m[3]) + '일(' + '일월화수목금토'.charAt(new Date(+m[1], +m[2] - 1, +m[3]).getDay()) + ')';
  }
  function num(v) { var n = parseFloat(String(v == null ? '' : v).replace(/[^0-9.\-]/g, '')); return isFinite(n) ? n : 0; }
  function won(n) { return Math.round(n || 0).toLocaleString('ko-KR'); }
  function digits(p) { return String(p || '').replace(/[^0-9]/g, ''); }
  // 파일 받기 (이름은 영문·숫자로 — 한글 이름은 일부 브라우저에서 'download'로 바뀜)
  function saveBlob(blob, name) {
    var url = URL.createObjectURL(blob), a = document.createElement('a');
    a.href = url; a.download = name; document.body.appendChild(a); a.click(); a.remove();
    setTimeout(function () { URL.revokeObjectURL(url); }, 60000);
  }
  /* ---------- 목록 찾기 (견적서·계약서): 이름·전화번호·아파트·날짜 + 날짜 범위 ---------- */
  function normS(x) { return String(x || '').toLowerCase().replace(/\s+/g, ''); }
  function findTokens(q) { return String(q || '').trim().split(/\s+/).filter(Boolean).map(normS); }
  // 날짜 하나를 여러 모양으로: 2026-10-25 · 2026.10.25 · 20261025 · 10/25 · 10.25 · 10월25일
  function dateKeys(iso) {
    var m = /^(\d{4})-(\d{2})-(\d{2})/.exec(iso || ''); if (!m) return '';
    var mo = +m[2], d = +m[3];
    return [m[1] + '-' + m[2] + '-' + m[3], m[1] + '.' + m[2] + '.' + m[3], m[1] + m[2] + m[3], mo + '/' + d, mo + '.' + d, m[2] + m[3], mo + '월' + d + '일', m[1] + '년' + mo + '월' + d + '일', m[1] + '년' + mo + '월'].join(' ');
  }
  function matchTokens(toks, phone, text) {
    var t = normS(text), pd = digits(phone);
    return toks.every(function (k) {
      if (/^[0-9-]+$/.test(k)) { var kd = digits(k); if (kd.length >= 3 && pd.indexOf(kd) >= 0) return true; }
      return t.indexOf(k) >= 0;
    });
  }
  /* 지역: 주소·지역 글에서 '시·도 시·군·구' 뽑기 (예: '경기도 의정부시 부용로…' → '경기 의정부시') */
  var PROV = {};
  [['서울', '서울시 서울특별시'], ['경기', '경기도'], ['인천', '인천시 인천광역시'], ['부산', '부산시 부산광역시'], ['대구', '대구시 대구광역시'], ['광주', '광주광역시'],
    ['대전', '대전시 대전광역시'], ['울산', '울산시 울산광역시'], ['세종', '세종시 세종특별자치시'], ['강원', '강원도 강원특별자치도'], ['충북', '충청북도'], ['충남', '충청남도'],
    ['전북', '전라북도 전북특별자치도'], ['전남', '전라남도'], ['경북', '경상북도'], ['경남', '경상남도'], ['제주', '제주도 제주특별자치도']].forEach(function (x) {
    PROV[x[0]] = x[0]; x[1].split(' ').forEach(function (n) { PROV[n] = x[0]; });
  });
  function regionOf(str) {
    var toks = String(str || '').replace(/[(),·]/g, ' ').split(/\s+/).filter(Boolean), prov = '', city = '';
    toks.forEach(function (t) {
      if (!prov && PROV[t]) { prov = PROV[t]; return; }
      if (!city && !PROV[t] && /^[가-힣]{1,6}(시|군|구)$/.test(t)) city = t;
    });
    if (!city) return prov;
    if (!prov) {
      var R = (C.inquiry && C.inquiry.regions) || {};
      Object.keys(R).some(function (pv) { if (R[pv].indexOf(city) >= 0) { prov = pv; return true; } return false; });
    }
    return prov ? prov + ' ' + city : city;
  }
  /* ---------- 단계 줄(견적서·계약서 1. 2. 3. …): 옆으로 넘기기 ----------
     휴대폰은 손가락으로 밀고, 좁은 창의 컴퓨터는 마우스 휠·끌기, 양쪽 끝 ‹ › 버튼으로도 넘길 수 있게.
     화면이 다시 그려질 때마다 새 단계 줄을 찾아 감싸고, 지금 단계가 가운데쯤 보이게 함 */
  function stepEdge(nav) {
    var box = nav.parentNode; if (!box || !box.classList.contains('steps-box')) return;
    var max = nav.scrollWidth - nav.clientWidth;
    box.classList.toggle('can-prev', nav.scrollLeft > 4);
    box.classList.toggle('can-next', max > 4 && nav.scrollLeft < max - 4);
  }
  function stepBars(root) {
    $$('.est-steps:not([data-sb])', root || document).forEach(function (nav) {
      nav.setAttribute('data-sb', '1');
      var box = document.createElement('div'); box.className = 'steps-box';
      nav.parentNode.insertBefore(box, nav); box.appendChild(nav);
      box.insertAdjacentHTML('beforeend', '<button type="button" class="sx prev" data-sx="-1" tabindex="-1" aria-label="앞 단계 더 보기">' + I.right + '</button>' +
        '<button type="button" class="sx next" data-sx="1" tabindex="-1" aria-label="뒤 단계 더 보기">' + I.right + '</button>');
      var on = $('.on', nav);
      if (on) nav.scrollLeft = Math.max(0, on.offsetLeft - (nav.clientWidth - on.offsetWidth) / 2);
      stepEdge(nav);
    });
  }
  new MutationObserver(function () { stepBars(app); }).observe(app, { childList: true, subtree: true });
  document.addEventListener('scroll', function (e) { var t = e.target; if (t && t.classList && t.classList.contains('est-steps')) stepEdge(t); }, true);
  window.addEventListener('resize', function () { $$('.steps-box > .est-steps').forEach(stepEdge); });
  document.addEventListener('click', function (e) {
    var b = e.target.closest && e.target.closest('[data-sx]'); if (!b) return;
    var nav = $('.est-steps', b.parentNode); if (!nav) return;
    nav.scrollBy({ left: +b.getAttribute('data-sx') * Math.max(120, nav.clientWidth * 0.7), behavior: 'smooth' });
  });
  // 마우스 휠(위아래)로도 옆으로
  document.addEventListener('wheel', function (e) {
    var nav = e.target.closest && e.target.closest('.est-steps'); if (!nav || nav.scrollWidth <= nav.clientWidth + 2) return;
    if (Math.abs(e.deltaY) <= Math.abs(e.deltaX)) return;
    nav.scrollLeft += e.deltaY; e.preventDefault();
  }, { passive: false });
  // 마우스로 끌어서 넘기기 (끌었을 때는 단계 버튼이 눌리지 않게)
  (function () {
    var drag = null, moved = false;
    document.addEventListener('pointerdown', function (e) {
      if (e.pointerType !== 'mouse' || e.button !== 0) return;
      var nav = e.target.closest && e.target.closest('.est-steps'); if (!nav || nav.scrollWidth <= nav.clientWidth + 2) return;
      drag = { nav: nav, x: e.clientX, left: nav.scrollLeft }; moved = false;
    });
    document.addEventListener('pointermove', function (e) {
      if (!drag) return;
      var dx = e.clientX - drag.x;
      if (!moved && Math.abs(dx) < 6) return;
      moved = true; drag.nav.classList.add('dragging'); drag.nav.scrollLeft = drag.left - dx;
    });
    document.addEventListener('pointerup', function () { if (drag) drag.nav.classList.remove('dragging'); drag = null; });
    document.addEventListener('click', function (e) { if (moved && e.target.closest && e.target.closest('.est-steps')) { e.preventDefault(); e.stopPropagation(); moved = false; } }, true);
  })();

  /* ---------- 지역 고르기 칸 (상담 신청서와 같은 시·도 → 시·군·구 드롭다운, '그 외 지역'은 직접 입력) ----------
     regionPick(id, value, o) → HTML. value 는 '경기 의정부시 ○○동 ○○아파트' 같은 글.
     o.detail = { ph } 를 주면 지역 뒤에 상세(동·아파트·호수) 칸도 같이 나옴.
     합친 값은 <input type="hidden" id="{id}"> 에 들어가고, 바뀔 때마다 그 칸에서 'input' 이벤트가 나와서
     각 화면의 저장 코드가 예전 글 칸처럼 그대로 읽습니다. o.bind 를 주면 data-bind 도 붙임(견적서). */
  function RGS() { return (C.inquiry && C.inquiry.regions) || {}; }
  // 상세 주소(동·호수)는 쉼표 뒤에: '경기 의정부시 ○○동 ○○아파트, 101동 1001호' → rest '○○동 ○○아파트', unit '101동 1001호'
  function splitRegion(str, regionOnly, noUnit) {   // noUnit: 쉼표를 상세 주소로 나누지 않음 (시공사례 위치·제목 같은 글)
    var RG = RGS(), s = String(str || '').trim().replace(/^그 외:\s*/, ''), unit = '', ci = regionOnly || noUnit ? -1 : s.indexOf(',');
    if (ci >= 0) { unit = s.slice(ci + 1).trim(); s = s.slice(0, ci).trim(); }
    var toks = s.split(/\s+/).filter(Boolean), sido = '', sgg = '', i = 0;
    if (toks.length) {
      var t0 = PROV[toks[0]] || toks[0];
      if (RG[t0]) { sido = t0; i = 1; if (toks[1] && RG[sido].indexOf(toks[1]) >= 0) { sgg = toks[1]; i = 2; } }
      else Object.keys(RG).some(function (pv) { if (RG[pv].indexOf(toks[0]) >= 0) { sido = pv; sgg = toks[0]; i = 1; return true; } return false; });
    }
    var rest = toks.slice(i).join(' ');
    // 목록에 없는 지역: 지역만 고르는 칸이면 '그 외 지역'에 글 그대로, 상세 칸이 있으면 상세 칸에 그대로
    if (!sido && s) return regionOnly ? { sido: 'etc', sgg: '', etc: s, rest: '', unit: '' } : { sido: '', sgg: '', etc: '', rest: s, unit: unit };
    return { sido: sido, sgg: sgg, etc: '', rest: rest, unit: unit };
  }
  // 현장 한 줄(관리화면 굵은 글씨): '경기 의정부시 ○○동 ○○아파트 24평, 101동 1001호' → '○○동 ○○아파트 101동 1001호 24평'
  // (아파트 이름 + 동·호수 + 평수 — 시·도 시·군·구는 뺌. 평수는 글 안에서 찾고, 없으면 size 로 받은 값)
  // 공사 기간: 계약서의 착공·준공일, 착공일이 비었으면 세부 공사일정(공정)의 처음 ~ 끝 (byPhase: true) — 없으면 null
  function workRange(k, doc) {
    k = k || {}; doc = doc || k.doc || {};
    var s = k.start_date || doc.start || '', e = k.end_date || doc.end || '';
    if (s) return { from: s, to: e && e >= s ? e : s, end: e, byPhase: false };
    var ph = (Array.isArray(k.phases) && k.phases.length ? k.phases : Array.isArray(doc.phases) ? doc.phases : []).filter(function (h) { return h && h.from; });
    if (!ph.length) return null;
    var f = ph.map(function (h) { return h.from; }).sort()[0], t = ph.map(function (h) { return h.to || h.from; }).sort().pop();
    return { from: f, to: t, end: t, byPhase: true };
  }
  /* ----- 찾아서 고르기 목록의 견적서·계약서(인테리어) 한 줄 모양 — 어느 찾기 창이든 같게 -----
     첫 줄: 현장 (아파트 + 평수, 동·호수)   둘째 줄: 품목(공사명) · 기간 · 고객 이름
     kind 'k' 계약서(기간 = 공사 기간, 착공일이 없으면 세부 공사일정) / 'e' 견적서(기간 = 견적 날짜)
     고객 목록은 고객 이름이 먼저 (이 함수를 쓰지 않음) */
  function dealItem(kind, x) {
    x = x || {};
    var md = function (d) { var m = /^\d{4}-(\d{2})-(\d{2})/.exec(d || ''); return m ? (+m[1]) + '/' + (+m[2]) : ''; };
    var site, period;
    if (kind === 'k') {
      site = x.site || '';
      var r = workRange(x);
      period = r ? '공사 ' + md(r.from) + (r.to && r.to !== r.from ? '~' + md(r.to) : '') : '공사 날짜 미정';
    } else {
      site = [x.region, x.site_name].filter(Boolean).join(' ') + (x.site_unit ? ', ' + x.site_unit : '');
      var d = x.estimate_date || String(x.created_at || '').slice(0, 10);
      period = d ? '견적 ' + md(d) : '';
    }
    var head = siteLabel(site, x.size || (x.doc && x.doc.size)) || site.trim();
    return { label: head || '현장 미정', sub: [x.title || '', period, x.customer_name || ''].filter(Boolean).join(' · ') };
  }
  /* ----- 손잡이(⋮⋮)를 잡고 끌어서 순서 바꾸기 (공사일정 화면의 공정 줄과 같은 움직임) -----
     sortable(root, { grip: '[data-…grip]', item: '.줄', done: function (box, order) {} })
     잡은 줄은 손가락·마우스를 따라오고, 나머지 줄은 빈자리를 만들며 비켜남. 놓으면 done(목록 상자, 새 순서[원래 번호…]) — 그대로면 부르지 않음
     ▲▼ 단추는 그대로 두고 함께 씀 (키보드·끌기 어려울 때) */
  var GRIP = '<svg viewBox="0 0 24 24" fill="currentColor"><circle cx="9" cy="6" r="1.6"/><circle cx="15" cy="6" r="1.6"/><circle cx="9" cy="12" r="1.6"/><circle cx="15" cy="12" r="1.6"/><circle cx="9" cy="18" r="1.6"/><circle cx="15" cy="18" r="1.6"/></svg>';
  /* ----- 자체 드롭다운 (휴대폰 기본 고르기 창 대신 화면 안에서 펼쳐지는 목록) -----
     K.dsel(id, items, value, { ph, labelledby }) → HTML. items: [{ v, t, sub }]
     고르면 숨은 칸 #id 의 값이 바뀌고 'change' 가 일어나서 <select> 를 쓰던 코드(el.id · el.value)를 그대로 씀 */
  function dsel(id, items, value, o) {
    o = o || {};
    var cur = items.filter(function (x) { return String(x.v) === String(value); })[0];
    return '<div class="dsel"><input type="hidden" id="' + esc(id) + '" value="' + esc(cur ? cur.v : '') + '">' +
      '<button type="button" class="select dsel-btn' + (cur ? '' : ' dsel-ph') + '" data-dselb aria-haspopup="listbox" aria-expanded="false"' + (o.labelledby ? ' aria-labelledby="' + esc(o.labelledby) + ' ' + esc(id) + '-v"' : '') + '>' +
      '<span class="dsel-v" id="' + esc(id) + '-v">' + esc(cur ? cur.t : (o.ph || '고르기')) + '</span></button>' +
      '<div class="dsel-pop" role="listbox" hidden>' + items.map(function (x) {
        var on = cur === x;
        return '<button type="button" role="option" class="dsel-opt' + (on ? ' on' : '') + '" data-dv="' + esc(x.v) + '" data-dt="' + esc(x.t) + '" aria-selected="' + on + '">' +
          '<span class="dsel-t">' + esc(x.t) + (x.sub ? '<small>' + esc(x.sub) + '</small>' : '') + '</span><span class="dsel-ck" aria-hidden="true">' + I.check + '</span></button>';
      }).join('') + '</div></div>';
  }
  function dselClose(box, focusBtn) {
    if (!box) return;
    var pop = box.querySelector('.dsel-pop'), btn = box.querySelector('.dsel-btn');
    pop.hidden = true; box.classList.remove('open', 'up'); btn.setAttribute('aria-expanded', 'false');
    if (focusBtn) btn.focus();
  }
  function dselOpen(box) {
    $$('.dsel.open').forEach(function (b) { if (b !== box) dselClose(b); });
    var pop = box.querySelector('.dsel-pop'), btn = box.querySelector('.dsel-btn');
    pop.hidden = false; box.classList.add('open'); btn.setAttribute('aria-expanded', 'true');
    // 아래 공간이 모자라면(저장 막대 등) 위로 펼침
    var r = btn.getBoundingClientRect(), h = pop.offsetHeight, bar = document.querySelector('.savebar:not([hidden])'), bottom = bar ? bar.getBoundingClientRect().top : window.innerHeight;
    if (r.bottom + h + 12 > bottom && r.top - h - 12 > 60) box.classList.add('up');
    else if (r.bottom + h + 12 > bottom) window.scrollBy(0, r.bottom + h + 16 - bottom);
    var on = pop.querySelector('.dsel-opt.on') || pop.querySelector('.dsel-opt'); if (on) on.focus({ preventScroll: true });
  }
  document.addEventListener('click', function (e) {
    var t = e.target, b, box;
    if ((b = t.closest('[data-dselb]'))) { box = b.closest('.dsel'); return box.classList.contains('open') ? dselClose(box) : dselOpen(box); }
    if ((b = t.closest('.dsel-opt'))) {
      box = b.closest('.dsel');
      var inp = box.querySelector('input[type=hidden]'), btn = box.querySelector('.dsel-btn'), v = b.getAttribute('data-dv');
      $$('.dsel-opt', box).forEach(function (x) { var on = x === b; x.classList.toggle('on', on); x.setAttribute('aria-selected', String(on)); });
      box.querySelector('.dsel-v').textContent = b.getAttribute('data-dt'); btn.classList.remove('dsel-ph');
      dselClose(box, true);
      inp.value = v; inp.dispatchEvent(new Event('change', { bubbles: true }));   // 같은 것을 다시 골라도 알림 (예: 묶음을 다시 적용)
      return;
    }
    $$('.dsel.open').forEach(function (x) { if (!x.contains(t)) dselClose(x); });   // 바깥을 누르면 닫기
  });
  document.addEventListener('keydown', function (e) {
    var box = e.target.closest && e.target.closest('.dsel'); if (!box) return;
    var opts = $$('.dsel-opt', box), i = opts.indexOf(document.activeElement);
    if (e.key === 'Escape' && box.classList.contains('open')) { e.preventDefault(); e.stopPropagation(); return dselClose(box, true); }
    if (e.key === 'ArrowDown' || e.key === 'ArrowUp') {
      e.preventDefault();
      if (!box.classList.contains('open')) return dselOpen(box);
      var n = opts[Math.max(0, Math.min(opts.length - 1, i + (e.key === 'ArrowDown' ? 1 : -1)))]; if (n) n.focus();
    }
    if (e.key === 'Tab' && box.classList.contains('open')) dselClose(box);
  }, true);

  function sortable(root, o) {
    var d = null;
    function layout(x) {   // 지금 끼울 자리(to)에 맞춰 다른 줄들을 옮겨 놓고, 잡은 줄이 들어갈 자리를 기억
      var order = x.items.map(function (y, i) { return i; }), top = x.rects[0].top;
      order.splice(x.from, 1); order.splice(x.to, 0, x.from);
      order.forEach(function (i) {
        if (i === x.from) x.slotTop = top; else x.items[i].style.transform = 'translateY(' + (top - x.rects[i].top) + 'px)';
        top += x.rects[i].h + x.gap;
      });
      return order;
    }
    function move(clientY) {
      d.y = clientY;
      var dy = clientY + window.scrollY - d.y0;
      if (Math.abs(dy) > 4) d.moved = true;
      d.it.style.transform = 'translateY(' + dy + 'px) scale(1.015)';
      var c = d.rects[d.from].top + dy + d.rects[d.from].h / 2, to = 0;
      d.rects.forEach(function (r, i) { if (i !== d.from && r.top + r.h / 2 < c) to++; });
      if (to !== d.to) { d.to = to; layout(d); }
    }
    function autoScroll() {   // 화면 끝에 가까이 가면 저절로 올리기·내리기 (가까울수록 빠르게)
      if (!d) return;
      var y = d.y, h = window.innerHeight, v = y < 100 ? -Math.ceil((100 - y) / 6) : y > h - 120 ? Math.ceil((y - (h - 120)) / 6) : 0;
      if (v) { window.scrollBy(0, v); move(y); }
      d.raf = requestAnimationFrame(autoScroll);
    }
    root.addEventListener('pointerdown', function (e) {
      var g = e.target.closest && e.target.closest(o.grip);
      if (!g || d || !root.contains(g) || (e.pointerType === 'mouse' && e.button !== 0)) return;
      var it = g.closest(o.item), box = it && it.parentNode; if (!it) return;
      var items = Array.prototype.filter.call(box.children, function (x) { return x.matches(o.item); });
      if (items.length < 2) return;
      e.preventDefault();
      if (document.activeElement && document.activeElement.blur && it.contains(document.activeElement)) document.activeElement.blur();
      var rects = items.map(function (x) { var r = x.getBoundingClientRect(); return { top: r.top + window.scrollY, h: r.height }; });
      d = { it: it, box: box, items: items, rects: rects, gap: rects[1].top - rects[0].top - rects[0].h,
        from: items.indexOf(it), to: items.indexOf(it), y0: e.clientY + window.scrollY, y: e.clientY, id: e.pointerId, moved: false };
      try { g.setPointerCapture(e.pointerId); } catch (er) {}
      it.classList.add('dragging'); box.classList.add('sorting');
      items.forEach(function (x) { x.style.transition = x === it ? 'box-shadow .15s ease' : 'transform .2s cubic-bezier(.2,.7,.3,1)'; });
      d.raf = requestAnimationFrame(autoScroll);
    });
    root.addEventListener('pointermove', function (e) { if (!d || e.pointerId !== d.id) return; e.preventDefault(); move(e.clientY); });
    function end(e, cancel) {
      if (!d || (e && e.pointerId !== d.id)) return;
      var x = d; d = null; cancelAnimationFrame(x.raf);
      var order = layout(x);
      var same = cancel || !x.moved || order.every(function (v, i) { return v === i; });
      // 잡은 줄을 들어갈 자리(취소면 제자리)로 미끄러지게 한 뒤 정리
      x.it.style.transition = 'transform .16s ease, box-shadow .16s ease';
      x.it.style.transform = 'translateY(' + ((same ? x.rects[x.from].top : x.slotTop) - x.rects[x.from].top) + 'px)';
      if (same) x.items.forEach(function (y) { if (y !== x.it) y.style.transform = ''; });
      setTimeout(function () {
        x.it.classList.remove('dragging'); x.box.classList.remove('sorting');
        x.items.forEach(function (y) { y.style.transform = ''; y.style.transition = ''; });
        if (!same) o.done(x.box, order);
      }, 170);
    }
    root.addEventListener('pointerup', function (e) { end(e, false); });
    root.addEventListener('pointercancel', function (e) { end(e, true); });
  }
  function siteLabel(str, size) {
    var s0 = String(str || '').trim(); if (!s0) return '';
    var re = /\s*(\d+(?:\.\d+)?)\s*평\s*$/, sp = splitRegion(s0), m = re.exec(sp.rest) || re.exec(s0);
    var py = m ? m[1] + '평' : String(size || '').trim() ? String(size).replace(/\s*평$/, '') + '평' : '';
    var name = String(sp.rest || '').replace(re, '').trim() || (sp.unit ? '' : s0.split(',')[0].replace(re, '').trim());
    if (!name && !sp.unit) return '';
    var base = [name, py].filter(Boolean).join(' ');   // '아파트 이름 + 평수, 동·호수': '○○아파트 24평, 101동 1001호'
    return sp.unit ? (name ? base + ', ' + sp.unit : sp.unit + (py ? ' ' + py : '')) : base;
  }
  // 관리화면 카드 제목: 공사명을 직접 적었으면 그대로, 비워 둬서 자동으로 생긴 공사명이면 '아파트 이름 + 동·호수 + 평수' (계약서·견적서 문서의 공사명은 그대로)
  // 공사명에서 현장(아파트 이름·평수·지역)과 겹치는 말을 빼고 공사 항목만: '○○아파트 24평 도배·장판·필름 공사' → '도배·장판·필름 공사'
  function workItems(title, site) {
    var st = String(site || '');
    return String(title || '').split(/\s+/).filter(function (w) { return w && !/^\d+(\.\d+)?평$/.test(w) && st.indexOf(w) < 0; }).join(' ');
  }
  // 현장 글에 동·호수가 없는데, 같은 아파트인 다른 주소(보통 고객 주소)에 동·호수가 있으면 그 동·호수를 붙여 줌 (보여 주기용 — 저장은 안 바꿈)
  function fillUnit(a, b) {
    var A = splitRegion(String(a || '')), B = splitRegion(String(b || ''));
    var nm = function (p) { return String(p.rest || '').replace(/\s*\d+(?:\.\d+)?\s*평\s*$/, '').trim(); };
    if (a && !A.unit && B.unit && nm(A) && nm(A) === nm(B)) return String(a).split(',')[0].trim() + ', ' + B.unit;
    return a;
  }
  // 공사명: 저장된 공사명 그대로 (비워 둔 것은 처음 규칙 — 견적서 '지역 + 건물 + 평수 + 인테리어 공사', 계약서 '공사 장소 + 인테리어 공사')
  // 카드 첫 줄의 현장 이름(아파트 이름 + 동·호수 + 평수)과는 따로 — 2026-10-26 대표님 요청으로 공사명에 카드 이름을 쓰지 않음
  function estTitle(e) { return (e && e.title) || '제목 없는 견적서'; }
  function ctrTitle(k) { return (k && k.title) || '제목 없는 계약서'; }
  function joinRegion(p) {
    var r = p.sido === 'etc' ? String(p.etc || '').trim() : p.sido ? p.sido + (p.sgg ? ' ' + p.sgg : '') : '';
    var base = [r, String(p.rest || '').trim()].filter(Boolean).join(' '), u = String(p.unit || '').replace(/,/g, ' ').trim();
    return u ? (base ? base + ', ' + u : u) : base;
  }
  function sggOptions(sido, sel) {
    var list = RGS()[sido] || [];
    return '<option value="">시·군·구</option>' + list.map(function (x) { return '<option' + (x === sel ? ' selected' : '') + '>' + esc(x) + '</option>'; }).join('');
  }
  function regionPick(id, value, o) {
    o = o || {};
    var p = splitRegion(value, !o.detail, !o.unit), RG = RGS();
    return '<div class="rg-pick' + (o.detail ? ' has-detail' : '') + '" data-rg>' +
      '<input type="hidden" id="' + id + '"' + (o.bind ? ' data-bind="' + o.bind + '"' : '') + ' value="' + esc(joinRegion(p)) + '">' +
      '<div class="rg-row">' +
      '<select class="select" id="' + id + '-sido" data-rg-sido aria-label="시·도"><option value="">시·도</option>' +
      Object.keys(RG).map(function (k) { return '<option' + (k === p.sido ? ' selected' : '') + '>' + esc(k) + '</option>'; }).join('') +
      '<option value="etc"' + (p.sido === 'etc' ? ' selected' : '') + '>그 외 지역</option></select>' +
      '<select class="select" data-rg-sgg aria-label="시·군·구"' + (p.sido && p.sido !== 'etc' ? '' : ' disabled') + (p.sido === 'etc' ? ' hidden' : '') + '>' + sggOptions(p.sido, p.sgg) + '</select>' +
      '<input class="input" data-rg-etc maxlength="40" placeholder="예) 강원 춘천시" aria-label="지역 직접 쓰기" value="' + esc(p.etc) + '"' + (p.sido === 'etc' ? '' : ' hidden') + '>' +
      '</div>' +
      (o.detail ? (o.unit ? '<div class="rg-row2">' : '') + '<input class="input" data-rg-rest maxlength="' + (o.detail.max || 100) + '" placeholder="' + esc(o.detail.ph || '동 · 아파트 이름') + '" aria-label="' + esc(o.detail.label || '동네 · 아파트 이름') + '" value="' + esc(p.rest) + '">' +
        // 상세 주소(동·호수) — 따로 적어 두면 홈페이지에 올리는 시공사례·후기로 불러올 때 빠짐
        (o.unit ? '<input class="input" data-rg-unit maxlength="40" placeholder="' + esc(o.unit.ph || '101동 1001호') + '" aria-label="' + esc(o.unit.label || '상세 주소 (동·호수)') + '" value="' + esc(p.unit) + '"></div>' : '') : '') +
      '</div>';
  }
  function regionSync(box, focusEtc) {
    var sido = $('[data-rg-sido]', box), sgg = $('[data-rg-sgg]', box), etc = $('[data-rg-etc]', box), rest = $('[data-rg-rest]', box), unit = $('[data-rg-unit]', box), hid = $('input[type=hidden]', box);
    var v = joinRegion({ sido: sido.value, sgg: sgg.value, etc: etc.value, rest: rest ? rest.value : '', unit: unit ? unit.value : '' });
    if (hid.value === v) return;
    hid.value = v;
    hid.dispatchEvent(new Event('input', { bubbles: true }));
  }
  document.addEventListener('change', function (e) {
    var t = e.target, box = t.closest && t.closest('[data-rg]'); if (!box) return;
    if (t.hasAttribute('data-rg-sido')) {
      var sgg = $('[data-rg-sgg]', box), etc = $('[data-rg-etc]', box);
      sgg.innerHTML = sggOptions(t.value, ''); sgg.disabled = !t.value || t.value === 'etc';
      sgg.hidden = t.value === 'etc'; etc.hidden = t.value !== 'etc';
      if (t.value === 'etc') setTimeout(function () { etc.focus(); }, 0);
    }
    regionSync(box);
  }, true);
  document.addEventListener('input', function (e) {
    var t = e.target; if (!t.hasAttribute || !(t.hasAttribute('data-rg-etc') || t.hasAttribute('data-rg-rest') || t.hasAttribute('data-rg-unit'))) return;
    regionSync(t.closest('[data-rg]'));
  }, true);

  var NO_REGION = '__none__';   // 지역을 알 수 없는 것만 보기
  function regionSelect(id, regions, sel) {
    var order = Object.keys((C.inquiry && C.inquiry.regions) || {}), groups = {}, total = {}, none = 0;
    regions.forEach(function (r) {
      if (!r) { none++; return; }
      var sp = r.indexOf(' '), pv = sp > 0 ? r.slice(0, sp) : (PROV[r] ? r : '기타'), city = sp > 0 ? r.slice(sp + 1) : (PROV[r] ? '' : r);
      total[pv] = (total[pv] || 0) + 1;
      if (city) { groups[pv] = groups[pv] || {}; groups[pv][city] = (groups[pv][city] || 0) + 1; }
    });
    var pvs = Object.keys(total).sort(function (a, b) { var x = order.indexOf(a), y = order.indexOf(b); return (x < 0 ? 99 : x) - (y < 0 ? 99 : y) || a.localeCompare(b, 'ko'); });
    if (!pvs.length) return '';
    var o = '<option value="">전체 지역</option>', has = !sel;
    pvs.forEach(function (pv) {
      var cities = Object.keys(groups[pv] || {}).sort(function (a, b) { return a.localeCompare(b, 'ko'); });
      o += '<optgroup label="' + esc(pv) + '">';
      if (pv !== '기타') { o += '<option value="' + esc(pv) + '"' + (sel === pv ? ' selected' : '') + '>' + esc(pv) + ' 전체 (' + total[pv] + ')</option>'; if (sel === pv) has = true; }
      cities.forEach(function (c) { var v = pv === '기타' ? c : pv + ' ' + c; if (sel === v) has = true; o += '<option value="' + esc(v) + '"' + (sel === v ? ' selected' : '') + '>' + esc(c) + ' (' + groups[pv][c] + ')</option>'; });
      o += '</optgroup>';
    });
    if (none || sel === NO_REGION) { o += '<option value="' + NO_REGION + '"' + (sel === NO_REGION ? ' selected' : '') + '>지역 없음 (' + none + ')</option>'; if (sel === NO_REGION) has = true; }
    if (!has) o += '<option value="' + esc(sel) + '" selected>' + esc(sel) + ' (0)</option>';
    return '<select class="select" id="' + id + '" data-freg>' + o + '</select>';
  }

  /* ---------- 목록 찾기 (상담 신청·견적서·계약서·고객·시공사례·후기)
     찾기 칸(이름·전화번호·아파트) + 지역(드롭다운) + 날짜(시작일~종료일, 달력) + 상태(여러 개 고르기)
     o = { ph, dateLabel, regions: [지역…], statuses: [[값, 이름, 개수]], def: [처음에 골라 둘 상태] } ---------- */
  /* 목록마다 처음 골라 둘 상태 — 설정 → 목록 처음 보기 (관리자 전용 저장소 list_defaults, 모든 기기에 같게) */
  var LIST_DEFS = [
    { key: 'inqF', title: '상담 신청', opts: [['new', '새 상담'], ['done', '상담 완료'], ['dropped', '상담 포기']], def: ['new'] },
    { key: 'estF', title: '견적서', opts: [['open', '진행 중'], ['won', '계약 완료'], ['stopped', '견적 중단']], def: [] },
    { key: 'ctrF', title: '계약서', opts: [['draft', '작성 중'], ['signed', '계약 완료'], ['done', '공사 완료'], ['canceled', '계약 중단'], ['terminated', '계약 파기']], def: [] },
    { key: 'custF', title: '고객 관리', opts: [['work', '공사 중'], ['defect', '하자 처리 중'], ['contract', '계약 완료'], ['estimate', '견적 완료']], def: [] },
    { key: 'workF', title: '시공사례', opts: [['pub', '공개 중'], ['hid', '숨김'], ['main', '메인에 크게'], ['blog', '블로그 연결']], def: [] },
    { key: 'revF', title: '고객 후기', opts: [['pub', '공개 중'], ['hid', '숨김']], def: [] },
  ];
  function listDef(key, fallback) { var d = state.listDefs && state.listDefs[key]; return (Array.isArray(d) ? d : fallback || []).slice(); }
  function loadListDefs() {
    if (state.listDefs) return Promise.resolve();
    var p = DB.getAdminSetting ? DB.getAdminSetting('list_defaults').catch(function () { return null; }) : Promise.resolve(null);
    return Promise.race([p, new Promise(function (r) { setTimeout(function () { r(null); }, 2500); })])
      .then(function (v) { if (!state.listDefs) state.listDefs = v && typeof v === 'object' ? v : {}; });
  }
  function filterState(key, def) {
    var st = state[key];
    if (!st || !st.v2) { def = listDef(key, def); st = state[key] = { v2: 1, q: '', reg: '', from: '', to: '', st: def.slice(), def: def.slice() }; }
    return st;
  }
  function filterHtml(key, o) {
    var st = filterState(key, o.def), rs = o.regions ? regionSelect(key + '-reg', o.regions, st.reg) : '';
    return '<div class="fbar" role="search" aria-label="찾기">' +
      '<div class="cust-search fbar-q"><label class="sr-only" for="' + key + '-q">찾기</label>' +
      '<input class="input" id="' + key + '-q" type="search" inputmode="search" autocomplete="off" placeholder="' + esc(o.ph) + '" value="' + esc(st.q) + '"></div>' +
      '<div class="fbar-grid">' +
      (rs ? '<div class="field fbar-region"><label for="' + key + '-reg">지역</label>' + rs + '</div>' : '') +
      (o.dateLabel ? '<div class="field fbar-dates"><span class="label">' + esc(o.dateLabel) + '</span><div class="fbar-drow">' +
        '<div><label class="sr-only" for="' + key + '-from">시작일</label><input class="input" type="date" id="' + key + '-from" data-short data-ph="시작일" data-label="' + esc(o.dateLabel) + ' 시작일" value="' + esc(st.from) + '"></div>' +
        '<span class="tilde" aria-hidden="true">~</span>' +
        '<div><label class="sr-only" for="' + key + '-to">종료일</label><input class="input" type="date" id="' + key + '-to" data-short data-ph="종료일" data-label="' + esc(o.dateLabel) + ' 종료일" data-min-from="' + key + '-from" value="' + esc(st.to) + '"></div>' +
        '</div></div>' : '') +
      // 상태: 지역처럼 한 줄 — 누르면 아래로 펼쳐지는 체크 목록에서 여러 개 고르기 (2026-10-25 대표님 요청: 칩이 두세 줄로 늘어나지 않게)
      (o.statuses && o.statuses.length ? '<div class="field fbar-stf"><span class="label" id="' + key + '-st-l">상태</span><div class="msel">' +
        '<button type="button" class="select msel-btn" data-msel aria-haspopup="true" aria-expanded="false" aria-labelledby="' + key + '-st-l ' + key + '-st-v"><span class="msel-v" id="' + key + '-st-v">' + esc(stText(st.st, o.statuses)) + '</span></button>' +
        '<div class="msel-pop" role="group" aria-label="상태 고르기" hidden>' + o.statuses.map(function (x) {
          return '<label class="msel-opt"><input type="checkbox" data-fst="' + esc(x[0]) + '" data-fname="' + esc(x[1]) + '"' + (st.st.indexOf(x[0]) >= 0 ? ' checked' : '') + '><span>' + esc(x[1]) + '</span></label>';
        }).join('') + '<div class="msel-foot"><button type="button" class="btn-link" data-fstall>모두 보기</button><button type="button" class="btn btn-primary btn-sm" data-mselx>닫기</button></div></div></div>' +
        // PC(넓은 화면)에서는 드롭다운 대신 상태 상자를 한 줄로 늘어놓고 눌러서 고르기 (휴대폰은 위 드롭다운) — CSS로 하나만 보임
        '<div class="fst-row" role="group" aria-labelledby="' + key + '-st-l">' +
        '<button type="button" class="fst-chip fst-all" data-fstall aria-pressed="' + String(!st.st.length || st.st.length === o.statuses.length) + '">' + I.check + '<span>전체</span></button>' +
        o.statuses.map(function (x) {
          return '<label class="fst-chip"><input type="checkbox" class="sr-only" data-fst="' + esc(x[0]) + '" data-fname="' + esc(x[1]) + '"' + (st.st.indexOf(x[0]) >= 0 ? ' checked' : '') + '>' + I.check +
            '<span>' + esc(x[1]) + '</span>' + (typeof x[2] === 'number' ? '<em>' + x[2] + '</em>' : '') + '</label>';
        }).join('') + '</div></div>' : '') + '</div>' +
      '<div class="fbar-foot"><button type="button" class="btn-link" data-freset' + (filterChanged(key) ? '' : ' hidden') + '>조건 모두 지우기</button></div></div>';
  }
  // 상태 칸에 보일 글: 안 골랐거나 다 골랐으면 '전체', 두 개까지는 이름, 더 많으면 '○○ 외 n'
  function stText(sel, statuses) {
    var names = statuses.filter(function (x) { return sel.indexOf(x[0]) >= 0; }).map(function (x) { return x[1]; });
    if (!names.length || names.length === statuses.length) return '전체';
    return names.length <= 2 ? names.join(', ') : names[0] + ' 외 ' + (names.length - 1);
  }
  // 새로 올린 뒤 목록으로 돌아가면 방금 올린 것이 보이도록 찾기 조건을 처음으로
  function filterReset(key) {
    var st = state[key]; if (!st || !st.v2) return;
    st.q = ''; st.reg = ''; st.from = ''; st.to = ''; st.st = st.def.slice();
  }
  function filterChanged(key) {
    var st = state[key]; if (!st) return false;
    return !!(String(st.q || '').trim() || st.reg || st.from || st.to || st.st.slice().sort().join() !== st.def.slice().sort().join());
  }
  function filterBind(page, key, redraw) {
    var st = state[key], t;
    function after() { var r = $('[data-freset]', page); if (r) r.hidden = !filterChanged(key); redraw(); }
    var q = $('#' + key + '-q', page), reg = $('#' + key + '-reg', page), f = $('#' + key + '-from', page), to = $('#' + key + '-to', page);
    if (q) q.addEventListener('input', function () { st.q = q.value; clearTimeout(t); t = setTimeout(after, 150); });
    if (reg) reg.addEventListener('change', function () { st.reg = reg.value; after(); });
    function dates() { st.from = f.value; st.to = to.value; if (st.from && st.to && st.to < st.from) { st.to = st.from; to.value = st.from; } after(); }
    if (f) f.addEventListener('change', dates);
    if (to) to.addEventListener('change', dates);
    // 상태 체크 목록
    var pop = $('.msel-pop', page), mbtn = $('[data-msel]', page);
    function stSync() {
      $$('[data-fst]', page).forEach(function (b) { b.checked = st.st.indexOf(b.getAttribute('data-fst')) >= 0; });
      var opts = pop ? $$('[data-fst]', pop) : [];
      var v = $('#' + key + '-st-v', page);
      if (v) v.textContent = stText(st.st, opts.map(function (b) { return [b.getAttribute('data-fst'), b.getAttribute('data-fname')]; }));
      var all = $('.fst-all', page); if (all) all.setAttribute('aria-pressed', String(!st.st.length || st.st.length === opts.length));
    }
    function popShow(on) {
      if (!pop) return;
      pop.hidden = !on; mbtn.setAttribute('aria-expanded', String(on));
      if (on) { var first = $('[data-fst]', pop); if (first && window.matchMedia && matchMedia('(hover: hover) and (pointer: fine)').matches) first.focus(); }
    }
    function outside(e) {
      if (!page.isConnected) return document.removeEventListener('click', outside, true);
      if (pop && !pop.hidden && !e.target.closest('.msel')) popShow(false);
    }
    document.addEventListener('click', outside, true);
    page.addEventListener('keydown', function (e) { if (e.key === 'Escape' && pop && !pop.hidden) { popShow(false); mbtn.focus(); } });
    page.addEventListener('focusin', function (e) { if (pop && !pop.hidden && !e.target.closest('.msel')) popShow(false); });   // 다른 칸으로 옮기면 닫기
    page.addEventListener('change', function (e) {
      var x = e.target.closest && e.target.closest('[data-fst]');
      if (!x || !page.contains(x)) return;
      var v = x.getAttribute('data-fst'), i = st.st.indexOf(v);
      if (x.checked && i < 0) st.st.push(v); else if (!x.checked && i >= 0) st.st.splice(i, 1);
      stSync(); after();
    });
    page.addEventListener('click', function (e) {
      if (e.target.closest('[data-msel]')) return popShow(pop.hidden);
      if (e.target.closest('[data-mselx]')) { popShow(false); return mbtn.focus(); }
      if (e.target.closest('[data-fstall]')) { st.st = []; stSync(); return after(); }
      if (e.target.closest('[data-freset]')) {
        st.q = ''; st.reg = ''; st.from = ''; st.to = ''; st.st = st.def.slice();
        if (q) q.value = ''; if (reg) reg.value = ''; if (f) f.value = ''; if (to) to.value = '';
        stSync(); popShow(false);
        after();
      }
    });
  }
  // rec: { text, phone, region, date(대표 날짜), dates(찾기에 같이 쓰는 날짜들), status(값 또는 [값…]) }
  function filterMatch(key, rec) {
    var st = state[key]; if (!st) return true;
    if (st.st.length) { var ss = [].concat(rec.status == null ? [] : rec.status); if (!ss.some(function (v) { return st.st.indexOf(v) >= 0; })) return false; }
    if (st.reg === NO_REGION) { if (rec.region) return false; }
    else if (st.reg) { var r = rec.region || ''; if (!(r === st.reg || r.indexOf(st.reg + ' ') === 0)) return false; }
    var ds = (rec.dates || [rec.date]).filter(Boolean);
    if (st.from || st.to) { if (!ds.some(function (d) { return (!st.from || d >= st.from) && (!st.to || d <= st.to); })) return false; }
    var toks = findTokens(st.q);
    if (!toks.length) return true;
    return matchTokens(toks, rec.phone, [rec.text, rec.region].concat(ds.map(dateKeys)).join(' '));
  }
  function filterActive(key) { return filterChanged(key); }

  /* ---------- 전체 보기: 카드 대신 한눈에 보는 표 (고객·견적서·계약서) ----------
     cols: [{ label, html(row) → 칸 내용(HTML), sort(row) → 정렬 값, cls }] · 줄을 누르면 href(row) 로 이동 */
  function viewMode(key) { state.views = state.views || {}; return state.views[key] || 'card'; }
  function viewToggle(key) {
    var t = viewMode(key) === 'table';
    return '<button type="button" class="btn btn-outline btn-sm view-toggle" data-vt="' + key + '" aria-pressed="' + t + '">' + (t ? I.doc + '<span>카드로 보기</span>' : I.list + '<span>전체 보기</span>') + '</button>';
  }
  // idOf(row) 를 주면 '여러 개 지우기' 때 줄마다 고르는 칸이 생김
  function dataTable(key, cols, rows, href, idOf) {
    var st = (state.dtSort = state.dtSort || {})[key] || { col: -1, dir: 1 };
    var list = rows.slice();
    if (st.col >= 0 && cols[st.col] && cols[st.col].sort) {
      var f = cols[st.col].sort;
      list.sort(function (a, b) { var x = f(a), y = f(b); return (x > y ? 1 : x < y ? -1 : 0) * st.dir; });
    }
    setTimeout(dtEdges, 0);   // 그린 뒤 오른쪽에 더 있는지 표시
    return '<div class="dt-box"><div class="dt-wrap" role="region" aria-label="전체 목록 (옆으로 밀어 보기)" tabindex="0"><table class="dt"><thead><tr>' + (idOf ? '<th class="bt-pick"><span class="sr-only">고르기</span></th>' : '') + cols.map(function (c, i) {
      var on = st.col === i;
      return '<th' + (c.cls ? ' class="' + c.cls + '"' : '') + (on ? ' aria-sort="' + (st.dir > 0 ? 'ascending' : 'descending') + '"' : '') + '>' +
        (c.sort ? '<button type="button" data-dts="' + key + ':' + i + '">' + esc(c.label) + '<i>' + (on ? (st.dir > 0 ? '▲' : '▼') : '↕') + '</i></button>' : esc(c.label)) + '</th>';
    }).join('') + '</tr></thead><tbody>' + list.map(function (r) {
      return '<tr data-href="' + esc(href(r)) + '" tabindex="0">' + (idOf ? '<td class="bt-pick"><label class="bulk-pick-t"><input type="checkbox" data-bid="' + esc(idOf(r)) + '" aria-label="고르기"></label></td>' : '') + cols.map(function (c) { return '<td' + (c.cls ? ' class="' + c.cls + '"' : '') + '>' + c.html(r) + '</td>'; }).join('') + '</tr>';
    }).join('') + '</tbody></table></div></div>';
  }
  // 표 오른쪽에 아직 안 보이는 칸이 있으면 오른쪽 끝을 흐리게 (옆으로 밀어 보라는 표시)
  function dtEdges() {
    $$('.dt-box').forEach(function (b) { var w = b.firstChild; if (w) b.classList.toggle('more-r', w.scrollLeft + w.clientWidth < w.scrollWidth - 2); });
  }
  document.addEventListener('scroll', function (e) { if (e.target && e.target.classList && e.target.classList.contains('dt-wrap')) dtEdges(); }, true);
  window.addEventListener('resize', dtEdges);
  // 보기 바꾸기·정렬·줄 누르기 (한 번만 연결)
  function dataTableBind(page, redraw, onMode) {
    page.addEventListener('click', function (e) {
      var x;
      if ((x = e.target.closest('[data-vt]'))) {
        var k = x.getAttribute('data-vt'); state.views = state.views || {};
        state.views[k] = viewMode(k) === 'table' ? 'card' : 'table';
        x.outerHTML = viewToggle(k); if (onMode) onMode(state.views[k]); return redraw();
      }
      if ((x = e.target.closest('[data-dts]'))) {
        var p = x.getAttribute('data-dts').split(':'), sk = (state.dtSort = state.dtSort || {}), cur = sk[p[0]] || { col: -1, dir: 1 };
        sk[p[0]] = { col: +p[1], dir: cur.col === +p[1] ? -cur.dir : 1 }; return redraw();
      }
      if (e.target.closest('tr[data-href] button, tr[data-href] a')) return;   // 줄 안의 단추(SNS 글 등)는 줄 열기와 따로
      if ((x = e.target.closest('tr[data-href]')) && !page.classList.contains('bulk-on')) go(x.getAttribute('data-href'));
    });
    page.addEventListener('keydown', function (e) { var tr = e.target.closest && e.target.closest('tr[data-href]'); if (tr && e.target === tr && (e.key === 'Enter' || e.key === ' ')) { e.preventDefault(); go(tr.getAttribute('data-href')); } });
  }

  /* ---------- 여러 개 골라서 한꺼번에 지우기 (견적서·계약서) ----------
     카드마다 <label class="bulk-pick"><input type="checkbox" data-bid="id"></label> 를 넣어 두면 됩니다. */
  function bulk(o) {
    var on = false, picked = {}, page = o.page;
    var btn = document.createElement('button');
    btn.type = 'button'; btn.className = 'btn btn-outline btn-sm bulk-toggle'; btn.setAttribute('aria-pressed', 'false');
    btn.innerHTML = I.check + '<span>여러 개 선택</span>';
    o.host.appendChild(btn);
    var bar = document.createElement('div');
    bar.className = 'bulk-bar'; bar.hidden = true; bar.setAttribute('role', 'region'); bar.setAttribute('aria-label', '고른 ' + o.noun);
    page.appendChild(bar);
    function shown() { return $$('[data-bid]', page).map(function (x) { return x.getAttribute('data-bid'); }); }
    function ids() { return Object.keys(picked).filter(function (k) { return picked[k]; }); }
    function sync() {
      if (!on) return;
      var vis = shown();
      Object.keys(picked).forEach(function (k) { if (vis.indexOf(k) < 0) delete picked[k]; });   // 골라 보기를 바꾸면 안 보이는 건 풀기
      $$('[data-bid]', page).forEach(function (cb) { cb.checked = !!picked[cb.getAttribute('data-bid')]; var it = cb.closest('.item, tr'); if (it) it.classList.toggle('picked', cb.checked); });
      var n = ids().length, all = vis.length && vis.every(function (id) { return picked[id]; });
      bar.innerHTML = '<span class="bulk-n"><b>' + n + '</b>개 선택</span>' +
        '<button type="button" class="btn btn-outline btn-sm" data-ball' + (vis.length ? '' : ' disabled') + '>' + (all ? '모두 풀기' : '보이는 것 모두 선택') + '</button>' +
        '<button type="button" class="btn btn-danger btn-sm" data-bdel' + (n ? '' : ' disabled') + '>' + I.trash + '<span>지우기</span></button>';
    }
    function set(v) {
      on = v; picked = {};
      page.classList.toggle('bulk-on', on); bar.hidden = !on;
      btn.setAttribute('aria-pressed', String(on));
      btn.innerHTML = on ? I.close + '<span>선택 끝</span>' : I.check + '<span>여러 개 선택</span>';
      sync();
    }
    btn.addEventListener('click', function () { set(!on); });
    // 고르는 중에는 카드를 누르면 열리지 않고 골라짐
    page.addEventListener('click', function (e) {
      if (!on) return;
      var it = e.target.closest('.items > .item, .dt tbody tr'); if (!it || !page.contains(it)) return;
      var cb = $('[data-bid]', it); if (!cb) return;
      if (e.target.closest('.bulk-pick, .bulk-pick-t')) return;
      e.preventDefault(); e.stopPropagation();
      cb.checked = !cb.checked; picked[cb.getAttribute('data-bid')] = cb.checked; sync();
    }, true);
    page.addEventListener('change', function (e) { if (e.target.hasAttribute && e.target.hasAttribute('data-bid')) { picked[e.target.getAttribute('data-bid')] = e.target.checked; sync(); } });
    bar.addEventListener('click', function (e) {
      if (e.target.closest('[data-ball]')) {
        var vis = shown(), all = vis.every(function (id) { return picked[id]; });
        vis.forEach(function (id) { picked[id] = !all; }); return sync();
      }
      if (!e.target.closest('[data-bdel]')) return;
      var list = ids(); if (!list.length) return;
      ask({ title: o.noun + ' ' + list.length + '개를 지울까요?', text: '휴지통에 <b>30일</b> 동안 보관돼서 그동안은 <b>설정 → 휴지통</b>에서 되살릴 수 있어요.' + (o.warn ? '<br>' + o.warn : ''), cancel: '그만두기', ok: list.length + '개 지우기', okClass: 'btn-danger' }).then(function (ok) {
        if (!ok) return;
        var prog = progress('지우는 중'), done = 0, failed = 0, chain = Promise.resolve();
        list.forEach(function (id) {
          chain = chain.then(function () { return o.del(id).catch(function () { failed++; }).then(function () { done++; prog.set(done, list.length, done + ' / ' + list.length); }); });
        });
        chain.then(function () {
          prog.close(); state.counts = null;
          if (failed) ask({ title: '일부를 지우지 못했어요', text: (list.length - failed) + '개는 지웠고 ' + failed + '개는 못 지웠어요. 인터넷 연결을 확인하고 다시 해 주세요.', cancel: false, ok: '확인' });
          else toast(list.length + '개를 휴지통으로 옮겼어요');
          o.after();
        });
      });
    });
    return { refresh: sync, active: function () { return on; }, off: function () { if (on) set(false); }, button: btn };
  }

  /* ---------- 평수 ↔ ㎡ (2026-10-30): 평수 칸 오른쪽 ㎡ 칸 — 한쪽을 고치면 다른 쪽이 저절로 (1평 = 400/121㎡ ≈ 3.3058㎡) ---------- */
  var PY_M2 = 400 / 121;
  function firstNum(v) { var m = /(\d+(?:\.\d+)?)/.exec(String(v == null ? '' : v).replace(/,/g, '')); return m ? parseFloat(m[1]) : NaN; }
  function r1(n) { return isFinite(n) && n > 0 ? String(Math.round(n * 10) / 10) : ''; }
  function m2Of(py) { return r1(firstNum(py) * PY_M2); }
  function pyOf(m2) { return r1(firstNum(m2) / PY_M2); }
  // ㎡ 칸 (평수 칸 바로 뒤에): cls = 그 화면의 단위 칸 모양(est-suffix · input-suffix)
  function m2Field(py, cls, label, ph) {
    return '<div class="' + (cls || 'est-suffix') + '"><input class="input" data-m2 inputmode="decimal" maxlength="7" value="' + esc(m2Of(py)) + '" placeholder="' + esc(ph || '예) 105.8') + '" aria-label="' + esc(label || '평수') + ' 제곱미터"><span>m²</span></div>';
  }
  document.addEventListener('input', function (e) {
    var el = e.target, pair = el && el.closest && el.closest('.py-pair'); if (!pair) return;
    var py = pair.querySelector('[data-py]'), m2 = pair.querySelector('[data-m2]'); if (!py || !m2) return;
    if (el === py && !pair._sync) m2.value = m2Of(py.value);
    else if (el === m2) { pair._sync = true; py.value = pyOf(m2.value); py.dispatchEvent(new Event('input', { bubbles: true })); pair._sync = false; }   // 평수 칸이 바뀐 것처럼 (저장 등 그대로)
  }, true);
  document.addEventListener('change', function (e) {
    var el = e.target, pair = el && el.matches && el.matches('[data-m2]') && el.closest('.py-pair'); if (!pair) return;
    var py = pair.querySelector('[data-py]'); if (py) py.dispatchEvent(new Event('change', { bubbles: true }));
  }, true);

  var KIT = window.AdminKit = {
    inApp: INAPP,
    PhotoPicker: PhotoPicker,
    C: C, DB: DB, I: I, esc: esc, $: $, $$: $$, fmtDate: fmtDate, store: store, ask: ask, toast: toast, notice: notice, listTools: listTools, leave: leave, prevHash: function () { return nav.idx > 0 ? nav.seq[nav.idx - 1] : null; }, replaceTo: replaceTo, setHash: setHash, goBack: goBack, focusNear: focusNear, keepPos: keepPos, flash: flash, copyFlash: copyFlash, progress: progress,
    frame: frame, go: go, setDirty: setDirty, state: state, friendlyError: friendlyError, titleEl: titleEl, routes: {},
    telHref: telHref, siteUrl: siteUrl, copyText: copyText, fmtWhen: fmtWhen, soft: soft, countsOf: countsOf, isNewInq: isNewInq, INQ_ST: INQ_ST, renderSide: renderSide, SHOW_SW: SHOW_SW,
    m2Of: m2Of, pyOf: pyOf, m2Field: m2Field,
    finder: finder, finderField: finderField, finderSet: finderSet, fdMatch: fdMatch, listCount: listCount,
    blacklistMap: blacklistMap, blacklistOf: blacklistOf, blacklistBanner: blacklistBanner, blacklistWarn: blacklistWarn, blacklistCheck: blacklistCheck, blacklistReset: function () { blCache = null; },
    regionPick: regionPick, splitRegion: splitRegion, joinRegion: joinRegion, siteLabel: siteLabel, fillUnit: fillUnit, workItems: workItems, estTitle: estTitle, ctrTitle: ctrTitle, filterHtml: filterHtml, filterBind: filterBind, filterMatch: filterMatch, filterReset: filterReset, filterActive: filterActive, filterState: filterState, regionOf: regionOf, dateKeys: dateKeys, matchTokens: matchTokens, findTokens: findTokens, bulk: bulk,
    viewMode: viewMode, viewToggle: viewToggle, dataTable: dataTable, dataTableBind: dataTableBind,
    workRange: workRange, dealItem: dealItem, sortable: sortable, dsel: dsel, GRIP: GRIP, ymd: ymd, today: function () { return ymd(); }, addDays: addDays, kDate: kDate, sDate: sDate, num: num, won: won, digits: digits, saveBlob: saveBlob,
  };

  /* ---------- 시작 ---------- */
  // '다시 불러오기' 버튼 (보안 설정상 버튼 안에 바로 스크립트를 쓰지 않음)
  document.addEventListener('click', function (e) { if (e.target.closest && e.target.closest('[data-reload]')) location.reload(); });
  ['dragover', 'drop'].forEach(function (t) {
    window.addEventListener(t, function (e) {
      if (e.dataTransfer && Array.prototype.indexOf.call(e.dataTransfer.types || [], 'Files') >= 0) e.preventDefault();
    });
  });
  document.title = C.name + ' 관리화면';
  if (!DB.live) document.getElementById('demo-note').hidden = false;
  function start() {
    Promise.resolve(DB.init && DB.init()).then(function () { return DB.session(); }).then(function (s) {
      if (s) loadListDefs().then(route, route); else viewLogin();
    }).catch(function (err) { viewLogin(friendlyError(err)); });
  }
  // 견적서 화면 파일(admin-estimate.js)까지 다 읽은 뒤 시작
  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', start); else start();
})();
