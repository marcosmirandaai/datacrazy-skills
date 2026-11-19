# KB-04 — Padrões e Receitas

Arquiteturas extraídas do encadeamento real de automações em produção no CRM Datacrazy (webhooks de formulário, checkouts, ERPs, triagem, distribuição, IA, follow-up e rastreamento de anúncios). Use como ponto de partida no passo 3 (Planejar juntos): escolha o padrão mais próximo, adapte e mostre no plano.

Convenções dos diagramas:

- `→` próximo bloco
- `[SE x]` saída de um item de condição (modo por item)
- `[TODAS]` / `[NENHUMA]` saídas de "todas verdadeiras" / "nenhuma atendida"
- `[ERRO]` saída de erro · `[CORPO]` corpo do loop · `[botão]`, `[timeout]`, `[intenção]`

Os nomes internos de cada item estão no KB-02; opções e quando usar cada uma, nos KB-10 a KB-19 (um por bloco).

---

## Mapa rápido: necessidade → bloco

| Necessidade | Use | Evite |
|---|---|---|
| Receber dados de fora (formulário, checkout, ERP) | Gatilho **Requisição HTTP (Webhook)** | — |
| Consultar ou enviar dados a um sistema externo | **API** com `datasourceName` descritivo | JavaScript só para chamar URL |
| Copiar dado do payload para o lead ou negócio | **Operações de campos → Mapeamento de campo** | JavaScript |
| Normalizar telefone | **Análise de telefone** (`defaultCountry` BR) | regex manual |
| Calcular, transformar texto, montar payload | **JavaScript** (Padrão Oficial) | cadeias longas de condições |
| Um campo com vários valores (status, evento) | **Uma** condição em modo por item (switch) | vários blocos encadeados |
| "Existe por e-mail OU telefone OU CPF" | Uma condição, itens com o **mesmo** destino | uma condição por identificador |
| Não duplicar pedido ou negócio | **Negócio com ID externo existente** + `businessExternalId` | criar sempre |
| Percorrer itens de pedido | **Loop de array** | JavaScript com laço gravando campos |
| Distribuir leads entre vendedores | **Randomizador** + Transferir atendente | IA |
| Classificar intenção ou extrair dados da conversa | **IA: Intenção** / **Extrator de parâmetros** | condições de palavra-chave frágeis |
| Responder como assistente | **IA: Assistente de chat** + Mensagem com a resposta | — |
| Perguntar algo ao lead e esperar a resposta | Mensagem de texto + **Entrada do usuário sem campo** no mesmo bloco; próximo passo = respondeu, timeout = não respondeu | Espera fixa + condição; gravar a resposta num campo |
| Agrupar mensagens picotadas antes da IA | **Espera: Usuário parou de responder** | responder a cada fragmento |
| Só agir em horário comercial | **Condição de hora** ou **Espera de intervalo de hora** | Espera fixa |
| Lógica reutilizada ou ramos grandes | **Iniciar outra automação** + subfluxo | um canvas gigante |
| Humano assumiu a conversa | **Desativar as automações de chat** | deixar o bot ativo |
| Controlar etapas de uma régua | **Tags** ou **etapas** como estado, checadas antes de cada envio | contar mensagens de cabeça |
| Devolver ao agente de IA (MCP) uma lista que a API responde na raiz | **JavaScript mínimo** que embrulha a lista + `${[fonte-js]lista}` no resultado da tool (seção 13) | `${[fonte]}`, `${[fonte][*]}` |
| Traduzir um ID de tabela estável de sistema externo (profissional, status, unidade) | **Cache em Parâmetro do sistema**: JavaScript lê o dicionário e só chama a API quando o ID falta (seção 14) | API da lista inteira a cada execução |

---

## 0. Pergunta ao lead (padrão obrigatório)

Vale para toda pergunta que o fluxo faz ao lead: qualificação, confirmação, NPS, follow-up, reativação.

```
Bloco de Mensagem
  1. Mensagem de texto: "{Primeiro nome}, você ainda tem interesse?"   (botões opcionais)
  2. Entrada do usuário: texto vazio, sem campo do CRM, espera de 1 hora
     [próximo passo]               → respondeu → IA: Intenção de conversa, condição ou próxima pergunta
     [caso o usuário não responda] → não respondeu → follow-up, tag, mover etapa ou encerrar
     [botão]                       → caminho do botão
```

