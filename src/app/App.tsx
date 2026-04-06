import { useEffect, useState } from "react";
import "../App.css";
import { Panel } from "../components/Panel";
import { StatusPill } from "../components/StatusPill";
import { GeneratorPanel } from "../features/generator/GeneratorPanel";
import { ApiKeyForm } from "../features/onboarding/ApiKeyForm";
import { RepoSummary } from "../features/repo-status/RepoSummary";
import { copyText } from "../lib/clipboard";
import {
  generateCommitMessage,
  getApiKeyStatus,
  getRepoStatus,
  initContext,
  saveApiKey,
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
      return "Add a Gemini API key before generation is allowed.";
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

function keyStatusTone(status: ApiKeyStatusResult["keyStatus"]) {
  if (status === "valid") {
    return "success" as const;
  }

  if (status === "invalid") {
    return "danger" as const;
  }

  return "warning" as const;
}

export default function App() {
  const [viewState, setViewState] = useState<ViewState>("invalid_launch_context");
  const [booting, setBooting] = useState(true);
  const [submittingKey, setSubmittingKey] = useState(false);
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

  async function refreshRepoState() {
    if (!repoContext?.repoRoot) {
      return;
    }

    const status = await getRepoStatus(repoContext.repoRoot);
    setRepoStatus(status);

    if (!status.hasStagedChanges || status.errorCode === "no_staged_changes") {
      setViewState("no_staged_changes");
    } else {
      setViewState("ready_to_generate");
    }
  }

  async function handleSaveApiKey(apiKey: string) {
    setSubmittingKey(true);
    setInlineError(null);

    try {
      const result = await saveApiKey(apiKey);

      if (!result.success) {
        setInlineError("GitRoast could not save the API key to secure storage.");
        return;
      }

      const nextKeyStatus = await getApiKeyStatus();
      setApiKeyStatus(nextKeyStatus);
      await refreshRepoState();
    } finally {
      setSubmittingKey(false);
    }
  }

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
      const nextKeyStatus = await getApiKeyStatus();
      setApiKeyStatus(nextKeyStatus);
      await refreshRepoState();
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

  const statusTone = apiKeyStatus ? keyStatusTone(apiKeyStatus.keyStatus) : "warning";
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
          <div className="stack">
            <RepoSummary
              repoContext={repoContext}
              repoStatus={repoStatus}
              booting={booting}
              viewState={viewState}
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

          <div className="stack">
            <Panel
              title="Credential Status"
              subtitle="Gemini keys live in your OS credential store. GitRoast only keeps metadata locally."
              aside={
                apiKeyStatus ? (
                  <StatusPill tone={statusTone}>
                    {apiKeyStatus.keyStatus}
                  </StatusPill>
                ) : undefined
              }
            >
              <div className="detail-list">
                <div className="detail-row">
                  <span className="detail-label">Provider</span>
                  <span className="detail-value">
                    {apiKeyStatus?.providerName ?? "gemini"}
                  </span>
                </div>
                <div className="detail-row">
                  <span className="detail-label">Model</span>
                  <span className="detail-value">
                    {apiKeyStatus?.modelName ?? "gemini-2.5-flash"}
                  </span>
                </div>
                <div className="detail-row">
                  <span className="detail-label">Validated</span>
                  <span className="detail-value">
                    {apiKeyStatus?.lastValidatedAt ?? "Not yet"}
                  </span>
                </div>
              </div>
            </Panel>

            <ApiKeyForm
              submitting={submittingKey}
              viewState={viewState}
              apiKeyStatus={apiKeyStatus}
              inlineError={inlineError}
              onSave={handleSaveApiKey}
            />
          </div>
        </div>

        <footer className="footer-note">
          Launch GitRoast from a repository with <code>--cwd</code> so the app
          can stay scoped to your staged changes.
        </footer>
      </div>
    </main>
  );
}
