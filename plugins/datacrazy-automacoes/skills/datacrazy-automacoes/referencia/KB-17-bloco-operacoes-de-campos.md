# KB-17 — Bloco Operações de campos — `type: "field-operation"`

"Realize operações com campos do sistema, campos adicionais ou fontes de dados." É o bloco que **move dados**: copia do webhook para o lead, normaliza telefone, formata e soma datas e percorre listas. 281 blocos e 945 operações nos modelos. É o bloco com mais itens, porque todo integração começa mapeando campos.

Níveis ✅ 🟡 ⚠️ ⛔: ver KB-10. Os quatro itens são ✅.

---

## 1. Estrutura

```json
{
  "id": "uuid-v4",
  "type": "field-operation",
  "presentation": { "x": 457, "y": 0 },
  "sourceBlockId": null,
  "options": {
    "fieldOperations": [
      { "name": "parse-phone-field-operation", "group": "field", "stepId": "uuid-v4", "options": { "phone": "{telefone|[webhook-loja]customer.phone}", "defaultCountry": "BR", "datasourceName": "phone-1", "datasourceColor": "#6366f1" } },
      { "name": "set-field-operation", "group": "field", "stepId": "uuid-v4", "options": { "parameter": "leadName", "value": "{nome|[webhook-loja]customer.name}" } },
      { "name": "set-field-operation", "group": "field", "stepId": "uuid-v4", "options": { "parameter": "leadPhone", "value": "{phone|[phone-1]phone}" } }
    ],
    "nextBlockId": "uuid-do-proximo",
    "errorNextBlockId": ""
  }
}
```

- Item: `{ "name", "group": "field", "stepId", "options" }`. O editor gera `stepId` para cada operação (890 de 890 nos modelos).
- **Várias operações no mesmo bloco rodam em ordem**. Uma operação pode usar o resultado da anterior: Análise de telefone primeiro, Mapeamento depois (138 vezes juntos nos modelos). 43 blocos têm seis ou mais mapeamentos.
- **Saídas**: "Próximo passo" (`nextBlockId`) e **"Caso ocorrer erro na operação de campo"** (`errorNextBlockId`). O Loop de array tem, além disso, o **corpo** (seção 4).
- Botões do editor: "Adicionar mapeamento de campo" e "Adicionar outra operação de campo".

---

## 2. Mapa de decisão

| Preciso… | Operação |
|---|---|
| gravar um valor num campo do lead, do negócio, adicional ou da sessão | Mapeamento de campo |
| deixar o telefone no formato do CRM (55 + DDD + número) | Análise de telefone |
| formatar uma data, somar ou subtrair tempo, ou pegar a data de hoje | Formatação de data |
| repetir blocos para cada item de uma lista (produtos, parcelas, arquivos) | Loop de array |
| calcular, juntar listas, regras compostas | JavaScript (KB-19) |

---

## 3. Itens

### Mapeamento de campo — `set-field-operation` ✅

"Realiza operações de mapeamento de campos (do sistema, fonte de dados,...)." No canvas aparece como `{parameter} -> {value}`.

| Opção | Na interface | Formato | Como usar |
|---|---|---|---|
| `parameter` | "Campo de destino" | **caminho puro** | `leadName`, `leadPhone`, `leadEmail`, `leadTaxId`, `businessExternalId`, `additional-field[UTM Source]`. |
| `value` | "Valor que será atribuído ao campo" | **interpolado** ou literal | `{nome\|[webhook]customer.name}`, `"sent"`, `"1"`, combinações (`"{rua\|[w]rua}, {numero\|[w]numero}"`). |

**Destinos mais usados nos modelos**: `leadName` (56), `leadPhone` (48), `businessExternalId` (42), `leadEmail` (42), `leadTaxId` (33), `leadCity`, `leadZip`, `leadAddress`, `leadState`, `leadBlock`, `leadNumber`, `leadComplement`, `leadCompany`, `birthDate`, `leadSource`, e campos adicionais (UTMs, IDs externos, status, SLA).

