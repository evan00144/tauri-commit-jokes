import { useEffect, useState } from "react";
import "../App.css";
import { GeneratorPanel } from "../features/generator/GeneratorPanel";
import { RepoSummary } from "../features/repo-status/RepoSummary";
import { copyText } from "../lib/clipboard";
import {
  generateCommitMessage,
  getApiKeyStatus,
  getRepoStatus,
  initContext,
} from "../lib/tauri";
import type {
  ApiKeyStatusResult,
  GenerateCommitMessageResult,
  RepoContextResult,
  RepoStatusResult,
  ViewState,
} from "../types/contracts";

function describeError(errorCode: string | null): string {
  switch (errorCode) {
    case "git_unavailable":
      return "Git is unavailable on this machine. Install Git or fix your PATH, then relaunch GitRoast from a repository.";
    case "not_a_repo":
      return "This launch path is not inside a Git repository. Run gitroast from a project folder instead.";
    case "no_staged_changes":
      return "There are no staged changes yet. Run git add first, then generate again.";
    case "missing_api_key":
      return "Add GEMINI_API_KEY or GOOGLE_API_KEY to the project .env before generation is allowed.";
    case "invalid_api_key":
      return "The saved Gemini API key was rejected. Replace it and try again.";
    case "diff_too_large":
      return "The staged diff is larger than the MVP limit of 250 KB.";
    case "provider_timeout":
      return "Gemini timed out before responding. Retry once your connection is stable.";
    case "provider_error":
      return "Gemini returned an unexpected error. Retry or check the provider status.";
    default:
      return "GitRoast hit an unexpected error. Retry the action or relaunch the app.";
  }
}

export default function App() {
  const [viewState, setViewState] = useState<ViewState>("invalid_launch_context");
  const [booting, setBooting] = useState(true);
  const [refreshingRepo, setRefreshingRepo] = useState(false);
  const [generationNonce, setGenerationNonce] = useState(0);
  const [copyState, setCopyState] = useState<"idle" | "copied" | "error">("idle");
  const [repoContext, setRepoContext] = useState<RepoContextResult | null>(null);
  const [repoStatus, setRepoStatus] = useState<RepoStatusResult | null>(null);
  const [apiKeyStatus, setApiKeyStatus] = useState<ApiKeyStatusResult | null>(null);
  const [generation, setGeneration] = useState<GenerateCommitMessageResult | null>(null);
  const [inlineError, setInlineError] = useState<string | null>(null);

  useEffect(() => {
    let cancelled = false;

    async function bootstrap() {
      setBooting(true);
      setInlineError(null);
      setCopyState("idle");

      const cwd = window.__GITROAST_CWD__ ?? "";
      const context = await initContext(cwd);

      if (cancelled) {
        return;
      }

      setRepoContext(context);

      if (!context.gitAvailable || !context.isRepo || !context.repoRoot) {
        setViewState("invalid_launch_context");
        setRepoStatus(null);
        setBooting(false);
        return;
      }

      const keyStatus = await getApiKeyStatus();

      if (cancelled) {
        return;
      }

      setApiKeyStatus(keyStatus);

      if (!keyStatus.keyPresent || keyStatus.keyStatus === "missing") {
        setViewState("missing_api_key");
        setRepoStatus(null);
        setBooting(false);
        return;
      }

      const status = await getRepoStatus(context.repoRoot);

      if (cancelled) {
        return;
      }

      setRepoStatus(status);

      if (!status.hasStagedChanges || status.errorCode === "no_staged_changes") {
        setViewState("no_staged_changes");
      } else {
        setViewState("ready_to_generate");
      }

      setBooting(false);
    }

    bootstrap();

    return () => {
      cancelled = true;
    };
  }, []);

  async function refreshRepoState({
    preserveViewState = false,
    silent = false,
  }: {
    preserveViewState?: boolean;
    silent?: boolean;
  } = {}) {
    if (!repoContext?.repoRoot) {
      return;
    }

    if (!silent) {
      setRefreshingRepo(true);
    }

    try {
      const status = await getRepoStatus(repoContext.repoRoot);
      setRepoStatus(status);

      setViewState((current) => {
        if (!status.hasStagedChanges || status.errorCode === "no_staged_changes") {
          return "no_staged_changes";
        }

        if (
          preserveViewState &&
          (current === "generation_success" || current === "generation_error")
        ) {
          return current;
        }

        return "ready_to_generate";
      });
    } finally {
      if (!silent) {
        setRefreshingRepo(false);
      }
    }
  }

  useEffect(() => {
    if (!repoContext?.repoRoot || !apiKeyStatus?.keyPresent) {
      return;
    }

    const syncRepoState = () => {
      void refreshRepoState({ preserveViewState: true, silent: true });
    };

    const intervalId = window.setInterval(syncRepoState, 5000);
    window.addEventListener("focus", syncRepoState);

    const handleVisibilityChange = () => {
      if (!document.hidden) {
        syncRepoState();
      }
    };

    document.addEventListener("visibilitychange", handleVisibilityChange);

    return () => {
      window.clearInterval(intervalId);
      window.removeEventListener("focus", syncRepoState);
      document.removeEventListener("visibilitychange", handleVisibilityChange);
    };
  }, [repoContext?.repoRoot, apiKeyStatus?.keyPresent]);

  async function handleGenerate() {
    if (!repoContext?.repoRoot) {
      return;
    }

    const nextNonce = generationNonce + 1;
    setGenerationNonce(nextNonce);
    setInlineError(null);
    setCopyState("idle");
    setViewState("generating");

    const result = await generateCommitMessage(repoContext.repoRoot, nextNonce);
    setGeneration(result);

    if (result.success && result.message) {
      const nextKeyStatus = await getApiKeyStatus();
      setApiKeyStatus(nextKeyStatus);
      await refreshRepoState({ preserveViewState: true });
      setViewState("generation_success");
      return;
    }

    const nextKeyStatus = await getApiKeyStatus();
    setApiKeyStatus(nextKeyStatus);
    setInlineError(describeError(result.errorCode));
    setViewState("generation_error");
  }

  async function handleCopy() {
    if (!generation?.message) {
      return;
    }

    const copied = await copyText(generation.message);
    setCopyState(copied ? "copied" : "error");
  }

  const generationError = generation && !generation.success ? describeError(generation.errorCode) : inlineError;

  return (
    <main className="app-shell">
      <div className="app-frame">
        <section className="hero">
          <div className="eyebrow">GitRoast MVP</div>
          <h1>Read the staged diff. Roast the commit. Keep moving.</h1>
          <p>
            GitRoast opens in your current repository, checks staged changes,
            sends them to Gemini 2.5 Flash, and gives you one commit message
            worth copying.
          </p>
        </section>

        <div className="grid">
          <RepoSummary
            repoContext={repoContext}
            repoStatus={repoStatus}
            booting={booting}
            viewState={viewState}
            refreshingRepo={refreshingRepo}
            onRefresh={() => refreshRepoState({ preserveViewState: true })}
          />

          <GeneratorPanel
            viewState={viewState}
            repoStatus={repoStatus}
            generation={generation}
            copyState={copyState}
            booting={booting}
            inlineError={generationError}
            onGenerate={handleGenerate}
            onCopy={handleCopy}
          />
        </div>
      </div>
    </main>
  );
}
