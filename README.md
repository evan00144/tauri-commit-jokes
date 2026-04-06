# GitRoast

GitRoast is a Tauri desktop utility that reads staged Git changes from the current repository and generates one funny, usable commit message with Gemini.

## Stack

- Tauri v2
- Rust
- React + Vite
- pnpm

## Prerequisites

### macOS

- `pnpm`
- Rust toolchain in `~/.cargo/bin`
- Xcode Command Line Tools

### Windows

- `pnpm`
- Rust MSVC toolchain
- WebView2 runtime
- Visual Studio C++ build tools

### Linux

- `pnpm`
- Rust toolchain
- WebKitGTK and Tauri desktop prerequisites for your distro

## Local Development

1. Install dependencies:

```bash
pnpm install
```

2. Ensure Rust binaries are available:

```bash
export PATH="$HOME/.cargo/bin:$PATH"
```

3. Add a Gemini key to the current repository environment:

```bash
cp .env.example .env.local
```

Then edit `.env.local` and replace the placeholder value with your real Gemini API key. GitRoast reads `.env.local`, then `.env`, then inherited shell env.

4. Launch the app for the current repository:

```bash
scripts/cli/gitroast.sh
```

The launcher preserves the directory you run it from and passes it into the Tauri app as `--cwd <path>`.

## Build

```bash
export PATH="$HOME/.cargo/bin:$PATH"
pnpm tauri:build
```

## MVP Notes

- Only staged changes are read.
- API keys are read from `.env.local`, `.env`, or inherited shell env.
- Model selection is stored in GitRoast app config, with `gemini-2.5-flash` as the default.
- The app ships with Gemini presets for `gemini-3.1-pro`, `gemini-3-flash`, `gemini-3.1-flash-lite`, `gemini-2.5-pro`, `gemini-2.5-flash`, `gemini-2.5-flash-lite`, and `gemini-flash-latest`.
- You can also save any custom Gemini model string in the app settings if Google exposes a newer model before GitRoast updates its preset list.
- The app does not store secrets in keychain or app-managed local databases.
- Model availability still depends on your Gemini project quota and billing tier.
- The app never auto-commits in MVP.
- The frontend owns clipboard copy behavior.
