// ui/race/raceSlots.ts — 레이스 세 화면의 슬롯 기본 좌표.
//
// 배치는 uiLayout.json의 raceSelect·raceTrack·raceResult 영역이 정한다.
// 여기 값은 **그 영역이 없을 때만** 쓰는 폴백이다 — 슬롯이 지워지거나 아직 안 들어왔어도
// 화면이 깨지지 않아야 한다. 좌표는 디자이너 시안(1125×2000)을 450×800으로 줄인 값이다.
import { slot, type UiSlot } from "../../data/uiLayout";

/** [x, y, w, h] — 논리 좌표계 450×800 */
type Box = readonly [number, number, number, number];

export const RACE_AREAS = ["raceSelect", "raceTrack", "raceResult"] as const;
export type RaceAreaId = (typeof RACE_AREAS)[number];

const SELECT = {
  bg: [0, 0, 450, 800],
  back: [16, 22, 58, 42],
  gear: [384, 22, 50, 42],
  title: [100, 12, 240, 176],
  cardGrid: [40, 260, 364, 308],
  btnSelect: [112, 632, 228, 60],
} as const satisfies Record<string, Box>;

const TRACK = {
  bg: [0, 0, 450, 800],
  back: [16, 22, 58, 42],
  gear: [384, 22, 50, 42],
  laneFlags: [52, 256, 34, 376],
  trackArea: [100, 248, 340, 392],
  countdown: [185, 380, 80, 120],
  btnRace: [124, 700, 192, 60],
  hudRank: [100, 204, 110, 32],
  hudTime: [300, 204, 110, 32],
  distBar: [100, 644, 340, 12],
} as const satisfies Record<string, Box>;

const RESULT = {
  bg: [0, 0, 450, 800],
  winner: [172, 136, 108, 144],
  podium: [148, 280, 132, 40],
  resultList: [44, 332, 360, 316],
  rank1Face: [90, 336, 44, 44],
  rank2Face: [90, 389, 44, 44],
  rank3Face: [90, 441, 44, 44],
  rank4Face: [90, 494, 44, 44],
  rank5Face: [90, 547, 44, 44],
  rank6Face: [90, 599, 44, 44],
  btnRetry: [44, 680, 176, 48],
  btnClose: [228, 680, 156, 48],
  bestTag: [75, 650, 300, 26],
  rewardLabel: [180, 300, 120, 26],
} as const satisfies Record<string, Box>;

export const RACE_SLOT_IDS: Record<RaceAreaId, readonly string[]> = {
  raceSelect: Object.keys(SELECT),
  raceTrack: Object.keys(TRACK),
  raceResult: Object.keys(RESULT),
};

const FALLBACK: Record<RaceAreaId, Record<string, Box>> = {
  raceSelect: SELECT,
  raceTrack: TRACK,
  raceResult: RESULT,
};

export type SelectSlots = Record<keyof typeof SELECT, UiSlot>;
export type TrackSlots = Record<keyof typeof TRACK, UiSlot>;
export type ResultSlots = Record<keyof typeof RESULT, UiSlot>;

function read<T extends Record<string, Box>>(area: RaceAreaId, table: T): Record<keyof T, UiSlot> {
  const out = {} as Record<keyof T, UiSlot>;
  for (const id of Object.keys(table) as (keyof T & string)[]) {
    const [x, y, w, h] = table[id] as Box;
    out[id] = slot(area, id) ?? { id, label: id, x, y, w, h };
  }
  return out;
}

/** 세 화면의 슬롯을 한 번에 읽는다. 없는 것은 폴백으로 채운다. */
export function raceSlots(): { select: SelectSlots; track: TrackSlots; result: ResultSlots } {
  return {
    select: read("raceSelect", SELECT),
    track: read("raceTrack", TRACK),
    result: read("raceResult", RESULT),
  };
}

export const raceFallback = FALLBACK;
