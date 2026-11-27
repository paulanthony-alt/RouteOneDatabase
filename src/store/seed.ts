import type { Card, CardEvent, DB, Sale } from '../types';

export const DEFAULT_MULTIPLIERS: Record<string, number> = {
  'RAW NM': 1, 'RAW LP': 0.8, 'RAW MP': 0.6, 'RAW HP': 0.4,
  'PSA 10': 2.5, 'PSA 9': 1.4, 'PSA 8': 1.1,
  'CGC 10': 2, 'CGC 9.5': 1.5, 'CGC 9': 1.2,
  'BGS 10': 3, 'BGS 9.5': 1.8,
  SEALED: 1,
};

let eid = 0;
const L = (event: string, on: string, note: string): CardEvent => ({ id: ++eid, event, on, note });
const sold = (price: number, on: string, note: string): Sale => ({
  price, on, at: `${on}T12:00:00.000Z`, payment: note.includes('trade') ? 'Trade' : 'Cash', buyer: '', showId: null,
});

type Row = [string, string, string, string, string, string, number, number, number, Card['status'], string, CardEvent[], Sale?];
const rows: Row[] = [
  ['R1-0001', 'Charizard ex', 'Obsidian Flames', '223/197', 'Pokémon', 'PSA 10', 1, 180, 265, 'Listed', 'Case 1 · A', [L('ACQUIRED', '2026-11-14', 'Gold Coast Card Show — trade-in'), L('LISTED', '2026-11-18', 'Instagram @_routeonetcg')]],
  ['R1-0002', 'Umbreon VMAX Alt Art', 'Evolving Skies', '215/203', 'Pokémon', 'RAW NM', 1, 420, 560, 'Held', 'Vault · 02', [L('ACQUIRED', '2026-10-30', 'Private collection buy'), L('INSPECTED', '2026-11-02', 'Centering 55/45 — grade candidate')]],
  ['R1-0003', 'Pikachu with Grey Felt Hat', 'SVP Promo', '085', 'Pokémon', 'PSA 9', 2, 60, 72, 'Listed', 'Binder A · P3', [L('ACQUIRED', '2026-10-12', 'eBay lot'), L('LISTED', '2026-11-14', 'Gold Coast Card Show table')]],
  ['R1-0004', 'Mew ex', 'Paldean Fates', '232/091', 'Pokémon', 'RAW NM', 3, 18, 24, 'Listed', 'Binder B · P1', [L('PULLED', '2026-11-06', 'Booster box break')]],
  ['R1-0005', 'Victor Wembanyama Prizm RC', '2023 Prizm', '#136', 'Basketball', 'PSA 9', 1, 140, 118, 'Held', 'Case 2 · C', [L('ACQUIRED', '2026-09-28', 'Local vendor'), L('FLAGGED', '2026-11-20', 'Below cost — hold for Dec 12')]],
  ['R1-0006', 'Giratina V Alt Art', 'Lost Origin', '186/196', 'Pokémon', 'CGC 9.5', 1, 260, 295, 'Held', 'Vault · 05', [L('ACQUIRED', '2026-10-04', 'Facebook Marketplace'), L('GRADED', '2026-11-10', 'CGC returned 9.5')]],
  ['R1-0007', 'Caitlin Clark Prizm RC', '2024 Prizm WNBA', '#22', 'Basketball', 'PSA 10', 1, 210, 240, 'Listed', 'Case 2 · A', [L('ACQUIRED', '2026-11-15', 'Gold Coast Card Show — cash'), L('LISTED', '2026-11-21', 'Instagram @_routeonetcg')]],
  ['R1-0008', 'Shohei Ohtani Topps Chrome RC', '2018 Topps Chrome', '#150', 'Baseball', 'RAW NM', 1, 85, 110, 'Sold', '—', [L('ACQUIRED', '2026-08-22', 'Card shop buy'), L('SOLD', '2026-11-15', 'Gold Coast Card Show — cash')], sold(110, '2026-11-15', 'cash')],
  ['R1-0009', 'Lugia V Alt Art', 'Silver Tempest', '186/195', 'Pokémon', 'RAW LP', 1, 150, 128, 'Sold', '—', [L('ACQUIRED', '2026-09-09', 'Trade'), L('SOLD', '2026-11-14', 'Gold Coast Card Show — trade')], sold(128, '2026-11-14', 'trade')],
  ['R1-0010', 'Prismatic Evolutions ETB', 'Sealed', 'ETB', 'Pokémon', 'SEALED', 2, 110, 130, 'Held', 'Shelf · S1', [L('ACQUIRED', '2026-11-01', 'Retail allocation')]],
];

export function seed(): DB {
  return {
    version: 1,
    nextCard: 11,
    nextId: eid + 1,
    cards: rows.map(([id, name, setName, cardNo, game, grade, qty, cost, market, status, location, events, sale]) => ({
      id, name, setName, cardNo, game, grade, qty, cost, market, status, location,
      paid: false, // bought before the bankroll started
      acquiredShowId: null, splitFrom: null, sale: sale ?? null, estimate: null,
      events: events.map((e) => ({ ...e })),
    })),
    tasks: [],
    interests: [],
    ads: [],
    shows: [
      {
        id: 'show-2026-12-12',
        name: 'Holiday Pokémon & Sports Card Show',
        date: '2026-12-12',
        hours: '9A–3P',
        venue: '395 Round Hill Rd, Greenwich CT',
        float: 0,
        lines: [],
        attendance: { new: 0, returning: 0 },
        opening: null,
      },
    ],
    bankroll: { starting: 0, startedOn: '2026-11-27', adjustments: [] },
    settings: { multipliers: { ...DEFAULT_MULTIPLIERS }, pokemonApiKey: '' },
  };
}
