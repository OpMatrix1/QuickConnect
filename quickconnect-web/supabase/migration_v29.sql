-- Migration v29:
-- Replace RAISE EXCEPTION for "insufficient funds" in
-- provider_submit_looking_for_response with a soft JSON return so that a
-- notification can be sent to the customer BEFORE the function exits.
--
-- The function now returns:
--   { "ok": true,  "response_id": "<uuid>" }          – success
--   { "ok": false, "reason": "insufficient_funds",
--     "message": "<human-readable>" }                  – soft block
-- All other hard errors (bad price, not a provider, post not found, etc.)
-- still raise an exception as before.
-- Run after migration_v28.sql

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
  v_post         RECORD;
  v_sp_id        UUID;
  v_sp_name      TEXT;
  v_avail        NUMERIC;
  v_resp_id      UUID;
  v_notif_title  TEXT;
  v_notif_body   TEXT;
  v_post_desc    TEXT;
BEGIN
  -- Basic validation
  IF p_quoted_price IS NULL OR p_quoted_price <= 0 THEN
    RAISE EXCEPTION 'Quoted price must be positive';
  END IF;

  SELECT sp.id, COALESCE(sp.business_name, p.full_name, 'A provider')
  INTO v_sp_id, v_sp_name
  FROM public.service_providers sp
  JOIN public.profiles p ON p.id = sp.profile_id
  WHERE sp.profile_id = auth.uid();

  IF v_sp_id IS NULL THEN
    RAISE EXCEPTION 'Only providers can submit a response';
  END IF;

  SELECT id, customer_id, status, description
  INTO v_post
  FROM public.looking_for_posts
  WHERE id = p_post_id;

  IF NOT FOUND THEN
    RAISE EXCEPTION 'Post not found';
  END IF;

  IF v_post.status <> 'active' THEN
    RAISE EXCEPTION 'This post is not accepting new quotes';
  END IF;

  -- Check customer wallet
  v_avail := public.wallet_available_amount(v_post.customer_id);

  IF v_avail < p_quoted_price THEN
    -- Soft block: notify the customer first, then return an error indicator
    -- (no RAISE EXCEPTION so the notification INSERT is not rolled back)
    v_post_desc := left(COALESCE(v_post.description, 'your post'), 40);
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
        'post_id', v_post.id::text,
        'path',    '/looking-for/' || v_post.id::text
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
