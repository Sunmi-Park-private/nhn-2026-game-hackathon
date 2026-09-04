# 헥사 머지 슈터 — 파트 3: 화면과 연결 (Task 9~15)

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Spec:** `docs/superpowers/specs/2026-09-04-hexa-merge-shooter-design.md` · 기획 `docs/GDD.md` · 아트 `docs/ART_SPEC.md`

**Tech Stack:** TypeScript 5.4 · Vite 5 · Pixi.js 8 · vitest 1.5

**Goal:** 완성된 엔진을 Pixi 화면에 얹고 부트 플로우에 연결해, 브라우저에서 실제로 플레이되게 한다.

**Architecture:** `src/ui/hex/` 아래 7개 모듈, 파일당 200줄 상한(규약 1조). 아트가 없으면 색 육각으로 폴백해 **디자이너를 기다리지 않는다.** 구 화면 코드는 삭제하지 않고 import만 끊는다(병렬 신규 라인 — 설계문서 §3).

**선행 조건:** 파트 1·2가 전부 통과한 상태.

**이 파트가 끝나면 토 13:00 「플레이 가능」 게이트를 통과한다.**

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
- **논리 좌표계 430×800** — `src/ui/stage.ts`의 `BASE_W`/`BASE_H`가 SSOT다. 새 코드도 이 좌표계에 그린다
- **7열 고정.** 육각 반지름은 나무 프레임 안쪽 폭에서 역산한다 — 최종 시안의 프레임이 좌우를 잡아먹어 430 전폭을 쓸 수 없다. `geom.ts`가 `FIELD_INSET`으로부터 `HEX_SIZE`를 계산하는 것이 SSOT다 (Task 9)
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

## File Structure — 이 파트에서 손대는 것

### 신규

| 파일 | 책임 |
|---|---|
| `src/ui/hex/geom.ts` | 나무 프레임 안쪽 폭에서 육각 크기 역산 · 셀 → 화면 좌표 |
| `src/ui/hex/tileArt.ts` | 타일 텍스처 조회 + `Graphics` 색 육각 폴백 |
| `src/ui/hex/boardView.ts` | 그리드 렌더 · 타일 스프라이트 관리 |
| `src/ui/hex/cageView.ts` | 케이지 렌더 · 구출 연출 |
| `src/ui/hex/hudView.ts` | 스테이지 번호 · 목표 카운터 · NEXT · 부스터 |
| `src/ui/hex/launcher.ts` | 조준 입력 · 궤적 가이드 · 발사 애니메이션 |
| `src/ui/hex/stageScreen.ts` | 화면 조립 · 입력 → 엔진 → 렌더 배선 |

### 수정

| 파일 | 변경 |
|---|---|
| `src/main.ts` | 게임 루프를 스테이지 루프로 교체 · 구 화면 import 제거 · 아트 로드 |
| `src/data/assets.json` | 헥사 타일·케이지·동물 슬롯 추가 |
| `src/ui/assets.ts` | `loadHexAssets()` 추가 |

### 엔진에서 가져다 쓰는 것

| 심볼 | 출처 |
|---|---|
| `Axial` `Cell` `Tier` `Cage` `RunState` `StageDef` | `engine/hex/types` |
| `key` `parseKey` `toPixel` | `engine/hex/coords` |
| `BoardGeom` `simulateShot` | `engine/hex/shot` |
| `createRun` `fireAt` `isCleared` `isFailed` | `engine/hex/stageRun` |
| `stages` | `data/stages` |

### 기존 코드에서 재사용하는 것

| 심볼 | 출처 |
|---|---|
| `fullRect` | `ui/stage.ts` |
| `playPrologue` `showLoading` `showTitle` | `ui/boot.ts` |
| `loadGameAssets` `tryLoad` 파이프라인 | `ui/assets.ts` |

---

## Task 9: 보드 지오메트리와 타일 아트 (geom.ts, tileArt.ts)

**Files:**
- Create: `src/ui/hex/geom.ts`
- Create: `src/ui/hex/tileArt.ts`
- Test: `tests/hex/geom.test.ts`

**Interfaces:**
- Consumes: Task 1의 `Axial` `toPixel`, Task 5의 `BoardGeom`
- Produces:
  - `const HEX_SIZE = 30` · `const COLS = 7` · `const ROWS = 12`
  - `const BOARD: BoardGeom`
  - `const ORIGIN: { x: number; y: number }` — 셀 (0,0) 중심의 논리 좌표
  - `cellToScreen(a: Axial): { x: number; y: number }`
  - `launchOrigin(): { x: number; y: number }`
  - `TIER_COLORS: readonly number[]` — 6색 (플레이스홀더·폴백용)
  - `tileTexture(tier: Tier): Texture | null` — 아트 매니페스트 조회
  - `drawTileFallback(tier: Tier): Graphics` — 아트 없을 때 색 육각

- [ ] **Step 1: 실패하는 테스트를 쓴다**

`tests/hex/geom.test.ts`:

```ts
// tests/hex/geom.test.ts — 보드 배치 상수 (Pixi 비의존 부분만)
import { describe, it, expect } from "vitest";
import {
  HEX_SIZE, CELL_W, COLS, ROWS, BOARD, ORIGIN, FIELD_INSET,
  cellToScreen, launchOrigin,
} from "../../src/ui/hex/geom";

describe("보드 상수", () => {
  it("7열이다", () => {
    expect(COLS).toBe(7);
  });

  it("셀 폭은 √3 × 반지름이다", () => {
    expect(CELL_W).toBeCloseTo(Math.sqrt(3) * HEX_SIZE, 5);
  });

  it("BOARD가 상수와 일치한다", () => {
    expect(BOARD).toEqual({ size: HEX_SIZE, cols: COLS, rows: ROWS });
  });
});

describe("나무 프레임 안쪽에 들어간다", () => {
  it("보드 전체 폭이 프레임 안쪽 폭을 넘지 않는다", () => {
    const fieldW = 430 - FIELD_INSET * 2;
    expect(COLS * CELL_W).toBeLessThanOrEqual(fieldW + 0.001);
  });

  it("보드 왼쪽 끝이 프레임 안쪽보다 안에 있다", () => {
    const left = cellToScreen({ q: 0, r: 0 }).x - CELL_W / 2;
    expect(left).toBeGreaterThanOrEqual(FIELD_INSET - 0.001);
  });

  it("보드 오른쪽 끝이 프레임 안쪽보다 안에 있다", () => {
    const right = cellToScreen({ q: COLS - 1, r: 0 }).x + CELL_W / 2;
    expect(right).toBeLessThanOrEqual(430 - FIELD_INSET + 0.001);
  });

  it("좌우 여백이 대칭이다", () => {
    const left = cellToScreen({ q: 0, r: 0 }).x - CELL_W / 2;
    const right = 430 - (cellToScreen({ q: COLS - 1, r: 0 }).x + CELL_W / 2);
    expect(left).toBeCloseTo(right, 5);
  });
});

describe("cellToScreen", () => {
  it("셀 (0,0)은 ORIGIN에 온다", () => {
    expect(cellToScreen({ q: 0, r: 0 })).toEqual(ORIGIN);
  });

  it("같은 행의 옆 칸은 셀 폭만큼 떨어진다", () => {
    const a = cellToScreen({ q: 0, r: 0 });
    const b = cellToScreen({ q: 1, r: 0 });
    expect(b.x - a.x).toBeCloseTo(CELL_W, 5);
  });
});

describe("launchOrigin", () => {
  it("발사 지점이 보드 마지막 행보다 아래에 있다", () => {
    expect(launchOrigin().y).toBeGreaterThan(cellToScreen({ q: 0, r: ROWS - 1 }).y);
  });

  it("발사 지점이 가로 중앙이다", () => {
    expect(launchOrigin().x).toBeCloseTo(215, 0);
  });

  it("발사 지점이 화면 안에 있다", () => {
    expect(launchOrigin().y).toBeLessThan(800);
  });
});
```

