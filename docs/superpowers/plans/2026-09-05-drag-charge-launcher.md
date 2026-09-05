# 당겨 쏘는 발사대 — 구현 플랜

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** 탭 조준을 새총 드래그로 바꾸고, 발사체에 속도와 중력을 넣어 파워가 사거리가 되게 한다.

**Architecture:** `engine/hex/shot.ts`가 직선 대신 포물선을 적분한다(Pixi 없음, 헤드리스 테스트). 새 `ui/hex/dragAim.ts`가 포인터 좌표에서 각도·파워만 뽑아 주고, `launcher.ts`가 그걸 받아 붉은말 시퀀스를 스크럽하고 곡선 궤적을 그린다. `stageScreen.ts`는 이벤트를 넘기는 역할만 남는다.

**Tech Stack:** TypeScript(strict) · Pixi v8 · Vitest · Vite

**Spec:** `docs/superpowers/specs/2026-09-05-drag-charge-launcher-design.md`

## Global Constraints

- **기준선**: `1dd9e60`. 동물 6종(`rabbit·monkey·deer·sheep·zebra·elephant`), 펭귄 없음.
- **의존 방향**: `data → engine → ui`. `engine/`은 Pixi를 import하지 않는다(규약 5조).
- **규약 1조**: 렌더 함수는 200줄에서 자른다. `launcher.ts`는 250줄을 넘기지 않는다.
- **규약 3조**: 새 JSON은 `as unknown as`로 받지 않는다. `horseHold`는 검증 함수를 통과시킨다.
- **규약 4조**: 화면 전환 상태를 모듈 전역 `let`으로 두지 않는다. `dragAim`은 팩토리 클로저에 담는다.
- **각도 규약**: `0` = 똑바로 위, 양수 = 오른쪽 기울기(라디안). 기존 코드와 동일.
- **스테이지 밸런싱은 이 브랜치에서 하지 않는다.** 수치 조정이 필요해 보이면 적어만 두고 넘어간다.
- 전체 검증: `npm test -- --run` (기준 178개 통과) · `npm run build`.

---

## 파일 구조

| 파일 | 책임 | Task |
|---|---|---|
| `src/engine/hex/shot.ts` | 포물선 적분 · 벽 반사 · 스냅 · 헛발 판정 | 1 |
| `src/engine/hex/stageRun.ts` | 헛발도 한 발 소모 | 2 |
| `src/ui/hex/dragAim.ts` [신규] | 포인터 좌표 → `{angle, power}`. 그리지 않는다 | 3 |
| `src/data/hexAssets.ts` · `src/data/uiLayout.ts` | `horseHold` 검증 · `hold` 필드 보존 | 4 |
| `src/ui/hex/powerGauge.ts` [신규] | 직각삼각형 게이지 | 5 |
| `src/ui/hex/launcher.ts` | 말 스크럽·회전 · 곡선 궤적 · 토스 | 6 |
| `src/ui/hex/stageScreen.ts` | 배선만 | 7 |
| `src/tools/uiEditor.ts` · `vite.config.ts` | 프레임 스크러버 · `/__assets` POST | 8 |

Task 1~4는 서로 독립이다. 5·6은 4에 기대고, 7은 3·5·6에, 8은 4에 기댄다.

---

### Task 1: 포물선 물리 (`shot.ts`)

**Files:**
- Modify: `src/engine/hex/shot.ts`
- Test: `tests/hex/shot.test.ts`

**Interfaces:**
- Consumes: 없음 (기존 `coords.ts`의 `key`/`toPixel`/`fromPixel`/`inBounds`만 그대로 쓴다)
- Produces:
  - `ShotResult { snap: Axial | null; path: Array<{x,y}>; missed: boolean }`
  - `simulateShot(cells, geom, from, angleRad, power?: number): ShotResult` — `power`는 0~1, 기본 `1`

- [ ] **Step 1: 실패하는 테스트를 쓴다**

`tests/hex/shot.test.ts` 맨 아래에 붙인다. 기존 `GEOM`·`makeCells`·`launchPoint`·
`boardBounds`를 그대로 쓴다(넷 다 그 파일에 이미 있다).

```ts
describe("simulateShot — 포물선", () => {
  it("최소 파워로도 똑바로 쏘면 천장에 닿는다", () => {
    // §7 도달 보장 — 어떤 판이 와도 물리적으로 못 닿는 칸이 없어야 한다
    const res = simulateShot(makeCells([]), GEOM, launchPoint(), 0, 0);
    expect(res.missed).toBe(false);
    expect(res.snap).not.toBeNull();
    expect(res.snap!.r).toBe(0);
  });

  it("파워가 클수록 궤적이 멀리 간다", () => {
    // 같은 각도로 쏜 두 발의 경로 길이를 잰다. 각도를 눕혀야 사거리 차가 드러난다.
    const reach = (power: number): number => {
      const { path } = simulateShot(makeCells([]), GEOM, launchPoint(), 1.0, power);
      let d = 0;
      for (let i = 1; i < path.length; i += 1) {
        d += Math.hypot(path[i]!.x - path[i - 1]!.x, path[i]!.y - path[i - 1]!.y);
      }
      return d;
    };
    expect(reach(1)).toBeGreaterThan(reach(0.5));
    expect(reach(0.5)).toBeGreaterThan(reach(0));
  });

  it("좌우 대칭이다 — 판 한가운데서 반대 각도로 쏘면 경로 길이가 같다", () => {
    // launchPoint()는 판 한가운데가 아니다(중앙에서 오른쪽으로 약 39px).
    // 대칭을 재려면 좌우 벽에서 등거리인 지점에서 쏴야 한다.
    const { minX, maxX } = boardBounds(GEOM);
    const mid = { x: (minX + maxX) / 2, y: launchPoint().y };
    const len = (angle: number): number => {
      const { path } = simulateShot(makeCells([]), GEOM, mid, angle, 0.5);
      let d = 0;
      for (let i = 1; i < path.length; i += 1) {
        d += Math.hypot(path[i]!.x - path[i - 1]!.x, path[i]!.y - path[i - 1]!.y);
      }
      return d;
    };
    expect(len(0.7)).toBeCloseTo(len(-0.7), 3);
  });

  it("궤적이 곧지 않다 — 중력이 실제로 작용한다", () => {
    // 비스듬히 쏜 경로의 세로 속도가 도중에 방향을 바꾸거나 최소한 느려진다.
    const { path } = simulateShot(makeCells([]), GEOM, launchPoint(), 1.2, 0);
    const dy = (i: number): number => path[i + 1]!.y - path[i]!.y;
    const first = dy(0);
    const last = dy(path.length - 2);
    expect(last).toBeGreaterThan(first); // 위로 가던 속도(-)가 줄거나 아래로(+) 돌아선다
  });
});
```

- [ ] **Step 2: 실패를 확인한다**

Run: `npx vitest run tests/hex/shot.test.ts`
Expected: FAIL — `simulateShot`이 5번째 인자를 받지 않아 `power`가 무시되고
「파워가 클수록 멀리 간다」가 깨진다. 「곧지 않다」도 깨진다(지금은 직선).

- [ ] **Step 3: 구현한다**

`src/engine/hex/shot.ts`를 통째로 바꾼다. 파일 머리의 주석과 `boardBounds`는 그대로 둔다.

