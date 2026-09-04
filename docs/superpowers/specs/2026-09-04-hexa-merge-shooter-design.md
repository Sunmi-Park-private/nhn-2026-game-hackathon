# 헥사 머지 슈터 — 기술 설계

- 날짜: 2026-09-04 (T+1h30m)
- 상태: Director 승인 — 구현 플랜 착수
- 대상: Red Horse Rescue 2026 (nhn-2026-game-hackathon)
- 기획: `docs/GDD.md`
- 기준선: 초기 커밋 · 빌드 통과 · 테스트 150개 통과 (2026-09-04 실측)

---

## 1. 목적

본선 주제 공개로 장르가 사전 준비(스와이프 육성)와 완전히 달라졌다.
사전 제작물의 **인프라 계층은 그대로 살리고**, 게임 계층만 헥사 머지 슈터로 교체한다.

이 문서는 **무엇을 살리고 무엇을 버리며 무엇을 새로 쓰는지**를 확정한다.

---

## 2. 결정 사항 (Director 확정)

| 항목 | 결정 | 근거 |
|---|---|---|
| 합체 표현 | **색 = 티어 단일축** (빨→노→초→파→보→황금) | 아트 6종으로 끝. 2축이면 15종. **가시광선 파장 순서**라 「물리법칙」 키워드와 직결 |
| 합체 결과 | **하이브리드(C)** — 티어업, 최고 티어는 소멸+광역 폭발 | 「합체」가 이름뿐이 되지 않게 |
| 발사체 공급 | **판에 남은 색에서 추첨**(앞쪽 색 가중) | 쓸모없는 탄이 없다. 항상 빨강이면 상위 색 비용이 3의 거듭제곱이라 구출이 불가능해진다 — 플레이에서 발견해 되돌렸다 |
| 실패 조건 | **샷 리밋만** | 규칙 최소화. 밸런싱 시간 없음 |
| 인게임 AI | **없음** | 순수 규칙 게임. AI는 제작 과정으로 증명 |
| 메타 범위 | 코어 + 도감 + 연속 플레이 + 로비 연출 + 레벨 | 미션·상점·재화 제외 |
| 구 코드 처리 | **병렬 신규 라인** — import만 끊고 방치 | 절제에 3~5시간을 쓰지 않는다 |

---

## 3. 구 코드 처리 전략 — 병렬 신규 라인

### 채택

기존 화면 코드를 **삭제하지 않고 import만 끊는다.** `main.ts`를 새 부트 플로우로 교체하고, `engine/hex/`·`ui/hex/`를 새로 추가한다.

- 죽은 코드는 Vite 트리셰이킹으로 **번들에서 자동 제외**된다
- 구 코드는 현재 타입체크·테스트를 통과하므로 방치해도 **빌드가 깨지지 않는다**
- 삭제는 **일요일 새벽 동결 직전, 여유가 있으면** 커밋 하나로 처리한다. 그 시점이 무엇이 안 쓰이는지 가장 확실하다. 못 해도 손해가 없다

### 폐기한 대안

| 대안 | 비용 | 폐기 이유 |
|---|---|---|
| RAX §4 의존 역순 절제 선행 | 3~5시간 | 심사 가치 0인 작업에 금요일 밤을 태운다. 절제의 목적은 "새 코드 쓸 공간 확보"였고, 실제로 공간을 막는 건 파일 존재가 아니라 시간이다 |
| 신규 레포 | 8시간+ | 재사용 자산 약 2,000줄과 CI·배포·에디터 파이프라인을 버린다 |

### diff 증명

초기 커밋 이후 **추가된 파일 = 본선 작업**이 한눈에 보인다. 디렉팅 명세서에 그대로 쓸 수 있다.

---

## 4. 재사용 판정 (실측 기반)

### 4-1. 그대로 살림 — 수정 0

