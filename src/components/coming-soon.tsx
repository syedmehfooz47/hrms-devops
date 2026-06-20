import { Card, CardContent } from "@/components/ui/card";
import type { LucideIcon } from "lucide-react";

export function ComingSoon({ title, description, icon: Icon }: { title: string; description: string; icon: LucideIcon }) {
  return (
    <div className="space-y-5">
      <div>
        <h1 className="text-2xl font-bold tracking-tight">{title}</h1>
        <p className="text-sm text-muted-foreground">{description}</p>
      </div>
      <Card>
        <CardContent className="py-16 flex flex-col items-center text-center gap-3">
          <div className="h-14 w-14 rounded-2xl bg-primary/10 text-primary flex items-center justify-center">
            <Icon className="h-7 w-7" />
          </div>
          <h2 className="text-lg font-semibold">{title} module — coming next</h2>
          <p className="text-sm text-muted-foreground max-w-md">
            The schema and routing are wired up. Ask me to build out this module next and I'll add the full UI and workflows.
          </p>
        </CardContent>
      </Card>
    </div>
  );
}
