# KB-10 — Bloco Início (Gatilhos) — `type: "trigger"`

O Início é o único bloco que ninguém liga a ele: é o evento que abre a sessão da automação. Todo fluxo tem **exatamente um** bloco `trigger`, e ele define duas coisas que mudam o resto do desenho:

1. **Quando** o fluxo roda.
2. **Com que contexto** ele começa: se já existe lead, negócio e conversa na sessão ou se o fluxo precisa encontrá-los.

Fontes: código do editor do CRM (set/2026), textos de ajuda da interface, 74 automações reais e os modelos oficiais do Datacrazy.

**Níveis** (valem para todos os KB-1x):
- ✅ **Produção**: visto nas automações reais exportadas. Estrutura provada no import.
- 🟡 **Editor**: nome, grupo e opções iniciais tirados do código do editor, sem uso nos modelos. Pode usar; registre a Pendência "conferir o item no CRM após importar".
- ⚠️ **Só na interface**: depende de integração, upload ou recurso da conta que um LLM não gera. Construa o resto e oriente configurar à mão.
- ⛔ **Oculto**: existe no código, mas não aparece no catálogo. Nunca use.

---

## 1. Estrutura do bloco

```json
{
  "id": "uuid-v4",
  "type": "trigger",
  "presentation": { "x": 0, "y": 0 },
  "sourceBlockId": null,
  "options": {
    "triggers": [
      { "name": "json-http-request-trigger", "group": "http", "options": { "datasourceName": "Api-request-1", "datasourceColor": "#3b82f6" } }
    ],
    "nextBlockId": "uuid-do-primeiro-bloco"
  }
}
```

- Item de gatilho: `{ "name", "group", "options" }`. Sem `id`, sem `stepId`, sem roteamento próprio.
- Saída única: **"Quando o evento ocorrer, então"** = `options.nextBlockId`.
- **Vários itens** em `triggers`: qualquer um dispara o fluxo, e todos seguem pelo mesmo `nextBlockId`. Nos modelos:
  - 4 a 6 "Mensagem recebida" iguais, uma por conexão.
  - "Iniciado por outra automação" + "Execução manual", para rodar o mesmo fluxo chamado por outro ou à mão. Com ação de negócio no fluxo, a execução manual chega sem negócio: ponha "Lead possui negócio…" antes da ação, ou separe em duas automações se o lead puder ter vários negócios (KB-12, regra das ações de negócio).
  - "Mensagem recebida" + "Iniciado por outra automação", para um menu que abre sozinho ou é chamado de volta.
- **Gatilhos customizados** (Tray e Botões do Impulso) substituem todos os outros itens e criam **uma saída por evento ou botão** (seção 9).

---

## 2. Mapa de decisão

| Preciso disparar quando… | Gatilho | Nível |
|---|---|---|
| o lead manda mensagem no WhatsApp/Instagram | Mensagem recebida | ✅ |
| o atendente (ou o sistema) envia uma mensagem | Mensagem enviada | ✅ |
| um atendimento abre ou fecha | Atendimento iniciado / finalizado | ✅ |
| a conversa muda de departamento | Departamento alterado | 🟡 |
| um sistema externo avisa (checkout, formulário, ERP, n8n) | Requisição HTTP (Webhook) | ✅ |
| outro fluxo chama este (subfluxo reutilizável) | Iniciado por outra automação | ✅ |
| a cada X minutos ou num horário fixo | Execução agendada | ✅ |
| eu quero rodar à mão para uma lista de leads | Execução manual por lead ou contato | ✅ |
| um negócio entra numa etapa | Negócio movido | ✅ |
| um negócio nasce numa etapa | Negócio criado | 🟡 |
| um negócio é ganho / perdido / restaurado | Negócio ganho / perdido / Situação restaurada | ✅ / 🟡 / 🟡 |
| um atendente entra ou sai do negócio | Atendente atribuído / retirado do negócio | 🟡 |
| uma tag entra ou sai do lead | Tag adicionada / removida do lead | 🟡 |
| um lead é criado (qualquer origem) | Lead criado | 🟡 |
| um campo do lead ou do negócio muda | Campo alterado | 🟡 |
| o lead completa N compras, passa de R$ X ou fica X dias sem comprar | Métricas do lead | 🟡 |
| o lead faz aniversário, no dia ou alguns dias antes | É aniversário do Lead | 🟡 |
| alguém comenta num post ou live | Comentário do Instagram/Facebook, em live | 🟡 |
| um lead preenche formulário de Lead Ads | Formulário do Facebook | 🟡 |
| um agente de IA chama uma ferramenta | MCP Server Tool | 🟡 |
| uma atividade com automação é executada | Atividade executada | 🟡 |
| chega um evento da loja Tray | Tray | ⚠️ |
| alguém clica num botão de template de Impulso | Gatilho de Botões do Impulso | ⚠️ |

