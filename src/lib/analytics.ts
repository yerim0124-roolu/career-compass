// ─────────────────────────────────────────────────────────────────────────────
// analytics.ts — Career Compass 분석 로깅 (Supabase 전송)
//
// 결과지/플로우 계측. 각 함수는 `quiz_events` 테이블에 한 행을 insert한다.
//   컬럼: session_id (text), event_type ('start'|'progress'|'complete'),
//          question_index (int|null), payload (jsonb)
//
// 전송은 fire-and-forget — insert를 await하지 않고, 실패해도 UX를 막지 않으며
// 에러는 console.error로만 남긴다. dev에서는 console.debug도 함께 찍어 테스트를
// 편하게 한다.
//
// 호출부: src/components/hybridV3/HybridFlowView.tsx
//   logStart()    — 플로우 진입 시 1회
//   logProgress() — 각 문항을 완료하고 다음으로 넘어갈 때
//   logComplete() — 결과(resultContext)가 산출되어 결과지가 뜰 때 1회
// ─────────────────────────────────────────────────────────────────────────────

import { supabase } from './supabase.ts';
import type { FlowResponses, StepResponse2 } from '../components/careerCompassV2/session.ts';
import type { ResultContext } from './resultContextEngine.ts';

const isDev = typeof import.meta !== 'undefined' && !!import.meta.env?.DEV;
const SESSION_KEY = 'career-compass-analytics-session-id';

type EventType = 'start' | 'progress' | 'complete';

/** 브라우저 탭 세션 단위의 익명 ID. sessionStorage에 1회 생성·재사용. */
function getSessionId(): string {
  if (typeof window === 'undefined') return 'ssr';
  try {
    let id = window.sessionStorage.getItem(SESSION_KEY);
    if (!id) {
      id = crypto.randomUUID();
      window.sessionStorage.setItem(SESSION_KEY, id);
    }
    return id;
  } catch {
    // sessionStorage 접근 불가(프라이빗 모드 등) — 휘발성 ID로 대체.
    return crypto.randomUUID();
  }
}

/** quiz_events에 한 행 insert. fire-and-forget — await하지 않는다. */
function send(
  eventType: EventType,
  questionIndex: number | null,
  payload: Record<string, unknown>,
): void {
  if (isDev) {
    // eslint-disable-next-line no-console
    console.debug(`[analytics] ${eventType}`, { questionIndex, payload });
  }
  void supabase
    .from('quiz_events')
    .insert({
      session_id: getSessionId(),
      event_type: eventType,
      question_index: questionIndex,
      payload,
    })
    .then(({ error }) => {
      if (error) {
        // eslint-disable-next-line no-console
        console.error('[analytics] insert failed', error);
      }
    });
}

/** 플로우 시작(컴포넌트 마운트) 시 1회. */
export function logStart(): void {
  send('start', null, {});
}

/** 한 문항을 완료하고 다음 단계로 진행할 때. */
export function logProgress(
  stepIndex: number,
  stepId: string,
  response: StepResponse2 | undefined,
): void {
  send('progress', stepIndex, { step_id: stepId, answer: response });
}

/** 결과지가 산출되어 표시될 때 1회. */
export function logComplete(payload: {
  answers: FlowResponses;
  resultContext: ResultContext;
}): void {
  send('complete', null, {
    answers: payload.answers,
    main_type: payload.resultContext.mainType,
    primary_subtype: payload.resultContext.primarySubtype,
    secondary_subtype: payload.resultContext.secondarySubtype,
    result_context: payload.resultContext,
  });
}