```ts
export interface ShotResult {
  /** 붙을 셀. 어디에도 붙일 수 없으면 null */
  snap: Axial | null;
  /** 연출용 궤적 점 목록 */
  path: Array<{ x: number; y: number }>;
  /** 판에 닿지 못하고 다시 아래로 떨어졌다 — 헛발 */
  missed: boolean;
}

/** 중력 가속도(px/s²). **절대값 자체엔 의미가 없다** — 아래 RISE 계수와의 비만
 *  궤적 모양을 정한다. 속도를 「올라갈 높이」에서 역산하기 때문이다. */
const G = 2400;

/** 파워 0에서 올라갈 높이(발사 지점→천장 높이의 배수).
 *  1.0이면 천장에 딱 닿는다 — 여유를 둬 반드시 넘기게 한다.
 *  이 값이 §7의 「도달 보장」이다. 낮추면 약한 발이 판에 못 닿기 시작한다. */
const MIN_RISE = 1.15;

/** 파워 1에서 올라갈 높이. 좌우 벽을 두어 번 튀고도 천장까지 가는 값. */
const MAX_RISE = 3.2;

/** 한 스텝의 이동 거리 상한(육각 반지름의 몫). 얇은 관통을 막는다. */
const STEP_DIV = 5;

/** 방어적 백스톱. 정상 궤적은 2천 스텝 안에 끝난다. */
const MAX_STEPS = 20000;

const clamp01 = (v: number): number => (v < 0 ? 0 : v > 1 ? 1 : v);

/** 파워 → 초속. 「얼마나 높이 올라갈 것인가」에서 v² = 2gh로 역산한다.
 *  판 크기가 달라져도 같은 파워가 같은 비율만큼 날아간다 — 테스트 지오메트리와
 *  실제 판의 크기가 달라도 규칙이 흔들리지 않는다. */
export function launchSpeed(from: { y: number }, geom: BoardGeom, power: number): number {
  // 발사 지점에서 천장(y ≈ 0) 위 반 칸까지의 높이. 발사대는 판 아래에 있다.
  const climb = Math.max(geom.size, from.y + geom.size);
  const rise = climb * (MIN_RISE + (MAX_RISE - MIN_RISE) * clamp01(power));
  return Math.sqrt(2 * G * rise);
}

export function simulateShot(
  cells: Map<string, Cell>,
  geom: BoardGeom,
  from: { x: number; y: number },
  angleRad: number,
  power = 1,
): ShotResult {
  const { minX, maxX } = boardBounds(geom);
  const v0 = launchSpeed(from, geom, power);
  // 스텝 간격은 초속에서 역산한다. 발사 뒤 속도는 v0를 넘지 않는다 —
  // 올라갔다 내려와 발사 높이로 돌아오는 순간 헛발로 끊기 때문이다.
  const dt = geom.size / STEP_DIV / v0;

  let vx = Math.sin(angleRad) * v0;
  let vy = -Math.cos(angleRad) * v0; // 화면 y는 아래로 증가하므로 위로 가려면 음수
  let x = from.x;
  let y = from.y;

  const path: Array<{ x: number; y: number }> = [{ x, y }];
  let lastEmpty: Axial | null = null;
  let missed = false;

  // 시작 칸이 이미 비어 있다면 후보로 삼는다
  const startCell = fromPixel({ x, y }, geom.size);
  if (inBounds(startCell, geom.cols, geom.rows) && !cells.has(key(startCell))) {
    lastEmpty = startCell;
  }

  for (let i = 0; i < MAX_STEPS; i++) {
    vy += G * dt;
    x += vx * dt;
    y += vy * dt;

    // 좌우 벽 반사 — 입사각 = 반사각. 에너지는 잃지 않는다(예측선이 정직해야 한다)
    if (x < minX) {
      x = minX + (minX - x);
      vx = -vx;
    } else if (x > maxX) {
      x = maxX - (x - maxX);
      vx = -vx;
    }
    path.push({ x, y });

    // 다시 발사 높이 아래로 떨어졌다 — 판에 닿지 못했다
    if (vy > 0 && y > from.y) {
      missed = true;
      break;
    }

    const a = fromPixel({ x, y }, geom.size);

    // 천장을 넘었다 — 더 갈 곳이 없다
    if (a.r < 0) break;

    // 보드 밖(아래·좌우)은 "아직 판에 들어오지 않은 상태"다. 발사체는 판 아래에서
    // 출발하므로 여기서 멈추면 첫 스텝에 끝나버린다 — 계속 전진시킨다.
    if (!inBounds(a, geom.cols, geom.rows)) continue;

    if (cells.has(key(a))) break; // 타일이든 케이지든 여기서 멈춘다

    lastEmpty = a;
  }

  // 헛발은 지나온 빈 칸이 있어도 붙지 않는다 — 떨어진 타일이 공중에 남을 수 없다
  return { snap: missed ? null : lastEmpty, path, missed };
}
```

`ShotResult`의 `missed`가 늘었으므로 파일 상단 import는 그대로 두고, `SQRT3`
상수와 `boardBounds`는 손대지 않는다.

- [ ] **Step 4: 통과를 확인한다**

Run: `npx vitest run tests/hex/shot.test.ts`
Expected: PASS — 신규 4건과 기존 11건 모두.

기존 「반사한 궤적에도 스냅 지점이 있다」(각도 -1.1, 파워 기본 1)가 깨질 수 있다.
깨지면 **테스트를 고치지 말고** `MAX_RISE`를 0.2씩 올려 다시 돌린다 —
큰 뱅크 샷이 살아 있어야 한다는 것이 그 테스트의 뜻이다. 4.0까지 올려도 안
되면 각도가 아니라 `STEP_DIV`가 원인이니(관통) 6으로 올린다.

- [ ] **Step 5: 전체 테스트를 돌린다**

Run: `npm test -- --run`
Expected: PASS (178 + 4 = 182개). `stageRun.test.ts`는 `power` 기본값 1로 도므로 영향받지 않는다.

- [ ] **Step 6: 커밋**

```bash
git add src/engine/hex/shot.ts tests/hex/shot.test.ts
git commit -m "feat: 발사체에 속도와 중력 — 파워가 사거리가 된다"
```

---

### Task 2: 헛발도 한 발 (`stageRun.ts`)

**Files:**
- Modify: `src/engine/hex/stageRun.ts:62-108`
- Test: `tests/hex/stageRun.test.ts`

**Interfaces:**
- Consumes: Task 1의 `simulateShot(..., power)` · `ShotResult.missed`
- Produces:
  - `ShotOutcome { snapped; steps; dropped; rescued; missed: boolean }`
  - `fireAt(state, geom, from, angleRad, power?: number, rng?: () => number): ShotOutcome`
    — `power` 기본 `1`, `rng`가 **5번째에서 6번째로 밀린다**(현재 `rng`를 넘기는 호출부는 없다)

- [ ] **Step 1: 실패하는 테스트를 쓴다**

`tests/hex/stageRun.test.ts` 맨 아래에 붙인다. 기존 `GEOM`·`from`·런 생성 헬퍼를
그 파일에서 쓰는 방식 그대로 쓴다(파일 상단을 먼저 읽을 것).

```ts
describe("fireAt — 헛발", () => {
  // 이 파일의 기존 fireAt 블록과 같은 발사 지점이다
  const from = toPixel({ q: -2, r: 12 }, GEOM.size);

  it("판에 못 닿아도 한 발을 깎는다", () => {
    const run = createRun(stage({ shots: 3 }));
    // 거의 수평으로 아주 약하게 — 판에 닿지 못하고 떨어진다
    const out = fireAt(run, GEOM, from, 1.2, 0);
    expect(out.missed).toBe(true);
    expect(out.snapped).toBeNull();
    expect(run.shotsLeft).toBe(2);
  });

  it("헛발도 장전을 넘긴다 — 같은 타일이 손에 남지 않는다", () => {
    const run = createRun(stage({ shots: 3 }));
    // 빈 판에서는 pickNext가 늘 0이라 「넘어갔는지」를 0끼리 비교하게 된다.
    // 손에 든 것과 다음 것을 **다른 값으로 벌려 놓고** 확인한다.
    run.loaded = 0;
    run.next = 3;
    fireAt(run, GEOM, from, 1.2, 0);
    expect(run.loaded).toBe(3);
  });

  it("발사 수가 0이면 헛발도 나지 않는다", () => {
    const run = createRun(stage({ shots: 3 }));
    run.shotsLeft = 0;
    const out = fireAt(run, GEOM, from, 1.2, 0);
    expect(out.missed).toBe(false);
    expect(run.shotsLeft).toBe(0);
  });
});
```

