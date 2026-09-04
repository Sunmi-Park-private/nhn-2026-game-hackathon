// tests/hex/stageRun.test.ts — 런 상태·구출 판정·승패
import { describe, it, expect } from "vitest";
import { key, toPixel } from "../../src/engine/hex/coords";
import { placeTile } from "../../src/engine/hex/grid";
import {
  createRun, pendingRescues, applyRescues, fireAt, isCleared, isFailed, collectDrops,
} from "../../src/engine/hex/stageRun";
import type { BoardGeom } from "../../src/engine/hex/shot";
import type { StageDef } from "../../src/engine/hex/types";

const GEOM: BoardGeom = { size: 30, cols: 7, rows: 12 };

function stage(over: Partial<StageDef> = {}): StageDef {
  return {
    id: "t",
    cols: 7,
    rows: 12,
    objective: 1,
    shots: 5,
    cages: [],
    tiles: [],
    horseshoes: [],
    ...over,
  };
}

describe("createRun", () => {
  it("샷 잔량이 스테이지 정의값이다", () => {
    expect(createRun(stage({ shots: 9 })).shotsLeft).toBe(9);
  });

  it("장전과 다음 발사체는 최하위 티어다", () => {
    const run = createRun(stage());
    expect(run.loaded).toBe(0);
    expect(run.next).toBe(0);
  });

  it("구출 목록과 말굽이 0에서 시작한다", () => {
    const run = createRun(stage());
    expect(run.rescued).toEqual([]);
    expect(run.horseshoes).toBe(0);
  });

  it("초기 셀이 스테이지 정의대로 깔린다", () => {
    const run = createRun(stage({ tiles: [{ at: { q: 0, r: 0 }, tier: 2 }] }));
    expect(run.cells.get(key({ q: 0, r: 0 }))).toEqual({ kind: "tile", tier: 2 });
  });
});

describe("pendingRescues / applyRescues", () => {
  const caged = stage({
    cages: [{ id: "c1", animalId: "sheep", cells: [{ q: 2, r: 2 }, { q: 3, r: 2 }] }],
  });

  it("주변이 비어 있으면 구출 대상이다", () => {
    const run = createRun(caged);
    expect(pendingRescues(run).map((c) => c.id)).toEqual(["c1"]);
  });

  it("인접에 타일이 하나라도 있으면 구출 대상이 아니다", () => {
    const run = createRun(caged);
    placeTile(run.cells, { q: 2, r: 1 }, 0);
    expect(pendingRescues(run)).toEqual([]);
  });

  it("구출하면 rescued에 animalId가 쌓인다", () => {
    const run = createRun(caged);
    applyRescues(run);
    expect(run.rescued).toEqual(["sheep"]);
  });

  it("구출한 케이지는 셀 맵에서 사라진다", () => {
    const run = createRun(caged);
    applyRescues(run);
    expect(run.cells.has(key({ q: 2, r: 2 }))).toBe(false);
    expect(run.cells.has(key({ q: 3, r: 2 }))).toBe(false);
  });

  it("같은 케이지를 두 번 구출하지 않는다", () => {
    const run = createRun(caged);
    applyRescues(run);
    expect(applyRescues(run)).toEqual([]);
    expect(run.rescued).toEqual(["sheep"]);
  });
});

describe("fireAt", () => {
  const from = toPixel({ q: -2, r: 12 }, GEOM.size);

  it("발사하면 샷 잔량이 준다", () => {
    const run = createRun(stage({ shots: 3 }));
    fireAt(run, GEOM, from, 0);
    expect(run.shotsLeft).toBe(2);
  });

  it("스냅한 자리에 장전된 티어가 놓인다", () => {
    const run = createRun(stage());
    const out = fireAt(run, GEOM, from, 0);
    expect(out.snapped).not.toBeNull();
    expect(run.cells.get(key(out.snapped!))).toEqual({ kind: "tile", tier: 0 });
  });

  it("빨강 2개가 이미 붙어 있으면 발사로 셋이 터진다", () => {
    const run = createRun(stage({
      tiles: [{ at: { q: -2, r: 10 }, tier: 0 }, { at: { q: -1, r: 10 }, tier: 0 }],
    }));
    // (-2,11)에 붙으면 (-2,10)과 인접 → 빨강 3개
    const out = fireAt(run, GEOM, from, 0);
    expect(out.steps.length).toBeGreaterThan(0);
    expect(out.steps[0]!.kind).toBe("pop");
    // 상위 색이 남지 않는다 — 세 칸이 모두 빈다
    expect(out.steps[0]!.cleared).toHaveLength(3);
    for (const a of out.steps[0]!.cleared) expect(run.cells.has(key(a))).toBe(false);
  });

  it("샷이 없으면 발사되지 않는다", () => {
    const run = createRun(stage({ shots: 0 }));
    const out = fireAt(run, GEOM, from, 0);
    expect(out.snapped).toBeNull();
    expect(run.shotsLeft).toBe(0);
  });

  it("발사 후 다음 발사체가 장전된다", () => {
    const run = createRun(stage());
    fireAt(run, GEOM, from, 0);
    expect(run.loaded).toBe(0);
    expect(run.next).toBe(0);
  });
});

describe("isCleared / isFailed", () => {
  it("목표 수만큼 구출하면 클리어다", () => {
    const run = createRun(stage({
      objective: 1,
      cages: [{ id: "c1", animalId: "sheep", cells: [{ q: 2, r: 2 }] }],
    }));
    expect(isCleared(run)).toBe(false);
    applyRescues(run);
    expect(isCleared(run)).toBe(true);
  });

  it("샷이 떨어지고 목표를 못 채우면 실패다", () => {
    const run = createRun(stage({ objective: 1, shots: 0 }));
    expect(isFailed(run)).toBe(true);
  });

  it("샷이 떨어져도 목표를 채웠으면 실패가 아니다", () => {
    const run = createRun(stage({
      objective: 1,
      shots: 0,
      cages: [{ id: "c1", animalId: "sheep", cells: [{ q: 2, r: 2 }] }],
    }));
    applyRescues(run);
    expect(isFailed(run)).toBe(false);
    expect(isCleared(run)).toBe(true);
  });

  it("샷이 남아 있으면 실패가 아니다", () => {
    expect(isFailed(createRun(stage({ objective: 1, shots: 3 })))).toBe(false);
  });
});

describe("collectDrops", () => {
  it("떨어진 말굽을 센다", () => {
    const run = createRun(stage({ horseshoes: [{ q: 4, r: 4 }] }));
    // 천장과 이어지지 않았으므로 낙하한다
    const out = collectDrops(run);
    expect(out.shoes).toBe(1);
    expect(run.cells.has(key({ q: 4, r: 4 }))).toBe(false);
  });

  it("이미 회수한 말굽 자리에 놓인 타일은 말굽으로 세지 않는다", () => {
    // 스테이지 정의상 말굽 자리지만, 지금 그 칸에 있는 것은 타일이다
    const run = createRun(stage({ horseshoes: [{ q: 4, r: 4 }] }));
    collectDrops(run);                       // 말굽을 먼저 회수해 칸을 비운다
    placeTile(run.cells, { q: 4, r: 4 }, 0); // 그 자리에 타일이 놓인다
    const out = collectDrops(run);
    expect(out.shoes).toBe(0);               // 좌표가 아니라 종류로 세야 한다
    expect(out.dropped).toHaveLength(1);     // 타일 자체는 떨어진다
  });
});
