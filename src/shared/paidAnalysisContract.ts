// Career Compass — 유료 결과지 단일 계약(shared contract).
//
// 프론트와 서버가 '완전히 동일한' canonical 결과 형태를 공유하기 위한 순수 모듈이다.
// 여기에는 타입 + 정규화(normalize) + 검증(validate)만 둔다. API 키·프롬프트·서버
// 전용 로직은 절대 넣지 않는다.
//
// ⚠️ api/paid-analysis.ts는 Vercel 번들 제약(ERR_MODULE_NOT_FOUND) 때문에 src를
//    import할 수 없어, 이 파일의 normalize/validate를 '동일하게 복사'해서 쓴다.
//    둘의 동등성은 paidAnalysisContract.test.ts가 픽스처로 비교해 드리프트를 막는다.
//
// 설계 원칙: Claude는 '내용'을 만들고, normalize가 '구조'를 보장한다. 필드명이 조금
// 다르거나 개수가 모자라도 최대한 canonical로 정규화하고, 정말 본문이 없을 때만 실패로 본다.

export interface TitledItem { title: string; body: string; }

// 30일 실험은 '검증 설계'여야 한다. 구조화 필드로 무엇을·누구에게·어떻게·성공기준을 담는다.
// (렌더/검증 안정성을 위해 body는 항상 채워지며, 구조화 필드는 있으면 함께 표시.)
export interface ExperimentItem {
  title: string;
  body: string;
  hypothesis?: string;    // 무엇을 검증하는가
  target?: string;        // 누구에게
  action?: string;        // 실제로 무엇을 하는가
  successMetric?: string; // 성공 기준
  stopSignal?: string;    // 중단 기준
  whyThisFits?: string;   // 왜 이 사용자에게 맞는가
}

export interface PaidAnalysisResult {
  summaryCard: {
    coreNow: string; biggestRisk: string; dontDo: string; doThis: string; judgeBy: string;
  };
  corePatterns: TitledItem[];         // 3
  blockers: TitledItem[];             // 3
  strengths: TitledItem[];            // 3
  risks: TitledItem[];                // 2~3
  monthlyExperiments: ExperimentItem[]; // 3
  sevenDayPlan: string[];             // 7
  recheckCriteria: string[];          // 3
  finalMessage: string;
}

// ── 코어 코어션 헬퍼 ───────────────────────────────────────────────────────────
function asStr(v: unknown): string {
  if (typeof v === 'string') return v.trim();
  if (typeof v === 'number' && Number.isFinite(v)) return String(v);
  if (Array.isArray(v)) return v.map(asStr).filter(Boolean).join(' ');
  return '';
}
function rec(v: unknown): Record<string, unknown> { return (v && typeof v === 'object') ? v as Record<string, unknown> : {}; }
/** 객체에서 여러 후보 키 중 처음 존재하는 값. (alias 해소) */
function pick(o: Record<string, unknown>, keys: string[]): unknown {
  for (const k of keys) if (o[k] !== undefined && o[k] !== null) return o[k];
  return undefined;
}

/** 임의 값을 {title, body}로. 문자열/여러 필드명/bullets 병합 허용. */
function toTitled(v: unknown): TitledItem | null {
  if (typeof v === 'string') { const b = v.trim(); return b ? { title: '', body: b } : null; }
  if (!v || typeof v !== 'object') return null;
  const o = v as Record<string, unknown>;
  const title = asStr(pick(o, ['title', 'heading', 'name', 'label']));
  let body = asStr(pick(o, ['body', 'text', 'description', 'content', 'interpretation', 'action']));
  const bullets = pick(o, ['bullets', 'items', 'points']);
  if (!body && Array.isArray(bullets)) body = bullets.map(asStr).filter(Boolean).join(' ');
  if (!body && !title) return null;
  return { title, body: body || title };
}

