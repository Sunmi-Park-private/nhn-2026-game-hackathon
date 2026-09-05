// 안드로이드 빌드 설정. 웹 빌드(dist/)를 그대로 WebView에 싣는다.
//
// 크롭은 여기서 하지 않는다 — src/main.ts의 fit()이 뷰포트 비율을 9:16~16:9로 클램프하므로
// 세로 폰에서는 중앙 450×800 컬럼만 그려진다. 9:16보다 긴 폰은 위아래에 레터박스 띠가 남는다
// (setStageExtra(0) — 세로 블리드 없음. 결정: 2026-09-06, 띠를 그대로 둔다).
// 세로 고정은 android/app/src/main/AndroidManifest.xml의 screenOrientation이 맡는다.
import type { CapacitorConfig } from '@capacitor/cli'

const config: CapacitorConfig = {
  appId: 'com.nhn.redhorserescue',
  appName: 'Red Horse Rescue',
  webDir: 'dist',
  android: {
    // 상태바·내비바 뒤까지 WebView를 깐다. 캔버스는 CSS 100vw×100vh 플렉스 중앙이라
    // 그 안에서 스스로 레터박스를 만든다.
    backgroundColor: '#111111',
  },
  plugins: {
    // Capacitor 8 내장 SystemBars 플러그인. 기본값(insetsHandling: 'css')이면 Android 15에서
    // WebView 부모에 상태바 높이만큼 패딩을 넣어 **위에 흰 띠가 남는다**(에뮬레이터에서 확인).
    // 바를 숨기고 인셋 처리를 끄면 WebView가 화면 전체를 쓴다. MainActivity는 알림창을
    // 내렸다 올린 뒤 다시 숨기는 것만 맡는다.
    SystemBars: { hidden: true, insetsHandling: 'disable' },
  },
}

export default config