**Usos**
- **Preparar a criação do lead**: mapeie Nome + Telefone/E-mail **antes** de "Lead existente" e "Criar lead" (KB-12).
- **Atualizar o lead que já existe**. O editor avisa: "*Campos mapeados antes desta etapa não serão atualizados no lead caso ele já exista com este contato.*" Para atualizar, repita o mapeamento **depois** da condição, no caminho "lead existe". Modelo oficial "Receptor de webhook": um mapeamento para criar e outro para atualizar.
- **Deduplicar pedidos**: grave `businessExternalId` logo depois de Criar negócio. Na próxima vez, "Negócio com ID externo existente" encontra o negócio (KB-13).
- **Guardar estado para decisões futuras**: `additional-field[Status envio] = "sent"`, `additional-field[SLA] = "1"`. Condições e o gatilho "Campo alterado" leem esses valores.
- **Limpar um campo**: `value: ""`.
- **Notas do lead** (campo "Notas" do lead, diferente dos comentários do histórico): `parameter: "leadNotes"` grava (medido em 24/10/2026). Para não apagar o que já havia, ponha a nota nova em cima das antigas, com uma linha em branco entre elas: `value` = `<nota nova>`, quebra de linha dupla, `{Notas do lead|leadNotes}` (no JSON: `"value": "<nota nova>\n\n{Notas do lead|leadNotes}"`).

**Cuidados**
- `parameter` **nunca** leva `{…|…}`; `value` quase sempre leva.
- Campo adicional precisa estar declarado em `data.additionalFields`, com o nome idêntico.
- Mapear para campo que não existe no lead ou negócio da sessão (ex.: `businessExternalId` sem negócio) cai na saída de erro.

### Análise de telefone — `parse-phone-field-operation` ✅

"Analisa um número de telefone": normaliza para o formato internacional que o CRM usa para achar e criar leads.

```json
{ "name": "parse-phone-field-operation", "group": "field", "stepId": "uuid-v4", "options": { "phone": "{celular|[get-customer]data.celular}", "defaultCountry": "BR", "datasourceName": "phone-1", "datasourceColor": "#6366f1" } }
```

| Opção | Na interface | Como usar |
|---|---|---|
| `phone` | Número de telefone | Variável com o telefone bruto: `(11) 99999-8888`, `11999998888`, `+55 11…`. |
| `defaultCountry` | "Código do país padrão": dois dígitos, ex. BR, US, PT | `"BR"` (27 de 27 nos modelos). Aplica o DDI quando o número vem sem ele. |
| `datasourceName` | "Fonte de dados com o resultado" (padrão `phone-N`) | `phone-1`, ou por tipo quando há mais de um: `phone-br_pf`, `phone-br_pj`. |

- **Saída**: `[phone-1]phone`, o telefone normalizado (54 leituras nos modelos, todas neste caminho).
- **Use sempre** que o telefone vier de fora (webhook, API, formulário, Entrada do usuário) e antes de:
  - "Lead com telefone existente";
  - Mapeamento `leadPhone = {phone|[phone-1]phone}`;
  - Mensagem com `contactId`.

### Formatação de data — `parse-date-field-operation` ✅

"Formatação e manipulação de data."

```json
{ "name": "parse-date-field-operation", "group": "field", "stepId": "uuid-v4", "options": { "date": "{paid_at|[webhook-loja]transaction.paid_at}", "add": "7", "addType": "days", "timezone": "America/Sao_Paulo", "datasourceName": "date-1", "datasourceColor": "#3b82f6" } }
```

