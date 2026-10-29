/* =====================================================================
   AI 글쓰기 요청문 (한 곳에서 관리)
   · 관리화면(브라우저)과 서버 함수(netlify/functions/ai-write.mjs)가 같은 파일을 씁니다.
     브라우저: <script src="ai-prompts.js"> → window.AIPrompts
     서버: import AIPrompts from '../../public/assets/js/ai-prompts.js'
   · 종류: blog(네이버 블로그) · instagram(인스타그램 피드) · shorts(유튜브 쇼츠 대본) · work(시공사례 제목·설명 완성)
   · 모든 글: 주어진 정보와 사진에 보이는 것만 쓰고, 가격·자재 이름·고객 반응 같은 건 지어내지 않음.
     고객 이름·동호수·전화번호 같은 개인정보는 쓰지 않음. 과장 광고 표현 금지.
   ===================================================================== */
(function (root, factory) {
  var api = factory();
  if (typeof module === 'object' && module.exports) module.exports = api;
  else root.AIPrompts = api;
})(typeof self !== 'undefined' ? self : this, function () {
  'use strict';
  var TONES = { warm: '친근하고 따뜻한 존댓말', calm: '차분하고 신뢰감 있는 존댓말', info: '정보를 또박또박 전하는 존댓말' };
  var LENS = {
    blog: { short: '1,000~1,500자', normal: '1,800~2,500자', long: '2,800~3,500자' },
    instagram: { short: '300~500자', normal: '500~800자', long: '800~1,200자' },
    shorts: { short: '20~30초', normal: '30~45초', long: '45~60초' },
    work: { short: '200~350자', normal: '350~600자', long: '600~900자' },
  };
  var MAX_TOKENS = { blog: 3000, instagram: 1800, shorts: 2500, work: 1200 };

  function s(v, n) { return String(v == null ? '' : v).trim().slice(0, n || 2000); }
  function info(w) {
    w = w || {};
    return [['제목', w.title], ['위치', w.place], ['평수', w.size], ['건물 종류', w.building], ['공사 범위', (w.scopes || []).join(', ')], ['공사 기간', w.period], ['업체가 쓴 소개글·메모', w.body]]
      .filter(function (x) { return s(x[1]); }).map(function (x) { return '- ' + x[0] + ': ' + s(x[1], 3000); }).join('\n');
  }
  function contact(site) {
    site = site || {};
    return [site.name, site.phone ? '전화 ' + site.phone : '', site.domain ? '홈페이지 ' + site.domain : ''].filter(Boolean).join(' · ');
  }
  var COMMON = function (name) {
    return '1. 아래 \'시공 정보\'와 사진에서 분명히 보이는 사실만 쓴다. 가격, 자재 브랜드·제품명, 공사 기간, 고객의 말·반응, 수상·경력처럼 주어지지 않은 사실은 절대 지어내지 않는다. 모르는 내용은 빼고 쓴다.\n' +
      '2. 사진은 눈으로 확인되는 것(색, 재질감, 배치, 조명, 수납 등)만 묘사하고 단정하기 어려운 것은 쓰지 않는다.\n' +
      '3. 고객 이름, 동·호수, 전화번호 같은 개인정보는 쓰지 않는다. 위치는 시공 정보에 적힌 만큼만 쓴다.\n' +
      '4. \'최고\', \'최저가\', \'100%\', \'무조건\' 같은 과장·비교 광고 표현을 쓰지 않는다.\n';
  };

  /** 요청문 만들기 → { system, user, maxTokens } */
  function build(kind, d) {
    d = d || {};
    var w = d.work || {}, site = d.site || {}, ex = d.extra || {}, n = d.photoCount || 0;
    var tone = TONES[ex.tone] || TONES.warm, len = (LENS[kind] || LENS.blog)[ex.length] || (LENS[kind] || LENS.blog).normal;
    var name = site.name || '인테리어 업체', inf = info(w) || '- (적힌 정보 없음)';
    var note = ex.note ? '\n\n사장님이 더 넣고 싶은 말:\n' + s(ex.note, 600) : '';
    var system, user;
    if (kind === 'instagram') {
      system = '너는 인테리어 업체 \'' + name + '\'의 인스타그램 피드 글을 대신 써 주는 담당자야. 사장님이 그대로 올릴 수 있는 한국어 캡션을 쓴다.\n지켜야 할 것:\n' + COMMON(name) +
        '5. 문체: ' + tone + '. 첫 줄은 피드에서 눈에 띄는 한 문장(40자 이내). 본문은 2~3문장짜리 짧은 문단 여러 개로, 줄을 자주 바꾼다. 이모지는 쓰더라도 3개까지만.\n' +
        '6. 첫 줄과 본문을 합쳐 ' + len + ' 정도.\n' +
        '7. 본문 끝에 상담 안내 한 줄: ' + contact(site) + '\n' +
        '8. 해시태그는 15~25개, 지역·공간·평수·공사 종류 중심으로. 띄어쓰기 없이.\n' +
        (n ? '9. 사진 ' + n + '장을 여러 장 넘겨 보는 게시물(캐러셀)로 올릴 순서를 추천한다. 첫 장은 가장 눈길을 끄는 완성 사진. 모든 사진을 한 번씩 쓰고, 이유는 15자 이내.\n' : '') +
        '반드시 아래 형식 그대로만 답한다 (다른 말 없이):\n[첫 줄]\n(첫 줄)\n[본문]\n(본문)\n[해시태그]\n#태그 #태그 …' +
        (n ? '\n[사진 순서]\n1. 사진 3 — (이유)\n2. 사진 1 — (이유)\n…' : '');
      user = '시공 정보:\n' + inf + note + '\n\n위 정보' + (n ? '와 사진 ' + n + '장' : '') + '으로 인스타그램 피드 글을 써 줘.';
    } else if (kind === 'shorts') {
      system = '너는 인테리어 업체 \'' + name + '\'의 유튜브 쇼츠(세로 영상) 대본을 쓰는 작가야. 사장님이 시공 사진을 이어 붙여 만들 짧은 영상의 장면별 대본을 쓴다.\n지켜야 할 것:\n' + COMMON(name) +
        '5. 영상 길이는 ' + len + ' 정도. 장면 하나는 2~5초. 첫 장면(0~3초)은 끝까지 보고 싶게 만드는 장면으로.\n' +
        '6. 화면 글자는 장면마다 15자 이내로 짧게. 내레이션은 소리 내어 읽기 자연스러운 ' + tone + '로, 장면 길이에 맞게(1초에 4~5글자 정도).\n' +
        (n ? '7. 장면마다 사진 ' + n + '장 중 하나를 고른다(같은 사진을 다시 써도 됨). 사진에 보이는 것만 말한다.\n' : '7. 사진이 없으면 장면마다 찍으면 좋을 화면을 짧게 적는다.\n') +
        '8. 마지막 장면은 상담 안내: ' + contact(site) + '\n' +
        '9. 영상 설명은 2~4문장, 태그는 5~10개.\n' +
        '반드시 아래 형식 그대로만 답한다 (다른 말 없이). [장면]의 각 줄은 \'|\'로 나눈다:\n[제목]\n1. (제목 후보, 40자 이내)\n2. (제목 후보)\n3. (제목 후보)\n[장면]\n1. 사진 2 | 0~3초 | 화면 글자: (글자) | 내레이션: (말)\n2. 사진 1 | 3~6초 | 화면 글자: (글자) | 내레이션: (말)\n…\n[설명]\n(영상 설명)\n[태그]\n#태그 #태그 …';
      user = '시공 정보:\n' + inf + note + '\n\n위 정보' + (n ? '와 사진 ' + n + '장' : '') + '으로 유튜브 쇼츠 대본을 써 줘.';
    } else if (kind === 'work') {
      system = '너는 인테리어 업체 \'' + name + '\' 홈페이지의 시공사례 글을 다듬어 주는 담당자야. 사장님이 적은 메모와 사진을 바탕으로 홈페이지에 올릴 제목과 설명을 쓴다.\n지켜야 할 것:\n' + COMMON(name) +
        '5. 문체: ' + tone + ' (~했습니다). 설명은 2~3문단, ' + len + ' 정도. 소제목·이모지·해시태그는 쓰지 않는다.\n' +
        '6. 제목은 30자 이내로, 위치·평수·공사 범위 중 적힌 것을 넣는다 (예: \'○○동 ○○아파트 32평 전체 리모델링\').\n' +
        '7. 사장님 메모가 있으면 그 내용을 빠짐없이 살리고, 없는 내용은 사진에 보이는 것만 보탠다.\n' +
        '반드시 아래 형식 그대로만 답한다 (다른 말 없이):\n[제목]\n(제목)\n[설명]\n(설명)';
      user = '시공 정보:\n' + inf + note + '\n\n위 정보' + (n ? '와 사진 ' + n + '장' : '') + '으로 홈페이지 시공사례 제목과 설명을 써 줘.';
    } else {
      kind = 'blog';
      system = '너는 인테리어 업체 \'' + name + '\'의 네이버 블로그 글을 대신 써 주는 작가야. 업체 사장님이 그대로 올릴 수 있는 한국어 원고를 쓴다.\n지켜야 할 것:\n' + COMMON(name) +
        '5. 문체: ' + tone + '. 문단은 2~4문장으로 짧게, 중간중간 소제목을 넣는다. 이모지는 쓰지 않는다.\n' +
        '6. 본문 길이: ' + len + ' 정도.\n' +
        '7. 사진 ' + n + '장을 순서대로 [사진 1], [사진 2] … 형식으로 본문 사이 알맞은 자리에 한 줄씩 넣는다. 사진은 모두 한 번씩 쓴다.' + (n ? '' : ' (사진이 없으면 넣지 않는다)') + '\n' +
        '8. 글 끝에 상담 안내 문단을 넣는다: ' + contact(site) + '\n' +
        '반드시 아래 형식 그대로만 답한다 (다른 말 없이):\n[제목]\n1. (제목 후보)\n2. (제목 후보)\n3. (제목 후보)\n[본문]\n(본문)\n[해시태그]\n#태그 #태그 … (10~15개, 지역·공간·공사 종류 중심)';
      user = '시공 정보:\n' + inf + note + '\n\n위 정보' + (n ? '와 사진 ' + n + '장' : '') + '으로 네이버 블로그 원고를 써 줘.';
    }
    return { system: system, user: user, maxTokens: MAX_TOKENS[kind] || 2500 };
  }

  /** 한 덩어리 요청문 (AI 앱에 붙여 넣기 · 미리보기의 Claude 기능용). photoNote: 사진을 어떻게 함께 보내는지 */
  function text(kind, d, photoNote) {
    var p = build(kind, d), n = (d && d.photoCount) || 0;
    return p.system + '\n\n' + p.user + (n ? '\n\n(' + (photoNote || '사진 ' + n + '장을 이 글과 함께 순서대로 올립니다. 첫 번째가 사진 1이에요') + ')' : '');
  }

  // [이름] 칸 꺼내기
  function pick(src, name, names) {
    var re = new RegExp('\\[' + name + '\\][ \\t]*\\n?([\\s\\S]*)');
    var m = re.exec(src); if (!m) return '';
    var rest = m[1], cut = rest.length;
    names.forEach(function (nx) { if (nx === name) return; var i = rest.search(new RegExp('\\n\\s*\\[' + nx + '\\]')); if (i >= 0 && i < cut) cut = i; });
    return rest.slice(0, cut).trim();
  }
  function tagsOf(t) { return (String(t || '').match(/#[^\s#,]+/g) || []).slice(0, 30); }
  function lines(t) { return String(t || '').split('\n').map(function (l) { return l.trim(); }).filter(Boolean); }
  function numbered(t) { return lines(t).map(function (l) { return l.replace(/^\s*\d+\s*[.)]\s*/, '').trim(); }).filter(Boolean); }
  function photoNo(t) { var m = /사진\s*(\d+)/.exec(t || ''); return m ? +m[1] : 0; }

  /** AI 답 → 칸별로 */
  function parse(kind, raw) {
    var src = '\n' + String(raw || '').replace(/\r/g, '').replace(/\*\*(\[[^\]]+\])\*\*/g, '$1');
    if (kind === 'instagram') {
      var N = ['첫 줄', '본문', '해시태그', '사진 순서'];
      var hook = pick(src, '첫 줄', N), body = pick(src, '본문', N), order = [];
      lines(pick(src, '사진 순서', N)).forEach(function (l) {
        var no = photoNo(l); if (!no) return;
        order.push({ photo: no, why: l.replace(/^\s*\d+\s*[.)]\s*/, '').replace(/사진\s*\d+\s*[—\-–:]*\s*/, '').trim() });
      });
      if (!hook && !body) body = String(raw || '').trim();
      return { hook: hook, body: body, tags: tagsOf(pick(src, '해시태그', N)), order: order };
    }
    if (kind === 'shorts') {
      var M = ['제목', '장면', '설명', '태그'];
      var scenes = [];
      lines(pick(src, '장면', M)).forEach(function (l) {
        var parts = l.replace(/^\s*\d+\s*[.)]\s*/, '').split('|').map(function (x) { return x.trim(); });
        var sc = { photo: 0, time: '', caption: '', narration: '' };
        parts.forEach(function (x) {
          if (/^화면\s*글자\s*[:：]/.test(x)) sc.caption = x.replace(/^화면\s*글자\s*[:：]\s*/, '');
          else if (/^내레이션\s*[:：]/.test(x)) sc.narration = x.replace(/^내레이션\s*[:：]\s*/, '');
          else if (/사진\s*\d+/.test(x) && !sc.photo) sc.photo = photoNo(x);
          else if (/\d+\s*[~\-–]\s*\d+\s*초|\d+\s*초/.test(x) && !sc.time) sc.time = x;
          else if (!sc.caption && !sc.photo && x) sc.caption = x;
        });
        if (sc.caption || sc.narration) scenes.push(sc);
      });
      var desc = pick(src, '설명', M);
      if (!scenes.length && !desc) desc = String(raw || '').trim();
      return { titles: numbered(pick(src, '제목', M)).slice(0, 5), scenes: scenes, desc: desc, tags: tagsOf(pick(src, '태그', M)) };
    }
    if (kind === 'work') {
      var W = ['제목', '설명'];
      var t = numbered(pick(src, '제목', W))[0] || '', b = pick(src, '설명', W);
      if (!t && !b) b = String(raw || '').trim();
      return { title: t.replace(/^["'“]|["'”]$/g, ''), body: b };
    }
    var B = ['제목', '본문', '해시태그'];
    var titles = numbered(pick(src, '제목', B)).slice(0, 5), bd = pick(src, '본문', B);
    if (!bd && !titles.length) bd = String(raw || '').trim();
    return { titles: titles, body: bd, tags: tagsOf(pick(src, '해시태그', B)).slice(0, 20) };
  }

  /** 받은 답이 쓸 만한지 (빈 답 거르기) */
  function usable(kind, r) {
    if (!r) return false;
    if (kind === 'instagram') return !!(r.body || r.hook);
    if (kind === 'shorts') return !!(r.scenes.length || r.desc);
    if (kind === 'work') return !!r.body;
    return !!r.body;
  }

  return { build: build, text: text, parse: parse, usable: usable, MAX_TOKENS: MAX_TOKENS, KINDS: ['blog', 'instagram', 'shorts', 'work'] };
});
