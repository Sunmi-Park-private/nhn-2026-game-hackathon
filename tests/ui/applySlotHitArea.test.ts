// 실제 Pixi 노드에 붙여 확인한다 — 계산이 맞아도 화면이 안 쓰면 소용없으므로,
// 화면들이 쓰는 바로 그 함수를 실물 컨테이너에 적용해 결과를 잰다.
import { Container, Graphics, type Rectangle } from "pixi.js";
import { describe, expect, it } from "vitest";
import { applySlotHitArea } from "../../src/ui/slotHitRect";

/** editable()이 하는 일과 같다 — 지역 경계 중심을 pivot으로 잡고 위치를 보정한 뒤 배율을 입힌다. */
function register(node: Container, scale: number): void {
  const b = node.getLocalBounds();
  const cx = b.x + b.width / 2;
  const cy = b.y + b.height / 2;
  node.pivot.set(cx, cy);
  node.x += cx * node.scale.x;
  node.y += cy * node.scale.y;
  node.scale.set(scale);
}

const box = (x: number, y: number, w: number, h: number) => ({ x, y, w, h });

describe("applySlotHitArea", () => {
  it("배율을 입은 노드의 터치 영역이 슬롯 상자 그대로다", () => {
    const b = box(122, 729, 96, 50);
    const c = new Container();
    c.x = b.x;
    c.y = b.y;
    c.addChild(new Graphics().rect(0, 0, b.w, b.h).fill(0xffffff));
    register(c, 2.3);
    applySlotHitArea(c, b);

    const r = c.hitArea as Rectangle;
    const g = c.toGlobal({ x: r.x, y: r.y });
    const g2 = c.toGlobal({ x: r.x + r.width, y: r.y + r.height });
    expect(g.x).toBeCloseTo(b.x, 4);
    expect(g.y).toBeCloseTo(b.y, 4);
    expect(g2.x - g.x).toBeCloseTo(b.w, 4);
    expect(g2.y - g.y).toBeCloseTo(b.h, 4);
  });

  it("배율이 조상에 걸린 생김새(게임오버)에서도 슬롯 상자 그대로다", () => {
    const b = box(99, 436, 120, 48);
    const outer = new Container();
    const inner = new Container();
    inner.x = b.x;
    inner.y = b.y;
    inner.addChild(new Graphics().rect(0, 0, b.w, b.h).fill(0xffffff));
    outer.addChild(inner);
    register(outer, 1.5);
    applySlotHitArea(inner, b, outer);

    const r = inner.hitArea as Rectangle;
    const g = inner.toGlobal({ x: r.x, y: r.y });
    const g2 = inner.toGlobal({ x: r.x + r.width, y: r.y + r.height });
    expect(g.x).toBeCloseTo(b.x, 4);
    expect(g.y).toBeCloseTo(b.y, 4);
    expect(g2.x - g.x).toBeCloseTo(b.w, 4);
    expect(g2.y - g.y).toBeCloseTo(b.h, 4);
  });
});
