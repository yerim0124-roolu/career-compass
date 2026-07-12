# QStash production 복구 — 코드·마이그레이션·환경변수 계약 검증

- 날짜: 2026-07-12
- 전제: [paid-job-intake-root-cause.md](paid-job-intake-root-cause.md)에서 확정된 원인(① production `QSTASH_TOKEN` 미설정 → insert 이전 503, ② `db/paid_analysis_jobs_qstash.sql` 미적용 → 적용 없이는 insert가 `attempt_count` 참조로 실패).
- 기준: production 배포 커밋 = `5ace9bc`(번들 대조로 확정). 로컬 working tree는 그 위에 미커밋 QStash 강화 작업(paid-job/runner/SQL/PaidResultView + 신규 paidJobSession)을 가짐. 아래 표는 **로컬 working tree 기준**이며, 5ace9bc와 다른 항목은 표기.
- 이 문서는 검증 결과만 기록한다. migration 실행·env 변경·배포는 하지 않았다.

---

## 1. paid-job insert ↔ DB 컬럼 대응표

`api/paid-job.ts` POST insert(로컬 L160-170; 5ace9bc는 `client_request_id` 없음) 및 이후 update가 쓰는 컬럼:

| 컬럼 | 소스 | production 현재 | migration 제공 | null/default 정합 |
|---|---|---|---|---|
| user_session_id, test_result_id | insert | 존재 | (기존) | null 허용 ✓ |
| status, input_json, evidence_pack, result_json, error_json, latest_error_json, retry_count, payment_status, created_at, updated_at, completed_at | insert/update | 존재 | (기존) | ✓ |
| **attempt_count** | insert `0` | **없음** | L11 `integer not null default 0` | insert가 0 공급 ✓. **미적용 시 insert 전체 실패(확정된 2차 차단막)** |
| **client_request_id** | insert (로컬만) | **없음** | L21 `uuid` + L26-28 부분 unique index | null 허용(구버전 호환) ✓ |
| enqueued_at, qstash_message_id | publish 성공 update | 없음 | L6, L14 | null 허용 ✓ |
| failed_at, last_error_code/message/retryable | publish 실패 update | 없음 | L10, L17-19 | null 허용 ✓ |
| lease_id, lease_expires_at, processing_started_at, claude_started_at, claude_completed_at, claude_duration_ms, runner_duration_ms | runner/RPC | 없음 | L7-9, L12-13, L15-16 | null 허용 ✓ |

- GET(polling)은 `attempt_count ?? 0` 등 `??` 방어가 있어 마이그레이션 전에도 동작(현행 production GET이 살아있는 이유).
- **5ace9bc 호환성**: 신규 컬럼이 전부 nullable 또는 default라 migration을 먼저 적용해도 5ace9bc 코드(client_request_id 미전송)와 구 `/api/paid-analysis` 워커에 무해 — **migration은 재배포 없이 단독 선적용 가능**.
- **client_request_id dedup 로직 ↔ index 정합**: 서버는 insert 오류 `code==='23505'`일 때만 `client_request_id`로 기존 job을 조회·반환(paid-job.ts L175-180). 부분 unique index(`where client_request_id is not null`)와 일치 — NULL 다중 허용으로 구버전 클라이언트 안전 ✓.

## 2. runner ↔ RPC 대응표

| RPC (SQL 정의) | runner 호출부 | 인자 정합 | 가드/상태 전이 |
|---|---|---|---|
| `claim_paid_analysis_job(p_job_id uuid, p_lease_id uuid, p_lease_seconds int)` returns setof jobs | runner L112 `{p_job_id, p_lease_id, p_lease_seconds: 360}` | ✓ | `result_json is null` + (queued ∨ processing&lease만료)만 claim. status→processing, attempt_count+1, lease 세팅. 반환 0행이면 Claude 호출 금지(L115) ✓ |
| `save_paid_analysis_result(8 args)` | runner L150-153 (이름·순서 일치, ms는 number→bigint OK) | ✓ | `lease_id = p_lease_id AND result_json is null`일 때만 저장. status→ready, error/lease 초기화 ✓ |
| `release_paid_analysis_lease(4 args)` | runner L168 | ✓ | `lease owner AND status='processing' AND result_json is null`일 때만 →queued. **result 있으면 절대 되돌리지 않음** ✓ |
| `fail_paid_analysis_job(5 args)` | runner L123, L198 | ✓ | `lease owner AND result_json is null`일 때만 →failed. **result 있으면 절대 failed로 덮지 않음** ✓ |