/** 배열을 {title,body}[]로 정규화 후 count에 맞춤. 실데이터 ≥1이면 부족분은 중립 항목으로 채움. */
function normTitledArray(raw: unknown, count: number, pad: TitledItem): TitledItem[] {
  const arr = Array.isArray(raw) ? raw : (raw !== undefined && raw !== null ? [raw] : []);
  const items = arr.map(toTitled).filter((x): x is TitledItem => x !== null);
  if (items.length === 0) return []; // 실데이터 없음 → 검증이 잡아 repair/fallback로.
  const out = items.slice(0, count);
  while (out.length < count) out.push({ ...pad });
  return out;
}

/** 임의 값을 ExperimentItem으로. 구조화 필드 보존 + body 없으면 필드에서 합성. */
function toExperiment(v: unknown): ExperimentItem | null {
  const base = toTitled(v);
  if (typeof v !== 'object' || v === null) return base ? { title: base.title, body: base.body } : null;
  const o = v as Record<string, unknown>;
  const hypothesis = asStr(pick(o, ['hypothesis', 'assumption']));
  const target = asStr(pick(o, ['target', 'who', 'audience']));
  const action = asStr(pick(o, ['action', 'what', 'doWhat']));
  const successMetric = asStr(pick(o, ['successMetric', 'success', 'metric']));
  const stopSignal = asStr(pick(o, ['stopSignal', 'stop', 'abort']));
  const whyThisFits = asStr(pick(o, ['whyThisFits', 'why', 'fit']));
  let body = base?.body ?? '';
  if (!body) {
    body = [action && `무엇: ${action}`, target && `대상: ${target}`, successMetric && `성공 기준: ${successMetric}`]
      .filter(Boolean).join(' · ');
  }
  const title = base?.title ?? '';
  if (!body && !title) return null;
  return { title, body: body || title, hypothesis, target, action, successMetric, stopSignal, whyThisFits };
}
function normExperimentArray(raw: unknown, count: number, pad: ExperimentItem): ExperimentItem[] {
  const arr = Array.isArray(raw) ? raw : (raw !== undefined && raw !== null ? [raw] : []);
  const items = arr.map(toExperiment).filter((x): x is ExperimentItem => x !== null);
  if (items.length === 0) return [];
  const out = items.slice(0, count);
  while (out.length < count) out.push({ ...pad });
  return out;
}

/** 문자열 배열 정규화. 항목이 객체면 body/text로 변환. */
function normStrArray(raw: unknown, count: number, pad: string): string[] {
  const arr = Array.isArray(raw) ? raw : (raw !== undefined && raw !== null ? [raw] : []);
  const items = arr.map((x) => (typeof x === 'string' ? x.trim() : asStr(pick(rec(x), ['body', 'text', 'task', 'day', 'title'])))).filter(Boolean);
  if (items.length === 0) return [];
  const out = items.slice(0, count);
  while (out.length < count) out.push(pad);
  return out;
}

/**
 * Claude가 반환한 임의 JSON을 canonical PaidAnalysisResult로 정규화한다.
 * - alias 필드 허용, 타입 코어션, 개수 보정(실데이터 ≥1일 때만 패딩).
 * - 완전히 비어 있으면 그대로 빈 값 → getValidationErrors가 잡는다.
 */
