-- ============================================
-- PESA PRO: ENABLE RLS FOR EXPENSES, APPROVALS, AND CAMPAIGN MEMBERS
-- CREATE NECESSARY TABLES AND SETUP ROW LEVEL SECURITY
-- ============================================

-- Create campaign_members table if not exists
CREATE TABLE IF NOT EXISTS campaign_members (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    campaign_id UUID NOT NULL REFERENCES campaigns(id) ON DELETE CASCADE,
    user_id UUID REFERENCES auth.users(id) ON DELETE SET NULL,
    role TEXT NOT NULL CHECK (role IN ('chair', 'treasurer', 'secretary', 'member')),
    created_at TIMESTAMPTZ DEFAULT NOW(),
    UNIQUE(campaign_id, user_id)
);

-- Enable RLS on campaign_members
ALTER TABLE campaign_members ENABLE ROW LEVEL SECURITY;

-- Create expenses table if not exists
CREATE TABLE IF NOT EXISTS expenses (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    campaign_id UUID NOT NULL REFERENCES campaigns(id) ON DELETE CASCADE,
    amount NUMERIC(12,2) NOT NULL CHECK (amount > 0),
    description TEXT NOT NULL,
    receipt_url TEXT, -- URL to stored receipt image (Supabase Storage)
    submitted_by UUID REFERENCES auth.users(id) ON DELETE SET NULL,
    status TEXT NOT NULL DEFAULT 'pending' CHECK (status IN ('pending', 'approved', 'rejected')),
    expense_date DATE NOT NULL,
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW(),
    metadata JSONB DEFAULT '{}'::jsonb
);

-- Enable RLS on expenses
ALTER TABLE expenses ENABLE ROW LEVEL SECURITY;

-- Create approvals table if not exists
CREATE TABLE IF NOT EXISTS approvals (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    transaction_id UUID REFERENCES campaign_contributions(id) ON DELETE SET NULL,
    expense_id UUID REFERENCES expenses(id) ON DELETE SET NULL,
    approver_uuid UUID REFERENCES auth.users(id) ON DELETE SET NULL,
    approver_name TEXT NOT NULL,
    approver_phone TEXT NOT NULL,
    device_id TEXT, -- Device identifier for fraud detection
    gps_latitude DOUBLE PRECISION,
    gps_longitude DOUBLE PRECISION,
    sim_imsi TEXT, -- SIM card identifier for fraud detection
    status TEXT NOT NULL CHECK (status IN ('approved', 'rejected', 'pending')),
    approved_at TIMESTAMPTZ,
    created_at TIMESTAMPTZ DEFAULT NOW(),
    metadata JSONB DEFAULT '{}'::jsonb
);

-- Enable RLS on approvals
ALTER TABLE approvals ENABLE ROW LEVEL SECURITY;

-- ============================================
-- RLS POLICIES
-- ============================================

-- POLICIES FOR CAMPAIGN_MEMBERS
-- Allow campaign creators to manage members of their campaigns
CREATE POLICY "Campaign creators can manage campaign members" ON campaign_members
    FOR ALL USING (
        EXISTS (
            SELECT 1 FROM campaigns
            WHERE campaigns.id = campaign_members.campaign_id
            AND campaigns.created_by = auth.uid()
        )
    );

-- Allow members to see their own membership in campaigns
CREATE POLICY "Users can see their own campaign memberships" ON campaign_members
    FOR SELECT USING (user_id = auth.uid());

-- POLICIES FOR CAMPAIGN_CONTRIBUTIONS (HARAMBEE TRANSACTIONS)
-- Allow campaign members to see contributions for their campaigns
CREATE POLICY "Members can see campaign contributions" ON campaign_contributions
    FOR SELECT USING (
        EXISTS (
            SELECT 1 FROM campaign_members
            WHERE campaign_members.campaign_id = campaign_contributions.campaign_id
            AND campaign_members.user_id = auth.uid()
        )
    );

-- Allow campaign chairs and treasurers to insert contributions
CREATE POLICY "Chairs and treasurers can insert campaign contributions" ON campaign_contributions
    FOR INSERT WITH CHECK (
        EXISTS (
            SELECT 1 FROM campaign_members
            WHERE campaign_members.campaign_id = campaign_contributions.campaign_id
            AND campaign_members.user_id = auth.uid()
            AND campaign_members.role IN ('chair', 'treasurer')
        )
    );

-- Allow campaign chairs and treasurers to update contributions
CREATE POLICY "Chairs and treasurers can update campaign contributions" ON campaign_contributions
    FOR UPDATE USING (
        EXISTS (
            SELECT 1 FROM campaign_members
            WHERE campaign_members.campaign_id = campaign_contributions.campaign_id
            AND campaign_members.user_id = auth.uid()
            AND campaign_members.role IN ('chair', 'treasurer')
        )
    );