`stage()`·`GEOM`·`toPixel`은 그 파일에 이미 있다 — 새로 만들지 말 것.
**각도 1.2 · 파워 0이 헛발이 아니면** 각도를 1.24(MAX_ANGLE 근처)까지 올린다 —
수평에 가까울수록 짧게 떨어진다.

- [ ] **Step 2: 실패를 확인한다**

Run: `npx vitest run tests/hex/stageRun.test.ts`
Expected: FAIL — `out.missed`가 `undefined`이고 `shotsLeft`가 안 깎인다.

- [ ] **Step 3: 구현한다**

`ShotOutcome`에 필드를 더한다(62~67행 근처):

```ts
export interface ShotOutcome {
  snapped: Axial | null;
  steps: PopStep[];
  dropped: Axial[];
  rescued: Cage[];
  /** 판에 닿지 못하고 떨어졌다. 한 발은 소모된다 */
  missed: boolean;
}
```

`fireAt`의 시그니처와 앞부분을 고친다(73~88행):

```ts
export function fireAt(
  state: RunState,
  geom: BoardGeom,
  from: { x: number; y: number },
  angleRad: number,
  power = 1,
  rng: () => number = Math.random,
): ShotOutcome {
  const empty: ShotOutcome = { snapped: null, steps: [], dropped: [], rescued: [], missed: false };
  if (state.shotsLeft <= 0) return empty;

  const { snap, missed } = simulateShot(state.cells, geom, from, angleRad, power);
  if (!snap) {
    // 헛발도 대가를 치른다 — 한 발을 깎고 **장전까지 넘긴다**.
    // 같은 타일이 손에 남아 있으면 「소모했다」가 화면에서 읽히지 않는다.
    if (!missed) return empty; // 스냅도 헛발도 아닌 경우(발사 지점이 막힘) — 판이 안 움직인다
    state.shotsLeft -= 1;
    state.loaded = state.next;
    state.next = pickNext(state.cells, rng);
    return { ...empty, missed: true };
  }

  state.shotsLeft -= 1;
  placeTile(state.cells, snap, state.loaded);
```

나머지(89~107행)는 그대로 두고, 마지막 `return`만 고친다:

```ts
  return { snapped: snap, steps, dropped, rescued, missed: false };
```

- [ ] **Step 4: 통과를 확인한다**

Run: `npx vitest run tests/hex/stageRun.test.ts`
Expected: PASS.

- [ ] **Step 5: 타입을 확인한다**

Run: `npx tsc --noEmit`
Expected: 통과. `stageScreen.ts:201`의 `fireAt(state, BOARD, launchOriginLocal(), angle)`은
`power` 기본값 1로 컴파일된다(Task 7에서 실제 파워를 넘긴다).

- [ ] **Step 6: 커밋**

```bash
git add src/engine/hex/stageRun.ts tests/hex/stageRun.test.ts
git commit -m "feat: 헛발도 한 발을 소모하고 장전을 넘긴다"
```

---

### Task 3: 새총 조준 계산 (`dragAim.ts`)

**Files:**
- Create: `src/ui/hex/dragAim.ts`
- Test: `tests/hex/dragAim.test.ts`

**Interfaces:**
- Consumes: 없음. **Pixi를 import하지 않는다** — 좌표만 받는다(그래서 헤드리스로 테스트된다)
- Produces:
  - `Aim { angle: number; power: number }`
  - `DragAim { down(p); move(p); up(p): Aim | null; current(): Aim | null; cancel(): void }`
  - `createDragAim(anchor: { x: number; y: number }): DragAim`
  - `MAX_ANGLE`(1.25) · `DEAD_ZONE`(16) · `MAX_PULL`(170)

- [ ] **Step 1: 실패하는 테스트를 쓴다**

`tests/hex/dragAim.test.ts`를 새로 만든다.

```ts
// tests/hex/dragAim.test.ts — 새총 조준: 당긴 반대로 날아간다
import { describe, it, expect } from "vitest";
import { createDragAim, MAX_ANGLE, DEAD_ZONE, MAX_PULL } from "../../src/ui/hex/dragAim";

const ANCHOR = { x: 225, y: 700 };

describe("createDragAim", () => {
  it("아래로 곧게 당기면 똑바로 위로 쏜다", () => {
    const d = createDragAim(ANCHOR);
    d.down(ANCHOR);
    d.move({ x: ANCHOR.x, y: ANCHOR.y + 100 });
    expect(d.current()!.angle).toBeCloseTo(0, 5);
  });

  it("오른쪽 아래로 당기면 왼쪽 위로 쏜다 — 새총", () => {
    const d = createDragAim(ANCHOR);
    d.down(ANCHOR);
    d.move({ x: ANCHOR.x + 100, y: ANCHOR.y + 100 });
    expect(d.current()!.angle).toBeLessThan(0); // 음수 = 왼쪽
  });

  it("당긴 거리가 멀수록 파워가 크다", () => {
    const d = createDragAim(ANCHOR);
    d.down(ANCHOR);
    d.move({ x: ANCHOR.x, y: ANCHOR.y + DEAD_ZONE + 20 });
    const weak = d.current()!.power;
    d.move({ x: ANCHOR.x, y: ANCHOR.y + DEAD_ZONE + 90 });
    expect(d.current()!.power).toBeGreaterThan(weak);
  });

  it("파워는 0~1을 벗어나지 않는다", () => {
    const d = createDragAim(ANCHOR);
    d.down(ANCHOR);
    d.move({ x: ANCHOR.x, y: ANCHOR.y + MAX_PULL * 5 });
    expect(d.current()!.power).toBe(1);
    d.move({ x: ANCHOR.x, y: ANCHOR.y + 1 });
    expect(d.current()!.power).toBe(0);
  });

  it("각도는 ±MAX_ANGLE에서 잘린다", () => {
    const d = createDragAim(ANCHOR);
    d.down(ANCHOR);
    // 거의 수평으로 당긴다 — 클램프가 없으면 90°에 가까워진다
    d.move({ x: ANCHOR.x - 300, y: ANCHOR.y + 1 });
    expect(d.current()!.angle).toBeCloseTo(MAX_ANGLE, 5);
  });

  it("데드존 안에서 떼면 발사하지 않는다", () => {
    const d = createDragAim(ANCHOR);
    d.down(ANCHOR);
    expect(d.up({ x: ANCHOR.x + 3, y: ANCHOR.y + 3 })).toBeNull();
  });

  it("데드존을 넘겨 떼면 그 조준을 돌려준다", () => {
    const d = createDragAim(ANCHOR);
    d.down(ANCHOR);
    const aim = d.up({ x: ANCHOR.x, y: ANCHOR.y + DEAD_ZONE + 50 });
    expect(aim).not.toBeNull();
    expect(aim!.angle).toBeCloseTo(0, 5);
  });

  it("떼고 나면 조준이 없다", () => {
    const d = createDragAim(ANCHOR);
    d.down(ANCHOR);
    d.up({ x: ANCHOR.x, y: ANCHOR.y + 100 });
    expect(d.current()).toBeNull();
  });

  it("cancel하면 조준이 사라지고 up이 null을 준다", () => {
    const d = createDragAim(ANCHOR);
    d.down(ANCHOR);
    d.move({ x: ANCHOR.x, y: ANCHOR.y + 100 });
    d.cancel();
    expect(d.current()).toBeNull();
    expect(d.up({ x: ANCHOR.x, y: ANCHOR.y + 100 })).toBeNull();
  });

  it("down 없이 move하면 아무 일도 없다", () => {
    const d = createDragAim(ANCHOR);
    d.move({ x: ANCHOR.x, y: ANCHOR.y + 100 });
    expect(d.current()).toBeNull();
  });

  it("위로 당겨도 각도는 아래를 향하지 않는다", () => {
    // 앵커 위쪽을 눌러 끌면 발사 방향이 아래가 된다 — 클램프가 막아야 한다
    const d = createDragAim(ANCHOR);
    d.down(ANCHOR);
    d.move({ x: ANCHOR.x, y: ANCHOR.y - 100 });
    expect(Math.abs(d.current()!.angle)).toBeLessThanOrEqual(MAX_ANGLE);
  });
});
```

