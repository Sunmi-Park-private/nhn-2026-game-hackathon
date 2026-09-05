// ui/hex/cageArtFit.ts — 창살 아트를 코드가 그린 flat-top 육각 크기에 맞춘다.
//
// QA: 창살 아트가 그 아래 남색 육각(CAGE_DARK)보다 한 단계 작게 보였다.
// 아트 캔버스에는 육각 위쪽 여백과 **육각 아래로 매달린 자물쇠**가 함께 들어 있다.
// 캔버스 전체를 2·size × √3·size 상자에 fitContain하면 세로에 걸려 육각이 줄어든다.
//
// 타일은 아트 캔버스를 잘라서 고쳤다(tests/hex/tileArtSize.test.ts). 창살은 그렇게
// 못 한다 — 자물쇠가 육각 밖으로 나오는 것이 아트의 의도라 잘라 낼 여백이 아니다.
// 그래서 여기서는 픽셀을 한 번 읽어 **가장 넓은 불투명 행**(=육각의 가로 폭)을 재고,
// 그 폭이 2·size가 되는 배율과 그 행이 y=0에 오는 오프셋을 돌려준다.
// 디자이너가 여백이 다른 파일을 다시 올려도 배율이 따라간다 — 보정 상수가 없다.
import type { Texture } from "pixi.js";

export interface CageArtFit {
  /** 가장 넓은 불투명 행의 폭 — 텍스처 논리 픽셀 */
  width: number;
  /** 그 행들의 세로 중심 — 텍스처 논리 픽셀, 위에서부터 */
  centerY: number;
  texW: number;
  texH: number;
}

/** 이 알파 이상만 「그림」으로 친다 — 옅은 그림자·글로우가 폭을 늘리지 않게 */
const OPAQUE = 128;

/** 가장 넓은 불투명 행을 찾는다. 같은 폭인 행이 여럿(육각의 가운데 띠)이면 그 띠의 중심.
 *  전부 투명하면 null. 순수 함수 — 헤드리스 테스트가 여기를 돈다. */
export function measureHexRow(
  alpha: ArrayLike<number>, w: number, h: number,
): { width: number; centerY: number } | null {
  let best = 0;
  let firstY = -1;
  let lastY = -1;
  for (let y = 0; y < h; y += 1) {
    let left = -1;
    let right = -1;
    const row = y * w;
    for (let x = 0; x < w; x += 1) {
      if ((alpha[row + x] ?? 0) >= OPAQUE) {
        if (left < 0) left = x;
        right = x;
      }
    }
    if (left < 0) continue;
    const width = right - left + 1;
    if (width > best) {
      best = width;
      firstY = y;
      lastY = y;
    } else if (width === best) {
      lastY = y;
    }
  }
  if (best === 0) return null;
  return { width: best, centerY: (firstY + lastY) / 2 };
}

/** fitContain에 넘길 상자와 세로 오프셋.
 *  상자의 가로·세로 비가 캔버스와 같아서 fitContain의 배율이 정확히 k가 된다. */
export function hexArtBox(fit: CageArtFit, size: number): { w: number; h: number; dy: number } {
  const k = (2 * size) / fit.width;
  return { w: fit.texW * k, h: fit.texH * k, dy: (fit.texH / 2 - fit.centerY) * k };
}

/** 텍스처 픽셀을 캔버스로 읽어 알파만 뽑는다. 못 읽으면(헤드리스·CORS 오염) null. */
function readAlpha(tex: Texture): { alpha: Uint8ClampedArray; w: number; h: number } | null {
  try {
    const src = tex.source.resource as CanvasImageSource | null | undefined;
    if (!src || typeof document === "undefined") return null;
    const f = tex.frame;
    const w = Math.max(1, Math.round(f.width));
    const h = Math.max(1, Math.round(f.height));
    const canvas = document.createElement("canvas");
    canvas.width = w;
    canvas.height = h;
    const ctx = canvas.getContext("2d", { willReadFrequently: true });
    if (!ctx) return null;
    ctx.drawImage(src, f.x, f.y, w, h, 0, 0, w, h);
    const rgba = ctx.getImageData(0, 0, w, h).data;
    const alpha = new Uint8ClampedArray(w * h);
    for (let i = 0; i < alpha.length; i += 1) alpha[i] = rgba[i * 4 + 3] ?? 0;
    return { alpha, w, h };
  } catch {
    return null;
  }
}

/** 텍스처 한 장을 재서 CageArtFit으로. 못 재면 null — 호출 쪽은 캔버스 기준으로 돌아간다.
 *  스케일은 텍스처의 논리 크기(fitContain이 쓰는 값) 기준으로 맞춘다. */
export function measureCageArt(tex: Texture): CageArtFit | null {
  const px = readAlpha(tex);
  if (!px) return null;
  const m = measureHexRow(px.alpha, px.w, px.h);
  if (!m) return null;
  const texW = tex.width || px.w;
  const texH = tex.height || px.h;
  const sx = texW / px.w;
  const sy = texH / px.h;
  return { width: m.width * sx, centerY: m.centerY * sy, texW, texH };
}
