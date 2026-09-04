// engine/hex/cageFaces.ts — 케이지 둘레를 6면으로 나눈다.
//
// 구출 조건은 원래 「둘레 12칸이 전부 비어야 함」이었다. 그런데 발사대가 판 아래에
// 있어서 **케이지 위쪽 칸은 조준으로 닿지 않는다** — 그 위를 지나가려면 케이지를
// 먼저 통과해야 하는데 케이지가 발사체를 막는다. 아래에서 쏘는 한 영원히 못 깬다.
//
// 그래서 상단 한 면을 조건에서 뺀다. 나머지 5면을 다 걷어내면 잠금이 풀린다.
// 상단 면은 사라지는 대신 **진행도 표시기**가 된다 — 한 면이 열릴 때마다 금이 간다.
import { key, neighbors, ring, toPixel } from "./coords";
import type { Axial, Cage, Cell } from "./types";

/** 한 면을 이루는 칸 수. 반지름 2 링은 12칸 = 6면 × 2칸이다. */
const FACE_SIZE = 2;
export const FACE_COUNT = 6;
/** 잠금을 풀기 위해 걷어내야 하는 면 수 — 상단 한 면을 뺀 나머지. */
export const FACES_TO_OPEN = FACE_COUNT - 1;

/**
 * 케이지 덩어리의 중심 칸. 이웃 6칸이 전부 케이지인 칸이 중심이다.
 * 그런 칸이 없으면(한 칸짜리·일자형 케이지) null — 호출부가 예전 규칙으로 되돌아간다.
 */
export function cageCenter(cage: Cage): Axial | null {
  const own = new Set(cage.cells.map(key));
  for (const c of cage.cells) {
    if (neighbors(c).every((n) => own.has(key(n)))) return c;
  }
  return null;
}

/**
 * 둘레를 6면으로 나눈다. 각 면은 이웃한 2칸이다.
 *
 * ring()이 둘레를 한 바퀴 걸어가며 순서대로 돌려주므로, 나온 순서대로 2칸씩
 * 끊으면 그대로 6면이 된다 — 각도를 다시 계산할 필요가 없다.
 * 중심을 못 찾으면 빈 배열.
 */
export function cageFaces(cage: Cage): Axial[][] {
  const center = cageCenter(cage);
  if (!center) return [];
  const perimeter = ring(center, 2);
  if (perimeter.length !== FACE_COUNT * FACE_SIZE) return [];

  const faces: Axial[][] = [];
  for (let i = 0; i < perimeter.length; i += FACE_SIZE) {
    faces.push(perimeter.slice(i, i + FACE_SIZE));
  }
  return faces;
}

/** 가장 위에 있는 면의 인덱스. 화면 y가 가장 작은(위쪽) 면이다. */
export function topFaceIndex(faces: Axial[][]): number {
  let best = 0;
  let bestY = Infinity;
  faces.forEach((face, i) => {
    // size는 비교에만 쓰므로 1로 둔다 — 실제 픽셀 크기와 무관하게 순서는 같다
    const y = face.reduce((sum, a) => sum + toPixel(a, 1).y, 0) / face.length;
    if (y < bestY) {
      bestY = y;
      best = i;
    }
  });
  return best;
}

/** 잠금 진행도. 상단을 뺀 5면 중 **완전히 빈** 면의 수(0…5)와 상단 면 좌표. */
export interface CageProgress {
  /** 열린 면 수 */
  opened: number;
  /** 열어야 하는 면 수 — 항상 FACES_TO_OPEN */
  needed: number;
  /** 진행도를 표시할 상단 면의 칸들. 규칙에서는 제외된다 */
  topFace: Axial[];
  /** 6면 구조를 못 만든 케이지 — 예전 규칙(둘레 전부 비우기)으로 판정한다 */
  fallback: boolean;
}

export function cageProgress(cells: Map<string, Cell>, cage: Cage): CageProgress {
  const faces = cageFaces(cage);
  if (faces.length === 0) {
    return { opened: 0, needed: FACES_TO_OPEN, topFace: [], fallback: true };
  }
  const top = topFaceIndex(faces);
  let opened = 0;
  faces.forEach((face, i) => {
    if (i === top) return;
    if (face.every((a) => !cells.has(key(a)))) opened += 1;
  });
  return { opened, needed: FACES_TO_OPEN, topFace: faces[top]!, fallback: false };
}

/** 잠금이 풀렸는가 — 상단을 뺀 5면이 전부 비었는가. */
export function isUnlocked(cells: Map<string, Cell>, cage: Cage): boolean {
  const p = cageProgress(cells, cage);
  return !p.fallback && p.opened >= p.needed;
}
