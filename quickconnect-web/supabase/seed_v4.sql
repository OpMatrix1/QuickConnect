-- =============================================================================
-- QuickConnect Seed v4 — Wallet & Category Auto-Link Demo Data
-- Run AFTER seed.sql AND migration_v4.sql
--
-- What this adds:
--   • Wallet balances for all 8 users
--   • Wallet transaction history (top-ups, holds, releases)
--   • 4 new bookings with wallet payments in different states:
--       bb07 — RELEASED  (both confirmed, funds sent to provider)
--       bb08 — HELD      (customer confirmed only, awaiting provider)
--       bb09 — DISPUTED  (admin must resolve)
--       bb10 — HELD      (neither confirmed yet)
--   • Category auto-link demo: Kgosi's "Solar Installation" request approved
--     → category created → service auto-linked → notification sent
--   • Supporting notifications
--
-- UUID additions:
--   Bookings:  bb000000-0000-0000-0000-00000000000{7-10}
--   Payments:  a1000000-0000-0000-0000-00000000000{1-4}
-- =============================================================================

-- =============================================================================
-- 1. WALLET BALANCES
--    migration_v4 already created wallets with balance = 0.
--    We set them here to reflect topped-up + payment activity below.
-- =============================================================================

UPDATE public.wallets SET balance = 1550.00 WHERE user_id = 'cc000000-0000-0000-0000-000000000001'; -- Mpho
UPDATE public.wallets SET balance = 1000.00 WHERE user_id = 'cc000000-0000-0000-0000-000000000002'; -- Keabetswe
UPDATE public.wallets SET balance = 5550.00 WHERE user_id = 'cc000000-0000-0000-0000-000000000003'; -- Onkemetse
UPDATE public.wallets SET balance =  500.00 WHERE user_id = 'aa000000-0000-0000-0000-000000000001'; -- Admin
UPDATE public.wallets SET balance =  350.00 WHERE user_id = 'dd000000-0000-0000-0000-000000000001'; -- Kgosi  (received P350)
UPDATE public.wallets SET balance =    0.00 WHERE user_id = 'dd000000-0000-0000-0000-000000000002'; -- Naledi (nothing released yet)
UPDATE public.wallets SET balance =    0.00 WHERE user_id = 'dd000000-0000-0000-0000-000000000003'; -- Thabo  (nothing released yet)
UPDATE public.wallets SET balance =  200.00 WHERE user_id = 'dd000000-0000-0000-0000-000000000004'; -- Lesego (topped up)

-- =============================================================================
-- 2. WALLET TRANSACTION HISTORY
-- =============================================================================

-- ── Mpho (customer) ──────────────────────────────────────────────────────────
-- Topped up P2500; paid P350 (released) + P600 (held) → balance P1550
INSERT INTO public.wallet_transactions (wallet_id, type, direction, amount, description, created_at)
SELECT id, 'top_up', 'credit', 2500.00, 'Wallet top-up', NOW() - INTERVAL '10 days'
FROM public.wallets WHERE user_id = 'cc000000-0000-0000-0000-000000000001';

INSERT INTO public.wallet_transactions (wallet_id, type, direction, amount, reference_id, description, created_at)
SELECT id, 'payment_hold', 'debit', 350.00, 'bb000000-0000-0000-0000-000000000007'::uuid,
  'Payment held in escrow', NOW() - INTERVAL '7 days'
FROM public.wallets WHERE user_id = 'cc000000-0000-0000-0000-000000000001';

INSERT INTO public.wallet_transactions (wallet_id, type, direction, amount, reference_id, description, created_at)
SELECT id, 'payment_hold', 'debit', 600.00, 'bb000000-0000-0000-0000-000000000010'::uuid,
  'Payment held in escrow', NOW() - INTERVAL '4 days'
FROM public.wallets WHERE user_id = 'cc000000-0000-0000-0000-000000000001';

-- ── Keabetswe (customer) ──────────────────────────────────────────────────────
-- Topped up P1500; paid P500 (held, customer confirmed) → balance P1000
INSERT INTO public.wallet_transactions (wallet_id, type, direction, amount, description, created_at)
SELECT id, 'top_up', 'credit', 1500.00, 'Wallet top-up', NOW() - INTERVAL '8 days'
FROM public.wallets WHERE user_id = 'cc000000-0000-0000-0000-000000000002';

