# KB-02 — Mapa dos Blocos

Índice de todos os blocos e itens do construtor de automações do Datacrazy, com nome interno, grupo, nível de confiança e o KB que explica cada um em detalhe.

Fontes:
- código e textos de ajuda do editor do CRM (set/2026);
- 74 automações reais (2.252 blocos);
- os modelos oficiais do Datacrazy;
- importações testadas numa conta real.

## Como usar este mapa

1. Escolha o **bloco** pelo que o passo precisa fazer (seção 1).
2. Abra o **KB do bloco** e escolha o **item** pelo mapa de decisão dele. Lá estão cada opção, os valores, quando usar cada um, exemplos JSON e erros comuns.
3. Confira o **nível** do item antes de colocar no JSON (seção 2).

| KB | Bloco | `type` |
|---|---|---|
| KB-10 | Início (gatilhos) | `trigger` |
| KB-11 | Mensagem | `chat` |
| KB-12 | Ações | `action` |
| KB-13 | Condições | `condition` |
| KB-14 | Espera | `delay` |
| KB-15 | Randomizador | `randomizer` |
| KB-16 | API | `api` |
| KB-17 | Operações de campos | `field-operation` |
| KB-18 | IA | `ai` |
| KB-19 | JavaScript | `javascript` |

Estrutura geral do JSON, dependências e roteamento: KB-01. Variáveis, fontes de dados e o Padrão Oficial do JavaScript: KB-03.

---

## 1. Qual bloco usar

| O passo precisa… | Bloco | Não confundir com |
|---|---|---|
| começar o fluxo quando algo acontece | **Início** | — |
| falar com o contato (texto, pergunta, arquivo, template, comentário) | **Mensagem** | Notificação (usuários do CRM) e comentário no lead (cadastro): **Ações**. |
| mudar algo no CRM (lead, negócio, tag, conversa, atividade, outro fluxo) | **Ações** | Gravar valor em campo: **Operações de campos**. |
| escolher o caminho por um critério objetivo | **Condições** | Critério de linguagem ("o que ele quis dizer"): **IA**. |
| pausar por tempo, janela, data ou silêncio do contato | **Espera** | Esperar **resposta**: Entrada do usuário (**Mensagem**). |
| sortear o caminho (distribuição, A/B) | **Randomizador** | Critério de negócio: **Condições**. |
| buscar ou enviar dados a outro sistema | **API** | Cálculo ou várias chamadas com lógica: **JavaScript**. |
| consultar ou alterar o próprio CRM além dos blocos nativos | **API** ou **JavaScript** com a API do Datacrazy (KB-07) | O que uma ação ou condição nativa já faz: **Ações** e **Condições**. |
| gravar, normalizar ou percorrer dados | **Operações de campos** | Transformação complexa: **JavaScript**. |
| entender, extrair ou escrever linguagem natural | **IA** | Regra fixa: **Condições**. |
| calcular, reorganizar JSON, regras compostas | **JavaScript** | O que um bloco nativo já faz. |

---

## 2. Níveis de confiança

- ✅ **Produção**: visto nas automações reais exportadas. Estrutura provada no import. Pode usar.
- 🟡 **Editor**: nome, grupo e opções iniciais tirados do código do editor, sem uso nos modelos. Pode usar; registre a Pendência "conferir o item no CRM após importar".
- ⚠️ **Só na interface**: depende de integração, upload ou recurso da conta que um LLM não gera. **Não coloque no JSON**; construa o resto e oriente configurar à mão (seção 4).
- ⛔ **Oculto**: existe no código, mas não aparece no catálogo. **Nunca use.**

**Formato de item por bloco** (detalhes no KB-01):
- **Gatilho, Ações, API**: `{ "name", "group", "options" }`.
- **Mensagem, Operações de campos, IA**: `{ "name", "group", "stepId", "options" }`.
- **Condição**: `{ "id", "name", "group", "options", "nextBlockId" }`.
- **Espera**: `{ "name", "options" }`, sem `group`.
- **Randomizador**: ramificações `{ "id", "name", "perc", "nextBlockId" }`.
- **JavaScript**: sem itens.

