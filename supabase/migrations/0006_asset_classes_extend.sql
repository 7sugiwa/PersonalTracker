-- Extends asset_class with two classes that have no free live-price API:
-- retail government bonds/sukuk (bond) and mutual funds (mutual_fund).
-- Both are seeded with price_source = 'manual' (see lib/prices/index.ts) —
-- the daily cron skips them rather than faking a fetch, so their price
-- snapshot only updates when you insert one by hand.
alter type asset_class add value 'bond';
alter type asset_class add value 'mutual_fund';
