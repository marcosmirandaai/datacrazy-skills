# KB-08 — Rotas internas do Datacrazy (regra nova: só pelo endereço público)

As **rotas internas** são as que o próprio CRM usa por trás da tela, nos serviços `crm`, `messaging` e `accounts`. Elas vão além dos endpoints documentados do KB-07: métricas do funil, histórico das sessões de fluxo, executar uma automação para um lead, conversas em lote, contagem de leads, CEP, quem está online.

Fontes:
- comunicado oficial "Rotas Internas Datacrazy (Mudanças nas APIs internas)", `help.datacrazy.io`, set/2026;
- o código público do front do CRM (set/2026): 450 chamadas, com método, caminho e, nas principais, o corpo.

Níveis:
- ✅ **Medida**: chamada feita com a chave da conta pelo endereço público e resposta conferida (out/2026, seção 3).
- 🟡 **Extraída do front**: a rota existe e o CRM a usa. O endereço novo segue a regra do comunicado. Teste a chamada antes de ativar e registre a Pendência "testar a rota antes de ativar".
- ⚠️ **Só com pedido explícito**: altera ou apaga dados em massa, ou mexe na configuração da conta.
- ⛔ **Não use em automação**: cobrança, segurança, usuários, controle de conexões e serviços fora do comunicado.

---

## 1. A regra que entra em vigor

A partir da próxima release do Datacrazy, os domínios internos **deixam de responder**. O mesmo dado passa a ser acessado só pelo endereço público `api.g1.datacrazy.io`, com o mesmo caminho e a versão `v1`:

| Como era (deixa de funcionar) | Como passa a ser |
|---|---|
| `https://crm.g1.datacrazy.io/api/crm/<caminho>` | `https://api.g1.datacrazy.io/api/v1/crm/<caminho>` |
| `https://messaging.g1.datacrazy.io/api/messaging/<caminho>` (o comunicado também mostra `…/api/crm/`) | `https://api.g1.datacrazy.io/api/v1/messaging/<caminho>` |
| `https://accounts.g1.datacrazy.io/api/accounts/<caminho>` | `https://api.g1.datacrazy.io/api/v1/accounts/<caminho>` |

Exemplo do comunicado: `https://crm.g1.datacrazy.io/api/crm/businesses/metrics/summary` passa a ser `https://api.g1.datacrazy.io/api/v1/crm/businesses/metrics/summary`.

- O comunicado cita `accounts` sem exemplo. A linha de `accounts` aplica a mesma regra; confirme no primeiro teste.
- **Webhooks não mudam.** A URL do gatilho Requisição HTTP (`…/api/crm/flows/webhooks/…`) continua a mesma. Nunca "migre" uma URL de webhook.
- **Nunca gere** URL com `crm.g1.datacrazy.io`, `messaging.g1.datacrazy.io` ou `accounts.g1.datacrazy.io`: o validador do canvas recusa e mostra o endereço certo.
- Os serviços `agentic`, `mcp`, `templates` e `routing` do front **não** estão no comunicado. Não use.

---

## 2. Qual caminho escolher

1. **Bloco nativo** (KB-10 a KB-19): não gasta chamada, não depende de chave, aparece nos contadores.
2. **Endpoint documentado** do KB-07 (`/api/v1/leads`, `/api/v1/businesses`…): contrato publicado, estável.
3. **Rota interna migrada** (`/api/v1/crm/…`, `/api/v1/messaging/…`): só para o que 1 e 2 não fazem.

Os dois formatos convivem no mesmo host e **não são iguais**. Exemplo: ganhar negócios é `POST /api/v1/businesses/actions/win` com `{ "ids" }` no KB-07, e `POST /api/v1/crm/businesses/actions/won` com `{ "ids", "wonDate" }` na rota interna. Não misture caminho de um com corpo do outro.

O que só a rota interna faz:

| Preciso… | Rota |
|---|---|
| executar uma automação para um lead que não é o da sessão | `POST /crm/flows/triggers/leads/execute-lead` |
| iniciar uma automação em várias conversas de uma vez | `POST /messaging/conversations/start-automation` |
| métricas do funil por dia, atendente, produto ou motivo de perda | `GET /crm/businesses/metrics/summary/…` |
| métricas do atendimento (tempo de resposta, por atendente, por departamento) | `GET /messaging/threads/metrics/summary/…` |
| saber quem está online para distribuir | `GET /crm/presence/online` |
| contar leads de um filtro sem trazer a lista | `POST /crm/leads/count` |
| criar uma pipeline e suas etapas (não há endpoint público) | `POST /crm/pipelines` · `POST /crm/pipelines/{id}/stages` ⚠️ |
| adicionar ou tirar leads de listas em lote | `POST /crm/leads/actions/add-to-lists` · `remove-from-lists` |
| ver o histórico de uma sessão de automação | `GET /crm/flow-sessions/{id}/history` · `/details` |
| buscar endereço pelo CEP | `GET /crm/address/search/{cep}` |
| status da conexão no provedor | `GET /messaging/uazapi/connection/status/{instanceId}` (e equivalentes por provedor) |
| achar a melhor conversa de um contato | `POST /messaging/conversations/find-best-by-contact` |
| mensagens rápidas cadastradas | `GET /messaging/templates` |

---

## 3. Autenticação

- O front chama as rotas internas com o **token de sessão do usuário logado**, que expira em cerca de uma hora. **Nunca** copie esse token do navegador para uma automação.
- Na rota pública migrada, use a **chave da API da conta** (Configurações › Chaves de API) no header `Authorization: Bearer <chave>`, como no KB-07. Deixe o valor vazio no JSON e registre a Pendência.
- 🟡 Confirme no primeiro teste. Resposta `401` ou `403` = a rota não aceita a chave: registre e use a alternativa do KB-07 ou o bloco nativo.
- ✅ As rotas marcadas ✅ na seção 5.1 aceitam a chave da conta: as de automação (medido em 01, 02 e 06/10/2026) e as de pipeline e etapa (medido em 06/10/2026, sem nenhum dos headers extras do front).
- Header opcional `X-TimeZone: America/Sao_Paulo`: o front sempre manda. Use nas métricas por dia, para o corte do dia sair no horário de Brasília.
- Limite: siga o do KB-07, 60 chamadas por minuto por rota.

