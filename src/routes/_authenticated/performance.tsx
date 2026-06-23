import { createFileRoute } from "@tanstack/react-router";
import { useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { performanceService, employeeService } from "@/services/api";
import { useMe } from "@/hooks/use-me";
import { isManagerOrAbove } from "@/lib/hrms";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Label } from "@/components/ui/label";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Badge } from "@/components/ui/badge";
import { Progress } from "@/components/ui/progress";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger, DialogFooter } from "@/components/ui/dialog";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Award, Plus, Star, Target, TrendingUp } from "lucide-react";
import { toast } from "sonner";
import { BarChart, Bar, XAxis, YAxis, Tooltip, ResponsiveContainer, LineChart, Line, CartesianGrid } from "recharts";

export const Route = createFileRoute("/_authenticated/performance")({
  component: PerformancePage,
});

type Goal = {
  id: string | number; employee_id: string | number; title: string; description: string | null;
  category: string | null; target_date: string | null; progress: number;
  status: "not_started" | "in_progress" | "completed" | "cancelled"; created_at: string;
};
type Review = {
  id: string | number; employee_id: string | number; reviewer_id: string | number; period_label: string;
  period_start: string | null; period_end: string | null; rating: number;
  strengths: string | null; improvements: string | null; feedback: string | null;
  status: "draft" | "submitted" | "acknowledged"; created_at: string;
};

const goalStatusColor: Record<Goal["status"], string> = {
  not_started: "bg-muted text-muted-foreground",
  in_progress: "bg-blue-500/15 text-blue-700 dark:text-blue-400 border-blue-500/30",
  completed: "bg-emerald-500/15 text-emerald-700 dark:text-emerald-400 border-emerald-500/30",
  cancelled: "bg-destructive/15 text-destructive border-destructive/30",
};

function Stars({ value }: { value: number }) {
  return (
    <div className="flex items-center gap-0.5">
      {[1, 2, 3, 4, 5].map((n) => (
        <Star key={n} className={`h-4 w-4 ${n <= Math.round(value) ? "fill-amber-400 text-amber-400" : "text-muted-foreground/40"}`} />
      ))}
      <span className="ml-2 text-sm font-medium">{Number(value).toFixed(1)}</span>
    </div>
  );
}

