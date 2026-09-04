// ui/hex/hudView.ts — 상단 스테이지·목표 카운터, 우측 NEXT·부스터.
import { Container, Graphics, Text } from "pixi.js";

import { slot } from "../../data/uiLayout";
import { editable, clearEditable } from "../layoutEditor";
import { TIER_COLORS, drawTileFallback } from "./tileArt";
import type { RunState } from "../../engine/hex/types";

export interface HudView {
  root: Container;
  sync(state: RunState): void;
  destroy(): void;
}

function panel(w: number, h: number): Graphics {
  return new Graphics().roundRect(0, 0, w, h, 10).fill({ color: 0x4a3320, alpha: 0.9 });
}

/** 인게임 슬롯 하나. 에디터가 고친 값이 없으면 기본 배치로 간다. */
function box(id: string, fx: number, fy: number, fw: number, fh: number): { id: string; label: string; x: number; y: number; w: number; h: number } {
  const s = slot("ingame", id);
  return s ? { ...s } : { id, label: id, x: fx, y: fy, w: fw, h: fh };
}

/** HUD 조각 하나를 인게임 에디터에 등록한다. 조각들이 컨테이너 없이 root에 흩어져 있으므로
 *  슬롯마다 얇은 컨테이너로 묶어 준다 — 그래야 통째로 끌어 옮길 수 있다. */
function groupFor(root: Container, b: { id: string; label: string; x: number; y: number; w: number; h: number }, ...nodes: Container[]): Container {
  const g = new Container();
  for (const n of nodes) g.addChild(n);
  root.addChild(g);
  editable("ingame", b, g);
  return g;
}

export function createHudView(stageIndex: number): HudView {
  const root = new Container();

  // 배치는 data/uiLayout.json이 들고 있다 — /ui.html 에디터의 「인게임」 탭에서 조정한다.
  // 여기 하드코딩된 숫자는 슬롯이 지워졌을 때만 쓰이는 기본값이다.
  const bar = box("stageBar", 115, 28, 220, 40);
  const top = panel(bar.w, bar.h);
  top.x = bar.x;
  top.y = bar.y;

  const title = new Text({
    text: `STAGE ${stageIndex + 1}`,
    style: { fontSize: 17, fill: 0xffffff, fontWeight: "bold" },
  });
  title.anchor.set(0, 0.5);
  title.x = bar.x + 15;
  title.y = bar.y + bar.h / 2;

  const counter = new Text({
    text: "0/0",
    style: { fontSize: 17, fill: 0xffd76a, fontWeight: "bold" },
  });
  counter.anchor.set(1, 0.5);
  counter.x = bar.x + bar.w - 15;
  counter.y = bar.y + bar.h / 2;
  groupFor(root, bar, top, title, counter);

  // 샷 잔량
  const shotsBox = box("shots", 155, 72, 140, 20);
  const shots = new Text({ text: "", style: { fontSize: 14, fill: 0xffffff } });
  shots.anchor.set(0.5, 0);
  shots.x = shotsBox.x + shotsBox.w / 2;
  shots.y = shotsBox.y;
  groupFor(root, shotsBox, shots);

  // 우측 레일 — NEXT 슬롯과 부스터
  const nextBox = box("nextPanel", 382, 300, 56, 68);
  const nextPanel = panel(nextBox.w, nextBox.h);
  nextPanel.x = nextBox.x;
  nextPanel.y = nextBox.y;

  const nextLabel = new Text({ text: "NEXT", style: { fontSize: 10, fill: 0xffffff } });
  nextLabel.anchor.set(0.5, 0);
  nextLabel.x = nextBox.x + nextBox.w / 2;
  nextLabel.y = nextBox.y + 6;

  const nextSlot = new Container();
  nextSlot.x = nextBox.x + nextBox.w / 2;
  nextSlot.y = nextBox.y + nextBox.h * 0.62;
  groupFor(root, nextBox, nextPanel, nextLabel, nextSlot);

  // 우측 — 부스터 3종
  const boosterLabels: Array<{ id: "bomb" | "rainbow" | "horseshoe"; glyph: string; slotId: string; fy: number }> = [
    { id: "bomb", glyph: "B", slotId: "boosterBomb", fy: 378 },
    { id: "rainbow", glyph: "R", slotId: "boosterRainbow", fy: 434 },
    { id: "horseshoe", glyph: "U", slotId: "boosterHorseshoe", fy: 490 },
  ];
  const boosterTexts = new Map<string, Text>();
  for (const b of boosterLabels) {
    const bb = box(b.slotId, 388, b.fy, 44, 44);
    const cx = bb.x + bb.w / 2;
    const cy = bb.y + bb.h / 2;
    const slotGfx = new Graphics().circle(cx, cy, Math.min(bb.w, bb.h) / 2).fill({ color: 0x4a3320, alpha: 0.9 });

    const glyph = new Text({ text: b.glyph, style: { fontSize: 16, fill: 0xffffff, fontWeight: "bold" } });
    glyph.anchor.set(0.5);
    glyph.x = cx;
    glyph.y = cy;

    const count = new Text({ text: "0", style: { fontSize: 11, fill: 0xffffff, fontWeight: "bold" } });
    count.anchor.set(0.5);
    count.x = cx + bb.w * 0.36;
    count.y = cy + bb.h * 0.36;
    groupFor(root, bb, slotGfx, glyph, count);
    boosterTexts.set(b.id, count);
  }

  let lastNextTier = -1;

  return {
    root,

    sync(state: RunState): void {
      counter.text = `${state.rescued.length}/${state.stage.objective}`;
      shots.text = `남은 발사 ${state.shotsLeft}`;

      if (state.next !== lastNextTier) {
        nextSlot.removeChildren().forEach((c) => c.destroy());
        const chip = drawTileFallback(TIER_COLORS[state.next] ?? 0x888888);
        chip.scale.set(0.6);
        nextSlot.addChild(chip);
        lastNextTier = state.next;
      }

      for (const [id, text] of boosterTexts) {
        text.text = String(state.boosters[id as "bomb" | "rainbow" | "horseshoe"]);
      }
    },

    destroy(): void {
      clearEditable("ingame");
      root.destroy({ children: true });
    },
  };
}
