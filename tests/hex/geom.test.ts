// tests/hex/geom.test.ts — 보드 배치 상수 (Pixi 비의존 부분만)
import { describe, it, expect } from "vitest";
import {
  HEX_SIZE, CELL_W, COLS, ROWS, BOARD, ORIGIN, FIELD_INSET, CENTER_W, CENTER_H,
  cellToScreen, launchOrigin, launchOriginLocal,
} from "../../src/ui/hex/geom";
import { fromPixel } from "../../src/engine/hex/coords";

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

describe("launchOriginLocal", () => {
  it("화면 좌표에서 ORIGIN을 뺀 값이다", () => {
    const screen = launchOrigin();
    const local = launchOriginLocal();
    expect(local.x).toBeCloseTo(screen.x - ORIGIN.x, 5);
    expect(local.y).toBeCloseTo(screen.y - ORIGIN.y, 5);
  });

  it("격자 아래에 놓인다 — 발사체가 판 밖에서 출발해야 한다", () => {
    // simulateShot은 이 좌표계(셀 (0,0) 기준)로 궤적을 돈다.
    // 여기가 격자 안이면 첫 스텝부터 충돌 판정에 걸린다.
    const a = fromPixel(launchOriginLocal(), HEX_SIZE);
    expect(a.r).toBeGreaterThanOrEqual(ROWS);
  });

  it("가로로는 판 중앙 열 부근이다", () => {
    const a = fromPixel(launchOriginLocal(), HEX_SIZE);
    const col = a.q + Math.floor(a.r / 2);
    expect(col).toBeGreaterThanOrEqual(0);
    expect(col).toBeLessThan(COLS);
  });
});
