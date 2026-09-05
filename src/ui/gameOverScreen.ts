// ui/gameOverScreen.ts — 판이 바닥에 닿았다. 「졌다」를 한 번 세워 보여 주고 다시 할지 묻는다.
//
// 본선 QA: 실패하면 곧바로 로비로 튕겨 게임오버가 화면에 없었다.
//
// 확인창(confirmDialog)을 재사용하지 않는다 — 확인창 패널 아트에 「스테이지를 나가면…」
// 문구가 새겨져 있어 그 위에 다른 말을 얹으면 두 문장이 겹친다(실기에서 확인했다).
//
// 자리는 uiLayout.json의 gameover 영역이 들고 있고 **호출자가 넣어 준다**(규약 2조 —
// 이 파일은 ../data를 모른다). 슬롯이 없으면 gameOverLayout.ts의 폴백으로 간다.
import { Container, Graphics, Text, type Texture } from "pixi.js";
import { stageLeft, stageTop, stageWidth, stageHeight } from "./stage";
import { fitSprite } from "./skin";
import { hotspot, plate } from "./panelBits";
import { editable, clearEditable } from "./layoutEditor";
import { GAMEOVER_AREA, GAMEOVER_FALLBACK, type GameOverSlotId } from "./gameOverLayout";

/** 슬롯 한 칸 — uiLayout의 UiSlot과 같은 모양이지만 여기서는 타입만 받는다. */
export interface GameOverSlot {
  id: string;
  label: string;
  x: number;
  y: number;
  w: number;
  h: number;
  hidden?: boolean;
}

export interface GameOverTextures {
  panel?: Texture;
  lobby?: Texture;
  retry?: Texture;
}

export interface GameOverOptions {
  /** 영역의 슬롯을 id로 찾는다. null이면 폴백. **복사본이 아니라 원본을 줘야** 에디터 편집이 저장된다. */
  slot?: (id: GameOverSlotId) => GameOverSlot | null;
  textures?: GameOverTextures;
}

const LABELS: Record<GameOverSlotId, string> = {
  panel: "패널", title: "제목", message: "안내문", lobby: "로비 버튼", retry: "다시 도전 버튼",
};

/**
 * 게임오버 창을 띄우고 답을 기다린다. 다시 도전이면 true, 로비로면 false.
 *
 * 막을 눌러도 닫히지 않는다 — 실패 화면은 사고로 지나가면 안 된다. 어느 쪽이든
 * 버튼을 눌러야 나간다.
 */
export function openGameOver(parent: Container, opts: GameOverOptions = {}): Promise<boolean> {
  return new Promise<boolean>((resolve) => {
    const tex = opts.textures ?? {};
    const box = (id: GameOverSlotId): GameOverSlot =>
      opts.slot?.(id) ?? { id, label: LABELS[id], ...GAMEOVER_FALLBACK[id] };

    const root = new Container();
    parent.addChild(root);

    // 막 — 캔버스 전체. 뒤 화면은 이미 파괴됐지만 좌우 패널 영역까지 어둡게 덮어야 한 장면으로 읽힌다.
    const veil = new Graphics()
      .rect(stageLeft(), stageTop(), stageWidth(), stageHeight())
      .fill({ color: 0x120c06, alpha: 0.72 });
    veil.eventMode = "static";
    root.addChild(veil);

    let done = false;
    const finish = (again: boolean): void => {
      if (done) return;
      done = true;
      clearEditable(GAMEOVER_AREA); // 파괴된 노드를 에디터가 붙잡고 있으면 다음 드래그에서 죽는다
      root.destroy({ children: true });
      resolve(again);
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
    editable(GAMEOVER_AREA, pb, panel);

    // ── 글 두 줄 — 문구가 새겨진 패널 아트가 오면 슬롯의 hidden으로 끈다 ──
    const text = (id: "title" | "message", str: string, fontSize: number, fill: number): void => {
      const b = box(id);
      if (b.hidden === true) return;
      const t = new Text({
        text: str,
        style: { fontSize, fill, fontWeight: "bold", align: "center", wordWrap: true, wordWrapWidth: b.w },
      });
      t.anchor.set(0.5);
      t.x = b.x + b.w / 2;
      t.y = b.y + b.h / 2;
      root.addChild(t);
      editable(GAMEOVER_AREA, b, t);
    };
    text("title", "게임 오버", 30, 0xffd35c);
    text("message", "동물들이 아직 우리에 갇혀 있어요.\n다시 도전할까요?", 16, 0xfff3dc);

    // ── 버튼 — 그림과 누를 자리를 한 컨테이너에 담아 등록한다 ──
    const button = (id: "lobby" | "retry", t: Texture | undefined, fill: number, label: string): void => {
      const b = box(id);
      const c = new Container();
      c.addChild(plate(b, t, fill, label));
      c.addChild(hotspot(null, b, () => finish(id === "retry")));
      root.addChild(c);
      editable(GAMEOVER_AREA, b, c);
    };
    button("lobby", tex.lobby, 0x53341c, "로비로");
    button("retry", tex.retry, 0xd23b30, "다시 도전");
  });
}
