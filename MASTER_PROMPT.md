# Pesa Pro v2.0 - Master Implementation Prompt

## Project Overview
Pesa Pro is a comprehensive Kenyan fintech application designed to help individuals and groups manage finances, savings, and investments. The database schema is fully deployed on Supabase.

---

## Database Schema Reference

### Core Tables

#### 1. **Groups** (Chama/Community Groups)
```sql
id UUID PRIMARY KEY
name TEXT
owner_id UUID (references auth.users)
created_at TIMESTAMPTZ
```

#### 2. **Members** (Group Members)
```sql
id UUID PRIMARY KEY
name TEXT
phone_number TEXT UNIQUE
group_id UUID (references groups)
created_at TIMESTAMPTZ
```

#### 3. **Events** (Harambee, Funeral, etc.)
```sql
id UUID PRIMARY KEY
name TEXT
type TEXT (chama, funeral, harambee, other)
target_amount DECIMAL
group_id UUID (references groups)
created_at TIMESTAMPTZ
```

#### 4. **Transactions**
```sql
id UUID PRIMARY KEY
transaction_code TEXT UNIQUE
amount DECIMAL
phone_number TEXT
name TEXT
transaction_type TEXT
member_id UUID (references members)
event_id UUID (references events)
status TEXT (approved, pending, rejected)
source TEXT (sms_share, etc.)
timestamp TIMESTAMPTZ
metadata JSONB
created_at TIMESTAMPTZ
```

#### 5. **Merry-Go-Round** (Rotation Savings)
```sql
id UUID PRIMARY KEY
group_id UUID (references groups)
rotation_order UUID[] (array of member IDs)
cycle_amount DECIMAL
current_recipient_index INTEGER
start_date DATE
frequency TEXT (monthly, weekly, etc.)
created_at TIMESTAMPTZ
```

#### 6. **Chama Loans**
```sql
id UUID PRIMARY KEY
group_id UUID (references groups)
member_id UUID (references group_members)
principal DECIMAL
interest_rate DECIMAL
repayment_schedule JSONB (array of instalments)
status TEXT (active, paid, overdue)
issued_at DATE
created_at TIMESTAMPTZ
```

#### 7. **Penalty Rules**
```sql
id UUID PRIMARY KEY
group_id UUID (references groups)
amount DECIMAL
is_percentage BOOLEAN
grace_period_days INTEGER
created_at TIMESTAMPTZ
```

#### 8. **Payday Config** (Salary Predictions)
```sql
user_id UUID PRIMARY KEY (references auth.users)
expected_day INTEGER (1-31)
min_amount DECIMAL
sender_match TEXT
last_payday DATE
created_at TIMESTAMPTZ
```

#### 9. **Assets** (Net Worth Tracker)
```sql
id UUID PRIMARY KEY
user_id UUID (references auth.users)
name TEXT
type TEXT (sacco, property, investment, cash)
value DECIMAL
created_at TIMESTAMPTZ
updated_at TIMESTAMPTZ
```

#### 10. **Savings Goals** (Jars)
```sql
id UUID PRIMARY KEY
user_id UUID (references auth.users)
name TEXT
target_amount DECIMAL
current_amount DECIMAL
color TEXT
emoji TEXT
allocation_percent INTEGER (0-100)
created_at TIMESTAMPTZ
```

#### 11. **Invoices**
```sql
id UUID PRIMARY KEY
user_id UUID (references auth.users)
business_id UUID (references groups)
client_name TEXT
client_phone TEXT
items JSONB (array of {desc, qty, price})
total_amount DECIMAL
due_date DATE
status TEXT (unpaid, paid, overdue)
created_at TIMESTAMPTZ
```

#### 12. **M-Pesa Lines** (Multi-till)
```sql
id UUID PRIMARY KEY
user_id UUID (references auth.users)
alias TEXT
phone_or_till TEXT
type TEXT (personal, till, paybill)
created_at TIMESTAMPTZ
```

#### 13. **Agent Reconciliations**
```sql
id UUID PRIMARY KEY
user_id UUID (references auth.users)
opening_cash DECIMAL
closing_cash DECIMAL
transaction_count INTEGER
expected_float DECIMAL
actual_float DECIMAL
discrepancy DECIMAL
created_at TIMESTAMPTZ
```

#### 14. **Bill Splits**
```sql
id UUID PRIMARY KEY
user_id UUID (references auth.users)
title TEXT
total_amount DECIMAL
created_at TIMESTAMPTZ
```

#### 15. **Bill Participants**
```sql
id UUID PRIMARY KEY
split_id UUID (references bill_splits)
name TEXT
phone TEXT
share_amount DECIMAL
paid_amount DECIMAL
status TEXT (unpaid, paid)
```

#### 16. **Categories**
```sql
id SERIAL PRIMARY KEY
name TEXT UNIQUE
slug TEXT UNIQUE
icon TEXT
color TEXT
keywords TEXT[]
created_at TIMESTAMPTZ
```

---

## Row Level Security (RLS) Policies

### Authentication Context
- All policies use `auth.uid()` for user identification
- Type casting ensures compatibility: `auth.uid()::text` or `auth.uid()` depending on column type

### Key Policies
- **Groups**: Owners can manage their groups
- **Members**: Group owners can manage members
- **Events**: Group owners can manage events
- **Transactions**: Only group owners can see transactions
- **Merry-Go-Round**: Group owners manage rotations
- **Chama Loans**: Group owners manage loans
- **User Data**: Users can only manage their own records (assets, goals, invoices, etc.)
- **Categories**: Public read access, no write (admin-controlled)

