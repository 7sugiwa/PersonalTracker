-- Telegram expense & net worth tracker — core schema.
-- See docs/plan.md for the full design and rationale.

create extension if not exists "pgcrypto";

-- ---------------------------------------------------------------------------
-- Enums
-- ---------------------------------------------------------------------------

-- 'equity' is a bookkeeping-only account kind used exactly once, to seed
-- pre-existing asset holdings (see scripts/seed-opening.ts). Every
-- asset_buy/asset_sell transaction requires a real account_id, but a
-- position you already owned before you started tracking has no real
-- purchase happening now — its cash effect is already baked into your
-- real accounts' opening_balance. The cash-balance formula in
-- lib/networth.ts therefore excludes accounts of kind 'equity' entirely;
-- it exists only so recompute_holdings() (which is asset-scoped, not
-- account-scoped) has somewhere to point.
create type account_kind as enum ('bank', 'ewallet', 'cash', 'broker', 'equity');
create type category_kind as enum ('expense', 'income');
create type asset_class as enum ('gold', 'us_equity', 'idx_equity', 'crypto');
create type transaction_type as enum ('income', 'expense', 'asset_buy', 'asset_sell', 'transfer');
create type message_status as enum ('received', 'parsed', 'inserted', 'failed', 'ignored');

-- ---------------------------------------------------------------------------
-- accounts — cash-holding places (bank, e-wallet, physical cash, broker cash)
-- ---------------------------------------------------------------------------

create table accounts (
  id uuid primary key default gen_random_uuid(),
  name text not null unique,
  kind account_kind not null,
  currency text not null default 'IDR',
  opening_balance numeric(20, 4) not null default 0,
  opening_balance_on date not null default current_date,
  is_default boolean not null default false,
  archived_at timestamptz,
  created_at timestamptz not null default now()
);

-- ---------------------------------------------------------------------------
-- categories — fixed taxonomy Claude must choose from
-- ---------------------------------------------------------------------------

create table categories (
  id uuid primary key default gen_random_uuid(),
  slug text not null unique,
  label text not null,
  kind category_kind not null,
  sort int not null default 0,
  archived_at timestamptz,
  created_at timestamptz not null default now()
);

-- ---------------------------------------------------------------------------
-- assets — things you hold (gold, stocks, crypto), each bound to a price
-- adapter (see lib/prices/)
-- ---------------------------------------------------------------------------

create table assets (
  id uuid primary key default gen_random_uuid(),
  symbol text not null unique,
  asset_class asset_class not null,
  display_name text not null,
  unit text not null, -- 'gram' | 'share' | 'coin'
  quote_currency text not null, -- currency the raw price comes in
  price_source text not null, -- adapter key: 'logam_mulia' | 'yahoo' | 'coingecko' | 'manual'
  source_ref text not null, -- the ticker/id at that source, e.g. 'BBCA.JK'
  is_active boolean not null default true,
  created_at timestamptz not null default now()
);

-- ---------------------------------------------------------------------------
-- message_log — every inbound Telegram message. A message's identity in
-- Telegram's own model is the pair (chat_id, message_id) — message_id is
-- only unique WITHIN a chat, not globally — so that pair is the composite
-- primary key. It's also the idempotency guarantee against webhook
-- retries: a retried delivery references the same already-existing
-- message, so `ON CONFLICT (chat_id, message_id) DO NOTHING` is a no-op
-- for it. Created before `transactions` so a transaction can reference the
-- message that produced it; the reverse reference (message -> transaction)
-- is added after `transactions` exists, below.
--
-- For a private one-on-one chat with the bot (the only kind this app
-- uses), chat_id and the sender's Telegram user id are numerically the
-- same value — see lib/telegram.ts.
-- ---------------------------------------------------------------------------

create table message_log (
  chat_id bigint not null,
  message_id bigint not null,
  from_user_id bigint not null,
  body text not null,
  received_at timestamptz not null default now(),
  status message_status not null default 'received',
  error text,
  reply_message_id bigint, -- the message_id of OUR confirmation reply (same chat), for quote-reply edits
  transaction_id uuid, -- fk added after `transactions` is created
  primary key (chat_id, message_id)
);

