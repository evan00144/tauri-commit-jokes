# GitRoast

GitRoast is a small open-source desktop app for fun commit roasting.

It reads your staged Git diff, sends it to Gemini with your own API key, and gives you a commit message that is hopefully funny enough to keep and usable enough to paste.

This project is intentionally lightweight:
- open source
- local-first
- BYOK for Gemini
- built more for developer fun than enterprise workflow rigor

If you want to inspect exactly what it does, the source is public here:
- [github.com/evan00144/tauri-commit-jokes](https://github.com/evan00144/tauri-commit-jokes)

If GitRoast made your commit history slightly more cursed and you want to support it:
- [Buy me a drink on Trakteer](https://trakteer.id/evan_0014)

## What It Is

- A playful commit-message generator for staged changes
- An open-source Tauri desktop app
- A bring-your-own-key tool for Google Gemini
- A side project that prioritizes transparency over automation magic

## What It Is Not

- not a full Git client
- not an auto-commit bot
- not a hosted SaaS
- not a hidden-proxy AI wrapper
- not a serious compliance-grade developer platform

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

### Windows + WSL repos

The packaged Windows app can inspect staged changes inside WSL repositories when the repo path is provided as a WSL UNC path such as:

```text
\\wsl$\Ubuntu\home\evan\my-project
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

GitRoast now includes a GitHub Actions release workflow at [.github/workflows/release.yml](/Users/evan/Projects/tauri-commit-jokes/.github/workflows/release.yml).

How it works:

1. Bump the app version in [package.json](/Users/evan/Projects/tauri-commit-jokes/package.json) and [tauri.conf.json](/Users/evan/Projects/tauri-commit-jokes/src-tauri/tauri.conf.json).
2. Add a matching section to [CHANGELOG.md](/Users/evan/Projects/tauri-commit-jokes/CHANGELOG.md), for example `## [0.1.1] - 2026-04-07`.
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

The workflow uploads those installers and bundles to the matching GitHub Release so users can download them directly from the Releases page.

### Release notes

The workflow extracts release notes from the matching version section in [CHANGELOG.md](/Users/evan/Projects/tauri-commit-jokes/CHANGELOG.md).

Example:

```md
## [0.1.1] - 2026-04-07

### Added

- New generator scoring for multi-file staged diffs.

### Fixed

- External source and support links now open in the system browser.
```

If that version section is missing, the workflow falls back to a short generic release body.

### Optional signing and notarization secrets

You can publish unsigned builds immediately, but if you want cleaner installs you should add the relevant GitHub repository secrets.

macOS code signing:
- `APPLE_CERTIFICATE`
- `APPLE_CERTIFICATE_PASSWORD`
- `KEYCHAIN_PASSWORD`
- optional `APPLE_SIGNING_IDENTITY`

macOS notarization with Apple ID:
- `APPLE_ID`
- `APPLE_PASSWORD`
- `APPLE_TEAM_ID`

macOS notarization with App Store Connect API:
- `APPLE_API_KEY`
- `APPLE_API_ISSUER`
- `APPLE_API_KEY_CONTENT`

Tauri updater artifact signing:
- `TAURI_SIGNING_PRIVATE_KEY`
- `TAURI_SIGNING_PRIVATE_KEY_PASSWORD`

Notes:
- No signing secrets are required for the workflow to produce downloadable assets.
- Unsigned macOS and Windows builds may still show platform trust warnings until you add code signing and notarization.
- Manual runs through `workflow_dispatch` require a release tag input such as `v0.1.0`.

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

## Support

If you want to support the project, use Trakteer:

- [trakteer.id/evan_0014](https://trakteer.id/evan_0014)
