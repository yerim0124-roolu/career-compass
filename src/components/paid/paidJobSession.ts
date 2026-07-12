// Career Compass — 유료 job 제출 idempotency 키 + 새로고침 복구용 jobId/paidAnswers 저장(sessionStorage).
//
// 정책:
//  - 컴포넌트 mount / 새로고침 / 일반 화면 진입에서는 기존 키를 '유지'한다.
//    (POST 성공·QStash publish 성공 후 응답이 유실되고 화면이 재마운트되어도 같은 clientRequestId를
//     재사용해야 서버 UNIQUE 제약이 중복 job/Claude 호출을 막는다.)
//  - paidAnswers는 제출 시점(화면 이동 전)에 저장한다 — React state가 소실(새로고침·탭 재적재)돼도
//    결과 화면이 저장본으로 POST를 이어갈 수 있게. 답변 원문은 로그로 출력하지 않는다.
//  - 저장된 jobId가 있으면 새 job 생성보다 기존 job 복구(GET)를 우선한다.
//  - clearPaidKeys()는 사용자가 '새 분석 시작 / 다시 작성 / 새 리포트 만들기'를 명시적으로 선택한
//    이벤트에서만 호출한다. mount/새로고침/자동 실패 처리에서는 절대 호출하지 않는다.
//
// 스코프: 탭 세션 안정 id(분석 세션 id, 새로고침에도 유지). storage 접근 불가 시 'default'.

import type { PaidAnswers } from './paidTypes.ts';

// paidAnalytics.getSessionId와 같은 키·생성 규칙. 없으면 여기서 '생성'까지 한다 —
//   읽기만 하면 흐름 중간에 analytics가 id를 만들 때 scope가 바뀌어(default → uuid)
//   이미 저장된 답변/clientRequestId/jobId를 다른 키에서 찾게 되는 소실 버그가 생긴다.
const SCOPE_KEY = 'career-compass-analytics-session-id';
export function stableScopeId(): string {
  try {
    let id = window.sessionStorage.getItem(SCOPE_KEY);
    if (!id) { id = newUuid(); window.sessionStorage.setItem(SCOPE_KEY, id); }
    return id;
  } catch { return 'default'; }
}
export const requestKey = (): string => `paid-analysis-request:${stableScopeId()}`;
export const jobKey = (): string => `paid-analysis-job:${stableScopeId()}`;
export const answersKey = (): string => `paid-analysis-answers:${stableScopeId()}`;

// crypto 주입 가능(테스트용). 기본은 전역 crypto.
interface CryptoLike {
  randomUUID?: () => string;
  getRandomValues?: (a: Uint8Array) => Uint8Array;
}

// RFC 4122 UUID v4. 서버의 client_request_id 컬럼이 uuid 타입이라 형식을 반드시 만족해야 한다
//   (비-uuid 문자열은 insert 자체가 22P02로 실패). 폴백 단계 전부 v4 형식 보장:
//   randomUUID → getRandomValues 기반 v4 → Math.random 기반 v4(최후).
export function newUuid(c: CryptoLike | undefined = (globalThis as { crypto?: CryptoLike }).crypto): string {
  try {
    if (c?.randomUUID) return c.randomUUID();
    if (c?.getRandomValues) {
      const b = c.getRandomValues(new Uint8Array(16));
      b[6] = (b[6] & 0x0f) | 0x40; // version 4
      b[8] = (b[8] & 0x3f) | 0x80; // variant 10xx
      const h = Array.from(b, (x) => x.toString(16).padStart(2, '0')).join('');
      return `${h.slice(0, 8)}-${h.slice(8, 12)}-${h.slice(12, 16)}-${h.slice(16, 20)}-${h.slice(20)}`;
    }
  } catch { /* 아래 최종 폴백으로 */ }
  // 최종 폴백: 난수 품질은 낮지만(idempotency 키 용도로 충분) v4 형식은 만족.
  let out = '';
  for (let i = 0; i < 36; i++) {
    if (i === 8 || i === 13 || i === 18 || i === 23) { out += '-'; continue; }
    if (i === 14) { out += '4'; continue; } // version
    const r = Math.floor(Math.random() * 16);
    out += (i === 19 ? ((r & 0x3) | 0x8) : r).toString(16); // i=19: variant
  }
  return out;
}

// 제출 단위 clientRequestId — 이미 있으면 그대로 반환(mount/새로고침/재제출에 안정적으로 유지).
export function getOrCreateClientRequestId(): string {
  try {
    const k = requestKey();
    let id = window.sessionStorage.getItem(k);
    if (!id) { id = newUuid(); window.sessionStorage.setItem(k, id); }
    return id;
  } catch { return newUuid(); }
}

export function readStoredJobId(): string { try { return window.sessionStorage.getItem(jobKey()) || ''; } catch { return ''; } }
export function storeJobId(id: string): void { try { window.sessionStorage.setItem(jobKey(), id); } catch { /* 무시 */ } }

// 제출 답변 저장/복구 — React state 소실(새로고침·탭 재적재·재진입) 대비.
export function storePaidAnswers(answers: PaidAnswers): void {
  try { window.sessionStorage.setItem(answersKey(), JSON.stringify(answers)); } catch { /* 무시 */ }
}
// 손상(비-JSON/비객체/mustKeep 비배열) 시 null — 예외를 밖으로 던지지 않는다.
//   mustKeep 배열은 전송·렌더 경로가 직접 의존하는 최소 shape.
export function readStoredPaidAnswers(): PaidAnswers | null {
  try {
    const raw = window.sessionStorage.getItem(answersKey());
    if (!raw) return null;
    const p = JSON.parse(raw) as PaidAnswers;
    if (!p || typeof p !== 'object' || Array.isArray(p)) return null;
    if (!Array.isArray(p.mustKeep)) return null;
    return p;
  } catch { return null; }
}

// 명시적 '새 분석' 이벤트에서만 호출 — 답변·clientRequestId·jobId를 함께 초기화한다.
export function clearPaidKeys(): void {
  try {
    window.sessionStorage.removeItem(requestKey());
    window.sessionStorage.removeItem(jobKey());
    window.sessionStorage.removeItem(answersKey());
  } catch { /* 무시 */ }
}
