# 유료 접수(paid-job intake) — job row 미생성 근본 원인 조사

- 날짜: 2026-07-12
- 증상: production에서 사용자가 유료 심화 문항을 제출했으나 Supabase `paid_analysis_jobs`에 row가 전혀 생성되지 않음.
- 조사 범위: PaidQuestionsView 제출 → POST /api/paid-job → insert 까지의 접수 구간만. (QStash runner/Claude 실행/polling은 제외 — row 자체가 없으므로)
- 조사 기준 코드: 로컬 HEAD = `5ace9bc` = `origin/main` (동기 상태 확인됨). 로컬 미커밋 변경(QStash 강화 작업)은 production에 없으므로 구분해 분석함.

## ★ 결론 (라이브 검증으로 확정)

**근본 원인: 커밋 `5ace9bc`(QStash background-job, 2026-07-10)가 production에 배포됐지만, 그 커밋이 요구하는 운영 전제 2가지가 모두 미이행 상태다.**

1. **[최초 실패 지점 — 확정] Vercel production에 `QSTASH_TOKEN` 미설정.**
   production API에 완성 제출과 동일한 payload를 1회 POST한 결과(2026-07-12):
   `HTTP 503 {"error":"not_configured","detail":"qstash token missing"}` — [api/paid-job.ts@5ace9bc:131-132](../../api/paid-job.ts)의 S6 게이트가 **insert 이전**에 모든 제출을 종료시킨다. row가 절대 생성될 수 없다. (프로브 후 row count 0 재확인 — DB 무변경)
2. **[두 번째 차단막 — 확정] `db/paid_analysis_jobs_qstash.sql` 마이그레이션이 production Supabase에 미적용.**
   production DB를 anon 키로 컬럼별 프로빙(읽기 전용, RLS 무관하게 스키마 오류는 확정적)한 결과, 해당 마이그레이션이 추가하는 컬럼 전부가 없음: `attempt_count`·`failed_at`·`lease_id`·`lease_expires_at`·`enqueued_at`·`qstash_message_id`·`runner_duration_ms`·`last_error_*` → 모두 42703. 반면 pre-QStash 컬럼(`latest_error_json`·`retry_count` 등)은 전부 존재.
   `5ace9bc`의 insert는 `attempt_count: 0`을 포함하므로(이 커밋에서 처음 추가 — `git log -S attempt_count`로 확인), **토큰을 설정하더라도 insert가 스키마 오류(S7 → 500 store_error)로 실패해 여전히 row가 생기지 않는다.**
3. **[배포 버전 — 확정] production은 정확히 `5ace9bc`다.**
   production 번들(`/assets/index-CNGlezfV.js`)에 5ace9bc 마커(`생성 안 함`)가 존재하고, 구버전 마커(`생성/실행 안 함`, `api/paid-analysis` 프론트 호출)와 로컬 미커밋 마커(`paid-analysis-request`, `background_generation_disabled`)는 부재.

사용자가 본 화면: 503 → 프론트 `finishError('create_http_503_not_configured')` → "결과 생성 중 문제가 발생했습니다"(요청 ID 없음). `quiz_events`에 `paid_analysis_failed(reason=create_http_503_not_configured)`가 기록됐을 것(anon 키는 해당 테이블 select 불가라 미열람).

**복구 순서(운영)**: ① `db/paid_analysis_jobs_qstash.sql`을 production Supabase에 적용(로컬 미커밋 추가분 포함해 적용할지 결정) → ② Vercel production에 `QSTASH_TOKEN`(+ signing key, `PUBLIC_APP_URL`) 설정 → ③ 완성 payload로 201 + row 생성 확인. **순서 주의: 토큰만 먼저 설정하면 S6은 통과하지만 S7(스키마)에서 다시 전면 실패한다.**

---

## 1. 현재 submit → insert 호출 흐름 (HEAD `5ace9bc` = production 후보)

1. **제출**: `PaidQuestionsView.goNext()` ([PaidQuestionsView.tsx:109-114](../../src/components/paid/PaidQuestionsView.tsx))
   - 마지막 스텝에서 `onComplete(answers)` 호출 후 `window.location.hash = '#paid-result'`.
   - `canProceed` 게이트: 각 스텝의 **single 문항 8개가 모두 선택돼야** 다음/제출 버튼 활성화. 조용한 return은 `if (!canProceed) return;` 하나뿐이며, 이 경우 버튼 자체가 disabled라 실제로는 도달 불가.
   - **답변은 어디에도 저장되지 않음** — React state(`answers`)를 콜백으로 상위에 넘길 뿐.
