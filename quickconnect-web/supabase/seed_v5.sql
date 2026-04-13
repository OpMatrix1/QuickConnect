-- =============================================================================
-- QuickConnect Seed v5 — Beta Presentation Data
-- Run AFTER seed.sql, seed_v4.sql, migration_v4.sql, migration_v5.sql
--
-- What this adds:
--   • 6 new customers (cc...004–009)
--   • 8 new providers  (dd...005–00c) across Beauty, Catering, Auto, Tutoring,
--       Gardening, Construction, IT, and Tiling
--   • 22 new services  (ff...012–033)
--   • 12 new looking-for posts
--   • 10 new quote responses
--   • 15 new bookings in varied states
--   • Payments (mobile money + wallet), reviews, conversations, messages,
--     wallet top-ups & withdrawals, notifications
--
-- UUID key:
--   Customers:    cc000000-0000-0000-0000-00000000000{4-9}
--   Providers:    dd000000-0000-0000-0000-0000000000{05-0c}
--   SP records:   ee000000-0000-0000-0000-0000000000{05-0c}
--   Services:     ff000000-0000-0000-0000-0000000000{12-33}
--   Posts:        10000000-0000-0000-0000-0000000000{07-12}
--   Responses:    ab000000-0000-0000-0000-0000000000{05-0e}
--   Bookings:     bb000000-0000-0000-0000-0000000000{11-1f}
--   Payments:     a2000000-0000-0000-0000-0000000000{01-0e}
--   Convos:       dc000000-0000-0000-0000-0000000000{05-0e}
--
-- All test accounts use password: Test1234!
-- =============================================================================

-- =============================================================================
-- 0. CLEANUP — remove any partial data from previous runs (fully idempotent)
-- =============================================================================

-- Conversations (must go before bookings due to FK)
DELETE FROM public.conversations WHERE id IN (
  'dc000000-0000-0000-0000-000000000005',
  'dc000000-0000-0000-0000-000000000006',
  'dc000000-0000-0000-0000-000000000007',
  'dc000000-0000-0000-0000-000000000008',
  'dc000000-0000-0000-0000-000000000009',
  'dc000000-0000-0000-0000-000000000010'
);

-- Payments (must go before bookings due to FK)
DELETE FROM public.payments WHERE id IN (
  'a2000000-0000-0000-0000-000000000001',
  'a2000000-0000-0000-0000-000000000002',
  'a2000000-0000-0000-0000-000000000003',
  'a2000000-0000-0000-0000-000000000004',
  'a2000000-0000-0000-0000-000000000005',
  'a2000000-0000-0000-0000-000000000006',
  'a2000000-0000-0000-0000-000000000007',
  'a2000000-0000-0000-0000-000000000008'
);

-- Reviews
DELETE FROM public.reviews WHERE booking_id IN (
  'bb000000-0000-0000-0000-000000000013',
  'bb000000-0000-0000-0000-000000000017',
  'bb000000-0000-0000-0000-000000000019',
  'bb000000-0000-0000-0000-000000000020',
  'bb000000-0000-0000-0000-000000000021',
  'bb000000-0000-0000-0000-000000000024'
);

-- Bookings (all 15 new ones, including those referencing existing customers)
DELETE FROM public.bookings WHERE id IN (
  'bb000000-0000-0000-0000-000000000011',
  'bb000000-0000-0000-0000-000000000012',
  'bb000000-0000-0000-0000-000000000013',
  'bb000000-0000-0000-0000-000000000014',
  'bb000000-0000-0000-0000-000000000015',
  'bb000000-0000-0000-0000-000000000016',
  'bb000000-0000-0000-0000-000000000017',
  'bb000000-0000-0000-0000-000000000018',
  'bb000000-0000-0000-0000-000000000019',
  'bb000000-0000-0000-0000-000000000020',
  'bb000000-0000-0000-0000-000000000021',
  'bb000000-0000-0000-0000-000000000022',
  'bb000000-0000-0000-0000-000000000023',
  'bb000000-0000-0000-0000-000000000024',
  'bb000000-0000-0000-0000-000000000025'
);

-- Looking-for responses
DELETE FROM public.looking_for_responses WHERE id IN (
  'ab000000-0000-0000-0000-000000000005',
  'ab000000-0000-0000-0000-000000000006',
  'ab000000-0000-0000-0000-000000000007',
  'ab000000-0000-0000-0000-000000000008',
  'ab000000-0000-0000-0000-000000000009',
  'ab000000-0000-0000-0000-000000000010',
  'ab000000-0000-0000-0000-000000000011',
  'ab000000-0000-0000-0000-000000000012'
);

-- Looking-for posts (those posted by new customers AND existing customers)
DELETE FROM public.looking_for_posts WHERE id IN (
  '10000000-0000-0000-0000-000000000007',
  '10000000-0000-0000-0000-000000000008',
  '10000000-0000-0000-0000-000000000009',
  '10000000-0000-0000-0000-000000000010',
  '10000000-0000-0000-0000-000000000011',
  '10000000-0000-0000-0000-000000000012',
  '10000000-0000-0000-0000-000000000013',
  '10000000-0000-0000-0000-000000000014'
);

-- Service providers by profile_id (cascades to services & service_areas)
DELETE FROM public.service_providers WHERE profile_id IN (
  'dd000000-0000-0000-0000-000000000005',
  'dd000000-0000-0000-0000-000000000006',
  'dd000000-0000-0000-0000-000000000007',
  'dd000000-0000-0000-0000-000000000008',
  'dd000000-0000-0000-0000-000000000009',
  'dd000000-0000-0000-0000-00000000000a',
  'dd000000-0000-0000-0000-00000000000b',
  'dd000000-0000-0000-0000-00000000000c'
);

-- New users (cascades to profiles, wallets, notifications, etc.)
DELETE FROM auth.users WHERE id IN (
  'cc000000-0000-0000-0000-000000000004',
  'cc000000-0000-0000-0000-000000000005',
  'cc000000-0000-0000-0000-000000000006',
  'cc000000-0000-0000-0000-000000000007',
  'cc000000-0000-0000-0000-000000000008',
  'cc000000-0000-0000-0000-000000000009',
  'dd000000-0000-0000-0000-000000000005',
  'dd000000-0000-0000-0000-000000000006',
  'dd000000-0000-0000-0000-000000000007',
  'dd000000-0000-0000-0000-000000000008',
  'dd000000-0000-0000-0000-000000000009',
  'dd000000-0000-0000-0000-00000000000a',
  'dd000000-0000-0000-0000-00000000000b',
  'dd000000-0000-0000-0000-00000000000c'
);

-- =============================================================================
-- 1. AUTH USERS
-- =============================================================================

-- New customers
INSERT INTO auth.users (instance_id, id, aud, role, email, encrypted_password, email_confirmed_at, raw_app_meta_data, raw_user_meta_data, created_at, updated_at, confirmation_token, email_change, email_change_token_new, recovery_token)
VALUES
  ('00000000-0000-0000-0000-000000000000', 'cc000000-0000-0000-0000-000000000004', 'authenticated', 'authenticated', 'tshepho.sithole@gmail.com',    crypt('Test1234!', gen_salt('bf')), NOW(), '{"provider":"email","providers":["email"]}', '{"full_name":"Tshepho Sithole","role":"customer"}',       NOW() - INTERVAL '50 days', NOW(), '', '', '', ''),
  ('00000000-0000-0000-0000-000000000000', 'cc000000-0000-0000-0000-000000000005', 'authenticated', 'authenticated', 'boitumelo.dube@gmail.com',      crypt('Test1234!', gen_salt('bf')), NOW(), '{"provider":"email","providers":["email"]}', '{"full_name":"Boitumelo Dube","role":"customer"}',        NOW() - INTERVAL '42 days', NOW(), '', '', '', ''),
  ('00000000-0000-0000-0000-000000000000', 'cc000000-0000-0000-0000-000000000006', 'authenticated', 'authenticated', 'goitseone.moitoi@outlook.com',  crypt('Test1234!', gen_salt('bf')), NOW(), '{"provider":"email","providers":["email"]}', '{"full_name":"Goitseone Moitoi","role":"customer"}',      NOW() - INTERVAL '35 days', NOW(), '', '', '', ''),
  ('00000000-0000-0000-0000-000000000000', 'cc000000-0000-0000-0000-000000000007', 'authenticated', 'authenticated', 'kagiso.nkosi@yahoo.com',        crypt('Test1234!', gen_salt('bf')), NOW(), '{"provider":"email","providers":["email"]}', '{"full_name":"Kagiso Nkosi","role":"customer"}',          NOW() - INTERVAL '28 days', NOW(), '', '', '', ''),
  ('00000000-0000-0000-0000-000000000000', 'cc000000-0000-0000-0000-000000000008', 'authenticated', 'authenticated', 'sethunya.motswagole@gmail.com', crypt('Test1234!', gen_salt('bf')), NOW(), '{"provider":"email","providers":["email"]}', '{"full_name":"Sethunya Motswagole","role":"customer"}',   NOW() - INTERVAL '20 days', NOW(), '', '', '', ''),
  ('00000000-0000-0000-0000-000000000000', 'cc000000-0000-0000-0000-000000000009', 'authenticated', 'authenticated', 'ntombi.radebe@gmail.com',       crypt('Test1234!', gen_salt('bf')), NOW(), '{"provider":"email","providers":["email"]}', '{"full_name":"Ntombi Radebe","role":"customer"}',         NOW() - INTERVAL '14 days', NOW(), '', '', '', '')
;

