-- =====================================================================
--  인테리어 홈페이지 — Supabase 초기 설정
--  Supabase 대시보드 > SQL Editor > New query 에 이 파일 전체를 붙여넣고 Run.
--  여러 번 실행해도 안전하도록 작성했습니다.
-- =====================================================================

-- 1) 관리자 명단 --------------------------------------------------------
--    여기에 등록된 이메일로 로그인한 사람만 글·사진을 올리고 고칠 수 있습니다.
create table if not exists public.admins (
  email text primary key
);
alter table public.admins enable row level security;
-- (admins 표에는 정책을 만들지 않습니다 → 외부에서 읽기·쓰기 불가)

create or replace function public.is_admin()
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select exists (
    select 1 from public.admins
    where lower(email) = lower(coalesce(auth.jwt() ->> 'email', ''))
  );
$$;
revoke all on function public.is_admin() from public;
grant execute on function public.is_admin() to anon, authenticated;


-- 2) 시공사례 -----------------------------------------------------------
create table if not exists public.works (
  id          uuid primary key default gen_random_uuid(),
  created_at  timestamptz not null default now(),
  updated_at  timestamptz not null default now(),
  title       text not null check (char_length(title) between 1 and 120),
  place       text not null default '',
  size        text not null default '',
  building    text not null default '',
  scopes      text[] not null default '{}',
  period      text not null default '',
  body        text not null default '',
  blog_url    text not null default '',
  photos      jsonb not null default '[]'::jsonb,   -- [{full, thumb, w, h}] 첫 번째가 대표 사진
  featured    boolean not null default false,       -- 메인 화면에 크게
  published   boolean not null default true         -- false = 숨김
);
create index if not exists works_created_idx on public.works (created_at desc);
alter table public.works enable row level security;

drop policy if exists works_read on public.works;
create policy works_read on public.works
  for select to anon, authenticated
  using (published or public.is_admin());

drop policy if exists works_insert on public.works;
create policy works_insert on public.works
  for insert to authenticated
  with check (public.is_admin());

drop policy if exists works_update on public.works;
create policy works_update on public.works
  for update to authenticated
  using (public.is_admin()) with check (public.is_admin());

drop policy if exists works_delete on public.works;
create policy works_delete on public.works
  for delete to authenticated
  using (public.is_admin());


-- 3) 고객 후기 ----------------------------------------------------------
create table if not exists public.reviews (
  id          uuid primary key default gen_random_uuid(),
  created_at  timestamptz not null default now(),
  author      text not null check (char_length(author) between 1 and 30),
  place       text not null default '',
  rating      smallint not null default 5 check (rating between 1 and 5),
  body        text not null check (char_length(body) between 1 and 3000),
  photos      jsonb not null default '[]'::jsonb,
  work_id     uuid references public.works(id) on delete set null,
  published   boolean not null default true
);
create index if not exists reviews_created_idx on public.reviews (created_at desc);
alter table public.reviews enable row level security;

drop policy if exists reviews_read on public.reviews;
create policy reviews_read on public.reviews
  for select to anon, authenticated
  using (published or public.is_admin());

drop policy if exists reviews_insert on public.reviews;
create policy reviews_insert on public.reviews
  for insert to authenticated
  with check (public.is_admin());

drop policy if exists reviews_update on public.reviews;
create policy reviews_update on public.reviews
  for update to authenticated
  using (public.is_admin()) with check (public.is_admin());

drop policy if exists reviews_delete on public.reviews;
create policy reviews_delete on public.reviews
  for delete to authenticated
  using (public.is_admin());


-- 4) 사진 저장소 (공개 읽기 / 관리자만 올리기·지우기) ---------------------
insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
values ('photos', 'photos', true, 10485760, array['image/jpeg', 'image/png', 'image/webp'])
on conflict (id) do update
  set public = true,
      file_size_limit = excluded.file_size_limit,
      allowed_mime_types = excluded.allowed_mime_types;

drop policy if exists photos_admin_select on storage.objects;
create policy photos_admin_select on storage.objects
  for select to authenticated
  using (bucket_id = 'photos' and public.is_admin());

drop policy if exists photos_admin_insert on storage.objects;
create policy photos_admin_insert on storage.objects
  for insert to authenticated
  with check (bucket_id = 'photos' and public.is_admin());

drop policy if exists photos_admin_update on storage.objects;
create policy photos_admin_update on storage.objects
  for update to authenticated
  using (bucket_id = 'photos' and public.is_admin());

drop policy if exists photos_admin_delete on storage.objects;
create policy photos_admin_delete on storage.objects
  for delete to authenticated
  using (bucket_id = 'photos' and public.is_admin());

