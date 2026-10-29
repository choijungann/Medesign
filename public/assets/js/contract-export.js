/* =====================================================================
   계약서 → 워드(.docx) 파일 만들기
   estimate-export.js 의 워드 도구(EstimateExport.lib)를 그대로 씁니다. 입력: admin-contract.js 의 model() 결과
   ===================================================================== */
(function (root) {
  'use strict';
  var L = root.EstimateExport && root.EstimateExport.lib;
  if (!L) return;
  var run = L.run, para = L.para, cell = L.cell, table = L.table, h2 = L.h2, won = L.won;
  var LBL = 'F1F3F5', HEAD = '24476B', CAT = 'E5EDF6', SUB = 'F4F6F8', GRAND = 'D9E5F2', BLUE = '24476B';
  var FULL = 9906;   // 본문 폭 (A4 - 여백, twip)

  function pngBytes(dataUrl) {
    var m = /^data:image\/png;base64,(.+)$/.exec(String(dataUrl || ''));
    if (!m) return null;
    var bin = atob(m[1]), out = new Uint8Array(bin.length);
    for (var i = 0; i < bin.length; i++) out[i] = bin.charCodeAt(i);
    return out;
  }
  // PNG 가로·세로 (IHDR)
  function pngSize(b) { return { w: (b[16] << 24 | b[17] << 16 | b[18] << 8 | b[19]) >>> 0, h: (b[20] << 24 | b[21] << 16 | b[22] << 8 | b[23]) >>> 0 }; }

  function build(m) {
    var sup = m.supplier, body = [], images = [];
    var logo = m.logo && m.logo.bytes && m.logo.bytes.length ? m.logo : null;
    if (logo) {
      images.push({ rid: 'rId4', name: 'logo.png', bytes: logo.bytes });
      var lw = 1872000, lh = Math.round(lw * logo.h / logo.w);
      body.push(para(L.picture('rId4', lw, lh, '로고') + run('        ' + (m.no ? '계약번호 ' + m.no + '   ·   ' : '') + '계약일 ' + m.dateK, { sz: 17, color: '555555' }), { after: 160 }));
    } else {
      body.push(para(run((m.no ? '계약번호 ' + m.no + '   ·   ' : '') + '계약일 ' + m.dateK, { sz: 17, color: '555555' }), { align: 'right', after: 160 }));
    }
    body.push(para(run(m.docTitle, { b: 1, sz: 44, spacing: 40, color: BLUE }), { align: 'center', after: 200 }));
    body.push(para(run('도급인(고객) ') + run(m.customer.name || '            ', { b: 1 }) + run('과(와) 수급인(시공업자) ') + run(sup.legalName || sup.name, { b: 1 }) +
      run('은(는) 아래 공사에 관하여 다음과 같이 계약을 맺는다.'), { after: 120 }));

    // 계약 내용 표
    body.push(h2('계약 내용'));
    var TW = [2000, FULL - 2000], rows = [];
    function kv(k, v, bold) { rows.push({ keep: 1, cells: [cell(k, TW[0], { b: 1, fill: LBL, align: 'center' }), cell(v || '', TW[1], { b: bold })] }); }
    kv('공사명', m.title); kv('공사 장소', m.site); kv('공사 기간', m.period);
    rows.push({ keep: 1, cells: [cell('총 공사금액', TW[0], { b: 1, fill: LBL, align: 'center' }),
      cell(para(run(m.amountWords, { b: 1 }) + run(' (₩' + won(m.total) + ')' + (m.vatLabel ? ' · ' + m.vatLabel : ''))), TW[1])] });
    kv('입금 계좌', m.account); kv('하자보수 기간', m.warranty);
    if (m.mode === 'standard') { kv('지연손해금', m.lateRate ? '대금 지급이 늦어진 금액에 ' + m.lateRate : ''); if (m.delayRate) kv('지체상금', '공사가 늦어진 날수에 ' + m.delayRate); }
    rows.push({ cells: [cell('첨부 서류', TW[0], { b: 1, fill: LBL, align: 'center' }), cell(m.attach.join(', ') || '없음', TW[1])] });
    body.push(table(TW, rows));

    // 대금 지급
    body.push(h2('공사대금 지급'));
    var PW = [1800, 2600, FULL - 4400];
    var prow = [{ header: 1, keep: 1, cells: ['구분', '금액', '지급 시기'].map(function (h, i) { return cell(h, PW[i], { b: 1, fill: HEAD, color: 'FFFFFF', align: 'center' }); }) }];
    (m.payments.length ? m.payments : [{ label: '', amount: 0, when: '' }]).forEach(function (p) {
      prow.push({ keep: 1, cells: [cell(p.label, PW[0], { align: 'center' }), cell(p.amount ? won(p.amount) + '원' : '', PW[1], { align: 'right' }), cell(p.when, PW[2])] });
    });
    prow.push({ cells: [cell('합계', PW[0], { b: 1, fill: LBL, align: 'center' }), cell(won(m.paySum) + '원', PW[1], { b: 1, fill: LBL, align: 'right' }),
      cell(m.paySum === m.total ? '' : '총 공사금액과 ' + won(Math.abs(m.total - m.paySum)) + '원 차이', PW[2], { fill: LBL })] });
    body.push(table(PW, prow));

    // 조항
    body.push(h2('계약 조항'));
    m.clauses.forEach(function (c) {
      body.push(para(run('제' + c.no + '조' + (c.title ? '(' + c.title + ')' : ''), { b: 1, color: BLUE }), { before: 140, after: 40, keepNext: 1 }));
      String(c.body || '').split('\n').forEach(function (line, i, arr) {
        body.push(para(run(line), { after: 30, ind: /^[①-⑳]/.test(line) ? 300 : 0, hanging: /^[①-⑳]/.test(line) ? 300 : 0, keepNext: i < arr.length - 1 }));
      });
    });
    if (m.specials.length) {
      body.push(h2('특약사항'));
      m.specials.forEach(function (s, i) { body.push(para(run((i + 1) + '. ' + s), { after: 40, ind: 300, hanging: 300 })); });
    }

    // 서명
    body.push(para(run(m.closing), { before: 280, after: 120, keepNext: 1 }));
    body.push(para(run(m.dateK || '        년      월      일', { b: 1, sz: 21 }), { align: 'center', after: 160, keepNext: 1 }));
    function sigImg(who, rid) {
      var s = m.signs && m.signs[who], b = s && pngBytes(s.img);
      if (!b) return para(run('(서명 또는 인)', { color: '999999' }), { align: 'center' });
      var sz = pngSize(b), cy = 540000, cx = Math.round(cy * sz.w / Math.max(1, sz.h));   // 높이 1.5cm
      if (cx > 2300000) { cx = 2300000; cy = Math.round(cx * sz.h / sz.w); }
      images.push({ rid: rid, name: who + '-sign.png', bytes: b });
      return para(L.picture(rid, cx, cy, who === 'customer' ? '고객 서명' : '업체 서명'), { align: 'center' });
    }
    // 도급인·수급인 한 표 (고객 주소 칸을 세로로 합쳐 좌우 높이를 맞춤)
    var right = [['상호', sup.legalName || sup.name], ['대표', sup.ceo], ['사업자번호', sup.bizNumber], ['주소', sup.address], ['연락처', sup.phone]]
      .concat(sup.license ? [['건설업 등록', sup.license]] : []);
    var left = [['이름', m.customer.name], ['연락처', m.customer.phone], ['주소', m.customer.address]];
    var PW2 = [1250, 3703, 1350, 3603];
    var sRows = [{ keep: 1, cells: [cell('도급인 (고객)', PW2[0] + PW2[1], { span: 2, b: 1, fill: GRAND, color: BLUE, align: 'center' }),
      cell('수급인 (시공업자)', PW2[2] + PW2[3], { span: 2, b: 1, fill: GRAND, color: BLUE, align: 'center' })] }];
    right.forEach(function (r, i) {
      var lc = i < 2 ? [cell(left[i][0], PW2[0], { b: 1, fill: LBL, align: 'center' }), cell(left[i][1] || '', PW2[1])]
        : i === 2 ? [cell('주소', PW2[0], { b: 1, fill: LBL, align: 'center', vmerge: 'restart' }), cell(left[2][1] || '', PW2[1], { vmerge: 'restart', v: 'top' })]
          : [cell('', PW2[0], { fill: LBL, vmerge: 'continue' }), cell('', PW2[1], { vmerge: 'continue' })];
      sRows.push({ keep: 1, cells: lc.concat([cell(r[0], PW2[2], { b: 1, fill: LBL, align: 'center' }), cell(r[1] || '', PW2[3])]) });
    });
    sRows.push({ cells: [cell('서명', PW2[0], { b: 1, fill: LBL, align: 'center' }), cell(sigImg('customer', 'rId5'), PW2[1]),
      cell('서명', PW2[2], { b: 1, fill: LBL, align: 'center' }), cell(sigImg('supplier', 'rId6'), PW2[3])] });
    body.push(table(PW2, sRows));

    // 별첨: 공사 내역서
    var e = m.estimate;
    if (e) {
      var t = e.totals;
      body.push('<w:p><w:r><w:br w:type="page"/></w:r></w:p>');
      body.push(para(run('별첨 · 공사 내역서', { b: 1, sz: 32, color: BLUE }), { align: 'center', after: 80 }));
      body.push(para(run([e.title, e.no ? '견적번호 ' + e.no : '', e.dateK ? '견적일 ' + e.dateK : ''].filter(Boolean).join('   ·   '), { sz: 17, color: '555555' }), { align: 'center', after: 200 }));
      body.push(h2('공사 항목별 합계'));
      var SW2 = [800, 6106, 3000], sumRows = [{ header: 1, keep: 1, cells: ['No', '공사 항목', '금액'].map(function (h, i) { return cell(h, SW2[i], { b: 1, fill: HEAD, color: 'FFFFFF', align: 'center' }); }) }];
      e.cats.forEach(function (c) { sumRows.push({ keep: 1, cells: [cell(String(c.no), SW2[0], { align: 'center' }), cell(c.name, SW2[1]), cell(won(c.sum), SW2[2], { align: 'right' })] }); });
      var adj = [['공사비 합계', t.sum]];
      if (t.overhead) adj.push(['현장관리비·공과잡비 (' + e.overheadRate + '%)', t.overhead]);
      if (t.discount) adj.push(['할인', -t.discount]);
      if (t.roundAdj) adj.push(['끝자리 정리', t.roundAdj]);
      if (adj.length > 1 || e.vatMode === 'add') adj.push(['공급가액', t.supply]);
      if (e.vatMode === 'add') adj.push(['부가세 (10%)', t.vat]);
      adj.forEach(function (a) { sumRows.push({ keep: 1, cells: [cell(a[0], SW2[0] + SW2[1], { span: 2, b: 1, fill: LBL, align: 'right' }), cell(won(a[1]), SW2[2], { b: 1, fill: LBL, align: 'right' })] }); });
      sumRows.push({ cells: [cell('견적 금액' + (e.vatMode === 'excluded' ? ' (부가세 별도)' : ''), SW2[0] + SW2[1], { span: 2, b: 1, fill: GRAND, align: 'right', color: BLUE }),
        cell(won(t.total), SW2[2], { b: 1, fill: GRAND, align: 'right', color: BLUE })] });
      body.push(table(SW2, sumRows));
      if (e.showDetail) {
        body.push(h2('세부 내역'));
        var DW = [2600, 1800, 700, 800, 1300, 1400, 1306], small = 17;
        var det = [{ header: 1, cells: ['품명', '규격·자재', '단위', '수량', '단가', '금액', '비고'].map(function (h, i) { return cell(h, DW[i], { b: 1, fill: HEAD, color: 'FFFFFF', align: 'center', sz: small }); }) }];
        e.cats.forEach(function (c, ci) {
          var whole = c.lines.length <= 10;
          det.push({ keep: 1, cells: [cell(c.no + '. ' + c.name, FULL, { span: 7, b: 1, fill: CAT, sz: 19, color: BLUE })] });
          if (!c.lines.length) det.push({ keep: 1, cells: [cell('적은 항목 없음', FULL, { span: 7, align: 'center', color: '888888', sz: small })] });
          c.lines.forEach(function (l, li) {
            det.push({ keep: whole || li === c.lines.length - 1, cells: [cell(l.name, DW[0], { sz: small }), cell(l.spec, DW[1], { sz: small }), cell(l.unit, DW[2], { align: 'center', sz: small }),
              cell(l.qtyText || (l.qty ? String(l.qty) : ''), DW[3], { align: 'right', sz: small }), cell(l.price ? won(l.price) : '', DW[4], { align: 'right', sz: small }),
              cell(won(l.amount), DW[5], { align: 'right', sz: small }), cell(l.note, DW[6], { sz: small })] });
          });
          det.push({ keep: ci === e.cats.length - 1, cells: [cell('소계', DW[0] + DW[1] + DW[2] + DW[3] + DW[4], { span: 5, b: 1, fill: SUB, align: 'right', sz: small }),
            cell(won(c.sum), DW[5], { b: 1, fill: SUB, align: 'right', sz: small }), cell('', DW[6], { fill: SUB })] });
        });
        det.push({ cells: [cell('공사비 합계', FULL - DW[5] - DW[6], { span: 5, b: 1, fill: GRAND, align: 'right', color: BLUE }),
          cell(won(t.sum), DW[5], { b: 1, fill: GRAND, align: 'right', color: BLUE }), cell('', DW[6], { fill: GRAND })] });
        body.push(table(DW, det));
      }
    }
    return L.docxPackage(body.join(''), {
      title: '계약서 ' + (m.title || ''), creator: sup.name || '',
      footer: [sup.name, m.no ? '계약번호 ' + m.no : ''].filter(Boolean).join(' · '),
      images: images,
    });
  }

  var api = {
    docxBytes: build,
    docx: function (m) { return new Blob([build(m)], { type: 'application/vnd.openxmlformats-officedocument.wordprocessingml.document' }); },
  };
  if (typeof module !== 'undefined' && module.exports) module.exports = api;
  else root.ContractExport = api;
})(typeof window !== 'undefined' ? window : this);