- [ ] **Step 2: 테스트를 돌려 실패를 확인한다**

Run: `npx vitest run tests/hex/geom.test.ts`
Expected: FAIL — `Failed to resolve import "../../src/ui/hex/geom"`

- [ ] **Step 3: geom.ts를 구현한다**

`src/ui/hex/geom.ts`:

```ts
// ui/hex/geom.ts — 보드의 논리 좌표 배치. stage.ts의 430×800 좌표계 위에 얹는다.
// Pixi를 import하지 않는다 — 순수 계산이라 테스트가 헤드리스로 돈다.
import { toPixel } from "../../engine/hex/coords";
import type { Axial } from "../../engine/hex/types";
import type { BoardGeom } from "../../engine/hex/shot";

/** 최종 아트의 나무 프레임 안쪽까지의 여백(한쪽). 판은 이 안에서만 논다.
 *  프레임을 조금 넓히거나 좁히면 여기만 고치면 되고, 육각 크기는 자동으로 따라온다. */
export const FIELD_INSET = 58;

export const COLS = 7;
export const ROWS = 12;

/** 프레임 안쪽 폭. 430에서 좌우 여백을 뺀 값. */
const FIELD_W = 430 - FIELD_INSET * 2; // 314

/** 셀 폭은 프레임 안쪽 폭을 열 수로 나눈 값이다 — 아트가 크기를 정한다. */
export const CELL_W = FIELD_W / COLS; // ≈ 44.86

/** 육각 반지름은 셀 폭에서 역산한다. 셀 폭 = √3 × 반지름. */
export const HEX_SIZE = CELL_W / Math.sqrt(3); // ≈ 25.9

/** 행 간격. pointy-top 육각은 1.5 × 반지름씩 내려간다. */
export const ROW_H = HEX_SIZE * 1.5; // ≈ 38.9

export const BOARD: BoardGeom = { size: HEX_SIZE, cols: COLS, rows: ROWS };

/** 셀 (0,0) 중심의 논리 좌표. 좌우 여백이 정확히 FIELD_INSET이 되도록 잡는다. */
export const ORIGIN = {
  x: FIELD_INSET + CELL_W / 2,
  y: 150, // 상단 HUD(스테이지 바) 아래
};

export function cellToScreen(a: Axial): { x: number; y: number } {
  const p = toPixel(a, HEX_SIZE);
  return { x: ORIGIN.x + p.x, y: ORIGIN.y + p.y };
}

/** 발사 지점 — 판 하단 중앙. 붉은말이 여기서 타일을 던진다. */
export function launchOrigin(): { x: number; y: number } {
  return { x: 215, y: ORIGIN.y + ROW_H * ROWS + 30 };
}

/** 발사 지점을 엔진 좌표계(ORIGIN 기준)로 옮긴다 — simulateShot이 쓰는 계다. */
export function launchOriginLocal(): { x: number; y: number } {
  const o = launchOrigin();
  return { x: o.x - ORIGIN.x, y: o.y - ORIGIN.y };
}
```

- [ ] **Step 4: 테스트를 돌려 통과를 확인한다**

Run: `npx vitest run tests/hex/geom.test.ts`
Expected: PASS. `launchOrigin().y`가 800을 넘으면 `ROWS`를 줄인다 — `HEX_SIZE`는 프레임 폭이 정하므로 건드리지 않는다.

- [ ] **Step 5: tileArt.ts를 구현한다**

`src/ui/hex/tileArt.ts`:

```ts
// ui/hex/tileArt.ts — 타일 그리기. 아트가 없으면 색 육각으로 폴백한다.
// 디자이너 아트를 기다리지 않고 개발할 수 있게 하는 장치다.
import { Graphics, Sprite, Texture, Container } from "pixi.js";
import { HEX_SIZE } from "./geom";
import type { Tier } from "../../engine/hex/types";

/** 가시광선 파장 순서. 아트 도착 전 플레이스홀더이자 폴백 색이다. */
export const TIER_COLORS: readonly number[] = [
  0xe6392f, // 빨강  T1
  0xf5c518, // 노랑  T2
  0x3fa34d, // 초록  T3
  0x2f7fd6, // 파랑  T4
  0x8b4fc7, // 보라  T5
  0xf0a020, // 황금  T6
];

export const HORSESHOE_COLOR = 0x8a5a2b;

/** pointy-top 육각형 꼭짓점 6개. 위아래가 뾰족하고 좌우가 수직 변이다. */
function hexPoints(size: number): number[] {
  const pts: number[] = [];
  for (let i = 0; i < 6; i++) {
    const angle = (Math.PI / 180) * (60 * i - 90);
    pts.push(size * Math.cos(angle), size * Math.sin(angle));
  }
  return pts;
}

/** 색 육각 플레이스홀더. 안쪽에 밝은 테두리를 넣어 격자가 읽히게 한다. */
export function drawTileFallback(color: number): Graphics {
  const g = new Graphics();
  g.poly(hexPoints(HEX_SIZE - 1)).fill(color);
  g.poly(hexPoints(HEX_SIZE - 4)).stroke({ width: 2, color: 0xffffff, alpha: 0.25 });
  return g;
}

/** 타일 하나의 표시 객체. 텍스처가 있으면 스프라이트, 없으면 색 육각. */
export function makeTileView(tier: Tier, tex: Texture | null): Container {
  if (tex) {
    const s = new Sprite(tex);
    s.anchor.set(0.5);
    s.width = Math.sqrt(3) * HEX_SIZE;
    s.height = 2 * HEX_SIZE;
    return s;
  }
  return drawTileFallback(TIER_COLORS[tier] ?? 0x888888);
}

export function makeHorseshoeView(tex: Texture | null): Container {
  if (tex) {
    const s = new Sprite(tex);
    s.anchor.set(0.5);
    s.width = Math.sqrt(3) * HEX_SIZE;
    s.height = 2 * HEX_SIZE;
    return s;
  }
  return drawTileFallback(HORSESHOE_COLOR);
}
```

