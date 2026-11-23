# Organiday

Painel pessoal para organizar trabalho, casa, estudos e o dia a dia. Funciona no navegador e pode ser instalado no celular como app (PWA).

**Stack:** Vite + React + TypeScript, Tailwind v4, TanStack Query, Supabase (Postgres + Auth), vite-plugin-pwa.

## O que tem

- **Hoje:** saudação, seu expediente (tempo livre até o fim do expediente, linha do tempo com reuniões e almoço, e se as tarefas de trabalho cabem), agenda de reuniões, pra decidir, fica de olho, aprendendo (estudos em andamento), prioridades de hoje e no radar.
- **Pra daily:** resumo pronto do que você concluiu nas áreas de trabalho e do plano do próximo dia, com impedimentos (decisões de trabalho em aberto). Durante o expediente mostra o último dia útil + hoje; depois do expediente e no fim de semana, o dia que passou + o próximo dia útil. O texto é editável (a edição fica salva no aparelho) e tem botão de copiar. Lógica em `src/lib/daily/buildDailySummary.ts`.
- **Tarefas:** tudo agrupado em atrasadas, hoje, próximas e sem data, ordenado pela priorização automática. Dá pra filtrar por área e por tipo (tarefas, decisões, reuniões). O alfinete fixa uma tarefa nas prioridades de hoje.
- **Inbox:** o que entrou sem área. Um toque na bolinha colorida move o item pra área certa.
- **Estudos:** cursos e livros com progresso (+1 aula), prazo e ritmo necessário por semana.
- **Ajustes:** seu nome, horário de expediente e almoço, as áreas (cor, nome, se é trabalho), calendários conectados e tema claro/escuro.
- **Calendários (.ics):** conecte Google Agenda, Outlook ou iCloud pelo link secreto .ics. As reuniões aparecem no Hoje e na Semana e entram na conta do tempo livre. Só leitura.

### Adicionar rápido

Digite no campo do topo (atalho: `/`) e veja o que foi entendido antes de salvar.

| Escreva                                 | Vira                                     |
| --------------------------------------- | ---------------------------------------- |
| `#casa`                                 | área (o começo do nome basta: `#tra`)    |
| `!` `!!` `!baixa`                       | prioridade alta, urgente, baixa          |
| `hoje` `amanhã` `sexta` `dia 25` `30/11` `em 3 dias` `semana que vem` | data |
| `15h` `9h30` `às 8 da noite`            | horário                                  |
| `todo dia` `dias úteis` `toda segunda` `todo dia 10` | repetição                   |
| `~30m` `~1h`                            | duração estimada                         |
| frase terminando com `?`                | decisão                                  |
| `reunião`/`call`/`daily`/`1:1` + horário | reunião                                 |

Exemplos: `daily dias úteis 9h30 ~15m #trab`, `pagar condomínio todo dia 10 #casa`, `Qual curso fazer em dezembro?`.

## Calendários conectados

- O link .ics fica na tabela `calendar_feeds` (RLS: só o dono lê). Migration: `supabase/migrations/0005_calendar_feeds.sql`.
- O navegador não consegue baixar .ics de outro domínio (CORS), então quem baixa é a função `api/calendar-events.ts` da Vercel, com o token do usuário. No `npm run dev`, o Vite serve a mesma rota (plugin em `vite.config.ts`).
- A lógica fica em `server/calendarEvents.ts` (autenticação, download com limite de tamanho e timeout, bloqueio de endereços internos) e `src/lib/calendar/expandIcs.ts` (lê o .ics, expande recorrências e exceções e converte pro fuso do usuário, com testes).
- Usa as mesmas variáveis `VITE_SUPABASE_URL` e `VITE_SUPABASE_PUBLISHABLE_KEY`, que já estão na Vercel.

