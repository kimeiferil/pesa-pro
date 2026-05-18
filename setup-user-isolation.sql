-- ============================================================
-- PESA PRO - USER ISOLATION WITH RLS POLICIES
-- Run this in your Supabase SQL Editor
-- ============================================================

-- ============================================================
-- 1. CREATE PROFILES TABLE (extends auth.users)
-- ============================================================
CREATE TABLE IF NOT EXISTS public.profiles (
  id UUID PRIMARY KEY REFERENCES auth.users(id) ON DELETE CASCADE,
  email TEXT,
  full_name TEXT,
  avatar_url TEXT,
  phone TEXT,
  role TEXT DEFAULT 'user',
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  total_campaigns INTEGER DEFAULT 0,
  total_raised DECIMAL(12,2) DEFAULT 0,
  total_donated DECIMAL(12,2) DEFAULT 0
);

-- ============================================================
-- 2. CREATE TRANSACTIONS TABLE WITH USER_ID
-- ============================================================
CREATE TABLE IF NOT EXISTS public.mpesa_transactions (
  id SERIAL PRIMARY KEY,
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  transaction_code TEXT UNIQUE,
  amount DECIMAL(12,2) NOT NULL,
  sender_name TEXT,
  sender_phone TEXT,
  date TIMESTAMP WITH TIME ZONE,
  message TEXT,
  type TEXT DEFAULT 'received',
  status TEXT DEFAULT 'confirmed',
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- ============================================================
-- 3. CREATE CAMPAIGNS TABLE WITH USER_ID
-- ============================================================
CREATE TABLE IF NOT EXISTS public.campaigns (
  id SERIAL PRIMARY KEY,
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  title TEXT NOT NULL,
  slug TEXT,
  description TEXT,
  target_amount DECIMAL(12,2) NOT NULL,
  current_amount DECIMAL(12,2) DEFAULT 0,
  status TEXT DEFAULT 'active',
  cover_image_url TEXT,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- ============================================================
-- 4. CREATE CAMPAIGN CONTRIBUTIONS TABLE
-- ============================================================
CREATE TABLE IF NOT EXISTS public.campaign_contributions (
  id SERIAL PRIMARY KEY,
  campaign_id INTEGER REFERENCES public.campaigns(id) ON DELETE CASCADE,
  user_id UUID REFERENCES auth.users(id) ON DELETE SET NULL,
  donor_name TEXT,
  donor_email TEXT,
  amount DECIMAL(12,2) NOT NULL,
  transaction_code TEXT,
  message TEXT,
  status TEXT DEFAULT 'confirmed',
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- ============================================================
-- 5. ENABLE ROW LEVEL SECURITY ON ALL TABLES
-- ============================================================
ALTER TABLE public.profiles ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.mpesa_transactions ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.campaigns ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.campaign_contributions ENABLE ROW LEVEL SECURITY;

-- ============================================================
-- 6. CREATE RLS POLICIES FOR PROFILES
-- ============================================================
DROP POLICY IF EXISTS "Users can view own profile" ON public.profiles;
CREATE POLICY "Users can view own profile" ON public.profiles
  FOR SELECT USING (auth.uid() = id);

DROP POLICY IF EXISTS "Users can update own profile" ON public.profiles;
CREATE POLICY "Users can update own profile" ON public.profiles
  FOR UPDATE USING (auth.uid() = id);

DROP POLICY IF EXISTS "Users can insert own profile" ON public.profiles;
CREATE POLICY "Users can insert own profile" ON public.profiles
  FOR INSERT WITH CHECK (auth.uid() = id);

-- ============================================================
-- 7. CREATE RLS POLICIES FOR TRANSACTIONS (CRITICAL!)
-- ============================================================
DROP POLICY IF EXISTS "Users can view own transactions" ON public.mpesa_transactions;
CREATE POLICY "Users can view own transactions" ON public.mpesa_transactions
  FOR SELECT USING (auth.uid() = user_id);

DROP POLICY IF EXISTS "Users can insert own transactions" ON public.mpesa_transactions;
CREATE POLICY "Users can insert own transactions" ON public.mpesa_transactions
  FOR INSERT WITH CHECK (auth.uid() = user_id);

DROP POLICY IF EXISTS "Users can update own transactions" ON public.mpesa_transactions;
CREATE POLICY "Users can update own transactions" ON public.mpesa_transactions
  FOR UPDATE USING (auth.uid() = user_id);

DROP POLICY IF EXISTS "Users can delete own transactions" ON public.mpesa_transactions;
CREATE POLICY "Users can delete own transactions" ON public.mpesa_transactions
  FOR DELETE USING (auth.uid() = user_id);

-- ============================================================
-- 8. CREATE RLS POLICIES FOR CAMPAIGNS
-- ============================================================
DROP POLICY IF EXISTS "Users can view own campaigns" ON public.campaigns;
CREATE POLICY "Users can view own campaigns" ON public.campaigns
  FOR SELECT USING (auth.uid() = user_id);

DROP POLICY IF EXISTS "Users can view active campaigns" ON public.campaigns;
CREATE POLICY "Users can view active campaigns" ON public.campaigns
  FOR SELECT USING (status = 'active');

DROP POLICY IF EXISTS "Users can insert campaigns" ON public.campaigns;
CREATE POLICY "Users can insert campaigns" ON public.campaigns
  FOR INSERT WITH CHECK (auth.uid() = user_id);

DROP POLICY IF EXISTS "Users can update own campaigns" ON public.campaigns;
CREATE POLICY "Users can update own campaigns" ON public.campaigns
  FOR UPDATE USING (auth.uid() = user_id);

DROP POLICY IF EXISTS "Users can delete own campaigns" ON public.campaigns;
CREATE POLICY "Users can delete own campaigns" ON public.campaigns
  FOR DELETE USING (auth.uid() = user_id);

-- ============================================================
-- 9. AUTO-CREATE PROFILE ON SIGNUP
-- ============================================================
CREATE OR REPLACE FUNCTION public.handle_new_user()
RETURNS TRIGGER AS $$
BEGIN
  INSERT INTO public.profiles (id, email, full_name, created_at)
  VALUES (
    NEW.id,
    NEW.email,
    NEW.raw_user_meta_data->>'full_name',
    NOW()
  );
  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

DROP TRIGGER IF EXISTS on_auth_user_created ON auth.users;
CREATE TRIGGER on_auth_user_created
  AFTER INSERT ON auth.users
  FOR EACH ROW EXECUTE FUNCTION public.handle_new_user();

-- ============================================================
-- 10. CREATE INDEXES FOR PERFORMANCE
-- ============================================================
CREATE INDEX IF NOT EXISTS idx_transactions_user_id ON public.mpesa_transactions(user_id);
CREATE INDEX IF NOT EXISTS idx_transactions_date ON public.mpesa_transactions(date DESC);
CREATE INDEX IF NOT EXISTS idx_campaigns_user_id ON public.campaigns(user_id);
CREATE INDEX IF NOT EXISTS idx_contributions_campaign_id ON public.campaign_contributions(campaign_id);

-- ============================================================
-- 11. VERIFY RLS IS ENABLED
-- ============================================================
SELECT tablename, rowsecurity FROM pg_tables WHERE schemaname = 'public' AND tablename IN ('profiles', 'mpesa_transactions', 'campaigns', 'campaign_contributions');
