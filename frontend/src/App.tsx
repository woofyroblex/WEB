import { useEffect, useMemo, useState } from "react";
import type { FormEvent } from "react";
import AuthView from "./components/AuthView";
import type { AuthMode } from "./components/AuthView";
import type {
  AdminDashboard,
  AdminUser,
  AuthTokens,
  DashboardSummary,
  Project,
  ProjectStatus,
  Role,
  User,
  UserDashboard,
} from "./types";
import "./App.css";

const API_BASE = (import.meta.env.VITE_API_BASE_URL || "/api").replace(
  /\/$/,
  "",
);
const SESSION_KEY = "project-hub-session";
type Route = AuthMode | "dashboard";
type ProjectDraft = Pick<Project, "title" | "description" | "status">;

class ApiError extends Error {
  status: number;

  constructor(message: string, status: number) {
    super(message);
    this.name = "ApiError";
    this.status = status;
  }
}

function readTokens(): AuthTokens | null {
  try {
    const value = sessionStorage.getItem(SESSION_KEY);
    return value ? (JSON.parse(value) as AuthTokens) : null;
  } catch {
    return null;
  }
}

function routeFromPath(): Route {
  if (window.location.pathname === "/register") return "register";
  if (window.location.pathname === "/dashboard") return "dashboard";
  return "login";
}

function messageFromPayload(payload: unknown): string {
  if (typeof payload === "string") return payload;
  if (Array.isArray(payload)) {
    return payload.length ? messageFromPayload(payload[0]) : "Request failed.";
  }
  if (payload && typeof payload === "object") {
    const values = Object.values(payload as Record<string, unknown>);
    for (const value of values) {
      const message = messageFromPayload(value);
      if (message && message !== "Request failed.") return message;
    }
  }
  return "Request failed. Please try again.";
}

async function readResponse<T>(response: Response): Promise<T> {
  const payload = await response.json().catch(() => null);
  if (!response.ok) {
    throw new ApiError(messageFromPayload(payload), response.status);
  }
  if (response.status === 204) return undefined as T;
  return payload as T;
}

async function publicRequest<T>(path: string, body: unknown): Promise<T> {
  const response = await fetch(`${API_BASE}${path}`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(body),
  });
  return readResponse<T>(response);
}

async function authorizedRequest<T>(
  path: string,
  tokens: AuthTokens,
  onTokensChanged: (nextTokens: AuthTokens) => void,
  init: RequestInit = {},
): Promise<T> {
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
    const refreshed = await readResponse<{ access: string }>(refreshResponse);
    const nextTokens = { ...tokens, access: refreshed.access };
    sessionStorage.setItem(SESSION_KEY, JSON.stringify(nextTokens));
    onTokensChanged(nextTokens);
    response = await send(nextTokens.access);
  }
  return readResponse<T>(response);
}

function formatDate(value: string): string {
  if (!value) return "—";
  return new Intl.DateTimeFormat(undefined, {
    month: "short",
    day: "numeric",
    year: "numeric",
  }).format(new Date(value));
}

function getInitials(name: string): string {
  const parts = name
    .trim()
    .split(/[\s._-]+/)
    .filter(Boolean);
  return (
    parts.length > 1 ? `${parts[0][0]}${parts[1][0]}` : name.slice(0, 2)
  ).toUpperCase();
}

const STATUS_LABELS: Record<ProjectStatus, string> = {
  backlog: "Not started",
  in_progress: "In progress",
  completed: "Completed",
};

