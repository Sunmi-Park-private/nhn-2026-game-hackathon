// ui/storyView.ts — 대사창의 **그림**. 흐름(어느 줄인지·언제 닫는지)은 storyDialog.ts가 쥔다.
//
// 둘로 나눈 이유는 두 가지다. 한 파일이 200줄을 넘고 있었고(규약 1조), 자리를 에디터에서
// 끌 수 있게 되면서 「슬롯을 읽어 노드를 만드는 일」이 흐름과 섞이면 읽기 어려워졌다.
//
// 좌표는 **주입받는다**(규약 2조) — 이 파일도 ../data를 모른다. 슬롯이 없으면 폴백으로 간다.
import { Container, Graphics, Text, type Texture } from "pixi.js";
import { fullRect, contentRect } from "./stage";
import { fitSprite } from "./skin";
import { editable } from "./layoutEditor";
import { STORY_AREA, STORY_FALLBACK, STORY_LABELS, type Box, type StorySlotId } from "./storyLayout";

/** uiLayout의 UiSlot과 같은 모양 — 여기서는 타입만 받는다(규약 2조). */
export interface StorySlot extends Box {
  id: string;
  label: string;
  fontSize?: number;
  color?: string;
  hidden?: boolean;
}

export interface StoryViewOptions {
  /** 영역의 슬롯을 id로 찾는다. null이면 폴백. **원본을 줘야** 에디터 편집이 저장된다. */
  slot?: (id: StorySlotId) => StorySlot | null;
  horseTex?: Texture;
  animalTex?: Texture;
}

export interface StoryView {
  root: Container;
  /** 탭을 받는 막 — 캔버스 전체 */
  veil: Graphics;
  horse: Container;
  animal: Container;
  name: Text;
  body: Text;
  hint: Text;
  /** 첫 줄을 그린 **뒤에** 부른다 — 글자가 비어 있으면 에디터가 크기를 못 잡는다 */
  register(): void;
}

const num = (v: number | undefined, fallback: number): number =>
  typeof v === "number" && Number.isFinite(v) && v > 0 ? v : fallback;

/** "#rrggbb" → 0xrrggbb. 에디터가 넣은 값이라 형태가 어긋날 수 있다(규약 3조). */
function tint(v: string | undefined, fallback: number): number {
  if (typeof v !== "string" || !/^#[0-9a-fA-F]{6}$/.test(v)) return fallback;
  return Number.parseInt(v.slice(1), 16);
}

/** 초상 하나. 아트가 없으면 자리만 잡고 빈 컨테이너를 돌려준다. */
function portrait(b: Box, tex: Texture | undefined): Container {
  const c = new Container();
  c.x = b.x + b.w / 2;
  c.y = b.y + b.h / 2;
  if (tex) c.addChild(fitSprite(tex, b.w, b.h));
  return c;
}

/** 대사창의 정적인 부분을 전부 만들어 붙인다. 값을 갈아 끼우는 것은 호출자 몫이다. */
export function buildStoryView(parent: Container, opts: StoryViewOptions = {}): StoryView {
  const box = (id: StorySlotId): StorySlot =>
    opts.slot?.(id) ?? { id, label: STORY_LABELS[id], ...STORY_FALLBACK[id] };

  const root = new Container();
  parent.addChild(root);

  // 막 — 좌우 블리드는 반투명으로 덮어 배경 아트가 비치게 두고, **콘텐츠 컬럼은 불투명하게**
  // 칠한다. 반투명으로 뒀더니 가운데가 새파랬다 — 모든 화면 밑에 깔린 로비 배경 아트의
  // 450 컬럼이 순수 파랑(#0617fa)이다. 어차피 화면마다 제 배경으로 덮는 자리다.
  const veil = fullRect(0x0d0906, 0.62);
  veil.eventMode = "static";
  root.addChild(veil);
  root.addChild(contentRect(0x1c1209));

  const hb = box("horse");
  const ab = box("animal");
  const horse = portrait(hb, opts.horseTex);
  const animal = portrait(ab, opts.animalTex);
  root.addChild(horse, animal);

  // ── 대사창 바탕 ──────────────────────────
  const pb = box("panel");
  const panel = new Container();
  if (pb.hidden !== true) {
    const g = new Graphics();
    g.roundRect(pb.x, pb.y, pb.w, pb.h, 16).fill({ color: 0x2a1b0e, alpha: 0.94 });
    g.roundRect(pb.x + 5, pb.y + 5, pb.w - 10, pb.h - 10, 12).stroke({ width: 3, color: 0x8a5a2b });
    panel.addChild(g);
  }
  root.addChild(panel);

  const nb = box("name");
  const name = new Text({
    text: "",
    style: { fontSize: num(nb.fontSize, 19), fill: tint(nb.color, 0xffd35c), fontWeight: "bold" },
  });
  name.x = nb.x;
  name.y = nb.y;
  root.addChild(name);

  const tb = box("text");
  const body = new Text({
    text: "",
    style: {
      fontSize: num(tb.fontSize, 19), fill: tint(tb.color, 0xfff3dc),
      lineHeight: num(tb.fontSize, 19) * 1.6, wordWrap: true, wordWrapWidth: tb.w,
    },
  });
  body.x = tb.x;
  body.y = tb.y;
  root.addChild(body);

  const ib = box("hint");
  const hint = new Text({
    text: "탭하여 계속 ▶",
    style: { fontSize: num(ib.fontSize, 13), fill: tint(ib.color, 0xc9a271) },
  });
  hint.anchor.set(1, 0.5);
  hint.x = ib.x + ib.w;
  hint.y = ib.y + ib.h / 2;
  hint.visible = false;
  root.addChild(hint);

  return {
    root, veil, horse, animal, name, body, hint,
    register(): void {
      // 슬롯은 **원본을 그대로** 넘긴다 — 복사본이면 끌어도 uiLayout.json에 저장되지 않는다
      editable(STORY_AREA, box("panel"), panel);
      editable(STORY_AREA, box("horse"), horse);
      editable(STORY_AREA, box("animal"), animal);
      editable(STORY_AREA, box("name"), name);
      editable(STORY_AREA, box("text"), body);
      editable(STORY_AREA, box("hint"), hint);
    },
  };
}
