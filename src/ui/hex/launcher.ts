// ui/hex/launcher.ts — 조준선, 장전 표시, 발사 비행 연출.
// 입력 처리는 stageScreen이 맡고 여기는 그리기와 각도 계산만 한다.
import { Container, Graphics, type Texture } from "pixi.js";
import { simulateShot } from "../../engine/hex/shot";
import type { Cell, Tier } from "../../engine/hex/types";
import { BOARD, ORIGIN, launchOrigin, launchOriginLocal } from "./geom";
import { TIER_COLORS, drawTileFallback } from "./tileArt";
import { makeSequence } from "../sequence";

/** 조준 각도 한계 — 수평 근처로 쏘면 판이 성립하지 않는다. */
const MAX_ANGLE = 1.25; // 약 72°

/** 조준선이 포인터를 따라가는 최대 각속도(라디안/ms).
 *
 *  예전엔 포인터 각도를 그대로 대입해 조준선이 순간이동했다 — 발사대 근처에서
 *  손을 조금만 움직여도 화면을 가로질러 휙 돌아가 눈으로 따라갈 수가 없었다.
 *  감도(각도÷입력거리)를 줄이는 방법은 쓰지 않았다. 절반으로 낮추면 화면 구석에서도
 *  약 53°까지밖에 안 닿아 MAX_ANGLE(72°)의 넓은 뱅크 샷이 통째로 사라진다.
 *  겨냥할 수 있는 범위는 그대로 두고 따라오는 속도에만 상한을 건다.
 *
 *  6 rad/s — 최대 폭(±72°, 2.5rad)을 끝에서 끝까지 도는 데 약 0.4초. */
const AIM_RATE_PER_MS = 6 / 1000;

export interface Launcher {
  root: Container;
  setLoaded(tier: Tier): void;
  /** 포인터 위치로 조준하고 궤적 점선을 그린다.
   *  조준선은 목표 각도로 즉시 튀지 않고 상한 속도로 따라간다.
   *  `snap`은 새 터치의 첫 접촉용 — 그 순간만 각도를 즉시 맞춘다. */
  aimAt(x: number, y: number, cells: Map<string, Cell>, snap?: boolean): void;
  clearAim(): void;
  angle(): number;
  playFlight(path: Array<{ x: number; y: number }>, tier: Tier): Promise<void>;
  destroy(): void;
}

/** 발사대에 선 붉은말의 크기. 셀 폭이 아니라 화면 기준으로 잡는다 —
 *  격자가 촘촘해져도 캐릭터가 같이 작아지면 안 된다. */
const HORSE_W = 190;
const HORSE_H = 190;

export function createLauncher(horseFrames: readonly Texture[] = []): Launcher {
  const root = new Container();
  const guide = new Graphics();
  root.addChild(guide);

  // 붉은말 — 발사 지점 뒤에 선다. 장전된 타일이 앞발 위에 놓이도록 조금 아래로 내린다.
  // 시퀀스가 없으면 아무것도 그리지 않는다 — 폴백 그림을 두면 아트가 왔을 때 겹친다.
  const origin = launchOrigin();
  const horse = makeSequence(horseFrames, HORSE_W, HORSE_H);
  if (horse) {
    horse.root.x = origin.x;
    horse.root.y = origin.y + HORSE_H * 0.28;
    root.addChild(horse.root);
    void horse.play({ fps: 12, loop: true });
  }

  const loadedSlot = new Container();
  loadedSlot.x = origin.x;
  loadedSlot.y = origin.y;
  root.addChild(loadedSlot);

  const flight = new Container();
  root.addChild(flight);

  let currentAngle = 0;
  let targetAngle = 0;
  let aimCells: Map<string, Cell> | null = null;
  let aimRaf = 0;
  let lastTick = 0;
  let loadedTier: Tier = 0;

  function redrawLoaded(): void {
    loadedSlot.removeChildren().forEach((c) => c.destroy());
    loadedSlot.addChild(drawTileFallback(TIER_COLORS[loadedTier] ?? 0x888888));
  }
  redrawLoaded();

  function drawGuide(): void {
    if (!aimCells) return;
    const { path } = simulateShot(aimCells, BOARD, launchOriginLocal(), currentAngle);
    guide.clear();
    // 점선 — 4스텝마다 한 점씩 찍는다
    for (let i = 0; i < path.length; i += 4) {
      const p = path[i]!;
      guide.circle(ORIGIN.x + p.x, ORIGIN.y + p.y, 3).fill({ color: 0xffffff, alpha: 0.55 });
    }
  }

  function stopAimLoop(): void {
    if (aimRaf !== 0) cancelAnimationFrame(aimRaf);
    aimRaf = 0;
  }

  /** 조준선을 목표 각도 쪽으로 상한 속도만큼 굴린다. 도착하면 스스로 멈춘다. */
  function startAimLoop(): void {
    if (aimRaf !== 0) return;
    lastTick = performance.now();
    const tick = (): void => {
      aimRaf = 0;
      if (guide.destroyed) return; // 화면이 내려간 뒤에는 아무것도 하지 않는다
      const now = performance.now();
      const step = (now - lastTick) * AIM_RATE_PER_MS;
      lastTick = now;
      const diff = targetAngle - currentAngle;
      if (Math.abs(diff) <= step) {
        currentAngle = targetAngle;
        drawGuide();
        return; // 목표에 붙었다 — 루프를 놓아준다
      }
      currentAngle += Math.sign(diff) * step;
      drawGuide();
      aimRaf = requestAnimationFrame(tick);
    };
    aimRaf = requestAnimationFrame(tick);
  }

  return {
    root,

    setLoaded(tier: Tier): void {
      loadedTier = tier;
      redrawLoaded();
    },

    aimAt(x: number, y: number, cells: Map<string, Cell>, snap = false): void {
      const dx = x - origin.x;
      const dy = y - origin.y;
      // 위쪽으로만 쏜다 — 아래를 가리키면 수평 한계로 잘라낸다
      const raw = Math.atan2(dx, -dy);
      targetAngle = Math.max(-MAX_ANGLE, Math.min(MAX_ANGLE, raw));
      aimCells = cells;
      // 새 터치의 첫 접촉은 즉시 맞춘다 — 그러지 않으면 탭한 곳이 아니라
      // 직전 조준 각도로 날아간다(탭으로 쏘는 조작이 어긋난다).
      if (snap) currentAngle = targetAngle;
      drawGuide();
      startAimLoop();
    },

    clearAim(): void {
      stopAimLoop();
      guide.clear();
    },

    angle(): number {
      return currentAngle;
    },

    async playFlight(path: Array<{ x: number; y: number }>, tier: Tier): Promise<void> {
      if (path.length === 0) return;

      const chip = drawTileFallback(TIER_COLORS[tier] ?? 0x888888);
      flight.addChild(chip);

      // 절반 속도 — 예전 값(상한 420ms, 60 + 길이×1.2)의 두 배다.
      const durationMs = Math.min(840, 120 + path.length * 2.4);
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
      stopAimLoop(); // rAF가 살아 있으면 파괴된 Graphics를 계속 만진다
      root.destroy({ children: true });
    },
  };
}
