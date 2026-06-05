import { createFileRoute } from "@tanstack/react-router";
import { useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useMe } from "@/hooks/use-me";
import { isHrOrAdmin, isManagerOrAbove } from "@/lib/hrms";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Label } from "@/components/ui/label";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Badge } from "@/components/ui/badge";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger, DialogFooter } from "@/components/ui/dialog";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Checkbox } from "@/components/ui/checkbox";
import { Briefcase, Plus, Users, CalendarClock, ClipboardList } from "lucide-react";
import { toast } from "sonner";

export const Route = createFileRoute("/_authenticated/recruitment")({
  component: RecruitmentPage,
});

type Job = {
  id: string; title: string; department_id: string | null; location: string | null;
  employment_type: "full_time" | "part_time" | "contract" | "intern";
  description: string | null; requirements: string | null;
  salary_min: number | null; salary_max: number | null;
  status: "open" | "closed" | "draft"; created_at: string;
};
type Candidate = {
  id: string; job_id: string; full_name: string; email: string; phone: string | null;
  resume_url: string | null; source: string | null; notes: string | null;
  stage: "applied" | "screening" | "interview" | "offer" | "hired" | "rejected";
  applied_at: string;
};
type Interview = {
  id: string; candidate_id: string; interviewer_id: string | null;
  scheduled_at: string; duration_minutes: number; mode: string | null;
  location: string | null; round: string | null;
  status: "scheduled" | "completed" | "cancelled" | "no_show";
  feedback: string | null; rating: number | null;
};
type OnboardingTask = {
  id: string; employee_id: string; title: string; description: string | null;
  category: string | null; due_date: string | null;
  status: "pending" | "in_progress" | "done"; position: number;
};

const stages: Candidate["stage"][] = ["applied", "screening", "interview", "offer", "hired", "rejected"];
const stageColor: Record<Candidate["stage"], string> = {
  applied: "bg-muted text-muted-foreground",
  screening: "bg-blue-500/15 text-blue-700 dark:text-blue-400 border-blue-500/30",
  interview: "bg-amber-500/15 text-amber-700 dark:text-amber-400 border-amber-500/30",
  offer: "bg-purple-500/15 text-purple-700 dark:text-purple-400 border-purple-500/30",
  hired: "bg-emerald-500/15 text-emerald-700 dark:text-emerald-400 border-emerald-500/30",
  rejected: "bg-destructive/15 text-destructive border-destructive/30",
};

