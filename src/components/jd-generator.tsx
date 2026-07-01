import { useState } from "react";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent } from "@/components/ui/card";
import { Separator } from "@/components/ui/separator";
import { FileEdit, Loader2, Sparkles, ArrowLeft, Copy, CheckCircle2, Briefcase, Star, Gift } from "lucide-react";
import { aiService } from "@/services/api";
import { toast } from "sonner";

interface JDResult {
  title: string;
  summary: string;
  responsibilities: string[];
  requirements: string[];
  preferred: string[];
  benefits: string[];
}

type ViewState = "form" | "loading" | "results";

export function JDGeneratorDialog() {
  const [open, setOpen] = useState(false);
  const [view, setView] = useState<ViewState>("form");
  const [jobTitle, setJobTitle] = useState("");
  const [department, setDepartment] = useState("");
  const [employmentType, setEmploymentType] = useState("");
  const [notes, setNotes] = useState("");
  const [result, setResult] = useState<JDResult | null>(null);
  const [copied, setCopied] = useState(false);

  const reset = () => {
    setView("form");
    setJobTitle("");
    setDepartment("");
    setEmploymentType("");
    setNotes("");
    setResult(null);
    setCopied(false);
  };

  const handleOpenChange = (isOpen: boolean) => {
    setOpen(isOpen);
    if (!isOpen) reset();
  };

  const handleSubmit = async () => {
    if (!jobTitle.trim()) { toast.error("Please enter a job title."); return; }

    setView("loading");

    try {
      const res = await aiService.generateJD({
        job_title: jobTitle.trim(),
        notes: notes.trim() || undefined,
        department: department.trim() || undefined,
        employment_type: employmentType.trim() || undefined,
      });
      if (res.success) {
        setResult(res.jd);
        setView("results");
      } else {
        throw new Error(res.message || "Generation failed.");
      }
    } catch (err: any) {
      toast.error(err?.response?.data?.message || err.message || "An error occurred.");
      setView("form");
    }
  };

  const copyToClipboard = () => {
    if (!result) return;
    const text = `${result.title}\n\n${result.summary}\n\nResponsibilities:\n${result.responsibilities.map(r => `• ${r}`).join("\n")}\n\nRequirements:\n${result.requirements.map(r => `• ${r}`).join("\n")}\n\nPreferred Qualifications:\n${result.preferred.map(r => `• ${r}`).join("\n")}\n\nBenefits:\n${result.benefits.map(r => `• ${r}`).join("\n")}`;
    navigator.clipboard.writeText(text);
    setCopied(true);
    toast.success("Copied to clipboard!");
    setTimeout(() => setCopied(false), 2000);
  };

  return (
    <Dialog open={open} onOpenChange={handleOpenChange}>
      <DialogTrigger asChild>
        <Button variant="outline" className="gap-2 shadow-sm">
          <FileEdit className="h-4 w-4" /> JD Generator
        </Button>
      </DialogTrigger>
      <DialogContent className="sm:max-w-2xl max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2 text-lg">
            <FileEdit className="h-5 w-5 text-primary" />
            AI Job Description Generator
          </DialogTitle>
        </DialogHeader>

        {/* ──── FORM VIEW ──── */}
        {view === "form" && (
          <div className="space-y-5 pt-2">
            <div className="space-y-2">
              <Label htmlFor="jd-title">Job Title *</Label>
              <Input
                id="jd-title"
                placeholder="e.g. Senior Backend Developer"
                value={jobTitle}
                onChange={(e) => setJobTitle(e.target.value)}
              />
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              <div className="space-y-2">
                <Label htmlFor="jd-dept">Department (optional)</Label>
                <Input
                  id="jd-dept"
                  placeholder="e.g. Engineering"
                  value={department}
                  onChange={(e) => setDepartment(e.target.value)}
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="jd-type">Employment Type (optional)</Label>
                <Input
                  id="jd-type"
                  placeholder="e.g. Full-time, Contract"
                  value={employmentType}
                  onChange={(e) => setEmploymentType(e.target.value)}
                />
              </div>
            </div>

            <div className="space-y-2">
              <Label htmlFor="jd-notes">Key Points / Notes (optional)</Label>
              <Textarea
                id="jd-notes"
                placeholder={"Add any bullet points or notes for the AI to include, e.g.:\n• Must know React and Node.js\n• 3+ years experience\n• Remote friendly\n• Team lead responsibilities"}
                rows={5}
                value={notes}
                onChange={(e) => setNotes(e.target.value)}
              />
              <p className="text-xs text-muted-foreground">The more context you provide, the better the output.</p>
            </div>

            <Button className="w-full h-12 text-base gap-2" onClick={handleSubmit}>
              <Sparkles className="h-4 w-4" /> Generate Job Description
            </Button>
          </div>
        )}

        {/* ──── LOADING VIEW ──── */}
        {view === "loading" && (
          <div className="flex flex-col items-center justify-center py-16 space-y-6">
            <div className="relative">
              <div className="h-20 w-20 rounded-full bg-primary/10 flex items-center justify-center">
                <FileEdit className="h-10 w-10 text-primary animate-pulse" />
              </div>
              <Loader2 className="h-6 w-6 text-primary animate-spin absolute -top-1 -right-1" />
            </div>
            <div className="text-center space-y-2">
              <h3 className="font-semibold text-lg">Writing Job Description...</h3>
              <p className="text-sm text-muted-foreground max-w-sm">
                The AI is crafting a professional job description with responsibilities, requirements, and benefits.
              </p>
            </div>
          </div>
        )}

        {/* ──── RESULTS VIEW ──── */}
        {view === "results" && result && (
          <div className="space-y-5 pt-2">
            {/* Title & Summary */}
            <div>
              <h2 className="text-xl font-bold">{result.title}</h2>
              <p className="text-sm text-muted-foreground mt-2 leading-relaxed">{result.summary}</p>
            </div>

            <Separator />

            {/* Responsibilities */}
            <Card>
              <CardContent className="p-4 space-y-3">
                <div className="flex items-center gap-2 text-sm font-semibold">
                  <Briefcase className="h-4 w-4 text-primary" /> Responsibilities
                </div>
                <ul className="space-y-1.5">
                  {result.responsibilities.map((r, i) => (
                    <li key={i} className="text-sm text-muted-foreground flex gap-2">
                      <span className="text-primary mt-0.5 shrink-0">•</span>
                      <span>{r}</span>
                    </li>
                  ))}
                </ul>
              </CardContent>
            </Card>

            {/* Requirements */}
            <Card>
              <CardContent className="p-4 space-y-3">
                <div className="flex items-center gap-2 text-sm font-semibold">
                  <CheckCircle2 className="h-4 w-4 text-emerald-500" /> Requirements
                </div>
                <div className="flex flex-wrap gap-1.5">
                  {result.requirements.map((r, i) => (
                    <Badge key={i} variant="outline" className="bg-emerald-500/10 text-emerald-700 border-emerald-200 text-xs py-1">
                      {r}
                    </Badge>
                  ))}
                </div>
              </CardContent>
            </Card>

            {/* Preferred */}
            <Card>
              <CardContent className="p-4 space-y-3">
                <div className="flex items-center gap-2 text-sm font-semibold">
                  <Star className="h-4 w-4 text-amber-500" /> Preferred Qualifications
                </div>
                <div className="flex flex-wrap gap-1.5">
                  {result.preferred.map((r, i) => (
                    <Badge key={i} variant="outline" className="bg-amber-500/10 text-amber-700 border-amber-200 text-xs py-1">
                      {r}
                    </Badge>
                  ))}
                </div>
              </CardContent>
            </Card>

            {/* Benefits */}
            <Card>
              <CardContent className="p-4 space-y-3">
                <div className="flex items-center gap-2 text-sm font-semibold">
                  <Gift className="h-4 w-4 text-violet-500" /> Benefits & Perks
                </div>
                <ul className="space-y-1.5">
                  {result.benefits.map((r, i) => (
                    <li key={i} className="text-sm text-muted-foreground flex gap-2">
                      <span className="text-violet-500 mt-0.5 shrink-0">✦</span>
                      <span>{r}</span>
                    </li>
                  ))}
                </ul>
              </CardContent>
            </Card>

            <div className="flex gap-3 pt-2">
              <Button variant="outline" className="gap-2 flex-1" onClick={reset}>
                <ArrowLeft className="h-4 w-4" /> Generate Another
              </Button>
              <Button variant="default" className="gap-2 flex-1" onClick={copyToClipboard}>
                {copied ? <CheckCircle2 className="h-4 w-4" /> : <Copy className="h-4 w-4" />}
                {copied ? "Copied!" : "Copy to Clipboard"}
              </Button>
            </div>
          </div>
        )}
      </DialogContent>
    </Dialog>
  );
}
