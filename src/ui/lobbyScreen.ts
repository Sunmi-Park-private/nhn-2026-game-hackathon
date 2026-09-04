// ui/lobbyScreen.ts — 로비. 시안의 배치를 그대로 따른다.
//
// 상단 재화 바 · 우측 레일 4종(전부 목업) · 중앙 PLAY · 하단 4종(HOME·ANIMALS만 동작).
// 배치는 data/uiLayout.json이 들고 있고 /ui.html 에디터로 조정한다.
//
// 배경 아트가 오면 버튼 모양은 아트가 그린다 — 그때 이 코드는 히트 영역만 얹는다.
// 아트가 없으면 자리와 이름이 보이도록 폴백을 그린다.
import { Application, Container, Graphics, Text, type Texture } from "pixi.js";
import { BASE_W, stageTop, stageHeight, coverBox, fullRect } from "./stage";
import { fitSprite } from "./skin";
import { openSettings, type SettingsTextures } from "./settingsMenu";
import { openCollection } from "./collection";
import { slot, type UiSlot } from "../data/uiLayout";
import { buzz } from "./settings";
import { editable, clearEditable } from "./layoutEditor";
import type { Profile } from "../engine/profile";

export interface LobbyTextures {
  bg?: Texture;
  play?: Texture;
  gear?: Texture;
  /** 우측 레일·하단 내비 아이콘 — 없으면 라벨로 대신한다 */
  icons: Record<string, Texture | null>;
  /** 도감에 쓰는 동물 아트 — 시퀀스 */
  animals: Record<string, readonly Texture[]>;
  ui: SettingsTextures;
}

const AREA = "lobby";

function box(id: string, fallback: { x: number; y: number; w: number; h: number }): UiSlot {
  return slot(AREA, id) ?? { id, label: id, ...fallback };
}

/** 누를 수 있는 자리.
 *
 *  **슬롯마다 따로 판단한다** — 그 슬롯의 아트가 있으면 그걸 그리고, 없으면 형태와 이름을
 *  그려 준다. 한때 「배경 아트가 있으면 버튼은 배경이 그린 것」으로 가정했는데,
 *  버튼이 그려져 있지 않은 배경이 올라오자 버튼이 통째로 안 보였다.
 *  배경이 이미 버튼을 그리고 있다면 그 슬롯에 같은 그림을 올리면 된다. */
function hotspot(
  b: UiSlot,
  tex: Texture | null | undefined,
  onTap: (() => void) | null,
  fill = 0x6b4626,
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
    const g = new Graphics().roundRect(0, 0, b.w, b.h, 8).fill({ color: fill, alpha: onTap ? 1 : 0.55 });
    g.roundRect(2, 2, b.w - 4, b.h - 4, 6).stroke({ width: 2, color: 0xffffff, alpha: 0.18 });
    c.addChild(g);
    const t = new Text({
      text: b.label,
      style: { fontSize: Math.min(12, b.h * 0.28), fill: onTap ? 0xfff3dc : 0xa8987c, fontWeight: "bold" },
    });
    t.anchor.set(0.5);
    t.x = b.w / 2;
    t.y = b.h / 2;
    c.addChild(t);
  }

  // 투명이어도 히트 판정을 받으려면 실제로 채워야 한다(alpha 0)
  c.addChild(new Graphics().rect(0, 0, b.w, b.h).fill({ color: 0xffffff, alpha: 0 }));

  editable(AREA, b, c); // 인게임 레이아웃 에디터가 이 노드를 잡는다
  if (onTap) {
    c.eventMode = "static";
    c.cursor = "pointer";
    c.on("pointertap", () => { buzz(); onTap(); });
    c.on("pointerdown", () => { c.alpha = 0.78; });
    const up = (): void => { c.alpha = 1; };
    c.on("pointerup", up);
    c.on("pointerupoutside", up);
  }
  return c;
}

/** 로비를 띄우고 PLAY를 누를 때까지 기다린다. */
export function runLobby(app: Application, profile: Profile, tex: LobbyTextures): Promise<void> {
  return new Promise<void>((resolve) => {
    const layer = new Container();
    app.stage.addChild(layer);

    layer.addChild(fullRect(0x241a10));
    if (tex.bg) layer.addChild(coverBox(tex.bg));
    layer.addChild(
      new Graphics()
        .rect(0.5, stageTop() + 0.5, BASE_W - 1, stageHeight() - 1)
        .stroke({ width: 2, color: 0xc98a3c, alignment: 0 }),
    );

    // ── 상단 재화 바 ─────────────────────────────
    const stats = box("topStats", { x: 30, y: 12, w: 300, h: 34 });
    layer.addChild(new Graphics().roundRect(stats.x, stats.y, stats.w, stats.h, 17).fill({ color: 0x2b1d10, alpha: 0.85 }));
    const statText = new Text({
      // 코인·젬은 아직 재화 시스템이 없어 0으로 둔다 — 말굽만 실제 값이다
      text: `🪙 0    💎 0    🐴 ${profile.horseshoes}`,
      style: { fontSize: 14, fill: 0xfff3dc, fontWeight: "bold" },
    });
    statText.anchor.set(0.5);
    statText.x = stats.x + stats.w / 2;
    statText.y = stats.y + stats.h / 2;
    layer.addChild(statText);

    // ── PLAY ────────────────────────────────────
    const play = box("play", { x: 138, y: 646, w: 174, h: 54 });
    layer.addChild(hotspot(play, tex.play, () => finish(), 0x3faa48));

    // ── 하단 4종 — HOME·ANIMALS만 동작 ─────────────
    const home = box("navHome", { x: 18, y: 738, w: 96, h: 50 });
    layer.addChild(hotspot(home, tex.icons.navHome, () => { /* 이미 홈이다 */ }));

    const animals = box("navAnimals", { x: 122, y: 738, w: 96, h: 50 });
    layer.addChild(hotspot(animals, tex.icons.navAnimals, () => {
      void openCollection(layer, profile.rescued, tex.animals);
    }));

    for (const [id, fb] of [
      ["navEvents", { x: 226, y: 738, w: 96, h: 50 }],
      ["navSoon", { x: 330, y: 738, w: 96, h: 50 }],
    ] as const) {
      const b = box(id, fb);
      layer.addChild(hotspot(b, tex.icons[id], null));
    }

    // ── 설정 ────────────────────────────────────
    const gear = box("gear", { x: 396, y: 12, w: 40, h: 40 });
    layer.addChild(hotspot(gear, tex.gear, () => { void openSettings(layer, tex.ui); }, 0x4a3320));

    let done = false;
    function finish(): void {
      if (done) return;
      done = true;
      clearEditable(AREA); // 파괴된 노드를 에디터가 계속 잡고 있으면 안 된다
      layer.destroy({ children: true });
      resolve();
    }
  });
}
