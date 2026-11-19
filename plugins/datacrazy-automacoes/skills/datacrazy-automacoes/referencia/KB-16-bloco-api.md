# KB-16 — Bloco API — `type: "api"`

"Faça chamadas a APIs externas para integrar com outros sistemas ou serviços." Busca ou envia dados para fora do CRM: ERP, checkout, Meta Graph, planilhas via Apps Script, n8n e a própria API do Datacrazy. A resposta vira uma **fonte de dados** para os blocos seguintes. 49 blocos nos modelos.

Níveis ✅ 🟡 ⚠️ ⛔: ver KB-10.

---

## 1. Estrutura

```json
{
  "id": "uuid-v4",
  "type": "api",
  "presentation": { "x": 914, "y": 0 },
  "sourceBlockId": null,
  "options": {
    "apis": [
      { "name": "json-http-request-api", "group": "http", "options": { "url": "https://api.exemplo.com/v1/pedidos/{id|[webhook-loja]order.id}", "method": "GET", "headers": [ { "key": "Authorization", "value": "" } ], "query": [], "body": "", "retryCount": 3, "retryIntervalSeconds": 10, "responseHeadersOverrides": [], "datasourceName": "get-pedido", "datasourceColor": "#22c55e" } }
    ],
    "nextBlockId": "uuid-sucesso",
    "errorNextBlockId": "uuid-falha"
  }
}
```

- Item: `{ "name", "group": "http", "options" }`, sem `stepId`.
- **Uma chamada por bloco** (48 de 49 nos modelos). Cada chamada tem saída de erro própria e fica fácil de depurar.
- **Saídas**:
  - "Próximo passo" (`nextBlockId`).
  - **Erro** (`errorNextBlockId`): falha de rede, tempo esgotado ou resposta de erro depois das retentativas. No caminho de erro, `{Código do último erro|lastErrorCode}` e `{Mensagem do último erro|lastErrorMessage}` explicam o que houve.
- ✅ Medido em 02/10/2026:
  - Resposta **4xx** vai para a saída de erro.
  - As retentativas valem também para o 4xx. Com `retryCount: 1` e `retryIntervalSeconds: 3`, a chamada com erro leva cerca de **3,7 s** (sem retentativa, cerca de 0,5 s).
  - Resposta `[]` com status **200** segue pelo **próximo passo**, não pelo erro.

---

## 2. Itens

| Na interface | `name` | Resposta | Nível |
|---|---|---|---|
| Requisição HTTP com comunicação via JSON | `json-http-request-api` | JSON da resposta → `[fonte]caminho` | ✅ (48) |
| Requisição de arquivo HTTP | `json-http-request-file-api` | "Será retornado um json com as propriedades **url** (link do arquivo) e **size** (tamanho)" | ✅ (1) |

**Qual usar**: a resposta é dado (JSON) → **JSON**. A resposta é um arquivo (PDF de boleto, nota, etiqueta, imagem) que você quer mandar ao lead ou anexar → **arquivo**. O CRM baixa, guarda e devolve `[fonte]url`, que você usa em "Arquivo URL Dinâmica" (KB-11).

---

## 3. Opções

| Opção | Na interface | Valores (padrão do editor) | Como decidir |
|---|---|---|---|
| `url` | Url da requisição | texto com variáveis | Monte IDs no caminho: `/pedidos/{id\|[webhook]data.id}`. |
| `method` | Método | `GET` · `POST` · `PUT` · `PATCH` · `DELETE` (JSON: `POST`; arquivo: `GET`) | `GET` consulta. `POST` cria ou envia. `PUT`/`PATCH` atualiza. `DELETE` remove. Nos modelos: 42 GET, 6 POST. |
| `headers[]` | Cabeçalho | `{ "key", "value" }` | `Content-Type: application/json` em POST/PUT/PATCH. `Authorization: Bearer …` com valor **vazio** (Pendência) ou vindo de variável. |
| `query[]` | Parâmetros | `{ "key", "value" }` | Filtros e paginação (`pagina`, `limite`, `fields`). Prefira aqui a concatenar na URL. |
| `body` | Corpo | **texto** com o JSON e variáveis | Só em POST/PUT/PATCH. Para mandar um objeto montado por JavaScript: `"${[Javascript-1]dados}"`. |
| `retryCount` | Quantidade de retentativas (Configurações avançadas) | `0` | `3` para APIs instáveis ou com limite de taxa (ERP, Bling). `0` para POST que **não pode** duplicar (criar pedido, cobrar). |
| `retryIntervalSeconds` | Intervalo entre retentativas (s) | `5` | `10` junto com `retryCount: 3` nos modelos. |
| `datasourceName` | Fonte de dados | `"Api-request-N"` | **Nomeie pelo que retorna**: `get-token`, `get-pedido`, `get-customer`, `post-lead-pdf`. |
| `datasourceColor` | Cor da fonte | hex | Qualquer. |
| `responseHeadersOverrides[]` | "Resposta do Cabeçalho" (só **arquivo**) | `{ "path", "value" }` | Corrigir o cabeçalho da resposta quando o servidor não informa tipo ou nome do arquivo (ex.: `Content-Type: application/pdf`). |

