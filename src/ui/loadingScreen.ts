// ui/loadingScreen.ts — 게임시작 로딩 화면. 에셋을 받는 동안 세로 컬럼을 덮는다.
//
// 예전에는 「불러오는 중… 12 / 180」 숫자 한 줄이었다(main.ts). 숫자는 멎었는지 알 수는
// 있었지만 게임 화면이 아니었다. 시안대로 **배경 영상 + 반투명 패널(제목·팁·게이지)**로 바꾼다.
//
// videoScreen.ts와 같은 이유로 Pixi가 아니라 **DOM**이다 — 이 시점엔 텍스처가 아직 없고,
// 영상 텍스처는 브라우저마다 첫 프레임에서 멎는 사례가 있다. 영상은 dotted가 `video.`라
// 업로드 플러그인이 webm으로 바꾸지 않는다(mp4가 DOM에서 더 안전하다).
//
// 좌표는 주입받는다(규약 2조). 파일이 없으면 영상 없이 패널만 뜬다 — 뒤는 캔버스 바탕색이다.
import { contentBoxRect } from "./videoScreen";
import {
  loadingFraction, panelPercent, LOADING_TEXT, LOADING_BAR_COLOR, type Box,
} from "./loadingLayout";

export interface LoadingScreenOpts {
  /** 배경 루프 영상. 없으면 영상 없이 패널만 */
  video?: string;
  /** 패널 자리 — 450×800 좌표 */
  panel: Box;
  /** 게이지 색 — 슬롯의 color */
  barColor?: string;
  /** 제목 글자 크기(논리 px) — 슬롯의 fontSize */
  fontSize?: number;
  /** 슬롯을 에디터에서 꺼 두면 영상만 남긴다 */
  hidePanel?: boolean;
}

export interface LoadingScreen {
  /** 진행 숫자가 바뀔 때마다 부른다 */
  update(settled: number, started: number): void;
  close(): void;
}

const el = (tag: string, css: string, text?: string): HTMLElement => {
  const e = document.createElement(tag);
  e.style.cssText = css;
  if (text !== undefined) e.textContent = text;
  return e;
};

export function openLoadingScreen(o: LoadingScreenOpts): LoadingScreen {
  // 인트로 영상(z 1400)보다 아래 — 로딩이 끝나고 인트로가 뜨면 그쪽이 덮는다
  const host = el("div", "position:fixed;z-index:1300;overflow:hidden;pointer-events:none");

  let video: HTMLVideoElement | null = null;
  if (o.video) {
    video = document.createElement("video");
    video.src = o.video;
    video.autoplay = true;
    video.muted = true;
    video.loop = true;
    video.playsInline = true;
    video.style.cssText = "position:absolute;inset:0;width:100%;height:100%;object-fit:cover;display:block";
    // 파일이 없거나 코덱을 못 읽으면 영상만 뺀다 — 검은 사각형이 남으면 안 된다
    video.onerror = (): void => { video?.remove(); video = null; };
    host.appendChild(video);
    void video.play().catch(() => {});
  }

  const pct = panelPercent(o.panel);
  // 흰 판을 깔지 않는다 — 글자와 게이지만 영상 위에 얹는다(QA 요구).
  // 대신 **글자 그림자**를 준다: 영상은 프레임마다 밝기가 바뀌어서, 판이 없으면
  // 밝은 프레임에서 흰 글자가 통째로 사라진다. 판을 뺀 만큼 읽히게 하는 값이다.
  const panel = el("div",
    `position:absolute;left:${pct.left}%;top:${pct.top}%;width:${pct.width}%;height:${pct.height}%;`
    + "box-sizing:border-box;padding:6% 7%;display:flex;flex-direction:column;"
    + "align-items:center;justify-content:center;gap:0.55em;font-family:system-ui,sans-serif;text-align:center;"
    + "text-shadow:0 0.06em 0.18em rgba(20,12,6,.85), 0 0 0.5em rgba(20,12,6,.6)");
  const title = el("div", "font-weight:800;color:#fff3dc;font-size:1em;line-height:1.3", LOADING_TEXT.title);
  const tip = el("div", "color:#e6d9bd;font-size:0.72em;line-height:1.3", LOADING_TEXT.tip);
  // 게이지의 홈은 남긴다 — 없으면 「어디까지 왔나」의 끝이 안 보여 길이를 못 읽는다
  const track = el("div", "width:82%;height:0.7em;border-radius:0.35em;background:rgba(20,12,6,.55);"
    + "box-shadow:0 0 0 1px rgba(255,243,220,.35) inset;overflow:hidden;margin-top:0.2em");
  const fill = el("div",
    `height:100%;width:0%;border-radius:0.35em;background:${o.barColor ?? LOADING_BAR_COLOR};`
    + "transition:width .25s ease-out");
  track.appendChild(fill);
  panel.append(title, tip, track);
  if (o.hidePanel !== true) host.appendChild(panel);

  // 캔버스의 콘텐츠 컬럼(450×800)에 정확히 겹친다. 글자는 컬럼 배율을 따라간다 —
  // 논리 px 하나가 실제 몇 px인지는 창 크기가 정한다.
  const place = (): void => {
    const r = contentBoxRect();
    if (!r) return;
    host.style.left = `${r.left}px`;
    host.style.top = `${r.top}px`;
    host.style.width = `${r.width}px`;
    host.style.height = `${r.height}px`;
    panel.style.fontSize = `${(o.fontSize ?? 17) * (r.height / 800)}px`;
  };
  place();
  window.addEventListener("resize", place);
  document.body.appendChild(host);

  let closed = false;
  return {
    update(settled, started): void {
      fill.style.width = `${Math.round(loadingFraction(settled, started) * 100)}%`;
    },
    close(): void {
      if (closed) return;
      closed = true;
      window.removeEventListener("resize", place);
      video?.pause();
      host.remove();
    },
  };
}
