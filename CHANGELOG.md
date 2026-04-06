# Changelog

All notable changes to GitRoast should be documented in this file.

The release workflow reads the section matching the pushed tag version and uses it as the GitHub Release notes body.

## [Unreleased]

### Added

- Placeholder for upcoming changes.

## [0.1.0] - 2026-04-06

### Added

- Initial GitRoast desktop MVP built with Tauri, Rust, React, and Vite.
- CLI launch support that scopes the app to the current repository.
- Env-based Gemini API key detection with repo switching.
- App-managed Gemini model selection with `gemini-2.5-flash` as the default.
- Commit message generation, copy flow, and staged diff inspection UI.
- GitHub release workflow for packaged desktop builds.

### Changed

- Landing experience now includes stronger source/support CTAs and an in-app tutorial card.
