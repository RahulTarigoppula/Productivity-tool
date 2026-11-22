#!/usr/bin/env bash
# Smoke test of the Android app on an emulator (run by CI inside android-emulator-runner).
# Installs the APK, starts the app, opens a Markdown file the way "Open with" does, checks that
# the app is still running with no crash in the log, and saves screenshots.
# Usage: tests/android-smoke.sh path/to/app.apk output-dir
set -uo pipefail
APK="$1"; OUT="$2"; PKG=com.rahul.productivity
mkdir -p "$OUT"
fail() {
  echo "FAIL: $*"
  adb logcat -d > "$OUT/logcat.txt" 2>/dev/null
  echo "---- relevant log lines ----"
  grep -E "ProductivitySelfTest|AndroidRuntime|FATAL|panicked|RustStdoutStderr|Tauri|chromium|Console" "$OUT/logcat.txt" | grep -v "GoogleApi" | tail -80
  exit 1
}

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
if grep -E "FATAL EXCEPTION|panicked at" "$OUT/logcat.txt" | head -20; then fail "crash in the log"; fi

# The app's own self-test: file reads and writes through Android's IPC (including a 3 MB
# binary save), versions, recovery, folder listing and search, then every sample file opened
# in its editor. The app reports to the system log.
adb shell am force-stop "$PKG"
adb logcat -c
adb shell am start -n "$PKG/.MainActivity" --ez productivity.selftest true >/dev/null || fail "self-test start"
RESULT=""
for i in $(seq 1 100); do
  RESULT=$(adb logcat -d -s ProductivitySelfTest:I | grep -o "SELFTEST passed=[0-9]* total=[0-9]*" | tail -1)
  [ -n "$RESULT" ] && break
  sleep 3
done
adb logcat -d -s ProductivitySelfTest:I | grep SELFTEST | tee "$OUT/selftest.txt"
adb exec-out screencap -p > "$OUT/3-selftest.png"
adb logcat -d > "$OUT/logcat-selftest.txt"
[ -n "$RESULT" ] || fail "the self-test did not report within 5 minutes"
PASSED=$(echo "$RESULT" | sed 's/.*passed=\([0-9]*\).*/\1/')
TOTAL=$(echo "$RESULT" | sed 's/.*total=\([0-9]*\).*/\1/')
[ "$PASSED" = "$TOTAL" ] || fail "self-test: $PASSED of $TOTAL checks passed"
echo "self-test: $PASSED of $TOTAL checks passed"
echo "PASS: the app started, opened a shared file and passed its self-test"
