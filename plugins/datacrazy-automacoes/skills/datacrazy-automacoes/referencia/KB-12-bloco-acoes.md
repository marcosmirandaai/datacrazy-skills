# KB-12 — Bloco Ações — `type: "action"`

"Execute ações no sistema." É o bloco que **muda o CRM**: cria e move negócios, cadastra leads, mexe em tags, transfere conversas, chama outros fluxos, avisa pessoas e cria atividades. 712 blocos nos modelos, o segundo mais usado.

Níveis ✅ 🟡 ⚠️ ⛔: ver KB-10.

---

## 1. Estrutura do bloco

```json
{
  "id": "uuid-v4",
  "type": "action",
  "presentation": { "x": 914, "y": 0 },
  "sourceBlockId": null,
  "options": {
    "actions": [
      { "name": "create-business-action", "group": "business", "options": { "stageId": "uuid-da-etapa" } },
      { "name": "add-tag-action", "group": "lead", "options": { "tagIds": ["uuid-da-tag"], "tagName": "" } }
    ],
    "nextBlockId": "uuid-do-proximo",
    "errorNextBlockId": "uuid-do-tratamento"
  }
}
```

- Item: `{ "name", "group", "options" }`, **sem** `stepId`.
- **Várias ações no mesmo bloco rodam em sequência**, na ordem da lista. Agrupe o que acontece junto: criar negócio + tag, transferir atendente do negócio + da conversa + departamento.
- **Saídas**:
  - **"Próxima passo"** (`nextBlockId`).
  - **"Caso ocorrer erro na execução da ação"** (`errorNextBlockId`): etapa inexistente, negócio ausente na sessão, atendente inválido. Ligue a um tratamento em fluxos críticos; a mensagem fica em `{Mensagem do último erro|lastErrorMessage}`.
- O editor marca **Remover negócio** e **Deletar lead** com o selo "Atenção" (`dangerLevel: "warning"`): são irreversíveis.

---

## 2. Mapa de decisão

| Preciso… | Ação | Nível |
|---|---|---|
| cadastrar o contato como lead (sem duplicar) | Criar lead | ✅ |
| abrir um negócio numa etapa | Criar negócio | ✅ |
| mudar o negócio de etapa (inclusive de pipeline) | Mover negócio de etapa | ✅ |
| copiar o negócio para outra pipeline levando os campos | Duplicar o negócio | ✅ |
| marcar ganho / perdido / reabrir | Ganhar / Perder / Restaurar negócio | ✅ / ✅ / 🟡 |
| definir quem cuida do negócio / tirar | Transferir um atendente ao negócio / Remover o atendente do negócio | ✅ / 🟡 |
| lançar produtos, desconto e frete de um pedido | Adicionar/Remover produto, Descontos e frete, Criar produto | ✅ |
| marcar o lead | Adicionar tags / Remover tags / Criar tags | ✅ |
| segmentar em listas | Adicionar / Remover / Criar listas | ✅ / 🟡 / 🟡 |
| registrar algo no cadastro do lead | Adicionar comentário no lead | ✅ |
| definir o responsável pelo lead | Transferir um atendente ao lead / Remover atendente do lead | ✅ / 🟡 |
| distribuir leads e conversas entre vários atendentes, com uma saída por atendente | Distribuidor de atendentes | 🟡 |
| passar a conversa para um humano, setor ou agente de IA | Transferir atendente / departamento da conversa | ✅ |
| abrir / encerrar o atendimento | Iniciar / Finalizar o atendimento | ✅ |
| impedir o bot de falar por cima do humano | Desativar as automações de chat na conversa | ✅ |
| sugerir uma resposta ao atendente | Adicionar sugestão de resposta | 🟡 |
| avisar usuários do CRM | Enviar notificação | ✅ |
| chamar um subfluxo | Iniciar outra automação | ✅ |
| devolver resposta a um agente de IA (MCP) | Retornar resultado da tool | 🟡 |
| criar tarefa para o vendedor | Criar atividade | ✅ |
| apagar negócio ou lead | Remover negócio / Deletar lead | ✅ / 🟡 — só com pedido explícito |

