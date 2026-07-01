import { createFileRoute } from "@tanstack/react-router";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { attendanceService, employeeService } from "@/services/api";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Tabs, TabsList, TabsTrigger, TabsContent } from "@/components/ui/tabs";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Clock, LogIn, LogOut, Loader2, Calendar as CalendarIcon, Users, BarChart3, Download } from "lucide-react";
import { toast } from "sonner";
import { useMe } from "@/hooks/use-me";
import { workedHours, attendanceStatus, statusColor, statusLabel, isManagerOrAbove, type AttendanceStatus } from "@/lib/hrms";
import { format, startOfMonth, endOfMonth, eachDayOfInterval, isSameDay, isWeekend, subMonths, addMonths } from "date-fns";
import { useMemo, useState } from "react";
import { BarChart, Bar, XAxis, YAxis, ResponsiveContainer, Tooltip, PieChart, Pie, Cell, Legend } from "recharts";
import { cn } from "@/lib/utils";

export const Route = createFileRoute("/_authenticated/attendance")({
  component: AttendancePage,
});

function AttendancePage() {
  const { roles, employee } = useMe();
  const canManage = isManagerOrAbove(roles);
  const isAdmin = roles.includes("admin") || roles.includes("hr_manager");

  return (
    <div className="space-y-5">
      <div>
        <h1 className="text-2xl font-bold tracking-tight">Attendance</h1>
        <p className="text-sm text-muted-foreground">
          {isAdmin ? "View team attendance and analyse trends." : "Track your time, view reports, and analyse trends."}
        </p>
      </div>

      <Tabs defaultValue={isAdmin ? "team" : "me"} className="space-y-5">
        <TabsList>
          {!isAdmin && <TabsTrigger value="me"><Clock className="h-4 w-4 mr-2" />My Attendance</TabsTrigger>}
          {!isAdmin && <TabsTrigger value="reports"><BarChart3 className="h-4 w-4 mr-2" />Reports</TabsTrigger>}
          {canManage && <TabsTrigger value="team"><Users className="h-4 w-4 mr-2" />Team</TabsTrigger>}
        </TabsList>

        {!isAdmin && (
          <TabsContent value="me" className="space-y-5">
            {employee?.id ? (
              <MyAttendance employeeId={employee.id} />
            ) : (
              <div className="text-sm text-muted-foreground p-4">No employee record associated with your user.</div>
            )}
          </TabsContent>
        )}
        {!isAdmin && (
          <TabsContent value="reports" className="space-y-5">
            {employee?.id ? (
              <Reports employeeId={employee.id} />
            ) : (
              <div className="text-sm text-muted-foreground p-4">No employee record associated with your user.</div>
            )}
          </TabsContent>
        )}
        {canManage && <TabsContent value="team" className="space-y-5"><TeamAttendance /></TabsContent>}
      </Tabs>
    </div>
  );
}

