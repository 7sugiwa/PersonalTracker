import Form from "next/form";
import type { TxFilters, FilterOptions } from "@/lib/transactions-data";
import { ButtonLink, Button } from "@/components/ui/button";
import { CheckChip, DateInput, Input, Label, Select } from "@/components/ui/field";

const TYPE_OPTIONS: Array<{ value: TxFilters["types"][number]; label: string }> = [
  { value: "income", label: "Income" },
  { value: "expense", label: "Expense" },
  { value: "asset_buy", label: "Buy" },
  { value: "asset_sell", label: "Sell" },
  { value: "transfer", label: "Transfer" },
];

/** GET form -> /transactions?... — zero client JS, progressively
 * enhanced, and Next prefetches transactions/loading.tsx once this
 * scrolls into view. A filter change always resets to page 1 via the
 * hidden input below. */
export function FilterBar({ filters, options }: { filters: TxFilters; options: FilterOptions }) {
  return (
    <Form action="/transactions" className="mb-4 rounded-xl border border-line bg-surface p-4">
      <input type="hidden" name="page" value="1" />

      <div className="mb-3">
        <Label>Type</Label>
        <div className="flex flex-wrap gap-1.5">
          {TYPE_OPTIONS.map((opt) => (
            <CheckChip
              key={opt.value}
              name="type"
              value={opt.value}
              defaultChecked={filters.types.includes(opt.value)}
            >
              {opt.label}
            </CheckChip>
          ))}
        </div>
      </div>

      <div className="grid grid-cols-2 gap-3 sm:grid-cols-3 lg:grid-cols-6">
        <div>
          <Label htmlFor="account">Account</Label>
          <Select id="account" name="account" defaultValue={filters.accountId ?? ""}>
            <option value="">All accounts</option>
            {options.accounts.map((a) => (
              <option key={a.id} value={a.id}>
                {a.name}
              </option>
            ))}
          </Select>
        </div>
        <div>
          <Label htmlFor="category">Category</Label>
          <Select id="category" name="category" defaultValue={filters.categoryId ?? ""}>
            <option value="">All categories</option>
            {options.categories.map((c) => (
              <option key={c.id} value={c.id}>
                {c.label}
              </option>
            ))}
          </Select>
        </div>
        <div>
          <Label htmlFor="asset">Asset</Label>
          <Select id="asset" name="asset" defaultValue={filters.assetId ?? ""}>
            <option value="">All assets</option>
            {options.assets.map((a) => (
              <option key={a.id} value={a.id}>
                {a.symbol}
              </option>
            ))}
          </Select>
        </div>
        <div>
          <Label htmlFor="from">From</Label>
          <DateInput id="from" name="from" defaultValue={filters.from ?? ""} />
        </div>
        <div>
          <Label htmlFor="to">To</Label>
          <DateInput id="to" name="to" defaultValue={filters.to ?? ""} />
        </div>
        <div>
          <Label htmlFor="q">Search note</Label>
          <Input id="q" name="q" type="text" placeholder="e.g. kopi" defaultValue={filters.q ?? ""} />
        </div>
      </div>

      <div className="mt-3 flex items-center gap-2">
        <Button type="submit" variant="primary" size="sm">
          Apply
        </Button>
        <ButtonLink href="/transactions" variant="ghost" size="sm">
          Clear
        </ButtonLink>
      </div>
    </Form>
  );
}
