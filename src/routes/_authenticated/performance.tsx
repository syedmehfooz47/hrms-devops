import { createFileRoute } from "@tanstack/react-router";
import { ComingSoon } from "@/components/coming-soon";
import { Award } from "lucide-react";

export const Route = createFileRoute("/_authenticated/performance")({
  component: () => <ComingSoon title="Performance" description="Goals, reviews, 1-5 ratings, feedback." icon={Award} />,
});
