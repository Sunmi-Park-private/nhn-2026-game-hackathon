// ui/hex/stageScreen.ts — 한 스테이지의 화면. 입력 → 엔진 → 렌더를 배선한다.
// 상태는 RunState 하나로 모으고 모듈 전역에 두지 않는다(규약 4조).
import { Application, Container, Graphics, Sprite, type FederatedPointerEvent, type Texture } from "pixi.js";
import { createRun, fireAt, isCleared, isFailed } from "../../engine/hex/stageRun";
import { simulateShot } from "../../engine/hex/shot";
import type { RunState, StageDef } from "../../engine/hex/types";
import { fullRect, coverBox, stageLeft, stageTop, stageHeight, BASE_W, BASE_H } from "../stage";
import { BOARD, launchOriginLocal } from "./geom";
import { createBoardView } from "./boardView";
import { createCageView } from "./cageView";
import { createHudView } from "./hudView";
import { createLauncher } from "./launcher";

export type StageResult = "cleared" | "failed" | "quit";

export interface StageTextures {
  tiles: Array<Texture | null>;
  horseshoe: Texture | null;
  cageClosed: Texture | null;
  cageOpen: Texture | null;
  animals: Record<string, Texture | null>;
  bg: { board: Texture | null; panelLeft: Texture | null; panelRight: Texture | null };
}

/** 좌우 패널 배치. 콘텐츠 박스 바깥 영역을 아트로 채운다.
 *  좁은 세로 뷰포트에서는 이 영역이 0폭이라 아무것도 그리지 않는다 —
 *  그래서 게임에 필요한 것은 절대 여기 두지 않는다(장식 전용). */
function sidePanel(tex: Texture, x: number, w: number, parent: Container): Sprite {
  const spr = new Sprite(tex);
  const s = Math.max(w / tex.width, stageHeight() / tex.height);
  spr.scale.set(s);
  spr.x = x + (w - tex.width * s) / 2;
  spr.y = stageTop() + (stageHeight() - tex.height * s) / 2;
  // 패널 영역 밖으로 넘치지 않게 자른다 — 넘치면 판 위로 올라온다.
  // 마스크 좌표는 스프라이트가 아니라 layer(parent)와 같은 좌표계여야 하므로
  // 마스크는 spr의 자식이 아니라 parent의 자식으로 붙인다(자식이면 spr의 scale까지 먹는다).
  // Pixi는 마스크 노드가 씬 그래프에 포함돼야 world transform을 갱신하므로 반드시 addChild한다.
  const mask = new Graphics().rect(x, stageTop(), w, stageHeight()).fill(0xffffff);
  parent.addChild(mask);
  spr.mask = mask;
  return spr;
}

/** 배경 레이어 — 단색 베이스 위에 좌·중앙·우 아트를 순서대로 얹는다.
 *  세 슬롯 모두 null이어도 베이스색만 남아 기존 화면과 동일해야 한다. */
function buildBackground(bg: StageTextures["bg"]): Container {
  const layer = new Container();
  layer.addChild(fullRect(0x241a10)); // 항상 먼저 — 캔버스가 절대 투명해지지 않게
  const left = stageLeft();
  const panelW = -left; // 콘텐츠 박스 좌우 대칭이라 폭이 같다
  if (left < 0) {
    if (bg.panelLeft) layer.addChild(sidePanel(bg.panelLeft, left, panelW, layer));
    if (bg.panelRight) layer.addChild(sidePanel(bg.panelRight, BASE_W, panelW, layer));
  }
  if (bg.board) layer.addChild(coverBox(bg.board));
  // 플레이 영역 테두리 — 배경 아트가 없으면 좌우 여백과 판이 같은 갈색이라 경계가 안 보인다.
  // 발사체가 튕기는 벽이 정확히 이 선이므로, 아트가 들어와도 남겨 두는 편이 읽기 좋다.
  layer.addChild(
    new Graphics()
      .rect(0.5, stageTop() + 0.5, BASE_W - 1, stageHeight() - 1)
      .stroke({ width: 2, color: 0xc98a3c, alignment: 0 }),
  );
  return layer;
}

