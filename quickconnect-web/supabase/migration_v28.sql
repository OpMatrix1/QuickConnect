-- Migration v28:
-- 1. Add UPDATE RLS policy on looking_for_responses so the post owner
--    can reject (change status to 'rejected') a pending response.
-- 2. Add a secure RPC customer_reject_looking_for_response that the UI
--    can call instead of a direct UPDATE (belt-and-suspenders).
-- Run after migration_v27.sql

-- ---------------------------------------------------------------------------
-- 1. RLS: post owner can update responses on their own posts
-- ---------------------------------------------------------------------------
DROP POLICY IF EXISTS "looking_for_responses_update_post_owner" ON public.looking_for_responses;
CREATE POLICY "looking_for_responses_update_post_owner"
  ON public.looking_for_responses
  FOR UPDATE
  USING (
    EXISTS (
      SELECT 1 FROM public.looking_for_posts
      WHERE id = post_id AND customer_id = auth.uid()
    )
  );

-- ---------------------------------------------------------------------------
-- 2. RPC: reject a response (customer / post owner only)
-- ---------------------------------------------------------------------------
CREATE OR REPLACE FUNCTION public.customer_reject_looking_for_response(
  p_response_id UUID
)
RETURNS JSON
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_resp RECORD;
BEGIN
  SELECT lfr.id, lfr.status, lfp.customer_id
  INTO v_resp
  FROM public.looking_for_responses lfr
  JOIN public.looking_for_posts lfp ON lfp.id = lfr.post_id
  WHERE lfr.id = p_response_id;

  IF NOT FOUND THEN
    RAISE EXCEPTION 'Response not found';
  END IF;

  IF v_resp.customer_id <> auth.uid() THEN
    RAISE EXCEPTION 'Only the post owner can reject a response';
  END IF;

  IF v_resp.status NOT IN ('pending') THEN
    RAISE EXCEPTION 'Only pending responses can be rejected';
  END IF;

  UPDATE public.looking_for_responses
  SET status = 'rejected', updated_at = NOW()
  WHERE id = p_response_id;

  RETURN json_build_object('ok', true);
END;
$$;
