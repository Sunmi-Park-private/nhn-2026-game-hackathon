// ui/hex/cageView.ts — 케이지 렌더와 구출 연출.
// 케이지는 셀 맵에서 사라지는 것으로 "구출됨"을 표현하므로,
// 이 뷰는 stage.cages(고정 목록)와 state.rescued를 대조해 그린다.
import { Container, Graphics, Sprite, Text, type Texture } from "pixi.js";
import { cellToScreen, HEX_SIZE } from "./geom";
import { hexPoints } from "./tileArt";
import type { Cage, RunState } from "../../engine/hex/types";

export interface CageTextures {
  closed: Texture | null;
  open: Texture | null;
  animals: Record<string, Texture | null>;
}

export interface CageView {
  root: Container;
  /** 케이지 목록과 화면을 맞춘다.
   *  **주의 — 호출 순서 계약:** state.rescued에 들어간 케이지는 여기서 파괴된다.
   *  구출 연출을 보여주려면 이 함수보다 playRescue를 **먼저** 불러야 한다.
   *  (연출 중인 케이지는 animating 가드가 지켜주지만, 연출이 시작조차 안 했으면
   *   지켜줄 것이 없다.) */
  sync(state: RunState): void;
  /** 구출 연출을 재생하고, 끝나면 몸체를 스스로 치운다.
   *  연출이 끝날 때 resolve된다 — 호출자가 순차로 await할 수 있다.
   *  **sync가 이미 그 케이지를 지웠다면 아무 일도 하지 않고 즉시 resolve한다** —
   *  이 경우 연출은 보이지 않는다. 위 sync의 순서 계약 참조. */
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

/** 육각형 꼭짓점을 (dx, dy)만큼 옮긴 좌표 배열. */
function hexAt(size: number, dx: number, dy: number): number[] {
  const pts = hexPoints(size);
  const out: number[] = [];
  for (let i = 0; i < pts.length; i += 2) out.push(pts[i]! + dx, pts[i + 1]! + dy);
  return out;
}

/** pointy-top 육각형 안에서, 중심으로부터 x만큼 떨어진 세로선의 반높이.
 *  꼭짓점이 (0, ±size)와 (±√3·size/2, ±size/2)이므로 위아래 빗변은
 *  |x|가 커질수록 y가 √3분의 1씩 줄어든다. 이 식으로 창살을 육각 안에 딱 맞춘다.
 *  마스크를 쓰지 않으므로 케이지마다 렌더 타겟이 늘지 않는다. */
function barHalfHeight(size: number, x: number): number {
  return size - Math.abs(x) / Math.sqrt(3);
}

/** 창살 한 칸. 육각 윤곽 + 세로 창살 3줄을 그린다. */
function drawBars(g: Graphics, size: number, dx: number, dy: number, color: number): void {
  const w = Math.sqrt(3) * size;
  for (const t of [-1 / 3, 0, 1 / 3]) {
    const x = w * t;
    const half = barHalfHeight(size - 3, x) - 2;
    if (half <= 0) continue;
    g.moveTo(dx + x, dy - half).lineTo(dx + x, dy + half).stroke({ width: 2.5, color });
  }
  g.poly(hexAt(size - 1, dx, dy)).stroke({ width: 3, color });
}

const BAR_COLOR = 0xb9c4d2;   // 쇠창살
const CAGE_DARK = 0x1b2430;   // 창살 안쪽 그늘

function makeCageBody(cage: Cage, tex: CageTextures): Container {
  const box = new Container();
  const center = cageCenter(cage);
  // 케이지가 차지한 각 칸의 중심을, 케이지 전체 중심 기준 오프셋으로 바꾼다.
  // 이 오프셋이 곧 육각 격자의 칸 간격이므로 주변 타일과 정확히 맞물린다.
  const offsets = cage.cells.map((c) => {
    const p = cellToScreen(c);
    return { dx: p.x - center.x, dy: p.y - center.y };
  });
  const w = Math.sqrt(3) * HEX_SIZE;
  const h = 2 * HEX_SIZE;

  if (tex.closed) {
    // 아트가 오면 칸마다 한 장씩 얹는다 — 타일과 같은 육각 규격이다
    for (const { dx, dy } of offsets) {
      const s = new Sprite(tex.closed);
      s.anchor.set(0.5);
      s.width = w;
      s.height = h;
      s.x = dx;
      s.y = dy;
      box.addChild(s);
    }
  } else {
    // 폴백 — 칸마다 육각 그늘을 깔고, 동물을 얹은 뒤, 창살을 그 위에 덮는다.
    // 순서가 중요하다: 창살이 동물보다 위에 있어야 「갇혀 있다」로 읽힌다.
    const back = new Graphics();
    for (const { dx, dy } of offsets) back.poly(hexAt(HEX_SIZE - 1, dx, dy)).fill(CAGE_DARK);
    box.addChild(back);
  }

  const animalTex = tex.animals[cage.animalId] ?? null;
  if (animalTex) {
    const a = new Sprite(animalTex);
    a.anchor.set(0.5);
    a.width = w * cage.cells.length * 0.6;
    a.height = h * 0.6;
    box.addChild(a);
  } else {
    const label = new Text({
      text: cage.animalId,
      style: { fontSize: 10, fill: 0xffffff, fontWeight: "bold" },
    });
    label.anchor.set(0.5);
    label.y = -HEX_SIZE * 0.3; // 아래쪽 자물쇠와 겹치지 않게 살짝 올린다
    box.addChild(label);
  }

  if (!tex.closed) {
    const bars = new Graphics();
    for (const { dx, dy } of offsets) drawBars(bars, HEX_SIZE, dx, dy, BAR_COLOR);
    // 자물쇠 — 케이지 아래쪽 한가운데. 육각 아래 꼭짓점 안쪽에 걸친다.
    bars.roundRect(-9, HEX_SIZE - 16, 18, 13, 3).fill({ color: 0xe4ebf3 });
    bars.circle(0, HEX_SIZE - 10, 3).fill({ color: CAGE_DARK });
    box.addChild(bars);
  }

  return box;
}

export function createCageView(textures: CageTextures): CageView {
  const root = new Container();
  const bodies = new Map<string, Container>();
  const animating = new Set<string>();

  return {
    root,

    sync(state: RunState): void {
      for (const cage of state.stage.cages) {
        const rescued = state.rescued.includes(cage.animalId);
        const existing = bodies.get(cage.id);

        if (rescued) {
          // 구출 연출이 도는 중이면 건드리지 않는다 — playRescue가 끝내고 스스로 치운다
          if (animating.has(cage.id)) continue;
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

      animating.add(cage.id);
      try {
        await new Promise<void>((resolve) => {
          const start = performance.now();
          const from = body.y;
          const tick = (): void => {
            // 연출 도중 몸체가 파괴됐으면 조용히 끝낸다 — Pixi가 _position을 null로
            // 만들어 두므로 여기서 막지 않으면 rAF 콜백 안에서 예외가 터지고
            // resolve가 영영 호출되지 않는다.
            if (body.destroyed) {
              resolve();
              return;
            }
            const t = Math.min(1, (performance.now() - start) / 420);
            body.y = from - 40 * t;
            body.alpha = 1 - t;
            body.scale.set(1 + 0.25 * t);
            if (t < 1) requestAnimationFrame(tick);
            else resolve();
          };
          tick();
        });
      } finally {
        // 연출이 끝났으니 스스로 치운다 — 이후 sync가 다시 그리지 않는다
        animating.delete(cage.id);
        if (!body.destroyed) body.destroy();
        bodies.delete(cage.id);
      }
    },

    destroy(): void {
      animating.clear();
      for (const b of bodies.values()) b.destroy();
      bodies.clear();
      root.destroy({ children: true });
    },
  };
}
