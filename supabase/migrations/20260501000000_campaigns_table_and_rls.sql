-- ============================================================
-- COMPLETE PESA PRO CAMPAIGNS SCHEMA (OPTIMIZED)
-- ============================================================

-- ============================================================
-- 1. CAMPAIGN CATEGORIES TABLE
-- ============================================================
CREATE TABLE IF NOT EXISTS campaign_categories (
  id SERIAL PRIMARY KEY,
  name TEXT NOT NULL UNIQUE,
  slug TEXT NOT NULL UNIQUE,
  icon TEXT,
  description TEXT,
  color_scheme JSONB,
  is_active BOOLEAN DEFAULT true,
  display_order INTEGER DEFAULT 0,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

INSERT INTO campaign_categories (name, slug, icon, description, display_order) VALUES
  ('Medical', 'medical', '🏥', 'Medical treatment and hospital bills', 1),
  ('Harambee', 'harambee', '🤝', 'Community fundraising event', 2),
  ('Funeral', 'funeral', '🕊️', 'Funeral expense support', 3),
  ('Fundraising', 'fundraising', '💰', 'General fundraising campaign', 4),
  ('Education', 'education', '📚', 'School fees and educational support', 5),
  ('Religious', 'religious', '⛪', 'Church and religious causes', 6),
  ('Celebration', 'celebration', '🎉', 'Celebration and thanksgiving', 7),
  ('Other', 'other', '📌', 'Other charitable causes', 8)
ON CONFLICT (name) DO NOTHING;

-- ============================================================
-- 2. CAMPAIGNS TABLE (Main)
-- ============================================================
CREATE TABLE IF NOT EXISTS campaigns (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),

  -- Basic Information
  title TEXT NOT NULL,
  slug TEXT UNIQUE,
  category_id INTEGER REFERENCES campaign_categories(id),
  category TEXT,
  description TEXT,

  -- Financial Information
  target_amount NUMERIC(12,2) NOT NULL DEFAULT 0 CHECK (target_amount >= 0),
  minimum_contribution NUMERIC(10,2) DEFAULT 100 CHECK (minimum_contribution >= 0),
  current_amount NUMERIC(12,2) NOT NULL DEFAULT 0,

  -- Payment Details (M-Pesa specific)
  paybill_number TEXT,
  account_number TEXT,
  till_number TEXT,
  payment_details TEXT,
  payment_instructions TEXT,

  -- Timing
  start_date DATE,
  end_date DATE,

  -- Beneficiary Information
  beneficiary_name TEXT,
  beneficiary_contact TEXT,
  beneficiary_image_url TEXT,
  beneficiary_story TEXT,

  -- Media & Documents
  cover_image_url TEXT,
  support_documents TEXT[],
  gallery_images TEXT[],

  -- Status & Tracking
  status TEXT NOT NULL DEFAULT 'active' CHECK (status IN ('draft', 'active', 'completed', 'cancelled', 'paused')),
  is_urgent BOOLEAN DEFAULT false,
  is_featured BOOLEAN DEFAULT false,

  -- Sharing & Analytics
  share_count INTEGER DEFAULT 0,
  view_count INTEGER DEFAULT 0,

  -- Creator Information
  created_by UUID REFERENCES auth.users(id) ON DELETE SET NULL,
  created_by_name TEXT,
  created_by_email TEXT,

  -- Timestamps
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW(),

  -- Metadata
  metadata JSONB DEFAULT '{}'::jsonb
);

ALTER TABLE campaigns ENABLE ROW LEVEL SECURITY;

