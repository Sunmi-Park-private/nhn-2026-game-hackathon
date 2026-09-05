// vitest.config.ts — 테스트 설정. vite.config.ts와 일부러 떼어 둔다.
//
// 붙여 두면 빌드 설정이 vitest를 import하게 되고, 배포 경로가 테스트 도구에
// 묶인다. 테스트는 engine·data만 건드려서 플러그인도 별칭도 필요 없다.
//
// **exclude가 이 파일의 존재 이유다.** 다른 세션의 작업 공간이
// `.claude/worktrees/` 아래에 git worktree로 붙는데, 기본 exclude에 걸리지 않아
// vitest가 그 안의 테스트까지 긁어 간다. 같은 테스트를 worktree 수만큼 돌려
// 178개가 520개로 보였다 — 숫자가 부풀면 「몇 개가 도는지」로는 아무것도 알 수 없다.
import { defineConfig, configDefaults } from 'vitest/config'

export default defineConfig({
  test: {
    exclude: [...configDefaults.exclude, '**/.claude/**'],
  },
})
