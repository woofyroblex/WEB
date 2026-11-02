import { useEffect, useState } from "react";
import type { FormEvent } from "react";
import type {
  Priority,
  Project,
  ProjectStatus,
  WorkspaceConfig,
} from "../types";

type ItemModalProps = {
  isOpen: boolean;
  onClose: () => void;
  projectToEdit: Project | null;
  defaultStatus?: ProjectStatus;
  config: WorkspaceConfig;
  onSave: (data: {
    title: string;
    description: string;
    status: ProjectStatus;
    priority: Priority;
    tags: string[];
    id?: number;
  }) => Promise<void>;
  isSaving: boolean;
};

function ItemModalContent({
  onClose,
  projectToEdit,
  defaultStatus = "backlog",
  config,
  onSave,
  isSaving,
}: Omit<ItemModalProps, "isOpen">) {
  const [title, setTitle] = useState(() => projectToEdit?.title ?? "");
  const [description, setDescription] = useState(
    () => projectToEdit?.description ?? "",
  );
  const [status, setStatus] = useState<ProjectStatus>(
    () => projectToEdit?.status ?? defaultStatus,
  );
  const [priority, setPriority] = useState<Priority>(
    () => projectToEdit?.priority ?? "medium",
  );
  const [tagInput, setTagInput] = useState("");
  const [tags, setTags] = useState<string[]>(() => projectToEdit?.tags ?? []);
  const [formError, setFormError] = useState("");

  useEffect(() => {
    function handleKeyDown(e: KeyboardEvent) {
      if (e.key === "Escape") {
        onClose();
      }
    }
    window.addEventListener("keydown", handleKeyDown);
    return () => window.removeEventListener("keydown", handleKeyDown);
  }, [onClose]);

  function handleAddTag() {
    const trimmed = tagInput.trim().replace(/^#/, "");
    if (!trimmed) return;
    if (!tags.includes(trimmed)) {
      setTags([...tags, trimmed]);
    }
    setTagInput("");
  }

  function handleRemoveTag(tagToRemove: string) {
    setTags(tags.filter((t) => t !== tagToRemove));
  }

  async function handleSubmit(e: FormEvent) {
    e.preventDefault();
    if (!title.trim()) {
      setFormError("Title is required.");
      return;
    }
    setFormError("");
    try {
      await onSave({
        title: title.trim(),
        description: description.trim(),
        status,
        priority,
        tags,
        id: projectToEdit?.id,
      });
      onClose();
    } catch (err) {
      setFormError(
        err instanceof Error
          ? err.message
          : "Failed to save. Please try again.",
      );
    }
  }

  return (
    <div
      className="modal-backdrop"
      onClick={onClose}
      aria-modal="true"
      role="dialog"
    >
      <div className="modal-card" onClick={(e) => e.stopPropagation()}>
        <div className="modal-header">
          <div className="modal-header-copy">
            <span className="eyebrow">
              {projectToEdit ? "EDIT" : "CREATE NEW"}{" "}
              {config.entityLabel.toUpperCase()}
            </span>
            <h3>
              {projectToEdit
                ? `Edit ${config.entityLabel}`
                : `New ${config.entityLabel}`}
            </h3>
          </div>
          <button
            className="modal-close-btn"
            onClick={onClose}
            aria-label="Close modal"
            type="button"
          >
            ✕
          </button>
        </div>

        <form onSubmit={handleSubmit} className="modal-form">
          {formError && <div className="form-error">{formError}</div>}

          <div className="form-group">
            <label htmlFor="modal-title">
              {config.entityLabel} Title <span className="req">*</span>
            </label>
            <input
              id="modal-title"
              type="text"
              required
              maxLength={120}
              placeholder={`e.g. Design modular pipeline or implement feature...`}
              value={title}
              onChange={(e) => setTitle(e.target.value)}
              className="modal-input"
              autoFocus
            />
          </div>

          <div className="form-row-2">
            <div className="form-group">
              <label htmlFor="modal-status">Status</label>
              <select
                id="modal-status"
                value={status}
                onChange={(e) => setStatus(e.target.value as ProjectStatus)}
                className="modal-select"
              >
                <option value="backlog">Backlog</option>
                <option value="in_progress">In Progress</option>
                <option value="completed">Completed</option>
              </select>
            </div>

            <div className="form-group">
              <label htmlFor="modal-priority">Priority</label>
              <select
                id="modal-priority"
                value={priority}
                onChange={(e) => setPriority(e.target.value as Priority)}
                className="modal-select"
              >
                <option value="low">Low</option>
                <option value="medium">Medium</option>
                <option value="high">High</option>
                <option value="urgent">Urgent</option>
              </select>
            </div>
          </div>

          <div className="form-group">
            <label htmlFor="modal-tags">Tags & Labels</label>
            <div className="tag-input-row">
              <input
                id="modal-tags"
                type="text"
                placeholder="Add tag and press Enter or click Add"
                value={tagInput}
                onChange={(e) => setTagInput(e.target.value)}
                onKeyDown={(e) => {
                  if (e.key === "Enter") {
                    e.preventDefault();
                    handleAddTag();
                  }
                }}
                className="modal-input"
              />
              <button
                type="button"
                className="button button-outline"
                onClick={handleAddTag}
              >
                Add Tag
              </button>
            </div>

            {tags.length > 0 && (
              <div className="tag-pill-container">
                {tags.map((tag) => (
                  <span key={tag} className="tag-removable-pill">
                    #{tag}
                    <button
                      type="button"
                      onClick={() => handleRemoveTag(tag)}
                      aria-label={`Remove tag ${tag}`}
                    >
                      ×
                    </button>
                  </span>
                ))}
              </div>
            )}
          </div>

          <div className="form-group">
            <label htmlFor="modal-description">Description & Notes</label>
            <textarea
              id="modal-description"
              rows={3}
              maxLength={1200}
              placeholder="Outline the scope, objectives, or criteria..."
              value={description}
              onChange={(e) => setDescription(e.target.value)}
              className="modal-textarea"
            />
          </div>

          <div className="modal-footer">
            <button
              type="button"
              className="button button-outline"
              onClick={onClose}
              disabled={isSaving}
            >
              Cancel
            </button>
            <button
              type="submit"
              className="button button-primary"
              disabled={isSaving}
            >
              {isSaving
                ? "Saving..."
                : projectToEdit
                  ? "Save Changes"
                  : `Create ${config.entityLabel}`}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}

export default function ItemModal(props: ItemModalProps) {
  if (!props.isOpen) return null;
  const key = props.projectToEdit
    ? `edit-${props.projectToEdit.id}`
    : `new-${props.defaultStatus ?? "backlog"}`;
  return <ItemModalContent key={key} {...props} />;
}
