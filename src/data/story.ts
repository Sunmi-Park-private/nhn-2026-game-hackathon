// data/story.ts — 스테이지 사이에 끼는 짧은 스토리. 순수 데이터다.
//
// 한 판을 깨면 방금 구한 동물이 붉은말과 두어 마디 나누고, **다음에 누구를 구하러 가는지**
// 말한 뒤 로비로 돌아간다.
//
// 마지막 판에도 비트가 있다. 코끼리까지 구하고 아무 말 없이 엔딩 영상으로 넘어가면
// 마지막에 구한 동물만 인사를 못 한다(QA). 다음이 없으므로 nextId도 없다 —
// 그 비트는 「다음은 누구」가 아니라 「이제 아무도 안 갇혀 있다」를 말한다.
// 순서는 대사 → 엔딩 영상 → 로비다(main.ts).
//
// 순서는 data/stages 의 판 순서를 그대로 따라간다. 그 짝은 tests/ui/story.test.ts 가
// 지킨다 — 판이 늘거나 동물이 바뀌면 대사가 조용히 어긋나기 때문에 여기서 못 재고
// 테스트에 맡긴다(스테이지 JSON을 이 파일이 읽으면 data 안에서 순환이 생긴다).

/** 말하는 쪽. 화면은 이 값으로 좌우 초상 중 어느 쪽을 밝힐지 정한다. */
export type Speaker = "horse" | "animal";

export interface StoryLine {
  who: Speaker;
  text: string;
}

export interface StoryBeat {
  /** 방금 깬 판에서 구한 동물 id — 오른쪽 초상 */
  rescuedId: string;
  /** 다음 판에서 구할 동물 id — 대사가 이름을 부른다.
   *  마지막 비트에는 없다: 다음 판이 없기 때문이다. */
  nextId?: string;
  /** 2~3줄. 붉은말과 동물이 한 번씩은 말한다 */
  lines: readonly StoryLine[];
}

const horse = (text: string): StoryLine => ({ who: "horse", text });
const animal = (text: string): StoryLine => ({ who: "animal", text });

/** 판 인덱스 순서. i번째 비트는 **i번 판을 깬 직후**에 나온다. */
export const STORY_BEATS: readonly StoryBeat[] = [
  {
    rescuedId: "rabbit",
    nextId: "monkey",
    lines: [
      animal("고마워, 붉은말! 창살이 이렇게 부서질 줄은 몰랐어."),
      horse("아직 다섯이 갇혀 있어. 다음은 숲 너머의 원숭이야."),
      animal("나도 갈래. 둘이면 두 배로 빠르잖아!"),
    ],
  },
  {
    rescuedId: "monkey",
    nextId: "deer",
    lines: [
      animal("휘유— 갇혀서 바나나 하나 못 땄다고."),
      horse("쉴 틈이 없어. 안개 골짜기에 사슴이 있어."),
      animal("앞장서. 가로막는 나뭇가지는 내가 치울게."),
    ],
  },
  {
    rescuedId: "deer",
    nextId: "sheep",
    lines: [
      animal("뿔이 창살에 걸릴까 봐 숨도 못 쉬었어."),
      horse("이번엔 언덕이야. 울타리에 양이 묶여 있대."),
      animal("길은 내가 알아. 바짝 따라와."),
    ],
  },
  {
    rescuedId: "sheep",
    nextId: "zebra",
    lines: [
      animal("털은 다 헝클어졌지만… 살았다!"),
      horse("남은 건 둘. 사막 우리에 얼룩말이 있어."),
      animal("모래바람은 내 털로 막아 줄게."),
    ],
  },
  {
    rescuedId: "zebra",
    nextId: "elephant",
    lines: [
      animal("달릴 수 있는 땅이 이렇게 넓었구나."),
      horse("마지막이야. 가장 큰 우리에 코끼리가 있어."),
      animal("다 같이 가자. 여섯이면 못 부술 창살이 없어."),
    ],
  },
  {
    // 마지막 비트. 다음이 없으므로 nextId가 없다 — 이 대사가 끝나면 엔딩 영상이다.
    rescuedId: "elephant",
    lines: [
      animal("이 큰 몸으로는 창살이 더 좁게 느껴졌어. 고마워."),
      horse("여섯 모두 나왔어. 이제 아무도 갇혀 있지 않아."),
      animal("돌아가자, 붉은말. 다 같이."),
    ],
  },
];

/**
 * 방금 깬 판의 인덱스로 비트를 찾는다. 마지막 판이거나 값이 이상하면 null —
 * 호출부가 「대사가 있으면 보여 준다」 한 줄로 끝나게 한다.
 */
export function storyBeat(clearedIndex: number): StoryBeat | null {
  if (!Number.isInteger(clearedIndex)) return null;
  return STORY_BEATS[clearedIndex] ?? null;
}
