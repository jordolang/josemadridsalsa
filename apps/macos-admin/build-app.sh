#!/bin/zsh
set -euo pipefail

# Builds the macOS admin app bundle. The standalone Command Line Tools are
# enough: they ship no SwiftUI macro plugin, so the sources stay clear of
# `@State` and the other SwiftUI macros and use property wrappers instead.
# Reintroducing `@State` breaks this build on any machine without full Xcode.

SCRIPT_DIR=${0:A:h}
APP_NAME="Jose Madrid Salsa Admin"
APP_DIR="$SCRIPT_DIR/dist/$APP_NAME.app"
ICONSET_DIR="$SCRIPT_DIR/.build/AppIcon.iconset"

# The whole platform carries one version number; keep the bundle in step with it
# rather than maintaining a second one here.
VERSION=$(node -p "require('$SCRIPT_DIR/../../package.json').version" 2>/dev/null || echo "0.1.0")

cd "$SCRIPT_DIR"

# .build is gitignored, so it does not exist on a fresh checkout and swiftc has
# nowhere to write the checker. `swift build` would create it, but that runs
# after this step by design.
mkdir -p .build

# Endpoint and navigation policy decide where the app may point and what it lets
# out to the browser. Check them before building anything else.
swiftc Sources/JoseMadridAdmin/AdminEndpoint.swift \
  Sources/JoseMadridAdmin/AdminSections.swift \
  Sources/JoseMadridAdmin/UpdateFeed.swift \
  Sources/JoseMadridAdmin/ReceiptJob.swift \
  Tests/main.swift \
  -o .build/endpoint-check
.build/endpoint-check

# Universal: Apple silicon and Intel in one binary, so the same download runs on
# any Mac from macOS 14. SwiftPM warns that x86_64 is deprecated for the build
# machine's own OS; the binary's minimum stays macOS 14 on both slices.
ARCHS=(--arch arm64 --arch x86_64)
swift build -c release "${ARCHS[@]}"

# Where the binary lands depends on the toolchain: older SwiftPM writes to
# .build/release, the Xcode-backed build system to .build/out/Products/Release.
# Ask SwiftPM rather than hardcode one, and fail loudly rather than bundle an
# .app with no executable inside it.
BUILD_DIR=$(swift build -c release "${ARCHS[@]}" --show-bin-path 2>/dev/null || true)
if [ -z "$BUILD_DIR" ] || [ ! -x "$BUILD_DIR/JoseMadridAdmin" ]; then
  FOUND=$(find "$SCRIPT_DIR/.build" -type f -name JoseMadridAdmin -perm -111 -print -quit 2>/dev/null || true)
  BUILD_DIR=${FOUND:+$(dirname "$FOUND")}
fi
if [ -z "$BUILD_DIR" ] || [ ! -x "$BUILD_DIR/JoseMadridAdmin" ]; then
  echo "build-app.sh: could not find the built JoseMadridAdmin binary under .build" >&2
  exit 1
fi
echo "Built binary: $BUILD_DIR/JoseMadridAdmin"

mkdir -p "$APP_DIR/Contents/MacOS" "$APP_DIR/Contents/Resources"
cp "$BUILD_DIR/JoseMadridAdmin" "$APP_DIR/Contents/MacOS/JoseMadridAdmin"
LOGO="$SCRIPT_DIR/../storefront/public/images/shared/jose_madrid_logo_profile640x640.png"
mkdir -p "$ICONSET_DIR"
for size in 16 32 128 256 512; do
  sips -z "$size" "$size" "$LOGO" --out "$ICONSET_DIR/icon_${size}x${size}.png" >/dev/null
  retina=$((size * 2))
  sips -z "$retina" "$retina" "$LOGO" --out "$ICONSET_DIR/icon_${size}x${size}@2x.png" >/dev/null
done
iconutil -c icns "$ICONSET_DIR" -o "$APP_DIR/Contents/Resources/AppIcon.icns"

/usr/libexec/PlistBuddy -c "Clear dict" "$APP_DIR/Contents/Info.plist" 2>/dev/null || true
/usr/libexec/PlistBuddy -c "Add :CFBundleExecutable string JoseMadridAdmin" "$APP_DIR/Contents/Info.plist"
/usr/libexec/PlistBuddy -c "Add :CFBundleIdentifier string com.josemadridsalsa.admin" "$APP_DIR/Contents/Info.plist"
/usr/libexec/PlistBuddy -c "Add :CFBundleName string $APP_NAME" "$APP_DIR/Contents/Info.plist"
/usr/libexec/PlistBuddy -c "Add :CFBundleDisplayName string $APP_NAME" "$APP_DIR/Contents/Info.plist"
/usr/libexec/PlistBuddy -c "Add :CFBundlePackageType string APPL" "$APP_DIR/Contents/Info.plist"
/usr/libexec/PlistBuddy -c "Add :CFBundleShortVersionString string $VERSION" "$APP_DIR/Contents/Info.plist"
/usr/libexec/PlistBuddy -c "Add :CFBundleVersion string $VERSION" "$APP_DIR/Contents/Info.plist"
/usr/libexec/PlistBuddy -c "Add :CFBundleIconFile string AppIcon" "$APP_DIR/Contents/Info.plist"
/usr/libexec/PlistBuddy -c "Add :LSMinimumSystemVersion string 14.0" "$APP_DIR/Contents/Info.plist"
/usr/libexec/PlistBuddy -c "Add :LSArchitecturePriority array" "$APP_DIR/Contents/Info.plist"
/usr/libexec/PlistBuddy -c "Add :LSArchitecturePriority:0 string arm64" "$APP_DIR/Contents/Info.plist"
# Downloads and printing both write outside the bundle, and the app talks to the
# admin server over the network.
/usr/libexec/PlistBuddy -c "Add :NSHumanReadableCopyright string Copyright © Jose Madrid Salsa" "$APP_DIR/Contents/Info.plist"
# A network receipt printer sits on the shop's own network, which macOS asks
# permission to reach the first time a ticket goes to it.
/usr/libexec/PlistBuddy -c "Add :NSLocalNetworkUsageDescription string Order tickets print on the receipt printer on your network." "$APP_DIR/Contents/Info.plist"

# Developer ID when MACOS_SIGN_IDENTITY names one (the Desktop Apps workflow
# sets it from its certificate secrets): hardened runtime and a timestamp, which
# notarisation requires. Otherwise an ad-hoc signature, which runs on the
# machine that built it and needs right-click > Open anywhere else.
if [ -n "${MACOS_SIGN_IDENTITY:-}" ]; then
  codesign --force --deep --options runtime --timestamp --sign "$MACOS_SIGN_IDENTITY" "$APP_DIR"
else
  codesign --force --deep --sign - "$APP_DIR"
fi
echo "$APP_DIR"