---

## 4. Query, corpo e resposta

Do código do front:

- **Paginação**: `skip` e `take` na query.
- **Filtros**: `filter[<campo>]=<valor>`. Listas separadas por vírgula. Datas em ISO UTC (`2026-09-01T03:00:00.000Z`).
- `filter[fields]` e `filter[businessFields]` (campos adicionais): valor com `encodeURIComponent`.
- **Ordenação**: `order[<campo>]=asc` ou `desc`.
- **Totais**: header `x-dz-include-totals: true` pede o total junto com a página.
- **Corpo**: JSON, com `Content-Type: application/json`.
- **Resposta de lista**: `{ data: [...], count }`. Leia `[fonte]data[0].id` e confira vazio antes de usar.
- **Erro**: `{ code, message, params }`. `code: "upgrade-plan"`, `"upgrade-feature"` ou `"usage-limit-reached"` = o plano da conta não libera o recurso.
- ⚠️ **Rota que não existe devolve HTTP `400`**, com o 404 de verdade aninhado: `{ "message": { "message": "Cannot POST /api/crm/…", "error": "Not Found", "statusCode": 404 }, "code": 500, "type": "warning" }` (medido em 06/10/2026). Não leia o status HTTP sozinho: um `400` pode ser caminho errado, não corpo errado — confira `message.statusCode` antes de concluir que o corpo está malformado.

### No bloco API

Métricas do funil por dia (Execução agendada → relatório para o time):

```json
{
  "name": "json-http-request-api",
  "group": "http",
  "options": {
    "url": "https://api.g1.datacrazy.io/api/v1/crm/businesses/metrics/summary/daily",
    "method": "GET",
    "headers": [ { "key": "Authorization", "value": "" }, { "key": "X-TimeZone", "value": "America/Sao_Paulo" } ],
    "query": [
      { "key": "filter[pipelines]", "value": "[PREENCHER ID da pipeline]" },
      { "key": "filter[startDate]", "value": "{Data início|[data-inicio]formatted.dateTime}" },
      { "key": "filter[endDate]", "value": "{Data fim|[data-fim]formatted.dateTime}" }
    ],
    "body": "",
    "retryCount": 3,
    "retryIntervalSeconds": 30,
    "responseHeadersOverrides": [],
    "datasourceName": "dc-funil-diario",
    "datasourceColor": "#22c55e"
  }
}
```

Os nomes dos filtros de métricas vieram do front (`pipelines`, `status`, `dateStrategy`, período). Confira a resposta na inspeção da sessão antes de montar a mensagem.

### No JavaScript

Mesmo Padrão Oficial do KB-03. Copie o auxiliar inteiro em cada bloco:

```js
// ##CONFIG##
const TOKEN_DATACRAZY = ""; // Pendência: colar a chave (Configurações › Chaves de API)
const BASE_DATACRAZY = "https://api.g1.datacrazy.io/api/v1";

// Rota interna migrada: servico = "crm" | "messaging" | "accounts".
async function dcInterna(servico, caminho, { method = "GET", query = {}, filter = {}, order = {}, body = null } = {}) {
  const params = { ...query };
  Object.entries(filter).forEach(([k, v]) => { if (v !== undefined && v !== null && v !== "") params[`filter[${k}]`] = Array.isArray(v) ? v.join(",") : v; });
  Object.entries(order).forEach(([k, v]) => { params[`order[${k}]`] = v; });
  const qs = Object.entries(params).map(([k, v]) => `${encodeURIComponent(k)}=${encodeURIComponent(v instanceof Date ? v.toISOString() : v)}`).join("&");
  const resposta = await fetch(`${BASE_DATACRAZY}/${servico}${caminho}${qs ? "?" + qs : ""}`, {
    method,
    headers: { Authorization: `Bearer ${TOKEN_DATACRAZY}`, "Content-Type": "application/json", "X-TimeZone": "America/Sao_Paulo" },
    body: body ? JSON.stringify(body) : undefined
  });
  const texto = await resposta.text();
  let dados = null;
  try { dados = texto ? JSON.parse(texto) : null; } catch (e) { dados = texto; }
  if (!resposta.ok) throw new Error(`Datacrazy ${method} /${servico}${caminho} → ${resposta.status}: ${dados?.message ?? dados?.code ?? texto}`);
  return dados;
}
```

### Exemplo: distribuir só para quem está online

```js
// ##CONFIG##
const TOKEN_DATACRAZY = ""; // Pendência
const BASE_DATACRAZY = "https://api.g1.datacrazy.io/api/v1";
// (auxiliar dcInterna() da seção 4)

try {
  if (!TOKEN_DATACRAZY) throw new Error("Chave da API do Datacrazy não configurada");
  const conversa = await session.getValue("conversationId");
  if (!conversa) throw new Error("Sessão sem conversa");

  const online = await dcInterna("crm", "/presence/online");
  const lista = Array.isArray(online) ? online : (online?.data ?? []);
  if (!lista.length) return { sucesso: true, erro: false, dados: { atribuido: false, motivo: "ninguém online" } };

  const escolhido = lista[Math.floor(Math.random() * lista.length)];
  const attendantId = escolhido?.attendantId ?? escolhido?.id;
  if (!attendantId) throw new Error("Resposta de presença sem ID de atendente");

  await dcInterna("messaging", `/conversations/${conversa}/change-attendant`, { method: "POST", body: { attendantId } });
  return { sucesso: true, erro: false, dados: { atribuido: true, attendantId } };
} catch (error) {
  return { sucesso: false, erro: true, mensagem: "Falha ao distribuir para atendente online", debug: error?.message || null };
}
```

O formato da resposta de `/presence/online` não está no código do front de forma legível: o exemplo lê `attendantId` ou `id`. Confira na inspeção da sessão no primeiro teste.

