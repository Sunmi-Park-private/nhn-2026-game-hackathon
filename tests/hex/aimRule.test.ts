// tests/hex/aimRule.test.ts — 「첫 반사가 판 하단 1/3이면 쏘지 못한다」.
//
// 규칙을 손으로 계산한 각도가 아니라 **실제 시뮬레이터**로 잰다. 궤적에는 중력이
// 들어 있어서 삼각함수로 낸 한계각과 실제 반사 위치가 어긋난다 — 어긋나는 쪽을
// 코드가 아니라 여기서 잡아야 한다.
import { describe, it, expect } from "vitest";
import { simulateShot } from "../../src/engine/hex/shot";
import { BOARD, launchOriginLocal } from "../../src/ui/hex/geom";
import { aimBlocked, FIRST_BOUNCE_LIMIT_Y, BLOCKED_BAND } from "../../src/ui/hex/aimRule";
import { MAX_ANGLE } from "../../src/ui/hex/dragAim";
import type { Cell } from "../../src/engine/hex/types";

const EMPTY = new Map<string, Cell>(); // 빈 판 — 벽 반사만 남는다
const from = launchOriginLocal();

const bouncesFor = (angle: number, power: number): Array<{ x: number; y: number }> =>
  simulateShot(EMPTY, BOARD, from, angle, power).bounces;

/** 각도 × 파워를 촘촘히 훑는다. 규칙은 두 축 어디서도 새면 안 된다. */
function sweep(): Array<{ angle: number; power: number; bounces: Array<{ y: number }> }> {
  const out = [];
  for (let a = -MAX_ANGLE; a <= MAX_ANGLE + 1e-9; a += MAX_ANGLE / 24) {
    for (let p = 0; p <= 1 + 1e-9; p += 0.1) {
      out.push({ angle: a, power: p, bounces: bouncesFor(a, p) });
    }
  }
  return out;
}

describe("첫 반사 금지 구역", () => {
  it("한계선이 판 세로의 아래 1/3 자리다", () => {
    expect(BLOCKED_BAND).toBeCloseTo(1 / 3, 12);
    expect(FIRST_BOUNCE_LIMIT_Y).toBeGreaterThan(0); // 천장보다 아래
    expect(FIRST_BOUNCE_LIMIT_Y).toBeLessThan(from.y); // 발사 지점보다 위
  });

  it("막히지 않은 조준은 첫 반사가 늘 한계선 위다", () => {
    for (const s of sweep()) {
      if (aimBlocked(s.bounces)) continue;
      const first = s.bounces[0];
      if (first === undefined) continue; // 벽에 안 닿는 발 — 막을 것이 없다
      expect(first.y, `각 ${s.angle.toFixed(2)} 파워 ${s.power.toFixed(1)}`)
        .toBeLessThanOrEqual(FIRST_BOUNCE_LIMIT_Y);
    }
  });

  it("규칙이 실제로 무언가를 막는다 — 늘 통과하면 규칙이 없는 것과 같다", () => {
    const all = sweep();
    const blocked = all.filter((s) => aimBlocked(s.bounces));
    expect(blocked.length).toBeGreaterThan(0);
    // 그렇다고 전부 막으면 게임이 안 된다
    expect(blocked.length).toBeLessThan(all.length);
  });

  it("최대 각도로 눕혀 쏘면 막힌다 — 지그재그를 만들던 그 각이다", () => {
    expect(aimBlocked(bouncesFor(MAX_ANGLE, 0.5))).toBe(true);
    expect(aimBlocked(bouncesFor(-MAX_ANGLE, 0.5))).toBe(true);
  });

  it("똑바로 위로 쏘는 발은 막지 않는다 — 첫 반사가 없다", () => {
    expect(aimBlocked(bouncesFor(0, 0.5))).toBe(false);
    expect(bouncesFor(0, 0.5)).toHaveLength(0);
  });

  it("두 번째 반사부터는 어디서 일어나든 상관없다", () => {
    // 하단에서 튕기는 반사가 뒤쪽에 있어도, 첫 반사만 위쪽이면 통과한다
    const withLateLow = [{ x: 0, y: FIRST_BOUNCE_LIMIT_Y - 10 }, { x: 0, y: FIRST_BOUNCE_LIMIT_Y + 200 }];
    expect(aimBlocked(withLateLow)).toBe(false);
  });
});
