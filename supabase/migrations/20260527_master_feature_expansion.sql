-- PesaPro Master Feature Expansion Migration
-- Adds onboarding profile storage, team member management, POS, inventory,
-- online shop settings, and business metadata with RLS.

CREATE EXTENSION IF NOT EXISTS "uuid-ossp";

-- 1. Profiles table for onboarding and user preferences
CREATE TABLE IF NOT EXISTS public.profiles (
  id UUID PRIMARY KEY REFERENCES auth.users(id) ON DELETE CASCADE,
  first_name TEXT NOT NULL,
  last_name TEXT NOT NULL,
  phone TEXT NOT NULL,
  whatsapp_phone TEXT NOT NULL,
  whatsapp_same_as_phone BOOLEAN NOT NULL DEFAULT true,
  gender TEXT NOT NULL CHECK (gender IN ('male', 'female')),
  goals TEXT[] DEFAULT '{}',
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- 2. Business metadata for logos, shop links, and payment settings
ALTER TABLE public.businesses
  ADD COLUMN IF NOT EXISTS slug TEXT UNIQUE,
  ADD COLUMN IF NOT EXISTS logo_url TEXT,
  ADD COLUMN IF NOT EXISTS shop_is_active BOOLEAN NOT NULL DEFAULT false,
  ADD COLUMN IF NOT EXISTS country TEXT NOT NULL DEFAULT 'Kenya',
  ADD COLUMN IF NOT EXISTS currency TEXT NOT NULL DEFAULT 'KES',
  ADD COLUMN IF NOT EXISTS timezone TEXT NOT NULL DEFAULT 'Africa/Nairobi',
  ADD COLUMN IF NOT EXISTS phone TEXT,
  ADD COLUMN IF NOT EXISTS address TEXT,
  ADD COLUMN IF NOT EXISTS paybill TEXT,
  ADD COLUMN IF NOT EXISTS till TEXT,
  ADD COLUMN IF NOT EXISTS updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW();

-- 3. Team member and role management
CREATE TABLE IF NOT EXISTS public.business_members (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  business_id UUID REFERENCES public.businesses(id) ON DELETE CASCADE,
  invited_by UUID REFERENCES auth.users(id) ON DELETE SET NULL,
  user_id UUID REFERENCES auth.users(id) ON DELETE SET NULL,
  email TEXT NOT NULL,
  name TEXT NOT NULL,
  phone TEXT,
  job_title TEXT,
  status TEXT NOT NULL DEFAULT 'pending' CHECK (status IN ('pending', 'active', 'suspended')),
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS public.roles (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  business_id UUID REFERENCES public.businesses(id) ON DELETE CASCADE,
  name TEXT NOT NULL,
  description TEXT,
  permissions JSONB NOT NULL DEFAULT '{}',
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS public.member_roles (
  member_id UUID REFERENCES public.business_members(id) ON DELETE CASCADE,
  role_id UUID REFERENCES public.roles(id) ON DELETE CASCADE,
  PRIMARY KEY (member_id, role_id)
);

-- 4. POS tables for products and sales
CREATE TABLE IF NOT EXISTS public.products (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  user_id UUID REFERENCES auth.users(id) ON DELETE CASCADE,
  business_id UUID REFERENCES public.businesses(id) ON DELETE CASCADE,
  name TEXT NOT NULL,
  price NUMERIC(12,2) NOT NULL DEFAULT 0,
  unit TEXT NOT NULL DEFAULT 'pcs',
  stock_quantity INTEGER NOT NULL DEFAULT 0,
  image_url TEXT,
  category TEXT,
  is_active BOOLEAN NOT NULL DEFAULT true,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS public.sales (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  user_id UUID REFERENCES auth.users(id) ON DELETE CASCADE,
  business_id UUID REFERENCES public.businesses(id) ON DELETE CASCADE,
  total_amount NUMERIC(12,2) NOT NULL DEFAULT 0,
  payment_method TEXT NOT NULL CHECK (payment_method IN ('mpesa', 'cash', 'credit')),
  customer_id UUID REFERENCES public.customers(id) ON DELETE SET NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS public.sale_items (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  sale_id UUID REFERENCES public.sales(id) ON DELETE CASCADE,
  product_id UUID REFERENCES public.products(id) ON DELETE SET NULL,
  quantity INTEGER NOT NULL DEFAULT 1,
  unit_price NUMERIC(12,2) NOT NULL DEFAULT 0,
  subtotal NUMERIC(12,2) NOT NULL DEFAULT 0
);

-- 5. Inventory and supplier management
CREATE TABLE IF NOT EXISTS public.suppliers (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  user_id UUID REFERENCES auth.users(id) ON DELETE CASCADE,
  business_id UUID REFERENCES public.businesses(id) ON DELETE CASCADE,
  name TEXT NOT NULL,
  phone TEXT,
  email TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS public.inventory_purchases (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  user_id UUID REFERENCES auth.users(id) ON DELETE CASCADE,
  business_id UUID REFERENCES public.businesses(id) ON DELETE CASCADE,
  supplier_id UUID REFERENCES public.suppliers(id) ON DELETE SET NULL,
  purchase_date DATE NOT NULL DEFAULT CURRENT_DATE,
  currency TEXT NOT NULL DEFAULT 'KES',
  status TEXT NOT NULL DEFAULT 'draft' CHECK (status IN ('draft', 'confirmed')),
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS public.inventory_purchase_items (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  purchase_id UUID REFERENCES public.inventory_purchases(id) ON DELETE CASCADE,
  product_id UUID REFERENCES public.products(id) ON DELETE SET NULL,
  quantity INTEGER NOT NULL DEFAULT 1,
  unit_cost NUMERIC(12,2) NOT NULL DEFAULT 0,
  subtotal NUMERIC(12,2) NOT NULL DEFAULT 0
);

-- 6. Enable row level security for tables used by new features
ALTER TABLE public.profiles ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.business_members ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.roles ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.member_roles ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.products ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.sales ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.sale_items ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.suppliers ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.inventory_purchases ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.inventory_purchase_items ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.businesses ENABLE ROW LEVEL SECURITY;

-- 7. Row-level security policies
CREATE POLICY "Profiles can be managed by owner" ON public.profiles
  FOR ALL USING (auth.uid() = id) WITH CHECK (auth.uid() = id);

CREATE POLICY "Business members read if owner or member" ON public.business_members
  FOR SELECT USING (
    auth.uid() = invited_by
    OR auth.uid() = user_id
    OR EXISTS (
      SELECT 1 FROM public.businesses b
      WHERE b.id = business_members.business_id
        AND b.user_id = auth.uid()
    )
    OR EXISTS (
      SELECT 1 FROM public.member_roles mr
      JOIN public.business_members bm ON bm.id = mr.member_id
      JOIN public.roles r ON r.id = mr.role_id
      WHERE bm.user_id = auth.uid()
        AND bm.business_id = business_members.business_id
        AND (r.permissions ->> 'settings' = 'admin' OR r.permissions ->> 'dashboard' = 'admin')
    )
  );

CREATE POLICY "Business members manage if owner or admin" ON public.business_members
  FOR ALL USING (
    auth.uid() = invited_by
    OR auth.uid() = user_id
    OR EXISTS (
      SELECT 1 FROM public.businesses b
      WHERE b.id = business_members.business_id
        AND b.user_id = auth.uid()
    )
    OR EXISTS (
      SELECT 1 FROM public.member_roles mr
      JOIN public.business_members bm ON bm.id = mr.member_id
      JOIN public.roles r ON r.id = mr.role_id
      WHERE bm.user_id = auth.uid()
        AND bm.business_id = business_members.business_id
        AND (r.permissions ->> 'settings' = 'admin' OR r.permissions ->> 'dashboard' = 'admin')
    )
  ) WITH CHECK (
    auth.uid() = invited_by
    OR auth.uid() = user_id
    OR EXISTS (
      SELECT 1 FROM public.businesses b
      WHERE b.id = business_members.business_id
        AND b.user_id = auth.uid()
    )
    OR EXISTS (
      SELECT 1 FROM public.member_roles mr
      JOIN public.business_members bm ON bm.id = mr.member_id
      JOIN public.roles r ON r.id = mr.role_id
      WHERE bm.user_id = auth.uid()
        AND bm.business_id = business_members.business_id
        AND (r.permissions ->> 'settings' = 'admin' OR r.permissions ->> 'dashboard' = 'admin')
    )
  );

CREATE POLICY "Roles read if owner or admin" ON public.roles
  FOR SELECT USING (
    EXISTS (SELECT 1 FROM public.businesses b WHERE b.id = roles.business_id AND b.user_id = auth.uid())
    OR EXISTS (
      SELECT 1 FROM public.member_roles mr
      JOIN public.business_members bm ON bm.id = mr.member_id
      JOIN public.roles r2 ON r2.id = mr.role_id
      WHERE bm.user_id = auth.uid()
        AND bm.business_id = roles.business_id
        AND (r2.permissions ->> 'settings' = 'admin' OR r2.permissions ->> 'dashboard' = 'admin')
    )
  );

CREATE POLICY "Roles manage if owner or admin" ON public.roles
  FOR ALL USING (
    EXISTS (SELECT 1 FROM public.businesses b WHERE b.id = roles.business_id AND b.user_id = auth.uid())
    OR EXISTS (
      SELECT 1 FROM public.member_roles mr
      JOIN public.business_members bm ON bm.id = mr.member_id
      JOIN public.roles r2 ON r2.id = mr.role_id
      WHERE bm.user_id = auth.uid()
        AND bm.business_id = roles.business_id
        AND (r2.permissions ->> 'settings' = 'admin' OR r2.permissions ->> 'dashboard' = 'admin')
    )
  ) WITH CHECK (
    EXISTS (SELECT 1 FROM public.businesses b WHERE b.id = roles.business_id AND b.user_id = auth.uid())
    OR EXISTS (
      SELECT 1 FROM public.member_roles mr
      JOIN public.business_members bm ON bm.id = mr.member_id
      JOIN public.roles r2 ON r2.id = mr.role_id
      WHERE bm.user_id = auth.uid()
        AND bm.business_id = roles.business_id
        AND (r2.permissions ->> 'settings' = 'admin' OR r2.permissions ->> 'dashboard' = 'admin')
    )
  );

CREATE POLICY "Member role relations restricted to owner or admin" ON public.member_roles
  FOR ALL USING (
    EXISTS (
      SELECT 1 FROM public.business_members bm
      JOIN public.roles r ON r.business_id = bm.business_id
      WHERE bm.user_id = auth.uid()
        AND r.id = member_roles.role_id
        AND (r.permissions ->> 'settings' = 'admin' OR r.permissions ->> 'dashboard' = 'admin')
    )
    OR EXISTS (SELECT 1 FROM public.businesses b WHERE b.id = (SELECT business_id FROM public.roles WHERE id = member_roles.role_id) AND b.user_id = auth.uid())
  ) WITH CHECK (
    EXISTS (
      SELECT 1 FROM public.business_members bm
      JOIN public.roles r ON r.business_id = bm.business_id
      WHERE bm.user_id = auth.uid()
        AND r.id = member_roles.role_id
        AND (r.permissions ->> 'settings' = 'admin' OR r.permissions ->> 'dashboard' = 'admin')
    )
    OR EXISTS (SELECT 1 FROM public.businesses b WHERE b.id = (SELECT business_id FROM public.roles WHERE id = member_roles.role_id) AND b.user_id = auth.uid())
  );

CREATE POLICY "Products belong to the user" ON public.products
  FOR ALL USING (auth.uid() = user_id) WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Sales belong to the user" ON public.sales
  FOR ALL USING (auth.uid() = user_id) WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Sale items belong to the user via sale" ON public.sale_items
  FOR SELECT USING (
    EXISTS (SELECT 1 FROM public.sales s WHERE s.id = sale_items.sale_id AND s.user_id = auth.uid())
  );

CREATE POLICY "Sale items manage via sale owner" ON public.sale_items
  FOR ALL USING (
    EXISTS (SELECT 1 FROM public.sales s WHERE s.id = sale_items.sale_id AND s.user_id = auth.uid())
  ) WITH CHECK (
    EXISTS (SELECT 1 FROM public.sales s WHERE s.id = sale_items.sale_id AND s.user_id = auth.uid())
  );

CREATE POLICY "Suppliers belong to the user" ON public.suppliers
  FOR ALL USING (auth.uid() = user_id) WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Inventory purchases belong to the user" ON public.inventory_purchases
  FOR ALL USING (auth.uid() = user_id) WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Inventory purchase items belong to the user via purchase" ON public.inventory_purchase_items
  FOR ALL USING (
    EXISTS (SELECT 1 FROM public.inventory_purchases p WHERE p.id = inventory_purchase_items.purchase_id AND p.user_id = auth.uid())
  ) WITH CHECK (
    EXISTS (SELECT 1 FROM public.inventory_purchases p WHERE p.id = inventory_purchase_items.purchase_id AND p.user_id = auth.uid())
  );

CREATE POLICY "Businesses managed by owner" ON public.businesses
  FOR ALL USING (auth.uid() = user_id) WITH CHECK (auth.uid() = user_id);

-- 8. Performance indexes
CREATE INDEX IF NOT EXISTS idx_profiles_phone ON public.profiles(phone);
CREATE INDEX IF NOT EXISTS idx_business_members_business ON public.business_members(business_id);
CREATE INDEX IF NOT EXISTS idx_business_members_user ON public.business_members(user_id);
CREATE INDEX IF NOT EXISTS idx_products_business ON public.products(business_id);
CREATE INDEX IF NOT EXISTS idx_products_stock ON public.products(stock_quantity);
CREATE INDEX IF NOT EXISTS idx_sales_business ON public.sales(business_id);
CREATE INDEX IF NOT EXISTS idx_sales_user ON public.sales(user_id);
CREATE INDEX IF NOT EXISTS idx_inventory_purchases_business ON public.inventory_purchases(business_id);
CREATE INDEX IF NOT EXISTS idx_suppliers_business ON public.suppliers(business_id);
CREATE INDEX IF NOT EXISTS idx_businesses_slug ON public.businesses(slug);
