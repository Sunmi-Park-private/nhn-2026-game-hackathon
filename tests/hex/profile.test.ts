// tests/hex/profile.test.ts — 판을 넘어 누적되는 진행 상태
import { describe, it, expect } from "vitest";
import { emptyProfile, addClear, parseProfile, serializeProfile } from "../../src/engine/profile";

describe("addClear", () => {
  it("구출한 동물과 말굽을 누적하고 다음 스테이지로 넘긴다", () => {
    const p = addClear(emptyProfile(), ["sheep"], 3);
    expect(p).toEqual({ rescued: ["sheep"], horseshoes: 3, stageIndex: 1 });
  });

  it("같은 동물을 또 구해도 도감에는 한 번만 남는다", () => {
    const p = addClear(addClear(emptyProfile(), ["sheep"], 1), ["sheep", "deer"], 2);
    expect(p.rescued).toEqual(["sheep", "deer"]);
    expect(p.horseshoes).toBe(3);
    expect(p.stageIndex).toBe(2);
  });

  it("원본을 건드리지 않는다", () => {
    const a = emptyProfile();
    addClear(a, ["sheep"], 5);
    expect(a).toEqual({ rescued: [], horseshoes: 0, stageIndex: 0 });
  });
});

describe("parseProfile", () => {
  it("저장한 값을 그대로 되살린다", () => {
    const p = addClear(emptyProfile(), ["sheep", "zebra"], 7);
    expect(parseProfile(serializeProfile(p))).toEqual(p);
  });

  it("없거나 깨진 값이면 빈 프로필 — 게임이 못 뜨는 일은 없어야 한다", () => {
    expect(parseProfile(null)).toEqual(emptyProfile());
    expect(parseProfile("{{{")).toEqual(emptyProfile());
    expect(parseProfile("null")).toEqual(emptyProfile());
  });

  it("타입이 어긋난 필드는 버린다", () => {
    const p = parseProfile('{"rescued":["a",1,null,"b"],"horseshoes":"x","stageIndex":-4}');
    expect(p.rescued).toEqual(["a", "b"]);
    expect(p.horseshoes).toBe(0);
    expect(p.stageIndex).toBe(0);
  });
});
