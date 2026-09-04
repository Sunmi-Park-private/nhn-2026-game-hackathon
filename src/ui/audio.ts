// ui/audio.ts — 소리. BGM 두 종과 효과음 여섯 종을 HTMLAudio로 튼다.
//
// 트랙 원본은 assets.json의 audio 블록이고, id는 그 점 경로다("audio.bgmStage").
// 그림·영상과 같은 매니페스트·같은 업로드 경로를 쓴다 — /ui.html 오디오 탭에서
// 파일을 올리면 리로드 없이 바뀐다.
//
// 파일이 없는 슬롯은 **그냥 소리가 안 난다.** 폴백으로 다른 곡을 대신 틀지 않는다 —
// 아직 안 올라온 소리 자리에 엉뚱한 곡이 울리면 무엇이 비었는지 알 수 없다.
//
// 모바일 물리 볼륨 버튼: 웹은 시스템 볼륨 API가 없지만, HTMLAudio는 OS '미디어 볼륨'
// 채널로 재생되므로 기기 볼륨 버튼이 자동으로 적용된다(별도 코드 불필요).
import { isDevMode } from "./devMode";
import { settings, onSettingsChange } from "./settings";
import { audioAssetPaths, type AudioSlotId } from "../data/hexAssets";

/** 트랙 id = assets.json 안의 점 경로. 업로드 경로와 같은 문자열이라 배선이 하나다. */
export type AudioId = `audio.${AudioSlotId}`;

/** 슬롯별 기본 볼륨. BGM은 화면 뒤에 깔리고 효과음은 앞에 선다. */
function baseVolume(id: AudioId): number {
  return id.startsWith("audio.bgm") ? 0.5 : 0.8;
}

/** id → 파일 경로. 미업로드면 빈 문자열. 핫스왑이 이 표를 갈아끼운다. */
const files = new Map<AudioId, string>();
for (const [slot, file] of Object.entries(audioAssetPaths)) {
  if (file) files.set(`audio.${slot}` as AudioId, file);
}

const els = new Map<AudioId, HTMLAudioElement>();
const cueEls = new Map<AudioId, HTMLAudioElement>();
let currentId: AudioId | null = null;
/** 마지막으로 요청된 장면 — 핫스왑 때 무엇을 다시 틀지 판단하는 기준 */
let sceneId: AudioId | null = null;
let unlocked = false;

export const DEFAULT_VOLUME = 30; // 기본 볼륨 (0~100)
let master = (() => {
  const v = Number(localStorage.getItem("redhorserescue.bgmVolume") ?? String(DEFAULT_VOLUME));
  return Number.isFinite(v) ? Math.max(0, Math.min(100, v)) / 100 : DEFAULT_VOLUME / 100;
})();

// 음소거는 설정창의 MUSIC 토글이 정한다 — 값이 두 군데 살면 화면과 소리가 어긋난다
let muted = !settings().music;
onSettingsChange((s) => { setBgmMuted(!s.music); });

const applyVolume = (): void => {
  for (const [id, a] of els) a.volume = muted ? 0 : baseVolume(id) * master;
};

function el(id: AudioId, file: string): HTMLAudioElement {
  let a = els.get(id);
  if (!a) {
    a = new Audio(file);
    a.loop = true;
    a.preload = "auto";
    els.set(id, a);
  }
  a.volume = muted ? 0 : baseVolume(id) * master;
  return a;
}

/** 음소거 — 볼륨값은 보존, 해제 시 원래 볼륨으로 복귀. localStorage 유지 */
export function bgmMuted(): boolean { return muted; }
export function setBgmMuted(m: boolean): void {
  muted = m;
  localStorage.setItem("redhorserescue.bgmMuted", m ? "1" : "0");
  applyVolume();
}

/** 지금 장면의 곡을 튼다. 언락 전이면 요소를 만들지도 않는다 —
 *  자동재생이 막힌 상태에서 만들어 봐야 재생되지 않고, 언락 시점에 이 함수가 다시 불린다.
 *  els에 없으면 여기서 만든다. 예전에는 언락 처리기가 els를 조회만 해서,
 *  언락 전에 요청된 곡은 첫 제스처 뒤에도 영영 울리지 않았다. */
function startCurrent(): void {
  if (!unlocked || userPaused || !currentId) return;
  const file = files.get(currentId);
  if (!file) return;
  void el(currentId, file).play().catch(() => {});
}

function stopCurrent(): void {
  if (!currentId) return;
  const prev = els.get(currentId);
  prev?.pause();
  if (prev) prev.currentTime = 0;
  currentId = null;
}

