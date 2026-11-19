# KB-18 — Bloco IA — `type: "ai"`

"Utilize ações com inteligência artificial." Interpreta, classifica, extrai e escreve a partir da **conversa**: intenção, sentimento, extração de dados, respostas de assistente, transcrição de áudio e invocação de agentes. Consome tokens da **Crazy AI** do plano (sem saldo, a interface mostra "Adquira Crazy AI"). 50 blocos nos modelos.

**Regra de ouro**: IA para linguagem, **Condição** para critério objetivo. "Tem a tag", "está na etapa" e "campo igual" nunca vão para a IA.

Níveis ✅ 🟡 ⚠️ ⛔: ver KB-10.

---

## 1. Estrutura

```json
{
  "id": "uuid-v4",
  "type": "ai",
  "presentation": { "x": 914, "y": 0 },
  "sourceBlockId": null,
  "options": {
    "ais": [
      { "name": "chat-intent-ai", "group": "messages", "stepId": "uuid-v4", "options": { "model": "Basic", "messagesQtd": 20, "onlyCurrentThread": true, "intentions": [], "noneNextBlockId": "" } }
    ],
    "nextBlockId": "uuid-do-proximo",
    "errorNextBlockId": "uuid-falha-ia"
  }
}
```

- Item: `{ "name", "group": "messages", "stepId", "options" }`, com `stepId` UUID v4.
- **Saídas**:
  - "Próximo passo" (`nextBlockId`).
  - **"Caso ocorra erro na execução da IA"** (`errorNextBlockId`): sem saldo, falha do modelo.
  - Intenção e Sentimento têm uma saída por opção; Extrator, uma por parâmetro não encontrado.
- **Vários itens no mesmo bloco** rodam em sequência. Nos modelos: Transcrição de áudio **antes** de Assistente de chat ou Intenção, no mesmo bloco, para que áudios virem texto antes da análise.
- O nó mostra **Média Tokens** por execução. `{Total de tokens consumidos|aiConsumedTokens}` fica na sessão.

### Configurações de mensagens (comuns)

| Opção | Na interface | Padrão | Quando mudar |
|---|---|---|---|
| `model` | Modelo de IA | `"Basic"` (Crazy AI: 1 token = 1 caractere) · `"Transcription"` só na transcrição (300 tokens = 1 s de áudio) | O editor oferece só esses dois. As traduções citam "Mini" e "Pro", mas eles não aparecem no seletor. Use `"Basic"`. |
| `messagesQtd` | "Quantidade de mensagens do chat que serão consideradas" | `20` | 10 para classificar a **última** resposta (menos ruído e custo). 20–30 para assistente e extrator, que precisam do histórico. 50 para extrator em conversas longas. |
| `messageMaxHours` | "Quantidade máxima de horas…" — "0 = todas as mensagens até a quantidade acima" | `0` | 24 para não misturar uma conversa de meses atrás com a de hoje. |
| `onlyCurrentThread` | "Considerar apenas as mensagens do atendimento atual" | `false` | `true` na maioria dos fluxos de atendimento (usado em 13 de 23 intenções): ignora atendimentos antigos já encerrados. |
| `considerAnnotations` | "Considerar mensagens internas (anotações)" | `false` | `true` quando as anotações trazem contexto útil (ficha do lead, resumo anterior): resumos e scores. |

---

## 2. Mapa de decisão

| Preciso… | Item | Saída | Nível |
|---|---|---|---|
| saber **o que o lead quer** e mandar para o caminho certo | Intenção de conversa | uma por intenção + "Nenhuma intenção encontrada" | ✅ |
| saber se o lead está **satisfeito ou irritado** | Sentimento da conversa | uma por sentimento + "Neutro" | ✅ |
| **tirar dados** da conversa (nome, CNPJ, produto, quantidade) | Extrator de parâmetros | `[AI-n]Parametro` + saída por parâmetro vazio | ✅ |
| **responder** o lead como atendente virtual | Assistente de chat | `[AI-n]text` / `lastAiText` | ✅ |
| **gerar um texto** a partir da conversa (resumo, score, sugestão) | Gere um texto com base na conversa | `[AI-n]text` / `lastAiText` | ✅ |
| **transcrever áudios** antes de analisar | Transcrição de áudio | áudios viram texto para os itens seguintes | ✅ |
| entregar a conversa a um **agente de IA** configurado no CRM | Invocar Agente | fonte `Agent-n` | 🟡 |

