import type {
  DashboardData,
  DomainPreset,
  Priority,
  Project,
  WorkspaceConfig,
} from "./types";

export const DEFAULT_WORKSPACE_CONFIG: WorkspaceConfig = {
  appName: "WEB Project Hub",
  entityLabel: "Project",
  tagline: "A clear home for the work that matters.",
  theme: "emerald",
  darkMode: false,
};

export const DOMAIN_PRESETS: DomainPreset[] = [
  {
    id: "general",
    name: "General / Hackathon Project Hub",
    appName: "WEB Project Hub",
    entityLabel: "Project",
    tagline: "Track ideas, milestones, and deliver on time.",
    theme: "emerald",
    projects: [
      {
        title: "Adaptive Responsive UI Architecture",
        description:
          "Modular layout engine supporting real-time theme swapping and fluid grid alignment across mobile, tablet, and widescreen.",
        status: "completed",
        priority: "urgent",
        tags: ["Frontend", "Design System"],
      },
      {
        title: "REST & Celery Event Integration",
        description:
          "Connect async workers, cache layers, and live health metrics to the central telemetry bus.",
        status: "in_progress",
        priority: "high",
        tags: ["Backend", "Celery", "API"],
      },
      {
        title: "Interactive Dynamic Data Matrix",
        description:
          "Multi-view workspace table with keyword filtering, status grouping, and JSON export.",
        status: "in_progress",
        priority: "medium",
        tags: ["Feature", "Analytics"],
      },
      {
        title: "Role-Based Audit & Permission Pipeline",
        description:
          "Fine-grained access control with session verification and tamper-evident audit logs.",
        status: "backlog",
        priority: "medium",
        tags: ["Security", "Compliance"],
      },
      {
        title: "Zero-Latency Client-Side Search",
        description:
          "Fuzzy matching across project titles, tags, and status properties without roundtrip lag.",
        status: "backlog",
        priority: "low",
        tags: ["Performance", "UX"],
      },
    ],
  },
  {
    id: "health",
    name: "Healthcare & Patient Workflow",
    appName: "MedFlow Portal",
    entityLabel: "Patient Case",
    tagline: "Streamline admissions, triage, and patient care pathways.",
    theme: "indigo",
    projects: [
      {
        title: "Pre-Op Assessment Protocol",
        description:
          "Comprehensive diagnostic checkup and vitals review for scheduled cardiac procedure.",
        status: "completed",
        priority: "urgent",
        tags: ["Surgery", "Cardiology"],
      },
      {
        title: "Emergency Triage Room 302",
        description:
          "Acute respiratory monitoring and IV medication titration following initial assessment.",
        status: "in_progress",
        priority: "urgent",
        tags: ["Emergency", "Critical"],
      },
      {
        title: "Physical Therapy Rehabilitation Plan",
        description:
          "Post-orthopedic recovery regimen with weekly mobility goals and follow-up consultation.",
        status: "in_progress",
        priority: "medium",
        tags: ["Rehab", "Outpatient"],
      },
      {
        title: "Routine Lab Pathology Screen",
        description:
          "Comprehensive metabolic panel and lipid profile screening for annual physical exam.",
        status: "backlog",
        priority: "low",
        tags: ["Diagnostics", "Routine"],
      },
    ],
  },
  {
    id: "sustainability",
    name: "Sustainability & Climate Tracker",
    appName: "EcoTrack Network",
    entityLabel: "Initiative",
    tagline: "Monitor carbon offsets, resource efficiency, and green targets.",
    theme: "emerald",
    projects: [
      {
        title: "Solar Grid Phase 1 Deployment",
        description:
          "Rooftop photovoltaic installation with net metering grid tie-in across manufacturing block A.",
        status: "completed",
        priority: "high",
        tags: ["Clean Energy", "Solar"],
      },
      {
        title: "Scope 2 Emissions Audit",
        description:
          "Data collection and GHG protocol accounting across all regional office facilities.",
        status: "in_progress",
        priority: "high",
        tags: ["Reporting", "ESG"],
      },
      {
        title: "Zero-Waste Packaging Transition",
        description:
          "Replace single-use poly mailers with compostable post-consumer recycled mailers.",
        status: "backlog",
        priority: "medium",
        tags: ["Supply Chain", "Circularity"],
      },
    ],
  },
  {
    id: "fintech",
    name: "Fintech & Ledger Systems",
    appName: "NovaPay Core",
    entityLabel: "Transaction Flow",
    tagline: "Manage payments, fraud prevention, and regulatory ledgers.",
    theme: "violet",
    projects: [
      {
        title: "Instant Settlement Rail (UPI/FedNow)",
        description:
          "Sub-second gross settlement gateway connecting domestic banking partners with webhook notifications.",
        status: "completed",
        priority: "urgent",
        tags: ["Rail", "Settlement"],
      },
      {
        title: "Real-time Fraud Anomaly Detection",
        description:
          "Streaming ML scoring engine flagging high-risk velocity deviations on high-ticket transfers.",
        status: "in_progress",
        priority: "high",
        tags: ["Security", "ML"],
      },
      {
        title: "Merchant Reconciliation Dashboard",
        description:
          "End-of-day dispute resolution, fee breakdown, and automated accounting export engine.",
        status: "backlog",
        priority: "medium",
        tags: ["Merchant", "Ledger"],
      },
    ],
  },
];

