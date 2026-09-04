// engine/settings.ts — 사용자 설정값의 형태와 해석. 순수 TS — 저장소를 모른다.
//
// 저장·구독은 ui/settings.ts가 맡는다. 여기에는 「무엇이 설정인가」와
// 「깨진 값을 어떻게 읽는가」만 둔다 — 그래야 헤드리스로 검증할 수 있다.

export interface Settings {
  /** 효과음 */
  sound: boolean;
  /** 배경음악 */
  music: boolean;
  /** 진동 */
  vibration: boolean;
}

/** 처음 켠 사람에게는 소리도 진동도 켜져 있다 — 끄는 것은 고르는 행동이다. */
export const DEFAULT_SETTINGS: Settings = { sound: true, music: true, vibration: true };

/** 저장된 값을 읽어 온다. 어긋난 필드만 기본값으로 되돌리고 나머지는 살린다 —
 *  설정 항목이 늘어도 예전 저장값이 통째로 버려지지 않아야 한다. */
export function parseSettings(raw: string | null): Settings {
  if (!raw) return { ...DEFAULT_SETTINGS };
  try {
    const o = JSON.parse(raw) as Partial<Settings> | null;
    if (o === null || typeof o !== "object") return { ...DEFAULT_SETTINGS };
    return {
      sound: typeof o.sound === "boolean" ? o.sound : DEFAULT_SETTINGS.sound,
      music: typeof o.music === "boolean" ? o.music : DEFAULT_SETTINGS.music,
      vibration: typeof o.vibration === "boolean" ? o.vibration : DEFAULT_SETTINGS.vibration,
    };
  } catch {
    return { ...DEFAULT_SETTINGS };
  }
}

export function serializeSettings(s: Settings): string {
  return JSON.stringify(s);
}
