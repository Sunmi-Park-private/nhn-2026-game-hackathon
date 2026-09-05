// ui/skin.ts — UI 스킨 슬롯. 아트가 있으면 스프라이트, 없으면 코드가 그린 도형.
//
// 헥사 타일과 같은 원칙이다: **아트가 하나도 없어도 화면이 성립하고, 일부만 도착해도 정상 동작한다.**
// 디자이너는 경로에 파일만 드롭한다.
import { Assets, Container, Graphics, Sprite, Text, VideoSource, type Ticker, type Texture } from "pixi.js";

/** 에셋 한 장을 기다리는 상한. 넘기면 폴백으로 간다.
 *  파일이 없을 때 서버가 404가 아니라 index.html을 200으로 돌려주면
 *  Pixi가 그 HTML을 이미지로 디코드하려다 멈출 수 있다 — 화면 전체를 막지 않는다. */
const LOAD_TIMEOUT_MS = 4000;

/** 에셋 경로는 그대로 쓴다.
 *
 *  전에는 개발 중에 `?v=<부팅시각>`을 붙여 매번 새로 받게 했다. 에디터로 같은 경로에
 *  덮어썼을 때 옛 그림이 남는 것을 막으려던 것인데, **부팅마다 URL이 달라져 캐시가
 *  한 번도 안 맞았다** — 새로고침할 때마다 45MB를 통째로 다시 받았고, 원격(터널)에서
 *  일하는 디자이너에게는 그게 몇 초가 됐다.
 *
 *  dev 서버가 이미 `Cache-Control: no-cache` + ETag를 준다. 브라우저가 매번 물어보고
 *  안 바뀌었으면 304(본문 0바이트), 덮어썼으면 200으로 새 그림을 받는다.
 *  막으려던 문제는 그 장치가 이미 막고 있었다. */

/** 영상은 상한을 길게 준다. 이 상한은 「없는 파일 때문에 화면이 멎지 않게」 하려고
 *  둔 것인데(스틸 한 장 기준 4초), 전체화면 영상은 용량이 커서 4초 안에 못 올 수
 *  있다. 짧게 두면 파일이 멀쩡한데도 재시도 없이 영상이 사라진다. */
export const VIDEO_LOAD_TIMEOUT_MS = 60_000;

export async function loadTexture(url: string | undefined, timeoutMs = LOAD_TIMEOUT_MS): Promise<Texture | null> {
  if (!url) return null;
  let timer: ReturnType<typeof setTimeout> | undefined;
  const timeout = new Promise<null>((resolve) => {
    timer = setTimeout(() => resolve(null), timeoutMs);
  });
  try {
    return await Promise.race([Assets.load<Texture>(url).catch(() => null), timeout]);
  } finally {
    if (timer !== undefined) clearTimeout(timer);
  }
}

/** 영상 텍스처를 **실제로 돌린다.** 멈추는 함수를 돌려준다.
 *
 *  두 가지를 손으로 한다. 실측 결과 둘 다 필요했다:
 *   ① 재생 — VideoSource.defaultOptions의 autoPlay만으로는 안 돌 때가 있어
 *     요소를 직접 잡아 play()를 건다. 정책이 막으면 첫 제스처에서 한 번 더.
 *   ② 텍스처 올리기 — 요소는 재생 중인데(paused false, currentTime이 흐른다)
 *     화면이 첫 프레임에 멎어 있었다. Pixi의 autoUpdate는 **Ticker.shared**를 타는데
 *     이 앱은 sharedTicker 기본값(false)이라 자기 티커를 쓴다 — 공유 티커가 돌지
 *     않으니 새 프레임이 GPU로 안 올라간다. **앱 티커를 받아** 매 틱 올린다.
 *
 *  스틸 텍스처면 아무 일도 하지 않는다 — 호출부가 종류를 따지지 않아도 된다.
 *
 *  ⚠️ **형식은 webm(VP9)이어야 한다.** 같은 그림을 mp4(h.264)로 넣으면 요소는
 *  재생되는데(paused false, currentTime이 흐른다) 새 프레임이 텍스처로 올라오지
 *  않아 첫 프레임에 멎는다. 서버를 새로 띄우고 양쪽을 번갈아 재서 확인했다.
 *  Safari는 webm 지원이 늦어 못 읽을 수 있는데, 그때는 스틸 배경이 그대로 남는다. */
