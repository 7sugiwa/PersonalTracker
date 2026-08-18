-- compute_net_worth(as_of) — the corrected net worth formula from
-- docs/plan.md. Called by lib/networth.ts (from the price cron) to build
-- each day's net_worth_snapshots row.
--
-- Two things this function exists specifically to get right:
--
-- 1. Asset purchases must debit cash, or buying gold silently inflates
--    net worth (holdings go up, cash formula doesn't move). Accounts of
--    kind 'equity' are excluded from the cash sum entirely — that kind
--    exists only to seed pre-existing holdings without double-counting
--    a purchase that already happened before tracking started (see the
--    account_kind comment in 0001_schema.sql).
--
-- 2. Holdings are valued at the LATEST AVAILABLE price/FX rate on or
--    before `as_of`, never "today's price or nothing" — otherwise a
--    weekend, a holiday, or one failed cron run zeroes out net worth.

create or replace function compute_net_worth(as_of date default current_date)
returns table (cash_balance numeric, holdings_value numeric, net_worth numeric, breakdown jsonb)
language plpgsql
as $$
declare
  v_cash numeric(20, 4) := 0;
  v_holdings numeric(20, 4) := 0;
  v_breakdown jsonb := '{}'::jsonb;
begin
  -- Cash: opening balances of real (non-equity) accounts...
  select coalesce(sum(a.opening_balance), 0)
  into v_cash
  from accounts a
  where a.kind != 'equity' and a.archived_at is null;

  -- ...plus net cash flow from transactions posted against real accounts,
  -- up to and including as_of. Transfers are deliberately excluded — they
  -- move money between two of the user's own accounts, so their net
  -- effect on TOTAL cash is always zero regardless of formula details;
  -- they only matter for per-account balances, which this function
  -- doesn't compute.
  v_cash := v_cash + coalesce((
    select sum(
      case t.type
        when 'income' then t.amount
        when 'asset_sell' then t.amount
        when 'expense' then -t.amount
        when 'asset_buy' then -t.amount
        else 0
      end
    )
    from transactions t
    join accounts a on a.id = t.account_id
    where t.deleted_at is null
      and a.kind != 'equity'
      and t.occurred_on <= as_of
  ), 0);

  -- Holdings: quantity * latest available price on/before as_of, converted
  -- to IDR via the latest available FX rate on/before as_of when the
  -- asset isn't already IDR-quoted.
  with latest_price as (
    select distinct on (ps.asset_id)
      ps.asset_id, ps.price, ps.currency
    from price_snapshots ps
    where ps.snapshot_on <= as_of
    order by ps.asset_id, ps.snapshot_on desc
  ),
  latest_fx as (
    select distinct on (fx.base, fx.quote)
      fx.base, fx.quote, fx.rate
    from fx_rates fx
    where fx.snapshot_on <= as_of
    order by fx.base, fx.quote, fx.snapshot_on desc
  ),
  valued as (
    select
      a.asset_class::text as asset_class,
      case
        when lp.currency is null then 0 -- no price snapshot yet for this asset
        when lp.currency = 'IDR' then h.quantity * lp.price
        else h.quantity * lp.price * coalesce(fx.rate, 0) -- no FX rate yet -> values at 0, not silently wrong
      end as value_idr
    from holdings h
    join assets a on a.id = h.asset_id
    left join latest_price lp on lp.asset_id = a.id
    left join latest_fx fx on fx.base = lp.currency and fx.quote = 'IDR'
  ),
  grouped as (
    select asset_class, sum(value_idr) as class_total
    from valued
    group by asset_class
  )
  select
    coalesce((select sum(class_total) from grouped), 0),
    coalesce((select jsonb_object_agg(asset_class, class_total) from grouped), '{}'::jsonb)
  into v_holdings, v_breakdown;

  return query select v_cash, v_holdings, v_cash + v_holdings, v_breakdown;
end;
$$;
