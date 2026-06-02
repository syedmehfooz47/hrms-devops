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
