// ui/hex/geom.ts — 보드의 논리 좌표 배치. stage.ts의 450×800 좌표계 위에 얹는다.
// Pixi를 import하지 않는다 — 순수 계산이라 테스트가 헤드리스로 돈다.
import { toPixel } from "../../engine/hex/coords";
import type { Axial } from "../../engine/hex/types";
import type { BoardGeom } from "../../engine/hex/shot";

/** 최종 아트의 나무 프레임 안쪽까지의 여백(한쪽). 판은 이 안에서만 논다.
 *  프레임을 조금 넓히거나 좁히면 여기만 고치면 되고, 육각 크기는 자동으로 따라온다. */
export const FIELD_INSET = 10;

/** 우측 HUD 레일(NEXT·부스터)이 차지하는 폭. 판은 이 자리를 침범하지 않는다 —
 *  겹치면 그 칸에 붙은 타일이 HUD 뒤로 숨으면서도 발사를 막고 합체에는 참여한다. */
export const RAIL_W = 56;
export const RAIL_MARGIN = 12;
const RAIL_RESERVE = RAIL_W + RAIL_MARGIN * 2; // 80

// 케이지가 반지름 1의 육각 덩어리(7칸)를 차지하고, 그 둘레(반지름 2, 12칸)를
// 1칸짜리 타일이 감싼다. 그러려면 케이지 하나가 가로 3열·세로 3행을 먹으므로
// 7열 격자로는 두 개를 놓을 자리가 없다. 칸을 잘게 쪼개 자리를 만든다.
export const COLS = 11;
export const ROWS = 16;

/** 중앙 콘텐츠 컬럼의 논리 크기. 정확히 9:16이다.
 *  전체 화면은 16:9이고 좌우에 헛간 패널이 붙지만, 게임은 이 컬럼 안에서만 논다. */
export const CENTER_W = 450;
export const CENTER_H = 800;

/** 판 폭 = 컬럼 − 좌측 여백 − 우측 레일 예약분 */
const FIELD_W = CENTER_W - FIELD_INSET - RAIL_RESERVE; // 360

/** pointy-top 스태거 격자는 홀수 행이 반 칸 밀리므로 실제 폭이 COLS + 0.5칸이다.
 *  COLS로 나누면 마지막 홀수 행이 판 밖으로 넘치고 반사벽도 화면 밖에 놓인다. */
export const CELL_W = FIELD_W / (COLS + 0.5); // ≈ 48.00

/** 육각 반지름은 셀 폭에서 역산한다. 셀 폭 = √3 × 반지름. */
export const HEX_SIZE = CELL_W / Math.sqrt(3); // ≈ 27.71

/** 행 간격. pointy-top 육각은 1.5 × 반지름씩 내려간다. */
export const ROW_H = HEX_SIZE * 1.5; // ≈ 41.57

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
