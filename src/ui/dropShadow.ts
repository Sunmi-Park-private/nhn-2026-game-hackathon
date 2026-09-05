// ui/dropShadow.ts — 버튼 아트 뒤에 같은 모양의 그림자를 한 겹 깐다.
//
// pixi-filters를 들이지 않는다. 그림자 한 겹 때문에 런타임 의존을 늘리면 번들이
// 커지고 제출본에 새 실패 지점이 생긴다 — 같은 스프라이트를 검게 칠해 뒤에 까는
// 것으로 충분하다. 필터가 아니라 **노드 한 개**라 에디터의 배율·이동도 그대로 따라간다.
//
// 각도는 시안 표기를 그대로 쓴다(도 단위, 0°=오른쪽). Pixi는 y가 아래로 자라므로
// 180°는 왼쪽(dx = −거리, dy = 0)이 된다.
import { Sprite, type Texture } from "pixi.js";

export interface DropShadow {
  /** 도 단위. 0°=오른쪽, 90°=아래, 180°=왼쪽 */
  angle: number;
  /** 논리 px */
  distance: number;
  alpha?: number;
}

/** 스프라이트와 같은 자리·같은 크기의 검은 사본. 진짜 스프라이트보다 **먼저** 붙인다. */
export function shadowSprite(tex: Texture, like: Sprite, s: DropShadow): Sprite {
  const rad = (s.angle * Math.PI) / 180;
  const sh = new Sprite(tex);
  sh.anchor.copyFrom(like.anchor);
  sh.width = like.width;
  sh.height = like.height;
  sh.x = like.x + Math.cos(rad) * s.distance;
  sh.y = like.y + Math.sin(rad) * s.distance;
  sh.tint = 0x000000;
  sh.alpha = s.alpha ?? 0.38;
  return sh;
}