function RecruitmentPage() {
  const { user, roles } = useMe();
  const isHR = isHrOrAdmin(roles);
  const isMgr = isManagerOrAbove(roles);
  const qc = useQueryClient();

  const jobs = useQuery({
    queryKey: ["jobs"],
    queryFn: async () => {
      const { data, error } = await supabase.from("job_postings").select("*").order("created_at", { ascending: false });
      if (error) throw error;
      return data as Job[];
    },
  });

  const candidates = useQuery({
    queryKey: ["candidates"],
    enabled: isMgr,
    queryFn: async () => {
      const { data, error } = await supabase.from("candidates").select("*").order("applied_at", { ascending: false });
      if (error) throw error;
      return data as Candidate[];
    },
  });

  const interviews = useQuery({
    queryKey: ["interviews"],
    enabled: isMgr,
    queryFn: async () => {
      const { data, error } = await supabase.from("interviews").select("*").order("scheduled_at", { ascending: true });
      if (error) throw error;
      return data as Interview[];
    },
  });

  const myOnboarding = useQuery({
    queryKey: ["onboarding", user?.id],
    enabled: !!user?.id,
    queryFn: async () => {
      const { data, error } = await supabase
        .from("onboarding_tasks").select("*")
        .eq("employee_id", user!.id).order("position");
      if (error) throw error;
      return data as OnboardingTask[];
    },
  });

  const employees = useQuery({
    queryKey: ["recr-employees"],
    enabled: isHR,
    queryFn: async () => {
      const { data, error } = await supabase.from("profiles").select("id, full_name").order("full_name");
      if (error) throw error;
      return data as { id: string; full_name: string }[];
    },
  });

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-semibold flex items-center gap-2"><Briefcase className="h-6 w-6" /> Recruitment & Onboarding</h1>
        <p className="text-sm text-muted-foreground">Job postings, candidate pipeline, interviews and new hire onboarding.</p>
      </div>

      <Tabs defaultValue="jobs">
        <TabsList>
          <TabsTrigger value="jobs">Jobs</TabsTrigger>
          {isMgr && <TabsTrigger value="pipeline">Pipeline</TabsTrigger>}
          {isMgr && <TabsTrigger value="interviews">Interviews</TabsTrigger>}
          <TabsTrigger value="onboarding">{isHR ? "Onboarding" : "My Onboarding"}</TabsTrigger>
        </TabsList>

        <TabsContent value="jobs" className="space-y-4">
          {isHR && (
            <div className="flex justify-end">
              <NewJobDialog userId={user?.id} onCreated={() => qc.invalidateQueries({ queryKey: ["jobs"] })} />
            </div>
          )}
          <div className="grid md:grid-cols-2 gap-3">
            {(jobs.data ?? []).map((j) => (
              <Card key={j.id}>
                <CardHeader>
                  <div className="flex items-start justify-between gap-2">
                    <div>
                      <CardTitle className="text-base">{j.title}</CardTitle>
                      <CardDescription>
                        {j.location ?? "Remote"} · {j.employment_type.replace("_", " ")}
                      </CardDescription>
                    </div>
                    <Badge variant="outline">{j.status}</Badge>
                  </div>
                </CardHeader>
                <CardContent className="space-y-2 text-sm">
                  {j.description && <p className="line-clamp-3 text-muted-foreground">{j.description}</p>}
                  {(j.salary_min || j.salary_max) && (
                    <p className="text-xs text-muted-foreground">
                      Salary: {j.salary_min ?? "—"} – {j.salary_max ?? "—"}
                    </p>
                  )}
                  {isHR && (
                    <div className="flex gap-2 pt-1">
                      <AddCandidateDialog jobId={j.id} onCreated={() => qc.invalidateQueries({ queryKey: ["candidates"] })} />
                      <Select
                        value={j.status}
                        onValueChange={async (v) => {
                          const { error } = await supabase.from("job_postings").update({ status: v as "draft" | "open" | "closed" }).eq("id", j.id);
                          if (error) toast.error(error.message);
                          else { toast.success("Updated"); qc.invalidateQueries({ queryKey: ["jobs"] }); }
                        }}
                      >
                        <SelectTrigger className="w-32 h-8"><SelectValue /></SelectTrigger>
                        <SelectContent>
                          <SelectItem value="draft">Draft</SelectItem>
                          <SelectItem value="open">Open</SelectItem>
                          <SelectItem value="closed">Closed</SelectItem>
                        </SelectContent>
                      </Select>
                    </div>
                  )}
                </CardContent>
              </Card>
            ))}
            {jobs.data?.length === 0 && <p className="text-sm text-muted-foreground">No job postings yet.</p>}
          </div>
        </TabsContent>

        {isMgr && (
          <TabsContent value="pipeline" className="space-y-3">
            <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-6 gap-3">
              {stages.map((s) => {
                const list = (candidates.data ?? []).filter((c) => c.stage === s);
                return (
                  <Card key={s}>
                    <CardHeader className="pb-2">
                      <CardDescription className="capitalize">{s}</CardDescription>
                      <CardTitle className="text-xl">{list.length}</CardTitle>
                    </CardHeader>
                    <CardContent className="space-y-2 max-h-80 overflow-y-auto">
                      {list.map((c) => (
                        <div key={c.id} className="border rounded-md p-2 text-xs space-y-1">
                          <div className="font-medium">{c.full_name}</div>
                          <div className="text-muted-foreground truncate">{c.email}</div>
                          <Select
                            value={c.stage}
                            onValueChange={async (v) => {
                              const { error } = await supabase.from("candidates").update({ stage: v as "applied" | "screening" | "interview" | "offer" | "hired" | "rejected" }).eq("id", c.id);
                              if (error) toast.error(error.message);
                              else { toast.success("Moved"); qc.invalidateQueries({ queryKey: ["candidates"] }); }
                            }}
                          >
                            <SelectTrigger className="h-7 text-xs"><SelectValue /></SelectTrigger>
                            <SelectContent>
                              {stages.map((st) => <SelectItem key={st} value={st} className="capitalize">{st}</SelectItem>)}
                            </SelectContent>
                          </Select>
                          {isHR && (
                            <ScheduleInterviewDialog
                              candidateId={c.id}
                              employees={employees.data ?? []}
                              onCreated={() => qc.invalidateQueries({ queryKey: ["interviews"] })}
                            />
                          )}
                        </div>
                      ))}
                      {list.length === 0 && <p className="text-xs text-muted-foreground">No candidates.</p>}
                    </CardContent>
                  </Card>
                );
              })}
            </div>
          </TabsContent>
        )}

        {isMgr && (
          <TabsContent value="interviews">
            <Card>
              <CardHeader><CardTitle className="flex items-center gap-2"><CalendarClock className="h-5 w-5" /> Interviews</CardTitle></CardHeader>
              <CardContent>
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead>Candidate</TableHead>
                      <TableHead>When</TableHead>
                      <TableHead>Mode</TableHead>
                      <TableHead>Round</TableHead>
                      <TableHead>Status</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {(interviews.data ?? []).map((i) => {
                      const cand = (candidates.data ?? []).find((c) => c.id === i.candidate_id);
                      return (
                        <TableRow key={i.id}>
                          <TableCell>{cand?.full_name ?? "—"}</TableCell>
                          <TableCell>{new Date(i.scheduled_at).toLocaleString()}</TableCell>
                          <TableCell>{i.mode ?? "—"}</TableCell>
                          <TableCell>{i.round ?? "—"}</TableCell>
                          <TableCell>
                            <Select
                              value={i.status}
                              onValueChange={async (v) => {
                                const { error } = await supabase.from("interviews").update({ status: v as "scheduled" | "completed" | "cancelled" | "no_show" }).eq("id", i.id);
                                if (error) toast.error(error.message);
                                else { toast.success("Updated"); qc.invalidateQueries({ queryKey: ["interviews"] }); }
                              }}
                            >
                              <SelectTrigger className="w-36 h-8"><SelectValue /></SelectTrigger>
                              <SelectContent>
                                <SelectItem value="scheduled">Scheduled</SelectItem>
                                <SelectItem value="completed">Completed</SelectItem>
                                <SelectItem value="cancelled">Cancelled</SelectItem>
                                <SelectItem value="no_show">No show</SelectItem>
                              </SelectContent>
                            </Select>
                          </TableCell>
                        </TableRow>
                      );
                    })}
                    {interviews.data?.length === 0 && (
                      <TableRow><TableCell colSpan={5} className="text-center text-muted-foreground">No interviews scheduled.</TableCell></TableRow>
                    )}
                  </TableBody>
                </Table>
              </CardContent>
            </Card>
          </TabsContent>
        )}

        <TabsContent value="onboarding" className="space-y-4">
          {isHR && (
            <div className="flex justify-end">
              <NewOnboardingDialog
                employees={employees.data ?? []}
                onCreated={() => qc.invalidateQueries({ queryKey: ["onboarding"] })}
              />
            </div>
          )}
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2"><ClipboardList className="h-5 w-5" /> My checklist</CardTitle>
              <CardDescription>Complete onboarding tasks assigned to you.</CardDescription>
            </CardHeader>
            <CardContent className="space-y-2">
              {(myOnboarding.data ?? []).map((t) => (
                <div key={t.id} className="flex items-start gap-3 border rounded-md p-3">
                  <Checkbox
                    checked={t.status === "done"}
                    onCheckedChange={async (checked) => {
                      const status = checked ? "done" : "pending";
                      const { error } = await supabase.from("onboarding_tasks").update({ status }).eq("id", t.id);
                      if (error) toast.error(error.message);
                      else qc.invalidateQueries({ queryKey: ["onboarding"] });
                    }}
                  />
                  <div className="flex-1">
                    <div className="flex items-center justify-between">
                      <span className={`font-medium ${t.status === "done" ? "line-through text-muted-foreground" : ""}`}>{t.title}</span>
                      <Badge variant="outline">{t.status.replace("_", " ")}</Badge>
                    </div>
                    {t.description && <p className="text-xs text-muted-foreground mt-1">{t.description}</p>}
                    <div className="flex gap-3 text-xs text-muted-foreground mt-1">
                      {t.category && <span>{t.category}</span>}
                      {t.due_date && <span>Due {new Date(t.due_date).toLocaleDateString()}</span>}
                    </div>
                  </div>
                </div>
              ))}
              {myOnboarding.data?.length === 0 && <p className="text-sm text-muted-foreground">No onboarding tasks assigned.</p>}
            </CardContent>
          </Card>
        </TabsContent>
      </Tabs>
    </div>
  );
}

