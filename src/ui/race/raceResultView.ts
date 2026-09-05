// ui/race/raceResultView.ts — 경주 결과. 시안에서는 패널이 아니라 **화면 한 장**이다.
// 간판 · 1위 동물 · 시상대 · 순위 6행(메달·얼굴·이름·기록) · 다시하기/닫기.
//
// 좌표와 텍스처는 주입받는다(규약 2조) — 이 파일은 ../../data를 모른다.
import { Container, Graphics, Text, type Texture } from "pixi.js";
import { fitSprite } from "../skin";
import { ranking } from "../../engine/race/raceRun";
import type { RaceState } from "../../engine/race/types";
import type { RaceReward } from "../../engine/race/reward";
import type { UiSlot } from "../../data/uiLayout";

export interface ResultRow {
  rank: number;
  name: string;
  glyph: string;
  face?: Texture;
  /** 초. 못 들어왔으면 null */
  time: number | null;
  mine: boolean;
}

export interface ResultTextures {
  podium?: Texture;
  rowFirst?: Texture;
  rowRest?: Texture;
  medal: Partial<Record<"gold" | "silver" | "bronze", Texture>>;
  winner?: Texture;
  btnRetry?: Texture;
  btnClose?: Texture;
}

/** 00:28.41 — 시안의 표기 그대로 */
function fmt(sec: number | null): string {
  if (sec === null) return "--:--.--";
  const m = Math.floor(sec / 60);
  const s = sec - m * 60;
  return `${String(m).padStart(2, "0")}:${s.toFixed(2).padStart(5, "0")}`;
}

const MEDAL_KEY = ["gold", "silver", "bronze"] as const;
const MEDAL_COLOR = [0xf0c040, 0xc8ccd4, 0xc8834a];

function art(b: UiSlot, tex: Texture | undefined, into: Container): boolean {
  if (!tex) return false;
  const s = fitSprite(tex, b.w, b.h);
  s.x = b.x + b.w / 2;
  s.y = b.y + b.h / 2;
  into.addChild(s);
  return true;
}

function label(b: UiSlot, text: string, size: number, color: number): Text {
  const t = new Text({
    text,
    style: { fontSize: b.fontSize ?? size, fill: color, fontWeight: "bold", stroke: { color: 0x2a1d10, width: 4 } },
  });
  t.anchor.set(0.5);
  t.x = b.x + b.w / 2;
  t.y = b.y + b.h / 2;
  return t;
}

function button(b: UiSlot, text: string, tex: Texture | undefined, fill: number, onTap: () => void): Container {
  const c = new Container();
  c.x = b.x;
  c.y = b.y;
  if (tex) {
    const s = fitSprite(tex, b.w, b.h);
    s.x = b.w / 2;
    s.y = b.h / 2;
    c.addChild(s);
  } else {
    const g = new Graphics().roundRect(0, 0, b.w, b.h, 12).fill(fill);
    g.roundRect(3, 3, b.w - 6, b.h - 6, 9).stroke({ width: 2, color: 0xffffff, alpha: 0.22 });
    c.addChild(g);
    const t = new Text({
      text,
      style: { fontSize: Math.min(20, b.h * 0.42), fill: 0xfff3dc, fontWeight: "bold" },
    });
    t.anchor.set(0.5);
    t.x = b.w / 2;
    t.y = b.h / 2;
    c.addChild(t);
  }
  c.addChild(new Graphics().rect(0, 0, b.w, b.h).fill({ color: 0xffffff, alpha: 0 }));
  c.eventMode = "static";
  c.cursor = "pointer";
  c.on("pointertap", onTap);
  return c;
}