-- 4-0) 비공개 사진 저장소 (하자 사진 등 손님 집이 보이는 사진) -----------------
--    홈페이지 방문자는 볼 수 없고(공개 아님) 관리자만 올리기·보기·지우기. 관리화면은 1시간짜리 서명 주소로 보여 줍니다.
insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
values ('private-photos', 'private-photos', false, 10485760, array['image/jpeg', 'image/png', 'image/webp'])
on conflict (id) do update
  set public = false,
      file_size_limit = excluded.file_size_limit,
      allowed_mime_types = excluded.allowed_mime_types;

drop policy if exists private_photos_admin_select on storage.objects;
create policy private_photos_admin_select on storage.objects
  for select to authenticated
  using (bucket_id = 'private-photos' and public.is_admin());

drop policy if exists private_photos_admin_insert on storage.objects;
create policy private_photos_admin_insert on storage.objects
  for insert to authenticated
  with check (bucket_id = 'private-photos' and public.is_admin());

drop policy if exists private_photos_admin_update on storage.objects;
create policy private_photos_admin_update on storage.objects
  for update to authenticated
  using (bucket_id = 'private-photos' and public.is_admin());

drop policy if exists private_photos_admin_delete on storage.objects;
create policy private_photos_admin_delete on storage.objects
  for delete to authenticated
  using (bucket_id = 'private-photos' and public.is_admin());

-- 4-0-1) 비공개 파일 저장소 (계약서 첨부 파일: 종이 계약서 스캔·도면·엑셀 등) -------------
--    관리자만 올리기·받기·지우기. 홈페이지 방문자는 볼 수 없음. 한 파일 20MB, 아래 종류만 받음
--    (관리화면이 확장자를 보고 종류를 붙여 올림 — data.js 의 FILE_TYPES 와 같게 유지)
insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
values ('private-files', 'private-files', false, 20971520, array[
  'application/pdf', 'image/jpeg', 'image/png', 'image/webp', 'image/heic', 'image/heif',
  'application/x-hwp', 'application/msword', 'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
  'application/vnd.ms-excel', 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet', 'text/csv',
  'application/vnd.ms-powerpoint', 'application/vnd.openxmlformats-officedocument.presentationml.presentation',
  'text/plain', 'application/zip', 'application/octet-stream'])
on conflict (id) do update
  set public = false,
      file_size_limit = excluded.file_size_limit,
      allowed_mime_types = excluded.allowed_mime_types;

drop policy if exists private_files_admin_select on storage.objects;
create policy private_files_admin_select on storage.objects
  for select to authenticated
  using (bucket_id = 'private-files' and public.is_admin());

drop policy if exists private_files_admin_insert on storage.objects;
create policy private_files_admin_insert on storage.objects
  for insert to authenticated
  with check (bucket_id = 'private-files' and public.is_admin());

drop policy if exists private_files_admin_update on storage.objects;
create policy private_files_admin_update on storage.objects
  for update to authenticated
  using (bucket_id = 'private-files' and public.is_admin());

drop policy if exists private_files_admin_delete on storage.objects;
create policy private_files_admin_delete on storage.objects
  for delete to authenticated
  using (bucket_id = 'private-files' and public.is_admin());


-- 5) 상담 신청 ----------------------------------------------------------
--    홈페이지 상담 신청서 → Netlify 함수(inquiry)가 secret(service_role) 키로 저장합니다.
--    방문자가 직접 쓰거나 읽을 수는 없고, 관리자만 보고·고치고·지울 수 있습니다.
create table if not exists public.inquiries (
  id          uuid primary key default gen_random_uuid(),
  created_at  timestamptz not null default now(),
  name        text not null check (char_length(name) between 1 and 30),
  phone       text not null check (char_length(phone) between 9 and 20),
  space_type  text not null default '',
  build_type  text not null default '',
  region      text not null default '',               -- 지역 (예: 서울 송파구)
  site_name   text not null default '',
  size        text not null default '',
  scopes      text[] not null default '{}',
  budget      text not null default '',
  method      text not null default '',
  preferred_date date,                                -- 희망 상담 날짜 (선택)
  preferred_time text not null default '',            -- 희망 시간대 (선택)
  planned_date date,                                  -- 시공 예정일 (선택)
  planned_undecided boolean not null default false,   -- 시공일 '아직 정하지 않았어요'
  message     text not null default '' check (char_length(message) <= 1000),
  agreed_at   timestamptz not null default now(),   -- 개인정보 수집·이용 동의 시각
  status      text not null default 'new' check (status in ('new', 'done', 'dropped')),   -- 새 상담 · 상담 완료 · 상담 포기
  done_at     timestamptz,                          -- '상담 완료'·'상담 포기'를 누른 시각 (보관 기간 계산용, 자동 기록)
  notified    boolean not null default false        -- (예전 문자 알림 성공 여부 — 지금은 문자를 보내지 않아 쓰지 않음)
);
-- 예전에 이 파일을 실행해 표가 이미 있다면, 아래 두 줄이 새 칸만 덧붙입니다
alter table public.inquiries add column if not exists preferred_date date;
alter table public.inquiries add column if not exists preferred_time text not null default '';
alter table public.inquiries add column if not exists region text not null default '';
alter table public.inquiries add column if not exists planned_date date;
alter table public.inquiries add column if not exists planned_undecided boolean not null default false;
alter table public.inquiries add column if not exists done_at timestamptz;
-- '상담 포기' 상태 허용 (예전에 만든 표의 상태 검사도 바꿈)
alter table public.inquiries drop constraint if exists inquiries_status_check;
alter table public.inquiries add constraint inquiries_status_check check (status in ('new', 'done', 'dropped'));
create index if not exists inquiries_created_idx on public.inquiries (created_at desc);
alter table public.inquiries enable row level security;

