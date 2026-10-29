/* =====================================================================
   사진 자동 줄이기 — 휴대폰 원본(수 MB)을 홈페이지용 크기로 압축
   큰 사진: 긴 변 1800px / 목록용 작은 사진: 긴 변 800px (모두 JPEG)
   ===================================================================== */
(function () {
  'use strict';
  var FULL = 1800, THUMB = 800;

  function load(file) {
    return new Promise(function (resolve, reject) {
      var url = URL.createObjectURL(file);
      var img = new Image();
      img.decoding = 'async';
      img.onload = function () { resolve({ img: img, url: url }); };
      img.onerror = function () {
        URL.revokeObjectURL(url);
        reject(new Error('이 사진은 열 수 없어요. 다른 사진을 골라 주세요.'));
      };
      img.src = url;
    });
  }

  function draw(img, max, quality) {
    var w0 = img.naturalWidth, h0 = img.naturalHeight;
    var s = Math.min(1, max / Math.max(w0, h0));
    var w = Math.max(1, Math.round(w0 * s)), h = Math.max(1, Math.round(h0 * s));
    var c = document.createElement('canvas');
    c.width = w; c.height = h;
    var ctx = c.getContext('2d');
    ctx.fillStyle = '#fff';
    ctx.fillRect(0, 0, w, h);
    ctx.imageSmoothingEnabled = true;
    ctx.imageSmoothingQuality = 'high';
    ctx.drawImage(img, 0, 0, w, h);
    return new Promise(function (resolve, reject) {
      c.toBlob(function (b) {
        c.width = c.height = 0; // 메모리 정리
        if (b) resolve({ blob: b, w: w, h: h }); else reject(new Error('사진을 줄이지 못했어요.'));
      }, 'image/jpeg', quality);
    });
  }

  function prepare(file) {
    if (file.type && !/^image\//.test(file.type)) return Promise.reject(new Error('사진 파일만 올릴 수 있어요.'));
    return load(file).then(function (r) {
      return draw(r.img, FULL, 0.8).then(function (full) {
        return draw(r.img, THUMB, 0.76).then(function (thumb) {
          URL.revokeObjectURL(r.url);
          return { full: full.blob, thumb: thumb.blob, w: full.w, h: full.h };
        });
      }, function (e) { URL.revokeObjectURL(r.url); throw e; });
    });
  }

  // 한 장만 줄이기 (3D 예시 그림의 도면: 긴 변 max px JPEG) → { blob, w, h }
  function single(file, max, quality) {
    if (file.type && !/^image\//.test(file.type)) return Promise.reject(new Error('사진 파일만 올릴 수 있어요.'));
    return load(file).then(function (r) {
      return draw(r.img, max || FULL, quality || 0.85).then(function (x) { URL.revokeObjectURL(r.url); return x; }, function (e) { URL.revokeObjectURL(r.url); throw e; });
    });
  }

  window.ImageTools = { prepare: prepare, single: single };
})();
