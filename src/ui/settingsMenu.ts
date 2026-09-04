// ui/settingsMenu.ts — 설정창. 시안대로 SOUND · MUSIC · VIBRATION 토글과 RESUME · HOME.
//
// 열려 있는 동안 뒤 화면의 입력을 막는다 — 반투명 막이 히트 영역을 통째로 먹는다.
// 그러지 않으면 메뉴를 누르려다 뒤에서 발사가 나간다.
//
// 배치는 data/uiLayout.json이 들고 있다. 아트가 도착하면 패널 한 장이 배경이 되고
// 이 코드는 그 위에 히트 영역만 얹는다 — 시안의 나무 패널이 그대로 보인다.
import { Container, Graphics, Text, type Texture } from "pixi.js";
import { stageTop, stageHeight, stageLeft, stageWidth } from "./stage";
import { fitSprite } from "./skin";
import { slot } from "../data/uiLayout";
import { settings, toggle, buzz, type Settings } from "./settings";
import { playSfx } from "./audio";
import { editable, clearEditable } from "./layoutEditor";

export interface SettingsTextures {
  panel?: Texture;
  close?: Texture;
  /** 켜짐/꺼짐 말굽 아이콘 */
  toggleOn?: Texture;
  toggleOff?: Texture;
  resume?: Texture;
  home?: Texture;
}

/** 설정창이 닫히면서 호출자에게 넘기는 결정. */
export type SettingsResult = "resume" | "lobby";

const AREA = "settings";
const FALLBACK = {
  panel: { x: 60, y: 170, w: 330, h: 440 },
  close: { x: 356, y: 158, w: 52, h: 52 },
  rowSound: { x: 84, y: 283, w: 282, h: 56 },
  rowMusic: { x: 84, y: 338, w: 282, h: 56 },
  rowVibration: { x: 84, y: 394, w: 282, h: 56 },
  toggleSound: { x: 279, y: 289, w: 44, h: 44 },
  toggleMusic: { x: 279, y: 344, w: 44, h: 44 },
  toggleVibration: { x: 279, y: 400, w: 44, h: 44 },
  resume: { x: 92, y: 462, w: 266, h: 56 },
  home: { x: 130, y: 530, w: 190, h: 44 },
} as const;

function box(id: keyof typeof FALLBACK): { x: number; y: number; w: number; h: number; id: string; label: string } {
  const s = slot(AREA, id);
  return s ? { ...s } : { ...FALLBACK[id], id, label: id };
}

/** 누를 수 있는 영역. 아트가 있으면 그 위에 투명하게 얹고, 없으면 형태를 그려 준다. */
function hotspot(
  b: { x: number; y: number; w: number; h: number; id?: string; label?: string },
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
  if (b.id) editable(AREA, { id: b.id, label: b.label ?? b.id, x: b.x, y: b.y, w: b.w, h: b.h }, c);
  c.eventMode = "static";
  c.cursor = "pointer";
  c.on("pointertap", () => { buzz(); playSfx("audio.sfxTap"); onTap(); });
  c.on("pointerdown", () => { c.alpha = 0.75; });
  const up = (): void => { c.alpha = 1; };
  c.on("pointerup", up);
  c.on("pointerupoutside", up);
  return c;
}

function label(text: string, size: number, x: number, y: number): Text {
  const t = new Text({ text, style: { fontSize: size, fill: 0xfff3dc, fontWeight: "bold" } });
  t.anchor.set(0, 0.5);
  t.x = x;
  t.y = y;
  return t;
}

/**
 * 설정창을 띄우고 닫힐 때까지 기다린다.
 * 부모에 붙였다가 스스로 걷어내므로 호출자는 결과만 받으면 된다.
 */
