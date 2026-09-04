# 헥사 머지 슈터 — 파트 1: 격자와 판정 (Task 1~5)

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Spec:** `docs/superpowers/specs/2026-09-04-hexa-merge-shooter-design.md` · 기획 `docs/GDD.md` · 아트 `docs/ART_SPEC.md`

**Tech Stack:** TypeScript 5.4 · Vite 5 · Pixi.js 8 · vitest 1.5

**Goal:** 육각 격자 위에서 벌어지는 일을 순수 함수로 구현한다 — 좌표계, 셀 조회, 합체와 연쇄, 낙하, 궤적과 스냅.

**Architecture:** `src/engine/hex/` 아래 6개 파일. Pixi를 import하지 않으므로 vitest가 헤드리스로 전부 검증한다.

**이 파트가 끝나면:** 게임의 물리와 규칙이 테스트로 증명된다. 아직 "한 판"이라는 개념은 없다.

> **Task 5(궤적·스냅)가 이 프로젝트 전체의 리스크 1위다.** 원형 버블 슈터보다 스냅 대상 선정이 까다롭다. 막히면 다른 태스크로 도망가지 말고 여기서 붙든다.

## 전체 플랜 구성

| 파트 | 파일 | 태스크 | 끝나면 |
|---|---|---|---|
| 1. 격자와 판정 | `...-1-grid.md` | Task 1~5 | 격자 위 규칙이 전부 테스트로 증명된다 |
| 2. 한 판의 성립 | `...-2-run.md` | Task 6~8 | 테스트 안에서 한 판이 굴러간다 |
| 3. 화면과 연결 | `...-3-screen.md` | Task 9~15 | **브라우저에서 플레이된다** (토 13:00 게이트) |

파일 접두사는 `2026-09-04-hexa-merge-shooter`다. **순서대로 실행하고, 앞 파트가 통과하지 않으면 넘어가지 않는다.**

---

## Global Constraints

- **Node 20~24** (`.nvmrc` = 22). Node 25에서도 현재 빌드·테스트는 통과한다
- **화면 = 전체 16:9 · 중앙 9:16 · 좌우 각 175:288.** 게임은 세로 게임이고 중앙 컬럼 안에서만 논다.
  좌우 패널은 가로 뷰포트를 채우는 배경 장식이다 (9/16 + 2×175/288 = 16/9, 정확한 분할)
- **논리 콘텐츠 박스 450×800** (정확히 9:16) — `src/ui/stage.ts`의 `BASE_W`/`BASE_H`가 SSOT.
  캔버스는 뷰포트가 허용하는 만큼 가로로 확장하고(최대 1422.22×800) 남는 자리를 좌우 패널이 채운다
- **7열 고정.** 육각 반지름은 중앙 컬럼 폭에서 역산한다. `geom.ts`가 `CENTER_W`·`FIELD_INSET`으로부터 `CELL_W`와 `HEX_SIZE`를 계산하는 것이 SSOT다 (Task 9). 스테이지 JSON이 7열 전제라 `COLS`는 바꾸지 않는다
- **티어 6단계** — `Tier = 0|1|2|3|4|5` (0=빨강 … 5=황금). 기획서 T1~T6과 1:1 대응하되 0부터 센다
- **머지 임계값 3** — 같은 티어 연결 성분이 3 이상일 때 합체
- **규약 1조** — `ui/` 렌더 함수는 200줄에서 자른다
- **규약 2조** — 새 `ui/` 파일은 `../data`를 직접 import하지 않는다
- **규약 3조** — 새 JSON은 `as unknown as`로 받지 않는다
- **규약 4조** — 화면 전환 상태를 모듈 전역 `let`으로 두지 않는다. `RunState`를 명시적으로 넘긴다
- **규약 5조** — `engine/`은 Pixi를 import하지 않는다
- **규약 7조** — 화면 생명주기를 부모 존재 여부(`!!x.parent`)로 추측하지 않는다
- **기존 테스트 150개는 계속 통과해야 한다** — 구 코드를 건드리지 않으므로 자연히 유지된다
- 테스트는 `tests/hex/*.test.ts`에 둔다. 실행: `npx vitest run tests/hex/<name>.test.ts`

---

---

---

## File Structure — 이 파트에서 만드는 것

| 파일 | 책임 | 예상 |
|---|---|---:|
| `src/engine/hex/types.ts` | `Tier` `Axial` `Cell` `Cage` `StageDef` `RunState` | ~80 |
| `src/engine/hex/coords.ts` | 축좌표 · 6이웃 · `ring` · 거리 · 픽셀 왕복 변환 · 경계 | ~80 |
| `src/engine/hex/grid.ts` | 셀 맵 조회·배치·제거 · 케이지 인접 계산 | ~120 |
| `src/engine/hex/merge.ts` | 연결 성분 · 티어업 · 연쇄 · 황금 폭발 | ~120 |
| `src/engine/hex/gravity.ts` | 앵커 연결성 · 부유 클러스터 탐지 | ~80 |
| `src/engine/hex/shot.ts` | 궤적 · 벽 반사 · 스냅 셀 결정 | ~150 |

테스트: `tests/hex/{coords,grid,merge,gravity,shot}.test.ts`

---

## Task 1: 축좌표계 (coords.ts)

**Files:**
- Create: `src/engine/hex/types.ts`
- Create: `src/engine/hex/coords.ts`
- Test: `tests/hex/coords.test.ts`

**Interfaces:**
- Consumes: 없음 (첫 태스크)
- Produces:
  - `type Tier = 0|1|2|3|4|5`, `const MAX_TIER = 5`
  - `interface Axial { q: number; r: number }`
  - `const DIRS: readonly Axial[]` — 6방향, 길이 6
  - `key(a: Axial): string` / `parseKey(k: string): Axial`
  - `eq(a: Axial, b: Axial): boolean`
  - `add(a: Axial, b: Axial): Axial`
  - `neighbors(a: Axial): Axial[]` — 길이 6
  - `distance(a: Axial, b: Axial): number`
  - `ring(center: Axial, radius: number): Axial[]`
  - `toPixel(a: Axial, size: number): { x: number; y: number }`
  - `fromPixel(p: { x: number; y: number }, size: number): Axial`
  - `toCol(a: Axial): number` — odd-r 오프셋 열 번호
  - `inBounds(a: Axial, cols: number, rows: number): boolean`

- [ ] **Step 1: 타입 파일을 만든다**

`src/engine/hex/types.ts`:

