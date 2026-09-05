// ui/hex/stageScreen.ts — 한 스테이지의 화면. 입력 → 엔진 → 렌더를 배선한다.
// 상태는 RunState 하나로 모으고 모듈 전역에 두지 않는다(규약 4조).
import { Application, Container, Graphics, Sprite, type FederatedPointerEvent, type Texture } from "pixi.js";
import { createRun, fireAt, isCleared, isFailed, type ShotOutcome } from "../../engine/hex/stageRun";
import { simulateShot } from "../../engine/hex/shot";
import type { Boosters, RunState, StageDef } from "../../engine/hex/types";
import { contentRect, coverBox, stageLeft, stageTop, stageHeight, stageWidth, BASE_W, BASE_H } from "../stage";
import { BOARD, ROW_H, cellToScreen, launchOrigin, launchOriginLocal } from "./geom";
import { createBoardView } from "./boardView";
import { createTileDebris } from "./tileDebris";
import { createCageView } from "./cageView";
import { createHudView } from "./hudView";
import { pushRow, hasReachedFailRow, failRow } from "../../engine/hex/pushRow";
import { createFailLine } from "./failLine";
import { playArmorHits, type ArmorHit } from "./armorFx";
import { shakeX, slideY, slideDone } from "./pushMotion";
import { createLauncher } from "./launcher";
import { createDragAim } from "./dragAim";
import { createTutorialCoach } from "../../engine/tutorialCoach";
import { createCoachBubble, type CoachBubble } from "./coachBubble";
import { createPowerGauge } from "./powerGauge";
import { createPullArea } from "./pullArea";
import { makeButton } from "../skin";
import { openSettings, type SettingsTextures } from "../settingsMenu";
import { slot } from "../../data/uiLayout";
import { editable } from "../layoutEditor";
import { playBgm, playSfx, pauseBgm, resumeBgm } from "../audio";
import { buzz } from "../settings";

/** 스테이지가 끝난 이유. 호출자(main)가 다음 화면을 정한다. */
export type StageResult = "cleared" | "failed" | "lobby";

/** 한 판의 결과. 누적 진행(프로필)에 넣을 값이 함께 나온다 —
 *  스테이지 정의가 아니라 **실제로 구한 것**을 세야 한다. 목표만 채우고 끝낼 수도 있다. */
export interface StageOutcome {
  result: StageResult;
  /** 이번 판에서 실제로 구출한 동물 id */
  rescued: string[];
  /** 이번 판에서 회수한 말굽 */
  horseshoes: number;
}

/** 세팅 모달과 톱니 버튼이 쓰는 슬롯. 스테이지 화면은 내용을 모르고 넘기기만 한다. */
export type StageUiTextures = SettingsTextures & {
  settingsButton?: import("pixi.js").Texture;
  /** 상단 스테이지 바 판 */
  stageBar?: import("pixi.js").Texture;
};

