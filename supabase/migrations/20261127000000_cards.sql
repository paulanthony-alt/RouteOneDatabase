-- Route One TCG — inventory ledger schema
-- cards        : one row per inventory record (was DATA in the prototype)
-- card_events  : chain of custody (was DATA[].log)

create sequence if not exists public.card_seq;

create table public.cards (
  id          text primary key default 'R1-' || lpad(nextval('public.card_seq')::text, 4, '0'),
  name        text          not null check (length(btrim(name)) > 0),
  set_name    text          not null default '',
  card_no     text          not null default '',
  game        text          not null default 'Pokémon',
  grade       text          not null default 'RAW NM',
  qty         integer       not null default 1 check (qty > 0),
  cost        numeric(12,2) not null default 0 check (cost >= 0),     -- per unit
  market      numeric(12,2) not null default 0 check (market >= 0),   -- per unit
  status      text          not null default 'Held' check (status in ('Held', 'Listed', 'Sold')),
  location    text          not null default '',
  sold_price  numeric(12,2) check (sold_price >= 0),                  -- per unit
  sold_on     date,
  created_at  timestamptz   not null default now(),
  updated_at  timestamptz   not null default now(),
  constraint cards_sold_fields check (
    (status = 'Sold') = (sold_price is not null and sold_on is not null)
  )
);

alter sequence public.card_seq owned by public.cards.id;

create index cards_status_idx on public.cards (status);

create table public.card_events (
  id          bigint generated always as identity primary key,
  card_id     text        not null references public.cards (id) on delete cascade,
  event       text        not null check (length(btrim(event)) > 0),
  occurred_on date        not null default current_date,
  note        text        not null default '',
  created_at  timestamptz not null default now()
);

create index card_events_card_idx on public.card_events (card_id, occurred_on, id);

-- keep updated_at fresh
create or replace function public.touch_updated_at() returns trigger
language plpgsql as $$
begin
  new.updated_at := now();
  return new;
end $$;

create trigger cards_touch before update on public.cards
for each row execute function public.touch_updated_at();

-- ---------------------------------------------------------------------------
-- Row level security: the ledger is private to signed-in staff.
-- Turn OFF public sign-ups in Supabase Auth and invite staff accounts instead.
-- ---------------------------------------------------------------------------
alter table public.cards       enable row level security;
alter table public.card_events enable row level security;

create policy "staff read cards"   on public.cards for select to authenticated using (true);
create policy "staff insert cards" on public.cards for insert to authenticated with check (true);
create policy "staff update cards" on public.cards for update to authenticated using (true) with check (true);
create policy "staff delete cards" on public.cards for delete to authenticated using (true);

create policy "staff read events"   on public.card_events for select to authenticated using (true);
create policy "staff insert events" on public.card_events for insert to authenticated with check (true);

revoke all on public.cards, public.card_events from anon;

-- ---------------------------------------------------------------------------
-- RPCs — each mutation and its custody entry commit together.
-- security invoker, so the RLS policies above still apply.
-- ---------------------------------------------------------------------------

-- NEW ENTRY
create or replace function public.create_card(
  p_name text, p_set_name text, p_card_no text, p_game text, p_grade text,
  p_qty integer, p_cost numeric, p_market numeric, p_status text, p_location text,
  p_event text default 'ACQUIRED', p_event_on date default current_date, p_note text default ''
) returns public.cards
language plpgsql security invoker set search_path = public as $$
declare
  c public.cards;
begin
  if p_status not in ('Held', 'Listed') then
    raise exception 'New entries must be Held or Listed (use mark_card_sold to sell)';
  end if;

  insert into public.cards (name, set_name, card_no, game, grade, qty, cost, market, status, location)
  values (btrim(p_name), coalesce(p_set_name, ''), coalesce(p_card_no, ''), coalesce(p_game, ''),
          coalesce(p_grade, ''), p_qty, p_cost, p_market, p_status, coalesce(p_location, ''))
  returning * into c;

  insert into public.card_events (card_id, event, occurred_on, note)
  values (c.id, upper(coalesce(nullif(btrim(p_event), ''), 'ACQUIRED')), coalesce(p_event_on, current_date), coalesce(p_note, ''));

  if p_status = 'Listed' then
    insert into public.card_events (card_id, event, occurred_on, note)
    values (c.id, 'LISTED', coalesce(p_event_on, current_date), '');
  end if;

  return c;
