// main.ts — Pixi 부트스트랩 + 스테이지 루프.
//
// 부트 체인에서 프롤로그·로딩·타이틀을 뺐다. 셋 다 이 게임의 화면이 아니라
// 접속자가 1분 가까이 다른 화면을 본 뒤에야 게임에 도착했다.
// 화면 코드 자체는 ui/boot.ts에 남아 있고 import만 끊었다 — 번들에서는 빠진다.
import { Application, VideoSource, type Texture } from "pixi.js";
import { loadHexAssets } from "./ui/hex/hexAssets";
import { hexAssetPaths, uiAssetPaths, lobbyAssetPaths, lobbySceneVideoPaths, eventAssetPaths, collectionAssetPaths, videoAssetPaths } from "./data/hexAssets";
import { raceAssetPaths } from "./data/raceAssets";
import { loadSlots, loadTexture } from "./ui/skin";
import { runLobby } from "./ui/lobbyScreen";
import { parseProfile, serializeProfile, addClear, PROFILE_KEY, type Profile } from "./engine/profile";
import { mountLayoutEditor } from "./ui/layoutEditor";
import { mountCheatPanel } from "./ui/cheatPanel";
import { playVideo } from "./ui/videoScreen";
import { initAudioUnlock } from "./ui/audio";
import { setStageExtra, setStageExtraX } from "./ui/stage";
import { stages } from "./data/stages";
import { runStageScreen } from "./ui/hex/stageScreen";

// 배경 영상은 항상 무한 루프·무음 — BGM은 오디오 시스템이 담당
VideoSource.defaultOptions = {
  ...VideoSource.defaultOptions,
  autoPlay: true,
  loop: true,
  muted: true,
  playsinline: true,
};

/** 동물 id → 프레임 텍스처. 한 장짜리도 목록으로 온다 — 파일이 없는 동물은 키가 빠진다. */
async function loadRunnerFrames(paths: Record<string, string[]>): Promise<Record<string, Texture[]>> {
  const ids = Object.keys(paths);
  const loaded = await Promise.all(
    ids.map(async (id) => (await Promise.all((paths[id] ?? []).map(loadTexture))).filter((t): t is Texture => t !== null)),
  );
  const out: Record<string, Texture[]> = {};
  ids.forEach((id, i) => { const f = loaded[i]!; if (f.length > 0) out[id] = f; });
  return out;
}

