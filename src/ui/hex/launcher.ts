// ui/hex/launcher.ts — 조준선, 장전 표시, 발사 비행 연출.
// 입력 처리는 stageScreen과 dragAim이 맡고 여기는 그리기와 스크럽만 한다.
import { Container, Graphics, Sprite, type Texture } from "pixi.js";
import { simulateShot } from "../../engine/hex/shot";
import type { Cell, Tier } from "../../engine/hex/types";
import { BOARD, ORIGIN, launchOrigin, launchOriginLocal } from "./geom";
import { makeTileView } from "./tileArt";
import { handSlot } from "./handSlot";
import { editable } from "../layoutEditor";
import type { UiSlot } from "../../data/uiLayout";
import { fitContain } from "../skin";
import type { Aim } from "./dragAim";
import { aimBlocked, firstBounceIndex } from "./aimRule";

export interface Launcher {
  root: Container;
  setLoaded(tier: Tier): void;
  /** 드래그 중 매 프레임. null이면 조준을 지운다. */
  setAim(aim: Aim | null, cells: Map<string, Cell>): void;
  /** 마지막 setAim 기준으로 이 조준이 규칙에 막혀 있는가. 손을 뗄 때 stageScreen이 본다. */
  isBlocked(): boolean;
  /** 손을 뗐다 — 발사. 말이 던지는 동작을 재생하고 첫 프레임으로 돌아간다. */
  playToss(): Promise<void>;
  /** 오발 — 쏘지 않고 제자리로 되돌린다. */
  settleBack(): void;
  playFlight(path: Array<{ x: number; y: number }>, tier: Tier): Promise<void>;
  pause(): void;
  resume(): void;
  destroy(): void;
}

/** 발사대에 선 붉은말의 크기. 셀 폭이 아니라 화면 기준으로 잡는다 —
 *  격자가 촘촘해져도 캐릭터가 같이 작아지면 안 된다. */
const HORSE_W = 190;
const HORSE_H = 190;

/** 조준각을 몸 기울기로 옮기는 비율. 1이면 몸이 조준각 그대로 눕는다 — 과하다. */
const TILT_RATIO = 0.35;

/** 토스 재생에 걸리는 시간(ms).
 *
 *  fps가 아니라 **총 시간**으로 잡는다. fps로 두면 재생 길이가 프레임 수에 묶여
 *  아트가 길어질수록 던지는 동작이 느려진다 — 24fps·18프레임이 0.75초였고,
 *  손을 뗀 뒤 그만큼 팔이 굼떠 보였다.
 *
 *  던지는 동작은 짧아야 탄력이 산다. 실제 배구 토스가 0.3초 안쪽이다. */
const TOSS_MS = 320;

/** 오발로 되돌아가는 시간. 뚝 끊기면 조작 실수가 버그처럼 보인다. */
const SETTLE_MS = 180;

/** 말이 **손에 든** 타일의 배율. 판에 붙는 크기(1)보다 크게 들고 있다가 던지면서
 *  원래 크기로 줄어든다 — 손에 있는 동안 무엇을 쥐고 있는지가 또렷해진다(QA 요구).
 *  판에 붙는 크기 자체는 건드리지 않는다: 격자와 어긋나면 판이 깨진다. */
const HELD_SCALE = 1.5;

export interface LauncherOptions {
  /** 붉은말 시퀀스. 비면 말을 그리지 않는다 — 폴백 그림을 두면 아트가 왔을 때 겹친다. */
  horseFrames?: readonly Texture[];
  /** 「당김」 구간의 마지막 프레임. 뒤는 토스 구간이다. */
  horseHold?: number;
  /** 색 순서대로 놓인 타일 아트. 말이 든 타일과 날아가는 발사체가 이걸 쓴다 —
   *  판에 붙는 순간 같은 그림이라야 「내가 쏜 그것」으로 읽힌다. */
  tiles?: ReadonlyArray<Texture | null>;
  /** 레이아웃 에디터가 잡을 말 슬롯. 위치와 배율을 여기서 받는다. */
  horseBox?: UiSlot;
}

