import { createFileRoute } from "@tanstack/react-router";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useState } from "react";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Badge } from "@/components/ui/badge";
import { Dialog, DialogContent, DialogFooter, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Plus, Loader2, Check, X } from "lucide-react";
import { toast } from "sonner";
import { useMe } from "@/hooks/use-me";
import { isManagerOrAbove, daysBetween } from "@/lib/hrms";
import { format } from "date-fns";

export const Route = createFileRoute("/_authenticated/leave")({
  component: LeavePage,
});

function LeavePage() {
  const { user, roles } = useMe();
  const canApprove = isManagerOrAbove(roles);

  const { data: mine = [] } = useQuery({
    queryKey: ["my-leave", user?.id],
    enabled: !!user?.id,
    queryFn: async () => {
      const { data } = await supabase.from("leave_requests").select("*").eq("employee_id", user!.id).order("created_at", { ascending: false });
      return data ?? [];
    },
  });

  const { data: all = [] } = useQuery({
    queryKey: ["all-leave"],
    enabled: canApprove,
    queryFn: async () => {
      const { data } = await supabase
        .from("leave_requests")
        .select("*, profiles!leave_requests_employee_id_fkey(full_name, email)")
        .order("created_at", { ascending: false });
      return data ?? [];
    },
  });

  return (
    <div className="space-y-5">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold tracking-tight">Leave</h1>
          <p className="text-sm text-muted-foreground">Apply for time off and track approvals.</p>
        </div>
        <NewLeaveDialog />
      </div>

      <Tabs defaultValue="mine">
        <TabsList>
          <TabsTrigger value="mine">My requests ({mine.length})</TabsTrigger>
          {canApprove && <TabsTrigger value="all">All requests ({all.length})</TabsTrigger>}
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

  const decide = useMutation({
    mutationFn: async ({ id, status }: { id: string; status: "approved" | "rejected" }) => {
      const { error } = await supabase.from("leave_requests").update({
        status,
        approver_id: user?.id,
        decided_at: new Date().toISOString(),
      }).eq("id", id);
      if (error) throw error;
    },
    onSuccess: () => {
      toast.success("Decision recorded");
      qc.invalidateQueries({ queryKey: ["my-leave"] });
      qc.invalidateQueries({ queryKey: ["all-leave"] });
      qc.invalidateQueries({ queryKey: ["dashboard-stats"] });
      qc.invalidateQueries({ queryKey: ["recent-leave"] });
    },
    onError: (e: any) => toast.error(e.message),
  });

  return (
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
              {canApprove && <TableHead className="text-right">Action</TableHead>}
            </TableRow>
          </TableHeader>
          <TableBody>
            {rows.length === 0 && (
              <TableRow><TableCell colSpan={canApprove ? 7 : 6} className="text-center py-8 text-sm text-muted-foreground">No leave requests.</TableCell></TableRow>
            )}
            {rows.map((r) => (
              <TableRow key={r.id}>
                {showEmployee && <TableCell className="text-sm font-medium">{r.profiles?.full_name ?? "—"}</TableCell>}
                <TableCell className="capitalize text-sm">{r.leave_type}</TableCell>
                <TableCell className="text-sm whitespace-nowrap">{format(new Date(r.start_date), "MMM d")} – {format(new Date(r.end_date), "MMM d, yyyy")}</TableCell>
                <TableCell className="text-sm">{daysBetween(r.start_date, r.end_date)}</TableCell>
                <TableCell className="text-sm max-w-xs truncate">{r.reason ?? "—"}</TableCell>
                <TableCell>
                  <Badge variant={r.status === "approved" ? "default" : r.status === "rejected" ? "destructive" : "secondary"} className="capitalize">{r.status}</Badge>
                </TableCell>
                {canApprove && (
                  <TableCell className="text-right">
                    {r.status === "pending" ? (
                      <div className="flex gap-1 justify-end">
                        <Button size="icon" variant="ghost" onClick={() => decide.mutate({ id: r.id, status: "approved" })}><Check className="h-4 w-4 text-success" /></Button>
                        <Button size="icon" variant="ghost" onClick={() => decide.mutate({ id: r.id, status: "rejected" })}><X className="h-4 w-4 text-destructive" /></Button>
                      </div>
                    ) : <span className="text-xs text-muted-foreground">—</span>}
                  </TableCell>
                )}
              </TableRow>
            ))}
          </TableBody>
        </Table>
      </CardContent>
    </Card>
  );
}

function NewLeaveDialog() {
  const { user } = useMe();
  const qc = useQueryClient();
  const [open, setOpen] = useState(false);
  const [form, setForm] = useState({ leave_type: "casual", start_date: "", end_date: "", reason: "" });

  const mut = useMutation({
    mutationFn: async () => {
      if (!user) throw new Error("Not signed in");
      if (!form.start_date || !form.end_date) throw new Error("Pick dates");
      const { error } = await supabase.from("leave_requests").insert({
        employee_id: user.id,
        leave_type: form.leave_type as any,
        start_date: form.start_date,
        end_date: form.end_date,
        reason: form.reason || null,
      });
      if (error) throw error;
    },
    onSuccess: () => {
      toast.success("Leave request submitted");
      qc.invalidateQueries({ queryKey: ["my-leave"] });
      qc.invalidateQueries({ queryKey: ["all-leave"] });
      qc.invalidateQueries({ queryKey: ["dashboard-stats"] });
      setOpen(false);
      setForm({ leave_type: "casual", start_date: "", end_date: "", reason: "" });
    },
    onError: (e: any) => toast.error(e.message),
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
                <SelectItem value="casual">Casual</SelectItem>
                <SelectItem value="sick">Sick</SelectItem>
                <SelectItem value="earned">Earned</SelectItem>
                <SelectItem value="unpaid">Unpaid</SelectItem>
              </SelectContent>
            </Select>
          </div>
          <div className="grid grid-cols-2 gap-3">
            <div className="space-y-1.5"><Label>From</Label><Input type="date" value={form.start_date} onChange={(e) => setForm({ ...form, start_date: e.target.value })} /></div>
            <div className="space-y-1.5"><Label>To</Label><Input type="date" value={form.end_date} onChange={(e) => setForm({ ...form, end_date: e.target.value })} /></div>
          </div>
          <div className="space-y-1.5"><Label>Reason</Label><Textarea value={form.reason} onChange={(e) => setForm({ ...form, reason: e.target.value })} placeholder="Optional" /></div>
        </div>
        <DialogFooter>
          <Button variant="outline" onClick={() => setOpen(false)}>Cancel</Button>
          <Button onClick={() => mut.mutate()} disabled={mut.isPending}>{mut.isPending && <Loader2 className="h-4 w-4 animate-spin" />} Submit</Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