---

## 3. Catálogo completo

As tabelas desta seção são geradas pelo build a partir de `catalogo-blocos.json`, na mesma pasta deste KB. Para incluir um item ou mudar nome, nível ou grupo, edite o JSON e rode o build.

### KB-10 — Início (`trigger`)

<!-- catalogo-blocos:trigger -->
| Nível | Na interface | `name` | `group` |
|---|---|---|---|
| ✅ | Execução manual da automação por lead ou contato | `manually-lead-trigger` | `lead` |
| 🟡 | Tag removida do lead | `lead-tag-removed-trigger` | `lead` |
| 🟡 | Tag adicionada ao lead | `lead-tag-added-trigger` | `lead` |
| ✅ | Lead criado | `lead-created-trigger` | `lead` |
| 🟡 | Lead atingir uma quantidade definida de negócios ganhos | `lead-won-businesses-count-trigger` | `lead` |
| 🟡 | Lead ultrapassar um valor definido de negócios ganhos | `lead-won-businesses-value-trigger` | `lead` |
| 🟡 | Lead não realiza compras nos últimos dias | `lead-without-buying-trigger` | `lead` |
| 🟡 | É aniversário do Lead | `lead-birthday-trigger` | `lead` |
| ✅ | Negócio movido | `business-entered-trigger` | `business` |
| ✅ | Negócio criado | `business-created-trigger` | `business` |
| ✅ | Atendente atribuído ao negócio | `business-attendant-included-trigger` | `business` |
| 🟡 | Atendente retirado do negócio | `business-attendant-removed-trigger` | `business` |
| ✅ | Negócio ganho | `business-won-trigger` | `business` |
| 🟡 | Negócio perdido | `business-lost-trigger` | `business` |
| 🟡 | Situação do negócio restaurada | `business-restore-status-trigger` | `business` |
| ⛔ | Execução manual por negócio | `manually-business-trigger` | `business` |
| ✅ | Mensagem recebida | `message-received-trigger` | `messages` |
| ✅ | Mensagem enviada | `message-sended-trigger` | `messages` |
| ✅ | Atendimento finalizado | `thread-finished-trigger` | `messages` |
| ✅ | Atendimento iniciado | `thread-initialized-trigger` | `messages` |
| ✅ | Departamento alterado | `department-changed-trigger` | `messages` |
| 🟡 | Comentário do Instagram recebido | `instagram-comment-received-trigger` | `instagram` |
| 🟡 | Comentário em live do Instagram recebido | `live-instagram-comment-received-trigger` | `instagram` |
| 🟡 | Comentário do Facebook recebido | `facebook-comment-received-trigger` | `facebook` |
| 🟡 | Comentário em live do Facebook recebido | `live-facebook-comment-received-trigger` | `facebook` |
| 🟡 | Formulário do Facebook (Lead Ads) | `meta-form-trigger` | `facebook` |
| 🟡 | Campo alterado | `field-changed-trigger` | `field` |
| ✅ | Requisição HTTP (Webhook) | `json-http-request-trigger` | `http` |
| ✅ | Iniciado por outra automação | `initiated-by-another-automation-trigger` | `system` |
| ✅ | MCP Server Tool | `mcp-server-tool-trigger` | `system` |
| ✅ | Execução agendada | `cron-job-trigger` | `system` |
| 🟡 | Atividade executada | `activity-executed-trigger` | `activities` |
| ⚠️ | Tray | `tray-trigger` | `integrations` |
| ⚠️ | Gatilho de Botões do Impulso | `boost-buttons-trigger` | `boosts` |
<!-- /catalogo-blocos -->

### KB-11 — Mensagem (`chat`)

