// tests/race/pace.test.ts — AI는 순위와 연출만 책임진다. 보상 규칙과 무관하다.
import { describe, expect, it } from "vitest";
import { RACE } from "../../src/data/race";
import { advanceAi, aiSpeed, makeAiPace } from "../../src/engine/race/pace";
import { makeRunner } from "../../src/engine/race/step";

/** 고정 수열 rng — 같은 값을 넣으면 같은 AI가 나와야 한다 */
const seq = (vals: number[]): (() => number) => {
  let i = 0;
  return () => vals[i++ % vals.length]!;
};

describe("AI 페이스", () => {
  it("기본 속도가 범위 안에 있다", () => {
    for (const v of [0, 0.25, 0.5, 0.75, 0.999]) {
      const p = makeAiPace(seq([v]));
      expect(p.pace).toBeGreaterThanOrEqual(RACE.PACE_MIN);
      expect(p.pace).toBeLessThanOrEqual(RACE.PACE_MAX);
    }
  });

  it("rng를 정확히 세 번 당긴다", () => {
    let n = 0;
    makeAiPace(() => { n++; return 0.5; });
    expect(n).toBe(3);
  });

  it("같은 rng는 같은 AI를 만든다", () => {
    expect(makeAiPace(seq([0.3, 0.6, 0.9]))).toEqual(makeAiPace(seq([0.3, 0.6, 0.9])));
  });

  it("진행률 0.8 전에는 스퍼트가 없다", () => {
    const p = { pace: 5, w: 1, phi: 0 };
    expect(aiSpeed(p, 3, 0.5)).toBeCloseTo(aiSpeed(p, 3, 0.79), 10);
  });

  it("결승 직전에는 빨라진다", () => {
    const p = { pace: 5, w: 1, phi: 0 };
    expect(aiSpeed(p, 3, 1)).toBeGreaterThan(aiSpeed(p, 3, 0.5));
  });

  it("속도가 항상 양수다 — 뒤로 가는 AI는 없다", () => {
    const p = makeAiPace(seq([0, 0, 0]));
    for (let t = 0; t < 30; t += 0.1) expect(aiSpeed(p, t, t / 30)).toBeGreaterThan(0);
  });

  it("리듬이 흔들려 순위가 뒤집힐 여지가 있다", () => {
    const p = makeAiPace(seq([0.5, 0.5, 0]));
    const samples = [];
    for (let t = 0; t < 12; t += 0.25) samples.push(aiSpeed(p, t, 0.3));
    expect(Math.max(...samples) - Math.min(...samples)).toBeGreaterThan(0.5);
  });

  it("advanceAi가 러너를 앞으로만 민다", () => {
    const r = makeRunner("deer", 2);
    const p = makeAiPace(seq([0.5, 0.5, 0.5]));
    let last = 0;
    for (let t = 0; t < 10; t += 1 / 60) {
      advanceAi(r, p, t, 1 / 60);
      expect(r.x).toBeGreaterThanOrEqual(last);
      last = r.x;
    }
    expect(r.x).toBeGreaterThan(10);
  });

  it("100m를 상식적인 시간에 완주한다", () => {
    for (const v of [0, 0.5, 0.999]) {
      const r = makeRunner("a", 0);
      const p = makeAiPace(seq([v, 0.5, 0]));
      let t = 0;
      while (r.x < RACE.DISTANCE && t < 60) { advanceAi(r, p, t, 1 / 60); t += 1 / 60; }
      expect(t).toBeGreaterThan(12);
      expect(t).toBeLessThan(28);
    }
  });
});