-- New providers
INSERT INTO auth.users (instance_id, id, aud, role, email, encrypted_password, email_confirmed_at, raw_app_meta_data, raw_user_meta_data, created_at, updated_at, confirmation_token, email_change, email_change_token_new, recovery_token)
VALUES
  ('00000000-0000-0000-0000-000000000000', 'dd000000-0000-0000-0000-000000000005', 'authenticated', 'authenticated', 'mothusi.beauty@gmail.com',     crypt('Test1234!', gen_salt('bf')), NOW(), '{"provider":"email","providers":["email"]}', '{"full_name":"Mothusi Dintwe","role":"provider"}',         NOW() - INTERVAL '65 days', NOW(), '', '', '', ''),
  ('00000000-0000-0000-0000-000000000000', 'dd000000-0000-0000-0000-000000000006', 'authenticated', 'authenticated', 'kefilwe.catering@gmail.com',    crypt('Test1234!', gen_salt('bf')), NOW(), '{"provider":"email","providers":["email"]}', '{"full_name":"Kefilwe Ramotswe","role":"provider"}',       NOW() - INTERVAL '58 days', NOW(), '', '', '', ''),
  ('00000000-0000-0000-0000-000000000000', 'dd000000-0000-0000-0000-000000000007', 'authenticated', 'authenticated', 'bakang.motors@gmail.com',       crypt('Test1234!', gen_salt('bf')), NOW(), '{"provider":"email","providers":["email"]}', '{"full_name":"Bakang Segwagwa","role":"provider"}',        NOW() - INTERVAL '52 days', NOW(), '', '', '', ''),
  ('00000000-0000-0000-0000-000000000000', 'dd000000-0000-0000-0000-000000000008', 'authenticated', 'authenticated', 'oarabile.tutors@gmail.com',     crypt('Test1234!', gen_salt('bf')), NOW(), '{"provider":"email","providers":["email"]}', '{"full_name":"Oarabile Moeng","role":"provider"}',         NOW() - INTERVAL '46 days', NOW(), '', '', '', ''),
  ('00000000-0000-0000-0000-000000000000', 'dd000000-0000-0000-0000-000000000009', 'authenticated', 'authenticated', 'dineo.gardens@gmail.com',       crypt('Test1234!', gen_salt('bf')), NOW(), '{"provider":"email","providers":["email"]}', '{"full_name":"Dineo Seretse","role":"provider"}',          NOW() - INTERVAL '40 days', NOW(), '', '', '', ''),
  ('00000000-0000-0000-0000-000000000000', 'dd000000-0000-0000-0000-00000000000a', 'authenticated', 'authenticated', 'thato.builds@gmail.com',        crypt('Test1234!', gen_salt('bf')), NOW(), '{"provider":"email","providers":["email"]}', '{"full_name":"Thato Molutsi","role":"provider"}',          NOW() - INTERVAL '72 days', NOW(), '', '', '', ''),
  ('00000000-0000-0000-0000-000000000000', 'dd000000-0000-0000-0000-00000000000b', 'authenticated', 'authenticated', 'gaone.techfix@gmail.com',       crypt('Test1234!', gen_salt('bf')), NOW(), '{"provider":"email","providers":["email"]}', '{"full_name":"Gaone Moalosi","role":"provider"}',          NOW() - INTERVAL '38 days', NOW(), '', '', '', ''),
  ('00000000-0000-0000-0000-000000000000', 'dd000000-0000-0000-0000-00000000000c', 'authenticated', 'authenticated', 'koketso.tiles@gmail.com',       crypt('Test1234!', gen_salt('bf')), NOW(), '{"provider":"email","providers":["email"]}', '{"full_name":"Koketso Phiri","role":"provider"}',          NOW() - INTERVAL '44 days', NOW(), '', '', '', '')
;

-- Auth identities
INSERT INTO auth.identities (id, user_id, identity_data, provider, provider_id, last_sign_in_at, created_at, updated_at)
VALUES
  ('cc000000-0000-0000-0000-000000000004', 'cc000000-0000-0000-0000-000000000004', '{"sub":"cc000000-0000-0000-0000-000000000004","email":"tshepho.sithole@gmail.com"}',    'email', 'tshepho.sithole@gmail.com',    NOW(), NOW() - INTERVAL '50 days', NOW()),
  ('cc000000-0000-0000-0000-000000000005', 'cc000000-0000-0000-0000-000000000005', '{"sub":"cc000000-0000-0000-0000-000000000005","email":"boitumelo.dube@gmail.com"}',      'email', 'boitumelo.dube@gmail.com',      NOW(), NOW() - INTERVAL '42 days', NOW()),
  ('cc000000-0000-0000-0000-000000000006', 'cc000000-0000-0000-0000-000000000006', '{"sub":"cc000000-0000-0000-0000-000000000006","email":"goitseone.moitoi@outlook.com"}',  'email', 'goitseone.moitoi@outlook.com',  NOW(), NOW() - INTERVAL '35 days', NOW()),
  ('cc000000-0000-0000-0000-000000000007', 'cc000000-0000-0000-0000-000000000007', '{"sub":"cc000000-0000-0000-0000-000000000007","email":"kagiso.nkosi@yahoo.com"}',        'email', 'kagiso.nkosi@yahoo.com',        NOW(), NOW() - INTERVAL '28 days', NOW()),
  ('cc000000-0000-0000-0000-000000000008', 'cc000000-0000-0000-0000-000000000008', '{"sub":"cc000000-0000-0000-0000-000000000008","email":"sethunya.motswagole@gmail.com"}', 'email', 'sethunya.motswagole@gmail.com', NOW(), NOW() - INTERVAL '20 days', NOW()),
  ('cc000000-0000-0000-0000-000000000009', 'cc000000-0000-0000-0000-000000000009', '{"sub":"cc000000-0000-0000-0000-000000000009","email":"ntombi.radebe@gmail.com"}',       'email', 'ntombi.radebe@gmail.com',       NOW(), NOW() - INTERVAL '14 days', NOW()),
  ('dd000000-0000-0000-0000-000000000005', 'dd000000-0000-0000-0000-000000000005', '{"sub":"dd000000-0000-0000-0000-000000000005","email":"mothusi.beauty@gmail.com"}',     'email', 'mothusi.beauty@gmail.com',     NOW(), NOW() - INTERVAL '65 days', NOW()),
  ('dd000000-0000-0000-0000-000000000006', 'dd000000-0000-0000-0000-000000000006', '{"sub":"dd000000-0000-0000-0000-000000000006","email":"kefilwe.catering@gmail.com"}',    'email', 'kefilwe.catering@gmail.com',    NOW(), NOW() - INTERVAL '58 days', NOW()),
  ('dd000000-0000-0000-0000-000000000007', 'dd000000-0000-0000-0000-000000000007', '{"sub":"dd000000-0000-0000-0000-000000000007","email":"bakang.motors@gmail.com"}',       'email', 'bakang.motors@gmail.com',       NOW(), NOW() - INTERVAL '52 days', NOW()),
  ('dd000000-0000-0000-0000-000000000008', 'dd000000-0000-0000-0000-000000000008', '{"sub":"dd000000-0000-0000-0000-000000000008","email":"oarabile.tutors@gmail.com"}',     'email', 'oarabile.tutors@gmail.com',     NOW(), NOW() - INTERVAL '46 days', NOW()),
  ('dd000000-0000-0000-0000-000000000009', 'dd000000-0000-0000-0000-000000000009', '{"sub":"dd000000-0000-0000-0000-000000000009","email":"dineo.gardens@gmail.com"}',       'email', 'dineo.gardens@gmail.com',       NOW(), NOW() - INTERVAL '40 days', NOW()),
  ('dd000000-0000-0000-0000-00000000000a', 'dd000000-0000-0000-0000-00000000000a', '{"sub":"dd000000-0000-0000-0000-00000000000a","email":"thato.builds@gmail.com"}',        'email', 'thato.builds@gmail.com',        NOW(), NOW() - INTERVAL '72 days', NOW()),
  ('dd000000-0000-0000-0000-00000000000b', 'dd000000-0000-0000-0000-00000000000b', '{"sub":"dd000000-0000-0000-0000-00000000000b","email":"gaone.techfix@gmail.com"}',       'email', 'gaone.techfix@gmail.com',       NOW(), NOW() - INTERVAL '38 days', NOW()),
  ('dd000000-0000-0000-0000-00000000000c', 'dd000000-0000-0000-0000-00000000000c', '{"sub":"dd000000-0000-0000-0000-00000000000c","email":"koketso.tiles@gmail.com"}',       'email', 'koketso.tiles@gmail.com',       NOW(), NOW() - INTERVAL '44 days', NOW())
ON CONFLICT (provider, provider_id) DO NOTHING;


-- =============================================================================
-- 2. ENRICH PROFILES
-- =============================================================================

-- New customers
UPDATE public.profiles SET phone = '+267 72 401 100', city = 'Gaborone',
  bio = 'Interior design enthusiast. Always keeping my home looking its best.',
  email_verified = TRUE WHERE id = 'cc000000-0000-0000-0000-000000000004';

UPDATE public.profiles SET phone = '+267 74 502 200', city = 'Gaborone',
  bio = 'Mom of three. Love supporting local businesses and services.',
  email_verified = TRUE WHERE id = 'cc000000-0000-0000-0000-000000000005';

UPDATE public.profiles SET phone = '+267 76 603 300', city = 'Serowe',
  bio = 'Business owner in Serowe. Need reliable services I can count on.',
  email_verified = TRUE WHERE id = 'cc000000-0000-0000-0000-000000000006';

UPDATE public.profiles SET phone = '+267 71 704 400', city = 'Francistown',
  bio = 'Property manager overseeing several rental units. Always needing maintenance.',
  email_verified = TRUE WHERE id = 'cc000000-0000-0000-0000-000000000007';

UPDATE public.profiles SET phone = '+267 77 805 500', city = 'Gaborone',
  bio = 'Young professional in Gaborone. Just moved into my first home.',
  email_verified = TRUE WHERE id = 'cc000000-0000-0000-0000-000000000008';

UPDATE public.profiles SET phone = '+267 73 906 600', city = 'Lobatse',
  bio = 'Retired teacher, now running a small guesthouse in Lobatse.',
  email_verified = TRUE WHERE id = 'cc000000-0000-0000-0000-000000000009';

-- New providers
UPDATE public.profiles SET phone = '+267 74 111 501', city = 'Gaborone',
  bio = 'Certified hair stylist and beauty therapist with 8 years of experience. I bring the salon to you.',
  email_verified = TRUE WHERE id = 'dd000000-0000-0000-0000-000000000005';

UPDATE public.profiles SET phone = '+267 72 222 602', city = 'Gaborone',
  bio = 'Professional caterer with over 10 years feeding Botswana — from intimate dinners to weddings of 500.',
  email_verified = TRUE WHERE id = 'dd000000-0000-0000-0000-000000000006';

UPDATE public.profiles SET phone = '+267 76 333 703', city = 'Francistown',
  bio = 'Qualified mechanic. Specialising in Toyota, Mazda, and Ford vehicles. Honest pricing guaranteed.',
  email_verified = TRUE WHERE id = 'dd000000-0000-0000-0000-000000000007';

UPDATE public.profiles SET phone = '+267 77 444 804', city = 'Gaborone',
  bio = 'Maths & Science teacher with 5 years of BGCSE tutoring experience. 90%+ pass rate.',
  email_verified = TRUE WHERE id = 'dd000000-0000-0000-0000-000000000008';

UPDATE public.profiles SET phone = '+267 71 555 905', city = 'Gaborone',
  bio = 'Landscape designer and horticulturist. Transforming Gaborone gardens since 2015.',
  email_verified = TRUE WHERE id = 'dd000000-0000-0000-0000-000000000009';

UPDATE public.profiles SET phone = '+267 73 666 006', city = 'Gaborone',
  bio = 'Experienced building contractor. Quality renovations, paving, and construction work across Gaborone.',
  email_verified = TRUE WHERE id = 'dd000000-0000-0000-0000-00000000000a';

UPDATE public.profiles SET phone = '+267 75 777 107', city = 'Gaborone',
  bio = 'IT specialist and CCTV installer. Fast, reliable, and affordable tech support for homes and businesses.',
  email_verified = TRUE WHERE id = 'dd000000-0000-0000-0000-00000000000b';

UPDATE public.profiles SET phone = '+267 74 888 208', city = 'Francistown',
  bio = 'Professional tiler with 11 years of experience. Floors, bathrooms, kitchens — no job too small.',
  email_verified = TRUE WHERE id = 'dd000000-0000-0000-0000-00000000000c';

