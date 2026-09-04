# 헥사 머지 슈터 — 파트 2: 한 판의 성립 (Task 6~8)

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Spec:** `docs/superpowers/specs/2026-09-04-hexa-merge-shooter-design.md` · 기획 `docs/GDD.md` · 아트 `docs/ART_SPEC.md`

**Tech Stack:** TypeScript 5.4 · Vite 5 · Pixi.js 8 · vitest 1.5

**Goal:** 파트 1의 규칙들을 "한 판"으로 조립한다 — 런 상태, 발사 한 번의 전체 해소, 구출 판정, 승패, 부스터, 스테이지 데이터.

**Architecture:** `fireAt` 하나가 스냅 → 합체·연쇄 → 낙하 → 구출을 순서대로 해소하고 연출에 필요한 결과를 묶어 돌려준다. 상태는 `RunState`로 명시적으로 넘긴다(규약 4조).

**선행 조건:** 파트 1(Task 1~5)이 전부 통과한 상태.

**이 파트가 끝나면:** 화면 없이도 테스트 안에서 한 판이 처음부터 끝까지 굴러간다.

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
| `src/engine/hex/stageRun.ts` | 런 생성 · 발사 처리 · 구출 판정 · 승패 | ~120 |
| `src/engine/hex/boosters.ts` | 폭탄 · 레인보우 · 말굽 | ~80 |
| `src/engine/hex/stageLoader.ts` | 스테이지 JSON 런타임 검증 (규약 3조) | ~120 |
| `src/data/stages/stage-01.json` · `stage-02.json` | 스테이지 정의 | — |
| `src/data/stages/index.ts` | 스테이지 목록 export | ~15 |

### 파트 1에서 가져다 쓰는 것

| 심볼 | 출처 |
|---|---|
| `Axial` `Cell` `Cage` `Tier` `MAX_TIER` `RunState` `StageDef` | `engine/hex/types` |
| `key` `neighbors` `ring` `inBounds` | `engine/hex/coords` |
| `buildCells` `cageNeighbors` `isOccupied` `placeTile` `cellAt` | `engine/hex/grid` |
| `resolveMerges` `MergeStep` | `engine/hex/merge` |
| `dropFloating` | `engine/hex/gravity` |
| `simulateShot` `BoardGeom` | `engine/hex/shot` |

---

## Task 6: 런 상태와 승패 (stageRun.ts)

**Files:**
- Create: `src/engine/hex/stageRun.ts`
- Test: `tests/hex/stageRun.test.ts`

**Interfaces:**
- Consumes: Task 1~5 전부
- Produces:
  - `createRun(stage: StageDef): RunState`
  - `pendingRescues(state: RunState): Cage[]` — 인접이 모두 비었고 아직 구출하지 않은 케이지
  - `applyRescues(state: RunState): Cage[]` — 구출 처리하고 셀 맵에서 케이지를 제거, 구출된 목록 반환
  - `interface ShotOutcome { snapped: Axial | null; steps: MergeStep[]; dropped: Axial[]; rescued: Cage[] }`
  - `fireAt(state: RunState, geom: BoardGeom, from: { x: number; y: number }, angleRad: number): ShotOutcome`
  - `isCleared(state: RunState): boolean`
  - `isFailed(state: RunState): boolean`

- [ ] **Step 1: 실패하는 테스트를 쓴다**

`tests/hex/stageRun.test.ts`:

