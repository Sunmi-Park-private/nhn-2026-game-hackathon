import { describe, it, expect } from "vitest";
import { createTutorialCoach, TUTORIAL_STEPS } from "../../src/engine/tutorialCoach";

/** 단계 이름으로 인덱스를 잡는다 — 단계가 하나 늘 때마다 숫자를 다시 세지 않게. */
const PULL = 0;
const SHOOT = 1;
const MERGE = 2;
const CAGE = 3;

describe("tutorialCoach", () => {
  it("첫 단계를 곧바로 띄운다 — 판이 열리자마자 말을 건다", () => {
    const c = createTutorialCoach();
    expect(c.showing()).toEqual(TUTORIAL_STEPS[PULL]);
    expect(c.done()).toBe(false);
  });

  it("기다리는 것이 없는 단계는 탭하면 곧장 다음으로 넘어간다", () => {
    const c = createTutorialCoach();
    c.dismiss();
    expect(c.showing()).toEqual(TUTORIAL_STEPS[SHOOT]);
    expect(c.done()).toBe(false);
  });

  it("기다리는 것이 있는 단계는 닫으면 말풍선이 내려가고 조작이 풀린다", () => {
    const c = createTutorialCoach();
    c.dismiss();
    c.dismiss();
    expect(c.showing()).toBeNull();
    expect(c.done()).toBe(false);
  });

  it("닫기 전에는 트리거가 와도 다음 단계로 넘어가지 않는다", () => {
    const c = createTutorialCoach();
    c.dismiss();
    c.observe("shot");
    expect(c.showing()).toEqual(TUTORIAL_STEPS[SHOOT]);
  });

  it("닫은 뒤 발사하면 합체 단계가 뜬다", () => {
    const c = createTutorialCoach();
    c.dismiss();
    c.dismiss();
    c.observe("shot");
    expect(c.showing()).toEqual(TUTORIAL_STEPS[MERGE]);
  });

  it("기다리는 것과 다른 이벤트로는 넘어가지 않는다", () => {
    const c = createTutorialCoach();
    c.dismiss();
    c.dismiss();
    c.observe("merge"); // 발사 단계가 기다리는 것은 shot이다
    expect(c.showing()).toBeNull();
  });

  it("첫 발에 바로 합체가 나면 합체 단계를 닫는 순간 케이지 단계가 이어서 뜬다", () => {
    const c = createTutorialCoach();
    c.dismiss();
    c.dismiss();
    c.observe("shot");
    c.observe("merge"); // 같은 발에서 합체까지 났다
    expect(c.showing()).toEqual(TUTORIAL_STEPS[MERGE]); // 아직 합체 설명을 읽는 중
    c.dismiss();
    expect(c.showing()).toEqual(TUTORIAL_STEPS[CAGE]); // 이미 본 합체로 곧장 이어진다
  });

  it("같은 이벤트가 여러 번 와도 단계를 건너뛰지 않는다", () => {
    const c = createTutorialCoach();
    c.dismiss();
    c.dismiss();
    c.observe("shot");
    c.observe("shot");
    c.observe("shot");
    expect(c.showing()).toEqual(TUTORIAL_STEPS[MERGE]);
  });

  it("마지막 단계를 닫으면 끝난다 — 그 뒤 이벤트는 아무것도 띄우지 않는다", () => {
    const c = createTutorialCoach();
    c.dismiss();
    c.dismiss();
    c.observe("shot");
    c.dismiss();
    c.observe("merge");
    expect(c.showing()).toEqual(TUTORIAL_STEPS[CAGE]);
    c.dismiss();
    expect(c.done()).toBe(true);
    expect(c.showing()).toBeNull();
    c.observe("shot");
    c.observe("merge");
    expect(c.showing()).toBeNull();
    expect(c.done()).toBe(true);
  });

  it("끝난 뒤 dismiss를 또 불러도 조용하다", () => {
    const c = createTutorialCoach();
    for (let i = 0; i < 10; i += 1) {
      c.dismiss();
      c.observe("shot");
      c.observe("merge");
    }
    expect(c.done()).toBe(true);
    expect(() => c.dismiss()).not.toThrow();
  });

  it("네 단계다. 대사가 다 있고, 안내 단계만 기다리는 것이 없다", () => {
    expect(TUTORIAL_STEPS).toHaveLength(4);
    for (const s of TUTORIAL_STEPS) expect(s.text.length).toBeGreaterThan(0);
    expect(TUTORIAL_STEPS[PULL]!.awaits).toBeNull();
    expect(TUTORIAL_STEPS[PULL]!.point).toBe("pull");
    expect(TUTORIAL_STEPS[SHOOT]!.awaits).toBe("shot");
    expect(TUTORIAL_STEPS[MERGE]!.awaits).toBe("merge");
    expect(TUTORIAL_STEPS[CAGE]!.awaits).toBeNull();
    expect(TUTORIAL_STEPS[CAGE]!.point).toBe("cage");
  });
});