- 4개 RPC 모두 `security definer` + `set search_path = public, pg_temp` + `revoke from public/anon/authenticated` + `grant to service_role` (SQL L151-162) ✓. 시그니처와 revoke/grant의 인자 타입 나열 일치 확인.
- **결과 보호 종합**: result_json이 있으면 claim 불가·save 불가·release 불가·fail 불가 + runner가 사전 skip(L102-108). 저장된 결과를 지우는 경로는 runner/RPC에 없음 ✓. (예외는 §7-F1의 admin retry.)
- lease(360s) > runner maxDuration(300s) → 실행 중 stale 오판 방지 ✓. `MAX_ATTEMPTS=3` = QStash 최초 1 + retries 2 ✓.
- **중복 Claude 방지 체인**: publish `deduplicationId: paid-analysis:${jobId}`(중복 publish 차단) → atomic claim(중복 delivery 차단) → already_has_result skip(재실행 차단) → save의 lease-owner 조건(늦은 저장 차단). 정합 ✓.

## 3. production 환경변수 대응표

| 변수 | 사용 위치 | 필수 여부 | .env.example |
|---|---|---|---|
| `SUPABASE_URL` | paid-job/runner/paid-analysis/retry `sbClient()` | 필수 | ✓ |
| `SUPABASE_SERVICE_ROLE_KEY` | 위와 동일 | **필수** — anon 폴백이 있지만 **RPC가 service_role 전용(grant)이라 anon 키로는 runner claim이 42501로 실패**. 폴백에 기대면 안 됨 | ✓ |
| `ANTHROPIC_API_KEY` | runner L64, paid-analysis | 필수 | ✓ |
| `QSTASH_TOKEN` | paid-job publish L140,199 | 필수 (**현재 production에 없음 — 확정 원인**) | ✓ |
| `QSTASH_CURRENT_SIGNING_KEY` / `QSTASH_NEXT_SIGNING_KEY` | runner 서명 검증 L65-66,82 (Receiver, raw body, url 미포함 검증) | 필수 — 없으면 runner 503 → QStash delivery 전부 실패 | ✓ |
| `PUBLIC_APP_URL` | paid-job `resolveRunnerBaseUrl`/`displayBaseUrl` | 권장(production destination 안정화; 없으면 VERCEL_URL→헤더→하드코딩 prod 순 폴백) | ✓ |
| `ALLOW_PREVIEW_QSTASH` | paid-job publishDisabled(로컬 작업만; 5ace9bc에 없음) | preview에서만 의미. production 불필요 | ✓ (로컬 diff에서 추가) |
| `ADMIN_RETRY_SECRET` | paid-job-retry L39 | 선택(미설정=403 거부, 안전 기본값) | ✓ |
| `VITE_SUPABASE_URL` / `VITE_SUPABASE_ANON_KEY` | 프론트 번들(analytics insert) + 서버 폴백 | 필수(빌드타임) | ✓ |
| `VERCEL_ENV`, `VERCEL_URL` | 환경 분기 | Vercel 자동 주입 | — |

- 이름 대조: 코드의 `process.env.*` 전수(grep)와 `.env.example` 항목 완전 일치, 오타 없음 ✓.
- destination 조합: `resolveRunnerBaseUrl(req) + '/api/paid-analysis-runner'` — production은 `PUBLIC_APP_URL` 우선, preview는 **자기 자신(VERCEL_URL)** 사용(교차환경 호출 차단) ✓. production/preview 분리는 §5 실행 검증에서 확인됨(preview는 `ALLOW_PREVIEW_QSTASH!=='true'`면 publish 전 503).

