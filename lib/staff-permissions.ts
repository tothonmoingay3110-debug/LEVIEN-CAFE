export const staffRoles = ["owner", "manager", "supervisor", "staff"] as const;

export type StaffRole = (typeof staffRoles)[number];

export type StaffPermission =
  | "view_dashboard"
  | "manage_orders"
  | "view_customers"
  | "manage_catalog"
  | "manage_staff"
  | "view_compensation"
  | "manage_schedule"
  | "view_own_schedule"
  | "view_workforce_reports"
  | "view_audit_log";

export type StaffSessionSummary = {
  id: string;
  authUserId: string | null;
  email: string;
  fullName: string;
  role: StaffRole;
  legacy: boolean;
  mustChangePassword: boolean;
};

export const staffRoleLabels: Record<StaffRole, string> = {
  owner: "Owner",
  manager: "Manager",
  supervisor: "Supervisor",
  staff: "Staff",
};

const permissionsByRole: Record<StaffRole, ReadonlySet<StaffPermission>> = {
  owner: new Set<StaffPermission>([
    "view_dashboard",
    "manage_orders",
    "view_customers",
    "manage_catalog",
    "manage_staff",
    "view_compensation",
    "manage_schedule",
    "view_own_schedule",
    "view_workforce_reports",
    "view_audit_log",
  ]),
  manager: new Set<StaffPermission>([
    "view_dashboard",
    "manage_orders",
    "view_customers",
    "manage_catalog",
    "manage_staff",
    "view_compensation",
    "manage_schedule",
    "view_own_schedule",
    "view_workforce_reports",
    "view_audit_log",
  ]),
  supervisor: new Set<StaffPermission>([
    "view_dashboard",
    "manage_orders",
    "view_own_schedule",
  ]),
  staff: new Set<StaffPermission>([
    "view_dashboard",
    "manage_orders",
    "view_own_schedule",
  ]),
};

export function isStaffRole(value: unknown): value is StaffRole {
  return typeof value === "string" && staffRoles.includes(value as StaffRole);
}

export function roleHasPermission(role: StaffRole, permission: StaffPermission) {
  return permissionsByRole[role].has(permission);
}
