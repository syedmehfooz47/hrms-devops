import { createFileRoute, Link } from "@tanstack/react-router";
import { useMe } from "@/hooks/use-me";
import { Card, CardContent } from "@/components/ui/card";
import { Avatar, AvatarFallback } from "@/components/ui/avatar";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { ArrowRight } from "lucide-react";

export const Route = createFileRoute("/_authenticated/profile")({
  component: ProfilePage,
});

function ProfilePage() {
  const { user, profile, roles } = useMe();
  const init = (profile?.full_name || user?.email || "?").split(" ").map((p) => p[0]).slice(0, 2).join("").toUpperCase();

  return (
    <div className="space-y-5 max-w-3xl">
      <div>
        <h1 className="text-2xl font-bold tracking-tight">My Profile</h1>
        <p className="text-sm text-muted-foreground">Your account at a glance.</p>
      </div>

      <Card>
        <CardContent className="p-6 flex items-center gap-4">
          <Avatar className="h-20 w-20"><AvatarFallback className="text-xl">{init}</AvatarFallback></Avatar>
          <div className="flex-1">
            <h2 className="text-xl font-bold">{profile?.full_name || "—"}</h2>
            <p className="text-sm text-muted-foreground">{user?.email}</p>
            <div className="flex gap-2 mt-2 flex-wrap">
              {roles.map((r) => <Badge key={r} variant="secondary" className="capitalize">{r.replace("_", " ")}</Badge>)}
            </div>
          </div>
          {user && (
            <Button asChild variant="outline">
              <Link to="/employees/$id" params={{ id: user.id }}>Edit employment details <ArrowRight className="h-4 w-4" /></Link>
            </Button>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
