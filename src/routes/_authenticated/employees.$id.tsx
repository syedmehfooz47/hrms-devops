import { createFileRoute, Link, Navigate } from "@tanstack/react-router";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { employeeService, departmentService, userService } from "@/services/api";
import { useState, useEffect } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Avatar, AvatarFallback } from "@/components/ui/avatar";
import { Badge } from "@/components/ui/badge";
import { Textarea } from "@/components/ui/textarea";
import { ArrowLeft, Loader2 } from "lucide-react";
import { toast } from "sonner";
import { useMe } from "@/hooks/use-me";
import { isHrOrAdmin } from "@/lib/hrms";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";

export const Route = createFileRoute("/_authenticated/employees/$id")({
  component: EmployeeDetailPage,
});

function EmployeeDetailPage() {
  const { id } = Route.useParams();
  const { user, roles, employee } = useMe();
  const qc = useQueryClient();

  const canManage = isHrOrAdmin(roles) || user?.role === "admin";
  const isSelf = String(employee?.id) === String(id);

  if (!canManage && !isSelf) {
    return <Navigate to="/profile" replace />;
  }

  const { data, isLoading } = useQuery({
    queryKey: ["employee", id],
    queryFn: async () => {
      return await employeeService.getById(id);
    },
  });

  const [form, setForm] = useState<any>({});
  useEffect(() => { if (data) setForm(data); }, [data]);

  const { data: depts = [] } = useQuery({
    queryKey: ["departments-list"],
    queryFn: async () => {
      const res = await departmentService.getAll();
      return res ?? [];
    },
  });

  const saveMut = useMutation({
    mutationFn: async () => {
      if (data.user_id) {
        await userService.updateProfile(data.user_id, {
          name: form.profiles?.full_name,
          email: form.profiles?.email,
          phone: form.profiles?.phone,
        });
      }
      await employeeService.update(id, {
        name: form.profiles?.full_name,
        email: form.profiles?.email,
        phone: form.profiles?.phone,
        designation: form.designation,
        department_id: form.department_id ? Number(form.department_id) : null,
        employment_type: form.employment_type,
        status: form.status,
        date_of_joining: form.date_of_joining,
        date_of_birth: form.date_of_birth,
        salary_basic: form.salary_basic ? Number(form.salary_basic) : 0,
        address: form.address,
        emergency_contact_name: form.emergency_contact_name,
        emergency_contact_phone: form.emergency_contact_phone,
      });
    },
    onSuccess: () => {
      toast.success("Saved");
      qc.invalidateQueries({ queryKey: ["employee", id] });
      qc.invalidateQueries({ queryKey: ["employees"] });
    },
    onError: (e: any) => toast.error(e.response?.data?.message || e.message),
  });


  if (isLoading) return <div className="text-center py-12"><Loader2 className="h-5 w-5 animate-spin inline" /></div>;
  if (!data) return <div className="text-sm text-muted-foreground">Employee not found.</div>;

  const init = (data.profiles?.full_name || "?").split(" ").map((p: string) => p[0]).slice(0, 2).join("");

  return (
    <div className="space-y-5 max-w-4xl">
      <Link to={canManage ? "/employees" : "/profile"} className="text-sm text-muted-foreground hover:text-foreground inline-flex items-center gap-1">
        <ArrowLeft className="h-3.5 w-3.5" /> Back to {canManage ? "employees" : "profile"}
      </Link>

      <Card>
        <CardContent className="p-6 flex items-center gap-4">
          <Avatar className="h-16 w-16"><AvatarFallback className="text-lg">{init}</AvatarFallback></Avatar>
          <div className="flex-1">
            <h1 className="text-xl font-bold">{data.profiles?.full_name}</h1>
            <p className="text-sm text-muted-foreground">{data.designation || "—"} · {data.departments?.name || "—"}</p>
            <div className="flex gap-2 mt-2">
              <Badge variant="outline" className="font-mono text-xs">{data.employee_code}</Badge>
              <Badge className="capitalize">{data.status?.replace("_", " ")}</Badge>
            </div>
          </div>
        </CardContent>
      </Card>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
        <Card>
          <CardHeader><CardTitle className="text-base">Personal</CardTitle></CardHeader>
          <CardContent className="space-y-3">
            <Field label="Full name"><Input disabled={!canManage} value={form.profiles?.full_name ?? ""} onChange={(e) => setForm({ ...form, profiles: { ...(form.profiles || {}), full_name: e.target.value } })} /></Field>
            <Field label="Email"><Input disabled={!canManage} value={form.profiles?.email ?? ""} onChange={(e) => setForm({ ...form, profiles: { ...(form.profiles || {}), email: e.target.value } })} /></Field>
            <Field label="Phone"><Input disabled={!canManage} value={form.profiles?.phone ?? ""} onChange={(e) => setForm({ ...form, profiles: { ...(form.profiles || {}), phone: e.target.value } })} /></Field>
            <Field label="Date of birth"><Input disabled={!canManage} type="date" value={form.date_of_birth ? String(form.date_of_birth).slice(0, 10) : ""} onChange={(e) => setForm({ ...form, date_of_birth: e.target.value })} /></Field>
            <Field label="Address"><Textarea disabled={!canManage} value={form.address ?? ""} onChange={(e) => setForm({ ...form, address: e.target.value })} /></Field>
          </CardContent>
        </Card>

        <Card>
          <CardHeader><CardTitle className="text-base">Professional</CardTitle></CardHeader>
          <CardContent className="space-y-3">
            <Field label="Designation"><Input disabled={!canManage} value={form.designation ?? ""} onChange={(e) => setForm({ ...form, designation: e.target.value })} /></Field>
            <Field label="Department">
              <Select disabled={!canManage} value={form.department_id ? String(form.department_id) : ""} onValueChange={(v) => setForm({ ...form, department_id: v })}>
                <SelectTrigger><SelectValue placeholder="—" /></SelectTrigger>
                <SelectContent>{depts.map((d: any) => <SelectItem key={d.id} value={String(d.id)}>{d.name}</SelectItem>)}</SelectContent>
              </Select>
            </Field>
            <Field label="Employment type">
              <Select disabled={!canManage} value={form.employment_type ?? ""} onValueChange={(v) => setForm({ ...form, employment_type: v })}>
                <SelectTrigger><SelectValue /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="full_time">Full-time</SelectItem>
                  <SelectItem value="part_time">Part-time</SelectItem>
                  <SelectItem value="contract">Contract</SelectItem>
                  <SelectItem value="intern">Intern</SelectItem>
                </SelectContent>
              </Select>
            </Field>
            <Field label="Status">
              <Select disabled={!canManage} value={form.status ?? ""} onValueChange={(v) => setForm({ ...form, status: v })}>
                <SelectTrigger><SelectValue /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="active">Active</SelectItem>
                  <SelectItem value="probation">Probation</SelectItem>
                  <SelectItem value="on_leave">On leave</SelectItem>
                  <SelectItem value="terminated">Terminated</SelectItem>
                </SelectContent>
              </Select>
            </Field>
            <Field label="Joining date"><Input disabled={!canManage} type="date" value={form.date_of_joining ? String(form.date_of_joining).slice(0, 10) : ""} onChange={(e) => setForm({ ...form, date_of_joining: e.target.value })} /></Field>
            <Field label="Basic salary"><Input disabled={!canManage} type="number" value={form.salary_basic ?? ""} onChange={(e) => setForm({ ...form, salary_basic: e.target.value })} /></Field>
          </CardContent>
        </Card>

        <Card className="lg:col-span-2">
          <CardHeader><CardTitle className="text-base">Emergency contact</CardTitle></CardHeader>
          <CardContent className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            <Field label="Contact name"><Input disabled={!canManage} value={form.emergency_contact_name ?? ""} onChange={(e) => setForm({ ...form, emergency_contact_name: e.target.value })} /></Field>
            <Field label="Contact phone"><Input disabled={!canManage} value={form.emergency_contact_phone ?? ""} onChange={(e) => setForm({ ...form, emergency_contact_phone: e.target.value })} /></Field>
          </CardContent>
        </Card>
      </div>

      {canManage && (
        <div className="flex justify-end">
          <Button onClick={() => saveMut.mutate()} disabled={saveMut.isPending}>
            {saveMut.isPending && <Loader2 className="h-4 w-4 animate-spin" />} Save changes
          </Button>
        </div>
      )}
    </div>
  );
}

function Field({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div className="space-y-1.5">
      <Label className="text-xs uppercase tracking-wide text-muted-foreground">{label}</Label>
      {children}
    </div>
  );
}
