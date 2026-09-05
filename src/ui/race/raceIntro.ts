// ui/race/raceIntro.ts — 출발선 화면. 현수막 · 내 선수 이름 · 안내 문구.
//
// 좌표와 텍스처는 주입받는다(규약 2조) — 이 파일은 ../../data를 모른다.
import { Container, type Texture } from "pixi.js";
import { fitSprite } from "../skin";
import { slotText } from "./raceChrome";
import type { UiSlot } from "../../data/uiLayout";

export interface RaceIntro {
  node: Container;
  /** 선수가 정해졌다 — 이름을 걸고 안내 문구를 내린다 */
  setRunner: (name: string) => void;
  /** 다시 달리기로 돌아왔다 */
  reset: () => void;
}

export function createRaceIntro(o: {
  slots: { titleBanner: UiSlot; myRunnerTag: UiSlot; rosterHint: UiSlot };
  banner?: Texture;
  hint: string;
}): RaceIntro {
  const node = new Container();

  const b = o.slots.titleBanner;
  if (o.banner) {
    const s = fitSprite(o.banner, b.w, b.h);
    s.x = b.x + b.w / 2;
    s.y = b.y + b.h / 2;
    node.addChild(s);
  } else {
    const t = slotText(b, 30, 0xffd66b);
    t.text = "동물 운동회";
    node.addChild(t);
  }

  const tag = slotText(o.slots.myRunnerTag, 20, 0xffd66b);
  const hint = slotText(o.slots.rosterHint, 14, 0xb39b78);
  hint.text = o.hint;
  node.addChild(tag, hint);

  return {
    node,
    setRunner: (name) => {
      tag.text = `내 선수 · ${name}`;
      hint.visible = false;
    },
    reset: () => {
      tag.text = "";
      hint.visible = true;
    },
  };
}
