-- Career Compass — QStash background-job 전환용 migration.
-- Supabase SQL Editor에 붙여넣고 1회 실행. 전부 idempotent(if not exists / create or replace).
-- 기존 데이터/ status 를 일괄 변경하지 않는다. id 타입은 uuid(기존과 동일).

-- ── 1) 컬럼 추가(기존 것과 중복 없이) ──────────────────────────────────────────
alter table public.paid_analysis_jobs add column if not exists enqueued_at            timestamptz;
alter table public.paid_analysis_jobs add column if not exists processing_started_at  timestamptz;
alter table public.paid_analysis_jobs add column if not exists claude_started_at      timestamptz;
alter table public.paid_analysis_jobs add column if not exists claude_completed_at    timestamptz;
alter table public.paid_analysis_jobs add column if not exists failed_at              timestamptz;
alter table public.paid_analysis_jobs add column if not exists attempt_count          integer not null default 0;
alter table public.paid_analysis_jobs add column if not exists lease_id               uuid;
alter table public.paid_analysis_jobs add column if not exists lease_expires_at       timestamptz;
alter table public.paid_analysis_jobs add column if not exists qstash_message_id      text;
alter table public.paid_analysis_jobs add column if not exists claude_duration_ms     bigint;
alter table public.paid_analysis_jobs add column if not exists runner_duration_ms     bigint;
alter table public.paid_analysis_jobs add column if not exists last_error_code        text;
alter table public.paid_analysis_jobs add column if not exists last_error_message     text;
alter table public.paid_analysis_jobs add column if not exists last_error_retryable   boolean;
-- 제출 단위 idempotency 키(프론트가 제출 1회당 1개 생성). 같은 키 재요청 시 새 row 생성 금지.
alter table public.paid_analysis_jobs add column if not exists client_request_id      uuid;
-- completed_at / model / usage_json / result_json / error_json 은 이미 존재 → 재사용.

create index if not exists paid_analysis_jobs_lease_idx on public.paid_analysis_jobs (lease_expires_at);
-- client_request_id 유니크(부분 인덱스: NULL 다중 허용 — 구버전 클라이언트 호환).
create unique index if not exists paid_analysis_jobs_client_request_uidx
  on public.paid_analysis_jobs (client_request_id)
  where client_request_id is not null;

-- ── 2) atomic lease claim ───────────────────────────────────────────────────
-- queued 이거나, processing인데 lease 만료된(stale) job만 claim. result_json 있으면 claim 불가.
-- UPDATE ... RETURNING 으로 원자적. 반환행이 없으면 호출부는 Claude 호출 금지.
create or replace function public.claim_paid_analysis_job(
  p_job_id uuid,
  p_lease_id uuid,
  p_lease_seconds integer
) returns setof public.paid_analysis_jobs
language sql
security definer
set search_path = public, pg_temp
as $$
  update public.paid_analysis_jobs j
  set status = 'processing',
      lease_id = p_lease_id,
      lease_expires_at = now() + make_interval(secs => p_lease_seconds),
      processing_started_at = coalesce(j.processing_started_at, now()),
      attempt_count = coalesce(j.attempt_count, 0) + 1,
      updated_at = now()
  where j.id = p_job_id
    and j.result_json is null
    and (
      j.status = 'queued'
      or (j.status = 'processing' and (j.lease_expires_at is null or j.lease_expires_at < now()))
    )
  returning j.*;
$$;

-- ── 3) 결과 저장(현재 lease owner + result 미존재일 때만) ──────────────────────
create or replace function public.save_paid_analysis_result(
  p_job_id uuid,
  p_lease_id uuid,
  p_result jsonb,
  p_usage jsonb,
  p_model text,
  p_evidence jsonb,
  p_claude_ms bigint,
  p_runner_ms bigint
) returns setof public.paid_analysis_jobs
language sql
security definer
set search_path = public, pg_temp
as $$
  update public.paid_analysis_jobs j
  set result_json = p_result,
      status = 'ready',
      usage_json = coalesce(p_usage, j.usage_json),
      model = coalesce(p_model, j.model),
      evidence_pack = coalesce(p_evidence, j.evidence_pack),
      claude_duration_ms = p_claude_ms,
      runner_duration_ms = p_runner_ms,
      claude_completed_at = now(),
      completed_at = now(),
      error_json = null,
      last_error_code = null,
      last_error_message = null,
      last_error_retryable = null,
      lease_id = null,
      lease_expires_at = null,
      updated_at = now()
  where j.id = p_job_id
    and j.lease_id = p_lease_id
    and j.result_json is null
  returning j.*;
$$;

-- ── 4) 재시도용 lease 해제(status → queued). result 있으면 절대 되돌리지 않음 ──
create or replace function public.release_paid_analysis_lease(
  p_job_id uuid,
  p_lease_id uuid,
  p_error_code text,
  p_error_message text
) returns setof public.paid_analysis_jobs
language sql
security definer
set search_path = public, pg_temp
as $$
  update public.paid_analysis_jobs j
  set status = 'queued',
      lease_id = null,
      lease_expires_at = null,
      last_error_code = p_error_code,
      last_error_message = p_error_message,
      last_error_retryable = true,
      updated_at = now()
  where j.id = p_job_id
    and j.lease_id = p_lease_id
    and j.status = 'processing'   -- 현재 이 runner가 처리 중일 때만 release
    and j.result_json is null     -- result 저장됐으면 절대 queued로 되돌리지 않음
  returning j.*;
$$;

-- ── 5) 최종 실패(terminal). result 있으면 절대 failed로 덮지 않음 ──────────────
create or replace function public.fail_paid_analysis_job(
  p_job_id uuid,
  p_lease_id uuid,
  p_error jsonb,
  p_error_code text,
  p_error_message text
) returns setof public.paid_analysis_jobs
language sql
security definer
set search_path = public, pg_temp
as $$
  update public.paid_analysis_jobs j
  set status = 'failed',
      error_json = p_error,
      latest_error_json = p_error,
      failed_at = now(),
      last_error_code = p_error_code,
      last_error_message = p_error_message,
      last_error_retryable = false,
      lease_id = null,
      lease_expires_at = null,
      updated_at = now()
  where j.id = p_job_id
    and j.lease_id = p_lease_id
    and j.result_json is null
  returning j.*;
$$;

-- ── 6) RPC 실행 권한 잠금 ────────────────────────────────────────────────────
-- 서버 runner(service_role)만 호출 가능. PUBLIC/anon/authenticated는 EXECUTE 불가.
-- SECURITY DEFINER + search_path 고정으로 하이재킹 방지. 시그니처는 위 정의와 정확히 일치.
revoke execute on function public.claim_paid_analysis_job(uuid, uuid, integer)                                   from public, anon, authenticated;
revoke execute on function public.save_paid_analysis_result(uuid, uuid, jsonb, jsonb, text, jsonb, bigint, bigint) from public, anon, authenticated;
revoke execute on function public.release_paid_analysis_lease(uuid, uuid, text, text)                            from public, anon, authenticated;
revoke execute on function public.fail_paid_analysis_job(uuid, uuid, jsonb, text, text)                          from public, anon, authenticated;

grant execute on function public.claim_paid_analysis_job(uuid, uuid, integer)                                   to service_role;
grant execute on function public.save_paid_analysis_result(uuid, uuid, jsonb, jsonb, text, jsonb, bigint, bigint) to service_role;
grant execute on function public.release_paid_analysis_lease(uuid, uuid, text, text)                            to service_role;
grant execute on function public.fail_paid_analysis_job(uuid, uuid, jsonb, text, text)                          to service_role;

notify pgrst, 'reload schema';