```ts
// engine/hex/types.ts — 헥사 머지 슈터 코어 타입. 순수 TS(Pixi 의존 0).

/** 타일 등급. 0=빨강(최하위, 발사체) 1=노랑 2=초록 3=파랑 4=보라 5=황금(최고).
 *  기획서의 T1~T6과 1:1 대응하되 배열 인덱스와 맞추기 위해 0부터 센다.
 *  이 순서는 가시광선의 파장 순서다 — 합칠수록 파장이 짧아진다. */
export type Tier = 0 | 1 | 2 | 3 | 4 | 5;

/** 최고 등급. 여기서 합체가 일어나면 승급 대신 폭발한다. */
export const MAX_TIER: Tier = 5;

/** 축좌표(axial). pointy-top 육각 격자, 가로 행 스태거. */
export interface Axial {
  q: number;
  r: number;
}

/** 셀 내용. 빈 칸은 Map에 키가 없는 것으로 표현한다(별도 empty 종류를 두지 않는다). */
export type Cell =
  | { kind: "tile"; tier: Tier }
  | { kind: "horseshoe" }
  | { kind: "cage"; cageId: string };

/** 동물이 갇힌 우리. 가로 2셀을 점유하는 멀티셀 오브젝트. */
export interface Cage {
  id: string;
  animalId: string;
  cells: Axial[];
}

/** 스테이지 정의. src/data/stages/*.json 의 스키마. */
export interface StageDef {
  id: string;
  cols: number;
  rows: number;
  /** 구출 목표 마릿수 */
  objective: number;
  /** 발사 횟수 제한 */
  shots: number;
  cages: Cage[];
  tiles: Array<{ at: Axial; tier: Tier }>;
  horseshoes: Axial[];
}

/** 부스터 보유 수량. */
export interface Boosters {
  bomb: number;
  rainbow: number;
  horseshoe: number;
}

/** 한 판의 진행 상태. 모듈 전역에 두지 않고 명시적으로 넘긴다(규약 4조). */
export interface RunState {
  stage: StageDef;
  /** key(Axial) → Cell. 키가 없으면 빈 칸이다. */
  cells: Map<string, Cell>;
  shotsLeft: number;
  /** 구출한 animalId */
  rescued: string[];
  /** 획득한 말굽 수 */
  horseshoes: number;
  boosters: Boosters;
  /** 현재 장전된 등급 */
  loaded: Tier;
  /** 다음 발사체 등급 */
  next: Tier;
}
```

- [ ] **Step 2: 실패하는 테스트를 쓴다**

`tests/hex/coords.test.ts`:

```ts
// tests/hex/coords.test.ts — 축좌표계 유닛
import { describe, it, expect } from "vitest";
import {
  DIRS, key, parseKey, eq, add, neighbors, distance, ring,
  toPixel, fromPixel, toCol, inBounds,
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
    expect(inBounds({ q: 7, r: 0 }, 7, 10)).toBe(false);
  });
});
```

- [ ] **Step 3: 테스트를 돌려 실패를 확인한다**

Run: `npx vitest run tests/hex/coords.test.ts`
Expected: FAIL — `Failed to resolve import "../../src/engine/hex/coords"`

- [ ] **Step 4: coords.ts를 구현한다**

`src/engine/hex/coords.ts`:

```ts
// engine/hex/coords.ts — 축좌표(axial) 헥사 격자. pointy-top, 가로 행 스태거.
// 순수 TS — Pixi를 import하지 않는다(규약 5조).
import type { Axial } from "./types";

const SQRT3 = Math.sqrt(3);

/** 이웃 6방향. 인덱스 순서는 ring() 알고리즘이 의존하므로 바꾸지 말 것. */
export const DIRS: readonly Axial[] = [
  { q: 1, r: 0 },
  { q: 1, r: -1 },
  { q: 0, r: -1 },
  { q: -1, r: 0 },
  { q: -1, r: 1 },
  { q: 0, r: 1 },
];

/** Map 키. 좌표를 객체로 비교할 수 없으므로 문자열로 정규화한다. */
export function key(a: Axial): string {
  return `${a.q},${a.r}`;
}

export function parseKey(k: string): Axial {
  const i = k.indexOf(",");
  return { q: Number(k.slice(0, i)), r: Number(k.slice(i + 1)) };
}

export function eq(a: Axial, b: Axial): boolean {
  return a.q === b.q && a.r === b.r;
}

export function add(a: Axial, b: Axial): Axial {
  return { q: a.q + b.q, r: a.r + b.r };
}

export function neighbors(a: Axial): Axial[] {
  return DIRS.map((d) => add(a, d));
}

/** 큐브 거리. axial(q,r)을 큐브(x=q, z=r, y=-q-r)로 보고 잰다. */
export function distance(a: Axial, b: Axial): number {
  const dq = a.q - b.q;
  const dr = a.r - b.r;
  return (Math.abs(dq) + Math.abs(dq + dr) + Math.abs(dr)) / 2;
}

/** 중심에서 반지름 radius인 테두리. radius=1이면 6칸, 0이면 중심 1칸. */
export function ring(center: Axial, radius: number): Axial[] {
  if (radius <= 0) return [{ ...center }];
  const out: Axial[] = [];
  // DIRS[4] 방향으로 radius칸 이동해 시작점을 잡고, 6방향을 radius칸씩 걷는다
  const start = DIRS[4]!;
  let hex: Axial = { q: center.q + start.q * radius, r: center.r + start.r * radius };
  for (let i = 0; i < 6; i++) {
    for (let j = 0; j < radius; j++) {
      out.push(hex);
      hex = add(hex, DIRS[i]!);
    }
  }
  return out;
}

/** 축좌표 → 픽셀(셀 중심). 원점 (0,0)은 픽셀 (0,0). */
export function toPixel(a: Axial, size: number): { x: number; y: number } {
  return {
    x: size * SQRT3 * (a.q + a.r / 2),
    y: size * 1.5 * a.r,
  };
}

/** 픽셀 → 축좌표. 가장 가까운 셀로 반올림한다(큐브 라운딩). */
export function fromPixel(p: { x: number; y: number }, size: number): Axial {
  const qf = ((SQRT3 / 3) * p.x - (1 / 3) * p.y) / size;
  const rf = ((2 / 3) * p.y) / size;
  return cubeRound(qf, rf);
}

/** 실수 축좌표를 가장 가까운 정수 셀로. 큐브 3축을 각각 반올림하고
 *  오차가 가장 큰 축을 나머지로 맞춘다 — 축좌표만으로 반올림하면 경계에서 틀린다. */
function cubeRound(qf: number, rf: number): Axial {
  const xf = qf;
  const zf = rf;
  const yf = -xf - zf;
  let x = Math.round(xf);
  let y = Math.round(yf);
  let z = Math.round(zf);
  const dx = Math.abs(x - xf);
  const dy = Math.abs(y - yf);
  const dz = Math.abs(z - zf);
  if (dx > dy && dx > dz) x = -y - z;
  else if (dy > dz) y = -x - z;
  else z = -x - y;
  return { q: x, r: z };
}

/** odd-r 오프셋 열 번호. 보드 경계 판정에 쓴다. */
export function toCol(a: Axial): number {
  return a.q + Math.floor(a.r / 2);
}

/** cols×rows 직사각 보드 안인가. */
export function inBounds(a: Axial, cols: number, rows: number): boolean {
  if (a.r < 0 || a.r >= rows) return false;
  const col = toCol(a);
  return col >= 0 && col < cols;
}
```

