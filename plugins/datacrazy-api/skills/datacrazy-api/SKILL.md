---
name: datacrazy-api
description: Consumir a API do CRM Datacrazy (REST api.g1.datacrazy.io e MCP) sem estourar limite, sem perder registro e sem gastar requisição à toa. Use sempre que for escrever ou revisar código que lê do Datacrazy — sync, ingestão, ETL, relatório, dashboard, cache local, Postgres/Neon/Supabase alimentado pelo CRM — ou quando aparecer 429, "Timeout after 60000ms", página vazia, carga completa faltando registros, count travado em 999, skip, take, paginação, rate limit, cota por rota, histórico de lead, mensagens de conversa, erroCode, impulsos/boosts e disparo em massa, rastro de campanha na conversa (campaign_event_trigger), filtros de /businesses, agente de IA (agentic, MCP próprio e structuredContent), consumo/estimativa de requisições, GitHub Actions, cron ou tarefa agendada chamando o CRM. Reúne o que foi medido em duas bases reais (set–out/2026); para montar painéis e regras de medição, use junto a datacrazy-dashboards.
---

# API Datacrazy: como consumir

Conhecimento medido em duas bases reais (Base A, ~15 mil negócios; Base B, ~17 mil negócios e 49 mil
conversas). Quando um número aqui divergir do que a API responde hoje, **vale a API**: meça, ajuste o código
e atualize esta skill.

Para o código de cada padrão (cliente com cota por rota, varredura por cursor, índice de conversas em
fatias, detecção de mudança, trava de plausibilidade, lista sem ordem estável, releitura dirigida),
leia `references/padroes.md`. Para **painéis** — que rota alimenta cada número, regras de medição
(nulo × zero, atribuição ao último toque, retorno só de quem recebeu) e como cada painel foi montado —
use a skill **datacrazy-dashboards**.

## 1. Endereços e chave

- REST pública: `https://api.g1.datacrazy.io/api/v1` e os prefixos `/api/v1/crm`, `/api/v1/messaging`,
  `/api/v1/accounts`. Os hosts internos (`crm.g1`, `messaging.g1`, `accounts.g1`) foram aposentados
  (comunicado de rotas internas, set/2026) — nunca use. Migração conferida na Base A em 27/09/2026:
  10 pontos comparados entre host interno e prefixo público, respostas idênticas.
- MCP: `https://mcp.g1.datacrazy.io/api/mcp` (mesma chave). Também expõe ferramentas de **escrita**
  (criar/mover/ganhar negócio, enviar mensagem, excluir): relatório usa só `*_list` / `*_get`.
- **Agente de IA (`https://agentic.g1.datacrazy.io/api/agentic`)**: agentes e bases **aceitam a chave da
  API** com os cabeçalhos `x-hostname: https://crm.datacrazy.io`, `x-language: pt`,
  `x-timezone: America/Sao_Paulo` (medido em 08 e 14/10/2026, Base A). Rotas conferidas:
  - `GET /agents`, `GET /agents/{id}` (com `knowledgeBases`, `tools` e `properties`), `POST /agents` (201)
    com `{name, description, systemPrompt, model, temperature, type, graphEngine, properties, knowledgeBaseIds}`;
  - `GET/POST /knowledge-bases` (`{name, description}`, 201), `GET /knowledge-bases/{id}/documents`, envio de
    arquivo em `POST /knowledge-bases/{id}/documents/upload` (multipart, campo `file`; `.txt` vira `completed`
    em segundos). `POST …/documents` dá 404;
  - `GET /tools` (ferramentas de conexões MCP externas) e `GET /tools/internal` (as do CRM, **incluindo
    as automações com gatilho MCP Server Tool**, pelo nome). Ferramenta interna entra no agente por
    `properties.internalTools: ["nome_da_tool"]`; `GET /mcp-connections` dá 500.
  - **Análises do agente aceitam a chave** (medido em 22/10/2026, Base A), com `?startDate=AAAA-MM-DD&endDate=…`:
    `GET /analytics/{agentId}/executions` (totais, `avgTokensPerExecution`, tendência),
    `/consumption` (`dailyUsage` por dia), `/tools` (chamadas por ferramenta), `/conversations`, `/overview`
    e `/recent` (`items` com `crazyTokens`, `promptTokens`, `completionTokens`, `cachedTokens`,
    `reasoningTokens`, `stepCount`, `toolCount`, `toolsProvided`; 15 por página, `hasMore`; `limit`/`take`
    quebram a rota). `/analytics/agents/{id}/…` dá 404. Execuções chamadas por automação
    (`agent-completion-ai`) entram. A tela Análises do CRM só mostra dados com a empresa certa selecionada
    no navegador; pela API esse risco não existe.
  - Escrita no agente: `PUT /agents/{id}` com o corpo inteiro (`toolIds`, `knowledgeBaseIds`, `properties`…);
    `PATCH` dá 404.
