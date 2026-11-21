-- Tidy: schema inicial
-- Rode no Supabase em: SQL Editor → New query → cole este arquivo → Run

-- ─── Áreas ────────────────────────────────────────────────────────────────
create table public.areas (
  id          uuid primary key default gen_random_uuid(),
  user_id     uuid not null default auth.uid() references auth.users (id) on delete cascade,
  name        text not null check (char_length(name) between 1 and 40),
  color       text not null default '#4F6FA8' check (color ~ '^#[0-9A-Fa-f]{6}$'),
  kind        text not null default 'life' check (kind in ('work', 'life')), -- 'work' entra na conta do expediente
  position    integer not null default 0,
  created_at  timestamptz not null default now(),
  unique (id, user_id)
);

create index areas_user_position_idx on public.areas (user_id, position);

-- ─── Tarefas, decisões e reuniões ─────────────────────────────────────────
create table public.tasks (
  id                uuid primary key default gen_random_uuid(),
  user_id           uuid not null default auth.uid() references auth.users (id) on delete cascade,
  area_id           uuid,
  kind              text not null default 'task' check (kind in ('task', 'decision', 'meeting')),
  title             text not null check (char_length(title) between 1 and 300),
  notes             text,
  priority          smallint not null default 2 check (priority between 1 and 4), -- 1 baixa, 2 média, 3 alta, 4 urgente
  due_date          date,
  due_time          time,
  duration_minutes  integer check (duration_minutes > 0), -- estimativa da tarefa ou duração da reunião
  recurrence        text check (recurrence in ('daily', 'weekdays', 'weekly', 'monthly')),
  focus_date        date, -- fixada no "Foco do dia" desta data
  status            text not null default 'open' check (status in ('open', 'done')),
  completed_at      timestamptz,
  created_at        timestamptz not null default now(),
  updated_at        timestamptz not null default now(),

  -- garante que a área é do mesmo usuário; ao apagar a área, a tarefa volta pra Inbox
  foreign key (area_id, user_id) references public.areas (id, user_id) on delete set null (area_id),
  check (due_time is null or due_date is not null),
  check (recurrence is null or due_date is not null),
  check (kind <> 'meeting' or due_time is not null)
);

create index tasks_user_status_idx on public.tasks (user_id, status);
create index tasks_user_due_idx on public.tasks (user_id, due_date);

-- ─── Estudos (cursos, livros, certificações…) ─────────────────────────────
create table public.studies (
  id           uuid primary key default gen_random_uuid(),
  user_id      uuid not null default auth.uid() references auth.users (id) on delete cascade,
  title        text not null check (char_length(title) between 1 and 120),
  unit_label   text not null default 'aulas' check (char_length(unit_label) between 1 and 20),
  progress     integer not null default 0 check (progress >= 0),
  total        integer not null check (total > 0),
  target_date  date,
  status       text not null default 'active' check (status in ('active', 'paused', 'done')),
  notes        text,
  created_at   timestamptz not null default now(),
  updated_at   timestamptz not null default now(),
  check (progress <= total)
);

create index studies_user_status_idx on public.studies (user_id, status);

-- ─── Configurações do expediente ──────────────────────────────────────────
create table public.user_settings (
  user_id        uuid primary key default auth.uid() references auth.users (id) on delete cascade,
  display_name   text check (char_length(display_name) <= 40),
  workday_start  time not null default '09:00',
  workday_end    time not null default '18:00',
  lunch_start    time default '12:00',
  lunch_end      time default '13:00',
  updated_at     timestamptz not null default now(),
  check (workday_start < workday_end),
  check ((lunch_start is null) = (lunch_end is null)),
  check (lunch_start is null or lunch_start < lunch_end)
);

-- ─── updated_at automático ────────────────────────────────────────────────
create function public.touch_updated_at() returns trigger
language plpgsql as $$
begin
  new.updated_at := now();
  return new;
