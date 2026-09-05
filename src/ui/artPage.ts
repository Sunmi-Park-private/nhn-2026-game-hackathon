// ui/artPage.ts — 「배경 아트 한 장 + 누를 수 있는 자리 몇 개」로 된 화면.
//
// 월드 지도와 이벤트가 같은 모양이다. 배경이 화면 전체를 그리고, 코드가 얹는 것은
// 버튼의 히트 영역뿐이다. 배경 위 나머지는 전부 그림이라 눌러도 아무 일이 없다.
//
// 막을 캔버스 전체에 깐다 — 없으면 그림 위를 눌렀을 때 뒤 화면(로비)의 PLAY나
// 하단 내비가 눌린다.
import { Container, Graphics, Text, type Texture } from "pixi.js";
import { BASE_W, stageTop, stageHeight, coverBox, contentRect } from "./stage";
import { fitSprite } from "./skin";
import { slot, type UiSlot } from "../data/uiLayout";
import { buzz } from "./settings";
import { playSfx } from "./audio";
import { editable, clearEditable } from "./layoutEditor";
import { applySlotHitArea } from "./slotHitRect";

export interface Box { x: number; y: number; w: number; h: number }

/** 누를 수 있는 자리 하나. 배치는 슬롯이 정하고, fallback은 슬롯이 없을 때만 쓴다. */
export interface ArtButton {
  id: string;
  label: string;
  fallback: Box;
  /** 아트가 없을 때 그릴 색 */
  fill: number;
  tex?: Texture;
  onTap: () => void;
}

function hotspot(area: string, b: UiSlot, btn: ArtButton): Container {
  const c = new Container();
  c.x = b.x;
  c.y = b.y;

  if (btn.tex) {
    const s = fitSprite(btn.tex, b.w, b.h);
    s.x = b.w / 2;
    s.y = b.h / 2;
    c.addChild(s);
  } else {
    const g = new Graphics().roundRect(0, 0, b.w, b.h, 10).fill({ color: btn.fill });
    g.roundRect(2, 2, b.w - 4, b.h - 4, 8).stroke({ width: 2, color: 0xffffff, alpha: 0.18 });
    c.addChild(g);
    const t = new Text({
      text: b.label,
      style: { fontSize: Math.min(15, b.h * 0.32), fill: 0xfff3dc, fontWeight: "bold" },
    });
    t.anchor.set(0.5);
    t.x = b.w / 2;
    t.y = b.h / 2;
    c.addChild(t);
  }
  // 투명이어도 히트 판정을 받으려면 실제로 채워야 한다(alpha 0)
  c.addChild(new Graphics().rect(0, 0, b.w, b.h).fill({ color: 0xffffff, alpha: 0 }));

  editable(area, b, c);
  // 터치 영역을 슬롯 상자에 못박는다 — 슬롯 배율(이벤트 cta는 3)이 히트 사각형까지
  // 키워서, 나중에 붙은 cta가 닫기 버튼을 통째로 덮고 탭을 가로챘다.
  applySlotHitArea(c, b);
  c.eventMode = "static";
  c.cursor = "pointer";
  c.on("pointertap", () => { buzz(); playSfx("audio.sfxTap"); btn.onTap(); });
  c.on("pointerdown", () => { c.alpha = 0.78; });
  const up = (): void => { c.alpha = 1; };
  c.on("pointerup", up);
  c.on("pointerupoutside", up);
  return c;
}

/**
 * 배경 한 장짜리 화면을 띄우고 닫힐 때까지 기다린다.
 *
 * buttons는 닫기 함수와 이 화면의 뿌리를 받아 목록을 돌려준다 — 버튼이 스스로 화면을
 * 닫아야 하고, 설정창 같은 모달은 이 화면 **위에** 떠야 하기 때문이다. 둘 다 이 함수
 * 안에서만 만들 수 있다.
 */
export function openArtPage<R>(
  parent: Container,
  o: {
    area: string;
    bg?: Texture;
    buttons: (close: (r: R) => void, root: Container) => ArtButton[];
  },
): Promise<R> {
  return new Promise<R>((resolve) => {
    const root = new Container();
    parent.addChild(root);

    // 밑의 화면(로비)을 가리고 그쪽 입력을 막는다. **콘텐츠 박스만** 가린다 — 좌우
    // 블리드는 main.ts의 기본 배경 영상 자리고, 거기엔 누를 것도 없다.
    const veil = contentRect(0x120c06);
    veil.eventMode = "static";
    root.addChild(veil);

    root.addChild(contentRect(0x241a10)); // 배경 아트가 없어도 박스가 비지 않게
    if (o.bg) root.addChild(coverBox(o.bg));
    root.addChild(
      new Graphics()
        .rect(0.5, stageTop() + 0.5, BASE_W - 1, stageHeight() - 1)
        .stroke({ width: 2, color: 0xc98a3c, alignment: 0 }),
    );

    let done = false;
    const close = (r: R): void => {
      if (done) return;
      done = true;
      clearEditable(o.area);
      root.destroy({ children: true });
      resolve(r);
    };

    for (const btn of o.buttons(close, root)) {
      const b = slot(o.area, btn.id) ?? { id: btn.id, label: btn.label, ...btn.fallback };
      root.addChild(hotspot(o.area, b, btn));
    }
  });
}
