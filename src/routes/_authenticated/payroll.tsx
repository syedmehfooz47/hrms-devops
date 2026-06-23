import { createFileRoute } from "@tanstack/react-router";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { payrollService } from "@/services/api";
import { useMemo, useState } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Dialog, DialogContent, DialogFooter, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Wallet, Plus, Loader2, Download, FileText, CheckCircle2, Calendar } from "lucide-react";
import { toast } from "sonner";
import { useMe } from "@/hooks/use-me";
import { isHrOrAdmin } from "@/lib/hrms";
import { monthName, downloadPayslipPDF } from "@/lib/payroll";
import { BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer } from "recharts";

export const Route = createFileRoute("/_authenticated/payroll")({
  component: PayrollPage,
});

const inr = (n: number) =>
  new Intl.NumberFormat("en-IN", { style: "currency", currency: "INR", maximumFractionDigits: 0 }).format(n || 0);

function PayrollPage() {
  const { user, roles, employee } = useMe();
  const isHr = isHrOrAdmin(roles);

  const { data: allSlips = [] } = useQuery({
    queryKey: ["all-payslips"],
    enabled: isHr,
    queryFn: async () => {
      const data = await payrollService.getAll();
      return (data ?? []).map((s: any) => ({
        ...s,
        net: s.net !== undefined ? s.net : Number(s.net_salary || 0),
        gross: s.gross !== undefined ? s.gross : Number(s.basic_salary || 0),
      }));
    },
  });

  const runs = useMemo(() => {
    const grouped = new Map<string, { id: string; month: number; year: number; status: string; processed_at?: string }>();
    allSlips.forEach((s: any) => {
      const key = `${s.year}-${s.month}`;
      if (!grouped.has(key)) {
        grouped.set(key, {
          id: key,
          month: s.month,
          year: s.year,
          status: s.status,
          processed_at: s.processed_at,
        });
      }
    });
    return Array.from(grouped.values()).sort((a, b) => b.year - a.year || b.month - a.month);
  }, [allSlips]);

  const { data: mySlips = [] } = useQuery({
    queryKey: ["my-payslips", employee?.id],
    enabled: !!employee?.id,
    queryFn: async () => {
      const data = await payrollService.getMySlips(employee!.id);
      return (data ?? []).map((s: any) => ({
        ...s,
        net: s.net !== undefined ? s.net : Number(s.net_salary || 0),
        gross: s.gross !== undefined ? s.gross : Number(s.basic_salary || 0),
      }));
    },
  });

  const stats = useMemo(() => {
    const ytd = allSlips.reduce((s: number, r: any) => s + Number(r.net || 0), 0);
    const lastRun = runs[0];
    const lastTotal = lastRun ? allSlips.filter((s: any) => `${s.year}-${s.month}` === lastRun.id).reduce((s: number, r: any) => s + Number(r.net || 0), 0) : 0;
    const headcount = lastRun ? allSlips.filter((s: any) => `${s.year}-${s.month}` === lastRun.id).length : 0;
    return { ytd, lastTotal, lastRun, headcount };
  }, [allSlips, runs]);

  const chartData = useMemo(() => {
    return [...runs].slice(0, 6).reverse().map((r) => ({
      label: `${monthName(r.month)} ${String(r.year).slice(2)}`,
      total: allSlips.filter((s: any) => `${s.year}-${s.month}` === r.id).reduce((s: number, x: any) => s + Number(x.net || 0), 0),
    }));
  }, [runs, allSlips]);

  return (
    <div className="space-y-5">
      <div className="flex items-center justify-between flex-wrap gap-3">
        <div>
          <h1 className="text-2xl font-bold tracking-tight">Payroll</h1>
          <p className="text-sm text-muted-foreground">Generate monthly payroll, view salary history and download payslips.</p>
        </div>
        {isHr && <NewRunDialog />}
      </div>

      {isHr && (
        <div className="grid grid-cols-2 lg:grid-cols-4 gap-3">
          <StatCard label="YTD payout" value={inr(stats.ytd)} icon={Wallet} />
          <StatCard
            label="Last run"
            value={stats.lastRun ? `${monthName(stats.lastRun.month)} ${stats.lastRun.year}` : "—"}
            icon={Calendar}
          />
          <StatCard label="Last total" value={inr(stats.lastTotal)} icon={CheckCircle2} />
          <StatCard label="Employees paid" value={String(stats.headcount)} icon={FileText} />
        </div>
      )}

      <Tabs defaultValue="mine">
        <TabsList>
          <TabsTrigger value="mine">My payslips ({mySlips.length})</TabsTrigger>
          {isHr && <TabsTrigger value="runs">Payroll runs ({runs.length})</TabsTrigger>}
          {isHr && <TabsTrigger value="analytics">Analytics</TabsTrigger>}
        </TabsList>

        <TabsContent value="mine">
          <MyPayslips slips={mySlips} />
        </TabsContent>

        {isHr && (
          <TabsContent value="runs">
            <RunsTable runs={runs} />
          </TabsContent>
        )}

        {isHr && (
          <TabsContent value="analytics">
            <Card>
              <CardHeader><CardTitle className="text-sm">Net payout — last 6 runs</CardTitle></CardHeader>
              <CardContent className="h-72">
                {chartData.length === 0 ? (
                  <div className="h-full flex items-center justify-center text-sm text-muted-foreground">No data yet.</div>
                ) : (
                  <ResponsiveContainer width="100%" height="100%">
                    <BarChart data={chartData}>
                      <CartesianGrid strokeDasharray="3 3" className="stroke-border" />
                      <XAxis dataKey="label" tick={{ fontSize: 11 }} />
                      <YAxis tick={{ fontSize: 11 }} tickFormatter={(v) => `${(v / 1000).toFixed(0)}k`} />
                      <Tooltip formatter={(v: number) => inr(v)} />
                      <Bar dataKey="total" fill="hsl(var(--primary))" radius={[4, 4, 0, 0]} />
                    </BarChart>
                  </ResponsiveContainer>
                )}
              </CardContent>
            </Card>
          </TabsContent>
        )}
      </Tabs>
    </div>
  );
}

