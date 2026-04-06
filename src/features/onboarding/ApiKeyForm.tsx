import { Panel } from "../../components/Panel";
import { StatusPill } from "../../components/StatusPill";
import type { ApiKeyStatusResult, ViewState } from "../../types/contracts";

type ApiKeyFormProps = {
  viewState: ViewState;
  apiKeyStatus: ApiKeyStatusResult | null;
  inlineError: string | null;
};

export function ApiKeyForm({
  viewState,
  apiKeyStatus,
  inlineError,
}: ApiKeyFormProps) {
  const needsAttention =
    viewState === "missing_api_key" || apiKeyStatus?.keyStatus === "invalid";

  const source = apiKeyStatus?.keySource;

  return (
    <Panel
      title="Gemini Env Source"
      subtitle="GitRoast reads the Gemini key from the current repository environment instead of prompting the user."
      aside={
        needsAttention ? (
          <StatusPill tone="warning">Action needed</StatusPill>
        ) : (
          <StatusPill tone="success">Project env detected</StatusPill>
        )
      }
    >
      <div className="detail-list">
        <div className="detail-row">
          <span className="detail-label">Lookup order</span>
          <span className="detail-value">`.env.local`, `.env`, shell env</span>
        </div>
        <div className="detail-row">
          <span className="detail-label">Accepted keys</span>
          <span className="detail-value">`GEMINI_API_KEY`, `GOOGLE_API_KEY`</span>
        </div>
        <div className="detail-row">
          <span className="detail-label">Resolved source</span>
          <span className="detail-value">{source ?? "Not found"}</span>
        </div>
      </div>

      {needsAttention ? (
        <p className="error-copy">
          Add `GEMINI_API_KEY=your_key` to this repo&apos;s `.env.local` or `.env`,
          then refresh the repo status.
        </p>
      ) : null}

      {inlineError ? <p className="error-copy">{inlineError}</p> : null}
    </Panel>
  );
}
