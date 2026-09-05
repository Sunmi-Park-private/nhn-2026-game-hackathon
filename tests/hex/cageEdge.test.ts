import { describe, it, expect } from "vitest";
import { cageAdjacentTiles } from "../../src/engine/hex/cageEdge";
import { key, neighbors } from "../../src/engine/hex/coords";
import type { Axial, Cage, Cell } from "../../src/engine/hex/types";

const tile = (): Cell => ({ kind: "tile", tier: 0 });

function cellsOf(entries: Array<[Axial, Cell]>): Map<string, Cell> {
  const m = new Map<string, Cell>();
  for (const [a, c] of entries) m.set(key(a), c);
  return m;
}

const cage = (cells: Axial[]): Cage => ({ id: "c1", animalId: "rabbit", cells });

describe("cageAdjacentTiles", () => {
  it("케이지가 없으면 아무것도 없다", () => {
    expect(cageAdjacentTiles([], cellsOf([[{ q: 0, r: 0 }, tile()]]))).toEqual([]);
  });

  it("케이지에 맞닿은 타일 칸을 찾는다", () => {
    const c = { q: 3, r: 2 };
    const n = neighbors(c)[0]!;
    const found = cageAdjacentTiles([cage([c])], cellsOf([[n, tile()]]));
    expect(found).toEqual([n]);
  });

  it("맞닿지 않은 타일은 넣지 않는다", () => {
    const c = { q: 0, r: 0 };
    const far = { q: 5, r: 5 };
    expect(cageAdjacentTiles([cage([c])], cellsOf([[far, tile()]]))).toEqual([]);
  });

  it("빈 칸은 넣지 않는다 — 터뜨릴 것이 없다", () => {
    const c = { q: 0, r: 0 };
    expect(cageAdjacentTiles([cage([c])], cellsOf([]))).toEqual([]);
  });

  it("말발굽 칸은 넣지 않는다 — 터뜨리는 것이 아니라 줍는 것이다", () => {
    const c = { q: 0, r: 0 };
    const n = neighbors(c)[0]!;
    const found = cageAdjacentTiles([cage([c])], cellsOf([[n, { kind: "horseshoe" }]]));
    expect(found).toEqual([]);
  });

  it("케이지 자기 짝은 이웃으로 잡히지 않는다", () => {
    // 가로 2셀 케이지. 두 칸 다 셀 맵에는 cage로 들어 있다.
    const a = { q: 2, r: 2 };
    const b = { q: 3, r: 2 };
    const cells = cellsOf([
      [a, { kind: "cage", cageId: "c1" }],
      [b, { kind: "cage", cageId: "c1" }],
    ]);
    expect(cageAdjacentTiles([cage([a, b])], cells)).toEqual([]);
  });

  it("두 칸이 같은 타일에 맞닿아도 한 번만 나온다", () => {
    const a = { q: 2, r: 2 };
    const b = { q: 3, r: 2 };
    // a와 b 양쪽의 이웃인 칸을 찾는다
    const na = new Set(neighbors(a).map(key));
    const shared = neighbors(b).find((n) => na.has(key(n)) && key(n) !== key(a));
    expect(shared).toBeDefined();
    const found = cageAdjacentTiles([cage([a, b])], cellsOf([[shared!, tile()]]));
    expect(found).toHaveLength(1);
  });

  it("케이지가 여럿이면 각각의 둘레를 모두 센다", () => {
    const c1 = { q: 0, r: 0 };
    const c2 = { q: 6, r: 6 };
    const n1 = neighbors(c1)[0]!;
    const n2 = neighbors(c2)[0]!;
    const found = cageAdjacentTiles(
      [cage([c1]), { id: "c2", animalId: "deer", cells: [c2] }],
      cellsOf([[n1, tile()], [n2, tile()]]),
    );
    expect(found.map(key).sort()).toEqual([key(n1), key(n2)].sort());
  });
});
