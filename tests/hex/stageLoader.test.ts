// tests/hex/stageLoader.test.ts — 스테이지 JSON 검증 (규약 3조: as unknown as 금지)
import { describe, it, expect } from "vitest";
import { parseStage } from "../../src/engine/hex/stageLoader";
import { stages } from "../../src/data/stages";

const good = {
  id: "s1",
  cols: 7,
  rows: 12,
  objective: 1, // 케이지가 하나뿐이므로 목표도 하나여야 한다 (Ruling K)
  shots: 20,
  cages: [{ id: "c1", animalId: "sheep", cells: [{ q: 2, r: 2 }, { q: 3, r: 2 }] }],
  tiles: [{ at: { q: 0, r: 0 }, tier: 0 }],
  horseshoes: [{ q: 1, r: 1 }],
};

describe("parseStage — 정상", () => {
  it("올바른 정의를 그대로 통과시킨다", () => {
    const s = parseStage(good);
    expect(s.id).toBe("s1");
    expect(s.cages).toHaveLength(1);
    expect(s.tiles[0]!.tier).toBe(0);
  });
});

describe("parseStage — 거부", () => {
  it("객체가 아니면 던진다", () => {
    expect(() => parseStage(null)).toThrow();
    expect(() => parseStage("x")).toThrow();
  });

  it("id가 없으면 던진다", () => {
    expect(() => parseStage({ ...good, id: undefined })).toThrow(/id/);
  });

  it("tier가 범위를 벗어나면 던진다", () => {
    expect(() => parseStage({ ...good, tiles: [{ at: { q: 0, r: 0 }, tier: 6 }] })).toThrow(/tier/);
  });

  it("tier가 정수가 아니면 던진다", () => {
    expect(() => parseStage({ ...good, tiles: [{ at: { q: 0, r: 0 }, tier: 1.5 }] })).toThrow(/tier/);
  });

  it("보드 밖 좌표는 던진다", () => {
    expect(() => parseStage({ ...good, horseshoes: [{ q: 99, r: 0 }] })).toThrow(/범위/);
  });

  it("케이지 셀이 비면 던진다", () => {
    expect(() => parseStage({
      ...good,
      cages: [{ id: "c1", animalId: "sheep", cells: [] }],
    })).toThrow(/cells/);
  });

  it("objective가 케이지 수보다 많으면 던진다", () => {
    expect(() => parseStage({ ...good, objective: 5 })).toThrow(/objective/);
  });

  it("셀이 겹치면 던진다", () => {
    expect(() => parseStage({
      ...good,
      tiles: [{ at: { q: 2, r: 2 }, tier: 0 }], // 케이지와 같은 자리
    })).toThrow(/겹/);
  });
});

describe("stages 데이터", () => {
  it("스테이지가 하나 이상 있다", () => {
    expect(stages.length).toBeGreaterThan(0);
  });

  it("모든 스테이지가 검증을 통과한다", () => {
    for (const s of stages) expect(() => parseStage(s)).not.toThrow();
  });

  it("id가 중복되지 않는다", () => {
    const ids = stages.map((s) => s.id);
    expect(new Set(ids).size).toBe(ids.length);
  });
});
