// ui/hex/launcher.ts — 조준선, 장전 표시, 발사 비행 연출.
// 입력 처리는 stageScreen이 맡고 여기는 그리기와 각도 계산만 한다.
import { Container, Graphics } from "pixi.js";
import { simulateShot } from "../../engine/hex/shot";
import type { Cell, Tier } from "../../engine/hex/types";
import { BOARD, ORIGIN, launchOrigin, launchOriginLocal } from "./geom";
import { TIER_COLORS, drawTileFallback } from "./tileArt";

/** 조준 각도 한계 — 수평 근처로 쏘면 판이 성립하지 않는다. */
const MAX_ANGLE = 1.25; // 약 72°

export interface Launcher {
  root: Container;
  setLoaded(tier: Tier): void;
  /** 포인터 위치로 조준하고 궤적 점선을 그린다. */
  aimAt(x: number, y: number, cells: Map<string, Cell>): void;
  clearAim(): void;
  angle(): number;
  playFlight(path: Array<{ x: number; y: number }>, tier: Tier): Promise<void>;
  destroy(): void;
}

export function createLauncher(): Launcher {
  const root = new Container();
  const guide = new Graphics();
  root.addChild(guide);

  const loadedSlot = new Container();
  const origin = launchOrigin();
  loadedSlot.x = origin.x;
  loadedSlot.y = origin.y;
  root.addChild(loadedSlot);

  const flight = new Container();
  root.addChild(flight);

  let currentAngle = 0;
  let loadedTier: Tier = 0;

  function redrawLoaded(): void {
    loadedSlot.removeChildren().forEach((c) => c.destroy());
    loadedSlot.addChild(drawTileFallback(TIER_COLORS[loadedTier] ?? 0x888888));
  }
  redrawLoaded();

  return {
    root,

    setLoaded(tier: Tier): void {
      loadedTier = tier;
      redrawLoaded();
    },

    aimAt(x: number, y: number, cells: Map<string, Cell>): void {
      const dx = x - origin.x;
      const dy = y - origin.y;
      // 위쪽으로만 쏜다 — 아래를 가리키면 수평 한계로 잘라낸다
      const raw = Math.atan2(dx, -dy);
      currentAngle = Math.max(-MAX_ANGLE, Math.min(MAX_ANGLE, raw));

      const { path } = simulateShot(cells, BOARD, launchOriginLocal(), currentAngle);
      guide.clear();
      // 점선 — 4스텝마다 한 점씩 찍는다
      for (let i = 0; i < path.length; i += 4) {
        const p = path[i]!;
        guide.circle(ORIGIN.x + p.x, ORIGIN.y + p.y, 3).fill({ color: 0xffffff, alpha: 0.55 });
      }
    },

    clearAim(): void {
      guide.clear();
    },

    angle(): number {
      return currentAngle;
    },

    async playFlight(path: Array<{ x: number; y: number }>, tier: Tier): Promise<void> {
      if (path.length === 0) return;

      const chip = drawTileFallback(TIER_COLORS[tier] ?? 0x888888);
      flight.addChild(chip);

      const durationMs = Math.min(420, 60 + path.length * 1.2);
      const start = performance.now();

      try {
        await new Promise<void>((resolve) => {
          const tick = (): void => {
            // 비행 도중 파괴됐으면 조용히 끝낸다 — Pixi가 _position을 null로 만들어 두므로
            // 여기서 막지 않으면 rAF 콜백 안에서 예외가 터지고 resolve가 영영 호출되지 않는다.
            if (chip.destroyed) {
              resolve();
              return;
            }
            const t = Math.min(1, (performance.now() - start) / durationMs);
            const p = path[Math.min(path.length - 1, Math.floor(t * (path.length - 1)))]!;
            chip.x = ORIGIN.x + p.x;
            chip.y = ORIGIN.y + p.y;
            if (t < 1) requestAnimationFrame(tick);
            else resolve();
          };
          tick();
        });
      } finally {
        if (!chip.destroyed) chip.destroy();
      }
    },

    destroy(): void {
      root.destroy({ children: true });
    },
  };
}
