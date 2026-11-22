-- Editable birthday and event certificate copy, stored centrally for admin editing and public verification.
alter table public.nababi_certificate_settings
  add column if not exists certificate_content jsonb not null default
  '{
    "birthday_texts":["Per celebrare il tuo giorno speciale, con i più sinceri auguri di felicità, gioia e momenti indimenticabili."],
    "birthday_quote":"Che ogni nuovo anno porti con sé nuove gioie, sogni e splendide opportunità.",
    "event_texts":["In riconoscimento del prezioso contributo e dell’impegno dimostrato nell’organizzazione dell’evento, contribuendo a renderlo speciale e memorabile."],
    "event_quote":"I grandi momenti nascono dalla passione, dalla collaborazione e dalla dedizione."
  }'::jsonb;

drop function if exists public.nababi_verify_certificate(text);
create function public.nababi_verify_certificate(p_code text)
returns table (
  certificate_code text,
  certificate_type text,
  recipient_name text,
  event_name text,
  issue_date date,
  dedication text,
  photo_url text,
  show_photo_publicly boolean,
  signer_name text,
  signer_role text,
  signature_url text,
  logo_url text,
  certificate_content jsonb,
  verification_status text
)
language sql
stable
security definer
set search_path = ''
as $$
  select
    c.certificate_code,
    c.certificate_type,
    case when c.status = 'active' then c.recipient_name else null end,
    case when c.status = 'active' then c.event_name else null end,
    case when c.status = 'active' then c.issue_date else null end,
    case when c.status = 'active' then c.dedication else null end,
    case when c.status = 'active' and c.show_photo_publicly then c.photo_url else null end,
    (c.status = 'active' and c.show_photo_publicly),
    case when c.status = 'active' then c.signer_name else null end,
    case when c.status = 'active' then c.signer_role else null end,
    case when c.status = 'active' then c.signature_url else null end,
    case when c.status = 'active' then s.logo_url else null end,
    case when c.status = 'active' then s.certificate_content else null end,
    c.status
  from public.nababi_certificates c
  left join public.nababi_certificate_settings s on s.id = true
  where upper(trim(c.certificate_code)) = upper(trim(p_code))
  limit 1;
$$;

revoke all on function public.nababi_verify_certificate(text) from public;
grant execute on function public.nababi_verify_certificate(text) to anon, authenticated;