-- ---------------------------------------------------------------------------
-- transactions — the ledger. amount is always positive; sign/direction is
-- implied by `type`. asset_buy/asset_sell debit/credit `account_id` in IDR
-- (amount) and move `quantity` units of `asset_id`.
-- ---------------------------------------------------------------------------

create table transactions (
  id uuid primary key default gen_random_uuid(),
  type transaction_type not null,
  amount numeric(20, 4) not null check (amount > 0),
  currency text not null default 'IDR',
  account_id uuid not null references accounts (id),
  counter_account_id uuid references accounts (id), -- transfers only
  category_id uuid references categories (id),
  asset_id uuid references assets (id),
  quantity numeric(28, 10), -- asset_buy/asset_sell only
  unit_price numeric(20, 4), -- asset_buy/asset_sell only, informational
  note text,
  occurred_at timestamptz not null default now(),
  -- WIB calendar date, computed in application code (lib/networth.ts) —
  -- NOT a generated column: timezone(text, timestamptz) is STABLE, not
  -- IMMUTABLE, so Postgres rejects it as a generated-column expression.
  occurred_on date not null,
  raw_message text,
  source_chat_id bigint,
  source_message_id bigint,
  parse_model text,
  deleted_at timestamptz,
  created_at timestamptz not null default now(),
  constraint transfer_needs_counter_account
    check (type != 'transfer' or counter_account_id is not null),
  constraint asset_tx_needs_asset_and_quantity
    check (
      (type not in ('asset_buy', 'asset_sell'))
      or (asset_id is not null and quantity is not null and quantity > 0)
    ),
  constraint transactions_source_message_fkey
    foreign key (source_chat_id, source_message_id) references message_log (chat_id, message_id)
);

alter table message_log
  add constraint message_log_transaction_id_fkey
  foreign key (transaction_id) references transactions (id);

-- ---------------------------------------------------------------------------
-- price_snapshots — one row per (asset, day). Latest-available lookups (not
-- "today only") are what keep net worth from zeroing out on weekends/holidays
-- or a failed cron run — see lib/networth.ts.
-- ---------------------------------------------------------------------------

create table price_snapshots (
  id uuid primary key default gen_random_uuid(),
  asset_id uuid not null references assets (id),
  price numeric(20, 4) not null,
  currency text not null,
  source text not null,
  snapshot_on date not null,
  fetched_at timestamptz not null default now(),
  unique (asset_id, snapshot_on)
);

-- ---------------------------------------------------------------------------
-- fx_rates — daily exchange rates (currently just USD/IDR via Frankfurter)
-- ---------------------------------------------------------------------------

create table fx_rates (
  id uuid primary key default gen_random_uuid(),
  base text not null,
  quote text not null,
  rate numeric(20, 10) not null,
  snapshot_on date not null,
  fetched_at timestamptz not null default now(),
  unique (base, quote, snapshot_on)
);

-- ---------------------------------------------------------------------------
-- holdings — DERIVED table, never hand-edited. Rebuilt in full by
-- recompute_holdings() (0004_functions.sql) after every asset_buy/asset_sell
-- insert, undo, or edit, using weighted average cost.
-- ---------------------------------------------------------------------------

create table holdings (
  id uuid primary key default gen_random_uuid(),
  asset_id uuid not null unique references assets (id),
  quantity numeric(28, 10) not null,
  avg_cost_idr numeric(20, 4) not null,
  total_cost_idr numeric(20, 4) not null,
  updated_at timestamptz not null default now()
);

-- ---------------------------------------------------------------------------
-- net_worth_snapshots — one row per day, written by the price cron
-- ---------------------------------------------------------------------------

create table net_worth_snapshots (
  id uuid primary key default gen_random_uuid(),
  snapshot_on date not null unique,
  cash_balance numeric(20, 4) not null,
  holdings_value numeric(20, 4) not null,
  net_worth numeric(20, 4) not null,
  breakdown jsonb not null default '{}'::jsonb, -- per-asset-class values, for the allocation chart
  created_at timestamptz not null default now()
);
