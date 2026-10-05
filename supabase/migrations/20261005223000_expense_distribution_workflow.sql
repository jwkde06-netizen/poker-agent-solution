-- Expense queue -> weekly profit -> shareholder distribution workflow

create table if not exists public.expense_items (
  id uuid primary key default gen_random_uuid(),
  expense_date date not null,
  category text not null default 'OTHER',
  description text not null,
  amount numeric(14,2) not null check (amount > 0),
  processed_amount numeric(14,2) not null default 0 check (processed_amount >= 0),
  status text not null default 'pending' check (status in ('pending','partial','processed')),
  source_ref text,
  note text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  check (processed_amount <= amount)
);

create table if not exists public.shareholders (
  id uuid primary key default gen_random_uuid(),
  name text not null unique,
  ownership_rate numeric(6,3) not null check (ownership_rate >= 0 and ownership_rate <= 100),
  active boolean not null default true,
  sort_order integer not null default 0,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists public.weekly_distributions (
  id uuid primary key default gen_random_uuid(),
  week_start date not null unique,
  week_end date not null,
  operating_profit numeric(14,2) not null default 0,
  expense_applied numeric(14,2) not null default 0,
  distributable_profit numeric(14,2) not null default 0,
  status text not null default 'finalized' check (status in ('draft','finalized')),
  finalized_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists public.expense_allocations (
  id uuid primary key default gen_random_uuid(),
  expense_id uuid not null references public.expense_items(id) on delete restrict,
  weekly_distribution_id uuid not null references public.weekly_distributions(id) on delete cascade,
  amount numeric(14,2) not null check (amount > 0),
  created_at timestamptz not null default now()
);

create index if not exists idx_expense_items_date on public.expense_items(expense_date, created_at);
create index if not exists idx_expense_items_status on public.expense_items(status);
create index if not exists idx_expense_allocations_expense on public.expense_allocations(expense_id);
create index if not exists idx_expense_allocations_distribution on public.expense_allocations(weekly_distribution_id);

create table if not exists public.shareholder_payouts (
  id uuid primary key default gen_random_uuid(),
  weekly_distribution_id uuid not null references public.weekly_distributions(id) on delete cascade,
  shareholder_id uuid not null references public.shareholders(id) on delete restrict,
  shareholder_name_snapshot text not null,
  rate_snapshot numeric(6,3) not null,
  amount numeric(14,2) not null default 0,
  status text not null default 'pending' check (status in ('pending','paid')),
  paid_at timestamptz,
  created_at timestamptz not null default now(),
  unique (weekly_distribution_id, shareholder_id)
);

alter table public.expense_items enable row level security;
alter table public.shareholders enable row level security;
alter table public.weekly_distributions enable row level security;
alter table public.expense_allocations enable row level security;
alter table public.shareholder_payouts enable row level security;

do $$
declare
  t text;
begin
  foreach t in array array['expense_items','shareholders','weekly_distributions','expense_allocations','shareholder_payouts']
  loop
    execute format('drop policy if exists "admin only %I" on public.%I', t, t);
    execute format(
      'create policy "admin only %I" on public.%I for all to authenticated using (public.current_app_role()=''admin'') with check (public.current_app_role()=''admin'')',
      t, t
    );
  end loop;
end $$;

insert into public.shareholders(name,ownership_rate,sort_order)
values
  ('김지원',25,1),
  ('DANNY',25,2),
  ('JUHYUN',20,3),
  ('TOMMY',20,4),
  ('RESERVE',10,5)
on conflict (name) do nothing;

-- Opening pending expense queue imported from Google Sheet "다낭 지출 내역서" / "지출 내역서3".
-- Prior deposits are reflected FIFO. The rows below sum to the sheet's current -77,244,500 VND balance.
insert into public.expense_items(expense_date,category,description,amount,processed_amount,status,source_ref,note)
select * from (values
  ('2026-09-18'::date,'HOUSING','모나치 3개월 집세+관리비',46151000::numeric,44784000::numeric,'partial','다낭 지출 내역서/지출 내역서3','기존 정산금으로 일부 처리, 잔액 1,367,000'),
  ('2026-09-19'::date,'LODGING','형운이 형 호텔숙박비',2600000::numeric,0::numeric,'pending','다낭 지출 내역서/지출 내역서3',null),
  ('2026-09-20'::date,'LODGING','형운이 형 호텔 1박 연장',1300000::numeric,0::numeric,'pending','다낭 지출 내역서/지출 내역서3',null),
  ('2026-09-20'::date,'HOUSING','지원이 8월 숙소',10400000::numeric,0::numeric,'pending','다낭 지출 내역서/지출 내역서3',null),
  ('2026-09-20'::date,'ENTERTAINMENT','일본팀 접대비 (식대)',4000000::numeric,0::numeric,'pending','다낭 지출 내역서/지출 내역서3',null),
  ('2026-09-22'::date,'LODGING','형운이 형 호텔 1박 연장',1300000::numeric,0::numeric,'pending','다낭 지출 내역서/지출 내역서3',null),
  ('2026-09-23'::date,'LODGING','혁기형 호텔숙박비',5020000::numeric,0::numeric,'pending','다낭 지출 내역서/지출 내역서3',null),
  ('2026-09-23'::date,'SUPPLIES','비품 구매 (쓰레기통, 아크릴판, 멀티탭)',390000::numeric,0::numeric,'pending','다낭 지출 내역서/지출 내역서3',null),
  ('2026-09-24'::date,'ENTERTAINMENT','형운이형,성현이형,켄타 접대비',16270000::numeric,0::numeric,'pending','다낭 지출 내역서/지출 내역서3',null),
  ('2026-09-29'::date,'INCIDENT','주현이형 사고비',22597500::numeric,0::numeric,'pending','다낭 지출 내역서/지출 내역서3',null),
  ('2026-09-29'::date,'MEAL','9월 지원 대니 식대',12000000::numeric,0::numeric,'pending','다낭 지출 내역서/지출 내역서3',null)
) as seed(expense_date,category,description,amount,processed_amount,status,source_ref,note)
where not exists (select 1 from public.expense_items where source_ref='다낭 지출 내역서/지출 내역서3');

create or replace function public.finalize_weekly_distribution(
  p_week_start date,
  p_week_end date,
  p_operating_profit numeric
)
returns uuid
language plpgsql
security definer
set search_path=public
as $$
declare
  v_distribution_id uuid;
  v_available numeric := greatest(coalesce(p_operating_profit,0),0);
  v_applied numeric := 0;
  v_remaining numeric;
  v_take numeric;
  r record;
begin
  if public.current_app_role() <> 'admin' then
    raise exception 'admin only';
  end if;

  select id into v_distribution_id
  from public.weekly_distributions
  where week_start=p_week_start;

  if v_distribution_id is not null then
    return v_distribution_id;
  end if;

  insert into public.weekly_distributions(
    week_start,week_end,operating_profit,expense_applied,distributable_profit,status,finalized_at
  ) values (
    p_week_start,p_week_end,coalesce(p_operating_profit,0),0,greatest(coalesce(p_operating_profit,0),0),'finalized',now()
  ) returning id into v_distribution_id;

  for r in
    select *
    from public.expense_items
    where processed_amount < amount
    order by expense_date, created_at
    for update
  loop
    exit when v_available <= 0;
    v_remaining := r.amount-r.processed_amount;
    v_take := least(v_remaining,v_available);
    if v_take > 0 then
      insert into public.expense_allocations(expense_id,weekly_distribution_id,amount)
      values (r.id,v_distribution_id,v_take);
      update public.expense_items
      set processed_amount=processed_amount+v_take,
          status=case
            when processed_amount+v_take >= amount then 'processed'
            else 'partial'
          end,
          updated_at=now()
      where id=r.id;
      v_available := v_available-v_take;
      v_applied := v_applied+v_take;
    end if;
  end loop;

  update public.weekly_distributions
  set expense_applied=v_applied,
      distributable_profit=greatest(coalesce(p_operating_profit,0)-v_applied,0),
      updated_at=now()
  where id=v_distribution_id;

  insert into public.shareholder_payouts(
    weekly_distribution_id,shareholder_id,shareholder_name_snapshot,rate_snapshot,amount,status
  )
  select
    v_distribution_id,
    s.id,
    s.name,
    s.ownership_rate,
    round(greatest(coalesce(p_operating_profit,0)-v_applied,0) * s.ownership_rate / 100),
    'pending'
  from public.shareholders s
  where s.active
  order by s.sort_order,s.created_at;

  return v_distribution_id;
end;
$$;

grant execute on function public.finalize_weekly_distribution(date,date,numeric) to authenticated;
