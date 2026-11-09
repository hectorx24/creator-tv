#!/usr/bin/env bash
# Repack Creator TV from the installed v4.1 base APK (backups/device/installed-4.1.apk).
# Replaces: assets/www (v0-vvvv/dist) and classes4.dex (integrated/src/java). Keeps smali/res intact.
# Usage: bash integrated/repack.sh <versionCode> <versionName>
set -euo pipefail
VC=${1:?versionCode}; VN=${2:?versionName}
ROOT=$(cd "$(dirname "$0")/.." && pwd); I="$ROOT/integrated"
J="/c/Program Files/Android/Android Studio/jbr/bin"; SDK="$LOCALAPPDATA/Android/Sdk"; T="$SDK/build-tools/36.0.0"; PLAT="$SDK/platforms/android-35/android.jar"
BASE="$ROOT/backups/device/installed-4.1.apk"; W="$I/work41"
[ -d "$W" ] || "$J/java.exe" -jar "$I/tools/apktool.jar" d -f -s "$BASE" -o "$W"
# 1. frontend
(cd "$ROOT/v0-vvvv" && npm run build >/dev/null)
rm -rf "$W/assets/www" && mkdir -p "$W/assets/www" && cp -r "$ROOT/v0-vvvv/dist/." "$W/assets/www/"
# 2. native java -> classes4.dex
rm -rf "$I/classes" "$I/native-dex" && mkdir -p "$I/classes" "$I/native-dex"
"$J/javac.exe" -nowarn -encoding UTF-8 -source 8 -target 8 -classpath "$PLAT" -d "$I/classes" $(find "$I/src/java" -name '*.java') 2>&1 | grep -vE "^warning|^Note|^1 warning|bootstrap" || true
[ -f "$I/classes/com/patreontv/personal/CatalogExtension.class" ] || { echo "javac failed"; exit 1; }
"$J/jar.exe" cf "$I/native.jar" -C "$I/classes" .
JAVA_HOME="$(dirname "$J")" "$T/d8.bat" --lib "$PLAT" --min-api 26 --output "$I/native-dex" "$I/native.jar"
cp "$I/native-dex/classes.dex" "$W/classes4.dex"
# 3. version + manifest + brand (the app is "Creator TV"; the package id stays for in-place updates)
sed -i 's/android:label="Patreon TV Personal"/android:label="Creator TV"/; s/android:label="Patreon TV Now Playing"/android:label="Creator TV · Reproduciendo"/' "$W/AndroidManifest.xml"
sed -i 's#<string name="app_name">Patreon TV</string>#<string name="app_name">Creator TV</string>#' "$W/res/values/strings.xml"
sed -i -E "s/versionCode: .*/versionCode: $VC/; s/versionName: .*/versionName: $VN/" "$W/apktool.yml"
# 4. build, align, sign
mkdir -p "$I/output"; OUT="$I/output/CreatorTV-$VN.apk"
"$J/java.exe" -jar "$I/tools/apktool.jar" b "$W" -o "$I/output/unsigned.apk" >/dev/null
"$T/zipalign.exe" -f 4 "$I/output/unsigned.apk" "$I/output/aligned.apk"
"$T/apksigner.bat" sign --ks "$USERPROFILE/.android/debug.keystore" --ks-key-alias androiddebugkey --ks-pass pass:android --key-pass pass:android --out "$OUT" "$I/output/aligned.apk"
"$T/apksigner.bat" verify "$OUT" && echo "OK $OUT" && sha256sum "$OUT"
