import { createFileRoute } from "@tanstack/react-router";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { leaveService } from "@/services/api";
import { useState, useMemo } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Badge } from "@/components/ui/badge";
import { Dialog, DialogContent, DialogFooter, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Plus, Loader2, Check, X, CalendarDays, CircleSlash, Clock3 } from "lucide-react";
import { toast } from "sonner";
import { useMe } from "@/hooks/use-me";
import { isManagerOrAbove, daysBetween } from "@/lib/hrms";
import { format } from "date-fns";
import { Progress } from "@/components/ui/progress";

export const Route = createFileRoute("/_authenticated/leave")({
  component: LeavePage,
});

const LEAVE_TYPES = [
  { value: "casual", label: "Casual" },
  { value: "sick", label: "Sick" },
  { value: "earned", label: "Earned" },
  { value: "unpaid", label: "Unpaid" },
] as const;

function LeavePage() {
  const { user, roles, employee } = useMe();
  const canApprove = isManagerOrAbove(roles);
  const year = new Date().getFullYear();

  const { data: balances = [] } = useQuery({
    queryKey: ["my-balances", employee?.id, year],
    enabled: !!employee?.id,
    queryFn: async () => {
      const data = await leaveService.getBalances(employee!.id, year);
      return (data ?? []).map((b: any) => {
        let type = b.leave_type.toLowerCase();
        if (type.includes("annual") || type.includes("earned")) type = "earned";
        else if (type.includes("casual")) type = "casual";
        else if (type.includes("sick")) type = "sick";
        return {
          ...b,
          leave_type: type,
        };
      });
    },
  });

  const { data: mine = [] } = useQuery({
    queryKey: ["my-leave", employee?.id],
    enabled: !!employee?.id,
    queryFn: async () => {
      const data = await leaveService.getMy();
      return (data ?? []).map((lr: any) => {
        let type = lr.leave_type.toLowerCase();
        if (type.includes("annual") || type.includes("earned")) type = "earned";
        else if (type.includes("casual")) type = "casual";
        else if (type.includes("sick")) type = "sick";
        return {
          ...lr,
          leave_type: type,
        };
      });
    },
  });

  const { data: all = [] } = useQuery({
    queryKey: ["all-leave"],
    enabled: canApprove,
    queryFn: async () => {
      const data = await leaveService.getAll();
      return (data ?? []).map((lr: any) => {
        let type = lr.leave_type.toLowerCase();
        if (type.includes("annual") || type.includes("earned")) type = "earned";
        else if (type.includes("casual")) type = "casual";
        else if (type.includes("sick")) type = "sick";
        return {
          ...lr,
          leave_type: type,
          profiles: {
            full_name: lr.employee_name,
            email: lr.email,
          },
        };
      });
    },
  });

  const pendingCount = useMemo(() => all.filter((r: any) => r.status === "pending").length, [all]);

  return (
    <div className="space-y-5">
      <div className="flex items-center justify-between flex-wrap gap-3">
        <div>
          <h1 className="text-2xl font-bold tracking-tight">Leave</h1>
          <p className="text-sm text-muted-foreground">Apply for time off, track balances and approvals.</p>
        </div>
        <NewLeaveDialog balances={balances} />
      </div>

      <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
        {(["casual", "sick", "earned"] as const).map((t) => {
          const b = balances.find((x: any) => x.leave_type === t);
          const allocated = Number(b?.allocated ?? 0);
          const used = Number(b?.used ?? 0);
          const remaining = Math.max(0, allocated - used);
          const pct = allocated > 0 ? (used / allocated) * 100 : 0;
          return (
            <Card key={t}>
              <CardHeader className="pb-2">
                <CardTitle className="text-sm font-medium capitalize flex items-center justify-between">
                  {t} leave
                  <Badge variant="outline" className="font-normal">{year}</Badge>
                </CardTitle>
              </CardHeader>
              <CardContent>
                <div className="flex items-baseline gap-2">
                  <div className="text-3xl font-bold">{remaining}</div>
                  <div className="text-xs text-muted-foreground">Remaining leave (of {allocated})</div>
                </div>
                <Progress value={pct} className="mt-2 h-1.5" />
                <div className="text-xs text-muted-foreground mt-1.5">{used} Used leave</div>
              </CardContent>
            </Card>
          );
        })}
      </div>

      <Tabs defaultValue="mine">
        <TabsList>
          <TabsTrigger value="mine">My requests ({mine.length})</TabsTrigger>
          {canApprove && (
            <TabsTrigger value="all">
              Approvals
              {pendingCount > 0 && <Badge className="ml-2 h-4 px-1.5 text-[10px]">{pendingCount}</Badge>}
            </TabsTrigger>
          )}
        </TabsList>

        <TabsContent value="mine">
          <LeaveTable rows={mine} showEmployee={false} />
        </TabsContent>
        {canApprove && (
          <TabsContent value="all">
            <LeaveTable rows={all} showEmployee />
          </TabsContent>
        )}
      </Tabs>
    </div>
  );
}

