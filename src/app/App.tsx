import { useEffect, useState } from "react";
import "../App.css";
import { ApiKeyForm } from "../features/onboarding/ApiKeyForm";
import { GeneratorPanel } from "../features/generator/GeneratorPanel";
import { RepoSummary } from "../features/repo-status/RepoSummary";
import { copyText } from "../lib/clipboard";
import {
  generateCommitMessage,
  getApiKeyStatus,
  getRepoStatus,
  initContext,
  saveApiKey,
  saveModel,
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
      return "Save a Gemini API key in settings before generation is allowed.";
    case "invalid_api_key":
      return "The saved Gemini API key was rejected. Replace it and try again.";
    case "unsupported_model":
      return "That model is not supported by GitRoast. Pick one from the supported list.";
    case "quota_exhausted":
      return "The selected Gemini model is hitting quota limits for this project. Switch to gemini-2.5-flash or gemini-2.5-flash-lite, or wait for quota to reset.";
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
  const [savingApiKey, setSavingApiKey] = useState(false);
  const [savingModel, setSavingModel] = useState(false);
  const [repoContext, setRepoContext] = useState<RepoContextResult | null>(null);
  const [repoStatus, setRepoStatus] = useState<RepoStatusResult | null>(null);
  const [apiKeyStatus, setApiKeyStatus] = useState<ApiKeyStatusResult | null>(null);
  const [generation, setGeneration] = useState<GenerateCommitMessageResult | null>(null);
  const [inlineError, setInlineError] = useState<string | null>(null);

  function resolveViewState(
    keyStatus: ApiKeyStatusResult | null,
    status: RepoStatusResult | null,
    previousState?: ViewState,
  ): ViewState {
    if (!keyStatus?.keyPresent || keyStatus.keyStatus === "missing") {
      return "missing_api_key";
    }

    if (!status?.hasStagedChanges || status.errorCode === "no_staged_changes") {
      return "no_staged_changes";
    }

    if (
      previousState &&
      (previousState === "generation_success" || previousState === "generation_error")
    ) {
      return previousState;
    }

    return "ready_to_generate";
  }

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

      const status = await getRepoStatus(context.repoRoot);

      if (cancelled) {
        return;
      }

      setRepoStatus(status);
      setViewState(resolveViewState(keyStatus, status));

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
      setViewState((current) =>
        resolveViewState(apiKeyStatus, status, preserveViewState ? current : undefined),
      );
    } finally {
      if (!silent) {
        setRefreshingRepo(false);
      }
    }
  }

  useEffect(() => {
    if (!repoContext?.repoRoot) {
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

  async function handleSaveApiKey(apiKey: string) {
    setSavingApiKey(true);
    setInlineError(null);

    try {
      const result = await saveApiKey(apiKey.trim());
      if (!result.success) {
        setInlineError(describeError(result.errorCode));
        return;
      }

      const nextKeyStatus = await getApiKeyStatus();
      setApiKeyStatus(nextKeyStatus);

      if (repoContext?.repoRoot) {
        const status = await getRepoStatus(repoContext.repoRoot);
        setRepoStatus(status);
        setViewState(resolveViewState(nextKeyStatus, status));
      }
    } finally {
      setSavingApiKey(false);
    }
  }

  async function handleSaveModel(modelName: string) {
    setSavingModel(true);
    setInlineError(null);

    try {
      const result = await saveModel(modelName);
      if (!result.success) {
        setInlineError(describeError(result.errorCode));
        return;
      }

      const nextKeyStatus = await getApiKeyStatus();
      setApiKeyStatus(nextKeyStatus);
    } finally {
      setSavingModel(false);
    }
  }

  async function handleCopy() {
    if (!generation?.message) {
      return;
    }

    const copied = await copyText(generation.message);
    setCopyState(copied ? "copied" : "error");
  }

  const generationError = generation && !generation.success ? describeError(generation.errorCode) : inlineError;
  const activeModel = apiKeyStatus?.modelName ?? "gemini-2.5-flash";

  return (
    <main className="app-shell">
      <div className="app-frame">
        <section className="hero">
          <div className="eyebrow">GitRoast MVP</div>
          <h1>Read the staged diff. Roast the commit. Keep moving.</h1>
          <p>
            GitRoast opens in your current repository, checks staged changes,
            sends them to {activeModel}, and gives you one commit message
            worth copying.
          </p>
        </section>

        <div className="grid">
          <div className="stack">
            <RepoSummary
              repoContext={repoContext}
              repoStatus={repoStatus}
              apiKeyStatus={apiKeyStatus}
              booting={booting}
              viewState={viewState}
              refreshingRepo={refreshingRepo}
              onRefresh={() => refreshRepoState({ preserveViewState: true })}
            />
            <ApiKeyForm
              viewState={viewState}
              apiKeyStatus={apiKeyStatus}
              inlineError={viewState === "missing_api_key" ? generationError : null}
              savingApiKey={savingApiKey}
              savingModel={savingModel}
              onSaveApiKey={handleSaveApiKey}
              onSaveModel={handleSaveModel}
            />
          </div>

          <GeneratorPanel
            viewState={viewState}
            repoStatus={repoStatus}
            generation={generation}
            activeModel={activeModel}
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
