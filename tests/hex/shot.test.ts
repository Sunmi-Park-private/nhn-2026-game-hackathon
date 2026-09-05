// tests/hex/shot.test.ts — 궤적·벽 반사·스냅
import { describe, it, expect } from "vitest";
import { toPixel } from "../../src/engine/hex/coords";
import { placeTile } from "../../src/engine/hex/grid";
import { boardBounds, launchSpeed, simulateShot } from "../../src/engine/hex/shot";
import type { BoardGeom } from "../../src/engine/hex/shot";
import type { Cell, Tier } from "../../src/engine/hex/types";

const GEOM: BoardGeom = { size: 30, cols: 7, rows: 12 };

function makeCells(entries: Array<[number, number, Tier]>): Map<string, Cell> {
  const cells = new Map<string, Cell>();
  for (const [q, r, tier] of entries) placeTile(cells, { q, r }, tier);
  return cells;
}

/** 보드 하단 중앙의 발사 지점(픽셀). 셀 (3,11) 아래쪽. */
function launchPoint(): { x: number; y: number } {
  const p = toPixel({ q: -2, r: 12 }, GEOM.size);
  return { x: p.x, y: p.y };
}

describe("boardBounds", () => {
  it("좌우 벽이 0열과 마지막 열 바깥에 온다", () => {
    const { minX, maxX } = boardBounds(GEOM);
    expect(minX).toBeLessThan(toPixel({ q: 0, r: 0 }, GEOM.size).x);
    expect(maxX).toBeGreaterThan(toPixel({ q: 6, r: 0 }, GEOM.size).x);
  });

  it("오른쪽 벽이 홀수 행 마지막 셀의 가장자리까지 간다", () => {
    // 홀수 행(r=1)은 반 칸 밀려 있어 짝수 행보다 w/2 더 뻗는다
    const w = Math.sqrt(3) * GEOM.size;
    const lastOddCellCenter = toPixel({ q: GEOM.cols - 1, r: 1 }, GEOM.size).x;
    expect(boardBounds(GEOM).maxX).toBeCloseTo(lastOddCellCenter + w / 2, 5);
  });
});

describe("simulateShot — 직진", () => {
  it("빈 보드에 똑바로 쏘면 천장 바로 아래에 붙는다", () => {
    const cells = makeCells([]);
    const res = simulateShot(cells, GEOM, launchPoint(), 0);
    expect(res.snap).not.toBeNull();
    expect(res.snap!.r).toBe(0);
  });

  it("경로가 비어 있지 않다", () => {
    const res = simulateShot(makeCells([]), GEOM, launchPoint(), 0);
    expect(res.path.length).toBeGreaterThan(1);
  });

  it("타일에 막히면 그 바로 앞 빈 칸에 붙는다", () => {
    // 발사 직선상 (-1,10)에 타일을 둔다
    const cells = makeCells([[-1, 10, 0]]);
    const res = simulateShot(cells, GEOM, launchPoint(), 0);
    expect(res.snap).toEqual({ q: -2, r: 11 });
  });

  it("스냅한 칸은 반드시 비어 있다", () => {
    const cells = makeCells([[-1, 10, 0], [-1, 9, 1]]);
    const res = simulateShot(cells, GEOM, launchPoint(), 0);
    expect(res.snap).not.toBeNull();
    expect(cells.has(`${res.snap!.q},${res.snap!.r}`)).toBe(false);
  });
});

describe("simulateShot — 케이지", () => {
  it("케이지는 막지만 그 자리에 붙지 않는다", () => {
    const cells = new Map<string, Cell>();
    cells.set("-1,10", { kind: "cage", cageId: "c1" });
    const res = simulateShot(cells, GEOM, launchPoint(), 0);
    expect(res.snap).toEqual({ q: -2, r: 11 });
  });
});

describe("simulateShot — 벽 반사", () => {
  it("비스듬히 쏘면 벽에 튕겨도 보드 안에 붙는다", () => {
    const cells = makeCells([]);
    const res = simulateShot(cells, GEOM, launchPoint(), 0.9);
    expect(res.snap).not.toBeNull();
    expect(res.snap!.r).toBeGreaterThanOrEqual(0);
    expect(res.snap!.r).toBeLessThan(GEOM.rows);
  });

  it("경로가 좌우 벽 밖으로 나가지 않는다", () => {
    const { minX, maxX } = boardBounds(GEOM);
    const res = simulateShot(makeCells([]), GEOM, launchPoint(), -1.0);
    for (const p of res.path) {
      expect(p.x).toBeGreaterThanOrEqual(minX - 0.001);
      expect(p.x).toBeLessThanOrEqual(maxX + 0.001);
    }
  });

  it("반사한 궤적에도 스냅 지점이 있다", () => {
    const res = simulateShot(makeCells([]), GEOM, launchPoint(), -1.1);
    expect(res.snap).not.toBeNull();
  });
});

describe("simulateShot — 경계", () => {
  it("발사 지점이 이미 막혀 있으면 스냅이 없다", () => {
    const from = launchPoint();
    const cells = makeCells([]);
    // 발사 지점 셀 자체를 막는다
    const startCell = { q: -2, r: 12 };
    placeTile(cells, startCell, 0);
    const res = simulateShot(cells, { ...GEOM, rows: 13 }, from, 0);
    expect(res.snap).toBeNull();
  });
});

