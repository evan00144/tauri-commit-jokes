import { Panel } from "../../components/Panel";
import { StatusPill } from "../../components/StatusPill";
import type {
  RepoContextResult,
  RepoStatusResult,
  ViewState,
} from "../../types/contracts";

type RepoSummaryProps = {
  repoContext: RepoContextResult | null;
  repoStatus: RepoStatusResult | null;
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

function renderGuidance(viewState: ViewState) {
  switch (viewState) {
    case "invalid_launch_context":
      return "Choose a Git repository to continue. GitRoast only works against real repositories.";
    case "no_staged_changes":
      return "Stage the changes for this commit first. GitRoast only reads the staged diff you prepare.";
    case "ready_to_generate":
      return "Looks good. Generate one commit line whenever you are ready.";
    case "generating":
      return "GitRoast is using the current staged diff to prepare one commit line.";
    case "generation_success":
      return "The current staged diff already has a generated commit line ready to copy.";
    case "generation_error":
      return "The staged diff is still intact. You can retry generation after reviewing the error.";
    default:
      return "GitRoast is checking the selected repository.";
  }
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
  refreshingRepo,
  launchPath,
  onChooseRepo,
  onRefresh,
}: RepoSummaryProps) {
  const repoName = repoContext?.repoName ?? "Unknown repo";
  const tone = getContextTone(viewState);
  const stagedFilesLabel = `${repoStatus?.stagedFileCount ?? 0} staged files`;

  return (
    <Panel
      title="Selected Repo"
      subtitle="Choose the repo, confirm the staged diff, then generate one commit line."
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

      <div className="readiness-list">
        <div className="readiness-row">
          <span className="readiness-label">Repository</span>
          <strong>{repoContext?.isRepo ? repoName : "No repository selected"}</strong>
        </div>
        <div className="readiness-row">
          <span className="readiness-label">Staged changes</span>
          <strong>{stagedFilesLabel}</strong>
        </div>
        <div className="readiness-row">
          <span className="readiness-label">Diff size</span>
          <strong>{formatKilobytes(repoStatus?.diffByteSize)}</strong>
        </div>
      </div>

      <p className="repo-note">{renderGuidance(viewState)}</p>
      {repoContext?.isRepo ? (
        <p className="repo-caption">Working from {launchPath || repoName}</p>
      ) : null}
    </Panel>
  );
}
