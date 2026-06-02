import { createFileRoute } from "@tanstack/react-router";
import { ComingSoon } from "@/components/coming-soon";
import { Briefcase } from "lucide-react";

export const Route = createFileRoute("/_authenticated/recruitment")({
  component: () => <ComingSoon title="Recruitment" description="Job postings, applicants, interviews, onboarding." icon={Briefcase} />,
});
