import { createFileRoute, Link } from "@tanstack/react-router";
import { useMe } from "@/hooks/use-me";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import {
  attendanceService,
  leaveService,
  payrollService,
  notificationService,
  userService
} from "@/services/api";
import { useEffect, useState } from "react";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Avatar, AvatarFallback } from "@/components/ui/avatar";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { ArrowRight, Bell, CalendarDays, Clock, FileText, Wallet } from "lucide-react";
import { toast } from "sonner";

export const Route = createFileRoute("/_authenticated/profile")({
  component: ProfilePage,
});

function ProfilePage() {
  const { user, profile, roles, employee } = useMe();
  const qc = useQueryClient();
  const [fullName, setFullName] = useState("");
  const [phone, setPhone] = useState("");
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    setFullName(profile?.full_name ?? "");
    setPhone(profile?.phone ?? "");
  }, [profile]);

  const init = (profile?.full_name || user?.email || "?").split(" ").map((p: string) => p[0]).slice(0, 2).join("").toUpperCase();

  const today = new Date().toISOString().slice(0, 10);
  const att = useQuery({
    queryKey: ["self-att", employee?.id, today],
    enabled: !!employee?.id,
    queryFn: async () => {
      try {
        return await attendanceService.getToday(employee!.id);
      } catch (err) {
        return null;
      }
    },
  });

  const slips = useQuery({
    queryKey: ["self-slips", employee?.id],
    enabled: !!employee?.id,
    queryFn: async () => {
      const data = await payrollService.getMySlips(employee!.id);
      return data ?? [];
    },
  });

  const leaves = useQuery({
    queryKey: ["self-leaves", employee?.id],
    enabled: !!employee?.id,
    queryFn: async () => {
      const data = await leaveService.getMy();
      return data ?? [];
    },
  });

  const notif = useQuery({
    queryKey: ["self-notif", user?.id],
    enabled: !!user?.id,
    queryFn: async () => {
      const data = await notificationService.getAll();
      const unread = (data ?? []).filter((n: any) => !n.read).length;
      return unread;
    },
  });

  const onSave = async () => {
    if (!user) return;
    setSaving(true);
    try {
      await userService.updateProfile(user.id, { full_name: fullName, phone });
      toast.success("Profile updated");
      qc.invalidateQueries({ queryKey: ["me"] });
    } catch (e: any) {
      toast.error(e.response?.data?.message || e.message);
    } finally {
      setSaving(false);
    }
  };

  return (
    <div className="space-y-5 max-w-5xl">
      <div>
        <h1 className="text-2xl font-bold tracking-tight">Self-Service Portal</h1>
        <p className="text-sm text-muted-foreground">Manage your profile and access HR services in one place.</p>
      </div>

      <Card>
        <CardContent className="p-6 flex items-center gap-4">
          <Avatar className="h-20 w-20"><AvatarFallback className="text-xl">{init}</AvatarFallback></Avatar>
          <div className="flex-1 min-w-0">
            <h2 className="text-xl font-bold truncate">{profile?.full_name || "—"}</h2>
            <p className="text-sm text-muted-foreground truncate">{user?.email}</p>
            <div className="flex gap-2 mt-2 flex-wrap">
              {roles.map((r) => <Badge key={r} variant="secondary" className="capitalize">{r.replace("_", " ")}</Badge>)}
            </div>
          </div>
          {employee?.id && (
            <Button asChild variant="outline" className="hidden sm:flex">
              <Link to="/employees/$id" params={{ id: String(employee.id) }}>Employment details <ArrowRight className="h-4 w-4" /></Link>
            </Button>
          )}
        </CardContent>
      </Card>

      <div className="grid gap-3 md:grid-cols-4">
        <QuickCard to="/attendance" icon={Clock} label="Today's Status"
          value={att.data?.check_in ? (att.data.check_out ? "Checked Out" : "Checked In") : "Not yet"} />
        <QuickCard to="/leave" icon={CalendarDays} label="Leave Requests" value={String(leaves.data?.length ?? 0)} />
        <QuickCard to="/payroll" icon={Wallet} label="Recent Payslips" value={String(slips.data?.length ?? 0)} />
        <QuickCard to="/documents" icon={FileText} label="Notifications" value={`${notif.data ?? 0} unread`} iconAlt={Bell} />
      </div>

      <div className="grid gap-5 md:grid-cols-2">
        <Card>
          <CardHeader>
            <CardTitle>Personal Information</CardTitle>
            <CardDescription>Update your contact details.</CardDescription>
          </CardHeader>
          <CardContent className="space-y-3">
            <div className="space-y-1">
              <Label className="text-xs">Full name</Label>
              <Input value={fullName} onChange={(e) => setFullName(e.target.value)} maxLength={120} />
            </div>
            <div className="space-y-1">
              <Label className="text-xs">Phone</Label>
              <Input value={phone} onChange={(e) => setPhone(e.target.value)} maxLength={32} />
            </div>
            <div className="space-y-1">
              <Label className="text-xs">Email</Label>
              <Input value={user?.email ?? ""} disabled />
            </div>
            <Button onClick={onSave} disabled={saving}>{saving ? "Saving…" : "Save changes"}</Button>
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle>Recent Leave</CardTitle>
            <CardDescription>Your latest requests.</CardDescription>
          </CardHeader>
          <CardContent className="space-y-2">
            {(leaves.data ?? []).map((l: any) => (
              <div key={l.id} className="flex items-center justify-between text-sm border rounded-md px-3 py-2">
                <div>
                  <div className="font-medium capitalize">{l.leave_type}</div>
                  <div className="text-xs text-muted-foreground">{l.start_date} → {l.end_date}</div>
                </div>
                <Badge variant="secondary" className="capitalize">{l.status}</Badge>
              </div>
            ))}
            {(leaves.data ?? []).length === 0 && <p className="text-sm text-muted-foreground">No requests yet.</p>}
            <Button asChild variant="outline" className="w-full mt-2"><Link to="/leave">Apply for leave</Link></Button>
          </CardContent>
        </Card>
      </div>
    </div>
  );
}

function QuickCard({ to, icon: Icon, label, value, iconAlt: IconAlt }: {
  to: "/attendance" | "/leave" | "/payroll" | "/documents";
  icon: React.ComponentType<{ className?: string }>;
  iconAlt?: React.ComponentType<{ className?: string }>;
  label: string; value: string;
}) {
  const I = IconAlt ?? Icon;
  return (
    <Link to={to}>
      <Card className="hover:bg-accent/40 transition-colors h-full">
        <CardHeader className="pb-2">
          <div className="flex items-center justify-between">
            <CardDescription>{label}</CardDescription>
            <I className="h-4 w-4 text-muted-foreground" />
          </div>
          <CardTitle className="text-lg">{value}</CardTitle>
        </CardHeader>
      </Card>
    </Link>
  );
}
