// ui/sequence.ts — 이미지 시퀀스 재생. 프레임이 한 장이면 스틸이 된다.
//
// 아트가 스틸로 올지 시퀀스로 올지는 슬롯마다 다르고, 도중에 바뀌기도 한다.
// 화면 코드가 그 차이를 몰라도 되게 여기서 흡수한다 — 프레임 배열만 넘기면 된다.
import { Container, Sprite, type Texture } from "pixi.js";
import { fitContain } from "./skin";

export interface SequenceView {
  root: Container;
  /** 프레임을 처음부터 재생한다. loop=false면 마지막 프레임에서 멈춘 뒤 resolve된다. */
  play(opts?: { fps?: number; loop?: boolean }): Promise<void>;
  stop(): void;
  destroy(): void;
}

/** 프레임 목록으로 재생기를 만든다. 크기는 넘긴 값에 맞춰 늘린다(중심 정렬). */
export function makeSequence(frames: readonly Texture[], w: number, h: number): SequenceView | null {
  if (frames.length === 0) return null;

  const root = new Container();
  const sprite = new Sprite(frames[0]);
  sprite.anchor.set(0.5);
  fitContain(sprite, w, h); // 원본 비율 유지 — 프레임마다 크기가 달라도 찌그러지지 않는다
  root.addChild(sprite);

  let raf = 0;
  const stop = (): void => {
    if (raf !== 0) cancelAnimationFrame(raf);
    raf = 0;
  };

  return {
    root,

    play(opts): Promise<void> {
      const fps = opts?.fps ?? 24;
      const loop = opts?.loop ?? false;
      stop();
      // 한 장짜리는 재생할 것이 없다 — 그려 두고 바로 끝낸다
      if (frames.length === 1) {
        sprite.texture = frames[0]!;
        fitContain(sprite, w, h);
        return Promise.resolve();
      }
      return new Promise<void>((resolve) => {
        const start = performance.now();
        const tick = (): void => {
          raf = 0;
          if (sprite.destroyed) { resolve(); return; }
          const elapsed = (performance.now() - start) / 1000;
          const i = Math.floor(elapsed * fps);
          if (!loop && i >= frames.length) {
            sprite.texture = frames[frames.length - 1]!; // 마지막 프레임에서 멈춘다
            fitContain(sprite, w, h);
            resolve();
            return;
          }
          sprite.texture = frames[i % frames.length]!;
          fitContain(sprite, w, h);
          raf = requestAnimationFrame(tick);
        };
        tick();
      });
    },

    stop,

    destroy(): void {
      stop();
      if (!root.destroyed) root.destroy({ children: true });
    },
  };
}
