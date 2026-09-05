// tests/race/step.test.ts — 탭 1회가 걸음 하나를 찍고 몸이 따라간다
import { describe, expect, it } from "vitest";
import { RACE } from "../../src/data/race";
import { advance, animState, makeRunner, strideOf, tapStep } from "../../src/engine/race/step";

/** 일정 간격으로 n번 탭하며 60fps로 굴린다. */
function run(r: ReturnType<typeof makeRunner>, gapSec: number, taps: number): void {
  for (let i = 0; i < taps; i++) {
    tapStep(r, gapSec);
    for (let s = 0; s < gapSec - 1e-9; s += 1 / 60) advance(r, 1 / 60);
  }
}

/** 안 누른 채 굴린다 */
function coast(r: ReturnType<typeof makeRunner>, sec: number): void {
  for (let s = 0; s < sec; s += 1 / 60) advance(r, 1 / 60);
}

describe("보폭", () => {
  it("걷기 리듬은 최소 보폭이다", () => {
    expect(strideOf(RACE.SPM_WALK)).toBeCloseTo(RACE.STRIDE_MIN, 10);
  });

  it("질주 리듬은 최대 보폭이다", () => {
    expect(strideOf(RACE.SPM_SPRINT)).toBeCloseTo(RACE.STRIDE_MAX, 10);
  });

  it("범위 밖은 잘린다", () => {
    expect(strideOf(0)).toBe(RACE.STRIDE_MIN);
    expect(strideOf(9999)).toBe(RACE.STRIDE_MAX);
  });
});

describe("걸음", () => {
  it("탭 한 번이 목표를 보폭만큼 앞으로 민다", () => {
    const r = makeRunner("rabbit", 0);
    tapStep(r, 1);
    expect(r.targetX).toBeCloseTo(RACE.STRIDE_MIN, 6);
  });

  it("스펙의 세 속도가 실제로 나온다", () => {
    const cases: Array<[number, number]> = [[1, 0.8], [1 / 3, 4.5], [0.25, 7.4]];
    for (const [gap, expected] of cases) {
      const r = makeRunner("a", 0);
      const taps = Math.round(12 / gap); // 12초어치
      run(r, gap, taps);
      expect(r.targetX / (gap * taps)).toBeCloseTo(expected, 1);
    }
  });

  it("빨리 누를수록 보폭이 커진다", () => {
    const slow = makeRunner("a", 0);
    const fast = makeRunner("b", 1);
    run(slow, 1.0, 6);
    run(fast, 0.25, 6);
    expect(fast.targetX).toBeGreaterThan(slow.targetX * 2);
  });

  it("같은 탭 열은 항상 같은 결과를 낸다", () => {
    const a = makeRunner("a", 0);
    const b = makeRunner("b", 0);
    run(a, 0.3, 20);
    run(b, 0.3, 20);
    expect(a.x).toBeCloseTo(b.x, 10);
  });

  it("목표는 뒤로 가지 않는다", () => {
    const r = makeRunner("a", 0);
    run(r, 0.3, 10);
    const peak = r.targetX;
    coast(r, 5);
    expect(r.targetX).toBe(peak);
  });

  it("손을 떼면 리듬이 식고 몸이 목표에서 멈춘다", () => {
    const r = makeRunner("a", 0);
    run(r, 0.25, 10);
    expect(animState(r.spm)).toBe("sprint");
    coast(r, 5);
    expect(animState(r.spm)).toBe("idle");
    expect(r.x).toBeCloseTo(r.targetX, 3);
  });

  it("몸은 목표를 넘어가지 않는다", () => {
    const r = makeRunner("a", 0);
    run(r, 0.2, 30);
    expect(r.x).toBeLessThanOrEqual(r.targetX + 1e-9);
  });

  it("가만히 두면 리듬이 0에 수렴한다", () => {
    const r = makeRunner("a", 0);
    expect(r.spm).toBe(0);
    tapStep(r, 0.25);
    expect(r.spm).toBeGreaterThan(200);
    coast(r, 30);
    expect(r.spm).toBe(0);
  });

  it("간격이 0 이하면 무시한다 — 같은 프레임에 두 번 들어와도 안 터진다", () => {
    const r = makeRunner("a", 0);
    tapStep(r, 0);
    tapStep(r, -1);
    expect(r.targetX).toBe(0);
    expect(Number.isFinite(r.spm)).toBe(true);
  });

  it("애니메이션 상태가 spm으로 갈린다", () => {
    expect(animState(0)).toBe("idle");
    expect(animState(80)).toBe("walk");
    expect(animState(180)).toBe("run");
    expect(animState(260)).toBe("sprint");
  });
});
