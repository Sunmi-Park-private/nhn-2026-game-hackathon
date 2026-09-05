// ui/race/trackView.ts — 배경 3층 스크롤과 6레인 트랙.
//
// **폴백이 단색이면 안 된다.** 무늬가 없으면 배경이 흐르는지 알 수 없고, 그러면 달리는
// 느낌 자체가 사라진다 — 이 게임에서 배경 스크롤이 속도의 유일한 표현이다.
// 그래서 아트가 없을 때 관중석과 거리 마커를 절차적으로 그린다.
//
// 좌표와 텍스처는 주입받는다(규약 2조) — 이 파일은 ../../data를 모른다.
import { Container, Graphics, Sprite, TilingSprite, type Texture } from "pixi.js";

export interface TrackBox { x: number; y: number; w: number; h: number }

export interface TrackTextures {
  sky?: Texture;
  mid?: Texture;
  track?: Texture;
  finish?: Texture;
}

export interface TrackTuning {
  /** 미터당 픽셀 */
  pxPerM: number;
  /** 결승선까지 (m) */
  distance: number;
  /** 층별 스크롤 계수 */
  parallax: { sky: number; mid: number; track: number };
}

export interface TrackView {
  node: Container;
  /** 레인 중심의 y (트랙 상자 기준 절대 좌표) */
  laneY: (lane: number) => number;
  /** 레인 한 줄의 높이 — 러너 크기를 여기에 맞춘다 */
  laneH: number;
  /** 달리는 바닥의 범위. 러너를 이 밖으로 그리면 안 된다 */
  runway: { y: number; h: number };
  /** 카메라가 보고 있는 위치(m)로 배경을 흘린다 */
  update: (cameraM: number) => void;
}

const LANES = 6;

/** 가로로 반복되는 층 하나. 아트가 없으면 색 띠 + 절차적 무늬로 대신한다. */
function band(
  tex: Texture | undefined,
  box: TrackBox, y: number, h: number,
  fallback: (g: Graphics, w: number, h: number) => void,
): { node: Container; scroll: (px: number) => void } {
  if (tex) {
    const t = new TilingSprite({ texture: tex, width: box.w, height: h });
    t.x = box.x;
    t.y = y;
    // 원본 높이를 상자 높이에 맞춘다 — 안 맞추면 타일이 잘려 이음매가 보인다
    t.tileScale.set(h / tex.height);
    return { node: t, scroll: (px) => { t.tilePosition.x = -px; } };
  }

  // 폴백: 무늬 한 벌을 두 장 잇고 통째로 밀어 무한 스크롤을 흉내낸다
  const wrap = new Container();
  const mask = new Graphics().rect(box.x, y, box.w, h).fill(0xffffff);
  wrap.addChild(mask);
  wrap.mask = mask;

  const unit = new Graphics();
  fallback(unit, box.w, h);
  const a = unit;
  const b = new Graphics();
  fallback(b, box.w, h);
  a.y = y; b.y = y;
  a.x = box.x; b.x = box.x + box.w;
  wrap.addChild(a, b);

  return {
    node: wrap,
    scroll: (px) => {
      const off = ((px % box.w) + box.w) % box.w;
      a.x = box.x - off;
      b.x = box.x - off + box.w;
    },
  };
}

export function createTrackView(o: {
  box: TrackBox;
  tex: TrackTextures;
  tuning: TrackTuning;
}): TrackView {
  const { box, tex, tuning } = o;
  const node = new Container();

  const skyH = Math.round(box.h * 0.28);
  const midH = Math.round(box.h * 0.14);
  const trackY = box.y + skyH + midH;
  const trackH = box.h - skyH - midH;

  // 하늘 — 구름 대신 옅은 띠 몇 개. 느리게 흘러 깊이를 만든다.
  const sky = band(tex.sky, box, box.y, skyH, (g, w, h) => {
    g.rect(0, 0, w, h).fill(0x9fd0e6);
    for (let i = 0; i < 4; i++) {
      const cx = (w / 4) * i + 30;
      g.ellipse(cx, h * 0.35 + (i % 2) * 14, 34, 12).fill({ color: 0xffffff, alpha: 0.55 });
    }
  });

  // 중경 — 관중석. 일정 간격 사각형이라 스크롤이 바로 읽힌다.
  const mid = band(tex.mid, box, box.y + skyH, midH, (g, w, h) => {
    g.rect(0, 0, w, h).fill(0xb59a63);
    for (let i = 0; i < 18; i++) {
      g.rect((w / 18) * i + 2, h * 0.25, w / 18 - 5, h * 0.5)
        .fill({ color: i % 3 === 0 ? 0xe8d3a4 : 0x8f7443, alpha: 0.9 });
    }
  });

  // 트랙 — 10m마다 흰 세로선. 거리 마커가 곧 속도계다.
  const track = band(tex.track, { ...box, w: box.w }, trackY, trackH, (g, w, h) => {
    g.rect(0, 0, w, h).fill(0xc0703c);
    const step = tuning.pxPerM * 10;
    for (let x = 0; x < w; x += step) g.rect(x, 0, 3, h).fill({ color: 0xffffff, alpha: 0.35 });
  });

  node.addChild(sky.node, mid.node, track.node);

  // 레인 구분선 — 스크롤하지 않는다. 러너가 어느 줄에 있는지가 여기서 읽힌다.
  const lines = new Graphics();
  const laneH = trackH / LANES;
  for (let i = 1; i < LANES; i++) {
    lines.rect(box.x, trackY + laneH * i - 1, box.w, 2).fill({ color: 0xffffff, alpha: 0.22 });
  }
  node.addChild(lines);

  // 결승선 — 세계 좌표에 있으므로 카메라를 따라 움직인다
  const finish = new Container();
  if (tex.finish) {
    const s = new Sprite(tex.finish);
    s.height = trackH;
    s.scale.x = s.scale.y;
    s.anchor.set(0.5, 0);
    finish.addChild(s);
  } else {
    const g = new Graphics();
    const cell = 10;
    for (let y = 0; y < trackH; y += cell) {
      for (let k = 0; k < 2; k++) {
        g.rect(k * cell - cell, y, cell, cell)
          .fill((Math.floor(y / cell) + k) % 2 === 0 ? 0x1b1206 : 0xfff3dc);
      }
    }
    finish.addChild(g);
  }
  finish.y = trackY;
  node.addChild(finish);

  return {
    node,
    laneH,
    runway: { y: trackY, h: trackH },
    laneY: (lane) => trackY + laneH * (lane + 0.5),
    update: (cameraM) => {
      const px = cameraM * tuning.pxPerM;
      sky.scroll(px * tuning.parallax.sky);
      mid.scroll(px * tuning.parallax.mid);
      track.scroll(px * tuning.parallax.track);
      finish.x = box.x + (tuning.distance - cameraM) * tuning.pxPerM;
      // 화면 밖 결승선을 계속 그릴 이유가 없다
      finish.visible = finish.x > box.x - 40 && finish.x < box.x + box.w + 40;
    },
  };
}
