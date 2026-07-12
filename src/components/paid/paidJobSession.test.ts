// paidJobSession.test.ts — 실행: node --experimental-strip-types <file>
// 정책 검증: mount/새로고침/응답유실/질문 화면 재마운트에서 clientRequestId·jobId·paidAnswers가
//           '유지'되고, clearPaidKeys()는 명시적 호출 때만 세 키를 함께 초기화한다.
//           newUuid()는 crypto 폴백 전 단계에서 RFC 4122 v4 형식을 만족한다.

import assert from 'node:assert';

// sessionStorage 목(브라우저 API 대체). window.sessionStorage로 주입.
class MemStorage {
  private m = new Map<string, string>();
  getItem(k: string): string | null { return this.m.has(k) ? this.m.get(k)! : null; }
  setItem(k: string, v: string): void { this.m.set(k, String(v)); }
  removeItem(k: string): void { this.m.delete(k); }
  clear(): void { this.m.clear(); }
}
const store = new MemStorage();
(globalThis as any).window = { sessionStorage: store };

const mod = await import('./paidJobSession.ts');
let passed = 0;
const ok = (label: string, cond: boolean) => { assert.ok(cond, label); passed++; };

// 분석 세션 id를 심어 스코프 안정화(새로고침에도 유지되는 값 시뮬레이션).
store.setItem('career-compass-analytics-session-id', 'sess-1');

// 1) 최초 호출 → clientRequestId 생성.
const id1 = mod.getOrCreateClientRequestId();
ok('clientRequestId 생성됨(비어있지 않음)', typeof id1 === 'string' && id1.length > 0);

// 2) 재마운트/재호출 → 동일 id 유지(mount reset 없음).
const id2 = mod.getOrCreateClientRequestId();
ok('재호출 시 동일 clientRequestId 유지(remount)', id2 === id1);

// 3) '새로고침' 시뮬레이션 — sessionStorage는 유지되므로 같은 id.
//    (window 객체만 새로 만들어도 store는 동일 → 값 유지)
(globalThis as any).window = { sessionStorage: store };
const id3 = mod.getOrCreateClientRequestId();
ok('새로고침 후 동일 clientRequestId 유지', id3 === id1);

// 4) jobId 저장/복구 라운드트립 — 응답유실 후에도 저장된 jobId로 복구 우선.
ok('저장 전 jobId 없음', mod.readStoredJobId() === '');
mod.storeJobId('job-uuid-123');
ok('storeJobId 후 readStoredJobId 복구', mod.readStoredJobId() === 'job-uuid-123');

// 5) 다른 세션 스코프 → 다른 키(격리).
store.setItem('career-compass-analytics-session-id', 'sess-2');
ok('다른 스코프는 저장 jobId 격리(빈 값)', mod.readStoredJobId() === '');
const idOtherScope = mod.getOrCreateClientRequestId();
ok('다른 스코프는 새 clientRequestId', idOtherScope !== id1);
store.setItem('career-compass-analytics-session-id', 'sess-1'); // 원복

// 6) clearPaidKeys()는 '명시적' 호출 때만 초기화.
ok('clear 전 값 존재', mod.getOrCreateClientRequestId() === id1 && mod.readStoredJobId() === 'job-uuid-123');
mod.clearPaidKeys();
ok('clear 후 jobId 삭제됨', mod.readStoredJobId() === '');
const idAfterClear = mod.getOrCreateClientRequestId();
ok('clear 후에는 새 clientRequestId(명시적 새 분석)', idAfterClear !== id1);

// 7) 시나리오: failed/404 job을 유지하다가 '새 심화 분석 시작' 버튼(=clearPaidKeys) →
//    키 삭제 → readStoredJobId 없음(새 POST 경로) → 새 clientRequestId(새 job).
store.clear();
store.setItem('career-compass-analytics-session-id', 'sess-flow');
const reqA = mod.getOrCreateClientRequestId();
mod.storeJobId('failed-or-404-job');
ok('버튼 클릭 전: 저장 jobId 유지(복구 우선)', mod.readStoredJobId() === 'failed-or-404-job');
ok('버튼 클릭 전: clientRequestId 동일 유지', mod.getOrCreateClientRequestId() === reqA);
mod.clearPaidKeys(); // ← '새 심화 분석 시작' 버튼 클릭 시에만
ok('버튼 클릭 후: 저장 jobId 삭제(더 이상 복구 안 함 → 새 POST)', mod.readStoredJobId() === '');
const reqB = mod.getOrCreateClientRequestId();
ok('버튼 클릭 후: 새 clientRequestId(새 job 생성)', reqB !== reqA && reqB.length > 0);

// ── paidAnswers 저장/복구 ──────────────────────────────────────────────────
const ANSWERS = {
  workStatus: '회사원(정규직)', maritalStatus: '미혼', dependents: '없음(나만)',
  trigger: '계기', candidateDirection: '다른 직무로 전환', runway: '3~6개월',
  incomeFloor: '200~350만 원', weeklyTime: '3~5시간', energyLevel: '보통',
  flowMoment: '몰입', mustKeep: ['자율성'],
};

