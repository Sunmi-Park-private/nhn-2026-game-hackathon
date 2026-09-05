// tests/hex/stageRunBoosters.test.ts — 레이스로 번 부스터가 판에 실린다
import { describe, expect, it } from "vitest";
import { createRun } from "../../src/engine/hex/stageRun";
import { stages } from "../../src/data/stages";

const stage = stages[0]!;

describe("부스터 재고", () => {
  it("아무것도 안 넘기면 기본 재고다 — 기존 호출부가 그대로 돈다", () => {
    expect(createRun(stage).boosters).toEqual({ bomb: 3, rainbow: 2, horseshoe: 1 });
  });

  it("넘긴 재고가 그대로 실린다", () => {
    const run = createRun(stage, Math.random, { bomb: 4, rainbow: 2, horseshoe: 3 });
    expect(run.boosters).toEqual({ bomb: 4, rainbow: 2, horseshoe: 3 });
  });

  it("재고 객체를 공유하지 않는다 — 판이 프로필을 깎으면 안 된다", () => {
    const stock = { bomb: 1, rainbow: 1, horseshoe: 1 };
    const run = createRun(stage, Math.random, stock);
    run.boosters.bomb = 99;
    expect(stock.bomb).toBe(1);
  });
});