- A Entrada do usuário **não grava** a resposta em campo: ela só separa quem respondeu de quem não respondeu.
- Para entender **o que** o lead respondeu, coloque uma IA depois do "próximo passo" (Intenção de conversa para escolher o caminho, Extrator de parâmetros para tirar dados).
- Ligue sempre as duas saídas. Sem a de "não respondeu", o lead fica parado para sempre.
- Numa régua de follow-up, a saída "não respondeu" de uma pergunta leva à próxima tentativa (padrão 8).

---

## 1. Captação de leads por webhook

Formulário próprio, landing page, Wix, Lead Ads nativo da Meta. Modelos: *Formulário Nativo*, *Landing pages*, *Cadastro de formulário*, *Leads Comercial*, *Formulários Wix*.

```
Webhook (Api-request-1)
→ Operações de campos: parse-phone (phone-1)
→ Operações de campos: leadName, leadPhone ← [phone-1]phone, leadEmail,
    additional-field[utm_source], [utm_medium], [utm_campaign], [utm_content],
    leadSource = "Wix Formulários: {…formName}"
→ Condição (por item, OU):
    [SE lead com e-mail existe]   ─┐
    [SE lead com telefone existe] ─┼→ Condição: lead possui negócio na pipeline
    [SE lead com nome existe]     ─┘      [SE sim]    → Mover negócio → etapa de entrada
                                          [NENHUMA]   → Criar negócio → etapa de entrada
    [NENHUMA] → Criar lead + Criar negócio (mesmo bloco de ações)
→ Formatação de data (date-1) → additional-field[Data criação do lead]
→ Condição (switch) em additional-field[Faturamento Mensal] com field-matches-n-text-values:
    [SE "Até R$10 mil"]        → Adicionar tag "Tier D" + Notificação
    [SE "R$10 mil a R$50 mil"] → Adicionar tag "Tier C" + Notificação
    [SE "R$50 mil a R$100 mil"]→ Adicionar tag "Tier B"
    [SE "Acima de R$100 mil"]  → Adicionar tag "Tier A"
```

- Mapeie os campos **antes** de `create-lead-action`: o lead precisa de Nome + Telefone ou Nome + E-mail.
- Declare cada campo adicional e cada tag no envelope.
- `field-matches-n-text-values` aceita variações do mesmo valor em `keywords` (ex.: "Entre R$10 mil e R$50 mil" e "Entre R$10 mil a R$50 mil").
- Quando a mensagem de boas-vindas sai do próprio fluxo de webhook, **fixe a conexão**: não há conversa de origem.

## 2. Eventos de compra de checkout

Eduzz, Guru, Kirvano e similares: um webhook recebe todos os eventos do pedido. Modelos: *Eventos de Compra - Eduzz*, *Eventos de Compra - Guru*, *Webhook Checkout (Kirvano)*.

```
Webhook (Api-request-1)
→ parse-phone → Mapeamento: dados do comprador, UTMs, forma de pagamento
→ Condição (E): as 4 UTMs têm valor?
    [TODAS] → Condição (E): alguma UTM ainda contém a macro literal ("adset.name", "campaign.name")?
                [TODAS] → Notificação "UTM não substituída no anúncio"
→ Deduplicação do lead: lead com telefone → com e-mail → com CPF → lead existente
    [NENHUMA] → Criar lead
→ Condição: negócio com ID externo = {id do pedido} existe?
    [SE existe] → Condição (switch) em [Api-request-1]event:
                   [SE fatura paga]       → Mover → "Pago" + Ganhar negócio
                   [SE fatura aberta]     → Mover → "Aguardando pagamento"
                   [SE cancelada]         → Mover → "Cancelado" + Perder negócio (motivo)
                   [SE reembolsada]       → Mover → "Reembolsado" + Perder negócio (motivo)
    [NENHUMA]   → Mapeamento: businessExternalId = {id do pedido}
                 → Condição (switch) em event → Criar negócio na etapa do evento (+ Ganhar/Perder)
→ Loop de array em [Api-request-1]data.items
    [CORPO] → Criar produto + Adicionar produto ao negócio
→ Condição: lead possui negócio na etapa "Carrinho abandonado"?
    [SE sim] → Remover negócio  (⚠️ destrutivo — só quando o cliente pedir)
→ Iniciar outra automação: «Compra aprovada», «PIX gerado», «Carrinho abandonado», «Onboarding»
    parameters: [{ "name": "Produto", "value": "{…[Api-request-1]product.name}" }]
```

