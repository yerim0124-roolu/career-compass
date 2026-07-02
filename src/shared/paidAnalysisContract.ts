// Career Compass — 유료 결과지 단일 계약(shared contract), narrative report 버전.
//
// 프론트와 서버가 '완전히 동일한' canonical 결과 형태를 공유하는 순수 모듈이다.
// 타입 + 정규화(normalize) + 검증(validate) + rawContentReport만 둔다.
// API 키·프롬프트·서버 전용 로직은 절대 넣지 않는다.
//
// ⚠️ api/paid-analysis.ts는 Vercel 번들 제약으로 이 파일을 import할 수 없어 동일 로직을
//    복사한다. 둘의 동등성은 paidAnalysisContract.test.ts가 픽스처로 비교해 드리프트를 막는다.
//
// 설계: 유료 결과지는 카드형 목록이 아니라 '긴 서사 리포트(narrative report)'다.
//   7개 고정 narrative 섹션 + 구조화된 30일 실험 + 7일 실행 + 재점검 기준으로 구성한다.

export interface NarrativeSection { title: string; body: string; }
export interface ExperimentItem {
  title: string; body: string;
  hypothesis?: string; target?: string; action?: string; successMetric?: string; stopSignal?: string; whyThisFits?: string;
}

export interface PaidAnalysisResult {
  summaryCard: { coreNow: string; biggestRisk: string; dontDo: string; doThis: string; judgeBy: string; };
  currentPosition: NarrativeSection;     // 지금 당신이 멈춰 선 곳
  whyNow: NarrativeSection;              // 왜 하필 지금 이 마음이 왔는지
  innerConflict: NarrativeSection;       // 두 마음의 줄다리기
  riskMap: NarrativeSection;             // 현실 리스크 지도
  transitionAssets: NarrativeSection;    // 당신이 이미 가진 전환 자산
  monthlyExperiment: NarrativeSection & { experiments: ExperimentItem[] }; // 이번 달의 30일 실험 (2~3)
  futureMessage: NarrativeSection;       // 한 달 뒤의 당신에게
  sevenDayPlan: string[];                // 7
  recheckCriteria: string[];             // 3
  ifTwoOrMoreYes: string;
  ifAllNo: string;
}

// 섹션 키 + 기본 제목 + body alias 후보.
export const SECTION_DEFS: Array<{ key: string; title: string; aliases: string[] }> = [
  { key: 'currentPosition', title: '지금 당신이 멈춰 선 곳', aliases: ['currentPosition', 'currentState', 'position', 'nowStanding'] },
  { key: 'whyNow', title: '왜 하필 지금 이 마음이 왔는지', aliases: ['whyNow', 'why', 'whyThisMoment'] },
  { key: 'innerConflict', title: '두 마음의 줄다리기', aliases: ['innerConflict', 'conflict', 'tugOfWar', 'twoMinds'] },
  { key: 'riskMap', title: '현실 리스크 지도', aliases: ['riskMap', 'risks', 'realRisks', 'riskMapSection'] },
  { key: 'transitionAssets', title: '당신이 이미 가진 전환 자산', aliases: ['transitionAssets', 'assets', 'strengths'] },
  { key: 'monthlyExperiment', title: '이번 달의 30일 실험', aliases: ['monthlyExperiment', 'experiment', 'experimentSection'] },
  { key: 'futureMessage', title: '한 달 뒤의 당신에게', aliases: ['futureMessage', 'finalMessage', 'closing', 'closingMessage'] },
];

