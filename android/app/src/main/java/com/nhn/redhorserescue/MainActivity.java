package com.nhn.redhorserescue;

import android.os.Bundle;
import android.view.View;
import android.view.Window;

import androidx.core.view.WindowCompat;
import androidx.core.view.WindowInsetsCompat;
import androidx.core.view.WindowInsetsControllerCompat;

import com.getcapacitor.BridgeActivity;

/**
 * 게임 화면은 상태바·내비바 없이 통째로 쓴다. 세로 고정은 AndroidManifest의 screenOrientation.
 * 바를 숨기면 뷰포트가 실제 화면 전체가 되고, 그 안에서 src/main.ts의 fit()이
 * 중앙 9:16 컬럼만 그린다 — 폰이 9:16보다 길면 위아래에 레터박스 띠가 남는다(의도).
 */
public class MainActivity extends BridgeActivity {
  @Override
  public void onCreate(Bundle savedInstanceState) {
    super.onCreate(savedInstanceState);
    hideSystemBars();
  }

  @Override
  public void onWindowFocusChanged(boolean hasFocus) {
    super.onWindowFocusChanged(hasFocus);
    if (hasFocus) hideSystemBars(); // 알림창을 내렸다 올려도 다시 숨긴다
  }

  private void hideSystemBars() {
    Window window = getWindow();
    WindowCompat.setDecorFitsSystemWindows(window, false);
    View decor = window.getDecorView();
    WindowInsetsControllerCompat c = new WindowInsetsControllerCompat(window, decor);
    c.setSystemBarsBehavior(WindowInsetsControllerCompat.BEHAVIOR_SHOW_TRANSIENT_BARS_BY_SWIPE);
    c.hide(WindowInsetsCompat.Type.systemBars());
  }
}
