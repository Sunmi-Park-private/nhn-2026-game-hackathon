// 「엔딩 흐름 보기」 치트가 만들 상태 — 6판을 깨기 직전이다.
//
// 엔딩은 마지막 판을 깨야만 나온다. 그때까지 다섯 판을 다시 깨는 것은 확인 비용이
// 너무 크다. 그 직전 상태를 한 번에 만들어 주고, 마지막 판만 깨서 엔딩 → 로비를
// 실제 흐름 그대로 보게 한다.
import { describe, expect, it } from "vitest";
import { endingRehearsal } from "../../src/ui/endingRehearsal";

const ANIMAL_IDS = ["rabbit", "monkey", "deer", "sheep", "zebra", "elephant"];
const base = { stageIndex: 0, rescued: [] as string[], horseshoes: 0 };

describe("엔딩 흐름 치트가 만드는 상태", () => {
  it("마지막 판만 남는다 — 그 앞의 동물은 모두 구출된 상태다", () => {
    const p = endingRehearsal(base, ANIMAL_IDS, 6);
    expect(p.stageIndex).toBe(5);
    expect(p.rescued).toEqual(ANIMAL_IDS.slice(0, 5));
  });

  it("마지막 동물은 아직 안 구했다 — 그래야 마지막 판에 구할 것이 있다", () => {
    const p = endingRehearsal(base, ANIMAL_IDS, 6);
    expect(p.rescued).not.toContain("elephant");
    expect(p.rescued).toHaveLength(5);
  });

  it("나머지 값은 건드리지 않는다", () => {
    const p = endingRehearsal({ ...base, horseshoes: 7 }, ANIMAL_IDS, 6);
    expect(p.horseshoes).toBe(7);
  });

  it("판이 한 개뿐이면 첫 판이 곧 마지막이다 — 구출 목록은 비운다", () => {
    const p = endingRehearsal(base, ANIMAL_IDS, 1);
    expect(p.stageIndex).toBe(0);
    expect(p.rescued).toEqual([]);
  });

  it("판이 없으면 그대로 둔다 — 치트가 진행도를 망가뜨리지 않는다", () => {
    const p = endingRehearsal({ ...base, stageIndex: 3 }, ANIMAL_IDS, 0);
    expect(p.stageIndex).toBe(3);
  });
});