| Opção | Na interface | Valores | Como usar |
|---|---|---|---|
| `date` | "Data": campos adicionais de data, ISO 8601, `YYYY-MM-DD` ou `DD/MM/YYYY`. "Deixe em branco para utilizar a data atual" | variável ou `""` | `""` = **agora** (7 de 9 nos modelos). |
| `add` | "Adicionar tempo a data" | **texto** numérico: `"0"`, `"7"`, `"-1"` | Soma (ou subtrai, com negativo) antes de formatar. |
| `addType` | unidade | `"days"` (padrão) · `"hours"` · `"minutes"` · `"seconds"` · `"months"` · `"years"` | `days` para vencimentos e lembretes; `hours` para prazos (modelo oficial Cal.com); `months` para renovação. |
| `timezone` | Fuso horário | `"America/Sao_Paulo"` | Sempre. Evita datas "um dia antes" por causa do UTC. |
| `datasourceName` | "Fonte de dados com o resultado" (padrão `date-N`) | `date-1`, `data-nota`, `date-start` | — |

**Saída**: objeto `formatted`, medido nos modelos.

| Caminho | Uso |
|---|---|
| `[date-1]formatted.dateTime` | Data e hora para gravar em campo ou mostrar (mais usado). |
| `[date-1]formatted.date` | Só a data (dd/mm/aaaa) em mensagens. |
| `[date-1]formatted.time` | Só a hora. |
| `[date-1]formatted.usDateTime` | Formato americano, para APIs e sistemas que exigem. |

Confira na inspeção da sessão (Operações → fonte `date-1`) os demais formatos disponíveis antes de depender deles.

**Usos**
- **Carimbar data**: `date: ""` → `additional-field[Data da compra] = {…|[date-1]formatted.dateTime}`.
- **Prazos**: vencimento = compra + 7 dias; lembrete = reunião − 1 dia → "Espera o dia/horário" (KB-14) ou `scheduledDate` da Mensagem (KB-11).
- **Mostrar data legível** na mensagem ("Seu pedido de {…|[date-1]formatted.date}").
- Para **diferença entre datas** (dias sem comprar) ou formato de agendamento com milissegundos, use **JavaScript** (KB-03).

---

## 4. Loop de array — `loop-array-field-operation` ✅

"Itera sobre um array de dados." Executa um **corpo** de blocos uma vez para cada item da lista e depois segue.

```json
{ "name": "loop-array-field-operation", "group": "field", "stepId": "uuid-v4", "options": { "parameter": "[get-pedido]data.itens", "datasourceName": "produtos", "datasourceColor": "#14b8a6", "nextBlockId": "uuid-primeiro-bloco-do-corpo" } }
```

| Opção | Na interface | Como usar |
|---|---|---|
| `parameter` | Parâmetro | **Caminho puro** do array: `[get-pedido]data.itens`, `[webhook-bling]compra.itens`, `[gatilho]resource.items.data`. |
| `datasourceName` | Fonte de dados (padrão `array-N`) | Nome do **item atual** dentro do corpo: `produtos` → `{sku\|[produtos]sku}`, `{quantidade\|[produtos]quantidade}`. |
| `nextBlockId` (da operação) | "Executar a cada item" | Primeiro bloco do **corpo**. |

- **Duas saídas diferentes**:
  - `fieldOperations[].options.nextBlockId` → **corpo**, roda uma vez por item.
  - `nextBlockId` do **bloco** → roda **depois** que todos os itens foram processados (fica vazio em 18 de 19 nos modelos, quando nada acontece depois).
- **O corpo termina sem ligação**: o último bloco do corpo fica com saída vazia, e o CRM volta para o próximo item.
- **Coloque o Loop sozinho** (ou por último) no bloco. Operações depois dele no mesmo bloco ficam confusas de ler.

**Usos nos modelos**
- **Itens de pedido** (11 automações): Loop → Ações [Criar produto + Adicionar produto ao negócio]. Depois, Descontos e frete.
- **Parcelas e transações**: link de boleto ou PIX de cada transação → Iniciar outra automação com parâmetros.
- **Arquivos**: lista de anexos → Requisição de arquivo → anexar ao lead.
- **Execução agendada**: lista de carrinhos ou propostas de uma API → uma ação por registro (se a ação cria ou altera lead/negócio, use o padrão do webhook abaixo).