- [ ] **Step 6: 타입체크와 전체 테스트**

Run: `npm run typecheck && npx vitest run`
Expected: 전부 통과

- [ ] **Step 7: 커밋한다**

```bash
git add src/ui/hex/geom.ts src/ui/hex/tileArt.ts tests/hex/geom.test.ts
git commit -m "feat(hex): 보드 지오메트리와 타일 아트 폴백

7열을 나무 프레임 안쪽(좌우 58px 여백)에 맞추고 육각 크기를 역산한다.
아트가 없으면
가시광선 순서의 색 육각으로 폴백해 디자이너를 기다리지 않고 개발한다."
```

---

## Task 10: 보드 렌더 (boardView.ts)

**Files:**
- Create: `src/ui/hex/boardView.ts`

**Interfaces:**
- Consumes: Task 9의 `cellToScreen` `makeTileView` `makeHorseshoeView`, Task 1의 `Axial` `Cell` `key` `parseKey`
- Produces:
  - `interface BoardView { root: Container; sync(cells: Map<string, Cell>): void; viewAt(a: Axial): Container | undefined; destroy(): void }`
  - `createBoardView(textures: TileTextures): BoardView`
  - `interface TileTextures { tiles: Array<Texture | null>; horseshoe: Texture | null }`

- [ ] **Step 1: boardView.ts를 구현한다**

`src/ui/hex/boardView.ts`:

```ts
// ui/hex/boardView.ts — 셀 맵을 화면에 반영한다.
// 상태를 갖지 않고 sync(cells)로 현재 맵과 화면을 맞춘다 — 델타 추적을 하지 않는다.
import { Container, type Texture } from "pixi.js";
import { key, parseKey } from "../../engine/hex/coords";
import type { Axial, Cell } from "../../engine/hex/types";
import { cellToScreen } from "./geom";
import { makeTileView, makeHorseshoeView } from "./tileArt";

export interface TileTextures {
  /** 티어 0~5의 텍스처. 미업로드 칸은 null → 색 육각 폴백 */
  tiles: Array<Texture | null>;
  horseshoe: Texture | null;
}

export interface BoardView {
  root: Container;
  /** 셀 맵과 화면을 맞춘다. 사라진 것은 지우고 새로 생긴 것은 만든다. */
  sync(cells: Map<string, Cell>): void;
  viewAt(a: Axial): Container | undefined;
  destroy(): void;
}

/** 셀 내용의 정체성. 이 값이 바뀌면 표시 객체를 새로 만든다. */
function signature(cell: Cell): string {
  switch (cell.kind) {
    case "tile": return `t${cell.tier}`;
    case "horseshoe": return "h";
    case "cage": return `c${cell.cageId}`;
  }
}

export function createBoardView(textures: TileTextures): BoardView {
  const root = new Container();
  const views = new Map<string, { view: Container; sig: string }>();

  function makeView(cell: Cell): Container | null {
    switch (cell.kind) {
      case "tile": return makeTileView(cell.tier, textures.tiles[cell.tier] ?? null);
      case "horseshoe": return makeHorseshoeView(textures.horseshoe);
      case "cage": return null; // 케이지는 cageView가 따로 그린다
    }
  }

  return {
    root,

    sync(cells: Map<string, Cell>): void {
      // 사라졌거나 내용이 바뀐 것을 걷어낸다
      for (const [k, entry] of [...views]) {
        const cell = cells.get(k);
        if (!cell || signature(cell) !== entry.sig) {
          entry.view.destroy();
          views.delete(k);
        }
      }
      // 새로 생긴 것을 만든다
      for (const [k, cell] of cells) {
        if (views.has(k)) continue;
        const view = makeView(cell);
        if (!view) continue;
        const p = cellToScreen(parseKey(k));
        view.x = p.x;
        view.y = p.y;
        root.addChild(view);
        views.set(k, { view, sig: signature(cell) });
      }
    },

    viewAt(a: Axial): Container | undefined {
      return views.get(key(a))?.view;
    },

    destroy(): void {
      for (const { view } of views.values()) view.destroy();
      views.clear();
      root.destroy({ children: true });
    },
  };
}
```

- [ ] **Step 2: 타입체크를 돌린다**

Run: `npm run typecheck`
Expected: 에러 0

- [ ] **Step 3: 커밋한다**

```bash
git add src/ui/hex/boardView.ts
git commit -m "feat(hex): 보드 렌더

sync(cells)로 셀 맵과 화면을 맞춘다. 델타를 추적하지 않고 시그니처
비교로 갱신해 상태 불일치 여지를 없앤다."
```

---

## Task 11: 케이지 렌더와 HUD (cageView.ts, hudView.ts)

**Files:**
- Create: `src/ui/hex/cageView.ts`
- Create: `src/ui/hex/hudView.ts`

**Interfaces:**
- Consumes: Task 9의 `cellToScreen` `HEX_SIZE`, Task 1의 `Cage` `RunState`
- Produces:
  - `interface CageView { root: Container; sync(state: RunState): void; playRescue(cage: Cage): Promise<void>; destroy(): void }`
  - `createCageView(textures: CageTextures): CageView`
  - `interface CageTextures { closed: Texture | null; open: Texture | null; animals: Record<string, Texture | null> }`
  - `interface HudView { root: Container; sync(state: RunState): void; destroy(): void }`
  - `createHudView(stageIndex: number): HudView`

- [ ] **Step 1: cageView.ts를 구현한다**

`src/ui/hex/cageView.ts`:

