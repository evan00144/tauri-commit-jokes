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

3. Launch the app for the current repository:

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
- API keys are stored in the OS credential store via `keyring`.
- The app never auto-commits in MVP.
- The frontend owns clipboard copy behavior.
