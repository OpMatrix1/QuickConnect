-- =============================================================================
-- QuickConnect Seed Data
-- Run this in the Supabase SQL Editor AFTER schema.sql
--
-- All test accounts use password: Test1234!
-- =============================================================================

-- Enable pgcrypto for password hashing
CREATE EXTENSION IF NOT EXISTS pgcrypto;

-- =============================================================================
-- 1. AUTH USERS  (8 users: 1 admin, 3 customers, 4 providers)
--
-- UUID scheme (all valid hex):
--   Admin:      aa000000-0000-0000-0000-000000000001
--   Customers:  cc000000-0000-0000-0000-00000000000{1-3}
--   Providers:  dd000000-0000-0000-0000-00000000000{1-4}
--   SPs:        ee000000-0000-0000-0000-00000000000{1-4}
--   Services:   ff000000-0000-0000-0000-0000000000{01-11}
--   Posts:       10000000-0000-0000-0000-00000000000{1-6}
--   Responses:  ab000000-0000-0000-0000-00000000000{1-4}
--   Bookings:   bb000000-0000-0000-0000-00000000000{1-6}
--   Convos:     dc000000-0000-0000-0000-00000000000{1-4}
-- =============================================================================

-- Admin
INSERT INTO auth.users (instance_id, id, aud, role, email, encrypted_password, email_confirmed_at, raw_app_meta_data, raw_user_meta_data, created_at, updated_at, confirmation_token, email_change, email_change_token_new, recovery_token)
VALUES (
  '00000000-0000-0000-0000-000000000000',
  'aa000000-0000-0000-0000-000000000001',
  'authenticated', 'authenticated',
  'admin@quickconnect.co.bw',
  crypt('Test1234!', gen_salt('bf')),
  NOW(),
  '{"provider":"email","providers":["email"]}',
  '{"full_name":"Admin User","role":"admin"}',
  NOW() - INTERVAL '90 days', NOW(), '', '', '', ''
);

-- Customers
INSERT INTO auth.users (instance_id, id, aud, role, email, encrypted_password, email_confirmed_at, raw_app_meta_data, raw_user_meta_data, created_at, updated_at, confirmation_token, email_change, email_change_token_new, recovery_token)
VALUES
  ('00000000-0000-0000-0000-000000000000', 'cc000000-0000-0000-0000-000000000001', 'authenticated', 'authenticated', 'mpho.kgosi@gmail.com',    crypt('Test1234!', gen_salt('bf')), NOW(), '{"provider":"email","providers":["email"]}', '{"full_name":"Mpho Kgosi","role":"customer"}',        NOW() - INTERVAL '60 days', NOW(), '', '', '', ''),
  ('00000000-0000-0000-0000-000000000000', 'cc000000-0000-0000-0000-000000000002', 'authenticated', 'authenticated', 'keabetswe.m@yahoo.com',   crypt('Test1234!', gen_salt('bf')), NOW(), '{"provider":"email","providers":["email"]}', '{"full_name":"Keabetswe Molefe","role":"customer"}',   NOW() - INTERVAL '45 days', NOW(), '', '', '', ''),
  ('00000000-0000-0000-0000-000000000000', 'cc000000-0000-0000-0000-000000000003', 'authenticated', 'authenticated', 'onkemetse.t@outlook.com',  crypt('Test1234!', gen_salt('bf')), NOW(), '{"provider":"email","providers":["email"]}', '{"full_name":"Onkemetse Tau","role":"customer"}',      NOW() - INTERVAL '30 days', NOW(), '', '', '', '');

-- Providers
INSERT INTO auth.users (instance_id, id, aud, role, email, encrypted_password, email_confirmed_at, raw_app_meta_data, raw_user_meta_data, created_at, updated_at, confirmation_token, email_change, email_change_token_new, recovery_token)
VALUES
  ('00000000-0000-0000-0000-000000000000', 'dd000000-0000-0000-0000-000000000001', 'authenticated', 'authenticated', 'kgosi.plumbing@gmail.com',    crypt('Test1234!', gen_salt('bf')), NOW(), '{"provider":"email","providers":["email"]}', '{"full_name":"Kgosi Mosweu","role":"provider"}',    NOW() - INTERVAL '80 days', NOW(), '', '', '', ''),
  ('00000000-0000-0000-0000-000000000000', 'dd000000-0000-0000-0000-000000000002', 'authenticated', 'authenticated', 'naledi.cleaning@gmail.com',   crypt('Test1234!', gen_salt('bf')), NOW(), '{"provider":"email","providers":["email"]}', '{"full_name":"Naledi Seretse","role":"provider"}',   NOW() - INTERVAL '70 days', NOW(), '', '', '', ''),
  ('00000000-0000-0000-0000-000000000000', 'dd000000-0000-0000-0000-000000000003', 'authenticated', 'authenticated', 'thabo.electric@gmail.com',    crypt('Test1234!', gen_salt('bf')), NOW(), '{"provider":"email","providers":["email"]}', '{"full_name":"Thabo Rapula","role":"provider"}',     NOW() - INTERVAL '55 days', NOW(), '', '', '', ''),
  ('00000000-0000-0000-0000-000000000000', 'dd000000-0000-0000-0000-000000000004', 'authenticated', 'authenticated', 'lesego.photography@gmail.com', crypt('Test1234!', gen_salt('bf')), NOW(), '{"provider":"email","providers":["email"]}', '{"full_name":"Lesego Otsile","role":"provider"}',    NOW() - INTERVAL '40 days', NOW(), '', '', '', '');