/** 배경음악 전환. 파일이 없으면 정지한다 — 삭제가 곧바로 침묵으로 반영된다.
 *  자동재생이 막혀 있으면 첫 제스처에서 initAudioUnlock이 이어 받는다. */
export function playBgm(id: AudioId): void {
  sceneId = id;
  const file = files.get(id);
  if (!file) { stopCurrent(); return; }
  if (currentId === id) { startCurrent(); return; }
  stopCurrent();
  currentId = id;
  startCurrent();
}

export function currentBgm(): AudioId | null { return currentId; }

// ── 일시정지/재개 — 레이아웃 에디터 등 게임 pause용 ──
let userPaused = false; // visibilitychange 자동 재개가 pause를 깨지 않게
export function pauseBgm(): void {
  userPaused = true;
  if (currentId) els.get(currentId)?.pause();
}
export function resumeBgm(): void {
  userPaused = false;
  startCurrent();
}

/** 트랙을 효과음처럼 처음부터 1회 재생(루프·BGM 전환 없음). 미업로드면 무음. */
export function playCue(id: AudioId): void {
  const file = files.get(id);
  if (!file) return;
  let a = cueEls.get(id);
  if (!a) {
    a = new Audio(file);
    a.loop = false;
    cueEls.set(id, a);
  }
  a.volume = muted ? 0 : baseVolume(id) * master;
  a.currentTime = 0;
  void a.play().catch(() => {});
}

/** 효과음 — 설정창의 SOUND가 꺼져 있으면 아무 일도 하지 않는다.
 *  화면 코드가 매번 settings()를 읽지 않게 여기 한 군데서만 판단한다. */
export function playSfx(id: AudioId): void {
  if (!settings().sound) return;
  playCue(id);
}

/** 재생 중인 큐 정지 */
export function stopCue(id: AudioId): void {
  const a = cueEls.get(id);
  if (a) { a.pause(); a.currentTime = 0; }
}

/** 마스터 볼륨 (0~100) — 슬롯별 기본 배율에 곱해짐, localStorage 유지 */
export function bgmVolume(): number { return Math.round(master * 100); }
export function setBgmVolume(v: number): void {
  master = Math.max(0, Math.min(100, v)) / 100;
  localStorage.setItem("redhorserescue.bgmVolume", String(Math.round(master * 100)));
  applyVolume();
}

/** 브라우저 자동재생 정책 대응: 첫 사용자 제스처에서 재생 언락 */
export function initAudioUnlock(): void {
  const unlock = (): void => {
    if (unlocked) return;
    unlocked = true;
    startCurrent();
    window.removeEventListener("pointerdown", unlock);
    window.removeEventListener("keydown", unlock);
  };
  window.addEventListener("pointerdown", unlock);
  window.addEventListener("keydown", unlock);
  // 백그라운드 진입(홈 버튼·탭 전환) 시 정지, 복귀 시 재개
  document.addEventListener("visibilitychange", () => {
    if (document.hidden) {
      if (currentId) els.get(currentId)?.pause();
      return;
    }
    startCurrent();
  });
  if (isDevMode()) {
    // 개발용 검증 훅
    (window as unknown as { __bgm: unknown }).__bgm = {
      current: currentBgm, volume: bgmVolume, setVolume: setBgmVolume,
      scene: () => sceneId,
      files: () => Object.fromEntries(files),
      cues: () => [...cueEls.keys()],
      state: (id: AudioId) => {
        const a = els.get(id);
        return a ? { paused: a.paused, volume: a.volume, time: a.currentTime } : null;
      },
    };
  }
}

// 개발용 핫스왑 — 에디터 업로드를 리로드 없이 반영한다(assets.json은 vite watch 제외).
// vite WebSocket 커스텀 이벤트라 터널로 접속한 다른 기기의 게임에도 전파된다.
if (import.meta.hot) {
  import.meta.hot.on("asset-updated", (d: { asset?: string; file?: string }) => {
    const id = d.asset as AudioId | undefined;
    if (!id || !id.startsWith("audio.")) return;
    // 같은 파일명으로 다시 올렸을 때 브라우저 캐시를 무효화한다
    if (d.file) files.set(id, `${d.file}?v=${Date.now()}`);
    else files.delete(id);
    els.get(id)?.pause();
    els.delete(id);
    cueEls.get(id)?.pause();
    cueEls.delete(id);
    // 지금 울리고 있거나 지금 장면의 곡이 바뀌었으면 장면 기준으로 다시 판단한다
    if (currentId === id || sceneId === id) {
      currentId = null;
      if (sceneId) playBgm(sceneId);
    }
  });
}
