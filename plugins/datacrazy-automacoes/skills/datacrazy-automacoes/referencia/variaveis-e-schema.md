# Variáveis, roteamento e schema JSON

## Interpolação

```
${rotulo|caminho}
{rotulo|caminho}
```

O que vale é a parte **depois do `|`** (o caminho); a parte antes é o rótulo
legível mostrado na UI. Exemplos reais:

```
${leadFirstName|leadFirstName}
${businessId|businessId}
${leadId|leadId}
{Último resultado da IA|lastAiText}
${[date-start-6]iso|[date-start-6]iso}
${[busca-lead]attendant.id|[busca-lead]attendant.id}
```

`[nome]` referencia a **fonte de dados** criada por um bloco anterior via
`datasourceName`. Caminhos com ponto navegam o JSON retornado.

## Categorias do seletor de variáveis (`{}`)

Lead · Negócio · Produto · Conversa · Adicionais do lead pessoa · Adicionais do
lead empresa · Adicionais do negócio · Parâmetros do sistema · Sistema · Entrada
de dados (out/2026). "Parâmetros do sistema" é o antigo "Campos adicionais da
empresa"; a variável continua `additional-field[nome]`. Token vai em parâmetro
do tipo Secreto (KB-03, seções 4.1 e 4.2).

A lista concreta de campos varia por tenant (campos adicionais são
configuráveis). Exemplos de "Campos do lead": ID do lead, Nome do lead,
Primeiro nome do lead, CEP, Endereço, Bairro, Número de residência, Cidade,
Complemento…

## Roteamento entre blocos

| Chave | Onde aparece |
|---|---|
| `nextBlockId` | saída padrão de quase todo bloco |
| `errorNextBlockId` | Mensagem, Ações, API, Operações de campos, JavaScript |
| `conditions[].nextBlockId` (por item), `trueNextBlockId` (todas verdadeiras), `falseNextBlockId` (nenhuma atendida) | Condições — ver KB-01 §5 |
| `noneNextBlockId` | IA → Intenção de conversa (nenhuma intenção casou) |
| `neutralNextBlockId` | IA → Sentimento da conversa |
| `timeoutNextBlockId` | Mensagem → Entrada do usuário |
| `randomizers[].nextBlockId` | Randomizador (com `perc`) |
| `intentions[].nextBlockId` | IA → Intenção de conversa |

Saída vazia (`""`) = fluxo termina ali.

## Schema do JSON exportado

```jsonc
{
  "id": "uuid",
  "name": "Nome da automação",
  "version": 3,
  "active": true,
  "createdAt": "...", "updatedAt": "...",
  "notes": [],
  "blocks": [
    {
      "id": "uuid",
      "type": "trigger|chat|action|condition|delay|randomizer|api|field-operation|ai|javascript",
      "sourceBlockId": null,
      "options": { /* ver abaixo */ },
      "presentation": { "x": 5814.23, "y": -34.65 }
    }
  ]
}
```

`options` carrega um array cujo nome depende do `type`:

| `type` | array em `options` |
|---|---|
| `trigger` | `triggers[]` |
| `chat` | `messages[]` (+ `platform`, `provider`, `timezone`, `contactId`, `instanceId`, `isAnnotation`, `scheduledDate`) |
| `action` | `actions[]` |
| `condition` | `conditions[]` |
| `delay` | `delay` (objeto, não array) |
| `randomizer` | `randomizers[]` |
| `api` | `apis[]` |
| `field-operation` | `fieldOperations[]` |
| `ai` | `ais[]` |

Cada item do array: `{ name, group, stepId?, options: {...} }`.

### Nomes internos confirmados em produção

**trigger** — `business-created-trigger` (`stageId`) · `manually-lead-trigger` ·
`message-received-trigger` (`type,keywords,instanceId,listenGroup,receiveJson,initializeSession,datasourceName`) ·
`thread-finished-trigger` (`instanceId`) · `department-changed-trigger` ·
`initiated-by-another-automation-trigger` · `lead-created-trigger` ·
`instagram-comment-received-trigger` · `json-http-request-trigger`

**chat** — `send-text-message` (`text,buttons,breakMessages,breakMessagesIntervalInSeconds`) ·
`send-file-message` (`url,size,text,filename,mimeType,platforms`) ·
`text-input-message` (`text,parameter,timeoutWaitType,timeoutInSeconds,timeoutNextBlockId,invalidResponseMessage`) ·
`delay-message` (`seconds`)

**action** — `create-business-action` · `move-business-action` (`stageId`) ·
`win-business-action` · `add-attendant-on-business-action` (`attendantId,addSameAttendantToLead`) ·
`add-product-on-business-action` (`price,quantity,productId,productSku`) ·
`remove-product-on-business-action` · `create-lead-action` ·
`add-tag-action` / `remove-tag-action` (`tagIds,tagName`) ·
`add-list-action` / `remove-list-action` (`listIds,listName`) ·
`create-product-action` ·
`change-conversation-attendant-action` (`type,instanceId,attendantId`) ·
`change-conversation-department-action` (`…,departmentId`) ·
`change-conversation-suggestion-action` (`…,suggestion`) ·
`finish-conversation-action` · `stop-chat-automations-action`