**Webhook × gatilho nativo**: se existe gatilho nativo para o evento (negócio ganho, tag, campo alterado), use o nativo. Ele já traz lead e negócio na sessão e dispensa mapeamento. Webhook é para o que acontece **fora** do CRM.

---

## 3. Contexto que cada gatilho entrega

Decide se o primeiro bloco de Mensagem pode herdar a conexão e se o fluxo precisa achar ou criar o lead.

| Gatilho | Lead | Negócio | Conversa | Consequência no desenho |
|---|---|---|---|---|
| Mensagem recebida/enviada, Atendimento iniciado/finalizado, Departamento alterado | sim | não* | sim | Mensagem **herda** a conexão (`instanceId: ""`). |
| Negócio movido/criado/ganho/perdido/restaurado, Atendente no negócio | sim | sim | não | Fixe a conexão no bloco de Mensagem **ou** use a condição "Lead possui conversa em aberto" (KB-13) para trazer a conversa. |
| Tag, Lead criado, Campo alterado, Métricas do lead, Aniversário do lead | sim | depende | não | Idem acima. |
| Execução manual por lead | sim | não | só se rodar pelo contato | Fixe a conexão. |
| Iniciado por outra automação | herda | herda | herda | Recebe a sessão de quem chamou + parâmetros. |
| Webhook, Execução agendada, MCP Server Tool | não | não | não | Mapeie os dados → verifique/crie lead → negócio. Para agendado, busque a lista numa API e use Loop de array. |
| Comentários (Instagram/Facebook), Formulário do Facebook | contato do comentário/formulário | não | não | Responda o comentário no próprio canal; para WhatsApp, capture o telefone. |

\* Para agir sobre um negócio a partir de uma mensagem, use antes "Lead possui negócio na pipeline/etapa" (KB-13).

---

## 4. Leads — `group: "lead"`

### Execução manual da automação por lead ou contato — `manually-lead-trigger` ✅

Roda o fluxo **à mão**: a partir de uma seleção ou filtro de leads (tags, lista, leads avulsos), até **1.000 leads** por execução, ou pelo contato dentro do multiatendimento. Para volumes maiores, o CRM indica criar um **Impulso**.

- `options`: `{}`.
- **Use para**: reativação de base ("leads inativos +180 dias" nos modelos), campanhas pontuais, correção em massa, testar um subfluxo com um lead real.
- **Combine** com "Iniciado por outra automação" para que o mesmo fluxo também seja chamado por outros.
- **Não traz negócio na sessão** (sem `businessId`), mesmo que o lead tenha um. Antes de qualquer ação de negócio, use a condição "Lead possui negócio na pipeline/etapa" (regra no KB-12).
- **Cuidado**: não existe conversa de origem. Mensagens precisam de conexão fixa, e para WhatsApp API Oficial, de template fora da janela de 24 h. Nos modelos: manual → condição de etapa/tag → "Espera de um intervalo de hora" → Template do WhatsApp.

### Tag adicionada ao lead — `lead-tag-added-trigger` 🟡 · Tag removida do lead — `lead-tag-removed-trigger` 🟡

Disparam quando **uma das tags** selecionadas entra (ou sai) do lead.

```json
{ "name": "lead-tag-added-trigger", "group": "lead", "options": { "tagIds": ["uuid-da-tag"] } }
```

- `tagIds`: lista de tags, que precisam estar declaradas em `data.tags`.
- **Use para**: dar ao atendente um "botão" dentro do CRM. Por exemplo, marcar a tag "Enviar proposta" dispara o envio, e marcar "Não perturbe" desliga as automações de chat.
- **Cuidado com loop**: se o próprio fluxo adiciona a mesma tag, ele se redispara. Remova a tag no fim ou use outra tag de controle.

### Lead criado — `lead-created-trigger` ✅

Qualquer criação de lead: manual, importação, formulário, WhatsApp, API.

- `options`: `{}`. Modelo oficial "Boas-vindas": Lead criado → Mensagem de texto.
- **Cuidado**:
  - Um bloco de Mensagem que é o único da automação **precisa de conexão fixa**.
  - Fluxos que criam leads (webhook, formulário) também disparam este gatilho. Evite mandar boas-vindas duplicadas.

