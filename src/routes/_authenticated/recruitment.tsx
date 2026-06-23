import { createFileRoute, redirect } from "@tanstack/react-router";
import { useState, useMemo } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { recruitmentService, employeeService, userService, authService } from "@/services/api";
import { useMe } from "@/hooks/use-me";
import { isHrOrAdmin, isManagerOrAbove } from "@/lib/hrms";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Label } from "@/components/ui/label";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Badge } from "@/components/ui/badge";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger, DialogFooter, DialogDescription } from "@/components/ui/dialog";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Checkbox } from "@/components/ui/checkbox";
import { Briefcase, Plus, Users, CalendarClock, ClipboardList, Sparkles, FileDown, BrainCircuit, Loader2 } from "lucide-react";
import { toast } from "sonner";

export const Route = createFileRoute("/_authenticated/recruitment")({
  beforeLoad: async () => {
    const user = authService.getCurrentUser();
    if (!user || (user.role !== "admin" && user.role !== "hr_manager" && user.role !== "dept_manager")) {
      throw redirect({ to: "/dashboard" });
    }
  },
  component: RecruitmentPage,
});

type Job = {
  id: string | number; title: string; department_id: string | number | null; location: string | null;
  employment_type: "full_time" | "part_time" | "contract" | "intern";
  description: string | null; requirements: string | null;
  salary_min: number | null; salary_max: number | null;
  status: "open" | "closed" | "draft"; created_at: string;
};
type Candidate = {
  id: string | number; job_id: string | number; full_name: string; email: string; phone: string | null;
  resume_url: string | null; source: string | null; notes: string | null;
  stage: "applied" | "screening" | "interview" | "offer" | "hired" | "rejected";
  applied_at: string;
  ai_score?: number | null;
  ai_analysis?: string | null;
  ai_status?: "pending" | "running" | "success" | "failed" | null;
};
type Interview = {
  id: string | number; candidate_id: string | number; interviewer_id: string | number | null;
  scheduled_at: string; duration_minutes: number; mode: string | null;
  location: string | null; round: string | null;
  status: "scheduled" | "completed" | "cancelled" | "no_show";
  feedback: string | null; rating: number | null;
};
type OnboardingTask = {
  id: string | number; employee_id: string | number; title: string; description: string | null;
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
  const { user, roles, employee } = useMe();
  const isHR = isHrOrAdmin(roles);
  const isMgr = isManagerOrAbove(roles);
  const qc = useQueryClient();

  const screenMutation = useMutation({
    mutationFn: async (candidateId: string | number) => {
      await recruitmentService.triggerScreening(candidateId);
    },
    onSuccess: () => {
      toast.success("AI Resume screening completed!");
      qc.invalidateQueries({ queryKey: ["candidates"] });
    },
    onError: (e: any) => {
      toast.error(e.response?.data?.message || e.message);
      qc.invalidateQueries({ queryKey: ["candidates"] });
    },
  });

  const jobs = useQuery({
    queryKey: ["jobs"],
    queryFn: async () => {
      const data = await recruitmentService.getJobs();
      return data as Job[];
    },
  });

  const candidates = useQuery({
    queryKey: ["candidates"],
    enabled: isMgr,
    queryFn: async () => {
      const data = await recruitmentService.getCandidates();
      return data as Candidate[];
    },
  });

  const interviews = useQuery({
    queryKey: ["interviews"],
    enabled: isMgr,
    queryFn: async () => {
      const data = await recruitmentService.getInterviews();
      return data as Interview[];
    },
  });

  const myOnboarding = useQuery({
    queryKey: ["onboarding", employee?.id],
    enabled: !!employee?.id,
    queryFn: async () => {
      const data = await recruitmentService.getOnboarding(employee!.id);
      return data as OnboardingTask[];
    },
  });

  const profiles = useQuery({
    queryKey: ["recr-profiles"],
    enabled: isHR,
    queryFn: async () => {
      const data = await userService.getProfiles();
      return data as { id: string | number; full_name: string }[];
    },
  });

  const employees = useQuery({
    queryKey: ["recr-employees"],
    enabled: isHR,
    queryFn: async () => {
      const emps = await employeeService.getAll();
      return (emps ?? []).map((e: any) => ({
        id: e.id,
        full_name: e.name,
      }));
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
              <NewJobDialog onCreated={() => qc.invalidateQueries({ queryKey: ["jobs"] })} />
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
                          try {
                            await recruitmentService.updateJobStatus(j.id, v);
                            toast.success("Updated");
                            qc.invalidateQueries({ queryKey: ["jobs"] });
                          } catch (err: any) {
                            toast.error(err.response?.data?.message || err.message);
                          }
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
                        <div key={c.id} className="border rounded-md p-2 text-xs space-y-1 bg-card relative">
                          <div className="font-medium flex items-center justify-between gap-1">
                            <span className="truncate">{c.full_name}</span>
                            {c.ai_status === "success" && typeof c.ai_score === "number" && (
                              <Badge className="text-[9px] px-1 h-4 bg-emerald-500/10 text-emerald-700 dark:text-emerald-400 border-emerald-500/20 shrink-0">
                                {c.ai_score}% Match
                              </Badge>
                            )}
                            {c.ai_status === "running" && (
                              <Loader2 className="h-3 w-3 animate-spin text-primary shrink-0" />
                            )}
                            {c.ai_status === "failed" && (
                              <Badge variant="destructive" className="text-[9px] px-1 h-4 shrink-0">
                                AI Fail
                              </Badge>
                            )}
                          </div>
                          <div className="text-muted-foreground truncate">{c.email}</div>
                          <Select
                            value={c.stage}
                            onValueChange={async (v) => {
                              try {
                                await recruitmentService.updateCandidateStage(c.id, v);
                                toast.success("Moved");
                                qc.invalidateQueries({ queryKey: ["candidates"] });
                              } catch (err: any) {
                                toast.error(err.response?.data?.message || err.message);
                              }
                            }}
                          >
                            <SelectTrigger className="h-7 text-xs"><SelectValue /></SelectTrigger>
                            <SelectContent>
                              {stages.map((st) => <SelectItem key={st} value={st} className="capitalize">{st}</SelectItem>)}
                            </SelectContent>
                          </Select>

                          {/* AI Action button / report */}
                          {c.ai_status === "success" ? (
                            <AIReportDialog candidate={c} />
                          ) : c.ai_status === "running" ? (
                            <Button disabled size="sm" variant="secondary" className="w-full text-[10px] mt-1 h-7 flex items-center justify-center gap-1">
                              <Loader2 className="h-3 w-3 animate-spin" /> Screening...
                            </Button>
                          ) : (
                            <Button 
                              onClick={() => screenMutation.mutate(c.id)} 
                              disabled={screenMutation.isPending && screenMutation.variables === c.id}
                              size="sm" 
                              variant="outline" 
                              className="w-full text-[10px] mt-1 h-7 flex items-center justify-center gap-1 border-dashed hover:bg-accent"
                            >
                              <BrainCircuit className="h-3.5 w-3.5 text-muted-foreground" />
                              {c.ai_status === "failed" ? "Retry AI Screen" : "AI Screen Resume"}
                            </Button>
                          )}

                          {isHR && (
                            <ScheduleInterviewDialog
                              candidateId={c.id}
                              employees={profiles.data ?? []}
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
                                try {
                                  await recruitmentService.updateInterviewStatus(i.id, v);
                                  toast.success("Updated");
                                  qc.invalidateQueries({ queryKey: ["interviews"] });
                                } catch (err: any) {
                                  toast.error(err.response?.data?.message || err.message);
                                }
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
                      try {
                        await recruitmentService.updateTaskStatus(t.id, status);
                        qc.invalidateQueries({ queryKey: ["onboarding"] });
                      } catch (err: any) {
                        toast.error(err.response?.data?.message || err.message);
                      }
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

function NewJobDialog({ onCreated }: { onCreated: () => void }) {
  const [open, setOpen] = useState(false);
  const [f, setF] = useState({ title: "", location: "", employment_type: "full_time", description: "", requirements: "", salary_min: "", salary_max: "" });
  const create = useMutation({
    mutationFn: async () => {
      await recruitmentService.createJob({
        title: f.title, location: f.location || null,
        employment_type: f.employment_type as Job["employment_type"],
        description: f.description || null, requirements: f.requirements || null,
        salary_min: f.salary_min ? Number(f.salary_min) : null,
        salary_max: f.salary_max ? Number(f.salary_max) : null,
        status: "open",
      });
    },
    onSuccess: () => { toast.success("Job posted"); setOpen(false); onCreated(); },
    onError: (e: any) => toast.error(e.response?.data?.message || e.message),
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

function AddCandidateDialog({ jobId, onCreated }: { jobId: string | number; onCreated: () => void }) {
  const [open, setOpen] = useState(false);
  const [f, setF] = useState({ full_name: "", email: "", phone: "", source: "", notes: "" });
  const [file, setFile] = useState<File | null>(null);
  const [loading, setLoading] = useState(false);

  const create = useMutation({
    mutationFn: async () => {
      setLoading(true);
      const newCand = await recruitmentService.addCandidate({
        job_id: jobId, 
        full_name: f.full_name, 
        email: f.email,
        phone: f.phone || null, 
        source: f.source || null, 
        notes: f.notes || null,
      });

      if (file) {
        try {
          await recruitmentService.uploadResume(newCand.id, file);
          await recruitmentService.triggerScreening(newCand.id);
        } catch (uploadErr) {
          console.error("Resume upload/screen failed:", uploadErr);
          toast.error("Candidate added, but resume upload/screening failed");
        }
      }
    },
    onSuccess: () => { 
      toast.success("Candidate added successfully"); 
      setOpen(false); 
      setF({ full_name: "", email: "", phone: "", source: "", notes: "" }); 
      setFile(null);
      setLoading(false);
      onCreated(); 
    },
    onError: (e: any) => {
      toast.error(e.response?.data?.message || e.message);
      setLoading(false);
    },
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
          <div>
            <Label>Resume (PDF or TXT)</Label>
            <Input 
              type="file" 
              accept=".pdf,.txt" 
              onChange={(e) => {
                const files = e.target.files;
                if (files && files.length > 0) {
                  setFile(files[0]);
                }
              }} 
            />
          </div>
        </div>
        <DialogFooter>
          <Button onClick={() => create.mutate()} disabled={!f.full_name || !f.email || create.isPending || loading}>
            {loading ? "Adding..." : "Add"}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

function ScheduleInterviewDialog({ candidateId, employees, onCreated }: {
  candidateId: string | number;
  employees: { id: string | number; full_name: string }[];
  onCreated: () => void;
}) {
  const [open, setOpen] = useState(false);
  const [f, setF] = useState({ scheduled_at: "", duration_minutes: 60, mode: "video", round: "Round 1", interviewer_id: "" });
  const create = useMutation({
    mutationFn: async () => {
      if (!f.scheduled_at) throw new Error("Pick a date/time");
      await recruitmentService.scheduleInterview({
        candidate_id: candidateId,
        scheduled_at: new Date(f.scheduled_at).toISOString(),
        duration_minutes: f.duration_minutes,
        mode: f.mode, round: f.round,
        interviewer_id: f.interviewer_id ? Number(f.interviewer_id) : null,
      });
    },
    onSuccess: () => { toast.success("Interview scheduled"); setOpen(false); onCreated(); },
    onError: (e: any) => toast.error(e.response?.data?.message || e.message),
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
                {employees.map((e) => <SelectItem key={e.id} value={String(e.id)}>{e.full_name}</SelectItem>)}
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
  employees: { id: string | number; full_name: string }[];
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
        ? DEFAULT_ONBOARDING.map((t, i) => ({ employee_id: Number(employeeId), title: t.title, category: t.category, position: i }))
        : [{ employee_id: Number(employeeId), title: customTitle, position: 0 }];
      if (!useDefaults && !customTitle) throw new Error("Enter a task title");
      
      await Promise.all(rows.map(row => recruitmentService.assignOnboarding(row)));
    },
    onSuccess: () => { toast.success("Onboarding created"); setOpen(false); onCreated(); },
    onError: (e: any) => toast.error(e.response?.data?.message || e.message),
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
                {employees.map((e) => <SelectItem key={e.id} value={String(e.id)}>{e.full_name}</SelectItem>)}
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

function AIReportDialog({ candidate }: { candidate: Candidate }) {
  const [open, setOpen] = useState(false);
  
  const report = useMemo(() => {
    if (!candidate.ai_analysis) return null;
    try {
      return typeof candidate.ai_analysis === "string" 
        ? JSON.parse(candidate.ai_analysis) 
        : candidate.ai_analysis;
    } catch (e) {
      console.error("Failed to parse AI analysis:", e);
      return null;
    }
  }, [candidate.ai_analysis]);

  if (!report) return null;

  const recColor = {
    Shortlist: "bg-emerald-500/15 text-emerald-700 dark:text-emerald-400 border-emerald-500/30",
    Interview: "bg-blue-500/15 text-blue-700 dark:text-blue-400 border-blue-500/30",
    Hold: "bg-amber-500/15 text-amber-700 dark:text-amber-400 border-amber-500/30",
    Reject: "bg-destructive/15 text-destructive border-destructive/30",
  }[report.recommendation as string] || "bg-muted text-muted-foreground";

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild>
        <Button size="sm" variant="outline" className="w-full text-[10px] mt-1 h-7 flex items-center justify-center gap-1 border-primary/30 text-primary hover:bg-primary/5">
          <Sparkles className="h-3 w-3" /> View AI Report
        </Button>
      </DialogTrigger>
      <DialogContent className="max-w-xl md:max-w-2xl bg-card border border-border">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2 text-lg font-semibold">
            <Sparkles className="h-5 w-5 text-primary animate-pulse" /> AI Resume Match Report
          </DialogTitle>
          <DialogDescription>
            AI-generated compatibility report for <strong>{candidate.full_name}</strong>
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-4 py-2">
          <div className="grid grid-cols-2 gap-4 border rounded-lg p-4 bg-muted/20">
            <div className="flex flex-col items-center justify-center border-r pr-4">
              <div className="relative flex items-center justify-center">
                <svg className="w-20 h-20 transform -rotate-90">
                  <circle cx="40" cy="40" r="34" className="stroke-muted" strokeWidth="6" fill="transparent" />
                  <circle 
                    cx="40" 
                    cy="40" 
                    r="34" 
                    className="stroke-primary" 
                    strokeWidth="6" 
                    fill="transparent"
                    strokeDasharray={2 * Math.PI * 34}
                    strokeDashoffset={2 * Math.PI * 34 * (1 - report.score / 100)}
                    strokeLinecap="round"
                  />
                </svg>
                <span className="absolute text-xl font-bold">{report.score}%</span>
              </div>
              <span className="text-xs text-muted-foreground mt-2 font-medium">Compatibility Score</span>
            </div>

            <div className="flex flex-col justify-center pl-2">
              <span className="text-xs text-muted-foreground uppercase font-semibold tracking-wider">AI Recommendation</span>
              <div className="mt-1">
                <Badge className={`text-xs px-3 py-1 font-semibold ${recColor}`} variant="outline">
                  {report.recommendation}
                </Badge>
              </div>
              {candidate.resume_url && (
                <a 
                  href={`http://localhost:5000${candidate.resume_url}`} 
                  target="_blank" 
                  rel="noreferrer" 
                  className="text-xs text-primary hover:underline flex items-center gap-1 mt-3 font-medium"
                >
                  <FileDown className="h-3.5 w-3.5" /> View Original Resume
                </a>
              )}
            </div>
          </div>

          <div className="space-y-1">
            <h4 className="text-xs font-semibold text-muted-foreground uppercase tracking-wider">Experience Summary</h4>
            <p className="text-sm bg-muted/10 p-3 rounded-md border text-foreground leading-relaxed">
              {report.experience_summary}
            </p>
          </div>

          <div className="grid md:grid-cols-2 gap-4">
            <div className="space-y-1.5">
              <h4 className="text-xs font-semibold text-muted-foreground uppercase tracking-wider flex items-center gap-1">
                <span className="h-2 w-2 rounded-full bg-emerald-500" /> Matching Skills ({report.matching_skills?.length || 0})
              </h4>
              <div className="flex flex-wrap gap-1.5 border rounded-md p-3 min-h-[80px] bg-emerald-500/[0.02]">
                {report.matching_skills?.map((s: string) => (
                  <Badge key={s} variant="outline" className="bg-emerald-500/10 text-emerald-700 dark:text-emerald-400 border-emerald-500/20 text-xs">
                    {s}
                  </Badge>
                ))}
                {(!report.matching_skills || report.matching_skills.length === 0) && (
                  <span className="text-xs text-muted-foreground">No explicit skills matches found.</span>
                )}
              </div>
            </div>

            <div className="space-y-1.5">
              <h4 className="text-xs font-semibold text-muted-foreground uppercase tracking-wider flex items-center gap-1">
                <span className="h-2 w-2 rounded-full bg-amber-500" /> Missing Stack/Skills ({report.missing_skills?.length || 0})
              </h4>
              <div className="flex flex-wrap gap-1.5 border rounded-md p-3 min-h-[80px] bg-amber-500/[0.02]">
                {report.missing_skills?.map((s: string) => (
                  <Badge key={s} variant="outline" className="bg-amber-500/10 text-amber-700 dark:text-amber-400 border-amber-500/20 text-xs">
                    {s}
                  </Badge>
                ))}
                {(!report.missing_skills || report.missing_skills.length === 0) && (
                  <span className="text-xs text-muted-foreground">Matches all key requirements!</span>
                )}
              </div>
            </div>
          </div>

          <div className="space-y-1.5">
            <h4 className="text-xs font-semibold text-muted-foreground uppercase tracking-wider">AI Reasoning</h4>
            <ul className="text-xs text-muted-foreground list-disc pl-4 space-y-1.5">
              {report.reasoning?.map((r: string, idx: number) => (
                <li key={idx} className="leading-relaxed text-foreground/80">{r}</li>
              ))}
            </ul>
          </div>
        </div>

        <DialogFooter>
          <Button onClick={() => setOpen(false)} variant="secondary" size="sm">
            Close Report
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
