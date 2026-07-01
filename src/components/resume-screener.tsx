import { useState, useRef } from "react";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent } from "@/components/ui/card";
import { Progress } from "@/components/ui/progress";
import { Separator } from "@/components/ui/separator";
import { BrainCircuit, Upload, FileText, CheckCircle2, XCircle, Loader2, ArrowLeft, Sparkles } from "lucide-react";
import { aiService } from "@/services/api";
import { toast } from "sonner";

interface ScreeningResult {
  score: number;
  matching_skills: string[];
  missing_skills: string[];
  experience_summary: string;
  recommendation: string;
  reasoning: string[];
}

type ViewState = "form" | "loading" | "results";

export function ResumeScreenerDialog() {
  const [open, setOpen] = useState(false);
  const [view, setView] = useState<ViewState>("form");
  const [jobTitle, setJobTitle] = useState("");
  const [jobDescription, setJobDescription] = useState("");
  const [file, setFile] = useState<File | null>(null);
  const [result, setResult] = useState<ScreeningResult | null>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);

  const reset = () => {
    setView("form");
    setJobTitle("");
    setJobDescription("");
    setFile(null);
    setResult(null);
  };

  const handleOpenChange = (isOpen: boolean) => {
    setOpen(isOpen);
    if (!isOpen) reset();
  };

  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const selected = e.target.files?.[0];
    if (selected) {
      const ext = selected.name.split(".").pop()?.toLowerCase();
      if (!["pdf", "txt", "doc", "docx"].includes(ext || "")) {
        toast.error("Only PDF, TXT, DOC, DOCX files are accepted.");
        return;
      }
      if (selected.size > 10 * 1024 * 1024) {
        toast.error("File must be under 10MB.");
        return;
      }
      setFile(selected);
    }
  };

  const handleSubmit = async () => {
    if (!jobTitle.trim()) { toast.error("Please enter a job title."); return; }
    if (!jobDescription.trim()) { toast.error("Please enter a job description."); return; }
    if (!file) { toast.error("Please upload a resume file."); return; }

    setView("loading");

    try {
      const formData = new FormData();
      formData.append("job_title", jobTitle.trim());
      formData.append("job_description", jobDescription.trim());
      formData.append("resume", file);

      const res = await aiService.screenResume(formData);
      if (res.success) {
        setResult(res.analysis);
        setView("results");
      } else {
        throw new Error(res.message || "Screening failed.");
      }
    } catch (err: any) {
      toast.error(err?.response?.data?.message || err.message || "An error occurred during screening.");
      setView("form");
    }
  };

  const getScoreColor = (score: number) => {
    if (score >= 80) return "text-emerald-500";
    if (score >= 60) return "text-amber-500";
    return "text-red-500";
  };

  const getRecBadge = (rec: string) => {
    switch (rec) {
      case "Shortlist": return "default";
      case "Interview": return "secondary";
      case "Hold": return "outline";
      case "Reject": return "destructive";
      default: return "outline";
    }
  };

  return (
    <Dialog open={open} onOpenChange={handleOpenChange}>
      <DialogTrigger asChild>
        <Button className="gap-2 shadow-sm">
          <BrainCircuit className="h-4 w-4" /> AI Resume Screener
        </Button>
      </DialogTrigger>
      <DialogContent className="sm:max-w-2xl max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2 text-lg">
            <BrainCircuit className="h-5 w-5 text-primary" />
            AI Resume Screener
          </DialogTitle>
        </DialogHeader>

        {/* ──── FORM VIEW ──── */}
        {view === "form" && (
          <div className="space-y-5 pt-2">
            <div className="space-y-2">
              <Label htmlFor="job-title">Job Title</Label>
              <Input
                id="job-title"
                placeholder="e.g. Senior Frontend Developer"
                value={jobTitle}
                onChange={(e) => setJobTitle(e.target.value)}
              />
            </div>

            <div className="space-y-2">
              <Label htmlFor="job-desc">Job Description & Requirements</Label>
              <Textarea
                id="job-desc"
                placeholder="Paste the full job description here including required skills, experience, and qualifications..."
                rows={6}
                value={jobDescription}
                onChange={(e) => setJobDescription(e.target.value)}
              />
            </div>

            <div className="space-y-2">
              <Label>Upload Resume</Label>
              <div
                className="flex flex-col items-center justify-center gap-2 rounded-xl border-2 border-dashed p-8 cursor-pointer hover:border-primary/50 hover:bg-muted/50 transition-colors"
                onClick={() => fileInputRef.current?.click()}
              >
                {file ? (
                  <>
                    <FileText className="h-8 w-8 text-primary" />
                    <p className="text-sm font-medium">{file.name}</p>
                    <p className="text-xs text-muted-foreground">{(file.size / 1024).toFixed(1)} KB</p>
                  </>
                ) : (
                  <>
                    <Upload className="h-8 w-8 text-muted-foreground" />
                    <p className="text-sm text-muted-foreground">Click to upload a resume (PDF, TXT, DOC)</p>
                    <p className="text-xs text-muted-foreground">Max 10MB</p>
                  </>
                )}
              </div>
              <input
                ref={fileInputRef}
                type="file"
                accept=".pdf,.txt,.doc,.docx"
                className="hidden"
                onChange={handleFileChange}
              />
            </div>

            <Button className="w-full h-12 text-base gap-2" onClick={handleSubmit}>
              <Sparkles className="h-4 w-4" /> Analyze Resume with AI
            </Button>
          </div>
        )}

        {/* ──── LOADING VIEW ──── */}
        {view === "loading" && (
          <div className="flex flex-col items-center justify-center py-16 space-y-6">
            <div className="relative">
              <div className="h-20 w-20 rounded-full bg-primary/10 flex items-center justify-center">
                <BrainCircuit className="h-10 w-10 text-primary animate-pulse" />
              </div>
              <Loader2 className="h-6 w-6 text-primary animate-spin absolute -top-1 -right-1" />
            </div>
            <div className="text-center space-y-2">
              <h3 className="font-semibold text-lg">Analyzing Resume...</h3>
              <p className="text-sm text-muted-foreground max-w-sm">
                The AI is reading the resume, comparing it against the job requirements, and scoring the candidate. This may take 15–30 seconds.
              </p>
            </div>
          </div>
        )}

        {/* ──── RESULTS VIEW ──── */}
        {view === "results" && result && (
          <div className="space-y-5 pt-2">
            {/* Score + Recommendation */}
            <div className="flex items-center gap-6">
              <div className="text-center">
                <div className={`text-5xl font-extrabold ${getScoreColor(result.score)}`}>
                  {result.score}
                </div>
                <div className="text-xs text-muted-foreground mt-1">Match Score</div>
              </div>
              <div className="flex-1 space-y-2">
                <Progress value={result.score} className="h-3" />
                <div className="flex items-center justify-between">
                  <span className="text-sm text-muted-foreground">Job Fit</span>
                  <Badge variant={getRecBadge(result.recommendation)} className="text-sm px-3 py-1">
                    {result.recommendation}
                  </Badge>
                </div>
              </div>
            </div>

            <Separator />

            {/* Skills */}
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              <Card>
                <CardContent className="p-4 space-y-3">
                  <div className="flex items-center gap-2 text-sm font-semibold text-emerald-600">
                    <CheckCircle2 className="h-4 w-4" /> Matching Skills
                  </div>
                  <div className="flex flex-wrap gap-1.5">
                    {result.matching_skills.length > 0 ? result.matching_skills.map((s, i) => (
                      <Badge key={i} variant="outline" className="bg-emerald-500/10 text-emerald-700 border-emerald-200 text-xs">
                        {s}
                      </Badge>
                    )) : (
                      <span className="text-xs text-muted-foreground">None identified</span>
                    )}
                  </div>
                </CardContent>
              </Card>

              <Card>
                <CardContent className="p-4 space-y-3">
                  <div className="flex items-center gap-2 text-sm font-semibold text-red-600">
                    <XCircle className="h-4 w-4" /> Missing Skills
                  </div>
                  <div className="flex flex-wrap gap-1.5">
                    {result.missing_skills.length > 0 ? result.missing_skills.map((s, i) => (
                      <Badge key={i} variant="outline" className="bg-red-500/10 text-red-700 border-red-200 text-xs">
                        {s}
                      </Badge>
                    )) : (
                      <span className="text-xs text-muted-foreground">None identified</span>
                    )}
                  </div>
                </CardContent>
              </Card>
            </div>

            {/* Experience Summary */}
            <div className="space-y-2">
              <h4 className="text-sm font-semibold">Experience Summary</h4>
              <p className="text-sm text-muted-foreground leading-relaxed">{result.experience_summary}</p>
            </div>

            {/* Reasoning */}
            <div className="space-y-2">
              <h4 className="text-sm font-semibold">AI Reasoning</h4>
              <ul className="space-y-1.5">
                {result.reasoning.map((r, i) => (
                  <li key={i} className="text-sm text-muted-foreground flex gap-2">
                    <span className="text-primary mt-0.5">•</span>
                    <span>{r}</span>
                  </li>
                ))}
              </ul>
            </div>

            <div className="flex gap-3 pt-2">
              <Button variant="outline" className="gap-2 flex-1" onClick={reset}>
                <ArrowLeft className="h-4 w-4" /> Screen Another
              </Button>
              <Button variant="default" className="flex-1" onClick={() => handleOpenChange(false)}>
                Done
              </Button>
            </div>
          </div>
        )}
      </DialogContent>
    </Dialog>
  );
}
