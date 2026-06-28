-- Projected sales for a schedule period — used to calculate labor %.
alter table schedules add column if not exists sales_target numeric(10,2) check (sales_target > 0);