-- Auth identities (required for email/password login)
INSERT INTO auth.identities (id, user_id, identity_data, provider, provider_id, last_sign_in_at, created_at, updated_at)
VALUES
  ('aa000000-0000-0000-0000-000000000001', 'aa000000-0000-0000-0000-000000000001', '{"sub":"aa000000-0000-0000-0000-000000000001","email":"admin@quickconnect.co.bw"}',      'email', 'admin@quickconnect.co.bw',      NOW(), NOW() - INTERVAL '90 days', NOW()),
  ('cc000000-0000-0000-0000-000000000001', 'cc000000-0000-0000-0000-000000000001', '{"sub":"cc000000-0000-0000-0000-000000000001","email":"mpho.kgosi@gmail.com"}',           'email', 'mpho.kgosi@gmail.com',           NOW(), NOW() - INTERVAL '60 days', NOW()),
  ('cc000000-0000-0000-0000-000000000002', 'cc000000-0000-0000-0000-000000000002', '{"sub":"cc000000-0000-0000-0000-000000000002","email":"keabetswe.m@yahoo.com"}',          'email', 'keabetswe.m@yahoo.com',          NOW(), NOW() - INTERVAL '45 days', NOW()),
  ('cc000000-0000-0000-0000-000000000003', 'cc000000-0000-0000-0000-000000000003', '{"sub":"cc000000-0000-0000-0000-000000000003","email":"onkemetse.t@outlook.com"}',        'email', 'onkemetse.t@outlook.com',        NOW(), NOW() - INTERVAL '30 days', NOW()),
  ('dd000000-0000-0000-0000-000000000001', 'dd000000-0000-0000-0000-000000000001', '{"sub":"dd000000-0000-0000-0000-000000000001","email":"kgosi.plumbing@gmail.com"}',       'email', 'kgosi.plumbing@gmail.com',       NOW(), NOW() - INTERVAL '80 days', NOW()),
  ('dd000000-0000-0000-0000-000000000002', 'dd000000-0000-0000-0000-000000000002', '{"sub":"dd000000-0000-0000-0000-000000000002","email":"naledi.cleaning@gmail.com"}',      'email', 'naledi.cleaning@gmail.com',      NOW(), NOW() - INTERVAL '70 days', NOW()),
  ('dd000000-0000-0000-0000-000000000003', 'dd000000-0000-0000-0000-000000000003', '{"sub":"dd000000-0000-0000-0000-000000000003","email":"thabo.electric@gmail.com"}',       'email', 'thabo.electric@gmail.com',       NOW(), NOW() - INTERVAL '55 days', NOW()),
  ('dd000000-0000-0000-0000-000000000004', 'dd000000-0000-0000-0000-000000000004', '{"sub":"dd000000-0000-0000-0000-000000000004","email":"lesego.photography@gmail.com"}',   'email', 'lesego.photography@gmail.com',   NOW(), NOW() - INTERVAL '40 days', NOW());

-- =============================================================================
-- 2. ENRICH PROFILES  (trigger created bare profiles; fill in details)
-- =============================================================================

UPDATE public.profiles SET
  phone = '+267 71 000 001', city = 'Gaborone', bio = 'QuickConnect administrator',
  email_verified = TRUE, is_active = TRUE
WHERE id = 'aa000000-0000-0000-0000-000000000001';

UPDATE public.profiles SET
  phone = '+267 74 123 456', city = 'Gaborone',
  bio = 'Homeowner in Gaborone. Always looking for reliable service providers!',
  email_verified = TRUE
WHERE id = 'cc000000-0000-0000-0000-000000000001';

UPDATE public.profiles SET
  phone = '+267 76 234 567', city = 'Francistown',
  bio = 'Busy professional who values quality service.',
  email_verified = TRUE
WHERE id = 'cc000000-0000-0000-0000-000000000002';

UPDATE public.profiles SET
  phone = '+267 77 345 678', city = 'Maun',
  bio = 'New in Maun, looking for good local services.',
  email_verified = TRUE
WHERE id = 'cc000000-0000-0000-0000-000000000003';

UPDATE public.profiles SET
  phone = '+267 72 100 001', city = 'Gaborone',
  bio = 'Master plumber with 12 years of experience in Gaborone and surrounding areas.',
  email_verified = TRUE
WHERE id = 'dd000000-0000-0000-0000-000000000001';

