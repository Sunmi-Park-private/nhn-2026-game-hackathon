// engine/race/step.ts — 탭은 속도에 더해지지 않는다. 걸음 하나를 앞에 찍고 몸이 따라간다.
//
// 천천히 누르면 몸이 매번 목표를 따라잡고 멈춰 **뚝뚝 끊기는 걷기**가 되고,
// 빨리 누르면 목표가 계속 달아나 몸이 못 따라잡은 채 **끊김 없는 달리기**가 된다.
// 수식 하나가 둘 다 만든다. 보폭까지 리듬에 비례하므로 「빨리 누를수록 더 빨리」가
// 걸음 수 × 보폭으로 두 번 걸린다.
//
// **spm은 상태가 아니라 파생값이다** — `60 / max(lastGap, sinceTap)`.
// 누르는 중에는 간격이, 손을 떼면 흐른 시간이 분모를 잡는다. 감쇠 상수를 따로 두면
// 그 감쇠가 연타 중에도 깎아 평형이 목표보다 낮게 잡힌다 — 설계 초안이 그랬고,
// 초당 3탭에 4.5가 아니라 3.5 m/s가 나왔다.
import { RACE } from "../../data/race";
import type { RunnerState } from "./types";

const clamp01 = (v: number): number => (v < 0 ? 0 : v > 1 ? 1 : v);

/** 리듬이 죽은 것으로 보는 간격. 분모가 0이 되지 않게 하는 역할도 겸한다. */
const DEAD = RACE.GAP_DEAD;

function spmOf(r: RunnerState): number {
  const gap = Math.max(r.lastGap, r.sinceTap);
  return gap >= DEAD ? 0 : 60 / gap;
}

export function makeRunner(id: string, lane: number): RunnerState {
  return { id, lane, x: 0, targetX: 0, lastGap: DEAD, sinceTap: DEAD, spm: 0, finishedAt: null };
}

/** 지금 리듬에서의 보폭(m). 걷기 보폭과 질주 보폭 사이를 선형으로 오간다. */
export function strideOf(spm: number): number {
  const t = clamp01((spm - RACE.SPM_WALK) / (RACE.SPM_SPRINT - RACE.SPM_WALK));
  return RACE.STRIDE_MIN + (RACE.STRIDE_MAX - RACE.STRIDE_MIN) * t;
}

/**
 * 탭 한 번. `gapSec`은 **초 단위 탭 간격**이다 — 밀리초를 넘기면 리듬이 1000배가 된다.
 * 0 이하는 무시한다. 같은 프레임에 두 번 들어오면 spm이 무한이 되기 때문이다.
 */
export function tapStep(r: RunnerState, gapSec: number): void {
  if (!(gapSec > 0)) return;
  const g = Math.min(gapSec, DEAD);
  // 간격을 평균낸다(spm이 아니라). 손가락 떨림은 걸러지고 리듬 변화는 따라간다.
  // 리듬이 죽어 있었으면 평균 없이 새로 시작한다 — 안 그러면 첫 몇 걸음이 굼뜨다.
  r.lastGap = r.sinceTap >= DEAD ? g : r.lastGap + (g - r.lastGap) * RACE.GAP_SMOOTH;
  r.sinceTap = 0;
  r.spm = spmOf(r);
  r.targetX += strideOf(r.spm);
}

/** 한 프레임. 안 누른 시간이 자라 리듬이 식고, 몸이 목표를 지수로 따라간다. */
export function advance(r: RunnerState, dt: number): void {
  if (dt <= 0) return;
  r.sinceTap += dt;
  r.spm = spmOf(r);
  r.x += (r.targetX - r.x) * (1 - Math.exp(-RACE.CATCHUP * dt));
}

/** 그림이 어떤 상태여야 하는가. 러너 렌더가 이 값만 본다. */
export function animState(spm: number): "idle" | "walk" | "run" | "sprint" {
  if (spm < 20) return "idle";
  if (spm < 120) return "walk";
  if (spm < 220) return "run";
  return "sprint";
}