// 8) 제출(답변 완료) 시 저장 → 저장소에서 라운드트립 복구.
store.clear();
store.setItem('career-compass-analytics-session-id', 'sess-answers');
ok('저장 전 답변 없음', mod.readStoredPaidAnswers() === null);
mod.storePaidAnswers(ANSWERS as never);
const restored = mod.readStoredPaidAnswers();
ok('React state 없이도 저장 답변 복구(새로고침 시뮬레이션)', restored !== null && restored!.workStatus === ANSWERS.workStatus);
ok('복구된 mustKeep 배열 보존', Array.isArray(restored!.mustKeep) && restored!.mustKeep[0] === '자율성');

// 9) POST 실패 시나리오: 어떤 자동 경로도 키를 지우지 않는다(clearPaidKeys 호출만이 삭제).
const reqBefore = mod.getOrCreateClientRequestId();
// (POST 실패 = 아무 storage 조작 없음을 정책으로 검증: 재조회에도 값 유지)
ok('POST 실패 후 paidAnswers 유지', mod.readStoredPaidAnswers() !== null);
ok('POST 실패 후 clientRequestId 유지', mod.getOrCreateClientRequestId() === reqBefore);

// 10) 손상된 저장값 — 예외 없이 null.
store.setItem(mod.answersKey(), '{broken json');
ok('비-JSON 손상값 → null(예외 없음)', mod.readStoredPaidAnswers() === null);
store.setItem(mod.answersKey(), '"문자열"');
ok('비객체 값 → null', mod.readStoredPaidAnswers() === null);
store.setItem(mod.answersKey(), JSON.stringify({ workStatus: 'x' })); // mustKeep 누락
ok('mustKeep 비배열(shape 손상) → null', mod.readStoredPaidAnswers() === null);
store.setItem(mod.answersKey(), JSON.stringify([1, 2]));
ok('배열 값 → null', mod.readStoredPaidAnswers() === null);

// 11) '새 분석 시작' → 답변·clientRequestId·jobId 세 키 전부 삭제.
mod.storePaidAnswers(ANSWERS as never);
mod.storeJobId('job-x');
const reqC = mod.getOrCreateClientRequestId();
mod.clearPaidKeys();
ok('clear 후 답변 삭제', mod.readStoredPaidAnswers() === null);
ok('clear 후 jobId 삭제', mod.readStoredJobId() === '');
ok('clear 후 새 clientRequestId', mod.getOrCreateClientRequestId() !== reqC);

// ── newUuid: 모든 폴백 단계에서 RFC 4122 v4 형식 ───────────────────────────
const V4 = /^[0-9a-f]{8}-[0-9a-f]{4}-4[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/;

// 12) randomUUID 경로(Node 전역 crypto).
ok('randomUUID 경로 v4 형식', V4.test(mod.newUuid()));

// 13) randomUUID 없음 → getRandomValues 기반 v4(version/variant bit 검증 포함).
const getRandomValuesOnly = { getRandomValues: (a: Uint8Array) => { for (let i = 0; i < a.length; i++) a[i] = (i * 37 + 11) & 0xff; return a; } };
for (let i = 0; i < 20; i++) ok(`getRandomValues 폴백 v4 형식 #${i}`, V4.test(mod.newUuid({ getRandomValues: (a: Uint8Array) => { for (let j = 0; j < a.length; j++) a[j] = Math.floor(Math.random() * 256); return a; } })));
ok('getRandomValues 폴백(고정 바이트)도 v4 형식', V4.test(mod.newUuid(getRandomValuesOnly)));

// 14) crypto 자체가 없음 → Math.random 최종 폴백도 v4 형식.
for (let i = 0; i < 20; i++) ok(`crypto 부재 최종 폴백 v4 형식 #${i}`, V4.test(mod.newUuid(undefined)));

// 15) randomUUID가 던지는 비정상 환경 → 다음 폴백으로 안전 이행.
ok('randomUUID throw 시 최종 폴백 v4', V4.test(mod.newUuid({ randomUUID: () => { throw new Error('boom'); } })));

// 16) scope 안정성: analytics id가 없으면 stableScopeId가 '생성'해 이후 흐름과 공유한다.
//     (읽기 전용이면 흐름 중간 analytics id 생성 시 scope가 default→uuid로 바뀌어 저장분 소실)
store.clear();
const scope1 = mod.stableScopeId();
ok('id 부재 시 scope 생성(비-default, v4)', scope1 !== 'default' && V4.test(scope1));
ok('생성된 scope가 analytics 키에 저장됨', store.getItem('career-compass-analytics-session-id') === scope1);
ok('재호출 시 동일 scope 유지', mod.stableScopeId() === scope1);
mod.storePaidAnswers(ANSWERS as never);
const reqScoped = mod.getOrCreateClientRequestId();
ok('scope 생성 후 저장한 답변이 같은 scope로 복구됨', mod.readStoredPaidAnswers() !== null);
ok('scope 생성 후 clientRequestId도 같은 scope 유지', mod.getOrCreateClientRequestId() === reqScoped);

console.log(`✓ paidJobSession: ${passed} checks passed`);