-- =============================================================================
-- 3. SERVICE PROVIDERS
-- =============================================================================

-- Re-delete service_providers here in case a trigger auto-created bare records
-- when the provider auth.users rows were inserted above.
DELETE FROM public.service_providers WHERE profile_id IN (
  'dd000000-0000-0000-0000-000000000005',
  'dd000000-0000-0000-0000-000000000006',
  'dd000000-0000-0000-0000-000000000007',
  'dd000000-0000-0000-0000-000000000008',
  'dd000000-0000-0000-0000-000000000009',
  'dd000000-0000-0000-0000-00000000000a',
  'dd000000-0000-0000-0000-00000000000b',
  'dd000000-0000-0000-0000-00000000000c'
);

INSERT INTO public.service_providers (id, profile_id, business_name, description, rating_avg, review_count, response_time_avg, completion_rate, is_verified)
VALUES
  ('ee000000-0000-0000-0000-000000000005', 'dd000000-0000-0000-0000-000000000005',
   'Mothusi Beauty Studio',
   'Mobile beauty studio serving Gaborone. Hair braiding, styling, manicures, pedicures, and bridal packages. We come to you.',
   4.80, 14, 20, 98.00, TRUE),

  ('ee000000-0000-0000-0000-000000000006', 'dd000000-0000-0000-0000-000000000006',
   'Kefilwe''s Kitchen & Catering',
   'Award-winning catering for all occasions. Authentic Setswana and international cuisine. Minimum 10 guests.',
   4.90, 22, 30, 100.00, TRUE),

  ('ee000000-0000-0000-0000-000000000007', 'dd000000-0000-0000-0000-000000000007',
   'Bakang Auto Solutions',
   'Full-service auto repair in Francistown. Servicing, brakes, tyres, and AC. Same-day service available.',
   4.60, 18, 40, 94.00, TRUE),

  ('ee000000-0000-0000-0000-000000000008', 'dd000000-0000-0000-0000-000000000008',
   'Oarabile Tutoring Services',
   'BGCSE and JC Maths, Science & English tutoring. Individual and small group sessions available in Gaborone.',
   4.95, 31, 10, 100.00, TRUE),

  ('ee000000-0000-0000-0000-000000000009', 'dd000000-0000-0000-0000-000000000009',
   'Dineo Green Gardens',
   'Full garden services: design, maintenance, irrigation systems, and tree trimming across greater Gaborone.',
   4.70, 9, 25, 96.00, FALSE),

  ('ee000000-0000-0000-0000-00000000000a', 'dd000000-0000-0000-0000-00000000000a',
   'Thato Construction & Renovations',
   'Quality home renovations, extensions, paving, and plastering. Licensed contractor with 15 years of experience.',
   4.55, 11, 60, 91.00, TRUE),

  ('ee000000-0000-0000-0000-00000000000b', 'dd000000-0000-0000-0000-00000000000b',
   'Gaone TechFix',
   'Computer repairs, IT support, home networking, and CCTV installation. Fast turnaround. Gaborone CBD & suburbs.',
   4.75, 27, 15, 97.00, TRUE),

  ('ee000000-0000-0000-0000-00000000000c', 'dd000000-0000-0000-0000-00000000000c',
   'Koketso Premium Tiling',
   'Expert tiling for floors, bathrooms, and kitchens. Waterproofing and grouting specialists. Serving Francistown.',
   4.85, 16, 35, 99.00, TRUE)
;

-- =============================================================================
-- 4. SERVICES
-- =============================================================================

INSERT INTO public.services (id, provider_id, category_id, title, description, price_min, price_max, price_type, is_active)
VALUES
  -- Mothusi Beauty Studio
  ('ff000000-0000-0000-0000-000000000012', 'ee000000-0000-0000-0000-000000000005',
   (SELECT id FROM public.service_categories WHERE name = 'Beauty & Salon'),
   'Hair Braiding & Styling', 'Box braids, cornrows, twists, blow-dries, and natural hair styling at your location.', 150.00, 600.00, 'fixed', TRUE),

  ('ff000000-0000-0000-0000-000000000013', 'ee000000-0000-0000-0000-000000000005',
   (SELECT id FROM public.service_categories WHERE name = 'Beauty & Salon'),
   'Manicure & Pedicure', 'Classic and gel manicures and pedicures with premium products. Nail art available.', 80.00, 200.00, 'fixed', TRUE),

  ('ff000000-0000-0000-0000-000000000014', 'ee000000-0000-0000-0000-000000000005',
   (SELECT id FROM public.service_categories WHERE name = 'Beauty & Salon'),
   'Bridal Hair & Makeup', 'Complete bridal package: trial session, wedding-day hair and makeup for bride and bridal party.', 1200.00, 4000.00, 'quote', TRUE),

  -- Kefilwe Catering
  ('ff000000-0000-0000-0000-000000000015', 'ee000000-0000-0000-0000-000000000006',
   (SELECT id FROM public.service_categories WHERE name = 'Catering'),
   'Small Event Catering (10–50 guests)', 'Full catering service for intimate events — setup, serving, and cleanup included.', 1500.00, 5000.00, 'quote', TRUE),

  ('ff000000-0000-0000-0000-000000000016', 'ee000000-0000-0000-0000-000000000006',
   (SELECT id FROM public.service_categories WHERE name = 'Catering'),
   'Wedding & Large Event Catering', 'Full catering for 50–500 guests. Menu planning, staffing, and equipment hire included.', 8000.00, 50000.00, 'quote', TRUE),

  ('ff000000-0000-0000-0000-000000000017', 'ee000000-0000-0000-0000-000000000006',
   (SELECT id FROM public.service_categories WHERE name = 'Catering'),
   'Weekly Meal Prep', 'Healthy home-cooked meals prepared at your home or delivered weekly. Min 5 day plan.', 800.00, 2000.00, 'fixed', TRUE),

  -- Bakang Auto
  ('ff000000-0000-0000-0000-000000000018', 'ee000000-0000-0000-0000-000000000007',
   (SELECT id FROM public.service_categories WHERE name = 'Auto Repair & Mechanic'),
   'Full Car Service', 'Oil, filter, spark plugs, belts, brakes check, and full vehicle inspection.', 350.00, 900.00, 'fixed', TRUE),

  ('ff000000-0000-0000-0000-000000000019', 'ee000000-0000-0000-0000-000000000007',
   (SELECT id FROM public.service_categories WHERE name = 'Auto Repair & Mechanic'),
   'Tyre Change & Wheel Balancing', 'All four tyres changed and balanced. Tyre disposal included.', 100.00, 250.00, 'fixed', TRUE),

  ('ff000000-0000-0000-0000-000000000020', 'ee000000-0000-0000-0000-000000000007',
   (SELECT id FROM public.service_categories WHERE name = 'Auto Repair & Mechanic'),
   'AC Regas & Repair', 'Air conditioning regas, leak testing, and compressor repairs.', 250.00, 1200.00, 'fixed', TRUE),

  -- Oarabile Tutoring
  ('ff000000-0000-0000-0000-000000000021', 'ee000000-0000-0000-0000-000000000008',
   (SELECT id FROM public.service_categories WHERE name = 'Tutoring & Education'),
   'Maths Tutoring (BGCSE / JC)', 'One-on-one or small group maths tutoring for JC and BGCSE students. Gaborone & online.', 80.00, 150.00, 'hourly', TRUE),

  ('ff000000-0000-0000-0000-000000000022', 'ee000000-0000-0000-0000-000000000008',
   (SELECT id FROM public.service_categories WHERE name = 'Tutoring & Education'),
   'Science Tutoring (Physics, Chemistry, Biology)', 'All three sciences covered at JC and BGCSE level. Past paper practice included.', 80.00, 150.00, 'hourly', TRUE),

  ('ff000000-0000-0000-0000-000000000023', 'ee000000-0000-0000-0000-000000000008',
   (SELECT id FROM public.service_categories WHERE name = 'Tutoring & Education'),
   'English Language & Comprehension', 'Grammar, composition, comprehension, and exam technique for all levels.', 70.00, 120.00, 'hourly', TRUE),

  -- Dineo Gardening
  ('ff000000-0000-0000-0000-000000000024', 'ee000000-0000-0000-0000-000000000009',
   (SELECT id FROM public.service_categories WHERE name = 'Gardening & Landscaping'),
   'Regular Garden Maintenance', 'Monthly or bi-weekly garden upkeep: trimming, weeding, watering, and general tidying.', 250.00, 600.00, 'fixed', TRUE),

  ('ff000000-0000-0000-0000-000000000025', 'ee000000-0000-0000-0000-000000000009',
   (SELECT id FROM public.service_categories WHERE name = 'Gardening & Landscaping'),
   'Landscaping & Garden Design', 'Complete garden redesign, plant sourcing, and landscape construction.', 1500.00, 15000.00, 'quote', TRUE),

  ('ff000000-0000-0000-0000-000000000026', 'ee000000-0000-0000-0000-000000000009',
   (SELECT id FROM public.service_categories WHERE name = 'Gardening & Landscaping'),
   'Lawn Mowing & Edging', 'Neat lawn mowing and border edging for any size yard. Same-week availability.', 150.00, 400.00, 'fixed', TRUE),

  -- Thato Construction
  ('ff000000-0000-0000-0000-000000000027', 'ee000000-0000-0000-0000-00000000000a',
   (SELECT id FROM public.service_categories WHERE name = 'Construction'),
   'Home Renovations & Extensions', 'Structural extensions, room additions, and full interior renovations.', 5000.00, 200000.00, 'quote', TRUE),

  ('ff000000-0000-0000-0000-000000000028', 'ee000000-0000-0000-0000-00000000000a',
   (SELECT id FROM public.service_categories WHERE name = 'Construction'),
   'Brick Paving & Patios', 'Driveway paving, garden paths, and outdoor entertainment areas.', 2000.00, 30000.00, 'quote', TRUE),

  ('ff000000-0000-0000-0000-000000000029', 'ee000000-0000-0000-0000-00000000000a',
   (SELECT id FROM public.service_categories WHERE name = 'Construction'),
   'Plastering & Screeding', 'Interior and exterior plastering, floor screeding, and surface preparation.', 800.00, 8000.00, 'quote', TRUE),

  -- Gaone IT
  ('ff000000-0000-0000-0000-000000000030', 'ee000000-0000-0000-0000-00000000000b',
   (SELECT id FROM public.service_categories WHERE name = 'IT & Computer Repair'),
   'Computer Repair & Virus Removal', 'Hardware repairs, software fixes, virus removal, and data recovery.', 150.00, 600.00, 'fixed', TRUE),

  ('ff000000-0000-0000-0000-000000000031', 'ee000000-0000-0000-0000-00000000000b',
   (SELECT id FROM public.service_categories WHERE name = 'IT & Computer Repair'),
   'Home & Office Network Setup', 'Wi-Fi setup, router configuration, network cabling, and printer connectivity.', 200.00, 800.00, 'fixed', TRUE),

  ('ff000000-0000-0000-0000-000000000032', 'ee000000-0000-0000-0000-00000000000b',
   (SELECT id FROM public.service_categories WHERE name = 'Security Services'),
   'CCTV Installation & Setup', 'HD camera installation, DVR/NVR setup, remote viewing, and cabling.', 800.00, 5000.00, 'quote', TRUE),

  -- Koketso Tiling
  ('ff000000-0000-0000-0000-000000000033', 'ee000000-0000-0000-0000-00000000000c',
   (SELECT id FROM public.service_categories WHERE name = 'Tiling'),
   'Floor Tiling', 'Ceramic, porcelain, and natural stone floor tiling with precision finishing and grouting.', 400.00, 8000.00, 'quote', TRUE),

  ('ff000000-0000-0000-0000-000000000034', 'ee000000-0000-0000-0000-00000000000c',
   (SELECT id FROM public.service_categories WHERE name = 'Tiling'),
   'Bathroom & Kitchen Wall Tiling', 'Waterproof wall tiling for bathrooms, showers, and kitchen splashbacks.', 500.00, 6000.00, 'quote', TRUE)
