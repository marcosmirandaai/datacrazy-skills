# Dados do CRM para painéis: de onde vem cada coisa e quanto custa

O cliente HTTP, os limites por rota, a paginação por cursor e o teto do skip estão na skill
**datacrazy-api** (com código). Aqui fica o lado do painel: que rota dá cada dado, como os dois
projetos combinam as fontes e o que já enganou.

## Conteúdo
1. Mapa: dado do painel → fonte
2. Como a Base A lê (rodada com assinatura)
3. Como a Base B lê (sync + MCP)
4. MCP: quando vale e como usar
5. Campos que pegam desprevenido
6. Pegadinhas que já viraram número errado

## 1. Mapa: dado do painel → fonte

| Dado | Fonte | Como ler para painel | Observações |
|---|---|---|---|
| Negócio (etapa, pipeline, dono, tags do lead, `lastMovedAt`, status) | REST `/crm/businesses` | varredura **completa** por cursor de `lastMovedAt` a cada rodada (~29 req para ~27 mil em 10/2026) + página `lastMovedAfter` no fim | mudar tag ou dono não muda `lastMovedAt`: incremental por data perde tag |
| Lead (contatos, `source`, `sourceReferral`, atendente do lead, campos adicionais) | REST `/leads` | índice em lote por cursor de `createdAt` (~18 req para ~17 mil); `complete[additionalFields]=true` quando precisar dos campos | sem `count`; lead embutido em negócio é parcial |
| Conversa (status, instância, departamento, atendentes, `updatedAt`, `contact.contactId`) | REST `/conversations` | índice em fatias: vitrine das 1000 mais recentes → cada status → status cheio por conexão (~44 req para ~19 mil; 3–10 min) | 20 req/min; ignora ordem e filtro de data; `count` travado em 999 |
| Ligação conversa ↔ lead | `contact.contactId` da conversa = contato do lead (Base A) ou MCP `conversation_list` com `leadId` (Base B) | em memória, pelo índice | — |
| Mensagens (tempos, disparo, resposta, "SAIR") | REST `/conversations/{id}/messages` | 1 req por conversa, **só de quem mudou**, com teto por rodada | devolve só as **20 últimas** e ignora `take`/`skip`; é a única com `erroCode`/`errorMessage` |
| Mensagens com atendente e paginadas | MCP `conversation_messages_list` | Base B, `limit 1000` | o MCP não traz o código de erro |
| Histórico do lead (distribuição de vendedor, tag com data, movimentação) | REST `/leads/{id}/history` | 1 req por lead, com filtro de quem precisa | tudo numa página, teto de 100 eventos (os mais recentes); qualquer `skip`/`take` devolve vazio |
| Atendentes | `/accounts/company-users`, `/crm/attendants`, `/messaging/attendants` | costurar pelo `userId`; e-mail liga ao login | dois ids por pessoa (CRM × multiatendimento) |
| Departamentos e membros | `/messaging/departments`, `/messaging/departments/attendants/{id}/attendants` | a cada rodada (~30 s) | `DELETE + INSERT` dos vínculos deixa o departamento vazio por um instante |
| Conexões (números de WhatsApp) | `/instances` | 1 req por rodada | `config` traz token do provedor: descarte; `config.wabaId` = API Oficial |
| Impulsos | `/crm/boosts`, `/crm/boosts/{id}/metrics`, `/crm/boosts/{id}/leads` | ver `paineis/impulsos.md` | tipo `automation`: status de mensagem e erro vêm nulos |
| Público do impulso (nomes) | `/tags`, `/pipelines`, `/pipelines/{id}/stages` | só quando o filtro muda | 60 req/min cada (10/10/2026) |
| Pipelines e etapas | REST `/pipelines` (para em 50) ou MCP `pipeline_list`/`pipeline_stage_list` | cadastro | o mesmo nome de etapa existe em pipelines diferentes |
| Atividades | REST `/activities` | completo (sem filtro por data, sem `count`) | Base B |
| "Campanha" | não existe como rota: `/campaigns`, `/broadcasts`, `/campaign-events` = 404; `/lists` vazia (23/09/2026) | use impulsos + o gatilho `campaign_event_trigger` na conversa + tag de campanha | — |
| Origem do lead | `source`/`sourceReferral` do lead; na Base B, campos adicionais `utm_*` e `Nicho` | junto do índice de leads (0 req a mais) | Base A 22/09: 50 de 600 com `source`, nenhum com `sourceReferral`; Base B: `source` vazio em ~98% |