### Métricas do lead 🟡

| Na interface | `name` | `options` | Quando usar |
|---|---|---|---|
| Lead atingir uma quantidade definida de negócios ganhos | `lead-won-businesses-count-trigger` | `count` (número) | Programa de fidelidade: 3ª compra → tag VIP, cupom. |
| Lead ultrapassar um valor definido de negócios ganhos | `lead-won-businesses-value-trigger` | `value` (número, R$) | Cliente passou de R$ 5.000 → atendente dedicado. |
| Lead não realiza compras nos últimos dias | `lead-without-buying-trigger` | `days` (número) | Recompra e reativação: 60 dias sem comprar → oferta. |

⚠️ O CRM avisa que esses gatilhos são **processados em segundo plano, em horários imprevisíveis**, às vezes horas depois da mudança. Antes de enviar mensagem, coloque "Espera de um intervalo de hora nos dias da semana" (KB-14) para não mandar de madrugada.

### É aniversário do Lead — `lead-birthday-trigger` 🟡

"Inicia uma automação todos os dias para os Leads que fazem aniversário conforme os filtros." Gatilho novo, visto numa exportação real em 05/10/2026; o import ainda não foi testado.

```json
{ "name": "lead-birthday-trigger", "group": "lead", "options": { "id": "uuid-v4", "timezone": "America/Sao_Paulo", "executeAt": "09:00", "leadsTagsFilter": [], "daysBeforeBirthday": 0 } }
```

| Opção | Na interface | Valores | Quando usar |
|---|---|---|---|
| `id` | (gerado pelo editor) | UUID v4 próprio de cada item | Sempre, como na Execução agendada. |
| `executeAt` | "Horário de Disparo" | `"HH:MM"` | Hora do disparo no fuso escolhido. `"09:00"` evita mensagem de madrugada. |
| `timezone` | "Fuso horário" | IANA (`"America/Sao_Paulo"`) | Sempre. |
| `daysBeforeBirthday` | "Dias antes do aniversário (0 para no dia)" | 0 a 30 | `0`: parabéns no dia. `3` a `7`: oferta ou convite antes da data. |
| `leadsTagsFilter` | "Filtrar por Tags" | lista (`[]` = todos os leads) | Restringe aos leads com as tags. O formato de cada item ainda não apareceu numa exportação: registre a Pendência "conferir o filtro de tags no CRM". |

- **Contexto**: o lead fica na sessão; não há negócio nem conversa. Mensagem precisa de **conexão fixa** (seção 3).
- ⚠️ O CRM avisa: dias antes entre 0 e 30, e **no máximo 100 leads por minuto e 1.000 leads por dia**.
- Mais de um item no mesmo Início dispara em horários diferentes. A exportação de referência tem dois, às 03:19 e às 03:22.
- A data usada é a de nascimento do lead (`birthDate`, que o Mapeamento de campo grava, KB-17).

---

## 5. Negócios — `group: "business"`

### Negócio movido — `business-entered-trigger` ✅

"Quando um negócio é movido para a etapa."

```json
{ "name": "business-entered-trigger", "group": "business", "options": { "stageId": "uuid-da-etapa" } }
```

- `stageId`: etapa declarada em `data.pipelines[].stages`.
- **Use para**: o funil comanda o fluxo. "Proposta enviada" → manda o PDF. "Pagamento aprovado" → onboarding. "Perdido por preço" → reengajamento.
- Quando o negócio pode **nascer** direto na etapa, adicione também "Negócio criado" com a mesma etapa.

### Negócio criado — `business-created-trigger` ✅

"Quando um negócio é criado em uma etapa." `options`: `{ "stageId": "…" }`. Use para a primeira abordagem de todo negócio novo numa pipeline, independente da origem.

### Negócio ganho — `business-won-trigger` ✅ · Negócio perdido — `business-lost-trigger` 🟡 · Situação do negócio restaurada — `business-restore-status-trigger` 🟡

```json
{ "name": "business-won-trigger", "group": "business", "options": { "type": "stage", "pipelineId": "uuid-da-pipeline", "stageId": "uuid-da-etapa" } }
```

