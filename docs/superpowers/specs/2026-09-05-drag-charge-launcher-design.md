# 당겨 쏘는 발사대 — 기술 설계

> 2026-09-05 · 브랜치 `feat/ingame-actions`
> 선행 문서: `docs/superpowers/specs/2026-09-04-hexa-merge-shooter-design.md`(코어 설계),
> `docs/GDD.md`(주제 해석)

## 1. 목적

추첨 키워드 **「물리법칙」**을 조작 자체에 넣는다. 지금은 화면을 탭한 자리로
직선이 날아간다 — 물리가 그림에도 규칙에도 없다.

바꾼 뒤: 붉은말의 앞발을 **아래로 당기면 힘이 모이고**, 당긴 채 **좌우로 움직이면
각도가 잡히며**, 손을 떼면 그 힘만큼 타일이 **포물선을 그리며** 날아간다.
사거리가 유한해지므로 「얼마나 세게」가 처음으로 실력이 된다.

## 2. 결정 사항 (Director 확정, 2026-09-05)

| 항목 | 결정 | 버린 대안 |
|---|---|---|
| 파워의 의미 | **중력·사거리** — 속도와 중력을 엔진에 넣는다 | 연출만 / 관통력 / 포물선이되 사거리 무한 |
| 헛발(판에 못 닿음) | **한 발 소모** | 되돌려받기 / 최소 파워 하한으로 헛발 자체를 없애기 |
| 조준 방향 | **새총** — 당긴 반대로 날아간다 | 끈 쪽으로 날아가기(배구 토스식) |
| 붉은말 아트 | **1슬롯 유지** — 「당김→폄」이 한 시퀀스에 다 들어온다 | 대기/장전/토스 3슬롯 |
| 파워 표시 | 점선 궤적 **+ 직각삼각형 게이지(코드로 그림)** | 점선만 / 숫자 게이지 |
| 스테이지 밸런싱 | **보류** — 별도 브랜치. 여기서는 도달 하한만 보장한다 | 이 브랜치에서 15스테이지 재조정 |

## 3. 코드베이스 실측

측정 시점 `ecfa34a`. **이미 되어 있는 것을 다시 만들지 않기 위한 절이다.**

### 3-1. 그대로 살림 — 수정 0

| 파일 | 실측 | 근거 |
|---|---|---|
| `ui/sequence.ts` (73줄) | 프레임 배열 → 재생기. 한 장이면 스틸 | 스크럽에 필요한 것은 `sprite.texture` 교체뿐. 재생 루프는 토스 구간에 그대로 쓴다 |
| `data/hexAssets.ts`의 `frames()` | 문자열/배열 양쪽을 프레임 목록으로 정규화 | `hex.horse`는 이미 시퀀스로 파싱된다 |
| `uiLayout.json`의 `uploads` | `{label:"붉은말(발사대) — 시퀀스", asset:"hex.horse", seq:true}` | **에디터는 이미 붉은말 시퀀스를 여러 장 받는다.** 슬롯을 새로 만들 이유가 없다 |
| `tools/uiEditor.ts`의 `input.multiple = seq` (277행) | 시퀀스 슬롯 다중 업로드 | 위와 같음 |
| `engine/hex/coords.ts`, `grid.ts`, `gravity.ts`, `pop.ts` | 좌표·합체·낙하 | 발사 모델과 무관 |

### 3-2. 수정해서 재사용

| 파일 | 지금 | 바뀔 것 |
|---|---|---|
| `engine/hex/shot.ts` (92줄) | 직선·무한 사거리. `simulateShot(cells, geom, from, angle)` | 속도·중력 추가. 인자에 `power`, 결과에 헛발 구분 |
| `engine/hex/stageRun.ts` `fireAt` (73~108행) | `if (!snap) return empty` — 헛발이 아무 대가가 없다 | 헛발도 `shotsLeft`를 깎는다 |
| `ui/hex/launcher.ts` (202줄) | 포인터 위치 → 각도. 말은 12fps 무한 루프 | 각도·파워를 밖에서 주입받는다. 말은 파워로 **스크럽**되고 발사 때 앞으로 재생 |
| `ui/hex/stageScreen.ts` (267줄) | pointerdown/move/up에서 직접 `aimAt` | 새 `dragAim` 모듈에 위임 |
| `data/hexAssets.ts` | `horse: string[]` | `horseHold: number` 추가 (최대 장전 프레임) |
| `tools/uiEditor.ts` | 시퀀스는 장수만 표시 | 붉은말 카드에 프레임 스크러버 + 「최대 장전으로 지정」 |
| `tests/hex/shot.test.ts` (96줄) | 직선 전제 | 포물선 전제로 고쳐 쓴다 |