-- '상담 완료'·'상담 포기'로 바꾸면 그 시각을 done_at 에 적고(둘 사이를 오가면 처음 시각 유지), '새 상담'으로 되돌리면 지웁니다.
create or replace function public.inquiries_set_done_at()
returns trigger
language plpgsql
set search_path = public
as $$
begin
  if new.status in ('done', 'dropped') then
    if tg_op = 'INSERT' or old.status not in ('done', 'dropped') or old.done_at is null then new.done_at := now();
    else new.done_at := old.done_at; end if;
  else
    new.done_at := null;
  end if;
  return new;
end;
$$;
drop trigger if exists inquiries_done_at on public.inquiries;
create trigger inquiries_done_at
  before insert or update of status on public.inquiries
  for each row execute function public.inquiries_set_done_at();

-- 보관 기간이 지난 상담 신청 지우기 — Netlify 예약 함수(purge-inquiries)가 매일 부릅니다.
-- 상담 완료·상담 포기한 신청은 그날부터, 둘 다 누르지 않은 신청은 접수한 날부터 keep_days 일이 지나면 지웁니다.
-- 실수로 0 같은 값을 넣어도 최소 30일은 남깁니다.
create or replace function public.purge_old_inquiries(keep_days integer default 365)
returns integer
language sql
set search_path = public
as $$
  with gone as (
    delete from public.inquiries
    where coalesce(done_at, created_at) < now() - make_interval(days => greatest(coalesce(keep_days, 365), 30))
    returning 1
  )
  select count(*)::integer from gone;
$$;
revoke all on function public.purge_old_inquiries(integer) from public, anon, authenticated;
grant execute on function public.purge_old_inquiries(integer) to service_role;

drop policy if exists inquiries_read on public.inquiries;
create policy inquiries_read on public.inquiries
  for select to authenticated using (public.is_admin());

drop policy if exists inquiries_update on public.inquiries;
create policy inquiries_update on public.inquiries
  for update to authenticated using (public.is_admin()) with check (public.is_admin());

drop policy if exists inquiries_delete on public.inquiries;
create policy inquiries_delete on public.inquiries
  for delete to authenticated using (public.is_admin());


-- 5-A) 고객 (관리화면 '고객 관리') --------------------------------------
--    견적서·계약서·하자 기록을 연락처(전화번호)로 묶는 고객 명단. 관리자만 보고·고칩니다.
--    같은 전화번호로는 한 명만 만들어지고(숫자만 비교), 견적서·계약서를 저장할 때 자동으로 연결됩니다.
create table if not exists public.customers (
  id            uuid primary key default gen_random_uuid(),
  created_at    timestamptz not null default now(),
  updated_at    timestamptz not null default now(),
  name          text not null default '' check (char_length(name) <= 30),
  phone         text not null default '' check (char_length(phone) <= 20),
  phone_digits  text generated always as (regexp_replace(phone, '[^0-9]', '', 'g')) stored,
  address       text not null default '' check (char_length(address) <= 120),
  memo          text not null default '' check (char_length(memo) <= 2000)
);
create unique index if not exists customers_phone_uq on public.customers (phone_digits) where phone_digits <> '';
-- 블랙리스트: 관리자 화면에만 보이는 표시와 사유 (같은 연락처로 상담 신청·견적서·계약서가 오면 경고) — 2026-10-25 추가
alter table public.customers add column if not exists blacklist boolean not null default false;
alter table public.customers add column if not exists blacklist_note text not null default '' check (char_length(blacklist_note) <= 500);
alter table public.customers add column if not exists blacklist_at timestamptz;
create index if not exists customers_updated_idx on public.customers (updated_at desc);
alter table public.customers enable row level security;

drop policy if exists customers_admin on public.customers;
create policy customers_admin on public.customers
  for all to authenticated using (public.is_admin()) with check (public.is_admin());