function PerformancePage() {
  const { user, roles, employee } = useMe();
  const isManager = isManagerOrAbove(roles);
  const qc = useQueryClient();

  const myGoals = useQuery({
    queryKey: ["perf-goals", employee?.id],
    enabled: !!employee?.id,
    queryFn: async () => {
      const data = await performanceService.getMyGoals(employee!.id);
      return data as Goal[];
    },
  });

  const myReviews = useQuery({
    queryKey: ["perf-reviews", employee?.id],
    enabled: !!employee?.id,
    queryFn: async () => {
      const data = await performanceService.getMyReviews(employee!.id);
      return data as Review[];
    },
  });

  const teamReviews = useQuery({
    queryKey: ["perf-team-reviews"],
    enabled: !!user?.id && isManager,
    queryFn: async () => {
      const data = await performanceService.getTeamReviews();
      return data as Review[];
    },
  });

  const employees = useQuery({
    queryKey: ["perf-employees"],
    enabled: !!user?.id && isManager,
    queryFn: async () => {
      const emps = await employeeService.getAll();
      return (emps ?? []).map((e: any) => ({
        id: e.id,
        full_name: e.name,
        email: e.email,
      }));
    },
  });

  const avgRating = (myReviews.data ?? []).reduce((s, r) => s + Number(r.rating), 0) / Math.max(1, (myReviews.data ?? []).length);
  const goalsCompleted = (myGoals.data ?? []).filter((g) => g.status === "completed").length;
  const goalsActive = (myGoals.data ?? []).filter((g) => g.status === "in_progress" || g.status === "not_started").length;
  const avgProgress = Math.round((myGoals.data ?? []).reduce((s, g) => s + g.progress, 0) / Math.max(1, (myGoals.data ?? []).length));

  const ratingTrend = [...(myReviews.data ?? [])]
    .sort((a, b) => +new Date(a.created_at) - +new Date(b.created_at))
    .map((r) => ({ period: r.period_label, rating: Number(r.rating) }));

  const goalsByStatus = ["not_started", "in_progress", "completed", "cancelled"].map((s) => ({
    name: s.replace("_", " "),
    count: (myGoals.data ?? []).filter((g) => g.status === s).length,
  }));

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-semibold flex items-center gap-2"><Award className="h-6 w-6" /> Performance</h1>
          <p className="text-sm text-muted-foreground">Goals, reviews, and growth tracking.</p>
        </div>
      </div>

      <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
        <Card><CardHeader className="pb-2"><CardDescription>Avg rating</CardDescription><CardTitle className="text-2xl">{(myReviews.data?.length ? avgRating : 0).toFixed(1)}</CardTitle></CardHeader><CardContent><Stars value={myReviews.data?.length ? avgRating : 0} /></CardContent></Card>
        <Card><CardHeader className="pb-2"><CardDescription>Active goals</CardDescription><CardTitle className="text-2xl">{goalsActive}</CardTitle></CardHeader><CardContent><Target className="h-5 w-5 text-muted-foreground" /></CardContent></Card>
        <Card><CardHeader className="pb-2"><CardDescription>Completed goals</CardDescription><CardTitle className="text-2xl">{goalsCompleted}</CardTitle></CardHeader><CardContent><Award className="h-5 w-5 text-muted-foreground" /></CardContent></Card>
        <Card><CardHeader className="pb-2"><CardDescription>Avg progress</CardDescription><CardTitle className="text-2xl">{isNaN(avgProgress) ? 0 : avgProgress}%</CardTitle></CardHeader><CardContent><Progress value={isNaN(avgProgress) ? 0 : avgProgress} /></CardContent></Card>
      </div>

      <Tabs defaultValue="goals">
        <TabsList>
          <TabsTrigger value="goals">My Goals</TabsTrigger>
          <TabsTrigger value="reviews">My Reviews</TabsTrigger>
          <TabsTrigger value="analytics">Analytics</TabsTrigger>
          {isManager && <TabsTrigger value="team">Team</TabsTrigger>}
        </TabsList>

        <TabsContent value="goals" className="space-y-4">
          <div className="flex justify-end">
            <NewGoalDialog onCreated={() => qc.invalidateQueries({ queryKey: ["perf-goals"] })} employeeId={employee?.id} userId={user?.id} />
          </div>
          <div className="grid gap-3">
            {(myGoals.data ?? []).map((g) => (
              <GoalCard key={g.id} goal={g} onChange={() => qc.invalidateQueries({ queryKey: ["perf-goals"] })} />
            ))}
            {myGoals.data?.length === 0 && <p className="text-sm text-muted-foreground">No goals yet. Create your first goal.</p>}
          </div>
        </TabsContent>

        <TabsContent value="reviews" className="space-y-3">
          {(myReviews.data ?? []).map((r) => <ReviewCard key={r.id} review={r} />)}
          {myReviews.data?.length === 0 && <p className="text-sm text-muted-foreground">No reviews yet.</p>}
        </TabsContent>

        <TabsContent value="analytics" className="grid md:grid-cols-2 gap-4">
          <Card>
            <CardHeader><CardTitle>Rating trend</CardTitle></CardHeader>
            <CardContent style={{ height: 260 }}>
              <ResponsiveContainer>
                <LineChart data={ratingTrend}>
                  <CartesianGrid strokeDasharray="3 3" className="stroke-muted" />
                  <XAxis dataKey="period" /><YAxis domain={[0, 5]} /><Tooltip />
                  <Line type="monotone" dataKey="rating" stroke="hsl(var(--primary))" strokeWidth={2} />
                </LineChart>
              </ResponsiveContainer>
            </CardContent>
          </Card>
          <Card>
            <CardHeader><CardTitle>Goals by status</CardTitle></CardHeader>
            <CardContent style={{ height: 260 }}>
              <ResponsiveContainer>
                <BarChart data={goalsByStatus}>
                  <CartesianGrid strokeDasharray="3 3" className="stroke-muted" />
                  <XAxis dataKey="name" /><YAxis allowDecimals={false} /><Tooltip />
                  <Bar dataKey="count" fill="hsl(var(--primary))" radius={[4, 4, 0, 0]} />
                </BarChart>
              </ResponsiveContainer>
            </CardContent>
          </Card>
        </TabsContent>

        {isManager && (
          <TabsContent value="team" className="space-y-4">
            <div className="flex justify-end">
              <NewReviewDialog
                reviewerId={user?.id}
                employees={employees.data ?? []}
                onCreated={() => qc.invalidateQueries({ queryKey: ["perf-team-reviews"] })}
              />
            </div>
            <Card>
              <CardHeader><CardTitle className="flex items-center gap-2"><TrendingUp className="h-5 w-5" /> Recent reviews</CardTitle></CardHeader>
              <CardContent>
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead>Employee</TableHead>
                      <TableHead>Period</TableHead>
                      <TableHead>Rating</TableHead>
                      <TableHead>Status</TableHead>
                      <TableHead>Date</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {(teamReviews.data ?? []).map((r) => {
                      const emp = (employees.data ?? []).find((e: any) => e.id === r.employee_id);
                      return (
                        <TableRow key={r.id}>
                          <TableCell>{emp?.full_name ?? String(r.employee_id).slice(0, 8)}</TableCell>
                          <TableCell>{r.period_label}</TableCell>
                          <TableCell><Stars value={Number(r.rating)} /></TableCell>
                          <TableCell><Badge variant="outline">{r.status}</Badge></TableCell>
                          <TableCell>{new Date(r.created_at).toLocaleDateString()}</TableCell>
                        </TableRow>
                      );
                    })}
                    {teamReviews.data?.length === 0 && (
                      <TableRow><TableCell colSpan={5} className="text-center text-muted-foreground">No reviews yet.</TableCell></TableRow>
                    )}
                  </TableBody>
                </Table>
              </CardContent>
            </Card>
          </TabsContent>
        )}
      </Tabs>
    </div>
  );
}

