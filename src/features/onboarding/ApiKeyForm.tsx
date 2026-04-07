import { Panel } from "../../components/Panel";
import { StatusPill } from "../../components/StatusPill";
import type { ServiceStatusResult } from "../../types/contracts";

type ServicePanelProps = {
  serviceStatus: ServiceStatusResult | null;
  refreshingService: boolean;
  inlineError: string | null;
  onRefresh: (options?: { silent?: boolean }) => Promise<void>;
};

export function ServicePanel({
  serviceStatus,
  refreshingService,
  inlineError,
  onRefresh,
}: ServicePanelProps) {
  const tone = serviceStatus?.ok ? "success" : "warning";
  const label = refreshingService
    ? "Checking backend"
    : serviceStatus?.ok
      ? "Backend healthy"
      : "Backend unavailable";

  return (
    <Panel
      title="Service Health"
      subtitle="GitRoast calls a hosted commit generation service. The desktop app does not ask for Gemini, OpenRouter, or any local API key."
      aside={<StatusPill tone={tone}>{label}</StatusPill>}
    >
      <div className="detail-list">
        <div className="detail-row">
          <span className="detail-label">Base URL</span>
          <span className="detail-value">
            {serviceStatus?.baseUrl ?? "https://tauri-silly.evannave.site"}
          </span>
        </div>
        <div className="detail-row">
          <span className="detail-label">Service</span>
          <span className="detail-value">
            {serviceStatus?.serviceName ?? "git-joke-commit-api"}
          </span>
        </div>
        <div className="detail-row">
          <span className="detail-label">Server model</span>
          <span className="detail-value">{serviceStatus?.modelName ?? "API default"}</span>
        </div>
        <div className="detail-row">
          <span className="detail-label">Desktop client</span>
          <span className="detail-value">Public app build</span>
        </div>
        <div className="detail-row">
          <span className="detail-label">Generation payload</span>
          <span className="detail-value">Staged status plus staged diff</span>
        </div>
      </div>

      <div className="button-row">
        <button
          className="button-secondary"
          type="button"
          disabled={refreshingService}
          onClick={() => {
            void onRefresh();
          }}
        >
          {refreshingService ? "Checking backend..." : "Refresh backend status"}
        </button>
      </div>

      {!serviceStatus?.ok ? (
        <p className="error-copy">
          The health check is failing right now. Generation may still be attempted, but the hosted
          service can reject requests until it recovers.
        </p>
      ) : null}

      {inlineError ? <p className="error-copy">{inlineError}</p> : null}
    </Panel>
  );
}
