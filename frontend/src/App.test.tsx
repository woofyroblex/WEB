import { cleanup, render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import App from "./App";
import type { Project, User } from "./types";

const sessionKey = "project-hub-session";
const tokens = { access: "access-token", refresh: "refresh-token" };
const member: User = {
  id: 1,
  username: "member",
  email: "member@example.com",
  role: "user",
};
const admin: User = { ...member, username: "admin", role: "admin" };
const project: Project = {
  id: 7,
  title: "Ship the dashboard",
  description: "Finish the project",
  status: "backlog",
  created_at: "2026-11-01T00:00:00Z",
  updated_at: "2026-11-01T00:00:00Z",
};

function json(body: unknown, status = 200) {
  return new Response(JSON.stringify(body), {
    status,
    headers: { "Content-Type": "application/json" },
  });
}

function workspaceApi(user = member, projects = [project]) {
  return vi.fn(async (input: RequestInfo | URL, init?: RequestInit) => {
    const path = String(input);
    if (path === "/api/auth/me/") return json(user);
    if (path === "/api/projects/" && (!init?.method || init.method === "GET")) {
      return json(projects);
    }
    if (path === "/api/dashboard/") {
      return json({
        total: projects.length,
        backlog: projects.length,
        in_progress: 0,
        completed: 0,
      });
    }
    if (path === "/api/admin/dashboard/") {
      return json({
        total_users: 2,
        admin_users: 1,
        total_projects: 1,
        backlog: 1,
        in_progress: 0,
        completed: 0,
      });
    }
    if (path === "/api/admin/users/") {
      return json([
        {
          ...admin,
          project_count: 0,
          date_joined: "2026-11-01T00:00:00Z",
          role_locked: false,
        },
        {
          ...member,
          id: 2,
          project_count: 1,
          date_joined: "2026-11-01T00:00:00Z",
          role_locked: false,
        },
      ]);
    }
    if (path.startsWith("/api/admin/database/")) {
      const table = new URL(path, "http://localhost").searchParams.get("table");
      const records = {
        users: [
          {
            id: admin.id,
            username: admin.username,
            email: admin.email,
            role: admin.role,
            date_joined: "2026-11-01T00:00:00Z",
            project_count: 0,
          },
          {
            id: member.id,
            username: member.username,
            email: member.email,
            role: member.role,
            date_joined: "2026-11-01T00:00:00Z",
            project_count: 1,
          },
        ],
        projects: [
          {
            id: project.id,
            title: project.title,
            description: project.description,
            status: project.status,
            owner_username: member.username,
            created_at: project.created_at,
            updated_at: project.updated_at,
          },
        ],
        snapshots: [
          {
            id: 5,
            owner_username: member.username,
            day: "2026-11-01",
            backlog_count: 1,
            in_progress_count: 0,
            completed_count: 0,
            created_at: "2026-11-01T00:00:00Z",
          },
        ],
      };
      const results = records[table as keyof typeof records] ?? [];
      return json({
        count: results.length,
        next: null,
        previous: null,
        results,
      });
    }
    throw new Error(`Unexpected request: ${init?.method ?? "GET"} ${path}`);
  });
}

beforeEach(() => {
  sessionStorage.clear();
  window.history.replaceState({}, "", "/login");
});

afterEach(() => {
  cleanup();
  vi.unstubAllGlobals();
  vi.restoreAllMocks();
});

describe("authentication", () => {
  it("shows a rejected sign-in and does not save a session", async () => {
    const user = userEvent.setup();
    const fetcher = vi.fn(async () =>
      json({ detail: "Invalid credentials." }, 401),
    );
    vi.stubGlobal("fetch", fetcher);
    render(<App />);

    await user.type(screen.getByLabelText("Username"), " member ");
    await user.type(screen.getByLabelText("Password"), "incorrect-password");
    await user.click(screen.getByRole("button", { name: /sign in/i }));

    expect(await screen.findByRole("alert")).toHaveTextContent(
      "Invalid credentials.",
    );
    expect(sessionStorage.getItem(sessionKey)).toBeNull();
    expect(fetcher).toHaveBeenCalledWith(
      "/api/auth/token/",
      expect.objectContaining({
        method: "POST",
        body: JSON.stringify({
          username: "member",
          password: "incorrect-password",
        }),
      }),
    );
    expect(screen.getByRole("button", { name: /sign in/i })).toBeEnabled();
  });

  it("registers the entered account and opens its workspace", async () => {
    const user = userEvent.setup();
    window.history.replaceState({}, "", "/register");
    const api = workspaceApi();
    const fetcher = vi.fn(
      async (input: RequestInfo | URL, init?: RequestInit) => {
        if (input === "/api/auth/register/") return json(member, 201);
        if (input === "/api/auth/token/") return json(tokens);
        return api(input, init);
      },
    );
    vi.stubGlobal("fetch", fetcher);
    render(<App />);

    await user.type(screen.getByLabelText("Username"), " member ");
    await user.type(
      screen.getByLabelText("Email address"),
      "member@example.com",
    );
    await user.type(screen.getByLabelText("Password"), "secure-password");
    await user.click(screen.getByRole("button", { name: /create account/i }));

    expect(
      await screen.findByRole("heading", { name: "Good to see you, member" }),
    ).toBeInTheDocument();
    expect(fetcher).toHaveBeenCalledWith(
      "/api/auth/register/",
      expect.objectContaining({
        body: JSON.stringify({
          username: "member",
          email: "member@example.com",
          password: "secure-password",
        }),
      }),
    );
    expect(JSON.parse(sessionStorage.getItem(sessionKey)!)).toEqual(tokens);
    expect(window.location.pathname).toBe("/dashboard");
    await screen.findByText(project.title);
  });

  it("refreshes an expired access token before restoring the workspace", async () => {
    sessionStorage.setItem(sessionKey, JSON.stringify(tokens));
    const api = workspaceApi();
    const fetcher = vi.fn(
      async (input: RequestInfo | URL, init?: RequestInit) => {
        if (input === "/api/auth/token/refresh/")
          return json({ access: "renewed-token" });
        if (
          input === "/api/auth/me/" &&
          new Headers(init?.headers).get("Authorization") ===
            "Bearer access-token"
        ) {
          return json({ detail: "Expired" }, 401);
        }
        return api(input, init);
      },
    );
    vi.stubGlobal("fetch", fetcher);
    render(<App />);

    await screen.findByText(project.title);
    expect(JSON.parse(sessionStorage.getItem(sessionKey)!)).toEqual({
      ...tokens,
      access: "renewed-token",
    });
    expect(fetcher).toHaveBeenCalledWith(
      "/api/auth/token/refresh/",
      expect.objectContaining({
        method: "POST",
        body: JSON.stringify({ refresh: "refresh-token" }),
      }),
    );
  });

  it("clears an invalid session when refresh is rejected", async () => {
    sessionStorage.setItem(sessionKey, JSON.stringify(tokens));
    vi.stubGlobal(
      "fetch",
      vi.fn(async () => json({ detail: "Session expired." }, 401)),
    );
    render(<App />);

    expect(await screen.findByRole("alert")).toHaveTextContent(
      "Session expired.",
    );
    expect(
      screen.getByRole("button", { name: /sign in/i }),
    ).toBeInTheDocument();
    expect(sessionStorage.getItem(sessionKey)).toBeNull();
    expect(window.location.pathname).toBe("/login");
  });

  it("returns to sign-in when stored session JSON is corrupt", () => {
    sessionStorage.setItem(sessionKey, "{invalid");
    render(<App />);
    expect(
      screen.getByRole("button", { name: /sign in/i }),
    ).toBeInTheDocument();
  });
});

describe("workspace access and project actions", () => {
  it("shows a member's projects without administrator controls and signs out", async () => {
    const user = userEvent.setup();
    sessionStorage.setItem(sessionKey, JSON.stringify(tokens));
    vi.stubGlobal("fetch", workspaceApi());
    render(<App />);

    expect(await screen.findByText(project.title)).toBeInTheDocument();
    expect(
      screen.queryByRole("heading", { name: "User management" }),
    ).not.toBeInTheDocument();
    await user.click(screen.getByRole("button", { name: /sign out/i }));
    expect(
      screen.getByRole("button", { name: /sign in/i }),
    ).toBeInTheDocument();
    expect(sessionStorage.getItem(sessionKey)).toBeNull();
    expect(screen.queryByText(project.title)).not.toBeInTheDocument();
  });

  it("shows administrator accounts and prevents changing the current admin's role", async () => {
    sessionStorage.setItem(sessionKey, JSON.stringify(tokens));
    vi.stubGlobal("fetch", workspaceApi(admin));
    render(<App />);

    expect(
      await screen.findByRole("heading", { name: "Admin overview" }),
    ).toBeInTheDocument();
    expect(
      await screen.findByRole("combobox", { name: "Role for admin" }),
    ).toBeDisabled();
    expect(
      screen.getByRole("combobox", { name: "Role for member" }),
    ).toBeEnabled();
    expect(
      screen.queryByRole("button", { name: /new project/i }),
    ).not.toBeInTheDocument();
    expect(
      await screen.findByRole("heading", { name: "Live database" }),
    ).toBeInTheDocument();
  });

  it("lets administrators inspect live projects and snapshots", async () => {
    const user = userEvent.setup();
    sessionStorage.setItem(sessionKey, JSON.stringify(tokens));
    const fetcher = workspaceApi(admin);
    vi.stubGlobal("fetch", fetcher);
    render(<App />);

    await screen.findByRole("heading", { name: "Live database" });
    await user.click(screen.getByRole("button", { name: /^Projects$/ }));
    expect(await screen.findByText(project.title)).toBeInTheDocument();
    expect(screen.getByText("Finish the project")).toBeInTheDocument();

    await user.click(screen.getByRole("button", { name: /^Snapshots$/ }));
    expect(await screen.findByText("2026-11-01")).toBeInTheDocument();
    expect(
      fetcher.mock.calls.some(([input]) =>
        String(input).includes("table=snapshots"),
      ),
    ).toBe(true);
  });

  it("creates a project and displays the saved record", async () => {
    const user = userEvent.setup();
    sessionStorage.setItem(sessionKey, JSON.stringify(tokens));
    const projects: Project[] = [];
    const api = workspaceApi(member, projects);
    const fetcher = vi.fn(
      async (input: RequestInfo | URL, init?: RequestInit) => {
        if (input === "/api/projects/" && init?.method === "POST") {
          const saved = { ...project, ...JSON.parse(String(init.body)) };
          projects.push(saved);
          return json(saved, 201);
        }
        return api(input, init);
      },
    );
    vi.stubGlobal("fetch", fetcher);
    render(<App />);

    await user.click(
      await screen.findByRole("button", { name: /new project/i }),
    );
    await user.type(screen.getByLabelText("Project name"), "New release");
    await user.type(screen.getByLabelText(/^Description/), "Release notes");
    await user.click(screen.getByRole("button", { name: "Create project" }));

    expect(await screen.findByText("New release")).toBeInTheDocument();
    await waitFor(() =>
      expect(screen.queryByRole("dialog")).not.toBeInTheDocument(),
    );
    expect(fetcher).toHaveBeenCalledWith(
      "/api/projects/",
      expect.objectContaining({
        method: "POST",
        body: JSON.stringify({
          title: "New release",
          description: "Release notes",
          status: "backlog",
        }),
      }),
    );
  });
});
