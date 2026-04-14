-- Migration v8: Profile banner image (e.g. X/Twitter-style header)
-- Run after migration_v7.sql

ALTER TABLE public.profiles
  ADD COLUMN IF NOT EXISTS banner_url TEXT;

COMMENT ON COLUMN public.profiles.banner_url IS 'Optional wide cover image URL for profile header';
