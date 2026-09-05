// ui/hex/pushMotion.ts — 줄이 내려올 때의 움직임. 순수 계산이라 헤드리스로 테스트한다.
//
// 화면에서 눈으로 확인하기 가장 어려운 종류의 코드다(진폭 2px, 17Hz). 그래서
// 계산을 렌더에서 떼어 여기 둔다 — 스크린샷으로 위상을 맞춰 보는 대신 값을 검사한다.
import { ROW_H } from "./geom";

/** 흔들림이 시작되는 시점 — 밀기까지 이만큼 남으면 자글거리기 시작한다. */
export const SHAKE_LEAD_MS = 2000;
/** 최대 진폭(px). 「자글자글」이지 「흔들린다」가 아니다 — 2px면 충분히 읽힌다. */
export const SHAKE_AMP = 2.4;
/** 진동수(Hz). 사람이 「떨림」으로 읽는 하한이 대략 15Hz다. */
export const SHAKE_HZ = 17;
/** 한 칸 내려앉는 시간. */
export const SLIDE_MS = 170;

/**
 * 밀기 직전의 가로 떨림.
 *
 * 세기는 남은 시간의 **제곱**으로 커진다. 선형이면 8초 전부터 어렴풋이 떨려
 * 「항상 떨리는 판」이 되고, 제곱이면 마지막 1초에 몰려 경고로 읽힌다.
 *
 * @param msUntilPush 밀기까지 남은 시간(ms). 음수는 0으로 본다.
 * @param nowMs 위상을 정할 시각. 프레임마다 흐르는 값이면 무엇이든 된다.
 */
export function shakeX(msUntilPush: number, nowMs: number): number {
  if (msUntilPush > SHAKE_LEAD_MS) return 0;
  const t = 1 - Math.max(0, msUntilPush) / SHAKE_LEAD_MS;
  return Math.sin((nowMs / 1000) * Math.PI * 2 * SHAKE_HZ) * SHAKE_AMP * t * t;
}

/**
 * 새 줄이 내려앉는 세로 오프셋.
 *
 * 판은 밀기 직후 **이미 한 칸 아래에** 그려져 있다. 그래서 이전 자리(-ROW_H)에서
 * 출발시켜 0으로 당긴다 — 화면에서는 판이 미끄러져 내려온 것으로 보인다.
 *
 * easeOutBack이라 끝에서 살짝 지나쳤다 돌아온다. 그 과함이 「뿅」이다.
 *
 * @param elapsedMs 밀기 뒤 흐른 시간(ms).
 */
export function slideY(elapsedMs: number): number {
  if (elapsedMs >= SLIDE_MS) return 0;
  const t = Math.max(0, elapsedMs) / SLIDE_MS;
  const c1 = 1.70158;
  const c3 = c1 + 1;
  const eased = 1 + c3 * (t - 1) ** 3 + c1 * (t - 1) ** 2;
  return -ROW_H * (1 - eased);
}

/** 슬라이드가 끝났는가. */
export function slideDone(elapsedMs: number): boolean {
  return elapsedMs >= SLIDE_MS;
}
