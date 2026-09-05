# 동물 운동회 (Race) 구현 플랜

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** 로비 하단 WORLD를 RACE로 바꾸고, 동물 6종이 100m 달리기를 하는 메타 미니게임을 넣는다.

**Architecture:** `data (상수) → engine/race (순수 TS) → ui/race (Pixi)` 단방향. 탭 1회가 걸음
하나를 앞에 찍고 몸이 지수 보간으로 따라간다 — 같은 수식이 걷기와 질주를 모두 만든다.
보상은 순위가 아니라 자기 최고기록 갱신에 건다.

**Tech Stack:** TypeScript (strict) · Pixi.js v8 · Vitest · Vite

**Spec:** `docs/superpowers/specs/2026-09-05-animal-race-design.md`

## Global Constraints

- 논리 좌표계는 **450 × 800** (`src/ui/stage.ts`의 `BASE_W`/`BASE_H`). 모든 슬롯 좌표가 이 계다.
- **`engine/race/`는 `pixi.js`를 import하지 않는다.** 검증: `grep -rn "pixi.js" src/engine | wc -l` → `0`
- **새 파일은 200줄에서 자른다** (CLAUDE.md 규약 1조).
- **`ui/race/` 중 `raceScreen.ts` 하나만** `../../data`를 import한다 (규약 2조).
  나머지 4개는 좌표·텍스처를 인자로 받는다.
- **JSON은 `as unknown as`로 받지 않는다** (규약 3조). 필드별로 검증하고 어긋나면 기본값.
- **모듈 전역 `let` 금지** (규약 4조). 화면 상태는 `openRace` 클로저 안 객체 하나.
- 기존 테스트는 **하나도 깨지지 않아야 한다.** 기준선: `npm test` → 207 passed / 15 files.
- 랜덤은 항상 `rng: () => number = Math.random`으로 주입받는다 (`engine/hex/stageRun.ts` 관례).
- 커밋 메시지는 한국어. 각 Task 끝에 커밋한다.

---

## 파일 구조

| 파일 | 책임 | 신규/수정 |
|---|---|---|
| `src/data/race.ts` | 튜닝 상수 · 레이스 에셋 경로 파싱 | 신규 |
| `src/engine/race/types.ts` | `RunnerState` · `RaceState` · `RacePhase` | 신규 |
| `src/engine/race/step.ts` | 탭 → 걸음 → 위치 (플레이어) | 신규 |
| `src/engine/race/pace.ts` | AI 5마리 페이스 | 신규 |
| `src/engine/race/raceRun.ts` | 상태 전이 · 결승 판정 · 순위 | 신규 |
| `src/engine/race/reward.ts` | 기록 갱신 판정 · 보상 | 신규 |
| `src/engine/profile.ts` | `raceBest` · `boosters` 필드 추가 | 수정 |
| `src/engine/hex/stageRun.ts` | `createRun` 재고 인자 | 수정 `:13` |
| `src/ui/hex/stageScreen.ts` | 재고를 `createRun`에 전달 | 수정 `:129` |
| `src/ui/race/trackView.ts` | 배경 3층 스크롤 · 레인 · 결승선 | 신규 |
| `src/ui/race/runnerView.ts` | 러너 1마리 · 걸음 애니 | 신규 |
| `src/ui/race/rosterView.ts` | 뽑기 룰렛 | 신규 |
| `src/ui/race/raceResultView.ts` | 결과 패널 | 신규 |
| `src/ui/race/raceScreen.ts` | 화면 조립 · 단계 전이 | 신규 |
| `src/ui/lobbyScreen.ts` | `navWorld` → `navRace` | 수정 |
| `src/ui/layoutEditor.ts` | `mergeAreas` 이식 (교체 → 병합) | 수정 `:301-315` |
| `src/data/uiLayout.json` | `race` 영역 · uploads · audios | 수정 |
| `src/data/assets.json` | `race` 노드 · `hex.booster` · `lobby.navRace` | 수정 |
| `src/data/hexAssets.ts` | `AUDIO_SLOT_IDS`에 레이스 6종 | 수정 |

---

## Task 1: 인게임 에디터 저장을 병합으로 바꾼다

`race` 영역을 JSON에 넣기 **전에** 해야 한다. 지금 상태로 영역을 추가하면, 게임 탭을
열어 둔 채 슬롯을 하나만 끌어도 그 영역이 통째로 사라진다. `/ui.html` 쪽은 `584dfdd`가
이미 같은 방식으로 고쳤다.

**Files:**
- Modify: `src/ui/layoutEditor.ts:301-315`
- Test: `src/ui/layoutEditor.merge.test.ts` (신규 — `vitest.config.ts`가 `src/**/*.test.ts`를 잡는다)

**Interfaces:**
- Produces: `export function mergeAreas(disk: UiArea[], mine: UiArea[]): UiArea[]`

- [ ] **Step 1: 실패하는 테스트를 쓴다**

`src/ui/layoutEditor.merge.test.ts`:

```ts
// 에디터 저장이 디스크의 낯선 슬롯을 지우지 않는지 — 실제로 두 번 지워진 적이 있다(584dfdd)
import { describe, expect, it } from "vitest";
import { mergeAreas } from "./layoutEditor";
import type { UiArea } from "../data/uiLayout";

const slot = (id: string, x: number): UiArea["slots"][number] =>
  ({ id, label: id, x, y: 0, w: 10, h: 10 });

describe("mergeAreas", () => {
  it("디스크에만 있는 슬롯을 남긴다", () => {
    const disk: UiArea[] = [{ id: "lobby", label: "로비", slots: [slot("gear", 1), slot("navRace", 2)] }];
    const mine: UiArea[] = [{ id: "lobby", label: "로비", slots: [slot("gear", 99)] }];
    const out = mergeAreas(disk, mine);
    expect(out[0]!.slots.map((s) => s.id)).toEqual(["gear", "navRace"]);
  });

  it("아는 슬롯은 내 좌표가 이긴다", () => {
    const disk: UiArea[] = [{ id: "lobby", label: "로비", slots: [slot("gear", 1)] }];
    const mine: UiArea[] = [{ id: "lobby", label: "로비", slots: [slot("gear", 99)] }];
    expect(mergeAreas(disk, mine)[0]!.slots[0]!.x).toBe(99);
  });

  it("디스크에만 있는 영역을 남긴다", () => {
    const disk: UiArea[] = [
      { id: "lobby", label: "로비", slots: [slot("gear", 1)] },
      { id: "race", label: "레이스", slots: [slot("run", 5)] },
    ];
    const mine: UiArea[] = [{ id: "lobby", label: "로비", slots: [slot("gear", 99)] }];
    expect(mergeAreas(disk, mine).map((a) => a.id)).toEqual(["lobby", "race"]);
  });

  it("디스크를 못 읽었으면 내 것을 그대로 쓴다", () => {
    const mine: UiArea[] = [{ id: "lobby", label: "로비", slots: [slot("gear", 99)] }];
    expect(mergeAreas([], mine)).toBe(mine);
  });
});
```

- [ ] **Step 2: 실패를 확인한다**

Run: `npx vitest run src/ui/layoutEditor.merge.test.ts`
Expected: FAIL — `mergeAreas` is not exported / not a function

- [ ] **Step 3: 최소 구현**

`src/ui/layoutEditor.ts`, `flushSave` **바로 위**에 넣는다:

```ts
/** 디스크의 배치에 이 세션이 옮긴 좌표만 얹는다.
 *
 *  화면 코드는 뜰 때 파싱된 uiAreas를 들고 있을 뿐이라, 그 뒤에 **디스크에 추가된
 *  슬롯을 모른다**. 저장할 때 통째로 써 버리면 그 슬롯이 조용히 사라진다 —
 *  /ui.html 쪽에서 powerGauge가 다섯 번, bgPanel이 두 번 이렇게 지워졌다(584dfdd).
 *
 *  그래서 **디스크를 기준으로 삼고** 아는 슬롯의 좌표만 갈아 끼운다.
 *  에디터에는 슬롯을 지우는 기능이 없으므로 모르는 슬롯은 남기는 것이 언제나 옳다. */
export function mergeAreas(disk: UiArea[], mine: UiArea[]): UiArea[] {
  if (disk.length === 0) return mine; // dev 서버 밖 — 비교할 디스크가 없다
  const byId = new Map(mine.map((a) => [a.id, new Map(a.slots.map((s) => [s.id, s]))]));
  return disk.map((area) => {
    const edited = byId.get(area.id);
    if (!edited) return area;
    return { ...area, slots: area.slots.map((s) => edited.get(s.id) ?? s) };
  });
}
```

그리고 `flushSave`의 body를 고친다:

```ts
    const cur = await fetch("/__uilayout").then((r) => (r.ok ? r.json() : {})) as Record<string, unknown>;
    const diskAreas = Array.isArray(cur.areas) ? (cur.areas as UiArea[]) : [];
    const res = await fetch("/__uilayout", {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ ...cur, areas: mergeAreas(diskAreas, uiAreas) }),
    });
```

- [ ] **Step 4: 통과를 확인한다**

Run: `npx vitest run src/ui/layoutEditor.merge.test.ts` → 4 passed
Run: `npm test` → 211 passed (기준선 207 + 4)

- [ ] **Step 5: 커밋**

```bash
git add src/ui/layoutEditor.ts src/ui/layoutEditor.merge.test.ts
git commit -m "fix: 인게임 에디터 저장도 교체에서 병합으로 — /ui.html과 같은 사고를 막는다"
```

---

## Task 2: 프로필에 최고기록과 부스터 재고를 넣는다

**Files:**
- Modify: `src/engine/profile.ts`
- Test: `tests/hex/profile.test.ts` (기존 파일에 추가)

**Interfaces:**
- Produces: `Profile.raceBest: Record<string, number>` · `Profile.boosters: Boosters`

- [ ] **Step 1: 실패하는 테스트를 쓴다**

