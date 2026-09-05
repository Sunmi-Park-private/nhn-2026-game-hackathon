// ui/race/raceSlots.ts — 레이스 슬롯의 기본 좌표.
//
// 배치는 uiLayout.json의 race 영역이 정한다. 여기 값은 **그 영역이 없을 때만** 쓰는
// 폴백이다 — 슬롯이 지워지거나 아직 안 들어왔어도 화면이 깨지지 않아야 한다.
//
// 같은 객체를 계속 돌려준다. 다시 그릴 때 새 객체를 주면 레이아웃 에디터가 잡고 있던
// 슬롯과 어긋나 편집이 저장되지 않는다.
import { slot, type UiSlot } from "../../data/uiLayout";

const AREA = "race";

/** [x, y, w, h] — 논리 좌표계 450×800 */
const FALLBACK = {
  back: [14, 12, 56, 40],
  gear: [400, 10, 40, 40],
  titleBanner: [105, 64, 240, 52],
  myRunnerTag: [125, 126, 200, 40],
  trackArea: [12, 344, 426, 336],
  rosterHint: [100, 288, 250, 26],
  pick: [123, 700, 204, 72],
  countdown: [165, 352, 120, 150],
  hudRank: [82, 20, 110, 38],
  hudTime: [250, 20, 140, 38],
  distBar: [14, 70, 422, 14],
  run: [105, 694, 240, 84],
  resultPanel: [40, 138, 370, 522],
  resultTitle: [100, 170, 250, 46],
  resultList: [68, 232, 314, 264],
  bestTag: [143, 506, 164, 34],
  rewardIcon: [152, 548, 58, 58],
  rewardLabel: [220, 562, 150, 30],
  retry: [62, 608, 148, 52],
  close: [240, 608, 148, 52],
} as const satisfies Record<string, readonly [number, number, number, number]>;

export type RaceSlotId = keyof typeof FALLBACK;

/** 슬롯 20개를 한 번에 읽는다. 없는 것은 폴백으로 채운다. */
export function raceSlots(): Record<RaceSlotId, UiSlot> {
  const out = {} as Record<RaceSlotId, UiSlot>;
  for (const id of Object.keys(FALLBACK) as RaceSlotId[]) {
    const [x, y, w, h] = FALLBACK[id];
    out[id] = slot(AREA, id) ?? { id, label: id, x, y, w, h };
  }
  return out;
}
