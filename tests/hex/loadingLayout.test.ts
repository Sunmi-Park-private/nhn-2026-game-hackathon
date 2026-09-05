// tests/hex/loadingLayout.test.ts — 게임시작 로딩 화면의 배치·배선이 쓸 수 있는 상태인지.
// gameOverLayout.test.ts와 같은 규칙: JSON과 폴백이 각각 말이 되는지 보고, 둘의 좌표가
// 같은지는 보지 않는다 — 에디터 자동 저장이 JSON을 고칠 때마다 빨개지면 안 된다.
import { describe, it, expect } from "vitest";
import { uiAreas, uiVideos } from "../../src/data/uiLayout";
import { VIDEO_SLOT_IDS, videoAssetPaths } from "../../src/data/hexAssets";
import {
  LOADING_AREA, LOADING_FALLBACK, loadingFraction, panelPercent,
} from "../../src/ui/loadingLayout";

const inside = (b: { x: number; y: number; w: number; h: number }): boolean =>
  b.w > 0 && b.h > 0 && b.x >= 0 && b.y >= 0 && b.x + b.w <= 450 && b.y + b.h <= 800;

describe("로딩 진행률", () => {
  it("시작한 것이 없으면 0 — 0/0이 NaN으로 새면 게이지가 사라진다", () => {
    expect(loadingFraction(0, 0)).toBe(0);
  });
  it("settled / started", () => {
    expect(loadingFraction(2, 4)).toBe(0.5);
  });
  it("1을 넘지 않는다", () => {
    expect(loadingFraction(5, 4)).toBe(1);
  });
});

describe("패널 백분율", () => {
  it("450×800 좌표를 컬럼 백분율로 바꾼다", () => {
    expect(panelPercent({ x: 45, y: 200, w: 225, h: 80 })).toEqual({ left: 10, top: 25, width: 50, height: 10 });
  });
});

describe("게임시작 로딩 배치", () => {
  const area = uiAreas.find((a) => a.id === LOADING_AREA);

  it("uiLayout.json에 영역이 있고 에디터 탭 이름이 있다", () => {
    expect(area).toBeDefined();
    expect(area!.label.length).toBeGreaterThan(0);
  });

  it("패널 슬롯이 컬럼 안에 있다 — JSON과 폴백 각각", () => {
    const json = area!.slots.find((s) => s.id === "panel");
    expect(json).toBeDefined();
    expect(inside(json!)).toBe(true);
    expect(inside(LOADING_FALLBACK.panel)).toBe(true);
  });
});

describe("인트로 탭", () => {
  it("에디터 첫 탭이 인트로다 — 게임이 여는 순서와 같다", () => {
    expect(uiAreas[0]?.id).toBe("intro");
    expect(uiAreas[1]?.id).toBe(LOADING_AREA);
  });
  it("인트로 영상 슬롯이 에디터 영상 목록에 있다", () => {
    expect(uiVideos.find((v) => v.asset === "video.intro")).toBeDefined();
  });
});

describe("게임시작 로딩 영상 배선", () => {
  it("영상 슬롯 id에 loading이 있고 매니페스트 경로가 문자열이다", () => {
    expect(VIDEO_SLOT_IDS).toContain("loading");
    expect(typeof videoAssetPaths.loading).toBe("string");
  });

  it("에디터 영상 목록에도 같은 슬롯이 있다 — 없으면 올릴 곳이 없다", () => {
    expect(uiVideos.find((v) => v.asset === "video.loading")).toBeDefined();
  });
});
