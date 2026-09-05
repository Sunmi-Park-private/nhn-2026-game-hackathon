// ui/race/raceScreen.ts — 동물 운동회. 로비 하단 RACE로 들어온다.
//
// 디자이너 시안대로 **화면 셋**이 각자 배경을 가진다 — 선택 · 경주 · 결과.
// 셋은 uiLayout의 raceSelect·raceTrack·raceResult 영역에 각각 대응한다.
//
// **ui/race/ 중 이 파일만 ../../data를 읽는다**(규약 2조).
// 상태는 클로저 안 객체 하나에 담고(규약 4조), 닫을 때 ticker를 명시적으로 끊는다.
import { Application, Container, Graphics, type Texture } from "pixi.js";
import { coverBox, fullRect, stageHeight, stageLeft, stageTop, stageWidth } from "../stage";
import { openSettings, type SettingsTextures } from "../settingsMenu";
import type { UiSlot } from "../../data/uiLayout";
import { RACE, RACE_LANE_ORDER } from "../../data/race";
import { ANIMALS } from "../../data/animals";
import { editable, clearEditable } from "../layoutEditor";
import { buzz } from "../settings";
import { playBgm, playSfx } from "../audio";
import type { Profile } from "../../engine/profile";
import type { RaceOutcome, RaceState } from "../../engine/race/types";
import { createRace, isRaceOver, myTime, pickAnimal, ranking, tapRace, tickRace } from "../../engine/race/raceRun";
import { settleRace, type RaceReward } from "../../engine/race/reward";
import { hotspot, slotText } from "./raceChrome";
import { RACE_AREAS, raceSlots } from "./raceSlots";
import { createTrackView } from "./trackView";
import { createRunnerLayer } from "./runnerLayer";
import { createLaneFlags } from "./laneFlags";
import { createCardPicker } from "./cardPicker";
import { createRaceHud } from "./raceHud";
import { buildRaceResult } from "./raceResultView";

export interface RaceTextures {
  bg: Partial<Record<string, Texture>>;
  ui: Partial<Record<string, Texture>>;
  runners: Record<string, Texture[]>;
  /** 동물 id → 정면 얼굴. 파일이 없는 동물은 키가 빠진다 */
  faces: Partial<Record<string, Texture>>;
  /** 동물 id → 1위 축하 포즈. 없으면 얼굴을 크게 쓴다 */
  winner: Partial<Record<string, Texture>>;
  card: Partial<Record<string, Texture>>;
  row: Partial<Record<string, Texture>>;
  medal: Partial<Record<string, Texture>>;
  flags: Partial<Record<string, Texture>>;
  booster: Partial<Record<string, Texture>>;
  settings: SettingsTextures;
}

const BOOSTER_KO: Record<string, string> = { bomb: "폭탄", rainbow: "레인보우", horseshoe: "말굽" };

/** 배경 한 장을 화면에 깐다. 없으면 단색 — 캔버스가 비지 않게. */
function scene(tex: Texture | undefined): Container {
  const c = new Container();
  c.addChild(fullRect(0x241a10));
  if (tex) c.addChild(coverBox(tex));
  return c;
}

/** 레이스를 띄우고 닫힐 때까지 기다린다. 프로필이 바뀌면 onProfile로 알린다 —
 *  저장은 호출자(main)가 한다. 레이스가 localStorage를 알 이유가 없다. */
