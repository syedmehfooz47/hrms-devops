-- employees: restrict SELECT
DROP POLICY IF EXISTS emp_select_auth ON public.employees;
CREATE POLICY emp_select_scoped ON public.employees
  FOR SELECT TO authenticated
  USING (id = auth.uid() OR public.is_manager_or_above(auth.uid()));

-- profiles: restrict SELECT
DROP POLICY IF EXISTS profiles_select_auth ON public.profiles;
CREATE POLICY profiles_select_scoped ON public.profiles
  FOR SELECT TO authenticated
  USING (id = auth.uid() OR public.is_manager_or_above(auth.uid()));

-- user_roles: restrict SELECT
DROP POLICY IF EXISTS roles_select_auth ON public.user_roles;
CREATE POLICY roles_select_scoped ON public.user_roles
  FOR SELECT TO authenticated
  USING (user_id = auth.uid() OR public.has_role(auth.uid(), 'admin'::app_role));