function StatCard({ label, value, icon: Icon }: { label: string; value: string; icon: any }) {
  return (
    <Card>
      <CardContent className="p-4 flex items-center justify-between">
        <div>
          <div className="text-xs text-muted-foreground">{label}</div>
          <div className="text-xl font-semibold mt-1">{value}</div>
        </div>
        <div className="h-9 w-9 rounded-md bg-primary/10 text-primary flex items-center justify-center">
          <Icon className="h-4 w-4" />
        </div>
      </CardContent>
    </Card>
  );
}

function MyPayslips({ slips }: { slips: any[] }) {
  const { user, employee } = useMe();

  const download = (slip: any) => {
    if (!employee) return;
    downloadPayslipPDF({
      slip,
      employee: {
        full_name: employee.name || user?.name || "Employee",
        employee_code: employee.employee_code ?? "—",
        designation: employee.designation,
        department: employee.department || employee.department_name,
        email: employee.email || user?.email,
      },
    });
  };

  return (
    <Card className="mt-4">
      <CardContent className="p-0 overflow-x-auto">
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>Period</TableHead>
              <TableHead>Gross</TableHead>
              <TableHead>Deductions</TableHead>
              <TableHead>Net</TableHead>
              <TableHead>Paid days</TableHead>
              <TableHead className="text-right">Payslip</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {slips.length === 0 && (
              <TableRow><TableCell colSpan={6} className="text-center py-10 text-sm text-muted-foreground">
                <Wallet className="h-6 w-6 mx-auto mb-2 opacity-40" /> No payslips yet.
              </TableCell></TableRow>
            )}
            {slips.map((s) => (
              <TableRow key={s.id}>
                <TableCell className="text-sm font-medium">{monthName(s.month)} {s.year}</TableCell>
                <TableCell className="text-sm">{inr(Number(s.gross))}</TableCell>
                <TableCell className="text-sm text-destructive">{inr(Number(s.pf) + Number(s.tax) + Number(s.other_deductions))}</TableCell>
                <TableCell className="text-sm font-semibold">{inr(Number(s.net))}</TableCell>
                <TableCell className="text-sm">{s.paid_days} / {s.working_days}</TableCell>
                <TableCell className="text-right">
                  <Button size="sm" variant="outline" className="h-7 gap-1" onClick={() => download(s)}>
                    <Download className="h-3 w-3" /> PDF
                  </Button>
                </TableCell>
              </TableRow>
            ))}
          </TableBody>
        </Table>
      </CardContent>
    </Card>
  );
}

