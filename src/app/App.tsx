import { useEffect, useState } from "react";
import "../App.css";
import { ReleasePicker } from "../features/downloads/ReleasePicker";
import { ApiKeyForm } from "../features/onboarding/ApiKeyForm";
import { GeneratorPanel } from "../features/generator/GeneratorPanel";
import { RepoSummary } from "../features/repo-status/RepoSummary";
import { copyText } from "../lib/clipboard";
import {
  chooseRepoRoot,
  generateCommitMessage,
  getApiKeyStatus,
  getRepoStatus,
  initContext,
  openExternal,
  setModelPreference,
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
      return "Add a Gemini API key to `.env.local`, `.env`, or shell env before generation is allowed.";
    case "invalid_api_key":
      return "The Gemini API key from your env was rejected. Replace it and try again.";
    case "quota_exhausted":
      return "The selected Gemini model is hitting quota limits for this project. Pick a lighter Gemini model in the app settings or wait for quota to reset.";
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
  const [switchingRepo, setSwitchingRepo] = useState(false);
  const [savingModel, setSavingModel] = useState(false);
  const [generationNonce, setGenerationNonce] = useState(0);
  const [copyState, setCopyState] = useState<"idle" | "copied" | "error">("idle");
  const [launchPath, setLaunchPath] = useState(window.__GITROAST_CWD__ ?? "");
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

  async function syncAppState(nextLaunchPath: string) {
    setBooting(true);
    setInlineError(null);
    setCopyState("idle");
    setGeneration(null);

    const context = await initContext(nextLaunchPath);
    setRepoContext(context);

    if (!context.gitAvailable || !context.isRepo || !context.repoRoot) {
      setRepoStatus(null);
      setApiKeyStatus(null);
      setViewState("invalid_launch_context");
      setBooting(false);
      return;
    }

    const keyStatus = await getApiKeyStatus(nextLaunchPath);
    setApiKeyStatus(keyStatus);

    const status = await getRepoStatus(context.repoRoot);
    setRepoStatus(status);
    setViewState(resolveViewState(keyStatus, status));
    setBooting(false);
  }

  useEffect(() => {
    async function bootstrap() {
      await syncAppState(launchPath);
    }

    void bootstrap();
  }, [launchPath]);

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
    window.addEventListener("focus", syncRepoState);

    const handleVisibilityChange = () => {
      if (!document.hidden) {
        syncRepoState();
      }
    };

    document.addEventListener("visibilitychange", handleVisibilityChange);

    return () => {
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
      const nextKeyStatus = await getApiKeyStatus(launchPath);
      setApiKeyStatus(nextKeyStatus);
      await refreshRepoState({ preserveViewState: true });
      setViewState("generation_success");
      return;
    }

    const nextKeyStatus = await getApiKeyStatus(launchPath);
    setApiKeyStatus(nextKeyStatus);
    setInlineError(describeError(result.errorCode));
    setViewState("generation_error");
  }

  async function handleChooseRepo() {
    setSwitchingRepo(true);
    setInlineError(null);

    try {
      const nextPath = await chooseRepoRoot();
      if (!nextPath) {
        return;
      }

      setLaunchPath(nextPath);
    } finally {
      setSwitchingRepo(false);
    }
  }

  async function handleCopy() {
    if (!generation?.message) {
      return;
    }

    const copied = await copyText(generation.message);
    setCopyState(copied ? "copied" : "error");
  }

  async function handleSaveModel(modelName: string) {
    setSavingModel(true);
    setInlineError(null);

    try {
      const nextKeyStatus = await setModelPreference(launchPath, modelName);
      setApiKeyStatus(nextKeyStatus);
      setViewState((current) => resolveViewState(nextKeyStatus, repoStatus, current));
    } finally {
      setSavingModel(false);
    }
  }

  async function handleOpenExternal(url: string) {
    try {
      await openExternal(url);
    } catch {
      setInlineError("GitRoast could not open the external link in your browser.");
    }
  }

  const generationError = generation && !generation.success ? describeError(generation.errorCode) : inlineError;
  const activeModel = apiKeyStatus?.modelName ?? "gemini-2.5-flash";
  const tutorialSteps = [
    {
      step: "01",
      title: "Stage the mess",
      body: "Run `git add` in the repo you actually want to roast. GitRoast only reads staged changes.",
    },
    {
      step: "02",
      title: "Point GitRoast at the repo",
      body: "Launch from that folder or use `Choose repo root` if you want to switch projects mid-session.",
    },
    {
      step: "03",
      title: "Generate and copy",
      body: "Pick a Gemini model, click `Generate`, then copy the least embarrassing joke into your normal commit flow.",
    },
  ];

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
          <div className="hero-actions hero-actions-primary">
            <button
              className="button-ghost"
              type="button"
              onClick={() => {
                void handleChooseRepo();
              }}
              disabled={booting || switchingRepo}
            >
              {switchingRepo ? "Opening picker..." : "Choose repo root"}
            </button>
          </div>
          <div className="hero-cta-grid">
            <button
              className="promo-card promo-card-source link-button"
              type="button"
              onClick={() => {
                void handleOpenExternal("https://github.com/evan00144/tauri-commit-jokes");
              }}
            >
              <span className="promo-icon" aria-hidden="true">
                {"</>"}
              </span>
              <span className="promo-copy">
                <strong>View source</strong>
                <span>
                  Audit the code, open issues, and see exactly how GitRoast reads your staged diff.
                </span>
              </span>
              <span className="promo-kicker">Open GitHub</span>
            </button>
            <button
              className="promo-card promo-card-drink link-button"
              type="button"
              onClick={() => {
                void handleOpenExternal("https://trakteer.id/evan_0014");
              }}
            >
              <span className="promo-icon" aria-hidden="true">
                +$
              </span>
              <span className="promo-copy">
                <strong>Buy me a drink</strong>
                <span>
                  If the app saved you from writing another dead-eyed commit summary, fund the next round of improvements.
                </span>
              </span>
              <span className="promo-kicker">Support GitRoast</span>
            </button>
          </div>
        </section>

        <section className="panel tutorial-panel">
          <div className="panel-header tutorial-header">
            <div>
              <h2 className="panel-title">How GitRoast Works</h2>
              <p className="panel-subtitle">
                One fast loop. No hidden Git magic. No auto-commit.
              </p>
            </div>
            <div className="tutorial-badge">3-step setup</div>
          </div>
          <div className="tutorial-grid">
            {tutorialSteps.map((item) => (
              <article className="tutorial-card" key={item.step}>
                <div className="tutorial-step">{item.step}</div>
                <h3>{item.title}</h3>
                <p>{item.body}</p>
              </article>
            ))}
          </div>
        </section>

        <ReleasePicker onOpenExternal={handleOpenExternal} />

        <div className="grid">
          <div className="stack">
            <RepoSummary
              repoContext={repoContext}
              repoStatus={repoStatus}
              apiKeyStatus={apiKeyStatus}
              booting={booting}
              viewState={viewState}
              refreshingRepo={refreshingRepo || switchingRepo}
              launchPath={launchPath}
              onChooseRepo={handleChooseRepo}
              onRefresh={() => refreshRepoState({ preserveViewState: true })}
            />
            <ApiKeyForm
              viewState={viewState}
              apiKeyStatus={apiKeyStatus}
              savingModel={savingModel}
              inlineError={viewState === "missing_api_key" ? generationError : null}
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
