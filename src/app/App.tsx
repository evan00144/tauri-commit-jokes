import { useEffect, useState } from "react";
import "../App.css";
import { StatusPill } from "../components/StatusPill";
// import { ReleasePicker } from "../features/downloads/ReleasePicker";
import { GeneratorPanel } from "../features/generator/GeneratorPanel";
import { ServicePanel } from "../features/onboarding/ApiKeyForm";
import { RepoSummary } from "../features/repo-status/RepoSummary";
import { copyText } from "../lib/clipboard";
import {
  chooseRepoRoot,
  generateCommitMessage,
  getRepoStatus,
  getServiceStatus,
  initContext,
  openExternal,
} from "../lib/tauri";
import type {
  GenerateCommitMessageResult,
  RepoContextResult,
  RepoStatusResult,
  ServiceStatusResult,
  ViewState,
} from "../types/contracts";

function describeError(errorCode: string | null): string {
  switch (errorCode) {
    case "git_unavailable":
      return "Git is unavailable on this machine. Install Git or fix your PATH, then relaunch GitRoast from a repository.";
    case "not_a_repo":
      return "This launch path is not inside a Git repository. Run GitRoast from a project folder instead.";
    case "no_staged_changes":
      return "There are no staged changes yet. Run git add first, then generate again.";
    case "quota_exhausted":
      return "The hosted commit-joke API is rate limited right now. Retry once the upstream quota cools down.";
    case "diff_too_large":
      return "The staged diff is larger than the current 250 KB limit.";
    case "provider_timeout":
      return "The hosted commit-joke API timed out before responding. Retry once your connection is stable.";
    case "provider_error":
      return "The hosted commit-joke API returned an unexpected error. Retry or check the backend status.";
    default:
      return "GitRoast hit an unexpected error. Retry the action or relaunch the app.";
  }
}

