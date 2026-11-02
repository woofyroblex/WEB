import type { ViewMode, WorkspaceConfig } from "../types";

type SidebarProps = {
  viewMode: ViewMode;
  onSelectView: (view: ViewMode) => void;
  config: WorkspaceConfig;
  onOpenSettings: () => void;
  itemCount: number;
  userName: string;
  isDemoMode: boolean;
  onSignOut: () => void;
  isOpenOnMobile: boolean;
  onCloseMobile: () => void;
  onToggleDarkMode: () => void;
};

export default function Sidebar({
  viewMode,
  onSelectView,
  config,
  onOpenSettings,
  itemCount,
  userName,
  isDemoMode,
  onSignOut,
  isOpenOnMobile,
  onCloseMobile,
  onToggleDarkMode,
}: SidebarProps) {
  const userInitial = (userName.trim()[0] || "U").toUpperCase();

  return (
    <>
      {isOpenOnMobile && (
        <div
          className="sidebar-backdrop"
          onClick={onCloseMobile}
          aria-hidden="true"
        />
      )}
      <aside
        className={`sidebar ${isOpenOnMobile ? "sidebar-mobile-open" : ""}`}
      >
        <div className="sidebar-header">
          <div className="brand-lockup">
            <span className="brand-mark">W</span>
            <span className="brand-name">
              WEB<span className="brand-dot">.</span>
            </span>
          </div>
          <button
            className="mobile-close-btn"
            onClick={onCloseMobile}
            aria-label="Close menu"
            type="button"
          >
            ✕
          </button>
        </div>

        <button
          className="workspace-switcher"
          onClick={onOpenSettings}
          title="Click to customize workspace name, entity type, and theme"
          type="button"
        >
          <span className="workspace-icon">
            {config.appName.charAt(0).toUpperCase()}
          </span>
          <span className="workspace-copy">
            <strong>{config.appName}</strong>
            <small>
              {config.entityLabel} Hub · {itemCount} items
            </small>
          </span>
          <span className="switch-settings-hint" title="Settings">
            ⚙
          </span>
        </button>

        <div className="side-label">NAVIGATION</div>
        <nav className="side-nav" aria-label="Main navigation">
          <button
            className={`nav-item ${viewMode === "overview" ? "active" : ""}`}
            onClick={() => {
              onSelectView("overview");
              onCloseMobile();
            }}
            type="button"
          >
            <span className="nav-icon">◫</span>
            <span className="nav-text">Overview</span>
          </button>

          <button
            className={`nav-item ${viewMode === "board" ? "active" : ""}`}
            onClick={() => {
              onSelectView("board");
              onCloseMobile();
            }}
            type="button"
          >
            <span className="nav-icon">▤</span>
            <span className="nav-text">Board View</span>
            <b className="nav-badge">Kanban</b>
          </button>

          <button
            className={`nav-item ${viewMode === "table" ? "active" : ""}`}
            onClick={() => {
              onSelectView("table");
              onCloseMobile();
            }}
            type="button"
          >
            <span className="nav-icon">▧</span>
            <span className="nav-text">{config.entityLabel}s</span>
            <b className="nav-badge">{itemCount}</b>
          </button>

          <button
            className={`nav-item ${viewMode === "reports" ? "active" : ""}`}
            onClick={() => {
              onSelectView("reports");
              onCloseMobile();
            }}
            type="button"
          >
            <span className="nav-icon">▥</span>
            <span className="nav-text">Reports & PDF</span>
          </button>
        </nav>

        <div className="side-label side-label-secondary">CUSTOMIZE</div>
        <div className="side-tools">
          <button
            className="side-action-btn"
            onClick={onOpenSettings}
            type="button"
          >
            <span>⚙</span> Customize Workspace
          </button>
          <button
            className="side-action-btn"
            onClick={onToggleDarkMode}
            type="button"
          >
            <span>{config.darkMode ? "☀" : "☾"}</span>{" "}
            {config.darkMode ? "Light Theme" : "Dark Theme"}
          </button>
        </div>

        <div className="sidebar-bottom">
          <div className="side-label">ACCOUNT</div>
          <div className="user-row">
            <span className="avatar">{userInitial}</span>
            <span className="workspace-copy">
              <strong>{userName}</strong>
              <small>
                {isDemoMode ? "Guest / Demo Mode" : "Verified Member"}
              </small>
            </span>
            <button
              className="logout-button"
              onClick={onSignOut}
              title={isDemoMode ? "Switch to Sign In" : "Sign out"}
              aria-label={isDemoMode ? "Switch to Sign In" : "Sign out"}
              type="button"
            >
              ⎋
            </button>
          </div>
          <div className="sidebar-version">
            <span>{config.entityLabel.toUpperCase()} HUB</span>
            <span className="version-pill">v2.0 · Flexible</span>
          </div>
        </div>
      </aside>
    </>
  );
}