---

## 3. Itens

### Intenção de conversa — `chat-intent-ai` ✅

"Identifica a intenção do usuário na conversa atual." É a IA mais usada: 23 blocos, 86 intenções.

```json
{ "name": "chat-intent-ai", "group": "messages", "stepId": "uuid-v4", "options": { "model": "Basic", "messagesQtd": 10, "onlyCurrentThread": true, "intentions": [
  { "id": "uuid-v4", "intention": "Financeiro", "description": "Quando o cliente quer segunda via de boleto, nota fiscal ou falar de pagamento.", "example": "Quero a segunda via do boleto\nPreciso da nota fiscal", "nextBlockId": "uuid-financeiro" },
  { "id": "uuid-v4", "intention": "Falar com atendente", "description": "Quando pede atendimento humano ou demonstra irritação com o robô.", "example": "Quero falar com uma pessoa\nAtendente", "nextBlockId": "uuid-humano" }
], "noneNextBlockId": "uuid-nao-entendi" } }
```

| Campo da intenção | Na interface | Como escrever |
|---|---|---|
| `intention` | Intenção | Nome curto e único ("Financeiro", "Voltar ao menu"). |
| `description` | "Informe mais detalhes de quando essa intenção deve ocorrer" | **É o que decide.** Comece com "Quando o cliente…" e liste sinônimos e situações. Diga o que **não** é quando houver risco de confusão. |
| `example` | "Informe exemplos de mensagens que indiquem a intenção" | 2–5 frases reais, uma por linha (`\n`). 23 de 86 nos modelos estão vazios: preencha sempre. |
| `nextBlockId` | Saída da intenção | Obrigatório. |
| `noneNextBlockId` | "Nenhuma intenção encontrada" | "Não entendi, pode repetir?" + nova Entrada do usuário, ou transferir para humano. |

- O editor cria 2 intenções "Nova intenção" em branco. Nos modelos: 2 a 5 por bloco.
- **Use depois** de Entrada do usuário (22×) ou "Usuário parou de responder". **Depois**, nos modelos: Adicionar tags (34×), Mensagem (29×), Iniciar outra automação (8×).
- **Intenções-padrão úteis**:
  - "Falar com atendente", sempre, para não prender o lead no robô.
  - "Voltar ao menu", em menus.
  - "Não tem interesse", em reativação, para parar a cadência e perder o negócio.
- **Menu com botões**: repita os botões como intenções para capturar quem digita em vez de tocar.

### Sentimento da conversa — `chat-sentiment-ai` ✅

"Identifica o sentimento do usuário na conversa atual."

```json
{ "name": "chat-sentiment-ai", "group": "messages", "stepId": "uuid-v4", "options": { "model": "Basic", "messagesQtd": 20, "sentiments": [
  { "id": "uuid-v4", "sentiment": "Satisfeito", "description": "Cliente elogia, agradece ou quer continuar a conversa.", "nextBlockId": "uuid-satisfeito" },
  { "id": "uuid-v4", "sentiment": "Insatisfeito", "description": "Cliente reclama, demonstra irritação ou não quer falar com IA.", "nextBlockId": "uuid-insatisfeito" }
], "neutralNextBlockId": "uuid-neutro" } }
```

- Padrão do editor: "Satisfeito" e "Insatisfeito", mais a saída **"Neutro"** (`neutralNextBlockId`).
- **Use**: escalar para humano quem está irritado com o bot, NPS conversacional, priorizar retenção.
- **Intenção × Sentimento**: intenção é **o que** o lead quer (roteia por assunto); sentimento é **como** ele está (roteia por urgência ou cuidado).

