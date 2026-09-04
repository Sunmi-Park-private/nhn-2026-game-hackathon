// engine/hex/gravity.ts — 앵커에서 끊긴 덩어리는 무너져 내린다.
// 앵커 = 천장(r=0)의 타일 + 모든 케이지 셀.
// 케이지가 앵커이므로 케이지 주변 타일은 저절로 떨어지지 않는다 — 난이도의 원천이다.
import { key, parseKey, neighbors } from "./coords";
import type { Axial, Cell } from "./types";

/** 앵커와 연결이 끊긴 타일·말굽 좌표. 케이지 자신은 앵커라 절대 포함되지 않는다. */
export function findFloating(cells: Map<string, Cell>): Axial[] {
  const reached = new Set<string>();
  const queue: Axial[] = [];

  // 앵커 수집
  for (const [k, cell] of cells) {
    const a = parseKey(k);
    if (cell.kind === "cage" || a.r === 0) {
      if (!reached.has(k)) {
        reached.add(k);
        queue.push(a);
      }
    }
  }

  // 점유된 이웃을 따라 전파
  while (queue.length > 0) {
    const cur = queue.shift()!;
    for (const n of neighbors(cur)) {
      const k = key(n);
      if (reached.has(k) || !cells.has(k)) continue;
      reached.add(k);
      queue.push(n);
    }
  }

  const out: Axial[] = [];
  for (const [k, cell] of cells) {
    if (cell.kind === "cage") continue;
    if (!reached.has(k)) out.push(parseKey(k));
  }
  return out;
}

/** 떠 있는 것을 찾아 제거하고, 제거한 좌표를 반환한다. */
export function dropFloating(cells: Map<string, Cell>): Axial[] {
  const floating = findFloating(cells);
  for (const a of floating) cells.delete(key(a));
  return floating;
}
