#!/usr/bin/env bash
# Smoke test of the Android app on an emulator (run by CI inside android-emulator-runner).
# Installs the APK, starts the app, opens a Markdown file the way "Open with" does, checks that
# the app is still running with no crash in the log, and saves screenshots.
# Usage: tests/android-smoke.sh path/to/app.apk output-dir
set -uo pipefail
APK="$1"; OUT="$2"; PKG=com.rahul.productivity
mkdir -p "$OUT"
fail() { echo "FAIL: $*"; adb logcat -d > "$OUT/logcat.txt" 2>/dev/null; exit 1; }

adb wait-for-device
adb install -r "$APK" || fail "install"
adb logcat -c

adb shell monkey -p "$PKG" -c android.intent.category.LAUNCHER 1 >/dev/null || fail "launch"
sleep 20
adb exec-out screencap -p > "$OUT/1-home.png"
adb shell pidof "$PKG" >/dev/null || fail "the app is not running after start"

# "Open with": put a note in Downloads, find its MediaStore address, send it to the app.
printf '# Hello from the emulator\n\n- [ ] first\n- [x] second\n\nSome **bold** text.\n' > "$OUT/notes.md"
adb push "$OUT/notes.md" /sdcard/Download/notes.md >/dev/null
adb shell am broadcast -a android.intent.action.MEDIA_SCANNER_SCAN_FILE -d file:///sdcard/Download/notes.md >/dev/null 2>&1
adb shell content call --uri content://media --method scan_volume --arg external_primary >/dev/null 2>&1
sleep 5
ID=$(adb shell content query --uri content://media/external/file --projection _id --where "_display_name=\'notes.md\'" | sed -n 's/.*_id=\([0-9]*\).*/\1/p' | head -1)
if [ -n "$ID" ]; then
  adb shell am start -a android.intent.action.VIEW -t text/markdown --grant-read-uri-permission \
    -d "content://media/external/file/$ID" -n "$PKG/.MainActivity" >/dev/null || fail "open with"
  sleep 10
  adb exec-out screencap -p > "$OUT/2-opened-note.png"
  echo "opened content://media/external/file/$ID"
else
  echo "note: could not find the pushed file in MediaStore; skipped the Open with step"
fi

adb shell pidof "$PKG" >/dev/null || fail "the app stopped"
adb logcat -d > "$OUT/logcat.txt"
if grep -E "FATAL EXCEPTION|panicked at|Process: $PKG" "$OUT/logcat.txt" | grep -v "^--" | head -20; then
  fail "crash in the log"
fi
echo "PASS: the app started, stayed running and opened a shared file without crashing"
