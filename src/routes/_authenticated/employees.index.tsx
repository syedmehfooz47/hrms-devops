import { createFileRoute, Link, Navigate } from "@tanstack/react-router";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { employeeService, departmentService, userService } from "@/services/api";
import { useState, useEffect } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Card } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Avatar, AvatarFallback } from "@/components/ui/avatar";
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Plus, Search, Loader2, Trash2, Edit } from "lucide-react";
import { toast } from "sonner";
import { useMe } from "@/hooks/use-me";
import { isHrOrAdmin } from "@/lib/hrms";

export const Route = createFileRoute("/_authenticated/employees/")({
  component: EmployeesPage,
});

function EmployeesPage() {
  const { roles } = useMe();
  const canManage = isHrOrAdmin(roles);
  
  if (!canManage) {
    return <Navigate to="/profile" replace />;
  }

  const [q, setQ] = useState("");
  const [statusFilter, setStatusFilter] = useState<string>("all");
  const qc = useQueryClient();

  const { data: rows = [], isLoading } = useQuery({
    queryKey: ["employees", q, statusFilter],
    queryFn: async () => {
      const data = await employeeService.getAll({
        q: q ? q.trim() : undefined,
        status: statusFilter !== "all" ? statusFilter : undefined,
      });
      return data ?? [];
    },
  });

  const { data: departments = [] } = useQuery({
    queryKey: ["departments-list"],
    queryFn: async () => {
      const res = await departmentService.getAll();
      return res ?? [];
    },
  });

  const { data: candidates = [] } = useQuery({
    queryKey: ["non-employees"],
    enabled: canManage,
    queryFn: async () => {
      const [profiles, emps] = await Promise.all([
        userService.getProfiles(),
        employeeService.getAll(),
      ]);
      const set = new Set((emps ?? []).map((e: any) => String(e.user_id)));
      return (profiles ?? []).filter((p: any) => !set.has(String(p.id)));
    },
  });

  const deleteMut = useMutation({
    mutationFn: async (id: string | number) => {
      await employeeService.delete(id);
    },
    onSuccess: () => {
      toast.success("Employee removed");
      qc.invalidateQueries({ queryKey: ["employees"] });
    },
    onError: (e: any) => toast.error(e.response?.data?.message || e.message),
  });

  return (
    <div className="space-y-5">
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3">
        <div>
          <h1 className="text-2xl font-bold tracking-tight">Employees</h1>
          <p className="text-sm text-muted-foreground">Manage your workforce.</p>
        </div>
        {canManage && <NewEmployeeDialog departments={departments} candidates={candidates} />}
      </div>

      <Card className="p-4">
        <div className="flex flex-col sm:flex-row gap-2 mb-4">
          <div className="relative flex-1">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
            <Input value={q} onChange={(e) => setQ(e.target.value)} placeholder="Search by name, email, code, designation…" className="pl-9" />
          </div>
          <Select value={statusFilter} onValueChange={setStatusFilter}>
            <SelectTrigger className="w-full sm:w-44"><SelectValue /></SelectTrigger>
            <SelectContent>
              <SelectItem value="all">All statuses</SelectItem>
              <SelectItem value="active">Active</SelectItem>
              <SelectItem value="probation">Probation</SelectItem>
              <SelectItem value="on_leave">On leave</SelectItem>
              <SelectItem value="terminated">Terminated</SelectItem>
            </SelectContent>
          </Select>
        </div>

        <div className="overflow-x-auto">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Employee</TableHead>
                <TableHead>Code</TableHead>
                <TableHead>Department</TableHead>
                <TableHead>Designation</TableHead>
                <TableHead>Type</TableHead>
                <TableHead>Status</TableHead>
                <TableHead className="text-right">Actions</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {isLoading && (
                <TableRow><TableCell colSpan={7} className="text-center py-8"><Loader2 className="h-4 w-4 animate-spin inline" /></TableCell></TableRow>
              )}
              {!isLoading && rows.length === 0 && (
                <TableRow><TableCell colSpan={7} className="text-center py-8 text-muted-foreground text-sm">No employees yet.</TableCell></TableRow>
              )}
              {rows.map((r: any) => {
                const init = (r.profiles?.full_name || "?").split(" ").map((p: string) => p[0]).slice(0, 2).join("");
                return (
                  <TableRow key={r.id}>
                    <TableCell>
                      <Link to="/employees/$id" params={{ id: String(r.id) }} className="flex items-center gap-3 hover:underline">
                        <Avatar className="h-8 w-8"><AvatarFallback className="text-xs">{init}</AvatarFallback></Avatar>
                        <div>
                          <div className="font-medium text-sm">{r.profiles?.full_name || "—"}</div>
                          <div className="text-xs text-muted-foreground">{r.profiles?.email}</div>
                        </div>
                      </Link>
                    </TableCell>
                    <TableCell className="font-mono text-xs">{r.employee_code}</TableCell>
                    <TableCell className="text-sm">{r.departments?.name ?? "—"}</TableCell>
                    <TableCell className="text-sm">{r.designation ?? "—"}</TableCell>
                    <TableCell className="text-sm capitalize">{r.employment_type?.replace("_", " ")}</TableCell>
                    <TableCell>
                      <Badge variant={r.status === "active" ? "default" : r.status === "terminated" ? "destructive" : "secondary"} className="capitalize">
                        {r.status?.replace("_", " ")}
                      </Badge>
                    </TableCell>
                    <TableCell className="text-right">
                      {canManage && (
                        <div className="flex justify-end gap-1">
                          <Link 
                            to="/employees/$id" 
                            params={{ id: String(r.id) }} 
                            className="inline-flex items-center justify-center rounded-md text-sm font-medium transition-colors hover:bg-accent hover:text-accent-foreground h-8 w-8"
                          >
                            <Edit className="h-4 w-4 text-primary" />
                          </Link>
                          <Button variant="ghost" size="icon" onClick={() => { if (confirm("Remove this employee?")) deleteMut.mutate(r.id); }}>
                            <Trash2 className="h-4 w-4 text-destructive" />
                          </Button>
                        </div>
                      )}
                    </TableCell>
                  </TableRow>
                );
              })}
            </TableBody>
          </Table>
        </div>
      </Card>
    </div>
  );
}

