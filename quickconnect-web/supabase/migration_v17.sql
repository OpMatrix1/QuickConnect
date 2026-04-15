-- Looking For moderation enhancements:
-- 1) customer/admin delete policies for posts
-- 2) post report table for moderation workflow

-- ---------------------------------------------------------------------------
-- 1. looking_for_posts: admin visibility + delete policies
-- ---------------------------------------------------------------------------
DROP POLICY IF EXISTS "looking_for_posts_select_admin" ON public.looking_for_posts;
CREATE POLICY "looking_for_posts_select_admin" ON public.looking_for_posts
  FOR SELECT USING (
    EXISTS (SELECT 1 FROM public.profiles WHERE id = auth.uid() AND role = 'admin')
  );

DROP POLICY IF EXISTS "looking_for_posts_delete_customer" ON public.looking_for_posts;
CREATE POLICY "looking_for_posts_delete_customer" ON public.looking_for_posts
  FOR DELETE USING (auth.uid() = customer_id);

DROP POLICY IF EXISTS "looking_for_posts_delete_admin" ON public.looking_for_posts;
CREATE POLICY "looking_for_posts_delete_admin" ON public.looking_for_posts
  FOR DELETE USING (
    EXISTS (SELECT 1 FROM public.profiles WHERE id = auth.uid() AND role = 'admin')
  );

-- ---------------------------------------------------------------------------
-- 2. looking_for_post_reports: report + evaluate post content
-- ---------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS public.looking_for_post_reports (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  reporter_id UUID NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
  post_id UUID NOT NULL REFERENCES public.looking_for_posts(id) ON DELETE CASCADE,
  reason TEXT NOT NULL CHECK (reason IN ('spam', 'harassment', 'fraud', 'inappropriate_content', 'other')),
  description TEXT,
  status TEXT NOT NULL DEFAULT 'pending' CHECK (status IN ('pending', 'reviewed', 'resolved', 'dismissed')),
  admin_notes TEXT,
  reviewed_by UUID REFERENCES public.profiles(id) ON DELETE SET NULL,
  reviewed_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  CONSTRAINT looking_for_post_reports_unique UNIQUE (reporter_id, post_id)
);

CREATE INDEX IF NOT EXISTS idx_looking_for_post_reports_post_id
  ON public.looking_for_post_reports(post_id);
CREATE INDEX IF NOT EXISTS idx_looking_for_post_reports_status
  ON public.looking_for_post_reports(status);
CREATE INDEX IF NOT EXISTS idx_looking_for_post_reports_created_at
  ON public.looking_for_post_reports(created_at DESC);

DROP TRIGGER IF EXISTS set_updated_at_looking_for_post_reports ON public.looking_for_post_reports;
CREATE TRIGGER set_updated_at_looking_for_post_reports
  BEFORE UPDATE ON public.looking_for_post_reports
  FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();

ALTER TABLE public.looking_for_post_reports ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "looking_for_post_reports_insert_reporter" ON public.looking_for_post_reports;
CREATE POLICY "looking_for_post_reports_insert_reporter" ON public.looking_for_post_reports
  FOR INSERT WITH CHECK (
    reporter_id = auth.uid()
    AND EXISTS (
      SELECT 1
      FROM public.looking_for_posts p
      WHERE p.id = post_id
      AND p.customer_id <> auth.uid()
    )
  );

DROP POLICY IF EXISTS "looking_for_post_reports_select_reporter" ON public.looking_for_post_reports;
CREATE POLICY "looking_for_post_reports_select_reporter" ON public.looking_for_post_reports
  FOR SELECT USING (reporter_id = auth.uid());

DROP POLICY IF EXISTS "looking_for_post_reports_select_admin" ON public.looking_for_post_reports;
CREATE POLICY "looking_for_post_reports_select_admin" ON public.looking_for_post_reports
  FOR SELECT USING (
    EXISTS (SELECT 1 FROM public.profiles WHERE id = auth.uid() AND role = 'admin')
  );

DROP POLICY IF EXISTS "looking_for_post_reports_update_admin" ON public.looking_for_post_reports;
CREATE POLICY "looking_for_post_reports_update_admin" ON public.looking_for_post_reports
  FOR UPDATE USING (
    EXISTS (SELECT 1 FROM public.profiles WHERE id = auth.uid() AND role = 'admin')
  );