export function createLauncher(opts: LauncherOptions = {}): Launcher {
  const horseFrames = opts.horseFrames ?? [];
  const horseHold = opts.horseHold ?? 0;
  const tileTex = opts.tiles ?? [];
  const root = new Container();
  const guide = new Graphics();
  root.addChild(guide);

  const origin = launchOrigin();

  // 붉은말 — 발사 지점 뒤에 선다. 시퀀스가 없으면 아무것도 그리지 않는다:
  // 폴백 그림을 두면 아트가 왔을 때 겹친다.
  //
  // 앵커는 (0.5, 1) — **하단 중앙**이다. 회전축이 곧 발 밑이라야 몸이 좌우로
  // 기울 때 정수리만 움직이고 발이 제자리에 남는다. 컨테이너 오프셋으로
  // 흉내내면 회전이 세로 이동으로 새어 나온다.
  const horse: Sprite | null = horseFrames.length > 0 ? new Sprite(horseFrames[0]) : null;
  /** 말을 감싸는 그룹. **에디터의 배율은 여기에 건다.**
   *
   *  스프라이트에 직접 걸면 프레임이 바뀔 때마다 부르는 fitContain이 scale을
   *  덮어써서 편집한 배율이 다음 프레임에 사라진다. */
  const horseGroup = new Container();
  root.addChild(horseGroup);
  if (horse) {
    horse.anchor.set(0.5, 1);
    fitContain(horse, HORSE_W, HORSE_H);
    horse.x = origin.x;
    horse.y = origin.y + HORSE_H * 0.28 + HORSE_H / 2;
    horseGroup.addChild(horse);
    if (opts.horseBox) editable("ingame", opts.horseBox, horseGroup);
  }

  /** 시퀀스에서 「당김」 구간의 마지막 프레임. 뒤는 토스 구간이다. */
  const hold = Math.min(Math.max(0, horseHold), Math.max(0, horseFrames.length - 1));

  /** 이 파워를 넘기면 **가장 깊이 접힌 자세에서 버틴다**. 활도 어느 지점부터는
   *  팔 모양이 그대로고 힘만 더 실린다 — 파워를 늦추면 다시 펴진다.
   *  1.0으로 두면 끝까지 끌어야 자세가 완성돼 그 전 구간이 흐물거려 보인다. */
  const FOLD_FULL_AT = 0.55;

  /** 파워(0~1)를 당김 구간의 프레임으로 옮긴다. */
  function scrub(power: number): void {
    if (!horse || horseFrames.length === 0) return;
    const t = Math.min(1, power / FOLD_FULL_AT);
    const i = Math.min(hold, Math.round(t * hold));
    const tex = horseFrames[i];
    if (tex && horse.texture !== tex) {
      horse.texture = tex;
      fitContain(horse, HORSE_W, HORSE_H);
    }
  }

  const loadedSlot = new Container();
  root.addChild(loadedSlot);

  /** 회전축의 y — 말 앵커(하단 중앙)가 놓인 높이. 말이 없으면 발사 지점 그대로다.
   *  그룹 좌표계 기준이다 — 에디터가 그룹을 옮기고 키워도 이 값은 그대로다. */
  const pivotY = horse ? horse.y : origin.y;

  /**
   * 몸 기울기를 한 곳에서만 쓴다.
   *
   * **타일은 회전시키지 않고 자리만 옮긴다.** 최대 기울기가 25°인데 육각을 같이
   * 돌리면 판에 붙는 순간 격자에 맞춰 확 돌아가 눈에 띈다 — 손에 들려 있는 동안에도
   * 세워 두는 편이 「그대로 날아가 붙는 그것」으로 읽힌다.
   *
   * 손 위치는 **그룹 좌표계에서 계산하고 root 좌표계로 옮긴다.** 에디터가 말을
   * 옮기거나 키우면 앞발도 따라 움직이는데, 타일이 그룹 밖(root)에 있어서
   * 변환을 직접 태워야 한다.
   *
   * 발사 지점 자체는 geom.launchOrigin이 정한다 — 말을 옮겨도 궤적은 그대로다.
   * 디자이너는 **앞발이 발사 지점에 오도록** 말을 맞춘다.
   */
  function setTilt(rotation: number): void {
    if (horse) horse.rotation = rotation;
    const local = handSlot(origin, pivotY, rotation);
    const p = horse ? root.toLocal(horseGroup.toGlobal(local)) : local;
    loadedSlot.x = p.x;
    loadedSlot.y = p.y;
  }
  setTilt(0);

  const flight = new Container();
  root.addChild(flight);

  let currentAngle = 0;
  let currentPower = 0;
  /** 지금 조준이 규칙에 막혀 있는가(첫 반사가 판 하단 1/3). setAim이 갱신한다. */
  let blocked = false;
  let loadedTier: Tier = 0;
  /** settleBack의 rAF 핸들. 오발 후 되돌아가는 도중 새 드래그가 시작되거나
   *  설정창이 열리면 이 루프를 반드시 끊어야 한다 — 안 그러면 setAim이 매 프레임
   *  쓰는 horse.rotation을 settleBack이 계속 덮어써서 둘이 눈에 띄게 다툰다. */
  let settleFrame: number | null = null;

  function cancelSettle(): void {
    if (settleFrame !== null) {
      cancelAnimationFrame(settleFrame);
      settleFrame = null;
    }
  }

  function redrawLoaded(): void {
    loadedSlot.removeChildren().forEach((c) => c.destroy());
    loadedSlot.addChild(makeTileView(loadedTier, tileTex[loadedTier] ?? null));
    loadedSlot.scale.set(HELD_SCALE); // 손에 든 동안은 크게
  }
  redrawLoaded();

  return {
    root,

    setLoaded(tier: Tier): void {
      loadedTier = tier;
      redrawLoaded();
    },

    /** 드래그 중 매 프레임. null이면 조준을 지운다. */
    setAim(aim: Aim | null, cells: Map<string, Cell>): void {
      // 새 드래그가 settleBack 도중 시작될 수 있다 — 둘이 같은 프레임에 horse.rotation을
      // 써서 다투지 않도록 설정 루프를 끊는다.
      cancelSettle();
      if (aim === null) {
        guide.clear();
        blocked = false;
        scrub(0);
        setTilt(0);
        return;
      }
      currentAngle = aim.angle;
      currentPower = aim.power;
      scrub(aim.power);
      setTilt(aim.angle * TILT_RATIO);

      const { path, bounces } = simulateShot(cells, BOARD, launchOriginLocal(), aim.angle, aim.power);
      guide.clear();
      // 첫 반사가 판 하단 1/3이면 쏠 수 없다(aimRule). 조준선을 붉게 그어 **떼기 전에**
      // 알린다 — 손을 뗀 뒤에야 「안 나갔다」를 알면 조작 실수인지 규칙인지 모른다.
      blocked = aimBlocked(bounces);
      // 막힌 조준은 **첫 반사까지만** 그린다. 끝까지 그리면 눕힌 각의 지그재그가
      // 화면을 실뭉치로 덮는다 — 그걸 없애자고 만든 규칙인데 규칙이 그림을 남겨
      // 두면 아무것도 나아지지 않는다(QA: 「아직도 각도 조절이 제대로 안 된다」).
      // 튕기는 자리에서 선이 끊기므로 「여기서 막힌다」가 곧바로 읽힌다.
      const stop = blocked ? firstBounceIndex(path, bounces[0]) : path.length;
      const color = blocked ? 0xff6b5a : 0xffffff;
      const alpha = blocked ? 0.8 : 0.85;
      // 점선 — 5스텝마다 한 점씩. 중력이 들어갔으므로 자동으로 곡선이 되고,
      // 점선의 끝이 곧 사거리다. 점이 얇으면 여러 겹이 겹칠 때 실뭉치로 보인다(QA).
      for (let i = 0; i < stop; i += 5) {
        const p = path[i]!;
        guide.circle(ORIGIN.x + p.x, ORIGIN.y + p.y, 5).fill({ color, alpha });
      }
    },

    isBlocked(): boolean {
      return blocked;
    },

    /** 손을 뗐다. 최대 장전 프레임부터 끝까지 재생하고 첫 프레임으로 돌아간다. */
    async playToss(): Promise<void> {
      guide.clear();
      if (!horse || horseFrames.length <= hold + 1) {
        // 토스 구간이 없다(스틸이거나 hold가 마지막 프레임) — 즉시 끝낸다
        loadedSlot.scale.set(1);
        scrub(0);
        setTilt(0);
        return;
      }
      const start = performance.now();
      const count = horseFrames.length - hold;
      await new Promise<void>((resolve) => {
        const tick = (): void => {
          if (horse.destroyed) { resolve(); return; }
          const t = Math.min(1, (performance.now() - start) / TOSS_MS);
          // 던지는 동안 손에 든 타일이 원래 크기로 줄어든다 — 날아가는 발사체와
          // 같은 크기로 만나야 「그대로 날아갔다」로 읽힌다.
          if (!loadedSlot.destroyed) loadedSlot.scale.set(HELD_SCALE + (1 - HELD_SCALE) * t);
          const i = Math.floor(((performance.now() - start) / TOSS_MS) * count);
          if (i >= count) { resolve(); return; }
          const tex = horseFrames[hold + i];
          if (tex && horse.texture !== tex) {
            horse.texture = tex;
            fitContain(horse, HORSE_W, HORSE_H);
          }
          requestAnimationFrame(tick);
        };
        tick();
      });
      if (!horse.destroyed) {
        scrub(0);
        setTilt(0);
      }
    },

    /** 오발 — 쏘지 않고 제자리로 되돌린다. */
    settleBack(): void {
      guide.clear();
      cancelSettle();
      const fromPower = currentPower;
      const fromRot = horse ? horse.rotation : 0;
      const t0 = performance.now();
      const tick = (): void => {
        if (!horse || horse.destroyed) return;
        const t = Math.min(1, (performance.now() - t0) / SETTLE_MS);
        const e = 1 - (1 - t) * (1 - t); // easeOut
        scrub(fromPower * (1 - e));
        setTilt(fromRot * (1 - e));
        settleFrame = t < 1 ? requestAnimationFrame(tick) : null;
      };
      if (horse) settleFrame = requestAnimationFrame(tick);
      currentPower = 0;
    },

    async playFlight(path: Array<{ x: number; y: number }>, tier: Tier): Promise<void> {
      if (path.length === 0) return;

      const chip = makeTileView(tier, tileTex[tier] ?? null);
      flight.addChild(chip);

      // 절반 속도 — 예전 값(상한 420ms, 60 + 길이×1.2)의 두 배다.
      const durationMs = Math.min(840, 120 + path.length * 2.4);
      const start = performance.now();

      try {
        await new Promise<void>((resolve) => {
          const tick = (): void => {
            // 비행 도중 파괴됐으면 조용히 끝낸다 — Pixi가 _position을 null로 만들어 두므로
            // 여기서 막지 않으면 rAF 콜백 안에서 예외가 터지고 resolve가 영영 호출되지 않는다.
            if (chip.destroyed) {
              resolve();
              return;
            }
            const t = Math.min(1, (performance.now() - start) / durationMs);
            const p = path[Math.min(path.length - 1, Math.floor(t * (path.length - 1)))]!;
            chip.x = ORIGIN.x + p.x;
            chip.y = ORIGIN.y + p.y;
            if (t < 1) requestAnimationFrame(tick);
            else resolve();
          };
          tick();
        });
      } finally {
        if (!chip.destroyed) chip.destroy();
      }
    },

    /** 설정창이 열렸다. 조준선 자체는 정적이라 멈출 것이 없지만, 오발 뒤 되돌아가는
     *  settleBack의 rAF 루프는 실행 중일 수 있다 — 이걸 끊지 않으면 설정창이 뜬 동안에도
     *  말이 계속 자세를 되돌리며 움직인다(「멈춘 게임」 위에서 이것만 살아 있으면 어색하다).
     *  드래그 중이었다면 그건 stageScreen이 dragAim.cancel()로 끊는다. */
    pause(): void {
      cancelSettle();
    },
    resume(): void {},

    destroy(): void {
      root.destroy({ children: true });
    },
  };
}
