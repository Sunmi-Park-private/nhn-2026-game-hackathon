// ui/hex/powerGauge.ts — 당긴 힘을 보여주는 직각삼각형 램프.
//
// 점선 궤적의 끝도 사거리를 말해 주지만, 타일에 가리거나 화면 밖으로 나가면
// 읽히지 않는다. 모양 자체가 「낮다→높다」인 램프는 눈금도 글자도 필요 없다.
//
// 자리는 코드에 박지 않는다 — uiLayout의 ingame/powerGauge 슬롯이 정한다.
// 나중에 아트가 오면 같은 슬롯에 그림을 얹으면 된다.
import { Container, Graphics } from "pixi.js";
import { slot } from "../../data/uiLayout";

/** 슬롯이 없을 때의 자리. 판 하단 왼쪽 — 오른쪽은 NEXT·부스터 레일이 쓴다. */
const FALLBACK = { x: 24, y: 690, w: 96, h: 44 };

/** 이 파워를 넘으면 채움색이 바뀐다 — 최대 근처를 눈으로 안다. */
const HOT = 0.8;

const COLD_FILL = 0xf0c96a;
const HOT_FILL = 0xff8f5a;
const FRAME = 0xffffff;

export interface PowerGauge {
  root: Container;
  /** 0~1이면 그 만큼 채우고, null이면 숨는다. */
  set(power: number | null): void;
  destroy(): void;
}

export function createPowerGauge(): PowerGauge {
  const s = slot("ingame", "powerGauge");
  const box = s ? { x: s.x, y: s.y, w: s.w, h: s.h } : FALLBACK;

  const root = new Container();
  root.x = box.x;
  root.y = box.y;
  root.visible = false;

  // 윤곽 — 오른쪽 아래가 직각, 왼쪽 낮은 변에서 오른쪽 높은 변으로 빗변이 오른다.
  const frame = new Graphics()
    .moveTo(0, box.h)
    .lineTo(box.w, box.h)
    .lineTo(box.w, 0)
    .closePath()
    .stroke({ width: 2, color: FRAME, alpha: 0.5 });

  const fill = new Graphics();
  root.addChild(fill, frame);

  return {
    root,

    set(power: number | null): void {
      if (power === null) {
        root.visible = false;
        fill.clear();
        return;
      }
      const t = power < 0 ? 0 : power > 1 ? 1 : power;
      root.visible = true;
      fill.clear();
      if (t <= 0) return;
      // 윤곽과 같은 빗변을 따라 자란 닮은 삼각형 — 꼭짓점이 그 빗변 위에 얹힌다.
      const x = box.w * t;
      fill
        .moveTo(0, box.h)
        .lineTo(x, box.h)
        .lineTo(x, box.h - box.h * t)
        .closePath()
        .fill({ color: t >= HOT ? HOT_FILL : COLD_FILL, alpha: 0.9 });
    },

    destroy(): void {
      root.destroy({ children: true });
    },
  };
}
