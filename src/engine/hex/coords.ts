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

/**
 * 발사체가 놓일 수 있는 자리인가 — **스냅·충돌 판정용 경계**다.
 *
 * 판은 줄이 내려올 때마다 반 칸씩 좌우로 오간다(pushRow). 오른쪽 위상에서는
 * 짝수 행의 마지막 칸이 오프셋 열 `cols`에 놓이므로 `col < cols`로 자르면 그 칸이
 * 「보드 밖」이 된다. 그러면 옆에 스냅할 수 없을 뿐 아니라 **발사체가 그 타일을
 * 통과해 버린다**(simulateShot이 보드 밖 칸은 충돌로 세지 않는다).
 *
 * 홀수 행은 이미 반 칸 오른쪽에 있어서 `cols`까지 허용하면 우리 밖으로 나간다 —
 * 그래서 행 패리티로 갈린다. 두 경우를 합치면 화면 x가 정확히 셀 폭 `cols + 1`칸,
 * 곧 우리 폭이 된다(`geom.CELL_W`).
 */
export function inBounds(a: Axial, cols: number, rows: number): boolean {
  if (a.r < 0 || a.r >= rows) return false;
  const col = toCol(a);
  if (col < 0) return false;
  return a.r % 2 === 0 ? col <= cols : col < cols;
}

/**
 * 스테이지 정의가 쓸 수 있는 자리인가 — **배치 작성용 경계**다.
 *
 * 배치는 좌우로 오가지 않는 기준 위상에서 짜므로 열이 정확히 `cols`칸이다.
 * `inBounds`의 여분 반 칸은 밀기 중에만 잠깐 쓰이는 자리라, 여기에 타일을 적어 두면
 * 첫 밀기에서 우리 밖으로 나간다. 그래서 배치 검증은 이쪽을 쓴다.
 */
export function inAuthoredBounds(a: Axial, cols: number, rows: number): boolean {
  if (a.r < 0 || a.r >= rows) return false;
  const col = toCol(a);
  return col >= 0 && col < cols;
}
