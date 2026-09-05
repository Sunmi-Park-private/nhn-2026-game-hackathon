// tests/hex/handSlot.test.ts — 붉은말이 든 타일이 앞발을 따라가는가.
//
// 몸이 기울면 회전축(발 밑)에서 먼 앞발이 크게 움직인다. 타일 자리를 고정해 두면
// 앞발은 옆으로 갔는데 타일만 가운데 남는다 — 실제로 그렇게 되어 있었다.
import { describe, it, expect } from "vitest";
import { handSlot } from "../../src/ui/hex/handSlot";

const ORIGIN = { x: 230, y: 600 };
/** 말 앵커는 하단 중앙 — 발사 지점보다 아래다. */
const PIVOT_Y = 700;
const ARM = PIVOT_Y - ORIGIN.y; // 축에서 손까지의 거리 100

describe("handSlot", () => {
  it("기울지 않았으면 발사 지점 그대로다", () => {
    const p = handSlot(ORIGIN, PIVOT_Y, 0);
    expect(p.x).toBeCloseTo(ORIGIN.x, 9);
    expect(p.y).toBeCloseTo(ORIGIN.y, 9);
  });

  it("오른쪽으로 기울면 손이 오른쪽으로 간다", () => {
    expect(handSlot(ORIGIN, PIVOT_Y, 0.4).x).toBeGreaterThan(ORIGIN.x);
  });

  it("왼쪽으로 기울면 손이 왼쪽으로 간다", () => {
    expect(handSlot(ORIGIN, PIVOT_Y, -0.4).x).toBeLessThan(ORIGIN.x);
  });

  it("좌우가 대칭이다", () => {
    const r = handSlot(ORIGIN, PIVOT_Y, 0.4);
    const l = handSlot(ORIGIN, PIVOT_Y, -0.4);
    expect(r.x - ORIGIN.x).toBeCloseTo(ORIGIN.x - l.x, 9);
    expect(r.y).toBeCloseTo(l.y, 9);
  });

  it("축에서의 거리가 변하지 않는다 — 팔 길이는 고정이다", () => {
    for (const rot of [-1.2, -0.5, 0, 0.3, 0.9]) {
      const p = handSlot(ORIGIN, PIVOT_Y, rot);
      const d = Math.hypot(p.x - ORIGIN.x, p.y - PIVOT_Y);
      expect(d).toBeCloseTo(ARM, 9);
    }
  });

  it("기울면 손이 내려온다 — 팔이 옆으로 눕는 만큼 높이를 잃는다", () => {
    expect(handSlot(ORIGIN, PIVOT_Y, 0.4).y).toBeGreaterThan(ORIGIN.y);
  });

  it("실제 기울기 범위에서 눈에 띄게 움직인다", () => {
    // 조준각 상한 1.25 × TILT_RATIO 0.35 ≈ 0.44rad.
    // 팔 길이 100이면 가로로 40px 넘게 움직인다 — 고정해 두면 안 되는 크기다.
    const p = handSlot(ORIGIN, PIVOT_Y, 1.25 * 0.35);
    expect(p.x - ORIGIN.x).toBeGreaterThan(40);
  });

  it("말이 없어 축이 발사 지점과 같으면 언제나 제자리다", () => {
    const p = handSlot(ORIGIN, ORIGIN.y, 0.9);
    expect(p.x).toBeCloseTo(ORIGIN.x, 9);
    expect(p.y).toBeCloseTo(ORIGIN.y, 9);
  });
});
