
-- Enums
CREATE TYPE public.goal_status AS ENUM ('not_started','in_progress','completed','cancelled');
CREATE TYPE public.review_status AS ENUM ('draft','submitted','acknowledged');

-- Goals
CREATE TABLE public.performance_goals (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  employee_id uuid NOT NULL,
  title text NOT NULL,
  description text,
  category text,
  target_date date,
  progress int NOT NULL DEFAULT 0 CHECK (progress >= 0 AND progress <= 100),
  status public.goal_status NOT NULL DEFAULT 'not_started',
  created_by uuid,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

GRANT SELECT, INSERT, UPDATE, DELETE ON public.performance_goals TO authenticated;
GRANT ALL ON public.performance_goals TO service_role;

ALTER TABLE public.performance_goals ENABLE ROW LEVEL SECURITY;

CREATE POLICY "goal_select" ON public.performance_goals FOR SELECT TO authenticated
  USING (employee_id = auth.uid() OR public.is_manager_or_above(auth.uid()));
CREATE POLICY "goal_insert" ON public.performance_goals FOR INSERT TO authenticated
  WITH CHECK (employee_id = auth.uid() OR public.is_manager_or_above(auth.uid()));
CREATE POLICY "goal_update" ON public.performance_goals FOR UPDATE TO authenticated
  USING (employee_id = auth.uid() OR public.is_manager_or_above(auth.uid()));
CREATE POLICY "goal_delete" ON public.performance_goals FOR DELETE TO authenticated
  USING (employee_id = auth.uid() OR public.is_hr_or_admin(auth.uid()));

CREATE TRIGGER trg_perf_goals_updated BEFORE UPDATE ON public.performance_goals
  FOR EACH ROW EXECUTE FUNCTION public.touch_updated_at();

-- Reviews
CREATE TABLE public.performance_reviews (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  employee_id uuid NOT NULL,
  reviewer_id uuid NOT NULL,
  period_label text NOT NULL,
  period_start date,
  period_end date,
  rating numeric(2,1) NOT NULL CHECK (rating >= 1 AND rating <= 5),
  strengths text,
  improvements text,
  feedback text,
  status public.review_status NOT NULL DEFAULT 'submitted',
  acknowledged_at timestamptz,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

GRANT SELECT, INSERT, UPDATE, DELETE ON public.performance_reviews TO authenticated;
GRANT ALL ON public.performance_reviews TO service_role;

ALTER TABLE public.performance_reviews ENABLE ROW LEVEL SECURITY;

CREATE POLICY "review_select" ON public.performance_reviews FOR SELECT TO authenticated
  USING (employee_id = auth.uid() OR reviewer_id = auth.uid() OR public.is_manager_or_above(auth.uid()));
CREATE POLICY "review_insert" ON public.performance_reviews FOR INSERT TO authenticated
  WITH CHECK (public.is_manager_or_above(auth.uid()) AND reviewer_id = auth.uid());
CREATE POLICY "review_update_mgr" ON public.performance_reviews FOR UPDATE TO authenticated
  USING (public.is_manager_or_above(auth.uid()) OR (employee_id = auth.uid()));
CREATE POLICY "review_delete" ON public.performance_reviews FOR DELETE TO authenticated
  USING (public.is_hr_or_admin(auth.uid()));

CREATE TRIGGER trg_perf_reviews_updated BEFORE UPDATE ON public.performance_reviews
  FOR EACH ROW EXECUTE FUNCTION public.touch_updated_at();

CREATE INDEX idx_perf_goals_employee ON public.performance_goals(employee_id);
CREATE INDEX idx_perf_reviews_employee ON public.performance_reviews(employee_id);
