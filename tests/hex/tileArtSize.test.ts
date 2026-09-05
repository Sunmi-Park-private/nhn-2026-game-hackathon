// tests/hex/tileArtSize.test.ts — 타일 아트 캔버스가 육각에 딱 맞는지.
//
// 처음 받은 아트는 512×512 정사각 캔버스 한가운데에 409×470 육각이 놓여 있었다.
// makeTileView는 fitContain에 **캔버스 크기**를 넘기므로 배율이 (칸폭 ÷ 512)가 되고,
// 육각은 칸의 79.9%만 채웠다 — 칸 간격의 20%가 빈틈으로 보였다.
//
// 고친 방법은 코드가 아니라 아트다. 캔버스를 육각 바운딩 박스로 잘라 여백을 없앴다.
// 그러면 fitContain이 그대로 맞고 렌더 코드에 보정 상수가 없어도 된다.
// 대신 디자이너가 여백 있는 파일을 다시 올리면 빈틈이 조용히 돌아온다 — 여기서 잡는다.
import { describe, it, expect } from "vitest";
import { readFileSync, existsSync } from "node:fs";
import { resolve } from "node:path";
import { hexAssetPaths } from "../../src/data/hexAssets";

/** WebP 헤더에서 가로·세로만 읽는다. 디코딩은 하지 않는다. */
function webpSize(buf: Buffer): { w: number; h: number } {
  if (buf.toString("ascii", 0, 4) !== "RIFF" || buf.toString("ascii", 8, 12) !== "WEBP") {
    throw new Error("WebP가 아니다");
  }
  const kind = buf.toString("ascii", 12, 16);
  if (kind === "VP8X") {
    return { w: buf.readUIntLE(24, 3) + 1, h: buf.readUIntLE(27, 3) + 1 };
  }
  if (kind === "VP8L") {
    const b = buf.readUInt32LE(21); // 시그니처(0x2f) 다음 4바이트에 14비트씩 들어 있다
    return { w: (b & 0x3fff) + 1, h: ((b >> 14) & 0x3fff) + 1 };
  }
  if (kind === "VP8 ") {
    return { w: buf.readUInt16LE(26) & 0x3fff, h: buf.readUInt16LE(28) & 0x3fff };
  }
  throw new Error(`모르는 WebP 종류: ${kind}`);
}

/** pointy-top 육각의 가로:세로. ART_SPEC §2의 규격이다. */
const RATIO = Math.sqrt(3) / 2;

const files = Object.values(hexAssetPaths.tiles)
  .filter((p): p is string => typeof p === "string" && p.length > 0)
  .map((p) => ({ p, abs: resolve(process.cwd(), "public", p.replace(/^\//, "")) }))
  .filter((f) => existsSync(f.abs));

describe("타일 아트 캔버스", () => {
  it("적어도 한 장은 도착해 있다 — 전부 없으면 아래 검사가 조용히 통과한다", () => {
    expect(files.length).toBeGreaterThan(0);
  });

  for (const f of files) {
    it(`${f.p} 캔버스가 √3:2다 — 투명 여백이 있으면 칸 사이가 벌어진다`, () => {
      const { w, h } = webpSize(readFileSync(f.abs));
      // 512×512 같은 정사각 캔버스는 1.0이라 여유 0.02로 확실히 걸린다.
      expect(w / h).toBeCloseTo(RATIO, 2);
    });
  }
});
