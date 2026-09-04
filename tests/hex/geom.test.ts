// tests/hex/geom.test.ts — 보드 배치 상수 (Pixi 비의존 부분만)
import { describe, it, expect } from "vitest";
import {
  HEX_SIZE, CELL_W, COLS, ROWS, BOARD, ORIGIN, FIELD_INSET, CENTER_W, CENTER_H,
  cellToScreen, launchOrigin,
} from "../../src/ui/hex/geom";

describe("보드 상수", () => {
  it("7열이다", () => {
    expect(COLS).toBe(7);
  });

  it("셀 폭은 √3 × 반지름이다", () => {
    expect(CELL_W).toBeCloseTo(Math.sqrt(3) * HEX_SIZE, 5);
  });

  it("BOARD가 상수와 일치한다", () => {
    expect(BOARD).toEqual({ size: HEX_SIZE, cols: COLS, rows: ROWS });
  });
});

describe("나무 프레임 안쪽에 들어간다", () => {
  it("보드 전체 폭이 프레임 안쪽 폭을 넘지 않는다", () => {
    const fieldW = CENTER_W - FIELD_INSET * 2;
    expect(COLS * CELL_W).toBeLessThanOrEqual(fieldW + 0.001);
  });

  it("보드 왼쪽 끝이 프레임 안쪽보다 안에 있다", () => {
    const left = cellToScreen({ q: 0, r: 0 }).x - CELL_W / 2;
    expect(left).toBeGreaterThanOrEqual(FIELD_INSET - 0.001);
  });

  it("보드 오른쪽 끝이 프레임 안쪽보다 안에 있다", () => {
    const right = cellToScreen({ q: COLS - 1, r: 0 }).x + CELL_W / 2;
    expect(right).toBeLessThanOrEqual(CENTER_W - FIELD_INSET + 0.001);
  });

  it("좌우 여백이 대칭이다", () => {
    const left = cellToScreen({ q: 0, r: 0 }).x - CELL_W / 2;
    const right = CENTER_W - (cellToScreen({ q: COLS - 1, r: 0 }).x + CELL_W / 2);
    expect(left).toBeCloseTo(right, 5);
  });
});

describe("cellToScreen", () => {
  it("셀 (0,0)은 ORIGIN에 온다", () => {
    expect(cellToScreen({ q: 0, r: 0 })).toEqual(ORIGIN);
  });

  it("같은 행의 옆 칸은 셀 폭만큼 떨어진다", () => {
    const a = cellToScreen({ q: 0, r: 0 });
    const b = cellToScreen({ q: 1, r: 0 });
    expect(b.x - a.x).toBeCloseTo(CELL_W, 5);
  });
});

describe("launchOrigin", () => {
  it("발사 지점이 보드 마지막 행보다 아래에 있다", () => {
    expect(launchOrigin().y).toBeGreaterThan(cellToScreen({ q: 0, r: ROWS - 1 }).y);
  });

  it("발사 지점이 가로 중앙이다", () => {
    expect(launchOrigin().x).toBeCloseTo(CENTER_W / 2, 5);
  });

  it("발사 지점이 화면 안에 있다", () => {
    expect(launchOrigin().y).toBeLessThan(CENTER_H);
  });
});
