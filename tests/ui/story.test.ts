// tests/ui/story.test.ts — 스테이지 사이 스토리 대사.
//
// 여기서 지키는 것은 문장이 아니라 **짝**이다. 스테이지 순서가 바뀌거나 동물이 늘면
// 대사가 조용히 어긋나는데(3판을 깼는데 사슴 대신 양 이야기가 나온다), 그때 여기가 빨개진다.
import { describe, it, expect } from "vitest";
import { STORY_BEATS, storyBeat } from "../../src/data/story";
import { stages } from "../../src/data/stages";
import { ANIMALS } from "../../src/data/animals";

/** 스테이지 정의에서 이 판이 구하는 동물 id를 뽑는다. 케이지가 여럿이면 첫 번째다. */
function stageAnimal(i: number): string | undefined {
  return stages[i]?.cages[0]?.animalId;
}

describe("스토리 비트", () => {
  it("마지막 스테이지를 뺀 판마다 하나씩 있다", () => {
    expect(STORY_BEATS.length).toBe(stages.length - 1);
  });

  it("각 비트는 2~3줄이다", () => {
    for (const b of STORY_BEATS) {
      expect(b.lines.length).toBeGreaterThanOrEqual(2);
      expect(b.lines.length).toBeLessThanOrEqual(3);
    }
  });

  it("빈 대사가 없다", () => {
    for (const b of STORY_BEATS) {
      for (const l of b.lines) expect(l.text.trim().length).toBeGreaterThan(0);
    }
  });

  it("말하는 쪽은 붉은말 아니면 방금 구한 동물이다", () => {
    for (const b of STORY_BEATS) {
      for (const l of b.lines) expect(["horse", "animal"]).toContain(l.who);
      // 한쪽만 떠드는 비트는 대화가 아니다 — 둘 다 한 번씩은 말한다
      expect(new Set(b.lines.map((l) => l.who)).size).toBe(2);
    }
  });

  it("구한 동물·다음 동물이 스테이지 순서와 맞는다", () => {
    STORY_BEATS.forEach((b, i) => {
      expect(b.rescuedId).toBe(stageAnimal(i));
      expect(b.nextId).toBe(stageAnimal(i + 1));
    });
  });

  it("마지막 비트는 코끼리를 가리킨다 — 그 판을 깨면 엔딩이다", () => {
    expect(STORY_BEATS[STORY_BEATS.length - 1]?.nextId).toBe("elephant");
  });

  it("쓰는 동물 id가 모두 도감에 있다", () => {
    const known = new Set(ANIMALS.map((a) => a.id));
    for (const b of STORY_BEATS) {
      expect(known.has(b.rescuedId)).toBe(true);
      expect(known.has(b.nextId)).toBe(true);
    }
  });

  it("다음 동물 이름이 대사 어딘가에 나온다 — 어디로 가는지 말하지 않으면 대사가 아니다", () => {
    const nameOf = new Map(ANIMALS.map((a) => [a.id, a.name]));
    for (const b of STORY_BEATS) {
      const name = nameOf.get(b.nextId) ?? "";
      const all = b.lines.map((l) => l.text).join(" ");
      expect(all).toContain(name);
    }
  });
});

describe("storyBeat", () => {
  it("깬 판의 인덱스로 비트를 준다", () => {
    expect(storyBeat(0)).toBe(STORY_BEATS[0]);
    expect(storyBeat(4)).toBe(STORY_BEATS[4]);
  });

  it("마지막 판을 깨면 없다 — 그 자리는 엔딩 영상이다", () => {
    expect(storyBeat(stages.length - 1)).toBeNull();
  });

  it("범위를 벗어난 값에도 터지지 않는다", () => {
    expect(storyBeat(-1)).toBeNull();
    expect(storyBeat(99)).toBeNull();
    expect(storyBeat(1.5)).toBeNull();
    expect(storyBeat(NaN)).toBeNull();
  });
});
