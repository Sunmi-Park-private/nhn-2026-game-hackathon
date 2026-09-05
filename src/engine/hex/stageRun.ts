// engine/hex/stageRun.ts — 한 판의 진행. 발사 → 합체 → 낙하 → 구출을 한 번에 묶는다.
import { key } from "./coords";
import { buildCells, cageNeighbors, clearCell, cellAt, isOccupied, placeTile } from "./grid";
import { resolvePops, type PopStep } from "./pop";
import { findFloating } from "./gravity";
import { simulateShot, type BoardGeom } from "./shot";
import { pickNext } from "./nextTile";
import { cageProgress, isUnlocked } from "./cageFaces";
import type { Axial, Boosters, Cage, RunState, StageDef } from "./types";

/** 스테이지 정의로 새 런을 만든다.
 *  `rng`는 발사체 색 추첨에만 쓴다 — 테스트가 고정값을 넣을 수 있도록 주입받는다.
 *  `stock`은 이 판에 실을 부스터다. 기본값이 지금까지의 하드코딩 값이라
 *  안 넘기는 호출부는 그대로 동작한다. */
export function createRun(
  stage: StageDef,
  rng: () => number = Math.random,
  stock: Boosters = { bomb: 3, rainbow: 2, horseshoe: 1 },
): RunState {
  const cells = buildCells(stage);
  return {
    stage,
    cells,
    shotsLeft: stage.shots,
    rescued: [],
    horseshoes: 0,
    // 복사한다 — 판이 부스터를 쓸 때 호출부(프로필)의 객체를 깎으면 안 된다
    boosters: { ...stock },
    // 첫 두 발도 판에서 뽑는다 — 판에 없는 색을 장전한 채 시작하지 않는다
    loaded: pickNext(cells, rng),
    next: pickNext(cells, rng),
  };
}

/** 잠금이 풀렸고 아직 구출하지 않은 케이지.
 *
 *  둘레 6면 중 **상단을 뺀 5면**이 비면 열린다. 상단을 빼는 이유는 조준으로
 *  닿지 않기 때문이다 — 발사대가 판 아래에 있어서 케이지 위쪽 칸에 가려면
 *  케이지를 통과해야 하는데, 케이지가 발사체를 막는다(cageFaces.ts 참조).
 *
 *  6면 구조를 만들 수 없는 케이지(한 칸짜리·일자형)는 예전 규칙 그대로
 *  **둘레가 전부 비어야** 열린다. */
export function pendingRescues(state: RunState): Cage[] {
  const out: Cage[] = [];
  for (const cage of state.stage.cages) {
    // 이미 셀 맵에서 사라진(=구출된) 케이지는 건너뛴다
    if (!cage.cells.some((c) => isOccupied(state.cells, c))) continue;

    if (cageProgress(state.cells, cage).fallback) {
      const blocked = cageNeighbors(cage).some((n) => isOccupied(state.cells, n));
      if (!blocked) out.push(cage);
      continue;
    }
    if (isUnlocked(state.cells, cage)) out.push(cage);
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
  /** 판에 닿지 못하고 떨어졌다. 한 발은 소모된다 */
  missed: boolean;
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
  power = 1,
  rng: () => number = Math.random,
): ShotOutcome {
  const empty: ShotOutcome = { snapped: null, steps: [], dropped: [], rescued: [], missed: false };
  if (state.shotsLeft <= 0) return empty;

  const { snap, missed } = simulateShot(state.cells, geom, from, angleRad, power);
  if (!snap) {
    // 헛발도 대가를 치른다 — 한 발을 깎고 **장전까지 넘긴다**.
    // 같은 타일이 손에 남아 있으면 「소모했다」가 화면에서 읽히지 않는다.
    if (!missed) return empty; // 스냅도 헛발도 아닌 경우(발사 지점이 막힘) — 판이 안 움직인다
    state.shotsLeft -= 1;
    state.loaded = state.next;
    state.next = pickNext(state.cells, rng);
    return { ...empty, missed: true };
  }

  state.shotsLeft -= 1;
  placeTile(state.cells, snap, state.loaded);

  const steps = resolvePops(state.cells, snap);
  const { dropped, shoes } = collectDrops(state);
  state.horseshoes += shoes;

  const rescued = applyRescues(state);
  if (rescued.length > 0) {
    // 케이지는 앵커다. 사라지면 그 앵커에만 매달려 있던 타일 —
    // 규칙에서 빠져 있던 상단 면이 대표적이다 — 이 받침을 잃는다.
    // 다음 발사까지 공중에 떠 있지 않도록 지금 떨군다.
    const after = collectDrops(state);
    dropped.push(...after.dropped);
    state.horseshoes += after.shoes;
  }

  state.loaded = state.next;
  // 합체·낙하가 모두 끝난 뒤의 판에서 뽑는다 — 방금 사라진 색이 장전되지 않게
  state.next = pickNext(state.cells, rng);

  return { snapped: snap, steps, dropped, rescued, missed: false };
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