---

## 3. Negócios — `group: "business"`

Toda ação de negócio age sobre o **negócio da sessão**. Ele existe quando:
- o gatilho é de negócio;
- o fluxo acabou de criar ou duplicar um;
- uma condição o encontrou ("Lead possui negócio na pipeline/etapa", "Negócio com ID externo existente").

Sem negócio na sessão, a ação cai na saída de erro (`flow-business-not-found`).

> **Regra: não use ação de negócio sem o negócio mapeado na sessão.** Antes de Mover, Ganhar, Perder ou qualquer ação do grupo `business`, confira de onde vem o negócio em **todos** os gatilhos do bloco Início, porque cada um abre a sessão de um jeito:
> - **Execução manual por lead** (`manually-lead-trigger`, inclusive pela rota `execute-lead`) **não traz `businessId`**, mesmo que o lead tenha negócio. Medido em 30/10/2026: lead com negócio → `flow-business-not-found`.
> - **Iniciado por outra automação** só traz o negócio se a automação que chamou o tinha na sessão. Se quem chama sempre tem o negócio, não procure de novo: "Lead possui negócio…" busca entre todos os negócios do lead e pode trocar o da sessão por outro (KB-13).
> - Execução manual por lead e Iniciado por outra automação no mesmo Início (padrão comum nos modelos, KB-10 e KB-04): ponha "Lead possui negócio…" logo depois do gatilho, que cobre os dois casos quando o lead tem **um** negócio só nessa pipeline. Se ele pode ter vários (inclusive ganhos ou perdidos), a condição pode trocar o negócio de quem chamou: separe em duas automações. A manual faz "Lead possui negócio…" e depois **Iniciar outra automação** para a que tem as ações; o negócio encontrado vai junto na sessão.
>
> **Como resolver:** em gatilho que não traz negócio (execução manual por lead, mensagem, tag, webhook, agendado), logo depois do gatilho use a condição **Lead possui negócio na pipeline** (ou **na etapa**). Encontrou → o negócio entra na sessão e as ações podem seguir. Não encontrou → crie o negócio ou encerre por outro caminho.

### Criar negócio — `create-business-action` ✅

"Cria um novo negócio para o lead." `options`: `{ "stageId": "uuid" }`, etapa declarada em `data.pipelines[].stages`.

- **Use**: primeira entrada no funil (webhook de venda, lead de formulário, conversa qualificada).
- **Antes**, sempre verifique se já existe:
  - "Lead possui negócio na pipeline" → **Mover** em vez de criar.
  - "Negócio com ID externo existente", para pedidos.
  
  Rodar duas vezes cria dois negócios. Nos modelos, 34 criações vêm depois de "Negócio com ID externo existente" e 22 depois de "Lead possui negócio na pipeline".
- **Depois**, nos modelos: Mapeamento de campo (grava `businessExternalId` e campos adicionais do negócio), Loop de array (produtos) e Ganhar negócio.

### Mover negócio de etapa — `move-business-action` ✅

"Move um negócio para outra etapa (da mesma ou de outra pipeline)." `options`: `{ "stageId": "uuid" }`. É a ação mais usada: 144.

- **Use**: status de pedido ("Aguardando pagamento" → "Pago" → "Enviado"), avanço de qualificação, "Parou de responder", transferência entre funis (comercial → pós-venda).
- Mover para outra pipeline **leva o mesmo negócio**. Para manter o original onde está, use **Duplicar**.

### Duplicar o negócio — `clone-business-action` ✅

"Cria um novo negócio com as mesmas informações do negócio atual." `options`: `{ "stageId": "uuid" }`, etapa da cópia.

- **Use**: iniciar onboarding, CS ou renovação numa pipeline própria **sem tirar** a venda da pipeline comercial. A cópia leva campos adicionais e dados; foi o que se usou num onboarding.

