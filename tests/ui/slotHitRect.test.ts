// 슬롯 배율이 터치 영역까지 키우면 옆 버튼을 덮는다 — 그 회귀를 막는다.
//
// 하단 nav 4종은 scale 2.3이다(아트에 투명 여백이 있어 디자이너가 키운 값).
// applyStyle이 컨테이너째 키우므로 안에 든 투명 히트 사각형도 2.3배가 되어
// 96×50이 220.8×115가 됐다. Pixi는 겹치면 나중에 붙은 것을 잡으므로
// HOME을 눌러도 RACE가, RACE를 눌러도 도감이 열렸다.
import { describe, expect, it } from "vitest";
import { slotHitRect } from "../../src/ui/slotHitRect";
import { uiAreas } from "../../src/data/uiLayout";

/** editable()이 만드는 상태와 같은 노드 값. centerPivot이 지역 경계 중심을 pivot으로 잡고
 *  node.x += cx * scale(그때는 1)로 보정한 뒤, applyStyle이 배율을 입힌다. */
function nodeFor(b: { x: number; y: number; w: number; h: number }, scale: number) {
  return { x: b.x + b.w / 2, y: b.y + b.h / 2, scale, pivotX: b.w / 2, pivotY: b.h / 2 };
}

/** 지역 좌표 사각형을 부모 좌표로 투영한다 — Pixi가 히트 판정에 쓰는 것과 같은 변환. */
function project(
  r: { x: number; y: number; w: number; h: number },
  n: { x: number; y: number; scale: number; pivotX: number; pivotY: number },
) {
  return {
    x: (r.x - n.pivotX) * n.scale + n.x,
    y: (r.y - n.pivotY) * n.scale + n.y,
    w: r.w * n.scale,
    h: r.h * n.scale,
  };
}

const overlap = (a: { x: number; w: number }, b: { x: number; w: number }): boolean =>
  a.x < b.x + b.w && b.x < a.x + a.w;

describe("슬롯 히트 영역", () => {
  it("배율이 얼마든 슬롯 상자와 정확히 같은 자리를 덮는다", () => {
    const b = { x: 122, y: 729, w: 96, h: 50 };
    for (const scale of [1, 2, 2.3, 0.5]) {
      const n = nodeFor(b, scale);
      const got = project(slotHitRect(b, n), n);
      expect(got.x).toBeCloseTo(b.x, 6);
      expect(got.y).toBeCloseTo(b.y, 6);
      expect(got.w).toBeCloseTo(b.w, 6);
      expect(got.h).toBeCloseTo(b.h, 6);
    }
  });

  it("로비 하단 nav 4종의 터치 영역이 서로 겹치지 않는다", () => {
    const lobby = uiAreas.find((a) => a.id === "lobby")!;
    const navs = ["navHome", "navRace", "navAnimals", "navEvents"].map(
      (id) => lobby.slots.find((s) => s.id === id)!,
    );
    const rects = navs.map((s) => {
      const b = { x: s.x, y: s.y, w: s.w, h: s.h };
      const n = nodeFor(b, s.scale !== undefined && s.scale > 0 ? s.scale : 1);
      return project(slotHitRect(b, n), n);
    });
    for (let i = 0; i < rects.length; i++) {
      for (let j = i + 1; j < rects.length; j++) {
        expect(overlap(rects[i]!, rects[j]!)).toBe(false);
      }
    }
  });

  it("누른 자리에 있는 버튼은 자기 자신뿐이다 — 슬롯 중심을 눌러 확인한다", () => {
    const lobby = uiAreas.find((a) => a.id === "lobby")!;
    const ids = ["navHome", "navRace", "navAnimals", "navEvents"];
    const rects = ids.map((id) => {
      const s = lobby.slots.find((x) => x.id === id)!;
      const b = { x: s.x, y: s.y, w: s.w, h: s.h };
      const n = nodeFor(b, s.scale !== undefined && s.scale > 0 ? s.scale : 1);
      return { id, r: project(slotHitRect(b, n), n), cx: b.x + b.w / 2 };
    });
    for (const { id, cx } of rects) {
      const hit = rects.filter((o) => cx >= o.r.x && cx <= o.r.x + o.r.w).map((o) => o.id);
      expect(hit).toEqual([id]);
    }
  });
});