-- POLICIES FOR EXPENSES
-- Allow campaign members to see expenses for their campaigns
CREATE POLICY "Members can see campaign expenses" ON expenses
    FOR SELECT USING (
        EXISTS (
            SELECT 1 FROM campaign_members
            WHERE campaign_members.campaign_id = expenses.campaign_id
            AND campaign_members.user_id = auth.uid()
        )
    );

-- Allow campaign chairs and treasurers to insert expenses
CREATE POLICY "Chairs and treasurers can insert expenses" ON expenses
    FOR INSERT WITH CHECK (
        EXISTS (
            SELECT 1 FROM campaign_members
            WHERE campaign_members.campaign_id = expenses.campaign_id
            AND campaign_members.user_id = auth.uid()
            AND campaign_members.role IN ('chair', 'treasurer')
        )
    );

-- Allow campaign chairs and treasurers to update expenses
CREATE POLICY "Chairs and treasurers can update expenses" ON expenses
    FOR UPDATE USING (
        EXISTS (
            SELECT 1 FROM campaign_members
            WHERE campaign_members.campaign_id = expenses.campaign_id
            AND campaign_members.user_id = auth.uid()
            AND campaign_members.role IN ('chair', 'treasurer')
        )
    );

-- POLICIES FOR APPROVALS
-- Allow approvers to see their own approvals
CREATE POLICY "Users can see their own approvals" ON approvals
    FOR SELECT USING (approver_uuid = auth.uid());

-- Allow campaign chairs and treasurers to see all approvals for their campaigns
CREATE POLICY "Chairs and treasurers can see campaign approvals" ON approvals
    FOR SELECT USING (
        EXISTS (
            SELECT 1 FROM campaign_members
            WHERE campaign_members.campaign_id = (
                SELECT campaign_id FROM campaign_contributions WHERE id = approvals.transaction_id
            )
            AND campaign_members.user_id = auth.uid()
            AND campaign_members.role IN ('chair', 'treasurer')
        )
    );

-- Allow campaign chairs and treasurers to insert approvals
CREATE POLICY "Chairs and treasurers can insert approvals" ON approvals
    FOR INSERT WITH CHECK (
        EXISTS (
            SELECT 1 FROM campaign_members
            WHERE campaign_members.campaign_id = (
                SELECT campaign_id FROM campaign_contributions WHERE id = approvals.transaction_id
            )
            AND campaign_members.user_id = auth.uid()
            AND campaign_members.role IN ('chair', 'treasurer')
        )
    );

-- Allow approvers to update their own approvals (e.g., change status)
CREATE POLICY "Users can update their own approvals" ON approvals
    FOR UPDATE USING (approver_uuid = auth.uid())
    WITH CHECK (approver_uuid = auth.uid());

-- ============================================
-- INDEXES FOR PERFORMANCE
-- ============================================

-- Indexes for campaign_members
CREATE INDEX IF NOT EXISTS idx_campaign_members_campaign_id ON campaign_members(campaign_id);
CREATE INDEX IF NOT EXISTS idx_campaign_members_user_id ON campaign_members(user_id);
CREATE INDEX IF NOT EXISTS idx_campaign_members_role ON campaign_members(role);

-- Indexes for expenses
CREATE INDEX IF NOT EXISTS idx_expenses_campaign_id ON expenses(campaign_id);
CREATE INDEX IF NOT EXISTS idx_expenses_status ON expenses(status);
CREATE INDEX IF NOT EXISTS idx_expenses_created_at ON expenses(created_at DESC);

-- Indexes for approvals
CREATE INDEX IF NOT EXISTS idx_approvals_transaction_id ON approvals(transaction_id);
CREATE INDEX IF NOT EXISTS idx_approvals_expense_id ON approvals(expense_id);
CREATE INDEX IF NOT EXISTS idx_approvals_approver_uuid ON approvals(approver_uuid);
CREATE INDEX IF NOT EXISTS idx_approvals_status ON approvals(status);
CREATE INDEX IF NOT EXISTS idx_approvals_created_at ON approvals(created_at DESC);

-- ============================================
-- TRIGGERS
-- ============================================

-- Update updated_at column for expenses
CREATE OR REPLACE FUNCTION update_expenses_updated_at()
RETURNS TRIGGER AS $$
BEGIN
    NEW.updated_at = NOW();
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS trigger_update_expenses_updated_at ON expenses;
CREATE TRIGGER trigger_update_expenses_updated_at
    BEFORE UPDATE ON expenses
    FOR EACH ROW
    EXECUTE FUNCTION update_expenses_updated_at();

-- Update updated_at column for approvals (if needed)
CREATE OR REPLACE FUNCTION update_approvals_updated_at()
RETURNS TRIGGER AS $$
BEGIN
    NEW.updated_at = NOW();
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS trigger_update_approvals_updated_at ON approvals;
CREATE TRIGGER trigger_update_approvals_updated_at
    BEFORE UPDATE ON approvals
    FOR EACH ROW
    EXECUTE FUNCTION update_approvals_updated_at();