### Ganhar negócio — `win-business-action` ✅ · Perder negócio — `lose-business-action` ✅ · Restaurar negócio — `restore-business-action` 🟡

```json
{ "name": "lose-business-action", "group": "business", "options": { "lossReasonId": "uuid-do-motivo", "justification": "Lead não respondeu os 5 follow-ups" } }
```

| Ação | `options` | Quando usar |
|---|---|---|
| Ganhar | `{}` | Pagamento aprovado, contrato assinado. Nos modelos vem junto de Mover (etapa final) e antes do Loop de produtos. |
| Perder | `lossReasonId` (declare em `data.businessLossReasons`) · `justification` (texto, aceita variável) | Fim de cadência sem resposta, pedido cancelado, reembolso. O motivo alimenta os relatórios de perda. |
| Restaurar | `{}` | Pedido cancelado por engano, lead voltou a responder depois de perdido. Volta o negócio para "em aberto". |

Ganhar e perder disparam os gatilhos "Negócio ganho/perdido" de outras automações. Não crie ciclos.

### Transferir um atendente ao negócio — `add-attendant-on-business-action` ✅ · Remover o atendente do negócio — `clean-attendant-on-business-action` ✅

```json
{ "name": "add-attendant-on-business-action", "group": "business", "options": { "attendantId": "", "addSameAttendantToLead": true } }
```

| Opção | Na interface | Quando usar |
|---|---|---|
| `attendantId` | "Selecione o atendente que será vinculado ao negócio" (substitui o atual) | Pendência: ID do usuário. Vem logo depois de um **Randomizador** na distribuição de leads (139 vezes nos modelos). |
| `addSameAttendantToLead` | "Transferir o mesmo atendente como atendente responsável do lead?" | `true` quando o vendedor do negócio também é o dono do lead (carteira). `false` quando o lead tem um dono fixo e o negócio vai para outro. |
| `cleanAttendantOnLead` (Remover) | "Remover o atendente responsável do lead?" | `true` para devolver lead e negócio à fila. |

Distribuição completa, nos modelos: "Transferir atendente ao negócio" + "Transferir atendente da conversa" + (opcional) "Transferir departamento", no **mesmo bloco**.

### Produtos, desconto e frete

| Ação | `name` | `options` | Como usar |
|---|---|---|---|
| Adicionar um produto ao negócio | `add-product-on-business-action` ✅ | `productId` · `productSku` · `quantity` · `price` (todos aceitam variável) | `productId: ""` + `productSku` para localizar pelo SKU (o que integrações usam). `quantity` vazio = 1; `price` vazio = preço do cadastro. |
| Remover um produto do negócio | `remove-product-on-business-action` ✅ | `productId` · `productSku` · `quantity` | `quantity` vazio remove o produto inteiro; com número, só reduz. Útil em "pedido atualizado": remove e relança. |
| Criar produto | `create-product-action` ✅ (`group: "product"`) | `sku` · `name` · `price` | Garante que o SKU existe antes de adicionar. Nos modelos, 15 de 16 vezes vem no **mesmo bloco** que "Adicionar produto", dentro do Loop de array. |
| Adicionar descontos, acréscimo, frete e cupom | `add-discount-shipping-action` ✅ | `discount` · `addition` · `shipping` · `shippingType` (transportadora ou tipo) · `coupon` | Depois do loop de produtos, para fechar o total igual ao pedido da loja. Valores numéricos com ponto decimal. |

```json
{ "actions": [
  { "name": "create-product-action", "group": "product", "options": { "sku": "{sku|[produtos]sku}", "name": "{nome|[produtos]nome}", "price": "{preco|[produtos]preco}" } },
  { "name": "add-product-on-business-action", "group": "business", "options": { "productId": "", "productSku": "{sku|[produtos]sku}", "quantity": "{quantidade|[produtos]quantidade}", "price": "{preco|[produtos]preco}" } }
], "nextBlockId": "", "errorNextBlockId": "" }
```

### Remover negócio — `remove-business-action` ✅ ⚠️ destrutivo

