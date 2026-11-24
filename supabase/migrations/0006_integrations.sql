-- Organiday: Jira, Trello e Asana (só leitura)
-- O token de cada conta fica criptografado pelo servidor (ORGANIDAY_SECRET_KEY) antes de chegar
-- aqui; o RLS garante que cada usuário só enxerga as próprias integrações.
-- tasks.external_ref marca o que já foi puxado, pra não aparecer de novo.
-- Rode no Supabase em: SQL Editor → New query → cole este arquivo → Run

create table public.integrations (
  id           uuid primary key default gen_random_uuid(),
  user_id      uuid not null default auth.uid() references auth.users (id) on delete cascade,
  provider     text not null check (provider in ('jira', 'trello', 'asana')),
  account      text not null check (char_length(account) between 1 and 120), -- "Renata · empresa.atlassian.net"
  credentials  text not null check (char_length(credentials) <= 4000),      -- criptografado (v1.iv.tag.dados)
  created_at   timestamptz not null default now(),
  unique (user_id, provider)
);

alter table public.integrations enable row level security;

create policy "integrations: dono acessa" on public.integrations for all
  using (user_id = (select auth.uid())) with check (user_id = (select auth.uid()));

grant select, insert, update, delete on table public.integrations to authenticated;

-- "jira:empresa.atlassian.net:PROJ-12", "trello:<id>", "asana:<gid>"
alter table public.tasks add column external_ref text check (char_length(external_ref) <= 200);

create unique index tasks_user_external_ref_idx on public.tasks (user_id, external_ref)
  where external_ref is not null;
