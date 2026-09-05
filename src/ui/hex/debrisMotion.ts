// ui/hex/debrisMotion.ts — 떨어져 나간 타일의 물리. 순수 계산이라 헤드리스로 테스트한다.
//
// 터진 타일과 받침을 잃은 타일이 그냥 사라지면 「없어졌다」는 알겠는데 **무슨 일이
// 일어났는지**가 안 읽힌다. 그래서 떨어뜨린다: 우리 바닥까지 낙하 → 한 번 튕김 →
// 좌우 아무 쪽으로 굴러가며 흐려짐.
//
// 구르는 방향은 타일마다 랜덤이다. 전부 같은 쪽으로 가면 물리가 아니라 「연출」로
// 읽힌다 — 흩어져야 파편이다.
//
// Pixi를 import하지 않는다(규약 5조와 같은 이유 — 눈으로 확인하기 어려운 계산은
// 스크린샷이 아니라 값으로 검사한다).

/** 중력(px/s²). 논리 450×800 좌표계 기준이다. */
export const GRAVITY = 1900;
/** 바닥 반발 계수. 한 번 통 튀고 마는 정도. */
export const FLOOR_BOUNCE = 0.34;
/** 좌우 벽 반발 계수. 바닥보다 잘 튕긴다 — 나무 벽이라. */
export const WALL_BOUNCE = 0.5;
/** 이보다 느리게 바닥에 닿으면 튀지 않고 곧바로 구르기로 넘어간다(px/s). */
export const SETTLE_SPEED = 90;
/** 구르는 동안의 감속(px/s²). 마찰이다. */
export const ROLL_FRICTION = 210;
/** 굴러가기 시작하는 속력의 범위(px/s). */
export const ROLL_SPEED_MIN = 110;
export const ROLL_SPEED_MAX = 230;
/** 구르기 시작한 뒤 완전히 사라지기까지(ms). */
export const FADE_MS = 620;
/** 안전장치 — 어떤 조각도 이보다 오래 살지 않는다(ms). */
export const MAX_LIFE_MS = 3200;

/** 한 조각이 지금 무엇을 하는 중인가. */
export type DebrisPhase = "fall" | "roll" | "dead";

export interface DebrisBody {
  x: number;
  y: number;
  vx: number;
  vy: number;
  /** 라디안. 구를 때는 미끄러지지 않게 이동거리에서 파생시킨다 */
  rot: number;
  /** 낙하 중 회전 속도(rad/s). 구르기로 넘어가면 안 쓴다 */
  spin: number;
  phase: DebrisPhase;
  /** 살아 있은 시간(ms) */
  age: number;
  /** 구르기 시작한 시각(ms). -1이면 아직 낙하 중 */
  rollAt: number;
  alpha: number;
}

/** 조각이 노는 방. 우리는 아래로 갈수록 벌어지므로 좌우 벽은 높이의 함수다. */
export interface DebrisArena {
  /** 조각의 반지름. 벽·바닥과의 간격이자 구르기 회전의 기준이다 */
  radius: number;
  /** 이 높이에서의 우리 좌우 안쪽 x */
  edges: (y: number) => { left: number; right: number };
  /** 바닥 — 타일이 깔려 있던 배경 울타리의 하단 경계 */
  floor: number;
}

/** 발사체가 터진 자리에서 바깥으로 튀는 초기 속도. `rand`는 [0,1)을 돌려준다. */
export function spawnDebris(
  at: { x: number; y: number },
  from: { x: number; y: number },
  rand: () => number,
): DebrisBody {
  // 착탄점에서 멀어지는 방향. 착탄점과 완전히 겹치면 방향이 없으므로 위로 튄다.
  const dx = at.x - from.x;
  const dy = at.y - from.y;
  const len = Math.hypot(dx, dy);
  const ux = len > 0.001 ? dx / len : 0;
  const uy = len > 0.001 ? dy / len : -1;
  const speed = 60 + rand() * 130;
  return {
    x: at.x,
    y: at.y,
    vx: ux * speed + (rand() - 0.5) * 40,
    // 위로 살짝 띄운다 — 곧바로 떨어지면 「터졌다」가 아니라 「꺼졌다」로 보인다
    vy: uy * speed - 120 - rand() * 90,
    rot: 0,
    spin: (rand() - 0.5) * 12,
    phase: "fall",
    age: 0,
    rollAt: -1,
    alpha: 1,
  };
}

/** 구르기 시작 속도. 방향은 좌우 **랜덤**이고 크기도 조각마다 다르다. */
export function rollVelocity(rand: () => number): number {
  const dir = rand() < 0.5 ? -1 : 1;
  return dir * (ROLL_SPEED_MIN + rand() * (ROLL_SPEED_MAX - ROLL_SPEED_MIN));
}

/**
 * 조각 하나를 dt초만큼 전진시킨다. `body`를 제자리에서 고친다.
 *
 * 낙하 중에는 자유낙하 + 좌우 벽 반사, 바닥에 느리게 닿으면 구르기로 넘어간다.
 * 구르는 동안 회전은 **이동거리 ÷ 반지름**이다 — 미끄러지면 굴러가는 것으로 안 보인다.
 *
 * @param rand 구르기 방향·속도를 뽑는다. 바닥에 처음 닿는 순간에만 쓴다.
 */
export function stepDebris(body: DebrisBody, dtSec: number, arena: DebrisArena, rand: () => number): void {
  if (body.phase === "dead") return;

  body.age += dtSec * 1000;
  const groundY = arena.floor - arena.radius;

  if (body.phase === "fall") {
    body.vy += GRAVITY * dtSec;
    body.x += body.vx * dtSec;
    body.y += body.vy * dtSec;
    body.rot += body.spin * dtSec;

    const { left, right } = arena.edges(body.y);
    if (body.x - arena.radius < left) {
      body.x = left + arena.radius;
      body.vx = Math.abs(body.vx) * WALL_BOUNCE;
    } else if (body.x + arena.radius > right) {
      body.x = right - arena.radius;
      body.vx = -Math.abs(body.vx) * WALL_BOUNCE;
    }

    if (body.y >= groundY) {
      body.y = groundY;
      if (body.vy < SETTLE_SPEED) {
        // 힘없이 닿았다 — 튀지 않고 바로 구른다
        body.phase = "roll";
        body.rollAt = body.age;
        body.vx = rollVelocity(rand);
        body.vy = 0;
      } else {
        body.vy = -body.vy * FLOOR_BOUNCE;
        body.vx *= 0.8;
      }
    }
  } else {
    // 구르기 — 마찰로 줄어드는 속도만큼 굴러가고, 그만큼 회전한다
    const decel = ROLL_FRICTION * dtSec;
    if (Math.abs(body.vx) <= decel) body.vx = 0;
    else body.vx -= Math.sign(body.vx) * decel;

    const moved = body.vx * dtSec;
    body.x += moved;
    body.y = groundY;
    body.rot += moved / arena.radius;

    const { left, right } = arena.edges(body.y);
    if (body.x - arena.radius < left) {
      body.x = left + arena.radius;
      body.vx = Math.abs(body.vx) * WALL_BOUNCE;
    } else if (body.x + arena.radius > right) {
      body.x = right - arena.radius;
      body.vx = -Math.abs(body.vx) * WALL_BOUNCE;
    }

    body.alpha = 1 - Math.min(1, (body.age - body.rollAt) / FADE_MS);
    if (body.alpha <= 0) body.phase = "dead";
  }

  if (body.age >= MAX_LIFE_MS) body.phase = "dead";
}
