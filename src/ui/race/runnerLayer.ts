// ui/race/runnerLayer.ts — 6마리를 세우고 카메라에 맞춰 옮긴다.
//
// 카메라는 내 동물을 화면 cameraX에 고정하고 세계를 흘려보낸다. 그래서 AI는 나와의
// **상대 거리**로 놓인다 — 앞서면 오른쪽으로 멀어지고 뒤처지면 화면 밖으로 빠진다.
import { Container, Graphics, type Texture } from "pixi.js";
import { createRunnerView, type RunnerView } from "./runnerView";
import type { RunnerState } from "../../engine/race/types";

export interface RunnerLayerOpts {
  animals: readonly { id: string; glyph: string }[];
  frames: Record<string, Texture[]>;
  /** 달리는 바닥 — 이 밖으로는 그리지 않는다. 러너가 레인보다 커서 아래위로 넘친다 */
  box: { x: number; w: number; y: number; h: number };
  laneY: (lane: number) => number;
  size: number;
  cameraX: number;
  pxPerM: number;
}

export interface RunnerLayer {
  node: Container;
  /** 내 동물을 정하고 6마리를 새로 만든다 */
  build: (myId: string) => void;
  clear: () => void;
  update: (runners: readonly RunnerState[], cameraM: number, dt: number) => void;
}

/** 경계 밖 여유 — 러너가 화면 가장자리에서 뚝 사라지지 않게 한다 */
const MARGIN = 60;

export function createRunnerLayer(o: RunnerLayerOpts): RunnerLayer {
  const node = new Container();
  const views = new Map<string, RunnerView>();

  // 러너는 레인보다 크게 그린다(작으면 안 보인다). 대신 바닥 밖으로 새지 않게 자른다.
  const mask = new Graphics().rect(o.box.x, o.box.y, o.box.w, o.box.h).fill(0xffffff);
  const sprites = new Container();
  node.addChild(mask, sprites);
  sprites.mask = mask;

  const clear = (): void => {
    sprites.removeChildren();
    views.clear();
  };

  return {
    node,
    clear,
    build: (myId) => {
      clear();
      for (const a of o.animals) {
        const v = createRunnerView({
          frames: o.frames[a.id] ?? [],
          glyph: a.glyph,
          size: o.size,
          mine: a.id === myId,
        });
        views.set(a.id, v);
        sprites.addChild(v.node);
      }
    },
    update: (runners, cameraM, dt) => {
      for (const r of runners) {
        const v = views.get(r.id);
        if (!v) continue;
        const sx = o.cameraX + (r.x - cameraM) * o.pxPerM;
        v.node.visible = sx > o.box.x - MARGIN && sx < o.box.x + o.box.w + MARGIN;
        v.update(sx, o.laneY(r.lane), r.spm, dt);
      }
    },
  };
}
