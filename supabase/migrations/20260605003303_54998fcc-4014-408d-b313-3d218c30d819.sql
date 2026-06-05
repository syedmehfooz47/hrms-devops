
CREATE TABLE public.employee_documents (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  employee_id uuid NOT NULL,
  uploaded_by uuid,
  name text NOT NULL,
  category text NOT NULL DEFAULT 'other',
  storage_path text NOT NULL,
  mime_type text,
  size_bytes bigint,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

GRANT SELECT, INSERT, UPDATE, DELETE ON public.employee_documents TO authenticated;
GRANT ALL ON public.employee_documents TO service_role;

ALTER TABLE public.employee_documents ENABLE ROW LEVEL SECURITY;

CREATE POLICY doc_select ON public.employee_documents FOR SELECT TO authenticated
  USING (employee_id = auth.uid() OR public.is_hr_or_admin(auth.uid()));

CREATE POLICY doc_insert ON public.employee_documents FOR INSERT TO authenticated
  WITH CHECK (employee_id = auth.uid() OR public.is_hr_or_admin(auth.uid()));

CREATE POLICY doc_update ON public.employee_documents FOR UPDATE TO authenticated
  USING (public.is_hr_or_admin(auth.uid()));

CREATE POLICY doc_delete ON public.employee_documents FOR DELETE TO authenticated
  USING (employee_id = auth.uid() OR public.is_hr_or_admin(auth.uid()));

CREATE TRIGGER trg_emp_docs_updated BEFORE UPDATE ON public.employee_documents
  FOR EACH ROW EXECUTE FUNCTION public.touch_updated_at();

-- Storage bucket policies (bucket created via tool)
CREATE POLICY "emp_docs_select" ON storage.objects FOR SELECT TO authenticated
  USING (
    bucket_id = 'employee-documents'
    AND (
      (storage.foldername(name))[1] = auth.uid()::text
      OR public.is_hr_or_admin(auth.uid())
    )
  );

CREATE POLICY "emp_docs_insert" ON storage.objects FOR INSERT TO authenticated
  WITH CHECK (
    bucket_id = 'employee-documents'
    AND (
      (storage.foldername(name))[1] = auth.uid()::text
      OR public.is_hr_or_admin(auth.uid())
    )
  );

CREATE POLICY "emp_docs_update" ON storage.objects FOR UPDATE TO authenticated
  USING (
    bucket_id = 'employee-documents' AND public.is_hr_or_admin(auth.uid())
  );

CREATE POLICY "emp_docs_delete" ON storage.objects FOR DELETE TO authenticated
  USING (
    bucket_id = 'employee-documents'
    AND (
      (storage.foldername(name))[1] = auth.uid()::text
      OR public.is_hr_or_admin(auth.uid())
    )
  );