;

-- =============================================================================
-- 5. SERVICE AREAS
-- =============================================================================

INSERT INTO public.service_areas (provider_id, city, area_name, radius_km)
VALUES
  ('ee000000-0000-0000-0000-000000000005', 'Gaborone',    'Greater Gaborone',           30.00),
  ('ee000000-0000-0000-0000-000000000005', 'Molepolole',  'Molepolole',                 10.00),
  ('ee000000-0000-0000-0000-000000000006', 'Gaborone',    'Gaborone & Surrounding',     40.00),
  ('ee000000-0000-0000-0000-000000000006', 'Lobatse',     'Lobatse',                    20.00),
  ('ee000000-0000-0000-0000-000000000007', 'Francistown', 'Francistown & Surrounds',    30.00),
  ('ee000000-0000-0000-0000-000000000007', 'Palapye',     'Palapye',                    15.00),
  ('ee000000-0000-0000-0000-000000000008', 'Gaborone',    'Gaborone CBD & Suburbs',     25.00),
  ('ee000000-0000-0000-0000-000000000009', 'Gaborone',    'Gaborone & Phakalane',       35.00),
  ('ee000000-0000-0000-0000-000000000009', 'Tlokweng',    'Tlokweng',                   10.00),
  ('ee000000-0000-0000-0000-00000000000a', 'Gaborone',    'All Gaborone Areas',         40.00),
  ('ee000000-0000-0000-0000-00000000000a', 'Mogoditshane','Mogoditshane & Gabane',      15.00),
  ('ee000000-0000-0000-0000-00000000000b', 'Gaborone',    'Gaborone',                   25.00),
  ('ee000000-0000-0000-0000-00000000000b', 'Tlokweng',    'Tlokweng',                   10.00),
  ('ee000000-0000-0000-0000-00000000000c', 'Francistown', 'Francistown',                20.00),
  ('ee000000-0000-0000-0000-00000000000c', 'Selebi-Phikwe','Selebi-Phikwe',             25.00)
;

-- =============================================================================
-- 6. LOOKING-FOR POSTS
-- =============================================================================

INSERT INTO public.looking_for_posts (id, customer_id, category_id, title, description, budget_min, budget_max, location_address, preferred_date, preferred_time, urgency, status, expires_at, created_at)
VALUES

  ('10000000-0000-0000-0000-000000000007',
   'cc000000-0000-0000-0000-000000000004',
   (SELECT id FROM public.service_categories WHERE name = 'Beauty & Salon'),
   'Bridal hair & makeup for November wedding',
   'Getting married on 15 November in Gaborone. Need a professional for bridal hair and makeup — myself and 3 bridesmaids. Prefer someone who comes to venue.',
   1500.00, 4000.00, 'Masa Centre, Gaborone', NOW()::date + INTERVAL '45 days', '06:00', 'medium', 'active',
   NOW() + INTERVAL '30 days', NOW() - INTERVAL '3 days'),

  ('10000000-0000-0000-0000-000000000008',
   'cc000000-0000-0000-0000-000000000005',
   (SELECT id FROM public.service_categories WHERE name = 'Catering'),
   'Caterer needed for 60-person birthday party',
   'Planning a 60th birthday celebration for my mother in 3 weeks. Need full catering with Setswana food — seswaa, morogo, diphaphata. Will provide venue.',
   3000.00, 7000.00, 'Phakalane, Gaborone', NOW()::date + INTERVAL '21 days', '12:00', 'medium', 'active',
   NOW() + INTERVAL '21 days', NOW() - INTERVAL '2 days'),

  ('10000000-0000-0000-0000-000000000009',
   'cc000000-0000-0000-0000-000000000006',
   (SELECT id FROM public.service_categories WHERE name = 'Auto Repair & Mechanic'),
   'Toyota Hilux needs full service — Serowe',
   'My 2018 Toyota Hilux double cab is due for a 60,000 km service. Needs oil, filters, and full inspection. I am in Serowe but can bring it to Francistown if needed.',
   400.00, 800.00, 'Serowe / Francistown', NOW()::date + INTERVAL '7 days', '08:00', 'medium', 'active',
   NOW() + INTERVAL '14 days', NOW() - INTERVAL '4 days'),

  ('10000000-0000-0000-0000-000000000010',
   'cc000000-0000-0000-0000-000000000007',
   (SELECT id FROM public.service_categories WHERE name = 'Tutoring & Education'),
   'BGCSE Maths tutor needed urgently',
   'My daughter is writing BGCSE in October and really struggling with Maths — specifically calculus and statistics. Need someone 3 times a week from now until exams.',
   90.00, 150.00, 'Francistown', NOW()::date + INTERVAL '2 days', '15:00', 'high', 'active',
   NOW() + INTERVAL '14 days', NOW() - INTERVAL '1 day'),

  ('10000000-0000-0000-0000-000000000011',
   'cc000000-0000-0000-0000-000000000008',
   (SELECT id FROM public.service_categories WHERE name = 'Gardening & Landscaping'),
   'New garden design for newly built home',
   'Just finished building my house in Tlokweng and the garden is bare soil. Looking for a landscaper to design and plant a full front and back garden. Budget flexible for the right design.',
   3000.00, 12000.00, 'Tlokweng, Gaborone', NOW()::date + INTERVAL '14 days', '08:00', 'low', 'active',
   NOW() + INTERVAL '45 days', NOW() - INTERVAL '2 days'),

  ('10000000-0000-0000-0000-000000000012',
   'cc000000-0000-0000-0000-000000000009',
   (SELECT id FROM public.service_categories WHERE name = 'Tiling'),
   'Bathroom retiling — 2 bathrooms, Lobatse',
   'Both bathrooms in my guesthouse need new tiles. The current ones are cracked and lifting. Total area roughly 25m². Need waterproofing as well.',
   2500.00, 6000.00, 'Lobatse', NOW()::date + INTERVAL '10 days', '07:00', 'medium', 'active',
   NOW() + INTERVAL '21 days', NOW() - INTERVAL '3 days'),

  -- Post from existing customer Mpho, new category
  ('10000000-0000-0000-0000-000000000013',
   'cc000000-0000-0000-0000-000000000001',
   (SELECT id FROM public.service_categories WHERE name = 'IT & Computer Repair'),
   'Home Wi-Fi keeps dropping — need IT help',
   'My home network in Gaborone West keeps disconnecting. I work from home and it is costing me clients. Have fibre but the Wi-Fi signal does not reach certain rooms.',
   200.00, 600.00, 'Gaborone West', NOW()::date + INTERVAL '2 days', '10:00', 'high', 'active',
   NOW() + INTERVAL '7 days', NOW() - INTERVAL '1 day'),

  -- Post from Keabetswe wanting construction
  ('10000000-0000-0000-0000-000000000014',
   'cc000000-0000-0000-0000-000000000002',
   (SELECT id FROM public.service_categories WHERE name = 'Construction'),
   'Driveway paving for 3-bedroom house',
   'Want to pave my driveway and add a small patio at the back. Driveway is about 50m², patio 20m². Looking for a reliable contractor with references.',
   5000.00, 15000.00, 'Monarch, Francistown', NOW()::date + INTERVAL '20 days', '08:00', 'low', 'active',
   NOW() + INTERVAL '30 days', NOW() - INTERVAL '5 days')
;

-- =============================================================================
-- 7. LOOKING-FOR RESPONSES
-- =============================================================================

INSERT INTO public.looking_for_responses (id, post_id, provider_id, quoted_price, message, estimated_duration, available_date, available_time, status, created_at)
VALUES
  -- Mothusi quotes on bridal post
  ('ab000000-0000-0000-0000-000000000005',
   '10000000-0000-0000-0000-000000000007', 'ee000000-0000-0000-0000-000000000005',
   2800.00,
   'Congratulations Tshepho! My bridal package covers a trial session a week before, plus full hair and makeup for you and 3 bridesmaids on the day. I travel to the venue with all my equipment. P2800 all-inclusive.',
   'Trial 2hrs + Wedding day 5hrs', NOW()::date + INTERVAL '40 days', '06:00', 'accepted',
   NOW() - INTERVAL '2 days'),

  -- Kefilwe quotes on birthday catering
  ('ab000000-0000-0000-0000-000000000006',
   '10000000-0000-0000-0000-000000000008', 'ee000000-0000-0000-0000-000000000006',
   4500.00,
   'Hello! We would love to cater your mother''s 60th. Our Setswana package for 60 guests includes seswaa, morogo wa molapo, diphaphata, samp, salads, and soft drinks. Setup and cleanup included. P4500 total.',
   '3 hours setup + full service', NOW()::date + INTERVAL '21 days', '10:00', 'pending',
   NOW() - INTERVAL '1 day'),

  -- Bakang quotes on Toyota Hilux service
  ('ab000000-0000-0000-0000-000000000007',
   '10000000-0000-0000-0000-000000000009', 'ee000000-0000-0000-0000-000000000007',
   650.00,
   'Hi! 60,000 km service on a Hilux is P650 with us — includes full synthetic oil, oil filter, air filter, fuel filter, spark plugs, brake inspection, and full report. We can book you in for next Tuesday.',
   '3-4 hours', NOW()::date + INTERVAL '6 days', '08:00', 'accepted',
   NOW() - INTERVAL '3 days'),

  -- Oarabile quotes on BGCSE maths tutoring
  ('ab000000-0000-0000-0000-000000000008',
   '10000000-0000-0000-0000-000000000010', 'ee000000-0000-0000-0000-000000000008',
   120.00,
   'Hello! I can definitely help. Calculus and stats are my strongest areas — I have helped many students turn a D into a B in 6 weeks. P120/hr, 3 sessions per week. Can start this Wednesday evening.',
   '1.5 hours per session', NOW()::date + INTERVAL '2 days', '15:30', 'accepted',
   NOW() - INTERVAL '12 hours'),

  -- Dineo quotes on garden design
  ('ab000000-0000-0000-0000-000000000009',
   '10000000-0000-0000-0000-000000000011', 'ee000000-0000-0000-0000-000000000009',
   8500.00,
   'Hi Sethunya! I would love to transform your new garden. For a full front and back design, planting, and irrigation setup on a standard plot I typically quote P7,500–P9,000. I can visit for a free site assessment first.',
   '5-7 working days', NOW()::date + INTERVAL '12 days', '08:00', 'pending',
   NOW() - INTERVAL '1 day'),

  -- Koketso quotes on bathroom tiling
  ('ab000000-0000-0000-0000-000000000010',
   '10000000-0000-0000-0000-000000000012', 'ee000000-0000-0000-0000-00000000000c',
   4200.00,
   'Hi Ntombi, 2 bathrooms (25m²) including waterproofing and premium grout finishing would be P4,200. I supply tiles from P85/m² or can work with your own tiles. Can start within 5 days.',
   '4-5 working days', NOW()::date + INTERVAL '8 days', '07:30', 'accepted',
   NOW() - INTERVAL '2 days'),

  -- Gaone quotes on Wi-Fi issue
  ('ab000000-0000-0000-0000-000000000011',
   '10000000-0000-0000-0000-000000000013', 'ee000000-0000-0000-0000-00000000000b',
   350.00,
   'Hi Mpho! Sounds like a signal coverage issue. I can assess your router placement, add a mesh node or Wi-Fi extender, and cable any dead zones. P350 covers assessment + configuration. Most fixes same day.',
   '2-3 hours', NOW()::date + INTERVAL '1 day', '10:00', 'accepted',
   NOW() - INTERVAL '6 hours'),

  -- Thato quotes on driveway paving
  ('ab000000-0000-0000-0000-000000000012',
   '10000000-0000-0000-0000-000000000014', 'ee000000-0000-0000-0000-00000000000a',
   9800.00,
   'Hello Keabetswe! 50m² driveway + 20m² patio in quality clay pavers would come to approximately P9,800 including base preparation, sand bedding, and edging. I can start in 2 weeks. Happy to share photos of recent work.',
   '5-6 working days', NOW()::date + INTERVAL '18 days', '07:00', 'pending',
   NOW() - INTERVAL '4 days')
