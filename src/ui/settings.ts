// ui/settings.ts — 사용자 설정. 화면과 오디오가 함께 읽는 단일 창구.
//
// 값은 localStorage에 남는다. 저장이 막힌 환경(프라이빗 모드 등)에서도
// 게임은 그대로 굴러가야 하므로 읽기·쓰기를 모두 감싼다.

export interface Settings {
  /** 효과음 */
  sound: boolean;
  /** 배경음악 */
  music: boolean;
  /** 진동 */
  vibration: boolean;
}

const KEY = "redhorserescue.settings";

function read(): Settings {
  const fallback: Settings = { sound: true, music: true, vibration: true };
  try {
    const raw = localStorage.getItem(KEY);
    if (!raw) return fallback;
    const o = JSON.parse(raw) as Partial<Settings>;
    return {
      sound: typeof o.sound === "boolean" ? o.sound : fallback.sound,
      music: typeof o.music === "boolean" ? o.music : fallback.music,
      vibration: typeof o.vibration === "boolean" ? o.vibration : fallback.vibration,
    };
  } catch {
    return fallback;
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
  try { localStorage.setItem(KEY, JSON.stringify(current)); } catch { /* 저장 실패는 무시 */ }
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
