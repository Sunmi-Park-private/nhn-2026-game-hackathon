// ui/settings.ts — 사용자 설정. 화면과 오디오가 함께 읽는 단일 창구.
//
// 값의 형태와 해석은 engine/settings.ts가 갖는다(헤드리스 테스트 대상).
// 여기 남는 것은 브라우저에 묶인 것뿐이다 — localStorage 저장, 구독, 진동.
// 저장이 막힌 환경(프라이빗 모드 등)에서도 게임은 그대로 굴러가야 하므로
// 읽기·쓰기를 모두 감싼다.
import { DEFAULT_SETTINGS, parseSettings, serializeSettings, type Settings } from "../engine/settings";

export type { Settings };

const KEY = "redhorserescue.settings";

function read(): Settings {
  try {
    return parseSettings(localStorage.getItem(KEY));
  } catch {
    return { ...DEFAULT_SETTINGS }; // localStorage 접근 자체가 막힌 환경
  }
}

let current = read();
const listeners = new Set<(s: Settings) => void>();

export function settings(): Settings {
  return current;
}

/** 값 하나를 뒤집고 저장한 뒤, 듣고 있는 쪽에 알린다. */
export function toggle(key: keyof Settings): boolean {
  current = { ...current, [key]: !current[key] };
  try { localStorage.setItem(KEY, serializeSettings(current)); } catch { /* 저장 실패는 무시 */ }
  for (const fn of listeners) fn(current);
  return current[key];
}

/** 설정이 바뀔 때 호출된다. 해제 함수를 돌려준다. */
export function onSettingsChange(fn: (s: Settings) => void): () => void {
  listeners.add(fn);
  return () => listeners.delete(fn);
}

/** 짧은 진동. 설정이 꺼져 있거나 기기가 지원하지 않으면 아무 일도 안 한다. */
export function buzz(ms = 12): void {
  if (!current.vibration) return;
  try { navigator.vibrate?.(ms); } catch { /* 지원하지 않는 브라우저 */ }
}
