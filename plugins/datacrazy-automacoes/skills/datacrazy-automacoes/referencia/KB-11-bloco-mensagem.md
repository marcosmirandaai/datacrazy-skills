# KB-11 — Bloco Mensagem — `type: "chat"`

"Envie e receba mensagens." É o bloco que fala com o contato: WhatsApp (API Oficial ou não oficial), Instagram e Facebook. Um bloco guarda **uma sequência de etapas** (texto, pergunta, arquivo, atraso), executadas em ordem, e tem configurações que valem para todas: conexão, destinatário, agendamento e anotação.

Níveis ✅ 🟡 ⚠️ ⛔: ver KB-10.

---

## 1. Estrutura do bloco

```json
{
  "id": "uuid-v4",
  "type": "chat",
  "presentation": { "x": 457, "y": 0 },
  "sourceBlockId": null,
  "options": {
    "messages": [
      { "name": "send-text-message", "group": "messages", "stepId": "uuid-v4", "options": { "text": "Oi, {Primeiro nome do lead|leadFirstName}!", "buttons": [], "breakMessages": false, "breakMessagesIntervalInSeconds": 2 } }
    ],
    "platform": "",
    "provider": "",
    "instanceId": "",
    "contactId": "",
    "timezone": "",
    "scheduledDate": "",
    "isAnnotation": false,
    "nextBlockId": "",
    "errorNextBlockId": ""
  }
}
```

- Cada etapa: `{ "name", "group", "stepId", "options" }`, com `stepId` UUID v4 próprio.
- **Saídas**:
  - **"Próximo passo"** (`nextBlockId`): depois da última etapa. Se houver uma Entrada do usuário, é quem **respondeu**.
  - **"Caso ocorrer erro no envio da mensagem"** (`errorNextBlockId`): falha no envio (conexão caída, número inválido, janela fechada na API Oficial).
  - **Um caminho por botão** (`buttons[].nextBlockId`) e **"Caso o contato não responda"** (`timeoutNextBlockId` da Entrada do usuário).

---

## 2. Configurações do bloco

### Conexão — `instanceId`, `platform`, `provider`

Na interface: **"Conexão"**, com a ajuda "Deixe em branco para usar a conexão dos blocos anteriores."

| Situação | O que fazer |
|---|---|
| Gatilho de mensagem, atendimento ou departamento; subfluxo chamado por um fluxo de conversa | `instanceId: ""`, `platform: ""`, `provider: ""`. **Herda** a conversa. |
| Gatilho de negócio, tag, campo, webhook, agendado, execução manual | Fixe a conexão: `instanceId` = ObjectId (Pendência), `platform` e `provider` preenchidos. Ou traga uma conversa com a condição "Lead possui conversa em aberto" (KB-13). |
| Bloco de Mensagem que é o **único** da automação | O CRM exige conexão: "o campo vazio só funciona para herdar a conexão de blocos anteriores". |
| Enviar por um número diferente do da conversa (avisar o time por outro chip) | Fixe a conexão desse número. |

- `platform`: `"WHATSAPP"`, `"INSTAGRAM"` ou `""`.
- `provider`: `"UAZAPI"`, `"Z_API"`, `"EVOLUTION_API"` (não oficiais), `"WHATSAPP_CLOUD_API"` (API Oficial), `"INSTAGRAM_API"`, `"MESSENGER_API"`, ou `""`.
- Nos modelos: 154 blocos com conexão fixa e 118 herdando.
- O **provider muda o catálogo** de etapas:
  - Template do WhatsApp só aparece com `WHATSAPP_CLOUD_API`.
  - Resposta de comentário do Instagram só com `INSTAGRAM_API`.
  - Resposta de comentário do Facebook só com `MESSENGER_API`.
- Para trocar a conexão do fluxo inteiro, a interface tem "Substituir essa conexão em todos os blocos".

### Configurações das mensagens (engrenagem do bloco)

