# 동물 운동회 (Race) — 기술 설계

- 날짜: 2026-09-05
- 상태: Director 승인 — 구현 플랜 착수
- 대상: Red Horse Rescue 2026 (nhn-2026-game-hackathon)
- 기획: `docs/GDD.md` §7 메타 레이어
- 기준선: `a2abcb6` (origin/main) · 빌드 통과 · **테스트 207개 / 15파일 통과** (2026-09-05 실측)
- 목업: 슬롯 시트 아티팩트 (좌표는 §7-2가 정본)

---

## 1. 목적

로비 하단 **WORLD** 자리를 **RACE**로 바꾸고, 동물 6종이 단거리 달리기를 하는
메타 미니게임을 넣는다.

이 문서는 **무엇을 새로 쓰고, 기존 코드의 어디를 얼마나 여는지**를 확정한다.
코어(헥사 머지 슈터)의 규칙은 건드리지 않는다.

### 1-1. CLAUDE.md 절대 규칙 1과의 관계

「메커닉은 하나로 확정하고 이후 추가하지 않는다」에 대해 레이스는 **두 번째 메커닉**이다.
Director가 지시한 작업이므로 진행하되, 규칙 2·3(토 13:00 플레이 가능 / 일 03:00 동결)이
살아 있으므로 **레이스를 통째로 들어내는 비용을 최소로 유지한다** — 진입점을
`lobbyScreen.ts` 한 줄로 묶고, 코어가 레이스를 import하지 않게 한다(§5-4).

---

## 2. 결정 사항 (Director 확정)

| 항목 | 결정 | 근거 |
|---|---|---|
| 레이스 형식 | **6마리 동시 경주** (내 동물 1 + AI 5) | 순위가 나오고 「운동회」 그림이 산다 |
| 참가 동물 | **항상 6종 전부** | `rescued`가 비어도 빈 화면이 안 나온다. 첫 실행에서 바로 논다 |
| 선수 지정 | **버튼을 누르면 랜덤 지정** (룰렛 연출) | Director 지시. 후보는 구출 3 : 미구출 1 가중 |
| 조작 | **탭 1회 = 한 걸음.** 빨리 누를수록 보폭이 커진다 | Director 지시. 「천천히 누르면 걷는 느낌」이 요구사항이다 |
| 보상 | **최고기록 갱신 시에만 부스터 1개** | 갱신이 조건이라 반복 파밍이 규칙 안에서 닫힌다. 별도 횟수 제한 불필요 |
| 순위와 보상 | **무관** | AI 밸런싱이 틀려도 보상 규칙이 안 깨진다. 밸런싱을 마지막으로 미룰 수 있다 |
| 월드 화면 | **진입점만 끊는다** | 절제에 시간을 쓰지 않는다. 번들에서는 저절로 빠진다 |
| 부스터 아이콘 소유 | **`hex.booster.*`** (인게임 소유, 레이스가 참조) | 인게임 부스터 슬롯 3개가 지금 `asset` 없음. 키를 레이스가 가지면 소유권이 갈린다 |

---

## 3. 기준선 실측 (2026-09-05 · `a2abcb6`)

설계가 딛고 있는 사실. **추정이 아니라 읽은 것만 적는다.**

| 실측 | 값 | 확인처 |
|---|---|---|
| 로비 `navWorld` 슬롯 | `122, 738, 96×50` · `asset: lobby.navWorld` | `src/data/uiLayout.json` |
| 부스터 재고 하드코딩 | `{ bomb: 3, rainbow: 2, horseshoe: 1 }` | `src/engine/hex/stageRun.ts:21` |
| 인게임 부스터 슬롯 3개 | `asset` **없음** (폴백만) | `uiLayout.json` · `ui/hex/hudView.ts:163` |
| 논리 좌표계 | `BASE_W 450 · BASE_H 800` | `src/ui/stage.ts` |
| 슬롯 조회 | `slot(area, id)` → 없으면 `null`, 호출부가 폴백 | `src/data/uiLayout.ts` |
| `/ui.html` 에디터 탭 | `state.areas` 순회 — **하드코딩 없음** | `src/tools/uiEditor.ts:354` |
| `/ui.html` 저장 | **병합**(`mergeAreas`) — `584dfdd`로 고쳐짐 | `src/tools/uiEditor.ts` |
| 인게임 에디터 저장 | **통째 교체** — 안 고쳐짐 | `src/ui/layoutEditor.ts:308` |
| `editable()` 등록 | `entries`에만 담고 `uiAreas`에 넣지 않음 | `src/ui/layoutEditor.ts:99` |
| 슬롯 편집 | `e.slot.x`를 직접 수정 | `src/ui/layoutEditor.ts:410` |
| 배치 저장 파일 | `src/data/uiLayout.json` (cwd 기준, 통째 재작성) | `vite.config.ts:7, 104` |
| 배치/매니페스트 watch | **제외** — 밖에서 바뀌어도 페이지가 안 뜬다 | `vite.config.ts:238` |
| 아트 반입 | `public/assets/` 8개 디렉터리, `hex/` 38장 | 실측 |