- [ ] **Step 2: 실패를 확인한다**

Run: `npx vitest run tests/hex/dragAim.test.ts`
Expected: FAIL — `Cannot find module '../../src/ui/hex/dragAim'`

- [ ] **Step 3: 구현한다**

`src/ui/hex/dragAim.ts`를 새로 만든다.

```ts
// ui/hex/dragAim.ts — 새총 조준. 포인터 좌표에서 각도와 파워만 뽑는다.
//
// 그리지 않고 Pixi도 모른다(좌표만 받는다) — 그래서 헤드리스로 테스트된다.
// 화면 전환 상태를 모듈 전역에 두지 않는다(규약 4조): 팩토리 클로저에 담는다.
//
// 규칙 하나로 각도와 파워가 같이 나온다. 앵커(말 하단 중앙)에서 손끝으로 가는
// 벡터를 v라 할 때 **발사 방향은 -v**다. 활·새총과 같은 규칙이라 설명이 필요 없다.

export interface Point { x: number; y: number }

export interface Aim {
  /** 0 = 똑바로 위, 양수 = 오른쪽 기울기(라디안). 엔진의 각도 규약과 같다 */
  angle: number;
  /** 0~1 */
  power: number;
}

/** 조준 각도 한계 — 수평 근처로 쏘면 판이 성립하지 않는다. 기존 launcher와 같은 값. */
export const MAX_ANGLE = 1.25; // 약 72°

/** 이 거리 안에서 떼면 발사하지 않는다 — 판을 톡 건드린 사고로 쏘지 않는다. */
export const DEAD_ZONE = 16;

/** 파워가 1에 닿는 당김 거리. 더 끌어도 파워는 그대로, 각도만 정밀해진다. */
export const MAX_PULL = 170;

export interface DragAim {
  down(p: Point): void;
  move(p: Point): void;
  /** 손을 뗐다. 데드존에 못 미치면 null — 오발로 보고 취소한다 */
  up(p: Point): Aim | null;
  current(): Aim | null;
  cancel(): void;
}

const clamp = (v: number, lo: number, hi: number): number => (v < lo ? lo : v > hi ? hi : v);

export function createDragAim(anchor: Point): DragAim {
  let aim: Aim | null = null;
  let dragging = false;

  /** 앵커→손끝 벡터에서 조준을 만든다. 당긴 거리가 0이면 null. */
  function read(p: Point): Aim | null {
    const vx = p.x - anchor.x;
    const vy = p.y - anchor.y;
    const dist = Math.hypot(vx, vy);
    if (dist < 1e-6) return null;
    // 발사 방향 = -v. 각도 규약이 (x=sin, y=-cos)이므로 atan2(-vx, vy)다.
    // vy가 음수(앵커 위를 끌었다)면 아래를 향하는 각이 나오지만 클램프가 잡는다.
    const angle = clamp(Math.atan2(-vx, vy), -MAX_ANGLE, MAX_ANGLE);
    const power = clamp((dist - DEAD_ZONE) / (MAX_PULL - DEAD_ZONE), 0, 1);
    return { angle, power };
  }

  return {
    down(p: Point): void {
      dragging = true;
      aim = read(p);
    },

    move(p: Point): void {
      if (!dragging) return;
      aim = read(p);
    },

    up(p: Point): Aim | null {
      if (!dragging) return null;
      dragging = false;
      const dist = Math.hypot(p.x - anchor.x, p.y - anchor.y);
      aim = null;
      // 데드존 안이면 조준 자체가 없었던 것으로 본다
      if (dist < DEAD_ZONE) return null;
      return read(p);
    },

    current(): Aim | null {
      return aim;
    },

    cancel(): void {
      dragging = false;
      aim = null;
    },
  };
}
```

- [ ] **Step 4: 통과를 확인한다**

Run: `npx vitest run tests/hex/dragAim.test.ts`
Expected: PASS — 11건.

- [ ] **Step 5: 커밋**

```bash
git add src/ui/hex/dragAim.ts tests/hex/dragAim.test.ts
git commit -m "feat: 새총 조준 계산 — 당긴 반대로 날아간다"
```

---

### Task 4: 최대 장전 프레임 (`horseHold`)

**Files:**
- Modify: `src/data/hexAssets.ts` (`HexAssetPaths`·`parse`)
- Modify: `src/data/uiLayout.ts` (`UiUpload`·`parseUploads`)
- Modify: `src/data/assets.json` · `src/data/uiLayout.json`
- Test: `tests/hex/assetManifest.test.ts`

**Interfaces:**
- Consumes: 없음
- Produces:
  - `HexAssetPaths.horseHold: number` — 0-based 프레임 인덱스. 프레임이 없으면 `0`
  - `UiUpload.hold?: string` — 그 값을 저장할 매니페스트 점 경로

- [ ] **Step 1: 실패하는 테스트를 쓴다**

`tests/hex/assetManifest.test.ts` 맨 아래에 붙인다.

```ts
describe("붉은말 최대 장전 프레임", () => {
  it("매니페스트에서 숫자로 읽힌다", () => {
    expect(Number.isInteger(hexAssetPaths.horseHold)).toBe(true);
    expect(hexAssetPaths.horseHold).toBeGreaterThanOrEqual(0);
  });

  it("프레임 범위를 벗어나지 않는다", () => {
    const len = hexAssetPaths.horse.length;
    if (len === 0) {
      expect(hexAssetPaths.horseHold).toBe(0);
      return;
    }
    expect(hexAssetPaths.horseHold).toBeLessThan(len);
  });

  it("에디터의 붉은말 항목이 저장 경로를 들고 있다", () => {
    const horse = uiUploads.find((u) => u.asset === "hex.horse");
    expect(horse?.hold).toBe("hex.horseHold");
  });
});
```

- [ ] **Step 2: 실패를 확인한다**

Run: `npx vitest run tests/hex/assetManifest.test.ts`
Expected: FAIL — `hexAssetPaths.horseHold`가 `undefined`, `horse.hold`도 `undefined`.

- [ ] **Step 3: 구현한다**

**(a)** `src/data/hexAssets.ts` — `HexAssetPaths`에 필드를 더한다(`horse` 바로 아래):

```ts
  /** 화면 하단 붉은말(발사대) — 시퀀스 */
  horse: string[];
  /** 그 시퀀스에서 **팔이 최대로 접힌 프레임**(0-based).
   *  앞은 당김(드래그로 스크럽), 뒤는 토스(놓으면 재생)로 갈린다.
   *  디자이너가 에디터에서 찍는다. 안 찍었으면 한가운데를 쓴다. */
  horseHold: number;
```

같은 파일에 검증 함수를 더한다(`frames` 아래):

