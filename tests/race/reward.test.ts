// tests/race/reward.test.ts — 보상은 순위가 아니라 자기 기록의 갱신에 걸린다
import { describe, expect, it } from "vitest";
import { emptyProfile } from "../../src/engine/profile";
import { settleRace } from "../../src/engine/race/reward";

const half = (): number => 0.5;
const total = (b: { bomb: number; rainbow: number; horseshoe: number }): number =>
  b.bomb + b.rainbow + b.horseshoe;

describe("보상", () => {
  it("첫 기록은 갱신이고 부스터가 하나 나온다", () => {
    const { profile, reward } = settleRace(emptyProfile(), "deer", 18.5, half);
    expect(reward.improved).toBe(true);
    expect(reward.previous).toBeNull();
    expect(reward.booster).not.toBeNull();
    expect(profile.raceBest.deer).toBe(18.5);
    expect(total(profile.boosters)).toBe(1);
  });

  it("더 빠르면 갱신하고 또 준다", () => {
    const p0 = { ...emptyProfile(), raceBest: { deer: 20 } };
    const { profile, reward } = settleRace(p0, "deer", 17.25, half);
    expect(reward.improved).toBe(true);
    expect(reward.previous).toBe(20);
    expect(profile.raceBest.deer).toBe(17.25);
    expect(total(profile.boosters)).toBe(1);
  });

  it("느리면 아무것도 주지 않고 기록도 그대로다", () => {
    const p0 = {
      ...emptyProfile(),
      raceBest: { deer: 15 },
      boosters: { bomb: 2, rainbow: 0, horseshoe: 0 },
    };
    const { profile, reward } = settleRace(p0, "deer", 19, half);
    expect(reward.improved).toBe(false);
    expect(reward.booster).toBeNull();
    expect(reward.previous).toBe(15);
    expect(profile.raceBest.deer).toBe(15);
    expect(profile.boosters).toEqual({ bomb: 2, rainbow: 0, horseshoe: 0 });
  });

  it("같은 기록은 갱신이 아니다", () => {
    const p0 = { ...emptyProfile(), raceBest: { deer: 15 } };
    expect(settleRace(p0, "deer", 15, half).reward.improved).toBe(false);
  });

  it("동물마다 기록이 따로 쌓인다", () => {
    const a = settleRace(emptyProfile(), "deer", 18, half).profile;
    const b = settleRace(a, "zebra", 25, half).profile;
    expect(b.raceBest).toEqual({ deer: 18, zebra: 25 });
    expect(total(b.boosters)).toBe(2);
  });

  it("rng가 부스터 종류를 정한다", () => {
    const pick = (v: number): string | null =>
      settleRace(emptyProfile(), "deer", 10, () => v).reward.booster;
    expect(pick(0)).toBe("bomb");
    expect(pick(0.5)).toBe("rainbow");
    expect(pick(0.99)).toBe("horseshoe");
    expect(pick(1)).toBe("horseshoe"); // 경계에서 배열 밖으로 나가지 않는다
  });

  it("재고에 더한다 — 덮어쓰지 않는다", () => {
    const p0 = { ...emptyProfile(), boosters: { bomb: 0, rainbow: 4, horseshoe: 0 } };
    const { profile } = settleRace(p0, "deer", 10, () => 0.5); // rainbow
    expect(profile.boosters.rainbow).toBe(5);
  });

  it("원래 프로필을 건드리지 않는다", () => {
    const p0 = emptyProfile();
    settleRace(p0, "deer", 10, half);
    expect(p0.raceBest).toEqual({});
    expect(p0.boosters).toEqual({ bomb: 0, rainbow: 0, horseshoe: 0 });
  });

  it("반복 파밍이 규칙 안에서 닫힌다 — 같은 기록을 다시 내도 안 준다", () => {
    let p = emptyProfile();
    for (let i = 0; i < 10; i++) p = settleRace(p, "deer", 18, half).profile;
    expect(total(p.boosters)).toBe(1);
  });
});