UPDATE public.profiles SET
  phone = '+267 73 200 002', city = 'Gaborone',
  bio = 'Professional cleaning services for homes and offices.',
  email_verified = TRUE
WHERE id = 'dd000000-0000-0000-0000-000000000002';

UPDATE public.profiles SET
  phone = '+267 75 300 003', city = 'Francistown',
  bio = 'Licensed electrician serving the greater Francistown area.',
  email_verified = TRUE
WHERE id = 'dd000000-0000-0000-0000-000000000003';

UPDATE public.profiles SET
  phone = '+267 74 400 004', city = 'Maun',
  bio = 'Capturing memories in the Okavango region — weddings, events, and portraits.',
  email_verified = TRUE
WHERE id = 'dd000000-0000-0000-0000-000000000004';

-- =============================================================================
-- 3. SERVICE PROVIDERS
-- =============================================================================

INSERT INTO public.service_providers (id, profile_id, business_name, description, rating_avg, review_count, response_time_avg, completion_rate, is_verified)
VALUES
  ('ee000000-0000-0000-0000-000000000001', 'dd000000-0000-0000-0000-000000000001', 'Kgosi Plumbing & Repairs',   'Trusted plumbing services across Gaborone — pipe repairs, installations, drain cleaning, and emergency callouts.', 4.70, 3, 25, 97.50, TRUE),
  ('ee000000-0000-0000-0000-000000000002', 'dd000000-0000-0000-0000-000000000002', 'Naledi Sparkle Cleaning',    'Premium residential and commercial cleaning in Gaborone. Deep cleans, move-in/out, and regular maintenance.', 4.85, 2, 15, 99.00, TRUE),
  ('ee000000-0000-0000-0000-000000000003', 'dd000000-0000-0000-0000-000000000003', 'Thabo Electrical Solutions',  'Full-service electrical contractor in Francistown — wiring, panel upgrades, solar installation, and safety inspections.', 4.50, 2, 35, 95.00, FALSE),
  ('ee000000-0000-0000-0000-000000000004', 'dd000000-0000-0000-0000-000000000004', 'Lesego Lens Photography',     'Professional photography for weddings, corporate events, and family portraits in the Maun and Okavango area.', 4.90, 1, 20, 100.00, TRUE);

-- =============================================================================
-- 4. SERVICES  (each provider offers 2-3 services)
-- =============================================================================

INSERT INTO public.services (id, provider_id, category_id, title, description, price_min, price_max, price_type, is_active)
VALUES
  -- Kgosi Plumbing
  ('ff000000-0000-0000-0000-000000000001', 'ee000000-0000-0000-0000-000000000001', (SELECT id FROM public.service_categories WHERE name = 'Plumbing'),    'General Plumbing Repairs',       'Fixing leaks, replacing taps, toilet repairs, and general maintenance.',  150.00, 600.00, 'fixed',  TRUE),
  ('ff000000-0000-0000-0000-000000000002', 'ee000000-0000-0000-0000-000000000001', (SELECT id FROM public.service_categories WHERE name = 'Plumbing'),    'Drain Cleaning & Unblocking',    'Professional drain unblocking using high-pressure jetting equipment.',    200.00, 800.00, 'fixed',  TRUE),
  ('ff000000-0000-0000-0000-000000000003', 'ee000000-0000-0000-0000-000000000001', (SELECT id FROM public.service_categories WHERE name = 'Plumbing'),    'Geyser Installation & Repair',   'Hot water geyser installation, replacement, and repairs.',               500.00, 3000.00, 'quote', TRUE),

  -- Naledi Cleaning
  ('ff000000-0000-0000-0000-000000000004', 'ee000000-0000-0000-0000-000000000002', (SELECT id FROM public.service_categories WHERE name = 'Cleaning'),    'Standard House Cleaning',        'Full house clean including dusting, mopping, vacuuming, and bathrooms.', 250.00, 500.00, 'fixed',  TRUE),
  ('ff000000-0000-0000-0000-000000000005', 'ee000000-0000-0000-0000-000000000002', (SELECT id FROM public.service_categories WHERE name = 'Cleaning'),    'Deep Clean / Move-in Move-out',  'Thorough deep cleaning for move-ins, move-outs, or spring cleans.',      500.00, 1200.00, 'fixed', TRUE),
  ('ff000000-0000-0000-0000-000000000006', 'ee000000-0000-0000-0000-000000000002', (SELECT id FROM public.service_categories WHERE name = 'Cleaning'),    'Office Cleaning',                'Regular or once-off cleaning for offices and commercial spaces.',        300.00, 800.00, 'hourly', TRUE),

  -- Thabo Electrical
  ('ff000000-0000-0000-0000-000000000007', 'ee000000-0000-0000-0000-000000000003', (SELECT id FROM public.service_categories WHERE name = 'Electrical'),  'Electrical Fault Finding',       'Diagnose and repair electrical faults, tripping breakers, and outages.', 200.00, 500.00, 'hourly', TRUE),
  ('ff000000-0000-0000-0000-000000000008', 'ee000000-0000-0000-0000-000000000003', (SELECT id FROM public.service_categories WHERE name = 'Electrical'),  'New Wiring & Installations',     'Full house wiring, socket and light installations, DB board upgrades.',  800.00, 5000.00, 'quote', TRUE),

  -- Lesego Photography
  ('ff000000-0000-0000-0000-000000000009', 'ee000000-0000-0000-0000-000000000004', (SELECT id FROM public.service_categories WHERE name = 'Photography'), 'Wedding Photography',            'Full-day wedding coverage with edited high-res digital album.',          3000.00, 8000.00, 'fixed', TRUE),
  ('ff000000-0000-0000-0000-000000000010', 'ee000000-0000-0000-0000-000000000004', (SELECT id FROM public.service_categories WHERE name = 'Photography'), 'Portrait & Family Sessions',     '1-2 hour portrait or family session with 20 edited photos.',            500.00, 1500.00, 'fixed',  TRUE),
  ('ff000000-0000-0000-0000-000000000011', 'ee000000-0000-0000-0000-000000000004', (SELECT id FROM public.service_categories WHERE name = 'Event Planning'), 'Event Coverage',              'Corporate events, birthdays, and private function photography.',         1500.00, 5000.00, 'quote', TRUE);

