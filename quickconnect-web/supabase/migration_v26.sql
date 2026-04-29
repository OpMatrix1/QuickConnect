-- Migration v26: Fix provider_submit_looking_for_response — same hard-block
-- problem as migration_v24 fixed for quotes.  Also adds:
--   • Realtime on looking_for_responses so PostDetail updates live.
--   • Notification trigger so the post owner is alerted when a response arrives,
--     with a top-up nudge when their balance is insufficient.
-- Run after migration_v25.sql

-- ---------------------------------------------------------------------------
-- 1. Enable Realtime on looking_for_responses
-- ---------------------------------------------------------------------------
DO $$
BEGIN
  ALTER PUBLICATION supabase_realtime ADD TABLE public.looking_for_responses;
EXCEPTION
  WHEN duplicate_object THEN NULL;
END $$;

-- ---------------------------------------------------------------------------
-- 2. Remove the hard customer-funds block from provider_submit_looking_for_response
-- ---------------------------------------------------------------------------
CREATE OR REPLACE FUNCTION public.provider_submit_looking_for_response(
  p_post_id              UUID,
  p_quoted_price         NUMERIC,
  p_message              TEXT,
  p_estimated_duration   TEXT,
  p_available_date       DATE,
  p_available_time       TIME
)
RETURNS JSON
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_post    RECORD;
  v_sp_id   UUID;
  v_resp_id UUID;
BEGIN
  IF p_quoted_price IS NULL OR p_quoted_price <= 0 THEN
    RAISE EXCEPTION 'Quoted price must be positive';
  END IF;

  SELECT id INTO v_sp_id
  FROM public.service_providers
  WHERE profile_id = auth.uid();

  IF v_sp_id IS NULL THEN
    RAISE EXCEPTION 'Only providers can submit a response';
  END IF;

  SELECT id, customer_id, status INTO v_post
  FROM public.looking_for_posts
  WHERE id = p_post_id;

  IF NOT FOUND THEN
    RAISE EXCEPTION 'Post not found';
  END IF;

  IF v_post.status <> 'active' THEN
    RAISE EXCEPTION 'This post is not accepting new quotes';
  END IF;

  -- NOTE: customer funds are NOT checked here.
  -- The poster is notified via trigger (see below) and prompted to top up
  -- if needed.  The financial gate runs at customer_accept_looking_for_response.

  INSERT INTO public.looking_for_responses (
    post_id, provider_id, quoted_price, message, estimated_duration,
    available_date, available_time, status
  )
  VALUES (
    p_post_id, v_sp_id, p_quoted_price,
    NULLIF(trim(p_message), ''),
    NULLIF(trim(p_estimated_duration), ''),
    p_available_date, p_available_time,
    'pending'
  )
  RETURNING id INTO v_resp_id;

  RETURN json_build_object('response_id', v_resp_id);
END;
$$;

-- ---------------------------------------------------------------------------
-- 3. Trigger: notify post owner whenever a new response is inserted
-- ---------------------------------------------------------------------------
CREATE OR REPLACE FUNCTION public.notify_owner_looking_for_response()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_post_owner  UUID;
  v_post_title  TEXT;
  v_prov_name   TEXT;
  v_avail       NUMERIC;
  v_amount_fmt  TEXT;
  v_title       TEXT;
  v_body        TEXT;
BEGIN
  -- Get post owner and title
  SELECT customer_id, title
  INTO v_post_owner, v_post_title
  FROM public.looking_for_posts
  WHERE id = NEW.post_id;

  IF NOT FOUND THEN
    RETURN NEW;
  END IF;

  -- Get provider name
  SELECT COALESCE(sp.business_name, p.full_name, 'A provider')
  INTO v_prov_name
  FROM public.service_providers sp
  JOIN public.profiles p ON p.id = sp.profile_id
  WHERE sp.id = NEW.provider_id;

  v_amount_fmt := 'P' || trim(to_char(NEW.quoted_price, 'FM999,999,990.00'));
  v_avail := public.wallet_available_amount(v_post_owner);

  v_title := 'New response — ' || v_amount_fmt;

  IF v_avail IS NOT NULL AND v_avail < NEW.quoted_price THEN
    v_body := format(
      '%s quoted %s for "%s". Your available balance is P%s — top up your wallet to accept.',
      v_prov_name,
      v_amount_fmt,
      left(v_post_title, 60),
      trim(to_char(GREATEST(v_avail, 0), 'FM999,999,990.00'))
    );
  ELSE
    v_body := format(
      '%s quoted %s for "%s". Open your post to review and accept.',
      v_prov_name,
      v_amount_fmt,
      left(v_post_title, 60)
    );
  END IF;

  INSERT INTO public.notifications (user_id, type, title, body, data)
  VALUES (
    v_post_owner,
    'post_response',
    v_title,
    v_body,
    jsonb_build_object(
      'post_id',  NEW.post_id::text,
      'path',     '/looking-for/' || NEW.post_id::text
    )
  );

  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_looking_for_responses_notify_owner ON public.looking_for_responses;
CREATE TRIGGER trg_looking_for_responses_notify_owner
  AFTER INSERT ON public.looking_for_responses
  FOR EACH ROW
  EXECUTE FUNCTION public.notify_owner_looking_for_response();
