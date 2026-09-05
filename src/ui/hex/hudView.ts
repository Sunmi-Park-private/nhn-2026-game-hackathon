// ui/hex/hudView.ts — 상단 스테이지·목표 카운터, 우측 NEXT·부스터.
import { Container, Graphics, Text, type Texture } from "pixi.js";

import { slot, type UiSlot } from "../../data/uiLayout";
import { fitSprite } from "../skin";
import { editable, clearEditable } from "../layoutEditor";
import { makeTileView } from "./tileArt";
import { HEX_SIZE } from "./geom";
import type { RunState } from "../../engine/hex/types";

/** HUD가 쓰는 아트. 없으면 코드가 그린 판으로 대신한다. */
export interface HudTextures {
  stageBar?: Texture;
  /** 색 순서대로 놓인 타일 아트. NEXT 칩이 판의 타일과 같은 그림이라야 읽힌다. */
  tiles?: Array<Texture | null>;
}

/** NEXT 칩의 목표 가로폭. 슬롯(폭 56) 안에서 답답하지 않은 크기다. */
const NEXT_CHIP_W = 34;

export interface HudView {
  root: Container;
  sync(state: RunState): void;
  /** 다음 줄이 내려올 때까지 남은 초. UI가 타이머를 소유하므로 밖에서 넣어 준다. */
  setCountdown(seconds: number): void;
  destroy(): void;
}

function panel(w: number, h: number): Graphics {
  return new Graphics().roundRect(0, 0, w, h, 10).fill({ color: 0x4a3320, alpha: 0.9 });
}

/** 인게임 슬롯 하나. 에디터가 고친 값이 없으면 기본 배치로 간다. */
/**
 * 슬롯을 **복사하지 않고** 그대로 돌려준다.
 *
 * 복사본을 넘기면 에디터가 그 복사본을 고치고, 저장은 원본 목록(uiAreas)을
 * 올리므로 **아무것도 남지 않는다.** 배율을 아무리 만져도 새로고침하면 되돌아갔다.
 */
function box(id: string, fx: number, fy: number, fw: number, fh: number): UiSlot {
  return slot("ingame", id) ?? { id, label: id, x: fx, y: fy, w: fw, h: fh };
}

/** HUD 조각 하나를 인게임 에디터에 등록한다. 조각들이 컨테이너 없이 root에 흩어져 있으므로
 *  슬롯마다 얇은 컨테이너로 묶어 준다 — 그래야 통째로 끌어 옮길 수 있다. */
function groupFor(root: Container, b: UiSlot, ...nodes: Container[]): Container {
  const g = new Container();
  for (const n of nodes) g.addChild(n);
  root.addChild(g);
  editable("ingame", b, g);
  return g;
}

/** 상자 한가운데에 놓는 글자. 슬롯이 크기·색을 들고 있으면 그 값을 쓴다. */
function centered(
  b: { x: number; y: number; w: number; h: number; fontSize?: number; color?: string },
  text: string,
  size: number,
  color: number,
): Text {
  const t = new Text({
    text,
    style: {
      fontSize: b.fontSize ?? size,
      fill: b.color ?? color,
      fontWeight: "bold",
      // 나뭇결 위에서도 읽히게 — 판이 아트로 바뀌어도 대비가 유지된다
      stroke: { color: 0x2a1a0c, width: 3 },
    },
  });
  t.anchor.set(0.5);
  t.x = b.x + b.w / 2;
  t.y = b.y + b.h / 2;
  return t;
}

export function createHudView(stageIndex: number, tex: HudTextures = {}): HudView {
  const root = new Container();

  // 배치는 data/uiLayout.json이 들고 있다 — /ui.html 에디터의 「인게임」 탭에서 조정한다.
  // 여기 하드코딩된 숫자는 슬롯이 지워졌을 때만 쓰이는 기본값이다.
  //
  // 스테이지 바는 아트 한 장이 판을 그리고 코드는 글자만 얹는다. 이름과 카운터는
  // 각자 슬롯이라 아트의 나무 자리·어두운 홈에 맞춰 따로 끌어 옮긴다.
  const bar = box("stageBar", 115, 28, 220, 41);
  let plate: Container;
  if (tex.stageBar) {
    const spr = fitSprite(tex.stageBar, bar.w, bar.h);
    spr.x = bar.x + bar.w / 2;
    spr.y = bar.y + bar.h / 2;
    plate = spr;
  } else {
    const top = panel(bar.w, bar.h);
    top.x = bar.x;
    top.y = bar.y;
    plate = top;
  }
  groupFor(root, bar, plate);

  const titleBox = box("stageTitle", bar.x + 16, bar.y + 10, 96, 22);
  const title = centered(titleBox, `STAGE ${stageIndex + 1}`, 15, 0xffffff);
  groupFor(root, titleBox, title);

  const counterBox = box("stageCounter", bar.x + 132, bar.y + 10, 70, 22);
  const counter = centered(counterBox, "0/0", 15, 0xffd76a);
  groupFor(root, counterBox, counter);

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

      if (state.next !== lastNextTier) {
        nextSlot.removeChildren().forEach((c) => c.destroy());
        // 칩 크기는 격자가 아니라 **NEXT 판**이 정한다. 판을 우리 안으로 줄이면서
        // 육각 반지름이 23% 작아졌는데, 그걸 그대로 쓰면 칩만 덩그러니 작아 보인다.
        //
        // 배율은 **감싼 컨테이너에** 건다. makeTileView가 스프라이트에 이미
        // fitContain 배율을 넣어 두므로, 스프라이트에 직접 scale.set을 하면
        // 그 값을 덮어써서 원본 크기(409px)가 그대로 나온다.
        const chip = new Container();
        chip.addChild(makeTileView(state.next, tex.tiles?.[state.next] ?? null));
        chip.scale.set(NEXT_CHIP_W / (Math.sqrt(3) * HEX_SIZE));
        nextSlot.addChild(chip);
        lastNextTier = state.next;
      }

      for (const [id, text] of boosterTexts) {
        text.text = String(state.boosters[id as "bomb" | "rainbow" | "horseshoe"]);
      }
    },

    setCountdown(seconds: number): void {
      // 발사 제한이 사라진 자리에 이게 들어간다 — 압박의 근원이 바뀌었으니 표시도 바뀐다.
      shots.text = `다음 줄 ${Math.max(0, Math.ceil(seconds))}초`;
    },

    destroy(): void {
      clearEditable("ingame");
      root.destroy({ children: true });
    },
  };
}