;

-- =============================================================================
-- 8. BOOKINGS
-- =============================================================================

INSERT INTO public.bookings (id, customer_id, provider_id, service_id, looking_for_response_id, status, scheduled_date, scheduled_time, location_address, agreed_price, notes, created_at, updated_at)
VALUES

  -- bb11: Tshepho → Mothusi — bridal booking (confirmed, upcoming)
  ('bb000000-0000-0000-0000-000000000011',
   'cc000000-0000-0000-0000-000000000004', 'ee000000-0000-0000-0000-000000000005',
   'ff000000-0000-0000-0000-000000000014', 'ab000000-0000-0000-0000-000000000005',
   'confirmed', NOW()::date + INTERVAL '40 days', '06:00',
   'Masa Centre, Gaborone', 2800.00, 'Bride + 3 bridesmaids. Access to suite from 6am.',
   NOW() - INTERVAL '2 days', NOW() - INTERVAL '1 day'),

  -- bb12: Boitumelo → Kefilwe — birthday catering (confirmed, upcoming)
  ('bb000000-0000-0000-0000-000000000012',
   'cc000000-0000-0000-0000-000000000005', 'ee000000-0000-0000-0000-000000000006',
   'ff000000-0000-0000-0000-000000000015', 'ab000000-0000-0000-0000-000000000006',
   'confirmed', NOW()::date + INTERVAL '20 days', '10:00',
   'Phakalane, Gaborone', 4500.00, 'Setswana menu for 60 guests. Venue has a kitchen available.',
   NOW() - INTERVAL '1 day', NOW() - INTERVAL '1 day'),

  -- bb13: Goitseone → Bakang — Hilux service (completed)
  ('bb000000-0000-0000-0000-000000000013',
   'cc000000-0000-0000-0000-000000000006', 'ee000000-0000-0000-0000-000000000007',
   'ff000000-0000-0000-0000-000000000018', 'ab000000-0000-0000-0000-000000000007',
   'completed', (NOW() - INTERVAL '5 days')::date, '08:00',
   'Bakang Auto, Industrial, Francistown', 650.00, '60k service. Also found and replaced worn brake pads.',
   NOW() - INTERVAL '8 days', NOW() - INTERVAL '5 days'),

  -- bb14: Kagiso → Oarabile — maths tutoring (in_progress, ongoing sessions)
  ('bb000000-0000-0000-0000-000000000014',
   'cc000000-0000-0000-0000-000000000007', 'ee000000-0000-0000-0000-000000000008',
   'ff000000-0000-0000-0000-000000000021', 'ab000000-0000-0000-0000-000000000008',
   'in_progress', NOW()::date, '15:30',
   'Monarch, Francistown', 1440.00, '3 sessions/week × 4 weeks. 1.5hr each at P120/hr.',
   NOW() - INTERVAL '1 day', NOW() - INTERVAL '1 day'),

  -- bb15: Sethunya → Dineo — garden design (pending, not confirmed yet)
  ('bb000000-0000-0000-0000-000000000015',
   'cc000000-0000-0000-0000-000000000008', 'ee000000-0000-0000-0000-000000000009',
   'ff000000-0000-0000-0000-000000000025', 'ab000000-0000-0000-0000-000000000009',
   'pending', NOW()::date + INTERVAL '10 days', '08:00',
   'Tlokweng, Gaborone', 8500.00, 'Full garden design + planting + irrigation. Site visit first.',
   NOW() - INTERVAL '12 hours', NOW() - INTERVAL '12 hours'),

  -- bb16: Ntombi → Koketso — bathroom tiling (confirmed, upcoming)
  ('bb000000-0000-0000-0000-000000000016',
   'cc000000-0000-0000-0000-000000000009', 'ee000000-0000-0000-0000-00000000000c',
   'ff000000-0000-0000-0000-000000000034', 'ab000000-0000-0000-0000-000000000010',
   'confirmed', NOW()::date + INTERVAL '6 days', '07:30',
   'Lobatse guesthouse', 4200.00, '2 bathrooms, ~25m². Waterproofing + grouting included.',
   NOW() - INTERVAL '1 day', NOW() - INTERVAL '1 day'),

  -- bb17: Mpho → Gaone — Wi-Fi fix (completed, same-day)
  ('bb000000-0000-0000-0000-000000000017',
   'cc000000-0000-0000-0000-000000000001', 'ee000000-0000-0000-0000-00000000000b',
   'ff000000-0000-0000-0000-000000000031', 'ab000000-0000-0000-0000-000000000011',
   'completed', NOW()::date - INTERVAL '1 day', '10:30',
   'Gaborone West', 350.00, 'Added mesh node in back of house. Signal now full coverage.',
   NOW() - INTERVAL '2 days', NOW() - INTERVAL '1 day'),

  -- bb18: Keabetswe → Thato — driveway paving (confirmed, 2 weeks out)
  ('bb000000-0000-0000-0000-000000000018',
   'cc000000-0000-0000-0000-000000000002', 'ee000000-0000-0000-0000-00000000000a',
   'ff000000-0000-0000-0000-000000000028', 'ab000000-0000-0000-0000-000000000012',
   'confirmed', NOW()::date + INTERVAL '16 days', '07:00',
   'Monarch, Francistown', 9800.00, '50m² driveway + 20m² patio. Clay pavers. Start as agreed.',
   NOW() - INTERVAL '3 days', NOW() - INTERVAL '3 days'),

  -- bb19: Tshepho → Naledi — house cleaning (completed)
  ('bb000000-0000-0000-0000-000000000019',
   'cc000000-0000-0000-0000-000000000004', 'ee000000-0000-0000-0000-000000000002',
   'ff000000-0000-0000-0000-000000000004', NULL,
   'completed', (NOW() - INTERVAL '12 days')::date, '08:00',
   'Block 3, Gaborone', 400.00, 'Standard 3-bedroom house clean.',
   NOW() - INTERVAL '14 days', NOW() - INTERVAL '12 days'),

  -- bb20: Boitumelo → Kgosi — geyser replacement (completed)
  ('bb000000-0000-0000-0000-000000000020',
   'cc000000-0000-0000-0000-000000000005', 'ee000000-0000-0000-0000-000000000001',
   'ff000000-0000-0000-0000-000000000003', NULL,
   'completed', (NOW() - INTERVAL '18 days')::date, '09:00',
   'Phakalane, Gaborone', 1800.00, 'Old 100L geyser replaced. New 150L installed.',
   NOW() - INTERVAL '20 days', NOW() - INTERVAL '18 days'),

  -- bb21: Goitseone → Lesego — corporate event photography (completed)
  ('bb000000-0000-0000-0000-000000000021',
   'cc000000-0000-0000-0000-000000000006', 'ee000000-0000-0000-0000-000000000004',
   'ff000000-0000-0000-0000-000000000011', NULL,
   'completed', (NOW() - INTERVAL '8 days')::date, '08:00',
   'Serowe Hotel', 2000.00, 'Annual business awards ceremony. Half-day coverage.',
   NOW() - INTERVAL '12 days', NOW() - INTERVAL '8 days'),

  -- bb22: Kagiso → Bakang — AC regas (in_progress, at workshop now)
  ('bb000000-0000-0000-0000-000000000022',
   'cc000000-0000-0000-0000-000000000007', 'ee000000-0000-0000-0000-000000000007',
   'ff000000-0000-0000-0000-000000000020', NULL,
   'in_progress', NOW()::date, '09:00',
   'Bakang Auto, Francistown', 450.00, 'BMW 3 Series AC not cooling. Regas + leak check.',
   NOW() - INTERVAL '2 days', NOW() - INTERVAL '2 days'),

  -- bb23: Sethunya → Mothusi — hair braiding (pending provider acceptance)
  ('bb000000-0000-0000-0000-000000000023',
   'cc000000-0000-0000-0000-000000000008', 'ee000000-0000-0000-0000-000000000005',
   'ff000000-0000-0000-0000-000000000012', NULL,
   'pending', NOW()::date + INTERVAL '4 days', '10:00',
   'Tlokweng, Gaborone', 280.00, 'Medium box braids. Home visit preferred.',
   NOW() - INTERVAL '6 hours', NOW() - INTERVAL '6 hours'),

  -- bb24: Ntombi → Kefilwe — meal prep for guesthouse (completed)
  ('bb000000-0000-0000-0000-000000000024',
   'cc000000-0000-0000-0000-000000000009', 'ee000000-0000-0000-0000-000000000006',
   'ff000000-0000-0000-0000-000000000017', NULL,
   'completed', (NOW() - INTERVAL '10 days')::date, '08:00',
   'Lobatse guesthouse', 1200.00, '5-day meal prep for 8 guests. Breakfast + dinner.',
   NOW() - INTERVAL '12 days', NOW() - INTERVAL '10 days'),

  -- bb25: Onkemetse → Oarabile — English tutoring (confirmed, upcoming)
  ('bb000000-0000-0000-0000-000000000025',
   'cc000000-0000-0000-0000-000000000003', 'ee000000-0000-0000-0000-000000000008',
   'ff000000-0000-0000-0000-000000000023', NULL,
   'confirmed', NOW()::date + INTERVAL '3 days', '16:00',
   'Maun', 360.00, 'Online sessions. 3 × 90min. Focus on comprehension and essays.',
   NOW() - INTERVAL '1 day', NOW() - INTERVAL '1 day')
