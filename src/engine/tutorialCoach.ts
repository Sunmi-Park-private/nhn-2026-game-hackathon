// engine/tutorialCoach.ts — 첫 판에서 붉은말이 진행하는 코칭의 진행 규칙. 순수 TS다.
//
// 그리지 않고 Pixi도 모른다 — 그래서 헤드리스로 테스트된다. 말풍선을 어떻게 그리는지는
// ui/hex/coachBubble.ts가 알고, **언제 무엇을 말하는지**만 여기가 안다.
//
// 규칙은 두 박자다. 말풍선이 떠 있는 동안에는 조작이 막히고, 탭으로 닫으면 풀린다.
// 그 뒤 그 단계가 기다리는 일이 실제로 일어나면 다음 말풍선이 뜬다.
// 「읽는다 → 해 본다 → 다음」이라 설명을 읽는 동안 판이 흘러가지 않는다.
//
// 기다리는 것이 없는 단계(`awaits: null`)는 탭하면 곧장 다음으로 넘어간다 —
// 「여기를 잡아라」처럼 확인할 행동이 따로 없는 안내가 그렇다.

/** 코치가 지켜보는 판의 사건. 스테이지 화면이 한 발이 끝날 때마다 알려준다. */
export type CoachEvent = "shot" | "merge";

export interface CoachStep {
  /** 붉은말이 하는 말 */
  text: string;
  /** 이 단계를 닫은 뒤 기다리는 사건. null이면 탭하는 즉시 다음으로 넘어간다 */
  awaits: CoachEvent | null;
  /** 말풍선 꼬리가 가리키는 곳. 없으면 꼬리 없이 말풍선만 뜬다 */
  point: "pull" | "horse" | "cage" | null;
}

export const TUTORIAL_STEPS: readonly CoachStep[] = [
  { text: "이 노란 테두리 안에서\n손을 대고 끌어야 해!", awaits: null, point: "pull" },
  { text: "나를 아래로 당겼다 놓으면\n타일이 날아가!", awaits: "shot", point: "horse" },
  { text: "같은 색 3개가 붙으면\n하나로 합쳐져!", awaits: "merge", point: null },
  { text: "금이 간 타일을 터뜨리면\n케이지가 열려!", awaits: null, point: "cage" },
];

export interface TutorialCoach {
  /** 지금 띄워야 할 단계. null이면 말풍선 없음(조작 자유) */
  showing(): CoachStep | null;
  /** 탭으로 말풍선을 닫는다. 기다리던 일이 이미 일어났다면 다음 단계가 곧장 뜬다 */
  dismiss(): void;
  /** 판에서 일어난 일을 알린다. 말풍선이 떠 있는 동안 온 것도 기억해 둔다 */
  observe(ev: CoachEvent): void;
  /** 마지막 단계까지 닫았다 */
  done(): boolean;
}

export function createTutorialCoach(): TutorialCoach {
  let index = 0;
  let visible = true;
  let finished = false;
  // 말풍선을 읽는 동안 일어난 일도 놓치지 않는다 — 첫 발에 바로 합체가 나는 판이 있다.
  const seen = new Set<CoachEvent>();

  /** 닫힌 상태에서, 현재 단계가 기다리던 일이 이미 일어났으면 다음 단계를 띄운다.
   *  기다리는 것이 없는 단계는 곧장 넘어간다. 마지막을 넘으면 끝이다. */
  function advanceIfReady(): void {
    while (!finished && !visible) {
      const step = TUTORIAL_STEPS[index];
      if (!step) { finished = true; return; }
      if (step.awaits !== null && !seen.has(step.awaits)) return;
      index += 1;
      if (index >= TUTORIAL_STEPS.length) { finished = true; return; }
      visible = true;
    }
  }

  return {
    showing(): CoachStep | null {
      if (finished || !visible) return null;
      return TUTORIAL_STEPS[index] ?? null;
    },

    dismiss(): void {
      if (finished || !visible) return;
      visible = false;
      advanceIfReady();
    },

    observe(ev: CoachEvent): void {
      if (finished) return;
      seen.add(ev);
      advanceIfReady();
    },

    done(): boolean {
      return finished;
    },
  };
}
