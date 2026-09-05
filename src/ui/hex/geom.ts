// ui/hex/geom.ts — 보드의 논리 좌표 배치. stage.ts의 450×800 좌표계 위에 얹는다.
// Pixi를 import하지 않는다 — 순수 계산이라 테스트가 헤드리스로 돈다.
import { toPixel } from "../../engine/hex/coords";
import type { Axial } from "../../engine/hex/types";
import type { BoardGeom } from "../../engine/hex/shot";

/** 중앙 콘텐츠 컬럼의 논리 크기. 정확히 9:16이다.
 *  전체 화면은 16:9이고 좌우에 헛간 패널이 붙지만, 게임은 이 컬럼 안에서만 논다. */
export const CENTER_W = 450;
export const CENTER_H = 800;

/**
 * 헛간 우리 안쪽 — 실제로 플레이할 수 있는 흙바닥.
 *
 * **직사각형이 아니라 아래로 갈수록 벌어지는 사다리꼴이다.** 디자이너가 최종
 * 1920×1080 화면 기준으로 넘긴 꼭짓점을 논리 좌표로 환산한 값이다:
 *
 *   LT(778,132) RT(1155,132) LB(745,753) RB(1178,753)
 *
 * 환산은 main.ts의 화면 맞춤 규칙을 따른다 — 논리 높이는 800 고정이고 콘텐츠
 * 450 박스가 가로 중앙에 놓이므로, 1920×1080에서 배율 s=1.35, 컬럼 좌단은
 * 화면 x=656.1이다. 즉 `논리 = (화면x − 656.1) / 1.35`.
 *
 * 이 값을 다시 계산해야 할 일이 생기면 화면 해상도가 아니라 **위 네 점**을 고친다.
 */
export const PEN = {
  lt: { x: 90.3, y: 97.8 },
  rt: { x: 369.6, y: 97.8 },
  lb: { x: 65.9, y: 557.8 },
  rb: { x: 386.6, y: 557.8 },
} as const;

/** 주어진 높이에서 우리의 좌우 안쪽 x. 사다리꼴 변을 선형 보간한다.
 *  판 바깥으로 나가면 안 되는 것(붉은말·구출 연출·낙하 타일)이 이 값을 쓴다. */
export function penEdges(y: number): { left: number; right: number } {
  const t = (y - PEN.lt.y) / (PEN.lb.y - PEN.lt.y);
  return {
    left: PEN.lt.x + (PEN.lb.x - PEN.lt.x) * t,
    right: PEN.rt.x + (PEN.rb.x - PEN.rt.x) * t,
  };
}

/** 우측 HUD 레일(NEXT·부스터)이 차지하는 폭. 판은 이 자리를 침범하지 않는다 —
 *  겹치면 그 칸에 붙은 타일이 HUD 뒤로 숨으면서도 발사를 막고 합체에는 참여한다. */
export const RAIL_W = 56;
export const RAIL_MARGIN = 12;
/** 레일 왼쪽 경계. uiLayout의 nextPanel 슬롯(x=382)과 같은 자리다. */
export const RAIL_LEFT = CENTER_W - RAIL_W - RAIL_MARGIN;

// 케이지가 반지름 1의 육각 덩어리(7칸)를 차지하고, 그 둘레(반지름 2, 12칸)를
// 1칸짜리 타일이 감싼다. 그러려면 케이지 하나가 가로 3열·세로 3행을 먹으므로
// 7열 격자로는 두 개를 놓을 자리가 없다. 칸을 잘게 쪼개 자리를 만든다.
export const COLS = 11;
/** 16 → 20. 위에서 줄이 내려오므로 **떨어질 높이**가 곧 유예 시간이다.
 *  세로를 늘리는 비용은 0이다 — 셀 크기는 FIELD_W ÷ (COLS+0.5)에서 나오지 ROWS와 무관하다.
 *  우리 바닥(y≈558)까지 남아 있던 빈 자리를 쓰는 것뿐이다. */
export const ROWS = 20;

