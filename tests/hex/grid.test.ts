// tests/hex/grid.test.ts — 그리드 조회·배치 유닛
import { describe, it, expect } from "vitest";
import { key } from "../../src/engine/hex/coords";
import {
  cellAt, isEmpty, isOccupied, placeTile, clearCell, cageNeighbors, buildCells,
} from "../../src/engine/hex/grid";
import type { Cell, StageDef } from "../../src/engine/hex/types";

function emptyCells(): Map<string, Cell> {
  return new Map<string, Cell>();
}

describe("cellAt / isOccupied", () => {
  it("빈 칸은 undefined다", () => {
    expect(cellAt(emptyCells(), { q: 0, r: 0 })).toBeUndefined();
  });

  it("배치한 타일을 되읽는다", () => {
    const cells = emptyCells();
    placeTile(cells, { q: 1, r: 2 }, 3);
    expect(cellAt(cells, { q: 1, r: 2 })).toEqual({ kind: "tile", tier: 3 });
  });

  it("내용이 있으면 점유다", () => {
    const cells = emptyCells();
    placeTile(cells, { q: 0, r: 0 }, 0);
    expect(isOccupied(cells, { q: 0, r: 0 })).toBe(true);
    expect(isOccupied(cells, { q: 1, r: 0 })).toBe(false);
  });
});

describe("isEmpty", () => {
  it("보드 안이고 내용이 없으면 빈 칸이다", () => {
    expect(isEmpty(emptyCells(), { q: 0, r: 0 }, 7, 10)).toBe(true);
  });

  it("보드 밖은 빈 칸이 아니다", () => {
    expect(isEmpty(emptyCells(), { q: -1, r: 0 }, 7, 10)).toBe(false);
    expect(isEmpty(emptyCells(), { q: 0, r: 10 }, 7, 10)).toBe(false);
  });

  it("점유된 칸은 빈 칸이 아니다", () => {
    const cells = emptyCells();
    placeTile(cells, { q: 0, r: 0 }, 0);
    expect(isEmpty(cells, { q: 0, r: 0 }, 7, 10)).toBe(false);
  });
});

describe("clearCell", () => {
  it("지우면 빈 칸이 된다", () => {
    const cells = emptyCells();
    placeTile(cells, { q: 2, r: 2 }, 1);
    clearCell(cells, { q: 2, r: 2 });
    expect(isOccupied(cells, { q: 2, r: 2 })).toBe(false);
  });
});

describe("cageNeighbors", () => {
  const cage = {
    id: "c1",
    animalId: "sheep",
    cells: [{ q: 0, r: 0 }, { q: 1, r: 0 }],
  };

  it("케이지 자기 셀은 포함하지 않는다", () => {
    const ns = cageNeighbors(cage).map(key);
    expect(ns).not.toContain(key({ q: 0, r: 0 }));
    expect(ns).not.toContain(key({ q: 1, r: 0 }));
  });

  it("중복이 없다", () => {
    const ns = cageNeighbors(cage).map(key);
    expect(new Set(ns).size).toBe(ns.length);
  });

  it("가로 2셀 케이지의 바깥 인접은 8칙이다", () => {
    // 각 셀의 이웃 6개 = 12, 서로를 가리키는 2개 제외 = 10,
    // 위아래로 공유하는 이웃 2쌍이 겹쳐 중복 제거 = 8
    expect(cageNeighbors(cage)).toHaveLength(8);
  });
});

describe("buildCells", () => {
  const stage: StageDef = {
    id: "t1",
    cols: 7,
    rows: 10,
    objective: 1,
    pushSeconds: 15,
    cages: [{ id: "c1", animalId: "sheep", cells: [{ q: 2, r: 2 }, { q: 3, r: 2 }] }],
    tiles: [{ at: { q: 0, r: 0 }, tier: 0 }, { at: { q: 1, r: 0 }, tier: 4 }],
    horseshoes: [{ q: 5, r: 1 }],
  };

  it("타일을 배치한다", () => {
    const cells = buildCells(stage);
    expect(cellAt(cells, { q: 0, r: 0 })).toEqual({ kind: "tile", tier: 0 });
    expect(cellAt(cells, { q: 1, r: 0 })).toEqual({ kind: "tile", tier: 4 });
  });

  it("말굽을 배치한다", () => {
    expect(cellAt(buildCells(stage), { q: 5, r: 1 })).toEqual({ kind: "horseshoe" });
  });

  it("케이지가 점유한 모든 셀에 cageId를 심는다", () => {
    const cells = buildCells(stage);
    expect(cellAt(cells, { q: 2, r: 2 })).toEqual({ kind: "cage", cageId: "c1" });
    expect(cellAt(cells, { q: 3, r: 2 })).toEqual({ kind: "cage", cageId: "c1" });
  });

  it("나머지는 빈 칸이다", () => {
    expect(isOccupied(buildCells(stage), { q: 6, r: 9 })).toBe(false);
  });
});
