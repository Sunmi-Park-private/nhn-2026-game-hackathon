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
  /** 판에 닿지 못하고 다시 아래로 떨어졌다 — 헛발 */
  missed: boolean;
}

/** 좌우 벽의 픽셀 x. 0열 왼쪽 변과 마지막 열 오른쪽 변이다. */
export function boardBounds(geom: BoardGeom): { minX: number; maxX: number } {
  const w = SQRT3 * geom.size; // 셀 폭
  const minX = toPixel({ q: 0, r: 0 }, geom.size).x - w / 2;
  // 홀수 행은 반 칸 오른쪽으로 밀려 있어 짝수 행보다 w/2 더 뻗는다.
  // 벽은 모든 행의 합집합을 감싸야 한다 — 짝수 행 기준으로 잡으면
  // 오른쪽 벽이 홀수 행 마지막 육각의 한가운데를 자른다.
  return { minX, maxX: minX + (geom.cols + 0.5) * w };
}

/** 중력 가속도(px/s²). **절대값 자체엔 의미가 없다** — 아래 RISE 계수와의 비만
 *  궤적 모양을 정한다. 속도를 「올라갈 높이」에서 역산하기 때문이다. */
const G = 2400;

/** 파워 0에서 올라갈 높이(발사 지점→천장 높이의 배수).
 *  1.0이면 천장에 딱 닿는다 — 여유를 둬 반드시 넘기게 한다.
 *  이 값이 §7의 「도달 보장」이다. 낮추면 약한 발이 판에 못 닿기 시작한다. */
const MIN_RISE = 1.15;

/** 파워 1에서 올라갈 높이. 좌우 벽을 두어 번 튀고도 천장까지 가는 값. */
const MAX_RISE = 3.2;

/** 한 스텝의 이동 거리 상한(육각 반지름의 몫). 얇은 관통을 막는다. */
const STEP_DIV = 5;

/** 방어적 백스톱. 정상 궤적은 2천 스텝 안에 끝난다. */
const MAX_STEPS = 20000;

const clamp01 = (v: number): number => (v < 0 ? 0 : v > 1 ? 1 : v);

/** 파워 → 초속. 「얼마나 높이 올라갈 것인가」에서 v² = 2gh로 역산한다.
 *  판 크기가 달라져도 같은 파워가 같은 비율만큼 날아간다 — 테스트 지오메트리와
 *  실제 판의 크기가 달라도 규칙이 흔들리지 않는다. */
export function launchSpeed(from: { y: number }, geom: BoardGeom, power: number): number {
  // 발사 지점에서 천장(y ≈ 0) 위 반 칸까지의 높이. 발사대는 판 아래에 있다.
  const climb = Math.max(geom.size, from.y + geom.size);
  const rise = climb * (MIN_RISE + (MAX_RISE - MIN_RISE) * clamp01(power));
  return Math.sqrt(2 * G * rise);
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
  power = 1,
): ShotResult {
  const { minX, maxX } = boardBounds(geom);
  const v0 = launchSpeed(from, geom, power);
  // 스텝 간격은 초속에서 역산한다. 발사 뒤 속도는 v0를 넘지 않는다 —
  // 올라갔다 내려와 발사 높이로 돌아오는 순간 헛발로 끊기 때문이다.
  const dt = geom.size / STEP_DIV / v0;

  let vx = Math.sin(angleRad) * v0;
  let vy = -Math.cos(angleRad) * v0; // 화면 y는 아래로 증가하므로 위로 가려면 음수
  let x = from.x;
  let y = from.y;

  const path: Array<{ x: number; y: number }> = [{ x, y }];
  let lastEmpty: Axial | null = null;
  let missed = false;

  // 시작 칸이 이미 비어 있다면 후보로 삼는다
  const startCell = fromPixel({ x, y }, geom.size);
  if (inBounds(startCell, geom.cols, geom.rows) && !cells.has(key(startCell))) {
    lastEmpty = startCell;
  }

  for (let i = 0; i < MAX_STEPS; i++) {
    vy += G * dt;
    x += vx * dt;
    y += vy * dt;

    // 좌우 벽 반사 — 입사각 = 반사각. 에너지는 잃지 않는다(예측선이 정직해야 한다)
    if (x < minX) {
      x = minX + (minX - x);
      vx = -vx;
    } else if (x > maxX) {
      x = maxX - (x - maxX);
      vx = -vx;
    }
    path.push({ x, y });

    // 다시 발사 높이 아래로 떨어졌다 — 판에 닿지 못했다
    if (vy > 0 && y > from.y) {
      missed = true;
      break;
    }

    const a = fromPixel({ x, y }, geom.size);

    // 천장을 넘었다 — 더 갈 곳이 없다
    if (a.r < 0) break;

    // 보드 밖(아래·좌우)은 "아직 판에 들어오지 않은 상태"다. 발사체는 판 아래에서
    // 출발하므로 여기서 멈추면 첫 스텝에 끝나버린다 — 계속 전진시킨다.
    if (!inBounds(a, geom.cols, geom.rows)) continue;

    if (cells.has(key(a))) break; // 타일이든 케이지든 여기서 멈춘다

    lastEmpty = a;
  }

  // 헛발은 지나온 빈 칸이 있어도 붙지 않는다 — 떨어진 타일이 공중에 남을 수 없다
  return { snap: missed ? null : lastEmpty, path, missed };
}
