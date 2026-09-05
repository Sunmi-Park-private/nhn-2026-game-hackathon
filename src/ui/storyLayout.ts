// ui/storyLayout.ts — 스토리 대사창의 좌표. Pixi도 data도 물리지 않는다.
//
// gameOverLayout.ts와 같은 형식이다 — 자리를 옮길 때 렌더 코드를 읽지 않아도 되고,
// 헤드리스에서 값만 견줄 수 있다.
//
// **처음엔 uiLayout.json에 영역을 만들지 않았다.** 아트 슬롯이 없어 에디터에서 옮길 것이
// 없었고, 그 파일은 여러 브랜치가 동시에 고친다는 이유였다. 지금은 초상 아트(붉은말 1종·
// 동물 6종)가 생겨 옮길 것이 실제로 있으므로 그 판단을 뒤집고 `story` 영역을 만들었다.
// 아래 값은 그 영역의 **폴백**이다 — uiLayout.json의 story 영역과 같아야 한다.
//
// 좌표계는 중앙 콘텐츠 컬럼 450×800이다.

/** uiLayout.json의 영역 id. 에디터 탭 이름(「대사」)은 그 파일의 label이 정한다. */
export const STORY_AREA = "story";

export interface Box { x: number; y: number; w: number; h: number }

export const STORY_FALLBACK = {
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
  /** 「탭하여 계속 ▶」 — 패널 우하단 */
  hint: { x: 306, y: 722, w: 100, h: 24 },
} as const satisfies Record<string, Box>;

export type StorySlotId = keyof typeof STORY_FALLBACK;

/** 슬롯이 없을 때 붙이는 이름 — 에디터 목록에 그대로 뜬다. */
export const STORY_LABELS: Record<StorySlotId, string> = {
  panel: "대사창", name: "이름표", text: "대사 본문",
  horse: "붉은말 초상", animal: "동물 초상", hint: "탭 안내",
};

/** 건너뛰기 버튼 — 영상 건너뛰기와 같은 자리라 에디터에 열지 않는다(코드가 정한다). */
export const STORY_SKIP: Box = { x: 356, y: 16, w: 80, h: 32 };

/** 말하지 않는 쪽 초상의 밝기. 0이면 사라져 「둘이 나눈 대화」로 안 읽힌다 */
export const DIM_ALPHA = 0.45;

/** 말하는 쪽 초상이 살짝 커진다 — 누가 말하는지 색만으로는 덜 읽힌다 */
export const SPEAKING_SCALE = 1.06;
