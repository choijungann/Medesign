/* 상담 신청·전화·카톡 버튼 보이기/숨기기 — 지난번 상태를 먼저 적용해 깜빡임을 줄임 (최신 값은 site.js가 다시 확인)
   보안 설정(Content-Security-Policy)이 페이지 안에 직접 쓴 스크립트를 막기 때문에 별도 파일로 둡니다.
   <head> 안에서 다른 것보다 먼저, defer 없이 불러야 합니다. */
(function () {
  var d = document.documentElement, c = ' txt-pending';
  try {
    ['inq', 'tel', 'kakao'].forEach(function (k) {
      var v = localStorage.getItem('midesign-' + k);
      c += v === '0' ? ' ' + k + '-off' : v === '1' ? '' : ' ' + k + '-pending';
    });
  } catch (e) { c += ' inq-pending tel-pending kakao-pending'; }
  d.className += c;
})();
