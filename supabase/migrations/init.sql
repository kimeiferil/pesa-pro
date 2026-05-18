create extension if not exists "uuid-ossp";

create table if not exists members (
  id uuid primary key default uuid_generate_v4(),
  name text,
  phone text unique
);

create table if not exists events (
  id uuid primary key default uuid_generate_v4(),
  name text,
  type text,
  target_amount numeric
);

create table if not exists transactions (
  id uuid primary key default uuid_generate_v4(),
  transaction_code text unique,
  amount numeric,
  phone text,
  name text,
  transaction_type text default 'unknown',
  event_id uuid,
  created_at timestamp default now()
);
