export type Role = "admin" | "user";

export type AuthTokens = {
  access: string;
  refresh: string;
};

export type User = {
  id: number;
  username: string;
  email: string;
  role: Role;
};

export type AdminUser = User & {
  project_count: number;
  date_joined: string;
  role_locked: boolean;
};

export type ProjectStatus = "backlog" | "in_progress" | "completed";

export type Project = {
  id: number;
  title: string;
  description: string;
  status: ProjectStatus;
  created_at: string;
  updated_at: string;
};

export type UserDashboard = {
  total: number;
  backlog: number;
  in_progress: number;
  completed: number;
};

export type AdminDashboard = {
  total_users: number;
  admin_users: number;
  total_projects: number;
  backlog: number;
  in_progress: number;
  completed: number;
};

export type DashboardSummary = UserDashboard & {
  total_users?: number;
  admin_users?: number;
};
