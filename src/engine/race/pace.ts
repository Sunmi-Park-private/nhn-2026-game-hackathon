// engine/race/pace.ts — AI 5마리의 페이스.
//
// 변동이 있어야 중반에 순위가 뒤집히고, 막판 스퍼트가 있어야 결승선 앞이 조마조마하다.
// 둘 다 없으면 6마리가 출발 순서대로 들어와 화면이 죽는다.
//
// **보상 조건은 순위가 아니라 내 기록의 갱신이다.** 그래서 여기 상수를 잘못 잡아도
// 보상 규칙은 안 깨진다 — 밸런싱을 마지막으로 미룰 수 있다.
import { RACE } from "../../data/race";
import type { AiPace, RunnerState } from "./types";

const TAU = Math.PI * 2;

/** 시작할 때 한 번 뽑는다. rng를 정확히 3번 당긴다 — 테스트가 수열로 고정한다. */
export function makeAiPace(rng: () => number): AiPace {
  return {
    pace: RACE.PACE_MIN + rng() * (RACE.PACE_MAX - RACE.PACE_MIN),
    w: 0.7 + rng() * 0.8,
    phi: rng() * TAU,
  };
}

/** 진행률 p(0~1)에서의 속도(m/s). 0.8을 넘어서면 스퍼트가 붙는다. */
export function aiSpeed(p: AiPace, t: number, progress: number): number {
  const wobble = 1 + RACE.WOBBLE * Math.sin(p.w * t + p.phi);
  const spurt = progress < 0.8 ? 1 : 1 + RACE.SPURT * ((progress - 0.8) / 0.2);
  // WOBBLE < 1이라 wobble은 항상 양수다 — 뒤로 가는 일이 없다
  return p.pace * wobble * spurt;
}

/** 한 프레임. 진행률은 러너의 현재 위치에서 스스로 낸다. */
export function advanceAi(r: RunnerState, p: AiPace, t: number, dt: number): void {
  if (dt <= 0) return;
  const progress = Math.min(1, r.x / RACE.DISTANCE);
  r.x += aiSpeed(p, t, progress) * dt;
  // AI는 걸음 개념이 없다 — 렌더가 두 필드를 구분하지 않아도 되게 맞춰 둔다
  r.targetX = r.x;
}