-- =============================================================================
-- 5. SERVICE AREAS
-- =============================================================================

INSERT INTO public.service_areas (provider_id, city, area_name, radius_km)
VALUES
  ('ee000000-0000-0000-0000-000000000001', 'Gaborone',    'Gaborone CBD & Suburbs',  25.00),
  ('ee000000-0000-0000-0000-000000000001', 'Molepolole',  'Molepolole',               10.00),
  ('ee000000-0000-0000-0000-000000000002', 'Gaborone',    'Greater Gaborone',          30.00),
  ('ee000000-0000-0000-0000-000000000002', 'Lobatse',     'Lobatse',                   15.00),
  ('ee000000-0000-0000-0000-000000000003', 'Francistown', 'Francistown & Surrounds',   20.00),
  ('ee000000-0000-0000-0000-000000000003', 'Mahalapye',   'Mahalapye',                 10.00),
  ('ee000000-0000-0000-0000-000000000004', 'Maun',        'Maun & Okavango',           40.00),
  ('ee000000-0000-0000-0000-000000000004', 'Kasane',      'Kasane & Chobe',            30.00);

-- =============================================================================
-- 6. LOOKING-FOR POSTS  (6 posts from the 3 customers)
-- =============================================================================

INSERT INTO public.looking_for_posts (id, customer_id, category_id, title, description, budget_min, budget_max, location_address, preferred_date, preferred_time, urgency, status, expires_at, created_at)
VALUES
  ('10000000-0000-0000-0000-000000000001',
   'cc000000-0000-0000-0000-000000000001',
   (SELECT id FROM public.service_categories WHERE name = 'Plumbing'),
   'Kitchen sink is leaking badly',
   'The pipe under my kitchen sink has been dripping for a few days and now it is getting worse. I need someone who can come quickly and fix or replace the pipe. The sink is a double-basin type.',
   200.00, 500.00, 'Plot 1234, Gaborone West', NOW()::date + INTERVAL '3 days', '09:00', 'high', 'active',
   NOW() + INTERVAL '14 days', NOW() - INTERVAL '2 days'),

  ('10000000-0000-0000-0000-000000000002',
   'cc000000-0000-0000-0000-000000000001',
   (SELECT id FROM public.service_categories WHERE name = 'Cleaning'),
   'Deep clean before house party',
   'Hosting a large family gathering next weekend. Need a thorough deep clean of a 4-bedroom house — floors, bathrooms, kitchen, windows. House is in Phakalane.',
   400.00, 800.00, 'Phakalane, Gaborone', NOW()::date + INTERVAL '7 days', '08:00', 'medium', 'active',
   NOW() + INTERVAL '14 days', NOW() - INTERVAL '1 day'),

  ('10000000-0000-0000-0000-000000000003',
   'cc000000-0000-0000-0000-000000000002',
   (SELECT id FROM public.service_categories WHERE name = 'Electrical'),
   'Power keeps tripping in my house',
   'The circuit breaker trips every time I use the oven and washing machine at the same time. I think the DB board may need an upgrade. Looking for a licensed electrician in Francistown.',
   300.00, 1500.00, 'Area W, Francistown', NOW()::date + INTERVAL '5 days', '10:00', 'high', 'active',
   NOW() + INTERVAL '14 days', NOW() - INTERVAL '3 days'),

  ('10000000-0000-0000-0000-000000000004',
   'cc000000-0000-0000-0000-000000000002',
   (SELECT id FROM public.service_categories WHERE name = 'Painting'),
   'Exterior house painting — 3 bedroom',
   'Need the exterior of my 3-bedroom house painted. Currently peeling and weathered. I will provide the paint. Just need skilled labour.',
   1000.00, 3000.00, 'Satellite, Francistown', NOW()::date + INTERVAL '14 days', '07:00', 'low', 'active',
   NOW() + INTERVAL '30 days', NOW() - INTERVAL '5 days'),

  ('10000000-0000-0000-0000-000000000005',
   'cc000000-0000-0000-0000-000000000003',
   (SELECT id FROM public.service_categories WHERE name = 'Photography'),
   'Wedding photographer for December wedding',
   'Getting married on 20 December in Maun. Looking for a professional photographer who can cover the full day from preparation to reception. About 150 guests expected.',
   3000.00, 7000.00, 'Cresta Maun Lodge, Maun', '2026-12-20', '07:00', 'medium', 'active',
   NOW() + INTERVAL '60 days', NOW() - INTERVAL '4 days'),

  ('10000000-0000-0000-0000-000000000006',
   'cc000000-0000-0000-0000-000000000003',
   (SELECT id FROM public.service_categories WHERE name = 'Moving & Transport'),
   'Moving furniture from Maun to Gaborone',
   'Relocating for work. Have a full 2-bedroom flat worth of furniture that needs to go from Maun to Gaborone. Need a reliable mover with a covered truck.',
   2000.00, 5000.00, 'Maun', NOW()::date + INTERVAL '21 days', '06:00', 'medium', 'active',
   NOW() + INTERVAL '30 days', NOW() - INTERVAL '1 day');