<!-- catalogo-blocos:chat -->
| Nível | Na interface | `name` | `group` |
|---|---|---|---|
| ✅ | Mensagem de texto | `send-text-message` | `messages` |
| ✅ | Entrada do usuário | `text-input-message` | `messages` |
| ✅ | Atraso de tempo | `delay-message` | `time` |
| ⚠️ | Mensagem de áudio | `send-audio-message` | `messages` |
| ✅ (upload ⚠️) | Arquivo anexo | `send-file-message` | `messages` |
| ✅ | Arquivo URL Dinâmica | `send-url-file-message` | `messages` |
| 🟡 | Resposta do Comentário do Facebook | `send-comment-facebook` | `facebook` |
| 🟡 | Resposta do Comentário do Instagram | `send-comment-instagram` | `instagram` |
| ✅ | Template do WhatsApp | `whatsapp-send-template-message` | `whatsapp-cloud` |
<!-- /catalogo-blocos -->

Configurações do bloco: conexão (`instanceId`, `platform`, `provider`), envio direto (`contactId`), agendamento (`scheduledDate`, `timezone`) e anotação (`isAnnotation`). Ver KB-11, seção 2.

### KB-12 — Ações (`action`)

<!-- catalogo-blocos:action -->
| Nível | Na interface | `name` | `group` |
|---|---|---|---|
| ✅ | Criar negócio | `create-business-action` | `business` |
| ✅ | Mover negócio de etapa | `move-business-action` | `business` |
| ✅ | Duplicar o negócio | `clone-business-action` | `business` |
| ✅ | Ganhar negócio | `win-business-action` | `business` |
| ✅ | Perder negócio | `lose-business-action` | `business` |
| 🟡 | Restaurar negócio | `restore-business-action` | `business` |
| ✅ | Transferir um atendente ao negócio | `add-attendant-on-business-action` | `business` |
| ✅ | Remover o atendente do negócio | `clean-attendant-on-business-action` | `business` |
| ✅ | Adicionar um produto ao negócio | `add-product-on-business-action` | `business` |
| ✅ | Remover um produto do negócio | `remove-product-on-business-action` | `business` |
| ✅ | Adicionar descontos, acréscimo, frete e cupom | `add-discount-shipping-action` | `business` |
| ✅ ⚠️ destrutivo | Remover negócio | `remove-business-action` | `business` |
| ✅ | Criar lead | `create-lead-action` | `lead` |
| 🟡 ⚠️ destrutivo | Deletar lead | `delete-lead-action` | `lead` |
| ✅ | Criar tags | `create-tag-action` | `lead` |
| ✅ | Adicionar tags | `add-tag-action` | `lead` |
| ✅ | Remover tags | `remove-tag-action` | `lead` |
| 🟡 | Criar listas | `create-list-action` | `lead` |
| ✅ | Adicionar listas | `add-list-action` | `lead` |
| 🟡 | Remover listas | `remove-list-action` | `lead` |
| ✅ | Adicionar comentário no lead | `add-lead-comment-action` | `lead` |
| ✅ | Transferir um atendente ao lead | `add-attendant-on-lead-action` | `lead` |
| ✅ | Remover atendente do lead | `clean-attendant-on-lead-action` | `lead` |
| 🟡 | Distribuidor de atendentes | `change-attendant-action` | `lead` |
| ✅ | Iniciar o atendimento | `start-conversation-action` | `messages` |
| ✅ | Finalizar o atendimento | `finish-conversation-action` | `messages` |
| ✅ | Transferir atendente da conversa | `change-conversation-attendant-action` | `messages` |
| ✅ | Transferir departamento da conversa | `change-conversation-department-action` | `messages` |
| ✅ | Desativar as automações de chat na conversa | `stop-chat-automations-action` | `messages` |
| 🟡 | Ativar as automações de chat na conversa | `start-chat-automations-action` | `messages` |
| 🟡 | Adicionar sugestão de resposta | `change-conversation-suggestion-action` | `messages` |
| ✅ | Criar produto | `create-product-action` | `product` |
| ✅ | Enviar notificação | `send-notification-action` | `system` |
| ✅ | Iniciar outra automação | `start-another-automation-action` | `system` |
| 🟡 | Retornar resultado da tool | `set-tool-result-action` | `system` |
| ✅ | Criar atividade | `create-activity-action` | `activities` |
<!-- /catalogo-blocos -->

