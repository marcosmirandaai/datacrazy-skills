# Catálogo completo dos blocos

## 1. Mensagem (`type: chat`)

Campo do bloco: **Conexão** (em branco = herda a conexão dos blocos anteriores).
Saídas: próximo passo + **"Caso ocorrer erro no envio da mensagem"**.

| Item | O que faz | Opções no JSON |
|---|---|---|
| Mensagem de texto | envia texto; aceita **botões** e quebra automática em várias mensagens | `text`, `buttons[]`, `breakMessages`, `breakMessagesIntervalInSeconds` |
| Entrada do usuário | envia uma pergunta e **espera a resposta**, guardando num parâmetro | `text`, `parameter`, `invalidResponseMessage`, `timeoutWaitType`, `timeoutInSeconds`, `timeoutNextBlockId` |
| Atraso de tempo | pausa entre mensagens (simula digitação) | `seconds` |
| Mensagem de áudio | envia áudio | — |
| Arquivo anexo | envia arquivo carregado | `url`, `filename`, `mimeType`, `size`, `text`, `platforms[]` |
| Arquivo URL Dinâmica | envia arquivo cuja URL vem de uma variável | idem, com `url` interpolado |

**Entrada do usuário** é o único bloco que pausa esperando resposta com
timeout próprio — use `timeoutNextBlockId` para o caminho de "não respondeu".

## 2. Ações (`type: action`)

Saídas: próximo passo + erro na execução.

### Negócios
Criar negócio · Mover negócio de etapa (mesma ou outra pipeline) · Ganhar
negócio · Perder negócio · Restaurar negócio · Transferir um atendente ao
negócio (substitui o atual) · Remover o atendente do negócio · Duplicar o
negócio · Adicionar um produto ao negócio · Remover um produto do negócio
(remove ou reduz quantidade) · Adicionar descontos, acréscimo, frete e cupom ·
**Remover negócio** (destrutivo)

### Leads
Criar lead (usa os parâmetros da sessão; não duplica se já existir) ·
**Deletar lead** (destrutivo) · Criar tags · Adicionar tags · Remover tags ·
Criar listas · Adicionar listas · Remover listas · Adicionar comentário no
lead · Transferir um atendente ao lead · Remover atendente do lead

### Mensagens
Iniciar o atendimento · Finalizar o atendimento · Adicionar sugestão de
resposta · Transferir atendente da conversa · Transferir departamento da
conversa · Desativar as automações de chat na conversa · Ativar as automações
de chat na conversa

> "Desativar automações de chat" é o freio para quando um humano assume a
> conversa — sem isso o bot continua respondendo por cima do atendente.

### Produtos
Criar produto

### Sistema
| Ação | Uso |
|---|---|
| Retornar resultado da tool | define o que a automação devolve ao agente de IA que a chamou via MCP |
| Enviar notificação | notifica usuários do CRM |
| Iniciar outra automação | chama outro fluxo passando parâmetros da sessão (par do gatilho "Iniciado por outra automação") |

### Atividades
Criar atividade — vinculada a um lead ou negócio (tipo `call`, `whatsapp`,
etc., com `startDate`/`endDate`, responsável e descrição)

## 3. Condições (`type: condition`)

Saídas: **"Todas as condições forem verdadeiras"** e **"Quando não atender a
nenhuma condição"**. Cada item de condição tem `id` e `nextBlockId`. Modo **por item**: cada item roteia para o próprio destino (condição simples, switch, ou OU com o mesmo destino). Modo **todas verdadeiras**: itens com `nextBlockId: null` e o bloco usa `trueNextBlockId`. Ver KB-01, seção 5.

### Negócios
Negócio possui atendentes · Negócio sem atendentes · Negócio está ganho ·
Negócio está perdido · Negócio está pendente · Negócio possui o produto ·
Negócio com ID externo existente · Procura se existe um negócio com um campo
adicional

### Leads
Lead existente · Lead possui negócio na pipeline · Lead possui negócio na
etapa · Lead com email existente · Lead com nome existente · Lead com telefone
existente · Lead com CPF existente · Verifica se o lead possui uma tag ·
Lead possuir atendente responsável · Procura se existe um lead com um campo
adicional

