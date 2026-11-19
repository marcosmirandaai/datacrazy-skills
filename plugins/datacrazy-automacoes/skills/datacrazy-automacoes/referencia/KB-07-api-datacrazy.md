# KB-07 — API do Datacrazy (REST pública)

Todos os endpoints da API pública do CRM Datacrazy e como chamá-los de dentro de uma automação, pelo **bloco API** (KB-16) ou pelo **bloco JavaScript** (KB-19). Com ela, o fluxo consulta e altera dados que os blocos nativos não alcançam.

Fontes:
- a especificação OpenAPI oficial (`https://api.datacrazy.io/v1/api/openapi/v1/json`) e a documentação `docs.datacrazy.io` (set/2026): 69 endpoints;
- as automações reais exportadas, que já chamam a API para anexar notas fiscais ao lead e consultar a conexão;
- chamadas medidas em 05/10/2026 numa conta real, com a chave da conta (seção 9.1).

Níveis usados aqui:
- ✅ **Produção**: chamada vista em automações reais.
- ✅ **Medida** (com a data): chamada feita com a chave de uma conta real e resposta conferida. Quando diverge da especificação, vale a medida.
- 🟡 **Documentada**: está na especificação oficial, não apareceu num fluxo exportado e não foi medida. Pode usar; registre a Pendência "testar a chamada antes de ativar".

---

## 1. Quando usar a API do Datacrazy

**Regra**: bloco nativo primeiro (Ações, Condições, Operações de campos). A API do Datacrazy entra quando o fluxo precisa de algo que nenhum item do KB-02 faz:

| O fluxo precisa… | Endpoint | Por que não o nativo |
|---|---|---|
| saber quanto o lead já comprou, o ticket médio ou a data da última compra | `GET /leads/{id}` (`metrics`) | Nenhuma condição lê as métricas do lead. |
| listar os negócios do lead, com status, valor e etapa | `GET /leads/{id}/businesses` | As condições só dizem se existe negócio na pipeline ou na etapa. |
| ganhar, perder, mover ou restaurar **vários** negócios de uma vez, ou negócios que não são o da sessão | `POST /businesses/actions/*` | As ações nativas agem só sobre o negócio da sessão. |
| gravar o **ID externo** ou trocar o lead de um negócio | `PATCH /businesses/{id}` | Não há ação nativa para esses campos. |
| buscar negócios por filtro (status, valor, datas, ID externo, campo adicional) | `GET /businesses` | A condição por ID externo só responde sim ou não. |
| buscar leads por filtro (tags, listas, compras, origem, cidade, campo adicional) | `GET /leads` | Só o gatilho agendado varre a base, e sem filtro. |
| ler o histórico de mensagens de uma conversa (para resumo, auditoria ou IA) | `GET /conversations/{id}/messages` | A IA nativa lê a conversa, mas o fluxo não acessa as mensagens como dado. |
| enviar mensagem ou anotação interna para **outra** conversa, com agendamento | `POST /conversations/{id}/messages` | A Mensagem nativa age sobre a conversa da sessão ou sobre um `contactId`. |
| saber se uma conexão (WhatsApp, Instagram) está conectada | `GET /instances/{id}` (`status`, `isActive`) | Não há condição de status da conexão. |
| descobrir o ID de uma etapa, tag, lista, atendente ou motivo de perda pelo nome | `GET /pipelines/{id}/stages`, `GET /tags`, `GET /lists`, `GET /attendants/crm`, `GET /business-loss-reasons` | O JSON importado não conhece os IDs da conta (seção 2.6). |
| anexar arquivo (PDF, imagem) ao lead ou ao negócio | `POST /leads/{leadId}/attachments`, `POST /business/{businessId}/attachments` | Não há ação nativa de anexo. |
| criar atividade com vínculo a negócio, etapa ou automação e marcar como obrigatória | `POST /activities` | A ação nativa cobre o caso comum (KB-12); use a API para `linkToStage`, `required` e `flow`. |
| contar quantos leads têm uma tag | `GET /tags/{id}/leads-count` | Não há bloco que conte. |

**Não use a API** para o que o nativo faz: criar lead ou negócio da sessão, mover o negócio da sessão, adicionar tag, gravar campo, notificar, mandar mensagem na conversa atual. O nativo não gasta limite de requisições, não depende de chave e aparece nos contadores do bloco.

**Bloco API ou JavaScript?**
- **Uma chamada** com resposta usada adiante → **bloco API** (KB-16). Mais fácil de depurar.
- **Várias chamadas dependentes**, filtro ou cálculo sobre a resposta, paginação, laço sobre vários IDs → **JavaScript** (seção 4). Um bloco em vez de uma cadeia.

---

## 2. Regras de conexão

### 2.1 Endereço

```
https://api.g1.datacrazy.io/api/v1/<recurso>
```

É a única base válida. As rotas internas do CRM (`crm.g1.datacrazy.io/api/crm/…`, `messaging.g1.datacrazy.io/…`, `accounts.g1.datacrazy.io/…`) deixam de funcionar na próxima release e passam a responder no mesmo host, em `/api/v1/crm/…`, `/api/v1/messaging/…` e `/api/v1/accounts/…`. Catálogo, regra e quando usar: **KB-08**.

### 2.2 Autenticação

- Header `Authorization: Bearer <chave>`. A chave é criada em **Configurações › Chaves de API** (`crm.datacrazy.io/config/api`), aparece uma vez só e pode ter data de expiração.
- **Nunca** escreva a chave no JSON, no código ou no chat. No bloco API, deixe `value: ""`; no JavaScript, a constante `TOKEN_DATACRAZY = ""`. As duas viram Pendência: "colar a chave da API do Datacrazy".
- Com várias chamadas no mesmo fluxo, guarde a chave num **parâmetro do sistema do tipo Secreto** e leia de lá: `Bearer {Chave_API|additional-field[Chave_API]}` (KB-16, seção 5; KB-03, seção 4.2). Troca num lugar só e o valor não aparece na sessão. Declare em `data.additionalFields` e registre a Pendência "criar o parâmetro Secreto Chave_API e colar a chave".
- Nos POST, PUT e PATCH, inclua `Content-Type: application/json`.

### 2.3 Limite de requisições

- **60 requisições por minuto por rota.** `GET /conversations` aceita só **20 por minuto**.
- Passou do limite: resposta **429** com o header `Retry-After` (segundos).
- Headers de acompanhamento: `X-RateLimit-Limit`, `X-RateLimit-Remaining` e `X-RateLimit-Reset`.
- Consequências no fluxo:
  - Gatilho de alto volume (Mensagem recebida, Webhook) chamando a API em **todo** disparo passa do limite em pico. Filtre com Condições antes da chamada.
  - No bloco API, use `retryCount: 3` e `retryIntervalSeconds: 30` em **GET**. Em POST que cria registro, `retryCount: 0` (pode duplicar).
  - No JavaScript, nunca faça mais de ~50 chamadas numa execução e trate o 429 como erro retornado.

