// ui/hex/hudView.ts — 상단 스테이지·목표 카운터, 우측 NEXT·부스터.
import { Container, Graphics, Text } from "pixi.js";
import { CENTER_W, RAIL_W, RAIL_MARGIN } from "./geom";
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

export function createHudView(stageIndex: number): HudView {
  const root = new Container();

  // 상단 — 스테이지 번호 + 목표 카운터
  // Ruling Q: 중앙 컬럼 450 기준으로 좌표 유도
  const HUD_W = 220;
  const HUD_X = (CENTER_W - HUD_W) / 2; // 115
  const top = panel(HUD_W, 40);
  top.x = HUD_X;
  top.y = 28;
  root.addChild(top);

  const title = new Text({
    text: `STAGE ${stageIndex + 1}`,
    style: { fontSize: 17, fill: 0xffffff, fontWeight: "bold" },
  });
  title.anchor.set(0, 0.5);
  title.x = HUD_X + 15; // 130
  title.y = 48;
  root.addChild(title);

  const counter = new Text({
    text: "0/0",
    style: { fontSize: 17, fill: 0xffd76a, fontWeight: "bold" },
  });
  counter.anchor.set(1, 0.5);
  counter.x = HUD_X + HUD_W - 15; // 320
  counter.y = 48;
  root.addChild(counter);

  // 샷 잔량
  const shots = new Text({
    text: "",
    style: { fontSize: 14, fill: 0xffffff },
  });
  shots.anchor.set(0.5, 0);
  shots.x = CENTER_W / 2; // 225
  shots.y = 74;
  root.addChild(shots);

  // 우측 레일 — NEXT 슬롯과 부스터가 같은 세로선에 정렬된다
  // RAIL_W·RAIL_MARGIN은 geom.ts에서 가져온다 — 판 폭 계산이 같은 상수를 쓰지 않으면
  // 둘이 어긋나 판이 레일 밑으로 파고들 수 있다.
  const RAIL_X = CENTER_W - RAIL_MARGIN - RAIL_W; // 382
  const RAIL_CX = RAIL_X + RAIL_W / 2; // 410

  const nextPanel = panel(RAIL_W, 68);
  nextPanel.x = RAIL_X;
  nextPanel.y = 300;
  root.addChild(nextPanel);

  const nextLabel = new Text({ text: "NEXT", style: { fontSize: 10, fill: 0xffffff } });
  nextLabel.anchor.set(0.5, 0);
  nextLabel.x = RAIL_CX;
  nextLabel.y = 306;
  root.addChild(nextLabel);

  const nextSlot = new Container();
  nextSlot.x = RAIL_CX;
  nextSlot.y = 342;
  root.addChild(nextSlot);

  // 우측 — 부스터 3종
  const boosterLabels: Array<{ id: "bomb" | "rainbow" | "horseshoe"; glyph: string }> = [
    { id: "bomb", glyph: "B" },
    { id: "rainbow", glyph: "R" },
    { id: "horseshoe", glyph: "U" },
  ];
  const boosterTexts = new Map<string, Text>();
  boosterLabels.forEach((b, i) => {
    const y = 400 + i * 56;
    const slot = new Graphics().circle(RAIL_CX, y, 22).fill({ color: 0x4a3320, alpha: 0.9 });
    root.addChild(slot);

    const glyph = new Text({ text: b.glyph, style: { fontSize: 16, fill: 0xffffff, fontWeight: "bold" } });
    glyph.anchor.set(0.5);
    glyph.x = RAIL_CX;
    glyph.y = y;
    root.addChild(glyph);

    const count = new Text({ text: "0", style: { fontSize: 11, fill: 0xffffff, fontWeight: "bold" } });
    count.anchor.set(0.5);
    count.x = RAIL_CX + 16; // 426
    count.y = y + 16;
    root.addChild(count);
    boosterTexts.set(b.id, count);
  });

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
      root.destroy({ children: true });
    },
  };
}
