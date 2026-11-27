import type { Card, DB, Estimate } from '../types';

/*
 * Automatic card worth estimates.
 *  1. Pokémon singles: TCGplayer market price from the free Pokémon TCG API
 *     (api.pokemontcg.io), times the grade multiplier set on the Market Rates page.
 *  2. Anything else (sports, sealed, or no API match): the average of our own
 *     sales of the same card and grade.
 *  3. No data: no number, just a link to eBay sold listings to check by hand.
 */

const API = 'https://api.pokemontcg.io/v2/cards';
const VARIANTS = ['holofoil', 'normal', 'reverseHolofoil', '1stEditionHolofoil', 'unlimitedHolofoil', '1stEditionNormal', '1stEdition', 'unlimited'];
// Words we use in names that the API's card names don't include.
const NAME_NOISE = /\b(alt(ernate)? art|full art|special illustration( rare)?|illustration rare|secret rare|sir|ir|promo|rc)\b/gi;

export const ebaySoldUrl = (c: Pick<Card, 'name' | 'setName' | 'cardNo' | 'grade'>) =>
  'https://www.ebay.com/sch/i.html?LH_Sold=1&LH_Complete=1&_nkw=' +
  encodeURIComponent([c.name, c.setName, c.cardNo, c.grade.startsWith('RAW') ? '' : c.grade].filter(Boolean).join(' '));

export function multiplierFor(db: DB, grade: string): { value: number; known: boolean } {
  const g = grade.trim().toUpperCase();
  const m = db.settings.multipliers;
  if (m[g] != null) return { value: m[g], known: true };
  if (g.startsWith('RAW')) return { value: m['RAW NM'] ?? 1, known: false };
  return { value: 1, known: false };
}

const isPokemon = (game: string) => game.normalize('NFD').replace(/[̀-ͯ]/g, '').toLowerCase().includes('pokemon');

interface ApiCard {
  id: string;
  name: string;
  number: string;
  set: { name: string };
  tcgplayer?: { url?: string; prices?: Record<string, { market?: number | null; mid?: number | null }> };
}

async function query(q: string, key: string): Promise<ApiCard[]> {
  const url = `${API}?q=${encodeURIComponent(q)}&select=id,name,number,set,tcgplayer&pageSize=20`;
  const res = await fetch(url, key ? { headers: { 'X-Api-Key': key } } : undefined);
  if (!res.ok) throw new Error(`Pokémon TCG API returned ${res.status}`);
  return ((await res.json()) as { data: ApiCard[] }).data ?? [];
}

function priceOf(c: ApiCard): number | null {
  const p = c.tcgplayer?.prices;
  if (!p) return null;
  for (const v of VARIANTS) {
    const x = p[v]?.market ?? p[v]?.mid;
    if (x) return x;
  }
  for (const x of Object.values(p)) if (x.market ?? x.mid) return (x.market ?? x.mid)!;
  return null;
}

async function pokemonRaw(card: Card, key: string): Promise<{ raw: number; label: string; url?: string } | null> {
  const name = card.name.replace(NAME_NOISE, '').replace(/\s+/g, ' ').trim();
  const no = card.cardNo.split('/')[0].replace('#', '').trim();
  const nos = [...new Set([no, no.replace(/^0+(?=\d)/, '')])].filter((n) => /^[\w-]+$/.test(n));
  const base = `name:"${name.replace(/"/g, '')}"`;

  let found: ApiCard[] = [];
  for (const n of nos) {
    found = await query(`${base} number:${n}`, key);
    if (found.length) break;
  }
  if (!found.length) found = await query(base, key);

  const set = card.setName.toLowerCase();
  const ranked = found
    .map((c) => ({ c, price: priceOf(c), setHit: set && c.set.name.toLowerCase() === set ? 1 : 0 }))
    .filter((x) => x.price != null)
    .sort((a, b) => b.setHit - a.setHit);
  // Name-only matches across many sets are too loose to trust unless the set matches.
  const best = ranked[0];
  if (!best || (!nos.length && !best.setHit && ranked.length > 1)) return null;
  return { raw: best.price!, label: `${best.c.name} · ${best.c.set.name} #${best.c.number}`, url: best.c.tcgplayer?.url };
}

function comps(db: DB, card: Card): { value: number; n: number } | null {
  const same = db.cards.filter(
    (c) => c.sale && c.id !== card.id && c.name.toLowerCase() === card.name.toLowerCase() && c.grade.toUpperCase() === card.grade.toUpperCase(),
  );
  if (!same.length) return null;
  const u = same.reduce((n, c) => n + c.qty, 0);
  return { value: same.reduce((s, c) => s + c.sale!.price * c.qty, 0) / u, n: u };
}

export async function estimateCard(db: DB, card: Card): Promise<Estimate | null> {
  const at = new Date().toISOString();
  let apiError = '';

  if (isPokemon(card.game) && card.grade.toUpperCase() !== 'SEALED') {
    try {
      const hit = await pokemonRaw(card, db.settings.pokemonApiKey);
      if (hit) {
        const m = multiplierFor(db, card.grade);
        const grade = m.value === 1 ? '' : ` × ${m.value} ${card.grade}${m.known ? '' : ' (no multiplier set)'}`;
        return { value: hit.raw * m.value, raw: hit.raw, source: `TCGplayer market $${hit.raw.toFixed(2)}${grade}`, url: hit.url, at };
      }
    } catch (e) {
      apiError = (e as Error).message;
    }
  }

  const c = comps(db, card);
  if (c) return { value: c.value, raw: null, source: `Avg of our ${c.n} sale${c.n > 1 ? 's' : ''}`, at };

  if (apiError) throw new Error(apiError);
  return null;
}
