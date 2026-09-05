// ui/race/rosterView.ts — 동물 뽑기 룰렛.
//
// **결과를 먼저 받고 연출만 재생한다.** 연출 프레임 수가 결과를 바꾸면 무엇이 뽑힐지를
// 테스트할 수 없게 된다. 여기서 하는 일은 하이라이트를 감속시켜 목표 레인에 세우는 것뿐이다.
import { Container, Graphics } from "pixi.js";

export interface RosterView {
  node: Container;
  /** 목표 레인에서 멎는 룰렛을 시작한다 */
  spin: (targetLane: number, onTick: () => void, onDone: () => void) => void;
  /** 매 프레임 */
  update: (dt: number) => void;
}

const LANES = 6;
/** 총 회전 시간(s)과 최소 바퀴 수 — 짧으면 뽑는 맛이 없고 길면 지루하다 */
const SPIN_SEC = 1.6;
const MIN_LOOPS = 2;

export function createRoster(o: {
  laneY: (lane: number) => number;
  x: number;
  w: number;
  h: number;
}): RosterView {
  const node = new Container();
  const bar = new Graphics()
    .roundRect(0, -o.h / 2, o.w, o.h, 8)
    .fill({ color: 0xffd66b, alpha: 0.28 });
  bar.roundRect(0, -o.h / 2, o.w, o.h, 8).stroke({ width: 2, color: 0xffd66b });
  bar.x = o.x;
  node.addChild(bar);
  node.visible = false;

  let running = false;
  let t = 0;
  let steps = 0;
  let shown = -1;
  let done: (() => void) | null = null;
  let tick: (() => void) | null = null;

  const place = (i: number): void => {
    bar.y = o.laneY(((i % LANES) + LANES) % LANES);
  };
  place(0);

  return {
    node,
    spin: (targetLane, onTick, onDone) => {
      // 목표에서 정확히 멎도록 총 걸음 수를 미리 정한다 — 마지막 걸음이 targetLane이다
      steps = MIN_LOOPS * LANES + ((targetLane - 0) % LANES + LANES) % LANES;
      t = 0;
      shown = -1;
      running = true;
      node.visible = true;
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
        place(at);
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