| Opção | Na interface | Valores | Quando usar |
|---|---|---|---|
| `type` | "Verifica se a automação será iniciada quando o negócio for ganho na etapa ou na pipeline" | `"pipeline"` (padrão) · `"stage"` | `"pipeline"`: qualquer ganho daquela pipeline. `"stage"`: só o ganho que acontece numa etapa específica, como "Pedido aprovado". |
| `pipelineId` | Pipeline | UUID ou `""` | `""` = qualquer pipeline. |
| `stageId` | Etapa | UUID ou `""` | `""` com `type: "pipeline"`. |
| `receiveJson`, `datasourceName`, `datasourceColor` | "Receber fonte de dados do provedor do negócio" (só **perdido**) | boolean, texto, cor | Ligue quando precisar ler dados do negócio perdido numa fonte de dados. |

- **Ganho**: pós-venda, onboarding, NPS, enviar a venda para outro sistema (modelo "DataCrazy → Metrito": ganho → JavaScript monta o payload → API).
- **Perdido**: pesquisa de motivo, remarketing depois de X dias, devolver o lead para uma cadência.
- **Restaurado**: desfazer o que o ganho ou a perda fez, como remover tags e voltar a cadência.

### Atendente atribuído ao negócio — `business-attendant-included-trigger` ✅ · Atendente retirado do negócio — `business-attendant-removed-trigger` 🟡

`options`: `{ "attendantId": "" }`. `""` = qualquer atendente; preenchido = só aquele (Pendência).

- **Use para**: avisar o lead de que tem um consultor ("Oi, sou a Ana e vou cuidar do seu pedido") e criar a atividade de primeiro contato para o atendente.
- **Retirado**: devolver para a fila de distribuição.

### ⛔ `manually-business-trigger`

Execução manual por negócio. Oculto no catálogo; não use.

---

## 6. Mensagens — `group: "messages"`

### Mensagem recebida — `message-received-trigger` ✅

O gatilho de todo atendimento automático. 25 usos em 12 automações.

```json
{ "name": "message-received-trigger", "group": "messages", "options": { "type": "contains", "keywords": [], "instanceId": "", "listenGroup": false, "receiveJson": true, "initializeSession": "only-if-finished", "datasourceName": "Message-1", "datasourceColor": "#3b82f6" } }
```

| Opção | Na interface | Valores (padrão) | Quando usar cada valor |
|---|---|---|---|
| `instanceId` | "Qual a instância que irá ouvir as mensagens" | `""` = todas · ObjectId (Pendência) | `""` quando o fluxo vale para qualquer número. Fixe quando cada conexão tem um fluxo (comercial × suporte). Para ouvir 2 de 5 conexões, use **um item por conexão**. |
| `keywords` | "Palavras-chaves para iniciar a automação. Deixe em branco para iniciar com qualquer mensagem." | lista de textos (`[]`) | Vazio: todo contato entra. Preenchido: fluxo de comando ("ENCERRAR", "menu", "eu quero"). |
| `type` | "Tipo da comparação das palavras-chaves" | `"contains"` (padrão) · `"equal"` | `"equal"` para comandos exatos (1 de 25 nos modelos: `["ENCERRAR","encerrar"]`). `"contains"` para frases de anúncio ("vim pelo anúncio"). |
| `initializeSession` | "Indica as condições para iniciar uma nova sessão" | ver abaixo | — |
| `listenGroup` | "Ouvir mensagens enviadas em grupos" | `false` | `true` só em fluxos de grupo (moderação, captura de participantes). |
| `receiveJson` | "Receber fonte de dados do provedor da mensagem" | `false` | `true` quando o fluxo lê o payload bruto: dados do anúncio de origem, ID do remetente no Instagram, tipo de mídia. |
| `datasourceName` / `datasourceColor` | "Fonte de dados da mensagem" | `"Message-1"` | Nome da fonte com o payload, lida em `[Message-1]…`. |

**`initializeSession`: quando começa uma nova sessão**

| Valor | Na interface | Use quando | Nos modelos |
|---|---|---|---|
| `"only-if-finished"` | Iniciar apenas se o contato não estiver atualmente nesta automação | **Padrão para conversas**: menu, qualificação, IA, qualquer fluxo com Entrada do usuário ou espera. Sem isso, a resposta do lead abre uma segunda sessão em paralelo. | 13 |
| `"only-if-finished-service"` | Iniciar apenas se o último atendimento já foi finalizado | Triagem e boas-vindas que **não podem interromper** um atendimento humano aberto. | 6 |
| `"always"` | Iniciar sempre | Fluxos instantâneos, sem espera nem pergunta: tracking de anúncio, comando "ENCERRAR", roteador por palavra-chave. | 6 |
| `"once"` | Iniciar uma única vez para o contato | Ação que só pode acontecer uma vez por contato: resposta ao comentário "eu quero", brinde, boas-vindas únicas. | modelo oficial |

