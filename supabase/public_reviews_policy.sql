-- Allow website visitors to submit reviews for admin moderation.
-- New public submissions are ALWAYS pending; only an admin can approve them.
grant insert on table public.reviews to anon;

drop policy if exists "Public can submit pending reviews" on public.reviews;
create policy "Public can submit pending reviews"
on public.reviews
for insert
to anon
with check (
  is_approved = false
  and char_length(trim(customer_name)) between 2 and 120
  and rating between 1 and 5
  and char_length(trim(review_text)) between 5 and 3000
);