async function main(): Promise<void> {
  // 화면 = 전체 16:9 · 중앙 9:16 컬럼(450×800)이 실제 콘텐츠. 논리 높이는 800 고정,
  // 논리 폭만 뷰포트 비율에 따라 9:16(450, 좁은 세로 화면)~16:9(≈1422, 넓은 화면) 사이로 늘어난다.
  // 남는 좌우 자리는 배경 패널(각 175:288)이 채우고, 좁은 세로 뷰포트에선 중앙 컬럼만 보인다.
  const MAX_ASPECT = 16 / 9;    // 전체 화면 상한
  const MIN_ASPECT = 450 / 800; // 중앙 컬럼 = 9:16
  const fit = (): void => {
    const vw = window.innerWidth, vh = window.innerHeight;
    const aspect = Math.min(MAX_ASPECT, Math.max(MIN_ASPECT, vw / vh));
    const logicalW = Math.round(800 * aspect);
    const s = Math.min(vw / logicalW, vh / 800);
    app.renderer.resize(logicalW, 800);
    setStageExtraX(logicalW - 450);
    setStageExtra(0);
    app.stage.x = (logicalW - 450) / 2; // 콘텐츠 450 박스를 가로 중앙 고정
    app.canvas.style.width = `${logicalW * s}px`;
    app.canvas.style.height = `${800 * s}px`;
  };
  const app = new Application();
  await app.init({
    width: 450,
    height: 800,
    background: "#f8f5fd",
    antialias: true,
    // 렌더 배율 — 예전엔 항상 2 이상(기기 dpr이 3이면 3)이었는데, 폰에서 프레임버퍼가
    // 1290×2868까지 커져(안티에일리어싱까지) 심하게 버벅였다. 2면 충분히 선명하다.
    resolution: Math.min(2, Math.max(1, window.devicePixelRatio || 1)),
    autoDensity: true, // CSS 크기는 논리 픽셀 유지
  });
  const el = document.getElementById("app");
  if (!el) throw new Error("#app not found");
  el.appendChild(app.canvas);
  el.style.cssText = "display:flex;align-items:center;justify-content:center;width:100vw;height:100vh;overflow:hidden";
  fit();
  window.addEventListener("resize", fit);
  initAudioUnlock(); // 첫 제스처에서 재생 언락 (자동재생 정책)
  mountLayoutEditor(app.stage); // ?editor=1 일 때만 산다 — 게임 화면 위에서 배치를 고친다
  mountCheatPanel();              // 같은 조건 + devMode. 화면 왼쪽, 배치 패널 반대편이다

  // E2E 테스트용 씬 마커 — 현재 단계 노출 (게임 로직에선 미사용)
  const mark = (s: string): void => { (window as unknown as { __scene?: string }).__scene = s; };

  // 로비 ⇄ 스테이지. 클리어하면 다음 스테이지, 실패·재시작이면 같은 스테이지를 다시 준다.
  mark("game");
  const [hexTextures, uiSlots, lobbySlots, raceBg, raceUi, raceBooster, raceRunners, raceFaces, raceWinner, raceCard, raceRow, raceMedal, raceFlags, eventSlots, collectionSlots, collectionCards, collectionLocked]
    = await Promise.all([
    loadHexAssets(hexAssetPaths), // 루프 전 1회 로드 — 매 스테이지 재로드하지 않는다
    loadSlots(uiAssetPaths),
    loadSlots(lobbyAssetPaths),
    loadSlots(raceAssetPaths.bg),
    loadSlots(raceAssetPaths.ui),
    loadSlots(raceAssetPaths.booster),
    loadRunnerFrames(raceAssetPaths.runners),
    loadSlots(raceAssetPaths.faces),
    loadSlots(raceAssetPaths.winner),
    loadSlots(raceAssetPaths.card),
    loadSlots(raceAssetPaths.row),
    loadSlots(raceAssetPaths.medal),
    loadSlots(raceAssetPaths.flags),
    loadSlots(eventAssetPaths),
    loadSlots({ panel: collectionAssetPaths.panel, close: collectionAssetPaths.close }),
    loadSlots(collectionAssetPaths.cards),
    loadSlots(collectionAssetPaths.locked),
  ]);
  // 설정창이 쓰는 묶음. 스테이지 화면도 같은 것을 그대로 넘겨받는다.
  const ui = {
    panel: uiSlots.settingsPanel,
    close: uiSlots.settingsClose,
    toggleOn: uiSlots.toggleOn,
    toggleOff: uiSlots.toggleOff,
    resume: uiSlots.btnResume,
    home: uiSlots.btnHome,
    confirmPanel: uiSlots.confirmPanel,
    confirmOk: uiSlots.btnConfirmOk,
    confirmCancel: uiSlots.btnConfirmCancel,
    settingsButton: uiSlots.gear,
    stageBar: uiSlots.stageBar,
  };
  const lobbyTextures = {
    bg: lobbySlots.bg,
    play: lobbySlots.play,
    gear: uiSlots.gear,
    icons: {
      topStats: lobbySlots.topStats ?? null,
      navHome: lobbySlots.navHome ?? null,
      navRace: lobbySlots.navRace ?? null,
      navAnimals: lobbySlots.navAnimals ?? null,
      navEvents: lobbySlots.navEvents ?? null,
    },
    // 로비 배경은 구출 마릿수마다 도는 영상이다(상류). 월드는 진입점을 끊어 빠졌다.
    scenes: lobbySceneVideoPaths,
    race: {
      bg: raceBg, ui: raceUi, runners: raceRunners,
      faces: raceFaces, winner: raceWinner,
      card: raceCard, row: raceRow, medal: raceMedal, flags: raceFlags,
      booster: raceBooster, settings: ui,
    },
    event: { bg: eventSlots.bg, close: eventSlots.close, cta: eventSlots.cta },
    collection: {
      panel: collectionSlots.panel,
      close: collectionSlots.close,
      cards: collectionCards,
      locked: collectionLocked,
    },
    ui,
  };

  let profile: Profile = parseProfile(localStorage.getItem(PROFILE_KEY));
  const save = (): void => {
    // 저장이 막혀 있어도(사파리 프라이빗 등) 게임은 계속 굴러가야 한다
    try { localStorage.setItem(PROFILE_KEY, serializeProfile(profile)); } catch { /* 무시 */ }
  };

  // 인트로 — 파일이 없으면 그냥 지나간다. 에디터로 배치를 맞추는 중에는 방해가 되므로 건너뛴다.
  if (!new URLSearchParams(location.search).has("editor")) {
    mark("intro");
    await playVideo(videoAssetPaths.intro);
  }

  for (;;) {
    mark("lobby");
    await runLobby(app, profile, lobbyTextures, (next) => { profile = next; save(); });

    mark("game");
    // 마지막 스테이지를 넘으면 처음으로 되돌린다
    if (!stages[profile.stageIndex]) profile = { ...profile, stageIndex: 0 };
    const stage = stages[profile.stageIndex];
    if (!stage) break; // 스테이지가 하나도 없다 — 로비에 머무를 수 없으니 여기서 끝낸다

    // 레이스로 번 부스터는 이 판에 전부 실린다. 진입 즉시 비워서 다음 판에 또 실리지
    // 않게 한다 — 남은 것을 돌려주기 시작하면 결과 화면과 저장 양쪽에서 재고를 관리해야 한다.
    const earned = profile.boosters;
    const stock = {
      bomb: 3 + earned.bomb,
      rainbow: 2 + earned.rainbow,
      horseshoe: 1 + earned.horseshoe,
    };
    if (earned.bomb + earned.rainbow + earned.horseshoe > 0) {
      profile = { ...profile, boosters: { bomb: 0, rainbow: 0, horseshoe: 0 } };
      save();
    }

    const outcome = await runStageScreen(app, stage, profile.stageIndex, hexTextures, ui, stock);
    if (outcome.result === "cleared") {
      const last = profile.stageIndex >= stages.length - 1;
      profile = addClear(profile, outcome.rescued, outcome.horseshoes);
      save();
      // 마지막 스테이지를 깨면 엔딩. 파일이 없으면 그냥 로비로 돌아간다.
      if (last) {
        mark("ending");
        await playVideo(videoAssetPaths.ending, "닫기");
      }
    }
    // failed·lobby는 프로필을 건드리지 않는다 — 다음 바퀴에서 같은 스테이지가 다시 나온다
  }
}

// 에디터에서 에셋을 올리면 이 탭만 새로 뜬다. 에디터 탭은 리로드하지 않는다 —
// 리로드가 겹치면 방금 올린 이미지 요청이 중단돼 「미업로드」로 오탐한다.
if (import.meta.hot) {
  // 소리는 audio.ts가 제자리에서 갈아끼운다 — 리로드하면 언락이 풀려 다음 제스처까지 조용해진다
  import.meta.hot.on("asset-updated", (d: { asset?: string }) => {
    if (typeof d?.asset === "string" && d.asset.startsWith("audio.")) return;
    location.reload();
  });
}

void main();
