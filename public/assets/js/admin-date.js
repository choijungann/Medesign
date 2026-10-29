/* =====================================================================
   관리화면 — 날짜 고르기 (달력)
   관리화면의 모든 <input type="date"> 를 '달력에서 날짜 누르기' 방식으로 바꿉니다.
   · 원래 입력칸은 그대로 두고(숨김) 값만 'YYYY-MM-DD'로 채우므로, 다른 화면 코드는 바꿀 필요가 없습니다.
   · 날짜를 고르면 input·change 이벤트를 보내 저장·계산이 원래처럼 동작합니다.
   · data-min-from="다른 칸 id" 가 있으면 그 날짜보다 앞은 고를 수 없습니다 (예: 끝나는 날)
   ===================================================================== */
(function () {
  'use strict';
  var WEEK = '일월화수목금토';
  var DESC = Object.getOwnPropertyDescriptor(HTMLInputElement.prototype, 'value');
  var CAL = '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><rect x="3.5" y="5" width="17" height="15.5" rx="2.5"/><path d="M3.5 10h17M8 3v4M16 3v4"/></svg>';
  var L = '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.4" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M15 5l-7 7 7 7"/></svg>';
  var Rt = '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.4" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M9 5l7 7-7 7"/></svg>';

  function pad(n) { return String(n).padStart(2, '0'); }
  function iso(d) { return d.getFullYear() + '-' + pad(d.getMonth() + 1) + '-' + pad(d.getDate()); }
  function parse(v) { var m = /^(\d{4})-(\d{2})-(\d{2})$/.exec(v || ''); return m ? new Date(+m[1], +m[2] - 1, +m[3]) : null; }
  function short(v) { var d = parse(v); return d ? String(d.getFullYear()).slice(2) + '.' + pad(d.getMonth() + 1) + '.' + pad(d.getDate()) : ''; }
  function label(v) { var d = parse(v); return d ? d.getFullYear() + '년 ' + (d.getMonth() + 1) + '월 ' + d.getDate() + '일 (' + WEEK.charAt(d.getDay()) + ')' : ''; }
  // 칸이 좁아 '2026년 10월 26일 (월)'이 잘리면 차례로 줄임: 올해는 '10월 26일 (월)' → '10월 26일', 다른 해는 '27.01.05 (화)'. 그래도 넘치면 '26.10.26'
  function fitSteps(v) {
    var d = parse(v); if (!d) return [];
    var w = ' (' + WEEK.charAt(d.getDay()) + ')', md = (d.getMonth() + 1) + '월 ' + d.getDate() + '일';
    return d.getFullYear() === new Date().getFullYear() ? [label(v), md + w, md, short(v)] : [label(v), short(v) + w, short(v)];
  }
  function fit(btn) {
    var sp = btn.firstChild, v = btn._v;
    if (!sp || !v || btn._short) return;
    var steps = fitSteps(v);
    for (var i = 0; i < steps.length; i++) { sp.textContent = steps[i]; if (!sp.clientWidth || sp.scrollWidth <= sp.clientWidth + 1) return; }
  }
  var RO = window.ResizeObserver ? new ResizeObserver(function (es) { es.forEach(function (e) { fit(e.target); }); }) : null;
  function esc(s) { return String(s == null ? '' : s).replace(/[&<>"']/g, function (c) { return { '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]; }); }

  function enhance(input) {
    if (input._dp) return;
    input._dp = true;
    var btn = document.createElement('button');
    btn.type = 'button';
    btn.className = 'input dp-btn';
    btn.setAttribute('aria-haspopup', 'dialog');
    input.insertAdjacentElement('afterend', btn);
    input.classList.add('dp-hidden');
    input.tabIndex = -1;
    input.setAttribute('aria-hidden', 'true');
    // 라벨(<label for=...>)을 누르면 달력이 열리도록 id 를 버튼으로 옮김
    if (input.id) { btn.id = input.id + '-dp'; var lb = document.querySelector('label[for="' + input.id + '"]'); if (lb) lb.setAttribute('for', btn.id); }
    function draw() {
      var v = DESC.get.call(input);
      // data-short: 좁은 칸(찾기 막대)에서는 26.10.25 처럼 짧게 · data-ph: 비었을 때 글자
      var txt = v ? (input.hasAttribute('data-short') ? short(v) : label(v)) : (input.getAttribute('data-ph') || '날짜 고르기');
      btn.innerHTML = '<span class="' + (v ? 'dp-v' : 'dp-ph') + '">' + esc(txt) + '</span>' + CAL;
      btn._v = v; btn._short = input.hasAttribute('data-short'); fit(btn);
      btn.setAttribute('aria-label', (input.getAttribute('data-label') || '날짜') + ': ' + (v ? label(v) : '고르지 않음') + ' — 눌러서 달력 열기');
      btn.disabled = input.disabled;
    }
    // 다른 코드가 input.value = '…' 로 바꿔도 보이는 글자가 따라 바뀌게
    Object.defineProperty(input, 'value', {
      configurable: true,
      get: function () { return DESC.get.call(input); },
      set: function (v) { DESC.set.call(input, v); draw(); },
    });
    draw();
    if (RO) RO.observe(btn);   // 창이 열려 칸 너비가 정해지거나 바뀌면 글자 길이를 다시 맞춤
    btn.addEventListener('click', function () { open(input, btn, draw); });
  }

  function open(input, btn, redraw) {
    var minEl = input.getAttribute('data-min-from') && document.getElementById(input.getAttribute('data-min-from'));
    var min = minEl ? parse(minEl.value) : null;
    var cur = parse(input.value), view = cur || min || new Date();
    view = new Date(view.getFullYear(), view.getMonth(), 1);
    var lastFocus = document.activeElement;
    var ov = document.createElement('div');
    ov.className = 'overlay dp-ov';
    var title = (function () { var f = btn.closest('.field'); var l = f && f.querySelector('label, .label'); return l ? l.textContent.replace(/\(.*?\)/g, '').trim() : '날짜'; })();
    function render() {
      var y = view.getFullYear(), m = view.getMonth(), first = new Date(y, m, 1), start = new Date(y, m, 1 - first.getDay());
      var today = iso(new Date()), sel = input.value, cells = '';
      for (var i = 0; i < 42; i++) {
        var d = new Date(start.getFullYear(), start.getMonth(), start.getDate() + i), v = iso(d);
        var off = min && d < min;   // 늘 6주 — 달을 넘겨도 창 높이가 그대로
        cells += '<button type="button" class="dp-day' + (d.getMonth() !== m ? ' out' : '') + (v === today ? ' today' : '') + (v === sel ? ' sel' : '') +
          (d.getDay() === 0 ? ' sun' : d.getDay() === 6 ? ' sat' : '') + '" data-v="' + v + '"' + (off ? ' disabled' : '') +
          ' aria-label="' + esc(label(v)) + (v === today ? ', 오늘' : '') + '"' + (v === sel ? ' aria-pressed="true"' : '') + '>' + d.getDate() + '</button>';
      }
      var years = '', months = '';
      for (var yy = y - 5; yy <= y + 5; yy++) years += '<option value="' + yy + '"' + (yy === y ? ' selected' : '') + '>' + yy + '년</option>';
      for (var mm = 0; mm < 12; mm++) months += '<option value="' + mm + '"' + (mm === m ? ' selected' : '') + '>' + (mm + 1) + '월</option>';
      ov.innerHTML = '<div class="sheet dp-sheet" role="dialog" aria-modal="true" aria-label="' + esc(title) + ' 고르기">' +
        '<h3>' + esc(title) + '</h3>' +
        '<div class="dp-nav"><button type="button" class="dp-arrow" data-mv="-1" aria-label="이전 달">' + L + '</button>' +
        '<select class="dp-sel" data-ys aria-label="연도">' + years + '</select><select class="dp-sel" data-ms aria-label="월">' + months + '</select>' +
        '<button type="button" class="dp-arrow" data-mv="1" aria-label="다음 달">' + Rt + '</button></div>' +
        '<div class="dp-wk">' + WEEK.split('').map(function (w, i) { return '<span' + (i === 0 ? ' class="sun"' : i === 6 ? ' class="sat"' : '') + '>' + w + '</span>'; }).join('') + '</div>' +
        '<div class="dp-grid">' + cells + '</div>' +
        (min ? '<p class="dp-note">' + esc(label(iso(min))) + ' 이후로 고를 수 있어요</p>' : '') +
        '<div class="dp-foot"><button type="button" class="btn btn-outline" data-today' + (min && new Date() < min ? ' disabled' : '') + '>오늘</button>' +
        (input.value ? '<button type="button" class="btn btn-outline" data-clear>지우기</button>' : '') +
        '<button type="button" class="btn btn-primary" data-close>닫기</button></div></div>';
      var s = ov.querySelector('.dp-day.sel') || ov.querySelector('.dp-day.today:not(.out)') || ov.querySelector('.dp-day:not(.out):not([disabled])');
      if (s) s.focus();
    }
    function set(v) {
      DESC.set.call(input, v); redraw();
      input.dispatchEvent(new Event('input', { bubbles: true }));
      input.dispatchEvent(new Event('change', { bubbles: true }));
      close();
    }
    function close() { ov.remove(); document.removeEventListener('keydown', onKey, true); if (lastFocus && lastFocus.focus) btn.focus(); }
    function onKey(e) {
      if (e.key === 'Escape') { e.preventDefault(); close(); return; }
      var a = document.activeElement;
      if (!a || !a.classList || !a.classList.contains('dp-day')) return;
      var step = { ArrowLeft: -1, ArrowRight: 1, ArrowUp: -7, ArrowDown: 7 }[e.key];
      if (!step) return;
      e.preventDefault();
      var d = parse(a.getAttribute('data-v')); d.setDate(d.getDate() + step);
      if (d.getMonth() !== view.getMonth()) { view = new Date(d.getFullYear(), d.getMonth(), 1); render(); }
      var b = ov.querySelector('.dp-day[data-v="' + iso(d) + '"]'); if (b) b.focus();
    }
    ov.addEventListener('click', function (e) {
      var t = e.target;
      if (t === ov || t.closest('[data-close]')) return close();
      var x;
      if ((x = t.closest('[data-mv]'))) { view = new Date(view.getFullYear(), view.getMonth() + +x.getAttribute('data-mv'), 1); render(); return; }
      if ((x = t.closest('.dp-day')) && !x.disabled) return set(x.getAttribute('data-v'));
      if (t.closest('[data-today]')) return set(iso(new Date()));
      if (t.closest('[data-clear]')) return set('');
    });
    ov.addEventListener('change', function (e) {
      if (e.target.hasAttribute('data-ys') || e.target.hasAttribute('data-ms')) {
        view = new Date(+ov.querySelector('[data-ys]').value, +ov.querySelector('[data-ms]').value, 1); render();
      }
    });
    document.addEventListener('keydown', onKey, true);
    document.body.appendChild(ov);
    render();
  }

  /* ---------- 시간 고르기: <input data-time> 를 '오전/오후 · 시 · 분 누르기' 창으로 ----------
     값은 예전처럼 글자('오전 10시', '오후 2시 30분')로 들어가서 다른 코드·저장 형식은 그대로 */
  var CLOCK = '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><circle cx="12" cy="12" r="8.5"/><path d="M12 7.5V12l3 2"/></svg>';
  var MINS = [0, 10, 20, 30, 40, 50];
  function tParse(v) {
    v = String(v || '').trim(); var m;
    if ((m = /^(오전|오후|낮|저녁|밤|아침|새벽)?\s*(\d{1,2})\s*시\s*(반|(\d{1,2})\s*분)?$/.exec(v))) {   // '오전 9~12시' 같은 글은 그대로 두고 아래 '지금 적힌 글'로 보여 줌
      var h = +m[2], ap = m[1] === '오후' || m[1] === '저녁' || m[1] === '밤' || (m[1] === '낮' && h < 7) ? '오후' : m[1] ? '오전' : (h >= 12 || h <= 6 ? '오후' : '오전');
      if (h > 12) { h -= 12; ap = '오후'; } if (h === 0) h = 12;
      return { ap: ap, h: h, m: m[3] === '반' ? 30 : +(m[4] || 0) };
    }
    if ((m = /^(\d{1,2}):(\d{2})$/.exec(v))) { var H = +m[1]; return { ap: H >= 12 ? '오후' : '오전', h: H % 12 || 12, m: +m[2] }; }
    return null;
  }
  function tText(t) { return t ? t.ap + ' ' + t.h + '시' + (t.m ? ' ' + t.m + '분' : '') : ''; }
  function enhanceTime(input) {
    if (input._tp) return;
    input._tp = true;
    var btn = document.createElement('button');
    btn.type = 'button'; btn.className = 'input dp-btn tp-btn'; btn.setAttribute('aria-haspopup', 'dialog');
    input.insertAdjacentElement('afterend', btn);
    input.classList.add('dp-hidden'); input.tabIndex = -1; input.setAttribute('aria-hidden', 'true');
    if (input.id) { btn.id = input.id + '-tp'; var lb = document.querySelector('label[for="' + input.id + '"]'); if (lb) lb.setAttribute('for', btn.id); }
    function draw() {
      var v = DESC.get.call(input).trim();
      btn.innerHTML = '<span class="' + (v ? 'dp-v' : 'dp-ph') + '">' + esc(v || input.getAttribute('data-ph') || '시간 고르기') + '</span>' + CLOCK;
      btn.setAttribute('aria-label', '시간: ' + (v || '고르지 않음') + ' — 눌러서 시간 고르기');
      btn.disabled = input.disabled;
    }
    Object.defineProperty(input, 'value', { configurable: true, get: function () { return DESC.get.call(input); }, set: function (v) { DESC.set.call(input, v); draw(); } });
    draw();
    btn.addEventListener('click', function () { openTime(input, btn, draw); });
  }
  function openTime(input, btn, redraw) {
    var cur = tParse(input.value), raw = input.value.trim();
    var t = cur ? { ap: cur.ap, h: cur.h, m: MINS.indexOf(cur.m) >= 0 ? cur.m : cur.m } : { ap: '오전', h: 0, m: 0 };
    var ov = document.createElement('div');
    ov.className = 'overlay dp-ov';
    var title = (function () { var f = btn.closest('.field'); var l = f && f.querySelector('label, .label'); return l ? l.textContent.replace(/\(.*?\)/g, '').trim() : '시간'; })();
    function render() {
      ov.innerHTML = '<div class="sheet dp-sheet tp-sheet" role="dialog" aria-modal="true" aria-label="' + esc(title) + ' 고르기">' +
        '<h3>' + esc(title) + '</h3>' +
        (raw && !cur ? '<p class="dp-note tp-raw">지금 적힌 글: <b>' + esc(raw) + '</b></p>' : '') +
        '<div class="tp-ap" role="group" aria-label="오전·오후">' + ['오전', '오후'].map(function (a) { return '<button type="button" data-tap="' + a + '" aria-pressed="' + (t.ap === a) + '"' + (t.ap === a ? ' class="on"' : '') + '>' + a + '</button>'; }).join('') + '</div>' +
        '<p class="tp-l">시</p><div class="tp-grid" role="group" aria-label="시">' + [1, 2, 3, 4, 5, 6, 7, 8, 9, 10, 11, 12].map(function (h) {
          return '<button type="button" class="tp-c' + (t.h === h ? ' on' : '') + '" data-th="' + h + '" aria-pressed="' + (t.h === h) + '">' + h + '시</button>';
        }).join('') + '</div>' +
        '<p class="tp-l">분</p><div class="tp-grid" role="group" aria-label="분">' + MINS.map(function (m) {
          return '<button type="button" class="tp-c' + (t.m === m ? ' on' : '') + '" data-tm="' + m + '" aria-pressed="' + (t.m === m) + '">' + (m ? m + '분' : '정각') + '</button>';
        }).join('') + '</div>' +
        '<p class="tp-sum" aria-live="polite">' + (t.h ? '<b>' + esc(tText(t)) + '</b>' : '시를 골라 주세요') + '</p>' +
        '<div class="dp-foot">' + (raw ? '<button type="button" class="btn btn-outline" data-tclear>시간 지우기</button>' : '<button type="button" class="btn btn-outline" data-close>닫기</button>') +
        '<button type="button" class="btn btn-primary" data-tok' + (t.h ? '' : ' disabled') + '>이 시간으로</button></div></div>';
      var f = ov.querySelector('.tp-c.on') || ov.querySelector('[data-th]'); if (f && window.matchMedia && matchMedia('(hover: hover) and (pointer: fine)').matches) f.focus();
    }
    function set(v) {
      DESC.set.call(input, v); redraw();
      input.dispatchEvent(new Event('input', { bubbles: true }));
      input.dispatchEvent(new Event('change', { bubbles: true }));
      close();
    }
    function close() { ov.remove(); document.removeEventListener('keydown', onKey, true); btn.focus(); }
    function onKey(e) { if (e.key === 'Escape') { e.preventDefault(); close(); } }
    ov.addEventListener('click', function (e) {
      var x, tg = e.target;
      if (tg === ov || tg.closest('[data-close]')) return close();
      if ((x = tg.closest('[data-tap]'))) { t.ap = x.getAttribute('data-tap'); return render(); }
      if ((x = tg.closest('[data-th]'))) { t.h = +x.getAttribute('data-th'); return render(); }
      if ((x = tg.closest('[data-tm]'))) { t.m = +x.getAttribute('data-tm'); return render(); }
      if (tg.closest('[data-tclear]')) return set('');
      if (tg.closest('[data-tok]') && t.h) return set(tText(t));
    });
    document.addEventListener('keydown', onKey, true);
    document.body.appendChild(ov);
    render();
  }

  function scan(root) {
    if (!root || !root.querySelectorAll) return;
    if (root.matches && root.matches('input[type="date"]')) enhance(root);
    Array.prototype.forEach.call(root.querySelectorAll('input[type="date"]'), enhance);
    if (root.matches && root.matches('input[data-time]')) enhanceTime(root);
    Array.prototype.forEach.call(root.querySelectorAll('input[data-time]'), enhanceTime);
  }
  // 화면이 바뀔 때마다 새로 생긴 날짜 칸을 찾아 바꿈
  new MutationObserver(function (list) {
    list.forEach(function (m) { Array.prototype.forEach.call(m.addedNodes, function (n) { if (n.nodeType === 1) scan(n); }); });
    // 잠긴 칸(fieldset disabled)도 버튼 모양을 맞춤
  }).observe(document.body, { childList: true, subtree: true });
  scan(document.body);
  window.DatePickerKit = { enhance: enhance, label: label, enhanceTime: enhanceTime, timeParse: tParse };
})();
