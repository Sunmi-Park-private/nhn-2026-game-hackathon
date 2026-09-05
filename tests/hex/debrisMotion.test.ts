// tests/hex/debrisMotion.test.ts — 떨어져 나간 타일의 물리.
//
// 눈으로 확인하기 어려운 종류다(한 조각이 1.5초 안에 끝난다). 계산을 렌더에서
// 떼어 놨으므로 값으로 검사한다.
import { describe, it, expect } from "vitest";
import {
  spawnDebris, stepDebris, rollVelocity,
  ROLL_SPEED_MIN, ROLL_SPEED_MAX, FADE_MS, MAX_LIFE_MS, GRAVITY,
  type DebrisArena, type DebrisBody,
} from "../../src/ui/hex/debrisMotion";

const ARENA: DebrisArena = {
  radius: 10,
  edges: () => ({ left: 0, right: 300 }),
  floor: 500,
};

/** 사다리꼴 우리 — 아래로 갈수록 벌어진다. */
const TRAPEZOID: DebrisArena = {
  radius: 10,
  edges: (y) => ({ left: 100 - y * 0.1, right: 200 + y * 0.1 }),
  floor: 500,
};

const half = (): number => 0.5;

function body(over: Partial<DebrisBody> = {}): DebrisBody {
  return {
    x: 150, y: 100, vx: 0, vy: 0, rot: 0, spin: 0,
    phase: "fall", age: 0, rollAt: -1, alpha: 1, ...over,
  };
}

/** 죽을 때까지 굴린다. 프레임은 60fps. */
function run(b: DebrisBody, arena: DebrisArena, rand: () => number = half, maxFrames = 600): number {
  let frames = 0;
  while (b.phase !== "dead" && frames < maxFrames) {
    stepDebris(b, 1 / 60, arena, rand);
    frames += 1;
  }
  return frames;
}

describe("spawnDebris", () => {
  it("착탄점에서 멀어지는 쪽으로 튄다", () => {
    const right = spawnDebris({ x: 200, y: 100 }, { x: 150, y: 100 }, half);
    const left = spawnDebris({ x: 100, y: 100 }, { x: 150, y: 100 }, half);
    expect(right.vx).toBeGreaterThan(0);
    expect(left.vx).toBeLessThan(0);
  });

  it("일단 위로 띄운다 — 곧바로 떨어지면 「터졌다」가 아니라 「꺼졌다」로 보인다", () => {
    const b = spawnDebris({ x: 150, y: 100 }, { x: 150, y: 140 }, half);
    expect(b.vy).toBeLessThan(0);
  });

  it("착탄점과 완전히 겹쳐도 방향이 정해진다 — 0으로 나누지 않는다", () => {
    const b = spawnDebris({ x: 150, y: 100 }, { x: 150, y: 100 }, half);
    expect(Number.isFinite(b.vx)).toBe(true);
    expect(Number.isFinite(b.vy)).toBe(true);
    expect(b.vy).toBeLessThan(0);
  });
});

describe("낙하", () => {
  it("중력만큼 빨라진다", () => {
    const b = body();
    stepDebris(b, 0.1, ARENA, half);
    expect(b.vy).toBeCloseTo(GRAVITY * 0.1, 5);
  });

  it("좌우 벽에서 튕긴다 — 우리 밖으로 나가지 않는다", () => {
    const b = body({ x: 12, vx: -400 });
    stepDebris(b, 1 / 60, ARENA, half);
    expect(b.x).toBeGreaterThanOrEqual(ARENA.radius);
    expect(b.vx).toBeGreaterThan(0);
  });

  it("사다리꼴 우리에서도 그 높이의 벽을 쓴다", () => {
    // y=100에서 왼쪽 벽은 90이다. 직사각형(0)으로 쟀다면 통과했을 자리다.
    const b = body({ x: 95, y: 100, vx: -400 });
    stepDebris(b, 1 / 60, TRAPEZOID, half);
    expect(b.x).toBeCloseTo(TRAPEZOID.edges(b.y).left + TRAPEZOID.radius, 5);
  });

  it("빠르게 바닥에 닿으면 한 번 튄다", () => {
    const b = body({ y: 489, vy: 600 });
    stepDebris(b, 1 / 60, ARENA, half);
    expect(b.phase).toBe("fall");
    expect(b.vy).toBeLessThan(0); // 위로 튕겼다
  });

  it("힘없이 닿으면 튀지 않고 바로 구른다", () => {
    const b = body({ y: 489, vy: 40 });
    stepDebris(b, 1 / 60, ARENA, half);
    expect(b.phase).toBe("roll");
  });

  it("바닥을 뚫고 내려가지 않는다", () => {
    const b = spawnDebris({ x: 150, y: 100 }, { x: 150, y: 200 }, half);
    let lowest = 0;
    for (let i = 0; i < 400 && b.phase !== "dead"; i += 1) {
      stepDebris(b, 1 / 60, ARENA, half);
      lowest = Math.max(lowest, b.y);
    }
    expect(lowest).toBeLessThanOrEqual(ARENA.floor - ARENA.radius + 1e-9);
  });
});

