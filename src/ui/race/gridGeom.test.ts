// 하이라이트가 이미지 안의 타일 위에 정확히 얹히는지 — 어긋나면 엉뚱한 칸이 켜진다
import { describe, expect, it } from "vitest";
import { tileRect, type CardGrid } from "./gridGeom";

const BOX = { x: 40, y: 260, w: 364, h: 308 };
const G: CardGrid = { cols: 3, rows: 2, gap: { x: 0.04, y: 0.06 }, pad: 3 };

describe("카드 격자", () => {
  it("첫 타일은 상자 왼쪽 위에 붙는다", () => {
    const r = tileRect(BOX, G, 0);
    expect(r.x).toBe(BOX.x);
    expect(r.y).toBe(BOX.y);
  });

  it("마지막 타일이 상자 오른쪽 아래에 딱 맞는다", () => {
    const r = tileRect(BOX, G, 5);
    expect(r.x + r.w).toBeCloseTo(BOX.x + BOX.w, 6);
    expect(r.y + r.h).toBeCloseTo(BOX.y + BOX.h, 6);
  });

  it("6칸이 3×2로 놓인다 — 위 3개는 같은 줄", () => {
    const ys = [0, 1, 2].map((i) => tileRect(BOX, G, i).y);
    expect(new Set(ys).size).toBe(1);
    expect(tileRect(BOX, G, 3).y).toBeGreaterThan(ys[0]!);
  });

  it("타일끼리 겹치지 않는다", () => {
    const rs = [0, 1, 2, 3, 4, 5].map((i) => tileRect(BOX, G, i));
    for (let a = 0; a < rs.length; a++) {
      for (let b = a + 1; b < rs.length; b++) {
        const p = rs[a]!, q = rs[b]!;
        const apart = p.x + p.w <= q.x + 1e-9 || q.x + q.w <= p.x + 1e-9
          || p.y + p.h <= q.y + 1e-9 || q.y + q.h <= p.y + 1e-9;
        expect(apart, `${a} vs ${b}`).toBe(true);
      }
    }
  });

  it("모든 타일이 상자 안에 있다", () => {
    for (let i = 0; i < 6; i++) {
      const r = tileRect(BOX, G, i);
      expect(r.x).toBeGreaterThanOrEqual(BOX.x - 1e-9);
      expect(r.y).toBeGreaterThanOrEqual(BOX.y - 1e-9);
      expect(r.x + r.w).toBeLessThanOrEqual(BOX.x + BOX.w + 1e-9);
      expect(r.y + r.h).toBeLessThanOrEqual(BOX.y + BOX.h + 1e-9);
    }
  });

  it("간격이 0이면 타일이 맞닿는다", () => {
    const tight: CardGrid = { ...G, gap: { x: 0, y: 0 } };
    const a = tileRect(BOX, tight, 0);
    expect(tileRect(BOX, tight, 1).x).toBeCloseTo(a.x + a.w, 6);
  });

  it("상자를 옮기면 타일도 그대로 따라간다", () => {
    const moved = tileRect({ ...BOX, x: BOX.x + 50 }, G, 4);
    expect(moved.x).toBeCloseTo(tileRect(BOX, G, 4).x + 50, 6);
  });
});
