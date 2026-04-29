-- migration_v41.sql
-- Add real completed bookings + review rows for providers whose service_providers
-- rows have a hardcoded review_count but no actual reviews table entries.
-- The on_review_insert trigger will recalculate review_count and rating_avg automatically.
--
-- Providers covered:
--   Mothusi Beauty Studio  ee...5  (was 14 reviews)
--   Oarabile Tutoring      ee...8  (was 31 reviews)
--   Dineo Green Gardens    ee...9  (was  9 reviews)
--   Thato Construction     ee...a  (was 11 reviews)
--   Koketso Tiling         ee...c  (was 16 reviews)
--
-- Booking UUIDs: bc000000-0000-0000-0000-0000000000XX
-- Review  UUIDs: ac000000-0000-0000-0000-0000000000XX

-- ── Completed bookings ────────────────────────────────────────────────────────

INSERT INTO public.bookings
  (id, customer_id, provider_id, service_id, status,
   scheduled_date, scheduled_time, location_address, agreed_price,
   customer_ready_in_progress, provider_ready_in_progress,
   customer_work_complete, provider_work_complete,
   created_at, updated_at)
VALUES
  -- Mothusi (ee...5) — hair braiding for Mpho
  ('bc000000-0000-0000-0000-000000000001',
   'cc000000-0000-0000-0000-000000000001', 'ee000000-0000-0000-0000-000000000005',
   'ff000000-0000-0000-0000-000000000012',
   'completed', NOW()::date - INTERVAL '30 days', '10:00',
   'Gaborone', 280.00, TRUE, TRUE, TRUE, TRUE,
   NOW() - INTERVAL '35 days', NOW() - INTERVAL '30 days'),

  -- Mothusi (ee...5) — manicure for Tshepho
  ('bc000000-0000-0000-0000-000000000002',
   'cc000000-0000-0000-0000-000000000004', 'ee000000-0000-0000-0000-000000000005',
   'ff000000-0000-0000-0000-000000000013',
   'completed', NOW()::date - INTERVAL '20 days', '11:00',
   'Block 3, Gaborone', 120.00, TRUE, TRUE, TRUE, TRUE,
   NOW() - INTERVAL '22 days', NOW() - INTERVAL '20 days'),

  -- Mothusi (ee...5) — bridal package for Keabetswe
  ('bc000000-0000-0000-0000-000000000003',
   'cc000000-0000-0000-0000-000000000002', 'ee000000-0000-0000-0000-000000000005',
   'ff000000-0000-0000-0000-000000000014',
   'completed', NOW()::date - INTERVAL '10 days', '06:00',
   'Francistown', 2800.00, TRUE, TRUE, TRUE, TRUE,
   NOW() - INTERVAL '15 days', NOW() - INTERVAL '10 days'),

  -- Oarabile (ee...8) — maths tutoring for Goitseone
  ('bc000000-0000-0000-0000-000000000004',
   'cc000000-0000-0000-0000-000000000006', 'ee000000-0000-0000-0000-000000000008',
   'ff000000-0000-0000-0000-000000000021',
   'completed', NOW()::date - INTERVAL '45 days', '15:30',
   'Francistown', 720.00, TRUE, TRUE, TRUE, TRUE,
   NOW() - INTERVAL '50 days', NOW() - INTERVAL '45 days'),

  -- Oarabile (ee...8) — English tutoring for Onkemetse
  ('bc000000-0000-0000-0000-000000000005',
   'cc000000-0000-0000-0000-000000000003', 'ee000000-0000-0000-0000-000000000008',
   'ff000000-0000-0000-0000-000000000023',
   'completed', NOW()::date - INTERVAL '25 days', '16:00',
   'Gaborone', 480.00, TRUE, TRUE, TRUE, TRUE,
   NOW() - INTERVAL '30 days', NOW() - INTERVAL '25 days'),

  -- Oarabile (ee...8) — science tutoring for Boitumelo
  ('bc000000-0000-0000-0000-000000000006',
   'cc000000-0000-0000-0000-000000000005', 'ee000000-0000-0000-0000-000000000008',
   'ff000000-0000-0000-0000-000000000022',
   'completed', NOW()::date - INTERVAL '12 days', '15:00',
   'Phakalane', 360.00, TRUE, TRUE, TRUE, TRUE,
   NOW() - INTERVAL '16 days', NOW() - INTERVAL '12 days'),

  -- Dineo (ee...9) — garden maintenance for Sethunya
  ('bc000000-0000-0000-0000-000000000007',
   'cc000000-0000-0000-0000-000000000008', 'ee000000-0000-0000-0000-000000000009',
   'ff000000-0000-0000-0000-000000000024',
   'completed', NOW()::date - INTERVAL '40 days', '08:00',
   'Tlokweng', 600.00, TRUE, TRUE, TRUE, TRUE,
   NOW() - INTERVAL '45 days', NOW() - INTERVAL '40 days'),

  -- Dineo (ee...9) — tree trimming for Mpho
  ('bc000000-0000-0000-0000-000000000008',
   'cc000000-0000-0000-0000-000000000001', 'ee000000-0000-0000-0000-000000000009',
   'ff000000-0000-0000-0000-000000000026',
   'completed', NOW()::date - INTERVAL '18 days', '07:30',
   'Gaborone West', 450.00, TRUE, TRUE, TRUE, TRUE,
   NOW() - INTERVAL '21 days', NOW() - INTERVAL '18 days'),

  -- Thato (ee...a) — renovation for Ntombi
  ('bc000000-0000-0000-0000-000000000009',
   'cc000000-0000-0000-0000-000000000009', 'ee000000-0000-0000-0000-00000000000a',
   'ff000000-0000-0000-0000-000000000027',
   'completed', NOW()::date - INTERVAL '55 days', '07:00',
   'Lobatse', 12000.00, TRUE, TRUE, TRUE, TRUE,
   NOW() - INTERVAL '60 days', NOW() - INTERVAL '55 days'),

  -- Thato (ee...a) — paving for Kagiso
  ('bc000000-0000-0000-0000-000000000010',
   'cc000000-0000-0000-0000-000000000007', 'ee000000-0000-0000-0000-00000000000a',
   'ff000000-0000-0000-0000-000000000028',
   'completed', NOW()::date - INTERVAL '35 days', '07:00',
   'Francistown', 9200.00, TRUE, TRUE, TRUE, TRUE,
   NOW() - INTERVAL '40 days', NOW() - INTERVAL '35 days'),

  -- Koketso (ee...c) — tiling for Goitseone
  ('bc000000-0000-0000-0000-000000000011',
   'cc000000-0000-0000-0000-000000000006', 'ee000000-0000-0000-0000-00000000000c',
   'ff000000-0000-0000-0000-000000000034',
   'completed', NOW()::date - INTERVAL '28 days', '07:30',
   'Francistown', 3800.00, TRUE, TRUE, TRUE, TRUE,
   NOW() - INTERVAL '32 days', NOW() - INTERVAL '28 days'),

  -- Koketso (ee...c) — kitchen tiling for Boitumelo
  ('bc000000-0000-0000-0000-000000000012',
   'cc000000-0000-0000-0000-000000000005', 'ee000000-0000-0000-0000-00000000000c',
   'ff000000-0000-0000-0000-000000000033',
   'completed', NOW()::date - INTERVAL '14 days', '08:00',
   'Phakalane', 2200.00, TRUE, TRUE, TRUE, TRUE,
   NOW() - INTERVAL '18 days', NOW() - INTERVAL '14 days'),

  -- Koketso (ee...c) — floor tiling for Mpho
  ('bc000000-0000-0000-0000-000000000013',
   'cc000000-0000-0000-0000-000000000001', 'ee000000-0000-0000-0000-00000000000c',
   'ff000000-0000-0000-0000-000000000033',
   'completed', NOW()::date - INTERVAL '7 days', '07:00',
   'Gaborone West', 1800.00, TRUE, TRUE, TRUE, TRUE,
   NOW() - INTERVAL '10 days', NOW() - INTERVAL '7 days')
