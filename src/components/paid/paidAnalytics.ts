// Career Compass — 유료 퍼널 수요 측정 이벤트.
//
// 기존 src/lib/analytics.ts / supabase.ts 를 '읽어서 재사용'한다(둘 다 수정하지
// 않음). analytics.ts와 동일한 방식으로 같은 `quiz_events` 테이블에 insert하며,
// event_type 문자열만 새로 추가한다(스키마 변경 없음). 세션 ID도 analytics.ts와
// 동일한 sessionStorage 키를 공유해, 무료→유료 퍼널이 한 세션으로 이어진다.
//
// 남기는 이벤트:
//   'paid_preview_viewed'   — 미리보기 화면 진입 시
//   'paid_checkout_clicked' — "결제하고 전체 받기" 클릭 시  ← 결제 의향 핵심 지표

import { supabase } from '../../lib/supabase.ts';

const isDev = typeof import.meta !== 'undefined' && !!import.meta.env?.DEV;
// analytics.ts와 동일한 키 — 같은 익명 세션 ID를 공유한다.
const SESSION_KEY = 'career-compass-analytics-session-id';

type PaidEventType = 'paid_preview_viewed' | 'paid_checkout_clicked';

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
    return crypto.randomUUID();
  }
}

/** quiz_events에 한 행 insert. fire-and-forget — await하지 않는다. */
function send(eventType: PaidEventType, payload: Record<string, unknown> = {}): void {
  if (isDev) {
    // eslint-disable-next-line no-console
    console.debug(`[analytics] ${eventType}`, payload);
  }
  void supabase
    .from('quiz_events')
    .insert({
      session_id: getSessionId(),
      event_type: eventType,
      question_index: null,
      payload,
    })
    .then(({ error }) => {
      if (error) {
        // eslint-disable-next-line no-console
        console.error('[analytics] insert failed', error);
      }
    });
}

/** 미리보기 화면 진입 시 1회. */
export function logPaidPreviewViewed(): void {
  send('paid_preview_viewed');
}

/** "결제하고 전체 받기" 클릭 시. */
export function logPaidCheckoutClicked(): void {
  send('paid_checkout_clicked');
}
