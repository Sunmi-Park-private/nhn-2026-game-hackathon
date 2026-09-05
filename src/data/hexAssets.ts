// data/hexAssets.ts — 화면이 쓰는 에셋 경로. assets.json을 타입으로 받는다.
//
// 매니페스트를 런타임에 검증한다(규약 3조). 디자이너가 경로를 잘못 적으면
// 화면이 아니라 여기서 드러나야 한다.
import manifestJson from "./assets.json";

export interface HexAssetPaths {
  /** tier 0~5 순서 고정 — 배열 길이는 항상 6 */
  tiles: Array<string | undefined>;
  horseshoe?: string;
  /** 창살(잠금) — 동물마다 **이미지 시퀀스**. 갇혀 있는 동안 계속 돈다.
   *  한 장만 넣으면 스틸로 동작한다. 키는 data/animals.ts의 id다. */
  cageLocked: Record<string, string[]>;
  /** 창살(해제) — 동물마다 스틸 한 장. 잠금이 풀린 자리를 덮는다 */
  cageOpen: Record<string, string>;
  /** 동물마다 시퀀스. 한 장만 넣으면 스틸로 동작한다 */
  animals: Record<string, string[]>;
  /** 화면 하단 붉은말(발사대) — 시퀀스 */
  horse: string[];
  /** 그 시퀀스에서 **팔이 최대로 접힌 프레임**(0-based).
   *  앞은 당김(드래그로 스크럽), 뒤는 토스(놓으면 재생)로 갈린다.
   *  디자이너가 에디터에서 찍는다. 안 찍었으면 한가운데를 쓴다. */
  horseHold: number;
  bg: {
    board?: string;
    panelLeft?: string;
    panelRight?: string;
    /** 인게임 화면에 얹는 패널 한 장. 판 배경과 별개로, 자리는 ingame/bgPanel 슬롯이 정한다 */
    ingamePanel?: string;
  };
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

/** 동물 id → 프레임 목록. 파일이 하나도 없는 동물은 키 자체가 빠진다 —
 *  화면이 「아트 있음」을 길이로 판단하므로 빈 배열을 남기면 안 된다. */
function framesByAnimal(raw: unknown): Record<string, string[]> {
  const out: Record<string, string[]> = {};
  for (const [id, file] of Object.entries((raw ?? {}) as Record<string, unknown>)) {
    const f = frames(file);
    if (f.length > 0) out[id] = f;
  }
  return out;
}

/** 동물 id → 스틸 한 장. 값이 비면 키가 빠진다. */
function strByAnimal(raw: unknown): Record<string, string> {
  const out: Record<string, string> = {};
  for (const [id, file] of Object.entries((raw ?? {}) as Record<string, unknown>)) {
    const one = str(file);
    if (one) out[id] = one;
  }
  return out;
}

/** 프레임 인덱스. 범위를 벗어나거나 정수가 아니면 한가운데로 접는다 —
 *  디자이너 오투입이 런타임 예외가 되면 안 된다(규약 3조).
 *  테스트를 위해 export한다 — 파싱된 결과(hexAssetPaths)만으로는 현재
 *  매니페스트 값이 항상 유효해서 잘못된 분기에 닿을 수 없다. */
export function frameIndex(v: unknown, len: number): number {
  if (len === 0) return 0;
  if (typeof v !== "number" || !Number.isInteger(v) || v < 0 || v >= len) {
    return Math.floor(len / 2);
  }
  return v;
}

function parse(raw: unknown): HexAssetPaths {
  const hex = (raw as { hex?: Record<string, unknown> }).hex ?? {};
  const tilesRaw = Array.isArray(hex.tiles) ? hex.tiles : [];
  // 길이 6 고정 — StageTextures[tier] 인덱싱이 항상 안전해야 한다
  const tiles = Array.from({ length: 6 }, (_, i) => str(tilesRaw[i]));

  const animals = framesByAnimal(hex.animals);

  const bgRaw = (hex.bg ?? {}) as Record<string, unknown>;
  const horse = frames(hex.horse);
  return {
    tiles,
    horseshoe: str(hex.horseshoe),
    cageLocked: framesByAnimal(hex.cageLocked),
    cageOpen: strByAnimal(hex.cageOpen),
    horse,
    horseHold: frameIndex(hex.horseHold, horse.length),
    animals,
    bg: {
      board: str(bgRaw.board),
      panelLeft: str(bgRaw.panelLeft),
      panelRight: str(bgRaw.panelRight),
      ingamePanel: str(bgRaw.ingamePanel),
    },
  };
}

export const hexAssetPaths: HexAssetPaths = parse(manifestJson);

// ── UI 스킨 · 로비 슬롯 ───────────────────────────────────────
// 아트가 없으면 코드가 그린 기본 도형으로 폴백한다. 슬롯을 늘려도 화면은 안 깨진다.

export const UI_SLOT_IDS = [
  "settingsPanel", "settingsClose", "toggleOn", "toggleOff", "btnResume", "btnHome", "gear", "stageBar",
  // 확인창 — 설정창 위에 겹쳐 뜬다. 아트가 없으면 지금처럼 색 도형으로 그린다.
  "confirmPanel", "btnConfirmOk", "btnConfirmCancel",
  // 게임오버 창 — 판이 바닥에 닿으면 뜬다. 확인창과 아트를 나누는 이유는 새겨진 문구가 다르기 때문.
  "gameOverPanel", "btnGameOverLobby", "btnGameOverRetry",
] as const;
export type UiSlotId = (typeof UI_SLOT_IDS)[number];

export const LOBBY_SLOT_IDS = [
  "bg", "topStats", "play",
  "navHome", "navRace", "navAnimals", "navEvents",
] as const;
export type LobbySlotId = (typeof LOBBY_SLOT_IDS)[number];

/** 로비 배경 영상 — 장면 키 → mp4 경로. 구출 마릿수마다 한 편이다.
 *  텍스처가 아니라 **경로**로 내보낸다: 용량이 커서 부팅 때 다 받으면 첫 화면이
 *  늦어지고, 한 번에 쓰는 것은 한 편뿐이라 로비가 그때 받는 편이 싸다.
 *  키의 동물과 그 장면의 동물은 무관하다 — data/lobbyScene.ts 참조. */
export const lobbySceneVideoPaths: Record<string, string> = record(manifestJson, "lobby", "friends");

/** 월드 지도 화면 — 배경 한 장과 돌아가기 버튼. 톱니는 로비 것을 그대로 쓴다. */
export const WORLD_SLOT_IDS = ["bg", "back"] as const;
export type WorldSlotId = (typeof WORLD_SLOT_IDS)[number];

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
export const worldAssetPaths = pick(manifestJson, "world", WORLD_SLOT_IDS);

/** 이벤트 화면 — 배경 한 장과 닫기·스테이지 버튼. */
export const EVENT_SLOT_IDS = ["bg", "close", "cta"] as const;
export type EventSlotId = (typeof EVENT_SLOT_IDS)[number];
export const eventAssetPaths = pick(manifestJson, "event", EVENT_SLOT_IDS);

// ── 영상 ────────────────────────────────────────────────────
// 인트로(프롤로그)와 엔딩. 세로 화면 전체를 덮는다. 파일이 없으면 그 단계를 건너뛴다.
// loading은 에셋을 받는 동안 도는 배경 루프다 — 없으면 패널만 뜬다(ui/loadingScreen.ts).

export const VIDEO_SLOT_IDS = ["intro", "ending", "loading"] as const;
export type VideoSlotId = (typeof VIDEO_SLOT_IDS)[number];

export const videoAssetPaths = pick(manifestJson, "video", VIDEO_SLOT_IDS);

// ── 도감 ────────────────────────────────────────────────────
// 패널 한 장과 동물마다 카드 두 장(해제·잠김). 카드는 이름표까지 그려진 한 장이라
// 아트가 있으면 코드는 글자를 얹지 않는다.

export interface CollectionAssetPaths {
  panel?: string;
  close?: string;
  /** 구출한 동물의 카드 */
  cards: Record<string, string>;
  /** 아직 못 구한 동물의 실루엣 카드 */
  locked: Record<string, string>;
}

function record(raw: unknown, block: string, key: string): Record<string, string> {
  const src = (((raw as Record<string, unknown>)[block] ?? {}) as Record<string, unknown>)[key];
  const out: Record<string, string> = {};
  for (const [k, v] of Object.entries((src ?? {}) as Record<string, unknown>)) {
    const f = str(v);
    if (f) out[k] = f;
  }
  return out;
}

export const collectionAssetPaths: CollectionAssetPaths = {
  ...pick(manifestJson, "collection", ["panel", "close"] as const),
  cards: record(manifestJson, "collection", "cards"),
  locked: record(manifestJson, "collection", "locked"),
};

// ── 소리 ────────────────────────────────────────────────────
// BGM 2종과 효과음 6종. 파일이 없는 슬롯은 그냥 소리가 안 난다 — 게임은 정상 동작한다.

export const AUDIO_SLOT_IDS = [
  "bgmLobby", "bgmStage", "bgmRace",
  "sfxShot", "sfxPop", "sfxRescue", "sfxClear", "sfxFail", "sfxTap",
  "sfxWhistle", "sfxStep", "sfxRouletteTick", "sfxFinish", "sfxRecord",
] as const;
export type AudioSlotId = (typeof AUDIO_SLOT_IDS)[number];

export const audioAssetPaths = pick(manifestJson, "audio", AUDIO_SLOT_IDS);
