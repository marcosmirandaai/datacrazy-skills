# KB-19 — Bloco JavaScript — `type: "javascript"`

"Execute código JavaScript personalizado para manipular dados da sessão." Resolve o que os outros blocos não resolvem sozinhos: cálculo, transformação de dados, montagem de payload, várias chamadas `fetch` com lógica entre elas. O código roda "em um ambiente seguro com limite de tempo de execução de 30 segundos". 13 blocos em 8 automações nos modelos.

O **Padrão Oficial de escrita** (regras, API da sessão, formato de retorno e exemplos) está no **KB-03, seção 6**. Este KB diz **quando** usar o bloco e **como ligá-lo** ao fluxo.

Níveis ✅ 🟡 ⚠️ ⛔: ver KB-10. O bloco é ✅.

---

## 1. Estrutura

```json
{
  "id": "uuid-v4",
  "type": "javascript",
  "presentation": { "x": 914, "y": 0 },
  "sourceBlockId": null,
  "options": {
    "javascriptCode": "try {\n  const pedido = await session.datasources[\"get-pedido\"];\n  const total = Number(pedido?.data?.total ?? 0);\n  return { sucesso: true, erro: false, dados: { totalCentavos: Math.round(total * 100) } };\n} catch (error) {\n  return { sucesso: false, erro: true, mensagem: error.message };\n}",
    "timeout": 30,
    "datasourceName": "Javascript-total",
    "datasourceColor": "#f97316",
    "nextBlockId": "uuid-condicao-resultado",
    "errorNextBlockId": "uuid-tratamento"
  }
}
```

- **Sem lista de itens**: tudo fica direto em `options`.

| Opção | Na interface | Como usar |
|---|---|---|
| `javascriptCode` | Código JavaScript ("Configurar JavaScript") | Texto JSON: quebra de linha = `\n`, aspas = `\"`. |
| `timeout` | "Timeout (segundos)": máximo 30 | `30` (13 de 13 nos modelos). Menos só para falhar rápido. |
| `datasourceName` | "Fonte de dados com o resultado" (padrão `"Javascript-N"`) | O `return` vira `[Javascript-total]dados.totalCentavos`. Nomeie pelo que calcula: `Javascript-diferenca_dias`, `Javascript-Desconto-percentual`. |
| `datasourceColor` | Cor | hex. |
| `nextBlockId` | Próximo passo | Normalmente uma **condição** que lê `sucesso`. |
| `errorNextBlockId` | "Caso ocorrer erro na execução do JavaScript" | Só quando o código **quebra** (exceção não tratada, sintaxe) ou **estoura o tempo**. |

---

## 2. Métodos disponíveis

Documentação do editor:

| Método | O que faz |
|---|---|
| `session.getValue("campo")` | Lê um campo da sessão pelo nome (`leadName`, `leadPhone`, `businessExternalId`…). |
| `session.setValue("campo", valor)` | Grava um campo da sessão. |
| `session.getAdditionalValue("Nome do campo")` | Lê um campo adicional ou parâmetro do sistema pelo nome. Parâmetro Secreto chega com o valor real (KB-03, seção 4.2). |
| `session.setAdditionalValue("Nome do campo", valor)` | Grava um campo adicional ou um parâmetro do sistema Texto (cache de tabela de apoio: KB-04, seção 14). |
| `session.datasources["fonte"]` | Fonte de dados completa de um bloco anterior (webhook, API, loop, IA). |

Use sempre `await`. Também estão disponíveis `fetch`, `Date`, `JSON` e `Math`. Sem bibliotecas externas.

---

## 3. Quando usar — e quando um bloco nativo é melhor

| Preciso… | Melhor escolha | Por quê |
|---|---|---|
| copiar um valor para um campo | **Mapeamento de campo** (KB-17) | Visível no canvas, sem código. |
| normalizar telefone / somar dias a uma data | **Análise de telefone / Formatação de data** (KB-17) | Nativos e testados. |
| comparar valor, faixa, texto | **Condições** (KB-13) | — |
| uma chamada HTTP simples | **API** (KB-16) | Retentativas e saída de erro prontas. |
| calcular (diferença em dias, desconto %, total com impostos, parcelas) | **JavaScript** | Nenhum bloco nativo faz aritmética. |
| reorganizar um JSON (montar payload para outro sistema, achatar lista, filtrar itens) | **JavaScript** | Modelo "DataCrazy → Metrito" monta o webhook genérico da venda. |
| decidir por regras compostas difíceis de desenhar (várias faixas e exceções) | **JavaScript** → devolve uma `faixa` → condição por item | Mantém o canvas simples. |
| várias chamadas dependentes (token → busca → paginação) | **JavaScript** com `fetch` | Um bloco em vez de uma cadeia de APIs. |
| consultar e agir sobre o próprio CRM com lógica (ganhar todos os negócios abertos, achar etapa pelo nome, paginar negócios parados) | **JavaScript** com o auxiliar `dc()` do KB-07 | Endpoints, limites e exemplos prontos no KB-07, seção 4. |
| formatar data para o agendamento do CRM (`2026-03-31T00:59:00:000-03:00`) | **JavaScript** (KB-03) | Formato específico. |
| gerar texto persuasivo, entender intenção | **IA** (KB-18) | Código não interpreta linguagem. |

Nos modelos, o JavaScript aparece depois de Loop de array, Mapeamento e espera de segundos, e antes de Criar produto e Descontos (cálculo de preço e desconto dos itens de pedido), Mapeamento e API.

---

## 4. Ligação ao fluxo

1. **Antes**: garanta que a fonte de dados existe no caminho (webhook, API, loop) e confirme o nome exato.
2. **O código** devolve `{ sucesso, erro, dados }` e trata os próprios erros (`try/catch`).
3. **Depois**: condição por item em `[Javascript-x]sucesso` = `"true"` → caminho feliz; "nenhuma atendida" → tratamento (notificação, tag de erro).
4. **Ligue também** `errorNextBlockId`, para exceções não tratadas e tempo esgotado.
5. **Use o resultado**: `{valor|[Javascript-x]dados.valor}` em mensagens, mapeamentos, corpo de API ou ações de produto.

```json
{ "conditions": [ { "id": "uuid-v4", "name": "field-is-equal-condition", "group": "field", "options": { "parameter": "[Javascript-total]sucesso", "equalsTo": "true" }, "nextBlockId": "uuid-caminho-feliz" } ], "trueNextBlockId": "", "falseNextBlockId": "uuid-caminho-falha" }
```

---

## 5. Perguntas antes de escrever o código

- De qual **fonte** vêm os dados, e qual o **nome exato** dela?
- Existe um **payload de exemplo** (JSON real do webhook ou da API)? Sem exemplo, declare a suposição dos caminhos na entrega.
- O que o código **grava** (`setValue`, `setAdditionalValue`) e o que só **devolve**?
- Qual decisão o fluxo toma com o resultado? Isso define os campos de `dados`.

## 6. Erros comuns

1. Código sem `try/catch`: qualquer campo ausente derruba o bloco.
2. Acesso sem `?.` a dados do webhook.
3. Bibliotecas externas (moment, axios, lodash).
4. Esquecer o `return`: a fonte de dados fica vazia.
5. Número como texto no retorno (`"10"`) e decimal com vírgula.
6. Token ou senha dentro do código: leia de um parâmetro do sistema Secreto com `session.getAdditionalValue`, ou registre Pendência.
7. `javascriptCode` com quebras de linha reais ou aspas sem escape no JSON.
8. Usar JavaScript para o que um Mapeamento de campo ou uma Condição resolve.
