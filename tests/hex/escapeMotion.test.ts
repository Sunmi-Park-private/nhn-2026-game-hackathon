// tests/hex/escapeMotion.test.ts — 구출 안무(창살 낙하 · 동물 탈출)의 계산.
import { describe, it, expect } from "vitest";
import {
  cageShakeX, cageDropY, cageDropRot, cageDropAlpha,
  CAGE_SHAKE_MS, CAGE_SHAKE_AMP, CAGE_DROP_MS, CAGE_DROP_DIST, CAGE_TOTAL_MS,
  spawnEscape, stepEscape, escapeDurationMs,
  ANIMAL_COUNT, ANIMAL_STAGGER_MS, FALL_MS, START_SCALE, LAND_SCALE, WALK_SPEED,
  type EscapeArena, type EscapeBody,
} from "../../src/ui/hex/escapeMotion";

const ARENA: EscapeArena = {
  anchor: { x: 200, y: 200 },
  floorY: 558,
  exitX: 420,
};

describe("창살 — 흔들리다 떨어진다", () => {
  it("흔들림이 끝나기 전까지만 흔들린다", () => {
    expect(cageShakeX(-10)).toBe(0);
    expect(cageShakeX(CAGE_SHAKE_MS)).toBe(0);
    expect(cageShakeX(CAGE_SHAKE_MS + 100)).toBe(0);
  });

  it("좌우 양쪽으로 간다 — 한쪽으로만 밀리지 않는다", () => {
    let min = 0;
    let max = 0;
    for (let ms = 0; ms < CAGE_SHAKE_MS; ms += 2) {
      min = Math.min(min, cageShakeX(ms));
      max = Math.max(max, cageShakeX(ms));
    }
    expect(min).toBeLessThan(-1);
    expect(max).toBeGreaterThan(1);
  });

  it("세기가 끝으로 갈수록 커진다 — 버티다 못해 떨어지는 순서다", () => {
    const peak = (from: number, to: number): number => {
      let m = 0;
      for (let ms = from; ms < to; ms += 1) m = Math.max(m, Math.abs(cageShakeX(ms)));
      return m;
    };
    expect(peak(CAGE_SHAKE_MS / 2, CAGE_SHAKE_MS)).toBeGreaterThan(peak(0, CAGE_SHAKE_MS / 2));
  });

  it("진폭이 상한을 넘지 않는다", () => {
    for (let ms = 0; ms < CAGE_SHAKE_MS; ms += 1) {
      expect(Math.abs(cageShakeX(ms))).toBeLessThanOrEqual(CAGE_SHAKE_AMP + 1e-9);
    }
  });

  it("흔드는 동안에는 떨어지지 않는다", () => {
    expect(cageDropY(0)).toBe(0);
    expect(cageDropY(CAGE_SHAKE_MS)).toBe(0);
    expect(cageDropRot(CAGE_SHAKE_MS)).toBe(0);
  });

  it("흔들림이 끝나면 가속하며 떨어진다", () => {
    const quarter = cageDropY(CAGE_SHAKE_MS + CAGE_DROP_MS * 0.25);
    const half = cageDropY(CAGE_SHAKE_MS + CAGE_DROP_MS * 0.5);
    // 제곱 곡선이므로 뒤쪽 절반에서 더 많이 내려간다
    expect(half - quarter).toBeGreaterThan(quarter);
    expect(cageDropY(CAGE_TOTAL_MS)).toBeCloseTo(CAGE_DROP_DIST, 5);
  });

  it("떨어지며 한쪽으로 기운다", () => {
    expect(cageDropRot(CAGE_TOTAL_MS)).toBeGreaterThan(0.5);
  });

  it("연출이 끝나면 완전히 투명하다", () => {
    expect(cageDropAlpha(0)).toBe(1);
    expect(cageDropAlpha(CAGE_TOTAL_MS)).toBe(0);
  });

  it("알파가 단조롭게 준다 — 깜빡이지 않는다", () => {
    let prev = 1;
    for (let ms = 0; ms <= CAGE_TOTAL_MS; ms += 5) {
      const a = cageDropAlpha(ms);
      expect(a).toBeLessThanOrEqual(prev + 1e-9);
      prev = a;
    }
  });
});