### 2.4 Paginação e busca

- Listas aceitam `skip` (quantos pular) e `take` (quantos trazer) na query, e várias aceitam `search` (texto livre).
- Resposta de lista: `{ "count": <total>, "data": [ … ] }`. Leia `[fonte]count` e `[fonte]data[0].id`. Nunca leia `[fonte]data.count`.
- Exceções ✅ (medido em 05/10/2026):
  - `GET /conversations` devolve só `{ "data": [ … ] }`, **sem `count`**;
  - `GET /conversations/{id}/messages` devolve `{ "messages": [ … ], "histories": [ … ] }`, com 20 mensagens por padrão (seção 5, Conversas).
- **Lista vazia não é erro**: 200 com `data: []` segue pelo "próximo passo". Coloque "Campo possui valor" em `[fonte]data[0].id` (vale para toda lista) ou "Campo com valor igual" em `[fonte]count` = `0` (só onde há `count`) antes de usar.

### 2.5 Filtros

Filtros vão na **query**, com a chave entre colchetes:

```
filter[status]=in_process
filter[tags]=every <idTag1>,<idTag2>
filter[fields]=<idDoCampo> contains texto
complete[additionalFields]=true
```

- No bloco API: um item em `query[]` por filtro, com `key: "filter[status]"` e `value: "in_process"`.
- Listas de IDs: separadas por vírgula, com operação opcional no início: `some` (padrão, pelo menos um), `every` (todos), `none` (nenhum).
- Campo adicional: `<idDoCampo> <operação> <valor>`, com `contains`, `eq` ou `not`. Usa o **ID** do campo, não o nome.
- Datas: ISO 8601 em UTC, `2026-09-01T03:00:00.000Z`. Meia-noite de Brasília = `03:00:00.000Z`. É outro formato que o de agendamento do CRM (KB-03).
- Booleanos: `true` ou `false`, como texto na query.

### 2.6 IDs da conta

- As URLs e os corpos levam **IDs**: `leadId`, `businessId`, `stageId`, `conversationId`, `instanceId` e IDs de tag, lista, campo adicional, atendente e motivo de perda.
- **IDs da sessão** vêm prontos como variável: `{ID do lead|leadId}`, `{ID do negócio|businessId}`, `{ID da etapa|stageId}`, `{ID da conversa|conversationId}`, `{ID da conexão|instanceId}`, `{ID do atendente|attendantId}`. No JavaScript: `await session.getValue("leadId")`.
- **IDs de registros da conta** (etapa de destino, tag, motivo de perda, campo adicional) escritos em URL, corpo ou código ficam como texto: o import declara as dependências dos blocos nativos (KB-01, seção 3) e não há garantia de que ajuste texto livre. Um UUID inventado ou de outra conta dá 404. Faça assim:
  1. o usuário informou o ID real → use;
  2. senão, resolva pelo **nome** em tempo de execução (`GET /pipelines/{id}/stages`, `GET /tags`, `GET /business-loss-reasons`) no JavaScript;
  3. senão, marcador `[PREENCHER ID da etapa Ganho]` e Pendência.
- Formatos: leads, negócios, etapas, tags, listas, atividades e motivos de perda em UUID. Conversas, mensagens, conexões e anexos em ObjectId (24 hexadecimais).
- **Atendente tem dois IDs.** O de `/attendants/crm` (traz `image`) é UUID — é esse que aparece em `attendantId` nos blocos nativos e no JSON de importação. O de `/attendants/multi` (traz `imageURL`) é ObjectId, e é o formato do `attendant.id` no exemplo oficial de `POST /activities`. Leia o ID da rota que você vai usar; não reaproveite um no lugar do outro.

### 2.7 Erros

- Resposta de erro: `{ "statusCode": 4xx, "message": "…" }`. `401` = chave ausente, inválida ou expirada; `404` = ID inexistente; `429` = limite (2.3).
- No bloco API, erro depois das retentativas vai para `errorNextBlockId`, com `{Código do último erro|lastErrorCode}` e `{Mensagem do último erro|lastErrorMessage}`. Ligue sempre a uma notificação.

---

## 3. Chamando pelo bloco API

Negócios do lead da sessão:

```json
{
  "id": "uuid-v4",
  "type": "api",
  "presentation": { "x": 914, "y": 0 },
  "sourceBlockId": null,
  "options": {
    "apis": [
      {
        "name": "json-http-request-api",
        "group": "http",
        "options": {
          "url": "https://api.g1.datacrazy.io/api/v1/leads/{ID do lead|leadId}/businesses",
          "method": "GET",
          "headers": [ { "key": "Authorization", "value": "" } ],
          "query": [ { "key": "take", "value": "50" } ],
          "body": "",
          "retryCount": 3,
          "retryIntervalSeconds": 30,
          "responseHeadersOverrides": [],
          "datasourceName": "dc-negocios-lead",
          "datasourceColor": "#22c55e"
        }
      }
    ],
    "nextBlockId": "uuid-condicao-count",
    "errorNextBlockId": "uuid-notificacao-erro"
  }
}
```

Mover vários negócios (corpo é **texto**, com variáveis):

```json
{
  "name": "json-http-request-api",
  "group": "http",
  "options": {
    "url": "https://api.g1.datacrazy.io/api/v1/businesses/actions/move",
    "method": "POST",
    "headers": [ { "key": "Authorization", "value": "" }, { "key": "Content-Type", "value": "application/json" } ],
    "query": [],
    "body": "{\n  \"ids\": [\"{ID do negócio|businessId}\"],\n  \"destinationStageId\": \"[PREENCHER ID da etapa de destino]\"\n}",
    "retryCount": 0,
    "retryIntervalSeconds": 5,
    "responseHeadersOverrides": [],
    "datasourceName": "dc-mover-negocio",
    "datasourceColor": "#6366f1"
  }
}
```

Nomeie a fonte com o prefixo `dc-` e o que ela traz: `dc-lead`, `dc-negocios-lead`, `dc-conexao`, `dc-mensagens`, `dc-etapas`.

---

## 4. Chamando pelo JavaScript

Use o Padrão Oficial (KB-03, seção 6) com o auxiliar `dc()`. Copie o auxiliar inteiro em cada bloco que chamar a API.

