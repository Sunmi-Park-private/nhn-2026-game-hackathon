// tests/hex/debrisCollide.test.ts — 조각끼리 부딪힐 때의 반동.
//
// QA: 「타일끼리 부딪힐 때 약간의 반동을 주고 떨어지게」. 눈으로는 「좀 튕기는 것
// 같다」밖에 못 본다 — 겹침이 실제로 풀리는지, 멀어지는 쌍까지 붙잡고 떨지는 않는지는
// 값으로만 확인된다.
import { describe, it, expect } from "vitest";
import { collidePieces, PIECE_BOUNCE, type DebrisArena, type DebrisBody } from "../../src/ui/hex/debrisMotion";

const arena: DebrisArena = {
  radius: 10,
  edges: () => ({ left: -1000, right: 1000 }),
  floor: 1000,
};

function body(p: Partial<DebrisBody>): DebrisBody {
  return {
    x: 0, y: 0, vx: 0, vy: 0, rot: 0, spin: 0,
    phase: "fall", age: 0, rollAt: -1, alpha: 1, ...p,
  };
}

const dist = (a: DebrisBody, b: DebrisBody): number => Math.hypot(b.x - a.x, b.y - a.y);

describe("조각끼리 부딪히기", () => {
  it("겹친 두 조각이 지름만큼 떨어진다", () => {
    const a = body({ x: 0, y: 0 });
    const b = body({ x: 6, y: 0 }); // 지름 20인데 6밖에 안 떨어져 있다
    collidePieces([a, b], arena);
    expect(dist(a, b)).toBeCloseTo(arena.radius * 2, 6);
  });

  it("절반씩 물러난다 — 한쪽만 밀리면 덩어리가 한 방향으로 쓸린다", () => {
    const a = body({ x: 0, y: 0 });
    const b = body({ x: 6, y: 0 });
    collidePieces([a, b], arena);
    expect(a.x).toBeCloseTo(-7, 6);
    expect(b.x).toBeCloseTo(13, 6);
  });

  it("마주 오던 둘은 서로 튕겨 나간다", () => {
    const a = body({ x: 0, y: 0, vx: 100 });
    const b = body({ x: 6, y: 0, vx: -100 });
    collidePieces([a, b], arena);
    expect(a.vx).toBeLessThan(0); // 왔던 쪽으로 되튄다
    expect(b.vx).toBeGreaterThan(0);
    // 반발 계수만큼만 되돌아온다 — 완전 탄성(=100)이 아니다
    expect(Math.abs(a.vx)).toBeCloseTo(100 * PIECE_BOUNCE, 6);
  });

  it("멀어지는 중인 쌍은 속도를 건드리지 않는다 — 매 프레임 서로 밀면 덜덜 떤다", () => {
    const a = body({ x: 0, y: 0, vx: -100 });
    const b = body({ x: 6, y: 0, vx: 100 });
    collidePieces([a, b], arena);
    expect(a.vx).toBe(-100);
    expect(b.vx).toBe(100);
  });

  it("완전히 겹쳐도 방향을 만들어 갈라 놓는다 — 0으로 나누지 않는다", () => {
    const a = body({ x: 5, y: 5 });
    const b = body({ x: 5, y: 5 });
    collidePieces([a, b], arena);
    expect(Number.isFinite(a.x)).toBe(true);
    expect(Number.isFinite(b.x)).toBe(true);
    expect(dist(a, b)).toBeCloseTo(arena.radius * 2, 6);
  });

  it("닿지 않은 쌍은 아무것도 바뀌지 않는다", () => {
    const a = body({ x: 0, y: 0, vx: 30 });
    const b = body({ x: 100, y: 0, vx: -30 });
    collidePieces([a, b], arena);
    expect([a.x, a.vx, b.x, b.vx]).toEqual([0, 30, 100, -30]);
  });

  it("죽은 조각은 밀지 않는다 — 사라지는 중인 것에 부딪힐 이유가 없다", () => {
    const a = body({ x: 0, y: 0 });
    const dead = body({ x: 6, y: 0, phase: "dead" });
    collidePieces([a, dead], arena);
    expect(a.x).toBe(0);
    expect(dead.x).toBe(6);
  });

  it("여럿이 뭉쳐 있어도 한 번 돌면 모든 쌍이 떨어진다", () => {
    const list = [body({ x: 0, y: 0 }), body({ x: 4, y: 0 }), body({ x: 8, y: 0 })];
    // 한 번으로 다 풀리지는 않는다 — 프레임마다 도는 것이 전제다. 여러 번 돌린다.
    for (let i = 0; i < 40; i += 1) collidePieces(list, arena);
    for (let i = 0; i < list.length; i += 1) {
      for (let j = i + 1; j < list.length; j += 1) {
        expect(dist(list[i]!, list[j]!)).toBeGreaterThanOrEqual(arena.radius * 2 - 1e-6);
      }
    }
  });
});
