# GitRoast App Blueprint

## Purpose

This document describes the planned Markdown scaffold for the GitRoast MVP codebase. It fixes the repo layout, the responsibility of each subsystem, the Tauri command surface, and the frontend state model before implementation starts.

The blueprint assumes:
- Tauri backend in Rust
- React + Vite frontend
- CLI launch from the current working directory only
- Gemini 2.5 Flash as the only AI provider

## Proposed Repository Tree

```text
/
  BRD.md
  PRD.md
  docs/
    architecture/
      ERD.md
    plans/
      2026-04-06-gitroast-mvp-plan.md
    scaffold/
      app-blueprint.md
  src/
    app/
    components/
    features/
      onboarding/
      repo-status/
      generator/
    lib/
    types/
  src-tauri/
    src/
      commands/
      git/
      ai/
      secure_store/
      models/
      main.rs
      lib.rs
  scripts/
    cli/
```

## Module Responsibilities

### `src/app/`

Application shell, route-free page composition, app-level providers, and the main boot sequence that requests launch context and repo status.

### `src/components/`

Shared presentational components such as buttons, panels, status banners, loaders, and message display blocks.

### `src/features/onboarding/`

Owns API key capture, validation status messaging, and the `missing_api_key` flow.

### `src/features/repo-status/`

Owns launch-context rendering, repository summary, staged-change status, and invalid repo messaging.

### `src/features/generator/`

Owns the `Generate` action, loading state, generated message rendering, retry behavior, and copy interaction.

### `src/lib/`

Frontend utilities for invoking Tauri commands, normalizing backend responses, clipboard helpers if frontend-owned, and shared constants such as error-code mappings.

### `src/types/`

TypeScript definitions for command results, UI state unions, and entity-shaped payloads that mirror the MVP contracts.

### `src-tauri/src/commands/`

Thin Tauri command handlers exposed to the frontend. Commands should validate input, delegate to domain modules, and return normalized result objects.

### `src-tauri/src/git/`

Git execution helpers responsible for:
- Git availability checks
- repo root resolution
- staged file counting
- staged diff retrieval
- diff size measurement

### `src-tauri/src/ai/`

Gemini request builder, fixed prompt handling, response parsing, timeout behavior, and provider error normalization.

### `src-tauri/src/secure_store/`

OS-backed credential storage helpers for saving, retrieving, replacing, and checking Gemini API key state.

### `src-tauri/src/models/`

Rust structs for:
- repo context
- repo status
- API key status
- generation result
- normalized error payloads

### `scripts/cli/`

Wrapper or packaging scripts that define the `gitroast` CLI entrypoint and ensure the app launches with the current working directory as context.

## Tauri Command Contracts

These commands form the stable MVP surface between frontend and backend.

### `init_context(cwd: string) -> RepoContextResult`

Purpose:
- resolve launch context from the CLI-provided current working directory
- verify Git availability at a high level
- return enough information for the frontend to decide the initial app state

Suggested shape:

```ts
type RepoContextResult = {
  launchPath: string;
  gitAvailable: boolean;
  isRepo: boolean;
  repoRoot: string | null;
  repoName: string | null;
  errorCode: string | null;
};
```

### `get_repo_status(repoRoot: string) -> RepoStatusResult`

Purpose:
- inspect the active repo
- determine staged-change presence and diff size

Suggested shape:

```ts
type RepoStatusResult = {
  repoRoot: string;
  repoName: string;
  hasStagedChanges: boolean;
  stagedFileCount: number;
  diffByteSize: number;
  errorCode: string | null;
};
```

### `save_api_key(apiKey: string) -> SaveApiKeyResult`

Purpose:
- store the Gemini API key securely
- return non-secret status only

Suggested shape:

```ts
type SaveApiKeyResult = {
  success: boolean;
  providerName: "gemini";
  modelName: "gemini-2.5-flash";
  keyStatus: "saved" | "invalid" | "error";
  errorCode: string | null;
};
```

### `get_api_key_status() -> ApiKeyStatusResult`

Purpose:
- expose whether a usable key exists without returning the secret

Suggested shape:

