-- migration_v40.sql
-- Notify provider when a customer leaves them a review.

CREATE OR REPLACE FUNCTION public.notify_provider_new_review()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_provider_uid  UUID;
  v_customer_name TEXT;
  v_stars         TEXT;
  v_booking_id    UUID;
BEGIN
  -- Resolve provider's auth user id
  SELECT profile_id INTO v_provider_uid
  FROM public.service_providers
  WHERE id = NEW.provider_id;

  IF v_provider_uid IS NULL THEN
    RETURN NEW;
  END IF;

  -- Customer display name
  SELECT COALESCE(full_name, 'A customer')
  INTO v_customer_name
  FROM public.profiles
  WHERE id = NEW.customer_id;

  -- Star string e.g. "★★★★☆"
  v_stars := repeat('★', NEW.rating) || repeat('☆', 5 - NEW.rating);

  v_booking_id := NEW.booking_id;

  INSERT INTO public.notifications (user_id, type, title, body, data)
  VALUES (
    v_provider_uid,
    'new_review',
    'New review ' || v_stars,
    CASE
      WHEN NEW.comment IS NOT NULL AND NEW.comment <> ''
        THEN format('%s rated you %s/5: "%s"', v_customer_name, NEW.rating, left(NEW.comment, 120))
      ELSE
        format('%s rated you %s/5.', v_customer_name, NEW.rating)
    END,
    jsonb_build_object(
      'booking_id', v_booking_id::text,
      'review_id',  NEW.id::text,
      'rating',     NEW.rating,
      'path',       '/bookings?booking=' || v_booking_id::text
    )
  );

  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_reviews_after_insert_notify_provider ON public.reviews;
CREATE TRIGGER trg_reviews_after_insert_notify_provider
  AFTER INSERT ON public.reviews
  FOR EACH ROW
  EXECUTE FUNCTION public.notify_provider_new_review();