### Tempo
Verifica se a hora atual está em um intervalo de dia/hora (dias da semana +
faixa horária + timezone)

### Mensagens
Conversa possuir atendente responsável · Conversa finalizada · Automações de
chat estão habilitadas · Conversa em departamento · **Janela de conversa está
aberta** (última mensagem recebida dentro da janela configurada)

### Instagram
Seguidor do Instagram

### Campos
Campo com valor igual · Campo contém valor · Campo possui valor ·
Campo possui um valor entre dois valores (numérico)

> "Janela de conversa está aberta" é essencial em WhatsApp API Oficial: fora
> da janela de 24h só passa template.

## 4. Espera (`type: delay`)

### Tempo
Espera de alguns segundos · de alguns minutos · de algumas horas · de alguns
dias · **Espera de um intervalo de hora nos dias da semana** (só continua
dentro do horário comercial) · **Espera o dia/horário** (data e hora fixas)

### Mensagens
**Usuário parou de responder** — continua quando o usuário fica em silêncio
pelo tempo configurado (`timeInSeconds`). É o bloco certo para agrupar
mensagens picotadas antes de mandar para a IA.

## 5. Randomizador (`type: randomizer`)

Sem catálogo — você cria **ramificações** direto no nó. Começa com A/B/C a 33%
cada; use **Adicionar ramificação** e ajuste os percentuais. Cada ramificação
tem `{ id, name, perc, nextBlockId }`.

Usos: teste A/B de copy e **distribuição round-robin de leads** entre vendedores.

## 6. API (`type: api`)

| Item | O que faz |
|---|---|
| Requisição HTTP com comunicação via JSON | chamada REST comum (`url`, `method`, `headers[]`, `query[]`, `body`) |
| Requisição de arquivo HTTP | chamada cujo retorno é um arquivo |

O resultado vira fonte de dados pelo `datasourceName`; referencie depois com
`${[nome]campo|...}`. O `body` aceita interpolação de variáveis.

> A própria API pública do Datacrazy (`https://api.datacrazy.io/v1/crm/...`)
> é chamada assim quando não existe ação nativa — ex.: criar atividade com
> campos que o bloco de Ações não expõe. Guarde o token com cuidado.

## 7. Operações de campos (`type: field-operation`)

| Item | O que faz | Opções |
|---|---|---|
| Mapeamento de campo | lê/escreve um campo do sistema, campo adicional ou fonte de dados | `parameter`, `value` |
| Loop de array | itera sobre um array de dados | — |
| Análise de telefone | normaliza/valida número | — |
| Formatação de data | soma/subtrai e formata datas | `date`, `add`, `addType` (`days`/`minutes`/…), `timezone`, `datasourceName` |

Vários mapeamentos cabem no mesmo bloco ("Adicionar outra operação de campo"),
e cada um pode gerar sua própria fonte de dados.

## 8. IA (`type: ai`)

| Item | O que faz | Roteamento |
|---|---|---|
| Assistente de chat | responde como assistente com base na conversa | saída única (`lastAiText`) |
| Gere um texto com base na conversa | completion livre a partir de um prompt | saída única |
| Invocar Agente | chama um agente configurado para processar a conversa | saída única |
| Transcrição de áudio | transcreve áudios do chat | saída única |
| **Intenção de conversa** | classifica a intenção do usuário | **uma saída por intenção** + saída "nenhuma" |
| **Sentimento da conversa** | classifica o sentimento | uma saída por sentimento + saída "neutro" |
| Extrator de parâmetros | extrai campos estruturados da conversa | saída única, grava nos parâmetros |

Opções comuns: `model`, `prompt`, `messagesQtd` (quantas mensagens de contexto),
`considerAnnotations`, `onlyCurrentThread`, `messageMaxHours`, `datasourceName`.

Cada intenção tem `intention` (chave), `description` (quando acionar),
`example` (frases de exemplo) e `nextBlockId`. O nó mostra **Média Tokens**.

## 9. JavaScript (`type: javascript`)

Botão **Configurar JavaScript**. Executa código próprio sobre os dados da
sessão. Saídas: próximo passo + erro na execução. Use quando nenhuma operação
de campo resolve (parsing complexo, cálculo, montagem de payload).