**Atalhos do editor**: "Preencher colando um cURL" (do Postman, Insomnia ou terminal) preenche método, URL, cabeçalhos e corpo; "Copiar como cURL" exporta para teste. Quando o usuário tiver a documentação da API, peça o cURL de exemplo.

---

## 4. Lendo a resposta

```text
[get-pedido]data.id                  campo
[get-pedido]data.itens               lista → Loop de array (KB-17)
[get-pedido]data.itens[0].sku        primeiro item
[get-carts][0].Cart.customer_id      resposta que é lista na raiz
```

- Depois da chamada, os modelos seguem com: Mapeamento de campo (20×), condição no status (10×), "Campo possui valor" (7×) para confirmar que veio o dado, outra API (6×) e Análise de telefone.
- **Verifique antes de usar**: API que responde 200 com `{ "data": [] }` ou `[]` não cai no erro. Coloque "Campo possui valor" no campo que importa: `[get-pedido]data[0].id`, ou `[fonte][0].campo` quando a lista está na raiz.
- Para devolver uma **lista na raiz inteira** ao agente de IA (resultado da tool), o caminho não basta: veja o JavaScript mínimo no KB-04, seção 13.

---

## 5. Autenticação e segredos

- **Nunca** escreva tokens, chaves ou senhas no JSON gerado nem no chat. Deixe `value: ""` e registre a Pendência "colar o token no cabeçalho Authorization".
- Padrões vistos nos modelos para não espalhar token:
  - **Token em parâmetro do sistema Secreto**: `Bearer {Chave_API|additional-field[Chave_API]}`. Troca num lugar só, e o valor não aparece na inspeção da sessão nem no MCP (KB-03, seção 4.2). Pendência: "criar o parâmetro Secreto Chave_API e colar o token". Os modelos antigos guardam em campo adicional comum, que expõe o valor.
  - **Bloco de token antes**: API `get-token` (ex.: Apps Script que renova OAuth do Bling) → chamadas seguintes com `Bearer {access_token|[get-token]access_token}`. Tokens que expiram ficam sempre válidos.
- API do Datacrazy: `https://api.g1.datacrazy.io/api/v1/...`, com a chave da conta (Pendência). Endpoints, filtros, limites e exemplos no **KB-07**. Rotas internas do CRM (métricas, execução de fluxo, conversas em lote) no **KB-08**, sempre pelo endereço público.

---

## 6. Quando usar (e quando não)

| Situação | Use |
|---|---|
| Buscar dados completos que o webhook não manda (pedido, cliente, nota fiscal) | **API** GET com o ID recebido. |
| Enviar evento para outro sistema (venda para ferramenta de BI, lead para planilha, n8n) | **API** POST. Monte o payload com JavaScript quando for complexo. |
| Descobrir a campanha de um anúncio (tracking de Click-to-WhatsApp) | **API** GET no Meta Graph: `/{Referral Source Id\|leadSourceId}?fields=name,campaign,adset`. |
| Baixar PDF de boleto ou nota e mandar ao lead | **Requisição de arquivo** → Arquivo URL Dinâmica. |
| Anexar arquivo ao lead no CRM | **API** POST na API do Datacrazy (`/leads/{leadId}/attachments`) com a URL. |
| Várias chamadas encadeadas com lógica ou cálculo entre elas | **JavaScript** com `fetch` (KB-19): um bloco em vez de cinco. |
| Transformar ou reorganizar dados já recebidos | **Operações de campos** ou **JavaScript**, não API. |
| Criar ou mover lead e negócio no próprio CRM | **Ações** nativas (KB-12). A API do Datacrazy só quando a ação nativa não expõe o campo. |
| Consultar ou alterar o próprio CRM além dos blocos nativos (métricas do lead, negócios do lead, ações em lote, outra conversa, status da conexão) | **API do Datacrazy** (KB-07). |

