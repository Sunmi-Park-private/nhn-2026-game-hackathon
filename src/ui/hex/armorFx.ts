// ui/hex/armorFx.ts — 말발굽 타일이 맞았을 때의 연출.
//
// 규칙은 engine/hex/pop.ts에 있다. 여기는 그 결과를 눈에 보이게만 한다:
// 겹이 남았으면 **버틴다**(흔들림), 0이 되면 **말발굽이 떨어진다**.
// 둘을 다르게 보여야 「한 번 더 때리면 사라진다」가 읽힌다.
import { Container } from "pixi.js";
import { makeArmorOverlay } from "./tileArt";
import { HEX_SIZE } from "./geom";

/** 버티는 흔들림. 짧고 잦아야 「막았다」로 읽힌다 — 길면 무너지는 것처럼 보인다. */
const SHAKE_MS = 190;
const SHAKE_AMP = 3.2;
const SHAKE_HZ = 22;
/** 말발굽이 떨어지는 시간. */
const FALL_MS = 380;
const FALL_DIST = HEX_SIZE * 2.6;

export interface ArmorHit {
  /** 맞은 칸의 화면 좌표 */
  x: number;
  y: number;
  /** 맞고 난 뒤 남은 겹. 0이면 말발굽이 떨어진다 */
  armorLeft: number;
  /** 맞은 칸의 표시 객체. 없으면 흔들림은 건너뛴다 */
  view?: Container;
}

/** 흔들림 진폭 — 시간이 갈수록 잦아든다. */
function shakeAt(elapsed: number): number {
  if (elapsed >= SHAKE_MS) return 0;
  const t = 1 - elapsed / SHAKE_MS;
  return Math.sin((elapsed / 1000) * Math.PI * 2 * SHAKE_HZ) * SHAKE_AMP * t;
}

/** 낙하 — 처음엔 느리고 뒤로 갈수록 빨라진다(중력). */
function fallAt(t: number): { dy: number; alpha: number; rot: number } {
  return { dy: FALL_DIST * t * t, alpha: 1 - t * t, rot: t * 1.4 };
}

/**
 * 맞은 칸들을 한 번에 연출한다.
 *
 * 흔들림은 **판을 다시 그리기 전**의 표시 객체에 건다 — 다시 그리면 말발굽이 이미
 * 벗겨진 그림으로 바뀌어 「버텼다」가 보이지 않는다.
 */
export async function playArmorHits(
  fx: Container,
  hits: readonly ArmorHit[],
  /** 흔들림이 끝난 뒤 부른다. 여기서 판을 다시 그려야 벗겨진 그림으로 바뀐다. */
  afterShake: () => void,
): Promise<void> {
  if (hits.length === 0) {
    afterShake();
    return;
  }
  const views = hits.map((h) => h.view).filter((v): v is Container => v !== undefined);
  const baseX = views.map((v) => v.x);

  const t0 = performance.now();
  await new Promise<void>((resolve) => {
    const tick = (): void => {
      const elapsed = performance.now() - t0;
      const dx = shakeAt(elapsed);
      views.forEach((v, i) => {
        if (!v.destroyed) v.x = baseX[i]! + dx;
      });
      if (elapsed >= SHAKE_MS) {
        views.forEach((v, i) => {
          if (!v.destroyed) v.x = baseX[i]!;
        });
        resolve();
        return;
      }
      requestAnimationFrame(tick);
    };
    tick();
  });

  // 흔들림이 끝났으니 이제 벗겨진 그림으로 바꾼다.
  afterShake();

  // 겹이 0이 된 칸에서만 말발굽이 떨어진다.
  const falling = hits.filter((h) => h.armorLeft <= 0);
  if (falling.length === 0) return;

  const shoes = falling.map((h) => {
    const s = makeArmorOverlay();
    s.x = h.x;
    s.y = h.y;
    fx.addChild(s);
    return { node: s, y0: h.y };
  });

  const f0 = performance.now();
  await new Promise<void>((resolve) => {
    const tick = (): void => {
      const t = Math.min(1, (performance.now() - f0) / FALL_MS);
      const { dy, alpha, rot } = fallAt(t);
      for (const s of shoes) {
        if (s.node.destroyed) continue;
        s.node.y = s.y0 + dy;
        s.node.alpha = alpha;
        s.node.rotation = rot;
      }
      if (t >= 1) {
        for (const s of shoes) if (!s.node.destroyed) s.node.destroy();
        resolve();
        return;
      }
      requestAnimationFrame(tick);
    };
    tick();
  });
}