// ── 코어션 헬퍼 ────────────────────────────────────────────────────────────────
function asStr(v: unknown): string {
  if (typeof v === 'string') return v.trim();
  if (typeof v === 'number' && Number.isFinite(v)) return String(v);
  if (Array.isArray(v)) return v.map(asStr).filter(Boolean).join(' ');
  return '';
}
function rec(v: unknown): Record<string, unknown> { return (v && typeof v === 'object') ? v as Record<string, unknown> : {}; }
function pick(o: Record<string, unknown>, keys: string[]): unknown {
  for (const k of keys) if (o[k] !== undefined && o[k] !== null) return o[k];
  return undefined;
}
function bodyOf(v: unknown): string {
  if (typeof v === 'string') return v.trim();
  const o = rec(v);
  let body = asStr(pick(o, ['body', 'text', 'description', 'content']));
  const bullets = pick(o, ['bullets', 'items', 'points', 'paragraphs']);
  if (Array.isArray(bullets)) body = [body, ...bullets.map(asStr)].filter(Boolean).join(' ');
  return body;
}
function toSection(v: unknown, defaultTitle: string): NarrativeSection {
  const title = asStr(pick(rec(v), ['title', 'heading'])) || defaultTitle;
  return { title, body: bodyOf(v) };
}
function toExperiment(v: unknown): ExperimentItem | null {
  if (typeof v === 'string') { const b = v.trim(); return b ? { title: '', body: b } : null; }
  if (!v || typeof v !== 'object') return null;
  const o = v as Record<string, unknown>;
  const title = asStr(pick(o, ['title', 'heading', 'name']));
  const hypothesis = asStr(pick(o, ['hypothesis', 'assumption']));
  const target = asStr(pick(o, ['target', 'who', 'audience']));
  const action = asStr(pick(o, ['action', 'what', 'doWhat']));
  const successMetric = asStr(pick(o, ['successMetric', 'success', 'metric']));
  const stopSignal = asStr(pick(o, ['stopSignal', 'stop', 'abort']));
  const whyThisFits = asStr(pick(o, ['whyThisFits', 'why', 'fit']));
  let body = bodyOf(o);
  if (!body) body = [action && `무엇: ${action}`, target && `대상: ${target}`, successMetric && `성공 기준: ${successMetric}`].filter(Boolean).join(' · ');
  if (!body && !title) return null;
  return { title, body: body || title, hypothesis, target, action, successMetric, stopSignal, whyThisFits };
}
function normExperiments(raw: unknown, pad: ExperimentItem): ExperimentItem[] {
  const arr = Array.isArray(raw) ? raw : (raw !== undefined && raw !== null ? [raw] : []);
  const items = arr.map(toExperiment).filter((x): x is ExperimentItem => x !== null);
  if (items.length === 0) return [];
  const out = items.slice(0, 3);
  while (out.length < 2) out.push({ ...pad });
  return out;
}
function normStrArray(raw: unknown, count: number, pad: string): string[] {
  const arr = Array.isArray(raw) ? raw : (raw !== undefined && raw !== null ? [raw] : []);
  const items = arr.map((x) => (typeof x === 'string' ? x.trim() : asStr(pick(rec(x), ['body', 'text', 'task', 'day', 'title'])))).filter(Boolean);
  if (items.length === 0) return [];
  const out = items.slice(0, count);
  while (out.length < count) out.push(pad);
  return out;
}

const SECTION_PAD: Record<string, string> = {
  currentPosition: '지금 서 있는 지점을 이어지는 섹션과 함께 보면 더 또렷해져요.',
  whyNow: '왜 지금인지는 이어지는 리스크·자산 섹션과 함께 읽어 주세요.',
  innerConflict: '두 방향 사이의 줄다리기는 아래 리스크·자산 섹션에서 이어집니다.',
  riskMap: '현실 조건은 실험 크기를 정하는 기준으로 이어집니다.',
  transitionAssets: '지금까지 쌓아온 것은 다른 형태로 이어 쓸 수 있는 자산이에요.',
  monthlyExperiment: '이번 달은 돈에 가까운 반응을 확인하는 작은 검증부터 시작해 보세요.',
  futureMessage: '한 달 뒤의 당신에게, 지금의 한 걸음이 방향을 좁혀줄 거예요.',
};

