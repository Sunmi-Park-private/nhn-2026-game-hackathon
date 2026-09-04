// ui/panelBits.ts — 나무 패널 UI의 공용 조각. 설정창과 확인창이 함께 쓴다.
//
// 「아트가 있으면 그것, 없으면 색과 글자로 대신한다」가 이 화면들의 규칙이다.
// 그 규칙을 한 곳에 둔다 — 창이 늘 때마다 같은 코드를 다시 쓰지 않게.
import { Container, Graphics, Text, type Texture } from "pixi.js";
import { fitSprite } from "./skin";
import { buzz } from "./settings";
import { playSfx } from "./audio";
import { editable } from "./layoutEditor";

export interface Box {
  x: number;
  y: number;
  w: number;
  h: number;
  id?: string;
  label?: string;
}

/**
 * 누를 수 있는 영역. 아트가 있으면 그 위에 투명하게 얹고, 없으면 형태를 그려 준다.
 *
 * `area`가 있으면 레이아웃 에디터에 등록한다 — 좌표가 uiLayout.json에 사는 창만
 * 해당한다. 코드가 자리를 정하는 창은 area를 비워 두면 에디터에 뜨지 않는다.
 */
export function hotspot(
  area: string | null,
  b: Box,
  onTap: () => void,
  draw?: (g: Graphics) => void,
): Container {
  const c = new Container();
  c.x = b.x;
  c.y = b.y;
  const g = new Graphics();
  if (draw) draw(g);
  // 투명이어도 히트 판정을 받으려면 실제로 채워야 한다(alpha 0)
  g.rect(0, 0, b.w, b.h).fill({ color: 0xffffff, alpha: 0 });
  c.addChild(g);
  if (area && b.id) editable(area, { id: b.id, label: b.label ?? b.id, x: b.x, y: b.y, w: b.w, h: b.h }, c);
  c.eventMode = "static";
  c.cursor = "pointer";
  c.on("pointertap", () => { buzz(); playSfx("audio.sfxTap"); onTap(); });
  c.on("pointerdown", () => { c.alpha = 0.75; });
  const up = (): void => { c.alpha = 1; };
  c.on("pointerup", up);
  c.on("pointerupoutside", up);
  return c;
}

/** 상자 안에 들어갈 글자 크기. 좌우로 좁아져도 넘치지 않게 상자에서 뽑는다.
 *  에디터는 크기에 하한이 없고 음수 fontSize는 Pixi에서 글자가 깨지므로 하한을 둔다. */
export function fitFontSize(b: { w: number; h: number }, text: string): number {
  return Math.max(8, Math.min(b.h * 0.42, (b.w - 12) / Math.max(1, [...text].length * 0.62)));
}

/** 버튼 한 장. 아트가 있으면 그걸 그리고, 없으면 색과 글자로 대신한다. */
export function plate(
  b: Box,
  tex: Texture | undefined,
  fill: number,
  text: string,
  round = false,
): Container {
  const c = new Container();
  const cx = b.x + b.w / 2;
  const cy = b.y + b.h / 2;
  if (tex) {
    const s = fitSprite(tex, b.w, b.h);
    s.x = cx;
    s.y = cy;
    c.addChild(s);
    return c;
  }
  const g = new Graphics();
  if (round) g.circle(cx, cy, b.w / 2).fill({ color: fill }).stroke({ width: 3, color: 0x8f9bab });
  else g.roundRect(b.x, b.y, b.w, b.h, 10).fill({ color: fill });
  c.addChild(g);
  const t = new Text({
    text,
    style: { fontSize: fitFontSize(b, text), fill: 0xfff3dc, fontWeight: "bold" },
  });
  t.anchor.set(0.5);
  t.x = cx;
  t.y = cy;
  c.addChild(t);
  return c;
}