describe("simulateShot — 포물선", () => {
  it("최소 파워로도 똑바로 쏘면 천장에 닿는다", () => {
    // §7 도달 보장 — 어떤 판이 와도 물리적으로 못 닿는 칸이 없어야 한다
    const res = simulateShot(makeCells([]), GEOM, launchPoint(), 0, 0);
    expect(res.missed).toBe(false);
    expect(res.snap).not.toBeNull();
    expect(res.snap!.r).toBe(0);
  });

  it("파워가 클수록 초속이 크다", () => {
    // 사거리를 경로 **길이**로 재면 안 된다 — 파워가 세면 천장에 일찍 닿아
    // 경로가 오히려 짧아진다. 힘 자체는 launchSpeed가 단조 증가로 답한다.
    const v = (power: number): number => launchSpeed(launchPoint(), GEOM, power);
    expect(v(1)).toBeGreaterThan(v(0.5));
    expect(v(0.5)).toBeGreaterThan(v(0));
  });

  it("눕혀 쏘면 약한 발은 못 닿고 센 발은 닿는다 — 파워가 사거리다", () => {
    // 사거리의 게임적 의미는 「닿느냐」다. 같은 각도에서 파워만 갈라 본다.
    const weak = simulateShot(makeCells([]), GEOM, launchPoint(), 1.2, 0);
    const strong = simulateShot(makeCells([]), GEOM, launchPoint(), 1.2, 1);
    expect(weak.missed).toBe(true);
    expect(weak.snap).toBeNull();
    expect(strong.missed).toBe(false);
    expect(strong.snap).not.toBeNull();
  });

  it("좌우 대칭이다 — 판 한가운데서 반대 각도로 쏜 궤적이 서로 거울상이다", () => {
    // **격자가 아니라 물리를 잰다.** 육각 격자는 좌우 대칭이 아니다(홀수 행이
    // 반 칸 밀리고 fromPixel이 큐브 반올림을 쓴다) — 그래서 두 궤적은 천장
    // 근처에서 몇 스텝 다르게 끝난다. 끝나는 지점이 아니라 **날아가는 모양**을
    // 비교해야 한다. 초반 50스텝은 천장에서 한참 멀다.
    const { minX, maxX } = boardBounds(GEOM);
    const cx = (minX + maxX) / 2;
    const mid = { x: cx, y: launchPoint().y };
    const right = simulateShot(makeCells([]), GEOM, mid, 0.7, 0.5).path;
    const left = simulateShot(makeCells([]), GEOM, mid, -0.7, 0.5).path;
    const n = Math.min(50, right.length, left.length);
    expect(n).toBeGreaterThan(10);
    for (let i = 0; i < n; i += 1) {
      expect(right[i]!.x - cx).toBeCloseTo(cx - left[i]!.x, 6);
      expect(right[i]!.y).toBeCloseTo(left[i]!.y, 6);
    }
  });

  it("궤적이 곧지 않다 — 중력이 실제로 작용한다", () => {
    // 비스듬히 쏜 경로의 세로 속도가 도중에 방향을 바꾸거나 최소한 느려진다.
    const { path } = simulateShot(makeCells([]), GEOM, launchPoint(), 1.2, 0);
    const dy = (i: number): number => path[i + 1]!.y - path[i]!.y;
    const first = dy(0);
    const last = dy(path.length - 2);
    expect(last).toBeGreaterThan(first); // 위로 가던 속도(-)가 줄거나 아래로(+) 돌아선다
  });

  it("MAX_V에서는 좌우 벽을 최소 2회 튀고도 천장에 닿는다 — §7 뱅크샷 보장", () => {
    // MAX_RISE(=10.5)는 이 성질을 지키려고 고른 값이다 — 나중에 손대면
    // 이 테스트가 조용히 깨져서 알려 줘야 한다. 벽에 부딪히는 횟수는 경로의
    // 좌우 진행 방향이 바뀌는 횟수로 센다(부호가 바뀔 때마다 한 번 튕긴 것).
    const { minX, maxX } = boardBounds(GEOM);
    function countBounces(path: Array<{ x: number; y: number }>): number {
      let bounces = 0;
      let dir = 0;
      for (let i = 1; i < path.length; i += 1) {
        const d = path[i]!.x - path[i - 1]!.x;
        if (d === 0) continue;
        const nd = d > 0 ? 1 : -1;
        if (dir !== 0 && nd !== dir) bounces += 1;
        dir = nd;
      }
      return bounces;
    }
    // 이 테스트 지오메트리(GEOM: cols 7, rows 12)에서 실측한 값 — 각도 0.9·파워 1은
    // 좌우 벽을 2회 튕기고도 천장(r===0)에 닿는다.
    const res = simulateShot(makeCells([]), GEOM, launchPoint(), 0.9, 1);
    expect(res.snap).not.toBeNull();
    expect(res.snap!.r).toBeCloseTo(0, 9); // r이 -0으로 나올 수 있어 toBe(0)은 쓰지 않는다
    for (const p of res.path) {
      expect(p.x).toBeGreaterThanOrEqual(minX - 0.001);
      expect(p.x).toBeLessThanOrEqual(maxX + 0.001);
    }
    expect(countBounces(res.path)).toBeGreaterThanOrEqual(2);
  });
});
