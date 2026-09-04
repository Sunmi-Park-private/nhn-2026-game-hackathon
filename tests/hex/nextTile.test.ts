// tests/hex/nextTile.test.ts — 다음 발사체 색 추첨
import { describe, it, expect } from "vitest";
import { key } from "../../src/engine/hex/coords";
import { placeTile } from "../../src/engine/hex/grid";
import { presentTiers, pickNext } from "../../src/engine/hex/nextTile";
import type { Cell, Tier } from "../../src/engine/hex/types";

function board(tiers: Tier[]): Map<string, Cell> {
  const cells = new Map<string, Cell>();
  tiers.forEach((t, i) => placeTile(cells, { q: i, r: 0 }, t));
  return cells;
}

/** rand()가 항상 같은 값을 돌려주는 추첨기. */
const fixed = (v: number) => () => v;

describe("presentTiers", () => {
  it("판에 놓인 티어를 오름차순·중복 없이 모은다", () => {
    expect(presentTiers(board([2, 0, 2, 1, 0]))).toEqual([0, 1, 2]);
  });

  it("말굽과 케이지는 세지 않는다", () => {
    const cells = board([0]);
    cells.set(key({ q: 5, r: 0 }), { kind: "horseshoe" });
    cells.set(key({ q: 6, r: 0 }), { kind: "cage", cageId: "c1" });
    expect(presentTiers(cells)).toEqual([0]);
  });
});

describe("pickNext", () => {
  it("판에 없는 색은 절대 뽑지 않는다", () => {
    // 이게 이 규칙의 핵심이다 — 쓸모없는 탄이 나오면 발사 제한이 낭비된다
    const cells = board([1, 3]);
    for (let i = 0; i < 200; i += 1) {
      expect([1, 3]).toContain(pickNext(cells, fixed(i / 200)));
    }
  });

  it("타일이 하나도 없으면 최하위 티어로 돌아간다", () => {
    expect(pickNext(new Map(), fixed(0.99))).toBe(0);
  });

  it("낮은 티어가 더 자주 나온다", () => {
    // 가중치 1 : 0.5 : 0.25 (합 1.75) → 경계는 0.571…, 0.857…
    const cells = board([0, 1, 2]);
    expect(pickNext(cells, fixed(0))).toBe(0);
    expect(pickNext(cells, fixed(0.5))).toBe(0);
    expect(pickNext(cells, fixed(0.7))).toBe(1);
    expect(pickNext(cells, fixed(0.9))).toBe(2);
  });

  it("rand가 1에 붙어도 마지막 티어를 돌려준다 (범위 밖 반환 없음)", () => {
    const cells = board([0, 4]);
    expect(pickNext(cells, fixed(0.9999999999))).toBe(4);
  });

  it("한 가지 색만 깔린 판이면 항상 그 색이다", () => {
    const cells = board([5, 5, 5]);
    expect(pickNext(cells, fixed(0))).toBe(5);
    expect(pickNext(cells, fixed(0.99))).toBe(5);
  });
});
