-- Enable UUID extension
CREATE EXTENSION IF NOT EXISTS "uuid-ossp";

-- Create uuid_generate_v4 function in public schema if it doesn't exist
-- This ensures the function is available even if the extension was installed in a different schema
CREATE OR REPLACE FUNCTION public.uuid_generate_v4()
  RETURNS uuid AS $$
  BEGIN
    RETURN extensions.uuid_generate_v4();
  EXCEPTION WHEN OTHERS THEN
    RETURN gen_random_uuid(); -- Fallback to built-in function if available
  END;
$$ LANGUAGE plpgsql VOLATILE;

-- 1. GROUPS TABLE
CREATE TABLE IF NOT EXISTS groups (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    name TEXT NOT NULL,
    owner_id UUID REFERENCES auth.users(id) ON DELETE SET NULL,
    created_at TIMESTAMPTZ DEFAULT NOW()
);

-- Enable RLS
ALTER TABLE groups ENABLE ROW LEVEL SECURITY;

-- 2. MEMBERS TABLE
CREATE TABLE IF NOT EXISTS members (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    name TEXT NOT NULL,
    phone_number TEXT UNIQUE NOT NULL,
    group_id UUID REFERENCES groups(id) ON DELETE CASCADE,
    created_at TIMESTAMPTZ DEFAULT NOW()
);

-- Enable RLS
ALTER TABLE members ENABLE ROW LEVEL SECURITY;

-- 3. EVENTS TABLE
CREATE TABLE IF NOT EXISTS events (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    name TEXT NOT NULL,
    type TEXT CHECK (type IN ('chama', 'funeral', 'harambee', 'other')),
    target_amount DECIMAL(12, 2) DEFAULT 0,
    group_id UUID REFERENCES groups(id) ON DELETE CASCADE,
    created_at TIMESTAMPTZ DEFAULT NOW()
);

-- Enable RLS
ALTER TABLE events ENABLE ROW LEVEL SECURITY;

-- 4. TRANSACTIONS TABLE
CREATE TABLE IF NOT EXISTS transactions (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    transaction_code TEXT UNIQUE NOT NULL,
    amount DECIMAL(12, 2) NOT NULL,
    phone_number TEXT NOT NULL,
    name TEXT,
    transaction_type TEXT DEFAULT 'unknown',
    member_id UUID REFERENCES members(id) ON DELETE SET NULL,
    event_id UUID REFERENCES events(id) ON DELETE SET NULL,
    status TEXT DEFAULT 'pending' CHECK (status IN ('approved', 'pending', 'rejected')),
    source TEXT DEFAULT 'sms_share',
    timestamp TIMESTAMPTZ NOT NULL,
    created_at TIMESTAMPTZ DEFAULT NOW(),
    metadata JSONB DEFAULT '{}'::jsonb
);

-- Enable RLS
ALTER TABLE transactions ENABLE ROW LEVEL SECURITY;

-- Add missing columns if they don't exist (without problematic foreign keys)
DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name='members' AND column_name='group_id') THEN
    ALTER TABLE members ADD COLUMN group_id UUID REFERENCES groups(id) ON DELETE CASCADE;
  END IF;
  
  IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name='members' AND column_name='phone_number') THEN
    ALTER TABLE members ADD COLUMN phone_number TEXT UNIQUE;
  END IF;
  
  IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name='events' AND column_name='group_id') THEN
    ALTER TABLE events ADD COLUMN group_id UUID REFERENCES groups(id) ON DELETE CASCADE;
  END IF;
  
  -- Add these columns WITHOUT foreign key constraints if they don't exist
  -- (because members.id is INTEGER while we need UUID references)
  IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name='transactions' AND column_name='member_id') THEN
    ALTER TABLE transactions ADD COLUMN member_id INTEGER;
  END IF;
  
  IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name='transactions' AND column_name='event_id') THEN
    ALTER TABLE transactions ADD COLUMN event_id UUID;
  END IF;
  
  IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name='transactions' AND column_name='source') THEN
    ALTER TABLE transactions ADD COLUMN source TEXT DEFAULT 'sms_share';
  END IF;
  
  IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name='transactions' AND column_name='timestamp') THEN
    ALTER TABLE transactions ADD COLUMN timestamp TIMESTAMPTZ;
  END IF;
  
  IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name='transactions' AND column_name='metadata') THEN
    ALTER TABLE transactions ADD COLUMN metadata JSONB DEFAULT '{}'::jsonb;
  END IF;
END $$;

-- INDEXES for Performance (only if columns exist)
DO $$
BEGIN
  IF EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name='members' AND column_name='group_id') THEN
    CREATE INDEX IF NOT EXISTS idx_members_group_id ON members(group_id);
  END IF;
  
  IF EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name='members' AND column_name='phone_number') THEN
    CREATE INDEX IF NOT EXISTS idx_members_phone ON members(phone_number);
  END IF;
  
  IF EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name='events' AND column_name='group_id') THEN
    CREATE INDEX IF NOT EXISTS idx_events_group_id ON events(group_id);
  END IF;
  
  IF EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name='transactions' AND column_name='member_id') THEN
    CREATE INDEX IF NOT EXISTS idx_transactions_member_id ON transactions(member_id);
  END IF;
  
  IF EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name='transactions' AND column_name='event_id') THEN
    CREATE INDEX IF NOT EXISTS idx_transactions_event_id ON transactions(event_id);
  END IF;
  
  IF EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name='transactions' AND column_name='transaction_code') THEN
    CREATE INDEX IF NOT EXISTS idx_transactions_code ON transactions(transaction_code);
  END IF;
END $$;

-- RLS POLICIES

-- Drop existing policies first (if they exist)
DROP POLICY IF EXISTS "Owners can manage their groups" ON groups;
DROP POLICY IF EXISTS "Group owners can manage members" ON members;
DROP POLICY IF EXISTS "Group owners can manage events" ON events;
DROP POLICY IF EXISTS "Owners can see transactions" ON transactions;

-- Groups: Owners can manage their groups
CREATE POLICY "Owners can manage their groups" ON groups
    FOR ALL USING (auth.uid()::text = owner_id);

-- Members: Owners of the group can manage members
CREATE POLICY "Group owners can manage members" ON members
    FOR ALL USING (
        EXISTS (
            SELECT 1 FROM groups
            WHERE groups.id = members.group_id
            AND groups.owner_id::text = auth.uid()
        )
    );

-- Events: Owners of the group can manage events
CREATE POLICY "Group owners can manage events" ON events
    FOR ALL USING (
        EXISTS (
            SELECT 1 FROM groups
            WHERE groups.id = events.group_id
            AND groups.owner_id::text = auth.uid()
        )
    );

-- Transactions: Owners of the members/events can see transactions
-- Simplification: If a transaction is linked to a member belonging to a group owned by the user
CREATE POLICY "Owners can see transactions" ON transactions
    FOR ALL USING (
        EXISTS (
            SELECT 1 FROM members
            JOIN groups ON members.group_id = groups.id
            WHERE members.id = transactions.member_id
            AND groups.owner_id::text = auth.uid()
        )
    );
