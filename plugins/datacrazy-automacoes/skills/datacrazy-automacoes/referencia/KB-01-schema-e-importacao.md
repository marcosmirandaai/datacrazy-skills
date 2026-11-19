# KB-01 — Schema do JSON e Importação

Levantado de 52 arquivos de automações reais exportados do CRM Datacrazy (74 automações, 2.252 blocos) e de testes de importação numa conta real.

## 1. Envelope do arquivo

```json
{
  "hasInvalidReferences": false,
  "data": {
    "tags": [],
    "additionalFields": [],
    "businessLossReasons": [],
    "activityTypes": [],
    "pipelines": [],
    "departments": [],
    "workingHours": [],
    "automations": []
  }
}
```

- As oito listas de `data` precisam existir, mesmo vazias.
- `hasInvalidReferences` fica `true` quando algum bloco aponta para algo que o arquivo não declara. Um arquivo gerado deve sair com `false`, e isso só é verdade se todas as dependências estiverem declaradas (seção 3).

## 2. Objeto de automação

```json
{
  "id": "uuid-v4",
  "name": "Nome único da automação",
  "description": "O que o fluxo faz, em uma frase",
  "group": "Nome do grupo (pasta)",
  "active": false,
  "imageUrl": "",
  "loopLevel": 0,
  "versionId": "uuid-v4",
  "versionName": "Nome único da automação",
  "version": 1,
  "tenantId": "uuid-v4",
  "notes": [],
  "blocks": []
}
```

- **`name`**: o import casa automações **pelo nome**. Se já existir uma com o mesmo nome na conta, a prévia marca "Existente" e o botão Importar fica desabilitado. O import só cria, nunca atualiza.
- **`versionName`**: igual a `name`.
- **`group`**: a pasta onde a automação aparece.
- **`active`**: sempre `false`. O usuário ativa depois de testar.
- **`loopLevel`**: `0`. O valor `1` aparece em 11 de 74 automações reais; não altere sem motivo.
- **`tenantId`**: os modelos reais trazem o tenant de origem. Gere um UUID v4.
- **`notes`**: anotações visuais do canvas (seção 7).

Um arquivo pode conter **várias automações** em `data.automations`. É assim que se entrega um roteador junto com os subfluxos que ele chama (ver KB-04).

**Entrega de várias automações**: gere **um JSON só**, com todas em `data.automations`, e as dependências de todas em `data.*`. O canvas de entrega separa sozinho:
- **arquivo completo**: um Importar para tudo;
- **arquivos separados**: um por grupo de automações ligadas por "Iniciar outra automação" (quem chama e quem é chamado ficam juntos, porque o `automationId` precisa estar no mesmo arquivo), cada um só com as tags, etapas, campos e departamentos que usa;
- **por automação**: o arquivo dela, com as que ela inicia, e a cópia de blocos para colar.

Não importe a mesma automação em dois arquivos: o import casa pelo nome e marca "Existente".

## 3. Dependências: declare tudo o que você referencia

Blocos referenciam registros da conta por ID. Nas automações reais, **todo ID usado nos blocos está declarado no envelope**: 329 de 329 etapas, 43 de 43 departamentos, 55 de 55 automações chamadas, 16 de 16 motivos de perda.

Onde declarar cada referência:

- `stageId`, `pipelineId` → `data.pipelines[]`, com as etapas em `stages[]`
- `tagIds[]` → `data.tags[]`
- `additionalFieldId` e todo `additional-field[Nome]` usado em variáveis → `data.additionalFields[]`
- `departmentId` → `data.departments[]`
- `lossReasonId` → `data.businessLossReasons[]`
- `workingHoursId` → `data.workingHours[]`
- `automationId` → `data.automations[]` **do mesmo arquivo**

**Não entram no envelope** e viram Pendência para o usuário configurar depois do import: `attendantId`, `attendantsIds`, `attendantIds` (usuários e agentes), `instanceId` (conexão de WhatsApp/Instagram), `productId`, `typeId` de atividade e templates de WhatsApp.

Formas reais dos registros:

```jsonc
// data.tags[]
{ "id": "uuid", "name": "Landing page", "description": "", "color": "#C4B5FD" }

// data.pipelines[]
{
  "id": "uuid", "name": "Vendas", "description": "Funil de vendas", "image": "", "group": "COMERCIAL",
  "stages": [
    { "id": "uuid", "name": "Novo lead", "color": "#6366F1", "index": 0 },
    { "id": "uuid", "name": "Em atendimento", "color": "#22D3EE", "index": 1 }
  ]
}

// data.additionalFields[]  (entity: "lead", "lead_company", "business" ou "company" = parâmetro do sistema)
{ "id": "uuid", "name": "UTM Source", "description": "", "type": "string", "entity": "lead", "isPublic": true, "options": [] }

// data.departments[]  (id em formato ObjectId: 24 hexadecimais)
{ "id": "000000000000000000000001", "name": "Comercial", "color": "#6366F1", "main": false }

// data.businessLossReasons[]
{ "id": "uuid", "name": "Pagamento vencido", "requiredJustification": false }

// data.workingHours[]  (ids em ObjectId; weekDay 0 = domingo; horários em UTC sobre a data 1899-12-31)
{
  "id": "000000000000000000000002", "departmentId": "000000000000000000000001", "name": "Horário comercial", "timezone": "America/Sao_Paulo",
  "weekDays": [
    { "weekDay": 0, "active": false, "times": [] },
    { "weekDay": 1, "active": true, "times": [ { "startTime": "1899-12-31T12:00:00.000Z", "endTime": "1899-12-31T21:00:00.000Z" } ] }
  ]
}
```

O **nome** do campo adicional é o que liga ao `additional-field[Nome]` das variáveis: escreva exatamente igual, com acentos e espaços.

#### Campos adicionais e parâmetros na conta (medido em 08/10/2026)

A tela Configurações › Campos adicionais ganhou tipos e opções novas. O registro da conta segue este modelo (lido do código do editor):

- **`entity`**: `lead` (Lead Pessoa), `lead_company` (Lead Empresa), `business` (Negócio) e `company` (**Parâmetros do sistema**, o antigo campo da empresa, numa tela própria).
- **`entityKinds`**: `["PERSON"]`, `["COMPANY"]` ou os dois, quando o campo de Lead Pessoa tem "Mostrar também em Lead Empresa".
- **`type`** e **`additionalConfigs`**:

| Tela | `type` | `additionalConfigs` |
|---|---|---|
| Texto | `string` | `format` (`cpf`, `cnpj`, `cep`, `mobile`, `landline`) ou `regexCustom` (máscara `0` = dígito, `A` = letra, ex. `AAA-0000`), `minLength`, `maxLength` (padrão 512), `rows` (altura, até 6) |
| Número | `number` | `subtype`: `int` (padrão), `dec`, `pct`; `minValue`, `maxValue` |
| Número › Financeiro | `currency` | `minValue`, `maxValue` (a tela antiga chamava de "Moeda") |
| Data | `date` | `subtype`: `date`, `time` ou `datetime`; `format` (`DD/MM/YYYY`, `YYYY-MM-DD`, `DD.MM.YYYY`, `HH:mm:ss`, `HH:mm`, `hh:mm A`, `DD/MM/YYYY HH:mm`, `DD/MM/YYYY HH:mm:ss`, `YYYY-MM-DD HH:mm:ss` ou personalizado) |
| Booleano | `boolean` | — |
| Lista | `options` | `mode`: `single` ou `multiple`; opções em `options[]` com `label` e `color` |
| Avaliação | `rating` | `max`: 1 a 10 estrelas (padrão 5) |

- Em todos os tipos, aba Avançado: `tip` (dica ⓘ ao lado do campo), `validationRegex` (prontos: e-mail, URL, telefone, cartão de crédito, ou expressão própria) e `validationErrorMessage`.
- Fora do `additionalConfigs`: `group` (os grupos organizam a tela), `indexed` (indexa valores de 8 a 40 caracteres), `alwaysVisible` e `showInProfile` (aparece também na aba Perfil do lead).
- Campos antigos podem vir como `datetime` ou `time` no `type`.
- **Mudar o tipo ou a validação** de um campo usado em automações mostra um aviso com a lista dos fluxos.
- ❓ O `data.additionalFields` da exportação de fluxo ainda não foi medido com essas chaves novas nem com `entity: "company"`. Declare como no exemplo acima (`type`, `entity`, `isPublic`, `options`) e confira na prévia do import.

**Parâmetros do sistema** (Configurações › Parâmetros do sistema, só administrador): nome com até 26 caracteres (letras, números, espaço, `_` e `-`), descrição com até 64 e um valor. Tipos: Texto, Número, Data, Data e hora, Hora, Booleano e **Secreto**. A tela importa e exporta os parâmetros em JSON. No fluxo, leia e grave como campo adicional (KB-03, seção 4.1). Token vai em parâmetro Secreto (KB-03, seção 4.2).

> Quando o cliente já tem a pipeline, a tag ou o campo, peça o **nome exato** e declare com esse nome. A prévia do import mostra os registros por categoria para revisão antes de confirmar.

## 4. Objeto de bloco

