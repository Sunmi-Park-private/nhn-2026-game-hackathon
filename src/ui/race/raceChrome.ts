// ui/race/raceChrome.ts — 레이스 화면이 반복해서 쓰는 위젯 둘.
//
// 누를 수 있는 자리와 글자 하나. 로비 hotspot과 같은 규칙이다 —
// 슬롯마다 따로 판단해서, 아트가 있으면 그리고 없으면 형태와 이름을 그린다.
import { Container, Graphics, Text, type Texture } from "pixi.js";
import { fitSprite } from "../skin";
import type { UiSlot } from "../../data/uiLayout";

/** 누를 수 있는 자리.
 *
 *  **pointerdown으로 받는다.** pointertap은 눌렀다 뗀 것을 확인한 뒤에야 울려서
 *  연타가 씹힌다 — RUN 버튼이 이 게임의 조작 전부라 씹히면 게임이 성립하지 않는다. */
export function hotspot(
  b: UiSlot,
  tex: Texture | undefined,
  fill: number,
  onDown: () => void,
  register?: (b: UiSlot, node: Container) => void,
): Container {
  const c = new Container();
  c.x = b.x;
  c.y = b.y;

  if (tex) {
    const s = fitSprite(tex, b.w, b.h);
    s.x = b.w / 2;
    s.y = b.h / 2;
    c.addChild(s);
  } else {
    const g = new Graphics().roundRect(0, 0, b.w, b.h, 12).fill(fill);
    g.roundRect(3, 3, b.w - 6, b.h - 6, 9).stroke({ width: 2, color: 0xffffff, alpha: 0.2 });
    c.addChild(g);
    const t = new Text({
      text: b.label,
      style: { fontSize: Math.min(22, b.h * 0.34), fill: 0xfff3dc, fontWeight: "bold" },
    });
    t.anchor.set(0.5);
    t.x = b.w / 2;
    t.y = b.h / 2;
    c.addChild(t);
  }

  // 투명이어도 히트 판정을 받으려면 실제로 채워야 한다(alpha 0)
  c.addChild(new Graphics().rect(0, 0, b.w, b.h).fill({ color: 0xffffff, alpha: 0 }));
  register?.(b, c); // 레이아웃 에디터가 이 노드를 잡는다

  // 에디터에서 끈 슬롯은 그리지도 않고 누를 수도 없다
  c.visible = b.hidden !== true;
  c.eventMode = "static";
  c.cursor = "pointer";
  c.on("pointerdown", () => { c.alpha = 0.8; onDown(); });
  const up = (): void => { c.alpha = 1; };
  c.on("pointerup", up);
  c.on("pointerupoutside", up);
  return c;
}

/** 슬롯 한가운데에 놓는 글자. 크기·색은 슬롯이 들고 있으면 그 값을 쓴다(에디터에서 조정). */
export function slotText(b: UiSlot, size: number, color: number): Text {
  const t = new Text({
    text: "",
    style: {
      fontSize: b.fontSize ?? size,
      fill: color,
      fontWeight: "bold",
      // 밝은 배경 위에서도 읽혀야 한다 — 트랙과 하늘이 둘 다 밝다
      stroke: { color: 0x1a1108, width: 3 },
    },
  });
  t.anchor.set(0.5);
  t.x = b.x + b.w / 2;
  t.y = b.y + b.h / 2;
  t.visible = b.hidden !== true;
  return t;
}
