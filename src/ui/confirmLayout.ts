// ui/confirmLayout.ts — 확인창의 좌표·에셋 이름. Pixi도 data도 물리지 않는다.
//
// confirmDialog.ts에서 떼어 낸 이유는 둘이다:
//   · 테스트가 헤드리스로 돌아야 한다 — Pixi를 import하는 파일은 vitest에서 못 읽는다
//   · 슬롯이 없을 때의 폴백과 uiLayout.json의 값이 갈라지지 않는지 견줄 곳이 필요하다
//
// 좌표계는 중앙 콘텐츠 컬럼 450×800이다. 여기 값은 아트가 오기 전 코드가 그리던
// 그림 그대로다 — 슬롯을 지워도 창이 튀지 않는 것이 이 파일의 일이다.

/** uiLayout.json의 영역 id. 에디터 탭 이름은 그 파일의 label이 정한다. */
export const CONFIRM_AREA = "confirm";

export interface Box { x: number; y: number; w: number; h: number }

/** 슬롯이 없을 때 쓰는 자리. uiLayout.json의 confirm 영역과 **같아야 한다**. */
export const CONFIRM_FALLBACK = {
  /** 창 바탕 */
  panel: { x: 75, y: 256, w: 300, h: 289 },
  /** 묻는 말 — 가운데 정렬이라 폭이 곧 줄바꿈 폭이다 */
  message: { x: 97, y: 340, w: 256, h: 60 },
  /** 취소가 왼쪽. 사고로 눌렸을 때 아무 일도 없는 쪽이다 */
  cancel: { x: 99, y: 420, w: 120, h: 48 },
  /** 확인이 오른쪽 — 「계속하기 · 홈으로」와 같은 방향으로 읽힌다 */
  ok: { x: 231, y: 420, w: 120, h: 48 },
} as const satisfies Record<string, Box>;

export type ConfirmSlotId = keyof typeof CONFIRM_FALLBACK;

/** 아트를 얹는 칸 → assets.json의 ui 블록 키. 묻는 말은 코드가 그려서 여기 없다.
 *
 *  런타임은 이 표를 안 쓴다 — 화면은 슬롯의 asset 문자열을 따라간다. 이건 **표류 방지용
 *  기준점**이다: 같은 키 세 개가 uiLayout.json·assets.json·hexAssets.ts 세 곳에 흩어져
 *  있어서, 테스트가 그 셋을 한 번에 견주려면 붙잡을 곳이 하나 필요하다. */
export const CONFIRM_ASSETS = {
  panel: "confirmPanel",
  cancel: "btnConfirmCancel",
  ok: "btnConfirmOk",
} as const;