### 3-1. 이 실측이 뒤집은 판단 하나

초안에서 **「`uiLayout.json` 변경을 마지막 커밋으로 미루고 구현 중엔 코드 폴백 좌표로 돈다」**
고 권고했다. **틀렸다. 철회한다.**

`editable()`은 슬롯 객체 참조만 `entries`에 담고 `uiAreas`에 넣지 않는다(`layoutEditor.ts:99`).
편집은 그 객체를 직접 고치는데(`:410`), 폴백 슬롯은 화면 코드가 만든 리터럴이라 `uiAreas`
안에 없다. 저장은 `uiAreas`만 보낸다(`:308`). 결과: **폴백 슬롯은 화면에선 끌리지만 저장되지
않는다.** 그 방식으로 가면 구현 내내 레이스 좌표를 에디터로 못 맞춘다.

→ `race` 영역을 **초반에** JSON에 넣는다. 대신 §4-2의 `mergeAreas` 이식으로 소실을 막는다.

---

## 4. 재사용 판정

### 4-1. 그대로 살림 — 수정 0

| 대상 | 쓰는 방식 |
|---|---|
| `ui/stage.ts` | `BASE_W/BASE_H`, `fullRect`, `coverBox`, `stageTop/Left` 그대로 |
| `ui/skin.ts` `fitSprite` | 러너·버튼 스프라이트 맞춤 |
| `ui/settings.ts` `buzz` · `ui/audio.ts` | 탭 진동·효과음 |
| `ui/settingsMenu.ts` | 톱니 → 설정창. 좌표도 기존 관례(`400,10,40×40`) 유지 |
| `ui/layoutEditor.ts` `editable/clearEditable` | 레이스 슬롯도 같은 방식으로 등록 |
| `data/animals.ts` `ANIMALS` | 6종 id·이름·글리프. **레이스가 새 동물 목록을 만들지 않는다** |
| `data/uiLayout.ts` `slot()` | 좌표 조회 |
| `tools/uiEditor.ts` | **코드 수정 0.** 탭이 `state.areas` 순회라 JSON에 넣으면 탭이 생긴다 |
| `vite.config.ts` | 저장·업로드 엔드포인트 그대로 |

### 4-2. 수정해서 재사용

| 대상 | 수정 | 크기 | 위험 |
|---|---|---|---|
| `data/uiLayout.json` | `race` 영역(슬롯 20) 추가 · `lobby.navWorld` → `navRace` · uploads 3그룹 14항목 · audios 6항목 | 데이터만 | 낮음 |
| `data/assets.json` | `lobby.navRace` 교체 · `race` 노드 신규 · `hex.booster.*` 신규 | 데이터만 | 낮음 |
| `ui/lobbyScreen.ts` | import 1줄 · `box("navWorld", …)` 블록 1개 | ~6줄 | 낮음 |
| `engine/profile.ts` | `raceBest` · `boosters` 필드 추가, `parseProfile` 하위호환 | ~25줄 | 낮음 — 기존 6개 테스트가 지킨다 |
| `engine/hex/stageRun.ts` | 21행 하드코딩을 **기본값 있는 인자**로 | ~3줄 | 낮음 — 기본값이 현재 값이라 호출부 무변경 |
| `main.ts` | 스테이지 진입 시 `기본 + profile.boosters` 전달 후 재고 비움 | ~8줄 | 중간 — 저장 시점과 엮인다 |
| **`ui/layoutEditor.ts`** | `uiEditor.ts`의 `mergeAreas`를 이식 (교체 → 병합) | ~15줄 | 중간 — **기존 코드. 독립 Task로 분리한다** |

