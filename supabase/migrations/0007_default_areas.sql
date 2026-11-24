-- Organiday: quem se cadastra começa só com Trabalho e Pessoal
-- (antes vinham também Casa e Projetos). Não mexe nas áreas de quem já tem conta.
-- Rode no Supabase em: SQL Editor → New query → cole este arquivo → Run

create or replace function public.handle_new_user() returns trigger
language plpgsql
security definer set search_path = ''
as $$
begin
  insert into public.areas (user_id, name, color, kind, position) values
    (new.id, 'Trabalho', '#4F6FA8', 'work', 0),
    (new.id, 'Pessoal',  '#C8577A', 'life', 1);

  insert into public.user_settings (user_id, display_name)
  values (new.id, nullif(split_part(coalesce(new.raw_user_meta_data ->> 'full_name', ''), ' ', 1), ''));

  return new;
end;
$$;
