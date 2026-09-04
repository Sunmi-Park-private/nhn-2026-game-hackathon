// ui/skin.ts — UI 스킨 슬롯. 아트가 있으면 스프라이트, 없으면 코드가 그린 도형.
//
// 헥사 타일과 같은 원칙이다: **아트가 하나도 없어도 화면이 성립하고, 일부만 도착해도 정상 동작한다.**
// 디자이너는 경로에 파일만 드롭한다.
import { Assets, Container, Graphics, Sprite, Text, type Texture } from "pixi.js";

/** 에셋 한 장을 기다리는 상한. 넘기면 폴백으로 간다.
 *  파일이 없을 때 서버가 404가 아니라 index.html을 200으로 돌려주면
 *  Pixi가 그 HTML을 이미지로 디코드하려다 멈출 수 있다 — 화면 전체를 막지 않는다. */
const LOAD_TIMEOUT_MS = 4000;

/** 개발 중에는 매번 새로 받는다.
 *  에디터로 같은 경로에 덮어써도 브라우저가 옛 그림을 들고 있으면 「업로드가 안 먹는다」로 보인다.
 *  빌드본에는 붙지 않는다 — 파일 이름이 곧 버전이다. */
function bust(url: string): string {
  return import.meta.env.DEV ? `${url}${url.includes("?") ? "&" : "?"}v=${BOOT}` : url;
}
const BOOT = Date.now();

export async function loadTexture(url: string | undefined): Promise<Texture | null> {
  if (!url) return null;
  let timer: ReturnType<typeof setTimeout> | undefined;
  const timeout = new Promise<null>((resolve) => {
    timer = setTimeout(() => resolve(null), LOAD_TIMEOUT_MS);
  });
  try {
    return await Promise.race([Assets.load<Texture>(bust(url)).catch(() => null), timeout]);
  } finally {
    if (timer !== undefined) clearTimeout(timer);
  }
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
