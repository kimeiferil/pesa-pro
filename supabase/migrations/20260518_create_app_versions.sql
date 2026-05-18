-- Create app_versions table for update management
CREATE TABLE IF NOT EXISTS app_versions (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  version VARCHAR(50) NOT NULL UNIQUE,
  release_date TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT NOW(),
  is_required BOOLEAN NOT NULL DEFAULT FALSE,
  changelog TEXT NOT NULL,
  download_url VARCHAR(500),
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT NOW()
);

-- Create index for faster queries
CREATE INDEX IF NOT EXISTS idx_app_versions_created_at ON app_versions(created_at DESC);
CREATE INDEX IF NOT EXISTS idx_app_versions_version ON app_versions(version DESC);

-- Enable Row Level Security
ALTER TABLE app_versions ENABLE ROW LEVEL SECURITY;

-- Allow all authenticated users to read versions
CREATE POLICY "Allow all authenticated users to read app versions"
ON app_versions
FOR SELECT
TO authenticated
USING (true);

-- Allow only service role to write/update versions (via admin panel)
CREATE POLICY "Allow service role to manage app versions"
ON app_versions
FOR ALL
TO service_role
USING (true)
WITH CHECK (true);

-- Create trigger to update the updated_at timestamp
CREATE OR REPLACE FUNCTION update_app_versions_updated_at()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = NOW();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER app_versions_updated_at_trigger
BEFORE UPDATE ON app_versions
FOR EACH ROW
EXECUTE FUNCTION update_app_versions_updated_at();

-- Insert initial version
INSERT INTO app_versions (version, release_date, is_required, changelog)
VALUES (
  '1.0.0',
  NOW(),
  FALSE,
  '• Initial release of Pesa Pro
• Transaction tracking
• Campaign management
• Multi-factor authentication
• Offline-first architecture'
)
ON CONFLICT (version) DO NOTHING;
