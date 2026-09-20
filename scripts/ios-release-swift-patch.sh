#!/usr/bin/env bash
# Workaround for a Release-only iOS build failure (see MOBILE.md, section
# "iOS: Release-Build – Swift-Symbolsichtbarkeit").
#
# The `@_cdecl` bridge functions that swift-rs and Tauri's own iOS Swift
# package (`Tauri.swift`) expose to Rust are declared without an explicit
# `public` access modifier. Debug/no-optimization Swift builds keep them
# externally visible regardless, but Release builds (whole-module
# optimization) can internalize non-public symbols, which then fails the
# final Rust link step with "symbol(s) not found for architecture arm64"
# for things like `_retain_object`, `_string_from_bytes` or
# `_run_plugin_command`.
#
# This script patches the affected Swift sources so those symbols stay
# `public`:
#   - swift-rs: mirrored locally (see vendor/swift-rs-patched) and wired up
#     via a Swift Package Manager mirror, since it's fetched from GitHub.
#   - Tauri's own `mobile/ios-api` Swift package, and the copies each iOS
#     plugin bundles of it: patched directly in the local Cargo registry
#     cache, since those are vendored into the crate itself rather than
#     fetched separately.
#
# Idempotent - safe to run again (already-patched files are left as-is).
# Run this once before `npx tauri ios build` (dev builds aren't affected,
# but running it never hurts). CI runs it automatically, see
# .github/workflows/build.yml.
set -euo pipefail

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
REPO_ROOT="$(cd "$SCRIPT_DIR/.." && pwd)"
SWIFT_RS_VENDOR="$REPO_ROOT/src-tauri/vendor/swift-rs-patched"

if [ ! -d "$SWIFT_RS_VENDOR" ]; then
  echo "error: $SWIFT_RS_VENDOR not found - is this script run from the repo?" >&2
  exit 1
fi

echo "==> Turning vendor/swift-rs-patched into a local git repo (SPM mirrors need a real git remote)"
if [ ! -d "$SWIFT_RS_VENDOR/.git" ]; then
  git -C "$SWIFT_RS_VENDOR" init -q
  git -C "$SWIFT_RS_VENDOR" add -A
  git -C "$SWIFT_RS_VENDOR" -c user.email="ci@localhost" -c user.name="ios-release-swift-patch" \
    commit -q -m "patched: expose @_cdecl functions as public for Release/WMO builds"
fi
# Package.swift pins swift-rs `from: "1.0.0"` - any tag >= 1.0.0 that's also
# >= the version actually used in Cargo.lock resolves fine; match Cargo.lock.
SWIFT_RS_CARGO_VERSION="$(grep -A1 '^name = "swift-rs"' "$REPO_ROOT/src-tauri/Cargo.lock" | grep '^version' | head -1 | sed -E 's/.*"(.*)"/\1/')"
git -C "$SWIFT_RS_VENDOR" tag -f "${SWIFT_RS_CARGO_VERSION:-1.0.8}" >/dev/null

echo "==> Registering global SwiftPM mirror for swift-rs -> $SWIFT_RS_VENDOR"
MIRRORS_DIR="$HOME/Library/org.swift.swiftpm/configuration"
mkdir -p "$MIRRORS_DIR"
cat > "$MIRRORS_DIR/mirrors.json" <<EOF
{
  "object" : [
    {
      "mirror" : "file://$SWIFT_RS_VENDOR",
      "original" : "https://github.com/Brendonovich/swift-rs"
    }
  ],
  "version" : 1
}
EOF

echo "==> Patching @_cdecl functions in the local Cargo registry cache (tauri's own ios-api)"
CARGO_HOME_DIR="${CARGO_HOME:-$HOME/.cargo}"
patched_any=0
while IFS= read -r -d '' f; do
  if grep -q '@_cdecl' "$f" && grep -qE '^\s*func ' "$f"; then
    chmod u+w "$f"
    # Only functions immediately preceded by an @_cdecl(...) line - leaves
    # every other declaration in the file untouched.
    perl -0pi -e 's/(@_cdecl\([^\n]*\)\s*\n)func /\1public func /g' "$f"
    echo "   patched: $f"
    patched_any=1
  fi
done < <(find "$CARGO_HOME_DIR/registry/src" -path "*tauri*/Sources/Tauri/Tauri.swift" -print0 2>/dev/null)

while IFS= read -r -d '' f; do
  if grep -q '@_cdecl' "$f" && grep -qE '^\s*func init_plugin_' "$f"; then
    chmod u+w "$f"
    perl -0pi -e 's/(@_cdecl\([^\n]*\)\s*\n)func /\1public func /g' "$f"
    echo "   patched: $f"
    patched_any=1
  fi
done < <(find "$CARGO_HOME_DIR/registry/src" -path "*tauri-plugin-*/ios/Sources/*Plugin.swift" -print0 2>/dev/null)

if [ "$patched_any" = "0" ]; then
  echo "   (nothing to patch yet - crates not downloaded? run 'cargo fetch' in src-tauri first)"
fi

echo "==> Done. You can now run: npx tauri ios build --export-method debugging"
