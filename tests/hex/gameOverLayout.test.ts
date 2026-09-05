// tests/hex/gameOverLayout.test.ts — 게임오버 창 배치가 쓸 수 있는 상태인지.
// confirmLayout.test.ts와 같은 규칙이다: 두 경로(JSON·폴백)가 각각 말이 되는지 보고,
// 좌표가 서로 같은지는 보지 않는다 — 에디터 자동 저장이 JSON을 고칠 때마다 빨개지면 안 된다.
import { describe, it, expect } from "vitest";
import { uiAreas } from "../../src/data/uiLayout";
import type { UiSlot } from "../../src/data/uiLayout";
import { uiAssetPaths } from "../../src/data/hexAssets";
import { GAMEOVER_AREA, GAMEOVER_FALLBACK, GAMEOVER_ASSETS } from "../../src/ui/gameOverLayout";

const area = uiAreas.find((a) => a.id === GAMEOVER_AREA);
const slotOf = (id: string): UiSlot | undefined => area?.slots.find((s) => s.id === id);

type Box = { x: number; y: number; w: number; h: number };

function checkBoxes(name: string, get: (id: string) => Box | undefined): void {
  const panel = get("panel")!;
  for (const id of Object.keys(GAMEOVER_FALLBACK)) {
    const b = get(id);
    expect(b, `${name}: ${id}이 없다`).toBeDefined();
    expect(b!.w, `${name}: ${id}의 폭이 0 이하다`).toBeGreaterThan(0);
    expect(b!.h, `${name}: ${id}의 높이가 0 이하다`).toBeGreaterThan(0);
    if (id === "panel") continue;
    expect(b!.x >= panel.x && b!.x + b!.w <= panel.x + panel.w, `${name}: ${id}이 패널 좌우를 넘는다`).toBe(true);
    expect(b!.y >= panel.y && b!.y + b!.h <= panel.y + panel.h, `${name}: ${id}이 패널 위아래를 넘는다`).toBe(true);
  }
  // 다시 도전이 오른쪽 — 기본 동선이 오른손 자리에 온다
  expect(get("lobby")!.x, `${name}: 로비가 다시 도전보다 오른쪽에 있다`).toBeLessThan(get("retry")!.x);
}

describe("게임오버 창 배치", () => {
  it("에디터 탭이 뜨도록 uiLayout.json에 영역이 있다", () => {
    expect(area, "gameover 영역이 없으면 /ui.html에 탭이 안 생긴다").toBeDefined();
    expect(area!.label).toBe("게임오버");
  });

  it("슬롯은 폴백과 같은 다섯 칸이다", () => {
    expect(area!.slots.map((s) => s.id).sort()).toEqual(Object.keys(GAMEOVER_FALLBACK).sort());
  });

  it("JSON의 배치가 쓸 수 있는 모양이다", () => {
    checkBoxes("JSON", (id) => slotOf(id));
  });

  it("코드의 폴백도 같은 검사를 통과한다", () => {
    checkBoxes("폴백", (id) => (GAMEOVER_FALLBACK as Record<string, Box>)[id]);
  });
});

describe("게임오버 창 에셋", () => {
  it("아트를 얹는 세 칸은 매니페스트에 자리가 있다", () => {
    for (const [id, key] of Object.entries(GAMEOVER_ASSETS)) {
      expect(uiAssetPaths[key], `assets.json의 ui.${key}가 없다 — 에디터가 올릴 자리가 없다`).toBeTruthy();
      expect(slotOf(id)?.asset, `${id} 슬롯이 ui.${key}를 안 가리킨다`).toBe(`ui.${key}`);
    }
  });

  it("제목·안내문은 코드가 그린다 — 아트를 주지 않는다", () => {
    expect(slotOf("title")?.asset).toBeUndefined();
    expect(slotOf("message")?.asset).toBeUndefined();
  });
});
