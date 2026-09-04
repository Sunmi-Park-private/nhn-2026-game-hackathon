// tests/hex/settings.test.ts — 설정값의 저장·복원
import { describe, it, expect } from "vitest";
import { DEFAULT_SETTINGS, parseSettings, serializeSettings } from "../../src/engine/settings";

describe("parseSettings", () => {
  it("저장한 값을 그대로 되살린다", () => {
    const s = { sound: false, music: true, vibration: false };
    expect(parseSettings(serializeSettings(s))).toEqual(s);
  });

  it("없거나 깨진 값이면 전부 켜진 기본값 — 게임이 못 뜨는 일은 없어야 한다", () => {
    expect(parseSettings(null)).toEqual(DEFAULT_SETTINGS);
    expect(parseSettings("{{{")).toEqual(DEFAULT_SETTINGS);
    expect(parseSettings("null")).toEqual(DEFAULT_SETTINGS);
    expect(DEFAULT_SETTINGS).toEqual({ sound: true, music: true, vibration: true });
  });

  it("타입이 어긋난 필드만 기본값으로 되돌린다 — 나머지는 살린다", () => {
    const s = parseSettings('{"sound":false,"music":"yes"}');
    expect(s).toEqual({ sound: false, music: true, vibration: true });
  });
});
