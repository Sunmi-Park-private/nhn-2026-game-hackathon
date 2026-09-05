// tests/hex/coords.test.ts — 축좌표계 유닛
import { describe, it, expect } from "vitest";
import {
  DIRS, key, parseKey, eq, add, neighbors, distance, ring,
  toPixel, fromPixel, toCol, inBounds, inAuthoredBounds,
} from "../../src/engine/hex/coords";

describe("key / parseKey", () => {
  it("왕복 변환이 원본과 같다", () => {
    const a = { q: -3, r: 7 };
    expect(parseKey(key(a))).toEqual(a);
  });

  it("같은 좌표는 같은 키를 낸다", () => {
    expect(key({ q: 1, r: 2 })).toBe(key({ q: 1, r: 2 }));
  });
});

describe("neighbors", () => {
  it("이웃은 정확히 6개다", () => {
    expect(neighbors({ q: 0, r: 0 })).toHaveLength(6);
  });

  it("모든 이웃은 거리 1이다", () => {
    const c = { q: 2, r: -1 };
    for (const n of neighbors(c)) expect(distance(c, n)).toBe(1);
  });

  it("이웃끼리 중복이 없다", () => {
    const ks = neighbors({ q: 0, r: 0 }).map(key);
    expect(new Set(ks).size).toBe(6);
  });

  it("DIRS 6방향이 서로 반대쌍을 이룬다", () => {
    for (const d of DIRS) {
      const opposite = { q: -d.q, r: -d.r };
      expect(DIRS.some((x) => eq(x, opposite))).toBe(true);
    }
  });
});

describe("distance", () => {
  it("자기 자신과의 거리는 0", () => {
    expect(distance({ q: 3, r: 3 }, { q: 3, r: 3 })).toBe(0);
  });

  it("대각 방향도 1로 센다", () => {
    expect(distance({ q: 0, r: 0 }, { q: 1, r: -1 })).toBe(1);
  });

  it("두 칸 떨어지면 2", () => {
    expect(distance({ q: 0, r: 0 }, { q: 2, r: 0 })).toBe(2);
  });
});

describe("ring", () => {
  it("반지름 1은 6칸이고 neighbors와 같은 집합이다", () => {
    const r1 = ring({ q: 0, r: 0 }, 1);
    expect(r1).toHaveLength(6);
    expect(new Set(r1.map(key))).toEqual(new Set(neighbors({ q: 0, r: 0 }).map(key)));
  });

  it("반지름 2는 12칸이다", () => {
    expect(ring({ q: 0, r: 0 }, 2)).toHaveLength(12);
  });

  it("반지름 0은 중심 자신 1칸이다", () => {
    expect(ring({ q: 4, r: 5 }, 0)).toEqual([{ q: 4, r: 5 }]);
  });

  it("반지름 2의 모든 칸은 거리 2다", () => {
    for (const c of ring({ q: 0, r: 0 }, 2)) {
      expect(distance({ q: 0, r: 0 }, c)).toBe(2);
    }
  });
});

describe("toPixel / fromPixel", () => {
  it("원점은 픽셀 원점이다", () => {
    expect(toPixel({ q: 0, r: 0 }, 30)).toEqual({ x: 0, y: 0 });
  });

  it("같은 행의 옆 칸은 셀 폭(√3×size)만큼 떨어진다", () => {
    const p = toPixel({ q: 1, r: 0 }, 30);
    expect(p.x).toBeCloseTo(Math.sqrt(3) * 30, 5);
    expect(p.y).toBeCloseTo(0, 5);
  });

  it("다음 행은 1.5×size 아래에 온다", () => {
    const p = toPixel({ q: 0, r: 1 }, 30);
    expect(p.y).toBeCloseTo(45, 5);
  });

  it("왕복 변환이 원본 좌표를 복원한다", () => {
    for (const a of [{ q: 0, r: 0 }, { q: 3, r: 2 }, { q: -2, r: 5 }, { q: 6, r: -3 }]) {
      expect(fromPixel(toPixel(a, 30), 30)).toEqual(a);
    }
  });

  it("셀 중심에서 살짝 벗어난 점도 그 셀로 반올림된다", () => {
    const center = toPixel({ q: 2, r: 3 }, 30);
    expect(fromPixel({ x: center.x + 5, y: center.y - 4 }, 30)).toEqual({ q: 2, r: 3 });
  });
});

describe("toCol / inBounds", () => {
  it("0행은 q가 곧 열 번호다", () => {
    expect(toCol({ q: 4, r: 0 })).toBe(4);
  });

  it("행이 내려가면 q가 음수여도 열은 0 이상일 수 있다", () => {
    // odd-r 오프셋: col = q + floor(r/2)
    expect(toCol({ q: -1, r: 2 })).toBe(0);
  });

  it("보드 안의 칸을 참으로 판정한다", () => {
    expect(inBounds({ q: 0, r: 0 }, 7, 10)).toBe(true);
    expect(inBounds({ q: -1, r: 2 }, 7, 10)).toBe(true);
  });

  it("행이 음수거나 rows 이상이면 거짓이다", () => {
    expect(inBounds({ q: 0, r: -1 }, 7, 10)).toBe(false);
    expect(inBounds({ q: 0, r: 10 }, 7, 10)).toBe(false);
  });

  it("열이 범위를 벗어나면 거짓이다", () => {
    expect(inBounds({ q: -1, r: 0 }, 7, 10)).toBe(false);
    expect(inBounds({ q: 8, r: 0 }, 7, 10)).toBe(false);
  });

  it("짝수 행은 열 cols까지 허용한다 — 판이 반 칸 오른쪽으로 갔을 때의 마지막 칸이다", () => {
    // 여기서 잘라내면 발사체가 그 타일을 통과한다(simulateShot은 보드 밖을 충돌로 안 센다).
    expect(inBounds({ q: 7, r: 0 }, 7, 10)).toBe(true);
    expect(toCol({ q: 7, r: 0 })).toBe(7);
  });

  it("홀수 행은 열 cols를 허용하지 않는다 — 이미 반 칸 오른쪽이라 우리 밖으로 나간다", () => {
    expect(toCol({ q: 7, r: 1 })).toBe(7);
    expect(inBounds({ q: 7, r: 1 }, 7, 10)).toBe(false);
    expect(inBounds({ q: 6, r: 1 }, 7, 10)).toBe(true);
  });
});

describe("inAuthoredBounds", () => {
  it("배치 경계는 여분 반 칸을 주지 않는다 — 거기 적은 타일은 첫 밀기에 우리 밖으로 나간다", () => {
    expect(inBounds({ q: 7, r: 0 }, 7, 10)).toBe(true);
    expect(inAuthoredBounds({ q: 7, r: 0 }, 7, 10)).toBe(false);
  });

  it("그 밖에는 inBounds와 같다", () => {
    for (let r = 0; r < 10; r += 1) {
      for (let q = -6; q <= 8; q += 1) {
        const col = toCol({ q, r });
        if (col === 7) continue; // 여분 칸만 다르다
        expect(inAuthoredBounds({ q, r }, 7, 10)).toBe(inBounds({ q, r }, 7, 10));
      }
    }
  });
});
