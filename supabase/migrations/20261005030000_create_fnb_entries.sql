create table if not exists public.fnb_entries (
  id uuid primary key default gen_random_uuid(),
  spent_on date not null default current_date,
  item_name text not null,
  quantity integer not null default 1 check (quantity > 0),
  unit_price bigint not null default 0 check (unit_price >= 0),
  total_amount bigint generated always as (quantity * unit_price) stored,
  expense_group text not null default '2FLOOR',
  note text,
  created_by uuid default auth.uid(),
  created_at timestamptz not null default now()
);

create index if not exists idx_fnb_entries_spent_on
  on public.fnb_entries(spent_on desc);

create index if not exists idx_fnb_entries_created_at
  on public.fnb_entries(created_at desc);

alter table public.fnb_entries enable row level security;

drop policy if exists "Authenticated users can read FNB" on public.fnb_entries;
create policy "Authenticated users can read FNB"
  on public.fnb_entries for select
  to authenticated
  using (true);

drop policy if exists "Authenticated users can insert FNB" on public.fnb_entries;
create policy "Authenticated users can insert FNB"
  on public.fnb_entries for insert
  to authenticated
  with check (true);

drop policy if exists "Authenticated users can update FNB" on public.fnb_entries;
create policy "Authenticated users can update FNB"
  on public.fnb_entries for update
  to authenticated
  using (true)
  with check (true);

drop policy if exists "Authenticated users can delete FNB" on public.fnb_entries;
create policy "Authenticated users can delete FNB"
  on public.fnb_entries for delete
  to authenticated
  using (true);