-- =============================================================================
-- 7. LOOKING-FOR RESPONSES  (providers quote on posts)
-- =============================================================================

INSERT INTO public.looking_for_responses (id, post_id, provider_id, quoted_price, message, estimated_duration, available_date, available_time, status, created_at)
VALUES
  ('ab000000-0000-0000-0000-000000000001',
   '10000000-0000-0000-0000-000000000001', 'ee000000-0000-0000-0000-000000000001',
   350.00,
   'Hi Mpho, I can come look at this tomorrow. Most kitchen sink pipe repairs take about an hour. Price includes parts for standard PVC pipes — if copper is needed it may cost a bit more.',
   '1-2 hours', NOW()::date + INTERVAL '1 day', '09:00', 'accepted',
   NOW() - INTERVAL '1 day'),

  ('ab000000-0000-0000-0000-000000000002',
   '10000000-0000-0000-0000-000000000002', 'ee000000-0000-0000-0000-000000000002',
   650.00,
   'Hello! We specialise in deep cleans for events. For a 4-bedroom house in Phakalane, a 3-person team can do a thorough job in about 5 hours. We bring all cleaning supplies.',
   '4-5 hours', NOW()::date + INTERVAL '6 days', '08:00', 'pending',
   NOW() - INTERVAL '12 hours'),

  ('ab000000-0000-0000-0000-000000000003',
   '10000000-0000-0000-0000-000000000003', 'ee000000-0000-0000-0000-000000000003',
   800.00,
   'This sounds like your DB board is undersized for the load. I can inspect it and upgrade to a larger board if needed. The P800 covers inspection and standard upgrade — if extra circuits are needed I will quote separately.',
   '3-4 hours', NOW()::date + INTERVAL '4 days', '10:00', 'accepted',
   NOW() - INTERVAL '2 days'),

  ('ab000000-0000-0000-0000-000000000004',
   '10000000-0000-0000-0000-000000000005', 'ee000000-0000-0000-0000-000000000004',
   5500.00,
   'Congratulations on your upcoming wedding! I would love to capture your special day. My package includes full-day coverage (prep to reception), a second shooter, 300+ edited photos, and an online gallery. I am based in Maun so no travel fees.',
   'Full day (10-12 hours)', '2026-12-20', '06:30', 'pending',
   NOW() - INTERVAL '3 days');

-- =============================================================================
-- 8. BOOKINGS  (6 bookings in various states)
-- =============================================================================