end $$;

-- EDIT RECORD
-- Status may move between Held and Listed here; a status change is logged.
-- For sold records, sale price/date can be corrected via p_sold_price/p_sold_on.
create or replace function public.update_card(
  p_id text, p_name text, p_set_name text, p_card_no text, p_game text, p_grade text,
  p_qty integer, p_cost numeric, p_market numeric, p_status text, p_location text,
  p_sold_price numeric default null, p_sold_on date default null
) returns public.cards
language plpgsql security invoker set search_path = public as $$
declare
  old public.cards;
  c   public.cards;
begin
  select * into old from public.cards where id = p_id for update;
  if not found then
    raise exception 'Card % not found', p_id;
  end if;

  if old.status = 'Sold' and p_status <> 'Sold' then
    raise exception 'Sold records cannot be moved back to %', p_status;
  elsif old.status <> 'Sold' and p_status = 'Sold' then
    raise exception 'Use mark_card_sold to sell a record';
  end if;

  update public.cards set
    name = btrim(p_name), set_name = coalesce(p_set_name, ''), card_no = coalesce(p_card_no, ''),
    game = coalesce(p_game, ''), grade = coalesce(p_grade, ''), qty = p_qty,
    cost = p_cost, market = p_market, status = p_status, location = coalesce(p_location, ''),
    sold_price = case when old.status = 'Sold' then coalesce(p_sold_price, old.sold_price) end,
    sold_on    = case when old.status = 'Sold' then coalesce(p_sold_on, old.sold_on) end
  where id = p_id
  returning * into c;

  if old.status <> c.status then
    insert into public.card_events (card_id, event, note)
    values (c.id, case c.status when 'Listed' then 'LISTED' else 'UNLISTED' end, '');
  end if;

  return c;
end $$;

-- MARK SOLD
-- Selling fewer units than the record holds splits it: the original keeps the
-- remainder and a new Sold record (with a copy of the custody log) takes the rest.
-- Returns the Sold record.
create or replace function public.mark_card_sold(
  p_id text, p_qty integer, p_price numeric, p_sold_on date default current_date, p_note text default ''
) returns public.cards
language plpgsql security invoker set search_path = public as $$
declare
  src  public.cards;
  sold public.cards;
begin
  select * into src from public.cards where id = p_id for update;
  if not found then
    raise exception 'Card % not found', p_id;
  end if;
  if src.status = 'Sold' then
    raise exception 'Card % is already sold', p_id;
  end if;
  if p_qty is null or p_qty < 1 or p_qty > src.qty then
    raise exception 'Quantity must be between 1 and %', src.qty;
  end if;
  if p_price is null or p_price < 0 then
    raise exception 'Sale price must be zero or more';
  end if;

  if p_qty = src.qty then
    update public.cards
       set status = 'Sold', sold_price = p_price, sold_on = coalesce(p_sold_on, current_date), location = '—'
     where id = p_id
    returning * into sold;
  else
    update public.cards set qty = qty - p_qty where id = p_id;

    insert into public.cards (name, set_name, card_no, game, grade, qty, cost, market,
                              status, location, sold_price, sold_on)
    values (src.name, src.set_name, src.card_no, src.game, src.grade, p_qty, src.cost, src.market,
            'Sold', '—', p_price, coalesce(p_sold_on, current_date))
    returning * into sold;

    insert into public.card_events (card_id, event, occurred_on, note)
    select sold.id, e.event, e.occurred_on, e.note
      from public.card_events e
     where e.card_id = src.id
     order by e.occurred_on, e.id;

    insert into public.card_events (card_id, event, occurred_on, note)
    values (sold.id, 'SPLIT', coalesce(p_sold_on, current_date), format('%s of %s units from %s', p_qty, src.qty, src.id)),
           (src.id, 'SPLIT', coalesce(p_sold_on, current_date), format('%s sold → %s', p_qty, sold.id));
  end if;

  insert into public.card_events (card_id, event, occurred_on, note)
  values (sold.id, 'SOLD', coalesce(p_sold_on, current_date), coalesce(p_note, ''));

  return sold;
end $$;

revoke execute on function public.create_card, public.update_card, public.mark_card_sold from public, anon;
grant  execute on function public.create_card, public.update_card, public.mark_card_sold to authenticated;
