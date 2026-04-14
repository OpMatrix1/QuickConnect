-- QuickConnect Database Schema
-- Full migration file for Supabase

-- =============================================================================
-- EXTENSIONS
-- =============================================================================
CREATE EXTENSION IF NOT EXISTS "uuid-ossp";
CREATE EXTENSION IF NOT EXISTS "postgis";

-- =============================================================================
-- TABLES
-- =============================================================================

-- profiles (references auth.users)
CREATE TABLE public.profiles (
  id UUID PRIMARY KEY REFERENCES auth.users(id) ON DELETE CASCADE,
  role TEXT NOT NULL CHECK (role IN ('customer', 'provider', 'admin')),
  full_name TEXT NOT NULL,
  phone TEXT,
  avatar_url TEXT,
  banner_url TEXT,
  city TEXT,
  bio TEXT,
  location GEOGRAPHY(POINT, 4326),
  email_verified BOOLEAN DEFAULT FALSE,
  is_active BOOLEAN DEFAULT TRUE,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- service_providers
CREATE TABLE public.service_providers (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  profile_id UUID NOT NULL UNIQUE REFERENCES public.profiles(id) ON DELETE CASCADE,
  business_name TEXT NOT NULL,
  description TEXT,
  rating_avg DECIMAL(3, 2) DEFAULT 0,
  review_count INTEGER DEFAULT 0,
  response_time_avg INTEGER,
  completion_rate DECIMAL(5, 2),
  is_verified BOOLEAN DEFAULT FALSE,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- service_categories
CREATE TABLE public.service_categories (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  name TEXT NOT NULL UNIQUE,
  icon TEXT,
  description TEXT,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- services
CREATE TABLE public.services (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  provider_id UUID NOT NULL REFERENCES public.service_providers(id) ON DELETE CASCADE,
  category_id UUID NOT NULL REFERENCES public.service_categories(id) ON DELETE CASCADE,
  title TEXT NOT NULL,
  description TEXT,
  price_min DECIMAL(10, 2),
  price_max DECIMAL(10, 2),
  price_type TEXT CHECK (price_type IN ('fixed', 'hourly', 'quote')),
  is_active BOOLEAN DEFAULT TRUE,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- service_areas
CREATE TABLE public.service_areas (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  provider_id UUID NOT NULL REFERENCES public.service_providers(id) ON DELETE CASCADE,
  city TEXT NOT NULL,
  area_name TEXT,
  radius_km DECIMAL(5, 2),
  center GEOGRAPHY(POINT, 4326),
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- looking_for_posts
CREATE TABLE public.looking_for_posts (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  customer_id UUID NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
  category_id UUID NOT NULL REFERENCES public.service_categories(id) ON DELETE CASCADE,
  title TEXT NOT NULL,
  description TEXT NOT NULL,
  budget_min DECIMAL(10, 2),
  budget_max DECIMAL(10, 2),
  location GEOGRAPHY(POINT, 4326),
  location_address TEXT,
  preferred_date DATE,
  preferred_time TIME,
  urgency TEXT CHECK (urgency IN ('low', 'medium', 'high', 'emergency')),
  status TEXT DEFAULT 'active' CHECK (status IN ('active', 'matched', 'expired', 'cancelled')),
  images TEXT[],
  expires_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- looking_for_responses
CREATE TABLE public.looking_for_responses (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  post_id UUID NOT NULL REFERENCES public.looking_for_posts(id) ON DELETE CASCADE,
  provider_id UUID NOT NULL REFERENCES public.service_providers(id) ON DELETE CASCADE,
  quoted_price DECIMAL(10, 2) NOT NULL,
  message TEXT,
  estimated_duration TEXT,
  available_date DATE,
  available_time TIME,
  status TEXT DEFAULT 'pending' CHECK (status IN ('pending', 'accepted', 'rejected')),
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- bookings
CREATE TABLE public.bookings (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  customer_id UUID NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
  provider_id UUID NOT NULL REFERENCES public.service_providers(id) ON DELETE CASCADE,
  service_id UUID REFERENCES public.services(id) ON DELETE SET NULL,
  looking_for_response_id UUID REFERENCES public.looking_for_responses(id) ON DELETE SET NULL,
  status TEXT DEFAULT 'pending' CHECK (status IN ('pending', 'confirmed', 'in_progress', 'completed', 'cancelled')),
  scheduled_date DATE,
  scheduled_time TIME,
  location GEOGRAPHY(POINT, 4326),
  location_address TEXT,
  agreed_price DECIMAL(10, 2),
  notes TEXT,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- conversations
CREATE TABLE public.conversations (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  participant_1 UUID NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
  participant_2 UUID NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
  booking_id UUID REFERENCES public.bookings(id) ON DELETE SET NULL,
  looking_for_post_id UUID REFERENCES public.looking_for_posts(id) ON DELETE SET NULL,
  last_message_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- messages
CREATE TABLE public.messages (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  conversation_id UUID NOT NULL REFERENCES public.conversations(id) ON DELETE CASCADE,
  sender_id UUID NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
  receiver_id UUID NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
  content TEXT NOT NULL,
  is_read BOOLEAN DEFAULT FALSE,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- payments
CREATE TABLE public.payments (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  booking_id UUID NOT NULL UNIQUE REFERENCES public.bookings(id) ON DELETE CASCADE,
  amount DECIMAL(10, 2) NOT NULL,
  method TEXT CHECK (method IN ('orange_money', 'btc_myzaka', 'mascom_myzaka')),
  status TEXT DEFAULT 'pending' CHECK (status IN ('pending', 'held', 'released', 'refunded', 'failed', 'disputed')),
  transaction_ref TEXT,
  customer_confirmed BOOLEAN DEFAULT FALSE,
  provider_confirmed BOOLEAN DEFAULT FALSE,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- reviews
CREATE TABLE public.reviews (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  booking_id UUID NOT NULL UNIQUE REFERENCES public.bookings(id) ON DELETE CASCADE,
  customer_id UUID NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
  provider_id UUID NOT NULL REFERENCES public.service_providers(id) ON DELETE CASCADE,
  rating INTEGER NOT NULL CHECK (rating >= 1 AND rating <= 5),
  comment TEXT,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- category_requests (providers can request new categories)
CREATE TABLE public.category_requests (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  requested_by UUID NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
  name TEXT NOT NULL,
  icon TEXT,
  description TEXT,
  status TEXT DEFAULT 'pending' CHECK (status IN ('pending', 'approved', 'declined')),
  admin_feedback TEXT,
  reviewed_by UUID REFERENCES public.profiles(id) ON DELETE SET NULL,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- notifications
CREATE TABLE public.notifications (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  user_id UUID NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
  type TEXT NOT NULL,
  title TEXT NOT NULL,
  body TEXT,
  data JSONB,
  is_read BOOLEAN DEFAULT FALSE,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- push_subscriptions (Web Push — one row per browser endpoint)
CREATE TABLE public.push_subscriptions (
  endpoint TEXT PRIMARY KEY,
  user_id UUID NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
  p256dh TEXT NOT NULL,
  auth TEXT NOT NULL,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- =============================================================================
-- INDEXES
-- =============================================================================

-- profiles
CREATE INDEX idx_profiles_role ON public.profiles(role);
CREATE INDEX idx_profiles_city ON public.profiles(city);
CREATE INDEX idx_profiles_location ON public.profiles USING GIST(location);

-- service_providers
CREATE INDEX idx_service_providers_profile_id ON public.service_providers(profile_id);
CREATE INDEX idx_service_providers_rating ON public.service_providers(rating_avg DESC);
CREATE INDEX idx_service_providers_is_verified ON public.service_providers(is_verified);

-- services
CREATE INDEX idx_services_provider_id ON public.services(provider_id);
CREATE INDEX idx_services_category_id ON public.services(category_id);
CREATE INDEX idx_services_is_active ON public.services(is_active);

-- service_areas
CREATE INDEX idx_service_areas_provider_id ON public.service_areas(provider_id);
CREATE INDEX idx_service_areas_city ON public.service_areas(city);
CREATE INDEX idx_service_areas_center ON public.service_areas USING GIST(center);

-- looking_for_posts
CREATE INDEX idx_looking_for_posts_customer_id ON public.looking_for_posts(customer_id);
CREATE INDEX idx_looking_for_posts_category_id ON public.looking_for_posts(category_id);
CREATE INDEX idx_looking_for_posts_status ON public.looking_for_posts(status);
CREATE INDEX idx_looking_for_posts_location ON public.looking_for_posts USING GIST(location);
CREATE INDEX idx_looking_for_posts_created_at ON public.looking_for_posts(created_at DESC);

-- looking_for_responses
CREATE INDEX idx_looking_for_responses_post_id ON public.looking_for_responses(post_id);
CREATE INDEX idx_looking_for_responses_provider_id ON public.looking_for_responses(provider_id);

-- bookings
CREATE INDEX idx_bookings_customer_id ON public.bookings(customer_id);
CREATE INDEX idx_bookings_provider_id ON public.bookings(provider_id);
CREATE INDEX idx_bookings_status ON public.bookings(status);
CREATE INDEX idx_bookings_scheduled_date ON public.bookings(scheduled_date);

-- conversations
CREATE INDEX idx_conversations_participant_1 ON public.conversations(participant_1);
CREATE INDEX idx_conversations_participant_2 ON public.conversations(participant_2);
CREATE INDEX idx_conversations_last_message_at ON public.conversations(last_message_at DESC);

-- messages
CREATE INDEX idx_messages_conversation_id_created_at ON public.messages(conversation_id, created_at);
CREATE INDEX idx_messages_sender_id ON public.messages(sender_id);
CREATE INDEX idx_messages_receiver_id ON public.messages(receiver_id);

-- payments
CREATE INDEX idx_payments_booking_id ON public.payments(booking_id);
CREATE INDEX idx_payments_status ON public.payments(status);

-- reviews
CREATE INDEX idx_reviews_booking_id ON public.reviews(booking_id);
CREATE INDEX idx_reviews_provider_id ON public.reviews(provider_id);

-- category_requests
CREATE INDEX idx_category_requests_requested_by ON public.category_requests(requested_by);
CREATE INDEX idx_category_requests_status ON public.category_requests(status);

-- notifications
CREATE INDEX idx_notifications_user_id ON public.notifications(user_id);
CREATE INDEX idx_notifications_is_read ON public.notifications(user_id, is_read);

CREATE INDEX idx_push_subscriptions_user_id ON public.push_subscriptions(user_id);

-- =============================================================================
-- TRIGGER FUNCTIONS
-- =============================================================================

-- Function to update updated_at timestamp
CREATE OR REPLACE FUNCTION public.set_updated_at()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = NOW();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- Function to auto-create profile (and service_providers row for providers) on auth.users insert
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

-- Function to update service_providers rating_avg and review_count on review insert
CREATE OR REPLACE FUNCTION public.update_provider_rating_on_review()
RETURNS TRIGGER AS $$
BEGIN
  UPDATE public.service_providers
  SET
    review_count = (
      SELECT COUNT(*) FROM public.reviews WHERE provider_id = NEW.provider_id
    ),
    rating_avg = (
      SELECT ROUND(AVG(rating)::numeric, 2) FROM public.reviews WHERE provider_id = NEW.provider_id
    ),
    updated_at = NOW()
  WHERE id = NEW.provider_id;
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- Function to update provider rating when review is deleted
CREATE OR REPLACE FUNCTION public.update_provider_rating_on_review_delete()
RETURNS TRIGGER AS $$
BEGIN
  UPDATE public.service_providers
  SET
    review_count = (
      SELECT COUNT(*) FROM public.reviews WHERE provider_id = OLD.provider_id
    ),
    rating_avg = COALESCE((
      SELECT ROUND(AVG(rating)::numeric, 2) FROM public.reviews WHERE provider_id = OLD.provider_id
    ), 0),
    updated_at = NOW()
  WHERE id = OLD.provider_id;
  RETURN OLD;
END;
$$ LANGUAGE plpgsql;

-- =============================================================================
-- TRIGGERS
-- =============================================================================

-- updated_at triggers
CREATE TRIGGER set_profiles_updated_at
  BEFORE UPDATE ON public.profiles
  FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();

CREATE TRIGGER set_service_providers_updated_at
  BEFORE UPDATE ON public.service_providers
  FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();

CREATE TRIGGER set_services_updated_at
  BEFORE UPDATE ON public.services
  FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();

CREATE TRIGGER set_looking_for_posts_updated_at
  BEFORE UPDATE ON public.looking_for_posts
  FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();

CREATE TRIGGER set_bookings_updated_at
  BEFORE UPDATE ON public.bookings
  FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();

CREATE TRIGGER set_category_requests_updated_at
  BEFORE UPDATE ON public.category_requests
  FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();

CREATE TRIGGER set_payments_updated_at
  BEFORE UPDATE ON public.payments
  FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();

CREATE TRIGGER set_push_subscriptions_updated_at
  BEFORE UPDATE ON public.push_subscriptions
  FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();

-- Auto-create profile on auth.users insert
CREATE TRIGGER on_auth_user_created
  AFTER INSERT ON auth.users
  FOR EACH ROW EXECUTE FUNCTION public.handle_new_user();

-- Update provider rating on review insert/delete
CREATE TRIGGER on_review_insert
  AFTER INSERT ON public.reviews
  FOR EACH ROW EXECUTE FUNCTION public.update_provider_rating_on_review();

CREATE TRIGGER on_review_delete
  AFTER DELETE ON public.reviews
  FOR EACH ROW EXECUTE FUNCTION public.update_provider_rating_on_review_delete();

-- Messages: keep conversation ordering fresh and notify receiver (bell + Realtime)
CREATE OR REPLACE FUNCTION public.on_message_insert_bump_and_notify()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  UPDATE public.conversations
  SET last_message_at = NEW.created_at
  WHERE id = NEW.conversation_id;

  INSERT INTO public.notifications (user_id, type, title, body, data)
  VALUES (
    NEW.receiver_id,
    'message',
    'New message',
    LEFT(NEW.content, 160),
    jsonb_build_object(
      'conversation_id', NEW.conversation_id,
      'message_id', NEW.id,
      'path', '/chat/' || NEW.conversation_id::text
    )
  );

  RETURN NEW;
END;
$$;

CREATE TRIGGER trg_messages_after_insert_bump_notify
  AFTER INSERT ON public.messages
  FOR EACH ROW EXECUTE FUNCTION public.on_message_insert_bump_and_notify();

-- Notify all admins when a payment becomes disputed (escalation for refund / release in Admin Reports)
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

CREATE TRIGGER trg_payments_after_update_notify_admins_disputed
  AFTER UPDATE OF status ON public.payments
  FOR EACH ROW
  EXECUTE FUNCTION public.notify_admins_payment_disputed();

-- Supabase Realtime: required for live message/quote/booking delivery in the app (ignore if already registered)
DO $$
BEGIN
  ALTER PUBLICATION supabase_realtime ADD TABLE public.messages;
  ALTER PUBLICATION supabase_realtime ADD TABLE public.quotes;
  ALTER PUBLICATION supabase_realtime ADD TABLE public.bookings;
EXCEPTION
  WHEN OTHERS THEN
    NULL;
END
$$;

-- =============================================================================
-- ROW LEVEL SECURITY (RLS)
-- =============================================================================

ALTER TABLE public.category_requests ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.profiles ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.service_providers ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.service_categories ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.services ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.service_areas ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.looking_for_posts ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.looking_for_responses ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.bookings ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.conversations ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.messages ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.payments ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.reviews ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.notifications ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.push_subscriptions ENABLE ROW LEVEL SECURITY;

-- profiles: viewable by everyone, owner can UPDATE
CREATE POLICY "profiles_select_all" ON public.profiles
  FOR SELECT USING (true);

CREATE POLICY "profiles_update_owner" ON public.profiles
  FOR UPDATE USING (auth.uid() = id);

-- service_providers: viewable by everyone, owner can INSERT/UPDATE
CREATE POLICY "service_providers_select_all" ON public.service_providers
  FOR SELECT USING (true);

CREATE POLICY "service_providers_insert_owner" ON public.service_providers
  FOR INSERT WITH CHECK (auth.uid() = profile_id);

CREATE POLICY "service_providers_update_owner" ON public.service_providers
  FOR UPDATE USING (auth.uid() = profile_id);

-- services: viewable by everyone, provider owner can INSERT/UPDATE/DELETE
CREATE POLICY "services_select_all" ON public.services
  FOR SELECT USING (true);

CREATE POLICY "services_insert_provider" ON public.services
  FOR INSERT WITH CHECK (
    EXISTS (
      SELECT 1 FROM public.service_providers
      WHERE id = provider_id AND profile_id = auth.uid()
    )
  );

CREATE POLICY "services_update_provider" ON public.services
  FOR UPDATE USING (
    EXISTS (
      SELECT 1 FROM public.service_providers
      WHERE id = provider_id AND profile_id = auth.uid()
    )
  );

CREATE POLICY "services_delete_provider" ON public.services
  FOR DELETE USING (
    EXISTS (
      SELECT 1 FROM public.service_providers
      WHERE id = provider_id AND profile_id = auth.uid()
    )
  );

-- service_areas: viewable by everyone, provider owner can INSERT/UPDATE/DELETE
CREATE POLICY "service_areas_select_all" ON public.service_areas
  FOR SELECT USING (true);

CREATE POLICY "service_areas_insert_provider" ON public.service_areas
  FOR INSERT WITH CHECK (
    EXISTS (
      SELECT 1 FROM public.service_providers
      WHERE id = provider_id AND profile_id = auth.uid()
    )
  );

CREATE POLICY "service_areas_update_provider" ON public.service_areas
  FOR UPDATE USING (
    EXISTS (
      SELECT 1 FROM public.service_providers
      WHERE id = provider_id AND profile_id = auth.uid()
    )
  );

CREATE POLICY "service_areas_delete_provider" ON public.service_areas
  FOR DELETE USING (
    EXISTS (
      SELECT 1 FROM public.service_providers
      WHERE id = provider_id AND profile_id = auth.uid()
    )
  );

-- looking_for_posts: active viewable by all, customer can INSERT/UPDATE own
CREATE POLICY "looking_for_posts_select_active_or_owner" ON public.looking_for_posts
  FOR SELECT USING (
    status = 'active' OR customer_id = auth.uid()
  );

CREATE POLICY "looking_for_posts_insert_customer" ON public.looking_for_posts
  FOR INSERT WITH CHECK (auth.uid() = customer_id);

CREATE POLICY "looking_for_posts_update_customer" ON public.looking_for_posts
  FOR UPDATE USING (auth.uid() = customer_id);

-- looking_for_responses: viewable by post owner and response owner, provider can INSERT
CREATE POLICY "looking_for_responses_select_post_or_response_owner" ON public.looking_for_responses
  FOR SELECT USING (
    EXISTS (SELECT 1 FROM public.looking_for_posts WHERE id = post_id AND customer_id = auth.uid())
    OR EXISTS (SELECT 1 FROM public.service_providers WHERE id = provider_id AND profile_id = auth.uid())
  );

CREATE POLICY "looking_for_responses_insert_provider" ON public.looking_for_responses
  FOR INSERT WITH CHECK (
    EXISTS (
      SELECT 1 FROM public.service_providers
      WHERE id = provider_id AND profile_id = auth.uid()
    )
  );

-- bookings: viewable by involved parties, can be created by involved parties, involved parties can UPDATE
CREATE POLICY "bookings_select_involved" ON public.bookings
  FOR SELECT USING (
    customer_id = auth.uid()
    OR EXISTS (SELECT 1 FROM public.service_providers WHERE id = provider_id AND profile_id = auth.uid())
  );

CREATE POLICY "bookings_insert_involved" ON public.bookings
  FOR INSERT WITH CHECK (
    customer_id = auth.uid()
    OR EXISTS (SELECT 1 FROM public.service_providers WHERE id = provider_id AND profile_id = auth.uid())
  );

CREATE POLICY "bookings_update_involved" ON public.bookings
  FOR UPDATE USING (
    customer_id = auth.uid()
    OR EXISTS (SELECT 1 FROM public.service_providers WHERE id = provider_id AND profile_id = auth.uid())
  );

CREATE POLICY "bookings_select_admin" ON public.bookings
  FOR SELECT USING (
    EXISTS (SELECT 1 FROM public.profiles WHERE id = auth.uid() AND role = 'admin')
  );

-- conversations: viewable by participants
CREATE POLICY "conversations_select_participants" ON public.conversations
  FOR SELECT USING (
    participant_1 = auth.uid() OR participant_2 = auth.uid()
  );

CREATE POLICY "conversations_insert_participants" ON public.conversations
  FOR INSERT WITH CHECK (
    participant_1 = auth.uid() OR participant_2 = auth.uid()
  );

-- messages: viewable by sender or receiver, sender can INSERT
CREATE POLICY "messages_select_sender_or_receiver" ON public.messages
  FOR SELECT USING (
    sender_id = auth.uid() OR receiver_id = auth.uid()
  );

CREATE POLICY "messages_insert_sender" ON public.messages
  FOR INSERT WITH CHECK (auth.uid() = sender_id);

-- payments: viewable by booking parties, can be created by booking parties
CREATE POLICY "payments_select_booking_parties" ON public.payments
  FOR SELECT USING (
    EXISTS (
      SELECT 1 FROM public.bookings b
      WHERE b.id = booking_id
      AND (b.customer_id = auth.uid() OR EXISTS (SELECT 1 FROM public.service_providers WHERE id = b.provider_id AND profile_id = auth.uid()))
    )
  );

CREATE POLICY "payments_select_admin" ON public.payments
  FOR SELECT USING (
    EXISTS (SELECT 1 FROM public.profiles WHERE id = auth.uid() AND role = 'admin')
  );

CREATE POLICY "payments_insert_booking_parties" ON public.payments
  FOR INSERT WITH CHECK (
    EXISTS (
      SELECT 1 FROM public.bookings b
      WHERE b.id = booking_id
      AND (b.customer_id = auth.uid() OR EXISTS (SELECT 1 FROM public.service_providers WHERE id = b.provider_id AND profile_id = auth.uid()))
    )
  );

-- reviews: viewable by all, customer can INSERT for completed bookings
CREATE POLICY "reviews_select_all" ON public.reviews
  FOR SELECT USING (true);

CREATE POLICY "reviews_insert_customer_completed" ON public.reviews
  FOR INSERT WITH CHECK (
    auth.uid() = customer_id
    AND EXISTS (
      SELECT 1 FROM public.bookings
      WHERE id = booking_id AND status = 'completed'
    )
  );

-- notifications: viewable by owner, owner can UPDATE (mark read)
CREATE POLICY "notifications_select_owner" ON public.notifications
  FOR SELECT USING (auth.uid() = user_id);

CREATE POLICY "notifications_update_owner" ON public.notifications
  FOR UPDATE USING (auth.uid() = user_id);

-- notifications: INSERT allowed for self (system notifications use service role)
CREATE POLICY "notifications_insert_owner" ON public.notifications
  FOR INSERT WITH CHECK (auth.uid() = user_id);

CREATE POLICY "push_subscriptions_select_own" ON public.push_subscriptions
  FOR SELECT USING (auth.uid() = user_id);

CREATE POLICY "push_subscriptions_insert_own" ON public.push_subscriptions
  FOR INSERT WITH CHECK (auth.uid() = user_id);

CREATE POLICY "push_subscriptions_update_own" ON public.push_subscriptions
  FOR UPDATE USING (auth.uid() = user_id);

CREATE POLICY "push_subscriptions_delete_own" ON public.push_subscriptions
  FOR DELETE USING (auth.uid() = user_id);

-- service_categories: viewable by everyone, admin can INSERT/UPDATE/DELETE
CREATE POLICY "service_categories_select_all" ON public.service_categories
  FOR SELECT USING (true);

CREATE POLICY "service_categories_insert_admin" ON public.service_categories
  FOR INSERT WITH CHECK (
    EXISTS (SELECT 1 FROM public.profiles WHERE id = auth.uid() AND role = 'admin')
  );

CREATE POLICY "service_categories_update_admin" ON public.service_categories
  FOR UPDATE USING (
    EXISTS (SELECT 1 FROM public.profiles WHERE id = auth.uid() AND role = 'admin')
  );

CREATE POLICY "service_categories_delete_admin" ON public.service_categories
  FOR DELETE USING (
    EXISTS (SELECT 1 FROM public.profiles WHERE id = auth.uid() AND role = 'admin')
  );

-- category_requests: viewable by requester and admins, providers can INSERT, admins can UPDATE
CREATE POLICY "category_requests_select" ON public.category_requests
  FOR SELECT USING (
    requested_by = auth.uid()
    OR EXISTS (SELECT 1 FROM public.profiles WHERE id = auth.uid() AND role = 'admin')
  );

CREATE POLICY "category_requests_insert_provider" ON public.category_requests
  FOR INSERT WITH CHECK (
    auth.uid() = requested_by
    AND EXISTS (SELECT 1 FROM public.profiles WHERE id = auth.uid() AND role = 'provider')
  );

CREATE POLICY "category_requests_update_admin" ON public.category_requests
  FOR UPDATE USING (
    EXISTS (SELECT 1 FROM public.profiles WHERE id = auth.uid() AND role = 'admin')
  );

-- payments: allow UPDATE by booking parties (for confirming satisfaction)
CREATE POLICY "payments_update_booking_parties" ON public.payments
  FOR UPDATE USING (
    EXISTS (
      SELECT 1 FROM public.bookings b
      WHERE b.id = booking_id
      AND (b.customer_id = auth.uid() OR EXISTS (SELECT 1 FROM public.service_providers WHERE id = b.provider_id AND profile_id = auth.uid()))
    )
  );

-- =============================================================================
-- SEED DATA: service_categories
-- =============================================================================

INSERT INTO public.service_categories (name, icon, description) VALUES
  ('Plumbing', 'wrench', 'Pipe installation, repairs, drain cleaning, and plumbing maintenance'),
  ('Electrical', 'zap', 'Wiring, electrical repairs, installations, and maintenance'),
  ('Cleaning', 'sparkles', 'House cleaning, office cleaning, and deep cleaning services'),
  ('Painting', 'paintbrush', 'Interior and exterior painting, wall finishes, and decor'),
  ('Carpentry', 'hammer', 'Woodwork, furniture making, repairs, and custom carpentry'),
  ('Gardening & Landscaping', 'trees', 'Garden design, lawn care, landscaping, and plant maintenance'),
  ('Moving & Transport', 'truck', 'Moving services, furniture transport, and logistics'),
  ('Tutoring & Education', 'book-open', 'Private tutoring, lessons, and educational support'),
  ('Photography', 'camera', 'Event photography, portraits, and professional photo services'),
  ('Catering', 'utensils-crossed', 'Event catering, food preparation, and meal services'),
  ('Beauty & Salon', 'scissors', 'Hair styling, beauty treatments, and salon services'),
  ('Auto Repair & Mechanic', 'car', 'Vehicle repairs, maintenance, and mechanic services'),
  ('IT & Computer Repair', 'monitor', 'Computer repair, IT support, and tech services'),
  ('Construction', 'hard-hat', 'Building construction, renovations, and structural work'),
  ('Welding', 'flame', 'Metal welding, fabrication, and welding repairs'),
  ('Tiling', 'layout-grid', 'Floor tiling, wall tiling, and tile installation'),
  ('Air Conditioning & HVAC', 'wind', 'AC installation, HVAC repair, and climate control'),
  ('Security Services', 'shield', 'Security systems, guards, and safety services'),
  ('Event Planning', 'calendar', 'Event organization, coordination, and planning'),
  ('Tailoring & Fashion', 'shirt', 'Custom tailoring, alterations, and fashion services');
