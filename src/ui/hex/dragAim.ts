// ui/hex/dragAim.ts — 새총 조준. 포인터 좌표에서 각도와 파워만 뽑는다.
//
// 그리지 않고 Pixi도 모른다(좌표만 받는다) — 그래서 헤드리스로 테스트된다.
// 화면 전환 상태를 모듈 전역에 두지 않는다(규약 4조): 팩토리 클로저에 담는다.
//
// 규칙 하나로 각도와 파워가 같이 나온다. 앵커(말 하단 중앙)에서 손끝으로 가는
// 벡터를 v라 할 때 **발사 방향은 -v**다. 활·새총과 같은 규칙이라 설명이 필요 없다.

export interface Point { x: number; y: number }

export interface Aim {
  /** 0 = 똑바로 위, 양수 = 오른쪽 기울기(라디안). 엔진의 각도 규약과 같다 */
  angle: number;
  /** 0~1 */
  power: number;
}

/** 조준 각도 한계 — 수평 근처로 쏘면 판이 성립하지 않는다. 기존 launcher와 같은 값. */
export const MAX_ANGLE = 1.25; // 약 72°

/** 이 거리 안에서 떼면 발사하지 않는다 — 판을 톡 건드린 사고로 쏘지 않는다. */
export const DEAD_ZONE = 16;

/** 파워가 1에 닿는 당김 거리. 더 끌어도 파워는 그대로, 각도만 정밀해진다. */
export const MAX_PULL = 170;

const clamp = (v: number, lo: number, hi: number): number => (v < lo ? lo : v > hi ? hi : v);

/**
 * 조준 민감도 완화 계수(expo). 0이면 선형, 1이면 완전 세제곱.
 *
 * 선형이면 손끝이 조금만 움직여도 조준선과 말이 확 돌아 겨냥이 안 됐다.
 * 그렇다고 각도에 0.5를 곱하면 **최대 각도까지 못 간다** — 넓은 뱅크 샷이 죽는다.
 *
 * 그래서 RC 조종기의 expo 커브를 쓴다: `(1-e)·u + e·u³`.
 * 0.5에서 **중앙 기울기가 정확히 절반**(2배 더 끌어야 같은 각)이고, 끝(u=±1)에서는
 * 0.5 + 0.5 = 1이라 **최대 각도가 그대로 닿는다.** 둔해지는 것은 조준의 정밀한 구간뿐이다.
 */
export const AIM_EXPO = 0.5;

/** 정규화된 조준 입력(-1~1)에 expo를 먹인다. */
export function applyExpo(u: number): number {
  const c = clamp(u, -1, 1);
  return (1 - AIM_EXPO) * c + AIM_EXPO * c * c * c;
}

export interface DragAim {
  down(p: Point): void;
  move(p: Point): void;
  /** 손을 뗐다. 데드존에 못 미치면 null — 오발로 보고 취소한다 */
  up(p: Point): Aim | null;
  current(): Aim | null;
  cancel(): void;
}

export function createDragAim(anchor: Point): DragAim {
  let aim: Aim | null = null;
  let dragging = false;

  /** 앵커→손끝 벡터에서 조준을 만든다. 당긴 거리가 0이면 null. */
  function read(p: Point): Aim | null {
    const vx = p.x - anchor.x;
    const vy = p.y - anchor.y;
    const dist = Math.hypot(vx, vy);
    if (dist < 1e-6) return null;
    // 발사 방향 = -v. 각도 규약이 (x=sin, y=-cos)이므로 atan2(-vx, vy)다.
    // vy가 음수(앵커 위를 끌었다)면 아래를 향하는 각이 나오지만 클램프가 잡는다.
    const raw = clamp(Math.atan2(-vx, vy), -MAX_ANGLE, MAX_ANGLE);
    const angle = applyExpo(raw / MAX_ANGLE) * MAX_ANGLE;
    const power = clamp((dist - DEAD_ZONE) / (MAX_PULL - DEAD_ZONE), 0, 1);
    return { angle, power };
  }

  return {
    down(p: Point): void {
      dragging = true;
      aim = read(p);
    },

    move(p: Point): void {
      if (!dragging) return;
      aim = read(p);
    },

    up(p: Point): Aim | null {
      if (!dragging) return null;
      dragging = false;
      const dist = Math.hypot(p.x - anchor.x, p.y - anchor.y);
      aim = null;
      // 데드존 안이면 조준 자체가 없었던 것으로 본다
      if (dist < DEAD_ZONE) return null;
      return read(p);
    },

    current(): Aim | null {
      return aim;
    },

    cancel(): void {
      dragging = false;
      aim = null;
    },
  };
}
