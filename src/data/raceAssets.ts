// data/raceAssets.ts — 레이스가 쓰는 에셋 경로. assets.json을 필드별로 검증한다(규약 3조).
//
// 파일이 public/ 아래 없으면 화면이 폴백을 그린다 — **아트 0장으로도 레이스는 끝까지 돈다.**
// 구조는 디자이너 시안 3화면(선택·경주·결과)을 그대로 따른다.
import manifestJson from "./assets.json";

export const RACE_BG_IDS = ["selectScene", "raceScene", "resultScene", "trackTile", "finish"] as const;
export const RACE_UI_IDS = [
  "back", "gear", "btnSelect", "btnRace",
  "podium", "btnRetry", "btnClose",
] as const;
export const RACE_CARD_IDS = ["grid", "off", "on"] as const;
export const RACE_ROW_IDS = ["list", "first", "rest"] as const;
export const RACE_MEDAL_IDS = ["gold", "silver", "bronze"] as const;
export const BOOSTER_IDS = ["bomb", "rainbow", "horseshoe"] as const;

export type RaceBgId = (typeof RACE_BG_IDS)[number];
export type RaceUiId = (typeof RACE_UI_IDS)[number];
export type BoosterAssetId = (typeof BOOSTER_IDS)[number];

export interface RaceAssetPaths {
  bg: Partial<Record<RaceBgId, string>>;
  ui: Partial<Record<RaceUiId, string>>;
  /** 동물 id → 달리기 시퀀스(옆모습). 한 장만 넣으면 스틸로 돈다 */
  runners: Record<string, string[]>;
  /** 동물 id → 정면 얼굴. 선택 카드와 순위 행이 쓴다 */
  faces: Record<string, string>;
  /** 동물 id → 1위 축하 포즈. 없으면 얼굴을 크게 쓴다 */
  winner: Record<string, string>;
  /** grid = 6종 타일 한 장 · on = 선택 테두리 · off = 낱장 판(격자를 쓰면 안 쓴다) */
  card: Partial<Record<"grid" | "off" | "on", string>>;
  /** list = 6행 판 한 장(메달까지 구워서) · first/rest = 낱장 판(폴백) */
  row: Partial<Record<"list" | "first" | "rest", string>>;
  medal: Partial<Record<"gold" | "silver" | "bronze", string>>;
  /** 부스터 아이콘 — 인게임(hex)이 소유하고 레이스가 참조한다 */
  booster: Partial<Record<BoosterAssetId, string>>;
}

const str = (v: unknown): string | undefined =>
  typeof v === "string" && v.length > 0 ? v : undefined;

/** 문자열 하나든 배열이든 프레임 목록으로 받는다 — 한 장짜리는 스틸이 된다. */
const frames = (v: unknown): string[] => {
  if (Array.isArray(v)) return v.map(str).filter((x): x is string => x !== undefined);
  const one = str(v);
  return one ? [one] : [];
};

const obj = (v: unknown): Record<string, unknown> =>
  v !== null && typeof v === "object" ? (v as Record<string, unknown>) : {};

function pick<K extends string>(src: Record<string, unknown>, keys: readonly K[]): Partial<Record<K, string>> {
  const out: Partial<Record<K, string>> = {};
  for (const k of keys) {
    const v = str(src[k]);
    if (v) out[k] = v;
  }
  return out;
}

/** 동물 id → 파일 한 장. 값이 비면 키가 빠진다 — 화면이 유무로 폴백을 정한다. */
function byAnimal(raw: unknown): Record<string, string> {
  const out: Record<string, string> = {};
  for (const [id, v] of Object.entries(obj(raw))) {
    const one = str(v);
    if (one) out[id] = one;
  }
  return out;
}

export function parseRaceAssets(raw: unknown): RaceAssetPaths {
  const root = obj(raw);
  const race = obj(root.race);

  const runners: Record<string, string[]> = {};
  for (const [id, v] of Object.entries(obj(race.runners))) {
    const f = frames(v);
    // 빈 배열을 남기면 화면이 「아트 있음」으로 오판한다 — 길이로 판단하기 때문
    if (f.length > 0) runners[id] = f;
  }

  return {
    bg: pick(obj(race.bg), RACE_BG_IDS),
    ui: pick(obj(race.ui), RACE_UI_IDS),
    runners,
    faces: byAnimal(race.faces),
    winner: byAnimal(race.winner),
    card: pick(obj(race.card), RACE_CARD_IDS),
    row: pick(obj(race.row), RACE_ROW_IDS),
    medal: pick(obj(race.medal), RACE_MEDAL_IDS),
    booster: pick(obj(obj(root.hex).booster), BOOSTER_IDS),
  };
}

export const raceAssetPaths: RaceAssetPaths = parseRaceAssets(manifestJson);
