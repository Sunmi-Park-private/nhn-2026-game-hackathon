// tests/hex/profile.test.ts — 판을 넘어 누적되는 진행 상태
import { describe, it, expect } from "vitest";
import { emptyProfile, addClear, parseProfile, serializeProfile } from "../../src/engine/profile";

describe("addClear", () => {
  it("구출한 동물과 말굽을 누적하고 다음 스테이지로 넘긴다", () => {
    const p = addClear(emptyProfile(), ["sheep"], 3);
    expect(p).toEqual({ ...emptyProfile(), rescued: ["sheep"], horseshoes: 3, stageIndex: 1 });
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
    expect(a).toEqual(emptyProfile());
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

describe("레이스 필드", () => {
  it("빈 프로필에 raceBest와 boosters가 있다", () => {
    const p = emptyProfile();
    expect(p.raceBest).toEqual({});
    expect(p.boosters).toEqual({ bomb: 0, rainbow: 0, horseshoe: 0 });
  });

  it("두 필드가 없는 구 저장 데이터를 그대로 읽는다", () => {
    const old = JSON.stringify({ rescued: ["rabbit"], horseshoes: 5, stageIndex: 2 });
    const p = parseProfile(old);
    expect(p.rescued).toEqual(["rabbit"]);
    expect(p.horseshoes).toBe(5);
    expect(p.stageIndex).toBe(2);
    expect(p.raceBest).toEqual({});
    expect(p.boosters).toEqual({ bomb: 0, rainbow: 0, horseshoe: 0 });
  });

  it("기록과 재고를 왕복시킨다", () => {
    const p = {
      ...emptyProfile(),
      raceBest: { rabbit: 13.42 },
      boosters: { bomb: 1, rainbow: 0, horseshoe: 2 },
    };
    expect(parseProfile(serializeProfile(p))).toEqual(p);
  });

  it("형태가 어긋난 값은 버린다", () => {
    const bad = JSON.stringify({
      raceBest: { rabbit: "빠름", deer: -1, sheep: 9 },
      boosters: { bomb: "셋" },
    });
    const p = parseProfile(bad);
    expect(p.raceBest).toEqual({ sheep: 9 }); // 문자열과 음수는 버린다
    expect(p.boosters).toEqual({ bomb: 0, rainbow: 0, horseshoe: 0 });
  });

  it("스테이지를 깨도 레이스 기록과 재고가 남는다", () => {
    const p0 = {
      ...emptyProfile(),
      raceBest: { deer: 18 },
      boosters: { bomb: 1, rainbow: 0, horseshoe: 0 },
    };
    const p1 = addClear(p0, ["deer"], 3);
    expect(p1.raceBest).toEqual({ deer: 18 });
    expect(p1.boosters).toEqual({ bomb: 1, rainbow: 0, horseshoe: 0 });
  });
});
