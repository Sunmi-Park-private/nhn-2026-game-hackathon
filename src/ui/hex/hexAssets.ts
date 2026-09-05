// ui/hex/hexAssets.ts — 헥사 에셋 로더. 경로는 주입받는다(규약 2조 — ../data를 직접 읽지 않는다).
import { Assets, type Texture } from "pixi.js";
import type { StageTextures } from "./stageScreen";
import type { HexAssetPaths } from "../../data/hexAssets";

/** 에셋 한 장을 기다리는 상한. 넘기면 폴백(색 육각)으로 간다.
 *
 *  파일이 없으면 dev 서버가 404가 아니라 index.html을 200으로 돌려준다(SPA 폴백).
 *  Pixi는 그 HTML을 이미지로 디코드하려다 거부도 성공도 하지 않고 멈추는 경우가 있고,
 *  그러면 부팅이 여기서 영영 서서 캔버스가 빈 채로 남는다 — 터널 URL에서 실제로 관측했다.
 *  에셋 한 장이 게임 전체를 막게 두지 않는다. */
const LOAD_TIMEOUT_MS = 4000;

/** 프레임 목록을 텍스처 배열로. 없는 파일은 걸러 낸다 — 중간이 비어도 재생은 이어진다. */
async function loadFrames(urls: readonly string[]): Promise<Texture[]> {
  const out = await Promise.all(urls.map(load));
  return out.filter((t): t is Texture => t !== null);
}

/** 에셋 경로는 그대로 쓴다 — `skin.ts`와 같은 이유다.
 *
 *  전에는 개발 중에 `?v=<부팅시각>`을 붙여 매번 새로 받게 했다. 에디터로 같은 경로에
 *  덮어썼을 때 옛 그림이 남는 것을 막으려던 것인데, **부팅마다 URL이 달라져 캐시가
 *  한 번도 안 맞았다.**
 *
 *  인게임은 로비보다 훨씬 무겁다 — 타일 6종 · 창살 · 붉은말 시퀀스 · 2MB 배경에
 *  **구출 동물 6종 186장(45MB)** 이 더해진다. 새로고침마다 그걸 통째로 다시 받았다.
 *
 *  dev 서버가 이미 `Cache-Control: no-cache` + ETag를 준다. 브라우저가 매번 물어보고
 *  안 바뀌었으면 304(본문 0바이트), 덮어썼으면 200으로 새 그림을 받는다.
 *  막으려던 문제는 그 장치가 이미 막고 있었다. */

async function load(url: string | undefined): Promise<Texture | null> {
  if (!url) return null;
  let timer: ReturnType<typeof setTimeout> | undefined;
  const timeout = new Promise<null>((resolve) => {
    timer = setTimeout(() => resolve(null), LOAD_TIMEOUT_MS);
  });
  try {
    return await Promise.race([
      Assets.load<Texture>(url).catch(() => null),
      timeout,
    ]);
  } finally {
    if (timer !== undefined) clearTimeout(timer);
  }
}

/** 동물 id → 프레임 목록을 텍스처 묶음으로. 키는 그대로 유지된다. */
async function framesByAnimal(paths: Record<string, string[]>): Promise<Record<string, Texture[]>> {
  const ids = Object.keys(paths);
  const loaded = await Promise.all(ids.map((id) => loadFrames(paths[id] ?? [])));
  const out: Record<string, Texture[]> = {};
  ids.forEach((id, i) => { out[id] = loaded[i] ?? []; });
  return out;
}

/** 동물 id → 스틸 한 장. 파일이 없는 동물은 키가 빠진다 — 화면이 폴백으로 그린다. */
async function stillByAnimal(paths: Record<string, string>): Promise<Record<string, Texture>> {
  const ids = Object.keys(paths);
  const loaded = await Promise.all(ids.map((id) => load(paths[id])));
  const out: Record<string, Texture> = {};
  ids.forEach((id, i) => {
    const t = loaded[i];
    if (t) out[id] = t;
  });
  return out;
}

/** 매니페스트 경로를 텍스처로 바꾼다. 없는 파일은 null — 화면이 폴백으로 그린다. */
export async function loadHexAssets(paths: HexAssetPaths): Promise<StageTextures> {
  const [tiles, animals, cageLocked, cageOpen, horseshoe, board, panelLeft, panelRight, ingamePanel] =
    await Promise.all([
      Promise.all(paths.tiles.map(load)),
      framesByAnimal(paths.animals),
      framesByAnimal(paths.cageLocked),
      stillByAnimal(paths.cageOpen),
      load(paths.horseshoe),
      load(paths.bg.board),
      load(paths.bg.panelLeft),
      load(paths.bg.panelRight),
      load(paths.bg.ingamePanel),
    ]);
  const horse = await loadFrames(paths.horse);

  return {
    tiles, horseshoe, cageLocked, cageOpen, animals, horse,
    horseHold: paths.horseHold,
    bg: { board, panelLeft, panelRight, ingamePanel },
  };
}