- [ ] **Step 5: 테스트를 돌려 통과를 확인한다**

Run: `npx vitest run tests/hex/coords.test.ts`
Expected: PASS (모든 케이스)

- [ ] **Step 6: 타입체크와 전체 테스트를 돌린다**

Run: `npm run typecheck && npx vitest run`
Expected: 타입 에러 0 · 기존 150개 + 신규 케이스 전부 통과

- [ ] **Step 7: 커밋한다**

```bash
git add src/engine/hex/types.ts src/engine/hex/coords.ts tests/hex/coords.test.ts
git commit -m "feat(hex): 축좌표계와 코어 타입

pointy-top 축좌표, 6이웃, ring, 큐브 거리, 픽셀 왕복 변환(큐브 라운딩),
odd-r 오프셋 경계 판정. Pixi 의존 0."
```

---

## Task 2: 그리드 조회 (grid.ts)

**Files:**
- Create: `src/engine/hex/grid.ts`
- Test: `tests/hex/grid.test.ts`

**Interfaces:**
- Consumes: Task 1의 `Axial` `Cell` `Cage` `key` `inBounds` `neighbors`
- Produces:
  - `cellAt(cells: Map<string, Cell>, a: Axial): Cell | undefined`
  - `isEmpty(cells: Map<string, Cell>, a: Axial, cols: number, rows: number): boolean`
  - `isOccupied(cells: Map<string, Cell>, a: Axial): boolean`
  - `placeTile(cells: Map<string, Cell>, a: Axial, tier: Tier): void`
  - `clearCell(cells: Map<string, Cell>, a: Axial): void`
  - `cageNeighbors(cage: Cage): Axial[]` — 케이지 바깥 인접 셀(케이지 자기 셀 제외, 중복 제거)
  - `buildCells(stage: StageDef): Map<string, Cell>`

- [ ] **Step 1: 실패하는 테스트를 쓴다**

`tests/hex/grid.test.ts`:

```ts
// tests/hex/grid.test.ts — 그리드 조회·배치 유닛
import { describe, it, expect } from "vitest";
import { key } from "../../src/engine/hex/coords";
import {
  cellAt, isEmpty, isOccupied, placeTile, clearCell, cageNeighbors, buildCells,
} from "../../src/engine/hex/grid";
import type { Cell, StageDef } from "../../src/engine/hex/types";

function emptyCells(): Map<string, Cell> {
  return new Map<string, Cell>();
}

describe("cellAt / isOccupied", () => {
  it("빈 칸은 undefined다", () => {
    expect(cellAt(emptyCells(), { q: 0, r: 0 })).toBeUndefined();
  });

  it("배치한 타일을 되읽는다", () => {
    const cells = emptyCells();
    placeTile(cells, { q: 1, r: 2 }, 3);
    expect(cellAt(cells, { q: 1, r: 2 })).toEqual({ kind: "tile", tier: 3 });
  });

  it("내용이 있으면 점유다", () => {
    const cells = emptyCells();
    placeTile(cells, { q: 0, r: 0 }, 0);
    expect(isOccupied(cells, { q: 0, r: 0 })).toBe(true);
    expect(isOccupied(cells, { q: 1, r: 0 })).toBe(false);
  });
});

describe("isEmpty", () => {
  it("보드 안이고 내용이 없으면 빈 칸이다", () => {
    expect(isEmpty(emptyCells(), { q: 0, r: 0 }, 7, 10)).toBe(true);
  });

  it("보드 밖은 빈 칸이 아니다", () => {
    expect(isEmpty(emptyCells(), { q: -1, r: 0 }, 7, 10)).toBe(false);
    expect(isEmpty(emptyCells(), { q: 0, r: 10 }, 7, 10)).toBe(false);
  });

  it("점유된 칸은 빈 칸이 아니다", () => {
    const cells = emptyCells();
    placeTile(cells, { q: 0, r: 0 }, 0);
    expect(isEmpty(cells, { q: 0, r: 0 }, 7, 10)).toBe(false);
  });
});

describe("clearCell", () => {
  it("지우면 빈 칸이 된다", () => {
    const cells = emptyCells();
    placeTile(cells, { q: 2, r: 2 }, 1);
    clearCell(cells, { q: 2, r: 2 });
    expect(isOccupied(cells, { q: 2, r: 2 })).toBe(false);
  });
});

describe("cageNeighbors", () => {
  const cage = {
    id: "c1",
    animalId: "sheep",
    cells: [{ q: 0, r: 0 }, { q: 1, r: 0 }],
  };

  it("케이지 자기 셀은 포함하지 않는다", () => {
    const ns = cageNeighbors(cage).map(key);
    expect(ns).not.toContain(key({ q: 0, r: 0 }));
    expect(ns).not.toContain(key({ q: 1, r: 0 }));
  });

  it("중복이 없다", () => {
    const ns = cageNeighbors(cage).map(key);
    expect(new Set(ns).size).toBe(ns.length);
  });

  it("가로 2셀 케이지의 바깥 인접은 8칸이다", () => {
    // 각 셀의 이웃 6개 = 12, 서로를 가리키는 2개 제외 = 10,
    // 위아래로 공유하는 이웃 2쌍이 겹쳐 중복 제거 = 8
    expect(cageNeighbors(cage)).toHaveLength(8);
  });
});

describe("buildCells", () => {
  const stage: StageDef = {
    id: "t1",
    cols: 7,
    rows: 10,
    objective: 1,
    shots: 20,
    cages: [{ id: "c1", animalId: "sheep", cells: [{ q: 2, r: 2 }, { q: 3, r: 2 }] }],
    tiles: [{ at: { q: 0, r: 0 }, tier: 0 }, { at: { q: 1, r: 0 }, tier: 4 }],
    horseshoes: [{ q: 5, r: 1 }],
  };

  it("타일을 배치한다", () => {
    const cells = buildCells(stage);
    expect(cellAt(cells, { q: 0, r: 0 })).toEqual({ kind: "tile", tier: 0 });
    expect(cellAt(cells, { q: 1, r: 0 })).toEqual({ kind: "tile", tier: 4 });
  });

  it("말굽을 배치한다", () => {
    expect(cellAt(buildCells(stage), { q: 5, r: 1 })).toEqual({ kind: "horseshoe" });
  });

  it("케이지가 점유한 모든 셀에 cageId를 심는다", () => {
    const cells = buildCells(stage);
    expect(cellAt(cells, { q: 2, r: 2 })).toEqual({ kind: "cage", cageId: "c1" });
    expect(cellAt(cells, { q: 3, r: 2 })).toEqual({ kind: "cage", cageId: "c1" });
  });

  it("나머지는 빈 칸이다", () => {
    expect(isOccupied(buildCells(stage), { q: 6, r: 9 })).toBe(false);
  });
});
```