// ---------------- MY ATTENDANCE ----------------
function MyAttendance({ employeeId }: { employeeId: number | string }) {
  const qc = useQueryClient();
  const today = new Date().toISOString().slice(0, 10);
  const [cursor, setCursor] = useState(new Date());

  const { data: todayRow } = useQuery({
    queryKey: ["attendance-today", employeeId],
    queryFn: async () => {
      try {
        return await attendanceService.getToday(employeeId);
      } catch (err) {
        return null;
      }
    },
  });

  const monthStart = startOfMonth(cursor);
  const monthEnd = endOfMonth(cursor);

  const { data: monthRows = [] } = useQuery({
    queryKey: ["attendance-month", employeeId, format(cursor, "yyyy-MM")],
    queryFn: async () => {
      const data = await attendanceService.getMonth(employeeId, cursor.getMonth() + 1, cursor.getFullYear());
      return data ?? [];
    },
  });

  const checkIn = useMutation({
    mutationFn: async () => {
      await attendanceService.checkIn(employeeId);
    },
    onSuccess: () => { toast.success("Checked in"); qc.invalidateQueries({ queryKey: ["attendance-today"] }); qc.invalidateQueries({ queryKey: ["attendance-month"] }); qc.invalidateQueries({ queryKey: ["dashboard-stats"] }); },
    onError: (e: any) => toast.error(e.response?.data?.message || e.message),
  });

  const checkOut = useMutation({
    mutationFn: async () => {
      if (!todayRow) throw new Error("No check-in record");
      await attendanceService.checkOut(todayRow.id);
    },
    onSuccess: () => { toast.success("Checked out"); qc.invalidateQueries({ queryKey: ["attendance-today"] }); qc.invalidateQueries({ queryKey: ["attendance-month"] }); },
    onError: (e: any) => toast.error(e.response?.data?.message || e.message),
  });


  const hoursToday = workedHours(todayRow?.check_in, todayRow?.check_out);
  const todayStatus = attendanceStatus(todayRow);

  // monthly aggregates
  const summary = useMemo(() => {
    const days = eachDayOfInterval({ start: monthStart, end: monthEnd });
    const counts = { present: 0, absent: 0, late: 0, half_day: 0, pending: 0 } as Record<AttendanceStatus, number>;
    let totalHours = 0;
    const isPast = (d: Date) => d.getTime() <= Date.now();
    for (const d of days) {
      if (isWeekend(d) || !isPast(d)) continue;
      const row = monthRows.find((r: any) => isSameDay(new Date(r.work_date), d));
      const s = attendanceStatus(row);
      counts[s]++;
      totalHours += workedHours(row?.check_in, row?.check_out);
    }
    return { counts, totalHours };
  }, [monthRows, monthStart, monthEnd]);

  return (
    <>
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2 text-base"><Clock className="h-4 w-4" /> Today · {format(new Date(), "PPPP")}</CardTitle>
          <CardDescription className="flex items-center gap-2">
            {todayRow?.check_in ? `Checked in at ${format(new Date(todayRow.check_in), "p")}` : "Not yet checked in"}
            <Badge variant="outline" className={cn("ml-1", statusColor[todayStatus])}>{statusLabel[todayStatus]}</Badge>
          </CardDescription>
        </CardHeader>
        <CardContent className="flex flex-col sm:flex-row sm:items-center gap-4">
          <div className="flex-1 grid grid-cols-3 gap-3 text-center">
            <Stat label="Check in" value={todayRow?.check_in ? format(new Date(todayRow.check_in), "p") : "—"} />
            <Stat label="Check out" value={todayRow?.check_out ? format(new Date(todayRow.check_out), "p") : "—"} />
            <Stat label="Hours" value={hoursToday ? hoursToday.toFixed(2) : "—"} />
          </div>
          <div className="flex gap-2">
            <Button onClick={() => checkIn.mutate()} disabled={!!todayRow || checkIn.isPending}>
              {checkIn.isPending ? <Loader2 className="h-4 w-4 mr-2 animate-spin" /> : <LogIn className="h-4 w-4 mr-2" />} Check in
            </Button>
            <Button variant="outline" onClick={() => checkOut.mutate()} disabled={!todayRow || !!todayRow?.check_out || checkOut.isPending}>
              {checkOut.isPending ? <Loader2 className="h-4 w-4 mr-2 animate-spin" /> : <LogOut className="h-4 w-4 mr-2" />} Check out
            </Button>
          </div>
        </CardContent>
      </Card>

      <div className="grid gap-4 md:grid-cols-4">
        <KpiCard label="Total Present" value={summary.counts.present + summary.counts.late + summary.counts.half_day} tone="emerald" />
        <KpiCard label="Late" value={summary.counts.late} tone="amber" />
        <KpiCard label="Half day" value={summary.counts.half_day} tone="blue" />
        <KpiCard label="Absent" value={summary.counts.absent} tone="destructive" />
      </div>

      <Card>
        <CardHeader className="flex flex-row items-center justify-between gap-2">
          <div>
            <CardTitle className="text-base flex items-center gap-2"><CalendarIcon className="h-4 w-4" /> {format(cursor, "MMMM yyyy")}</CardTitle>
            <CardDescription>Total worked: {summary.totalHours.toFixed(1)}h</CardDescription>
          </div>
          <div className="flex gap-1">
            <Button size="sm" variant="outline" onClick={() => setCursor(subMonths(cursor, 1))}>‹</Button>
            <Button size="sm" variant="outline" onClick={() => setCursor(new Date())}>Today</Button>
            <Button size="sm" variant="outline" onClick={() => setCursor(addMonths(cursor, 1))}>›</Button>
          </div>
        </CardHeader>
        <CardContent>
          <MonthCalendar cursor={cursor} rows={monthRows} />
        </CardContent>
      </Card>

      <Card>
        <CardHeader><CardTitle className="text-base">History · {format(cursor, "MMM yyyy")}</CardTitle></CardHeader>
        <CardContent className="p-0 overflow-x-auto">
          <Table>
            <TableHeader>
              <TableRow><TableHead>Date</TableHead><TableHead>Check in</TableHead><TableHead>Check out</TableHead><TableHead>Hours</TableHead><TableHead>Overtime</TableHead><TableHead>Status</TableHead></TableRow>
            </TableHeader>
            <TableBody>
              {monthRows.length === 0 && <TableRow><TableCell colSpan={6} className="text-center py-8 text-sm text-muted-foreground">No records for this month.</TableCell></TableRow>}
              {monthRows.map((r: any) => {
                const h = workedHours(r.check_in, r.check_out);
                const ot = Math.max(0, h - 8);
                const s = attendanceStatus(r);
                return (
                  <TableRow key={r.id}>
                    <TableCell className="text-sm">{format(new Date(r.work_date), "PP")}</TableCell>
                    <TableCell className="text-sm">{r.check_in ? format(new Date(r.check_in), "p") : "—"}</TableCell>
                    <TableCell className="text-sm">{r.check_out ? format(new Date(r.check_out), "p") : "—"}</TableCell>
                    <TableCell className="text-sm font-mono">{h ? h.toFixed(2) : "—"}</TableCell>
                    <TableCell className="text-sm font-mono">{ot > 0 ? ot.toFixed(2) : "—"}</TableCell>
                    <TableCell><Badge variant="outline" className={statusColor[s]}>{statusLabel[s]}</Badge></TableCell>
                  </TableRow>
                );
              })}
            </TableBody>
          </Table>
        </CardContent>
      </Card>
    </>
  );
}

