// ui/race/trackView.ts — 트랙. 시안에서는 헛간 프레임이 **정적 배경 한 장**이고
// 그 안의 트랙 바닥만 흐른다. 그래서 여기가 하는 일은 바닥 타일 스크롤과 레인뿐이다.
//
// **폴백이 단색이면 안 된다.** 무늬가 없으면 바닥이 흐르는지 알 수 없고, 그러면 달리는
// 느낌 자체가 사라진다 — 이 게임에서 바닥 스크롤이 속도의 유일한 표현이다.
//
// 좌표와 텍스처는 주입받는다(규약 2조) — 이 파일은 ../../data를 모른다.
import { Container, Graphics, Sprite, TilingSprite, type Texture } from "pixi.js";

export interface TrackBox { x: number; y: number; w: number; h: number }

export interface TrackView {
  node: Container;
  /** 레인 중심의 y (절대 좌표) */
  laneY: (lane: number) => number;
  /** 레인 한 줄의 높이 — 러너 크기를 여기에 맞춘다 */
  laneH: number;
  /** 카메라가 보고 있는 위치(m)로 바닥을 흘린다 */
  update: (cameraM: number) => void;
}

const LANES = 6;

export function createTrackView(o: {
  box: TrackBox;
  tex: { trackTile?: Texture; finish?: Texture };
  tuning: { pxPerM: number; distance: number };
}): TrackView {
  const { box, tex, tuning } = o;
  const node = new Container();
  const laneH = box.h / LANES;

  // 트랙 밖으로 새지 않게 자른다 — 바닥도 결승선도 이 상자 안에서만 산다
  const mask = new Graphics().rect(box.x, box.y, box.w, box.h).fill(0xffffff);
  node.addChild(mask);
  node.mask = mask;

  let scrollTile: ((px: number) => void) | null = null;

  if (tex.trackTile) {
    const t = new TilingSprite({ texture: tex.trackTile, width: box.w, height: box.h });
    t.x = box.x;
    t.y = box.y;
    // 원본 높이를 상자 높이에 맞춘다 — 안 맞추면 타일이 잘려 이음매가 보인다
    t.tileScale.set(box.h / tex.trackTile.height);
    node.addChild(t);
    scrollTile = (px) => { t.tilePosition.x = -px; };
  } else {
    // 폴백: 흙빛 바닥 + 10m마다 흰 세로선. 거리 마커가 곧 속도계다.
    const g = new Graphics();
    node.addChild(g);
    scrollTile = (px) => {
      const step = tuning.pxPerM * 10;
      const off = ((px % step) + step) % step;
      g.clear().rect(box.x, box.y, box.w, box.h).fill(0xc0703c);
      for (let x = -off; x < box.w; x += step) {
        if (x < 0) continue;
        g.rect(box.x + x, box.y, 3, box.h).fill({ color: 0xffffff, alpha: 0.35 });
      }
    };
  }

  // 레인 구분선 — 스크롤하지 않는다. 러너가 어느 줄에 있는지가 여기서 읽힌다.
  const lines = new Graphics();
  for (let i = 1; i < LANES; i++) {
    lines.rect(box.x, box.y + laneH * i - 1, box.w, 2).fill({ color: 0xfff3dc, alpha: 0.5 });
  }
  node.addChild(lines);

  // 결승선 — 세계 좌표에 있으므로 카메라를 따라 움직인다
  const finish = new Container();
  if (tex.finish) {
    const s = new Sprite(tex.finish);
    s.height = box.h;
    s.scale.x = s.scale.y;
    s.anchor.set(0.5, 0);
    finish.addChild(s);
  } else {
    const g = new Graphics();
    const cell = 12;
    for (let y = 0; y < box.h; y += cell) {
      for (let k = 0; k < 2; k++) {
        g.rect(k * cell - cell, y, cell, cell)
          .fill((Math.floor(y / cell) + k) % 2 === 0 ? 0x1b1206 : 0xfff3dc);
      }
    }
    finish.addChild(g);
  }
  finish.y = box.y;
  node.addChild(finish);

  return {
    node,
    laneH,
    laneY: (lane) => box.y + laneH * (lane + 0.5),
    update: (cameraM) => {
      scrollTile?.(cameraM * tuning.pxPerM);
      finish.x = box.x + (tuning.distance - cameraM) * tuning.pxPerM;
    },
  };
}
