const API_URL = "http://127.0.0.1:8000";

// ---------------- TYPES ----------------

export interface User {
  user_id: number;
  full_name: string;
  email: string;
  role: "SUPER_ADMIN" | "ADMIN" | "STAFF";
  created_by: number | null;
  is_active: boolean;
  created_at: string;
}

export interface LoginResponse {
  access_token: string;
  token_type: string;
}

export interface Vessel {
  vessel_id: number;
  vessel_name: string;
  vessel_type: string | null;
  imo_number: string | null;
  status: string | null;
}

export interface Maintenance {
  record_id: number;
  vessel_id: number;
  component: string | null;
  description: string | null;
  maintenance_date: string | null;
  status: string | null;
}

export interface Incident {
  incident_id: number;
  vessel_id: number;
  component: string | null;
  description: string | null;
  severity: string | null;
  incident_date: string | null;
  status: string | null;
}

export interface Inspection {
  inspection_id: number;
  vessel_id: number;
  inspection_type: string | null;
  inspection_date: string | null;
  result: string | null;
}

export interface Repair {
  repair_id: number;
  vessel_id: number;
  component: string | null;
  repair_description: string | null;
  repair_date: string | null;
  status: string | null;
}

export interface Notification {
  notification_id: number;
  vessel_id: number | null;
  notification_type: string;
  message: string;
  is_read: boolean;
  created_at: string;
}

export interface Activity {
  activity_id: number;
  action: string;
  description: string;
  vessel_id: number | null;
  created_at: string;
}

export interface CalendarEvent {
  id: string;
  title: string;
  date: string | null;
  type: string;
  status: string | null;
  vessel_id: number;
  vessel_name: string;
}

export interface VesselDetails {
  vessel: Vessel;
  maintenance: Maintenance[];
  incidents: Incident[];
  inspections: Inspection[];
  repairs: Repair[];
}

export interface NotificationCreate {
  vessel_id?: number | null;
  notification_type: string;
  message: string;
}

interface MessageResponse {
  message: string;
}

export interface CreateUserData {
  full_name: string;
  email: string;
  password: string;
}

// ---------------- COMMON API HELPER ----------------

type AuthFailureHandler = () => void;
let authFailureHandler: AuthFailureHandler | null = null;

export function onAuthFailure(handler: AuthFailureHandler): () => void {
  authFailureHandler = handler;
  return () => {
    if (authFailureHandler === handler) {
      authFailureHandler = null;
    }
  };
}

export async function apiRequest<T>(
  endpoint: string,
  options: RequestInit = {}
): Promise<T> {
  const token = getToken();
  let response: Response;

  try {
    response = await fetch(`${API_URL}${endpoint}`, {
      ...options,
      headers: {
        "Content-Type": "application/json",
        ...(token ? { Authorization: `Bearer ${token}` } : {}),
        ...options.headers,
      },
    });
  } catch (err) {
    if (err instanceof TypeError && err.message) {
      const origin = typeof window !== "undefined" ? window.location.origin : "your client origin";
      throw new Error(
        `Unable to reach SHIPMEM server at ${API_URL} (${err.message}). Ensure backend is active and CORS allows ${origin}.`
      );
    }
    throw new Error(
      err instanceof Error
        ? err.message
        : "Cannot connect to SHIPMEM server. Check whether the backend is running."
    );
  }

  if (!response.ok) {
    let message = `Request failed (${response.status})`;

    try {
      const errorData = await response.json();
      if (typeof errorData?.detail === "string") {
        message = errorData.detail;
      } else if (Array.isArray(errorData?.detail)) {
        message = errorData.detail
          .map((item: { msg?: string }) => item.msg || "Validation error")
          .join("; ");
      }
    } catch {
      // Keep default error.
    }

    // On 401 Unauthorized for protected endpoints, notify auth failure
    if (response.status === 401 && endpoint !== "/auth/login") {
      logout();
      authFailureHandler?.();
    }

    throw new Error(message);
  }

  if (response.status === 204) {
    return undefined as T;
  }

  return response.json() as Promise<T>;
}

