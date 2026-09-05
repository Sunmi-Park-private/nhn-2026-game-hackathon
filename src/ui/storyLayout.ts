// ui/storyLayout.ts — 스토리 대사창의 좌표. Pixi도 data도 물리지 않는다.
//
// gameOverLayout.ts와 같은 이유로 화면 파일에서 떼어 냈다 — 자리를 옮길 때 렌더 코드를
// 읽지 않아도 되고, 헤드리스에서 값만 견줄 수 있다.
//
// **uiLayout.json에 영역을 만들지 않았다.** 대사창은 아트 슬롯이 없어 에디터에서
// 옮길 것이 없고, uiLayout.json은 지금 여러 브랜치가 동시에 고치는 파일이라
// 줄 하나를 위해 충돌을 살 이유가 없다. 아트가 오면 그때 영역을 판다.
//
// 좌표계는 중앙 콘텐츠 컬럼 450×800이다.

export interface Box { x: number; y: number; w: number; h: number }

export const STORY_LAYOUT = {
  /** 대사창 바탕 — 화면 아래 3분의 1 */
  panel: { x: 24, y: 566, w: 402, h: 190 },
  /** 이름표 — 패널 위쪽에 걸친다 */
  name: { x: 44, y: 546, w: 150, h: 34 },
  /** 대사 본문 — 폭이 곧 줄바꿈 폭이다 */
  text: { x: 48, y: 600, w: 354, h: 120 },
  /** 붉은말 초상 — 왼쪽, 패널 위에 선다 */
  horse: { x: 6, y: 300, w: 220, h: 280 },
  /** 방금 구한 동물 초상 — 오른쪽 */
  animal: { x: 224, y: 300, w: 220, h: 280 },
  /** 「다음 ▶」 힌트 — 패널 우하단 */
  hint: { x: 306, y: 722, w: 100, h: 24 },
  /** 건너뛰기 — 우상단. 영상 건너뛰기와 같은 자리다 */
  skip: { x: 356, y: 16, w: 80, h: 32 },
} as const satisfies Record<string, Box>;

/** 말하지 않는 쪽 초상의 밝기. 0이면 사라져 「둘이 나눈 대화」로 안 읽힌다 */
export const DIM_ALPHA = 0.45;

/** 말하는 쪽 초상이 살짝 커진다 — 누가 말하는지 색만으로는 덜 읽힌다 */
export const SPEAKING_SCALE = 1.06;