-- 5-0) 견적서 ----------------------------------------------------------
--    관리화면 '견적서'에서 만든 견적서. 관리자만 보고·만들고·고치고·지울 수 있습니다.
--    목록에 보여 줄 값(고객 이름·공사명·합계)만 칸으로 두고, 나머지 내용은 doc(JSON)에 통째로 저장합니다.
create table if not exists public.estimates (
  id            uuid primary key default gen_random_uuid(),
  created_at    timestamptz not null default now(),
  updated_at    timestamptz not null default now(),
  inquiry_id    uuid references public.inquiries(id) on delete set null,   -- 상담 신청에서 만든 경우
  customer_id   uuid references public.customers(id) on delete set null,   -- 고객 관리 (전화번호로 자동 연결)
  customer_name text not null default '' check (char_length(customer_name) <= 30),
  title         text not null default '' check (char_length(title) <= 120),
  total         bigint not null default 0,
  doc           jsonb not null default '{}'::jsonb check (pg_column_size(doc) < 300000)
);
alter table public.estimates add column if not exists customer_id uuid references public.customers(id) on delete set null;
-- 견적 진행 상태: open(진행 중) · stopped(견적 중단 — 계약하지 않기로 함). '계약으로 이어짐'은 계약서(estimate_id)로 알아냄
alter table public.estimates add column if not exists status text not null default 'open' check (status in ('open', 'stopped'));
create index if not exists estimates_updated_idx on public.estimates (updated_at desc);
create index if not exists estimates_customer_idx on public.estimates (customer_id);
alter table public.estimates enable row level security;

drop policy if exists estimates_admin on public.estimates;
create policy estimates_admin on public.estimates
  for all to authenticated using (public.is_admin()) with check (public.is_admin());

-- 보관 기간이 지난 견적서 지우기 (마지막으로 고친 날부터 keep_days 일, 최소 30일). purge-inquiries 함수가 매일 부릅니다.
create or replace function public.purge_old_estimates(keep_days integer default 365)
returns integer
language sql
set search_path = public
as $$
  with gone as (
    delete from public.estimates
    where updated_at < now() - make_interval(days => greatest(coalesce(keep_days, 365), 30))
    returning 1
  )
  select count(*)::integer from gone;
$$;
revoke all on function public.purge_old_estimates(integer) from public, anon, authenticated;
grant execute on function public.purge_old_estimates(integer) to service_role;

-- 5-0-1) 3D 그림 (2026-10-28) -----------------------------------------------
--    관리화면 메뉴 '3D 그림'. 견적서를 골라 공사 내용(항목·자재)을 불러오고, 도면을 올려 AI로 3D 예시 그림을 만듭니다.
--    render_projects : 3D 그림 작업 하나 (견적서 하나에 하나). 견적서를 지워도 작업은 남고 연결만 비워짐.
--      doc = { size: 평수, items: [{ key, name, on, lines: [{ k, text, on, note }] }](견적서에서 불러온 공사 항목과 세부 줄 — on=그림에 넣기, note=색상·상세), custom: [직접 넣은 줄], style, memo, views }
--      est_synced_at = 마지막으로 견적서 내용을 불러올 때 그 견적서의 updated_at (견적서가 그 뒤에 고쳐졌으면 관리화면이 새 내용을 다시 불러옴)
--    render_images   : 그림 한 장 = 한 줄. input = 그 그림을 만든 공사 내용(평수·공사 줄·분위기·요청 사항) — 그림 만들기 함수는 이것만 읽음
--      status: queued(기다림) → running(만드는 중) → done(다 됨) / failed(못 만듦 — error 에 이유)
--    도면·그림 파일은 비공개 저장소 private-photos 의 renders/(작업 id)/… 에 있고, 관리화면은 1시간짜리 서명 주소로 보여 줍니다.
create table if not exists public.render_projects (
  id            uuid primary key default gen_random_uuid(),
  created_at    timestamptz not null default now(),
  updated_at    timestamptz not null default now(),
  estimate_id   uuid references public.estimates(id) on delete set null,
  title         text not null default '' check (char_length(title) <= 120),
  plan_path     text not null default '' check (char_length(plan_path) <= 300),
  est_synced_at timestamptz,
  doc           jsonb not null default '{}'::jsonb check (pg_column_size(doc) < 300000)
);
create index if not exists render_projects_updated_idx on public.render_projects (updated_at desc);
create index if not exists render_projects_estimate_idx on public.render_projects (estimate_id);
alter table public.render_projects enable row level security;
drop policy if exists render_projects_admin on public.render_projects;
create policy render_projects_admin on public.render_projects
  for all to authenticated using (public.is_admin()) with check (public.is_admin());

create table if not exists public.render_images (
  id          uuid primary key default gen_random_uuid(),
  created_at  timestamptz not null default now(),
  updated_at  timestamptz not null default now(),
  project_id  uuid not null references public.render_projects(id) on delete cascade,
  view        text not null default 'overview' check (char_length(view) <= 20),
  plan_path   text not null default '' check (char_length(plan_path) <= 300),
  input       jsonb not null default '{}'::jsonb check (pg_column_size(input) < 120000),
  status      text not null default 'queued' check (status in ('queued', 'running', 'done', 'failed')),
  image_path  text check (char_length(image_path) <= 300),
  caption     text not null default '' check (char_length(caption) <= 200),
  prompt      text not null default '' check (char_length(prompt) <= 4000),
  error       text not null default '' check (char_length(error) <= 300),
  model       text not null default '' check (char_length(model) <= 80)
);
create index if not exists render_images_project_idx on public.render_images (project_id, created_at desc);
create index if not exists render_images_created_idx on public.render_images (created_at desc);
alter table public.render_images enable row level security;
drop policy if exists render_images_admin on public.render_images;
create policy render_images_admin on public.render_images
  for all to authenticated using (public.is_admin()) with check (public.is_admin());

