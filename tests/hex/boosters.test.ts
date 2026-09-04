// tests/hex/boosters.test.ts — 부스터 3종
import { describe, it, expect } from "vitest";
import { key } from "../../src/engine/hex/coords";
import { placeTile, cellAt } from "../../src/engine/hex/grid";
import { createRun } from "../../src/engine/hex/stageRun";
import {
  hasBooster, consume, useHorseshoe, applyBomb, rainbowComponent,
} from "../../src/engine/hex/boosters";
import type { Cell, StageDef, Tier } from "../../src/engine/hex/types";

function stage(): StageDef {
  return { id: "t", cols: 7, rows: 12, objective: 1, shots: 5, cages: [], tiles: [], horseshoes: [] };
}

function makeCells(entries: Array<[number, number, Tier]>): Map<string, Cell> {
  const cells = new Map<string, Cell>();
  for (const [q, r, tier] of entries) placeTile(cells, { q, r }, tier);
  return cells;
}

describe("hasBooster / consume", () => {
  it("초기 수량이 있으면 보유다", () => {
    const run = createRun(stage());
    expect(hasBooster(run, "bomb")).toBe(true);
  });

  it("쓰면 수량이 준다", () => {
    const run = createRun(stage());
    const before = run.boosters.bomb;
    expect(consume(run, "bomb")).toBe(true);
    expect(run.boosters.bomb).toBe(before - 1);
  });

  it("수량이 0이면 쓸 수 없다", () => {
    const run = createRun(stage());
    run.boosters.bomb = 0;
    expect(hasBooster(run, "bomb")).toBe(false);
    expect(consume(run, "bomb")).toBe(false);
    expect(run.boosters.bomb).toBe(0);   // 음수로 내려가지 않는다
  });
});

describe("useHorseshoe", () => {
  it("장전된 티어를 한 단계 올린다", () => {
    const run = createRun(stage());
    expect(run.loaded).toBe(0);
    expect(useHorseshoe(run)).toBe(true);
    expect(run.loaded).toBe(1);
  });

  it("수량을 소모한다", () => {
    const run = createRun(stage());
    const before = run.boosters.horseshoe;
    useHorseshoe(run);
    expect(run.boosters.horseshoe).toBe(before - 1);
  });

  it("이미 최고 티어면 쓸 수 없다", () => {
    const run = createRun(stage());
    run.loaded = 5;
    const before = run.boosters.horseshoe;
    expect(useHorseshoe(run)).toBe(false);
    expect(run.loaded).toBe(5);
    // 실패한 승급은 부스터를 태우지 않는다 — 티어 검사가 소모보다 먼저여야 한다
    expect(run.boosters.horseshoe).toBe(before);
  });

  it("수량이 없으면 쓸 수 없다", () => {
    const run = createRun(stage());
    run.boosters.horseshoe = 0;
    expect(useHorseshoe(run)).toBe(false);
    expect(run.loaded).toBe(0);
  });
});

describe("applyBomb", () => {
  it("착탄 지점과 반경 1을 날린다", () => {
    const cells = makeCells([[0, 0, 0], [1, 0, 1], [0, 1, 2], [5, 5, 3]]);
    const removed = applyBomb(cells, { q: 0, r: 0 });
    expect(cellAt(cells, { q: 0, r: 0 })).toBeUndefined();
    expect(cellAt(cells, { q: 1, r: 0 })).toBeUndefined();
    expect(cellAt(cells, { q: 0, r: 1 })).toBeUndefined();
    expect(cellAt(cells, { q: 5, r: 5 })).toEqual({ kind: "tile", tier: 3 });
    expect(removed).toHaveLength(3);
  });

  it("케이지는 부수지 않는다", () => {
    const cells = makeCells([[0, 0, 0]]);
    cells.set(key({ q: 1, r: 0 }), { kind: "cage", cageId: "c1" });
    applyBomb(cells, { q: 0, r: 0 });
    expect(cellAt(cells, { q: 1, r: 0 })).toEqual({ kind: "cage", cageId: "c1" });
  });
});

describe("rainbowComponent", () => {
  it("색이 달라도 이웃 타일을 성분에 넣는다", () => {
    // (0,0) 자신 + 서로 다른 색 이웃 2개
    const cells = makeCells([[0, 0, 0], [1, 0, 3], [0, 1, 4]]);
    expect(rainbowComponent(cells, { q: 0, r: 0 })).toHaveLength(3);
  });

  it("떨어져 있는 타일은 넣지 않는다", () => {
    const cells = makeCells([[0, 0, 0], [5, 5, 1]]);
    expect(rainbowComponent(cells, { q: 0, r: 0 })).toHaveLength(1);
  });

  it("케이지는 성분에 들어가지 않는다", () => {
    const cells = makeCells([[0, 0, 0]]);
    cells.set(key({ q: 1, r: 0 }), { kind: "cage", cageId: "c1" });
    expect(rainbowComponent(cells, { q: 0, r: 0 })).toHaveLength(1);
  });

  it("말굽은 성분에 들어가지 않는다", () => {
    const cells = makeCells([[0, 0, 0]]);
    cells.set(key({ q: 1, r: 0 }), { kind: "horseshoe" });
    expect(rainbowComponent(cells, { q: 0, r: 0 })).toHaveLength(1);
  });
});
