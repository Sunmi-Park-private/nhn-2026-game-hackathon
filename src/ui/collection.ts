// ui/collection.ts — 도감(구출한 동물). 로비 하단 ANIMALS로 들어온다.
//
// 패널 한 장이 틀을 그리고, 동물마다 카드가 두 장이다 — 구출했으면 해제 카드,
// 아직이면 실루엣 카드. 카드 아트에는 이름표까지 그려져 있으므로 아트가 있으면
// 코드는 글자를 얹지 않는다. 아트가 없을 때만 이름과 ??? 를 그린다.
//
// 배치는 data/uiLayout.json의 「도감」 영역이 들고 있다 — /ui.html에서 조정한다.
import { Container, Graphics, Text, type Texture } from "pixi.js";
import { stageTop, stageHeight, stageLeft, stageWidth } from "./stage";
import { fitSprite } from "./skin";
import { ANIMALS } from "../data/animals";
import { slot, type UiSlot } from "../data/uiLayout";
import { buzz } from "./settings";
import { playSfx } from "./audio";
import { editable, clearEditable } from "./layoutEditor";
import { applySlotHitArea } from "./slotHitRect";

const AREA = "collection";

export interface CollectionTextures {
  panel?: Texture;
  close?: Texture;
  /** 구출한 동물의 카드. 아직 안 올라온 동물은 키가 없다 */
  cards: Partial<Record<string, Texture>>;
  /** 아직 못 구한 동물의 실루엣 카드 */
  locked: Partial<Record<string, Texture>>;
}

/** 격자 기본 배치 — 슬롯이 지워졌을 때만 쓴다. 2열 × 3행. */
const GRID = { x: 91, y: 218, w: 114, h: 119, dx: 130, dy: 128 } as const;

function box(id: string, fallback: { x: number; y: number; w: number; h: number }): UiSlot {
  return slot(AREA, id) ?? { id, label: id, ...fallback };
}

/** 슬롯 id는 동물 id에서 만든다 — cellRabbit, cellSheep … */
const cellId = (animalId: string): string => `cell${animalId[0]!.toUpperCase()}${animalId.slice(1)}`;

/** 카드 한 장. 아트가 있으면 그것만 그리고, 없으면 형태·글리프·이름을 그린다. */
function card(b: UiSlot, tex: Texture | null, got: boolean, name: string, glyph: string): Container {
  const c = new Container();
  c.x = b.x;
  c.y = b.y;

  if (tex) {
    const s = fitSprite(tex, b.w, b.h);
    s.x = b.w / 2;
    s.y = b.h / 2;
    c.addChild(s);
    return c;
  }

  const g = new Graphics().roundRect(0, 0, b.w, b.h, 12).fill({ color: got ? 0x53341c : 0x2b1d10 });
  g.roundRect(1, 1, b.w - 2, b.h - 2, 11).stroke({ width: 2, color: got ? 0xc98a3c : 0x3d2513 });
  c.addChild(g);

  const face = new Text({ text: got ? glyph : "?", style: { fontSize: got ? b.h * 0.36 : b.h * 0.3 } });
  face.anchor.set(0.5);
  face.x = b.w / 2;
  face.y = b.h * 0.4;
  face.alpha = got ? 1 : 0.4;
  c.addChild(face);

  const label = new Text({
    text: got ? name : "???",
    style: { fontSize: 12, fill: got ? 0xfff3dc : 0x8a7a63, fontWeight: "bold" },
  });
  label.anchor.set(0.5);
  label.x = b.w / 2;
  label.y = b.h * 0.83;
  c.addChild(label);
  return c;
}

