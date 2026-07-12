# 유료 접수에서 job row가 전혀 안 생김 — 배포 커밋의 운영 전제(env·마이그레이션) 미이행을 외부 관측만으로 확정

날짜: 2026-07-12

## 해결한 문제
production에서 유료 심화 문항을 제출했는데 `paid_analysis_jobs`에 row가 0건인 장애의 근본 원인을, Vercel 대시보드 접근 없이 코드 분석 + 실행 검증 + production 외부 관측(읽기 전용)만으로 확정했다.

## 사용자에게 나타난 증상
사용자는 12문항을 완료하고 제출했으나 Supabase에 job row가 생성되지 않음. (프론트 흐름상 503 → "결과 생성 중 문제가 발생했습니다" 화면을 봤을 것)

## 확인된 근본 원인
커밋 `5ace9bc`(QStash background-job, 7/10)가 production에 배포됐지만 운영 전제 2가지가 모두 미이행:
1. **Vercel production에 `QSTASH_TOKEN` 미설정** — 완성 payload를 production API에 1회 POST해 `503 "qstash token missing"`을 직접 관측. 이 게이트는 insert **이전**이라 row가 절대 생기지 않는다. (최초 실패 지점)
2. **`db/paid_analysis_jobs_qstash.sql` 마이그레이션 미적용** — anon 키 컬럼 프로빙으로 `attempt_count` 등 신규 컬럼 12개 전부 42703(부재) 확인. `5ace9bc`의 insert가 `attempt_count`를 참조하므로 토큰을 설정해도 insert가 실패한다(숨은 2차 차단막).
- production이 정확히 `5ace9bc`임은 배포 번들의 마커 문자열 대조로 확정(신버전 마커 존재, 구버전·로컬 미커밋 마커 부재).

## 고려하거나 시도한 접근법
- 코드 정독만으로 원인 단정 — 게이트 발화 조건 확신 불가라 기각.
- vitest 재현 테스트 — repo에 test runner 미설치라 불가. → `node --experimental-strip-types`(Node 24)로 핸들러 TS를 그대로 import해 mock req/res로 8개 시나리오 실행(HEAD 버전은 `git show`로 추출, `node_modules` 심링크, `import(path+'?v='+rand)`로 캐시 회피).
- Vercel CLI(`vercel env ls`) — 토큰 미인증으로 불가.
- Supabase `quiz_events` 조회 — anon select가 RLS로 차단(빈 배열이라 무의미). 대신 **컬럼 존재 오류(42703)는 RLS와 무관하게 확정적**이라는 점을 이용해 스키마 프로빙으로 전환.
- production POST 프로브는 "스키마상 insert가 반드시 실패한다"를 먼저 증명해 **row가 생길 수 없음을 확보한 뒤에만** 실행(부작용 없음을 사전 증명).

## 최종 해결 방법과 선택 이유
조사 태스크이므로 코드 수정 없이 보고서(`docs/debug/paid-job-intake-root-cause.md`)로 종결. 복구는 운영 작업 2건(①마이그레이션 적용 → ②QSTASH_TOKEN 설정, 반드시 이 순서)으로 특정.

## 변경된 주요 파일
- `docs/debug/paid-job-intake-root-cause.md` — 조사 보고서(흐름·전체 종료 분기 표·가설 판별 절차·최소 수정안)
- 앱 코드 변경 없음. 검증 스크립트는 세션 scratchpad(`verify-paid-job-gates.mjs`)에만 존재.

## 검증 방법과 결과
- mock handler 8개 시나리오(exit 0): 완답+빈 freeContext+토큰 없음 → 503 "qstash token missing"(answerCount=12로 422 통과 증명) 등.
- production DB 컬럼 프로빙 26개: QStash 마이그레이션 컬럼 전부 42703, 구 컬럼 전부 존재.
- production 번들 마커 대조 → 배포 버전 `5ace9bc` 확정.
- production 라이브 POST 1회 → 503 "qstash token missing" 직접 관측. 프로브 전후 row count 0 동일(DB 무변경).

## 재발 방지 원칙
- **배포 커밋이 새 env 변수나 DB 마이그레이션을 요구하면, 배포 전에 둘 다 이행됐는지 체크리스트로 확인한다.** insert 이전 게이트·insert 컬럼 추가는 미이행 시 "데이터가 아예 안 남는" 전면 장애가 된다. 이번 건은 env와 마이그레이션이 **동시에** 빠져 하나를 고쳐도 다른 하나가 막는 이중 장애였다.
- 대시보드 접근이 없어도 확정 가능한 외부 관측 수단: ① 컬럼 존재 오류(42703)는 RLS와 무관 → anon 키로 production 스키마 검증 가능, ② 배포 번들의 마커 문자열로 배포 커밋 특정, ③ 부작용 없음을 먼저 증명한 뒤의 라이브 프로브.
- 사용자 입력이 React state에만 있으면 영속화 지점을 만든다(sessionStorage 등). 소실 분기는 로그도 안 남아 사후 조사가 불가능하다.
- 조용한 early return 분기(no_answers류)에는 최소 1개의 analytics 이벤트를 남긴다.
- test runner가 없는 repo에서 서버리스 핸들러 검증: Node 22+ type stripping + `git show` 추출 + `node_modules` 심링크 조합이 수정 없이 동작한다.

## 남은 위험 / 후속 작업
- 운영 복구 runbook·계약 검증(insert↔컬럼, runner↔RPC, env 대응표)은 `docs/debug/qstash-production-readiness.md`로 확정(2026-07-12 후속 검증). 순서: migration → env(token+signing key 세트) → 재배포 → intake smoke → QStash delivery → result 저장 확인.
- 후속 검증에서 추가 발견: `api/paid-job-retry.ts`가 pre-QStash 설계 잔재(failed job의 result_json 무조건 초기화 + QStash 재publish 없음 → retry된 job이 orphan queued) — **2026-07-12 안전 비활성화로 처리**(인증 유지, DB 미접근, 503 `retry_temporarily_disabled`). QStash-aware retry는 별도 후속.
- 답변 sessionStorage 영속화(C2 분기) — **2026-07-12 구현 완료**(제출 시 저장 → 결과 화면 복구, 브라우저 검증). 이 과정에서 **scope 소실 버그를 실제 재현**: `stableScopeId()`가 analytics id를 '읽기만' 하면 흐름 중간에 analytics가 id를 생성할 때 storage scope가 `default→uuid`로 바뀌어 저장분을 전부 잃는다 → scope id를 같은 키·규칙으로 '생성'하도록 정렬해 해결. **교훈: 여러 모듈이 공유하는 storage 네임스페이스 키는 읽기 전용 참조가 아니라 단일 생성 규칙을 공유해야 한다.** UUID 폴백도 RFC 4122 v4 보장으로 수정(uuid 컬럼 22P02 방지). no_answers 관측 이벤트는 여전히 별도 작업.
- (정정) repo 테스트는 vitest가 아니라 전부 자체 node 실행형(`node --experimental-strip-types <file>`) — 10개 스위트 526 체크 전부 통과 확인. `tsc -b`는 `api/`를 커버하지 않으므로 api 핸들러는 `npx tsc --ignoreConfig --noEmit ...`로 별도 typecheck 필요.
