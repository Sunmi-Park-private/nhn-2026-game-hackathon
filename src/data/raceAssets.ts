// data/raceAssets.ts — 레이스가 쓰는 에셋 경로. assets.json을 필드별로 검증한다(규약 3조).
//
// 파일이 public/ 아래 없으면 화면이 폴백을 그린다 — **아트 0장으로도 레이스는 끝까지 돈다.**
import manifestJson from "./assets.json";

export const RACE_UI_ASSET_IDS = [
  "back", "titleBanner", "pick", "distBar", "run", "runPressed",
  "resultPanel", "bestTag", "retry", "close",
] as const;
export type RaceUiAssetId = (typeof RACE_UI_ASSET_IDS)[number];

const RACE_BG_IDS = ["sky", "mid", "track", "startGate", "finish"] as const;
type RaceBgId = (typeof RACE_BG_IDS)[number];

/** 화면이 좌표를 찾을 때 쓰는 슬롯 id. uiLayout.json의 race 영역과 같아야 한다. */
export const RACE_SLOT_IDS = [
  "back", "gear", "titleBanner", "myRunnerTag", "trackArea", "rosterHint", "pick",
  "countdown", "hudRank", "hudTime", "distBar", "run",
  "resultPanel", "resultTitle", "resultList", "bestTag", "rewardIcon", "rewardLabel", "retry", "close",
] as const;
export type RaceSlotId = (typeof RACE_SLOT_IDS)[number];

export type BoosterAssetId = "bomb" | "rainbow" | "horseshoe";
const BOOSTER_IDS: readonly BoosterAssetId[] = ["bomb", "rainbow", "horseshoe"];

export interface RaceAssetPaths {
  /** 배경 3층과 게이트·결승선. 3층은 가로로 이어 붙여 무한 스크롤한다 */
  bg: Partial<Record<RaceBgId, string>>;
  /** 동물 id → 달리기 시퀀스. 한 장만 넣으면 스틸로 동작한다 */
  runners: Record<string, string[]>;
  ui: Partial<Record<RaceUiAssetId, string>>;
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
    runners,
    ui: pick(obj(race.ui), RACE_UI_ASSET_IDS),
    booster: pick(obj(obj(root.hex).booster), BOOSTER_IDS),
  };
}

export const raceAssetPaths: RaceAssetPaths = parseRaceAssets(manifestJson);
