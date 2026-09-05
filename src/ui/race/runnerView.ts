// ui/race/runnerView.ts — 러너 한 마리.
//
// 시퀀스 아트가 0장이어도 걷기와 질주가 눈으로 갈려야 한다. 그래서 상하 바운스와
// 좌우 기울기의 **진폭을 리듬에 비례**시킨다 — 로비 friend()와 같은 원형 폴백 위에서도
// 천천히 누르면 뒤뚱거리고 빨리 누르면 몸이 앞으로 기운다.
import { Container, Graphics, Sprite, Text, type Texture } from "pixi.js";
import { fitSprite } from "../skin";

export interface RunnerViewOpts {
  /** 달리기 시퀀스. 비면 글리프 폴백 */
  frames: Texture[];
  glyph: string;
  size: number;
  /** 내가 조종하는 마리인가 — 테두리로 구분한다 */
  mine: boolean;
}

export interface RunnerView {
  node: Container;
  /** 화면 위치와 리듬을 준다. `spm`이 애니메이션 전부를 정한다 */
  update: (screenX: number, y: number, spm: number, dt: number) => void;
}

/** 리듬에 따른 초당 프레임 수. 걷기는 느긋하게, 질주는 다급하게. */
function fpsOf(spm: number): number {
  if (spm < 20) return 0;
  return 3 + (spm / 300) * 11; // 60spm≈5.2fps · 300spm≈14fps
}

export function createRunnerView(o: RunnerViewOpts): RunnerView {
  const node = new Container();
  const body = new Container();
  node.addChild(body);

  const sprites: Sprite[] = o.frames.map((t) => {
    const s = fitSprite(t, o.size, o.size);
    s.visible = false;
    body.addChild(s);
    return s;
  });

  if (sprites.length === 0) {
    const r = o.size / 2;
    const g = new Graphics().circle(0, 0, r).fill({ color: 0xf3e2c0, alpha: 0.95 });
    g.circle(0, 0, r).stroke({ width: 2, color: o.mine ? 0xc98a3c : 0x8a5a2b });
    body.addChild(g);
    const t = new Text({ text: o.glyph, style: { fontSize: o.size * 0.5 } });
    t.anchor.set(0.5);
    body.addChild(t);
  } else {
    sprites[0]!.visible = true;
  }

  if (o.mine) {
    // 내 마리를 못 찾으면 조작할 수가 없다 — 발밑에 표식을 둔다
    const ring = new Graphics()
      .ellipse(0, o.size * 0.44, o.size * 0.42, o.size * 0.12)
      .stroke({ width: 3, color: 0xffd66b, alpha: 0.9 });
    node.addChildAt(ring, 0);
  }

  let phase = 0;   // 걸음 위상 (0~1)
  let frame = 0;

  return {
    node,
    update: (screenX, y, spm, dt) => {
      node.x = screenX;
      node.y = y;

      const fps = fpsOf(spm);
      phase = (phase + fps * dt) % 1;

      if (sprites.length > 0) {
        const next = Math.floor(phase * sprites.length) % sprites.length;
        if (next !== frame) {
          sprites[frame]!.visible = false;
          sprites[next]!.visible = true;
          frame = next;
        }
      }

      // 진폭이 리듬에 비례한다 — 이게 폴백에서 걷기와 질주를 가르는 전부다
      const amp = Math.min(1, spm / 260);
      body.y = -Math.abs(Math.sin(phase * Math.PI * 2)) * o.size * 0.16 * amp;
      body.rotation = Math.sin(phase * Math.PI * 2) * 0.06 * amp + amp * 0.12;
    },
  };
}
