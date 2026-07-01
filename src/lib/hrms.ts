export type AppRole = "admin" | "hr_manager" | "dept_manager" | "employee";

export async function getMyRoles(userId: string | number): Promise<AppRole[]> {
  return [] as AppRole[];
}

export const isHrOrAdmin = (roles: AppRole[]) => roles.includes("admin") || roles.includes("hr_manager");
export const isManagerOrAbove = (roles: AppRole[]) => isHrOrAdmin(roles) || roles.includes("dept_manager");

export interface Profile {
  id: string | number;
  full_name?: string | null;
  name?: string | null;
  email?: string | null;
  avatar_url?: string | null;
  phone?: string | null;
}

export interface Department {
  id: number;
  name: string;
  description?: string | null;
  created_at?: string;
}

export interface Employee {
  id: number;
  user_id?: number | null;
  employee_code?: string | null;
  name: string;
  email: string;
  department_id?: number | null;
  department?: string | null;
  designation?: string | null;
  employment_type?: string | null;
  status?: string | null;
  date_of_joining?: string | null;
  salary_basic?: number | null;
  phone?: string | null;
  created_at?: string;
}

export interface LeaveRequest {
  id: number;
  employee_id: number;
  leave_type: string;
  start_date: string;
  end_date: string;
  reason?: string | null;
  status: string;
  approver_id?: number | null;
  approver_note?: string | null;
  decided_at?: string | null;
  created_at?: string;
}

export interface Attendance {
  id: number;
  employee_id: number;
  work_date: string;
  check_in?: string | null;
  check_out?: string | null;
  status: string;
  created_at?: string;
}


export function daysBetween(start: string, end: string) {
  const s = new Date(start).getTime();
  const e = new Date(end).getTime();
  return Math.max(1, Math.round((e - s) / 86_400_000) + 1);
}

export function workedHours(checkIn?: string | null, checkOut?: string | null) {
  if (!checkIn || !checkOut) return 0;
  const ms = new Date(checkOut).getTime() - new Date(checkIn).getTime();
  return Math.max(0, ms / 3_600_000);
}

export type AttendanceStatus = "present" | "absent" | "late" | "half_day" | "pending";

export function attendanceStatus(row?: { check_in?: string | null; check_out?: string | null; status?: string } | null): AttendanceStatus {
  if (!row) return "absent";
  if (!row.check_in) return (row.status as AttendanceStatus) || "absent";

  const checkIn = new Date(row.check_in);
  const lateThreshold = new Date(checkIn);
  lateThreshold.setHours(10, 0, 0, 0);
  const isLate = checkIn.getTime() > lateThreshold.getTime();

  if (row.check_out) {
    const h = workedHours(row.check_in, row.check_out);
    if (h < 4) return "half_day";
    return isLate ? "late" : "present";
  }

  return isLate ? "late" : "present";
}

export const statusColor: Record<AttendanceStatus, string> = {
  present: "bg-emerald-500/15 text-emerald-700 dark:text-emerald-400 border-emerald-500/30",
  absent: "bg-destructive/15 text-destructive border-destructive/30",
  late: "bg-amber-500/15 text-amber-700 dark:text-amber-400 border-amber-500/30",
  half_day: "bg-blue-500/15 text-blue-700 dark:text-blue-400 border-blue-500/30",
  pending: "bg-muted text-muted-foreground border-border",
};

export const statusLabel: Record<AttendanceStatus, string> = {
  present: "Present", absent: "Absent", late: "Present (Late)", half_day: "Half Day", pending: "Pending",
};

