// 구출 동물이 콘텐츠 컬럼(450) 밖으로 걸어 나가면 좌우 고정배경 위를 지나간다.
// 경계에서 사라져야 한다 — 걸어 나가는 거리를 컬럼 기준으로 잡았는지 본다.
import { describe, expect, it } from "vitest";
import { spawnEscape, stepEscape, escapeExitX, LAND_SCALE, type EscapeArena } from "../../src/ui/hex/escapeMotion";
import { BASE_W } from "../../src/ui/stage";
import { CELL_W } from "../../src/ui/hex/geom";

const arena = (): EscapeArena => ({
  anchor: { x: 200, y: 400 },
  floorY: 557.8,
  exitX: escapeExitX(),
});

describe("구출 동물의 퇴장 경계", () => {
  it("몸이 컬럼을 완전히 벗어나는 지점에서 끝난다 — 그보다 더 가지 않는다", () => {
    // 몸 중심이 exitX일 때 왼쪽 끝이 컬럼 오른쪽 경계에 딱 닿는다
    expect(escapeExitX()).toBeCloseTo(BASE_W + (CELL_W * LAND_SCALE) / 2, 6);
  });

  it("판 오른쪽 벽이 아니라 컬럼 경계를 쓴다 — 예전 값(약 654)보다 짧다", () => {
    expect(escapeExitX()).toBeLessThan(654);
  });

  it("걷다가 경계를 넘으면 사라지고 멈춘다", () => {
    const a = arena();
    const body = spawnEscape(0, 1, a);
    let guard = 0;
    while (body.phase !== "dead" && guard++ < 100_000) stepEscape(body, 1 / 60, a);
    expect(body.phase).toBe("dead");
    expect(body.alpha).toBe(0);
    // 살아 있는 동안에는 몸의 왼쪽 끝이 컬럼 안에 있었다
    expect(body.x).toBeGreaterThanOrEqual(escapeExitX());
    expect(body.x - (CELL_W * LAND_SCALE) / 2).toBeGreaterThanOrEqual(BASE_W - 1e-6);
  });
});
