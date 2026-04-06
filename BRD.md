# Business Requirements Document (BRD)

## Product Overview

GitRoast is a desktop utility that helps developers generate funny but usable commit messages from staged Git changes. The MVP is intentionally small: the user runs `gitroast` inside a repository, the app reads the staged diff, calls Gemini 2.5 Flash with the user's API key, and returns one commit message that can be copied immediately.

This document is the business-level source of truth for the MVP. It describes what the product must achieve and what is intentionally excluded from the first release.

## Problem

Commit messages are necessary but repetitive. Developers often stop their flow to write a message that is technically acceptable but low-value and forgettable.

There is room for a small local-first tool that:
- removes the friction of writing the message
- adds entertainment without becoming a full Git client
- feels fast enough to use during normal terminal-driven development

## Target User

GitRoast MVP is designed for:
- solo developers
- indie hackers
- engineers who already use Git from the terminal
- users comfortable providing their own AI API key

The MVP assumes the user already knows how to:
- stage changes with Git
- launch a CLI tool from a repository directory
- paste a commit message into their normal Git workflow

## Core Value Proposition

GitRoast gives developers a faster and more enjoyable commit-message workflow without changing how they already use Git.

The product value for MVP is:
- local-first repo detection from the current working directory
- no account creation
- one-click copy of a generated commit message
- playful output that still works as a real commit message

## Business Goal

The business goal of the MVP is to validate demand for a tiny local-first commit-message generator before investing in broader product features.

The MVP should answer these business questions:
- Will developers use a dedicated desktop app for this narrow workflow?
- Does humorous AI output create enough differentiation to justify a standalone tool?
- Is a BYOK model acceptable for early adopters?

## Primary User Journey

1. The user stages changes in a Git repository.
2. The user runs `gitroast` from that repository directory.
3. The app opens already scoped to the current repository.
4. The app checks Git availability, repository validity, and staged-change presence.
5. If needed, the app asks the user to provide a Gemini API key.
6. The user clicks `Generate`.
7. The app generates one concise humorous commit message from the staged diff.
8. The user clicks `Copy`.
9. The user finishes the commit in their normal workflow.

## Success Criteria

The MVP is successful when:
- the user can launch the app from a repository with `gitroast`
- the app detects repository state correctly
- the app blocks generation when no staged diff exists
- the app generates one usable commit message from staged changes
- the user can copy the message in one click

Secondary signs of success:
- startup feels immediate enough that the app fits into normal dev flow
- the user does not need to browse for files or configure project context manually
- the generated message is playful but still clear enough to use

## Functional Business Requirements

- The product must use the current working directory as the repository launch context.
- The product must verify that the launch directory belongs to a Git repository.
- The product must read staged Git changes only.
- The product must use one AI provider for MVP: Google AI Studio with `gemini-2.5-flash`.
- The product must let the user securely save their API key locally.
- The product must return one generated commit message at a time.
- The product must provide a copy action as the final in-app step.

## Non-Functional Business Constraints

- The app must feel local-first even though generation depends on an AI API call.
- API key handling must be secure and must not rely on plain-text repo files.
- Setup friction must stay low: one provider, one key, one launch flow.
- Perceived startup must be fast enough that the tool feels lighter than opening a larger Git UI.

## Explicitly Out of Scope

The following are not part of MVP:
- auto-commit from the app
- multi-provider support
- folder picker or drag-and-drop repo selection
- licensing and billing
- premium personas or tone packs
- cloud sync
- GitHub or GitLab integration
- collaboration features
- analytics dashboards

## Risks and Business Considerations

- BYOK lowers operating cost but adds onboarding friction.
- Humorous output is differentiated, but it must remain useful as a real commit message.
- If generation feels slow, the product may not fit naturally into terminal-driven workflows.
- If repo detection is unreliable, the narrow value proposition breaks immediately.

## MVP Exit Criteria

The MVP is ready for implementation when the team agrees on:
- CLI-only launch from the current repository
- Gemini 2.5 Flash as the only provider/model
- secure local API key storage
- copy-only completion flow with no in-app commit execution

The MVP is ready for early validation when the app can complete the full loop:
- launch
- detect repo
- confirm staged changes
- generate one message
- copy the result
