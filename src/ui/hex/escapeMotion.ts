// ui/hex/escapeMotion.ts — 구출 안무의 계산. 순수 TS라 헤드리스로 테스트한다.
//
// 두 몸이 같은 박자를 나눠 쓴다.
//   ① 창살 — 좌우로 자글자글 흔들리다 회전하며 아래로 떨어진다
//   ② 동물 — 창살이 있던 자리 한가운데에서 **격자 한 칸 크기**로 떨어지기 시작해,
//      바닥(우리 하단 경계)에 가까워질수록 커지고, 닿으면 오른쪽으로 빠르게 걸어 나간다
//
// 커지는 이유는 원근이다. 판은 위에서 내려다보는 그림이고 바닥은 카메라 쪽이다 —
// 다가올수록 커야 「갇혀 있던 게 나왔다」로 읽힌다.

// ── 창살 ────────────────────────────────────────────────────
/** 흔들리는 시간(ms). 이 뒤에 떨어지기 시작한다. */
export const CAGE_SHAKE_MS = 420;
/** 흔들림 최대 진폭(px). */
export const CAGE_SHAKE_AMP = 5.5;
/** 흔들림 진동수(Hz). */
export const CAGE_SHAKE_HZ = 9;
/** 떨어져 사라지기까지(ms). */
export const CAGE_DROP_MS = 540;
/** 낙하 거리(px). 화면 밖까지 갈 필요는 없다 — 그 전에 다 흐려진다. */
export const CAGE_DROP_DIST = 260;

/**
 * 창살의 가로 흔들림. 세기는 **끝으로 갈수록 커진다** — 버티다 못해 떨어지는
 * 순서라야 낙하가 결과로 읽힌다. 처음부터 크게 흔들면 낙하가 갑작스럽다.
 * @param elapsedMs 해제 직후부터 흐른 시간
 */
export function cageShakeX(elapsedMs: number): number {
  if (elapsedMs < 0 || elapsedMs >= CAGE_SHAKE_MS) return 0;
  const t = elapsedMs / CAGE_SHAKE_MS;
  return Math.sin((elapsedMs / 1000) * Math.PI * 2 * CAGE_SHAKE_HZ) * CAGE_SHAKE_AMP * t;
}

/** 창살의 낙하. 흔들림이 끝난 뒤부터 자유낙하처럼 가속한다. */
export function cageDropY(elapsedMs: number): number {
  const t = clamp01((elapsedMs - CAGE_SHAKE_MS) / CAGE_DROP_MS);
  return CAGE_DROP_DIST * t * t;
}

/** 창살이 떨어지며 도는 각도(rad). 한쪽으로 기운다 — 정면으로 내려가면 무게가 없다. */
export function cageDropRot(elapsedMs: number): number {
  const t = clamp01((elapsedMs - CAGE_SHAKE_MS) / CAGE_DROP_MS);
  return 0.9 * t * t;
}

/** 창살의 투명도. 낙하 후반에 사그라든다. */
export function cageDropAlpha(elapsedMs: number): number {
  const t = clamp01((elapsedMs - CAGE_SHAKE_MS) / CAGE_DROP_MS);
  return 1 - clamp01((t - 0.35) / 0.65);
}

/** 창살 연출 전체 길이(ms). */
export const CAGE_TOTAL_MS = CAGE_SHAKE_MS + CAGE_DROP_MS;

// ── 동물 ────────────────────────────────────────────────────
/** 한 창살에서 나오는 마릿수. */
export const ANIMAL_COUNT = 4;
/** 마리마다 나오는 간격(ms). 한꺼번에 쏟아지면 마릿수가 안 읽힌다. */
export const ANIMAL_STAGGER_MS = 130;
/** 바닥까지 떨어지는 시간(ms). */
export const FALL_MS = 620;
/** 출발 배율. 1이면 **격자 한 칸**이다 — 창살 안에 있던 크기 그대로 나온다. */
export const START_SCALE = 1;
/** 착지 배율. 카메라 쪽으로 다가온 만큼 커진다. */
export const LAND_SCALE = 2.9;
/** 착지 뒤 오른쪽으로 걷는 속도(px/s). 「빠르게 빠져나간다」다. */
export const WALK_SPEED = 265;
/** 걸을 때 위아래로 흔들리는 폭(px)과 진동수(Hz). 발소리 대신이다. */
export const WALK_BOB_PX = 3.2;
export const WALK_BOB_HZ = 4.4;

