// tests/hex/cageArtFit.test.ts — 창살 아트를 코드가 그린 육각 크기에 맞추는 계산.
//
// QA: 창살 아트가 남색 육각(코드가 그린 CAGE_DARK)보다 한 단계 작게 보였다.
// 아트 캔버스에는 육각 위쪽 여백과 **육각 아래로 매달린 자물쇠**가 함께 들어 있어,
// 캔버스 전체를 fitContain하면 세로에 걸려 육각이 줄어든다.
// 그래서 캔버스가 아니라 **가장 넓은 불투명 행**(=육각의 가로 폭)을 기준으로 배율을 잡고,
// 그 행이 육각 중심(y=0)에 오도록 세로 오프셋을 준다.
import { describe, it, expect } from "vitest";
import { measureHexRow, hexArtBox } from "../../src/ui/hex/cageArtFit";

/** w×h 알파 캔버스. paint(x, y)가 준 값(0~255)을 채운다. */
function canvas(w: number, h: number, paint: (x: number, y: number) => number): Uint8ClampedArray {
  const a = new Uint8ClampedArray(w * h);
  for (let y = 0; y < h; y += 1) for (let x = 0; x < w; x += 1) a[y * w + x] = paint(x, y);
  return a;
}

describe("measureHexRow — 가장 넓은 불투명 행", () => {
  it("여백 + 육각 + 아래 자물쇠 캔버스에서 육각의 폭과 세로 중심을 찍는다", () => {
    // 100×120 캔버스. 육각(사각으로 근사)이 x 10..89, y 20..79. 자물쇠가 x 40..59, y 80..109.
    const a = canvas(100, 120, (x, y) => {
      if (y >= 20 && y < 80 && x >= 10 && x < 90) return 255;
      if (y >= 80 && y < 110 && x >= 40 && x < 60) return 255;
      return 0;
    });
    const m = measureHexRow(a, 100, 120);
    expect(m).not.toBeNull();
    expect(m!.width).toBe(80);
    expect(m!.centerY).toBeCloseTo(49.5, 5); // (20 + 79) / 2 — 자물쇠 구간은 끼지 않는다
  });

  it("흐린 그림자(알파 < 128)는 폭에 넣지 않는다", () => {
    const a = canvas(50, 10, (x, y) => {
      if (y === 5 && x >= 10 && x < 40) return 255;
      if (y === 5) return 60; // 행 전체에 옅은 그림자
      return 0;
    });
    expect(measureHexRow(a, 50, 10)!.width).toBe(30);
  });

  it("전부 투명하면 null — 호출 쪽이 캔버스 기준 fitContain으로 돌아간다", () => {
    expect(measureHexRow(canvas(8, 8, () => 0), 8, 8)).toBeNull();
  });
});

describe("hexArtBox — fitContain에 넘길 상자와 세로 오프셋", () => {
  it("육각 폭이 2·size가 되는 배율로 캔버스를 키우고, 육각 중심을 y=0으로 옮긴다", () => {
    const fit = { width: 80, centerY: 49.5, texW: 100, texH: 120 };
    const size = 60; // 코드가 그린 flat-top 육각 반지름 → 가로 120
    const b = hexArtBox(fit, size);
    const k = 120 / 80;
    expect(b.w).toBeCloseTo(100 * k, 5);
    expect(b.h).toBeCloseTo(120 * k, 5);
    // 캔버스 중심(60)보다 육각 중심(49.5)이 위에 있으니 스프라이트를 아래로 내린다
    expect(b.dy).toBeCloseTo((60 - 49.5) * k, 5);
  });

  it("육각이 캔버스에 딱 맞으면 기존 fitContain과 같은 상자, 오프셋 0", () => {
    const b = hexArtBox({ width: 200, centerY: 86.5, texW: 200, texH: 173 }, 50);
    expect(b.w).toBeCloseTo(100, 5);
    expect(b.h).toBeCloseTo(86.5, 5);
    expect(b.dy).toBeCloseTo(0, 5);
  });
});
