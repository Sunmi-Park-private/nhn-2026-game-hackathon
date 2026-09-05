#!/bin/zsh
# 안드로이드 빌드 한 줄. 사용: scripts/android.sh [debug|release|open|install]
#
#   debug   (기본) 웹 빌드 → cap sync → gradle assembleDebug → APK 경로 출력
#   release 웹 빌드 → cap sync → gradle assembleRelease (서명 없음 — 스토어용 아님)
#   install debug 빌드 뒤 USB로 연결된 기기에 adb install
#   open    Android Studio로 android/ 프로젝트를 연다
#
# SDK·JDK는 brew 설치 위치를 기본으로 잡는다(ANDROID_HOME·JAVA_HOME이 이미 있으면 그걸 쓴다).
#   brew install --cask android-commandlinetools   # sdkmanager·platform-tools
#   brew install openjdk@21                        # Gradle 8이 요구하는 JDK 17+
set -e
cd "$(dirname "$0")/.."

export ANDROID_HOME="${ANDROID_HOME:-/opt/homebrew/share/android-commandlinetools}"
export JAVA_HOME="${JAVA_HOME:-/opt/homebrew/opt/openjdk@21}"
export PATH="$JAVA_HOME/bin:$ANDROID_HOME/platform-tools:$PATH"

if [ ! -d "$ANDROID_HOME/platforms" ]; then
  echo "Android SDK가 없다: $ANDROID_HOME — brew install --cask android-commandlinetools" >&2; exit 1
fi
if [ ! -x "$JAVA_HOME/bin/java" ]; then
  echo "JDK가 없다: $JAVA_HOME — brew install openjdk@21" >&2; exit 1
fi
# gradle이 SDK를 찾는 파일. 기기마다 다르므로 gitignore 대상이고 매번 다시 쓴다.
echo "sdk.dir=$ANDROID_HOME" > android/local.properties

mode="${1:-debug}"
case "$mode" in
  open)
    node_modules/.bin/cap open android; exit ;;
  debug|install)
    npm run build
    node_modules/.bin/cap sync android
    (cd android && ./gradlew assembleDebug -q)
    apk=android/app/build/outputs/apk/debug/app-debug.apk
    echo "APK: $apk"
    if [ "$mode" = install ]; then adb install -r "$apk"; fi ;;
  release)
    npm run build
    node_modules/.bin/cap sync android
    (cd android && ./gradlew assembleRelease -q)
    echo "APK: android/app/build/outputs/apk/release/app-release-unsigned.apk" ;;
  *)
    echo "모르는 모드: $mode (debug|release|open|install)" >&2; exit 1 ;;
esac
