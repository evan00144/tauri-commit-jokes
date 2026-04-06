# Product Requirements Document (PRD)

**Project Name:** GitRoast (Working Title)  
**Platform:** Desktop (macOS, Windows, Linux) via Tauri  
**Version:** MVP v1  
**Core Objective:** Open a small desktop app from the current Git repository, read the staged diff, and generate one funny commit message with AI.

## 1. Product Summary

GitRoast is a tiny desktop utility for developers who want faster and more entertaining commit messages. The MVP focuses on one job only: detect the current repository, read staged changes, send them to an AI model, and return a commit message the user can copy.

This version is intentionally narrow. It is not a full Git client, not a collaboration tool, and not a prompt marketplace.

## 2. Problem Statement

Writing commit messages is repetitive and interrupts flow. Existing AI tools are often too broad, too expensive to operate, or too heavy for a quick local workflow.

GitRoast solves this by giving the user a fast, local-first flow:
- stage changes in Git
- open the app from the project directory
- generate a commit message from the staged diff
- copy the result

## 3. Target User

The MVP targets:
- solo developers
- indie hackers
- front-end and product-minded engineers
- developers comfortable using Git in the terminal

The first version assumes the user already understands:
- how to stage files with Git
- how to open a tool from the command line
- how to use their own API key

## 4. MVP Scope

### In Scope

- Launch the app from the current working directory
- Verify that the directory is a Git repository
- Read staged changes using Git
- Let the user store their own API key securely on their machine
- Generate one humorous commit message from the staged diff
- Show the result in the UI
- Copy the result to the clipboard
- Display clear error states for common failures

### Out of Scope

- Multiple AI providers
- Auto-commit from the app
- Global hotkey
- Drag-and-drop folder selection
- GitHub or GitLab integrations
- System tray behavior
- Premium persona packs
- Team features or cloud sync
- Billing and licensing flows

## 5. Core User Flow

1. User stages code changes in a Git repository.
2. User runs `gitroast` from that repository directory.
3. The app opens and uses the launch directory as its repo context.
4. The app checks whether the directory is a valid Git repository.
5. If the user has not configured an API key yet, the app prompts them to add one.
6. The app checks whether staged changes exist.
7. The user clicks `Generate`.
8. The app reads `git diff --staged`.
9. The app sends the diff to the configured AI provider with a fixed prompt.
10. The app shows one generated commit message.
11. The user clicks `Copy`.

## 6. Functional Requirements

### 6.1 Repository Context

- The app must accept a directory context when launched from the CLI.
- The app must treat that directory as the active project scope.
- The app must verify the directory belongs to a Git repository before enabling generation.
- The app must surface the detected repository name or path in the UI.

### 6.2 Staged Diff Reader

- The app must read staged changes only.
- The app must use Git commands instead of parsing files directly.
- The primary command is `git diff --staged`.
- If there are no staged changes, the app must block generation and show a clear message.

### 6.3 AI Generation

- The MVP supports one AI provider only.
- The app must use a fixed internal prompt that asks for one humorous commit message based on the staged diff.
- The app must return a single result, not a list of alternatives.
- The result should be short enough to function as a real commit message.

### 6.4 API Key Management

- The user must provide their own API key.
- The app must store the key locally using secure OS-backed storage where available.
- The app must not require user login or cloud account creation.
- The app must allow the user to update or remove the stored key.

### 6.5 Result Handling

- The generated commit message must be visible in the main screen.
- The app must provide a `Copy` action.
- The app must allow the user to regenerate if they dislike the output.

## 7. Non-Functional Requirements

### Performance

- The app should open quickly from the CLI.
- The app should feel responsive while checking repo state and loading the UI.
- Generation latency depends on the AI provider, but the loading state must be clear.

### Security

- API keys must not be stored in plain text config files if secure storage is available.
- The app must keep all repository inspection local except for the diff content sent to the chosen AI provider.
- The app must not execute `git commit` in MVP.

### Reliability

- The app must fail safely when Git is unavailable, the directory is invalid, or the API request fails.
- Errors must be shown in human-readable language.

## 8. Error States

The MVP must handle these cases explicitly:

- The launch directory is not a Git repository
- Git is not installed or cannot be executed
- No staged changes exist
- No API key is configured
- The API key is invalid
- The AI request times out or fails
- The diff is too large to send as-is

## 9. UX Requirements

The interface should be minimal and focused. The main screen should include:
- current repository indicator
- staged-change status
- primary `Generate` button
- loading state during generation
- generated commit message area
- `Copy` button
- access to API key settings

The visual style can still be playful, but the product should prioritize clarity over decoration in v1.

## 10. Technical Approach

### Desktop Framework

- Tauri

### Backend

- Rust
- Responsible for:
  - reading launch context
  - validating Git repository state
  - executing Git commands
  - reading and returning staged diff data
  - accessing secure local storage for the API key

### Frontend

- A lightweight web UI within Tauri
- React is recommended for maintainability, but the MVP can use any simple frontend stack

## 11. Prompt and Output Constraints

The app should generate commit messages that are:
- funny or sarcastic
- readable as actual commit messages
- based on the staged diff rather than generic summaries
- concise enough to paste into `git commit -m`

The MVP does not need multiple tones, personas, or formatting styles. One default tone is enough.

## 12. Success Criteria

The MVP is successful if a user can:

1. stage changes in a repository
2. launch the app from that repository
3. generate a commit message from the staged diff
4. copy and use the message without manual rewriting

## 13. Future Versions

Possible future additions after MVP validation:
- support for more than one AI provider
- optional auto-commit
- persona or tone presets
- drag-and-drop repository selection
- global shortcut support
- multiple commit message suggestions
- commit style options such as conventional commits