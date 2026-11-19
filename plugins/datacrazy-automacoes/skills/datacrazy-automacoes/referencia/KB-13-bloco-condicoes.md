# KB-13 — Bloco Condições — `type: "condition"`

"Faça filtros para seguir caminhos diferentes." É o bloco que **decide o caminho**: 642 blocos nos modelos, o terceiro mais usado. Prefira condição a IA sempre que o critério for determinístico (tem tag, está na etapa, campo igual a X): é grátis, instantâneo e não erra.

Níveis ✅ 🟡 ⚠️ ⛔: ver KB-10.

---

## 1. Estrutura e roteamento

```json
{
  "id": "uuid-v4",
  "type": "condition",
  "presentation": { "x": 457, "y": 0 },
  "sourceBlockId": null,
  "options": {
    "conditions": [
      { "id": "uuid-v4", "name": "field-is-equal-condition", "group": "field", "options": { "parameter": "[webhook-kirvano]event", "equalsTo": "SALE_APPROVED" }, "nextBlockId": "uuid-venda-aprovada" },
      { "id": "uuid-v4", "name": "field-is-equal-condition", "group": "field", "options": { "parameter": "[webhook-kirvano]event", "equalsTo": "PIX_GENERATED" }, "nextBlockId": "uuid-pix-gerado" }
    ],
    "trueNextBlockId": "",
    "falseNextBlockId": "uuid-evento-desconhecido"
  }
}
```

- Item: `{ "id", "name", "group", "options", "nextBlockId" }`, sem `stepId`.
- **Três tipos de saída** no canvas:
  - **"Se esta condição for verdadeira"**: uma por item, `conditions[].nextBlockId`.
  - **"Todas as condições forem verdadeiras"**: `trueNextBlockId`.
  - **"Quando não atender a nenhuma condição"**: `falseNextBlockId`.

### Os dois modos (escolha um por bloco)

| Modo | Como montar | Use para | Nos modelos |
|---|---|---|---|
| **Por item** | Cada item com o próprio `nextBlockId`; `trueNextBlockId: ""`; `falseNextBlockId` = nenhuma atendida. | **Sim/não** simples (1 item); **switch** (valores exclusivos do mesmo campo, um destino cada); **OU** (vários itens com o **mesmo** destino). | 346 blocos |
| **Todas verdadeiras (E)** | Itens com `"nextBlockId": null`; `trueNextBlockId` = todas verdadeiras; `falseNextBlockId` = caso contrário. | Exigir várias coisas ao mesmo tempo: tem UTM **e** tem campanha, está na etapa **e** sem atendente. | 196 blocos |

- A ordem de avaliação quando **dois itens diferentes** são verdadeiros no modo por item não foi confirmada. Faça itens mutuamente exclusivos ou com o mesmo destino.
- **Condições em cascata** (bloco → bloco) também funcionam e deixam o fluxo legível. Os modelos oficiais de carrinho abandonado usam 4 condições em fila para 4 eventos.
- Saída vazia (`""`) encerra o fluxo naquele caminho. **Sempre decida o que acontece em "nenhuma atendida"**, nem que seja uma notificação de "evento desconhecido".

---

## 2. Mapa de decisão