```json
{
  "id": "uuid-v4",
  "type": "condition",
  "presentation": { "x": 0, "y": 0 },
  "sourceBlockId": null,
  "options": {}
}
```

- **`type`**: `trigger`, `chat`, `action`, `condition`, `delay`, `randomizer`, `api`, `field-operation`, `ai` ou `javascript`.
- **`sourceBlockId`**: sempre `null`. Nas automações reais ele guarda o ID do bloco de onde este foi **copiado**: nenhum dos 704 valores encontrados aponta para um bloco da mesma automação. Não participa do roteamento.

Estrutura de `options` por tipo:

```jsonc
// trigger
{ "triggers": [ item ], "nextBlockId": "" }

// chat
{ "messages": [ item ], "platform": "", "provider": "", "instanceId": "", "contactId": "",
  "timezone": "", "scheduledDate": "", "isAnnotation": false, "nextBlockId": "", "errorNextBlockId": "" }

// action
{ "actions": [ item ], "nextBlockId": "", "errorNextBlockId": "" }

// condition  (cada item de condição tem "id" e "nextBlockId" — ver seção 5)
{ "conditions": [ itemDeCondicao ], "trueNextBlockId": "", "falseNextBlockId": "" }

// delay  (o item NÃO tem group)
{ "delay": { "name": "days-delay", "options": { "days": 1 } }, "nextBlockId": "", "refreshLeadDataOnResume": true }

// randomizer
{ "randomizers": [ { "id": "uuid", "name": "A", "perc": 50, "nextBlockId": "" } ] }

// api
{ "apis": [ item ], "nextBlockId": "", "errorNextBlockId": "" }

// field-operation
{ "fieldOperations": [ item ], "nextBlockId": "", "errorNextBlockId": "" }

// ai
{ "ais": [ item ], "nextBlockId": "", "errorNextBlockId": "" }

// javascript  (SEM array de itens)
{ "javascriptCode": "…", "timeout": 30, "datasourceName": "Javascript-1", "datasourceColor": "#f97316",
  "nextBlockId": "", "errorNextBlockId": "" }
```

Formato dos itens, medido nas automações reais:

- **Gatilho, Ações e API**: `{ "name", "group", "options" }`.
- **Mensagem, Operações de campos e IA**: `{ "name", "group", "options", "stepId" }`. O `stepId` é um UUID v4 próprio de cada item; o editor gera um a cada etapa adicionada.
- **Condição**: `{ "id", "name", "group", "options", "nextBlockId" }` — `id` é UUID v4; `nextBlockId` roteia (seção 5).
- **Espera**: `{ "name", "options" }`, sem `group`.
- **Ramificação do randomizador**: `{ "id", "name", "perc", "nextBlockId" }`.

O KB-02 é o mapa de todos os itens, com nome, grupo e nível. As opções de cada item, os valores e quando usar cada um estão no KB do bloco: KB-10 (Início), KB-11 (Mensagem), KB-12 (Ações), KB-13 (Condições), KB-14 (Espera), KB-15 (Randomizador), KB-16 (API), KB-17 (Operações de campos), KB-18 (IA) e KB-19 (JavaScript).

Vários itens no mesmo bloco:

- **Condições**: 141 de 642 blocos reais têm mais de um item. Como eles se combinam depende do modo de roteamento (seção 5).
- **Ações** e **Operações de campos** executam em sequência. 43 blocos reais têm seis ou mais operações de campo.

## 5. Roteamento

Saída vazia (`""`) = o fluxo termina ali.

- `nextBlockId`: saída padrão.
- `errorNextBlockId`: falha em chat, action, api, field-operation, ai e javascript.
- `conditions[].nextBlockId`: destino quando **aquele item** de condição é verdadeiro (modo por item).
- `trueNextBlockId`: destino quando **todos** os itens de condição são verdadeiros (modo E).
- `falseNextBlockId`: destino quando **nenhuma** condição foi atendida.
- `messages[].options.buttons[].nextBlockId`: um caminho por botão da Mensagem de texto.
- `messages[].options.timeoutNextBlockId`: Entrada do usuário sem resposta no prazo.
- `randomizers[].nextBlockId`: um caminho por ramificação. Os percentuais somam 100.
- `ais[].options.intentions[].nextBlockId` e `noneNextBlockId`: Intenção de conversa.
- `ais[].options.sentiments[].nextBlockId` e `neutralNextBlockId`: Sentimento da conversa.
- `ais[].options.parameters[].emptyBlockId`: Extrator de parâmetros quando o parâmetro não é encontrado.
- `fieldOperations[].options.nextBlockId` do Loop de array: o **corpo** do loop, executado por item.
- `nextBlockId` do bloco que contém o Loop: o que roda **depois** do loop.
- `delay.options.invalidDateNextBlock` da Espera "o dia/horário": data vazia ou inválida (KB-14).
- `triggers[].options.events[].nextBlockId` (Tray) e `buttons[].nextBlockId` (Botões do Impulso): gatilhos customizados, uma saída por evento ou botão (KB-10).

