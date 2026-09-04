// engine/hex/boosters.ts — 부스터 3종.
// 폭탄=분해 · 레인보우=교환 · 말굽=합체 가속.
import { key, neighbors, ring } from "./coords";
import { cellAt } from "./grid";
import { MAX_TIER, type Axial, type Cell, type RunState, type Tier } from "./types";

export type BoosterId = "bomb" | "rainbow" | "horseshoe";

export function hasBooster(state: RunState, id: BoosterId): boolean {
  return state.boosters[id] > 0;
}

export function consume(state: RunState, id: BoosterId): boolean {
  if (!hasBooster(state, id)) return false;
  state.boosters[id] -= 1;
  return true;
}

/** 장전된 발사체를 한 단계 위 색으로 승급시킨다. 아트의 NEXT 노란 육각이 이 상태다. */
export function useHorseshoe(state: RunState): boolean {
  if (state.loaded >= MAX_TIER) return false;
  if (!consume(state, "horseshoe")) return false;
  state.loaded = (state.loaded + 1) as Tier;
  return true;
}

/** 착탄 지점과 반경 1을 날린다. 케이지는 부수지 않는다. */
export function applyBomb(cells: Map<string, Cell>, at: Axial): Axial[] {
  const targets = new Map<string, Axial>();
  targets.set(key(at), at);
  for (const a of ring(at, 1)) targets.set(key(a), a);

  const removed: Axial[] = [];
  for (const [k, a] of targets) {
    const cell = cells.get(k);
    if (!cell || cell.kind === "cage") continue;
    cells.delete(k);
    removed.push(a);
  }
  return removed;
}

/** 레인보우 발사체가 만드는 성분 — 색을 가리지 않고 인접한 타일을 모은다. */
export function rainbowComponent(cells: Map<string, Cell>, at: Axial): Axial[] {
  const start = cellAt(cells, at);
  if (!start || start.kind !== "tile") return [];

  const seen = new Set<string>([key(at)]);
  const out: Axial[] = [at];
  for (const n of neighbors(at)) {
    const k = key(n);
    if (seen.has(k)) continue;
    const c = cells.get(k);
    if (!c || c.kind !== "tile") continue;
    seen.add(k);
    out.push(n);
  }
  return out;
}
