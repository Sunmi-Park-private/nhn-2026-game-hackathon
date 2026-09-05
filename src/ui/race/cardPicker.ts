// ui/race/cardPicker.ts — 동물 카드 격자와 뽑기 룰렛.
//
// 카드는 **6종 타일이 한 장으로 온다**(`race.card.grid`). 코드가 그 이미지 안의 타일 자리를
// 격자 계산으로 짚어 하이라이트만 얹는다 — 낱장으로 자를 필요가 없다.
// 이미지가 없으면 낱장 폴백으로 6칸을 직접 그린다(아트 0장으로도 누가 누군지 읽혀야 한다).
//
// **결과를 먼저 받고 연출만 재생한다.** 연출 프레임 수가 결과를 바꾸면 무엇이 뽑힐지를
// 테스트할 수 없게 된다. 여기서 하는 일은 하이라이트를 감속시켜 목표 칸에 세우는 것뿐이다.
//
// 좌표와 텍스처는 주입받는다(규약 2조).
import { Container, Graphics, Text, type Texture } from "pixi.js";
import { fitSprite } from "../skin";
import { tileRect, type Box, type CardGrid } from "./gridGeom";

export type { Box, CardGrid } from "./gridGeom";

export interface CardPicker {
  node: Container;
  /** 목표 칸에서 멎는 룰렛을 시작한다 */
  spin: (targetIndex: number, onTick: () => void, onDone: () => void) => void;
  reset: () => void;
  update: (dt: number) => void;
}

/** 총 회전 시간(s)과 최소 바퀴 수 — 짧으면 뽑는 맛이 없고 길면 지루하다 */
const SPIN_SEC = 1.7;
const MIN_LOOPS = 2;

export function createCardPicker(o: {
  box: Box;
  grid: CardGrid;
  animals: readonly { id: string; name: string; glyph: string }[];
  faces: Partial<Record<string, Texture>>;
  /** 6종이 한 장에 담긴 격자 이미지 */
  gridArt?: Texture;
  /** 선택 테두리. 없으면 코드가 노란 테두리를 그린다 */
  frameOn?: Texture;
  /** 낱장 카드 판 — 격자 이미지가 없을 때만 쓴다 */
  frameOff?: Texture;
}): CardPicker {
  const node = new Container();
  const rects = o.animals.map((_, i) => tileRect(o.box, o.grid, i));

  if (o.gridArt) {
    // 타일·이름표·테두리가 다 그려진 한 장. 코드는 아무것도 덧그리지 않는다.
    const s = fitSprite(o.gridArt, o.box.w, o.box.h);
    s.x = o.box.x + o.box.w / 2;
    s.y = o.box.y + o.box.h / 2;
    node.addChild(s);
  } else {
    // 폴백 — 낱장으로 6칸을 그린다
    o.animals.forEach((a, i) => {
      const r = rects[i]!;
      const card = new Container();
      card.x = r.x;
      card.y = r.y;

      if (o.frameOff) {
        const s = fitSprite(o.frameOff, r.w, r.h);
        s.x = r.w / 2;
        s.y = r.h / 2;
        card.addChild(s);
      } else {
        const g = new Graphics().roundRect(0, 0, r.w, r.h, 10).fill(0x9a6b33);
        g.roundRect(4, 4, r.w - 8, r.h - 8, 7).stroke({ width: 2, color: 0x5d3d18 });
        card.addChild(g);
      }

      const face = o.faces[a.id];
      if (face) {
        const s = fitSprite(face, r.w * 0.78, r.h * 0.6);
        s.x = r.w / 2;
        s.y = r.h * 0.42;
        card.addChild(s);
      } else {
        const t = new Text({ text: a.glyph, style: { fontSize: Math.min(r.w, r.h) * 0.45 } });
        t.anchor.set(0.5);
        t.x = r.w / 2;
        t.y = r.h * 0.42;
        card.addChild(t);
      }

      const name = new Text({
        text: a.name,
        style: { fontSize: Math.min(15, r.h * 0.13), fill: 0x3b2410, fontWeight: "bold" },
      });
      name.anchor.set(0.5);
      name.x = r.w / 2;
      name.y = r.h * 0.86;
      card.addChild(name);
      node.addChild(card);
    });
  }

  // 하이라이트 — 격자 이미지를 쓰든 안 쓰든 **타일 자리 위에** 얹는다
  const highlights = rects.map((r) => {
    const pad = o.grid.pad;
    let hi: Container;
    if (o.frameOn) {
      const s = fitSprite(o.frameOn, r.w + pad * 2, r.h + pad * 2);
      s.x = r.x + r.w / 2;
      s.y = r.y + r.h / 2;
      hi = s;
    } else {
      hi = new Graphics()
        .roundRect(r.x - pad, r.y - pad, r.w + pad * 2, r.h + pad * 2, 12)
        .stroke({ width: 5, color: 0xffd66b });
    }
    hi.visible = false;
    node.addChild(hi);
    return hi;
  });

  let running = false;
  let t = 0;
  let steps = 0;
  let shown = -1;
  let done: (() => void) | null = null;
  let tick: (() => void) | null = null;

  const light = (i: number | null): void => {
    highlights.forEach((h, k) => { h.visible = i !== null && k === i; });
  };

  return {
    node,
    reset: () => { running = false; light(null); },
    spin: (targetIndex, onTick, onDone) => {
      const n = highlights.length;
      steps = MIN_LOOPS * n + ((targetIndex % n) + n) % n;
      t = 0;
      shown = -1;
      running = true;
      tick = onTick;
      done = onDone;
    },
    update: (dt) => {
      if (!running) return;
      t += dt;
      const p = Math.min(1, t / SPIN_SEC);
      // ease-out cubic — 끝에서 눈에 띄게 느려져야 「멎는다」로 읽힌다
      const eased = 1 - Math.pow(1 - p, 3);
      const at = Math.min(steps, Math.floor(eased * steps));
      if (at !== shown) {
        shown = at;
        light(at % highlights.length);
        tick?.();
      }
      if (p >= 1) {
        running = false;
        const cb = done;
        done = null;
        tick = null;
        cb?.();
      }
    },
  };
}
