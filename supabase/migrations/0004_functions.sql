-- recompute_holdings() — full rebuild of `holdings` from the non-deleted
-- asset_buy/asset_sell transaction history, using weighted average cost.
--
-- Called explicitly from application code (lib/networth.ts) after every
-- insert, undo (soft-delete), or edit of an asset_buy/asset_sell row.
-- It is a full rebuild rather than an incremental update on purpose: undo
-- and edit are common in this app (typos happen), and incremental
-- mutation of a running average cannot be reversed correctly once a later
-- sell has consumed part of it. A full rebuild sidesteps that entirely —
-- it's always correct, and at personal-finance transaction volumes it's
-- also cheap.

create or replace function recompute_holdings()
returns void
language plpgsql
as $$
declare
  a record;
  t record;
  running_qty numeric(28, 10);
  running_cost numeric(20, 4);
  new_qty numeric(28, 10);
  new_cost numeric(20, 4);
begin
  delete from holdings where true;

  for a in select id from assets loop
    running_qty := 0;
    running_cost := 0;

    for t in
      select type, quantity, amount
      from transactions
      where asset_id = a.id
        and deleted_at is null
        and type in ('asset_buy', 'asset_sell')
      order by occurred_at asc, created_at asc
    loop
      if t.type = 'asset_buy' then
        running_qty := running_qty + t.quantity;
        running_cost := running_cost + t.amount;
      else
        -- asset_sell: reduce cost basis proportionally to the fraction of
        -- the position sold, so avg_cost_idr is unchanged by a sell.
        -- Selling more than you hold (bad data, or an out-of-order edit)
        -- is clamped to zero rather than going negative.
        if running_qty > 0 then
          new_qty := running_qty - t.quantity;
          if new_qty < 0 then
            new_qty := 0;
          end if;
          new_cost := running_cost * (new_qty / running_qty);
          running_qty := new_qty;
          running_cost := new_cost;
        end if;
      end if;
    end loop;

    if running_qty > 0 then
      insert into holdings (asset_id, quantity, avg_cost_idr, total_cost_idr, updated_at)
      values (
        a.id,
        running_qty,
        round(running_cost / running_qty, 4),
        round(running_cost, 4),
        now()
      );
    end if;
  end loop;
end;
$$;