### Extrator de parâmetros — `chat-parameters-ai` ✅

"Extrai parâmetros da conversa atual." Transforma conversa livre em dados estruturados.

```json
{ "name": "chat-parameters-ai", "group": "messages", "stepId": "uuid-v4", "options": { "model": "Basic", "messagesQtd": 20, "onlyCurrentThread": true, "messageMaxHours": 24, "datasourceName": "extrator-comercial", "datasourceColor": "#6366f1", "parameters": [
  { "id": "uuid-v4", "parameter": "CNPJ", "type": "string", "description": "CNPJ da empresa informado pelo cliente, só números.", "example": "12345678000190", "emptyBlockId": "uuid-pedir-cnpj" },
  { "id": "uuid-v4", "parameter": "Quantidade", "type": "number", "description": "Quantidade mensal de peças que o cliente quer comprar.", "example": "500", "emptyBlockId": "" }
] } }
```

| Campo do parâmetro | Na interface | Como usar |
|---|---|---|
| `parameter` | Nome do Parâmetro | Vira o caminho: `[extrator-comercial]CNPJ`. Prefira nomes sem espaço e acento. |
| `type` | Tipo do parâmetro | `"string"` (Texto) · `"number"` (Número) · `"date"` (Data) · `"boolean"` (Verdadeiro/Falso). |
| `description` | "Informações sobre o parâmetro" | Diga o formato esperado ("só números", "com DDD"). |
| `example` | "Informe exemplos de respostas" | Um valor no formato certo. |
| `emptyBlockId` | Saída quando o parâmetro **não foi encontrado** | Ligue ao bloco que **pergunta** o dado que falta. `""` segue o fluxo mesmo sem ele. |

- **Depois**, nos modelos: Mapeamento de campo (9×), gravando em `leadCompany`, `leadTaxId`, `leadEmail` e campos adicionais: `{CNPJ|[extrator-comercial]CNPJ}`.
- **Use**: qualificação conversacional (nome da empresa, CNPJ, produto, volume), pedidos por WhatsApp (itens e quantidades), agendamento (data desejada).
- Entrada do usuário **sem campo** (regra da consultoria) + Extrator é o jeito certo de guardar o que o lead respondeu.

### Assistente de chat — `chat-assistant-ai` ✅

"Gere uma resposta como um assistente com base na conversa atual."

```json
{ "name": "chat-assistant-ai", "group": "messages", "stepId": "uuid-v4", "options": { "model": "Basic", "messagesQtd": 20, "onlyCurrentThread": true, "prompt": "# Persona\nVocê é a Ana, assistente da Loja X.\n# Objetivo\nTirar dúvidas sobre prazos e trocas.\n# Regras\n- Responda em até 3 frases.\n- Se não souber, diga que vai chamar um atendente.", "datasourceName": "AI-1", "datasourceColor": "#6366f1" } }
```

- `prompt`: "Instruções do assistente". Estrutura que funciona nos modelos: **Persona e tom**, **Objetivo**, **Regras** (o que nunca dizer, tamanho da resposta) e **Informações do negócio** (preços, horários, políticas).
- Saída: `{Último resultado da IA|lastAiText}` ou `[AI-1]text` → **Mensagem de texto** logo depois (8 de 13 nos modelos).
- **Use**: FAQ, pré-venda, reengajamento ("leads inativos": mensagem personalizada pelo histórico).
- **Não use** como único cérebro de um atendimento com regras de negócio: combine com Intenção (roteia) e Extrator (captura), ou use **Invocar Agente**.

### Gere um texto com base na conversa — `chat-completion-llm-ai` ✅

"Gere um texto com base na conversa atual." `options` do Assistente, mais `considerAnnotations`. Nos modelos, `prompt`: "Gere um resumo da conversa com os principais pontos e um score…".

