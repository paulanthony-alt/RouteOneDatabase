# Route One TCG — Inventory Ledger

React + Vite + TypeScript front end on a Supabase (Postgres) back end.

## Setup

1. Create a Supabase project.
2. Apply the schema, then (optionally) the sample data:
   - **CLI:** `supabase link --project-ref <ref>` then `supabase db push`, and run `supabase/seed.sql` for sample data.
   - **Dashboard:** paste `supabase/migrations/20261127000000_cards.sql`, then `supabase/seed.sql`, into the SQL editor.
3. In **Authentication → Sign In / Providers**, turn off "Allow new users to sign up", then invite staff under
   **Authentication → Users**. Sign-in is by email magic link; add your site URL under **URL Configuration**.
4. `cp .env.example .env.local` and fill in the project URL and anon key.
5. `npm install` and `npm run dev`.

## Data model

| table         | purpose                                                     |
| ------------- | ----------------------------------------------------------- |
| `cards`       | one row per inventory record (`R1-0001`… ids from a sequence) |
| `card_events` | chain of custody — ACQUIRED, LISTED, SOLD, …                |

Money is stored per unit (`cost`, `market`, `sold_price`). Realized P/L uses `sold_price`, not market.

All writes go through three RPCs, so each change and its custody entry commit together:

- `create_card` — **+ New Entry**. Inserts the card plus an ACQUIRED / PULLED / TRADED IN event (and LISTED if listed).
- `update_card` — **Edit Record**. Held ⇄ Listed is allowed and logged; sold records keep their status but their sale price/date can be corrected.
- `mark_card_sold` — **Mark Sold**. Selling part of a quantity splits the record: the original keeps the remainder and a new Sold record (with a copy of the custody log) takes the units sold.

Row level security limits every table and RPC to signed-in users; the anon key alone can read nothing.