---

## 5. Catálogo de rotas

Caminhos relativos a `https://api.g1.datacrazy.io/api/v1`. `{id}` e afins vão na URL. Corpos entre chaves foram confirmados no código do front. Onde não há corpo, confira na inspeção antes de usar. Todas são 🟡, salvo marcação.

### 5.1 CRM (`/crm`)

**Leads**

| Método | Caminho | Faz | Corpo / query |
|---|---|---|---|
| GET | `/crm/leads` | Lista leads | `skip`, `take`, `search`, `filter[…]` |
| POST | `/crm/leads/count` | Conta leads de um filtro | filtro no corpo |
| GET | `/crm/leads/{id}` | Um lead | — |
| POST · PATCH · PUT | `/crm/leads` · `/crm/leads/{id}` | Cria · atualiza | Prefira a ação nativa ou o KB-07 |
| DELETE | `/crm/leads/{id}` | Exclui o lead ⚠️ | — |
| POST | `/crm/leads/actions/add-to-lists` | Põe leads em listas | `{ "leadIds": [], "listIds": [] }` |
| POST | `/crm/leads/actions/remove-from-lists` | Tira leads de listas | `{ "leadIds": [], "listIds": [] }` |
| GET | `/crm/leads/contact/{plataforma}/{contactId}` | Lead pelo contato do canal | — |
| POST | `/crm/leads/{id}/verify-email` · `/verify-phone` | Valida e-mail · telefone | — |
| GET | `/crm/leads/document-masks/{país}` | Máscaras de documento | — |
| POST | `/crm/leads/export` · `/crm/imports` | Exporta · importa ⛔ | — |

**Negócios**

| Método | Caminho | Faz | Corpo / query |
|---|---|---|---|
| GET | `/crm/businesses` | Lista negócios | `skip`, `take`, `filter[…]` |
| GET · PATCH | `/crm/businesses/{id}` | Um negócio · atualiza | — |
| DELETE | `/crm/businesses/{id}` | Exclui ⚠️ | — |
| POST | `/crm/businesses/actions/move` | Move | `{ "ids": [], "destinationStageId": "" }` |
| POST | `/crm/businesses/actions/won` | Ganha | `{ "ids": [], "wonDate": "ISO" }` |
| POST | `/crm/businesses/actions/loss` | Perde | `{ "ids": [], "lossReasonId": "", "justification": "", "lostDate": "ISO" }` |
| POST | `/crm/businesses/actions/restore-status` | Restaura | `{ "ids": [] }` |
| POST | `/crm/businesses/actions/{pipelineId}/move-selected` | Move os selecionados da pipeline | `{ "ids": [], "destinationStageId": "" }` |
| POST | `/crm/businesses/actions/{pipelineId}/move-all` | Move **todos** do filtro ⚠️ | `{ "destinationStageId": "" }` + filtro na query |
| POST | `/crm/businesses/actions/delete` · `/{pipelineId}/delete-all` | Exclui em massa ⛔ | `{ "ids": [] }` |
| GET | `/crm/business/movements` | Movimentações entre etapas | filtros na query |
| GET | `/crm/businesses/metrics/summary/daily` | Funil por dia | `filter[pipelines]`, período, `filter[dateStrategy]` |
| GET | `/crm/businesses/metrics/summary/daily/won` · `/daily/lost` · `/daily/pending` | Ganhos · perdidos · pendentes por dia | idem |
| GET | `/crm/businesses/metrics/summary/attendants` | Resultado por atendente | `filter[pipelines]`, `filter[status]`, `filter[dateStrategy]` |
| GET | `/crm/businesses/metrics/summary/products` | Resultado por produto | idem |
| GET | `/crm/businesses/metrics/summary/lost/reason` | Perdas por motivo | idem |

**Pipelines, atividades e cadastros**

| Método | Caminho | Faz |
|---|---|---|
| GET | `/crm/pipelines` · `/crm/pipelines/{id}` · `/crm/pipelines/groups` · `/crm/pipelines/favorites` | Pipelines |
| GET | `/crm/pipelines/{id}/stages` · `/crm/pipelines/stages` · `/crm/pipelines/stages/{id}` | Etapas |
| POST | `/crm/pipelines/{id}/stages` | **Substitui** as etapas da pipeline ✅ ⚠️ — o corpo é um **array**, logo abaixo |
| GET | `/crm/pipelines/{id}/stages/businesses` | Negócios agrupados por etapa |
| POST | `/crm/pipelines` | Cria pipeline ✅ ⚠️ — corpo e resposta logo abaixo |
| DELETE | `/crm/pipelines/{id}` | Exclui a pipeline e as etapas dela ✅ ⚠️ (`200`, corpo vazio) |
| PUT | `/crm/pipelines/{id}` | Edita a pipeline ✅ ⚠️ — **merge**, logo abaixo. Duplicar **não tem rota** |
| GET · POST | `/crm/activities` | Lista · cria atividade |
| GET · PATCH · DELETE | `/crm/activities/{id}` | Uma atividade (DELETE ⚠️) |
| POST | `/crm/activities/{id}/complete` · `/cancel-completion` | Conclui · reabre |
| GET · POST · PATCH · DELETE | `/crm/activities/types` · `/crm/activities/types/{id}` | Tipos de atividade (escrita ⚠️) |
| GET | `/crm/activities/metrics/summary/period` · `/attendants` · `/activity-types` | Métricas de atividades |
| GET · POST · PUT · DELETE | `/crm/stage-activities/{etapaId}` | Atividades automáticas da etapa (escrita ⚠️) |
| GET · POST · PUT · DELETE | `/crm/tags` · `/crm/tags/{id}` | Tags (DELETE ⚠️) |
| GET · POST · PUT · DELETE | `/crm/lists` · `/crm/lists/{id}` | Listas (DELETE ⚠️) |
| GET · POST · PUT · DELETE | `/crm/products` · `/crm/products/{id}` | Produtos (DELETE ⚠️) |
| GET · POST · PUT · DELETE | `/crm/business-loss-reasons` · `/{id}` | Motivos de perda (DELETE ⚠️) |
| GET · POST · PATCH · DELETE | `/crm/segments` · `/crm/segments/{id}` | Segmentos salvos (DELETE ⚠️) |
| GET | `/crm/additionalFields` · `/{id}` · `/groups` · `/{id}/flows-using` | Campos adicionais, parâmetros do sistema (`filter[entity]=company`) e quais fluxos usam cada um |
| GET · POST · PUT · DELETE | `/crm/additional-fields/{entidade}/{…}` | Valores de campos adicionais. Parâmetros do sistema: `/crm/additional-fields/company/{idDaConta}` (seção 5.1.1) |
| GET · POST | `/crm/additionalFields/system-parameters/export` · `/import` | Exporta · importa os parâmetros do sistema em JSON (a tela usa; escrita ⚠️) |
| GET · POST · PUT · DELETE | `/crm/attachments/{entidade}/{id}` · `/{anexoId}` | Anexos de lead ou negócio (DELETE ⚠️) |
| GET | `/crm/history` · `/crm/history/{id}` | Histórico |
| POST · PUT | `/crm/history/{…}/{…}/note` · `/crm/history/note/{id}` | Cria · edita anotação |
| GET | `/crm/attendants` · `/crm/attendants/{id}` · `/crm/attendant-history/{id}` | Atendentes e histórico de atribuição |
| GET | `/crm/presence/online` | Quem está online |
| GET | `/crm/address/search/{cep}` · `/crm/address/validate/{cep}` · `/crm/address/countries` | CEP, validação e países |

