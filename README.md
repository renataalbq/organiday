# Tidy

Painel pessoal para organizar trabalho, casa, estudos e o dia a dia. Funciona no navegador e pode ser instalado no celular como app (PWA).

**Stack:** Vite + React + TypeScript, Tailwind v4, TanStack Query, Supabase (Postgres + Auth), vite-plugin-pwa.

## O que tem

- **Hoje:** saudação, seu expediente (tempo livre até o fim do expediente, linha do tempo com reuniões e almoço, e se as tarefas de trabalho cabem), agenda de reuniões, pra decidir, fica de olho, aprendendo (estudos em andamento), prioridades de hoje e no radar.
- **Pra daily:** resumo pronto do que você concluiu nas áreas de trabalho e do plano do próximo dia, com impedimentos (decisões de trabalho em aberto). Durante o expediente mostra o último dia útil + hoje; depois do expediente e no fim de semana, o dia que passou + o próximo dia útil. O texto é editável (a edição fica salva no aparelho) e tem botão de copiar. Lógica em `src/lib/daily/buildDailySummary.ts`.
- **Tarefas:** tudo agrupado em atrasadas, hoje, próximas e sem data, ordenado pela priorização automática. Dá pra filtrar por área e por tipo (tarefas, decisões, reuniões). O alfinete fixa uma tarefa nas prioridades de hoje.
- **Inbox:** o que entrou sem área. Um toque na bolinha colorida move o item pra área certa.
- **Estudos:** cursos e livros com progresso (+1 aula), prazo e ritmo necessário por semana.
- **Ajustes:** seu nome, horário de expediente e almoço, e as áreas (cor, nome, se é trabalho).

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

### Priorização automática

Cada tarefa recebe uma nota (`src/lib/priority/scoreTask.ts`) somando prioridade, urgência do prazo (atrasadas pesam mais), contexto (trabalho sobe em dia útil, vida pessoal no fim de semana) e há quanto tempo está parada. As Prioridades de hoje mostram as 3 maiores, e as fixadas com o alfinete vêm sempre primeiro.

## Rodando

### 1. Supabase

1. Crie um projeto grátis em [supabase.com](https://supabase.com).
2. Abra **SQL Editor → New query**, cole o conteúdo de `supabase/migrations/0001_init.sql` e rode. Depois faça o mesmo com `0002_grants.sql`, que dá aos usuários logados acesso às tabelas. Isso cria as tabelas, as regras de acesso (cada usuário só vê os próprios dados) e as áreas padrão para quem se cadastrar.
3. Em **Authentication → URL Configuration**:
   - **Site URL:** `http://localhost:5173` (troque pela URL da Vercel depois do deploy).
   - **Redirect URLs:** adicione `http://localhost:5173` e, depois, a URL da Vercel.

### 2. Login

- **Link por e-mail** já funciona sem configurar nada.
- **Google (opcional):**
  1. No [Google Cloud Console](https://console.cloud.google.com/apis/credentials), crie um _OAuth client ID_ do tipo **Web application**.
  2. Em _Authorized redirect URIs_, coloque `https://SEU-PROJETO.supabase.co/auth/v1/callback`.
  3. No Supabase, vá em **Authentication → Sign In / Providers → Google**, ative e cole o Client ID e o Secret.

### 3. App

```bash
cp .env.example .env.local   # preencha com Project URL e publishable/anon key (Supabase → Connect)
npm install
npm run dev                  # http://localhost:5173
npm test                     # testes do parser, da priorização e do cálculo de tempo livre
```

## Publicando e instalando no celular

1. Suba o projeto pro GitHub e importe na [Vercel](https://vercel.com). O framework é detectado como Vite.
2. Em **Environment Variables**, adicione `VITE_SUPABASE_URL` e `VITE_SUPABASE_PUBLISHABLE_KEY`.
3. Depois do deploy, coloque a URL da Vercel em **Site URL** e **Redirect URLs** no Supabase.
4. Para instalar:
   - **Android (Chrome):** menu ⋮ → **Instalar app**.
   - **iPhone (Safari):** compartilhar → **Adicionar à Tela de Início**.

O `vercel.json` já redireciona as rotas (`/tarefas`, `/estudos`…) para o app.

## Estrutura

```
supabase/migrations/   schema, RLS, recorrência (complete_task)
src/lib/               lógica pura e testada: quickAdd, priority, dayBudget, attention, dates
src/data/              queries e mutations do Supabase (TanStack Query)
src/hooks/             useNow (relógio), useTodayBoard (tudo calculado para a tela Hoje)
src/components/        AppShell, QuickAdd, TaskRow, TaskEditor, DayTimeline, StudyRow…
src/pages/             Hoje, Tarefas/Inbox, Estudos, Ajustes, Login
src/config.ts          nome do app
```

## Próximos passos sugeridos

- Captura por voz: gravar no PWA, transcrever numa Edge Function e passar pelo mesmo parser.
- Lembretes com Web Push: `pg_cron` + Edge Function avisando X minutos antes das reuniões e tarefas com horário. No iPhone, só funciona com o app instalado na tela inicial.
- Revisão semanal guiada aos domingos.
