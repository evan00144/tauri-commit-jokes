# GitRoast MVP Implementation Plan

**Goal:** Build a Tauri desktop app that launches from the current repository, reads staged Git changes, generates one humorous commit message with Gemini 2.5 Flash, and lets the user copy the result.

**Architecture:** The app is split into a Rust/Tauri backend for launch context, Git inspection, secure credential handling, and Gemini requests, plus a React/Vite frontend that renders onboarding, repo status, generation states, and copy interactions. The MVP is intentionally single-path and single-provider to keep implementation and validation tight.

**Tech Stack:** Tauri, Rust, React, Vite, Google AI Studio Gemini API

---

## Milestone 1: Tauri shell and CLI launch context

### Scope

- Initialize a Tauri app with a React/Vite frontend.
- Add a CLI entrypoint named `gitroast`.
- Pass the current working directory into the app as launch context.
- Load the main window already scoped to the provided directory.

### Required Behavior

- `gitroast` launched from a terminal uses the current working directory only.
- No folder picker or drag-and-drop fallback exists in MVP.
- The frontend receives enough context to determine whether it should proceed with repo checks or show an invalid launch state.

### Acceptance Criteria

- Running `gitroast` opens the desktop app.
- The app receives the original `cwd` value.
- The app does not ask the user to browse for a directory.
- Launch behavior is identical across supported desktop platforms within Tauri constraints.

## Milestone 2: Git repo validation and staged diff reading

### Scope

- Validate that Git is available.
- Resolve the canonical repo root.
- Detect whether staged changes exist.
- Measure staged file count and diff size.

### Commands to Implement

- `git rev-parse --show-toplevel`
- `git diff --staged`
- `git diff --staged --name-only`

### Required Behavior

- Generation is disabled outside a valid Git repository.
- Generation is disabled when no staged changes exist.
- The app computes:
  - `repo_root`
  - `repo_name`
  - `has_staged_changes`
  - `staged_file_count`
  - `diff_byte_size`
- Oversized diffs return a user-facing `diff too large` error rather than silent truncation.

### Acceptance Criteria

- A valid repo returns repo metadata and staged-change state.
- A non-repo launch path maps to `invalid_launch_context`.
- A repo with zero staged changes maps to `no_staged_changes`.
- Git command failures map to a named error state instead of crashing the app.

## Milestone 3: Secure Gemini API key storage

### Scope

- Add onboarding/settings for the user to save a Gemini API key.
- Store the secret in secure OS-backed storage.
- Persist only non-secret metadata in app config.
- Expose API key presence/status to the frontend.

### Required Behavior

- Raw API keys are never written to repo files or plain local config.
- The frontend can distinguish:
  - missing key
  - saved key
  - invalid key after a failed provider call
- The user can replace an existing key.

### Acceptance Criteria

- A first-time user sees API key onboarding before generation is allowed.
- Saving a key succeeds without exposing the raw key in normal config.
- Stored-key status survives app relaunch.
- Invalid-key outcomes are visible and recoverable.

## Milestone 4: Gemini commit-message generation service

### Scope

- Implement a fixed internal prompt for commit generation.
- Submit the staged diff to Gemini 2.5 Flash.
- Return one concise humorous commit message string.
- Normalize provider failures into stable app error codes.

### AI Contract

- Input: staged diff plus fixed prompt
- Model: `gemini-2.5-flash`
- Output: one humorous commit message string only

### Required Behavior

- The app does not return multiple suggestions in MVP.
- The output remains short enough to use with `git commit -m`.
- Provider timeout, invalid key, and provider errors map to distinct recoverable failures.

### Acceptance Criteria

- A valid diff and valid key produce exactly one message string.
- The response is rendered without requiring user editing to understand it.
- Provider failures do not leave the app stuck in a loading state.

## Milestone 5: React UI states and actions

### Scope

- Implement the main window UI for all required states.
- Add `Generate`, `Copy`, and settings/API-key actions.
- Show repository and staged-change context clearly.

### Required Frontend States

- `missing_api_key`
- `invalid_launch_context`
- `no_staged_changes`
- `ready_to_generate`
- `generating`
- `generation_success`
- `generation_error`

### Required Behavior

- The primary call to action is `Generate`.
- `Copy` is shown only when there is a generated message.
- Commit execution is absent from MVP.
- The UI shows the active repository context and why generation is blocked when blocked.

### Acceptance Criteria

- Each state has a clear screen or panel rendering.
- The user can move from onboarding to ready-to-generate without relaunching.
- The generated message can be copied in one action.

## Milestone 6: Error-state handling and acceptance checks

### Scope

- Normalize backend and provider failures into stable UI states.
- Verify the full launch-to-copy loop.
- Confirm deferrals remain out of the build.

### Required Error Cases

- Git unavailable
- launch path is not a Git repo
- no staged changes
- missing API key
- invalid API key
- diff too large
- provider timeout
- provider error

### Acceptance Criteria

- Every failure maps to a named user-visible state, not a generic crash.
- The user always has a next action: fix key, stage files, relaunch from repo, or retry generation.
- No hidden fallback flow reintroduces folder picking, auto-commit, or multi-provider behavior.

## Test Scenarios

### Happy Path

- Launch from a valid repo with staged changes and a valid API key.
- Expected result: repo is detected, generation succeeds, one commit message appears, and copy succeeds.

### Repo and Git Validation

- Launch outside a repo.
- Expected result: `invalid_launch_context` with no generate action.

- Launch in a repo with no staged changes.
- Expected result: `no_staged_changes` with clear instruction to stage files first.

- Launch where Git is unavailable or cannot execute.
- Expected result: explicit Git error state with no crash.

### Credential Handling

- Launch with no stored key.
- Expected result: `missing_api_key` gate before generation.

- Save an invalid key and attempt generation.
- Expected result: `generation_error` with invalid-key messaging and retry path.

### Provider and Payload Failures

- Attempt generation with an oversized diff.
- Expected result: `diff too large` user-facing error and no silent truncation.

- Simulate provider timeout or provider error.
- Expected result: recoverable `generation_error` and retry path.

## Deferrals

These items stay out of MVP even if implementation seems convenient:
- auto-commit
- multiple AI providers
- manual folder picker
- drag-and-drop repo selection
- persona packs
- multiple commit-message options
- Git hosting integrations
- billing or licensing flows
- analytics and cloud sync

## Default Assumptions

- `gitroast` is the only supported launch entrypoint for MVP.
- Gemini 2.5 Flash is the only model used in MVP.
- The fixed prompt version is tracked in settings and generation records.
- Copy is the final in-app action; committing remains in the user's existing workflow.