```js
// ##CONFIG##
const TOKEN_DATACRAZY = ""; // Pendência: colar a chave (Configurações › Chaves de API)
const BASE_DATACRAZY = "https://api.g1.datacrazy.io/api/v1";

// Chama a API do Datacrazy. Lança erro com status e mensagem quando a resposta não é 2xx.
async function dc(caminho, { method = "GET", query = {}, body = null } = {}) {
  const qs = Object.entries(query)
    .filter(([, v]) => v !== undefined && v !== null && v !== "")
    .map(([k, v]) => `${encodeURIComponent(k)}=${encodeURIComponent(v)}`)
    .join("&");
  const resposta = await fetch(`${BASE_DATACRAZY}${caminho}${qs ? "?" + qs : ""}`, {
    method,
    headers: { Authorization: `Bearer ${TOKEN_DATACRAZY}`, "Content-Type": "application/json" },
    body: body ? JSON.stringify(body) : undefined
  });
  const texto = await resposta.text();
  let dados = null;
  try { dados = texto ? JSON.parse(texto) : null; } catch (e) { dados = texto; }
  if (resposta.status === 429) {
    throw new Error(`Limite da API do Datacrazy (429) em ${caminho}; tente de novo em ${resposta.headers.get("Retry-After") ?? "60"} s`);
  }
  if (!resposta.ok) {
    throw new Error(`Datacrazy ${method} ${caminho} → ${resposta.status}: ${dados?.message ?? texto}`);
  }
  return dados;
}
```

- `fetch` no bloco JavaScript é ✅ (KB-19). A chamada à API do Datacrazy a partir dele é 🟡: teste antes de ativar.
- Sem `setTimeout` para esperar o 429: devolva o erro tratado e deixe o fluxo decidir (Espera + nova tentativa, ou notificação).
- `timeout` de 30 s: pagine com limite de páginas.

### Exemplo: métricas de compra do lead

Depois do bloco, `between-condition` em `[Javascript-metricas]dados.totalGasto`, ou `field-is-equal-condition` em `[Javascript-metricas]dados.faixa`.

- ✅ `GET /leads/{id}` **sem** parâmetros devolve o lead na raiz, sem `data` (medido em 05/10/2026). Não acrescente `complete[additionalFields]=true`: a rota ignora o id e devolve uma lista de leads (seção 9.1).
- `metrics` segue 🟡 (especificação): confira os valores no primeiro teste.

```js
// ##CONFIG##
const TOKEN_DATACRAZY = ""; // Pendência
const BASE_DATACRAZY = "https://api.g1.datacrazy.io/api/v1";
// (auxiliar dc() da seção 4)

try {
  if (!TOKEN_DATACRAZY) throw new Error("Chave da API do Datacrazy não configurada");
  const leadId = await session.getValue("leadId");
  if (!leadId) throw new Error("Sessão sem leadId");

  const lead = await dc(`/leads/${leadId}`); // lead na raiz; nada de complete[additionalFields] aqui
  if (lead?.id !== leadId) throw new Error("GET /leads/{id} não devolveu o lead pedido");
  const m = lead?.metrics ?? {};

  const totalGasto = Number(m.totalSpent ?? 0);
  const compras = Number(m.purchaseCount ?? 0);
  let faixa = "sem-compra";
  if (compras >= 5 || totalGasto >= 5000) faixa = "vip";
  else if (compras >= 1) faixa = "cliente";

  return {
    sucesso: true, erro: false,
    dados: { compras, totalGasto, ticketMedio: Number(m.averageTicket ?? 0), ultimaCompra: m.lastPurchaseDate ?? null, negociosAbertos: Number(m.openBusinessesCount ?? 0), faixa }
  };
} catch (error) {
  return { sucesso: false, erro: true, mensagem: "Falha ao consultar as métricas do lead", debug: error?.message || null };
}
```

### Exemplo: ganhar todos os negócios em aberto do lead

```js
// ##CONFIG##
const TOKEN_DATACRAZY = ""; // Pendência
const BASE_DATACRAZY = "https://api.g1.datacrazy.io/api/v1";
// (auxiliar dc() da seção 4)

try {
  if (!TOKEN_DATACRAZY) throw new Error("Chave da API do Datacrazy não configurada");
  const leadId = await session.getValue("leadId");
  if (!leadId) throw new Error("Sessão sem leadId");

  const lista = await dc(`/leads/${leadId}/businesses`, { query: { take: 100 } });
  const abertos = (lista?.data ?? []).filter(n => n?.status === "in_process").map(n => n.id);
  if (!abertos.length) {
    return { sucesso: true, erro: false, dados: { ganhos: 0 } };
  }

  await dc("/businesses/actions/win", { method: "POST", body: { ids: abertos } });
  return { sucesso: true, erro: false, dados: { ganhos: abertos.length, ids: abertos } };
} catch (error) {
  return { sucesso: false, erro: true, mensagem: "Falha ao ganhar os negócios do lead", debug: error?.message || null };
}
```

### Exemplo: resolver o ID de uma etapa pelo nome

Evita ID fixo que muda de conta para conta (seção 2.6).

```js
// ##CONFIG##
const TOKEN_DATACRAZY = ""; // Pendência
const BASE_DATACRAZY = "https://api.g1.datacrazy.io/api/v1";
const PIPELINE = "Vendas";      // nome exato da pipeline
const ETAPA = "Pós-venda";      // nome exato da etapa
// (auxiliar dc() da seção 4)

try {
  if (!TOKEN_DATACRAZY) throw new Error("Chave da API do Datacrazy não configurada");
  const pipes = await dc("/pipelines", { query: { search: PIPELINE } });
  const pipe = (pipes?.data ?? []).find(p => p?.name === PIPELINE);
  if (!pipe) throw new Error(`Pipeline "${PIPELINE}" não encontrada`);

  const etapas = await dc(`/pipelines/${pipe.id}/stages`);
  const etapa = (etapas?.data ?? []).find(e => e?.name === ETAPA);
  if (!etapa) throw new Error(`Etapa "${ETAPA}" não encontrada em "${PIPELINE}"`);

  return { sucesso: true, erro: false, dados: { pipelineId: pipe.id, stageId: etapa.id } };
} catch (error) {
  return { sucesso: false, erro: true, mensagem: "Falha ao localizar a etapa", debug: error?.message || null };
}
```

### Exemplo: paginar uma lista

```js
// Traz até MAX_PAGINAS × 100 registros; respeita os 30 s do bloco e o limite de 60/min.
const MAX_PAGINAS = 5;
const todos = [];
for (let pagina = 0; pagina < MAX_PAGINAS; pagina++) {
  const r = await dc("/businesses", { query: { skip: pagina * 100, take: 100, "filter[status]": "in_process" } });
  const itens = r?.data ?? [];
  todos.push(...itens);
  if (itens.length < 100 || todos.length >= (r?.count ?? 0)) break;
}
```

### Exemplo: campos adicionais de um lead

Lead da sessão: `session.getAdditionalValue("Nome do campo")` (KB-19) lê um campo sem API. A API serve para **outro** lead ou para trazer todos os campos de uma vez. `GET /leads/{id}?complete[additionalFields]=true` ignora o id (seção 9.1): busque na lista e escolha pelo id.