- **Webhooks reenviam eventos.** Sem `business-with-external-id-exists-condition` + `businessExternalId`, cada reenvio cria um negócio novo.
- Um switch de evento num bloco só. Um segundo switch pode tratar a forma de pagamento (`PIX`, `BANK_SLIP`, `CREDIT_CARD`).
- Motivos de perda (`lossReasonId`) vão declarados em `data.businessLossReasons`.
- As mensagens ao cliente ficam nos **subfluxos**. O fluxo principal só decide e registra.

## 3. Roteador + subfluxos

Um fluxo principal decide e chama fluxos menores, cada um com uma responsabilidade. Modelos: *Webhook Checkout* → *Compra Aprovada Checkout* / *PIX Gerado Checkout* / *Carrinho Abandonado Checkout*; *Menu Inicial [Loja]* → *Trilha Comercial* / *Transferência Financeiro* / *Transferência Compras*; *URA* → *Boas vindas [SDR-ia]*.

```
Fluxo principal
→ … decisão …
→ Ação: Iniciar outra automação (automationId = subfluxo do mesmo arquivo,
         parameters = [{ name: "Produto", value: "{…}" }])

Subfluxo
Gatilho: Iniciado por outra automação (datasourceName "Api-request-1")
→ Mensagem: "Olá {Nome do lead|leadName}, vi que você fez o pedido do {Produto|[Api-request-1]Produto}…"
```

- Entregue principal e subfluxos **no mesmo arquivo**, com nomes claros.
- O subfluxo lê cada parâmetro em `[datasourceName-do-gatilho]NomeDoParametro`. Confirmado nos modelos: `{Produto|[Api-request-1]Produto}`.
- O subfluxo roda no contexto do mesmo lead: não precisa passar nome ou telefone.
- Um subfluxo pode ter **dois gatilhos** (Iniciado por outra automação + Mensagem recebida), para ser chamado ou disparado sozinho.
- ⚠️ **Loop entre automações**: *Menu Inicial* chama *Trilha Comercial*, que chama *Menu Inicial* de volta. Todo ciclo precisa de uma condição de saída (tag, etapa, departamento).

## 4. Triagem de atendimento com horário comercial

Primeiro contato no WhatsApp. Modelo: *Triagem Inicial - Equipe 2*.

```
Mensagem recebida
→ Condição: lead existente
    [SE sim]  → Transferir atendente ao lead + Adicionar tag
    [NENHUMA] → Criar lead + … 
→ Condição: lead possui negócio na pipeline
    [SE sim]  → Transferir departamento da conversa
    [NENHUMA] → Criar negócio → "Novo lead"
→ Condição de hora (seg–sex, 09:00–00:00 em São Paulo = 12:00Z–03:00Z)
    [SE dentro] → Mensagem com botão "QUERO ME MATRICULAR"
                   [botão] → Espera 1 s → Mensagem de coleta → Transferir departamento
                             + Iniciar outra automação «Distribuição de atendentes»
                   [timeout] → mesmo destino
    [NENHUMA]   → versão da mensagem para fora do horário → mesmo encaminhamento
```

- Horários da condição ficam em UTC (KB-13, seção 7).
- Botão e timeout convergindo no mesmo destino evita lead parado.

## 5. Distribuição de atendentes

Round-robin com prioridade para o vendedor de origem e SLA. Modelos: *Distribuição de Atendentes*, *Distribuição de atendentes - Equipe 2*, *Distribuição a partir de 31 dias/SLA*.

```
Gatilho: Iniciado por outra automação (+ Execução manual)
→ Condição: lead existente [NENHUMA] → Criar lead
→ Condição: leadName contém "55"? (nome veio como telefone)
    [SE sim] → Mapeamento: leadName = {senderName|[Message-1]senderName}
→ Condição (E): lead possui negócio na pipeline
→ Condição: conversa possui atendente
    [NENHUMA] → Condição (switch) em additional-field[utm_source]:
                  [SE "Ariane"] → Transferir atendente da conversa (Ariane)
                  [SE "Denise"] → Transferir atendente da conversa (Denise)
                  …
                  [NENHUMA]     → Randomizador A–H (12,5% cada)
                                    [A] → Transferir atendente da conversa (vendedor A)
                                    …
→ Condição: negócio sem atendentes
    [TODAS] → Transferir atendente ao negócio (addSameAttendantToLead)
→ Espera 15 min
→ Condição: lead possui a tag de "respondido"?  → senão, redistribuir ou alertar (SLA)
```

