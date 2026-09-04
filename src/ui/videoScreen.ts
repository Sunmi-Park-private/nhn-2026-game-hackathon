// ui/videoScreen.ts — 인트로·엔딩 영상. 세로 화면 전체를 덮는다.
//
// Pixi 텍스처가 아니라 **DOM <video>**를 캔버스 위에 얹는다. 영상 텍스처는 브라우저마다
// 로딩이 멈추는 사례가 있었고, 어차피 그동안 게임은 아무것도 그리지 않으므로
// 캔버스 안에 넣을 이유가 없다.
//
// 자동재생 정책 때문에 **무음으로 시작**한다. 소리는 사용자가 켠다 — 첫 제스처 전에는
// 어떤 브라우저도 소리 있는 재생을 허용하지 않으므로, 몰래 시도하다 재생이 통째로
// 막히는 것보다 버튼을 내주는 편이 낫다.
import { BASE_W, BASE_H } from "./stage";

/** 캔버스가 그려진 자리에 정확히 겹치도록 콘텐츠 컬럼(450×800)의 화면 좌표를 구한다. */
function boxRect(): { left: number; top: number; width: number; height: number } | null {
  const cv = document.querySelector("canvas");
  if (!cv) return null;
  const r = cv.getBoundingClientRect();
  // 캔버스는 논리 폭(16:9까지)이 가변이고 콘텐츠는 그 한가운데 450 컬럼이다
  const scale = r.height / BASE_H;
  const width = BASE_W * scale;
  return { left: r.left + (r.width - width) / 2, top: r.top, width, height: r.height };
}

/**
 * 영상을 끝까지 재생한다. 건너뛰기를 누르거나 재생이 실패하면 바로 끝난다.
 * 파일이 없으면(빈 url) 아무 일도 하지 않는다 — 호출부가 조건을 따지지 않아도 된다.
 */
export function playVideo(url: string | undefined, label = "건너뛰기"): Promise<void> {
  if (!url) return Promise.resolve();

  return new Promise<void>((resolve) => {
    const host = document.createElement("div");
    host.style.cssText = "position:fixed;z-index:1400;background:#000;overflow:hidden";

    const video = document.createElement("video");
    video.src = url;
    video.autoplay = true;
    video.muted = true;        // 자동재생 정책 — 소리는 아래 버튼으로 켠다
    video.playsInline = true;
    video.style.cssText = "width:100%;height:100%;object-fit:cover;display:block";
    host.appendChild(video);

    const btn = (text: string, right: number): HTMLButtonElement => {
      const b = document.createElement("button");
      b.textContent = text;
      b.style.cssText = "position:absolute;bottom:16px;border:0;border-radius:18px;padding:8px 16px;"
        + `right:${right}px;background:#000a;color:#fff;font:12px/1 system-ui;font-weight:700;cursor:pointer`;
      host.appendChild(b);
      return b;
    };
    const sound = btn("🔇", 96);
    sound.onclick = (e): void => {
      e.stopPropagation();
      video.muted = !video.muted;
      sound.textContent = video.muted ? "🔇" : "🔊";
      if (!video.muted) void video.play().catch(() => {});
    };
    const skip = btn(label, 16);

    const place = (): void => {
      const r = boxRect();
      if (!r) return;
      host.style.left = `${r.left}px`;
      host.style.top = `${r.top}px`;
      host.style.width = `${r.width}px`;
      host.style.height = `${r.height}px`;
    };
    place();
    window.addEventListener("resize", place);
    document.body.appendChild(host);

    let done = false;
    const finish = (): void => {
      if (done) return;
      done = true;
      window.removeEventListener("resize", place);
      video.pause();
      host.remove();
      resolve();
    };

    skip.onclick = finish;
    video.onended = finish;
    // 파일이 없거나 코덱을 못 읽으면 여기로 온다 — 화면이 검은 채로 멈추면 안 된다
    video.onerror = finish;
    void video.play().catch(finish);
  });
}