-- Ensure expected columns exist on existing campaigns tables
ALTER TABLE campaigns
  ADD COLUMN IF NOT EXISTS category_id INTEGER REFERENCES campaign_categories(id),
  ADD COLUMN IF NOT EXISTS category TEXT,
  ADD COLUMN IF NOT EXISTS description TEXT,
  ADD COLUMN IF NOT EXISTS target_amount NUMERIC(12,2) DEFAULT 0 CHECK (target_amount >= 0),
  ADD COLUMN IF NOT EXISTS minimum_contribution NUMERIC(10,2) DEFAULT 100 CHECK (minimum_contribution >= 0),
  ADD COLUMN IF NOT EXISTS current_amount NUMERIC(12,2) NOT NULL DEFAULT 0,
  ADD COLUMN IF NOT EXISTS paybill_number TEXT,
  ADD COLUMN IF NOT EXISTS account_number TEXT,
  ADD COLUMN IF NOT EXISTS till_number TEXT,
  ADD COLUMN IF NOT EXISTS payment_details TEXT,
  ADD COLUMN IF NOT EXISTS payment_instructions TEXT,
  ADD COLUMN IF NOT EXISTS start_date DATE,
  ADD COLUMN IF NOT EXISTS end_date DATE,
  ADD COLUMN IF NOT EXISTS beneficiary_name TEXT,
  ADD COLUMN IF NOT EXISTS beneficiary_contact TEXT,
  ADD COLUMN IF NOT EXISTS beneficiary_image_url TEXT,
  ADD COLUMN IF NOT EXISTS beneficiary_story TEXT,
  ADD COLUMN IF NOT EXISTS cover_image_url TEXT,
  ADD COLUMN IF NOT EXISTS support_documents TEXT[],
  ADD COLUMN IF NOT EXISTS gallery_images TEXT[],
  ADD COLUMN IF NOT EXISTS status TEXT DEFAULT 'active' CHECK (status IN ('draft', 'active', 'completed', 'cancelled', 'paused')),
  ADD COLUMN IF NOT EXISTS is_urgent BOOLEAN DEFAULT false,
  ADD COLUMN IF NOT EXISTS is_featured BOOLEAN DEFAULT false,
  ADD COLUMN IF NOT EXISTS share_count INTEGER DEFAULT 0,
  ADD COLUMN IF NOT EXISTS view_count INTEGER DEFAULT 0,
  ADD COLUMN IF NOT EXISTS created_by UUID REFERENCES auth.users(id) ON DELETE SET NULL,
  ADD COLUMN IF NOT EXISTS created_by_name TEXT,
  ADD COLUMN IF NOT EXISTS created_by_email TEXT,
  ADD COLUMN IF NOT EXISTS created_at TIMESTAMPTZ DEFAULT NOW(),
  ADD COLUMN IF NOT EXISTS updated_at TIMESTAMPTZ DEFAULT NOW(),
  ADD COLUMN IF NOT EXISTS metadata JSONB DEFAULT '{}'::jsonb;

-- Optimized Indexes for campaigns
CREATE INDEX IF NOT EXISTS idx_campaigns_status_created_at 
  ON campaigns(status, created_at DESC);

CREATE INDEX IF NOT EXISTS idx_campaigns_status_category_created 
  ON campaigns(status, category_id, created_at DESC);

CREATE INDEX IF NOT EXISTS idx_campaigns_is_urgent ON campaigns(is_urgent) 
  WHERE is_urgent = true;

CREATE INDEX IF NOT EXISTS idx_campaigns_is_featured ON campaigns(is_featured) 
  WHERE is_featured = true;

CREATE INDEX IF NOT EXISTS idx_campaigns_created_by ON campaigns(created_by);
CREATE INDEX IF NOT EXISTS idx_campaigns_slug ON campaigns(slug);

DROP POLICY IF EXISTS "Allow public select campaigns" ON campaigns;
DROP POLICY IF EXISTS "Allow public insert campaigns" ON campaigns;
DROP POLICY IF EXISTS "Allow campaign owners update campaigns" ON campaigns;
DROP POLICY IF EXISTS "Allow campaign owners delete campaigns" ON campaigns;

CREATE POLICY "Allow public select campaigns" ON campaigns
  FOR SELECT USING (true);

CREATE POLICY "Allow public insert campaigns" ON campaigns
  FOR INSERT WITH CHECK (auth.role() = 'anon' OR auth.role() = 'authenticated');

CREATE POLICY "Allow campaign owners update campaigns" ON campaigns
  FOR UPDATE USING (auth.uid()::text = created_by) WITH CHECK (auth.uid()::text = created_by);

CREATE POLICY "Allow campaign owners delete campaigns" ON campaigns
  FOR DELETE USING (auth.uid()::text = created_by);

-- ============================================================
-- 3. CAMPAIGN CONTRIBUTIONS TABLE
-- ============================================================
DO $$
DECLARE
  cid_type TEXT;
  create_type TEXT;