- O vendedor de origem vem de um link com `utm_source` próprio.
- Todo `attendantId` é Pendência.
- Percentuais do randomizador somam 100: com 8 vendedores, 12,5 cada (ou 13/13/13/13/12/12/12/12).
- A condição "lead possui negócio na pipeline" antes de "Transferir atendente ao negócio" é o que põe o negócio na sessão quando o fluxo roda pela Execução manual, que não traz negócio. Se o lead puder ter vários negócios abertos nessa pipeline, separe a execução manual numa automação própria que chama esta (KB-12, regra das ações de negócio).

## 6. Atendimento com IA (SDR)

Qualificação conversacional. Modelo: *IA de atendimento*.

```
Gatilhos: Mensagem recebida (receiveJson → Message-1) + Execução manual + Iniciado por outra automação
→ Mapeamento: leadName = {senderName|[Message-1]senderName}
→ Condição: lead possui a tag "IA pausada"?  [SE sim] → fim
→ Espera: Usuário parou de responder (10 s)
→ IA: Transcrição de áudio (AI-1) + IA: Assistente de chat com o prompt de SDR (AI-2)
→ Mensagem "{text|[AI-2]text}" + Entrada do usuário (espera a resposta)
    [timeout] → Condição por tags de controle (follow-up 1, 2, 3)
                → IA: Assistente de chat com prompt de follow-up (AI-follow-up-N)
                → Adicionar tag "follow-up N" → Mensagem com o texto da IA → Entrada do usuário
    [resposta completa] → IA: Intenção [Eng. Civil | Mecânica | Elétrica | Outra] → Adicionar tag
                → IA: Intenção [Desempregado | Faturamento baixo | Não quer investir | Qualificado]
                   [intenção] → Condição: lead possui negócio na pipeline
                                  [SE sim]  → Mover negócio → etapa da classificação
                                  [NENHUMA] → Criar negócio → etapa da classificação
                              → Mensagem "Alguém da equipe vai te chamar"
                              → IA: Gerar texto (resumo + score 1–10) (AI-9)
                              → Mensagem interna / comentário com o resumo → transferir para humano
```

- A resposta da IA pode ser lida em `[datasourceName]text` (ex.: `{text|[AI-2]text}`) ou em `lastAiText`.
- **Espera: Usuário parou de responder** antes da IA evita respostas a cada fragmento.
- Tags como "IA pausada" e "follow-up N" funcionam como estado. Sem elas, o bot responde por cima do humano ou repete follow-ups.
- Quando um humano assumir: **Desativar as automações de chat na conversa**.
- Mover e Criar negócio ficam depois de "lead possui negócio na pipeline" porque nenhum dos três gatilhos garante negócio na sessão (a Execução manual nunca traz; KB-12, regra das ações de negócio).

## 7. Invocar um agente de IA especializado

Modelos: *Chegada de Lead* → *Invocar Agente - <área 1> / <área 2> / <área 3> / <área 4>*.

```
Mensagem recebida (Instagram)
→ IA: Transcrição de áudio
→ IA: Intenção [área 1 | área 2 | área 3 | área 4]
    [intenção] → Iniciar outra automação «Invocar Agente - <área>»

Subfluxo «Invocar Agente - <área>»
Gatilho: Iniciado por outra automação
→ Ações (mesmo bloco): Iniciar o atendimento (current-conversation)
                       + Transferir atendente da conversa (attendantId = o agente de IA da área)
```

- "Invocar agente" = transferir a conversa para o **atendente-agente**. O `attendantId` do agente é Pendência.

## 8. Follow-up por régua de tags

Cadência depois que o vendedor fala com o lead. Modelo: *Follow-Up*.

```
Gatilho: Mensagem enviada (includeScheduledMessages: true)
→ Condição (OU): lead possui negócio na pipeline A / B
→ Condição: negócio está ganho?  [NENHUMA] ↓
→ Condição (OU): negócio numa das etapas elegíveis
→ Condição: lead possui a tag "em follow-up"?  [NENHUMA] ↓
→ Entrada do usuário (espera resposta, timeout de N horas)
    [timeout] → Condição: ainda na etapa elegível?
                → Condição: tags "FU-1", "FU-2", "FU-3"… (qual foi a última?)
                   [NENHUMA] → Mensagem de follow-up 1 → Adicionar tag "FU-1" → Entrada do usuário …
                   [SE FU-1] → Mensagem 2 → tag "FU-2" → …
                   [SE última] → Mover negócio → "Perdido" + Perder negócio (motivo)
```

