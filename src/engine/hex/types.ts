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
