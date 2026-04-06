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
