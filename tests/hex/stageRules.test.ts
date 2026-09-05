// tests/hex/stageRules.test.ts — 모든 스테이지가 배치 불변식을 지키는지.
//
// stage-01이 한때 **클리어 불가능**했다. 창살 둘레 규칙 대상 10칸 중 8칸이 고립이라
// 최소 17발이 필요한데 샷은 28발이었고, 게다가 판이 두 덩어리로 끊겨 있었다.
// 눈으로는 멀쩡해 보이는 배치가 규칙상 죽어 있을 수 있다 — 그래서 계산으로 잡는다.
//
// 근거와 곡선은 docs/superpowers/specs/2026-09-05-stage-balance-design.md §3.
// S7(봇이 실제로 클리어한다)은 봇이 생기면 stageSolvable.test.ts로 따로 붙인다.
import { describe, it, expect } from "vitest";
import { stages } from "../../src/data/stages";
import { key, neighbors, distance, ring, inAuthoredBounds, toCol } from "../../src/engine/hex/coords";
import { cageCenter, cageFaces, topFaceIndex } from "../../src/engine/hex/cageFaces";
import { buildCells } from "../../src/engine/hex/grid";
import type { Axial, StageDef } from "../../src/engine/hex/types";

/** 창살 중심이 이보다 가까우면 옆 창살의 둘레가 이 창살의 몸통을 먹는다. */
const MIN_CAGE_GAP = 4;

function occupied(stage: StageDef): Set<string> {
  return new Set(buildCells(stage).keys());
}

/** S1 — 점유 칸이 연결 성분 하나인가. */
export function componentCount(occ: Set<string>): number {
  const seen = new Set<string>();
  let n = 0;
  for (const k of occ) {
    if (seen.has(k)) continue;
    n += 1;
    const [q, r] = k.split(",").map(Number);
    const queue: Axial[] = [{ q: q!, r: r! }];
    seen.add(k);
    while (queue.length > 0) {
      const cur = queue.shift()!;
      for (const nb of neighbors(cur)) {
        const nk = key(nb);
        if (occ.has(nk) && !seen.has(nk)) {
          seen.add(nk);
          queue.push(nb);
        }
      }
    }
  }
  return n;
}

/** S3 — 덩어리 안에 갇힌 빈칸. 아래(발사대 쪽)로 빠져나가지 못하는 빈칸이다. */
export function enclosedHoles(occ: Set<string>, cols: number, rows: number): Axial[] {
  const empty: Axial[] = [];
  for (let r = 0; r < rows; r += 1) {
    for (let c = 0; c < cols; c += 1) {
      const a = { q: c - Math.floor(r / 2), r };
      if (!occ.has(key(a))) empty.push(a);
    }
  }
  const emptySet = new Set(empty.map(key));
  const reached = new Set<string>();
  const queue = empty.filter((a) => a.r === rows - 1);
  for (const a of queue) reached.add(key(a));
  while (queue.length > 0) {
    const cur = queue.shift()!;
    for (const nb of neighbors(cur)) {
      const nk = key(nb);
      if (emptySet.has(nk) && !reached.has(nk)) {
        reached.add(nk);
        queue.push(nb);
      }
    }
  }
  return empty.filter((a) => !reached.has(key(a)));
}

/** 구출 규칙 대상 둘레 칸 — 상단 면을 뺀 나머지 중 보드 안에 있는 것. */
function ruleCells(stage: StageDef, cageIndex: number): Axial[] {
  const cage = stage.cages[cageIndex]!;
  const faces = cageFaces(cage);
  const top = topFaceIndex(faces);
  return faces
    .filter((_, i) => i !== top)
    .flat()
    .filter((a) => inAuthoredBounds(a, stage.cols, stage.rows));
}

describe.each(stages.map((s) => [s.id, s] as const))("%s 배치 불변식", (_id, stage) => {
  const occ = occupied(stage);

  it("S1 — 점유 칸이 하나로 이어진다 (섬 금지)", () => {
    expect(componentCount(occ)).toBe(1);
  });

  it("S2 — 덩어리가 천장(r=0)에 닿는다", () => {
    const touches = [...occ].some((k) => Number(k.split(",")[1]) === 0);
    expect(touches).toBe(true);
  });

  it("S3 — 덩어리 안에 갇힌 빈칸이 없다", () => {
    expect(enclosedHoles(occ, stage.cols, stage.rows)).toEqual([]);
  });

  it("S4 — 보드 안에 있는 창살 둘레 칸이 전부 채워져 있다", () => {
    for (const cage of stage.cages) {
      const center = cageCenter(cage);
      expect(center).not.toBeNull();
      const unfilled = ring(center!, 2)
        .filter((a) => inAuthoredBounds(a, stage.cols, stage.rows))
        .filter((a) => !occ.has(key(a)));
      expect(unfilled).toEqual([]);
    }
  });

  it(`S5 — 창살 중심끼리 ${MIN_CAGE_GAP}칸 이상 떨어진다`, () => {
    // 간격 3이면 옆 창살의 둘레가 이 창살의 몸통을 먹는다. 몸통은 절대 비지 않으므로
    // 그 면은 영원히 열리지 않고 구출이 불가능해진다.
    const centers = stage.cages.map((c) => cageCenter(c)!);
    for (let i = 0; i < centers.length; i += 1) {
      for (let j = i + 1; j < centers.length; j += 1) {
        expect(distance(centers[i]!, centers[j]!)).toBeGreaterThanOrEqual(MIN_CAGE_GAP);
      }
    }
  });

  it("S6 — 창살 몸통이 다른 창살의 규칙 둘레 칸 바로 위에 없다 (조준 그림자)", () => {
    // 발사대가 판 아래에 있어 창살이 발사체를 막는다. 상단 면을 규칙에서 뺀 것과 같은 이유다.
    stage.cages.forEach((cage, i) => {
      const shadowed = stage.cages.flatMap((other, j) => {
        if (i === j) return [];
        return ruleCells(stage, j).filter((cell) =>
          cage.cells.some((body) => toCol(body) === toCol(cell) && body.r < cell.r),
        );
      });
      expect(shadowed).toEqual([]);
    });
  });

  it("규칙 대상 둘레 칸 중 다른 창살의 몸통인 것이 없다 — S5의 직접 확인", () => {
    const bodies = new Set(stage.cages.flatMap((c) => c.cells.map(key)));
    stage.cages.forEach((cage, i) => {
      const own = new Set(cage.cells.map(key));
      const eaten = ruleCells(stage, i).filter((a) => bodies.has(key(a)) && !own.has(key(a)));
      expect(eaten).toEqual([]);
    });
  });
});

describe("검사기 자체가 결함을 잡는가", () => {
  // 단언이 실제로 실패하는지 확인한다 — 통과만 보고 있으면 검사기가 죽어도 모른다.
  it("끊긴 덩어리를 성분 2개로 센다", () => {
    const occ = new Set(["0,0", "1,0", "5,5"]);
    expect(componentCount(occ)).toBe(2);
  });

  it("둘러싸인 빈칸을 찾아낸다", () => {
    // (1,1)만 비우고 그 이웃 6칸을 막으면 아래로 빠져나갈 길이 없다.
    const hole = { q: 1, r: 1 };
    const occ = new Set(neighbors(hole).map(key));
    const holes = enclosedHoles(occ, 4, 4);
    expect(holes.some((a) => a.q === hole.q && a.r === hole.r)).toBe(true);
  });

  it("뚫린 빈칸은 구멍으로 세지 않는다", () => {
    expect(enclosedHoles(new Set<string>(), 4, 4)).toEqual([]);
  });
});
