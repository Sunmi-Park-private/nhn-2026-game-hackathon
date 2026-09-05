// ui/gameOverLayout.ts — 게임오버 창의 좌표·에셋 이름. Pixi도 data도 물리지 않는다.
//
// confirmLayout.ts와 같은 이유로 화면 파일에서 떼어 냈다: 테스트가 헤드리스로 돌아야 하고,
// 슬롯이 없을 때의 폴백과 uiLayout.json의 값이 갈라지지 않는지 견줄 곳이 필요하다.
//
// 좌표계는 중앙 콘텐츠 컬럼 450×800이다. 값은 아트가 오기 전 코드가 그리던 그림 그대로다.

/** uiLayout.json의 영역 id. 에디터 탭 이름은 그 파일의 label이 정한다. */
export const GAMEOVER_AREA = "gameover";

export interface Box { x: number; y: number; w: number; h: number }

/** 슬롯이 없을 때 쓰는 자리. uiLayout.json의 gameover 영역과 **같아야 한다**. */
export const GAMEOVER_FALLBACK = {
  /** 창 바탕 */
  panel: { x: 75, y: 290, w: 300, h: 220 },
  /** 「게임 오버」 — 제목이 새겨진 패널 아트가 오면 hidden으로 끈다 */
  title: { x: 105, y: 312, w: 240, h: 44 },
  /** 안내문 — 가운데 정렬이라 폭이 곧 줄바꿈 폭이다 */
  message: { x: 97, y: 366, w: 256, h: 56 },
  /** 로비가 왼쪽 — 이 판의 진행은 어차피 끝났으니 다시 도전이 기본 동선이다 */
  lobby: { x: 99, y: 436, w: 120, h: 48 },
  /** 다시 도전이 오른쪽 */
  retry: { x: 231, y: 436, w: 120, h: 48 },
} as const satisfies Record<string, Box>;

export type GameOverSlotId = keyof typeof GAMEOVER_FALLBACK;

/** 아트를 얹는 칸 → assets.json의 ui 블록 키. 제목·안내문은 코드가 그려서 여기 없다.
 *  런타임은 이 표를 안 쓴다 — 화면은 슬롯의 asset 문자열을 따라간다. 표류 방지용 기준점이다. */
export const GAMEOVER_ASSETS = {
  panel: "gameOverPanel",
  lobby: "btnGameOverLobby",
  retry: "btnGameOverRetry",
} as const;