INSERT INTO public.wallet_transactions (wallet_id, type, direction, amount, reference_id, description, created_at)
SELECT id, 'payment_hold', 'debit', 500.00, 'bb000000-0000-0000-0000-000000000008'::uuid,
  'Payment held in escrow', NOW() - INTERVAL '3 days'
FROM public.wallets WHERE user_id = 'cc000000-0000-0000-0000-000000000002';

-- ── Onkemetse (customer) ──────────────────────────────────────────────────────
-- Two top-ups; one payment disputed → balance P5550
INSERT INTO public.wallet_transactions (wallet_id, type, direction, amount, description, created_at)
SELECT id, 'top_up', 'credit', 3000.00, 'Wallet top-up', NOW() - INTERVAL '15 days'
FROM public.wallets WHERE user_id = 'cc000000-0000-0000-0000-000000000003';

INSERT INTO public.wallet_transactions (wallet_id, type, direction, amount, description, created_at)
SELECT id, 'top_up', 'credit', 3000.00, 'Wallet top-up', NOW() - INTERVAL '8 days'
FROM public.wallets WHERE user_id = 'cc000000-0000-0000-0000-000000000003';

INSERT INTO public.wallet_transactions (wallet_id, type, direction, amount, reference_id, description, created_at)
SELECT id, 'payment_hold', 'debit', 450.00, 'bb000000-0000-0000-0000-000000000009'::uuid,
  'Payment held in escrow', NOW() - INTERVAL '5 days'
FROM public.wallets WHERE user_id = 'cc000000-0000-0000-0000-000000000003';

-- ── Admin ─────────────────────────────────────────────────────────────────────
INSERT INTO public.wallet_transactions (wallet_id, type, direction, amount, description, created_at)
SELECT id, 'top_up', 'credit', 500.00, 'Wallet top-up', NOW() - INTERVAL '20 days'
FROM public.wallets WHERE user_id = 'aa000000-0000-0000-0000-000000000001';

-- ── Kgosi (provider) ─────────────────────────────────────────────────────────
-- Received P350 released from bb07 → balance P350
INSERT INTO public.wallet_transactions (wallet_id, type, direction, amount, reference_id, description, created_at)
SELECT id, 'payment_release', 'credit', 350.00, 'a1000000-0000-0000-0000-000000000001'::uuid,
  'Payment released from escrow', NOW() - INTERVAL '5 days'
FROM public.wallets WHERE user_id = 'dd000000-0000-0000-0000-000000000001';

-- ── Lesego (provider) ─────────────────────────────────────────────────────────
INSERT INTO public.wallet_transactions (wallet_id, type, direction, amount, description, created_at)
SELECT id, 'top_up', 'credit', 200.00, 'Wallet top-up', NOW() - INTERVAL '6 days'
FROM public.wallets WHERE user_id = 'dd000000-0000-0000-0000-000000000004';

-- =============================================================================
-- 3. NEW BOOKINGS (wallet payment demos)
-- =============================================================================

