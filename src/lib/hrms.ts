import { supabase } from "@/integrations/supabase/client";
import type { Database } from "@/integrations/supabase/types";

export type AppRole = "admin" | "hr_manager" | "dept_manager" | "employee";

export async function getMyRoles(userId: string): Promise<AppRole[]> {
  const { data } = await supabase.from("user_roles").select("role").eq("user_id", userId);
  return (data?.map((r) => r.role) ?? []) as AppRole[];
}

export const isHrOrAdmin = (roles: AppRole[]) => roles.includes("admin") || roles.includes("hr_manager");
export const isManagerOrAbove = (roles: AppRole[]) => isHrOrAdmin(roles) || roles.includes("dept_manager");

export type Profile = Database["public"]["Tables"]["profiles"]["Row"];
export type Department = Database["public"]["Tables"]["departments"]["Row"];
export type Employee = Database["public"]["Tables"]["employees"]["Row"];
export type LeaveRequest = Database["public"]["Tables"]["leave_requests"]["Row"];
export type Attendance = Database["public"]["Tables"]["attendance"]["Row"];

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

export function attendanceStatus(row?: { check_in?: string | null; check_out?: string | null } | null): AttendanceStatus {
  if (!row || !row.check_in) return "absent";
  const checkIn = new Date(row.check_in);
  const lateThreshold = new Date(checkIn);
  lateThreshold.setHours(9, 30, 0, 0);
  const isLate = checkIn.getTime() > lateThreshold.getTime();
  if (!row.check_out) return isLate ? "late" : "pending";
  const h = workedHours(row.check_in, row.check_out);
  if (h < 4) return "half_day";
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
  present: "Present", absent: "Absent", late: "Late", half_day: "Half Day", pending: "Pending",
};

