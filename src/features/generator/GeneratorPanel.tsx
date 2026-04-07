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
  activeModel: string;
  copyState: "idle" | "copied" | "error";
  booting: boolean;
  inlineError: string | null;
  onGenerate: () => Promise<void>;
  onCopy: () => Promise<void>;
};

function renderStateCopy(viewState: ViewState) {
  switch (viewState) {
    case "invalid_launch_context":
      return "Point GitRoast at a valid repository before requesting a generated commit message.";
    case "no_staged_changes":
      return "Stage files first, then generate from the exact diff you intend to commit.";
    case "ready_to_generate":
      return "Everything is ready. Generate one hosted commit suggestion from the staged diff.";
    case "generating":
      return "GitRoast is submitting the staged diff to the hosted service and waiting on one response.";
    case "generation_success":
      return "One generated commit message is ready to review and copy.";
    case "generation_error":
      return "Generation failed. Review the service state below and try again.";
    default:
      return "GitRoast is checking the current launch context.";
  }
}

export function GeneratorPanel({
  viewState,
  repoStatus,
  generation,
  activeModel,
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
    copyState === "copied" ? "Copied" : copyState === "error" ? "Copy failed" : "Copy";

  return (
    <Panel
      title="Commit Generator"
      subtitle={`${renderStateCopy(viewState)} Active backend model: ${activeModel}.`}
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
          {viewState.split("_").join(" ")}
        </StatusPill>
      }
    >
      <div className="message-box">
        {generation?.success && generation.message ? (
          <>
            <pre>{generation.message}</pre>
            {generation.analysis ? <p className="muted">{generation.analysis}</p> : null}
          </>
        ) : (
          <p className="muted">
            {repoStatus?.hasStagedChanges
              ? "No commit message has been generated for the current staged diff yet."
              : "Waiting for a valid staged diff before generation can start."}
          </p>
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
          {viewState === "generating" ? "Generating..." : "Generate"}
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
