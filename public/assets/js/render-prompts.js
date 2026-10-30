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
        return Object.assign({}, l, { on: w ? !!w.on : allOff ? false : l.on }, w && w.note ? { note: w.note } : {});
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
    return { size: t(doc.size, 6), lines: lines, style: styleOf(doc.style).key, memo: t(doc.memo, MEMO_MAX) };
  }
  /**
   * 카메라 위치 (관리화면에서 도면을 눌러 찍음) — 도면 그림 안의 비율 0~1
   * { x, y: 서 있는 곳, tx, ty: 바라보는 곳(없으면 null) } | null
   */
  function camOf(c) {
    if (!c || typeof c !== 'object') return null;
    var n = function (v) { v = Number(v); return isFinite(v) ? Math.max(0, Math.min(1, Math.round(v * 1000) / 1000)) : null; };
    var o = { x: c.x == null ? null : n(c.x), y: c.y == null ? null : n(c.y), tx: c.tx == null ? null : n(c.tx), ty: c.ty == null ? null : n(c.ty) };
    if (o.x == null || o.y == null) return null;
    if (o.tx == null || o.ty == null || (Math.abs(o.tx - o.x) < 0.01 && Math.abs(o.ty - o.y) < 0.01)) { o.tx = null; o.ty = null; }
    return o;
  }
  // AI에게 알려 줄 때: 도면 그림 위의 [y, x] (0~1000, 위·왼쪽부터 — Gemini가 그림 위치를 읽는 방식과 같게)
  var DIRS = ['top', 'top right', 'right', 'bottom right', 'bottom', 'bottom left', 'left', 'top left'];
  /** 바라보는 쪽을 말로: 도면 그림에서 위·오른쪽 위… (위 = 그림의 위쪽, 시계 방향) */
  function camDir(c) {
    c = camOf(c); if (!c || c.tx == null) return '';
    var a = Math.atan2(c.tx - c.x, -(c.ty - c.y)) * 180 / Math.PI;   // 0 = 위, 90 = 오른쪽
    return DIRS[(Math.round(((a + 360) % 360) / 45)) % 8];
  }
  function camText(c) {
    c = camOf(c); if (!c) return '';
    var pt = function (y, x) { return '[' + Math.round(y * 1000) + ', ' + Math.round(x * 1000) + ']'; };
    return 'camera standing at ' + pt(c.y, c.x) + (c.tx != null ? ', looking toward ' + pt(c.ty, c.tx) + ' (that is, toward the ' + camDir(c) + ' of the plan image)' : ', looking in the most natural direction from there');
  }
  // 3D 밑그림 파일 (관리화면이 카메라 자리에서 본 회색 그림을 그려 올린 것 — render-walls.js)
  var GUIDE_RE = /^(u\/)?renders\/[0-9a-f-]{36}\/[\w.-]{1,100}\.jpg$/i;
  /** 서버에서 받은 input 다듬기 (길이·종류 제한) */
  function cleanInput(x) {
    x = x && typeof x === 'object' ? x : {};
    var out = { size: t(x.size, 6).replace(/[^0-9.]/g, ''), lines: (Array.isArray(x.lines) ? x.lines : []).slice(0, LINES_MAX).map(function (l) { return t(l, LINE_MAX); }).filter(Boolean),
      style: styleOf(x.style).key, memo: t(x.memo, MEMO_MAX) };
    var c = camOf(x.cam); if (c) { out.cam = c; if (x.camMark === true) out.camMark = true; }   // camMark: 도면 그림에 빨간 점·화살표를 그려서 보냄
    if (typeof x.guide === 'string' && GUIDE_RE.test(x.guide)) out.guide = x.guide;               // guide: 3D 밑그림 (그림 AI가 이 구도 그대로 그림)
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
    '- Whole-home overview: 3D isometric cutaway from above at about 45 degrees, ceiling removed, every room furnished appropriately, with the same room arrangement as the plan.',
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
      'Views to render:',
      views.map(function (v) {
        var x = viewOf(v.view) || VIEWS[0], c = x.key === 'overview' ? '' : camText(v.cam);
        return '- id ' + v.id + ': ' + x.en + ' (' + x.name + ')' + (c ? ' — designer-fixed ' + c + (v.mark ? ', also drawn on the plan as a red dot, arrow and wedge' : '') : '') +
          (v.guide && x.key !== 'overview' ? '; its grey 3D guide image is attached as "guide ' + v.id + '"' : '');
      }).join('\n'),
    ].join('\n');
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
  /** 그림 AI에 보내는 글 (marked: 도면에 빨간 카메라 표시를 그려서 보낼 때, guided: 도면 대신 3D 밑그림을 보낼 때) */
  function imagePrompt(p, marked, guided) { return String(p || '').trim() + '\n\n' + (guided ? GUIDE : (marked ? MARK + '\n' : '') + FINAL); }

  return { VIEWS: VIEWS, STYLES: STYLES, MAX_VIEWS: MAX_VIEWS, MEMO_MAX: MEMO_MAX, LINE_MAX: LINE_MAX, NOTE_MAX: NOTE_MAX, COLORS: COLORS, FINISHES: FINISHES, CUSTOM_LEN: CUSTOM_LEN, CUSTOM_MAX: CUSTOM_MAX, viewOf: viewOf, styleOf: styleOf,
    fromEstimate: fromEstimate, linesOf: linesOf, lineText: lineText, itemState: itemState, mergeItems: mergeItems, changes: changes, compose: compose, cleanInput: cleanInput, sameContent: sameContent, camOf: camOf, camText: camText, camDir: camDir,
    SYSTEM: SYSTEM, agentText: agentText, parseAgent: parseAgent, fallback: fallback, imagePrompt: imagePrompt };
});
