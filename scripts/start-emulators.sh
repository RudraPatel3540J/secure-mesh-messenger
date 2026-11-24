#!/usr/bin/env bash
set -euo pipefail

export JAVA_HOME="${JAVA_HOME:-/opt/homebrew/opt/openjdk@17/libexec/openjdk.jdk/Contents/Home}"
export ANDROID_HOME="${ANDROID_HOME:-/opt/homebrew/share/android-commandlinetools}"
export ANDROID_SDK_ROOT="$ANDROID_HOME"
export PATH="$JAVA_HOME/bin:$ANDROID_HOME/cmdline-tools/latest/bin:$ANDROID_HOME/platform-tools:$ANDROID_HOME/emulator:$PATH"

echo "Available AVDs:"
emulator -list-avds

echo "Starting SMM_Phone_A..."
emulator -avd SMM_Phone_A -netdelay none -netspeed full >/tmp/smm-emulator-a.log 2>&1 &
echo "Starting SMM_Phone_B..."
emulator -avd SMM_Phone_B -netdelay none -netspeed full >/tmp/smm-emulator-b.log 2>&1 &

echo "Waiting for both emulators to boot..."
adb wait-for-device
# Wait until we see 2 devices in device state
for i in $(seq 1 90); do
  count=$(adb devices | awk '$2=="device"{c++} END{print c+0}')
  echo "  connected devices: $count"
  if [ "$count" -ge 2 ]; then
    break
  fi
  sleep 2
done

adb devices -l
echo "Done. Use Expo with: cd apps/mobile && npx expo start --android"
echo "For second emulator install: adb -s <deviceId> install ..."
