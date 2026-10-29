/* =====================================================================
   관리화면 — AI 글쓰기 연결 (AIKit)
   어디서 AI를 부를지 정합니다.
   1) 실제 홈페이지(Netlify): 서버 함수 /api/ai-write → Anthropic API (Netlify 환경변수 ANTHROPIC_API_KEY, 앤의 API 키)
   2) claude.ai 미리보기(아티팩트) 안: 보고 있는 사람의 Claude 계정으로 바로 씀 (아티팩트의 'Claude에게 묻기' 기능, 처음 한 번 허락)
   3) 둘 다 안 되면: 요청문을 복사해서 AI 앱에 붙여 넣는 방법
   요청문은 ai-prompts.js 한 곳에서 관리합니다.
   ===================================================================== */
(function () {
  'use strict';
  var K = window.AdminKit, P = window.AIPrompts;
  if (!K || !P) return;
  var C = K.C, DB = K.DB;
  var site = { name: C.name || '', phone: C.phone || '', domain: C.siteDomain || '' };
  var sampleP = null;

  // 미리보기 페이지(부모 창) 또는 이 창에 claude 런타임이 있으면 그걸 씀
  function hosts() {
    var out = [];
    try { if (window.parent && window.parent !== window && window.parent.claude && typeof window.parent.claude.use === 'function') out.push(window.parent); } catch (e) {}
    try { if (window.claude && typeof window.claude.use === 'function') out.push(window); } catch (e) {}
    return out;
  }
  function getSample() {
    if (sampleP) return sampleP;
    sampleP = hosts().reduce(function (pr, h) {
      return pr.then(function (found) {
        if (found) return found;
        var wait = new Promise(function (r) { setTimeout(function () { r(null); }, 12000); });
        return Promise.race([h.claude.use('sample'), wait]).then(function (fn) { return fn ? { fn: fn, win: h } : null; }, function () { return null; });
      });
    }, Promise.resolve(null));
    return sampleP;
  }
  /** 'live' (서버 함수) | 'claude' (미리보기에서 Claude 계정으로) | 'none' (요청문 복사) */
  function mode() {
    if (DB.live) return Promise.resolve('live');
    return getSample().then(function (s) { return s ? 'claude' : 'none'; });
  }

  // 사진: URL 문자열 또는 Blob → Blob
  function toBlob(x) {
    if (!x) return Promise.resolve(null);
    if (typeof Blob !== 'undefined' && x instanceof Blob) return Promise.resolve(x);
    return fetch(String(x)).then(function (r) { if (!r.ok) throw new Error('photo'); return r.blob(); }).catch(function () { return null; });
  }
  function toB64(b) {
    return new Promise(function (res) {
      var fr = new FileReader();
      fr.onload = function () { res(String(fr.result || '').replace(/^data:[^,]*,/, '')); };
      fr.onerror = function () { res(''); };
      fr.readAsDataURL(b);
    });
  }
  function err(code, msg) { var e = new Error(msg); e.code = code; return e; }

  /** 요청문 한 덩어리 (복사용) */
  function promptText(kind, o) {
    return P.text(kind, { work: o.work || {}, site: site, extra: o.extra || {}, photoCount: (o.photos || []).length });
  }

  /**
   * AI에 글 부탁하기
   * o = { work: {...}, workId, photos: [URL|Blob], extra: {tone,length,note}, onText(text) }
   * → { result, cut, via: 'live'|'claude' }  /  실패: Error(code: 'none'|'no_key'|'no_function'|'not_granted'|...)
   */
  function write(kind, o) {
    o = o || {};
    return mode().then(function (m) {
      if (m === 'live') {
        var send = kind === 'work'
          ? Promise.all((o.photos || []).slice(0, 6).map(toBlob)).then(function (bs) {
            return Promise.all(bs.filter(Boolean).map(function (b) { return toB64(b).then(function (d) { return d ? { type: /png|webp/.test(b.type) ? b.type : 'image/jpeg', data: d } : null; }); }));
          })
          : Promise.resolve(null);
        return send.then(function (imgs) {
          return DB.aiWrite(kind, { workId: o.workId, fields: kind === 'work' ? o.work : null, images: imgs ? imgs.filter(Boolean) : null, extra: o.extra });
        }).then(function (d) { return { result: d.result, cut: !!d.cut, via: 'live' }; });
      }
      if (m === 'claude') return viaClaude(kind, o);
      throw err('none', 'AI를 바로 쓸 수 없어요.');
    });
  }

  // 미리보기는 관리화면이 바깥 페이지의 안쪽 창(iframe)에서 열려요.
  // 바깥 페이지가 준비한 다리(__mdAI)가 있으면 그걸로 부름: 옵션·사진을 바깥 페이지 쪽에서 만들어야 Claude 기능이 '잘못된 요청'으로 보지 않음.
  function bridgeOf(W) { try { return W !== window && W.__mdAI && typeof W.__mdAI.write === 'function' ? W.__mdAI : null; } catch (e) { return null; } }
  // 다리가 없을 때: 그 창의 Object로 옵션을 만듦
  function callSample(S, prompt, imgs, onText) {
    var W = S.win, br = bridgeOf(W);
    if (br) {
      return Promise.all(imgs.map(function (b) { return b.arrayBuffer().then(function (buf) { return { buf: buf, type: b.type || 'image/jpeg' }; }); }))
        .then(function (list) { return br.write(prompt, { images: list, onText: onText ? function (t) { onText({ text: t }); } : null }); });
    }
    var opts = W === window ? {} : new W.Object();
    opts.modelTier = 'default'; opts.cache = false;
    if (onText) opts.onText = onText;
    return (W === window ? Promise.resolve(imgs) : Promise.all(imgs.map(function (b) { return b.arrayBuffer().then(function (buf) { return new W.Blob([buf], { type: b.type || 'image/jpeg' }); }); })))
      .then(function (list) {
        if (list.length) { var arr = W === window ? [] : new W.Array(); list.forEach(function (b) { arr.push(b); }); opts.images = arr; }
        return S.fn(prompt, opts);
      });
  }
  var MSG = {
    rate_limited: '조금 전에 여러 번 눌렀거나 Claude 사용량이 꽉 찼어요. 잠시 뒤에 다시 눌러 주세요.',
    session_expired: 'claude.ai 로그인이 풀렸어요. 다시 로그인한 뒤 눌러 주세요.',
    refused: 'Claude가 이 내용으로는 글을 쓰지 않았어요. 더 넣을 말을 바꿔서 다시 눌러 주세요.',
    empty_completion: 'Claude가 빈 글을 보냈어요. 다시 눌러 주세요.',
    prompt_too_large: '보낼 내용이 너무 길어요. 본문을 줄여서 다시 눌러 주세요.',
    invalid_request: '미리보기와 Claude 연결에 문제가 있어요. 앤에게 이 화면을 보여 주세요.',
    transform_error: '미리보기와 Claude 연결에 문제가 있어요. 앤에게 이 화면을 보여 주세요.',
    upstream_error: 'Claude 쪽 연결이 잠시 끊겼어요. 잠시 후 다시 눌러 주세요.',
  };
  var OFF = ['sampling_disabled', 'capability_disabled', 'not_declared', 'capability_removed', 'not_available'];

  function viaClaude(kind, o) {
    return getSample().then(function (S) {
      var fn = S.fn, br = bridgeOf(S.win);
      var lp = br && br.limits ? br.limits() : fn.limits ? fn.limits() : Promise.resolve({});
      return Promise.resolve(lp).catch(function () { return {}; }).then(function (lim) {
        var il = (lim && lim.images) || null, max = il ? Math.min(il.maxCount || 0, kind === 'work' ? 6 : 10) : 0;
        var list = (o.photos || []).slice(0, max);
        return Promise.all(list.map(toBlob)).then(function (bs) {
          return bs.filter(function (b) {
            if (!b || (il.maxInputBytes && b.size > il.maxInputBytes)) return false;
            var type = b.type || 'image/jpeg';
            return !(il.mediaTypes && il.mediaTypes.length && il.mediaTypes.indexOf(type) < 0);
          });
        });
      }).then(function (imgs) {
        var n = imgs.length;
        var prompt = P.text(kind, { work: o.work || {}, site: site, extra: o.extra || {}, photoCount: n }, '첨부한 사진 ' + n + '장이 순서대로 사진 1부터 사진 ' + n + '까지예요');
        var onText = o.onText ? function (u) { try { o.onText((u && u.text) || ''); } catch (e) {} } : null;
        return callSample(S, prompt, imgs, onText).then(function (r) {
          var res = P.parse(kind, r.text);
          if (!P.usable(kind, res)) throw err('empty', 'AI가 빈 글을 보냈어요. 다시 눌러 주세요.');
          return { result: res, cut: !!r.truncated, via: 'claude' };
        }, function (e) {
          var c = String((e && e.code) || 'upstream_error');
          try { console.warn('[AI] Claude 글쓰기 실패:', c, e && e.message); } catch (x) {}
          if ((c === 'images_unavailable' || c === 'image_rejected') && n) { o.photos = []; return viaClaude(kind, o); }   // 사진 없이 한 번 더
          if (c === 'not_granted') throw err(c, 'Claude 사용을 허락하지 않아서 쓰지 못했어요. 요청문 복사 방법으로 바꿀게요.');
          if (c === 'cancelled') throw err(c, '멈췄어요.');
          if (OFF.indexOf(c) >= 0) throw err('none', '이 화면에서는 Claude를 쓸 수 없어요. (' + c + ')');
          throw err(c, (MSG[c] || 'Claude가 글을 쓰지 못했어요. 잠시 후 다시 눌러 주세요.') + ' (오류: ' + c + ')');
        });
      });
    });
  }

  window.AIKit = { mode: mode, write: write, promptText: promptText, site: site };
})();