end;
$$;

create trigger tasks_touch_updated_at before update on public.tasks
  for each row execute function public.touch_updated_at();
create trigger studies_touch_updated_at before update on public.studies
  for each row execute function public.touch_updated_at();
create trigger user_settings_touch_updated_at before update on public.user_settings
  for each row execute function public.touch_updated_at();

-- ─── Row Level Security: cada usuário só enxerga o que é seu ──────────────
alter table public.areas enable row level security;
alter table public.tasks enable row level security;
alter table public.studies enable row level security;
alter table public.user_settings enable row level security;

create policy "areas: dono acessa" on public.areas for all
  using (user_id = (select auth.uid())) with check (user_id = (select auth.uid()));
create policy "tasks: dono acessa" on public.tasks for all
  using (user_id = (select auth.uid())) with check (user_id = (select auth.uid()));
create policy "studies: dono acessa" on public.studies for all
  using (user_id = (select auth.uid())) with check (user_id = (select auth.uid()));
create policy "settings: dono acessa" on public.user_settings for all
  using (user_id = (select auth.uid())) with check (user_id = (select auth.uid()));

-- ─── Dados iniciais para quem acabou de se cadastrar ──────────────────────
create function public.handle_new_user() returns trigger
language plpgsql
security definer set search_path = ''
as $$
begin
  insert into public.areas (user_id, name, color, kind, position) values
    (new.id, 'Trabalho', '#4F6FA8', 'work', 0),
    (new.id, 'Pessoal',  '#C8577A', 'life', 1),
    (new.id, 'Casa',     '#3D8C6E', 'life', 2),
    (new.id, 'Projetos', '#C48A1A', 'life', 3);

  insert into public.user_settings (user_id, display_name)
  values (new.id, nullif(split_part(coalesce(new.raw_user_meta_data ->> 'full_name', ''), ' ', 1), ''));

  return new;
end;
$$;

create trigger on_auth_user_created
  after insert on auth.users
  for each row execute function public.handle_new_user();

-- ─── Próxima ocorrência de uma tarefa recorrente ──────────────────────────
create function public.next_occurrence(p_from date, p_recurrence text) returns date
language plpgsql immutable as $$
declare
  next_date date := p_from;
begin
  case p_recurrence
    when 'daily'   then next_date := p_from + 1;
    when 'weekly'  then next_date := p_from + 7;
    when 'monthly' then next_date := (p_from + interval '1 month')::date;
    when 'weekdays' then
      next_date := p_from + 1;
      while extract(isodow from next_date) > 5 loop
        next_date := next_date + 1;
      end loop;
    else
      raise exception 'recorrência desconhecida: %', p_recurrence;
  end case;
  return next_date;
end;
$$;

-- ─── Concluir (e gerar a próxima, se for recorrente) ──────────────────────
-- p_today vem do app, para respeitar o fuso horário do aparelho.
create function public.complete_task(p_task_id uuid, p_today date) returns void
language plpgsql
security invoker set search_path = ''
as $$
declare
  done_task public.tasks;
  next_due  date;
begin
  update public.tasks
     set status = 'done', completed_at = now()
   where id = p_task_id and status = 'open'
  returning * into done_task;

  if done_task.id is null or done_task.recurrence is null then
    return;
  end if;

  next_due := public.next_occurrence(done_task.due_date, done_task.recurrence);
  while next_due <= p_today loop
    next_due := public.next_occurrence(next_due, done_task.recurrence);
  end loop;

  insert into public.tasks
    (user_id, area_id, kind, title, notes, priority, due_date, due_time, duration_minutes, recurrence)
  values
    (done_task.user_id, done_task.area_id, done_task.kind, done_task.title, done_task.notes, done_task.priority,
     next_due, done_task.due_time, done_task.duration_minutes, done_task.recurrence);
end;
$$;

grant execute on function public.complete_task(uuid, date) to authenticated;