```js
// leadId = o lead que você quer; telefone e e-mail dele (ex.: lead.phone e lead.email de GET /businesses/{id}).
async function leadComCampos(leadId, telefone, email) {
  for (const termo of [String(telefone ?? "").replace(/\D/g, ""), email].filter(Boolean)) {
    const r = await dc("/leads", { query: { search: termo, "complete[additionalFields]": "true", take: 50 } });
    const lead = (r?.data ?? []).find(l => l?.id === leadId);
    if (lead) return lead; // lead.additionalFields
  }
  return null; // não achou: rota interna GET /crm/leads/{id}/additional-fields (seção 5, Leads)
}
```

### Exemplo: mensagens da conversa do lead

Base da receita "Resumo da conversa" (seção 8) e de qualquer cálculo de tempo de resposta. Depois do bloco, a IA lê `{Conversa|[Javascript-mensagens]dados.texto}`.

```js
// ##CONFIG##
const TOKEN_DATACRAZY = ""; // Pendência
const BASE_DATACRAZY = "https://api.g1.datacrazy.io/api/v1";
const MAX_PAGINAS = 10; // 100 mensagens por página
// (auxiliar dc() da seção 4)

try {
  if (!TOKEN_DATACRAZY) throw new Error("Chave da API do Datacrazy não configurada");
  const leadId = await session.getValue("leadId");
  if (!leadId) throw new Error("Sessão sem leadId");
  const inicio = Date.now();

  // 1. Conversa do lead. A busca é aproximada (o contactId da conversa pode vir sem o 9º dígito):
  //    aceite só a conversa com contact.externalId igual ao lead, nunca a primeira da lista.
  const lead = await dc(`/leads/${leadId}`); // lead na raiz, com contacts[]
  let conversa = null;
  for (const contato of (lead?.contacts ?? []).filter(c => c?.contactId)) {
    const r = await dc("/conversations", { query: { search: contato.contactId } }); // { data }, sem count
    conversa = (r?.data ?? []).find(c => c?.contact?.externalId === leadId) ?? null;
    if (conversa) break;
  }
  if (!conversa) return { sucesso: true, erro: false, dados: { conversationId: null, completo: true, total: 0, texto: "" } };

  // 2. Todas as páginas: sem take e skip vêm só as 20 mais novas, da mais nova para a mais antiga.
  //    O Map por id evita repetir mensagem que chegou durante a leitura e empurrou as páginas.
  const porId = new Map();
  let completo = false;
  for (let pagina = 0; pagina < MAX_PAGINAS && Date.now() - inicio < 20000; pagina++) {
    const r = await dc(`/conversations/${conversa.id}/messages`, { query: { take: 100, skip: pagina * 100 } });
    const lote = r?.messages ?? [];
    lote.forEach(m => { if (m?.id) porId.set(m.id, m); });
    if (lote.length < 100) { completo = true; break; }
  }

  // 3. Ordem cronológica, sem anotação interna nem envio que falhou.
  const autor = m => m.received ? "Cliente" : m.attendant?.isAgent ? "Agente de IA" : (m.attendant?.name || "Equipe");
  const mensagens = [...porId.values()]
    .filter(m => m?.isInternal !== true && m?.status !== "ERROR")
    .sort((a, b) => new Date(a.createdAt) - new Date(b.createdAt));
  const texto = mensagens.map(m => `${autor(m)}: ${m.body || "[anexo]"}`).join("\n");

  return { sucesso: true, erro: false, dados: { conversationId: conversa.id, completo, total: mensagens.length, texto } };
} catch (error) {
  return { sucesso: false, erro: true, mensagem: "Falha ao ler as mensagens da conversa", debug: error?.message || null };
}
```

- `completo: false` = parou no limite de páginas ou de tempo; a conversa tem mais mensagens antigas.
- Tempo de resposta: use as mesmas páginas, nunca só a primeira. Resposta = `received: false` com `attendant` e sem `status: "ERROR"`. Decida com o cliente se a resposta do agente de IA (`attendant.isAgent: true`) conta.

---

## 5. Catálogo de endpoints

Caminhos relativos a `https://api.g1.datacrazy.io/api/v1`. `{id}` e afins vão na URL. "Lista" = resposta `{ count, data: [] }` com `skip`, `take` e, quando indicado, `search`. Exceções medidas: `/conversations` (sem `count`) e `/conversations/{id}/messages` (`{ messages, histories }`). Os objetos de resposta estão na seção 7. ✅ nas tabelas abaixo = medido em 05/10/2026, salvo os anexos e as conexões (✅ produção).

### Leads 🟡 (leitura ✅)

| Método | Caminho | Faz | Entrada | Resposta |
|---|---|---|---|---|
| GET | `/leads` ✅ | Busca leads | Lista + `search`, `searchType` (`phone` · `email` · `name` · `taxId`), `filter[…]` (seção 6.1), `complete[additionalFields]=true` | Lista de Lead |
| POST | `/leads` | Cria lead | Corpo Lead de escrita (abaixo) | 201 |
| GET | `/leads/{id}` ✅ | Busca um lead | `searchType` opcional. **Sem** `complete[additionalFields]` | Lead na raiz, sem `additionalFields` |
| PATCH | `/leads/{id}` | Atualiza lead | Corpo Lead de escrita, só os campos que mudam | Lead |
| DELETE | `/leads/{id}` | **Exclui o lead** ⚠️ destrutivo | — | 200 |
| POST | `/leads/additional-fields` | Cria lead com campos adicionais | Lead com `additionalFields` | 201 |

Leitura, medida em 05/10/2026:
- ✅ `GET /leads/{id}` devolve o lead **na raiz** (sem `data`), com `tags`, `contacts`, `attendant`, `notes`, `rawPhone` e `sourceReferral`, mas **sem** `additionalFields`.
- ✅ Com `complete[additionalFields]=true`, `GET /leads/{id}` **ignora o id** e devolve `{ data: [ … ] }` com até 100 leads da conta. `data[0]` é **outro lead**.
- Lead certo com campos adicionais: `GET /leads?search=<telefone só dígitos ou e-mail>&complete[additionalFields]=true&take=50` e o item com `id === leadId`. O bloco API só lê posição fixa (`data[0]`): escolha pelo id no JavaScript (seção 4).
- ✅ Rota interna, no mesmo endereço: `GET /crm/leads/{id}/additional-fields` devolve `{ data: [ … ] }` com os campos adicionais do lead (KB-08).

Lead de escrita: `name`, `phone`, `email`, `source`, `company`, `birthDate` (ISO), `taxId`, `site`, `instagram`, `image` (URL), `address` `{ zip, address, block, city, state, country, number }`, `sourceReferral` `{ sourceId, sourceUrl, ctwaId }`, `tags` `[{ "id": "…" }]`, `lists` `[{ "id": "…" }]`, `attendant` `{ "id": "…" }`, `additionalFields`.

- O formato de `additionalFields` na escrita não está claro na documentação. Para gravar campo adicional, prefira Mapeamento de campo (KB-17) depois de criar o lead.
- Para criar o lead da sessão, use a ação nativa `create-lead-action`. O POST é para leads que **não** são o da sessão (indicação, contato secundário).