```ts
/** 프레임 인덱스. 범위를 벗어나거나 정수가 아니면 한가운데로 접는다 —
 *  디자이너 오투입이 런타임 예외가 되면 안 된다(규약 3조). */
function frameIndex(v: unknown, len: number): number {
  if (len === 0) return 0;
  if (typeof v !== "number" || !Number.isInteger(v) || v < 0 || v >= len) {
    return Math.floor(len / 2);
  }
  return v;
}
```

`parse()`의 `return`에서 `horse` 옆에 붙인다:

```ts
  const horse = frames(hex.horse);
  ...
    horse,
    horseHold: frameIndex(hex.horseHold, horse.length),
```

(`horse: frames(hex.horse)`를 인라인으로 두면 길이를 두 번 계산하게 되므로
지역 변수로 뽑는다.)

**(b)** `src/data/uiLayout.ts` — `UiUpload`에 필드를 더한다(`group` 아래):

```ts
  /** 시퀀스 안의 한 프레임을 가리키는 숫자를 저장할 매니페스트 점 경로.
   *  이 값이 있는 슬롯에만 에디터가 프레임 스크러버를 붙인다. */
  hold?: string;
```

`parseUploads`의 `.map`에 한 줄 더한다:

```ts
      group: typeof u.group === "string" ? u.group : undefined,
      hold: typeof u.hold === "string" ? u.hold : undefined,
```

**(c)** `src/data/assets.json` — `hex` 블록의 `horse` 옆에 더한다:

```jsonc
"horseHold": 0
```

(아트가 아직 없어 `horse`가 빈 배열이다. `frameIndex`가 `0`으로 접으므로 값은
무엇이든 되지만, 명시해 두면 디자이너가 이 키의 존재를 안다.)

**(d)** `src/data/uiLayout.json` — `uploads`의 붉은말 항목에 한 줄 더한다:

```jsonc
{ "label": "붉은말(발사대)", "asset": "hex.horse", "group": "발사대", "seq": true, "hold": "hex.horseHold" }
```

- [ ] **Step 4: 통과를 확인한다**

Run: `npx vitest run tests/hex/assetManifest.test.ts`
Expected: PASS.

- [ ] **Step 5: 전체 테스트와 타입**

Run: `npm test -- --run` 그리고 `npx tsc --noEmit`
Expected: 둘 다 통과.

- [ ] **Step 6: 커밋**

```bash
git add src/data/hexAssets.ts src/data/uiLayout.ts src/data/assets.json src/data/uiLayout.json tests/hex/assetManifest.test.ts
git commit -m "feat: 붉은말 최대 장전 프레임을 매니페스트에서 받는다"
```

---

### Task 5: 직각삼각형 파워 게이지 (`powerGauge.ts`)

**Files:**
- Create: `src/ui/hex/powerGauge.ts`
- Modify: `src/data/uiLayout.json` (`ingame` 영역에 `powerGauge` 슬롯)

**Interfaces:**
- Consumes: `slot("ingame", "powerGauge")` — `data/uiLayout.ts`
- Produces:
  - `PowerGauge { root: Container; set(power: number | null): void; destroy(): void }`
  - `createPowerGauge(): PowerGauge` — `set(null)`이면 숨는다

- [ ] **Step 1: 슬롯을 더한다**

`src/data/uiLayout.json`의 `areas` → `id: "ingame"` → `slots` 끝에 붙인다.
좌표계는 중앙 콘텐츠 컬럼 450×800이다. 판 하단 여백의 왼쪽에 둔다 —
오른쪽은 NEXT·부스터 레일이 쓴다.

```jsonc
{ "id": "powerGauge", "label": "파워 게이지", "x": 24, "y": 690, "w": 96, "h": 44 }
```

- [ ] **Step 2: 구현한다**

`src/ui/hex/powerGauge.ts`를 새로 만든다.

```ts
// ui/hex/powerGauge.ts — 당긴 힘을 보여주는 직각삼각형 램프.
//
// 점선 궤적의 끝도 사거리를 말해 주지만, 타일에 가리거나 화면 밖으로 나가면
// 읽히지 않는다. 모양 자체가 「낮다→높다」인 램프는 눈금도 글자도 필요 없다.
//
// 자리는 코드에 박지 않는다 — uiLayout의 ingame/powerGauge 슬롯이 정한다.
// 나중에 아트가 오면 같은 슬롯에 그림을 얹으면 된다.
import { Container, Graphics } from "pixi.js";
import { slot } from "../../data/uiLayout";

/** 슬롯이 없을 때의 자리. 판 하단 왼쪽 — 오른쪽은 NEXT·부스터 레일이 쓴다. */
const FALLBACK = { x: 24, y: 690, w: 96, h: 44 };

/** 이 파워를 넘으면 채움색이 바뀐다 — 최대 근처를 눈으로 안다. */
const HOT = 0.8;

const COLD_FILL = 0xf0c96a;
const HOT_FILL = 0xff8f5a;
const FRAME = 0xffffff;

export interface PowerGauge {
  root: Container;
  /** 0~1이면 그 만큼 채우고, null이면 숨는다. */
  set(power: number | null): void;
  destroy(): void;
}

export function createPowerGauge(): PowerGauge {
  const s = slot("ingame", "powerGauge");
  const box = s ? { x: s.x, y: s.y, w: s.w, h: s.h } : FALLBACK;

  const root = new Container();
  root.x = box.x;
  root.y = box.y;
  root.visible = false;

  // 윤곽 — 왼쪽 아래가 직각, 오른쪽으로 갈수록 높아진다.
  const frame = new Graphics()
    .moveTo(0, box.h)
    .lineTo(box.w, box.h)
    .lineTo(box.w, 0)
    .closePath()
    .stroke({ width: 2, color: FRAME, alpha: 0.5 });

  const fill = new Graphics();
  root.addChild(fill, frame);

  return {
    root,

    set(power: number | null): void {
      if (power === null) {
        root.visible = false;
        fill.clear();
        return;
      }
      const t = power < 0 ? 0 : power > 1 ? 1 : power;
      root.visible = true;
      fill.clear();
      if (t <= 0) return;
      // 왼쪽부터 t만큼 잘라낸 사다리꼴. 빗변 위의 높이는 x에 비례한다.
      const x = box.w * t;
      fill
        .moveTo(0, box.h)
        .lineTo(x, box.h)
        .lineTo(x, box.h - box.h * t)
        .closePath()
        .fill({ color: t >= HOT ? HOT_FILL : COLD_FILL, alpha: 0.9 });
    },

    destroy(): void {
      root.destroy({ children: true });
    },
  };
}
```

- [ ] **Step 3: 타입을 확인한다**

Run: `npx tsc --noEmit`
Expected: 통과.

렌더 코드라 단위 테스트를 붙이지 않는다 — 이 레포의 다른 뷰(`hudView`,
`boardView`)도 같은 판단이다. 눈으로 보는 검증은 Task 7 뒤에 한다.

- [ ] **Step 4: 커밋**

```bash
git add src/ui/hex/powerGauge.ts src/data/uiLayout.json
git commit -m "feat: 직각삼각형 파워 게이지 — 자리는 에디터가 정한다"
```

---

### Task 6: 말 스크럽과 곡선 궤적 (`launcher.ts`)

**Files:**
- Modify: `src/ui/hex/launcher.ts` (전면 개편)

**Interfaces:**
- Consumes: Task 1의 `simulateShot(..., power)` · Task 3의 `Aim` · Task 4의 `horseHold`
- Produces:
  - `createLauncher(horseFrames: readonly Texture[], horseHold: number): Launcher`
  - `Launcher { root; setLoaded(tier); setAim(aim: Aim | null, cells): void; playToss(): Promise<void>; settleBack(): void; playFlight(path, tier): Promise<void>; pause(); resume(); destroy() }`
