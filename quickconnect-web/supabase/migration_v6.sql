-- Migration v6: Two-Factor Authentication via Email OTP
-- Run this in the Supabase SQL editor

-- Add two_fa_enabled flag to profiles
ALTER TABLE profiles
  ADD COLUMN IF NOT EXISTS two_fa_enabled BOOLEAN NOT NULL DEFAULT FALSE;

-- Table to store time-limited OTP codes
CREATE TABLE IF NOT EXISTS otp_codes (
  id         UUID         DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id    UUID         NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  code       VARCHAR(6)   NOT NULL,
  expires_at TIMESTAMPTZ  NOT NULL DEFAULT (now() + INTERVAL '10 minutes'),
  used       BOOLEAN      NOT NULL DEFAULT FALSE,
  created_at TIMESTAMPTZ  NOT NULL DEFAULT now()
);

-- Edge functions use the service role key; no direct client access allowed
ALTER TABLE otp_codes ENABLE ROW LEVEL SECURITY;

-- No RLS SELECT/INSERT/UPDATE policies — only service role (edge functions) may touch this table

-- Indexes
CREATE INDEX IF NOT EXISTS idx_otp_codes_user_id    ON otp_codes (user_id);
CREATE INDEX IF NOT EXISTS idx_otp_codes_expires_at ON otp_codes (expires_at);