`tests/hex/profile.test.ts` 맨 끝에 추가:

```ts
describe("레이스 필드", () => {
  it("빈 프로필에 raceBest와 boosters가 있다", () => {
    const p = emptyProfile();
    expect(p.raceBest).toEqual({});
    expect(p.boosters).toEqual({ bomb: 0, rainbow: 0, horseshoe: 0 });
  });

  it("두 필드가 없는 구 저장 데이터를 그대로 읽는다", () => {
    const old = JSON.stringify({ rescued: ["rabbit"], horseshoes: 5, stageIndex: 2 });
    const p = parseProfile(old);
    expect(p.rescued).toEqual(["rabbit"]);
    expect(p.horseshoes).toBe(5);
    expect(p.stageIndex).toBe(2);
    expect(p.raceBest).toEqual({});
    expect(p.boosters).toEqual({ bomb: 0, rainbow: 0, horseshoe: 0 });
  });

  it("기록과 재고를 왕복시킨다", () => {
    const p = { ...emptyProfile(), raceBest: { rabbit: 13.42 }, boosters: { bomb: 1, rainbow: 0, horseshoe: 2 } };
    expect(parseProfile(serializeProfile(p))).toEqual(p);
  });

  it("형태가 어긋난 값은 버린다", () => {
    const bad = JSON.stringify({ raceBest: { rabbit: "빠름", deer: -1, sheep: 9 }, boosters: { bomb: "셋" } });
    const p = parseProfile(bad);
    expect(p.raceBest).toEqual({ sheep: 9 });          // 문자열과 음수는 버린다
    expect(p.boosters).toEqual({ bomb: 0, rainbow: 0, horseshoe: 0 });
  });
});
```

`tests/hex/profile.test.ts` 상단 import에 `serializeProfile`이 없으면 추가한다.

- [ ] **Step 2: 실패를 확인한다**

Run: `npx vitest run tests/hex/profile.test.ts`
Expected: FAIL — `p.raceBest` is undefined

- [ ] **Step 3: 최소 구현**

`src/engine/profile.ts`:

```ts
import type { Boosters } from "./hex/types";

export interface Profile {
  rescued: string[];
  horseshoes: number;
  stageIndex: number;
  /** 동물 id → 최고기록(초). 기록이 없으면 키가 없다 */
  raceBest: Record<string, number>;
  /** 레이스로 번 부스터 재고 — 다음 스테이지 진입 때 실린다 */
  boosters: Boosters;
}

const noBoosters = (): Boosters => ({ bomb: 0, rainbow: 0, horseshoe: 0 });

export function emptyProfile(): Profile {
  return { rescued: [], horseshoes: 0, stageIndex: 0, raceBest: {}, boosters: noBoosters() };
}
```

`addClear`의 반환에 두 필드를 실어 보낸다 — 레이스 값이 스테이지 클리어로 날아가면 안 된다:

```ts
  return {
    rescued: next,
    horseshoes: p.horseshoes + horseshoes,
    stageIndex: p.stageIndex + 1,
    raceBest: p.raceBest,
    boosters: p.boosters,
  };
```

`parseProfile`에 파서 둘을 더한다(규약 3조 — 필드별 검증):

```ts
/** 동물 id → 기록(초). 유한한 양수만 남긴다 — 0초는 기록이 될 수 없다. */
function parseRaceBest(raw: unknown): Record<string, number> {
  const out: Record<string, number> = {};
  if (raw === null || typeof raw !== "object") return out;
  for (const [id, v] of Object.entries(raw as Record<string, unknown>)) {
    if (typeof v === "number" && Number.isFinite(v) && v > 0) out[id] = v;
  }
  return out;
}

/** 재고. 세 칸을 항상 채운다 — 없는 칸이 undefined면 화면이 NaN을 그린다. */
function parseBoosters(raw: unknown): Boosters {
  const o = (raw ?? {}) as Record<string, unknown>;
  const n = (v: unknown): number =>
    typeof v === "number" && Number.isFinite(v) ? Math.max(0, Math.floor(v)) : 0;
  return { bomb: n(o.bomb), rainbow: n(o.rainbow), horseshoe: n(o.horseshoe) };
}
```

`parseProfile`의 반환에 `raceBest: parseRaceBest(o.raceBest), boosters: parseBoosters(o.boosters)`를 더하고,
`catch`의 반환은 `emptyProfile()` 그대로 둔다.

- [ ] **Step 4: 통과를 확인한다**

Run: `npx vitest run tests/hex/profile.test.ts` → 10 passed
Run: `npm run build` → 통과 (`Profile`을 만드는 다른 자리가 없는지 tsc가 잡는다)

- [ ] **Step 5: 커밋**

```bash
git add src/engine/profile.ts tests/hex/profile.test.ts
git commit -m "feat: 프로필에 레이스 최고기록과 부스터 재고 — 구 저장 데이터는 그대로 읽힌다"
```

---

## Task 3: 튜닝 상수와 타입

**Files:**
- Create: `src/data/race.ts`
- Create: `src/engine/race/types.ts`

**Interfaces:**
- Produces: `RACE` 상수 객체 · `RunnerState` · `RaceState` · `RacePhase` · `RaceOutcome`

이 Task에는 테스트가 없다 — 상수와 타입뿐이라 검증할 동작이 없다. 다음 Task가 쓴다.

- [ ] **Step 1: 상수를 쓴다**

`src/data/race.ts`:

```ts
// data/race.ts — 레이스 튜닝 상수. 엔진과 UI가 같은 값을 각자 들면 밸런싱이 두 곳에서 어긋난다.
export const RACE = {
  /** 결승선까지 (m) */
  DISTANCE: 100,
  /** 걷기 보폭 / 질주 보폭 (m) */
  STRIDE_MIN: 0.8,
  STRIDE_MAX: 2.2,
  /** 분당 걸음 수 — 1초에 1탭 / 0.2초에 1탭 */
  SPM_WALK: 60,
  SPM_SPRINT: 300,
  /** 탭 간격 지수이동평균 계수 — 손가락 떨림을 걸러낸다 */
  GAP_SMOOTH: 0.5,
  /** 몸이 걸음을 따라잡는 속도 (1/s) */
  CATCHUP: 14,
  /** 리듬이 죽었다고 볼 간격 (s). 이보다 오래 안 누르면 spm이 사실상 0이다 */
  GAP_DEAD: 4,
  /** AI 페이스 범위 (m/s) */
  PACE_MIN: 4.0,
  PACE_MAX: 6.5,
  /** AI 리듬 변동 폭 · 막판 스퍼트 폭 */
  WOBBLE: 0.12,
  SPURT: 0.15,
  /** 화면 배율 — 450px 폭이 약 17m 시야가 된다 */
  PX_PER_M: 26,
  /** 내 러너가 서는 화면 x */
  CAMERA_X: 90,
  /** 배경 3층 스크롤 계수 */
  PARALLAX: { sky: 0.15, mid: 0.45, track: 1 },
  /** 카운트다운 길이 (s) */
  COUNTDOWN: 1.8,
  /** 랜덤 뽑기 가중 — 구출한 동물 : 못 구한 동물 */
  PICK_WEIGHT: { rescued: 3, locked: 1 },
} as const;
```

- [ ] **Step 2: 타입을 쓴다**

`src/engine/race/types.ts`:

```ts
// engine/race/types.ts — 레이스 상태. Pixi를 모른다(규약 5조 · 아키텍처).

/** 화면 단계. 한 화면 안에서 이것만 바뀐다. */
export type RacePhase = "roster" | "countdown" | "running" | "result";

/** 트랙 위 한 마리. x는 미터, 화면 좌표가 아니다. */
export interface RunnerState {
  /** data/animals.ts의 id */
  id: string;
  /** 레인 번호 0~5 — ANIMALS 순서 고정 */
  lane: number;
  /** 현재 위치 (m) */
  x: number;
  /** 걸음이 찍힌 목표 위치 (m). 절대 뒤로 가지 않는다 */
  targetX: number;
  /** 마지막 탭 간격 (s). 리듬의 기준이다 */
  lastGap: number;
  /** 마지막 탭 이후 흐른 시간 (s) */
  sinceTap: number;
  /** 분당 걸음 수 — lastGap과 sinceTap에서 파생된다. 애니메이션 상태도 이 값이 정한다 */
  spm: number;
  /** 결승 통과 시각 (s). 아직이면 null */
  finishedAt: number | null;
}

/** 레이스 한 판. */
export interface RaceState {
  phase: RacePhase;
  /** 시작부터 흐른 시간 (s) */
  t: number;
  /** 내가 조종하는 동물 id. roster 단계에서는 null */
  myId: string | null;
  runners: RunnerState[];
  /** AI 페이스 파라미터 — runner id → 값. 내 동물은 키가 없다 */
  ai: Record<string, AiPace>;
}

/** AI 한 마리의 페이스. 시작할 때 rng로 한 번 뽑고 그 뒤로는 시간의 함수다. */
export interface AiPace {
  /** 기본 속도 (m/s) */
  pace: number;
  /** 리듬 변동의 각속도와 위상 */
  w: number;
  phi: number;
}

/** 레이스가 끝나고 화면이 호출자에게 넘기는 것. */
export interface RaceOutcome {
  /** 설정창 HOME으로 나갔으면 "lobby" — 로비가 그 신호를 받아야 한다 */
  exit: "back" | "lobby";
}
```

- [ ] **Step 3: 타입 검사**

Run: `npm run build` → 통과

- [ ] **Step 4: 커밋**

```bash
git add src/data/race.ts src/engine/race/types.ts
git commit -m "feat: 레이스 튜닝 상수와 상태 타입"
```

---

## Task 4: 걸음 — 탭 1회가 한 걸음이다

**Files:**
- Create: `src/engine/race/step.ts`
- Test: `tests/race/step.test.ts`

