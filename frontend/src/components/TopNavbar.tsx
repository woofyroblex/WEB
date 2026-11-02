import type { ViewMode, WorkspaceConfig } from "../types";

type TopNavbarProps = {
  viewMode: ViewMode;
  config: WorkspaceConfig;
  searchQuery: string;
  onSearchChange: (query: string) => void;
  isDemoMode: boolean;
  onToggleDemoMode: () => void;
  onOpenNewModal: () => void;
  onOpenSettings: () => void;
  onExportCSV: () => void;
  onExportJSON: () => void;
  onToggleMobileMenu: () => void;
  userName: string;
};

export default function TopNavbar({
  viewMode,
  config,
  searchQuery,
  onSearchChange,
  isDemoMode,
  onToggleDemoMode,
  onOpenNewModal,
  onOpenSettings,
  onExportCSV,
  onExportJSON,
  onToggleMobileMenu,
  userName,
}: TopNavbarProps) {
  const viewTitles: Record<ViewMode, string> = {
    overview: "Overview",
    board: "Kanban Board",
    table: `${config.entityLabel} Directory`,
    reports: "Reports & Analytics",
  };

  const userInitial = (userName.trim()[0] || "U").toUpperCase();

  return (
    <header className="topbar">
      <div className="topbar-left">
        <button
          className="mobile-menu-toggle"
          onClick={onToggleMobileMenu}
          aria-label="Open sidebar menu"
          type="button"
        >
          ☰
        </button>
        <div className="breadcrumb">
          <span>{config.appName}</span>
          <span className="crumb-divider">/</span>
          <strong className="crumb-active">{viewTitles[viewMode]}</strong>
        </div>
      </div>

      <div className="topbar-center">
        <div className="search-box">
          <span className="search-icon">🔍</span>
          <input
            type="search"
            placeholder={`Search ${config.entityLabel.toLowerCase()}s by title, tag, or description...`}
            value={searchQuery}
            onChange={(e) => onSearchChange(e.target.value)}
            className="search-input"
            aria-label={`Search ${config.entityLabel}s`}
          />
          {searchQuery && (
            <button
              className="search-clear-btn"
              onClick={() => onSearchChange("")}
              aria-label="Clear search"
              type="button"
            >
              ✕
            </button>
          )}
        </div>
      </div>

      <div className="topbar-right">
        <button
          className={`mode-indicator-btn ${isDemoMode ? "mode-demo" : "mode-live"}`}
          onClick={onToggleDemoMode}
          title={
            isDemoMode
              ? "Running in zero-setup Local Demo Mode. Click to sign in or connect Live API."
              : "Connected to Live Django REST API. Click to switch to Demo Mode."
          }
          type="button"
        >
          <span className="mode-pulse-dot" />
          <span className="mode-text">
            {isDemoMode ? "Local Demo Mode" : "Live API Connected"}
          </span>
          <span className="mode-switch-tag">Switch</span>
        </button>

        <div className="export-dropdown">
          <button
            className="button button-outline button-sm"
            onClick={onExportCSV}
            title="Download CSV"
            type="button"
          >
            <span>↓</span> CSV
          </button>
          <button
            className="button button-outline button-sm export-json-btn"
            onClick={onExportJSON}
            title="Download JSON"
            type="button"
          >
            JSON
          </button>
        </div>

        <button
          className="button button-primary button-sm add-entity-btn"
          onClick={onOpenNewModal}
          type="button"
        >
          <span>＋</span> New {config.entityLabel}
        </button>

        <button
          className="icon-settings-btn"
          onClick={onOpenSettings}
          title="Customize Workspace & Problem Domain"
          aria-label="Workspace settings"
          type="button"
        >
          ⚙
        </button>

        <div
          className="avatar avatar-small"
          title={`${userName} (${isDemoMode ? "Guest" : "Account"})`}
        >
          {userInitial}
        </div>
      </div>
    </header>
  );
}
