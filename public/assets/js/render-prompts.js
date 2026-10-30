/* =====================================================================
   3D 그림 — 공간·분위기 목록, 견적서에서 공사 내용 불러오기, AI에 보내는 요청문 (한 곳에서 관리)
   · 관리화면(브라우저)과 서버 함수(netlify/functions/render-background.mjs)가 같은 파일을 씁니다.
     브라우저: <script src="render-prompts.js"> → window.RenderPrompts
     서버: import RP from '../../public/assets/js/render-prompts.js'
   · 순서: 관리화면 '3D 그림'에서 견적서를 고르면 공사 항목·자재를 불러옴(fromEstimate) → 넣기/빼기·직접 추가
           → 그림을 만들 때 그 내용(compose)을 그림 줄에 같이 저장 → 서버 함수가
           ① 글 AI(Claude, 키가 없으면 Gemini 글 모델): 도면 그림 + 그 내용으로 공간마다 그림 설명(영어)을 쓰고
           ② 그림 AI(Google Gemini): 도면 그림 + 그 설명으로 그림
              (3D 밑그림을 만든 공간은 도면 대신 그 회색 밑그림 + 설명으로 — 벽·문·창 자리와 구도를 그대로 두고 마감만 입힘, render-walls.js)
           ①이 실패하면 fallback() 설명으로 바로 그림
   · AI에는 도면 그림과 공사 내용(항목·자재 이름, 평수, 분위기, 요청 사항)만 보냅니다. 고객 이름·연락처·주소·금액은 보내지 않습니다.
   ===================================================================== */
