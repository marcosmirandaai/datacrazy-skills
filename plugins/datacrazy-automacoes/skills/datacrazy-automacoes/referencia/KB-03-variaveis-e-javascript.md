# KB-03 — Variáveis, Fontes de Dados e JavaScript

## 1. Interpolação

Dentro de textos e valores, variáveis são escritas assim:

```
{Rótulo legível|caminho}
${rotulo|caminho}
```

O CRM usa o **caminho**, que vem depois da barra vertical. O rótulo é só o que a interface mostra. As duas formas funcionam em automações reais; prefira `{Rótulo|caminho}`, que é o que o seletor de variáveis insere.

```
{Primeiro nome do lead|leadFirstName}
{email|[Api-request-1]data.email}
{Nome vendedora|additional-field[Nome vendedora]}
{Último resultado da IA|lastAiText}
```

É possível concatenar variáveis no mesmo valor: `"{Nome do lead|leadName} - {id|[Api-request-1]order.id}"`.

## 2. Caminho puro × interpolação

Esta é a regra que mais quebra fluxos gerados. Alguns campos esperam o **caminho puro** (sem chaves, sem barra vertical); outros esperam o valor **interpolado**.

**Caminho puro** — só o caminho:

- `parameter` das condições de campo: `field-is-equal-condition`, `field-contains-condition`, `field-has-value-condition`, `between-condition`, `field-matches-n-text-values`
- `parameter` do Mapeamento de campo (`set-field-operation`): é o **destino**
- `parameter` do gatilho Campo alterado (`field-changed-trigger`): o campo monitorado
- `parameter` da Entrada do usuário (`text-input-message`), quando existir. Pela regra de pergunta ao lead, deixe **sem campo** (KB-11)
- `parameter` do Loop de array (`loop-array-field-operation`): o array a percorrer

```
"parameter": "[Api-request-1]event"
"parameter": "additional-field[Faturamento Mensal]"
"parameter": "leadEmail"
"parameter": "[get-pedido]data.itens"
```

**Interpolado** — com `{Rótulo|caminho}`:

- `text`, `comment`, `notification`, `url`, `body`, `headers[].value`, `query[].value`
- `value` do Mapeamento de campo (a **origem**)
- `phone`, `email`, `name`, `taxId`, `externalId` das condições de lead e negócio
- `date` e `phone` das operações de data e telefone
- `price`, `quantity`, `productSku`, `sku`, `coupon`, `shipping` e `discount` de produtos e negócios
- `value` de `start-another-automation-action.parameters` e de `business-with-additional-field-exists-condition`

```
"value": "{nome|[Api-request-1]customer.name}"
"phone": "{telefone|[phone-1]phone}"
```

`equalsTo` e `contains` aceitam texto literal (`"approved"`) ou interpolação.

## 3. Campos do sistema

Caminhos disponíveis. Alguns dependem do contexto do fluxo (só existe `businessId` se houver negócio na sessão; só existe `threadCode` se houver conversa).

- **IDs**: `leadId`, `businessId`, `stageId`, `instanceId`, `attendantId`, `productId`, `conversationId`, `threadId`
- **Lead**: `leadName`, `leadFirstName`, `leadEmail`, `leadPhone`, `leadCompany` (no seletor: "Empresa do lead (legado)", desde out/2026, quando o lead passou a ser do tipo Pessoa ou Empresa), `leadCity`, `leadState`, `leadZip`, `leadAddress`, `leadNumber`, `leadComplement`, `leadBlock`, `leadSite`, `leadTaxId` (CPF ou CNPJ), `leadSource`, `leadSourceId`, `leadSourceUrl`, `leadCtwaId`, `leadNotes`, `birthDate`
- **Negócio**: `businessTotal`, `businessCode`, `businessExternalId`, `JSONbusinessProduct`
- **Produto**: `productName`, `productSku`, `productPrice`
- **Atendentes**: `leadAttendant`, `businessAttendant`, `ticketAttendant`
- **Conta**: `currentDate`, `companyName`, `companyEmail`
- **Conversa**: `threadData`, `chatAttendant`, `department`, `threadCode`
- **Instagram**: `instagramCommentId`, `instagramMediaId`, `instagramCommentDate`, `instagramName`
- **Facebook**: `facebookCommentId`, `facebookMediaId`, `facebookCommentDate`, `facebookName`
- **IA**: `lastAiText` (última resposta da IA), `aiConsumedTokens`
- **Erros**: `lastErrorMessage`, `lastErrorCode` — use na notificação da saída de erro
- **Outros**: `additionalFields`, `datasourceJsonPath`

