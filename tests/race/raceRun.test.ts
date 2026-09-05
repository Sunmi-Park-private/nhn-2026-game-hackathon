// tests/race/raceRun.test.ts — 6마리가 달리고 순위가 나온다
import { describe, expect, it } from "vitest";
import { RACE } from "../../src/data/race";
import {
  createRace, isRaceOver, myTime, pickAnimal, ranking, tapRace, tickRace,
} from "../../src/engine/race/raceRun";

const IDS = ["rabbit", "monkey", "deer", "sheep", "zebra", "elephant"] as const;
const seq = (vals: number[]): (() => number) => {
  let i = 0;
  return () => vals[i++ % vals.length]!;
};
const half = (): number => 0.5;

/** 아무도 안 누른 채 n초 굴린다 */
function coast(s: ReturnType<typeof createRace>, sec: number): void {
  for (let t = 0; t < sec; t += 1 / 60) tickRace(s, 1 / 60);
}

describe("동물 뽑기", () => {
  it("항상 6종 중에서 뽑는다", () => {
    expect(IDS).toContain(pickAnimal(IDS, [], half));
  });

  it("아무도 못 구했으면 6종 전부가 후보다", () => {
    const got = new Set<string>();
    for (let i = 0; i < 60; i++) got.add(pickAnimal(IDS, [], seq([i / 60])));
    expect(got.size).toBe(6);
  });

  it("구출한 동물이 더 자주 뽑힌다", () => {
    let mine = 0;
    for (let i = 0; i < 100; i++) if (pickAnimal(IDS, ["rabbit"], seq([i / 100])) === "rabbit") mine++;
    // 가중 3:1 → rabbit 3, 나머지 5마리 각 1 → 3/8 = 37.5%
    expect(mine).toBeGreaterThan(25);
    expect(mine).toBeLessThan(50);
  });

  it("rng가 1을 돌려줘도 빈손으로 나가지 않는다", () => {
    expect(IDS).toContain(pickAnimal(IDS, [], () => 1));
  });
});

describe("레이스", () => {
  it("6마리가 레인 0~5에 선다", () => {
    const s = createRace(IDS, "deer", half);
    expect(s.runners).toHaveLength(6);
    expect(s.runners.map((r) => r.lane)).toEqual([0, 1, 2, 3, 4, 5]);
    expect(s.phase).toBe("countdown");
  });

  it("내 동물에는 AI 페이스가 없다", () => {
    const s = createRace(IDS, "deer", half);
    expect(s.ai.deer).toBeUndefined();
    expect(Object.keys(s.ai)).toHaveLength(5);
  });

  it("카운트다운이 끝나면 running으로 넘어간다", () => {
    const s = createRace(IDS, "deer", half);
    coast(s, RACE.COUNTDOWN + 0.1);
    expect(s.phase).toBe("running");
  });

  it("카운트다운 중에는 아무도 안 움직인다", () => {
    const s = createRace(IDS, "deer", half);
    coast(s, RACE.COUNTDOWN - 0.2);
    expect(s.runners.every((r) => r.x === 0)).toBe(true);
  });

  it("카운트다운 중 탭은 무시한다 — 부정 출발이 없다", () => {
    const s = createRace(IDS, "deer", half);
    tapRace(s, 0.2);
    expect(s.runners.find((r) => r.id === "deer")!.targetX).toBe(0);
  });

  it("안 누르면 내 동물은 제자리다", () => {
    const s = createRace(IDS, "deer", half);
    coast(s, RACE.COUNTDOWN + 5);
    expect(s.runners.find((r) => r.id === "deer")!.x).toBe(0);
  });

  it("AI는 스스로 달려 결승에 든다", () => {
    const s = createRace(IDS, "deer", half);
    coast(s, RACE.COUNTDOWN + 40);
    expect(s.runners.filter((r) => r.id !== "deer").every((r) => r.finishedAt !== null)).toBe(true);
  });

  it("연타하면 내 동물이 완주하고 기록이 남는다", () => {
    const s = createRace(IDS, "deer", half);
    coast(s, RACE.COUNTDOWN + 0.02);
    for (let i = 0; i < 400 && !isRaceOver(s); i++) {
      tapRace(s, 0.2);
      for (let k = 0; k < 12; k++) tickRace(s, 1 / 60);
    }
    expect(isRaceOver(s)).toBe(true);
    expect(myTime(s)).toBeGreaterThan(0);
    expect(s.phase).toBe("result");
  });

  it("순위는 결승 통과 순이다", () => {
    const s = createRace(IDS, "deer", half);
    coast(s, RACE.COUNTDOWN + 60);
    const times = ranking(s).map((r) => r.finishedAt ?? Infinity);
    expect([...times].sort((a, b) => a - b)).toEqual(times);
  });

  it("완주 전에는 끝나지 않는다", () => {
    const s = createRace(IDS, "deer", half);
    coast(s, RACE.COUNTDOWN + 5);
    expect(isRaceOver(s)).toBe(false);
    expect(myTime(s)).toBeNull();
  });

  it("결승을 넘은 뒤에는 더 안 움직인다", () => {
    const s = createRace(IDS, "deer", half);
    coast(s, RACE.COUNTDOWN + 60);
    const zebra = s.runners.find((r) => r.id === "zebra")!;
    const at = zebra.x;
    coast(s, 5);
    expect(zebra.x).toBe(at);
  });

  it("결승선을 정확히 100m에서 끊는다 — 넘어간 채로 세지 않는다", () => {
    const s = createRace(IDS, "deer", half);
    coast(s, RACE.COUNTDOWN + 60);
    for (const r of s.runners.filter((x) => x.id !== "deer")) expect(r.x).toBe(RACE.DISTANCE);
  });

  it("기록은 출발 신호 기준이다 — 카운트다운이 안 섞인다", () => {
    const s = createRace(IDS, "deer", half);
    coast(s, RACE.COUNTDOWN + 60);
    const first = ranking(s)[0]!;
    expect(first.finishedAt!).toBeLessThan(28);
  });
});