| 영역 | 파일 |
|---|---|
| 좌표계 | `ui/stage.ts` — 430×800 논리 좌표 SSOT. **세로 캔버스가 이 장르에 정확히 맞는다** |
| 에셋 | `ui/assets.ts` `ui/hotAssets.ts` `ui/videoLoad.ts` `ui/loopVideo.ts` — 매니페스트 로더 + 핫리로드 |
| 오디오 | `ui/audio.ts` `ui/haptics.ts` |
| 레이아웃·스킨 | `ui/layout.ts` `ui/uiSkin.ts` `ui/bgSlots.ts` |
| UI 공통 | `ui/press.ts` `ui/btnLabel.ts` `ui/ease.ts` |
| 개발 도구 | `ui/devMode.ts` `ui/keys.ts` `ui/editor.ts` |
| 에디터 | `tools/uiEditor.ts` `tools/bgEditor.ts` `tools/bgmEditor.ts` `tools/editorHub.ts` |
| 비코드 | `.github` CI·자동배포 · Capacitor/android/ios · WebP 파이프라인 · `layout.json` · `uiskins.json` |

> **디자이너가 파일만 드롭하면 게임에 반영되고 핫리로드까지 되는 파이프라인이 통째로 유효하다.**
> 아트가 지금 제작 중인 상황과 정확히 맞물린다.

### 4-2. 수정해서 재사용

| 파일 | 용도 변경 |
|---|---|
| `main.ts` | 부트 플로우 교체 (로비 ⇄ 게임 루프 → 로비 ⇄ 스테이지 루프) |
| `ui/boot.ts` | 프롤로그·로딩·타이틀 유지, 로비만 목장으로 교체 |
| `ui/gaugeBar.ts` | → 플레이어 레벨 게이지 |
| `ui/levelUpFx.ts` | → **구출 연출** |
| `ui/lobbyStatusBar.ts` | → 목장 상단 바 |
| `ui/cheatMenu.ts` | 스테이지 점프 치트 (기존 minigames 호출부 제거) |

### 4-3. import만 끊고 방치

`swipeCard` · `cardDeckSheet` · `cardArt` · `charSkins` · `memberBoard` · `training` · `sidePanels` · `metaMenu` · `minigames` · `runController` · `runStatus` · `screens` · `tutorial` · `calendar` · `deck` · `beatsPreview` · `tools/flowEditor` · `subgames/` · `engine/` 대부분

---

## 5. 아키텍처

기존 단방향 의존 규칙을 그대로 따른다.

```
src/data/stages/*.json          스테이지 레이아웃
        ↓
src/engine/hex/                 순수 TS · Pixi 의존 0 · 헤드리스 테스트
        ↓
src/ui/hex/                     Pixi 렌더 · 파일당 200줄 상한
```

`engine/hex/`가 렌더러를 모르므로 **머지·낙하·궤적을 테스트만으로 밸런싱할 수 있다.**
렌더가 미완이어도 로직을 확정할 수 있다는 뜻이고, 이것이 토 13:00 게이트를 지키는 열쇠다.

### 5-1. 엔진 모듈

| 파일 | 책임 | 예상 |
|---|---|---:|
| `engine/hex/coords.ts` | 축좌표(q,r) · 6이웃 · `ring(n)` · 픽셀 변환 · 거리 | ~80 |
| `engine/hex/grid.ts` | 셀 맵 · 점유 판정 · 케이지 멀티셀 점유 · 경계 | ~120 |
| `engine/hex/merge.ts` | 연결 성분(flood fill) · 티어업 · 연쇄 · 황금 폭발 | ~120 |
| `engine/hex/gravity.ts` | 앵커 연결성 · 부유 클러스터 탐지 · 낙하 목록 | ~80 |
| `engine/hex/shot.ts` | 궤적 · 벽 반사 · 충돌 · 스냅 셀 결정 | ~150 |
| `engine/hex/stageRun.ts` | 샷 카운트 · 구출 판정 · 목표 · 승패 | ~120 |
| `engine/hex/boosters.ts` | 폭탄 · 레인보우 · 말굽 | ~80 |
| `engine/hex/types.ts` | 타일 · 셀 · 케이지 · 스테이지 · 런 상태 | ~80 |

