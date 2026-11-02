import type { DashboardData, Project, WorkspaceConfig } from "../types";

type MetricCardsProps = {
  dashboard: DashboardData | null;
  projects: Project[];
  isLoading: boolean;
  config: WorkspaceConfig;
};

export default function MetricCards({
  dashboard,
  projects,
  isLoading,
  config,
}: MetricCardsProps) {
  const total = isLoading ? 0 : (dashboard?.total ?? projects.length);
  const inProgress = isLoading
    ? 0
    : (dashboard?.in_progress ??
      projects.filter((p) => p.status === "in_progress").length);
  const completed = isLoading
    ? 0
    : (dashboard?.completed ??
      projects.filter((p) => p.status === "completed").length);
  const backlog = isLoading
    ? 0
    : (dashboard?.backlog ??
      projects.filter((p) => p.status === "backlog").length);

  const completionRate = total > 0 ? Math.round((completed / total) * 100) : 0;
  const inProgressRate = total > 0 ? Math.round((inProgress / total) * 100) : 0;

  return (
    <section
      className="metric-grid"
      aria-label={`${config.entityLabel} status summary`}
    >
      <article className="metric-card metric-primary">
        <div className="metric-top">
          <span className="metric-icon">▦</span>
          <span className="metric-kicker">
            ALL {config.entityLabel.toUpperCase()}S
          </span>
        </div>
        <strong>{isLoading ? "—" : total}</strong>
        <div
          className="metric-progress-bar"
          title={`${completionRate}% completed`}
        >
          <div
            className="metric-progress-fill progress-completed"
            style={{ width: `${completionRate}%` }}
          />
          <div
            className="metric-progress-fill progress-inprogress"
            style={{ width: `${inProgressRate}%` }}
          />
        </div>
        <div className="metric-foot">
          <span>{completionRate}% finished</span> · {total} active in workspace
        </div>
      </article>

      <article className="metric-card">
        <div className="metric-top">
          <span className="metric-icon icon-soft">◷</span>
          <span className="metric-kicker">IN PROGRESS</span>
        </div>
        <strong>{isLoading ? "—" : inProgress}</strong>
        <div className="metric-badge-row">
          <span className="metric-status-tag tag-progress">Active flow</span>
        </div>
        <div className="metric-foot">
          {inProgress === 1
            ? "1 item moving"
            : `${inProgress} items moving forward`}
        </div>
      </article>

      <article className="metric-card">
        <div className="metric-top">
          <span className="metric-icon icon-warm">✓</span>
          <span className="metric-kicker">COMPLETED</span>
        </div>
        <strong>{isLoading ? "—" : completed}</strong>
        <div className="metric-badge-row">
          <span className="metric-status-tag tag-completed">
            {completionRate}% rate
          </span>
        </div>
        <div className="metric-foot">{completed} achieved deliverables</div>
      </article>

      <article className="metric-card">
        <div className="metric-top">
          <span className="metric-icon icon-muted">▤</span>
          <span className="metric-kicker">BACKLOG / QUEUE</span>
        </div>
        <strong>{isLoading ? "—" : backlog}</strong>
        <div className="metric-badge-row">
          <span className="metric-status-tag tag-backlog">Pending start</span>
        </div>
        <div className="metric-foot">{backlog} queued for triage</div>
      </article>
    </section>
  );
}
