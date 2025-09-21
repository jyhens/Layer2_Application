// types.ts

export enum Role {
  Employee = "Employee",
  Approver = "Approver",
  Admin = "Admin",
}

export enum LeaveStatus {
  Requested = "Requested",
  Approved = "Approved",
  Rejected = "Rejected",
}

export type User = {
  id: string;
  name: string;
  jobTitle?: string | null;
  role: Role;
};

export type Customer = {
  id: string;
  name: string;
};

export type Project = {
  id: string;
  name: string;
  customerId: string;
  startDate: string;       // ISO: "YYYY-MM-DD"
  endDate?: string | null; 
};

export type ProjectAssignment = {
  projectId: string;
  employeeId: string;
};

export type Leave = {
  id: string;
  employeeId: string;
  date: string;
  status: LeaveStatus;
  decisionByEmployeeId?: string | null;
  decisionAt?: string | null;
  decisionComment?: string | null;
  employee?: User;
};

export type ConflictEmployee = { employeeId: string; employeeName: string };
export type ProjectConflict = {
  projectId: string;
  projectName: string;
  employees: ConflictEmployee[];
};

export type ToastMessage = {
  id: number;
  message: string;
  type: "success" | "error" | "warning";
};

export const RoleLabel: Record<Role, string> = {
  [Role.Employee]: "Mitarbeiter",
  [Role.Approver]: "Genehmiger",
  [Role.Admin]: "Admin",
};

export const LeaveStatusLabel: Record<LeaveStatus, string> = {
  [LeaveStatus.Requested]: "Angefragt",
  [LeaveStatus.Approved]: "Genehmigt",
  [LeaveStatus.Rejected]: "Abgelehnt",
};
