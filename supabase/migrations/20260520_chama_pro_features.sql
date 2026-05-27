-- PesaPro Chama Bookkeeping - Schema Update

-- 1. Groups Table (Chamas)
CREATE TABLE IF NOT EXISTS public.groups (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  name TEXT NOT NULL,
  monthly_amount DECIMAL(12,2) DEFAULT 0,
  owner_id UUID REFERENCES auth.users(id) ON DELETE CASCADE,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- 2. Group Members
CREATE TABLE IF NOT EXISTS public.group_members (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  group_id UUID REFERENCES public.groups(id) ON DELETE CASCADE,
  name TEXT NOT NULL,
  phone TEXT NOT NULL,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  UNIQUE(group_id, phone)
);

-- 3. Transaction Splitting
-- NOTE: If this fails with "incompatible types: uuid and integer",
-- it means your transactions.id is an INTEGER.
-- See the "Convert to UUID" script provided in the chat.
DROP TABLE IF EXISTS public.transaction_splits;
CREATE TABLE public.transaction_splits (
  id              UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  transaction_id  UUID REFERENCES public.transactions(id) ON DELETE CASCADE,
  split_type      TEXT NOT NULL,
  amount          NUMERIC(15,2) NOT NULL,
  note            TEXT,
  created_at      TIMESTAMPTZ DEFAULT NOW()
);

-- 4. Audit Logs (For 7-day Undo logic)
CREATE TABLE IF NOT EXISTS public.audit_logs (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  group_id UUID REFERENCES public.groups(id) ON DELETE CASCADE,
  user_id UUID REFERENCES auth.users(id),
  action TEXT NOT NULL, -- 'INSERT', 'UPDATE', 'DELETE', 'SPLIT'
  target_table TEXT NOT NULL,
  target_id UUID NOT NULL,
  old_data JSONB,
  new_data JSONB,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- 5. Public Meeting links
CREATE TABLE IF NOT EXISTS public.public_meeting_links (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  group_id UUID REFERENCES public.groups(id) ON DELETE CASCADE,
  token TEXT UNIQUE NOT NULL,
  expires_at TIMESTAMPTZ NOT NULL,
  is_active BOOLEAN DEFAULT true,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- Enable RLS
ALTER TABLE public.groups ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.group_members ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.transaction_splits ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.audit_logs ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.public_meeting_links ENABLE ROW LEVEL SECURITY;

-- Policies
DO $$
BEGIN
  -- Ensure `owner_id` exists (migrate from legacy `created_by` if present)
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_schema = 'public' AND table_name = 'groups' AND column_name = 'owner_id'
  ) THEN
    ALTER TABLE public.groups ADD COLUMN owner_id UUID;
  END IF;
  IF EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_schema = 'public' AND table_name = 'groups' AND column_name = 'created_by'
  ) THEN
    EXECUTE 'UPDATE public.groups SET owner_id = created_by WHERE owner_id IS NULL';
  END IF;

  IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE policyname = 'Owners manage groups' AND tablename = 'groups') THEN
    CREATE POLICY "Owners manage groups" ON public.groups FOR ALL USING (auth.uid() = owner_id OR (created_by IS NOT NULL AND auth.uid() = created_by));
  END IF;

  IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE policyname = 'Owners manage members' AND tablename = 'group_members') THEN
    CREATE POLICY "Owners manage members" ON public.group_members FOR ALL USING (
      EXISTS (SELECT 1 FROM public.groups g WHERE g.id = group_members.group_id AND (g.owner_id = auth.uid() OR (g.created_by IS NOT NULL AND g.created_by = auth.uid())))
    );
  END IF;

  IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE policyname = 'Owners manage splits' AND tablename = 'transaction_splits') THEN
    CREATE POLICY "Owners manage splits" ON public.transaction_splits FOR ALL USING (
      EXISTS (
        SELECT 1 FROM public.transactions
        JOIN public.groups g ON public.transactions.business_id = g.id
        WHERE public.transactions.id = transaction_splits.transaction_id AND (g.owner_id = auth.uid() OR (g.created_by IS NOT NULL AND g.created_by = auth.uid()))
      )
    );
  END IF;
END $$;

-- Refresh schema cache
NOTIFY pgrst, 'reload schema';