Para criar um lead, a sessão precisa ter pelo menos **Nome + Telefone** ou **Nome + E-mail** mapeados antes do `create-lead-action`.

## 4. Campos adicionais

```
additional-field[Nome exato do campo]
```

- O nome é o que aparece no CRM, com acentos, espaços e maiúsculas iguais.
- Todo campo usado precisa estar declarado em `data.additionalFields` com esse `name` (KB-01, seção 3).
- Em interpolação: `{UTM Source|additional-field[UTM Source]}`.
- Como destino: `"parameter": "additional-field[UTM Source]"`.
- No JavaScript: `await session.getAdditionalValue("UTM Source")`.

### 4.1 De onde vem o campo (medido em 08/10/2026)

A mesma sintaxe `additional-field[Nome]` serve para quatro origens. No seletor de variáveis do editor, cada uma é uma categoria:

| Categoria no seletor | O que é | `entity` |
|---|---|---|
| Adicionais do lead pessoa | Campos de leads do tipo Pessoa | `lead` |
| Adicionais do lead empresa | Campos de leads do tipo Empresa | `lead_company` |
| Adicionais do negócio | Campos do negócio | `business` |
| **Parâmetros do sistema** | Valores da conta, iguais para todo lead: tokens, URLs, IDs de integração. É o antigo "campo adicional da empresa" | `company` |

- **Parâmetro do sistema** se lê e se grava como campo adicional: `{access_token|additional-field[access_token]}`, `"parameter": "additional-field[access_token]"` e `session.getAdditionalValue("access_token")`. O Mapeamento de campo aceita parâmetro como destino, então um fluxo pode renovar e guardar um token. No JavaScript, `session.setAdditionalValue("nome", valor)` também grava num parâmetro Texto (medido: cache de status gravado pelo fluxo em produção, KB-04, seção 14).
- Um campo de Lead Pessoa marcado "Mostrar também em Lead Empresa" vale para os dois tipos de lead.
- Use nomes que não se repitam entre lead, negócio e parâmetros: a variável leva só o nome.

### 4.2 Parâmetro do tipo Secreto (medido em 08/10/2026)

Para token, chave e senha, crie o parâmetro com o tipo **Secreto** (Configurações › Parâmetros do sistema):

- O JavaScript lê o valor real com `session.getAdditionalValue("nome")`. A interpolação `{nome|additional-field[nome]}` também resolve, em cabeçalho, URL ou corpo.
- O valor **não entra na sessão**: a inspeção da execução e o `parameters.additionalFields` do MCP não o mostram. Um parâmetro Texto lido no fluxo aparece lá com o valor real.
- Na tela, o valor fica mascarado e não volta ao editar. Para trocar, digite o novo; em branco, mantém o atual.
- ⚠️ Não copie o segredo para um campo ou parâmetro Texto: a cópia aparece em claro na sessão.

## 5. Fontes de dados (datasources)

Blocos que produzem dados publicam o resultado com um `datasourceName`. Blocos seguintes leem com `[nome]caminho`.

### Quem cria e como ler

