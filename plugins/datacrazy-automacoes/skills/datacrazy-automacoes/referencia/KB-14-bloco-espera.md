# KB-14 — Bloco Espera — `type: "delay"`

"Espera um determinado tempo para continuar a execução." Pausa a sessão do lead e retoma depois de um tempo, numa janela de horário, numa data ou quando o contato para de digitar. 112 blocos nos modelos.

Níveis ✅ 🟡 ⚠️ ⛔: ver KB-10.

---

## 1. Estrutura do bloco

```json
{
  "id": "uuid-v4",
  "type": "delay",
  "presentation": { "x": 914, "y": 0 },
  "sourceBlockId": null,
  "options": {
    "delay": { "name": "hours-delay", "options": { "hours": 3 } },
    "nextBlockId": "uuid-do-proximo",
    "refreshLeadDataOnResume": true
  }
}
```

- **Uma espera por bloco**, em `options.delay`: `{ "name", "options" }`, **sem** `group` e sem `stepId`.
- **Saída**: "Próximo passo" (`nextBlockId`). Só "Espera o dia/horário" tem uma segunda saída (seção 3). Não há saída de erro.

### `refreshLeadDataOnResume` — "Atualizar dados do lead ao continuar"

| Valor | Quando usar |
|---|---|
| `true` | Espera de **minutos, horas ou dias** seguida de algo que lê o lead: condição de tag ou etapa, mensagem com nome ou campo, IA. Nesse tempo um atendente pode ter mudado tag, etapa, campo ou responsável; sem atualizar, a sessão segue com a foto antiga. |
| `false` | Espera de **segundos** para ritmo ou processamento, sem leitura de dado do lead depois. |

Nos modelos, 95 esperas usam `false` e 9 usam `true`. A maioria são esperas curtas. Em cadências de follow-up, prefira `true`.

---

## 2. Mapa de decisão

| Preciso… | Espera | Nível |
|---|---|---|
| dar alguns segundos (processamento, ritmo) | Espera de alguns segundos | ✅ |
| esperar minutos (carrinho abandonado, SLA) | Espera de alguns minutos | ✅ |
| esperar horas (follow-up no mesmo dia) | Espera de algumas horas | ✅ |
| esperar dias (cadência D+1, D+3, D+7) | Espera de alguns dias | ✅ |
| só continuar dentro do horário comercial ou num horário do dia | Espera de um intervalo de hora nos dias da semana | ✅ |
| continuar numa data que vem de um dado (evento, vencimento) | Espera o dia/horário | 🟡 |
| esperar o contato **parar de mandar mensagens** | Usuário parou de responder | ✅ |

**Qual pausa usar**

| Mecanismo | Onde fica | Use para |
|---|---|---|
| **Atraso de tempo** (KB-11) | Etapa dentro da Mensagem | 2 a 5 s entre duas mensagens do mesmo bloco. |
| **Entrada do usuário** (KB-11) | Etapa dentro da Mensagem | Esperar **uma resposta**, com saída para quem não responde. |
| **Bloco Espera** | Bloco próprio | Todo o resto: tempo, janela, data e silêncio do contato. |
| **Mensagem com `scheduledDate`** (KB-11) | Configuração da Mensagem | O **envio** é agendado e o fluxo segue na hora. |

> **Follow-up do agente de IA fora do horário:** o follow-up automático do próprio agente (Agente de IA → Comportamentos → Follow-up) conta tempo corrido e manda de madrugada. Para segurar no horário comercial, desligue o follow-up do agente e faça a cadência por automação com **Espera de um intervalo de hora**; o passo a passo está no KB-18, seção 4.

---

## 3. Itens

### Espera de alguns segundos — `seconds-delay` ✅ · minutos — `minutes-delay` ✅ · horas — `hours-delay` ✅ · dias — `days-delay` ✅

| `name` | `options` (padrão do editor) | Valores mais usados nos modelos | Quando usar |
|---|---|---|---|
| `seconds-delay` | `{ "seconds": 5 }` | 5, 2, 10, 30 | Dar tempo a uma integração (webhook → consultar API), respiro antes de mover ou criar, ritmo entre blocos. |
| `minutes-delay` | `{ "minutes": 5 }` | 5, 10, 1 | Carrinho abandonado (10 min e verifica se pagou), SLA de primeiro atendimento (5 min e verifica se alguém assumiu). |
| `hours-delay` | `{ "hours": 5 }` | 3, 12 | Follow-up no mesmo dia, lembrete antes do fim do expediente. |
| `days-delay` | `{ "days": 1 }` | 1, 2, 5 | Cadência de reativação e onboarding (D+1, D+2, D+5), pós-venda. |

- Depois de esperas longas, **verifique antes de agir**: o lead respondeu (tag)? o negócio mudou de etapa? foi ganho? Nos modelos, 6 de 18 esperas de minutos vão para "Lead possui a tag" e 5 para "Campo possui valor".
- `days-delay` conta a partir do momento em que a sessão chega nele, e o envio pode cair de madrugada. Emende "Espera de um intervalo de hora" logo depois quando for mandar mensagem.

### Espera de um intervalo de hora nos dias da semana — `time-interval-delay` ✅

"Espera um intervalo de hora nos dias da semana selecionados para continuar a execução." O CRM sorteia **um horário aleatório entre o início e o fim** da janela.

```json
{ "delay": { "name": "time-interval-delay", "options": { "daysOfWeek": [1, 2, 3, 4, 5], "startTime": "1970-01-01T12:00:00.000Z", "endTime": "1970-01-01T12:30:00.000Z", "timezone": "America/Sao_Paulo" } }, "nextBlockId": "uuid-envio", "refreshLeadDataOnResume": true }
```

