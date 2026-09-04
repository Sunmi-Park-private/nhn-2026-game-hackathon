// engine/hex/pop.ts — 같은 색 타일이 규정 수 이상 붙으면 터진다.
//
// 한때는 「합체」였다 — 셋이 붙으면 착탄 지점에 한 단계 위 색을 남기고 나머지를 지웠다.
// 그러면 3칸이 1칸으로 줄기는 해도 **그 자리가 절대 비지 않는다.** 구출은 케이지 둘레
// 12칸이 전부 비어야 성립하는데, 합체할 때마다 하나가 남으니 빨강→…→황금까지
// 올려 터뜨리는 길 말고는 판을 비울 방법이 없었다. 그래서 승급을 걷어냈다.
// 지금은 색이 곧 등급이 아니라 그냥 서로 다른 색이고, 맞으면 전부 사라진다.
import { key, neighbors } from "./coords";
import { cellAt, clearCell } from "./grid";
import type { Axial, Cell } from "./types";

/** 터지는 최소 개수. 이 수 이상이 붙어야 사라진다. */
export const POP_THRESHOLD = 3;

/** 연출용 단계. UI가 이 목록을 순서대로 재생한다. */
export interface PopStep {
  kind: "pop";
  /** 비워진 칸들 */
  cleared: Axial[];
}

/** start와 같은 색으로 이어진 타일 전부. start가 타일이 아니면 빈 배열. */
export function sameColorComponent(cells: Map<string, Cell>, start: Axial): Axial[] {
  const first = cellAt(cells, start);
  if (!first || first.kind !== "tile") return [];
  const tier = first.tier;

  const seen = new Set<string>([key(start)]);
  const out: Axial[] = [start];
  const queue: Axial[] = [start];

  while (queue.length > 0) {
    const cur = queue.shift()!;
    for (const n of neighbors(cur)) {
      const k = key(n);
      if (seen.has(k)) continue;
      const c = cells.get(k);
      if (!c || c.kind !== "tile" || c.tier !== tier) continue;
      seen.add(k);
      out.push(n);
      queue.push(n);
    }
  }
  return out;
}

/**
 * start를 포함한 같은 색 덩어리가 임계값 이상이면 전부 지운다.
 * `cells`를 제자리에서 수정하고, 연출용 단계 목록을 반환한다.
 *
 * 목록인 이유는 UI가 「지워진 칸들」을 한 덩어리로 재생하기 때문이고,
 * 여기서 나오는 단계는 항상 0개 아니면 1개다 — 타일을 지우기만 하면
 * 새로운 같은 색 인접이 생기지 않으므로 연쇄가 일어날 수 없다.
 * (받침을 잃은 덩어리가 떨어지는 연쇄는 gravity가 따로 맡는다.)
 */
export function resolvePops(cells: Map<string, Cell>, start: Axial): PopStep[] {
  const cell = cellAt(cells, start);
  if (!cell || cell.kind !== "tile") return [];

  const comp = sameColorComponent(cells, start);
  if (comp.length < POP_THRESHOLD) return [];

  const cleared: Axial[] = [];
  for (const c of comp) {
    clearCell(cells, c);
    cleared.push(c);
  }
  return [{ kind: "pop", cleared }];
}