**Criar pipeline** ⚠️ — `POST /crm/pipelines`

✅ **Medida** em 06/10/2026: a **chave da conta** cria pipeline no endereço público, `201` com a pipeline no corpo. No mesmo teste também responderam com a chave: `GET /crm/pipelines/groups`, `GET /crm/pipelines/{id}/stages`, `POST /crm/pipelines/{id}/stages` e `DELETE /crm/pipelines/{id}`.

```json
{ "name": "Vendas", "description": "Funil comercial", "group": "Padrão" }
```

Resposta com a pipeline criada, no primeiro nível (sem envelope `data`):

```json
{
  "id": "1a47a09f-70ef-45ae-bc3b-0f96ad26764b",
  "createdAt": "2026-10-06T00:09:38.170Z",
  "updatedAt": "2026-10-06T00:09:38.170Z",
  "groupChanged": false,
  "name": "ola",
  "description": "234",
  "group": "Padrão",
  "tenantId": "00000000-0000-4000-8000-000000000000",
  "groupOrder": 4,
  "order": 2
}
```

- Os três campos do corpo bastam. `group` é o **nome** do grupo, não um ID: pegue os nomes em `GET /crm/pipelines/groups`. Um nome que ainda não existe cria o grupo.
- `id`, `order`, `groupOrder`, `tenantId` e `groupChanged` vêm calculados pelo CRM. Não mande nenhum deles; use o `id` da resposta nas etapas e nos blocos.
- A resposta **não traz etapas**, e `GET /crm/pipelines/{id}/stages` logo depois devolveu `{ count: 0, data: [] }`: a pipeline nasce vazia, sem etapas padrão. Crie-as em seguida com `POST /crm/pipelines/{pipelineId}/stages` (logo abaixo), numa única chamada com todas elas.
- O front manda também `x-signature`, `x-user-id` e `x-user-email`. **Não são necessários**: a chamada com a chave da conta, sem nenhum dos três, respondeu `201`.
- O `group` casa por nome **exato**, sem normalizar acento: numa conta que tem `Padrão`, mandar `Padrao` cria um grupo novo. Pegue os nomes crus em `GET /crm/pipelines/groups`, que devolve `{ count: { count: N }, data: [{ group }] }` — repare no `count` aninhado.
- Grupo não é registro próprio: ele some da lista junto com a última pipeline dele. `group: ""` não foi testado.
- ⚠️ **Nome repetido é aceito** (medido): dois `POST` com o mesmo `name` e o mesmo `group` criaram duas pipelines, a segunda com `order: 2`. Diferente do import, que bloqueia nome repetido. Confira em `GET /crm/pipelines` antes de criar, e **nunca** deixe um retry cego repetir o POST: ele duplica.
- É configuração da conta: só com pedido explícito.

**Criar etapas** ⚠️ — `POST /crm/pipelines/{pipelineId}/stages`

✅ **Medida** com a chave da conta em 06/10/2026, `201`. O corpo é um **array**, não um objeto:

```json
[{ "name": "Novo", "color": "#3B82F6" }]
```

Resposta: o array das etapas criadas, cada uma com o `id` e o `index`.

```json
[
  {
    "id": "a054b932-3d74-4df0-9c8c-2f5661fb5e34",
    "createdAt": "2026-10-06T00:35:51.005Z",
    "name": "Novo",
    "color": "#3B82F6",
    "index": 0,
    "activitiesCount": 0
  }
]
```

- `name` e `color` bastam. O `index` vem calculado: a **ordem do array** é a ordem das etapas no funil. `activitiesCount` é só da resposta.
- ⚠️ **A rota SUBSTITUI, não acrescenta** (medido). Numa pipeline com `Etapa A` (index 0) e `Etapa B` (index 1), um POST com `[{ "name": "Etapa C" }]` deixou **só** a Etapa C, com `index: 0`: `GET` em seguida devolveu `count: 1`. O corpo é a lista completa das etapas da pipeline — é o botão Salvar da tela de etapas, e daí o nome `pipeline_stages_save` da tool MCP.
- **Quem decide é o `id`.** Item **sem** `id` é criado do zero; item **com** `id` é mantido. Medido — numa pipeline com `Alfa` e `Beta`, um POST com `[Alfa, Beta, Gama]` só por nome e cor devolveu **`id` novo para as três**: sem o `id`, Alfa e Beta foram apagadas e recriadas. Mandando os ids, elas ficam: numa pipeline com `A` e `B`, um POST com `[A (com id), B (com id), C]` devolveu **os mesmos ids** para A e B e criou só a C (medido em 06/10/2026, com a chave da conta, numa pipeline temporária).
- Para **acrescentar** etapa numa pipeline que já existe: leia as etapas (`GET /pipelines/{id}/stages`), mande **todas com o `id`** e as novas sem, na ordem do funil, e leia de novo para conferir que os ids antigos continuam. Nunca mande a lista só por nome: os negócios parados nas etapas recriadas perdem a referência.
- **Não medido:** se uma etapa tem atividade configurada (`activitiesCount > 0`), não se sabe se reenviar a lista preserva as atividades dela. Nesse caso, use a interface.
- Em pipeline recém-criada não há risco nenhum: ela está vazia.