ON CONFLICT (id) DO NOTHING;


-- ── Reviews (trigger will update review_count + rating_avg on each insert) ───

INSERT INTO public.reviews (id, booking_id, customer_id, provider_id, rating, comment, created_at)
VALUES
  -- Mothusi
  ('ac000000-0000-0000-0000-000000000001',
   'bc000000-0000-0000-0000-000000000001',
   'cc000000-0000-0000-0000-000000000001', 'ee000000-0000-0000-0000-000000000005',
   5, 'Mothusi did an amazing job with my box braids! Super neat and lasted 6 weeks. Will definitely book again.', NOW() - INTERVAL '30 days'),

  ('ac000000-0000-0000-0000-000000000002',
   'bc000000-0000-0000-0000-000000000002',
   'cc000000-0000-0000-0000-000000000004', 'ee000000-0000-0000-0000-000000000005',
   5, 'Best manicure I have ever had. The gel nails are still perfect 3 weeks later. Very professional and hygienic.', NOW() - INTERVAL '20 days'),

  ('ac000000-0000-0000-0000-000000000003',
   'bc000000-0000-0000-0000-000000000003',
   'cc000000-0000-0000-0000-000000000002', 'ee000000-0000-0000-0000-000000000005',
   4, 'Beautiful bridal package. Hair and makeup were stunning on my wedding day. Came to the venue early and was well prepared. Highly recommend.', NOW() - INTERVAL '10 days'),

  -- Oarabile
  ('ac000000-0000-0000-0000-000000000004',
   'bc000000-0000-0000-0000-000000000004',
   'cc000000-0000-0000-0000-000000000006', 'ee000000-0000-0000-0000-000000000008',
   5, 'My son went from a D to a B in maths in just 5 weeks. Oarabile explains concepts so clearly and is very patient. Worth every pula.', NOW() - INTERVAL '45 days'),

  ('ac000000-0000-0000-0000-000000000005',
   'bc000000-0000-0000-0000-000000000005',
   'cc000000-0000-0000-0000-000000000003', 'ee000000-0000-0000-0000-000000000008',
   5, 'Incredible tutor. My English essay scores improved dramatically. Very organised, always prepared, and genuinely cares about student progress.', NOW() - INTERVAL '25 days'),

  ('ac000000-0000-0000-0000-000000000006',
   'bc000000-0000-0000-0000-000000000006',
   'cc000000-0000-0000-0000-000000000005', 'ee000000-0000-0000-0000-000000000008',
   5, 'Helped my daughter grasp Science in record time. Very professional and structured approach. Exam results speak for themselves — she passed with merit!', NOW() - INTERVAL '12 days'),

  -- Dineo
  ('ac000000-0000-0000-0000-000000000007',
   'bc000000-0000-0000-0000-000000000007',
   'cc000000-0000-0000-0000-000000000008', 'ee000000-0000-0000-0000-000000000009',
   5, 'Dineo completely transformed our bare garden. The irrigation system works perfectly and the plants she recommended are thriving. Fantastic work.', NOW() - INTERVAL '40 days'),

  ('ac000000-0000-0000-0000-000000000008',
   'bc000000-0000-0000-0000-000000000008',
   'cc000000-0000-0000-0000-000000000001', 'ee000000-0000-0000-0000-000000000009',
   4, 'Very professional team. The trees were trimmed neatly and they cleaned up everything afterwards. Good communication throughout.', NOW() - INTERVAL '18 days'),

  -- Thato
  ('ac000000-0000-0000-0000-000000000009',
   'bc000000-0000-0000-0000-000000000009',
   'cc000000-0000-0000-0000-000000000009', 'ee000000-0000-0000-0000-00000000000a',
   4, 'Thato and his team did a solid renovation job. Took a little longer than planned but the finishing is top quality. Would hire again for future projects.', NOW() - INTERVAL '55 days'),

  ('ac000000-0000-0000-0000-000000000010',
   'bc000000-0000-0000-0000-000000000010',
   'cc000000-0000-0000-0000-000000000007', 'ee000000-0000-0000-0000-00000000000a',
   5, 'Excellent paving work. Driveway looks brand new and the patio is exactly what I imagined. Very experienced crew and great attention to detail.', NOW() - INTERVAL '35 days'),

  -- Koketso
  ('ac000000-0000-0000-0000-000000000011',
   'bc000000-0000-0000-0000-000000000011',
   'cc000000-0000-0000-0000-000000000006', 'ee000000-0000-0000-0000-00000000000c',
   5, 'Koketso did an outstanding tiling job. Every tile is perfectly aligned and the grouting is immaculate. My bathroom looks like a showroom. Highly recommended!', NOW() - INTERVAL '28 days'),

  ('ac000000-0000-0000-0000-000000000012',
   'bc000000-0000-0000-0000-000000000012',
   'cc000000-0000-0000-0000-000000000005', 'ee000000-0000-0000-0000-00000000000c',
   5, 'Fantastic kitchen tiling. Came prepared, worked efficiently, and the end result is stunning. The waterproofing under the tiles gives me peace of mind too.', NOW() - INTERVAL '14 days'),

  ('ac000000-0000-0000-0000-000000000013',
   'bc000000-0000-0000-0000-000000000013',
   'cc000000-0000-0000-0000-000000000001', 'ee000000-0000-0000-0000-00000000000c',
   4, 'Good quality tiling throughout the living room. Koketso communicated well and the job was finished on time. Very satisfied with the result.', NOW() - INTERVAL '7 days')

ON CONFLICT (id) DO NOTHING;
