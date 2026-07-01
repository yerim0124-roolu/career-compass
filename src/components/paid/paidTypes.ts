// Career Compass — 유료 심화 문항 답변 타입.
//
// 4스텝(12문항)의 답변을 하나의 객체로 묶는다. 키 이름은 3단계에서 AI
// 프롬프트에 그대로 주입되므로 변경하지 말 것. 값은 각 선택지의 `value`
// (내부 코드값) 또는 자유입력 문자열이다.

export interface PaidAnswers {
  // 스텝 1 — 지금 당신의 상황
  workStatus: string;
  ageGroup: string;
  maritalStatus: string;
  dependents: string;
  // 스텝 2 — 지금 이 고민
  trigger: string; // 자유입력
  candidateDirection: string;
  // 스텝 3 — 현실적인 조건
  runway: string;
  incomeFloor: string;
  weeklyTime: string;
  energyLevel: string;
  // 스텝 4 — 당신에 대해
  flowMoment: string; // 자유입력
  mustKeep: string[]; // 다중 선택(최대 2)
}

/** 선택지 하나. value는 내부 코드값(안정적), label은 화면 표시용. */
export interface PaidOption {
  value: string;
  label: string;
}
