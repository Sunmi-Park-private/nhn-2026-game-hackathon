// 구출 동물 넷이 한 덩어리로 몰려 나가면 마릿수가 안 읽힌다.
// 걷는 동안 옆 마리와 겹치는 정도에 상한을 둔다.
import { describe, expect, it } from "vitest";
import {
  spawnEscape, stepEscape, escapeExitX, escapeDurationMs,
  ANIMAL_COUNT, ANIMAL_BODY_W, MAX_WALK_OVERLAP,
  type EscapeArena, type EscapeBody,
} from "../../src/ui/hex/escapeMotion";

const arena = (anchorX = 200): EscapeArena => ({
  anchor: { x: anchorX, y: 300 },
  floorY: 557.8,
  exitX: escapeExitX(),
});

/** 걷는 중이고 아직 보이는 마리들 */
const walking = (bodies: EscapeBody[]): EscapeBody[] =>
  bodies.filter((b) => b.phase === "walk" && b.alpha > 0);

describe("구출 동물의 간격", () => {
  it("걷는 동안 옆 마리와 30%를 넘게 겹치지 않는다", () => {
    for (const anchorX of [66, 200, 386]) {
      const a = arena(anchorX);
      const bodies = Array.from({ length: ANIMAL_COUNT }, (_, i) => spawnEscape(i, ANIMAL_COUNT, a));
      const minGap = ANIMAL_BODY_W * (1 - MAX_WALK_OVERLAP);
      let worst = Infinity;
      for (let step = 0; step < 20_000; step++) {
        for (const b of bodies) stepEscape(b, 1 / 120, a);
        const w = walking(bodies);
        for (let i = 0; i < w.length; i++) {
          for (let j = i + 1; j < w.length; j++) {
            worst = Math.min(worst, Math.abs(w[i]!.x - w[j]!.x));
          }
        }
        if (bodies.every((b) => b.phase === "dead")) break;
      }
      // 두 마리 이상이 동시에 걸은 적이 있어야 의미 있는 검사다
      expect(worst).toBeLessThan(Infinity);
      expect(worst).toBeGreaterThanOrEqual(minGap - 1e-6);
    }
  });

  it("연출 길이 계산이 실제 끝나는 시각과 맞는다", () => {
    const a = arena(200);
    const bodies = Array.from({ length: ANIMAL_COUNT }, (_, i) => spawnEscape(i, ANIMAL_COUNT, a));
    let ms = 0;
    while (!bodies.every((b) => b.phase === "dead") && ms < 60_000) {
      for (const b of bodies) stepEscape(b, 1 / 120, a);
      ms += 1000 / 120;
    }
    expect(bodies.every((b) => b.phase === "dead")).toBe(true);
    expect(ms).toBeLessThanOrEqual(escapeDurationMs(ANIMAL_COUNT, a) + 50);
  });
});