export function openRace(
  app: Application,
  parent: Container,
  tex: RaceTextures,
  profile: Profile,
  onProfile: (p: Profile) => void,
): Promise<RaceOutcome> {
  return new Promise<RaceOutcome>((resolve) => {
    const byId = new Map(ANIMALS.map((a) => [a.id, a]));
    // 레인·카드 순서는 시안이 정한다 — 도감 순서와 다르다
    const order = RACE_LANE_ORDER.filter((id) => byId.has(id));
    const ids = [...order];
    const lineup = order.map((id) => byId.get(id)!);
    const B = raceSlots();

    const S = {
      race: null as RaceState | null,
      lastTapAt: 0,
      reward: null as RaceReward | null,
      profile,
      closed: false,
    };

    const root = new Container();
    parent.addChild(root);
    const veil = new Graphics().rect(stageLeft(), stageTop(), stageWidth(), stageHeight()).fill(0x120c06);
    veil.eventMode = "static";
    root.addChild(veil);
    playBgm("audio.bgmRace");

    const reg = (area: string) => (b: UiSlot, node: Container): void => editable(area, b, node);
    const regSelect = reg("raceSelect");
    const regTrack = reg("raceTrack");

    // ── 화면 셋 ──────────────────────────────
    const selectScreen = new Container();
    const trackScreen = new Container();
    const resultScreen = new Container();
    root.addChild(selectScreen, trackScreen, resultScreen);
    trackScreen.visible = false;
    resultScreen.visible = false;

    // ── 선택 화면 ────────────────────────────
    selectScreen.addChild(scene(tex.bg.selectScene));
    const title = B.select.title;
    if (tex.ui.title) {
      const s = new Container();
      s.addChild(hotspot(title, tex.ui.title, 0x00000000, () => {}, regSelect));
      selectScreen.addChild(s);
    } else {
      const t = slotText(title, 30, 0xffd66b);
      t.text = "ANIMAL RACE";
      selectScreen.addChild(t);
    }

    const picker = createCardPicker({
      box: B.select.cardGrid,
      grid: {
        cols: RACE.CARD_COLS, rows: RACE.CARD_ROWS,
        gap: RACE.CARD_GAP, pad: RACE.CARD_PAD,
      },
      animals: lineup,
      faces: tex.faces,
      gridArt: tex.card.grid,   // 6종 타일 한 장
      frameOn: tex.card.on,     // 선택 테두리
      frameOff: tex.card.off,   // 격자 이미지가 없을 때만
    });
    selectScreen.addChild(picker.node);

    const btnSelect = hotspot(B.select.btnSelect, tex.ui.btnSelect, 0x3faa48, () => {
      if (S.race) return;
      buzz();
      btnSelect.visible = false;
      const target = pickAnimal(ids, S.profile.rescued, Math.random);
      picker.spin(ids.indexOf(target), () => playSfx("audio.sfxRouletteTick"), () => {
        playSfx("audio.sfxWhistle");
        S.race = createRace(ids, target, Math.random);
        runners.build(target);
        selectScreen.visible = false;
        trackScreen.visible = true;
        hud.setRunning(true);
      });
    }, regSelect);
    selectScreen.addChild(btnSelect);

    // ── 경주 화면 ────────────────────────────
    trackScreen.addChild(scene(tex.bg.raceScene));
    const track = createTrackView({
      box: B.track.trackArea,
      tex: { trackTile: tex.bg.trackTile, finish: tex.bg.finish },
      tuning: { pxPerM: RACE.PX_PER_M, distance: RACE.DISTANCE },
    });
    const runners = createRunnerLayer({
      animals: lineup,
      frames: tex.runners,
      box: { x: B.track.trackArea.x, w: B.track.trackArea.w, y: B.track.trackArea.y, h: B.track.trackArea.h },
      laneY: track.laneY,
      size: Math.min(52, track.laneH * 1.2),
      cameraX: B.track.trackArea.x + RACE.CAMERA_INSET,
      pxPerM: RACE.PX_PER_M,
    });
    const hud = createRaceHud({
      hudRank: B.track.hudRank,
      hudTime: B.track.hudTime,
      distBar: B.track.distBar,
      countdown: B.track.countdown,
    });
    trackScreen.addChild(track.node, runners.node);
    trackScreen.addChild(createLaneFlags({ box: B.track.laneFlags, laneY: track.laneY, tex: tex.flags }));
    trackScreen.addChild(hud.node, hud.countdown);

    const btnRace = hotspot(B.track.btnRace, tex.ui.btnRace, 0x3faa48, () => {
      const race = S.race;
      if (!race || race.phase !== "running") return;
      const now = performance.now() / 1000;
      // 첫 탭은 앞선 간격이 없다 — 걷기 리듬으로 시작한다
      const gap = S.lastTapAt === 0 ? 60 / RACE.SPM_WALK : now - S.lastTapAt;
      S.lastTapAt = now;
      tapRace(race, gap);
      playSfx("audio.sfxStep");
    }, regTrack);
    trackScreen.addChild(btnRace);
    runners.build("");
    track.update(0);

    // 돌아가기·설정은 두 화면에 같은 자리로 얹는다(시안)
    for (const [screen, slots, r] of [
      [selectScreen, B.select, regSelect] as const,
      [trackScreen, B.track, regTrack] as const,
    ]) {
      screen.addChild(hotspot(slots.back, tex.ui.back, 0x8a5a2b, () => close("back"), r));
      screen.addChild(hotspot(slots.gear, tex.ui.gear, 0x8a5a2b, () => {
        void openSettings(root, tex.settings).then((x) => { if (x === "lobby") close("lobby"); });
      }, r));
    }

    // ── 결과 화면 ────────────────────────────
    function showResult(): void {
      const race = S.race;
      if (!race || resultScreen.children.length > 0) return;

      const t = myTime(race);
      if (t !== null && race.myId) {
        const out = settleRace(S.profile, race.myId, t, Math.random);
        S.profile = out.profile;
        S.reward = out.reward;
        onProfile(out.profile);
        playSfx(out.reward.improved ? "audio.sfxRecord" : "audio.sfxFinish");
      }

      const champ = ranking(race)[0];
      resultScreen.addChild(scene(tex.bg.resultScene));
      resultScreen.addChild(buildRaceResult({
        slots: B.result as unknown as Record<string, UiSlot>,
        tex: {
          podium: tex.ui.podium,
          rowFirst: tex.row.first, rowRest: tex.row.rest,
          medal: tex.medal, winner: champ ? tex.winner[champ.id] : undefined,
          btnRetry: tex.ui.btnRetry, btnClose: tex.ui.btnClose,
        },
        race,
        animalOf: (id) => ({
          name: byId.get(id)?.name ?? id,
          glyph: byId.get(id)?.glyph ?? "?",
          face: tex.faces[id],
        }),
        reward: S.reward,
        boosterName: (id) => BOOSTER_KO[id] ?? null,
        onRetry: () => { buzz(); restart(); },
        onClose: () => { buzz(); close("back"); },
      }));
      for (const b of Object.values(B.result)) {
        // 결과 화면은 통째로 다시 그려지므로 개별 노드를 잡히게 두지 않는다 —
        // 대신 배치는 에디터의 결과 탭에서 좌표로 조정한다
        void b;
      }
      trackScreen.visible = false;
      resultScreen.visible = true;
      hud.setRunning(false);
    }

    function restart(): void {
      resultScreen.removeChildren();
      resultScreen.visible = false;
      S.race = null;
      S.reward = null;
      S.lastTapAt = 0;
      runners.build("");
      track.update(0);
      hud.setCountdown(null);
      picker.reset();
      btnSelect.visible = true;
      selectScreen.visible = true;
    }

    // ── 루프 ──────────────────────────────────
    const tick = (): void => {
      if (S.closed) return;
      // 탭이 백그라운드에 있다가 돌아오면 deltaMS가 크게 튄다 — 순간이동하지 않게 자른다
      const dt = Math.min(0.05, app.ticker.deltaMS / 1000);
      picker.update(dt);

      const race = S.race;
      if (!race) return;

      // 내가 들어오면 남은 선수를 배속으로 굴린다 — 꼴찌를 10초씩 기다리지 않게.
      // 시뮬레이션이 시간의 함수라 빨리 감아도 기록은 실시간과 같다.
      const meDone = race.runners.find((r) => r.id === race.myId)?.finishedAt !== null;
      tickRace(race, meDone ? dt * RACE.TAIL_SPEED : dt);

      const left = Math.ceil(RACE.COUNTDOWN - race.t);
      hud.setCountdown(race.phase === "countdown" ? (left > 0 ? String(left) : "출발!") : null);

      const cam = race.runners.find((r) => r.id === race.myId)?.x ?? 0;
      track.update(cam);
      runners.update(race.runners, cam, dt);
      hud.update(
        ranking(race).findIndex((r) => r.id === race.myId) + 1,
        Math.max(0, race.t - RACE.COUNTDOWN),
        cam / RACE.DISTANCE,
      );

      if (isRaceOver(race)) showResult();
    };
    app.ticker.add(tick);

    function close(exit: "back" | "lobby"): void {
      if (S.closed) return;
      S.closed = true;
      app.ticker.remove(tick);            // 명시적으로 끊는다 — parent 존재로 추측하지 않는다
      for (const a of RACE_AREAS) clearEditable(a);
      root.destroy({ children: true });
      playBgm("audio.bgmLobby");
      resolve({ exit });
    }
  });
}