**Payload com `receiveJson: true`** (varia por provedor; confirme na inspeção da sessão):
- texto: `[Message-1]text.body` (modelo oficial).
- anúncio Click-to-WhatsApp, API Oficial: `[Message-1]referral.source_id`, `referral.thumbnail_url`.
- anúncio, conexão não oficial: `[Message-1]content.contextInfo.externalAdReply.*`.
- Instagram: `[Message-1]sender.id`. Guarde num campo adicional, porque o Instagram não tem telefone.

**Depois deste gatilho**, nos modelos: "Lead existente" (12×) → "Criar lead"; "Campo possui valor"; espera de segundos para agrupar mensagens.

### Mensagem enviada — `message-sended-trigger` ✅

"Quando uma mensagem é enviada." Mesmas opções da Mensagem recebida, e mais:

| Opção | Na interface | Valores | Quando usar |
|---|---|---|---|
| `includeScheduledMessages` | "Considerar mensagens agendadas" | `false` (padrão) · `true` | `true` dispara **duas vezes**: quando a mensagem é agendada e quando é enviada. Só ligue se as duas fazem sentido. |
| `listenGroup` | "Monitorar mensagens enviadas em grupos" | `false` | — |

- **Use para**: follow-up a partir da ação do atendente. Modelos "Follow-Up": mensagem enviada → "Lead possui negócio na pipeline" → espera → cobra resposta. Também para registrar o último contato ou mover a etapa quando o vendedor manda a proposta.
- **Cuidado**: mensagens que o próprio fluxo envia também são mensagens enviadas. Use `initializeSession: "only-if-finished"` e uma tag ou condição para não entrar em loop.

### Atendimento iniciado — `thread-initialized-trigger` ✅ · Atendimento finalizado — `thread-finished-trigger` ✅

`options`: `{ "instanceId": "" }`. `""` = qualquer conexão; os modelos repetem um item por conexão.

- **Iniciado**: marcar "Em atendimento", avisar o lead de que um humano assumiu, pausar cadências.
- **Finalizado**: NPS, remover tags de atendimento (modelo "Finalizar atendimento": 42 itens → Remover tags), mensagem de encerramento, mover a etapa.

### Departamento alterado — `department-changed-trigger` ✅

```json
{ "name": "department-changed-trigger", "group": "messages", "options": { "departmentId": "000000000000000000000001", "instanceId": "" } }
```

- `departmentId`: ObjectId declarado em `data.departments`.
- `instanceId`: `""` = qualquer.
- **Use para**: quando a conversa vai para "Financeiro", mandar o menu financeiro ou notificar o time. Separa a triagem da ação de cada setor.

---

## 7. Instagram e Facebook

⚠️ O CRM marca os gatilhos de comentário como **beta**: funcionam só para contas parceiras conectadas direto no app do Datacrazy. Registre como Pendência "confirmar que a conta está habilitada".

### Comentário do Instagram recebido — `instagram-comment-received-trigger` 🟡 · Comentário do Facebook recebido — `facebook-comment-received-trigger` 🟡

```json
{ "name": "instagram-comment-received-trigger", "group": "instagram", "options": { "instanceId": "", "keywords": ["eu quero"], "type": "equal", "initializeSession": "once", "filterMedia": false, "receiveJson": false } }
```

| Opção | Na interface | Quando usar |
|---|---|---|
| `instanceId` | Instância que ouve os comentários | `""` = todas. |
| `keywords` + `type` | Palavras-chave e comparação | Campanha "comenta EU QUERO": `"equal"` ou `"contains"`. |
| `initializeSession` | Mesmos 4 valores da Mensagem recebida | `"once"` evita responder duas vezes a quem comenta de novo. |
| `filterMedia` + `filterMediaId` | "Filtrar mídia específica" | Só um post ou reel da campanha. O ID da mídia é escolhido na interface (Pendência). |
| `receiveJson` + `datasourceName` | "Receber fonte de dados do provedor do comentário" | Ler texto e autor do comentário. |

**Padrão oficial**: comentário → Randomizador com 3 respostas públicas diferentes (Resposta do Comentário, KB-11) → Mensagem no direct. Variar a resposta pública parece menos robô.

### Comentário em live — `live-instagram-comment-received-trigger` 🟡 · `live-facebook-comment-received-trigger` 🟡

