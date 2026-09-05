// tests/hex/pushRow.test.ts — 위에서 줄이 내려오는 규칙.
//
// 발사 제한을 걷어낸 자리에 시간이 들어왔다. 실패 조건이 「몇 발 남았나」에서
// 「판이 바닥에 닿았나」로 바뀌었으므로, 그 판정과 밀기가 정확해야 한다.
import { describe, it, expect } from "vitest";
import { pushRow, hasReachedFailRow, failRow, pushDelta, spawnShift } from "../../src/engine/hex/pushRow";
import { createRun } from "../../src/engine/hex/stageRun";
import { key, parseKey, toPixel, toCol } from "../../src/engine/hex/coords";
import { placeTile } from "../../src/engine/hex/grid";
import type { StageDef } from "../../src/engine/hex/types";

function stage(over: Partial<StageDef> = {}): StageDef {
  return {
    id: "t",
    cols: 5,
    rows: 8,
    objective: 1,
    pushSeconds: 15,
    armorChance: 0,
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

  it("천장 줄이 판 폭을 빈틈없이 채운다 — 시작 q가 밀려도 개수는 그대로", () => {
    for (let i = 0; i < 4; i += 1) {
      const run = createRun(stage());
      for (let n = 0; n <= i; n += 1) pushRow(run, zero);
      const top = [...run.cells.keys()].filter((k) => parseKey(k).r === 0);
      expect(top).toHaveLength(5);
    }
  });

  it("천장에 새 줄이 빈틈없이 깔린다", () => {
    // 한 칸이라도 비면 그 열이 천장과 끊겨 아래 덩어리가 앵커를 잃는다.
    const run = createRun(stage());
    pushRow(run, zero);
    const q0 = spawnShift(0);
    for (let c = 0; c < 5; c += 1) {
      expect(run.cells.has(key({ q: q0 + c, r: 0 }))).toBe(true);
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

  it("창살이 타일과 정확히 같은 델타로 내려간다 — 둘레에서 미끄러지지 않게", () => {
    const run = createRun(stage({
      cols: 7,
      cages: [{ id: "c1", animalId: "sheep", cells: [{ q: 2, r: 3 }, { q: 3, r: 3 }] }],
      tiles: [{ at: { q: 2, r: 2 }, tier: 0 }],
    }));
    for (let i = 0; i < 4; i += 1) {
      const before = run.cages[0]!.cells.map((c) => ({ ...c }));
      const tileBefore = [...run.cells.entries()].find(([, v]) => v.kind === "tile" && v.tier === 0)![0];
      pushRow(run, zero);
      const d = pushDelta(i);
      expect(run.cages[0]!.cells).toEqual(before.map((c) => ({ q: c.q + d.q, r: c.r + d.r })));
      const a = parseKey(tileBefore);
      expect(run.cells.get(key({ q: a.q + d.q, r: a.r + d.r }))).toEqual({ kind: "tile", tier: 0 });
    }
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
      .map((c) => run.cells.get(key({ q: spawnShift(0) + c, r: 0 })))
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


describe("판이 좌우로 오간다 — 오른쪽으로 밀리지 않는다", () => {
  const SIZE = 10;

  it("두 번 밀면 화면 x가 정확히 제자리다", () => {
    // 판에 실제로 놓인 타일을 추적한다 — 좌표를 손으로 적으면 규칙이 틀려도 통과한다.
    const run = createRun(stage({ tiles: [{ at: { q: 2, r: 3 }, tier: 1 }] }));
    const at = (): { q: number; r: number } =>
      parseKey([...run.cells.entries()].find(([, v]) => v.kind === "tile" && v.tier === 1)![0]);
    const before = toPixel(at(), SIZE).x;
    pushRow(run, zero);
    const mid = toPixel(at(), SIZE).x;
    pushRow(run, zero);
    expect(toPixel(at(), SIZE).x).toBeCloseTo(before, 9);
    expect(mid).not.toBeCloseTo(before, 3); // 한 번만 밀면 제자리가 아니다
  });

  it("한 번 밀면 정확히 반 칸 옆으로 간다 — 좌우가 번갈아 나온다", () => {
    const cellW = Math.sqrt(3) * SIZE;
    const x = (a: { q: number; r: number }): number => toPixel(a, SIZE).x;
    const start = { q: 2, r: 3 };
    let cur = start;
    const steps: number[] = [];
    for (let i = 0; i < 4; i += 1) {
      const d = pushDelta(i);
      const nextCell = { q: cur.q + d.q, r: cur.r + d.r };
      steps.push(x(nextCell) - x(cur));
      cur = nextCell;
    }
    expect(steps).toEqual([cellW / 2, -cellW / 2, cellW / 2, -cellW / 2].map((v) => expect.closeTo(v, 9)));
  });

  it("서른 번 밀어도 어떤 칸도 [0, cols] 열 범위를 벗어나지 않는다", () => {
    // 이 불변식이 geom.CELL_W = FIELD_W / (COLS + 1)의 근거다.
    const cols = 11;
    const run = createRun(stage({
      cols,
      rows: 200,
      tiles: Array.from({ length: cols }, (_, c) => ({ at: { q: c, r: 0 }, tier: 0 as const }))
        .concat(Array.from({ length: cols }, (_, c) => ({ at: { q: c, r: 1 }, tier: 0 as const }))),
    }));
    for (let i = 0; i < 30; i += 1) {
      expect(pushRow(run, zero)).toBe(true);
      for (const k of run.cells.keys()) {
        const col = toCol(parseKey(k));
        expect(col).toBeGreaterThanOrEqual(0);
        expect(col).toBeLessThanOrEqual(cols);
      }
    }
  });

  it("새로 깔린 줄도 다음 밀기 뒤에 왼쪽으로 새지 않는다", () => {
    const cols = 11;
    const run = createRun(stage({ cols, rows: 200 }));
    for (let i = 0; i < 6; i += 1) {
      pushRow(run, zero);
      const minCol = Math.min(...[...run.cells.keys()].map((k) => toCol(parseKey(k))));
      expect(minCol).toBeGreaterThanOrEqual(0);
    }
  });
});

describe("spawnShift", () => {
  it("다음 밀기가 왼쪽일 때만 한 칸 오른쪽에서 시작한다", () => {
    expect(pushDelta(1)).toEqual({ q: -1, r: 1 });
    expect(spawnShift(0)).toBe(1);
    expect(pushDelta(2)).toEqual({ q: 0, r: 1 });
    expect(spawnShift(1)).toBe(0);
  });
});