**Editar e excluir pipeline** ⚠️ — `PUT /crm/pipelines/{id}` · `DELETE /crm/pipelines/{id}`

✅ Medidas com a chave da conta em 06/10/2026.

- O `PUT` é **merge**, não substituição: mandei `{ "name": "..." }` sozinho e a `description` e o `group` ficaram como estavam. Responde `200` com a pipeline inteira — e aí aparecem campos que o POST não mostra: `stagesCount`, `deletedAt` e `groupChanged` (`true` só quando o grupo mudou de verdade).
- Cuidado com a assimetria: o `PUT` da pipeline faz merge, mas o `POST` das etapas apaga e recria. São rotas vizinhas com contratos opostos.
- O `DELETE` responde `200` com corpo vazio e leva as etapas junto. O `deletedAt` nas respostas indica exclusão lógica, mas a pipeline sai de `GET /crm/pipelines` na hora.
- **Duplicar não tem rota**: `/duplicate` e `/clone` dão 404. Duplicar é coisa da tela — para repetir uma pipeline, leia ela e as etapas e recrie com os dois POST.

**Automações (flows)**

| Método | Caminho | Faz | Corpo |
|---|---|---|---|
| POST | `/crm/flows/triggers/leads/execute-lead` | Executa uma automação de **execução manual** para um lead | `{ "flowId": "", "leadId": "", "contact": { … } }` |
| GET | `/crm/flows/triggers/leads` | Automações disparáveis por lead | — |
| POST | `/crm/flows/triggers/{id}/execute` | Executa o gatilho de uma automação | corpo do gatilho |
| GET · POST | `/crm/flows/triggers/activities` · `/execute` | Gatilhos de atividade | — |
| GET | `/crm/flows` · `/crm/flows/{id}` · `/crm/flows/groups` | Automações e grupos. `/crm/flows/{id}` traz `activeVersion.id`, sem os blocos | — |
| GET | `/crm/flows/{id}/versions/{versão}` | Blocos e anotações da versão ✅ | — |
| PATCH | `/crm/flows/{id}/versions/{versão}` | **Salva a versão**: é o botão Salvar do editor ✅ ⚠️ | `{ "blocks": [], "notes": [] }`, no formato do GET da versão |
| POST | `/crm/flows/{id}/versions/{versão}/block` | Cria um bloco e devolve o `id` ✅ ⚠️ | `{ "type", "presentation", "options" }` |
| POST | `/crm/flows/{id}/versions/{versão}/blocks/paste` | Cola blocos ✅ ⚠️ | a confirmar |
| GET | `/crm/flows/{id}/versions/{versão}/datasources/{nome}` | Amostra da fonte de dados ✅ | — |
| GET | `/crm/flows/{id}/versions/{versão}/metrics` · `/logs` | Contadores e logs. Nos eventos de erro, os logs trazem `statusCode`, `url` e o corpo do erro ✅ | — |
| GET | `/crm/flow-sessions/{id}/history` · `/details` | Histórico e detalhes de uma sessão. `/details` traz fontes de dados, resultado da tool MCP e os campos adicionais **com o valor real**: mascare antes de exibir ✅ | — |
| POST | `/crm/flow-sessions/{id}/reprocess` | Reprocessa uma sessão ⚠️ | — |
| GET · POST | `/crm/flows/parameters` · `/crm/flows/parameters/resolve` | Parâmetros de fluxo | — |
| POST | `/crm/flows/{id}/versions/{versão}/export-automation` | Exporta o JSON, com o que o usuário editou na tela ✅ | — |
| POST | `/crm/flows` | **Cria a automação** ✅ ⚠️. Responde `201` com o fluxo e já cria a versão 1 com um bloco `trigger` vazio em (0,0) | `{ "name", "description", "group", "active", "imageUrl", "loopLevel" }` |
| PATCH | `/crm/flows/{id}` | Edita (inclui ativar/desativar) ⚠️ | — |
| DELETE | `/crm/flows/{id}` | Exclui automação ⛔. **A rota funciona** (medido em 06/10/2026, numa automação criada só para o teste): responde `200` e o fluxo sai da listagem, levando versões e blocos. O ⛔ aqui é o do topo desta página — *não use sem pedido explícito* — e não "a rota não existe". Com pedido: confirme o nome com o usuário antes, porque não há desfazer | — |
| GET · POST | `/crm/boosts…` | Impulsos: lista, progresso, métricas · iniciar, pausar ⚠️ | — |

`contact` do execute-lead: o front manda o contato da conversa (plataforma e ID do contato). Confirme o formato na primeira execução.

**Criar uma automação pela API** ⚠️ (medido em 06/10/2026; só com pedido explícito):

1. `POST /crm/flows` com `{ name, description, group, active: false, imageUrl, loopLevel }` → `201` com o `id`.
   Publique sempre com `active: false`: quem ativa é o usuário, depois de conferir.
2. `GET /crm/flows/{id}` → `activeVersion.id`.
3. `PATCH /crm/flows/{id}/versions/{versão}` com `{ blocks, notes }`. O bloco `trigger` vazio que
   nasce com a versão é substituído pelo que você mandar — reaproveite o `id` dele ou mande o seu.

- O `name` **não** é checado contra os existentes: dois POST com o mesmo nome criam duas automações.
  Diferente do import, que casa pelo nome e marca "Existente". Confira antes com `GET /crm/flows`.