### 3-3. 참조만 — 이 레포 밖

`~/github/debut-loop/src/ui/swipeCard.ts`. 드래그 거리로 프레임을 스크럽하고
(`TILT_SCRUB_SPEED`, 프레임 인덱스 = `floor(prog × length)`), 임계 미달이면
`settleBack()`으로 되돌리며, `globalpointermove`는 한 곳에만 배선하고
`pointermove`를 이중으로 걸어 환경 차이를 흡수한다. **규칙만 가져오고 코드는
복사하지 않는다** — 저쪽은 카드, 이쪽은 발사대다.

## 4. 아키텍처

의존은 기존대로 한 방향이다. `data → engine → ui`.

```
ui/hex/stageScreen.ts   포인터 이벤트를 dragAim에 넘기기만 한다
  └ ui/hex/dragAim.ts   [신규] 새총 계산 · 상태 기계 (Pixi 이벤트만, 그리기 없음)
  └ ui/hex/launcher.ts  각도·파워를 받아 그린다 (말 스크럽 · 궤적 · 게이지)
       └ ui/hex/powerGauge.ts  [신규] 직각삼각형 게이지 (Graphics 한 덩이)
            └ engine/hex/shot.ts  포물선 시뮬레이션 (Pixi 없음 — 규약 5조)
```

### 4-1. `engine/hex/shot.ts` — 포물선

각도 규약은 그대로다: `0` = 똑바로 위, 양수 = 오른쪽.

```ts
export interface ShotResult {
  snap: Axial | null;
  path: Array<{ x: number; y: number }>;
  /** 판에 닿지 못하고 아래로 떨어졌다 — 헛발 */
  missed: boolean;
}

export function simulateShot(
  cells, geom, from, angleRad,
  power = 1,           // 0~1. 기본 1 = 최대 — 기존 호출부가 컴파일된다
): ShotResult
```

- 초속 `v0 = MIN_V + (MAX_V - MIN_V) × power`. 단위는 px/스텝이 아니라 px/초로
  두고 고정 `dt`로 적분한다 — 프레임률과 무관해야 테스트가 결정적이다.
- 매 스텝 `vy += G × dt`, `x += vx·dt`, `y += vy·dt`.
- 좌우 벽 반사는 **에너지 손실 없음**(`vx = -vx`). 예측선이 정직해야 조준이 실력이 된다.
- 종료 조건 셋:
  1. 점유 셀 진입 → 직전 빈 칸에 스냅 (지금과 같다)
  2. `r < 0` (천장 초과) → 스냅 없음
  3. **`vy > 0`이고 발사 지점보다 아래로 내려감** → `missed: true`, 스냅 없음
- `MIN_V`는 「가장 약하게 당겨도 **판 꼭대기(r=0)까지는 닿는다**」로 잡는다.
  스테이지별 난이도 튜닝이 아니라 기계적 도달 보장이다 — 어떤 판이 와도
  물리적으로 못 닿는 칸이 없어야 밸런싱 브랜치가 그 위에서 수치를 만질 수 있다.
  헛발은 이 하한 **아래**, 즉 데드존과 `MIN_V` 사이의 짧은 당김에서만 난다.

### 4-2. `engine/hex/stageRun.ts` — 헛발도 한 발

```ts
const { snap, missed } = simulateShot(state.cells, geom, from, angleRad, power);
if (!snap) {
  if (missed) { state.shotsLeft -= 1; state.loaded = state.next; state.next = pickNext(...); }
  return { ...empty, missed };
}
```

헛발은 **장전도 넘긴다**. 같은 타일을 다시 들고 있으면 「소모했다」가 화면에서
읽히지 않는다. `ShotOutcome`에 `missed: boolean`을 더해 화면이 연출을 고른다.

### 4-3. `ui/hex/dragAim.ts` [신규, ~120줄]

Pixi 이벤트를 받아 **각도와 파워만** 내놓는다. 그리지 않는다.

```ts
export interface Aim { angle: number; power: number }   // power 0~1
export interface DragAim {
  down(p: Point): void;
  move(p: Point): void;
  /** 손을 뗐다. 최소 당김에 못 미치면 null — 오발로 보고 취소한다 */
  up(p: Point): Aim | null;
  current(): Aim | null;
  cancel(): void;
}
export function createDragAim(anchor: Point): DragAim
```

새총 규칙 하나로 둘 다 나온다. 앵커(말 하단 중앙)에서 손끝으로 가는 벡터를
**v**라 할 때 발사 방향은 `-v`다.