| Opção | Na interface | Valores |
|---|---|---|
| `daysOfWeek` | "Dias da semana que poderá continuar a execução" | 0 = domingo … 6 = sábado (padrão seg–sex). |
| `startTime` / `endTime` | "Intervalo de horas: entre … e" | Hora em **UTC** sobre `1970-01-01`. São Paulo: 09:00 = `T12:00`. |
| `timezone` | Fuso horário | `"America/Sao_Paulo"`. |

- **Janela estreita** (09:00–09:15 ou 09:00–09:30, como nos modelos): "mandar às 9h". Na prática, é um agendamento diário.
- **Janela larga** (09:00–18:00): "só em horário comercial", com os envios **espalhados** no dia. Isso ajuda a não disparar centenas de mensagens no mesmo minuto.
- **Use antes de**: Template do WhatsApp em reativação (4 de 7 nos modelos), mensagens depois de gatilhos de métrica do lead e esperas em dias.
- Para **desviar** quando está fora do horário, em vez de esperar, use a condição de tempo (KB-13).

### Espera o dia/horário — `until-date-delay` 🟡

"Espera um dia e horário para continuar a execução."

```json
{ "delay": { "name": "until-date-delay", "options": { "date": "{Data do evento|additional-field[Data do evento]}", "startTime": "1970-01-01T11:00:00.000Z", "endTime": "1970-01-01T12:00:00.000Z", "timezone": "America/Sao_Paulo", "invalidDateNextBlock": "uuid-data-invalida" } }, "nextBlockId": "uuid-no-dia", "refreshLeadDataOnResume": true }
```

| Opção | Na interface | Como usar |
|---|---|---|
| `date` | "Data para seguir a automação": campos adicionais de data, ISO 8601, `YYYY-MM-DD` ou `DD/MM/YYYY` | Variável com a data alvo. Para "um dia antes", calcule com Formatação de data (`add: "-1"`, KB-17) e use a saída. |
| `startTime` / `endTime` | "entre … e" (horário sorteado dentro) | Janela do dia em UTC `1970-01-01`. Se o fim for menor que o início, o CRM considera o fim no dia seguinte. |
| `timezone` | Fuso horário | `"America/Sao_Paulo"`. |
| `invalidDateNextBlock` | Saída **"Caso a data for vazia ou inválida"** | Ligue sempre: notificar, pedir a data ao lead ou seguir sem esperar. |

- **Use**: lembrete no dia da reunião ou aula, aviso de vencimento, parabéns no aniversário (data do ano corrente), renovação de contrato.

### Usuário parou de responder — `user-stop-chatting-delay` ✅

"Quando o usuário parar de responder": o fluxo só continua depois que o contato fica **X segundos sem mandar mensagem**.

```json
{ "delay": { "name": "user-stop-chatting-delay", "options": { "timeInSeconds": 10 } }, "nextBlockId": "uuid-ia", "refreshLeadDataOnResume": false }
```

- `timeInSeconds` (padrão 5). Nos modelos: 5, 8, 10, 15, 30, 60.
- **Use**: **juntar mensagens picotadas** ("oi" / "tudo bem?" / "queria saber o preço") antes de mandar para a IA ou avaliar a resposta. Nos modelos vem depois de uma Entrada do usuário (22×) e antes de Transcrição de áudio (8×), Extrator de parâmetros (5×) e Intenção.
- 8 a 15 s serve para texto. Para quem manda áudio, 15 a 30 s.
- **Não é** "o lead sumiu por horas": para isso, use o tempo de espera da Entrada do usuário (saída "caso o contato não responda").

---

## 4. Padrões

| Objetivo | Montagem |
|---|---|
| Carrinho abandonado | Gatilho "negócio criado/movido" para a etapa do carrinho → **Espera 15 min** → "**Negócio atual está na etapa** Carrinho abandonado?" → sim: toque de recuperação; não (pagou, foi removido): encerra. Repetir a conferência antes de cada toque (2h, 24h, 72h). Não use "Lead possui negócio na etapa": com dois carrinhos do mesmo lead ela acerta o negócio errado. |
| SLA de atendimento | Transfere → **Espera 5–10 min** (`refresh: true`) → "Conversa possui atendente?" → não: notificação ao gestor. |
| Cadência de reativação | Template → **Espera 1 dia** → **Janela 09:00–09:30** → "Lead possui a tag Respondeu?" → não: próximo template. |
| IA com mensagens agrupadas | Entrada do usuário → **Usuário parou de responder 10 s** → Transcrição de áudio + Intenção. |
| Lembrete de evento | Formatação de data (−1 dia) → **Espera o dia/horário** (08:00–09:00) → Mensagem. |

## 5. Erros comuns

1. **`group` no item de espera**: o item é só `{ "name", "options" }`.
2. **Horário local** em `startTime`/`endTime`: é UTC sobre `1970-01-01`.
3. **Espera longa com `refreshLeadDataOnResume: false`** seguida de condições sobre o lead.
4. **Dias de espera + mensagem direta**: pode chegar de madrugada; emende a janela de horário.
5. **"Espera o dia/horário" sem ligar "data vazia ou inválida"**: lead sem data fica parado.
6. **"Usuário parou de responder" para detectar abandono**: use o timeout da Entrada do usuário.
7. **Atraso dentro da Mensagem** para esperas de minutos ou horas, ou antes de Entrada do usuário.
