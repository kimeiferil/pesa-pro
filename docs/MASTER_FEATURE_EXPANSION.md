# PesaPro — Master Feature Expansion

This document summarizes the code changes added in the recent feature expansion: SQL migration, RLS policies, Edge Functions, new hooks, and UI screens. Use this as a quick reference when running the migration and testing on devices.

---

**Primary changes (paths)**

- SQL migration: `supabase/migrations/20260527_master_feature_expansion.sql`
- Edge Functions:
  - `supabase/functions/generate-report/index.ts`
  - `supabase/functions/setup-online-shop/index.ts`
- Hooks added:
  - `src/hooks/useProfile.ts`
  - `src/hooks/useTeamMembers.ts`
  - `src/hooks/useProducts.ts`
  - `src/hooks/useSales.ts` (updated queue + stock management)
  - `src/hooks/useInventory.ts` (fixed stock update flow)
- Screens / UI components added:
  - `src/features/onboarding/OnboardingFlow.tsx`
  - `src/features/team/UsersScreen.tsx`
  - `src/features/team/NewUserScreen.tsx`
  - `src/features/reports/ReportsScreen.tsx`
  - `src/features/pos/POSScreen.tsx`
  - `src/features/inventory/InventoryScreen.tsx`
  - `src/features/settings/BusinessSettingsScreen.tsx`
  - `src/features/more/MoreScreen.tsx`
  - `src/features/shop/OnlineShopScreen.tsx`
- Type augmentation / minor edits:
  - `src/lib/supabase.ts` — added Table type entries for new tables
  - `src/hooks/useInventory.ts` — stock update logic improved
  - `src/hooks/useSales.ts` — fixed stock decrement use of `increment`

All files were created/modified in-place in the repository.

---

**1) SQL migration (summary)**

File: `supabase/migrations/20260527_master_feature_expansion.sql`

- New tables:
  - `profiles` — stores onboarding profile fields (first_name, last_name, phone, whatsapp, gender, goals)
  - `business_members` — team members per business (invite flow, status)
  - `roles` — roles per business, `permissions` JSONB
  - `member_roles` — many-to-many mapping for member ↔ role
  - `products`, `sales`, `sale_items` — POS / product catalog and sales history
  - `suppliers`, `inventory_purchases`, `inventory_purchase_items` — inventory purchasing flow
- Business table augmented with columns: `slug`, `logo_url`, `shop_is_active`, `country`, `currency`, `timezone`, `phone`, `address`, `paybill`, `till`, `updated_at`
- RLS: Enabled for all new tables and `businesses`; policies scope access by `auth.uid()` and by business owner/admin membership. Key patterns:
  - Profiles: `auth.uid() = id`
  - Business CRUD: `auth.uid() = user_id` (owners) or admin via `roles.permissions`
  - Products/Sales/Inventory: `auth.uid() = user_id` or via business membership policies
- Indexes added for common queries (phone, business_id, stock_quantity, slug)

Notes: Migration includes safe CHECK constraints (gender, status enums, payment methods) and uses `uuid_generate_v4()` where appropriate.

---

**2) RLS & Security notes**

- All policies follow the `auth.uid() = user_id` or equivalent ownership checks.
- Business-level admin checks examine `roles.permissions` JSONB to determine admin capabilities (e.g., `settings` or `dashboard` = `admin`).
- Edge Functions validate caller JWT using a user-scoped Supabase client; the function uses the service role key internally to run privileged queries after verifying the caller.

---

**3) Edge Functions (details)**

- `generate-report` — accepts POST { business_id, report_type, date_from, date_to } and returns report JSON derived from `transactions` and `debts`:
  - Supports: `income_statement`, `balance_sheet`, `cash_flow`, `customer_statements`, `sales_summary`, `sales_by_category`, `expense_summary`, `expenses_by_category`.
  - Performs membership check: owner or business member.
  - Response contains computed aggregates and grouped series ready for UI display or CSV export.
  - Path: `supabase/functions/generate-report/index.ts`.

- `setup-online-shop` — toggles `businesses.shop_is_active` and ensures `businesses.slug` is set; returns shop URL.
  - Only the business owner may enable/disable shop.
  - Uses service role key to update `businesses` safely.
  - Path: `supabase/functions/setup-online-shop/index.ts`.

Deployment note: these functions expect environment variables `SUPABASE_URL`, `SUPABASE_SERVICE_ROLE_KEY`, and `SUPABASE_ANON_KEY` in the runtime environment.

---

**4) Hooks created / changed**

