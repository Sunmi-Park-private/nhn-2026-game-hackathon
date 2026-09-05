// ui/hex/tileArt.ts — 타일 그리기. 아트가 없으면 색 육각으로 폴백한다.
// 디자이너 아트를 기다리지 않고 개발할 수 있게 하는 장치다.
import { Graphics, Sprite, Texture, Container } from "pixi.js";
import { fitContain } from "../skin";
import { HEX_SIZE } from "./geom";
import type { Tier } from "../../engine/hex/types";

/** 가시광선 파장 순서. 아트 도착 전 플레이스홀더이자 폴백 색이다. */
export const TIER_COLORS: readonly number[] = [
  0xe6392f, // 빨강  T1
  0xf5c518, // 노랑  T2
  0x3fa34d, // 초록  T3
  0x2f7fd6, // 파랑  T4
  0x8b4fc7, // 보라  T5
  0xf0a020, // 황금  T6
];

export const HORSESHOE_COLOR = 0x8a5a2b;

/** pointy-top 육각형 꼭짓점 6개. 위아래가 뾰족하고 좌우가 수직 변이다. */
export function hexPoints(size: number): number[] {
  const pts: number[] = [];
  for (let i = 0; i < 6; i++) {
    const angle = (Math.PI / 180) * (60 * i - 90);
    pts.push(size * Math.cos(angle), size * Math.sin(angle));
  }
  return pts;
}

/** 색 육각 플레이스홀더. 안쪽에 밝은 테두리를 넣어 격자가 읽히게 한다.
 *  안쪽 여백은 **비율로** 잡는다 — 예전엔 `HEX_SIZE - 1`, `HEX_SIZE - 4`라는 절대값이라
 *  판을 우리 안으로 줄여 육각이 18→14로 작아지자 테두리만 상대적으로 굵어졌다. */
export function drawTileFallback(color: number): Graphics {
  const g = new Graphics();
  g.poly(hexPoints(HEX_SIZE * 0.945)).fill(color);
  g.poly(hexPoints(HEX_SIZE * 0.78)).stroke({
    width: HEX_SIZE * 0.11,
    color: 0xffffff,
    alpha: 0.25,
  });
  return g;
}

/** 타일 하나의 표시 객체. 텍스처가 있으면 스프라이트, 없으면 색 육각. */
export function makeTileView(tier: Tier, tex: Texture | null): Container {
  if (tex) {
    const s = new Sprite(tex);
    s.anchor.set(0.5);
    // 원본 비율 유지 — 아트가 √3:2가 아니어도 찌그러지지 않고 칸 안에 들어간다.
    //
    // **fitContain은 캔버스를 맞춘다.** 투명 여백이 있으면 그만큼 육각이 작게 그려져
    // 칸 사이가 벌어진다(처음 받은 512×512 아트가 그랬다 — 육각이 409px이라 79.9%).
    // 그래서 캔버스 = 육각 바운딩 박스가 아트 규격이고, tileArtSize.test.ts가 지킨다.
    fitContain(s, Math.sqrt(3) * HEX_SIZE, 2 * HEX_SIZE);
    return s;
  }
  return drawTileFallback(TIER_COLORS[tier] ?? 0x888888);
}

export function makeHorseshoeView(tex: Texture | null): Container {
  if (tex) {
    const s = new Sprite(tex);
    s.anchor.set(0.5);
    fitContain(s, Math.sqrt(3) * HEX_SIZE, 2 * HEX_SIZE);
    return s;
  }
  return drawTileFallback(HORSESHOE_COLOR);
}
