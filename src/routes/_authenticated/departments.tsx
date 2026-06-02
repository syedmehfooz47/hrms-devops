import { createFileRoute } from "@tanstack/react-router";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useState } from "react";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Dialog, DialogContent, DialogFooter, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { Plus, Trash2, Loader2, Building2 } from "lucide-react";
import { toast } from "sonner";
import { useMe } from "@/hooks/use-me";
import { isHrOrAdmin } from "@/lib/hrms";

export const Route = createFileRoute("/_authenticated/departments")({
  component: DepartmentsPage,
});

function DepartmentsPage() {
  const { roles } = useMe();
  const canManage = isHrOrAdmin(roles);
  const qc = useQueryClient();

  const { data: rows = [] } = useQuery({
    queryKey: ["departments-page"],
    queryFn: async () => {
      const { data: depts } = await supabase.from("departments").select("*").order("name");
      const { data: emps } = await supabase.from("employees").select("department_id");
      return (depts ?? []).map((d) => ({
        ...d,
        headcount: emps?.filter((e) => e.department_id === d.id).length ?? 0,
      }));
    },
  });

  const delMut = useMutation({
    mutationFn: async (id: string) => {
      const { error } = await supabase.from("departments").delete().eq("id", id);
      if (error) throw error;
    },
    onSuccess: () => { toast.success("Deleted"); qc.invalidateQueries({ queryKey: ["departments-page"] }); qc.invalidateQueries({ queryKey: ["dept-breakdown"] }); },
    onError: (e: any) => toast.error(e.message),
  });

  return (
    <div className="space-y-5">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold tracking-tight">Departments</h1>
          <p className="text-sm text-muted-foreground">Organize teams across the company.</p>
        </div>
        {canManage && <NewDeptDialog />}
      </div>

      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
        {rows.length === 0 && (
          <Card className="col-span-full"><CardContent className="py-10 text-center text-sm text-muted-foreground">No departments yet.</CardContent></Card>
        )}
        {rows.map((d) => (
          <Card key={d.id} className="group">
            <CardContent className="p-5">
              <div className="flex items-start justify-between">
                <div className="h-10 w-10 rounded-lg bg-primary/10 text-primary flex items-center justify-center"><Building2 className="h-5 w-5" /></div>
                {canManage && (
                  <Button variant="ghost" size="icon" className="opacity-0 group-hover:opacity-100 transition" onClick={() => { if (confirm(`Delete ${d.name}?`)) delMut.mutate(d.id); }}>
                    <Trash2 className="h-4 w-4 text-destructive" />
                  </Button>
                )}
              </div>
              <h3 className="font-semibold mt-3">{d.name}</h3>
              {d.description && <p className="text-sm text-muted-foreground line-clamp-2 mt-1">{d.description}</p>}
              <div className="text-xs text-muted-foreground mt-3">{d.headcount} member{d.headcount === 1 ? "" : "s"}</div>
            </CardContent>
          </Card>
        ))}
      </div>
    </div>
  );
}

function NewDeptDialog() {
  const [open, setOpen] = useState(false);
  const [name, setName] = useState("");
  const [description, setDescription] = useState("");
  const qc = useQueryClient();

  const mut = useMutation({
    mutationFn: async () => {
      if (!name.trim()) throw new Error("Name required");
      const { error } = await supabase.from("departments").insert({ name: name.trim(), description: description || null });
      if (error) throw error;
    },
    onSuccess: () => {
      toast.success("Department created");
      qc.invalidateQueries({ queryKey: ["departments-page"] });
      qc.invalidateQueries({ queryKey: ["departments-list"] });
      qc.invalidateQueries({ queryKey: ["dept-breakdown"] });
      qc.invalidateQueries({ queryKey: ["dashboard-stats"] });
      setOpen(false); setName(""); setDescription("");
    },
    onError: (e: any) => toast.error(e.message),
  });

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild><Button><Plus className="h-4 w-4" /> New department</Button></DialogTrigger>
      <DialogContent>
        <DialogHeader><DialogTitle>New department</DialogTitle></DialogHeader>
        <div className="space-y-3">
          <div className="space-y-1.5"><Label>Name</Label><Input value={name} onChange={(e) => setName(e.target.value)} placeholder="Engineering" /></div>
          <div className="space-y-1.5"><Label>Description</Label><Textarea value={description} onChange={(e) => setDescription(e.target.value)} /></div>
        </div>
        <DialogFooter>
          <Button variant="outline" onClick={() => setOpen(false)}>Cancel</Button>
          <Button onClick={() => mut.mutate()} disabled={mut.isPending}>{mut.isPending && <Loader2 className="h-4 w-4 animate-spin" />} Create</Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
