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
    pushSeconds: 15,
    armorChance: 0,
    cages: [],
    tiles: [],
    horseshoes: [],
    ...over,
  };
}

describe("createRun", () => {
  it("쏜 수와 내려온 줄 수가 0에서 시작한다", () => {
    const run = createRun(stage());
    expect(run.shotsFired).toBe(0);
    expect(run.pushes).toBe(0);
  });

  it("창살을 복사해 들고 있다 — 줄이 내려오면 창살도 같이 움직여야 한다", () => {
    const cage = { id: "c1", animalId: "sheep", cells: [{ q: 2, r: 2 }] };
    const run = createRun(stage({ cages: [cage] }));
    expect(run.cages).toEqual([cage]);
    expect(run.cages[0]).not.toBe(cage);
    expect(run.cages[0]!.cells[0]).not.toBe(cage.cells[0]);
  });

  it("새 줄에 쓸 색 목록을 초기 타일에서 뽑는다", () => {
    const run = createRun(stage({
      tiles: [
        { at: { q: 0, r: 0 }, tier: 2 },
        { at: { q: 1, r: 0 }, tier: 0 },
        { at: { q: 2, r: 0 }, tier: 2 },
      ],
    }));
    expect(run.palette).toEqual([0, 2]);
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

  it("발사하면 쏜 수가 는다", () => {
    const run = createRun(stage());
    fireAt(run, GEOM, from, 0);
    expect(run.shotsFired).toBe(1);
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

  it("발사 횟수에는 제한이 없다 — 몇 번을 쏴도 계속 나간다", () => {
    // 실패 조건이 샷 리밋에서 줄 내려오기로 바뀌었다(pushRow.ts).
    const run = createRun(stage());
    for (let i = 0; i < 30; i += 1) fireAt(run, GEOM, from, 0);
    expect(run.shotsFired).toBe(30);
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

  it("판이 실패 행에 닿으면 실패다", () => {
    const run = createRun(stage({ objective: 1 }));
    placeTile(run.cells, { q: 0, r: 11 }, 0); // rows=12 → 실패 행은 11
    expect(isFailed(run)).toBe(true);
  });

  it("실패 행에 닿아도 목표를 채웠으면 실패가 아니다", () => {
    const run = createRun(stage({
      objective: 1,
      cages: [{ id: "c1", animalId: "sheep", cells: [{ q: 2, r: 2 }] }],
    }));
    applyRescues(run);
    placeTile(run.cells, { q: 0, r: 11 }, 0);
    expect(isFailed(run)).toBe(false);
    expect(isCleared(run)).toBe(true);
  });

  it("실패 행 위쪽만 차 있으면 실패가 아니다", () => {
    const run = createRun(stage({ objective: 1 }));
    placeTile(run.cells, { q: 0, r: 10 }, 0);
    expect(isFailed(run)).toBe(false);
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

describe("fireAt — 헛발", () => {
  // 이 파일의 기존 fireAt 블록과 같은 발사 지점이다
  const from = toPixel({ q: -2, r: 12 }, GEOM.size);

  it("판에 못 닿아도 쏜 것으로 센다", () => {
    const run = createRun(stage());
    // 거의 수평으로 아주 약하게 — 판에 닿지 못하고 떨어진다
    const out = fireAt(run, GEOM, from, 1.2, 0);
    expect(out.missed).toBe(true);
    expect(out.snapped).toBeNull();
    expect(run.shotsFired).toBe(1);
  });

  it("헛발도 장전을 넘긴다 — 같은 타일이 손에 남지 않는다", () => {
    const run = createRun(stage());
    // 빈 판에서는 pickNext가 늘 0이라 「넘어갔는지」를 0끼리 비교하게 된다.
    // 손에 든 것과 다음 것을 **다른 값으로 벌려 놓고** 확인한다.
    run.loaded = 0;
    run.next = 3;
    fireAt(run, GEOM, from, 1.2, 0);
    expect(run.loaded).toBe(3);
  });


});
