-- Tidy: notas do dia (tela "Dia")
-- Rode no Supabase em: SQL Editor → New query → cole este arquivo → Run

create table public.day_notes (
  user_id     uuid not null default auth.uid() references auth.users (id) on delete cascade,
  day         date not null,
  content     jsonb not null, -- documento do editor (Tiptap/ProseMirror JSON)
  updated_at  timestamptz not null default now(),
  primary key (user_id, day)
);

create trigger day_notes_touch_updated_at before update on public.day_notes
  for each row execute function public.touch_updated_at();

alter table public.day_notes enable row level security;

create policy "day_notes: dono acessa" on public.day_notes for all
  using (user_id = (select auth.uid())) with check (user_id = (select auth.uid()));

grant select, insert, update, delete on table public.day_notes to authenticated;
