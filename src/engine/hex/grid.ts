// engine/hex/grid.ts — 셀 맵 조회·배치. 빈 칸은 "키 없음"으로 표현한다.
import { key, inBounds, neighbors } from "./coords";
import type { Axial, Cage, Cell, StageDef, Tier } from "./types";

export function cellAt(cells: Map<string, Cell>, a: Axial): Cell | undefined {
  return cells.get(key(a));
}

export function isOccupied(cells: Map<string, Cell>, a: Axial): boolean {
  return cells.has(key(a));
}

/** 보드 안이면서 비어 있는가. 보드 밖은 "빈 칸"이 아니다 — 발사체가 놓일 수 없다. */
export function isEmpty(cells: Map<string, Cell>, a: Axial, cols: number, rows: number): boolean {
  return inBounds(a, cols, rows) && !cells.has(key(a));
}

export function placeTile(cells: Map<string, Cell>, a: Axial, tier: Tier): void {
  cells.set(key(a), { kind: "tile", tier });
}

export function clearCell(cells: Map<string, Cell>, a: Axial): void {
  cells.delete(key(a));
}

/** 케이지 바깥의 인접 셀. 케이지 자기 셀은 빼고 중복을 제거한다.
 *  구출 판정(이 셀들이 전부 비었는가)의 기준이 된다. */
export function cageNeighbors(cage: Cage): Axial[] {
  const own = new Set(cage.cells.map(key));
  const seen = new Set<string>();
  const out: Axial[] = [];
  for (const c of cage.cells) {
    for (const n of neighbors(c)) {
      const k = key(n);
      if (own.has(k) || seen.has(k)) continue;
      seen.add(k);
      out.push(n);
    }
  }
  return out;
}

/** 스테이지 정의로부터 초기 셀 맵을 만든다. */
export function buildCells(stage: StageDef): Map<string, Cell> {
  const cells = new Map<string, Cell>();
  for (const t of stage.tiles) cells.set(key(t.at), { kind: "tile", tier: t.tier });
  for (const h of stage.horseshoes) cells.set(key(h), { kind: "horseshoe" });
  for (const cage of stage.cages) {
    for (const c of cage.cells) cells.set(key(c), { kind: "cage", cageId: cage.id });
  }
  return cells;
}
