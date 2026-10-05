-- Preserve already-settled historical expense rows from the Google Sheet
-- so the ledger can show both pending and processed items.
insert into public.expense_items(
  expense_date,category,description,amount,processed_amount,status,source_ref,prepaid_by,note
)
select * from (values
  ('2026-09-16'::date,'INCIDENT','레이 사고비(희진형님)',8000000::numeric,8000000::numeric,'processed','다낭 지출 내역서/지출 내역서3',null,'기존 정산금으로 처리 완료'),
  ('2026-09-16'::date,'HOUSING','모나치 관리비(8월분)',2411000::numeric,2411000::numeric,'processed','다낭 지출 내역서/지출 내역서3',null,'기존 정산금으로 처리 완료'),
  ('2026-09-16'::date,'ENTERTAINMENT','일본팀 접대비',10000000::numeric,10000000::numeric,'processed','다낭 지출 내역서/지출 내역서3',null,'기존 정산금으로 처리 완료'),
  ('2026-09-17'::date,'ENTERTAINMENT','일본팀 접대비 (식대)',3600000::numeric,3600000::numeric,'processed','다낭 지출 내역서/지출 내역서3',null,'기존 정산금으로 처리 완료')
) as seed(expense_date,category,description,amount,processed_amount,status,source_ref,prepaid_by,note)
where not exists (
  select 1 from public.expense_items e
  where e.source_ref='다낭 지출 내역서/지출 내역서3'
    and e.expense_date=seed.expense_date
    and e.description=seed.description
    and e.amount=seed.amount
);