"Esta ação exclui permanentemente o negócio e todos os seus dados." `options`: `{}`. Nos modelos: limpar o negócio provisório de carrinho abandonado quando a compra é aprovada. **Só gere se o usuário pedir expressamente**; na maioria dos casos, Perder ou Mover resolve.

---

## 4. Leads — `group: "lead"`

### Criar lead — `create-lead-action` ✅

"Cria o lead com as informações guardadas nos parâmetros da sessão. Caso o lead já existir, não será criado um novo lead." `options`: `{}`.

- Precisa de **Nome + Telefone** ou **Nome + E-mail** mapeados antes (Mapeamento de campo, KB-17).
- Padrão dos modelos: "Lead existente?" → não → **Criar lead** (32 de 42).
- ⚠️ O editor avisa no Mapeamento de campo: "**Campos mapeados antes desta etapa não serão atualizados no lead caso ele já exista com este contato.**" Para **atualizar** um lead que já existe, mapeie os campos **depois** da condição "Lead existente" no caminho "existe". O modelo oficial "Receptor de webhook" tem um segundo Mapeamento só para isso.

### Deletar lead — `delete-lead-action` 🟡 ⚠️ destrutivo

"Deleta o lead com as informações guardadas nos parâmetros da sessão… A operação é irreversível." `options`: `{}`. Só com pedido explícito (ex.: LGPD, pedido de exclusão).

### Tags

| Ação | `name` | `options` | Quando usar |
|---|---|---|---|
| Adicionar tags | `add-tag-action` ✅ | `tagIds` (lista) · `tagName` | `tagIds` com tags declaradas em `data.tags`: o caso comum. `tagIds: []` + `tagName` (aceita variável) para uma tag **dinâmica** pelo nome ("Deixe em branco para utilizar a busca pelo Nome"). |
| Remover tags | `remove-tag-action` ✅ | `tagIds` · `tagName` | Limpar estados: "Em atendimento" ao finalizar, "Aguardando pagamento" ao pagar. Aceita várias de uma vez (5 nos modelos). |
| Criar tags | `create-tag-action` ✅ | `name` (variável) · `description` · `color` (hex) · `colorClass` (ex.: `"bg-pink-400"`) · `useRandomColor` | Tags que nascem de dados: código do evento, nome do vendedor, número da conexão. Vem antes de "Adicionar tags" com `tagName` igual. Para tags fixas, declare em `data.tags`. |

- **Tag como estado** é o padrão mais útil do CRM: "Em atendimento", "Chamar pela manhã", "Triagem comercial", "msg-vend". O fluxo marca, e outras condições e gatilhos leem.
- Tags de controle evitam reenvio: antes de mandar, "Verifica se o lead possui a tag"; depois de mandar, adiciona a tag.

### Listas

| Ação | `name` | `options` | Quando usar |
|---|---|---|---|
| Adicionar listas | `add-list-action` ✅ | `listIds` · `listName` | Segmentar para campanhas e Execução manual por lista ("Compradores loja física"). |
| Remover listas | `remove-list-action` 🟡 | `listIds` · `listName` | Tirar da lista de campanha quem já comprou. |
| Criar listas | `create-list-action` 🟡 | `name` · `description` | Lista dinâmica por dado (lançamento, turma). |

IDs de lista não entram em `data.*` do import: use `listName` ou registre a Pendência "selecionar a lista".

### Adicionar comentário no lead — `add-lead-comment-action` ✅

`options`: `{ "comment": "texto com variáveis" }`. Fica **no cadastro do lead**, no histórico.

- **Use**: origem de campanha (modelos de tracking: plataforma, campanha, conjunto, anúncio), resumo da conversa gerado por IA, registro de evento externo.
- Diferença para Anotação e Notificação: ver KB-11, seção 2.

### Transferir um atendente ao lead — `add-attendant-on-lead-action` ✅ · Remover atendente do lead — `clean-attendant-on-lead-action` ✅

