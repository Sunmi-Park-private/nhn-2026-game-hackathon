// data/hexAssets.ts — 화면이 쓰는 에셋 경로. assets.json을 타입으로 받는다.
//
// 매니페스트를 런타임에 검증한다(규약 3조). 디자이너가 경로를 잘못 적으면
// 화면이 아니라 여기서 드러나야 한다.
import manifestJson from "./assets.json";

export interface HexAssetPaths {
  /** tier 0~5 순서 고정 — 배열 길이는 항상 6 */
  tiles: Array<string | undefined>;
  horseshoe?: string;
  /** 잠긴 우리 — 스틸 한 장 */
  cageClosed?: string;
  /** 잠금이 풀리는 순간 — **이미지 시퀀스**. 한 장만 넣으면 스틸로 동작한다 */
  cageOpen: string[];
  /** 동물마다 시퀀스. 한 장만 넣으면 스틸로 동작한다 */
  animals: Record<string, string[]>;
  /** 화면 하단 붉은말(발사대) — 시퀀스 */
  horse: string[];
  bg: { board?: string; panelLeft?: string; panelRight?: string };
}

function str(v: unknown): string | undefined {
  return typeof v === "string" && v.length > 0 ? v : undefined;
}

/** 문자열 하나든 배열이든 프레임 목록으로 받는다 — 한 장짜리는 스틸이 된다. */
function frames(v: unknown): string[] {
  if (Array.isArray(v)) return v.map(str).filter((x): x is string => x !== undefined);
  const one = str(v);
  return one ? [one] : [];
}

function parse(raw: unknown): HexAssetPaths {
  const hex = (raw as { hex?: Record<string, unknown> }).hex ?? {};
  const tilesRaw = Array.isArray(hex.tiles) ? hex.tiles : [];
  // 길이 6 고정 — StageTextures[tier] 인덱싱이 항상 안전해야 한다
  const tiles = Array.from({ length: 6 }, (_, i) => str(tilesRaw[i]));

  const animals: Record<string, string[]> = {};
  const animalsRaw = (hex.animals ?? {}) as Record<string, unknown>;
  for (const [id, file] of Object.entries(animalsRaw)) {
    const f = frames(file);
    if (f.length > 0) animals[id] = f;
  }

  const bgRaw = (hex.bg ?? {}) as Record<string, unknown>;
  return {
    tiles,
    horseshoe: str(hex.horseshoe),
    cageClosed: str(hex.cageClosed),
    cageOpen: frames(hex.cageOpen),
    horse: frames(hex.horse),
    animals,
    bg: { board: str(bgRaw.board), panelLeft: str(bgRaw.panelLeft), panelRight: str(bgRaw.panelRight) },
  };
}

export const hexAssetPaths: HexAssetPaths = parse(manifestJson);

// ── UI 스킨 · 로비 슬롯 ───────────────────────────────────────
// 아트가 없으면 코드가 그린 기본 도형으로 폴백한다. 슬롯을 늘려도 화면은 안 깨진다.

export const UI_SLOT_IDS = [
  "settingsPanel", "settingsClose", "toggleOn", "toggleOff", "btnResume", "btnHome", "gear",
] as const;
export type UiSlotId = (typeof UI_SLOT_IDS)[number];

export const LOBBY_SLOT_IDS = [
  "bg", "topStats", "play",
  "navHome", "navAnimals", "navEvents", "navSoon",
] as const;
export type LobbySlotId = (typeof LOBBY_SLOT_IDS)[number];

function pick<K extends string>(raw: unknown, block: string, keys: readonly K[]): Partial<Record<K, string>> {
  const src = ((raw as Record<string, unknown>)[block] ?? {}) as Record<string, unknown>;
  const out: Partial<Record<K, string>> = {};
  for (const k of keys) {
    const v = str(src[k]);
    if (v) out[k] = v;
  }
  return out;
}

export const uiAssetPaths = pick(manifestJson, "ui", UI_SLOT_IDS);
export const lobbyAssetPaths = pick(manifestJson, "lobby", LOBBY_SLOT_IDS);

// ── 영상 ────────────────────────────────────────────────────
// 인트로(프롤로그)와 엔딩. 세로 화면 전체를 덮는다. 파일이 없으면 그 단계를 건너뛴다.

export const VIDEO_SLOT_IDS = ["intro", "ending"] as const;
export type VideoSlotId = (typeof VIDEO_SLOT_IDS)[number];

export const videoAssetPaths = pick(manifestJson, "video", VIDEO_SLOT_IDS);
