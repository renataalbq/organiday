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


## Claude e Codex (MCP)

O Organiday tem um servidor MCP em `/api/mcp`. Com ele, o Claude (Code, desktop e web) e o Codex criam e leem suas tarefas. Exemplo: no meio de um debug, você diz "abre uma tarefa amanhã às 10h no trabalho pra resolver esse bug", e a tarefa aparece no app com o contexto nas notas.

**Ferramentas:** `list_areas`, `create_task`, `list_tasks`, `update_task`, `complete_task`. A área aceita o nome ou o começo dele (`trabalho`, `casa`), e "hoje" segue `ORGANIDAY_TIME_ZONE` (padrão `America/Sao_Paulo`).

**Login:** OAuth 2.1 usando o próprio Supabase Auth. O cliente recebe um token normal do usuário, então tudo passa pelo RLS.

### Configurar uma vez no Supabase

1. **Authentication → OAuth Server:** ligue o servidor OAuth, ponha `/oauth/consent` em *Authorization path* e ligue o *Dynamic client registration* (o Claude e o Codex se registram sozinhos).
2. **Authentication → URL Configuration:** o *Site URL* precisa ser o endereço de produção, porque a tela de consentimento é aberta nele.

### Conectar

- **Claude Code:** `claude mcp add --transport http organiday https://SEU-APP/api/mcp`, depois `/mcp` → organiday → *Authenticate*.
- **Claude desktop/web:** Configurações → Conectores → *Adicionar conector personalizado* → `https://SEU-APP/api/mcp`.
- **Codex:** `codex mcp add organiday --url https://SEU-APP/api/mcp`, depois `codex mcp login organiday`.

O navegador abre o Organiday, você entra (se precisar) e clica em **Permitir**.

### Arquivos

- `server/mcp/handleMcp.ts`: ferramentas, checagem do token e metadados do recurso protegido.
- `api/mcp.ts` e `api/oauth-protected-resource.ts`: funções da Vercel. O `vercel.json` aponta `/.well-known/oauth-protected-resource` pra segunda.
- `src/pages/OAuthConsentPage.tsx`: tela de Permitir/Não permitir. Depois do login, o `App.tsx` traz a pessoa de volta pra ela.
- No `npm run dev`, o Vite serve as mesmas rotas.

## Jira, Trello e Asana

Em **Ajustes → Jira, Trello e Asana**, cada pessoa conecta a própria conta com um token. O que estiver atribuído a ela e ainda aberto aparece na **Inbox → Chegou de fora**, e o botão **Puxar** transforma o item em tarefa na área de trabalho, com o link e o contexto nas notas. É só leitura: o Organiday não altera nada nessas ferramentas.

| | O que aparece | Credencial |
|---|---|---|
| Jira Cloud | issues atribuídas a você que não estão concluídas | endereço (`empresa.atlassian.net`), e-mail e token de API |
| Trello | cartões abertos em que você é membro | chave de API e token (pelo painel de Power-Ups) |
| Asana | tarefas atribuídas a você que não estão concluídas | token de acesso pessoal |

- **Tokens:** o servidor confere o token com a ferramenta e criptografa (AES-256-GCM) antes de salvar na tabela `integrations`. A chave é `ORGANIDAY_SECRET_KEY` e só existe no servidor. Se ela mudar, as integrações precisam ser conectadas de novo.
- **Sem duplicar:** a tarefa puxada guarda `tasks.external_ref` (ex.: `jira:empresa.atlassian.net:APP-42`), e o item some de "Chegou de fora".
- **Migration:** `supabase/migrations/0006_integrations.sql`.
- **Arquivos:** `server/integrations/` (provedores, criptografia, rotas), `api/integrations.ts` e `api/integration-items.ts`, `src/components/IntegrationSettings.tsx` e `src/components/ExternalInbox.tsx`.

## Lembretes (notificações)

Em **Ajustes → Lembretes**, cada aparelho ativa as notificações. Elas chegam mesmo com o app fechado:

- **Tarefas com horário:** X minutos antes (na hora, 5, 15, 30 ou 60 min; o padrão é 15).
- **Tarefas só com data:** no começo do expediente do dia em que vencem (dá pra desligar).
- **iPhone:** só funciona com o app instalado na Tela de Início (iOS 16.4 ou mais novo).

**Como funciona:** o `pg_cron` do Supabase chama `/api/send-reminders` a cada 5 minutos. O servidor pega o que venceu com `claim_due_reminders()`, que marca `tasks.reminded_at` pra não repetir e usa o fuso de cada pessoa, e manda o push com `web-push` pra cada aparelho em `push_subscriptions`. Mudou a data ou a hora da tarefa, o lembrete volta a valer. O service worker mostra a notificação (`public/push-sw.js`). A chave pública VAPID o app busca em `/api/push-public-key`.

**Configurar:**
1. Rode `supabase/migrations/0008_reminders.sql`.
2. Na Vercel, crie: `VAPID_PUBLIC_KEY` e `VAPID_PRIVATE_KEY` (gere com `npx web-push generate-vapid-keys`), `CRON_SECRET` (`openssl rand -hex 24`) e `SUPABASE_SERVICE_ROLE_KEY`. Faça um redeploy.
3. No Supabase, ligue as extensões `pg_cron` e `pg_net` e rode o bloco "Agendar o envio" do fim da migration 0008, com o mesmo `CRON_SECRET`.

No `npm run dev` o service worker não roda, então pra testar as notificações use `npm run build && npm run preview`.