- **Transferir**: `{ "attendantId": "" }` (Pendência). Dono da carteira do lead, independente de negócio.
- **Remover**: `{ "attendantId": "" }` — a exportação real traz a chave, vazia. Lead volta sem responsável, por exemplo inativo há 180 dias, para redistribuir.

### Distribuidor de atendentes — `change-attendant-action` 🟡

"Distribui o fluxo entre múltiplos atendentes com saídas individuais." Item novo, visto numa cópia do editor em 05/10/2026; ainda sem exportação.

```json
{"name":"change-attendant-action","group":"lead","options":{"attendants":[],"assignToLead":true,"assignToBusiness":true,"assignToConversation":true,"onlyOnline":true,"noAttendantNextBlockId":"uuid-nenhum-atendente","type":"current-conversation","instanceId":"","retryCount":3,"retryIntervalSeconds":60}}
```

| Opção | Na interface | Valores (padrão do editor) | Como usar |
|---|---|---|---|
| `attendants` | "Atendentes" ("Adicionar atendente") | lista (`[]`) | Um atendente por item, cada um com a própria saída. O formato do item ainda não apareceu: gere `[]` e registre a Pendência "adicionar os atendentes e ligar a saída de cada um". Atendentes são IDs da conta, como em todo o projeto. |
| `assignToLead` | "Atribuir atendente ao lead" | `true` | Dono da carteira do lead. |
| `assignToBusiness` | "Atribuir atendente ao negócio" | `true` | Vendedor do negócio da sessão. |
| `assignToConversation` | "Atribuir atendente à conversa" | `true` | Quem atende a conversa. |
| `onlyOnline` | "Apenas atendentes online" | `false` | `true` para distribuir só entre quem está com o sistema aberto e mexeu nele no último minuto e meio, aproximadamente. Aba aberta e parada não conta. |
| `retryCount` | "Tentativas quando não houver atendente online" | `3`, máximo 10 | Quantas vezes tenta de novo antes de seguir por "Nenhum atendente disponível". `0` segue direto. |
| `retryIntervalSeconds` | "Intervalo entre tentativas (segundos)" | `60` | Com `retryCount` 3 e 60 s, espera cerca de 3 minutos antes de desistir. |
| `noAttendantNextBlockId` | Saída "Nenhum atendente disponível" | UUID | **Ligue sempre que usar `onlyOnline`**: fila, mensagem ao lead ou notificação ao gestor. |
| `type` / `instanceId` | "Tipo de conversa" / "Instância" | `"current-conversation"` / `""` | Mesma escolha de conversa das ações de conversa (seção 5). |

- **Saídas**: uma por atendente e a "Nenhum atendente disponível". O bloco de Ações mantém `nextBlockId` e `errorNextBlockId`; como eles convivem com as saídas por atendente ainda não foi confirmado.
- **Padrão antigo**: Randomizador + Transferir atendente ao negócio e da conversa (KB-15) faz o mesmo em vários blocos. O Distribuidor junta a escolha, a atribuição e o caso "ninguém online" num item só.
- Ainda não se sabe como ele escolhe o atendente, se por sorteio ou por rodízio. Confirme no CRM antes de prometer divisão igual.

---

## 5. Mensagens (conversa) — `group: "messages"`

As ações de conversa escolhem **qual conversa** usar:

| `type` | Na interface | Quando usar |
|---|---|---|
| `"current-conversation"` | Conversa da sessão atual | **Padrão**: o fluxo começou numa conversa ou herdou uma. `instanceId: ""`. |
| `"all-conversations"` | Todas as conversas do lead/contato | O lead fala por vários números e a mudança vale para todos (distribuição: 34 usos). |
| `"find-conversation-in-instance"` | Conversa na instância informada | O fluxo **não tem** conversa (gatilho de negócio, webhook) ou precisa agir no número de um setor. Exige `instanceId` (Pendência). |

### Transferir atendente da conversa — `change-conversation-attendant-action` ✅

```json
{ "name": "change-conversation-attendant-action", "group": "messages", "options": { "type": "current-conversation", "instanceId": "", "attendantId": "", "changeCurrentSession": false } }
```

