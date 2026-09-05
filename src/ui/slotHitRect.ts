// ui/slotHitRect.ts — 슬롯의 터치 영역을 배율에서 떼어낸다.
//
// 왜 필요한가. 슬롯의 `scale`은 **아트**를 슬롯 상자보다 크게 그리라는 디자이너의
// 지시다(하단 nav 4종이 2.3 — 아트에 투명 여백이 있어 그래야 크기가 맞는다).
// 그런데 배율은 노드 전체에 걸리므로 그 안의 투명 히트 사각형까지 함께 커진다.
// 96×50이 220.8×115가 되면 옆 버튼을 덮고, Pixi는 겹칠 때 **나중에 붙은 것**을
// 잡으므로 HOME을 눌러도 RACE가 열렸다.
//
// 그래서 터치 영역은 자식으로 그리지 않고 hitArea로 못박는다. 여기서 만드는 것은
// **지역 좌표** 사각형이다 — 노드의 pivot·배율을 거쳐 부모 좌표에서 정확히
// 슬롯 상자가 되도록 미리 나눠 둔다.

/** 슬롯 상자 — 레이아웃이 정한 부모 좌표계의 자리 */
export interface Box {
  x: number;
  y: number;
  w: number;
  h: number;
}

/** 히트 영역을 계산할 때 필요한 노드 상태. Pixi Container에서 뽑아 넣는다. */
export interface NodeTransform {
  x: number;
  y: number;
  scale: number;
  pivotX: number;
  pivotY: number;
}

/**
 * 부모 좌표에서 정확히 `b`를 덮는 **지역 좌표** 사각형.
 *
 * Pixi가 지역 → 부모로 옮기는 식이 `P = (L - pivot) * scale + node`이므로,
 * 그것을 뒤집어 `L = (P - node) / scale + pivot`으로 되돌린 것이다.
 * 배율이 1이면 원래대로 슬롯 상자를 그대로 돌려준다.
 */
export function slotHitRect(b: Box, n: NodeTransform): Box {
  const s = n.scale > 0 ? n.scale : 1;
  return {
    x: (b.x - n.x) / s + n.pivotX,
    y: (b.y - n.y) / s + n.pivotY,
    w: b.w / s,
    h: b.h / s,
  };
}