- **Várias automações de uma vez**: faça o passo 1 de **todas** antes do passo 3 de qualquer uma. A
  ação "Iniciar outra automação" guarda o id da automação em `options.automationId`; como o CRM dá
  um id novo a cada fluxo, só depois de ter todos é que dá para reescrever essas referências. Uma a
  uma, quem chama fica apontando para um id que não existe na conta.
- Se o passo 1 falhar no meio, as que entraram ficam **vazias** na conta. Apague antes de repetir.

**Editar uma automação pela API** ⚠️ (o mesmo caminho do botão Salvar; só com pedido explícito):

1. `GET /crm/flows/{id}` → `activeVersion.id`.
2. `GET /crm/flows/{id}/versions/{versão}` → `blocks` e `notes`. **Guarde uma cópia em arquivo**: é o backup para desfazer.
3. Bloco novo: `POST …/versions/{versão}/block` com `{ type, presentation, options }`. O CRM devolve o `id`.
4. Troque as ligações (`nextBlockId`, `errorNextBlockId`) e o texto que precisa mudar.
5. `PATCH /crm/flows/{id}/versions/{versão}` com `{ blocks, notes }` completos, no formato do GET.
6. `GET` de novo e confira a quantidade de blocos e anotações e as ligações.

- O PATCH altera a automação **em produção**: se ela está ativa, a próxima execução já usa a versão nova.
- Para desfazer, mande o backup no mesmo PATCH.
- Para diagnosticar sem mexer: `/logs` mostra o `statusCode`, a `url` e o corpo dos erros de API; `…/datasources/{nome}` mostra a amostra da fonte de dados.
- ⚠️ `/crm/flow-sessions/{id}/details` traz os campos adicionais e parâmetros Texto lidos no fluxo com o **valor real**, tokens incluídos. Mascare antes de mostrar, copiar ou gravar. Parâmetro **Secreto** não entra na sessão (medido em 08/10/2026, KB-03, seção 4.2).

**Não use (⛔)**: `/crm/integrations…`, `/crm/import-export…`, `/crm/importations…`, `/crm/google-calendar…`, `/crm/device-notifications…`, `/crm/notifications…` (são do usuário logado), `/crm/sync…`.

#### 5.1.1 Parâmetros do sistema (tela `crm.datacrazy.io/config/system-parameters`)

Lido do código da tela e testado com a chave de API em 11/10/2026. Leitura e criação ✅ funcionam pela chave em `https://api.g1.datacrazy.io/api/v1/crm/…`.

| Método | Caminho | Faz | Corpo |
|---|---|---|---|
| GET ✅ | `/crm/additionalFields?filter[entity]=company&take=500` | Lista os parâmetros (sem valor) | — |
| GET ✅ | `/crm/additional-fields/company/{idDaConta}?take=500` | Valores: `data[]` com `additionalField`, `value`, `valueNumber`, `valueDate` e `hasSecretValue` | — |
| POST ✅ ⚠️ | `/crm/additionalFields` | **Cria o parâmetro já com o valor**. Devolve 201 com o parâmetro | ver abaixo |
| PUT ⚠️ | `/crm/additionalFields/{id}` | Edita nome, descrição e valor | mesmo corpo |
| DELETE ⛔ | `/crm/additionalFields/{id}` | Exclui | — |
| GET ✅ | `/crm/additionalFields/{id}/flows-using` | Fluxos que usam o parâmetro: `{ flows: [{ id, name, active, blocksCount }], totalBlocks }` | — |
| GET ✅ | `/crm/additionalFields/system-parameters/export` | `{ data: { additionalFields: [ … ] } }` **com o valor em claro** dos parâmetros Texto | — |
| POST ⚠️ | `/crm/additionalFields/system-parameters/import` | Importa. A tela manda primeiro `{ data: { additionalFields: [ … ], options: { dryRun: true } } }` para pré-visualizar | — |

Corpo da criação e da edição, exatamente como a tela monta:

```json
{
  "name": "Token Sistema",
  "description": "",
  "type": "string",
  "entity": "company",
  "isPublic": false,
  "additionalConfigs": { "secret": true },
  "value": "<o token>"
}
```

- O exemplo acima cria um **Secreto**. Para um cache (KB-04, seção 14), crie **Texto**: o mesmo corpo sem `additionalConfigs` e com `"value": "{}"`.
- Tipos da tela → `type`: Texto `string`, Número `number`, Data `date`, Data e hora `datetime`, Hora `time`, Booleano `boolean` (valor `"true"`/`"false"` em texto), **Secreto `string` + `additionalConfigs: { secret: true }`**. Fora do Secreto, mande `additionalConfigs` ausente.
- O **`idDaConta`** não vem na automação nem no lead: a tela usa a empresa logada (`accounts…/companies/{id}`). Pegue da tela uma vez e guarde junto das configurações do cliente.
- Na **edição de um Secreto**, a tela omite `value` quando o campo fica vazio, para não apagar o segredo. Faça igual.
- O `GET` de valores e o `export` trazem **o valor real** de parâmetros Texto (tokens incluídos). Mascare antes de exibir ou gravar.
- O `POST` aceita também `"group": "Nome do grupo"` (a tela não manda; o parâmetro fica no grupo informado).
- ⛔ **Texto não vira Secreto.** O `PUT` com `additionalConfigs: { secret: true }` num parâmetro Texto devolve 400 `system-parameter-type-cannot-be-changed` e não altera nada (11/10/2026). Para ter o Secreto, crie outro parâmetro (outro nome, ou apague e recrie) e troque o nome nos blocos que o leem. Por isso, **crie token já como Secreto**.
- O `flows-using` conta só os blocos que usam a interpolação `{nome|additional-field[nome]}`. `session.getAdditionalValue("nome")` no JavaScript não entra na contagem: procure o nome no JSON da versão.
- O `type` não pode mudar depois que um fluxo usa o parâmetro (`additional-field-type-locked`). Nome repetido devolve erro com "already exists".

