-- Tidy: permissões das tabelas para usuários logados
-- Projetos Supabase novos não expõem as tabelas do schema public à API
-- automaticamente. Sem estes grants o app recebe
-- "permission denied for table ...". O RLS da 0001 continua valendo:
-- cada usuário só enxerga as próprias linhas.
-- Rode no Supabase em: SQL Editor → New query → cole este arquivo → Run

grant usage on schema public to authenticated;

grant select, insert, update, delete on table
  public.areas,
  public.tasks,
  public.studies,
  public.user_settings
to authenticated;

grant execute on function public.next_occurrence(date, text) to authenticated;
