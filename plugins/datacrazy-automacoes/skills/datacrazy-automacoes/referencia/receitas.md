# Receitas de fluxo

Padrões montados a partir do catálogo real de blocos. Adapte etapas, tags e
conexões ao tenant antes de construir.

## 1. Agrupar mensagens picotadas antes da IA

O usuário manda 4 mensagens seguidas; você não quer 4 respostas.

```
Início: Mensagem recebida
  → Espera: Usuário parou de responder (8s)
  → IA: Intenção de conversa  (messagesQtd = 10)
      ├ intenção A → Mensagem de texto
      ├ intenção B → Ações: Transferir departamento da conversa
      └ nenhuma    → IA: Assistente de chat → Mensagem de texto {…|lastAiText}
```

`user-stop-chatting-delay` é o bloco que faz o debounce. Sem ele a IA responde
a cada fragmento.

## 2. Qualificação + criação de negócio

```
Início: Mensagem recebida (keywords: "orçamento", "preço")
  → Condições: Lead existente
      ├ verdadeiro → Condições: Lead possui negócio na pipeline
      │                 ├ sim  → Ações: Adicionar comentário no lead → fim
      │                 └ não  → Ações: Criar negócio (etapa "Novo")
      └ falso      → Mensagem: Entrada do usuário ("Qual seu nome?" → parameter nome)
                     → Ações: Criar lead
                     → Ações: Criar negócio
  → Ações: Adicionar tags ["veio-do-whatsapp"]
  → Ações: Transferir atendente da conversa
```

## 3. Distribuidor de leads (round-robin)

```
Início: Negócio criado (etapa "Entrada")
  → Randomizador
      ├ A 33% → Ações: Transferir um atendente ao negócio (vendedor 1)
      ├ B 33% → … (vendedor 2)
      └ C 33% → … (vendedor 3)
  → Ações: Enviar notificação
```

Marque `addSameAttendantToLead` para o lead herdar o mesmo responsável.

## 4. Follow-up com respeito ao horário comercial

```
Início: Negócio movido → etapa "Proposta enviada"
  → Espera: Espera de alguns dias (2)
  → Espera: Espera de um intervalo de hora nos dias da semana (seg-sex 09:00-18:00)
  → Condições: Negócio está pendente
      ├ verdadeiro → Mensagem de texto (follow-up)
      └ falso      → fim
```

Os dois blocos de espera em sequência resolvem "espere 2 dias, mas só continue
em horário comercial".

## 5. Carrinho abandonado via webhook da loja

```
Início: Requisição HTTP (Webhook)   [receiveJson → datasource "carrinho"]
  → Operações de campos: Mapeamento de campo (extrai ${[carrinho]customer.phone|…})
  → Condições: Lead com telefone existente
      ├ falso → Ações: Criar lead
      └ …
  → Espera: Espera de algumas horas (1)
  → Condições: Janela de conversa está aberta
      ├ verdadeiro → Mensagem de texto
      └ falso      → API: Requisição HTTP (dispara template oficial)
```

## 6. Tarefas automáticas de prospecção

Para criar atividades com todos os campos (tipo, responsável, datas), use
**API → Requisição HTTP JSON** contra `POST /api/crm/activities`, montando
`startDate`/`endDate` com **Operações de campos → Formatação de data**:

```
Operações de campos:
   parse-date  date=${[date-start-7]iso|…}  add=1  addType=days   → date-start-8
   parse-date  date=${[date-start-8]iso|…}  add=15 addType=minutes → date-end-8
API: POST /activities  body com ${[date-start-8]iso|…} e ${[date-end-8]iso|…}
```

Alternativa mais simples quando os campos bastam: **Ações → Atividades →
Criar atividade**.

## 7. Automação como tool de um agente de IA (MCP)

```
Início: MCP Server Tool
  → API / Condições / Operações de campos   (a lógica da tool)
  → Ações → Sistema: Retornar resultado da tool
```

O agente chama a automação, ela executa e devolve o resultado pelo bloco
"Retornar resultado da tool".

## 8. NPS pós-venda

```
Início: Negócio ganho
  → Espera: Espera de alguns dias (3)
  → Mensagem: Entrada do usuário ("De 0 a 10, …" → parameter nota,
               timeout 24h → timeoutNextBlockId)
  → Condições: Campo possui um valor entre dois valores (nota, 9, 10)
      ├ verdadeiro → Mensagem de texto (pedido de review) → Ações: Adicionar tags ["promotor"]
      └ falso      → Ações: Transferir departamento da conversa (CS)
                     → Ações: Enviar notificação
```

## Erros comuns

- **Não ligar a saída de erro** de Mensagem/API — a execução morre calada.
- **Esquecer de desativar as automações de chat** quando um humano assume:
  use `Ações → Mensagens → Desativar as automações de chat na conversa`.
- **Fixar a Conexão** em blocos de mensagem dentro de fluxos de atendimento:
  deixe em branco para herdar a conexão da conversa.
- **Usar IA para regra determinística** — Condições são mais baratas e exatas.
- **Fluxo sem condição de parada** em follow-ups: sempre cheque o estado do
  negócio antes de mandar a próxima mensagem.
- **Salvar sem querer**: o editor só publica quando você clica em `Salvar`.
