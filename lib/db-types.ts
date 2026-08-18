// Hand-written to match supabase/migrations/*.sql exactly.
//
// Once a live Supabase project exists, regenerate this from the real
// schema instead of hand-maintaining it:
//
//   npx supabase gen types typescript --project-id <ref> > lib/db-types.ts
//
// (re-add the named type exports at the bottom afterward, since the CLI
// output only defines `Database`).

export type AccountKind = "bank" | "ewallet" | "cash" | "broker" | "equity";
export type CategoryKind = "expense" | "income";
export type AssetClass = "gold" | "us_equity" | "idx_equity" | "crypto" | "bond" | "mutual_fund";
export type TransactionType =
  | "income"
  | "expense"
  | "asset_buy"
  | "asset_sell"
  | "transfer";
export type MessageStatus =
  | "received"
  | "parsed"
  | "inserted"
  | "failed"
  | "ignored";

// `Relationships` must be present (even if empty) — @supabase/postgrest-js's
// GenericTable type requires it for its embedded-resource query builder.
type Relationship = {
  foreignKeyName: string;
  columns: string[];
  isOneToOne?: boolean;
  referencedRelation: string;
  referencedColumns: string[];
};

export interface Database {
  public: {
    Tables: {
      accounts: {
        Row: {
          id: string;
          name: string;
          kind: AccountKind;
          currency: string;
          opening_balance: string;
          opening_balance_on: string;
          is_default: boolean;
          archived_at: string | null;
          created_at: string;
        };
        Insert: {
          id?: string;
          name: string;
          kind: AccountKind;
          currency?: string;
          opening_balance?: number | string;
          opening_balance_on?: string;
          is_default?: boolean;
          archived_at?: string | null;
          created_at?: string;
        };
        Update: Partial<Database["public"]["Tables"]["accounts"]["Insert"]>;
        Relationships: [];
      };
      categories: {
        Row: {
          id: string;
          slug: string;
          label: string;
          kind: CategoryKind;
          sort: number;
          archived_at: string | null;
          created_at: string;
        };
        Insert: {
          id?: string;
          slug: string;
          label: string;
          kind: CategoryKind;
          sort?: number;
          archived_at?: string | null;
          created_at?: string;
        };
        Update: Partial<Database["public"]["Tables"]["categories"]["Insert"]>;
        Relationships: [];
      };
      assets: {
        Row: {
          id: string;
          symbol: string;
          asset_class: AssetClass;
          display_name: string;
          unit: string;
          quote_currency: string;
          price_source: string;
          source_ref: string;
          is_active: boolean;
          created_at: string;
        };
        Insert: {
          id?: string;
          symbol: string;
          asset_class: AssetClass;
          display_name: string;
          unit: string;
          quote_currency: string;
          price_source: string;
          source_ref: string;
          is_active?: boolean;
          created_at?: string;
        };
        Update: Partial<Database["public"]["Tables"]["assets"]["Insert"]>;
        Relationships: [];
      };
      transactions: {
        Row: {
          id: string;
          type: TransactionType;
          amount: string;
          currency: string;
          account_id: string;
          counter_account_id: string | null;
          category_id: string | null;
          asset_id: string | null;
          quantity: string | null;
          unit_price: string | null;
          note: string | null;
          occurred_at: string;
          occurred_on: string;
          raw_message: string | null;
          // Telegram's (chat_id, message_id) pair — see the message_log
          // comment below. bigint columns; JS numbers are safe here only
          // because real Telegram IDs today are far under 2^53, not
          // because Postgres/PostgREST guarantee it — see the same
          // caveat on message_log.
          source_chat_id: number | null;
          source_message_id: number | null;
          parse_model: string | null;
          deleted_at: string | null;
          created_at: string;
        };
        Insert: {
          id?: string;
          type: TransactionType;
          amount: number | string;
          currency?: string;
          account_id: string;
          counter_account_id?: string | null;
          category_id?: string | null;
          asset_id?: string | null;
          quantity?: number | string | null;
          unit_price?: number | string | null;
          note?: string | null;
          occurred_at?: string;
          occurred_on: string;
          raw_message?: string | null;
          source_chat_id?: number | null;
          source_message_id?: number | null;
          parse_model?: string | null;
          deleted_at?: string | null;
          created_at?: string;
        };
        Update: Partial<Database["public"]["Tables"]["transactions"]["Insert"]>;
        Relationships: [
          {
            foreignKeyName: "transactions_account_id_fkey";
            columns: ["account_id"];
            isOneToOne: false;
            referencedRelation: "accounts";
            referencedColumns: ["id"];
          },
          {
            foreignKeyName: "transactions_counter_account_id_fkey";
            columns: ["counter_account_id"];
            isOneToOne: false;
            referencedRelation: "accounts";
            referencedColumns: ["id"];
          },
          {
            foreignKeyName: "transactions_category_id_fkey";
            columns: ["category_id"];
            isOneToOne: false;
            referencedRelation: "categories";
            referencedColumns: ["id"];
          },
          {
            foreignKeyName: "transactions_asset_id_fkey";
            columns: ["asset_id"];
            isOneToOne: false;
            referencedRelation: "assets";
            referencedColumns: ["id"];
          },
          {
            foreignKeyName: "transactions_source_message_fkey";
            columns: ["source_chat_id", "source_message_id"];
            isOneToOne: false;
            referencedRelation: "message_log";
            referencedColumns: ["chat_id", "message_id"];
          },
        ];
      };
      price_snapshots: {
        Row: {
          id: string;
          asset_id: string;
          price: string;
          currency: string;
          source: string;
          snapshot_on: string;
          fetched_at: string;
        };
        Insert: {
          id?: string;
          asset_id: string;
          price: number | string;
          currency: string;
          source: string;
          snapshot_on: string;
          fetched_at?: string;
        };
        Update: Partial<
          Database["public"]["Tables"]["price_snapshots"]["Insert"]
        >;
        Relationships: [
          {
            foreignKeyName: "price_snapshots_asset_id_fkey";
            columns: ["asset_id"];
            isOneToOne: false;
            referencedRelation: "assets";
            referencedColumns: ["id"];
          },
        ];
      };
      fx_rates: {
        Row: {
          id: string;
          base: string;
          quote: string;
          rate: string;
          snapshot_on: string;
          fetched_at: string;
        };
        Insert: {
          id?: string;
          base: string;
          quote: string;
          rate: number | string;
          snapshot_on: string;
          fetched_at?: string;
        };
        Update: Partial<Database["public"]["Tables"]["fx_rates"]["Insert"]>;
        Relationships: [];
      };
      holdings: {
        Row: {
          id: string;
          asset_id: string;
          quantity: string;
          avg_cost_idr: string;
          total_cost_idr: string;
          updated_at: string;
        };
        Insert: {
          id?: string;
          asset_id: string;
          quantity: number | string;
          avg_cost_idr: number | string;
          total_cost_idr: number | string;
          updated_at?: string;
        };
        Update: Partial<Database["public"]["Tables"]["holdings"]["Insert"]>;
        Relationships: [
          {
            foreignKeyName: "holdings_asset_id_fkey";
            columns: ["asset_id"];
            isOneToOne: true;
            referencedRelation: "assets";
            referencedColumns: ["id"];
          },
        ];
      };
      net_worth_snapshots: {
        Row: {
          id: string;
          snapshot_on: string;
          cash_balance: string;
          holdings_value: string;
          net_worth: string;
          breakdown: Record<string, unknown>;
          created_at: string;
        };
        Insert: {
          id?: string;
          snapshot_on: string;
          cash_balance: number | string;
          holdings_value: number | string;
          net_worth: number | string;
          breakdown?: Record<string, unknown>;
          created_at?: string;
        };
        Update: Partial<
          Database["public"]["Tables"]["net_worth_snapshots"]["Insert"]
        >;
        Relationships: [];
      };
      message_log: {
        Row: {
          // Composite primary key — see the 0001_schema.sql comment on
          // this table. bigint columns come back as plain JS numbers via
          // PostgREST; safe in practice because real Telegram IDs today
          // are far under Number.MAX_SAFE_INTEGER, but that's an
          // observation about current ID values, not a guarantee.
          chat_id: number;
          message_id: number;
          from_user_id: number;
          body: string;
          received_at: string;
          status: MessageStatus;
          error: string | null;
          reply_message_id: number | null;
          transaction_id: string | null;
        };
        Insert: {
          chat_id: number;
          message_id: number;
          from_user_id: number;
          body: string;
          received_at?: string;
          status?: MessageStatus;
          error?: string | null;
          reply_message_id?: number | null;
          transaction_id?: string | null;
        };
        Update: Partial<Database["public"]["Tables"]["message_log"]["Insert"]>;
        Relationships: [
          {
            foreignKeyName: "message_log_transaction_id_fkey";
            columns: ["transaction_id"];
            isOneToOne: false;
            referencedRelation: "transactions";
            referencedColumns: ["id"];
          },
        ];
      };
    };
    Views: Record<string, never>;
    Functions: {
      recompute_holdings: {
        Args: Record<string, never>;
        Returns: undefined;
      };
      compute_net_worth: {
        Args: { as_of?: string };
        Returns: {
          cash_balance: string;
          holdings_value: string;
          net_worth: string;
          breakdown: Record<string, unknown>;
        }[];
      };
    };
    Enums: {
      account_kind: AccountKind;
      category_kind: CategoryKind;
      asset_class: AssetClass;
      transaction_type: TransactionType;
      message_status: MessageStatus;
    };
    CompositeTypes: Record<string, never>;
  };
}

// Unused export kept only so `Relationship` isn't flagged as dead code by
// strict linting — it documents the shape every Relationships tuple above
// follows.
export type { Relationship };
