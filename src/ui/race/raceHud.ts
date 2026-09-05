// ui/race/raceHud.ts — 주행 중 상단 표시. 순위 · 경과 시간 · 주행 게이지 · 카운트다운.
//
// 좌표는 주입받는다(규약 2조) — 이 파일은 ../../data를 모른다.
import { Container, Graphics } from "pixi.js";
import { slotText } from "./raceChrome";
import type { UiSlot } from "../../data/uiLayout";

export interface RaceHud {
  node: Container;
  /** 카운트다운 숫자는 트랙 위에 떠야 하므로 따로 붙인다 */
  countdown: Container;
  setRunning: (on: boolean) => void;
  setCountdown: (text: string | null) => void;
  update: (place: number, elapsed: number, progress: number) => void;
}

export function createRaceHud(slots: {
  hudRank: UiSlot;
  hudTime: UiSlot;
  distBar: UiSlot;
  countdown: UiSlot;
}): RaceHud {
  const node = new Container();
  node.visible = false;

  const rank = slotText(slots.hudRank, 19, 0xfff3dc);
  const time = slotText(slots.hudTime, 19, 0xfff3dc);

  const b = slots.distBar;
  const bg = new Graphics().roundRect(b.x, b.y, b.w, b.h, b.h / 2)
    .fill({ color: 0x000000, alpha: 0.35 });
  const fill = new Graphics();
  // 시안에는 주행 HUD가 없다 — 슬롯은 남기되 꺼 두고, 에디터에서 켤 수 있게 한다
  bg.visible = fill.visible = b.hidden !== true;
  node.addChild(bg, fill, rank, time);

  const count = slotText(slots.countdown, 96, 0xffd66b);
  count.visible = false;
  const countdown = new Container();
  countdown.addChild(count);

  return {
    node,
    countdown,
    setRunning: (on) => { node.visible = on; },
    setCountdown: (t) => {
      count.visible = t !== null;
      if (t !== null) count.text = t;
    },
    update: (place, elapsed, progress) => {
      rank.text = `${place}위 / 6`;
      time.text = `${elapsed.toFixed(2)}초`;
      const p = Math.min(1, Math.max(0, progress));
      fill.clear()
        .roundRect(b.x, b.y, Math.max(2, b.w * p), b.h, b.h / 2)
        .fill(0xffd66b);
    },
  };
}