export function normalizePaidResult(raw: unknown): PaidAnalysisResult {
  const r = rec(raw);
  const scRaw = rec(pick(r, ['summaryCard', 'summary_card', 'summary']));
  const jc = rec(pick(r, ['judgeCriteria', 'judge_criteria']));

  const summaryCard = {
    coreNow: asStr(pick(scRaw, ['coreNow', 'core', 'now', 'coreNowLine'])),
    biggestRisk: asStr(pick(scRaw, ['biggestRisk', 'risk', 'biggest_risk'])),
    dontDo: asStr(pick(scRaw, ['dontDo', 'avoid', 'dont_do', 'notNow'])),
    doThis: asStr(pick(scRaw, ['doThis', 'do', 'thisMonth', 'do_this'])),
    judgeBy: asStr(pick(scRaw, ['judgeBy', 'judge', 'criteria', 'judge_by'])),
  };

  const corePatterns = normTitledArray(pick(r, ['corePatterns', 'patterns', 'coreConflicts', 'sections']), 3,
    { title: '덧붙이는 관점', body: '이 부분은 이어지는 섹션과 함께 보면 더 또렷해져요.' });
  const blockers = normTitledArray(pick(r, ['blockers', 'obstacles', 'blocks']), 3,
    { title: '살펴볼 지점', body: '지금 결정을 늦추는 요인을 한 번 더 점검해볼 여지가 있어요.' });
  const strengths = normTitledArray(pick(r, ['strengths', 'assets', 'transitionAssets']), 3,
    { title: '가진 자산', body: '지금까지 쌓아온 경험을 다른 형태로 이어 쓸 여지가 있어요.' });
  const risks = normTitledArray(pick(r, ['risks', 'realRisks', 'riskMap']), 3,
    { title: '점검할 리스크', body: '수입·시간·상황 조건을 실험 크기에 맞춰 조정해 보세요.' }).slice(0, 3);
  const monthlyExperiments = normExperimentArray(pick(r, ['monthlyExperiments', 'experiments', 'thirtyDayExperiments']), 3,
    { title: '30일 실험', body: '작게 시작해 반응을 확인할 수 있는 실험을 하나 더 열어두세요.' });

  const sevenDayPlan = normStrArray(pick(r, ['sevenDayPlan', 'weekPlan', 'sevenDay', 'dailyPlan']), 7,
    '이번 주에 할 수 있는 작은 한 걸음을 이어가 보세요.');
  const recheckCriteria = normStrArray(pick(r, ['recheckCriteria', 'checks']) ?? pick(jc, ['checks']), 3,
    '한 달 뒤, 이 방향이 나에게 맞았는지 스스로 점검해 보세요.');

  const finalMessage = asStr(pick(r, ['finalMessage', 'closingMessage', 'closing', 'summaryMessage']))
    || asStr(pick(rec(pick(r, ['closing'])), ['body', 'text']));

  return { summaryCard, corePatterns, blockers, strengths, risks, monthlyExperiments, sevenDayPlan, recheckCriteria, finalMessage };
}

// ── 검증 ───────────────────────────────────────────────────────────────────────
const isStr = (v: unknown): v is string => typeof v === 'string' && v.trim().length > 0;
const okTitled = (v: unknown, min: number, max: number): boolean =>
  Array.isArray(v) && v.length >= min && v.length <= max
  && v.every((x) => { const o = x as TitledItem; return !!o && isStr(o.body); });
const okStrArr = (v: unknown, n: number): boolean =>
  Array.isArray(v) && v.length === n && v.every(isStr);

/** 스키마 검증 실패 항목(진단·로깅용). 비어 있으면 유효. */
export function getValidationErrors(o: unknown): string[] {
  const e: string[] = [];
  if (!o || typeof o !== 'object') return ['not_object'];
  const r = o as Record<string, unknown>;
  const sc = r.summaryCard as Record<string, unknown> | undefined;
  // summaryCard는 5필드 중 3개 이상 채워지면 유효로 본다(정규화 이후 최소 보장).
  const scFilled = sc ? [sc.coreNow, sc.biggestRisk, sc.dontDo, sc.doThis, sc.judgeBy].filter(isStr).length : 0;
  if (!sc || scFilled < 3) e.push('summaryCard');
  if (!okTitled(r.corePatterns, 3, 3)) e.push('corePatterns(3)');
  if (!okTitled(r.blockers, 3, 3)) e.push('blockers(3)');
  if (!okTitled(r.strengths, 3, 3)) e.push('strengths(3)');
  if (!okTitled(r.risks, 2, 3)) e.push('risks(2-3)');
  if (!okTitled(r.monthlyExperiments, 3, 3)) e.push('monthlyExperiments(3)');
  if (!okStrArr(r.sevenDayPlan, 7)) e.push('sevenDayPlan(7)');
  if (!okStrArr(r.recheckCriteria, 3)) e.push('recheckCriteria(3)');
  if (!isStr(r.finalMessage)) e.push('finalMessage');
  return e;
}