**Interfaces:**
- Consumes: `RunnerState` (Task 3) · `RACE` (Task 3)
- Produces:
  - `export function makeRunner(id: string, lane: number): RunnerState`
  - `export function strideOf(spm: number): number`
  - `export function tapStep(r: RunnerState, gapSec: number): void`
  - `export function advance(r: RunnerState, dt: number): void`
  - `export function animState(spm: number): "idle" | "walk" | "run" | "sprint"`

`tapStep`은 **탭 간격(초)** 을 받는다. 시각을 받지 않는다 — 호출부가 `lastTapAt`을 들고
빼서 넘긴다. 순수 함수가 시계를 모르게 하려는 것이다. **밀리초를 넘기면 spm이 1000배가 된다.**

`spm`은 상태가 아니라 **파생값**이다:

```
spm = 60 / max(lastGap, sinceTap)
```

누르는 중에는 간격이, 손을 떼면 흐른 시간이 분모를 잡는다. 감쇠 상수가 따로 없어도
손을 떼면 `sinceTap`이 자라 리듬이 저절로 식는다. 이 형태라야 검산이 맞는다 —
초당 1탭 → 60 spm → 보폭 0.8 → **0.8 m/s**, 초당 3탭 → 180 spm → 1.5 → **4.5 m/s**,
초당 4탭 → 240 spm → 1.75 → **7.0 m/s**.

- [ ] **Step 1: 실패하는 테스트를 쓴다**

`tests/race/step.test.ts`:

```ts
// tests/race/step.test.ts — 탭 1회가 걸음 하나를 찍고 몸이 따라간다
import { describe, expect, it } from "vitest";
import { RACE } from "../../src/data/race";
import { advance, animState, makeRunner, strideOf, tapStep } from "../../src/engine/race/step";

/** 일정 간격으로 n번 탭하며 60fps로 굴린다. */
function run(r: ReturnType<typeof makeRunner>, gapSec: number, taps: number): void {
  for (let i = 0; i < taps; i++) {
    tapStep(r, gapSec);
    for (let s = 0; s < gapSec - 1e-9; s += 1 / 60) advance(r, 1 / 60);
  }
}

/** 안 누른 채 굴린다 */
function coast(r: ReturnType<typeof makeRunner>, sec: number): void {
  for (let s = 0; s < sec; s += 1 / 60) advance(r, 1 / 60);
}

describe("보폭", () => {
  it("걷기 리듬은 최소 보폭이다", () => {
    expect(strideOf(RACE.SPM_WALK)).toBeCloseTo(RACE.STRIDE_MIN, 10);
  });

  it("질주 리듬은 최대 보폭이다", () => {
    expect(strideOf(RACE.SPM_SPRINT)).toBeCloseTo(RACE.STRIDE_MAX, 10);
  });

  it("범위 밖은 잘린다", () => {
    expect(strideOf(0)).toBe(RACE.STRIDE_MIN);
    expect(strideOf(9999)).toBe(RACE.STRIDE_MAX);
  });
});

describe("걸음", () => {
  it("탭 한 번이 목표를 보폭만큼 앞으로 민다", () => {
    const r = makeRunner("rabbit", 0);
    tapStep(r, 1);
    expect(r.targetX).toBeCloseTo(RACE.STRIDE_MIN, 6);
  });

  it("스펙의 세 속도가 실제로 나온다", () => {
    const cases: Array<[number, number]> = [[1, 0.8], [1 / 3, 4.5], [0.25, 7.0]];
    for (const [gap, expected] of cases) {
      const r = makeRunner("a", 0);
      const taps = Math.round(12 / gap);          // 12초어치
      run(r, gap, taps);
      expect(r.targetX / (gap * taps)).toBeCloseTo(expected, 1);
    }
  });

  it("빨리 누를수록 보폭이 커진다", () => {
    const slow = makeRunner("a", 0);
    const fast = makeRunner("b", 1);
    run(slow, 1.0, 6);
    run(fast, 0.25, 6);
    expect(fast.targetX).toBeGreaterThan(slow.targetX * 2);
  });

  it("같은 탭 열은 항상 같은 결과를 낸다", () => {
    const a = makeRunner("a", 0);
    const b = makeRunner("b", 0);
    run(a, 0.3, 20);
    run(b, 0.3, 20);
    expect(a.x).toBeCloseTo(b.x, 10);
  });

  it("목표는 뒤로 가지 않는다", () => {
    const r = makeRunner("a", 0);
    run(r, 0.3, 10);
    const peak = r.targetX;
    coast(r, 5);
    expect(r.targetX).toBe(peak);
  });

  it("손을 떼면 리듬이 식고 몸이 목표에서 멈춘다", () => {
    const r = makeRunner("a", 0);
    run(r, 0.25, 10);
    expect(animState(r.spm)).toBe("sprint");
    coast(r, 5);
    expect(animState(r.spm)).toBe("idle");
    expect(r.x).toBeCloseTo(r.targetX, 3);
  });

  it("몸은 목표를 넘어가지 않는다", () => {
    const r = makeRunner("a", 0);
    run(r, 0.2, 30);
    expect(r.x).toBeLessThanOrEqual(r.targetX + 1e-9);
  });

  it("가만히 두면 리듬이 0에 수렴한다", () => {
    const r = makeRunner("a", 0);
    expect(r.spm).toBe(0);
    tapStep(r, 0.25);
    expect(r.spm).toBeGreaterThan(200);
    coast(r, 30);
    expect(r.spm).toBeLessThan(5);
  });

  it("간격이 0 이하면 무시한다 — 같은 프레임에 두 번 들어와도 안 터진다", () => {
    const r = makeRunner("a", 0);
    tapStep(r, 0);
    tapStep(r, -1);
    expect(r.targetX).toBe(0);
    expect(Number.isFinite(r.spm)).toBe(true);
  });

  it("애니메이션 상태가 spm으로 갈린다", () => {
    expect(animState(0)).toBe("idle");
    expect(animState(80)).toBe("walk");
    expect(animState(180)).toBe("run");
    expect(animState(260)).toBe("sprint");
  });
});
```

- [ ] **Step 2: 실패를 확인한다**

Run: `npx vitest run tests/race/step.test.ts`
Expected: FAIL — Cannot find module `../../src/engine/race/step`

- [ ] **Step 3: 최소 구현**

`src/engine/race/step.ts`:

```ts
// engine/race/step.ts — 탭은 속도에 더해지지 않는다. 걸음 하나를 앞에 찍고 몸이 따라간다.
//
// 천천히 누르면 몸이 매번 목표를 따라잡고 멈춰 **뚝뚝 끊기는 걷기**가 되고,
// 빨리 누르면 목표가 계속 달아나 몸이 못 따라잡은 채 **끊김 없는 달리기**가 된다.
// 수식 하나가 둘 다 만든다. 보폭까지 리듬에 비례하므로 「빨리 누를수록 더 빨리」가
// 걸음 수 × 보폭으로 두 번 걸린다.
//
// **spm은 상태가 아니라 파생값이다** — `60 / max(lastGap, sinceTap)`.
// 누르는 중에는 간격이, 손을 떼면 흐른 시간이 분모를 잡는다. 감쇠 상수를 따로 두면
// 그 감쇠가 연타 중에도 깎아 평형이 목표보다 낮게 잡힌다(초당 3탭에 4.5가 아니라 3.5가 나왔다).
import { RACE } from "../../data/race";
import type { RunnerState } from "./types";

const clamp01 = (v: number): number => (v < 0 ? 0 : v > 1 ? 1 : v);

/** 리듬이 죽은 상태의 간격. 0으로 두면 spm이 무한이 된다. */
const DEAD = RACE.GAP_DEAD;

function spmOf(r: RunnerState): number {
  const gap = Math.max(r.lastGap, r.sinceTap);
  return gap >= DEAD ? 0 : 60 / gap;
}

export function makeRunner(id: string, lane: number): RunnerState {
  return { id, lane, x: 0, targetX: 0, lastGap: DEAD, sinceTap: DEAD, spm: 0, finishedAt: null };
}

/** 지금 리듬에서의 보폭(m). 걷기 보폭과 질주 보폭 사이를 선형으로 오간다. */
export function strideOf(spm: number): number {
  const t = clamp01((spm - RACE.SPM_WALK) / (RACE.SPM_SPRINT - RACE.SPM_WALK));
  return RACE.STRIDE_MIN + (RACE.STRIDE_MAX - RACE.STRIDE_MIN) * t;
}

/**
 * 탭 한 번. `gapSec`은 **초 단위 탭 간격**이다.
 * 0 이하가 들어오면 무시한다 — 같은 프레임에 두 번 들어오면 spm이 무한이 된다.
 */
export function tapStep(r: RunnerState, gapSec: number): void {
  if (!(gapSec > 0)) return;
  // 간격을 평균낸다(spm이 아니라). 손가락 떨림은 걸러지고 리듬 변화는 따라간다.
  const g = Math.min(gapSec, DEAD);
  r.lastGap = r.sinceTap >= DEAD ? g : r.lastGap + (g - r.lastGap) * RACE.GAP_SMOOTH;
  r.sinceTap = 0;
  r.spm = spmOf(r);
  r.targetX += strideOf(r.spm);
}

/** 한 프레임. 안 누른 시간이 자라 리듬이 식고, 몸이 목표를 지수로 따라간다. */
export function advance(r: RunnerState, dt: number): void {
  if (dt <= 0) return;
  r.sinceTap += dt;
  r.spm = spmOf(r);
  r.x += (r.targetX - r.x) * (1 - Math.exp(-RACE.CATCHUP * dt));
}

/** 그림이 어떤 상태여야 하는가. 러너 렌더가 이 값만 본다. */
export function animState(spm: number): "idle" | "walk" | "run" | "sprint" {
  if (spm < 20) return "idle";
  if (spm < 120) return "walk";
  if (spm < 220) return "run";
  return "sprint";
}
```

- [ ] **Step 4: 통과를 확인한다**

Run: `npx vitest run tests/race/step.test.ts` → 14 passed

