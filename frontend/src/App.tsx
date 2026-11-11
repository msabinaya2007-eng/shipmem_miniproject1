import AuthPages from "./AuthPages";
import UserManagement from "./UserManagement";
import KnowledgeGraph from "./KnowledgeGraph";
import DataStructureVisualizer from "./DataStructureVisualizer";

import { useEffect, useMemo, useState, type FormEvent } from "react";
import {
  Activity, Anchor, Bell, BarChart3, CalendarDays, Check,
  ChevronRight, ClipboardList, Database, FileText, GitBranch,
  LayoutDashboard, Menu, Plus, RefreshCw, Search, Ship, Trash2,
  Wrench, X, AlertTriangle, Clock, Eye, CheckCircle2,
  CircleAlert, Waves, Filter, Download, ChevronLeft, LogOut, Users
} from "lucide-react";

import {
  getToken,
  logout,
  fetchCurrentUser,
  onAuthFailure,
  apiGet,
  apiPost,
  fetchNotifications,
  markNotificationRead,
  deleteNotification,
  fetchActivityHistory,
  fetchCalendarEvents,
  fetchVesselDetails,
  type User,
  type Notification,
  type Activity as ActivityRecord,
  type CalendarEvent,
  type VesselDetails
} from "./api";

// ---------------- TYPES ----------------

type Page =
  | "Overview"
  | "Vessels"
  | "Maintenance"
  | "Repairs"
  | "Incidents"
  | "Inspections"
  | "Knowledge Graph"
  | "Maintenance Calendar"
  | "Activity History"
  | "Data Structure Visualizer"
  | "Reports"
  | "User Management";

interface Vessel {
  vessel_id: number;
  vessel_name: string;
  vessel_type: string | null;
  imo_number: string | null;
  status: string | null;
}

interface Maintenance {
  record_id: number;
  vessel_id: number;
  component: string | null;
  description: string | null;
  maintenance_date: string | null;
  status: string | null;
}

interface Repair {
  repair_id: number;
  vessel_id: number;
  component: string | null;
  repair_description: string | null;
  repair_date: string | null;
  status: string | null;
}

interface Incident {
  incident_id: number;
  vessel_id: number;
  component: string | null;
  description: string | null;
  severity: string | null;
  incident_date: string | null;
  status: string | null;
}

interface Inspection {
  inspection_id: number;
  vessel_id: number;
  inspection_type: string | null;
  inspection_date: string | null;
  result: string | null;
}

interface ActivityResponse {
  activities: string[];
}

interface QueueResponse {
  tasks: string[];
}

interface GraphData {
  [key: string]: string[];
}

interface FormField {
  name: string;
  label: string;
  type?: string;
  required?: boolean;
  options?: string[];
}

interface PageConfiguration {
  title: string;
  description: string;
  columns: { key: string; label: string }[];
  fields: FormField[];
  endpoint: string;
}

type RecordValue = string | number | null;
type RecordRow = Record<string, RecordValue>;

// ---------------- PAGE CONFIGURATION ----------------

const pageConfig: Record<Page, PageConfiguration> = {
  Overview: {
    title: "Overview",
    description: "Your vessel operations at a glance.",
    endpoint: "",
    columns: [],
    fields: []
  },

  Vessels: {
    title: "Vessel Management",
    description: "Manage your registered vessels.",
    endpoint: "/vessels",
    columns: [
      { key: "vessel_name", label: "Vessel Name" },
      { key: "vessel_type", label: "Vessel Type" },
      { key: "imo_number", label: "IMO Number" },
      { key: "status", label: "Status" }
    ],
    fields: [
      { name: "vessel_name", label: "Vessel Name", required: true },
      { name: "vessel_type", label: "Vessel Type", required: true },
      { name: "imo_number", label: "IMO Number" },
      {
        name: "status",
        label: "Status",
        options: ["Active", "Inactive", "Under Maintenance"]
      }
    ]
  },

  Maintenance: {
    title: "Maintenance Records",
    description: "Track scheduled and completed maintenance.",
    endpoint: "/maintenance",
    columns: [
      { key: "vessel_id", label: "Vessel ID" },
      { key: "component", label: "Component" },
      { key: "description", label: "Description" },
      { key: "maintenance_date", label: "Date" },
      { key: "status", label: "Status" }
    ],
    fields: [
      { name: "vessel_id", label: "Vessel ID", type: "number", required: true },
      { name: "component", label: "Component", required: true },
      { name: "description", label: "Description", required: true },
      { name: "maintenance_date", label: "Maintenance Date", type: "date", required: true },
      {
        name: "status",
        label: "Status",
        options: ["Pending", "In Progress", "Completed"]
      }
    ]
  },

  Repairs: {
    title: "Repair Records",
    description: "Keep track of vessel repairs and work completed.",
    endpoint: "/repairs",
    columns: [
      { key: "vessel_id", label: "Vessel ID" },
      { key: "component", label: "Component" },
      { key: "repair_description", label: "Description" },
      { key: "repair_date", label: "Repair Date" },
      { key: "status", label: "Status" }
    ],
    fields: [
      { name: "vessel_id", label: "Vessel ID", type: "number", required: true },
      { name: "component", label: "Component", required: true },
      { name: "repair_description", label: "Repair Description", required: true },
      { name: "repair_date", label: "Repair Date", type: "date", required: true },
      {
        name: "status",
        label: "Status",
        options: ["Completed", "Pending", "In Progress"]
      }
    ]
  },

  Incidents: {
    title: "Incident Reports",
    description: "Record and monitor operational incidents.",
    endpoint: "/incidents",
    columns: [
      { key: "vessel_id", label: "Vessel ID" },
      { key: "component", label: "Component" },
      { key: "description", label: "Description" },
      { key: "severity", label: "Severity" },
      { key: "incident_date", label: "Date" },
      { key: "status", label: "Status" }
    ],
    fields: [
      { name: "vessel_id", label: "Vessel ID", type: "number", required: true },
      { name: "component", label: "Component", required: true },
      { name: "description", label: "Description", required: true },
      {
        name: "severity",
        label: "Severity",
        options: ["Low", "Medium", "High", "Critical"]
      },
      { name: "incident_date", label: "Incident Date", type: "date", required: true },
      {
        name: "status",
        label: "Status",
        options: ["Open", "Under Investigation", "Resolved"]
      }
    ]
  },

  Inspections: {
    title: "Inspection Records",
    description: "Review vessel inspections and their results.",
    endpoint: "/inspections",
    columns: [
      { key: "vessel_id", label: "Vessel ID" },
      { key: "inspection_type", label: "Inspection Type" },
      { key: "inspection_date", label: "Inspection Date" },
      { key: "result", label: "Result" }
    ],
    fields: [
      { name: "vessel_id", label: "Vessel ID", type: "number", required: true },
      { name: "inspection_type", label: "Inspection Type", required: true },
      { name: "inspection_date", label: "Inspection Date", type: "date", required: true },
      {
        name: "result",
        label: "Inspection Result",
        options: ["Passed", "Failed", "Requires Attention"]
      }
    ]
  },

  "Knowledge Graph": {
    title: "Knowledge Graph",
    description: "Explore relationships between operational components.",
    endpoint: "/graph",
    columns: [],
    fields: []
  },

  "Maintenance Calendar": {
    title: "Maintenance Calendar",
    description: "View scheduled maintenance and inspections.",
    endpoint: "/calendar",
    columns: [],
    fields: []
  },

  "Activity History": {
    title: "Activity History",
    description: "Review your permanent operational activity records.",
    endpoint: "/activity-history",
    columns: [],
    fields: []
  },

  "Data Structure Visualizer": {
    title: "Data Structure Visualizer",
    description: "Explore the data structures powering SHIPMEM.",
    endpoint: "",
    columns: [],
    fields: []
  },

  Reports: {
    title: "Reports & Analytics",
    description: "A summary of your vessel operations.",
    endpoint: "",
    columns: [],
    fields: []
  },

  "User Management": {
    title: "User Management",
    description: "Manage system accounts, user roles, and access credentials.",
    endpoint: "",
    columns: [],
    fields: []
  }
};

