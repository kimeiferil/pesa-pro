-- ============================================================
-- ADVANCED SECURITY POLICIES FOR PESA PRO
-- Run this in your Supabase SQL Editor AFTER the main tables
-- ============================================================

-- ============================================================
-- 1. Add security columns to profiles table
-- ============================================================
ALTER TABLE public.profiles 
ADD COLUMN IF NOT EXISTS failed_login_attempts INTEGER DEFAULT 0,
ADD COLUMN IF NOT EXISTS locked_until TIMESTAMP WITH TIME ZONE,
ADD COLUMN IF NOT EXISTS last_login_at TIMESTAMP WITH TIME ZONE,
ADD COLUMN IF NOT EXISTS last_login_ip TEXT,
ADD COLUMN IF NOT EXISTS email_verified BOOLEAN DEFAULT false,
ADD COLUMN IF NOT EXISTS two_factor_enabled BOOLEAN DEFAULT false,
ADD COLUMN IF NOT EXISTS two_factor_secret TEXT;

-- ============================================================
-- 2. Create audit logs table
-- ============================================================
CREATE TABLE IF NOT EXISTS public.audit_logs (
  id SERIAL PRIMARY KEY,
  user_id UUID REFERENCES auth.users(id),
  action TEXT NOT NULL,
  ip_address TEXT,
  user_agent TEXT,
  details JSONB,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

ALTER TABLE public.audit_logs ENABLE ROW LEVEL SECURITY;

-- Users can only view their own audit logs
CREATE POLICY "Users can view own audit logs" ON public.audit_logs
  FOR SELECT USING (auth.uid() = user_id);

-- Only system can insert audit logs
CREATE POLICY "System can insert audit logs" ON public.audit_logs
  FOR INSERT WITH CHECK (true);

-- ============================================================
-- 3. Create function to log user actions
-- ============================================================
CREATE OR REPLACE FUNCTION public.log_user_action(
  p_action TEXT,
  p_details JSONB DEFAULT NULL,
  p_ip_address TEXT DEFAULT NULL,
  p_user_agent TEXT DEFAULT NULL
)
RETURNS VOID AS $$
BEGIN
  INSERT INTO public.audit_logs (user_id, action, ip_address, user_agent, details)
  VALUES (auth.uid(), p_action, p_ip_address, p_user_agent, p_details);
EXCEPTION WHEN OTHERS THEN
  -- Don't let audit logging break the main operation
  NULL;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- ============================================================
-- 4. Function to check rate limiting for login attempts
-- ============================================================
CREATE OR REPLACE FUNCTION public.check_rate_limit(p_user_id UUID)
RETURNS BOOLEAN AS $$
DECLARE
  v_attempts INTEGER;
  v_locked_until TIMESTAMP WITH TIME ZONE;
BEGIN
  -- Get user's failed attempts and lock status
  SELECT failed_login_attempts, locked_until 
  INTO v_attempts, v_locked_until
  FROM public.profiles 
  WHERE id = p_user_id;
  
  -- Check if account is locked
  IF v_locked_until IS NOT NULL AND v_locked_until > NOW() THEN
    RETURN false;
  END IF;
  
  -- Check if too many attempts (5+)
  IF v_attempts >= 5 THEN
    -- Lock account for 15 minutes
    UPDATE public.profiles 
    SET locked_until = NOW() + INTERVAL '15 minutes'
    WHERE id = p_user_id;
    RETURN false;
  END IF;
  
  RETURN true;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- ============================================================
-- 5. Trigger to record failed logins
-- ============================================================
CREATE OR REPLACE FUNCTION public.record_failed_login()
RETURNS TRIGGER AS $$
BEGIN
  UPDATE public.profiles 
  SET failed_login_attempts = failed_login_attempts + 1
  WHERE id = NEW.user_id;
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- ============================================================
-- 6. Function to reset failed attempts on successful login
-- ============================================================
CREATE OR REPLACE FUNCTION public.reset_failed_attempts()
RETURNS TRIGGER AS $$
BEGIN
  UPDATE public.profiles 
  SET 
    failed_login_attempts = 0,
    locked_until = NULL,
    last_login_at = NOW()
  WHERE id = NEW.user_id;
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- ============================================================
-- 7. Add row-level security for all tables with user_id
-- ============================================================

-- Ensure every table has user_id and RLS
DO $$ 
DECLARE
  table_record RECORD;
BEGIN
  FOR table_record IN 
    SELECT tablename FROM pg_tables 
    WHERE schemaname = 'public' 
    AND tablename IN ('mpesa_transactions', 'campaigns', 'campaign_contributions')
  LOOP
    -- Enable RLS if not already enabled
    EXECUTE format('ALTER TABLE public.%I ENABLE ROW LEVEL SECURITY', table_record.tablename);
    
    -- Drop existing policies to recreate
    EXECUTE format('DROP POLICY IF EXISTS "Users can view own data" ON public.%I', table_record.tablename);
    EXECUTE format('DROP POLICY IF EXISTS "Users can insert own data" ON public.%I', table_record.tablename);
    EXECUTE format('DROP POLICY IF EXISTS "Users can update own data" ON public.%I', table_record.tablename);
    EXECUTE format('DROP POLICY IF EXISTS "Users can delete own data" ON public.%I', table_record.tablename);
    
    -- Create strict policies
    EXECUTE format('CREATE POLICY "Users can view own data" ON public.%I FOR SELECT USING (auth.uid() = user_id)', table_record.tablename);
    EXECUTE format('CREATE POLICY "Users can insert own data" ON public.%I FOR INSERT WITH CHECK (auth.uid() = user_id)', table_record.tablename);
    EXECUTE format('CREATE POLICY "Users can update own data" ON public.%I FOR UPDATE USING (auth.uid() = user_id)', table_record.tablename);
    EXECUTE format('CREATE POLICY "Users can delete own data" ON public.%I FOR DELETE USING (auth.uid() = user_id)', table_record.tablename);
  END LOOP;
END $$;

-- ============================================================
-- 8. Create indexes for security queries
-- ============================================================
CREATE INDEX IF NOT EXISTS idx_audit_logs_user_id ON public.audit_logs(user_id);
CREATE INDEX IF NOT EXISTS idx_audit_logs_created_at ON public.audit_logs(created_at DESC);
CREATE INDEX IF NOT EXISTS idx_profiles_locked_until ON public.profiles(locked_until);

-- ============================================================
-- 9. Security validation check
-- ============================================================
SELECT 
  tablename,
  rowsecurity
FROM pg_tables 
WHERE schemaname = 'public' 
AND tablename IN ('profiles', 'mpesa_transactions', 'campaigns', 'campaign_contributions', 'audit_logs');
