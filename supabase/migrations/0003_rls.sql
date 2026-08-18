-- Enable RLS on every table with NO permissive policies.
--
-- This app never uses the anon/authenticated Supabase roles — every server
-- read/write goes through the service role key, which bypasses RLS
-- entirely. So this migration costs nothing functionally, but it means
-- that if an anon key or public REST access is ever accidentally exposed
-- (this is a public repo — see docs/plan.md § Public repository), the
-- database is still closed by default rather than open by default.

alter table accounts enable row level security;
alter table categories enable row level security;
alter table assets enable row level security;
alter table transactions enable row level security;
alter table price_snapshots enable row level security;
alter table fx_rates enable row level security;
alter table holdings enable row level security;
alter table net_worth_snapshots enable row level security;
alter table message_log enable row level security;
