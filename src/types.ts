export type Status = 'Held' | 'Listed' | 'Sold';
export type Payment = 'Cash' | 'Card' | 'Venmo / Zelle' | 'Trade';
export const PAYMENTS: Payment[] = ['Cash', 'Card', 'Venmo / Zelle', 'Trade'];

export interface CardEvent {
  id: number;
  event: string;
  on: string; // YYYY-MM-DD
  note: string;
}

export interface Sale {
  price: number; // per unit
  on: string; // YYYY-MM-DD
  at: string; // ISO timestamp the sale was recorded
  payment: Payment;
  buyer: string;
  showId: string | null;
  /** The ad that brought this buyer in, if any. */
  adId?: number | null;
}

export interface Estimate {
  value: number; // per unit, grade-adjusted
  raw: number | null; // ungraded market the value came from, if any
  source: string;
  url?: string;
  at: string; // ISO timestamp
}

export interface Card {
  id: string;
  name: string;
  setName: string;
  cardNo: string;
  game: string;
  grade: string;
  qty: number;
  cost: number; // per unit
  market: number; // per unit
  status: Status;
  location: string;
  /** Purchase came out of the bankroll (starting money). */
  paid: boolean;
  acquiredShowId: string | null;
  /** Set on the Sold record created when part of a stack sells. */
  splitFrom: string | null;
  sale: Sale | null;
  estimate: Estimate | null;
  events: CardEvent[];
}

export interface CardInput {
  name: string;
  setName: string;
  cardNo: string;
  game: string;
  grade: string;
  qty: number;
  cost: number;
  market: number;
  status: Status;
  location: string;
}

export interface ShowLine {
  id: number;
  kind: 'income' | 'expense';
  label: string;
  amount: number;
}

export interface Show {
  id: string;
  name: string;
  date: string; // YYYY-MM-DD
  hours: string;
  venue: string;
  float: number; // cash in the drawer at open
  lines: ShowLine[];
  attendance: { new: number; returning: number };
  /** Snapshot taken when the show is opened, for sell-through. */
  opening: { at: string; units: number; value: number } | null;
}

export interface CashAdjustment {
  id: number;
  on: string;
  amount: number; // + deposit, − withdrawal
  note: string;
}

export type TaskStatus = 'todo' | 'doing' | 'done';

export interface Task {
  id: number;
  title: string;
  due: string; // YYYY-MM-DD or ''
  who: string;
  priority: 'normal' | 'high';
  status: TaskStatus;
  showId: string | null;
  notes: string;
  createdOn: string;
  doneOn: string | null;
}

export type InterestKind = 'customer' | 'buy';
export type InterestStatus = 'open' | 'contacted' | 'closed';

/** Someone wants a card: a customer's want-list entry, or a card we're hunting to buy. */
export interface Interest {
  id: number;
  kind: InterestKind;
  who: string;
  contact: string;
  card: string;
  grade: string;
  maxPrice: number | null;
  notes: string;
  status: InterestStatus;
  createdOn: string;
}

export const AD_CHANNELS = ['Instagram', 'Facebook', 'TikTok', 'Flyers', 'Local paper', 'Other'];

/** Money spent on advertising. Sales can point back to the ad that brought the buyer in. */
export interface Ad {
  id: number;
  name: string;
  channel: string;
  on: string; // date the money was spent (YYYY-MM-DD)
  spend: number;
  showId: string | null;
  notes: string;
}

export interface DB {
  version: 1;
  nextCard: number;
  nextId: number;
  cards: Card[];
  shows: Show[];
  tasks: Task[];
  interests: Interest[];
  ads: Ad[];
  bankroll: { starting: number; startedOn: string; adjustments: CashAdjustment[] };
  settings: { multipliers: Record<string, number>; pokemonApiKey: string };
}
