import { createFileRoute } from "@tanstack/react-router";
import { ComingSoon } from "@/components/coming-soon";
import { Wallet } from "lucide-react";

export const Route = createFileRoute("/_authenticated/payroll")({
  component: () => <ComingSoon title="Payroll" description="Salary structures, payslips, PF & tax." icon={Wallet} />,
});
