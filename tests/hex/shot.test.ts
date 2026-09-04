// tests/hex/shot.test.ts — 궤적·벽 반사·스냅
import { describe, it, expect } from "vitest";
import { toPixel } from "../../src/engine/hex/coords";
import { placeTile } from "../../src/engine/hex/grid";
import { boardBounds, simulateShot } from "../../src/engine/hex/shot";
import type { BoardGeom } from "../../src/engine/hex/shot";
import type { Cell, Tier } from "../../src/engine/hex/types";

const GEOM: BoardGeom = { size: 30, cols: 7, rows: 12 };

function makeCells(entries: Array<[number, number, Tier]>): Map<string, Cell> {
  const cells = new Map<string, Cell>();
  for (const [q, r, tier] of entries) placeTile(cells, { q, r }, tier);
  return cells;
}

/** 보드 하단 중앙의 발사 지점(픽셀). 셀 (3,11) 아래쪽. */
function launchPoint(): { x: number; y: number } {
  const p = toPixel({ q: -2, r: 12 }, GEOM.size);
  return { x: p.x, y: p.y };
}

describe("boardBounds", () => {
  it("좌우 벽이 0열과 마지막 열 바깥에 온다", () => {
    const { minX, maxX } = boardBounds(GEOM);
    expect(minX).toBeLessThan(toPixel({ q: 0, r: 0 }, GEOM.size).x);
    expect(maxX).toBeGreaterThan(toPixel({ q: 6, r: 0 }, GEOM.size).x);
  });

  it("오른쪽 벽이 홀수 행 마지막 셀의 가장자리까지 간다", () => {
    // 홀수 행(r=1)은 반 칸 밀려 있어 짝수 행보다 w/2 더 뻗는다
    const w = Math.sqrt(3) * GEOM.size;
    const lastOddCellCenter = toPixel({ q: GEOM.cols - 1, r: 1 }, GEOM.size).x;
    expect(boardBounds(GEOM).maxX).toBeCloseTo(lastOddCellCenter + w / 2, 5);
  });
});

describe("simulateShot — 직진", () => {
  it("빈 보드에 똑바로 쏘면 천장 바로 아래에 붙는다", () => {
    const cells = makeCells([]);
    const res = simulateShot(cells, GEOM, launchPoint(), 0);
    expect(res.snap).not.toBeNull();
    expect(res.snap!.r).toBe(0);
  });

  it("경로가 비어 있지 않다", () => {
    const res = simulateShot(makeCells([]), GEOM, launchPoint(), 0);
    expect(res.path.length).toBeGreaterThan(1);
  });

  it("타일에 막히면 그 바로 앞 빈 칸에 붙는다", () => {
    // 발사 직선상 (-1,10)에 타일을 둔다
    const cells = makeCells([[-1, 10, 0]]);
    const res = simulateShot(cells, GEOM, launchPoint(), 0);
    expect(res.snap).toEqual({ q: -2, r: 11 });
  });

  it("스냅한 칸은 반드시 비어 있다", () => {
    const cells = makeCells([[-1, 10, 0], [-1, 9, 1]]);
    const res = simulateShot(cells, GEOM, launchPoint(), 0);
    expect(res.snap).not.toBeNull();
    expect(cells.has(`${res.snap!.q},${res.snap!.r}`)).toBe(false);
  });
});

describe("simulateShot — 케이지", () => {
  it("케이지는 막지만 그 자리에 붙지 않는다", () => {
    const cells = new Map<string, Cell>();
    cells.set("-1,10", { kind: "cage", cageId: "c1" });
    const res = simulateShot(cells, GEOM, launchPoint(), 0);
    expect(res.snap).toEqual({ q: -2, r: 11 });
  });
});

describe("simulateShot — 벽 반사", () => {
  it("비스듬히 쏘면 벽에 튕겨도 보드 안에 붙는다", () => {
    const cells = makeCells([]);
    const res = simulateShot(cells, GEOM, launchPoint(), 0.9);
    expect(res.snap).not.toBeNull();
    expect(res.snap!.r).toBeGreaterThanOrEqual(0);
    expect(res.snap!.r).toBeLessThan(GEOM.rows);
  });

  it("경로가 좌우 벽 밖으로 나가지 않는다", () => {
    const { minX, maxX } = boardBounds(GEOM);
    const res = simulateShot(makeCells([]), GEOM, launchPoint(), -1.0);
    for (const p of res.path) {
      expect(p.x).toBeGreaterThanOrEqual(minX - 0.001);
      expect(p.x).toBeLessThanOrEqual(maxX + 0.001);
    }
  });

  it("반사한 궤적에도 스냅 지점이 있다", () => {
    const res = simulateShot(makeCells([]), GEOM, launchPoint(), -1.1);
    expect(res.snap).not.toBeNull();
  });
});

describe("simulateShot — 경계", () => {
  it("발사 지점이 이미 막혀 있으면 스냅이 없다", () => {
    const from = launchPoint();
    const cells = makeCells([]);
    // 발사 지점 셀 자체를 막는다
    const startCell = { q: -2, r: 12 };
    placeTile(cells, startCell, 0);
    const res = simulateShot(cells, { ...GEOM, rows: 13 }, from, 0);
    expect(res.snap).toBeNull();
  });
});
