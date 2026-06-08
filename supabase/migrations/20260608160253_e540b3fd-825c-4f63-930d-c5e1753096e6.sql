GRANT EXECUTE ON FUNCTION public.has_role(uuid, app_role) TO authenticated;
GRANT EXECUTE ON FUNCTION public.is_hr_or_admin(uuid) TO authenticated;
GRANT EXECUTE ON FUNCTION public.is_manager_or_above(uuid) TO authenticated;