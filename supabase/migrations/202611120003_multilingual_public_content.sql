-- Optional IT / EN / BN content fields for public-facing database content.
-- Existing base values remain valid fallbacks, so this migration is non-breaking.

alter table public.categories
  add column if not exists name_it text,
  add column if not exists name_en text,
  add column if not exists name_bn text;

alter table public.menu_items
  add column if not exists name_it text,
  add column if not exists name_en text,
  add column if not exists name_bn text,
  add column if not exists description_it text,
  add column if not exists description_en text,
  add column if not exists description_bn text;

alter table public.events
  add column if not exists title_it text,
  add column if not exists title_en text,
  add column if not exists title_bn text,
  add column if not exists description_it text,
  add column if not exists description_en text,
  add column if not exists description_bn text;

alter table public.breaking_news
  add column if not exists title_it text,
  add column if not exists title_en text,
  add column if not exists title_bn text,
  add column if not exists body_it text,
  add column if not exists body_en text,
  add column if not exists body_bn text;

-- About Editor already stores arbitrary setting_key / setting_value pairs.
-- Use about_title_it/en/bn and about_text_it/en/bn keys for localized About content.

insert into public.site_settings (setting_key, setting_value)
values
  ('about_title_it', ''),
  ('about_title_en', ''),
  ('about_title_bn', ''),
  ('about_text_it', ''),
  ('about_text_en', ''),
  ('about_text_bn', '')
on conflict (setting_key) do nothing;
