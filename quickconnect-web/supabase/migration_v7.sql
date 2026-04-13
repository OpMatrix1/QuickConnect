-- Migration v7: Quotes system + User reports system
-- Run this after migration_v6.sql

-- ─── QUOTES TABLE ───────────────────────────────────────────────────────────
-- Allows customers to request quotes from specific providers.
-- Flow: requested → quoted → accepted | rejected | expired

CREATE TABLE IF NOT EXISTS quotes (
  id            uuid DEFAULT uuid_generate_v4() PRIMARY KEY,
  customer_id   uuid NOT NULL REFERENCES profiles(id) ON DELETE CASCADE,
  provider_id   uuid NOT NULL REFERENCES service_providers(id) ON DELETE CASCADE,
  -- Customer's initial request
  service_description text NOT NULL,
  budget_min    numeric(10,2),
  budget_max    numeric(10,2),
  customer_message text,
  -- Provider's response
  quoted_amount numeric(10,2),
  provider_message text,
  -- Lifecycle
  status text NOT NULL DEFAULT 'requested'
    CHECK (status IN ('requested', 'quoted', 'accepted', 'rejected', 'expired')),
  -- If accepted, link to the resulting booking
  booking_id    uuid REFERENCES bookings(id),
  created_at    timestamptz NOT NULL DEFAULT now(),
  updated_at    timestamptz NOT NULL DEFAULT now()
);

ALTER TABLE quotes ENABLE ROW LEVEL SECURITY;

-- Customer can see their own quotes
CREATE POLICY "customer_select_own_quotes" ON quotes
  FOR SELECT USING (customer_id = auth.uid());

-- Provider can see quotes addressed to their service_providers row
CREATE POLICY "provider_select_own_quotes" ON quotes
  FOR SELECT USING (
    provider_id IN (
      SELECT id FROM service_providers WHERE profile_id = auth.uid()
    )
  );

-- Customer can insert a quote request
CREATE POLICY "customer_insert_quote" ON quotes
  FOR INSERT WITH CHECK (customer_id = auth.uid());

-- Customer can cancel their own pending quote request (update status to rejected)
CREATE POLICY "customer_update_own_quote" ON quotes
  FOR UPDATE USING (customer_id = auth.uid())
  WITH CHECK (customer_id = auth.uid() AND status IN ('rejected', 'accepted'));

-- Provider can respond (update quoted_amount, provider_message, status)
CREATE POLICY "provider_update_quote" ON quotes
  FOR UPDATE USING (
    provider_id IN (
      SELECT id FROM service_providers WHERE profile_id = auth.uid()
    )
  );

-- Admins can see all quotes
CREATE POLICY "admin_all_quotes" ON quotes
  FOR ALL USING (
    EXISTS (SELECT 1 FROM profiles WHERE id = auth.uid() AND role = 'admin')
  );

-- Trigger to keep updated_at current
CREATE TRIGGER set_updated_at_quotes
  BEFORE UPDATE ON quotes
  FOR EACH ROW EXECUTE FUNCTION set_updated_at();


-- ─── REPORTS TABLE ──────────────────────────────────────────────────────────
-- Users can report other users (customer or provider) for bad behaviour.
-- Admins review and resolve reports.

CREATE TABLE IF NOT EXISTS reports (
  id              uuid DEFAULT uuid_generate_v4() PRIMARY KEY,
  reporter_id     uuid NOT NULL REFERENCES profiles(id) ON DELETE CASCADE,
  reported_user_id uuid NOT NULL REFERENCES profiles(id) ON DELETE CASCADE,
  reason          text NOT NULL
    CHECK (reason IN ('spam', 'harassment', 'fraud', 'inappropriate_content', 'fake_profile', 'other')),
  description     text,
  status          text NOT NULL DEFAULT 'pending'
    CHECK (status IN ('pending', 'reviewed', 'resolved', 'dismissed')),
  admin_notes     text,
  created_at      timestamptz NOT NULL DEFAULT now(),
  updated_at      timestamptz NOT NULL DEFAULT now(),
  -- Prevent duplicate open reports from the same reporter about the same user
  CONSTRAINT reports_unique_open UNIQUE (reporter_id, reported_user_id)
);

ALTER TABLE reports ENABLE ROW LEVEL SECURITY;

-- Any authenticated user can submit a report
CREATE POLICY "auth_insert_report" ON reports
  FOR INSERT WITH CHECK (reporter_id = auth.uid());

-- Reporter can see their own reports
CREATE POLICY "reporter_select_own" ON reports
  FOR SELECT USING (reporter_id = auth.uid());

-- Admins can see and manage all reports
CREATE POLICY "admin_all_reports" ON reports
  FOR ALL USING (
    EXISTS (SELECT 1 FROM profiles WHERE id = auth.uid() AND role = 'admin')
  );

-- Trigger to keep updated_at current
CREATE TRIGGER set_updated_at_reports
  BEFORE UPDATE ON reports
  FOR EACH ROW EXECUTE FUNCTION set_updated_at();