| Opção | Na interface | Quando usar |
|---|---|---|
| `attendantId` | "Atendente que será transferido para a conversa. Deixe em branco para limpar os atendentes da conversa." | ID de um usuário (humano) **ou de um agente de IA**: é assim que os modelos "Invocar Agente" entregam a conversa ao agente. `""` tira todo mundo. |
| `changeCurrentSession` | "Usar como conversa da sessão atual" (só com `find-conversation-in-instance`) | `true` quando os **próximos blocos** devem usar a conversa encontrada. O CRM avisa: as mensagens seguintes saem por essa conversa e os blocos que usam atendente passam a usar o escolhido. |

- Nos modelos vem depois de um Randomizador (147×) ou de "Conversa possui atendente responsável", e no mesmo bloco de "Transferir atendente ao negócio" (72×).

### Transferir departamento da conversa — `change-conversation-department-action` ✅

`options`: `{ "type", "instanceId", "departmentId" }`. `departmentId` é ObjectId declarado em `data.departments`.

- **Use**: triagem de menu ("Financeiro", "Comercial", "Suporte T.I."). O departamento organiza a fila do multiatendimento e pode disparar "Departamento alterado" em outro fluxo.

### Iniciar o atendimento — `start-conversation-action` ✅ · Finalizar o atendimento — `finish-conversation-action` ✅

`options`: `{ "type", "instanceId" }`.

- **Iniciar**: coloca a conversa "em atendimento". Nos modelos "Invocar Agente", vem no mesmo bloco da transferência para o agente.
- **Finalizar**: encerra quando o lead escolhe "Encerrar conversa", ao fim de follow-up sem resposta ou por comando "ENCERRAR". Dispara "Atendimento finalizado" (NPS, limpeza de tags). Nos modelos, 13 de 14 vêm depois de uma Mensagem de despedida.

### Desativar as automações de chat na conversa — `stop-chat-automations-action` ✅ · Ativar — `start-chat-automations-action` 🟡

`options`: `{ "type", "instanceId" }`.

- **Desativar**: quando um humano assume, para o bot **não responder por cima**. Par natural da transferência para humano.
- **Ativar**: devolver ao bot ao finalizar o atendimento humano.
- Leia o estado com a condição "Automações de chat estão habilitadas" (KB-13).

### Adicionar sugestão de resposta — `change-conversation-suggestion-action` 🟡

`options`: `{ "type", "instanceId", "suggestion": "texto" }`. A sugestão aparece para o atendente, que decide enviar.

- **Use**: copiloto humano. Assistente de chat (IA) gera o texto → `suggestion: "{Último resultado da IA|lastAiText}"`. O atendente revisa antes de mandar.

---

## 6. Sistema — `group: "system"`

### Enviar notificação — `send-notification-action` ✅

```json
{ "name": "send-notification-action", "group": "system", "options": { "attendantsIds": [], "notification": "Lead {Nome do lead|leadName} não foi atendido em 10 minutos", "url": "https://crm.datacrazy.io/multiservice?search={Telefone do lead|leadPhone}" } }
```

| Opção | Na interface | Quando usar |
|---|---|---|
| `attendantsIds` | "Selecione os atendentes que receberão a notificação" | Pendência: usuários do CRM. |
| `notification` | "Mensagem da notificação" | Curta, com nome e telefone. |
| `url` | "Url para redirecionamento" | Leve direto ao lugar certo: `multiservice?search={leadPhone}` (conversa), `pipelines/<id>?search=` (negócio), `flow/<id>` (automação com erro). |

- Vai para o **sino do CRM**, não para o WhatsApp. Para WhatsApp de grupo, use Mensagem com `contactId` (KB-11).
- **Use**: SLA estourado ("45 min sem atendimento"), lead quente, erro de integração (saída de erro → notificação com `{lastErrorMessage}`).

### Iniciar outra automação — `start-another-automation-action` ✅

