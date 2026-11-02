import { useState } from "react";
import type { FormEvent } from "react";
import { DOMAIN_PRESETS } from "../mockData";
import type { DomainPreset, WorkspaceConfig, WorkspaceTheme } from "../types";

type WorkspaceSettingsModalProps = {
  isOpen: boolean;
  onClose: () => void;
  config: WorkspaceConfig;
  onSaveConfig: (nextConfig: WorkspaceConfig) => void;
  onApplyPreset: (preset: DomainPreset) => void;
};

const THEMES: Array<{
  id: WorkspaceTheme;
  name: string;
  color: string;
  accent: string;
}> = [
  { id: "emerald", name: "Emerald Mint", color: "#173a31", accent: "#276d58" },
  { id: "indigo", name: "Tech Indigo", color: "#19233c", accent: "#3a56d4" },
  { id: "slate", name: "Minimal Slate", color: "#1e2429", accent: "#4b5563" },
  { id: "violet", name: "Modern Violet", color: "#251c38", accent: "#7c3aed" },
  { id: "amber", name: "Warm Amber", color: "#332213", accent: "#d97706" },
];

function WorkspaceSettingsContent({
  onClose,
  config,
  onSaveConfig,
  onApplyPreset,
}: Omit<WorkspaceSettingsModalProps, "isOpen">) {
  const [appName, setAppName] = useState(() => config.appName);
  const [entityLabel, setEntityLabel] = useState(() => config.entityLabel);
  const [tagline, setTagline] = useState(() => config.tagline);
  const [theme, setTheme] = useState<WorkspaceTheme>(() => config.theme);
  const [darkMode, setDarkMode] = useState(() => config.darkMode);

  function handleSubmit(e: FormEvent) {
    e.preventDefault();
    onSaveConfig({
      appName: appName.trim() || "WEB Project Hub",
      entityLabel: entityLabel.trim() || "Project",
      tagline: tagline.trim(),
      theme,
      darkMode,
    });
    onClose();
  }

  return (
    <div
      className="modal-backdrop"
      onClick={onClose}
      aria-modal="true"
      role="dialog"
    >
      <div
        className="modal-card modal-card-wide"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="modal-header">
          <div className="modal-header-copy">
            <span className="eyebrow">WORKSPACE & PROBLEM CONFIGURATION</span>
            <h3>Flexible Domain & Theme Settings</h3>
          </div>
          <button
            className="modal-close-btn"
            onClick={onClose}
            aria-label="Close settings"
            type="button"
          >
            ✕
          </button>
        </div>

        <div className="settings-body">
          <div className="settings-section">
            <div className="settings-section-head">
              <h4>1-Click Problem Domain Templates</h4>
              <p>
                When your problem statement arrives, apply a matching template
                instantly or customize the fields below.
              </p>
            </div>
            <div className="preset-grid">
              {DOMAIN_PRESETS.map((preset) => (
                <button
                  key={preset.id}
                  className="preset-card"
                  onClick={() => {
                    onApplyPreset(preset);
                    onClose();
                  }}
                  type="button"
                >
                  <div className="preset-card-top">
                    <span className="preset-dot" />
                    <strong>{preset.name}</strong>
                  </div>
                  <small className="preset-desc">
                    Entity: <b>{preset.entityLabel}</b> · Theme: {preset.theme}
                  </small>
                </button>
              ))}
            </div>
          </div>

          <form onSubmit={handleSubmit} className="modal-form">
            <div className="settings-section">
              <div className="settings-section-head">
                <h4>Custom Workspace Properties</h4>
              </div>

              <div className="form-row-2">
                <div className="form-group">
                  <label htmlFor="setting-appname">Workspace / App Title</label>
                  <input
                    id="setting-appname"
                    type="text"
                    maxLength={60}
                    value={appName}
                    onChange={(e) => setAppName(e.target.value)}
                    className="modal-input"
                    placeholder="e.g. Project Hub, HealthFlow, EcoPulse..."
                    required
                  />
                </div>

                <div className="form-group">
                  <label htmlFor="setting-entity">Entity Name (Singular)</label>
                  <input
                    id="setting-entity"
                    type="text"
                    maxLength={30}
                    value={entityLabel}
                    onChange={(e) => setEntityLabel(e.target.value)}
                    className="modal-input"
                    placeholder="e.g. Project, Task, Patient, Issue, Case..."
                    required
                  />
                </div>
              </div>

              <div className="form-group">
                <label htmlFor="setting-tagline">Tagline or Subheading</label>
                <input
                  id="setting-tagline"
                  type="text"
                  maxLength={120}
                  value={tagline}
                  onChange={(e) => setTagline(e.target.value)}
                  className="modal-input"
                  placeholder="e.g. A clear home for the work that matters."
                />
              </div>
            </div>

            <div className="settings-section">
              <div className="settings-section-head">
                <h4>Visual Theme & Appearance</h4>
              </div>

              <div className="theme-picker-row">
                {THEMES.map((t) => (
                  <button
                    key={t.id}
                    type="button"
                    className={`theme-chip-btn ${theme === t.id ? "active-theme" : ""}`}
                    onClick={() => setTheme(t.id)}
                  >
                    <span
                      className="theme-circle"
                      style={{ background: t.accent }}
                    />
                    <span>{t.name}</span>
                  </button>
                ))}
              </div>

              <div className="darkmode-toggle-row">
                <label className="toggle-label" htmlFor="setting-darkmode">
                  <span>Enable Dark Interface Mode</span>
                  <small>
                    Optimized high-contrast dark palette for low light
                  </small>
                </label>
                <input
                  id="setting-darkmode"
                  type="checkbox"
                  checked={darkMode}
                  onChange={(e) => setDarkMode(e.target.checked)}
                  className="toggle-checkbox"
                />
              </div>
            </div>

            <div className="modal-footer">
              <button
                type="button"
                className="button button-outline"
                onClick={onClose}
              >
                Cancel
              </button>
              <button type="submit" className="button button-primary">
                Save Workspace Settings
              </button>
            </div>
          </form>
        </div>
      </div>
    </div>
  );
}

export default function WorkspaceSettingsModal(
  props: WorkspaceSettingsModalProps,
) {
  if (!props.isOpen) return null;
  const key = `${props.config.appName}-${props.config.entityLabel}-${props.config.theme}-${props.config.darkMode}`;
  return <WorkspaceSettingsContent key={key} {...props} />;
}