```ts
// ui/hex/cageView.ts — 케이지 렌더와 구출 연출.
// 케이지는 셀 맵에서 사라지는 것으로 "구출됨"을 표현하므로,
// 이 뷰는 stage.cages(고정 목록)와 state.rescued를 대조해 그린다.
import { Container, Graphics, Sprite, Text, type Texture } from "pixi.js";
import { cellToScreen, HEX_SIZE } from "./geom";
import type { Cage, RunState } from "../../engine/hex/types";

export interface CageTextures {
  closed: Texture | null;
  open: Texture | null;
  animals: Record<string, Texture | null>;
}

export interface CageView {
  root: Container;
  sync(state: RunState): void;
  playRescue(cage: Cage): Promise<void>;
  destroy(): void;
}

/** 케이지가 점유한 셀들의 중심점. 가로 2셀이면 두 셀의 중간이다. */
function cageCenter(cage: Cage): { x: number; y: number } {
  let sx = 0;
  let sy = 0;
  for (const c of cage.cells) {
    const p = cellToScreen(c);
    sx += p.x;
    sy += p.y;
  }
  return { x: sx / cage.cells.length, y: sy / cage.cells.length };
}

function makeCageBody(cage: Cage, tex: CageTextures): Container {
  const box = new Container();
  const w = Math.sqrt(3) * HEX_SIZE * cage.cells.length;
  const h = 2 * HEX_SIZE;

  if (tex.closed) {
    const s = new Sprite(tex.closed);
    s.anchor.set(0.5);
    s.width = w;
    s.height = h;
    box.addChild(s);
  } else {
    // 폴백 — 창살 느낌의 사각 프레임
    const g = new Graphics();
    g.roundRect(-w / 2, -h / 2, w, h, 6).fill({ color: 0x2b3440 });
    g.roundRect(-w / 2 + 3, -h / 2 + 3, w - 6, h - 6, 4).stroke({ width: 2, color: 0x8f9bab });
    for (let i = 1; i < 4; i++) {
      const x = -w / 2 + (w / 4) * i;
      g.moveTo(x, -h / 2 + 5).lineTo(x, h / 2 - 5).stroke({ width: 2, color: 0x8f9bab });
    }
    box.addChild(g);
  }

  const animalTex = tex.animals[cage.animalId] ?? null;
  if (animalTex) {
    const a = new Sprite(animalTex);
    a.anchor.set(0.5);
    a.width = w * 0.7;
    a.height = h * 0.7;
    box.addChild(a);
  } else {
    const label = new Text({
      text: cage.animalId,
      style: { fontSize: 11, fill: 0xffffff, fontWeight: "bold" },
    });
    label.anchor.set(0.5);
    box.addChild(label);
  }
  return box;
}

export function createCageView(textures: CageTextures): CageView {
  const root = new Container();
  const bodies = new Map<string, Container>();

  return {
    root,

    sync(state: RunState): void {
      for (const cage of state.stage.cages) {
        const rescued = state.rescued.includes(cage.animalId);
        const existing = bodies.get(cage.id);

        if (rescued) {
          if (existing) {
            existing.destroy();
            bodies.delete(cage.id);
          }
          continue;
        }
        if (existing) continue;

        const body = makeCageBody(cage, textures);
        const p = cageCenter(cage);
        body.x = p.x;
        body.y = p.y;
        root.addChild(body);
        bodies.set(cage.id, body);
      }
    },

    async playRescue(cage: Cage): Promise<void> {
      const body = bodies.get(cage.id);
      if (!body) return;
      // 짧게 튕겨 올라가며 사라진다 — 상세 연출은 fx.ts가 맡는다
      const start = performance.now();
      const from = body.y;
      await new Promise<void>((resolve) => {
        const tick = (): void => {
          const t = Math.min(1, (performance.now() - start) / 420);
          body.y = from - 40 * t;
          body.alpha = 1 - t;
          body.scale.set(1 + 0.25 * t);
          if (t < 1) requestAnimationFrame(tick);
          else resolve();
        };
        tick();
      });
    },

    destroy(): void {
      for (const b of bodies.values()) b.destroy();
      bodies.clear();
      root.destroy({ children: true });
    },
  };
}
```

- [ ] **Step 2: hudView.ts를 구현한다**

`src/ui/hex/hudView.ts`:

```ts
// ui/hex/hudView.ts — 상단 스테이지·목표 카운터, 우측 NEXT·부스터.
import { Container, Graphics, Text } from "pixi.js";
import { TIER_COLORS, drawTileFallback } from "./tileArt";
import type { RunState } from "../../engine/hex/types";

export interface HudView {
  root: Container;
  sync(state: RunState): void;
  destroy(): void;
}

function panel(w: number, h: number): Graphics {
  return new Graphics().roundRect(0, 0, w, h, 10).fill({ color: 0x4a3320, alpha: 0.9 });
}

export function createHudView(stageIndex: number): HudView {
  const root = new Container();

  // 상단 — 스테이지 번호 + 목표 카운터
  const top = panel(220, 40);
  top.x = 105;
  top.y = 28;
  root.addChild(top);

  const title = new Text({
    text: `STAGE ${stageIndex + 1}`,
    style: { fontSize: 17, fill: 0xffffff, fontWeight: "bold" },
  });
  title.anchor.set(0, 0.5);
  title.x = 120;
  title.y = 48;
  root.addChild(title);

  const counter = new Text({
    text: "0/0",
    style: { fontSize: 17, fill: 0xffd76a, fontWeight: "bold" },
  });
  counter.anchor.set(1, 0.5);
  counter.x = 310;
  counter.y = 48;
  root.addChild(counter);

  // 샷 잔량
  const shots = new Text({
    text: "",
    style: { fontSize: 14, fill: 0xffffff },
  });
  shots.anchor.set(0.5, 0);
  shots.x = 215;
  shots.y = 74;
  root.addChild(shots);

  // 우측 — NEXT 슬롯
  const nextPanel = panel(56, 68);
  nextPanel.x = 362;
  nextPanel.y = 300;
  root.addChild(nextPanel);

  const nextLabel = new Text({ text: "NEXT", style: { fontSize: 10, fill: 0xffffff } });
  nextLabel.anchor.set(0.5, 0);
  nextLabel.x = 390;
  nextLabel.y = 306;
  root.addChild(nextLabel);

  const nextSlot = new Container();
  nextSlot.x = 390;
  nextSlot.y = 342;
  root.addChild(nextSlot);

  // 우측 — 부스터 3종
  const boosterLabels: Array<{ id: "bomb" | "rainbow" | "horseshoe"; glyph: string }> = [
    { id: "bomb", glyph: "B" },
    { id: "rainbow", glyph: "R" },
    { id: "horseshoe", glyph: "U" },
  ];
  const boosterTexts = new Map<string, Text>();
  boosterLabels.forEach((b, i) => {
    const y = 400 + i * 56;
    const slot = new Graphics().circle(390, y, 22).fill({ color: 0x4a3320, alpha: 0.9 });
    root.addChild(slot);

    const glyph = new Text({ text: b.glyph, style: { fontSize: 16, fill: 0xffffff, fontWeight: "bold" } });
    glyph.anchor.set(0.5);
    glyph.x = 390;
    glyph.y = y;
    root.addChild(glyph);

    const count = new Text({ text: "0", style: { fontSize: 11, fill: 0xffffff, fontWeight: "bold" } });
    count.anchor.set(0.5);
    count.x = 406;
    count.y = y + 16;
    root.addChild(count);
    boosterTexts.set(b.id, count);
  });

  let lastNextTier = -1;

  return {
    root,

    sync(state: RunState): void {
      counter.text = `${state.rescued.length}/${state.stage.objective}`;
      shots.text = `남은 발사 ${state.shotsLeft}`;

      if (state.next !== lastNextTier) {
        nextSlot.removeChildren().forEach((c) => c.destroy());
        const chip = drawTileFallback(TIER_COLORS[state.next] ?? 0x888888);
        chip.scale.set(0.6);
        nextSlot.addChild(chip);
        lastNextTier = state.next;
      }

      for (const [id, text] of boosterTexts) {
        text.text = String(state.boosters[id as "bomb" | "rainbow" | "horseshoe"]);
      }
    },

    destroy(): void {
      root.destroy({ children: true });
    },
  };
}
```