`스펙의 세 속도` 테스트가 이 Task의 핵심이다. 상수를 만질 때 이 테스트가 먼저 깨져야 한다.

- [ ] **Step 5: 커밋**

```bash
git add src/engine/race/step.ts tests/race/step.test.ts
git commit -m "feat: 걸음 — 탭이 목표를 밀고 몸이 지수로 따라간다"
```

---

## Task 5: AI 페이스

**Files:**
- Create: `src/engine/race/pace.ts`
- Test: `tests/race/pace.test.ts`

**Interfaces:**
- Consumes: `AiPace` `RunnerState` (Task 3) · `RACE` (Task 3)
- Produces:
  - `export function makeAiPace(rng: () => number): AiPace`
  - `export function aiSpeed(p: AiPace, t: number, progress: number): number`
  - `export function advanceAi(r: RunnerState, p: AiPace, t: number, dt: number): void`

- [ ] **Step 1: 실패하는 테스트를 쓴다**

`tests/race/pace.test.ts`:

```ts
// tests/race/pace.test.ts — AI는 순위와 연출만 책임진다. 보상과 무관하다.
import { describe, expect, it } from "vitest";
import { RACE } from "../../src/data/race";
import { advanceAi, aiSpeed, makeAiPace } from "../../src/engine/race/pace";
import { makeRunner } from "../../src/engine/race/step";

/** 고정 수열 rng — 같은 값을 넣으면 같은 AI가 나와야 한다 */
const seq = (vals: number[]): (() => number) => {
  let i = 0;
  return () => vals[i++ % vals.length]!;
};

describe("AI 페이스", () => {
  it("기본 속도가 범위 안에 있다", () => {
    for (const v of [0, 0.25, 0.5, 0.75, 0.999]) {
      const p = makeAiPace(seq([v]));
      expect(p.pace).toBeGreaterThanOrEqual(RACE.PACE_MIN);
      expect(p.pace).toBeLessThanOrEqual(RACE.PACE_MAX);
    }
  });

  it("같은 rng는 같은 AI를 만든다", () => {
    const a = makeAiPace(seq([0.3, 0.6, 0.9]));
    const b = makeAiPace(seq([0.3, 0.6, 0.9]));
    expect(a).toEqual(b);
  });

  it("진행률 0.8 전에는 스퍼트가 없다", () => {
    const p = { pace: 5, w: 1, phi: 0 };
    // 같은 t에서 진행률만 다르게 — 0.5와 0.79는 같아야 한다
    expect(aiSpeed(p, 3, 0.5)).toBeCloseTo(aiSpeed(p, 3, 0.79), 10);
  });

  it("결승 직전에는 빨라진다", () => {
    const p = { pace: 5, w: 1, phi: 0 };
    expect(aiSpeed(p, 3, 1)).toBeGreaterThan(aiSpeed(p, 3, 0.5));
  });

  it("속도가 항상 양수다", () => {
    const p = makeAiPace(seq([0, 0, 0]));
    for (let t = 0; t < 30; t += 0.1) expect(aiSpeed(p, t, t / 30)).toBeGreaterThan(0);
  });

  it("advanceAi가 러너를 앞으로만 민다", () => {
    const r = makeRunner("deer", 2);
    const p = makeAiPace(seq([0.5, 0.5, 0.5]));
    let last = 0;
    for (let t = 0; t < 10; t += 1 / 60) {
      advanceAi(r, p, t, 1 / 60);
      expect(r.x).toBeGreaterThanOrEqual(last);
      last = r.x;
    }
    expect(r.x).toBeGreaterThan(10);
  });
});
```

- [ ] **Step 2: 실패를 확인한다**

Run: `npx vitest run tests/race/pace.test.ts`
Expected: FAIL — Cannot find module `../../src/engine/race/pace`

- [ ] **Step 3: 최소 구현**

`src/engine/race/pace.ts`:

```ts
// engine/race/pace.ts — AI 5마리의 페이스.
//
// 변동이 있어야 중반에 순위가 뒤집히고, 막판 스퍼트가 있어야 결승선 앞이 조마조마하다.
// 둘 다 없으면 6마리가 출발 순서대로 들어와 화면이 죽는다.
//
// **보상 조건은 순위가 아니라 내 기록의 갱신이다.** 그래서 여기 상수를 잘못 잡아도
// 보상 규칙은 안 깨진다 — 밸런싱을 마지막으로 미룰 수 있다.
import { RACE } from "../../data/race";
import type { AiPace, RunnerState } from "./types";

const TAU = Math.PI * 2;

/** 시작할 때 한 번 뽑는다. rng를 정확히 3번 당긴다 — 테스트가 수열로 고정한다. */
export function makeAiPace(rng: () => number): AiPace {
  return {
    pace: RACE.PACE_MIN + rng() * (RACE.PACE_MAX - RACE.PACE_MIN),
    w: 0.7 + rng() * 0.8,
    phi: rng() * TAU,
  };
}

/** 진행률 p(0~1)에서의 속도(m/s). 0.8을 넘어서면 스퍼트가 붙는다. */
export function aiSpeed(p: AiPace, t: number, progress: number): number {
  const wobble = 1 + RACE.WOBBLE * Math.sin(p.w * t + p.phi);
  const spurt = progress < 0.8 ? 1 : 1 + RACE.SPURT * ((progress - 0.8) / 0.2);
  // WOBBLE < 1이라 wobble은 항상 양수다 — 뒤로 가는 일이 없다
  return p.pace * wobble * spurt;
}

/** 한 프레임. 진행률은 러너의 현재 위치에서 스스로 낸다. */
export function advanceAi(r: RunnerState, p: AiPace, t: number, dt: number): void {
  if (dt <= 0) return;
  const progress = Math.min(1, r.x / RACE.DISTANCE);
  r.x += aiSpeed(p, t, progress) * dt;
  r.targetX = r.x; // AI는 걸음 개념이 없다 — 렌더가 같은 필드를 봐도 되게 맞춰 둔다
}
```

- [ ] **Step 4: 통과를 확인한다**

Run: `npx vitest run tests/race/pace.test.ts` → 6 passed

- [ ] **Step 5: 커밋**

```bash
git add src/engine/race/pace.ts tests/race/pace.test.ts
git commit -m "feat: AI 페이스 — 리듬 변동과 막판 스퍼트"
```

---

## Task 6: 레이스 한 판 — 시작 · 진행 · 순위

**Files:**
- Create: `src/engine/race/raceRun.ts`
- Test: `tests/race/raceRun.test.ts`

**Interfaces:**
- Consumes: `RaceState` `RunnerState` (Task 3) · `makeRunner` `advance` (Task 4) · `makeAiPace` `advanceAi` (Task 5)
- Produces:
  - `export function pickAnimal(ids: readonly string[], rescued: readonly string[], rng: () => number): string`
  - `export function createRace(ids: readonly string[], myId: string, rng: () => number): RaceState`
  - `export function tickRace(s: RaceState, dt: number): void`
  - `export function tapRace(s: RaceState, dtSinceLastTap: number): void`
  - `export function isRaceOver(s: RaceState): boolean`
  - `export function ranking(s: RaceState): RunnerState[]`
  - `export function myTime(s: RaceState): number | null`

- [ ] **Step 1: 실패하는 테스트를 쓴다**

`tests/race/raceRun.test.ts`:

```ts
// tests/race/raceRun.test.ts — 6마리가 달리고 순위가 나온다
import { describe, expect, it } from "vitest";
import { RACE } from "../../src/data/race";
import {
  createRace, isRaceOver, myTime, pickAnimal, ranking, tapRace, tickRace,
} from "../../src/engine/race/raceRun";

const IDS = ["rabbit", "monkey", "deer", "sheep", "zebra", "elephant"] as const;
const seq = (vals: number[]): (() => number) => {
  let i = 0;
  return () => vals[i++ % vals.length]!;
};
const half = (): number => 0.5;

/** 아무도 안 누른 채 n초 굴린다 */
function coast(s: ReturnType<typeof createRace>, sec: number): void {
  for (let t = 0; t < sec; t += 1 / 60) tickRace(s, 1 / 60);
}

describe("동물 뽑기", () => {
  it("항상 6종 중에서 뽑는다", () => {
    expect(IDS).toContain(pickAnimal(IDS, [], half));
  });

  it("아무도 못 구했으면 전체가 후보다", () => {
    const got = new Set<string>();
    for (let i = 0; i < 60; i++) got.add(pickAnimal(IDS, [], seq([i / 60])));
    expect(got.size).toBe(6);
  });

  it("구출한 동물이 더 자주 뽑힌다", () => {
    let mine = 0;
    for (let i = 0; i < 100; i++) if (pickAnimal(IDS, ["rabbit"], seq([i / 100])) === "rabbit") mine++;
    // 가중 3 : 1 → 6마리 중 rabbit만 3, 나머지 5 → 3/8 ≈ 37.5%
    expect(mine).toBeGreaterThan(25);
    expect(mine).toBeLessThan(50);
  });
});

describe("레이스", () => {
  it("6마리가 레인 0~5에 선다", () => {
    const s = createRace(IDS, "deer", half);
    expect(s.runners).toHaveLength(6);
    expect(s.runners.map((r) => r.lane)).toEqual([0, 1, 2, 3, 4, 5]);
    expect(s.phase).toBe("countdown");
  });

  it("내 동물에는 AI 페이스가 없다", () => {
    const s = createRace(IDS, "deer", half);
    expect(s.ai.deer).toBeUndefined();
    expect(Object.keys(s.ai)).toHaveLength(5);
  });

  it("카운트다운이 끝나면 running으로 넘어간다", () => {
    const s = createRace(IDS, "deer", half);
    coast(s, RACE.COUNTDOWN + 0.1);
    expect(s.phase).toBe("running");
  });

  it("카운트다운 중에는 아무도 안 움직인다", () => {
    const s = createRace(IDS, "deer", half);
    coast(s, RACE.COUNTDOWN - 0.2);
    expect(s.runners.every((r) => r.x === 0)).toBe(true);
  });

  it("안 누르면 내 동물은 제자리다", () => {
    const s = createRace(IDS, "deer", half);
    coast(s, RACE.COUNTDOWN + 5);
    expect(s.runners.find((r) => r.id === "deer")!.x).toBe(0);
  });

  it("AI는 스스로 달려 결승에 든다", () => {
    const s = createRace(IDS, "deer", half);
    coast(s, RACE.COUNTDOWN + 40);
    expect(s.runners.filter((r) => r.id !== "deer").every((r) => r.finishedAt !== null)).toBe(true);
  });

  it("연타하면 내 동물이 완주하고 기록이 남는다", () => {
    const s = createRace(IDS, "deer", half);
    coast(s, RACE.COUNTDOWN + 0.1);
    for (let i = 0; i < 400 && !isRaceOver(s); i++) {
      tapRace(s, 0.2);
      for (let k = 0; k < 12; k++) tickRace(s, 1 / 60);
    }
    expect(isRaceOver(s)).toBe(true);
    expect(myTime(s)).toBeGreaterThan(0);
    expect(s.phase).toBe("result");
  });

  it("순위는 결승 통과 순이다", () => {
    const s = createRace(IDS, "deer", half);
    coast(s, RACE.COUNTDOWN + 60);
    const order = ranking(s);
    const times = order.map((r) => r.finishedAt ?? Infinity);
    expect([...times].sort((a, b) => a - b)).toEqual(times);
  });

  it("완주 전에는 끝나지 않는다", () => {
    const s = createRace(IDS, "deer", half);
    coast(s, RACE.COUNTDOWN + 5);
    expect(isRaceOver(s)).toBe(false);
    expect(myTime(s)).toBeNull();
  });

  it("결승을 넘은 뒤에는 더 안 움직인다", () => {
    const s = createRace(IDS, "deer", half);
    coast(s, RACE.COUNTDOWN + 60);
    const zebra = s.runners.find((r) => r.id === "zebra")!;
    const at = zebra.x;
    coast(s, 5);
    expect(zebra.x).toBe(at);
  });
});
```

