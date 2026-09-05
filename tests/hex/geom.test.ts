// tests/hex/geom.test.ts — 보드 배치 상수 (Pixi 비의존 부분만)
import { describe, it, expect } from "vitest";
import {
  HEX_SIZE, CELL_W, ROW_H, COLS, ROWS, BOARD, ORIGIN, CENTER_H,
  RAIL_LEFT, PEN, FIELD_X, FIELD_W, FIELD_TOP, penEdges,
  cellToScreen, launchOrigin, launchOriginLocal,
} from "../../src/ui/hex/geom";
import { fromPixel } from "../../src/engine/hex/coords";

describe("보드 상수", () => {
  it("11열 16행이다 — 케이지가 육각 덩어리(7칸)와 둘레 타일을 다 담으려면 이만큼 잘아야 한다", () => {
    expect(COLS).toBe(11);
    expect(ROWS).toBe(16);
  });

  it("셀 폭은 √3 × 반지름이다", () => {
    expect(CELL_W).toBeCloseTo(Math.sqrt(3) * HEX_SIZE, 5);
  });

  it("BOARD가 상수와 일치한다", () => {
    expect(BOARD).toEqual({ size: HEX_SIZE, cols: COLS, rows: ROWS });
  });
});

describe("헛간 우리(사다리꼴) 안쪽에 들어간다", () => {
  // 우리는 아래로 갈수록 벌어진다. 엔진 반사벽이 수직선이라 판은 직사각형이어야
  // 하므로, 가장 좁은 **상단** 폭이 판 폭의 상한이다.

  it("우리는 아래로 갈수록 넓어진다 — 상단이 가장 좁다", () => {
    const top = penEdges(PEN.lt.y);
    const bottom = penEdges(PEN.lb.y);
    expect(bottom.right - bottom.left).toBeGreaterThan(top.right - top.left);
  });

  it("판 폭이 우리 상단 폭을 넘지 않는다", () => {
    const top = penEdges(FIELD_TOP);
    expect(FIELD_W).toBeLessThanOrEqual(top.right - top.left);
  });

  it("판의 모든 행이 그 높이의 우리 안에 있다 — 스태거로 반 칸 밀리는 홀수 행 포함", () => {
    for (let r = 0; r < ROWS; r += 1) {
      const y = cellToScreen({ q: 0, r }).y;
      const { left, right } = penEdges(y);
      expect(FIELD_X).toBeGreaterThanOrEqual(left);
      expect(FIELD_X + FIELD_W).toBeLessThanOrEqual(right);
    }
  });

  it("판 좌우 끝이 FIELD_X ~ FIELD_X+FIELD_W와 맞는다", () => {
    // 짝수 행 왼쪽 끝이 판 좌단, 홀수 행 오른쪽 끝이 판 우단이다(스태거 반 칸).
    const left = cellToScreen({ q: 0, r: 0 }).x - CELL_W / 2;
    const right = cellToScreen({ q: COLS - 1, r: 1 }).x + CELL_W / 2;
    expect(left).toBeCloseTo(FIELD_X, 5);
    expect(right).toBeCloseTo(FIELD_X + FIELD_W, 5);
  });

  it("판이 우측 HUD 레일을 침범하지 않는다", () => {
    const right = cellToScreen({ q: COLS - 1, r: 1 }).x + CELL_W / 2;
    expect(right).toBeLessThanOrEqual(RAIL_LEFT);
  });

  it("판 상단이 우리 상단보다 아래에 있다", () => {
    expect(FIELD_TOP).toBeGreaterThanOrEqual(PEN.lt.y);
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

  it("발사 지점이 판 가로 중앙이다 — 컬럼 중앙이 아니라 판 중앙이라야 조준이 대칭이다", () => {
    expect(launchOrigin().x).toBeCloseTo(FIELD_X + FIELD_W / 2, 5);
  });

  it("발사대 높이는 격자 크기에서 파생되지 않는다", () => {
    // 예전엔 ORIGIN.y + ROW_H × ROWS + 30이었다. 판을 줄이자 붉은말이 화면
    // 한가운데로 따라 올라왔다 — 말이 서는 자리는 배경 아트가 정한다.
    expect(launchOrigin().y).not.toBeCloseTo(ORIGIN.y + ROW_H * ROWS + 30, 1);
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
