// ui/race/laneFlags.ts — 트랙 왼쪽의 레인 번호 깃발 6개.
//
// 시안에서 색이 레인을 가른다(빨강·노랑·파랑·초록·주황·보라). 아트가 없으면 그 색과
// 번호를 코드가 그린다 — 몇 번 레인인지가 아트 없이도 읽혀야 한다.
import { Container, Graphics, Text, type Texture } from "pixi.js";
import { fitSprite } from "../skin";

/** 시안의 레인 색 — 1번부터 */
const LANE_COLORS = [0xd6352b, 0xf0b823, 0x2f7fd6, 0x3faa48, 0xe8762a, 0x8b4fc4];

export function createLaneFlags(o: {
  box: { x: number; y: number; w: number; h: number };
  laneY: (lane: number) => number;
  tex: Partial<Record<string, Texture>>;
}): Container {
  const node = new Container();
  const h = o.box.h / LANE_COLORS.length;

  LANE_COLORS.forEach((color, i) => {
    const y = o.laneY(i);
    const art = o.tex[`lane${i + 1}`];
    if (art) {
      const s = fitSprite(art, o.box.w, h * 0.9);
      s.x = o.box.x + o.box.w / 2;
      s.y = y;
      node.addChild(s);
      return;
    }
    const fh = Math.min(h * 0.8, o.box.w);
    const g = new Graphics()
      .poly([0, 0, o.box.w, 0, o.box.w * 0.72, fh / 2, o.box.w, fh, 0, fh])
      .fill(color);
    g.x = o.box.x;
    g.y = y - fh / 2;
    node.addChild(g);

    const t = new Text({
      text: String(i + 1),
      style: { fontSize: fh * 0.6, fill: 0xffffff, fontWeight: "bold", stroke: { color: 0x2a1d10, width: 3 } },
    });
    t.anchor.set(0.5);
    t.x = o.box.x + o.box.w * 0.42;
    t.y = y;
    node.addChild(t);
  });

  return node;
}
