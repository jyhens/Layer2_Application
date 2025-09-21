// api.ts
import axios from "axios";
import type { User, Leave, Customer, Project, ProjectAssignment } from "./types";
import { Role, LeaveStatus } from "./types";
import { addLog } from "./log";

const API_BASE = (import.meta as any).env?.VITE_API_BASE_URL ?? "http://localhost:5268";
export const api = axios.create({ baseURL: API_BASE });

let currentUserId: string | null = localStorage.getItem("currentUserId") || null;

api.interceptors.request.use((config) => {
  if (currentUserId) {
    (config.headers as any) = {
      ...(config.headers as Record<string, any>),
      "X-Employee-Id": currentUserId,
    };
  }

  const method = (config.method || "get").toUpperCase();
  const url = config.url?.startsWith("http")
    ? config.url
    : `${config.baseURL ?? ""}${config.url ?? ""}`;
  addLog(`Anfrage gestartet: ${method} ${url}`, "info", {
    method,
    url,
    headers: config.headers,
    params: config.params,
    data: config.data,
  });

  return config;
});

api.interceptors.response.use(
  (res) => res,
  (error) => {
    const status = error?.response?.status;
    addLog("Anfrage fehlgeschlagen", "error", {
      status,
      url: error?.config?.url,
      method: error?.config?.method,
      data: error?.config?.data,
      resp: error?.response?.data,
    });
    return Promise.reject(error);
  }
);

export function setCurrentUser(id: string | null) {
  currentUserId = id;
  if (id) localStorage.setItem("currentUserId", id);
  else localStorage.removeItem("currentUserId");
}

/* ---------- mappers ---------- */

function mapRole(n?: number): Role {
  if (n === 2) return Role.Admin;
  if (n === 1) return Role.Approver;
  return Role.Employee;
}

// for sending to backend (role-management supported)
function roleToNumber(r: Role): number {
  if (r === Role.Admin) return 2;
  if (r === Role.Approver) return 1;
  return 0;
}

function mapStatus(n: number): LeaveStatus {
  if (n === 1) return LeaveStatus.Approved;
  if (n === 2) return LeaveStatus.Rejected;
  return LeaveStatus.Requested;
}

/* ---------- conflict hint types (API-Rückgabe) ---------- */
export type ConflictEmployee = { employeeId: string; employeeName: string };
export type ConflictHint = { projectId: string; projectName: string; employees: ConflictEmployee[] };
export type LeaveWithConflicts = { leave: Leave; conflictHints: ConflictHint[] };

/* -------------------------------------------------------------------------- */
/* Notifications (NEW)                                                        */
/* -------------------------------------------------------------------------- */

export enum NotificationKind {
  Submitted = 0,
  Approved = 1,
  Rejected = 2,
}

export type NotificationItem = {
  id: string;
  userId: string;
  leaveRequestId: string;
  kind: NotificationKind;
  date: string;              
  actorId: string | null;
  actorName: string | null;
  comment: string | null;
  createdAt: string;         
  isRead: boolean;
};

// GET /api/notifications?onlyUnread=...
export async function listNotifications(params?: {
  onlyUnread?: boolean;
  userId?: string | null;
}): Promise<NotificationItem[]> {
  const res = await api.get<NotificationItem[]>("/api/notifications", {
    params: {
      onlyUnread: params?.onlyUnread ?? false,
      ...(params?.userId ? { userId: params.userId } : {}),
    },
  });
  return res.data;
}

// POST /api/notifications/mark-read
export async function markNotificationsRead(ids: string[]): Promise<void> {
  if (!ids || ids.length === 0) return;
  await api.post("/api/notifications/mark-read", { ids });
}

/* -------------------------------------------------------------------------- */
/* Employees                                                                  */
/* -------------------------------------------------------------------------- */

export async function listEmployees(): Promise<User[]> {
  const res = await api.get<
    Array<{ id: string; name: string; jobTitle?: string | null; role?: number }>
  >("/api/employees");

  return res.data.map((e) => ({
    id: e.id,
    name: e.name,
    jobTitle: e.jobTitle ?? null,
    role: mapRole(e.role),
  }));
}

export async function getEmployee(id: string): Promise<User> {
  const res = await api.get<{ id: string; name: string; jobTitle?: string | null; role?: number }>(
    `/api/employees/${id}`
  );
  const e = res.data;
  return { id: e.id, name: e.name, jobTitle: e.jobTitle ?? null, role: mapRole(e.role) };
}

export async function setEmployeeRole(id: string, role: Role): Promise<void> {
  await api.put(`/api/employees/${id}/role`, { role: roleToNumber(role) });
}

export async function createEmployee(
  name: string,
  role: Role,
  jobTitle?: string | null
): Promise<User> {
  const res = await api.post<{ id: string; name: string; jobTitle?: string | null; role: number }>(
    "/api/employees",
    {
      name,
      jobTitle: jobTitle ?? null
    }
  );
  const e = res.data;

  if (role !== Role.Employee) {
    await setEmployeeRole(e.id, role);
  }

  return { id: e.id, name: e.name, jobTitle: e.jobTitle ?? null, role: role !== Role.Employee ? role : mapRole(e.role) };
}