INSERT INTO public.bookings (id, customer_id, provider_id, service_id, looking_for_response_id, status, scheduled_date, scheduled_time, location_address, agreed_price, notes, created_at)
VALUES
  -- Completed: Mpho's plumbing fix by Kgosi
  ('bb000000-0000-0000-0000-000000000001',
   'cc000000-0000-0000-0000-000000000001', 'ee000000-0000-0000-0000-000000000001',
   'ff000000-0000-0000-0000-000000000001', 'ab000000-0000-0000-0000-000000000001',
   'completed', (NOW() - INTERVAL '10 days')::date, '09:00',
   'Plot 1234, Gaborone West', 350.00, 'Replaced kitchen sink pipe and tightened fittings.',
   NOW() - INTERVAL '12 days'),

  -- Completed: Keabetswe's electrical work by Thabo
  ('bb000000-0000-0000-0000-000000000002',
   'cc000000-0000-0000-0000-000000000002', 'ee000000-0000-0000-0000-000000000003',
   'ff000000-0000-0000-0000-000000000007', 'ab000000-0000-0000-0000-000000000003',
   'completed', (NOW() - INTERVAL '7 days')::date, '10:00',
   'Area W, Francistown', 800.00, 'Upgraded DB board from 4-way to 8-way. All circuits tested and certified.',
   NOW() - INTERVAL '9 days'),

  -- Confirmed: Mpho booked Naledi for cleaning (upcoming)
  ('bb000000-0000-0000-0000-000000000003',
   'cc000000-0000-0000-0000-000000000001', 'ee000000-0000-0000-0000-000000000002',
   'ff000000-0000-0000-0000-000000000005', NULL,
   'confirmed', NOW()::date + INTERVAL '5 days', '08:00',
   'Phakalane, Gaborone', 650.00, 'Deep clean before family gathering. 4-bedroom house.',
   NOW() - INTERVAL '2 days'),

  -- Pending: Onkemetse + Kgosi — direct plumbing booking
  ('bb000000-0000-0000-0000-000000000004',
   'cc000000-0000-0000-0000-000000000003', 'ee000000-0000-0000-0000-000000000001',
   'ff000000-0000-0000-0000-000000000002', NULL,
   'pending', NOW()::date + INTERVAL '10 days', '14:00',
   'Maun', 450.00, 'Blocked drain in bathroom.',
   NOW() - INTERVAL '1 day'),

  -- In progress: Keabetswe booked Naledi for office cleaning
  ('bb000000-0000-0000-0000-000000000005',
   'cc000000-0000-0000-0000-000000000002', 'ee000000-0000-0000-0000-000000000002',
   'ff000000-0000-0000-0000-000000000006', NULL,
   'in_progress', NOW()::date, '09:00',
   'CBD, Francistown', 500.00, 'Weekly office cleaning — first session.',
   NOW() - INTERVAL '5 days'),

  -- Completed: Mpho booked Thabo for wiring (past)
  ('bb000000-0000-0000-0000-000000000006',
   'cc000000-0000-0000-0000-000000000001', 'ee000000-0000-0000-0000-000000000003',
   'ff000000-0000-0000-0000-000000000008', NULL,
   'completed', (NOW() - INTERVAL '20 days')::date, '08:00',
   'Gaborone West', 2500.00, 'Full rewiring of extension — 2 bedrooms + bathroom.',
   NOW() - INTERVAL '25 days');

-- =============================================================================
-- 9. PAYMENTS  (for completed and in-progress bookings)
-- =============================================================================

INSERT INTO public.payments (booking_id, amount, method, status, transaction_ref, created_at)
VALUES
  ('bb000000-0000-0000-0000-000000000001', 350.00,  'orange_money',   'completed', 'OM-2026-00101', NOW() - INTERVAL '10 days'),
  ('bb000000-0000-0000-0000-000000000002', 800.00,  'btc_myzaka',     'completed', 'BM-2026-00202', NOW() - INTERVAL '7 days'),
  ('bb000000-0000-0000-0000-000000000005', 500.00,  'mascom_myzaka',  'pending',   'MM-2026-00503', NOW() - INTERVAL '1 day'),
  ('bb000000-0000-0000-0000-000000000006', 2500.00, 'orange_money',   'completed', 'OM-2026-00604', NOW() - INTERVAL '20 days');

-- =============================================================================
-- 10. REVIEWS  (for completed bookings — triggers update provider rating)
-- =============================================================================

INSERT INTO public.reviews (booking_id, customer_id, provider_id, rating, comment, created_at)
VALUES
  ('bb000000-0000-0000-0000-000000000001', 'cc000000-0000-0000-0000-000000000001', 'ee000000-0000-0000-0000-000000000001',
   5, 'Kgosi arrived on time and fixed the leak in under an hour. Very professional and tidy. Highly recommended!', NOW() - INTERVAL '9 days'),

  ('bb000000-0000-0000-0000-000000000002', 'cc000000-0000-0000-0000-000000000002', 'ee000000-0000-0000-0000-000000000003',
   4, 'Thabo did a great job upgrading my DB board. Took a bit longer than expected but explained everything clearly.', NOW() - INTERVAL '6 days'),

  ('bb000000-0000-0000-0000-000000000006', 'cc000000-0000-0000-0000-000000000001', 'ee000000-0000-0000-0000-000000000003',
   5, 'Excellent wiring job on the extension. Clean work, properly labelled circuits. Would hire again.', NOW() - INTERVAL '18 days');

-- =============================================================================
-- 11. CONVERSATIONS & MESSAGES
-- =============================================================================

-- Conversation 1: Mpho <-> Kgosi (about the plumbing booking)
INSERT INTO public.conversations (id, participant_1, participant_2, booking_id, last_message_at, created_at)
VALUES ('dc000000-0000-0000-0000-000000000001', 'cc000000-0000-0000-0000-000000000001', 'dd000000-0000-0000-0000-000000000001', 'bb000000-0000-0000-0000-000000000001', NOW() - INTERVAL '10 days', NOW() - INTERVAL '12 days');