| Quero saber se… | Condição | Nível |
|---|---|---|
| o contato já é lead | Lead existente | ✅ |
| existe lead com este e-mail / telefone / CPF / nome | Lead com email/telefone/CPF/nome existente | ✅ |
| existe lead com um valor num campo adicional (ID do Instagram, código do cliente) | Procura se existe um lead com um campo adicional | 🟡 |
| o lead tem negócio numa pipeline / etapa (fluxo **sem** negócio na sessão) | Lead possui negócio na pipeline / na etapa | ✅ |
| o **negócio da sessão** ainda está numa etapa (gatilho de negócio; conferir depois de uma espera) | Negócio atual está na etapa | ✅ |
| o pedido já foi lançado (deduplicação) | Negócio com ID externo existente | ✅ |
| existe negócio com valor num campo adicional | Procura se existe um negócio com um campo adicional | ✅ |
| o negócio está ganho / perdido / pendente | Negócio está ganho / perdido / pendente | ✅ / 🟡 / 🟡 |
| o negócio tem atendente / não tem / tem o produto | Negócio possui atendentes / sem atendentes / possui o produto | ✅ / ✅ / 🟡 |
| o lead tem uma tag | Verifica se o lead possui uma tag | ✅ |
| o lead tem dono / a conversa tem atendente | Lead possuir atendente responsável / Conversa possuir atendente responsável | ✅ |
| a conversa está num departamento / finalizada / com bot ligado | Conversa em departamento / Conversa finalizada / Automações de chat estão habilitadas | 🟡 |
| posso mandar texto livre na API Oficial (janela de 24 h) | Janela de conversa está aberta | ✅ |
| existe conversa aberta para o lead (e trazê-la para a sessão) | Lead possui conversa em aberto | 🟡 |
| um campo é igual / contém / tem valor / está entre | Campo com valor igual / contém / possui valor / entre dois valores | ✅ |
| um campo contém algum de vários textos | Campo contém algum dos textos | ✅ |
| estamos em horário comercial | Verifica se a hora atual está em um intervalo de dia/hora | ✅ |
| o contato segue o perfil no Instagram | Seguidor do Instagram | 🟡 |

---

## 3. Leads — `group: "lead"`

### Lead existente — `lead-exists-condition` ✅

"Verifica se o lead já está cadastrado", usando os dados de contato **já mapeados na sessão**. `options`: `{}`. 36 usos em 31 automações.

- **Use**: antes de **Criar lead** (32 de 36 vezes). Nos gatilhos de mensagem, logo no início.
- Em webhook, mapeie Nome + Telefone/E-mail **antes** (Mapeamento de campo).

### Lead com email / telefone / CPF / nome existente ✅

| `name` | `options` | Quando usar |
|---|---|---|
| `lead-with-email-exists-condition` | `email` (variável) | Plataformas que identificam por e-mail (Hotmart, Eduzz, formulários). |
| `lead-with-phone-exists-condition` | `phone` (variável) | WhatsApp e checkouts. Passe o telefone **normalizado** por Análise de telefone: `{phone\|[phone-1]phone}`. |
| `lead-with-taxid-exists-condition` | `taxId` (variável) | B2B e ERPs (Bling, Tray): CPF/CNPJ é o identificador estável. |
| `lead-with-name-exists-condition` | `name` (variável) | Último recurso: nomes repetem. |

- **Padrão dos modelos** (identidade por vários dados, em OU): e-mail existe? → telefone existe? → CPF existe? → Lead existente → Criar lead. Em blocos seguidos ou num bloco por item com o mesmo destino.

### Procura se existe um lead com um campo adicional — `lead-with-additional-field-exists-condition` 🟡 · Procura se existe um negócio com um campo adicional — `business-with-additional-field-exists-condition` ✅

```json
{ "id": "uuid-v4", "name": "lead-with-additional-field-exists-condition", "group": "lead", "options": { "additionalFieldId": "uuid-do-campo", "type": "equal", "value": "{sender.id|[Message-1]sender.id}" }, "nextBlockId": "uuid-ja-cadastrado" }
```

| Opção | Na interface | Valores |
|---|---|---|
| `additionalFieldId` | Campo adicional para procurar | UUID declarado em `data.additionalFields` (entidade `lead` ou `business`). |
| `type` | Tipo de comparação | `"equal"` (padrão) · `"contains"` |
| `value` | Valor para comparar | Variável. |

- ⚠️ O CRM avisa (selo "Atenção"): "procura o **primeiro** lead (ou negócio) encontrado com esse valor… **Ele não verifica o lead atual.** Para verificar o campo do lead atual, utilize as condições de campo."
- **Use**:
  - Identificar contatos sem telefone, como o `sender.id` do Instagram (modelo oficial "Instagram DM → WhatsApp").
  - Identificar pedidos por um ID externo guardado em campo de negócio (modelo "Integração Tray": "ID Externo Tray").
- **Não use** para "o lead tem o campo X preenchido": isso é **Campo possui valor** com `additional-field[X]`.

### Lead possui negócio na pipeline — `lead-has-business-on-pipeline-condition` ✅ · na etapa — `lead-has-business-on-stage-condition` ✅

