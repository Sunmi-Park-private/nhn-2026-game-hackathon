// ui/stage.ts — 논리 스테이지 크기 SSOT. 콘텐츠는 항상 450×800 좌표계에 그리고,
// 화면이 더 넓거나 긴 기기는 캔버스 크기를 늘려(main.ts) 배경만 상하좌우로 블리드시킨다.
// 전체 화면을 덮어야 하는 것(배경·딤·플래시)은 fullRect()/coverBg()를 쓸 것.
import { Graphics, Sprite, type Texture } from "pixi.js";

export const BASE_W = 450; // 430 → 450. 450×800 = 정확히 9:16 (중앙 콘텐츠 컬럼)
export const BASE_H = 800;

let extra = 0; // 캔버스 논리 높이 − BASE_H (main.ts fit에서 갱신, 세로 블리드)
export function setStageExtra(e: number): void { extra = Math.max(0, e); }

let extraX = 0; // 캔버스 논리 폭 − BASE_W (main.ts fit에서 갱신, 가로 블리드 — 좌우 패널)
export function setStageExtraX(e: number): void { extraX = Math.max(0, e); }

/** 콘텐츠(0..800) 좌표계에서 캔버스 최상단 y (0 또는 음수) */
export function stageTop(): number { return -extra / 2; }
/** 캔버스 논리 높이 (BASE_H + 블리드 여분) */
export function stageHeight(): number { return BASE_H + extra; }

/** 콘텐츠(0..450) 좌표계에서 캔버스 최좌단 x (0 또는 음수) */
export function stageLeft(): number { return -extraX / 2; }
/** 캔버스 논리 폭 (BASE_W + 좌우 패널) */
export function stageWidth(): number { return BASE_W + extraX; }

/** 캔버스 전체를 덮는 rect (배경색·딤·플래시용) */
export function fullRect(color: number, alpha?: number): Graphics {
  const g = new Graphics().rect(stageLeft(), stageTop(), stageWidth(), stageHeight());
  return alpha === undefined ? g.fill(color) : g.fill({ color, alpha });
}

/** 콘텐츠 박스(450×800 컬럼)만 채우는 rect. 화면의 불투명 배경은 **이것**을 쓴다 —
 *  좌우 블리드 자리는 main.ts가 모든 화면 밑에 깔아 둔 기본 배경 영상이 보여야 한다.
 *  전에는 화면마다 fullRect(0x241a10)로 캔버스 전체를 덮어 그 영상이 로비 밖에서는
 *  가려졌다. 캔버스가 투명해질 걱정은 없다 — app.init의 background가 같은 색이다. */
export function contentRect(color: number, alpha?: number): Graphics {
  const g = new Graphics().rect(0, stageTop(), BASE_W, stageHeight());
  return alpha === undefined ? g.fill(color) : g.fill({ color, alpha });
}

/** 캔버스 전체를 덮는 배경 스프라이트 — cover(넘치는 축 크롭). 소스는 전 기기 커버용 1080×2400 블리드 전제 */
export function coverBg(tex: Texture): Sprite {
  const spr = new Sprite(tex);
  fitCover(spr);
  return spr;
}

/** 이미 만든 스프라이트를 지금 캔버스 크기에 다시 cover로 맞춘다.
 *  화면이 돌아가면(fit) 캔버스 논리 폭이 바뀐다 — 화면 수명보다 오래 사는 배경(main.ts의
 *  기본 배경 영상)은 그때마다 이걸로 따라간다. */
export function fitCover(spr: Sprite): void {
  const tex = spr.texture;
  const s = Math.max(stageWidth() / tex.width, stageHeight() / tex.height);
  spr.scale.set(s);
  spr.x = stageLeft() + (stageWidth() - tex.width * s) / 2;
  spr.y = stageTop() + (stageHeight() - tex.height * s) / 2;
}

/** 콘텐츠 박스(450×800)만 덮는 배경. 세로 아트(1080×2400)를 쓰는 부트 화면용이다 —
 *  coverBg는 16:9 캔버스 전체를 덮으므로 세로 아트를 쓰면 가운데 띠만 보인다.
 *  좌우 패널 자리는 뒤에 깔린 단색이 그대로 보인다. */
export function coverBox(tex: Texture): Sprite {
  const spr = new Sprite(tex);
  const s = Math.max(BASE_W / tex.width, BASE_H / tex.height);
  spr.scale.set(s);
  spr.x = (BASE_W - tex.width * s) / 2;
  spr.y = (BASE_H - tex.height * s) / 2;
  return spr;
}