| Opção | Na interface | Valores | Quando usar |
|---|---|---|---|
| `contactId` | "Informe o ID do contato para envio direto da mensagem." — "o contato será ignorado e a mensagem será enviada diretamente para o contato informado." | `""` · telefone (`"5511999998888"`) · ID de grupo do WhatsApp (`"1203634…"`) · variável | **Avisar alguém que não é o lead**: grupo do time de CS, vendedor, gestor. Nos modelos: resumo do lead qualificado para o grupo comercial; "Alerta de ERRO no CRM" para o telefone do responsável. O título do bloco vira "Mensagem para {contactId}". Exige conexão fixa. |
| `scheduledDate` | "Data e hora para enviar a mensagem com agendamento" — aceita campos adicionais de data, ISO 8601, `YYYY-MM-DD` ou `DD/MM/YYYY` | `""` · data · variável | **Lembretes em data marcada**: reunião, vencimento de boleto, aniversário. O fluxo segue na hora; a mensagem sai na data. Título: "Mensagem agendada". Monte a data com Formatação de data (KB-17). |
| `timezone` | Fuso usado com o agendamento | `""` · `"America/Sao_Paulo"` | Preencha junto com `scheduledDate`. |
| `isAnnotation` | "Enviar como anotação" — "Será enviada as mensagens como anotações internas. Não será enviado para o contato." | `false` · `true` | **Nota interna na conversa** para o atendente: ficha do lead ao transferir ("*Novo Cliente para atendimento* – Empresa, CNPJ, interesse"), dados do anúncio de origem, resumo da IA. 52 blocos nos modelos. Título: "Anotação". |

**Anotação × comentário no lead × notificação**
- **Anotação**: aparece **dentro da conversa**, onde o atendente trabalha.
- **Adicionar comentário no lead** (KB-12): fica **no cadastro do lead**.
- **Enviar notificação** (KB-12): alerta no sino dos **usuários do CRM**.
- **Mensagem com `contactId`**: vai para um **WhatsApp** (grupo ou pessoa).

Escolha pelo lugar onde a pessoa vai ver.

---

## 3. Mapa de decisão das etapas

| Preciso… | Etapa | Nível |
|---|---|---|
| mandar texto, com ou sem botões | Mensagem de texto | ✅ |
| fazer uma pergunta e esperar a resposta | Mensagem de texto + Entrada do usuário | ✅ |
| dar uma pausa curta entre duas mensagens do mesmo bloco | Atraso de tempo | ✅ |
| mandar um arquivo cujo link vem de um dado (boleto, NF, PDF gerado) | Arquivo URL Dinâmica | ✅ |
| mandar sempre o mesmo arquivo (catálogo, apresentação) | Arquivo anexo | ✅ (upload ⚠️) |
| mandar um áudio gravado | Mensagem de áudio | ⚠️ |
| falar com o contato fora da janela de 24 h na API Oficial | Template do WhatsApp | ✅ (template aprovado) |
| responder publicamente um comentário | Resposta do Comentário do Instagram / Facebook | 🟡 |

---

## 4. Etapas

### Mensagem de texto — `send-text-message` ✅

A etapa mais usada: 257 nos modelos.

```json
{ "name": "send-text-message", "group": "messages", "stepId": "uuid-v4", "options": { "text": "{Primeiro nome do lead|leadFirstName}, com qual área você quer falar?", "buttons": [ { "id": "uuid-v4", "text": "Financeiro", "type": "button", "nextBlockId": "uuid-financeiro" }, { "id": "uuid-v4", "text": "Comercial", "type": "button", "nextBlockId": "uuid-comercial" } ], "breakMessages": false, "breakMessagesIntervalInSeconds": 2 } }
```

| Opção | Na interface | Valores | Quando usar |
|---|---|---|---|
| `text` | Texto (aceita variáveis, emojis e `*negrito*`) | texto | Sempre. Personalize com `{Primeiro nome do lead\|leadFirstName}`. |
| `buttons[]` | "Adicionar botão" | lista (`[]`) | Menus de escolha. Cada botão tem o próprio caminho. |
| `breakMessages` | "Quebrar mensagens?" — "as mensagens serão enviadas a cada quebra de linha ou pontuação final" | `false` · `true` | `true` para parecer digitação humana num texto longo. 2 de 257 nos modelos. |
| `breakMessagesIntervalInSeconds` | "Intervalo entre as mensagens" | segundos (`2`) | Com `breakMessages`: 2 a 3 s. |

**Botões**: `{ "id", "text", "type", "nextBlockId" }`, e mais `url` no tipo link.