BEGIN
  SELECT data_type INTO cid_type
  FROM information_schema.columns
  WHERE table_name = 'campaigns' AND column_name = 'id';

  IF NOT EXISTS (SELECT 1 FROM pg_class WHERE relname = 'campaign_contributions' AND relkind = 'r') THEN
    create_type := CASE cid_type WHEN 'uuid' THEN 'UUID' ELSE 'INTEGER' END;
    EXECUTE format($sql$
      CREATE TABLE campaign_contributions (
        id SERIAL PRIMARY KEY,
        campaign_id %s NOT NULL REFERENCES campaigns(id) ON DELETE CASCADE,
        amount NUMERIC(12,2) NOT NULL CHECK (amount > 0),
        transaction_code TEXT UNIQUE,
        donor_name TEXT,
        donor_phone TEXT,
        donor_email TEXT,
        donor_anonymous BOOLEAN DEFAULT false,
        payment_method TEXT DEFAULT 'M-Pesa',
        payment_channel TEXT,
        paybill_number TEXT,
        account_number TEXT,
        message TEXT,
        is_first_contribution BOOLEAN DEFAULT false,
        status TEXT NOT NULL DEFAULT 'pending' CHECK (status IN (''pending'', ''confirmed'', ''failed'', ''refunded'')),
        created_at TIMESTAMPTZ DEFAULT NOW(),
        confirmed_at TIMESTAMPTZ,
        refunded_at TIMESTAMPTZ,
        metadata JSONB DEFAULT '{}'::jsonb
      );
    $sql$, create_type);
  END IF;
END $$;

-- Optimized Indexes for contributions
CREATE INDEX IF NOT EXISTS idx_contributions_campaign_status_created 
  ON campaign_contributions(campaign_id, status, created_at DESC);

CREATE INDEX IF NOT EXISTS idx_contributions_transaction_code 
  ON campaign_contributions(transaction_code);

CREATE INDEX IF NOT EXISTS idx_contributions_donor_phone 
  ON campaign_contributions(donor_phone);

CREATE INDEX IF NOT EXISTS idx_contributions_created_at 
  ON campaign_contributions(created_at DESC);

-- ============================================================
-- 4. CAMPAIGN UPDATES / PROGRESS POSTS
-- ============================================================
DO $$
DECLARE
  cid_type TEXT;
  create_type TEXT;
BEGIN
  SELECT data_type INTO cid_type
  FROM information_schema.columns
  WHERE table_name = 'campaigns' AND column_name = 'id';

  IF NOT EXISTS (SELECT 1 FROM pg_class WHERE relname = 'campaign_updates' AND relkind = 'r') THEN
    create_type := CASE cid_type WHEN 'uuid' THEN 'UUID' ELSE 'INTEGER' END;
    EXECUTE format($sql$
      CREATE TABLE campaign_updates (
        id SERIAL PRIMARY KEY,
        campaign_id %s NOT NULL REFERENCES campaigns(id) ON DELETE CASCADE,
        title TEXT NOT NULL,
        content TEXT,
        image_url TEXT,
        milestone_amount NUMERIC(12,2),
        created_by TEXT,
        created_at TIMESTAMPTZ DEFAULT NOW()
      );
    $sql$, create_type);
  END IF;
END $$;

CREATE INDEX IF NOT EXISTS idx_updates_campaign_created 
  ON campaign_updates(campaign_id, created_at DESC);

-- ============================================================
-- 5. CAMPAIGN SHARING / REFERRALS
-- ============================================================
DO $$
DECLARE
  cid_type TEXT;
  create_type TEXT;
BEGIN
  SELECT data_type INTO cid_type
  FROM information_schema.columns
  WHERE table_name = 'campaigns' AND column_name = 'id';

  IF NOT EXISTS (SELECT 1 FROM pg_class WHERE relname = 'campaign_shares' AND relkind = 'r') THEN
    create_type := CASE cid_type WHEN 'uuid' THEN 'UUID' ELSE 'INTEGER' END;
    EXECUTE format($sql$
      CREATE TABLE campaign_shares (
        id SERIAL PRIMARY KEY,
        campaign_id %s NOT NULL REFERENCES campaigns(id) ON DELETE CASCADE,
        shared_by TEXT,
        shared_via TEXT CHECK (shared_via IN ('whatsapp', 'facebook', 'twitter', 'email', 'copy', 'instagram')),
        share_url TEXT,
        created_at TIMESTAMPTZ DEFAULT NOW()
      );
    $sql$, create_type);
  END IF;
