import { createFileRoute, redirect, Outlet, Link, useRouterState, useNavigate } from "@tanstack/react-router";
import { supabase } from "@/integrations/supabase/client";
import { useQuery } from "@tanstack/react-query";
import {
  Sidebar, SidebarContent, SidebarFooter, SidebarGroup, SidebarGroupContent, SidebarGroupLabel,
  SidebarHeader, SidebarMenu, SidebarMenuButton, SidebarMenuItem, SidebarProvider, SidebarTrigger,
} from "@/components/ui/sidebar";
import {
  LayoutDashboard, Users, Building2, CalendarDays, Clock, Wallet, Award, Briefcase,
  FileText, UserCircle, LogOut,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuLabel, DropdownMenuSeparator, DropdownMenuTrigger } from "@/components/ui/dropdown-menu";
import { Avatar, AvatarFallback } from "@/components/ui/avatar";
import { toast } from "sonner";
import { NotificationsBell } from "@/components/notifications-bell";

export const Route = createFileRoute("/_authenticated")({
  ssr: false,
  beforeLoad: async () => {
    const { data, error } = await supabase.auth.getUser();
    if (error || !data.user) throw redirect({ to: "/auth" });
    return { user: data.user };
  },
  component: AuthenticatedLayout,
});

const navItems = [
  { title: "Dashboard", url: "/dashboard", icon: LayoutDashboard, section: "overview" },
  { title: "Employees", url: "/employees", icon: Users, section: "people" },
  { title: "Departments", url: "/departments", icon: Building2, section: "people" },
  { title: "Attendance", url: "/attendance", icon: Clock, section: "time" },
  { title: "Leave", url: "/leave", icon: CalendarDays, section: "time" },
  { title: "Payroll", url: "/payroll", icon: Wallet, section: "finance" },
  { title: "Performance", url: "/performance", icon: Award, section: "growth" },
  { title: "Recruitment", url: "/recruitment", icon: Briefcase, section: "growth" },
  { title: "Documents", url: "/documents", icon: FileText, section: "growth" },
  { title: "My Profile", url: "/profile", icon: UserCircle, section: "account" },
] as const;

const sections: { id: string; label: string }[] = [
  { id: "overview", label: "Overview" },
  { id: "people", label: "People" },
  { id: "time", label: "Time & Attendance" },
  { id: "finance", label: "Finance" },
  { id: "growth", label: "Growth" },
  { id: "account", label: "Account" },
];

function AuthenticatedLayout() {
  const { user } = Route.useRouteContext();
  const navigate = useNavigate();
  const pathname = useRouterState({ select: (s) => s.location.pathname });

  const { data: profile } = useQuery({
    queryKey: ["me", user.id],
    queryFn: async () => {
      const { data } = await supabase.from("profiles").select("*").eq("id", user.id).maybeSingle();
      return data;
    },
  });

  const { data: roles } = useQuery({
    queryKey: ["my-roles", user.id],
    queryFn: async () => {
      const { data } = await supabase.from("user_roles").select("role").eq("user_id", user.id);
      return data?.map((r) => r.role) ?? [];
    },
  });

  const onLogout = async () => {
    await supabase.auth.signOut();
    toast.success("Signed out");
    navigate({ to: "/auth", replace: true });
  };

  const initials = (profile?.full_name || user.email || "?").split(" ").map((p: string) => p[0]).slice(0, 2).join("").toUpperCase();
  const roleLabel = roles?.[0]?.replace("_", " ") ?? "employee";

  return (
    <SidebarProvider>
      <div className="min-h-screen flex w-full bg-background">
        <Sidebar collapsible="icon">
          <SidebarHeader>
            <div className="flex items-center gap-2 px-2 py-1">
              <div className="h-8 w-8 rounded-lg bg-primary text-primary-foreground flex items-center justify-center shrink-0">
                <Building2 className="h-4 w-4" />
              </div>
              <div className="group-data-[collapsible=icon]:hidden">
                <div className="text-sm font-semibold leading-tight">Pulse HRMS</div>
                <div className="text-[10px] text-muted-foreground uppercase tracking-wide">{roleLabel}</div>
              </div>
            </div>
          </SidebarHeader>
          <SidebarContent>
            {sections.map((sec) => {
              const items = navItems.filter((i) => i.section === sec.id);
              if (!items.length) return null;
              return (
                <SidebarGroup key={sec.id}>
                  <SidebarGroupLabel>{sec.label}</SidebarGroupLabel>
                  <SidebarGroupContent>
                    <SidebarMenu>
                      {items.map((item) => (
                        <SidebarMenuItem key={item.url}>
                          <SidebarMenuButton asChild isActive={pathname.startsWith(item.url)} tooltip={item.title}>
                            <Link to={item.url}>
                              <item.icon className="h-4 w-4" />
                              <span>{item.title}</span>
                            </Link>
                          </SidebarMenuButton>
                        </SidebarMenuItem>
                      ))}
                    </SidebarMenu>
                  </SidebarGroupContent>
                </SidebarGroup>
              );
            })}
          </SidebarContent>
          <SidebarFooter>
            <div className="text-[10px] text-muted-foreground px-2 group-data-[collapsible=icon]:hidden">
              v1.0 · {new Date().getFullYear()}
            </div>
          </SidebarFooter>
        </Sidebar>

        <div className="flex-1 flex flex-col min-w-0">
          <header className="sticky top-0 z-10 h-14 flex items-center justify-between gap-3 border-b bg-background/80 backdrop-blur px-4">
            <div className="flex items-center gap-2">
              <SidebarTrigger />
              <div className="text-sm text-muted-foreground capitalize">{pathname.split("/").filter(Boolean).join(" / ") || "Home"}</div>
            </div>
            <div className="flex items-center gap-1">
            <NotificationsBell />
            <DropdownMenu>
              <DropdownMenuTrigger asChild>
                <Button variant="ghost" className="gap-2 h-9 px-2">
                  <Avatar className="h-7 w-7"><AvatarFallback className="text-xs">{initials}</AvatarFallback></Avatar>
                  <div className="text-left hidden sm:block">
                    <div className="text-xs font-medium leading-none">{profile?.full_name || user.email}</div>
                    <div className="text-[10px] text-muted-foreground capitalize mt-0.5">{roleLabel}</div>
                  </div>
                </Button>
              </DropdownMenuTrigger>
              <DropdownMenuContent align="end" className="w-56">
                <DropdownMenuLabel>{user.email}</DropdownMenuLabel>
                <DropdownMenuSeparator />
                <DropdownMenuItem onClick={() => navigate({ to: "/profile" })}>
                  <UserCircle className="h-4 w-4" /> My Profile
                </DropdownMenuItem>
                <DropdownMenuSeparator />
                <DropdownMenuItem onClick={onLogout} className="text-destructive focus:text-destructive">
                  <LogOut className="h-4 w-4" /> Sign out
                </DropdownMenuItem>
              </DropdownMenuContent>
            </DropdownMenu>
            </div>
          </header>

          <main className="flex-1 p-4 sm:p-6 overflow-x-hidden">
            <Outlet />
          </main>
        </div>
      </div>
    </SidebarProvider>
  );
}