```
angle = clamp(atan2(-v.x, v.y), -MAX_ANGLE, MAX_ANGLE)   // MAX_ANGLE = 1.25 유지
power = clamp((|v| - DEAD_ZONE) / (MAX_PULL - DEAD_ZONE), 0, 1)
```

- `DEAD_ZONE`(≈16px) 미만이면 `up()`이 `null` — 판을 톡 건드린 사고로 쏘지 않는다.
- `|v|`가 `MAX_PULL`을 넘어도 파워는 1에서 멈춘다. 각도는 계속 따라간다 —
  멀리 끌수록 각도 분해능이 좋아진다.
- **각도 추적에 속도 상한을 두지 않는다.** 지금의 `AIM_RATE_PER_MS`는 「탭한 자리로
  조준선이 순간이동한다」는 문제의 해법이었다. 드래그는 손끝이 연속으로 움직이므로
  그 문제가 애초에 없고, 상한을 두면 손보다 조준선이 늦어 오히려 어긋난다.
  `launcher.aimAt`/`AIM_RATE_PER_MS`는 이 작업으로 **삭제**된다.

### 4-4. `ui/hex/launcher.ts` — 말 스크럽 · 궤적

기존 202줄에서 조준 상태 기계가 빠지고 스크럽이 들어와 비슷한 크기로 남는다(규약 1조).

```ts
setAim(aim: Aim | null, cells: Map<string, Cell>): void   // 드래그 중 매 프레임
playToss(): Promise<void>                                  // hold → 끝까지 재생
```

- **말 프레임**: `frames[floor(power × hold)]`. `hold` = `hex.horseHold`(§5).
  `power`가 0이면 프레임 0(선 자세), 1이면 `hold`(팔 최대로 접음).
- **말 회전**: 하단 중앙을 축으로 `rotation = angle × TILT_RATIO`. 몸이 조준각
  그대로 눕지 않게 감쇠한다(`TILT_RATIO ≈ 0.35`). 축은 스프라이트 앵커를
  `(0.5, 1)`로 옮겨 잡는다 — 컨테이너 오프셋으로 흉내내면 회전이 세로 이동으로
  새어 나온다(debut-loop `PIVOT_X` 주석의 실패를 되풀이하지 않는다).
- **궤적**: `simulateShot(..., power)`의 `path`를 지금처럼 4스텝마다 점으로 찍는다.
  중력이 들어갔으므로 자동으로 곡선이 되고, **점선의 끝이 곧 사거리**다.
- **토스**: 손을 뗀 순간 `hold`부터 마지막 프레임까지 재생(≈24fps)하고, 그 재생이
  끝나면 프레임 0으로 돌아간다. 비행 연출(`playFlight`)은 토스 재생과 **동시에**
  시작한다 — 기다리면 타일이 앞발에 붙어 있다가 뒤늦게 떠나 어색하다.
- 손을 뗐는데 `up()`이 `null`이면 `settleBack` — 프레임을 0으로, 회전을 0으로
  180ms에 걸쳐 되돌린다(뚝 끊기면 조작 실수가 버그처럼 보인다).

### 4-5. `ui/hex/powerGauge.ts` [신규, ~70줄]

직각삼각형 램프. 밑변이 아래, 왼쪽이 낮고 오른쪽이 높다. 파워만큼 왼쪽부터
채워진다. `Graphics` 두 개(윤곽 + 채움)로 끝난다.

- **자리를 코드에 박지 않는다.** `uiLayout.json`의 `ingame` 영역에 `powerGauge`
  슬롯을 추가하고 `slot("ingame","powerGauge")`로 읽는다 — 에디터에서 끌어 옮길
  수 있고, 나중에 아트가 오면 같은 슬롯에 그림을 얹으면 된다. 슬롯이 없으면
  기본값(말 오른쪽, 판 하단)으로 간다.
- 드래그 중에만 보인다. 손을 떼면 사라진다.
- 색: 파워 0.8 이상에서 채움색이 경고색으로 바뀐다 — 최대 근처를 눈으로 안다.

## 5. 데이터 스키마

`assets.json`에 한 줄이 는다.

```jsonc
"hex": {
  "horse": ["...01.png", "...02.png", ...],
  "horseHold": 6      // 팔이 최대로 접힌 프레임(0-based). 없으면 floor(길이/2)
}
```

`data/hexAssets.ts`가 검증해 받는다(규약 3조 — `as unknown as` 금지):