| `name` | `options` | Quando usar |
|---|---|---|
| pipeline | `pipelineId` | Antes de criar negócio: tem → **Mover**; não tem → **Criar**. |
| etapa | `stageId` | Fluxo que **não** começa num negócio (mensagem, tag, webhook, agendado): saber se o lead tem algum negócio na etapa, como faixas de inatividade (31–90, 91–180, 181+ dias como etapas). |

- **Com gatilho de negócio, não use esta condição para "o negócio ainda está na etapa?".** Ela procura entre **todos** os negócios do lead: com dois carrinhos, dá verdadeiro mesmo se o carrinho da sessão já foi pago, e o negócio que ela encontra pode passar a ser o da sessão (as ações seguintes mexem no negócio errado). Use **Negócio atual está na etapa** (seção 4).
- Quando encontra, o negócio fica disponível para as ações seguintes. Nos modelos: "na etapa" → Mover negócio (72×) ou "Conversa possui atendente" (48×).
- **Várias etapas**: um bloco por item com destinos diferentes (switch de etapa; 118 itens em blocos múltiplos).

### Lead possui conversa em aberto — `lead-has-open-conversation-condition` 🟡

"Verifica se a conversa da sessão está em aberto; caso não esteja, busca por uma conversa em aberto e atribui à sessão."

```json
{ "id": "uuid-v4", "name": "lead-has-open-conversation-condition", "group": "lead", "options": { "type": "find-conversation-in-instance", "instanceId": "000000000000000000000001" }, "nextBlockId": "uuid-tem-conversa" }
```

- `type`: `"current-conversation"` · `"all-conversations"` · `"find-conversation-in-instance"` (+ `instanceId`). Significado igual às ações de conversa (KB-12).
- **Use**:
  - Em fluxos **sem conversa de origem** (negócio ganho, tag, webhook), antes de mandar mensagem: tem conversa aberta → Mensagem herdando a conexão; não tem → template ou notificação.
  - Para não incomodar quem está em atendimento humano: aberta → espera; fechada → segue a cadência.

### Verifica se o lead possui uma tag — `lead-has-tag-condition` ✅

`options`: `{ "tagIds": ["uuid"] }`. "Será verdadeiro se o lead possuir **pelo menos uma** das tags informadas."

- Várias tags no mesmo item = **OU**. Para **E**, use um item por tag no modo "todas verdadeiras".
- **Use**: tags de estado e controle ("Em atendimento", "Chamar pela manhã", "msg-vend" para não reenviar), segmentação.

### Lead possuir atendente responsável — `lead-has-attendant-condition` ✅

`options`: `{ "attendantIds": [] }`. "Deixe em branco para considerar qualquer um."

- `[]`: tem **algum** dono → mantém; não tem → distribui.
- Com IDs: é **daquele** vendedor (Pendência). Nos modelos: transferência por setor que respeita a carteira.

### ⛔ `lead-has-additional-fields-condition`

Oculta no catálogo. Para "lead tem o campo preenchido", use **Campo possui valor**.

---

## 4. Negócios — `group: "business"`

| Condição | `name` | `options` | Quando usar |
|---|---|---|---|
| Negócio atual está na etapa | `business-is-on-stage-condition` ✅ | `stageId` | O **negócio da sessão** (gatilho de negócio) está em X? **Padrão para cadências que nascem de um negócio**: carrinho abandonado, cobrança, follow-up de proposta. Antes de cada toque, depois de cada espera: ainda está na etapa? → envia; saiu (pagou, avançou, foi removido) → encerra. Diferente de "Lead possui negócio na etapa", que procura entre os negócios do lead e erra com lead de vários negócios. |
| Negócio está ganho | `business-is-won-condition` ✅ | `{}` | Não mandar cobrança ou follow-up a quem já comprou. |
| Negócio está perdido | `business-is-lost-condition` ✅ | `{}` | Pular a cadência de negócios perdidos. |
| Negócio está pendente | `business-is-pending-condition` 🟡 | `{}` | Ainda em aberto: segue o follow-up. |

Formato confirmado no editor (out/2026, cadência de carrinho da EB Educação):

```json
{ "id": "uuid-v4", "name": "business-is-on-stage-condition", "group": "business", "options": { "stageId": "uuid-da-etapa" }, "nextBlockId": null }
```

