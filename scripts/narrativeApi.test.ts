// ADR-001 — zero-cost handler tests. The Anthropic API is stubbed via
// global.fetch, so the full request path (method/key/payload checks → model
// call → output validation → status codes) runs without spending a won.
// Run: node --experimental-strip-types api/narrative.test.ts

import handler, { validateOutput, extractJson } from '../api/narrative.ts';

let passed = 0;
let failed = 0;
function check(name: string, cond: boolean): void {
  if (cond) { passed++; console.log('  PASS  ' + name); }
  else { failed++; console.log('  FAIL  ' + name); }
}

// ─── Fakes ────────────────────────────────────────────────────────────────────

interface FakeRes {
  statusCode: number;
  body: unknown;
  headers: Record<string, string>;
  status(c: number): FakeRes;
  json(b: unknown): void;
  setHeader(k: string, v: string): void;
}
function fakeRes(): FakeRes {
  const r: FakeRes = {
    statusCode: 0,
    body: null,
    headers: {},
    status(c: number) { r.statusCode = c; return r; },
    json(b: unknown) { r.body = b; },
    setHeader(k: string, v: string) { r.headers[k] = v; },
  };
  return r;
}

const GOOD_PAYLOAD = {
  profile: { jobRoleRaw: '마케터' },
  recommendation: {
    currentBestMove: '이직',
    coreExperiment: '짧은 콘텐츠 몇 개를 올려 가볍게 반응 보기',
    confidenceBand: '중간',
    resultMode: 'conditional_led',
  },
  answerHighlights: ['끌리는 역할: 전문가'],
  constructSignals: ['실행 자신감 높음'],
};

const GOOD_OUTPUT = {
  coreInsight: '지금 고민은 방향이 아니라 크기의 문제일 가능성이 높아요.',
  narrative: '그래서 이번 달은 짧은 콘텐츠 몇 개를 올려 가볍게 반응 보기부터 하시면 돼요. 부담을 키우지 않는 크기로 시작하는 게 핵심이에요. 바닥은 이직 준비로 지켜두고요.',
  whyBullets: ['전문가 역할에 끌린다고 답하셔서 후보로 계산됐어요.'],
};

function stubFetch(modelText: string, ok = true, status = 200): void {
  (globalThis as Record<string, unknown>).fetch = async () => ({
    ok,
    status,
    json: async () => ({ content: [{ type: 'text', text: modelText }] }),
  });
}

async function call(payload: unknown, method = 'POST'): Promise<FakeRes> {
  const res = fakeRes();
  await handler({ method, body: payload }, res);
  return res;
}

// ─── extractJson ──────────────────────────────────────────────────────────────

check('extractJson: plain JSON', (extractJson('{"a":1}') as { a: number }).a === 1);
check('extractJson: code-fenced JSON', (extractJson('```json\n{"a":2}\n```') as { a: number }).a === 2);
check('extractJson: JSON with chatter around it',
  (extractJson('결과입니다: {"a":3} 끝.') as { a: number }).a === 3);
check('extractJson: garbage → null', extractJson('완전히 텍스트') === null);

// ─── validateOutput ───────────────────────────────────────────────────────────

const EXP = GOOD_PAYLOAD.recommendation.coreExperiment;
const MOVE = GOOD_PAYLOAD.recommendation.currentBestMove;

check('validate: good output passes', validateOutput(GOOD_OUTPUT, EXP, MOVE));
check('validate: recommendation dropped → fail',
  !validateOutput({ ...GOOD_OUTPUT, narrative: '완전히 다른 이야기를 합니다. 명상을 하세요.' , whyBullets: [], coreInsight: '무관한 통찰' }, EXP, MOVE));
check('validate: 단정어(반드시) → fail',
  !validateOutput({ ...GOOD_OUTPUT, narrative: GOOD_OUTPUT.narrative + ' 반드시 성공합니다.' }, EXP, MOVE));
check('validate: 진단 표현 → fail',
  !validateOutput({ ...GOOD_OUTPUT, coreInsight: '우울증일 가능성이 높아요.' }, EXP, MOVE));
check('validate: coreInsight 과길이 → fail',
  !validateOutput({ ...GOOD_OUTPUT, coreInsight: '아'.repeat(121) }, EXP, MOVE));
check('validate: narrative 과길이 → fail',
  !validateOutput({ ...GOOD_OUTPUT, narrative: '아'.repeat(701) }, EXP, MOVE));
check('validate: whyBullets 5개 → fail',
  !validateOutput({ ...GOOD_OUTPUT, whyBullets: ['a', 'b', 'c', 'd', 'e'] }, EXP, MOVE));
check('validate: 필드 누락 → fail', !validateOutput({ coreInsight: 'x' }, EXP, MOVE));
check('validate: 이직(currentBestMove)만 언급해도 통과 (실험 라벨 누락 허용)',
  validateOutput({ ...GOOD_OUTPUT, narrative: '이번 달은 이직 준비를 바닥에 깔고 가볍게 실험해 보세요.' }, EXP, MOVE));

// ─── handler end-to-end (stubbed model) ──────────────────────────────────────

const main = async (): Promise<void> => {
  process.env.ANTHROPIC_API_KEY = 'test-key';

  let res = await call(GOOD_PAYLOAD, 'GET');
  check('handler: GET → 405', res.statusCode === 405);

  delete process.env.ANTHROPIC_API_KEY;
  res = await call(GOOD_PAYLOAD);
  check('handler: 키 없음 → 503 (클라이언트는 템플릿 유지)', res.statusCode === 503);
  process.env.ANTHROPIC_API_KEY = 'test-key';

  res = await call({ nonsense: true });
  check('handler: 잘못된 페이로드 → 400', res.statusCode === 400);

  stubFetch(JSON.stringify(GOOD_OUTPUT));
  res = await call(GOOD_PAYLOAD);
  check('handler: 정상 경로 → 200 + 파싱된 JSON',
    res.statusCode === 200 && (res.body as { coreInsight: string }).coreInsight === GOOD_OUTPUT.coreInsight);
  check('handler: 동일 답변 캐시 헤더(s-maxage) 설정', res.headers['Cache-Control']?.includes('s-maxage'));

  stubFetch('```json\n' + JSON.stringify(GOOD_OUTPUT) + '\n```');
  res = await call(GOOD_PAYLOAD);
  check('handler: 코드펜스 응답도 200', res.statusCode === 200);

  stubFetch(JSON.stringify({ coreInsight: '추천을 무시한 통찰', narrative: '명상이 답입니다.', whyBullets: [] }));
  res = await call(GOOD_PAYLOAD);
  check('handler: 추천 누락 출력 → 422 (폴백 신호)', res.statusCode === 422);

  stubFetch('JSON이 아닌 헛소리');
  res = await call(GOOD_PAYLOAD);
  check('handler: 파싱 불가 출력 → 422', res.statusCode === 422);

  stubFetch('', false, 529);
  res = await call(GOOD_PAYLOAD);
  check('handler: 업스트림 오류 → 502', res.statusCode === 502);

  console.log(`\n${passed} passed, ${failed} failed`);
  if (failed > 0) throw new Error(`${failed} test(s) failed`);
};

void main();