### Relacionados ao lead 🟡 (anexos ✅)

| Método | Caminho | Faz | Entrada | Resposta |
|---|---|---|---|---|
| GET | `/leads/{id}/businesses` | Negócios do lead | Lista + `search` | Lista de Negócio |
| GET | `/leads/{id}/activities` | Atividades do lead | Lista + `search` | Lista de Atividade |
| GET | `/leads/{id}/history` | Histórico do lead | Lista + `search`, `filter[businessId]`, `filter[leadName]`, `filter[comment]` | Lista de `{ id, type, createdAt, history, businessId, historyCode, attendant }` |
| GET | `/leads/{leadId}/notes` | Comentários do lead | — | Lista de comentários (mesmo formato do histórico, `type: "NOTE"`) |
| POST | `/leads/{leadId}/notes` | Adiciona comentário | `{ "note": "texto" }` | `{ note }` |
| PUT | `/leads/{leadId}/notes/{id}` | Edita comentário | `{ "note": "texto" }` | `{ note }` |
| DELETE | `/leads/{leadId}/notes/{id}` | Exclui comentário ⚠️ | — | 200 |
| GET | `/leads/{leadId}/attachments` ✅ | Anexos do lead | — | Lista de Anexo |
| POST | `/leads/{leadId}/attachments` ✅ | Anexa arquivo por URL | `{ "attachmentUrl", "fileName", "fileSize", "description"? }` | Anexo |
| DELETE | `/leads/{leadId}/attachments/{id}` | Apaga anexo ⚠️ | — | 200 |

Comentário no lead da sessão: use a ação nativa `add-lead-comment-action`.

### Negócios 🟡 (leitura ✅)

| Método | Caminho | Faz | Entrada | Resposta |
|---|---|---|---|---|
| GET | `/businesses` ✅ | Busca negócios | Lista + `search`, `filter[…]` (seção 6.2) | Lista de Negócio |
| POST | `/businesses` | Cria negócio | `{ "leadId", "stageId", "attendantId"?, "externalId"? }` | Negócio |
| GET | `/businesses/{id}` ✅ | Busca um negócio | — | Negócio na raiz, com `lead`, `stage` e `attendant` |
| PATCH | `/businesses/{id}` | Atualiza negócio | `{ "leadId"?, "stageId"?, "attendantId"?, "externalId"? }` | Negócio |
| DELETE | `/businesses/{id}` | **Exclui o negócio** ⚠️ destrutivo | — | 200 |
| POST | `/businesses/actions/move` | Move um ou vários | `{ "ids": ["…"], "destinationStageId": "…" }` | 201 |
| POST | `/businesses/actions/win` | Ganha um ou vários | `{ "ids": ["…"] }` | 201 |
| POST | `/businesses/actions/lose` | Perde um ou vários | `{ "ids": ["…"], "lossReasonId": "…", "justification"? }` | 201 |
| POST | `/businesses/actions/restore` | Restaura um ou vários | `{ "ids": ["…"] }` | 201 |
| GET | `/business/{businessId}/attachments` | Anexos do negócio | — | Lista de Anexo |
| POST | `/business/{businessId}/attachments` | Anexa arquivo por URL | `{ "attachmentUrl", "fileName", "fileSize", "description"? }` | Anexo |
| DELETE | `/business/{businessId}/attachments/batch` | Apaga anexos ⚠️ | corpo: `["idAnexo1", "idAnexo2"]` | 204 |

- ✅ Anexo (lead ou negócio): `fileSize` é **obrigatório** e tem de ser **número** (bytes), medido em 29/10/2026. Sem ele, ou com ele em texto (`"869164"`), a rota devolve 500 `PrismaClientValidationError: Argument fileSize is missing`. `0` é aceito; o tamanho real fica melhor na tela. No corpo do bloco API, escreva o número sem aspas: `"fileSize": 0` ou `"fileSize": ${tamanho|[fonte]dados.bytes}`. Link `http://` também é aceito como `attachmentUrl`.

- ✅ `GET /businesses/{id}` devolve o negócio na raiz, já com `lead`, `stage` (com `pipeline`) e `attendant`, no mesmo formato de cada item de `GET /businesses` (medido em 05/10/2026). Tags, contatos, telefone e e-mail do lead vêm aí, sem outra chamada. `lead.phone` vem formatado e sem `rawPhone`: tire o que não é dígito antes de usar em `search`.
- Atenção ao singular: anexos de negócio ficam em `/business/…`, e o resto em `/businesses/…`.
- `lossReasonId` é obrigatório no `lose`. Se o motivo exigir justificativa (`requiredJustification`), mande `justification`.

### Atividades 🟡

| Método | Caminho | Faz | Entrada | Resposta |
|---|---|---|---|---|
| GET | `/activities` | Busca atividades | Lista + `search`, `filter[…]` (seção 6.4) | Lista de Atividade |
| POST | `/activities` | Cria atividade | Atividade de escrita (abaixo); `title` e `lead` obrigatórios | Atividade |
| GET | `/activities/{id}` | Busca uma | — | Atividade |
| PATCH | `/activities/{id}` | Atualiza | Atividade de escrita, só o que muda | Atividade |
| DELETE | `/activities/{id}` | Exclui ⚠️ | — | 200 |

Atividade de escrita: `title`, `description`, `startDate` e `endDate` (ISO UTC), `lead` `{ "id" }`, `business` `{ "id" }`, `attendant` `{ "id" }`, `activityType` `{ "id" }`, `flow` `{ "id" }` (automação vinculada), `required` (obrigatória), `linkToStage` (vincular à etapa do negócio).

O exemplo da doc oficial tem três defeitos. Não copie dele:

- **Data em JSON vai sem escape**: `"2025-10-09T03:00:00.000Z"`. O exemplo traz `03%3A00%3A00` — escape de query string, que dentro do corpo JSON vira data inválida.
- **`required` e `linkToStage` são boolean**: `false` e `true`, sem aspas. O exemplo manda `"false"`, e string não vazia é verdadeira — risco de criar a atividade como obrigatória sem querer.
- **A resposta do exemplo está torta**: `lead` aparece como data (deveria ser objeto, como `business` ao lado), e `isCompleted` e `lossReasonId` vêm como string — inclusive `"null"`, que não é `null`. Não assuma esses tipos ao ler a resposta.

### Conversas e mensagens 🟡 (leitura ✅)

| Método | Caminho | Faz | Entrada | Resposta |
|---|---|---|---|---|
| GET | `/conversations` ✅ | Busca conversas (**20/min**) | Lista + `search`, `filter[…]` (seção 6.3) | `{ data: [Conversa] }`, **sem `count`** |
| GET | `/conversations/{id}/messages` ✅ | Mensagens da conversa | `take`, `skip` | `{ messages: [Mensagem], histories: [ … ] }` |
| POST | `/conversations/{id}/messages` | Envia mensagem ou anotação | Mensagem de escrita (abaixo) | Mensagem |
| POST | `/conversations/{id}/finish` | Finaliza o atendimento | — | — |

