// tests/hex/pushMotion.test.ts — 줄이 내려올 때의 움직임.
//
// 진폭 2px에 17Hz다. 스크린샷으로는 위상이 무작위라 확인이 안 된다 —
// 값으로 잡는다.
import { describe, it, expect } from "vitest";
import {
  shakeX, slideY, slideDone,
  SHAKE_LEAD_MS, SHAKE_AMP, SLIDE_MS,
} from "../../src/ui/hex/pushMotion";
import { ROW_H } from "../../src/ui/hex/geom";

/** 한 주기를 촘촘히 훑어 진폭의 최대값을 잰다 — 위상에 기대지 않는다. */
function peak(msUntilPush: number): number {
  let max = 0;
  for (let i = 0; i < 400; i += 1) {
    max = Math.max(max, Math.abs(shakeX(msUntilPush, i * 1.5)));
  }
  return max;
}

describe("shakeX — 밀기 직전의 자글자글", () => {
  it("아직 멀면 아예 떨지 않는다", () => {
    expect(peak(SHAKE_LEAD_MS + 1)).toBe(0);
    expect(peak(10_000)).toBe(0);
  });

  it("임박할수록 세진다", () => {
    const far = peak(SHAKE_LEAD_MS * 0.9);
    const mid = peak(SHAKE_LEAD_MS * 0.5);
    const near = peak(0);
    expect(far).toBeLessThan(mid);
    expect(mid).toBeLessThan(near);
  });

  it("최대 진폭을 넘지 않는다 — 「자글자글」이지 「흔들린다」가 아니다", () => {
    expect(peak(0)).toBeLessThanOrEqual(SHAKE_AMP + 1e-9);
    expect(peak(0)).toBeGreaterThan(SHAKE_AMP * 0.9);
  });

  it("세기가 제곱으로 커진다 — 선형이면 8초 전부터 어렴풋이 떨려 경고로 안 읽힌다", () => {
    // 절반 남았을 때의 세기는 선형이면 0.5, 제곱이면 0.25다.
    const ratio = peak(SHAKE_LEAD_MS * 0.5) / peak(0);
    expect(ratio).toBeGreaterThan(0.2);
    expect(ratio).toBeLessThan(0.3);
  });

  it("음수 시간(이미 지났음)도 최대 세기로 다룬다", () => {
    expect(peak(-500)).toBeCloseTo(peak(0), 6);
  });
});

describe("slideY — 새 줄이 내려앉는다", () => {
  it("시작은 이전 자리다 — 판은 이미 한 칸 아래에 그려져 있다", () => {
    expect(slideY(0)).toBeCloseTo(-ROW_H, 6);
  });

  it("끝나면 제자리다", () => {
    expect(slideY(SLIDE_MS)).toBe(0);
    expect(slideY(SLIDE_MS * 2)).toBe(0);
  });

  it("끝에서 살짝 지나쳤다 돌아온다 — 이 과함이 「뿅」이다", () => {
    let overshot = false;
    for (let t = 0; t < SLIDE_MS; t += 1) if (slideY(t) > 0.05) overshot = true;
    expect(overshot).toBe(true);
  });

  it("지나침이 과하지 않다 — 한 칸의 1/4을 넘지 않는다", () => {
    let max = 0;
    for (let t = 0; t < SLIDE_MS; t += 0.5) max = Math.max(max, slideY(t));
    expect(max).toBeLessThan(ROW_H / 4);
  });

  it("전체적으로 위에서 아래로 간다", () => {
    expect(slideY(SLIDE_MS * 0.25)).toBeLessThan(slideY(SLIDE_MS * 0.75));
  });

  it("slideDone이 끝을 알린다", () => {
    expect(slideDone(SLIDE_MS - 1)).toBe(false);
    expect(slideDone(SLIDE_MS)).toBe(true);
  });
});