function LeaveTable({ rows, showEmployee }: { rows: any[]; showEmployee: boolean }) {
  const { user, roles } = useMe();
  const canApprove = isManagerOrAbove(roles);
  const qc = useQueryClient();
  const [decideRow, setDecideRow] = useState<{ id: string; status: "approved" | "rejected" } | null>(null);
  const [note, setNote] = useState("");

  const decide = useMutation({
    mutationFn: async ({ id, status, approver_note }: { id: string | number; status: "approved" | "rejected"; approver_note?: string }) => {
      if (status === "approved") {
        await leaveService.approve(id, user!.id, approver_note);
      } else {
        await leaveService.reject(id, user!.id, approver_note);
      }
    },
    onSuccess: () => {
      toast.success("Decision recorded");
      qc.invalidateQueries({ queryKey: ["my-leave"] });
      qc.invalidateQueries({ queryKey: ["all-leave"] });
      qc.invalidateQueries({ queryKey: ["my-balances"] });
      qc.invalidateQueries({ queryKey: ["dashboard-stats"] });
      qc.invalidateQueries({ queryKey: ["recent-leave"] });
      setDecideRow(null);
      setNote("");
    },
    onError: (e: any) => toast.error(e.response?.data?.message || e.message),
  });

  const cancel = useMutation({
    mutationFn: async (id: string | number) => {
      await leaveService.cancel(id);
    },
    onSuccess: () => {
      toast.success("Request cancelled");
      qc.invalidateQueries({ queryKey: ["my-leave"] });
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
                {showEmployee && <TableHead>Employee</TableHead>}
                <TableHead>Type</TableHead>
                <TableHead>Period</TableHead>
                <TableHead>Days</TableHead>
                <TableHead>Reason</TableHead>
                <TableHead>Status</TableHead>
                <TableHead className="text-right">Action</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {rows.length === 0 && (
                <TableRow><TableCell colSpan={showEmployee ? 7 : 6} className="text-center py-10 text-sm text-muted-foreground">
                  <CalendarDays className="h-6 w-6 mx-auto mb-2 opacity-40" />
                  No leave requests yet.
                </TableCell></TableRow>
              )}
              {rows.map((r) => (
                <TableRow key={r.id}>
                  {showEmployee && <TableCell className="text-sm font-medium">{r.profiles?.full_name ?? "—"}</TableCell>}
                  <TableCell className="capitalize text-sm">{r.leave_type}</TableCell>
                  <TableCell className="text-sm whitespace-nowrap">{format(new Date(r.start_date), "MMM d")} – {format(new Date(r.end_date), "MMM d, yyyy")}</TableCell>
                  <TableCell className="text-sm">{daysBetween(r.start_date, r.end_date)}</TableCell>
                  <TableCell className="text-sm max-w-xs">
                    <div className="truncate">{r.reason ?? "—"}</div>
                    {r.approver_note && (
                      <div className="text-xs text-muted-foreground truncate italic mt-0.5">Note: {r.approver_note}</div>
                    )}
                  </TableCell>
                  <TableCell>
                    <Badge variant={r.status === "approved" ? "default" : r.status === "rejected" ? "destructive" : "secondary"} className="capitalize gap-1">
                      {r.status === "pending" && <Clock3 className="h-3 w-3" />}
                      {r.status}
                    </Badge>
                  </TableCell>
                  <TableCell className="text-right">
                    {canApprove && r.status === "pending" ? (
                      <div className="flex gap-1 justify-end">
                        <Button size="sm" variant="outline" className="h-7 gap-1" onClick={() => { setDecideRow({ id: r.id, status: "approved" }); setNote(""); }}>
                          <Check className="h-3 w-3" /> Approve
                        </Button>
                        <Button size="sm" variant="outline" className="h-7 gap-1 text-destructive" onClick={() => { setDecideRow({ id: r.id, status: "rejected" }); setNote(""); }}>
                          <X className="h-3 w-3" /> Reject
                        </Button>
                      </div>
                    ) : !showEmployee && r.status === "pending" && r.employee_id === user?.id ? (
                      <Button size="sm" variant="ghost" className="h-7 gap-1 text-muted-foreground" onClick={() => cancel.mutate(r.id)}>
                        <CircleSlash className="h-3 w-3" /> Cancel
                      </Button>
                    ) : <span className="text-xs text-muted-foreground">—</span>}
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </CardContent>
      </Card>

      <Dialog open={!!decideRow} onOpenChange={(o) => !o && setDecideRow(null)}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle className="capitalize">{decideRow?.status} leave request</DialogTitle>
          </DialogHeader>
          <div className="space-y-1.5">
            <Label>Note (optional)</Label>
            <Textarea value={note} onChange={(e) => setNote(e.target.value)} placeholder="Add a note for the employee…" />
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setDecideRow(null)}>Cancel</Button>
            <Button
              variant={decideRow?.status === "rejected" ? "destructive" : "default"}
              onClick={() => decideRow && decide.mutate({ id: decideRow.id, status: decideRow.status, approver_note: note })}
              disabled={decide.isPending}
            >
              {decide.isPending && <Loader2 className="h-4 w-4 animate-spin" />}
              Confirm {decideRow?.status}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </>
  );
}

function NewLeaveDialog({ balances }: { balances: any[] }) {
  const { user, employee } = useMe();
  const qc = useQueryClient();
  const [open, setOpen] = useState(false);
  const [form, setForm] = useState({ leave_type: "casual", start_date: "", end_date: "", reason: "" });

  const days = form.start_date && form.end_date ? daysBetween(form.start_date, form.end_date) : 0;
  const bal = balances.find((b) => b.leave_type === form.leave_type);
  const remaining = bal ? Number(bal.allocated) - Number(bal.used) : null;
  const insufficient = remaining !== null && form.leave_type !== "unpaid" && days > remaining;

  const mut = useMutation({
    mutationFn: async () => {
      if (!employee) throw new Error("No employee record");
      if (!form.start_date || !form.end_date) throw new Error("Pick dates");
      if (new Date(form.end_date) < new Date(form.start_date)) throw new Error("End date must be after start date");
      if (insufficient) throw new Error(`Insufficient balance — only ${remaining} days available`);

      let dbLeaveType = form.leave_type;
      if (form.leave_type === "earned") dbLeaveType = "Annual Leave";
      else if (form.leave_type === "casual") dbLeaveType = "Casual Leave";
      else if (form.leave_type === "sick") dbLeaveType = "Sick Leave";

      await leaveService.apply({
        employee_id: employee.id,
        leave_type: dbLeaveType,
        start_date: form.start_date,
        end_date: form.end_date,
        reason: form.reason || undefined,
      });
    },
    onSuccess: () => {
      toast.success("Leave request submitted");
      qc.invalidateQueries({ queryKey: ["my-leave"] });
      qc.invalidateQueries({ queryKey: ["all-leave"] });
      qc.invalidateQueries({ queryKey: ["dashboard-stats"] });
      setOpen(false);
      setForm({ leave_type: "casual", start_date: "", end_date: "", reason: "" });
    },
    onError: (e: any) => toast.error(e.response?.data?.message || e.message),
  });

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild><Button><Plus className="h-4 w-4" /> Apply leave</Button></DialogTrigger>
      <DialogContent>
        <DialogHeader><DialogTitle>Apply for leave</DialogTitle></DialogHeader>
        <div className="space-y-3">
          <div className="space-y-1.5">
            <Label>Type</Label>
            <Select value={form.leave_type} onValueChange={(v) => setForm({ ...form, leave_type: v })}>
              <SelectTrigger><SelectValue /></SelectTrigger>
              <SelectContent>
                {LEAVE_TYPES.map((t) => (
                  <SelectItem key={t.value} value={t.value}>{t.label}</SelectItem>
                ))}
              </SelectContent>
            </Select>
            {remaining !== null && form.leave_type !== "unpaid" && (
              <div className="text-xs text-muted-foreground">{remaining} day(s) remaining</div>
            )}
          </div>
          <div className="grid grid-cols-2 gap-3">
            <div className="space-y-1.5"><Label>From</Label><Input type="date" value={form.start_date} onChange={(e) => setForm({ ...form, start_date: e.target.value })} /></div>
            <div className="space-y-1.5"><Label>To</Label><Input type="date" min={form.start_date} value={form.end_date} onChange={(e) => setForm({ ...form, end_date: e.target.value })} /></div>
          </div>
          {days > 0 && (
            <div className={`text-xs px-3 py-2 rounded-md ${insufficient ? "bg-destructive/10 text-destructive" : "bg-muted"}`}>
              {days} day(s) requested {insufficient && `— exceeds remaining balance of ${remaining}`}
            </div>
          )}
          <div className="space-y-1.5"><Label>Reason</Label><Textarea value={form.reason} onChange={(e) => setForm({ ...form, reason: e.target.value })} placeholder="Optional" /></div>
        </div>
        <DialogFooter>
          <Button variant="outline" onClick={() => setOpen(false)}>Cancel</Button>
          <Button onClick={() => mut.mutate()} disabled={mut.isPending || insufficient}>
            {mut.isPending && <Loader2 className="h-4 w-4 animate-spin" />} Submit
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
