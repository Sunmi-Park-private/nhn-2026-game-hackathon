// ui/endingRehearsal.ts — 「엔딩 흐름 보기」 치트가 만들 진행도.
//
// 엔딩 영상은 **마지막 판을 깨야만** 나온다(main.ts: last이면 story 대신 ending).
// 그 흐름 하나를 확인하려고 다섯 판을 다시 깨는 것은 비용이 너무 크다.
// 마지막 판만 남은 상태를 한 번에 만들어 주고, 그 판을 깨서 엔딩 → 로비를
// **실제 흐름 그대로** 보게 한다. 영상만 따로 띄우는 것과는 다르다 —
// 그렇게 하면 addClear·save·로비 복귀까지 이어지는 부분이 빠진다.

/** 이 함수가 건드리는 값만 적는다. 나머지 필드는 그대로 흘려보낸다. */
export interface RehearsalProfile {
  stageIndex: number;
  rescued: string[];
}

/**
 * 마지막 판 직전 상태를 만든다.
 *
 * @param profile   지금 진행도
 * @param animalIds 판 순서와 같은 동물 순서(data/animals.ts)
 * @param stageCount 전체 판 수
 */
export function endingRehearsal<T extends RehearsalProfile>(
  profile: T,
  animalIds: readonly string[],
  stageCount: number,
): T {
  // 판이 없으면 만들 상태가 없다 — 진행도를 망가뜨리지 않고 그대로 돌려준다
  if (stageCount <= 0) return profile;
  const lastIndex = stageCount - 1;
  return {
    ...profile,
    stageIndex: lastIndex,
    // 마지막 동물은 남긴다 — 그래야 마지막 판에 구할 것이 있고 엔딩까지 간다
    rescued: animalIds.slice(0, lastIndex),
  };
}