function GoalCard({ goal, onChange }: { goal: Goal; onChange: () => void }) {
  const [progress, setProgress] = useState(goal.progress);
  const [status, setStatus] = useState<Goal["status"]>(goal.status);
  const save = useMutation({
    mutationFn: async () => {
      await performanceService.updateGoal(goal.id, { progress, status });
    },
    onSuccess: () => { toast.success("Goal updated"); onChange(); },
    onError: (e: any) => toast.error(e.response?.data?.message || e.message),
  });
  return (
    <Card>
      <CardHeader className="pb-2">
        <div className="flex justify-between items-start gap-2">
          <div>
            <CardTitle className="text-base">{goal.title}</CardTitle>
            {goal.description && <CardDescription className="mt-1">{goal.description}</CardDescription>}
          </div>
          <Badge variant="outline" className={goalStatusColor[goal.status]}>{goal.status.replace("_", " ")}</Badge>
        </div>
      </CardHeader>
      <CardContent className="space-y-3">
        <div className="flex flex-wrap gap-3 text-xs text-muted-foreground">
          {goal.category && <span>Category: {goal.category}</span>}
          {goal.target_date && <span>Target: {new Date(goal.target_date).toLocaleDateString()}</span>}
        </div>
        <div className="space-y-1">
          <div className="flex justify-between text-xs"><span>Progress</span><span>{progress}%</span></div>
          <Progress value={progress} />
          <Input type="range" min={0} max={100} value={progress} onChange={(e) => setProgress(Number(e.target.value))} />
        </div>
        <div className="flex gap-2 items-center">
          <Select value={status} onValueChange={(v) => setStatus(v as Goal["status"])}>
            <SelectTrigger className="w-44"><SelectValue /></SelectTrigger>
            <SelectContent>
              <SelectItem value="not_started">Not started</SelectItem>
              <SelectItem value="in_progress">In progress</SelectItem>
              <SelectItem value="completed">Completed</SelectItem>
              <SelectItem value="cancelled">Cancelled</SelectItem>
            </SelectContent>
          </Select>
          <Button size="sm" onClick={() => save.mutate()} disabled={save.isPending}>Save</Button>
        </div>
      </CardContent>
    </Card>
  );
}

function ReviewCard({ review }: { review: Review }) {
  return (
    <Card>
      <CardHeader>
        <div className="flex justify-between items-center">
          <div>
            <CardTitle className="text-base">{review.period_label}</CardTitle>
            <CardDescription>{new Date(review.created_at).toLocaleDateString()}</CardDescription>
          </div>
          <Stars value={Number(review.rating)} />
        </div>
      </CardHeader>
      <CardContent className="space-y-2 text-sm">
        {review.strengths && <div><span className="font-medium">Strengths: </span>{review.strengths}</div>}
        {review.improvements && <div><span className="font-medium">Improvements: </span>{review.improvements}</div>}
        {review.feedback && <div><span className="font-medium">Feedback: </span>{review.feedback}</div>}
      </CardContent>
    </Card>
  );
}

