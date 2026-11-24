-- Organiday: lembretes por notificação (web push)
-- • push_subscriptions: cada aparelho que ativou os lembretes (RLS: só o dono)
-- • user_settings.reminder_minutes: quanto tempo antes avisar (null = não avisar tarefas com horário)
-- • user_settings.remind_date_only: avisar no começo do expediente as tarefas que vencem no dia, sem horário
-- • user_settings.time_zone: fuso do aparelho, pra saber quando é "15h" pra essa pessoa
-- • tasks.reminded_at: já avisou (zera sozinho quando a data ou a hora mudam)
-- • claim_due_reminders(): o que precisa ser avisado agora; só o servidor (service_role) chama
-- Rode no Supabase em: SQL Editor → New query → cole este arquivo → Run.
-- Depois siga "Agendar o envio" no fim deste arquivo.

create table public.push_subscriptions (
  id          uuid primary key default gen_random_uuid(),
  user_id     uuid not null default auth.uid() references auth.users (id) on delete cascade,
  endpoint    text not null unique check (char_length(endpoint) <= 1000 and endpoint ~* '^https://'),
  p256dh      text not null check (char_length(p256dh) <= 200),
  auth        text not null check (char_length(auth) <= 100),
  device      text check (char_length(device) <= 120),
  created_at  timestamptz not null default now()
);

create index push_subscriptions_user_idx on public.push_subscriptions (user_id);

alter table public.push_subscriptions enable row level security;

create policy "push_subscriptions: dono acessa" on public.push_subscriptions for all
  using (user_id = (select auth.uid())) with check (user_id = (select auth.uid()));

grant select, insert, update, delete on table public.push_subscriptions to authenticated;

alter table public.user_settings
  add column reminder_minutes  integer default 15 check (reminder_minutes between 0 and 1440),
  add column remind_date_only  boolean not null default true,
  add column time_zone         text not null default 'America/Sao_Paulo' check (char_length(time_zone) <= 64);

alter table public.tasks add column reminded_at timestamptz;

-- mudou a data ou a hora: pode avisar de novo
create function public.reset_task_reminder() returns trigger
language plpgsql as $$
begin
  if new.due_date is distinct from old.due_date or new.due_time is distinct from old.due_time then
    new.reminded_at := null;
  end if;
  return new;
end;
$$;

create trigger tasks_reset_reminder before update on public.tasks
  for each row execute function public.reset_task_reminder();

-- Lembretes que venceram agora (até 30 min de atraso; mais que isso, perdeu a graça).
-- Marca reminded_at na mesma transação, então duas execuções seguidas não avisam duas vezes.
create function public.claim_due_reminders()
returns table (
  task_id    uuid,
  user_id    uuid,
  title      text,
  due_date   date,
  due_time   time,
  kind       text,
  -- quantos minutos antes do horário (null = tarefa sem horário, aviso do dia)
  minutes_before integer
)
language sql
security definer set search_path = ''
as $$
  with due as (
    select
      t.id,
      case
        when t.due_time is not null and s.reminder_minutes is not null then
          ((t.due_date + t.due_time) at time zone s.time_zone) - make_interval(mins => s.reminder_minutes)
        when t.due_time is null and s.remind_date_only then
          (t.due_date + s.workday_start) at time zone s.time_zone
      end as remind_at,
      case when t.due_time is not null then s.reminder_minutes end as minutes_before
    from public.tasks t
    join public.user_settings s on s.user_id = t.user_id
    -- fuso inválido não pode derrubar os lembretes de todo mundo
    join pg_catalog.pg_timezone_names z on z.name = s.time_zone
    where t.status = 'open'
      and t.reminded_at is null
      and t.due_date between current_date - 1 and current_date + 2
      and exists (select 1 from public.push_subscriptions p where p.user_id = t.user_id)
  ),
  claimed as (
    update public.tasks t
       set reminded_at = now()
      from due
     where t.id = due.id
       and due.remind_at <= now()
       and due.remind_at > now() - interval '30 minutes'
    returning t.id, t.user_id, t.title, t.due_date, t.due_time, t.kind, due.minutes_before
  )
  select * from claimed;
$$;

revoke all on function public.claim_due_reminders() from public, anon, authenticated;
grant execute on function public.claim_due_reminders() to service_role;

-- ─── Agendar o envio (rode depois, uma vez) ───────────────────────────────
-- 1. Database → Extensions: ligue pg_cron e pg_net.
-- 2. Guarde o mesmo valor do CRON_SECRET da Vercel no cofre do Supabase:
--      select vault.create_secret('<o CRON_SECRET>', 'organiday_cron_secret');
-- 3. Agende a chamada a cada 5 minutos:
--      select cron.schedule('organiday-lembretes', '*/5 * * * *', $job$
--        select net.http_post(
--          url := 'https://organiday.vercel.app/api/send-reminders',
--          headers := jsonb_build_object(
--            'content-type', 'application/json',
--            'authorization', 'Bearer ' || (select decrypted_secret from vault.decrypted_secrets where name = 'organiday_cron_secret')
--          ),
--          body := '{}'::jsonb
--        );
--      $job$);