INSERT INTO public.messages (conversation_id, sender_id, receiver_id, content, is_read, created_at)
VALUES
  ('dc000000-0000-0000-0000-000000000001', 'cc000000-0000-0000-0000-000000000001', 'dd000000-0000-0000-0000-000000000001', 'Hi Kgosi, thanks for accepting. What tools or access do you need from me?', TRUE, NOW() - INTERVAL '12 days'),
  ('dc000000-0000-0000-0000-000000000001', 'dd000000-0000-0000-0000-000000000001', 'cc000000-0000-0000-0000-000000000001', 'Hello Mpho! Just make sure someone is home and the area under the sink is cleared. I will bring everything I need.', TRUE, NOW() - INTERVAL '12 days' + INTERVAL '30 minutes'),
  ('dc000000-0000-0000-0000-000000000001', 'cc000000-0000-0000-0000-000000000001', 'dd000000-0000-0000-0000-000000000001', 'Perfect, see you tomorrow at 9!', TRUE, NOW() - INTERVAL '12 days' + INTERVAL '45 minutes'),
  ('dc000000-0000-0000-0000-000000000001', 'dd000000-0000-0000-0000-000000000001', 'cc000000-0000-0000-0000-000000000001', 'All done! Pipe replaced and tested. Let me know if anything else comes up.', TRUE, NOW() - INTERVAL '10 days');

-- Conversation 2: Keabetswe <-> Thabo (about the electrical booking)
INSERT INTO public.conversations (id, participant_1, participant_2, booking_id, last_message_at, created_at)
VALUES ('dc000000-0000-0000-0000-000000000002', 'cc000000-0000-0000-0000-000000000002', 'dd000000-0000-0000-0000-000000000003', 'bb000000-0000-0000-0000-000000000002', NOW() - INTERVAL '6 days', NOW() - INTERVAL '9 days');

INSERT INTO public.messages (conversation_id, sender_id, receiver_id, content, is_read, created_at)
VALUES
  ('dc000000-0000-0000-0000-000000000002', 'cc000000-0000-0000-0000-000000000002', 'dd000000-0000-0000-0000-000000000003', 'Hi Thabo, does the P800 include the new DB board itself or just labour?', TRUE, NOW() - INTERVAL '9 days'),
  ('dc000000-0000-0000-0000-000000000002', 'dd000000-0000-0000-0000-000000000003', 'cc000000-0000-0000-0000-000000000002', 'It includes a standard 8-way board and labour. If you want a surge-protected board it is P200 extra.', TRUE, NOW() - INTERVAL '9 days' + INTERVAL '20 minutes'),
  ('dc000000-0000-0000-0000-000000000002', 'cc000000-0000-0000-0000-000000000002', 'dd000000-0000-0000-0000-000000000003', 'Standard is fine. See you Thursday.', TRUE, NOW() - INTERVAL '9 days' + INTERVAL '40 minutes'),
  ('dc000000-0000-0000-0000-000000000002', 'dd000000-0000-0000-0000-000000000003', 'cc000000-0000-0000-0000-000000000002', 'Job complete! Your new board is installed and all circuits are labelled. Enjoy!', TRUE, NOW() - INTERVAL '6 days');

-- Conversation 3: Mpho <-> Naledi (about upcoming cleaning)
INSERT INTO public.conversations (id, participant_1, participant_2, booking_id, last_message_at, created_at)
VALUES ('dc000000-0000-0000-0000-000000000003', 'cc000000-0000-0000-0000-000000000001', 'dd000000-0000-0000-0000-000000000002', 'bb000000-0000-0000-0000-000000000003', NOW() - INTERVAL '1 day', NOW() - INTERVAL '2 days');

INSERT INTO public.messages (conversation_id, sender_id, receiver_id, content, is_read, created_at)
VALUES
  ('dc000000-0000-0000-0000-000000000003', 'cc000000-0000-0000-0000-000000000001', 'dd000000-0000-0000-0000-000000000002', 'Hi Naledi, just confirming the deep clean this Saturday at 8am. Is there anything I should prepare?', TRUE, NOW() - INTERVAL '2 days'),
  ('dc000000-0000-0000-0000-000000000003', 'dd000000-0000-0000-0000-000000000002', 'cc000000-0000-0000-0000-000000000001', 'Hi Mpho! Yes, if you could clear the kitchen counters and remove any valuables from surfaces that would help us work faster. We bring all products and equipment.', TRUE, NOW() - INTERVAL '2 days' + INTERVAL '1 hour'),
  ('dc000000-0000-0000-0000-000000000003', 'cc000000-0000-0000-0000-000000000001', 'dd000000-0000-0000-0000-000000000002', 'Will do. Thank you!', FALSE, NOW() - INTERVAL '1 day');

-- Conversation 4: Onkemetse <-> Lesego (about wedding photography)
INSERT INTO public.conversations (id, participant_1, participant_2, looking_for_post_id, last_message_at, created_at)
VALUES ('dc000000-0000-0000-0000-000000000004', 'cc000000-0000-0000-0000-000000000003', 'dd000000-0000-0000-0000-000000000004', '10000000-0000-0000-0000-000000000005', NOW() - INTERVAL '2 days', NOW() - INTERVAL '3 days');