## 4. Vercel 계약

- [vercel.json](../../vercel.json): `api/paid-analysis-runner.ts` maxDuration **300** == 파일 내 `export const maxDuration = 300`(runner L16) — 충돌 없음 ✓. `api/paid-analysis.ts` 180 유지 ✓. `fluid: true`.
- runner `config = { api: { bodyParser: false } }` + 스트림 직접 읽기(raw body 서명 검증) — req.body 미참조라 어느 런타임에서도 무해 ✓.

## 5. 프론트 접수·복구 (로컬 미커밋 작업)

| 항목 | 결과 |
|---|---|
| clientRequestId sessionStorage 보존 | ✓ `getOrCreateClientRequestId()` — 있으면 재사용. 테스트 74건 통과(`node --experimental-strip-types paidJobSession.test.ts`) |
| jobId sessionStorage 보존 | ✓ `storeJobId()` 즉시 저장, mount 시 `readStoredJobId()` 복구가 새 POST보다 우선. **브라우저 검증**: jobId 심고 새로고침 → `RECOVER stored jobId(새 POST 안 함)` 로그 + polling 로딩 화면 확인 |
| **paidAnswers sessionStorage 보존** | **✓ 구현 완료(2026-07-12)** — PaidQuestionsView 제출 시(화면 이동 전) `storePaidAnswers()`, PaidResultView mount에서 state 우선 + 없으면 `readStoredPaidAnswers()` 복구, state 있으면 저장소 동기화. 손상 JSON/비객체/mustKeep 비배열은 null(예외 없음). **브라우저 검증**: 12문항 제출→저장 확인, 새로고침(state 소실)→no_answers가 아니라 복구 후 POST 시도, POST 실패 후 답변·clientRequestId 유지, '새 심화 분석 시작' 클릭 시에만 3키 전체 삭제 |
| POST 실패 시 키 유지 | ✓ `clearPaidKeys()`는 '새 심화 분석 시작' 버튼에서만 호출. 실패 화면·자동 경로에서 호출 없음 |
| result_json 우선 렌더 | ✓ polling L287-291: `result_json ?? result`가 있으면 status 무관 렌더 |
| 404/network/5xx/failed 구분 | ✓ 실제 HTTP 404→not_found 화면(L282), network error→continue(L276), 비-404 5xx→continue(L281-284), status failed(+result 없음)→error 화면(L294) |
| 프론트의 /api/paid-analysis 직접 POST | ✓ 없음(grep 0건 — 5ace9bc에서 제거된 상태 유지) |

## 6. 회귀 검증

- `api/paid-analysis.ts` — **git 변경 없음**(`git status`/`diff --stat`에 미포함). 생성 로직 무변경 ✓.
- runner는 `generatePaidResult`/`previewEvidence`를 [api/paid-analysis.ts:1311,1345](../../api/paid-analysis.ts)에서 **import 재사용**(복제 없음) ✓. 단 sibling `.ts` import의 Vercel 번들링은 배포 후 1회 확인 필요(코드 주석에 자체 명시, §7-F5).
- 무료 흐름 — 변경 파일에 hybridV3/무료 경로 없음 ✓. `npm run build`(tsc -b + vite) exit 0.

## 7. 발견된 불일치·차단 요인

**launch 차단 (복구 순서에 반영)**
- B1. production DB에 migration 미적용(§1) — 적용 전 QSTASH_TOKEN만 설정하면 S7(insert 42703/PGRST204)로 다시 전면 실패.
- B2. production env에 QSTASH_TOKEN·signing key 미설정(§3) — 확정 원인. signing key 없이 token만 설정하면 job은 생기지만 runner가 503으로 전부 거부 → queued 고착 후 10분 stale-reap로 failed.

