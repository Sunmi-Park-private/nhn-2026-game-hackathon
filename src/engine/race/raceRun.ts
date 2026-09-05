// engine/race/raceRun.ts — 레이스 한 판. 뽑기 → 카운트다운 → 주행 → 순위.
//
// 단계는 상태 하나가 들고 있고 시간이 밀어 준다. 화면은 이 상태를 그리기만 한다.
import { RACE } from "../../data/race";
import { advanceAi, makeAiPace } from "./pace";
import { advance, makeRunner, tapStep } from "./step";
import type { AiPace, RaceState, RunnerState } from "./types";

/**
 * 달릴 동물을 뽑는다. 구출한 동물에 가중치를 준다 —
 * 아무도 못 구했으면 전체가 같은 무게라 6종 전부가 후보가 된다.
 */
export function pickAnimal(
  ids: readonly string[],
  rescued: readonly string[],
  rng: () => number = Math.random,
): string {
  const has = new Set(rescued);
  const weights = ids.map((id) => (has.has(id) ? RACE.PICK_WEIGHT.rescued : RACE.PICK_WEIGHT.locked));
  const total = weights.reduce((a, b) => a + b, 0);
  let hit = rng() * total;
  for (let i = 0; i < ids.length; i++) {
    hit -= weights[i]!;
    if (hit < 0) return ids[i]!;
  }
  return ids[ids.length - 1]!; // rng가 1을 돌려줘도 빈손으로 나가지 않는다
}

/** 6마리를 레인에 세우고 AI 5마리의 페이스를 뽑는다. */
export function createRace(ids: readonly string[], myId: string, rng: () => number = Math.random): RaceState {
  const runners = ids.map((id, lane) => makeRunner(id, lane));
  const ai: Record<string, AiPace> = {};
  for (const id of ids) if (id !== myId) ai[id] = makeAiPace(rng);
  return { phase: "countdown", t: 0, myId, runners, ai };
}

/** 이미 결승을 넘었나. 넘은 러너는 더 움직이지 않는다. */
const done = (r: RunnerState): boolean => r.finishedAt !== null;

/** 결승선에 정확히 세운다 — 넘어간 자리에 두면 화면이 결승선 밖에 그린다. */
function finishIfDue(r: RunnerState, raceT: number): void {
  if (!done(r) && r.x >= RACE.DISTANCE) {
    r.x = RACE.DISTANCE;
    r.targetX = RACE.DISTANCE;
    r.finishedAt = raceT;
  }
}

/** 한 프레임. 카운트다운이 끝나기 전에는 아무도 안 움직인다. */
export function tickRace(s: RaceState, dt: number): void {
  if (dt <= 0 || s.phase === "result" || s.phase === "roster") return;
  s.t += dt;

  if (s.phase === "countdown") {
    if (s.t >= RACE.COUNTDOWN) s.phase = "running";
    return;
  }

  // 기록은 출발 신호부터 잰다 — 카운트다운이 섞이면 기록이 늘 1.8초 무겁다
  const raceT = s.t - RACE.COUNTDOWN;
  for (const r of s.runners) {
    if (done(r)) continue;
    const p = s.ai[r.id];
    if (p) advanceAi(r, p, raceT, dt);
    else advance(r, dt);
    finishIfDue(r, raceT);
  }
  if (s.runners.every(done)) s.phase = "result";
}

/** 내 동물의 걸음 한 번. running이 아니면 무시한다 — 부정 출발이 없다. */
export function tapRace(s: RaceState, gapSec: number): void {
  if (s.phase !== "running" || s.myId === null) return;
  const me = s.runners.find((r) => r.id === s.myId);
  if (!me || done(me)) return;
  tapStep(me, gapSec);
}

export function isRaceOver(s: RaceState): boolean {
  return s.runners.every(done);
}

/** 결승 통과 순. 아직 못 들어온 러너는 뒤로 간다. */
export function ranking(s: RaceState): RunnerState[] {
  return [...s.runners].sort((a, b) => (a.finishedAt ?? Infinity) - (b.finishedAt ?? Infinity));
}

/** 내 기록(초). 아직 못 들어왔으면 null. */
export function myTime(s: RaceState): number | null {
  return s.runners.find((r) => r.id === s.myId)?.finishedAt ?? null;
}