- As **tags são o contador**. Antes de cada envio, cheque etapa e tag.
- **Entrada do usuário** com timeout é o "não respondeu": qualquer resposta tira o lead da régua.
- Critério de parada claro: negócio ganho, mudou de etapa ou última tentativa.

## 9. Rastreamento de anúncios Click-to-WhatsApp

Descobre campanha, conjunto e anúncio de quem chegou por anúncio. Modelos: *Trackeamento - WA Oficial 2*, *Trackeamento - WA Não Oficial*.

```
Mensagem recebida (receiveJson → Message-1)
→ Condição: [Message-1]referral.ctwa_clid tem valor? (veio de anúncio)
    [TODAS] → Espera 5 s → Condição: lead existente [NENHUMA] → Criar lead
→ Mapeamento: leadCtwaId, leadSourceId ← [Message-1]referral.source_id,
              additional-field[ads_timestamp]
→ API GET graph.facebook.com/{anúncio} (Tracker) → additional-field[utm_content]
→ API GET graph.facebook.com/{campanha} (Tracker-campanha)
    [ERRO] → API GET graph.facebook.com/{conjunto} (Tracker-conjunto)
→ Mapeamento: additional-field[utm_medium], [Campanha], leadSource
→ Ações: Adicionar tag + Adicionar comentário no lead
         "Campanha: {name|[Tracker-campanha]name} · Conjunto: … · Criativo: …"
→ Condição: [Message-1]referral.thumbnail_url tem valor?
    [SE sim] → Mensagem interna com a imagem do anúncio (Arquivo URL dinâmica)
```

- O token da Graph API é Pendência. Nos modelos ele fica em campo adicional, o que expõe o valor a quem vê o lead: guarde num parâmetro do sistema Secreto e leia no header `Authorization` (KB-03, seção 4.2).
- Chamadas externas encadeadas: toda API tem saída de erro ligada.

## 10. Integração agendada com loja ou ERP

Sincronização periódica, sem webhook. Modelos: *Tray / Propostas Bling*, *Integração Tray*, *Eventos de compra - Loja física/online (Bling)*.

```
Gatilho: Execução agendada (a cada 30 min)
→ API: autenticação → Mapeamento: additional-field[access_token], [refresh_token], [expiração]
→ API GET /carts (get-carts)
→ Loop de array em [get-carts]Carts (array-carts)
    [CORPO] → Espera 5 s  (limite de requisições)
            → API GET /carts/{id} (get-carts_id) → API GET /customers/{id} (get-customer_id)
            → Condição: país = "Brasil"
               [TODAS] → Análise de telefone (phone-br) → Mapeamento dos campos do lead
            → Condição: lead com e-mail existe
            → Condição: negócio na etapa "Carrinho abandonado"?  [NENHUMA] ↓
            → Condição: negócio com ID externo = session_id existe?  [NENHUMA] ↓
            → Mapeamento: businessExternalId, additional-field[Customer_ID] ← [get-carts_id][0].Cart.customer_id
            → Criar negócio → "Carrinho abandonado"
            → Loop de array nos produtos → Criar produto + Adicionar produto ao negócio
```

- **Espera dentro do corpo do loop** respeita o limite de requisições da API.
- Idempotência por `businessExternalId`: a execução agendada revisita os mesmos registros.
- Resposta que é lista na raiz: `[get-carts_id][0].Cart.customer_id`.

## 11. Reativação de base inativa

Campanhas para leads sem compra há 91–180 ou mais de 180 dias. Modelos: *leads inativos 91-180 Dias*, *leads inativos +180 Dias*.

```
Gatilho: Execução manual por lead (disparo a partir de um filtro de leads)
→ Mensagem 1 (conexão fixa) → Espera → Condição: respondeu? (tag / conversa com atendente)
→ Mensagem 2 → Espera → …   (a régua usa várias esperas e mensagens)
→ IA para interpretar respostas
→ Iniciar outra automação «Distribuição de Atendentes a partir de 31 dias/SLA»
```