**condition** — `lead-exists-condition` · `lead-has-tag-condition` (`tagIds`) ·
`lead-has-attendant-condition` (`attendantIds`) ·
`lead-has-business-on-pipeline-condition` (`pipelineId`) ·
`lead-has-business-on-stage-condition` (`stageId`) ·
`lead-with-phone-exists-condition` · `lead-with-additional-field-exists-condition` ·
`field-is-equal-condition` (`parameter,equalsTo`) ·
`field-contains-condition` (`parameter,contains`) ·
`field-has-value-condition` (`parameter`) ·
`between-condition` (`parameter,greaterOrEqualsTo,lessOrEqualsTo`) ·
`current-time-interval-condition` (`startTime,endTime,daysOfWeek,timezone`) ·
`conversation-has-department-condition` · `conversation-has-attendant-condition`

**delay** — `seconds-delay` (`seconds`) · `minutes-delay` · `hours-delay` (`hours`) ·
`time-interval-delay` (`startTime,endTime,daysOfWeek,timezone`) ·
`user-stop-chatting-delay` (`timeInSeconds`)

**field-operation** — `set-field-operation` (`parameter,value`) ·
`parse-date-field-operation` (`date,add,addType,timezone,datasourceName,datasourceColor`) ·
`parse-phone-field-operation` · `loop-array-field-operation`

**ai** — `chat-assistant-ai` · `chat-completion-llm-ai` · `chat-intent-ai`
(`intentions[]`, `noneNextBlockId`) · `chat-sentiment-ai` (`sentiments[]`,
`neutralNextBlockId`) · `chat-parameters-ai` (`parameters[]`) ·
`audio-transcription-ai` (`transcriptionSource`).
Comuns: `model`, `prompt`, `messagesQtd`, `considerAnnotations`,
`onlyCurrentThread`, `messageMaxHours`, `datasourceName`, `datasourceColor`.

**api** — `json-http-request-api` (`url,method,headers[],query[],body,datasourceName,datasourceColor`)

## Rotas de automações do CRM (leitura)

Base pública: `https://api.g1.datacrazy.io/api/v1/crm`, com a chave de API da conta
(`Authorization: Bearer <chave>`). O domínio antigo `crm.g1.datacrazy.io` deixa de
responder — ver KB-08 e o [comunicado oficial](https://help.datacrazy.io/pt-br/articles/10670832-comunicado-sobre-rotas-internas-datacrazy-mudancas-nas-apis-internas).

```
GET /flows?take=&skip=&order[groupOrder]=asc&order[order]=asc&filter[active]=
GET /flows/groups?take=&skip=
GET /flows/{flowId}
GET /flows/{flowId}/versions/{versionId}          <- JSON completo do fluxo
GET /flows/{flowId}/versions/{versionId}/metrics
GET /flows/{flowId}/versions/{versionId}/block
```

A UI vive em `https://crm.datacrazy.io/flow/{flowId}`.

> **Segurança:** blocos de API em fluxos reais guardam tokens Bearer em texto
> claro dentro de `headers` e `body`. Ao inspecionar ou compartilhar JSON de
> fluxo, redija esses valores. Em fluxo novo, leia o token de um parâmetro do
> sistema Secreto: `Bearer {Chave|additional-field[Chave]}`.

## Nomes internos verificados depois (set/2026)

- `business-won-trigger` (group `business`) :: `type` (`"stage"` ou `"pipeline"`),
  `stageId`, `pipelineId` — dá para escopar o "Negócio ganho" a uma etapa
  específica, sem precisar de condição de guarda.
- `days-delay` :: `days`. O bloco `delay` também aceita `refreshLeadDataOnResume`.
- `clone-business-action` (group `business`) :: `stageId` — é o "Duplicar o
  negócio". Leva os campos adicionais junto; use quando `create-business-action`
  criaria um negócio vazio.
- `send-notification-action` (group `system`) :: `attendantsIds[]`,
  `notification`, `url` — notifica **usuários/atendentes do CRM**, não grupo de
  WhatsApp. A `url` vira link de redirecionamento na notificação.

### resolvedReferences
Blocos exportados trazem `options.resolvedReferences` com os objetos completos
(`pipelines[]`, `stages[]` com `name`/`color`/`pipelineName`). É opcional na
importação, mas ótimo para conferir um fluxo sem abrir a UI.

### Importar/Exportar (envelope)
```json
{ "data": { "tags": [], "additionalFields": [], "businessLossReasons": [],
  "activityTypes": [], "pipelines": [], "departments": [], "workingHours": [],
  "automations": [ { "id","name","description","group","active","imageUrl",
    "loopLevel","versionId","versionName","version","tenantId","notes","blocks" } ] } }
```
O import **só cria, nunca atualiza**. O CRM casa o registro pelo **nome** da
automação (não pelo `id`): se já existir uma com o mesmo nome, a prévia marca
"Existente" e o botão Importar fica **desabilitado**. Para substituir um fluxo,
importe com outro nome e apague o antigo. É o caminho confiável para montar
fluxos grandes — ligar blocos arrastando handle a handle no canvas é frágil.

> O **Exportar** serializa a versão **salva**, não o estado do editor. Se você
> exportar logo após abrir a automação, pode pegar um estado ainda não
> hidratado e ler valores vazios — espere o canvas terminar de carregar.

### Renomear etapa de pipeline
O nome da coluna é editado com **duplo clique** no título. O commit acontece no
**blur** (clicar fora) — pressionar Enter atualiza a tela mas **não salva**.
O menu "..." da coluna não tem opção de renomear.