export function playVideoTexture(tex: Texture, ticker: Ticker): () => void {
  const src = tex.source;
  if (!(src instanceof VideoSource)) return () => { /* 스틸 */ };
  const v = src.resource;
  if (!v) return () => { /* 요소가 없다 */ };

  v.loop = true;
  v.muted = true;
  v.playsInline = true;

  const kick = (): void => { void v.play().catch(() => { /* 정책이 막으면 다음 제스처에서 */ }); };
  kick();
  const onGesture = (): void => { kick(); };
  window.addEventListener("pointerdown", onGesture);
  window.addEventListener("keydown", onGesture);

  const pump = (): void => { if (!v.paused && v.readyState >= 2) src.update(); };
  ticker.add(pump);

  return (): void => {
    ticker.remove(pump);
    window.removeEventListener("pointerdown", onGesture);
    window.removeEventListener("keydown", onGesture);
    v.pause();
  };
}

/** 경로 묶음을 텍스처 묶음으로. 키는 그대로 유지된다. */
export async function loadSlots<K extends string>(
  paths: Partial<Record<K, string>>,
): Promise<Partial<Record<K, Texture>>> {
  const keys = Object.keys(paths) as K[];
  const textures = await Promise.all(keys.map((k) => loadTexture(paths[k])));
  const out: Partial<Record<K, Texture>> = {};
  keys.forEach((k, i) => {
    const t = textures[i];
    if (t) out[k] = t;
  });
  return out;
}

/**
 * 지정한 상자 **안에** 원본 비율 그대로 넣는다. 중심 정렬.
 *
 * width/height를 따로 넣으면 상자 비율과 다른 그림이 좌우나 상하로 찌그러진다.
 * 슬롯 비율은 배치용 값이고 아트의 비율은 디자이너가 정하는 것이라, 둘이 다를 때
 * 늘리는 쪽이 아니라 **맞춰 넣는 쪽**이 맞다. 남는 자리는 비워 둔다.
 */
export function fitSprite(tex: Texture, w: number, h: number): Sprite {
  const s = new Sprite(tex);
  s.anchor.set(0.5);
  fitContain(s, w, h);
  return s;
}

/** 이미 만든 스프라이트를 상자 안에 비율 그대로 맞춘다. */
export function fitContain(s: Sprite, w: number, h: number): void {
  const tw = s.texture.width || 1;
  const th = s.texture.height || 1;
  const k = Math.min(w / tw, h / th);
  s.scale.set(k);
}

export interface ButtonOpts {
  label: string;
  w: number;
  h: number;
  tex?: Texture | null;
  /** 폴백으로 그릴 때의 바탕색 */
  fill?: number;
  onTap: () => void;
}

/** 버튼 하나. 아트가 있으면 그 위에 라벨을 얹고, 없으면 둥근 사각을 그린다.
 *  히트 영역은 아트 유무와 무관하게 같은 크기다 — 아트가 도착해도 조작감이 안 바뀐다. */
export function makeButton(o: ButtonOpts): Container {
  const box = new Container();
  if (o.tex) {
    box.addChild(fitSprite(o.tex, o.w, o.h));
  } else {
    const g = new Graphics();
    g.roundRect(-o.w / 2, -o.h / 2, o.w, o.h, Math.min(12, o.h / 3)).fill({ color: o.fill ?? 0x8a5a2b });
    g.roundRect(-o.w / 2 + 2, -o.h / 2 + 2, o.w - 4, o.h - 4, Math.min(10, o.h / 3))
      .stroke({ width: 2, color: 0xffffff, alpha: 0.25 });
    box.addChild(g);
  }
  if (o.label) {
    const t = new Text({
      text: o.label,
      style: { fontSize: Math.min(18, o.h * 0.42), fill: 0xffffff, fontWeight: "bold" },
    });
    t.anchor.set(0.5);
    box.addChild(t);
  }
  // 히트 영역을 명시한다 — 아트에 투명 여백이 있어도 누를 수 있는 범위가 같다
  box.eventMode = "static";
  box.cursor = "pointer";
  box.hitArea = { contains: (x: number, y: number) => Math.abs(x) <= o.w / 2 && Math.abs(y) <= o.h / 2 };
  box.on("pointertap", o.onTap);
  // 누르는 느낌 — 아트가 없을 때도 반응이 보여야 한다
  box.on("pointerdown", () => { box.scale.set(0.96); });
  const release = (): void => { box.scale.set(1); };
  box.on("pointerup", release);
  box.on("pointerupoutside", release);
  return box;
}