Leitura, medida em 05/10/2026:
- ✅ `GET /conversations/{id}/messages` sem parâmetros traz só as **20 mensagens mais novas**, da mais nova para a mais antiga. Pagine com `take` e `skip`: `take=100&skip=0`, depois `skip=100`, até a página vir com menos que `take`. `limit`, `page` e `before` são ignorados; `cursor` dá 400. Tempo de resposta e resumo da conversa inteira leem todas as páginas (seção 4).
- ✅ `GET /conversations` não traz `count`: cheque vazio por `[fonte]data[0].id`, nunca por `[fonte]count`.
- ✅ A busca é aproximada: o `contactId` do lead pode ter 13 dígitos e o da conversa 12, sem o 9º dígito. Escolha a conversa do lead por `contact.externalId === leadId` (JavaScript, seção 4), nunca por `data[0]`.

Mensagem de escrita: `body` (texto), `isInternal` (`true` = anotação interna, não vai ao contato), `scheduledDate` (ISO UTC), `repliedMessageId` e `repliedMessageAttachmentId` (responder uma mensagem), `attachments` `[{ "fileName", "mimeType", "url", "type" }]` com `type` `IMAGE` · `VIDEO` · `AUDIO` · `FILE`.

- Na conversa da sessão, prefira o bloco **Mensagem** (KB-11): ele respeita conexão, janela da API Oficial e contadores. A API serve para **outra** conversa: `GET /conversations?search=<contactId do lead>` e a conversa com `contact.externalId` igual ao ID do lead.
- Fora da janela de 24 h da API Oficial, texto livre falha: use Template do WhatsApp no bloco Mensagem.
- Finalizar o atendimento da sessão: ação nativa `finish-conversation-action`.

### Conexões ✅

| Método | Caminho | Faz | Resposta |
|---|---|---|---|
| GET | `/instances` | Lista as conexões da conta | Lista de Conexão |
| GET | `/instances/{id}` ✅ | Uma conexão | Conexão: `status`, `isActive`, `platform`, `provider`, `config` |

Uso real: `GET /instances/{instanceData.id|[Message-1]instanceData.id}` → condição "Campo possui valor" em `[fonte]config.wabaId` para saber se a conversa veio da API Oficial.

### Cadastros da conta 🟡

| Método | Caminho | Faz | Entrada | Resposta |
|---|---|---|---|---|
| GET | `/pipelines` | Pipelines | `search` | Lista de `{ id, name, description, group, stagesCount }` |
| GET | `/pipelines/{id}` | Uma pipeline | — | Pipeline com `permissions` |
| GET | `/pipelines/{id}/stages` | Etapas da pipeline | — | Lista de `{ id, name, color, index, activitiesCount }` |
| GET | `/tags` | Tags | — | Lista de `{ id, name, color, description }` |
| POST | `/tags` | Cria tag | `{ "name", "color"?, "description"?, "useRandomColor"? }` | 201 com a tag: `{ id, name, color, description, createdAt }` |
| GET | `/tags/{id}` | Uma tag | — | Tag |
| PUT | `/tags/{id}` | Edita tag | como no POST | Tag |
| DELETE | `/tags/{id}` | Exclui tag ⚠️ | — | 200 |
| GET | `/tags/{id}/leads-count` | Leads com a tag | — | `{ count }` |
| GET | `/lists` | Listas | — | Lista de `{ id, name, description }` |
| POST | `/lists` | Cria lista | `{ "name", "description"? }` | Lista |
| GET | `/lists/{id}` | Uma lista | — | Lista |
| PUT | `/lists/{id}` | Edita lista | `{ "name"?, "description"? }` | Lista |
| DELETE | `/lists/{id}` | Exclui lista ⚠️ | — | 200 |
| GET | `/products` | Produtos | — | Lista de `{ id_sku, name, price }` |
| POST | `/products` | Cria produto | `{ "id_sku", "name", "price" }` | 201 |
| GET | `/products/{id}` | Um produto | — | Produto |
| PUT | `/products/{id}` | Edita produto | `{ "id_sku"?, "name"?, "price"? }` | Produto |
| DELETE | `/products/{id}` | Exclui produto ⚠️ (falha se estiver em negócio) | — | 200 |
| GET | `/business-loss-reasons` | Motivos de perda | — | Lista de `{ id, name, requiredJustification }` |
| POST | `/business-loss-reasons` | Cria motivo | `{ "name", "requiredJustification"? }` | Motivo |
| GET | `/business-loss-reasons/{id}` | Um motivo | — | Motivo |
| PUT | `/business-loss-reasons/{id}` | Edita motivo | `{ "name"?, "requiredJustification"? }` | Motivo |
| DELETE | `/business-loss-reasons/{id}` | Exclui motivo ⚠️ | — | 200 |
| GET | `/attendants/crm` | Usuários do CRM | — | Lista de `{ id, userId, name, email, phone, image }` |
| GET | `/attendants/crm/{id}` | Um usuário do CRM | — | Atendente |
| GET | `/attendants/multi` | Atendentes do multiatendimento | `search` | Lista de `{ id, userId, name, email, phone, imageURL }` |
| GET | `/attendants/multi/{id}` | Um atendente do multiatendimento | — | Atendente |

Criar tag e produto para o lead da sessão: ações nativas `create-tag-action` e `create-product-action`.

Campos adicionais da conta não têm endpoint público. A rota interna `GET /crm/additionalFields`, no mesmo endereço, lista os campos (KB-08). ✅ Para só os parâmetros do sistema (o antigo campo da empresa), use `filter[entity]=company`: `entity=company`, sem `filter[…]`, é ignorado (medido em 05/10/2026). Os outros valores são `lead`, `lead_company` e `business`. A tela de Parâmetros do sistema lê os valores em `GET /crm/additional-fields/company/{idDaConta}` (08/10/2026); parâmetro Secreto não deve vir com o valor.

---

## 6. Filtros

### 6.1 `GET /leads` — `filter[…]`

| Chave | Valor |
|---|---|
| `tags` | `[some\|every\|none] id1,id2` |
| `lists` | `[some\|every\|none] id1,id2` |
| `stages` | `[some\|every\|none] id1,id2` (etapas dos negócios do lead) |
| `products` | `[some\|every\|none] sku1,sku2` |
| `attendant` | ID do atendente |
| `source` | origem, ex. `Google Ads` |
| `fields` | `<idCampo> contains\|eq\|not <valor>` |
| `address` | `city São Paulo,state SP` (campos `block`, `city`, `state`, `country`) |
| `hasMessages` / `notHasMessages` | `true` |
| `minBusinessesCount` / `maxBusinessesCount` | número |
| `productsInBusiness` | número |
| `minLastPurchaseDate` / `maxLastPurchaseDate` | data ISO UTC |
| `createdAtGreaterOrEqual` / `createdAtLessOrEqual` | data ISO UTC |