describe("구르기", () => {
  it("방향이 좌우 랜덤이다", () => {
    expect(rollVelocity(() => 0.1)).toBeLessThan(0);
    expect(rollVelocity(() => 0.9)).toBeGreaterThan(0);
  });

  it("속력이 정해진 범위 안이다", () => {
    for (const r of [0, 0.25, 0.5, 0.75, 0.999]) {
      const v = Math.abs(rollVelocity(() => r));
      expect(v).toBeGreaterThanOrEqual(ROLL_SPEED_MIN);
      expect(v).toBeLessThanOrEqual(ROLL_SPEED_MAX);
    }
  });

  it("미끄러지지 않는다 — 회전이 이동거리 ÷ 반지름이다", () => {
    const b = body({ phase: "roll", y: ARENA.floor - ARENA.radius, vx: 200, rollAt: 0 });
    const x0 = b.x;
    const rot0 = b.rot;
    stepDebris(b, 1 / 60, ARENA, half);
    expect(b.rot - rot0).toBeCloseTo((b.x - x0) / ARENA.radius, 9);
  });

  it("굴러가는 쪽으로 회전한다", () => {
    const rightward = body({ phase: "roll", y: ARENA.floor - ARENA.radius, vx: 200, rollAt: 0 });
    const leftward = body({ phase: "roll", y: ARENA.floor - ARENA.radius, vx: -200, rollAt: 0 });
    stepDebris(rightward, 1 / 60, ARENA, half);
    stepDebris(leftward, 1 / 60, ARENA, half);
    expect(rightward.rot).toBeGreaterThan(0);
    expect(leftward.rot).toBeLessThan(0);
  });

  it("마찰로 느려지다 멈춘다 — 부호를 넘어 반대로 가지 않는다", () => {
    const b = body({ phase: "roll", y: ARENA.floor - ARENA.radius, vx: 20, rollAt: 0 });
    for (let i = 0; i < 30; i += 1) stepDebris(b, 1 / 60, ARENA, half);
    expect(b.vx).toBe(0);
  });

  it("구르기 시작 뒤 FADE_MS 만에 사라진다", () => {
    const b = body({ phase: "roll", y: ARENA.floor - ARENA.radius, vx: 150, rollAt: 0 });
    const frames = run(b, ARENA);
    expect(b.phase).toBe("dead");
    expect((frames * 1000) / 60).toBeGreaterThanOrEqual(FADE_MS);
    expect((frames * 1000) / 60).toBeLessThan(FADE_MS + 40);
  });

  it("구르는 동안 알파가 단조롭게 줄어든다", () => {
    const b = body({ phase: "roll", y: ARENA.floor - ARENA.radius, vx: 150, rollAt: 0 });
    let prev = 1;
    while (b.phase !== "dead") {
      stepDebris(b, 1 / 60, ARENA, half);
      expect(b.alpha).toBeLessThanOrEqual(prev);
      prev = b.alpha;
    }
  });
});

describe("수명", () => {
  it("어떤 조각도 MAX_LIFE_MS를 넘겨 살지 않는다", () => {
    // 절대 바닥에 닿지 않는 방 — 안전장치가 없으면 영원히 산다
    const bottomless: DebrisArena = { ...ARENA, floor: Number.POSITIVE_INFINITY };
    const b = spawnDebris({ x: 150, y: 100 }, { x: 150, y: 200 }, half);
    run(b, bottomless, half, 10000);
    expect(b.phase).toBe("dead");
    expect(b.age).toBeLessThanOrEqual(MAX_LIFE_MS + 20);
  });

  it("죽은 조각은 더 움직이지 않는다", () => {
    const b = body({ phase: "dead", vx: 500, vy: 500 });
    const before = { ...b };
    stepDebris(b, 1 / 60, ARENA, half);
    expect(b).toEqual(before);
  });

  it("떨어뜨린 조각은 반드시 죽는다 — 화면에 쌓이지 않는다", () => {
    for (let i = 0; i < 40; i += 1) {
      const rand = (): number => (i * 0.137 + 0.31) % 1;
      const b = spawnDebris({ x: 40 + i * 5, y: 120 }, { x: 150, y: 300 }, rand);
      run(b, TRAPEZOID, rand, 2000);
      expect(b.phase).toBe("dead");
    }
  });
});
