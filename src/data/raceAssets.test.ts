// 매니페스트 파서 — 디자이너 오투입이 화면이 아니라 여기서 드러나야 한다(규약 3조)
import { describe, expect, it } from "vitest";
import { parseRaceAssets, raceAssetPaths } from "./raceAssets";
import { ANIMALS } from "./animals";

describe("레이스 매니페스트", () => {
  it("시안 3화면의 배경과 UI를 읽는다", () => {
    expect(raceAssetPaths.bg.selectScene).toBeTruthy();
    expect(raceAssetPaths.bg.raceScene).toBeTruthy();
    expect(raceAssetPaths.bg.resultScene).toBeTruthy();
    expect(raceAssetPaths.bg.trackTile).toBeTruthy();
    expect(Object.keys(raceAssetPaths.ui)).toHaveLength(8);
  });

  it("동물 아트가 세 벌 — 달리기·얼굴·1위", () => {
    const ids = ANIMALS.map((a) => a.id).sort();
    expect(Object.keys(raceAssetPaths.runners).sort()).toEqual(ids);
    expect(Object.keys(raceAssetPaths.faces).sort()).toEqual(ids);
    expect(Object.keys(raceAssetPaths.winner).sort()).toEqual(ids);
  });

  it("카드 6종이 한 장으로 온다", () => {
    expect(raceAssetPaths.card.grid).toBeTruthy();
    expect(raceAssetPaths.card.on).toBeTruthy();   // 선택 테두리
  });

  it("카드·행 판·메달·깃발이 다 있다", () => {
    expect(Object.keys(raceAssetPaths.card)).toHaveLength(3); // grid · on · off
    expect(Object.keys(raceAssetPaths.row)).toHaveLength(2);
    expect(Object.keys(raceAssetPaths.medal)).toHaveLength(3);
    expect(Object.keys(raceAssetPaths.flags)).toHaveLength(6);
    expect(Object.keys(raceAssetPaths.booster)).toHaveLength(3);
  });

  it("race 노드가 없으면 빈 결과를 낸다 — 던지지 않는다", () => {
    const out = parseRaceAssets({});
    expect(out.bg).toEqual({});
    expect(out.runners).toEqual({});
    expect(out.faces).toEqual({});
    expect(out.ui).toEqual({});
  });

  it("null과 원시값을 먹어도 던지지 않는다", () => {
    for (const bad of [null, undefined, 3, "x", { race: null }, { race: { bg: 7, runners: "no" } }]) {
      expect(() => parseRaceAssets(bad)).not.toThrow();
    }
  });

  it("빈 문자열과 잘못된 타입을 버린다", () => {
    const out = parseRaceAssets({
      race: { bg: { selectScene: "", raceScene: 3, trackTile: "t.webp" }, runners: { deer: [] }, faces: { deer: "" } },
    });
    expect(out.bg.selectScene).toBeUndefined();
    expect(out.bg.raceScene).toBeUndefined();
    expect(out.bg.trackTile).toBe("t.webp");
    expect(out.runners.deer).toBeUndefined(); // 프레임이 0장이면 키가 빠진다
    expect(out.faces.deer).toBeUndefined();
  });

  it("달리기는 한 장이든 여러 장이든 프레임 목록이 된다", () => {
    const out = parseRaceAssets({ race: { runners: { deer: "a.png", zebra: ["a.png", "b.png"] } } });
    expect(out.runners.deer).toEqual(["a.png"]);
    expect(out.runners.zebra).toEqual(["a.png", "b.png"]);
  });

  it("매니페스트에 없는 ui 키는 무시한다", () => {
    const out = parseRaceAssets({ race: { ui: { btnRace: "r.png", 없는키: "x.png" } } });
    expect(out.ui).toEqual({ btnRace: "r.png" });
  });
});
