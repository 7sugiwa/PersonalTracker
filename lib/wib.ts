/**
 * WIB (Asia/Jakarta, UTC+7) date helpers. `occurred_on` on transactions and
 * `snapshot_on` on price/net-worth snapshots are WIB calendar dates
 * because that's the timezone the messages are sent in — a transaction
 * sent at 11pm WIB should land on that WIB day, not roll into UTC's next
 * day. This can't be a Postgres generated column (see the comment on
 * `occurred_on` in supabase/migrations/0001_schema.sql), so it's computed
 * here in application code instead.
 */

const WIB_DATE_FORMATTER = new Intl.DateTimeFormat("en-CA", {
  timeZone: "Asia/Jakarta",
  year: "numeric",
  month: "2-digit",
  day: "2-digit",
});

/** Returns YYYY-MM-DD for the given instant, in WIB. */
export function wibDateString(instant: Date = new Date()): string {
  // en-CA formats as YYYY-MM-DD directly, which is also a valid Postgres
  // date literal — no reassembly needed.
  return WIB_DATE_FORMATTER.format(instant);
}