Em modo "todas verdadeiras": `trueNextBlockId` = ainda na etapa (envia o toque); `falseNextBlockId` = saiu da etapa (encerra a cadência).
| Negócio possui atendentes | `business-has-attendants-condition` ✅ | `attendantsIds` (`[]` = qualquer) | Já tem vendedor → avisa o vendedor; não tem → distribui. Com IDs: vendedor específico (148 itens em blocos switch nos modelos). |
| Negócio sem atendentes | `business-attendant-empty-condition` ✅ | `{}` | Mesmo uso, lido ao contrário. |
| Negócio possui o produto | `business-has-product-condition` 🟡 | `productId` ou `productSku` | Upsell ou pós-venda específico por produto comprado. |
| Negócio com ID externo existente | `business-with-external-id-exists-condition` ✅ | `externalId` (variável) | **Deduplicação de pedidos**: o ID do pedido já foi lançado? Sim → Mover/atualizar. Não → Criar negócio + gravar `businessExternalId`. 60 usos. |

```json
{ "id": "uuid-v4", "name": "business-with-external-id-exists-condition", "group": "business", "options": { "externalId": "{id|[webhook-bling]data.id}" }, "nextBlockId": "uuid-atualiza-pedido" }
```

- Também serve com um ID "de conversa": `{Código da conversa|threadCode}` como ID externo cria **um negócio por atendimento** (10 usos nos modelos).

---

## 5. Mensagens — `group: "messages"`

| Condição | `name` | `options` | Quando usar |
|---|---|---|---|
| Conversa possuir atendente responsável | `conversation-has-attendant-condition` ✅ | `attendantIds` (`[]` = qualquer) | Humano já está na conversa → não roda o bot, só avisa. Base da distribuição e das transferências (114 itens em switch por atendente). |
| Janela de conversa está aberta | `conversation-window-is-open-condition` ✅ | `hours` (padrão `24`) | "Verifica se a última mensagem **recebida** está dentro da janela." Na **API Oficial**: aberta → texto livre; fechada → Template. Em conexões não oficiais, pode medir "respondeu nas últimas X horas". |
| Conversa em departamento | `conversation-has-department-condition` 🟡 | `departmentId` (ObjectId em `data.departments`) | Rotas por setor atual: se já está no Financeiro, não manda o menu. |
| Conversa finalizada | `conversation-has-finalized-condition` ✅ | `{}` | Depois de uma espera: o atendimento foi encerrado? Então não envia o lembrete. |
| Automações de chat estão habilitadas | `conversation-automation-is-enabled` 🟡 | `{}` | Respeitar quem desativou o bot (humano assumiu): habilitadas → segue; desabilitadas → para. |

- **Janela de conversa como "o lead falou nas últimas N horas"** (medido em 24/10/2026): `hours` só aceita horas cheias (mínimo 1). Serve para follow-up por automação: Espera N h → esta condição com `hours: N` → verdadeiro = ele falou, volta a esperar; falso = silêncio, manda o follow-up. Teste disso leva no mínimo 1 h.

---

## 6. Campos — `group: "field"`

Todas usam `parameter` em **caminho puro** (KB-03): `leadEmail`, `additional-field[Nome]`, `[fonte]caminho`.

| Condição | `name` | `options` | Quando usar |
|---|---|---|---|
| Campo com valor igual | `field-is-equal-condition` ✅ | `parameter` · `equalsTo` (texto ou variável) | **Switch de evento ou status** do webhook: a condição mais usada (289). Status numéricos também são texto: `"equalsTo": "9"`. |
| Campo contém valor | `field-contains-condition` ✅ | `parameter` · `contains` | Parte do texto: serviço de frete "SEDEX" ou "PAC", observação "Pedido Loja", origem que contém "instagram", DDI "55". |
| Campo possui valor | `field-has-value-condition` ✅ | `parameter` | O dado veio? (CNPJ, telefone, UTM, ID da nota). Proteja mapeamentos e mensagens personalizadas. 90 usos. |
| Campo possui um valor entre dois valores | `between-condition` ✅ | `parameter` · `greaterOrEqualsTo` · `lessOrEqualsTo` (números; padrão 0 e 9999) | Faixas numéricas: dias sem compra 31–90 / 91–180 / 181–9999, score, ticket. **Valores iguais aos limites contam como verdadeiros.** |
| Campo contém algum dos textos | `field-matches-n-text-values` ✅ | `parameter` · `type` (`"contains"` padrão) · `keywords` (lista) | Várias respostas possíveis para o mesmo destino: faixa de faturamento de formulário ("Até R$10 mil", "Entre R$10 mil e R$50 mil"). Evita um item por texto. |

