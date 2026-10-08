-- Weekly management additions are separate from automatic Dream game settlements.
CREATE TABLE IF NOT EXISTS public.weekly_adjustments (
 id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
 week_start date NOT NULL,
 kind text NOT NULL CHECK (kind IN ('expense','mm','cash')),
 label text NOT NULL CHECK (length(trim(label)) > 0),
 amount numeric(18,2) NOT NULL CHECK (amount > 0),
 share_rate numeric(5,2) NOT NULL DEFAULT 100 CHECK (share_rate >= 0 AND share_rate <= 100),
 received boolean NOT NULL DEFAULT false,
 note text,
 created_at timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS weekly_adjustments_week_start_idx ON public.weekly_adjustments(week_start);
ALTER TABLE public.weekly_adjustments ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "weekly_adjustments_admin_select" ON public.weekly_adjustments;
CREATE POLICY "weekly_adjustments_admin_select" ON public.weekly_adjustments FOR SELECT TO authenticated USING (
 EXISTS (SELECT 1 FROM public.user_profiles p WHERE p.user_id = auth.uid() AND p.role = 'admin' AND p.active = true)
);
DROP POLICY IF EXISTS "weekly_adjustments_admin_insert" ON public.weekly_adjustments;
CREATE POLICY "weekly_adjustments_admin_insert" ON public.weekly_adjustments FOR INSERT TO authenticated WITH CHECK (
 EXISTS (SELECT 1 FROM public.user_profiles p WHERE p.user_id = auth.uid() AND p.role = 'admin' AND p.active = true)
);
DROP POLICY IF EXISTS "weekly_adjustments_admin_update" ON public.weekly_adjustments;
CREATE POLICY "weekly_adjustments_admin_update" ON public.weekly_adjustments FOR UPDATE TO authenticated USING (
 EXISTS (SELECT 1 FROM public.user_profiles p WHERE p.user_id = auth.uid() AND p.role = 'admin' AND p.active = true)
) WITH CHECK (
 EXISTS (SELECT 1 FROM public.user_profiles p WHERE p.user_id = auth.uid() AND p.role = 'admin' AND p.active = true)
);
DROP POLICY IF EXISTS "weekly_adjustments_admin_delete" ON public.weekly_adjustments;
CREATE POLICY "weekly_adjustments_admin_delete" ON public.weekly_adjustments FOR DELETE TO authenticated USING (
 EXISTS (SELECT 1 FROM public.user_profiles p WHERE p.user_id = auth.uid() AND p.role = 'admin' AND p.active = true)
);
