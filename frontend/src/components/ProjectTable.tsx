import { useState } from "react";
import type {
  Priority,
  Project,
  ProjectStatus,
  WorkspaceConfig,
} from "../types";

type ProjectTableProps = {
  projects: Project[];
  config: WorkspaceConfig;
  onStatusChange: (project: Project, status: ProjectStatus) => void;
  onEditProject: (project: Project) => void;
  onDeleteProject: (project: Project) => void;
  onOpenCreateModal: () => void;
  onResetSampleData: () => void;
};

export default function ProjectTable({
  projects,
  config,
  onStatusChange,
  onEditProject,
  onDeleteProject,
  onOpenCreateModal,
  onResetSampleData,
}: ProjectTableProps) {
  const [statusFilter, setStatusFilter] = useState<string>("all");
  const [priorityFilter, setPriorityFilter] = useState<string>("all");
  const [sortBy, setSortBy] = useState<"updated" | "title" | "priority">(
    "updated",
  );

  function formatDate(dateStr: string) {
    try {
      return new Intl.DateTimeFormat("en", {
        month: "short",
        day: "numeric",
        year: "numeric",
      }).format(new Date(dateStr));
    } catch {
      return dateStr;
    }
  }

  const priorityWeights: Record<Priority, number> = {
    urgent: 4,
    high: 3,
    medium: 2,
    low: 1,
  };

  const filteredProjects = projects
    .filter((project) => {
      if (statusFilter !== "all" && project.status !== statusFilter) {
        return false;
      }
      if (
        priorityFilter !== "all" &&
        (project.priority || "medium") !== priorityFilter
      ) {
        return false;
      }
      return true;
    })
    .sort((a, b) => {
      if (sortBy === "title") {
        return a.title.localeCompare(b.title);
      }
      if (sortBy === "priority") {
        const weightA = priorityWeights[a.priority || "medium"] || 2;
        const weightB = priorityWeights[b.priority || "medium"] || 2;
        return weightB - weightA;
      }
      // default: updated
      return (
        new Date(b.updated_at).getTime() - new Date(a.updated_at).getTime()
      );
    });

  return (
    <section className="project-table-section">
      <div className="table-controls-bar">
        <div className="filter-tab-group" role="tablist">
          <button
            className={`filter-tab ${statusFilter === "all" ? "active" : ""}`}
            onClick={() => setStatusFilter("all")}
            type="button"
          >
            All ({projects.length})
          </button>
          <button
            className={`filter-tab ${statusFilter === "backlog" ? "active" : ""}`}
            onClick={() => setStatusFilter("backlog")}
            type="button"
          >
            Backlog ({projects.filter((p) => p.status === "backlog").length})
          </button>
          <button
            className={`filter-tab ${statusFilter === "in_progress" ? "active" : ""}`}
            onClick={() => setStatusFilter("in_progress")}
            type="button"
          >
            In Progress (
            {projects.filter((p) => p.status === "in_progress").length})
          </button>
          <button
            className={`filter-tab ${statusFilter === "completed" ? "active" : ""}`}
            onClick={() => setStatusFilter("completed")}
            type="button"
          >
            Completed ({projects.filter((p) => p.status === "completed").length}
            )
          </button>
        </div>

        <div className="table-filter-dropdowns">
          <label className="select-wrapper">
            <span className="select-label">Priority:</span>
            <select
              value={priorityFilter}
              onChange={(e) => setPriorityFilter(e.target.value)}
              className="compact-select"
              aria-label="Filter by priority"
            >
              <option value="all">All Priorities</option>
              <option value="urgent">Urgent</option>
              <option value="high">High</option>
              <option value="medium">Medium</option>
              <option value="low">Low</option>
            </select>
          </label>

          <label className="select-wrapper">
            <span className="select-label">Sort:</span>
            <select
              value={sortBy}
              onChange={(e) =>
                setSortBy(e.target.value as "updated" | "title" | "priority")
              }
              className="compact-select"
              aria-label="Sort projects"
            >
              <option value="updated">Recently Updated</option>
              <option value="title">Title (A-Z)</option>
              <option value="priority">Priority (High to Low)</option>
            </select>
          </label>
        </div>
      </div>

      <div className="project-table">
        <div className="table-header">
          <span className="th-entity">
            {config.entityLabel.toUpperCase()} NAME
          </span>
          <span className="th-status">STATUS</span>
          <span className="th-priority">PRIORITY</span>
          <span className="th-tags">TAGS</span>
          <span className="th-date">LAST UPDATED</span>
          <span className="th-actions">ACTIONS</span>
        </div>

        {filteredProjects.length === 0 ? (
          <div className="empty-state">
            <span className="empty-icon">▦</span>
            <strong>
              No matching {config.entityLabel.toLowerCase()}s found
            </strong>
            <span>
              Try adjusting your filter or add a new{" "}
              {config.entityLabel.toLowerCase()} to get started.
            </span>
            <div className="empty-actions">
              <button
                className="button button-primary"
                onClick={onOpenCreateModal}
                type="button"
              >
                ＋ Add {config.entityLabel}
              </button>
              <button
                className="button button-outline"
                onClick={onResetSampleData}
                type="button"
              >
                Reset Starter Data
              </button>
            </div>
          </div>
        ) : (
          filteredProjects.map((project) => {
            const priority = project.priority || "medium";
            return (
              <article className="project-row" key={project.id}>
                <div
                  className="project-name-cell"
                  onClick={() => onEditProject(project)}
                  role="button"
                  tabIndex={0}
                  onKeyDown={(e) => {
                    if (e.key === "Enter" || e.key === " ") {
                      onEditProject(project);
                    }
                  }}
                >
                  <span
                    className={`project-avatar project-avatar-${project.status}`}
                  >
                    {project.title.slice(0, 1).toUpperCase()}
                  </span>
                  <div className="project-copy">
                    <strong
                      className="project-title-text"
                      title={project.title}
                    >
                      {project.title}
                    </strong>
                    <small
                      className="project-desc-text"
                      title={project.description}
                    >
                      {project.description || "No description provided"}
                    </small>
                  </div>
                </div>

                <div className="status-cell">
                  <span
                    className={`status-dot status-${project.status}`}
                    aria-hidden="true"
                  />
                  <select
                    aria-label={`Status for ${project.title}`}
                    className={`status-select status-${project.status}`}
                    value={project.status}
                    onChange={(event) =>
                      void onStatusChange(
                        project,
                        event.target.value as ProjectStatus,
                      )
                    }
                  >
                    <option value="backlog">Backlog</option>
                    <option value="in_progress">In progress</option>
                    <option value="completed">Completed</option>
                  </select>
                </div>

                <div className="priority-cell">
                  <span className={`priority-chip priority-${priority}`}>
                    {priority.toUpperCase()}
                  </span>
                </div>

                <div className="tags-cell">
                  {project.tags && project.tags.length > 0 ? (
                    <div className="table-tags-wrap">
                      {project.tags.slice(0, 2).map((tag) => (
                        <span key={tag} className="table-tag-chip">
                          #{tag}
                        </span>
                      ))}
                      {project.tags.length > 2 && (
                        <span
                          className="table-tag-more"
                          title={project.tags.slice(2).join(", ")}
                        >
                          +{project.tags.length - 2}
                        </span>
                      )}
                    </div>
                  ) : (
                    <span className="muted-dash">—</span>
                  )}
                </div>

                <div className="date-cell">
                  <span className="updated-date">
                    {formatDate(project.updated_at)}
                  </span>
                </div>

                <div className="actions-cell">
                  <button
                    className="action-icon-btn"
                    type="button"
                    title="Edit item"
                    onClick={() => onEditProject(project)}
                  >
                    ✎
                  </button>
                  <button
                    className="action-icon-btn delete-icon"
                    type="button"
                    aria-label={`Delete ${project.title}`}
                    title="Delete item"
                    onClick={() => void onDeleteProject(project)}
                  >
                    ×
                  </button>
                </div>
              </article>
            );
          })
        )}
      </div>
    </section>
  );
}
