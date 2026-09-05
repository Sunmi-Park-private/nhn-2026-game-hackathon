// engine/race/types.ts — 레이스 상태. Pixi를 모른다(아키텍처 · 단방향 의존).

/** 화면 단계. 한 화면 안에서 이것만 바뀐다. */
export type RacePhase = "roster" | "countdown" | "running" | "result";

/** 트랙 위 한 마리. x는 미터이지 화면 좌표가 아니다. */
export interface RunnerState {
  /** data/animals.ts의 id */
  id: string;
  /** 레인 번호 0~5 — ANIMALS 순서 고정 */
  lane: number;
  /** 현재 위치 (m) */
  x: number;
  /** 걸음이 찍힌 목표 위치 (m). 절대 뒤로 가지 않는다 */
  targetX: number;
  /** 마지막 탭 간격 (s). 리듬의 기준이다 */
  lastGap: number;
  /** 마지막 탭 이후 흐른 시간 (s) */
  sinceTap: number;
  /** 분당 걸음 수 — lastGap과 sinceTap에서 파생된다. 애니메이션 상태도 이 값이 정한다 */
  spm: number;
  /** 결승 통과 시각 (s). 아직이면 null */
  finishedAt: number | null;
}

/** AI 한 마리의 페이스. 시작할 때 rng로 한 번 뽑고 그 뒤로는 시간의 함수다. */
export interface AiPace {
  /** 기본 속도 (m/s) */
  pace: number;
  /** 리듬 변동의 각속도와 위상 */
  w: number;
  phi: number;
}

/** 레이스 한 판. */
export interface RaceState {
  phase: RacePhase;
  /** 시작부터 흐른 시간 (s) */
  t: number;
  /** 내가 조종하는 동물 id. 아직 안 뽑았으면 null */
  myId: string | null;
  runners: RunnerState[];
  /** AI 페이스 — runner id → 값. 내 동물은 키가 없다 */
  ai: Record<string, AiPace>;
}

/** 레이스가 끝나고 화면이 호출자에게 넘기는 것. */
export interface RaceOutcome {
  /** 설정창 HOME으로 나갔으면 "lobby" — 로비가 그 신호를 받아야 한다 */
  exit: "back" | "lobby";
}