Regras:

- Todo destino precisa existir **na mesma automação**.
- Vários blocos podem apontar para o mesmo destino. É assim que caminhos convergem.
- Todo bloco precisa ser alcançável a partir do gatilho.
- Itens de gatilho **não** roteiam (0 de 108 nos modelos): a saída do Início é sempre o `nextBlockId` do bloco de gatilho.

### Condições: dois modos de roteamento

Medido em 642 blocos de condição reais.

**Modo por item** — o mais usado: 239 blocos de um item e 107 de vários. Cada item leva ao próprio `nextBlockId` quando é verdadeiro; `trueNextBlockId` fica `""`; `falseNextBlockId` recebe o caso "nenhuma atendida". Use para:

- **Condição simples**, sim ou não.
- **Switch**: valores mutuamente exclusivos de um mesmo campo, cada um para um destino (status de pedido, evento de pagamento).
- **OU**: vários itens apontando para o **mesmo** destino, como "lead existe por e-mail, CPF, telefone **ou** nome".

```json
{
  "conditions": [
    { "id": "uuid-v4", "name": "field-is-equal-condition", "group": "field", "options": { "parameter": "[Api-request-1]event", "equalsTo": "SALE_APPROVED" }, "nextBlockId": "uuid-venda-aprovada" },
    { "id": "uuid-v4", "name": "field-is-equal-condition", "group": "field", "options": { "parameter": "[Api-request-1]event", "equalsTo": "PIX_GENERATED" }, "nextBlockId": "uuid-pix-gerado" }
  ],
  "trueNextBlockId": "",
  "falseNextBlockId": "uuid-evento-desconhecido"
}
```

**Modo todas verdadeiras (E)** — 170 blocos de um item e 26 de vários. Itens com `"nextBlockId": null`; `trueNextBlockId` recebe o caso em que **todas** são verdadeiras e `falseNextBlockId`, o contrário.

```json
{
  "conditions": [
    { "id": "uuid-v4", "name": "field-has-value-condition", "group": "field", "options": { "parameter": "additional-field[utm_source]" }, "nextBlockId": null },
    { "id": "uuid-v4", "name": "field-has-value-condition", "group": "field", "options": { "parameter": "additional-field[utm_campaign]" }, "nextBlockId": null }
  ],
  "trueNextBlockId": "uuid-tem-utm",
  "falseNextBlockId": "uuid-sem-utm"
}
```

Não misture os dois modos no mesmo bloco (1 caso em 141). No modo por item, use itens mutuamente exclusivos ou com o mesmo destino: a ordem de avaliação quando dois itens diferentes são verdadeiros não foi confirmada.

## 6. IDs e layout

- **Formato dos IDs**, medido em todos os IDs das automações reais:
  - **UUID v4** (`xxxxxxxx-xxxx-4xxx-[89ab]xxx-xxxxxxxxxxxx`): automações, versões, `tenantId`, blocos, `stepId`, itens de condição, botões, ramificações, intenções, parâmetros de IA, tags, pipelines, etapas, campos adicionais, motivos de perda, atendentes e listas.
  - **ObjectId**, 24 caracteres hexadecimais (ex.: `000000000000000000000001`): **departamentos**, **horários de atendimento** e **conexões** (`instanceId`) — 309 de 309 ocorrências.