| `type` | Na interface | Comportamento | Quando usar |
|---|---|---|---|
| `"button"` | Botão (Resposta rápida) | O contato toca e o fluxo segue pelo `nextBlockId` do botão. | Menus e confirmações ("Sim" / "Ainda não", "Voltar ao menu", "Encerrar conversa"). |
| `"link"` | Link (Abrir site) | O WhatsApp não aceita botão de link direto: o contato **recebe uma mensagem com um link encurtado** no domínio datacrazy.io, rastreado. | Levar a checkout, agenda ou página, com rastreio de clique. |

- Texto do botão: **no máximo 20 caracteres**.
- Os botões mais comuns nos modelos: "Voltar ao Menu" (19), "Encerrar conversa" (13), "Financeiro" e "Comercial".
- Botão sem `nextBlockId` não leva a lugar nenhum. Ligue todos.
- Quem **digita** em vez de tocar segue pelo "Próximo passo" do bloco. Por isso, menu com botões costuma ter uma **Entrada do usuário** logo depois e uma IA de Intenção para interpretar o texto digitado.

### Entrada do usuário — `text-input-message` ✅

"Resposta do usuário": pausa o fluxo até o contato responder ou até o tempo acabar.

**Padrão obrigatório para perguntar algo ao lead**: pergunta numa Mensagem de texto e, **no mesmo bloco**, Entrada do usuário **sem campo do CRM** e com texto vazio.

```json
{ "name": "text-input-message", "group": "messages", "stepId": "uuid-v4", "options": { "text": "", "acceptMediaUrl": true, "timeoutWaitType": "minutes", "timeoutInSeconds": 3600, "timeoutNextBlockId": "uuid-nao-respondeu", "invalidResponseMessage": "Poderia repetir, por favor?" } }
```

| Opção | Na interface | Valores (padrão) | Como usar |
|---|---|---|---|
| `text` | "Pergunta (opcional)" | `""` | **Deixe vazio.** A pergunta vai na Mensagem de texto antes (76 de 76 nos modelos). |
| `parameter` | "Campo da resposta" | caminho de campo | **Não selecione** (regra da consultoria). A Entrada só separa quem respondeu de quem não respondeu. Para aproveitar o conteúdo, use IA depois (Intenção ou Extrator, KB-18). O CRM permite gravar num campo, e alguns modelos antigos fazem isso, mas não gere assim. |
| `timeoutInSeconds` | "Tempo de espera" | **sempre em segundos** (`3600`) · máximo 30 dias | Pergunta de qualificação: 30 a 60 min. Confirmação de agendamento: 24 h. Cadência de follow-up: 1 a 7 dias. |
| `timeoutWaitType` | unidade exibida | `"seconds"` · `"minutes"` (padrão) · `"hours"` | Só muda a exibição: 1 h = `"minutes"` + `3600`. |
| `timeoutNextBlockId` | Saída **"Caso o contato não responda"** | UUID | **Sempre ligue**: lembrete, follow-up, encerrar ou mover para "Parou de responder". |
| `invalidResponseMessage` | "Mensagem caso a resposta seja inválida" | `"Poderia repetir, por favor?"` | Mantenha o padrão. |
| `acceptMediaUrl` | "Salvar URL de mídias no campo" | `true` | `true`: áudio, imagem ou arquivo contam como resposta. |

- **Respondeu** → `nextBlockId` do **bloco**. **Não respondeu** → `timeoutNextBlockId` da **etapa**.
- ⚠️ O editor avisa: "**Atraso antes de aguardar resposta pode causar perda de mensagens**". Se o contato responder durante um Atraso de tempo colocado antes da Entrada, a resposta não é capturada. Não coloque atraso entre a pergunta e a Entrada.
- **Depois da Entrada**, nos modelos: Mensagem de texto (80), "Usuário parou de responder" (22, para juntar mensagens picotadas), Adicionar tags (22), Intenção de conversa (17).

### Atraso de tempo — `delay-message` ✅ (`group: "time"`)

"Atraso de {seconds} segundos" **dentro** do bloco de Mensagem, entre etapas.

```json
{ "name": "delay-message", "group": "time", "stepId": "uuid-v4", "options": { "seconds": 3 } }
```

