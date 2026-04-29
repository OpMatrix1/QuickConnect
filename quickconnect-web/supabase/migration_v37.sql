-- Migration v37: Enforce budget-range constraint on looking-for responses.
-- Providers may only quote within the post's budget_min..budget_max range.
-- Validates both in the soft-block path (insufficient funds) and the
-- success path, so no out-of-range quote can slip through.
-- Run after migration_v36.sql

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
  v_post            RECORD;
  v_sp_id           UUID;
  v_sp_profile_id   UUID;
  v_sp_name         TEXT;
  v_avail           NUMERIC;
  v_resp_id         UUID;
  v_notif_title     TEXT;
  v_notif_body      TEXT;
  v_post_desc       TEXT;
BEGIN
  IF p_quoted_price IS NULL OR p_quoted_price <= 0 THEN
    RAISE EXCEPTION 'Quoted price must be positive';
  END IF;

  SELECT sp.id, sp.profile_id, COALESCE(sp.business_name, p.full_name, 'A provider')
  INTO v_sp_id, v_sp_profile_id, v_sp_name
  FROM public.service_providers sp
  JOIN public.profiles p ON p.id = sp.profile_id
  WHERE sp.profile_id = auth.uid();

  IF v_sp_id IS NULL THEN
    RAISE EXCEPTION 'Only providers can submit a response';
  END IF;

  SELECT id, customer_id, status, description, budget_min, budget_max
  INTO v_post
  FROM public.looking_for_posts
  WHERE id = p_post_id;

  IF NOT FOUND THEN
    RAISE EXCEPTION 'Post not found';
  END IF;

  IF v_post.status <> 'active' THEN
    RAISE EXCEPTION 'This post is not accepting new quotes';
  END IF;

  -- Budget-range guard (hard block — no notification needed, provider UI shows error)
  IF v_post.budget_min IS NOT NULL AND p_quoted_price < v_post.budget_min THEN
    RAISE EXCEPTION 'Your price (P%) is below the post''s minimum budget of P%',
      trim(to_char(p_quoted_price,    'FM999,999,990.00')),
      trim(to_char(v_post.budget_min, 'FM999,999,990.00'));
  END IF;

  IF v_post.budget_max IS NOT NULL AND p_quoted_price > v_post.budget_max THEN
    RAISE EXCEPTION 'Your price (P%) exceeds the post''s maximum budget of P%',
      trim(to_char(p_quoted_price,    'FM999,999,990.00')),
      trim(to_char(v_post.budget_max, 'FM999,999,990.00'));
  END IF;

  -- Customer wallet check (soft block — inserts notification, returns ok:false)
  v_avail := public.wallet_available_amount(v_post.customer_id);

  IF v_avail < p_quoted_price THEN
    v_post_desc   := left(COALESCE(v_post.description, 'your post'), 40);
    v_notif_title := 'Top up your wallet to receive quotes';
    v_notif_body  := format(
      '%s tried to quote P%s for "%s" but your wallet balance (P%s) is too low. Top up to let them send you a price.',
      v_sp_name,
      trim(to_char(p_quoted_price, 'FM999,999,990.00')),
      v_post_desc,
      trim(to_char(GREATEST(v_avail, 0), 'FM999,999,990.00'))
    );

    INSERT INTO public.notifications (user_id, type, title, body, data)
    VALUES (
      v_post.customer_id,
      'insufficient_funds',
      v_notif_title,
      v_notif_body,
      jsonb_build_object(
        'post_id',             v_post.id::text,
        'path',                '/looking-for/' || v_post.id::text,
        'provider_profile_id', v_sp_profile_id::text,
        'provider_name',       v_sp_name,
        'quoted_amount',       p_quoted_price
      )
    );

    RETURN json_build_object(
      'ok',      false,
      'reason',  'insufficient_funds',
      'message', 'The poster does not have enough wallet balance to cover your quoted price. They have been notified to top up.'
    );
  END IF;

  -- Insert the response
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

  RETURN json_build_object('ok', true, 'response_id', v_resp_id);
END;
$$;