2. **상태 전달**: `App.tsx:43,58-59` — `setPaidAnswers`(App 컴포넌트의 **in-memory React state**)에 보관, hash 라우트 `paid`에서 `<PaidResultView paidAnswers={paidAnswers} />`로 prop 전달. sessionStorage/localStorage 저장 없음(HEAD 기준).
3. **결과 화면 mount**: `PaidResultView` useEffect(mount 1회, deps `[]`).
   - `if (!paid && !urlJobId) { setPhase('no_answers'); return; }` — **paidAnswers가 없으면 POST 없이 조용히 종료** (HEAD PaidResultView.tsx:105).
4. **무료 맥락**: `readFreeContext()` ([freeContext.ts:51-86](../../src/components/paid/freeContext.ts)) — localStorage 키 `career-compass-hybrid-session-v1` (저장측 [HybridFlowView.tsx:56](../../src/components/hybridV3/HybridFlowView.tsx)과 **일치 확인**). 파싱 실패/세션 없음 시 **빈 값 폴백, 절대 throw 안 함** → freeContext 때문에 POST가 중단되는 경로는 없음.
5. **POST**: `createJobOnce()` — `fetch('/api/paid-job', {method:'POST', body:{freeContext, paidAnswers}})`. **abort signal을 붙이지 않음**(HEAD 코드 주석 명시) → unmount cleanup이 create fetch를 취소하지 않음. `createOnceRef`로 StrictMode/재렌더 중복 방지.
6. **API handler** `api/paid-job.ts@5ace9bc`: 게이트 통과 후 `sb.from('paid_analysis_jobs').insert(...)`.

## 2. insert 이전의 모든 종료 분기

### 서버 (api/paid-job.ts @ 5ace9bc, POST 경로)
| # | 분기 | 응답 | 로그 |
|---|---|---|---|
| S1 | Supabase env 누락 (`sbClient()` null) | 503 `not_configured` "supabase env missing" | 없음 |
| S2 | method ≠ POST/GET | 405 `method_not_allowed` | 없음 |
| S3 | body JSON 파싱 실패 | 400 `invalid_json` | 없음 |
| S4 | `!freeContext \|\| !paidAnswers` | 400 `invalid_payload` | 없음 |
| S5 | `!hasResultSignal && answerCount < 3` | 422 `insufficient_input` | `CREATE PAYLOAD_SHAPE` |
| S6 | **`!process.env.QSTASH_TOKEN`** | **503 `not_configured` "qstash token missing"** | `qstash_not_configured` |
| S7 | insert 자체 오류 | 500 `store_error` | `paid_job_create_store_error` |

- **S6은 `5ace9bc`에서 새로 추가**된 게이트로, **insert보다 앞에** 위치. `.env.example`에 QSTASH_TOKEN 항목도 같은 커밋에서 처음 등장 → 이 배포 전에는 production에 QSTASH_TOKEN이 필요 없었음.
- QStash **publish 실패는 insert 이후**라서 row는 남는다(status=failed) — "row 전혀 없음"의 원인이 될 수 없음(코드 순서로 확정).

### 클라이언트 (POST 이전)
| # | 분기 | 사용자 화면 | 관측 |
|---|---|---|---|
| C1 | `FEATURE_FLAGS.paidAnalysis=false` | 무료 홈 폴백 | — (HEAD에서 `true` 확인) |
| C2 | **mount 시 paidAnswers 없음** (새로고침·직접 진입·모바일 Safari 탭 재적재·SPA 재로드) | "먼저 심화 문항에 답해 주세요"(no_answers) | **아무 로그/이벤트 없음 — 완전 무관측** |
| C3 | fetch 네트워크 실패 | 오류 화면(요청 ID 없음) | `quiz_events`에 `paid_analysis_failed`(reason=fetch 오류 메시지) |
| C4 | 서버 4xx/5xx 응답 | 오류 화면(요청 ID 없음) | `quiz_events`에 `paid_analysis_failed`(reason=`create_http_<status>_<error>`) |

- StrictMode 이중 mount는 dev 전용이며 `createOnceRef`가 방어 — production 원인 아님.
- effect cleanup(`controller.abort()`)은 **polling GET에만** 적용, create POST에는 signal 미부착 → cleanup이 POST를 취소하는 경로 없음.
- Vercel 라우팅: `vercel.json`에 rewrites 없음, 표준 `/api` 함수 라우팅 → POST가 handler에 도달하지 못할 라우팅 문제 근거 없음.

## 3. 실행 검증 (실제 핸들러 구동 결과)

`node --experimental-strip-types`로 HEAD 사본과 로컬 버전의 handler를 mock req/res로 직접 호출 (스크립트: scratchpad `verify-paid-job-gates.mjs`, exit 0):

