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
      title="API Backend"
      subtitle="GitRoast sends staged git text to the hosted commit-joke API. No local model picker or API key input is required."
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
          <span className="detail-label">Client auth</span>
          <span className="detail-value">None</span>
        </div>
        <div className="detail-row">
          <span className="detail-label">Sent by app</span>
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
          The health check is failing right now. You can still try `Generate`, but the backend may
          reject the request until the service recovers.
        </p>
      ) : null}

      {inlineError ? <p className="error-copy">{inlineError}</p> : null}
    </Panel>
  );
}