-- 보관 기간이 지난 3D 그림 작업 지우기 (마지막으로 고친 날부터 keep_days 일, 최소 30일 — 견적서와 같은 기간). purge-inquiries 함수가 매일 부릅니다.
--   그림 줄은 같이 지워지고, 도면·그림 파일은 purge-inquiries 가 '주인 없는 파일'로 정리합니다.
create or replace function public.purge_old_render_projects(keep_days integer default 365)
returns integer
language sql
set search_path = public
as $$
  with gone as (
    delete from public.render_projects
    where updated_at < now() - make_interval(days => greatest(coalesce(keep_days, 365), 30))
    returning 1
  )
  select count(*)::integer from gone;
$$;
revoke all on function public.purge_old_render_projects(integer) from public, anon, authenticated;
grant execute on function public.purge_old_render_projects(integer) to service_role;


-- 5-B) 계약서 ----------------------------------------------------------
--    관리화면 '계약서'에서 만든 공사 계약서. 관리자만 보고·만들고·고치고·지울 수 있습니다.
--    화면 서명(손님·업체)은 그림(PNG)으로 doc 안에 들어갑니다 — 공개 사진 저장소에는 올리지 않습니다.
--    견적서가 지워져도 계약서는 남도록, 계약할 때의 견적 내역을 doc 안에 복사해 둡니다.
create table if not exists public.contracts (
  id            uuid primary key default gen_random_uuid(),
  created_at    timestamptz not null default now(),
  updated_at    timestamptz not null default now(),
  customer_id   uuid references public.customers(id) on delete set null,
  estimate_id   uuid references public.estimates(id) on delete set null,
  customer_name text not null default '' check (char_length(customer_name) <= 30),
  title         text not null default '' check (char_length(title) <= 120),
  total         bigint not null default 0,
  start_date    date,                                 -- 착공일 (일정 달력에 공사 기간으로 표시)
  end_date      date,                                 -- 준공(완료) 예정일
  status        text not null default 'draft' check (status in ('draft', 'signed', 'done', 'canceled', 'terminated')),
  doc           jsonb not null default '{}'::jsonb check (pg_column_size(doc) < 800000),
  check (end_date is null or start_date is null or end_date >= start_date)
);
create index if not exists contracts_updated_idx on public.contracts (updated_at desc);
-- 이미 만든 표에도 '계약 중단(canceled)' 상태 허용 (예전 SQL을 실행했던 경우)
alter table public.contracts drop constraint if exists contracts_status_check;
-- terminated = 계약 파기 (계약 완료 뒤 해제. 위약금 기록은 doc.termination)
alter table public.contracts add constraint contracts_status_check check (status in ('draft', 'signed', 'done', 'canceled', 'terminated'));
create index if not exists contracts_customer_idx on public.contracts (customer_id);
alter table public.contracts enable row level security;

drop policy if exists contracts_admin on public.contracts;
create policy contracts_admin on public.contracts
  for all to authenticated using (public.is_admin()) with check (public.is_admin());


-- 5-C) 하자 접수·보수 ----------------------------------------------------
--    접수(new) → 현장 확인(check) → 보수 일정(repair) → 완료(done). 날짜는 일정 달력에 자동으로 표시됩니다.
create table if not exists public.defects (
  id            uuid primary key default gen_random_uuid(),
  created_at    timestamptz not null default now(),
  updated_at    timestamptz not null default now(),
  customer_id   uuid not null references public.customers(id) on delete cascade,
  contract_id   uuid references public.contracts(id) on delete set null,
  received_on   date not null default current_date,  -- 접수일
  title         text not null check (char_length(title) between 1 and 120),
  body          text not null default '' check (char_length(body) <= 3000),
  status        text not null default 'new' check (status in ('new', 'check', 'repair', 'done')),
  check_on      date,                                 -- 현장 확인 날짜
  check_time    text not null default '' check (char_length(check_time) <= 20),
  check_note    text not null default '' check (char_length(check_note) <= 3000),
  repair_on     date,                                 -- 하자 보수 시작일
  repair_end    date,                                 -- 하자 보수 끝나는 날 (하루면 비움)
  repair_time   text not null default '' check (char_length(repair_time) <= 20),
  repair_note   text not null default '' check (char_length(repair_note) <= 3000),
  done_on       date,                                 -- 보수 완료일
  photos        jsonb not null default '[]'::jsonb    -- 하자 사진 [{full, thumb, w, h}] — 비공개 저장소(private-photos)의 경로
);
alter table public.defects add column if not exists photos jsonb not null default '[]'::jsonb;
alter table public.defects add column if not exists repair_end date;   -- 하자 보수 기간: 시작일(repair_on) ~ 끝나는 날 (2026-10-26 추가)
create index if not exists defects_customer_idx on public.defects (customer_id);
alter table public.defects enable row level security;