| 시나리오 | 결과 |
|---|---|
| HEAD: 12문항 완답 + **빈 freeContext** + QSTASH_TOKEN 없음 + VERCEL_ENV=production | **503 "qstash token missing"** — insert 미도달. `answerCount=12`로 S5(422) 통과 확인 |
| HEAD: Supabase env 없음 | 503 "supabase env missing" |
| HEAD: freeContext 키 자체 누락 | 400 invalid_payload |
| HEAD: 빈 답변 + 빈 freeContext | 422 insufficient_input (UI상 도달 불가 — single 8개 필수) |
| 로컬(미커밋): 완답 + 토큰 있음 + VERCEL_ENV 미설정/preview | 503 `background_generation_disabled` (로컬 신규 게이트, production엔 없음) |
| 로컬(미커밋): production + 토큰 없음 | 503 "qstash token missing" (HEAD와 동일) |

**결론**: UI를 정상 통과한 완성 제출은 S3·S4·S5로는 절대 죽지 않는다(검증됨). insert 이전에 죽을 수 있는 서버 분기는 **S1(supabase env)·S6(QSTASH_TOKEN)·S7(insert 오류)** 뿐이다.

## 4. 확인된 사실 vs 미확인 사항

### 확인된 사실 (전부 검증됨)
- **production = `5ace9bc`** (번들 마커 대조로 확정, §결론 3).
- **production 응답 라이브 관측**: 완성 payload POST → `503 {"error":"not_configured","detail":"qstash token missing"}` → **QSTASH_TOKEN 미설정 확정** (S6, insert 이전). 최초 실패 지점.
- **production DB에 QStash 마이그레이션 미적용 확정** (컬럼 프로빙, §결론 2). `5ace9bc` insert가 참조하는 `attempt_count`가 없어 토큰 설정 후에도 insert는 실패한다(S7).
- `5ace9bc`의 S6 게이트는 이 커밋에서 신설(실행 검증 §3). 직전 버전(`160dd95`)의 insert는 `attempt_count`를 포함하지 않아 구 스키마와 호환 — 장애는 7/10 배포부터 시작된 회귀.
- HEAD 프론트에는 답변·jobId·clientRequestId의 **어떤 영속화도 없다**. paidAnswers는 App의 React state뿐 → 새로고침/재진입 시 소실되고, 이 경우 **POST 자체가 나가지 않으며 아무 흔적도 남지 않는다**(C2 — 이번 장애의 원인은 아니나 별도 위험).
- POST가 서버 오류를 받으면 `quiz_events.paid_analysis_failed`에 reason이 기록된다(`paidAnalytics.ts:67-69`).
- storage key 불일치 없음, freeContext로 인한 중단 없음, abort로 인한 POST 취소 없음.
- `paid_analysis_jobs`의 anon 가시 row 수 0 (프로브 전후 동일 — 프로브가 DB를 변경하지 않았음도 확인).

### 미확인 사항 (결론에 영향 없음)
- `quiz_events` 실데이터(사고 세션의 `paid_analysis_failed` 이벤트) — anon 키로 select 불가(RLS). 사고 당시 사용자가 실제로 503 화면을 봤는지의 부차 확인용일 뿐, 원인 확정에는 불필요해짐.
- Vercel 함수 로그의 `qstash_not_configured` 이벤트 기록 — 대시보드 접근 필요. 라이브 프로브가 동일 사실을 이미 증명.

## 5. 구조 변경 필요 여부 판단 (완료 조건 6)

제안 구조(제출 시 sessionStorage 저장 → clientRequestId → POST → jobId 저장 → 화면 이동)에 대한 증거 기반 판단:

- **답변 영속화: 필요.** C2가 실재하고 완전 무관측·무흔적임이 코드로 확정됐다. 결제 상품에서 "제출한 답변이 어디에도 저장되지 않는" 상태는 단일 실패점.
- **clientRequestId + jobId sessionStorage: 필요하며 이미 로컬 미커밋 작업에 구현됨** ([paidJobSession.ts](../../src/components/paid/paidJobSession.ts) + DB 부분 unique index `paid_analysis_jobs_client_request_uidx` + 서버 23505 dedup 경로). 이 작업은 유지.
- **"POST 후 화면 이동" 전면 재구조화: 필수는 아님.** 정상 흐름에서는 mount 즉시 POST가 나가며(검증됨), 이번 장애의 최초 실패 지점이 "이동 타이밍"이라는 증거는 없다. 답변 영속화 + 기존 jobId 복구(로컬 작업)만으로 C2가 닫힌다. 다만 제출 화면에서 POST를 먼저 보내는 구조도 무해하며 UX상 더 견고 — 선택 사항.

## 6. POST 실패 시 답변·clientRequestId 유지 여부 (완료 조건 7)

