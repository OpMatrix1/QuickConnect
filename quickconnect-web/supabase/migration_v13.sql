-- Notify all admin users when a payment becomes disputed (bell + optional push).
-- Run after prior migrations.

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
  IF TG_OP <> 'UPDATE' THEN
    RETURN NEW;
  END IF;
  IF NEW.status IS DISTINCT FROM 'disputed' THEN
    RETURN NEW;
  END IF;
  IF OLD.status = 'disputed' THEN
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

CREATE TRIGGER trg_payments_after_update_notify_admins_disputed
  AFTER UPDATE OF status ON public.payments
  FOR EACH ROW
  EXECUTE FUNCTION public.notify_admins_payment_disputed();

-- Allow admins to list bookings/payments for Admin Dashboard & Reports (RLS was party-only).
DROP POLICY IF EXISTS "bookings_select_admin" ON public.bookings;
CREATE POLICY "bookings_select_admin" ON public.bookings
  FOR SELECT USING (
    EXISTS (SELECT 1 FROM public.profiles WHERE id = auth.uid() AND role = 'admin')
  );

DROP POLICY IF EXISTS "payments_select_admin" ON public.payments;
CREATE POLICY "payments_select_admin" ON public.payments
  FOR SELECT USING (
    EXISTS (SELECT 1 FROM public.profiles WHERE id = auth.uid() AND role = 'admin')
  );
