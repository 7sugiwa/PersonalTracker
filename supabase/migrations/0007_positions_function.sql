-- get_positions(as_of) — per-position table backing the /portfolio page:
-- quantity, cost basis, latest price, market value, and whether the
-- asset could actually be priced.
--
-- The latest_price / latest_fx CTEs are lifted verbatim from
-- compute_net_worth() (0005_networth_function.sql) — same "latest
-- snapshot on or before as_of" rule, so a position's market value here
-- always agrees with what compute_net_worth folded into
-- holdings_value. That agreement is why this is SQL and not a
-- TypeScript aggregation: PostgREST can't express "latest row per
-- asset" (needs DISTINCT ON), and duplicating the valuation logic in
-- TS risks it silently drifting from the function the daily cron
-- actually depends on.
--
-- The one deliberate difference from compute_net_worth: an unpriced
-- asset (no price snapshot yet, or no FX rate yet) gets
-- market_value_idr = NULL here, not 0. compute_net_worth coalesces to
-- 0 because an aggregate has to resolve to *some* number; a per-position
-- view must not make the same choice, or "not valued yet" reads as
-- "worth nothing" — which is a different, false, statement about the
-- position.

create or replace function get_positions(as_of date default current_date)
returns table (
  asset_id uuid,
  symbol text,
  display_name text,
  asset_class text,
  unit text,
  quantity numeric,
  avg_cost_idr numeric,
  total_cost_idr numeric,
  latest_price numeric,
  price_currency text,
  price_on date,
  fx_rate numeric,
  market_value_idr numeric,
  priced boolean
)
language sql
stable
as $$
  with latest_price as (
    select distinct on (ps.asset_id)
      ps.asset_id, ps.price, ps.currency, ps.snapshot_on
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
  )
  select
    a.id as asset_id,
    a.symbol,
    a.display_name,
    a.asset_class::text,
    a.unit::text,
    h.quantity,
    h.avg_cost_idr,
    h.total_cost_idr,
    lp.price as latest_price,
    lp.currency as price_currency,
    lp.snapshot_on as price_on,
    case when lp.currency = 'IDR' then 1 else fx.rate end as fx_rate,
    case
      when lp.currency is null then null
      when lp.currency = 'IDR' then h.quantity * lp.price
      when fx.rate is null then null
      else h.quantity * lp.price * fx.rate
    end as market_value_idr,
    (lp.currency is not null and (lp.currency = 'IDR' or fx.rate is not null)) as priced
  from holdings h
  join assets a on a.id = h.asset_id
  left join latest_price lp on lp.asset_id = a.id
  left join latest_fx fx on fx.base = lp.currency and fx.quote = 'IDR'
  where h.quantity != 0
  order by market_value_idr desc nulls last;
$$;