- `seconds`: 0 a 2.592.000 (30 dias).
- **Use para**: simular digitação entre duas mensagens seguidas (2 a 5 s).
- **Não use** para esperas longas nem antes de uma Entrada do usuário. Para isso existe o bloco Espera (KB-14), que tem opção de atualizar os dados do lead e mostra o tempo no canvas.

### Arquivo URL Dinâmica — `send-url-file-message` ✅

"URL do arquivo" vinda de uma variável.

```json
{ "name": "send-url-file-message", "group": "messages", "stepId": "uuid-v4", "options": { "url": "{linkPDF|[get-nota]data.linkPDF}", "clearUrl": false } }
```

| Opção | Na interface | Quando usar |
|---|---|---|
| `url` | "URL do arquivo" (variável; o editor avisa se a URL é inválida) | Boleto, nota fiscal, PDF de proposta gerado por API, imagem do anúncio de origem (`[Message-1]referral.thumbnail_url`). |
| `clearUrl` | "Limpar URL do arquivo" — "Remove os parâmetros de query da URL, utilizando somente o arquivo." | `true` quando a URL vem com `?token=…&expires=…` e o provedor rejeita o nome do arquivo. Mantenha `false` se a URL assinada precisa dos parâmetros para abrir. |

É a opção **que um LLM consegue gerar** para arquivos: basta um link público ou vindo de fonte de dados.

### Arquivo anexo — `send-file-message` ✅ (upload ⚠️)

Arquivo enviado pela interface ao CDN do Datacrazy.

```jsonc
{ "name": "send-file-message", "group": "messages", "stepId": "uuid-v4", "options": {
  "url": "https://g1cdn1.datacrazy.io/…/flow-attachments/…",  // só existe depois do upload na interface
  "filename": "catalogo.pdf", "mimeType": "application/pdf", "size": 2499451, "text": "", "platforms": []
} }
```

- `platforms`: o CRM gera uma versão do arquivo para cada plataforma (WhatsApp, Instagram, Messenger) quando precisa converter.
- API Oficial: **limite aproximado de 16 MB**; o editor avisa acima disso.
- Formatos incompatíveis são convertidos, o que pode demorar.
- **Para o LLM**: não gere `send-file-message`. Use Arquivo URL Dinâmica com um link, ou deixe uma Mensagem de texto marcadora "[anexar catálogo aqui]" com a Pendência "trocar por Arquivo anexo e fazer upload".

### Mensagem de áudio — `send-audio-message` ⚠️

Áudio **gravado no editor** ("Iniciar gravação"). `options`: `{ "audios": [ { "url": "…" } ] }`. Não dá para gerar por JSON. Use uma Mensagem de texto marcadora e a Pendência "gravar o áudio".

### Template do WhatsApp — `whatsapp-send-template-message` ✅ (`group: "whatsapp-cloud"`)

Único jeito de iniciar ou retomar conversa **fora da janela de 24 h** na API Oficial. 25 usos nos modelos: confirmação de pedido, pagamento recusado, rastreio, avaliação, reativação.

```jsonc
{ "name": "whatsapp-send-template-message", "group": "whatsapp-cloud", "stepId": "uuid-v4", "options": {
  "template": {
    "id": "pedido_criado#pt_BR", "name": "pedido_criado", "language": "pt_BR", "status": "APPROVED",
    "body": { "text": "Obaaa {{1}}, o seu pedido nº {{2}} foi criado!", "parameters": [
      { "name": "1", "type": "text", "value": "{Primeiro nome do lead|leadFirstName}", "example": "Ana", "parameter_name": "" },
      { "name": "2", "type": "text", "value": "{numero|[webhook-loja]numero}", "example": "65879", "parameter_name": "" } ] },
    "footer": { "text": "Essa é uma mensagem automática" },
    "buttons": [ { "type": "QUICK_REPLY", "text": "Falar com atendente", "parameters": [] } ]
  },
  "buttons": [ { "id": "uuid-v4", "text": "Falar com atendente", "type": "button", "nextBlockId": "uuid-atendimento" } ]
} }
```