type AuthState = "loading" | "unauthenticated" | "authenticated";

// ---------------- MAIN APPLICATION ----------------

export default function App() {
  const [authState, setAuthState] = useState<AuthState>("loading");
  const [currentUser, setCurrentUser] = useState<User | null>(null);

  const [page, setPage] = useState<Page>("Overview");
  const [sidebarOpen, setSidebarOpen] = useState(true);
  const [vessels, setVessels] = useState<Vessel[]>([]);
  const [maintenance, setMaintenance] = useState<Maintenance[]>([]);
  const [repairs, setRepairs] = useState<Repair[]>([]);
  const [incidents, setIncidents] = useState<Incident[]>([]);
  const [inspections, setInspections] = useState<Inspection[]>([]);
  const [activities, setActivities] = useState<string[]>([]);
  const [activityHistory, setActivityHistory] = useState<ActivityRecord[]>([]);
  const [queue, setQueue] = useState<string[]>([]);
  const [graph, setGraph] = useState<GraphData>({});
  const [calendarEvents, setCalendarEvents] = useState<CalendarEvent[]>([]);

  const [notifications, setNotifications] = useState<Notification[]>([]);
  const [notificationOpen, setNotificationOpen] = useState(false);

  const [loading, setLoading] = useState(true);
  const [formOpen, setFormOpen] = useState(false);
  const [saving, setSaving] = useState(false);
  const [search, setSearch] = useState("");
  const [statusFilter, setStatusFilter] = useState("All");
  const [vesselFilter, setVesselFilter] = useState("All");
  const [error, setError] = useState("");
  const [successMessage, setSuccessMessage] = useState("");

  const [selectedVessel, setSelectedVessel] = useState<VesselDetails | null>(null);
  const [vesselDetailsLoading, setVesselDetailsLoading] = useState(false);

  // ---------------- NAVIGATION PERMISSIONS ----------------

  const navigation = useMemo(() => {
    const items = [
      { label: "Overview" as Page, icon: LayoutDashboard },
      { label: "Vessels" as Page, icon: Ship },
      { label: "Maintenance" as Page, icon: Wrench },
      { label: "Repairs" as Page, icon: ClipboardList },
      { label: "Incidents" as Page, icon: AlertTriangle },
      { label: "Inspections" as Page, icon: Eye },
      { label: "Maintenance Calendar" as Page, icon: CalendarDays },
      { label: "Activity History" as Page, icon: Activity },
      { label: "Knowledge Graph" as Page, icon: GitBranch },
      { label: "Data Structure Visualizer" as Page, icon: Database },
      { label: "Reports" as Page, icon: BarChart3 },
    ];

    if (currentUser?.role === "SUPER_ADMIN" || currentUser?.role === "ADMIN") {
      items.push({ label: "User Management" as Page, icon: Users });
    }

    return items;
  }, [currentUser?.role]);

  // ---------------- AUTHENTICATION & LIFECYCLE ----------------

  function handleLogout() {
    logout();
    setCurrentUser(null);
    setAuthState("unauthenticated");
    setVessels([]);
    setMaintenance([]);
    setRepairs([]);
    setIncidents([]);
    setInspections([]);
    setActivities([]);
    setActivityHistory([]);
    setCalendarEvents([]);
    setNotifications([]);
    setQueue([]);
    setGraph({});
    setPage("Overview");
    setError("");
    setSuccessMessage("");
  }

  // Step 1: Session check on startup (never calls operational APIs)
  useEffect(() => {
    let isMounted = true;

    async function initSession() {
      const token = getToken();
      if (!token) {
        if (isMounted) {
          setAuthState("unauthenticated");
          setCurrentUser(null);
        }
        return;
      }

      try {
        const user = await fetchCurrentUser();
        if (!isMounted) return;

        if (!user.is_active) {
          logout();
          setAuthState("unauthenticated");
          setCurrentUser(null);
          return;
        }

        setCurrentUser(user);
        setAuthState("authenticated");
      } catch {
        if (!isMounted) return;
        logout();
        setAuthState("unauthenticated");
        setCurrentUser(null);
      }
    }

    void initSession();

    return () => {
      isMounted = false;
    };
  }, []);

  // Step 2: Load dashboard data only AFTER successful authentication
  useEffect(() => {
    if (authState !== "authenticated" || !currentUser) {
      return;
    }

    let isMounted = true;

    const timer = window.setTimeout(() => {
      if (isMounted) {
        void loadAll();
        void loadNotifications();
      }
    }, 0);

    return () => {
      isMounted = false;
      window.clearTimeout(timer);
    };
  }, [authState, currentUser?.user_id]);

  // Step 3: Listen for 401 unauthorized errors across requests
  useEffect(() => {
    return onAuthFailure(() => {
      handleLogout();
    });
  }, []);

  // ---------------- LOAD DATA ----------------

  async function loadAll() {
    setLoading(true);
    setError("");

    try {
      const results = await Promise.all([
        apiGet<Vessel[]>("/vessels"),
        apiGet<Maintenance[]>("/maintenance"),
        apiGet<Repair[]>("/repairs"),
        apiGet<Incident[]>("/incidents"),
        apiGet<Inspection[]>("/inspections"),
        apiGet<ActivityResponse>("/activities"),
        apiGet<QueueResponse>("/maintenance-queue"),
        apiGet<GraphData>("/graph")
      ]);

      setVessels(results[0]);
      setMaintenance(results[1]);
      setRepairs(results[2]);
      setIncidents(results[3]);
      setInspections(results[4]);
      setActivities(results[5].activities);
      setQueue(results[6].tasks);
      setGraph(results[7]);

      const [history, events] = await Promise.all([
        fetchActivityHistory(),
        fetchCalendarEvents()
      ]);

      setActivityHistory(history);
      setCalendarEvents(events);
    } catch (err) {
      setError(
        err instanceof Error
          ? err.message
          : "Unable to connect to the backend. Make sure your FastAPI server is running."
      );
    } finally {
      setLoading(false);
    }
  }

  async function loadNotifications() {
    try {
      const data = await fetchNotifications();
      setNotifications(data);
    } catch {
      console.error("Could not load notifications");
    }
  }

  // ---------------- NOTIFICATIONS ----------------

  const unreadCount = notifications.filter(
    (notification) => !notification.is_read
  ).length;

  async function handleMarkRead(id: number) {
    try {
      await markNotificationRead(id);
      await loadNotifications();
    } catch {
      setError("Could not update notification.");
    }
  }

  async function handleDeleteNotification(id: number) {
    try {
      await deleteNotification(id);
      await loadNotifications();
    } catch {
      setError("Could not delete notification.");
    }
  }

  // ---------------- VESSEL DETAILS ----------------

  async function openVesselDetails(vesselId: number) {
    setVesselDetailsLoading(true);
    setError("");

    try {
      const details = await fetchVesselDetails(vesselId);
      setSelectedVessel(details);
    } catch (err) {
      setError(
        err instanceof Error ? err.message : "Unable to load vessel details."
      );
    } finally {
      setVesselDetailsLoading(false);
    }
  }

  // ---------------- FORM SUBMISSION ----------------

  async function handleSubmit(
    event: FormEvent<HTMLFormElement>,
    values: Record<string, string>
  ) {
    event.preventDefault();

    setSaving(true);
    setError("");

    const config = pageConfig[page];
    const payload: Record<string, string | number> = {};

    for (const field of config.fields) {
      const value = values[field.name] ?? "";

      if (field.type === "number") {
        payload[field.name] = Number(value);
      } else if (value !== "") {
        payload[field.name] = value;
      }
    }

    try {
      await apiPost(config.endpoint, payload);

      setFormOpen(false);
      setSuccessMessage(`${config.title} added successfully!`);

      await loadAll();
      await loadNotifications();

      window.setTimeout(() => setSuccessMessage(""), 3500);
    } catch (err) {
      setError(
        err instanceof Error ? err.message : "Unable to save record."
      );
    } finally {
      setSaving(false);
    }
  }

  // ---------------- PAGE DATA ----------------

  const pageData: Record<Page, RecordRow[]> = {
    Overview: [],
    Vessels: vessels.map((item) => ({
      vessel_id: item.vessel_id,
      vessel_name: item.vessel_name,
      vessel_type: item.vessel_type,
      imo_number: item.imo_number,
      status: item.status
    })),
    Maintenance: maintenance.map((item) => ({
      record_id: item.record_id,
      vessel_id: item.vessel_id,
      component: item.component,
      description: item.description,
      maintenance_date: item.maintenance_date,
      status: item.status
    })),
    Repairs: repairs.map((item) => ({
      repair_id: item.repair_id,
      vessel_id: item.vessel_id,
      component: item.component,
      repair_description: item.repair_description,
      repair_date: item.repair_date,
      status: item.status
    })),
    Incidents: incidents.map((item) => ({
      incident_id: item.incident_id,
      vessel_id: item.vessel_id,
      component: item.component,
      description: item.description,
      severity: item.severity,
      incident_date: item.incident_date,
      status: item.status
    })),
    Inspections: inspections.map((item) => ({
      inspection_id: item.inspection_id,
      vessel_id: item.vessel_id,
      inspection_type: item.inspection_type,
      inspection_date: item.inspection_date,
      result: item.result
    })),
    "Knowledge Graph": [],
    "Maintenance Calendar": [],
    "Activity History": [],
    "Data Structure Visualizer": [],
    Reports: [],
    "User Management": []
  };

  const hasStatusFilter = ["Maintenance", "Repairs", "Incidents", "Inspections", "Vessels"].includes(page);

  const filteredData = useMemo(() => {
    return pageData[page].filter((item) => {
      const matchesSearch = Object.values(item).some((value) =>
        String(value ?? "").toLowerCase().includes(search.toLowerCase())
      );

      const matchesStatus =
        statusFilter === "All" ||
        String(item.status ?? item.severity ?? item.result ?? "").toLowerCase() ===
          statusFilter.toLowerCase();

      const matchesVessel =
        vesselFilter === "All" ||
        String(item.vessel_id ?? "") === vesselFilter;

      return matchesSearch && matchesStatus && matchesVessel;
    });
  }, [pageData, page, search, statusFilter, vesselFilter]);

  // ---------------- CSV EXPORT ----------------

  function exportCSV(rows: RecordRow[], filename: string) {
    if (rows.length === 0) {
      setError("There are no records to export.");
      return;
    }

    const headers = Array.from(
      new Set(rows.flatMap((row) => Object.keys(row)))
    );

    const escapeCSV = (value: RecordValue) => {
      const text = String(value ?? "");
      return `"${text.replace(/"/g, '""')}"`;
    };

    const csv = [
      headers.map(escapeCSV).join(","),
      ...rows.map((row) =>
        headers.map((header) => escapeCSV(row[header] ?? null)).join(",")
      )
    ].join("\n");

    const blob = new Blob(["\uFEFF" + csv], {
      type: "text/csv;charset=utf-8;"
    });

    const url = URL.createObjectURL(blob);
    const link = document.createElement("a");

    link.href = url;
    link.download = filename;
    link.click();

    URL.revokeObjectURL(url);
  }

  function exportCurrentPage() {
    exportCSV(
      filteredData,
      `${page.toLowerCase().replace(/\s+/g, "-")}-report.csv`
    );
  }

  function printReport() {
    window.print();
  }

  if (authState === "loading") {
    return (
      <div className="flex min-h-screen items-center justify-center bg-[#f6f8f4] text-[#263d3b]">
        <div className="flex flex-col items-center">
          <div className="flex h-16 w-16 animate-pulse items-center justify-center rounded-2xl bg-[#315f58] text-white shadow-lg">
            <Anchor size={32} />
          </div>
          <p className="mt-4 text-xs font-bold uppercase tracking-[0.25em] text-[#246359]">
            SHIPMEM
          </p>
          <p className="mt-2 text-sm font-medium text-[#264d45]">
            Initializing authentication session...
          </p>
        </div>
      </div>
    );
  }

  if (authState === "unauthenticated" || !currentUser) {
    return (
      <AuthPages
        onLoginSuccess={(user) => {
          setCurrentUser(user);
          setAuthState("authenticated");
        }}
      />
    );
  }

  // ---------------- RENDER ----------------

  return (
    <div className="min-h-screen bg-[#f6f8f5] text-[#203b49]">

      {/* SIDEBAR */}

      <aside
        className={`fixed left-0 top-0 z-30 flex h-screen flex-col border-r border-[#e3eae5] bg-[#fffefa] transition-all duration-300 ${
          sidebarOpen ? "w-64" : "w-20"
        }`}
      >
        <div className="flex h-20 items-center gap-3 border-b border-[#e8eee9] px-5">
          <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-[#dceeea] text-[#267d79]">
            <Anchor size={23} />
          </div>

          {sidebarOpen && (
            <div>
              <h1 className="text-xl font-extrabold tracking-wide text-[#0f2d3a]">
                SHIPMEM
              </h1>
              <p className="text-[10px] font-bold uppercase tracking-[2px] text-[#365750]">
                Maritime Intelligence
              </p>
            </div>
          )}
        </div>

        <div className="overflow-y-auto px-4 pt-7">
          {sidebarOpen && (
            <p className="mb-3 px-3 text-[10px] font-extrabold uppercase tracking-[2px] text-[#2c4d46]">
              Workspace
            </p>
          )}

          <nav className="space-y-1">
            {navigation.map((item) => {
              const Icon = item.icon;
              const active = page === item.label;

              return (
                <button
                  key={item.label}
                  title={sidebarOpen ? undefined : item.label}
                  onClick={() => {
                    setPage(item.label);
                    setSearch("");
                    setStatusFilter("All");
                    setVesselFilter("All");
                    setError("");
                    setSelectedVessel(null);
                  }}
                  className={`flex w-full items-center gap-3 rounded-xl px-3 py-3 text-sm transition ${
                    active
                      ? "bg-[#e0f1ec] font-bold text-[#0f5c54] shadow-xs"
                      : "font-medium text-[#264842] hover:bg-[#ebf4ef] hover:text-[#0f2d3a]"
                  }`}
                >
                  <Icon size={19} className={active ? "text-[#0f5c54]" : "text-[#365750]"} />
                  {sidebarOpen && <span>{item.label}</span>}
                  {active && sidebarOpen && (
                    <ChevronRight size={15} className="ml-auto text-[#0f5c54]" />
                  )}
                </button>
              );
            })}
          </nav>
        </div>

        <div className="mt-auto border-t border-[#e8eee9] p-4">
          <div className="flex items-center gap-3 rounded-xl bg-[#edf5f0] p-3 border border-[#dce8df]">
            <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-full bg-[#d5ebe3] text-[#115e54]">
              <Waves size={18} />
            </div>
            {sidebarOpen && (
              <div className="min-w-0 flex-1">
                <p className="truncate text-xs font-bold text-[#0f2d3a]" title={currentUser.full_name}>
                  {currentUser.full_name}
                </p>
                <p className="text-[11px] font-bold text-[#14645b]">
                  {currentUser.role === "SUPER_ADMIN"
                    ? "Super Admin"
                    : currentUser.role === "ADMIN"
                      ? "Admin"
                      : "Staff"}
                </p>
              </div>
            )}
            {sidebarOpen && (
              <button
                onClick={handleLogout}
                title="Log Out"
                className="rounded-lg p-1.5 text-[#416058] transition hover:bg-[#fae8e5] hover:text-[#b43424]"
              >
                <LogOut size={16} />
              </button>
            )}
          </div>
        </div>
      </aside>

      {/* MAIN CONTENT */}

      <main
        className={`min-h-screen transition-all duration-300 ${
          sidebarOpen ? "ml-64" : "ml-20"
        }`}
      >

        {/* HEADER */}

        <header className="sticky top-0 z-20 flex h-20 items-center justify-between border-b border-[#e4ebe5] bg-[#fffefa]/95 px-8 backdrop-blur">
          <div className="flex items-center gap-4">
            <button
              onClick={() => setSidebarOpen(!sidebarOpen)}
              className="rounded-lg p-2 text-[#264d45] hover:bg-[#ebf4ef]"
            >
              <Menu size={21} />
            </button>

            <div>
              <p className="text-xs font-semibold uppercase tracking-wider text-[#3d635b]">
                SHIPMEM / Workspace
              </p>
              <h2 className="text-base font-bold text-[#0f2d3a]">
                {page}
              </h2>
            </div>
          </div>

          <div className="flex items-center gap-3">
            <div className="hidden items-center gap-2 rounded-xl border border-[#d5dfd8] bg-white px-3 py-2 md:flex">
              <Search size={16} className="text-[#3d635b]" />
              <input
                value={search}
                onChange={(event) => setSearch(event.target.value)}
                placeholder="Search records..."
                className="w-40 bg-transparent text-xs font-medium text-[#0f2d3a] outline-none placeholder:text-[#52726b]"
              />
            </div>

            <div className="relative">
              <button
                onClick={() => setNotificationOpen(!notificationOpen)}
                className="relative rounded-xl border border-[#d5dfd8] bg-white p-2.5 text-[#264d45] hover:bg-[#ebf4ef]"
              >
                <Bell size={19} />
                {unreadCount > 0 && (
                  <span className="absolute -right-1 -top-1 flex h-5 min-w-5 items-center justify-center rounded-full bg-[#d9381e] px-1 text-[10px] font-extrabold text-white">
                    {unreadCount}
                  </span>
                )}
              </button>

              {notificationOpen && (
                <div className="absolute right-0 top-14 z-50 w-80 rounded-2xl border border-[#d5ded7] bg-white p-4 shadow-xl">
                  <div className="mb-3 flex items-center justify-between">
                    <h3 className="font-bold text-[#0f2d3a]">
                      Notifications
                    </h3>
                    <button
                      onClick={() => setNotificationOpen(false)}
                      className="text-[#3d635b] hover:text-[#0f2d3a]"
                    >
                      <X size={17} />
                    </button>
                  </div>

                  <div className="max-h-80 space-y-2 overflow-y-auto">
                    {notifications.length === 0 ? (
                      <p className="py-8 text-center text-sm font-medium text-[#4a6b63]">
                        No notifications yet.
                      </p>
                    ) : (
                      notifications.map((notification) => (
                        <div
                          key={notification.notification_id}
                          className={`rounded-xl border p-3 ${
                            notification.is_read
                              ? "border-[#edf0ec] bg-white"
                              : "border-[#cce5da] bg-[#eef7f2]"
                          }`}
                        >
                          <div className="flex items-start justify-between gap-2">
                            <div>
                              <p className="text-xs font-bold text-[#0f2d3a]">
                                {notification.notification_type}
                              </p>
                              <p className="mt-1 text-xs font-medium leading-relaxed text-[#23453e]">
                                {notification.message}
                              </p>
                              <p className="mt-2 text-[10px] font-semibold text-[#486b62]">
                                {new Date(notification.created_at).toLocaleString()}
                              </p>
                            </div>

                            <div className="flex gap-1">
                              {!notification.is_read && (
                                <button
                                  onClick={() =>
                                    void handleMarkRead(notification.notification_id)
                                  }
                                  title="Mark as read"
                                  className="rounded-lg p-1.5 text-[#1b6b5c] hover:bg-[#d8ece2]"
                                >
                                  <Check size={14} />
                                </button>
                              )}

                              <button
                                onClick={() =>
                                  void handleDeleteNotification(notification.notification_id)
                                }
                                title="Delete notification"
                                className="rounded-lg p-1.5 text-[#a83222] hover:bg-[#fae6e4]"
                              >
                                <Trash2 size={14} />
                              </button>
                            </div>
                          </div>
                        </div>
                      ))
                    )}
                  </div>
                </div>
              )}
            </div>

            <button
              onClick={() => {
                void loadAll();
                void loadNotifications();
              }}
              className="rounded-xl border border-[#d5dfd8] bg-white p-2.5 text-[#264d45] hover:bg-[#ebf4ef]"
              title="Refresh"
            >
              <RefreshCw size={18} />
            </button>

            {/* USER BADGE & LOGOUT BUTTON */}
            <div className="hidden items-center gap-3 border-l border-[#d5ded8] pl-3 sm:flex">
              <div className="text-right">
                <p className="max-w-[160px] truncate text-xs font-bold text-[#0f2d3a]" title={currentUser.full_name}>
                  {currentUser.full_name}
                </p>
                <span className="inline-block rounded-md bg-[#d8ece4] px-2 py-0.5 text-[10px] font-extrabold text-[#0f5c54]">
                  {currentUser.role === "SUPER_ADMIN"
                    ? "Super Admin"
                    : currentUser.role === "ADMIN"
                      ? "Admin"
                      : "Staff"}
                </span>
              </div>
              <button
                onClick={handleLogout}
                className="flex items-center gap-1.5 rounded-xl border border-[#d5ded8] bg-white px-3 py-2 text-xs font-bold text-[#264d45] transition hover:border-[#fca5a5] hover:bg-[#fef2f2] hover:text-[#991b1b]"
                title="Log out of SHIPMEM"
              >
                <LogOut size={15} />
                <span className="hidden md:inline">Log Out</span>
              </button>
            </div>
          </div>
        </header>

        {/* PAGE CONTENT */}

        <div className="mx-auto max-w-[1500px] px-8 py-8">

          {error && (
            <div className="mb-5 flex items-center gap-3 rounded-xl border border-[#f0d5ce] bg-[#fff3ef] p-4 text-sm text-[#b76559]">
              <CircleAlert size={18} />
              {error}
              <button
                onClick={() => setError("")}
                className="ml-auto"
              >
                <X size={16} />
              </button>
            </div>
          )}

          {successMessage && (
            <div className="mb-5 flex items-center gap-3 rounded-xl border border-[#d3e9dd] bg-[#edf8f1] p-4 text-sm text-[#39836b]">
              <CheckCircle2 size={18} />
              {successMessage}
            </div>
          )}

          {/* PAGE HEADING */}

          {page !== "User Management" && (
            <div className="mb-8 flex flex-wrap items-end justify-between gap-4">
              <div>
                <div className="mb-2 flex items-center gap-2 text-xs font-bold uppercase tracking-[2px] text-[#246359]">
                  <Waves size={15} />
                  Maritime Operations
                </div>

                <h1 className="text-3xl font-extrabold tracking-tight text-[#0f2d3a]">
                  {pageConfig[page].title}
                </h1>

                <p className="mt-2 text-sm font-medium text-[#2d4d46]">
                  {pageConfig[page].description}
                </p>
              </div>

              <div className="flex flex-wrap gap-2">
                {["Vessels", "Maintenance", "Repairs", "Incidents", "Inspections"].includes(page) && (
                  <>
                    <button
                      onClick={exportCurrentPage}
                      className="flex items-center gap-2 rounded-xl border border-[#cad8ce] bg-white px-4 py-3 text-sm font-bold text-[#1a564c] hover:bg-[#eef5f1]"
                    >
                      <Download size={16} />
                      CSV
                    </button>

                    <button
                      onClick={printReport}
                      className="flex items-center gap-2 rounded-xl border border-[#cad8ce] bg-white px-4 py-3 text-sm font-bold text-[#1a564c] hover:bg-[#eef5f1]"
                    >
                      <FileText size={16} />
                      PDF
                    </button>

                    <button
                      onClick={() => setFormOpen(true)}
                      className="flex items-center gap-2 rounded-xl bg-[#186862] px-5 py-3 text-sm font-bold text-white shadow-sm transition hover:bg-[#12534e]"
                    >
                      <Plus size={17} />
                      Add {page === "Vessels" ? "Vessel" : "Record"}
                    </button>
                  </>
                )}
              </div>
            </div>
          )}

          {/* OVERVIEW */}

          {page === "Overview" && (
            <Overview
              vessels={vessels}
              maintenance={maintenance}
              repairs={repairs}
              incidents={incidents}
              inspections={inspections}
              queue={queue}
              activities={activities}
              setPage={setPage}
            />
          )}

          {/* TABLE PAGES */}

          {["Vessels", "Maintenance", "Repairs", "Incidents", "Inspections"].includes(page) && (
            <>
              <div className="mb-5 flex flex-wrap items-center gap-3 rounded-2xl border border-[#d5ded8] bg-white p-4">
                <div className="flex items-center gap-2 text-xs font-bold text-[#1f4740]">
                  <Filter size={16} />
                  Filters
                </div>

                {hasStatusFilter && (
                  <select
                    value={statusFilter}
                    onChange={(event) => setStatusFilter(event.target.value)}
                    className="rounded-lg border border-[#cad8ce] bg-[#fbfcfa] px-3 py-2 text-xs font-semibold text-[#133844] outline-none"
                  >
                    <option value="All">All statuses / results</option>
                    <option value="Active">Active</option>
                    <option value="Inactive">Inactive</option>
                    <option value="Pending">Pending</option>
                    <option value="In Progress">In Progress</option>
                    <option value="Completed">Completed</option>
                    <option value="Open">Open</option>
                    <option value="Resolved">Resolved</option>
                    <option value="High">High</option>
                    <option value="Critical">Critical</option>
                    <option value="Passed">Passed</option>
                    <option value="Failed">Failed</option>
                    <option value="Requires Attention">Requires Attention</option>
                  </select>
                )}

                {page !== "Vessels" && (
                  <select
                    value={vesselFilter}
                    onChange={(event) => setVesselFilter(event.target.value)}
                    className="rounded-lg border border-[#cad8ce] bg-[#fbfcfa] px-3 py-2 text-xs font-semibold text-[#133844] outline-none"
                  >
                    <option value="All">All vessels</option>
                    {vessels.map((vessel) => (
                      <option key={vessel.vessel_id} value={String(vessel.vessel_id)}>
                        {vessel.vessel_name}
                      </option>
                    ))}
                  </select>
                )}

                <button
                  onClick={() => {
                    setStatusFilter("All");
                    setVesselFilter("All");
                    setSearch("");
                  }}
                  className="ml-auto text-xs font-bold text-[#1a5c52] hover:underline"
                >
                  Clear filters
                </button>
              </div>

              <div className="overflow-hidden rounded-2xl border border-[#d5ded8] bg-white shadow-sm">
                <div className="flex items-center justify-between border-b border-[#edf0eb] px-6 py-5">
                  <div>
                    <h3 className="text-base font-bold text-[#0f2d3a]">
                      {page} Directory
                    </h3>
                    <p className="mt-1 text-xs font-semibold text-[#3d635b]">
                      {filteredData.length} records found
                    </p>
                  </div>

                  <div className="rounded-lg bg-[#dcefe5] px-3 py-1.5 text-xs font-bold text-[#0f5c54]">
                    Live database
                  </div>
                </div>

                {loading ? (
                  <div className="p-12 text-center text-sm font-medium text-[#3d635b]">
                    Loading records...
                  </div>
                ) : filteredData.length === 0 ? (
                  <EmptyState
                    title="No records found"
                    description="Try changing your filters or add a new record."
                  />
                ) : (
                  <div className="overflow-x-auto">
                    <table className="w-full text-left">
                      <thead className="bg-[#edf4ee]">
                        <tr>
                          {pageConfig[page].columns.map((column) => (
                            <th
                              key={column.key}
                              className="whitespace-nowrap px-6 py-4 text-[11px] font-bold uppercase tracking-[1.5px] text-[#1c473f]"
                            >
                              {column.label}
                            </th>
                          ))}
                          {page === "Vessels" && (
                            <th className="px-6 py-4 text-[11px] font-bold uppercase tracking-[1.5px] text-[#1c473f]">
                              Details
                            </th>
                          )}
                        </tr>
                      </thead>

                      <tbody className="divide-y divide-[#edf1ec]">
                        {filteredData.map((row, index) => (
                          <tr
                            key={String(row.vessel_id ?? row.record_id ?? row.repair_id ?? row.incident_id ?? row.inspection_id ?? index)}
                            className="transition hover:bg-[#f9fbf8]"
                          >
                            {pageConfig[page].columns.map((column) => (
                              <td
                                key={column.key}
                                className="whitespace-nowrap px-6 py-4 text-sm font-medium text-[#133844]"
                              >
                                {column.key === "status" ||
                                column.key === "severity" ||
                                column.key === "result" ? (
                                  <StatusBadge value={row[column.key]} />
                                ) : (
                                  String(row[column.key] ?? "—")
                                )}
                              </td>
                            ))}

                            {page === "Vessels" && (
                              <td className="px-6 py-4">
                                <button
                                  onClick={() =>
                                    void openVesselDetails(Number(row.vessel_id))
                                  }
                                  className="flex items-center gap-1 rounded-lg bg-[#dcefe5] px-3.5 py-2 text-xs font-bold text-[#0f5c54] hover:bg-[#cae7da]"
                                >
                                  <Eye size={14} />
                                  View
                                </button>
                              </td>
                            )}
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                )}
              </div>
            </>
          )}

          {/* KNOWLEDGE GRAPH */}

          {page === "Knowledge Graph" && (
            <KnowledgeGraph graph={graph} />
          )}

          {/* MAINTENANCE CALENDAR */}

          {page === "Maintenance Calendar" && (
            <MaintenanceCalendar events={calendarEvents} />
          )}

          {/* ACTIVITY HISTORY */}

          {page === "Activity History" && (
            <ActivityHistory
              activities={activityHistory}
              onExport={() =>
                exportCSV(
                  activityHistory.map((item) => ({
                    activity_id: item.activity_id,
                    action: item.action,
                    description: item.description,
                    vessel_id: item.vessel_id,
                    created_at: item.created_at
                  })),
                  "shipmem-activity-history.csv"
                )
              }
            />
          )}

          {/* DATA STRUCTURE VISUALIZER */}

          {page === "Data Structure Visualizer" && (
            <DataStructureVisualizer
              maintenance={maintenance}
              incidents={incidents}
              inspections={inspections}
              repairs={repairs}
              activityHistory={activityHistory}
              vessels={vessels}
              graph={graph}
            />
          )}

          {/* REPORTS */}

          {page === "Reports" && (
            <Reports
              vessels={vessels}
              maintenance={maintenance}
              repairs={repairs}
              incidents={incidents}
              inspections={inspections}
              onCSV={() =>
                exportCSV(
                  [
                    { category: "Vessels", total: vessels.length },
                    { category: "Maintenance", total: maintenance.length },
                    { category: "Repairs", total: repairs.length },
                    { category: "Incidents", total: incidents.length },
                    { category: "Inspections", total: inspections.length }
                  ],
                  "shipmem-summary-report.csv"
                )
              }
              onPDF={printReport}
            />
          )}

          {/* USER MANAGEMENT */}

          {page === "User Management" && (
            currentUser.role === "STAFF" ? (
              <div className="rounded-2xl border border-[#fecaca] bg-[#fef2f2] p-8 text-center">
                <AlertTriangle className="mx-auto text-[#b91c1c]" size={36} />
                <h3 className="mt-4 text-lg font-bold text-[#0f2d3a]">
                  Access Restricted
                </h3>
                <p className="mt-2 text-sm font-medium text-[#264d45]">
                  Staff members do not have permission to access User Management.
                </p>
              </div>
            ) : (
              <UserManagement currentUser={currentUser} />
            )
          )}

        </div>
      </main>

      {/* VESSEL DETAILS MODAL */}

      {selectedVessel && (
        <VesselDetailsModal
          details={selectedVessel}
          onClose={() => setSelectedVessel(null)}
        />
      )}

      {vesselDetailsLoading && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-[#0f2d3a]/30 backdrop-blur-sm">
          <div className="rounded-xl bg-white px-6 py-4 text-sm font-bold text-[#0f2d3a] shadow-xl">
            Loading vessel details...
          </div>
        </div>
      )}

      {/* ADD RECORD MODAL */}

      {formOpen && (
        <RecordForm
          title={`Add ${page === "Vessels" ? "Vessel" : page.slice(0, -1)}`}
          fields={pageConfig[page].fields}
          saving={saving}
          onClose={() => setFormOpen(false)}
          onSubmit={handleSubmit}
        />
      )}
    </div>
  );
}

// ---------------- OVERVIEW COMPONENT ----------------

interface OverviewProps {
  vessels: Vessel[];
  maintenance: Maintenance[];
  repairs: Repair[];
  incidents: Incident[];
  inspections: Inspection[];
  queue: string[];
  activities: string[];
  setPage: (page: Page) => void;
}

function Overview({
  vessels,
  maintenance,
  repairs,
  incidents,
  inspections,
  queue,
  activities,
  setPage
}: OverviewProps) {
  const stats = [
    {
      title: "Registered Vessels",
      value: vessels.length,
      icon: Ship,
      color: "bg-[#daf0e7] text-[#146459]",
      page: "Vessels" as Page
    },
    {
      title: "Maintenance Records",
      value: maintenance.length,
      icon: Wrench,
      color: "bg-[#dce6f5] text-[#2c5387]",
      page: "Maintenance" as Page
    },
    {
      title: "Repair Records",
      value: repairs.length,
      icon: ClipboardList,
      color: "bg-[#fcecd7] text-[#9c5f18]",
      page: "Repairs" as Page
    },
    {
      title: "Reported Incidents",
      value: incidents.length,
      icon: AlertTriangle,
      color: "bg-[#fde2db] text-[#b83f2a]",
      page: "Incidents" as Page
    }
  ];

  const pendingCount = maintenance.filter(
    (item) => item.status?.toLowerCase() === "pending"
  ).length;

  return (
    <>
      <div className="mb-8 grid gap-5 sm:grid-cols-2 xl:grid-cols-4">
        {stats.map((stat) => {
          const Icon = stat.icon;

          return (
            <button
              key={stat.title}
              onClick={() => setPage(stat.page)}
              className="rounded-2xl border border-[#d5ded8] bg-white p-6 text-left shadow-sm transition hover:-translate-y-1 hover:shadow-md"
            >
              <div className="flex items-center justify-between">
                <div className={`rounded-xl p-3 ${stat.color}`}>
                  <Icon size={21} />
                </div>
                <ChevronRight size={17} className="text-[#3d635b]" />
              </div>

              <p className="mt-5 text-3xl font-extrabold text-[#0f2d3a]">
                {stat.value}
              </p>

              <p className="mt-1 text-xs font-bold text-[#294c44]">
                {stat.title}
              </p>
            </button>
          );
        })}
      </div>

      <div className="mb-8 rounded-2xl border border-[#d5ded8] bg-white p-6">
        <div className="mb-6 flex items-center justify-between">
          <div>
            <h3 className="font-bold text-[#0f2d3a]">
              Operational Snapshot
            </h3>
            <p className="mt-1 text-xs font-semibold text-[#3d635b]">
              Current system activity
            </p>
          </div>
          <BarChart3 size={21} className="text-[#146459]" />
        </div>

        <div className="grid grid-cols-2 gap-4 sm:grid-cols-4">
          <SnapshotCard
            label="Pending Maintenance"
            value={pendingCount}
            icon={<Clock size={17} />}
            style="bg-[#daf0e7] text-[#146459]"
          />
          <SnapshotCard
            label="Maintenance Queue"
            value={queue.length}
            icon={<CalendarDays size={17} />}
            style="bg-[#fcecd7] text-[#9c5f18]"
          />
          <SnapshotCard
            label="Inspections"
            value={inspections.length}
            icon={<ClipboardList size={17} />}
            style="bg-[#dce6f5] text-[#2c5387]"
          />
          <SnapshotCard
            label="Activity History"
            value={activities.length}
            icon={<Activity size={17} />}
            style="bg-[#fde2db] text-[#b83f2a]"
          />
        </div>
      </div>

      <div className="rounded-2xl border border-[#d5ded8] bg-white p-6">
        <div className="mb-5 flex items-center justify-between">
          <div>
            <h3 className="font-bold text-[#0f2d3a]">
              Recent Activity
            </h3>
            <p className="mt-1 text-xs font-semibold text-[#3d635b]">
              Latest recorded operations
            </p>
          </div>
          <Activity size={20} className="text-[#146459]" />
        </div>

        {activities.length === 0 ? (
          <p className="py-5 text-center text-sm font-medium text-[#4a6b63]">
            No recent activity.
          </p>
        ) : (
          <div className="space-y-3">
            {[...activities].reverse().slice(0, 6).map((activity, index) => (
              <div
                key={`${activity}-${index}`}
                className="flex items-center gap-3 rounded-xl bg-[#f8faf7] p-3"
              >
                <div className="rounded-lg bg-[#d8ede3] p-2 text-[#136357]">
                  <CheckCircle2 size={16} />
                </div>
                <p className="text-sm font-semibold text-[#133844]">{activity}</p>
              </div>
            ))}
          </div>
        )}
      </div>
    </>
  );
}

function SnapshotCard({
  label,
  value,
  icon,
  style
}: {
  label: string;
  value: number;
  icon: React.ReactNode;
  style: string;
}) {
  return (
    <div className="rounded-xl bg-[#f1f7f3] p-5">
      <div className={`flex items-center gap-2 ${style}`}>
        {icon}
        <span className="text-xs font-bold">{label}</span>
      </div>
      <p className="mt-3 text-3xl font-extrabold text-[#0f2d3a]">
        {value}
      </p>
    </div>
  );
}

// ---------------- VESSEL DETAILS ----------------

function VesselDetailsModal({
  details,
  onClose
}: {
  details: VesselDetails;
  onClose: () => void;
}) {
  const vessel = details.vessel;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-[#0f2d3a]/40 p-4 backdrop-blur-sm">
      <div className="max-h-[90vh] w-full max-w-3xl overflow-y-auto rounded-2xl bg-[#fffefa] shadow-2xl">
        <div className="flex items-center justify-between border-b border-[#e8eee8] p-6">
          <div className="flex items-center gap-3">
            <div className="rounded-xl bg-[#daf0e7] p-3 text-[#146459]">
              <Ship size={23} />
            </div>
            <div>
              <h2 className="text-xl font-extrabold text-[#0f2d3a]">
                {vessel.vessel_name}
              </h2>
              <p className="text-xs font-bold text-[#365e55]">
                Vessel ID: {vessel.vessel_id}
              </p>
            </div>
          </div>

          <button onClick={onClose} className="rounded-lg p-2 text-[#365e55] hover:bg-[#ebf3ee]">
            <X size={19} />
          </button>
        </div>

        <div className="grid gap-4 p-6 sm:grid-cols-3">
          <DetailCard label="Vessel Type" value={vessel.vessel_type ?? "—"} />
          <DetailCard label="IMO Number" value={vessel.imo_number ?? "—"} />
          <DetailCard label="Status" value={vessel.status ?? "—"} />
        </div>

        <div className="grid gap-4 px-6 pb-6 sm:grid-cols-2">
          <RelatedRecords title="Maintenance" count={details.maintenance.length} />
          <RelatedRecords title="Repairs" count={details.repairs.length} />
          <RelatedRecords title="Incidents" count={details.incidents.length} />
          <RelatedRecords title="Inspections" count={details.inspections.length} />
        </div>

        <div className="space-y-5 px-6 pb-7">
          <RelatedList
            title="Maintenance Records"
            items={details.maintenance.map((item) => ({
              title: item.component ?? "Maintenance",
              description: item.description ?? "",
              date: item.maintenance_date ?? "",
              status: item.status ?? ""
            }))}
          />

          <RelatedList
            title="Repair Records"
            items={details.repairs.map((item) => ({
              title: item.component ?? "Repair",
              description: item.repair_description ?? "",
              date: item.repair_date ?? "",
              status: item.status ?? ""
            }))}
          />

          <RelatedList
            title="Incident Reports"
            items={details.incidents.map((item) => ({
              title: item.component ?? "Incident",
              description: item.description ?? "",
              date: item.incident_date ?? "",
              status: item.severity ?? ""
            }))}
          />

          <RelatedList
            title="Inspections"
            items={details.inspections.map((item) => ({
              title: item.inspection_type ?? "Inspection",
              description: item.result ?? "",
              date: item.inspection_date ?? "",
              status: ""
            }))}
          />
        </div>
      </div>
    </div>
  );
}

function DetailCard({ label, value }: { label: string; value: string }) {
  return (
    <div className="rounded-xl border border-[#d5ded8] bg-white p-4">
      <p className="text-[11px] font-bold uppercase tracking-wider text-[#2d524a]">
        {label}
      </p>
      <p className="mt-2 text-sm font-bold text-[#0f2d3a]">{value}</p>
    </div>
  );
}

function RelatedRecords({ title, count }: { title: string; count: number }) {
  return (
    <div className="rounded-xl bg-[#edf5f0] p-4">
      <p className="text-xs font-bold text-[#2d524a]">{title}</p>
      <p className="mt-1 text-2xl font-extrabold text-[#0e574e]">{count}</p>
    </div>
  );
}

function RelatedList({
  title,
  items
}: {
  title: string;
  items: { title: string; description: string; date: string; status: string }[];
}) {
  return (
    <section>
      <h3 className="mb-3 text-sm font-bold text-[#0f2d3a]">{title}</h3>
      {items.length === 0 ? (
        <p className="rounded-lg bg-[#f7faf6] p-3 text-xs font-medium text-[#4a6e65]">
          No records available.
        </p>
      ) : (
        <div className="space-y-2">
          {items.map((item, index) => (
            <div key={`${item.title}-${index}`} className="rounded-xl border border-[#d5ded8] p-3">
              <div className="flex flex-wrap items-center justify-between gap-2">
                <p className="text-sm font-bold text-[#133844]">{item.title}</p>
                <span className="text-[11px] font-semibold text-[#3d635b]">{item.date || "No date"}</span>
              </div>
              <p className="mt-1 text-xs font-medium text-[#2d4d46]">{item.description}</p>
              {item.status && (
                <p className="mt-2 text-[11px] font-bold text-[#0f5c54]">{item.status}</p>
              )}
            </div>
          ))}
        </div>
      )}
    </section>
  );
}

// ---------------- MAINTENANCE CALENDAR ----------------

function MaintenanceCalendar({ events }: { events: CalendarEvent[] }) {
  const [month, setMonth] = useState(() => {
    const now = new Date();
    return new Date(now.getFullYear(), now.getMonth(), 1);
  });

  const firstDay = new Date(month.getFullYear(), month.getMonth(), 1).getDay();
  const daysInMonth = new Date(month.getFullYear(), month.getMonth() + 1, 0).getDate();

  const days = [
    ...Array.from({ length: firstDay }, () => 0),
    ...Array.from({ length: daysInMonth }, (_, index) => index + 1)
  ];

  const monthEvents = events.filter((event) => {
    if (!event.date) return false;
    const dateValue = new Date(`${event.date}T00:00:00`);
    return (
      dateValue.getFullYear() === month.getFullYear() &&
      dateValue.getMonth() === month.getMonth()
    );
  });

  function eventsForDay(day: number) {
    const dateString = [
      month.getFullYear(),
      String(month.getMonth() + 1).padStart(2, "0"),
      String(day).padStart(2, "0")
    ].join("-");

    return monthEvents.filter((event) => event.date === dateString);
  }

  return (
    <div className="rounded-2xl border border-[#d5ded8] bg-white p-6 shadow-sm">
      <div className="mb-6 flex items-center justify-between">
        <div>
          <h3 className="font-bold text-[#0f2d3a]">Schedule Overview</h3>
          <p className="mt-1 text-xs font-semibold text-[#3d635b]">
            {monthEvents.length} events this month
          </p>
        </div>

        <div className="flex items-center gap-3">
          <button
            onClick={() => setMonth(new Date(month.getFullYear(), month.getMonth() - 1, 1))}
            className="rounded-lg border border-[#cad8ce] p-2 text-[#264d45] hover:bg-[#ebf4ef]"
          >
            <ChevronLeft size={17} />
          </button>
          <p className="min-w-32 text-center text-sm font-bold text-[#0f2d3a]">
            {month.toLocaleDateString(undefined, { month: "long", year: "numeric" })}
          </p>
          <button
            onClick={() => setMonth(new Date(month.getFullYear(), month.getMonth() + 1, 1))}
            className="rounded-lg border border-[#cad8ce] p-2 text-[#264d45] hover:bg-[#ebf4ef]"
          >
            <ChevronRight size={17} />
          </button>
        </div>
      </div>

      <div className="grid grid-cols-7 gap-2">
        {["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"].map((day) => (
          <div key={day} className="py-2 text-center text-[11px] font-bold uppercase tracking-wider text-[#204941]">
            {day}
          </div>
        ))}

        {days.map((day, index) => (
          <div
            key={`${day}-${index}`}
            className={`min-h-24 rounded-xl border p-2 ${
              day === 0 ? "border-transparent" : "border-[#dce5df] bg-[#fcfdfb]"
            }`}
          >
            {day !== 0 && (
              <>
                <p className="text-xs font-bold text-[#0f2d3a]">{day}</p>
                <div className="mt-2 space-y-1">
                  {eventsForDay(day).slice(0, 3).map((event) => (
                    <div
                      key={event.id}
                      title={`${event.title} — ${event.vessel_name}`}
                      className={`truncate rounded px-1.5 py-1 text-[10px] font-bold ${
                        event.type === "Maintenance"
                          ? "bg-[#d2ede0] text-[#0f5546]"
                          : "bg-[#dce7f7] text-[#1c487f]"
                      }`}
                    >
                      {event.title}
                    </div>
                  ))}
                  {eventsForDay(day).length > 3 && (
                    <p className="text-[10px] font-bold text-[#2d524a]">
                      +{eventsForDay(day).length - 3} more
                    </p>
                  )}
                </div>
              </>
            )}
          </div>
        ))}
      </div>

      <div className="mt-6 border-t border-[#edf1ec] pt-5">
        <h4 className="mb-3 text-sm font-bold text-[#0f2d3a]">Events this month</h4>
        {monthEvents.length === 0 ? (
          <p className="text-xs font-medium text-[#4a6e65]">No scheduled events for this month.</p>
        ) : (
          <div className="space-y-2">
            {monthEvents.map((event) => (
              <div key={event.id} className="flex flex-wrap items-center justify-between gap-2 rounded-xl bg-[#f8faf7] p-3">
                <div>
                  <p className="text-xs font-bold text-[#133844]">{event.title}</p>
                  <p className="mt-1 text-[11px] font-semibold text-[#2d524a]">{event.vessel_name}</p>
                </div>
                <p className="text-xs font-semibold text-[#0f5c54]">{event.date}</p>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}

// ---------------- ACTIVITY HISTORY ----------------

function ActivityHistory({
  activities,
  onExport
}: {
  activities: ActivityRecord[];
  onExport: () => void;
}) {
  return (
    <div className="rounded-2xl border border-[#d5ded8] bg-white p-6 shadow-sm">
      <div className="mb-6 flex items-center justify-between">
        <div>
          <h3 className="font-bold text-[#0f2d3a]">Recorded Activities</h3>
          <p className="mt-1 text-xs font-semibold text-[#3d635b]">
            {activities.length} saved activity records
          </p>
        </div>
        <button
          onClick={onExport}
          className="flex items-center gap-2 rounded-xl border border-[#cad8ce] px-4 py-2.5 text-xs font-bold text-[#185e54] hover:bg-[#eef5f1]"
        >
          <Download size={15} />
          Export CSV
        </button>
      </div>

      {activities.length === 0 ? (
        <EmptyState
          title="No activity history"
          description="New operational actions will appear here."
        />
      ) : (
        <div className="space-y-3">
          {activities.map((activity) => (
            <div key={activity.activity_id} className="flex gap-4 rounded-xl border border-[#d5ded8] p-4">
              <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-[#daf0e7] text-[#146459]">
                <Activity size={18} />
              </div>
              <div className="min-w-0 flex-1">
                <div className="flex flex-wrap items-center justify-between gap-2">
                  <h4 className="text-sm font-bold text-[#0f2d3a]">
                    {activity.action}
                  </h4>
                  <span className="text-[11px] font-semibold text-[#486b62]">
                    {new Date(activity.created_at).toLocaleString()}
                  </span>
                </div>
                <p className="mt-1 text-xs font-medium text-[#264842]">
                  {activity.description}
                </p>
                {activity.vessel_id !== null && (
                  <p className="mt-2 text-[11px] font-bold text-[#0f5c54]">
                    Vessel ID: {activity.vessel_id}
                  </p>
                )}
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}



// ---------------- REPORTS COMPONENT ----------------

interface ReportsProps {
  vessels: Vessel[];
  maintenance: Maintenance[];
  repairs: Repair[];
  incidents: Incident[];
  inspections: Inspection[];
  onCSV: () => void;
  onPDF: () => void;
}

function Reports({
  vessels,
  maintenance,
  repairs,
  incidents,
  inspections,
  onCSV,
  onPDF
}: ReportsProps) {
  const reportItems = [
    { label: "Total Vessels", value: vessels.length },
    { label: "Maintenance Records", value: maintenance.length },
    { label: "Repair Records", value: repairs.length },
    { label: "Incident Reports", value: incidents.length },
    { label: "Inspections", value: inspections.length }
  ];

  return (
    <div className="rounded-2xl border border-[#d5ded8] bg-white p-7 shadow-sm">
      <div className="mb-7 flex flex-wrap items-center justify-between gap-3">
        <div className="flex items-center gap-3">
          <div className="rounded-xl bg-[#daf0e7] p-3 text-[#146459]">
            <FileText size={22} />
          </div>
          <div>
            <h3 className="font-bold text-[#0f2d3a]">System Summary Report</h3>
            <p className="text-xs font-semibold text-[#3d635b]">Current records stored in SHIPMEM</p>
          </div>
        </div>

        <div className="flex gap-2">
          <button onClick={onCSV} className="flex items-center gap-2 rounded-xl border border-[#cad8ce] px-4 py-2.5 text-xs font-bold text-[#185e54] hover:bg-[#eef5f1]">
            <Download size={15} /> CSV
          </button>
          <button onClick={onPDF} className="flex items-center gap-2 rounded-xl border border-[#cad8ce] px-4 py-2.5 text-xs font-bold text-[#185e54] hover:bg-[#eef5f1]">
            <FileText size={15} /> Print / PDF
          </button>
        </div>
      </div>

      <div className="divide-y divide-[#edf1ec]">
        {reportItems.map((item) => (
          <div key={item.label} className="flex items-center justify-between py-5">
            <span className="text-sm font-semibold text-[#1a3d36]">{item.label}</span>
            <span className="text-xl font-extrabold text-[#0f2d3a]">{item.value}</span>
          </div>
        ))}
      </div>

      <div className="mt-6 rounded-xl bg-[#eef7f2] p-4">
        <p className="text-xs font-medium leading-relaxed text-[#1e473e]">
          This summary reflects the records currently available in the SHIPMEM database.
          Use Print / PDF to save this report as a PDF through your browser.
        </p>
      </div>
    </div>
  );
}

// ---------------- RECORD FORM ----------------

interface RecordFormProps {
  title: string;
  fields: FormField[];
  saving: boolean;
  onClose: () => void;
  onSubmit: (
    event: FormEvent<HTMLFormElement>,
    values: Record<string, string>
  ) => Promise<void>;
}

function RecordForm({
  title,
  fields,
  saving,
  onClose,
  onSubmit
}: RecordFormProps) {
  const [values, setValues] = useState<Record<string, string>>({});

  function updateValue(name: string, value: string) {
    setValues((previous) => ({
      ...previous,
      [name]: value
    }));
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-[#0f2d3a]/40 p-4 backdrop-blur-sm">
      <div className="max-h-[90vh] w-full max-w-lg overflow-y-auto rounded-2xl border border-[#d5ded8] bg-[#fffefa] shadow-2xl">
        <div className="flex items-center justify-between border-b border-[#e8eee8] px-6 py-5">
          <div>
            <h2 className="text-lg font-extrabold text-[#0f2d3a]">{title}</h2>
            <p className="mt-1 text-xs font-medium text-[#3d635b]">Enter the details below.</p>
          </div>

          <button onClick={onClose} className="rounded-lg p-2 text-[#2d524a] hover:bg-[#ebf3ee]">
            <X size={19} />
          </button>
        </div>

        <form onSubmit={(event) => void onSubmit(event, values)} className="space-y-5 p-6">
          {fields.map((field) => (
            <div key={field.name}>
              <label className="mb-2 block text-xs font-bold text-[#143c34]">
                {field.label}
                {field.required && <span className="ml-1 text-[#b91c1c] font-bold">*</span>}
              </label>

              {field.options ? (
                <select
                  required={field.required}
                  value={values[field.name] ?? ""}
                  onChange={(event) => updateValue(field.name, event.target.value)}
                  className="w-full rounded-xl border border-[#cad8ce] bg-white px-4 py-3 text-sm font-medium text-[#0f2d3a] outline-none focus:border-[#1e7a6e] focus:ring-2 focus:ring-[#d0ece1]"
                >
                  <option value="">Select {field.label}</option>
                  {field.options.map((option) => (
                    <option key={option} value={option}>{option}</option>
                  ))}
                </select>
              ) : (
                <input
                  required={field.required}
                  type={field.type ?? "text"}
                  value={values[field.name] ?? ""}
                  onChange={(event) => updateValue(field.name, event.target.value)}
                  placeholder={`Enter ${field.label.toLowerCase()}`}
                  className="w-full rounded-xl border border-[#cad8ce] bg-white px-4 py-3 text-sm font-medium text-[#0f2d3a] outline-none placeholder:text-[#64847c] focus:border-[#1e7a6e] focus:ring-2 focus:ring-[#d0ece1]"
                />
              )}
            </div>
          ))}

          <div className="flex justify-end gap-3 border-t border-[#e8eee8] pt-5">
            <button
              type="button"
              onClick={onClose}
              className="rounded-xl border border-[#cbd9ce] px-5 py-2.5 text-sm font-semibold text-[#294c44] hover:bg-[#ebf4ef]"
            >
              Cancel
            </button>

            <button
              type="submit"
              disabled={saving}
              className="flex items-center gap-2 rounded-xl bg-[#16665f] px-5 py-2.5 text-sm font-bold text-white transition hover:bg-[#10514b] disabled:opacity-60"
            >
              {saving ? "Saving..." : "Save Record"}
              {!saving && <Check size={16} />}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}

// ---------------- SMALL COMPONENTS ----------------

function StatusBadge({ value }: { value: RecordValue }) {
  const status = String(value ?? "Unknown");
  const normalized = status.toLowerCase();

  let style = "bg-[#eef2ef] text-[#2c4e47] border border-[#d6ded8]";

  if (
    normalized === "active" ||
    normalized === "completed" ||
    normalized === "passed" ||
    normalized === "resolved"
  ) {
    style = "bg-[#dcfce7] text-[#14532d] border border-[#bbf7d0]";
  } else if (
    normalized === "pending" ||
    normalized === "medium" ||
    normalized === "under investigation" ||
    normalized === "in progress"
  ) {
    style = "bg-[#fef3c7] text-[#92400e] border border-[#fde68a]";
  } else if (
    normalized === "open" ||
    normalized === "critical" ||
    normalized === "high" ||
    normalized === "failed"
  ) {
    style = "bg-[#fee2e2] text-[#991b1b] border border-[#fecaca]";
  }

  return (
    <span className={`inline-flex rounded-full px-3 py-1 text-[11px] font-bold ${style}`}>
      {status}
    </span>
  );
}

function EmptyState({
  title,
  description
}: {
  title: string;
  description: string;
}) {
  return (
    <div className="flex flex-col items-center justify-center px-6 py-16 text-center">
      <div className="mb-4 rounded-2xl bg-[#dceddf] p-4 text-[#166b5e]">
        <Database size={26} />
      </div>
      <h3 className="font-bold text-[#0f2d3a]">{title}</h3>
      <p className="mt-2 max-w-sm text-xs font-medium leading-relaxed text-[#3d635b]">
        {description}
      </p>
    </div>
  );
}