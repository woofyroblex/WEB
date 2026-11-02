import { lazy, Suspense, useEffect, useMemo, useState } from "react";
import AuthView from "./components/AuthView";
import ItemModal from "./components/ItemModal";
import KanbanBoard from "./components/KanbanBoard";
import MetricCards from "./components/MetricCards";
import ProjectTable from "./components/ProjectTable";
import Sidebar from "./components/Sidebar";
import TopNavbar from "./components/TopNavbar";
import WorkspaceSettingsModal from "./components/WorkspaceSettingsModal";
import {
  DEFAULT_WORKSPACE_CONFIG,
  encodeProjectDescription,
  exportProjectsToCSV,
  exportProjectsToJSON,
  INITIAL_DEMO_DASHBOARD,
  INITIAL_DEMO_PROJECTS,
  parseProjectMetadata,
} from "./mockData";
import type {
  ApiErrorBody,
  DashboardData,
  DomainPreset,
  Priority,
  Project,
  ProjectStatus,
  TokenPair,
  ViewMode,
  WorkspaceConfig,
} from "./types";
import "./App.css";

const ProjectChart = lazy(() => import("./ProjectChart"));

const API_BASE = (import.meta.env.VITE_API_BASE_URL || "/api").replace(
  /\/$/,
  "",
);
const SESSION_KEY = "web-project-hub-session";
const USER_KEY = "web-project-hub-user";
const CONFIG_KEY = "web-workspace-config";
const DEMO_PROJECTS_KEY = "web-demo-projects";
const DEMO_MODE_KEY = "web-is-demo-mode";

class ApiError extends Error {
  status: number;

  constructor(message: string, status: number) {
    super(message);
    this.name = "ApiError";
    this.status = status;
  }
}

function readSavedTokens(): TokenPair | null {
  try {
    const value = sessionStorage.getItem(SESSION_KEY);
    return value ? (JSON.parse(value) as TokenPair) : null;
  } catch {
    return null;
  }
}

function readSavedConfig(): WorkspaceConfig {
  try {
    const value = localStorage.getItem(CONFIG_KEY);
    return value
      ? { ...DEFAULT_WORKSPACE_CONFIG, ...JSON.parse(value) }
      : DEFAULT_WORKSPACE_CONFIG;
  } catch {
    return DEFAULT_WORKSPACE_CONFIG;
  }
}

function readDemoProjects(): Project[] {
  try {
    const value = localStorage.getItem(DEMO_PROJECTS_KEY);
    if (value) {
      return JSON.parse(value) as Project[];
    }
  } catch {
    // fallback
  }
  return INITIAL_DEMO_PROJECTS;
}

function getErrorMessage(body: unknown): string {
  if (typeof body === "string") return body;
  if (body && typeof body === "object") {
    const values = Object.values(body as ApiErrorBody);
    const message = values.find((value) => typeof value === "string");
    if (typeof message === "string") return message;
    if (Array.isArray(values[0]))
      return String(values[0][0] ?? "Request failed.");
  }
  return "Request failed. Please try again.";
}

async function authorizedResponse(
  path: string,
  tokens: TokenPair,
  onTokensChanged: (tokens: TokenPair) => void,
  init: RequestInit = {},
): Promise<Response> {
  const send = (access: string) => {
    const headers = new Headers(init.headers);
    headers.set("Authorization", `Bearer ${access}`);
    if (init.body && !headers.has("Content-Type")) {
      headers.set("Content-Type", "application/json");
    }
    return fetch(`${API_BASE}${path}`, { ...init, headers });
  };

  let response = await send(tokens.access);
  if (response.status === 401) {
    const refreshResponse = await fetch(`${API_BASE}/auth/token/refresh/`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ refresh: tokens.refresh }),
    });
    if (!refreshResponse.ok) {
      throw new ApiError("Your session expired. Please sign in again.", 401);
    }
    const refreshed = (await refreshResponse.json()) as { access: string };
    const nextTokens = { ...tokens, access: refreshed.access };
    sessionStorage.setItem(SESSION_KEY, JSON.stringify(nextTokens));
    onTokensChanged(nextTokens);
    response = await send(nextTokens.access);
  }

  if (!response.ok) {
    const body = (await response.json().catch(() => null)) as unknown;
    throw new ApiError(getErrorMessage(body), response.status);
  }
  return response;
}

