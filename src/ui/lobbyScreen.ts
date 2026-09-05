// ui/lobbyScreen.ts — 로비. 시안의 배치를 그대로 따른다.
//
// 상단 재화 바 · 우측 레일 4종(전부 목업) · 중앙 PLAY · 하단 4종(HOME·ANIMALS만 동작)
// · 좌우에 구출한 동물 친구(스테이지를 깰수록 늘어난다).
// 배치는 data/uiLayout.json이 들고 있고 /ui.html 에디터로 조정한다.
//
// 배경 아트가 오면 버튼 모양은 아트가 그린다 — 그때 이 코드는 히트 영역만 얹는다.
// 아트가 없으면 자리와 이름이 보이도록 폴백을 그린다.
import { Application, Container, Graphics, Rectangle, Text, type Texture } from "pixi.js";
import { BASE_W, stageTop, stageHeight, coverBox, contentRect } from "./stage";
import { slotHitRect } from "./slotHitRect";
import { fitSprite, loadTexture, playVideoTexture, VIDEO_LOAD_TIMEOUT_MS } from "./skin";
import { openSettings, type SettingsTextures } from "./settingsMenu";
import { openCollection, type CollectionTextures } from "./collection";
import { openRace, type RaceTextures } from "./race/raceScreen";
import { openEvent, type EventTextures } from "./eventScreen";
import { slot, type UiSlot } from "../data/uiLayout";
import { sceneCandidates } from "../data/lobbyScene";
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
  /** 로비 배경 영상 경로 — 마릿수마다 한 편. 아직 안 올라온 자리는 키가 없다.
   *  텍스처가 아니라 **경로**를 받는다: 용량이 커서 부팅 때 받으면 첫 화면이 늦고,
   *  실제로 쓰는 것은 한 편뿐이라 로비가 그때 받는 편이 싸다. */
  scenes: Partial<Record<string, string>>;
  /** 도감 — 패널과 동물마다 해제·잠김 카드 */
  collection: CollectionTextures;
  /** 동물 운동회 화면 */
  race: RaceTextures;
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

  // 슬롯의 `scale`은 **아트**를 슬롯 상자보다 크게 그리라는 디자이너의 지시다
  // (하단 내비 4종이 전부 2다 — 아트에 투명 여백이 있어 그래야 크기가 맞는다).
  // 그런데 applyStyle이 컨테이너째 키우므로 **아트가 없을 때는** 꽉 찬 폴백 사각형과
  // 히트 영역까지 같이 커진다. 실제로 RACE 자리표시가 HOME을 덮고 탭까지 가로챘다.
  // 아트가 없는 슬롯은 배율을 되돌려 **자기 슬롯 크기 그대로** 서게 한다 —
  // 자리표시가 할 일은 슬롯이 어디에 얼마만 한지를 보여주는 것이다.
  const k = tex ? 1 : 1 / (b.scale !== undefined && b.scale > 0 ? b.scale : 1);
  const w = b.w * k;
  const h = b.h * k;

  if (tex) {
    const s = fitSprite(tex, b.w, b.h);
    s.x = b.w / 2;
    s.y = b.h / 2;
    c.addChild(s);
  } else {
    const g = new Graphics().roundRect(0, 0, w, h, 8 * k).fill({ color: fill, alpha: onTap ? 1 : 0.55 });
    g.roundRect(2 * k, 2 * k, w - 4 * k, h - 4 * k, 6 * k).stroke({ width: 2 * k, color: 0xffffff, alpha: 0.18 });
    c.addChild(g);
    const t = new Text({
      text: b.label,
      style: { fontSize: Math.min(12, b.h * 0.28) * k, fill: onTap ? 0xfff3dc : 0xa8987c, fontWeight: "bold" },
    });
    t.anchor.set(0.5);
    t.x = w / 2;
    t.y = h / 2;
    c.addChild(t);
  }

  // 투명이어도 히트 판정을 받으려면 실제로 채워야 한다(alpha 0)
  c.addChild(new Graphics().rect(0, 0, w, h).fill({ color: 0xffffff, alpha: 0 }));

  editable(AREA, b, c); // 인게임 레이아웃 에디터가 이 노드를 잡는다
  if (onTap) {
    c.eventMode = "static";
    c.cursor = "pointer";
    // 터치 영역을 **슬롯 상자 그대로** 못박는다. 자식으로 둔 투명 사각형은 노드에 걸린
    // 배율(nav 4종은 2.3)에 함께 끌려가 96×50이 220×115가 됐고, 겹치면 나중에 붙은
    // 것이 잡히므로 HOME을 눌러도 RACE가 열렸다. editable() 뒤에 읽어야 pivot·배율이
    // 이미 입혀진 값이다.
    const r = slotHitRect(b, { x: c.x, y: c.y, scale: c.scale.x, pivotX: c.pivot.x, pivotY: c.pivot.y });
    c.hitArea = new Rectangle(r.x, r.y, r.w, r.h);
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

/** 슬롯 id는 장면 키에서 만든다 — friendRabbit, friendMonkey … 순서가 곧 마릿수다.
 *  이름의 동물과 그 장면의 동물은 무관하다(data/lobbyScene.ts 참조). */
const sceneSlotId = (key: string): string => `friend${key[0]!.toUpperCase()}${key.slice(1)}`;

/** 로비를 띄우고 PLAY를 누를 때까지 기다린다. */
export function runLobby(
  app: Application,
  profile: Profile,
  tex: LobbyTextures,
  /** 레이스가 프로필을 바꾸면 알린다 — 저장은 호출자가 한다 */
  onProfile: (p: Profile) => void = () => {},
): Promise<void> {
  return new Promise<void>((resolve) => {
    const layer = new Container();
    app.stage.addChild(layer);
    playBgm("audio.bgmLobby");

    const scenePaths = tex.scenes;
    /** 배경 영상을 멈추는 함수들. 로비를 닫을 때 전부 부른다 — 안 부르면 티커에 남아
     *  파괴된 텍스처를 계속 올린다. */
    const stops: Array<() => void> = [];

    // 콘텐츠 박스만 채운다 — 좌우 블리드는 main.ts의 기본 배경 영상이 모든 화면 밑에서 돈다
    layer.addChild(contentRect(0x241a10));
    // 배경은 겹이고 **아무것도 사라지지 않는다.** 아래부터
    //   ① 스틸(bg) — 즉시 뜬다. 영상이 오기 전까지의 자리이고 그 뒤에도 그대로 둔다
    //   ② 장면 영상(friends) — 구출 마릿수에 맞는 한 편
    // 전에는 장면 영상이 오면 스틸을 숨겼다. 그러면 스틸이 「잠깐 떴다 사라지는」
    // 것으로 보였다(QA). 자리를 지금 잡아 둔다 — 나중에 인덱스를 세어 끼우면
    // 스틸이 없을 때 한 칸씩 밀려 테두리나 재화 바를 덮는다.
    const stillBg = tex.bg ? coverBox(tex.bg) : null;
    if (stillBg) layer.addChild(stillBg);
    const sceneLayer = new Container();
    layer.addChild(sceneLayer);

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

    // ── 구출한 동물이 사는 배경 영상 ───────────────
    // 배경까지 통째로 그려진 전체화면 루핑 영상이라 코드는 동물을 따로 그리지 않는다.
    //
    // **스틸을 먼저 깔고 영상은 준비되면 얹는다.** 영상은 용량이 커서 늦게 오고,
    // 텍스처 로딩이 브라우저에 따라 아예 멈추기도 한다(ui/videoScreen.ts 참조).
    // 기다렸다 그리면 그 사이 로비가 비고, 멈추면 영영 빈다.
    void (async () => {
      // 큰 것부터 내려가며 **실제로 받아지는** 첫 편을 쓴다. 매니페스트에는 여섯 칸이
      // 늘 다 들어 있어서(파일을 지워도 경로는 남는다) 경로만 보고는 있는지 알 수 없다.
      for (const key of sceneCandidates(profile.rescued.length)) {
        if (slot(AREA, sceneSlotId(key))?.hidden === true) continue; // 끈 자리는 건너뛴다
        const t = await loadTexture(scenePaths[key], VIDEO_LOAD_TIMEOUT_MS);
        if (!t) continue;
        if (layer.destroyed || sceneLayer.destroyed) return; // 그 사이 로비가 닫혔다
        stops.push(playVideoTexture(t, app.ticker)); // 영상이면 돈다. 스틸이면 아무 일도 없다
        sceneLayer.addChild(coverBox(t)); // ② 스틸은 그대로 밑에 남는다
        return;
      }
    })();

    // ── PLAY ────────────────────────────────────
    const play = box("play", { x: 138, y: 646, w: 174, h: 54 });
    layer.addChild(hotspot(play, tex.play, () => finish(), 0x3faa48));

    // ── 하단 4종 — HOME·WORLD·ANIMALS 동작, EVENTS는 목업 ─────
    const home = box("navHome", { x: 18, y: 738, w: 96, h: 50 });
    layer.addChild(hotspot(home, tex.icons.navHome, () => { /* 이미 홈이다 */ }));

    // 월드 지도가 있던 자리다. worldScreen.ts는 남아 있지만 진입점이 없어
    // 번들에서 빠진다 — 부트 체인에서 ui/boot.ts를 남긴 것과 같은 처리다.
    const race = box("navRace", { x: 122, y: 738, w: 96, h: 50 });
    layer.addChild(hotspot(race, tex.icons.navRace, () => {
      void openRace(app, layer, tex.race, profile, onProfile).then((r) => {
        if (r.exit === "lobby") { /* 이미 로비다 — 레이스만 닫힌다 */ }
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
      for (const stop of stops) stop(); // 티커에 남으면 파괴된 텍스처를 계속 올린다
      clearEditable(AREA); // 파괴된 노드를 에디터가 계속 잡고 있으면 안 된다
      layer.destroy({ children: true });
      resolve();
    }
  });
}
