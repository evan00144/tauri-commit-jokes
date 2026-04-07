import { Panel } from "../../components/Panel";
import { StatusPill } from "../../components/StatusPill";
import type {
  GenerateCommitMessageResult,
  RepoStatusResult,
  ViewState,
} from "../../types/contracts";

type GeneratorPanelProps = {
  viewState: ViewState;
  repoStatus: RepoStatusResult | null;
  generation: GenerateCommitMessageResult | null;
  copyState: "idle" | "copied" | "error";
  booting: boolean;
  inlineError: string | null;
  onGenerate: () => Promise<void>;
  onCopy: () => Promise<void>;
};

function renderStateCopy(viewState: ViewState) {
  switch (viewState) {
    case "invalid_launch_context":
      return "Choose a valid Git repository before asking GitRoast for a commit line.";
    case "no_staged_changes":
      return "Stage the files you want in this commit, then generate from that exact diff.";
    case "ready_to_generate":
      return "Everything is ready from your staged diff.";
    case "generating":
      return "GitRoast is generating one commit line from the staged diff you selected.";
    case "generation_success":
      return "Your commit line is ready to review and copy.";
    case "generation_error":
      return "Generation failed. Review the note below and try again.";
    default:
      return "GitRoast is checking the selected repository.";
  }
}

function renderStatusLabel(viewState: ViewState) {
  switch (viewState) {
    case "invalid_launch_context":
      return "Pick a repo";
    case "no_staged_changes":
      return "Stage changes";
    case "ready_to_generate":
      return "Ready";
    case "generating":
      return "Generating";
    case "generation_success":
      return "Ready to copy";
    case "generation_error":
      return "Try again";
    default:
      return "Checking";
  }
}

export function GeneratorPanel({
  viewState,
  repoStatus,
  generation,
  copyState,
  booting,
  inlineError,
  onGenerate,
  onCopy,
}: GeneratorPanelProps) {
  const canGenerate =
    !booting &&
    (viewState === "ready_to_generate" ||
      viewState === "generation_success" ||
      viewState === "generation_error");

  const copyLabel =
    copyState === "copied"
      ? "Copied"
      : copyState === "error"
        ? "Copy failed"
        : "Copy commit line";
  const primaryLabel =
    viewState === "generating"
      ? "Generating commit line..."
      : generation?.success
        ? "Generate again"
        : "Generate commit line";

  return (
    <Panel
      title="Commit Line"
      subtitle={renderStateCopy(viewState)}
      aside={
        <StatusPill
          tone={
            viewState === "generation_error"
              ? "danger"
              : viewState === "generation_success"
                ? "success"
                : "warning"
          }
        >
          {renderStatusLabel(viewState)}
        </StatusPill>
      }
    >
      <div className="message-box">
        {generation?.success && generation.message ? (
          <div className="generated-result">
            <pre>{generation.message}</pre>
            <p className="muted">
              Review it, copy it, then finish the commit in your normal workflow.
            </p>
            {generation.analysis ? <p className="muted">{generation.analysis}</p> : null}
          </div>
        ) : (
          <div className="empty-state">
            <p className="empty-state-kicker">No commit line yet</p>
            <p className="muted">
              {repoStatus?.hasStagedChanges
                ? "Your next commit line will appear here once you generate from the current staged diff."
                : "Stage the files you want in this commit. GitRoast only uses the staged diff you prepare."}
            </p>
          </div>
        )}

        {inlineError ? <p className="error-copy">{inlineError}</p> : null}
      </div>

      <div className="cta-row">
        <button
          className="button-primary"
          type="button"
          disabled={!canGenerate}
          onClick={onGenerate}
        >
          {primaryLabel}
        </button>

        <button
          className="button-secondary"
          type="button"
          disabled={!generation?.success || !generation.message}
          onClick={onCopy}
        >
          {copyLabel}
        </button>
      </div>
    </Panel>
  );
}
