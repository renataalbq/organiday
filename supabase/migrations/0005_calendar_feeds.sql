-- Organiday: calendários conectados por link .ics (Google Agenda, Outlook…)
-- O link é secreto (quem tem o link vê a agenda), então fica protegido por RLS:
-- só o dono lê. Quem baixa o .ics é a função /api/calendar-events, com o token do usuário.
-- Rode no Supabase em: SQL Editor → New query → cole este arquivo → Run

create table public.calendar_feeds (
  id          uuid primary key default gen_random_uuid(),
  user_id     uuid not null default auth.uid() references auth.users (id) on delete cascade,
  name        text not null check (char_length(name) between 1 and 60),
  url         text not null check (char_length(url) <= 2000 and url ~* '^(https|webcal)://'),
  color       text not null default '#5B4CDB' check (color ~ '^#[0-9A-Fa-f]{6}$'),
  -- área em que as reuniões desse calendário entram (ex.: Trabalho conta no expediente)
  area_id     uuid references public.areas (id) on delete set null,
  created_at  timestamptz not null default now()
);

create index calendar_feeds_user_idx on public.calendar_feeds (user_id);

alter table public.calendar_feeds enable row level security;

create policy "calendar_feeds: dono acessa" on public.calendar_feeds for all
  using (user_id = (select auth.uid())) with check (user_id = (select auth.uid()));

grant select, insert, update, delete on table public.calendar_feeds to authenticated;
