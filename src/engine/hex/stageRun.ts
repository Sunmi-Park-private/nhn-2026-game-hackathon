// engine/hex/stageRun.ts — 한 판의 진행. 발사 → 합체 → 낙하 → 구출을 한 번에 묶는다.
import { key } from "./coords";
import { buildCells, cageNeighbors, clearCell, cellAt, isOccupied, placeTile } from "./grid";
import { resolvePops, type PopStep } from "./pop";
import { findFloating } from "./gravity";
import { simulateShot, type BoardGeom } from "./shot";
import { pickNext } from "./nextTile";
import type { Axial, Cage, RunState, StageDef } from "./types";

/** 스테이지 정의로 새 런을 만든다.
 *  `rng`는 발사체 색 추첨에만 쓴다 — 테스트가 고정값을 넣을 수 있도록 주입받는다. */
export function createRun(stage: StageDef, rng: () => number = Math.random): RunState {
  const cells = buildCells(stage);
  return {
    stage,
    cells,
    shotsLeft: stage.shots,
    rescued: [],
    horseshoes: 0,
    boosters: { bomb: 3, rainbow: 2, horseshoe: 1 },
    // 첫 두 발도 판에서 뽑는다 — 판에 없는 색을 장전한 채 시작하지 않는다
    loaded: pickNext(cells, rng),
    next: pickNext(cells, rng),
  };
}

/** 인접이 모두 비었고 아직 구출하지 않은 케이지. */
export function pendingRescues(state: RunState): Cage[] {
  const out: Cage[] = [];
  for (const cage of state.stage.cages) {
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
  steps: PopStep[];
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
  rng: () => number = Math.random,
): ShotOutcome {
  const empty: ShotOutcome = { snapped: null, steps: [], dropped: [], rescued: [] };
  if (state.shotsLeft <= 0) return empty;

  const { snap } = simulateShot(state.cells, geom, from, angleRad);
  if (!snap) return empty;

  state.shotsLeft -= 1;
  placeTile(state.cells, snap, state.loaded);

  const steps = resolvePops(state.cells, snap);
  const { dropped, shoes } = collectDrops(state);
  state.horseshoes += shoes;

  const rescued = applyRescues(state);

  state.loaded = state.next;
  // 합체·낙하가 모두 끝난 뒤의 판에서 뽑는다 — 방금 사라진 색이 장전되지 않게
  state.next = pickNext(state.cells, rng);

  return { snapped: snap, steps, dropped, rescued };
}

/** 낙하 처리. 지우기 전에 셀의 종류를 읽어 말굽을 센다 —
 *  좌표만으로 스테이지 데이터와 대조하면, 이미 회수한 말굽 자리에 나중에 놓인
 *  타일이 떨어질 때 말굽으로 또 세어진다. */
export function collectDrops(state: RunState): { dropped: Axial[]; shoes: number } {
  const floating = findFloating(state.cells);
  let shoes = 0;
  for (const a of floating) {
    if (cellAt(state.cells, a)?.kind === "horseshoe") shoes += 1;
    clearCell(state.cells, a);
  }
  return { dropped: floating, shoes };
}

export function isCleared(state: RunState): boolean {
  return state.rescued.length >= state.stage.objective;
}

export function isFailed(state: RunState): boolean {
  return state.shotsLeft <= 0 && !isCleared(state);
}