drop policy if exists defects_admin on public.defects;
create policy defects_admin on public.defects
  for all to authenticated using (public.is_admin()) with check (public.is_admin());


-- 5-D) 일정 (관리화면 '일정 달력'에서 직접 적는 일정) ----------------------
--    계약서의 공사 기간, 하자 현장 확인·보수 날짜, 상담 희망일은 따로 적지 않아도 달력에 자동으로 나옵니다.
create table if not exists public.schedules (
  id            uuid primary key default gen_random_uuid(),
  created_at    timestamptz not null default now(),
  updated_at    timestamptz not null default now(),
  start_on      date not null,
  end_on        date,
  time          text not null default '' check (char_length(time) <= 20),
  title         text not null check (char_length(title) between 1 and 120),
  kind          text not null default 'etc' check (kind in ('visit', 'work', 'meet', 'defect', 'etc')),
  place         text not null default '' check (char_length(place) <= 120),
  memo          text not null default '' check (char_length(memo) <= 1000),
  customer_id   uuid references public.customers(id) on delete set null,
  check (end_on is null or end_on >= start_on)
);
create index if not exists schedules_start_idx on public.schedules (start_on);
-- 직접 적는 일정 종류에 '하자' 추가 (2026-10-26) — 이미 만든 표도 바꿔 줌
alter table public.schedules drop constraint if exists schedules_kind_check;
alter table public.schedules add constraint schedules_kind_check check (kind in ('visit', 'work', 'meet', 'defect', 'etc'));
alter table public.schedules enable row level security;

drop policy if exists schedules_admin on public.schedules;
create policy schedules_admin on public.schedules
  for all to authenticated using (public.is_admin()) with check (public.is_admin());


-- 5-T) 휴지통 -------------------------------------------------------------
--    관리화면에서 지운 시공사례·후기·상담 신청·견적서·계약서·고객·하자 기록·일정·계약서 첨부 파일을 30일 동안 보관합니다.
--    data = { row: 지운 줄, extra: 되살릴 때 다시 이어 줄 연결 } (첨부 파일은 { file }), files = 저장소에 남겨 둔 사진·파일 [{ bucket, path }]
--    30일이 지나면 관리화면(열 때)과 purge-inquiries 함수(매일)가 줄과 사진·파일을 완전히 지웁니다.
--    '보관 기간 지난 자료' 화면에서 지우는 것은 휴지통을 거치지 않습니다(개인정보 보호법 제21조 — 지체 없이 파기).
create table if not exists public.trash (
  id          uuid primary key default gen_random_uuid(),
  kind        text not null check (kind in ('works', 'reviews', 'inquiries', 'estimates', 'contracts', 'customers', 'defects', 'schedules', 'files', 'render_projects')),
  item_id     uuid not null,
  title       text not null default '' check (char_length(title) <= 200),
  data        jsonb not null check (pg_column_size(data) < 4000000),
  files       jsonb not null default '[]'::jsonb,
  deleted_at  timestamptz not null default now()
);
create index if not exists trash_deleted_idx on public.trash (deleted_at desc);
-- 이미 휴지통 표가 있던 경우에도 '3D 그림'(render_projects)을 넣을 수 있게 종류 제한을 다시 걸기 (2026-10-28)
alter table public.trash drop constraint if exists trash_kind_check;
alter table public.trash add constraint trash_kind_check
  check (kind in ('works', 'reviews', 'inquiries', 'estimates', 'contracts', 'customers', 'defects', 'schedules', 'files', 'render_projects'));
alter table public.trash enable row level security;

drop policy if exists trash_admin on public.trash;
create policy trash_admin on public.trash
  for all to authenticated using (public.is_admin()) with check (public.is_admin());

-- 휴지통에서 상담 신청을 되살릴 때 관리자가 다시 넣을 수 있게 (방문자는 여전히 넣을 수 없음 — 접수는 Netlify 함수만)
drop policy if exists inquiries_admin_insert on public.inquiries;
create policy inquiries_admin_insert on public.inquiries
  for insert to authenticated with check (public.is_admin());