### 5.2 Messaging (`/messaging`)

**Conversas**

| Método | Caminho | Faz | Corpo / query |
|---|---|---|---|
| GET | `/messaging/conversations` | Lista conversas | `skip`, `take`, `search`, `filter[…]` |
| GET | `/messaging/conversations/count` | Conta conversas | `filter[…]`, `search` |
| GET · PUT | `/messaging/conversations/{id}` | Uma conversa · atualiza | — |
| DELETE | `/messaging/conversations/{id}` | Exclui ⛔ | — |
| POST | `/messaging/conversations` | Cria conversa | `{ "name", "instanceId", "isGroup": false, "imageURL", "contact": { "name", "contactId", "platform", "imageURL", "externalId" } }` |
| GET | `/messaging/conversations/platform` | Conversa pelo contato | `platform`, `contactId` |
| GET | `/messaging/conversations/instance` | Conversa do contato numa conexão | `instanceId`, `contactId` |
| POST | `/messaging/conversations/find-best-by-contact` | Melhor conversa do contato | `{ "contactId", "platform", "preferredInstanceId", "contactName", "contactImageURL" }` |
| POST | `/messaging/conversations/{id}/finish` · `/reopen` · `/mark-read` | Finaliza · reabre · marca como lida | — |
| POST | `/messaging/conversations/{id}/change-attendant` | Troca o atendente | `{ "attendantId": "" }` |
| POST | `/messaging/conversations/{id}/department/{departmentId}` | Troca o departamento | — |
| PATCH | `/messaging/conversations/{id}/toggle-automation` | Liga ou desliga automações de chat | objeto da conversa |
| PATCH | `/messaging/conversations/{id}/archive` | Arquiva | `{ "archived": true }` |
| POST | `/messaging/conversations/{id}/merge` | Une conversas ⚠️ | — |
| DELETE | `/messaging/conversations/{id}/unlink-lead` | Desvincula o lead ⚠️ | — |

**Em lote** (⚠️ agem em muitas conversas; exija pedido explícito):

| Método | Caminho | Corpo |
|---|---|---|
| POST | `/messaging/conversations/start-automation` | `{ "conversationsId": [], "flowId": "", "filter": {} }` |
| POST | `/messaging/conversations/change-attendant` | `{ "conversationsId": [], "attendantId": "", "filter": {} }` |
| POST | `/messaging/conversations/department` | `{ "conversationsId": [], "departmentId": "", "filter": {} }` |
| POST | `/messaging/conversations/finish-all` | `{ "conversationsId": [], "filter": {} }` |

> ⚠️ `start-automation` responde `null` e **não dispara** automação com gatilho "Iniciado por outra automação" (24/10/2026). Qual gatilho ela aciona ainda não foi medido: antes de usar em lote, teste com uma conversa e confira se a automação de destino abriu sessão. Para testar um subfluxo, crie um gatilho de teste (ex.: mensagem recebida "#comando" → Iniciar outra automação).

**Mensagens**

| Método | Caminho | Faz | Corpo / query |
|---|---|---|---|
| GET | `/messaging/conversations/{id}/messages` | Mensagens da conversa | `skip`, `take` |
| GET | `/messaging/conversations/{id}/messages/count` | Quantidade | — |
| POST | `/messaging/conversations/{id}/messages/send` | Envia mensagem | corpo a confirmar; prefira o bloco Mensagem ou o KB-07 |
| PATCH | `/messaging/conversations/messages/{id}` | Edita mensagem | `{ "text": "" }` |
| DELETE | `/messaging/conversations/messages/{id}` | Apaga mensagem ⚠️ | — |
| GET | `/messaging/conversations/scheduled/messages` | Mensagens agendadas | — |
| DELETE | `/messaging/conversations/{id}/scheduled-message/{mensagemId}` | Cancela uma agendada | — |
| POST | `/messaging/conversations/forward` | Encaminha | — |

**Conexões, departamentos, horários e modelos**

| Método | Caminho | Faz |
|---|---|---|
| GET | `/messaging/instances` · `/messaging/instances/{id}` · `/{id}/flows-using` | Conexões e quais fluxos usam cada uma |
| GET | `/messaging/instance-throughput/{id}` | Volume da conexão |
| GET | `/messaging/uazapi/connection/status/{id}` · `/evolution-api/…/status/{id}` · `/z-api/…/status/{id}` · `/crazy-api/…/status/{id}` | Status no provedor |
| GET · POST · PUT · DELETE | `/messaging/departments` · `/{id}` | Departamentos (escrita ⚠️) |
| GET · POST | `/messaging/departments/attendants/{departmentId}/attendants` | Atendentes do departamento |
| GET · POST · PUT · DELETE | `/messaging/working-hours` · `/{id}` | Horários de atendimento (escrita ⚠️) |
| GET | `/messaging/templates` · `/messaging/template/{id}` | Mensagens rápidas |
| GET · POST | `/messaging/whatsapp-cloud/templates/{instanceId}` | Lista e **cria** templates da API Oficial (ver §5.2.1) |
| POST | `/messaging/whatsapp-cloud/templates/send` | Envia template (corpo a confirmar; prefira o bloco Mensagem) |
| GET · PATCH | `/messaging/contacts` · `/messaging/contacts/{id}` | Contatos |
| GET | `/messaging/attendants` | Atendentes do multiatendimento |
| GET | `/messaging/threads/metrics/summary` · `/attendants` · `/departments` · `/hours` · `/instances` · `/period` · `/response` | Métricas de atendimento |

**Não use (⛔)**: conectar, desconectar, reiniciar ou gerar QR code (`…/connection/start|stop|restart|disconnect|qr-code…`), criar ou excluir conexão, excluir template da API Oficial, `/messaging/auth…`, `/messaging/attendant-permissions…`, `/messaging/multiservice-configs`, `/messaging/instances/{id}/migrate`, `/messaging/instances/{id}/restore-messages`.

#### 5.2.1 Criar template da Meta pelo CRM

