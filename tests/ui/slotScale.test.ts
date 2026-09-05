// 슬롯 배율이 노드가 이미 갖고 있던 배율을 지우면 안 된다.
//
// 레이스 배경은 coverBox가 콘텐츠 박스(450×800)에 맞춰 이미 축소해 둔 스프라이트다.
// 거기에 슬롯 배율 1.1을 **덮어쓰면** 맞춰둔 축소가 사라져 원본 크기의 1.1배로 그려진다
// — 화면에서는 배경이 몇 배로 확대돼 보인다(QA: RACE 메뉴 배경 확대).
import { describe, expect, it } from "vitest";
import { composeScale } from "../../src/ui/slotScale";

describe("슬롯 배율 합성", () => {
  it("노드가 이미 가진 배율에 곱한다 — 덮어쓰지 않는다", () => {
    // coverBox가 1080×2400 아트를 450×800에 맞춰 0.4167로 줄여 둔 상태
    expect(composeScale(0.4167, 1.1, 1)).toBeCloseTo(0.4584, 4);
  });

  it("배율이 1인 노드(버튼)는 예전과 똑같다", () => {
    expect(composeScale(1, 2.3, 1)).toBeCloseTo(2.3, 6);
    expect(composeScale(1, 1, 1)).toBeCloseTo(1, 6);
  });

  it("슬롯 배율이 없으면 노드 배율을 그대로 둔다", () => {
    expect(composeScale(0.4167, undefined, 1)).toBeCloseTo(0.4167, 6);
  });

  it("0이나 음수는 무시한다 — 디자이너 오투입에 화면이 사라지지 않는다", () => {
    expect(composeScale(0.5, 0, 1)).toBeCloseTo(0.5, 6);
    expect(composeScale(0.5, -2, 1)).toBeCloseTo(0.5, 6);
  });

  it("상자를 늘린 비율도 함께 곱한다 — 에디터에서 끌어 키울 때", () => {
    expect(composeScale(0.4167, 1.1, 2)).toBeCloseTo(0.9167, 4);
  });
});