### KB-13 — Condições (`condition`)

<!-- catalogo-blocos:condition -->
| Nível | Na interface | `name` | `group` |
|---|---|---|---|
| ✅ | Lead existente | `lead-exists-condition` | `lead` |
| ✅ | Lead com email existente | `lead-with-email-exists-condition` | `lead` |
| ✅ | Lead com telefone existente | `lead-with-phone-exists-condition` | `lead` |
| ✅ | Lead com CPF existente | `lead-with-taxid-exists-condition` | `lead` |
| ✅ | Lead com nome existente | `lead-with-name-exists-condition` | `lead` |
| 🟡 | Procura se existe um lead com um campo adicional | `lead-with-additional-field-exists-condition` | `lead` |
| ✅ | Lead possui negócio na pipeline | `lead-has-business-on-pipeline-condition` | `lead` |
| ✅ | Lead possui negócio na etapa | `lead-has-business-on-stage-condition` | `lead` |
| 🟡 | Lead possui conversa em aberto | `lead-has-open-conversation-condition` | `lead` |
| ✅ | Verifica se o lead possui uma tag | `lead-has-tag-condition` | `lead` |
| ✅ | Lead possuir atendente responsável | `lead-has-attendant-condition` | `lead` |
| ⛔ | Lead possui campos adicional | `lead-has-additional-fields-condition` | `lead` |
| ✅ | Negócio atual está na etapa | `business-is-on-stage-condition` | `business` |
| ✅ | Negócio está ganho | `business-is-won-condition` | `business` |
| ✅ | Negócio está perdido | `business-is-lost-condition` | `business` |
| 🟡 | Negócio está pendente | `business-is-pending-condition` | `business` |
| ✅ | Negócio possui atendentes | `business-has-attendants-condition` | `business` |
| ✅ | Negócio sem atendentes | `business-attendant-empty-condition` | `business` |
| 🟡 | Negócio possui o produto | `business-has-product-condition` | `business` |
| ✅ | Negócio com ID externo existente | `business-with-external-id-exists-condition` | `business` |
| ✅ | Procura se existe um negócio com um campo adicional | `business-with-additional-field-exists-condition` | `business` |
| ✅ | Conversa possuir atendente responsável | `conversation-has-attendant-condition` | `messages` |
| ✅ | Janela de conversa está aberta | `conversation-window-is-open-condition` | `messages` |
| 🟡 | Conversa em departamento | `conversation-has-department-condition` | `messages` |
| ✅ | Conversa finalizada | `conversation-has-finalized-condition` | `messages` |
| 🟡 | Automações de chat estão habilitadas | `conversation-automation-is-enabled` | `messages` |
| ✅ | Campo com valor igual | `field-is-equal-condition` | `field` |
| ✅ | Campo contém valor | `field-contains-condition` | `field` |
| ✅ | Campo possui valor | `field-has-value-condition` | `field` |
| ✅ | Campo possui um valor entre dois valores | `between-condition` | `field` |
| ✅ | Campo contém algum dos textos | `field-matches-n-text-values` | `field` |
| ✅ | Verifica se a hora atual está em um intervalo de dia/hora | `current-time-interval-condition` | `time` |
| 🟡 | Seguidor do Instagram | `instagram-follower` | `instagram` |
| ⛔ | Verifica campo adicional da empresa (hoje Parâmetros do sistema; segue oculta em 08/10/2026) | `company-has-additional-field-condition` | `company` |
<!-- /catalogo-blocos -->

### KB-14 — Espera (`delay`, item sem `group`)