```ts
type ApiKeyStatusResult = {
  providerName: "gemini";
  modelName: "gemini-2.5-flash";
  keyPresent: boolean;
  keyStatus: "missing" | "saved" | "valid" | "invalid";
  lastValidatedAt: string | null;
  errorCode: string | null;
};
```

### `generate_commit_message(repoRoot: string) -> GenerateCommitMessageResult`

Purpose:
- read the staged diff
- reject oversized diffs
- call Gemini with the fixed prompt
- return one concise commit message or a normalized error

Suggested shape:

```ts
type GenerateCommitMessageResult = {
  success: boolean;
  message: string | null;
  modelName: "gemini-2.5-flash";
  promptVersion: string;
  errorCode:
    | null
    | "missing_api_key"
    | "invalid_api_key"
    | "git_unavailable"
    | "not_a_repo"
    | "no_staged_changes"
    | "diff_too_large"
    | "provider_timeout"
    | "provider_error";
};
```

### `copy_to_clipboard(message: string) -> CopyResult`

Clipboard can be handled either in the frontend or natively. For MVP, frontend-owned clipboard behavior is acceptable if Tauri clipboard integration does not provide a product advantage.

If native:

```ts
type CopyResult = {
  success: boolean;
  errorCode: string | null;
};
```

If frontend-owned:
- keep `copy_to_clipboard` out of the backend command list
- use the browser/Tauri webview clipboard path in `src/lib/`

## Frontend State Map

The app should normalize all runtime behavior into these states:

- `missing_api_key`
- `invalid_launch_context`
- `no_staged_changes`
- `ready_to_generate`
- `generating`
- `generation_success`
- `generation_error`

### State Meaning

`missing_api_key`
- shown when no Gemini key is stored
- primary action: save API key

`invalid_launch_context`
- shown when the app is not launched from a valid repo or Git is unavailable
- primary action: relaunch from a repository or fix Git

`no_staged_changes`
- shown when the repo is valid but `git diff --staged` is empty
- primary action: stage changes and retry

`ready_to_generate`
- shown when repo state and key state are valid
- primary action: generate one message

`generating`
- shown while waiting on Gemini
- no duplicate generate action should fire

`generation_success`
- shown when one message is returned
- primary actions: copy, optionally regenerate

`generation_error`
- shown when generation fails after the app was otherwise ready
- primary action: retry or fix the indicated issue

## Runtime Flow

1. User stages changes in a repository.
2. User runs `gitroast` from that repository directory.
3. CLI wrapper launches the Tauri app and passes `cwd`.
4. Frontend boot calls `init_context(cwd)`.
5. If Git is unavailable or the directory is not in a repo, show `invalid_launch_context`.
6. If repo context is valid, frontend calls `get_api_key_status()`.
7. If key is missing, show `missing_api_key`.
8. After key is present, frontend calls `get_repo_status(repoRoot)`.
9. If no staged changes exist, show `no_staged_changes`.
10. If repo and key checks pass, show `ready_to_generate`.
11. User clicks `Generate`.
12. Frontend calls `generate_commit_message(repoRoot)`.
13. Backend reads the staged diff, enforces size limits, builds the fixed Gemini prompt, and submits the request.
14. On success, show `generation_success` with one message.
15. User clicks `Copy`.
16. Clipboard action completes and the user finishes the commit outside the app.

## Fixed MVP Contracts

### CLI Contract

- Entrypoint name: `gitroast`
- Launch mode: current working directory only
- No manual folder selection in MVP

### Git Contract

- `git rev-parse --show-toplevel`
- `git diff --staged`
- `git diff --staged --name-only`

### AI Contract

- Provider: Google AI Studio
- Model: `gemini-2.5-flash`
- Input: fixed prompt plus staged diff
- Output: one humorous commit message string

### Security Contract

- Raw API key is never written to repo files or plain local config
- Only non-secret metadata is exposed to the frontend

### Error Contract

- All backend and provider failures map to named user-visible states
- Generic crashes are considered implementation bugs, not acceptable user outcomes

## Acceptance Checklist

- Repo tree and module boundaries support the MVP only
- No blueprint section reintroduces auto-commit or multi-provider logic
- Repo state, credential state, and generation state map cleanly to the UI states above
- The blueprint stays consistent with `BRD.md`, `PRD.md`, `ERD.md`, and the implementation plan