function RunsTable({ runs }: { runs: any[] }) {
  const qc = useQueryClient();
  const { user } = useMe();
  const [openRun, setOpenRun] = useState<any>(null);
  const { data: allSlips = [] } = useQuery({ queryKey: ["all-payslips"] }) as { data: any[] };

  const setStatus = useMutation({
    mutationFn: async ({ id, status }: { id: string; status: "processed" | "paid" | "draft" }) => {
      const [year, month] = id.split("-").map(Number);
      const slipsToUpdate = allSlips.filter((s: any) => s.year === year && s.month === month);
      await Promise.all(slipsToUpdate.map((s: any) => payrollService.update(s.id, { status })));
    },
    onSuccess: () => {
      toast.success("Status updated");
      qc.invalidateQueries({ queryKey: ["all-payslips"] });
    },
    onError: (e: any) => toast.error(e.response?.data?.message || e.message),
  });

  return (
    <>
      <Card className="mt-4">
        <CardContent className="p-0 overflow-x-auto">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Period</TableHead>
                <TableHead>Status</TableHead>
                <TableHead>Processed</TableHead>
                <TableHead className="text-right">Actions</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {runs.length === 0 && (
                <TableRow><TableCell colSpan={4} className="text-center py-10 text-sm text-muted-foreground">No payroll runs yet. Generate one above.</TableCell></TableRow>
              )}
              {runs.map((r) => (
                <TableRow key={r.id}>
                  <TableCell className="text-sm font-medium">{monthName(r.month)} {r.year}</TableCell>
                  <TableCell>
                    <Badge variant={r.status === "paid" ? "default" : r.status === "processed" ? "secondary" : "outline"} className="capitalize">{r.status}</Badge>
                  </TableCell>
                  <TableCell className="text-sm text-muted-foreground">{r.processed_at ? new Date(r.processed_at).toLocaleDateString() : "—"}</TableCell>
                  <TableCell className="text-right">
                    <div className="flex gap-1 justify-end">
                      <Button size="sm" variant="outline" className="h-7" onClick={() => setOpenRun(r)}>View</Button>
                      {r.status === "draft" && <Button size="sm" className="h-7" onClick={() => setStatus.mutate({ id: r.id, status: "processed" })}>Process</Button>}
                      {r.status === "processed" && <Button size="sm" className="h-7" onClick={() => setStatus.mutate({ id: r.id, status: "paid" })}>Mark paid</Button>}
                    </div>
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </CardContent>
      </Card>

      <RunDetailDialog run={openRun} onClose={() => setOpenRun(null)} />
    </>
  );
}

function RunDetailDialog({ run, onClose }: { run: any; onClose: () => void }) {
  const { data: allSlips = [] } = useQuery({ queryKey: ["all-payslips"] }) as { data: any[] };
  const { data: slips = [] } = useQuery({
    queryKey: ["run-slips", run?.id],
    enabled: !!run?.id,
    queryFn: async () => {
      const [year, month] = run.id.split("-").map(Number);
      return allSlips.filter((s: any) => s.year === year && s.month === month);
    },
  });

  const total = slips.reduce((s, r) => s + Number(r.net || 0), 0);

  const downloadOne = (slip: any) => {
    downloadPayslipPDF({
      slip,
      employee: {
        full_name: slip.employees?.profiles?.full_name ?? "—",
        employee_code: slip.employees?.employee_code ?? "—",
        designation: slip.employees?.designation,
        department: slip.employees?.departments?.name,
      },
    });
  };

  return (
    <Dialog open={!!run} onOpenChange={(o) => !o && onClose()}>
      <DialogContent className="max-w-3xl">
        <DialogHeader>
          <DialogTitle>{run && `${monthName(run.month)} ${run.year} — payroll run`}</DialogTitle>
        </DialogHeader>
        <div className="text-sm text-muted-foreground">
          {slips.length} employees · Total net <span className="font-semibold text-foreground">{inr(total)}</span>
        </div>
        <div className="max-h-[60vh] overflow-y-auto border rounded-md">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Employee</TableHead>
                <TableHead>Gross</TableHead>
                <TableHead>Deduct.</TableHead>
                <TableHead>Net</TableHead>
                <TableHead></TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {slips.map((s) => (
                <TableRow key={s.id}>
                  <TableCell className="text-sm">
                    <div className="font-medium">{s.employees?.profiles?.full_name ?? "—"}</div>
                    <div className="text-xs text-muted-foreground">{s.employees?.employee_code}</div>
                  </TableCell>
                  <TableCell className="text-sm">{inr(Number(s.gross))}</TableCell>
                  <TableCell className="text-sm text-destructive">{inr(Number(s.pf) + Number(s.tax) + Number(s.other_deductions))}</TableCell>
                  <TableCell className="text-sm font-semibold">{inr(Number(s.net))}</TableCell>
                  <TableCell className="text-right">
                    <Button size="icon" variant="ghost" className="h-7 w-7" onClick={() => downloadOne(s)}>
                      <Download className="h-3 w-3" />
                    </Button>
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </div>
      </DialogContent>
    </Dialog>
  );
}

function NewRunDialog() {
  const qc = useQueryClient();
  const [open, setOpen] = useState(false);
  const now = new Date();
  const [month, setMonth] = useState(now.getMonth() + 1);
  const [year, setYear] = useState(now.getFullYear());
  const [busy, setBusy] = useState(false);

  const generate = async () => {
    setBusy(true);
    try {
      await payrollService.generate(month, year);
      toast.success(`Generated payslips for ${monthName(month)} ${year}`);
      qc.invalidateQueries({ queryKey: ["all-payslips"] });
      qc.invalidateQueries({ queryKey: ["my-payslips"] });
      setOpen(false);
    } catch (e: any) {
      toast.error(e.response?.data?.message || e.message);
    } finally {
      setBusy(false);
    }
  };

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild><Button><Plus className="h-4 w-4" /> Generate payroll</Button></DialogTrigger>
      <DialogContent>
        <DialogHeader><DialogTitle>Generate monthly payroll</DialogTitle></DialogHeader>
        <div className="grid grid-cols-2 gap-3">
          <div className="space-y-1.5">
            <div className="text-xs text-muted-foreground">Month</div>
            <Select value={String(month)} onValueChange={(v) => setMonth(Number(v))}>
              <SelectTrigger><SelectValue /></SelectTrigger>
              <SelectContent>
                {Array.from({ length: 12 }, (_, i) => (
                  <SelectItem key={i + 1} value={String(i + 1)}>{monthName(i + 1)}</SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
          <div className="space-y-1.5">
            <div className="text-xs text-muted-foreground">Year</div>
            <Select value={String(year)} onValueChange={(v) => setYear(Number(v))}>
              <SelectTrigger><SelectValue /></SelectTrigger>
              <SelectContent>
                {Array.from({ length: 5 }, (_, i) => now.getFullYear() - 2 + i).map((y) => (
                  <SelectItem key={y} value={String(y)}>{y}</SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
        </div>
        <p className="text-xs text-muted-foreground">
          Computes Basic, HRA (40%), Allowances (15%), PF (12%), and progressive tax from each active employee's
          base salary. Unpaid leave days reduce the paid days proportionally.
        </p>
        <DialogFooter>
          <Button variant="outline" onClick={() => setOpen(false)}>Cancel</Button>
          <Button onClick={generate} disabled={busy}>
            {busy && <Loader2 className="h-4 w-4 animate-spin" />} Generate
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
