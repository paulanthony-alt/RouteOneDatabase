# Route One TCG — Inventory Ledger

React + Vite + TypeScript. Runs entirely in the browser; data is saved in `localStorage`
(export/import a JSON backup from **Bankroll → Data**). Hosted on Firebase Hosting.

## Run locally

```bash
npm install
npm run dev
```

## Deploy to Firebase Hosting

1. Put your Firebase project id in `.firebaserc`.
2. `npm run build`
3. `npx firebase-tools deploy --only hosting`

## Pages

- **Inventory** — the ledger. + New Entry, Edit Record, Mark Sold, auto estimate per card.
- **Sales** — every sale with price, cost, profit, payment, buyer and show; filter by show.
- **Shows** — per show: gross sales, card profit, other income (vendor tables, admission),
  expenses, net profit; cash drawer (float + cash sales − buys); retention:
  door count new vs. returning, repeat buyers, and sell-through (use **Open Show** on the day to snapshot listed inventory).
- **Market Rates** — estimate all cards, apply estimates, tune grade multipliers.
- **Bankroll** — starting money, deposits/withdrawals, running cash balance, total worth.

## How estimates work

Pokémon singles: TCGplayer market price from the free Pokémon TCG API (`api.pokemontcg.io`)
× the grade multiplier on Market Rates. Sports cards, sealed product, or no API match: the
average of our own sales of the same card and grade. Otherwise no number — use the eBay
sold-listings link on the record.

## Moving data to Firestore

All state is one object managed in `src/store/store.tsx`. Replace `load()` / `save()` there
with Firestore reads/writes; the rest of the app doesn't change.
