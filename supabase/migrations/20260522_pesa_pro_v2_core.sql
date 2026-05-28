-- Pesa Pro v2.0 - Complete Feature Set Migration

-- 1. Categories (Kenyan specific)
CREATE TABLE IF NOT EXISTS public.categories (
  id SERIAL PRIMARY KEY,
  name TEXT NOT NULL UNIQUE,
  slug TEXT NOT NULL UNIQUE,
  icon TEXT,
  color TEXT,
  keywords TEXT[] DEFAULT '{}',
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- Group-based policies are created after related tables (moved later in file)
-- 5. Merry-Go-Round (Chama)
CREATE TABLE IF NOT EXISTS public.merry_go_round (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  group_id UUID REFERENCES public.groups(id) ON DELETE CASCADE,
  rotation_order UUID[] NOT NULL, -- Array of group_member IDs
  cycle_amount DECIMAL(12,2) NOT NULL,
  current_recipient_index INTEGER DEFAULT 0,
  start_date DATE NOT NULL,
  frequency TEXT DEFAULT 'monthly',
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- 6. Penalty Rules
CREATE TABLE IF NOT EXISTS public.penalty_rules (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  group_id UUID REFERENCES public.groups(id) ON DELETE CASCADE,
  amount DECIMAL(12,2) NOT NULL,
  is_percentage BOOLEAN DEFAULT false,
  grace_period_days INTEGER DEFAULT 0,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- 7. Chama Loans
CREATE TABLE IF NOT EXISTS public.chama_loans (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  group_id UUID REFERENCES public.groups(id) ON DELETE CASCADE,
  member_id UUID REFERENCES public.group_members(id) ON DELETE CASCADE,
  principal DECIMAL(12,2) NOT NULL,
  interest_rate DECIMAL(5,2) NOT NULL,
  repayment_schedule JSONB NOT NULL, -- Array of instalments
  status TEXT DEFAULT 'active', -- 'active', 'paid', 'overdue'
  issued_at DATE DEFAULT CURRENT_DATE,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- Ensure groups has `owner_id` (migrate from legacy `created_by` if present)
ALTER TABLE public.groups ADD COLUMN IF NOT EXISTS owner_id UUID;

DO $$
BEGIN
  IF EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_schema = 'public' AND table_name = 'groups' AND column_name = 'created_by'
  ) THEN
    EXECUTE 'UPDATE public.groups SET owner_id = created_by WHERE owner_id IS NULL';
  END IF;
END $$;

-- Create policies idempotently (after related tables exist)
DROP POLICY IF EXISTS "Owners manage chama loans" ON public.chama_loans;
CREATE POLICY "Owners manage chama loans" ON public.chama_loans FOR ALL USING (
  EXISTS (
    SELECT 1 FROM public.groups g
    WHERE g.id = group_id
      AND (g.owner_id = auth.uid() OR (g.created_by IS NOT NULL AND g.created_by = auth.uid()))
  )
);

DROP POLICY IF EXISTS "Owners manage rotations" ON public.merry_go_round;
CREATE POLICY "Owners manage rotations" ON public.merry_go_round FOR ALL USING (
  EXISTS (
    SELECT 1 FROM public.groups g
    WHERE g.id = group_id
      AND (g.owner_id = auth.uid() OR (g.created_by IS NOT NULL AND g.created_by = auth.uid()))
  )
);

-- 8. Payday Config
CREATE TABLE IF NOT EXISTS public.payday_config (
  user_id UUID PRIMARY KEY REFERENCES auth.users(id) ON DELETE CASCADE,
  expected_day INTEGER CHECK (expected_day >= 1 AND expected_day <= 31),
  min_amount DECIMAL(12,2),
  sender_match TEXT, -- Merchant name or Paybill
  last_payday DATE,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- 9. Assets (Net Worth Tracker)
CREATE TABLE IF NOT EXISTS public.assets (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  user_id UUID REFERENCES auth.users(id) ON DELETE CASCADE,
  name TEXT NOT NULL,
  type TEXT NOT NULL, -- 'sacco', 'property', 'investment', 'cash'
  value DECIMAL(12,2) NOT NULL,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- 10. Savings Goals (Jars)
CREATE TABLE IF NOT EXISTS public.savings_goals (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  user_id UUID REFERENCES auth.users(id) ON DELETE CASCADE,
  name TEXT NOT NULL,
  target_amount DECIMAL(12,2) NOT NULL,
  current_amount DECIMAL(12,2) DEFAULT 0,
  color TEXT DEFAULT '#00A651',
  emoji TEXT DEFAULT '🎯',
  allocation_percent INTEGER DEFAULT 0, -- e.g. 10% of every income
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- 11. Invoices
CREATE TABLE IF NOT EXISTS public.invoices (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  user_id UUID REFERENCES auth.users(id) ON DELETE CASCADE,
  business_id UUID REFERENCES public.groups(id),
  client_name TEXT NOT NULL,
  client_phone TEXT,
  items JSONB NOT NULL, -- [{desc, qty, price}]
  total_amount DECIMAL(12,2) NOT NULL,
  due_date DATE,
  status TEXT DEFAULT 'unpaid', -- 'unpaid', 'paid', 'overdue'
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- 12. M-Pesa Lines (Multi-till)
CREATE TABLE IF NOT EXISTS public.mpesa_lines (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  user_id UUID REFERENCES auth.users(id) ON DELETE CASCADE,
  alias TEXT NOT NULL,
  phone_or_till TEXT NOT NULL,
  type TEXT NOT NULL, -- 'personal', 'till', 'paybill'
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- 13. Agent Reconciliations
CREATE TABLE IF NOT EXISTS public.agent_reconciliations (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  user_id UUID REFERENCES auth.users(id) ON DELETE CASCADE,
  opening_cash DECIMAL(12,2) NOT NULL,
  closing_cash DECIMAL(12,2) NOT NULL,
  transaction_count INTEGER NOT NULL,
  expected_float DECIMAL(12,2),
  actual_float DECIMAL(12,2),
  discrepancy DECIMAL(12,2),
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- 14. Bill Splits
CREATE TABLE IF NOT EXISTS public.bill_splits (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  user_id UUID REFERENCES auth.users(id) ON DELETE CASCADE,
  title TEXT NOT NULL,
  total_amount DECIMAL(12,2) NOT NULL,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS public.bill_participants (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  split_id UUID REFERENCES public.bill_splits(id) ON DELETE CASCADE,
  name TEXT NOT NULL,
  phone TEXT NOT NULL,
  share_amount DECIMAL(12,2) NOT NULL,
  paid_amount DECIMAL(12,2) DEFAULT 0,
  status TEXT DEFAULT 'unpaid' -- 'unpaid', 'paid'
);

-- Enable RLS for all new tables
ALTER TABLE public.categories ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.recurring_payments ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.float_snapshots ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.merry_go_round ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.penalty_rules ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.chama_loans ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.payday_config ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.assets ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.savings_goals ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.invoices ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.mpesa_lines ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.agent_reconciliations ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.bill_splits ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.bill_participants ENABLE ROW LEVEL SECURITY;

-- Policies (Scoped to auth.uid())
CREATE POLICY "Anyone can view categories" ON public.categories FOR SELECT USING (true);
CREATE POLICY "Users manage recurring" ON public.recurring_payments FOR ALL USING (auth.uid() = user_id);
CREATE POLICY "Users manage float" ON public.float_snapshots FOR ALL USING (auth.uid() = user_id);
CREATE POLICY "Users manage payday" ON public.payday_config FOR ALL USING (auth.uid() = user_id);
CREATE POLICY "Users manage assets" ON public.assets FOR ALL USING (auth.uid() = user_id);
CREATE POLICY "Users manage goals" ON public.savings_goals FOR ALL USING (auth.uid() = user_id);
CREATE POLICY "Users manage invoices" ON public.invoices FOR ALL USING (auth.uid() = user_id);
CREATE POLICY "Users manage lines" ON public.mpesa_lines FOR ALL USING (auth.uid() = user_id);
CREATE POLICY "Users manage reconciliations" ON public.agent_reconciliations FOR ALL USING (auth.uid() = user_id);
CREATE POLICY "Users manage splits" ON public.bill_splits FOR ALL USING (auth.uid() = user_id);

-- Note: group-based policies are created earlier (immediately after related tables)

-- Indexes for performance
CREATE INDEX IF NOT EXISTS idx_transactions_category ON public.transactions(category_id);
CREATE INDEX IF NOT EXISTS idx_recurring_next ON public.recurring_payments(next_expected_date);
CREATE INDEX IF NOT EXISTS idx_debts_phone ON public.debts(contact_phone);
CREATE INDEX IF NOT EXISTS idx_invoices_phone ON public.invoices(client_phone);