- `useProfile` — fetches and upserts `profiles` for the signed-in user; used by onboarding and settings.
- `useTeamMembers` — manages `business_members`, `roles`, `member_roles`; includes invite, createRole, assignRole, removeMember.
- `useProducts` — CRUD for `products`, derives `lowStockProducts` (stock < 5).
- `useSales` — offline-first checkout flow:
  - Local queue stored in `localStorage` when offline (`pesapro_pending_sales`).
  - `checkout()` creates `sales` and `sale_items` when online or queues when offline.
  - Sync-on-reconnect attempts to commit pending sales.
  - Stock decrement uses `increment('stock_quantity', -n)` in Supabase.
  - For credit sales, a `debts` record is created.
- `useInventory` — supplier & inventory purchases management:
  - `confirmPurchase()` updates product stock quantities by fetching current `stock_quantity` and adding purchase quantities, sets purchase `status: confirmed`, and inserts a `transactions` row for the outflow.

All hooks follow existing repository patterns: React `useState` + `useCallback`, handle loading / error states and return `refetch` functions.

---

**5) Screens added**

- `OnboardingFlow` — 3-step onboarding (profile → business → goals). Validates required fields, saves profile and creates business and goals, then navigates to Dashboard.
- `UsersScreen` & `NewUserScreen` — user list and invite flow.
- `ReportsScreen` — report generator UI; calls `generate-report` Edge Function; CSV export gated by plan.
- `POSScreen` — simple product grid, add-to-cart, checkout, payment selectors (M-PESA / Cash / Credit).
- `InventoryScreen` — supplier and purchases list; 3-step purchase wizard is scaffolded via hooks.
- `BusinessSettingsScreen` — logo upload (Supabase Storage `business-logos`), business info edits, toggles for SMS preferences, danger zone.
- `MoreScreen` — grouped menu for settings and support links.
- `OnlineShopScreen` — toggle & share shop link; calls `setup-online-shop` edge function.

Each screen handles loading, empty and basic error states per app conventions.

---

**6) Important implementation notes & assumptions**

- Timezone: `Africa/Nairobi` is used as the default timezone in business rows.
- Currency: default set to `KES`.
- Offline-first: `useSales` queues sales in `localStorage` and syncs when device is online; `useInventory` and others follow existing repo patterns for `IndexedDB`/sync where appropriate.
- UI: components use the app's color palette (`#0b1120` background, `#00C851` green) and minimal styles to match the repo.
- Comments: SQL and Edge Functions include inline comments describing their blocks. Hooks include top-level comments describing exported functions.

---

**7) How to run the SQL migration (recommended)**

Option A — using `psql` (safe, explicit):

```bash
# Replace with your connection string (project database URL)
PG_CONN="postgres://<db_user>:<db_password>@<db_host>:<db_port>/postgres"
psql "$PG_CONN" -f supabase/migrations/20260527_master_feature_expansion.sql
```

Option B — Supabase CLI (if configured):

```bash
# Login and set project remote, then run the SQL file using psql or your preferred DB deployment process
supabase login
# Use psql as above, or deploy through your CI that applies migrations
```

Caveat: Always run migrations on a staging copy first. Backup your production DB before running new DDL.

---

**8) Deploy Edge Functions**

Using Supabase CLI:

```bash
# from repo root
supabase functions deploy generate-report --project-ref <project-ref>
supabase functions deploy setup-online-shop --project-ref <project-ref>
```

Alternatively, deploy via your CI/CD to the Supabase functions runtime and set required env vars: `SUPABASE_SERVICE_ROLE_KEY`, `SUPABASE_ANON_KEY`, `SUPABASE_URL`, `APP_BASE_URL`.

---

**9) Local testing / app run (web + Android via Capacitor)**

Install deps and run dev server:

```bash
npm install
npm run dev
# open http://localhost:5173 (or configured Vite port)
```

To test on Android (Capacitor):

```bash
npm run build
npx cap copy android
npx cap open android
# then run in Android Studio emulator or device
```

Or, if using Expo (if applicable), start with `npm run start` and open in the Expo Android client.

---

**10) Next steps / checklist**

- [ ] Run the migration in a staging environment and verify tables + policies.
- [ ] Deploy Edge Functions and set environment variables securely.
- [ ] Run the web app and walk through the OnboardingFlow.
- [ ] Test POS: add products, perform cash/mpesa/credit sales; verify stock changes and debt creation.
- [ ] Test Inventory purchase flow: create purchase, confirm, and verify product stock increment and `transactions` entry.
- [ ] Test Reports: generate sample reports and verify results against `transactions` table.
- [ ] Test Multi-user flows: invite a member, assign role, verify RLS prevents unauthorized actions.

---

If you'd like, I can:

- Run a quick smoke test (lint/build) locally and report errors.
- Create a Postman collection / request examples for the Edge Functions.
- Add CI steps to automatically apply migrations on merge to `staging`.

Next step: Run the SQL migration, then test each screen on Android.
