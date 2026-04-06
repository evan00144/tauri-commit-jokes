# GitRoast

GitRoast is a Tauri desktop utility that reads staged Git changes from the current repository and generates one funny, usable commit message with Gemini 2.5 Flash.

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

3. Add a Gemini key to the project environment:

```bash
cp .env.example .env.local
```

Then edit `.env.local` and replace the placeholder value with your real Gemini API key.

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
- Only Gemini `gemini-2.5-flash` is supported.
- API keys are read from `.env.local`, `.env`, or inherited shell env.
- The app never auto-commits in MVP.
- The frontend owns clipboard copy behavior.
