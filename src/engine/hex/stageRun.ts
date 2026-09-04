// engine/hex/stageRun.ts — 한 판의 진행. 발사 → 합체 → 낙하 → 구출을 한 번에 묶는다.
import { key } from "./coords";
import { buildCells, cageNeighbors, isOccupied, placeTile } from "./grid";
import { resolveMerges, type MergeStep } from "./merge";
import { dropFloating } from "./gravity";
import { simulateShot, type BoardGeom } from "./shot";
import type { Axial, Cage, Cell, RunState, StageDef } from "./types";

/** 스테이지 정의로 새 런을 만든다. */
export function createRun(stage: StageDef): RunState {
  return {
    stage,
    cells: buildCells(stage),
    shotsLeft: stage.shots,
    rescued: [],
    horseshoes: 0,
    boosters: { bomb: 3, rainbow: 2, horseshoe: 1 },
    loaded: 0,
    next: 0,
  };
}

/** 인접이 모두 비었고 아직 구출하지 않은 케이지. */
export function pendingRescues(state: RunState): Cage[] {
  const out: Cage[] = [];
  for (const cage of state.stage.cages) {
    if (state.rescued.includes(cage.animalId)) continue;
    // 이미 셀 맵에서 사라진(=구출된) 케이지는 건너뛴다
    if (!cage.cells.some((c) => isOccupied(state.cells, c))) continue;
    const blocked = cageNeighbors(cage).some((n) => isOccupied(state.cells, n));
    if (!blocked) out.push(cage);
  }
  return out;
}

/** 구출을 확정하고 케이지를 셀 맵에서 걷어낸다. */
export function applyRescues(state: RunState): Cage[] {
  const ready = pendingRescues(state);
  for (const cage of ready) {
    for (const c of cage.cells) state.cells.delete(key(c));
    state.rescued.push(cage.animalId);
  }
  return ready;
}

export interface ShotOutcome {
  snapped: Axial | null;
  steps: MergeStep[];
  dropped: Axial[];
  rescued: Cage[];
}

/**
 * 한 발 쏜다. 스냅 → 합체·연쇄 → 낙하 → 구출 판정을 순서대로 해소하고
 * 연출에 필요한 모든 결과를 한 번에 돌려준다.
 */
export function fireAt(
  state: RunState,
  geom: BoardGeom,
  from: { x: number; y: number },
  angleRad: number,
): ShotOutcome {
  const empty: ShotOutcome = { snapped: null, steps: [], dropped: [], rescued: [] };
  if (state.shotsLeft <= 0) return empty;

  const { snap } = simulateShot(state.cells, geom, from, angleRad);
  if (!snap) return empty;

  state.shotsLeft -= 1;
  placeTile(state.cells, snap, state.loaded);

  const steps = resolveMerges(state.cells, snap);
  const dropped = dropFloating(state.cells);

  // 낙하한 말굽을 회수한다 — dropFloating이 지우기 전 종류를 알 수 없으므로
  // 여기서는 좌표만 받고, 말굽 회수는 낙하 직전 스냅샷으로 센다.
  state.horseshoes += countHorseshoes(state, dropped);

  const rescued = applyRescues(state);

  state.loaded = state.next;
  state.next = 0; // 발사체는 항상 최하위 티어

  return { snapped: snap, steps, dropped, rescued };
}

/** dropFloating은 이미 셀을 지웠으므로, 말굽 수는 낙하 목록과
 *  스테이지 정의를 대조해 센다. 스테이지의 말굽 위치는 고정이다. */
function countHorseshoes(state: RunState, dropped: Axial[]): number {
  if (dropped.length === 0) return 0;
  const shoeKeys = new Set(state.stage.horseshoes.map(key));
  return dropped.filter((a) => shoeKeys.has(key(a))).length;
}

export function isCleared(state: RunState): boolean {
  return state.rescued.length >= state.stage.objective;
}

export function isFailed(state: RunState): boolean {
  return state.shotsLeft <= 0 && !isCleared(state);
}