- [ ] **Step 3: 타입체크를 돌린다**

Run: `npm run typecheck`
Expected: 에러 0

- [ ] **Step 4: 커밋한다**

```bash
git add src/ui/hex/cageView.ts src/ui/hex/hudView.ts
git commit -m "feat(hex): 케이지 렌더·구출 연출과 HUD

케이지는 stage.cages와 state.rescued 대조로 그린다. 아트 미도착 시
창살 폴백을 그려 개발을 막지 않는다."
```

---

## Task 12: 조준과 발사 (launcher.ts)

**Files:**
- Create: `src/ui/hex/launcher.ts`

**Interfaces:**
- Consumes: Task 5의 `simulateShot`, Task 9의 `BOARD` `ORIGIN` `launchOrigin` `launchOriginLocal` `cellToScreen`, Task 9의 `drawTileFallback` `TIER_COLORS`
- Produces:
  - `interface Launcher { root: Container; setLoaded(tier: Tier): void; aimAt(x: number, y: number, cells: Map<string, Cell>): void; clearAim(): void; angle(): number; playFlight(path: Array<{x,y}>, tier: Tier): Promise<void>; destroy(): void }`
  - `createLauncher(): Launcher`

- [ ] **Step 1: launcher.ts를 구현한다**

`src/ui/hex/launcher.ts`:

```ts
// ui/hex/launcher.ts — 조준선, 장전 표시, 발사 비행 연출.
// 입력 처리는 stageScreen이 맡고 여기는 그리기와 각도 계산만 한다.
import { Container, Graphics } from "pixi.js";
import { simulateShot } from "../../engine/hex/shot";
import type { Cell, Tier } from "../../engine/hex/types";
import { BOARD, ORIGIN, launchOrigin, launchOriginLocal } from "./geom";
import { TIER_COLORS, drawTileFallback } from "./tileArt";

/** 조준 각도 한계 — 수평 근처로 쏘면 판이 성립하지 않는다. */
const MAX_ANGLE = 1.25; // 약 72°

export interface Launcher {
  root: Container;
  setLoaded(tier: Tier): void;
  /** 포인터 위치로 조준하고 궤적 점선을 그린다. */
  aimAt(x: number, y: number, cells: Map<string, Cell>): void;
  clearAim(): void;
  angle(): number;
  playFlight(path: Array<{ x: number; y: number }>, tier: Tier): Promise<void>;
  destroy(): void;
}

export function createLauncher(): Launcher {
  const root = new Container();
  const guide = new Graphics();
  root.addChild(guide);

  const loadedSlot = new Container();
  const origin = launchOrigin();
  loadedSlot.x = origin.x;
  loadedSlot.y = origin.y;
  root.addChild(loadedSlot);

  const flight = new Container();
  root.addChild(flight);

  let currentAngle = 0;
  let loadedTier: Tier = 0;

  function redrawLoaded(): void {
    loadedSlot.removeChildren().forEach((c) => c.destroy());
    loadedSlot.addChild(drawTileFallback(TIER_COLORS[loadedTier] ?? 0x888888));
  }
  redrawLoaded();

  return {
    root,

    setLoaded(tier: Tier): void {
      loadedTier = tier;
      redrawLoaded();
    },

    aimAt(x: number, y: number, cells: Map<string, Cell>): void {
      const dx = x - origin.x;
      const dy = y - origin.y;
      // 위쪽으로만 쏜다 — 아래를 가리키면 수평 한계로 잘라낸다
      const raw = Math.atan2(dx, -dy);
      currentAngle = Math.max(-MAX_ANGLE, Math.min(MAX_ANGLE, raw));

      const { path } = simulateShot(cells, BOARD, launchOriginLocal(), currentAngle);
      guide.clear();
      // 점선 — 4스텝마다 한 점씩 찍는다
      for (let i = 0; i < path.length; i += 4) {
        const p = path[i]!;
        guide.circle(ORIGIN.x + p.x, ORIGIN.y + p.y, 3).fill({ color: 0xffffff, alpha: 0.55 });
      }
    },

    clearAim(): void {
      guide.clear();
    },

    angle(): number {
      return currentAngle;
    },

    async playFlight(path: Array<{ x: number; y: number }>, tier: Tier): Promise<void> {
      const chip = drawTileFallback(TIER_COLORS[tier] ?? 0x888888);
      flight.addChild(chip);

      const durationMs = Math.min(420, 60 + path.length * 1.2);
      const start = performance.now();

      await new Promise<void>((resolve) => {
        const tick = (): void => {
          const t = Math.min(1, (performance.now() - start) / durationMs);
          const p = path[Math.min(path.length - 1, Math.floor(t * (path.length - 1)))]!;
          chip.x = ORIGIN.x + p.x;
          chip.y = ORIGIN.y + p.y;
          if (t < 1) requestAnimationFrame(tick);
          else resolve();
        };
        tick();
      });

      chip.destroy();
    },

    destroy(): void {
      root.destroy({ children: true });
    },
  };
}
```