export default function App() {
  const [viewState, setViewState] = useState<ViewState>("invalid_launch_context");
  const [booting, setBooting] = useState(true);
  const [refreshingRepo, setRefreshingRepo] = useState(false);
  const [refreshingService, setRefreshingService] = useState(false);
  const [switchingRepo, setSwitchingRepo] = useState(false);
  const [copyState, setCopyState] = useState<"idle" | "copied" | "error">("idle");
  const [launchPath, setLaunchPath] = useState(window.__GITROAST_CWD__ ?? "");
  const [repoContext, setRepoContext] = useState<RepoContextResult | null>(null);
  const [repoStatus, setRepoStatus] = useState<RepoStatusResult | null>(null);
  const [serviceStatus, setServiceStatus] = useState<ServiceStatusResult | null>(null);
  const [generation, setGeneration] = useState<GenerateCommitMessageResult | null>(null);
  const [inlineError, setInlineError] = useState<string | null>(null);

  function resolveViewState(
    status: RepoStatusResult | null,
    previousState?: ViewState,
  ): ViewState {
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
      setServiceStatus(null);
      setViewState("invalid_launch_context");
      setBooting(false);
      return;
    }

    const [nextServiceStatus, status] = await Promise.all([
      getServiceStatus(),
      getRepoStatus(context.repoRoot),
    ]);

    setServiceStatus(nextServiceStatus);
    setRepoStatus(status);
    setViewState(resolveViewState(status));
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
        resolveViewState(status, preserveViewState ? current : undefined),
      );
    } finally {
      if (!silent) {
        setRefreshingRepo(false);
      }
    }
  }

  async function refreshServiceState({ silent = false }: { silent?: boolean } = {}) {
    if (!silent) {
      setRefreshingService(true);
    }

    try {
      const nextServiceStatus = await getServiceStatus();
      setServiceStatus(nextServiceStatus);
    } finally {
      if (!silent) {
        setRefreshingService(false);
      }
    }
  }

  useEffect(() => {
    if (!repoContext?.repoRoot) {
      return;
    }

    const syncVisibleState = () => {
      void refreshRepoState({ preserveViewState: true, silent: true });
      void refreshServiceState({ silent: true });
    };

    window.addEventListener("focus", syncVisibleState);

    const handleVisibilityChange = () => {
      if (!document.hidden) {
        syncVisibleState();
      }
    };

    document.addEventListener("visibilitychange", handleVisibilityChange);

    return () => {
      window.removeEventListener("focus", syncVisibleState);
      document.removeEventListener("visibilitychange", handleVisibilityChange);
    };
  }, [repoContext?.repoRoot]);

  async function handleGenerate() {
    if (!repoContext?.repoRoot) {
      return;
    }

    setInlineError(null);
    setCopyState("idle");
    setViewState("generating");

    const result = await generateCommitMessage(repoContext.repoRoot);
    setGeneration(result);

    if (result.success && result.message) {
      await Promise.all([
        refreshRepoState({ preserveViewState: true }),
        refreshServiceState({ silent: true }),
      ]);
      setViewState("generation_success");
      return;
    }

    await refreshServiceState({ silent: true });
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

  async function handleOpenExternal(url: string) {
    try {
      await openExternal(url);
    } catch {
      setInlineError("GitRoast could not open the external link in your browser.");
    }
  }

  const generationError =
    generation && !generation.success ? describeError(generation.errorCode) : inlineError;
  const workflowSteps = [
    {
      step: "01",
      title: "Choose the repo",
      body: "Point GitRoast at the project you want and switch targets anytime from the picker.",
    },
    {
      step: "02",
      title: "Stage the exact changes",
      body: "GitRoast reads only the staged diff you prepare for this commit.",
    },
    {
      step: "03",
      title: "Generate and copy",
      body: "Request one commit line, copy it, and finish the commit in your normal workflow.",
    },
  ];
  const trustBullets = [
    "Works locally on your selected repository",
    "Sends staged diff text only when you click Generate",
    "No local API key required",
  ];
  const productStatus = serviceStatus?.ok ? "Service online" : "Service degraded";
  const repoStatusLabel = !repoContext?.repoRoot
    ? "Choose a repo"
    : repoStatus?.hasStagedChanges
      ? "Staged diff ready"
      : "Stage changes to continue";

  return (
    <main className="app-shell">
      <div className="app-frame">
        <section className="hero">
          <div className="hero-topline">
            <div className="eyebrow">GitRoast Desktop</div>
            <div className="hero-status-strip">
              <StatusPill tone={serviceStatus?.ok ? "success" : "warning"}>
                {productStatus}
              </StatusPill>
              <StatusPill tone={repoStatus?.hasStagedChanges ? "success" : "warning"}>
                {repoStatusLabel}
              </StatusPill>
            </div>
          </div>

          <div className="hero-layout">
            <div className="hero-copy-block">
              <h1>Generate a clean commit line from the changes you already staged.</h1>
              <p>
                GitRoast works locally on your selected repo, sends the staged diff only when you
                click Generate, and returns one commit line ready to copy.
              </p>
              <div className="hero-trust-list">
                {trustBullets.map((item) => (
                  <span className="trust-chip" key={item}>
                    {item}
                  </span>
                ))}
              </div>
              <div className="hero-actions hero-actions-primary">
                <button
                  className="button-primary"
                  type="button"
                  onClick={() => {
                    void handleChooseRepo();
                  }}
                  disabled={booting || switchingRepo}
                >
                  {switchingRepo ? "Opening picker..." : "Choose repo root"}
                </button>
              </div>
            </div>

            <aside className="hero-overview-card">
              <div className="overview-header">
                <span className="overview-kicker">What happens here</span>
                <span className="overview-model">Three quick steps</span>
              </div>
              <div className="overview-grid">
                {workflowSteps.map((item) => (
                  <div className="overview-row" key={item.step}>
                    <span className="overview-label">{item.step}</span>
                    <strong>{item.title}</strong>
                  </div>
                ))}
              </div>
              <p className="overview-note">
                GitRoast never auto-commits, edits files, or writes to your repository.
              </p>
            </aside>
          </div>

          <div className="support-strip">
            <div className="support-copy">
              <span className="support-kicker">Optional support</span>
              <strong>Donations help cover the hosted generation service and desktop releases.</strong>
              <p className="support-note">
                If GitRoast earns a place in your workflow, support keeps the app simple and
                key-free.
              </p>
            </div>
            <button
              className="button-ghost support-button"
              type="button"
              onClick={() => {
                void handleOpenExternal("https://trakteer.id/evan_0014");
              }}
            >
              Support GitRoast
            </button>
          </div>
        </section>

        <section className="panel workflow-panel">
          <div className="panel-header workflow-header">
            <div>
              <h2 className="panel-title">How It Works</h2>
              <p className="panel-subtitle">
                One staged diff in, one commit line out.
              </p>
            </div>
            <div className="tutorial-badge">From staged diff to copy</div>
          </div>
          <div className="workflow-grid">
            {workflowSteps.map((item) => (
              <article className="workflow-card" key={item.step}>
                <div className="tutorial-step">{item.step}</div>
                <h3>{item.title}</h3>
                <p>{item.body}</p>
              </article>
            ))}
          </div>

          <div className="trust-strip">
            <div className="trust-item">
              <span className="trust-label">Local first</span>
              <strong>GitRoast checks repo state locally before any hosted request is made.</strong>
            </div>
            <div className="trust-item">
              <span className="trust-label">You stay in control</span>
              <strong>GitRoast never auto-commits or edits your repository.</strong>
            </div>
          </div>
        </section>

        {/* <ReleasePicker onOpenExternal={handleOpenExternal} /> */}

        <div className="grid">
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

          <div className="stack">
            <RepoSummary
              repoContext={repoContext}
              repoStatus={repoStatus}
              booting={booting}
              viewState={viewState}
              refreshingRepo={refreshingRepo || switchingRepo}
              launchPath={launchPath}
              onChooseRepo={handleChooseRepo}
              onRefresh={() => refreshRepoState({ preserveViewState: true })}
            />
            <ServicePanel
              serviceStatus={serviceStatus}
              refreshingService={refreshingService}
              inlineError={generationError}
              onRefresh={refreshServiceState}
            />
          </div>
        </div>

        <p className="footer-note">
          GitRoast keeps repository checks local and only sends a hosted request when you ask for
          one.
        </p>
      </div>
    </main>
  );
}
