// ui/collection.ts — 도감(ANIMALS). 구출한 동물과 아직 못 구한 동물을 한 판에 보여준다.
import { Container, Graphics, Text, type Texture } from "pixi.js";
import { BASE_W, stageTop, stageHeight, stageLeft, stageWidth } from "./stage";
import { fitSprite } from "./skin";
import { ANIMALS } from "../data/animals";
import { buzz } from "./settings";

const COLS = 3;
const CELL_W = 118;
const CELL_H = 128;

/** 도감을 띄우고 닫힐 때까지 기다린다. */
export function openCollection(
  parent: Container,
  rescued: readonly string[],
  animalTextures: Record<string, Texture | null>,
): Promise<void> {
  return new Promise<void>((resolve) => {
    const root = new Container();
    parent.addChild(root);

    const veil = new Graphics()
      .rect(stageLeft(), stageTop(), stageWidth(), stageHeight())
      .fill({ color: 0x120c06, alpha: 0.82 });
    veil.eventMode = "static";
    root.addChild(veil);

    const title = new Text({ text: "ANIMALS", style: { fontSize: 24, fill: 0xfff3dc, fontWeight: "bold" } });
    title.anchor.set(0.5);
    title.x = BASE_W / 2;
    title.y = stageTop() + 60;
    root.addChild(title);

    const have = new Set(rescued);
    const count = new Text({
      text: `${have.size} / ${ANIMALS.length}`,
      style: { fontSize: 14, fill: 0xf0c96a, fontWeight: "bold" },
    });
    count.anchor.set(0.5);
    count.x = BASE_W / 2;
    count.y = title.y + 26;
    root.addChild(count);

    const gridW = COLS * CELL_W;
    const originX = (BASE_W - gridW) / 2;
    const originY = stageTop() + 110;

    ANIMALS.forEach((a, i) => {
      const cx = originX + (i % COLS) * CELL_W + CELL_W / 2;
      const cy = originY + Math.floor(i / COLS) * CELL_H + CELL_H / 2;
      const got = have.has(a.id);

      const card = new Graphics()
        .roundRect(cx - 50, cy - 54, 100, 108, 12)
        .fill({ color: got ? 0x53341c : 0x2b1d10 });
      card.stroke({ width: 2, color: got ? 0xc98a3c : 0x3d2513 });
      root.addChild(card);

      const tex = animalTextures[a.id] ?? null;
      if (got && tex) {
        const s = fitSprite(tex, 64, 64);
        s.x = cx;
        s.y = cy - 12;
        root.addChild(s);
      } else {
        const glyph = new Text({ text: got ? a.glyph : "?", style: { fontSize: got ? 40 : 34 } });
        glyph.anchor.set(0.5);
        glyph.x = cx;
        glyph.y = cy - 12;
        glyph.alpha = got ? 1 : 0.4;
        root.addChild(glyph);
      }

      const name = new Text({
        text: got ? a.name : "???",
        style: { fontSize: 12, fill: got ? 0xfff3dc : 0x8a7a63, fontWeight: "bold" },
      });
      name.anchor.set(0.5);
      name.x = cx;
      name.y = cy + 36;
      root.addChild(name);
    });

    let done = false;
    const finish = (): void => {
      if (done) return;
      done = true;
      buzz();
      root.destroy({ children: true });
      resolve();
    };

    const close = new Container();
    close.x = BASE_W / 2;
    close.y = stageTop() + stageHeight() - 70;
    const btn = new Graphics().roundRect(-70, -22, 140, 44, 10).fill({ color: 0xc98a3c });
    close.addChild(btn);
    const t = new Text({ text: "닫기", style: { fontSize: 16, fill: 0xffffff, fontWeight: "bold" } });
    t.anchor.set(0.5);
    close.addChild(t);
    close.eventMode = "static";
    close.cursor = "pointer";
    close.on("pointertap", finish);
    root.addChild(close);

    veil.on("pointertap", finish);
  });
}
