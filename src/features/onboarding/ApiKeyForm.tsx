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
    ? "Checking service"
    : serviceStatus?.ok
      ? "Service online"
      : "Service degraded";

  return (
    <Panel
      title="Privacy & Service"
      subtitle="GitRoast keeps repo inspection local and contacts the hosted service only when you generate."
      aside={<StatusPill tone={tone}>{label}</StatusPill>}
    >
      <div className="detail-list">
        <div className="detail-row">
          <span className="detail-label">Local only</span>
          <span className="detail-value">Repo checks and staged file inspection</span>
        </div>
        <div className="detail-row">
          <span className="detail-label">Sent on generate</span>
          <span className="detail-value">Staged diff text</span>
        </div>
        <div className="detail-row">
          <span className="detail-label">Setup</span>
          <span className="detail-value">No local API key required</span>
        </div>
        <div className="detail-row">
          <span className="detail-label">If service is busy</span>
          <span className="detail-value">Retry the same staged diff once it recovers</span>
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
          {refreshingService ? "Checking service..." : "Refresh service status"}
        </button>
      </div>

      {!serviceStatus?.ok ? (
        <p className="error-copy">
          The hosted service looks degraded right now. Your staged diff stays local until you try
          again, so wait a moment and retry when the service recovers.
        </p>
      ) : null}

      {inlineError ? <p className="error-copy">{inlineError}</p> : null}
    </Panel>
  );
}
