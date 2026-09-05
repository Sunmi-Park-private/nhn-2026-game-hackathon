// ui/hex/pullArea.ts — 당길 수 있는 범위를 알려주는 사각 가이드.
//
// 새총 조작은 「어디를 잡아도 된다」가 아니라 「말 발밑에서 당긴다」는 규칙이라,
// 처음 잡는 사람은 어디에 손을 대야 하는지 모른다. 조준선은 이미 당긴 뒤에야
// 나오므로 그 전에 알려줄 것이 필요하다.
//
// 크기를 코드에 따로 박지 않는다 — dragAim의 MAX_PULL에서 그대로 도출한다.
// 가이드가 실제 판정과 어긋나면 없느니만 못하다.
import { Container, Graphics } from "pixi.js";
import { MAX_PULL } from "./dragAim";

/** 앵커보다 조금 위까지 잡아 준다. 손가락이 말 위에서 시작해도 드래그는 성립한다. */
const ABOVE = 24;

const COLOR = 0xf0c96a;
/** 평소 — 있는 줄만 알면 된다. 판을 읽는 데 방해가 되면 안 된다. */
const IDLE_ALPHA = 0.50;
/** 당기는 중 — 지금 이 안에서 조작하고 있다는 것을 확인시켜 준다. */
const ACTIVE_ALPHA = 0.85;

export interface PullArea {
  root: Container;
  /** 테두리 윗변의 가운데. 튜토리얼 말풍선이 이 영역을 가리킬 때 쓴다 —
   *  ABOVE를 밖에서 다시 계산하면 가이드와 어긋난다 */
  topCenter: { x: number; y: number };
  /** 드래그 중이면 true. 선이 또렷해진다. */
  setActive(active: boolean): void;
  destroy(): void;
}

/** `anchor`는 새총의 고정점(말 발밑)이다. stageScreen이 dragAim에 넘기는 것과 같은 값을 준다. */
export function createPullArea(anchor: { x: number; y: number }): PullArea {
  const root = new Container();

  // 당김 거리는 앵커 기준 반지름 MAX_PULL이지만, 손이 실제로 움직이는 곳은 아래쪽이다.
  // 위쪽까지 사각형을 올리면 판을 덮어 조준선과 타일을 가린다.
  const x = anchor.x - MAX_PULL;
  const y = anchor.y - ABOVE;
  const w = MAX_PULL * 2;
  const h = MAX_PULL + ABOVE;

  const g = new Graphics()
    .roundRect(x, y, w, h, 18)
    .stroke({ width: 3, color: COLOR, alpha: 1 });
  g.alpha = IDLE_ALPHA;
  root.addChild(g);

  return {
    root,
    topCenter: { x: anchor.x, y },

    setActive(active: boolean): void {
      g.alpha = active ? ACTIVE_ALPHA : IDLE_ALPHA;
    },

    destroy(): void {
      root.destroy({ children: true });
    },
  };
}
