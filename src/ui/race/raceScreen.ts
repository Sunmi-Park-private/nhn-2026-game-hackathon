// ui/race/raceScreen.ts — 동물 운동회. 로비 하단 RACE로 들어온다.
//
// **ui/race/ 중 이 파일만 ../../data를 읽는다**(규약 2조). 나머지 일곱은 좌표와 텍스처를
// 인자로 받으므로, 스키마가 바뀔 때 깨질 자리가 여기 하나뿐이다.
//
// 상태는 클로저 안 객체 하나에 담고(규약 4조), 닫을 때 ticker를 명시적으로 끊는다 —
// 부모 노드가 붙어 있는지로 살아 있는지를 추측하지 않는다(규약 4조).
import { Application, Container, Graphics, type Texture } from "pixi.js";
import { coverBox, fullRect, stageHeight, stageLeft, stageTop, stageWidth } from "../stage";
import { openSettings, type SettingsTextures } from "../settingsMenu";
import type { UiSlot } from "../../data/uiLayout";
import { RACE } from "../../data/race";
import { ANIMALS } from "../../data/animals";
import { editable, clearEditable } from "../layoutEditor";
import { buzz } from "../settings";
import { playBgm, playSfx } from "../audio";
import type { Profile } from "../../engine/profile";
import type { RaceOutcome, RaceState } from "../../engine/race/types";
import { createRace, isRaceOver, myTime, pickAnimal, ranking, tapRace, tickRace } from "../../engine/race/raceRun";
import { settleRace, type RaceReward } from "../../engine/race/reward";
import { hotspot } from "./raceChrome";
import { raceSlots } from "./raceSlots";
import { createTrackView } from "./trackView";
import { createRunnerLayer } from "./runnerLayer";
import { createRoster } from "./rosterView";
import { createRaceHud } from "./raceHud";
import { createRaceIntro } from "./raceIntro";
import { buildRaceResult } from "./raceResultView";

const AREA = "race";

export interface RaceTextures {
  bg: { sky?: Texture; mid?: Texture; track?: Texture; startGate?: Texture; finish?: Texture };
  runners: Record<string, Texture[]>;
  ui: Partial<Record<string, Texture>>;
  booster: Partial<Record<string, Texture>>;
  gear?: Texture;
  settings: SettingsTextures;
}