Confirmado em 21/10/2026 em duas contas (POST com a chave de API → 201 `PENDING`). É ação de **script, sob pedido explícito** (nunca bloco API dentro de automação): cada envio vai para a análise da Meta.

- **Listar:** `GET https://api.g1.datacrazy.io/api/v1/messaging/whatsapp-cloud/templates/{instanceId}` → `[{ name, status (PENDING · APPROVED · REJECTED), category, body.parameters, buttons… }]`. Use antes de criar (pular nome que já existe) e depois para acompanhar a aprovação.
- **Criar:** `POST` na mesma rota, `Authorization: Bearer <chave>`. Corpo igual ao da tela *Novo modelo › JSON*:

```json
{
  "name": "adv_a_ia_t1",
  "category": "marketing",
  "parameter_format": "positional",
  "language": "pt_BR",
  "components": [
    { "type": "body", "text": "Dr(a). {{1}}, o {{2}} já responde cliente fora do horário?",
      "example": { "body_text": [["João", "Silva Advogados"]] } },
    { "type": "footer", "text": "Datacrazy · IA comercial" },
    { "type": "buttons", "buttons": [
      { "type": "quick_reply", "text": "Quero ver" },
      { "type": "quick_reply", "text": "Sair da lista" } ] }
  ]
}
```

  Resposta `{ id, status: "PENDING", category }`.
- **Pegadinhas:** `components[].type` e `category` em **minúsculas** (maiúsculas dão 400); `instanceId` é o id da conexão no CRM (`GET /messaging/instances`), não o WABA.
- **Regras da Meta (valide antes de enviar):** nome em snake_case minúsculo e único na conta; `marketing` ou `utility`; variáveis `{{1}}…{{n}}` em sequência, nunca no início nem no fim do corpo, nunca duas coladas; um exemplo por variável; corpo ≤ 1024, rodapé ≤ 60, botão de resposta rápida ≤ 25 caracteres; prefira um botão próprio de saída ("Sair da lista") ao opt-out da Meta.
- **Cabeçalho com mídia:** exige `media.handle` do upload resumível da Meta, que hoje só a tela faz (`url: blob:` é local do navegador). Para mídia, crie pela tela.
- Depois de `APPROVED`, use no bloco de template (KB-11) com `id: "<nome>#pt_BR"`.

### 5.3 Accounts (`/accounts`) ⛔

Cobrança (`/billing…`), empresa (`/companies…`), usuários e convites (`/company-users…`), dois fatores (`/users/2fa…`) e perfil (`/users/current-user`). São dados de conta e segurança: **não use em automação**. Leitura de apoio, só com pedido explícito: `GET /accounts/company-users` (usuários da conta) e `GET /accounts/companies/current` (dados da empresa).

---

## 6. Receitas

| Necessidade | Montagem |
|---|---|
| **Rodar outra automação para outro lead** (indicação, contato secundário) | JavaScript: busca o lead (KB-07 `GET /leads?search=`) → `POST /crm/flows/triggers/leads/execute-lead` com `flowId` de uma automação com gatilho de execução manual. |
| **Relatório diário do funil no grupo do time** | Execução agendada diária → Formatação de data (ontem 03:00Z e hoje 03:00Z) → API `GET /crm/businesses/metrics/summary/daily` → JavaScript monta o texto → Mensagem com `contactId` do grupo. |
| **Distribuir só para atendentes online** | Mensagem recebida → JavaScript (seção 4) → condição em `[Javascript-…]dados.atribuido`: falso vai para a fila padrão. |
| **Completar endereço pelo CEP** | API `GET /crm/address/search/{CEP\|leadZip}` → Mapeamento em `leadCity`, `leadState`, `leadAddress`. |
| **Reengajar conversas esperando** | Execução agendada → JavaScript: `GET /messaging/conversations` com `filter[status]=waiting` → `POST /messaging/conversations/start-automation` com os IDs e o `flowId` de follow-up. ⚠️ em lote, e a automação de follow-up não pode depender só do gatilho "Iniciado por outra automação" (a rota não a dispara); teste com uma conversa antes. |
| **Alerta de conexão caída** | Execução agendada (30 min) → API `GET /messaging/uazapi/connection/status/{id}` (ou o do provedor) → condição → Enviar notificação. |

---

## 7. Migrar uma integração que já usa rota interna

1. Procure `crm.g1.datacrazy.io`, `messaging.g1.datacrazy.io` e `accounts.g1.datacrazy.io` nos blocos API, nos códigos JavaScript e nos sistemas de fora (n8n, Make, scripts).
2. Troque pelo endereço da seção 1, mantendo o caminho. Ex.: `…crm.g1.datacrazy.io/api/crm/leads/count` vira `…api.g1.datacrazy.io/api/v1/crm/leads/count`.
3. Troque o token de sessão pela chave da API da conta.
4. **Não mexa** em URLs de webhook.
5. Teste cada chamada antes da release e confira a resposta na inspeção da sessão.

O canvas de entrega já aponta rota interna como **erro**, com o endereço novo na mensagem.

---

## 8. Erros comuns

1. **Domínio interno** (`crm.g1`, `messaging.g1`, `accounts.g1`): para de funcionar na release.
2. **Esquecer o `/crm` ou o `/messaging`** depois de `/api/v1`: cai num endpoint documentado diferente, ou em 404.
3. **Misturar formatos**: caminho do KB-07 com corpo da rota interna, ou o contrário.
4. **Token de sessão copiado do navegador**: expira e expõe o usuário.
5. **Migrar URL de webhook**: webhooks não mudam.
6. **Rota em lote sem pedido** (`move-all`, `finish-all`, `start-automation`): age sobre muita coisa de uma vez.
7. **Usar rota de `accounts`, `agentic` ou `mcp`** em automação.
8. **Ler a resposta sem conferir** o formato na inspeção da sessão: as rotas internas não têm contrato publicado.
9. **PATCH da versão sem backup**: altera a automação em produção, e sem a cópia não há o que restaurar.
10. **Exibir `/flow-sessions/{id}/details` sem mascarar**: os campos adicionais vêm com o valor real.