-- 5-E) 보관 기간이 지난 계약서·하자 기록·일정·고객 지우기 ------------------
--    purge-inquiries 함수가 매일 부릅니다. keep_days 는 Netlify 환경변수로 바꿀 수 있습니다 (README 4-4).
--    ★ 계약서·하자 기록: 공사 완료일(없으면 마지막으로 고친 날)부터 keep_days 일 (기본 2190일 = 6년).
--      세무 장부·증빙은 국세기본법 제85조의3에 따라 법정신고기한이 지난 날부터 5년 보존해야 해서,
--      공사가 끝난 해의 신고기한까지 넉넉히 더해 6년으로 두었습니다. 세무사와 확인해 바꿔 주세요.
create or replace function public.purge_old_contracts(keep_days integer default 2190)
returns integer
language sql
set search_path = public
as $$
  with gone as (
    delete from public.contracts
    where (coalesce(end_date, updated_at::date) < current_date - greatest(coalesce(keep_days, 2190), 365)
           and updated_at < now() - make_interval(days => greatest(coalesce(keep_days, 2190), 365)))
       or (status = 'canceled' and updated_at < now() - interval '365 days')
    returning 1
  )
  select count(*)::integer from gone;
$$;
create or replace function public.purge_old_defects(keep_days integer default 2190)
returns integer
language sql
set search_path = public
as $$
  with gone as (
    delete from public.defects
    where coalesce(done_on, repair_end, repair_on, check_on, received_on) < current_date - greatest(coalesce(keep_days, 2190), 365)
      and updated_at < now() - make_interval(days => greatest(coalesce(keep_days, 2190), 365))
    returning 1
  )
  select count(*)::integer from gone;
$$;
-- 직접 적은 일정: 끝난 날부터 keep_days 일 (기본 730일 = 2년)
create or replace function public.purge_old_schedules(keep_days integer default 730)
returns integer
language sql
set search_path = public
as $$
  with gone as (
    delete from public.schedules
    where coalesce(end_on, start_on) < current_date - greatest(coalesce(keep_days, 730), 30)
    returning 1
  )
  select count(*)::integer from gone;
$$;
-- 고객: 견적서·계약서·하자 기록·일정이 하나도 남지 않았고, keep_days 일 동안 고친 적 없으면 지움 (기본 365일)
create or replace function public.purge_old_customers(keep_days integer default 365)
returns integer
language sql
set search_path = public
as $$
  with gone as (
    delete from public.customers c
    where c.updated_at < now() - make_interval(days => greatest(coalesce(keep_days, 365), 30))
      and not exists (select 1 from public.estimates e where e.customer_id = c.id)
      and not exists (select 1 from public.contracts k where k.customer_id = c.id)
      and not exists (select 1 from public.defects d where d.customer_id = c.id)
      and not exists (select 1 from public.schedules s where s.customer_id = c.id)
    returning 1
  )
  select count(*)::integer from gone;
$$;
revoke all on function public.purge_old_contracts(integer), public.purge_old_defects(integer),
  public.purge_old_schedules(integer), public.purge_old_customers(integer) from public, anon, authenticated;
grant execute on function public.purge_old_contracts(integer), public.purge_old_defects(integer),
  public.purge_old_schedules(integer), public.purge_old_customers(integer) to service_role;


-- 5-0-1) 관리자 전용 설정 ------------------------------------------------
--    견적서 공사 항목·단가·평수별 수량 프리셋 등. 단가가 들어 있으므로 방문자는 읽을 수 없고 관리자만 보고 고칩니다.
--    (홈페이지 설정 site_settings 는 누구나 읽을 수 있으니 여기와 섞지 마세요)
create table if not exists public.admin_settings (
  key         text primary key,
  value       jsonb not null check (pg_column_size(value) < 500000),
  updated_at  timestamptz not null default now()
);
alter table public.admin_settings enable row level security;

drop policy if exists admin_settings_admin on public.admin_settings;
create policy admin_settings_admin on public.admin_settings
  for all to authenticated using (public.is_admin()) with check (public.is_admin());


-- 5-1) 홈페이지 설정 ----------------------------------------------------
--    관리화면 '상담 신청' 칸의 스위치(상담 신청 버튼 보이기) 등. 누구나 읽고, 관리자만 바꿀 수 있습니다.
create table if not exists public.site_settings (
  key         text primary key,
  value       jsonb not null,
  updated_at  timestamptz not null default now()
);
alter table public.site_settings enable row level security;

drop policy if exists settings_read on public.site_settings;
create policy settings_read on public.site_settings
  for select to anon, authenticated using (true);

drop policy if exists settings_insert on public.site_settings;
create policy settings_insert on public.site_settings
  for insert to authenticated with check (public.is_admin());

drop policy if exists settings_update on public.site_settings;
create policy settings_update on public.site_settings
  for update to authenticated using (public.is_admin()) with check (public.is_admin());

insert into public.site_settings (key, value) values ('inquiry_enabled', 'true'::jsonb)
on conflict (key) do nothing;