- Disparo manual sobre um **filtro de leads** é o gatilho natural para campanhas de base.
- Mensagens ativas precisam de **conexão fixa**. No WhatsApp oficial, fora da janela de 24h, só template aprovado.
- Randomizador para testar duas copies na mesma base.

## 12. Onboarding pós-venda com checagem externa

Montado e importado numa conta real.

```
Gatilho: Negócio ganho (type "stage", etapa "Pedido aprovado")
→ Duplicar o negócio → etapa "Aguardando 1º acesso" da pipeline de onboarding
→ Mensagem de boas-vindas (conexão fixa) → Espera 7 dias
→ API GET na plataforma de cursos (filtro por e-mail)
    [ERRO] → Notificação ao CS "não foi possível checar" ─┐
→ Condição: [alpaclass-1][0].first_lesson_view_at tem valor?   │
    [SE sim]  → Mover negócio → "Ativado" → fim              │
    [NENHUMA] → ←───────────────────────────────────────────┘
               Mover → "Follow-up 7 dias" → Mensagem → Espera → próxima checagem
→ … repete em 15 e 30 dias → último corte: Mover → "Sem resposta - CS"
```

- **Duplicar o negócio** leva os campos adicionais para a nova pipeline.
- A saída de erro da API **converge** no caminho de "não acessou": o aluno recebe a mensagem e o CS é avisado.
- Para "acessou ou não", prefira um campo que só existe depois do uso real (primeira aula assistida) a um que é preenchido no cadastro (último acesso).

## 13. Ferramenta MCP que devolve uma lista (Supabase/PostgREST) ✅

Montada e testada de ponta a ponta numa conta real em 02/10/2026. O agente de IA chama a ferramenta e recebe a lista inteira de produtos.

```
Gatilho: MCP Server Tool «buscar_produtos» (tool-input: palavra_1, palavra_2, palavra_3)
→ API GET …/rest/v1/Produtos_xml (busca-produtos)
    select = id_produto,content,link:metadata->detalhes->>link
    and    = (content.ilike."*{Palavra 1|[tool-input]palavra_1}*",content.ilike."*…*",…)
    limit  = 8
    [ERRO] → Ações: Retornar resultado {"ok":false,"orientacao":"…"} + Enviar notificação
→ Condição: [busca-produtos][0].content tem valor?
    [NENHUMA] → Ações: Retornar resultado {"ok":true,"produtos":[],"orientacao":"…"}
→ JavaScript (lista-produtos): embrulha a lista
    [ERRO] → o mesmo bloco de erro da API
→ Ações: Retornar resultado {"ok":true,"produtos":${[lista-produtos]produtos},"orientacao":"…"}
```

O JavaScript inteiro:

```js
// @ts-nocheck
const lista = await session.datasources["busca-produtos"];
return { produtos: Array.isArray(lista) ? lista : [] };
```

- **Por que o JavaScript**: o resultado da tool lê o caminho com `jsonpath` e pega só o 1º resultado. `${[fonte]}` quebra e `${[fonte][*]}` traz um item só (KB-03, seção 5). Dentro de um objeto, a lista sai inteira.
- **Exceção ao Padrão Oficial** (KB-03, seção 6): o código não lê campo nem grava nada, só repassa a lista. `Array.isArray` cobre resposta inesperada, e a saída de erro do bloco vai para o resultado de erro. `// @ts-nocheck` na 1ª linha evita que o editor sublinhe código válido.
- **A condição vem antes do JavaScript**: `[]` com status 200 segue pelo próximo passo da API (KB-16). É a condição que separa "não achou".
- **Todo caminho termina em "Retornar resultado da tool"**, inclusive os de erro. Se a execução quebra antes, o agente recebe os parâmetros Texto lidos no fluxo com o valor real (KB-10).
- **Um item só** (detalhar pelo código): dispensa o JavaScript. `${[fonte][0]}` já devolve o objeto.
- Supabase: `apikey` e `Authorization: Bearer` leem o token de um parâmetro do sistema Secreto. Operadores JSON no `select` e filtro com aspas: KB-16, seção 7.

## 14. Cache de tabela de apoio em Parâmetro do sistema

