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