INSERT INTO public.messages (conversation_id, sender_id, receiver_id, content, is_read, created_at)
VALUES
  ('dc000000-0000-0000-0000-000000000004', 'cc000000-0000-0000-0000-000000000003', 'dd000000-0000-0000-0000-000000000004', 'Hi Lesego, I saw your quote for my wedding. Do you have a portfolio I can look at?', TRUE, NOW() - INTERVAL '3 days'),
  ('dc000000-0000-0000-0000-000000000004', 'dd000000-0000-0000-0000-000000000004', 'cc000000-0000-0000-0000-000000000003', 'Hello Onkemetse! Congratulations! Yes, I will send you a link to my latest wedding gallery. I have shot over 30 weddings in the Maun area.', TRUE, NOW() - INTERVAL '3 days' + INTERVAL '15 minutes'),
  ('dc000000-0000-0000-0000-000000000004', 'cc000000-0000-0000-0000-000000000003', 'dd000000-0000-0000-0000-000000000004', 'The photos look amazing! Can we do a quick engagement shoot as well? What would that cost?', FALSE, NOW() - INTERVAL '2 days');

-- =============================================================================
-- 12. NOTIFICATIONS
-- =============================================================================

INSERT INTO public.notifications (user_id, type, title, body, data, is_read, created_at)
VALUES
  ('cc000000-0000-0000-0000-000000000001', 'response_received',   'New quote on your post',          'Kgosi Plumbing quoted P350 for "Kitchen sink is leaking badly".',      '{"post_id":"10000000-0000-0000-0000-000000000001"}', TRUE,  NOW() - INTERVAL '1 day'),
  ('cc000000-0000-0000-0000-000000000001', 'response_received',   'New quote on your post',          'Naledi Sparkle Cleaning quoted P650 for "Deep clean before house party".', '{"post_id":"10000000-0000-0000-0000-000000000002"}', FALSE, NOW() - INTERVAL '12 hours'),
  ('cc000000-0000-0000-0000-000000000001', 'booking_completed',   'Booking completed',               'Your plumbing repair with Kgosi Plumbing has been completed.',         '{"booking_id":"bb000000-0000-0000-0000-000000000001"}', TRUE, NOW() - INTERVAL '10 days'),
  ('cc000000-0000-0000-0000-000000000002', 'response_received',   'New quote on your post',          'Thabo Electrical quoted P800 for "Power keeps tripping in my house".', '{"post_id":"10000000-0000-0000-0000-000000000003"}', TRUE,  NOW() - INTERVAL '2 days'),
  ('cc000000-0000-0000-0000-000000000002', 'booking_completed',   'Booking completed',               'Your electrical upgrade with Thabo Electrical has been completed.',    '{"booking_id":"bb000000-0000-0000-0000-000000000002"}', TRUE, NOW() - INTERVAL '7 days'),
  ('cc000000-0000-0000-0000-000000000003', 'response_received',   'New quote on your post',          'Lesego Lens Photography quoted P5500 for your wedding.',              '{"post_id":"10000000-0000-0000-0000-000000000005"}', FALSE, NOW() - INTERVAL '3 days'),
  ('dd000000-0000-0000-0000-000000000001', 'new_post',            'New job near you',                'Mpho Kgosi posted "Kitchen sink is leaking badly" in Gaborone.',      '{"post_id":"10000000-0000-0000-0000-000000000001"}', TRUE,  NOW() - INTERVAL '2 days'),
  ('dd000000-0000-0000-0000-000000000001', 'booking_confirmed',   'Booking confirmed',               'Mpho Kgosi confirmed your plumbing repair booking.',                  '{"booking_id":"bb000000-0000-0000-0000-000000000001"}', TRUE, NOW() - INTERVAL '12 days'),
  ('dd000000-0000-0000-0000-000000000001', 'new_review',          'New review received',             'Mpho Kgosi left you a 5-star review!',                                '{"booking_id":"bb000000-0000-0000-0000-000000000001"}', FALSE, NOW() - INTERVAL '9 days'),
  ('dd000000-0000-0000-0000-000000000002', 'booking_confirmed',   'Booking confirmed',               'Mpho Kgosi confirmed the deep clean booking for Saturday.',           '{"booking_id":"bb000000-0000-0000-0000-000000000003"}', TRUE, NOW() - INTERVAL '2 days'),
  ('dd000000-0000-0000-0000-000000000003', 'new_review',          'New review received',             'Keabetswe Molefe left you a 4-star review!',                          '{"booking_id":"bb000000-0000-0000-0000-000000000002"}', FALSE, NOW() - INTERVAL '6 days'),
  ('dd000000-0000-0000-0000-000000000004', 'new_post',            'New job near you',                'Onkemetse Tau posted "Wedding photographer for December wedding" in Maun.', '{"post_id":"10000000-0000-0000-0000-000000000005"}', TRUE, NOW() - INTERVAL '4 days');