## 2. Como a Base A lê (rodada com assinatura)

Uma rodada (`src/ingest/run.js`, `executarIngestao`), em ordem:
1. Cadastros: atendentes e departamentos (toda rodada desde 04/10/2026), plantão, acessos, conexões,
   impulsos. Falha nesses passos vira aviso; a rodada segue.
2. Índices em lote: conversas (fatias) e leads (cursor).
3. Varredura de todos os negócios por cursor + `conferirLeitura` (aborta se leu menos de 50% da
   anterior — em 03/10/2026 a varredura voltou com 0 negócios por horas).
4. Por negócio (concorrência 4): contexto → **assinatura** (etapa, pipeline, `lastMovedAt`, status,
   dono, lead, tags, contatos, `source`, conversas com `updatedAt`, membros dos departamentos, negócios
   do lead, versão das regras) → `decidir`: `igual` (0 req), `remontar` (0 req, tempos do banco) ou
   `mensagens`.
5. Fila de mensagens por prioridade — comercial antes do suporte; novos → conversas que andaram →
   releituras dirigidas (ex.: pedido para sair) → histórico da planilha — cortada no **teto da
   rodada** (horária 300, consolidação 3.000, manual 600 no Actions / 1.500 local). O excedente é
   gravado sem assinatura e entra na próxima.
6. Buscas avulsas (lead ou conversa que não estava no índice) com teto: 120 leads e 40 conversas por
   rodada; o resto fica adiado, sem travar a rodada.
7. Conversas sem negócio, só com índice completo e com o que sobrou do teto.

Medido em 10/10/2026: rodada horária com 159 requisições em ~5,3 min; consolidação ~10,9 min. Antes da
assinatura (12/09/2026), a rodada custava 50 min e 3.100 requisições, 90% em mensagens.

Regras que nasceram de incidente:
- **"Disparo medido não some":** a releitura das 20 últimas mensagens pode não alcançar o gatilho;
  nesse caso os campos de disparo do banco são preservados (`CAMPOS_DE_DISPARO`).
- **Janela cheia sem o começo do ticket = "não sei":** 20 mensagens sem `firstTicketMessage` não provam
  que não houve disparo (`disparos: null`).
- **Regra nova que depende do texto da mensagem** (como o "SAIR") não se resolve subindo
  `VERSAO_DAS_REGRAS` (ela remonta sem reler): faça uma releitura dirigida e única (`decidir` devolve
  `mensagens` para quem precisa) e um valor que encerra a pendência quando não dá mais para medir.

## 3. Como a Base B lê (sync + MCP)

- `sync.js`: `cadastros`; `--full leads negocios` sempre (só assim as tags atualizam); `atividades`,
  `conversas` (REST por `lastMessageDate` desc, incremental para na data de corte), `vinculos` (MCP),
  `mensagens` (MCP, só conversas com mensagem nova; filtro por conexão e dias), `historico`.
- Erros de envio pela REST (`atualizar_erros_rest.js`) só para quem precisa; histórico do lead só da
  tag sem histórico ou cujo negócio se moveu depois do último evento (a regra antiga rebaixava 880
  leads por rodada); conversas dos vendedores por SQL com `UNION` (com `OR` no JOIN "leva minutos").
- Exclusão segura: na carga completa, apaga do cache o que não veio, **exceto se faltar mais de 10%**.
- Medido: completo 9,9 min (09/10/2026, 18.327 negócios em 260 s); com histórico grande, 36,2 min.

## 4. MCP: quando vale e como usar

- **Use o MCP para o que só ele dá:** vínculo conversa → lead, mensagens paginadas com o atendente,
  departamentos, tipos de atividade, campos adicionais, pipelines/etapas além de 50. **Use a REST** para
  o código de erro da mensagem e para tudo em lote (o MCP é mais lento: intervalo de 300 ms ≈ 160
  conversas/min).
