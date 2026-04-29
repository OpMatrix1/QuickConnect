-- Migration v27: Restore the hard customer-funds block in
-- provider_submit_looking_for_response (reverts the removal from v26).
-- Providers cannot submit a quote if the poster has insufficient funds.
-- The customer is shown a top-up prompt on their post page instead.
-- Run after migration_v26.sql

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
  v_avail   NUMERIC;
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

  v_avail := public.wallet_available_amount(v_post.customer_id);

  IF v_avail < p_quoted_price THEN
    RAISE EXCEPTION 'The poster does not have enough wallet balance to cover your quoted price. Ask them to add funds, or try a lower quote.';
  END IF;

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