export function apiGet<T>(endpoint: string): Promise<T> {
  return apiRequest<T>(endpoint);
}

export function apiPost<T>(
  endpoint: string,
  data: Record<string, unknown>
): Promise<T> {
  return apiRequest<T>(endpoint, {
    method: "POST",
    body: JSON.stringify(data),
  });
}

// ---------------- AUTHENTICATION API ----------------

const TOKEN_KEY = "shipmem_access_token";

export function getToken(): string | null {
  return sessionStorage.getItem(TOKEN_KEY);
}

export function saveToken(token: string): void {
  sessionStorage.setItem(TOKEN_KEY, token);
}

export function logout(): void {
  sessionStorage.removeItem(TOKEN_KEY);
  sessionStorage.removeItem("shipmem_user");
  sessionStorage.removeItem("shipmem_user_role");
}

export async function login(
  email: string,
  password: string
): Promise<LoginResponse> {
  const formData = new URLSearchParams();

  formData.append("username", email);
  formData.append("password", password);

  let response: Response;

  try {
    response = await fetch(`${API_URL}/auth/login`, {
      method: "POST",
      headers: {
        "Content-Type": "application/x-www-form-urlencoded",
      },
      body: formData,
    });
  } catch (err) {
    if (err instanceof TypeError && err.message) {
      const origin = typeof window !== "undefined" ? window.location.origin : "your client origin";
      throw new Error(
        `Unable to reach SHIPMEM server at ${API_URL} (${err.message}). Ensure backend is active and CORS allows ${origin}.`
      );
    }
    throw new Error(
      err instanceof Error
        ? err.message
        : "Cannot connect to SHIPMEM server. Check whether the backend is running."
    );
  }

  if (!response.ok) {
    let message = "Invalid email or password.";
    try {
      const errorData = await response.json();
      if (typeof errorData?.detail === "string") {
        message = errorData.detail;
      }
    } catch {
      // Use fallback message
    }
    throw new Error(message);
  }

  const result: LoginResponse = await response.json();

  saveToken(result.access_token);

  return result;
}

export function fetchCurrentUser(): Promise<User> {
  return apiRequest<User>("/auth/me");
}

// ---------------- USER MANAGEMENT API ----------------

// Super Admin creates Admin accounts.
export function createAdmin(data: CreateUserData): Promise<User> {
  return apiRequest<User>("/auth/admins", {
    method: "POST",
    body: JSON.stringify(data),
  });
}

// Admin creates Staff accounts.
export function createStaff(data: CreateUserData): Promise<User> {
  return apiRequest<User>("/auth/staff", {
    method: "POST",
    body: JSON.stringify(data),
  });
}

// Super Admin lists all users.
export function fetchAllUsers(): Promise<User[]> {
  return apiRequest<User[]>("/auth/users");
}

// Admin lists their own Staff accounts.
export function fetchStaffUsers(): Promise<User[]> {
  return apiRequest<User[]>("/auth/staff");
}

// Change account active status.
export function updateUserStatus(
  userId: number,
  isActive: boolean
): Promise<User> {
  return apiRequest<User>(
    `/auth/users/${userId}/status`,
    {
      method: "PATCH",
      body: JSON.stringify({ is_active: isActive }),
    }
  );
}

// ---------------- VESSEL API ----------------

export function fetchVessels(): Promise<Vessel[]> {
  return apiRequest<Vessel[]>("/vessels");
}

export function fetchVesselDetails(
  vesselId: number
): Promise<VesselDetails> {
  return apiRequest<VesselDetails>(`/vessels/${vesselId}/details`);
}

// ---------------- MAINTENANCE API ----------------

export function fetchMaintenance(): Promise<Maintenance[]> {
  return apiRequest<Maintenance[]>("/maintenance");
}

// ---------------- INCIDENT API ----------------

export function fetchIncidents(): Promise<Incident[]> {
  return apiRequest<Incident[]>("/incidents");
}

// ---------------- INSPECTION API ----------------

