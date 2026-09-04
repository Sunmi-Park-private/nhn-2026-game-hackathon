// ui/hex/geom.ts — 보드의 논리 좌표 배치. stage.ts의 450×800 좌표계 위에 얹는다.
// Pixi를 import하지 않는다 — 순수 계산이라 테스트가 헤드리스로 돈다.
import { toPixel } from "../../engine/hex/coords";
import type { Axial } from "../../engine/hex/types";
import type { BoardGeom } from "../../engine/hex/shot";

/** 최종 아트의 나무 프레임 안쪽까지의 여백(한쪽). 판은 이 안에서만 논다.
 *  프레임을 조금 넓히거나 좁히면 여기만 고치면 되고, 육각 크기는 자동으로 따라온다. */
export const FIELD_INSET = 10;

export const COLS = 7;
export const ROWS = 10;

/** 중앙 콘텐츠 컬럼의 논리 크기. 정확히 9:16이다.
 *  전체 화면은 16:9이고 좌우에 헛간 패널이 붙지만, 게임은 이 컬럼 안에서만 논다. */
export const CENTER_W = 450;
export const CENTER_H = 800;

/** 판 폭. 중앙 컬럼에서 좌우 여백을 뺀 값. */
const FIELD_W = CENTER_W - FIELD_INSET * 2; // 430

/** 셀 폭은 프레임 안쪽 폭을 열 수로 나눈 값이다 — 아트가 크기를 정한다. */
export const CELL_W = FIELD_W / COLS; // ≈ 61.4

/** 육각 반지름은 셀 폭에서 역산한다. 셀 폭 = √3 × 반지름. */
export const HEX_SIZE = CELL_W / Math.sqrt(3); // ≈ 35.5

/** 행 간격. pointy-top 육각은 1.5 × 반지름씩 내려간다. */
export const ROW_H = HEX_SIZE * 1.5; // ≈ 53.2

export const BOARD: BoardGeom = { size: HEX_SIZE, cols: COLS, rows: ROWS };

/** 셀 (0,0) 중심의 논리 좌표. 좌우 여백이 정확히 FIELD_INSET이 되도록 잡는다. */
export const ORIGIN = {
  x: FIELD_INSET + CELL_W / 2,
  y: 150, // 상단 HUD(스테이지 바) 아래
};

export function cellToScreen(a: Axial): { x: number; y: number } {
  const p = toPixel(a, HEX_SIZE);
  return { x: ORIGIN.x + p.x, y: ORIGIN.y + p.y };
}

/** 발사 지점 — 판 하단 중앙. 붉은말이 여기서 타일을 던진다. */
export function launchOrigin(): { x: number; y: number } {
  return { x: CENTER_W / 2, y: ORIGIN.y + ROW_H * ROWS + 30 };
}

/** 발사 지점을 엔진 좌표계(ORIGIN 기준)로 옮긴다 — simulateShot이 쓰는 계다. */
export function launchOriginLocal(): { x: number; y: number } {
  const o = launchOrigin();
  return { x: o.x - ORIGIN.x, y: o.y - ORIGIN.y };
}
