# 유료 심화 분석 — QStash background job 아키텍처

브라우저가 긴 Claude 요청을 직접 기다리지 않도록, 생성을 **QStash → runner** background job으로 분리했다. 프론트는 job을 만들고 **폴링만** 한다. 기존 프롬프트/결과 schema/normalize/repair/quality 로직은 그대로 재사용한다(변경 없음).

## 흐름

```
Frontend  POST /api/paid-job         → Supabase job(status=queued) 생성
          (서버) QStash publishJSON  → { url: /api/paid-analysis-runner, body:{jobId}, dedup, retries:2 }
          ← jobId 즉시 반환
Frontend  GET /api/paid-job?id=...   → 폴링(2.5s→5s→10s). result_json 생기면 렌더.

QStash    POST /api/paid-analysis-runner (Upstash-Signature)
          → 서명검증(raw body) → claim_paid_analysis_job(RPC, atomic lease)
          → generatePaidResult(기존 로직) → save_paid_analysis_result(RPC, lease guard)
          → status=ready, 200 반환
```

## 동시성/멱등 (RPC, `db/paid_analysis_jobs_qstash.sql`)

- `claim_paid_analysis_job(id, lease_id, lease_seconds)` — `result_json IS NULL` 이고 `status='queued'`(또는 lease 만료된 stale `processing`)일 때만 `status='processing'`+lease 세팅+attempt_count+1. `UPDATE ... RETURNING`으로 원자적. 반환행 없으면 runner는 Claude 호출 금지.
- `save_paid_analysis_result(...)` — `id` + `lease_id` 일치 + `result_json IS NULL`일 때만 저장. 다른 runner가 이미 저장했으면 no-op.
- `release_paid_analysis_lease(...)` — 재시도 가능한 오류: `status='queued'`로 되돌리고 lease 해제(→ 다음 QStash delivery가 재claim). `result_json` 있으면 절대 되돌리지 않음.
- `fail_paid_analysis_job(...)` — terminal/재시도 소진: `result_json IS NULL`일 때만 `status='failed'` 기록.

**절대 원칙:** 모든 저장/실패 RPC는 `result_json IS NULL` 가드가 있어 **result가 있으면 failed로 덮거나 재실행하지 않는다**.

## 오류 처리

- retryable(`claude_abort_timeout`/`claude_network_error`/`claude_http_error`) & `attempt_count < 3` → lease 해제(queued) + **HTTP 503** 반환 → QStash가 재delivery → 재claim해 실행(단순 500 no-op 아님).
- terminal(quality/schema/payload) 또는 attempts 소진 → `fail_paid_analysis_job` + **HTTP 200**(QStash retry 중단).
- 프론트 폴링 오류(timeout/network/304)는 **서버 job 실패가 아님** → 계속 폴링. 프론트는 DB status를 바꾸지 않는다.

## 타임아웃 상수 (runner 상단)

- `maxDuration = 300`(Hobby 상한). Pro 전환 시 이 값 + `vercel.json`을 600~800으로.
- `LEASE_SECONDS = 360`(runner보다 길게 → 실행 중 stale 오판 방지, 초과 시 reclaim).
- Claude 내부 timeout(callClaude: main 150s + repair 55s)은 runner 300s보다 짧아 DB 기록 여유 확보.
- `MAX_ATTEMPTS = 3`(QStash retries=2와 정합).

## 구조화 로그 이벤트

`paid_job_created`, `qstash_publish_started/succeeded/failed`, `runner_started`, `runner_signature_verified`, `runner_claim_succeeded/skipped`, `claude_request_started/completed`, `result_save_succeeded`, `runner_completed`, `runner_failed`. 공통 필드: `event, ts, jobId, attemptCount, durationMs, claudeDurationMs, retryable, errorType`. **금지**: 토큰/서명키/API키/service role/사용자 응답 전문/Claude 전체 출력.

DB 계측: `claude_duration_ms`, `runner_duration_ms`, `attempt_count`, `enqueued_at`, `processing_started_at`, `claude_started_at/completed_at`, `completed_at`, `failed_at`, `usage_json`, `model`.

## 셋업 (배포 전 필수)

1. **DB migration**: `db/paid_analysis_jobs_qstash.sql`을 Supabase SQL Editor에서 1회 실행(컬럼 + RPC, idempotent).
2. **Vercel 환경변수** (`.env.example` 참고): `QSTASH_TOKEN`, `QSTASH_CURRENT_SIGNING_KEY`, `QSTASH_NEXT_SIGNING_KEY`, `PUBLIC_APP_URL`(= production 도메인), 기존 `SUPABASE_URL`/`SUPABASE_SERVICE_ROLE_KEY`/`ANTHROPIC_API_KEY`. Production + Preview 모두.
3. **Upstash**: QStash 활성화 → Token + Signing keys 복사. QStash가 도달할 public URL은 `PUBLIC_APP_URL/api/paid-analysis-runner`.

## 미검증(배포 후 확인)

- runner의 `./paid-analysis.ts` sibling import가 Vercel 번들에 포함되는지(과거 `../src` import에서 ERR_MODULE_NOT_FOUND 이력). runner 첫 delivery 로그로 확인.
- QStash 서명검증(raw body 스트림 읽기)이 Vercel Node 함수에서 정상 동작.
- 실제 lease 경합/재시도 흐름은 배포 환경에서만 완전 검증 가능.