O padrão está em produção numa clínica integrada à Clinicorp: o cache de profissionais desde set/2026 e o de status desde 11/10/2026. O webhook do sistema externo traz só o ID (do profissional, do status do agendamento) e o fluxo precisa do nome. Em vez de buscar a lista no sistema a cada execução, o JavaScript guarda um dicionário `id → nome` num Parâmetro do sistema e só chama a API quando o ID não está lá. Medido em 19/11/2026 pela API da conta: `cache_status` (Texto, `secret: false`) foi criado com `{}` em 11/10 e tinha 8 status gravados pelo fluxo; `cache_dentistas` (Texto), 16 profissionais. O código abaixo é a versão revisada do que roda lá (Padrão Oficial, sem dado pessoal, com trava para ID inexistente) e ainda não foi importado numa conta.

**Quando oferecer**: o fluxo chama uma API externa só para traduzir um ID de tabela que quase não muda (profissionais, status, unidades, procedimentos, categorias, usuários do ERP), roda muitas vezes por dia, e a API tem limite (429), custo ou demora. Como o cache usa JavaScript e API (KB-06, seção 4), ofereça como **pergunta**, com o ganho em número: "Posso guardar a lista de profissionais em cache num Parâmetro do sistema? Com 20 profissionais e 300 agendamentos por dia, a API passa de 300 chamadas por dia para cerca de 20, uma por profissional novo." Faça o mesmo quando o usuário pedir cache.

**Não use** para dado que muda a cada execução (agenda, saldo, situação do pedido), para lista grande (catálogo com milhares de produtos), nem para guardar dado pessoal ou segredo.

```
Parâmetro do sistema Texto «cache_status», valor inicial {}
Gatilho: Requisição HTTP (evento com o StatusId)
→ JavaScript (get-status): lê o dicionário
    achou o ID   → { sucesso: true, dados: { status, origem: "cache" } }
    faltou o ID  → GET da lista inteira no sistema → refaz o dicionário → grava no parâmetro
                   → { sucesso: true, dados: { status, origem: "api" } }
    API falhou ou ID fora da lista → { sucesso: false, mensagem }
    [ERRO] → Enviar notificação (código quebrou ou estourou o tempo)
→ Condição por item: [get-status]sucesso = "true"
    [SE sim]  → Condição por item em [get-status]dados.status ("Atendido", "Faltou"…) → Mover negócio…
    [NENHUMA] → anotação/notificação com {mensagem|[get-status]mensagem} (inclui o 429) → fim
```

O JavaScript, no Padrão Oficial (KB-03, seção 6):

```js
// @ts-nocheck
// ##CONFIG##
const DATASOURCE = "normalizacao";   // fonte com o ID vindo do webhook
const CACHE = "cache_status";        // Parâmetro do sistema Texto, valor inicial {}
const TOKEN = "Token Sistema";       // Parâmetro do sistema Secreto
const RELER_APOS_MIN = 60;           // ID fora da lista só força nova leitura depois disso

try {
  const evento = await session.datasources[DATASOURCE];
  const id = evento?.status_id != null ? String(evento.status_id) : null;
  if (!id) throw new Error("status_id ausente no evento");

  let cache = {};
  try {
    const bruto = await session.getAdditionalValue(CACHE);
    cache = typeof bruto === "string" ? JSON.parse(bruto || "{}") : (bruto || {});
  } catch (e) { cache = {}; }
  const itens = cache?.itens || {};
  if (itens[id]) return { sucesso: true, erro: false, dados: { status: itens[id], origem: "cache" } };

  const lidoEm = Date.parse(cache?.lidoEm || "") || 0;
  if (Date.now() - lidoEm < RELER_APOS_MIN * 60000) {
    throw new Error(`ID ${id} fora da lista lida há menos de ${RELER_APOS_MIN} min`);
  }

  const token = await session.getAdditionalValue(TOKEN);
  if (!token) throw new Error(`Parâmetro "${TOKEN}" vazio`);
  const resp = await fetch("https://api.sistema.com/v1/status", {
    headers: { Accept: "application/json", Authorization: `Basic ${token}` }
  });
  if (!resp.ok) throw new Error(`Sistema externo respondeu HTTP ${resp.status}`);
  const corpo = await resp.json();
  const lista = Array.isArray(corpo) ? corpo : (corpo?.list || corpo?.data || []);

  const novos = {};
  for (const item of lista) {
    if (item?.id != null) novos[String(item.id)] = String(item.Description || item.name || "").trim();
  }
  await session.setAdditionalValue(CACHE, JSON.stringify({ lidoEm: new Date().toISOString(), itens: novos }));

  if (!novos[id]) throw new Error(`ID ${id} não está na lista do sistema`);
  return { sucesso: true, erro: false, dados: { status: novos[id], origem: "api" } };
} catch (error) {
  return { sucesso: false, erro: true, mensagem: error?.message || "Erro inesperado", debug: null };
}
```