/** 판 상단. 우리 상단(97.8) 바로 아래에 붙인다. */
export const FIELD_TOP = 98;

/**
 * 판의 가로 위치와 폭.
 *
 * **엔진의 반사벽은 수직선이다**(shot.ts `boardBounds`). 판을 사다리꼴로 만들 수
 * 없으므로 직사각형을 사다리꼴 안에 넣어야 하고, 그러려면 **가장 좁은 상단 폭**에
 * 맞춰야 한다 — 그리고 타일이 가장 빽빽하게 깔리는 자리가 바로 거기다.
 * 우리 상단 폭이 279.3이므로 여기서 여유 2를 뺀 277을 쓰고, 상단 중심선에 맞춘다.
 *
 * 아래로 갈수록 우리가 벌어지므로 아래쪽 행은 저절로 여유가 생긴다.
 */
export const FIELD_W = 277;
export const FIELD_X = (PEN.lt.x + PEN.rt.x) / 2 - FIELD_W / 2; // ≈ 91.45

/**
 * 셀 폭. 나누는 수가 **COLS + 1**이다.
 *
 * 두 가지가 겹쳐서 이 값이 된다.
 *   ① pointy-top 스태거 격자는 홀수 행이 반 칸 밀리므로 한 위상의 폭이 COLS+0.5칸이다.
 *   ② 판은 줄이 내려올 때마다 **반 칸씩 좌우로 오간다**(pushRow). 두 위상의 합집합은
 *      그보다 반 칸 더 넓다.
 *
 * COLS+0.5로 나누면 오른쪽 위상에서 마지막 열이 우리 밖으로 반 칸 삐져나간다.
 */
export const CELL_W = FIELD_W / (COLS + 1); // ≈ 23.08

/** 육각 반지름은 셀 폭에서 역산한다. 셀 폭 = √3 × 반지름. */
export const HEX_SIZE = CELL_W / Math.sqrt(3); // ≈ 13.91

/** 행 간격. pointy-top 육각은 1.5 × 반지름씩 내려간다. */
export const ROW_H = HEX_SIZE * 1.5; // ≈ 20.86

export const BOARD: BoardGeom = { size: HEX_SIZE, cols: COLS, rows: ROWS };

/** 셀 (0,0) 중심의 논리 좌표.
 *
 *  x는 좌우로 오가는 판의 **왼쪽 끝 위상**이 FIELD_X에 딱 붙는 자리다. 오른쪽 위상은
 *  반 칸 밀려 FIELD_X + FIELD_W에 붙는다 — 둘이 번갈아 우리 양 끝에 닿으면서
 *  「판이 자글거리며 내려온다」가 된다. */
export const ORIGIN = {
  x: FIELD_X + CELL_W / 2,
  y: FIELD_TOP + HEX_SIZE,
};

export function cellToScreen(a: Axial): { x: number; y: number } {
  const p = toPixel(a, HEX_SIZE);
  return { x: ORIGIN.x + p.x, y: ORIGIN.y + p.y };
}

/** 발사대 y — 우리 아래쪽 문간. 붉은말이 여기 서서 위를 올려다본다.
 *
 *  **판 크기에서 파생시키지 않는다.** 예전엔 `ORIGIN.y + ROW_H × ROWS + 30`이라
 *  격자를 줄이자 말이 화면 한가운데로 따라 올라왔다. 말이 서 있는 자리는 배경
 *  아트가 정하는 것이지 격자가 정하는 것이 아니다. */
export const LAUNCH_Y = 600;

/** 발사 지점 — 판 하단 중앙. 판 중심과 같은 x라야 조준이 좌우 대칭이 된다. */
export function launchOrigin(): { x: number; y: number } {
  return { x: FIELD_X + FIELD_W / 2, y: LAUNCH_Y };
}

/** 발사 지점을 엔진 좌표계(ORIGIN 기준)로 옮긴다 — simulateShot이 쓰는 계다. */
export function launchOriginLocal(): { x: number; y: number } {
  const o = launchOrigin();
  return { x: o.x - ORIGIN.x, y: o.y - ORIGIN.y };
}
