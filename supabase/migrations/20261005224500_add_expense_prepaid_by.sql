-- Track who advanced each expense before reimbursement.
alter table public.expense_items
  add column if not exists prepaid_by text;

comment on column public.expense_items.prepaid_by is
  'Person who paid the expense in advance and is waiting to be reimbursed.';
