-- Sample inventory from the original HTML prototype. Safe to skip in production.

insert into public.cards (id, name, set_name, card_no, game, grade, qty, cost, market, status, location, sold_price, sold_on) values
  ('R1-0001', 'Charizard ex',                  'Obsidian Flames',   '223/197', 'Pokémon',    'PSA 10',  1, 180, 265, 'Listed', 'Case 1 · A',    null, null),
  ('R1-0002', 'Umbreon VMAX Alt Art',          'Evolving Skies',    '215/203', 'Pokémon',    'RAW NM',  1, 420, 560, 'Held',   'Vault · 02',    null, null),
  ('R1-0003', 'Pikachu with Grey Felt Hat',    'SVP Promo',         '085',     'Pokémon',    'PSA 9',   2,  60,  72, 'Listed', 'Binder A · P3', null, null),
  ('R1-0004', 'Mew ex',                        'Paldean Fates',     '232/091', 'Pokémon',    'RAW NM',  3,  18,  24, 'Listed', 'Binder B · P1', null, null),
  ('R1-0005', 'Victor Wembanyama Prizm RC',    '2023 Prizm',        '#136',    'Basketball', 'PSA 9',   1, 140, 118, 'Held',   'Case 2 · C',    null, null),
  ('R1-0006', 'Giratina V Alt Art',            'Lost Origin',       '186/196', 'Pokémon',    'CGC 9.5', 1, 260, 295, 'Held',   'Vault · 05',    null, null),
  ('R1-0007', 'Caitlin Clark Prizm RC',        '2024 Prizm WNBA',   '#22',     'Basketball', 'PSA 10',  1, 210, 240, 'Listed', 'Case 2 · A',    null, null),
  ('R1-0008', 'Shohei Ohtani Topps Chrome RC', '2018 Topps Chrome', '#150',    'Baseball',   'RAW NM',  1,  85, 110, 'Sold',   '—',             110,  '2026-11-15'),
  ('R1-0009', 'Lugia V Alt Art',               'Silver Tempest',    '186/195', 'Pokémon',    'RAW LP',  1, 150, 128, 'Sold',   '—',             128,  '2026-11-14'),
  ('R1-0010', 'Prismatic Evolutions ETB',      'Sealed',            'ETB',     'Pokémon',    'SEALED',  2, 110, 130, 'Held',   'Shelf · S1',    null, null);

select setval('public.card_seq', 10);

insert into public.card_events (card_id, event, occurred_on, note) values
  ('R1-0001', 'ACQUIRED',  '2026-11-14', 'Gold Coast Card Show — trade-in'),
  ('R1-0001', 'LISTED',    '2026-11-18', 'Instagram @_routeonetcg'),
  ('R1-0002', 'ACQUIRED',  '2026-10-30', 'Private collection buy'),
  ('R1-0002', 'INSPECTED', '2026-11-02', 'Centering 55/45 — grade candidate'),
  ('R1-0003', 'ACQUIRED',  '2026-10-12', 'eBay lot'),
  ('R1-0003', 'LISTED',    '2026-11-14', 'Gold Coast Card Show table'),
  ('R1-0004', 'PULLED',    '2026-11-06', 'Booster box break'),
  ('R1-0005', 'ACQUIRED',  '2026-09-28', 'Local vendor'),
  ('R1-0005', 'FLAGGED',   '2026-11-20', 'Below cost — hold for Dec 12'),
  ('R1-0006', 'ACQUIRED',  '2026-10-04', 'Facebook Marketplace'),
  ('R1-0006', 'GRADED',    '2026-11-10', 'CGC returned 9.5'),
  ('R1-0007', 'ACQUIRED',  '2026-11-15', 'Gold Coast Card Show — cash'),
  ('R1-0007', 'LISTED',    '2026-11-21', 'Instagram @_routeonetcg'),
  ('R1-0008', 'ACQUIRED',  '2026-08-22', 'Card shop buy'),
  ('R1-0008', 'SOLD',      '2026-11-15', 'Gold Coast Card Show — cash'),
  ('R1-0009', 'ACQUIRED',  '2026-09-09', 'Trade'),
  ('R1-0009', 'SOLD',      '2026-11-14', 'Gold Coast Card Show — trade'),
  ('R1-0010', 'ACQUIRED',  '2026-11-01', 'Retail allocation');