`layoutEditor.ts` 수정은 이 기능이 만든 필요다. `race` 영역을 추가하는 순간, 게임 탭을
열어 둔 사용자가 슬롯 하나만 끌어도 그 영역이 통째로 사라진다. `584dfdd` 커밋 메시지가
같은 사고를 기록하고 있다 — *"powerGauge가 다섯 번, bgPanel이 두 번, 그중 한 번은 커밋에
실려 나갔다."* 이식할 코드는 이미 main에서 검증된 패턴이다.

### 4-3. 진입점만 끊음

| 대상 | 처리 |
|---|---|
| `ui/worldScreen.ts` | 파일을 남기고 import만 끊는다. 번들에서 저절로 빠진다 — 부트 체인에서 `ui/boot.ts`를 남긴 것과 같은 처리 |
| `uiLayout.json` `world` 영역 | 슬롯 3개를 남긴다. 지우면 되돌릴 때 좌표를 다시 만들어야 한다 |
| `assets.json` `world` 노드 · `public/assets/world/` | 남긴다 |

---

## 5. 아키텍처

```
data (JSON · 상수) → engine/race (순수 TS, Pixi 의존 0) → ui/race (Pixi 렌더)
```

의존은 한 방향으로만 흐른다. `engine/race/`가 렌더러를 모르므로 테스트가 헤드리스로 돈다.

### 5-1. 엔진 모듈 (`src/engine/race/`)

| 파일 | 책임 | 의존 |
|---|---|---|
| `types.ts` | `RunnerState` · `RaceState` · `RacePhase` · `RaceResult` | 없음 |
| `step.ts` | 탭 → 걸음 → 위치 (플레이어 1명) | `types` |
| `pace.ts` | AI 5마리 페이스 곡선 | `types` |
| `raceRun.ts` | 상태 전이 · 결승 판정 · 순위 산출 | `types` `step` `pace` |
| `reward.ts` | 최고기록 갱신 판정 · 보상 결정 | `types` · `Profile` |

튜닝 상수(§8-1 표 · `PACE_MIN/MAX` · `PX_PER_M` · 패럴랙스 계수 · 아트 경로)는 **`src/data/race.ts`
한 곳**에 둔다. 엔진과 UI가 같은 값을 각자 들고 있으면 밸런싱이 두 곳에서 어긋난다.

`engine/race/`는 **Pixi를 import하지 않는다**(규약 5조).

### 5-2. UI 모듈 (`src/ui/race/`) — 규약 1조 200줄 상한

| 파일 | 책임 | 예상 |
|---|---|---|
| `raceScreen.ts` | 화면 조립 · 단계 전이 · 좌표/텍스처 주입 | ~180줄 |
| `trackView.ts` | 배경 3층 스크롤 · 레인 · 결승선 | ~150줄 |
| `runnerView.ts` | 러너 1마리 렌더 · 걸음 애니 | ~110줄 |
| `rosterView.ts` | 뽑기 룰렛 연출 | ~90줄 |
| `raceResultView.ts` | 결과 패널 | ~120줄 |

파일명이 `resultView.ts`가 아니라 `raceResultView.ts`인 이유: CLAUDE.md 「남은 작업」의
**스테이지 결과 화면**과 이름이 겹친다. 두 화면은 다른 것이다.

### 5-3. 규약 2조 — 접점을 1곳으로 고정한다

규약 2조는 「새 `ui/` 파일은 `../data`를 직접 import하지 않는다」이다. 문자 그대로 지키면
좌표를 읽을 길이 없다.

**타협: `ui/race/` 5개 중 `raceScreen.ts` 하나만 `../data`를 읽는다.** 나머지 4개는 좌표와
텍스처를 인자로 받는다. 규약의 목적이 「스키마가 바뀔 때 동시에 깨지는 지점을 줄이는 것」
(직통 16곳이 문제였다)이므로, 이 기능의 접점을 **1곳**으로 고정하는 것으로 목적을 지킨다.

