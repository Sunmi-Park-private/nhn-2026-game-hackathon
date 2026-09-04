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

/** flat-top 육각형 꼭짓점 6개. **위아래가 수평**이고 좌우가 뾰족하다.
 *  타일(pointy-top)을 30° 돌린 방향이다 — 창살이 타일과 다른 방향으로 서서
 *  「타일 무리 안에 놓인 다른 물건」으로 읽힌다. */
function flatHexPoints(size: number): number[] {
  const pts: number[] = [];
  for (let i = 0; i < 6; i += 1) {
    const angle = (Math.PI / 180) * (60 * i);
    pts.push(size * Math.cos(angle), size * Math.sin(angle));
  }
  return pts;
}

/** 케이지가 차지한 덩어리를 덮는 flat-top 육각 하나의 반지름.
 *
 *  케이지는 칸 하나가 아니라 육각 덩어리(반지름 1이면 7칸)를 차지하고,
 *  그 둘레를 1칸짜리 타일이 감싼다. 창살은 칸마다 그리지 않고 덩어리 전체를
 *  덮는 **큰 육각 한 장**이다.
 *
 *  가로로 가장 먼 칸의 중심까지 거리에 셀 반폭을 더하면 그 칸의 바깥 변에 닿는다.
 *  flat-top 육각은 가로가 세로보다 길어서(2 : √3) 이 값을 쓰면 세로로는 저절로
 *  덩어리 안에 들어온다 — 둘레 타일을 침범하지 않는다.
 *  한 칸짜리 케이지면 dx가 0이라 딱 한 칸 폭의 육각이 된다. */
function cageHexSize(offsets: Array<{ dx: number; dy: number }>): number {
  const cellW = Math.sqrt(3) * HEX_SIZE;
  let maxDx = 0;
  for (const o of offsets) maxDx = Math.max(maxDx, Math.abs(o.dx));
  return maxDx + cellW / 2;
}

/** flat-top 육각형 안에서, 중심으로부터 x만큼 떨어진 세로선의 반높이.
 *  꼭짓점이 (±size, 0)과 (±size/2, ±√3·size/2)이므로 가운데 절반 구간은
 *  높이가 일정하고(수평인 윗변·아랫변), 바깥 절반에서만 빗변을 따라 줄어든다.
 *  이 식으로 창살을 육각 안에 딱 맞춘다 — 마스크를 쓰지 않으므로
 *  케이지마다 렌더 타겟이 늘지 않는다. */
function barHalfHeight(size: number, x: number): number {
  const ax = Math.abs(x);
  const h = (Math.sqrt(3) / 2) * size;
  return ax <= size / 2 ? h : Math.sqrt(3) * (size - ax);
}

/** 창살. 큰 육각의 윤곽과, 그 안을 채우는 세로 창살을 그린다.
 *  창살 간격은 육각 크기에 비례시켜 케이지가 커져도 밀도가 유지된다. */
function drawBars(g: Graphics, size: number, color: number): void {
  const cellW = Math.sqrt(3) * HEX_SIZE;
  const count = Math.max(3, Math.round((size * 2) / cellW) * 2 + 1);
  for (let i = 0; i < count; i += 1) {
    // -0.5 ~ +0.5 구간에 균등 배치. 양 끝은 윤곽선에 묻히므로 조금 안쪽으로 들인다
    const x = (i / (count - 1) - 0.5) * 2 * size * 0.88;
    const half = barHalfHeight(size - 3, x) - 2;
    if (half <= 0) continue;
    g.moveTo(x, -half).lineTo(x, half).stroke({ width: 2.5, color });
  }
  g.poly(flatHexPoints(size - 1)).stroke({ width: 3.5, color });
}

const BAR_COLOR = 0xb9c4d2;   // 쇠창살
const CAGE_DARK = 0x1b2430;   // 창살 안쪽 그늘

function makeCageBody(cage: Cage, tex: CageTextures): Container {
  const box = new Container();
  const center = cageCenter(cage);
  const offsets = cage.cells.map((c) => {
    const p = cellToScreen(c);
    return { dx: p.x - center.x, dy: p.y - center.y };
  });
  const size = cageHexSize(offsets);
  const w = 2 * size;                      // flat-top: 가로가 꼭짓점 사이
  const h = Math.sqrt(3) * size;            // 세로가 수평 변 사이

  if (tex.closed) {
    // 아트도 덩어리 전체를 덮는 큰 flat-top 육각 한 장이다 — 가로:세로 = 2 : √3
    const s = new Sprite(tex.closed);
    s.anchor.set(0.5);
    s.width = w;
    s.height = h;
    box.addChild(s);
  } else {
    box.addChild(new Graphics().poly(flatHexPoints(size - 1)).fill(CAGE_DARK));
  }

  const animalTex = tex.animals[cage.animalId] ?? null;
  if (animalTex) {
    const a = new Sprite(animalTex);
    a.anchor.set(0.5);
    a.width = w * 0.62;
    a.height = h * 0.62;
    box.addChild(a);
  } else {
    const label = new Text({
      text: cage.animalId,
      style: { fontSize: 11, fill: 0xffffff, fontWeight: "bold" },
    });
    label.anchor.set(0.5);
    label.y = -h * 0.1;
    box.addChild(label);
  }

  if (!tex.closed) {
    // 창살은 동물보다 위에 그린다 — 그래야 「갇혀 있다」로 읽힌다
    const bars = new Graphics();
    drawBars(bars, size, BAR_COLOR);
    bars.roundRect(-9, h / 2 - 17, 18, 13, 3).fill({ color: 0xe4ebf3 });
    bars.circle(0, h / 2 - 11, 3).fill({ color: CAGE_DARK });
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
