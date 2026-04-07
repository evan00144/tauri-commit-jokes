# GitRoast

GitRoast is a desktop app that reads staged Git changes, sends them to a hosted commit-joke API, and returns one commit message worth copying into your normal workflow.

The desktop client is public. The hosted AI backend is not part of this repository.

If GitRoast saved you time or made your commit history less boring, support the project on Trakteer:
- [trakteer.id/evan_0014](https://trakteer.id/evan_0014)

## What It Is

- A Tauri desktop app for generating humorous commit messages from staged changes
- A public client that lets users inspect how repository data is collected and sent
- A lightweight tool built for fast commit-message generation, not full Git workflow management

## What It Is Not

- not a full Git client
- not an auto-commit bot
- not a local LLM app
- not a BYOK Gemini or OpenRouter client
- not a compliance-grade code review tool

## Privacy And Data Flow

GitRoast inspects your selected repository locally.

When you click `Generate`, the desktop app sends:
- staged file names and status
- staged diff content

GitRoast does not:
- auto-commit
- rewrite your repository
- ask you for a local Gemini, OpenRouter, or other AI API key

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
- optional WSL if you want GitRoast to inspect repos stored inside a Linux distro

### Linux

- `pnpm`
- Rust toolchain
- WebKitGTK and Tauri desktop prerequisites for your distro

## Local Development

1. Install dependencies.

```bash
pnpm install
```

2. Ensure Rust binaries are available.

```bash
export PATH="$HOME/.cargo/bin:$PATH"
```

3. Launch the app for the current repository.

```bash
scripts/cli/gitroast.sh
```

The launcher preserves the directory you run it from and passes it into the Tauri app as `--cwd <path>`.

No client-side AI key setup is required for the current hosted architecture.

### Windows + WSL repos

The packaged Windows app can inspect staged changes inside WSL repositories when the repo path is provided as a WSL UNC path such as:

```text
\\wsl$\Ubuntu\home\evan\my-project
\\wsl.localhost\Ubuntu\home\evan\my-project
```

GitRoast detects that path shape and routes Git commands through `wsl.exe` instead of Windows Git.

Practical usage:
- use `Choose repo root` and pick the repo under `\\wsl$`
- or launch the app from a Windows shell already pointed at the WSL UNC path

## Build

```bash
export PATH="$HOME/.cargo/bin:$PATH"
pnpm tauri:build
```

## GitHub Releases

GitRoast ships packaged desktop builds through GitHub Releases.

Release flow:

1. Bump the app version in [package.json](package.json) and [tauri.conf.json](src-tauri/tauri.conf.json).
2. Add a matching section to [CHANGELOG.md](CHANGELOG.md).
3. Commit the version and changelog changes.
4. Push a release tag such as `v0.1.0`.

```bash
git tag v0.1.0
git push origin v0.1.0
```

That tag triggers GitHub Actions to build Tauri bundles for:
- Linux x64
- Windows x64
- macOS Intel
- macOS Apple Silicon

The workflow uploads those assets to the matching GitHub Release.

## Current Product Notes

- Only staged changes are read.
- Git repository inspection happens locally in the desktop app.
- The app sends staged Git data to a hosted backend only when generation is requested.
- The backend model can change server-side without requiring a client update.
- The app never auto-commits.
- Clipboard copy behavior is handled in the frontend.

## Support

GitRoast is maintained as a small independent project. If you want to help cover hosting, model, and release costs:

- [Buy me a drink on Trakteer](https://trakteer.id/evan_0014)