```ts
// tests/hex/stageRun.test.ts — 런 상태·구출 판정·승패
import { describe, it, expect } from "vitest";
import { key, toPixel } from "../../src/engine/hex/coords";
import { placeTile } from "../../src/engine/hex/grid";
import {
  createRun, pendingRescues, applyRescues, fireAt, isCleared, isFailed,
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
    shots: 5,
    cages: [],
    tiles: [],
    horseshoes: [],
    ...over,
  };
}

describe("createRun", () => {
  it("샷 잔량이 스테이지 정의값이다", () => {
    expect(createRun(stage({ shots: 9 })).shotsLeft).toBe(9);
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

  it("발사하면 샷 잔량이 준다", () => {
    const run = createRun(stage({ shots: 3 }));
    fireAt(run, GEOM, from, 0);
    expect(run.shotsLeft).toBe(2);
  });

  it("스냅한 자리에 장전된 티어가 놓인다", () => {
    const run = createRun(stage());
    const out = fireAt(run, GEOM, from, 0);
    expect(out.snapped).not.toBeNull();
    expect(run.cells.get(key(out.snapped!))).toEqual({ kind: "tile", tier: 0 });
  });

  it("빨강 2개가 이미 붙어 있으면 발사로 합체가 일어난다", () => {
    const run = createRun(stage({
      tiles: [{ at: { q: -2, r: 10 }, tier: 0 }, { at: { q: -1, r: 10 }, tier: 0 }],
    }));
    // (-2,11)에 붙으면 (-2,10)과 인접 → 빨강 3개
    const out = fireAt(run, GEOM, from, 0);
    expect(out.steps.length).toBeGreaterThan(0);
    expect(out.steps[0]!.kind).toBe("merge");
  });

  it("샷이 없으면 발사되지 않는다", () => {
    const run = createRun(stage({ shots: 0 }));
    const out = fireAt(run, GEOM, from, 0);
    expect(out.snapped).toBeNull();
    expect(run.shotsLeft).toBe(0);
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

  it("샷이 떨어지고 목표를 못 채우면 실패다", () => {
    const run = createRun(stage({ objective: 1, shots: 0 }));
    expect(isFailed(run)).toBe(true);
  });

  it("샷이 떨어져도 목표를 채웠으면 실패가 아니다", () => {
    const run = createRun(stage({
      objective: 1,
      shots: 0,
      cages: [{ id: "c1", animalId: "sheep", cells: [{ q: 2, r: 2 }] }],
    }));
    applyRescues(run);
    expect(isFailed(run)).toBe(false);
    expect(isCleared(run)).toBe(true);
  });

  it("샷이 남아 있으면 실패가 아니다", () => {
    expect(isFailed(createRun(stage({ objective: 1, shots: 3 })))).toBe(false);
  });
});
```

- [ ] **Step 2: 테스트를 돌려 실패를 확인한다**

Run: `npx vitest run tests/hex/stageRun.test.ts`
Expected: FAIL — `Failed to resolve import "../../src/engine/hex/stageRun"`

- [ ] **Step 3: stageRun.ts를 구현한다**

`src/engine/hex/stageRun.ts`:

```ts
// engine/hex/stageRun.ts — 한 판의 진행. 발사 → 합체 → 낙하 → 구출을 한 번에 묶는다.
import { key } from "./coords";
import { buildCells, cageNeighbors, isOccupied, placeTile } from "./grid";
import { resolveMerges, type MergeStep } from "./merge";
import { dropFloating } from "./gravity";
import { simulateShot, type BoardGeom } from "./shot";
import type { Axial, Cage, Cell, RunState, StageDef } from "./types";

/** 스테이지 정의로 새 런을 만든다. */
export function createRun(stage: StageDef): RunState {
  return {
    stage,
    cells: buildCells(stage),
    shotsLeft: stage.shots,
    rescued: [],
    horseshoes: 0,
    boosters: { bomb: 3, rainbow: 2, horseshoe: 1 },
    loaded: 0,
    next: 0,
  };
}

/** 인접이 모두 비었고 아직 구출하지 않은 케이지. */
export function pendingRescues(state: RunState): Cage[] {
  const out: Cage[] = [];
  for (const cage of state.stage.cages) {
    if (state.rescued.includes(cage.animalId)) continue;
    // 이미 셀 맵에서 사라진(=구출된) 케이지는 건너뛴다
    if (!cage.cells.some((c) => isOccupied(state.cells, c))) continue;
    const blocked = cageNeighbors(cage).some((n) => isOccupied(state.cells, n));
    if (!blocked) out.push(cage);
  }
  return out;
}

/** 구출을 확정하고 케이지를 셀 맵에서 걷어낸다. */
export function applyRescues(state: RunState): Cage[] {
  const ready = pendingRescues(state);
  for (const cage of ready) {
    for (const c of cage.cells) state.cells.delete(key(c));
    state.rescued.push(cage.animalId);
  }
  return ready;
}

export interface ShotOutcome {
  snapped: Axial | null;
  steps: MergeStep[];
  dropped: Axial[];
  rescued: Cage[];
}

/**
 * 한 발 쏜다. 스냅 → 합체·연쇄 → 낙하 → 구출 판정을 순서대로 해소하고
 * 연출에 필요한 모든 결과를 한 번에 돌려준다.
 */
export function fireAt(
  state: RunState,
  geom: BoardGeom,
  from: { x: number; y: number },
  angleRad: number,
): ShotOutcome {
  const empty: ShotOutcome = { snapped: null, steps: [], dropped: [], rescued: [] };
  if (state.shotsLeft <= 0) return empty;

  const { snap } = simulateShot(state.cells, geom, from, angleRad);
  if (!snap) return empty;

  state.shotsLeft -= 1;
  placeTile(state.cells, snap, state.loaded);

  const steps = resolveMerges(state.cells, snap);
  const dropped = dropFloating(state.cells);

  // 낙하한 말굽을 회수한다 — dropFloating이 지우기 전 종류를 알 수 없으므로
  // 여기서는 좌표만 받고, 말굽 회수는 낙하 직전 스냅샷으로 센다.
  state.horseshoes += countHorseshoes(state, dropped);

  const rescued = applyRescues(state);

  state.loaded = state.next;
  state.next = 0; // 발사체는 항상 최하위 티어

  return { snapped: snap, steps, dropped, rescued };
}

/** dropFloating은 이미 셀을 지웠으므로, 말굽 수는 낙하 목록과
 *  스테이지 정의를 대조해 센다. 스테이지의 말굽 위치는 고정이다. */
function countHorseshoes(state: RunState, dropped: Axial[]): number {
  if (dropped.length === 0) return 0;
  const shoeKeys = new Set(state.stage.horseshoes.map(key));
  return dropped.filter((a) => shoeKeys.has(key(a))).length;
}

export function isCleared(state: RunState): boolean {
  return state.rescued.length >= state.stage.objective;
}

export function isFailed(state: RunState): boolean {
  return state.shotsLeft <= 0 && !isCleared(state);
}
```