(function (root, factory) {
  var api = factory();
  if (typeof module === 'object' && module.exports) module.exports = api;
  else root.RenderPrompts = api;
})(typeof self !== 'undefined' ? self : this, function () {
  'use strict';

  // 만들 수 있는 그림 (화면의 3×3 타일 순서)
  var VIEWS = [
    { key: 'overview', name: '전체 조감도', en: 'the whole home as a 3D isometric cutaway (bird\'s-eye view)' },
    { key: 'living', name: '거실', en: 'the living room' },
    { key: 'kitchen', name: '주방', en: 'the kitchen and dining area' },
    { key: 'master', name: '안방', en: 'the master bedroom' },
    { key: 'room', name: '작은방', en: 'a smaller bedroom (kids room or study)' },
    { key: 'bath', name: '욕실', en: 'the bathroom' },
    { key: 'entry', name: '현관', en: 'the entrance foyer' },
    { key: 'dress', name: '드레스룸', en: 'the dressing room (walk-in closet)' },
    { key: 'balcony', name: '발코니', en: 'the balcony (veranda)' },
  ];
  // 분위기 ('' = 공사 내용(자재)에 맞게)
  var STYLES = [
    { key: '', name: '자재에 맞게', sub: '공사 내용대로', en: 'a tasteful contemporary Korean apartment interior that suits the listed finishes' },
    { key: 'modern', name: '모던 화이트', sub: '흰색·연회색', en: 'modern minimal style, white and light gray palette, clean lines' },
    { key: 'wood', name: '내추럴 우드', sub: '밝은 원목·웜화이트', en: 'natural style with light oak wood, warm white walls and linen textures' },
    { key: 'beige', name: '웜 베이지', sub: '베이지·그레이지', en: 'warm beige and greige palette, soft and cozy' },
    { key: 'gray', name: '차분한 그레이', sub: '그레이·차콜', en: 'calm gray tones with charcoal accents, hotel-like' },
    { key: 'classic', name: '클래식', sub: '몰딩·아이보리', en: 'classic style with wall moldings, ivory and walnut tones' },
  ];
  var MAX_VIEWS = 9;        // 한 번에 만들 수 있는 그림 수
  var MEMO_MAX = 200;       // 요청 사항 글자 수
  var LINE_MAX = 500;       // 공사 내용 한 줄 글자 수 (공사 항목 하나 = 한 줄: '도배: 실크 벽지(LG 베스띠) [화이트 무광], 천장 도배')
  var NOTE_MAX = 60;        // 세부 줄마다 적는 색상·상세 글자 수
  // 색상·상세 칸 옆 팔레트: 누르면 칸에 그 이름이 들어감 (그림 AI에는 이름 글자로 감)
  var COLORS = [
    { name: '화이트', hex: '#FFFFFF' }, { name: '아이보리', hex: '#F3ECDA' }, { name: '베이지', hex: '#E2D2B6' }, { name: '그레이지', hex: '#CDC4B8' },
    { name: '라이트 그레이', hex: '#D8DADD' }, { name: '그레이', hex: '#9DA2A8' }, { name: '차콜', hex: '#4A4D52' }, { name: '블랙', hex: '#1F1F1F' },
    { name: '밝은 오크', hex: '#D8B98A' }, { name: '내추럴 우드', hex: '#B5855A' }, { name: '월넛', hex: '#6A4A33' }, { name: '네이비', hex: '#2E3A59' },
    { name: '세이지 그린', hex: '#A3B18A' }, { name: '테라코타', hex: '#C4724E' }, { name: '골드', hex: '#C9A35B' }, { name: '실버', hex: '#B9BEC4' },
  ];
  var FINISHES = ['무광', '반광', '유광', '대리석 무늬', '헤링본'];
  var CUSTOM_LEN = 160;     // 직접 넣는 한 줄 글자 수
  var DETAIL_MAX = 20;      // 공사 항목 하나에서 불러오는 세부 줄 수
  var LINES_MAX = 40;       // 공사 내용 줄 수
  var CUSTOM_MAX = 20;      // 직접 넣는 줄 수
  var MATS_MAX = 4;         // 자재 사진 (세부 줄마다 하나, 전부 합쳐 4장까지 — 그림 AI에 같이 보냄)

  function viewOf(k) { return VIEWS.filter(function (v) { return v.key === k; })[0] || null; }
  function styleOf(k) { return STYLES.filter(function (s) { return s.key === (k || ''); })[0] || STYLES[0]; }
  function t(v, n) { return String(v == null ? '' : v).replace(/\s+/g, ' ').trim().slice(0, n); }

  // 그림과 상관없는 일(철거·청소·배선·방수 등): 처음에는 '빼기'로 (체크하면 넣을 수 있음)
  var NONVISUAL = /철거|폐기|보양|청소|새집증후군|방수|단열|배선|난방|설비|운반|양중|경비|인건비|관리비|공과/;
  /**
   * 견적서 → 공사 내용 (금액·수량·고객 정보 없이). 공사 항목(큰 단위)마다 세부 줄(견적서의 품명·규격)을 따로 넣기/빼기
   * → { size: '32' | '', items: [{ key, name: '도배', on, lines: [{ k, text: '실크 벽지(LG 베스띠)', on }] }] }
   *   on(공사 항목)은 세부 줄이 없을 때만 씀. 세부 줄이 있으면 켜진 세부 줄이 하나라도 있어야 그림에 들어감
   */
  function fromEstimate(doc) {
    doc = doc && typeof doc === 'object' ? doc : {};
    var items = [];
    (Array.isArray(doc.cats) ? doc.cats : []).slice(0, LINES_MAX).forEach(function (c, i) {
      var name = t(c && c.name, 30);
      if (!name) return;
      var off = NONVISUAL.test(name), seen = {}, lines = [];
      (Array.isArray(c.lines) ? c.lines : []).forEach(function (l) {
        var n = t(l && l.name, 40), s = t(l && l.spec, 40);
        if (!n || lines.length >= DETAIL_MAX) return;
        // 다시 불러올 때 같은 줄을 알아보는 열쇠: 설정의 세부 항목 id(없으면 품명), 같은 것이 또 있으면 #2, #3
        var base = l.itemId ? 'i:' + l.itemId : 'n:' + n, cnt = seen[base] = (seen[base] || 0) + 1;
        lines.push({ k: cnt > 1 ? base + '#' + cnt : base, text: n + (s ? '(' + s + ')' : ''), on: !off && !NONVISUAL.test(n) });
      });
      items.push({ key: String((c && c.key) || 'c' + i), name: name, on: !off, lines: lines });
    });
    return { size: String((doc.site && doc.site.size) || '').replace(/[^0-9.]/g, '').slice(0, 6), items: items };
  }
  function linesOf(x) { return x && Array.isArray(x.lines) ? x.lines : []; }
  /** 세부 줄 한 개 → 그림에 쓰는 글: '실크 벽지(LG 베스띠) [화이트 무광]' (색상·상세는 대괄호) */
  function lineText(l) { var n = t(l && l.note, NOTE_MAX); return t(l && l.text, 60) + (n ? ' [' + n + ']' : ''); }
  /** 공사 항목이 그림에 들어가는지: 'all' | 'part' | 'none' */
  function itemState(x) {
    var ls = linesOf(x);
    if (!ls.length) return x && x.on ? 'all' : 'none';
    var n = ls.filter(function (l) { return l.on; }).length;
    return n === ls.length ? 'all' : n ? 'part' : 'none';
  }
  /** 다시 불러올 때: 같은 공사 항목·세부 줄은 넣기/빼기를 그대로 둠 (뺀 공사 항목에 새로 생긴 줄도 빼 둠) */
  function mergeItems(oldItems, fresh) {
    var was = {}; (oldItems || []).forEach(function (x) { was[x.key] = x; });
    return fresh.map(function (x) {
      var o = was[x.key]; if (!o) return x;
      var ol = {}, olds = linesOf(o); olds.forEach(function (l) { ol[l.k] = l; });
      var allOff = olds.length ? !olds.some(function (l) { return l.on; }) : !o.on;
      return Object.assign({}, x, { on: olds.length ? x.on : !!o.on, lines: x.lines.map(function (l) {
        var w = ol[l.k];   // 같은 줄: 넣기/빼기와 색상·상세를 그대로
        return Object.assign({}, l, { on: w ? !!w.on : allOff ? false : l.on }, w && w.note ? { note: w.note } : {}, w && w.photo ? { photo: w.photo } : {});
      }) });
    });
  }
  /** 바뀐 점 한 줄 요약: ['도배 바뀜', '마루 추가', '타일 빠짐', '평수 30→32평'] */
  function changes(oldItems, fresh, oldSize, newSize) {
    var was = {}, now = {}, out = [];
    var sig = function (x) { return x.name + '|' + linesOf(x).map(function (l) { return l.text; }).join('|'); };
    (oldItems || []).forEach(function (x) { was[x.key] = x; });
    fresh.forEach(function (x) { now[x.key] = x; });
    fresh.forEach(function (x) { if (!was[x.key]) out.push(x.name + ' 추가'); else if (sig(was[x.key]) !== sig(x)) out.push(x.name + ' 바뀜'); });
    (oldItems || []).forEach(function (x) { if (!now[x.key]) out.push(x.name + ' 빠짐'); });
    if (String(oldSize || '') !== String(newSize || '')) out.push('평수 ' + (oldSize ? oldSize + '→' : '') + (newSize ? newSize + '평' : '없음'));
    return out;
  }
  /**
   * 그림 만들 때 쓰는 내용 (그림 줄의 input 에 그대로 저장 — 서버 함수는 이것만 봄)
   * doc = 3D 그림 작업의 doc { size, items, custom, style, memo } → 켜진 세부 줄만 공사 항목마다 한 줄로
   */
  function compose(doc) {
    doc = doc || {};
    var lines = [];
    (doc.items || []).forEach(function (x) {
      var ls = linesOf(x);
      if (ls.length) {
        var on = ls.filter(function (l) { return l.on; }).map(lineText);
        if (on.length) lines.push(t(x.name + ': ' + on.join(', '), LINE_MAX));
      } else if (x.on) lines.push(t(x.name, LINE_MAX));
    });
    lines = lines.concat((doc.custom || []).map(function (c) { return t(c, CUSTOM_LEN); }).filter(Boolean)).slice(0, LINES_MAX);
    // 자재 사진 (넣은 세부 줄에 붙인 것만, MATS_MAX장까지): { text: '도배: 실크 벽지 [화이트]', path }
    var mats = [];
    (doc.items || []).forEach(function (x) { linesOf(x).forEach(function (l) { if (l.on && l.photo && mats.length < MATS_MAX) mats.push({ text: t(x.name + ': ' + lineText(l), 120), path: l.photo }); }); });
    var out = { size: t(doc.size, 6), lines: lines, style: styleOf(doc.style).key, memo: t(doc.memo, MEMO_MAX) };
    mats = matsOf(mats); if (mats.length) out.mats = mats;
    return out;
  }
  /**
   * 카메라 위치 (관리화면에서 도면을 눌러 찍음) — 도면 그림 안의 비율 0~1
   * { x, y: 서 있는 곳, tx, ty: 바라보는 곳(없으면 null), ar: 도면 세로/가로(방향을 정확히 재려고, 없으면 1) } | null
   */
  function camOf(c) {
    if (!c || typeof c !== 'object') return null;
    var n = function (v) { v = Number(v); return isFinite(v) ? Math.max(0, Math.min(1, Math.round(v * 1000) / 1000)) : null; };
    var o = { x: c.x == null ? null : n(c.x), y: c.y == null ? null : n(c.y), tx: c.tx == null ? null : n(c.tx), ty: c.ty == null ? null : n(c.ty) };
    if (o.x == null || o.y == null) return null;
    if (o.tx == null || o.ty == null || (Math.abs(o.tx - o.x) < 0.01 && Math.abs(o.ty - o.y) < 0.01)) { o.tx = null; o.ty = null; }
    var ar = Number(c.ar); if (isFinite(ar) && ar >= 0.2 && ar <= 5) o.ar = Math.round(ar * 1000) / 1000;
    return o;
  }
  // AI에게 알려 줄 때: 도면 그림 위의 [y, x] (0~1000, 위·왼쪽부터 — Gemini가 그림 위치를 읽는 방식과 같게)
  // 방위: 도면 그림 위쪽 = 북쪽 (오른쪽 = 동, 아래 = 남, 왼쪽 = 서)
  var DIRS = ['top', 'top right', 'right', 'bottom right', 'bottom', 'bottom left', 'left', 'top left'];
  var COMPASS = ['north', 'north-east', 'east', 'south-east', 'south', 'south-west', 'west', 'north-west'];
  var COMPASS_KO = ['북', '북동', '동', '남동', '남', '남서', '서', '북서'];
  function camAngle(c) {   // 바라보는 쪽 (0 = 북(위), 90 = 동(오른쪽), 시계 방향) | null
    c = camOf(c); if (!c || c.tx == null) return null;
    var a = Math.atan2(c.tx - c.x, -(c.ty - c.y) * (c.ar || 1)) * 180 / Math.PI;
    return (a + 360) % 360;
  }
  function dirIdx(c) { var a = camAngle(c); return a == null ? -1 : Math.round(a / 45) % 8; }
  /** 바라보는 쪽을 말로: 도면 그림에서 위·오른쪽 위… (위 = 그림의 위쪽, 시계 방향) */
  function camDir(c) { var i = dirIdx(c); return i < 0 ? '' : DIRS[i]; }
  /** 바라보는 방위 (관리화면 표시용): '서' | '북동' … | '' */
  function camDirKo(c) { var i = dirIdx(c); return i < 0 ? '' : COMPASS_KO[i]; }
  /**
   * 이 카메라에서 도면의 북·동·남·서쪽이 사진의 어디에 오는지 — 그림 AI는 '서쪽'을 사진의 서쪽(왼쪽)으로 알아들어서,
   * 방위는 카메라 기준(정면·왼쪽·오른쪽·뒤)으로 바꿔서 전함 (2026-10-30)
   * → { north: 'straight ahead', east: 'on the right', … } | null
   */
  function camSides(c) {
    var a = camAngle(c); if (a == null) return null;
    var out = {};
    [['north', 0], ['east', 90], ['south', 180], ['west', 270]].forEach(function (s) {
      var d = ((s[1] - a + 540) % 360) - 180, m = Math.abs(d), side = d > 0 ? 'right' : 'left';   // d: 카메라 정면에서 시계 방향으로 몇 도
      out[s[0]] = m <= 22.5 ? 'straight ahead' : m <= 67.5 ? 'ahead on the ' + side : m <= 112.5 ? 'on the ' + side
        : m <= 157.5 ? 'behind on the ' + side + ' (mostly out of the photo)' : 'behind the camera (not in the photo)';
    });
    return out;
  }
  function sidesText(c) {
    var s = camSides(c); if (!s) return '';
    return 'the north side of the plan is ' + s.north + ', the east side is ' + s.east + ', the south side is ' + s.south + ', the west side is ' + s.west;
  }
  function camText(c) {
    c = camOf(c); if (!c) return '';
    var pt = function (y, x) { return '[' + Math.round(y * 1000) + ', ' + Math.round(x * 1000) + ']'; };
    var i = dirIdx(c);
    return 'camera standing at ' + pt(c.y, c.x) + (c.tx != null ? ', looking toward ' + pt(c.ty, c.tx) + ' (that is, toward the ' + COMPASS[i] + ' of the plan - the ' + DIRS[i] + ' of the plan image)' : ', looking in the most natural direction from there');
  }
  /* ---------- 가구 위치 (관리화면에서 도면에 놓을 곳 → 앞쪽을 차례로 누름, 2026-10-30) ----------
     { x, y: 놓은 곳(가운데), tx, ty: 앞쪽(식탁은 긴 쪽이 향하는 곳), ar, w: 가로(m) } — 그림 AI에는 카메라에서 본 자리(정면·왼쪽…)로 바꿔 전함 */
  var FURN = [
    // 거실·방
    { key: 'tv', g: 'room', name: '거실장', en: 'TV stand (a low living-room cabinet with a TV on it)', d: 0.45, w: 2.0, ht: 0.45, tip: '앞쪽(소파 쪽)' },
    { key: 'sofa', g: 'room', name: '소파', en: 'sofa', d: 0.95, w: 2.3, ht: 0.82, tip: '앞쪽(앉아서 보는 쪽)' },
    { key: 'desk', g: 'room', name: '책상', en: 'desk with a chair', d: 0.6, w: 1.2, ht: 0.75, tip: '앞쪽(의자 놓는 쪽)' },
    { key: 'bed', g: 'room', name: '침대', en: 'bed', d: 2.1, w: 1.6, ht: 0.5, tip: '발 쪽', foot: true },
    { key: 'closet', g: 'room', name: '붙박이장', en: 'built-in wardrobe', d: 0.6, w: 2.4, ht: null, tip: '앞쪽(문 여는 쪽)' },
    { key: 'low', g: 'room', name: '낮은 테이블', en: 'low coffee table', d: 0.6, w: 1.2, ht: 0.4, axis: true, tip: '긴 쪽이 향할 곳' },
    { key: 'display', g: 'room', name: '장식장', en: 'display cabinet with glass doors and shelves', d: 0.4, w: 1.2, ht: 1.9, tip: '앞쪽(문 쪽)' },
    // 주방 (2026-10-30)
    { key: 'fridge', g: 'kitchen', name: '냉장고장', en: 'built-in refrigerator cabinet (refrigerator inside)', d: 0.7, w: 1.0, ht: null, tip: '앞쪽(문 여는 쪽)' },
    { key: 'range', g: 'kitchen', name: '렌지장', en: 'tall appliance cabinet with a built-in microwave and oven', d: 0.6, w: 0.6, ht: null, tip: '앞쪽(문 여는 쪽)' },
    { key: 'base', g: 'kitchen', name: '하부장', en: 'run of kitchen base cabinets with a countertop', d: 0.6, w: 2.4, ht: 0.85, tip: '앞쪽(서서 쓰는 쪽)', multi: true },
    { key: 'table', g: 'kitchen', name: '식탁', en: 'dining table with chairs', d: 0.9, w: 1.6, ht: 0.75, axis: true, tip: '긴 쪽이 향할 곳' },
    // 욕실 (2026-10-30)
    { key: 'bath', g: 'bath', name: '욕조', en: 'bathtub', d: 0.75, w: 1.5, ht: 0.55, tip: '앞쪽(들어가는 쪽)' },
    { key: 'shower', g: 'bath', name: '샤워부스', en: 'glass shower booth', d: 0.9, w: 0.9, ht: 2.0, tip: '앞쪽(문 쪽)' },
    { key: 'toilet', g: 'bath', name: '변기', en: 'toilet', d: 0.7, w: 0.4, ht: 0.78, tip: '앞쪽(앉는 쪽)' },
    { key: 'basin', g: 'bath', name: '세면대', en: 'washbasin on a vanity cabinet', d: 0.5, w: 0.8, ht: 0.85, tip: '앞쪽(쓰는 쪽)' },
    { key: 'mirror', g: 'bath', name: '거울', en: 'tall wall mirror', d: 0.03, w: 0.6, ht: 2.0, tip: '앞쪽(비치는 쪽)' },
    // 구조 (2026-10-30) — 기둥: 한 번만 누름(크기 = 가로), 가벽: 한쪽 끝 → 다른 쪽 끝 (높이를 정할 수 있음, 비우면 천장까지)
    { key: 'col', g: 'struct', name: '기둥', en: 'structural column (a square pillar)', d: 0.4, w: 0.4, ht: null, nodir: true, multi: true },
    { key: 'part', g: 'struct', name: '가벽', en: 'partition wall', d: 0.12, w: 1.5, ht: null, line: true, multi: true },
  ];
  var FURN_GROUPS = [{ g: 'room', name: '거실·방' }, { g: 'kitchen', name: '주방' }, { g: 'bath', name: '욕실' }, { g: 'struct', name: '구조' }];
  var FURN_MULTI = 6;   // 하부장·기둥·가벽은 여러 개 (#2 … #6)
  function furnDef(k) { return FURN.filter(function (f) { return f.key === String(k).split('#')[0]; })[0] || null; }
  // 가구 열쇠: 'sofa' 또는 여러 개 놓는 것은 'col', 'col#2' … → { d: 종류, n: 몇 번째 } | null
  function furnKey(key) {
    var m = /^([a-z]+)(?:#([2-9]))?$/.exec(String(key || '')), d = m && furnDef(m[1]);
    if (!d || (m[2] && (!d.multi || +m[2] > FURN_MULTI))) return null;
    return { d: d, n: m[2] ? +m[2] : 1 };
  }
  /** 놓인 가구 열쇠를 종류 순서·번호 순서로 */
  function furnKeys(f) {
    return Object.keys(f || {}).filter(function (k) { return furnKey(k); }).sort(function (a, b) {
      var A = furnKey(a), B = furnKey(b); return FURN.indexOf(A.d) - FURN.indexOf(B.d) || A.n - B.n;
    });
  }
  /**
   * 가구 위치 다듬기 → { tv: {…}, col: {…}, 'col#2': {…} } (없는 것은 빠짐)
   * 가벽(line): x, y = 가운데, tx, ty = 한쪽 끝, L = 길이(도면 가로 단위), h = 높이(m, 없으면 천장까지)
   */
  // 크기: w 가로, dp 깊이(없으면 기본), h 높이(없으면 기본 — 붙박이장·기둥·가벽 등은 천장까지)
  function furnOf(f) {
    var out = {};
    if (!f || typeof f !== 'object' || Array.isArray(f)) return out;
    furnKeys(f).forEach(function (key) {
      var d = furnKey(key).d, src = f[key], c = camOf(src); if (!c) return;
      var w = Number(src.w); c.w = isFinite(w) && w >= 0.2 && w <= 8 ? Math.round(w * 100) / 100 : d.w;
      var dp = Number(src.dp); if (src.dp != null && src.dp !== '' && !d.line && !d.nodir && isFinite(dp) && dp >= 0.02 && dp <= 5) c.dp = Math.round(dp * 100) / 100;
      var h = Number(src.h); if (src.h != null && src.h !== '' && isFinite(h) && h >= 0.1 && h <= 4) c.h = Math.round(h * 100) / 100;
      if (d.nodir) { c.tx = null; c.ty = null; }
      if (d.line) {
        if (c.tx == null) return;
        var L = Number(src.L); c.L = isFinite(L) && L > 0.003 && L <= 2 ? Math.round(L * 1e4) / 1e4 : Math.round(Math.hypot(c.tx - c.x, (c.ty - c.y) * (c.ar || 1)) * 2e4) / 1e4;
      }
      out[key] = c;
    });
    return out;
  }
  function pt1000(y, x) { return '[' + Math.round(y * 1000) + ', ' + Math.round(x * 1000) + ']'; }
  function furnArt(d) { return d.multi ? 'a ' : 'the '; }
  function heightTxt(f) { return f.h ? ', ' + f.h + ' m high (not reaching the ceiling)' : ', reaching the ceiling'; }
  // 크기 글: 'about 2.3 m wide, 0.9 m deep, 0.8 m high' (깊이·높이는 디자이너가 정했을 때만)
  function sizeTxt(d, f) {
    if (d.line) return '';
    var a = [d.nodir ? f.w + ' m square' : f.w + ' m wide'];
    if (f.dp) a.push(f.dp + ' m deep');
    if (d.ht == null) a.push(f.h ? f.h + ' m high (not reaching the ceiling)' : 'reaching the ceiling');   // 붙박이장·냉장고장·렌지장·기둥
    else if (f.h) a.push(f.h + ' m high');
    return 'about ' + a.join(', ');
  }
  // 가구 하나: 도면 기준 (도면 읽기 AI·전체 조감도용)
  function furnPlanOne(key, f, scale) {
    var d = furnDef(key), i = dirIdx(f);
    if (d.nodir) return furnArt(d) + d.en + ' (' + d.name + ', ' + sizeTxt(d, f) + ') at ' + pt1000(f.y, f.x);
    if (d.line) return furnArt(d) + d.en + ' (' + d.name + ') from ' + pt1000(2 * f.y - f.ty, 2 * f.x - f.tx) + ' to ' + pt1000(f.ty, f.tx) + (scale > 0 ? ', about ' + (Math.round(f.L * scale * 10) / 10) + ' m long' : '') + heightTxt(f);
    var dir = i < 0 ? '' : d.axis ? ', its long side running ' + (i % 4 === 0 ? 'north-south (top to bottom of the plan image)' : i % 4 === 2 ? 'east-west (left to right of the plan image)' : 'diagonally')
      : ', its ' + (d.foot ? 'foot end' : 'front') + ' facing ' + COMPASS[i] + ' (the ' + DIRS[i] + ' of the plan image)';
    return furnArt(d) + d.en + ' (' + d.name + ', ' + sizeTxt(d, f) + ') centred at ' + pt1000(f.y, f.x) + dir;
  }
  /** 가구 전부: 도면 기준 한 줄 | '' (scale: 도면 가로 전체 길이 m — 가벽 길이를 쓸 때) */
  function furnPlan(furn, scale) {
    furn = furnOf(furn);
    return furnKeys(furn).map(function (k) { return furnPlanOne(k, furn[k], scale); }).join('; ');
  }
  function relDeg(cam, x, y, ar) {   // 카메라 정면에서 시계 방향으로 몇 도(-180~180)에 있는지
    var a0 = Math.atan2(cam.tx - cam.x, -(cam.ty - cam.y) * ar), a1 = Math.atan2(x - cam.x, -(y - cam.y) * ar);
    return (((a1 - a0) * 180 / Math.PI) + 540) % 360 - 180;
  }
  /**
   * 이 카메라에서 본 가구 자리 (사진에 보일 만한 것만) → '' | 'the sofa on the left side of the photo, about 3 m from the camera, facing right; …'
   * scale: 도면 그림 가로 전체의 실제 길이(m — 3D 밑그림 벽 선이 있을 때만, 없으면 거리는 안 씀)
   */
  function furnCam(furn, cam, scale) {
    furn = furnOf(furn); cam = camOf(cam);
    if (!cam || cam.tx == null) return '';
    var ar = cam.ar || 1, out = [];
    var camA = Math.atan2(cam.tx - cam.x, -(cam.ty - cam.y) * ar);
    var rel = function (x0, y0, x1, y1) { return (((Math.atan2(x1 - x0, -(y1 - y0) * ar) - camA) * 180 / Math.PI) + 540) % 360 - 180; };
    var axisTxt = function (f) { var q = Math.abs(rel(f.x, f.y, f.tx, f.ty)) % 180; q = Math.min(q, 180 - q); return q < 35 ? 'running away from the camera' : q > 55 ? 'running across the photo (left to right)' : 'set diagonally'; };
    furnKeys(furn).forEach(function (key) {
      var d = furnDef(key), f = furn[key];
      var deg = relDeg(cam, f.x, f.y, ar), m = Math.abs(deg);
      if (d.line) [[f.tx, f.ty], [2 * f.x - f.tx, 2 * f.y - f.ty]].forEach(function (e) { var dd = relDeg(cam, e[0], e[1], ar); if (Math.abs(dd) < m) { m = Math.abs(dd); deg = dd; } });   // 가벽은 한쪽 끝만 보여도
      if (m > 70) return;   // 사진 밖(옆·뒤)
      var side = deg > 0 ? 'right' : 'left';
      var where = m <= 10 ? 'straight ahead (centre of the photo)' : m <= 22 ? 'ahead, slightly ' + side + ' of centre' : m <= 38 ? 'on the ' + side + ' side of the photo' : 'at the ' + side + ' edge of the photo (partly out of frame)';
      var dist = scale > 0 ? ', about ' + (Math.round(Math.hypot(f.x - cam.x, (f.y - cam.y) * ar) * scale * 10) / 10) + ' m from the camera' : '';
      var face = '';
      if (d.line) face = ', ' + axisTxt(f) + (scale > 0 ? ', about ' + (Math.round(f.L * scale * 10) / 10) + ' m long' : '') + heightTxt(f);
      else if (d.nodir) face = ', ' + sizeTxt(d, f);
      else if (f.tx != null) {
        var fd = rel(f.x, f.y, f.tx, f.ty), a = Math.abs(fd);
        if (d.axis) face = ', its long side ' + axisTxt(f);
        else if (d.foot) face = a >= 135 ? ', its foot end toward the camera' : a <= 45 ? ', its headboard toward the camera' : ', its foot end pointing ' + (fd > 0 ? 'right' : 'left');
        else face = a >= 135 ? ', facing the camera' : a <= 45 ? ', facing away from the camera (its back toward the camera)' : ', facing ' + (fd > 0 ? 'right' : 'left');
      }
      out.push(furnArt(d) + d.en + (d.line || d.nodir ? '' : ' (' + sizeTxt(d, f) + ')') + ' ' + where + dist + face);
    });
    return out.join('; ');
  }
  // 3D 밑그림 파일 (관리화면이 카메라 자리에서 본 회색 그림을 그려 올린 것 — render-walls.js) · 현재 집 사진도 같은 모양의 경로
  var GUIDE_RE = /^(u\/)?renders\/[0-9a-f-]{36}\/[\w.-]{1,100}\.jpg$/i;
  var REFS_MAX = 6;   // 현재 집 사진 (참고용) 최대 장수
  /** 자재 사진 목록 다듬기 → [{ text, path }] */
  function matsOf(a) {
    return (Array.isArray(a) ? a : []).filter(function (m) { return m && typeof m.path === 'string' && GUIDE_RE.test(m.path); })
      .slice(0, MATS_MAX).map(function (m) { return { text: t(m.text, 120), path: m.path }; });
  }
  /** 현재 집 사진 목록 다듬기 → [{ path, view }] (view: 어느 공간 사진인지, '' = 모름) */
  function refsOf(a) {
    return (Array.isArray(a) ? a : []).filter(function (r) { return r && typeof r.path === 'string' && GUIDE_RE.test(r.path); })
      .slice(0, REFS_MAX).map(function (r) { return { path: r.path, view: viewOf(r.view) && r.view !== 'overview' ? r.view : '' }; });
  }
  /** 서버에서 받은 input 다듬기 (길이·종류 제한) */
  function cleanInput(x) {
    x = x && typeof x === 'object' ? x : {};
    var out = { size: t(x.size, 6).replace(/[^0-9.]/g, ''), lines: (Array.isArray(x.lines) ? x.lines : []).slice(0, LINES_MAX).map(function (l) { return t(l, LINE_MAX); }).filter(Boolean),
      style: styleOf(x.style).key, memo: t(x.memo, MEMO_MAX) };
    var c = camOf(x.cam); if (c) { out.cam = c; if (x.camMark === true) out.camMark = true; }   // camMark: 도면 그림에 빨간 점·화살표를 그려서 보냄
    if (typeof x.guide === 'string' && GUIDE_RE.test(x.guide)) out.guide = x.guide;               // guide: 3D 밑그림 (그림 AI가 이 구도 그대로 그림)
    var fu = furnOf(x.furn); if (Object.keys(fu).length) out.furn = fu;                            // furn: 디자이너가 놓은 가구 자리
    var sc = Number(x.scale); if (isFinite(sc) && sc >= 1 && sc <= 300) out.scale = Math.round(sc * 1000) / 1000;   // scale: 도면 가로 전체 길이(m)
    var rf = refsOf(x.refs); if (rf.length) out.refs = rf;                                         // refs: 현재 집 사진
    var mt = matsOf(x.mats); if (mt.length) out.mats = mt;                                         // mats: 자재 사진
    return out;
  }
  /** 공사 내용이 같은지 (평수·공사 줄만 — 예전 내용으로 만든 그림 알아보기) */
  function sameContent(a, b) {
    var f = function (x) { x = x || {}; return JSON.stringify([t(x.size, 6), (x.lines || []).map(function (l) { return t(l, LINE_MAX); })]); };
    return f(a) === f(b);
  }

  // ① 글 AI(Claude 또는 Gemini)에게: 도면을 읽고 공간마다 그림 설명 쓰기
  var SYSTEM = [
    'You are the visualization assistant of a Korean interior remodeling company.',
    'You receive a 2D floor plan image of a Korean apartment or house, the planned work and finishes (from the company\'s estimate plus the designer\'s own notes), the views to render, a style and an optional request from the designer.',
    'For each requested view, write one English prompt for an image-generation model. That model will receive the SAME floor plan image together with your prompt.',
    '',
    'Rules for every prompt:',
    '- Photorealistic interior rendering with natural daylight and realistic materials; typical Korean apartment proportions (ceiling about 2.3 m).',
    '- Keep walls, doors, windows and room positions exactly as drawn on the plan. The image model reads floor plans poorly, so describe the layout of the space in words as if the plan were not attached.',
    '- Single room: eye-level wide-angle view (camera about 1.5 m high). First say where the camera stands and which way it looks, in plan terms (e.g. "camera stands by the kitchen island looking toward the balcony windows"). Then describe, as seen from the camera, the far wall, the left side and the right side: windows or sliding doors and what lies beyond them (e.g. balcony, flower bed), doors and which room they lead to, wide openings to neighbouring spaces (e.g. open kitchen and dining area behind or beside), and built-in elements drawn on the plan (kitchen island, partition walls or louvers, built-in wardrobes, bathtub, shower booth). Give the approximate width and depth of the space in metres from the plan\'s dimensions or areas.',
    '- Do not add windows, doors or openings that the plan does not show. Ignore shared areas outside the home (stairs, elevators, corridors) and any title text on the plan.',
    '- Some views come with a camera point fixed by the designer, given as [y, x] on the floor plan image normalized to 0-1000 (y from the top edge, x from the left edge), and often a point it looks toward. For those views the plan image may also show a red dot (where the camera stands), a red arrow and a light red wedge (the viewing direction and field of view). Use exactly that standing point and direction: work out which room the point is in, which walls, openings and furniture zones fall inside the wedge, and describe only what is visible from that spot in that direction (what is straight ahead, what is on the left and right edges of the frame). Say the viewing direction in room terms (e.g. "looking diagonally from the balcony-side corner toward the kitchen island and the louvered partition"). If the point is in a different space than the view name, follow the point. Never ask the image model to draw the red marks.',
    '- Some views also come with a guide image: a plain grey 3D massing render of that exact view (camera position, eye height, lens and direction) built from the plan\'s walls. Pale blue-white areas in it are window glass with daylight outside; see-through holes are doors or openings into the next space. The image model receives that guide instead of the floor plan. For those views, write the prompt as instructions to finish that exact grey scene: say what each visible surface of the guide is and which finish it gets (floor, ceiling, the wall straight ahead, the left and right walls, built-in elements), what the windows and door openings look out to, and where furniture goes relative to those walls (e.g. "sofa against the left wall, facing a TV wall straight ahead"). Do not describe a different viewpoint, and do not move, add or remove walls, doors or windows.',
    '- Compass words: read the plan image with north at the top (east = right edge, south = bottom edge, west = left edge). The designer\'s notes (Korean) may name sides or walls with them (동 east, 서 west, 남 south, 북 north; e.g. 서쪽 벽 = the wall on the west side of that room). Each camera-fixed view comes with a line saying where each side of the plan appears from that camera; use it to place those items in camera terms, and leave out items on a side that is behind the camera. For views without a fixed camera, choose the viewpoint yourself and convert the same way.',
    '- In every image prompt, describe positions only as seen from the camera (straight ahead, on the left, on the right). Never write compass words (north, east, south, west) or directions of the plan image (top, bottom, left or right of the plan) in a prompt - the image model applies them to the photo itself (it puts "west" on the left of the photo whichever way the camera faces).',
    '- The designer may fix furniture positions on the plan (living room and bedroom furniture, kitchen cabinets, bathroom fixtures) and add structure (columns, partition walls - a partition wall that does not reach the ceiling is a half-height wall). Put those pieces exactly where given, facing as given, and keep them in the prompt: for camera-fixed views use that view\'s furniture line (already in camera terms); leave out pieces that are not in view. Add other furniture only where it does not clash with them. In a guide image, the darker grey blocks are these pieces.',
    '- The designer may attach photos of the home as it is now, before remodeling, each labelled with its space. Use them to understand the real structure (window sizes and positions, sill heights, ceiling, beams, columns, door positions, balcony) and describe that structure in the prompt; their finishes, furniture and clutter will all be replaced, so do not describe them. The image model also receives the photos labelled with the view\'s own space.',
    '- The designer may attach material sample photos (labelled "material sample 1", … with the item they belong to, e.g. 마루: 강마루 → the floor). Describe each sampled material\'s colour, pattern and texture in the prompts for the views where that surface shows. The image model also receives these samples.',
    '- Whole-home overview: 3D isometric cutaway from above at about 45 degrees, ceiling removed, every room furnished appropriately, with the same room arrangement and orientation as the plan (the top of the plan at the back of the picture, so west stays on the left and east on the right).',
    '- Text in square brackets after an item is the designer\'s color/finish detail for that item (e.g. 실크 벽지 [화이트 무광] → white matte wallpaper; 강마루 [밝은 오크] → light oak flooring). Follow it exactly.',
    '- Use only the finishes from the list that apply to that space, described visually (e.g. 강마루 → light oak engineered wood flooring; 실크 벽지 → smooth matte wallpaper; 우물천장 간접조명 → recessed ceiling tray with hidden LED cove light). Do not invent brand names or built-ins that the list or plan does not suggest; ordinary movable furniture and decor are fine.',
    '- Apply the style and the designer\'s request, unless the request asks for text or anything unrelated to the interior.',
    '- Never ask for text, room labels, dimension lines, logos, watermarks or people in the image.',
    '- At most 1200 characters per prompt.',
    '',
    'Also write a Korean caption (at most 50 characters) listing 2 to 4 main finishes visible in that view, e.g. "강마루 바닥 · 실크 벽지 · 우물천장 간접조명".',
    'Set "found": false only if the plan clearly has no such space (e.g. no dressing room). For 작은방 use the smallest bedroom.',
    'Set "plan_ok": false only if the image is clearly not an architectural floor plan.',
    '',
    'Reply with JSON only, no other text:',
    '{"plan_ok": true, "views": [{"id": "<view id>", "found": true, "caption": "…", "prompt": "…"}]}',
  ].join('\n');

  function linesText(inp) { return inp.lines.length ? inp.lines.map(function (l) { return '- ' + l; }).join('\n') : '- (none listed — choose finishes that suit the style)'; }
  /** Claude에게 보낼 글 (도면 그림은 서버가 따로 붙임). views = [{ id, view }], inp = cleanInput 결과 */
  function agentText(inp, views) {
    return [
      'Home size: ' + (inp.size ? inp.size + ' pyeong (Korean unit)' : 'unknown'),
      'Planned work and finishes (Korean):',
      linesText(inp),
      'Style: ' + styleOf(inp.style).en,
      'Designer\'s request (Korean, optional): ' + (inp.memo || '(none)'),
      inp.furn ? 'Furniture and structure placed by the designer on the plan: ' + furnPlan(inp.furn, inp.scale) + '.' : '',
      inp.refs ? 'Photos of the home as it is now (attached as "current photo 1", "current photo 2", …): ' + inp.refs.map(function (r, i) { var v = viewOf(r.view); return 'current photo ' + (i + 1) + ' = ' + (v ? v.en + ' (' + v.name + ')' : 'space not labelled'); }).join('; ') + '.' : '',
      inp.mats ? 'Material sample photos (attached as "material sample 1", …): ' + inp.mats.map(function (m, i) { return 'material sample ' + (i + 1) + ' = ' + m.text; }).join('; ') + '.' : '',
      'Views to render:',
      views.map(function (v) {
        var x = viewOf(v.view) || VIEWS[0], c = x.key === 'overview' ? '' : camText(v.cam);
        return '- id ' + v.id + ': ' + x.en + ' (' + x.name + ')' + (c ? ' — designer-fixed ' + c + (v.mark ? ', also drawn on the plan as a red dot, arrow and wedge' : '') : '') +
          (c && sidesText(v.cam) ? '; from this camera ' + sidesText(v.cam) : '') +
          (c && inp.furn && v.cam && v.cam.tx != null ? '; designer-placed furniture in view from this camera: ' + (furnCam(inp.furn, v.cam, inp.scale) || 'none') : '') +
          (v.guide && x.key !== 'overview' ? '; its grey 3D guide image is attached as "guide ' + v.id + '"' : '');
      }).join('\n'),
    ].filter(Boolean).join('\n');
  }

  /** 도면 읽기 답(JSON) 읽기 → { planOk, byId: { id: { found, caption, prompt } }, list: [같은 것, 답 순서대로] } (못 읽으면 null) */
  function parseAgent(text) {
    var s = String(text || ''), a = s.indexOf('{'), b = s.lastIndexOf('}');
    if (a < 0 || b <= a) return null;
    var j; try { j = JSON.parse(s.slice(a, b + 1)); } catch (e) { return null; }
    if (!j || !Array.isArray(j.views)) return null;
    var byId = {};
    j.views.forEach(function (v) {
      if (!v || !v.id) return;
      byId[String(v.id)] = { found: v.found !== false, caption: t(v.caption, 60), prompt: String(v.prompt || '').trim().slice(0, 1600) };
    });
    var list = j.views.filter(function (v) { return v && v.id; }).map(function (v) { return byId[String(v.id)]; });
    return { planOk: j.plan_ok !== false, byId: byId, list: list };
  }

  /** Claude 없이 바로 그릴 때 쓰는 설명 (inp = cleanInput 결과, guided = 3D 밑그림을 같이 보낼 때) */
  function fallback(inp, view, guided) {
    var v = viewOf(view) || VIEWS[0];
    guided = !!guided && v.key !== 'overview';
    var shot = v.key === 'overview'
      ? 'Create a photorealistic 3D isometric cutaway rendering of the whole home shown in the attached floor plan, seen from above at about 45 degrees with the ceiling removed. Furnish every room appropriately.'
      : guided ? 'Create a photorealistic eye-level interior rendering of ' + v.en + ' by finishing the attached grey 3D guide image of it.'
        : 'Create a photorealistic eye-level interior rendering of ' + v.en + ' shown in the attached floor plan, wide-angle, camera about 1.5 m high.' +
          (inp.cam ? ' Viewpoint on the attached floor plan image (coordinates [y, x] normalized to 0-1000 from the top-left corner): ' + camText(inp.cam) + '.' + (inp.camMark ? ' It is also marked on the plan with a red dot and arrow.' : '') : '');
    return [
      shot,
      (guided ? 'Keep every wall, door and window exactly where the guide shows it.' : 'Keep walls, doors, windows and room positions exactly as drawn on the plan.') +
        ' Typical Korean apartment' + (inp.size ? ' of about ' + inp.size + ' pyeong (Korean unit)' : '') + ', ceiling about 2.3 m, natural daylight.',
      inp.lines.length ? 'Planned work and finishes (Korean): ' + inp.lines.join('; ') + '.' : '',
      'Style: ' + styleOf(inp.style).en + '.',
      inp.memo ? 'Designer\'s request (Korean): ' + inp.memo : '',
    ].filter(Boolean).join('\n');
  }

  // ② 그림 AI에 보낼 때 항상 덧붙이는 말
  var FINAL = 'Use the attached floor plan as the layout reference for this space: keep the same wall positions, door and window locations and openings to neighbouring spaces as described above. The result must be a rendered interior image, not a copy of the plan. Do not draw any text, room labels, dimension lines, logos, watermarks or people.';
  var MARK = 'The red dot, red arrow and light red wedge drawn on the floor plan show where the camera stands and which way it looks: render the view from exactly that spot in that direction, framed by the wedge. They are only markers - never draw them.';
  // 3D 밑그림을 보낼 때 (도면 대신)
  var GUIDE = 'The attached image is a plain grey 3D massing render of this exact space, built from the floor plan and seen from the exact camera position, eye height, lens and direction to use. Turn it into a finished photorealistic interior photograph: keep the camera, perspective and framing exactly the same, and keep every wall, corner, ceiling line, door opening and window opening at exactly the same place and size in the frame - do not add, remove, move or resize walls, doors or windows. Pale blue-white areas are window glass with daylight outside; holes in the walls are door openings or openings into the next space. Replace the grey surfaces with the finishes described, put frames and doors in door openings, and add furniture, lighting and decor that suit the description. Do not draw any text, room labels, dimension lines, logos, watermarks or people.';
  // 카메라 방향을 찍은 그림: 방위가 사진의 어디인지 (설명·요청 사항에 동서남북이 남아 있어도 사진의 왼쪽·오른쪽으로 잘못 놓지 않게)
  function sidesNote(cam) {
    var t = sidesText(cam);
    return t ? 'Left and right in this description mean the left and right of the photo as seen from the camera. If the description or the designer\'s notes name plan directions (north 북, east 동, south 남, west 서 - north is the top of the floor plan), they are NOT directions in the photo: from this camera ' + t + '.' : '';
  }
  /**
   * 그림 AI에 보내는 글 (marked: 도면에 빨간 카메라 표시를 그려서 보낼 때, guided: 도면 대신 3D 밑그림을 보낼 때, cam: 그 그림의 카메라)
   * o = { inp: cleanInput 결과 (가구 자리), overview: 전체 조감도인지, refs: 같이 보내는 현재 집 사진 장수 }
   */
  function imagePrompt(p, marked, guided, cam, o) {
    o = o || {};
    var sn = sidesNote(cam), inp = o.inp || {}, fn = '';
    if (inp.furn) {
      var fc = o.overview ? furnPlan(inp.furn, inp.scale) : furnCam(inp.furn, cam, inp.scale);
      if (fc) fn = (o.overview ? 'Furniture positions fixed by the designer on the floor plan (keep the plan orientation): ' : 'Furniture fixed by the designer - keep each piece exactly here, as seen from the camera: ') + fc + '.' + (guided && !o.overview ? ' In the guide image these are the darker grey blocks.' : '');
    }
    var mn = o.mats && o.mats.length ? 'Images labelled "material sample" are photos of the chosen materials: ' + o.mats.map(function (m, i) { return 'material sample ' + (i + 1) + ' = ' + m; }).join('; ') + '. Use each sample\'s exact colour, pattern and texture for that surface wherever it appears in this view; never show the sample photos themselves.' : '';
    var many = o.refs > 1, rn = o.refs > 0 ? (many ? 'The ' + o.refs + ' images labelled "current photo" show' : 'The image labelled "current photo" shows') + ' this same space as it is now, before remodeling: use ' + (many ? 'them' : 'it') + ' only for the real structure (window sizes and positions, sill heights, ceiling, beams, door positions), not for finishes, furniture or decor, and never copy ' + (many ? 'their' : 'its') + ' clutter.' : '';
    return String(p || '').trim() + '\n\n' + [sn, fn, rn, mn].filter(Boolean).map(function (x) { return x + '\n'; }).join('') + (guided ? GUIDE : (marked ? MARK + '\n' : '') + FINAL);
  }

  return { VIEWS: VIEWS, STYLES: STYLES, MAX_VIEWS: MAX_VIEWS, MEMO_MAX: MEMO_MAX, LINE_MAX: LINE_MAX, NOTE_MAX: NOTE_MAX, COLORS: COLORS, FINISHES: FINISHES, CUSTOM_LEN: CUSTOM_LEN, CUSTOM_MAX: CUSTOM_MAX, viewOf: viewOf, styleOf: styleOf,
    fromEstimate: fromEstimate, linesOf: linesOf, lineText: lineText, itemState: itemState, mergeItems: mergeItems, changes: changes, compose: compose, cleanInput: cleanInput, sameContent: sameContent, camOf: camOf, camText: camText, camDir: camDir, camDirKo: camDirKo, camSides: camSides, sidesText: sidesText,
    FURN: FURN, FURN_GROUPS: FURN_GROUPS, FURN_MULTI: FURN_MULTI, furnDef: furnDef, furnKey: furnKey, furnKeys: furnKeys, furnOf: furnOf, furnPlan: furnPlan, furnCam: furnCam, REFS_MAX: REFS_MAX, refsOf: refsOf, MATS_MAX: MATS_MAX, matsOf: matsOf,
    SYSTEM: SYSTEM, agentText: agentText, parseAgent: parseAgent, fallback: fallback, imagePrompt: imagePrompt };
});