- **Regra do editor**: "O Template do WhatsApp só pode ser a **única etapa** deste bloco." Não misture com texto, arquivo ou atraso. **Exceção medida em automações reais (set/2026):** Template seguido de **Entrada do usuário** no mesmo bloco, para esperar a resposta do cliente ("respondeu" / "não respondeu").
- Exige `provider: "WHATSAPP_CLOUD_API"`, conexão fixa quando não há conversa e template **aprovado** na Meta (`status: "APPROVED"`). Nos modelos: 19 aprovados, 5 pendentes, 1 rejeitado. Template pendente ou rejeitado não envia.
- `body.parameters[].value` preenche as variáveis `{{1}}` ou `{{nome}}` do template, com variáveis do CRM.
- Botões `QUICK_REPLY` do template roteiam pelos `buttons[]` do item. Botões `URL` só abrem o link.
- **Para o LLM**: gere só se o usuário informar nome, idioma, texto e variáveis do template aprovado. Sem isso, use Mensagem de texto marcadora + Pendência "trocar pelo template aprovado".
- **Template ainda não existe?** Dá para criá-lo pelo CRM, sem abrir o Gerenciador da Meta: `POST /api/v1/messaging/whatsapp-cloud/templates/{instanceId}` com a chave de API, corpo da tela *Novo modelo › JSON* (`type` em minúsculas). Só por script e sob pedido do usuário; acompanhe o `status` pelo GET até `APPROVED`. Corpo, regras da Meta e pegadinhas no KB-08 §5.2.1.
- Antes do template, verifique a janela com a condição **"Janela de conversa está aberta"** (KB-13). Aberta: Mensagem de texto grátis. Fechada: template.

### Resposta do Comentário do Instagram — `send-comment-instagram` 🟡 · do Facebook — `send-comment-facebook` 🟡

Responde o comentário que disparou o fluxo (gatilho de comentário, KB-10). Beta, contas parceiras.

```json
{ "name": "send-comment-instagram", "group": "instagram", "stepId": "uuid-v4", "options": { "text": "Te chamei no direct! 📩", "privateReply": false } }
```

| Opção | Na interface | Quando usar |
|---|---|---|
| `text` | Texto da resposta | Curto. Varie com Randomizador para não parecer robô. |
| `privateReply` | "Resposta Privada" | `false`: resposta **pública** abaixo do comentário. `true`: resposta privada ("Resposta do comentário privada"), que abre a conversa no direct. |

Padrão oficial: comentário → Randomizador (3 respostas públicas) → Mensagem de texto no direct.

---

## 5. Combinações que funcionam

| Objetivo | Sequência no mesmo bloco ou em blocos seguidos |
|---|---|
| Pergunta com saída para quem não responde | Mensagem de texto → Entrada do usuário (sem campo). Respondeu: próximo passo. Não respondeu: follow-up. |
| Menu com botões + texto livre | Mensagem com botões → Entrada do usuário → (próximo passo) Intenção de conversa com as mesmas opções dos botões. |
| Juntar mensagens picotadas antes da IA | Entrada do usuário → Espera "Usuário parou de responder" 8 a 15 s → IA. |
| Transferir para humano com contexto | Ações de transferência → Mensagem com `isAnnotation: true` com a ficha → Mensagem ao lead "Estou te transferindo". |
| Avisar o time por WhatsApp | Mensagem com `contactId` = grupo, conexão fixa. |
| Lembrete de reunião | Formatação de data → Mensagem com `scheduledDate` = data formatada e `timezone`. |
| Reativar lead na API Oficial | Condição "Janela de conversa está aberta" → aberta: texto · fechada: Template. |

---

## 6. Erros comuns

1. **Entrada do usuário sem `timeoutNextBlockId`**: quem não responde fica parado na sessão para sempre.
2. **Pergunta dentro da Entrada** (`text` preenchido) ou **campo do CRM selecionado**: fora do padrão da consultoria.
3. **Atraso de tempo antes da Entrada**: perde a resposta de quem responde rápido.
4. **Conexão vazia** em fluxo sem conversa de origem.
5. **Template junto com outras etapas** no mesmo bloco, ou template sem aprovação.
6. **Botão com mais de 20 caracteres** ou sem destino.
7. **`errorNextBlockId` vazio** em disparo ativo (webhook, agendado, manual): falhas de envio passam em silêncio. Ligue a uma notificação ou a uma tag "Falha no envio".
8. **Arquivo anexo gerado pelo LLM** com URL inventada: o upload só existe pela interface.
