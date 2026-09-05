// tests/hex/pushRow.test.ts — 위에서 줄이 내려오는 규칙.
//
// 발사 제한을 걷어낸 자리에 시간이 들어왔다. 실패 조건이 「몇 발 남았나」에서
// 「판이 바닥에 닿았나」로 바뀌었으므로, 그 판정과 밀기가 정확해야 한다.
import { describe, it, expect } from "vitest";
import { pushRow, hasReachedFailRow, failRow } from "../../src/engine/hex/pushRow";
import { createRun } from "../../src/engine/hex/stageRun";
import { key } from "../../src/engine/hex/coords";
import { placeTile } from "../../src/engine/hex/grid";
import type { StageDef } from "../../src/engine/hex/types";

function stage(over: Partial<StageDef> = {}): StageDef {
  return {
    id: "t",
    cols: 5,
    rows: 8,
    objective: 1,
    pushSeconds: 15,
    cages: [],
    tiles: [{ at: { q: 0, r: 0 }, tier: 0 }],
    horseshoes: [],
    ...over,
  };
}

/** 고정 난수 — 팔레트의 첫 색만 나오게 한다. */
const zero = (): number => 0;

describe("failRow", () => {
  it("판의 마지막 행이다", () => {
    expect(failRow(createRun(stage()))).toBe(7);
  });

  it("실패 행에 닿기 전에는 false", () => {
    const run = createRun(stage());
    placeTile(run.cells, { q: 0, r: 6 }, 0);
    expect(hasReachedFailRow(run)).toBe(false);
  });

  it("실패 행에 닿으면 true", () => {
    const run = createRun(stage());
    placeTile(run.cells, { q: 0, r: 7 }, 0);
    expect(hasReachedFailRow(run)).toBe(true);
  });
});

describe("pushRow", () => {
  it("있던 칸이 한 칸 아래로 내려간다", () => {
    const run = createRun(stage({ tiles: [{ at: { q: 2, r: 3 }, tier: 1 }] }));
    pushRow(run, zero);
    expect(run.cells.has(key({ q: 2, r: 3 }))).toBe(false);
    expect(run.cells.get(key({ q: 2, r: 4 }))).toEqual({ kind: "tile", tier: 1 });
  });

  it("천장에 새 줄이 빈틈없이 깔린다", () => {
    // 한 칸이라도 비면 그 열이 천장과 끊겨 아래 덩어리가 앵커를 잃는다.
    const run = createRun(stage());
    pushRow(run, zero);
    for (let c = 0; c < 5; c += 1) {
      expect(run.cells.has(key({ q: c, r: 0 }))).toBe(true);
    }
  });

  it("아래 칸을 덮어쓰지 않는다 — 위에서부터 옮기면 겹친다", () => {
    const run = createRun(stage({
      tiles: [
        { at: { q: 0, r: 2 }, tier: 1 },
        { at: { q: 0, r: 3 }, tier: 2 },
      ],
    }));
    pushRow(run, zero);
    expect(run.cells.get(key({ q: 0, r: 3 }))).toEqual({ kind: "tile", tier: 1 });
    expect(run.cells.get(key({ q: 0, r: 4 }))).toEqual({ kind: "tile", tier: 2 });
  });

  it("창살도 같이 내려간다", () => {
    // 창살만 제자리에 남으면 둘레와 어긋나 구출 판정이 엉킨다.
    const run = createRun(stage({
      cages: [{ id: "c1", animalId: "sheep", cells: [{ q: 2, r: 3 }] }],
    }));
    pushRow(run, zero);
    expect(run.cages[0]!.cells).toEqual([{ q: 2, r: 4 }]);
    expect(run.cells.get(key({ q: 2, r: 4 }))).toEqual({ kind: "cage", cageId: "c1" });
  });

  it("stage.cages(고정 정의)는 건드리지 않는다", () => {
    const stg = stage({ cages: [{ id: "c1", animalId: "sheep", cells: [{ q: 2, r: 3 }] }] });
    const run = createRun(stg);
    pushRow(run, zero);
    expect(stg.cages[0]!.cells).toEqual([{ q: 2, r: 3 }]);
  });

  it("내려온 줄 수를 센다", () => {
    const run = createRun(stage());
    pushRow(run, zero);
    pushRow(run, zero);
    expect(run.pushes).toBe(2);
  });

  it("새 줄의 색은 팔레트에서만 나온다", () => {
    const run = createRun(stage({
      tiles: [{ at: { q: 0, r: 0 }, tier: 2 }, { at: { q: 1, r: 0 }, tier: 4 }],
    }));
    let i = 0;
    pushRow(run, () => [0, 0.9][i++ % 2]!);
    const tiers = [...Array(5).keys()]
      .map((c) => run.cells.get(key({ q: c, r: 0 })))
      .map((cell) => (cell?.kind === "tile" ? cell.tier : -1));
    for (const t of tiers) expect([2, 4]).toContain(t);
  });

  it("이미 실패 행에 닿았으면 밀지 않는다 — 판이 보드 밖으로 나가지 않게", () => {
    const run = createRun(stage());
    placeTile(run.cells, { q: 0, r: 7 }, 0);
    const before = new Map(run.cells);
    expect(pushRow(run, zero)).toBe(false);
    expect(run.cells).toEqual(before);
    expect(run.pushes).toBe(0);
  });

  it("실패 행 바로 위까지 차 있어도 한 번은 더 밀 수 있고, 그 결과가 패배다", () => {
    // 실패 행에서 판정하므로 밀기 직전 최대 r은 rows-2다 — 절대 보드 밖으로 안 나간다.
    const run = createRun(stage({ tiles: [{ at: { q: 0, r: 6 }, tier: 0 }] }));
    expect(pushRow(run, zero)).toBe(true);
    expect(hasReachedFailRow(run)).toBe(true);
    for (const k of run.cells.keys()) {
      expect(Number(k.split(",")[1])).toBeLessThanOrEqual(failRow(run));
    }
  });
});