function NewJobDialog({ userId, onCreated }: { userId?: string; onCreated: () => void }) {
  const [open, setOpen] = useState(false);
  const [f, setF] = useState({ title: "", location: "", employment_type: "full_time", description: "", requirements: "", salary_min: "", salary_max: "" });
  const create = useMutation({
    mutationFn: async () => {
      const { error } = await supabase.from("job_postings").insert({
        title: f.title, location: f.location || null,
        employment_type: f.employment_type as Job["employment_type"],
        description: f.description || null, requirements: f.requirements || null,
        salary_min: f.salary_min ? Number(f.salary_min) : null,
        salary_max: f.salary_max ? Number(f.salary_max) : null,
        status: "open", posted_by: userId ?? null,
      });
      if (error) throw error;
    },
    onSuccess: () => { toast.success("Job posted"); setOpen(false); onCreated(); },
    onError: (e: Error) => toast.error(e.message),
  });
  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild><Button size="sm"><Plus className="h-4 w-4 mr-1" /> New job</Button></DialogTrigger>
      <DialogContent className="max-w-lg">
        <DialogHeader><DialogTitle>Post a job</DialogTitle></DialogHeader>
        <div className="space-y-3">
          <div><Label>Title</Label><Input value={f.title} onChange={(e) => setF({ ...f, title: e.target.value })} /></div>
          <div className="grid grid-cols-2 gap-3">
            <div><Label>Location</Label><Input value={f.location} onChange={(e) => setF({ ...f, location: e.target.value })} /></div>
            <div>
              <Label>Type</Label>
              <Select value={f.employment_type} onValueChange={(v) => setF({ ...f, employment_type: v })}>
                <SelectTrigger><SelectValue /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="full_time">Full time</SelectItem>
                  <SelectItem value="part_time">Part time</SelectItem>
                  <SelectItem value="contract">Contract</SelectItem>
                  <SelectItem value="intern">Intern</SelectItem>
                </SelectContent>
              </Select>
            </div>
          </div>
          <div className="grid grid-cols-2 gap-3">
            <div><Label>Salary min</Label><Input type="number" value={f.salary_min} onChange={(e) => setF({ ...f, salary_min: e.target.value })} /></div>
            <div><Label>Salary max</Label><Input type="number" value={f.salary_max} onChange={(e) => setF({ ...f, salary_max: e.target.value })} /></div>
          </div>
          <div><Label>Description</Label><Textarea value={f.description} onChange={(e) => setF({ ...f, description: e.target.value })} /></div>
          <div><Label>Requirements</Label><Textarea value={f.requirements} onChange={(e) => setF({ ...f, requirements: e.target.value })} /></div>
        </div>
        <DialogFooter><Button onClick={() => create.mutate()} disabled={!f.title || create.isPending}>Post</Button></DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

function AddCandidateDialog({ jobId, onCreated }: { jobId: string; onCreated: () => void }) {
  const [open, setOpen] = useState(false);
  const [f, setF] = useState({ full_name: "", email: "", phone: "", source: "", notes: "" });
  const create = useMutation({
    mutationFn: async () => {
      const { error } = await supabase.from("candidates").insert({
        job_id: jobId, full_name: f.full_name, email: f.email,
        phone: f.phone || null, source: f.source || null, notes: f.notes || null,
      });
      if (error) throw error;
    },
    onSuccess: () => { toast.success("Candidate added"); setOpen(false); setF({ full_name: "", email: "", phone: "", source: "", notes: "" }); onCreated(); },
    onError: (e: Error) => toast.error(e.message),
  });
  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild><Button size="sm" variant="outline"><Users className="h-4 w-4 mr-1" /> Candidate</Button></DialogTrigger>
      <DialogContent>
        <DialogHeader><DialogTitle>Add candidate</DialogTitle></DialogHeader>
        <div className="space-y-3">
          <div><Label>Full name</Label><Input value={f.full_name} onChange={(e) => setF({ ...f, full_name: e.target.value })} /></div>
          <div className="grid grid-cols-2 gap-3">
            <div><Label>Email</Label><Input type="email" value={f.email} onChange={(e) => setF({ ...f, email: e.target.value })} /></div>
            <div><Label>Phone</Label><Input value={f.phone} onChange={(e) => setF({ ...f, phone: e.target.value })} /></div>
          </div>
          <div><Label>Source</Label><Input value={f.source} onChange={(e) => setF({ ...f, source: e.target.value })} placeholder="LinkedIn, referral…" /></div>
          <div><Label>Notes</Label><Textarea value={f.notes} onChange={(e) => setF({ ...f, notes: e.target.value })} /></div>
        </div>
        <DialogFooter><Button onClick={() => create.mutate()} disabled={!f.full_name || !f.email || create.isPending}>Add</Button></DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

function ScheduleInterviewDialog({ candidateId, employees, onCreated }: {
  candidateId: string;
  employees: { id: string; full_name: string }[];
  onCreated: () => void;
}) {
  const [open, setOpen] = useState(false);
  const [f, setF] = useState({ scheduled_at: "", duration_minutes: 60, mode: "video", round: "Round 1", interviewer_id: "" });
  const create = useMutation({
    mutationFn: async () => {
      if (!f.scheduled_at) throw new Error("Pick a date/time");
      const { error } = await supabase.from("interviews").insert({
        candidate_id: candidateId,
        scheduled_at: new Date(f.scheduled_at).toISOString(),
        duration_minutes: f.duration_minutes,
        mode: f.mode, round: f.round,
        interviewer_id: f.interviewer_id || null,
      });
      if (error) throw error;
    },
    onSuccess: () => { toast.success("Interview scheduled"); setOpen(false); onCreated(); },
    onError: (e: Error) => toast.error(e.message),
  });
  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild><Button size="sm" variant="ghost" className="h-7 w-full"><CalendarClock className="h-3 w-3 mr-1" /> Schedule</Button></DialogTrigger>
      <DialogContent>
        <DialogHeader><DialogTitle>Schedule interview</DialogTitle></DialogHeader>
        <div className="space-y-3">
          <div><Label>Date & time</Label><Input type="datetime-local" value={f.scheduled_at} onChange={(e) => setF({ ...f, scheduled_at: e.target.value })} /></div>
          <div className="grid grid-cols-2 gap-3">
            <div><Label>Duration (min)</Label><Input type="number" value={f.duration_minutes} onChange={(e) => setF({ ...f, duration_minutes: Number(e.target.value) })} /></div>
            <div><Label>Round</Label><Input value={f.round} onChange={(e) => setF({ ...f, round: e.target.value })} /></div>
          </div>
          <div>
            <Label>Mode</Label>
            <Select value={f.mode} onValueChange={(v) => setF({ ...f, mode: v })}>
              <SelectTrigger><SelectValue /></SelectTrigger>
              <SelectContent>
                <SelectItem value="video">Video</SelectItem>
                <SelectItem value="phone">Phone</SelectItem>
                <SelectItem value="onsite">On-site</SelectItem>
              </SelectContent>
            </Select>
          </div>
          <div>
            <Label>Interviewer</Label>
            <Select value={f.interviewer_id} onValueChange={(v) => setF({ ...f, interviewer_id: v })}>
              <SelectTrigger><SelectValue placeholder="Optional" /></SelectTrigger>
              <SelectContent>
                {employees.map((e) => <SelectItem key={e.id} value={e.id}>{e.full_name}</SelectItem>)}
              </SelectContent>
            </Select>
          </div>
        </div>
        <DialogFooter><Button onClick={() => create.mutate()} disabled={create.isPending}>Schedule</Button></DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

const DEFAULT_ONBOARDING = [
  { title: "Sign offer letter & contract", category: "Paperwork" },
  { title: "Submit ID & tax documents", category: "Paperwork" },
  { title: "Set up email & accounts", category: "IT" },
  { title: "Receive laptop & equipment", category: "IT" },
  { title: "Complete HR orientation", category: "HR" },
  { title: "Meet your team & manager", category: "Team" },
  { title: "Review role expectations & 30/60/90 plan", category: "Role" },
];

function NewOnboardingDialog({ employees, onCreated }: {
  employees: { id: string; full_name: string }[];
  onCreated: () => void;
}) {
  const [open, setOpen] = useState(false);
  const [employeeId, setEmployeeId] = useState("");
  const [useDefaults, setUseDefaults] = useState(true);
  const [customTitle, setCustomTitle] = useState("");
  const create = useMutation({
    mutationFn: async () => {
      if (!employeeId) throw new Error("Select employee");
      const rows = useDefaults
        ? DEFAULT_ONBOARDING.map((t, i) => ({ employee_id: employeeId, title: t.title, category: t.category, position: i }))
        : [{ employee_id: employeeId, title: customTitle, position: 0 }];
      if (!useDefaults && !customTitle) throw new Error("Enter a task title");
      const { error } = await supabase.from("onboarding_tasks").insert(rows);
      if (error) throw error;
    },
    onSuccess: () => { toast.success("Onboarding created"); setOpen(false); onCreated(); },
    onError: (e: Error) => toast.error(e.message),
  });
  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild><Button size="sm"><Plus className="h-4 w-4 mr-1" /> Assign onboarding</Button></DialogTrigger>
      <DialogContent>
        <DialogHeader><DialogTitle>Assign onboarding checklist</DialogTitle></DialogHeader>
        <div className="space-y-3">
          <div>
            <Label>Employee</Label>
            <Select value={employeeId} onValueChange={setEmployeeId}>
              <SelectTrigger><SelectValue placeholder="Select employee" /></SelectTrigger>
              <SelectContent>
                {employees.map((e) => <SelectItem key={e.id} value={e.id}>{e.full_name}</SelectItem>)}
              </SelectContent>
            </Select>
          </div>
          <div className="flex items-center gap-2">
            <Checkbox id="defaults" checked={useDefaults} onCheckedChange={(c) => setUseDefaults(!!c)} />
            <Label htmlFor="defaults">Use default new-hire checklist ({DEFAULT_ONBOARDING.length} tasks)</Label>
          </div>
          {!useDefaults && (
            <div><Label>Single task title</Label><Input value={customTitle} onChange={(e) => setCustomTitle(e.target.value)} /></div>
          )}
        </div>
        <DialogFooter><Button onClick={() => create.mutate()} disabled={create.isPending}>Assign</Button></DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