### 5-4. 코어와의 격리

- `engine/hex/*`는 `engine/race/*`를 import하지 않는다.
- `ui/hex/*`는 `ui/race/*`를 import하지 않는다.
- 레이스 → 코어 방향의 접점은 **`Profile`뿐**이다(`raceBest` 읽기·쓰기, `boosters` 쓰기).

레이스를 들어낼 때 지울 것: `engine/race/` · `ui/race/` · `data/race.ts` ·
`lobbyScreen.ts`의 블록 1개 · JSON의 `race` 영역. 그 외에는 남는다.

---

## 6. 좌표계와 화면 흐름

### 6-1. 화면 흐름

`openRace(parent, tex, profile)` → `Promise<RaceOutcome>`. 한 화면 안에서 단계만 바뀐다.

| 단계 | 화면 | 나가는 조건 |
|---|---|---|
| `roster` | 6마리가 출발선 정렬, 하단 **동물 뽑기** | 룰렛이 멎어 내 동물 확정 |
| `countdown` | 3·2·1 (1.8초) | 자동 |
| `running` | 하단 **RUN**, 배경 3층 스크롤 | 6마리 전부 결승 통과 |
| `result` | 순위·기록·갱신·보상 | 닫기 → 로비 / 다시 달리기 → `roster` |

룰렛은 **뽑기 시점에 결과를 먼저 정하고 연출만 재생한다.** 연출 프레임 수가 결과를 바꾸면
테스트가 불가능해진다.

### 6-2. 카메라와 레인

- 내 동물을 화면 `x = 90`에 고정하고 세계를 흘려보낸다.
- AI는 나와의 상대 거리로 놓인다: `screenX = 90 + (aiX - myX) * PX_PER_M`.
- `PX_PER_M = 26` → 화면 폭 450px ≈ **17m 시야**. 앞선 AI를 13m까지 본다.
- 레인 6줄은 `trackArea` 슬롯 하나를 **균등 분할**한다. 레인마다 슬롯을 두면 트랙을 옮길 때
  6개를 따로 끌어야 한다.
- 레인 순서는 `ANIMALS` 순서 고정.

### 6-3. 배경 패럴랙스

| 층 | 계수 | 에셋 |
|---|---|---|
| 하늘 | 0.15 | `race.bg.sky` |
| 중경(관중석) | 0.45 | `race.bg.mid` |
| 트랙 | 1.00 | `race.bg.track` |

3층은 가로로 이어 붙여 무한 스크롤한다 — **좌우 끝이 맞물리는 타일**이어야 한다.
위치 개념이 없으므로 슬롯이 아니라 `uploads`다.

---

## 7. 데이터 스키마

### 7-1. `Profile` 확장

```ts
export interface Profile {
  rescued: string[];
  horseshoes: number;
  stageIndex: number;
  /** 동물 id → 최고기록(초, 소수 2자리). 기록이 없으면 키가 없다 */
  raceBest: Record<string, number>;
  /** 레이스로 번 부스터 재고 — 다음 스테이지 진입 때 실린다 */
  boosters: Boosters;
}
```

`Boosters`는 `engine/hex/types.ts`에서 import한다(같은 `engine/` 안, 단방향).

`parseProfile`은 두 필드가 없으면 `{}` 와 `{ bomb: 0, rainbow: 0, horseshoe: 0 }`으로 채운다.
**기존 저장 데이터가 그대로 읽힌다.** 값의 형태가 어긋나면 조용히 기본값으로 간다 —
기존 `parseProfile`의 방침 그대로다.

### 7-2. `uiLayout.json` — 새 영역 `race` (슬롯 20)

`{ "id": "race", "label": "레이스" }`. `asset`이 빈 슬롯은 코드가 글자를 그리는 자리다.