- Cliente (Base B `lib/mcp.js`): JSON-RPC sobre HTTP em `https://mcp.g1.datacrazy.io/api/mcp`;
  `initialize` com `protocolVersion '2025-03-26'`, depois `notifications/initialized`; sessão no
  cabeçalho `mcp-session-id`; resposta JSON ou SSE (vale a última linha `data:`); repetir em 429/5xx
  (Retry-After ou 15 s) e quando `isError` traz "rate|too many|timeout|temporar". Paginação
  skip/limit até página vazia (sem `count`, custa uma chamada a mais).
- Relatório usa só ferramentas `*_list` e `*_get`: o MCP também cria, move, ganha, envia mensagem e
  exclui.
- No Claude Code, `.mcp.json` com `headersHelper` que lê o `.env` do projeto e sai com erro sem token —
  `${DATACRAZY_API_TOKEN}` resolvia pela variável do sistema, de outra conta. Teste rápido:
  `pipeline_list` devolve os pipelines esperados.
- **MCP próprio para o agente de IA do Datacrazy** (matrícula da Base A, `/mcp`): ferramenta que devolve
  lista precisa embrulhar em objeto no `structuredContent` (`{ sites: [...] }`, `{ unidades: [...] }`) —
  array solto quebrou o agente (corrigido em 10/2026, com um guarda `estruturado()`). As rotas de
  análise do agente (`agentic.g1`: execuções, recentes, configuração) só aceitam a sessão do navegador
  com assinatura — não a chave da API; investigue pelo navegador logado.

## 5. Campos que pegam desprevenido

- `erroCode` (com "erro") na mensagem; o código bruto da Meta vem como
  `chat.errors.whatsapp-cloud-error.error-code-<n>`.
- Conversa: `lastSendedMessageDate`, `lastReceivedMessageDate`, `lastMessageDate`; `firstTicketMessage`
  na mensagem que abre o ticket.
- Lead: `rawPhone`, `metrics.*` (compras), `sourceReferral.{sourceId, sourceUrl, ctwaId}`,
  `contacts[].contactId`.
- Etapa: `stage.index` (posição). Atendimento (thread): `durationInMs`, `waitTimeInMs`.
- Histórico: `parameters.instanceName`, `attendantName`, `sessionName` (nome da distribuição
  automática; nulo quando manual).
- Impulso: `recordsCount`, `params.filter` (`tags: ["some <id>" | "none <id>"]`, `stages`,
  `business { stages, startDate, endDate }`, `createdAtGreaterOrEqual`/`LessOrEqual`), `speed`,
  `interval`, `batchSize`, `hasErrors`, `flow { id, name }`. Lead do impulso: `enteredAt`, `startedAt`,
  `finishedAt`, `statusChangedAt`, `lead.id` (nulo se o lead foi excluído).
- Status de mensagem: `SENT` saiu, `RECEIVED` chegou no aparelho, `READ` o contato abriu, `ERROR`,
  `PENDING`.

## 6. Pegadinhas que já viraram número errado

- **Token de outra conta responde 200** e enche a base com dados errados. Leia o token do `.env` do
  projeto com prioridade sobre o ambiente; desconfiou, compare o hash.
- **Espaço nas pontas** de tag e nome de etapa: o seletor mostrava 70 e o filtro trazia 3. Normalize ao
  gravar.
- **Tag de lead antigo** só atualiza com carga completa; **ganho ou perda sem mudar de etapa** pode
  escapar do incremental de negócios.
- **Lead excluído do CRM** some sem aviso: guarde à parte antes de refazer o retrato.
- **`count` não é total** em `/conversations` (999) e não existe em `/leads` e `/activities`.
- **Página vazia depois de cheia é teto, não fim** (skip ≥ 11.000 desde 03/10/2026): índice cortado
  não pode afirmar "não tem conversa".
- **Uma conversa sem conexão conhecida** no status cortado basta para o índice ser marcado incompleto
  (Base A, 10/10/2026: ~1.700 negócios adiados por rodada) — avalie tolerância antes de copiar a regra.