export async function updateEmployee(u: User): Promise<void> {
  await api.put(`/api/employees/${u.id}`, {
    name: u.name,
    jobTitle: u.jobTitle ?? null
  });
}

/* -------------------------------------------------------------------------- */
/* Customers                                                                  */
/* -------------------------------------------------------------------------- */

export async function listCustomers(): Promise<Customer[]> {
  const res = await api.get<Array<{ id: string; name: string }>>("/api/customers");
  return res.data.map((c) => ({ id: c.id, name: c.name }));
}

/* -------------------------------------------------------------------------- */
/* Projects                                                                   */
/* -------------------------------------------------------------------------- */

export async function listProjects(): Promise<Project[]> {
  const res = await api.get<
    Array<{
      id: string;
      name: string;
      customerId?: string;
      customer?: { id: string; name: string } | null;
      startDate: string;
      endDate?: string | null;
    }>
  >("/api/projects");

  return res.data.map((p) => ({
    id: p.id,
    name: p.name,
    customerId: p.customerId ?? p.customer?.id ?? "",
    startDate: p.startDate,
    endDate: p.endDate ?? null,
  }));
}

export async function getProject(id: string): Promise<Project> {
  const res = await api.get<{
    id: string;
    name: string;
    customerId: string;
    startDate: string;
    endDate?: string | null;
  }>(`/api/projects/${id}`);
  const p = res.data;
  return { id: p.id, name: p.name, customerId: p.customerId, startDate: p.startDate, endDate: p.endDate ?? null };
}

export async function listAssignments(projectId: string): Promise<ProjectAssignment[]> {
  const res = await api.get<Array<{ employeeId: string; employeeName: string }>>(
    `/api/projects/${projectId}/assignments`
  );
  return res.data.map((a) => ({ projectId, employeeId: a.employeeId }));
}

/* -------------------------------------------------------------------------- */
/* Leaves                                                                     */
/* -------------------------------------------------------------------------- */

export async function listLeaves(params: { employeeId?: string; date?: string } = {}): Promise<Leave[]> {
  const res = await api.get<Array<{
    id: string;
    employeeId: string;
    date: string;
    status: number;
    decisionByEmployeeId?: string | null;
    decisionAt?: string | null;
    decisionComment?: string | null;
  }>>("/api/leaves", { params });

  return res.data.map((l) => ({
    id: l.id,
    employeeId: l.employeeId,
    date: l.date,
    status: mapStatus(l.status),
    decisionByEmployeeId: l.decisionByEmployeeId ?? null,
    decisionAt: l.decisionAt ?? null,
    decisionComment: l.decisionComment ?? null,
  }));
}

export async function createLeave(employeeId: string, date: string): Promise<LeaveWithConflicts> {
  const res = await api.post<{
    leave: {
      id: string;
      employeeId: string;
      date: string;
      status: number;
      decisionByEmployeeId?: string | null;
      decisionAt?: string | null;
      decisionComment?: string | null;
    };
    conflictHints: ConflictHint[];
  }>("/api/leaves", { employeeId, date });

  const l = res.data.leave;
  return {
    leave: {
      id: l.id,
      employeeId: l.employeeId,
      date: l.date,
      status: mapStatus(l.status),
      decisionByEmployeeId: l.decisionByEmployeeId ?? null,
      decisionAt: l.decisionAt ?? null,
      decisionComment: l.decisionComment ?? null,
    },
    conflictHints: res.data.conflictHints,
  };
}

export async function approveLeave(id: string): Promise<LeaveWithConflicts> {
  const res = await api.post<{
    leave: {
      id: string;
      employeeId: string;
      date: string;
      status: number;
      decisionByEmployeeId?: string | null;
      decisionAt?: string | null;
      decisionComment?: string | null;
    };
    conflictHints: ConflictHint[];
  }>(`/api/leaves/${id}/approve`);

  const l = res.data.leave;
  return {
    leave: {
      id: l.id,
      employeeId: l.employeeId,
      date: l.date,
      status: mapStatus(l.status),
      decisionByEmployeeId: l.decisionByEmployeeId ?? null,
      decisionAt: l.decisionAt ?? null,
      decisionComment: l.decisionComment ?? null,
    },
    conflictHints: res.data.conflictHints,
  };
}

export async function rejectLeave(id: string, comment?: string): Promise<Leave> {
  const res = await api.post<{
    id: string;
    employeeId: string;
    date: string;
    status: number;
    decisionByEmployeeId?: string | null;
    decisionAt?: string | null;
    decisionComment?: string | null;
  }>(`/api/leaves/${id}/reject`, comment ?? null, {
    headers: { "Content-Type": "application/json" },
  });

  const l = res.data;
  return {
    id: l.id,
    employeeId: l.employeeId,
    date: l.date,
    status: mapStatus(l.status),
    decisionByEmployeeId: l.decisionByEmployeeId ?? null,
    decisionAt: l.decisionAt ?? null,
    decisionComment: l.decisionComment ?? null,
  };
}