export function fetchInspections(): Promise<Inspection[]> {
  return apiRequest<Inspection[]>("/inspections");
}

// ---------------- REPAIR API ----------------

export function fetchRepairs(): Promise<Repair[]> {
  return apiRequest<Repair[]>("/repairs");
}

// ---------------- NOTIFICATION API ----------------

export function fetchNotifications(): Promise<Notification[]> {
  return apiRequest<Notification[]>("/notifications");
}

export function fetchUnreadNotifications(): Promise<Notification[]> {
  return apiRequest<Notification[]>("/notifications/unread");
}

export function createNotification(
  notification: NotificationCreate
): Promise<Notification> {
  return apiRequest<Notification>("/notifications", {
    method: "POST",
    body: JSON.stringify(notification),
  });
}

export function markNotificationRead(
  notificationId: number
): Promise<MessageResponse> {
  return apiRequest<MessageResponse>(
    `/notifications/${notificationId}/read`,
    { method: "PATCH" }
  );
}

export function deleteNotification(
  notificationId: number
): Promise<MessageResponse> {
  return apiRequest<MessageResponse>(
    `/notifications/${notificationId}`,
    { method: "DELETE" }
  );
}

// ---------------- ACTIVITY HISTORY API ----------------

export function fetchActivityHistory(): Promise<Activity[]> {
  return apiRequest<Activity[]>("/activity-history");
}

// ---------------- CALENDAR API ----------------

export function fetchCalendarEvents(): Promise<CalendarEvent[]> {
  return apiRequest<CalendarEvent[]>("/calendar");
}

// ---------------- DATA STRUCTURE & GRAPH TYPES ----------------

export type KnowledgeGraphNodeType =
  | "vessel"
  | "component"
  | "maintenance"
  | "incident"
  | "repair"
  | "inspection";

export interface KnowledgeGraphNode {
  id: string;
  type: KnowledgeGraphNodeType;
  label: string;
  vessel_id?: number | null;
  metadata: Record<string, unknown>;
  x?: number;
  y?: number;
  vx?: number;
  vy?: number;
}

export interface KnowledgeGraphEdge {
  id: string;
  source: string;
  target: string;
  relationship: string;
  label: string;
}

export interface KnowledgeGraphStats {
  total_nodes: number;
  total_edges: number;
  by_type: Record<string, number>;
}

export interface KnowledgeGraphData {
  nodes: KnowledgeGraphNode[];
  edges: KnowledgeGraphEdge[];
  stats: KnowledgeGraphStats;
  adjacency: Record<string, string[]>;
}

export interface ComponentTreeNode {
  name: string;
  type?: string;
  id?: string;
  metadata?: Record<string, unknown>;
  children: ComponentTreeNode[];
}

export interface TraversalResult {
  traversal: "BFS" | "DFS";
  start: string;
  result: string[];
}

// ---------------- DATA STRUCTURE API ----------------

export function fetchMaintenanceQueue(): Promise<{ tasks: string[] }> {
  return apiRequest<{ tasks: string[] }>("/maintenance-queue");
}

export function fetchComponentTree(vesselId?: number): Promise<ComponentTreeNode> {
  const query = vesselId !== undefined ? `?vessel_id=${vesselId}` : "";
  return apiRequest<ComponentTreeNode>(`/components/tree${query}`);
}

export function fetchOperationalGraph(): Promise<
  Record<string, string[]>
> {
  return apiRequest<Record<string, string[]>>("/graph");
}

export function fetchKnowledgeGraph(): Promise<KnowledgeGraphData> {
  return apiRequest<KnowledgeGraphData>("/knowledge-graph");
}

export function fetchGraphBFS(start: string): Promise<TraversalResult> {
  return apiRequest<TraversalResult>(
    `/graph/bfs?start=${encodeURIComponent(start)}`
  );
}

export function fetchGraphDFS(start: string): Promise<TraversalResult> {
  return apiRequest<TraversalResult>(
    `/graph/dfs?start=${encodeURIComponent(start)}`
  );
}