| 단계 | id | label | x | y | w | h | asset |
|---|---|---|---|---|---|---|---|
| A | `back` | 돌아가기 | 14 | 12 | 44 | 40 | `race.ui.back` |
| A B C | `gear` | 설정 | 400 | 10 | 40 | 40 | `ui.gear` |
| A | `titleBanner` | 운동회 현수막 | 105 | 64 | 240 | 52 | `race.ui.titleBanner` |
| A | `myRunnerTag` | 내 선수 이름 | 125 | 126 | 200 | 40 | — |
| A B C | `trackArea` | 트랙 영역(6레인) | 12 | 344 | 426 | 336 | — |
| A | `rosterHint` | 안내 문구 | 100 | 662 | 250 | 26 | — |
| A | `pick` | 동물 뽑기 | 123 | 700 | 204 | 72 | `race.ui.pick` |
| B | `countdown` | 카운트다운 숫자 | 165 | 352 | 120 | 150 | — |
| C | `hudRank` | 현재 순위 | 14 | 20 | 116 | 38 | — |
| C | `hudTime` | 경과 시간 | 250 | 20 | 140 | 38 | — |
| C | `distBar` | 주행 게이지 | 14 | 70 | 422 | 14 | `race.ui.distBar` |
| C | `run` | RUN (연타) | 105 | 694 | 240 | 84 | `race.ui.run` / off `race.ui.runPressed` |
| D | `resultPanel` | 결과 패널 | 40 | 138 | 370 | 522 | `race.ui.resultPanel` |
| D | `resultTitle` | 결과 제목 | 100 | 170 | 250 | 46 | — |
| D | `resultList` | 순위 6행 | 68 | 232 | 314 | 264 | — |
| D | `bestTag` | 최고기록 갱신 배지 | 143 | 506 | 164 | 34 | `race.ui.bestTag` |
| D | `rewardIcon` | 보상 부스터 아이콘 | 152 | 548 | 58 | 58 | — (`hex.booster.*` 동적) |
| D | `rewardLabel` | 보상 이름 | 220 | 562 | 150 | 30 | — |
| D | `retry` | 다시 달리기 | 62 | 608 | 148 | 52 | `race.ui.retry` |
| D | `close` | 로비로 | 240 | 608 | 148 | 52 | `race.ui.close` |

`back`을 좌상단에 둔 이유: 하단 전체를 조작부(`pick`/`run`)가 쓴다. 월드의 `back`
(`17,740`)과 다른 자리인 것은 의도다.

### 7-3. `uiLayout.json` — `uploads` 3그룹 14항목

| group | label | asset | seq |
|---|---|---|---|
| 레이스 배경 | 하늘 (가로 반복) | `race.bg.sky` | |
| 레이스 배경 | 중경 관중석 (가로 반복) | `race.bg.mid` | |
| 레이스 배경 | 트랙 바닥 (가로 반복) | `race.bg.track` | |
| 레이스 배경 | 출발 게이트 | `race.bg.startGate` | |
| 레이스 배경 | 결승선 배너 | `race.bg.finish` | |
| 레이스 러너 | 달리기 · 토끼 … 코끼리 (6종) | `race.runners.<id>` | ✔ |
| 부스터 아이콘 | 폭탄 · 레인보우 · 말굽 | `hex.booster.<id>` | |

부스터 아이콘 3장은 **인게임이 소유한다**. 인게임 부스터 슬롯 3개가 지금 `asset` 없이
폴백만 그리고 있으므로, 이 3장이 붙으면 인게임도 같이 좋아진다. 레이스는 참조만 한다.

러너 6종은 `/ui.html`의 «게임 에셋» 탭에 `group` 머리글로 갈려 뜬다. 로비 친구처럼
6칸 그리드로 뜨지 않는 이유: 그 묶음 UI는 `FRIEND_PREFIX = "lobby.friends."`
(`uiEditor.ts:155`)로 로비에 한정돼 있다. **이번 범위에서 에디터 코드를 열지 않는다.**

### 7-4. `uiLayout.json` — `audios` 6항목

`audio.bgmRace` · `audio.sfxWhistle` · `audio.sfxStep` · `audio.sfxRouletteTick` ·
`audio.sfxFinish` · `audio.sfxRecord`.

걸음 소리는 탭마다 재생되므로 짧고 가벼운 파일이어야 한다. 기존 `audio.sfxTap`은
버튼용이라 걸음에 쓰면 로비와 같은 소리가 난다.