;

-- =============================================================================
-- 9. PAYMENTS
-- =============================================================================

INSERT INTO public.payments (id, booking_id, amount, method, status, transaction_ref, customer_confirmed, provider_confirmed, created_at, updated_at)
VALUES
  -- bb13: Goitseone → Bakang car service (completed, Orange Money)
  ('a2000000-0000-0000-0000-000000000001', 'bb000000-0000-0000-0000-000000000013',
   650.00, 'orange_money', 'released', 'OM-2026-10013', TRUE, TRUE,
   NOW() - INTERVAL '8 days', NOW() - INTERVAL '5 days'),

  -- bb17: Mpho → Gaone Wi-Fi fix (completed, wallet)
  ('a2000000-0000-0000-0000-000000000002', 'bb000000-0000-0000-0000-000000000017',
   350.00, 'wallet', 'released', NULL, TRUE, TRUE,
   NOW() - INTERVAL '2 days', NOW() - INTERVAL '1 day'),

  -- bb19: Tshepho → Naledi cleaning (completed, BTC Smega)
  ('a2000000-0000-0000-0000-000000000003', 'bb000000-0000-0000-0000-000000000019',
   400.00, 'btc_myzaka', 'released', 'BM-2026-10019', TRUE, TRUE,
   NOW() - INTERVAL '14 days', NOW() - INTERVAL '12 days'),

  -- bb20: Boitumelo → Kgosi geyser (completed, Mascom MyZaka)
  ('a2000000-0000-0000-0000-000000000004', 'bb000000-0000-0000-0000-000000000020',
   1800.00, 'mascom_myzaka', 'released', 'MM-2026-10020', TRUE, TRUE,
   NOW() - INTERVAL '20 days', NOW() - INTERVAL '18 days'),

  -- bb21: Goitseone → Lesego event photography (completed, Orange Money)
  ('a2000000-0000-0000-0000-000000000005', 'bb000000-0000-0000-0000-000000000021',
   2000.00, 'orange_money', 'released', 'OM-2026-10021', TRUE, TRUE,
   NOW() - INTERVAL '12 days', NOW() - INTERVAL '8 days'),

  -- bb24: Ntombi → Kefilwe meal prep (completed, wallet)
  ('a2000000-0000-0000-0000-000000000006', 'bb000000-0000-0000-0000-000000000024',
   1200.00, 'wallet', 'released', NULL, TRUE, TRUE,
   NOW() - INTERVAL '12 days', NOW() - INTERVAL '10 days'),

  -- bb14: Kagiso → Oarabile tutoring (in_progress, wallet held — customer confirmed)
  ('a2000000-0000-0000-0000-000000000007', 'bb000000-0000-0000-0000-000000000014',
   1440.00, 'wallet', 'held', NULL, TRUE, FALSE,
   NOW() - INTERVAL '1 day', NOW() - INTERVAL '1 day'),

  -- bb22: Kagiso → Bakang AC repair (in_progress, Orange Money held)
  ('a2000000-0000-0000-0000-000000000008', 'bb000000-0000-0000-0000-000000000022',
   450.00, 'orange_money', 'held', 'OM-2026-10022', FALSE, FALSE,
   NOW() - INTERVAL '2 days', NOW() - INTERVAL '2 days')
;

-- =============================================================================
-- 10. REVIEWS
-- =============================================================================

INSERT INTO public.reviews (booking_id, customer_id, provider_id, rating, comment, created_at)
VALUES
  ('bb000000-0000-0000-0000-000000000013',
   'cc000000-0000-0000-0000-000000000006', 'ee000000-0000-0000-0000-000000000007',
   5, 'Bakang is honest and thorough. He serviced my Hilux and found worn brake pads I didn''t know about. Fair price and fast. Will definitely use again.', NOW() - INTERVAL '4 days'),

  ('bb000000-0000-0000-0000-000000000017',
   'cc000000-0000-0000-0000-000000000001', 'ee000000-0000-0000-0000-00000000000b',
   5, 'Gaone came same day and sorted the Wi-Fi issue in about 2 hours. Whole house now has full signal. Super professional and explained everything he was doing. Highly recommended.', NOW() - INTERVAL '1 day'),

  ('bb000000-0000-0000-0000-000000000019',
   'cc000000-0000-0000-0000-000000000004', 'ee000000-0000-0000-0000-000000000002',
   5, 'Naledi''s team is absolutely amazing. House was sparkling in 3 hours. They even cleaned inside the oven without being asked. Will book every month!', NOW() - INTERVAL '11 days'),

  ('bb000000-0000-0000-0000-000000000020',
   'cc000000-0000-0000-0000-000000000005', 'ee000000-0000-0000-0000-000000000001',
   4, 'Kgosi replaced the geyser without any fuss. Took a bit longer than quoted but the quality of work was great — no leaks and all pipes properly insulated. Happy with the service.', NOW() - INTERVAL '17 days'),

  ('bb000000-0000-0000-0000-000000000021',
   'cc000000-0000-0000-0000-000000000006', 'ee000000-0000-0000-0000-000000000004',
   5, 'Lesego captured everything perfectly at our awards night. Photos were delivered in 3 days — crisp, well-lit, and professional. Our CEO was very impressed.', NOW() - INTERVAL '7 days'),

  ('bb000000-0000-0000-0000-000000000024',
   'cc000000-0000-0000-0000-000000000009', 'ee000000-0000-0000-0000-000000000006',
   5, 'Kefilwe''s food was absolutely incredible. My guesthouse guests were asking for recipes! Seswaa was perfect, the salads were fresh, and everything was ready on time. Will be a regular customer.', NOW() - INTERVAL '9 days')
;

-- =============================================================================
-- 11. CONVERSATIONS & MESSAGES
-- =============================================================================

-- dc05: Tshepho ↔ Mothusi (bridal booking)
INSERT INTO public.conversations (id, participant_1, participant_2, booking_id, last_message_at, created_at)
VALUES ('dc000000-0000-0000-0000-000000000005', 'cc000000-0000-0000-0000-000000000004', 'dd000000-0000-0000-0000-000000000005', 'bb000000-0000-0000-0000-000000000011', NOW() - INTERVAL '18 hours', NOW() - INTERVAL '2 days')
;
INSERT INTO public.messages (conversation_id, sender_id, receiver_id, content, is_read, created_at) VALUES
  ('dc000000-0000-0000-0000-000000000005', 'cc000000-0000-0000-0000-000000000004', 'dd000000-0000-0000-0000-000000000005', 'Hi Mothusi, so excited to have you for the wedding! For the trial, should I wash my hair beforehand or come with dry hair?', TRUE,  NOW() - INTERVAL '2 days'),
  ('dc000000-0000-0000-0000-000000000005', 'dd000000-0000-0000-0000-000000000005', 'cc000000-0000-0000-0000-000000000004', 'Hi Tshepho! Congratulations again! Please come with clean, dry hair for the trial — it will help me see your natural texture and plan the best style. Do you have any inspo photos?', TRUE,  NOW() - INTERVAL '2 days' + INTERVAL '30 minutes'),
  ('dc000000-0000-0000-0000-000000000005', 'cc000000-0000-0000-0000-000000000004', 'dd000000-0000-0000-0000-000000000005', 'Yes! Sending you a Pinterest board now. I love the sleek updo with baby hair look.', TRUE,  NOW() - INTERVAL '2 days' + INTERVAL '1 hour'),
  ('dc000000-0000-0000-0000-000000000005', 'dd000000-0000-0000-0000-000000000005', 'cc000000-0000-0000-0000-000000000004', 'Perfect, that look will suit you beautifully! I have all the products for it. See you at the trial!', FALSE, NOW() - INTERVAL '18 hours');

-- dc06: Goitseone ↔ Bakang (car service)
INSERT INTO public.conversations (id, participant_1, participant_2, booking_id, last_message_at, created_at)
VALUES ('dc000000-0000-0000-0000-000000000006', 'cc000000-0000-0000-0000-000000000006', 'dd000000-0000-0000-0000-000000000007', 'bb000000-0000-0000-0000-000000000013', NOW() - INTERVAL '5 days', NOW() - INTERVAL '7 days')
;
INSERT INTO public.messages (conversation_id, sender_id, receiver_id, content, is_read, created_at) VALUES
  ('dc000000-0000-0000-0000-000000000006', 'cc000000-0000-0000-0000-000000000006', 'dd000000-0000-0000-0000-000000000007', 'Hi Bakang, can I drop off early, like 7:30? I need to be at work by 11.', TRUE, NOW() - INTERVAL '7 days'),
  ('dc000000-0000-0000-0000-000000000006', 'dd000000-0000-0000-0000-000000000007', 'cc000000-0000-0000-0000-000000000006', 'No problem at all! 7:30 works fine. I will call you as soon as it is ready — usually done in 3 hours.', TRUE, NOW() - INTERVAL '7 days' + INTERVAL '20 minutes'),
  ('dc000000-0000-0000-0000-000000000006', 'dd000000-0000-0000-0000-000000000007', 'cc000000-0000-0000-0000-000000000006', 'Hi, your Hilux is ready! Also found your front brake pads were at 20% — replaced them as well. Total came to P650 as quoted. No extra charge for the brakes since I had everything open already.', TRUE, NOW() - INTERVAL '5 days'),
  ('dc000000-0000-0000-0000-000000000006', 'cc000000-0000-0000-0000-000000000006', 'dd000000-0000-0000-0000-000000000007', 'Wow thank you so much! Really appreciate the honesty. On my way now.', TRUE, NOW() - INTERVAL '5 days' + INTERVAL '15 minutes');

-- dc07: Kagiso ↔ Oarabile (tutoring)
INSERT INTO public.conversations (id, participant_1, participant_2, booking_id, last_message_at, created_at)
VALUES ('dc000000-0000-0000-0000-000000000007', 'cc000000-0000-0000-0000-000000000007', 'dd000000-0000-0000-0000-000000000008', 'bb000000-0000-0000-0000-000000000014', NOW() - INTERVAL '20 hours', NOW() - INTERVAL '1 day')
;
INSERT INTO public.messages (conversation_id, sender_id, receiver_id, content, is_read, created_at) VALUES
  ('dc000000-0000-0000-0000-000000000007', 'cc000000-0000-0000-0000-000000000007', 'dd000000-0000-0000-0000-000000000008', 'Hi Mr Moeng, thank you for accepting so quickly. My daughter Lesedi is really panicking about the exams. Can you work with a student who gets very anxious during tests?', TRUE,  NOW() - INTERVAL '1 day'),
  ('dc000000-0000-0000-0000-000000000007', 'dd000000-0000-0000-0000-000000000008', 'cc000000-0000-0000-0000-000000000007', 'Absolutely! Exam anxiety is very common and I have techniques that really help. The first session is always about building confidence before we touch any content. Tell Lesedi not to worry — we will get there together.', TRUE,  NOW() - INTERVAL '1 day' + INTERVAL '30 minutes'),
  ('dc000000-0000-0000-0000-000000000007', 'cc000000-0000-0000-0000-000000000007', 'dd000000-0000-0000-0000-000000000008', 'That is so reassuring. She will be ready at 3:30. Thank you again!', FALSE, NOW() - INTERVAL '20 hours');

