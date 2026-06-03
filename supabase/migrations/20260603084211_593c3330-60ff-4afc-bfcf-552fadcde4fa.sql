
CREATE TYPE public.job_status AS ENUM ('open','closed','draft');
CREATE TYPE public.candidate_stage AS ENUM ('applied','screening','interview','offer','hired','rejected');
CREATE TYPE public.interview_status AS ENUM ('scheduled','completed','cancelled','no_show');
CREATE TYPE public.onboarding_status AS ENUM ('pending','in_progress','done');

CREATE TABLE public.job_postings (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  title text NOT NULL,
  department_id uuid,
  location text,
  employment_type public.employment_type NOT NULL DEFAULT 'full_time',
  description text,
  requirements text,
  salary_min numeric,
  salary_max numeric,
  status public.job_status NOT NULL DEFAULT 'open',
  posted_by uuid,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.job_postings TO authenticated;
GRANT ALL ON public.job_postings TO service_role;
ALTER TABLE public.job_postings ENABLE ROW LEVEL SECURITY;
CREATE POLICY "job_select" ON public.job_postings FOR SELECT TO authenticated USING (true);
CREATE POLICY "job_write" ON public.job_postings FOR INSERT TO authenticated WITH CHECK (public.is_hr_or_admin(auth.uid()));
CREATE POLICY "job_update" ON public.job_postings FOR UPDATE TO authenticated USING (public.is_hr_or_admin(auth.uid()));
CREATE POLICY "job_delete" ON public.job_postings FOR DELETE TO authenticated USING (public.is_hr_or_admin(auth.uid()));
CREATE TRIGGER trg_jobs_updated BEFORE UPDATE ON public.job_postings FOR EACH ROW EXECUTE FUNCTION public.touch_updated_at();

CREATE TABLE public.candidates (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  job_id uuid NOT NULL REFERENCES public.job_postings(id) ON DELETE CASCADE,
  full_name text NOT NULL,
  email text NOT NULL,
  phone text,
  resume_url text,
  cover_letter text,
  source text,
  stage public.candidate_stage NOT NULL DEFAULT 'applied',
  notes text,
  applied_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.candidates TO authenticated;
GRANT ALL ON public.candidates TO service_role;
ALTER TABLE public.candidates ENABLE ROW LEVEL SECURITY;
CREATE POLICY "cand_select" ON public.candidates FOR SELECT TO authenticated USING (public.is_manager_or_above(auth.uid()));
CREATE POLICY "cand_insert" ON public.candidates FOR INSERT TO authenticated WITH CHECK (public.is_hr_or_admin(auth.uid()));
CREATE POLICY "cand_update" ON public.candidates FOR UPDATE TO authenticated USING (public.is_manager_or_above(auth.uid()));
CREATE POLICY "cand_delete" ON public.candidates FOR DELETE TO authenticated USING (public.is_hr_or_admin(auth.uid()));
CREATE TRIGGER trg_cand_updated BEFORE UPDATE ON public.candidates FOR EACH ROW EXECUTE FUNCTION public.touch_updated_at();

CREATE TABLE public.interviews (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  candidate_id uuid NOT NULL REFERENCES public.candidates(id) ON DELETE CASCADE,
  interviewer_id uuid,
  scheduled_at timestamptz NOT NULL,
  duration_minutes int NOT NULL DEFAULT 60,
  mode text,
  location text,
  round text,
  status public.interview_status NOT NULL DEFAULT 'scheduled',
  feedback text,
  rating numeric(2,1),
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.interviews TO authenticated;
GRANT ALL ON public.interviews TO service_role;
ALTER TABLE public.interviews ENABLE ROW LEVEL SECURITY;
CREATE POLICY "intv_select" ON public.interviews FOR SELECT TO authenticated
  USING (public.is_manager_or_above(auth.uid()) OR interviewer_id = auth.uid());
CREATE POLICY "intv_write" ON public.interviews FOR INSERT TO authenticated WITH CHECK (public.is_hr_or_admin(auth.uid()));
CREATE POLICY "intv_update" ON public.interviews FOR UPDATE TO authenticated
  USING (public.is_hr_or_admin(auth.uid()) OR interviewer_id = auth.uid());
CREATE POLICY "intv_delete" ON public.interviews FOR DELETE TO authenticated USING (public.is_hr_or_admin(auth.uid()));
CREATE TRIGGER trg_intv_updated BEFORE UPDATE ON public.interviews FOR EACH ROW EXECUTE FUNCTION public.touch_updated_at();

CREATE TABLE public.onboarding_tasks (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  employee_id uuid NOT NULL,
  title text NOT NULL,
  description text,
  category text,
  due_date date,
  status public.onboarding_status NOT NULL DEFAULT 'pending',
  position int NOT NULL DEFAULT 0,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.onboarding_tasks TO authenticated;
GRANT ALL ON public.onboarding_tasks TO service_role;
ALTER TABLE public.onboarding_tasks ENABLE ROW LEVEL SECURITY;
CREATE POLICY "ob_select" ON public.onboarding_tasks FOR SELECT TO authenticated
  USING (employee_id = auth.uid() OR public.is_manager_or_above(auth.uid()));
CREATE POLICY "ob_insert" ON public.onboarding_tasks FOR INSERT TO authenticated
  WITH CHECK (public.is_hr_or_admin(auth.uid()));
CREATE POLICY "ob_update" ON public.onboarding_tasks FOR UPDATE TO authenticated
  USING (employee_id = auth.uid() OR public.is_hr_or_admin(auth.uid()));
CREATE POLICY "ob_delete" ON public.onboarding_tasks FOR DELETE TO authenticated
  USING (public.is_hr_or_admin(auth.uid()));
CREATE TRIGGER trg_ob_updated BEFORE UPDATE ON public.onboarding_tasks FOR EACH ROW EXECUTE FUNCTION public.touch_updated_at();

CREATE INDEX idx_candidates_job ON public.candidates(job_id);
CREATE INDEX idx_interviews_candidate ON public.interviews(candidate_id);
CREATE INDEX idx_onboarding_employee ON public.onboarding_tasks(employee_id);
