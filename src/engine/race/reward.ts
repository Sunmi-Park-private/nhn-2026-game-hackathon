// engine/race/reward.ts — 기록 갱신 판정과 보상.
//
// 보상 조건이 **자기 기록의 갱신**이라 반복 파밍이 규칙 안에서 닫힌다.
// 첫 기록도 갱신으로 치므로 동물마다 1회는 확정 보상이고(6마리 = 최소 6개),
// 그 뒤부터는 자기를 이겨야 한다. 별도 횟수 제한이 필요 없다.
//
// 순위는 보지 않는다 — AI 밸런싱이 틀려도 이 규칙은 안 깨진다.
import type { BoosterId } from "../hex/boosters";
import type { Profile } from "../profile";

export interface RaceReward {
  improved: boolean;
  /** 직전 최고기록(초). 첫 기록이면 null */
  previous: number | null;
  /** 갱신했을 때 나온 부스터. 아니면 null */
  booster: BoosterId | null;
}

const KINDS: readonly BoosterId[] = ["bomb", "rainbow", "horseshoe"];

/** 한 판을 정산한다. 프로필을 변형하지 않고 새 것을 돌려준다(addClear와 같은 방식). */
export function settleRace(
  p: Profile,
  animalId: string,
  time: number,
  rng: () => number = Math.random,
): { profile: Profile; reward: RaceReward } {
  const previous = p.raceBest[animalId] ?? null;
  const improved = previous === null || time < previous;

  if (!improved) {
    return { profile: p, reward: { improved: false, previous, booster: null } };
  }

  // rng가 1을 돌려줘도 배열 밖으로 나가지 않는다
  const booster = KINDS[Math.min(KINDS.length - 1, Math.floor(rng() * KINDS.length))]!;
  return {
    profile: {
      ...p,
      raceBest: { ...p.raceBest, [animalId]: time },
      boosters: { ...p.boosters, [booster]: p.boosters[booster] + 1 },
    },
    reward: { improved: true, previous, booster },
  };
}
