import { useState } from "react";
import type { DragEvent } from "react";
import type { Project, ProjectStatus, WorkspaceConfig } from "../types";

type KanbanBoardProps = {
  projects: Project[];
  config: WorkspaceConfig;
  onStatusChange: (project: Project, status: ProjectStatus) => void;
  onEditProject: (project: Project) => void;
  onDeleteProject: (project: Project) => void;
  onAddNewToStatus: (status: ProjectStatus) => void;
};

const COLUMNS: Array<{
  id: ProjectStatus;
  title: string;
  icon: string;
  colorClass: string;
}> = [
  { id: "backlog", title: "Backlog", icon: "▤", colorClass: "col-backlog" },
  {
    id: "in_progress",
    title: "In Progress",
    icon: "◷",
    colorClass: "col-progress",
  },
  {
    id: "completed",
    title: "Completed",
    icon: "✓",
    colorClass: "col-completed",
  },
];

export default function KanbanBoard({
  projects,
  config,
  onStatusChange,
  onEditProject,
  onDeleteProject,
  onAddNewToStatus,
}: KanbanBoardProps) {
  const [draggedProjectId, setDraggedProjectId] = useState<number | null>(null);
  const [dragOverCol, setDragOverCol] = useState<ProjectStatus | null>(null);

  function handleDragStart(e: DragEvent<HTMLDivElement>, project: Project) {
    e.dataTransfer.setData("text/plain", String(project.id));
    setDraggedProjectId(project.id);
  }

  function handleDragOver(e: DragEvent<HTMLDivElement>, status: ProjectStatus) {
    e.preventDefault();
    if (dragOverCol !== status) {
      setDragOverCol(status);
    }
  }

  function handleDragLeave() {
    setDragOverCol(null);
  }

  function handleDrop(
    e: DragEvent<HTMLDivElement>,
    targetStatus: ProjectStatus,
  ) {
    e.preventDefault();
    setDragOverCol(null);
    const idStr = e.dataTransfer.getData("text/plain");
    const id = Number(idStr);
    if (!id) return;
    const project = projects.find((p) => p.id === id);
    if (project && project.status !== targetStatus) {
      onStatusChange(project, targetStatus);
    }
    setDraggedProjectId(null);
  }

  function formatDate(dateStr: string) {
    try {
      return new Intl.DateTimeFormat("en", {
        month: "short",
        day: "numeric",
      }).format(new Date(dateStr));
    } catch {
      return dateStr;
    }
  }

  return (
    <div className="kanban-board">
      <div className="kanban-grid">
        {COLUMNS.map((column) => {
          const colProjects = projects.filter((p) => p.status === column.id);
          const isOver = dragOverCol === column.id;

          return (
            <div
              key={column.id}
              className={`kanban-column ${column.colorClass} ${isOver ? "drag-target-active" : ""}`}
              onDragOver={(e) => handleDragOver(e, column.id)}
              onDragLeave={handleDragLeave}
              onDrop={(e) => handleDrop(e, column.id)}
            >
              <div className="kanban-col-header">
                <div className="kanban-col-title">
                  <span className="col-icon">{column.icon}</span>
                  <strong>{column.title}</strong>
                  <span className="col-count">{colProjects.length}</span>
                </div>
                <button
                  className="col-add-btn"
                  onClick={() => onAddNewToStatus(column.id)}
                  title={`Add ${config.entityLabel} to ${column.title}`}
                  type="button"
                >
                  ＋
                </button>
              </div>

              <div className="kanban-card-list">
                {colProjects.length === 0 ? (
                  <div className="kanban-empty-column">
                    <span>No {config.entityLabel.toLowerCase()}s here</span>
                    <button
                      className="text-button"
                      onClick={() => onAddNewToStatus(column.id)}
                      type="button"
                    >
                      ＋ Add one
                    </button>
                  </div>
                ) : (
                  colProjects.map((project) => {
                    const isDragging = draggedProjectId === project.id;
                    return (
                      <div
                        key={project.id}
                        className={`kanban-card ${isDragging ? "card-dragging" : ""}`}
                        draggable
                        onDragStart={(e) => handleDragStart(e, project)}
                        onClick={() => onEditProject(project)}
                        role="button"
                        tabIndex={0}
                        onKeyDown={(e) => {
                          if (e.key === "Enter" || e.key === " ") {
                            onEditProject(project);
                          }
                        }}
                      >
                        <div className="card-top-row">
                          <span
                            className={`priority-chip priority-${project.priority || "medium"}`}
                          >
                            {(project.priority || "medium").toUpperCase()}
                          </span>
                          <div
                            className="card-quick-actions"
                            onClick={(e) => e.stopPropagation()}
                          >
                            {column.id !== "backlog" && (
                              <button
                                className="card-move-btn"
                                onClick={() =>
                                  onStatusChange(project, "backlog")
                                }
                                title="Move to Backlog"
                                type="button"
                              >
                                ←
                              </button>
                            )}
                            {column.id === "backlog" && (
                              <button
                                className="card-move-btn"
                                onClick={() =>
                                  onStatusChange(project, "in_progress")
                                }
                                title="Move to In Progress"
                                type="button"
                              >
                                →
                              </button>
                            )}
                            {column.id === "in_progress" && (
                              <button
                                className="card-move-btn"
                                onClick={() =>
                                  onStatusChange(project, "completed")
                                }
                                title="Mark Completed"
                                type="button"
                              >
                                ✓
                              </button>
                            )}
                            <button
                              className="card-delete-btn"
                              onClick={() => onDeleteProject(project)}
                              title="Delete"
                              type="button"
                            >
                              ×
                            </button>
                          </div>
                        </div>

                        <h4 className="card-title">{project.title}</h4>

                        {project.description && (
                          <p className="card-desc">{project.description}</p>
                        )}

                        {project.tags && project.tags.length > 0 && (
                          <div className="card-tags">
                            {project.tags.map((tag) => (
                              <span key={tag} className="tag-chip">
                                #{tag}
                              </span>
                            ))}
                          </div>
                        )}

                        <div className="card-footer">
                          <span className="card-date">
                            {formatDate(project.updated_at)}
                          </span>
                          <span className="card-edit-hint">
                            Click to edit ✎
                          </span>
                        </div>
                      </div>
                    );
                  })
                )}
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}