export interface StageTextures {
  tiles: Array<Texture | null>;
  horseshoe: Texture | null;
  /** 창살(잠금) — 동물마다 시퀀스. 없는 동물은 코드가 그린 창살로 폴백한다 */
  cageLocked: Record<string, Texture[]>;
  /** 창살(해제) — 동물마다 스틸 한 장. 없으면 스틸 교체 없이 폴백 연출만 돈다 */
  cageOpen: Record<string, Texture>;
  /** 동물마다 시퀀스 */
  animals: Record<string, Texture[]>;
  /** 화면 하단 붉은말 — 시퀀스 */
  horse: Texture[];
  /** 그 시퀀스에서 팔이 최대로 접힌 프레임(0-based) */
  horseHold: number;
  bg: {
    board: Texture | null;
    panelLeft: Texture | null;
    panelRight: Texture | null;
    /** 인게임 화면에 얹는 패널. 자리는 ingame/bgPanel 슬롯이 정한다 */
    ingamePanel: Texture | null;
  };
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
  layer.addChild(contentRect(0x241a10)); // 콘텐츠 박스만 — 좌우는 main.ts의 기본 배경 영상이 비친다
  const left = stageLeft();
  const panelW = -left; // 콘텐츠 박스 좌우 대칭이라 폭이 같다
  if (left < 0) {
    if (bg.panelLeft) layer.addChild(sidePanel(bg.panelLeft, left, panelW, layer));
    if (bg.panelRight) layer.addChild(sidePanel(bg.panelRight, BASE_W, panelW, layer));
  }
  if (bg.board) {
    const board = coverBox(bg.board);
    layer.addChild(board);
    // 판 배경도 에디터가 잡는다 — 예전에는 노드를 슬롯에 안 넘겨 목록에 뜨지 않았다(QA)
    const boardBox = slot("ingame", "bgBoard");
    if (boardBox) editable("ingame", boardBox, board);
  }
  // 인게임 배경 패널 — 판 배경 위, 게임 오브젝트 아래. 이 컨테이너가 layer에 제일 먼저
  // 붙으므로 타일·케이지·발사대·HUD는 전부 이보다 앞에 그려진다.
  //
  // 코드가 자리를 정하지 않는다 — 에디터에서 끌어 옮긴 사각형이 곧 그려지는 자리다.
  // 그래서 비율을 맞추지 않고 슬롯 크기에 그대로 늘린다: 에디터에서 본 모양과
  // 화면에 나온 모양이 다르면 배치를 손으로 맞출 수가 없다.
  const panelBox = slot("ingame", "bgPanel");
  if (bg.ingamePanel && panelBox && panelBox.hidden !== true) {
    const panel = new Sprite(bg.ingamePanel);
    panel.width = panelBox.w;
    panel.height = panelBox.h;
    panel.x = panelBox.x;
    panel.y = stageTop() + panelBox.y;
    layer.addChild(panel);
    editable("ingame", panelBox, panel); // 복사본을 넘기면 편집이 저장되지 않는다
  }
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
  ui: StageUiTextures = {},
  /** 이 판에 실을 부스터. 안 넘기면 createRun의 기본 재고를 쓴다 */
  stock?: Boosters,
): Promise<StageOutcome> {
  const state: RunState = createRun(stage, Math.random, stock);

  const layer = new Container();
  layer.addChild(buildBackground(textures.bg));
  playBgm("audio.bgmStage");

  const board = createBoardView({ tiles: textures.tiles, horseshoe: textures.horseshoe });
  const debris = createTileDebris();
  const cages = createCageView({
    locked: textures.cageLocked,
    open: textures.cageOpen,
    animals: textures.animals,
  });
  const hud = createHudView(stageIndex, { stageBar: ui.stageBar, tiles: textures.tiles });
  const launcher = createLauncher({
    horseFrames: textures.horse,
    horseHold: textures.horseHold,
    tiles: textures.tiles,
    horseBox: slot("ingame", "horse") ?? undefined,
  });
  const gauge = createPowerGauge();
  const failMark = createFailLine(failRow(state));
  /** 연출 전용 레이어. 판을 다시 그려도 살아남아야 하는 것들이 여기 붙는다. */
  const fx = new Container();
  // 당길 수 있는 범위 — 조준선은 이미 당긴 뒤에야 나오므로 그 전에 알려줄 것이 필요하다
  const pullArea = createPullArea(launchOrigin());
  // 앵커는 붉은말의 발 밑이다 — 새총의 고정점이 눈에 보이는 자리와 같아야 한다
  const aimer = createDragAim(launchOrigin());

  // 케이지는 타일보다 뒤에 둬서 타일이 케이지를 파묻게 하고, 발사대·HUD는 맨 앞에 둔다
  // 순서 = z. 케이지를 타일보다 **위**에 둔다 — 큰 창살이 둘레 타일의 가장자리를
  // 덮으면서 「타일 무리 위에 얹힌 물건」으로 읽힌다. 아래에 두면 작은 타일들이
  // 창살을 파고들어 케이지 윤곽이 끊겨 보였다.
  // 발사체(launcher)는 케이지보다 위다 — 창살 앞을 지나가는 것이 맞다.
  // 당김 가이드는 **말보다 앞**이다. 뒤에 두면 말 몸통이 가운데를 가려
  // 좌우 변만 남아 사각형으로 읽히지 않는다. 얇은 윤곽선이라 캐릭터를 해치지 않는다.
  // 파편은 판보다 **앞**이다. 판 뒤에 두면 아직 남아 있는 타일에 가려 굴러가는
  // 것이 안 보인다. 창살보다는 뒤라 큰 창살을 파편이 덮지 않는다.
  layer.addChild(
    failMark.root, board.root, debris.root, cages.root, fx,
    launcher.root, pullArea.root, hud.root, gauge.root,
  );
  // 구출 동물은 커진 채(배율 11.6) 오른쪽으로 걸어 나간다. 콘텐츠 컬럼(450) 밖은
  // 모든 화면 밑에 깔린 좌우 고정배경이라 그 위를 걸어가면 안 된다. 컬럼에서 자른다.
  // 마스크는 흔들림을 따라가지 않게 cages.root의 **형제**로 둔다 — 같이 떨면
  // 최대 진폭만큼 경계 밖이 열린다. 세로는 넉넉히 열어 둔다(자를 것은 좌우뿐이다).
  const columnClip = new Graphics()
    .rect(0, -BASE_H, BASE_W, BASE_H * 3)
    .fill({ color: 0xffffff });
  layer.addChild(columnClip);
  cages.root.mask = columnClip;

  app.stage.addChild(layer);

  /** 케이지를 뺀 나머지 갱신. 구출 연출 전에는 이것만 부른다 —
   *  cages.sync는 state.rescued에 들어간 케이지를 파괴하므로,
   *  연출 전에 부르면 playRescue가 보여줄 몸체가 사라진다. */
  function redrawExceptCages(): void {
    board.sync(state.cells);
    hud.sync(state);
    launcher.setLoaded(state.loaded);
    failMark.sync(lowestOccupiedRow());
  }

  /** 점유 칸 중 가장 아래 행. 바닥까지 얼마나 남았는지를 재는 값이다. */
  function lowestOccupiedRow(): number | null {
    let low: number | null = null;
    for (const k of state.cells.keys()) {
      const r = Number(k.slice(k.indexOf(",") + 1));
      if (low === null || r > low) low = r;
    }
    return low;
  }

  function redraw(): void {
    redrawExceptCages();
    cages.sync(state);
  }

  /** 파편이 흩어질 기준점. 스냅한 자리가 곧 터진 자리다.
   *  헛발이면 스냅 좌표가 없으므로 발사 지점을 쓴다 — 아래에서 위로 튀어 오른다. */
  function snappedScreen(outcome: ShotOutcome): { x: number; y: number } {
    return outcome.snapped ? cellToScreen(outcome.snapped) : launchOrigin();
  }

  /** 이번 발로 사라진 칸의 타일을 판에서 떼어 파편 층으로 넘긴다.
   *  터진 것과 받침을 잃고 떨어진 것이 같은 경로를 탄다 — 둘 다 「떨어졌다」가 맞다. */
  function tumble(outcome: ShotOutcome, from: { x: number; y: number }): void {
    const gone = [...outcome.steps.flatMap((s) => s.cleared), ...outcome.dropped];
    const pieces: Array<{ view: Container; x: number; y: number }> = [];
    for (const a of gone) {
      const view = board.detach(a);
      if (!view) continue;
      const p = cellToScreen(a);
      pieces.push({ view, x: p.x, y: p.y });
    }
    if (pieces.length > 0) debris.burst(pieces, from);
  }
  redraw(); // 아직 아무것도 구출되지 않았으므로 전체 갱신으로 시작한다

  // 입력 — 화면 전체를 히트 영역으로 잡는다
  const input = new Graphics().rect(0, 0, BASE_W, BASE_H).fill({ color: 0x000000, alpha: 0 });
  input.eventMode = "static";
  layer.addChild(input);

  let busy = false;

  return await new Promise<StageOutcome>((resolve) => {
    let finished = false;

    // ── 줄 내려오기 ──
    // 타이머는 UI가 소유한다. 엔진은 「한 줄 내려라」만 알고 시계는 모른다.
    //
    // **발사 연출 중에는 시계가 멈춘다.** 내 발이 날아가는 도중에 줄이 내려와
    // 지는 것은 불공정하고, 착탄과 푸시가 같은 프레임에 겹치면 스냅 좌표가
    // 방금 밀린 판과 어긋난다.
    // pushSeconds 0 = 이 판은 줄이 내려오지 않는다(첫 판 — 시간 압박 없이 규칙만 익힌다).
    // 시계·카운트다운·자글거림이 전부 꺼진다. 발사로 판이 바닥에 닿는 실패는 그대로 산다.
    const pushEnabled = state.stage.pushSeconds > 0;
    const pushMs = Math.max(1, state.stage.pushSeconds) * 1000;
    let sinceLastPush = 0;
    let lastTick = performance.now();

    /** 슬라이드 시작 시각. -1이면 슬라이드 중이 아니다. */
    let slideStart = -1;

    /** 설정창이 열려 있다. **시계도 멈춘다** — 뷰만 세우고 시계를 돌리면 설정창 뒤에서
     *  줄이 계속 내려와 창을 닫자마자 진다(본선 QA 「설정 눌러도 안 멈춤」). */
    let paused = false;

    /** 판 전체(타일·창살)에 걸리는 오프셋. 바닥 눈금과 발사대는 따라가지 않는다. */
    function applyBoardOffset(now: number): void {
      const x = busy || paused || !pushEnabled ? 0 : shakeX(pushMs - sinceLastPush, now);
      let y = 0;
      if (slideStart >= 0) {
        const elapsed = now - slideStart;
        y = slideY(elapsed);
        if (slideDone(elapsed)) slideStart = -1;
      }
      board.root.x = x;
      board.root.y = y;
      cages.root.x = x;
      cages.root.y = y;
      // 파편에는 걸지 않는다 — 판을 떠난 물건이라 판이 자글거려도 같이 떨지 않는다
    }

    function tick(): void {
      const now = performance.now();
      const dt = now - lastTick;
      lastTick = now;
      if (finished) return;
      if (pushEnabled && !busy && !paused) sinceLastPush += dt;
      hud.setCountdown(pushEnabled ? (pushMs - sinceLastPush) / 1000 : null);

      if (pushEnabled && !busy && !paused && sinceLastPush >= pushMs) {
        sinceLastPush -= pushMs;
        pushRow(state);
        redraw();
        slideStart = now; // 새 줄이 위에서 내려앉는다(SLIDE_MS 동안)
        playSfx("audio.sfxTap");
        if (hasReachedFailRow(state) && !isCleared(state)) {
          playSfx("audio.sfxFail");
          finish("failed");
          return;
        }
      }

      applyBoardOffset(now);
      failMark.tick(now);
      pushFrame = requestAnimationFrame(tick);
    }
    let pushFrame = requestAnimationFrame(tick);
    hud.setCountdown(pushEnabled ? state.stage.pushSeconds : null);

    function finish(result: StageResult): void {
      if (finished) return;
      finished = true;
      const outcome: StageOutcome = {
        result,
        rescued: [...state.rescued],
        horseshoes: state.horseshoes,
      };
      cancelAnimationFrame(pushFrame);
      // 말풍선의 rAF는 layer.destroy가 꺼 주지 않는다 — 직접 끈다
      bubble?.destroy();
      failMark.destroy();
      fx.destroy({ children: true });
      input.off("pointerdown", onDown);
      input.off("pointermove", onMove);
      input.off("globalpointermove", onMove);
      input.off("pointerup", onUpWrapped);
      input.off("pointerupoutside", onUpWrapped);
      aimer.cancel();
      launcher.destroy();
      gauge.destroy();
      pullArea.destroy();
      hud.destroy();
      cages.destroy();
      debris.destroy();
      board.destroy();
      layer.destroy({ children: true });
      resolve(outcome);
    }

    function onDown(e: FederatedPointerEvent): void {
      if (busy || coachBlocking()) return;
      const p = e.getLocalPosition(layer);
      aimer.down(p);
      launcher.setAim(aimer.current(), state.cells);
      gauge.set(aimer.current()?.power ?? null);
      pullArea.setActive(true);
    }

    function onMove(e: FederatedPointerEvent): void {
      if (busy || coachBlocking()) return;
      // layer는 화면 폭에 따라 이동·스케일된 좌표계라 e.getLocalPosition로 변환해야
      // 조준 앵커·경로 좌표와 맞아떨어진다 — 렌더러 좌표를 그대로 쓰면 어긋난다.
      const p = e.getLocalPosition(layer);
      aimer.move(p);
      launcher.setAim(aimer.current(), state.cells);
      gauge.set(aimer.current()?.power ?? null);
    }

    async function onUp(e: FederatedPointerEvent): Promise<void> {
      if (busy || finished || coachBlocking()) return;
      const aim = aimer.up(e.getLocalPosition(layer));
      gauge.set(null);
      pullArea.setActive(false);
      // 데드존 안에서 뗐다 — 쏘지 않고 자세만 되돌린다
      if (!aim) { launcher.settleBack(); return; }
      // 첫 반사가 판 하단 1/3이면 쏘지 않는다(ui/hex/aimRule.ts). 조준선이 이미
      // 붉게 떠 있었으므로 여기서는 조용히 되돌리기만 한다 — 소리도 내지 않는다.
      if (launcher.isBlocked()) { launcher.settleBack(); return; }

      busy = true;
      try {
        // 비행 경로를 먼저 얻어 연출하고, 그 뒤 상태를 확정한다
        const firedTier = state.loaded;
        const { path } = simulateShot(state.cells, BOARD, launchOriginLocal(), aim.angle, aim.power);
        playSfx("audio.sfxShot");
        buzz();
        // 토스와 비행을 **동시에 시작**한다(spec §4-4는 "동시 시작"만 요구, 완주까지
        // 기다리라는 요구는 없다) — 토스는 최대 840ms인 비행보다 훨씬 길 수 있어
        // (31프레임·24fps ≈ 0.96s) 같이 기다리면 그만큼 판이 얼어붙는다. 토스는
        // 흘려보내고, rAF 콜백 예외 등이 밖으로 새지 않게 catch만 붙여 둔다.
        void launcher.playToss().catch(() => {});
        await launcher.playFlight(path, firedTier);

        const outcome = fireAt(state, BOARD, launchOriginLocal(), aim.angle, aim.power);
        if (outcome.steps.length > 0) playSfx("audio.sfxPop");

        // 말발굽이 벗겨진 칸은 **다시 그리기 전에** 흔든다 — 다시 그리면 이미 벗겨진
        // 그림이라 「버텼다」가 보이지 않는다. 표시 객체를 먼저 붙잡아 둔다.
        const hits: ArmorHit[] = outcome.steps
          .flatMap((st) => st.damaged)
          .map((a) => {
            const cell = state.cells.get(`${a.q},${a.r}`);
            const p = cellToScreen(a);
            return {
              x: p.x,
              y: p.y,
              armorLeft: cell?.kind === "tile" ? (cell.armor ?? 0) : 0,
              view: board.viewAt(a),
            };
          });

        // 사라질 타일도 **파괴하기 전에** 떼어 낸다. board.sync가 먼저 돌면
        // 스프라이트가 이미 없어져 굴릴 것이 남지 않는다. 붙잡아 둔 말발굽 칸과는
        // 겹치지 않는다 — damaged는 벗겨졌을 뿐 사라지지 않은 칸이다.
        tumble(outcome, snappedScreen(outcome));

        // 흔들림 → 다시 그리기 → 말발굽 낙하 순서다. 다시 그리기가 먼저면
        // 붙잡아 둔 표시 객체가 파괴돼 흔들 것이 없어진다.
        // 파편은 이 흔들림과 나란히 굴러간다 — 이미 판을 떠났으므로 서로 안 기다린다.
        await playArmorHits(fx, hits, redrawExceptCages);

        for (const cage of outcome.rescued) {
          playSfx("audio.sfxRescue");
          await cages.playRescue(cage); // 몸체가 아직 살아 있다
        }
        redraw(); // 연출이 끝난 뒤 케이지 정리

        if (isCleared(state)) {
          playSfx("audio.sfxClear");
          finish("cleared");
          return;
        }
        if (isFailed(state)) {
          playSfx("audio.sfxFail");
          finish("failed");
          return;
        }

        // 코칭은 연출이 다 끝난 뒤에 말을 건다 — 파편이 굴러가는 위로 말풍선이
        // 겹치면 방금 무슨 일이 일어났는지가 안 보인다.
        if (coach) {
          coach.observe("shot");
          if (outcome.steps.length > 0) coach.observe("merge");
          bubble?.sync(coach.showing());
        }
      } finally {
        busy = false;
      }
    }

    // finish()의 .off는 동일 참조여야 실제로 제거된다 — 익명 래퍼를 그때그때 만들면
    // EventEmitter는 참조가 달라 지우지 못한다(Container.destroy가 가려줄 뿐 무동작이었다).
    const onUpWrapped = (e: FederatedPointerEvent): void => void onUp(e);
    // 설정 — 로비와 **같은 자리·같은 크기**다. 화면이 바뀌어도 톱니가 움직이지 않아야
    // 손이 기억한 자리를 누를 수 있다. 배치는 uiLayout의 ingame/gear 슬롯이 정한다.
    const gearBox = slot("ingame", "gear") ?? { id: "gear", label: "설정", x: 396, y: 12, w: 40, h: 40 };
    const gear = makeButton({
      label: "⚙", w: gearBox.w, h: gearBox.h, tex: ui.settingsButton, fill: 0x4a3320,
      onTap: () => {
        if (busy || finished || coachBlocking()) return;
        buzz();
        // 진짜 멈춘다 — 막이 입력을 먹는 것만으로는 케이지 흔들림과 조준선이 계속 돈다.
        // 「멈춘 게임」 위에서 뒤 배경만 살아 움직이면 설정창이 겹쳐 뜬 것으로만 읽힌다.
        cages.pause();
        debris.pause();
        aimer.cancel();
        gauge.set(null);
        pullArea.setActive(false);
        launcher.setAim(null, state.cells);
        launcher.pause();
        pauseBgm();
        paused = true;
        void openSettings(layer, ui, { confirmHome: true }).then((r) => {
          paused = false;
          // BGM은 어느 쪽으로 나가든 되살린다. pauseBgm이 세우는 userPaused는
          // 뷰가 아니라 audio 모듈의 전역이고 이걸 푸는 곳이 resumeBgm뿐이라,
          // 로비로 나가는 길에서 건너뛰면 그 뒤로 판이든 로비든 영영 무음이 된다.
          resumeBgm();
          if (r === "lobby") {
            finish("lobby");
            return;
          }
          // 뷰는 finish 뒤에 되살리지 않는다 — 이미 파괴된 것을 만지게 된다
          cages.resume();
        debris.resume();
          launcher.resume();
        });
      },
    });
    gear.x = gearBox.x + gearBox.w / 2;
    gear.y = stageTop() + gearBox.y + gearBox.h / 2;
    layer.addChild(gear);
    editable("ingame", gearBox, gear);

    // ── 첫 판 코칭 ──
    // 붉은말이 3단계로 규칙을 알려준다. **첫 스테이지에서만** 산다 —
    // 진행도가 아니라 stageIndex로 판단하므로 저장 스키마를 건드리지 않는다.
    // 말풍선이 떠 있는 동안은 판 조작을 막는다. 막(veil)이 맨 위에서 포인터를 먹지만
    // globalpointermove는 히트테스트를 타지 않으므로 입력 쪽에도 빗장을 따로 건다.
    const coach = stageIndex === 0 ? createTutorialCoach() : null;
    let bubble: CoachBubble | null = null;
    /** 말풍선이 떠 있다 = 조작 금지 */
    const coachBlocking = (): boolean => coach !== null && coach.showing() !== null;

    if (coach) {
      // 좌표는 여기서 만들어 넘긴다 — 말풍선 쪽이 uiLayout도 판 좌표계도 모르게 한다
      const horseBox = slot("ingame", "horse");
      const horsePoint = horseBox
        ? { x: horseBox.x + horseBox.w / 2, y: stageTop() + horseBox.y + 8 }
        : { x: launchOrigin().x, y: launchOrigin().y - 150 };
      const firstCage = state.cages[0];
      const cageCells = firstCage ? firstCage.cells.map(cellToScreen) : [];
      const cagePoint = cageCells.length > 0
        ? {
            x: cageCells.reduce((a, p) => a + p.x, 0) / cageCells.length,
            y: cageCells.reduce((a, p) => a + p.y, 0) / cageCells.length,
          }
        : null;
      bubble = createCoachBubble({
        targets: { horse: horsePoint, cage: cagePoint },
        screen: { x: stageLeft(), y: stageTop(), w: stageWidth(), h: stageHeight() },
        onTap: () => {
          if (finished) return;
          coach.dismiss();
          bubble?.sync(coach.showing());
        },
      });
      // 톱니보다 뒤에 붙인다 — 막이 설정 버튼까지 덮어야 「막았다」가 성립한다
      layer.addChild(bubble.root);
      bubble.sync(coach.showing());
    }

    input.on("pointerdown", onDown);
    input.on("pointermove", onMove);
    // 입력 캐처는 450×800 고정이지만 layer는 넓은/긴 화면에서 그 밖으로 그려진다
    // (stageTop/stageLeft<0) — 손가락이 캐처 밖으로 나가면 plain pointermove가 멎어
    // 미리보기가 마지막 표본에 멈춘다. globalpointermove(히트테스트 무관, 매 프레임)로
    // 메운다 — 딱 한 곳(input)에만 건다, 두 대상에 걸면 한 이동에 두 번 불린다.
    // plain pointermove도 남긴다 — 일부 환경은 global 이벤트를 안 보낸다.
    input.on("globalpointermove", onMove);
    input.on("pointerup", onUpWrapped);
    input.on("pointerupoutside", onUpWrapped);
  });
}