- [ ] **Step 4: 테스트를 돌려 통과를 확인한다**

Run: `npx vitest run tests/hex/stageRun.test.ts`
Expected: PASS

- [ ] **Step 5: 커밋한다**

```bash
git add src/engine/hex/stageRun.ts tests/hex/stageRun.test.ts
git commit -m "feat(hex): 런 상태·발사 처리·구출 판정·승패

fireAt이 스냅 → 합체·연쇄 → 낙하 → 구출을 한 번에 해소하고 연출용
결과를 묶어 반환한다. 상태는 RunState로 명시적으로 넘긴다(규약 4조)."
```

---

## Task 7: 부스터 (boosters.ts)

**Files:**
- Create: `src/engine/hex/boosters.ts`
- Modify: `src/engine/hex/stageRun.ts` — `fireAt`에 부스터 인자 추가
- Test: `tests/hex/boosters.test.ts`

**Interfaces:**
- Consumes: Task 1~6 전부
- Produces:
  - `type BoosterId = "bomb" | "rainbow" | "horseshoe"`
  - `useHorseshoe(state: RunState): boolean` — 장전된 티어를 한 단계 올린다. 수량 없거나 이미 최고면 false
  - `hasBooster(state: RunState, id: BoosterId): boolean`
  - `consume(state: RunState, id: BoosterId): boolean`
  - `applyBomb(cells: Map<string, Cell>, at: Axial): Axial[]` — 반경 1 + 자신 제거(케이지 제외), 제거 좌표 반환
  - `rainbowComponent(cells: Map<string, Cell>, at: Axial): Axial[]` — 어떤 색과도 성립하는 성분 계산

- [ ] **Step 1: 실패하는 테스트를 쓴다**

`tests/hex/boosters.test.ts`:

```ts
// tests/hex/boosters.test.ts — 부스터 3종
import { describe, it, expect } from "vitest";
import { key } from "../../src/engine/hex/coords";
import { placeTile, cellAt } from "../../src/engine/hex/grid";
import { createRun } from "../../src/engine/hex/stageRun";
import {
  hasBooster, consume, useHorseshoe, applyBomb, rainbowComponent,
} from "../../src/engine/hex/boosters";
import type { Cell, StageDef, Tier } from "../../src/engine/hex/types";

function stage(): StageDef {
  return { id: "t", cols: 7, rows: 12, objective: 1, shots: 5, cages: [], tiles: [], horseshoes: [] };
}

function makeCells(entries: Array<[number, number, Tier]>): Map<string, Cell> {
  const cells = new Map<string, Cell>();
  for (const [q, r, tier] of entries) placeTile(cells, { q, r }, tier);
  return cells;
}

describe("hasBooster / consume", () => {
  it("초기 수량이 있으면 보유다", () => {
    const run = createRun(stage());
    expect(hasBooster(run, "bomb")).toBe(true);
  });

  it("쓰면 수량이 준다", () => {
    const run = createRun(stage());
    const before = run.boosters.bomb;
    expect(consume(run, "bomb")).toBe(true);
    expect(run.boosters.bomb).toBe(before - 1);
  });

  it("수량이 0이면 쓸 수 없다", () => {
    const run = createRun(stage());
    run.boosters.bomb = 0;
    expect(hasBooster(run, "bomb")).toBe(false);
    expect(consume(run, "bomb")).toBe(false);
  });
});

describe("useHorseshoe", () => {
  it("장전된 티어를 한 단계 올린다", () => {
    const run = createRun(stage());
    expect(run.loaded).toBe(0);
    expect(useHorseshoe(run)).toBe(true);
    expect(run.loaded).toBe(1);
  });

  it("수량을 소모한다", () => {
    const run = createRun(stage());
    const before = run.boosters.horseshoe;
    useHorseshoe(run);
    expect(run.boosters.horseshoe).toBe(before - 1);
  });

  it("이미 최고 티어면 쓸 수 없다", () => {
    const run = createRun(stage());
    run.loaded = 5;
    expect(useHorseshoe(run)).toBe(false);
    expect(run.loaded).toBe(5);
  });

  it("수량이 없으면 쓸 수 없다", () => {
    const run = createRun(stage());
    run.boosters.horseshoe = 0;
    expect(useHorseshoe(run)).toBe(false);
    expect(run.loaded).toBe(0);
  });
});

describe("applyBomb", () => {
  it("착탄 지점과 반경 1을 날린다", () => {
    const cells = makeCells([[0, 0, 0], [1, 0, 1], [0, 1, 2], [5, 5, 3]]);
    const removed = applyBomb(cells, { q: 0, r: 0 });
    expect(cellAt(cells, { q: 0, r: 0 })).toBeUndefined();
    expect(cellAt(cells, { q: 1, r: 0 })).toBeUndefined();
    expect(cellAt(cells, { q: 0, r: 1 })).toBeUndefined();
    expect(cellAt(cells, { q: 5, r: 5 })).toEqual({ kind: "tile", tier: 3 });
    expect(removed).toHaveLength(3);
  });

  it("케이지는 부수지 않는다", () => {
    const cells = makeCells([[0, 0, 0]]);
    cells.set(key({ q: 1, r: 0 }), { kind: "cage", cageId: "c1" });
    applyBomb(cells, { q: 0, r: 0 });
    expect(cellAt(cells, { q: 1, r: 0 })).toEqual({ kind: "cage", cageId: "c1" });
  });
});

describe("rainbowComponent", () => {
  it("색이 달라도 이웃 타일을 성분에 넣는다", () => {
    // (0,0) 자신 + 서로 다른 색 이웃 2개
    const cells = makeCells([[0, 0, 0], [1, 0, 3], [0, 1, 4]]);
    expect(rainbowComponent(cells, { q: 0, r: 0 })).toHaveLength(3);
  });

  it("떨어져 있는 타일은 넣지 않는다", () => {
    const cells = makeCells([[0, 0, 0], [5, 5, 1]]);
    expect(rainbowComponent(cells, { q: 0, r: 0 })).toHaveLength(1);
  });

  it("케이지는 성분에 들어가지 않는다", () => {
    const cells = makeCells([[0, 0, 0]]);
    cells.set(key({ q: 1, r: 0 }), { kind: "cage", cageId: "c1" });
    expect(rainbowComponent(cells, { q: 0, r: 0 })).toHaveLength(1);
  });
});
```

- [ ] **Step 2: 테스트를 돌려 실패를 확인한다**

Run: `npx vitest run tests/hex/boosters.test.ts`
Expected: FAIL — `Failed to resolve import "../../src/engine/hex/boosters"`

- [ ] **Step 3: boosters.ts를 구현한다**

`src/engine/hex/boosters.ts`:

