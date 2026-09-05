// ui/slotScale.ts — 슬롯 배율을 노드가 이미 가진 배율에 **곱한다**.
//
// 왜 필요한가. 슬롯의 `scale`은 「이 슬롯의 그림을 상자보다 이만큼 크게」라는 디자이너의
// 지시다. 그런데 노드가 처음부터 배율 1이라는 보장이 없다 — 레이스 배경은 coverBox가
// 콘텐츠 박스(450×800)에 맞춰 이미 줄여 둔 스프라이트다(1080×2400이면 0.4167).
//
// 예전에는 슬롯 배율을 `scale.set(slot.scale)`로 **덮어썼다.** 그러면 맞춰둔 축소가
// 사라져 원본 크기의 slot.scale배로 그려진다 — 화면에서는 배경이 몇 배로 확대돼
// 보였다(QA: RACE 메뉴 배경 확대). 버튼처럼 배율이 1인 노드에서는 덮어쓰기와 곱하기가
// 같은 값이라 오래 드러나지 않았다.

/**
 * 노드에 넣을 최종 배율.
 *
 * @param base      등록 시점에 노드가 갖고 있던 배율(coverBox가 맞춰둔 값 등)
 * @param slotScale 슬롯이 지시한 배율. 없거나 0 이하면 무시한다 —
 *                  디자이너 오투입으로 그림이 사라지면 안 된다
 * @param sizeRatio 에디터에서 상자를 끌어 키운 비율(slot.w / baseW)
 */
export function composeScale(base: number, slotScale: number | undefined, sizeRatio: number): number {
  const s = slotScale !== undefined && slotScale > 0 ? slotScale : 1;
  return base * s * sizeRatio;
}