### 7-5. `assets.json` — `race` 노드

`bg`(5) · `runners`(6, 배열=시퀀스) · `ui`(10). 별도로 `hex.booster`(3)와
`lobby.navRace`(1). 파일이 `public/` 아래 없으면 자동 폴백이므로 **아트 0장으로도
레이스가 끝까지 플레이된다**(§10).

---

## 8. 핵심 알고리즘

### 8-1. 걸음 (`step.ts`) — 탭은 속도에 더해지지 않는다

탭 1회는 걸음 하나를 **앞에 찍고**, 몸이 그 걸음을 따라간다.

```
onTap(now):
  dt     = now - lastTapAt                                  // ms
  spm    = lerp(spm, 60000/dt, SPM_SMOOTH)                  // 분당 걸음 수
  t      = clamp01((spm - SPM_WALK) / (SPM_SPRINT - SPM_WALK))
  stride = STRIDE_MIN + (STRIDE_MAX - STRIDE_MIN) * t
  targetX += stride

tick(dt):
  spm -= SPM_DECAY * dt
  x   += (targetX - x) * (1 - exp(-CATCHUP * dt))
```

`targetX`는 **절대 뒤로 가지 않는다.** 후진이 없다는 것이 이 모델의 성질이다.

느낌이 여기서 나온다. 천천히 누르면 `x`가 매번 `targetX`를 따라잡고 멈춰 **뚝뚝 끊기는
걷기**가 되고, 빨리 누르면 `targetX`가 계속 달아나 `x`가 못 따라잡은 채 **끊김 없는
달리기**가 된다. 같은 수식 하나가 걷기와 질주를 다 만든다. 보폭까지 리듬에 비례하므로
「빨리 누를수록 점점 더 빨리」가 걸음 수 × 보폭으로 두 번 걸린다.

| 상수 | 값 | 의미 |
|---|---|---|
| `DISTANCE` | 100 m | 결승선 |
| `STRIDE_MIN` / `MAX` | 0.8 / 2.2 m | 걷기 보폭 / 질주 보폭 |
| `SPM_WALK` / `SPRINT` | 60 / 300 | 1초에 1탭 / 0.2초에 1탭 |
| `SPM_SMOOTH` | 0.35 | 지수이동평균 계수 |
| `CATCHUP` | 14 /s | 몸이 걸음을 따라잡는 속도 |
| `SPM_DECAY` | 90 /s | 손을 뗐을 때 식는 속도 |

상수는 전부 `src/data/race.ts`에 있다. 초당 3탭 → 4.5 m/s (100m 22초). 초당 4탭 → 7 m/s (14초).
애니메이션 상태도 `spm` 하나로 갈린다 — `idle` / `walk` / `run` / `sprint`.

순수 함수라 `now`를 인자로 받는다. 탭 간격 배열을 넣으면 결승 시간이 결정적으로 나온다.

### 8-2. AI 페이스 (`pace.ts`)

뽑힌 동물을 뺀 5마리. 페이스는 시작 시 주입된 `rng`로 한 번에 뽑고 그 뒤로는 시간의
함수라 재현된다 — `stageRun.ts`의 `rng: () => number = Math.random` 주입 방식 그대로다.

```
pace_i   = PACE_MIN + rng() * (PACE_MAX - PACE_MIN)          // 4.0 ~ 6.5 m/s
w_i      = 0.7 + rng() * 0.8
phi_i    = rng() * TAU
v_i(t)   = pace_i * (1 + WOBBLE * sin(w_i*t + phi_i)) * spurt(p_i)
spurt(p) = p < 0.8 ? 1 : 1 + SPURT * (p - 0.8) / 0.2
```

`WOBBLE = 0.12` · `SPURT = 0.15`. 변동이 있어야 중반에 순위가 뒤집히고, 스퍼트가 있어야
결승선 앞이 조마조마하다. 없으면 6마리가 출발 순서대로 들어와 화면이 죽는다.

**보상 조건은 순위가 아니라 내 기록의 갱신이므로, AI 난이도는 보상과 무관하다.**
`PACE_MAX`를 잘못 잡아도 보상 규칙이 안 깨진다 — 밸런싱을 마지막으로 미룰 수 있다.