- Diferente do Assistente: o resultado **não é para o lead**. Destinos:
  - **anotação** na conversa (KB-11), para o atendente;
  - **comentário** no lead ou **sugestão de resposta** (KB-12);
  - **campo adicional** "Score" → condição.
- **Use**: resumo antes de transferir, score de qualificação, briefing para o vendedor.

### Transcrição de áudio — `audio-transcription-ai` ✅

"Transcreve os áudios do chat para texto."

```json
{ "name": "audio-transcription-ai", "group": "messages", "stepId": "uuid-v4", "options": { "model": "Transcription", "prompt": "", "messagesQtd": 10, "onlyCurrentThread": true, "transcriptionSource": "received", "transcriptionLanguage": "pt", "datasourceName": "AI-transcricao", "datasourceColor": "#8b5cf6" } }
```

| Opção | Na interface | Valores | Quando usar |
|---|---|---|---|
| `transcriptionSource` | Fonte dos áudios | `"all"` (padrão) · `"received"` · `"sent"` | `received` para entender o cliente (mais barato). `all` quando o áudio do atendente também é contexto. |
| `transcriptionLanguage` | Idioma | `"pt"` · `"en"` · `"es"` | Idioma do público. |
| `prompt` | "Instruções para transcrição" | texto | Termos técnicos e nomes de produto que o modelo deve grafar certo. |
| `messagesQtd` | mensagens consideradas | 3–20 | Só as últimas: 3 a 10. |

- Coloque **no mesmo bloco, antes** do Assistente, Intenção ou Extrator. Os áudios viram texto e entram na análise. Custo: 300 tokens por segundo de áudio.

### Invocar Agente — `agent-completion-ai` ✅

"Invoca um agente para processar a conversa atual." Aparece na aba **Agentes** do catálogo.

```json
{ "name": "agent-completion-ai", "group": "agents", "stepId": "uuid-v4", "options": { "agentId": "", "prompt": "", "messagesQtd": 20, "onlyCurrentThread": true, "considerAnnotations": false, "datasourceName": "Agent-1", "datasourceColor": "#6366f1" } }
```

- ⚠️ **`group: "agents"`**, não `"messages"` como os outros itens de IA. Medido em exportações reais (set e out/2026): as sete chaves acima, sempre todas.

| Opção | Na interface | Como usar |
|---|---|---|
| `agentId` | Agente | Pendência: agente criado no módulo de IA do CRM. |
| `prompt` | "Instruções adicionais (opcional)" | Contexto daquela etapa ("o lead veio do anúncio de energia solar"). |
| `messagesQtd`, `messageMaxHours`, `onlyCurrentThread`, `considerAnnotations` | "Configurações de mensagens" | Iguais aos da seção 1. |
| `datasourceName` | "Fonte de dados com o resultado" | `[Agent-1]…`. |

- **Alternativa ✅ dos modelos** ("Invocar Agente – <área 1> / <área 2> / <área 3> / <área 4>"): bloco de **Ações** com "Iniciar o atendimento" + "Transferir atendente da conversa" (`attendantId` = agente). O agente assume a conversa até o fim.
- **Qual usar**: o agente deve **assumir** a conversa → transferência. O fluxo precisa de **uma resposta** do agente e depois continua sozinho → Invocar Agente.
- ⚠️ **Invocar Agente não envia nada ao contato** (confirmado em 22/10/2026): ele só grava a resposta na fonte de dados. Toda invocação precisa, logo depois, de um bloco de **Mensagem** com `{Resposta do agente|[<datasourceName>]text}` (ex.: `[Agent-1]text`). Sem ele, o lead fica sem resposta e a conversa para na fila.
- **Agente responde agora e assume o resto**: Ações (Iniciar o atendimento + Transferir atendente da conversa com o `id` de `GET /crm/attendants`) → Invocar Agente → Mensagem `[<datasourceName>]text`. A transferência sozinha só faz o agente responder a partir da **próxima** mensagem do lead.
- ⚠️ **Agente atendente responde a qualquer mensagem que chegar** (medido em 22/10/2026): enquanto ele estiver como atendente da conversa, responde também a comandos e mensagens que disparam outros fluxos (ex.: `#teste`), por cima do fluxo que espera um botão. Por isso:
  - a transferência para o agente fica **só no caminho que deve ligá-lo** (ex.: botão "Quero ver atendendo"), nunca no "respondeu qualquer coisa" nem em outro botão;
  - fluxo que (re)começa uma abordagem ou um teste na mesma conversa abre com Ações → Transferir atendente da conversa com `attendantId: ""` (tira o agente) antes da 1ª mensagem;
  - todo fluxo que coloca o agente precisa de um caminho que o tire (fim de teste, opt-out, humano assumiu).