```json
{ "name": "start-another-automation-action", "group": "system", "options": { "automationId": "uuid-de-outra-automacao-do-arquivo", "parameters": [ { "name": "Produto", "value": "{products[0].name|[Api-request-1]products[0].name}" } ] } }
```

| Opção | Na interface | Quando usar |
|---|---|---|
| `automationId` | "Selecione a automação que será iniciada" | Automação **do mesmo arquivo** de importação; o import religa os IDs. |
| `parameters[]` | `{ "name", "value" }`: "Parâmetros da sessão que serão passados" | Dados que o subfluxo precisa e que não estão no lead: produto, status, link de pagamento, código PIX. Lidos no subfluxo pela fonte do gatilho (KB-03, 5.4). |

- **Use**: separar responsabilidades. O webhook recebe e roteia; cada evento chama o subfluxo de mensagens (Kirvano: "PIX gerado", "Compra aprovada", "Carrinho abandonado"). Menu chama transferências. Agendado chama distribuição.
- O subfluxo começa com o gatilho "Iniciado por outra automação" e roda no contexto do mesmo lead.

### Retornar resultado da tool — `set-tool-result-action` 🟡

"Define o conteúdo que será retornado como resultado da tool para o agente de IA." `options`: `{ "body": "…" }`, texto (costuma ser JSON) com variáveis.

```json
{ "name": "set-tool-result-action", "group": "system", "options": { "body": "{\"status\":\"{status|[get-pedido]data.status}\",\"previsao\":\"{previsao|[get-pedido]data.previsao}\"}" } }
```

- Obrigatória no fim de fluxos com gatilho **MCP Server Tool** (KB-10). Devolva só o que o agente precisa para responder, e também em caso de erro (`{"erro":"pedido não encontrado"}`).
- ⚠️ **Todo caminho termina aqui**: próximo passo, saídas de erro de API, JavaScript e Ações, e o "nenhuma" das condições. Se a execução quebra antes, o `tools/call` devolve ao agente `parameters.additionalFields` com o **valor real** dos campos e parâmetros do sistema lidos no fluxo, tokens incluídos (KB-10). Parâmetro Secreto não vaza.

#### Objetos e listas no `body` (medido em 02/10/2026)

O caminho depois de `[fonte]` é avaliado com a biblioteca `jsonpath` (dchester), e o CRM pega só o 1º resultado. Objeto ou lista entra como JSON: escreva `${[fonte]caminho}` **sem aspas** em volta.

```json
{ "name": "set-tool-result-action", "group": "system", "options": { "body": "{\"ok\":true,\"produto\":${[produto-xml][0]},\"preco_e_estoque\":${[controle-produto][0]}}" } }
```

| No `body` | Resultado |
|---|---|
| `${[fonte][0]}` · `${[fonte]campo}` | ✅ Objeto ou lista como JSON. |
| `${[fonte][*]}` | ⚠️ Só o primeiro item. |
| `${[fonte]}` | Quebra: "Parameter service for parameter [fonte] was not implemented". |
| `${[fonte][0]^}` | Quebra: "Lexical error". |

- **API que responde lista na raiz** (Supabase/PostgREST): não sai inteira por caminho. Ponha um JavaScript mínimo depois da condição, `return { produtos: await session.datasources["fonte"] }`, e no resultado use `${[fonte-js]produtos}`. Receita no KB-04, seção 13.

---

## 7. Atividades — `group: "activities"`

### Criar atividade — `create-activity-action` ✅

"Cria uma atividade vinculada a um lead ou negócio."

```json
{ "name": "create-activity-action", "group": "activities", "options": { "title": "Ligar para o lead", "description": "Lead pediu retorno pela tarde", "typeId": "", "attendantId": "", "durationMs": 1800000, "creationDelayMs": 86400000, "workingHoursId": "", "flowId": "", "required": false, "hasBusiness": true, "belongsToStage": false } }
```