```json
{ "id": "uuid-v4", "name": "between-condition", "group": "field", "options": { "parameter": "[Javascript-dias]dados.diferencaDias", "greaterOrEqualsTo": 31, "lessOrEqualsTo": 90 }, "nextBlockId": "uuid-faixa-31-90" }
```

- **Comparar com vazio**: use "Campo possui valor", não `equalsTo: ""`. Nos modelos aparece `equalsTo: "null"` para payloads que mandam o texto "null".

---

## 7. Tempo — `group: "time"`

### Verifica se a hora atual está em um intervalo de dia/hora — `current-time-interval-condition` ✅

```json
{ "id": "uuid-v4", "name": "current-time-interval-condition", "group": "time", "options": { "daysOfWeek": [1, 2, 3, 4, 5], "startTime": "1970-01-01T12:00:00.000Z", "endTime": "1970-01-01T21:00:00.000Z", "timezone": "America/Sao_Paulo" }, "nextBlockId": "uuid-horario-comercial" }
```

| Opção | Na interface | Valores |
|---|---|---|
| `daysOfWeek` | Dias da semana a considerar | 0 = domingo … 6 = sábado. |
| `startTime` / `endTime` | Intervalo de horas | Hora em **UTC** sobre `1970-01-01`. São Paulo (UTC−3): 09:00 = `T12:00`, 18:00 = `T21:00`, 00:00 = `T03:00`, 23:59 = `T02:59:59`. |
| `timezone` | Fuso horário | `"America/Sao_Paulo"`. |

- **Use**:
  - **Horário comercial**: dentro → humano; fora → bot ou "retornaremos às 9h".
  - **Plantão por turno**: vários itens, um por turno, cada um com um grupo de atendentes. Nos modelos "Distribuição Equipe 2": 36 condições em cascata → Randomizador por turno.
- Para **esperar** até entrar no horário em vez de desviar, use a Espera "intervalo de hora nos dias da semana" (KB-14).

---

## 8. Instagram e Empresa

- **Seguidor do Instagram** — `instagram-follower` 🟡 (`group: "instagram"`), `options`: `{}`. Brinde só para seguidores ("siga o perfil para receber o link").
- ⛔ `company-has-additional-field-condition`: oculta no catálogo, não use.

---

## 9. Padrões prontos

| Objetivo | Montagem |
|---|---|
| Cadastro sem duplicar (webhook) | Mapeamento → **Lead com telefone existente** (→ atualiza campos) / não → Criar lead → **Lead possui negócio na pipeline** → Mover / Criar negócio. |
| Pedido sem duplicar | **Negócio com ID externo existente** → sim: Mover etapa conforme status · não: Criar negócio + gravar `businessExternalId`. |
| Roteador de eventos | Um bloco **por item** com `field-is-equal-condition` por evento + `falseNextBlockId` para "desconhecido". |
| Atendimento humano x bot | **Conversa possuir atendente responsável** → sim: notifica · não: fluxo do bot. |
| API Oficial fora da janela | **Janela de conversa está aberta** → sim: texto · não: template. |
| Evitar reenvio | **Lead possui a tag** "enviado-X" → sim: fim · não: envia + adiciona a tag. |
| Faixas de valor | Bloco por item com `between-condition` e faixas sem sobreposição. |

## 10. Erros comuns

1. **Misturar modos** no mesmo bloco (item com destino + `trueNextBlockId`).
2. **`parameter` interpolado** (`{…|…}`) em condição de campo: precisa de caminho puro.
3. **Itens sobrepostos** no modo por item com destinos diferentes.
4. **"Nenhuma atendida" sem destino** em roteadores: eventos novos somem.
5. **Procurar lead por campo adicional** para testar o lead atual.
6. **Telefone sem normalizar** em "Lead com telefone existente": não encontra quem existe.
7. **Horário em hora local** em vez de UTC na condição de tempo.