## 7. Supabase (PostgREST) ✅

Medido em 02/10/2026 numa conta real, com a API REST do Supabase (`https://<projeto>.supabase.co/rest/v1/<tabela>`).

- **Cabeçalhos**: `apikey` e `Authorization: Bearer`, os dois com a chave lida de um parâmetro do sistema Secreto: `{Token Supabase|additional-field[Token Supabase]}`.
- **Resposta**: lista na raiz. Leia `[fonte][0].campo` e confira com "Campo possui valor". `[]` com 200 vai para o próximo passo.
- **Operadores JSON no `select`**: `link:metadata->detalhes->>link` extrai o texto de uma coluna `jsonb` e devolve com o nome `link`. Peça só as colunas usadas; nunca traga colunas pesadas, como `embedding`.
- **Filtros com aspas** funcionam em `and=(…)`: `and=(content.ilike."*{Palavra 1|[tool-input]palavra_1}*",content.ilike."*{Palavra 2|[tool-input]palavra_2}*")`. Palavra vazia vira `"**"`, que aceita tudo, então palavras opcionais não atrapalham.
- Outros filtros usados: `id=in.(…)` para vários códigos, `id_produto=eq.…` e `limit`.

```json
{ "name": "json-http-request-api", "group": "http", "options": {
  "url": "https://<projeto>.supabase.co/rest/v1/Produtos_xml", "method": "GET",
  "headers": [
    { "key": "apikey", "value": "{Token Supabase|additional-field[Token Supabase]}" },
    { "key": "Authorization", "value": "Bearer {Token Supabase|additional-field[Token Supabase]}" }
  ],
  "query": [
    { "key": "select", "value": "id_produto,content,link:metadata->detalhes->>link" },
    { "key": "and", "value": "(content.ilike.\"*{Palavra 1|[tool-input]palavra_1}*\",content.ilike.\"*{Palavra 2|[tool-input]palavra_2}*\")" },
    { "key": "limit", "value": "8" }
  ],
  "body": "", "retryCount": 1, "retryIntervalSeconds": 3, "responseHeadersOverrides": [],
  "datasourceName": "busca-produtos", "datasourceColor": "#22c55e" } }
```

- Lista vazia em toda consulta, até sem filtro: a tabela não libera leitura (`SELECT`) para o papel `anon` (RLS sem política) ou está vazia.
- Ferramenta MCP completa, com a lista devolvida inteira: KB-04, seção 13.

## 8. Padrões dos modelos

| Integração | Sequência |
|---|---|
| Bling (pedido de venda) | Webhook → **API get-token** → **API get-pedido** (`/pedidos/vendas/{id}`) → Mapeamento → Lead/negócio → Loop de itens. |
| Nota fiscal | **API get-notas** → **Requisição de arquivo** (PDF) → **API post-lead-pdf** (anexa ao lead) → Mensagem com o link. |
| Tracking de anúncio | Mensagem recebida (`receiveJson`) → **API Meta Graph** `/{source_id}` → Mapeamento em campos adicionais (UTM) → Comentário no lead. |
| Agendado | Execução agendada → **API** lista → Loop de array → ações por item. |

## 9. Erros comuns

1. **Token no JSON** ou pedido de token no chat.
2. **Saída de erro vazia** em integração crítica: falha silenciosa. Ligue a uma notificação com `lastErrorMessage`.
3. **`retryCount` em POST não idempotente**: pode criar em dobro.
4. **`body` como objeto**: é **texto**, com aspas escapadas no JSON (`"{\"nome\":\"{Nome do lead|leadName}\"}"`).
5. **`datasourceName` genérico** (`Api-request-2`) em fluxo com várias chamadas: vira confusão ao mapear.
6. **Ler a resposta sem verificar** se o campo veio.
7. **Várias chamadas no mesmo bloco**: uma falha esconde qual quebrou.