**신규 엔진 합계 약 830줄.**

### 5-2. UI 모듈 (규약 1조 — 200줄 상한)

| 파일 | 책임 |
|---|---|
| `ui/hex/boardView.ts` | 그리드 렌더 · 타일 스프라이트 관리 |
| `ui/hex/launcher.ts` | 조준 · 발사 · 궤적 가이드라인 |
| `ui/hex/cageView.ts` | 케이지 렌더 · 구출 연출 |
| `ui/hex/hudView.ts` | STAGE · 목표 카운터 · NEXT · 부스터 슬롯 |
| `ui/hex/fx.ts` | 합체 · 폭발 · 낙하 파티클 |
| `ui/hex/stageScreen.ts` | 화면 조립 · 입력 → 엔진 → 렌더 배선 |

### 5-3. 메타 모듈

| 파일 | 책임 |
|---|---|
| `ui/meta/ranch.ts` | 로비 목장 · 구출 동물 배치 |
| `ui/meta/codex.ts` | 도감 그리드 |
| `ui/meta/stageSelect.ts` | 스테이지 선택 |
| `engine/meta/profile.ts` | 구출 누적 · 레벨 · 세이브 |

---

## 6. 좌표계

**축좌표(axial) `q, r` · pointy-top · 가로 행 스태거.**

```
이웃 6방향: (+1,0) (+1,−1) (0,−1) (−1,0) (−1,+1) (0,+1)

픽셀 변환:  x = size · √3 · (q + r/2)
           y = size · 1.5 · r
```

`stage.ts`의 430×800 좌표계 안에서:

| 값 | 수치 |
|---|---:|
| 육각 반지름 | 30px |
| 셀 폭 (√3 × 30) | 52px |
| 열 수 | 7 |
| 보드 폭 (7열) | 364px |
| 좌우 여백 | 33px |

여백 자리에 아트의 나무 프레임(반사벽)이 온다.

---

## 7. 데이터 스키마

규약 3조에 따라 `as unknown as`로 받지 않는다. 런타임 검증을 거친다.

```ts
// engine/hex/types.ts
/** 0=빨강(최하위, 발사체) 1=노랑 2=초록 3=파랑 4=보라 5=황금(최고).
 *  기획서의 T1~T6과 1:1 대응하되 배열 인덱스와 맞추기 위해 0부터 센다. */
export type Tier = 0 | 1 | 2 | 3 | 4 | 5;
export interface Axial { q: number; r: number }

export type Cell =
  | { kind: "empty" }
  | { kind: "tile"; tier: Tier }
  | { kind: "horseshoe" }
  | { kind: "cage"; cageId: string };

export interface Cage {
  id: string;
  animalId: string;
  cells: Axial[];        // 멀티셀 점유 (아트 기준 가로 2셀)
}

export interface StageDef {
  id: string;
  objective: number;     // 구출 목표 마릿수
  shots: number;         // 샷 리밋
  cages: Cage[];
  tiles: Array<{ at: Axial; tier: Tier }>;
  horseshoes: Axial[];
}
```

스테이지 JSON은 `src/data/stages/`에 둔다.

---

## 8. 핵심 알고리즘

### 8-1. 스냅 (shot.ts)

1. 발사 각도로 직선 진행, 좌우 벽에서 반사
2. 매 스텝마다 점유 셀(타일·케이지)과의 충돌 검사
3. 충돌 시 **직전 위치에서 가장 가까운 빈 셀**을 스냅 대상으로 결정
4. 케이지 셀은 충돌하되 스냅 대상이 되지 않는다 (비배치)

> **이 프로젝트에서 가장 어려운 코드다.** 원형 버블 슈터보다 스냅 대상 선정이 까다롭다.
> 가장 먼저, 테스트와 함께 쓴다.

