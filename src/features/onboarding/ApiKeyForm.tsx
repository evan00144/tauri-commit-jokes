import { useState } from "react";
import { Panel } from "../../components/Panel";
import { StatusPill } from "../../components/StatusPill";
import type { ApiKeyStatusResult, ViewState } from "../../types/contracts";

type ApiKeyFormProps = {
  submitting: boolean;
  viewState: ViewState;
  apiKeyStatus: ApiKeyStatusResult | null;
  inlineError: string | null;
  onSave: (apiKey: string) => Promise<void>;
};

export function ApiKeyForm({
  submitting,
  viewState,
  apiKeyStatus,
  inlineError,
  onSave,
}: ApiKeyFormProps) {
  const [apiKey, setApiKey] = useState("");

  const needsAttention =
    viewState === "missing_api_key" || apiKeyStatus?.keyStatus === "invalid";

  return (
    <Panel
      title="Gemini API Key"
      subtitle="Save your Google AI Studio key locally. GitRoast validates it on the first real generation call."
      aside={
        needsAttention ? (
          <StatusPill tone="warning">Action needed</StatusPill>
        ) : (
          <StatusPill tone="success">Stored locally</StatusPill>
        )
      }
    >
      <form
        className="field-group"
        onSubmit={async (event) => {
          event.preventDefault();
          await onSave(apiKey);
          setApiKey("");
        }}
      >
        <label className="field-label" htmlFor="gemini-api-key">
          Paste a Gemini API key from Google AI Studio
        </label>
        <input
          id="gemini-api-key"
          className="text-input"
          type="password"
          autoComplete="off"
          value={apiKey}
          onChange={(event) => setApiKey(event.currentTarget.value)}
          placeholder="AIza..."
        />
        <div className="button-row">
          <button
            className="button-primary"
            type="submit"
            disabled={submitting || apiKey.trim().length === 0}
          >
            {submitting ? "Saving key..." : "Save API key"}
          </button>
        </div>
      </form>

      {inlineError ? <p className="error-copy">{inlineError}</p> : null}
    </Panel>
  );
}