- [ ] **Step 2: 테스트를 돌려 실패를 확인한다**

Run: `npx vitest run tests/hex/grid.test.ts`
Expected: FAIL — `Failed to resolve import "../../src/engine/hex/grid"`

- [ ] **Step 3: grid.ts를 구현한다**

`src/engine/hex/grid.ts`:

```ts
// engine/hex/grid.ts — 셀 맵 조회·배치. 빈 칸은 "키 없음"으로 표현한다.
import { key, inBounds, neighbors } from "./coords";
import type { Axial, Cage, Cell, StageDef, Tier } from "./types";

export function cellAt(cells: Map<string, Cell>, a: Axial): Cell | undefined {
  return cells.get(key(a));
}

export function isOccupied(cells: Map<string, Cell>, a: Axial): boolean {
  return cells.has(key(a));
}

/** 보드 안이면서 비어 있는가. 보드 밖은 "빈 칸"이 아니다 — 발사체가 놓일 수 없다. */
export function isEmpty(cells: Map<string, Cell>, a: Axial, cols: number, rows: number): boolean {
  return inBounds(a, cols, rows) && !cells.has(key(a));
}

export function placeTile(cells: Map<string, Cell>, a: Axial, tier: Tier): void {
  cells.set(key(a), { kind: "tile", tier });
}

export function clearCell(cells: Map<string, Cell>, a: Axial): void {
  cells.delete(key(a));
}

/** 케이지 바깥의 인접 셀. 케이지 자기 셀은 빼고 중복을 제거한다.
 *  구출 판정(이 셀들이 전부 비었는가)의 기준이 된다. */
export function cageNeighbors(cage: Cage): Axial[] {
  const own = new Set(cage.cells.map(key));
  const seen = new Set<string>();
  const out: Axial[] = [];
  for (const c of cage.cells) {
    for (const n of neighbors(c)) {
      const k = key(n);
      if (own.has(k) || seen.has(k)) continue;
      seen.add(k);
      out.push(n);
    }
  }
  return out;
}

/** 스테이지 정의로부터 초기 셀 맵을 만든다. */
export function buildCells(stage: StageDef): Map<string, Cell> {
  const cells = new Map<string, Cell>();
  for (const t of stage.tiles) cells.set(key(t.at), { kind: "tile", tier: t.tier });
  for (const h of stage.horseshoes) cells.set(key(h), { kind: "horseshoe" });
  for (const cage of stage.cages) {
    for (const c of cage.cells) cells.set(key(c), { kind: "cage", cageId: cage.id });
  }
  return cells;
}
```

- [ ] **Step 4: 테스트를 돌려 통과를 확인한다**

Run: `npx vitest run tests/hex/grid.test.ts`
Expected: PASS

- [ ] **Step 5: 커밋한다**

```bash
git add src/engine/hex/grid.ts tests/hex/grid.test.ts
git commit -m "feat(hex): 그리드 조회·배치와 케이지 인접 계산

빈 칸은 Map 키 없음으로 표현. 케이지는 점유한 모든 셀에 cageId를 심어
멀티셀 오브젝트를 단일 셀 맵으로 다룬다."
```

---

## Task 3: 합체와 연쇄 (merge.ts)

**Files:**
- Create: `src/engine/hex/merge.ts`
- Test: `tests/hex/merge.test.ts`

**Interfaces:**
- Consumes: Task 1의 `Axial` `Tier` `MAX_TIER` `key` `eq` `neighbors` `ring`, Task 2의 `cellAt` `clearCell` `placeTile`
- Produces:
  - `interface MergeStep { kind: "merge" | "explode"; cleared: Axial[]; created?: { at: Axial; tier: Tier } }`
  - `sameTierComponent(cells: Map<string, Cell>, start: Axial): Axial[]`
  - `resolveMerges(cells: Map<string, Cell>, start: Axial): MergeStep[]` — `cells`를 제자리 수정하고 연출용 단계 목록을 반환

- [ ] **Step 1: 실패하는 테스트를 쓴다**

`tests/hex/merge.test.ts`:

```ts
// tests/hex/merge.test.ts — 합체·연쇄·황금 폭발 유닛
import { describe, it, expect } from "vitest";
import { key } from "../../src/engine/hex/coords";
import { cellAt, placeTile } from "../../src/engine/hex/grid";
import { sameTierComponent, resolveMerges } from "../../src/engine/hex/merge";
import type { Cell, Tier } from "../../src/engine/hex/types";

/** 좌표-티어 쌍으로 셀 맵을 만든다. */
function makeCells(entries: Array<[number, number, Tier]>): Map<string, Cell> {
  const cells = new Map<string, Cell>();
  for (const [q, r, tier] of entries) placeTile(cells, { q, r }, tier);
  return cells;
}

describe("sameTierComponent", () => {
  it("혼자면 자기 자신 1칸이다", () => {
    const cells = makeCells([[0, 0, 0]]);
    expect(sameTierComponent(cells, { q: 0, r: 0 })).toHaveLength(1);
  });

  it("붙어 있는 같은 티어를 전부 모은다", () => {
    // (0,0) (1,0) (2,0) 이 한 줄로 인접
    const cells = makeCells([[0, 0, 0], [1, 0, 0], [2, 0, 0]]);
    expect(sameTierComponent(cells, { q: 0, r: 0 })).toHaveLength(3);
  });

  it("다른 티어는 성분에 넣지 않는다", () => {
    const cells = makeCells([[0, 0, 0], [1, 0, 1], [2, 0, 0]]);
    expect(sameTierComponent(cells, { q: 0, r: 0 })).toHaveLength(1);
  });

  it("떨어져 있으면 이어지지 않는다", () => {
    const cells = makeCells([[0, 0, 0], [3, 0, 0]]);
    expect(sameTierComponent(cells, { q: 0, r: 0 })).toHaveLength(1);
  });

  it("빈 칸에서 시작하면 빈 배열이다", () => {
    expect(sameTierComponent(makeCells([]), { q: 0, r: 0 })).toEqual([]);
  });
});

describe("resolveMerges — 기본 합체", () => {
  it("2개는 합체하지 않는다", () => {
    const cells = makeCells([[0, 0, 0], [1, 0, 0]]);
    const steps = resolveMerges(cells, { q: 0, r: 0 });
    expect(steps).toEqual([]);
    expect(cells.size).toBe(2);
  });

  it("3개가 붙으면 착탄 지점에 한 단계 위 색이 남는다", () => {
    const cells = makeCells([[0, 0, 0], [1, 0, 0], [2, 0, 0]]);
    const steps = resolveMerges(cells, { q: 0, r: 0 });

    expect(steps).toHaveLength(1);
    expect(steps[0]!.kind).toBe("merge");
    expect(steps[0]!.created).toEqual({ at: { q: 0, r: 0 }, tier: 1 });
    expect(cellAt(cells, { q: 0, r: 0 })).toEqual({ kind: "tile", tier: 1 });
    expect(cells.size).toBe(1);
  });

  it("합체로 사라진 칸이 cleared에 담긴다", () => {
    const cells = makeCells([[0, 0, 0], [1, 0, 0], [2, 0, 0]]);
    const steps = resolveMerges(cells, { q: 0, r: 0 });
    const cleared = steps[0]!.cleared.map(key);
    expect(new Set(cleared)).toEqual(new Set([key({ q: 1, r: 0 }), key({ q: 2, r: 0 })]));
  });

  it("4개가 붙어도 한 번에 합체하고 1칸만 남는다", () => {
    const cells = makeCells([[0, 0, 0], [1, 0, 0], [2, 0, 0], [3, 0, 0]]);
    resolveMerges(cells, { q: 0, r: 0 });
    expect(cells.size).toBe(1);
    expect(cellAt(cells, { q: 0, r: 0 })).toEqual({ kind: "tile", tier: 1 });
  });
});

describe("resolveMerges — 연쇄", () => {
  it("합체 결과가 또 합체를 부른다", () => {
    // 빨강 3개가 노랑이 되고, 이미 있던 노랑 2개와 만나 초록이 된다
    const cells = makeCells([
      [0, 0, 0], [1, 0, 0], [2, 0, 0],   // 빨강 3
      [0, -1, 1], [1, -1, 1],            // 노랑 2 — (0,0)의 이웃
    ]);
    const steps = resolveMerges(cells, { q: 0, r: 0 });

    expect(steps).toHaveLength(2);
    expect(steps[0]!.created).toEqual({ at: { q: 0, r: 0 }, tier: 1 });
    expect(steps[1]!.created).toEqual({ at: { q: 0, r: 0 }, tier: 2 });
    expect(cellAt(cells, { q: 0, r: 0 })).toEqual({ kind: "tile", tier: 2 });
    expect(cells.size).toBe(1);
  });
});

describe("resolveMerges — 황금 폭발", () => {
  it("황금 3개는 승급하지 않고 폭발한다", () => {
    const cells = makeCells([[0, 0, 5], [1, 0, 5], [2, 0, 5]]);
    const steps = resolveMerges(cells, { q: 0, r: 0 });

    expect(steps).toHaveLength(1);
    expect(steps[0]!.kind).toBe("explode");
    expect(steps[0]!.created).toBeUndefined();
    expect(cells.size).toBe(0);
  });

  it("폭발이 반경 1의 주변 타일을 함께 날린다", () => {
    const cells = makeCells([
      [0, 0, 5], [1, 0, 5], [2, 0, 5],   // 황금 3
      [0, -1, 2],                        // (0,0)의 이웃 — 휩쓸린다
      [5, 5, 3],                         // 멀리 있는 것 — 남는다
    ]);
    resolveMerges(cells, { q: 0, r: 0 });

    expect(cellAt(cells, { q: 0, r: -1 })).toBeUndefined();
    expect(cellAt(cells, { q: 5, r: 5 })).toEqual({ kind: "tile", tier: 3 });
  });

  it("폭발은 케이지를 부수지 않는다", () => {
    const cells = makeCells([[0, 0, 5], [1, 0, 5], [2, 0, 5]]);
    cells.set(key({ q: 0, r: -1 }), { kind: "cage", cageId: "c1" });
    resolveMerges(cells, { q: 0, r: 0 });
    expect(cellAt(cells, { q: 0, r: -1 })).toEqual({ kind: "cage", cageId: "c1" });
  });

  it("폭발로 비워진 자리는 재판정하지 않는다 — 연쇄가 거기서 끝난다", () => {
    const cells = makeCells([[0, 0, 5], [1, 0, 5], [2, 0, 5]]);
    const steps = resolveMerges(cells, { q: 0, r: 0 });
    expect(steps.filter((s) => s.kind === "merge")).toHaveLength(0);
  });
});

describe("resolveMerges — 중립 타일", () => {
  it("말굽은 합체에 참여하지 않는다", () => {
    const cells = makeCells([[0, 0, 0], [1, 0, 0]]);
    cells.set(key({ q: 2, r: 0 }), { kind: "horseshoe" });
    const steps = resolveMerges(cells, { q: 0, r: 0 });
    expect(steps).toEqual([]);
  });
});
```

- [ ] **Step 2: 테스트를 돌려 실패를 확인한다**

Run: `npx vitest run tests/hex/merge.test.ts`
Expected: FAIL — `Failed to resolve import "../../src/engine/hex/merge"`

- [ ] **Step 3: merge.ts를 구현한다**

`src/engine/hex/merge.ts`:

```ts
// engine/hex/merge.ts — 같은 티어 연결 성분을 합쳐 한 단계 올린다.
// 최고 티어(황금)는 승급할 색이 없어 폭발한다 — 가시광선의 끝이기 때문이다.
import { key, eq, neighbors, ring } from "./coords";
import { cellAt, clearCell } from "./grid";
import { MAX_TIER, type Axial, type Cell, type Tier } from "./types";

/** 합체 임계값. 이 수 이상이 붙어야 합쳐진다. */
export const MERGE_THRESHOLD = 3;

/** 연출용 단계. UI가 이 목록을 순서대로 재생한다. */
export interface MergeStep {
  kind: "merge" | "explode";
  /** 비워진 칸들 */
  cleared: Axial[];
  /** 합체로 새로 생긴 타일. 폭발이면 없다. */
  created?: { at: Axial; tier: Tier };
}

/** start와 같은 티어로 이어진 타일 전부. start가 타일이 아니면 빈 배열. */
export function sameTierComponent(cells: Map<string, Cell>, start: Axial): Axial[] {
  const first = cellAt(cells, start);
  if (!first || first.kind !== "tile") return [];
  const tier = first.tier;

  const seen = new Set<string>([key(start)]);
  const out: Axial[] = [start];
  const queue: Axial[] = [start];

  while (queue.length > 0) {
    const cur = queue.shift()!;
    for (const n of neighbors(cur)) {
      const k = key(n);
      if (seen.has(k)) continue;
      const c = cells.get(k);
      if (!c || c.kind !== "tile" || c.tier !== tier) continue;
      seen.add(k);
      out.push(n);
      queue.push(n);
    }
  }
  return out;
}

/**
 * start에서 시작해 합체를 연쇄가 멈출 때까지 해소한다.
 * `cells`를 제자리에서 수정하고, 연출용 단계 목록을 순서대로 반환한다.
 *
 * 연쇄는 재귀가 아니라 큐로 돈다 — 깊이 폭주를 막고 연출 타이밍을
 * 프레임에 맞춰 흘리기 위해서다.
 */
export function resolveMerges(cells: Map<string, Cell>, start: Axial): MergeStep[] {
  const steps: MergeStep[] = [];
  const queue: Axial[] = [start];

  while (queue.length > 0) {
    const origin = queue.shift()!;
    const cell = cellAt(cells, origin);
    if (!cell || cell.kind !== "tile") continue;

    const comp = sameTierComponent(cells, origin);
    if (comp.length < MERGE_THRESHOLD) continue;

    if (cell.tier < MAX_TIER) {
      // 승급 — 착탄 지점에 한 단계 위 색을 남기고 나머지를 비운다
      const cleared: Axial[] = [];
      for (const c of comp) {
        if (eq(c, origin)) continue;
        clearCell(cells, c);
        cleared.push(c);
      }
      const next = (cell.tier + 1) as Tier;
      cells.set(key(origin), { kind: "tile", tier: next });
      steps.push({ kind: "merge", cleared, created: { at: origin, tier: next } });
      queue.push(origin); // 새 타일로 재판정 — 연쇄
    } else {
      // 황금 — 올라갈 색이 없다. 축적된 에너지가 주변을 휩쓴다.
      const blast = new Map<string, Axial>();
      for (const c of comp) blast.set(key(c), c);
      for (const c of ring(origin, 1)) blast.set(key(c), c);

      const cleared: Axial[] = [];
      for (const [k, a] of blast) {
        const target = cells.get(k);
        if (!target || target.kind === "cage") continue; // 케이지는 부수지 않는다
        cells.delete(k);
        cleared.push(a);
      }
      steps.push({ kind: "explode", cleared });
      // 폭발 자리는 재판정하지 않는다 — 연쇄가 여기서 끝난다
    }
  }
  return steps;
}
```

- [ ] **Step 4: 테스트를 돌려 통과를 확인한다**

Run: `npx vitest run tests/hex/merge.test.ts`
Expected: PASS

- [ ] **Step 5: 커밋한다**

```bash
git add src/engine/hex/merge.ts tests/hex/merge.test.ts
git commit -m "feat(hex): 합체·연쇄·황금 폭발

같은 티어 연결 성분 3 이상이면 착탄 지점에 한 단계 위 색을 남긴다.
연쇄는 재귀가 아니라 큐로 돈다. 황금은 승급 대신 반경 1을 휩쓸고
케이지는 부수지 않는다."
```

---

## Task 4: 낙하 (gravity.ts)

**Files:**
- Create: `src/engine/hex/gravity.ts`
- Test: `tests/hex/gravity.test.ts`

**Interfaces:**
- Consumes: Task 1의 `Axial` `Cell` `key` `parseKey` `neighbors`
- Produces:
  - `findFloating(cells: Map<string, Cell>): Axial[]` — 앵커와 끊긴 타일·말굽 좌표
  - `dropFloating(cells: Map<string, Cell>): Axial[]` — 찾아서 제거하고 제거한 좌표를 반환

- [ ] **Step 1: 실패하는 테스트를 쓴다**

`tests/hex/gravity.test.ts`:

```ts
// tests/hex/gravity.test.ts — 앵커 연결성과 부유 클러스터 낙하
import { describe, it, expect } from "vitest";
import { key } from "../../src/engine/hex/coords";
import { placeTile, cellAt } from "../../src/engine/hex/grid";
import { findFloating, dropFloating } from "../../src/engine/hex/gravity";
import type { Cell, Tier } from "../../src/engine/hex/types";

function makeCells(entries: Array<[number, number, Tier]>): Map<string, Cell> {
  const cells = new Map<string, Cell>();
  for (const [q, r, tier] of entries) placeTile(cells, { q, r }, tier);
  return cells;
}

describe("findFloating", () => {
  it("천장(r=0)에 붙은 타일은 떨어지지 않는다", () => {
    const cells = makeCells([[0, 0, 0]]);
    expect(findFloating(cells)).toEqual([]);
  });

  it("천장에서 이어진 사슬은 전부 남는다", () => {
    const cells = makeCells([[0, 0, 0], [0, 1, 1], [0, 2, 2]]);
    expect(findFloating(cells)).toEqual([]);
  });

  it("천장과 끊긴 타일은 떨어진다", () => {
    const cells = makeCells([[0, 0, 0], [3, 5, 1]]);
    const floating = findFloating(cells).map(key);
    expect(floating).toEqual([key({ q: 3, r: 5 })]);
  });

  it("끊긴 덩어리는 통째로 떨어진다", () => {
    const cells = makeCells([[0, 0, 0], [3, 5, 1], [4, 5, 1], [3, 6, 2]]);
    expect(findFloating(cells)).toHaveLength(3);
  });

  it("케이지는 그 자체가 앵커라 떠 있는 판정을 받지 않는다", () => {
    const cells = new Map<string, Cell>();
    cells.set(key({ q: 3, r: 5 }), { kind: "cage", cageId: "c1" });
    expect(findFloating(cells)).toEqual([]);
  });

  it("케이지에 붙은 타일은 천장과 끊겨도 남는다", () => {
    const cells = makeCells([[3, 4, 0]]);
    cells.set(key({ q: 3, r: 5 }), { kind: "cage", cageId: "c1" });
    // (3,4)는 (3,5)의 이웃이다 — 케이지 앵커에 매달려 있다
    expect(findFloating(cells)).toEqual([]);
  });

  it("말굽도 끊기면 떨어진다", () => {
    const cells = makeCells([[0, 0, 0]]);
    cells.set(key({ q: 4, r: 4 }), { kind: "horseshoe" });
    expect(findFloating(cells).map(key)).toEqual([key({ q: 4, r: 4 })]);
  });
});

describe("dropFloating", () => {
  it("떨어진 칸을 셀 맵에서 지운다", () => {
    const cells = makeCells([[0, 0, 0], [3, 5, 1]]);
    const dropped = dropFloating(cells);
    expect(dropped).toHaveLength(1);
    expect(cellAt(cells, { q: 3, r: 5 })).toBeUndefined();
    expect(cellAt(cells, { q: 0, r: 0 })).toEqual({ kind: "tile", tier: 0 });
  });

  it("떨어질 것이 없으면 빈 배열이다", () => {
    const cells = makeCells([[0, 0, 0]]);
    expect(dropFloating(cells)).toEqual([]);
  });
});
```