- **MCP próprio chamado pelo agente** (ex.: matrícula da Base A): `structuredContent` precisa ser
  **objeto** — devolva `{ sites: [...] }`, não o array solto. Array quebrou o agente em 10/2026; um guarda
  que embrulha qualquer lista evita a regressão.
- Auth: `Authorization: Bearer <token>`. O token vem do **`.env` do projeto, com prioridade sobre o
  ambiente**: máquinas com `DATACRAZY_API_TOKEN` de outra conta no sistema já carregaram dados da conta
  errada (`process.loadEnvFile` não sobrescreve variável existente). Leia o `.env` à mão e force. Ao ver
  "dados de outra conta", compare o hash do token em uso com o do `.env` antes de tudo.
- Nunca imprima, grave em arquivo ou passe token em linha de comando. Segredo de CI vai por stdin.
- No MCP do Claude Code, use `headersHelper` lendo o `.env` (não `${VAR}`, que resolve pelo ambiente).
- Cotas são **por conta**, não por token: vários tokens só servem de redundância.

## 2. Limites (medidos)

| Rota | Limite |
|---|---|
| `/businesses`, `/leads`, `/messages`, maioria | 60 req / 60 s |
| `/conversations` | **20 req / 60 s** — o gargalo |
| `/departments`, `/attendants`, `/company-users`, `/instances`, `/boosts*` | 20 / 60 s |
| `/tags`, `/pipelines`, `/pipelines/{id}/stages` | 60 / 60 s (medido em 10/10/2026) |
| rota desconhecida | trate como 20 / 60 s |

As rotas `/boosts*` não publicam os cabeçalhos de cota: o limite fica no valor conhecido.

- O limite é **por rota** (IDs normalizados para `:id`). Leia `X-RateLimit-Limit`, `-Remaining` e
  `-Reset` e ajuste a cota da rota sozinho.
- **429**: congele a rota inteira por `Retry-After` + 1 s. `Retry-After` às vezes vem 0: use recuo
  exponencial com piso (5, 10, 20… s, teto 120 s).
- **400 com "Timeout after 60000ms" no corpo** (visto em `/conversations`): é lentidão do servidor, não
  pedido errado. Repita 2 vezes e, se insistir, peça a mesma página com metade do `take` (piso 100).
- 5xx e erro de rede: recuo exponencial com jitter. Outros 4xx: falhe sem repetir.

## 3. Paginação — onde se perde dado

- `skip` + `take`, `take` até **1000** (1500 responde 400).
- **Teto do skip: desde 03/10/2026, `skip ≥ 11.000` devolve página vazia**, em qualquer rota, sem erro.
  Página cheia seguida de página vazia é **teto, não fim**. Nada que passe de ~10 mil registros pode
  paginar só por skip.
  - **Negócios**: `order[lastMovedAt]=desc&order[id]=desc` + cursor `filter[lastMovedAtLessOrEqual]`
    com o último `lastMovedAt` lido; o skip só desempata o mesmo instante. No fim, uma página com
    `filter[lastMovedAfter]=<início da varredura>` pega o que se moveu durante a leitura.
  - **Leads**: mesmo esquema com `order[createdAt]=desc` + `filter[createdAtLessOrEqual]`.
  - **Conversas**: a rota ignora ordem e filtro de data. Fatie por `filter[status]` (`unstarted`,
    `waiting`, `opened`, `automation`, `finished`, `error`) e, se um status encher o teto, por
    `filter[instances]` dentro dele.
