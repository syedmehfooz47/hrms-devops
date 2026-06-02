import { createFileRoute } from "@tanstack/react-router";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Clock, LogIn, LogOut, Loader2 } from "lucide-react";
import { toast } from "sonner";
import { useMe } from "@/hooks/use-me";
import { workedHours } from "@/lib/hrms";
import { format } from "date-fns";

export const Route = createFileRoute("/_authenticated/attendance")({
  component: AttendancePage,
});

function AttendancePage() {
  const { user } = useMe();
  const qc = useQueryClient();
  const today = new Date().toISOString().slice(0, 10);

  const { data: todayRow } = useQuery({
    queryKey: ["attendance-today", user?.id],
    enabled: !!user?.id,
    queryFn: async () => {
      const { data } = await supabase.from("attendance").select("*").eq("employee_id", user!.id).eq("work_date", today).maybeSingle();
      return data;
    },
  });

  const { data: history = [] } = useQuery({
    queryKey: ["attendance-history", user?.id],
    enabled: !!user?.id,
    queryFn: async () => {
      const { data } = await supabase.from("attendance").select("*").eq("employee_id", user!.id).order("work_date", { ascending: false }).limit(30);
      return data ?? [];
    },
  });

  const checkIn = useMutation({
    mutationFn: async () => {
      const { error } = await supabase.from("attendance").insert({
        employee_id: user!.id,
        work_date: today,
        check_in: new Date().toISOString(),
      });
      if (error) throw error;
    },
    onSuccess: () => { toast.success("Checked in"); qc.invalidateQueries({ queryKey: ["attendance-today"] }); qc.invalidateQueries({ queryKey: ["attendance-history"] }); qc.invalidateQueries({ queryKey: ["dashboard-stats"] }); },
    onError: (e: any) => toast.error(e.message),
  });

  const checkOut = useMutation({
    mutationFn: async () => {
      if (!todayRow) throw new Error("No check-in record");
      const { error } = await supabase.from("attendance").update({ check_out: new Date().toISOString() }).eq("id", todayRow.id);
      if (error) throw error;
    },
    onSuccess: () => { toast.success("Checked out"); qc.invalidateQueries({ queryKey: ["attendance-today"] }); qc.invalidateQueries({ queryKey: ["attendance-history"] }); },
    onError: (e: any) => toast.error(e.message),
  });

  const hoursToday = workedHours(todayRow?.check_in, todayRow?.check_out);

  return (
    <div className="space-y-5">
      <div>
        <h1 className="text-2xl font-bold tracking-tight">Attendance</h1>
        <p className="text-sm text-muted-foreground">Check in / out and view your timesheet.</p>
      </div>

      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2 text-base"><Clock className="h-4 w-4" /> Today · {format(new Date(), "PPPP")}</CardTitle>
          <CardDescription>{todayRow?.check_in ? `Checked in at ${format(new Date(todayRow.check_in), "p")}` : "Not yet checked in"}</CardDescription>
        </CardHeader>
        <CardContent className="flex flex-col sm:flex-row sm:items-center gap-4">
          <div className="flex-1 grid grid-cols-3 gap-3 text-center">
            <Stat label="Check in" value={todayRow?.check_in ? format(new Date(todayRow.check_in), "p") : "—"} />
            <Stat label="Check out" value={todayRow?.check_out ? format(new Date(todayRow.check_out), "p") : "—"} />
            <Stat label="Hours" value={hoursToday ? hoursToday.toFixed(2) : "—"} />
          </div>
          <div className="flex gap-2">
            <Button onClick={() => checkIn.mutate()} disabled={!!todayRow || checkIn.isPending}>
              {checkIn.isPending ? <Loader2 className="h-4 w-4 animate-spin" /> : <LogIn className="h-4 w-4" />} Check in
            </Button>
            <Button variant="outline" onClick={() => checkOut.mutate()} disabled={!todayRow || !!todayRow?.check_out || checkOut.isPending}>
              {checkOut.isPending ? <Loader2 className="h-4 w-4 animate-spin" /> : <LogOut className="h-4 w-4" />} Check out
            </Button>
          </div>
        </CardContent>
      </Card>

      <Card>
        <CardHeader><CardTitle className="text-base">Last 30 days</CardTitle></CardHeader>
        <CardContent className="p-0 overflow-x-auto">
          <Table>
            <TableHeader>
              <TableRow><TableHead>Date</TableHead><TableHead>Check in</TableHead><TableHead>Check out</TableHead><TableHead>Hours</TableHead><TableHead>Overtime</TableHead></TableRow>
            </TableHeader>
            <TableBody>
              {history.length === 0 && <TableRow><TableCell colSpan={5} className="text-center py-8 text-sm text-muted-foreground">No history yet.</TableCell></TableRow>}
              {history.map((r) => {
                const h = workedHours(r.check_in, r.check_out);
                const ot = Math.max(0, h - 8);
                return (
                  <TableRow key={r.id}>
                    <TableCell className="text-sm">{format(new Date(r.work_date), "PP")}</TableCell>
                    <TableCell className="text-sm">{r.check_in ? format(new Date(r.check_in), "p") : "—"}</TableCell>
                    <TableCell className="text-sm">{r.check_out ? format(new Date(r.check_out), "p") : "—"}</TableCell>
                    <TableCell className="text-sm font-mono">{h ? h.toFixed(2) : "—"}</TableCell>
                    <TableCell className="text-sm font-mono">{ot > 0 ? ot.toFixed(2) : "—"}</TableCell>
                  </TableRow>
                );
              })}
            </TableBody>
          </Table>
        </CardContent>
      </Card>
    </div>
  );
}

function Stat({ label, value }: { label: string; value: string }) {
  return (
    <div className="rounded-lg bg-accent/50 p-3">
      <div className="text-[10px] uppercase tracking-wide text-muted-foreground">{label}</div>
      <div className="font-mono font-semibold mt-1">{value}</div>
    </div>
  );
}
