import { lazy, Suspense, useEffect, useMemo, useState } from "react";
import type { FormEvent } from "react";
import "./App.css";

const ProjectChart = lazy(() => import("./ProjectChart"));

type ProjectStatus = "backlog" | "in_progress" | "completed";

type Project = {
  id: number;
  title: string;
  description: string;
  status: ProjectStatus;
  created_at: string;
  updated_at: string;
};

type Snapshot = {
  day: string;
  backlog_count: number;
  in_progress_count: number;
  completed_count: number;
  total_count: number;
};

type DashboardData = {
  total: number;
  backlog: number;
  in_progress: number;
  completed: number;
  snapshots: Snapshot[];
};

type TokenPair = { access: string; refresh: string };

type ApiErrorBody = {
  detail?: string;
  [key: string]: unknown;
};

const API_BASE = (import.meta.env.VITE_API_BASE_URL || "/api").replace(
  /\/$/,
  "",
);
const SESSION_KEY = "web-project-hub-session";
const USER_KEY = "web-project-hub-user";
const TODAY_LABEL = new Intl.DateTimeFormat("en", { weekday: "long" })
  .format(new Date())
  .toUpperCase();

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

function formatDate(date: string): string {
  return new Intl.DateTimeFormat("en", {
    month: "short",
    day: "numeric",
    year: "numeric",
  }).format(new Date(date));
}

