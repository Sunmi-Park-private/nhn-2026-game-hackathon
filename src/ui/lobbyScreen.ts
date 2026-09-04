// ui/lobbyScreen.ts — 로비. 시안의 배치를 그대로 따른다.
//
// 상단 재화 바 · 우측 레일 4종(전부 목업) · 중앙 PLAY · 하단 4종(HOME·ANIMALS만 동작)
// · 좌우에 구출한 동물 친구(스테이지를 깰수록 늘어난다).
// 배치는 data/uiLayout.json이 들고 있고 /ui.html 에디터로 조정한다.
//
// 배경 아트가 오면 버튼 모양은 아트가 그린다 — 그때 이 코드는 히트 영역만 얹는다.
// 아트가 없으면 자리와 이름이 보이도록 폴백을 그린다.
import { Application, Container, Graphics, Text, type Texture } from "pixi.js";
import { BASE_W, stageTop, stageHeight, coverBox, fullRect } from "./stage";
import { fitSprite } from "./skin";
import { openSettings, type SettingsTextures } from "./settingsMenu";
import { openCollection, type CollectionTextures } from "./collection";
import { openWorld } from "./worldScreen";
import { openEvent, type EventTextures } from "./eventScreen";
import { slot, type UiSlot } from "../data/uiLayout";
import { ANIMALS } from "../data/animals";
import { buzz } from "./settings";
import { playBgm, playSfx } from "./audio";
import { editable, clearEditable } from "./layoutEditor";
import type { Profile } from "../engine/profile";

export interface LobbyTextures {
  bg?: Texture;
  play?: Texture;
  gear?: Texture;
  /** 우측 레일·하단 내비 아이콘 — 없으면 라벨로 대신한다 */
  icons: Record<string, Texture | null>;
  /** 로비에 서는 구출한 동물 — 아직 안 올라온 동물은 키가 없다 */
  friends: Partial<Record<string, Texture>>;
  /** 도감 — 패널과 동물마다 해제·잠김 카드 */
  collection: CollectionTextures;
  /** 월드 지도 화면 */
  world: { bg?: Texture; back?: Texture };
  /** 이벤트 화면 */
  event: EventTextures;
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
    c.on("pointertap", () => { buzz(); playSfx("audio.sfxTap"); onTap(); });
    c.on("pointerdown", () => { c.alpha = 0.78; });
    const up = (): void => { c.alpha = 1; };
    c.on("pointerup", up);
    c.on("pointerupoutside", up);
  }
  return c;
}

/** 아트 위에 얹는 숫자 하나. 칸의 배경은 아트가 그리므로 여기서는 글자만 그린다.
 *  글자 크기·색은 슬롯이 들고 있으면 그 값을 쓴다(에디터에서 조정). */
function counter(b: UiSlot, value: number): Container {
  const c = new Container();
  c.x = b.x;
  c.y = b.y;
  const t = new Text({
    text: String(value),
    style: {
      fontSize: b.fontSize ?? 15,
      fill: b.color ?? 0xfff3dc,
      fontWeight: "bold",
      // 아트의 밝은 부분 위에서도 읽히게 — 아트가 아직 없을 때도 배경과 구분된다
      stroke: { color: 0x1a1108, width: 3 },
    },
  });
  t.anchor.set(0.5);
  t.x = b.w / 2;
  t.y = b.h / 2;
  c.addChild(t);
  editable(AREA, b, c);
  return c;
}

/** 슬롯 id는 동물 id에서 만든다 — friendRabbit, friendSheep … 도감의 cellXxx와 같은 규칙이다. */
const friendId = (animalId: string): string => `friend${animalId[0]!.toUpperCase()}${animalId.slice(1)}`;

/** 로비 좌우에 서는 동물 한 마리. 구출한 동물만 부른다.
 *  아트가 있으면 그림만 그리고, 없으면 자리와 정체가 보이도록 글리프를 그린다 —
 *  배경 아트가 이미 그 동물을 그리고 있다면 슬롯을 hidden으로 끄면 된다. */