export function openSettings(parent: Container, tex: SettingsTextures): Promise<SettingsResult> {
  return new Promise<SettingsResult>((resolve) => {
    const root = new Container();
    parent.addChild(root);

    // 막 — 캔버스 전체를 덮어야 좌우 패널로도 입력이 새지 않는다
    const veil = new Graphics()
      .rect(stageLeft(), stageTop(), stageWidth(), stageHeight())
      .fill({ color: 0x120c06, alpha: 0.72 });
    veil.eventMode = "static";
    root.addChild(veil);

    const p = box("panel");
    if (tex.panel) {
      const s = fitSprite(tex.panel, p.w, p.h);
      s.x = p.x + p.w / 2;
      s.y = p.y + p.h / 2;
      root.addChild(s);
    } else {
      const g = new Graphics();
      g.roundRect(p.x, p.y, p.w, p.h, 16).fill({ color: 0x6b4626 });
      g.roundRect(p.x + 6, p.y + 6, p.w - 12, p.h - 12, 12).stroke({ width: 3, color: 0x3d2513 });
      root.addChild(g);
      const title = new Text({ text: "SETTINGS", style: { fontSize: 22, fill: 0xfff3dc, fontWeight: "bold" } });
      title.anchor.set(0.5);
      title.x = p.x + p.w / 2;
      title.y = p.y + 26;
      root.addChild(title);
    }

    let done = false;
    const finish = (r: SettingsResult): void => {
      if (done) return;
      done = true;
      clearEditable(AREA);
      root.destroy({ children: true });
      resolve(r);
    };

    // ── 토글 3종 ────────────────────────────────
    // 말굽 아이콘은 줄과 별개의 슬롯이다 — 패널 아트마다 말굽 자리가 다르므로
    // 줄 폭에서 역산하지 않고 에디터에서 직접 끌어 맞춘다.
    const rows: Array<{
      key: keyof Settings;
      id: "rowSound" | "rowMusic" | "rowVibration";
      knob: "toggleSound" | "toggleMusic" | "toggleVibration";
      text: string;
    }> = [
      { key: "sound", id: "rowSound", knob: "toggleSound", text: "SOUND" },
      { key: "music", id: "rowMusic", knob: "toggleMusic", text: "MUSIC" },
      { key: "vibration", id: "rowVibration", knob: "toggleVibration", text: "VIBRATION" },
    ];
    for (const row of rows) {
      const b = box(row.id);
      const k = box(row.knob);

      // 아트가 없을 때만 줄 배경을 그린다 — 있으면 패널 아트가 이미 그리고 있다
      if (!tex.panel) {
        root.addChild(new Graphics().roundRect(b.x, b.y, b.w, b.h, 8).fill({ color: 0x53341c }));
        root.addChild(label(row.text, 15, b.x + 16, b.y + b.h / 2));
      }

      const mark = new Container();
      mark.x = k.x + k.w / 2;
      mark.y = k.y + k.h / 2;
      root.addChild(mark);
      // 그림은 상태가 바뀔 때마다 갈아 끼우고, 히트 영역은 그대로 둔다.
      // 한 컨테이너에 섞으면 갈아 끼울 때 히트 영역까지 함께 지워진다.
      const icon = new Container();
      mark.addChild(icon);
      mark.addChild(new Graphics().rect(-k.w / 2, -k.h / 2, k.w, k.h).fill({ color: 0xffffff, alpha: 0 }));

      const paint = (on: boolean): void => {
        icon.removeChildren().forEach((c) => c.destroy());
        const t = on ? tex.toggleOn : tex.toggleOff;
        if (t) {
          icon.addChild(fitSprite(t, k.w, k.h));
          return;
        }
        // 폴백 — 켜짐은 금빛 말굽, 꺼짐은 회색
        const glyph = new Text({
          text: "U",
          style: { fontSize: k.h * 0.6, fill: on ? 0xf5c518 : 0x8a8f96, fontWeight: "bold" },
        });
        glyph.anchor.set(0.5);
        icon.addChild(glyph);
      };
      paint(settings()[row.key]);

      // 줄 어디를 눌러도 바뀌고, 말굽 자체도 버튼이다.
      // 말굽의 히트 영역을 mark 안에 두어야 에디터에서 말굽을 줄 밖으로 옮겨도
      // 같이 따라간다 — 별도 노드로 두면 그림만 움직이고 누를 자리는 제자리에 남는다.
      const flip = (): void => paint(toggle(row.key));
      root.addChild(hotspot(b, flip));
      mark.eventMode = "static";
      mark.cursor = "pointer";
      mark.on("pointertap", () => { buzz(); playSfx("audio.sfxTap"); flip(); });
      editable(AREA, { id: k.id, label: k.label, x: k.x, y: k.y, w: k.w, h: k.h }, mark);
    }

    // ── RESUME · HOME · 닫기 ─────────────────────
    const r = box("resume");
    if (tex.resume) {
      const s = fitSprite(tex.resume, r.w, r.h);
      s.x = r.x + r.w / 2;
      s.y = r.y + r.h / 2;
      root.addChild(s);
    } else {
      root.addChild(new Graphics().roundRect(r.x, r.y, r.w, r.h, 10).fill({ color: 0x3faa48 }));
      const t = new Text({ text: "▶ RESUME", style: { fontSize: 20, fill: 0xffffff, fontWeight: "bold" } });
      t.anchor.set(0.5);
      t.x = r.x + r.w / 2;
      t.y = r.y + r.h / 2;
      root.addChild(t);
    }
    root.addChild(hotspot(r, () => finish("resume")));

    const h = box("home");
    if (tex.home) {
      const s = fitSprite(tex.home, h.w, h.h);
      s.x = h.x + h.w / 2;
      s.y = h.y + h.h / 2;
      root.addChild(s);
    } else {
      root.addChild(new Graphics().roundRect(h.x, h.y, h.w, h.h, 8).fill({ color: 0x53341c }));
      const t = new Text({ text: "⌂ HOME", style: { fontSize: 16, fill: 0xfff3dc, fontWeight: "bold" } });
      t.anchor.set(0.5);
      t.x = h.x + h.w / 2;
      t.y = h.y + h.h / 2;
      root.addChild(t);
    }
    root.addChild(hotspot(h, () => finish("lobby")));

    const c = box("close");
    if (tex.close) {
      const s = fitSprite(tex.close, c.w, c.h);
      s.x = c.x + c.w / 2;
      s.y = c.y + c.h / 2;
      root.addChild(s);
    } else {
      const g = new Graphics().circle(c.x + c.w / 2, c.y + c.h / 2, c.w / 2).fill({ color: 0xd23b30 });
      g.stroke({ width: 3, color: 0x8f9bab });
      root.addChild(g);
      const t = new Text({ text: "✕", style: { fontSize: 22, fill: 0xffffff, fontWeight: "bold" } });
      t.anchor.set(0.5);
      t.x = c.x + c.w / 2;
      t.y = c.y + c.h / 2;
      root.addChild(t);
    }
    root.addChild(hotspot(c, () => finish("resume")));

    veil.on("pointertap", () => finish("resume"));
  });
}
