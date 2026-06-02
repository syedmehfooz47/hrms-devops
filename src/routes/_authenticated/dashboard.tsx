import { createFileRoute } from "@tanstack/react-router";
import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Users, Building2, CalendarDays, Clock, TrendingUp } from "lucide-react";
import { BarChart, Bar, XAxis, YAxis, ResponsiveContainer, Tooltip, PieChart, Pie, Cell, Legend } from "recharts";
import { Badge } from "@/components/ui/badge";
import { format } from "date-fns";

export const Route = createFileRoute("/_authenticated/dashboard")({
  component: Dashboard,
});

function Dashboard() {
  const { data: stats } = useQuery({
    queryKey: ["dashboard-stats"],
    queryFn: async () => {
      const [emp, dep, leave, att] = await Promise.all([
        supabase.from("employees").select("id, status", { count: "exact" }),
        supabase.from("departments").select("id", { count: "exact", head: true }),
        supabase.from("leave_requests").select("id, status", { count: "exact" }).eq("status", "pending"),
        supabase.from("attendance").select("id", { count: "exact", head: true }).eq("work_date", new Date().toISOString().slice(0, 10)),
      ]);
      const active = emp.data?.filter((e) => e.status === "active").length ?? 0;
      return {
        employees: emp.count ?? 0,
        active,
        departments: dep.count ?? 0,
        pendingLeave: leave.count ?? 0,
        todayAttendance: att.count ?? 0,
      };
    },
  });

  const { data: deptBreakdown = [] } = useQuery({
    queryKey: ["dept-breakdown"],
    queryFn: async () => {
      const { data: depts } = await supabase.from("departments").select("id, name");
      const { data: emps } = await supabase.from("employees").select("department_id");
      return (depts ?? []).map((d) => ({
        name: d.name,
        value: emps?.filter((e) => e.department_id === d.id).length ?? 0,
      }));
    },
  });

  const { data: recentLeave = [] } = useQuery({
    queryKey: ["recent-leave"],
    queryFn: async () => {
      const { data } = await supabase
        .from("leave_requests")
        .select("id, leave_type, start_date, end_date, status, employee_id, profiles:profiles!leave_requests_employee_id_fkey(full_name)")
        .order("created_at", { ascending: false })
        .limit(5);
      return data ?? [];
    },
  });

  const colors = ["hsl(var(--chart-1))", "hsl(var(--chart-2))", "hsl(var(--chart-3))", "hsl(var(--chart-4))", "hsl(var(--chart-5))"];
  const chartColors = ["var(--color-chart-1)", "var(--color-chart-2)", "var(--color-chart-3)", "var(--color-chart-4)", "var(--color-chart-5)"];

  const cards = [
    { label: "Total Employees", value: stats?.employees ?? 0, sub: `${stats?.active ?? 0} active`, icon: Users, color: "text-primary" },
    { label: "Departments", value: stats?.departments ?? 0, sub: "across org", icon: Building2, color: "text-chart-2" },
    { label: "Pending Leave", value: stats?.pendingLeave ?? 0, sub: "needs review", icon: CalendarDays, color: "text-warning" },
    { label: "Checked-in Today", value: stats?.todayAttendance ?? 0, sub: format(new Date(), "PP"), icon: Clock, color: "text-chart-2" },
  ];

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold tracking-tight">Dashboard</h1>
        <p className="text-sm text-muted-foreground">Workspace overview and live activity.</p>
      </div>

      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
        {cards.map((c) => (
          <Card key={c.label}>
            <CardContent className="p-5">
              <div className="flex items-start justify-between">
                <div>
                  <div className="text-xs uppercase tracking-wide text-muted-foreground">{c.label}</div>
                  <div className="text-3xl font-bold mt-1">{c.value}</div>
                  <div className="text-xs text-muted-foreground mt-1">{c.sub}</div>
                </div>
                <div className={`p-2 rounded-lg bg-accent ${c.color}`}><c.icon className="h-5 w-5" /></div>
              </div>
            </CardContent>
          </Card>
        ))}
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-4">
        <Card className="lg:col-span-2">
          <CardHeader>
            <CardTitle className="flex items-center gap-2 text-base"><TrendingUp className="h-4 w-4" /> Headcount by Department</CardTitle>
            <CardDescription>Distribution of employees across departments.</CardDescription>
          </CardHeader>
          <CardContent>
            <div className="h-72">
              <ResponsiveContainer width="100%" height="100%">
                <BarChart data={deptBreakdown}>
                  <XAxis dataKey="name" stroke="var(--color-muted-foreground)" fontSize={11} />
                  <YAxis stroke="var(--color-muted-foreground)" fontSize={11} allowDecimals={false} />
                  <Tooltip contentStyle={{ background: "var(--color-popover)", border: "1px solid var(--color-border)", borderRadius: 8 }} />
                  <Bar dataKey="value" fill="var(--color-primary)" radius={[6, 6, 0, 0]} />
                </BarChart>
              </ResponsiveContainer>
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle className="text-base">Composition</CardTitle>
            <CardDescription>Share by department.</CardDescription>
          </CardHeader>
          <CardContent>
            <div className="h-72">
              <ResponsiveContainer width="100%" height="100%">
                <PieChart>
                  <Pie data={deptBreakdown} dataKey="value" nameKey="name" innerRadius={50} outerRadius={90} paddingAngle={2}>
                    {deptBreakdown.map((_, i) => <Cell key={i} fill={chartColors[i % chartColors.length]} />)}
                  </Pie>
                  <Tooltip contentStyle={{ background: "var(--color-popover)", border: "1px solid var(--color-border)", borderRadius: 8 }} />
                  <Legend iconType="circle" wrapperStyle={{ fontSize: 11 }} />
                </PieChart>
              </ResponsiveContainer>
            </div>
          </CardContent>
        </Card>
      </div>

      <Card>
        <CardHeader>
          <CardTitle className="text-base">Recent Leave Requests</CardTitle>
          <CardDescription>Latest 5 submissions.</CardDescription>
        </CardHeader>
        <CardContent>
          {recentLeave.length === 0 ? (
            <div className="text-sm text-muted-foreground py-6 text-center">No leave requests yet.</div>
          ) : (
            <div className="divide-y">
              {recentLeave.map((r: any) => (
                <div key={r.id} className="flex items-center justify-between py-3">
                  <div>
                    <div className="text-sm font-medium">{r.profiles?.full_name ?? "—"}</div>
                    <div className="text-xs text-muted-foreground capitalize">
                      {r.leave_type} · {format(new Date(r.start_date), "MMM d")} – {format(new Date(r.end_date), "MMM d")}
                    </div>
                  </div>
                  <Badge variant={r.status === "approved" ? "default" : r.status === "rejected" ? "destructive" : "secondary"} className="capitalize">
                    {r.status}
                  </Badge>
                </div>
              ))}
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
}

