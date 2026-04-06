#!/usr/bin/env sh
set -eu

LAUNCH_CWD="$(pwd)"
ROOT_DIR="$(CDPATH= cd -- "$(dirname "$0")/../.." && pwd)"

cd "$ROOT_DIR"
export PATH="$HOME/.cargo/bin:$PATH"
pnpm exec tauri dev -- --cwd "$LAUNCH_CWD"
