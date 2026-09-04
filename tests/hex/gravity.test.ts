// tests/hex/gravity.test.ts — 앵커 연결성과 부유 클러스터 낙하
import { describe, it, expect } from "vitest";
import { key } from "../../src/engine/hex/coords";
import { placeTile, cellAt } from "../../src/engine/hex/grid";
import { findFloating, dropFloating } from "../../src/engine/hex/gravity";
import type { Cell, Tier } from "../../src/engine/hex/types";

function makeCells(entries: Array<[number, number, Tier]>): Map<string, Cell> {
  const cells = new Map<string, Cell>();
  for (const [q, r, tier] of entries) placeTile(cells, { q, r }, tier);
  return cells;
}

describe("findFloating", () => {
  it("천장(r=0)에 붙은 타일은 떨어지지 않는다", () => {
    const cells = makeCells([[0, 0, 0]]);
    expect(findFloating(cells)).toEqual([]);
  });

  it("천장에서 이어진 사슬은 전부 남는다", () => {
    const cells = makeCells([[0, 0, 0], [0, 1, 1], [0, 2, 2]]);
    expect(findFloating(cells)).toEqual([]);
  });

  it("천장과 끊긴 타일은 떨어진다", () => {
    const cells = makeCells([[0, 0, 0], [3, 5, 1]]);
    const floating = findFloating(cells).map(key);
    expect(floating).toEqual([key({ q: 3, r: 5 })]);
  });

  it("끊긴 덩어리는 통째로 떨어진다", () => {
    const cells = makeCells([[0, 0, 0], [3, 5, 1], [4, 5, 1], [3, 6, 2]]);
    expect(findFloating(cells)).toHaveLength(3);
  });

  it("케이지는 그 자체가 앵커라 떠 있는 판정을 받지 않는다", () => {
    const cells = new Map<string, Cell>();
    cells.set(key({ q: 3, r: 5 }), { kind: "cage", cageId: "c1" });
    expect(findFloating(cells)).toEqual([]);
  });

  it("케이지에 붙은 타일은 천장과 끊겨도 남는다", () => {
    const cells = makeCells([[3, 4, 0]]);
    cells.set(key({ q: 3, r: 5 }), { kind: "cage", cageId: "c1" });
    // (3,4)는 (3,5)의 이웃이다 — 케이지 앵커에 매달려 있다
    expect(findFloating(cells)).toEqual([]);
  });

  it("말굽도 끊기면 떨어진다", () => {
    const cells = makeCells([[0, 0, 0]]);
    cells.set(key({ q: 4, r: 4 }), { kind: "horseshoe" });
    expect(findFloating(cells).map(key)).toEqual([key({ q: 4, r: 4 })]);
  });
});

describe("dropFloating", () => {
  it("떨어진 칸을 셀 맵에서 지운다", () => {
    const cells = makeCells([[0, 0, 0], [3, 5, 1]]);
    const dropped = dropFloating(cells);
    expect(dropped).toHaveLength(1);
    expect(cellAt(cells, { q: 3, r: 5 })).toBeUndefined();
    expect(cellAt(cells, { q: 0, r: 0 })).toEqual({ kind: "tile", tier: 0 });
  });

  it("떨어질 것이 없으면 빈 배열이다", () => {
    const cells = makeCells([[0, 0, 0]]);
    expect(dropFloating(cells)).toEqual([]);
  });
});