- Skip puro também perde item quando ele se move durante a leitura (os seguintes sobem uma posição).
  Cursor por data resolve os dois problemas.
- `count` não serve de total: em `/conversations` (REST e MCP) fica travado em **999**; `/leads` e
  `/activities` não trazem `count`. Pare quando a página vier menor que o `take`.
- `/conversations` vem por `lastMessageDate` desc: incremental para quando passar da data de corte.
- `/boosts/{id}/leads`: **sem `order`** (todos entram no mesmo instante e ordenar por carimbo repetido
  embaralha a janela); releia até o total bater com as métricas do impulso. Medido em 04/10/2026:
  `take=100` com `order[statusChangedAt]` trouxe 1.465 ids distintos de 1.822; `take=1000` sem `order`,
  tudo em 2 requisições. Mais três travas:
  - **duas páginas cheias seguidas sem ninguém novo** = a rota ignorou o `skip`: pare (sem isso, 120
    requisições por estado numa rota de 20/min);
  - impulso **rodando** (`started`): as contagens de `/metrics` não servem de alvo (gente muda de estado
    entre as duas leituras) — leia cada estado uma vez e deixe a próxima rodada reler;
  - `/metrics` só lista estados **com gente** (ausente = 0, e não precisa de requisição).
- `/boosts` (a lista): `take=50`; página repetida = `skip` ignorado, pare.
- `/api/v1/pipelines` para em 50: o resto vem do MCP (`pipeline_list`, `pipeline_stage_list`).

## 4. Rotas com comportamento próprio

- **`/leads/{id}/history`**: tudo numa página; **qualquer** `skip`, `take`, `limit` ou `page` devolve
  vazio. Teto de **100 eventos (os mais recentes)** — em cliente com muitos pedidos, eventos antigos
  (como a distribuição de vendedor) somem. Eventos úteis: `conversation-attendant-changed`
  (`parameters.instanceName`, `attendantName`, `sessionName` da distribuição automática ou nulo quando
  manual), `business-attendant-changed`, `lead-tag-added`, `business-moved`.
- **Mensagens**: REST `/conversations/{id}/messages` devolve só as **20 últimas** e ignora `take`,
  `limit`, `pageSize` e `skip` (testado em 23/09/2026), mas é a única com `erroCode`/`errorMessage`. O MCP
  `conversation_messages_list` pagina tudo e é o único com o **atendente**. Grave as duas fontes sem que
  uma apague os campos da outra (upsert que preserva colunas). Janela de 20 sem a mensagem
  `firstTicketMessage` não prova ausência de nada: o que já foi medido não pode sumir na releitura.
- **Rastro de campanha na conversa**: o disparo abre a conversa com uma mensagem de entrada sintética de
  corpo `campaign_event_trigger`, e a automação responde no mesmo minuto; o `status` dessa resposta
  (`SENT` saiu, `RECEIVED` chegou, `READ` leu) é a entrega/leitura do disparo. Não há rota de campanha:
  `/campaigns`, `/broadcasts` e `/campaign-events` dão 404 e `/lists` vem vazia (23/09/2026).
- **Impulsos (`/crm/boosts`)** aceitam a mesma chave. Os de tipo `automation` vêm com `messageStatus`,
  `errorCode` e `template` **nulos** por lead: entrega, leitura e motivo saem das mensagens, pelo
  `lead_id`. Lead excluído no CRM vem com `lead.id` nulo. O público fica em `params.filter`:
  `tags: ["some <id>" | "none <id>"]`, `stages`, `business { stages, startDate, endDate }`,
  `createdAtGreaterOrEqual`/`createdAtLessOrEqual` — nomes por `/tags`, `/pipelines` e
  `/pipelines/{id}/stages`. `/metrics` com `?cache=no-cache`.
