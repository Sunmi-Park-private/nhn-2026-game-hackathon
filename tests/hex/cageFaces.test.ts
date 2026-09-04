// tests/hex/cageFaces.test.ts — 둘레 6면 분할과 상단 제외 잠금 규칙
import { describe, it, expect } from "vitest";
import { key, ring, toPixel } from "../../src/engine/hex/coords";
import { placeTile } from "../../src/engine/hex/grid";
import {
  cageCenter, cageFaces, topFaceIndex, cageProgress, isUnlocked,
  FACE_COUNT, FACES_TO_OPEN,
} from "../../src/engine/hex/cageFaces";
import type { Axial, Cage, Cell } from "../../src/engine/hex/types";

const CENTER: Axial = { q: 3, r: 5 };

/** 중심 + 이웃 6칸을 차지하는 표준 케이지. */
function flower(): Cage {
  return {
    id: "c1",
    animalId: "sheep",
    cells: [CENTER, ...ring(CENTER, 1)],
  };
}

/** 케이지 둘레 12칸을 전부 타일로 채운 셀 맵. */
function filledRing(cage: Cage): Map<string, Cell> {
  const cells = new Map<string, Cell>();
  for (const c of cage.cells) cells.set(key(c), { kind: "cage", cageId: cage.id });
  for (const a of ring(CENTER, 2)) placeTile(cells, a, 0);
  return cells;
}

/** 면을 통째로 비운다. */
function clearFace(cells: Map<string, Cell>, face: Axial[]): void {
  for (const a of face) cells.delete(key(a));
}

describe("cageCenter", () => {
  it("이웃 6칸이 전부 케이지인 칸이 중심이다", () => {
    expect(cageCenter(flower())).toEqual(CENTER);
  });

  it("한 칸짜리 케이지는 중심이 없다 — 예전 규칙으로 되돌아간다", () => {
    expect(cageCenter({ id: "c", animalId: "a", cells: [CENTER] })).toBeNull();
  });

  it("가로 2칸짜리 케이지도 중심이 없다", () => {
    const cells = [CENTER, { q: CENTER.q + 1, r: CENTER.r }];
    expect(cageCenter({ id: "c", animalId: "a", cells })).toBeNull();
  });
});

describe("cageFaces", () => {
  it("둘레를 6면 × 2칸으로 나눈다", () => {
    const faces = cageFaces(flower());
    expect(faces).toHaveLength(FACE_COUNT);
    for (const f of faces) expect(f).toHaveLength(2);
  });

  it("6면을 합치면 둘레 12칸과 정확히 같다 — 빠지거나 겹치는 칸이 없다", () => {
    const flat = cageFaces(flower()).flat().map(key).sort();
    const perimeter = ring(CENTER, 2).map(key).sort();
    expect(flat).toEqual(perimeter);
    expect(new Set(flat).size).toBe(12);
  });

  it("중심이 없으면 빈 배열", () => {
    expect(cageFaces({ id: "c", animalId: "a", cells: [CENTER] })).toEqual([]);
  });
});

describe("topFaceIndex", () => {
  it("화면에서 가장 위에 있는 면을 고른다", () => {
    const faces = cageFaces(flower());
    const top = faces[topFaceIndex(faces)]!;
    const topY = top.reduce((s, a) => s + toPixel(a, 1).y, 0) / top.length;
    for (const f of faces) {
      const y = f.reduce((s, a) => s + toPixel(a, 1).y, 0) / f.length;
      expect(topY).toBeLessThanOrEqual(y + 1e-9);
    }
  });

  it("고른 면은 케이지 중심보다 위에 있다", () => {
    const faces = cageFaces(flower());
    const top = faces[topFaceIndex(faces)]!;
    const topY = top.reduce((s, a) => s + toPixel(a, 1).y, 0) / top.length;
    expect(topY).toBeLessThan(toPixel(CENTER, 1).y);
  });
});

describe("cageProgress / isUnlocked", () => {
  it("둘레가 꽉 차 있으면 0면 열림, 잠겨 있다", () => {
    const cage = flower();
    const cells = filledRing(cage);
    const p = cageProgress(cells, cage);
    expect(p.opened).toBe(0);
    expect(p.needed).toBe(FACES_TO_OPEN);
    expect(p.fallback).toBe(false);
    expect(isUnlocked(cells, cage)).toBe(false);
  });

  it("상단 면은 규칙에서 빠진다 — 상단만 비워도 진행도가 오르지 않는다", () => {
    const cage = flower();
    const cells = filledRing(cage);
    const faces = cageFaces(cage);
    clearFace(cells, faces[topFaceIndex(faces)]!);
    expect(cageProgress(cells, cage).opened).toBe(0);
  });

  it("면이 열릴 때마다 진행도가 하나씩 오른다", () => {
    const cage = flower();
    const cells = filledRing(cage);
    const faces = cageFaces(cage);
    const top = topFaceIndex(faces);
    let expected = 0;
    for (let i = 0; i < faces.length; i += 1) {
      if (i === top) continue;
      clearFace(cells, faces[i]!);
      expected += 1;
      expect(cageProgress(cells, cage).opened).toBe(expected);
    }
    expect(expected).toBe(FACES_TO_OPEN);
  });

  it("면의 두 칸 중 하나만 비면 그 면은 열린 것이 아니다", () => {
    const cage = flower();
    const cells = filledRing(cage);
    const faces = cageFaces(cage);
    const side = faces[(topFaceIndex(faces) + 1) % FACE_COUNT]!;
    cells.delete(key(side[0]!));
    expect(cageProgress(cells, cage).opened).toBe(0);
  });

  it("상단을 뺀 5면이 열리면 상단이 남아 있어도 잠금이 풀린다", () => {
    // 이 단언이 규칙의 핵심이다 — 상단은 조준으로 닿지 않으므로
    // 남아 있어도 구출을 막으면 안 된다.
    const cage = flower();
    const cells = filledRing(cage);
    const faces = cageFaces(cage);
    const top = topFaceIndex(faces);
    faces.forEach((f, i) => { if (i !== top) clearFace(cells, f); });

    for (const a of faces[top]!) expect(cells.has(key(a))).toBe(true);
    expect(isUnlocked(cells, cage)).toBe(true);
  });

  it("진행도로 돌려주는 상단 면은 실제 상단 면이다", () => {
    const cage = flower();
    const cells = filledRing(cage);
    const faces = cageFaces(cage);
    expect(cageProgress(cells, cage).topFace).toEqual(faces[topFaceIndex(faces)]);
  });

  it("6면을 만들 수 없는 케이지는 fallback으로 표시된다", () => {
    const cage: Cage = { id: "c", animalId: "a", cells: [CENTER] };
    const p = cageProgress(new Map(), cage);
    expect(p.fallback).toBe(true);
    expect(isUnlocked(new Map(), cage)).toBe(false); // fallback은 여기서 열지 않는다
  });
});
