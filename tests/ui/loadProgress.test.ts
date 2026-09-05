// tests/ui/loadProgress.test.ts — 부트 진행률 카운터.
import { describe, it, expect, beforeEach } from "vitest";
import { beginLoad, endLoad, loadProgress, onLoadProgress, resetLoadProgress } from "../../src/ui/loadProgress";

beforeEach(resetLoadProgress);

describe("loadProgress", () => {
  it("시작·완료를 따로 센다 — 실패도 완료다", () => {
    beginLoad(); beginLoad(); beginLoad();
    endLoad(); endLoad();
    expect(loadProgress()).toEqual({ started: 3, settled: 2 });
  });

  it("바뀔 때마다 알리고, 떼면 더 안 온다", () => {
    let n = 0;
    const off = onLoadProgress(() => { n += 1; });
    beginLoad(); endLoad();
    expect(n).toBe(2);
    off();
    beginLoad();
    expect(n).toBe(2);
  });
});
