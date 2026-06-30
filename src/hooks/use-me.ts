import { useQuery } from "@tanstack/react-query";
import { authService, employeeService } from "@/services/api";
import type { AppRole } from "@/lib/hrms";

export function useMe() {
  const { data: user } = useQuery({
    queryKey: ["auth-user"],
    queryFn: async () => {
      return authService.getCurrentUser();
    },
  });

  const { data: employee } = useQuery({
    queryKey: ["my-employee", user?.id],
    enabled: !!user?.id,
    queryFn: async () => {
      const emps = await employeeService.getAll();
      // user.id in jwt could be a string or number, compare both ways
      return emps?.find((e: any) => String(e.user_id) === String(user.id)) || null;
    },
  });

  // Fetch fresh profile from the server to avoid stale localStorage data
  const { data: profile } = useQuery({
    queryKey: ["me", user?.id],
    enabled: !!user?.id,
    queryFn: async () => {
      try {
        const freshUser = await authService.getMe();
        // Update localStorage so other parts of the app stay in sync
        if (freshUser) {
          const userData = freshUser.user || freshUser;
          localStorage.setItem("user", JSON.stringify(userData));
          return {
            id: userData.id,
            full_name: userData.name,
            email: userData.email,
            role: userData.role,
            phone: userData.phone,
            avatar_url: userData.avatar_url,
          };
        }
      } catch {
        // Fallback to localStorage if API call fails
      }
      const currentUser = authService.getCurrentUser();
      if (!currentUser) return null;
      return {
        id: currentUser.id,
        full_name: currentUser.name,
        email: currentUser.email,
        role: currentUser.role,
        phone: currentUser.phone,
        avatar_url: currentUser.avatar_url,
      };
    },
  });

  const { data: roles = [] as AppRole[] } = useQuery({
    queryKey: ["my-roles", user?.id],
    enabled: !!user?.id,
    queryFn: async () => {
      try {
        const freshUser = await authService.getMe();
        const userData = freshUser?.user || freshUser;
        if (userData?.role) return [userData.role as AppRole];
      } catch {
        // Fallback to localStorage
      }
      const currentUser = authService.getCurrentUser();
      return currentUser?.role ? [currentUser.role as AppRole] : ([] as AppRole[]);
    },
  });

  return { user, profile, roles, employee };
}
