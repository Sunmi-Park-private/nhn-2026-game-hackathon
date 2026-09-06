// main.ts — Pixi 부트스트랩 + 스테이지 루프.
//
// 부트 체인에서 프롤로그·로딩·타이틀을 뺐다. 셋 다 이 게임의 화면이 아니라
// 접속자가 1분 가까이 다른 화면을 본 뒤에야 게임에 도착했다.
// 화면 코드 자체는 ui/boot.ts에 남아 있고 import만 끊었다 — 번들에서는 빠진다.
import { Application, Container, VideoSource, type Sprite, type Texture } from "pixi.js";
import { loadHexAssets } from "./ui/hex/hexAssets";
import { hexAssetPaths, uiAssetPaths, lobbyAssetPaths, lobbySceneVideoPaths, eventAssetPaths, collectionAssetPaths, videoAssetPaths, storyAssetPaths } from "./data/hexAssets";
import { raceAssetPaths } from "./data/raceAssets";
import { loadSlots, loadTexture } from "./ui/skin";
import { runLobby } from "./ui/lobbyScreen";
import { parseProfile, serializeProfile, addClear, PROFILE_KEY, type Profile } from "./engine/profile";
import { mountLayoutEditor } from "./ui/layoutEditor";
import { mountCheatPanel } from "./ui/cheatPanel";
import { isDevMode } from "./ui/devMode";
import { playVideo } from "./ui/videoScreen";
import { initAudioUnlock } from "./ui/audio";
import { setStageExtra, setStageExtraX, coverBg, fitCover } from "./ui/stage";
import { uiAreas } from "./data/uiLayout";
import { loadProgress, onLoadProgress } from "./ui/loadProgress";
import { openLoadingScreen } from "./ui/loadingScreen";
import { LOADING_AREA, LOADING_FALLBACK } from "./ui/loadingLayout";
import { stages } from "./data/stages";
import { runStageScreen } from "./ui/hex/stageScreen";
import { openGameOver } from "./ui/gameOverScreen";
import { GAMEOVER_AREA } from "./ui/gameOverLayout";
import { slot } from "./data/uiLayout";
import { storyBeat } from "./data/story";
import { ANIMALS } from "./data/animals";
import { openStoryDialog } from "./ui/storyDialog";
import { STORY_AREA, type StorySlotId } from "./ui/storyLayout";

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
    // 렌더 배율은 「논리 px 하나가 실제 몇 device px인가」(dpr × s)를 따라간다.
    // 고정 2로 두면 1920×1080 레티나(dpr 2 × s 1.35 = 2.7)에서 캔버스 전체가 1.35배
    // 늘려져 살짝 뭉갠다 — 구출 동물이 커지면서 눈에 띄었다(본선 QA).
    // 폰은 init의 상한 2를 넘기지 않는다(예전에 dpr 3 그대로 썼다가 버벅였다) —
    // 상한을 올리는 것은 넓은 화면(데스크톱)뿐이고, 그것도 세로 2160px(2.7)까지다.
    const dpr = window.devicePixelRatio || 1;
    const cap = vw >= 1024 ? 2.7 : 2;
    app.renderer.resize(logicalW, 800, Math.min(cap, Math.max(1, dpr * s)));
    setStageExtraX(logicalW - 450);
    setStageExtra(0);
    app.stage.x = (logicalW - 450) / 2; // 콘텐츠 450 박스를 가로 중앙 고정
    app.canvas.style.width = `${logicalW * s}px`;
    app.canvas.style.height = `${800 * s}px`;
    if (backdropSprite) fitCover(backdropSprite); // 화면이 돌아가도 캔버스 전체를 계속 덮는다
  };
  // 로비 배경(전체) 스틸 — **모든 화면 밑에** 고정된다(로비·인게임·레이스·이벤트·도감).
  // 1920×1080 가로 아트라 16:9 캔버스를 통째로 덮는다. 화면들은 콘텐츠 박스(450 컬럼)만
  // 불투명하게 칠하므로(stage.ts contentRect) 좌우 블리드에는 늘 이것이 보이고,
  // 화면의 배경 아트가 없을 때도 이것이 남는다. 영상이 아니라 스틸이다 — 요청이 그랬다.
  let backdropSprite: Sprite | null = null;
  const app = new Application();
  await app.init({
    width: 450,
    height: 800,
    // 에셋을 받는 동안 보이는 색이다. 흰색이면 게임 톤과 어긋나 「깜빡」으로 보인다
    background: "#241a10",
    antialias: true,
    // 렌더 배율 — 예전엔 항상 2 이상(기기 dpr이 3이면 3)이었는데, 폰에서 프레임버퍼가
    // 1290×2868까지 커져(안티에일리어싱까지) 심하게 버벅였다. 2면 충분히 선명하다.
    resolution: Math.min(2, Math.max(1, window.devicePixelRatio || 1)),
    autoDensity: true, // CSS 크기는 논리 픽셀 유지
  });
  const el = document.getElementById("app");
  if (!el) throw new Error("#app not found");
  el.appendChild(app.canvas);
  const backdrop = new Container();
  backdrop.label = "backdrop";
  app.stage.addChild(backdrop); // 제일 먼저 — 이 뒤에 붙는 화면 레이어가 전부 위에 온다
  el.style.cssText = "display:flex;align-items:center;justify-content:center;width:100vw;height:100vh;overflow:hidden";
  fit();
  window.addEventListener("resize", fit);
  initAudioUnlock(); // 첫 제스처에서 재생 언락 (자동재생 정책)

  // E2E 테스트용 씬 마커 — 현재 단계 노출 (게임 로직에선 미사용)
  const mark = (s: string): void => { (window as unknown as { __scene?: string }).__scene = s; };

  // 인트로 — 파일이 없으면 그냥 지나간다. 에디터 「인트로」 탭에서 올린다(video.intro).
  //
  // **에디터에서도 튼다.** 예전에는 ?editor=1이면 건너뛰었는데, 그러면 인트로를 올린
  // 사람이 자기가 올린 것을 확인할 길이 없다 — 「인트로가 아예 안 나온다」로 보였다.
  // 방해가 되면 건너뛰기 버튼으로 넘긴다. 그러라고 있는 버튼이다.
  //
  // **이 동안 에셋을 받지 않는다.** 뒤에서 100MB를 받으면 실제 빌드에서 영상이 버벅였다 —
  // 에셋은 아래 로딩 화면이 뜬 뒤에 시작한다.
  mark("intro");
  await playVideo(videoAssetPaths.intro);

  // 받는 동안 로딩 화면(배경 영상 + 게이지)을 보인다. 느린 회선(터널·모바일)에서는
  // 이 자리가 몇 분이라, 갈색 단색만 있으면 「멎었다」로 보인다 — 로더의 상한을 없앤 대신 여기서 알린다.
  // 패널 자리는 uiLayout.json의 loading 영역(에디터 「게임시작 로딩」 탭)이 정한다.
  const loadingSlot = slot(LOADING_AREA, "panel");
  const loadingScreen = openLoadingScreen({
    video: videoAssetPaths.loading,
    panel: loadingSlot ?? LOADING_FALLBACK.panel,
    barColor: loadingSlot?.color,
    fontSize: loadingSlot?.fontSize,
    hidePanel: loadingSlot?.hidden === true,
  });
  const paintLoading = (): void => {
    const p = loadProgress();
    loadingScreen.update(p.settled, p.started);
  };
  const offProgress = onLoadProgress(paintLoading);
  paintLoading();

  // 로비 ⇄ 스테이지. 클리어하면 다음 스테이지, 실패·재시작이면 같은 스테이지를 다시 준다.
  mark("game");
  const [hexTextures, uiSlots, lobbySlots, raceBg, raceUi, raceBooster, raceRunners, raceFaces, raceWinner, raceCard, raceRow, raceMedal, eventSlots, collectionSlots, collectionCards, collectionLocked, storyHorse, storyAnimals]
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
    loadSlots(eventAssetPaths),
    loadSlots({ panel: collectionAssetPaths.panel, close: collectionAssetPaths.close }),
    loadSlots(collectionAssetPaths.cards),
    loadSlots(collectionAssetPaths.locked),
    loadSlots({ horse: storyAssetPaths.horse }),
    loadSlots(storyAssetPaths.animals),
  ]);
  offProgress();
  loadingScreen.close();
  // 로비의 bg 슬롯을 에디터에서 끄면 여기서도 빠진다 — 같은 아트를 두 곳에서 따로 끌 이유가 없다
  const bgOff = uiAreas.find((a) => a.id === "lobby")?.slots.find((s) => s.id === "bg")?.hidden === true;
  if (lobbySlots.bg && !bgOff) {
    backdropSprite = coverBg(lobbySlots.bg);
    backdrop.addChild(backdropSprite);
  }
  // 에셋을 다 받은 뒤에 얹는다 — 먼저 얹으면 빈 캔버스 위에 격자만 뜬다
  mountLayoutEditor(app.stage); // ?editor=1 일 때만 산다 — 게임 화면 위에서 배치를 고친다
  // 치트 패널이 「대사 보기」를 누르면 이 함수를 부른다 — 판을 깨지 않고 다섯 편을 본다.
  // 패널은 DOM이라 Pixi를 모른다: 여는 일은 여기서 하고 패널은 번호만 넘긴다.
  mountCheatPanel({
    onPlayStory: (i) => { void playStoryBeat(i); },
    // 엔딩 영상만 따로 본다. 지금 떠 있는 화면 위에 겹쳐 뜨고, 끝나면 그 화면으로
    // 돌아온다 — 로비에서 눌렀다면 로비다. 진행도는 건드리지 않는다.
    onPlayEnding: () => {
      void (async () => {
        mark("ending");
        await playVideo(videoAssetPaths.ending, "닫기");
        mark("lobby");
      })();
    },
  });

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
    // 스테이지 1~6. 전용 아트가 오기 전까지 여섯 칸 모두 매니페스트가 PLAY 아트를 가리킨다 —
    // 칸마다 슬롯이 따로라 에디터에서 하나씩 갈아끼울 수 있다.
    stages: [
      lobbySlots.stage1, lobbySlots.stage2, lobbySlots.stage3,
      lobbySlots.stage4, lobbySlots.stage5, lobbySlots.stage6,
    ].map((t) => t ?? null),
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
      card: raceCard, row: raceRow, medal: raceMedal,
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

  /** 게임오버 창에서 「다시 도전」을 골랐다 — 로비를 거치지 않고 같은 판을 다시 연다. */
  let retry = false;

  // 치트 — `?stage=N`이면 첫 바퀴의 로비를 건너뛰고 N판으로 바로 간다(규약 5조: dev 모드만).
  // 한 번 쓰고 주소에서 지운다 — 남겨 두면 그 뒤 모든 새로고침이 로비를 건너뛴다.
  if (isDevMode()) {
    const params = new URLSearchParams(location.search);
    const n = Number(params.get("stage"));
    if (Number.isInteger(n) && n >= 1 && n <= stages.length) {
      profile = { ...profile, stageIndex: n - 1 };
      save();
      retry = true;
      params.delete("stage");
      const q = params.toString();
      history.replaceState(null, "", `${location.pathname}${q ? `?${q}` : ""}${location.hash}`);
    }
  }
  /** 판 하나를 깬 뒤의 대사. 비트가 없는 판(마지막)이면 아무 일도 하지 않는다. */
  const playStoryBeat = async (clearedIndex: number): Promise<void> => {
    const beat = storyBeat(clearedIndex);
    if (!beat) return;
    mark("story");
    // 초상은 이미 받아 둔 텍스처만 쓴다 — 여기서 새로 받으면 판 사이가 멎는다.
    // **대사 전용 아트가 1순위**(에디터 「대사」 탭에서 올린다). 없으면 인게임 동물 시퀀스
    // 첫 장 → 열린 창살 스틸 → 도감 카드로 내려간다. 그림이 하나도 없어도 화면은 뜬다.
    const animalTex = storyAnimals[beat.rescuedId]
      ?? hexTextures.animals[beat.rescuedId]?.[0]
      ?? hexTextures.cageOpen[beat.rescuedId]
      ?? collectionCards[beat.rescuedId];
    await openStoryDialog(app.stage, {
      lines: beat.lines,
      horseTex: storyHorse.horse ?? hexTextures.horse[0],
      animalTex,
      horseName: "붉은말",
      animalName: ANIMALS.find((a) => a.id === beat.rescuedId)?.name ?? "친구",
      // 슬롯은 원본을 넘긴다 — 복사본이면 에디터에서 끌어도 저장이 안 된다
      slot: (id: StorySlotId) => slot(STORY_AREA, id),
    });
  };

  for (;;) {
    if (!retry) {
      mark("lobby");
      // 로비가 고른 판으로 간다 — 예전에는 PLAY 하나뿐이라 profile.stageIndex를 그대로 썼다.
      const picked = await runLobby(app, profile, lobbyTextures, (next) => { profile = next; save(); });
      if (picked !== profile.stageIndex) {
        profile = { ...profile, stageIndex: picked };
        save();
      }
    }
    retry = false;

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
      const cleared = profile.stageIndex;
      const last = cleared >= stages.length - 1;
      profile = addClear(profile, outcome.rescued, outcome.horseshoes);
      save();
      // 마지막 스테이지를 깨면 엔딩. 파일이 없으면 그냥 로비로 돌아간다 —
      // 어느 쪽이든 이 아래로 흘러 다음 바퀴의 runLobby로 간다.
      if (last) {
        mark("ending");
        await playVideo(videoAssetPaths.ending, "닫기");
      } else {
        // 중간 판이면 방금 구한 동물과 붉은말이 다음 구조를 이야기한다.
        // 대사·초상은 여기서 넣어 준다 — storyDialog는 data를 모른다(규약 2조).
        await playStoryBeat(cleared);
      }
    }
    // failed·lobby는 프로필을 건드리지 않는다 — 다음 바퀴에서 같은 스테이지가 다시 나온다
    if (outcome.result === "failed") {
      // 곧바로 로비로 튕기면 「졌다」가 화면에 없다(본선 QA). 한 번 세우고 다시 할지 묻는다.
      mark("gameover");
      // 슬롯은 원본을 넘긴다 — 복사본이면 에디터에서 끌어도 저장이 안 된다
      retry = await openGameOver(app.stage, {
        slot: (id) => slot(GAMEOVER_AREA, id),
        textures: {
          panel: uiSlots.gameOverPanel,
          lobby: uiSlots.btnGameOverLobby,
          retry: uiSlots.btnGameOverRetry,
        },
      });
    }
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