INSERT INTO public.bookings (id, customer_id, provider_id, service_id, status, scheduled_date, scheduled_time, location_address, agreed_price, notes, created_at, updated_at)
VALUES
  -- bb07: Mpho → Kgosi, drain cleaning — COMPLETED, wallet RELEASED ✓
  ('bb000000-0000-0000-0000-000000000007',
   'cc000000-0000-0000-0000-000000000001',
   'ee000000-0000-0000-0000-000000000001',
   'ff000000-0000-0000-0000-000000000002',
   'completed',
   (NOW() - INTERVAL '5 days')::date, '10:00',
   'Gaborone West', 350.00,
   'Blocked bathroom drain — cleared and flushed.',
   NOW() - INTERVAL '7 days', NOW() - INTERVAL '5 days'),

  -- bb08: Keabetswe → Naledi, house clean — IN_PROGRESS, wallet HELD, customer confirmed ✓
  ('bb000000-0000-0000-0000-000000000008',
   'cc000000-0000-0000-0000-000000000002',
   'ee000000-0000-0000-0000-000000000002',
   'ff000000-0000-0000-0000-000000000004',
   'in_progress',
   NOW()::date, '08:00',
   'Monarch, Francistown', 500.00,
   'Standard house clean — 3 bedroom.',
   NOW() - INTERVAL '3 days', NOW() - INTERVAL '3 days'),

  -- bb09: Onkemetse → Kgosi, drain cleaning — COMPLETED, wallet DISPUTED ⚠
  ('bb000000-0000-0000-0000-000000000009',
   'cc000000-0000-0000-0000-000000000003',
   'ee000000-0000-0000-0000-000000000001',
   'ff000000-0000-0000-0000-000000000002',
   'completed',
   (NOW() - INTERVAL '3 days')::date, '14:00',
   'Maun', 450.00,
   'Guest house drain. Customer claims the issue was not fully resolved.',
   NOW() - INTERVAL '5 days', NOW() - INTERVAL '3 days'),

  -- bb10: Mpho → Thabo, fault finding — COMPLETED, wallet HELD, awaiting both confirmations
  ('bb000000-0000-0000-0000-000000000010',
   'cc000000-0000-0000-0000-000000000001',
   'ee000000-0000-0000-0000-000000000003',
   'ff000000-0000-0000-0000-000000000007',
   'completed',
   (NOW() - INTERVAL '2 days')::date, '11:00',
   'Gaborone West', 600.00,
   'Fault finding on outdoor sockets — resolved.',
   NOW() - INTERVAL '4 days', NOW() - INTERVAL '2 days');

-- =============================================================================
-- 4. WALLET PAYMENTS (inserted directly; trigger does not fire on INSERT)
-- =============================================================================

INSERT INTO public.payments (id, booking_id, amount, method, status, customer_confirmed, provider_confirmed, created_at, updated_at)
VALUES
  -- bb07: Both confirmed → RELEASED (Kgosi credited above in wallet_transactions)
  ('a1000000-0000-0000-0000-000000000001',
   'bb000000-0000-0000-0000-000000000007',
   350.00, 'wallet', 'released', TRUE, TRUE,
   NOW() - INTERVAL '7 days', NOW() - INTERVAL '5 days'),

  -- bb08: Customer confirmed only → HELD
  ('a1000000-0000-0000-0000-000000000002',
   'bb000000-0000-0000-0000-000000000008',
   500.00, 'wallet', 'held', TRUE, FALSE,
   NOW() - INTERVAL '3 days', NOW() - INTERVAL '1 day'),

  -- bb09: Customer confirmed, provider declined satisfaction → DISPUTED (admin to resolve)
  ('a1000000-0000-0000-0000-000000000003',
   'bb000000-0000-0000-0000-000000000009',
   450.00, 'wallet', 'disputed', TRUE, FALSE,
   NOW() - INTERVAL '5 days', NOW() - INTERVAL '2 days'),

  -- bb10: Neither confirmed yet → HELD
  ('a1000000-0000-0000-0000-000000000004',
   'bb000000-0000-0000-0000-000000000010',
   600.00, 'wallet', 'held', FALSE, FALSE,
   NOW() - INTERVAL '4 days', NOW() - INTERVAL '4 days');

-- =============================================================================
-- 5. CATEGORY AUTO-LINK DEMO
--    Kgosi requested "Solar Installation" (already in seed.sql as pending).
--    Here we simulate admin approving it → category created → service auto-linked.
-- =============================================================================

-- Approve the request
UPDATE public.category_requests SET
  status       = 'approved',
  admin_feedback = 'Great addition — solar services are in high demand. You have been automatically listed under this category.',
  reviewed_by  = 'aa000000-0000-0000-0000-000000000001',
  updated_at   = NOW() - INTERVAL '1 day'
WHERE requested_by = 'dd000000-0000-0000-0000-000000000001'
  AND name = 'Solar Installation';

-- Create the category (ON CONFLICT in case it was already added)
INSERT INTO public.service_categories (name, icon, description)
VALUES ('Solar Installation', 'sun', 'Solar panel installation, maintenance, and battery backup systems for homes and businesses.')
ON CONFLICT (name) DO NOTHING;

-- Auto-link: create a starter service for Kgosi under Solar Installation
INSERT INTO public.services (provider_id, category_id, title, price_type, is_active, created_at, updated_at)
SELECT
  'ee000000-0000-0000-0000-000000000001',
  sc.id,
  'Solar Installation Service',
  'quote',
  TRUE,
  NOW() - INTERVAL '1 day',
  NOW() - INTERVAL '1 day'
