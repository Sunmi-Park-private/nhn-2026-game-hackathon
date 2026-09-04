// ui/worldScreen.ts — 월드 지도. 로비 하단 WORLD로 들어온다.
//
// 화면 전체를 배경 아트 한 장이 그린다. **누를 수 있는 것은 둘뿐이다** —
// 우상단 설정(톱니)과 좌하단 돌아가기. 스테이지 노드·표지판·동물은 전부 그림이다.
//
// 뒤 화면(로비)으로 터치가 새지 않게 막을 통째로 깐다. 막이 없으면 지도 위를
// 눌렀을 때 아래에 있는 PLAY나 하단 내비가 눌린다.
import { Container, Graphics, Text, type Texture } from "pixi.js";
import { BASE_W, stageTop, stageHeight, stageLeft, stageWidth, coverBox, fullRect } from "./stage";
import { fitSprite } from "./skin";
import { slot, type UiSlot } from "../data/uiLayout";
import { buzz } from "./settings";
import { playSfx } from "./audio";
import { openSettings, type SettingsTextures } from "./settingsMenu";
import { editable, clearEditable } from "./layoutEditor";

const AREA = "world";

export interface WorldTextures {
  bg?: Texture;
  back?: Texture;
  gear?: Texture;
  ui: SettingsTextures;
}

/** 월드가 닫히면서 호출자에게 넘기는 결정. lobby는 설정창의 HOME으로 나간 경우다. */
export type WorldResult = "back" | "lobby";

function box(id: string, fallback: { x: number; y: number; w: number; h: number }): UiSlot {
  return slot(AREA, id) ?? { id, label: id, ...fallback };
}

/** 누를 수 있는 자리. 아트가 있으면 그걸 그리고, 없으면 이름이 보이는 폴백을 그린다. */
function hotspot(b: UiSlot, tex: Texture | undefined, onTap: () => void, fill: number): Container {
  const c = new Container();
  c.x = b.x;
  c.y = b.y;

  if (tex) {
    const s = fitSprite(tex, b.w, b.h);
    s.x = b.w / 2;
    s.y = b.h / 2;
    c.addChild(s);
  } else {
    const g = new Graphics().roundRect(0, 0, b.w, b.h, 10).fill({ color: fill });
    g.roundRect(2, 2, b.w - 4, b.h - 4, 8).stroke({ width: 2, color: 0xffffff, alpha: 0.18 });
    c.addChild(g);
    const t = new Text({
      text: b.label,
      style: { fontSize: Math.min(15, b.h * 0.32), fill: 0xfff3dc, fontWeight: "bold" },
    });
    t.anchor.set(0.5);
    t.x = b.w / 2;
    t.y = b.h / 2;
    c.addChild(t);
  }
  // 투명이어도 히트 판정을 받으려면 실제로 채워야 한다(alpha 0)
  c.addChild(new Graphics().rect(0, 0, b.w, b.h).fill({ color: 0xffffff, alpha: 0 }));

  editable(AREA, b, c);
  c.eventMode = "static";
  c.cursor = "pointer";
  c.on("pointertap", () => { buzz(); playSfx("audio.sfxTap"); onTap(); });
  c.on("pointerdown", () => { c.alpha = 0.78; });
  const up = (): void => { c.alpha = 1; };
  c.on("pointerup", up);
  c.on("pointerupoutside", up);
  return c;
}

/** 월드 지도를 띄우고 닫힐 때까지 기다린다. */
export function openWorld(parent: Container, tex: WorldTextures): Promise<WorldResult> {
  return new Promise<WorldResult>((resolve) => {
    const root = new Container();
    parent.addChild(root);

    // 막 — 캔버스 전체를 먹어 뒤 화면으로 터치가 새지 않게 한다.
    // 지도 위 어디를 눌러도 아무 일이 없어야 하므로 탭 핸들러를 달지 않는다.
    const veil = new Graphics()
      .rect(stageLeft(), stageTop(), stageWidth(), stageHeight())
      .fill({ color: 0x120c06, alpha: 1 });
    veil.eventMode = "static";
    root.addChild(veil);

    root.addChild(fullRect(0x241a10)); // 배경 아트가 없어도 캔버스가 비지 않게
    if (tex.bg) root.addChild(coverBox(tex.bg));
    root.addChild(
      new Graphics()
        .rect(0.5, stageTop() + 0.5, BASE_W - 1, stageHeight() - 1)
        .stroke({ width: 2, color: 0xc98a3c, alignment: 0 }),
    );

    let done = false;
    const finish = (r: WorldResult): void => {
      if (done) return;
      done = true;
      clearEditable(AREA);
      root.destroy({ children: true });
      resolve(r);
    };

    const back = box("back", { x: 17, y: 740, w: 126, h: 35 });
    root.addChild(hotspot(back, tex.back, () => finish("back"), 0x6b4626));

    // 설정은 로비·인게임과 같은 자리다 — 화면이 바뀌어도 톱니가 움직이지 않아야 한다
    const gear = box("gear", { x: 400, y: 10, w: 40, h: 40 });
    root.addChild(hotspot(gear, tex.gear, () => {
      void openSettings(root, tex.ui).then((r) => { if (r === "lobby") finish("lobby"); });
    }, 0x4a3320));
  });
}