- **Gatilho Webhook** (`json-http-request-trigger`), padrão `Api-request-1` → `[Api-request-1]campo`
- **Gatilho Iniciado por outra automação**, padrão `Api-request-1` → os parâmetros recebidos (5.4)
- **Gatilho Mensagem recebida** com `receiveJson: true`, ex. `Message-1` → `[Message-1]from`, `[Message-1]referral.ctwa_clid`, `[Message-1]messageData.attachments[0].url`
- **Bloco API** → `[get-pedido]data.id`
- **Análise de telefone**, ex. `phone-1` → `[phone-1]phone`
- **Formatação de data**, ex. `date-1` → `[date-1]formatted.dateTime`, `formatted.date`, `formatted.time`, `formatted.usDateTime` (medido nos modelos; `iso` não aparece)
- **Loop de array**, nome do item → `[produtos]codigo` dentro do corpo
- **Extrator de parâmetros (IA)**, ex. `AI-extrator-1` → `[AI-extrator-1]nome_do_parametro`
- **Assistente de chat** e **Gere um texto (IA)**, ex. `AI-1` → `[AI-1]text` (ou `{Último resultado da IA|lastAiText}`)
- **Invocar Agente (IA)**, ex. `Agent-1` → `[Agent-1]…`
- **Requisição de arquivo HTTP** → `[fonte]url` e `[fonte]size`
- **MCP Server Tool** → `[fonte]nome_do_parametro` recebido do agente
- **Formulário do Facebook** → respostas do formulário na fonte do gatilho
- **JavaScript**, ex. `Javascript-1` → `[Javascript-1]dados.valor`

### Navegação

```
[fonte]campo                      campo na raiz
[fonte]a.b.c                      objeto aninhado
[fonte]lista[0].campo             item de uma lista
[fonte][0].campo                  resposta que é uma lista na raiz
```

Exemplo real de lista na raiz: `[get-carts_id][0].Cart.customer_id`. **Nunca** escreva `[fonte]0.campo`.

### Objetos e listas inteiros — `${[fonte]caminho}`

Medido em 02/10/2026 no "Retornar resultado da tool" (KB-12).

- O caminho depois de `[fonte]` é avaliado com a biblioteca `jsonpath` (dchester).
- O CRM pega só o **1º resultado** do caminho.
- Quando o caminho aponta para um objeto ou uma lista, o valor entra como **JSON**. Escreva sem aspas em volta: `"produto":${[get-produto][0]}`.

| Escrita | Resultado |
|---|---|
| `${[fonte]campo}` | ✅ O campo. Objeto ou lista sai como JSON. |
| `${[fonte][0]}` | ✅ 1º item de uma lista na raiz, como objeto JSON. |
| `${[fonte][*]}` | ⚠️ Resolve, mas traz só o **primeiro** item. |
| `${[fonte]}` (sem caminho) | **Quebra** a execução: "Parameter service for parameter [fonte] was not implemented". |
| `${[fonte][0]^}` | **Quebra**: "Lexical error". A biblioteca não tem operador de pai. |

**Lista na raiz** (ex.: Supabase/PostgREST): não há caminho nativo que devolva a lista inteira. Coloque um JavaScript mínimo que embrulha a lista num objeto, `return { produtos: await session.datasources["fonte"] }`, e leia `${[fonte-js]produtos}`. Receita completa no KB-04, seção 13.

### Nomeação

- Nomes descritivos em minúsculas com hífen: `webhook-bling`, `get-pedido`, `get-customer`, `busca-cep`, `Javascript-desconto`.
- O nome precisa ser único na automação e criado **antes** de ser lido no caminho de execução.

### 5.4 Parâmetros entre automações 🟡

A automação principal envia `parameters` (`[{ "name", "value" }]`) na ação `start-another-automation-action`. O subfluxo começa com `initiated-by-another-automation-trigger`, cuja fonte de dados (`datasourceName`, padrão `Api-request-1`) recebe esses parâmetros. Leia como `[Api-request-1]NomeDoParametro` e registre "conferir no primeiro teste" nas Pendências.

Quando não precisar passar dados explícitos, o subfluxo já roda no contexto do mesmo lead.