- [ ] **Step 2: 타입체크를 돌린다**

Run: `npm run typecheck`
Expected: 에러 0

- [ ] **Step 3: 커밋한다**

```bash
git add src/ui/hex/launcher.ts
git commit -m "feat(hex): 조준선·장전 표시·발사 비행

조준 각도를 ±72°로 자른다. 궤적 가이드는 엔진의 simulateShot 결과를
그대로 점선으로 찍어 조준선과 실제 탄도가 어긋나지 않게 한다."
```

---

## Task 13: 스테이지 화면 조립 (stageScreen.ts)

**Files:**
- Create: `src/ui/hex/stageScreen.ts`

**Interfaces:**
- Consumes: Task 6의 `createRun` `fireAt` `isCleared` `isFailed`, Task 10~12의 뷰들, Task 9의 `BOARD` `launchOriginLocal`
- Produces:
  - `type StageResult = "cleared" | "failed" | "quit"`
  - `runStageScreen(app: Application, stage: StageDef, stageIndex: number, textures: StageTextures): Promise<StageResult>`
  - `interface StageTextures { tiles: Array<Texture | null>; horseshoe: Texture | null; cageClosed: Texture | null; cageOpen: Texture | null; animals: Record<string, Texture | null> }`

- [ ] **Step 1: stageScreen.ts를 구현한다**

`src/ui/hex/stageScreen.ts`:

```ts
// ui/hex/stageScreen.ts — 한 스테이지의 화면. 입력 → 엔진 → 렌더를 배선한다.
// 상태는 RunState 하나로 모으고 모듈 전역에 두지 않는다(규약 4조).
import { Application, Container, Graphics, type Texture } from "pixi.js";
import { createRun, fireAt, isCleared, isFailed } from "../../engine/hex/stageRun";
import type { RunState, StageDef } from "../../engine/hex/types";
import { fullRect } from "../stage";
import { BOARD, ORIGIN, launchOriginLocal } from "./geom";
import { createBoardView } from "./boardView";
import { createCageView } from "./cageView";
import { createHudView } from "./hudView";
import { createLauncher } from "./launcher";

export type StageResult = "cleared" | "failed" | "quit";

export interface StageTextures {
  tiles: Array<Texture | null>;
  horseshoe: Texture | null;
  cageClosed: Texture | null;
  cageOpen: Texture | null;
  animals: Record<string, Texture | null>;
}

export async function runStageScreen(
  app: Application,
  stage: StageDef,
  stageIndex: number,
  textures: StageTextures,
): Promise<StageResult> {
  const state: RunState = createRun(stage);

  const layer = new Container();
  layer.addChild(fullRect(0x241a10));

  const board = createBoardView({ tiles: textures.tiles, horseshoe: textures.horseshoe });
  const cages = createCageView({
    closed: textures.cageClosed,
    open: textures.cageOpen,
    animals: textures.animals,
  });
  const hud = createHudView(stageIndex);
  const launcher = createLauncher();

  layer.addChild(cages.root, board.root, launcher.root, hud.root);
  app.stage.addChild(layer);

  function redraw(): void {
    board.sync(state.cells);
    cages.sync(state);
    hud.sync(state);
    launcher.setLoaded(state.loaded);
  }
  redraw();

  // 입력 — 화면 전체를 히트 영역으로 잡는다
  const input = new Graphics().rect(0, 0, 430, 800).fill({ color: 0x000000, alpha: 0 });
  input.eventMode = "static";
  layer.addChild(input);

  let busy = false;

  return await new Promise<StageResult>((resolve) => {
    let finished = false;

    function finish(result: StageResult): void {
      if (finished) return;
      finished = true;
      input.off("pointermove", onMove);
      input.off("pointerup", onUp);
      input.off("pointerupoutside", onUp);
      launcher.destroy();
      hud.destroy();
      cages.destroy();
      board.destroy();
      layer.destroy({ children: true });
      resolve(result);
    }

    function onMove(e: { global: { x: number; y: number } }): void {
      if (busy) return;
      launcher.aimAt(e.global.x, e.global.y, state.cells);
    }

    async function onUp(e: { global: { x: number; y: number } }): Promise<void> {
      if (busy || finished) return;
      launcher.aimAt(e.global.x, e.global.y, state.cells);
      const angle = launcher.angle();
      launcher.clearAim();

      busy = true;
      try {
        // 비행 경로를 먼저 얻어 연출하고, 그 뒤 상태를 확정한다
        const firedTier = state.loaded;
        const { simulateShot } = await import("../../engine/hex/shot");
        const { path } = simulateShot(state.cells, BOARD, launchOriginLocal(), angle);
        await launcher.playFlight(path, firedTier);

        const outcome = fireAt(state, BOARD, launchOriginLocal(), angle);
        redraw();

        for (const cage of outcome.rescued) {
          await cages.playRescue(cage);
        }
        redraw();

        if (isCleared(state)) {
          finish("cleared");
          return;
        }
        if (isFailed(state)) {
          finish("failed");
          return;
        }
      } finally {
        busy = false;
      }
    }

    input.on("pointermove", onMove);
    input.on("pointerup", (e) => void onUp(e));
    input.on("pointerupoutside", (e) => void onUp(e));
  });
}
```

- [ ] **Step 2: 타입체크를 돌린다**

Run: `npm run typecheck`
Expected: 에러 0. `fullRect` import 경로가 `../stage`인지 확인한다.

- [ ] **Step 3: 커밋한다**

```bash
git add src/ui/hex/stageScreen.ts
git commit -m "feat(hex): 스테이지 화면 조립

입력 → 엔진 → 렌더를 배선하고 RunState 하나로 상태를 모은다.
발사 중에는 busy로 입력을 막아 연출과 상태가 어긋나지 않게 한다."
```

---

---

## Task 14: 부트 플로우 교체 (main.ts)

**Files:**
- Modify: `src/main.ts` — 게임 루프를 스테이지 루프로 교체

**Interfaces:**
- Consumes: Task 8의 `stages`, Task 13의 `runStageScreen`
- Produces: 실행 가능한 게임. `npm run dev`로 브라우저에서 플레이된다