A documentação descreve `minLastPurchaseDate` como "na data ou **anterior**" e `maxLastPurchaseDate` como "na data ou **posterior**", o inverso do nome. Teste com um lead conhecido antes de confiar.

### 6.2 `GET /businesses` — `filter[…]`

| Chave | Valor |
|---|---|
| `status` | `in_process` (aberto) · `won` (ganho) · `lost` (perdido) |
| `externalId` | ID externo, para deduplicar eventos |
| `tags` / `products` | `[some\|every\|none] id1,id2` |
| `attendants` | `id1,id2` |
| `lossReason` | ID do motivo de perda |
| `source` | origem do lead |
| `fields` | campo adicional **do lead**: `<idCampo> contains\|eq\|not <valor>` |
| `businessFields` | campo adicional **do negócio**, mesmo formato |
| `minValue` / `maxValue` | valor do negócio |
| `startDate` / `endDate` | em negociação no intervalo (ISO UTC) |
| `createdAtGreaterOrEqual` / `createdAtLessOrEqual` | criação (ISO UTC) |
| `lastMovedAfter` / `lastMovedBefore` | última movimentação (ISO UTC): negócio parado na etapa |

### 6.3 `GET /conversations` — `filter[…]`

| Chave | Valor |
|---|---|
| `status` | `unstarted` (sem atendimento) · `waiting` (última mensagem é do cliente) · `opened` · `automation` (última via automação) · `finished` · `error` |
| `openWindow` | `last24h` (recebeu mensagem nas últimas 24 h) · `all` |
| `instances` | `id1,id2` (conexões) |
| `departments` | `id1,id2` |
| `attendants` | `id1,id2` |
| `tags` | `id1,id2` |
| `stages` | ID de uma etapa |

### 6.4 `GET /activities` — `filter[…]`

| Chave | Valor |
|---|---|
| `attendantId` | `id1,id2` |
| `typeId` | ID do tipo de atividade |
| `isCompleted` | `true` · `false` (vazio = todas) |
| `startDate` | marcadas a partir da data (ISO UTC) |
| `startDateLessThan` | marcadas até a data (ISO UTC) |

---

## 7. Objetos de resposta

Leia com `[fonte]campo` no bloco API ou `resposta?.campo` no JavaScript. Os objetos vêm da especificação; as linhas ✅ dizem o que a medição de 05/10/2026 conferiu.

**Lead**: `id`, `createdAt`, `name`, `phone` (formatado), `rawPhone` (só dígitos), `email`, `source`, `company`, `birthDate`, `taxId`, `site`, `instagram`, `image`, `address` `{ zip, address, block, city, state, country, number }`, `tags[]` `{ id, name, color }`, `lists[]`, `contacts[]` `{ platform, contactId, lastContactStatus }`, `attendant` `{ id, userId, name, email }`, `notes`, `sourceReferral` `{ sourceId, sourceUrl, ctwaId }`, `additionalFields` (só em `GET /leads` com `complete[additionalFields]=true`; seção 5, Leads) e **`metrics`**:
- `purchaseCount`: quantidade de compras;
- `lastPurchaseDate`: data da última compra;
- `averageTicket`: ticket médio;
- `totalSpent`: total gasto;
- `openBusinessesCount`: negócios em aberto;
- `lostBusinessesCount` e `lostBusinessesTotalValue`: negócios perdidos e o valor deles;
- `purchaseFrequency`: frequência de compra.

✅ `GET /leads/{id}`: lead na raiz com `tags`, `contacts`, `attendant`, `notes`, `rawPhone` e `sourceReferral`, sem `additionalFields`. `metrics` segue 🟡.

**Negócio**: `id`, `createdAt`, `leadId`, `stageId`, `attendantId`, `status` (`in_process` · `won` · `lost`), `total`, `discount`, `addition`, `shipping`, `coupon`, `shippingType`, `code`, `externalId`, `lastMovedAt`, `statusChangedAt`, `lossReasonId`, `justification`, `nextActivityId`, `productsCount`, `products[]` `{ id, quantity, price, total, product: { id, id_sku, name, price } }`, `lead`, `stage`, `attendant`.

✅ `GET /businesses/{id}` e cada item de `GET /businesses`: `lead` com `tags`, `contacts`, `phone` (formatado) e `email`, **sem** `rawPhone`; `stage` com `pipeline` `{ id, name }`; `attendant` com `name`.

**Conversa**: `id`, `name`, `isGroup`, `automationEnabled`, `finished`, `isPending`, `lastMessageDate`, `lastReceivedMessageDate`, `lastSendedMessageDate`, `lastMessageIsAutomation`, `contact` `{ contactId, platform, name, externalId }`, `instance` (conexão), `attendants[]`, `currentDepartment` `{ id, name }`, `currentThread` `{ id, code, startedAt, finishedAt, durationInMs, waitTimeInMs }`, `sourceReferral`.

✅ `contact.externalId` = ID do lead: é por ele que se acha a conversa do lead (o `contact.contactId` pode vir sem o 9º dígito).

**Mensagem** (itens de `messages[]`): `id`, `conversationId`, `createdAt`, `body`, `received`, `status`, `attachments[]` `{ fileName, mimeType, url, type }`, `isInternal`, `isScheduled`, `scheduledDate`, `firstTicketMessage`, `buttons[]`, `repliedMessage`, `edited`, `deleted`, `forwarded`, `erroCode`, `errorMessage`, `attendant` `{ id, userId, name, email, isAgent }`.

✅ `attendant` é **um objeto**, não `attendants[]`. `attendant.isAgent: true` = agente de IA. `status: "ERROR"` = envio falhou. Vêm também `isInternal`, `isScheduled` e `firstTicketMessage`.

**Conexão**: `id`, `name`, `platform` (`WHATSAPP`…), `provider`, `engine`, `isActive` (ligada no CRM), `status` (conexão com o provedor), `errorCode`, `errorMessage`, `webhook`, `config` (ex. `config.wabaId` só na API Oficial).

**Atividade**: `id`, `title`, `description`, `startDate`, `endDate`, `isCompleted`, `required`, `lead`, `business`, `attendant`, `activityType`, `flow`.

**Anexo**: `id`, `fileName`, `mimeType`, `url`, `type` (`IMAGE` · `VIDEO` · `AUDIO` · `FILE`), `createdAt`.

---

## 8. Receitas

