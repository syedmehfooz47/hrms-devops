import { createFileRoute, redirect } from "@tanstack/react-router";
import { authService } from "@/services/api";

export const Route = createFileRoute("/")({
  ssr: false,
  beforeLoad: async () => {
    if (authService.isAuthenticated()) {
      throw redirect({ to: "/dashboard" });
    }
    throw redirect({ to: "/auth" });
  },
  component: () => null,
});
