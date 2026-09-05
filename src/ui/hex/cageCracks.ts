// ui/hex/cageCracks.ts — 케이지에 맞닿은 타일에 금을 긋는다. 첫 판의 안내 전용이다.
//
// 어느 칸에 그을지는 engine/hex/cageEdge가 정한다. 여기는 **어떻게 보이는지**만 안다.
// 판이 자글거리거나 줄이 내려오면 금도 같이 움직여야 하므로, 부모가 판과 같은
// 오프셋을 걸어 준다(stageScreen의 applyBoardOffset).
//
// 금 모양은 칸 좌표에서 결정론적으로 뽑는다. 매번 난수로 그리면 redraw마다 금이
// 춤을 춰서 「깨지는 중」으로 잘못 읽힌다 — 여기는 정지한 표시다.
import { Container, Graphics } from "pixi.js";
import type { Axial } from "../../engine/hex/types";
import { cellToScreen, HEX_SIZE } from "./geom";

/** 금 한 줄의 길이. 칸을 넘지 않게 반지름에서 뽑는다.
 *  1.05로 시작했다가 실제 크기(타일 ≈24px)에서 흠집처럼만 보여 키웠다. */
const LEN = HEX_SIZE * 1.45;
const INK = 0x2b1a08;
const GLINT = 0xfff0c8;

export interface CageCracks {
  root: Container;
  /** 금을 그을 칸. 부를 때마다 전부 다시 그린다 — 칸이 몇 개뿐이라 델타를 추적하지 않는다 */
  sync(at: Axial[]): void;
  destroy(): void;
}

/** 칸 좌표에서 뽑는 0~1 난수. 같은 칸은 언제나 같은 값이다. */
function hash01(q: number, r: number, salt: number): number {
  const n = Math.sin(q * 127.1 + r * 311.7 + salt * 74.7) * 43758.5453;
  return n - Math.floor(n);
}

/** 금 한 줄. 가운데를 한 번 꺾어 직선으로 안 보이게 한다. */
function crackPath(cx: number, cy: number, angle: number, len: number): number[] {
  const dx = Math.cos(angle);
  const dy = Math.sin(angle);
  // 꺾이는 방향은 진행 방향의 법선이다
  const nx = -dy;
  const ny = dx;
  const half = len / 2;
  const kink = len * 0.18;
  return [
    cx - dx * half, cy - dy * half,
    cx + nx * kink, cy + ny * kink,
    cx + dx * half, cy + dy * half,
  ];
}

export function createCageCracks(): CageCracks {
  const root = new Container();
  const g = new Graphics();
  root.addChild(g);

  return {
    root,

    sync(at: Axial[]): void {
      g.clear();
      for (const a of at) {
        const p = cellToScreen(a);
        // 칸마다 두 줄. 두 번째는 첫 번째와 크게 어긋나게 둬서 갈라진 것으로 읽힌다.
        const base = hash01(a.q, a.r, 1) * Math.PI;
        const lines: Array<[number, number]> = [
          [base, LEN],
          [base + 1.1 + hash01(a.q, a.r, 2) * 0.8, LEN * 0.58],
        ];
        for (const [angle, len] of lines) {
          const path = crackPath(p.x, p.y, angle, len);
          // 어두운 선 위에 밝은 선을 겹쳐 「파인 자국」으로 보이게 한다.
          // 밝은 선만 그으면 타일 색에 따라 사라지고, 어두운 선만 그으면 때처럼 보인다.
          g.poly(path, false).stroke({ width: 3.4, color: INK, alpha: 0.85 });
          g.poly(path, false).stroke({ width: 1.5, color: GLINT, alpha: 0.85 });
        }
      }
    },

    destroy(): void {
      root.destroy({ children: true });
    },
  };
}