<!-- catalogo-blocos:delay -->
| Nível | Na interface | `delay.name` |
|---|---|---|
| ✅ | Espera de alguns segundos | `seconds-delay` |
| ✅ | Espera de alguns minutos | `minutes-delay` |
| ✅ | Espera de algumas horas | `hours-delay` |
| ✅ | Espera de alguns dias | `days-delay` |
| ✅ | Espera de um intervalo de hora nos dias da semana | `time-interval-delay` |
| 🟡 | Espera o dia/horário | `until-date-delay` |
| ✅ | Usuário parou de responder | `user-stop-chatting-delay` |
<!-- /catalogo-blocos -->

### KB-15 — Randomizador (`randomizer`) ✅

Sem itens de catálogo: ramificações A, B, C… com percentuais.

### KB-16 — API (`api`)

<!-- catalogo-blocos:api -->
| Nível | Na interface | `name` | `group` |
|---|---|---|---|
| ✅ | Requisição HTTP com comunicação via JSON | `json-http-request-api` | `http` |
| ✅ | Requisição de arquivo HTTP | `json-http-request-file-api` | `http` |
<!-- /catalogo-blocos -->

### KB-17 — Operações de campos (`field-operation`)

<!-- catalogo-blocos:field-operation -->
| Nível | Na interface | `name` | `group` |
|---|---|---|---|
| ✅ | Mapeamento de campo | `set-field-operation` | `field` |
| ✅ | Loop de array | `loop-array-field-operation` | `field` |
| ✅ | Análise de telefone | `parse-phone-field-operation` | `field` |
| ✅ | Formatação de data | `parse-date-field-operation` | `field` |
<!-- /catalogo-blocos -->

### KB-18 — IA (`ai`)

<!-- catalogo-blocos:ai -->
| Nível | Na interface | `name` | `group` |
|---|---|---|---|
| ✅ | Assistente de chat | `chat-assistant-ai` | `messages` |
| ✅ | Gere um texto com base na conversa | `chat-completion-llm-ai` | `messages` |
| ✅ | Transcrição de áudio | `audio-transcription-ai` | `messages` |
| ✅ | Intenção de conversa | `chat-intent-ai` | `messages` |
| ✅ | Sentimento da conversa | `chat-sentiment-ai` | `messages` |
| ✅ | Extrator de parâmetros | `chat-parameters-ai` | `messages` |
| ✅ | Invocar Agente | `agent-completion-ai` | `agents` |
<!-- /catalogo-blocos -->

### KB-19 — JavaScript (`javascript`) ✅

Sem itens: `javascriptCode`, `timeout`, `datasourceName`, `datasourceColor`, `nextBlockId`, `errorNextBlockId`.

---

## 4. Itens ⚠️ e ⛔ — o que fazer

| Item | Por que não vai no JSON | Faça assim |
|---|---|---|
| Mensagem de áudio | Áudio gravado no editor | Mensagem de texto marcadora "[gravar áudio: …]" + Pendência. |
| Arquivo anexo (novo) | Upload ao CDN do Datacrazy | Arquivo URL Dinâmica com link público, ou marcadora + Pendência. |
| Tray | Integração conectada e eventos escolhidos na interface | Webhook da Tray + condição por evento, ou montar os caminhos e orientar a trocar o gatilho. |
| Botões do Impulso | Impulso e template criados na conta | Montar os caminhos e orientar a configurar o gatilho. |
| Template do WhatsApp sem dados | Precisa de template aprovado | Gere só com nome, idioma, texto e variáveis informados; senão, marcadora + Pendência. |
| ⛔ itens ocultos | Não aparecem no catálogo | Use as alternativas: Campo possui valor (campo adicional do lead), gatilho manual por lead. |

Itens 🟡 de integração (Formulário do Facebook, comentários) podem ir no JSON com os IDs vazios e a Pendência de selecionar integração, página, formulário ou mídia na interface.

---

## 5. Cores de fonte de dados

`datasourceColor` aceita qualquer hexadecimal. Mais usados: `#3b82f6`, `#6366f1`, `#22c55e`, `#f97316`, `#14b8a6`, `#8b5cf6`, `#10b981`, `#f59e0b`.
