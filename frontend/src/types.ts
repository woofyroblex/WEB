export type ProjectStatus = "backlog" | "in_progress" | "completed";

export type Priority = "low" | "medium" | "high" | "urgent";

export type Project = {
  id: number;
  title: string;
  description: string;
  status: ProjectStatus;
  priority?: Priority;
  tags?: string[];
  created_at: string;
  updated_at: string;
};

export type Snapshot = {
  day: string;
  backlog_count: number;
  in_progress_count: number;
  completed_count: number;
  total_count: number;
};

export type DashboardData = {
  total: number;
  backlog: number;
  in_progress: number;
  completed: number;
  snapshots: Snapshot[];
};

export type TokenPair = {
  access: string;
  refresh: string;
};

export type ApiErrorBody = {
  detail?: string;
  [key: string]: unknown;
};

export type WorkspaceTheme =
  "emerald" | "indigo" | "slate" | "violet" | "amber";

export type WorkspaceConfig = {
  appName: string;
  entityLabel: string;
  tagline: string;
  theme: WorkspaceTheme;
  darkMode: boolean;
};

export type ViewMode = "overview" | "board" | "table" | "reports";

export type DomainPreset = {
  id: string;
  name: string;
  appName: string;
  entityLabel: string;
  tagline: string;
  theme: WorkspaceTheme;
  projects: Array<{
    title: string;
    description: string;
    status: ProjectStatus;
    priority: Priority;
    tags: string[];
  }>;
};
