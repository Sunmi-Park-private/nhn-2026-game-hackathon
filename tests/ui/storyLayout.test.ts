// tests/ui/storyLayout.test.ts — 대사창 배치와 초상 에셋 배선.
//
// gameOverLayout.test.ts와 같은 규칙이다: 두 경로(JSON·폴백)가 **각각** 말이 되는지 보고,
// 좌표가 서로 같은지는 보지 않는다 — 에디터가 JSON을 고칠 때마다 빨개지면 안 된다.
import { describe, it, expect } from "vitest";
import { uiAreas, uiUploads } from "../../src/data/uiLayout";
import type { UiSlot } from "../../src/data/uiLayout";
import { storyAssetPaths } from "../../src/data/hexAssets";
import { ANIMALS } from "../../src/data/animals";
import { STORY_AREA, STORY_FALLBACK } from "../../src/ui/storyLayout";

const area = uiAreas.find((a) => a.id === STORY_AREA);
const slotOf = (id: string): UiSlot | undefined => area?.slots.find((s) => s.id === id);

type Box = { x: number; y: number; w: number; h: number };

/** 콘텐츠 컬럼 450×800 안에 있고 크기가 있는가. 패널·초상이 화면 밖으로 나가면 안 보인다. */
function checkBoxes(name: string, get: (id: string) => Box | undefined): void {
  for (const id of Object.keys(STORY_FALLBACK)) {
    const b = get(id);
    expect(b, `${name}: ${id}이 없다`).toBeDefined();
    expect(b!.w, `${name}: ${id}의 폭이 0 이하다`).toBeGreaterThan(0);
    expect(b!.h, `${name}: ${id}의 높이가 0 이하다`).toBeGreaterThan(0);
    expect(b!.x, `${name}: ${id}이 왼쪽으로 벗어난다`).toBeGreaterThanOrEqual(0);
    expect(b!.y, `${name}: ${id}이 위로 벗어난다`).toBeGreaterThanOrEqual(0);
    expect(b!.x + b!.w, `${name}: ${id}이 오른쪽으로 벗어난다`).toBeLessThanOrEqual(450);
    expect(b!.y + b!.h, `${name}: ${id}이 아래로 벗어난다`).toBeLessThanOrEqual(800);
  }
  // 초상은 대사창 **위**에 선다 — 겹쳐 놓으면 얼굴이 판에 가린다
  expect(get("horse")!.y, `${name}: 붉은말이 대사창 아래로 내려갔다`).toBeLessThan(get("panel")!.y);
  expect(get("animal")!.y, `${name}: 동물이 대사창 아래로 내려갔다`).toBeLessThan(get("panel")!.y);
  // 붉은말이 왼쪽, 동물이 오른쪽
  expect(get("horse")!.x, `${name}: 붉은말이 동물보다 오른쪽에 있다`).toBeLessThan(get("animal")!.x);
}

describe("대사창 배치", () => {
  it("에디터 탭이 뜨도록 uiLayout.json에 영역이 있다", () => {
    expect(area, "story 영역이 없으면 /ui.html에 「대사」 탭이 안 생긴다").toBeDefined();
    expect(area!.label).toBe("대사");
  });

  it("슬롯은 폴백과 같은 칸이다", () => {
    expect(area!.slots.map((s) => s.id).sort()).toEqual(Object.keys(STORY_FALLBACK).sort());
  });

  it("JSON의 배치가 쓸 수 있는 모양이다", () => {
    checkBoxes("JSON", (id) => slotOf(id));
  });

  it("코드의 폴백도 같은 검사를 통과한다", () => {
    checkBoxes("폴백", (id) => (STORY_FALLBACK as Record<string, Box>)[id]);
  });
});

describe("대사창 초상 에셋", () => {
  it("붉은말은 한 장이고 매니페스트에 자리가 있다", () => {
    expect(storyAssetPaths.horse, "assets.json의 story.horse가 없다 — 올릴 자리가 없다").toBeTruthy();
    expect(slotOf("horse")?.asset, "붉은말 슬롯이 story.horse를 안 가리킨다").toBe("story.horse");
  });

  it("동물은 도감 6종 전부에 자리가 있다", () => {
    for (const a of ANIMALS) {
      expect(storyAssetPaths.animals[a.id], `assets.json의 story.animals.${a.id}가 없다`).toBeTruthy();
    }
    expect(Object.keys(storyAssetPaths.animals).sort()).toEqual(ANIMALS.map((a) => a.id).sort());
  });

  it("일곱 칸이 에디터 「대사」 탭의 업로드 묶음에 뜬다", () => {
    const group = uiUploads.filter((u) => u.group === "대사 · 초상");
    expect(group.map((u) => u.asset)).toEqual([
      "story.horse",
      ...ANIMALS.map((a) => `story.animals.${a.id}`),
    ]);
  });

  it("동물 초상 슬롯은 아트를 직접 물지 않는다 — 판마다 다른 동물이 온다", () => {
    expect(slotOf("animal")?.asset).toBeUndefined();
  });
});