function friend(b: UiSlot, tex: Texture | null, glyph: string): Container {
  const c = new Container();
  c.x = b.x;
  c.y = b.y;

  if (tex) {
    const s = fitSprite(tex, b.w, b.h);
    s.x = b.w / 2;
    s.y = b.h / 2;
    c.addChild(s);
  } else {
    const g = new Graphics().circle(b.w / 2, b.h / 2, Math.min(b.w, b.h) / 2).fill({ color: 0xf3e2c0, alpha: 0.85 });
    g.circle(b.w / 2, b.h / 2, Math.min(b.w, b.h) / 2).stroke({ width: 2, color: 0x8a5a2b });
    c.addChild(g);
    const t = new Text({ text: glyph, style: { fontSize: Math.min(b.w, b.h) * 0.5 } });
    t.anchor.set(0.5);
    t.x = b.w / 2;
    t.y = b.h / 2;
    c.addChild(t);
  }

  editable(AREA, b, c);
  return c;
}

/** 로비를 띄우고 PLAY를 누를 때까지 기다린다. */
export function runLobby(app: Application, profile: Profile, tex: LobbyTextures): Promise<void> {
  return new Promise<void>((resolve) => {
    const layer = new Container();
    app.stage.addChild(layer);
    playBgm("audio.bgmLobby");

    layer.addChild(fullRect(0x241a10));
    if (tex.bg) layer.addChild(coverBox(tex.bg));
    layer.addChild(
      new Graphics()
        .rect(0.5, stageTop() + 0.5, BASE_W - 1, stageHeight() - 1)
        .stroke({ width: 2, color: 0xc98a3c, alignment: 0 }),
    );

    // ── 상단 재화 바 ─────────────────────────────
    // 세 칸을 아트 한 장(투명 png)이 그린다. 코드가 얹는 것은 숫자뿐이다.
    // 숫자마다 슬롯이 따로 있어 에디터에서 각자 끌어 맞춘다 — 아트의 칸 간격이
    // 바뀌어도 코드는 그대로고 uiLayout.json만 움직인다.
    const stats = box("topStats", { x: 14, y: 6, w: 340, h: 113 });
    layer.addChild(hotspot(stats, tex.icons.topStats, null));

    // 코인·젬은 아직 재화 시스템이 없어 0으로 둔다 — 말굽만 실제 값이다
    const counters: Array<[string, { x: number; y: number; w: number; h: number }, number]> = [
      ["statCoin", { x: 67, y: 50, w: 60, h: 22 }, 0],
      ["statGem", { x: 178, y: 50, w: 60, h: 22 }, 0],
      ["statHorseshoe", { x: 285, y: 50, w: 60, h: 22 }, profile.horseshoes],
    ];
    for (const [id, fb, value] of counters) layer.addChild(counter(box(id, fb), value));

    // ── 구출한 동물 친구 ─────────────────────────
    // 스테이지를 깨서 구출한 동물만 좌우에 선다 — 로비가 진행도를 보여주는 자리다.
    // 자리가 없는(슬롯이 지워진) 동물은 그리지 않는다: 좌표를 코드가 지어내면
    // 배경 아트 위 아무 데나 서게 된다.
    for (const a of ANIMALS) {
      if (!profile.rescued.includes(a.id)) continue;
      const b = slot(AREA, friendId(a.id));
      if (!b || b.hidden) continue;
      layer.addChild(friend(b, tex.friends[a.id] ?? null, a.glyph));
    }

    // ── PLAY ────────────────────────────────────
    const play = box("play", { x: 138, y: 646, w: 174, h: 54 });
    layer.addChild(hotspot(play, tex.play, () => finish(), 0x3faa48));

    // ── 하단 4종 — HOME·WORLD·ANIMALS 동작, EVENTS는 목업 ─────
    const home = box("navHome", { x: 18, y: 738, w: 96, h: 50 });
    layer.addChild(hotspot(home, tex.icons.navHome, () => { /* 이미 홈이다 */ }));

    const world = box("navWorld", { x: 122, y: 738, w: 96, h: 50 });
    layer.addChild(hotspot(world, tex.icons.navWorld, () => {
      void openWorld(layer, { ...tex.world, gear: tex.gear, ui: tex.ui }).then((r) => {
        if (r === "lobby") { /* 이미 로비다 — 월드만 닫힌다 */ }
      });
    }));

    const animals = box("navAnimals", { x: 226, y: 738, w: 96, h: 50 });
    layer.addChild(hotspot(animals, tex.icons.navAnimals, () => {
      void openCollection(layer, profile.rescued, tex.collection);
    }));

    const events = box("navEvents", { x: 330, y: 738, w: 96, h: 50 });
    layer.addChild(hotspot(events, tex.icons.navEvents, () => {
      // 스테이지로 가는 길은 아직 하나뿐이라 어느 쪽으로 닫히든 로비로 돌아온다
      void openEvent(layer, tex.event);
    }));

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