/** 순위 한 줄 — 메달/번호 · 얼굴 · 이름 · 기록. 1위만 판이 다르다(시안). */
function row(b: UiSlot, y: number, h: number, r: ResultRow, tex: ResultTextures): Container {
  const c = new Container();
  const plate = r.rank === 1 ? tex.rowFirst : tex.rowRest;
  if (plate) {
    const s = fitSprite(plate, b.w, h);
    s.x = b.w / 2;
    s.y = h / 2;
    c.addChild(s);
  } else {
    const g = new Graphics().roundRect(0, 0, b.w, h - 4, 8)
      .fill(r.rank === 1 ? 0xe0a94a : 0xb98a55);
    g.roundRect(3, 3, b.w - 6, h - 10, 6).stroke({ width: 2, color: 0x7a5228, alpha: 0.7 });
    c.addChild(g);
  }

  const medalTex = r.rank <= 3 ? tex.medal[MEDAL_KEY[r.rank - 1]!] : undefined;
  if (medalTex) {
    const s = fitSprite(medalTex, h * 0.8, h * 0.8);
    s.x = h * 0.55;
    s.y = h / 2;
    c.addChild(s);
  } else {
    const g = new Graphics().circle(h * 0.55, h / 2, h * 0.32)
      .fill(r.rank <= 3 ? MEDAL_COLOR[r.rank - 1]! : 0x4a3320);
    c.addChild(g);
    const n = new Text({
      text: String(r.rank),
      style: { fontSize: h * 0.38, fill: 0xffffff, fontWeight: "bold" },
    });
    n.anchor.set(0.5);
    n.x = h * 0.55;
    n.y = h / 2;
    c.addChild(n);
  }

  if (r.face) {
    const s = fitSprite(r.face, h * 0.85, h * 0.85);
    s.x = h * 1.5;
    s.y = h / 2;
    c.addChild(s);
  } else {
    const t = new Text({ text: r.glyph, style: { fontSize: h * 0.5 } });
    t.anchor.set(0.5);
    t.x = h * 1.5;
    t.y = h / 2;
    c.addChild(t);
  }

  const style = { fontSize: Math.min(19, h * 0.4), fill: 0x3b2410, fontWeight: "bold" as const };
  const name = new Text({ text: r.name, style });
  name.anchor.set(0, 0.5);
  name.x = h * 2.1;
  name.y = h / 2;
  c.addChild(name);

  const time = new Text({ text: fmt(r.time), style });
  time.anchor.set(1, 0.5);
  time.x = b.w - h * 0.4;
  time.y = h / 2;
  c.addChild(time);

  c.x = b.x;
  c.y = y;
  return c;
}

export function buildRaceResult(o: {
  slots: Record<string, UiSlot>;
  tex: ResultTextures;
  race: RaceState;
  animalOf: (id: string) => { name: string; glyph: string; face?: Texture };
  reward: RaceReward | null;
  boosterName: (id: string) => string | null;
  onRetry: () => void;
  onClose: () => void;
}): Container {
  const root = new Container();
  const s = o.slots;

  const rows: ResultRow[] = ranking(o.race).map((r, i) => {
    const a = o.animalOf(r.id);
    return { rank: i + 1, name: a.name, glyph: a.glyph, face: a.face, time: r.finishedAt, mine: r.id === o.race.myId };
  });

  // 간판과 좌우 표지판은 배경 아트가 그린다 — 코드가 덧그리면 두 번 나온다
  art(s.podium!, o.tex.podium, root);

  // 1위 동물 — 축하 아트가 없으면 얼굴을 크게 쓴다
  const champ = rows[0];
  if (champ) {
    const w = o.tex.winner ?? champ.face;
    if (!art(s.winner!, w, root)) {
      root.addChild(label(s.winner!, champ.glyph, 84, 0xffffff));
    }
  }

  const list = s.resultList!;
  const rowH = list.h / Math.max(1, rows.length);
  for (const r of rows) root.addChild(row(list, list.y + rowH * (r.rank - 1), rowH, r, o.tex));

  // 보상 — 갱신했을 때만 뜬다. 시안에 두 줄 자리가 없어 한 줄로 합쳤다.
  // 이 줄이 없으면 부스터를 받은 것을 유저가 알 길이 없다.
  if (o.reward?.improved) {
    const name = o.reward.booster ? o.boosterName(o.reward.booster) : null;
    const tag = label(s.bestTag!, `최고기록 갱신!  ${name ?? "부스터"} +1`, 17, 0x8fdc8f);
    tag.visible = s.bestTag!.hidden !== true;
    root.addChild(tag);
    // 나뉜 표기를 원하면 rewardLabel 슬롯을 에디터에서 켜면 된다
    if (s.rewardLabel!.hidden !== true) root.addChild(label(s.rewardLabel!, `${name ?? "부스터"} +1`, 16, 0xfff3dc));
  }

  root.addChild(button(s.btnRetry!, "다시하기", o.tex.btnRetry, 0x3faa48, o.onRetry));
  root.addChild(button(s.btnClose!, "닫기", o.tex.btnClose, 0x8a5a2b, o.onClose));
  return root;
}