- [ ] **Step 2: 실패를 확인한다**

Run: `npx vitest run tests/race/raceRun.test.ts`
Expected: FAIL — Cannot find module `../../src/engine/race/raceRun`

- [ ] **Step 3: 최소 구현**

`src/engine/race/raceRun.ts`:

```ts
// engine/race/raceRun.ts — 레이스 한 판. 시작 → 진행 → 순위.
//
// 단계는 상태 하나가 들고 있고 시간이 밀어 준다. 화면은 이 상태를 그리기만 한다.
import { RACE } from "../../data/race";
import { advanceAi, makeAiPace } from "./pace";
import { advance, makeRunner, tapStep } from "./step";
import type { AiPace, RaceState, RunnerState } from "./types";

/**
 * 달릴 동물을 뽑는다. 구출한 동물에 가중치를 준다 —
 * 아무도 못 구했으면 전체가 같은 무게라 6종 전부가 후보가 된다.
 */
export function pickAnimal(
  ids: readonly string[],
  rescued: readonly string[],
  rng: () => number,
): string {
  const has = new Set(rescued);
  const weights = ids.map((id) => (has.has(id) ? RACE.PICK_WEIGHT.rescued : RACE.PICK_WEIGHT.locked));
  const total = weights.reduce((a, b) => a + b, 0);
  let hit = rng() * total;
  for (let i = 0; i < ids.length; i++) {
    hit -= weights[i]!;
    if (hit < 0) return ids[i]!;
  }
  return ids[ids.length - 1]!; // rng가 1을 돌려줘도 빈손으로 나가지 않는다
}

/** 6마리를 레인에 세우고 AI 5마리의 페이스를 뽑는다. */
export function createRace(ids: readonly string[], myId: string, rng: () => number): RaceState {
  const runners = ids.map((id, lane) => makeRunner(id, lane));
  const ai: Record<string, AiPace> = {};
  for (const id of ids) if (id !== myId) ai[id] = makeAiPace(rng);
  return { phase: "countdown", t: 0, myId, runners, ai };
}

/** 이미 결승을 넘었나. 넘은 러너는 더 움직이지 않는다. */
const done = (r: RunnerState): boolean => r.finishedAt !== null;

function finishIfDue(r: RunnerState, t: number): void {
  if (!done(r) && r.x >= RACE.DISTANCE) {
    r.x = RACE.DISTANCE;
    r.finishedAt = t;
  }
}

/** 한 프레임. 카운트다운이 끝나기 전에는 아무도 안 움직인다. */
export function tickRace(s: RaceState, dt: number): void {
  if (dt <= 0 || s.phase === "result" || s.phase === "roster") return;
  s.t += dt;

  if (s.phase === "countdown") {
    if (s.t >= RACE.COUNTDOWN) s.phase = "running";
    return;
  }

  const raceT = s.t - RACE.COUNTDOWN;
  for (const r of s.runners) {
    if (done(r)) continue;
    const p = s.ai[r.id];
    if (p) advanceAi(r, p, raceT, dt);
    else advance(r, dt);
    finishIfDue(r, raceT);
  }
  if (s.runners.every(done)) s.phase = "result";
}

/** 내 동물의 걸음 한 번. running이 아니면 무시한다. */
export function tapRace(s: RaceState, dtSinceLastTap: number): void {
  if (s.phase !== "running" || s.myId === null) return;
  const me = s.runners.find((r) => r.id === s.myId);
  if (!me || done(me)) return;
  tapStep(me, dtSinceLastTap);
}

export function isRaceOver(s: RaceState): boolean {
  return s.runners.every(done);
}

/** 결승 통과 순. 아직 못 들어온 러너는 뒤로 간다. */
export function ranking(s: RaceState): RunnerState[] {
  return [...s.runners].sort((a, b) => (a.finishedAt ?? Infinity) - (b.finishedAt ?? Infinity));
}

/** 내 기록(초). 아직 못 들어왔으면 null. */
export function myTime(s: RaceState): number | null {
  return s.runners.find((r) => r.id === s.myId)?.finishedAt ?? null;
}
```

- [ ] **Step 4: 통과를 확인한다**

Run: `npx vitest run tests/race/raceRun.test.ts` → 12 passed
Run: `npm test` → 기존 207 + 신규 전부 통과

- [ ] **Step 5: 커밋**

```bash
git add src/engine/race/raceRun.ts tests/race/raceRun.test.ts
git commit -m "feat: 레이스 한 판 — 뽑기·카운트다운·주행·순위"
```

---

## Task 7: 보상 — 자기 기록을 깨야 나온다

**Files:**
- Create: `src/engine/race/reward.ts`
- Test: `tests/race/reward.test.ts`

**Interfaces:**
- Consumes: `Profile` (Task 2)
- Produces:
  - `export interface RaceReward { improved: boolean; previous: number | null; booster: BoosterId | null }`
  - `export function settleRace(p: Profile, animalId: string, time: number, rng: () => number): { profile: Profile; reward: RaceReward }`

`settleRace`는 **프로필을 변형하지 않고 새 것을 돌려준다** — `addClear`와 같은 방식이다.

- [ ] **Step 1: 실패하는 테스트를 쓴다**

`tests/race/reward.test.ts`:

```ts
// tests/race/reward.test.ts — 보상은 순위가 아니라 자기 기록의 갱신에 걸린다
import { describe, expect, it } from "vitest";
import { emptyProfile } from "../../src/engine/profile";
import { settleRace } from "../../src/engine/race/reward";

const half = (): number => 0.5;

describe("보상", () => {
  it("첫 기록은 갱신이고 부스터가 하나 나온다", () => {
    const { profile, reward } = settleRace(emptyProfile(), "deer", 18.5, half);
    expect(reward.improved).toBe(true);
    expect(reward.previous).toBeNull();
    expect(reward.booster).not.toBeNull();
    expect(profile.raceBest.deer).toBe(18.5);
    const total = profile.boosters.bomb + profile.boosters.rainbow + profile.boosters.horseshoe;
    expect(total).toBe(1);
  });

  it("더 빠르면 갱신하고 또 준다", () => {
    const p0 = { ...emptyProfile(), raceBest: { deer: 20 } };
    const { profile, reward } = settleRace(p0, "deer", 17.25, half);
    expect(reward.improved).toBe(true);
    expect(reward.previous).toBe(20);
    expect(profile.raceBest.deer).toBe(17.25);
  });

  it("느리면 아무것도 주지 않고 기록도 그대로다", () => {
    const p0 = { ...emptyProfile(), raceBest: { deer: 15 }, boosters: { bomb: 2, rainbow: 0, horseshoe: 0 } };
    const { profile, reward } = settleRace(p0, "deer", 19, half);
    expect(reward.improved).toBe(false);
    expect(reward.booster).toBeNull();
    expect(reward.previous).toBe(15);
    expect(profile.raceBest.deer).toBe(15);
    expect(profile.boosters).toEqual({ bomb: 2, rainbow: 0, horseshoe: 0 });
  });

  it("같은 기록은 갱신이 아니다", () => {
    const p0 = { ...emptyProfile(), raceBest: { deer: 15 } };
    expect(settleRace(p0, "deer", 15, half).reward.improved).toBe(false);
  });

  it("동물마다 기록이 따로 쌓인다", () => {
    const a = settleRace(emptyProfile(), "deer", 18, half).profile;
    const b = settleRace(a, "zebra", 25, half).profile;
    expect(b.raceBest).toEqual({ deer: 18, zebra: 25 });
  });

  it("rng가 부스터 종류를 정한다", () => {
    const pick = (v: number): string | null =>
      settleRace(emptyProfile(), "deer", 10, () => v).reward.booster;
    expect(pick(0)).toBe("bomb");
    expect(pick(0.5)).toBe("rainbow");
    expect(pick(0.99)).toBe("horseshoe");
  });

  it("원래 프로필을 건드리지 않는다", () => {
    const p0 = emptyProfile();
    settleRace(p0, "deer", 10, half);
    expect(p0.raceBest).toEqual({});
    expect(p0.boosters).toEqual({ bomb: 0, rainbow: 0, horseshoe: 0 });
  });
});
```