- ⚠️ **Ferramenta que tira o agente da conversa descarta a resposta dele** (medido em 23/10/2026): se a automação da ferramenta (gatilho MCP) transfere a conversa para um humano ou limpa o atendente, o texto final que o agente escreve depois da ferramenta não é enviado. A fala de passagem ("Vou passar você para uma pessoa do time…") tem que sair de um bloco de **Mensagem dentro da automação da ferramenta**, antes da transferência; o retorno da ferramenta só orienta o agente.

---

## 4. Padrões

| Objetivo | Montagem |
|---|---|
| Menu inteligente | Mensagem com botões + Entrada do usuário → Usuário parou de responder 8 s → **[Transcrição + Intenção]** → caminhos → "Nenhuma": não entendi (1 retentativa) → humano. |
| Qualificação SDR | Perguntas (Mensagem + Entrada) → **Extrator** (empresa, CNPJ, volume) → Mapeamento → condição de perfil → vendedor ou nutrição. |
| Atendente virtual com escape | **[Transcrição + Intenção]** "Falar com humano"? → transferência · senão → **Assistente** → Mensagem `{lastAiText}` → Entrada do usuário → volta. |
| Briefing na transferência | **Gere um texto** (resumo + score, `considerAnnotations: true`) → Mensagem com `isAnnotation: true` `{lastAiText}` → Transferir atendente. |
| Copiloto | **Assistente** → Adicionar sugestão de resposta `{lastAiText}`. |

- ⚠️ **Follow-up do agente fora do horário** (medido em 23–24/10/2026): o follow-up automático do agente (`properties.behaviors.followup`, `followup_cadences` em minutos, `followup_final.mode: "finish"`; na tela, cadências com "Mensagem padrão / Instrução / Ferramenta") conta o tempo corrido e manda de madrugada. Para prospecção, desligue (`followup: false`) e faça o follow-up por automação: Iniciar outra automação depois da 1ª resposta do agente → Espera → Janela de conversa (falou?) → Espera de intervalo de hora (horário comercial) → Janela de conversa de novo (ele pode ter respondido durante a espera) → Invocar Agente com a instrução do follow-up → Mensagem `[fonte]text`. Pare quando o agente deixar de ser atendente, o lead tiver tag de opt-out ou a janela de 24 h fechar.

## 5. Erros comuns

1. **Intenções sem descrição ou sem exemplos**: a IA chuta.
2. **`noneNextBlockId` vazio**: quem não se encaixa some.
3. **IA logo depois de uma pergunta**, sem "Usuário parou de responder": analisa só o "oi" antes da resposta completa.
4. **Áudio sem Transcrição** antes da Intenção.
5. **`messagesQtd` alto para classificar a última resposta**: mistura assuntos antigos. Use 10 + `onlyCurrentThread: true`.
6. **Parâmetros do Extrator sem `emptyBlockId`** quando o dado é obrigatório.
7. **Critério objetivo na IA** (tag, etapa, valor): use Condição.
8. **Saída de erro vazia** em atendimento 100% IA: sem saldo de tokens, o lead fica sem resposta. Ligue a uma mensagem padrão + transferência.
9. **`model` inventado** ("GPT-4", "Pro"): só `"Basic"` e `"Transcription"`.
