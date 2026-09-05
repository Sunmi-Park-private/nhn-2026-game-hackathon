// tests/hex/stageDifficulty.test.ts — 판 난이도의 두 가지 약속.
//
// 본선 QA: 「전체적으로 난이도가 어려워졌다. 15초마다 줄이 내려오는 걸 25초로,
// 창살 둘레 타일 색 배치를 조금 더 쉽게」.
//
// 둘 다 데이터(stage-0N.json)에 박히는 값이라 코드를 봐서는 지켜졌는지 알 수 없다.
// 판을 손보다 한 판만 되돌아가는 일이 실제로 있었다 — 여기서 잰다.
//
// 이웃 판정은 **엔진의 neighbors()를 그대로 쓴다.** 테스트가 방향 벡터를 따로
// 들고 있으면 좌표 규약이 바뀔 때 조용히 어긋난다.
import { describe, it, expect } from "vitest";
import { stages } from "../../src/data/stages";
import { key, neighbors } from "../../src/engine/hex/coords";
import { POP_THRESHOLD } from "../../src/engine/hex/pop";

describe("줄이 내려오는 간격", () => {
  it("1판은 줄이 내려오지 않는다 — 시간 압박 없이 규칙만 익힌다", () => {
    expect(stages[0]!.pushSeconds).toBe(0);
  });

  it("나머지 판은 25초다", () => {
    for (const s of stages.slice(1)) expect(s.pushSeconds, s.id).toBe(25);
  });
});

describe("창살 둘레 타일", () => {
  /** 창살에 붙은 타일들. 창살 칸 자신과 빈 칸은 뺀다. */
  function ringOf(stage: (typeof stages)[number], cage: (typeof stages)[number]["cages"][number]) {
    const tileAt = new Map(stage.tiles.map((t) => [key(t.at), t]));
    const cageKeys = new Set(cage.cells.map(key));
    const out = new Map<string, (typeof stage.tiles)[number]>();
    for (const c of cage.cells) {
      for (const n of neighbors(c)) {
        const k = key(n);
        if (cageKeys.has(k)) continue;
        const t = tileAt.get(k);
        if (t) out.set(k, t);
      }
    }
    return [...out.values()];
  }

  // 한때 둘레를 **한 색**으로 모았다. 한 발이면 통째로 떨어져 쉽긴 했는데
  // 「단색은 안 된다」가 나왔다(QA). 지금은 **세 색을 두 칸씩** 두른다 —
  // 짝이 둘뿐이라 저절로 터지지 않고, 같은 색 한 발을 맞히면 셋이 되어 터진다
  // (POP_THRESHOLD가 3이다).
  it("둘레가 세 색으로 되어 있다 — 단색이 아니다", () => {
    for (const stage of stages) {
      for (const cage of stage.cages) {
        const tiers = new Set(ringOf(stage, cage).map((t) => t.tier));
        expect(tiers.size, `${stage.id} ${cage.id} — 색 ${[...tiers].join(",")}`).toBe(3);
      }
    }
  });

  it("둘레 안에서 같은 색이 셋 이상 잇달지 않는다 — 두 칸씩이라야 한 발이 필요하다", () => {
    for (const stage of stages) {
      for (const cage of stage.cages) {
        const ring = ringOf(stage, cage);
        const byKey = new Map(ring.map((t) => [key(t.at), t]));
        for (const t of ring) {
          const same = neighbors(t.at)
            .map((n) => byKey.get(key(n)))
            .filter((x) => x !== undefined && x.tier === t.tier);
          // 짝의 상대 하나까지다. 둘이면 그 자리에 이미 셋이 붙어 있다는 뜻이다.
          expect(same.length, `${stage.id} ${cage.id} (${t.at.q},${t.at.r})`).toBeLessThanOrEqual(1);
        }
      }
    }
  });

  it("둘레가 짝을 이룰 만큼 있다 — 세 색 두 칸씩이면 최소 여섯이다", () => {
    for (const stage of stages) {
      for (const cage of stage.cages) {
        expect(ringOf(stage, cage).length, `${stage.id} ${cage.id}`).toBeGreaterThanOrEqual(6);
      }
    }
  });

  it("둘레의 짝만으로는 저절로 터지지 않는다 — 두 칸 < 임계값 3", () => {
    expect(2).toBeLessThan(POP_THRESHOLD);
  });

  it("판의 색 가짓수가 줄지 않았다 — 새 줄은 초기 타일의 색에서 뽑는다", () => {
    // createRun의 palette가 stage.tiles에서 나온다. 재색칠로 한 색이 통째로
    // 사라지면 그 판은 그 색이 영영 안 나온다.
    for (const stage of stages) {
      expect(new Set(stage.tiles.map((t) => t.tier)).size, stage.id).toBeGreaterThanOrEqual(3);
    }
  });
});