const BOOSTER_KO: Record<string, string> = { bomb: "폭탄", rainbow: "레인보우", horseshoe: "말굽" };

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
    const ids = ANIMALS.map((a) => a.id);
    const byId = new Map(ANIMALS.map((a) => [a.id, a]));

    const B = raceSlots();
    const reg = (b: UiSlot, node: Container): void => editable(AREA, b, node);

    // ── 상태는 여기 하나뿐이다(규약 4조) ──
    const S = {
      race: null as RaceState | null,
      lastTapAt: 0,
      reward: null as RaceReward | null,
      profile,
      result: null as Container | null,
      closed: false,
    };

    const root = new Container();
    parent.addChild(root);
    const veil = new Graphics().rect(stageLeft(), stageTop(), stageWidth(), stageHeight()).fill(0x120c06);
    veil.eventMode = "static";
    root.addChild(veil, fullRect(0x241a10));
    if (tex.bg.startGate) root.addChild(coverBox(tex.bg.startGate));
    playBgm("audio.bgmRace");

    const trackBox = B.trackArea;
    const track = createTrackView({
      box: trackBox,
      tex: tex.bg,
      tuning: { pxPerM: RACE.PX_PER_M, distance: RACE.DISTANCE, parallax: RACE.PARALLAX },
    });
    const runners = createRunnerLayer({
      animals: ANIMALS,
      frames: tex.runners,
      box: { x: trackBox.x, w: trackBox.w, y: track.runway.y, h: track.runway.h },
      laneY: track.laneY,
      // 레인보다 조금 크게 — 6줄이 겹쳐 보이는 편이 달리기처럼 보인다
      size: Math.min(52, track.laneH * 1.5),
      cameraX: RACE.CAMERA_X,
      pxPerM: RACE.PX_PER_M,
    });
    const roster = createRoster({ laneY: track.laneY, x: trackBox.x, w: trackBox.w, h: trackBox.h / 6 });
    const hud = createRaceHud({
      hudRank: B.hudRank, hudTime: B.hudTime, distBar: B.distBar, countdown: B.countdown,
    });
    const intro = createRaceIntro({
      slots: {
        titleBanner: B.titleBanner, myRunnerTag: B.myRunnerTag, rosterHint: B.rosterHint,
      },
      banner: tex.ui.titleBanner,
      hint: "버튼을 누르면 선수가 정해집니다",
    });
    root.addChild(track.node, roster.node, runners.node, hud.node, hud.countdown, intro.node);
    roster.node.visible = false;

    // 뽑기 전에도 6마리가 출발선에 서 있어야 한다. 아직 내 선수가 없으므로 표식은 없다.
    // 트랙도 한 번 그려 둔다 — 안 그리면 결승선이 좌표 0(출발선 왼쪽)에 남는다.
    const LINEUP = ANIMALS.map((a, lane) => ({
      id: a.id, lane, x: 0, targetX: 0,
      lastGap: RACE.GAP_DEAD, sinceTap: RACE.GAP_DEAD, spm: 0, finishedAt: null,
    }));
    runners.build("");
    track.update(0);

    // ── 조작 ──
    const pickBtn = hotspot(B.pick, tex.ui.pick, 0x3faa48, () => {
      if (S.race) return;
      buzz();
      pickBtn.visible = false;
      const target = pickAnimal(ids, S.profile.rescued, Math.random);
      roster.spin(ids.indexOf(target), () => playSfx("audio.sfxRouletteTick"), () => {
        roster.node.visible = false;
        playSfx("audio.sfxWhistle");
        intro.setRunner(byId.get(target)?.name ?? target);
        S.race = createRace(ids, target, Math.random);
        runners.build(target);
        hud.setRunning(true);
        runBtn.visible = true;
      });
    }, reg);

    const runBtn = hotspot(B.run, tex.ui.run, 0x3faa48, () => {
      const race = S.race;
      if (!race || race.phase !== "running") return;
      const now = performance.now() / 1000;
      // 첫 탭은 앞선 간격이 없다 — 걷기 리듬으로 시작한다
      const gap = S.lastTapAt === 0 ? 60 / RACE.SPM_WALK : now - S.lastTapAt;
      S.lastTapAt = now;
      tapRace(race, gap);
      playSfx("audio.sfxStep");
    }, reg);
    runBtn.visible = false;

    root.addChild(pickBtn, runBtn);
    root.addChild(hotspot(B.back, tex.ui.back, 0x6b4626, () => close("back"), reg));
    root.addChild(hotspot(B.gear, tex.gear, 0x4a3320, () => {
      void openSettings(root, tex.settings).then((r) => { if (r === "lobby") close("lobby"); });
    }, reg));

    // ── 결과 ──
    function showResult(): void {
      const race = S.race;
      if (!race || S.result) return;

      const t = myTime(race);
      if (t !== null && race.myId) {
        const out = settleRace(S.profile, race.myId, t, Math.random);
        S.profile = out.profile;
        S.reward = out.reward;
        onProfile(out.profile);
        playSfx(out.reward.improved ? "audio.sfxRecord" : "audio.sfxFinish");
      }

      S.result = buildRaceResult({
        slots: {
          resultPanel: B.resultPanel, resultTitle: B.resultTitle, resultList: B.resultList,
          bestTag: B.bestTag, rewardIcon: B.rewardIcon, rewardLabel: B.rewardLabel,
          retry: B.retry, close: B.close,
        },
        tex: {
          panel: tex.ui.resultPanel, bestTag: tex.ui.bestTag,
          retry: tex.ui.retry, close: tex.ui.close,
          reward: S.reward?.booster ? tex.booster[S.reward.booster] : undefined,
        },
        race,
        animalOf: (id) => ({ name: byId.get(id)?.name ?? id, glyph: byId.get(id)?.glyph ?? "?" }),
        reward: S.reward,
        boosterName: (id) => BOOSTER_KO[id] ?? null,
        onRetry: () => { buzz(); restart(); },
        onClose: () => { buzz(); close("back"); },
      });
      root.addChild(S.result);
      hud.setRunning(false);
      runBtn.visible = false;
    }

    function restart(): void {
      S.result?.destroy({ children: true });
      S.result = null;
      S.race = null;
      S.reward = null;
      S.lastTapAt = 0;
      runners.build(""); // 다시 출발선 정렬로 되돌린다
      intro.reset();
      hud.setCountdown(null);
      pickBtn.visible = true;
      track.update(0);
    }

    // ── 루프 ──
    const tick = (): void => {
      if (S.closed) return;
      // 탭이 백그라운드에 있다가 돌아오면 deltaMS가 크게 튄다 — 순간이동하지 않게 자른다
      const dt = Math.min(0.05, app.ticker.deltaMS / 1000);
      roster.update(dt);

      const race = S.race;
      if (!race) {
        runners.update(LINEUP, 0, dt); // 출발선에 선 채로 숨은 쉰다
        return;
      }
      // 내가 들어오면 남은 선수를 배속으로 굴린다. 안 그러면 꼴찌가 들어올 때까지
      // 10초 가까이 할 일 없이 보게 된다 — 실제로 플레이해 보고 나서야 드러난 문제다.
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
      app.ticker.remove(tick);  // 명시적으로 끊는다 — parent 존재로 추측하지 않는다
      clearEditable(AREA);      // 파괴된 노드를 에디터가 잡고 있으면 죽는다
      root.destroy({ children: true });
      playBgm("audio.bgmLobby");
      resolve({ exit });
    }
  });
}
