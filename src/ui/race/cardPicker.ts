// ui/race/cardPicker.ts — 동물 카드 3×2 그리드와 뽑기 룰렛.
//
// **결과를 먼저 받고 연출만 재생한다.** 연출 프레임 수가 결과를 바꾸면 무엇이 뽑힐지를
// 테스트할 수 없게 된다. 여기서 하는 일은 하이라이트를 감속시켜 목표 칸에 세우는 것뿐이다.
//
// 좌표와 텍스처는 주입받는다(규약 2조).
import { Container, Graphics, Text, type Texture } from "pixi.js";
import { fitSprite } from "../skin";

export interface CardPicker {
  node: Container;
  /** 목표 칸에서 멎는 룰렛을 시작한다 */
  spin: (targetIndex: number, onTick: () => void, onDone: () => void) => void;
  /** 고른 것 없는 상태로 되돌린다 */
  reset: () => void;
  update: (dt: number) => void;
}

const COLS = 3;
const ROWS = 2;
/** 총 회전 시간(s)과 최소 바퀴 수 — 짧으면 뽑는 맛이 없고 길면 지루하다 */
const SPIN_SEC = 1.7;
const MIN_LOOPS = 2;

export function createCardPicker(o: {
  box: { x: number; y: number; w: number; h: number };
  animals: readonly { id: string; name: string; glyph: string }[];
  faces: Partial<Record<string, Texture>>;
  frameOff?: Texture;
  frameOn?: Texture;
}): CardPicker {
  const node = new Container();
  const gapX = o.box.w * 0.04;
  const gapY = o.box.h * 0.06;
  const cw = (o.box.w - gapX * (COLS - 1)) / COLS;
  const ch = (o.box.h - gapY * (ROWS - 1)) / ROWS;

  const frames: Container[] = [];
  const highlights: Graphics[] = [];

  o.animals.forEach((a, i) => {
    const cx = o.box.x + (cw + gapX) * (i % COLS);
    const cy = o.box.y + (ch + gapY) * Math.floor(i / COLS);
    const card = new Container();
    card.x = cx;
    card.y = cy;

    if (o.frameOff) {
      const s = fitSprite(o.frameOff, cw, ch);
      s.x = cw / 2;
      s.y = ch / 2;
      card.addChild(s);
    } else {
      const g = new Graphics().roundRect(0, 0, cw, ch, 10).fill(0x9a6b33);
      g.roundRect(4, 4, cw - 8, ch - 8, 7).stroke({ width: 2, color: 0x5d3d18 });
      card.addChild(g);
    }

    // 얼굴 아트가 없으면 글리프로 대신한다 — 아트 0장으로도 누가 누군지 읽힌다
    const face = o.faces[a.id];
    if (face) {
      const s = fitSprite(face, cw * 0.78, ch * 0.6);
      s.x = cw / 2;
      s.y = ch * 0.42;
      card.addChild(s);
    } else {
      const t = new Text({ text: a.glyph, style: { fontSize: Math.min(cw, ch) * 0.45 } });
      t.anchor.set(0.5);
      t.x = cw / 2;
      t.y = ch * 0.42;
      card.addChild(t);
    }

    const name = new Text({
      text: a.name,
      style: { fontSize: Math.min(15, ch * 0.13), fill: 0x3b2410, fontWeight: "bold" },
    });
    name.anchor.set(0.5);
    name.x = cw / 2;
    name.y = ch * 0.86;
    card.addChild(name);

    // 하이라이트는 카드 위에 얹는다 — 켜진 칸만 보인다
    const hi = new Graphics().roundRect(-3, -3, cw + 6, ch + 6, 12)
      .stroke({ width: 5, color: 0xffd66b });
    hi.visible = false;
    card.addChild(hi);

    frames.push(card);
    highlights.push(hi);
    node.addChild(card);
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
      const n = frames.length;
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
        light(at % frames.length);
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
