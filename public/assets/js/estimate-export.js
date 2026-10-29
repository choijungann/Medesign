/* =====================================================================
   견적서 → 엑셀(.xlsx) · 워드(.docx) 파일 만들기
   외부 라이브러리 없이 오피스 파일 형식(OOXML)을 직접 만들고, 압축 없이(zip 저장 방식) 묶습니다.
   관리화면에서 '받기'를 누를 때만 불러옵니다. 입력: admin-estimate.js 의 model() 결과
   ===================================================================== */
(function (root) {
  'use strict';

  /* ---------- zip (저장 방식, 압축 없음) ---------- */
  var CRC = (function () {
    var t = new Uint32Array(256);
    for (var n = 0; n < 256; n++) { var c = n; for (var k = 0; k < 8; k++) c = c & 1 ? 0xEDB88320 ^ (c >>> 1) : c >>> 1; t[n] = c >>> 0; }
    return t;
  })();
  function crc32(u8) { var c = 0xFFFFFFFF; for (var i = 0; i < u8.length; i++) c = CRC[(c ^ u8[i]) & 0xFF] ^ (c >>> 8); return (c ^ 0xFFFFFFFF) >>> 0; }
  function zip(files) {
    var enc = new TextEncoder(), parts = [], central = [], offset = 0, d = new Date();
    var time = (d.getHours() << 11) | (d.getMinutes() << 5) | Math.floor(d.getSeconds() / 2);
    var date = ((d.getFullYear() - 1980) << 9) | ((d.getMonth() + 1) << 5) | d.getDate();
    files.forEach(function (f) {
      var name = enc.encode(f.name), data = typeof f.data === 'string' ? enc.encode(f.data) : f.data, crc = crc32(data);
      var lh = new DataView(new ArrayBuffer(30));
      lh.setUint32(0, 0x04034b50, true); lh.setUint16(4, 20, true); lh.setUint16(6, 0x0800, true); lh.setUint16(8, 0, true);
      lh.setUint16(10, time, true); lh.setUint16(12, date, true); lh.setUint32(14, crc, true);
      lh.setUint32(18, data.length, true); lh.setUint32(22, data.length, true); lh.setUint16(26, name.length, true); lh.setUint16(28, 0, true);
      parts.push(new Uint8Array(lh.buffer), name, data);
      var ch = new DataView(new ArrayBuffer(46));
      ch.setUint32(0, 0x02014b50, true); ch.setUint16(4, 20, true); ch.setUint16(6, 20, true); ch.setUint16(8, 0x0800, true); ch.setUint16(10, 0, true);
      ch.setUint16(12, time, true); ch.setUint16(14, date, true); ch.setUint32(16, crc, true); ch.setUint32(20, data.length, true); ch.setUint32(24, data.length, true);
      ch.setUint16(28, name.length, true); ch.setUint32(42, offset, true);
      central.push(new Uint8Array(ch.buffer), name);
      offset += 30 + name.length + data.length;
    });
    var cdSize = central.reduce(function (a, b) { return a + b.length; }, 0);
    var end = new DataView(new ArrayBuffer(22));
    end.setUint32(0, 0x06054b50, true); end.setUint16(8, files.length, true); end.setUint16(10, files.length, true);
    end.setUint32(12, cdSize, true); end.setUint32(16, offset, true);
    var all = parts.concat(central, [new Uint8Array(end.buffer)]);
    var out = new Uint8Array(all.reduce(function (a, b) { return a + b.length; }, 0)), p = 0;
    all.forEach(function (b) { out.set(b, p); p += b.length; });
    return out;
  }
  function x(s) {
    return String(s == null ? '' : s).replace(/[\u0000-\u0008\u000B\u000C\u000E-\u001F￾￿]/g, '')
      .replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;');
  }
  var XML = '<?xml version="1.0" encoding="UTF-8" standalone="yes"?>\n';
  function won(n) { return Math.round(n || 0).toLocaleString('ko-KR'); }

  /* =====================================================================
     엑셀 (.xlsx) — '견적서'(요약) + '세부 내역' 두 장, 금액은 수식으로 다시 계산됨
     ===================================================================== */
  // 서식 번호 (styles.xml 의 cellXfs 순서)
  var S = { title: 1, label: 2, text: 3, num: 4, head: 5, cat: 6, subL: 7, subN: 8, grandL: 9, grandN: 10, note: 11, small: 12, conf: 13,
    amtL: 14, amtN: 15, center: 16, h2: 17, qty: 18, smallR: 19, totL: 20, totN: 21, amtW: 22 };
  function stylesXml() {
    var font = function (sz, b, color) { return '<font>' + (b ? '<b/>' : '') + '<sz val="' + sz + '"/><color rgb="FF' + (color || '1A1917') + '"/><name val="맑은 고딕"/><family val="3"/><charset val="129"/></font>'; };
    var fill = function (rgb) { return '<fill><patternFill patternType="solid"><fgColor rgb="FF' + rgb + '"/><bgColor indexed="64"/></patternFill></fill>'; };
    var side = function (st, c) { return ['left', 'right', 'top', 'bottom'].map(function (k) { return '<' + k + ' style="' + st + '"><color rgb="FF' + c + '"/></' + k + '>'; }).join('') + '<diagonal/>'; };
    // [numFmt, font, fill, border, align]
    var A = function (h, v, wrap) { return '<alignment' + (h ? ' horizontal="' + h + '"' : '') + ' vertical="' + (v || 'center') + '"' + (wrap ? ' wrapText="1"' : '') + '/>'; };
    var xfs = [
      [0, 0, 0, 0, ''],                       // 0 기본
      [0, 2, 0, 0, A('center')],              // 1 제목
      [0, 1, 2, 1, A('center', 'center', 1)], // 2 칸 이름
      [0, 0, 0, 1, A('left', 'center', 1)],   // 3 글자
      [164, 0, 0, 1, A('right')],             // 4 금액
      [0, 6, 3, 1, A('center', 'center', 1)], // 5 표 머리
      [0, 1, 4, 1, A('left')],                // 6 공사 항목 줄
      [0, 1, 6, 1, A('right')],               // 7 소계 이름
      [164, 1, 6, 1, A('right')],             // 8 소계 금액
      [0, 3, 5, 1, A('right')],               // 9 합계 이름
      [164, 3, 5, 1, A('right')],             // 10 합계 금액
      [0, 0, 0, 0, A('left', 'top', 1)],      // 11 긴 글
      [0, 4, 0, 0, A('center')],              // 12 작은 회색 가운데
      [0, 5, 7, 2, A('center', 'center', 1)], // 13 외부 유출 금지 (붉은 글씨·점선)
      [0, 3, 2, 3, A('center')],              // 14 견적 금액 이름
      [165, 3, 0, 3, A('right')],             // 15 견적 금액 숫자
      [0, 0, 0, 1, A('center', 'center', 1)], // 16 가운데 글자
      [0, 3, 0, 0, A('left')],                // 17 소제목
      [166, 0, 0, 1, A('right')],             // 18 수량
      [0, 4, 0, 0, A('right')],               // 19 작은 회색 오른쪽
      [0, 1, 2, 1, A('right')],               // 20 합계부 이름
      [164, 1, 2, 1, A('right')],             // 21 합계부 금액
      [0, 3, 0, 3, A('left', 'center', 1)],   // 22 견적 금액 한글
    ];
    return XML + '<styleSheet xmlns="http://schemas.openxmlformats.org/spreadsheetml/2006/main">' +
      '<numFmts count="3"><numFmt numFmtId="164" formatCode="#,##0"/><numFmt numFmtId="165" formatCode="&quot;₩&quot;#,##0"/><numFmt numFmtId="166" formatCode="#,##0.##;-#,##0.##;0"/></numFmts>' +
      '<fonts count="7">' + font(10) + font(10, 1, '33404D') + font(20, 1, '24476B') + font(12, 1, '24476B') + font(9, 0, '5B6570') + font(10, 1, 'B3261E') + font(10, 1, 'FFFFFF') + '</fonts>' +
      '<fills count="8"><fill><patternFill patternType="none"/></fill><fill><patternFill patternType="gray125"/></fill>' +
      fill('F1F3F5') + fill('24476B') + fill('E5EDF6') + fill('D9E5F2') + fill('F4F6F8') + fill('FDF2F1') + '</fills>' +
      '<borders count="4"><border><left/><right/><top/><bottom/><diagonal/></border><border>' + side('thin', 'B5BFCA') + '</border>' +
      '<border>' + side('dashed', 'D46A63') + '</border><border>' + side('medium', '24476B') + '</border></borders>' +
      '<cellStyleXfs count="1"><xf numFmtId="0" fontId="0" fillId="0" borderId="0"/></cellStyleXfs>' +
      '<cellXfs count="' + xfs.length + '">' + xfs.map(function (f) {
        return '<xf numFmtId="' + f[0] + '" fontId="' + f[1] + '" fillId="' + f[2] + '" borderId="' + f[3] + '" xfId="0"' +
          (f[0] ? ' applyNumberFormat="1"' : '') + ' applyFont="1" applyFill="1" applyBorder="1"' + (f[4] ? ' applyAlignment="1">' + f[4] + '</xf>' : '/>');
      }).join('') + '</cellXfs>' +
      '<cellStyles count="1"><cellStyle name="Normal" xfId="0" builtinId="0"/></cellStyles></styleSheet>';
  }
  function col(n) { var s = ''; n++; while (n > 0) { var m = (n - 1) % 26; s = String.fromCharCode(65 + m) + s; n = Math.floor((n - 1) / 26); } return s; }
  function Sheet() {
    this.rows = {}; this.merges = []; this.heights = {}; this.breaks = [];
  }
  Sheet.prototype.rowH = function (r) { return this.heights[r] || 20; };
  // 쪽 나누기: 묶음(blocks: {from, to, split, lead})이 쪽 끝에서 어색하게 잘리지 않게 미리 나눔.
  //  · 쪽에 안 들어가는 묶음은 통째로 다음 쪽으로 (split 이 아니고 한 쪽에 들어갈 때)
  //  · 긴 묶음(split)은 줄마다 나누되, 앞쪽 lead 줄(제목·공사 이름)만 쪽 끝에 남기지 않고, 마지막 줄(소계)만 넘기지 않음
  // budget: 한 쪽에 들어가는 줄 높이 합(pt), repeatH: 쪽마다 반복되는 머리줄 높이
  Sheet.prototype.paginate = function (blocks, budget, repeatH) {
    var self = this, used = 0;
    function hsum(a, b) { var x = 0; for (var q = a; q <= b; q++) x += self.rowH(q); return x; }
    blocks.forEach(function (b) {
      var bh = hsum(b.from, b.to), lead = b.lead || 1;
      if (used + bh <= budget) { used += bh; return; }
      if (!b.split && bh + repeatH <= budget && used > repeatH) { self.breaks.push(b.from - 1); used = repeatH + bh; return; }
      for (var q = b.from; q <= b.to; q++) {
        var hq = self.rowH(q);
        if (used + hq > budget && used > repeatH) {
          var at = q;
          if (q <= b.from + lead) at = b.from;                          // 제목·공사 이름 줄만 쪽 끝에 남기지 않기
          else if (b.tail && q === b.to && q - 1 > b.from + lead) at = q - 1;  // 소계 줄만 다음 쪽으로 넘기지 않기
          if (at - 1 > 0 && self.breaks.indexOf(at - 1) < 0) self.breaks.push(at - 1);
          used = repeatH + hsum(at, q);
        } else used += hq;
      }
    });
  };
  Sheet.prototype.put = function (r, c, v, s, f) { (this.rows[r] = this.rows[r] || {})[c] = { v: v, s: s || 0, f: f }; return col(c) + r; };
  Sheet.prototype.merge = function (r, c1, c2, v, s, f, r2) {
    r2 = r2 || r;
    for (var rr = r; rr <= r2; rr++) for (var c = c1; c <= c2; c++) if (rr !== r || c !== c1) this.put(rr, c, null, s);
    this.merges.push(col(c1) + r + ':' + col(c2) + r2);
    return this.put(r, c1, v, s, f);
  };
  Sheet.prototype.height = function (r, h) { this.heights[r] = h; };
  Sheet.prototype.xml = function (o) {
    var self = this, rs = Object.keys(this.rows).map(Number).sort(function (a, b) { return a - b; });
    var data = rs.map(function (r) {
      var cs = Object.keys(self.rows[r]).map(Number).sort(function (a, b) { return a - b; });
      return '<row r="' + r + '"' + (self.heights[r] ? ' ht="' + self.heights[r] + '" customHeight="1"' : '') + '>' + cs.map(function (c) {
        var cell = self.rows[r][c], ref = col(c) + r, st = cell.s ? ' s="' + cell.s + '"' : '';
        if (cell.f) return '<c r="' + ref + '"' + st + '><f>' + x(cell.f) + '</f><v>' + (Number(cell.v) || 0) + '</v></c>';
        if (cell.v == null || cell.v === '') return '<c r="' + ref + '"' + st + '/>';
        if (typeof cell.v === 'number') return '<c r="' + ref + '"' + st + '><v>' + cell.v + '</v></c>';
        return '<c r="' + ref + '"' + st + ' t="inlineStr"><is><t xml:space="preserve">' + x(cell.v) + '</t></is></c>';
      }).join('') + '</row>';
    }).join('');
    return XML + '<worksheet xmlns="http://schemas.openxmlformats.org/spreadsheetml/2006/main" xmlns:r="http://schemas.openxmlformats.org/officeDocument/2006/relationships">' +
      '<sheetPr><pageSetUpPr fitToPage="1"/></sheetPr>' +
      '<sheetViews><sheetView workbookViewId="0" showGridLines="0"' + (o.tab ? ' tabSelected="1"' : '') + '>' +
      (o.freeze ? '<pane ySplit="' + o.freeze + '" topLeftCell="A' + (o.freeze + 1) + '" activePane="bottomLeft" state="frozen"/>' : '') + '</sheetView></sheetViews>' +
      '<sheetFormatPr defaultRowHeight="20" customHeight="1"/>' +
      '<cols>' + o.widths.map(function (w, i) { return '<col min="' + (i + 1) + '" max="' + (i + 1) + '" width="' + w + '" customWidth="1"/>'; }).join('') + '</cols>' +
      '<sheetData>' + data + '</sheetData>' +
      (this.merges.length ? '<mergeCells count="' + this.merges.length + '">' + this.merges.map(function (m) { return '<mergeCell ref="' + m + '"/>'; }).join('') + '</mergeCells>' : '') +
      '<printOptions horizontalCentered="1"/>' +
      '<pageMargins left="0.4" right="0.4" top="0.5" bottom="0.6" header="0.3" footer="0.3"/>' +
      '<pageSetup paperSize="9" orientation="portrait" fitToWidth="1" fitToHeight="0"/>' +
      '<headerFooter><oddFooter>' + x(o.footer || '') + '</oddFooter></headerFooter>' +
      (this.breaks.length ? '<rowBreaks count="' + this.breaks.length + '" manualBreakCount="' + this.breaks.length + '">' +
        this.breaks.map(function (b) { return '<brk id="' + b + '" max="16383" man="1"/>'; }).join('') + '</rowBreaks>' : '') +
      (o.drawing ? '<drawing r:id="rId1"/>' : '') +
      '</worksheet>';
  };
  // 긴 글이 들어가는 줄 높이 (대략: 한 줄에 글자 수 per, 줄당 15pt)
  function rowsFor(text, per) {
    return String(text || '').split('\n').reduce(function (a, line) { return a + Math.max(1, Math.ceil(line.length / per)); }, 0);
  }

  function buildXlsx(m) {
    var t = m.totals, W = [24, 18, 7, 8, 13, 15, 18];
    var DET = "'세부 내역'";
    var withDet = m.showDetail !== false;   // 세부 내역을 빼면 '견적서' 한 장만 (금액은 숫자로)
    /* ----- 세부 내역 ----- */
    var d = new Sheet(), r = 1, subRefs = [];
    d.merge(r, 0, 6, '세부 내역', S.h2); d.height(r, 24); r++;
    d.merge(r, 0, 6, [m.title, m.customer.name ? m.customer.name + ' 귀하' : '', m.no].filter(Boolean).join('  ·  '), S.smallR); r++;
    ['품명', '규격·자재', '단위', '수량', '단가', '금액', '비고'].forEach(function (h, i) { d.put(r, i, h, S.head); });
    d.height(r, 22); var headRow = r; r++;
    var dBlocks = [{ from: 1, to: headRow }];
    m.cats.forEach(function (c) {
      var gFrom = r;
      d.merge(r, 0, 6, c.no + '. ' + c.name, S.cat); r++;
      var first = r;
      if (!c.lines.length) { d.merge(r, 0, 6, '적은 항목 없음', S.center); r++; }
      c.lines.forEach(function (l) {
        d.put(r, 0, l.name, S.text); d.put(r, 1, l.spec, S.text); d.put(r, 2, l.unit, S.center);
        d.put(r, 3, l.qty || (l.qtyText ? l.qtyText : null), S.qty);
        d.put(r, 4, l.price || null, S.num);
        d.put(r, 5, l.amount, S.num, 'ROUND(D' + r + '*E' + r + ',0)');
        d.put(r, 6, l.note, S.text);
        var lines = Math.max(rowsFor(l.name, 14), rowsFor(l.spec, 10), rowsFor(l.note, 10));
        if (lines > 1) d.height(r, Math.min(15 * lines + 6, 120));
        r++;
      });
      d.merge(r, 0, 4, '소계', S.subL);
      d.put(r, 5, c.sum, S.subN, c.lines.length ? 'SUM(F' + first + ':F' + (r - 1) + ')' : null);
      if (!c.lines.length) d.put(r, 5, 0, S.subN);
      d.put(r, 6, null, S.subL);
      subRefs.push('F' + r); c._sub = 'F' + r;
      dBlocks.push({ from: gFrom, to: r, split: r - gFrom + 1 > 14, lead: 1, tail: true }); r++;
    });
    d.merge(r, 0, 4, '공사비 합계', S.grandL);
    var detTotal = d.put(r, 5, t.sum, S.grandN, subRefs.length ? 'SUM(' + subRefs.join(',') + ')' : null);
    if (!subRefs.length) d.put(r, 5, 0, S.grandN);
    d.put(r, 6, null, S.grandL); d.height(r, 24);
    if (dBlocks.length > 1) dBlocks[dBlocks.length - 1].to = r; else dBlocks.push({ from: r, to: r });   // 합계 줄은 마지막 공사와 같이
    // A4 세로 한 쪽 높이: (841.9 − 위·아래 여백 79pt) ÷ 가로 맞춤 비율 약 0.95 ≈ 800pt → 여유를 두고 760pt
    var PAGE_PT = 760;
    if (withDet) d.paginate(dBlocks, PAGE_PT, d.rowH(headRow));

    /* ----- 견적서 (요약) ----- */
    var s = new Sheet(); r = 1;
    var logo = m.logo && m.logo.bytes && m.logo.bytes.length ? m.logo : null;
    // 1줄: 왼쪽 로고(그림) · 오른쪽 견적번호/견적일, 2줄: 제목
    s.merge(r, 3, 6, (m.no ? '견적번호 ' + m.no + '  ·  ' : '') + '견적일 ' + m.dateK, S.smallR); s.height(r, 34); r++;
    s.merge(r, 0, 6, '견 적 서', S.title); s.height(r, 44); r += 2;
    var sup = m.supplier;
    var left = [['고객', m.customer.name ? m.customer.name + ' 귀하' : ''], ['연락처', m.customer.phone], ['현장', m.site], ['공사명', m.title],
      ['예상 시공기간', m.period]];   // 현장 다음 공사명 (2026-10-25 대표님 요청). 유효기간은 표 맨 아래 줄(두 칸 다 씀)
    var right = [['상호', sup.legalName || sup.name], ['대표', sup.ceo],
      ['사업자번호', sup.bizNumber], ['주소', sup.address], ['담당', [sup.staff, sup.email || sup.phone].filter(Boolean).join(' · ')]];
    s.merge(r, 0, 3, '받는 분', S.h2); s.merge(r, 4, 6, '공급자', S.h2); r++;
    for (var i = 0; i < left.length; i++) {
      s.put(r, 0, left[i][0], S.label); s.merge(r, 1, 3, left[i][1], S.text);
      s.put(r, 4, right[i][0], S.label); s.merge(r, 5, 6, right[i][1], S.text);
      var h = Math.max(rowsFor(left[i][1], 16), rowsFor(right[i][1], 16));
      s.height(r, h > 1 ? 15 * h + 6 : 22); r++;
    }
    if (m.validText) { s.put(r, 0, '견적 유효기간', S.label); s.merge(r, 1, 6, m.validText, S.text); s.height(r, 22); r++; }
    r++;
    var amtRow = r;
    s.put(r, 0, '견적 금액', S.amtL); s.merge(r, 1, 4, m.amountWords, S.amtW);
    s.height(r, 30);
    var amtRef = 'F' + amtRow;  // 아래에서 합계 칸이 정해지면 수식을 채움
    r++;
    if (m.vatLabel) { s.merge(r, 0, 6, m.vatLabel, S.smallR); r++; }
    r++;
    var sBlocks = [{ from: 1, to: r - 1 }], secFrom = r, totFrom;
    s.merge(r, 0, 6, '공사 항목별 합계', S.h2); s.height(r, 22); r++;
    s.merge(r, 0, 4, '공사 항목', S.head); s.put(r, 5, '금액', S.head); s.put(r, 6, '항목 수', S.head); r++;
    var firstSum = r;
    m.cats.forEach(function (c) {
      s.merge(r, 0, 4, c.no + '. ' + c.name, S.text);
      s.put(r, 5, c.sum, S.num, withDet ? DET + '!' + c._sub : null);
      s.put(r, 6, c.lines.length ? c.lines.length + '줄' : '없음', S.center); r++;
    });
    var lastSum = r - 1;
    totFrom = r;
    function totRow(label, val, f, big) {
      s.merge(r, 0, 4, label, big ? S.grandL : S.totL);
      var ref = s.put(r, 5, val, big ? S.grandN : S.totN, f);
      s.put(r, 6, null, big ? S.grandL : S.totL);
      if (big) s.height(r, 26);
      r++; return ref;
    }
    var sumRef = totRow('공사비 합계', t.sum, m.cats.length ? 'SUM(F' + firstSum + ':F' + lastSum + ')' : (withDet ? DET + '!' + detTotal : null));
    var parts = [sumRef];
    if (t.overhead) parts.push(totRow('현장관리비·공과잡비 (' + m.overheadRate + '%)', t.overhead, 'ROUND(' + sumRef + '*' + m.overheadRate + '/100,0)'));
    if (t.discount) parts.push(totRow('할인', -t.discount));
    if (t.roundAdj) parts.push(totRow('끝자리 정리 (' + m.roundLabel + ')', t.roundAdj, '-MOD(' + parts.join('+') + ',' + m.roundUnit + ')'));
    var supplyRef = parts.length > 1 || m.vatMode === 'add' ? totRow('공급가액', t.supply, parts.join('+')) : sumRef;
    var grandF = supplyRef;
    if (m.vatMode === 'add') { var vatRef = totRow('부가세 (10%)', t.vat, 'ROUNDDOWN(' + supplyRef + '*0.1,0)'); grandF = supplyRef + '+' + vatRef; }
    var grandRef = totRow('견적 금액' + (m.vatMode === 'excluded' ? ' (부가세 별도)' : ''), t.total, grandF, true);
    s.merge(amtRow, 5, 6, t.total, S.amtN, grandRef);
    sBlocks.push({ from: secFrom, to: totFrom - 1, split: true, lead: 2 });   // 제목 + 표 머리 + 공사 항목 줄 (나눠도 됨)
    sBlocks.push({ from: totFrom, to: r - 1 });                               // 합계부는 한 덩어리
    r++;
    if (m.payment) {
      var payFrom = r;
      s.merge(r, 0, 6, '결제 조건', S.h2); r++;
      s.merge(r, 0, 6, m.payment, S.note); s.height(r, 15 * rowsFor(m.payment, 60) + 6); r++;
      sBlocks.push({ from: payFrom - 1, to: r - 1 }); r++;
    }
    if (m.notes.length) {   // 유효기간은 위 '견적유효기간' 칸에만
      var noteFrom = r;
      s.merge(r, 0, 6, '특기사항', S.h2); r++;
      m.notes.forEach(function (n) {
        s.merge(r, 0, 6, '· ' + n, S.note); s.height(r, 15 * rowsFor(n, 62) + 4); r++;
      });
      sBlocks.push({ from: noteFrom - 1, to: r - 1 });
    }
    var tailFrom = r;
    r++;
    if (m.confidential.on && m.confidential.text) { s.merge(r, 0, 6, m.confidential.text, S.conf); s.height(r, 15 * rowsFor(m.confidential.text, 56) + 12); r += 2; }
    s.merge(r, 0, 6, [sup.slogan, sup.name, sup.domain].filter(Boolean).join('  ·  '), S.small);
    sBlocks.push({ from: tailFrom, to: r });
    s.paginate(sBlocks, PAGE_PT, 0);

    var footer = '&L' + (sup.name || '') + '&C&P / &N' + (m.confidential.on ? '&R외부 유출 금지' : '');
    var sheet1 = s.xml({ widths: W, tab: true, footer: footer, drawing: !!logo });
    var sheet2 = withDet ? d.xml({ widths: W, freeze: headRow, footer: footer }) : null;
    var files = [
      { name: '[Content_Types].xml', data: XML + '<Types xmlns="http://schemas.openxmlformats.org/package/2006/content-types">' +
        '<Default Extension="rels" ContentType="application/vnd.openxmlformats-package.relationships+xml"/><Default Extension="xml" ContentType="application/xml"/>' +
        '<Override PartName="/xl/workbook.xml" ContentType="application/vnd.openxmlformats-officedocument.spreadsheetml.sheet.main+xml"/>' +
        '<Override PartName="/xl/worksheets/sheet1.xml" ContentType="application/vnd.openxmlformats-officedocument.spreadsheetml.worksheet+xml"/>' +
        '<Override PartName="/xl/worksheets/sheet2.xml" ContentType="application/vnd.openxmlformats-officedocument.spreadsheetml.worksheet+xml"/>' +
        '<Override PartName="/xl/styles.xml" ContentType="application/vnd.openxmlformats-officedocument.spreadsheetml.styles+xml"/>' +
        '<Override PartName="/docProps/core.xml" ContentType="application/vnd.openxmlformats-package.core-properties+xml"/></Types>' },
      { name: '_rels/.rels', data: XML + '<Relationships xmlns="http://schemas.openxmlformats.org/package/2006/relationships">' +
        '<Relationship Id="rId1" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/officeDocument" Target="xl/workbook.xml"/>' +
        '<Relationship Id="rId2" Type="http://schemas.openxmlformats.org/package/2006/relationships/metadata/core-properties" Target="docProps/core.xml"/></Relationships>' },
      { name: 'docProps/core.xml', data: coreXml(m) },
      { name: 'xl/workbook.xml', data: XML + '<workbook xmlns="http://schemas.openxmlformats.org/spreadsheetml/2006/main" xmlns:r="http://schemas.openxmlformats.org/officeDocument/2006/relationships">' +
        '<bookViews><workbookView activeTab="0"/></bookViews>' +
        '<sheets><sheet name="견적서" sheetId="1" r:id="rId1"/>' + (withDet ? '<sheet name="세부 내역" sheetId="2" r:id="rId2"/>' : '') + '</sheets>' +
        (withDet ? '<definedNames><definedName name="_xlnm.Print_Titles" localSheetId="1">' + x(DET) + '!$' + headRow + ':$' + headRow + '</definedName></definedNames>' : '') +
        '<calcPr calcId="191029" fullCalcOnLoad="1"/></workbook>' },
      { name: 'xl/_rels/workbook.xml.rels', data: XML + '<Relationships xmlns="http://schemas.openxmlformats.org/package/2006/relationships">' +
        '<Relationship Id="rId1" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/worksheet" Target="worksheets/sheet1.xml"/>' +
        (withDet ? '<Relationship Id="rId2" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/worksheet" Target="worksheets/sheet2.xml"/>' : '') +
        '<Relationship Id="rId3" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/styles" Target="styles.xml"/></Relationships>' },
      { name: 'xl/styles.xml', data: stylesXml() },
      { name: 'xl/worksheets/sheet1.xml', data: sheet1 },
    ];
    if (withDet) files.push({ name: 'xl/worksheets/sheet2.xml', data: sheet2 });
    else files[0].data = files[0].data.replace('<Override PartName="/xl/worksheets/sheet2.xml" ContentType="application/vnd.openxmlformats-officedocument.spreadsheetml.worksheet+xml"/>', '');
    if (logo) {
      // 로고 그림: 높이 약 30px, 가로는 비율대로 (1px = 9525 EMU)
      var ch = 30 * 9525, cw = Math.round(ch * logo.w / logo.h);
      files[0].data = files[0].data.replace('<Default Extension="xml"', '<Default Extension="png" ContentType="image/png"/><Default Extension="xml"')
        .replace('</Types>', '<Override PartName="/xl/drawings/drawing1.xml" ContentType="application/vnd.openxmlformats-officedocument.drawing+xml"/></Types>');
      files.push(
        { name: 'xl/worksheets/_rels/sheet1.xml.rels', data: XML + '<Relationships xmlns="http://schemas.openxmlformats.org/package/2006/relationships">' +
          '<Relationship Id="rId1" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/drawing" Target="../drawings/drawing1.xml"/></Relationships>' },
        { name: 'xl/drawings/_rels/drawing1.xml.rels', data: XML + '<Relationships xmlns="http://schemas.openxmlformats.org/package/2006/relationships">' +
          '<Relationship Id="rId1" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/image" Target="../media/logo.png"/></Relationships>' },
        { name: 'xl/drawings/drawing1.xml', data: XML + '<xdr:wsDr xmlns:xdr="http://schemas.openxmlformats.org/drawingml/2006/spreadsheetDrawing" xmlns:a="http://schemas.openxmlformats.org/drawingml/2006/main" xmlns:r="http://schemas.openxmlformats.org/officeDocument/2006/relationships">' +
          '<xdr:oneCellAnchor><xdr:from><xdr:col>0</xdr:col><xdr:colOff>38100</xdr:colOff><xdr:row>0</xdr:row><xdr:rowOff>66675</xdr:rowOff></xdr:from><xdr:ext cx="' + cw + '" cy="' + ch + '"/>' +
          '<xdr:pic><xdr:nvPicPr><xdr:cNvPr id="2" name="로고"/><xdr:cNvPicPr><a:picLocks noChangeAspect="1"/></xdr:cNvPicPr></xdr:nvPicPr>' +
          '<xdr:blipFill><a:blip r:embed="rId1"/><a:stretch><a:fillRect/></a:stretch></xdr:blipFill>' +
          '<xdr:spPr><a:xfrm><a:off x="0" y="0"/><a:ext cx="' + cw + '" cy="' + ch + '"/></a:xfrm><a:prstGeom prst="rect"><a:avLst/></a:prstGeom></xdr:spPr></xdr:pic>' +
          '<xdr:clientData/></xdr:oneCellAnchor></xdr:wsDr>' },
        { name: 'xl/media/logo.png', data: logo.bytes });
    }
    return zip(files);
  }
  function coreXml(m) { return coreXmlOf('견적서 ' + (m.title || ''), m.supplier.name || ''); }
  function coreXmlOf(title, creator) {
    var now = new Date().toISOString().replace(/\.\d+Z$/, 'Z');
    return XML + '<cp:coreProperties xmlns:cp="http://schemas.openxmlformats.org/package/2006/metadata/core-properties" xmlns:dc="http://purl.org/dc/elements/1.1/" xmlns:dcterms="http://purl.org/dc/terms/" xmlns:xsi="http://www.w3.org/2001/XMLSchema-instance">' +
      '<dc:title>' + x(title) + '</dc:title><dc:creator>' + x(creator) + '</dc:creator>' +
      '<dcterms:created xsi:type="dcterms:W3CDTF">' + now + '</dcterms:created><dcterms:modified xsi:type="dcterms:W3CDTF">' + now + '</dcterms:modified></cp:coreProperties>';
  }

  /* =====================================================================
     워드 (.docx)
     ===================================================================== */
  var WNS = 'xmlns:w="http://schemas.openxmlformats.org/wordprocessingml/2006/main" xmlns:r="http://schemas.openxmlformats.org/officeDocument/2006/relationships"' +
    ' xmlns:wp="http://schemas.openxmlformats.org/drawingml/2006/wordprocessingDrawing" xmlns:a="http://schemas.openxmlformats.org/drawingml/2006/main" xmlns:pic="http://schemas.openxmlformats.org/drawingml/2006/picture"';
  // 그림 한 장(본문 안에 줄처럼 들어감). cx, cy: EMU (1cm = 360000)
  var picSeq = 0;
  function picture(rid, cx, cy, name) {
    return '<w:r><w:drawing><wp:inline distT="0" distB="0" distL="0" distR="0"><wp:extent cx="' + cx + '" cy="' + cy + '"/><wp:docPr id="' + (++picSeq) + '" name="' + x(name) + '"/>' +
      '<wp:cNvGraphicFramePr><a:graphicFrameLocks noChangeAspect="1"/></wp:cNvGraphicFramePr>' +
      '<a:graphic><a:graphicData uri="http://schemas.openxmlformats.org/drawingml/2006/picture"><pic:pic><pic:nvPicPr><pic:cNvPr id="0" name="logo.png"/><pic:cNvPicPr/></pic:nvPicPr>' +
      '<pic:blipFill><a:blip r:embed="' + rid + '"/><a:stretch><a:fillRect/></a:stretch></pic:blipFill>' +
      '<pic:spPr><a:xfrm><a:off x="0" y="0"/><a:ext cx="' + cx + '" cy="' + cy + '"/></a:xfrm><a:prstGeom prst="rect"><a:avLst/></a:prstGeom></pic:spPr></pic:pic>' +
      '</a:graphicData></a:graphic></wp:inline></w:drawing></w:r>';
  }
  function run(text, o) {
    o = o || {};
    var rpr = (o.b ? '<w:b/>' : '') + (o.color ? '<w:color w:val="' + o.color + '"/>' : '') + (o.spacing ? '<w:spacing w:val="' + o.spacing + '"/>' : '') +
      (o.sz ? '<w:sz w:val="' + o.sz + '"/><w:szCs w:val="' + o.sz + '"/>' : '');
    return String(text == null ? '' : text).split('\n').map(function (line, i) {
      return '<w:r>' + (rpr ? '<w:rPr>' + rpr + '</w:rPr>' : '') + (i ? '<w:br/>' : '') + '<w:t xml:space="preserve">' + x(line) + '</w:t></w:r>';
    }).join('');
  }
  function para(runs, o) {
    o = o || {};
    var ppr = (o.keepNext ? '<w:keepNext/>' : '') + (o.border ? o.border : '') + (o.shd ? '<w:shd w:val="clear" w:color="auto" w:fill="' + o.shd + '"/>' : '') +
      '<w:spacing w:before="' + (o.before || 0) + '" w:after="' + (o.after || 0) + '"/>' + (o.ind ? '<w:ind w:left="' + o.ind + '" w:hanging="' + (o.hanging || 0) + '"/>' : '') +
      (o.align ? '<w:jc w:val="' + o.align + '"/>' : '');
    return '<w:p><w:pPr>' + ppr + '</w:pPr>' + runs + '</w:p>';
  }
  function cell(content, w, o) {
    o = o || {};
    var tcpr = '<w:tcW w:w="' + w + '" w:type="dxa"/>' + (o.span > 1 ? '<w:gridSpan w:val="' + o.span + '"/>' : '') +
      (o.vmerge ? '<w:vMerge' + (o.vmerge === 'restart' ? ' w:val="restart"' : '') + '/>' : '') +   // 세로로 칸 합치기
      (o.borders ? '<w:tcBorders>' + o.borders + '</w:tcBorders>' : '') +
      (o.fill ? '<w:shd w:val="clear" w:color="auto" w:fill="' + o.fill + '"/>' : '') + '<w:vAlign w:val="' + (o.v || 'center') + '"/>';
    var body = typeof content === 'string' && content.indexOf('<w:p>') === 0 ? content : para(run(content, { b: o.b, sz: o.sz, color: o.color }), { align: o.align });
    return '<w:tc><w:tcPr>' + tcpr + '</w:tcPr>' + body + '</w:tc>';
  }
  function table(widths, rows, o) {
    o = o || {};
    var b = function (k) { return '<w:' + k + ' w:val="single" w:sz="' + (o.bsz || 4) + '" w:space="0" w:color="' + (o.bcolor || 'B5BFCA') + '"/>'; };
    return '<w:tbl><w:tblPr><w:tblW w:w="' + widths.reduce(function (a, c) { return a + c; }, 0) + '" w:type="dxa"/><w:tblLayout w:type="fixed"/>' +
      '<w:tblBorders>' + ['top', 'left', 'bottom', 'right', 'insideH', 'insideV'].map(b).join('') + '</w:tblBorders>' +
      '<w:tblCellMar><w:top w:w="40" w:type="dxa"/><w:left w:w="90" w:type="dxa"/><w:bottom w:w="40" w:type="dxa"/><w:right w:w="90" w:type="dxa"/></w:tblCellMar></w:tblPr>' +
      '<w:tblGrid>' + widths.map(function (w) { return '<w:gridCol w:w="' + w + '"/>'; }).join('') + '</w:tblGrid>' +
      rows.map(function (rw) {
        var cells = rw.cells.join('');
        // '다음 줄과 같이' — 줄 안 모든 문단에 keepNext 를 주면 워드가 이 줄을 다음 줄과 같은 쪽에 둠
        if (rw.keep) cells = cells.replace(/<w:pPr>(?!<w:keepNext\/>)/g, '<w:pPr><w:keepNext/>');
        return '<w:tr><w:trPr><w:cantSplit/>' + (rw.header ? '<w:tblHeader/>' : '') + '</w:trPr>' + cells + '</w:tr>';
      }).join('') + '</w:tbl>';
  }
  function h2(text) {
    return para(run(text, { b: 1, sz: 22, color: '24476B' }), { before: 260, after: 100, keepNext: 1,
      border: '<w:pBdr><w:left w:val="single" w:sz="24" w:space="6" w:color="3B6EA5"/></w:pBdr>' });
  }

  function buildDocx(m) {
    var t = m.totals, sup = m.supplier, body = [];
    var LBL = 'F1F3F5', HEAD = '24476B', CAT = 'E5EDF6', SUB = 'F4F6F8', GRAND = 'D9E5F2', BLUE = '24476B';
    var logo = m.logo && m.logo.bytes && m.logo.bytes.length ? m.logo : null;
    if (logo) {
      var lw = 1872000, lh = Math.round(lw * logo.h / logo.w);   // 가로 5.2cm
      body.push(para(picture('rId4', lw, lh, '미디자인 인테리어 로고'), { after: 200 }));
    }
    body.push(para(run('견 적 서', { b: 1, sz: 52, spacing: 60, color: BLUE }), { align: 'center', after: 80 }));
    body.push(para(run((m.no ? '견적번호 ' + m.no + '   ·   ' : '') + '견적일 ' + m.dateK, { sz: 18, color: '555555' }), { align: 'center', after: 240 }));

    var left = [['고객', m.customer.name ? m.customer.name + ' 귀하' : ''], ['연락처', m.customer.phone], ['현장', m.site], ['공사명', m.title],
      ['예상 시공기간', m.period]];   // 현장 다음 공사명 (2026-10-25 대표님 요청). 유효기간은 표 맨 아래 줄(두 칸 다 씀)
    var right = [['상호', sup.legalName || sup.name], ['대표', sup.ceo],
      ['사업자번호', sup.bizNumber], ['주소', sup.address], ['담당', [sup.staff, sup.email || sup.phone].filter(Boolean).join(' · ')]];
    var IW = [1750, 3153, 1300, 3703];   // 머리칸('예상 시공기간'·'견적 유효기간')이 한 줄에 들어가게
    var infoRows = [{ keep: 1, cells: [cell('받는 분', IW[0] + IW[1], { span: 2, b: 1, fill: GRAND, align: 'center', color: BLUE }),
      cell('공급자', IW[2] + IW[3], { span: 2, b: 1, fill: GRAND, align: 'center', color: BLUE })] }];
    for (var i = 0; i < left.length; i++) {
      infoRows.push({ keep: i < left.length - 1 || !!m.validText, cells: [cell(left[i][0], IW[0], { b: 1, fill: LBL, align: 'center' }), cell(left[i][1], IW[1]),
        cell(right[i][0], IW[2], { b: 1, fill: LBL, align: 'center' }), cell(right[i][1], IW[3])] });
    }
    // 견적 유효기간: 표 맨 아래 줄, 받는 분·공급자 두 칸을 다 씀
    if (m.validText) infoRows.push({ cells: [cell('견적 유효기간', IW[0], { b: 1, fill: LBL, align: 'center' }), cell(m.validText, IW[1] + IW[2] + IW[3], { span: 3 })] });
    body.push(table(IW, infoRows));
    body.push(para('', { after: 160 }));
    var amtPara = para(run('₩' + won(t.total), { b: 1, sz: 26 }) + (m.vatLabel ? run('\n' + m.vatLabel, { sz: 16, color: '555555' }) : ''), { align: 'right' });
    body.push(table([1500, 5306, 3100], [{ cells: [cell('견적 금액', 1500, { b: 1, fill: GRAND, align: 'center', sz: 22, color: BLUE }),
      cell(m.amountWords, 5306, { b: 1, sz: 24, fill: CAT }), cell(amtPara, 3100, { fill: CAT })] }], { bsz: 12, bcolor: BLUE }));

    // 공사 항목별 합계
    body.push(h2('공사 항목별 합계'));
    var SW = [800, 6106, 3000], sumRows = [{ header: 1, keep: 1, cells: ['No', '공사 항목', '금액'].map(function (h, i) { return cell(h, SW[i], { b: 1, fill: HEAD, color: 'FFFFFF', align: 'center' }); }) }];
    m.cats.forEach(function (c) {
      sumRows.push({ keep: 1, cells: [cell(String(c.no), SW[0], { align: 'center' }), cell(c.name, SW[1]), cell(won(c.sum), SW[2], { align: 'right' })] });
    });
    var adj = [['공사비 합계', t.sum]];
    if (t.overhead) adj.push(['현장관리비·공과잡비 (' + m.overheadRate + '%)', t.overhead]);
    if (t.discount) adj.push(['할인', -t.discount]);
    if (t.roundAdj) adj.push(['끝자리 정리 (' + m.roundLabel + ')', t.roundAdj]);
    if (adj.length > 1 || m.vatMode === 'add') adj.push(['공급가액', t.supply]);
    if (m.vatMode === 'add') adj.push(['부가세 (10%)', t.vat]);
    adj.forEach(function (a) {
      sumRows.push({ keep: 1, cells: [cell(a[0], SW[0] + SW[1], { span: 2, b: 1, fill: LBL, align: 'right' }), cell(won(a[1]), SW[2], { b: 1, fill: LBL, align: 'right' })] });
    });
    sumRows.push({ cells: [cell('견적 금액' + (m.vatMode === 'excluded' ? ' (부가세 별도)' : ''), SW[0] + SW[1], { span: 2, b: 1, fill: GRAND, align: 'right', sz: 22, color: BLUE }),
      cell(won(t.total), SW[2], { b: 1, fill: GRAND, align: 'right', sz: 22, color: BLUE })] });
    body.push(table(SW, sumRows));

    // 세부 내역 (빼기로 했으면 건너뜀)
    if (m.showDetail !== false) {
    body.push(h2('세부 내역'));
    var DW = [2600, 1800, 700, 800, 1300, 1400, 1306], small = 17;
    var detRows = [{ header: 1, cells: ['품명', '규격·자재', '단위', '수량', '단가', '금액', '비고'].map(function (h, i) { return cell(h, DW[i], { b: 1, fill: HEAD, color: 'FFFFFF', align: 'center', sz: small }); }) }];
    m.cats.forEach(function (c, ci) {
      // 쪽 나눔: 공사 이름 줄은 다음 줄과 같이, 짧은 공사(10줄 이하)는 통째로, 긴 공사는 마지막 줄을 소계와 같이
      var whole = c.lines.length <= 10;
      detRows.push({ keep: 1, cells: [cell(c.no + '. ' + c.name, 9906, { span: 7, b: 1, fill: CAT, sz: 19, color: BLUE })] });
      if (!c.lines.length) detRows.push({ keep: 1, cells: [cell('적은 항목 없음', 9906, { span: 7, align: 'center', color: '888888', sz: small })] });
      c.lines.forEach(function (l, li) {
        detRows.push({ keep: whole || li === c.lines.length - 1, cells: [cell(l.name, DW[0], { sz: small }), cell(l.spec, DW[1], { sz: small }), cell(l.unit, DW[2], { align: 'center', sz: small }),
          cell(l.qtyText || (l.qty ? String(l.qty) : ''), DW[3], { align: 'right', sz: small }), cell(l.price ? won(l.price) : '', DW[4], { align: 'right', sz: small }),
          cell(won(l.amount), DW[5], { align: 'right', sz: small }), cell(l.note, DW[6], { sz: small })] });
      });
      detRows.push({ keep: ci === m.cats.length - 1, cells: [cell('소계', DW[0] + DW[1] + DW[2] + DW[3] + DW[4], { span: 5, b: 1, fill: SUB, align: 'right', sz: small }),
        cell(won(c.sum), DW[5], { b: 1, fill: SUB, align: 'right', sz: small }), cell('', DW[6], { fill: SUB })] });
    });
    detRows.push({ cells: [cell('공사비 합계', 9906 - DW[5] - DW[6], { span: 5, b: 1, fill: GRAND, align: 'right', color: BLUE }),
      cell(won(t.sum), DW[5], { b: 1, fill: GRAND, align: 'right', color: BLUE }), cell('', DW[6], { fill: GRAND })] });
    body.push(table(DW, detRows));
    }

    if (m.payment) { body.push(h2('결제 조건')); body.push(para(run(m.payment), { after: 60 })); }
    if (m.notes.length) body.push(h2('특기사항'));
    m.notes.forEach(function (n) {
      body.push(para(run('·  ' + n), { after: 60, ind: 240, hanging: 240 }));
    });
    if (m.confidential.on && m.confidential.text) {
      // 외부 유출 금지 문구는 눈에 띄게 붉은색
      var bd = function (k) { return '<w:' + k + ' w:val="dashed" w:sz="6" w:space="6" w:color="D46A63"/>'; };
      body.push(para(run(m.confidential.text, { b: 1, color: 'B3261E' }), { before: 280, align: 'center', keepNext: 1, shd: 'FDF2F1',
        border: '<w:pBdr>' + ['top', 'left', 'bottom', 'right'].map(bd).join('') + '</w:pBdr>' }));
    }
    body.push(para(run([sup.slogan, sup.name, sup.domain].filter(Boolean).join('   ·   '), { sz: 16, color: '666666' }), { before: 280, align: 'center' }));

    return docxPackage(body.join(''), {
      title: '견적서 ' + (m.title || ''), creator: sup.name || '',
      footer: [sup.name, sup.domain].filter(Boolean).join(' · ') + (m.confidential.on ? '   |   외부 유출 금지' : ''),
      images: logo ? [{ rid: 'rId4', name: 'logo.png', bytes: logo.bytes }] : [],
    });
  }

  // 워드 파일 묶기 (견적서·계약서 공용): 본문 XML + 아래 쪽 번호 + 그림(PNG)
  //   o.footer: 쪽 아래 글, o.images: [{ rid: 'rId4'…, name: 'a.png', bytes }], o.margin: 쪽 여백(twip)
  function docxPackage(bodyXml, o) {
    o = o || {};
    var mg = o.margin || 1000;
    var document = XML + '<w:document ' + WNS + '><w:body>' + bodyXml +
      '<w:sectPr><w:footerReference w:type="default" r:id="rId3"/><w:pgSz w:w="11906" w:h="16838"/>' +
      '<w:pgMar w:top="' + mg + '" w:right="' + mg + '" w:bottom="' + mg + '" w:left="' + mg + '" w:header="500" w:footer="500" w:gutter="0"/></w:sectPr></w:body></w:document>';
    var footer = XML + '<w:ftr ' + WNS + '>' +
      para(run((o.footer || '') + '   |   ', { sz: 15, color: '777777' }) +
        '<w:fldSimple w:instr=" PAGE "><w:r><w:rPr><w:sz w:val="15"/><w:szCs w:val="15"/></w:rPr><w:t>1</w:t></w:r></w:fldSimple>' + run(' / ', { sz: 15, color: '777777' }) +
        '<w:fldSimple w:instr=" NUMPAGES "><w:r><w:rPr><w:sz w:val="15"/><w:szCs w:val="15"/></w:rPr><w:t>1</w:t></w:r></w:fldSimple>', { align: 'center' }) + '</w:ftr>';
    var styles = XML + '<w:styles ' + WNS + '><w:docDefaults><w:rPrDefault><w:rPr>' +
      '<w:rFonts w:ascii="Malgun Gothic" w:eastAsia="맑은 고딕" w:hAnsi="Malgun Gothic" w:cs="Malgun Gothic"/><w:sz w:val="19"/><w:szCs w:val="19"/><w:lang w:val="en-US" w:eastAsia="ko-KR"/>' +
      '</w:rPr></w:rPrDefault><w:pPrDefault><w:pPr><w:spacing w:after="0" w:line="264" w:lineRule="auto"/></w:pPr></w:pPrDefault></w:docDefaults>' +
      '<w:style w:type="paragraph" w:default="1" w:styleId="Normal"><w:name w:val="Normal"/><w:qFormat/></w:style>' +
      '<w:style w:type="table" w:default="1" w:styleId="TableNormal"><w:name w:val="Normal Table"/><w:uiPriority w:val="99"/><w:semiHidden/><w:unhideWhenUsed/>' +
      '<w:tblPr><w:tblInd w:w="0" w:type="dxa"/><w:tblCellMar><w:top w:w="0" w:type="dxa"/><w:left w:w="108" w:type="dxa"/><w:bottom w:w="0" w:type="dxa"/><w:right w:w="108" w:type="dxa"/></w:tblCellMar></w:tblPr></w:style>' +
      '</w:styles>';
    var settings = XML + '<w:settings ' + WNS + '><w:defaultTabStop w:val="800"/><w:characterSpacingControl w:val="doNotCompress"/>' +
      '<w:compat><w:compatSetting w:name="compatibilityMode" w:uri="http://schemas.microsoft.com/office/word" w:val="15"/></w:compat></w:settings>';
    var imgs = o.images || [];
    var files = [
      { name: '[Content_Types].xml', data: XML + '<Types xmlns="http://schemas.openxmlformats.org/package/2006/content-types">' +
        '<Default Extension="rels" ContentType="application/vnd.openxmlformats-package.relationships+xml"/>' + (imgs.length ? '<Default Extension="png" ContentType="image/png"/>' : '') + '<Default Extension="xml" ContentType="application/xml"/>' +
        '<Override PartName="/word/document.xml" ContentType="application/vnd.openxmlformats-officedocument.wordprocessingml.document.main+xml"/>' +
        '<Override PartName="/word/styles.xml" ContentType="application/vnd.openxmlformats-officedocument.wordprocessingml.styles+xml"/>' +
        '<Override PartName="/word/settings.xml" ContentType="application/vnd.openxmlformats-officedocument.wordprocessingml.settings+xml"/>' +
        '<Override PartName="/word/footer1.xml" ContentType="application/vnd.openxmlformats-officedocument.wordprocessingml.footer+xml"/>' +
        '<Override PartName="/docProps/core.xml" ContentType="application/vnd.openxmlformats-package.core-properties+xml"/></Types>' },
      { name: '_rels/.rels', data: XML + '<Relationships xmlns="http://schemas.openxmlformats.org/package/2006/relationships">' +
        '<Relationship Id="rId1" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/officeDocument" Target="word/document.xml"/>' +
        '<Relationship Id="rId2" Type="http://schemas.openxmlformats.org/package/2006/relationships/metadata/core-properties" Target="docProps/core.xml"/></Relationships>' },
      { name: 'docProps/core.xml', data: coreXmlOf(o.title || '', o.creator || '') },
      { name: 'word/_rels/document.xml.rels', data: XML + '<Relationships xmlns="http://schemas.openxmlformats.org/package/2006/relationships">' +
        '<Relationship Id="rId1" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/styles" Target="styles.xml"/>' +
        '<Relationship Id="rId2" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/settings" Target="settings.xml"/>' +
        '<Relationship Id="rId3" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/footer" Target="footer1.xml"/>' +
        imgs.map(function (im) { return '<Relationship Id="' + im.rid + '" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/image" Target="media/' + im.name + '"/>'; }).join('') +
        '</Relationships>' },
      { name: 'word/document.xml', data: document },
      { name: 'word/styles.xml', data: styles },
      { name: 'word/settings.xml', data: settings },
      { name: 'word/footer1.xml', data: footer },
    ];
    imgs.forEach(function (im) { files.push({ name: 'word/media/' + im.name, data: im.bytes }); });
    return zip(files);
  }

  // 엑셀 파일 묶기 (고객 목록 등): sheets = [{ name, xml }] — 서식은 위 stylesXml(S) 그대로
  function xlsxPackage(sheets, o) {
    o = o || {};
    var files = [
      { name: '[Content_Types].xml', data: XML + '<Types xmlns="http://schemas.openxmlformats.org/package/2006/content-types">' +
        '<Default Extension="rels" ContentType="application/vnd.openxmlformats-package.relationships+xml"/><Default Extension="xml" ContentType="application/xml"/>' +
        '<Override PartName="/xl/workbook.xml" ContentType="application/vnd.openxmlformats-officedocument.spreadsheetml.sheet.main+xml"/>' +
        sheets.map(function (sh, i) { return '<Override PartName="/xl/worksheets/sheet' + (i + 1) + '.xml" ContentType="application/vnd.openxmlformats-officedocument.spreadsheetml.worksheet+xml"/>'; }).join('') +
        '<Override PartName="/xl/styles.xml" ContentType="application/vnd.openxmlformats-officedocument.spreadsheetml.styles+xml"/>' +
        '<Override PartName="/docProps/core.xml" ContentType="application/vnd.openxmlformats-package.core-properties+xml"/></Types>' },
      { name: '_rels/.rels', data: XML + '<Relationships xmlns="http://schemas.openxmlformats.org/package/2006/relationships">' +
        '<Relationship Id="rId1" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/officeDocument" Target="xl/workbook.xml"/>' +
        '<Relationship Id="rId2" Type="http://schemas.openxmlformats.org/package/2006/relationships/metadata/core-properties" Target="docProps/core.xml"/></Relationships>' },
      { name: 'docProps/core.xml', data: coreXmlOf(o.title || '', o.creator || '') },
      { name: 'xl/workbook.xml', data: XML + '<workbook xmlns="http://schemas.openxmlformats.org/spreadsheetml/2006/main" xmlns:r="http://schemas.openxmlformats.org/officeDocument/2006/relationships">' +
        '<bookViews><workbookView activeTab="0"/></bookViews><sheets>' +
        sheets.map(function (sh, i) { return '<sheet name="' + x(sh.name) + '" sheetId="' + (i + 1) + '" r:id="rId' + (i + 1) + '"/>'; }).join('') + '</sheets>' +
        (o.printTitles ? '<definedNames>' + o.printTitles.map(function (pt) { return '<definedName name="_xlnm.Print_Titles" localSheetId="' + pt.sheet + '">' + x("'" + sheets[pt.sheet].name + "'") + '!$' + pt.row + ':$' + pt.row + '</definedName>'; }).join('') + '</definedNames>' : '') +
        '<calcPr calcId="191029" fullCalcOnLoad="1"/></workbook>' },
      { name: 'xl/_rels/workbook.xml.rels', data: XML + '<Relationships xmlns="http://schemas.openxmlformats.org/package/2006/relationships">' +
        sheets.map(function (sh, i) { return '<Relationship Id="rId' + (i + 1) + '" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/worksheet" Target="worksheets/sheet' + (i + 1) + '.xml"/>'; }).join('') +
        '<Relationship Id="rId' + (sheets.length + 1) + '" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/styles" Target="styles.xml"/></Relationships>' },
      { name: 'xl/styles.xml', data: stylesXml() },
    ];
    sheets.forEach(function (sh, i) { files.push({ name: 'xl/worksheets/sheet' + (i + 1) + '.xml', data: sh.xml }); });
    return zip(files);
  }

  var api = {
    lib: { zip: zip, x: x, XML: XML, won: won, S: S, Sheet: Sheet, rowsFor: rowsFor, run: run, para: para, cell: cell, table: table, h2: h2,
      picture: picture, docxPackage: docxPackage, xlsxPackage: xlsxPackage },
    xlsxBytes: buildXlsx,
    docxBytes: buildDocx,
    xlsx: function (m) { return new Blob([buildXlsx(m)], { type: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet' }); },
    docx: function (m) { return new Blob([buildDocx(m)], { type: 'application/vnd.openxmlformats-officedocument.wordprocessingml.document' }); },
  };
  if (typeof module !== 'undefined' && module.exports) module.exports = api;
  else root.EstimateExport = api;
})(typeof window !== 'undefined' ? window : this);