## 6. Bloco JavaScript — Padrão Oficial

### Ambiente

- JavaScript nativo, **sem bibliotecas externas**. Permitido: `fetch()`, `Date`, `JSON`, `Math`, `console.log`. Proibido: moment, axios, lodash, dayjs.
- `async/await` disponível no nível principal do código.
- `timeout` do bloco: 30 segundos.
- O código fica em `javascriptCode` como texto JSON: quebras de linha viram `\n` e aspas duplas viram `\"`.

### API da sessão

```js
await session.getValue("leadName");                    // campo do sistema
await session.setValue("leadPhone", "5511999998888");  // grava campo do sistema
await session.getAdditionalValue("UTM Source");        // campo adicional ou parâmetro do sistema, pelo nome
await session.setAdditionalValue("UTM Source", "meta"); // grava campo adicional ou parâmetro do sistema Texto (cache: KB-04, seção 14)
await session.datasources["Api-request-1"];            // fonte de dados de um bloco anterior
```

### Regras obrigatórias

1. Use `async/await` em toda operação assíncrona.
2. Acesse com segurança: `obj?.campo`.
3. Nunca assuma que um dado existe. Valide antes de usar.
4. Trabalhe com fatos: confirme nos dados, não na suposição.
5. Datas para agendamento do CRM saem **exatamente** no formato `2026-03-31T00:59:00:000-03:00` (dois-pontos antes dos milissegundos).
6. Nenhuma biblioteca externa.
7. Todo código tem `try/catch`.
8. Valide o lead e os dados antes de gravar.
9. Nunca interrompa o fluxo: erros são tratados e retornados.
10. Evite sobrescrever informação existente sem motivo.

### Padrão de retorno

```js
// Sucesso
return { sucesso: true, erro: false, dados: { /* resultado */ } };

// Erro
return { sucesso: false, erro: true, mensagem: "Descrição clara do erro", debug: error?.message || null };
```

O objeto retornado vira a fonte de dados do bloco. Para ramificar pelo resultado, use uma condição logo depois:

```json
{ "conditions": [ { "id": "uuid-v4", "name": "field-is-equal-condition", "group": "field", "options": { "parameter": "[Javascript-1]sucesso", "equalsTo": "true" }, "nextBlockId": "uuid-do-caminho-de-sucesso" } ], "trueNextBlockId": "", "falseNextBlockId": "uuid-do-caminho-de-falha" }
```

A saída `errorNextBlockId` do bloco só é usada quando o código **quebra** ou estoura o tempo. Com o padrão acima, o erro volta tratado e é a condição que decide o caminho.

### Regras de JSON no retorno

- `string` para texto, `number` para números, `boolean` para verdadeiro/falso, `null` para ausência.
- Evite `"10"` (número como texto), `"true"`, `""` como vazio, `undefined`, `NaN` e `Infinity`.
- Decimais com ponto: `10.5`. Nunca `10,5`.
- Valores monetários: prefira centavos inteiros (`{ "priceCents": 1050 }`) ou `{ "amount": 10.5, "currency": "BRL" }`.

### Estrutura base

```js
// ##CONFIG##
const DATASOURCE = "Api-request-1";
let data = null;

try {
  data = await session.datasources[DATASOURCE];

  if (!data) {
    throw new Error(`Datasource "${DATASOURCE}" não encontrado`);
  }

  if (!data?.campoObrigatorio) {
    throw new Error("Campo obrigatório não encontrado no payload");
  }

  const valor = data.campoObrigatorio;
  const existente = await session.getValue("campoCRM");

  if (!existente) {
    await session.setValue("campoCRM", valor);
  }

  return { sucesso: true, erro: false, dados: { valor } };
} catch (error) {
  return { sucesso: false, erro: true, mensagem: error.message, debug: data };
}
```

### Exemplo: dias desde a última compra

