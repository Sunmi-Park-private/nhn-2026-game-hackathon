// ui/videoScreen.ts — 인트로·엔딩 영상. 세로 화면 전체를 덮는다.
//
// Pixi 텍스처가 아니라 **DOM <video>**를 캔버스 위에 얹는다. 영상 텍스처는 브라우저마다
// 로딩이 멈추는 사례가 있었고, 어차피 그동안 게임은 아무것도 그리지 않으므로
// 캔버스 안에 넣을 이유가 없다.
//
// **소리를 켜고 시작한다.** 예전에는 무음으로 시작하고 버튼으로 켜게 했는데, 그러면
// 첫 접속자는 소리 없는 인트로를 본다(QA).
//
// 자동재생 정책은 그대로 있다 — 브라우저가 소리 있는 자동재생을 거부하면 play()가
// 거절된다. 그때만 무음으로 되돌려 **재생 자체는 살리고**, 화면 어디든 첫 번째
// 터치·클릭·키에서 스스로 소리를 켠다. 소리를 얻자고 영상을 통째로 잃지 않는다.
//
// **설정의 소리 항목은 보지 않는다.** 인트로는 늘 소리를 켜고 시작하고, 끄고 싶은
// 사람은 오른쪽 위 버튼으로 끈다(QA 요구). 그 항목은 게임 안의 BGM·효과음을 위한
// 것이고, 이 영상은 그 전에 한 번 도는 별개의 화면이다.
import { BASE_W, BASE_H } from "./stage";

/** 캔버스가 그려진 자리에 정확히 겹치도록 콘텐츠 컬럼(450×800)의 화면 좌표를 구한다.
 *  로딩 화면(loadingScreen.ts)도 같은 자리를 덮으므로 함께 쓴다. */
export function contentBoxRect(): { left: number; top: number; width: number; height: number } | null {
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

    /** 소리를 원하는 상태인가. 늘 켜고 시작하고, **사용자가 버튼으로 끈 순간에만**
     *  false가 된다 — 그래야 자동 켜기가 그 선택을 되돌리지 않는다. */
    let wantSound = true;
    const video = document.createElement("video");
    video.src = url;
    video.autoplay = true;
    video.muted = false;       // 켜고 시작한다. 브라우저가 막으면 아래에서 되돌린다
    video.playsInline = true;
    video.style.cssText = "width:100%;height:100%;object-fit:cover;display:block";
    host.appendChild(video);

    // 버튼은 **우측 상단**에 둔다. 세로 영상은 아래쪽에 자막이나 로고가 오는 경우가 많고,
    // 손가락으로 화면을 쥘 때 아래 모서리를 덮기도 한다 — 위쪽이 가리지도 가려지지도 않는다.
    const btn = (text: string, right: number): HTMLButtonElement => {
      const b = document.createElement("button");
      b.textContent = text;
      b.style.cssText = "position:absolute;top:16px;border:0;border-radius:18px;padding:8px 16px;"
        + `right:${right}px;background:#000a;color:#fff;font:12px/1 system-ui;font-weight:700;cursor:pointer`;
      host.appendChild(b);
      return b;
    };
    const sound = btn(video.muted ? "🔇" : "🔊", 96);
    const syncSoundLabel = (): void => { sound.textContent = video.muted ? "🔇" : "🔊"; };
    sound.onclick = (e): void => {
      e.stopPropagation();
      video.muted = !video.muted;
      wantSound = !video.muted; // 사용자가 끈 것은 되돌리지 않는다
      syncSoundLabel();
      if (!video.muted) void video.play().catch(() => {});
    };
    const skip = btn(label, 16);

    const place = (): void => {
      const r = contentBoxRect();
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
      unarm?.(); // 영상이 끝난 뒤에도 남으면 다음 탭이 엉뚱하게 소리를 켠다
      video.pause();
      host.remove();
      resolve();
    };

    skip.onclick = finish;
    video.onended = finish;
    // 파일이 없거나 코덱을 못 읽으면 여기로 온다 — 화면이 검은 채로 멈추면 안 된다
    video.onerror = finish;

    /** 자동재생이 막혀 무음으로 되돌아갔을 때, 첫 제스처에서 스스로 소리를 켠다.
     *  버튼을 찾아 누르게 하지 않는다 — 그 무렵이면 인트로가 이미 절반쯤 지나 있다. */
    const armUnmute = (): void => {
      const on = (e: Event): void => {
        off();
        // 소리 버튼 위에서 난 제스처는 건너뛴다. 여기서 켜 버리면 이어서 도는
        // 버튼의 토글이 그것을 곧바로 도로 끈다 — 사용자는 🔇를 눌렀는데 여전히
        // 무음인 채로 남는다(실측으로 잡았다). 그 터치는 버튼에게 맡긴다.
        if (e.target instanceof Node && sound.contains(e.target)) return;
        if (done || !video.muted || !wantSound) return;
        video.muted = false;
        syncSoundLabel();
        void video.play().catch(() => { video.muted = true; syncSoundLabel(); });
      };
      const off = (): void => {
        for (const t of ["pointerdown", "keydown", "touchstart"] as const) {
          document.removeEventListener(t, on);
        }
      };
      for (const t of ["pointerdown", "keydown", "touchstart"] as const) {
        document.addEventListener(t, on, { once: true });
      }
      unarm = off;
    };

    let unarm: (() => void) | null = null;
    video.play().catch(() => {
      // 소리 있는 자동재생이 막혔다 — 무음으로 되살리고 첫 제스처를 기다린다.
      // 그마저 실패하면 재생이 정말 안 되는 것이므로 화면을 넘긴다.
      if (!video.muted) {
        video.muted = true;
        syncSoundLabel();
        armUnmute();
        void video.play().catch(finish);
        return;
      }
      finish();
    });
  });
}
