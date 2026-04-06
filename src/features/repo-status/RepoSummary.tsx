import { Panel } from "../../components/Panel";
import { StatusPill } from "../../components/StatusPill";
import type {
  ApiKeyStatusResult,
  RepoContextResult,
  RepoStatusResult,
  ViewState,
} from "../../types/contracts";

type RepoSummaryProps = {
  repoContext: RepoContextResult | null;
  repoStatus: RepoStatusResult | null;
  apiKeyStatus: ApiKeyStatusResult | null;
  booting: boolean;
  viewState: ViewState;
  refreshingRepo: boolean;
  launchPath: string;
  onChooseRepo: () => Promise<void>;
  onRefresh: () => Promise<void>;
};

function getContextTone(viewState: ViewState) {
  if (viewState === "invalid_launch_context") {
    return "danger" as const;
  }

  if (viewState === "no_staged_changes") {
    return "warning" as const;
  }

  return "success" as const;
}

function contextLabel(viewState: ViewState) {
  if (viewState === "invalid_launch_context") {
    return "Launch blocked";
  }

  if (viewState === "no_staged_changes") {
    return "Waiting on staged diff";
  }

  return "Repo ready";
}

function formatKilobytes(bytes: number | null | undefined) {
  if (!bytes) {
    return "0 KB";
  }

  return `${(bytes / 1024).toFixed(1)} KB`;
}

export function RepoSummary({
  repoContext,
  repoStatus,
  apiKeyStatus,
  booting,
  viewState,
  refreshingRepo,
  launchPath,
  onChooseRepo,
  onRefresh,
}: RepoSummaryProps) {
  const repoName = repoContext?.repoName ?? "Unknown repo";
  const repoRoot = repoContext?.repoRoot ?? "No repository detected";
  const tone = getContextTone(viewState);
  const activeModel = apiKeyStatus?.modelName ?? "gemini-2.5-flash";
  const supportedModels = apiKeyStatus?.supportedModels ?? [
    "gemini-3.1-pro",
    "gemini-3-flash",
    "gemini-3.1-flash-lite",
    "gemini-2.5-pro",
    "gemini-2.5-flash",
    "gemini-2.5-flash-lite",
    "gemini-flash-latest",
  ];
  const modelSource = apiKeyStatus?.modelSource ?? "default";

  return (
    <Panel
      title="Repository Context"
      subtitle="GitRoast reads staged Git changes from the selected repo root or the directory that launched the app."
      aside={
        <div className="panel-actions">
          <StatusPill tone={tone}>{contextLabel(viewState)}</StatusPill>
          <button
            className="button-ghost"
            type="button"
            disabled={booting || refreshingRepo}
            onClick={() => {
              void onChooseRepo();
            }}
          >
            Choose repo
          </button>
          <button
            className="button-ghost"
            type="button"
            disabled={booting || refreshingRepo}
            onClick={() => {
              void onRefresh();
            }}
          >
            {refreshingRepo ? "Refreshing..." : "Refresh"}
          </button>
        </div>
      }
    >
      {booting ? (
        <div className="boot-note">Checking launch context and staged changes...</div>
      ) : null}

      <div className="fact-list">
        <div className="fact-row">
          <span className="fact-label">Launch path</span>
          <span className="fact-value">{launchPath || "Not set"}</span>
        </div>
        <div className="fact-row">
          <span className="fact-label">Repository</span>
          <span className="fact-value">{repoName}</span>
        </div>
        <div className="fact-row">
          <span className="fact-label">Root</span>
          <span className="fact-value">{repoRoot}</span>
        </div>
        <div className="fact-row">
          <span className="fact-label">Git available</span>
          <span className="fact-value">
            {repoContext?.gitAvailable ? "Yes" : "No"}
          </span>
        </div>
        <div className="fact-row">
          <span className="fact-label">Staged files</span>
          <span className="fact-value">{repoStatus?.stagedFileCount ?? 0}</span>
        </div>
        <div className="fact-row">
          <span className="fact-label">Diff size</span>
          <span className="fact-value">
            {formatKilobytes(repoStatus?.diffByteSize)}
          </span>
        </div>
        <div className="fact-row">
          <span className="fact-label">Active model</span>
          <span className="fact-value">{activeModel}</span>
        </div>
        <div className="fact-row">
          <span className="fact-label">Model source</span>
          <span className="fact-value">{modelSource}</span>
        </div>
        <div className="fact-row">
          <span className="fact-label">Model storage</span>
          <span className="fact-value">GitRoast app config</span>
        </div>
        <div className="fact-row">
          <span className="fact-label">Preset models</span>
          <span className="fact-value">{supportedModels.join(", ")}</span>
        </div>
      </div>

      {apiKeyStatus?.modelWarning ? (
        <p className="error-copy">{apiKeyStatus.modelWarning}</p>
      ) : null}
    </Panel>
  );
}
