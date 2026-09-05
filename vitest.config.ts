// vitest.config.ts — 테스트 설정. vite.config.ts와 일부러 떼어 둔다.
//
// 붙여 두면 빌드 설정이 vitest를 import하게 되고, 배포 경로가 테스트 도구에
// 묶인다. 지금 테스트가 vite 설정에 기대는 것이 없어서 뗄 수 있다 —
// `tests/`는 engine·data와 ui/hex/geom.ts(Pixi 없음)만 import하고,
// vite.config.ts에는 resolve.alias도 define도 없으며 플러그인 둘 다 apply:'serve'다.
// **이 설정 파일이 있으면 vitest는 vite.config.ts를 아예 보지 않는다** — 나중에
// 테스트가 vite 설정을 정말 필요로 하면 여기에 베껴 오지 말고
// `mergeConfig(viteConfig, …)`(vitest/config)로 합친다.
//
// **include가 이 파일의 존재 이유다.** 다른 세션의 작업 공간이
// `.claude/worktrees/` 아래에 git worktree로 붙는데, vitest 기본 exclude에
// 걸리지 않아 그 안의 테스트까지 긁어 갔다. 같은 테스트를 worktree 수만큼 돌려
// 178개가 520개로 보였다 — 숫자가 부풀면 「몇 개가 도는지」로는 아무것도 알 수 없고,
// 아직 머지되지 않은 남의 브랜치가 깨지면 내 테스트가 빨개진다.
//
// 막는 방법을 「.claude를 빼기」가 아니라 **「우리 테스트만 넣기」**로 잡았다.
// 빼는 쪽은 새 중첩 체크아웃이 생길 때마다(`.worktrees/`, `tmp/`의 임시 클론 …)
// 목록을 계속 늘려야 한다. vitest는 .gitignore를 읽지 않는다.
import { defineConfig } from 'vitest/config'

export default defineConfig({
  test: {
    // 리포 루트 기준 경로라 중첩 체크아웃 안의 같은 이름 폴더는 걸리지 않는다.
    // src/도 넣어 둔다 — 나중에 소스 옆에 테스트를 두더라도 조용히 안 돌지 않게.
    include: ['tests/**/*.test.ts', 'src/**/*.test.ts'],
  },
})
