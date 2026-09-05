// ui/race/gridGeom.ts — 격자 안 타일의 자리. 순수 계산이라 Pixi를 모른다.
//
// 6종 카드가 **한 장의 이미지**로 오므로, 하이라이트를 얹으려면 코드가 그 이미지 안의
// 타일 자리를 알아야 한다. 이미지를 뜯어볼 수는 없으니 격자 규칙으로 짚는다 —
// 디자이너가 같은 규칙으로 배치하면 맞고, 어긋나면 data/race.ts의 간격만 고치면 된다.

export interface Box { x: number; y: number; w: number; h: number }

export interface CardGrid {
  cols: number;
  rows: number;
  /** 상자 대비 칸 사이 여백 비율 — 상자를 늘려도 비례해서 따라간다 */
  gap: { x: number; y: number };
  /** 하이라이트가 타일 밖으로 나가는 여유(px) */
  pad: number;
}

/** 격자 안 i번 타일의 자리. i는 왼쪽 위부터 가로로 센다. */
export function tileRect(box: Box, g: CardGrid, i: number): Box {
  const gx = box.w * g.gap.x;
  const gy = box.h * g.gap.y;
  const w = (box.w - gx * (g.cols - 1)) / g.cols;
  const h = (box.h - gy * (g.rows - 1)) / g.rows;
  return {
    x: box.x + (w + gx) * (i % g.cols),
    y: box.y + (h + gy) * Math.floor(i / g.cols),
    w,
    h,
  };
}