export async function runStageScreen(
  app: Application,
  stage: StageDef,
  stageIndex: number,
  textures: StageTextures,
): Promise<StageResult> {
  const state: RunState = createRun(stage);

  const layer = new Container();
  layer.addChild(buildBackground(textures.bg));

  const board = createBoardView({ tiles: textures.tiles, horseshoe: textures.horseshoe });
  const cages = createCageView({
    closed: textures.cageClosed,
    open: textures.cageOpen,
    animals: textures.animals,
  });
  const hud = createHudView(stageIndex);
  const launcher = createLauncher();

  // 케이지는 타일보다 뒤에 둬서 타일이 케이지를 파묻게 하고, 발사대·HUD는 맨 앞에 둔다
  layer.addChild(cages.root, board.root, launcher.root, hud.root);
  app.stage.addChild(layer);

  /** 케이지를 뺀 나머지 갱신. 구출 연출 전에는 이것만 부른다 —
   *  cages.sync는 state.rescued에 들어간 케이지를 파괴하므로,
   *  연출 전에 부르면 playRescue가 보여줄 몸체가 사라진다. */
  function redrawExceptCages(): void {
    board.sync(state.cells);
    hud.sync(state);
    launcher.setLoaded(state.loaded);
  }

  function redraw(): void {
    redrawExceptCages();
    cages.sync(state);
  }
  redraw(); // 아직 아무것도 구출되지 않았으므로 전체 갱신으로 시작한다

  // 입력 — 화면 전체를 히트 영역으로 잡는다
  const input = new Graphics().rect(0, 0, BASE_W, BASE_H).fill({ color: 0x000000, alpha: 0 });
  input.eventMode = "static";
  layer.addChild(input);

  let busy = false;

  return await new Promise<StageResult>((resolve) => {
    let finished = false;

    function finish(result: StageResult): void {
      if (finished) return;
      finished = true;
      input.off("pointermove", onMove);
      input.off("pointerup", onUpWrapped);
      input.off("pointerupoutside", onUpWrapped);
      launcher.destroy();
      hud.destroy();
      cages.destroy();
      board.destroy();
      layer.destroy({ children: true });
      resolve(result);
    }

    function onMove(e: FederatedPointerEvent): void {
      if (busy) return;
      // e.global은 렌더러(화면) 좌표계다 — app.stage.x가 0이 아닌 넓은 화면에서는
      // 그대로 쓰면 발사대 기준점이 수백 px 어긋난다. layer 로컬 좌표로 변환해야 한다.
      const p = e.getLocalPosition(layer);
      launcher.aimAt(p.x, p.y, state.cells);
    }

    async function onUp(e: FederatedPointerEvent): Promise<void> {
      if (busy || finished) return;
      const p = e.getLocalPosition(layer);
      launcher.aimAt(p.x, p.y, state.cells);
      const angle = launcher.angle();
      launcher.clearAim();

      busy = true;
      try {
        // 비행 경로를 먼저 얻어 연출하고, 그 뒤 상태를 확정한다
        const firedTier = state.loaded;
        const { path } = simulateShot(state.cells, BOARD, launchOriginLocal(), angle);
        await launcher.playFlight(path, firedTier);

        const outcome = fireAt(state, BOARD, launchOriginLocal(), angle);
        redrawExceptCages(); // 타일·HUD는 즉시 반영 — 케이지는 아직 건드리지 않는다

        for (const cage of outcome.rescued) {
          await cages.playRescue(cage); // 몸체가 아직 살아 있다
        }
        redraw(); // 연출이 끝난 뒤 케이지 정리

        if (isCleared(state)) {
          finish("cleared");
          return;
        }
        if (isFailed(state)) {
          finish("failed");
          return;
        }
      } finally {
        busy = false;
      }
    }

    // finish()의 .off는 동일 참조여야 실제로 제거된다 — 익명 래퍼를 그때그때 만들면
    // EventEmitter는 참조가 달라 지우지 못한다(Container.destroy가 가려줄 뿐 무동작이었다).
    const onUpWrapped = (e: FederatedPointerEvent): void => void onUp(e);
    input.on("pointermove", onMove);
    input.on("pointerup", onUpWrapped);
    input.on("pointerupoutside", onUpWrapped);
  });
}