FROM public.service_categories sc
WHERE sc.name = 'Solar Installation';

-- =============================================================================
-- 6. NOTIFICATIONS
-- =============================================================================

INSERT INTO public.notifications (user_id, type, title, body, data, is_read, created_at)
VALUES
  -- Kgosi: Solar Installation request approved + auto-linked
  ('dd000000-0000-0000-0000-000000000001',
   'category_request_reviewed',
   'Category request approved!',
   'Your requested category "Solar Installation" has been approved and you''ve been automatically listed under it.',
   '{}',
   FALSE, NOW() - INTERVAL '1 day'),

  ('dd000000-0000-0000-0000-000000000001',
   'service_linked',
   'Now listed in a new category',
   'You''re now listed under "Solar Installation". Customers in that category will be able to find you.',
   '{}',
   FALSE, NOW() - INTERVAL '1 day'),

  -- Mpho: bb07 payment released
  ('cc000000-0000-0000-0000-000000000001',
   'payment_released',
   'Payment released',
   'Your P350 payment for the drain cleaning booking has been released to the provider.',
   '{"booking_id":"bb000000-0000-0000-0000-000000000007"}',
   TRUE, NOW() - INTERVAL '5 days'),

  -- Kgosi: wallet credit for bb07
  ('dd000000-0000-0000-0000-000000000001',
   'payment_released',
   'Payment received — P350 credited',
   'P350 has been added to your wallet for the drain cleaning booking.',
   '{"booking_id":"bb000000-0000-0000-0000-000000000007"}',
   TRUE, NOW() - INTERVAL '5 days'),

  -- Mpho: bb10 payment held — pending confirmations
  ('cc000000-0000-0000-0000-000000000001',
   'payment_held',
   'Payment held in escrow',
   'P600 for the electrical fault-finding booking is held securely. Confirm when you are satisfied to release it.',
   '{"booking_id":"bb000000-0000-0000-0000-000000000010"}',
   FALSE, NOW() - INTERVAL '4 days'),

  -- Keabetswe: bb08 payment held
  ('cc000000-0000-0000-0000-000000000002',
   'payment_held',
   'Payment held in escrow',
   'P500 for the house clean booking is held securely. You have confirmed satisfaction — waiting for the provider.',
   '{"booking_id":"bb000000-0000-0000-0000-000000000008"}',
   FALSE, NOW() - INTERVAL '1 day'),

  -- Onkemetse: bb09 payment disputed
  ('cc000000-0000-0000-0000-000000000003',
   'payment_disputed',
   'Payment under review',
   'Your P450 payment is now disputed and being reviewed by an admin. You will be notified when it is resolved.',
   '{"booking_id":"bb000000-0000-0000-0000-000000000009"}',
   FALSE, NOW() - INTERVAL '2 days'),

  -- Admin: dispute to resolve
  ('aa000000-0000-0000-0000-000000000001',
   'payment_disputed',
   'Payment dispute needs resolution',
   'A P450 payment between Onkemetse Tau and Kgosi Mosweu is disputed. Review it in Reports.',
   '{"booking_id":"bb000000-0000-0000-0000-000000000009","payment_id":"a1000000-0000-0000-0000-000000000003"}',
   FALSE, NOW() - INTERVAL '2 days');

-- =============================================================================
-- Done!
--
-- Demo accounts (password: Test1234!):
--
--  ADMIN
--    admin@quickconnect.co.bw         — P500 wallet, sees disputed payment to resolve
--
--  CUSTOMERS
--    mpho.kgosi@gmail.com             — P1550 wallet, 2 wallet payments (1 released, 1 held)
--    keabetswe.m@yahoo.com            — P1000 wallet, 1 wallet payment held (she confirmed)
--    onkemetse.t@outlook.com          — P5550 wallet, 1 disputed payment
--
--  PROVIDERS
--    kgosi.plumbing@gmail.com         — P350 wallet (received), approved category request,
--                                       auto-linked to Solar Installation
--    naledi.cleaning@gmail.com        — P0 wallet (payment still held)
--    thabo.electric@gmail.com         — P0 wallet (payment still held)
--    lesego.photography@gmail.com     — P200 wallet (test top-up)
-- =============================================================================