**유지해야 한다.**
- clientRequestId를 유지하면 재시도 시 DB unique 제약(23505 → 기존 job 반환)이 중복 job/중복 Claude 호출을 막는다 — 로컬 작업의 설계 의도와 일치.
- 답변을 지우면 사용자가 12문항을 다시 입력해야 한다(결제 상품에서 수용 불가).
- 초기화는 사용자가 명시적으로 "새 심화 분석 시작"을 누를 때만(`clearPaidKeys`) — 로컬 코드가 이미 이 정책.

## 7. 최소 수정 대상 (근본 원인 확정 후 적용; 이번 조사에서는 코드 미수정)

| 대상 | 변경 | 이유 |
|---|---|---|
| (운영 ①) production Supabase | `db/paid_analysis_jobs_qstash.sql` 적용 | insert가 참조하는 `attempt_count` 등 부재 — 미적용 시 토큰 설정 후에도 전면 실패(S7). **토큰보다 먼저 적용** |
| (운영 ②) Vercel production env | `QSTASH_TOKEN`(+`QSTASH_CURRENT_SIGNING_KEY`/`NEXT`, `PUBLIC_APP_URL`) 설정 | 확정된 최초 실패 지점(S6 503) 해소 |
| `src/components/paid/PaidQuestionsView.tsx` | `goNext()` 마지막 스텝에서 `onComplete` 전에 paidAnswers를 sessionStorage에 저장 | C2(상태 소실 → 무흔적 미접수) 제거 |
| `src/components/paid/PaidResultView.tsx` | prop 없을 때 저장된 답변 폴백 후에만 no_answers 판정; no_answers 진입 시 `quiz_events` 이벤트 기록 | C2 복구 + 무관측 해소 |
| `src/components/paid/paidJobSession.ts` (신규, 이미 작성됨) | 답변 저장/복원 헬퍼 추가 | 키·정책 한 곳 관리 |

## 8. 서버 최소 로그 이벤트 / errorCode (관측성)

`5ace9bc`에 이미 있는 것: `CREATE PAYLOAD_SHAPE`(S5 앞), `qstash_not_configured`, `paid_job_created`, `paid_job_create_store_error`, `qstash_publish_*`. 추가 권장:

- `paid_job_intake_received` — 게이트 이전, `{clientRequestId, hasFreeContext, answerCount}`. "요청이 도달했는가"를 무조건 1줄로.
- S1~S4에도 slog 1줄씩 (`intake_rejected`, `{errorCode}`) — 현재 S1~S4는 무로그.
- 모든 4xx/5xx 응답 body에 `errorCode` 유지(현행 `error` 필드로 충족) + 프론트 `paid_analysis_failed` reason에 그대로 전파(현행 유지).
- 클라이언트: no_answers 분기 이벤트(`paid_intake_no_answers`) — 현재 유일한 완전 무관측 분기.

## 9. 실행한 명령·결과 요약

- `git status --short` / `git diff --stat` / `git log` — exit 0. 미커밋 QStash 작업 7파일 + 신규 2파일(untracked) 확인, 삭제·reset 없음.
- `git show HEAD:api/paid-job.ts`, `git show 160dd95:api/paid-job.ts`, `git log -S attempt_count -- api/paid-job.ts` — exit 0. `attempt_count`가 `5ace9bc`에서 insert에 처음 추가됨 확인.
- `node --experimental-strip-types verify-paid-job-gates.mjs` — exit 0. §3 표의 8개 시나리오 전부 실행 검증.
- **production DB 컬럼 프로빙** (읽기 전용, 로컬 `.env`의 anon 키): `GET /rest/v1/paid_analysis_jobs?select=<col>&limit=0` × 26개 컬럼 — QStash 마이그레이션 컬럼 12개 전부 42703(부재), pre-QStash 컬럼 전부 200(존재). row count(`Prefer: count=exact`) = 0.
- **production 번들 대조**: `curl https://career-compass-rose.vercel.app/assets/index-CNGlezfV.js` 후 마커 grep — `5ace9bc` 확정.
- **production 라이브 프로브**: 완성 payload 1회 `POST /api/paid-job` → `503 {"error":"not_configured","detail":"qstash token missing"}`. 프로브 후 row count 0 재확인(무변경).
- 코드 수정·commit·push·migration 실행·env 변경: **없음**. (마이그레이션·env는 '적용 필요'로 보고만 함)

### 확인하지 못한 것 (결론에 영향 없음)
- Vercel 대시보드(함수 로그·배포 이력) — CLI 미인증. 라이브 프로브·번들 대조로 대체 증명.
- Supabase `quiz_events` 실데이터 — anon select가 RLS로 차단(무필터 조회도 빈 배열).
- ~~로컬에 test runner(vitest) 미설치로 기존 `*.test.ts`는 실행 불가~~ → 후속 검증에서 정정: repo의 테스트는 전부 자체 node 실행형(`node --experimental-strip-types`)이며 전 스위트 통과 확인([qstash-production-readiness.md](qstash-production-readiness.md) §10).