- **Unicidade**: gere IDs únicos no arquivo inteiro. Exports reais às vezes repetem IDs de itens copiados entre blocos (194 itens de condição); não reproduza isso.
- **Layout** (`presentation`): o fluxo corre da esquerda para a direita. Gatilho em `{ "x": 0, "y": 0 }`.
  - **x = coluna × 457** (largura do bloco 312 + 145 de espaço, o passo mediano dos fluxos reais). Coluna = profundidade: cada bloco fica uma coluna à direita do bloco **mais distante** que chega nele, então toda ligação anda para a direita. Laços (saída que volta a um bloco anterior) não contam.
  - **y**: o 1º destino de um bloco fica na **mesma altura** dele (caminho principal reto, `y` constante). Cada destino seguinte fica abaixo do anterior: **y do anterior + altura dele + 80**. Ordem de cima para baixo: itens, botões, intenções e ramificações na ordem do bloco; depois "próximo" / "todas verdadeiras"; depois os desvios (sem resposta, nenhuma atendida, nenhuma intenção, neutro); a saída de **erro por último**.
  - **Alturas** para a conta: mensagem 250, ação 276, condição 289, espera 213, demais blocos ~260; some ~70 por item e ~30 por saída além de duas. Dois blocos na mesma coluna nunca se sobrepõem: o de baixo começa 80 px depois do fim do de cima.
  - **Tratador de erro compartilhado** (recebe 2 ou mais ligações, pelo menos metade delas de erro — ex.: uma notificação para o time): **acima** do caminho principal, `y = −(altura + 80)`, na coluna média de quem chega nele. Não vai para o fim do fluxo nem para baixo dos ramos.
  - Anotação fica acima do bloco mais alto, sem cobrir bloco.
  - Exemplo: mensagem recebida → mensagem com 2 botões → "Quero": ação mover etapa / "Agora não": ação adicionar tag; erro da mensagem e das duas ações → notificação. Gatilho `(0, 0)`, mensagem `(457, 0)`, ação do 1º botão `(914, 0)`, ação do 2º botão `(914, 356)` (276 + 80), notificação `(1371, −356)` (276 + 80, acima; coluna média de quem chega: 2, 3 e 3).
  - Com terminal, a skill `datacrazy-automacoes` faz essas contas: `node scripts/organizar.js arquivo.json arquivo.json`.

## 7. Anotações (`notes`)

```json
{
  "id": "uuid",
  "presentation": { "x": 0, "y": -400 },
  "options": { "text": "Explicação para quem mantém o fluxo", "color": "#fde68a", "width": 388, "height": 200 }
}
```

Use para documentar regras de negócio no próprio canvas: códigos de status de uma integração, o que preencher depois de importar, por que uma espera existe.

## 8. Checklist de validação

Percorra antes de entregar. Nenhum item pode falhar.

**Envelope**
- [ ] `hasInvalidReferences: false` e as oito listas de `data` presentes.

**Automação**
- [ ] As 13 chaves da seção 2, com `group` preenchido, `active: false`, `version: 1` e `versionName` igual a `name`.
- [ ] Exatamente um bloco `type: "trigger"` com ao menos um item em `triggers` — ou `triggers: []` com uma Pendência dizendo qual gatilho adicionar à mão.

**Blocos**
- [ ] Todo `id` é único no arquivo e está no formato certo: UUID v4, ou ObjectId de 24 hexadecimais para departamentos, horários e conexões.
- [ ] A estrutura de `options` segue a seção 4 para o `type` do bloco, com **todas** as chaves (ex.: bloco de Mensagem com `platform`, `provider`, `instanceId`, `contactId`, `timezone`, `scheduledDate`, `isAnnotation`, `nextBlockId` e `errorNextBlockId`). Saída vazia é `""`, nunca `null`.
- [ ] A saída do Início é o `nextBlockId` do **bloco** de gatilho; o item de gatilho não leva `nextBlockId`.
- [ ] Só itens de condição levam `id`. As opções de cada item são as do KB do bloco (ex.: comentário no lead em `comment`, não em `text`).
- [ ] Todo `name` e `group` de item existe no KB-02 com nível ✅ ou 🟡.
- [ ] `sourceBlockId: null` em todos os blocos.
- [ ] Itens de condição com `id` e `nextBlockId`; itens de Mensagem, Operações de campos e IA com `stepId`.
- [ ] Nenhum item ⚠️ (só na interface) ou ⛔ (oculto) do KB-02.

**Roteamento**
- [ ] Todo destino (próximo, erro, item de condição, todas verdadeiras, nenhuma atendida, botão, timeout, intenção, sentimento, ramificação, corpo de loop) existe na automação ou é vazio.
- [ ] Cada bloco de condição usa um único modo: por item ou todas verdadeiras.
- [ ] Todo bloco é alcançável a partir do gatilho.
- [ ] As saídas de erro de API, Mensagem, Ações e JavaScript levam a um tratamento.
- [ ] Percentuais do randomizador somam 100.
- [ ] Fluxos com espera ou follow-up checam o estado antes de cada nova mensagem.
- [ ] Toda pergunta ao lead: Mensagem de texto + Entrada do usuário sem campo do CRM no mesmo bloco, com "próximo passo" e "caso o usuário não responda" ligados.

**Referências**
- [ ] Todo `stageId`, `pipelineId`, `tagIds`, `departmentId`, `lossReasonId`, `additionalFieldId` e `workingHoursId` está declarado em `data.*`.
- [ ] Todo `additional-field[Nome]` tem um campo com esse nome exato em `data.additionalFields`.
- [ ] Todo `automationId` aponta para uma automação do mesmo arquivo.
- [ ] Todo `[fonte]caminho` referencia um `datasourceName` criado **antes**, no mesmo caminho de execução.
- [ ] Campos de caminho puro sem `{ }` e campos interpolados com `{Rótulo|caminho}` (KB-03, seção 2).

