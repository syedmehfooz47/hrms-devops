import { createFileRoute } from "@tanstack/react-router";
import { useMemo } from "react";
import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useMe } from "@/hooks/use-me";
import { isManagerOrAbove } from "@/lib/hrms";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import {
  Bar, BarChart, CartesianGrid, Cell, Legend, Line, LineChart,
  Pie, PieChart, ResponsiveContainer, Tooltip, XAxis, YAxis,
} from "recharts";
import { Download, FileSpreadsheet, FileText } from "lucide-react";
import { toast } from "sonner";
import jsPDF from "jspdf";
import autoTable from "jspdf-autotable";
import * as XLSX from "xlsx";

export const Route = createFileRoute("/_authenticated/analytics")({
  component: AnalyticsPage,
});

const COLORS = ["var(--color-chart-1)", "var(--color-chart-2)", "var(--color-chart-3)", "var(--color-chart-4)", "var(--color-chart-5)"];
const MONTHS = ["Jan", "Feb", "Mar", "Apr", "May", "Jun", "Jul", "Aug", "Sep", "Oct", "Nov", "Dec"];

function monthKey(d: string | Date) {
  const dt = new Date(d);
  return `${dt.getFullYear()}-${String(dt.getMonth() + 1).padStart(2, "0")}`;
}

