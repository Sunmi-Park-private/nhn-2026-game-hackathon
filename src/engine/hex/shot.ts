// engine/hex/shot.ts — 발사체 궤적, 좌우 벽 반사, 스냅 셀 결정.
// 각도 규약: 0 = 똑바로 위, 양수 = 오른쪽 기울기 (라디안).
import { key, toPixel, fromPixel, inBounds } from "./coords";
import type { Axial, Cell } from "./types";

const SQRT3 = Math.sqrt(3);

export interface BoardGeom {
  /** 육각 반지름 */
  size: number;
  cols: number;
  rows: number;
}

export interface ShotResult {
  /** 붙을 셀. 어디에도 붙일 수 없으면 null */
  snap: Axial | null;
  /** 연출용 궤적 점 목록 */
  path: Array<{ x: number; y: number }>;
}

/** 좌우 벽의 픽셀 x. 0열 왼쪽 변과 마지막 열 오른쪽 변이다. */
export function boardBounds(geom: BoardGeom): { minX: number; maxX: number } {
  const w = SQRT3 * geom.size; // 셀 폭
  const minX = toPixel({ q: 0, r: 0 }, geom.size).x - w / 2;
  return { minX, maxX: minX + geom.cols * w };
}

/**
 * 발사체를 한 스텝씩 전진시키며 충돌을 찾는다.
 * 좌우 벽에서 반사하고, 점유 셀이나 천장 위로 나가면 멈춘 뒤
 * **마지막으로 지나온 빈 칸**에 스냅한다.
 */
export function simulateShot(
  cells: Map<string, Cell>,
  geom: BoardGeom,
  from: { x: number; y: number },
  angleRad: number,
): ShotResult {
  const { minX, maxX } = boardBounds(geom);
  const step = geom.size / 4; // 셀 하나를 4스텝 이상으로 쪼갠다 — 얇은 관통 방지
  const maxSteps = 4000;

  let dx = Math.sin(angleRad);
  let dy = -Math.cos(angleRad); // 화면 y는 아래로 증가하므로 위로 가려면 음수
  let x = from.x;
  let y = from.y;

  const path: Array<{ x: number; y: number }> = [{ x, y }];
  let lastEmpty: Axial | null = null;

  // 시작 칸이 이미 비어 있다면 후보로 삼는다
  const startCell = fromPixel({ x, y }, geom.size);
  if (inBounds(startCell, geom.cols, geom.rows) && !cells.has(key(startCell))) {
    lastEmpty = startCell;
  }

  for (let i = 0; i < maxSteps; i++) {
    x += dx * step;
    y += dy * step;

    // 좌우 벽 반사 — 입사각 = 반사각
    if (x < minX) {
      x = minX + (minX - x);
      dx = -dx;
    } else if (x > maxX) {
      x = maxX - (x - maxX);
      dx = -dx;
    }
    path.push({ x, y });

    const a = fromPixel({ x, y }, geom.size);

    // 천장을 넘었다 — 더 갈 곳이 없다
    if (a.r < 0) break;

    // 보드 밖(아래·좌우)은 "아직 판에 들어오지 않은 상태"다. 발사체는 판 아래에서
    // 출발하므로 여기서 멈추면 첫 스텝에 끝나버린다 — 계속 전진시킨다.
    if (!inBounds(a, geom.cols, geom.rows)) continue;

    if (cells.has(key(a))) break; // 타일이든 케이지든 여기서 멈춘다

    lastEmpty = a;
  }

  return { snap: lastEmpty, path };
}