- [ ] **Step 1: main.ts의 게임 루프를 교체한다**

`src/main.ts`에서 아래 블록을 찾는다:

```ts
  // ④ 로비 ⇄ 게임 루프: 스토리 중 '← 로비'로 나오면 로비로, 재진입 시 런 이어짐
  mark("lobby");
  let lobbyResult = await showLobby(app, assets);
  for (;;) {
    mark("game");
    await startApp(app, assets, lobbyResult === "practice");
    mark("lobby");
    lobbyResult = await showLobby(app, assets);
  }
```

다음으로 바꾼다:

```ts
  // ④ 스테이지 연속 플레이 — 클리어하면 다음 스테이지, 실패하면 같은 스테이지 재도전
  mark("game");
  let stageIndex = 0;
  for (;;) {
    const stage = stages[stageIndex];
    if (!stage) {
      stageIndex = 0; // 마지막 스테이지를 넘으면 처음으로 되돌린다
      continue;
    }
    const result = await runStageScreen(app, stage, stageIndex, {
      tiles: [null, null, null, null, null, null],
      horseshoe: null,
      cageClosed: null,
      cageOpen: null,
      animals: {},
    });
    if (result === "cleared") stageIndex += 1;
  }
```

- [ ] **Step 2: import를 정리한다**

`src/main.ts` 상단의 import에서 `startApp`과 `showLobby`를 쓰지 않게 됐다.
**구 화면 코드는 삭제하지 않고 import만 끊는다**(병렬 신규 라인 — 설계문서 §3).

아래 두 줄을 지운다:

```ts
import { startApp, initGameCheats } from "./ui/app";
import { playPrologue, showLoading, showTitle, showLobby } from "./ui/boot";
```

아래로 바꿔 넣는다:

```ts
import { playPrologue, showLoading, showTitle } from "./ui/boot";
import { stages } from "./data/stages";
import { runStageScreen } from "./ui/hex/stageScreen";
```

`initGameCheats()` 호출 줄도 지운다 (구 게임 전용 치트다):

```ts
  initGameCheats(); // 게임 치트(관문 숏컷 포함) — 로비 치트 목록에도 항상 표시 (게임 밖에선 안내)
```

- [ ] **Step 3: 타입체크를 돌린다**

Run: `npm run typecheck`
Expected: 에러 0. `beats` / `initBeatsPreview`가 미사용이라 에러가 나면 그 두 줄도 지운다.

- [ ] **Step 4: 빌드와 전체 테스트를 돌린다**

Run: `npm run build && npx vitest run`
Expected: 빌드 성공 · 기존 150개 + 신규 테스트 전부 통과

- [ ] **Step 5: 브라우저에서 실제로 플레이해 확인한다**

Run: `npm run dev`

`http://localhost:5173`을 열고 다음을 눈으로 확인한다:

1. 프롤로그 → 로딩 → 타이틀을 지나 **색 육각이 깔린 판**이 뜬다
2. 화면을 드래그하면 **흰 점선 조준선**이 벽에 튕기며 그려진다
3. 손을 떼면 빨간 육각이 날아가 **판에 붙는다**
4. 같은 색 3개를 만들면 **한 단계 위 색 1개로 합쳐진다**
5. 케이지 주변을 다 걷어내면 **케이지가 튀어 오르며 사라지고** 상단 카운터가 오른다
6. 목표를 채우면 **다음 스테이지로 넘어간다**

안 되는 항목이 있으면 그 기능의 엔진 테스트부터 다시 확인한다 — 엔진이 통과하는데 화면이 틀리면 배선(`stageScreen.ts`) 문제다.

- [ ] **Step 6: 커밋한다**

```bash
git add src/main.ts
git commit -m "feat(hex): 부트 플로우를 스테이지 루프로 교체

프롤로그·로딩·타이틀은 그대로 재사용하고 게임 루프만 갈아끼운다.
구 화면 코드는 삭제하지 않고 import만 끊는다 — 트리셰이킹으로
번들에서 빠지고, 삭제는 동결 직전 여유가 있을 때 한다."
```

---

## Task 15: 아트 슬롯 연결

**Files:**
- Modify: `src/data/assets.json` — 헥사 타일·케이지·동물 슬롯 추가
- Modify: `src/ui/assets.ts` — 슬롯 로드
- Modify: `src/main.ts` — 로드한 텍스처를 `runStageScreen`에 넘김

**Interfaces:**
- Consumes: 기존 `loadGameAssets` 파이프라인
- Produces: `GameAssets`에 `hex: StageTextures` 추가. 파일이 없으면 `null`이라 색 육각 폴백이 그대로 산다

- [ ] **Step 1: 매니페스트에 슬롯을 추가한다**

`src/data/assets.json`을 열어 최상위에 아래 키를 추가한다 (기존 키는 건드리지 않는다):

```json
  "hex": {
    "tiles": [
      "hex/tile-red.png",
      "hex/tile-yellow.png",
      "hex/tile-green.png",
      "hex/tile-blue.png",
      "hex/tile-purple.png",
      "hex/tile-gold.png"
    ],
    "horseshoe": "hex/tile-horseshoe.png",
    "cageClosed": "hex/cage-closed.png",
    "cageOpen": "hex/cage-open.png",
    "animals": {
      "sheep": "hex/animal-sheep.png",
      "zebra": "hex/animal-zebra.png",
      "deer": "hex/animal-deer.png"
    }
  }
```

- [ ] **Step 2: assets.ts에 로더를 추가한다**

`src/ui/assets.ts`의 `Manifest` 인터페이스에 필드를 더한다:

```ts
interface HexSlots {
  tiles?: string[];
  horseshoe?: string;
  cageClosed?: string;
  cageOpen?: string;
  animals?: Record<string, string>;
}
```

`interface Manifest`에 한 줄 추가:

```ts
  hex?: HexSlots;
```

그리고 파일 끝에 로더를 추가한다 (`tryLoad`는 이 파일 안에 이미 있다):