### 8-3. 보상 판정 (`reward.ts`)

1. 완주 시간이 `raceBest[내 동물]`보다 빠르거나 **기록이 아예 없으면** →
   갱신하고 부스터 1개(3종 중 `rng`로 하나).
2. 아니면 아무것도 주지 않고, 결과 화면에 최고기록과의 차이만 보여준다.

첫 기록도 갱신으로 치므로 동물마다 1회는 확정 보상이다 — 6마리 = 최소 6개. 그 뒤부터는
**자기 기록을 깨야만** 나오니 상한이 규칙 안에 들어 있다. 별도 횟수 제한이 필요 없다.

### 8-4. 부스터 소비

```ts
createRun(stage, rng, stock: Boosters = { bomb: 3, rainbow: 2, horseshoe: 1 })
```

기본값이 현재 하드코딩 값 그대로라 **기존 호출부와 테스트가 안 깨진다.**
`main.ts`만 `기본 + profile.boosters`를 넘기고 **진입 즉시 `profile.boosters`를 비운다.**

판이 끝나고 남은 것은 돌려주지 않는다. 돌려주기 시작하면 「몇 개 남았나」를 결과 화면과
저장 양쪽에서 관리해야 하고, 그 복잡도는 이 기능이 감당할 것이 아니다.

---

## 9. 상태 관리

상태는 `openRace` 클로저 안의 **객체 하나**(`RaceScreen`)에 담는다.
모듈 전역 `let`을 두지 않는다(규약 4조 — `app.ts` 전역 15개가 만든 문제).

생명주기는 `closed` 불리언과 명시적 `ticker.remove()`로 끊는다.
`track.parent`를 보고 살아 있는지 추측하지 않는다(규약 7조).

`clearEditable("race")`를 닫을 때 반드시 부른다 — 파괴된 노드를 에디터가 잡고 있으면 죽는다.

---

## 10. 아트 폴백 — 0장으로 완주 가능해야 한다

`public/assets/`에 아트가 반입됐지만 **레이스 아트는 아직 0장**이다. 레이스는 그 상태에서
처음 열린다.

**배경 3층은 단색이면 안 된다.** 무늬가 없으면 배경이 흐르는지 알 수 없고, 그러면 달리는
느낌 자체가 사라진다 — 이 게임에서 배경 스크롤이 속도의 유일한 표현이다.
그래서 폴백을 절차적으로 그린다: 중경은 일정 간격 사각형(관중석), 트랙은 10m마다 흰 세로선
(거리 마커). 스크롤이 즉시 읽힌다.

| 대상 | 폴백 |
|---|---|
| 배경 3층 | 색 띠 + 절차적 반복 마커 (`Graphics`) |
| 러너 | 로비 `friend()`와 같은 원형 + 글리프. 상하 바운스·좌우 기울기의 **진폭을 `spm`에 비례** — 시퀀스가 0장이어도 걷기와 질주가 눈으로 갈린다 |
| 결승선 | 흑백 체크 `Graphics` |
| 버튼 | 기존 `hotspot()` 폴백(둥근 사각 + 라벨) 그대로 |
| 보상 아이콘 | 부스터 이름 글자 |

---

## 11. 테스트 전략

`engine/`만 본다(기존 관례). UI는 테스트하지 않는다.

| 파일 | 검증 |
|---|---|
| `tests/race/step.test.ts` | 탭 간격 배열 → 완주 시간 결정적 · 보폭이 `spm`에 단조 증가 · 손 떼면 정지 · **`targetX` 후진 없음** |
| `tests/race/pace.test.ts` | 같은 `rng` → 같은 결과 · 페이스가 `[PACE_MIN, PACE_MAX]` 안 · 스퍼트가 진행률 0.8 이후에만 |
| `tests/race/raceRun.test.ts` | 6마리 결승 판정 · 순위 산출 · 동률은 먼저 통과한 쪽 · 꼴찌여도 기록은 남는다 |
| `tests/race/reward.test.ts` | 첫 기록은 갱신 · 느린 기록은 미갱신이고 보상 없음 · 갱신 시 부스터가 정확히 1개 |
| `tests/hex/profile.test.ts` (기존에 추가) | `raceBest`/`boosters` 없는 **구 저장 데이터가 그대로 읽힌다** · 형태가 어긋나면 기본값 |

