-- Deposit ledger: weekly settlement money increases the expense-ledger balance.
create table if not exists public.expense_deposits (
  id uuid primary key default gen_random_uuid(),
  deposited_on date not null,
  description text not null default '주간 정산금',
  amount numeric(14,2) not null check (amount > 0),
  weekly_distribution_id uuid unique references public.weekly_distributions(id) on delete set null,
  source_ref text,
  note text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index if not exists idx_expense_deposits_date
  on public.expense_deposits(deposited_on, created_at);

alter table public.expense_deposits enable row level security;

drop policy if exists "admin only expense_deposits" on public.expense_deposits;
create policy "admin only expense_deposits"
on public.expense_deposits for all to authenticated
using (public.current_app_role()='admin')
with check (public.current_app_role()='admin');

-- Historical deposits from Google Sheet "다낭 지출 내역서 / 지출 내역서3".
insert into public.expense_deposits(deposited_on,description,amount,source_ref,note)
select * from (values
  ('2026-09-16'::date,'9/7~13 드림타임어택 정산금',23600000::numeric,'다낭 지출 내역서/지출 내역서3','기존 Google Sheet DEPOSIT'),
  ('2026-09-29'::date,'9/21~27 정산금',45195000::numeric,'다낭 지출 내역서/지출 내역서3','기존 Google Sheet DEPOSIT')
) as seed(deposited_on,description,amount,source_ref,note)
where not exists (
  select 1
  from public.expense_deposits d
  where d.source_ref='다낭 지출 내역서/지출 내역서3'
    and d.deposited_on=seed.deposited_on
    and d.amount=seed.amount
);

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

  -- The week's settlement money is recorded as a DEPOSIT in the expense ledger.
  if v_available > 0 then
    insert into public.expense_deposits(
      deposited_on,description,amount,weekly_distribution_id,source_ref,note
    ) values (
      p_week_end,
      to_char(p_week_start,'MM/DD') || '~' || to_char(p_week_end,'MM/DD') || ' 주간 정산금',
      v_available,
      v_distribution_id,
      'Dream Poker 주간 정산',
      '주간 정산 확정 시 자동 등록'
    );
  end if;

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
