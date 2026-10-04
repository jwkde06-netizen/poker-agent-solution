alter table public.players
add column if not exists korean_name text;

create index if not exists idx_players_korean_name
on public.players(korean_name);