/** 도감을 띄우고 닫힐 때까지 기다린다. */
export function openCollection(
  parent: Container,
  rescued: readonly string[],
  tex: CollectionTextures,
): Promise<void> {
  return new Promise<void>((resolve) => {
    const root = new Container();
    parent.addChild(root);

    // 막 — 뒤 화면으로 터치가 새지 않게 한다. 아무 데나 누르면 닫힌다.
    const veil = new Graphics()
      .rect(stageLeft(), stageTop(), stageWidth(), stageHeight())
      .fill({ color: 0x120c06, alpha: 0.82 });
    veil.eventMode = "static";
    root.addChild(veil);

    const p = box("panel", { x: 50, y: 130, w: 350, h: 528 });
    const panel = new Container();
    panel.x = p.x;
    panel.y = p.y;
    if (tex.panel) {
      const s = fitSprite(tex.panel, p.w, p.h);
      s.x = p.w / 2;
      s.y = p.h / 2;
      panel.addChild(s);
    } else {
      const g = new Graphics().roundRect(0, 0, p.w, p.h, 16).fill({ color: 0x6b4626 });
      g.roundRect(6, 6, p.w - 12, p.h - 12, 12).stroke({ width: 3, color: 0x3d2513 });
      panel.addChild(g);
      const title = new Text({ text: "구출한 동물", style: { fontSize: 22, fill: 0xfff3dc, fontWeight: "bold" } });
      title.anchor.set(0.5);
      title.x = p.w / 2;
      title.y = 30;
      panel.addChild(title);
    }
    root.addChild(panel);
    editable(AREA, p, panel);

    const have = new Set(rescued);
    ANIMALS.forEach((a, i) => {
      const b = box(cellId(a.id), {
        x: GRID.x + (i % 2) * GRID.dx,
        y: GRID.y + Math.floor(i / 2) * GRID.dy,
        w: GRID.w,
        h: GRID.h,
      });
      const got = have.has(a.id);
      const art = got ? (tex.cards[a.id] ?? null) : (tex.locked[a.id] ?? null);
      const node = card(b, art, got, a.name, a.glyph);
      root.addChild(node);
      editable(AREA, b, node);
    });

    const cb = box("count", { x: 185, y: 605, w: 80, h: 26 });
    const countBox = new Container();
    countBox.x = cb.x;
    countBox.y = cb.y;
    const count = new Text({
      text: `${have.size} / ${ANIMALS.length}`,
      style: {
        fontSize: cb.fontSize ?? 17,
        fill: cb.color ?? 0xfff3dc,
        fontWeight: "bold",
        stroke: { color: 0x2a1a0c, width: 3 },
      },
    });
    count.anchor.set(0.5);
    count.x = cb.w / 2;
    count.y = cb.h / 2;
    countBox.addChild(count);
    root.addChild(countBox);
    editable(AREA, cb, countBox);

    let done = false;
    const finish = (): void => {
      if (done) return;
      done = true;
      buzz();
      playSfx("audio.sfxTap");
      clearEditable(AREA);
      root.destroy({ children: true });
      resolve();
    };

    const cx = box("close", { x: 349, y: 159, w: 45, h: 45 });
    const close = new Container();
    close.x = cx.x;
    close.y = cx.y;
    if (tex.close) {
      const s = fitSprite(tex.close, cx.w, cx.h);
      s.x = cx.w / 2;
      s.y = cx.h / 2;
      close.addChild(s);
    } else {
      const g = new Graphics().circle(cx.w / 2, cx.h / 2, cx.w / 2).fill({ color: 0xd23b30 });
      g.stroke({ width: 3, color: 0x8f9bab });
      close.addChild(g);
      const t = new Text({ text: "✕", style: { fontSize: 20, fill: 0xffffff, fontWeight: "bold" } });
      t.anchor.set(0.5);
      t.x = cx.w / 2;
      t.y = cx.h / 2;
      close.addChild(t);
    }
    // 투명이어도 히트 판정을 받으려면 실제로 채워야 한다(alpha 0)
    close.addChild(new Graphics().rect(0, 0, cx.w, cx.h).fill({ color: 0xffffff, alpha: 0 }));
    close.eventMode = "static";
    close.cursor = "pointer";
    close.on("pointertap", finish);
    root.addChild(close);
    editable(AREA, cx, close);
    applySlotHitArea(close, cx); // 배율이 히트 영역까지 키우지 않게

    veil.on("pointertap", finish);
  });
}