export function normalizePaidResult(raw: unknown): PaidAnalysisResult {
  const r = rec(raw);
  const ns = rec(pick(r, ['narrativeSections', 'sections']));
  const scRaw = rec(pick(r, ['summaryCard', 'summary_card', 'summary']));
  const jc = rec(pick(r, ['judgeCriteria', 'judge_criteria']));

  const summaryCard = {
    coreNow: asStr(pick(scRaw, ['coreNow', 'core', 'now'])),
    biggestRisk: asStr(pick(scRaw, ['biggestRisk', 'risk', 'biggest_risk'])),
    dontDo: asStr(pick(scRaw, ['dontDo', 'avoid', 'dont_do'])),
    doThis: asStr(pick(scRaw, ['doThis', 'do', 'thisMonth'])),
    judgeBy: asStr(pick(scRaw, ['judgeBy', 'judge', 'criteria'])),
  };

  const sec = (def: { key: string; title: string; aliases: string[] }): NarrativeSection => {
    const v = pick(r, def.aliases) ?? pick(ns, def.aliases);
    const s = toSection(v, def.title);
    return { title: s.title, body: s.body || SECTION_PAD[def.key] };
  };
  const bySec = Object.fromEntries(SECTION_DEFS.map((d) => [d.key, sec(d)])) as Record<string, NarrativeSection>;

  const meRaw = pick(r, ['monthlyExperiment', 'experiment', 'experimentSection']) ?? pick(ns, ['monthlyExperiment', 'experiment']);
  const experiments = normExperiments(
    pick(rec(meRaw), ['experiments', 'items']) ?? pick(r, ['experiments', 'monthlyExperiments']),
    { title: '30일 검증 실험', body: '돈에 가까운 반응(문의·상담·소액 결제)을 확인하는 작은 제안을 한 가지 열어두세요.', hypothesis: '이 방향에 돈을 낼 사람이 있는가', target: '실제 구매 가능성이 있는 구체 집단', action: '구매의사·상담·소액 결제를 유도하는 제안', successMetric: 'DM·상담 요청·소액 결제·이메일 확보', stopSignal: '돈에 가까운 반응이 전혀 없으면 대상/제안 교체', whyThisFits: '수입 공백과 버틸 기간을 고려한 저리스크 검증이라서' },
  );

  const sevenDayPlan = normStrArray(pick(r, ['sevenDayPlan', 'weekPlan', 'sevenDay']), 7, '이번 주 검증 루프의 한 단계를 이어가 보세요.');
  const recheckCriteria = normStrArray(pick(r, ['recheckCriteria', 'checks']) ?? pick(jc, ['checks']), 3, '돈에 가까운 반응이 나왔는지 스스로 점검해 보세요.');
  const ifTwoOrMoreYes = asStr(pick(r, ['ifTwoOrMoreYes', 'ifYes'])) || asStr(pick(jc, ['ifYes'])) || '그 경우에는 그 방향을 다음 30일에 조금 더 키워 실제 수익 가능성을 확인해 보세요.';
  const ifAllNo = asStr(pick(r, ['ifAllNo', 'ifNo'])) || asStr(pick(jc, ['ifNo'])) || '그 경우에는 전환을 서두르기보다, 대상·제안을 바꾸거나 잠시 회복·역할 재설계를 먼저 두세요.';

  return {
    summaryCard,
    currentPosition: bySec.currentPosition, whyNow: bySec.whyNow, innerConflict: bySec.innerConflict,
    riskMap: bySec.riskMap, transitionAssets: bySec.transitionAssets,
    monthlyExperiment: { title: bySec.monthlyExperiment.title, body: bySec.monthlyExperiment.body, experiments },
    futureMessage: bySec.futureMessage,
    sevenDayPlan, recheckCriteria, ifTwoOrMoreYes, ifAllNo,
  };
}

// ── 검증 ───────────────────────────────────────────────────────────────────────
const isStr = (v: unknown): v is string => typeof v === 'string' && v.trim().length > 0;
const okSection = (v: unknown): boolean => { const o = v as NarrativeSection; return !!o && isStr(o.body); };
const okStrArr = (v: unknown, n: number): boolean => Array.isArray(v) && v.length === n && v.every(isStr);

