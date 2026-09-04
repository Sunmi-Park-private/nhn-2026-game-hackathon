// ui/hex/cageView.ts — 케이지 렌더와 구출 연출.
// 케이지는 셀 맵에서 사라지는 것으로 "구출됨"을 표현하므로,
// 이 뷰는 stage.cages(고정 목록)와 state.rescued를 대조해 그린다.
import { Container, Graphics, Sprite, Text, type Texture } from "pixi.js";
import { cellToScreen, HEX_SIZE } from "./geom";
import type { Cage, RunState } from "../../engine/hex/types";

export interface CageTextures {
  closed: Texture | null;
  open: Texture | null;
  animals: Record<string, Texture | null>;
}

export interface CageView {
  root: Container;
  sync(state: RunState): void;
  playRescue(cage: Cage): Promise<void>;
  destroy(): void;
}

/** 케이지가 점유한 셀들의 중심점. 가로 2셀이면 두 셀의 중간이다. */
function cageCenter(cage: Cage): { x: number; y: number } {
  let sx = 0;
  let sy = 0;
  for (const c of cage.cells) {
    const p = cellToScreen(c);
    sx += p.x;
    sy += p.y;
  }
  return { x: sx / cage.cells.length, y: sy / cage.cells.length };
}

function makeCageBody(cage: Cage, tex: CageTextures): Container {
  const box = new Container();
  const w = Math.sqrt(3) * HEX_SIZE * cage.cells.length;
  const h = 2 * HEX_SIZE;

  if (tex.closed) {
    const s = new Sprite(tex.closed);
    s.anchor.set(0.5);
    s.width = w;
    s.height = h;
    box.addChild(s);
  } else {
    // 폴백 — 창살 느낌의 사각 프레임
    const g = new Graphics();
    g.roundRect(-w / 2, -h / 2, w, h, 6).fill({ color: 0x2b3440 });
    g.roundRect(-w / 2 + 3, -h / 2 + 3, w - 6, h - 6, 4).stroke({ width: 2, color: 0x8f9bab });
    for (let i = 1; i < 4; i++) {
      const x = -w / 2 + (w / 4) * i;
      g.moveTo(x, -h / 2 + 5).lineTo(x, h / 2 - 5).stroke({ width: 2, color: 0x8f9bab });
    }
    box.addChild(g);
  }

  const animalTex = tex.animals[cage.animalId] ?? null;
  if (animalTex) {
    const a = new Sprite(animalTex);
    a.anchor.set(0.5);
    a.width = w * 0.7;
    a.height = h * 0.7;
    box.addChild(a);
  } else {
    const label = new Text({
      text: cage.animalId,
      style: { fontSize: 11, fill: 0xffffff, fontWeight: "bold" },
    });
    label.anchor.set(0.5);
    box.addChild(label);
  }
  return box;
}

export function createCageView(textures: CageTextures): CageView {
  const root = new Container();
  const bodies = new Map<string, Container>();

  return {
    root,

    sync(state: RunState): void {
      for (const cage of state.stage.cages) {
        const rescued = state.rescued.includes(cage.animalId);
        const existing = bodies.get(cage.id);

        if (rescued) {
          if (existing) {
            existing.destroy();
            bodies.delete(cage.id);
          }
          continue;
        }
        if (existing) continue;

        const body = makeCageBody(cage, textures);
        const p = cageCenter(cage);
        body.x = p.x;
        body.y = p.y;
        root.addChild(body);
        bodies.set(cage.id, body);
      }
    },

    async playRescue(cage: Cage): Promise<void> {
      const body = bodies.get(cage.id);
      if (!body) return;
      // 짧게 튕겨 올라가며 사라진다 — 상세 연출은 fx.ts가 맡는다
      const start = performance.now();
      const from = body.y;
      await new Promise<void>((resolve) => {
        const tick = (): void => {
          const t = Math.min(1, (performance.now() - start) / 420);
          body.y = from - 40 * t;
          body.alpha = 1 - t;
          body.scale.set(1 + 0.25 * t);
          if (t < 1) requestAnimationFrame(tick);
          else resolve();
        };
        tick();
      });
    },

    destroy(): void {
      for (const b of bodies.values()) b.destroy();
      bodies.clear();
      root.destroy({ children: true });
    },
  };
}