- [ ] **Step 2: 테스트를 돌려 실패를 확인한다**

Run: `npx vitest run tests/hex/gravity.test.ts`
Expected: FAIL — `Failed to resolve import "../../src/engine/hex/gravity"`

- [ ] **Step 3: gravity.ts를 구현한다**

`src/engine/hex/gravity.ts`:

```ts
// engine/hex/gravity.ts — 앵커에서 끊긴 덩어리는 무너져 내린다.
// 앵커 = 천장(r=0)의 타일 + 모든 케이지 셀.
// 케이지가 앵커이므로 케이지 주변 타일은 저절로 떨어지지 않는다 — 난이도의 원천이다.
import { key, parseKey, neighbors } from "./coords";
import type { Axial, Cell } from "./types";

/** 앵커와 연결이 끊긴 타일·말굽 좌표. 케이지 자신은 앵커라 절대 포함되지 않는다. */
export function findFloating(cells: Map<string, Cell>): Axial[] {
  const reached = new Set<string>();
  const queue: Axial[] = [];

  // 앵커 수집
  for (const [k, cell] of cells) {
    const a = parseKey(k);
    if (cell.kind === "cage" || a.r === 0) {
      if (!reached.has(k)) {
        reached.add(k);
        queue.push(a);
      }
    }
  }

  // 점유된 이웃을 따라 전파
  while (queue.length > 0) {
    const cur = queue.shift()!;
    for (const n of neighbors(cur)) {
      const k = key(n);
      if (reached.has(k) || !cells.has(k)) continue;
      reached.add(k);
      queue.push(n);
    }
  }

  const out: Axial[] = [];
  for (const [k, cell] of cells) {
    if (cell.kind === "cage") continue;
    if (!reached.has(k)) out.push(parseKey(k));
  }
  return out;
}

/** 떠 있는 것을 찾아 제거하고, 제거한 좌표를 반환한다. */
export function dropFloating(cells: Map<string, Cell>): Axial[] {
  const floating = findFloating(cells);
  for (const a of floating) cells.delete(key(a));
  return floating;
}
```

- [ ] **Step 4: 테스트를 돌려 통과를 확인한다**

Run: `npx vitest run tests/hex/gravity.test.ts`
Expected: PASS

- [ ] **Step 5: 커밋한다**

```bash
git add src/engine/hex/gravity.ts tests/hex/gravity.test.ts
git commit -m "feat(hex): 앵커 연결성과 부유 클러스터 낙하

앵커는 천장 행 + 모든 케이지 셀. 케이지가 앵커라 그 주변 타일은
저절로 떨어지지 않고 반드시 합체로 걷어내야 한다."
```

---

## Task 5: 궤적과 스냅 (shot.ts)

> **리스크 1위 태스크다.** 원형 버블 슈터보다 스냅 대상 선정이 까다롭다. 테스트를 먼저 두껍게 깐다.

**Files:**
- Create: `src/engine/hex/shot.ts`
- Test: `tests/hex/shot.test.ts`

**Interfaces:**
- Consumes: Task 1의 `Axial` `Cell` `key` `toPixel` `fromPixel` `inBounds`, Task 2의 `isEmpty`
- Produces:
  - `interface BoardGeom { size: number; cols: number; rows: number }`
  - `interface ShotResult { snap: Axial | null; path: Array<{ x: number; y: number }> }`
  - `boardBounds(geom: BoardGeom): { minX: number; maxX: number }`
  - `simulateShot(cells: Map<string, Cell>, geom: BoardGeom, from: { x: number; y: number }, angleRad: number): ShotResult`
  - 각도 규약: `0` = 똑바로 위, 양수 = 오른쪽으로 기울기 (라디안)

- [ ] **Step 1: 실패하는 테스트를 쓴다**

`tests/hex/shot.test.ts`:

```ts
// tests/hex/shot.test.ts — 궤적·벽 반사·스냅
import { describe, it, expect } from "vitest";
import { toPixel } from "../../src/engine/hex/coords";
import { placeTile } from "../../src/engine/hex/grid";
import { boardBounds, simulateShot } from "../../src/engine/hex/shot";
import type { BoardGeom } from "../../src/engine/hex/shot";
import type { Cell, Tier } from "../../src/engine/hex/types";

const GEOM: BoardGeom = { size: 30, cols: 7, rows: 12 };

function makeCells(entries: Array<[number, number, Tier]>): Map<string, Cell> {
  const cells = new Map<string, Cell>();
  for (const [q, r, tier] of entries) placeTile(cells, { q, r }, tier);
  return cells;
}

/** 보드 하단 중앙의 발사 지점(픽셀). 셀 (3,11) 아래쪽. */
function launchPoint(): { x: number; y: number } {
  const p = toPixel({ q: -2, r: 12 }, GEOM.size);
  return { x: p.x, y: p.y };
}

describe("boardBounds", () => {
  it("좌우 벽이 0열과 마지막 열 바깥에 온다", () => {
    const { minX, maxX } = boardBounds(GEOM);
    expect(minX).toBeLessThan(toPixel({ q: 0, r: 0 }, GEOM.size).x);
    expect(maxX).toBeGreaterThan(toPixel({ q: 6, r: 0 }, GEOM.size).x);
  });
});

describe("simulateShot — 직진", () => {
  it("빈 보드에 똑바로 쏘면 천장 바로 아래에 붙는다", () => {
    const cells = makeCells([]);
    const res = simulateShot(cells, GEOM, launchPoint(), 0);
    expect(res.snap).not.toBeNull();
    expect(res.snap!.r).toBe(0);
  });

  it("경로가 비어 있지 않다", () => {
    const res = simulateShot(makeCells([]), GEOM, launchPoint(), 0);
    expect(res.path.length).toBeGreaterThan(1);
  });

  it("타일에 막히면 그 바로 앞 빈 칸에 붙는다", () => {
    // 발사 직선상 (-2,10)에 타일을 둔다
    const cells = makeCells([[-2, 10, 0]]);
    const res = simulateShot(cells, GEOM, launchPoint(), 0);
    expect(res.snap).toEqual({ q: -2, r: 11 });
  });

  it("스냅한 칸은 반드시 비어 있다", () => {
    const cells = makeCells([[-2, 10, 0], [-2, 9, 1]]);
    const res = simulateShot(cells, GEOM, launchPoint(), 0);
    expect(res.snap).not.toBeNull();
    expect(cells.has(`${res.snap!.q},${res.snap!.r}`)).toBe(false);
  });
});

describe("simulateShot — 케이지", () => {
  it("케이지는 막지만 그 자리에 붙지 않는다", () => {
    const cells = new Map<string, Cell>();
    cells.set("-2,10", { kind: "cage", cageId: "c1" });
    const res = simulateShot(cells, GEOM, launchPoint(), 0);
    expect(res.snap).toEqual({ q: -2, r: 11 });
  });
});

describe("simulateShot — 벽 반사", () => {
  it("비스듬히 쏘면 벽에 튕겨도 보드 안에 붙는다", () => {
    const cells = makeCells([]);
    const res = simulateShot(cells, GEOM, launchPoint(), 0.9);
    expect(res.snap).not.toBeNull();
    expect(res.snap!.r).toBeGreaterThanOrEqual(0);
    expect(res.snap!.r).toBeLessThan(GEOM.rows);
  });

  it("경로가 좌우 벽 밖으로 나가지 않는다", () => {
    const { minX, maxX } = boardBounds(GEOM);
    const res = simulateShot(makeCells([]), GEOM, launchPoint(), -1.0);
    for (const p of res.path) {
      expect(p.x).toBeGreaterThanOrEqual(minX - 0.001);
      expect(p.x).toBeLessThanOrEqual(maxX + 0.001);
    }
  });

  it("반사한 궤적에도 스냅 지점이 있다", () => {
    const res = simulateShot(makeCells([]), GEOM, launchPoint(), -1.1);
    expect(res.snap).not.toBeNull();
  });
});

describe("simulateShot — 경계", () => {
  it("발사 지점이 이미 막혀 있으면 스냅이 없다", () => {
    const from = launchPoint();
    const cells = makeCells([]);
    // 발사 지점 셀 자체를 막는다
    const startCell = { q: -2, r: 12 };
    placeTile(cells, startCell, 0);
    const res = simulateShot(cells, { ...GEOM, rows: 13 }, from, 0);
    expect(res.snap).toBeNull();
  });
});
```