export function getValidationErrors(o: unknown): string[] {
  const e: string[] = [];
  if (!o || typeof o !== 'object') return ['not_object'];
  const r = o as Record<string, unknown>;
  const sc = r.summaryCard as Record<string, unknown> | undefined;
  const scFilled = sc ? [sc.coreNow, sc.biggestRisk, sc.dontDo, sc.doThis, sc.judgeBy].filter(isStr).length : 0;
  if (!sc || scFilled < 3) e.push('summaryCard');
  for (const key of ['currentPosition', 'whyNow', 'innerConflict', 'riskMap', 'transitionAssets', 'futureMessage']) {
    if (!okSection(r[key])) e.push(key);
  }
  const me = r.monthlyExperiment as Record<string, unknown> | undefined;
  if (!me || !isStr(me.body)) e.push('monthlyExperiment');
  else if (!Array.isArray(me.experiments) || me.experiments.length < 2 || me.experiments.length > 3 || !me.experiments.every((x) => isStr((x as ExperimentItem)?.body))) e.push('monthlyExperiment.experiments(2-3)');
  if (!okStrArr(r.sevenDayPlan, 7)) e.push('sevenDayPlan(7)');
  if (!okStrArr(r.recheckCriteria, 3)) e.push('recheckCriteria(3)');
  if (!isStr(r.ifTwoOrMoreYes)) e.push('ifTwoOrMoreYes');
  if (!isStr(r.ifAllNo)) e.push('ifAllNo');
  return e;
}
export function validatePaidAnalysisResult(o: unknown): o is PaidAnalysisResult {
  return getValidationErrors(o).length === 0;
}

// ── raw 콘텐츠 리포트 — 서버가 finalResultSource를 결정하는 데 쓴다 ──
export interface RawContentReport {
  hasCore: boolean; summaryFilled: number; sectionsWithBody: number; experimentCount: number;
  sevenDayCount: number; defaultedSlots: number;
}
export function rawContentReport(raw: unknown): RawContentReport {
  const r = rec(raw);
  const ns = rec(pick(r, ['narrativeSections', 'sections']));
  const sc = rec(pick(r, ['summaryCard', 'summary_card', 'summary']));
  const summaryFilled = ['coreNow', 'core', 'now', 'biggestRisk', 'risk', 'dontDo', 'avoid', 'doThis', 'do', 'judgeBy', 'judge']
    .reduce((n, k) => (asStr(sc[k]) ? n + 1 : n), 0);
  let sectionsWithBody = 0;
  for (const def of SECTION_DEFS) {
    const v = pick(r, def.aliases) ?? pick(ns, def.aliases);
    if (bodyOf(v)) sectionsWithBody += 1;
  }
  const meRaw = pick(r, ['monthlyExperiment', 'experiment']) ?? pick(ns, ['monthlyExperiment', 'experiment']);
  const expArr = pick(rec(meRaw), ['experiments', 'items']) ?? pick(r, ['experiments', 'monthlyExperiments']);
  const experimentCount = (Array.isArray(expArr) ? expArr : []).map(toExperiment).filter(Boolean).length;
  const sevenDayCount = (Array.isArray(pick(r, ['sevenDayPlan', 'weekPlan'])) ? (pick(r, ['sevenDayPlan', 'weekPlan']) as unknown[]) : []).filter(Boolean).length;
  const defaultedSlots = Math.max(0, 3 - Math.min(summaryFilled, 5)) + Math.max(0, 7 - sectionsWithBody)
    + Math.max(0, 2 - Math.min(experimentCount, 2)) + Math.max(0, 7 - Math.min(sevenDayCount, 7));
  const hasCore = summaryFilled >= 2 && sectionsWithBody >= 3;
  return { hasCore, summaryFilled, sectionsWithBody, experimentCount, sevenDayCount, defaultedSlots };
}
