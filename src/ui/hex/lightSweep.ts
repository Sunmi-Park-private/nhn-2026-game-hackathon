// ui/hex/lightSweep.ts — 맞은 타일 위를 밝은 띠가 **한 번** 지나간다.
//
// 왜 있나: 터진 타일이 곧바로 떨어지기만 하면 「맞았다」와 「사라졌다」가 한 동작으로
// 뭉친다. 띠가 한 번 훑고 지나가면 그 타일이 이번 발에 맞은 그것이라는 게 읽힌다.
//
// **낙하와 겹쳐 재생한다.** 멈췄다 떨어지게 하면 한 발마다 0.2초가 붙어 연사 감각이
// 죽는다 — 조각이 떨어지는 동안 그 위에서 돈다(QA 선택).
//
// 마스크는 사각형이 아니라 **육각**이다. 사각형이면 띠가 육각 바깥 모서리에서
// 잘린 네모로 삐져나온다.
import { Container, Graphics } from "pixi.js";

/** 띠가 타일을 가로지르는 데 걸리는 시간(ms). 한 번만 돈다. */
export const SWEEP_MS = 240;

/** 띠의 기울기(도). 0이면 세로 띠가 가로로 지나간다 — 살짝 눕혀야 「빛」으로 읽힌다. */
const TILT_DEG = 20;

/** pointy-top 육각의 꼭짓점. 반지름 r, 위쪽에 꼭짓점이 온다. */
function hexPoints(r: number): number[] {
  const out: number[] = [];
  for (let k = 0; k < 6; k += 1) {
    const a = ((60 * k - 90) * Math.PI) / 180;
    out.push(Math.cos(a) * r, Math.sin(a) * r);
  }
  return out;
}

/**
 * `target` 위에 띠를 한 번 흘린다. 애니메이션이 끝나면 스스로 지운다.
 *
 * target이 도중에 파괴돼도(파편이 사라지는 중) 조용히 멈춘다 — 파편의 수명과
 * 띠의 수명이 다르므로 이 확인이 없으면 rAF 콜백 안에서 예외가 난다.
 *
 * @param radius 타일의 육각 반지름(논리 px)
 */
export function playLightSweep(target: Container, radius: number): void {
  if (target.destroyed) return;

  const fx = new Container();
  target.addChild(fx);

  const mask = new Graphics().poly(hexPoints(radius)).fill({ color: 0xffffff });
  fx.addChild(mask);
  fx.mask = mask;

  const band = new Container();
  band.rotation = (TILT_DEG * Math.PI) / 180;
  const h = radius * 3; // 기울여도 위아래로 남지 않게 넉넉히
  // 넓고 옅은 띠 + 가운데 좁고 밝은 심. 둘이 겹쳐야 「번쩍」이 아니라 「스쳤다」가 된다.
  band.addChild(new Graphics().rect(-radius * 0.42, -h / 2, radius * 0.84, h).fill({ color: 0xffffff, alpha: 0.22 }));
  band.addChild(new Graphics().rect(-radius * 0.13, -h / 2, radius * 0.26, h).fill({ color: 0xffffff, alpha: 0.5 }));
  fx.addChild(band);

  const from = -radius * 1.6;
  const to = radius * 1.6;
  band.x = from;

  const start = performance.now();
  const tick = (): void => {
    if (fx.destroyed || target.destroyed) return;
    const t = Math.min(1, (performance.now() - start) / SWEEP_MS);
    band.x = from + (to - from) * t;
    // 양 끝에서 흐려진다 — 띠가 툭 나타났다 툭 사라지면 눈에 걸린다
    band.alpha = Math.sin(Math.PI * t);
    if (t < 1) { requestAnimationFrame(tick); return; }
    fx.mask = null; // 마스크를 걸어 둔 채 지우면 target에 마스크가 남는다
    fx.destroy({ children: true });
  };
  requestAnimationFrame(tick);
}
