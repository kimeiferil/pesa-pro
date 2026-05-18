-- PESA PRO CAMPAIGNS - COMPLETE DATABASE SETUP WITH USER ISOLATION
-- Run this in your Supabase SQL editor

-- Enable UUID extension
CREATE EXTENSION IF NOT EXISTS "uuid-ossp";

-- ============================================================
-- PROFILES TABLE (extends auth.users)
-- ============================================================
CREATE TABLE IF NOT EXISTS public.profiles (
  id UUID PRIMARY KEY REFERENCES auth.users(id) ON DELETE CASCADE,
  email TEXT,
  full_name TEXT,
  avatar_url TEXT,
  phone TEXT,
  role TEXT DEFAULT 'user',
  is_active BOOLEAN DEFAULT true,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  preferences JSONB DEFAULT '{}'::jsonb,
  total_campaigns INTEGER DEFAULT 0,
  total_raised DECIMAL(12,2) DEFAULT 0,
  total_donated DECIMAL(12,2) DEFAULT 0
);

-- ============================================================
-- CAMPAIGN CATEGORIES
-- ============================================================
CREATE TABLE IF NOT EXISTS public.campaign_categories (
  id SERIAL PRIMARY KEY,
  name TEXT NOT NULL UNIQUE,
  slug TEXT NOT NULL UNIQUE,
  icon TEXT,
  description TEXT,
  color_scheme JSONB,
  is_active BOOLEAN DEFAULT true,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

INSERT INTO public.campaign_categories (name, slug, icon, description) VALUES
  ('Medical', 'medical', '🏥', 'Medical treatment and hospital bills'),
  ('Harambee', 'harambee', '🤝', 'Community fundraising event'),
  ('Funeral', 'funeral', '🕊️', 'Funeral expense support'),
  ('Fundraising', 'fundraising', '💰', 'General fundraising campaign'),
  ('Education', 'education', '📚', 'School fees and educational support'),
  ('Religious', 'religious', '⛪', 'Church and religious causes'),
  ('Celebration', 'celebration', '🎉', 'Celebration and thanksgiving'),
  ('Other', 'other', '📌', 'Other charitable causes')
ON CONFLICT (name) DO NOTHING;

-- ============================================================
-- CAMPAIGNS TABLE (Owned by users)
-- ============================================================
CREATE TABLE IF NOT EXISTS public.campaigns (
  id SERIAL PRIMARY KEY,
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  title TEXT NOT NULL,
  slug TEXT UNIQUE,
  category_id INTEGER REFERENCES public.campaign_categories(id),
  description TEXT,
  target_amount DECIMAL(12,2) NOT NULL CHECK (target_amount >= 0),
  current_amount DECIMAL(12,2) DEFAULT 0 CHECK (current_amount >= 0),
  minimum_contribution DECIMAL(10,2) DEFAULT 100,
  paybill_number TEXT,
  account_number TEXT,
  till_number TEXT,
  payment_details TEXT,
  payment_instructions TEXT,
  start_date DATE,
  end_date DATE,
  beneficiary_name TEXT,
  beneficiary_contact TEXT,
  beneficiary_image_url TEXT,
  beneficiary_story TEXT,
  cover_image_url TEXT,
  support_documents TEXT[],
  gallery_images TEXT[],
  status TEXT DEFAULT 'draft' CHECK (status IN ('draft', 'active', 'completed', 'cancelled', 'paused')),
  is_urgent BOOLEAN DEFAULT false,
  is_featured BOOLEAN DEFAULT false,
  share_count INTEGER DEFAULT 0,
  view_count INTEGER DEFAULT 0,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  metadata JSONB DEFAULT '{}'::jsonb
);

-- ============================================================
-- CAMPAIGN CONTRIBUTIONS
-- ============================================================
CREATE TABLE IF NOT EXISTS public.campaign_contributions (
  id SERIAL PRIMARY KEY,
  campaign_id INTEGER NOT NULL REFERENCES public.campaigns(id) ON DELETE CASCADE,
  user_id UUID REFERENCES auth.users(id) ON DELETE SET NULL,
  donor_name TEXT,
  donor_email TEXT,
  donor_phone TEXT,
  donor_anonymous BOOLEAN DEFAULT false,
  amount DECIMAL(12,2) NOT NULL CHECK (amount > 0),
  transaction_code TEXT UNIQUE,
  message TEXT,
  payment_method TEXT DEFAULT 'M-Pesa',
  payment_channel TEXT,
  paybill_number TEXT,
  account_number TEXT,
  status TEXT DEFAULT 'pending' CHECK (status IN ('pending', 'confirmed', 'failed', 'refunded')),
  is_first_contribution BOOLEAN DEFAULT false,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  confirmed_at TIMESTAMP WITH TIME ZONE,
  metadata JSONB DEFAULT '{}'::jsonb
);

-- ============================================================
-- USER CONTRIBUTIONS HISTORY
-- ============================================================
CREATE TABLE IF NOT EXISTS public.user_contributions (
  id SERIAL PRIMARY KEY,
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  contribution_id INTEGER REFERENCES public.campaign_contributions(id),
  campaign_id INTEGER REFERENCES public.campaigns(id),
  amount DECIMAL(12,2),
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- ============================================================
-- CAMPAIGN UPDATES
-- ============================================================
CREATE TABLE IF NOT EXISTS public.campaign_updates (
  id SERIAL PRIMARY KEY,
  campaign_id INTEGER NOT NULL REFERENCES public.campaigns(id) ON DELETE CASCADE,
  user_id UUID REFERENCES auth.users(id),
  title TEXT NOT NULL,
  content TEXT,
  image_url TEXT,
  milestone_amount DECIMAL(12,2),
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- ============================================================
-- INDEXES
-- ============================================================
CREATE INDEX IF NOT EXISTS idx_campaigns_user_id ON public.campaigns(user_id);
CREATE INDEX IF NOT EXISTS idx_campaigns_status ON public.campaigns(status);
CREATE INDEX IF NOT EXISTS idx_campaigns_user_status ON public.campaigns(user_id, status);
CREATE INDEX IF NOT EXISTS idx_contributions_campaign_id ON public.campaign_contributions(campaign_id);
CREATE INDEX IF NOT EXISTS idx_contributions_user_id ON public.campaign_contributions(user_id);
CREATE INDEX IF NOT EXISTS idx_contributions_status ON public.campaign_contributions(status);
CREATE INDEX IF NOT EXISTS idx_contributions_transaction ON public.campaign_contributions(transaction_code);
CREATE INDEX IF NOT EXISTS idx_user_contributions_user_id ON public.user_contributions(user_id);
CREATE INDEX IF NOT EXISTS idx_updates_campaign_id ON public.campaign_updates(campaign_id);

-- ============================================================
-- ROW LEVEL SECURITY POLICIES
-- ============================================================
ALTER TABLE public.profiles ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.campaigns ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.campaign_contributions ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.campaign_updates ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.user_contributions ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.campaign_categories ENABLE ROW LEVEL SECURITY;

-- Profiles policies
CREATE POLICY "Users can view own profile" ON public.profiles FOR SELECT USING (auth.uid() = id);
CREATE POLICY "Users can update own profile" ON public.profiles FOR UPDATE USING (auth.uid() = id);
CREATE POLICY "Users can insert own profile" ON public.profiles FOR INSERT WITH CHECK (auth.uid() = id);

-- Campaigns policies (CRITICAL for user isolation)
CREATE POLICY "Users can view own campaigns" ON public.campaigns FOR SELECT TO authenticated USING (user_id = auth.uid());
CREATE POLICY "Anyone can view active campaigns" ON public.campaigns FOR SELECT TO anon, authenticated USING (status = 'active');
CREATE POLICY "Users can create campaigns" ON public.campaigns FOR INSERT TO authenticated WITH CHECK (user_id = auth.uid());
CREATE POLICY "Users can update own campaigns" ON public.campaigns FOR UPDATE TO authenticated USING (user_id = auth.uid()) WITH CHECK (user_id = auth.uid());
CREATE POLICY "Users can delete own campaigns" ON public.campaigns FOR DELETE TO authenticated USING (user_id = auth.uid());

-- Contributions policies
CREATE POLICY "Campaign owners can view contributions" ON public.campaign_contributions FOR SELECT TO authenticated USING (EXISTS (SELECT 1 FROM public.campaigns WHERE campaigns.id = campaign_contributions.campaign_id AND campaigns.user_id = auth.uid()));
CREATE POLICY "Donors can view their contributions" ON public.campaign_contributions FOR SELECT TO authenticated USING (user_id = auth.uid());
CREATE POLICY "Anyone can view confirmed contributions" ON public.campaign_contributions FOR SELECT TO anon, authenticated USING (status = 'confirmed');
CREATE POLICY "Users can make contributions" ON public.campaign_contributions FOR INSERT TO authenticated WITH CHECK ((user_id IS NULL OR user_id = auth.uid()));
CREATE POLICY "Campaign owners can update contributions" ON public.campaign_contributions FOR UPDATE TO authenticated USING (EXISTS (SELECT 1 FROM public.campaigns WHERE campaigns.id = campaign_contributions.campaign_id AND campaigns.user_id = auth.uid()));

-- Categories policies
CREATE POLICY "Anyone can view categories" ON public.campaign_categories FOR SELECT TO anon, authenticated USING (is_active = true);

-- ============================================================
-- TRIGGERS AND FUNCTIONS
-- ============================================================
CREATE OR REPLACE FUNCTION public.handle_new_user()
RETURNS TRIGGER AS \$\$
BEGIN
  INSERT INTO public.profiles (id, email, full_name, created_at)
  VALUES (NEW.id, NEW.email, NEW.raw_user_meta_data->>'full_name', NOW());
  RETURN NEW;
END;
\$\$ LANGUAGE plpgsql SECURITY DEFINER;

DROP TRIGGER IF EXISTS on_auth_user_created ON auth.users;
CREATE TRIGGER on_auth_user_created AFTER INSERT ON auth.users FOR EACH ROW EXECUTE FUNCTION public.handle_new_user();

CREATE OR REPLACE FUNCTION public.update_campaign_amount()
RETURNS TRIGGER AS \$\$
BEGIN
  IF TG_OP = 'INSERT' AND NEW.status = 'confirmed' THEN
    UPDATE public.campaigns SET current_amount = current_amount + NEW.amount, updated_at = NOW() WHERE id = NEW.campaign_id;
  ELSIF TG_OP = 'UPDATE' AND NEW.status = 'confirmed' AND OLD.status != 'confirmed' THEN
    UPDATE public.campaigns SET current_amount = current_amount + NEW.amount, updated_at = NOW() WHERE id = NEW.campaign_id;
  ELSIF TG_OP = 'UPDATE' AND NEW.status != 'confirmed' AND OLD.status = 'confirmed' THEN
    UPDATE public.campaigns SET current_amount = current_amount - OLD.amount, updated_at = NOW() WHERE id = NEW.campaign_id;
  END IF;
  RETURN NEW;
END;
\$\$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS trigger_update_campaign_amount ON public.campaign_contributions;
CREATE TRIGGER trigger_update_campaign_amount AFTER INSERT OR UPDATE OF status ON public.campaign_contributions FOR EACH ROW EXECUTE FUNCTION public.update_campaign_amount();

-- ============================================================
-- USEFUL VIEWS
-- ============================================================
CREATE OR REPLACE VIEW public.user_dashboard_stats AS
SELECT p.id as user_id, p.full_name, p.email,
  COUNT(DISTINCT c.id) as total_campaigns,
  COALESCE(SUM(c.current_amount), 0) as total_raised,
  COALESCE(SUM(uc.amount), 0) as total_donated
FROM public.profiles p
LEFT JOIN public.campaigns c ON c.user_id = p.id
LEFT JOIN public.user_contributions uc ON uc.user_id = p.id
WHERE p.id = auth.uid()
GROUP BY p.id, p.full_name, p.email;

CREATE OR REPLACE VIEW public.user_campaigns_view AS
SELECT c.*, cat.name as category_name, cat.icon as category_icon,
  COUNT(DISTINCT contrib.id) as total_donors,
  ROUND((c.current_amount / NULLIF(c.target_amount, 0)) * 100, 2) as percentage_complete
FROM public.campaigns c
LEFT JOIN public.campaign_categories cat ON c.category_id = cat.id
LEFT JOIN public.campaign_contributions contrib ON contrib.campaign_id = c.id AND contrib.status = 'confirmed'
WHERE c.user_id = auth.uid()
GROUP BY c.id, cat.name, cat.icon
ORDER BY c.created_at DESC;