**⛔ Nunca crie nem altere lead ou negócio dentro do loop** (confirmado em 23/10/2026, CDD 0 da prospecção Casa dos Dados)
- O lead criado no 1º item fica **preso na sessão**. Nos itens seguintes, "Criar lead", "Criar negócio" e o mapeamento de campos do lead (`leadName`, `leadPhone`, `additional-field[…]`) **não criam outro registro: atualizam o do 1º item**. Resultado: um lead só, sobrescrito a cada volta.
- Dentro do corpo, só o que não depende do lead da sessão: criar produto, adicionar produto ao negócio (que já existe antes do loop), varrer/buscar e chamar API.
- **Padrão certo — um registro por item:** automação A recebe o array → Loop → **API** (`POST` no webhook da automação B, com os campos do item no corpo) → **Espera de 1 s ou mais** (`seconds-delay`, controle de rate limit) → fim do corpo. A automação B tem gatilho webhook, recebe **um** item por execução e cria lead e negócio com sessão própria. URL do webhook de B: KB-08 (`…/flows/webhooks/<conta>/<automação>`), e B precisa estar **ativa**.
- Também serve com gatilho **agendado (cron)**: a automação busca numa API, recebe o array e repassa item a item para o webhook de B do mesmo jeito.
- Exceção: criar o lead **pela API** (`POST /api/v1/leads`) dentro do loop funciona, porque não usa a sessão — mas o caminho preferido é o webhook de B, que reaproveita os blocos nativos (dedup, mapeamento, negócio).

**Cuidados**
- Dentro do corpo, leia sempre do **item** (`[produtos]campo`), não da lista original.
- Não coloque mensagens para o lead dentro de loops grandes: uma mensagem por item vira spam. Junte com JavaScript e mande uma só.
- Resposta que já é lista na raiz: `parameter: "[get-arquivos]data"` (lista em `data`) ou `"[fonte]"` conforme o JSON. Confira na inspeção da sessão.

---

## 5. Padrões prontos

| Objetivo | Operações (em ordem) |
|---|---|
| Webhook de venda → lead | **Análise de telefone** → **Mapeamento**: `leadName`, `leadEmail`, `leadPhone = [phone-1]phone`, `leadTaxId`, endereço → (Condições de lead) → Criar lead → Criar negócio → **Mapeamento** `businessExternalId`. |
| UTMs de formulário | **Mapeamento** `additional-field[utm_source]`, `[utm_medium]`, `[utm_campaign]`, `[utm_content]`, `[utm_term]` → "Campo possui valor" para rotear campanhas. |
| Pedido com vários produtos | Criar negócio → **Loop** `[get-pedido]data.itens` → corpo: Criar produto + Adicionar produto. Depois do bloco: Descontos e frete. |
| Lembrete de agendamento | **Formatação de data** (`date` = data da reunião, `add: "-1"`, `addType: "days"`) → Mensagem agendada ou Espera o dia/horário. |
| Resposta do lead capturada pela IA | Extrator de parâmetros → **Mapeamento** `leadCompany = [AI-x]Empresa`, `leadTaxId = [AI-x]CNPJ`. |

## 6. Erros comuns

1. **`parameter` interpolado** ou `value` sem chaves quando vem de fonte de dados.
2. **Mapear antes de Criar lead esperando atualizar** um lead que já existe.
3. **Telefone bruto** direto em `leadPhone` ou em "Lead com telefone existente".
4. **`add` numérico** (`7`) em vez de texto (`"7"`).
5. **Ler `[date-1]iso`**: os modelos usam `formatted.dateTime`, `formatted.date`, `formatted.time` e `formatted.usDateTime`.
6. **Loop sem `nextBlockId` na operação** (sem corpo) ou corpo lendo da lista em vez do item.
7. **Campo adicional não declarado** em `data.additionalFields` ou com nome diferente.
8. **`group` diferente de `"field"`** ou item sem `stepId`.