- **Filtros**: `filter[campo]=valor`; campos adicionais do lead exigem `complete[additionalFields]=true`.
  Incremental útil: `createdAtGreaterOrEqual`, `lastMovedAfter`. Mudar tag ou dono **não** muda
  `lastMovedAt`: tags de registros antigos só atualizam com carga completa.
  - Em `/businesses` (medido em 13/09/2026 no prefixo `/crm`): **aplicam** `lastMovedAfter`/
    `lastMovedBefore`, `createdAtGreaterOrEqual`/`LessOrEqual`, `statusChangedAt…` e `stage.id`;
    **ignorados em silêncio** `movementDate`, `date`, `startDate`/`endDate`, `updatedAt…` e `pipeline`.
    Filtro inventado também é ignorado — confira a contagem com e sem o filtro.
  - Desde 27/09/2026 o `/api/v1/businesses` sem prefixo também aplica os filtros (3.203 com
    `lastMovedAfter` contra 20.724 sem, os mesmos do prefixo `/crm`).
- Lead embutido em negócio/atividade é **parcial**: só crie se não existir.
- `instance.config` traz o token do provedor de WhatsApp: remova `config`/`webhook` antes de gravar o
  payload cru.
- Mover em lote: `POST /api/v1/businesses/actions/move` com `{ids, destinationStageId}`.
  `pipeline_stages_save` (MCP) **recria a pipeline inteira** e falha se alguma etapa tiver negócios —
  etapas novas só pela interface.
- **Listas e última mensagem (Base A, medido em 04/11/2026):**
  - `GET /lists` responde `{count, data}`, e `POST /lists {name, description}` devolve 201 com a lista.
  - `PATCH /leads/{id}` com `{lists: [{id}]}` **substitui** o conjunto de listas do lead (mandar só uma tira as outras) e não mexe nas tags. Cada escrita gasta 1 da cota de 60/min.
  - `GET /leads?filter[lists]=some <id>` acha o lead.
  - `/crm/segments` são os filtros salvos da tela (tags, etapas, atendentes, data).
  - A listagem de `/conversations` traz `lastReceivedMessageDate`, `lastSendedMessageDate` e `lastMessage.received`. Com eles, "quem falou por último" sai sem ler as mensagens.
- **Trocar dono (escrita, Base A 16/10/2026 — código pronto, ainda não exercido contra o CRM real):**
  negócio `PATCH /api/v1/businesses/{id}` `{attendantId}` (id do CRM; não há lote de dono —
  `actions/move` é de etapa); conversa `POST /api/v1/messaging/conversations/change-attendant`
  `{conversationsId: [], attendantId}` (id do multiatendimento) ou `…/conversations/{id}/change-attendant`.
  Para achar a carteira, `GET /businesses?filter[attendant]=` **é ignorado** (devolve tudo); use a
  varredura ou o banco local. `GET /conversations?filter[attendants]=<id multi>` **funciona**. Pilote
  com um item e confira as cotas de escrita nos cabeçalhos.
- Atendentes têm dois IDs (CRM em negócio/lead; multiatendimento em conversa/thread): agrupe por
  `user_id`. Origem do lead está nos campos adicionais (`utm_*`, `Nicho`), não em `source`.
- **Ganhar com data** (medido em 10/10/2026, Base D). A rota interna
  `POST /api/v1/crm/businesses/actions/won` com `{ids, wonDate}` grava a data em `statusChangedAt`,
  **só em negócio aberto**. Em negócio já ganho, responde 201 e não muda nada.
  - Para trocar a data de um ganho: `POST /api/v1/crm/businesses/actions/restore-status` com `{ids}`,
    depois `won` com a data.
  - A ação nativa `win-business-action` não aceita data: usa a hora em que roda.
  - `GET /api/v1/businesses/{id}` traz `additionalFields` (`additionalField.name`, `value`, `valueDate`).

## 5. Gastar menos requisição

