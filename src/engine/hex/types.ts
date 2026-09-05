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

/** 셀 내용. 빈 칸은 Map에 키가 없는 것으로 표현한다(별도 empty 종류를 두지 않는다).
 *
 *  타일의 `armor`는 얹힌 말발굽 겹수다. 없거나 0이면 보통 타일이다.
 *  같은 색 덩어리가 터질 때 말발굽이 있는 칸은 **사라지지 않고 한 겹만 벗겨진다** —
 *  2겹으로 시작하므로 세 번 맞아야 없어진다(버팀 → 말발굽 떨어짐 → 제거). */
export type Cell =
  | { kind: "tile"; tier: Tier; armor?: number }
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
  /** 새 줄이 한 칸 내려오는 주기(초). 실패 조건이 여기서 나온다. */
  pushSeconds: number;
  /** 새 줄의 타일이 말발굽을 얹고 나올 확률(0~1). 0이면 강화 타일이 없다. */
  armorChance: number;
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
  /** 지금까지 쏜 횟수. 제한이 아니라 기록이다 — 봇 측정의 단위가 된다. */
  shotsFired: number;
  /** 위에서 내려보낸 줄 수. 난이도의 새 단위다. */
  pushes: number;
  /** 창살의 **현재** 자리. 줄이 내려오면 창살도 같이 내려가므로
   *  stage.cages(고정 정의)를 그대로 쓸 수 없다. */
  cages: Cage[];
  /** 새 줄에 깔 색. 스테이지 초기 타일에서 뽑아 고정한다 —
   *  판에 남은 색에서 뽑으면 판이 비어 갈수록 색이 줄어 새 줄이 단조로워진다. */
  palette: Tier[];
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