- **`session.setAdditionalValue` grava no Parâmetro do sistema**: o valor é da conta, não do lead, e é o que as execuções seguintes leem (medido pelo cache que o fluxo preencheu).
- **Parâmetro Texto, não Secreto.** O cache não é segredo, e a gravação em Secreto não foi testada. Crie pela tela de Parâmetros do sistema. Pela API (`POST /crm/additionalFields` sem `additionalConfigs` e com `value: "{}"`, KB-08, seção 5.1.1) é ⚠️: só com confirmação do usuário. O token do sistema fica em outro parâmetro, Secreto.
- **Guarde só o que o fluxo usa.** O valor de um parâmetro Texto aparece na inspeção da sessão, no export dos parâmetros e para a equipe. Nome e ID bastam: nada de CPF, telefone ou e-mail (o cache de profissionais do caso real guardava o CPF sem precisar).
- **Na falta, refaça o dicionário com a lista inteira**, não acrescente um item ao que leu. Assim, se duas execuções gravarem quase juntas, as duas gravam a lista completa e nenhuma depende do que a outra leu.
- **`lidoEm` segura o ID que não existe.** Sem ele, um ID fora da lista (profissional excluído, evento de teste) chama a API em toda execução, que é o custo que o cache devia evitar. O caso real não tinha essa trava.
- **Nome que muda no sistema não atualiza sozinho.** Para forçar a releitura, troque o valor do parâmetro por `{}` na tela. Cache no formato antigo (dicionário sem `itens`) também é relido na primeira falta.
- **`dados.origem`** (`cache` ou `api`) mostra na inspeção da sessão se o cache está funcionando.
- O `flows-using` do parâmetro não conta leitura feita pelo JavaScript (KB-08, seção 5.1.1): antes de renomear ou apagar `cache_…`, procure o nome no JSON das versões.
- **Valor único** (um token, o ID de uma conta) dispensa o JavaScript: Condição "tem valor" → API → Mapeamento de campo no parâmetro, como na renovação de token da seção 10. O dicionário precisa do JavaScript porque o Mapeamento grava o valor inteiro, sem ler o que já está lá.

---

## Erros que quebram fluxos

1. **Itens mutuamente exclusivos em modo "todas verdadeiras"**: `event == "pago"` E `event == "cancelado"` nunca é verdadeiro. Use modo por item.
2. **Não deduplicar**: webhooks e agendamentos reenviam. Cheque lead e `businessExternalId` antes de criar.
3. **Mensagem sem conexão em fluxo sem conversa**: webhook, agendamento, negócio ganho e execução manual precisam de conexão fixa no bloco de mensagem.
4. **IA sem "Usuário parou de responder"**: uma resposta por fragmento de mensagem.
5. **Bot ativo com humano na conversa**: falta "Desativar as automações de chat".
6. **Régua sem estado**: follow-up sem tag ou etapa checada antes do envio repete mensagens.
7. **Loop entre automações** sem condição de saída.
8. **Saída de erro solta** em API e Mensagem: a execução morre calada.
9. **Caminho com chaves** em `parameter`, ou valor sem chaves em `value`/`text` (KB-03, seção 2).
10. **`[fonte]0.campo`** em vez de `[fonte][0].campo`.
11. **Referência não declarada**: etapa, tag, campo ou departamento usado no bloco e ausente em `data.*`.
12. **Token em texto**: em mensagem, comentário, campo adicional ou parâmetro Texto, o token fica visível para a equipe. Use parâmetro do sistema Secreto.
13. **Ação destrutiva por conveniência**: "Remover negócio" apaga histórico. Mover e perder quase sempre basta.
14. **Nome de automação repetido**: o import bloqueia. Use nomes únicos e descritivos.
15. **Pergunta ao lead fora do padrão**: Entrada do usuário gravando em campo do CRM, com a pergunta dentro dela, ou sem a saída "caso o usuário não responda".
16. **Ferramenta MCP com caminho que não termina em "Retornar resultado da tool"**: a execução quebra e o agente recebe os parâmetros Texto lidos no fluxo, tokens incluídos. Token vai em parâmetro Secreto.