1. **Lote antes de item**: `/leads?take=1000` e `/conversations?take=1000` e consulta em memória, nunca
   `/leads/{id}` ou `/conversations?search=` por negócio (o n8n antigo fazia 3 req/negócio: 13 h para o
   histórico a 20/min).
2. **Varredura barata, leitura cara só do que mudou**: reler todos os negócios custa ~17 req (1000 por
   página). Mensagens são ~90% do custo: guarde uma assinatura por negócio (etapa, pipeline, tags, dono,
   `updatedAt` da conversa, versão da regra) e só chame `/messages` quando a conversa andou.
3. **Teto por rodada** nas chamadas caras (ex.: 300 por rodada horária, 3000 na consolidação noturna),
   com prioridade (novos → conversas que andaram → histórico) e o excedente marcado para a próxima.
4. **Teto de buscas avulsas** (fallback item a item) por rodada; o resto fica adiado, não trava a rodada.
5. Escreva em lote (upsert multi-linha de ~400) — 15 mil idas ao Postgres viraram 11 s.

## 6. Não gravar lixo

- **Trava de plausibilidade antes de escrever**: aborte a rodada se a varredura trouxe menos de 50% da
  anterior, ou o índice "completo" não tem mais da metade do que já se conhecia (a API já devolveu 0
  negócios com host fora do ar).
- **Exclusão só com folga**: remova o que não veio numa carga completa apenas se for ≤ 10% da tabela;
  acima disso, mantenha e avise (foi assim que o teto do skip apareceu sem apagar 5 mil negócios).
- Registro que some do CRM pode ter sido excluído de verdade (Base B: 131 leads disparados em 3 dias):
  guarde em tabela à parte antes de refazer o retrato, como métrica separada.
- **Uma rodada por vez**: trava com batimento (linha `executando` + `pulsacao_em`, morta após 15 min sem
  batida) e `concurrency` no Actions — duas rodadas simultâneas já sobrescreveram 759 linhas com dado velho.

## 7. Onde rodar

- Ingestão longa **não** cabe em função serverless (Vercel Hobby: 30–60 s). Rode em GitHub Actions
  (timeout 90–180 min, `concurrency`) ou máquina; o site só dispara (`workflow_dispatch` com token
  fine-grained só de Actions).
- O `schedule` do GitHub atrasa e pula (até 4h45 de atraso; 3 de 11 rodadas criadas). Marque fora da hora
  cheia (minuto 17) e, se precisar de pontualidade, use cron externo chamando uma rota que dispara o
  workflow, deixando o `schedule` só como reserva.
- Banco do Actions: cache entre rodadas + semente em release para o primeiro uso.
- **Tenha o plano B pronto.** Em 10/2026 o Actions parou nos dois projetos (Base B: minutos do
  repositório privado acabaram; Base A: a cobrança da conta passou a barrar todos os jobs). A ingestão
  precisa rodar igual fora dele: a mesma CLI com `--se-faltar` numa VPS (as duas bases hoje rodam numa VPS) ou, como ponte, em tarefa agendada do Windows (frágil: morre com a janela ou o
  PC dormindo). Desligue o workflow (`gh workflow disable`) para não ficar falhando em silêncio.

## 8. Estimar o consumo antes de subir

Some, por rodada: cadastros (~10–20 req) + varredura de negócios (total/1000 + 1) + leads (total/1000) +
conversas (fatias: ~6 status + conexões dos status cheios, a 20/min) + mensagens (só conversas que
andaram, com teto) + históricos/avulsos (com teto). Divida cada rota pelo seu limite para o tempo mínimo:
**`/conversations` a 20/min costuma definir a duração**. Multiplique pelas rodadas/dia e confira o minuto
de Actions do plano (Base A: 1.600–2.000 min/mês contra 2.000 do repositório privado gratuito).

Referência medida: varredura de ~15 mil negócios = 16 req / ~25–200 s (o servidor oscila); índice de 17
mil conversas = ~27–45 req / ~2 min; rodada rápida sem mensagens ≈ 2–4 min.
