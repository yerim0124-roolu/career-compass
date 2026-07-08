-- Career Compass — 유료 심화 분석 "영속 job" 테이블.
-- Supabase SQL Editor에 붙여넣고 실행하세요. (1회)
--
-- 목적: 유료 분석을 요청-생명주기 안에서 동기 생성하지 않고, 성공한 result_json만
--       저장 후 렌더한다. Claude 실패/timeout/schema/quality 실패는 job failed로 남는다.

create table if not exists public.paid_analysis_jobs (
  id                uuid primary key default gen_random_uuid(),
  user_session_id   text,
  test_result_id    text,
  status            text not null default 'queued'
                      check (status in ('queued','processing','ready','failed')),
  input_json        jsonb not null,
  evidence_pack     jsonb,
  result_json       jsonb,
  error_json        jsonb,
  latest_error_json jsonb,
  retry_count       integer not null default 0,
  payment_status    text not null default 'unpaid'
                      check (payment_status in ('unpaid','paid')),
  unlocked_at       timestamptz,
  model             text,
  usage_json        jsonb default '{}'::jsonb,
  created_at        timestamptz not null default now(),
  updated_at        timestamptz not null default now(),
  completed_at      timestamptz
);

-- 기존 테이블에도 적용 가능한 migration(이미 만든 경우 이 블록만 실행).
alter table public.paid_analysis_jobs add column if not exists usage_json jsonb default '{}'::jsonb;
alter table public.paid_analysis_jobs add column if not exists model text;
-- PostgREST 스키마 캐시 갱신.
notify pgrst, 'reload schema';

create index if not exists paid_analysis_jobs_session_idx  on public.paid_analysis_jobs (user_session_id);
create index if not exists paid_analysis_jobs_status_idx   on public.paid_analysis_jobs (status);
create index if not exists paid_analysis_jobs_created_idx  on public.paid_analysis_jobs (created_at desc);

-- RLS: 서버 함수는 service_role 키로 접근하므로 RLS를 우회한다. public(anon)에는
-- 정책을 열지 않는다 → 브라우저가 job 테이블을 직접 읽지 못하고, 오직 API 경유로만
-- 저장된 result_json에 접근한다(권장 구성).
alter table public.paid_analysis_jobs enable row level security;

-- (선택) 만약 service_role 키 대신 anon 키로만 서버를 운영해야 한다면, 아래 정책을
-- 열어야 API가 동작한다. 보안상 권장하지 않는다(가능하면 service_role 사용).
-- create policy paid_jobs_anon_insert on public.paid_analysis_jobs for insert to anon with check (true);
-- create policy paid_jobs_anon_select on public.paid_analysis_jobs for select to anon using (true);
-- create policy paid_jobs_anon_update on public.paid_analysis_jobs for update to anon using (true) with check (true);
