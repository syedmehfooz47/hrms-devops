
CREATE TYPE payroll_status AS ENUM ('draft','processed','paid');

CREATE TABLE public.payroll_runs (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  month int NOT NULL CHECK (month BETWEEN 1 AND 12),
  year int NOT NULL CHECK (year BETWEEN 2000 AND 2100),
  status payroll_status NOT NULL DEFAULT 'draft',
  notes text,
  processed_by uuid,
  processed_at timestamptz,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (month, year)
);

GRANT SELECT, INSERT, UPDATE, DELETE ON public.payroll_runs TO authenticated;
GRANT ALL ON public.payroll_runs TO service_role;

ALTER TABLE public.payroll_runs ENABLE ROW LEVEL SECURITY;

CREATE POLICY "runs_hr_select" ON public.payroll_runs FOR SELECT TO authenticated
  USING (public.is_hr_or_admin(auth.uid()));
CREATE POLICY "runs_hr_insert" ON public.payroll_runs FOR INSERT TO authenticated
  WITH CHECK (public.is_hr_or_admin(auth.uid()));
CREATE POLICY "runs_hr_update" ON public.payroll_runs FOR UPDATE TO authenticated
  USING (public.is_hr_or_admin(auth.uid()));
CREATE POLICY "runs_hr_delete" ON public.payroll_runs FOR DELETE TO authenticated
  USING (public.is_hr_or_admin(auth.uid()));

CREATE TRIGGER trg_runs_touch BEFORE UPDATE ON public.payroll_runs
  FOR EACH ROW EXECUTE FUNCTION public.touch_updated_at();

CREATE TABLE public.payslips (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  run_id uuid NOT NULL REFERENCES public.payroll_runs(id) ON DELETE CASCADE,
  employee_id uuid NOT NULL REFERENCES public.employees(id) ON DELETE CASCADE,
  month int NOT NULL,
  year int NOT NULL,
  basic numeric(12,2) NOT NULL DEFAULT 0,
  hra numeric(12,2) NOT NULL DEFAULT 0,
  allowances numeric(12,2) NOT NULL DEFAULT 0,
  gross numeric(12,2) NOT NULL DEFAULT 0,
  pf numeric(12,2) NOT NULL DEFAULT 0,
  tax numeric(12,2) NOT NULL DEFAULT 0,
  other_deductions numeric(12,2) NOT NULL DEFAULT 0,
  net numeric(12,2) NOT NULL DEFAULT 0,
  working_days int NOT NULL DEFAULT 0,
  paid_days numeric(5,1) NOT NULL DEFAULT 0,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (run_id, employee_id)
);

GRANT SELECT, INSERT, UPDATE, DELETE ON public.payslips TO authenticated;
GRANT ALL ON public.payslips TO service_role;

ALTER TABLE public.payslips ENABLE ROW LEVEL SECURITY;

CREATE POLICY "slip_select" ON public.payslips FOR SELECT TO authenticated
  USING (employee_id = auth.uid() OR public.is_hr_or_admin(auth.uid()));
CREATE POLICY "slip_hr_insert" ON public.payslips FOR INSERT TO authenticated
  WITH CHECK (public.is_hr_or_admin(auth.uid()));
CREATE POLICY "slip_hr_update" ON public.payslips FOR UPDATE TO authenticated
  USING (public.is_hr_or_admin(auth.uid()));
CREATE POLICY "slip_hr_delete" ON public.payslips FOR DELETE TO authenticated
  USING (public.is_hr_or_admin(auth.uid()));

CREATE INDEX idx_payslip_employee ON public.payslips(employee_id, year DESC, month DESC);
CREATE INDEX idx_payslip_run ON public.payslips(run_id);

CREATE TRIGGER trg_slip_touch BEFORE UPDATE ON public.payslips
  FOR EACH ROW EXECUTE FUNCTION public.touch_updated_at();