`options`: `instanceId`, `keywords`, `type`, `initializeSession`, `receiveJson`, `datasourceName`, `datasourceColor`. Use para "comenta QUERO na live e recebe o link".

### Formulário do Facebook — `meta-form-trigger` 🟡

"Quando um lead preenche um formulário de Lead Ads."

```json
{ "name": "meta-form-trigger", "group": "facebook", "options": { "integrationId": "", "pageId": "", "formId": "", "datasourceName": "meta-form-1", "datasourceColor": "#3b82f6" } }
```

- `integrationId`, `pageId`, `formId`: **Pendência obrigatória**; escolhidos na interface depois de conectar a integração do Facebook.
- `datasourceName`: "Fonte de dados do lead", com as respostas do formulário.
- O token do Facebook dura cerca de 60 dias; a interface oferece "Renovar conexão".
- **Depois**: Mapeamento de campo (nome, telefone, e-mail) → Análise de telefone → verificar/criar lead → negócio. É o mesmo desenho do webhook.

---

## 8. Campos, HTTP, Sistema e Atividades

### Campo alterado — `field-changed-trigger` 🟡 (`group: "field"`)

"Quando um campo do lead ou negócio é alterado." Só monitora **campos do lead, do negócio e campos adicionais de lead e negócio**. Não monitora fontes de dados nem parâmetros do sistema (o antigo campo da empresa).

```json
{ "name": "field-changed-trigger", "group": "field", "options": { "parameter": "additional-field[Status do pedido]", "changeType": "specific", "operator": "equal", "value": "Enviado" } }
```

| Opção | Na interface | Valores | Quando usar |
|---|---|---|---|
| `parameter` | "Qual campo deseja monitorar?" | caminho puro: `leadEmail`, `additional-field[Nome]` | — |
| `changeType` | "Modo de disparo" | `"any"` (padrão) · `"specific"` | `"any"`: qualquer alteração (sincronizar com outro sistema). `"specific"`: só quando atinge um valor. |
| `operator` | "Operador" (só com `"specific"`) | `"equal"` · `"contains"` · `"between"` · `"has-value"` | `equal`: status exato. `contains`: parte do texto. `between`: faixa numérica (score, valor). `has-value`: o campo foi preenchido pela primeira vez. |
| `value` | "Valor de comparação" | texto | Com `equal` e `contains`. |
| `greaterOrEqualsTo`, `lessOrEqualsTo` | "está entre … e" | números (padrão 0 e 9999) | Com `between`. |

- **Use para**: um atendente ou integração muda um campo e o fluxo reage. Status do pedido "Enviado" → rastreio; campo "CPF" preenchido → consulta; "Score" entre 80 e 100 → vendedor sênior.
- **Cuidado com loop**: se o fluxo altera o mesmo campo que monitora, ele se redispara.

### Requisição HTTP (Webhook) — `json-http-request-trigger` ✅ (`group: "http"`)

"Quando uma requisição HTTP é recebida." É o gatilho mais usado: 22 automações.

```json
{ "name": "json-http-request-trigger", "group": "http", "options": { "datasourceName": "webhook-kirvano", "datasourceColor": "#3b82f6" } }
```

- `datasourceName`: o corpo recebido vira `[webhook-kirvano]campo`. Nomeie pela origem (`webhook-bling`, `tray-webhook`, `gatilho`); o padrão é `"Api-request-1"`.
- A **URL é única por automação** e aparece no gatilho depois de salvar (Pendência: "copiar a URL e cadastrar na plataforma de origem").
- **Só o primeiro** gatilho de webhook do fluxo é acionado; não coloque dois.
- Há **limite de requisições por minuto** conforme o plano; em disparos em massa, fale com o suporte.
- **Desenho típico**, medido nos modelos:
  1. Condição por item no campo de evento (`[fonte]event`), um destino por evento (252 condições "Campo com valor igual").
  2. Mapeamento de campo + Análise de telefone.
  3. Lead com telefone/e-mail existente → Criar lead.
  4. Negócio com ID externo existente (deduplicação) → Criar ou Mover negócio.
- Para ver o JSON recebido e escolher caminhos, dispare um teste e use a inspeção da sessão.

### Iniciado por outra automação — `initiated-by-another-automation-trigger` ✅ (`group: "system"`)

"Quando a automação é iniciada por outra automação." 34 itens em 20 automações.

