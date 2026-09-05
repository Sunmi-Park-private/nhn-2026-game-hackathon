// tests/hex/confirmLayout.test.ts — 확인창 배치가 쓸 수 있는 상태인지.
//
// 확인창은 슬롯이 있으면 그 좌표로, 없으면 코드의 폴백으로 그린다. 아트가 아직 없어
// 눈으로는 어느 쪽도 안 보이므로, 두 경로가 **각각 말이 되는지**를 여기서 본다.
//
// 좌표가 서로 **같은지**는 일부러 보지 않는다 — 디자이너가 /ui.html에서 창을 옮기면
// 자동 저장이 JSON을 고치는데, 그때마다 아무도 안 건드린 테스트가 빨개진다.
// 폴백의 일은 「JSON이 없을 때 창이 안 깨지는 것」이지 JSON을 얼어붙이는 것이 아니다.
import { describe, it, expect } from "vitest";
import { uiAreas } from "../../src/data/uiLayout";
import type { UiSlot } from "../../src/data/uiLayout";
import { uiAssetPaths } from "../../src/data/hexAssets";
import { CONFIRM_AREA, CONFIRM_FALLBACK, CONFIRM_ASSETS } from "../../src/ui/confirmLayout";

const area = uiAreas.find((a) => a.id === CONFIRM_AREA);
const slotOf = (id: string): UiSlot | undefined => area?.slots.find((s) => s.id === id);

type Box = { x: number; y: number; w: number; h: number };

/** 두 경로에 똑같이 적용하는 검사 — 이게 「쓸 수 있는 배치」의 정의다. */
function checkBoxes(name: string, get: (id: string) => Box | undefined): void {
  const panel = get("panel")!;
  for (const id of Object.keys(CONFIRM_FALLBACK)) {
    const b = get(id);
    expect(b, `${name}: ${id}이 없다`).toBeDefined();
    expect(b!.w, `${name}: ${id}의 폭이 0 이하다`).toBeGreaterThan(0);
    expect(b!.h, `${name}: ${id}의 높이가 0 이하다`).toBeGreaterThan(0);
    if (id === "panel") continue;
    // 패널 밖으로 나가면 아트가 붙었을 때 버튼이 허공에 뜬다
    expect(b!.x >= panel.x && b!.x + b!.w <= panel.x + panel.w, `${name}: ${id}이 패널 좌우를 넘는다`).toBe(true);
    expect(b!.y >= panel.y && b!.y + b!.h <= panel.y + panel.h, `${name}: ${id}이 패널 위아래를 넘는다`).toBe(true);
  }
  // 되돌릴 수 없는 쪽이 오른쪽이다 — 「계속하기 · 홈으로」와 같은 방향으로 읽혀야 한다
  expect(get("cancel")!.x, `${name}: 취소가 확인보다 오른쪽에 있다`).toBeLessThan(get("ok")!.x);
}

describe("확인창 배치", () => {
  it("에디터 탭이 뜨도록 uiLayout.json에 영역이 있다", () => {
    expect(area, "confirm 영역이 없으면 /ui.html에 탭이 안 생긴다").toBeDefined();
    expect(area!.label).toBe("확인창");
  });

  it("슬롯은 폴백과 같은 네 칸이다 — 한쪽에만 있는 칸은 조용히 폴백으로 샌다", () => {
    expect(area!.slots.map((s) => s.id).sort()).toEqual(Object.keys(CONFIRM_FALLBACK).sort());
  });

  it("JSON의 배치가 쓸 수 있는 모양이다", () => {
    checkBoxes("JSON", (id) => slotOf(id));
  });

  it("코드의 폴백도 같은 검사를 통과한다 — 슬롯이 없을 때 이쪽이 그려진다", () => {
    checkBoxes("폴백", (id) => (CONFIRM_FALLBACK as Record<string, Box>)[id]);
  });
});

describe("확인창 에셋", () => {
  it("아트를 얹는 세 칸은 매니페스트에 자리가 있다", () => {
    for (const [id, key] of Object.entries(CONFIRM_ASSETS)) {
      expect(uiAssetPaths[key], `assets.json의 ui.${key}가 없다 — 에디터가 올릴 자리가 없다`).toBeTruthy();
      expect(slotOf(id)?.asset, `${id} 슬롯이 ui.${key}를 안 가리킨다`).toBe(`ui.${key}`);
    }
  });

  it("묻는 말은 코드가 그린다 — 아트를 주지 않는다", () => {
    expect(slotOf("message")?.asset).toBeUndefined();
    expect(CONFIRM_ASSETS).not.toHaveProperty("message");
  });
});