- [ ] **Step 2: 실패를 확인한다**

Run: `npx vitest run tests/race/reward.test.ts`
Expected: FAIL — Cannot find module `../../src/engine/race/reward`

- [ ] **Step 3: 최소 구현**

`src/engine/race/reward.ts`:

```ts
// engine/race/reward.ts — 기록 갱신 판정과 보상.
//
// 보상 조건이 **자기 기록의 갱신**이라 반복 파밍이 규칙 안에서 닫힌다.
// 첫 기록도 갱신으로 치므로 동물마다 1회는 확정 보상이고(6마리 = 최소 6개),
// 그 뒤부터는 자기를 이겨야 한다. 별도 횟수 제한이 필요 없다.
//
// 순위는 보지 않는다 — AI 밸런싱이 틀려도 이 규칙은 안 깨진다.
import type { BoosterId } from "../hex/boosters";
import type { Profile } from "../profile";

export interface RaceReward {
  improved: boolean;
  /** 직전 최고기록(초). 첫 기록이면 null */
  previous: number | null;
  /** 갱신했을 때 나온 부스터. 아니면 null */
  booster: BoosterId | null;
}

const KINDS: readonly BoosterId[] = ["bomb", "rainbow", "horseshoe"];

/** 한 판을 정산한다. 프로필을 변형하지 않고 새 것을 돌려준다(addClear와 같은 방식). */
export function settleRace(
  p: Profile,
  animalId: string,
  time: number,
  rng: () => number = Math.random,
): { profile: Profile; reward: RaceReward } {
  const previous = p.raceBest[animalId] ?? null;
  const improved = previous === null || time < previous;

  if (!improved) {
    return { profile: p, reward: { improved: false, previous, booster: null } };
  }

  const i = Math.min(KINDS.length - 1, Math.floor(rng() * KINDS.length));
  const booster = KINDS[i]!;
  return {
    profile: {
      ...p,
      raceBest: { ...p.raceBest, [animalId]: time },
      boosters: { ...p.boosters, [booster]: p.boosters[booster] + 1 },
    },
    reward: { improved: true, previous, booster },
  };
}
```

- [ ] **Step 4: 통과를 확인한다**

Run: `npx vitest run tests/race/reward.test.ts` → 7 passed

- [ ] **Step 5: 커밋**

```bash
git add src/engine/race/reward.ts tests/race/reward.test.ts
git commit -m "feat: 보상 — 자기 최고기록을 깼을 때만 부스터가 나온다"
```

---

## Task 8: 번 부스터를 스테이지에 싣는다

**Files:**
- Modify: `src/engine/hex/stageRun.ts:13`
- Modify: `src/ui/hex/stageScreen.ts:129` 및 `runStageScreen` 시그니처
- Modify: `src/main.ts` (스테이지 진입 블록)
- Test: `tests/hex/stageRunBoosters.test.ts`

**Interfaces:**
- Consumes: `Boosters` (`engine/hex/types.ts`)
- Produces: `createRun(stage, rng?, stock?)` · `runStageScreen(app, stage, stageIndex, textures, ui?, stock?)`

- [ ] **Step 1: 실패하는 테스트를 쓴다**

`tests/hex/stageRunBoosters.test.ts`:

```ts
// tests/hex/stageRunBoosters.test.ts — 레이스로 번 부스터가 판에 실린다
import { describe, expect, it } from "vitest";
import { createRun } from "../../src/engine/hex/stageRun";
import { stages } from "../../src/data/stages";

const stage = stages[0]!;

describe("부스터 재고", () => {
  it("아무것도 안 넘기면 기본 재고다", () => {
    expect(createRun(stage).boosters).toEqual({ bomb: 3, rainbow: 2, horseshoe: 1 });
  });

  it("넘긴 재고가 그대로 실린다", () => {
    const run = createRun(stage, Math.random, { bomb: 4, rainbow: 2, horseshoe: 3 });
    expect(run.boosters).toEqual({ bomb: 4, rainbow: 2, horseshoe: 3 });
  });

  it("재고 객체를 공유하지 않는다", () => {
    const stock = { bomb: 1, rainbow: 1, horseshoe: 1 };
    const run = createRun(stage, Math.random, stock);
    run.boosters.bomb = 99;
    expect(stock.bomb).toBe(1);
  });
});
```

- [ ] **Step 2: 실패를 확인한다**

Run: `npx vitest run tests/hex/stageRunBoosters.test.ts`
Expected: FAIL — 두 번째 테스트에서 `{bomb:3,...}`이 나온다

- [ ] **Step 3: 최소 구현**

`src/engine/hex/stageRun.ts` — import에 `Boosters`를 더하고 `createRun`을 고친다:

```ts
/** 스테이지 정의로 새 런을 만든다.
 *  `rng`는 발사체 색 추첨에만 쓴다 — 테스트가 고정값을 넣을 수 있도록 주입받는다.
 *  `stock`은 이 판에 실을 부스터다. 기본값이 지금까지의 하드코딩 값이라
 *  안 넘기는 호출부는 그대로 동작한다. */
export function createRun(
  stage: StageDef,
  rng: () => number = Math.random,
  stock: Boosters = { bomb: 3, rainbow: 2, horseshoe: 1 },
): RunState {
  const cells = buildCells(stage);
  return {
    stage,
    cells,
    shotsLeft: stage.shots,
    rescued: [],
    horseshoes: 0,
    boosters: { ...stock }, // 호출부의 객체를 판이 깎으면 안 된다
    loaded: pickNext(cells, rng),
    next: pickNext(cells, rng),
  };
}
```

`src/ui/hex/stageScreen.ts` — 시그니처 끝에 인자를 더하고 `createRun`에 넘긴다:

```ts
export async function runStageScreen(
  app: Application,
  stage: StageDef,
  stageIndex: number,
  textures: StageTextures,
  ui: StageUiTextures = {},
  stock?: import("../../engine/hex/types").Boosters,
): Promise<StageOutcome> {
  const state: RunState = createRun(stage, Math.random, stock);
```

`src/main.ts` — 스테이지 진입 블록에서 재고를 실어 보내고 즉시 비운다:

```ts
    // 레이스로 번 부스터는 이 판에 전부 실린다. 진입 즉시 비워서 다음 판에 또 실리지 않게 한다 —
    // 남은 것을 돌려주기 시작하면 결과 화면과 저장 양쪽에서 재고를 관리해야 한다.
    const earned = profile.boosters;
    const stock = {
      bomb: 3 + earned.bomb,
      rainbow: 2 + earned.rainbow,
      horseshoe: 1 + earned.horseshoe,
    };
    if (earned.bomb + earned.rainbow + earned.horseshoe > 0) {
      profile = { ...profile, boosters: { bomb: 0, rainbow: 0, horseshoe: 0 } };
      save();
    }

    const outcome = await runStageScreen(app, stage, profile.stageIndex, hexTextures, ui, stock);
```

- [ ] **Step 4: 통과를 확인한다**

Run: `npx vitest run tests/hex/stageRunBoosters.test.ts` → 3 passed
Run: `npm run build` → 통과
Run: `npm test` → 기존 207 포함 전부 통과

- [ ] **Step 5: 커밋**

```bash
git add src/engine/hex/stageRun.ts src/ui/hex/stageScreen.ts src/main.ts tests/hex/stageRunBoosters.test.ts
git commit -m "feat: 레이스로 번 부스터를 스테이지에 싣는다 — 진입 시 전액 소비"
```

---

## Task 9: 배치와 에셋 매니페스트

여기서 `race` 영역이 JSON에 들어간다. Task 1이 끝나 있어야 한다.

**Files:**
- Modify: `src/data/uiLayout.json`
- Modify: `src/data/assets.json`
- Modify: `src/data/hexAssets.ts` (`LOBBY_SLOT_IDS` · `AUDIO_SLOT_IDS`)
- Create: `src/data/raceAssets.ts`
- Test: `src/data/raceAssets.test.ts`

**Interfaces:**
- Produces: `export interface RaceAssetPaths` · `export const raceAssetPaths: RaceAssetPaths` · `export const RACE_SLOT_IDS`

- [ ] **Step 1: 배치 JSON을 고친다**

`src/data/uiLayout.json`:

1. `areas` → `lobby`의 `navWorld` 슬롯에서 `"id": "navWorld"` → `"navRace"`,
   `"label": "WORLD"` → `"RACE"`, `"asset": "lobby.navWorld"` → `"lobby.navRace"`.
   **좌표 `x:122, y:738, w:96, h:50`은 건드리지 않는다** — 하단 4칸 간격이 아트와 맞춰져 있다.

2. `areas` 배열 끝에 영역을 추가한다:

```json
{
  "id": "race",
  "label": "레이스",
  "slots": [
    { "id": "back",        "label": "돌아가기",           "x": 14,  "y": 12,  "w": 44,  "h": 40,  "asset": "race.ui.back" },
    { "id": "gear",        "label": "설정",               "x": 400, "y": 10,  "w": 40,  "h": 40,  "asset": "ui.gear" },
    { "id": "titleBanner", "label": "운동회 현수막",       "x": 105, "y": 64,  "w": 240, "h": 52,  "asset": "race.ui.titleBanner" },
    { "id": "myRunnerTag", "label": "내 선수 이름",        "x": 125, "y": 126, "w": 200, "h": 40 },
    { "id": "trackArea",   "label": "트랙 영역(6레인)",    "x": 12,  "y": 344, "w": 426, "h": 336 },
    { "id": "rosterHint",  "label": "안내 문구",           "x": 100, "y": 662, "w": 250, "h": 26 },
    { "id": "pick",        "label": "동물 뽑기",           "x": 123, "y": 700, "w": 204, "h": 72,  "asset": "race.ui.pick" },
    { "id": "countdown",   "label": "카운트다운 숫자",      "x": 165, "y": 352, "w": 120, "h": 150 },
    { "id": "hudRank",     "label": "현재 순위",           "x": 14,  "y": 20,  "w": 116, "h": 38 },
    { "id": "hudTime",     "label": "경과 시간",           "x": 250, "y": 20,  "w": 140, "h": 38 },
    { "id": "distBar",     "label": "주행 게이지",         "x": 14,  "y": 70,  "w": 422, "h": 14,  "asset": "race.ui.distBar" },
    { "id": "run",         "label": "RUN (연타)",          "x": 105, "y": 694, "w": 240, "h": 84,  "asset": "race.ui.run", "assetOff": "race.ui.runPressed", "states": ["기본", "눌림"] },
    { "id": "resultPanel", "label": "결과 패널",           "x": 40,  "y": 138, "w": 370, "h": 522, "asset": "race.ui.resultPanel" },
    { "id": "resultTitle", "label": "결과 제목",           "x": 100, "y": 170, "w": 250, "h": 46 },
    { "id": "resultList",  "label": "순위 6행",            "x": 68,  "y": 232, "w": 314, "h": 264 },
    { "id": "bestTag",     "label": "최고기록 갱신 배지",   "x": 143, "y": 506, "w": 164, "h": 34,  "asset": "race.ui.bestTag" },
    { "id": "rewardIcon",  "label": "보상 부스터 아이콘",   "x": 152, "y": 548, "w": 58,  "h": 58 },
    { "id": "rewardLabel", "label": "보상 이름",           "x": 220, "y": 562, "w": 150, "h": 30 },
    { "id": "retry",       "label": "다시 달리기",         "x": 62,  "y": 608, "w": 148, "h": 52,  "asset": "race.ui.retry" },
    { "id": "close",       "label": "로비로",              "x": 240, "y": 608, "w": 148, "h": 52,  "asset": "race.ui.close" }
  ]
}
```

3. `uploads` 배열 끝에 14항목을 추가한다:

```json
{ "group": "레이스 배경", "label": "하늘 (가로 반복)",       "asset": "race.bg.sky" },
{ "group": "레이스 배경", "label": "중경 관중석 (가로 반복)", "asset": "race.bg.mid" },
{ "group": "레이스 배경", "label": "트랙 바닥 (가로 반복)",   "asset": "race.bg.track" },
{ "group": "레이스 배경", "label": "출발 게이트",            "asset": "race.bg.startGate" },
{ "group": "레이스 배경", "label": "결승선 배너",            "asset": "race.bg.finish" },
{ "group": "레이스 러너", "label": "달리기 · 토끼",   "asset": "race.runners.rabbit",   "seq": true },
{ "group": "레이스 러너", "label": "달리기 · 원숭이", "asset": "race.runners.monkey",   "seq": true },
{ "group": "레이스 러너", "label": "달리기 · 사슴",   "asset": "race.runners.deer",     "seq": true },
{ "group": "레이스 러너", "label": "달리기 · 양",     "asset": "race.runners.sheep",    "seq": true },
{ "group": "레이스 러너", "label": "달리기 · 얼룩말", "asset": "race.runners.zebra",    "seq": true },
{ "group": "레이스 러너", "label": "달리기 · 코끼리", "asset": "race.runners.elephant", "seq": true },
{ "group": "부스터 아이콘", "label": "부스터 · 폭탄",     "asset": "hex.booster.bomb" },
{ "group": "부스터 아이콘", "label": "부스터 · 레인보우", "asset": "hex.booster.rainbow" },
{ "group": "부스터 아이콘", "label": "부스터 · 말굽",     "asset": "hex.booster.horseshoe" }
```

4. `audios` 배열 끝에 6항목을 추가한다:

```json
{ "label": "레이스 BGM",   "asset": "audio.bgmRace" },
{ "label": "출발 휘슬",     "asset": "audio.sfxWhistle" },
{ "label": "걸음",          "asset": "audio.sfxStep" },
{ "label": "룰렛 틱",       "asset": "audio.sfxRouletteTick" },
{ "label": "결승 통과",     "asset": "audio.sfxFinish" },
{ "label": "기록 갱신",     "asset": "audio.sfxRecord" }
```

- [ ] **Step 2: 에셋 매니페스트를 고친다**

`src/data/assets.json`:

1. `lobby` 블록의 `"navWorld": "assets/lobby/nav-world.webp"` →
   `"navRace": "assets/lobby/nav-race.webp"`
2. `hex` 블록에 `"booster": { "bomb": "assets/hex/booster-bomb.png", "rainbow": "assets/hex/booster-rainbow.png", "horseshoe": "assets/hex/booster-horseshoe.png" }` 추가
3. 최상위에 `race` 노드 추가:

```json
"race": {
  "bg": {
    "sky": "assets/race/bg-sky.webp",
    "mid": "assets/race/bg-mid.webp",
    "track": "assets/race/bg-track.webp",
    "startGate": "assets/race/start-gate.png",
    "finish": "assets/race/finish.png"
  },
  "runners": {
    "rabbit": "assets/race/run-rabbit.png",
    "monkey": "assets/race/run-monkey.png",
    "deer": "assets/race/run-deer.png",
    "sheep": "assets/race/run-sheep.png",
    "zebra": "assets/race/run-zebra.png",
    "elephant": "assets/race/run-elephant.png"
  },
  "ui": {
    "back": "assets/race/ui-back.png",
    "titleBanner": "assets/race/ui-title.png",
    "pick": "assets/race/ui-pick.png",
    "distBar": "assets/race/ui-distbar.png",
    "run": "assets/race/ui-run.png",
    "runPressed": "assets/race/ui-run-pressed.png",
    "resultPanel": "assets/race/ui-result.png",
    "bestTag": "assets/race/ui-best.png",
    "retry": "assets/race/ui-retry.png",
    "close": "assets/race/ui-close.png"
  }
}
```

- [ ] **Step 3: 실패하는 테스트를 쓴다**

`src/data/raceAssets.test.ts`:

```ts
// 매니페스트 파서 — 디자이너 오투입이 화면이 아니라 여기서 드러나야 한다(규약 3조)
import { describe, expect, it } from "vitest";
import { parseRaceAssets, raceAssetPaths } from "./raceAssets";

describe("레이스 매니페스트", () => {
  it("현재 매니페스트에서 3층 배경과 러너 6종을 읽는다", () => {
    expect(raceAssetPaths.bg.sky).toBeTruthy();
    expect(Object.keys(raceAssetPaths.runners)).toHaveLength(6);
  });

  it("race 노드가 없으면 빈 결과를 낸다 — 던지지 않는다", () => {
    const out = parseRaceAssets({});
    expect(out.bg).toEqual({});
    expect(out.runners).toEqual({});
    expect(out.ui).toEqual({});
  });

  it("빈 문자열과 잘못된 타입을 버린다", () => {
    const out = parseRaceAssets({ race: { bg: { sky: "", mid: 3, track: "t.webp" }, runners: { deer: [] } } });
    expect(out.bg.sky).toBeUndefined();
    expect(out.bg.mid).toBeUndefined();
    expect(out.bg.track).toBe("t.webp");
    expect(out.runners.deer).toBeUndefined(); // 프레임이 0장이면 키가 빠진다
  });

  it("러너는 한 장이든 여러 장이든 프레임 목록이 된다", () => {
    const out = parseRaceAssets({ race: { runners: { deer: "a.png", zebra: ["a.png", "b.png"] } } });
    expect(out.runners.deer).toEqual(["a.png"]);
    expect(out.runners.zebra).toEqual(["a.png", "b.png"]);
  });
});
```

- [ ] **Step 4: 실패를 확인한다**

Run: `npx vitest run src/data/raceAssets.test.ts`
Expected: FAIL — Cannot find module `./raceAssets`

- [ ] **Step 5: 파서를 쓴다**

`src/data/raceAssets.ts`:

```ts
// data/raceAssets.ts — 레이스가 쓰는 에셋 경로. assets.json을 필드별로 검증한다(규약 3조).
// 파일이 public/ 아래 없으면 화면이 폴백을 그린다 — 아트 0장으로도 레이스는 끝까지 돈다.
import manifestJson from "./assets.json";

export interface RaceAssetPaths {
  /** 배경 3층과 게이트·결승선. 3층은 가로로 이어 붙여 무한 스크롤한다 */
  bg: { sky?: string; mid?: string; track?: string; startGate?: string; finish?: string };
  /** 동물 id → 달리기 시퀀스. 한 장만 넣으면 스틸로 동작한다 */
  runners: Record<string, string[]>;
  ui: Partial<Record<RaceUiAssetId, string>>;
}

export const RACE_UI_ASSET_IDS = [
  "back", "titleBanner", "pick", "distBar", "run", "runPressed",
  "resultPanel", "bestTag", "retry", "close",
] as const;
export type RaceUiAssetId = (typeof RACE_UI_ASSET_IDS)[number];

/** 화면이 좌표를 찾을 때 쓰는 슬롯 id. uiLayout.json의 race 영역과 같아야 한다. */
export const RACE_SLOT_IDS = [
  "back", "gear", "titleBanner", "myRunnerTag", "trackArea", "rosterHint", "pick",
  "countdown", "hudRank", "hudTime", "distBar", "run",
  "resultPanel", "resultTitle", "resultList", "bestTag", "rewardIcon", "rewardLabel", "retry", "close",
] as const;
export type RaceSlotId = (typeof RACE_SLOT_IDS)[number];

const str = (v: unknown): string | undefined =>
  typeof v === "string" && v.length > 0 ? v : undefined;

const frames = (v: unknown): string[] => {
  if (Array.isArray(v)) return v.map(str).filter((x): x is string => x !== undefined);
  const one = str(v);
  return one ? [one] : [];
};

export function parseRaceAssets(raw: unknown): RaceAssetPaths {
  const race = ((raw ?? {}) as { race?: Record<string, unknown> }).race ?? {};
  const bgRaw = (race.bg ?? {}) as Record<string, unknown>;
  const uiRaw = (race.ui ?? {}) as Record<string, unknown>;

  const runners: Record<string, string[]> = {};
  for (const [id, v] of Object.entries((race.runners ?? {}) as Record<string, unknown>)) {
    const f = frames(v);
    // 빈 배열을 남기면 화면이 「아트 있음」으로 오판한다 — 길이로 판단하기 때문
    if (f.length > 0) runners[id] = f;
  }

  const ui: Partial<Record<RaceUiAssetId, string>> = {};
  for (const k of RACE_UI_ASSET_IDS) {
    const v = str(uiRaw[k]);
    if (v) ui[k] = v;
  }

  const bg: RaceAssetPaths["bg"] = {};
  for (const k of ["sky", "mid", "track", "startGate", "finish"] as const) {
    const v = str(bgRaw[k]);
    if (v) bg[k] = v;
  }

  return { bg, runners, ui };
}

export const raceAssetPaths: RaceAssetPaths = parseRaceAssets(manifestJson);

/** 부스터 아이콘 — 인게임이 소유하고 레이스가 참조한다. */
export const boosterAssetPaths: Partial<Record<"bomb" | "rainbow" | "horseshoe", string>> = (() => {
  const src = (((manifestJson as Record<string, unknown>).hex ?? {}) as Record<string, unknown>).booster;
  const out: Partial<Record<"bomb" | "rainbow" | "horseshoe", string>> = {};
  for (const k of ["bomb", "rainbow", "horseshoe"] as const) {
    const v = str((src as Record<string, unknown> | undefined)?.[k]);
    if (v) out[k] = v;
  }
  return out;
})();
```