```json
{ "name": "initiated-by-another-automation-trigger", "group": "system", "options": { "datasourceName": "Api-request-1", "datasourceColor": "#3b82f6" } }
```

- Recebe a **sessão de quem chamou** (lead, negócio, conversa; só há negócio se quem chamou o tinha na sessão) e os **parâmetros** enviados pela ação "Iniciar outra automação" (KB-12). Os parâmetros ficam na fonte `datasourceName` (KB-03).
- **Use para**: subfluxos reutilizáveis, como transferência por setor, distribuição de atendentes, menu principal, envio de boas-vindas e tratamento de erro. Nos modelos: "Menu Inicial" chama "Transferência Financeiro/Comercial/Compras/Revenda".
- Quem chama e quem é chamado ficam **no mesmo arquivo de importação** (`automationId` aponta para outra automação do arquivo).

### MCP Server Tool — `mcp-server-tool-trigger` ✅ (`group: "system"`)

"Trigger acionada quando um agente de IA chama uma tool via MCP." Transforma o fluxo numa **ferramenta** que um agente de IA externo (Claude, n8n, agente do próprio CRM) pode chamar.

```json
{
  "name": "mcp-server-tool-trigger",
  "group": "system",
  "options": {
    "name": "consultar_pedido",
    "description": "Consulta o status de um pedido pelo número. Use quando o cliente perguntar onde está a compra.",
    "parameters": [
      { "name": "numero_pedido", "description": "Número do pedido informado pelo cliente", "type": "string", "required": true }
    ],
    "includeConversationId": true,
    "includeBusinessId": false,
    "includeLeadId": false,
    "datasourceName": "tool-input",
    "datasourceColor": "#3b82f6"
  }
}
```

| Opção | Na interface | Quando usar |
|---|---|---|
| `name` | Nome da tool | `snake_case`, verbo + objeto. É o que o agente vê. |
| `description` | Descrição da tool | Escreva **quando** o agente deve chamar a ferramenta. Uma descrição ruim faz o agente não usar ou usar errado. |
| `parameters[]` | `name`, `description`, `type`, `required` | `type`: `"string"`, `"number"`, `"boolean"`, `"date"`, `"array"`, `"object"`. Marque `required` só no que é indispensável. |
| `includeConversationId` / `includeBusinessId` / `includeLeadId` | "Parâmetro de sessão": Conversa, Negócio ou Lead | O MCP passa a exigir esse ID, e a sessão fica **ligada** àquela conversa, negócio ou lead. Ações como mover etapa e enviar mensagem agem no registro certo. Sem isso, o fluxo roda sem contexto. |
| `datasourceName` | Fonte de dados de entrada | Parâmetros recebidos: `[tool-input]numero_pedido`. |

- **Termine sempre** com a ação "Retornar resultado da tool" (`set-tool-result-action`, KB-12). É ela que devolve a resposta ao agente.

**Medido em 02/10/2026** no servidor MCP da conta (`POST https://mcp.g1.datacrazy.io/api/mcp`, com a chave da conta):

- **`required` não é validado.** O servidor aceita a chamada sem o parâmetro, e o que não veio fica fora do `tool-input`. Confira os parâmetros indispensáveis com "Campo possui valor" (KB-13) e devolva um resultado que oriente o agente.
- ⚠️ **Vazamento de tokens.** Quando a execução quebra sem chegar ao "Retornar resultado da tool", o `tools/call` devolve ao chamador `parameters.additionalFields` com o **valor real** dos campos e parâmetros do sistema lidos no fluxo, tokens incluídos. Guarde token em parâmetro **Secreto**, que não entra nesse objeto (medido em 08/10/2026, KB-03, seção 4.2). **Todo caminho** deve terminar em "Retornar resultado": próximo passo, saídas de erro de API, JavaScript e Ações, e o "nenhuma" das condições.
- 🟡 **Depois do import**, o "Parâmetro de sessão" (Conversa, Negócio, Lead) pode ficar desligado. Confira no Início antes de ativar e registre a Pendência "conferir o Parâmetro de sessão da ferramenta".

### Execução agendada — `cron-job-trigger` ✅ (`group: "system"`)

"Dispara a automação em um intervalo de tempo fixo."

```json
{ "name": "cron-job-trigger", "group": "system", "options": { "id": "uuid-v4", "mode": "interval", "intervalInMinutes": 60 } }
```

```json
{ "name": "cron-job-trigger", "group": "system", "options": { "id": "uuid-v4", "mode": "cron", "cronExpression": "0 9 * * 1-5", "timezone": "America/Sao_Paulo" } }
```