```ts
function frameIndex(v: unknown, len: number): number {
  if (typeof v !== "number" || !Number.isInteger(v) || v < 0 || v >= len) {
    return Math.max(0, Math.floor(len / 2));  // 디자이너 오투입은 조용히 기본값
  }
  return v;
}
```

프레임 수가 0이면 `horseHold`도 의미가 없다 — 지금처럼 말을 아예 그리지 않는다.

## 6. 에디터 변경

`tools/uiEditor.ts`의 「게임 에셋」 탭, 붉은말 카드에만 붙는다.

- 프레임 스크러버 — `<input type=range>` 0~길이-1. 끌면 미리보기가 그 프레임을 보여준다.
- 「최대 장전으로 지정」 버튼 — 지금 보고 있는 프레임을 `hex.horseHold`에 쓴다.
- 현재 값은 스크러버 눈금 위에 표시한다.

`seq` 슬롯 전부가 아니라 `holdKey`가 지정된 업로드 항목에만 붙는다.
`uiLayout.json`의 붉은말 항목에 `"hold": "hex.horseHold"` 한 줄을 더해 표시한다.

## 7. 리스크

| 리스크 | 대응 |
|---|---|
| **기존 스테이지가 클리어 불가가 된다.** 무한 직선 사거리를 전제로 만들어졌다 | `MIN_V`를 「최소 파워로도 판 꼭대기에 닿음」으로 잡아 도달 불가를 원천 차단한다. **스테이지별 난이도·밸런싱은 이 브랜치에서 다루지 않는다**(2026-09-05 결정) — 별도 브랜치로 넘긴다 |
| **벽 반사 뱅크 샷이 사라진다.** 포물선은 벽에 닿기 전에 떨어질 수 있다 | `MAX_V`에서는 좌우 벽을 최소 2회 튀고도 천장에 닿게 잡는다. 이것도 테스트로 고정한다 |
| **모바일에서 손가락이 판을 가린다.** 아래로 당기면 손이 발사대와 게이지를 덮는다 | 게이지를 앵커 옆이 아니라 **판 하단 여백**에 둔다(§4-5). 자리는 에디터에서 조정 가능 |
| 아트가 아직 없다 | 말이 없으면 지금처럼 안 그린다. 게이지·궤적·물리는 아트와 무관하게 동작한다 — **아트 없이도 완성 판정이 난다** |
| `horseHold`를 디자이너가 안 찍는다 | 기본값 `floor(길이/2)`. 눈에 어색해도 동작은 한다 |

## 8. 테스트 전략

엔진은 헤드리스로 전부 돈다. UI는 순수 계산만 테스트한다.

- `tests/hex/shot.test.ts` — 직선 전제를 포물선으로 고쳐 쓴다. 벽 반사·스냅·천장
  케이스는 최대 파워로 유지(직선에 가깝다). **추가**: 최소 파워 헛발, 파워가
  클수록 사거리가 단조 증가, 좌우 대칭.
- `tests/hex/stageRun.test.ts` — **추가**: 헛발이 `shotsLeft`를 깎고 장전을 넘긴다.
- `tests/hex/dragAim.test.ts` [신규] — 새총 각도(당긴 반대), 데드존, 파워 클램프,
  `MAX_ANGLE` 클램프. Pixi 없이 좌표만 넣는다.
- `tests/hex/shot.test.ts` — **추가**: 최소 파워로 빈 판의 꼭대기 행(r=0)에 스냅한다.
  스테이지별 도달 검사는 이 브랜치의 일이 아니다(§7).

## 9. 규약 준수

1. 렌더 200줄 — `dragAim`/`powerGauge`를 분리해 `launcher`가 250줄을 안 넘긴다 ✓
2. 새 `ui/`가 `../data` 직통 금지 — `powerGauge`는 `uiLayout`의 `slot()`을 통해 읽는다.
   `slot()`은 `data/uiLayout.ts`의 함수다. **이건 직통이다** — 기존 화면들이 모두
   같은 방식이므로 여기서만 다르게 하면 오히려 읽기 어렵다. 예외로 두고 기록한다
3. 새 JSON은 `as unknown as` 금지 — `horseHold`는 `frameIndex()`로 검증 ✓
4. 화면 전환 상태를 모듈 전역 `let`으로 두지 않음 — `dragAim`은 팩토리가 클로저에 담는다 ✓
5. `engine/`이 Pixi를 import하지 않음 — `shot.ts` 변경은 순수 계산 ✓
6. 치트·디버그는 `devMode` 뒤에만 — 해당 없음 ✓
7. 생명주기를 부모 존재로 추측하지 않음 — `dragAim.cancel()`을 `finish()`에서 명시 호출 ✓