**Segurança**
- [ ] Headers `Authorization`, tokens e senhas vazios.
- [ ] Nenhuma ação destrutiva sem pedido explícito.

## 9. Exemplo completo e válido

Landing page envia os dados por webhook → normaliza o telefone → mapeia os campos → cria o lead se não existir → cria o negócio se ainda não houver na pipeline → marca a tag → avisa o time. Falha ao criar lead ou negócio vai para uma notificação de erro.

```json
{
  "hasInvalidReferences": false,
  "data": {
    "tags": [
      {
        "id": "9fff2b98-9951-4007-b0f1-6847b2ab89cb",
        "name": "Landing page",
        "description": "",
        "color": "#C4B5FD"
      }
    ],
    "additionalFields": [
      {
        "id": "c5b0f7c5-4d22-4fe1-bf45-ed4ad937217f",
        "name": "UTM Source",
        "description": "",
        "type": "string",
        "entity": "lead",
        "isPublic": true,
        "options": []
      }
    ],
    "businessLossReasons": [],
    "activityTypes": [],
    "pipelines": [
      {
        "id": "62645cdd-2399-4ad8-bf5d-4ffbd3ec8904",
        "name": "Comercial",
        "description": "Funil comercial",
        "image": "",
        "group": "COMERCIAL",
        "stages": [
          {
            "id": "8b558fc7-5c70-4cd1-8e18-aebd905b6510",
            "name": "Novo lead",
            "color": "#6366F1",
            "index": 0
          },
          {
            "id": "94ad7f68-d616-4aea-9ccf-b50ad6b2bdf3",
            "name": "Em atendimento",
            "color": "#22D3EE",
            "index": 1
          }
        ]
      }
    ],
    "departments": [],
    "workingHours": [],
    "automations": [
      {
        "id": "978af823-90f7-4f39-ab6b-a47f481154a3",
        "name": "Captura de Leads - Landing Page",
        "description": "Recebe o formulário da landing page por webhook, cria lead e negócio sem duplicar e avisa o time.",
        "group": "Webhooks",
        "active": false,
        "imageUrl": "",
        "loopLevel": 0,
        "versionId": "4b26e8fa-05b0-41ed-9574-d55876020ece",
        "versionName": "Captura de Leads - Landing Page",
        "version": 1,
        "tenantId": "00000000-0000-4000-8000-000000000000",
        "notes": [
          {
            "id": "8128e9e4-a3ea-4435-a5ba-5a3e2de4ee97",
            "presentation": {
              "x": 0,
              "y": -420
            },
            "options": {
              "text": "Depois de importar:\n1. Copie a URL do webhook no nó Início e configure na landing page.\n2. O POST deve enviar: nome, telefone, email, utm_source.\n3. Nas duas notificações, escolha quem recebe.",
              "color": "#fde68a",
              "width": 388,
              "height": 220
            }
          }
        ],
        "blocks": [
          {
            "id": "37b67148-9af4-4497-ba5a-3d56a3a6c88a",
            "type": "trigger",
            "presentation": {
              "x": 0,
              "y": 0
            },
            "sourceBlockId": null,
            "options": {
              "triggers": [
                {
                  "name": "json-http-request-trigger",
                  "group": "http",
                  "options": {
                    "datasourceName": "Api-request-1",
                    "datasourceColor": "#3b82f6"
                  }
                }
              ],
              "nextBlockId": "e4c08f8f-f6e5-4950-a92a-a3b7c8d74c14"
            }
          },
          {
            "id": "e4c08f8f-f6e5-4950-a92a-a3b7c8d74c14",
            "type": "field-operation",
            "presentation": {
              "x": 457,
              "y": 0
            },
            "sourceBlockId": null,
            "options": {
              "fieldOperations": [
                {
                  "name": "parse-phone-field-operation",
                  "group": "field",
                  "stepId": "55ac00bc-ceba-43ef-8c9c-966916d8e58b",
                  "options": {
                    "phone": "{telefone|[Api-request-1]telefone}",
                    "defaultCountry": "BR",
                    "datasourceName": "phone-1",
                    "datasourceColor": "#6366f1"
                  }
                }
              ],
              "nextBlockId": "159c26b9-2205-4741-80fa-e88f1c8c38e0",
              "errorNextBlockId": "18b34bd9-6e27-4e9a-80d2-7027f8f15e4a"
            }
          },
          {
            "id": "159c26b9-2205-4741-80fa-e88f1c8c38e0",
            "type": "field-operation",
            "presentation": {
              "x": 914,
              "y": 0
            },
            "sourceBlockId": null,
            "options": {
              "fieldOperations": [
                {
                  "name": "set-field-operation",
                  "group": "field",
                  "stepId": "dab82b92-1e66-476d-a243-d9bce850dc59",
                  "options": {
                    "parameter": "leadName",
                    "value": "{nome|[Api-request-1]nome}"
                  }
                },
                {
                  "name": "set-field-operation",
                  "group": "field",
                  "stepId": "832460a9-41e5-4787-a58a-d7fe9c30c73b",
                  "options": {
                    "parameter": "leadPhone",
                    "value": "{phone|[phone-1]phone}"
                  }
                },
                {
                  "name": "set-field-operation",
                  "group": "field",
                  "stepId": "2aa92253-c5f7-46b3-a297-56f83f47ba10",
                  "options": {
                    "parameter": "leadEmail",
                    "value": "{email|[Api-request-1]email}"
                  }
                },
                {
                  "name": "set-field-operation",
                  "group": "field",
                  "stepId": "848a19f1-fa92-4922-95bc-4c9e9b01873d",
                  "options": {
                    "parameter": "additional-field[UTM Source]",
                    "value": "{utm_source|[Api-request-1]utm_source}"
                  }
                }
              ],
              "nextBlockId": "4d865395-3900-4c6b-adfc-8b6da15b1cb9",
              "errorNextBlockId": "18b34bd9-6e27-4e9a-80d2-7027f8f15e4a"
            }
          },
          {
            "id": "4d865395-3900-4c6b-adfc-8b6da15b1cb9",
            "type": "condition",
            "presentation": {
              "x": 1371,
              "y": 0
            },
            "sourceBlockId": null,
            "options": {
              "conditions": [
                {
                  "id": "89c5e889-ae0c-45aa-a3c7-a087f6b3a96c",
                  "name": "lead-with-phone-exists-condition",
                  "group": "lead",
                  "options": {
                    "phone": "{phone|[phone-1]phone}"
                  },
                  "nextBlockId": "a5881a56-0156-4736-96a2-adb598cefbb6"
                }
              ],
              "trueNextBlockId": "",
              "falseNextBlockId": "43b75c68-263f-4a63-baf9-69f74b826c2c"
            }
          },
          {
            "id": "43b75c68-263f-4a63-baf9-69f74b826c2c",
            "type": "action",
            "presentation": {
              "x": 1828,
              "y": 300
            },
            "sourceBlockId": null,
            "options": {
              "actions": [
                {
                  "name": "create-lead-action",
                  "group": "lead",
                  "options": {}
                }
              ],
              "nextBlockId": "a5881a56-0156-4736-96a2-adb598cefbb6",
              "errorNextBlockId": "18b34bd9-6e27-4e9a-80d2-7027f8f15e4a"
            }
          },
          {
            "id": "a5881a56-0156-4736-96a2-adb598cefbb6",
            "type": "condition",
            "presentation": {
              "x": 2285,
              "y": 0
            },
            "sourceBlockId": null,
            "options": {
              "conditions": [
                {
                  "id": "9c075636-8277-4845-8fdd-218eaecf141a",
                  "name": "lead-has-business-on-pipeline-condition",
                  "group": "lead",
                  "options": {
                    "pipelineId": "62645cdd-2399-4ad8-bf5d-4ffbd3ec8904"
                  },
                  "nextBlockId": "79ffeff6-eef5-4941-ae84-f00b6a80c96c"
                }
              ],
              "trueNextBlockId": "",
              "falseNextBlockId": "55258393-6022-462d-b7e9-5481d12789be"
            }
          },
          {
            "id": "79ffeff6-eef5-4941-ae84-f00b6a80c96c",
            "type": "action",
            "presentation": {
              "x": 2742,
              "y": -300
            },
            "sourceBlockId": null,
            "options": {
              "actions": [
                {
                  "name": "add-lead-comment-action",
                  "group": "lead",
                  "options": {
                    "comment": "Lead voltou pela landing page. UTM: {UTM Source|additional-field[UTM Source]}"
                  }
                }
              ],
              "nextBlockId": "",
              "errorNextBlockId": ""
            }
          },
          {
            "id": "55258393-6022-462d-b7e9-5481d12789be",
            "type": "action",
            "presentation": {
              "x": 2742,
              "y": 300
            },
            "sourceBlockId": null,
            "options": {
              "actions": [
                {
                  "name": "create-business-action",
                  "group": "business",
                  "options": {
                    "stageId": "8b558fc7-5c70-4cd1-8e18-aebd905b6510"
                  }
                }
              ],
              "nextBlockId": "0238571f-0373-40e2-94b6-44e883d5a3d9",
              "errorNextBlockId": "18b34bd9-6e27-4e9a-80d2-7027f8f15e4a"
            }
          },
          {
            "id": "0238571f-0373-40e2-94b6-44e883d5a3d9",
            "type": "action",
            "presentation": {
              "x": 3199,
              "y": 300
            },
            "sourceBlockId": null,
            "options": {
              "actions": [
                {
                  "name": "add-tag-action",
                  "group": "lead",
                  "options": {
                    "tagIds": [
                      "9fff2b98-9951-4007-b0f1-6847b2ab89cb"
                    ],
                    "tagName": "Landing page"
                  }
                }
              ],
              "nextBlockId": "03fa533a-65d6-4dc1-a6be-bc79c897974b",
              "errorNextBlockId": ""
            }
          },
          {
            "id": "03fa533a-65d6-4dc1-a6be-bc79c897974b",
            "type": "action",
            "presentation": {
              "x": 3656,
              "y": 300
            },
            "sourceBlockId": null,
            "options": {
              "actions": [
                {
                  "name": "send-notification-action",
                  "group": "system",
                  "options": {
                    "attendantsIds": [],
                    "notification": "Novo lead da landing page: {Nome do lead|leadName} ({Telefone do lead|leadPhone})",
                    "url": ""
                  }
                }
              ],
              "nextBlockId": "",
              "errorNextBlockId": ""
            }
          },
          {
            "id": "18b34bd9-6e27-4e9a-80d2-7027f8f15e4a",
            "type": "action",
            "presentation": {
              "x": 1828,
              "y": -600
            },
            "sourceBlockId": null,
            "options": {
              "actions": [
                {
                  "name": "send-notification-action",
                  "group": "system",
                  "options": {
                    "attendantsIds": [],
                    "notification": "Falha ao processar lead da landing page: {Mensagem de erro|lastErrorMessage}",
                    "url": ""
                  }
                }
              ],
              "nextBlockId": "",
              "errorNextBlockId": ""
            }
          }
        ]
      }
    ]
  }
}
```

