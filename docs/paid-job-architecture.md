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

> service_role 키는 절대 `VITE_` 접두사를 붙이지 말 것(붙이면 client 번들에 포함됨). 서버 전용 이름으로 둔다.

## 결제(다음 단계)

`payment_status`(unpaid/paid) + `unlocked_at` 컬럼을 미리 뒀다. 정책:
- job `status=ready`(= `result_json` 저장 성공) 이후에만 결제/paywall 진입.
- 결제 성공 → `payment_status=paid`, `unlocked_at` 설정 → 저장된 `result_json` unlock.
- 금지: 결제 후 첫 Claude 호출 / result_json 없는 상태에서 결제 버튼 노출 / 생성 실패 가능성이 남은 상태의 unlock.

## 미검증(배포 후 확인 필요)

로컬에서 타입체크·빌드·회귀·계약 테스트는 통과했으나, 아래는 **실제 Supabase + Vercel 배포에서만** 확인 가능하다:
- 테이블 접근(권한/RLS/service_role) 정상 여부.
- run worker의 Vercel 180초 내 완료 및 DB 저장.
- 폴링 → `ready` → 저장된 result_json 렌더 end-to-end.