- [ ] **Step 6: 기존 상수를 고친다**

`src/data/hexAssets.ts`:

- `LOBBY_SLOT_IDS`에서 `"navWorld"` → `"navRace"`
- `AUDIO_SLOT_IDS` 끝에 추가: `"bgmRace", "sfxWhistle", "sfxStep", "sfxRouletteTick", "sfxFinish", "sfxRecord"`

- [ ] **Step 7: 통과를 확인한다**

Run: `npx vitest run src/data/raceAssets.test.ts` → 4 passed
Run: `npm run build` → **FAIL 예상** — `lobbyScreen.ts`가 아직 `tex.icons.navWorld`를 본다. Task 10에서 고친다.
Run: `npm test` → 통과

빌드가 깨진 채로 커밋하지 않기 위해, Step 8은 Task 10을 끝낸 뒤에 한다.

- [ ] **Step 8: Task 10과 함께 커밋한다**

---

## Task 10: 로비 버튼을 RACE로 바꾸고 화면을 연다

**Files:**
- Create: `src/ui/race/raceScreen.ts`
- Create: `src/ui/race/trackView.ts`
- Create: `src/ui/race/runnerView.ts`
- Create: `src/ui/race/rosterView.ts`
- Create: `src/ui/race/raceResultView.ts`
- Modify: `src/ui/lobbyScreen.ts`
- Modify: `src/main.ts` (레이스 텍스처 로드)

**Interfaces:**
- Consumes: 모든 앞선 Task
- Produces: `export function openRace(parent, tex, profile, onProfile): Promise<RaceOutcome>`

이 Task는 렌더라 자동 테스트가 없다. **검증은 브라우저에서 한다** — 마지막 Step의 체크리스트가
그 역할이다. 규약 1조에 따라 파일마다 200줄을 넘기지 않는다.

- [ ] **Step 1: `trackView.ts` — 배경 3층과 레인**

폴백이 핵심이다. **단색이면 배경이 흐르는지 알 수 없고, 그러면 달리는 느낌 자체가 사라진다.**
중경은 일정 간격 사각형(관중석), 트랙은 10m마다 흰 세로선(거리 마커)을 절차적으로 그린다.

`createTrackView({ box, tex })`가 `{ node, update(cameraM), laneY(lane) }`를 돌려주게 한다.
`box`는 `trackArea` 슬롯, `tex`는 `{ sky?, mid?, track?, finish? }`. **`../../data`를 import하지 않는다.**

- [ ] **Step 2: `runnerView.ts` — 러너 한 마리**

`createRunnerView({ frames, glyph, size })` → `{ node, update(screenX, y, spm) }`.
아트가 없으면 로비 `friend()`와 같은 원형 + 글리프. 걸음 애니는 상하 바운스와 좌우 기울기이고
**진폭을 `spm`에 비례**시킨다 — 시퀀스가 0장이어도 걷기와 질주가 눈으로 갈린다.
`animState`를 import해 프레임 재생 속도를 정한다.

- [ ] **Step 3: `rosterView.ts` — 뽑기 룰렛**

`createRoster({ lanes, onDone })` → `{ node, spin(targetLane) }`.
**결과를 먼저 받고 연출만 재생한다** — 연출 프레임 수가 결과를 바꾸면 테스트가 불가능해진다.
하이라이트가 레인을 훑다가 감속해 `targetLane`에서 멎으면 `onDone()`.

- [ ] **Step 4: `raceResultView.ts` — 결과 패널**

`createRaceResult({ slots, tex, ranking, myId, reward, onRetry, onClose })` → `Container`.
`reward.improved`가 false면 `bestTag`·`rewardIcon`·`rewardLabel`을 `visible = false`로 둔다.

- [ ] **Step 5: `raceScreen.ts` — 조립**

이 파일 **하나만** `../../data`를 읽는다(규약 2조). 상태는 클로저 안 객체 하나(규약 4조):

```ts
const screen = { race: null as RaceState | null, lastTapAt: 0, closed: false };
```

`app.ticker`에 함수를 붙이고, 닫을 때 `ticker.remove(...)` → `clearEditable("race")` →
`root.destroy({ children: true })` 순으로 끊는다. **부모 노드 존재로 살아 있는지 추측하지 않는다.**

RUN 버튼은 `pointerdown`으로 받는다 — `pointertap`은 모바일에서 연타가 씹힌다.
탭 간격은 `performance.now()`로 재서 초로 바꿔 `tapRace(s, sec)`에 넘긴다.
첫 탭은 간격이 없으므로 `screen.lastTapAt === 0`이면 `1 / RACE.SPM_WALK * 60`(=1초)로 친다.

- [ ] **Step 6: 로비 배선**

`src/ui/lobbyScreen.ts`:

```ts
import { openRace } from "./race/raceScreen";
```

`openWorld` import를 지우고, `navWorld` 블록을 갈아 끼운다:

```ts
    const race = box("navRace", { x: 122, y: 738, w: 96, h: 50 });
    layer.addChild(hotspot(race, tex.icons.navRace, () => {
      void openRace(layer, tex.race, profile, (next) => { tex.onProfile(next); }).then((r) => {
        if (r.exit === "lobby") { /* 이미 로비다 — 레이스만 닫힌다 */ }
      });
    }));
```

`LobbyTextures`에서 `world` 필드를 빼고 `race`와 `onProfile`을 더한다.
`main.ts`가 `onProfile`로 프로필을 받아 `save()`한다 — 레이스가 저장을 모르게 한다.

- [ ] **Step 7: 빌드와 테스트**

Run: `npm run build` → 통과
Run: `npm test` → 통과

- [ ] **Step 8: 브라우저 확인**

Run: `npm run dev` → `localhost:5173`

- [ ] 로비 하단 두 번째 칸이 **RACE**로 보인다
- [ ] 눌러서 레이스 화면이 열리고, 6마리가 레인에 선다
- [ ] 뽑기를 누르면 하이라이트가 돌다가 한 마리에서 멎는다
- [ ] 카운트다운 뒤 RUN 연타로 내 동물이 달린다 — **배경이 흐르는 게 보인다**
- [ ] 천천히 누르면 걷고, 빨리 누르면 달린다
- [ ] AI 5마리가 앞뒤로 오간다
- [ ] 완주하면 결과 화면에 순위가 뜨고, 첫 기록이면 보상이 나온다
- [ ] 로비로 돌아오고, 다시 들어가 더 느리게 완주하면 **보상이 안 나온다**
- [ ] 스테이지에 들어가면 부스터 개수가 늘어 있다
- [ ] `?editor=1`로 열어 레이스 슬롯을 끌면 저장되고, 새로고침해도 남아 있다

- [ ] **Step 9: 커밋**

```bash
git add src/ui/race src/ui/lobbyScreen.ts src/main.ts src/data/
git commit -m "feat: 동물 운동회 화면 — 로비 WORLD를 RACE로 바꾼다"
```

---

## Self-Review

**스펙 커버리지**

| 스펙 | Task |
|---|---|
| §4-2 `mergeAreas` 이식 | 1 |
| §7-1 `Profile` 확장 | 2 |
| §8-1 걸음 · 상수 | 3, 4 |
| §8-2 AI 페이스 | 5 |
| §6-1 단계 전이 · 룰렛 | 6, 10 |
| §8-3 보상 판정 | 7 |
| §8-4 부스터 소비 | 8 |
| §7-2~7-5 배치·매니페스트 | 9 |
| §5-2 UI 모듈 5개 · §10 폴백 | 10 |
| §11 테스트 전략 | 1,2,4,5,6,7,8,9 |

**빠진 것**: `race.bg.startGate`는 매니페스트에만 있고 `trackView`가 쓰지 않는다 —
출발선 그림이 있으면 쓰고 없으면 그만이라 Task 10 Step 1의 재량으로 둔다.

**타입 일관성**: `RunnerState.finishedAt`은 전 Task에서 `number | null`.
`BoosterId`는 `engine/hex/boosters.ts`의 것을 재사용한다.
`tapStep`/`tapRace`는 둘 다 **초 단위 간격**을 받는다 — ms를 넘기면 spm이 60배가 된다.