- **사라지는 것**: `aimAt`·`clearAim`·`angle()`·`AIM_RATE_PER_MS`. Task 7이 마지막 호출부다.

- [ ] **Step 1: 조준 상태 기계를 걷어낸다**

`src/ui/hex/launcher.ts`에서 지운다:
- `AIM_RATE_PER_MS` 상수와 그 긴 주석 (드래그에는 상한이 해가 된다 — 스펙 §4-3)
- `MAX_ANGLE` 상수 (`dragAim`으로 옮겨 갔다)
- `targetAngle` · `aimRaf` · `lastTick` · `startAimLoop` · `stopAimLoop`
- 인터페이스의 `aimAt` · `clearAim` · `angle`

`import { simulateShot }`과 `makeSequence`, `TIER_COLORS`, `drawTileFallback`,
`BOARD`, `ORIGIN`, `launchOrigin`, `launchOriginLocal`은 그대로 쓴다.

- [ ] **Step 2: 시퀀스를 스크럽 가능하게 잡는다**

`makeSequence`는 프레임을 시간으로 돌린다 — 스크럽은 텍스처를 직접 갈아야 한다.
`horse` 부분을 이렇게 바꾼다:

```ts
import { Container, Graphics, Sprite, type Texture } from "pixi.js";
import { fitContain } from "../skin";
import type { Aim } from "./dragAim";

/** 발사대에 선 붉은말의 크기. 셀 폭이 아니라 화면 기준으로 잡는다 —
 *  격자가 촘촘해져도 캐릭터가 같이 작아지면 안 된다. */
const HORSE_W = 190;
const HORSE_H = 190;

/** 조준각을 몸 기울기로 옮기는 비율. 1이면 몸이 조준각 그대로 눕는다 — 과하다. */
const TILT_RATIO = 0.35;

/** 토스 재생 속도(프레임/초). */
const TOSS_FPS = 24;

/** 오발로 되돌아가는 시간. 뚝 끊기면 조작 실수가 버그처럼 보인다. */
const SETTLE_MS = 180;

export function createLauncher(
  horseFrames: readonly Texture[] = [],
  horseHold = 0,
): Launcher {
  const root = new Container();
  const guide = new Graphics();
  root.addChild(guide);

  const origin = launchOrigin();

  // 붉은말 — 발사 지점 뒤에 선다. 시퀀스가 없으면 아무것도 그리지 않는다:
  // 폴백 그림을 두면 아트가 왔을 때 겹친다.
  //
  // 앵커는 (0.5, 1) — **하단 중앙**이다. 회전축이 곧 발 밑이라야 몸이 좌우로
  // 기울 때 정수리만 움직이고 발이 제자리에 남는다. 컨테이너 오프셋으로
  // 흉내내면 회전이 세로 이동으로 새어 나온다.
  const horse: Sprite | null = horseFrames.length > 0 ? new Sprite(horseFrames[0]) : null;
  if (horse) {
    horse.anchor.set(0.5, 1);
    fitContain(horse, HORSE_W, HORSE_H);
    horse.x = origin.x;
    horse.y = origin.y + HORSE_H * 0.28 + HORSE_H / 2;
    root.addChild(horse);
  }

  /** 시퀀스에서 「당김」 구간의 마지막 프레임. 뒤는 토스 구간이다. */
  const hold = Math.min(Math.max(0, horseHold), Math.max(0, horseFrames.length - 1));

  /** 파워(0~1)를 당김 구간의 프레임으로 옮긴다. */
  function scrub(power: number): void {
    if (!horse || horseFrames.length === 0) return;
    const i = Math.min(hold, Math.round(power * hold));
    const tex = horseFrames[i];
    if (tex && horse.texture !== tex) {
      horse.texture = tex;
      fitContain(horse, HORSE_W, HORSE_H);
    }
  }
```

`fitContain`은 `ui/skin.ts`에 이미 있다(`sequence.ts`가 쓰는 것과 같은 함수).
`makeSequence` import는 더 쓰지 않으므로 지운다.

- [ ] **Step 3: `setAim`을 구현한다**

`aimAt`이 있던 자리에 넣는다. 반환 객체의 메서드다.

```ts
    /** 드래그 중 매 프레임. null이면 조준을 지운다. */
    setAim(aim: Aim | null, cells: Map<string, Cell>): void {
      if (aim === null) {
        guide.clear();
        scrub(0);
        if (horse) horse.rotation = 0;
        return;
      }
      currentAngle = aim.angle;
      currentPower = aim.power;
      scrub(aim.power);
      if (horse) horse.rotation = aim.angle * TILT_RATIO;

      const { path } = simulateShot(cells, BOARD, launchOriginLocal(), aim.angle, aim.power);
      guide.clear();
      // 점선 — 4스텝마다 한 점씩. 중력이 들어갔으므로 자동으로 곡선이 되고,
      // 점선의 끝이 곧 사거리다.
      for (let i = 0; i < path.length; i += 4) {
        const p = path[i]!;
        guide.circle(ORIGIN.x + p.x, ORIGIN.y + p.y, 3).fill({ color: 0xffffff, alpha: 0.55 });
      }
    },
```

`currentAngle`·`currentPower`는 `loadedTier` 옆에 지역 상태로 둔다:

```ts
  let currentAngle = 0;
  let currentPower = 0;
```

(`aim()`으로 밖에 내주지 않는다 — Task 7이 `dragAim.up()`의 반환값을 쓴다.
여기 값은 `settleBack`이 되돌릴 출발점으로만 쓴다.)

- [ ] **Step 4: `playToss`와 `settleBack`을 구현한다**

```ts
    /** 손을 뗐다. 최대 장전 프레임부터 끝까지 재생하고 첫 프레임으로 돌아간다. */
    async playToss(): Promise<void> {
      guide.clear();
      if (!horse || horseFrames.length <= hold + 1) {
        // 토스 구간이 없다(스틸이거나 hold가 마지막 프레임) — 즉시 끝낸다
        scrub(0);
        if (horse) horse.rotation = 0;
        return;
      }
      const start = performance.now();
      const count = horseFrames.length - hold;
      await new Promise<void>((resolve) => {
        const tick = (): void => {
          if (horse.destroyed) { resolve(); return; }
          const i = Math.floor(((performance.now() - start) / 1000) * TOSS_FPS);
          if (i >= count) { resolve(); return; }
          const tex = horseFrames[hold + i];
          if (tex && horse.texture !== tex) {
            horse.texture = tex;
            fitContain(horse, HORSE_W, HORSE_H);
          }
          requestAnimationFrame(tick);
        };
        tick();
      });
      if (!horse.destroyed) {
        scrub(0);
        horse.rotation = 0;
      }
    },

    /** 오발 — 쏘지 않고 제자리로 되돌린다. */
    settleBack(): void {
      guide.clear();
      const fromPower = currentPower;
      const fromRot = horse ? horse.rotation : 0;
      const t0 = performance.now();
      const tick = (): void => {
        if (!horse || horse.destroyed) return;
        const t = Math.min(1, (performance.now() - t0) / SETTLE_MS);
        const e = 1 - (1 - t) * (1 - t); // easeOut
        scrub(fromPower * (1 - e));
        horse.rotation = fromRot * (1 - e);
        if (t < 1) requestAnimationFrame(tick);
      };
      if (horse) requestAnimationFrame(tick);
      currentPower = 0;
    },
```

- [ ] **Step 5: `pause`/`resume`/`destroy`를 정리한다**

조준 루프가 사라졌으므로 `pause`/`resume`은 할 일이 없다. **인터페이스에서
지우지 말고 빈 몸으로 두지도 말 것** — `stageScreen`이 설정창을 열 때 부른다.
지금은 `guide`가 정적이라 멈출 것이 없다는 사실을 주석으로 남긴다:

```ts
    /** 설정창이 열렸다. 조준선은 정적이라 멈출 것이 없다 —
     *  드래그 중이었다면 stageScreen이 dragAim.cancel()로 끊는다. */
    pause(): void {},
    resume(): void {},

    destroy(): void {
      root.destroy({ children: true });
    },
```

`playFlight`·`setLoaded`·`redrawLoaded`는 그대로 둔다.

- [ ] **Step 6: 줄 수와 타입을 확인한다**

Run: `wc -l src/ui/hex/launcher.ts` — 250줄 이하여야 한다(규약 1조).
Run: `npx tsc --noEmit`
Expected: `stageScreen.ts`가 `aimAt`/`angle`을 부르고 있어 **에러가 난다**.
Task 7에서 고친다 — 여기서는 그 에러만 남아 있으면 정상이다.

- [ ] **Step 7: 커밋**

```bash
git add src/ui/hex/launcher.ts
git commit -m "feat: 붉은말을 파워로 스크럽하고 궤적을 곡선으로 그린다"
```

---

### Task 7: 배선 (`stageScreen.ts`)

**Files:**
- Modify: `src/ui/hex/stageScreen.ts` (입력 핸들러 · `StageTextures` · `createLauncher` 호출)
- Modify: `src/ui/hex/hexAssets.ts` (`horseHold`를 텍스처 묶음에 실어 나른다)

**Interfaces:**
- Consumes: Task 1~6 전부
- Produces: 없음 (화면 배선이 끝점이다)

- [ ] **Step 1: `horseHold`를 화면까지 나른다**

`src/ui/hex/stageScreen.ts`의 `StageTextures`에 필드를 더한다(`horse` 아래):

```ts
  /** 화면 하단 붉은말 — 시퀀스 */
  horse: Texture[];
  /** 그 시퀀스에서 팔이 최대로 접힌 프레임(0-based) */
  horseHold: number;
```

`src/ui/hex/hexAssets.ts`의 `loadHexAssets` 반환에 한 줄 더한다:

```ts
  return { tiles, horseshoe, cageLocked, cageOpen, animals, horse, horseHold: paths.horseHold, bg: { board, panelLeft, panelRight } };
```

(로더는 경로 묶음(`HexAssetPaths`)을 이미 주입받는다 — 규약 2조를 새로 어기지 않는다.)

- [ ] **Step 2: 발사대와 게이지를 만든다**

`stageScreen.ts`의 `const launcher = createLauncher(textures.horse);`를 바꾼다:

```ts
import { createDragAim } from "./dragAim";
import { createPowerGauge } from "./powerGauge";
import { launchOrigin } from "./geom";
...
const launcher = createLauncher(textures.horse, textures.horseHold);
const gauge = createPowerGauge();
// 앵커는 붉은말의 발 밑이다 — 새총의 고정점이 눈에 보이는 자리와 같아야 한다
const aimer = createDragAim(launchOrigin());
```

레이어 순서에 게이지를 더한다(HUD보다 앞, 입력판보다 뒤):

```ts
layer.addChild(board.root, cages.root, launcher.root, hud.root, gauge.root);
```

- [ ] **Step 3: 입력 핸들러를 갈아 끼운다**

`onDown`·`onMove`·`onUp`을 바꾼다(169~225행 근처).

```ts
    function onDown(e: FederatedPointerEvent): void {
      if (busy) return;
      const p = e.getLocalPosition(layer);
      aimer.down(p);
      launcher.setAim(aimer.current(), state.cells);
      gauge.set(aimer.current()?.power ?? null);
    }

    function onMove(e: FederatedPointerEvent): void {
      if (busy) return;
      // e.global은 렌더러(화면) 좌표계다 — app.stage.x가 0이 아닌 넓은 화면에서는
      // 그대로 쓰면 발사대 기준점이 수백 px 어긋난다. layer 로컬 좌표로 변환해야 한다.
      const p = e.getLocalPosition(layer);
      aimer.move(p);
      launcher.setAim(aimer.current(), state.cells);
      gauge.set(aimer.current()?.power ?? null);
    }

    async function onUp(e: FederatedPointerEvent): Promise<void> {
      if (busy || finished) return;
      const aim = aimer.up(e.getLocalPosition(layer));
      gauge.set(null);
      // 데드존 안에서 뗐다 — 쏘지 않고 자세만 되돌린다
      if (!aim) { launcher.settleBack(); return; }

      busy = true;
      try {
        // 비행 경로를 먼저 얻어 연출하고, 그 뒤 상태를 확정한다
        const firedTier = state.loaded;
        const { path } = simulateShot(state.cells, BOARD, launchOriginLocal(), aim.angle, aim.power);
        playSfx("audio.sfxShot");
        buzz();
        // 토스와 비행을 **동시에** 돌린다 — 기다리면 타일이 앞발에 붙어 있다가
        // 뒤늦게 떠나 어색하다
        await Promise.all([launcher.playToss(), launcher.playFlight(path, firedTier)]);

        const outcome = fireAt(state, BOARD, launchOriginLocal(), aim.angle, aim.power);
        if (outcome.steps.length > 0) playSfx("audio.sfxPop");
        redrawExceptCages(); // 타일·HUD는 즉시 반영 — 케이지는 아직 건드리지 않는다

        for (const cage of outcome.rescued) {
          playSfx("audio.sfxRescue");
          await cages.playRescue(cage); // 몸체가 아직 살아 있다
        }
        redraw(); // 연출이 끝난 뒤 케이지 정리

        if (isCleared(state)) {
          playSfx("audio.sfxClear");
          finish("cleared");
          return;
        }
        if (isFailed(state)) {
          playSfx("audio.sfxFail");
          finish("failed");
          return;
        }
      } finally {
        busy = false;
      }
    }
```

- [ ] **Step 4: 정리 경로를 잇는다**

`finish()`에서 게이지를 파괴하고 조준을 끊는다(`launcher.destroy()` 옆):

```ts
      aimer.cancel();
      launcher.destroy();
      gauge.destroy();
```

설정창을 여는 자리(`launcher.pause()` 근처, 240행 근처)에서도 드래그를 끊는다.
설정창이 열리는 동안 손을 뗐다 다시 대면 반쯤 당긴 상태가 남아 있게 된다:

```ts
      aimer.cancel();
      gauge.set(null);
      launcher.setAim(null, state.cells);
      launcher.pause();
```

- [ ] **Step 5: 타입과 테스트**

Run: `npx tsc --noEmit`
Expected: 통과 — `aimAt`/`angle` 호출부가 사라졌다.

Run: `npm test -- --run`
Expected: PASS.

Run: `npm run build`
Expected: 통과.

- [ ] **Step 6: 눈으로 본다**

Run: `npx vite --port 5199 --strictPort --host` (이미 떠 있으면 그대로 쓴다)

브라우저에서 스테이지에 들어가 확인한다:
1. 판 아래를 눌러 **아래로 끌면** 궤적 점선이 나오고 게이지가 찬다
2. 끌던 손을 **오른쪽으로 옮기면 궤적이 왼쪽으로 간다**(새총)
3. 손을 떼면 타일이 곡선으로 날아간다
4. 살짝만 누르고 떼면 **쏘지 않는다**
5. 아주 약하게 비스듬히 쏘면 판에 못 닿고, 그래도 발사 수가 준다

아트가 없으므로 말은 안 보인다 — 1·3·4는 궤적과 게이지로만 확인된다.

- [ ] **Step 7: 커밋**

```bash
git add src/ui/hex/stageScreen.ts src/ui/hex/hexAssets.ts
git commit -m "feat: 드래그 조준을 화면에 배선한다"
```