---

## Implementation Roadmap

### Phase 1: Core Features
- [ ] **Authentication & User Profiles**
  - Supabase Auth integration
  - User profile management
  - Phone number verification

- [ ] **Group Management**
  - Create/edit/delete groups
  - Add/remove members
  - View group transactions

- [ ] **Transaction Logging**
  - Record M-Pesa transactions
  - SMS integration for auto-logging
  - Transaction status updates

### Phase 2: Savings & Investments
- [ ] **Savings Goals (Jars)**
  - Create savings goals with targets
  - Auto-allocate from income
  - Track progress

- [ ] **Assets Management**
  - Log assets (cash, property, investments)
  - Calculate net worth
  - Track asset growth

- [ ] **Payday Prediction**
  - Set expected payday
  - Predict salary deposits
  - Alert on discrepancies

### Phase 3: Group Features
- [ ] **Merry-Go-Round (Chama)**
  - Create rotation schedule
  - Track cycle amounts
  - Auto-distribute payments

- [ ] **Chama Loans**
  - Issue group loans
  - Track repayment schedule
  - Calculate interest

- [ ] **Penalty Rules**
  - Set group penalties
  - Track violations
  - Auto-calculate fines

### Phase 4: Business & Invoicing
- [ ] **Invoicing System**
  - Create invoices
  - Track payment status
  - Send payment reminders

- [ ] **Multi-till Support**
  - Add M-Pesa lines
  - Switch between tills
  - Track per-till transactions

- [ ] **Agent Reconciliation**
  - Log opening/closing cash
  - Calculate discrepancies
  - Generate reports

### Phase 5: Advanced Features
- [ ] **Bill Splitting**
  - Create splits
  - Track participant payments
  - Send payment requests

- [ ] **Analytics & Reporting**
  - Spending patterns
  - Group performance
  - Financial health score

- [ ] **Notifications**
  - Payment reminders
  - Group updates
  - Alerts & warnings

---

## Tech Stack

### Frontend
- **Framework**: Next.js / React / Vue.js (TBD)
- **UI Library**: Tailwind CSS / Material-UI (TBD)
- **State Management**: Redux / Zustand (TBD)

### Backend
- **Database**: Supabase (PostgreSQL)
- **Authentication**: Supabase Auth
- **Real-time**: Supabase Realtime
- **Storage**: Supabase Storage

### Mobile (Future)
- **Framework**: React Native / Flutter (TBD)
- **Push Notifications**: Firebase Cloud Messaging

---

## Development Guidelines

### 1. API Layer
- Create Supabase client wrapper for type safety
- Implement error handling and retry logic
- Cache frequently accessed data

### 2. Data Validation
- Validate input on client and server
- Enforce RLS policies
- Handle concurrent updates

### 3. Performance
- Use pagination for large datasets
- Implement proper indexing (already in migrations)
- Optimize database queries

### 4. Security
- Never expose sensitive data to client
- Use RLS for data isolation
- Validate JWT tokens server-side

### 5. Testing
- Unit tests for business logic
- Integration tests with Supabase
- E2E tests for critical flows

---

## Common Queries & Operations

### Authentication
```javascript
// Sign up
await supabase.auth.signUp({ email, password })

// Sign in
await supabase.auth.signInWithPassword({ email, password })

// Get current user
const { data: { user } } = await supabase.auth.getUser()
```

### Create Group
```javascript
const { data, error } = await supabase
  .from('groups')
  .insert([{ name, owner_id: userId }])
```

### Add Member to Group
```javascript
const { data, error } = await supabase
  .from('members')
  .insert([{ name, phone_number, group_id }])
```

### Record Transaction
```javascript
const { data, error } = await supabase
  .from('transactions')
  .insert([{
    transaction_code,
    amount,
    phone_number,
    member_id,
    status: 'pending'
  }])
```

### Create Savings Goal
```javascript
const { data, error } = await supabase
  .from('savings_goals')
  .insert([{
    user_id,
    name,
    target_amount,
    allocation_percent
  }])
```

### Get Group Transactions
```javascript
const { data, error } = await supabase
  .from('transactions')
  .select('*, members(name), events(name)')
  .eq('members.group_id', groupId)
```

---

## Environment Variables
```env
NEXT_PUBLIC_SUPABASE_URL=your_supabase_url
NEXT_PUBLIC_SUPABASE_ANON_KEY=your_anon_key
SUPABASE_SERVICE_ROLE_KEY=your_service_role_key (server-only)
```

---

## Deployment Checklist
- [ ] Database migrations tested and deployed
- [ ] RLS policies verified
- [ ] Authentication flow tested
- [ ] Environment variables configured
- [ ] API endpoints tested
- [ ] Error handling implemented
- [ ] Logging configured
- [ ] Performance optimized
- [ ] Security audit completed
- [ ] Documentation updated

---

## Support & Resources
- Supabase Docs: https://supabase.com/docs
- PostgreSQL Docs: https://www.postgresql.org/docs/
- Kenyan Payment Methods: M-Pesa, USSD, SIM Toolkit
- Compliance: Central Bank of Kenya regulations

---

## Next Steps
1. **Set up frontend project** with chosen framework
2. **Create Supabase client wrapper** for type-safe queries
3. **Implement authentication flow** with phone verification
4. **Build core UI components** (forms, tables, modals)
5. **Integrate first feature** (Groups/Members management)
6. **Test end-to-end flow** with Supabase
7. **Iterate and expand** to additional features

---

**Status**: ✅ Database schema deployed and ready for implementation
**Last Updated**: 2026-05-29