- [ ] **Step 2: 테스트를 돌려 실패를 확인한다**

Run: `npx vitest run tests/hex/shot.test.ts`
Expected: FAIL — `Failed to resolve import "../../src/engine/hex/shot"`

- [ ] **Step 3: shot.ts를 구현한다**

`src/engine/hex/shot.ts`:

```ts
// engine/hex/shot.ts — 발사체 궤적, 좌우 벽 반사, 스냅 셀 결정.
// 각도 규약: 0 = 똑바로 위, 양수 = 오른쪽 기울기 (라디안).
import { key, toPixel, fromPixel, inBounds } from "./coords";
import type { Axial, Cell } from "./types";

const SQRT3 = Math.sqrt(3);

export interface BoardGeom {
  /** 육각 반지름 */
  size: number;
  cols: number;
  rows: number;
}

export interface ShotResult {
  /** 붙을 셀. 어디에도 붙일 수 없으면 null */
  snap: Axial | null;
  /** 연출용 궤적 점 목록 */
  path: Array<{ x: number; y: number }>;
}

/** 좌우 벽의 픽셀 x. 0열 왼쪽 변과 마지막 열 오른쪽 변이다. */
export function boardBounds(geom: BoardGeom): { minX: number; maxX: number } {
  const w = SQRT3 * geom.size; // 셀 폭
  const minX = toPixel({ q: 0, r: 0 }, geom.size).x - w / 2;
  return { minX, maxX: minX + geom.cols * w };
}

/**
 * 발사체를 한 스텝씩 전진시키며 충돌을 찾는다.
 * 좌우 벽에서 반사하고, 점유 셀이나 천장 위로 나가면 멈춘 뒤
 * **마지막으로 지나온 빈 칸**에 스냅한다.
 */
export function simulateShot(
  cells: Map<string, Cell>,
  geom: BoardGeom,
  from: { x: number; y: number },
  angleRad: number,
): ShotResult {
  const { minX, maxX } = boardBounds(geom);
  const step = geom.size / 4; // 셀 하나를 4스텝 이상으로 쪼갠다 — 얇은 관통 방지
  const maxSteps = 4000;

  let dx = Math.sin(angleRad);
  let dy = -Math.cos(angleRad); // 화면 y는 아래로 증가하므로 위로 가려면 음수
  let x = from.x;
  let y = from.y;

  const path: Array<{ x: number; y: number }> = [{ x, y }];
  let lastEmpty: Axial | null = null;

  // 시작 칸이 이미 비어 있다면 후보로 삼는다
  const startCell = fromPixel({ x, y }, geom.size);
  if (inBounds(startCell, geom.cols, geom.rows) && !cells.has(key(startCell))) {
    lastEmpty = startCell;
  }

  for (let i = 0; i < maxSteps; i++) {
    x += dx * step;
    y += dy * step;

    // 좌우 벽 반사 — 입사각 = 반사각
    if (x < minX) {
      x = minX + (minX - x);
      dx = -dx;
    } else if (x > maxX) {
      x = maxX - (x - maxX);
      dx = -dx;
    }
    path.push({ x, y });

    const a = fromPixel({ x, y }, geom.size);

    // 천장을 넘었다 — 더 갈 곳이 없다
    if (a.r < 0) break;

    // 바닥 아래로 빠졌다 — 붙을 곳을 못 찾았다
    if (a.r >= geom.rows) break;

    if (!inBounds(a, geom.cols, geom.rows)) continue;

    if (cells.has(key(a))) break; // 타일이든 케이지든 여기서 멈춘다

    lastEmpty = a;
  }

  return { snap: lastEmpty, path };
}
```

- [ ] **Step 4: 테스트를 돌려 통과를 확인한다**

Run: `npx vitest run tests/hex/shot.test.ts`
Expected: PASS

- [ ] **Step 5: 전체 테스트로 회귀를 확인한다**

Run: `npm run typecheck && npx vitest run`
Expected: 기존 150개 포함 전부 통과

- [ ] **Step 6: 커밋한다**

```bash
git add src/engine/hex/shot.ts tests/hex/shot.test.ts
git commit -m "feat(hex): 궤적·벽 반사·스냅

한 스텝씩 전진하며 충돌을 찾고 마지막으로 지나온 빈 칸에 붙인다.
케이지는 막되 스냅 대상이 아니다(비배치 셀). 스텝을 size/4로 잡아
얇은 관통을 막는다."
```

---

---

## 파트 1 완료 확인

```bash
npm run typecheck && npx vitest run
```

기존 150개 + 신규 약 60개가 전부 통과해야 한다. **통과하지 않으면 파트 2로 넘어가지 않는다** — 엔진이 틀린 채로 위를 얹으면 원인을 찾을 수 없게 된다.

**다음:** `2026-09-04-hexa-merge-shooter-2-run.md`