| Opção | Valores | Quando usar |
|---|---|---|
| `id` | UUID v4 próprio | Sempre. |
| `mode` | `"interval"` (padrão) · `"cron"` | `interval`: sincronizações contínuas (a cada 30 min). `cron`: horário de relógio (todo dia 9h, segunda a sexta). 🟡 no modo cron. |
| `intervalInMinutes` | número, **mínimo 15**, padrão 60 | Com `interval`. |
| `cronExpression` | minuto hora dia mês dia-da-semana (padrão `"0 * * * *"`) | Com `cron`. |
| `timezone` | IANA (`"America/Sao_Paulo"`) | Com `cron`. |

- **Sem lead e sem conversa**. O fluxo precisa buscar o que processar: API (listar pedidos ou propostas) → Loop de array → ação por item. Modelo "Tray / Propostas Bling": agendado (30 min) → API → Loop → Criar produto e negócio.
- Não use para "mandar mensagem todo dia para os leads". Para isso, use Execução manual ou Impulso com uma lista.

### Atividade executada — `activity-executed-trigger` 🟡 (`group: "activities"`)

"Quando uma atividade com automação é executada." `options`: `{}`.

- É o par da ação "Criar atividade" com `flowId` ("Executar uma automação", KB-12). O vendedor conclui a atividade "Ligar para o lead" e o fluxo segue: registra, move a etapa, agenda a próxima.

---

## 9. Gatilhos customizados ⚠️

Os dois substituem todos os outros itens do Início e desenham **uma saída por evento ou botão**, em vez do `nextBlockId` único.

### Tray — `tray-trigger` ⚠️ (`group: "integrations"`)

"Quando um evento é recebido da integração Tray."

```jsonc
{ "name": "tray-trigger", "group": "integrations", "options": {
  "integrationId": "",            // Pendência: integração Tray da conta
  "events": [ { "id": "uuid-v4", "eventType": "ORDER_INSERT", "name": "Pedido inserido", "nextBlockId": "uuid-fluxo-pedido-novo" } ]
} }
```

- `eventType`: `ORDER_INSERT`, `ORDER_UPDATE`, `PRODUCT_INSERT`, `PRODUCT_UPDATE`, `PRODUCT_DELETE`, `PRODUCT_STOCK_UPDATE`, `PRODUCT_PRICE_UPDATE`, `CUSTOMER_INSERT`, `CUSTOMER_UPDATE`, `CUSTOMER_DELETE`.
- Precisa da integração Tray conectada. Monte os caminhos de cada evento e oriente o usuário a selecionar a integração e os eventos no Início. Alternativa que importa sem pendência: webhook da Tray + condição por evento.

### Gatilho de Botões do Impulso — `boost-buttons-trigger` ⚠️ (`group: "boosts"`)

"Gatilho acionado quando um botão de um template do impulso for clicado." `options`: `boostId` (o Impulso), mais uma saída por botão do template (`buttons[].nextBlockId`). Só existe com um Impulso criado e pode não aparecer no catálogo da conta. Configure na interface.

---

## 10. Erros comuns

1. **Dois blocos `trigger`** ou gatilho fora do bloco Início. É um único bloco com vários itens.
2. **`initializeSession: "always"`** em fluxo com pergunta ou espera: cada resposta do lead abre outra sessão, e as mensagens se duplicam.
3. **Mensagem sem conexão** em fluxo disparado por negócio, tag, aniversário, webhook, agendamento ou execução manual: não há conversa para herdar.
4. **Loop de gatilho**: o fluxo adiciona a tag, altera o campo ou envia a mensagem que ele mesmo monitora.
5. **Dois webhooks** na mesma automação: só o primeiro recebe.
6. **Agendado tratando lead**: o gatilho agendado não traz lead. Busque os dados e itere.
7. **Métrica do lead + mensagem imediata**: o disparo pode chegar de madrugada. Espere a janela de horário.
8. **Webhook para evento interno** (negócio ganho, tag): use o gatilho nativo.
9. **MCP Server Tool com um caminho sem "Retornar resultado da tool"**: a execução quebra e o agente recebe os parâmetros Texto lidos no fluxo, tokens incluídos.
10. **Confiar no `required`** dos parâmetros da tool: o servidor MCP não valida. Confira com condição.
11. **Aniversário com mais de 30 dias antes** ou `executeAt` fora do formato `"HH:MM"`: o editor não aceita.