```ts
/** 헥사 머지 슈터 에셋. 미업로드 슬롯은 null → 호출측이 색 육각으로 폴백한다. */
export async function loadHexAssets(): Promise<{
  tiles: Array<Texture | null>;
  horseshoe: Texture | null;
  cageClosed: Texture | null;
  cageOpen: Texture | null;
  animals: Record<string, Texture | null>;
}> {
  const hex = manifest.hex ?? {};
  const tileFiles = hex.tiles ?? [];
  const tiles = await Promise.all(
    Array.from({ length: 6 }, (_, i) => tryLoad(tileFiles[i])),
  );
  const animalEntries = Object.entries(hex.animals ?? {});
  const animalTextures = await Promise.all(animalEntries.map(([, f]) => tryLoad(f)));
  const animals: Record<string, Texture | null> = {};
  animalEntries.forEach(([id], i) => {
    animals[id] = animalTextures[i] ?? null;
  });

  return {
    tiles,
    horseshoe: await tryLoad(hex.horseshoe),
    cageClosed: await tryLoad(hex.cageClosed),
    cageOpen: await tryLoad(hex.cageOpen),
    animals,
  };
}
```

- [ ] **Step 3: main.ts에서 로드해 넘긴다**

`src/main.ts`의 import에 추가:

```ts
import { loadGameAssets, loadLoadingBg, loadPrologueBg, loadHexAssets } from "./ui/assets";
```

스테이지 루프 직전에 한 번 로드한다:

```ts
  const hexTextures = await loadHexAssets();
```

`runStageScreen` 호출의 인라인 null 객체를 이것으로 바꾼다:

```ts
    const result = await runStageScreen(app, stage, stageIndex, hexTextures);
```

- [ ] **Step 4: 빌드와 테스트**

Run: `npm run build && npx vitest run`
Expected: 전부 통과. 아트 파일이 없어도 `tryLoad`가 null을 돌려주므로 색 육각 폴백으로 정상 동작한다.

- [ ] **Step 5: 브라우저에서 확인한다**

Run: `npm run dev`

아트 파일이 없는 상태에서도 **Task 14와 동일하게 플레이되는지** 확인한다.
`public/assets/hex/tile-red.png`를 하나 넣고 새로고침해 **그 타일만 아트로 바뀌는지** 확인한다.

- [ ] **Step 6: 커밋한다**

```bash
git add src/data/assets.json src/ui/assets.ts src/main.ts
git commit -m "feat(hex): 아트 슬롯 연결

디자이너가 public/assets/hex/에 파일을 드롭하면 반영된다. 미업로드
슬롯은 null이라 색 육각 폴백이 그대로 살고, 부분 도착도 정상 동작한다."
```

---

---

## Self-Review

**1. 스펙 커버리지**

| 스펙 항목 | 태스크 |
|---|---|
| §5-1 엔진 모듈 8개 | Task 1~8 (`types` `coords` `grid` `merge` `gravity` `shot` `stageRun` `boosters` `stageLoader`) |
| §5-2 UI 모듈 | Task 9~13 (`geom` `tileArt` `boardView` `cageView` `hudView` `launcher` `stageScreen`) |
| §6 좌표계 수치 | Task 1(변환) · Task 9(배치, 좌우 대칭 여백 테스트) |
| §7 데이터 스키마 | Task 1(타입) · Task 8(검증 로더) |
| §8-1 스냅 | Task 5 |
| §8-2 합체·연쇄·폭발 | Task 3 |
| §8-3 낙하 | Task 4 |
| §8-4 구출 판정 | Task 6 |
| §9 상태 관리 | Task 6(`RunState`) · Task 13(전역 `let` 없이 배선) |
| §10 테스트 전략 | Task 1~9의 테스트 파일 |
| §3 병렬 신규 라인 | Task 14(구 코드 삭제 없이 import만 끊음) |
| §4-1 재사용 | Task 13(`fullRect`) · Task 14(프롤로그·로딩·타이틀) · Task 15(`assets.ts` 파이프라인) |
| §11 리스크 3(아트 대기) | Task 9(`drawTileFallback`) · Task 15(부분 도착 허용) |

**미포함 — 의도적으로 이 플랜의 범위 밖:**

- **메타 레이어** (로비 목장 · 도감 · 레벨 · 스테이지 셀렉트) — 코어가 서고 난 뒤 별도 플랜으로 다룬다. 토 13:00 게이트는 코어로 판정한다
- **부스터 UI 배선** — 엔진(Task 7)과 HUD 표시(Task 11)는 있으나 탭해서 발동하는 입력은 없다. 코어 플레이가 선다음 얹는다
- **`fx.ts`** — 합체·폭발·낙하 파티클. 연출은 코어가 돈 뒤 붙인다
- **스펙 §11 리스크 2(케이지 1셀 → 2셀 단계 확장)** — 엔진이 처음부터 멀티셀을 다루므로(`cageNeighbors`가 셀 개수에 무관) 단계를 나눌 필요가 없어졌다. 스테이지 JSON에서 `cells` 길이를 1로 두면 그대로 1셀 케이지가 된다

**2. 플레이스홀더 스캔** — TBD·TODO·"적절히 처리" 없음. 모든 코드 스텝에 실제 코드가 있다.

**3. 타입 일관성 확인**

- `Tier` — Task 1 정의, 전 태스크에서 동일하게 사용
- `key(a: Axial): string` — Task 1 정의, Task 2~8에서 사용
- `MergeStep` — Task 3 정의, Task 6의 `ShotOutcome.steps`가 참조
- `BoardGeom` — Task 5 정의, Task 6 `fireAt`·Task 9 `BOARD`·Task 12·13이 참조
- `RunState` — Task 1 정의, Task 6이 생성, Task 11·13이 읽음
- `cageNeighbors(cage: Cage)` — Task 2 정의, Task 6 `pendingRescues`가 사용
- `simulateShot(cells, geom, from, angleRad)` — Task 5 정의, Task 6·12·13이 동일 시그니처로 호출
- `StageTextures` — Task 13 정의, Task 14가 인라인 null로, Task 15가 `loadHexAssets()` 결과로 만족. 필드명 `tiles` `horseshoe` `cageClosed` `cageOpen` `animals` 일치 확인
- `TileTextures`(Task 10)는 `StageTextures`의 부분집합 — Task 13에서 `{ tiles, horseshoe }`만 뽑아 넘긴다

---

## 실행 순서 권장

**금요일 밤 (T+3h ~ T+11h):** Task 1~8 — 엔진 전체. 여기까지가 헤드리스로 검증되면 토요일이 편하다. **Task 5(궤적·스냅)가 리스크 1위**이므로 막히면 다른 태스크로 도망가지 말고 여기서 붙든다.

**토요일 오전 (~T+21h):** Task 9~13 — 화면. **Task 14까지 끝나면 토 13:00 게이트("플레이 가능")를 통과한다.**

**토요일 오후:** Task 15(아트 연결) + 별도 플랜(메타 레이어 · 부스터 입력 · `fx.ts`).
