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

3. Launch the app and save your Gemini key in Settings.

GitRoast stores the key in the OS keychain and uses it across repositories.

Optional env fallback is still supported:

```bash
cp .env.example .env.local
```

Then edit `.env.local` and replace the placeholder value with your real Gemini API key if you prefer env-based local configuration. You can also set the model there, but the in-app model selector now acts as the primary packaged-app workflow.

Supported model env keys:

- `GITROAST_GEMINI_MODEL`
- `GEMINI_MODEL`

Supported model values:

- `gemini-2.5-flash`
- `gemini-2.5-pro`
- `gemini-2.5-flash-lite`

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
- Supported Gemini models are `gemini-2.5-flash`, `gemini-2.5-pro`, and `gemini-2.5-flash-lite`.
- API keys are primarily stored in the OS keychain, with `.env.local`, `.env`, and shell env as fallback.
- Model selection is primarily stored in app settings, with `.env.local`, `.env`, and shell env as fallback.
- Model availability still depends on your Gemini project quota and billing tier.
- The app never auto-commits in MVP.
- The frontend owns clipboard copy behavior.
