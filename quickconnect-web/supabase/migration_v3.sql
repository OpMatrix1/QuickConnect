-- =============================================================================
-- QuickConnect Migration v3
-- Run this in the Supabase SQL Editor
-- Fixes: auto-create service_providers row for provider-role users on signup
-- Also backfills missing service_providers rows for existing provider accounts
-- =============================================================================

-- 1. Update handle_new_user trigger to also create service_providers for providers
CREATE OR REPLACE FUNCTION public.handle_new_user()
RETURNS TRIGGER AS $$
DECLARE
  v_role TEXT;
BEGIN
  v_role := COALESCE(NEW.raw_user_meta_data->>'role', 'customer');

  INSERT INTO public.profiles (id, full_name, role)
  VALUES (
    NEW.id,
    COALESCE(NEW.raw_user_meta_data->>'full_name', NEW.email, 'User'),
    v_role
  );

  IF v_role = 'provider' THEN
    INSERT INTO public.service_providers (profile_id, business_name)
    VALUES (
      NEW.id,
      COALESCE(NULLIF(NEW.raw_user_meta_data->>'business_name', ''), NEW.raw_user_meta_data->>'full_name', 'My Business')
    );
  END IF;

  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- 2. Backfill: create missing service_providers rows for existing provider accounts
INSERT INTO public.service_providers (profile_id, business_name)
SELECT p.id, COALESCE(NULLIF(p.full_name, ''), 'My Business')
FROM public.profiles p
WHERE p.role = 'provider'
  AND NOT EXISTS (
    SELECT 1 FROM public.service_providers sp WHERE sp.profile_id = p.id
  );

-- =============================================================================
-- Done! New providers will automatically get a service_providers row on signup,
-- and existing providers without one have been backfilled.
-- =============================================================================
