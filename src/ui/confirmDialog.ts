// ui/confirmDialog.ts — 되돌릴 수 없는 행동 앞에 한 번 묻는 창.
//
// 지금은 「홈으로」가 유일한 사용처다. 판을 나가면 그 판의 진행은 사라지므로
// 손가락이 스친 것만으로 나가지면 안 된다.
//
// 자리를 uiLayout.json에 두지 않는다 — 콘텐츠 컬럼(450×800) 한가운데에 스스로 놓인다.
// 아트가 없는 창이라 디자이너가 옮길 것이 없고, 이 파일이 data를 모르면 규약 2조가
// 저절로 지켜진다. 아트가 생기면 그때 슬롯을 받도록 인자를 열면 된다.
import { Container, Graphics, Text } from "pixi.js";
import { BASE_W, stageTop, stageHeight, stageLeft, stageWidth } from "./stage";
import { hotspot, plate } from "./panelBits";

export interface ConfirmOptions {
  /** 묻는 말. 길면 패널 안에서 줄바꿈된다. */
  message: string;
  /** 되돌릴 수 없는 쪽 — 눈에 띄는 색으로 그린다 */
  okLabel?: string;
  cancelLabel?: string;
}

const PANEL_W = 300;
const PANEL_H = 180;
const BTN_W = 120;
const BTN_H = 48;
const GAP = 12;

/**
 * 확인창을 띄우고 답을 기다린다. 확인이면 true, 취소면 false.
 *
 * 취소가 기본값이다 — 막을 누르는 것도 취소다. 사고로 눌렸을 때
 * 아무 일도 일어나지 않는 쪽으로 빠져나가야 한다.
 */
export function openConfirm(parent: Container, opts: ConfirmOptions): Promise<boolean> {
  return new Promise<boolean>((resolve) => {
    const root = new Container();
    parent.addChild(root);

    // 막 — 캔버스 전체를 덮는다. 뒤에 설정창이 열려 있어도 그쪽 버튼이 눌리면 안 된다
    const veil = new Graphics()
      .rect(stageLeft(), stageTop(), stageWidth(), stageHeight())
      .fill({ color: 0x120c06, alpha: 0.62 });
    veil.eventMode = "static";
    root.addChild(veil);

    const x = (BASE_W - PANEL_W) / 2;
    const y = (800 - PANEL_H) / 2;

    const panel = new Graphics();
    panel.roundRect(x, y, PANEL_W, PANEL_H, 16).fill({ color: 0x6b4626 });
    panel.roundRect(x + 6, y + 6, PANEL_W - 12, PANEL_H - 12, 12).stroke({ width: 3, color: 0x3d2513 });
    root.addChild(panel);

    const msg = new Text({
      text: opts.message,
      style: {
        fontSize: 17,
        fill: 0xfff3dc,
        fontWeight: "bold",
        align: "center",
        wordWrap: true,
        wordWrapWidth: PANEL_W - 44,
      },
    });
    msg.anchor.set(0.5);
    msg.x = x + PANEL_W / 2;
    msg.y = y + 60;
    root.addChild(msg);

    let done = false;
    const finish = (ok: boolean): void => {
      if (done) return;
      done = true;
      root.destroy({ children: true });
      resolve(ok);
    };

    // 취소가 왼쪽, 확인이 오른쪽. 되돌릴 수 없는 쪽을 오른쪽에 두어
    // 「계속하기 · 홈으로」와 같은 방향으로 읽히게 한다.
    const btnY = y + PANEL_H - BTN_H - 22;
    const cancel = { x: x + PANEL_W / 2 - BTN_W - GAP / 2, y: btnY, w: BTN_W, h: BTN_H };
    const ok = { x: x + PANEL_W / 2 + GAP / 2, y: btnY, w: BTN_W, h: BTN_H };

    const cancelText = opts.cancelLabel ?? "취소";
    const okText = opts.okLabel ?? "나가기";

    root.addChild(plate(cancel, undefined, 0x53341c, cancelText));
    root.addChild(hotspot(null, cancel, () => finish(false)));

    root.addChild(plate(ok, undefined, 0xd23b30, okText));
    root.addChild(hotspot(null, ok, () => finish(true)));

    veil.on("pointertap", () => finish(false));
  });
}
