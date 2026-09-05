// tests/hex/dragAim.test.ts — 새총 조준: 당긴 반대로 날아간다
import { describe, it, expect } from "vitest";
import { createDragAim, MAX_ANGLE, DEAD_ZONE, MAX_PULL } from "../../src/ui/hex/dragAim";

const ANCHOR = { x: 225, y: 700 };

describe("createDragAim", () => {
  it("아래로 곧게 당기면 똑바로 위로 쏜다", () => {
    const d = createDragAim(ANCHOR);
    d.down(ANCHOR);
    d.move({ x: ANCHOR.x, y: ANCHOR.y + 100 });
    expect(d.current()!.angle).toBeCloseTo(0, 5);
  });

  it("오른쪽 아래로 당기면 왼쪽 위로 쏜다 — 새총", () => {
    const d = createDragAim(ANCHOR);
    d.down(ANCHOR);
    d.move({ x: ANCHOR.x + 100, y: ANCHOR.y + 100 });
    expect(d.current()!.angle).toBeLessThan(0); // 음수 = 왼쪽
  });

  it("당긴 거리가 멀수록 파워가 크다", () => {
    const d = createDragAim(ANCHOR);
    d.down(ANCHOR);
    d.move({ x: ANCHOR.x, y: ANCHOR.y + DEAD_ZONE + 20 });
    const weak = d.current()!.power;
    d.move({ x: ANCHOR.x, y: ANCHOR.y + DEAD_ZONE + 90 });
    expect(d.current()!.power).toBeGreaterThan(weak);
  });

  it("파워는 0~1을 벗어나지 않는다", () => {
    const d = createDragAim(ANCHOR);
    d.down(ANCHOR);
    d.move({ x: ANCHOR.x, y: ANCHOR.y + MAX_PULL * 5 });
    expect(d.current()!.power).toBe(1);
    d.move({ x: ANCHOR.x, y: ANCHOR.y + 1 });
    expect(d.current()!.power).toBe(0);
  });

  it("각도는 ±MAX_ANGLE에서 잘린다", () => {
    const d = createDragAim(ANCHOR);
    d.down(ANCHOR);
    // 거의 수평으로 당긴다 — 클램프가 없으면 90°에 가까워진다
    d.move({ x: ANCHOR.x - 300, y: ANCHOR.y + 1 });
    expect(d.current()!.angle).toBeCloseTo(MAX_ANGLE, 5);
  });

  it("데드존 안에서 떼면 발사하지 않는다", () => {
    const d = createDragAim(ANCHOR);
    d.down(ANCHOR);
    expect(d.up({ x: ANCHOR.x + 3, y: ANCHOR.y + 3 })).toBeNull();
  });

  it("데드존을 넘겨 떼면 그 조준을 돌려준다", () => {
    const d = createDragAim(ANCHOR);
    d.down(ANCHOR);
    const aim = d.up({ x: ANCHOR.x, y: ANCHOR.y + DEAD_ZONE + 50 });
    expect(aim).not.toBeNull();
    expect(aim!.angle).toBeCloseTo(0, 5);
  });

  it("떼고 나면 조준이 없다", () => {
    const d = createDragAim(ANCHOR);
    d.down(ANCHOR);
    d.up({ x: ANCHOR.x, y: ANCHOR.y + 100 });
    expect(d.current()).toBeNull();
  });

  it("cancel하면 조준이 사라지고 up이 null을 준다", () => {
    const d = createDragAim(ANCHOR);
    d.down(ANCHOR);
    d.move({ x: ANCHOR.x, y: ANCHOR.y + 100 });
    d.cancel();
    expect(d.current()).toBeNull();
    expect(d.up({ x: ANCHOR.x, y: ANCHOR.y + 100 })).toBeNull();
  });

  it("down 없이 move하면 아무 일도 없다", () => {
    const d = createDragAim(ANCHOR);
    d.move({ x: ANCHOR.x, y: ANCHOR.y + 100 });
    expect(d.current()).toBeNull();
  });

  it("위로 당겨도 각도는 아래를 향하지 않는다 — 좌우 한계값 중 하나로 클램프된다", () => {
    // 앵커보다 위(vy<0)를 끌면 클램프 전 각도가 항상 π/2보다 커진다(atan2의 x인자가
    // 음수이므로) — MAX_ANGLE(1.25) < π/2라서 vx의 부호와 무관하게 반드시 ±MAX_ANGLE로
    // 잘린다. 이게 새총 해석이다: 위로 당겨도 「아래로 쏘는」 각은 절대 나오지 않고,
    // 대신 당긴 방향과 반대쪽 벽에 붙는다.
    const d = createDragAim(ANCHOR);

    // 곧바로 위(vx=0) — Math.atan2(-0, -y)는 -π다(부호 있는 0의 관례). 클램프되어
    // -MAX_ANGLE로 떨어진다. 이 부호는 실제 동작이라 리팩터가 atan2 인자 순서나
    // 클램프 경계를 바꾸면 바로 깨지도록 고정해 둔다.
    d.down(ANCHOR);
    d.move({ x: ANCHOR.x, y: ANCHOR.y - 100 });
    expect(d.current()!.angle).toBe(-MAX_ANGLE);

    // 오른쪽 위로 당기면(vx>0) 새총 규칙대로 왼쪽 한계에 붙는다
    d.move({ x: ANCHOR.x + 50, y: ANCHOR.y - 100 });
    expect(d.current()!.angle).toBe(-MAX_ANGLE);

    // 왼쪽 위로 당기면(vx<0) 오른쪽 한계에 붙는다
    d.move({ x: ANCHOR.x - 50, y: ANCHOR.y - 100 });
    expect(d.current()!.angle).toBe(MAX_ANGLE);
  });
});
