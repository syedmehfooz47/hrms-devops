import { createFileRoute } from "@tanstack/react-router";
import { ComingSoon } from "@/components/coming-soon";
import { FileText } from "lucide-react";

export const Route = createFileRoute("/_authenticated/documents")({
  component: () => <ComingSoon title="Documents" description="ID proofs, certificates, contracts." icon={FileText} />,
});
