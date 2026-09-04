// data/hexAssets.ts — 헥사 화면이 쓰는 에셋 경로. assets.json의 hex 블록을 타입으로 받는다.
//
// 매니페스트를 런타임에 검증한다(규약 3조). 디자이너가 경로를 잘못 적으면
// 화면이 아니라 여기서 드러나야 한다.
import manifestJson from "./assets.json";

export interface HexAssetPaths {
  /** tier 0~5 순서 고정 — 배열 길이는 항상 6 */
  tiles: Array<string | undefined>;
  horseshoe?: string;
  cageClosed?: string;
  cageOpen?: string;
  animals: Record<string, string>;
  bg: { board?: string; panelLeft?: string; panelRight?: string };
}

function str(v: unknown): string | undefined {
  return typeof v === "string" && v.length > 0 ? v : undefined;
}

function parse(raw: unknown): HexAssetPaths {
  const hex = (raw as { hex?: Record<string, unknown> }).hex ?? {};
  const tilesRaw = Array.isArray(hex.tiles) ? hex.tiles : [];
  // 길이 6 고정 — StageTextures[tier] 인덱싱이 항상 안전해야 한다
  const tiles = Array.from({ length: 6 }, (_, i) => str(tilesRaw[i]));

  const animals: Record<string, string> = {};
  const animalsRaw = (hex.animals ?? {}) as Record<string, unknown>;
  for (const [id, file] of Object.entries(animalsRaw)) {
    const f = str(file);
    if (f) animals[id] = f;
  }

  const bgRaw = (hex.bg ?? {}) as Record<string, unknown>;
  return {
    tiles,
    horseshoe: str(hex.horseshoe),
    cageClosed: str(hex.cageClosed),
    cageOpen: str(hex.cageOpen),
    animals,
    bg: { board: str(bgRaw.board), panelLeft: str(bgRaw.panelLeft), panelRight: str(bgRaw.panelRight) },
  };
}

export const hexAssetPaths: HexAssetPaths = parse(manifestJson);