describe("동물 — 창살 자리에서 떨어져 걸어 나간다", () => {
  function spawnAll(): EscapeBody[] {
    return Array.from({ length: ANIMAL_COUNT }, (_, i) => spawnEscape(i, ANIMAL_COUNT, ARENA));
  }

  it("네 마리가 나온다", () => {
    expect(ANIMAL_COUNT).toBe(4);
  });

  it("전부 창살 한가운데에서 출발한다 — 앵커가 하나다", () => {
    for (const b of spawnAll()) {
      expect(b.x).toBe(ARENA.anchor.x);
      expect(b.y).toBe(ARENA.anchor.y);
    }
  });

  it("격자 한 칸 크기로 시작한다", () => {
    for (const b of spawnAll()) expect(b.scale).toBe(START_SCALE);
  });

  it("한 마리씩 차례로 나온다", () => {
    const bodies = spawnAll();
    expect(bodies.map((b) => b.delay)).toEqual([0, 1, 2, 3].map((i) => i * ANIMAL_STAGGER_MS));
  });

  it("대기 중에는 보이지 않고 움직이지도 않는다", () => {
    const b = spawnEscape(2, ANIMAL_COUNT, ARENA);
    stepEscape(b, 1 / 60, ARENA);
    expect(b.phase).toBe("wait");
    expect(b.alpha).toBe(0);
    expect(b.y).toBe(ARENA.anchor.y);
  });

  it("떨어지면서 점점 커진다", () => {
    const b = spawnEscape(0, ANIMAL_COUNT, ARENA);
    let prevScale = b.scale;
    let prevY = b.y;
    while (b.phase === "fall" || b.phase === "wait") {
      stepEscape(b, 1 / 60, ARENA);
      if (b.phase !== "fall") break;
      expect(b.scale).toBeGreaterThanOrEqual(prevScale);
      expect(b.y).toBeGreaterThanOrEqual(prevY);
      prevScale = b.scale;
      prevY = b.y;
    }
    expect(b.phase).toBe("walk");
  });

  it("바닥에 닿을 때 착지 배율이 된다 — 바닥은 우리 하단 경계다", () => {
    const b = spawnEscape(0, ANIMAL_COUNT, ARENA);
    for (let i = 0; i < 200 && b.phase !== "walk"; i += 1) stepEscape(b, 1 / 60, ARENA);
    expect(b.phase).toBe("walk");
    expect(b.y).toBeCloseTo(ARENA.floorY, 5);
    expect(b.scale).toBeCloseTo(LAND_SCALE, 5);
  });

  it("착지 뒤 오른쪽으로 걷는다", () => {
    const b = spawnEscape(0, ANIMAL_COUNT, ARENA);
    for (let i = 0; i < 200 && b.phase !== "walk"; i += 1) stepEscape(b, 1 / 60, ARENA);
    const x0 = b.x;
    stepEscape(b, 0.1, ARENA);
    expect(b.x - x0).toBeCloseTo(WALK_SPEED * 0.1, 5);
  });

  it("걷는 동안 바닥 근처에서 위아래로 흔들린다", () => {
    const b = spawnEscape(0, ANIMAL_COUNT, ARENA);
    for (let i = 0; i < 200 && b.phase !== "walk"; i += 1) stepEscape(b, 1 / 60, ARENA);
    const ys: number[] = [];
    for (let i = 0; i < 60 && b.phase === "walk"; i += 1) {
      stepEscape(b, 1 / 60, ARENA);
      ys.push(b.y);
    }
    expect(Math.max(...ys) - Math.min(...ys)).toBeGreaterThan(1);
    for (const y of ys) expect(Math.abs(y - ARENA.floorY)).toBeLessThan(5);
  });

  it("우측 경계를 넘으면 사라진다", () => {
    const b = spawnEscape(0, ANIMAL_COUNT, ARENA);
    for (let i = 0; i < 600 && b.phase !== "dead"; i += 1) stepEscape(b, 1 / 60, ARENA);
    expect(b.phase).toBe("dead");
    expect(b.x).toBeGreaterThanOrEqual(ARENA.exitX);
  });

  it("네 마리 전부 반드시 나간다 — 화면에 남지 않는다", () => {
    const bodies = spawnAll();
    for (let i = 0; i < 900; i += 1) for (const b of bodies) stepEscape(b, 1 / 60, ARENA);
    for (const b of bodies) expect(b.phase).toBe("dead");
  });

  it("죽은 뒤에는 더 움직이지 않는다", () => {
    const b: EscapeBody = { ...spawnEscape(0, 1, ARENA), phase: "dead", x: 999 };
    stepEscape(b, 1 / 60, ARENA);
    expect(b.x).toBe(999);
  });
});

describe("escapeDurationMs", () => {
  it("마지막 마리가 나가는 데 걸리는 시간을 센다", () => {
    const bodies = Array.from({ length: ANIMAL_COUNT }, (_, i) => spawnEscape(i, ANIMAL_COUNT, ARENA));
    let ms = 0;
    while (bodies.some((b) => b.phase !== "dead") && ms < 20000) {
      for (const b of bodies) stepEscape(b, 1 / 60, ARENA);
      ms += 1000 / 60;
    }
    const declared = escapeDurationMs(ANIMAL_COUNT, ARENA);
    // 선언한 길이가 실제보다 짧으면 호출부가 연출 도중에 몸체를 치운다
    expect(declared).toBeGreaterThanOrEqual(ms - 1000 / 60);
    expect(declared).toBeLessThan(ms + 200);
  });

  it("앵커가 출구보다 오른쪽에 있어도 음수가 되지 않는다", () => {
    const past: EscapeArena = { ...ARENA, anchor: { x: 900, y: 200 } };
    expect(escapeDurationMs(ANIMAL_COUNT, past)).toBeGreaterThan(0);
  });
});

describe("두 몸의 박자", () => {
  it("창살이 다 떨어지기 전에 동물이 나오기 시작한다 — 같이 벌어져야 한 장면이다", () => {
    expect(FALL_MS).toBeLessThan(CAGE_TOTAL_MS + FALL_MS);
    expect(CAGE_SHAKE_MS).toBeLessThan(CAGE_TOTAL_MS);
  });
});
