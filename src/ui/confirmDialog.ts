// ui/confirmDialog.ts — 되돌릴 수 없는 행동 앞에 한 번 묻는 창.
//
// 지금은 「홈으로」가 유일한 사용처다. 판을 나가면 그 판의 진행은 사라지므로
// 손가락이 스친 것만으로 나가지면 안 된다.
//
// 자리는 uiLayout.json의 confirm 영역이 들고 있다. 아트가 생기면서 디자이너가
// 옮길 것이 생겼으므로, 자리를 코드에 두지 않는다는 이전 판단을 뒤집었다.
// 슬롯이 없으면 confirmLayout.ts의 폴백으로 간다 — JSON을 지워도 창은 그대로 뜬다.
//
// **이 창은 설정창 위에 겹쳐 뜬다.** 막이 아래 화면의 입력을 통째로 먹어야
// 뒤 패널의 버튼이 눌리지 않는다.
import { Container, Graphics, Text, type Texture } from "pixi.js";
import { stageTop, stageHeight, stageLeft, stageWidth } from "./stage";
import { fitSprite } from "./skin";
import { slot, type UiSlot } from "../data/uiLayout";
import { hotspot, plate } from "./panelBits";
import { editable, clearEditable, inputBlocked } from "./layoutEditor";
import { CONFIRM_AREA, CONFIRM_FALLBACK, type ConfirmSlotId } from "./confirmLayout";

/** 확인창이 쓰는 아트. 셋 다 없어도 되고, 없으면 코드가 그린 도형으로 간다. */
export interface ConfirmTextures {
  panel?: Texture;
  ok?: Texture;
  cancel?: Texture;
}

export interface ConfirmOptions {
  /** 묻는 말. 길면 패널 안에서 줄바꿈된다.
   *
   *  안내문구가 새겨진 패널 아트를 쓰면 「묻는 말」 슬롯의 hidden을 켜서 이 글을 끈다 —
   *  그때는 이 값이 화면에 안 나온다. 문구가 다른 호출처를 새로 두려면
   *  hidden을 끄거나 아트를 문구별로 나눠야 한다. */
  message: string;
  /** 되돌릴 수 없는 쪽 — 눈에 띄는 색으로 그린다 */
  okLabel?: string;
  cancelLabel?: string;
  textures?: ConfirmTextures;
}

const AREA = CONFIRM_AREA;
const LABELS: Record<ConfirmSlotId, string> = {
  panel: "패널", message: "묻는 말", cancel: "취소 버튼", ok: "확인 버튼",
};

/** 슬롯이 있으면 **그 슬롯 자체**를, 없으면 폴백으로 만든 것을 준다.
 *
 *  **복사본을 만들면 안 된다.** 인게임 에디터의 드래그는 넘겨받은 슬롯의 x·y를 직접
 *  고치고(layoutEditor.ts), 저장은 uiAreas를 통째로 직렬화한다. 복사본을 넘기면
 *  화면에서는 끌리는데 저장은 원본을 담아 보내 — 창을 닫았다 열면 제자리로 돌아간다.
 *  배율·글자 크기·색·숨김도 같은 이유로 슬롯에 붙은 채로 넘겨야 applyStyle이 읽는다. */
function box(id: ConfirmSlotId): UiSlot {
  return slot(AREA, id) ?? { id, label: LABELS[id], ...CONFIRM_FALLBACK[id] };
}

/**
 * 확인창을 띄우고 답을 기다린다. 확인이면 true, 취소면 false.
 *
 * 취소가 기본값이다 — 막을 누르는 것도 취소다. 사고로 눌렸을 때
 * 아무 일도 일어나지 않는 쪽으로 빠져나가야 한다.
 */