// ---------------- CALENDAR ----------------
function MonthCalendar({ cursor, rows }: { cursor: Date; rows: Array<{ work_date: string; check_in: string | null; check_out: string | null }> }) {
  const start = startOfMonth(cursor);
  const end = endOfMonth(cursor);
  const days = eachDayOfInterval({ start, end });
  const leadingBlanks = (start.getDay() + 6) % 7; // make Monday first

  return (
    <div className="space-y-2">
      <div className="grid grid-cols-7 gap-1 text-[10px] uppercase tracking-wide text-muted-foreground">
        {["Mon", "Tue", "Wed", "Thu", "Fri", "Sat", "Sun"].map((d) => (
          <div key={d} className="text-center py-1">{d}</div>
        ))}
      </div>
      <div className="grid grid-cols-7 gap-1">
        {Array.from({ length: leadingBlanks }).map((_, i) => <div key={`b${i}`} />)}
        {days.map((d) => {
          const row = rows.find((r) => isSameDay(new Date(r.work_date), d));
          const isPast = d.getTime() <= Date.now();
          const weekend = isWeekend(d);
          const s: AttendanceStatus = weekend ? "pending" : (!isPast && !row ? "pending" : attendanceStatus(row));
          const isToday = isSameDay(d, new Date());
          return (
            <div key={d.toISOString()} className={cn("aspect-square rounded-md border p-1.5 flex flex-col text-xs", statusColor[s], isToday && "ring-2 ring-primary ring-offset-1 ring-offset-background", weekend && "opacity-50")}>
              <div className="font-semibold">{format(d, "d")}</div>
              {row?.check_in && <div className="mt-auto text-[10px] font-mono truncate">{format(new Date(row.check_in), "HH:mm")}</div>}
            </div>
          );
        })}
      </div>
      <div className="flex flex-wrap gap-2 pt-2">
        {(["present","late","half_day","absent","pending"] as AttendanceStatus[]).map((s) => (
          <Badge key={s} variant="outline" className={statusColor[s]}>{statusLabel[s]}</Badge>
        ))}
      </div>
    </div>
  );
}