Classifica o lead para réguas de reativação. Depois do bloco, use `between-condition` em `[Javascript-dias]dados.diferencaDias`.

```js
// ##CONFIG##
const CAMPO_DATA = "Última compra"; // campo adicional com data ISO 8601

try {
  const valorBruto = await session.getAdditionalValue(CAMPO_DATA);
  if (!valorBruto) {
    throw new Error(`Campo adicional "${CAMPO_DATA}" vazio`);
  }

  const dataCompra = new Date(valorBruto);
  if (Number.isNaN(dataCompra.getTime())) {
    throw new Error(`Data inválida em "${CAMPO_DATA}": ${valorBruto}`);
  }

  const MS_POR_DIA = 24 * 60 * 60 * 1000;
  const diferencaDias = Math.floor((Date.now() - dataCompra.getTime()) / MS_POR_DIA);

  let faixa = "ativo";
  if (diferencaDias > 180) faixa = "inativo-180-mais";
  else if (diferencaDias > 90) faixa = "inativo-91-180";
  else if (diferencaDias > 30) faixa = "inativo-31-90";

  return { sucesso: true, erro: false, dados: { diferencaDias, faixa } };
} catch (error) {
  return {
    sucesso: false,
    erro: true,
    mensagem: "Não foi possível calcular os dias desde a última compra",
    debug: error?.message || null
  };
}
```

### Exemplo: data no formato de agendamento

```js
// Converte uma data para o horário de Brasília no formato exigido pelo CRM:
// 2026-03-31T00:59:00:000-03:00
function formatarParaAgendamento(data) {
  const local = new Date(data.getTime() - 3 * 60 * 60 * 1000);
  const p = (n, t = 2) => String(n).padStart(t, "0");
  return `${local.getUTCFullYear()}-${p(local.getUTCMonth() + 1)}-${p(local.getUTCDate())}` +
    `T${p(local.getUTCHours())}:${p(local.getUTCMinutes())}:${p(local.getUTCSeconds())}:${p(local.getUTCMilliseconds(), 3)}-03:00`;
}

try {
  const amanha = new Date(Date.now() + 24 * 60 * 60 * 1000);
  return { sucesso: true, erro: false, dados: { agendamento: formatarParaAgendamento(amanha) } };
} catch (error) {
  return { sucesso: false, erro: true, mensagem: "Falha ao montar a data", debug: error?.message || null };
}
```

### Exemplo: chamada externa com `fetch`

```js
// ##CONFIG##
const URL_API = "https://viacep.com.br/ws/";

try {
  const cepBruto = await session.getValue("leadZip");
  const cep = String(cepBruto ?? "").replace(/\D/g, "");
  if (cep.length !== 8) {
    throw new Error(`CEP inválido: ${cepBruto}`);
  }

  const resposta = await fetch(`${URL_API}${cep}/json/`);
  if (!resposta.ok) {
    throw new Error(`API respondeu ${resposta.status}`);
  }

  const endereco = await resposta.json();
  if (endereco?.erro) {
    throw new Error(`CEP não encontrado: ${cep}`);
  }

  if (endereco?.localidade) await session.setValue("leadCity", endereco.localidade);
  if (endereco?.uf) await session.setValue("leadState", endereco.uf);

  return { sucesso: true, erro: false, dados: { cidade: endereco?.localidade ?? null, uf: endereco?.uf ?? null } };
} catch (error) {
  return { sucesso: false, erro: true, mensagem: "Falha ao consultar o CEP", debug: error?.message || null };
}
```

### Antes de escrever código, confirme

- **Origem dos dados**: webhook, API, campo do CRM ou fonte de dados.
- **Nome da fonte de dados**: ex. `Api-request-1`.
- **Payload de exemplo**, quando vier de webhook ou API.

### Diagnóstico

Quando o código não funcionar, peça:

1. O erro exibido no bloco (botão direito → copiar).
2. Um print da tela.
3. O JSON recebido pelo webhook ou pela fonte de dados.