export default function App() {
  const [route, setRoute] = useState<Route>(routeFromPath);
  const [tokens, setTokens] = useState<AuthTokens | null>(readTokens);
  const [profile, setProfile] = useState<User | null>(null);
  const [authLoading, setAuthLoading] = useState(() => Boolean(readTokens()));
  const [loadedWorkspace, setLoadedWorkspace] = useState<{
    userId: number;
    access: string;
    reloadKey: number;
  } | null>(null);
  const [authBusy, setAuthBusy] = useState(false);
  const [error, setError] = useState("");
  const [notice, setNotice] = useState("");
  const [projects, setProjects] = useState<Project[]>([]);
  const [adminUsers, setAdminUsers] = useState<AdminUser[]>([]);
  const [summary, setSummary] = useState<DashboardSummary>({
    total: 0,
    backlog: 0,
    in_progress: 0,
    completed: 0,
  });
  const [search, setSearch] = useState("");
  const [reloadKey, setReloadKey] = useState(0);
  const [isProjectDialogOpen, setProjectDialogOpen] = useState(false);
  const [editingProject, setEditingProject] = useState<Project | null>(null);
  const [projectDraft, setProjectDraft] = useState<ProjectDraft>({
    title: "",
    description: "",
    status: "backlog",
  });
  const [projectBusy, setProjectBusy] = useState(false);
  const [roleBusyId, setRoleBusyId] = useState<number | null>(null);
  const workspaceLoading = Boolean(
    profile &&
    tokens &&
    (loadedWorkspace?.userId !== profile.id ||
      loadedWorkspace.access !== tokens.access ||
      loadedWorkspace.reloadKey !== reloadKey),
  );

  function navigate(next: Route, replace = false) {
    const path = next === "dashboard" ? "/dashboard" : `/${next}`;
    if (replace) window.history.replaceState({}, "", path);
    else window.history.pushState({}, "", path);
    setRoute(next);
    setError("");
  }

  function persistTokens(nextTokens: AuthTokens | null) {
    if (nextTokens) {
      sessionStorage.setItem(SESSION_KEY, JSON.stringify(nextTokens));
      setAuthLoading(true);
    } else {
      sessionStorage.removeItem(SESSION_KEY);
      setAuthLoading(false);
      setProfile(null);
    }
    setTokens(nextTokens);
  }

  useEffect(() => {
    const handlePopState = () => {
      setRoute(routeFromPath());
      setError("");
    };
    window.addEventListener("popstate", handlePopState);
    return () => window.removeEventListener("popstate", handlePopState);
  }, []);

  useEffect(() => {
    let active = true;
    if (!tokens) {
      return () => {
        active = false;
      };
    }

    authorizedRequest<User>("/auth/me/", tokens, persistTokens)
      .then((user) => {
        if (!active) return;
        setProfile(user);
        if (window.location.pathname !== "/dashboard") {
          window.history.replaceState({}, "", "/dashboard");
          setRoute("dashboard");
        }
      })
      .catch((requestError: unknown) => {
        if (!active) return;
        persistTokens(null);
        setError(
          requestError instanceof Error
            ? requestError.message
            : "Your session ended. Sign in again to continue.",
        );
        window.history.replaceState({}, "", "/login");
        setRoute("login");
      })
      .finally(() => {
        if (active) setAuthLoading(false);
      });

    return () => {
      active = false;
    };
  }, [tokens]);

  useEffect(() => {
    if (!profile || !tokens) return;
    const currentProfile = profile;
    const currentTokens = tokens;
    let active = true;

    async function loadWorkspace() {
      if (currentProfile.role === "admin") {
        const [adminData, users] = await Promise.all([
          authorizedRequest<AdminDashboard>(
            "/admin/dashboard/",
            currentTokens,
            persistTokens,
          ),
          authorizedRequest<AdminUser[]>(
            "/admin/users/",
            currentTokens,
            persistTokens,
          ),
        ]);
        if (!active) return;
        setSummary({
          total: adminData.total_projects,
          backlog: adminData.backlog,
          in_progress: adminData.in_progress,
          completed: adminData.completed,
          total_users: adminData.total_users,
          admin_users: adminData.admin_users,
        });
        setAdminUsers(users);
        setProjects([]);
      } else {
        const [dashboardData, projectData] = await Promise.all([
          authorizedRequest<UserDashboard>(
            "/dashboard/",
            currentTokens,
            persistTokens,
          ),
          authorizedRequest<Project[]>(
            "/projects/",
            currentTokens,
            persistTokens,
          ),
        ]);
        if (!active) return;
        setSummary(dashboardData);
        setProjects(projectData);
        setAdminUsers([]);
      }
    }

    loadWorkspace()
      .catch((requestError: unknown) => {
        if (!active) return;
        if (requestError instanceof ApiError && requestError.status === 401) {
          persistTokens(null);
          setProfile(null);
          navigate("login", true);
        } else {
          setError(
            requestError instanceof Error
              ? requestError.message
              : "Could not load the dashboard.",
          );
        }
      })
      .finally(() => {
        if (active) {
          setLoadedWorkspace({
            userId: currentProfile.id,
            access: currentTokens.access,
            reloadKey,
          });
        }
      });

    return () => {
      active = false;
    };
  }, [profile, tokens, reloadKey]);

  async function handleSignIn(username: string, password: string) {
    setAuthBusy(true);
    setError("");
    try {
      const nextTokens = await publicRequest<AuthTokens>("/auth/token/", {
        username,
        password,
      });
      persistTokens(nextTokens);
      navigate("dashboard");
    } catch (requestError) {
      setError(
        requestError instanceof Error
          ? requestError.message
          : "Could not sign in.",
      );
    } finally {
      setAuthBusy(false);
    }
  }

  async function handleRegister(
    username: string,
    email: string,
    password: string,
  ) {
    setAuthBusy(true);
    setError("");
    try {
      await publicRequest<User>("/auth/register/", {
        username,
        email,
        password,
      });
      const nextTokens = await publicRequest<AuthTokens>("/auth/token/", {
        username,
        password,
      });
      persistTokens(nextTokens);
      navigate("dashboard");
    } catch (requestError) {
      setError(
        requestError instanceof Error
          ? requestError.message
          : "Could not create your account.",
      );
    } finally {
      setAuthBusy(false);
    }
  }

  function signOut() {
    persistTokens(null);
    setProfile(null);
    setProjects([]);
    setAdminUsers([]);
    setSummary({ total: 0, backlog: 0, in_progress: 0, completed: 0 });
    setNotice("");
    navigate("login");
  }

  function openProjectForm(project?: Project) {
    setEditingProject(project ?? null);
    setProjectDraft(
      project
        ? {
            title: project.title,
            description: project.description,
            status: project.status,
          }
        : { title: "", description: "", status: "backlog" },
    );
    setProjectDialogOpen(true);
  }

  async function saveProject(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (!tokens || !profile) return;
    setProjectBusy(true);
    setError("");
    try {
      const saved = await authorizedRequest<Project>(
        editingProject ? `/projects/${editingProject.id}/` : "/projects/",
        tokens,
        persistTokens,
        {
          method: editingProject ? "PATCH" : "POST",
          body: JSON.stringify(projectDraft),
        },
      );
      setProjects((current) =>
        editingProject
          ? current.map((project) =>
              project.id === saved.id ? saved : project,
            )
          : [saved, ...current],
      );
      setProjectDialogOpen(false);
      setNotice(editingProject ? "Project updated." : "Project created.");
      setReloadKey((value) => value + 1);
    } catch (requestError) {
      setError(
        requestError instanceof Error
          ? requestError.message
          : "Could not save the project.",
      );
    } finally {
      setProjectBusy(false);
    }
  }

  async function changeProjectStatus(project: Project, status: ProjectStatus) {
    if (!tokens || project.status === status) return;
    setError("");
    try {
      const updated = await authorizedRequest<Project>(
        `/projects/${project.id}/`,
        tokens,
        persistTokens,
        { method: "PATCH", body: JSON.stringify({ status }) },
      );
      setProjects((current) =>
        current.map((item) => (item.id === updated.id ? updated : item)),
      );
      setNotice("Project status updated.");
      setReloadKey((value) => value + 1);
    } catch (requestError) {
      setError(
        requestError instanceof Error
          ? requestError.message
          : "Could not update the project.",
      );
    }
  }

  async function deleteProject(project: Project) {
    if (!tokens || !window.confirm(`Delete “${project.title}”?`)) return;
    setError("");
    try {
      await authorizedRequest<void>(
        `/projects/${project.id}/`,
        tokens,
        persistTokens,
        { method: "DELETE" },
      );
      setProjects((current) =>
        current.filter((item) => item.id !== project.id),
      );
      setNotice("Project deleted.");
      setReloadKey((value) => value + 1);
    } catch (requestError) {
      setError(
        requestError instanceof Error
          ? requestError.message
          : "Could not delete the project.",
      );
    }
  }

  async function changeUserRole(user: AdminUser, role: Role) {
    if (!tokens || user.role === role) return;
    setRoleBusyId(user.id);
    setError("");
    try {
      await authorizedRequest<User>(
        `/admin/users/${user.id}/role/`,
        tokens,
        persistTokens,
        { method: "PATCH", body: JSON.stringify({ role }) },
      );
      setAdminUsers((current) =>
        current.map((item) => (item.id === user.id ? { ...item, role } : item)),
      );
      setNotice(
        `${user.username} is now ${role === "admin" ? "an admin" : "a user"}.`,
      );
      setReloadKey((value) => value + 1);
    } catch (requestError) {
      setError(
        requestError instanceof Error
          ? requestError.message
          : "Could not update the account role.",
      );
    } finally {
      setRoleBusyId(null);
    }
  }

  const visibleProjects = useMemo(() => {
    const query = search.trim().toLowerCase();
    if (!query) return projects;
    return projects.filter((project) =>
      `${project.title} ${project.description} ${STATUS_LABELS[project.status]}`
        .toLowerCase()
        .includes(query),
    );
  }, [projects, search]);

  const visibleUsers = useMemo(() => {
    const query = search.trim().toLowerCase();
    if (!query) return adminUsers;
    return adminUsers.filter((user) =>
      `${user.username} ${user.email} ${user.role}`
        .toLowerCase()
        .includes(query),
    );
  }, [adminUsers, search]);

  if (authLoading) {
    return (
      <main className="loading-screen">
        <span className="loading-mark">W</span>
        <p>Opening your workspace…</p>
      </main>
    );
  }

  if (!profile || !tokens) {
    return (
      <AuthView
        mode={route === "register" ? "register" : "login"}
        isBusy={authBusy}
        error={error}
        onNavigate={(mode) => navigate(mode)}
        onSignIn={handleSignIn}
        onRegister={handleRegister}
      />
    );
  }

  const isAdmin = profile.role === "admin";
  const metricItems = isAdmin
    ? [
        {
          label: "Total accounts",
          value: summary.total_users ?? 0,
          icon: "◎",
          tone: "violet",
        },
        {
          label: "Administrators",
          value: summary.admin_users ?? 0,
          icon: "◇",
          tone: "blue",
        },
        {
          label: "All projects",
          value: summary.total,
          icon: "▤",
          tone: "green",
        },
        {
          label: "In progress",
          value: summary.in_progress,
          icon: "◷",
          tone: "orange",
        },
      ]
    : [
        {
          label: "Total projects",
          value: summary.total,
          icon: "▤",
          tone: "violet",
        },
        {
          label: "Not started",
          value: summary.backlog,
          icon: "◷",
          tone: "blue",
        },
        {
          label: "In progress",
          value: summary.in_progress,
          icon: "↗",
          tone: "orange",
        },
        {
          label: "Completed",
          value: summary.completed,
          icon: "✓",
          tone: "green",
        },
      ];

  return (
    <div className="dashboard-shell">
      <aside className="app-sidebar">
        <a className="brand brand-dark sidebar-brand" href="/dashboard">
          <span className="brand-symbol">W</span>
          <span>Project Hub</span>
        </a>
        <div className="sidebar-label">WORKSPACE</div>
        <nav className="sidebar-nav" aria-label="Workspace navigation">
          <button className="sidebar-link active" type="button">
            <span className="sidebar-link-icon">⌂</span> Dashboard
          </button>
          <button
            className="sidebar-link"
            type="button"
            onClick={() =>
              document
                .getElementById(isAdmin ? "users-panel" : "projects-panel")
                ?.scrollIntoView({ behavior: "smooth" })
            }
          >
            <span className="sidebar-link-icon">{isAdmin ? "♙" : "▦"}</span>
            {isAdmin ? "User management" : "My projects"}
          </button>
        </nav>

        <div className="sidebar-bottom">
          <div className="sidebar-label">SIGNED IN AS</div>
          <div className="signed-in-card">
            <span className="user-avatar">{getInitials(profile.username)}</span>
            <span className="signed-in-copy">
              <strong>{profile.username}</strong>
              <small>{isAdmin ? "Administrator" : "User"}</small>
            </span>
          </div>
          <button className="sidebar-signout" type="button" onClick={signOut}>
            <span aria-hidden="true">↪</span> Sign out
          </button>
          <div className="sidebar-footer">
            PROJECT HUB <span>·</span> 1.0
          </div>
        </div>
      </aside>

      <div className="dashboard-main">
        <header className="dashboard-topbar">
          <div className="breadcrumb">
            <span>Workspace</span>
            <b>/</b>
            <strong>Dashboard</strong>
          </div>
          <div className="topbar-account">
            <span
              className={`role-pill ${isAdmin ? "role-admin" : "role-user"}`}
            >
              {isAdmin ? "Admin" : "User"}
            </span>
            <span className="topbar-avatar">
              {getInitials(profile.username)}
            </span>
            <span className="topbar-name">{profile.username}</span>
          </div>
        </header>

        <main className="dashboard-content">
          <section className="page-heading">
            <div>
              <p className="overline">
                {isAdmin ? "ADMINISTRATION" : "YOUR WORKSPACE"}
              </p>
              <h1>
                {isAdmin
                  ? "Admin overview"
                  : `Good to see you, ${profile.username}`}
              </h1>
              <p className="page-subtitle">
                {isAdmin
                  ? "Review workspace activity and manage account access."
                  : "Here’s a clear view of your projects and what needs attention."}
              </p>
            </div>
            {!isAdmin && (
              <button
                className="button button-primary"
                type="button"
                onClick={() => openProjectForm()}
              >
                <span aria-hidden="true">＋</span> New project
              </button>
            )}
          </section>

          {error && (
            <div className="dashboard-alert" role="alert">
              {error}
            </div>
          )}
          {notice && (
            <div className="dashboard-notice" role="status">
              <span>✓</span>
              {notice}
              <button
                type="button"
                aria-label="Dismiss message"
                onClick={() => setNotice("")}
              >
                ×
              </button>
            </div>
          )}

          <section className="metric-grid" aria-label="Workspace summary">
            {metricItems.map((item) => (
              <article className="metric-card" key={item.label}>
                <div
                  className={`metric-icon metric-${item.tone}`}
                  aria-hidden="true"
                >
                  {item.icon}
                </div>
                <div className="metric-copy">
                  <span>{item.label}</span>
                  <strong>{workspaceLoading ? "—" : item.value}</strong>
                </div>
                <span className="metric-card-mark" aria-hidden="true">
                  ↗
                </span>
              </article>
            ))}
          </section>

          <section className="dashboard-grid">
            <article className="panel status-panel">
              <div className="panel-heading">
                <div>
                  <h2>Project status</h2>
                  <p>{summary.total} projects across your workspace</p>
                </div>
                <span className="panel-icon" aria-hidden="true">
                  ◔
                </span>
              </div>
              <StatusOverview summary={summary} />
            </article>

            <article className="panel overview-note">
              <div className="note-topline">
                <span className="note-sparkle">✳</span>
                <span>{isAdmin ? "ACCESS CONTROL" : "A GOOD NEXT STEP"}</span>
              </div>
              <h2>
                {isAdmin ? "Keep access up to date" : "Keep momentum going"}
              </h2>
              <p>
                {isAdmin
                  ? "Assign admin access only to people who need to manage accounts and workspace activity."
                  : "Update project statuses as work moves forward. Your dashboard reflects the latest changes."}
              </p>
              <button
                className="text-action"
                type="button"
                onClick={() =>
                  document
                    .getElementById(isAdmin ? "users-panel" : "projects-panel")
                    ?.scrollIntoView({ behavior: "smooth" })
                }
              >
                {isAdmin ? "Manage accounts" : "View projects"}{" "}
                <span aria-hidden="true">→</span>
              </button>
            </article>
          </section>

          {isAdmin ? (
            <section className="panel data-panel" id="users-panel">
              <div className="panel-heading data-panel-heading">
                <div>
                  <h2>User management</h2>
                  <p>Review accounts and manage workspace roles.</p>
                </div>
                <label className="search-control">
                  <span aria-hidden="true">⌕</span>
                  <input
                    value={search}
                    onChange={(event) => setSearch(event.target.value)}
                    placeholder="Search accounts"
                    aria-label="Search accounts"
                  />
                </label>
              </div>
              <div className="table-scroll">
                <table>
                  <thead>
                    <tr>
                      <th>Account</th>
                      <th>Projects</th>
                      <th>Joined</th>
                      <th>Role</th>
                    </tr>
                  </thead>
                  <tbody>
                    {workspaceLoading ? (
                      <tr>
                        <td className="table-empty" colSpan={4}>
                          Loading accounts…
                        </td>
                      </tr>
                    ) : visibleUsers.length ? (
                      visibleUsers.map((user) => (
                        <tr key={user.id}>
                          <td>
                            <div className="account-cell">
                              <span className="user-avatar user-avatar-small">
                                {getInitials(user.username)}
                              </span>
                              <span>
                                <strong>{user.username}</strong>
                                <small>{user.email || "No email added"}</small>
                              </span>
                            </div>
                          </td>
                          <td>
                            <span className="project-count">
                              {user.project_count}
                            </span>
                          </td>
                          <td className="muted-cell">
                            {formatDate(user.date_joined)}
                          </td>
                          <td>
                            <select
                              className={`role-select ${user.role === "admin" ? "role-select-admin" : ""}`}
                              aria-label={`Role for ${user.username}`}
                              value={user.role}
                              disabled={
                                user.role_locked ||
                                user.id === profile.id ||
                                roleBusyId === user.id
                              }
                              onChange={(event) =>
                                changeUserRole(user, event.target.value as Role)
                              }
                              title={
                                user.role_locked
                                  ? "Managed through Django staff permissions"
                                  : undefined
                              }
                            >
                              <option value="user">User</option>
                              <option value="admin">Admin</option>
                            </select>
                          </td>
                        </tr>
                      ))
                    ) : (
                      <tr>
                        <td className="table-empty" colSpan={4}>
                          No accounts match your search.
                        </td>
                      </tr>
                    )}
                  </tbody>
                </table>
              </div>
              <div className="panel-footnote">
                {adminUsers.length} account{adminUsers.length === 1 ? "" : "s"}{" "}
                in this workspace
              </div>
            </section>
          ) : (
            <section className="panel data-panel" id="projects-panel">
              <div className="panel-heading data-panel-heading">
                <div>
                  <h2>Your projects</h2>
                  <p>Track work and keep each status current.</p>
                </div>
                <label className="search-control">
                  <span aria-hidden="true">⌕</span>
                  <input
                    value={search}
                    onChange={(event) => setSearch(event.target.value)}
                    placeholder="Search projects"
                    aria-label="Search projects"
                  />
                </label>
              </div>
              <div className="table-scroll">
                <table>
                  <thead>
                    <tr>
                      <th>Project</th>
                      <th>Status</th>
                      <th>Last updated</th>
                      <th>
                        <span className="visually-hidden">Actions</span>
                      </th>
                    </tr>
                  </thead>
                  <tbody>
                    {workspaceLoading ? (
                      <tr>
                        <td className="table-empty" colSpan={4}>
                          Loading projects…
                        </td>
                      </tr>
                    ) : visibleProjects.length ? (
                      visibleProjects.map((project) => (
                        <tr key={project.id}>
                          <td>
                            <div className="project-cell">
                              <span className="project-bullet" />
                              <span>
                                <strong>{project.title}</strong>
                                <small>
                                  {project.description || "No description"}
                                </small>
                              </span>
                            </div>
                          </td>
                          <td>
                            <select
                              className={`status-select status-${project.status}`}
                              aria-label={`Status for ${project.title}`}
                              value={project.status}
                              onChange={(event) =>
                                changeProjectStatus(
                                  project,
                                  event.target.value as ProjectStatus,
                                )
                              }
                            >
                              <option value="backlog">Not started</option>
                              <option value="in_progress">In progress</option>
                              <option value="completed">Completed</option>
                            </select>
                          </td>
                          <td className="muted-cell">
                            {formatDate(project.updated_at)}
                          </td>
                          <td>
                            <div className="row-actions">
                              <button
                                type="button"
                                onClick={() => openProjectForm(project)}
                                aria-label={`Edit ${project.title}`}
                                title="Edit project"
                              >
                                ✎
                              </button>
                              <button
                                type="button"
                                onClick={() => deleteProject(project)}
                                aria-label={`Delete ${project.title}`}
                                title="Delete project"
                              >
                                ×
                              </button>
                            </div>
                          </td>
                        </tr>
                      ))
                    ) : (
                      <tr>
                        <td className="table-empty" colSpan={4}>
                          {search
                            ? "No projects match your search."
                            : "No projects yet. Add one to get started."}
                        </td>
                      </tr>
                    )}
                  </tbody>
                </table>
              </div>
              <div className="panel-footnote">
                Showing {visibleProjects.length} of {projects.length} project
                {projects.length === 1 ? "" : "s"}
              </div>
            </section>
          )}
        </main>
      </div>

      {isProjectDialogOpen && (
        <div
          className="dialog-backdrop"
          role="presentation"
          onMouseDown={(event) => {
            if (event.target === event.currentTarget)
              setProjectDialogOpen(false);
          }}
        >
          <section
            className="project-dialog"
            role="dialog"
            aria-modal="true"
            aria-labelledby="project-dialog-title"
          >
            <div className="dialog-heading">
              <div>
                <p className="overline">PROJECT DETAILS</p>
                <h2 id="project-dialog-title">
                  {editingProject ? "Edit project" : "Create a project"}
                </h2>
              </div>
              <button
                type="button"
                className="dialog-close"
                onClick={() => setProjectDialogOpen(false)}
                aria-label="Close dialog"
              >
                ×
              </button>
            </div>
            <form className="project-form" onSubmit={saveProject}>
              <label className="field-label" htmlFor="project-title">
                Project name
                <input
                  id="project-title"
                  autoFocus
                  maxLength={120}
                  value={projectDraft.title}
                  onChange={(event) =>
                    setProjectDraft((draft) => ({
                      ...draft,
                      title: event.target.value,
                    }))
                  }
                  placeholder="e.g. Website refresh"
                  required
                />
              </label>
              <label className="field-label" htmlFor="project-description">
                Description <span className="optional-label">Optional</span>
                <textarea
                  id="project-description"
                  maxLength={1200}
                  rows={4}
                  value={projectDraft.description}
                  onChange={(event) =>
                    setProjectDraft((draft) => ({
                      ...draft,
                      description: event.target.value,
                    }))
                  }
                  placeholder="What does this project need to achieve?"
                />
              </label>
              <label className="field-label" htmlFor="project-status">
                Status
                <select
                  id="project-status"
                  value={projectDraft.status}
                  onChange={(event) =>
                    setProjectDraft((draft) => ({
                      ...draft,
                      status: event.target.value as ProjectStatus,
                    }))
                  }
                >
                  <option value="backlog">Not started</option>
                  <option value="in_progress">In progress</option>
                  <option value="completed">Completed</option>
                </select>
              </label>
              {error && (
                <div className="form-alert" role="alert">
                  {error}
                </div>
              )}
              <div className="dialog-actions">
                <button
                  className="button button-quiet"
                  type="button"
                  onClick={() => setProjectDialogOpen(false)}
                >
                  Cancel
                </button>
                <button
                  className="button button-primary"
                  type="submit"
                  disabled={projectBusy}
                >
                  {projectBusy
                    ? "Saving…"
                    : editingProject
                      ? "Save changes"
                      : "Create project"}
                </button>
              </div>
            </form>
          </section>
        </div>
      )}
    </div>
  );
}

function StatusOverview({ summary }: { summary: DashboardSummary }) {
  const rows: Array<{ key: ProjectStatus; label: string; value: number }> = [
    { key: "backlog", label: "Not started", value: summary.backlog },
    { key: "in_progress", label: "In progress", value: summary.in_progress },
    { key: "completed", label: "Completed", value: summary.completed },
  ];

  return (
    <div className="status-list">
      {rows.map((row) => {
        const width = summary.total
          ? `${Math.round((row.value / summary.total) * 100)}%`
          : "0%";
        return (
          <div className="status-row" key={row.key}>
            <div className="status-row-label">
              <span className={`status-dot dot-${row.key}`} />
              <span>{row.label}</span>
              <strong>{row.value}</strong>
            </div>
            <div className="status-track">
              <span
                className={`status-fill fill-${row.key}`}
                style={{ width }}
              />
            </div>
          </div>
        );
      })}
      {!summary.total && (
        <p className="status-empty">Project activity will appear here.</p>
      )}
    </div>
  );
}