-- 5-2) 표마다 접근 권한 (GRANT) ------------------------------------------
--    위의 정책(RLS)은 "어느 줄을" 볼 수 있는지, 여기 권한은 "어느 표에 무엇을" 할 수 있는지 정합니다.
--    두 겹으로 막아 두면 정책 하나를 실수로 꺼도 상담 신청은 밖에서 읽을 수 없습니다.
--    · Supabase는 2026-10-30부터 새 표에 권한을 자동으로 주지 않으므로, 이 부분이 없으면 홈페이지가 비어 보입니다.
--    · anon(방문자)      : 시공사례·후기·설정 읽기만. 상담 신청과 관리자 명단에는 아무 권한 없음.
--    · authenticated     : 로그인한 사람. 실제로 무엇을 할 수 있는지는 위 정책(is_admin)이 다시 거릅니다.
--                          상담 신청은 읽기·지우기와 '상담 완료' 표시(status)만 고칠 수 있습니다.
--                          견적서·계약서·고객·하자·일정·관리자 설정은 방문자(anon)에게 아무 권한이 없습니다.
--    · service_role      : Netlify 함수(접수·자동 삭제)만 쓰는 비밀 키.
revoke all on table public.admins from anon, authenticated;

revoke all on table public.works, public.reviews, public.site_settings from anon, authenticated;
grant select on table public.works, public.reviews, public.site_settings to anon, authenticated;
grant insert, update, delete on table public.works, public.reviews to authenticated;
grant insert, update on table public.site_settings to authenticated;

revoke all on table public.inquiries from anon, authenticated;
grant select, insert, delete on table public.inquiries to authenticated;   -- insert: 휴지통에서 되살리기 (관리자만 — 정책 inquiries_admin_insert)
grant update (status, preferred_date, preferred_time) on table public.inquiries to authenticated;   -- 상담 희망 날짜·시간: 관리화면 일정 달력에서 고치기 (2026-10-26)

revoke all on table public.trash from anon, authenticated;
grant select, insert, delete on table public.trash to authenticated;
grant select, insert, delete on table public.trash to service_role;

revoke all on table public.estimates, public.admin_settings, public.customers, public.contracts, public.defects, public.schedules from anon, authenticated;
grant select, insert, update, delete on table public.estimates, public.admin_settings, public.customers, public.contracts, public.defects, public.schedules to authenticated;

grant select, insert, update, delete on table
  public.works, public.reviews, public.site_settings, public.inquiries, public.estimates, public.admin_settings,
  public.customers, public.contracts, public.defects, public.schedules to service_role;

-- 3D 그림: 관리자만(정책 render_projects_admin·render_images_admin). 그림 만들기 함수(render)는 service_role 로 상태·그림 경로를 적음
revoke all on table public.render_projects, public.render_images from anon, authenticated;
grant select, insert, update, delete on table public.render_projects, public.render_images to authenticated;
grant select, insert, update, delete on table public.render_projects, public.render_images to service_role;


-- 6) 관리자 등록 --------------------------------------------------------
--    이 명단의 이메일로 로그인한 사람만 상담 신청을 보고 글·사진을 올릴 수 있습니다.
--    로그인 계정(이메일·비밀번호)은 Authentication > Users > Add user 에서 따로 만듭니다 (README 2단계).
--    관리자를 빼려면: delete from public.admins where email = '뺄 주소';
insert into public.admins (email) values
  ('cwism@naver.com'),
  ('smhland@naver.com'),
  ('leontine@naver.com')
on conflict do nothing;

-- =====================================================================
-- 저장 공간 확인 (관리화면 설정 → 저장 공간) — 2026-10-25 추가
-- 데이터베이스 크기(Supabase가 무료 500MB 한도를 셀 때 쓰는 것과 같은 방법: 모든 데이터베이스 크기 합),
-- 표별 크기, 파일 저장소(버킷별) 크기·개수. 관리자만 부를 수 있음.
-- 한 달 전송량(egress)·월간 사용자 수는 SQL로 알 수 없어 Supabase 화면(Organization → Usage)에서 확인.
-- =====================================================================
create or replace function public.admin_usage()
returns json
language plpgsql
stable
security definer
set search_path = public
as $$
begin
  if not public.is_admin() then
    raise exception 'not allowed';
  end if;
  return json_build_object(
    'db_bytes', (select sum(pg_database_size(d.datname))::bigint from pg_database d),
    'tables', coalesce((
      select json_agg(json_build_object('name', c.relname, 'bytes', pg_total_relation_size(c.oid)) order by pg_total_relation_size(c.oid) desc)
      from pg_class c join pg_namespace n on n.oid = c.relnamespace
      where n.nspname = 'public' and c.relkind = 'r'), '[]'::json),
    'buckets', coalesce((
      select json_agg(json_build_object('bucket', b.bucket_id, 'bytes', b.bytes, 'files', b.files) order by b.bytes desc)
      from (select o.bucket_id, sum(coalesce((o.metadata ->> 'size')::bigint, 0))::bigint as bytes, count(*) as files
            from storage.objects o group by o.bucket_id) b), '[]'::json),
    'at', now()
  );
end;
$$;
revoke all on function public.admin_usage() from public;
grant execute on function public.admin_usage() to authenticated;
