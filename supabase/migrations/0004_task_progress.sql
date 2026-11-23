-- Organiday: tarefa em andamento e impedimentos
-- started_at: quando você começou a tarefa pelo foco (vira "Fazendo" no resumo)
-- blocked_reason: motivo de a tarefa estar travada (vira "Impedimentos" no resumo)
-- Rode no Supabase em: SQL Editor → New query → cole este arquivo → Run

alter table public.tasks
  add column started_at timestamptz,
  add column blocked_reason text check (blocked_reason is null or char_length(blocked_reason) between 1 and 300);