| Opção | Na interface | Quando usar |
|---|---|---|
| `title` | Nome da atividade | Verbo + objeto: "Ligar para o cliente". |
| `description` | Descrição | Contexto com variáveis. |
| `typeId` | Tipo da atividade | Pendência: ligação, reunião, WhatsApp… |
| `priority` | Prioridade | Escolha na interface. Deixe fora do JSON ou registre Pendência. |
| `attendantId` | "Atendente responsável. Deixe em branco para vincular o atendente do negócio ou do lead" | `""` na maioria dos casos: a tarefa vai para o dono. |
| `hasBusiness` | "Adicionar negócio da sessão?" | `true` quando há negócio: a atividade aparece no card. |
| `belongsToStage` | "Vincular atividade a etapa do negócio?" | `true` para tarefas típicas daquela etapa. |
| `required` | "O negócio só pode ser movido de estágio caso a atividade seja concluída" | `true` para passos obrigatórios do processo (checklist de venda). |
| `durationMs` | Duração da atividade | Milissegundos: 30 min = `1800000`, 1 h = `3600000`. |
| `creationDelayMs` | "Criar atividade a partir do dia e hora e minutos informados" | Milissegundos até a atividade ser criada: 1 dia = `86400000`, 7 dias = `604800000`. `0` = agora. |
| `workingHoursId` | "Criar atividade considerando um horário de trabalho" | ObjectId em `data.workingHours`: a tarefa não cai fora do expediente. |
| `flowId` | "Executar uma automação" | Automação com gatilho **Atividade executada** (KB-10): ao concluir a tarefa, o fluxo continua. |

- **Use**: cadência humana (dia 1 ligar, dia 3 WhatsApp, dia 7 última tentativa, com vários `creationDelayMs`); follow-up agendado quando o lead diz "me chama amanhã"; checklist obrigatório por etapa.
- Nos modelos "leads inativos": uma atividade por faixa de horário, no mesmo bloco de "Adicionar tags" ("Chamar pela manhã/tarde").

---

## 8. Combinações frequentes

| Objetivo | Ações no mesmo bloco |
|---|---|
| Distribuir lead (depois do Randomizador) | Transferir atendente ao negócio (`addSameAttendantToLead: true`) + Transferir atendente da conversa (+ departamento). |
| Entregar ao agente de IA | Iniciar o atendimento + Transferir atendente da conversa (`attendantId` = agente). |
| Humano assume | Transferir atendente da conversa + Desativar as automações de chat. |
| Venda aprovada | Mover negócio (etapa paga) + Ganhar negócio + Remover tag "Aguardando pagamento". |
| Novo lead de formulário | Criar negócio + Adicionar tags. |
| Pedido com itens (dentro do loop) | Criar produto + Adicionar produto ao negócio. |
| Encerrar | Mover negócio + Finalizar o atendimento. |

## 9. Erros comuns

1. **Criar negócio sem verificar** se já existe: negócios duplicados a cada webhook.
2. **Mapear campos antes de Criar lead** esperando atualizar um lead existente.
3. **Ação de negócio sem negócio na sessão** (gatilho de mensagem ou Execução manual por lead sem "Lead possui negócio…"). Ver a regra no início desta seção de negócios.
4. **Notificação para avisar grupo de WhatsApp**: notificação é do CRM; use Mensagem com `contactId`.
5. **`automationId` de automação que não está no arquivo**.
6. **Transferir para humano sem desativar o bot**: o fluxo continua respondendo.
7. **Remover negócio ou Deletar lead** sem pedido explícito.
8. **Tag dinâmica** com `tagName` sem criar a tag antes.
9. **Ferramenta MCP com caminho sem "Retornar resultado da tool"**: quando a execução quebra, o agente recebe os parâmetros Texto lidos no fluxo com o valor real.
10. **`${[fonte]}` sem caminho** no resultado da tool: quebra a execução. Lista na raiz pede o JavaScript mínimo (KB-04, seção 13).
11. **Distribuidor com "Apenas atendentes online" e sem a saída "Nenhum atendente disponível"**: quem chega sem ninguém online fica parado.