async function requestJson<T>(
  path: string,
  tokens: TokenPair,
  onTokensChanged: (tokens: TokenPair) => void,
  init?: RequestInit,
): Promise<T> {
  const response = await authorizedResponse(
    path,
    tokens,
    onTokensChanged,
    init,
  );
  if (response.status === 204) return undefined as T;
  return (await response.json()) as T;
}

export default function App() {
  const [tokens, setTokens] = useState<TokenPair | null>(readSavedTokens);
  const [isDemoMode, setIsDemoMode] = useState<boolean>(() => {
    return (
      Boolean(localStorage.getItem(DEMO_MODE_KEY) === "true") ||
      !readSavedTokens()
    );
  });
  const [config, setConfig] = useState<WorkspaceConfig>(readSavedConfig);
  const [viewMode, setViewMode] = useState<ViewMode>("overview");
  const [searchQuery, setSearchQuery] = useState("");

  const [projects, setProjects] = useState<Project[]>(() => {
    return isDemoMode ? readDemoProjects() : [];
  });
  const [dashboard, setDashboard] = useState<DashboardData | null>(() => {
    return isDemoMode ? INITIAL_DEMO_DASHBOARD : null;
  });

  const [isLoading, setIsLoading] = useState(
    () => Boolean(readSavedTokens()) && !isDemoMode,
  );
  const [isAuthBusy, setIsAuthBusy] = useState(false);
  const [isSaving, setIsSaving] = useState(false);
  const [userName, setUserName] = useState(
    () => sessionStorage.getItem(USER_KEY) ?? "Guest User",
  );
  const [message, setMessage] = useState("");
  const [error, setError] = useState("");

  // Modals state
  const [isItemModalOpen, setIsItemModalOpen] = useState(false);
  const [projectToEdit, setProjectToEdit] = useState<Project | null>(null);
  const [itemDefaultStatus, setItemDefaultStatus] =
    useState<ProjectStatus>("backlog");
  const [isSettingsOpen, setIsSettingsOpen] = useState(false);
  const [isMobileSidebarOpen, setIsMobileSidebarOpen] = useState(false);

  // Sync config to localStorage
  useEffect(() => {
    try {
      localStorage.setItem(CONFIG_KEY, JSON.stringify(config));
    } catch {
      // ignore
    }
  }, [config]);

  // Sync demo projects to localStorage
  useEffect(() => {
    if (isDemoMode) {
      try {
        localStorage.setItem(DEMO_PROJECTS_KEY, JSON.stringify(projects));
      } catch {
        // ignore
      }
    }
  }, [projects, isDemoMode]);

  function persistTokens(nextTokens: TokenPair | null) {
    if (nextTokens) {
      sessionStorage.setItem(SESSION_KEY, JSON.stringify(nextTokens));
      localStorage.setItem(DEMO_MODE_KEY, "false");
      setIsDemoMode(false);
    } else {
      sessionStorage.removeItem(SESSION_KEY);
    }
    setIsLoading(Boolean(nextTokens));
    setTokens(nextTokens);
  }

  function signOut() {
    persistTokens(null);
    sessionStorage.removeItem(USER_KEY);
    setUserName("Guest User");
    setProjects([]);
    setDashboard(null);
    setError("");
    setMessage("");
    setIsDemoMode(false);
    localStorage.removeItem(DEMO_MODE_KEY);
  }

  function enterDemoMode() {
    setIsDemoMode(true);
    localStorage.setItem(DEMO_MODE_KEY, "true");
    setUserName("Demo Explorer");
    const demoItems = readDemoProjects();
    setProjects(demoItems);
    setDashboard({
      total: demoItems.length,
      backlog: demoItems.filter((p) => p.status === "backlog").length,
      in_progress: demoItems.filter((p) => p.status === "in_progress").length,
      completed: demoItems.filter((p) => p.status === "completed").length,
      snapshots: INITIAL_DEMO_DASHBOARD.snapshots,
    });
    setError("");
    setMessage(
      "Welcome to Demo Mode. You can fully test, customize, and build.",
    );
  }

  function toggleDemoMode() {
    if (isDemoMode) {
      if (tokens) {
        setIsDemoMode(false);
        localStorage.setItem(DEMO_MODE_KEY, "false");
        setMessage("Switched to Live API mode.");
      } else {
        signOut();
      }
    } else {
      enterDemoMode();
    }
  }

  // Load from API when signed in
  useEffect(() => {
    if (!tokens || isDemoMode) {
      return;
    }

    let isMounted = true;

    Promise.all([
      requestJson<Project[]>("/projects/", tokens, persistTokens),
      requestJson<DashboardData>("/dashboard/", tokens, persistTokens),
    ])
      .then(([nextProjects, nextDashboard]) => {
        if (!isMounted) return;
        const parsedProjects = nextProjects.map((p) => {
          const { cleanDescription, priority, tags } = parseProjectMetadata(
            p.description,
          );
          return {
            ...p,
            description: cleanDescription,
            priority: priority || "medium",
            tags: tags || [],
          };
        });
        setProjects(parsedProjects);
        setDashboard(nextDashboard);
        setError("");
      })
      .catch((requestError: unknown) => {
        if (!isMounted) return;
        if (requestError instanceof ApiError && requestError.status === 401) {
          signOut();
        } else {
          setError(
            requestError instanceof Error
              ? requestError.message
              : "Could not connect to the project API. You can switch to Demo Mode above.",
          );
        }
      })
      .finally(() => {
        if (isMounted) setIsLoading(false);
      });

    return () => {
      isMounted = false;
    };
  }, [tokens, isDemoMode]);

  async function handleSignIn(username: string, password: string) {
    setIsAuthBusy(true);
    setError("");
    setMessage("");
    try {
      const tokenResponse = await fetch(`${API_BASE}/auth/token/`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ username, password }),
      });
      const tokenBody = (await tokenResponse
        .json()
        .catch(() => null)) as unknown;
      if (!tokenResponse.ok) {
        throw new ApiError(getErrorMessage(tokenBody), tokenResponse.status);
      }
      sessionStorage.setItem(USER_KEY, username.trim());
      setUserName(username.trim());
      persistTokens(tokenBody as TokenPair);
      setMessage("Welcome back.");
    } catch (authError) {
      setError(
        authError instanceof Error
          ? authError.message
          : "Unable to sign in. Check credentials or try Instant Demo Mode below.",
      );
    } finally {
      setIsAuthBusy(false);
    }
  }

  async function handleRegister(
    username: string,
    email: string,
    password: string,
  ) {
    setIsAuthBusy(true);
    setError("");
    setMessage("");
    try {
      const registerResponse = await fetch(`${API_BASE}/auth/register/`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ username, email, password }),
      });
      const registerBody = (await registerResponse
        .json()
        .catch(() => null)) as unknown;
      if (!registerResponse.ok) {
        throw new ApiError(
          getErrorMessage(registerBody),
          registerResponse.status,
        );
      }

      await handleSignIn(username, password);
    } catch (authError) {
      setError(
        authError instanceof Error ? authError.message : "Registration failed.",
      );
      setIsAuthBusy(false);
    }
  }

  async function handleCreateOrUpdateProject(data: {
    title: string;
    description: string;
    status: ProjectStatus;
    priority: Priority;
    tags: string[];
    id?: number;
  }) {
    setIsSaving(true);
    setError("");
    setMessage("");

    try {
      if (isDemoMode || !tokens) {
        // Local mode handling
        if (data.id) {
          // Update
          setProjects((curr) =>
            curr.map((p) =>
              p.id === data.id
                ? {
                    ...p,
                    title: data.title,
                    description: data.description,
                    status: data.status,
                    priority: data.priority,
                    tags: data.tags,
                    updated_at: new Date().toISOString(),
                  }
                : p,
            ),
          );
          setMessage(`${config.entityLabel} updated.`);
        } else {
          // Create
          const newProject: Project = {
            id: Date.now(),
            title: data.title,
            description: data.description,
            status: data.status,
            priority: data.priority,
            tags: data.tags,
            created_at: new Date().toISOString(),
            updated_at: new Date().toISOString(),
          };
          setProjects((curr) => [newProject, ...curr]);
          setMessage(`${config.entityLabel} added to workspace.`);
        }
      } else {
        // Backend API handling
        const encodedDesc = encodeProjectDescription(
          data.description,
          data.priority,
          data.tags,
        );

        if (data.id) {
          // PATCH existing
          const updated = await requestJson<Project>(
            `/projects/${data.id}/`,
            tokens,
            persistTokens,
            {
              method: "PATCH",
              body: JSON.stringify({
                title: data.title,
                description: encodedDesc,
                status: data.status,
              }),
            },
          );
          setProjects((curr) =>
            curr.map((p) =>
              p.id === updated.id
                ? {
                    ...updated,
                    description: data.description,
                    priority: data.priority,
                    tags: data.tags,
                  }
                : p,
            ),
          );
          setMessage(`${config.entityLabel} updated.`);
        } else {
          // POST new
          const created = await requestJson<Project>(
            "/projects/",
            tokens,
            persistTokens,
            {
              method: "POST",
              body: JSON.stringify({
                title: data.title,
                description: encodedDesc,
                status: data.status,
              }),
            },
          );
          setProjects((curr) => [
            {
              ...created,
              description: data.description,
              priority: data.priority,
              tags: data.tags,
            },
            ...curr,
          ]);
          setMessage(`${config.entityLabel} created.`);
        }

        // Refresh dashboard from API
        const nextDashboard = await requestJson<DashboardData>(
          "/dashboard/",
          tokens,
          persistTokens,
        );
        setDashboard(nextDashboard);
      }
    } catch (err) {
      setError(
        err instanceof Error
          ? err.message
          : `Failed to save ${config.entityLabel}.`,
      );
      throw err;
    } finally {
      setIsSaving(false);
    }
  }

  async function handleStatusChange(
    project: Project,
    newStatus: ProjectStatus,
  ) {
    if (project.status === newStatus) return;

    // Optimistic UI update
    setProjects((curr) =>
      curr.map((p) =>
        p.id === project.id
          ? { ...p, status: newStatus, updated_at: new Date().toISOString() }
          : p,
      ),
    );

    if (isDemoMode || !tokens) {
      setMessage(`Status updated to ${newStatus.replace("_", " ")}.`);
      return;
    }

    try {
      await requestJson<Project>(
        `/projects/${project.id}/`,
        tokens,
        persistTokens,
        {
          method: "PATCH",
          body: JSON.stringify({ status: newStatus }),
        },
      );
      const nextDashboard = await requestJson<DashboardData>(
        "/dashboard/",
        tokens,
        persistTokens,
      );
      setDashboard(nextDashboard);
      setMessage(`Status updated.`);
      setError("");
    } catch (err) {
      setError(err instanceof Error ? err.message : "Could not update status.");
    }
  }

  async function handleDeleteProject(project: Project) {
    if (
      !window.confirm(
        `Delete “${project.title}” from your ${config.entityLabel.toLowerCase()}s?`,
      )
    ) {
      return;
    }

    setProjects((curr) => curr.filter((p) => p.id !== project.id));
    setMessage(`${config.entityLabel} deleted.`);

    if (isDemoMode || !tokens) return;

    try {
      await requestJson<void>(
        `/projects/${project.id}/`,
        tokens,
        persistTokens,
        { method: "DELETE" },
      );
      const nextDashboard = await requestJson<DashboardData>(
        "/dashboard/",
        tokens,
        persistTokens,
      );
      setDashboard(nextDashboard);
    } catch (err) {
      setError(
        err instanceof Error ? err.message : "Could not delete project.",
      );
    }
  }

  async function handleSnapshot() {
    setMessage("");
    setError("");

    if (isDemoMode || !tokens) {
      const today = new Date().toISOString().slice(0, 10);
      const newSnapshot = {
        day: today,
        backlog_count: projects.filter((p) => p.status === "backlog").length,
        in_progress_count: projects.filter((p) => p.status === "in_progress")
          .length,
        completed_count: projects.filter((p) => p.status === "completed")
          .length,
        total_count: projects.length,
      };
      setDashboard((curr) => ({
        total: projects.length,
        backlog: newSnapshot.backlog_count,
        in_progress: newSnapshot.in_progress_count,
        completed: newSnapshot.completed_count,
        snapshots: [
          ...(curr?.snapshots?.filter((s) => s.day !== today) ?? []),
          newSnapshot,
        ],
      }));
      setMessage("Snapshot recorded. Your status history has been updated.");
      return;
    }

    try {
      await requestJson<{ task_id: string; status: string }>(
        "/dashboard/",
        tokens,
        persistTokens,
        { method: "POST" },
      );
      setMessage(
        "Celery snapshot queued. The worker will record today’s metrics.",
      );
    } catch (requestError) {
      setError(
        requestError instanceof Error
          ? requestError.message
          : "Could not queue snapshot.",
      );
    }
  }

  async function handlePdfDownload() {
    setError("");
    if (!tokens || isDemoMode) {
      window.print();
      setMessage("Print / PDF dialogue opened.");
      return;
    }

    try {
      const response = await authorizedResponse(
        "/reports/projects.pdf",
        tokens,
        persistTokens,
      );
      const objectUrl = URL.createObjectURL(await response.blob());
      const link = document.createElement("a");
      link.href = objectUrl;
      link.download = `${config.entityLabel.toLowerCase()}-report.pdf`;
      link.click();
      URL.revokeObjectURL(objectUrl);
      setMessage("Your PDF report is downloaded.");
    } catch (requestError) {
      setError(
        requestError instanceof Error
          ? requestError.message
          : "Could not create PDF report from backend. Opening print dialogue.",
      );
      window.print();
    }
  }

  function handleApplyPreset(preset: DomainPreset) {
    setConfig((curr) => ({
      ...curr,
      appName: preset.appName,
      entityLabel: preset.entityLabel,
      tagline: preset.tagline,
      theme: preset.theme,
    }));

    if (isDemoMode) {
      const newItems: Project[] = preset.projects.map((p, index) => ({
        id: Date.now() + index,
        title: p.title,
        description: p.description,
        status: p.status,
        priority: p.priority,
        tags: p.tags,
        created_at: new Date().toISOString(),
        updated_at: new Date().toISOString(),
      }));
      setProjects(newItems);
      setMessage(`Applied domain preset: “${preset.name}”`);
    } else {
      setMessage(`Switched workspace configuration to “${preset.name}”`);
    }
  }

  function handleResetSampleData() {
    const fresh = INITIAL_DEMO_PROJECTS.map((p, i) => ({
      ...p,
      id: Date.now() + i,
      updated_at: new Date().toISOString(),
    }));
    setProjects(fresh);
    setMessage("Starter projects restored.");
  }

  // Filtered projects for search
  const searchedProjects = useMemo(() => {
    if (!searchQuery.trim()) return projects;
    const q = searchQuery.toLowerCase();
    return projects.filter(
      (p) =>
        p.title.toLowerCase().includes(q) ||
        p.description.toLowerCase().includes(q) ||
        p.tags?.some((t) => t.toLowerCase().includes(q)) ||
        p.status.toLowerCase().includes(q) ||
        (p.priority && p.priority.toLowerCase().includes(q)),
    );
  }, [projects, searchQuery]);

  // Chart data
  const chartData = useMemo(() => {
    const backlogCount = projects.filter((p) => p.status === "backlog").length;
    const progressCount = projects.filter(
      (p) => p.status === "in_progress",
    ).length;
    const completedCount = projects.filter(
      (p) => p.status === "completed",
    ).length;

    return [
      { name: "Backlog", count: backlogCount, fill: "#94a3b8" },
      { name: "In progress", count: progressCount, fill: "#38bdf8" },
      { name: "Completed", count: completedCount, fill: "#10b981" },
    ];
  }, [projects]);

  // If not authenticated and not in demo mode, show Auth
  if (!tokens && !isDemoMode) {
    return (
      <AuthView
        onSignIn={handleSignIn}
        onRegister={handleRegister}
        onEnterDemoMode={enterDemoMode}
        isBusy={isAuthBusy}
        error={error}
        message={message}
        config={config}
      />
    );
  }

  return (
    <div
      className={`app-root theme-${config.theme} ${config.darkMode ? "dark-theme" : ""}`}
    >
      <Sidebar
        viewMode={viewMode}
        onSelectView={setViewMode}
        config={config}
        onOpenSettings={() => setIsSettingsOpen(true)}
        itemCount={projects.length}
        userName={userName}
        isDemoMode={isDemoMode}
        onSignOut={signOut}
        isOpenOnMobile={isMobileSidebarOpen}
        onCloseMobile={() => setIsMobileSidebarOpen(false)}
        onToggleDarkMode={() =>
          setConfig((c) => ({ ...c, darkMode: !c.darkMode }))
        }
      />

      <div className="main-panel">
        <TopNavbar
          viewMode={viewMode}
          config={config}
          searchQuery={searchQuery}
          onSearchChange={setSearchQuery}
          isDemoMode={isDemoMode}
          onToggleDemoMode={toggleDemoMode}
          onOpenNewModal={() => {
            setProjectToEdit(null);
            setItemDefaultStatus("backlog");
            setIsItemModalOpen(true);
          }}
          onOpenSettings={() => setIsSettingsOpen(true)}
          onExportCSV={() => exportProjectsToCSV(projects, config.entityLabel)}
          onExportJSON={() =>
            exportProjectsToJSON(projects, config.entityLabel)
          }
          onToggleMobileMenu={() => setIsMobileSidebarOpen((prev) => !prev)}
          userName={userName}
        />

        <main className="page-content">
          {error && (
            <div className="notice notice-error" role="alert">
              <span className="notice-icon">⚠</span>
              <span>{error}</span>
              {isDemoMode ? null : (
                <button
                  className="notice-link-btn"
                  onClick={enterDemoMode}
                  type="button"
                >
                  Switch to Demo Mode
                </button>
              )}
            </div>
          )}

          {message && (
            <div className="notice notice-success" role="status">
              <span className="notice-icon">✓</span>
              <span>{message}</span>
            </div>
          )}

          {/* VIEW 1: OVERVIEW */}
          {viewMode === "overview" && (
            <>
              <section className="welcome-row">
                <div>
                  <span className="eyebrow">
                    FLEXIBLE ADAPTIVE WORKSPACE · READY FOR ANY CHALLENGE
                  </span>
                  <h1>
                    {config.appName} <span className="accent-mark">✳</span>
                  </h1>
                  <p>
                    {config.tagline ||
                      "Organize, track momentum, and deliver results."}
                  </p>
                </div>
                <div className="welcome-actions">
                  <button
                    className="button button-outline"
                    onClick={handlePdfDownload}
                    type="button"
                  >
                    <span>↓</span> Export Report
                  </button>
                  <button
                    className="button button-primary"
                    onClick={() => {
                      setProjectToEdit(null);
                      setItemDefaultStatus("backlog");
                      setIsItemModalOpen(true);
                    }}
                    type="button"
                  >
                    <span>＋</span> Add {config.entityLabel}
                  </button>
                </div>
              </section>

              <MetricCards
                dashboard={dashboard}
                projects={projects}
                isLoading={isLoading}
                config={config}
              />

              <section className="overview-grid">
                <article className="panel chart-panel">
                  <div className="panel-heading">
                    <div>
                      <span className="eyebrow">DISTRIBUTION & HEALTH</span>
                      <h2>{config.entityLabel} Pipeline Status</h2>
                    </div>
                    <span className="period-chip">
                      Live Telemetry <i>⌄</i>
                    </span>
                  </div>

                  <div className="chart-legend">
                    <span>
                      <i className="legend-backlog" /> Backlog
                    </span>
                    <span>
                      <i className="legend-progress" /> In progress
                    </span>
                    <span>
                      <i className="legend-complete" /> Completed
                    </span>
                  </div>

                  <div className="chart-wrap">
                    <Suspense
                      fallback={
                        <div className="chart-loading">Loading chart…</div>
                      }
                    >
                      <ProjectChart data={chartData} />
                    </Suspense>
                  </div>

                  <div className="chart-caption">
                    <span>
                      <b>{projects.length}</b> total{" "}
                      {config.entityLabel.toLowerCase()}s recorded
                    </span>
                    <span>Real-time status updates sync across views</span>
                  </div>
                </article>

                <article className="panel quick-panel">
                  <div className="panel-heading">
                    <div>
                      <span className="eyebrow">AUTOMATION & SNAPSHOTS</span>
                      <h2>Daily Metric Log</h2>
                    </div>
                    <span className="automation-mark">✳</span>
                  </div>
                  <p className="quick-copy">
                    Capture daily project metrics and snapshot history.
                    Supported by Celery Beat schedules in production and local
                    telemetry in demo mode.
                  </p>
                  <div className="snapshot-status">
                    <span className="snapshot-icon">◷</span>
                    <span>
                      <strong>{dashboard?.snapshots?.length ?? 1}</strong>{" "}
                      snapshots recorded
                    </span>
                  </div>
                  <button
                    className="button button-primary button-wide"
                    onClick={handleSnapshot}
                    type="button"
                  >
                    Record Snapshot Now <span>→</span>
                  </button>
                  <div className="quick-foot">
                    <i /> Celery + Redis + Postgres pipeline
                  </div>
                </article>
              </section>

              <div className="section-title-row overview-table-header">
                <div>
                  <span className="eyebrow">DIRECT WORKSPACE ACCESS</span>
                  <h2>
                    Active {config.entityLabel}s{" "}
                    <span className="count-pill">
                      {searchedProjects.length}
                    </span>
                  </h2>
                </div>
                <div className="view-switch-links">
                  <button
                    className="button button-outline button-sm"
                    onClick={() => setViewMode("board")}
                    type="button"
                  >
                    Switch to Kanban Board →
                  </button>
                </div>
              </div>

              <ProjectTable
                projects={searchedProjects}
                config={config}
                onStatusChange={handleStatusChange}
                onEditProject={(p) => {
                  setProjectToEdit(p);
                  setIsItemModalOpen(true);
                }}
                onDeleteProject={handleDeleteProject}
                onOpenCreateModal={() => {
                  setProjectToEdit(null);
                  setItemDefaultStatus("backlog");
                  setIsItemModalOpen(true);
                }}
                onResetSampleData={handleResetSampleData}
              />
            </>
          )}

          {/* VIEW 2: KANBAN BOARD */}
          {viewMode === "board" && (
            <div className="board-view-container">
              <div className="section-title-row">
                <div>
                  <span className="eyebrow">VISUAL PIPELINE</span>
                  <h2>
                    {config.entityLabel} Board (Kanban){" "}
                    <span className="count-pill">
                      {searchedProjects.length}
                    </span>
                  </h2>
                </div>
                <div className="board-header-actions">
                  <span className="board-drag-hint">
                    Tip: Drag cards between columns to change status
                  </span>
                  <button
                    className="button button-primary button-sm"
                    onClick={() => {
                      setProjectToEdit(null);
                      setItemDefaultStatus("backlog");
                      setIsItemModalOpen(true);
                    }}
                    type="button"
                  >
                    ＋ New {config.entityLabel}
                  </button>
                </div>
              </div>

              <KanbanBoard
                projects={searchedProjects}
                config={config}
                onStatusChange={handleStatusChange}
                onEditProject={(p) => {
                  setProjectToEdit(p);
                  setIsItemModalOpen(true);
                }}
                onDeleteProject={handleDeleteProject}
                onAddNewToStatus={(status) => {
                  setProjectToEdit(null);
                  setItemDefaultStatus(status);
                  setIsItemModalOpen(true);
                }}
              />
            </div>
          )}

          {/* VIEW 3: TABLE DIRECTORY */}
          {viewMode === "table" && (
            <div className="table-view-container">
              <div className="section-title-row">
                <div>
                  <span className="eyebrow">DATA MATRIX</span>
                  <h2>
                    {config.entityLabel} Directory{" "}
                    <span className="count-pill">
                      {searchedProjects.length}
                    </span>
                  </h2>
                </div>
                <button
                  className="button button-primary button-sm"
                  onClick={() => {
                    setProjectToEdit(null);
                    setItemDefaultStatus("backlog");
                    setIsItemModalOpen(true);
                  }}
                  type="button"
                >
                  ＋ Add {config.entityLabel}
                </button>
              </div>

              <ProjectTable
                projects={searchedProjects}
                config={config}
                onStatusChange={handleStatusChange}
                onEditProject={(p) => {
                  setProjectToEdit(p);
                  setIsItemModalOpen(true);
                }}
                onDeleteProject={handleDeleteProject}
                onOpenCreateModal={() => {
                  setProjectToEdit(null);
                  setItemDefaultStatus("backlog");
                  setIsItemModalOpen(true);
                }}
                onResetSampleData={handleResetSampleData}
              />
            </div>
          )}

          {/* VIEW 4: REPORTS & ANALYTICS */}
          {viewMode === "reports" && (
            <div className="reports-view-container">
              <div className="section-title-row">
                <div>
                  <span className="eyebrow">EXPORT & INSIGHTS</span>
                  <h2>Audit & Telemetry Reports</h2>
                </div>
                <div className="reports-top-buttons">
                  <button
                    className="button button-primary"
                    onClick={handlePdfDownload}
                    type="button"
                  >
                    <span>↓</span> Generate Official PDF Report
                  </button>
                  <button
                    className="button button-outline"
                    onClick={() =>
                      exportProjectsToCSV(projects, config.entityLabel)
                    }
                    type="button"
                  >
                    Download CSV
                  </button>
                </div>
              </div>

              <MetricCards
                dashboard={dashboard}
                projects={projects}
                isLoading={isLoading}
                config={config}
              />

              <div className="overview-grid">
                <article className="panel">
                  <div className="panel-heading">
                    <div>
                      <span className="eyebrow">MOMENTUM</span>
                      <h2>Historical Trajectory</h2>
                    </div>
                  </div>
                  <div className="chart-wrap">
                    <Suspense fallback={<div>Loading chart…</div>}>
                      <ProjectChart data={chartData} />
                    </Suspense>
                  </div>
                </article>

                <article className="panel">
                  <div className="panel-heading">
                    <div>
                      <span className="eyebrow">TELEMETRY</span>
                      <h2>System Health & Architecture</h2>
                    </div>
                  </div>
                  <div className="system-health-list">
                    <div className="health-item">
                      <span>Frontend Framework</span>
                      <strong>React 19 + TypeScript + Vite</strong>
                    </div>
                    <div className="health-item">
                      <span>Backend REST API</span>
                      <strong>Django REST Framework 3.15</strong>
                    </div>
                    <div className="health-item">
                      <span>Worker & Scheduler</span>
                      <strong>Celery 5.4 + Celery Beat</strong>
                    </div>
                    <div className="health-item">
                      <span>Document Engine</span>
                      <strong>WeasyPrint PDF Generator</strong>
                    </div>
                    <div className="health-item">
                      <span>Runtime Mode</span>
                      <strong className={isDemoMode ? "tag-demo" : "tag-live"}>
                        {isDemoMode
                          ? "Local Zero-Setup Demo"
                          : "Full Stack Docker"}
                      </strong>
                    </div>
                  </div>
                </article>
              </div>
            </div>
          )}

          <footer className="page-footer">
            <span>
              {config.appName} · Clean & Flexible Architecture for Any Problem
              Statement
            </span>
            <div className="footer-links">
              <button
                className="footer-btn"
                onClick={() => setIsSettingsOpen(true)}
                type="button"
              >
                Domain Settings
              </button>
              <span>·</span>
              <button
                className="footer-btn"
                onClick={() =>
                  setConfig((c) => ({ ...c, darkMode: !c.darkMode }))
                }
                type="button"
              >
                {config.darkMode ? "Light Mode" : "Dark Mode"}
              </button>
            </div>
          </footer>
        </main>
      </div>

      {/* MODALS */}
      <ItemModal
        isOpen={isItemModalOpen}
        onClose={() => setIsItemModalOpen(false)}
        projectToEdit={projectToEdit}
        defaultStatus={itemDefaultStatus}
        config={config}
        onSave={handleCreateOrUpdateProject}
        isSaving={isSaving}
      />

      <WorkspaceSettingsModal
        isOpen={isSettingsOpen}
        onClose={() => setIsSettingsOpen(false)}
        config={config}
        onSaveConfig={setConfig}
        onApplyPreset={handleApplyPreset}
      />
    </div>
  );
}
