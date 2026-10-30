/* =====================================================================
   3D 그림 — 3D 밑그림 (도면의 벽 → 회색 상자 3D → 카메라 자리에서 본 회색 그림)
   · 관리화면(브라우저)과 서버 함수(netlify/functions/render-walls.mjs)가 같은 파일을 씁니다.
     브라우저: <script src="render-walls.js"> → window.RenderWalls
     서버: import RW from '../../public/assets/js/render-walls.js'
   · 순서: ① 서버 함수가 글 AI(Gemini)에게 도면의 벽·문·창 선을 받아 옴 (EXTRACT → cleanAI)
           ② 관리화면이 그 선을 도면의 진한 벽선에 맞춰 붙이고(fromAI) 도면 위에 그려 고칠 수 있게 함 (cut)
           ③ 그림을 만들 때 카메라 자리에서 본 회색 밑그림을 그려(raster) 그림 AI에 같이 보냄
              → 그림 AI는 밑그림의 벽·문·창 자리와 구도를 그대로 두고 마감재·가구만 입힘
   · 좌표: 도면 그림 안의 비율 0~1 (x = 가로, y = 세로, 위·왼쪽부터) — 카메라 위치(cams)와 같음
           길이는 '가로 단위'(X = x, Y = y × ar, ar = 도면 세로/가로)로 계산하고, 미터 = 가로 단위 × m (도면 그림 가로 전체의 실제 길이)
   · 저장 모양 (3D 그림 작업 doc.walls):
     { ar, m, h: 천장 높이, src: 크기를 어떻게 정했는지('dims' 도면 치수 | 'size' 평수 | 'guess' 어림 | 'user' 직접), s: [[x1, y1, x2, y2, 종류], …] }
     종류: w 벽 · d 문 · n 반창(허리 높이부터 오는 창) · g 전체창(바닥부터 오는 창·발코니 문) · o 뚫림(벽 없는 통로)
   ===================================================================== */