```ts
// engine/hex/boosters.ts — 부스터 3종.
// 폭탄=분해 · 레인보우=교환 · 말굽=합체 가속.
import { key, neighbors, ring } from "./coords";
import { cellAt } from "./grid";
import { MAX_TIER, type Axial, type Cell, type RunState, type Tier } from "./types";

export type BoosterId = "bomb" | "rainbow" | "horseshoe";

export function hasBooster(state: RunState, id: BoosterId): boolean {
  return state.boosters[id] > 0;
}

export function consume(state: RunState, id: BoosterId): boolean {
  if (!hasBooster(state, id)) return false;
  state.boosters[id] -= 1;
  return true;
}

/** 장전된 발사체를 한 단계 위 색으로 승급시킨다. 아트의 NEXT 노란 육각이 이 상태다. */
export function useHorseshoe(state: RunState): boolean {
  if (state.loaded >= MAX_TIER) return false;
  if (!consume(state, "horseshoe")) return false;
  state.loaded = (state.loaded + 1) as Tier;
  return true;
}

/** 착탄 지점과 반경 1을 날린다. 케이지는 부수지 않는다. */
export function applyBomb(cells: Map<string, Cell>, at: Axial): Axial[] {
  const targets = new Map<string, Axial>();
  targets.set(key(at), at);
  for (const a of ring(at, 1)) targets.set(key(a), a);

  const removed: Axial[] = [];
  for (const [k, a] of targets) {
    const cell = cells.get(k);
    if (!cell || cell.kind === "cage") continue;
    cells.delete(k);
    removed.push(a);
  }
  return removed;
}

/** 레인보우 발사체가 만드는 성분 — 색을 가리지 않고 인접한 타일을 모은다. */
export function rainbowComponent(cells: Map<string, Cell>, at: Axial): Axial[] {
  const start = cellAt(cells, at);
  if (!start || start.kind !== "tile") return [];

  const seen = new Set<string>([key(at)]);
  const out: Axial[] = [at];
  for (const n of neighbors(at)) {
    const k = key(n);
    if (seen.has(k)) continue;
    const c = cells.get(k);
    if (!c || c.kind !== "tile") continue;
    seen.add(k);
    out.push(n);
  }
  return out;
}
```

- [ ] **Step 4: 테스트를 돌려 통과를 확인한다**

Run: `npx vitest run tests/hex/boosters.test.ts`
Expected: PASS

- [ ] **Step 5: 전체 테스트로 회귀를 확인한다**

Run: `npm run typecheck && npx vitest run`
Expected: 전부 통과

- [ ] **Step 6: 커밋한다**

```bash
git add src/engine/hex/boosters.ts tests/hex/boosters.test.ts
git commit -m "feat(hex): 부스터 3종

폭탄은 반경 1을 날리고 케이지는 남긴다. 말굽은 장전된 발사체를 한 단계
승급시킨다 — 아트의 NEXT 노란 육각이 이 상태다. 레인보우는 색을 가리지
않는 성분을 만든다."
```

---

## Task 8: 스테이지 데이터와 검증 로더 (stageLoader.ts)

**Files:**
- Create: `src/engine/hex/stageLoader.ts`
- Create: `src/data/stages/stage-01.json`
- Create: `src/data/stages/stage-02.json`
- Create: `src/data/stages/index.ts`
- Test: `tests/hex/stageLoader.test.ts`

**Interfaces:**
- Consumes: Task 1의 `Axial` `StageDef` `Tier` `inBounds`
- Produces:
  - `parseStage(raw: unknown): StageDef` — 검증 통과 시 `StageDef`, 아니면 `throw new Error(...)` (규약 3조)
  - `src/data/stages/index.ts`: `export const stages: StageDef[]`

- [ ] **Step 1: 실패하는 테스트를 쓴다**

`tests/hex/stageLoader.test.ts`:

```ts
// tests/hex/stageLoader.test.ts — 스테이지 JSON 검증 (규약 3조: as unknown as 금지)
import { describe, it, expect } from "vitest";
import { parseStage } from "../../src/engine/hex/stageLoader";
import { stages } from "../../src/data/stages";

const good = {
  id: "s1",
  cols: 7,
  rows: 12,
  objective: 2,
  shots: 20,
  cages: [{ id: "c1", animalId: "sheep", cells: [{ q: 2, r: 2 }, { q: 3, r: 2 }] }],
  tiles: [{ at: { q: 0, r: 0 }, tier: 0 }],
  horseshoes: [{ q: 1, r: 1 }],
};

describe("parseStage — 정상", () => {
  it("올바른 정의를 그대로 통과시킨다", () => {
    const s = parseStage(good);
    expect(s.id).toBe("s1");
    expect(s.cages).toHaveLength(1);
    expect(s.tiles[0]!.tier).toBe(0);
  });
});

describe("parseStage — 거부", () => {
  it("객체가 아니면 던진다", () => {
    expect(() => parseStage(null)).toThrow();
    expect(() => parseStage("x")).toThrow();
  });

  it("id가 없으면 던진다", () => {
    expect(() => parseStage({ ...good, id: undefined })).toThrow(/id/);
  });

  it("tier가 범위를 벗어나면 던진다", () => {
    expect(() => parseStage({ ...good, tiles: [{ at: { q: 0, r: 0 }, tier: 6 }] })).toThrow(/tier/);
  });

  it("tier가 정수가 아니면 던진다", () => {
    expect(() => parseStage({ ...good, tiles: [{ at: { q: 0, r: 0 }, tier: 1.5 }] })).toThrow(/tier/);
  });

  it("보드 밖 좌표는 던진다", () => {
    expect(() => parseStage({ ...good, horseshoes: [{ q: 99, r: 0 }] })).toThrow(/범위/);
  });

  it("케이지 셀이 비면 던진다", () => {
    expect(() => parseStage({
      ...good,
      cages: [{ id: "c1", animalId: "sheep", cells: [] }],
    })).toThrow(/cells/);
  });

  it("objective가 케이지 수보다 많으면 던진다", () => {
    expect(() => parseStage({ ...good, objective: 5 })).toThrow(/objective/);
  });

  it("셀이 겹치면 던진다", () => {
    expect(() => parseStage({
      ...good,
      tiles: [{ at: { q: 2, r: 2 }, tier: 0 }], // 케이지와 같은 자리
    })).toThrow(/겹/);
  });
});

describe("stages 데이터", () => {
  it("스테이지가 하나 이상 있다", () => {
    expect(stages.length).toBeGreaterThan(0);
  });

  it("모든 스테이지가 검증을 통과한다", () => {
    for (const s of stages) expect(() => parseStage(s)).not.toThrow();
  });

  it("id가 중복되지 않는다", () => {
    const ids = stages.map((s) => s.id);
    expect(new Set(ids).size).toBe(ids.length);
  });
});
```

- [ ] **Step 2: 테스트를 돌려 실패를 확인한다**

Run: `npx vitest run tests/hex/stageLoader.test.ts`
Expected: FAIL — `Failed to resolve import "../../src/engine/hex/stageLoader"`

- [ ] **Step 3: stageLoader.ts를 구현한다**

`src/engine/hex/stageLoader.ts`:

```ts
// engine/hex/stageLoader.ts — 스테이지 JSON 런타임 검증.
// 규약 3조: 새 JSON은 as unknown as로 받지 않는다. 디자이너 오투입을
// 런타임이 아니라 로드 시점에 잡는다.
import { key, inBounds } from "./coords";
import type { Axial, Cage, StageDef, Tier } from "./types";

function fail(msg: string): never {
  throw new Error(`스테이지 정의 오류: ${msg}`);
}

function asRecord(v: unknown, what: string): Record<string, unknown> {
  if (typeof v !== "object" || v === null || Array.isArray(v)) fail(`${what}가 객체가 아니다`);
  return v as Record<string, unknown>;
}

function asString(v: unknown, what: string): string {
  if (typeof v !== "string" || v.length === 0) fail(`${what}가 비어 있거나 문자열이 아니다`);
  return v;
}

function asInt(v: unknown, what: string): number {
  if (typeof v !== "number" || !Number.isInteger(v)) fail(`${what}가 정수가 아니다`);
  return v;
}

function asArray(v: unknown, what: string): unknown[] {
  if (!Array.isArray(v)) fail(`${what}가 배열이 아니다`);
  return v;
}

function asAxial(v: unknown, what: string): Axial {
  const o = asRecord(v, what);
  return { q: asInt(o.q, `${what}.q`), r: asInt(o.r, `${what}.r`) };
}

function asTier(v: unknown, what: string): Tier {
  const n = asInt(v, `${what}.tier`);
  if (n < 0 || n > 5) fail(`${what}.tier가 0~5 범위를 벗어났다 (${n})`);
  return n as Tier;
}

export function parseStage(raw: unknown): StageDef {
  const o = asRecord(raw, "스테이지");

  const id = asString(o.id, "id");
  const cols = asInt(o.cols, "cols");
  const rows = asInt(o.rows, "rows");
  const objective = asInt(o.objective, "objective");
  const shots = asInt(o.shots, "shots");

  if (cols <= 0 || rows <= 0) fail("cols/rows는 1 이상이어야 한다");
  if (shots <= 0) fail("shots는 1 이상이어야 한다");

  const occupied = new Map<string, string>();
  const claim = (a: Axial, what: string): void => {
    if (!inBounds(a, cols, rows)) fail(`${what}가 보드 범위를 벗어났다 (q=${a.q}, r=${a.r})`);
    const k = key(a);
    const prev = occupied.get(k);
    if (prev !== undefined) fail(`${what}가 ${prev}와 자리가 겹친다 (q=${a.q}, r=${a.r})`);
    occupied.set(k, what);
  };

  const cages: Cage[] = asArray(o.cages, "cages").map((c, i) => {
    const co = asRecord(c, `cages[${i}]`);
    const cells = asArray(co.cells, `cages[${i}].cells`);
    if (cells.length === 0) fail(`cages[${i}].cells가 비어 있다`);
    const parsed = cells.map((cell, j) => asAxial(cell, `cages[${i}].cells[${j}]`));
    for (const a of parsed) claim(a, `cages[${i}]`);
    return {
      id: asString(co.id, `cages[${i}].id`),
      animalId: asString(co.animalId, `cages[${i}].animalId`),
      cells: parsed,
    };
  });

  if (objective < 0 || objective > cages.length) {
    fail(`objective(${objective})가 케이지 수(${cages.length})를 넘는다`);
  }

  const tiles = asArray(o.tiles, "tiles").map((t, i) => {
    const to = asRecord(t, `tiles[${i}]`);
    const at = asAxial(to.at, `tiles[${i}].at`);
    claim(at, `tiles[${i}]`);
    return { at, tier: asTier(to.tier, `tiles[${i}]`) };
  });

  const horseshoes = asArray(o.horseshoes, "horseshoes").map((h, i) => {
    const a = asAxial(h, `horseshoes[${i}]`);
    claim(a, `horseshoes[${i}]`);
    return a;
  });

  return { id, cols, rows, objective, shots, cages, tiles, horseshoes };
}
```

- [ ] **Step 4: 스테이지 JSON 2개를 만든다**

`src/data/stages/stage-01.json` — 케이지 1개, 튜토리얼 겸용:

```json
{
  "id": "stage-01",
  "cols": 7,
  "rows": 12,
  "objective": 1,
  "shots": 20,
  "cages": [
    { "id": "c1", "animalId": "sheep", "cells": [{ "q": 2, "r": 3 }, { "q": 3, "r": 3 }] }
  ],
  "tiles": [
    { "at": { "q": 0, "r": 0 }, "tier": 0 },
    { "at": { "q": 1, "r": 0 }, "tier": 0 },
    { "at": { "q": 2, "r": 0 }, "tier": 1 },
    { "at": { "q": 3, "r": 0 }, "tier": 1 },
    { "at": { "q": 4, "r": 0 }, "tier": 2 },
    { "at": { "q": 5, "r": 0 }, "tier": 0 },
    { "at": { "q": 6, "r": 0 }, "tier": 0 },
    { "at": { "q": 0, "r": 1 }, "tier": 1 },
    { "at": { "q": 1, "r": 1 }, "tier": 2 },
    { "at": { "q": 2, "r": 1 }, "tier": 0 },
    { "at": { "q": 3, "r": 1 }, "tier": 0 },
    { "at": { "q": 4, "r": 1 }, "tier": 1 },
    { "at": { "q": 5, "r": 1 }, "tier": 2 },
    { "at": { "q": -1, "r": 2 }, "tier": 2 },
    { "at": { "q": 0, "r": 2 }, "tier": 0 },
    { "at": { "q": 1, "r": 2 }, "tier": 1 },
    { "at": { "q": 2, "r": 2 }, "tier": 1 },
    { "at": { "q": 3, "r": 2 }, "tier": 2 },
    { "at": { "q": 4, "r": 2 }, "tier": 0 },
    { "at": { "q": 1, "r": 3 }, "tier": 0 },
    { "at": { "q": 4, "r": 3 }, "tier": 1 }
  ],
  "horseshoes": [{ "q": 5, "r": 2 }]
}
```

`src/data/stages/stage-02.json` — 케이지 2개, 목표 2:

