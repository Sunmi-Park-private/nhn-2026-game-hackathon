// data/race.ts — 레이스 튜닝 상수. 엔진과 UI가 같은 값을 각자 들면 밸런싱이 두 곳에서 어긋난다.
//
// 여기 숫자를 만지면 tests/race/step.test.ts의 「스펙의 세 속도」가 먼저 깨진다.
// 그게 이 표의 안전장치다.
export const RACE = {
  /** 결승선까지 (m) */
  DISTANCE: 100,
  /** 걷기 보폭 / 질주 보폭 (m) */
  STRIDE_MIN: 0.8,
  STRIDE_MAX: 2.2,
  /** 분당 걸음 수 — 1초에 1탭 / 0.2초에 1탭 */
  SPM_WALK: 60,
  SPM_SPRINT: 300,
  /** 탭 간격 지수이동평균 계수 — 손가락 떨림을 걸러낸다 */
  GAP_SMOOTH: 0.5,
  /** 몸이 걸음을 따라잡는 속도 (1/s) */
  CATCHUP: 14,
  /** 리듬이 죽었다고 볼 간격 (s). 이보다 오래 안 누르면 spm이 0이다 */
  GAP_DEAD: 4,
  /** AI 페이스 범위 (m/s) */
  PACE_MIN: 4.0,
  PACE_MAX: 6.5,
  /** AI 리듬 변동 폭 · 막판 스퍼트 폭 */
  WOBBLE: 0.12,
  SPURT: 0.15,
  /** 화면 배율 — 450px 폭이 약 17m 시야가 된다 */
  PX_PER_M: 26,
  /** 내 러너가 서는 화면 x */
  CAMERA_X: 90,
  /** 배경 3층 스크롤 계수 */
  PARALLAX: { sky: 0.15, mid: 0.45, track: 1 },
  /** 카운트다운 길이 (s) */
  COUNTDOWN: 1.8,
  /** 내가 들어온 뒤 남은 선수를 굴리는 배속.
   *  시뮬레이션이 시간의 함수라 빨리 감아도 기록은 실시간과 같다 —
   *  바뀌는 것은 기다리는 사람의 시간뿐이다. */
  TAIL_SPEED: 6,
  /** 랜덤 뽑기 가중 — 구출한 동물 : 못 구한 동물 */
  PICK_WEIGHT: { rescued: 3, locked: 1 },
} as const;
