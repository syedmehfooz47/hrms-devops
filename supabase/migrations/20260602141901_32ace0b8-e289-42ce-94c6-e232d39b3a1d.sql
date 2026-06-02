
-- ===== leave_balances =====
CREATE TABLE public.leave_balances (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  employee_id uuid NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
  year int NOT NULL DEFAULT EXTRACT(year FROM now())::int,
  leave_type leave_type NOT NULL,
  allocated numeric(5,1) NOT NULL DEFAULT 0,
  used numeric(5,1) NOT NULL DEFAULT 0,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (employee_id, year, leave_type)
);

GRANT SELECT, INSERT, UPDATE, DELETE ON public.leave_balances TO authenticated;
GRANT ALL ON public.leave_balances TO service_role;

ALTER TABLE public.leave_balances ENABLE ROW LEVEL SECURITY;

CREATE POLICY "bal_select" ON public.leave_balances FOR SELECT TO authenticated
  USING (employee_id = auth.uid() OR public.is_manager_or_above(auth.uid()));
CREATE POLICY "bal_hr_insert" ON public.leave_balances FOR INSERT TO authenticated
  WITH CHECK (public.is_hr_or_admin(auth.uid()));
CREATE POLICY "bal_hr_update" ON public.leave_balances FOR UPDATE TO authenticated
  USING (public.is_hr_or_admin(auth.uid()));
CREATE POLICY "bal_hr_delete" ON public.leave_balances FOR DELETE TO authenticated
  USING (public.is_hr_or_admin(auth.uid()));

CREATE TRIGGER trg_bal_touch BEFORE UPDATE ON public.leave_balances
  FOR EACH ROW EXECUTE FUNCTION public.touch_updated_at();

-- ===== notifications =====
CREATE TABLE public.notifications (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL,
  title text NOT NULL,
  body text,
  link text,
  kind text NOT NULL DEFAULT 'info',
  read boolean NOT NULL DEFAULT false,
  created_at timestamptz NOT NULL DEFAULT now()
);

GRANT SELECT, INSERT, UPDATE, DELETE ON public.notifications TO authenticated;
GRANT ALL ON public.notifications TO service_role;

ALTER TABLE public.notifications ENABLE ROW LEVEL SECURITY;

CREATE POLICY "notif_select_own" ON public.notifications FOR SELECT TO authenticated
  USING (user_id = auth.uid());
CREATE POLICY "notif_update_own" ON public.notifications FOR UPDATE TO authenticated
  USING (user_id = auth.uid());
CREATE POLICY "notif_delete_own" ON public.notifications FOR DELETE TO authenticated
  USING (user_id = auth.uid());
-- INSERT only via SECURITY DEFINER triggers (no policy needed for triggers)
CREATE POLICY "notif_insert_self" ON public.notifications FOR INSERT TO authenticated
  WITH CHECK (user_id = auth.uid());

CREATE INDEX idx_notif_user_read ON public.notifications(user_id, read, created_at DESC);

ALTER PUBLICATION supabase_realtime ADD TABLE public.notifications;
ALTER TABLE public.notifications REPLICA IDENTITY FULL;

-- ===== Auto-allocate default balances on new profile =====
CREATE OR REPLACE FUNCTION public.allocate_default_leave_balances()
RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE y int := EXTRACT(year FROM now())::int;
BEGIN
  INSERT INTO public.leave_balances (employee_id, year, leave_type, allocated) VALUES
    (NEW.id, y, 'casual', 10),
    (NEW.id, y, 'sick',   8),
    (NEW.id, y, 'earned', 15)
  ON CONFLICT (employee_id, year, leave_type) DO NOTHING;
  RETURN NEW;
END $$;

CREATE TRIGGER trg_profile_default_balances
AFTER INSERT ON public.profiles
FOR EACH ROW EXECUTE FUNCTION public.allocate_default_leave_balances();

-- Backfill balances for existing profiles
INSERT INTO public.leave_balances (employee_id, year, leave_type, allocated)
SELECT p.id, EXTRACT(year FROM now())::int, lt, alloc
FROM public.profiles p
CROSS JOIN (VALUES ('casual'::leave_type, 10),('sick'::leave_type, 8),('earned'::leave_type, 15)) AS v(lt, alloc)
ON CONFLICT (employee_id, year, leave_type) DO NOTHING;

-- ===== Leave decision: adjust balance + notify =====
CREATE OR REPLACE FUNCTION public.handle_leave_change()
RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE
  days numeric := (NEW.end_date - NEW.start_date) + 1;
  yr int := EXTRACT(year FROM NEW.start_date)::int;
  mgr record;
  emp_name text;
BEGIN
  IF TG_OP = 'INSERT' THEN
    SELECT full_name INTO emp_name FROM public.profiles WHERE id = NEW.employee_id;
    -- Notify all managers/HR/admins
    FOR mgr IN
      SELECT DISTINCT user_id FROM public.user_roles
      WHERE role IN ('admin','hr_manager','dept_manager') AND user_id <> NEW.employee_id
    LOOP
      INSERT INTO public.notifications (user_id, title, body, link, kind)
      VALUES (mgr.user_id, 'New leave request',
              COALESCE(emp_name,'Someone') || ' requested ' || days || ' day(s) of ' || NEW.leave_type || ' leave.',
              '/leave', 'info');
    END LOOP;
    RETURN NEW;
  END IF;

  IF TG_OP = 'UPDATE' AND OLD.status IS DISTINCT FROM NEW.status THEN
    -- Balance deduction
    IF NEW.status = 'approved' AND OLD.status <> 'approved' THEN
      IF NEW.leave_type IN ('casual','sick','earned') THEN
        UPDATE public.leave_balances
          SET used = used + days
          WHERE employee_id = NEW.employee_id AND year = yr AND leave_type = NEW.leave_type;
      END IF;
    ELSIF OLD.status = 'approved' AND NEW.status <> 'approved' THEN
      IF NEW.leave_type IN ('casual','sick','earned') THEN
        UPDATE public.leave_balances
          SET used = GREATEST(0, used - days)
          WHERE employee_id = NEW.employee_id AND year = yr AND leave_type = NEW.leave_type;
      END IF;
    END IF;

    -- Notify employee
    INSERT INTO public.notifications (user_id, title, body, link, kind)
    VALUES (NEW.employee_id,
            'Leave ' || NEW.status,
            'Your ' || NEW.leave_type || ' leave request was ' || NEW.status || '.',
            '/leave',
            CASE NEW.status::text WHEN 'approved' THEN 'success' WHEN 'rejected' THEN 'error' ELSE 'info' END);
  END IF;

  RETURN NEW;
END $$;

CREATE TRIGGER trg_leave_change
AFTER INSERT OR UPDATE ON public.leave_requests
FOR EACH ROW EXECUTE FUNCTION public.handle_leave_change();