| Necessidade | Montagem |
|---|---|
| **Segmentar por valor de cliente** | Gatilho → JavaScript "métricas" (seção 4) → condição em `dados.faixa` → mensagem ou tag por faixa. |
| **Alerta de conexão caída** | Execução agendada (30 min) → API `GET /instances/{id}` (ID informado pelo usuário) → condição "Campo possui valor" em `[dc-conexao]errorMessage` → Enviar notificação com `{status\|[dc-conexao]status}`. Anote no primeiro teste o `status` de uma conexão saudável para refinar a condição. |
| **Fechar negócios duplicados** | Negócio ganho → JavaScript: `GET /leads/{leadId}/businesses`, filtra `in_process` diferentes de `businessId` → `POST /businesses/actions/lose` com o motivo "Duplicado". |
| **Deduplicar evento externo em outra pipeline** | Webhook → API `GET /businesses` com `filter[externalId]` → condição `[fonte]count` = `0` → cria o negócio. A condição nativa `business-with-external-id-exists-condition` resolve o caso simples; a API traz também o negócio encontrado (etapa, status). |
| **Nota fiscal no cadastro** ✅ | Requisição de arquivo (PDF) → API `GET /leads/{leadId}/attachments` → condição → API `POST /leads/{leadId}/attachments` com `attachmentUrl` = `[fonte-arquivo]url` e `fileSize` numérico (obrigatório). |
| **Resumo da conversa para o vendedor** | Negócio movido → JavaScript "mensagens da conversa do lead" (seção 4) → condição "Campo possui valor" em `[Javascript-mensagens]dados.conversationId` → IA "Gere um texto" com `{Conversa\|[Javascript-mensagens]dados.texto}` → comentário no lead. Não monte com dois blocos API: a busca de conversas é aproximada (`data[0]` pode ser de outro contato) e as mensagens vêm só as 20 mais novas. |
| **Negócio parado na etapa** | Execução agendada diária → JavaScript: `GET /businesses` com `filter[lastMovedBefore]` = hoje − 7 dias e `filter[status]=in_process` → notificação ou `POST /activities` para cada um. |
| **Reengajar conversas esperando resposta** | Execução agendada → JavaScript: `GET /conversations` com `filter[status]=waiting` e `filter[openWindow]=last24h` → `POST /conversations/{id}/messages` com `isInternal: true` avisando o atendente. |

---

## 9. Divergências da documentação oficial

### 9.1 Medidas ✅ (05/10/2026)

Chamadas a `https://api.g1.datacrazy.io/api/v1` numa conta real, com a chave da conta. Valem mais que a especificação; as seções 2.4, 4, 5, 7, 8 e 10 já seguem estas medidas.

1. **`GET /leads/{id}?complete[additionalFields]=true` ignora o id** e devolve `{ data: [ … ] }` com até 100 leads da conta. `data[0]` é outro lead. Lead certo com campos adicionais: `GET /leads?search=<telefone só dígitos ou e-mail>&complete[additionalFields]=true&take=50` e o item com `id === leadId` (seção 4). Pela rota interna, `GET /crm/leads/{id}/additional-fields` devolve `{ data: [ … ] }` com os campos do lead.
2. **`GET /leads/{id}` sem parâmetros** devolve o lead **na raiz** (sem `data`), com `tags`, `contacts`, `attendant`, `notes`, `rawPhone` e `sourceReferral`, mas sem `additionalFields`. A especificação mostra `{ count, data }`.
3. **`GET /conversations/{id}/messages`** devolve `{ messages: [ … ], histories: [ … ] }`. Sem parâmetros, só as 20 mensagens mais novas, da mais nova para a mais antiga. `take` e `skip` paginam (`take=100&skip=0`, `skip=100`…); `limit`, `page` e `before` são ignorados; `cursor` dá 400. Tempo de resposta exige ler todas as páginas. A especificação descreve "Buscar conversa por ID", com uma mensagem só.
4. **`GET /conversations?search=<contactId>`** devolve só `{ data: [ … ] }`, **sem `count`**: não use `[fonte]count` para checar vazio. A busca é aproximada: o `contactId` do lead pode ter 13 dígitos e o da conversa 12, sem o 9º dígito. A conversa do lead é a de `contact.externalId === leadId`.
5. **Mensagem** traz `attendant` (objeto `{ userId, name, email, isAgent, id }`), não `attendants[]`. `isAgent: true` = agente de IA. `status: "ERROR"` = envio falhou. Vêm também `isInternal`, `isScheduled` e `firstTicketMessage`.
6. **`GET /businesses/{id}`** devolve o negócio na raiz, já com `lead` (`tags`, `contacts`, `phone` formatado, `email`; sem `rawPhone`), `stage` com `pipeline` (`id`, `name`) e `attendant` (`name`). É o mesmo formato de cada item de `GET /businesses`.
7. **`GET /crm/additionalFields`** (rota interna, KB-08) ignora `entity=company`. O filtro que funciona é `filter[entity]=company`.
8. **`POST /tags`** responde 201 **com a tag criada** — `{ id, name, color, description, createdAt }` —, conferido numa conta real (out/2026); use o `id` do corpo. A especificação não documenta o corpo.

### 9.2 A conferir 🟡

Conferir no primeiro teste e ajustar:

1. `searchType` em `GET /leads/{id}` sugere que `{id}` aceita telefone, e-mail, nome ou CPF. Não confirmado.
2. Formato de `additionalFields` na criação de lead não definido (seção 5, Leads).
3. `minLastPurchaseDate` e `maxLastPurchaseDate` com descrição invertida (seção 6.1).
4. `POST /products` retorna 201 sem corpo documentado: busque o registro depois se precisar do ID. (`POST /tags` já foi medido: item 8 da seção 9.1.)
5. O export real anexou nota com `fileSize` no corpo e a especificação não tem esse campo. Desde 29/10/2026 ele é obrigatório: veja a nota abaixo da tabela de Negócios (seção 5).

---

## 10. Erros comuns

1. **Chave no JSON ou no código.** Header vazio ou `TOKEN_DATACRAZY = ""`, com Pendência.
2. **Base errada**: domínio interno (`crm.g1`, `messaging.g1`, `accounts.g1`) ou falta de `/api/v1`. Ver KB-08.
3. **API para o que o nativo faz** (criar o lead da sessão, adicionar tag, mover o negócio da sessão).
4. **Chamada em todo disparo de gatilho de alto volume**: estoura 60/min (20/min em conversas). Filtre antes.
5. **Ler lista sem checar vazio**: `[fonte]data[0].id` inexistente segue o fluxo com valor em branco.
6. **`[fonte]data.count`**: o total fica em `[fonte]count`.
7. **ID de etapa, tag ou motivo fixo no texto**, sem ser da conta do cliente (seção 2.6).
8. **`retryCount` em POST** que cria ou move: pode duplicar.
9. **DELETE sem pedido explícito**: exclusões são permanentes.
10. **Endpoint inventado.** Só existem os da seção 5.
11. **`data[0]` como o lead ou a conversa certa.** `GET /leads/{id}?complete[additionalFields]=true` ignora o id e a busca de conversas é aproximada: escolha por `id === leadId` ou `contact.externalId === leadId` (seção 9.1).
12. **Só a primeira página de mensagens.** Sem `take` e `skip` vêm as 20 mais novas; resumo e tempo de resposta leem todas (seção 4).
