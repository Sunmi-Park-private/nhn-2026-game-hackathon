// tests/hex/pop.test.ts — 같은 색 덩어리가 터지는 규칙
import { describe, it, expect } from "vitest";
import { key } from "../../src/engine/hex/coords";
import { placeTile } from "../../src/engine/hex/grid";
import { sameColorComponent, resolvePops, POP_THRESHOLD } from "../../src/engine/hex/pop";
import type { Cell, Tier } from "../../src/engine/hex/types";

/** 좌표-색 쌍으로 셀 맵을 만든다. */
function makeCells(entries: Array<[number, number, Tier]>): Map<string, Cell> {
  const cells = new Map<string, Cell>();
  for (const [q, r, tier] of entries) placeTile(cells, { q, r }, tier);
  return cells;
}

describe("sameColorComponent", () => {
  it("혼자면 자기 자신만", () => {
    const cells = makeCells([[0, 0, 0]]);
    expect(sameColorComponent(cells, { q: 0, r: 0 })).toHaveLength(1);
  });

  it("이어진 같은 색을 전부 모은다", () => {
    const cells = makeCells([[0, 0, 0], [1, 0, 0], [0, 1, 0]]);
    expect(sameColorComponent(cells, { q: 0, r: 0 })).toHaveLength(3);
  });

  it("다른 색은 건너뛴다", () => {
    const cells = makeCells([[0, 0, 0], [1, 0, 1], [0, 1, 2]]);
    expect(sameColorComponent(cells, { q: 0, r: 0 })).toHaveLength(1);
  });

  it("떨어져 있으면 잇지 않는다", () => {
    const cells = makeCells([[0, 0, 0], [3, 0, 0]]);
    expect(sameColorComponent(cells, { q: 0, r: 0 })).toHaveLength(1);
  });

  it("빈 칸에서 시작하면 빈 배열", () => {
    expect(sameColorComponent(makeCells([]), { q: 0, r: 0 })).toEqual([]);
  });

  it("케이지와 말굽은 색이 없으므로 잇지 않는다", () => {
    const cells = makeCells([[0, 0, 0]]);
    cells.set(key({ q: 1, r: 0 }), { kind: "cage", cageId: "c1" });
    cells.set(key({ q: 0, r: 1 }), { kind: "horseshoe" });
    expect(sameColorComponent(cells, { q: 0, r: 0 })).toHaveLength(1);
  });
});

describe("resolvePops", () => {
  it("임계값 미만이면 아무 일도 없다", () => {
    const cells = makeCells([[0, 0, 0], [1, 0, 0]]);
    expect(resolvePops(cells, { q: 0, r: 0 })).toEqual([]);
    expect(cells.size).toBe(2);
  });

  it("셋이 붙으면 셋 다 사라진다 — 상위 색을 남기지 않는다", () => {
    // 이 단언이 이 규칙의 전부다. 예전에는 착탄 지점에 한 단계 위 색이 남았고,
    // 그 자리가 비지 않아 케이지 둘레를 걷어낼 수가 없었다.
    const cells = makeCells([[0, 0, 0], [1, 0, 0], [0, 1, 0]]);
    const steps = resolvePops(cells, { q: 0, r: 0 });
    expect(steps).toHaveLength(1);
    expect(steps[0]!.kind).toBe("pop");
    expect(steps[0]!.cleared).toHaveLength(3);
    expect(cells.size).toBe(0);
  });

  it("착탄 지점도 함께 사라진다", () => {
    const cells = makeCells([[0, 0, 0], [1, 0, 0], [0, 1, 0]]);
    resolvePops(cells, { q: 0, r: 0 });
    expect(cells.has(key({ q: 0, r: 0 }))).toBe(false);
  });

  it("덩어리가 크면 전부 사라진다", () => {
    const cells = makeCells([[0, 0, 0], [1, 0, 0], [0, 1, 0], [1, 1, 0], [-1, 1, 0]]);
    const steps = resolvePops(cells, { q: 0, r: 0 });
    expect(steps[0]!.cleared).toHaveLength(5);
    expect(cells.size).toBe(0);
  });

  it("붙어 있는 다른 색은 남는다", () => {
    const cells = makeCells([[0, 0, 0], [1, 0, 0], [0, 1, 0], [1, 1, 1]]);
    resolvePops(cells, { q: 0, r: 0 });
    expect(cells.size).toBe(1);
    expect(cells.has(key({ q: 1, r: 1 }))).toBe(true);
  });

  it("최고 색도 예외 없이 그냥 터진다 — 폭발 규칙은 없다", () => {
    const cells = makeCells([[0, 0, 5], [1, 0, 5], [0, 1, 5]]);
    // 주변에 다른 색을 둘러 둔다. 예전 황금 폭발이라면 이것들까지 휩쓸었다.
    placeTile(cells, { q: -1, r: 0 }, 1);
    placeTile(cells, { q: 2, r: 0 }, 1);
    const steps = resolvePops(cells, { q: 0, r: 0 });
    expect(steps[0]!.cleared).toHaveLength(3);
    expect(cells.has(key({ q: -1, r: 0 }))).toBe(true);
    expect(cells.has(key({ q: 2, r: 0 }))).toBe(true);
  });

  it("빈 칸이나 말굽에서 시작하면 아무 일도 없다", () => {
    const cells = makeCells([]);
    cells.set(key({ q: 0, r: 0 }), { kind: "horseshoe" });
    expect(resolvePops(cells, { q: 0, r: 0 })).toEqual([]);
    expect(resolvePops(cells, { q: 5, r: 5 })).toEqual([]);
  });

  it("말굽은 같은 색 덩어리에 끼지 않아 살아남는다", () => {
    const cells = makeCells([[0, 0, 0], [1, 0, 0], [0, 1, 0]]);
    cells.set(key({ q: 1, r: 1 }), { kind: "horseshoe" });
    resolvePops(cells, { q: 0, r: 0 });
    expect(cells.has(key({ q: 1, r: 1 }))).toBe(true);
  });

  it("임계값은 3이다", () => {
    expect(POP_THRESHOLD).toBe(3);
  });
});
