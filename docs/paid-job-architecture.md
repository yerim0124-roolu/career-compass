# 유료 심화 분석 — 영속 job 아키텍처

동기 생성(요청 안에서 Claude 생성→렌더)을 폐기하고, **성공한 result_json만 저장 후 렌더**하는 구조로 전환했다. 브라우저는 Claude 실시간 생성에 의존하지 않고, Supabase에 저장된 `result_json`만 렌더한다.

## 흐름

1. `POST /api/paid-job` — job 생성(`status=queued`). body `{ freeContext, paidAnswers, userSessionId?, testResultId? }` → `{ jobId }`. 결과 생성을 기다리지 않는다.
2. `POST /api/paid-analysis` (body `{ jobId }`) — **run worker**. job을 읽어 Claude 생성 → normalize → quality gate 수행 후 성공이면 `result_json` 저장 + `status=ready`, 실패면 `error_json` 저장 + `status=failed`. 프론트는 이 응답 본문을 렌더에 쓰지 않는다(fire-and-forget).
3. `GET /api/paid-job?id=<jobId>` — polling. `ready`면 `result_json`, `failed`면 `error_json` 반환. 프론트는 3초 간격으로 폴링하며 저장된 status만 신뢰한다.
4. `POST /api/paid-job-retry` (body `{ jobId }`) — `failed → queued`, `retry_count` 증가, 직전 error는 `latest_error_json`에 보존. 이후 프론트가 run을 다시 호출한다.

`api/paid-job-run.ts`는 run worker를 `/api/paid-analysis`로 옮긴 뒤 남은 **deprecated 스텁**(410)이다.

## 셋업 (배포 전 필수)

### 1. 테이블 생성
`db/paid_analysis_jobs.sql`을 Supabase SQL Editor에서 1회 실행.

### 2. Vercel 환경변수
서버 함수가 Supabase에 쓰기 위해 다음이 필요하다(client 번들에는 노출되지 않음):

- `SUPABASE_URL` — Supabase 프로젝트 URL (없으면 `VITE_SUPABASE_URL`로 폴백).
- `SUPABASE_SERVICE_ROLE_KEY` — **권장**. RLS를 우회해 job을 안전하게 읽고 쓴다. Supabase → Project Settings → API → `service_role` secret.
  - service_role 키가 없으면 `SUPABASE_ANON_KEY`/`VITE_SUPABASE_ANON_KEY`로 폴백하지만, 이 경우 `db/paid_analysis_jobs.sql` 하단의 anon 정책을 열어야 하며 보안상 권장하지 않는다.
- `ANTHROPIC_API_KEY` — 기존과 동일(변경 없음).
- `ADMIN_RETRY_SECRET` — (선택) 운영자 수동 재시도용. `POST /api/paid-job-retry`는 `x-admin-retry-secret` 헤더가 이 값과 일치할 때만 동작하고, 없거나 틀리면 403. 미설정 시 재시도 엔드포인트는 항상 403(고객은 호출 불가).

> service_role 키/ADMIN_RETRY_SECRET은 절대 `VITE_` 접두사를 붙이지 말 것(붙이면 client 번들에 포함됨). 서버 전용 이름으로 둔다.

## 원가 추적(usage)

Claude 호출마다 `model` + `usage`(input/output tokens)를 수집해 job에 저장한다. Sonnet 4.6 단가($3/1M in, $15/1M out)로 `estimated_cost_usd`를 추정하되, `usage_json`에는 원본 usage(cache 토큰 포함)를 그대로 보존한다. quality gate로 repair된 경우에도 비용은 발생했으므로 저장하며, main 성공 후 실패한 경우에도 usage를 남긴다.

`usage_json` 구조: `{ main: {input_tokens, output_tokens, estimated_cost_usd, raw}, repair?: {...}, total: {...} }`.

최근 job 원가 조회 예시:

```sql
select id, status, model,
       (usage_json->'total'->>'estimated_cost_usd')::numeric as cost_usd,
       (usage_json->'total'->>'input_tokens')::int as in_tok,
       (usage_json->'total'->>'output_tokens')::int as out_tok,
       created_at
from public.paid_analysis_jobs
order by created_at desc
limit 50;
```

## 견고성(request-bound worker 보완)

Vercel run worker는 요청 생명주기에 묶여 있어 함수가 죽으면 `processing`에 고착될 수 있다. 이를 다음으로 방어한다:

- **stale timeout**: `GET /api/paid-job` 폴링 시 `processing`이 10분(`STALE_PROCESSING_MS`)을 넘으면 `failed`(`errorType: worker_stale_timeout`)로 reap한다. 이후 retry로 회복 가능.
- **run idempotency**: 워커 진입은 `update ... where status = 'queued'`로 원자적 전이만 허용한다. 즉 `ready`/`processing`이면 매칭 0행 → 중복 run은 무시된다. `failed`는 워커가 직접 재실행하지 않고 반드시 retry를 거쳐 `queued`가 된 뒤 실행된다.
- **retry_count 제한**: 최대 `MAX_RETRIES=3`회. 초과 시 `permanent_failed`(`error_json.errorType='permanent_failed'`, `permanent:true`)로 마킹하고 더 이상 큐잉하지 않는다. 프론트는 재시도 버튼 없이 "영구 실패" 화면을 띄운다.
- **프론트 polling timeout**: 서버 stale timeout과 동일한 10분. 그 안에 `ready`가 안 되면 재시도 화면.

## 결제(다음 단계)

`payment_status`(unpaid/paid) + `unlocked_at` 컬럼을 미리 뒀다. 정책:
- **결제 버튼 노출 조건(3개 모두 충족)**: `status === 'ready'` **AND** `result_json != null` **AND** `quality.passed === true`. 이 값은 `GET /api/paid-job` 응답의 `can_pay`(불리언)와 `quality`로 이미 계산되어 내려온다. `quality`는 run 시 `evidence_pack.quality`에 저장된다(ready면 항상 passed — full_fallback_used는 애초에 failed로 저장되므로 결제 대상이 아님).
- 결제 성공 → `payment_status=paid`, `unlocked_at` 설정 → 저장된 `result_json` unlock.
- 금지: 결제 후 첫 Claude 호출 / result_json 없는 상태에서 결제 버튼 노출 / 생성 실패 가능성이 남은 상태의 unlock.

## 미검증(배포 후 확인 필요)

로컬에서 타입체크·빌드·회귀·계약 테스트는 통과했으나, 아래는 **실제 Supabase + Vercel 배포에서만** 확인 가능하다:
- 테이블 접근(권한/RLS/service_role) 정상 여부.
- run worker의 Vercel 180초 내 완료 및 DB 저장.
- 폴링 → `ready` → 저장된 result_json 렌더 end-to-end.