// ---------------- REPORTS ----------------
function Reports({ employeeId }: { employeeId: number | string }) {
  const [cursor, setCursor] = useState(new Date());
  const start = startOfMonth(cursor);
  const end = endOfMonth(cursor);

  const { data: rows = [] } = useQuery({
    queryKey: ["attendance-report", employeeId, format(cursor, "yyyy-MM")],
    queryFn: async () => {
      const data = await attendanceService.getMonth(employeeId, cursor.getMonth() + 1, cursor.getFullYear());
      return data ?? [];
    },
  });

  const { dailyHours, pie } = useMemo(() => {
    const days = eachDayOfInterval({ start, end });
    const dailyHours = days.map((d) => {
      const row = rows.find((r: any) => isSameDay(new Date(r.work_date), d));
      return { day: format(d, "d"), hours: Number(workedHours(row?.check_in, row?.check_out).toFixed(2)) };
    });
    const counts = { present: 0, absent: 0, late: 0, half_day: 0 };
    for (const d of days) {
      if (isWeekend(d) || d.getTime() > Date.now()) continue;
      const row = rows.find((r: any) => isSameDay(new Date(r.work_date), d));
      const s = attendanceStatus(row);
      if (s === "pending") continue;
      counts[s as keyof typeof counts]++;
    }
    const pie = [
      { name: "Present", value: counts.present, color: "hsl(var(--chart-1, 142 71% 45%))" },
      { name: "Late", value: counts.late, color: "hsl(38 92% 50%)" },
      { name: "Half day", value: counts.half_day, color: "hsl(217 91% 60%)" },
      { name: "Absent", value: counts.absent, color: "hsl(0 84% 60%)" },
    ];
    return { dailyHours, pie };
  }, [rows, start, end]);

  const exportCsv = () => {
    const lines = ["Date,Check in,Check out,Hours,Status"];
    for (const r of rows) {
      const h = workedHours(r.check_in, r.check_out);
      lines.push([r.work_date, r.check_in ?? "", r.check_out ?? "", h.toFixed(2), attendanceStatus(r)].join(","));
    }
    const blob = new Blob([lines.join("\n")], { type: "text/csv" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url; a.download = `attendance-${format(cursor, "yyyy-MM")}.csv`; a.click();
    URL.revokeObjectURL(url);
  };

  return (
    <>
      <Card>
        <CardHeader className="flex flex-row items-center justify-between gap-2">
          <div>
            <CardTitle className="text-base">Monthly report · {format(cursor, "MMMM yyyy")}</CardTitle>
            <CardDescription>Daily hours and status breakdown</CardDescription>
          </div>
          <div className="flex gap-1">
            <Button size="sm" variant="outline" onClick={() => setCursor(subMonths(cursor, 1))}>‹</Button>
            <Button size="sm" variant="outline" onClick={() => setCursor(new Date())}>This month</Button>
            <Button size="sm" variant="outline" onClick={() => setCursor(addMonths(cursor, 1))}>›</Button>
            <Button size="sm" variant="outline" onClick={exportCsv}><Download className="h-4 w-4 mr-1" />CSV</Button>
          </div>
        </CardHeader>
        <CardContent className="grid gap-6 md:grid-cols-3">
          <div className="md:col-span-2 h-64">
            <ResponsiveContainer width="100%" height="100%">
              <BarChart data={dailyHours}>
                <XAxis dataKey="day" fontSize={11} />
                <YAxis fontSize={11} />
                <Tooltip />
                <Bar dataKey="hours" fill="hsl(var(--primary))" radius={[4, 4, 0, 0]} />
              </BarChart>
            </ResponsiveContainer>
          </div>
          <div className="h-64">
            <ResponsiveContainer width="100%" height="100%">
              <PieChart>
                <Pie data={pie} dataKey="value" nameKey="name" innerRadius={40} outerRadius={70} paddingAngle={2}>
                  {pie.map((p) => <Cell key={p.name} fill={p.color} />)}
                </Pie>
                <Legend wrapperStyle={{ fontSize: 11 }} />
                <Tooltip />
              </PieChart>
            </ResponsiveContainer>
          </div>
        </CardContent>
      </Card>
    </>
  );
}

// ---------------- TEAM (manager+) ----------------
function TeamAttendance() {
  const [date, setDate] = useState(new Date().toISOString().slice(0, 10));

  const { data: people = [] } = useQuery({
    queryKey: ["team-profiles"],
    queryFn: async () => {
      const emps = await employeeService.getAll();
      return (emps ?? []).map((e: any) => ({
        id: e.id,
        full_name: e.name,
        email: e.email,
      }));
    },
  });

  const { data: dayRows = [] } = useQuery({
    queryKey: ["team-attendance", date],
    queryFn: async () => {
      const data = await attendanceService.getTeam(date);
      return data ?? [];
    },
  });

  const merged = useMemo(() => people.map((p: any) => {
    const row = dayRows.find((r: any) => r.employee_id === p.id);
    return { ...p, row, status: attendanceStatus(row) };
  }), [people, dayRows]);

  const counts = useMemo(() => {
    const c: Record<AttendanceStatus, number> = { present: 0, absent: 0, late: 0, half_day: 0, pending: 0 };
    merged.forEach((m: any) => { c[m.status as AttendanceStatus]++; });
    return c;
  }, [merged]);

  return (
    <>
      <div className="grid gap-4 md:grid-cols-5">
        <KpiCard label="Headcount" value={people.length} />
        <KpiCard label="Total Present" value={counts.present + counts.late + counts.half_day} tone="emerald" />
        <KpiCard label="Late" value={counts.late} tone="amber" />
        <KpiCard label="Half day" value={counts.half_day} tone="blue" />
        <KpiCard label="Absent" value={counts.absent} tone="destructive" />
      </div>

      <Card>
        <CardHeader className="flex flex-row items-center justify-between gap-2">
          <div>
            <CardTitle className="text-base flex items-center gap-2"><Users className="h-4 w-4" /> Team · {format(new Date(date), "PPP")}</CardTitle>
            <CardDescription>Daily snapshot across the organisation</CardDescription>
          </div>
          <Select value={date} onValueChange={setDate}>
            <SelectTrigger className="w-[180px]"><SelectValue /></SelectTrigger>
            <SelectContent>
              {Array.from({ length: 14 }).map((_, i) => {
                const d = new Date(); d.setDate(d.getDate() - i);
                const v = d.toISOString().slice(0, 10);
                return <SelectItem key={v} value={v}>{format(d, "EEE, PP")}</SelectItem>;
              })}
            </SelectContent>
          </Select>
        </CardHeader>
        <CardContent className="p-0 overflow-x-auto">
          <Table>
            <TableHeader>
              <TableRow><TableHead>Employee</TableHead><TableHead>Check in</TableHead><TableHead>Check out</TableHead><TableHead>Hours</TableHead><TableHead>Status</TableHead></TableRow>
            </TableHeader>
            <TableBody>
              {merged.length === 0 && <TableRow><TableCell colSpan={5} className="text-center py-8 text-sm text-muted-foreground">No employees found.</TableCell></TableRow>}
              {merged.map((m: any) => {
                const h = workedHours(m.row?.check_in, m.row?.check_out);
                return (
                  <TableRow key={m.id}>
                    <TableCell>
                      <div className="text-sm font-medium">{m.full_name || m.email}</div>
                      <div className="text-xs text-muted-foreground">{m.email}</div>
                    </TableCell>
                    <TableCell className="text-sm">{m.row?.check_in ? format(new Date(m.row.check_in), "p") : "—"}</TableCell>
                    <TableCell className="text-sm">{m.row?.check_out ? format(new Date(m.row.check_out), "p") : "—"}</TableCell>
                    <TableCell className="text-sm font-mono">{h ? h.toFixed(2) : "—"}</TableCell>
                    <TableCell><Badge variant="outline" className={statusColor[m.status as AttendanceStatus]}>{statusLabel[m.status as AttendanceStatus]}</Badge></TableCell>
                  </TableRow>
                );
              })}
            </TableBody>
          </Table>
        </CardContent>
      </Card>
    </>
  );
}

// ---------------- UI helpers ----------------
function Stat({ label, value }: { label: string; value: string }) {
  return (
    <div className="rounded-lg bg-accent/50 p-3">
      <div className="text-[10px] uppercase tracking-wide text-muted-foreground">{label}</div>
      <div className="font-mono font-semibold mt-1">{value}</div>
    </div>
  );
}

function KpiCard({ label, value, tone }: { label: string; value: number; tone?: "emerald" | "amber" | "blue" | "destructive" }) {
  const toneCls = tone === "emerald" ? "text-emerald-600 dark:text-emerald-400"
    : tone === "amber" ? "text-amber-600 dark:text-amber-400"
    : tone === "blue" ? "text-blue-600 dark:text-blue-400"
    : tone === "destructive" ? "text-destructive" : "text-foreground";
  return (
    <Card>
      <CardContent className="p-4">
        <div className="text-xs uppercase tracking-wide text-muted-foreground">{label}</div>
        <div className={cn("text-2xl font-bold mt-1", toneCls)}>{value}</div>
      </CardContent>
    </Card>
  );
}
