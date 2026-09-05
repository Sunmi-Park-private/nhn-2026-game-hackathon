// ui/race/raceResultView.ts — 레이스 결과 패널.
//
// 스테이지 결과 화면과 다른 것이다(이름이 raceResultView인 이유).
// 좌표와 텍스처는 주입받는다 — 이 파일은 ../../data를 모른다(규약 2조).
import { Container, Graphics, Text, type Texture } from "pixi.js";
import { fitSprite } from "../skin";

export interface ResultBox { x: number; y: number; w: number; h: number }

export interface ResultRow {
  /** 1부터 */
  rank: number;
  name: string;
  glyph: string;
  /** 초. 못 들어왔으면 null */
  time: number | null;
  mine: boolean;
}

export interface RaceResultOpts {
  slots: Record<string, ResultBox>;
  tex: { panel?: Texture; bestTag?: Texture; retry?: Texture; close?: Texture; reward?: Texture };
  rows: ResultRow[];
  /** 갱신했을 때만 배지와 보상이 켜진다 */
  improved: boolean;
  previous: number | null;
  rewardName: string | null;
  onRetry: () => void;
  onClose: () => void;
}

const fmt = (s: number | null): string => (s === null ? "—" : `${s.toFixed(2)}초`);

function button(
  b: ResultBox, label: string, tex: Texture | undefined, fill: number, onTap: () => void,
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
    const g = new Graphics().roundRect(0, 0, b.w, b.h, 10).fill(fill);
    g.roundRect(2, 2, b.w - 4, b.h - 4, 8).stroke({ width: 2, color: 0xffffff, alpha: 0.18 });
    c.addChild(g);
    const t = new Text({
      text: label,
      style: { fontSize: Math.min(15, b.h * 0.34), fill: 0xfff3dc, fontWeight: "bold" },
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

function label(b: ResultBox, text: string, size: number, color: number): Text {
  const t = new Text({
    text,
    style: { fontSize: size, fill: color, fontWeight: "bold", stroke: { color: 0x1a1108, width: 3 } },
  });
  t.anchor.set(0.5);
  t.x = b.x + b.w / 2;
  t.y = b.y + b.h / 2;
  return t;
}

export function createRaceResult(o: RaceResultOpts): Container {
  const root = new Container();
  const s = o.slots;

  const panel = s.resultPanel!;
  if (o.tex.panel) {
    const spr = fitSprite(o.tex.panel, panel.w, panel.h);
    spr.x = panel.x + panel.w / 2;
    spr.y = panel.y + panel.h / 2;
    root.addChild(spr);
  } else {
    const g = new Graphics().roundRect(panel.x, panel.y, panel.w, panel.h, 16)
      .fill({ color: 0x2b1f13, alpha: 0.96 });
    g.roundRect(panel.x + 3, panel.y + 3, panel.w - 6, panel.h - 6, 13)
      .stroke({ width: 2, color: 0xc98a3c });
    root.addChild(g);
  }

  const mine = o.rows.find((r) => r.mine);
  root.addChild(label(s.resultTitle!, mine ? `${mine.rank}위` : "결과", 34, 0xffd66b));

  // 순위 6행 — 영역을 균등 분할한다. 행마다 슬롯을 두면 트랙처럼 6개를 따로 끌어야 한다.
  const list = s.resultList!;
  const rowH = list.h / Math.max(1, o.rows.length);
  for (const r of o.rows) {
    const y = list.y + rowH * (r.rank - 1);
    if (r.mine) {
      root.addChild(new Graphics().roundRect(list.x - 4, y + 2, list.w + 8, rowH - 4, 6)
        .fill({ color: 0xc98a3c, alpha: 0.22 }));
    }
    const style = { fontSize: 17, fill: r.mine ? 0xffd66b : 0xfff3dc, fontWeight: "bold" as const };
    const left = new Text({ text: `${r.rank}  ${r.glyph}  ${r.name}`, style });
    left.x = list.x + 8;
    left.y = y + rowH / 2;
    left.anchor.set(0, 0.5);
    const right = new Text({ text: fmt(r.time), style: { ...style, fontSize: 15 } });
    right.x = list.x + list.w - 8;
    right.y = y + rowH / 2;
    right.anchor.set(1, 0.5);
    root.addChild(left, right);
  }

  // 갱신했을 때만 배지·보상이 산다
  if (o.improved) {
    const tag = s.bestTag!;
    if (o.tex.bestTag) {
      const spr = fitSprite(o.tex.bestTag, tag.w, tag.h);
      spr.x = tag.x + tag.w / 2;
      spr.y = tag.y + tag.h / 2;
      root.addChild(spr);
    } else {
      root.addChild(new Graphics().roundRect(tag.x, tag.y, tag.w, tag.h, 8).fill(0x3faa48));
      root.addChild(label(tag, "최고기록 갱신!", 15, 0xffffff));
    }

    const icon = s.rewardIcon!;
    if (o.tex.reward) {
      const spr = fitSprite(o.tex.reward, icon.w, icon.h);
      spr.x = icon.x + icon.w / 2;
      spr.y = icon.y + icon.h / 2;
      root.addChild(spr);
    } else {
      root.addChild(new Graphics().roundRect(icon.x, icon.y, icon.w, icon.h, 10).fill(0x4a3320));
    }
    root.addChild(label(s.rewardLabel!, `${o.rewardName ?? "부스터"} +1`, 17, 0xfff3dc));
  } else if (o.previous !== null) {
    // 못 깼으면 얼마나 모자랐는지가 다시 달릴 이유가 된다
    const gap = (mine?.time ?? 0) - o.previous;
    root.addChild(label(s.bestTag!, `최고 ${fmt(o.previous)} (+${gap.toFixed(2)})`, 15, 0xb39b78));
  }

  root.addChild(button(s.retry!, "다시 달리기", o.tex.retry, 0x3faa48, o.onRetry));
  root.addChild(button(s.close!, "로비로", o.tex.close, 0x6b4626, o.onClose));
  return root;
}
