/* =====================================================================
   관리화면 — 설정 → 관리자 추가·삭제
   · 관리자 = 관리화면에 들어올 수 있는 사람 (Supabase 로그인 계정 + admins 명단)
   · 추가: 이메일과 처음 비밀번호를 정하면 계정을 만들고 명단에 넣음 (처음 들어가면 비밀번호를 바꾸라는 안내가 뜸)
   · 삭제: 명단에서 빼고 로그인 계정도 지움. 자기 자신과 마지막 관리자는 지울 수 없음
   실제 처리는 서버 함수 netlify/functions/admin-users.mjs 가 합니다 (secret 키가 필요해서 화면에서는 못 함).
   ===================================================================== */
(function () {
  'use strict';
  var K = window.AdminKit;
  if (!K) return;
  var DB = K.DB, I = K.I, esc = K.esc, $ = K.$;
  var app = document.getElementById('app');
  var PW_MIN = 10;

  // 헷갈리는 글자(0·O·1·l·I)는 빼고 12자
  function makePw() {
    var A = 'ABCDEFGHJKLMNPQRSTUVWXYZabcdefghijkmnpqrstuvwxyz23456789', out = '', b = new Uint32Array(12);
    (window.crypto || window.msCrypto).getRandomValues(b);
    for (var i = 0; i < b.length; i++) out += A.charAt(b[i] % A.length);
    return out;
  }
  function when(ts) { if (!ts) return '아직 들어온 적 없음'; var d = new Date(ts); return '마지막 로그인 ' + (d.getMonth() + 1) + '월 ' + d.getDate() + '일'; }

  function view() {
    K.frame('관리자', true, 'settings');
    K.state.backTo = '#/settings';
    app.innerHTML = '<div class="page"><div class="loading">불러오는 중…</div></div>';
    if (!DB.adminUsers) { app.innerHTML = '<div class="page"><div class="empty-box">이 기능을 쓸 수 없어요.</div></div>'; return; }
    DB.adminUsers('list').then(function (d) {
      var list = d.admins || [];
      var page = document.createElement('div');
      page.className = 'page adm-page';
      page.innerHTML =
        '<div class="tip">' + I.info + '<span>관리자는 이 관리화면에 들어와서 고객 정보·견적서·계약서를 모두 볼 수 있어요. <b>믿을 수 있는 사람만</b> 넣어 주세요.</span></div>' +
        (d.demo ? '<div class="tip warn">' + I.info + '<span><b>데모 화면</b>이라 실제 계정은 만들거나 지우지 않고 이 기기에만 기록돼요.</span></div>' : '') +
        '<section class="cust-sec"><h2>지금 관리자 <small>' + list.length + '명</small></h2><div class="items adm-items">' + list.map(function (a) {
          var canDel = !a.me && list.length > 1;
          return '<div class="item has-del adm-item">' +
            (canDel ? '<button class="item-del" type="button" data-adel="' + esc(a.email) + '" aria-label="' + esc(a.email) + ' 관리자 지우기">' + I.trash + '<span>지우기</span></button>' : '') +
            '<div class="item-txt"><div class="item-title adm-email">' + esc(a.email) + (a.me ? ' <span class="pill on">나</span>' : '') + '</div>' +
            '<div class="item-meta">' + (a.account === false ? '<span class="pill warn">로그인 계정 없음</span>' : '<span>' + esc(when(a.last_sign_in_at)) + '</span>') + '</div></div></div>';
        }).join('') + '</div>' +
        (d.usersOk === false ? '<p class="hint">로그인 계정 정보를 불러오지 못해 명단만 보여요.</p>' : '') + '</section>' +
        '<section class="cust-sec"><h2>관리자 추가</h2><form class="txt-card adm-form" id="adm-form" novalidate>' +
        '<div class="field"><label for="adm-email">이메일</label><input class="input" id="adm-email" type="text" inputmode="email" autocomplete="off" autocapitalize="none" autocorrect="off" spellcheck="false" maxlength="120" placeholder="예) name@naver.com"></div>' +
        '<div class="field"><label for="adm-pw">처음 비밀번호 <span class="opt">(' + PW_MIN + '자 이상)</span></label>' +
        '<div class="pw-wrap"><input class="input" id="adm-pw" type="password" autocomplete="new-password" maxlength="72"><button type="button" id="adm-pw-toggle">보기</button></div>' +
        '<button type="button" class="btn btn-outline btn-sm adm-gen" data-gen>' + I.key + '비밀번호 만들어 주기</button>' +
        '<p class="hint">새 관리자에게 이메일과 이 비밀번호를 <b>직접</b> 알려 주세요. 처음 들어가면 자기 비밀번호로 바꾸라는 안내가 떠요. 이미 계정이 있는 이메일이면 비밀번호는 그대로 두고 명단에만 넣어요.</p></div>' +
        '<p class="error-msg" id="adm-msg" hidden></p>' +
        '<button class="btn btn-primary" type="submit">' + I.plus + '관리자 추가</button></form></section>';
      app.innerHTML = ''; app.appendChild(page);

      var pw = $('#adm-pw', page), msg = $('#adm-msg', page);
      function err(t) { msg.textContent = t; msg.hidden = !t; }
      $('#adm-pw-toggle', page).addEventListener('click', function () { var show = pw.type === 'password'; pw.type = show ? 'text' : 'password'; this.textContent = show ? '숨기기' : '보기'; });
      page.addEventListener('click', function (e) {
        var x;
        if (e.target.closest('[data-gen]')) { pw.value = makePw(); pw.type = 'text'; $('#adm-pw-toggle', page).textContent = '숨기기'; err(''); return; }
        if ((x = e.target.closest('[data-adel]'))) {
          var em = x.getAttribute('data-adel');
          K.ask({ title: '이 관리자를 지울까요?', text: '<b>' + esc(em) + '</b><br>관리화면에 더 이상 들어올 수 없고, 로그인 계정도 지워져요.', cancel: '그만두기', ok: '지우기', okClass: 'btn-danger' }).then(function (ok) {
            if (!ok) return;
            x.disabled = true;
            DB.adminUsers('remove', { email: em }).then(function (r) {
              if (r.accountRemoved === false) K.notice('명단에서 뺐어요', '로그인 계정은 Supabase에서 지워 주세요.');
              view();
            }).catch(function (er) { x.disabled = false; K.ask({ title: '지우지 못했어요', text: esc(er.message || K.friendlyError(er)), cancel: false, ok: '확인' }); });
          });
        }
      });
      $('#adm-form', page).addEventListener('submit', function (e) {
        e.preventDefault();
        var em = $('#adm-email', page).value.trim().toLowerCase(), p = pw.value;
        if (!/^[^\s@]+@[^\s@]+\.[a-z]{2,}$/i.test(em)) { err('이메일 주소를 다시 확인해 주세요.'); return $('#adm-email', page).focus(); }
        if (list.some(function (a) { return String(a.email).toLowerCase() === em; })) return err('이미 관리자로 등록된 이메일이에요.');
        if (p && p.length < PW_MIN) { err('처음 비밀번호는 ' + PW_MIN + '자 이상으로 정해 주세요.'); return pw.focus(); }
        err('');
        var b = $('button[type=submit]', page); b.disabled = true;
        DB.adminUsers('add', { email: em, password: p }).then(function (r) {
          // 비밀번호는 저장하지 않고, 알려 줄 수 있게 한 번만 보여 줌
          return K.ask({ title: '관리자를 추가했어요', ok: '확인', cancel: false,
            text: '<b>' + esc(em) + '</b><br>' + (r.created ? '처음 비밀번호: <b class="adm-pw-show">' + esc(p) + '</b><br>이 비밀번호를 새 관리자에게 직접 알려 주세요. 이 창을 닫으면 다시 볼 수 없어요.'
              : '이미 있던 계정이라 비밀번호는 바뀌지 않았어요. 원래 쓰던 비밀번호로 들어오면 돼요.') });
        }).then(function () { view(); }).catch(function (er) {
          b.disabled = false;
          err(er.code === 'no_function' ? '서버 함수가 아직 없어요. Netlify에 배포한 뒤 다시 해 주세요.' : (er.message || K.friendlyError(er)));
        });
      });
    }).catch(function (err) {
      app.innerHTML = '<div class="page"><div class="empty-box">' + esc(err.code === 'no_function' ? '관리자 기능은 Netlify에 배포한 뒤에 쓸 수 있어요.' : (err.message || K.friendlyError(err))) + '<br><a href="#/settings">설정으로</a></div></div>';
    });
  }

  K.routes.admins = view;
})();
