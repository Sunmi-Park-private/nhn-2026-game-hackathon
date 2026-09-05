// data/lobbyScene.ts — 로비 배경 영상 고르기.
//
// 로비 배경은 **구출한 마릿수마다 한 편씩** 있는 루핑 영상이다. N번째 영상에는
// 그때까지 구한 동물이 누적해 등장한다. 배경까지 통째로 그려진 전체화면 영상이라
// 코드가 동물을 따로 그리지 않는다.
//
// ⚠️ **키 이름의 동물과 그 자리의 동물은 무관하다.** 슬롯 id를 재활용하느라
// 키가 animals.ts 순서(rabbit·monkey·…)를 그대로 쓰지만, 실제 구출 순서는
// 스테이지가 정한다(지금은 양 → 얼룩말·사슴). 그러니 `lobby.friends.deer`는
// 「사슴 영상」이 아니라 **「3마리 구출 상태의 로비」**다. 에디터 라벨이 그렇게 적혀 있다.
import { ANIMALS } from "./animals";

/** 장면 키 목록 — 1마리 구출이 [0], 6마리가 [5]. */
export const SCENE_KEYS: readonly string[] = ANIMALS.map((a) => a.id);

/**
 * 구출 수에 맞는 장면 키. **구출 수 이하 중 있는 것 가운데 가장 큰 것**을 고른다.
 *
 * 두 가지를 한꺼번에 흡수하려고 이렇게 한다:
 *   · 구출 수가 1씩 늘지 않는다 — 한 판에서 두 마리를 구하면 1 다음이 3이다.
 *     3번 영상이 없으면 2번이 아니라 「3 이하 중 있는 것」으로 내려간다.
 *   · 아직 안 올라온 파일이 태반이다. 빈 자리는 건너뛰고 이전 장면을 계속 쓴다.
 *
 * 하나도 없거나 아직 한 마리도 못 구했으면 null — 호출부가 스틸 배경으로 간다.
 */
export function sceneFor(rescuedCount: number, has: (key: string) => boolean): string | null {
  return sceneCandidates(rescuedCount).find(has) ?? null;
}

/**
 * 구출 수에 맞는 장면 키를 **큰 것부터** 늘어놓는다. 앞에서부터 받아 보다가
 * 처음 성공하는 것을 쓰면 된다.
 *
 * 「있는지」를 경로만 보고는 알 수 없다 — 매니페스트에는 여섯 칸이 늘 다 들어 있고
 * (파일을 지워도 경로는 남긴다) 파일이 실제로 있는지는 받아 봐야 안다. 그래서
 * 호출부가 이 목록을 따라 내려가며 시도한다.
 */
export function sceneCandidates(rescuedCount: number): readonly string[] {
  if (!Number.isFinite(rescuedCount)) return [];
  const n = Math.min(Math.floor(rescuedCount), SCENE_KEYS.length);
  if (n < 1) return [];
  return SCENE_KEYS.slice(0, n).reverse();
}
