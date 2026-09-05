// ui/gameOverScreen.ts — 판이 바닥에 닿았다. 「졌다」를 한 번 세워 보여 주고 다시 할지 묻는다.
//
// 본선 QA: 실패하면 곧바로 로비로 튕겨 게임오버가 화면에 없었다.
//
// 확인창(confirmDialog)을 재사용하지 않는다 — 확인창 패널 아트에 「스테이지를 나가면…」
// 문구가 새겨져 있어 그 위에 다른 말을 얹으면 두 문장이 겹친다(실기에서 확인했다).
// 자리는 코드가 정하고 에디터에 올리지 않는다. 아트가 오면 그때 슬롯을 만든다.
import { Container, Graphics, Text } from "pixi.js";
import { stageLeft, stageTop, stageWidth, stageHeight, BASE_W, BASE_H } from "./stage";
import { makeButton } from "./skin";

const PANEL_W = 300;
const PANEL_H = 220;
const BTN_W = 120;
const BTN_H = 48;

/**
 * 게임오버 창을 띄우고 답을 기다린다. 다시 도전이면 true, 로비로면 false.
 *
 * 막을 눌러도 닫히지 않는다 — 실패 화면은 사고로 지나가면 안 된다. 어느 쪽이든
 * 버튼을 눌러야 나간다.
 */
export function openGameOver(parent: Container): Promise<boolean> {
  return new Promise<boolean>((resolve) => {
    const root = new Container();
    parent.addChild(root);

    // 막 — 캔버스 전체. 뒤 화면은 이미 파괴됐지만 좌우 패널 영역까지 어둡게 덮어야 한 장면으로 읽힌다.
    const veil = new Graphics()
      .rect(stageLeft(), stageTop(), stageWidth(), stageHeight())
      .fill({ color: 0x120c06, alpha: 0.72 });
    veil.eventMode = "static";
    root.addChild(veil);

    const px = (BASE_W - PANEL_W) / 2;
    const py = stageTop() + (BASE_H - PANEL_H) / 2;
    const panel = new Graphics();
    panel.roundRect(px, py, PANEL_W, PANEL_H, 16).fill({ color: 0x6b4626 });
    panel.roundRect(px + 6, py + 6, PANEL_W - 12, PANEL_H - 12, 12).stroke({ width: 3, color: 0x3d2513 });
    root.addChild(panel);

    const title = new Text({
      text: "게임 오버",
      style: { fontSize: 30, fill: 0xffd35c, fontWeight: "bold" },
    });
    title.anchor.set(0.5);
    title.x = BASE_W / 2;
    title.y = py + 48;
    root.addChild(title);

    const msg = new Text({
      text: "동물들이 아직 우리에 갇혀 있어요.\n다시 도전할까요?",
      style: { fontSize: 16, fill: 0xfff3dc, align: "center", lineHeight: 24 },
    });
    msg.anchor.set(0.5);
    msg.x = BASE_W / 2;
    msg.y = py + 106;
    root.addChild(msg);

    let done = false;
    const finish = (again: boolean): void => {
      if (done) return;
      done = true;
      root.destroy({ children: true });
      resolve(again);
    };

    // 로비가 왼쪽, 다시 도전이 오른쪽 — 설정창의 「계속하기 · 홈으로」와 달리
    // 여기서는 되돌릴 수 없는 쪽이 로비다(이 판의 진행은 어차피 끝났으니 다시 도전이 기본 동선).
    const lobby = makeButton({ label: "로비로", w: BTN_W, h: BTN_H, fill: 0x53341c, onTap: () => finish(false) });
    lobby.x = BASE_W / 2 - BTN_W / 2 - 10;
    lobby.y = py + PANEL_H - 50;
    root.addChild(lobby);

    const retry = makeButton({ label: "다시 도전", w: BTN_W, h: BTN_H, fill: 0xd23b30, onTap: () => finish(true) });
    retry.x = BASE_W / 2 + BTN_W / 2 + 10;
    retry.y = py + PANEL_H - 50;
    root.addChild(retry);
  });
}
