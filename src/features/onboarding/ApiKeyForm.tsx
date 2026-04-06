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
  const supportedModels = apiKeyStatus?.supportedModels ?? [
    "gemini-2.5-flash",
    "gemini-2.5-pro",
    "gemini-2.5-flash-lite",
  ];

  return (
    <Panel
      title="Gemini Env Setup"
      subtitle="Open-source mode keeps secrets out of the app. Put your Gemini key in repo env files or your shell env."
      aside={
        needsAttention ? (
          <StatusPill tone="warning">Action needed</StatusPill>
        ) : (
          <StatusPill tone="success">Env detected</StatusPill>
        )
      }
    >
      <div className="detail-list">
        <div className="detail-row">
          <span className="detail-label">Lookup order</span>
          <span className="detail-value">`.env.local`, `.env`, shell env</span>
        </div>
        <div className="detail-row">
          <span className="detail-label">Accepted key names</span>
          <span className="detail-value">
            {apiKeyStatus?.acceptedKeyNames?.join(", ") ?? "GEMINI_API_KEY, GOOGLE_API_KEY"}
          </span>
        </div>
        <div className="detail-row">
          <span className="detail-label">Model env keys</span>
          <span className="detail-value">GITROAST_GEMINI_MODEL, GEMINI_MODEL</span>
        </div>
        <div className="detail-row">
          <span className="detail-label">Resolved source</span>
          <span className="detail-value">{source ?? "Not found"}</span>
        </div>
        <div className="detail-row">
          <span className="detail-label">Active model</span>
          <span className="detail-value">{apiKeyStatus?.modelName ?? "gemini-2.5-flash"}</span>
        </div>
        <div className="detail-row">
          <span className="detail-label">Supported models</span>
          <span className="detail-value">{supportedModels.join(", ")}</span>
        </div>
      </div>

      <div className="message-box compact">
        <pre>{`# .env.local
GEMINI_API_KEY=your_gemini_api_key_here
GITROAST_GEMINI_MODEL=gemini-2.5-flash`}</pre>
      </div>

      {needsAttention ? (
        <p className="error-copy">
          Create `.env.local` in this repo, add your Gemini key, then click `Refresh`.
        </p>
      ) : null}

      {apiKeyStatus?.modelWarning ? (
        <p className="error-copy">{apiKeyStatus.modelWarning}</p>
      ) : null}

      {inlineError ? <p className="error-copy">{inlineError}</p> : null}
    </Panel>
  );
}