```json
{
  "id": "stage-02",
  "cols": 7,
  "rows": 12,
  "objective": 2,
  "shots": 25,
  "cages": [
    { "id": "c1", "animalId": "zebra", "cells": [{ "q": 0, "r": 3 }, { "q": 1, "r": 3 }] },
    { "id": "c2", "animalId": "deer", "cells": [{ "q": 4, "r": 4 }, { "q": 5, "r": 4 }] }
  ],
  "tiles": [
    { "at": { "q": 0, "r": 0 }, "tier": 1 },
    { "at": { "q": 1, "r": 0 }, "tier": 2 },
    { "at": { "q": 2, "r": 0 }, "tier": 0 },
    { "at": { "q": 3, "r": 0 }, "tier": 0 },
    { "at": { "q": 4, "r": 0 }, "tier": 3 },
    { "at": { "q": 5, "r": 0 }, "tier": 1 },
    { "at": { "q": 6, "r": 0 }, "tier": 2 },
    { "at": { "q": 0, "r": 1 }, "tier": 0 },
    { "at": { "q": 1, "r": 1 }, "tier": 1 },
    { "at": { "q": 2, "r": 1 }, "tier": 3 },
    { "at": { "q": 3, "r": 1 }, "tier": 2 },
    { "at": { "q": 4, "r": 1 }, "tier": 0 },
    { "at": { "q": 5, "r": 1 }, "tier": 0 },
    { "at": { "q": -1, "r": 2 }, "tier": 1 },
    { "at": { "q": 0, "r": 2 }, "tier": 2 },
    { "at": { "q": 1, "r": 2 }, "tier": 0 },
    { "at": { "q": 2, "r": 2 }, "tier": 1 },
    { "at": { "q": 3, "r": 2 }, "tier": 3 },
    { "at": { "q": 4, "r": 2 }, "tier": 2 },
    { "at": { "q": 5, "r": 2 }, "tier": 0 },
    { "at": { "q": -1, "r": 3 }, "tier": 0 },
    { "at": { "q": 2, "r": 3 }, "tier": 2 },
    { "at": { "q": 3, "r": 3 }, "tier": 1 },
    { "at": { "q": 4, "r": 3 }, "tier": 0 },
    { "at": { "q": -2, "r": 4 }, "tier": 1 },
    { "at": { "q": 2, "r": 4 }, "tier": 0 },
    { "at": { "q": 3, "r": 4 }, "tier": 2 }
  ],
  "horseshoes": [{ "q": 5, "r": 3 }, { "q": -1, "r": 4 }]
}
```

- [ ] **Step 5: 스테이지 인덱스를 만든다**

`src/data/stages/index.ts`:

```ts
// data/stages/index.ts — 스테이지 목록. JSON은 로드 시점에 검증한다(규약 3조).
import { parseStage } from "../../engine/hex/stageLoader";
import type { StageDef } from "../../engine/hex/types";
import stage01 from "./stage-01.json";
import stage02 from "./stage-02.json";

export const stages: StageDef[] = [stage01, stage02].map(parseStage);

export function stageAt(index: number): StageDef | undefined {
  return stages[index];
}
```

- [ ] **Step 6: 테스트를 돌려 통과를 확인한다**

Run: `npx vitest run tests/hex/stageLoader.test.ts`
Expected: PASS. 실패하면 JSON 좌표가 겹치거나 범위를 벗어난 것이므로 에러 메시지가 가리키는 항목을 고친다.

- [ ] **Step 7: 타입체크와 전체 테스트**

Run: `npm run typecheck && npx vitest run`
Expected: 전부 통과

- [ ] **Step 8: 커밋한다**

```bash
git add src/engine/hex/stageLoader.ts src/data/stages tests/hex/stageLoader.test.ts
git commit -m "feat(hex): 스테이지 스키마 검증 로더와 스테이지 2종

as unknown as 대신 런타임 검증으로 받는다(규약 3조). 좌표 겹침·범위
이탈·티어 범위를 로드 시점에 잡아 디자이너 오투입을 즉시 드러낸다."
```

---

---

## 파트 2 완료 확인

```bash
npm run typecheck && npx vitest run
```

전부 통과해야 한다. 이 시점에서 **게임 규칙은 완성이고, 남은 것은 보이게 만드는 일뿐이다.**

**다음:** `2026-09-04-hexa-merge-shooter-3-screen.md`