(function (root, factory) {
  var api = factory();
  if (typeof module === 'object' && module.exports) module.exports = api;
  else root.RenderWalls = api;
})(typeof self !== 'undefined' ? self : this, function () {
  'use strict';

  var KINDS = [
    { k: 'w', name: '벽', color: '#2563EB' },
    { k: 'd', name: '문', color: '#16A34A' },
    { k: 'n', name: '반창', color: '#0891B2' },     // 창턱 0.9m ~ 2.1m
    { k: 'g', name: '전체창', color: '#9333EA' },   // 바닥 ~ 2.2m
    { k: 'o', name: '뚫림', color: '#D97706' },
  ];
  var KIND = {}; KINDS.forEach(function (x) { KIND[x.k] = x; });
  // 문·창 자리에서 뚫린 높이 [아래, 위] (미터). 벽은 안 뚫림, 뚫림(o)은 벽이 아예 없음
  var HOLE = { d: [0, 2.1], n: [0.9, 2.1], g: [0.08, 2.2] };
  var CEIL = 2.3;      // 천장 높이 (한국 아파트 보통 2.3m)
  var EYE = 1.4;       // 카메라 높이
  var FOV = 70;        // 가로 시야각(도) — 도면에 그리는 빨간 부채꼴과 같게
  var THICK = 0.15;    // 벽 두께(m)
  var MAX_SEGS = 400;
  var SRC = ['dims', 'size', 'guess', 'user'];
  var GUIDE_W = 1024, GUIDE_H = 768;   // 그림 AI에 보내는 밑그림 (그림과 같은 4:3)

  function num(v, lo, hi, dflt) { v = Number(v); return isFinite(v) ? Math.max(lo, Math.min(hi, v)) : dflt; }
  function r4(v) { return Math.round(v * 1e4) / 1e4; }
  function c01(v) { v = Number(v); return isFinite(v) ? Math.max(0, Math.min(1, v)) : NaN; }
  function mean(a) { return a.reduce(function (s, v) { return s + v; }, 0) / a.length; }

  /** 저장된 벽 다듬기 → { ar, m, h, src, s } | null */
  function clean(w) {
    if (!w || typeof w !== 'object' || !Array.isArray(w.s)) return null;
    var out = { ar: r4(num(w.ar, 0.05, 20, 1)), m: Math.round(num(w.m, 1, 300, 12) * 1000) / 1000, h: Math.round(num(w.h, 2, 4, CEIL) * 100) / 100,
      src: SRC.indexOf(w.src) >= 0 ? w.src : 'guess', s: [] };
    w.s.forEach(function (g) {
      if (!Array.isArray(g) || out.s.length >= MAX_SEGS) return;
      var a = [c01(g[0]), c01(g[1]), c01(g[2]), c01(g[3])];
      if (a.some(isNaN)) return;
      if (Math.abs(a[0] - a[2]) < 1e-4 && Math.abs(a[1] - a[3]) < 1e-4) return;
      out.s.push([r4(a[0]), r4(a[1]), r4(a[2]), r4(a[3]), KIND[g[4]] ? g[4] : 'w']);
    });
    return out;
  }
  /** 밑그림을 그릴 만한 벽이 있는지 */
  function has(w) { return !!(w && Array.isArray(w.s) && w.s.some(function (g) { return g[4] !== 'o'; })); }
  /** 선 길이 (가로 단위) */
  function segLen(g, ar) { return Math.hypot(g[2] - g[0], (g[3] - g[1]) * ar); }
  /** 선 길이 (미터) */
  function metres(g, w) { return segLen(g, w.ar) * w.m; }
  /** 점(px, py — 0~1)에서 선까지 가장 가까운 곳 → { d: 거리(가로 단위), t: 0~1, x, y } */
  function nearSeg(px, py, g, ar) {
    var ax = g[0], ay = g[1] * ar, dx = g[2] - ax, dy = g[3] * ar - ay, Y = py * ar, L2 = dx * dx + dy * dy;
    var t = L2 ? Math.max(0, Math.min(1, ((px - ax) * dx + (Y - ay) * dy) / L2)) : 0;
    var qx = ax + dx * t, qy = ay + dy * t;
    return { d: Math.hypot(px - qx, Y - qy), t: t, x: qx, y: qy / ar };
  }
  /** 점을 선이 지나는 직선 위로 (선 밖으로 나가도 됨) → [x, y] */
  function projLine(p, g, ar) {
    var ax = g[0], ay = g[1] * ar, dx = g[2] - ax, dy = g[3] * ar - ay, L2 = dx * dx + dy * dy;
    if (!L2) return [ax, g[1]];
    var t = ((p[0] - ax) * dx + (p[1] * ar - ay) * dy) / L2;
    return [ax + dx * t, (ay + dy * t) / ar];
  }
  /** 가로선 'h' · 세로선 'v' · 비스듬 '' */
  function axis(g) { return g[1] === g[3] ? 'h' : g[0] === g[2] ? 'v' : ''; }

  /**
   * 새 선(ns)을 넣기: 같은 줄 위에 겹치는 선은 겹친 부분을 잘라 내고 새 선을 넣음
   * → 벽 위에 문·창을 그으면 그 부분만 문·창으로 바뀜. 종류 'x'면 잘라 내기만 함
   */
  function cut(segs, ns, ar, tol) {
    tol = tol || 0.004;
    var ax = ns[0], ay = ns[1] * ar, bx = ns[2], by = ns[3] * ar, L = Math.hypot(bx - ax, by - ay);
    if (L < 1e-6) return segs.slice();
    var ux = (bx - ax) / L, uy = (by - ay) / L, out = [];
    segs.forEach(function (g) {
      var px = g[0], py = g[1] * ar, qx = g[2], qy = g[3] * ar, ex = qx - px, ey = qy - py, Lg = Math.hypot(ex, ey);
      if (Lg < 1e-6) return;
      var cross = Math.abs(ux * ey / Lg - uy * ex / Lg);
      var dp = Math.abs((px - ax) * uy - (py - ay) * ux), dq = Math.abs((qx - ax) * uy - (qy - ay) * ux);
      if (cross > 0.08 || dp > tol || dq > tol) { out.push(g); return; }   // 같은 줄이 아님
      var tp = (px - ax) * ux + (py - ay) * uy, tq = (qx - ax) * ux + (qy - ay) * uy, lo = Math.min(tp, tq), hi = Math.max(tp, tq);
      if (hi <= tol * 0.25 || lo >= L - tol * 0.25) { out.push(g); return; }   // 같은 줄이지만 안 겹침
      var at = function (t) { var s = (t - tp) / (tq - tp); return [px + ex * s, (py + ey * s) / ar]; };   // 원래 선 위의 점
      [[lo, 0], [L, hi]].forEach(function (r) {
        if (r[1] - r[0] < 0.002) return;
        var a = at(r[0]), b = at(r[1]);
        out.push([a[0], a[1], b[0], b[1], g[4]]);
      });
    });
    if (ns[4] !== 'x') out.push(ns.slice());
    return out;
  }

  /* ---------- AI가 딴 선 다듬기 ---------- */
  var TAN5 = Math.tan(5 * Math.PI / 180);
  // 거의 가로·세로인 선은 정확히 가로·세로로
  function straighten(segs, ar) {
    return segs.map(function (g) {
      var dx = g[2] - g[0], dy = (g[3] - g[1]) * ar, k = g.slice();
      if (Math.abs(dy) <= Math.abs(dx) * TAN5) { var y = (g[1] + g[3]) / 2; k[1] = y; k[3] = y; }
      else if (Math.abs(dx) <= Math.abs(dy) * TAN5) { var x = (g[0] + g[2]) / 2; k[0] = x; k[2] = x; }
      return k;
    });
  }
  /**
   * 도면 그림의 진한 벽선에 맞춰 붙이기 (AI 좌표는 조금씩 어긋나기 쉬움)
   * px = { lum: 밝기(0~255, 가로×세로), w, h } — 가로·세로 벽만, 가까운 진한 띠의 가운데로 옮김
   */
  function refine(segs, px) {
    if (!px || !px.lum || !(px.w > 0) || !(px.h > 0)) return segs;
    var W = px.w, H = px.h, Lm = px.lum, R = Math.max(3, Math.round(0.02 * Math.max(W, H)));
    var dark = function (x, y) { x = Math.round(x); y = Math.round(y); return x < 0 || y < 0 || x >= W || y >= H ? 0 : 255 - Lm[y * W + x]; };
    return segs.map(function (g) {
      if (g[4] !== 'w') return g;
      var hz = g[1] === g[3], vt = g[0] === g[2];
      if (!hz && !vt) return g;
      var a = hz ? Math.min(g[0], g[2]) * W : Math.min(g[1], g[3]) * H, b = hz ? Math.max(g[0], g[2]) * W : Math.max(g[1], g[3]) * H;
      var c = hz ? g[1] * H : g[0] * W, span = b - a;
      if (span < 8) return g;
      var lo = a + span * 0.15, hi = b - span * 0.15, n = Math.max(4, Math.min(80, Math.round((hi - lo) / 3)));
      var prof = [];
      for (var o = -R; o <= R; o++) {
        var s = 0;
        for (var k = 0; k <= n; k++) { var u = lo + (hi - lo) * k / n; s += hz ? dark(u, c + o) : dark(c + o, u); }
        prof.push(s / (n + 1));
      }
      var mx = Math.max.apply(null, prof), sorted = prof.slice().sort(function (p, q) { return p - q; }), med = sorted[sorted.length >> 1];
      if (mx < 90 || mx - med < 50) return g;   // 뚜렷한 진한 띠가 없으면 그대로
      // 진한 띠 중 지금 자리에서 가장 가까운 것
      var strong = med + (mx - med) * 0.8, best = -1;
      prof.forEach(function (v, i) { if (v >= strong && (best < 0 || Math.abs(i - R) < Math.abs(best - R))) best = i; });
      var th = med + (mx - med) * 0.5, i0 = best, i1 = best;
      while (i0 > 0 && prof[i0 - 1] >= th) i0--;
      while (i1 < prof.length - 1 && prof[i1 + 1] >= th) i1++;
      var off = (i0 + i1) / 2 - R;
      if (Math.abs(off) < 0.5) return g;
      var k2 = g.slice();
      if (hz) { var y = c01((c + off) / H); k2[1] = y; k2[3] = y; } else { var x = c01((c + off) / W); k2[0] = x; k2[2] = x; }
      return k2;
    });
  }
  // 끝점 맞추기: ① 다른 선 가까이에서 끝나면 그 선에 붙이고(ㄱ·T자) ② 가까운 끝점끼리 한 점으로 (가로선은 y, 세로선은 x를 지킴)
  function joinEnds(segs, ar, tol) {
    segs = segs.map(function (g) { return g.slice(); });
    segs.forEach(function (g, i) {
      [0, 2].forEach(function (e) {
        var best = null;
        segs.forEach(function (h, j) {
          if (j === i) return;
          var n = nearSeg(g[e], g[e + 1], h, ar);
          if (n.d < tol && (!best || n.d < best.d)) { best = n; best.h = h; }
        });
        if (!best) return;
        var ah = axis(best.h), ag = axis(g);
        if (ah === 'h' && ag === 'v') g[e + 1] = best.h[1];
        else if (ah === 'v' && ag === 'h') g[e] = best.h[0];
        else if (ah !== ag || !ah) { g[e] = best.x; g[e + 1] = best.y; }
      });
    });
    var pts = []; segs.forEach(function (g, i) { pts.push({ i: i, e: 0 }, { i: i, e: 2 }); });
    var used = [];
    pts.forEach(function (a, ia) {
      if (used[ia]) return;
      var grp = [a]; used[ia] = true;
      pts.forEach(function (b, ib) {
        if (used[ib] || b.i === a.i) return;
        var ga = segs[a.i], gb = segs[b.i];
        if (Math.hypot(ga[a.e] - gb[b.e], (ga[a.e + 1] - gb[b.e + 1]) * ar) < tol) { grp.push(b); used[ib] = true; }
      });
      if (grp.length < 2) return;
      var xs = [], ys = [], xa = [], ya = [];
      grp.forEach(function (q) { var g = segs[q.i], ax = axis(g); xa.push(g[q.e]); ya.push(g[q.e + 1]); if (ax === 'v') xs.push(g[q.e]); if (ax === 'h') ys.push(g[q.e + 1]); });
      var mx = mean(xs.length ? xs : xa), my = mean(ys.length ? ys : ya);
      grp.forEach(function (q) { var g = segs[q.i]; g[q.e] = mx; g[q.e + 1] = my; });
    });
    return segs;
  }
  // 문·창이 놓일 벽 찾기 (양 끝이 그 벽에서 tol 안)
  function hostOf(segs, a, b, ar, tol) {
    var best = null;
    segs.forEach(function (g) {
      if (g[4] !== 'w') return;
      var d = Math.max(nearSeg(a[0], a[1], g, ar).d, nearSeg(b[0], b[1], g, ar).d);
      if (d < tol && (!best || d < best.d)) best = { d: d, g: g };
    });
    return best;
  }
  function bbox(segs, ar) {
    var x0 = 1, x1 = 0, y0 = 1, y1 = 0;
    segs.forEach(function (g) { x0 = Math.min(x0, g[0], g[2]); x1 = Math.max(x1, g[0], g[2]); y0 = Math.min(y0, g[1], g[3]); y1 = Math.max(y1, g[1], g[3]); });
    return x1 > x0 && y1 > y0 ? { w: x1 - x0, h: (y1 - y0) * ar } : { w: 0, h: 0 };
  }
  /**
   * 크기(도면 가로 전체가 몇 미터인지) 정하기
   * ① 도면 치수(AI가 읽은 mm)의 가운데 값 ② 평수(공급면적 ≈ 벽 바깥 네모의 85%로 어림) ③ 집 가로 11m로 어림
   */
  function scaleOf(dims, W, H, segs, size) {
    var ar = H / W, bb = bbox(segs, ar), v = [];
    (Array.isArray(dims) ? dims : []).forEach(function (d) {
      var mm = Number(d && d.mm); if (!(mm >= 300 && mm <= 40000) || !d.a || !d.b) return;
      var L = Math.hypot((d.b[1] - d.a[1]) / 1000 * W, (d.b[0] - d.a[0]) / 1000 * H);
      if (L < 0.04 * Math.max(W, H)) return;
      v.push(mm / 1000 / L * W);
    });
    v.sort(function (a, b) { return a - b; });
    var med = v.length ? v[(v.length - 1) >> 1] : 0;
    if (med && bb.w * med >= 3 && bb.w * med <= 60) return { m: med, src: 'dims' };
    var py = parseFloat(size);
    if (py >= 5 && py <= 200 && bb.w > 0.05 && bb.h > 0.05) {
      var m = Math.sqrt(py * 3.3058 / (bb.w * bb.h * 0.85));
      if (bb.w * m >= 3 && bb.w * m <= 60) return { m: m, src: 'size' };
    }
    return { m: bb.w > 0.05 ? 11 / bb.w : 12, src: 'guess' };
  }
  /**
   * AI 답(cleanAI 결과, 좌표는 [y, x] 0~1000) → 저장 모양
   * W, H = 도면 그림 크기(px), o = { px: refine 용 밝기, size: 평수 }
   */
  function fromAI(j, W, H, o) {
    o = o || {};
    if (!j || !(W > 0) || !(H > 0)) return null;
    var ar = H / W, tol = 0.012;
    var pt = function (p) { return Array.isArray(p) && p.length >= 2 ? [c01(p[1] / 1000), c01(p[0] / 1000)] : null; };
    var segs = [];
    (Array.isArray(j.walls) ? j.walls : []).forEach(function (w) {
      var a = pt(w && w.a), b = pt(w && w.b);
      if (a && b && !isNaN(a[0] + a[1] + b[0] + b[1])) segs.push([a[0], a[1], b[0], b[1], 'w']);
    });
    segs = straighten(segs, ar);
    segs = refine(segs, o.px);
    segs = joinEnds(segs, ar, tol);
    // 겹치는 벽 하나로 (긴 것부터 넣고 겹친 부분은 잘라 냄)
    segs = segs.filter(function (g) { return segLen(g, ar) >= 0.004; }).sort(function (a, b) { return segLen(b, ar) - segLen(a, ar); })
      .reduce(function (acc, g) { return cut(acc, g, ar, 0.003); }, []);
    var TYPE = { door: 'd', window: 'n', glass: 'g', open: 'o' };
    (Array.isArray(j.openings) ? j.openings : []).forEach(function (q) {
      var k = TYPE[q && q.type], a = pt(q && q.a), b = pt(q && q.b);
      if (!k || !a || !b || isNaN(a[0] + a[1] + b[0] + b[1])) return;
      var host = hostOf(segs, a, b, ar, 0.02);
      if (host) { a = projLine(a, host.g, ar); b = projLine(b, host.g, ar); }
      else if (k === 'o') return;
      if (Math.hypot(b[0] - a[0], (b[1] - a[1]) * ar) < 0.004) return;
      segs = cut(segs, [c01(a[0]), c01(a[1]), c01(b[0]), c01(b[1]), k], ar);
    });
    segs = straighten(segs, ar);   // 끝점을 맞추다 생긴 아주 작은 기울기 없애기
    var sc = scaleOf(j.dims, W, H, segs, o.size);
    return clean({ ar: ar, m: sc.m, h: CEIL, src: sc.src, s: segs });
  }

  /* ---------- ① 서버: 글 AI에게 벽 따기 ---------- */
  // 답은 짧은 모양(숫자 배열)으로 받음 — 실제 도면은 벽이 많아 답이 길어지면 중간에 끊겨(최대 길이) 읽지 못하는 일이 생김 (2026-10-30)
  var EXTRACT = [
    'You convert a 2D architectural floor plan image (usually a Korean apartment) into wall geometry for a simple grey 3D massing model.',
    'Coordinates are integer [y, x] points on the image, normalized to 0-1000 (y from the top edge, x from the left edge), the same convention as object detection boxes.',
    '',
    'Return:',
    '- "walls": every wall of the home as a straight segment along the wall\'s centre line: [y1, x1, y2, x2].',
    '  Include exterior walls, interior partition walls and short wall stubs. Draw a wall straight through any door or window in it - openings are listed separately.',
    '  Use as few segments as possible: one segment per straight wall between corners or junctions (at most 200). Start and end each segment exactly at corners, T-junctions and wall ends; where walls meet, use exactly the same point. Horizontal walls must have the same y at both ends, vertical walls the same x.',
    '- "openings": every door, window and wide opening: {"t": "door" | "window" | "glass" | "open", "p": [y1, x1, y2, x2]} - the two ends of the opening on its wall\'s centre line.',
    '  door: a door leaf or swing arc, a sliding door or a doorway. window: a window in a wall with a sill at about waist height (often thin parallel lines inside the wall). glass: a floor-to-ceiling window or sliding glass door, e.g. between the living room and the balcony. open: a wide opening between two spaces with no door and no wall.',
    '- "dims": up to 6 dimension annotations you can read clearly: [y1, x1, y2, x2, mm] - the two ends of the dimension line and its value in millimetres (convert metres: 2.4 m -> 2400).',
    '- Leave out furniture, fixtures, text, hatching, dimension lines and everything outside the home (shared corridor, stairs, elevator).',
    '- "plan_ok": false only if the image is clearly not a floor plan.',
    '',
    'Reply with JSON only, no other text, for example:',
    '{"plan_ok": true, "walls": [[120, 80, 120, 920], [120, 920, 880, 920]], "openings": [{"t": "door", "p": [300, 560, 380, 560]}], "dims": [[80, 80, 80, 920, 11000]]}',
  ].join('\n');
  // Gemini 답 모양 고정 (구조화된 답 — 모르는 주소면 서버가 빼고 다시 보냄)
  var SCHEMA = {
    type: 'OBJECT',
    properties: {
      plan_ok: { type: 'BOOLEAN' },
      walls: { type: 'ARRAY', items: { type: 'ARRAY', items: { type: 'INTEGER' } } },
      openings: { type: 'ARRAY', items: { type: 'OBJECT', properties: { t: { type: 'STRING', enum: ['door', 'window', 'glass', 'open'] }, p: { type: 'ARRAY', items: { type: 'INTEGER' } } }, required: ['t', 'p'] } },
      dims: { type: 'ARRAY', items: { type: 'ARRAY', items: { type: 'INTEGER' } } },
    },
    required: ['plan_ok', 'walls', 'openings', 'dims'],
    propertyOrdering: ['plan_ok', 'walls', 'openings', 'dims'],
  };
  function parseJSON(text) {
    var s = String(text || ''), a = s.indexOf('{'), b = s.lastIndexOf('}');
    if (a < 0 || b <= a) return null;
    try { return JSON.parse(s.slice(a, b + 1)); } catch (e) { return null; }
  }
  /** 깨지거나 중간에 끊긴 답에서 다 적힌 것만 건지기 → { …, partial: true } | null */
  function salvage(text) {
    var s = String(text || '');
    var at = function (k) { return s.search(new RegExp('"' + k + '"\\s*:')); };
    var iw = at('walls'), io = at('openings'), id = at('dims');
    if (iw < 0) return null;
    var part = function (i) { if (i < 0) return ''; var ends = [iw, io, id, s.length].filter(function (v) { return v > i; }); return s.slice(i, Math.min.apply(null, ends)); };
    var objs = function (str) { var out = []; (str.match(/\{[^{}]*\}/g) || []).forEach(function (o) { try { out.push(JSON.parse(o)); } catch (e) {} }); return out; };
    var arrs = function (str, n) {
      var out = [], re = /\[\s*(-?\d+(?:\.\d+)?(?:\s*,\s*-?\d+(?:\.\d+)?)*)\s*\]/g, m;
      while ((m = re.exec(str))) { var a = m[1].split(',').map(Number); if (a.length === n) out.push(a); }
      return out;
    };
    var W = part(iw), walls = arrs(W, 4).concat(objs(W));
    if (!walls.length) return null;
    var pk = /"plan_ok"\s*:\s*(true|false)/.exec(s), D = part(id);
    return { plan_ok: !pk || pk[1] === 'true', walls: walls, openings: objs(part(io)), dims: arrs(D, 5).concat(objs(D)), partial: true };
  }
  /** AI 답 글 → 읽은 것 (제대로 된 JSON, 아니면 건질 수 있는 만큼) | null */
  function parseAI(text) {
    var j = parseJSON(text);
    if (j && typeof j === 'object' && Array.isArray(j.walls)) return j;
    return salvage(text) || j;
  }
  /** AI 답 다듬기 (서버에서) → { plan_ok, walls: [{a, b}], openings: [{type, a, b}], dims: [{a, b, mm}], partial } | null */
  function cleanAI(j) {
    if (!j || typeof j !== 'object' || Array.isArray(j)) return null;
    var P = function (p) {
      if (!Array.isArray(p) || p.length < 2) return null;
      var y = Number(p[0]), x = Number(p[1]);
      if (!isFinite(y) || !isFinite(x)) return null;
      return [Math.round(Math.max(0, Math.min(1000, y)) * 10) / 10, Math.round(Math.max(0, Math.min(1000, x)) * 10) / 10];
    };
    var seg = function (q) {
      if (Array.isArray(q) && q.length >= 4) q = { a: [q[0], q[1]], b: [q[2], q[3]] };   // [y1, x1, y2, x2]
      else if (q && Array.isArray(q.p) && q.p.length >= 4) q = { a: [q.p[0], q.p[1]], b: [q.p[2], q.p[3]] };
      var a = P(q && q.a), b = P(q && q.b);
      return a && b && (a[0] !== b[0] || a[1] !== b[1]) ? { a: a, b: b } : null;
    };
    var arr = function (v) { return Array.isArray(v) ? v : []; };
    var TYPES = ['door', 'window', 'glass', 'open'];
    var seen = {}, once = function (x, k) { var key = (k || '') + [x.a, x.b].map(String).sort().join('|'); if (seen[key]) return false; seen[key] = 1; return true; };   // 같은 선을 되풀이한 답(가끔 생김)은 한 번만
    return {
      plan_ok: j.plan_ok !== false,
      walls: arr(j.walls).map(seg).filter(function (x) { return x && once(x); }).slice(0, 300),
      openings: arr(j.openings).map(function (q) {
        var s = seg(q), ty = String((q && (q.t || q.type)) || '').toLowerCase();
        return s && TYPES.indexOf(ty) >= 0 && once(s, ty) ? { type: ty, a: s.a, b: s.b } : null;
      }).filter(Boolean).slice(0, 150),
      dims: arr(j.dims).map(function (q) {
        var s = seg(q), mm = Number(Array.isArray(q) ? q[4] : q && q.mm);
        return s && mm >= 100 && mm <= 100000 ? { a: s.a, b: s.b, mm: Math.round(mm) } : null;
      }).filter(Boolean).slice(0, 12),
      partial: !!j.partial,
    };
  }

  /* ---------- ③ 밑그림 그리기 (광선 쏘기: 세로 줄마다 벽을 찾아 멀리서부터 칠함) ---------- */
  // 벽 선 → 두께 있는 벽의 세로 면들 (미터)
  function faces(w) {
    var m = w.m, ar = w.ar, half = THICK / 2, S = [];
    w.s.forEach(function (g) {
      if (g[4] === 'o') return;
      var s = { ax: g[0] * m, ay: g[1] * ar * m, bx: g[2] * m, by: g[3] * ar * m, k: g[4] };
      s.L = Math.hypot(s.bx - s.ax, s.by - s.ay);
      if (s.L < 0.02) return;
      s.ux = (s.bx - s.ax) / s.L; s.uy = (s.by - s.ay) / s.L; S.push(s);
    });
    var NEAR = 0.06;
    var dseg = function (x, y, s) { var t = Math.max(0, Math.min(s.L, (x - s.ax) * s.ux + (y - s.ay) * s.uy)); return Math.hypot(s.ax + s.ux * t - x, s.ay + s.uy * t - y); };
    // 벽 끝: 'corner'(꺾여 만남 → 두께만큼 늘림) | 'join'(같은 줄 벽과 이어짐) | 'jamb'(문·창 옆 → 옆면) | 'free'(혼자 끝남 → 옆면)
    var endKind = function (i, x, y) {
      var s = S[i], r = 'free';
      for (var j = 0; j < S.length; j++) {
        if (j === i) continue;
        var o = S[j]; if (dseg(x, y, o) > NEAR) continue;
        if (Math.abs(s.ux * o.uy - s.uy * o.ux) >= 0.1) return 'corner';
        r = o.k === 'w' ? (r === 'jamb' ? 'jamb' : 'join') : 'jamb';
      }
      return r;
    };
    var F = [], planes = {}, np = 0, LX = 0.48, LY = 0.88;
    var plane = function (nx, ny, off) {
      var key = Math.round(((Math.atan2(ny, nx) * 180 / Math.PI) + 360) % 360) % 360 + ':' + Math.round(off / 0.03);
      if (planes[key] == null) planes[key] = ++np;
      return planes[key];
    };
    var face = function (x1, y1, x2, y2, nx, ny, k) {
      F.push({ x: x1, y: y1, ex: x2 - x1, ey: y2 - y1, nx: nx, ny: ny, hole: HOLE[k] || null, glass: k === 'n' || k === 'g', id: plane(nx, ny, x1 * nx + y1 * ny), lit: nx * LX + ny * LY });
    };
    S.forEach(function (s, i) {
      var nx = -s.uy, ny = s.ux, e0 = 0, e1 = 0, cap0 = false, cap1 = false;
      if (s.k === 'w') {
        var k0 = endKind(i, s.ax, s.ay), k1 = endKind(i, s.bx, s.by);
        e0 = k0 === 'corner' ? half : 0; e1 = k1 === 'corner' ? half : 0;
        cap0 = k0 === 'free' || k0 === 'jamb'; cap1 = k1 === 'free' || k1 === 'jamb';
      }
      var ax = s.ax - s.ux * e0, ay = s.ay - s.uy * e0, bx = s.bx + s.ux * e1, by = s.by + s.uy * e1;
      face(ax + nx * half, ay + ny * half, bx + nx * half, by + ny * half, nx, ny, s.k);
      face(ax - nx * half, ay - ny * half, bx - nx * half, by - ny * half, -nx, -ny, s.k);
      if (cap0) face(ax + nx * half, ay + ny * half, ax - nx * half, ay - ny * half, -s.ux, -s.uy, 'w');
      if (cap1) face(bx + nx * half, by + ny * half, bx - nx * half, by - ny * half, s.ux, s.uy, 'w');
    });
    return F;
  }
  /**
   * 가구 → 회색 상자들 (가구마다 몇 개의 상자: 소파 = 앉는 곳 + 등받이 + 팔걸이, 거실장 = 장 + TV, 침대 = 매트리스 + 머리판…)
   * 상자 = { w: 가로, d: 깊이, z0, z1: 높이(m), off: 앞뒤로 옮김(+ = 앞), side: 옆으로 옮김(+ = 오른쪽) }
   */
  function furnParts(k, w, H, f) {
    switch (k) {
      case 'low': return [{ w: w, d: 0.6, z0: 0, z1: 0.4 }];
      case 'col': return [{ w: w, d: w, z0: 0, z1: H - 0.01, wallTone: true }];   // 기둥: 벽과 같은 색
      case 'part': return [{ w: w, d: 0.12, z0: 0, z1: f && f.h ? Math.min(f.h, H - 0.01) : H - 0.01, wallTone: true }];   // 가벽 (높이를 정하면 그 높이까지)
      case 'tv': return [{ w: w, d: 0.45, z0: 0, z1: 0.45 }, { w: Math.min(w * 0.75, 1.9), d: 0.06, z0: 0.62, z1: 0.62 + Math.min(w * 0.75, 1.9) * 0.5625, off: -0.12 }];
      case 'sofa': return [{ w: w, d: 0.95, z0: 0, z1: 0.42 }, { w: w, d: 0.22, z0: 0, z1: 0.82, off: -0.365 }, { w: 0.2, d: 0.95, z0: 0, z1: 0.6, side: -(w / 2 - 0.1) }, { w: 0.2, d: 0.95, z0: 0, z1: 0.6, side: w / 2 - 0.1 }];
      case 'table': return [{ w: w, d: w <= 1.2 ? 0.8 : 0.9, z0: 0, z1: 0.75 }];
      case 'desk': return [{ w: w, d: 0.6, z0: 0, z1: 0.75 }];
      case 'bed': return [{ w: w, d: 2.1, z0: 0, z1: 0.5 }, { w: w, d: 0.08, z0: 0, z1: 1.05, off: -1.01 }];
      case 'closet': return [{ w: w, d: 0.6, z0: 0, z1: Math.max(1.8, H - 0.02) }];
      case 'display': return [{ w: w, d: 0.4, z0: 0, z1: 1.9 }];
      case 'fridge': return [{ w: w, d: 0.7, z0: 0, z1: Math.max(1.8, H - 0.02) }];   // 천장까지
      case 'range': return [{ w: w, d: 0.6, z0: 0, z1: Math.max(1.8, H - 0.02) }];
      case 'base': return [{ w: w, d: 0.6, z0: 0, z1: 0.85 }];   // 하부장 + 상판 높이
      case 'bath': return [{ w: w, d: 0.75, z0: 0, z1: 0.55 }];
      case 'shower': return [{ w: w, d: 0.9, z0: 0, z1: 0.05 }, { w: w, d: 0.9, z0: 0.05, z1: Math.min(2.0, H - 0.05), glass: true }];   // 바닥판 + 유리 칸막이
      case 'toilet': return [{ w: Math.max(0.38, w), d: 0.2, z0: 0, z1: 0.78, off: -0.25 }, { w: Math.max(0.36, w - 0.04), d: 0.5, z0: 0, z1: 0.42, off: 0.1 }];   // 물탱크 + 앉는 곳
      case 'basin': return [{ w: w, d: 0.5, z0: 0, z1: 0.85 }];   // 하부장 (거울은 '거울'로 따로)
      case 'mirror': return [{ w: w, d: 0.03, z0: 0.3, z1: Math.min(2.0, H - 0.1), shine: true }];   // 벽에 붙는 큰 거울 (세면대 앞이면 아래는 하부장에 가려짐)
      default: return [];
    }
  }
  // 가구 상자의 세로 면들 (미터) — 면마다 따로 id (모서리마다 선이 보이게), 벽보다 조금 어둡게
  function furnFaces(wl, furn) {
    var m = wl.m, ar = wl.ar, F = [], id = 1e6, pid = 0, LX = 0.48, LY = 0.88;
    (Array.isArray(furn) ? furn : []).forEach(function (f) {
      if (!f || !isFinite(f.x) || !isFinite(f.y)) return;
      var cx = f.x * m, cy = f.y * ar * m, fx = 0, fy = 1, wd = num(f.w, 0.2, 8, 1.5);
      if (f.tx != null && f.ty != null) { var dx = f.tx * m - cx, dy = f.ty * ar * m - cy, L = Math.hypot(dx, dy); if (L > 1e-6) { fx = dx / L; fy = dy / L; } }
      if (f.line || f.axis) {   // 가벽·식탁: (tx, ty)가 가리키는 쪽이 긴 쪽(가로) 방향, 앞쪽은 그와 직각
        var lx = fx, ly = fy; fx = ly; fy = -lx;
        if (f.line) wd = Math.max(0.05, num(f.L, 0, 2, 0) * m);
      }
      var rx = -fy, ry = fx;   // 오른쪽 (앞을 보고 섰을 때)
      furnParts(f.k, wd, wl.h, f).forEach(function (pt) {
        pid++;
        var ox = cx + fx * (pt.off || 0) + rx * (pt.side || 0), oy = cy + fy * (pt.off || 0) + ry * (pt.side || 0), hw = pt.w / 2, hd = pt.d / 2;
        var P = function (a, b) { return [ox + rx * a + fx * b, oy + ry * a + fy * b]; };
        var c = [P(-hw, hd), P(hw, hd), P(hw, -hd), P(-hw, -hd)];   // 앞왼 · 앞오 · 뒤오 · 뒤왼
        for (var i = 0; i < 4; i++) {
          var a = c[i], b = c[(i + 1) % 4], ex = b[0] - a[0], ey = b[1] - a[1], L = Math.hypot(ex, ey);
          if (L < 1e-6) continue;
          var nx = ey / L, ny = -ex / L;
          F.push({ x: a[0], y: a[1], ex: ex, ey: ey, nx: nx, ny: ny, hole: null, glass: false, id: ++id, lit: nx * LX + ny * LY, z0: pt.z0, z1: pt.z1, furn: true, pid: pid, see: !!pt.glass, shine: !!pt.shine, wallTone: !!pt.wallTone });
        }
      });
    });
    return F;
  }
  /**
   * 카메라 자리에서 본 회색 밑그림 → { w, h, data: RGBA } | null (벽이 없거나 바라보는 쪽이 없으면)
   * cam = { x, y, tx, ty } (0~1), o = { w, h, ss: 매끄럽게(2 = 2배로 그려 줄임), fov, eye }
   */
  function raster(walls, cam, o) {
    o = o || {};
    var wl = clean(walls);
    if (!has(wl) || !cam || cam.tx == null || cam.ty == null) return null;
    var ss = Math.max(1, Math.min(3, o.ss | 0 || 1)), OW = o.w || GUIDE_W, OH = o.h || GUIDE_H, w = OW * ss, h = OH * ss;
    var fov = num(o.fov, 30, 110, FOV) * Math.PI / 180, eye = num(o.eye, 0.5, 2, EYE), H = wl.h, m = wl.m, ar = wl.ar;
    var f = (w / 2) / Math.tan(fov / 2), hc = h / 2;
    var cx = cam.x * m, cy = cam.y * ar * m, dx = cam.tx * m - cx, dy = cam.ty * ar * m - cy, dl = Math.hypot(dx, dy);
    if (dl < 1e-6) return null;
    dx /= dl; dy /= dl;
    var rx0 = -dy, ry0 = dx;   // 오른쪽 (도면은 아래쪽이 +y)
    var F = faces(wl).concat(furnFaces(wl, o.furn)), id = new Int32Array(w * h), col = new Float32Array(w * h * 3);
    var SKY = [248, 249, 250], GL = [222, 231, 240];
    var hits = [];
    for (var i = 0; i < w; i++) {
      var u = (i + 0.5 - w / 2) / f, rx = dx + u * rx0, ry = dy + u * ry0, rl = Math.hypot(rx, ry);
      hits.length = 0;
      for (var q = 0; q < F.length; q++) {
        var fc = F[q], den = rx * fc.ey - ry * fc.ex;
        if (den > -1e-12 && den < 1e-12) continue;
        var qx = fc.x - cx, qy = fc.y - cy, t = (qx * fc.ey - qy * fc.ex) / den, s = (qx * ry - qy * rx) / den;
        if (t > 0.03 && s >= 0 && s <= 1) hits.push({ t: t, f: fc });
      }
      hits.sort(function (a, b) { return b.t - a.t; });
      // 가구 상자: 광선이 빠져나가는 거리(뒷면) — 윗면을 앞면부터 뒷면까지 칠하려고
      var exit = {};
      for (var hx = 0; hx < hits.length; hx++) { var hf = hits[hx].f; if (hf.furn && !hf.see && hf.nx * rx + hf.ny * ry > 0) exit[hf.pid] = Math.max(exit[hf.pid] || 0, hits[hx].t); }
      var zmax = hits.length ? hits[0].t : 0, y, p;
      // 바깥(하늘) → 바닥·천장 (가장 먼 벽까지만) → 벽 (먼 것부터)
      for (y = 0; y < h; y++) {
        p = y * w + i; var yc = y + 0.5 - hc, c = SKY, idv = -1, z;
        if (yc > 0) { z = eye * f / yc; if (z <= zmax) { var fl = 158 + 34 * Math.min(1, z / 14); c = [fl, fl, fl - 2]; idv = -2; } }
        else if (yc < 0) { z = (H - eye) * f / -yc; if (z <= zmax) { var ce = 240 - 12 * Math.min(1, z / 14); c = [ce, ce, ce]; idv = -3; } }
        id[p] = idv; col[p * 3] = c[0]; col[p * 3 + 1] = c[1]; col[p * 3 + 2] = c[2];
      }
      for (var k = 0; k < hits.length; k++) {
        var hk = hits[k], F2 = hk.f, t2 = hk.t;
        var yAt = function (Z) { return hc - (Z - eye) * f / t2; };
        var facing = Math.abs(F2.nx * rx + F2.ny * ry) / rl;
        var sh = Math.max(0.55, Math.min(1, 0.70 + 0.16 * facing + 0.09 * F2.lit - Math.min(0.12, t2 / 60)));
        var v = (F2.shine ? 238 : F2.furn && !F2.wallTone ? 196 : 236) * sh, wc = F2.shine ? [v - 6, v - 1, v + 6] : F2.furn && !F2.wallTone ? [v, v - 2, v - 5] : [v, v, v - 1];   // 가구는 조금 어둡고 따뜻한 회색, 거울은 밝은 은빛
        var fill = function (za, zb) {   // 높이 za~zb(미터)를 벽색으로
          var y0 = Math.max(0, Math.ceil(yAt(zb) - 0.5)), y1 = Math.min(h - 1, Math.floor(yAt(za) - 0.5));
          for (var yy = y0; yy <= y1; yy++) { var pp = yy * w + i; id[pp] = F2.id; col[pp * 3] = wc[0]; col[pp * 3 + 1] = wc[1]; col[pp * 3 + 2] = wc[2]; }
        };
        if (F2.furn && F2.see) {   // 유리(샤워부스): 뒤가 비쳐 보이게 옅은 유리색만 + 테두리 선
          var s0 = Math.max(0, Math.ceil(yAt(F2.z1) - 0.5)), s1 = Math.min(h - 1, Math.floor(yAt(F2.z0) - 0.5));
          for (var sy2 = s0; sy2 <= s1; sy2++) { var sp = sy2 * w + i; id[sp] = F2.id; for (var c2 = 0; c2 < 3; c2++) col[sp * 3 + c2] = col[sp * 3 + c2] * 0.7 + GL[c2] * 0.3; }
          continue;
        }
        if (F2.furn) {
          if (F2.nx * rx + F2.ny * ry > 0) continue;   // 뒷면은 안 그림 (앞면·윗면이 가림)
          if (F2.z1 < eye && exit[F2.pid] > t2) {   // 윗면: 뒷면 위 모서리 ~ 앞면 위 모서리 사이
            var ty0 = Math.max(0, Math.ceil(hc + (eye - F2.z1) * f / exit[F2.pid] - 0.5)), ty1 = Math.min(h - 1, Math.floor(yAt(F2.z1) - 0.5)), tv = 214 * Math.max(0.75, 1 - Math.min(0.15, t2 / 60));
            for (var yy3 = ty0; yy3 <= ty1; yy3++) { var p3 = yy3 * w + i; id[p3] = 2e6 + F2.pid; col[p3 * 3] = tv; col[p3 * 3 + 1] = tv - 2; col[p3 * 3 + 2] = tv - 5; }
          }
          fill(F2.z0, F2.z1);
        }
        else if (!F2.hole) fill(0, H);
        else {
          if (F2.hole[0] > 0) fill(0, F2.hole[0]);
          if (F2.hole[1] < H) fill(F2.hole[1], H);
          if (F2.glass) {   // 유리: 뒤에 보이는 것에 밝은 유리색을 살짝
            var g0 = Math.max(0, Math.ceil(yAt(Math.min(H, F2.hole[1])) - 0.5)), g1 = Math.min(h - 1, Math.floor(yAt(F2.hole[0]) - 0.5));
            for (var gy = g0; gy <= g1; gy++) { var gp = gy * w + i; for (var ch = 0; ch < 3; ch++) col[gp * 3 + ch] = col[gp * 3 + ch] * 0.6 + GL[ch] * 0.4; }
          }
        }
      }
    }
    // 면이 바뀌는 곳(모서리·벽과 바닥이 만나는 곳·문 테두리)에 선
    var edge = new Uint8Array(w * h), rad = ss > 1 ? 1 : 0;
    for (y = 0; y < h; y++) for (var x = 0; x < w; x++) {
      p = y * w + x;
      if ((x + 1 < w && id[p] !== id[p + 1]) || (y + 1 < h && id[p] !== id[p + w])) {
        for (var oy = -rad; oy <= rad; oy++) for (var ox = -rad; ox <= rad; ox++) { var yy2 = y + oy, xx2 = x + ox; if (yy2 >= 0 && yy2 < h && xx2 >= 0 && xx2 < w) edge[yy2 * w + xx2] = 1; }
      }
    }
    var out = new Uint8ClampedArray(OW * OH * 4), n2 = ss * ss;
    for (var Y = 0; Y < OH; Y++) for (var X = 0; X < OW; X++) {
      var r = 0, gg = 0, b = 0;
      for (var sy = 0; sy < ss; sy++) for (var sx = 0; sx < ss; sx++) {
        var pq = (Y * ss + sy) * w + X * ss + sx;
        if (edge[pq]) { r += 72; gg += 74; b += 78; } else { r += col[pq * 3]; gg += col[pq * 3 + 1]; b += col[pq * 3 + 2]; }
      }
      var o4 = (Y * OW + X) * 4;
      out[o4] = r / n2; out[o4 + 1] = gg / n2; out[o4 + 2] = b / n2; out[o4 + 3] = 255;
    }
    return { w: OW, h: OH, data: out };
  }

  return { KINDS: KINDS, KIND: KIND, HOLE: HOLE, CEIL: CEIL, EYE: EYE, FOV: FOV, MAX_SEGS: MAX_SEGS, GUIDE_W: GUIDE_W, GUIDE_H: GUIDE_H,
    clean: clean, has: has, segLen: segLen, metres: metres, nearSeg: nearSeg, projLine: projLine, cut: cut,
    straighten: straighten, refine: refine, joinEnds: joinEnds, scaleOf: scaleOf, fromAI: fromAI,
    EXTRACT: EXTRACT, SCHEMA: SCHEMA, parseJSON: parseJSON, salvage: salvage, parseAI: parseAI, cleanAI: cleanAI, faces: faces, raster: raster };
});
