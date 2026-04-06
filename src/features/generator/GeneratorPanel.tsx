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
    case "missing_api_key":
      return "Add your Gemini API key to `.env.local`, `.env`, or shell env to unlock generation.";
    case "invalid_launch_context":
      return "Launch GitRoast from a repository so it can read the staged diff.";
    case "no_staged_changes":
      return "Stage files first, then come back for the roast.";
    case "ready_to_generate":
      return "Everything is ready. Generate one commit message from the staged diff.";
    case "generating":
      return "Gemini is chewing through the diff and looking for material.";
    case "generation_success":
      return "One commit message, ready to copy.";
    case "generation_error":
      return "Generation failed. Fix the issue below and try again.";
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
      subtitle={`${renderStateCopy(viewState)} Using ${activeModel}.`}
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
          <pre>{generation.message}</pre>
        ) : (
          <p className="muted">
            {repoStatus?.hasStagedChanges
              ? "No message generated yet."
              : "Waiting for a valid staged diff."}
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