function NewEmployeeDialog({ departments, candidates }: { departments: any[]; candidates: any[] }) {
  const [open, setOpen] = useState(false);
  const [createNewAccount, setCreateNewAccount] = useState(candidates.length === 0);
  const [form, setForm] = useState({
    profile_id: "",
    name: "",
    email: "",
    phone: "",
    password: "",
    employee_code: "",
    department_id: "",
    designation: "",
    employment_type: "full_time",
    status: "active",
    date_of_joining: new Date().toISOString().slice(0, 10),
    salary_basic: "",
  });

  // Automatically switch to create account mode if no candidates exist
  useEffect(() => {
    if (candidates.length === 0) {
      setCreateNewAccount(true);
    }
  }, [candidates]);

  const qc = useQueryClient();

  const mut = useMutation({
    mutationFn: async () => {
      if (!createNewAccount && !form.profile_id) throw new Error("Pick a user");
      if (createNewAccount && !form.name) throw new Error("Full name is required");
      if (createNewAccount && !form.email) throw new Error("Email is required");
      if (!form.employee_code) throw new Error("Employee code is required");

      await employeeService.create({
        user_id: createNewAccount ? null : form.profile_id,
        name: createNewAccount ? form.name : null,
        email: createNewAccount ? form.email : null,
        phone: createNewAccount ? form.phone : null,
        password: createNewAccount ? form.password || "Welcome@2026" : null,
        employee_code: form.employee_code,
        department_id: form.department_id ? Number(form.department_id) : null,
        designation: form.designation || null,
        employment_type: form.employment_type,
        status: form.status,
        date_of_joining: form.date_of_joining || null,
        salary_basic: form.salary_basic ? Number(form.salary_basic) : 0,
      });
    },
    onSuccess: () => {
      toast.success("Employee added");
      qc.invalidateQueries({ queryKey: ["employees"] });
      qc.invalidateQueries({ queryKey: ["non-employees"] });
      qc.invalidateQueries({ queryKey: ["dashboard-stats"] });
      setOpen(false);
      setForm({
        profile_id: "",
        name: "",
        email: "",
        phone: "",
        password: "",
        employee_code: "",
        department_id: "",
        designation: "",
        employment_type: "full_time",
        status: "active",
        date_of_joining: new Date().toISOString().slice(0, 10),
        salary_basic: "",
      });
    },
    onError: (e: any) => toast.error(e.response?.data?.message || e.message),
  });

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild>
        <Button><Plus className="h-4 w-4" /> Add employee</Button>
      </DialogTrigger>
      <DialogContent className="max-w-lg">
        <DialogHeader>
          <DialogTitle>New employee</DialogTitle>
          <DialogDescription>Add a new employee and link or create their user account.</DialogDescription>
        </DialogHeader>
        <div className="grid gap-3">
          {candidates.length > 0 && (
            <div className="flex items-center space-x-2 py-1">
              <input
                type="checkbox"
                id="create_new_account"
                checked={createNewAccount}
                onChange={(e) => setCreateNewAccount(e.target.checked)}
                className="h-4 w-4 rounded border-gray-300 text-primary focus:ring-primary cursor-pointer"
              />
              <Label htmlFor="create_new_account" className="cursor-pointer font-normal text-sm">Create a brand new user account for this employee</Label>
            </div>
          )}

          {createNewAccount ? (
            <div className="space-y-3 border-l-2 border-primary/20 pl-3">
              <div className="space-y-1.5">
                <Label>Full name</Label>
                <Input value={form.name} onChange={(e) => setForm({ ...form, name: e.target.value })} placeholder="John Doe" />
              </div>
              <div className="grid grid-cols-2 gap-3">
                <div className="space-y-1.5">
                  <Label>Email address</Label>
                  <Input type="email" value={form.email} onChange={(e) => setForm({ ...form, email: e.target.value })} placeholder="john@example.com" />
                </div>
                <div className="space-y-1.5">
                  <Label>Phone number</Label>
                  <Input value={form.phone} onChange={(e) => setForm({ ...form, phone: e.target.value })} placeholder="+1234567890" />
                </div>
              </div>
              <div className="space-y-1.5">
                <Label>Default password</Label>
                <Input type="password" value={form.password} onChange={(e) => setForm({ ...form, password: e.target.value })} placeholder="Welcome@2026 (Leave blank to use default)" />
              </div>
            </div>
          ) : (
            <div className="space-y-1.5">
              <Label>User account</Label>
              <Select value={form.profile_id} onValueChange={(v) => setForm({ ...form, profile_id: v })}>
                <SelectTrigger><SelectValue placeholder="Pick a registered user" /></SelectTrigger>
                <SelectContent>
                  {candidates.map((c) => (
                    <SelectItem key={c.id} value={String(c.id)}>{c.full_name || c.email} — {c.email}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
          )}

          <div className="grid grid-cols-2 gap-3">
            <div className="space-y-1.5">
              <Label>Employee code</Label>
              <Input value={form.employee_code} onChange={(e) => setForm({ ...form, employee_code: e.target.value })} placeholder="EMP-001" />
            </div>
            <div className="space-y-1.5">
              <Label>Department</Label>
              <Select value={form.department_id} onValueChange={(v) => setForm({ ...form, department_id: v })}>
                <SelectTrigger><SelectValue placeholder="—" /></SelectTrigger>
                <SelectContent>
                  {departments.map((d) => <SelectItem key={d.id} value={String(d.id)}>{d.name}</SelectItem>)}
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-1.5 col-span-2">
              <Label>Designation</Label>
              <Input value={form.designation} onChange={(e) => setForm({ ...form, designation: e.target.value })} placeholder="Software Engineer" />
            </div>
            <div className="space-y-1.5">
              <Label>Employment type</Label>
              <Select value={form.employment_type} onValueChange={(v) => setForm({ ...form, employment_type: v })}>
                <SelectTrigger><SelectValue /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="full_time">Full-time</SelectItem>
                  <SelectItem value="part_time">Part-time</SelectItem>
                  <SelectItem value="contract">Contract</SelectItem>
                  <SelectItem value="intern">Intern</SelectItem>
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-1.5">
              <Label>Status</Label>
              <Select value={form.status} onValueChange={(v) => setForm({ ...form, status: v })}>
                <SelectTrigger><SelectValue /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="active">Active</SelectItem>
                  <SelectItem value="probation">Probation</SelectItem>
                  <SelectItem value="on_leave">On leave</SelectItem>
                  <SelectItem value="terminated">Terminated</SelectItem>
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-1.5">
              <Label>Joining date</Label>
              <Input type="date" value={form.date_of_joining} onChange={(e) => setForm({ ...form, date_of_joining: e.target.value })} />
            </div>
            <div className="space-y-1.5">
              <Label>Basic salary</Label>
              <Input type="number" value={form.salary_basic} onChange={(e) => setForm({ ...form, salary_basic: e.target.value })} placeholder="0" />
            </div>
          </div>
        </div>
        <DialogFooter>
          <Button variant="outline" onClick={() => setOpen(false)}>Cancel</Button>
          <Button onClick={() => mut.mutate()} disabled={mut.isPending}>
            {mut.isPending && <Loader2 className="h-4 w-4 animate-spin" />} Save
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
