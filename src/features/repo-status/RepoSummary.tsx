import { Panel } from "../../components/Panel";
import { StatusPill } from "../../components/StatusPill";
import type { RepoContextResult, RepoStatusResult, ViewState } from "../../types/contracts";

type RepoSummaryProps = {
  repoContext: RepoContextResult | null;
  repoStatus: RepoStatusResult | null;
  booting: boolean;
  viewState: ViewState;
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
  booting,
  viewState,
}: RepoSummaryProps) {
  const repoName = repoContext?.repoName ?? "Unknown repo";
  const repoRoot = repoContext?.repoRoot ?? "No repository detected";
  const tone = getContextTone(viewState);

  return (
    <Panel
      title="Repository Context"
      subtitle="GitRoast only reads staged Git changes from the directory that launched the app."
      aside={<StatusPill tone={tone}>{contextLabel(viewState)}</StatusPill>}
    >
      {booting ? (
        <div className="boot-note">Checking launch context and staged changes...</div>
      ) : null}

      <div className="fact-list">
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
      </div>
    </Panel>
  );
}