**launch 비차단 항목 — 2026-07-12 코드 수정으로 해소된 것**
- **F1. `api/paid-job-retry.ts` → 안전 비활성화로 해소.** 기존 구현(failed job의 result_json 무조건 초기화 + QStash 재publish 없이 queued로 되돌려 orphan화)을 제거하고, method 405 → secret 403(미설정=거부) → **503 `retry_temporarily_disabled`** 만 반환하도록 교체. DB·supabase 접근 코드 자체가 없다. 실행 검증: GET 405 / secret 없음·불일치 403 / 유효 secret 503 확인. 브라우저·정상 유료 흐름에서 이 endpoint를 호출하는 코드 0건(주석 참조 1건뿐, grep 검증). QStash-aware retry(재publish + result 보존)는 별도 후속 작업.
- **F2. UUID 폴백 → 해소.** `newUuid()`가 randomUUID → `getRandomValues` 기반 RFC 4122 v4(version/variant bit 설정) → Math.random 기반 v4 순으로 폴백하며 전 단계가 uuid 형식을 만족(v4 정규식 테스트 42건 + throw 이행 테스트 포함). 22P02 위험 제거.
- **F3. paidAnswers 영속화 → 구현 완료**(§5). 추가로 `stableScopeId()`가 analytics 세션 id 부재 시 같은 키·규칙으로 **생성**하도록 정렬 — 읽기 전용이던 기존 방식은 흐름 중간에 analytics가 id를 만들면 scope가 `default→uuid`로 바뀌어 저장분(답변·clientRequestId·jobId)을 잃는 소실 버그가 있었다(브라우저 검증 중 실제 재현 후 수정).

**여전히 남은 항목**
- F4. `tsc -b`가 `api/`를 커버하지 않음(tsconfig include: src, vite.config뿐) — 이번에도 `npx tsc --ignoreConfig --noEmit ... api/*.ts`로 수동 통과(exit 0) 확인. CI 공백.
- F5. runner의 sibling import(`./paid-analysis.ts`) 번들링 — 배포 후 runner 로그에서 `ERR_MODULE_NOT_FOUND` 부재 1회 확인 필요.
- F6. lint: 변경 파일들의 오류는 전부 HEAD에도 존재하던 패턴(`no-explicit-any`, PaidResultView의 ref/render 규칙 2건) — 새 오류 클래스 없음, 정확성 무관, 빌드 미차단.

## 8. 적용 후 상태 전이와 중단 기준

정상 전이: `POST → queued(row, enqueued_at, qstash_message_id)` → QStash delivery → `claim → processing(attempt=1, lease 360s)` → `save → ready(result_json, lease 해제)`.
실패 전이: retryable(claude timeout/network/http) & attempt<3 → `release → queued` → QStash 재delivery. terminal 또는 attempt 소진 → `failed(result 없을 때만)`. processing 10분 초과 → GET stale-reap `failed(worker_stale_timeout)`.

migration 자체는 **전부 additive + idempotent**(`if not exists`/`or replace`, 기존 row 일괄 변경 없음, 마지막에 `notify pgrst, 'reload schema'`로 PostgREST 캐시 갱신) — 실패 시 재실행 가능, rollback 불필요. 중단 기준은 아래 runbook 단계별 표기.

## 9. 적용 순서 (runbook)

1. **Migration** — Supabase SQL Editor에서 `db/paid_analysis_jobs_qstash.sql`(로컬 최신본, client_request_id 포함) 1회 실행.
   검증: `select attempt_count, client_request_id, enqueued_at from paid_analysis_jobs limit 0;` 성공 + RPC 4개 존재.
   중단 기준: 오류 발생 시 여기서 멈춤(코드 변경 없이는 아무 영향 없음). ※ 5ace9bc와 구 워커에 무해(§1) — 재배포보다 먼저 실행해도 안전.
2. **환경변수** — Vercel production에 `QSTASH_TOKEN` + `QSTASH_CURRENT_SIGNING_KEY` + `QSTASH_NEXT_SIGNING_KEY`(셋 세트) 및 `PUBLIC_APP_URL=https://career-compass-rose.vercel.app` 설정. `SUPABASE_SERVICE_ROLE_KEY`·`ANTHROPIC_API_KEY` 기존 설정 여부도 이때 확인(§3 필수 목록).
   중단 기준: signing key를 못 구하면 token만 설정하지 말 것(B2 — queued 고착 양산).
