import { supabase } from './supabase';
import type { Card, CardInput } from '../types';

const num = (v: unknown) => (v == null ? null : Number(v));

function normalize(row: Record<string, unknown>): Card {
  const c = row as unknown as Card;
  return {
    ...c,
    qty: Number(c.qty),
    cost: Number(c.cost),
    market: Number(c.market),
    sold_price: num(c.sold_price),
    card_events: [...(c.card_events ?? [])].sort(
      (a, b) => a.occurred_on.localeCompare(b.occurred_on) || a.id - b.id,
    ),
  };
}

function fail(error: { message: string } | null): asserts error is null {
  if (error) throw new Error(error.message);
}

export async function fetchCards(): Promise<Card[]> {
  const { data, error } = await supabase.from('cards').select('*, card_events(*)').order('id');
  fail(error);
  return (data ?? []).map(normalize);
}

const params = (c: CardInput) => ({
  p_name: c.name,
  p_set_name: c.set_name,
  p_card_no: c.card_no,
  p_game: c.game,
  p_grade: c.grade,
  p_qty: c.qty,
  p_cost: c.cost,
  p_market: c.market,
  p_status: c.status,
  p_location: c.location,
});

export async function createCard(c: CardInput, ev: { event: string; on: string; note: string }) {
  const { data, error } = await supabase.rpc('create_card', {
    ...params(c),
    p_event: ev.event,
    p_event_on: ev.on,
    p_note: ev.note,
  });
  fail(error);
  return data as { id: string };
}

export async function updateCard(id: string, c: CardInput, sold?: { price: number; on: string }) {
  const { data, error } = await supabase.rpc('update_card', {
    p_id: id,
    ...params(c),
    p_sold_price: sold?.price ?? null,
    p_sold_on: sold?.on ?? null,
  });
  fail(error);
  return data as { id: string };
}

export async function markSold(id: string, s: { qty: number; price: number; on: string; note: string }) {
  const { data, error } = await supabase.rpc('mark_card_sold', {
    p_id: id,
    p_qty: s.qty,
    p_price: s.price,
    p_sold_on: s.on,
    p_note: s.note,
  });
  fail(error);
  return data as { id: string };
}
