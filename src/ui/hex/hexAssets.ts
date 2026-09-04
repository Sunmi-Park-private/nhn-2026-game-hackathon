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

/** 개발 중에는 매번 새로 받는다.
 *  에디터로 같은 경로에 덮어써도 브라우저가 옛 그림을 들고 있으면 「업로드가 안 먹는다」로 보인다.
 *  빌드본에는 붙지 않는다 — 파일 이름이 곧 버전이다. */
function bust(url: string): string {
  return import.meta.env.DEV ? `${url}${url.includes("?") ? "&" : "?"}v=${BOOT}` : url;
}
const BOOT = Date.now();

async function load(url: string | undefined): Promise<Texture | null> {
  if (!url) return null;
  let timer: ReturnType<typeof setTimeout> | undefined;
  const timeout = new Promise<null>((resolve) => {
    timer = setTimeout(() => resolve(null), LOAD_TIMEOUT_MS);
  });
  try {
    return await Promise.race([
      Assets.load<Texture>(bust(url)).catch(() => null),
      timeout,
    ]);
  } finally {
    if (timer !== undefined) clearTimeout(timer);
  }
}

/** 매니페스트 경로를 텍스처로 바꾼다. 없는 파일은 null — 화면이 폴백으로 그린다. */
export async function loadHexAssets(paths: HexAssetPaths): Promise<StageTextures> {
  const animalIds = Object.keys(paths.animals);
  const [tiles, animalTextures, horseshoe, cageClosed, openFrames, board, panelLeft, panelRight] =
    await Promise.all([
      Promise.all(paths.tiles.map(load)),
      Promise.all(animalIds.map((id) => loadFrames(paths.animals[id] ?? []))),
      load(paths.horseshoe),
      load(paths.cageClosed),
      loadFrames(paths.cageOpen),
      load(paths.bg.board),
      load(paths.bg.panelLeft),
      load(paths.bg.panelRight),
    ]);
  const cageOpen = openFrames;
  const horse = await loadFrames(paths.horse);

  const animals: Record<string, Texture[]> = {};
  animalIds.forEach((id, i) => { animals[id] = animalTextures[i] ?? []; });

  return { tiles, horseshoe, cageClosed, cageOpen, animals, horse, bg: { board, panelLeft, panelRight } };
}
