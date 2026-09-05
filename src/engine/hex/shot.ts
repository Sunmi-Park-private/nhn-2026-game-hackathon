// engine/hex/shot.ts — 발사체 궤적, 좌우 벽 반사, 스냅 셀 결정.
// 각도 규약: 0 = 똑바로 위, 양수 = 오른쪽 기울기 (라디안).
import { key, toPixel, fromPixel, inBounds, neighbors } from "./coords";
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
  /** 좌우 벽에 부딪힌 자리, 부딪힌 순서대로. 조준 규칙이 **첫 반사**를 본다 —
   *  판 하단에서 곧바로 튕기는 눕힌 각을 막기 위해서다(ui/hex/aimRule.ts). */
  bounces: Array<{ x: number; y: number }>;
  /** 판에 닿지 못하고 다시 아래로 떨어졌다 — 헛발 */
  missed: boolean;
}

/** 좌우 벽의 픽셀 x. 0열 왼쪽 변과 마지막 열 오른쪽 변이다. */
export function boardBounds(geom: BoardGeom): { minX: number; maxX: number } {
  const w = SQRT3 * geom.size; // 셀 폭
  const minX = toPixel({ q: 0, r: 0 }, geom.size).x - w / 2;
  // 홀수 행은 반 칸 오른쪽으로 밀려 있어 짝수 행보다 w/2 더 뻗고, 판 전체가
  // 줄이 내려올 때마다 반 칸씩 좌우로 오간다(pushRow). 벽은 **두 위상의 합집합**을
  // 감싸야 한다 — cols+0.5로 잡으면 오른쪽 위상에서 마지막 육각의 한가운데를 자른다.
  return { minX, maxX: minX + (geom.cols + 1) * w };
}

/** 중력 가속도(px/s²). **절대값 자체엔 의미가 없다** — 아래 RISE 계수와의 비만
 *  궤적 모양을 정한다. 속도를 「올라갈 높이」에서 역산하기 때문이다. */
const G = 2400;

/** 파워 0에서 올라갈 높이(발사 지점→천장 높이의 배수).
 *  1.0이면 천장에 딱 닿는다 — 여유를 둬 반드시 넘기게 한다.
 *  이 값이 §7의 「도달 보장」이다. 낮추면 약한 발이 판에 못 닿기 시작한다. */
const MIN_RISE = 1.15;

/** 파워 1에서 올라갈 높이.
 *
 *  **각도가 눕을수록 세로 성분이 무너진다** — 올라가는 높이는 rise·cos²(각도)다.
 *  조준 한계인 72°(MAX_ANGLE=1.25)에서 cos²은 0.10까지 떨어지므로, 그 각도의
 *  최대 파워 발이 천장에 닿으려면 10을 넘겨야 한다. 넓은 뱅크 샷을 살려 두는
 *  값이다(스펙 §7).
 *
 *  대가로 최대 파워에서는 궤적이 거의 곧아진다 — 중력은 약한 발과 눕힌 발에서
 *  드러난다. 파워 곡선의 손맛(어느 구간이 촘촘한가)은 밸런싱이고 이 브랜치의
 *  일이 아니다. */
const MAX_RISE = 10.5;

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
  const bounces: Array<{ x: number; y: number }> = [];
  let lastEmpty: Axial | null = null;
  /** 멈추게 한 점유 칸. 천장을 넘거나 헛발이면 null */
  let hit: Axial | null = null;
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
      bounces.push({ x: minX, y });
    } else if (x > maxX) {
      x = maxX - (x - maxX);
      vx = -vx;
      bounces.push({ x: maxX, y });
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

    if (cells.has(key(a))) { hit = a; break; } // 타일이든 케이지든 여기서 멈춘다

    lastEmpty = a;
  }

  // 헛발은 지나온 빈 칸이 있어도 붙지 않는다 — 떨어진 타일이 공중에 남을 수 없다
  if (missed) return { snap: null, path, bounces, missed };
  return { snap: attachedSnap(cells, geom, hit, lastEmpty, { x, y }), path, bounces, missed };
}

/**
 * 충돌 칸에 **실제로 붙는** 스냅 칸.
 *
 * 마지막으로 지나온 빈 칸이 충돌 칸의 이웃이면 그대로 쓴다. 이웃이 아닐 때가 있다 —
 * 벽 근처 홀수 행에는 `inBounds`가 거르는 반 칸이 있고, 발사체가 그 칸을 지나는 동안은
 * 빈 칸으로 세지 않기 때문에 그 직전 칸이 남는다. 거기 붙이면 점유 칸과 떨어져 있어
 * 낙하 판정이 곧바로 걷어 간다 — QA에서 「쏜 타일이 없어진다」로 보였다.
 *
 * 그럴 때는 충돌 칸의 빈 이웃 중 **착탄점에 가장 가까운 칸**에 붙인다. 이웃이 하나도
 * 비어 있지 않으면 마지막 빈 칸으로 돌아간다 — 안 붙는 것보다 낫다.
 *
 * 지나온 빈 칸이 아예 없으면(발사 지점부터 막혀 있다) 예전처럼 스냅하지 않는다 —
 * 그 판은 이미 실패 행에 닿은 판이고, 여기서 억지로 붙이면 판이 밖으로 자란다.
 */
function attachedSnap(
  cells: Map<string, Cell>,
  geom: BoardGeom,
  hit: Axial | null,
  lastEmpty: Axial | null,
  impact: { x: number; y: number },
): Axial | null {
  if (!hit || !lastEmpty) return lastEmpty;
  const around = neighbors(hit);
  if (around.some((n) => n.q === lastEmpty.q && n.r === lastEmpty.r)) return lastEmpty;

  let best: Axial | null = null;
  let bestD = Infinity;
  for (const n of around) {
    if (!inBounds(n, geom.cols, geom.rows) || cells.has(key(n))) continue;
    const p = toPixel(n, geom.size);
    const d = (p.x - impact.x) ** 2 + (p.y - impact.y) ** 2;
    if (d < bestD) {
      bestD = d;
      best = n;
    }
  }
  return best ?? lastEmpty;
}