function NewGoalDialog({ onCreated, employeeId, userId }: { onCreated: () => void; employeeId?: string | number; userId?: string | number }) {
  const [open, setOpen] = useState(false);
  const [form, setForm] = useState({ title: "", description: "", category: "", target_date: "" });
  const create = useMutation({
    mutationFn: async () => {
      if (!employeeId || !userId) throw new Error("Not signed in");
      await performanceService.createGoal({
        employee_id: employeeId,
        title: form.title,
        description: form.description || null,
        category: form.category || null,
        target_date: form.target_date || null,
        created_by: userId,
      });
    },
    onSuccess: () => {
      toast.success("Goal created"); setOpen(false);
      setForm({ title: "", description: "", category: "", target_date: "" });
      onCreated();
    },
    onError: (e: any) => toast.error(e.response?.data?.message || e.message),
  });
  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild><Button size="sm"><Plus className="h-4 w-4 mr-1" /> New goal</Button></DialogTrigger>
      <DialogContent>
        <DialogHeader><DialogTitle>Create goal</DialogTitle></DialogHeader>
        <div className="space-y-3">
          <div><Label>Title</Label><Input value={form.title} onChange={(e) => setForm({ ...form, title: e.target.value })} /></div>
          <div><Label>Description</Label><Textarea value={form.description} onChange={(e) => setForm({ ...form, description: e.target.value })} /></div>
          <div className="grid grid-cols-2 gap-3">
            <div><Label>Category</Label><Input value={form.category} onChange={(e) => setForm({ ...form, category: e.target.value })} /></div>
            <div><Label>Target date</Label><Input type="date" value={form.target_date} onChange={(e) => setForm({ ...form, target_date: e.target.value })} /></div>
          </div>
        </div>
        <DialogFooter>
          <Button onClick={() => create.mutate()} disabled={!form.title || create.isPending}>Create</Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

function NewReviewDialog({ reviewerId, employees, onCreated }: {
  reviewerId?: string | number;
  employees: { id: string | number; full_name: string }[];
  onCreated: () => void;
}) {
  const [open, setOpen] = useState(false);
  const [form, setForm] = useState({
    employee_id: "", period_label: `Q${Math.floor(new Date().getMonth() / 3) + 1} ${new Date().getFullYear()}`,
    rating: 3, strengths: "", improvements: "", feedback: "",
  });
  const create = useMutation({
    mutationFn: async () => {
      if (!reviewerId) throw new Error("Not signed in");
      if (!form.employee_id) throw new Error("Select an employee");
      await performanceService.createReview({
        employee_id: Number(form.employee_id),
        reviewer_id: Number(reviewerId),
        period_label: form.period_label,
        rating: form.rating,
        strengths: form.strengths || null,
        improvements: form.improvements || null,
        feedback: form.feedback || null,
        status: "submitted",
      });
    },
    onSuccess: () => { toast.success("Review submitted"); setOpen(false); onCreated(); },
    onError: (e: any) => toast.error(e.response?.data?.message || e.message),
  });
  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild><Button size="sm"><Plus className="h-4 w-4 mr-1" /> New review</Button></DialogTrigger>
      <DialogContent>
        <DialogHeader><DialogTitle>Submit review</DialogTitle></DialogHeader>
        <div className="space-y-3">
          <div>
            <Label>Employee</Label>
            <Select value={form.employee_id} onValueChange={(v) => setForm({ ...form, employee_id: v })}>
              <SelectTrigger><SelectValue placeholder="Select employee" /></SelectTrigger>
              <SelectContent>
                {employees.map((e) => <SelectItem key={e.id} value={String(e.id)}>{e.full_name}</SelectItem>)}
              </SelectContent>
            </Select>
          </div>
          <div className="grid grid-cols-2 gap-3">
            <div><Label>Period</Label><Input value={form.period_label} onChange={(e) => setForm({ ...form, period_label: e.target.value })} /></div>
            <div>
              <Label>Rating (1-5)</Label>
              <Input type="number" min={1} max={5} step={0.5} value={form.rating}
                onChange={(e) => setForm({ ...form, rating: Number(e.target.value) })} />
            </div>
          </div>
          <div><Label>Strengths</Label><Textarea value={form.strengths} onChange={(e) => setForm({ ...form, strengths: e.target.value })} /></div>
          <div><Label>Areas to improve</Label><Textarea value={form.improvements} onChange={(e) => setForm({ ...form, improvements: e.target.value })} /></div>
          <div><Label>Feedback</Label><Textarea value={form.feedback} onChange={(e) => setForm({ ...form, feedback: e.target.value })} /></div>
        </div>
        <DialogFooter>
          <Button onClick={() => create.mutate()} disabled={create.isPending}>Submit</Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
