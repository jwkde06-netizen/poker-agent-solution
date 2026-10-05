-- Link every reimbursement allocation to the deposit that funded it.
alter table public.expense_allocations
  alter column weekly_distribution_id drop not null;

alter table public.expense_allocations
  add column if not exists deposit_id uuid references public.expense_deposits(id) on delete set null;

create index if not exists idx_expense_allocations_deposit
  on public.expense_allocations(deposit_id);

create or replace function public.record_expense_deposit(
  p_deposited_on date,
  p_description text,
  p_amount numeric,
  p_note text default null,
  p_source_ref text default 'Dream Poker Solution'
)
returns uuid
language plpgsql
security definer
set search_path=public
as $$
declare
  v_deposit_id uuid;
  v_available numeric := greatest(coalesce(p_amount,0),0);
  v_remaining numeric;
  v_take numeric;
  r record;
begin
  if public.current_app_role() <> 'admin' then
    raise exception 'admin only';
  end if;
  if v_available <= 0 then
    raise exception 'deposit amount must be positive';
  end if;

  insert into public.expense_deposits(
    deposited_on,description,amount,source_ref,note
  ) values (
    p_deposited_on,
    coalesce(nullif(trim(p_description),''),'주간 정산금'),
    v_available,
    p_source_ref,
    nullif(trim(coalesce(p_note,'')),'')
  ) returning id into v_deposit_id;

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
      insert into public.expense_allocations(expense_id,deposit_id,amount)
      values (r.id,v_deposit_id,v_take);

      update public.expense_items
      set processed_amount=processed_amount+v_take,
          status=case
            when processed_amount+v_take >= amount then 'processed'
            else 'partial'
          end,
          updated_at=now()
      where id=r.id;

      v_available := v_available-v_take;
    end if;
  end loop;

  return v_deposit_id;
end;
$$;

grant execute on function public.record_expense_deposit(date,text,numeric,text,text) to authenticated;

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
  v_deposit_id uuid;
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
    ) returning id into v_deposit_id;
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
      insert into public.expense_allocations(expense_id,weekly_distribution_id,deposit_id,amount)
      values (r.id,v_distribution_id,v_deposit_id,v_take);

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
