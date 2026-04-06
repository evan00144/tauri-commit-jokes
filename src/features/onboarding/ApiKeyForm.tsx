import { useEffect, useMemo, useState } from "react";
import { Panel } from "../../components/Panel";
import { StatusPill } from "../../components/StatusPill";
import type { ApiKeyStatusResult, ViewState } from "../../types/contracts";

type ApiKeyFormProps = {
  viewState: ViewState;
  apiKeyStatus: ApiKeyStatusResult | null;
  savingApiKey: boolean;
  savingModel: boolean;
  inlineError: string | null;
  onSaveSessionApiKey: (apiKey: string) => Promise<void>;
  onClearSessionApiKey: () => Promise<void>;
  onSaveModel: (modelName: string) => Promise<void>;
};

const CUSTOM_MODEL_SENTINEL = "__custom_gemini_model__";

export function ApiKeyForm({
  viewState,
  apiKeyStatus,
  savingApiKey,
  savingModel,
  inlineError,
  onSaveSessionApiKey,
  onClearSessionApiKey,
  onSaveModel,
}: ApiKeyFormProps) {
  const needsAttention =
    viewState === "missing_api_key" || apiKeyStatus?.keyStatus === "invalid";

  const source = apiKeyStatus?.keySource;
  const supportedModels = useMemo(
    () =>
      apiKeyStatus?.supportedModels ?? [
        "gemini-3.1-pro",
        "gemini-3-flash",
        "gemini-3.1-flash-lite",
        "gemini-2.5-pro",
        "gemini-2.5-flash",
        "gemini-2.5-flash-lite",
        "gemini-flash-latest",
      ],
    [apiKeyStatus?.supportedModels],
  );

  const activeModel = apiKeyStatus?.modelName ?? "gemini-2.5-flash";
  const [sessionApiKey, setSessionApiKey] = useState("");
  const activeIsPreset = supportedModels.includes(activeModel);
  const [selectedModel, setSelectedModel] = useState(
    activeIsPreset ? activeModel : CUSTOM_MODEL_SENTINEL,
  );
  const [customModel, setCustomModel] = useState(activeIsPreset ? "" : activeModel);

  useEffect(() => {
    const nextActiveModel = apiKeyStatus?.modelName ?? "gemini-2.5-flash";
    const nextIsPreset = supportedModels.includes(nextActiveModel);
    setSelectedModel(nextIsPreset ? nextActiveModel : CUSTOM_MODEL_SENTINEL);
    setCustomModel(nextIsPreset ? "" : nextActiveModel);
  }, [apiKeyStatus?.modelName, supportedModels]);

  const resolvedDraftModel = useMemo(() => {
    if (selectedModel === CUSTOM_MODEL_SENTINEL) {
      return customModel.trim();
    }

    return selectedModel;
  }, [customModel, selectedModel]);

  const canSaveModel =
    resolvedDraftModel.length > 0 && resolvedDraftModel !== activeModel && !savingModel;

  return (
    <Panel
      title="Gemini Setup"
      subtitle="GitRoast can read the API key from repo env or shell env, or you can paste one that lives only for the current app session."
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
          <span className="detail-value">session input, `.env.local`, `.env`, shell env</span>
        </div>
        <div className="detail-row">
          <span className="detail-label">Accepted key names</span>
          <span className="detail-value">
            {apiKeyStatus?.acceptedKeyNames?.join(", ") ?? "GEMINI_API_KEY, GOOGLE_API_KEY"}
          </span>
        </div>
        <div className="detail-row">
          <span className="detail-label">Resolved source</span>
          <span className="detail-value">{source ?? "Not found"}</span>
        </div>
        <div className="detail-row">
          <span className="detail-label">Active model</span>
          <span className="detail-value">{activeModel}</span>
        </div>
      </div>

      <div className="settings-grid">
        <div className="field-block">
          <label className="field-label" htmlFor="session-api-key">
            Session API key
          </label>
          <input
            id="session-api-key"
            className="text-input"
            type="password"
            value={sessionApiKey}
            onChange={(event) => setSessionApiKey(event.target.value)}
            placeholder="Paste Gemini API key for this session only"
            disabled={savingApiKey}
          />
          <p className="field-help">
            This key stays in memory only and disappears when GitRoast closes. Useful on Windows
            when your WSL shell env is not visible to the packaged app.
          </p>
          <div className="button-row">
            <button
              className="button-secondary"
              type="button"
              disabled={savingApiKey || sessionApiKey.trim().length === 0}
              onClick={() => {
                void onSaveSessionApiKey(sessionApiKey.trim());
              }}
            >
              {savingApiKey ? "Saving key..." : "Use for this session"}
            </button>
            <button
              className="button-ghost"
              type="button"
              disabled={savingApiKey || apiKeyStatus?.keySource !== "session input"}
              onClick={() => {
                setSessionApiKey("");
                void onClearSessionApiKey();
              }}
            >
              Clear session key
            </button>
          </div>
        </div>

        <div className="field-block">
          <label className="field-label" htmlFor="model-preset">
            Gemini model
          </label>
          <select
            id="model-preset"
            className="input-control"
            value={selectedModel}
            onChange={(event) => setSelectedModel(event.target.value)}
            disabled={savingModel}
          >
            {supportedModels.map((modelName) => (
              <option key={modelName} value={modelName}>
                {modelName}
              </option>
            ))}
            <option value={CUSTOM_MODEL_SENTINEL}>Custom Gemini model</option>
          </select>
          <p className="field-help">
            GitRoast ships with a broad Gemini preset list, but you can also save any Gemini model
            string directly.
          </p>
        </div>

        <div className="field-block">
          <label className="field-label" htmlFor="custom-model">
            Custom model
          </label>
          <input
            id="custom-model"
            className="text-input"
            type="text"
            value={customModel}
            onChange={(event) => setCustomModel(event.target.value)}
            placeholder="gemini-2.5-flash"
            disabled={savingModel || selectedModel !== CUSTOM_MODEL_SENTINEL}
          />
          <p className="field-help">
            Use this when Google ships a newer Gemini model before GitRoast adds it to the preset
            picker.
          </p>
        </div>
      </div>

      <div className="button-row">
        <button
          className="button-secondary"
          type="button"
          disabled={!canSaveModel}
          onClick={() => {
            void onSaveModel(resolvedDraftModel);
          }}
        >
          {savingModel ? "Saving model..." : "Save model"}
        </button>
      </div>

      <div className="message-box compact">
        <pre>{`# .env.local
GEMINI_API_KEY=your_gemini_api_key_here`}</pre>
      </div>

      {needsAttention ? (
        <p className="error-copy">
          Add a Gemini key through session input or create `.env.local` in this repo, then click `Refresh`.
        </p>
      ) : null}

      {apiKeyStatus?.modelWarning ? (
        <p className="error-copy">{apiKeyStatus.modelWarning}</p>
      ) : null}

      {inlineError ? <p className="error-copy">{inlineError}</p> : null}
    </Panel>
  );
}
