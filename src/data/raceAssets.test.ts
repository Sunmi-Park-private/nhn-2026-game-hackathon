// 매니페스트 파서 — 디자이너 오투입이 화면이 아니라 여기서 드러나야 한다(규약 3조)
import { describe, expect, it } from "vitest";
import { parseRaceAssets, raceAssetPaths, RACE_SLOT_IDS } from "./raceAssets";
import { uiAreas } from "./uiLayout";

describe("레이스 매니페스트", () => {
  it("현재 매니페스트에서 3층 배경과 러너 6종을 읽는다", () => {
    expect(raceAssetPaths.bg.sky).toBeTruthy();
    expect(raceAssetPaths.bg.mid).toBeTruthy();
    expect(raceAssetPaths.bg.track).toBeTruthy();
    expect(Object.keys(raceAssetPaths.runners)).toHaveLength(6);
    expect(Object.keys(raceAssetPaths.booster)).toHaveLength(3);
  });

  it("race 노드가 없으면 빈 결과를 낸다 — 던지지 않는다", () => {
    const out = parseRaceAssets({});
    expect(out.bg).toEqual({});
    expect(out.runners).toEqual({});
    expect(out.ui).toEqual({});
    expect(out.booster).toEqual({});
  });

  it("null과 원시값을 먹어도 던지지 않는다", () => {
    for (const bad of [null, undefined, 3, "x", { race: null }, { race: { bg: 7, runners: "no" } }]) {
      expect(() => parseRaceAssets(bad)).not.toThrow();
    }
  });

  it("빈 문자열과 잘못된 타입을 버린다", () => {
    const out = parseRaceAssets({ race: { bg: { sky: "", mid: 3, track: "t.webp" }, runners: { deer: [] } } });
    expect(out.bg.sky).toBeUndefined();
    expect(out.bg.mid).toBeUndefined();
    expect(out.bg.track).toBe("t.webp");
    expect(out.runners.deer).toBeUndefined(); // 프레임이 0장이면 키가 빠진다
  });

  it("러너는 한 장이든 여러 장이든 프레임 목록이 된다", () => {
    const out = parseRaceAssets({ race: { runners: { deer: "a.png", zebra: ["a.png", "b.png"] } } });
    expect(out.runners.deer).toEqual(["a.png"]);
    expect(out.runners.zebra).toEqual(["a.png", "b.png"]);
  });

  it("매니페스트에 없는 ui 키는 무시한다", () => {
    const out = parseRaceAssets({ race: { ui: { run: "r.png", 없는키: "x.png" } } });
    expect(out.ui).toEqual({ run: "r.png" });
  });
});

describe("슬롯 id", () => {
  it("코드의 목록과 uiLayout.json의 race 영역이 정확히 같다", () => {
    const inJson = uiAreas.find((a) => a.id === "race")?.slots.map((s) => s.id) ?? [];
    expect([...inJson].sort()).toEqual([...RACE_SLOT_IDS].sort());
  });
});
