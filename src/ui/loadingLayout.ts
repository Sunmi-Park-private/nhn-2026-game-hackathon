// ui/loadingLayout.ts — 게임시작 로딩 화면의 좌표·문구·계산. Pixi도 data도 물리지 않는다.
//
// gameOverLayout.ts와 같은 이유로 화면 파일에서 떼어 냈다: 테스트가 헤드리스로 돌아야 하고,
// 슬롯이 없을 때의 폴백과 uiLayout.json의 값이 갈라지지 않는지 견줄 곳이 필요하다.
//
// 좌표계는 중앙 콘텐츠 컬럼 450×800이다.

/** uiLayout.json의 영역 id. 에디터 탭 이름은 그 파일의 label이 정한다. */
export const LOADING_AREA = "loading";

export interface Box { x: number; y: number; w: number; h: number }

/** 슬롯이 없을 때 쓰는 자리. uiLayout.json의 loading 영역과 **같아야 한다**.
 *  시안처럼 화면 아래쪽 1/4에 가로로 넓게 — 세로 영상의 인물이 위에 서 있어도 가리지 않는다. */
export const LOADING_FALLBACK = {
  /** 제목·팁·게이지가 든 반투명 패널. 슬롯의 color가 게이지 색, fontSize가 제목 크기다 */
  panel: { x: 36, y: 585, w: 378, h: 120 },
} as const satisfies Record<string, Box>;

export type LoadingSlotId = keyof typeof LOADING_FALLBACK;

/** 게이지 채움 색 — 슬롯의 color가 없을 때 */
export const LOADING_BAR_COLOR = "#ff6fae";

export const LOADING_TEXT = {
  title: "동물 친구들을 구하러 가는 중이에요…",
  tip: "Tip. 같은 색 타일 3개를 맞추면 케이지에 금이 가요",
} as const;

/** 진행률 0..1. 아직 하나도 시작 안 했으면 0 — 0/0을 NaN으로 두면 게이지가 사라진다.
 *  started는 로더가 시작할 때마다 늘어나므로 settled가 잠깐 앞설 일은 없지만, 넘어도 1에서 막는다. */
export function loadingFraction(settled: number, started: number): number {
  if (!(started > 0)) return 0;
  return Math.min(1, Math.max(0, settled / started));
}

/** 450×800 좌표의 상자를 콘텐츠 컬럼에 대한 백분율로. 호스트가 컬럼 크기를 따라가므로
 *  창이 돌아가도 다시 계산할 것이 없다. */
export function panelPercent(b: Box, base = { w: 450, h: 800 }): { left: number; top: number; width: number; height: number } {
  return {
    left: (b.x / base.w) * 100,
    top: (b.y / base.h) * 100,
    width: (b.w / base.w) * 100,
    height: (b.h / base.h) * 100,
  };
}
