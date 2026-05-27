-- PesaPro: Budgets and Debt Tracking

-- 1. Budgets Table
CREATE TABLE IF NOT EXISTS public.budgets (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  user_id UUID REFERENCES auth.users(id) ON DELETE CASCADE,
  business_id UUID REFERENCES public.groups(id) ON DELETE CASCADE, -- null for personal
  category TEXT NOT NULL,
  amount DECIMAL(12,2) NOT NULL,
  period TEXT DEFAULT 'monthly', -- 'weekly', 'monthly'
  rollover BOOLEAN DEFAULT false,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW(),
  UNIQUE(user_id, business_id, category, period)
);

-- 2. Debt Tracker Table
CREATE TABLE IF NOT EXISTS public.debts (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  user_id UUID REFERENCES auth.users(id) ON DELETE CASCADE,
  business_id UUID REFERENCES public.groups(id) ON DELETE CASCADE,
  contact_name TEXT NOT NULL,
  contact_phone TEXT,
  amount DECIMAL(12,2) NOT NULL,
  type TEXT NOT NULL, -- 'owed_to_me' (credit), 'i_owe' (debt)
  note TEXT,
  due_date DATE,
  status TEXT DEFAULT 'active', -- 'active', 'paid', 'partially_paid'
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- Enable RLS
ALTER TABLE public.budgets ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.debts ENABLE ROW LEVEL SECURITY;

-- Policies
CREATE POLICY "Users manage own budgets" ON public.budgets FOR ALL USING (auth.uid() = user_id);
CREATE POLICY "Users manage own debts" ON public.debts FOR ALL USING (auth.uid() = user_id);
