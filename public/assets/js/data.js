/* =====================================================================
   데이터 계층 — Supabase(실서비스) / 데모(브라우저 저장) 두 가지 모드
   config.js 에 supabaseUrl·supabaseKey 가 있으면 실서비스 모드로 동작합니다.
   ===================================================================== */
(function () {
  'use strict';
  var CFG = window.SITE_CONFIG || {};
  var src = document.currentScript && document.currentScript.src;
  var BASE = src ? new URL('../../', src).href : location.origin + '/';
  var LIVE = !!(CFG.supabaseUrl && CFG.supabaseKey);
  var BUCKET = 'photos';
  var PRIV = 'private-photos';   // 하자 사진처럼 손님 집이 보이는 사진 — 관리자만 (비공개, 볼 때는 1시간짜리 서명 주소)
  var FILES = 'private-files';   // 계약서 첨부 파일(종이 계약서 스캔·도면·엑셀 등) — 관리자만 (비공개)
  // 올릴 수 있는 파일: 확장자 → 저장할 때 붙이는 종류. 저장소(schema.sql 의 private-files)도 이 종류만 받음
  var FILE_TYPES = {
    pdf: 'application/pdf', jpg: 'image/jpeg', jpeg: 'image/jpeg', png: 'image/png', webp: 'image/webp', heic: 'image/heic', heif: 'image/heif',
    hwp: 'application/x-hwp', hwpx: 'application/octet-stream', doc: 'application/msword',
    docx: 'application/vnd.openxmlformats-officedocument.wordprocessingml.document', xls: 'application/vnd.ms-excel',
    xlsx: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet', csv: 'text/csv', ppt: 'application/vnd.ms-powerpoint',
    pptx: 'application/vnd.openxmlformats-officedocument.presentationml.presentation', txt: 'text/plain', zip: 'application/zip',
    dwg: 'application/octet-stream', dxf: 'application/octet-stream',
  };
  var FILE_MAX = 20 * 1024 * 1024;   // 한 파일 20MB
  function fileExt(name) { var m = /\.([a-z0-9]{1,5})$/i.exec(String(name || '')); return m ? m[1].toLowerCase() : ''; }
  // 올리기 전에 확인 → { ext, type, name } (안 되면 알기 쉬운 오류)
  function fileCheck(file) {
    var ext = fileExt(file && file.name), type = FILE_TYPES[ext];
    var name = String((file && file.name) || '파일').replace(/[\u0000-\u001f\\/]+/g, ' ').trim().slice(-120) || '파일';
    if (!type) throw new Error('"' + name + '"은(는) 올릴 수 없는 종류예요. PDF·사진·한글·워드·엑셀·파워포인트·CAD·압축 파일만 올릴 수 있어요.');
    if (!(file.size > 0)) throw new Error('"' + name + '"은(는) 빈 파일이에요.');
    if (file.size > FILE_MAX) throw new Error('"' + name + '"은(는) ' + (file.size / 1048576).toFixed(1) + 'MB예요. 한 파일 20MB까지 올릴 수 있어요.');
    return { ext: ext, type: type, name: name };
  }
  function filePath(folder, ext) { return folder + '/' + Date.now().toString(36) + '-' + Math.random().toString(36).slice(2, 8) + '.' + ext; }
  function filePaths(files) { return (Array.isArray(files) ? files : []).map(function (f) { return f && f.path; }).filter(Boolean); }
  // 3D 그림: 그림 줄들(+작업) → 저장소 파일(그림·도면) 경로 (겹치지 않게)
  function renderPaths(images, project) {
    var out = [], add = function (p) { if (p && out.indexOf(p) < 0) out.push(p); };
    (images || []).forEach(function (r) { add(r && r.image_path); add(r && r.plan_path); });
    if (project) add(project.plan_path);
    return out;
  }
  function renderPlanPath(pid) { return 'renders/' + pid + '/plan-' + Date.now().toString(36) + '-' + Math.random().toString(36).slice(2, 7) + '.jpg'; }
  function renderErr(e) {
    var m = String((e && e.message) || e || '');
    if (/render_(projects|images)/i.test(m) && /(does not exist|schema cache|not find|relation)/i.test(m)) return new Error('3D 그림을 저장할 칸이 아직 없어요. 앤에게 알려 주세요. (Supabase에서 최신 schema.sql 실행 필요)');
    return e;
  }
  // 목록용: 작업마다 그림 수·만드는 중인 수·가장 최근 그림
  function renderSummary(projects, images) {
    var by = {};
    (images || []).forEach(function (r) { (by[r.project_id] = by[r.project_id] || []).push(r); });
    return (projects || []).map(function (p) {
      var l = (by[p.id] || []).slice().sort(function (a, b) { return (b.created_at || '').localeCompare(a.created_at || ''); });
      var done = l.filter(function (r) { return r.status === 'done' && r.image_path; });
      return Object.assign({}, p, { image_count: done.length, busy_count: l.filter(function (r) { return r.status === 'queued' || r.status === 'running'; }).length, cover: done[0] ? done[0].image_path : '' });
    });
  }
  // Supabase 라이브러리는 외부 CDN 대신 홈페이지 안에 둔 사본을 씁니다 (MIT 라이선스, 같은 폴더의 supabase-js-LICENSE.txt)
  var SUPABASE_JS = BASE + 'assets/vendor/supabase-js-2.117.3.js';

  function uuid() {
    if (window.crypto && crypto.randomUUID) return crypto.randomUUID();
    return 'id-' + Date.now().toString(36) + '-' + Math.random().toString(36).slice(2, 10);
  }
  function byNewest(a, b) { return (b.created_at || '').localeCompare(a.created_at || ''); }
  function clone(o) { return JSON.parse(JSON.stringify(o)); }

  /* ------------------------------------------------------------------
     실서비스: Supabase
     ------------------------------------------------------------------ */
  var clientPromise = null;
  function sb() {
    if (clientPromise) return clientPromise;
    clientPromise = new Promise(function (resolve, reject) {
      function make() {
        resolve(window.supabase.createClient(CFG.supabaseUrl, CFG.supabaseKey, {
          auth: { persistSession: true, autoRefreshToken: true, storageKey: 'interior-admin-auth' },
        }));
      }
      if (window.supabase && window.supabase.createClient) return make();
      var s = document.createElement('script');
      s.src = SUPABASE_JS;
      s.onload = make;
      s.onerror = function () { clientPromise = null; reject(new Error('인터넷 연결을 확인해 주세요. (라이브러리를 불러오지 못했어요)')); };
      document.head.appendChild(s);
    });
    return clientPromise;
  }
  function check(res) {
    if (res.error) throw new Error(res.error.message || '저장소 오류');
    return res.data;
  }
  // Supabase는 한 번에 최대 1000줄(프로젝트 기본 설정)까지만 돌려줌 → 목록이 수천 건이 돼도 빠짐없이 나눠 받기
  // make() 는 매번 새 질의(select … order …)를 만들어 돌려줘야 함. 전체 개수(count)를 같이 받아 다 받을 때까지
  var PAGE = 1000;
  function allRows(make) {
    var out = [];
    function step(i) {
      return make().range(i, i + PAGE - 1).then(function (res) {
        var rows = check(res) || [], total = typeof res.count === 'number' ? res.count : null;
        out = out.concat(rows);
        if (!rows.length || (total != null ? out.length >= total : rows.length < PAGE) || out.length > 200000) return out;
        return step(out.length);
      });
    }
    return step(0);
  }
  function toSettings(rows) {
    var o = {};
    (rows || []).forEach(function (r) { if (r && r.key) o[r.key] = r.value; });
    return o;
  }

  // 서버 함수 부르기 (로그인 토큰을 붙여서) — 관리자 추가·삭제, AI 글쓰기
  function callFn(path, body, failMsg) {
    return sb().then(function (c) { return c.auth.getSession(); }).then(function (r) {
      var token = r.data.session && r.data.session.access_token;
      if (!token) throw new Error('로그인이 풀렸어요. 다시 로그인한 뒤 눌러 주세요.');
      return fetch(BASE + path, { method: 'POST', headers: { 'Content-Type': 'application/json', Authorization: 'Bearer ' + token }, body: JSON.stringify(body || {}) });
    }).then(function (res) {
      return res.json().catch(function () { return {}; }).then(function (d) {
        if (!res.ok || !d.ok) {
          var e = new Error(d.error || (res.status === 429 ? '조금 전에 여러 번 눌렀어요. 1분 뒤에 다시 눌러 주세요.' : failMsg));
          e.code = d.code || (res.status === 404 ? 'no_function' : ''); throw e;
        }
        return d;
      });
    });
  }

  var Live = {
    init: function () { return Promise.resolve(); },
    photoUrl: function (path) {
      if (!path) return '';
      if (/^https?:|^data:|^blob:/.test(path)) return path;
      return CFG.supabaseUrl.replace(/\/$/, '') + '/storage/v1/object/public/' + BUCKET + '/' + path.split('/').map(encodeURIComponent).join('/');
    },
    listWorks: function (opt) {
      opt = opt || {};
      return sb().then(function (c) {
        return allRows(function () {
          var q = c.from('works').select('*', { count: 'exact' }).order('created_at', { ascending: false }).order('id');
          return opt.all ? q : q.eq('published', true);
        });
      });
    },
    getWork: function (id) {
      return sb().then(function (c) { return c.from('works').select('*').eq('id', id).maybeSingle().then(check); });
    },
    saveWork: function (rec) {
      return sb().then(function (c) {
        var row = clone(rec);
        row.updated_at = new Date().toISOString();
        return c.from('works').upsert(row).select().single().then(check);
      });
    },
    deleteWork: function (id, o) {
      var self = this;
      return self.getWork(id).then(function (w) {
        return sb().then(function (c) {
          return c.from('works').delete().eq('id', id).then(check).then(function () {
            return keepFiles(o) ? null : self.removePhotos(photoPaths(w && w.photos));
          });
        });
      });
    },
    listReviews: function (opt) {
      opt = opt || {};
      return sb().then(function (c) {
        return allRows(function () {
          var q = c.from('reviews').select('*', { count: 'exact' }).order('created_at', { ascending: false }).order('id');
          return opt.all ? q : q.eq('published', true);
        });
      });
    },
    getReview: function (id) {
      return sb().then(function (c) { return c.from('reviews').select('*').eq('id', id).maybeSingle().then(check); });
    },
    saveReview: function (rec) {
      return sb().then(function (c) { return c.from('reviews').upsert(clone(rec)).select().single().then(check); });
    },
    deleteReview: function (id, o) {
      var self = this;
      return self.getReview(id).then(function (r) {
        return sb().then(function (c) {
          return c.from('reviews').delete().eq('id', id).then(check).then(function () {
            return keepFiles(o) ? null : self.removePhotos(photoPaths(r && r.photos));
          });
        });
      });
    },
    uploadPhoto: function (folder, img, o) {
      var name = folder + '/' + Date.now().toString(36) + '-' + Math.random().toString(36).slice(2, 7);
      var full = name + '.jpg', thumb = name + '_t.jpg';
      var opts = { contentType: 'image/jpeg', cacheControl: o && o.private ? '3600' : '31536000', upsert: false };
      return sb().then(function (c) {
        var st = c.storage.from(o && o.private ? PRIV : BUCKET);
        return st.upload(full, img.full, opts).then(check)
          .then(function () { return st.upload(thumb, img.thumb, opts).then(check); })
          .then(function () { return { full: full, thumb: thumb, w: img.w, h: img.h }; });
      });
    },
    removePhotos: function (paths, o) {
      if (!paths || !paths.length) return Promise.resolve();
      return sb().then(function (c) { return c.storage.from(o && o.private ? PRIV : BUCKET).remove(paths); }).then(function () {});
    },
    /** 계약서 첨부 파일 올리기 → { path, name, size, type, at } (관리자만 볼 수 있는 저장소) */
    uploadFile: function (folder, file) {
      var f; try { f = fileCheck(file); } catch (e) { return Promise.reject(e); }
      var path = filePath(folder, f.ext);
      return sb().then(function (c) { return c.storage.from(FILES).upload(path, file, { contentType: f.type, cacheControl: '3600', upsert: false }).then(check); })
        .then(function () { return { path: path, name: f.name, size: file.size, type: f.type, at: new Date().toISOString() }; });
    },
    /** 첨부 파일 받기 → Blob (로그인한 관리자만) */
    getFile: function (path) {
      return sb().then(function (c) { return c.storage.from(FILES).download(path); }).then(function (r) {
        if (r.error || !r.data) throw new Error((r.error && r.error.message) || '파일을 받지 못했어요');
        return r.data;
      });
    },
    /** 첨부 파일 새 창에서 보기용 2분짜리 주소 (PDF·사진). 관리화면 보안 설정(CSP)을 물려받지 않게 blob 대신 저장소 주소를 씀 */
    fileUrl: function (path) {
      return sb().then(function (c) { return c.storage.from(FILES).createSignedUrl(path, 120); }).then(function (r) {
        if (r.error || !r.data || !r.data.signedUrl) throw new Error((r.error && r.error.message) || '파일 주소를 만들지 못했어요');
        return r.data.signedUrl;
      });
    },
    removeFiles: function (paths) {
      paths = (paths || []).filter(Boolean);
      if (!paths.length) return Promise.resolve();
      return sb().then(function (c) { return c.storage.from(FILES).remove(paths); }).then(function () {});
    },
    /** 비공개 사진 보기: { 경로: 1시간짜리 주소 } */
    signPhotos: function (paths) {
      paths = (paths || []).filter(Boolean);
      if (!paths.length) return Promise.resolve({});
      return sb().then(function (c) { return c.storage.from(PRIV).createSignedUrls(paths, 3600); }).then(function (r) {
        var out = {}; ((r && r.data) || []).forEach(function (x) { if (x && x.path && x.signedUrl) out[x.path] = x.signedUrl; });
        return out;
      }).catch(function () { return {}; });
    },
    session: function () {
      return sb().then(function (c) { return c.auth.getSession(); }).then(function (r) { return r.data.session; });
    },
    signIn: function (email, pw) {
      return sb().then(function (c) { return c.auth.signInWithPassword({ email: email, password: pw }); }).then(function (r) {
        if (r.error) {
          var m = String(r.error.message || '');
          if (/invalid login|invalid credentials/i.test(m)) throw new Error('이메일 또는 비밀번호가 맞지 않아요.');
          if (/email not confirmed/i.test(m)) throw new Error('아직 확인되지 않은 계정이에요. 앤에게 알려주세요.');
          throw new Error('로그인하지 못했어요. (' + m + ')');
        }
        return r.data.session;
      });
    },
    signOut: function () { return sb().then(function (c) { return c.auth.signOut(); }); },
    /** 처음 받은 비밀번호를 아직 안 바꿨는지 (비밀번호 바꾸기 화면에서 바꾸면 pw_changed_at 이 기록됨) */
    needsPasswordChange: function () {
      return sb().then(function (c) { return c.auth.getSession(); }).then(function (r) {
        var u = r.data.session && r.data.session.user;
        return !!u && !(u.user_metadata && u.user_metadata.pw_changed_at);
      });
    },
    /** 비밀번호 바꾸기: 지금 비밀번호로 한 번 더 확인 → 새 비밀번호 저장 → 다른 기기 로그아웃 */
    changePassword: function (current, next) {
      return sb().then(function (c) {
        return c.auth.getSession().then(function (r) {
          var email = r.data.session && r.data.session.user && r.data.session.user.email;
          if (!email) throw new Error('로그인이 풀렸어요. 다시 로그인한 뒤 바꿔 주세요.');
          return c.auth.signInWithPassword({ email: email, password: current });
        }).then(function (r) {
          if (r.error) {
            if (/invalid login|invalid credentials/i.test(r.error.message || '')) throw new Error('지금 비밀번호가 맞지 않아요. 다시 확인해 주세요.');
            if (r.error.status === 429) throw new Error('여러 번 시도해서 잠시 막혔어요. 몇 분 뒤에 다시 해 주세요.');
            throw new Error('확인하지 못했어요. 잠시 후 다시 눌러 주세요. (' + (r.error.message || '') + ')');
          }
          return c.auth.updateUser({ password: next, data: { pw_changed_at: new Date().toISOString() } });
        }).then(function (r) {
          if (r.error) {
            var e = r.error, code = e.code || '', m = e.message || '';
            if (code === 'same_password' || /same|different from the old/i.test(m)) throw new Error('지금 비밀번호와 다른 비밀번호로 정해 주세요.');
            if (code === 'weak_password' || /weak|at least|should contain|pwned|leaked/i.test(m)) {
              if ((e.reasons || []).indexOf('pwned') >= 0 || /pwned|leaked/i.test(m)) throw new Error('인터넷에 유출된 적이 있는 비밀번호예요. 다른 비밀번호로 정해 주세요.');
              throw new Error('비밀번호가 너무 짧거나 쉬워요. 더 길게, 숫자·글자를 섞어 정해 주세요.');
            }
            if (code === 'reauthentication_needed') throw new Error('보안 설정 때문에 지금은 바꿀 수 없어요. 앤에게 알려주세요.');
            if (e.status === 429) throw new Error('여러 번 시도해서 잠시 막혔어요. 몇 분 뒤에 다시 해 주세요.');
            throw new Error('바꾸지 못했어요. 잠시 후 다시 눌러 주세요. (' + m + ')');
          }
          // 다른 휴대폰·컴퓨터에 로그인해 둔 것은 끊기 (이 기기는 그대로)
          return c.auth.signOut({ scope: 'others' }).catch(function () {});
        });
      });
    },
    resetDemo: function () { return Promise.resolve(); },
    submitInquiry: function (form) {
      return fetch(BASE + 'api/inquiry', {
        method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(form),
      }).then(function (res) {
        return res.json().catch(function () { return {}; }).then(function (data) {
          if (!res.ok || !data.ok) throw new Error(data.error || '접수하지 못했어요. 잠시 후 다시 시도하거나 전화로 문의해 주세요.');
          return data;
        });
      });
    },
    listInquiries: function () {
      return sb().then(function (c) { return allRows(function () { return c.from('inquiries').select('*', { count: 'exact' }).order('created_at', { ascending: false }).order('id'); }); });
    },
    /* 견적서 (관리자만) — 목록에는 내용(doc) 없이 가볍게 */
    listEstimates: function () {
      return sb().then(function (c) {
        var cols = 'id,created_at,updated_at,inquiry_id,customer_id,customer_name,title,total';
        var q = function (sel) { return allRows(function () { return c.from('estimates').select(sel, { count: 'exact' }).order('updated_at', { ascending: false }).order('id'); }); };
        // 찾기용: 견적일·연락처·현장 이름·지역 (doc 안의 값) / status(진행 중·견적 중단)는 새 설정 SQL을 실행해야 생김 — 안 되면 차례로 줄여서
        var more = ',estimate_date:doc->>date,customer_phone:doc->customer->>phone,site_name:doc->site->>name,site_unit:doc->site->>unit,site_size:doc->site->>size,region:doc->site->>region,doc_title:doc->>title,items:doc->>items';
        return q(cols + ',status' + more).catch(function () { return q(cols + more); }).catch(function () { return q(cols); });
      });
    },
    getEstimate: function (id) {
      return sb().then(function (c) { return c.from('estimates').select('*').eq('id', id).maybeSingle().then(check); });
    },
    saveEstimate: function (rec) {
      return sb().then(function (c) {
        var row = { id: rec.id, inquiry_id: rec.inquiry_id || null, customer_id: rec.customer_id || null, customer_name: rec.customer_name || '', title: rec.title || '',
          total: Math.round(rec.total || 0), doc: withItems(rec.doc), updated_at: new Date().toISOString() };
        return c.from('estimates').upsert(row).select().single().then(check);
      });
    },
    deleteEstimate: function (id) {
      return sb().then(function (c) { return c.from('estimates').delete().eq('id', id).then(check); });
    },
    /** 견적 진행 상태만 바꾸기: 'open'(진행 중) | 'stopped'(견적 중단) */
    setEstimateStatus: function (id, status) {
      return sb().then(function (c) {
        return c.from('estimates').update({ status: status === 'stopped' ? 'stopped' : 'open', updated_at: new Date().toISOString() }).eq('id', id).then(check);
      });
    },
    /* 3D 그림 (관리자만) — 작업 = render_projects 한 줄(견적서 연결·공사 내용·도면), 그림 한 장 = render_images 한 줄
       도면·그림 파일은 비공개 저장소 private-photos 의 renders/(작업 id)/ */
    listRenderProjects: function () {
      return sb().then(function (c) {
        return Promise.all([
          allRows(function () { return c.from('render_projects').select('id,created_at,updated_at,estimate_id,title,plan_path,est_synced_at', { count: 'exact' }).order('updated_at', { ascending: false }).order('id'); }),
          allRows(function () { return c.from('render_images').select('id,project_id,status,image_path,created_at', { count: 'exact' }).order('created_at', { ascending: false }).order('id'); }),
        ]);
      }).then(function (r) { return renderSummary(r[0], r[1]); }, function (e) { throw renderErr(e); });
    },
    getRenderProject: function (id) {
      return sb().then(function (c) { return c.from('render_projects').select('*').eq('id', id).maybeSingle().then(check); }).catch(function (e) { throw renderErr(e); });
    },
    saveRenderProject: function (row) {
      var r = { id: row.id, estimate_id: row.estimate_id || null, title: String(row.title || '').slice(0, 120), plan_path: row.plan_path || '', est_synced_at: row.est_synced_at || null,
        doc: row.doc || {}, updated_at: new Date().toISOString() };
      return sb().then(function (c) { return c.from('render_projects').upsert(r).select().single().then(check); }).catch(function (e) { throw renderErr(e); });
    },
    deleteRenderProject: function (id, o) {
      return sb().then(function (c) {
        var get = keepFiles(o) ? Promise.resolve(null) : Promise.all([
          c.from('render_projects').select('plan_path').eq('id', id).maybeSingle().then(function (r) { return r && r.data; }, function () { return null; }),
          c.from('render_images').select('image_path,plan_path').eq('project_id', id).then(function (r) { return (r && r.data) || []; }, function () { return []; }),
        ]);
        return get.then(function (g) {
          return c.from('render_projects').delete().eq('id', id).then(check).then(function () {
            var paths = g ? renderPaths(g[1], g[0]) : [];
            return paths.length ? c.storage.from(PRIV).remove(paths).catch(function () {}) : null;
          });
        });
      });
    },
    listRenderImages: function (pid) {
      return sb().then(function (c) { return c.from('render_images').select('*').eq('project_id', pid).order('created_at', { ascending: false }).order('id').then(check); })
        .then(function (l) { return l || []; }, function (e) { throw renderErr(e); });
    },
    /** 도면 그림(JPEG Blob) 올리기 → 저장소 경로 */
    uploadRenderPlan: function (pid, blob) {
      var path = renderPlanPath(pid);
      return sb().then(function (c) { return c.storage.from(PRIV).upload(path, blob, { contentType: 'image/jpeg', cacheControl: '3600', upsert: false }).then(check); })
        .then(function () { return path; });
    },
    removeRenderPlan: function (path) {
      return path ? sb().then(function (c) { return c.storage.from(PRIV).remove([path]); }).then(function () {}, function () {}) : Promise.resolve();
    },
    /** 만들 그림 줄 넣기 (상태 queued) → 넣은 줄들 */
    addRenderImages: function (rows) {
      return sb().then(function (c) { return c.from('render_images').insert(rows).select().then(check); }).then(function (l) { return l || []; }, function (e) { throw renderErr(e); });
    },
    /** 그림 만들기 시작 (서버 함수 /api/render — 바로 202로 대답하고 뒤에서 만듦) */
    startRenders: function (ids) {
      return sb().then(function (c) { return c.auth.getSession(); }).then(function (r) {
        var token = r.data.session && r.data.session.access_token;
        if (!token) throw new Error('로그인이 풀렸어요. 다시 로그인한 뒤 눌러 주세요.');
        return fetch(BASE + 'api/render', { method: 'POST', headers: { 'Content-Type': 'application/json', Authorization: 'Bearer ' + token }, body: JSON.stringify({ ids: ids }) });
      }).then(function (res) {
        if (res.status === 202 || res.ok) return true;
        var e = new Error(res.status === 404 ? '그림 만들기 기능이 아직 설치되지 않았어요. 앤에게 알려 주세요.'
          : res.status === 429 ? '조금 전에 여러 번 눌렀어요. 1분 뒤에 다시 눌러 주세요.' : '그림 만들기를 시작하지 못했어요. 잠시 후 다시 눌러 주세요.');
        e.code = res.status === 404 ? 'no_function' : ''; throw e;
      });
    },
    updateRenderImage: function (id, patch) {
      var p = Object.assign({}, patch, { updated_at: new Date().toISOString() });
      return sb().then(function (c) { return c.from('render_images').update(p).eq('id', id).select().maybeSingle().then(check); });
    },
    /** 그림 한 장 지우기 (휴지통 없이 바로). 그 그림의 도면은 지금 작업 도면이 아니고 다른 그림도 안 쓸 때만 같이 지움 */
    deleteRenderImage: function (id) {
      return sb().then(function (c) {
        return c.from('render_images').select('project_id,image_path,plan_path').eq('id', id).maybeSingle().then(check).then(function (r) {
          if (!r) return null;
          return c.from('render_images').delete().eq('id', id).then(check).then(function () {
            var keep = !r.plan_path ? Promise.resolve(true) : Promise.all([
              c.from('render_images').select('id').eq('plan_path', r.plan_path).limit(1).then(function (x) { return !!(x && x.data && x.data.length); }, function () { return true; }),
              c.from('render_projects').select('plan_path').eq('id', r.project_id).maybeSingle().then(function (x) { return !!(x && x.data && x.data.plan_path === r.plan_path); }, function () { return true; }),
            ]).then(function (a) { return a[0] || a[1]; });
            return keep.then(function (k) {
              var paths = [r.image_path].concat(k ? [] : [r.plan_path]).filter(Boolean);
              return paths.length ? c.storage.from(PRIV).remove(paths).catch(function () {}) : null;
            });
          });
        });
      });
    },
    /* 관리자 전용 설정 (견적서 항목·단가·평수별 수량 등) — 방문자는 읽을 수 없음 */
    getAdminSetting: function (key) {
      return sb().then(function (c) { return c.from('admin_settings').select('value').eq('key', key).maybeSingle().then(check); })
        .then(function (r) { return r ? r.value : null; });
    },
    saveAdminSetting: function (key, value) {
      return sb().then(function (c) {
        return c.from('admin_settings').upsert({ key: key, value: value, updated_at: new Date().toISOString() }).then(check);
      });
    },
    /** 홈페이지 설정 (예: inquiry_enabled) — 공개 화면에서도 쓰므로 라이브러리 없이 가볍게 읽음 */
    getSettings: function () {
      var h = { apikey: CFG.supabaseKey };
      if (/^eyJ/.test(CFG.supabaseKey)) h.Authorization = 'Bearer ' + CFG.supabaseKey;
      return fetch(CFG.supabaseUrl.replace(/\/$/, '') + '/rest/v1/site_settings?select=key,value', { headers: h, cache: 'no-store' })
        .then(function (r) { if (!r.ok) throw new Error('설정을 불러오지 못했어요'); return r.json(); })
        .then(toSettings);
    },
    saveSetting: function (key, value) {
      return sb().then(function (c) {
        return c.from('site_settings').upsert({ key: key, value: value, updated_at: new Date().toISOString() }).then(check);
      });
    },
    updateInquiry: function (id, patch) {
      return sb().then(function (c) { return c.from('inquiries').update(patch).eq('id', id).then(check); });
    },
    deleteInquiry: function (id) {
      return sb().then(function (c) { return c.from('inquiries').delete().eq('id', id).then(check); });
    },

    /* ---------- 고객 관리 (관리자만) ---------- */
    listCustomers: function () {
      return sb().then(function (c) { return allRows(function () { return c.from('customers').select('*', { count: 'exact' }).order('updated_at', { ascending: false }).order('id'); }); });
    },
    getCustomer: function (id) {
      return sb().then(function (c) { return c.from('customers').select('*').eq('id', id).maybeSingle().then(check); });
    },
    saveCustomer: function (rec) {
      return sb().then(function (c) {
        var row = cleanCustomer(rec); row.updated_at = new Date().toISOString();
        return c.from('customers').upsert(row).select().single().then(check);
      });
    },
    /** 저장 공간: { db_bytes, tables: [{ name, bytes }], buckets: [{ bucket, bytes, files }], at } (schema.sql 의 admin_usage) */
    usage: function () {
      return sb().then(function (c) {
        return c.rpc('admin_usage').then(check).catch(function (e) {
          if (/admin_usage|could not find the function|schema cache/i.test(String(e && e.message))) throw new Error('저장 공간을 확인하는 기능이 아직 없어요. Supabase에서 최신 schema.sql 을 한 번 더 실행해 주세요.');
          throw e;
        });
      });
    },
    /** 블랙리스트 등록·해제 (관리자 화면에만 보이는 표시와 사유) */
    setBlacklist: function (id, on, note) {
      return sb().then(function (c) {
        var now = new Date().toISOString();
        return c.from('customers').update({ blacklist: !!on, blacklist_note: on ? str(note, 500) : '', blacklist_at: on ? now : null, updated_at: now })
          .eq('id', id).select().single().then(check).catch(function (e) {
            if (/blacklist/i.test(String(e && e.message))) throw new Error('블랙리스트 칸이 아직 없어요. Supabase에서 최신 schema.sql 을 한 번 더 실행해 주세요.');
            throw e;
          });
      });
    },
    deleteCustomer: function (id, o) {
      var self = this;
      // 하자 기록은 고객과 같이 지워지므로(데이터베이스 설정) 하자 사진도 먼저 모아 두었다가 지움
      return sb().then(function (c) {
        return c.from('defects').select('photos').eq('customer_id', id).then(function (r) { return (r && r.data) || []; }, function () { return []; }).then(function (defs) {
          var paths = []; defs.forEach(function (d) { paths = paths.concat(photoPaths(d.photos)); });
          return c.from('customers').delete().eq('id', id).then(check).then(function () { return paths.length && !keepFiles(o) ? self.removePhotos(paths, { private: true }).catch(function () {}) : null; });
        });
      });
    },
    /** 같은 전화번호(숫자만 비교) 고객을 찾고, 없으면 새로 만듦. 이름·주소가 비어 있던 고객이면 채워 줌 */
    ensureCustomer: function (o) {
      var row = cleanCustomer(o), digits = row.phone.replace(/[^0-9]/g, '');
      if (digits.length < 9) return Promise.resolve(null);
      return sb().then(function (c) {
        function find() { return c.from('customers').select('*').eq('phone_digits', digits).maybeSingle().then(check); }
        return find().then(function (found) {
          if (found) {
            var patch = {};
            if (!found.name && row.name) patch.name = row.name;
            if (!found.address && row.address) patch.address = row.address;
            if (!Object.keys(patch).length) return found;
            patch.updated_at = new Date().toISOString();
            return c.from('customers').update(patch).eq('id', found.id).select().single().then(check);
          }
          delete row.id;
          return c.from('customers').insert(row).select().single().then(check).catch(function (e) {
            if (/duplicate|unique/i.test(e.message || '')) return find();   // 동시에 두 번 만든 경우
            throw e;
          });
        });
      });
    },
    listContracts: function () {
      return sb().then(function (c) {
        var cols = 'id,created_at,updated_at,customer_id,estimate_id,customer_name,title,total,start_date,end_date,status';
        var q = function (sel) { return allRows(function () { return c.from('contracts').select(sel, { count: 'exact' }).order('updated_at', { ascending: false }).order('id'); }); };
        // 계약일·연락처·현장(doc 안의 값)도 함께 — 대시보드 '이번 달 계약'과 찾기에 씀. 안 되면 없이
        return q(cols + ',contract_date:doc->>date,customer_phone:doc->customer->>phone,site:doc->>site,phases:doc->phases,termination:doc->termination,doc_title:doc->>title,title_auto:doc->>titleAuto,items:doc->>items').catch(function () { return q(cols); });
      });
    },
    getContract: function (id) {
      return sb().then(function (c) { return c.from('contracts').select('*').eq('id', id).maybeSingle().then(check); });
    },
    saveContract: function (rec) {
      return sb().then(function (c) {
        var row = contractRow(rec); row.updated_at = new Date().toISOString();
        return c.from('contracts').upsert(row).select('id,created_at,updated_at,status').single().then(check);
      });
    },
    deleteContract: function (id, o) {
      var self = this;
      // 첨부 파일 목록을 먼저 읽어 두었다가 계약서를 지운 뒤 저장소에서도 지움
      return sb().then(function (c) {
        return c.from('contracts').select('files:doc->files').eq('id', id).maybeSingle().then(function (r) { return filePaths(r && r.data && r.data.files); }, function () { return []; })
          .then(function (paths) {
            return c.from('contracts').delete().eq('id', id).then(check).then(function () { return paths.length && !keepFiles(o) ? self.removeFiles(paths).catch(function () {}) : null; });
          });
      });
    },
    listDefects: function () {
      return sb().then(function (c) { return allRows(function () { return c.from('defects').select('*', { count: 'exact' }).order('received_on', { ascending: false }).order('id'); }); });
    },
    saveDefect: function (rec) {
      return sb().then(function (c) {
        var row = defectRow(rec); row.updated_at = new Date().toISOString();
        // repair_end 칸은 최신 schema.sql 을 실행해야 생김 — 아직 없으면 그 칸만 빼고 저장 (끝나는 날은 저장 안 됨)
        return c.from('defects').upsert(row).select().single().then(check).catch(function (err) {
          if (!/repair_end/.test(String(err && err.message))) throw err;
          delete row.repair_end; return c.from('defects').upsert(row).select().single().then(check);
        });
      });
    },
    deleteDefect: function (id, o) {
      var self = this;
      return sb().then(function (c) {
        return c.from('defects').select('photos').eq('id', id).maybeSingle().then(function (r) { return (r && r.data && r.data.photos) || []; }, function () { return []; })
          .then(function (photos) {
            return c.from('defects').delete().eq('id', id).then(check).then(function () { return keepFiles(o) ? null : self.removePhotos(photoPaths(photos), { private: true }).catch(function () {}); });
          });
      });
    },
    listSchedules: function () {
      return sb().then(function (c) { return allRows(function () { return c.from('schedules').select('*', { count: 'exact' }).order('start_on', { ascending: true }).order('id'); }); });
    },
    saveSchedule: function (rec) {
      return sb().then(function (c) {
        var row = scheduleRow(rec); row.updated_at = new Date().toISOString();
        return c.from('schedules').upsert(row).select().single().then(check);
      });
    },
    deleteSchedule: function (id) {
      return sb().then(function (c) { return c.from('schedules').delete().eq('id', id).then(check); });
    },
    /** AI 글쓰기 (서버 함수 netlify/functions/ai-write.mjs 가 Claude에 부탁)
     *  kind: 'blog' | 'instagram' | 'shorts' (시공사례 id로) · 'work' (시공사례 올리기 화면의 내용·사진으로) */
    aiWrite: function (kind, p) {
      p = p || {};
      return callFn('api/ai-write', { kind: kind, workId: p.workId || null, fields: p.fields || null, images: p.images || null, extra: p.extra || {},
        site: { name: CFG.name || '', phone: CFG.phone || '', domain: CFG.siteDomain || '' } }, 'AI가 글을 쓰지 못했어요. 잠시 후 다시 눌러 주세요.');
    },
    /** 관리자 명단 (서버 함수 netlify/functions/admin-users.mjs): action 'list' | 'add' | 'remove' */
    adminUsers: function (action, p) {
      return callFn('api/admin-users', Object.assign({ action: action }, p || {}), '처리하지 못했어요. 잠시 후 다시 눌러 주세요.');
    },
  };

  /* ---------- 고객·계약서·하자·일정: 저장 전에 모양 맞추기 (실서비스·데모 공용) ---------- */
  function fmtPhone(p) {
    var digits = String(p || '').replace(/[^0-9]/g, '');
    if (digits.length === 11) return digits.replace(/(\d{3})(\d{4})(\d{4})/, '$1-$2-$3');
    if (digits.length === 10) return digits.indexOf('02') === 0 ? digits.replace(/(\d{2})(\d{4})(\d{4})/, '$1-$2-$3') : digits.replace(/(\d{3})(\d{3})(\d{4})/, '$1-$2-$3');
    if (digits.length === 9 && digits.indexOf('02') === 0) return digits.replace(/(\d{2})(\d{3})(\d{4})/, '$1-$2-$3');
    return String(p || '').trim().slice(0, 20);
  }
  function str(v, n) { return String(v == null ? '' : v).trim().slice(0, n); }
  function day(v) { return /^\d{4}-\d{2}-\d{2}$/.test(v || '') ? v : null; }
  function cleanCustomer(o) {
    var row = { name: str(o.name, 30), phone: fmtPhone(o.phone), address: str(o.address, 120), memo: String(o.memo == null ? '' : o.memo).slice(0, 2000) };
    if (o.id) row.id = o.id;
    return row;
  }
  // 공사 항목 한 줄 (목록·첫 화면에 쓰려고 저장할 때 doc.items 로 같이 넣어 둠): 견적서 공사 항목 이름 → 없으면 세부 공사일정의 공정 이름
  function docItems(doc) {
    doc = doc || {};
    var cats = Array.isArray(doc.cats) ? doc.cats : doc.estimate && Array.isArray(doc.estimate.cats) ? doc.estimate.cats : [];
    var names = cats.filter(function (c) {
      return c && String(c.name || '').trim() && (c.lines || []).some(function (l) { return l && (String(l.name || '').trim() || Number(l.price) || Number(l.amount)); });
    }).map(function (c) { return String(c.name).trim(); });
    if (!names.length) (Array.isArray(doc.phases) ? doc.phases : []).forEach(function (h) { var n = h && String(h.name || '').trim(); if (n && names.indexOf(n) < 0) names.push(n); });
    return names.join(', ').slice(0, 200);
  }
  function withItems(doc) { doc = doc || {}; doc.items = docItems(doc); return doc; }
  function contractRow(r) {
    var st = day(r.start_date), en = day(r.end_date);
    if (st && en && en < st) en = st;
    return { id: r.id, customer_id: r.customer_id || null, estimate_id: r.estimate_id || null, customer_name: str(r.customer_name, 30),
      title: str(r.title, 120), total: Math.round(r.total || 0), start_date: st, end_date: en,
      status: ['draft', 'signed', 'done', 'canceled', 'terminated'].indexOf(r.status) >= 0 ? r.status : 'draft', doc: withItems(r.doc) };
  }
  function defectRow(r) {
    var row = { customer_id: r.customer_id, contract_id: r.contract_id || null, received_on: day(r.received_on) || new Date().toISOString().slice(0, 10),
      title: str(r.title, 120), body: String(r.body || '').slice(0, 3000),
      status: ['new', 'check', 'repair', 'done'].indexOf(r.status) >= 0 ? r.status : 'new',
      check_on: day(r.check_on), check_time: str(r.check_time, 20), check_note: String(r.check_note || '').slice(0, 3000),
      repair_on: day(r.repair_on), repair_time: str(r.repair_time, 20), repair_note: String(r.repair_note || '').slice(0, 3000), done_on: day(r.done_on),
      repair_end: day(r.repair_end) && day(r.repair_on) && day(r.repair_end) > day(r.repair_on) ? day(r.repair_end) : null,   // 하자 보수 끝나는 날 (시작일보다 뒤일 때만)
      photos: (Array.isArray(r.photos) ? r.photos : []).slice(0, 20).filter(function (p) { return p && p.full; })
        .map(function (p) { return { full: str(p.full, 200), thumb: str(p.thumb || p.full, 200), w: +p.w || 0, h: +p.h || 0 }; }) };
    if (r.id) row.id = r.id;
    return row;
  }
  function scheduleRow(r) {
    var st = day(r.start_on), en = day(r.end_on);
    if (en && st && en < st) en = st;
    if (en === st) en = null;
    var row = { start_on: st, end_on: en, time: str(r.time, 20), title: str(r.title, 120),
      kind: ['visit', 'work', 'meet', 'defect', 'etc'].indexOf(r.kind) >= 0 ? r.kind : 'etc', place: str(r.place, 120), memo: String(r.memo || '').slice(0, 1000),
      customer_id: r.customer_id || null };
    if (r.id) row.id = r.id;
    return row;
  }

  /** 상담 신청 날짜 보기 (관리화면 상담 신청 카드·견적서) */
  function fmtPref(date, time) {
    var m = /^(\d{4})-(\d{2})-(\d{2})$/.exec(date || '');
    var d = m ? Number(m[2]) + '월 ' + Number(m[3]) + '일(' + '일월화수목금토'.charAt(new Date(Date.UTC(+m[1], +m[2] - 1, +m[3])).getUTCDay()) + ')' : '';
    return [d, time].filter(Boolean).join(' ');
  }
  function fmtPlan(date, undecided) {
    var m = /^(\d{4})-(\d{2})-(\d{2})$/.exec(date || '');
    if (!m) return undecided ? '미정' : '';
    return m[1] + '년 ' + Number(m[2]) + '월 ' + Number(m[3]) + '일(' + '일월화수목금토'.charAt(new Date(Date.UTC(+m[1], +m[2] - 1, +m[3])).getUTCDay()) + ')';
  }
  function cleanInquiry(b) {
    var t = function (v, n) { return String(v == null ? '' : v).replace(/\s+/g, ' ').trim().slice(0, n); };
    var digits = String(b.phone || '').replace(/[^0-9]/g, '');
    return {
      name: t(b.name, 30),
      phone: digits.length === 11 ? digits.replace(/(\d{3})(\d{4})(\d{4})/, '$1-$2-$3') : digits.length === 10 ? digits.replace(/(\d{3})(\d{3})(\d{4})/, '$1-$2-$3') : t(b.phone, 20),
      space_type: t(b.space_type, 20), build_type: t(b.build_type, 20),
      region: t(b.region, 40), site_name: t(b.site_name, 60), size: t(String(b.size || '').replace(/[^0-9.]/g, ''), 6),
      scopes: (Array.isArray(b.scopes) ? b.scopes : []).slice(0, 30).map(function (x) { return t(x, 50); }).filter(Boolean),
      budget: t(b.budget, 30), method: t(b.method, 20),
      preferred_date: /^\d{4}-\d{2}-\d{2}$/.test(b.preferred_date || '') ? b.preferred_date : null,
      preferred_time: t(b.preferred_time, 20),
      planned_date: /^\d{4}-\d{2}-\d{2}$/.test(b.planned_date || '') ? b.planned_date : null,
      planned_undecided: !!b.planned_undecided && !/^\d{4}-\d{2}-\d{2}$/.test(b.planned_date || ''),
      message: String(b.message || '').trim().slice(0, 1000),
    };
  }

  function photoPaths(photos) {
    var out = [];
    (photos || []).forEach(function (p) { if (p.full) out.push(p.full); if (p.thumb) out.push(p.thumb); });
    return out.filter(function (p) { return !/^demo\//.test(p); });
  }

  /* ------------------------------------------------------------------
     데모: 브라우저(IndexedDB)에만 저장 — 다른 사람에게는 보이지 않음
     ------------------------------------------------------------------ */
  var mem = { works: {}, reviews: {}, blobs: {}, inquiries: {}, estimates: {}, customers: {}, contracts: {}, defects: {}, schedules: {}, render_projects: {}, render_images: {} };
  var V4 = ['customers', 'contracts', 'defects', 'schedules'];
  var urls = {};
  var idb = null;
  var ready = null;

  function openIdb() {
    return new Promise(function (resolve) {
      try {
        var r = indexedDB.open('interior-demo', 4);
        r.onupgradeneeded = function () {
          var db = r.result;
          ['works', 'reviews', 'blobs', 'meta', 'inquiries', 'estimates'].concat(V4).forEach(function (n) { if (!db.objectStoreNames.contains(n)) db.createObjectStore(n); });
        };
        r.onsuccess = function () { resolve(r.result); };
        r.onerror = function () { resolve(null); };
        r.onblocked = function () { resolve(null); };
      } catch (e) { resolve(null); }
    });
  }
  function idbAll(store) {
    return new Promise(function (resolve) {
      if (!idb) return resolve({});
      try {
        var out = {};
        var req = idb.transaction(store).objectStore(store).openCursor();
        req.onsuccess = function () {
          var cur = req.result;
          if (cur) { out[cur.key] = cur.value; cur.continue(); } else resolve(out);
        };
        req.onerror = function () { resolve({}); };
      } catch (e) { resolve({}); }
    });
  }
  function idbPut(store, key, val) {
    return new Promise(function (resolve) {
      if (!idb) return resolve();
      try {
        var tx = idb.transaction(store, 'readwrite');
        if (val === undefined) tx.objectStore(store).delete(key); else tx.objectStore(store).put(val, key);
        tx.oncomplete = function () { resolve(); };
        tx.onerror = function () { resolve(); };
      } catch (e) { resolve(); }
    });
  }
  function idbClear() {
    return Promise.all(['works', 'reviews', 'blobs', 'meta', 'inquiries', 'estimates'].concat(V4).map(function (s) {
      return new Promise(function (resolve) {
        if (!idb) return resolve();
        try { var tx = idb.transaction(s, 'readwrite'); tx.objectStore(s).clear(); tx.oncomplete = resolve; tx.onerror = resolve; } catch (e) { resolve(); }
      });
    }));
  }

  function loadSeed() {
    return new Promise(function (resolve) {
      if (window.DEMO_SEED) return resolve();
      var s = document.createElement('script');
      s.src = BASE + 'assets/demo/seed.js';
      s.onload = s.onerror = function () { resolve(); };
      document.head.appendChild(s);
    });
  }
  function seed() {
    var S = window.DEMO_SEED || { works: [], reviews: [] };
    mem.works = {}; mem.reviews = {}; mem.blobs = {}; mem.inquiries = {}; mem.estimates = {}; mem.settings = {}; mem.admin = {};
    V4.forEach(function (n) { mem[n] = {}; });
    var jobs = [];
    S.works.forEach(function (w) { mem.works[w.id] = clone(w); jobs.push(idbPut('works', w.id, clone(w))); });
    S.reviews.forEach(function (r) { mem.reviews[r.id] = clone(r); jobs.push(idbPut('reviews', r.id, clone(r))); });
    (S.inquiries || []).forEach(function (q) { mem.inquiries[q.id] = clone(q); jobs.push(idbPut('inquiries', q.id, clone(q))); });
    (S.estimates || []).forEach(function (e) { mem.estimates[e.id] = clone(e); jobs.push(idbPut('estimates', e.id, clone(e))); });
    V4.forEach(function (n) { (S[n] || []).forEach(function (x) { mem[n][x.id] = clone(x); jobs.push(idbPut(n, x.id, clone(x))); }); });
    jobs.push(idbPut('meta', 'seededV4', 1));
    jobs.push(idbPut('meta', 'seededV5', 1));
    jobs.push(idbPut('meta', 'seeded', 1));
    jobs.push(idbPut('meta', 'seededInq', 1));
    jobs.push(idbPut('meta', 'seededInq3', 1));
    jobs.push(idbPut('meta', 'seededEst', 1));
    jobs.push(idbPut('meta', 'seededUnit', 1));
    return Promise.all(jobs);
  }

  var Demo = {
    init: function () {
      if (ready) return ready;
      ready = loadSeed().then(openIdb).then(function (db) {
        idb = db;
        return idbAll('meta');
      }).then(function (meta) {
        mem.settings = meta.settings || {};
        mem.admin = meta.admin || {};
        mem.trash = Array.isArray(meta.trash) ? meta.trash : [];   // 휴지통 (데모는 이 브라우저에)
        // 3D 그림 (데모는 이 브라우저의 meta 에) — 만들던 중에 미리보기를 닫았으면 멈춘 것으로
        mem.render_projects = meta.render_projects && typeof meta.render_projects === 'object' ? meta.render_projects : {};
        mem.render_images = meta.render_images && typeof meta.render_images === 'object' ? meta.render_images : {};
        Object.keys(mem.render_images).forEach(function (k) {
          var r = mem.render_images[k];
          if (r.status === 'queued' || r.status === 'running') { r.status = 'failed'; r.error = '만들던 중에 화면을 닫아서 멈췄어요. 다시 만들어 주세요.'; }
        });
        if (!meta.seeded) return seed();
        return Promise.all([idbAll('works'), idbAll('reviews'), idbAll('blobs'), idbAll('inquiries'), idbAll('estimates')].concat(V4.map(idbAll))).then(function (r) {
          mem.works = r[0]; mem.reviews = r[1]; mem.blobs = r[2]; mem.inquiries = r[3]; mem.estimates = r[4];
          V4.forEach(function (n, i) { mem[n] = r[5 + i] || {}; });
          if (!meta.seededV4) {  // 예전 데모를 쓰던 브라우저에도 예시 고객·계약서·하자·일정 넣기
            var S4 = window.DEMO_SEED || {};
            V4.forEach(function (n) { (S4[n] || []).forEach(function (x) { mem[n][x.id] = clone(x); idbPut(n, x.id, clone(x)); }); });
            (S4.estimates || []).forEach(function (e) { if (mem.estimates[e.id] && e.customer_id && !mem.estimates[e.id].customer_id) { mem.estimates[e.id].customer_id = e.customer_id; idbPut('estimates', e.id, clone(mem.estimates[e.id])); } });
            idbPut('meta', 'seededV4', 1);
          }
          if (!meta.seededV5) {  // 예전 데모를 쓰던 브라우저에도 '공사 중' 예시 고객 넣기
            var S5 = window.DEMO_SEED || {};
            ['customers', 'contracts'].forEach(function (n) { (S5[n] || []).forEach(function (x) { if (x.id === 'demo-c3' || x.id === 'demo-k3') { mem[n][x.id] = clone(x); idbPut(n, x.id, clone(x)); } }); });
            idbPut('meta', 'seededV5', 1);
          }
          if (!meta.seededEst) {  // 예전 데모를 쓰던 브라우저에도 예시 견적서 넣기
            ((window.DEMO_SEED || {}).estimates || []).forEach(function (e) { mem.estimates[e.id] = clone(e); idbPut('estimates', e.id, clone(e)); });
            idbPut('meta', 'seededEst', 1);
          }
          if (!meta.seededInq) {  // 예전 데모를 쓰던 브라우저에도 예시 상담 넣기
            ((window.DEMO_SEED || {}).inquiries || []).forEach(function (q) { mem.inquiries[q.id] = clone(q); idbPut('inquiries', q.id, clone(q)); });
            idbPut('meta', 'seededInq', 1);
          }
          if (!meta.seededInq3) {  // 예전 데모의 예시 상담을 새 상담지 항목(공간 아파트·주택·상가, 지역·예산·시공 예정일·희망 상담일)으로 — 상담 완료 등 상태는 그대로, 지운 예시는 다시 넣지 않음
            ((window.DEMO_SEED || {}).inquiries || []).forEach(function (q) {
              var old = mem.inquiries[q.id]; if (!old) return;
              var row = clone(q); row.status = old.status || row.status; row.done_at = old.done_at || null;
              mem.inquiries[q.id] = row; idbPut('inquiries', q.id, clone(row));
            });
            idbPut('meta', 'seededInq3', 1);
          }
          if (!meta.seededUnit) {  // 예전 데모의 예시 주소·현장에 동·호수 넣기 (2026-10-26) — 직접 고친 값은 그대로 둠
            [['customers', 'demo-c1', 'address', '경기 남양주시 ○○동 상가 1층', '경기 남양주시 ○○동 상가 1층, 102호'],
              ['customers', 'demo-c2', 'address', '서울 강동구 ○○아파트 34평', '서울 강동구 ○○아파트 34평, 103동 502호'],
              ['customers', 'demo-c3', 'address', '경기 의정부시 ○○동 ○○아파트 24평', '경기 의정부시 ○○동 ○○아파트 24평, 101동 1001호'],
              ['contracts', 'demo-k1', 'doc.site', '경기 남양주시 ○○동 상가 1층', '경기 남양주시 ○○동 상가 1층, 102호'],
              ['contracts', 'demo-k2', 'doc.site', '서울 강동구 ○○아파트 34평', '서울 강동구 ○○아파트 34평, 103동 502호'],
              ['contracts', 'demo-k3', 'doc.site', '경기 의정부시 ○○동 ○○아파트 24평', '경기 의정부시 ○○동 ○○아파트 24평, 101동 1001호'],
              ['estimates', 'demo-e1', 'doc.site.unit', '', '102호'],
              ['schedules', 'demo-s1', 'place', '서울 송파구 ○○아파트', '서울 송파구 ○○아파트, 105동 803호']].forEach(function (u) {
              var row = mem[u[0]] && mem[u[0]][u[1]]; if (!row) return;
              var path = u[2].split('.'), o = row;
              for (var i = 0; i < path.length - 1 && o; i++) o = o[path[i]];
              var key = path[path.length - 1];
              if (!o || String(o[key] || '') !== u[3]) return;
              o[key] = u[4]; idbPut(u[0], u[1], clone(row));
            });
            idbPut('meta', 'seededUnit', 1);
          }
          Object.keys(mem.blobs).forEach(function (k) {
            try { urls[k] = URL.createObjectURL(mem.blobs[k]); } catch (e) {}
          });
        });
      });
      return ready;
    },
    photoUrl: function (path) {
      if (!path) return '';
      if (/^https?:|^data:|^blob:/.test(path)) return path;
      if (/^demo\//.test(path)) return BASE + 'assets/' + path;
      return urls[path] || '';
    },
    listWorks: function (opt) {
      opt = opt || {};
      return this.init().then(function () {
        return Object.keys(mem.works).map(function (k) { return clone(mem.works[k]); })
          .filter(function (w) { return opt.all || w.published; }).sort(byNewest);
      });
    },
    getWork: function (id) { return this.init().then(function () { return mem.works[id] ? clone(mem.works[id]) : null; }); },
    saveWork: function (rec) {
      return this.init().then(function () {
        var row = clone(rec);
        row.id = row.id || uuid();
        row.created_at = row.created_at || new Date().toISOString();
        row.updated_at = new Date().toISOString();
        mem.works[row.id] = row;
        return idbPut('works', row.id, clone(row)).then(function () { return clone(row); });
      });
    },
    deleteWork: function (id, o) {
      var self = this;
      return this.init().then(function () {
        var w = mem.works[id];
        delete mem.works[id];
        return idbPut('works', id, undefined).then(function () { return keepFiles(o) ? null : self.removePhotos(photoPaths(w && w.photos)); });
      });
    },
    listReviews: function (opt) {
      opt = opt || {};
      return this.init().then(function () {
        return Object.keys(mem.reviews).map(function (k) { return clone(mem.reviews[k]); })
          .filter(function (r) { return opt.all || r.published; }).sort(byNewest);
      });
    },
    getReview: function (id) { return this.init().then(function () { return mem.reviews[id] ? clone(mem.reviews[id]) : null; }); },
    saveReview: function (rec) {
      return this.init().then(function () {
        var row = clone(rec);
        row.id = row.id || uuid();
        row.created_at = row.created_at || new Date().toISOString();
        mem.reviews[row.id] = row;
        return idbPut('reviews', row.id, clone(row)).then(function () { return clone(row); });
      });
    },
    deleteReview: function (id, o) {
      var self = this;
      return this.init().then(function () {
        var r = mem.reviews[id];
        delete mem.reviews[id];
        return idbPut('reviews', id, undefined).then(function () { return keepFiles(o) ? null : self.removePhotos(photoPaths(r && r.photos)); });
      });
    },
    uploadPhoto: function (folder, img) {
      // 데모: 실제 업로드처럼 약간 기다렸다가 브라우저에 저장
      var name = 'u/' + folder + '/' + Date.now().toString(36) + '-' + Math.random().toString(36).slice(2, 7);
      var full = name + '.jpg', thumb = name + '_t.jpg';
      mem.blobs[full] = img.full; mem.blobs[thumb] = img.thumb;
      urls[full] = URL.createObjectURL(img.full); urls[thumb] = URL.createObjectURL(img.thumb);
      return Promise.all([idbPut('blobs', full, img.full), idbPut('blobs', thumb, img.thumb)])
        .then(function () { return new Promise(function (r) { setTimeout(r, 250); }); })
        .then(function () { return { full: full, thumb: thumb, w: img.w, h: img.h }; });
    },
    signPhotos: function (paths) {
      var out = {}; (paths || []).forEach(function (p) { if (urls[p]) out[p] = urls[p]; });
      return Promise.resolve(out);
    },
    uploadFile: function (folder, file) {
      var f; try { f = fileCheck(file); } catch (e) { return Promise.reject(e); }
      var path = 'u/' + filePath(folder, f.ext);
      var blob = file.slice(0, file.size, f.type);
      mem.blobs[path] = blob;
      return idbPut('blobs', path, blob).then(function () { return new Promise(function (r) { setTimeout(r, 250); }); })
        .then(function () { return { path: path, name: f.name, size: file.size, type: f.type, at: new Date().toISOString() }; });
    },
    getFile: function (path) {
      return this.init().then(function () { if (!mem.blobs[path]) throw new Error('파일을 찾을 수 없어요'); return mem.blobs[path]; });
    },
    fileUrl: function (path) {
      return this.getFile(path).then(function (b) { var u = URL.createObjectURL(b); setTimeout(function () { URL.revokeObjectURL(u); }, 120000); return u; });
    },
    removeFiles: function (paths) { return this.removePhotos(paths); },
    removePhotos: function (paths) {
      return Promise.all((paths || []).map(function (p) {
        delete mem.blobs[p];
        if (urls[p]) { try { URL.revokeObjectURL(urls[p]); } catch (e) {} delete urls[p]; }
        return idbPut('blobs', p, undefined);
      })).then(function () {});
    },
    session: function () {
      var on = false;
      try { on = sessionStorage.getItem('demo-login') === '1'; } catch (e) { on = !!Demo._on; }
      return Promise.resolve(on || Demo._on ? { user: { email: 'demo@example.com' } } : null);
    },
    signIn: function () {
      Demo._on = true;
      try { sessionStorage.setItem('demo-login', '1'); } catch (e) {}
      return Promise.resolve({ user: { email: 'demo@example.com' } });
    },
    signOut: function () {
      Demo._on = false;
      try { sessionStorage.removeItem('demo-login'); } catch (e) {}
      return Promise.resolve();
    },
    needsPasswordChange: function () {
      var done = !!Demo._pw;
      try { done = done || sessionStorage.getItem('demo-pw-changed') === '1'; } catch (e) {}
      return Promise.resolve(!done);
    },
    changePassword: function () {
      Demo._pw = true;
      try { sessionStorage.setItem('demo-pw-changed', '1'); } catch (e) {}
      return new Promise(function (resolve) { setTimeout(resolve, 400); });
    },
    resetDemo: function () {
      Object.keys(urls).forEach(function (k) { try { URL.revokeObjectURL(urls[k]); } catch (e) {} });
      urls = {};
      return this.init().then(idbClear).then(seed);
    },
    submitInquiry: function (form) {
      // 데모: 서버 대신 이 브라우저에 저장
      return this.init().then(function () {
        if (mem.settings && mem.settings.inquiry_enabled === false) throw new Error('지금은 홈페이지 상담 신청을 받지 않고 있어요.');
        var rec = cleanInquiry(form);
        if (!rec.name || rec.phone.replace(/[^0-9]/g, '').length < 9) throw new Error('이름과 연락처를 확인해 주세요.');
        rec.id = uuid(); rec.created_at = new Date().toISOString(); rec.status = 'new'; rec.notified = true;
        rec.size = rec.size ? rec.size + '평' : '';
        mem.inquiries[rec.id] = rec;
        return idbPut('inquiries', rec.id, clone(rec)).then(function () {
          return new Promise(function (r) { setTimeout(r, 600); });
        }).then(function () { return { ok: true, demo: true }; });
      });
    },
    listInquiries: function () {
      return this.init().then(function () {
        return Object.keys(mem.inquiries).map(function (k) { return clone(mem.inquiries[k]); }).sort(byNewest);
      });
    },
    updateInquiry: function (id, patch) {
      return this.init().then(function () {
        if (!mem.inquiries[id]) return;
        Object.keys(patch).forEach(function (k) { mem.inquiries[id][k] = patch[k]; });
        // 실서비스와 같게: 상담 완료·상담 포기로 바꾼 시각 (둘 사이를 오가면 처음 시각 유지)
        if (patch.status === 'done' || patch.status === 'dropped') { if (!mem.inquiries[id].done_at) mem.inquiries[id].done_at = new Date().toISOString(); }
        if (patch.status === 'new') mem.inquiries[id].done_at = null;
        return idbPut('inquiries', id, clone(mem.inquiries[id]));
      });
    },
    deleteInquiry: function (id) {
      return this.init().then(function () { delete mem.inquiries[id]; return idbPut('inquiries', id, undefined); });
    },
    getSettings: function () { return this.init().then(function () { return clone(mem.settings || {}); }); },
    saveSetting: function (key, value) {
      return this.init().then(function () {
        mem.settings = mem.settings || {}; mem.settings[key] = value;
        return idbPut('meta', 'settings', clone(mem.settings));
      });
    },
    listEstimates: function () {
      return this.init().then(function () {
        return Object.keys(mem.estimates).map(function (k) {
          var e = mem.estimates[k];
          var dc = e.doc || {}, cu = dc.customer || {}, si = dc.site || {};
          return { id: e.id, created_at: e.created_at, updated_at: e.updated_at, inquiry_id: e.inquiry_id, customer_id: e.customer_id || null, customer_name: e.customer_name, title: e.title, total: e.total, status: e.status || 'open',
            estimate_date: dc.date || null, customer_phone: cu.phone || null, site_name: si.name || null, site_unit: si.unit || null, site_size: si.size || null, region: si.region || null, doc_title: dc.title || '', items: dc.items || docItems(dc) || null };
        }).sort(function (a, b) { return (b.updated_at || '').localeCompare(a.updated_at || ''); });
      });
    },
    getEstimate: function (id) {
      return this.init().then(function () { return mem.estimates[id] ? clone(mem.estimates[id]) : null; });
    },
    saveEstimate: function (rec) {
      return this.init().then(function () {
        var now = new Date().toISOString(), old = mem.estimates[rec.id];
        var row = { id: rec.id || uuid(), created_at: (old && old.created_at) || now, updated_at: now, inquiry_id: rec.inquiry_id || null,
          customer_id: rec.customer_id || null, customer_name: rec.customer_name || '', title: rec.title || '', total: Math.round(rec.total || 0), doc: withItems(clone(rec.doc || {})),
          status: (old && old.status) || 'open' };
        mem.estimates[row.id] = row;
        return idbPut('estimates', row.id, clone(row)).then(function () { return clone(row); });
      });
    },
    deleteEstimate: function (id) {
      return this.init().then(function () {
        delete mem.estimates[id];
        // 3D 그림 작업은 남고 견적서 연결만 비움 (실서비스 데이터베이스 설정과 같게)
        var n = 0; Object.keys(mem.render_projects).forEach(function (k) { if (mem.render_projects[k].estimate_id === id) { mem.render_projects[k].estimate_id = null; n++; } });
        return Promise.all([idbPut('estimates', id, undefined), n ? saveRenders() : null]);
      });
    },
    listRenderProjects: function () {
      return this.init().then(function () {
        return renderSummary(demoList('render_projects'), demoList('render_images')).sort(function (a, b) { return (b.updated_at || '').localeCompare(a.updated_at || ''); });
      });
    },
    getRenderProject: function (id) { return this.init().then(function () { return mem.render_projects[id] ? clone(mem.render_projects[id]) : null; }); },
    saveRenderProject: function (row) {
      return this.init().then(function () {
        var now = new Date().toISOString(), old = mem.render_projects[row.id];
        var r = { id: row.id || uuid(), created_at: (old && old.created_at) || now, updated_at: now, estimate_id: row.estimate_id || null, title: String(row.title || '').slice(0, 120),
          plan_path: row.plan_path || '', est_synced_at: row.est_synced_at || null, doc: clone(row.doc || {}) };
        mem.render_projects[r.id] = r;
        return saveRenders().then(function () { return clone(r); });
      });
    },
    deleteRenderProject: function (id, o) {
      return this.init().then(function () {
        var p = mem.render_projects[id], imgs = demoList('render_images').filter(function (r) { return r.project_id === id; });
        delete mem.render_projects[id];
        imgs.forEach(function (r) { delete mem.render_images[r.id]; });
        return Promise.all([saveRenders(), keepFiles(o) ? null : Demo.removePhotos(renderPaths(imgs, p))]);
      });
    },
    listRenderImages: function (pid) {
      return this.init().then(function () {
        return demoList('render_images').filter(function (r) { return r.project_id === pid; }).sort(function (a, b) { return (b.created_at || '').localeCompare(a.created_at || ''); });
      });
    },
    uploadRenderPlan: function (pid, blob) {
      var path = 'u/' + renderPlanPath(pid);
      mem.blobs[path] = blob; urls[path] = URL.createObjectURL(blob);
      return idbPut('blobs', path, blob).then(function () { return new Promise(function (r) { setTimeout(r, 250); }); }).then(function () { return path; });
    },
    removeRenderPlan: function (path) { return path ? Demo.removePhotos([path]) : Promise.resolve(); },
    addRenderImages: function (rows) {
      return this.init().then(function () {
        var now = new Date().toISOString();   // 한 번에 넣은 줄은 같은 시각 (실서비스와 같게)
        var out = rows.map(function (x) {
          var r = Object.assign({ view: 'overview', plan_path: '', input: {}, status: 'queued', image_path: null, caption: '', prompt: '', error: '', model: '' }, clone(x));
          r.id = r.id || uuid(); r.created_at = now; r.updated_at = now;
          mem.render_images[r.id] = r; return clone(r);
        });
        return saveRenders().then(function () { return out; });
      });
    },
    // 데모(미리보기): 실제 그림 AI 대신 '견본 그림'을 만들어 흐름만 보여 줌
    startRenders: function (ids) {
      return this.init().then(function () {
        ids.forEach(function (id, i) {
          setTimeout(function () {
            var r = mem.render_images[id]; if (!r || r.status !== 'queued') return;
            r.status = 'running'; r.updated_at = new Date().toISOString(); saveRenders();
          }, 500 + i * 200);
          setTimeout(function () {
            var r = mem.render_images[id]; if (!r || r.status !== 'running') return;
            demoRenderImage(r).then(function (blob) {
              var cur = mem.render_images[id]; if (!cur || cur.status !== 'running') return;
              var path = 'u/renders/' + cur.project_id + '/' + cur.id + '.jpg';
              mem.blobs[path] = blob; urls[path] = URL.createObjectURL(blob); idbPut('blobs', path, blob);
              Object.assign(cur, { status: 'done', image_path: path, caption: '미리보기용 견본 그림', updated_at: new Date().toISOString() });
              saveRenders();
            });
          }, 2600 + i * 1400);
        });
        return true;
      });
    },
    updateRenderImage: function (id, patch) {
      return this.init().then(function () {
        var r = mem.render_images[id]; if (!r) return null;
        Object.assign(r, clone(patch), { updated_at: new Date().toISOString() });
        return saveRenders().then(function () { return clone(r); });
      });
    },
    deleteRenderImage: function (id) {
      return this.init().then(function () {
        var r = mem.render_images[id]; if (!r) return null;
        delete mem.render_images[id];
        var p = mem.render_projects[r.project_id];
        var keepPlan = (p && p.plan_path === r.plan_path) || demoList('render_images').some(function (x) { return x.plan_path === r.plan_path; });
        return Promise.all([saveRenders(), Demo.removePhotos([r.image_path].concat(keepPlan ? [] : [r.plan_path]).filter(Boolean))]);
      });
    },
    setEstimateStatus: function (id, status) {
      return this.init().then(function () {
        var e = mem.estimates[id]; if (!e) throw new Error('견적서를 찾을 수 없어요.');
        e.status = status === 'stopped' ? 'stopped' : 'open'; e.updated_at = new Date().toISOString();
        return idbPut('estimates', id, clone(e));
      });
    },
    getAdminSetting: function (key) {
      return this.init().then(function () { var a = mem.admin || {}; return a[key] != null ? clone(a[key]) : null; });
    },
    saveAdminSetting: function (key, value) {
      return this.init().then(function () {
        mem.admin = mem.admin || {}; mem.admin[key] = clone(value);
        return idbPut('meta', 'admin', clone(mem.admin));
      });
    },

    /* ---------- 고객 관리 (데모: 이 브라우저에만) ---------- */
    listCustomers: function () { return this.init().then(function () { return demoList('customers').sort(byUpdated); }); },
    getCustomer: function (id) { return this.init().then(function () { return mem.customers[id] ? clone(mem.customers[id]) : null; }); },
    saveCustomer: function (rec) {
      return this.init().then(function () {
        var row = cleanCustomer(rec), digits = row.phone.replace(/[^0-9]/g, '');
        var dup = digits && demoList('customers').filter(function (x) { return x.id !== row.id && x.phone_digits === digits; })[0];
        if (dup) throw new Error('duplicate key value violates unique constraint "customers_phone_uq"');
        row.phone_digits = digits;
        var old = row.id && mem.customers[row.id];   // 정보 고치기로 저장해도 블랙리스트 표시는 그대로
        if (old) ['blacklist', 'blacklist_note', 'blacklist_at'].forEach(function (k) { if (!(k in row) && k in old) row[k] = old[k]; });
        return demoSave('customers', row);
      });
    },
    deleteCustomer: function (id, o) {
      return this.init().then(function () {
        // 실서비스와 같게: 하자 기록은 같이 지우고, 견적서·계약서·일정은 고객 연결만 끊음
        demoList('defects').forEach(function (d) { if (d.customer_id === id) { delete mem.defects[d.id]; idbPut('defects', d.id, undefined); if (!keepFiles(o)) Demo.removePhotos(photoPaths(d.photos)); } });
        ['estimates', 'contracts', 'schedules'].forEach(function (n) {
          Object.keys(mem[n]).forEach(function (k) { if (mem[n][k].customer_id === id) { mem[n][k].customer_id = null; idbPut(n, k, clone(mem[n][k])); } });
        });
        delete mem.customers[id];
        return idbPut('customers', id, undefined);
      });
    },
    // 데모: 이 브라우저에 저장된 양으로 어림 (실제 Supabase 와 다름)
    usage: function () {
      return this.init().then(function () {
        var size = function (x) { try { return new Blob([JSON.stringify(x || {})]).size; } catch (e) { return 0; } };
        var tables = ['works', 'reviews', 'inquiries', 'estimates', 'customers', 'contracts', 'defects', 'schedules'].map(function (n) { return { name: n, bytes: size(mem[n]) }; })
          .concat([{ name: 'render_projects', bytes: size(mem.render_projects) }, { name: 'render_images', bytes: size(mem.render_images) }, { name: 'trash', bytes: size(mem.trash) }, { name: 'admin_settings', bytes: size(mem.settings) + size(mem.admin) }])
          .sort(function (a, b) { return b.bytes - a.bytes; });
        var B = {};
        Object.keys(mem.blobs || {}).forEach(function (k) {
          var b = /(^|\/)contracts\//.test(k) ? 'private-files' : /(^|\/)(defects|renders)\//.test(k) ? 'private-photos' : 'photos';
          B[b] = B[b] || { bucket: b, bytes: 0, files: 0 }; B[b].bytes += (mem.blobs[k] && mem.blobs[k].size) || 0; B[b].files++;
        });
        return { db_bytes: tables.reduce(function (a, t) { return a + t.bytes; }, 0), tables: tables, buckets: Object.keys(B).map(function (k) { return B[k]; }), at: new Date().toISOString(), demo: true };
      });
    },
    setBlacklist: function (id, on, note) {
      return this.init().then(function () {
        var c = mem.customers[id]; if (!c) throw new Error('고객을 찾을 수 없어요.');
        c = clone(c); c.blacklist = !!on; c.blacklist_note = on ? str(note, 500) : ''; c.blacklist_at = on ? new Date().toISOString() : null;
        return demoSave('customers', c);
      });
    },
    ensureCustomer: function (o) {
      var self = this;
      return this.init().then(function () {
        var row = cleanCustomer(o), digits = row.phone.replace(/[^0-9]/g, '');
        if (digits.length < 9) return null;
        var found = demoList('customers').filter(function (x) { return x.phone_digits === digits; })[0];
        if (found) {
          var ch = false;
          if (!found.name && row.name) { found.name = row.name; ch = true; }
          if (!found.address && row.address) { found.address = row.address; ch = true; }
          return ch ? demoSave('customers', found) : found;
        }
        delete row.id;
        return self.saveCustomer(row);
      });
    },
    listContracts: function () {
      return this.init().then(function () {
        return demoList('contracts').map(function (k) {
          var dc = k.doc || {};
          k.contract_date = dc.date || null; k.customer_phone = (dc.customer && dc.customer.phone) || null; k.site = dc.site || null; k.phases = dc.phases || null; k.termination = dc.termination || null;
          k.doc_title = dc.title || ''; k.title_auto = dc.titleAuto ? 'true' : null; k.items = dc.items || docItems(dc) || null;
          delete k.doc; return k;
        }).sort(byUpdated);
      });
    },
    getContract: function (id) { return this.init().then(function () { return mem.contracts[id] ? clone(mem.contracts[id]) : null; }); },
    saveContract: function (rec) {
      return this.init().then(function () { return demoSave('contracts', contractRow(rec)); })
        .then(function (r) { return { id: r.id, created_at: r.created_at, updated_at: r.updated_at, status: r.status }; });
    },
    deleteContract: function (id, o) {
      return this.init().then(function () {
        Object.keys(mem.defects).forEach(function (k) { if (mem.defects[k].contract_id === id) { mem.defects[k].contract_id = null; idbPut('defects', k, clone(mem.defects[k])); } });
        var files = filePaths(mem.contracts[id] && mem.contracts[id].doc && mem.contracts[id].doc.files);
        delete mem.contracts[id]; return idbPut('contracts', id, undefined).then(function () { return keepFiles(o) ? null : Demo.removeFiles(files); });
      });
    },
    listDefects: function () {
      return this.init().then(function () { return demoList('defects').sort(function (a, b) { return (b.received_on || '').localeCompare(a.received_on || ''); }); });
    },
    saveDefect: function (rec) { return this.init().then(function () { return demoSave('defects', defectRow(rec)); }); },
    deleteDefect: function (id, o) {
      var self = this;
      return this.init().then(function () { var d = mem.defects[id]; delete mem.defects[id]; return idbPut('defects', id, undefined).then(function () { return keepFiles(o) ? null : self.removePhotos(photoPaths(d && d.photos)); }); });
    },
    listSchedules: function () {
      return this.init().then(function () { return demoList('schedules').sort(function (a, b) { return (a.start_on || '').localeCompare(b.start_on || ''); }); });
    },
    saveSchedule: function (rec) { return this.init().then(function () { return demoSave('schedules', scheduleRow(rec)); }); },
    deleteSchedule: function (id) { return this.init().then(function () { delete mem.schedules[id]; return idbPut('schedules', id, undefined); }); },
    aiWrite: function () {
      var e = new Error('데모에서는 서버의 AI를 쓰지 않아요.'); e.code = 'demo';
      return Promise.reject(e);
    },
    // 데모: 이 기기에만 저장되는 관리자 명단 (실제 계정은 만들지 않음)
    adminUsers: function (action, p) {
      var self = this;
      return this.init().then(function () {
        var a = mem.admin || (mem.admin = {});
        var list = a.demo_admins || ['cwism@naver.com', 'smhland@naver.com', 'leontine@naver.com'];
        var me = 'smhland@naver.com', email = String((p && p.email) || '').trim().toLowerCase();
        function save() { a.demo_admins = list; return idbPut('meta', 'admin', clone(a)); }
        if (action === 'list') return { ok: true, usersOk: true, demo: true, admins: list.map(function (e) { return { email: e, me: e === me, account: true, last_sign_in_at: null }; }) };
        if (action === 'add') {
          if (!/^[^\s@]+@[^\s@]+\.[a-z]{2,}$/i.test(email)) throw new Error('이메일 주소를 다시 확인해 주세요.');
          if (list.indexOf(email) >= 0) throw new Error('이미 관리자로 등록된 이메일이에요.');
          if (String((p && p.password) || '').length < 10) throw new Error('처음 비밀번호는 10자 이상으로 정해 주세요.');
          list = list.concat([email]); return save().then(function () { return { ok: true, created: true }; });
        }
        if (action === 'remove') {
          if (email === me) throw new Error('자기 자신은 지울 수 없어요. 다른 관리자에게 부탁해 주세요.');
          if (list.length <= 1) throw new Error('마지막 관리자는 지울 수 없어요.');
          list = list.filter(function (x) { return x !== email; }); return save().then(function () { return { ok: true, accountRemoved: true }; });
        }
        throw new Error('잘못된 요청입니다.');
      });
    },
  };
  function byUpdated(a, b) { return (b.updated_at || '').localeCompare(a.updated_at || ''); }
  function demoList(store) { return Object.keys(mem[store] || {}).map(function (k) { return clone(mem[store][k]); }); }
  function demoSave(store, rec) {
    var now = new Date().toISOString(), row = clone(rec), old = row.id && mem[store][row.id];
    row.id = row.id || uuid();
    row.created_at = (old && old.created_at) || row.created_at || now;
    row.updated_at = now;
    mem[store][row.id] = row;
    return idbPut(store, row.id, clone(row)).then(function () { return clone(row); });
  }


  /* ------------------------------------------------------------------
     휴지통: 관리화면에서 지운 자료를 30일 동안 보관 → 설정 → 휴지통에서 되살리기 · 완전히 지우기
     · 지울 때 그 자료(와 되살릴 때 다시 이어 줄 연결)를 trash 표에 적고 원래 표에서 지움. 사진·첨부 파일은 저장소에 그대로 둠
     · 30일이 지나면 관리화면을 열 때(그리고 Netlify 예약 함수가) 휴지통에서도 지우고 사진·파일까지 지움
     · '보관 기간 지난 자료' 화면에서 지우는 것은 법에 따라 휴지통을 거치지 않고 바로 지움 ({ hard: true })
     ------------------------------------------------------------------ */
  var TRASH_DAYS = 30;
  var TRASH_KINDS = { works: '시공사례', reviews: '고객 후기', inquiries: '상담 신청', estimates: '견적서', contracts: '계약서', customers: '고객', defects: '하자 기록', schedules: '일정', files: '계약서 첨부 파일', render_projects: '3D 그림' };
  var DEL_FN = { works: 'deleteWork', reviews: 'deleteReview', inquiries: 'deleteInquiry', estimates: 'deleteEstimate', contracts: 'deleteContract', customers: 'deleteCustomer', defects: 'deleteDefect', schedules: 'deleteSchedule', render_projects: 'deleteRenderProject' };
  var FK = { customer_id: 'customers', estimate_id: 'estimates', inquiry_id: 'inquiries', contract_id: 'contracts', work_id: 'works' };
  function keepFiles(o) { return !!(o && o.keepFiles); }
  function trashTitle(kind, r) {
    var who = function (n, t) { return [n, t].filter(Boolean).join(' · '); };
    if (kind === 'works') return r.title || '제목 없는 시공사례';
    if (kind === 'reviews') return who(r.author, String(r.body || '').replace(/\s+/g, ' ').slice(0, 40));
    if (kind === 'inquiries') return who(r.name, r.phone);
    if (kind === 'estimates' || kind === 'contracts') return who(r.customer_name, r.title) || (kind === 'estimates' ? '견적서' : '계약서');
    if (kind === 'customers') return who(r.name || '이름 없음', r.phone);
    if (kind === 'defects') return r.title || '하자 기록';
    if (kind === 'schedules') { var m = /^\d{4}-(\d{2})-(\d{2})/.exec(r.start_on || ''); return who(m ? (+m[1]) + '/' + (+m[2]) : '', r.title); }
    if (kind === 'render_projects') return r.title || '3D 그림';
    return '';
  }
  // 되살리는 데 필요한 것 모으기: 원래 줄 + 끊길 연결(다시 이어 줄 자료 id) + 남겨 둘 사진·파일
  function trashSnapshot(kind, row, rel) {
    var ex = {}, files = [], jobs = [];
    var b = function (bucket) { return function (p) { return { bucket: bucket, path: p }; }; };
    var ids = function (t, col) { jobs.push(rel(t, col, row.id, 'id').then(function (l) { ex[t] = l.map(function (x) { return x.id; }); })); };
    if (kind === 'works') { files = photoPaths(row.photos).map(b(BUCKET)); ids('reviews', 'work_id'); }
    if (kind === 'reviews') files = photoPaths(row.photos).map(b(BUCKET));
    if (kind === 'inquiries') ids('estimates', 'inquiry_id');
    if (kind === 'estimates') { ids('contracts', 'estimate_id'); ids('render_projects', 'estimate_id'); }
    // 3D 그림 작업: 그림 줄은 같이 지워지므로(데이터베이스 설정) 줄 전체와 도면·그림 파일을 같이 보관 (되살리면 다시 넣음)
    if (kind === 'render_projects') jobs.push(rel('render_images', 'project_id', row.id, '*').then(function (l) { ex.images = l; files = files.concat(renderPaths(l, row).map(b(PRIV))); }));
    if (kind === 'contracts') { files = filePaths(row.doc && row.doc.files).map(b(FILES)); ids('defects', 'contract_id'); }
    if (kind === 'defects') files = photoPaths(row.photos).map(b(PRIV));
    if (kind === 'customers') {   // 고객을 지우면 하자 기록은 같이 지워지므로(데이터베이스 설정) 하자 기록 전체를 같이 보관
      jobs.push(rel('defects', 'customer_id', row.id, '*').then(function (l) { ex.defects = l; l.forEach(function (d) { files = files.concat(photoPaths(d.photos).map(b(PRIV))); }); }));
      ['estimates', 'contracts', 'schedules'].forEach(function (t) { ids(t, 'customer_id'); });
    }
    return Promise.all(jobs).then(function () {
      return { kind: kind, item_id: row.id, title: String(trashTitle(kind, row) || '').slice(0, 200), data: { row: row, extra: ex }, files: files };
    });
  }
  // 지우기 함수를 '휴지통으로 옮기기'로 바꿈. api = { get, rel, put, drop }
  function useTrash(D, api) {
    Object.keys(DEL_FN).forEach(function (kind) {
      var fn = DEL_FN[kind], hard = D[fn];
      if (!hard) return;
      D[fn] = function (id, o) {
        if (o && o.hard) return hard.call(D, id);
        return api.get(kind, id).then(function (row) {
          if (!row) return hard.call(D, id);
          return trashSnapshot(kind, row, api.rel).then(api.put).then(function (tid) {
            return hard.call(D, id, { keepFiles: true }).catch(function (e) { return api.drop(tid).catch(function () {}).then(function () { throw e; }); });
          });
        });
      };
    });
  }
  function trashErr(e) {
    var m = String((e && e.message) || e || '');
    if (/trash/i.test(m) && /(does not exist|schema cache|not find|relation)/i.test(m)) return new Error('휴지통이 아직 준비되지 않았어요. 앤에게 알려 주세요. (Supabase에서 최신 schema.sql 실행 필요)');
    return e;
  }
  function restoreErr(e) {
    var m = String((e && e.message) || e || '');
    if (/customers_phone_uq/.test(m)) return new Error('같은 전화번호의 고객이 이미 있어서 되살릴 수 없어요. 그 고객의 번호를 바꾸거나 지운 뒤 다시 눌러 주세요.');
    return trashErr(e);
  }

  /* 실서비스 */
  var liveTrash = {
    get: function (kind, id) { return sb().then(function (c) { return c.from(kind).select('*').eq('id', id).maybeSingle().then(check); }); },
    rel: function (t, col, val, cols) { return sb().then(function (c) { return c.from(t).select(cols).eq(col, val).then(check); }).then(function (l) { return l || []; }, function () { return []; }); },
    put: function (entry) { return sb().then(function (c) { return c.from('trash').insert(entry).select('id').single().then(check); }).then(function (r) { return r.id; }, function (e) { throw trashErr(e); }); },
    drop: function (tid) { return sb().then(function (c) { return c.from('trash').delete().eq('id', tid).then(check); }); },
  };
  useTrash(Live, liveTrash);
  Live.listTrash = function () {
    return sb().then(function (c) { return c.from('trash').select('id,kind,item_id,title,files,deleted_at').order('deleted_at', { ascending: false }).then(check); })
      .catch(function (e) { throw trashErr(e); });
  };
  Live.trashFile = function (contractId, file, title) {
    return liveTrash.put({ kind: 'files', item_id: contractId, title: String((file.name || '파일') + (title ? ' · ' + title : '')).slice(0, 200), data: { file: file }, files: [{ bucket: FILES, path: file.path }] });
  };
  Live.restoreTrash = function (tid) {
    return sb().then(function (c) {
      var drop = function () { return c.from('trash').delete().eq('id', tid).then(check); };
      var exists = function (tbl, id) { return c.from(tbl).select('id').eq('id', id).maybeSingle().then(function (r) { return !!(r && r.data); }); };
      var fixFk = function (row) {   // 가리키던 자료가 그새 없어졌으면 연결만 비움
        return Promise.all(Object.keys(FK).filter(function (k) { return row[k]; }).map(function (k) { return exists(FK[k], row[k]).then(function (ok) { if (!ok) row[k] = null; }); })).then(function () { return row; });
      };
      var relink = function (tbl, col, ids, val) {
        if (!ids || !ids.length) return Promise.resolve();
        var patch = {}; patch[col] = val;
        return c.from(tbl).update(patch).in('id', ids).is(col, null).then(check).catch(function () {});
      };
      return c.from('trash').select('*').eq('id', tid).maybeSingle().then(check).then(function (t) {
        if (!t) throw new Error('휴지통에서 찾을 수 없어요. 이미 되살렸거나 지웠을 수 있어요.');
        var d = t.data || {}, ex = d.extra || {};
        if (t.kind === 'files') {
          return c.from('contracts').select('id,doc').eq('id', t.item_id).maybeSingle().then(check).then(function (k) {
            if (!k) throw new Error('이 파일이 붙어 있던 계약서가 없어요. 휴지통에서 계약서를 먼저 되살려 주세요.');
            var doc = k.doc || {}; doc.files = (Array.isArray(doc.files) ? doc.files : []).filter(function (f) { return f.path !== d.file.path; }).concat([d.file]);
            return c.from('contracts').update({ doc: doc, updated_at: new Date().toISOString() }).eq('id', k.id).then(check);
          }).then(drop).then(function () { return t; });
        }
        var row = clone(d.row || {}); delete row.phone_digits;   // 계산되는 칸은 넣지 않음
        return exists(t.kind, row.id).then(function (already) {
          if (already) return null;   // 이미 있으면(되살린 적 있음) 휴지통에서만 뺌
          return fixFk(row).then(function () {
            if (t.kind === 'defects' && !row.customer_id) throw new Error('이 하자 기록의 고객이 없어요. 휴지통에서 고객을 먼저 되살려 주세요.');
            return c.from(t.kind).insert(row).then(check);
          }).then(function () {
            if (t.kind === 'works') return relink('reviews', 'work_id', ex.reviews, row.id);
            if (t.kind === 'inquiries') return relink('estimates', 'inquiry_id', ex.estimates, row.id);
            if (t.kind === 'estimates') return relink('contracts', 'estimate_id', ex.contracts, row.id).then(function () { return relink('render_projects', 'estimate_id', ex.render_projects, row.id); });
            if (t.kind === 'render_projects') {
              var imgs = (ex.images || []).map(function (r) { var x = clone(r); x.project_id = row.id; if (x.status === 'queued' || x.status === 'running') { x.status = 'failed'; x.error = '다시 만들어 주세요.'; } return x; });
              return imgs.length ? c.from('render_images').upsert(imgs).then(check).catch(function () {}) : null;
            }
            if (t.kind === 'contracts') return relink('defects', 'contract_id', ex.defects, row.id);
            if (t.kind === 'customers') {
              return Promise.all((ex.defects || []).map(function (df) {
                return fixFk(clone(df)).then(function (x) { x.customer_id = row.id; return c.from('defects').upsert(x).then(check); });
              })).then(function () { return Promise.all(['estimates', 'contracts', 'schedules'].map(function (tb) { return relink(tb, 'customer_id', ex[tb], row.id); })); });
            }
          });
        }).then(drop).then(function () { return t; });
      });
    }).catch(function (e) { throw restoreErr(e); });
  };
  Live.purgeTrash = function (tids) {
    if (!tids || !tids.length) return Promise.resolve(0);
    return sb().then(function (c) {
      return c.from('trash').select('id,files').in('id', tids).then(check).then(function (rows) {
        var byB = {};
        rows.forEach(function (r) { (r.files || []).forEach(function (f) { if (f && f.bucket && f.path) (byB[f.bucket] = byB[f.bucket] || []).push(f.path); }); });
        return Promise.all(Object.keys(byB).map(function (bk) { return c.storage.from(bk).remove(byB[bk]).catch(function () {}); }))
          .then(function () { return c.from('trash').delete().in('id', rows.map(function (r) { return r.id; })).then(check); })
          .then(function () { return rows.length; });
      });
    });
  };
  Live.purgeOldTrash = function () {
    var cut = new Date(Date.now() - TRASH_DAYS * 864e5).toISOString();
    return sb().then(function (c) { return c.from('trash').select('id').lt('deleted_at', cut).then(check); })
      .then(function (rows) { return rows && rows.length ? Live.purgeTrash(rows.map(function (r) { return r.id; })) : 0; });
  };

  /* 데모: 휴지통도 이 브라우저(meta 의 trash)에 */
  function saveTrash() { return idbPut('meta', 'trash', clone(mem.trash || [])); }
  function saveRenders() { return Promise.all([idbPut('meta', 'render_projects', clone(mem.render_projects || {})), idbPut('meta', 'render_images', clone(mem.render_images || {}))]); }
  // 데모 '견본 그림': 올린 도면을 흐리게 깔고 공간 이름과 '미리보기용 견본' 글자를 얹은 그림 (실제 AI 그림이 아님)
  function demoRenderImage(r) {
    return new Promise(function (resolve) {
      var c = document.createElement('canvas'); c.width = 1024; c.height = 768;
      var x = c.getContext('2d');
      var g = x.createLinearGradient(0, 0, 0, 768); g.addColorStop(0, '#F6F3EE'); g.addColorStop(1, '#E3DDD3');
      x.fillStyle = g; x.fillRect(0, 0, 1024, 768);
      var V = window.RenderPrompts, v = V && V.viewOf(r.view), font = '"Noto Sans KR", "Pretendard", "Apple SD Gothic Neo", "Malgun Gothic", sans-serif';
      var finish = function (img) {
        if (img) {
          var s = Math.min(944 / img.naturalWidth, 688 / img.naturalHeight), w = img.naturalWidth * s, h = img.naturalHeight * s;
          x.globalAlpha = 0.28; x.drawImage(img, (1024 - w) / 2, (768 - h) / 2, w, h); x.globalAlpha = 1;
        }
        x.fillStyle = 'rgba(255,255,255,0.94)'; x.fillRect(212, 270, 600, 228);
        x.strokeStyle = '#C9C1B4'; x.lineWidth = 2; x.strokeRect(212, 270, 600, 228);
        x.textAlign = 'center'; x.fillStyle = '#1F2A37'; x.font = '700 46px ' + font;
        x.fillText((v && v.name) || '3D 그림', 512, 350);
        x.fillStyle = '#5B6573'; x.font = '500 26px ' + font;
        x.fillText('미리보기용 견본 그림', 512, 408);
        x.fillText('실제 홈페이지에서는 AI가 3D 그림을 만들어요', 512, 450);
        c.toBlob(function (b) { resolve(b); }, 'image/jpeg', 0.86);
      };
      var b = r.plan_path && mem.blobs[r.plan_path];
      if (!b) return finish(null);
      var u = URL.createObjectURL(b), img = new Image();
      img.onload = function () { finish(img); URL.revokeObjectURL(u); };
      img.onerror = function () { finish(null); URL.revokeObjectURL(u); };
      img.src = u;
    });
  }
  var demoTrash = {
    get: function (kind, id) { return Demo.init().then(function () { return mem[kind] && mem[kind][id] ? clone(mem[kind][id]) : null; }); },
    rel: function (t, col, val) { return Promise.resolve(demoList(t).filter(function (x) { return x[col] === val; })); },
    put: function (entry) {
      return Demo.init().then(function () {
        var e = clone(entry); e.id = uuid(); e.deleted_at = new Date().toISOString();
        mem.trash = [e].concat(mem.trash || []);
        return saveTrash().then(function () { return e.id; });
      });
    },
    drop: function (tid) { mem.trash = (mem.trash || []).filter(function (t) { return t.id !== tid; }); return saveTrash(); },
  };
  useTrash(Demo, demoTrash);
  Demo.listTrash = function () {
    return Demo.init().then(function () { return (mem.trash || []).map(function (t) { return { id: t.id, kind: t.kind, item_id: t.item_id, title: t.title, files: t.files, deleted_at: t.deleted_at }; }); });
  };
  Demo.trashFile = function (contractId, file, title) {
    return demoTrash.put({ kind: 'files', item_id: contractId, title: String((file.name || '파일') + (title ? ' · ' + title : '')).slice(0, 200), data: { file: file }, files: [{ bucket: FILES, path: file.path }] });
  };
  Demo.restoreTrash = function (tid) {
    return Demo.init().then(function () {
      var t = (mem.trash || []).filter(function (x) { return x.id === tid; })[0];
      if (!t) throw new Error('휴지통에서 찾을 수 없어요. 이미 되살렸거나 지웠을 수 있어요.');
      var d = t.data || {}, ex = d.extra || {}, jobs = [];
      var fix = function (row) { Object.keys(FK).forEach(function (k) { if (row[k] && !(mem[FK[k]] || {})[row[k]]) row[k] = null; }); return row; };
      var relink = function (tbl, col, ids, val) { (ids || []).forEach(function (i) { var x = mem[tbl][i]; if (x && !x[col]) { x[col] = val; jobs.push(idbPut(tbl, i, clone(x))); } }); };
      if (t.kind === 'files') {
        var k = mem.contracts[t.item_id];
        if (!k) throw new Error('이 파일이 붙어 있던 계약서가 없어요. 휴지통에서 계약서를 먼저 되살려 주세요.');
        k.doc = k.doc || {}; k.doc.files = (k.doc.files || []).filter(function (f) { return f.path !== d.file.path; }).concat([d.file]);
        jobs.push(idbPut('contracts', k.id, clone(k)));
      } else {
        var row = fix(clone(d.row || {}));
        if (!mem[t.kind][row.id]) {
          if (t.kind === 'defects' && !row.customer_id) throw new Error('이 하자 기록의 고객이 없어요. 휴지통에서 고객을 먼저 되살려 주세요.');
          if (t.kind === 'customers' && row.phone_digits && demoList('customers').some(function (x) { return x.phone_digits === row.phone_digits; })) throw restoreErr(new Error('customers_phone_uq'));
          mem[t.kind][row.id] = row;
          jobs.push(t.kind === 'render_projects' ? saveRenders() : idbPut(t.kind, row.id, clone(row)));   // 3D 그림은 meta 에
          if (t.kind === 'works') relink('reviews', 'work_id', ex.reviews, row.id);
          if (t.kind === 'inquiries') relink('estimates', 'inquiry_id', ex.estimates, row.id);
          if (t.kind === 'estimates') {
            relink('contracts', 'estimate_id', ex.contracts, row.id);
            var rn = 0; (ex.render_projects || []).forEach(function (i) { var x = mem.render_projects[i]; if (x && !x.estimate_id) { x.estimate_id = row.id; rn++; } });
            if (rn) jobs.push(saveRenders());
          }
          if (t.kind === 'render_projects') {
            (ex.images || []).forEach(function (r) { var x = clone(r); x.project_id = row.id; if (x.status === 'queued' || x.status === 'running') { x.status = 'failed'; x.error = '다시 만들어 주세요.'; } mem.render_images[x.id] = x; });
            jobs.push(saveRenders());
          }
          if (t.kind === 'contracts') relink('defects', 'contract_id', ex.defects, row.id);
          if (t.kind === 'customers') {
            (ex.defects || []).forEach(function (df) { var x = fix(clone(df)); x.customer_id = row.id; mem.defects[x.id] = x; jobs.push(idbPut('defects', x.id, clone(x))); });
            ['estimates', 'contracts', 'schedules'].forEach(function (tb) { relink(tb, 'customer_id', ex[tb], row.id); });
          }
        }
      }
      return Promise.all(jobs).then(function () { return demoTrash.drop(tid); }).then(function () { return t; });
    });
  };
  Demo.purgeTrash = function (tids) {
    return Demo.init().then(function () {
      var gone = (mem.trash || []).filter(function (t) { return tids.indexOf(t.id) >= 0; }), paths = [];
      gone.forEach(function (t) { (t.files || []).forEach(function (f) { if (f && f.path) paths.push(f.path); }); });
      mem.trash = (mem.trash || []).filter(function (t) { return tids.indexOf(t.id) < 0; });
      return Promise.all([saveTrash(), Demo.removePhotos(paths)]).then(function () { return gone.length; });
    });
  };
  Demo.purgeOldTrash = function () {
    return Demo.init().then(function () {
      var cut = new Date(Date.now() - TRASH_DAYS * 864e5).toISOString();
      var old = (mem.trash || []).filter(function (t) { return t.deleted_at < cut; }).map(function (t) { return t.id; });
      return old.length ? Demo.purgeTrash(old) : 0;
    });
  };

  var DB = LIVE ? Live : Demo;
  DB.live = LIVE;
  DB.base = BASE;
  DB.newId = uuid;
  DB.fileAccept = Object.keys(FILE_TYPES).map(function (x) { return '.' + x; }).join(',');   // 파일 고르기 창에 보일 종류
  DB.fileCheck = fileCheck;
  DB.TRASH_DAYS = TRASH_DAYS;
  DB.TRASH_KINDS = TRASH_KINDS;
  DB.fmtPref = fmtPref;
  DB.fmtPlan = fmtPlan;
  DB.fmtPhone = fmtPhone;
  window.DB = DB;
})();