3. **Production 재배포** — env는 재배포 시점에 함수에 반영됨. 로컬 미커밋 작업을 함께 태울지 결정: (a) 5ace9bc 그대로 env만 반영하는 재배포로 먼저 복구 후 로컬 작업을 별도 배포, 또는 (b) 로컬 작업 commit 후 한 번에 배포. 어느 쪽이든 migration(1)이 선행돼 있으면 안전.
4. **Intake smoke test** — 완성 payload 1건 POST(`/api/paid-job`).
   기대: `201 {jobId, status:'queued'}` + row 존재 + `enqueued_at`·`qstash_message_id` not null. 로그 `paid_job_created` → `qstash_publish_succeeded`.
   중단 기준: 503 qstash → env 미반영(재배포 확인). 500 store_error → PostgREST 캐시(마이그레이션의 notify 재실행) 확인.
5. **QStash delivery 확인** — Upstash 콘솔에서 messageId delivery 성공(2xx) 확인. runner 로그: `runner_signature_verified` → `runner_claim_succeeded`.
   중단 기준: 403 invalid_signature → signing key 불일치. `ERR_MODULE_NOT_FOUND` → F5(sibling import) 수정 후 재배포.
6. **Runner/result 저장 확인** — 1~2분 내 GET polling이 `status:'ready' + result_json` 반환, row에 `usage_json`/`model`/`claude_duration_ms` 기록. 로그 `result_save_succeeded` → `runner_completed`.
   중단 기준: processing 고착 10분 → stale-reap 후 runner 로그의 실패 stage로 원인 분류(§8 전이표).
   비용 주의: smoke test 1건은 실제 Claude 생성 1회를 수행한다(의도된 검증 비용). 생성된 job은 unpaid 상태로 무해.

## 10. 실행한 명령·종료 코드

| 명령 | exit | 핵심 출력 |
|---|---|---|
| `git status --short` / `git diff --stat` | 0 | 수정 7 + untracked(테스트·세션 모듈 등). QStash 작업 그대로 보존 |
| `git diff --check` | 0 | whitespace 오류 없음 |
| `npm run build` (tsc -b && vite build) | 0 | 빌드 성공(500kB chunk 경고만) |
| `npx tsc --ignoreConfig --noEmit ... api/paid-job.ts api/paid-analysis-runner.ts api/paid-analysis.ts api/paid-job-retry.ts` | 0 | api 핸들러 타입 오류 없음 (`tsc -b`는 api/ 미커버 — F4) |
| `node --experimental-strip-types <10개 테스트 전체>` | 0 | 전 스위트 통과: paidJobSession **74**(답변 저장/복구·손상값·clear·UUID v4 폴백·scope 생성 추가), **paidAnalysisContract 68(서버 생성 계약 드리프트 없음 — 회귀 검증)**, resultContextWiring 32, resultContextEngine 85, chatFlow 107, storyInsight 15, subtypeFunctions 34, mainTypeNarratives 20, narrativePayload 20, signalMap 131 — 무료 흐름 회귀 없음 |
| 브라우저 검증(vite dev + preview) | — | 12문항 실제 제출→sessionStorage 저장, 새로고침 후 복구·POST 시도(no_answers 아님), POST 실패 후 키 유지, 저장 jobId 우선 복구(RECOVER 로그), '새 심화 분석 시작'만 3키 삭제. 콘솔에 답변 원문 미출력(개수/불리언만) |
| `npm run lint` (전체) / `npx eslint <변경 파일들>` | 리포트만 | 전체 121 problems(대부분 기존). 변경 파일 오류는 `no-explicit-any` 23(HEAD에도 동일 계열 2/10/10 존재) + `no-useless-assignment` 2 — 정확성 무관(F6) |
| `grep`(env 전수·paid-analysis fetch 부재·exports) | 0 | §3 표·§5·§6 근거 |
| test runner(vitest 등) 미설치 | — | `package.json`에 test script 없음. 이 repo의 `*.test.ts`는 전부 자체 node 실행형(`node --experimental-strip-types`)이라 러너 없이 전수 실행함 |