export const INITIAL_DEMO_PROJECTS: Project[] = DOMAIN_PRESETS[0].projects.map(
  (p, index) => {
    const now = new Date();
    const created = new Date(now.getTime() - (index + 1) * 86400000);
    return {
      id: index + 1,
      title: p.title,
      description: p.description,
      status: p.status,
      priority: p.priority,
      tags: p.tags,
      created_at: created.toISOString(),
      updated_at: created.toISOString(),
    };
  },
);

export const INITIAL_DEMO_DASHBOARD: DashboardData = {
  total: INITIAL_DEMO_PROJECTS.length,
  backlog: INITIAL_DEMO_PROJECTS.filter((p) => p.status === "backlog").length,
  in_progress: INITIAL_DEMO_PROJECTS.filter((p) => p.status === "in_progress")
    .length,
  completed: INITIAL_DEMO_PROJECTS.filter((p) => p.status === "completed")
    .length,
  snapshots: [
    {
      day: "2026-10-28",
      backlog_count: 3,
      in_progress_count: 1,
      completed_count: 0,
      total_count: 4,
    },
    {
      day: "2026-10-29",
      backlog_count: 3,
      in_progress_count: 2,
      completed_count: 0,
      total_count: 5,
    },
    {
      day: "2026-10-30",
      backlog_count: 2,
      in_progress_count: 2,
      completed_count: 1,
      total_count: 5,
    },
    {
      day: "2026-10-31",
      backlog_count: 2,
      in_progress_count: 2,
      completed_count: 1,
      total_count: 5,
    },
    {
      day: "2026-11-01",
      backlog_count: 2,
      in_progress_count: 2,
      completed_count: 1,
      total_count: 5,
    },
  ],
};

const METADATA_TAG_REGEX = /\[Tags:\s*([^\]]+)\]/i;
const METADATA_PRIORITY_REGEX = /\[Priority:\s*(low|medium|high|urgent)\]/i;

export function parseProjectMetadata(description: string): {
  cleanDescription: string;
  priority?: Priority;
  tags?: string[];
} {
  let clean = description || "";
  let priority: Priority | undefined;
  let tags: string[] | undefined;

  const priorityMatch = clean.match(METADATA_PRIORITY_REGEX);
  if (priorityMatch) {
    priority = priorityMatch[1].toLowerCase() as Priority;
    clean = clean.replace(METADATA_PRIORITY_REGEX, "").trim();
  }

  const tagMatch = clean.match(METADATA_TAG_REGEX);
  if (tagMatch) {
    tags = tagMatch[1]
      .split(",")
      .map((t) => t.trim())
      .filter(Boolean);
    clean = clean.replace(METADATA_TAG_REGEX, "").trim();
  }

  return { cleanDescription: clean, priority, tags };
}

export function encodeProjectDescription(
  cleanDescription: string,
  priority?: Priority,
  tags?: string[],
): string {
  const parts: string[] = [cleanDescription.trim()];
  if (priority) {
    parts.push(`[Priority: ${priority}]`);
  }
  if (tags && tags.length > 0) {
    parts.push(`[Tags: ${tags.join(", ")}]`);
  }
  return parts.filter(Boolean).join(" ");
}

export function exportProjectsToCSV(
  projects: Project[],
  entityLabel = "Project",
): void {
  const headers = [
    "ID",
    `${entityLabel} Name`,
    "Status",
    "Priority",
    "Tags",
    "Description",
    "Created At",
    "Updated At",
  ];
  const rows = projects.map((p) => [
    p.id,
    `"${(p.title || "").replace(/"/g, '""')}"`,
    p.status,
    p.priority || "medium",
    `"${(p.tags || []).join(", ").replace(/"/g, '""')}"`,
    `"${(p.description || "").replace(/"/g, '""')}"`,
    p.created_at,
    p.updated_at,
  ]);

  const csvContent =
    "data:text/csv;charset=utf-8," +
    [headers.join(","), ...rows.map((e) => e.join(","))].join("\n");
  const encodedUri = encodeURI(csvContent);
  const link = document.createElement("a");
  link.setAttribute("href", encodedUri);
  link.setAttribute(
    "download",
    `${entityLabel.toLowerCase().replace(/\s+/g, "-")}-export-${new Date().toISOString().slice(0, 10)}.csv`,
  );
  document.body.appendChild(link);
  link.click();
  document.body.removeChild(link);
}

export function exportProjectsToJSON(
  projects: Project[],
  entityLabel = "Project",
): void {
  const dataStr =
    "data:text/json;charset=utf-8," +
    encodeURIComponent(JSON.stringify(projects, null, 2));
  const link = document.createElement("a");
  link.setAttribute("href", dataStr);
  link.setAttribute(
    "download",
    `${entityLabel.toLowerCase().replace(/\s+/g, "-")}-export-${new Date().toISOString().slice(0, 10)}.json`,
  );
  document.body.appendChild(link);
  link.click();
  document.body.removeChild(link);
}
