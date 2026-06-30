import { createFileRoute, redirect } from "@tanstack/react-router";
import { authService } from "@/services/api";

export const Route = createFileRoute("/")({
  ssr: false,
  beforeLoad: async () => {
    if (authService.isAuthenticated()) {
      const user = authService.getCurrentUser();
      if (user && (user.role === "admin" || user.role === "hr_manager")) {
        throw redirect({ to: "/dashboard" });
      }
      throw redirect({ to: "/profile" });
    }
    throw redirect({ to: "/auth" });
  },
  component: () => null,
});
