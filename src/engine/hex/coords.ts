// engine/hex/coords.ts — 축좌표(axial) 헥사 격자. pointy-top, 가로 행 스태거.
// 순수 TS — Pixi를 import하지 않는다(규약 5조).
import type { Axial } from "./types";

const SQRT3 = Math.sqrt(3);

/** 이웃 6방향. 인덱스 순서는 ring() 알고리즘이 의존하므로 바꾸지 말 것. */
export const DIRS: readonly Axial[] = [
  { q: 1, r: 0 },
  { q: 1, r: -1 },
  { q: 0, r: -1 },
  { q: -1, r: 0 },
  { q: -1, r: 1 },
  { q: 0, r: 1 },
];

/** Map 키. 좌표를 객체로 비교할 수 없으므로 문자열로 정규화한다. */
export function key(a: Axial): string {
  return `${a.q},${a.r}`;
}

export function parseKey(k: string): Axial {
  const i = k.indexOf(",");
  return { q: Number(k.slice(0, i)), r: Number(k.slice(i + 1)) };
}

export function eq(a: Axial, b: Axial): boolean {
  return a.q === b.q && a.r === b.r;
}

export function add(a: Axial, b: Axial): Axial {
  return { q: a.q + b.q, r: a.r + b.r };
}

export function neighbors(a: Axial): Axial[] {
  return DIRS.map((d) => add(a, d));
}

/** 큐브 거리. axial(q,r)을 큐브(x=q, z=r, y=-q-r)로 보고 잰다. */
export function distance(a: Axial, b: Axial): number {
  const dq = a.q - b.q;
  const dr = a.r - b.r;
  return (Math.abs(dq) + Math.abs(dq + dr) + Math.abs(dr)) / 2;
}

/** 중심에서 반지름 radius인 테두리. radius=1이면 6칸, 0이면 중심 1칸. */
export function ring(center: Axial, radius: number): Axial[] {
  if (radius <= 0) return [{ ...center }];
  const out: Axial[] = [];
  // DIRS[4] 방향으로 radius칸 이동해 시작점을 잡고, 6방향을 radius칸씩 걷는다
  const start = DIRS[4]!;
  let hex: Axial = { q: center.q + start.q * radius, r: center.r + start.r * radius };
  for (let i = 0; i < 6; i++) {
    for (let j = 0; j < radius; j++) {
      out.push(hex);
      hex = add(hex, DIRS[i]!);
    }
  }
  return out;
}

/** 축좌표 → 픽셀(셀 중심). 원점 (0,0)은 픽셀 (0,0). */
export function toPixel(a: Axial, size: number): { x: number; y: number } {
  return {
    x: size * SQRT3 * (a.q + a.r / 2),
    y: size * 1.5 * a.r,
  };
}

/** 픽셀 → 축좌표. 가장 가까운 셀로 반올림한다(큐브 라운딩). */
export function fromPixel(p: { x: number; y: number }, size: number): Axial {
  const qf = ((SQRT3 / 3) * p.x - (1 / 3) * p.y) / size;
  const rf = ((2 / 3) * p.y) / size;
  return cubeRound(qf, rf);
}

/** 실수 축좌표를 가장 가까운 정수 셀로. 큐브 3축을 각각 반올림하고
 *  오차가 가장 큰 축을 나머지로 맞춘다 — 축좌표만으로 반올림하면 경계에서 틀린다. */
function cubeRound(qf: number, rf: number): Axial {
  const xf = qf;
  const zf = rf;
  const yf = -xf - zf;
  let x = Math.round(xf);
  let y = Math.round(yf);
  let z = Math.round(zf);
  const dx = Math.abs(x - xf);
  const dy = Math.abs(y - yf);
  const dz = Math.abs(z - zf);
  if (dx > dy && dx > dz) x = -y - z;
  else if (dy > dz) y = -x - z;
  else z = -x - y;
  return { q: x, r: z };
}

/** odd-r 오프셋 열 번호. 보드 경계 판정에 쓴다. */
export function toCol(a: Axial): number {
  return a.q + Math.floor(a.r / 2);
}

/** cols×rows 직사각 보드 안인가. */
export function inBounds(a: Axial, cols: number, rows: number): boolean {
  if (a.r < 0 || a.r >= rows) return false;
  const col = toCol(a);
  return col >= 0 && col < cols;
}