### 8-2. 합체 (merge.ts)

```
스냅 → 같은 tier 연결 성분 계산 (flood fill, 6이웃)
     → size ≥ 3 이면 합체
     → tier < 5 이면: 착탄 지점에 tier+1 배치, 나머지 셀 empty
                      새 타일 기준 재판정 (연쇄)
     → tier == 5(황금)이면: 가시광선을 벗어나 승급할 색이 없으므로 폭발한다.
                      성분 전체 + ring(착탄지점, 1) 6칸을 empty로.
                      폭발로 비워진 자리는 재판정하지 않는다 (연쇄 종료)
```

연쇄는 **재귀가 아니라 큐**로 처리한다 — 깊이 폭주를 막고 연출 타이밍을 프레임에 맞춰 흘리기 위해서다.

### 8-3. 낙하 (gravity.ts)

```
앵커 = 최상단 행의 타일 + 모든 케이지 셀
BFS로 앵커에서 도달 가능한 셀 집합 계산
도달 불가 타일 = 부유 클러스터 → 낙하 목록
```

케이지가 앵커이므로 **케이지 주변 타일은 저절로 떨어지지 않는다.** 난이도의 원천.

### 8-4. 구출 판정 (stageRun.ts)

```
각 케이지에 대해: cells의 모든 이웃 셀이 empty 인가?
   → 참이면 구출 처리, 목표 카운터 증가
```

---

## 9. 상태 관리

규약 4조에 따라 **화면 전환 상태를 모듈 전역 `let`으로 두지 않는다.**

```ts
export interface RunState {
  stage: StageDef;
  cells: Map<string, Cell>;   // "q,r" → Cell
  shotsLeft: number;
  rescued: string[];          // 구출한 animalId
  horseshoes: number;
  boosters: { bomb: number; rainbow: number; horseshoe: number };
  loaded: Tier;               // 현재 장전된 티어
  next: Tier;
}
```

`RunState`를 명시적으로 넘기고, UI는 이것을 읽어 그린다. 엔진 함수는 전부 `(state, input) → result` 형태의 순수 함수다.

---

## 10. 테스트 전략

`engine/hex/`가 Pixi를 모르므로 vitest로 헤드리스 검증한다.

| 대상 | 검증 |
|---|---|
| `coords` | 이웃 6방향 · ring 크기 · 픽셀 왕복 변환 |
| `merge` | 3개 합체 · 연쇄 · 황금 폭발 · 2개는 합체 안 됨 |
| `gravity` | 앵커 끊긴 덩어리 탐지 · 케이지 앵커 효과 |
| `shot` | 직진 스냅 · 벽 반사 · 케이지 비배치 |
| `stageRun` | 구출 판정 · 샷 소진 실패 · 목표 달성 클리어 |

기존 150개 테스트는 그대로 통과 상태를 유지한다 (구 코드를 건드리지 않으므로).

---

## 11. 리스크

| # | 리스크 | 완화 |
|---|---|---|
| 1 | **궤적·벽 반사·스냅**이 가장 어렵다 | 최우선 착수. 테스트 먼저 |
| 2 | **케이지 멀티셀**이 충돌 판정을 복잡하게 만든다 | **1셀 케이지로 시작**해서 동작 후 2셀로 확장 |
| 3 | **아트 도착 시점** 불확실 | Pixi `Graphics` 색 육각 플레이스홀더로 개발. 아트를 기다리지 않는다 |
| 4 | 밸런싱 시간 부족 | 스테이지 생성기 + 데드락 방지 보정을 자동화 |

---

## 12. 절대 어기지 않을 것 (CLAUDE.md 승계)

1. 메커닉은 하나로 확정하고 이후 추가하지 않는다
3. 토 13:00에 플레이 가능하지 않으면 시간을 더 쓰지 말고 자른다
4. 일 03:00 코드 동결 이후 건드리지 않는다 — 미완 기능은 고치지 말고 **뺀다**
