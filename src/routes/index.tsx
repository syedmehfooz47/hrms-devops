import { createFileRoute, Link } from "@tanstack/react-router";
import { authService } from "@/services/api";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { ArrowRight, Building2, Users, CalendarDays, ShieldCheck } from "lucide-react";
import { useEffect, useState } from "react";

export const Route = createFileRoute("/")({
  component: LandingPage,
});

function LandingPage() {
  const [isAuthenticated, setIsAuthenticated] = useState(false);
  const [userRole, setUserRole] = useState<string | null>(null);
  
  useEffect(() => {
    setIsAuthenticated(authService.isAuthenticated());
    const user = authService.getCurrentUser();
    if (user) setUserRole(user.role);
  }, []);

  const dashboardLink = userRole === "admin" || userRole === "hr_manager" ? "/dashboard" : "/profile";

  return (
    <div className="min-h-screen bg-background flex flex-col font-sans selection:bg-primary/20">
      <header className="px-6 py-4 flex items-center justify-between border-b bg-background/80 backdrop-blur sticky top-0 z-50">
        <div className="flex items-center gap-2 font-bold text-xl tracking-tight text-foreground">
          <div className="h-8 w-8 rounded-lg bg-primary text-primary-foreground flex items-center justify-center shadow-sm">
            <Building2 className="h-4 w-4" />
          </div>
          Pulse HRMS
        </div>
        <nav className="flex items-center gap-4">
          {isAuthenticated ? (
            <Link to={dashboardLink}>
              <Button variant="default" className="shadow-sm">Go to Workspace <ArrowRight className="ml-2 h-4 w-4" /></Button>
            </Link>
          ) : (
            <>
              <Link to="/auth"><Button variant="ghost" className="hidden sm:inline-flex">Sign In</Button></Link>
              <Link to="/auth"><Button className="shadow-sm">Get Started</Button></Link>
            </>
          )}
        </nav>
      </header>

      <main className="flex-1 flex flex-col items-center px-4 text-center pb-24 pt-20 sm:pt-32 bg-gradient-to-b from-background to-muted/20">
        <div className="max-w-3xl space-y-8 animate-in fade-in slide-in-from-bottom-4 duration-1000">
          <Badge variant="outline" className="bg-primary/5 text-primary border-primary/20 px-4 py-1.5 mb-2 text-sm font-medium rounded-full shadow-sm">
            ✨ Next Generation HR Management
          </Badge>
          <h1 className="text-5xl sm:text-6xl md:text-7xl font-extrabold tracking-tight text-foreground leading-[1.1]">
            Manage your <span className="text-transparent bg-clip-text bg-gradient-to-r from-primary to-blue-500">workforce</span> with ease.
          </h1>
          <p className="text-lg sm:text-xl text-muted-foreground max-w-2xl mx-auto leading-relaxed">
            Pulse HRMS brings your employees, attendance, leave, and departments into one unified, intelligent platform. 
            Designed for modern teams who want less paperwork and more productivity.
          </p>
          
          <div className="flex flex-col sm:flex-row items-center justify-center gap-4 pt-6">
            {isAuthenticated ? (
              <Link to={dashboardLink} className="w-full sm:w-auto">
                <Button size="lg" className="h-14 px-8 text-base w-full shadow-lg shadow-primary/25 hover:shadow-primary/40 transition-all rounded-full">
                  Enter Workspace <ArrowRight className="ml-2 h-5 w-5" />
                </Button>
              </Link>
            ) : (
              <Link to="/auth" className="w-full sm:w-auto">
                <Button size="lg" className="h-14 px-8 text-base w-full shadow-lg shadow-primary/25 hover:shadow-primary/40 transition-all rounded-full">
                  Sign In to Pulse <ArrowRight className="ml-2 h-5 w-5" />
                </Button>
              </Link>
            )}
          </div>
        </div>

        <div className="grid sm:grid-cols-2 md:grid-cols-3 gap-6 max-w-6xl w-full mt-32 text-left">
          <FeatureCard 
            icon={<Users className="h-6 w-6 text-blue-500" />}
            title="Employee Directory"
            desc="Keep all employee records, personal details, and employment histories in one secure, easily searchable place."
          />
          <FeatureCard 
            icon={<CalendarDays className="h-6 w-6 text-emerald-500" />}
            title="Leave & Attendance"
            desc="Track daily check-ins, approve time off requests, and monitor team availability in real-time."
          />
          <FeatureCard 
            icon={<ShieldCheck className="h-6 w-6 text-amber-500" />}
            title="Role-Based Security"
            desc="Strict access controls ensure that employees only see what they need, while admins see the big picture."
          />
        </div>
      </main>

      <footer className="border-t py-10 text-center text-sm text-muted-foreground bg-background">
        <div className="flex items-center justify-center gap-2 mb-4">
          <div className="h-6 w-6 rounded-md bg-primary/10 text-primary flex items-center justify-center">
            <Building2 className="h-3 w-3" />
          </div>
          <span className="font-semibold text-foreground">Pulse HRMS</span>
        </div>
        <p>© {new Date().getFullYear()} Pulse HRMS. All rights reserved.</p>
      </footer>
    </div>
  );
}

function FeatureCard({ icon, title, desc }: { icon: React.ReactNode, title: string, desc: string }) {
  return (
    <div className="p-6 rounded-2xl border bg-card hover:shadow-lg transition-all duration-300 group">
      <div className="h-14 w-14 rounded-xl bg-muted group-hover:bg-primary/5 flex items-center justify-center mb-5 transition-colors border">
        {icon}
      </div>
      <h3 className="text-xl font-bold mb-2.5 text-foreground">{title}</h3>
      <p className="text-muted-foreground leading-relaxed text-sm">{desc}</p>
    </div>
  );
}