function AnalyticsPage() {
  const { roles } = useMe();
  const canView = isManagerOrAbove(roles);

  const employees = useQuery({
    queryKey: ["an-employees"],
    enabled: canView,
    queryFn: async () => (await supabase.from("employees").select("id, status, department_id, employment_type, date_of_joining, salary_basic")).data ?? [],
  });
  const departments = useQuery({
    queryKey: ["an-departments"],
    enabled: canView,
    queryFn: async () => (await supabase.from("departments").select("id, name")).data ?? [],
  });
  const attendance = useQuery({
    queryKey: ["an-attendance"],
    enabled: canView,
    queryFn: async () => (await supabase.from("attendance").select("id, employee_id, work_date, check_in, check_out").order("work_date", { ascending: false }).limit(2000)).data ?? [],
  });
  const leaves = useQuery({
    queryKey: ["an-leaves"],
    enabled: canView,
    queryFn: async () => (await supabase.from("leave_requests").select("id, leave_type, status, start_date, end_date, employee_id").limit(2000)).data ?? [],
  });
  const payslips = useQuery({
    queryKey: ["an-payslips"],
    enabled: canView,
    queryFn: async () => (await supabase.from("payslips").select("id, employee_id, year, month, gross, net, tax, pf").limit(2000)).data ?? [],
  });
  const jobs = useQuery({
    queryKey: ["an-jobs"],
    enabled: canView,
    queryFn: async () => (await supabase.from("job_postings").select("id, status, title, created_at")).data ?? [],
  });
  const candidates = useQuery({
    queryKey: ["an-candidates"],
    enabled: canView,
    queryFn: async () => (await supabase.from("candidates").select("id, stage, job_id, applied_at")).data ?? [],
  });

  // KPIs
  const kpis = useMemo(() => {
    const emps = employees.data ?? [];
    const active = emps.filter((e) => e.status === "active").length;
    const today = new Date().toISOString().slice(0, 10);
    const presentToday = (attendance.data ?? []).filter((a) => a.work_date === today && a.check_in).length;
    const attendanceRate = active ? (presentToday / active) * 100 : 0;
    const pendingLeaves = (leaves.data ?? []).filter((l) => l.status === "pending").length;
    const openJobs = (jobs.data ?? []).filter((j) => j.status === "open").length;
    const lastMonth = MONTHS[(new Date().getMonth() + 11) % 12];
    const last = (payslips.data ?? []).reduce((sum, p) => sum + Number(p.net ?? 0), 0);
    return { headcount: emps.length, active, attendanceRate, pendingLeaves, openJobs, totalNetPaid: last, lastMonth };
  }, [employees.data, attendance.data, leaves.data, jobs.data, payslips.data]);

  // Department chart
  const deptChart = useMemo(() => {
    const map = new Map((departments.data ?? []).map((d) => [d.id, d.name]));
    const counts: Record<string, number> = {};
    (employees.data ?? []).forEach((e) => {
      const name = (e.department_id && map.get(e.department_id)) || "Unassigned";
      counts[name] = (counts[name] ?? 0) + 1;
    });
    return Object.entries(counts).map(([name, value]) => ({ name, value }));
  }, [employees.data, departments.data]);

  // Employment type
  const typeChart = useMemo(() => {
    const counts: Record<string, number> = {};
    (employees.data ?? []).forEach((e) => { counts[e.employment_type] = (counts[e.employment_type] ?? 0) + 1; });
    return Object.entries(counts).map(([name, value]) => ({ name: name.replace("_", " "), value }));
  }, [employees.data]);

  // Hiring trend
  const hiringTrend = useMemo(() => {
    const map: Record<string, number> = {};
    (employees.data ?? []).forEach((e) => {
      if (!e.date_of_joining) return;
      const k = monthKey(e.date_of_joining);
      map[k] = (map[k] ?? 0) + 1;
    });
    return Object.entries(map).sort(([a], [b]) => a.localeCompare(b)).slice(-12).map(([k, v]) => ({ month: k, hires: v }));
  }, [employees.data]);

  // Attendance last 14 days
  const attendanceTrend = useMemo(() => {
    const days: { day: string; present: number; late: number }[] = [];
    for (let i = 13; i >= 0; i--) {
      const d = new Date(); d.setDate(d.getDate() - i);
      const key = d.toISOString().slice(0, 10);
      const rows = (attendance.data ?? []).filter((a) => a.work_date === key);
      const present = rows.filter((r) => r.check_in).length;
      const late = rows.filter((r) => {
        if (!r.check_in) return false;
        const ci = new Date(r.check_in);
        const t = new Date(ci); t.setHours(9, 30, 0, 0);
        return ci.getTime() > t.getTime();
      }).length;
      days.push({ day: `${d.getMonth() + 1}/${d.getDate()}`, present, late });
    }
    return days;
  }, [attendance.data]);

  // Leave analytics
  const leaveByType = useMemo(() => {
    const counts: Record<string, number> = {};
    (leaves.data ?? []).forEach((l) => { counts[l.leave_type] = (counts[l.leave_type] ?? 0) + 1; });
    return Object.entries(counts).map(([name, value]) => ({ name, value }));
  }, [leaves.data]);

  const leaveByStatus = useMemo(() => {
    const counts: Record<string, number> = {};
    (leaves.data ?? []).forEach((l) => { counts[l.status] = (counts[l.status] ?? 0) + 1; });
    return Object.entries(counts).map(([name, value]) => ({ name, value }));
  }, [leaves.data]);

  // Payroll trend
  const payrollTrend = useMemo(() => {
    const map: Record<string, { gross: number; net: number; tax: number }> = {};
    (payslips.data ?? []).forEach((p) => {
      const k = `${p.year}-${String(p.month).padStart(2, "0")}`;
      if (!map[k]) map[k] = { gross: 0, net: 0, tax: 0 };
      map[k].gross += Number(p.gross ?? 0);
      map[k].net += Number(p.net ?? 0);
      map[k].tax += Number(p.tax ?? 0);
    });
    return Object.entries(map).sort(([a], [b]) => a.localeCompare(b)).slice(-12).map(([k, v]) => ({ month: k, ...v }));
  }, [payslips.data]);

  // Recruitment funnel
  const funnel = useMemo(() => {
    const stages = ["applied", "screening", "interview", "offer", "hired", "rejected"];
    const counts: Record<string, number> = {};
    (candidates.data ?? []).forEach((c) => { counts[c.stage] = (counts[c.stage] ?? 0) + 1; });
    return stages.map((s) => ({ stage: s, count: counts[s] ?? 0 }));
  }, [candidates.data]);

  const exportPDF = () => {
    try {
      const doc = new jsPDF();
      doc.setFontSize(16); doc.text("HR Analytics Report", 14, 18);
      doc.setFontSize(10); doc.text(`Generated: ${new Date().toLocaleString()}`, 14, 25);

      autoTable(doc, {
        startY: 32, head: [["Metric", "Value"]],
        body: [
          ["Total Employees", String(kpis.headcount)],
          ["Active Employees", String(kpis.active)],
          ["Attendance Rate (today)", `${kpis.attendanceRate.toFixed(1)}%`],
          ["Pending Leaves", String(kpis.pendingLeaves)],
          ["Open Job Postings", String(kpis.openJobs)],
          ["Total Net Paid (all-time)", kpis.totalNetPaid.toFixed(2)],
        ],
      });
      autoTable(doc, {
        head: [["Department", "Headcount"]],
        body: deptChart.map((d) => [d.name, String(d.value)]),
      });
      autoTable(doc, {
        head: [["Leave Type", "Requests"]],
        body: leaveByType.map((l) => [l.name, String(l.value)]),
      });
      autoTable(doc, {
        head: [["Recruitment Stage", "Count"]],
        body: funnel.map((f) => [f.stage, String(f.count)]),
      });
      autoTable(doc, {
        head: [["Month", "Gross", "Net", "Tax"]],
        body: payrollTrend.map((p) => [p.month, p.gross.toFixed(2), p.net.toFixed(2), p.tax.toFixed(2)]),
      });
      doc.save(`hr-analytics-${new Date().toISOString().slice(0, 10)}.pdf`);
      toast.success("PDF exported");
    } catch (e) { toast.error((e as Error).message); }
  };

  const exportExcel = () => {
    try {
      const wb = XLSX.utils.book_new();
      const summary = [
        ["Metric", "Value"],
        ["Total Employees", kpis.headcount],
        ["Active Employees", kpis.active],
        ["Attendance Rate (today, %)", Number(kpis.attendanceRate.toFixed(1))],
        ["Pending Leaves", kpis.pendingLeaves],
        ["Open Job Postings", kpis.openJobs],
        ["Total Net Paid", kpis.totalNetPaid],
      ];
      XLSX.utils.book_append_sheet(wb, XLSX.utils.aoa_to_sheet(summary), "Summary");
      XLSX.utils.book_append_sheet(wb, XLSX.utils.json_to_sheet(deptChart), "Departments");
      XLSX.utils.book_append_sheet(wb, XLSX.utils.json_to_sheet(typeChart), "Employment Type");
      XLSX.utils.book_append_sheet(wb, XLSX.utils.json_to_sheet(hiringTrend), "Hiring Trend");
      XLSX.utils.book_append_sheet(wb, XLSX.utils.json_to_sheet(attendanceTrend), "Attendance 14d");
      XLSX.utils.book_append_sheet(wb, XLSX.utils.json_to_sheet(leaveByType), "Leave by Type");
      XLSX.utils.book_append_sheet(wb, XLSX.utils.json_to_sheet(leaveByStatus), "Leave by Status");
      XLSX.utils.book_append_sheet(wb, XLSX.utils.json_to_sheet(payrollTrend), "Payroll Trend");
      XLSX.utils.book_append_sheet(wb, XLSX.utils.json_to_sheet(funnel), "Recruitment Funnel");
      XLSX.writeFile(wb, `hr-analytics-${new Date().toISOString().slice(0, 10)}.xlsx`);
      toast.success("Excel exported");
    } catch (e) { toast.error((e as Error).message); }
  };

  if (!canView) {
    return <div className="text-sm text-muted-foreground">Analytics is available to Managers, HR and Admins.</div>;
  }

  return (
    <div className="space-y-5">
      <div className="flex items-start justify-between gap-3 flex-wrap">
        <div>
          <h1 className="text-2xl font-bold tracking-tight">HR Analytics</h1>
          <p className="text-sm text-muted-foreground">Workforce, time, payroll and hiring insights.</p>
        </div>
        <div className="flex gap-2">
          <Button variant="outline" onClick={exportPDF}><FileText className="h-4 w-4" /> PDF</Button>
          <Button variant="outline" onClick={exportExcel}><FileSpreadsheet className="h-4 w-4" /> Excel</Button>
        </div>
      </div>

      <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-6">
        <Kpi label="Headcount" value={kpis.headcount} />
        <Kpi label="Active" value={kpis.active} />
        <Kpi label="Attendance Today" value={`${kpis.attendanceRate.toFixed(0)}%`} />
        <Kpi label="Pending Leaves" value={kpis.pendingLeaves} />
        <Kpi label="Open Jobs" value={kpis.openJobs} />
        <Kpi label="Net Paid" value={kpis.totalNetPaid.toLocaleString(undefined, { maximumFractionDigits: 0 })} />
      </div>

      <Tabs defaultValue="people">
        <TabsList>
          <TabsTrigger value="people">People</TabsTrigger>
          <TabsTrigger value="time">Time</TabsTrigger>
          <TabsTrigger value="leave">Leave</TabsTrigger>
          <TabsTrigger value="payroll">Payroll</TabsTrigger>
          <TabsTrigger value="recruit">Recruitment</TabsTrigger>
        </TabsList>

        <TabsContent value="people" className="grid gap-4 md:grid-cols-2">
          <ChartCard title="Headcount by Department">
            <ResponsiveContainer width="100%" height={280}>
              <BarChart data={deptChart}>
                <CartesianGrid strokeDasharray="3 3" stroke="var(--color-border)" />
                <XAxis dataKey="name" fontSize={11} />
                <YAxis allowDecimals={false} fontSize={11} />
                <Tooltip />
                <Bar dataKey="value" fill="var(--color-chart-1)" radius={[6, 6, 0, 0]} />
              </BarChart>
            </ResponsiveContainer>
          </ChartCard>
          <ChartCard title="Employment Type">
            <ResponsiveContainer width="100%" height={280}>
              <PieChart>
                <Pie data={typeChart} dataKey="value" nameKey="name" innerRadius={50} outerRadius={90} paddingAngle={2}>
                  {typeChart.map((_, i) => <Cell key={i} fill={COLORS[i % COLORS.length]} />)}
                </Pie>
                <Tooltip /><Legend iconType="circle" wrapperStyle={{ fontSize: 11 }} />
              </PieChart>
            </ResponsiveContainer>
          </ChartCard>
          <ChartCard title="Hiring Trend (last 12 months)" full>
            <ResponsiveContainer width="100%" height={280}>
              <LineChart data={hiringTrend}>
                <CartesianGrid strokeDasharray="3 3" stroke="var(--color-border)" />
                <XAxis dataKey="month" fontSize={11} /><YAxis allowDecimals={false} fontSize={11} />
                <Tooltip />
                <Line type="monotone" dataKey="hires" stroke="var(--color-chart-2)" strokeWidth={2} dot={{ r: 3 }} />
              </LineChart>
            </ResponsiveContainer>
          </ChartCard>
        </TabsContent>

        <TabsContent value="time">
          <ChartCard title="Attendance — last 14 days">
            <ResponsiveContainer width="100%" height={320}>
              <BarChart data={attendanceTrend}>
                <CartesianGrid strokeDasharray="3 3" stroke="var(--color-border)" />
                <XAxis dataKey="day" fontSize={11} /><YAxis allowDecimals={false} fontSize={11} />
                <Tooltip /><Legend />
                <Bar dataKey="present" stackId="a" fill="var(--color-chart-2)" />
                <Bar dataKey="late" stackId="a" fill="var(--color-chart-4)" />
              </BarChart>
            </ResponsiveContainer>
          </ChartCard>
        </TabsContent>

        <TabsContent value="leave" className="grid gap-4 md:grid-cols-2">
          <ChartCard title="Requests by Type">
            <ResponsiveContainer width="100%" height={280}>
              <PieChart>
                <Pie data={leaveByType} dataKey="value" nameKey="name" outerRadius={90}>
                  {leaveByType.map((_, i) => <Cell key={i} fill={COLORS[i % COLORS.length]} />)}
                </Pie>
                <Tooltip /><Legend iconType="circle" wrapperStyle={{ fontSize: 11 }} />
              </PieChart>
            </ResponsiveContainer>
          </ChartCard>
          <ChartCard title="Requests by Status">
            <ResponsiveContainer width="100%" height={280}>
              <BarChart data={leaveByStatus}>
                <CartesianGrid strokeDasharray="3 3" stroke="var(--color-border)" />
                <XAxis dataKey="name" fontSize={11} /><YAxis allowDecimals={false} fontSize={11} />
                <Tooltip />
                <Bar dataKey="value" fill="var(--color-chart-3)" radius={[6, 6, 0, 0]} />
              </BarChart>
            </ResponsiveContainer>
          </ChartCard>
        </TabsContent>

        <TabsContent value="payroll">
          <ChartCard title="Payroll Trend">
            <ResponsiveContainer width="100%" height={320}>
              <LineChart data={payrollTrend}>
                <CartesianGrid strokeDasharray="3 3" stroke="var(--color-border)" />
                <XAxis dataKey="month" fontSize={11} /><YAxis fontSize={11} />
                <Tooltip /><Legend />
                <Line type="monotone" dataKey="gross" stroke="var(--color-chart-1)" strokeWidth={2} />
                <Line type="monotone" dataKey="net" stroke="var(--color-chart-2)" strokeWidth={2} />
                <Line type="monotone" dataKey="tax" stroke="var(--color-chart-4)" strokeWidth={2} />
              </LineChart>
            </ResponsiveContainer>
          </ChartCard>
        </TabsContent>

        <TabsContent value="recruit">
          <ChartCard title="Recruitment Funnel">
            <ResponsiveContainer width="100%" height={320}>
              <BarChart data={funnel} layout="vertical">
                <CartesianGrid strokeDasharray="3 3" stroke="var(--color-border)" />
                <XAxis type="number" allowDecimals={false} fontSize={11} />
                <YAxis dataKey="stage" type="category" fontSize={11} width={90} />
                <Tooltip />
                <Bar dataKey="count" fill="var(--color-chart-1)" radius={[0, 6, 6, 0]} />
              </BarChart>
            </ResponsiveContainer>
          </ChartCard>
        </TabsContent>
      </Tabs>

      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2"><Download className="h-5 w-5" /> Export Reports</CardTitle>
          <CardDescription>Download the current analytics snapshot.</CardDescription>
        </CardHeader>
        <CardContent className="flex gap-2">
          <Button onClick={exportPDF}><FileText className="h-4 w-4" /> PDF Report</Button>
          <Button onClick={exportExcel} variant="secondary"><FileSpreadsheet className="h-4 w-4" /> Excel Workbook</Button>
        </CardContent>
      </Card>
    </div>
  );
}

function Kpi({ label, value }: { label: string; value: number | string }) {
  return (
    <Card>
      <CardHeader className="pb-2">
        <CardDescription>{label}</CardDescription>
        <CardTitle className="text-2xl">{value}</CardTitle>
      </CardHeader>
    </Card>
  );
}

function ChartCard({ title, children, full }: { title: string; children: React.ReactNode; full?: boolean }) {
  return (
    <Card className={full ? "md:col-span-2" : ""}>
      <CardHeader><CardTitle className="text-base">{title}</CardTitle></CardHeader>
      <CardContent>{children}</CardContent>
    </Card>
  );
}