---

### Task 8: 에디터 — 프레임 스크러버

**Files:**
- Modify: `vite.config.ts` (`/__assets`에 POST)
- Modify: `src/tools/uiEditor.ts` (`card()`에 스크러버)

**Interfaces:**
- Consumes: Task 4의 `UiUpload.hold`
- Produces: 없음 (dev 도구가 끝점이다)

- [ ] **Step 1: 매니페스트 저장 경로를 연다**

`vite.config.ts`의 `uiLayoutSavePlugin` 안, `/__assets` 미들웨어를 바꾼다.
지금은 GET만 받는다(91행 근처).

```ts
      server.middlewares.use('/__assets', (req, res) => {
        if (req.method === 'GET') { serveJson(res, ASSETS_FILE); return }
        // 숫자 하나(예: hex.horseHold)를 고치려고 이미지를 올릴 수는 없다 —
        // 배치 저장(/__uilayout)과 같은 모양으로 매니페스트 전체를 받는다.
        if (req.method !== 'POST') { res.statusCode = 405; res.end('GET/POST only'); return }
        void collectBody(req, 1024 * 1024).then((buf) => {
          const parsed: unknown = JSON.parse(buf.toString('utf8'))
          if (!parsed || typeof parsed !== 'object' || Array.isArray(parsed)) {
            throw new Error('매니페스트 객체가 필요합니다')
          }
          fs.writeFileSync(ASSETS_FILE, JSON.stringify(parsed, null, 2) + '\n')
          touch(server, ASSETS_FILE)
          res.statusCode = 200
          res.end('ok')
        }).catch((err: unknown) => { res.statusCode = 400; res.end(String(err)) })
      })
```

`touch`와 `collectBody`는 같은 파일에 이미 있다.

- [ ] **Step 2: 스크러버를 붙인다**

`src/tools/uiEditor.ts`의 `card()` 시그니처에 인자를 더한다:

```ts
function card(label: string, dotted: string, onChanged?: () => void, seq = false, holdKey?: string): HTMLElement {
```

`paint()` 정의 **아래**, `return cell;` 위에 넣는다:

```ts
  // ── 최대 장전 프레임 (붉은말처럼 hold가 지정된 시퀀스에만) ──
  // 한 시퀀스에 「당김 → 폄」이 다 들어 있어, 어디까지가 당김인지 코드가 알아야 한다.
  if (holdKey) {
    const bar = $("div", "padding:0 12px 10px");
    const readHold = (): number => {
      const v = assetValue(holdKey);
      return typeof v === "number" && Number.isInteger(v) ? v : 0;
    };
    const label2 = $("div", "font-size:11px;color:#a8987c;margin-bottom:4px");
    const range = document.createElement("input");
    range.type = "range";
    range.min = "0";
    range.step = "1";
    range.setAttribute("style", "width:100%");
    const set = $("button",
      "margin-top:6px;background:#2b1d10;color:#f0c96a;border:1px solid #4a3320;border-radius:6px;padding:4px 10px;font-size:11px;font-weight:800;cursor:pointer",
      "이 프레임을 최대 장전으로");

    /** 매니페스트의 프레임 목록. 스크러버는 이 배열을 훑는다. */
    const frameList = (): string[] => {
      const v = assetValue(dotted);
      return Array.isArray(v) ? v.filter((x): x is string => typeof x === "string") : [];
    };

    const syncBar = (): void => {
      const list = frameList();
      const hold = readHold();
      if (list.length === 0) { bar.style.display = "none"; return; }
      bar.style.display = "";
      range.max = String(list.length - 1);
      label2.textContent = `최대 장전: ${hold}번 프레임 / 전체 ${list.length}장 — 앞은 당김, 뒤는 토스`;
    };

    range.oninput = (): void => {
      const list = frameList();
      const f = list[Number(range.value)];
      if (f) { img.dataset["retries"] = "1"; img.src = `${f}?v=${Date.now()}`; }
    };
    set.onclick = async (): Promise<void> => {
      setAssetPath(holdKey, Number(range.value));
      const res = await fetch("/__assets", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify(state.manifest),
      });
      label2.style.color = res.ok ? "#8fdc8f" : "#ff8f7a";
      if (res.ok) syncBar(); else label2.textContent = `저장 실패: ${await res.text()}`;
    };

    bar.append(label2, range, set);
    cell.appendChild(bar);
    syncBar();
    // 업로드로 프레임 수가 바뀌면 눈금도 따라가야 한다
    afterPaint = syncBar;
  }
```

`afterPaint`는 `card()` 안의 지역 변수다. `paint` 정의 **위**에 선언하고
`paint()` 끝에서 부른다:

```ts
  /** hold 슬롯이 붙으면 프레임 눈금을 다시 맞춘다. 없으면 아무 일도 없다. */
  let afterPaint: (() => void) | null = null;

  const paint = (): void => {
    // ... 기존 본문 그대로 ...
    img.src = `${rel}?v=${Date.now()}`;
    afterPaint?.();
  };
```

`paint()`의 이른 `return`이 세 갈래(경로 없음·비디오·오디오) 있다. 그 셋에도
`afterPaint?.();`를 붙인다 — 파일을 지웠을 때 눈금이 남아 있으면 안 된다.

`setAssetPath`는 `string | string[]`만 받는다 — 숫자를 넣기 위해 시그니처를
넓힌다(90행 근처):

```ts
function setAssetPath(dotted: string, value: string | string[] | number): void {
```

- [ ] **Step 3: 호출부에 `hold`를 넘긴다**

`renderUploads`의 카드 생성(423행 근처):

```ts
  for (const u of items) grid.appendChild(card(u.label, u.asset, undefined, u.seq === true, u.hold));
```

- [ ] **Step 4: 타입과 빌드**

Run: `npx tsc --noEmit` 그리고 `npm run build`
Expected: 둘 다 통과.

- [ ] **Step 5: 눈으로 본다**

Run: dev 서버에서 `/ui.html` → 「게임 에셋」 탭.

아트가 없으면 스크러버가 숨는다(프레임 0장). **아무 이미지 두세 장을 붉은말
슬롯에 올려** 확인한다:
1. 스크러버가 나타나고 「전체 N장」이 맞다
2. 스크러버를 끌면 미리보기가 그 프레임으로 바뀐다
3. 「이 프레임을 최대 장전으로」를 누르면 초록으로 바뀌고, `src/data/assets.json`의
   `hex.horseHold`가 그 숫자로 바뀐다
4. 페이지를 새로 고쳐도 값이 남아 있다

확인이 끝나면 올린 임시 이미지를 🗑로 지운다.

- [ ] **Step 6: 커밋**

```bash
git add vite.config.ts src/tools/uiEditor.ts
git commit -m "feat: 에디터에서 최대 장전 프레임을 찍는다"
```

---

## 마무리

- [ ] `npm test -- --run` — 178 + 18 = 196개 안팎
- [ ] `npm run build`
- [ ] `wc -l src/ui/hex/launcher.ts src/ui/hex/stageScreen.ts` — 각각 250줄 이하
- [ ] `docs/GDD.md`에 조작 변경을 한 문단으로 남긴다 (「결정이 바뀔 때마다 근거를 남긴다」)
- [ ] `CLAUDE.md`의 「현재 상태」 테스트 개수를 실제 값으로 고친다
- [ ] PR을 연다 — base `main`

## 남겨 둘 것 (이 브랜치에서 하지 않는다)

- 스테이지별 난이도·밸런싱 — 별도 브랜치
- 헛발 전용 연출(타일이 굴러떨어지는 그림) — 아트가 온 뒤
- 붉은말 대기 숨쉬기 루프 — 지금은 프레임 0에 정지한다. 아트가 오면 판단한다
