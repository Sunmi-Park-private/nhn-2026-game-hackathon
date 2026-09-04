// main.ts — Pixi 부트스트랩 + 부트 플로우(프롤로그 → 로딩 → 메인 → 스테이지).
import { Application, VideoSource } from "pixi.js";
import { loadGameAssets, loadLoadingBg, loadPrologueBg, loadHexAssets } from "./ui/assets";
import { playPrologue, showLoading, showTitle } from "./ui/boot";
import { isDevMode } from "./ui/devMode";
import { initCheatMenu } from "./ui/cheatMenu";
import { initAudioUnlock, playBgm } from "./ui/audio";
import { setStageExtra, setStageExtraX } from "./ui/stage";
import { triggerRedraw } from "./ui/editor";
import { onHotAssetUpdate } from "./ui/hotAssets";
import { beats } from "./data";
import { initBeatsPreview } from "./ui/beatsPreview";
import { stages } from "./data/stages";
import { runStageScreen } from "./ui/hex/stageScreen";

// 배경 mp4(프롤로그·로딩·리듬 배경)는 항상 무한 루프·무음 재생 — BGM은 오디오 시스템이 담당
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
  // 여백은 두지 않는다 — 안전영역 패딩(좌우 4·12px)을 넣어 봤지만 실기에서 좌우 잘림은
  // 그대로면서 화면만 작아지고 상하까지 잘렸다. 잘림의 원인이 캔버스 넘침이 아니라는 뜻.
  el.style.cssText = "display:flex;align-items:center;justify-content:center;width:100vw;height:100vh;overflow:hidden";
  fit();
  window.addEventListener("resize", fit); // ponytail: 리사이즈 시 현재 화면 배경은 다음 화면 전환에 재적용
  if (isDevMode()) initCheatMenu(); // ⚙️ 개발 치트 — 부트(프롤로그·로비)에서도 상시 노출
  initAudioUnlock(); // 첫 제스처에서 재생 언락 (자동재생 정책)

  // 프롤로그·로딩 화면 배경만 먼저 — 이 둘은 부트 첫 화면이라 기다릴 수 없다
  const progress = { done: 0, total: 1 };
  const loadingBgPromise = loadLoadingBg();
  const prologueBgPromise = loadPrologueBg(); // 프롤로그 배경 — 기다리지 않고 도착 시 반영

  // E2E 테스트용 씬 마커 — 현재 부트 단계 노출 (게임 로직에선 미사용)
  const mark = (s: string): void => { (window as unknown as { __scene?: string }).__scene = s; };
  mark("prologue");
  await playPrologue(app, prologueBgPromise);           // ① 프롤로그 (경량, 즉시)
  mark("loading");
  // 무거운 에셋은 로딩 화면에 들어와서야 시작 — 프롤로그 재생과 겹치면 디코딩 부하로 영상이 끊긴다.
  // 로딩이 길어져도 진행률 게이지가 보이는 구간이므로 체감이 낫다
  const assetsPromise = loadGameAssets((d, t) => { progress.done = d; progress.total = t; }, app.renderer);
  await showLoading(app, progress, assetsPromise, loadingBgPromise); // ② 로딩 (남은 진행률)
  const assets = await assetsPromise;
  onHotAssetUpdate((update) => {
    void assets.reloadFromHotUpdate(update).then((changed) => {
      if (changed) triggerRedraw();
    });
  });
  initBeatsPreview(beats); // 플로우 에디터 미저장 대사 실시간 반영 (dev 전용)
  mark("title");
  await showTitle(app, assets.title);                   // ③ 메인화면 (게임 시작)
  playBgm("main");                                      // 메인 BGM — 로비 진입부터 (프롤로그·로딩·타이틀은 무음)
  // ④ 스테이지 연속 플레이 — 클리어하면 다음 스테이지, 실패하면 같은 스테이지 재도전
  mark("game");
  const hexTextures = await loadHexAssets(); // 스테이지 루프 전 1회 로드 — 매 스테이지 재로드하지 않고 같은 객체를 재사용
  let stageIndex = 0;
  for (;;) {
    const stage = stages[stageIndex];
    if (!stage) {
      stageIndex = 0; // 마지막 스테이지를 넘으면 처음으로 되돌린다
      continue;
    }
    const result = await runStageScreen(app, stage, stageIndex, hexTextures);
    if (result === "cleared") stageIndex += 1;
  }
}

void main();