-- dc08: Mpho ↔ Gaone (Wi-Fi — post-completion)
INSERT INTO public.conversations (id, participant_1, participant_2, booking_id, last_message_at, created_at)
VALUES ('dc000000-0000-0000-0000-000000000008', 'cc000000-0000-0000-0000-000000000001', 'dd000000-0000-0000-0000-00000000000b', 'bb000000-0000-0000-0000-000000000017', NOW() - INTERVAL '22 hours', NOW() - INTERVAL '2 days')
;
INSERT INTO public.messages (conversation_id, sender_id, receiver_id, content, is_read, created_at) VALUES
  ('dc000000-0000-0000-0000-000000000008', 'cc000000-0000-0000-0000-000000000001', 'dd000000-0000-0000-0000-00000000000b', 'Hi Gaone, just confirming tomorrow at 10:30? And please bring a long ethernet cable just in case.', TRUE,  NOW() - INTERVAL '2 days'),
  ('dc000000-0000-0000-0000-000000000008', 'dd000000-0000-0000-0000-00000000000b', 'cc000000-0000-0000-0000-000000000001', 'Confirmed! I always carry a 20m cable. See you tomorrow morning.', TRUE,  NOW() - INTERVAL '2 days' + INTERVAL '10 minutes'),
  ('dc000000-0000-0000-0000-000000000008', 'dd000000-0000-0000-0000-00000000000b', 'cc000000-0000-0000-0000-000000000001', 'All sorted! I added a mesh node in the back bedroom and reconfigured your router channel to reduce interference. You should now get full signal everywhere.', TRUE,  NOW() - INTERVAL '1 day'),
  ('dc000000-0000-0000-0000-000000000008', 'cc000000-0000-0000-0000-000000000001', 'dd000000-0000-0000-0000-00000000000b', 'Amazing! Already on a video call from the back room — first time ever! Sending your 5-star review now 😊', FALSE, NOW() - INTERVAL '22 hours');

-- dc09: Ntombi ↔ Koketso (tiling upcoming)
INSERT INTO public.conversations (id, participant_1, participant_2, booking_id, last_message_at, created_at)
VALUES ('dc000000-0000-0000-0000-000000000009', 'cc000000-0000-0000-0000-000000000009', 'dd000000-0000-0000-0000-00000000000c', 'bb000000-0000-0000-0000-000000000016', NOW() - INTERVAL '10 hours', NOW() - INTERVAL '1 day')
;
INSERT INTO public.messages (conversation_id, sender_id, receiver_id, content, is_read, created_at) VALUES
  ('dc000000-0000-0000-0000-000000000009', 'cc000000-0000-0000-0000-000000000009', 'dd000000-0000-0000-0000-00000000000c', 'Hi Koketso, looking forward to having you start next week. One question — the existing tiles, do I need to remove them first or will you handle that?', TRUE,  NOW() - INTERVAL '1 day'),
  ('dc000000-0000-0000-0000-000000000009', 'dd000000-0000-0000-0000-00000000000c', 'cc000000-0000-0000-0000-000000000009', 'Hi Ntombi! We handle removal and disposal as part of the job at no extra cost. Just make sure there is somewhere for us to park the bakkie. See you Monday at 7:30!', FALSE, NOW() - INTERVAL '10 hours');

-- dc10: Boitumelo ↔ Kgosi (geyser — post-completion)
INSERT INTO public.conversations (id, participant_1, participant_2, booking_id, last_message_at, created_at)
VALUES ('dc000000-0000-0000-0000-000000000010', 'cc000000-0000-0000-0000-000000000005', 'dd000000-0000-0000-0000-000000000001', 'bb000000-0000-0000-0000-000000000020', NOW() - INTERVAL '17 days', NOW() - INTERVAL '20 days')
;
INSERT INTO public.messages (conversation_id, sender_id, receiver_id, content, is_read, created_at) VALUES
  ('dc000000-0000-0000-0000-000000000010', 'cc000000-0000-0000-0000-000000000005', 'dd000000-0000-0000-0000-000000000001', 'Morning Kgosi. Does the new geyser come with a warranty?', TRUE, NOW() - INTERVAL '20 days'),
  ('dc000000-0000-0000-0000-000000000010', 'dd000000-0000-0000-0000-000000000001', 'cc000000-0000-0000-0000-000000000005', 'Good morning! Yes, 5-year manufacturer warranty on the unit and 1-year on my labour. I will leave you the warranty card today.', TRUE, NOW() - INTERVAL '20 days' + INTERVAL '20 minutes'),
  ('dc000000-0000-0000-0000-000000000010', 'cc000000-0000-0000-0000-000000000005', 'dd000000-0000-0000-0000-000000000001', 'Perfect, thank you. Really happy with the work — left you a 4-star review!', TRUE, NOW() - INTERVAL '17 days');

-- =============================================================================
-- 12. WALLET BALANCES FOR NEW USERS
-- =============================================================================

-- New customers (wallets auto-created by trigger; set starting balances)
UPDATE public.wallets SET balance = 2000.00 WHERE user_id = 'cc000000-0000-0000-0000-000000000004'; -- Tshepho
UPDATE public.wallets SET balance =  850.00 WHERE user_id = 'cc000000-0000-0000-0000-000000000005'; -- Boitumelo
UPDATE public.wallets SET balance =  500.00 WHERE user_id = 'cc000000-0000-0000-0000-000000000006'; -- Goitseone
UPDATE public.wallets SET balance = 3060.00 WHERE user_id = 'cc000000-0000-0000-0000-000000000007'; -- Kagiso (topped up P4500, P1440 held)
UPDATE public.wallets SET balance = 1200.00 WHERE user_id = 'cc000000-0000-0000-0000-000000000008'; -- Sethunya
UPDATE public.wallets SET balance =  300.00 WHERE user_id = 'cc000000-0000-0000-0000-000000000009'; -- Ntombi (P1500 topped up, P1200 released to provider)

-- New providers
UPDATE public.wallets SET balance =  400.00 WHERE user_id = 'dd000000-0000-0000-0000-000000000005'; -- Mothusi (topped up)
UPDATE public.wallets SET balance = 1200.00 WHERE user_id = 'dd000000-0000-0000-0000-000000000006'; -- Kefilwe (P1200 released from bb24)
UPDATE public.wallets SET balance =    0.00 WHERE user_id = 'dd000000-0000-0000-0000-000000000007'; -- Bakang (mobile money payments, wallet = 0)
UPDATE public.wallets SET balance = 1440.00 WHERE user_id = 'dd000000-0000-0000-0000-000000000008'; -- Oarabile (bb14 still held — not released yet)
UPDATE public.wallets SET balance =  200.00 WHERE user_id = 'dd000000-0000-0000-0000-000000000009'; -- Dineo (topped up)
UPDATE public.wallets SET balance =    0.00 WHERE user_id = 'dd000000-0000-0000-0000-00000000000a'; -- Thato (not paid yet)
UPDATE public.wallets SET balance =  350.00 WHERE user_id = 'dd000000-0000-0000-0000-00000000000b'; -- Gaone (bb17 released P350)
UPDATE public.wallets SET balance =    0.00 WHERE user_id = 'dd000000-0000-0000-0000-00000000000c'; -- Koketso (not paid yet)

-- =============================================================================
-- 13. WALLET TRANSACTIONS FOR NEW USERS
-- =============================================================================

-- ── Tshepho — topped up P2000, paid P400 for cleaning (released)
INSERT INTO public.wallet_transactions (wallet_id, type, direction, amount, description, created_at)
SELECT id, 'top_up', 'credit', 2000.00, 'Wallet top-up — Orange Money', NOW() - INTERVAL '14 days'
FROM public.wallets WHERE user_id = 'cc000000-0000-0000-0000-000000000004';
INSERT INTO public.wallet_transactions (wallet_id, type, direction, amount, reference_id, description, created_at)
SELECT id, 'payment_hold', 'debit', 400.00, 'bb000000-0000-0000-0000-000000000019'::uuid, 'Payment held in escrow', NOW() - INTERVAL '14 days'
FROM public.wallets WHERE user_id = 'cc000000-0000-0000-0000-000000000004';
INSERT INTO public.wallet_transactions (wallet_id, type, direction, amount, reference_id, description, created_at)
SELECT id, 'payment_release', 'debit', 400.00, 'bb000000-0000-0000-0000-000000000019'::uuid, 'Payment released to Naledi Sparkle Cleaning', NOW() - INTERVAL '12 days'
FROM public.wallets WHERE user_id = 'cc000000-0000-0000-0000-000000000004';

-- ── Boitumelo — topped up P1000, withdrew P150
INSERT INTO public.wallet_transactions (wallet_id, type, direction, amount, description, created_at)
SELECT id, 'top_up', 'credit', 1000.00, 'Wallet top-up — Mascom MyZaka', NOW() - INTERVAL '20 days'
FROM public.wallets WHERE user_id = 'cc000000-0000-0000-0000-000000000005';
INSERT INTO public.wallet_transactions (wallet_id, type, direction, amount, description, created_at)
SELECT id, 'withdrawal', 'debit', 150.00, 'Withdrawal to Orange Money — 74502200', NOW() - INTERVAL '8 days'
FROM public.wallets WHERE user_id = 'cc000000-0000-0000-0000-000000000005';

-- ── Goitseone — topped up P500
INSERT INTO public.wallet_transactions (wallet_id, type, direction, amount, description, created_at)
SELECT id, 'top_up', 'credit', 500.00, 'Wallet top-up — BTC Smega', NOW() - INTERVAL '10 days'
FROM public.wallets WHERE user_id = 'cc000000-0000-0000-0000-000000000006';

-- ── Kagiso — topped up P4500, P1440 held in escrow for tutoring
INSERT INTO public.wallet_transactions (wallet_id, type, direction, amount, description, created_at)
SELECT id, 'top_up', 'credit', 2000.00, 'Wallet top-up — Orange Money', NOW() - INTERVAL '15 days'
FROM public.wallets WHERE user_id = 'cc000000-0000-0000-0000-000000000007';
INSERT INTO public.wallet_transactions (wallet_id, type, direction, amount, description, created_at)
SELECT id, 'top_up', 'credit', 2500.00, 'Wallet top-up — BTC Smega', NOW() - INTERVAL '7 days'
FROM public.wallets WHERE user_id = 'cc000000-0000-0000-0000-000000000007';
INSERT INTO public.wallet_transactions (wallet_id, type, direction, amount, reference_id, description, created_at)
SELECT id, 'payment_hold', 'debit', 1440.00, 'bb000000-0000-0000-0000-000000000014'::uuid, 'Payment held in escrow', NOW() - INTERVAL '1 day'
FROM public.wallets WHERE user_id = 'cc000000-0000-0000-0000-000000000007';

