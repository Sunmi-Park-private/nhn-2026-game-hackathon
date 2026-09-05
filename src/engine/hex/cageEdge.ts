// engine/hex/cageEdge.ts — 케이지에 맞닿은 타일 칸을 찾는다. 순수 TS다.
//
// 「케이지 옆을 터뜨려라」는 말만으로는 어디를 노려야 하는지 안 보인다. 첫 판에서는
// 그 칸에 금을 그어 눈으로 보여 준다 — 그 자리를 여기가 정하고, 그리는 일은
// ui/hex/cageCracks.ts가 한다.
//
// 케이지 칸 자체는 뺀다. 케이지는 가로 2셀을 차지하므로 자기 짝이 이웃으로 잡힌다.
import { key, neighbors } from "./coords";
import type { Axial, Cage, Cell } from "./types";

/**
 * 케이지에 맞닿아 있으면서 타일이 놓인 칸. 중복 없이 돌려준다.
 *
 * 말발굽 칸(`kind: "horseshoe"`)은 넣지 않는다 — 터뜨릴 수 있는 것이 아니라 주워야
 * 하는 것이라, 금이 그어져 있으면 「저기를 쏴라」로 잘못 읽힌다.
 */
export function cageAdjacentTiles(cages: Cage[], cells: Map<string, Cell>): Axial[] {
  const cageKeys = new Set<string>();
  for (const cage of cages) {
    for (const c of cage.cells) cageKeys.add(key(c));
  }

  const seen = new Set<string>();
  const out: Axial[] = [];
  for (const cage of cages) {
    for (const c of cage.cells) {
      for (const n of neighbors(c)) {
        const k = key(n);
        if (cageKeys.has(k) || seen.has(k)) continue;
        const cell = cells.get(k);
        if (!cell || cell.kind !== "tile") continue;
        seen.add(k);
        out.push(n);
      }
    }
  }
  return out;
}
