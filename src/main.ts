// main.ts — Pixi 부트스트랩 + 스테이지 루프.
//
// 부트 체인에서 프롤로그·로딩·타이틀을 뺐다. 셋 다 이 게임의 화면이 아니라
// 접속자가 1분 가까이 다른 화면을 본 뒤에야 게임에 도착했다.
// 화면 코드 자체는 ui/boot.ts에 남아 있고 import만 끊었다 — 번들에서는 빠진다.
import { Application, VideoSource } from "pixi.js";
import { loadHexAssets } from "./ui/hex/hexAssets";
import { hexAssetPaths, uiAssetPaths, lobbyAssetPaths } from "./data/hexAssets";
import { loadSlots } from "./ui/skin";
import { runLobby } from "./ui/lobbyScreen";
import { parseProfile, serializeProfile, addClear, type Profile } from "./engine/profile";
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

  // E2E 테스트용 씬 마커 — 현재 단계 노출 (게임 로직에선 미사용)
  const mark = (s: string): void => { (window as unknown as { __scene?: string }).__scene = s; };

  // 로비 ⇄ 스테이지. 클리어하면 다음 스테이지, 실패·재시작이면 같은 스테이지를 다시 준다.
  mark("game");
  const [hexTextures, uiSlots, lobbySlots] = await Promise.all([
    loadHexAssets(hexAssetPaths), // 루프 전 1회 로드 — 매 스테이지 재로드하지 않는다
    loadSlots(uiAssetPaths),
    loadSlots(lobbyAssetPaths),
  ]);
  // 설정창이 쓰는 묶음. 스테이지 화면도 같은 것을 그대로 넘겨받는다.
  const ui = {
    panel: uiSlots.settingsPanel,
    close: uiSlots.settingsClose,
    toggleOn: uiSlots.toggleOn,
    toggleOff: uiSlots.toggleOff,
    resume: uiSlots.btnResume,
    home: uiSlots.btnHome,
    settingsButton: uiSlots.gear,
  };
  const lobbyTextures = {
    bg: lobbySlots.bg,
    play: lobbySlots.play,
    gear: uiSlots.gear,
    icons: {
      railMissions: lobbySlots.railMissions ?? null,
      railCollection: lobbySlots.railCollection ?? null,
      railShop: lobbySlots.railShop ?? null,
      railWorld: lobbySlots.railWorld ?? null,
      navHome: lobbySlots.navHome ?? null,
      navAnimals: lobbySlots.navAnimals ?? null,
      navEvents: lobbySlots.navEvents ?? null,
      navSoon: lobbySlots.navSoon ?? null,
    },
    animals: hexTextures.animals,
    ui,
  };

  const PROFILE_KEY = "redhorserescue.profile";
  let profile: Profile = parseProfile(localStorage.getItem(PROFILE_KEY));
  const save = (): void => {
    // 저장이 막혀 있어도(사파리 프라이빗 등) 게임은 계속 굴러가야 한다
    try { localStorage.setItem(PROFILE_KEY, serializeProfile(profile)); } catch { /* 무시 */ }
  };

  for (;;) {
    mark("lobby");
    await runLobby(app, profile, lobbyTextures);

    mark("game");
    // 마지막 스테이지를 넘으면 처음으로 되돌린다
    if (!stages[profile.stageIndex]) profile = { ...profile, stageIndex: 0 };
    const stage = stages[profile.stageIndex];
    if (!stage) break; // 스테이지가 하나도 없다 — 로비에 머무를 수 없으니 여기서 끝낸다

    const outcome = await runStageScreen(app, stage, profile.stageIndex, hexTextures, ui);
    if (outcome.result === "cleared") {
      profile = addClear(profile, outcome.rescued, outcome.horseshoes);
      save();
    }
    // failed·lobby는 프로필을 건드리지 않는다 — 다음 바퀴에서 같은 스테이지가 다시 나온다
  }
}

void main();