## 10. Colar blocos num fluxo existente

Além de importar um arquivo, o editor aceita **colar blocos** (Ctrl+V) dentro de uma automação aberta. O formato é o mesmo que o editor coloca na área de transferência quando você copia blocos: uma **lista de nós do canvas**, sem envelope.

```json
[
  {
    "data": {
      "id": "uuid-do-bloco",
      "type": "delay",
      "sourceBlockId": null,
      "options": { "delay": { "name": "minutes-delay", "options": { "minutes": 60 } }, "nextBlockId": "uuid-do-proximo-bloco-colado", "refreshLeadDataOnResume": true },
      "presentation": { "x": 457, "y": 0 }
    },
    "id": "uuid-do-bloco",
    "type": "delay",
    "deletable": true,
    "position": { "x": 457, "y": 0 },
    "width": 312,
    "height": 213,
    "selected": true
  }
]
```

Regras:

- Cada nó leva o **bloco inteiro** em `data`, com as mesmas chaves do formato de importação e nesta ordem: `id`, `type`, `sourceBlockId`, `options`, `presentation`.
- Fora de `data`, repita `id` e `type` e acrescente `deletable: true`, `position` (igual a `presentation`), `width: 312`, `height` e `selected: true`. Alturas copiadas do editor: ação 276, condição 289, mensagem 229 a 250, espera 213.
- **Sem bloco de gatilho**: o fluxo de destino já tem o nó Início. Depois de colar, ligue o Início (ou o bloco anterior) ao bloco de entrada.
- As ligações vêm dos `nextBlockId` dentro de `data.options`. Aponte só para blocos da própria colagem: destino fora dela fica desconectado.
- **A colagem não leva dependências.** Tags, etapas, pipelines, campos adicionais, parâmetros do sistema e departamentos precisam **já existir na conta**. Use os IDs reais informados pelo usuário; sem eles, liste esses itens em Pendências para reselecionar depois de colar.
- Uma automação por colagem. Subfluxos chamados por "Iniciar outra automação" precisam do Importar.

Quando usar cada formato:

- **Importação** (arquivo `.json`): automação nova, fluxo com tags, etapas ou campos novos, roteador + subfluxos.
- **Colagem**: acrescentar um trecho a um fluxo que já existe, usando registros que já estão na conta.

Você não escreve os dois formatos: gere sempre o JSON de **importação**. O canvas de entrega (template no fim das instruções) converte para colagem no botão **Copiar blocos**.
