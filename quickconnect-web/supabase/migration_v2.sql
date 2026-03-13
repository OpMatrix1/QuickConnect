-- =============================================================================
-- QuickConnect Migration v2
-- Run this in the Supabase SQL Editor
-- Adds: category_requests table, escrow payment fields, RLS policies
-- =============================================================================

-- 1. Create category_requests table
CREATE TABLE IF NOT EXISTS public.category_requests (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  requested_by UUID NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
  name TEXT NOT NULL,
  icon TEXT,
  description TEXT,
  status TEXT DEFAULT 'pending' CHECK (status IN ('pending', 'approved', 'declined')),
  admin_feedback TEXT,
  reviewed_by UUID REFERENCES public.profiles(id) ON DELETE SET NULL,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- 2. Add escrow columns to payments (safe — only adds if missing)
DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_schema = 'public' AND table_name = 'payments' AND column_name = 'customer_confirmed') THEN
    ALTER TABLE public.payments ADD COLUMN customer_confirmed BOOLEAN DEFAULT FALSE;
  END IF;
  IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_schema = 'public' AND table_name = 'payments' AND column_name = 'provider_confirmed') THEN
    ALTER TABLE public.payments ADD COLUMN provider_confirmed BOOLEAN DEFAULT FALSE;
  END IF;
  IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_schema = 'public' AND table_name = 'payments' AND column_name = 'updated_at') THEN
    ALTER TABLE public.payments ADD COLUMN updated_at TIMESTAMPTZ DEFAULT NOW();
  END IF;
END $$;

-- 3. Drop old constraint first, migrate data, then re-add with escrow statuses
ALTER TABLE public.payments DROP CONSTRAINT IF EXISTS payments_status_check;
UPDATE public.payments SET status = 'released' WHERE status = 'completed';
UPDATE public.payments SET customer_confirmed = TRUE, provider_confirmed = TRUE WHERE status = 'released';
ALTER TABLE public.payments ADD CONSTRAINT payments_status_check
  CHECK (status IN ('pending', 'held', 'released', 'refunded', 'failed', 'disputed'));

-- 4. Indexes for category_requests
CREATE INDEX IF NOT EXISTS idx_category_requests_requested_by ON public.category_requests(requested_by);
CREATE INDEX IF NOT EXISTS idx_category_requests_status ON public.category_requests(status);

-- 5. Triggers
CREATE TRIGGER set_category_requests_updated_at
  BEFORE UPDATE ON public.category_requests
  FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();

DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_trigger WHERE tgname = 'set_payments_updated_at') THEN
    CREATE TRIGGER set_payments_updated_at
      BEFORE UPDATE ON public.payments
      FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();
  END IF;
END $$;

-- 6. RLS
ALTER TABLE public.category_requests ENABLE ROW LEVEL SECURITY;

-- category_requests policies
CREATE POLICY "category_requests_select" ON public.category_requests
  FOR SELECT USING (
    requested_by = auth.uid()
    OR EXISTS (SELECT 1 FROM public.profiles WHERE id = auth.uid() AND role = 'admin')
  );

CREATE POLICY "category_requests_insert_provider" ON public.category_requests
  FOR INSERT WITH CHECK (
    auth.uid() = requested_by
    AND EXISTS (SELECT 1 FROM public.profiles WHERE id = auth.uid() AND role = 'provider')
  );

CREATE POLICY "category_requests_update_admin" ON public.category_requests
  FOR UPDATE USING (
    EXISTS (SELECT 1 FROM public.profiles WHERE id = auth.uid() AND role = 'admin')
  );

-- service_categories admin policies (add, edit, delete)
DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE policyname = 'service_categories_select_all' AND tablename = 'service_categories') THEN
    CREATE POLICY "service_categories_select_all" ON public.service_categories FOR SELECT USING (true);
  END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE policyname = 'service_categories_insert_admin' AND tablename = 'service_categories') THEN
    CREATE POLICY "service_categories_insert_admin" ON public.service_categories
      FOR INSERT WITH CHECK (EXISTS (SELECT 1 FROM public.profiles WHERE id = auth.uid() AND role = 'admin'));
  END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE policyname = 'service_categories_update_admin' AND tablename = 'service_categories') THEN
    CREATE POLICY "service_categories_update_admin" ON public.service_categories
      FOR UPDATE USING (EXISTS (SELECT 1 FROM public.profiles WHERE id = auth.uid() AND role = 'admin'));
  END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE policyname = 'service_categories_delete_admin' AND tablename = 'service_categories') THEN
    CREATE POLICY "service_categories_delete_admin" ON public.service_categories
      FOR DELETE USING (EXISTS (SELECT 1 FROM public.profiles WHERE id = auth.uid() AND role = 'admin'));
  END IF;
END $$;

-- payments update policy (for confirming satisfaction)
DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE policyname = 'payments_update_booking_parties' AND tablename = 'payments') THEN
    CREATE POLICY "payments_update_booking_parties" ON public.payments
      FOR UPDATE USING (
        EXISTS (
          SELECT 1 FROM public.bookings b
          WHERE b.id = booking_id
          AND (b.customer_id = auth.uid() OR EXISTS (SELECT 1 FROM public.service_providers WHERE id = b.provider_id AND profile_id = auth.uid()))
        )
      );
  END IF;
END $$;

-- =============================================================================
-- Done! All new tables, columns, and policies are now in place.
-- =============================================================================