export type EscapePhase = "wait" | "fall" | "walk" | "dead";

export interface EscapeBody {
  x: number;
  y: number;
  /** 표시 배율. 1 = 격자 한 칸 */
  scale: number;
  alpha: number;
  phase: EscapePhase;
  /** 태어난 뒤 흐른 시간(ms) */
  age: number;
  /** 이 마리가 나오기까지 기다리는 시간(ms) */
  delay: number;
  /** 떨어지는 동안 옆으로 벌어지는 거리(px) */
  spread: number;
}

/** 동물이 노는 방. */
export interface EscapeArena {
  /** 창살이 있던 자리 한가운데 — 모든 마리의 앵커다 */
  anchor: { x: number; y: number };
  /** 바닥. 타일이 깔려 있던 배경 울타리의 하단 경계다 */
  floorY: number;
  /** 이 x를 넘어가면 화면을 벗어난 것으로 본다 */
  exitX: number;
}

function clamp01(v: number): number {
  return v < 0 ? 0 : v > 1 ? 1 : v;
}

/**
 * i번째 동물을 만든다. 전부 창살 한가운데에서 출발하고, 떨어지는 동안만
 * 조금씩 옆으로 벌어진다 — 앵커가 하나라야 「거기서 나왔다」로 읽힌다.
 */
export function spawnEscape(i: number, count: number, arena: EscapeArena): EscapeBody {
  // -1 … 1 로 고르게 펼친다. 한 마리뿐이면 가운데.
  const t = count > 1 ? (i / (count - 1) - 0.5) * 2 : 0;
  return {
    x: arena.anchor.x,
    y: arena.anchor.y,
    scale: START_SCALE,
    alpha: 0,
    phase: "wait",
    age: 0,
    delay: i * ANIMAL_STAGGER_MS,
    spread: t * 34,
  };
}

/**
 * 동물 하나를 dtSec초만큼 전진시킨다. `body`를 제자리에서 고친다.
 *
 * 낙하는 y가 시간의 **제곱**으로 간다(중력). 배율은 같은 t로 선형 보간한다 —
 * 배율까지 제곱으로 하면 마지막 순간에만 갑자기 커져 「튀어나온다」로 보인다.
 */
export function stepEscape(body: EscapeBody, dtSec: number, arena: EscapeArena): void {
  if (body.phase === "dead") return;
  body.age += dtSec * 1000;

  if (body.phase === "wait") {
    if (body.age < body.delay) return;
    body.phase = "fall";
  }

  if (body.phase === "fall") {
    const t = clamp01((body.age - body.delay) / FALL_MS);
    body.alpha = Math.min(1, t * 5);
    body.x = arena.anchor.x + body.spread * t;
    body.y = arena.anchor.y + (arena.floorY - arena.anchor.y) * t * t;
    body.scale = START_SCALE + (LAND_SCALE - START_SCALE) * t;
    if (t >= 1) {
      body.phase = "walk";
      body.y = arena.floorY;
      body.scale = LAND_SCALE;
    }
    return;
  }

  // 걷기 — 바닥을 따라 오른쪽으로 빠져나간다
  body.x += WALK_SPEED * dtSec;
  const walkMs = body.age - body.delay - FALL_MS;
  body.y = arena.floorY + Math.sin((walkMs / 1000) * Math.PI * 2 * WALK_BOB_HZ) * WALK_BOB_PX;
  if (body.x >= arena.exitX) {
    body.alpha = 0;
    body.phase = "dead";
  }
}

/**
 * 이 안무가 끝나기까지 걸리는 시간(ms). 호출부가 얼마나 기다릴지 정할 때 쓴다.
 * 마지막 마리가 나와 바닥에 닿고, 걸어서 나가는 거리까지 센다.
 */
export function escapeDurationMs(count: number, arena: EscapeArena): number {
  const walkDist = Math.max(0, arena.exitX - arena.anchor.x);
  return (count - 1) * ANIMAL_STAGGER_MS + FALL_MS + (walkDist / WALK_SPEED) * 1000;
}