export function openConfirm(parent: Container, opts: ConfirmOptions): Promise<boolean> {
  return new Promise<boolean>((resolve) => {
    const tex = opts.textures ?? {};
    const root = new Container();
    parent.addChild(root);

    // 막 — 캔버스 전체를 덮는다. 뒤에 설정창이 열려 있어도 그쪽 버튼이 눌리면 안 된다.
    // 자리가 화면 전체로 고정이라 슬롯을 주지 않는다 — 디자이너가 옮길 것이 없다.
    const veil = new Graphics()
      .rect(stageLeft(), stageTop(), stageWidth(), stageHeight())
      .fill({ color: 0x120c06, alpha: 0.62 });
    veil.eventMode = "static";
    root.addChild(veil);

    let done = false;
    const finish = (ok: boolean): void => {
      if (done) return;
      done = true;
      // 등록을 먼저 지운다 — 파괴된 노드를 에디터가 붙잡고 있으면 다음 드래그에서 죽는다
      clearEditable(AREA);
      root.destroy({ children: true });
      resolve(ok);
    };

    // ── 패널 ────────────────────────────────
    const pb = box("panel");
    const panel = new Container();
    if (tex.panel) {
      const s = fitSprite(tex.panel, pb.w, pb.h);
      s.x = pb.x + pb.w / 2;
      s.y = pb.y + pb.h / 2;
      panel.addChild(s);
    } else {
      const g = new Graphics();
      g.roundRect(pb.x, pb.y, pb.w, pb.h, 16).fill({ color: 0x6b4626 });
      g.roundRect(pb.x + 6, pb.y + 6, pb.w - 12, pb.h - 12, 12).stroke({ width: 3, color: 0x3d2513 });
      panel.addChild(g);
    }
    root.addChild(panel);
    editable(AREA, pb, panel);

    // ── 묻는 말 ──────────────────────────────
    // **안내문구를 새긴 패널 아트가 올라오면 이 글은 꺼야 한다** — 안 끄면 같은 문장이
    // 두 번 겹친다. 끄는 스위치는 코드가 아니라 슬롯의 hidden이다(로비 폴백과 같은 관례).
    // 아트 유무로 자동 판단하지 않는 이유: 문구 없는 패널이 올라오는 순간
    // **질문이 사라진 확인창**이 되기 때문이다. 되돌릴 수 없는 행동을 묻는 창에서
    // 그건 그냥 사고다. 디자이너가 /ui.html에서 「묻는 말」의 숨기기를 켜면 사라진다.
    // 줄바꿈 폭은 슬롯 폭에서 뽑는다 — 에디터에서 상자를 좁히면 글도 같이 좁아진다.
    const mb = box("message");
    const msg = new Text({
      text: opts.message,
      style: {
        fontSize: 17,
        fill: 0xfff3dc,
        fontWeight: "bold",
        align: "center",
        wordWrap: true,
        wordWrapWidth: mb.w,
      },
    });
    msg.anchor.set(0.5);
    msg.x = mb.x + mb.w / 2;
    msg.y = mb.y + mb.h / 2;
    root.addChild(msg);
    editable(AREA, mb, msg);

    // ── 취소 · 확인 ──────────────────────────
    // 그림과 누를 자리를 한 컨테이너에 담아 등록한다. 따로 두면 에디터에서 끌었을 때
    // 그림만 움직이고 누를 자리는 제자리에 남는다.
    const button = (id: "cancel" | "ok", t: Texture | undefined, fill: number, text: string): void => {
      const b = box(id);
      const c = new Container();
      c.addChild(plate(b, t, fill, text));
      c.addChild(hotspot(null, b, () => finish(id === "ok")));
      root.addChild(c);
      editable(AREA, b, c);
    };

    // 취소가 왼쪽, 확인이 오른쪽. 되돌릴 수 없는 쪽을 오른쪽에 두어
    // 「계속하기 · 홈으로」와 같은 방향으로 읽히게 한다.
    button("cancel", tex.cancel, 0x53341c, opts.cancelLabel ?? "취소");
    button("ok", tex.ok, 0xd23b30, opts.okLabel ?? "나가기");

    // 에디터가 켜져 편집 중일 때는 막을 눌러도 닫히지 않게 한다 — 실드가 다시 올라오기
    // 전(400ms 주기)에 창이 뜨면 첫 클릭이 선택 대신 닫기가 되어 옮길 수가 없다.
    veil.on("pointertap", () => { if (!inputBlocked()) finish(false); });
  });
}