END $$;

CREATE INDEX IF NOT EXISTS idx_shares_campaign_via 
  ON campaign_shares(campaign_id, shared_via);

-- ============================================================
-- 6. VIEW: CAMPAIGN SUMMARY (Source of Truth)
-- ============================================================
DROP VIEW IF EXISTS campaign_summary CASCADE;
CREATE VIEW campaign_summary AS
SELECT 
  c.id,
  c.title,
  c.slug,
  c.category_id,
  c.category,
  cat.name AS category_name,
  cat.icon AS category_icon,
  c.description,
  c.target_amount,
  c.minimum_contribution,
  c.paybill_number,
  c.account_number,
  c.till_number,
  c.payment_details,
  c.payment_instructions,
  c.start_date,
  c.end_date,
  c.beneficiary_name,
  c.beneficiary_contact,
  c.beneficiary_image_url,
  c.beneficiary_story,
  c.cover_image_url,
  c.status,
  c.is_urgent,
  c.is_featured,
  c.share_count,
  c.view_count,
  c.created_by,
  c.created_by_name,
  c.created_by_email,
  c.created_at,
  c.updated_at,
  -- Computed fields (source of truth)
  COALESCE(SUM(CASE WHEN ca.status = 'confirmed' THEN ca.amount ELSE 0 END), 0) AS current_amount,
  COUNT(DISTINCT CASE WHEN ca.status = 'confirmed' THEN ca.id END) AS total_contributions,
  COUNT(DISTINCT CASE WHEN ca.status = 'confirmed' THEN ca.donor_phone END) AS unique_donors,
  MAX(CASE WHEN ca.status = 'confirmed' THEN ca.created_at END) AS last_contribution_date,
  (c.target_amount - COALESCE(SUM(CASE WHEN ca.status = 'confirmed' THEN ca.amount ELSE 0 END), 0)) AS remaining_amount,
  ROUND(
    (COALESCE(SUM(CASE WHEN ca.status = 'confirmed' THEN ca.amount ELSE 0 END), 0) / NULLIF(c.target_amount, 0)) * 100,
    2
  ) AS percentage_complete
FROM campaigns c
LEFT JOIN campaign_categories cat ON c.category_id = cat.id
LEFT JOIN campaign_contributions ca ON c.id = ca.campaign_id
GROUP BY c.id, cat.name, cat.icon;

-- ============================================================
-- 7. AUTO-GENERATE SLUG WITH COLLISION HANDLING
-- ============================================================
CREATE OR REPLACE FUNCTION generate_campaign_slug()
RETURNS TRIGGER AS $$
DECLARE
  base_slug TEXT;
  candidate_slug TEXT;
  counter INT := 1;
BEGIN
  IF NEW.slug IS NULL OR NEW.slug = '' THEN
    base_slug := lower(regexp_replace(NEW.title, '[^a-zA-Z0-9]+', '-', 'g'));
    base_slug := trim(both '-' from base_slug);
    IF base_slug = '' THEN
      base_slug := 'campaign';
    END IF;

    candidate_slug := base_slug;
    WHILE EXISTS (SELECT 1 FROM campaigns WHERE slug = candidate_slug) LOOP
      counter := counter + 1;
      candidate_slug := base_slug || '-' || counter;
    END LOOP;

    NEW.slug := candidate_slug;
  END IF;

  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS trigger_generate_campaign_slug ON campaigns;
CREATE TRIGGER trigger_generate_campaign_slug
  BEFORE INSERT ON campaigns
  FOR EACH ROW
  EXECUTE FUNCTION generate_campaign_slug();

-- ============================================================
-- 8. UPDATE TIMESTAMP FUNCTION
-- ============================================================
CREATE OR REPLACE FUNCTION update_updated_at_column()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = NOW();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS trigger_update_campaigns_timestamp ON campaigns;
CREATE TRIGGER trigger_update_campaigns_timestamp
  BEFORE UPDATE ON campaigns
  FOR EACH ROW
  EXECUTE FUNCTION update_updated_at_column();
