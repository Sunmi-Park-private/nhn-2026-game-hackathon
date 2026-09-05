// ui/hex/handSlot.ts — 붉은말이 든 타일의 자리. 순수 계산이라 헤드리스로 테스트한다.
//
// 말은 조준각을 따라 몸을 기울인다(launcher의 TILT_RATIO). 회전축은 **발 밑**이라
// 몸이 기울면 머리 위 앞발이 좌우로 크게 움직인다. 타일 자리를 고정해 두면
// 앞발은 옆으로 갔는데 타일만 가운데 남아 「손에서 떨어진」 그림이 된다.
//
// 그래서 타일도 **같은 축을 중심으로 같이 돈다**. 회전이 0일 때의 손 위치가
// 곧 발사 지점이므로, 그 점을 축 기준으로 회전시키면 된다.

export interface Point {
  x: number;
  y: number;
}

/**
 * 기울기 `rotation`에서 앞발 사이의 좌표.
 *
 * @param origin  회전이 0일 때의 손 위치 = 발사 지점
 * @param pivotY  회전축의 y. 말 스프라이트의 앵커(하단 중앙)가 놓인 높이다
 * @param rotation 몸 기울기(라디안). 양수 = 오른쪽으로 기움
 */
export function handSlot(origin: Point, pivotY: number, rotation: number): Point {
  // 축에서 손까지의 벡터. 축이 발 밑이고 손은 머리 위라 dy는 음수다.
  const dy = origin.y - pivotY;
  const sin = Math.sin(rotation);
  const cos = Math.cos(rotation);
  // (0, dy)를 rotation만큼 회전 — x' = -dy·sin, y' = dy·cos
  return { x: origin.x - dy * sin, y: pivotY + dy * cos };
}