기준선 207개에서 늘어난다. **기존 207개는 하나도 깨지지 않아야 한다** — `createRun`의
기본값을 현재 값으로 둔 것이 그 보증이다.

---

## 12. 규약 7조 대응

| 조 | 내용 | 이 기능의 대응 |
|---|---|---|
| 1 | 렌더 함수는 200줄에서 자른다 | `ui/race/` 5파일 전부 200줄 아래 (§5-2) |
| 2 | 새 `ui/` 파일은 `../data`를 직접 import하지 않는다 | **`raceScreen.ts` 1곳으로 고정.** 근거 §5-3 |
| 3 | 새 JSON은 `as unknown as`로 받지 않는다 | `race` 노드·`Profile` 확장 모두 필드별 검증 |
| 4 | 화면 전환 상태를 모듈 전역 `let`으로 두지 않는다 | `openRace` 클로저의 `RaceScreen` 객체 하나 (§9) |
| 5 | `engine/`은 Pixi를 import하지 않는다 | `engine/race/` 위반 0 |
| 6 | 치트·디버그는 `devMode` 게이트 뒤에만 | 레이스에 치트를 넣지 않는다 |
| 7 | 화면 생명주기를 부모 존재 여부로 추측하지 않는다 | `closed` 플래그 + 명시적 `ticker.remove()` (§9) |

---

## 13. 리스크

| 리스크 | 크기 | 완화 |
|---|---|---|
| 인게임 에디터가 `race` 영역을 지운다 | **높음** — 이미 두 번 발생 | `mergeAreas` 이식을 **선행 Task**로 (§4-2) |
| `main.ts` 부스터 소비 시점이 저장과 어긋나 재고가 증발/복제 | 중간 | 진입 시 1회 소비로 규칙을 한 줄로 유지. 프로필 테스트로 고정 |
| 탭 연타가 모바일에서 안 먹힌다(300ms 더블탭 지연) | 중간 | `pointerdown`으로 받는다(기존 `hotspot`은 `pointertap`) — 구현 시 확인 |
| 시간이 모자라 레이스가 미완으로 남는다 | 중간 | 진입점이 `lobbyScreen.ts` 한 줄이라 들어내기 쉽다 (§5-4). 절대 규칙 3 준수 |
| AI 밸런싱이 안 맞는다 | 낮음 | 보상과 무관하게 설계 (§8-2) |
| `uiLayout.json` 병행 편집 충돌 | 낮음 | 단일 파일이라 남는다. `mergeAreas` 이후엔 소실이 아니라 충돌로만 나타난다 |

---

## 14. 범위 밖

- 레이스 결과의 **말굽 지급** — 보상은 부스터 1종으로 끝낸다
- **부스터 인벤토리 UI** — 재고는 로비에 표시하지 않는다. 결과 화면과 인게임 HUD로 족하다
- **레이스 랭킹/리더보드** — 최고기록은 동물별 1개씩만
- **레인별 난이도·트랙 종류** — 100m 하나
- `/ui.html` 에디터의 **러너 6칸 묶음 업로드 UI** — `group` 머리글로 충분하다
- **월드 화면 절제** — 진입점만 끊는다

---

## 부록 A. 로비 교체 diff 요약

| 파일 | 변경 |
|---|---|
| `uiLayout.json` | 슬롯 `navWorld` → `navRace` · label `WORLD` → `RACE` · asset `lobby.navWorld` → `lobby.navRace`. **좌표 `122,738,96×50`은 그대로** — 하단 4칸 간격이 아트와 맞춰져 있다 |
| `assets.json` | `"navWorld": "assets/lobby/nav-world.webp"` → `"navRace": "assets/lobby/nav-race.webp"` |
| 디자이너 작업 | `nav-race.webp` **아이콘 1장 신규** |
| `lobbyScreen.ts` | `import { openWorld }` → `openRace` · `box("navWorld", …)` 블록을 `navRace`로 |
