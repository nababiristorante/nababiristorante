-- Allow Super Admin to opt individual staff into a maximum of two shifts per Rome-local work day.
-- Existing staff remain single-shift by default; existing attendance rows/events are untouched.
alter table public.staff
  add column if not exists allow_two_shifts boolean not null default false;