function App() {
  const [tokens, setTokens] = useState<TokenPair | null>(readSavedTokens);
  const [projects, setProjects] = useState<Project[]>([]);
  const [dashboard, setDashboard] = useState<DashboardData | null>(null);
  const [isLoading, setIsLoading] = useState(() => Boolean(readSavedTokens()));
  const [isAuthBusy, setIsAuthBusy] = useState(false);
  const [isSaving, setIsSaving] = useState(false);
  const [isRegistering, setIsRegistering] = useState(false);
  const [authUsername, setAuthUsername] = useState(
    () => sessionStorage.getItem(USER_KEY) ?? "",
  );
  const [authPassword, setAuthPassword] = useState("");
  const [authEmail, setAuthEmail] = useState("");
  const [title, setTitle] = useState("");
  const [description, setDescription] = useState("");
  const [message, setMessage] = useState("");
  const [error, setError] = useState("");

  const chartData = useMemo(
    () => [
      { name: "Backlog", count: dashboard?.backlog ?? 0, fill: "#b8c8be" },
      {
        name: "In progress",
        count: dashboard?.in_progress ?? 0,
        fill: "#70a990",
      },
      { name: "Completed", count: dashboard?.completed ?? 0, fill: "#276d58" },
    ],
    [dashboard],
  );

  function persistTokens(nextTokens: TokenPair | null) {
    if (nextTokens) {
      sessionStorage.setItem(SESSION_KEY, JSON.stringify(nextTokens));
    } else {
      sessionStorage.removeItem(SESSION_KEY);
    }
    setIsLoading(Boolean(nextTokens));
    setTokens(nextTokens);
  }

  function signOut() {
    persistTokens(null);
    sessionStorage.removeItem(USER_KEY);
    setAuthUsername("");
    setProjects([]);
    setDashboard(null);
    setError("");
    setMessage("");
  }

  useEffect(() => {
    if (!tokens) {
      return;
    }

    let isMounted = true;
    Promise.all([
      requestJson<Project[]>("/projects/", tokens, persistTokens),
      requestJson<DashboardData>("/dashboard/", tokens, persistTokens),
    ])
      .then(([nextProjects, nextDashboard]) => {
        if (!isMounted) return;
        setProjects(nextProjects);
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
              : "Could not connect to the project API.",
          );
        }
      })
      .finally(() => {
        if (isMounted) setIsLoading(false);
      });

    return () => {
      isMounted = false;
    };
  }, [tokens]);

  async function handleAuthSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setIsAuthBusy(true);
    setError("");
    setMessage("");

    try {
      if (isRegistering) {
        const registerResponse = await fetch(`${API_BASE}/auth/register/`, {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            username: authUsername,
            email: authEmail,
            password: authPassword,
          }),
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
      }

      const tokenResponse = await fetch(`${API_BASE}/auth/token/`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          username: authUsername,
          password: authPassword,
        }),
      });
      const tokenBody = (await tokenResponse
        .json()
        .catch(() => null)) as unknown;
      if (!tokenResponse.ok) {
        throw new ApiError(getErrorMessage(tokenBody), tokenResponse.status);
      }
      sessionStorage.setItem(USER_KEY, authUsername.trim());
      persistTokens(tokenBody as TokenPair);
      setAuthPassword("");
      setMessage(isRegistering ? "Your workspace is ready." : "Welcome back.");
    } catch (authError) {
      setError(
        authError instanceof Error ? authError.message : "Unable to sign in.",
      );
    } finally {
      setIsAuthBusy(false);
    }
  }

  async function handleCreateProject(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (!tokens || !title.trim()) return;
    setIsSaving(true);
    setError("");
    setMessage("");
    try {
      await requestJson<Project>("/projects/", tokens, persistTokens, {
        method: "POST",
        body: JSON.stringify({
          title: title.trim(),
          description: description.trim(),
        }),
      });
      setTitle("");
      setDescription("");
      const [nextProjects, nextDashboard] = await Promise.all([
        requestJson<Project[]>("/projects/", tokens, persistTokens),
        requestJson<DashboardData>("/dashboard/", tokens, persistTokens),
      ]);
      setProjects(nextProjects);
      setDashboard(nextDashboard);
      setMessage("Project added to your workspace.");
    } catch (requestError) {
      setError(
        requestError instanceof Error
          ? requestError.message
          : "Could not create project.",
      );
    } finally {
      setIsSaving(false);
    }
  }

  async function handleStatusChange(project: Project, status: ProjectStatus) {
    if (!tokens || status === project.status) return;
    try {
      const updated = await requestJson<Project>(
        `/projects/${project.id}/`,
        tokens,
        persistTokens,
        { method: "PATCH", body: JSON.stringify({ status }) },
      );
      setProjects((current) =>
        current.map((item) => (item.id === updated.id ? updated : item)),
      );
      const nextDashboard = await requestJson<DashboardData>(
        "/dashboard/",
        tokens,
        persistTokens,
      );
      setDashboard(nextDashboard);
      setMessage("Project status updated.");
      setError("");
    } catch (requestError) {
      setError(
        requestError instanceof Error
          ? requestError.message
          : "Could not update project.",
      );
    }
  }

  async function handleDeleteProject(project: Project) {
    if (
      !tokens ||
      !window.confirm(`Delete “${project.title}” from your workspace?`)
    ) {
      return;
    }
    try {
      await requestJson<void>(
        `/projects/${project.id}/`,
        tokens,
        persistTokens,
        { method: "DELETE" },
      );
      const [nextProjects, nextDashboard] = await Promise.all([
        requestJson<Project[]>("/projects/", tokens, persistTokens),
        requestJson<DashboardData>("/dashboard/", tokens, persistTokens),
      ]);
      setProjects(nextProjects);
      setDashboard(nextDashboard);
      setMessage("Project deleted.");
      setError("");
    } catch (requestError) {
      setError(
        requestError instanceof Error
          ? requestError.message
          : "Could not delete project.",
      );
    }
  }

  async function handleSnapshot() {
    if (!tokens) return;
    setMessage("");
    setError("");
    try {
      await requestJson<{ task_id: string; status: string }>(
        "/dashboard/",
        tokens,
        persistTokens,
        { method: "POST" },
      );
      setMessage(
        "Snapshot queued. It will appear in the chart after the worker completes it.",
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
    if (!tokens) return;
    setError("");
    try {
      const response = await authorizedResponse(
        "/reports/projects.pdf",
        tokens,
        persistTokens,
      );
      const objectUrl = URL.createObjectURL(await response.blob());
      const link = document.createElement("a");
      link.href = objectUrl;
      link.download = "project-report.pdf";
      link.click();
      URL.revokeObjectURL(objectUrl);
      setMessage("Your PDF report is ready.");
    } catch (requestError) {
      setError(
        requestError instanceof Error
          ? requestError.message
          : "Could not create PDF report.",
      );
    }
  }

  if (!tokens) {
    return (
      <main className="auth-shell">
        <section className="auth-card">
          <div className="brand-lockup">
            <span className="brand-mark">W</span>
            <span>
              WEB<span className="brand-dot">.</span>
            </span>
          </div>
          <div className="auth-intro">
            <span className="eyebrow">YOUR WORKSPACE, IN FOCUS</span>
            <h1>{isRegistering ? "Create your account" : "Welcome back"}</h1>
            <p>Keep projects moving and see what your team is building.</p>
          </div>
          <form className="auth-form" onSubmit={handleAuthSubmit}>
            <label>
              Username
              <input
                autoComplete="username"
                value={authUsername}
                onChange={(event) => setAuthUsername(event.target.value)}
                required
              />
            </label>
            {isRegistering && (
              <label>
                Email
                <input
                  autoComplete="email"
                  type="email"
                  value={authEmail}
                  onChange={(event) => setAuthEmail(event.target.value)}
                  required
                />
              </label>
            )}
            <label>
              Password
              <input
                autoComplete={
                  isRegistering ? "new-password" : "current-password"
                }
                type="password"
                minLength={8}
                value={authPassword}
                onChange={(event) => setAuthPassword(event.target.value)}
                required
              />
            </label>
            {error && <p className="form-error">{error}</p>}
            {message && <p className="form-success">{message}</p>}
            <button
              className="button button-primary button-wide"
              disabled={isAuthBusy}
            >
              {isAuthBusy
                ? "Please wait…"
                : isRegistering
                  ? "Create workspace"
                  : "Sign in"}
            </button>
          </form>
          <p className="auth-switch">
            {isRegistering ? "Already have an account?" : "New to WEB?"}
            <button
              className="text-button"
              onClick={() => {
                setIsRegistering((current) => !current);
                setError("");
              }}
              type="button"
            >
              {isRegistering ? "Sign in" : "Create an account"}
            </button>
          </p>
          <p className="auth-footnote">
            Your projects are private to your account.
          </p>
        </section>
        <aside className="auth-aside">
          <div className="aside-orbit orbit-one" />
          <div className="aside-orbit orbit-two" />
          <div className="aside-content">
            <span className="eyebrow">PROJECTS · PEOPLE · PROGRESS</span>
            <h2>Make the next thing happen.</h2>
            <p>
              A clear home for the work that matters — from the first idea to
              the final handoff.
            </p>
            <div className="aside-note">
              <span className="note-dot" />
              Simple planning, visible momentum.
            </div>
          </div>
          <span className="aside-index">01 — 03</span>
        </aside>
      </main>
    );
  }

  return (
    <main className="app-shell">
      <aside className="sidebar">
        <div className="brand-lockup">
          <span className="brand-mark">W</span>
          <span>
            WEB<span className="brand-dot">.</span>
          </span>
        </div>
        <div className="workspace-switcher">
          <span className="workspace-icon">P</span>
          <span className="workspace-copy">
            <strong>Personal space</strong>
            <small>Workspace</small>
          </span>
          <span className="switch-chevron">⌄</span>
        </div>
        <div className="side-label">WORKSPACE</div>
        <nav className="side-nav" aria-label="Main navigation">
          <a className="nav-item active" href="#overview">
            <span>◫</span> Overview
          </a>
          <a className="nav-item" href="#projects">
            <span>▧</span> Projects <b>{projects.length}</b>
          </a>
          <a className="nav-item" href="#reports">
            <span>▤</span> Reports
          </a>
        </nav>
        <div className="sidebar-bottom">
          <div className="side-label">YOUR ACCOUNT</div>
          <div className="user-row">
            <span className="avatar">
              {authUsername.trim().slice(0, 1).toUpperCase() || "U"}
            </span>
            <span className="workspace-copy">
              <strong>{authUsername || "Workspace member"}</strong>
              <small>Project owner</small>
            </span>
            <button
              className="logout-button"
              onClick={signOut}
              title="Sign out"
              aria-label="Sign out"
            >
              ↗
            </button>
          </div>
          <div className="sidebar-version">
            WEB PROJECT HUB <span>v1.0</span>
          </div>
        </div>
      </aside>

      <section className="main-panel">
        <header className="topbar">
          <div className="breadcrumb">
            Workspace <span>/</span> Overview
          </div>
          <div className="topbar-actions">
            <span className="status-indicator">
              <i /> All systems ready
            </span>
            <button
              className="avatar avatar-small"
              onClick={signOut}
              title="Sign out"
            >
              {authUsername.trim().slice(0, 1).toUpperCase() || "U"}
            </button>
          </div>
        </header>

        <div className="page-content" id="overview">
          <section className="welcome-row">
            <div>
              <span className="eyebrow">
                {TODAY_LABEL}, YOUR WORK AT A GLANCE
              </span>
              <h1>
                Good to see you, {authUsername || "there"} <span>✳</span>
              </h1>
              <p>Here’s what’s moving across your workspace today.</p>
            </div>
            <button
              className="button button-outline"
              onClick={handlePdfDownload}
            >
              <span className="button-icon">↓</span> Export report
            </button>
          </section>

          {error && (
            <div className="notice notice-error" role="alert">
              {error}
            </div>
          )}
          {message && (
            <div className="notice notice-success" role="status">
              {message}
            </div>
          )}

          <section className="metric-grid" aria-label="Project summary">
            <article className="metric-card metric-primary">
              <div className="metric-top">
                <span className="metric-icon">▦</span>
                <span className="metric-kicker">ALL PROJECTS</span>
              </div>
              <strong>{isLoading ? "—" : (dashboard?.total ?? 0)}</strong>
              <div className="metric-foot">
                Across your workspace <span>↗</span>
              </div>
            </article>
            <article className="metric-card">
              <div className="metric-top">
                <span className="metric-icon icon-soft">◷</span>
                <span className="metric-kicker">IN PROGRESS</span>
              </div>
              <strong>{isLoading ? "—" : (dashboard?.in_progress ?? 0)}</strong>
              <div className="metric-foot">Moving forward this week</div>
            </article>
            <article className="metric-card">
              <div className="metric-top">
                <span className="metric-icon icon-warm">✓</span>
                <span className="metric-kicker">COMPLETED</span>
              </div>
              <strong>{isLoading ? "—" : (dashboard?.completed ?? 0)}</strong>
              <div className="metric-foot">Ideas brought to life</div>
            </article>
          </section>

          <section className="overview-grid">
            <article className="panel chart-panel">
              <div className="panel-heading">
                <div>
                  <span className="eyebrow">PROJECT HEALTH</span>
                  <h2>Momentum overview</h2>
                </div>
                <span className="period-chip">
                  Current status <i>⌄</i>
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
                  fallback={<div className="chart-loading">Loading chart…</div>}
                >
                  <ProjectChart data={chartData} />
                </Suspense>
              </div>
              <div className="chart-caption">
                <span>
                  <b>{dashboard?.total ?? 0}</b> total projects
                </span>
                <span>Status updates appear here as your work changes</span>
              </div>
            </article>

            <article className="panel quick-panel" id="reports">
              <div className="panel-heading">
                <div>
                  <span className="eyebrow">AUTOMATION</span>
                  <h2>Daily snapshot</h2>
                </div>
                <span className="automation-mark">✳</span>
              </div>
              <p className="quick-copy">
                Queue a background job to capture today’s project status. Celery
                Beat also saves a snapshot every day.
              </p>
              <div className="snapshot-status">
                <span className="snapshot-icon">◷</span>
                <span>
                  <strong>{dashboard?.snapshots.length ?? 0}</strong> snapshots
                  recorded
                </span>
              </div>
              <button
                className="button button-primary button-wide"
                onClick={handleSnapshot}
              >
                Queue snapshot <span>→</span>
              </button>
              <div className="quick-foot">
                <i /> Powered by Celery + Redis
              </div>
            </article>
          </section>

          <section className="project-section" id="projects">
            <div className="section-title-row">
              <div>
                <span className="eyebrow">YOUR PIPELINE</span>
                <h2>
                  Projects <span className="count-pill">{projects.length}</span>
                </h2>
              </div>
              <span className="table-context">
                Sorted by recent activity <span>⌄</span>
              </span>
            </div>

            <form
              className="create-project-form"
              onSubmit={handleCreateProject}
            >
              <div className="form-field">
                <label htmlFor="project-title">Project name</label>
                <input
                  id="project-title"
                  maxLength={120}
                  placeholder="What are you working on?"
                  value={title}
                  onChange={(event) => setTitle(event.target.value)}
                  required
                />
              </div>
              <div className="form-field form-field-description">
                <label htmlFor="project-description">Short description</label>
                <input
                  id="project-description"
                  maxLength={1200}
                  placeholder="Add a sentence about the goal"
                  value={description}
                  onChange={(event) => setDescription(event.target.value)}
                />
              </div>
              <button
                className="button button-primary add-button"
                disabled={isSaving}
              >
                {isSaving ? (
                  "Adding…"
                ) : (
                  <>
                    <span>＋</span> Add project
                  </>
                )}
              </button>
            </form>

            <div className="project-table">
              <div className="table-header">
                <span>PROJECT</span>
                <span>STATUS</span>
                <span>LAST UPDATED</span>
                <span />
              </div>
              {isLoading ? (
                <div className="empty-state">Loading your workspace…</div>
              ) : projects.length === 0 ? (
                <div className="empty-state">
                  <span className="empty-icon">▦</span>
                  <strong>Your first project starts here</strong>
                  <span>Add a project above to see it in your dashboard.</span>
                </div>
              ) : (
                projects.map((project) => (
                  <article className="project-row" key={project.id}>
                    <div className="project-name-cell">
                      <span
                        className={`project-avatar project-avatar-${project.status}`}
                      >
                        {project.title.slice(0, 1).toUpperCase()}
                      </span>
                      <span className="project-copy">
                        <strong>{project.title}</strong>
                        <small>
                          {project.description || "No description added"}
                        </small>
                      </span>
                    </div>
                    <div>
                      <span className={`status-dot status-${project.status}`} />
                      <select
                        aria-label={`Status for ${project.title}`}
                        className={`status-select status-${project.status}`}
                        value={project.status}
                        onChange={(event) =>
                          void handleStatusChange(
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
                    <span className="updated-date">
                      {formatDate(project.updated_at)}
                    </span>
                    <button
                      className="row-menu"
                      type="button"
                      aria-label={`Delete ${project.title}`}
                      title="Delete project"
                      onClick={() => void handleDeleteProject(project)}
                    >
                      ×
                    </button>
                  </article>
                ))
              )}
            </div>
          </section>

          <footer className="page-footer">
            <span>Made for focused work.</span>
            <span>
              WEB <b>·</b> PROJECT HUB
            </span>
          </footer>
        </div>
      </section>
    </main>
  );
}

export default App;
