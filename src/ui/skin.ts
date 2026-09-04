// ui/skin.ts — UI 스킨 슬롯. 아트가 있으면 스프라이트, 없으면 코드가 그린 도형.
//
// 헥사 타일과 같은 원칙이다: **아트가 하나도 없어도 화면이 성립하고, 일부만 도착해도 정상 동작한다.**
// 디자이너는 경로에 파일만 드롭한다.
import { Assets, Container, Graphics, Sprite, Text, type Texture } from "pixi.js";

/** 에셋 한 장을 기다리는 상한. 넘기면 폴백으로 간다.
 *  파일이 없을 때 서버가 404가 아니라 index.html을 200으로 돌려주면
 *  Pixi가 그 HTML을 이미지로 디코드하려다 멈출 수 있다 — 화면 전체를 막지 않는다. */
const LOAD_TIMEOUT_MS = 4000;

export async function loadTexture(url: string | undefined): Promise<Texture | null> {
  if (!url) return null;
  let timer: ReturnType<typeof setTimeout> | undefined;
  const timeout = new Promise<null>((resolve) => {
    timer = setTimeout(() => resolve(null), LOAD_TIMEOUT_MS);
  });
  try {
    return await Promise.race([Assets.load<Texture>(url).catch(() => null), timeout]);
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

/** 지정한 크기에 맞춘 스프라이트. 중심 정렬. */
export function fitSprite(tex: Texture, w: number, h: number): Sprite {
  const s = new Sprite(tex);
  s.anchor.set(0.5);
  s.width = w;
  s.height = h;
  return s;
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
