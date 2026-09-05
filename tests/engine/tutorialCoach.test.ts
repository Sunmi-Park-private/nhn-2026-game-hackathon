import { describe, it, expect } from "vitest";
import { createTutorialCoach, TUTORIAL_STEPS } from "../../src/engine/tutorialCoach";

describe("tutorialCoach", () => {
  it("첫 단계를 곧바로 띄운다 — 판이 열리자마자 말을 건다", () => {
    const c = createTutorialCoach();
    expect(c.showing()).toEqual(TUTORIAL_STEPS[0]);
    expect(c.done()).toBe(false);
  });

  it("탭으로 닫으면 말풍선이 내려가고 조작이 풀린다", () => {
    const c = createTutorialCoach();
    c.dismiss();
    expect(c.showing()).toBeNull();
    expect(c.done()).toBe(false);
  });

  it("닫기 전에는 트리거가 와도 다음 단계로 넘어가지 않는다", () => {
    const c = createTutorialCoach();
    c.observe("shot");
    expect(c.showing()).toEqual(TUTORIAL_STEPS[0]);
  });

  it("닫은 뒤 발사하면 2단계가 뜬다", () => {
    const c = createTutorialCoach();
    c.dismiss();
    c.observe("shot");
    expect(c.showing()).toEqual(TUTORIAL_STEPS[1]);
  });

  it("기다리는 것과 다른 이벤트로는 넘어가지 않는다", () => {
    const c = createTutorialCoach();
    c.dismiss();
    c.observe("merge"); // 1단계가 기다리는 것은 shot이다
    expect(c.showing()).toBeNull();
  });

  it("첫 발에 바로 합체가 나면 2단계를 닫는 순간 3단계가 이어서 뜬다", () => {
    const c = createTutorialCoach();
    c.dismiss();
    c.observe("shot");
    c.observe("merge"); // 같은 발에서 합체까지 났다
    expect(c.showing()).toEqual(TUTORIAL_STEPS[1]); // 아직 2단계를 읽는 중
    c.dismiss();
    expect(c.showing()).toEqual(TUTORIAL_STEPS[2]); // 이미 본 합체로 곧장 이어진다
  });

  it("같은 이벤트가 여러 번 와도 단계를 건너뛰지 않는다", () => {
    const c = createTutorialCoach();
    c.dismiss();
    c.observe("shot");
    c.observe("shot");
    c.observe("shot");
    expect(c.showing()).toEqual(TUTORIAL_STEPS[1]);
  });

  it("마지막 단계를 닫으면 끝난다 — 그 뒤 이벤트는 아무것도 띄우지 않는다", () => {
    const c = createTutorialCoach();
    c.dismiss();
    c.observe("shot");
    c.dismiss();
    c.observe("merge");
    expect(c.showing()).toEqual(TUTORIAL_STEPS[2]);
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
    c.dismiss();
    c.observe("shot");
    c.dismiss();
    c.observe("merge");
    c.dismiss();
    expect(() => c.dismiss()).not.toThrow();
    expect(c.done()).toBe(true);
  });

  it("단계마다 대사가 있고, 마지막만 기다리는 것이 없다", () => {
    expect(TUTORIAL_STEPS).toHaveLength(3);
    for (const s of TUTORIAL_STEPS) expect(s.text.length).toBeGreaterThan(0);
    expect(TUTORIAL_STEPS[0]!.awaits).toBe("shot");
    expect(TUTORIAL_STEPS[1]!.awaits).toBe("merge");
    expect(TUTORIAL_STEPS[2]!.awaits).toBeNull();
  });
});
