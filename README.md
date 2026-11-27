# Route One TCG — Inventory Ledger

React + Vite + TypeScript on Firebase: Hosting, Authentication (email + password) and Firestore.
Without Firebase settings it runs on this browser's storage only, with no login.

## Set up Firebase (once)

1. Create a project at console.firebase.google.com and add a **Web app**. Copy its config into
   `.env.local` (start from `.env.example`), and put the project id in `.firebaserc`.
2. **Authentication → Sign-in method:** enable **Email/Password**. Under **Settings → User actions**,
   turn off "Enable create (sign-up)" so only accounts you add exist.
3. **Authentication → Users → Add user** for each staff member.
4. **Firestore Database → Create database.** Then under **Data**, create a collection `staff` with one
   document per staff member whose **document ID is their email in lower case** (any field, e.g. `role: staff`).
   Signed-in users who aren't on this list see "Not on the staff list" and can read nothing.
5. Deploy the security rules and the site:
   ```bash
   npm install
   npm run deploy
   ```
6. Sign in. The first time, choose **Upload this browser's data**, **Start empty**, or **Start with sample data**.

## Develop

```bash
npm run dev
```

To work against local emulators instead of the real project: `npm run emulators` in one terminal,
set `VITE_FIREBASE_EMULATORS=true` (with any values for the other `VITE_FIREBASE_*` keys, project id
`demo-route-one`) and run `npm run dev`.

## Data in Firestore

- `ledger/main` — shows, bankroll, settings and ID counters
- `cards/{R1-0001…}` — one document per inventory record, with its chain of custody
- `staff/{email}` — who may use the app (managed in the console only)

Every change runs as a Firestore transaction against the latest data, so two devices recording sales
or tapping the door counter at the same time don't overwrite each other. The app keeps a cached copy
on each device, so the ledger stays readable on bad Wi-Fi — but saving needs a connection; a failed
save shows a message and nothing is lost on screen.

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
