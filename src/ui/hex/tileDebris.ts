// ui/hex/tileDebris.ts — 판에서 떨어져 나온 타일이 굴러가 사라지는 층.
//
// 물리는 debrisMotion.ts가 다 한다. 여기는 **떼어 온 표시 객체를 받아** 그 계산
// 결과를 좌표에 옮겨 담을 뿐이다. 새 스프라이트를 만들지 않는 것이 중요하다 —
// 방금까지 판에 있던 바로 그 타일이 굴러가야 「저게 떨어졌다」로 읽힌다.
import { Container } from "pixi.js";

import { penEdges, PEN, CELL_W, HEX_SIZE } from "./geom";
import { spawnDebris, stepDebris, collidePieces, type DebrisArena, type DebrisBody } from "./debrisMotion";
import { playLightSweep } from "./lightSweep";

/** 조각이 멈추는 바닥 — 타일이 깔려 있던 배경 울타리의 하단 경계다. */
const FLOOR_Y = PEN.lb.y;

export interface TileDebris {
  root: Container;
  /**
   * 떼어 온 표시 객체들을 굴린다. **소유권이 여기로 넘어온다** — 호출자는 이후
   * 이 객체를 만지지 않는다.
   * @param from 터진 자리(착탄점). 조각들이 여기서 멀어지는 쪽으로 튄다.
   */
  burst(pieces: Array<{ view: Container; x: number; y: number }>, from: { x: number; y: number }): void;
  /** 설정창이 열려 있는 동안 멈춘다 — 「멈춘 게임」 위에서 파편만 굴러가면 어색하다. */
  pause(): void;
  resume(): void;
  destroy(): void;
}

export function createTileDebris(rand: () => number = Math.random): TileDebris {
  const root = new Container();
  const arena: DebrisArena = {
    // 타일은 육각이지만 구르는 것은 원으로 친다 — 반 칸이 접지 반지름이다
    radius: CELL_W / 2,
    edges: penEdges,
    floor: FLOOR_Y,
  };

  interface Piece { view: Container; body: DebrisBody }
  const pieces: Piece[] = [];
  let raf = 0;
  let last = 0;

  function drop(p: Piece): void {
    if (!p.view.destroyed) p.view.destroy({ children: true });
  }

  function tick(now: number): void {
    raf = 0;
    if (root.destroyed) return;
    // 탭 전환 등으로 프레임이 크게 벌어지면 한 스텝에 벽을 뚫는다 — 상한을 둔다
    const dt = Math.min(0.05, Math.max(0, (now - last) / 1000));
    last = now;

    // 조각끼리 부딪히면 서로 밀어내고 튕긴다 — 그냥 통과하면 겹쳐 흐르는 한 덩어리로
    // 보인다. 전진시키기 **전에** 겹침을 푼다: 푼 뒤에 밀면 그 프레임에 다시 겹친다.
    collidePieces(pieces.map((p) => p.body), arena);

    for (let i = pieces.length - 1; i >= 0; i -= 1) {
      const p = pieces[i]!;
      stepDebris(p.body, dt, arena, rand);
      if (p.body.phase === "dead") {
        drop(p);
        pieces.splice(i, 1);
        continue;
      }
      if (p.view.destroyed) {
        pieces.splice(i, 1);
        continue;
      }
      p.view.x = p.body.x;
      p.view.y = p.body.y;
      p.view.rotation = p.body.rot;
      p.view.alpha = p.body.alpha;
    }

    if (pieces.length > 0) raf = requestAnimationFrame(tick);
  }

  function start(): void {
    if (raf !== 0 || pieces.length === 0) return;
    last = performance.now();
    raf = requestAnimationFrame(tick);
  }

  function stop(): void {
    if (raf !== 0) cancelAnimationFrame(raf);
    raf = 0;
  }

  return {
    root,

    burst(incoming, from): void {
      for (const { view, x, y } of incoming) {
        if (view.destroyed) continue;
        const body = spawnDebris({ x, y }, from, rand);
        view.x = body.x;
        view.y = body.y;
        root.addChild(view);
        // 떨어지는 동안 그 위로 빛이 한 번 지나간다 — 낙하를 멈추지 않는다(QA 선택)
        playLightSweep(view, HEX_SIZE);
        pieces.push({ view, body });
      }
      start();
    },

    pause(): void {
      stop();
    },

    resume(): void {
      start();
    },

    destroy(): void {
      stop(); // rAF가 살아 있으면 파괴된 노드를 계속 만진다
      for (const p of pieces) drop(p);
      pieces.length = 0;
      root.destroy({ children: true });
    },
  };
}
