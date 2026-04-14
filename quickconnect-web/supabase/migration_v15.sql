-- Notify admins when a payment row is INSERTed as disputed (e.g. provider disputes non-payment after job completed).
-- Replaces v13 trigger with INSERT + UPDATE handling.

CREATE OR REPLACE FUNCTION public.notify_admins_payment_disputed()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  admin_rec RECORD;
  v_customer_name TEXT;
  v_provider_name TEXT;
  v_amount TEXT;
BEGIN
  IF TG_OP = 'INSERT' THEN
    IF NEW.status IS DISTINCT FROM 'disputed' THEN
      RETURN NEW;
    END IF;
  ELSIF TG_OP = 'UPDATE' THEN
    IF NEW.status IS DISTINCT FROM 'disputed' THEN
      RETURN NEW;
    END IF;
    IF OLD.status IS NOT DISTINCT FROM 'disputed' THEN
      RETURN NEW;
    END IF;
  ELSE
    RETURN NEW;
  END IF;

  SELECT
    COALESCE(cp.full_name, 'Customer'),
    COALESCE(pp.full_name, 'Provider')
  INTO v_customer_name, v_provider_name
  FROM public.bookings b
  JOIN public.profiles cp ON cp.id = b.customer_id
  JOIN public.service_providers sp ON sp.id = b.provider_id
  JOIN public.profiles pp ON pp.id = sp.profile_id
  WHERE b.id = NEW.booking_id;

  v_amount := trim(to_char(NEW.amount, 'FM999,999,999,990.00'));

  FOR admin_rec IN
    SELECT id FROM public.profiles WHERE role = 'admin'
  LOOP
    INSERT INTO public.notifications (user_id, type, title, body, data)
    VALUES (
      admin_rec.id,
      'payment_dispute',
      'Payment dispute needs resolution',
      format(
        'A P%s payment between %s and %s is disputed. Open Admin → Reports to refund or release.',
        v_amount,
        v_customer_name,
        v_provider_name
      ),
      jsonb_build_object(
        'path', '/admin/reports',
        'payment_id', NEW.id::text,
        'booking_id', NEW.booking_id::text
      )
    );
  END LOOP;

  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_payments_after_update_notify_admins_disputed ON public.payments;

CREATE TRIGGER trg_payments_disputed_notify_admins
  AFTER INSERT OR UPDATE OF status ON public.payments
  FOR EACH ROW
  EXECUTE FUNCTION public.notify_admins_payment_disputed();
