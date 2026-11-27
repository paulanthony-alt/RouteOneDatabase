export type Status = 'Held' | 'Listed' | 'Sold';

export interface CardEvent {
  id: number;
  card_id: string;
  event: string;
  occurred_on: string; // YYYY-MM-DD
  note: string;
}

export interface Card {
  id: string;
  name: string;
  set_name: string;
  card_no: string;
  game: string;
  grade: string;
  qty: number;
  cost: number;
  market: number;
  status: Status;
  location: string;
  sold_price: number | null;
  sold_on: string | null;
  updated_at: string;
  card_events: CardEvent[];
}

/** Editable fields shared by New Entry and Edit Record. */
export interface CardInput {
  name: string;
  set_name: string;
  card_no: string;
  game: string;
  grade: string;
  qty: number;
  cost: number;
  market: number;
  status: Status;
  location: string;
}