-- ── Sethunya — topped up P1200
INSERT INTO public.wallet_transactions (wallet_id, type, direction, amount, description, created_at)
SELECT id, 'top_up', 'credit', 1200.00, 'Wallet top-up — Mascom MyZaka', NOW() - INTERVAL '5 days'
FROM public.wallets WHERE user_id = 'cc000000-0000-0000-0000-000000000008';

-- ── Ntombi — topped up P1500, P1200 paid and released to Kefilwe
INSERT INTO public.wallet_transactions (wallet_id, type, direction, amount, description, created_at)
SELECT id, 'top_up', 'credit', 1500.00, 'Wallet top-up — Orange Money', NOW() - INTERVAL '12 days'
FROM public.wallets WHERE user_id = 'cc000000-0000-0000-0000-000000000009';
INSERT INTO public.wallet_transactions (wallet_id, type, direction, amount, reference_id, description, created_at)
SELECT id, 'payment_hold', 'debit', 1200.00, 'bb000000-0000-0000-0000-000000000024'::uuid, 'Payment held in escrow', NOW() - INTERVAL '12 days'
FROM public.wallets WHERE user_id = 'cc000000-0000-0000-0000-000000000009';
INSERT INTO public.wallet_transactions (wallet_id, type, direction, amount, reference_id, description, created_at)
SELECT id, 'payment_release', 'debit', 1200.00, 'bb000000-0000-0000-0000-000000000024'::uuid, 'Payment released to Kefilwe''s Kitchen', NOW() - INTERVAL '10 days'
FROM public.wallets WHERE user_id = 'cc000000-0000-0000-0000-000000000009';

-- ── Mothusi (provider) — topped up P400
INSERT INTO public.wallet_transactions (wallet_id, type, direction, amount, description, created_at)
SELECT id, 'top_up', 'credit', 400.00, 'Wallet top-up', NOW() - INTERVAL '7 days'
FROM public.wallets WHERE user_id = 'dd000000-0000-0000-0000-000000000005';

-- ── Kefilwe (provider) — received P1200 from Ntombi
INSERT INTO public.wallet_transactions (wallet_id, type, direction, amount, reference_id, description, created_at)
SELECT id, 'payment_release', 'credit', 1200.00, 'a2000000-0000-0000-0000-000000000006'::uuid, 'Payment released from escrow', NOW() - INTERVAL '10 days'
FROM public.wallets WHERE user_id = 'dd000000-0000-0000-0000-000000000006';

-- ── Dineo (provider) — topped up P200
INSERT INTO public.wallet_transactions (wallet_id, type, direction, amount, description, created_at)
SELECT id, 'top_up', 'credit', 200.00, 'Wallet top-up', NOW() - INTERVAL '3 days'
FROM public.wallets WHERE user_id = 'dd000000-0000-0000-0000-000000000009';

-- ── Gaone (provider) — received P350 from Mpho
INSERT INTO public.wallet_transactions (wallet_id, type, direction, amount, reference_id, description, created_at)
SELECT id, 'payment_release', 'credit', 350.00, 'a2000000-0000-0000-0000-000000000002'::uuid, 'Payment released from escrow', NOW() - INTERVAL '1 day'
FROM public.wallets WHERE user_id = 'dd000000-0000-0000-0000-00000000000b';

-- =============================================================================
-- 14. NOTIFICATIONS
-- =============================================================================

INSERT INTO public.notifications (user_id, type, title, body, data, is_read, created_at)
VALUES
  -- Tshepho: quote accepted
  ('cc000000-0000-0000-0000-000000000004', 'response_received', 'Quote accepted for your wedding post',
   'Mothusi Beauty Studio quoted P2,800 for your bridal hair & makeup.',
   '{"post_id":"10000000-0000-0000-0000-000000000007"}', TRUE, NOW() - INTERVAL '2 days'),

  -- Boitumelo: response received for catering post
  ('cc000000-0000-0000-0000-000000000005', 'response_received', 'New quote on your post',
   'Kefilwe''s Kitchen quoted P4,500 for your 60-person birthday catering.',
   '{"post_id":"10000000-0000-0000-0000-000000000008"}', FALSE, NOW() - INTERVAL '1 day'),

  -- Goitseone: booking completed
  ('cc000000-0000-0000-0000-000000000006', 'booking_completed', 'Service completed',
   'Your Toyota Hilux service with Bakang Auto is complete. Confirm satisfaction to release payment.',
   '{"booking_id":"bb000000-0000-0000-0000-000000000013"}', TRUE, NOW() - INTERVAL '5 days'),

  -- Kagiso: tutor found & session today
  ('cc000000-0000-0000-0000-000000000007', 'booking_confirmed', 'Tutoring booking confirmed',
   'Oarabile Moeng accepted your maths tutoring booking. First session is today at 3:30pm.',
   '{"booking_id":"bb000000-0000-0000-0000-000000000014"}', FALSE, NOW() - INTERVAL '1 day'),

  -- Sethunya: garden quote received
  ('cc000000-0000-0000-0000-000000000008', 'response_received', 'New quote on your post',
   'Dineo Green Gardens quoted P8,500 for your full garden design.',
   '{"post_id":"10000000-0000-0000-0000-000000000011"}', FALSE, NOW() - INTERVAL '1 day'),

  -- Ntombi: tiling confirmed + meal prep complete
  ('cc000000-0000-0000-0000-000000000009', 'booking_confirmed', 'Tiling booking confirmed',
   'Koketso Premium Tiling confirmed your bathroom retiling for next week.',
   '{"booking_id":"bb000000-0000-0000-0000-000000000016"}', TRUE, NOW() - INTERVAL '1 day'),
  ('cc000000-0000-0000-0000-000000000009', 'booking_completed', 'Meal prep completed',
   'Your 5-day meal prep with Kefilwe''s Kitchen is complete. Please confirm to release payment.',
   '{"booking_id":"bb000000-0000-0000-0000-000000000024"}', TRUE, NOW() - INTERVAL '10 days'),

  -- Mpho: Wi-Fi done + payment released
  ('cc000000-0000-0000-0000-000000000001', 'booking_completed', 'IT service completed',
   'Gaone TechFix resolved your Wi-Fi issue. Confirm satisfaction to release payment.',
   '{"booking_id":"bb000000-0000-0000-0000-000000000017"}', TRUE, NOW() - INTERVAL '1 day'),
  ('cc000000-0000-0000-0000-000000000001', 'payment_released', 'Payment released',
   'P350 has been released to Gaone TechFix for the Wi-Fi setup.',
   '{"booking_id":"bb000000-0000-0000-0000-000000000017"}', FALSE, NOW() - INTERVAL '22 hours'),

  -- Provider notifications
  ('dd000000-0000-0000-0000-000000000005', 'booking_confirmed', 'New bridal booking confirmed',
   'Tshepho Sithole confirmed your bridal hair & makeup booking for their wedding.',
   '{"booking_id":"bb000000-0000-0000-0000-000000000011"}', FALSE, NOW() - INTERVAL '2 days'),

  ('dd000000-0000-0000-0000-000000000006', 'response_received', 'Quote sent',
   'Your P4,500 quote for Boitumelo''s birthday catering has been sent.',
   '{"post_id":"10000000-0000-0000-0000-000000000008"}', TRUE, NOW() - INTERVAL '1 day'),
  ('dd000000-0000-0000-0000-000000000006', 'payment_released', 'Payment received — P1,200',
   'P1,200 for Ntombi''s meal prep has been added to your wallet.',
   '{"booking_id":"bb000000-0000-0000-0000-000000000024"}', TRUE, NOW() - INTERVAL '10 days'),
  ('dd000000-0000-0000-0000-000000000006', 'new_review', 'New 5-star review!',
   'Ntombi Radebe left you a 5-star review: "Kefilwe''s food was absolutely incredible."',
   '{"booking_id":"bb000000-0000-0000-0000-000000000024"}', FALSE, NOW() - INTERVAL '9 days'),

  ('dd000000-0000-0000-0000-000000000007', 'new_review', 'New 5-star review!',
   'Goitseone Moitoi gave you 5 stars: "Bakang is honest and thorough."',
   '{"booking_id":"bb000000-0000-0000-0000-000000000013"}', FALSE, NOW() - INTERVAL '4 days'),

  ('dd000000-0000-0000-0000-000000000008', 'booking_confirmed', 'New tutoring booking',
   'Kagiso Nkosi confirmed a 4-week BGCSE Maths package. First session is today.',
   '{"booking_id":"bb000000-0000-0000-0000-000000000014"}', FALSE, NOW() - INTERVAL '1 day'),

  ('dd000000-0000-0000-0000-00000000000b', 'payment_released', 'Payment received — P350',
   'P350 for Mpho''s Wi-Fi setup has been added to your wallet.',
   '{"booking_id":"bb000000-0000-0000-0000-000000000017"}', FALSE, NOW() - INTERVAL '22 hours'),
  ('dd000000-0000-0000-0000-00000000000b', 'new_review', 'New 5-star review!',
   'Mpho Kgosi left you 5 stars: "Gaone came same day and sorted the Wi-Fi in 2 hours."',
   '{"booking_id":"bb000000-0000-0000-0000-000000000017"}', FALSE, NOW() - INTERVAL '1 day'),

  ('dd000000-0000-0000-0000-00000000000c', 'booking_confirmed', 'New tiling booking',
   'Ntombi Radebe confirmed the 2-bathroom tiling job in Lobatse. Starting next week.',
   '{"booking_id":"bb000000-0000-0000-0000-000000000016"}', FALSE, NOW() - INTERVAL '1 day');

-- =============================================================================
-- Done!
--
-- New demo accounts (password: Test1234!):
--
--  CUSTOMERS
--    tshepho.sithole@gmail.com       — P2000 wallet, confirmed bridal booking, posts & convos
--    boitumelo.dube@gmail.com        — P850 wallet, confirmed catering booking, completed geyser job
--    goitseone.moitoi@outlook.com    — P500 wallet, completed car service + event photography
--    kagiso.nkosi@yahoo.com          — P3060 wallet, tutoring in-progress, AC repair in-progress
--    sethunya.motswagole@gmail.com   — P1200 wallet, garden design pending, braiding pending
--    ntombi.radebe@gmail.com         — P300 wallet, tiling confirmed, meal prep completed
--
--  PROVIDERS
--    mothusi.beauty@gmail.com        — Beauty & Salon, 4.80★, verified, P400 wallet
--    kefilwe.catering@gmail.com      — Catering, 4.90★, verified, P1200 wallet
--    bakang.motors@gmail.com         — Auto Repair, 4.60★, verified, Francistown
--    oarabile.tutors@gmail.com       — Tutoring, 4.95★, verified, P0 wallet (payment held)
--    dineo.gardens@gmail.com         — Gardening, 4.70★, P200 wallet
--    thato.builds@gmail.com          — Construction, 4.55★, verified, Gaborone
--    gaone.techfix@gmail.com         — IT & CCTV, 4.75★, verified, P350 wallet
--    koketso.tiles@gmail.com         — Tiling, 4.85★, verified, Francistown
-- =============================================================================
