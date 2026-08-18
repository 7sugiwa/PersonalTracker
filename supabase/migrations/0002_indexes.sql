-- Indexes for the query patterns in lib/networth.ts and the dashboard.

create index transactions_occurred_on_idx on transactions (occurred_on) where deleted_at is null;
create index transactions_account_id_idx on transactions (account_id) where deleted_at is null;
create index transactions_asset_id_idx on transactions (asset_id) where asset_id is not null and deleted_at is null;
create index transactions_category_id_idx on transactions (category_id) where deleted_at is null;
create index transactions_source_message_idx on transactions (source_chat_id, source_message_id) where source_message_id is not null;

create index price_snapshots_asset_latest_idx on price_snapshots (asset_id, snapshot_on desc);
create index fx_rates_pair_latest_idx on fx_rates (base, quote, snapshot_on desc);

create index message_log_received_at_idx on message_log (received_at desc);
create index message_log_reply_message_idx on message_log (chat_id, reply_message_id) where reply_message_id is not null;

create index net_worth_snapshots_on_idx on net_worth_snapshots (snapshot_on desc);