export function validatePaidAnalysisResult(o: unknown): o is PaidAnalysisResult {
  return getValidationErrors(o).length === 0;
}

// ── raw 콘텐츠 리포트 — 서버가 finalResultSource를 결정하는 데 쓴다(패딩 전 실데이터 양) ──
export interface RawContentReport {
  hasCore: boolean;          // primary를 유지할 만큼 본문이 있는가
  summaryFilled: number;     // 0~5
  realCounts: Record<string, number>;
  hasFinalMessage: boolean;
  defaultedSlots: number;    // 정규화 시 기본값으로 채워야 하는 총 슬롯 수(작을수록 primary 충실)
}
export function rawContentReport(raw: unknown): RawContentReport {
  const r = rec(raw);
  const sc = rec(pick(r, ['summaryCard', 'summary_card', 'summary']));
  const summaryFilled = ['coreNow', 'core', 'now', 'biggestRisk', 'risk', 'dontDo', 'avoid', 'doThis', 'do', 'thisMonth', 'judgeBy', 'judge', 'criteria']
    .reduce((n, k) => (asStr(sc[k]) ? n + 1 : n), 0);
  const realTitled = (v: unknown) => (Array.isArray(v) ? v : []).map(toTitled).filter(Boolean).length;
  const realStr = (v: unknown) => (Array.isArray(v) ? v : []).map((x) => (typeof x === 'string' ? x.trim() : asStr(pick(rec(x), ['body', 'text', 'task', 'day', 'title'])))).filter(Boolean).length;
  const realCounts = {
    corePatterns: realTitled(pick(r, ['corePatterns', 'patterns', 'coreConflicts', 'sections'])),
    blockers: realTitled(pick(r, ['blockers', 'obstacles', 'blocks'])),
    strengths: realTitled(pick(r, ['strengths', 'assets', 'transitionAssets'])),
    risks: realTitled(pick(r, ['risks', 'realRisks', 'riskMap'])),
    monthlyExperiments: realTitled(pick(r, ['monthlyExperiments', 'experiments', 'thirtyDayExperiments'])),
    sevenDayPlan: realStr(pick(r, ['sevenDayPlan', 'weekPlan', 'sevenDay', 'dailyPlan'])),
    recheckCriteria: realStr(pick(r, ['recheckCriteria', 'checks']) ?? pick(rec(pick(r, ['judgeCriteria', 'judge_criteria'])), ['checks'])),
  };
  const hasFinalMessage = !!asStr(pick(r, ['finalMessage', 'closingMessage', 'closing', 'summaryMessage']));
  const need = { corePatterns: 3, blockers: 3, strengths: 3, risks: 2, monthlyExperiments: 3, sevenDayPlan: 7, recheckCriteria: 3 };
  let defaultedSlots = Math.max(0, 3 - Math.min(summaryFilled, 5)) + (hasFinalMessage ? 0 : 1);
  for (const k of Object.keys(need) as (keyof typeof need)[]) defaultedSlots += Math.max(0, need[k] - Math.min(realCounts[k], need[k]));
  const bodyTotal = realCounts.corePatterns + realCounts.blockers + realCounts.strengths + realCounts.risks + realCounts.monthlyExperiments;
  const hasCore = summaryFilled >= 2 && realCounts.corePatterns >= 1 && bodyTotal >= 4;
  return { hasCore, summaryFilled, realCounts, hasFinalMessage, defaultedSlots };
}
