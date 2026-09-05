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

/** 제목 판의 세로 padding·가로 padding·줄높이. 판의 높이가 이 셋에서 나온다. */
const TITLE_PAD_Y = 0.35;
const TITLE_PAD_X = 0.7;
const TITLE_LINE_H = 1.3;

/** 제목 판의 높이(패널 글자 크기 기준 em — 제목이 1em이라 같다).
 *  문구와 게이지를 이만큼 내린다. 숫자를 따로 적지 않는다:
 *  padding을 만지면 내려가는 양도 같이 따라와야 한다. */
const PLATE_H = TITLE_LINE_H + TITLE_PAD_Y * 2;

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
  //
  // 글자 그림자도 뺐다. 대신 **제목 뒤에만** 검은 판(40%)을 깐다 — 영상은 프레임마다
  // 밝기가 바뀌어서 아무 받침도 없으면 밝은 프레임에서 글자가 사라진다.
  // 팁은 요구대로 받침 없이 글자만 둔다.
  const panel = el("div",
    `position:absolute;left:${pct.left}%;top:${pct.top}%;width:${pct.width}%;height:${pct.height}%;`
    + "box-sizing:border-box;padding:6% 7%;display:flex;flex-direction:column;"
    + "align-items:center;justify-content:center;gap:0.55em;font-family:system-ui,sans-serif;text-align:center;"
    // 두 문구를 **직사각형 높이만큼** 내린다(QA 요구). 문구만 내리면 팁이 게이지를
    // 덮으므로 게이지까지 같은 만큼 함께 내린다 — 간격은 그대로 유지된다.
    // 흐름이 아니라 transform으로 민다: 흐름에서 밀면 패널이 가운데 정렬이라
    // 내려간 양이 절반으로 줄고, 게이지가 눌려 사라진다.
    + `transform:translateY(${PLATE_H}em)`);
  // 판은 글자를 감싸는 만큼만 — flex column의 align-items:center가 폭을 내용에 맞춘다.
  // 세로 padding을 주지 않으면 line-height에 딱 붙어 「직사각형」으로 안 읽힌다.
  const title = el("div",
    `font-weight:800;color:#fff3dc;font-size:1em;line-height:${TITLE_LINE_H};`
    + `padding:${TITLE_PAD_Y}em ${TITLE_PAD_X}em;background:rgba(0,0,0,.4)`, LOADING_TEXT.title);
  const tip = el("div", "color:#e6d9bd;font-size:0.72em;line-height:1.3", LOADING_TEXT.tip);
  const texts = el("div", "display:flex;flex-direction:column;align-items:center;gap:0.55em");
  texts.append(title, tip);
  // 게이지의 홈은 남긴다 — 없으면 「어디까지 왔나」의 끝이 안 보여 길이를 못 읽는다
  // flex-shrink:0 — 패널 높이가 빠듯하면 flex가 이 홈부터 눌러 0px로 만든다.
  // 게이지가 사라진 채로도 화면은 멀쩡해 보여서 눈으로는 못 잡는다(실측으로 잡았다).
  const track = el("div", "width:82%;height:0.7em;flex-shrink:0;border-radius:0.35em;background:rgba(20,12,6,.55);"
    + "box-shadow:0 0 0 1px rgba(255,243,220,.35) inset;overflow:hidden;margin-top:0.2em");
  const fill = el("div",
    `height:100%;width:0%;border-radius:0.35em;background:${o.barColor ?? LOADING_BAR_COLOR};`
    + "transition:width .25s ease-out");
  track.appendChild(fill);
  panel.append(texts, track);
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
