---
name: datacrazy-automacoes
description: Construir, revisar, depurar e documentar automações (fluxos) no CRM Datacrazy em crm.datacrazy.io/flow. Use sempre que a conversa envolver automação/fluxo/flow do Datacrazy, blocos de Mensagem, Ações, Condições, Espera, Randomizador, API, Operações de campos, IA ou JavaScript, gatilhos (negócio criado, mensagem recebida, webhook, MCP, agendado), variáveis ${...} do fluxo, disparo de WhatsApp/Instagram/Facebook pelo CRM, ou o JSON de exportação/importação de um fluxo Datacrazy.
---

# Automações do CRM Datacrazy

Guia operacional do construtor de fluxos do Datacrazy (`crm.datacrazy.io/flow`), levantado de três fontes: o código e os textos de ajuda do editor, o JSON real de 74 automações e os modelos oficiais.

## Como o produto se organiza

- **Automação (flow)** = um canvas. Vive dentro de um **grupo** (pasta) e tem versões. Uma automação pode estar **ativa** ou **inativa**.
- Cada automação começa num nó **Início**, que só existe para receber **gatilhos**. Sem gatilho, nada dispara.
- A partir do Início, você encadeia **blocos**. Cada bloco tem uma ou mais saídas, e cada saída aponta para o próximo bloco.
- Cada bloco exibe contadores de execução: **Sucessos / Alertas / Erros** (o bloco de IA também mostra **Média Tokens**). Use isso para depurar; a **inspeção da sessão** mostra parâmetros, campos adicionais e fontes de dados de uma execução.

### Barra de ferramentas da automação
`Ativar/Desativar` · `Salvar` · `Editar automação` (nome/descrição/grupo) · `Duplicar automação` · `Exportar automação` · `Adicionar anotação` · `Substituir conexão` · `Remover automação`.

> **Alterações não são publicadas sozinhas.** Ao sair do editor com edições pendentes o CRM pergunta se quer sair sem salvar ou salvar antes. Sempre confirme com o usuário antes de `Salvar`, e nunca use `Ativar` sem pedido explícito.

### Criando uma automação
`Adicionar automação` → **Em branco**, **Importar** (JSON exportado) ou **Modelo** (pré-configurado) → Nome, Descrição e **Grupo** (obrigatório).

## Os blocos

| Bloco | `type` interno | Para que serve | Referência |
|---|---|---|---|
| Início | `trigger` | Gatilhos que disparam o fluxo | [KB-10](referencia/KB-10-bloco-gatilhos.md) |
| Mensagem | `chat` | Enviar e receber mensagens no canal | [KB-11](referencia/KB-11-bloco-mensagem.md) |
| Ações | `action` | Mexer em negócio, lead, conversa, sistema, atividades | [KB-12](referencia/KB-12-bloco-acoes.md) |
| Condições | `condition` | Bifurcar o fluxo (por item ou todas verdadeiras) | [KB-13](referencia/KB-13-bloco-condicoes.md) |
| Espera | `delay` | Pausar por tempo, janela, data ou silêncio do contato | [KB-14](referencia/KB-14-bloco-espera.md) |
| Randomizador | `randomizer` | Dividir em ramificações percentuais | [KB-15](referencia/KB-15-bloco-randomizador.md) |
| API | `api` | Chamar APIs externas | [KB-16](referencia/KB-16-bloco-api.md) |
| Operações de campos | `field-operation` | Mapear, normalizar telefone e data, loop de array | [KB-17](referencia/KB-17-bloco-operacoes-de-campos.md) |
| IA | `ai` | Intenção, sentimento, extração, assistente, transcrição, agente | [KB-18](referencia/KB-18-bloco-ia.md) |
| JavaScript | `javascript` | Código próprio sobre os dados da sessão | [KB-19](referencia/KB-19-bloco-javascript.md) |

O **mapa de todos os itens** (nome interno, grupo e nível ✅ 🟡 ⚠️ ⛔) e a escolha de qual bloco usar estão em [referencia/KB-02-catalogo-de-blocos.md](referencia/KB-02-catalogo-de-blocos.md). Cada KB de bloco traz todas as opções e sub-opções, os valores, **quando usar cada uma**, exemplos JSON e erros comuns.

## Variáveis e dados de sessão

Blocos passam dados adiante pela **sessão**. Sintaxe de interpolação:

```
{Rótulo|caminho}         →  {Primeiro nome do lead|leadFirstName}
${rotulo|caminho}        →  ${[date-1]formatted.dateTime|[date-1]formatted.dateTime}
{Rótulo|[fonte]campo}    →  {status|[get-pedido]data.status}
```

Blocos que **produzem** dados (API, IA, Operações de campos, alguns gatilhos) definem um `datasourceName`: é o `[nome]` que você referencia depois. Detalhes, caminho puro × interpolação e o Padrão Oficial do JavaScript em [referencia/KB-03-variaveis-e-javascript.md](referencia/KB-03-variaveis-e-javascript.md).

## Conexão (canal)

Blocos de Mensagem têm um campo **Conexão**. Deixado em branco, ele **herda a conexão da conversa**, que é o que você quer em fluxos de atendimento. Fixe a conexão quando não há conversa de origem (gatilho de negócio, tag, webhook, agendado, manual) ou para sair por outro número. A engrenagem do bloco ainda permite enviar para um **contato direto** (`contactId`, ex.: grupo do time), **agendar** (`scheduledDate`) e mandar como **anotação interna** (`isAnnotation`). Ver KB-11.

## Como trabalhar nesse CRM

1. **Antes de propor um fluxo**, pergunte qual gatilho dispara e qual é o critério de saída. Fluxo sem condição de parada vira loop de mensagens.
2. **Sempre ligue a saída de erro** dos blocos de Mensagem, API e IA a algo — nem que seja uma notificação.
3. **Prefira Condições a IA** quando o critério for determinístico (tem tag, está na etapa X).
4. **Nomeie os `datasourceName`** de todo bloco que produz dado.
5. Para depurar, olhe os contadores por bloco, a inspeção da sessão e exporte o JSON para inspecionar as ligações.
6. **Follow-up do Agente de IA** (Comportamentos → Follow-up do agente) conta tempo corrido e manda de madrugada. Para o follow-up sair só em horário comercial, desligue o do agente e faça a cadência por automação (KB-14 e KB-18, seção 4).
7. **Cache de tabela de apoio**: quando o fluxo chama uma API externa a cada execução só para traduzir um ID que quase não muda (profissional, status, unidade, procedimento, usuário do ERP), ou quando essa API dá 429, ofereça o cache em Parâmetro do sistema (KB-04, seção 14) sem esperar o pedido, **como pergunta** e com quantas chamadas ele poupa (usa JavaScript e API: KB-06, seção 4). Siga o mesmo padrão quando o usuário pedir cache.

## Operando o CRM pelo navegador

- O usuário faz o login — nunca digite credenciais.
- A UI é React + Radix. **`element.click()` sintético não funciona** em abas e menus: dispare `pointerdown`/`mousedown`/`mouseup`/`click` em sequência.
- O canvas é ReactFlow com drag-and-drop HTML5. Para adicionar um bloco por script, dispare `dragstart` no item da paleta e `dragover`+`drop` no `.react-flow__pane` com o mesmo `DataTransfer`.
- A paleta "Blocos básicos" só aparece com **nenhum nó selecionado**.
- **Mover blocos por script**: as props do ReactFlow (`nodes`, `edges`, `onNodesChange`, `onNodeDragStop`) ficam na fibra React de `.react-flow__node[data-id]` (chave `__reactFiber$…`, subindo por `.return`). `onNodesChange([{ id, type: "position", position: { x, y }, dragging: false }])` move; chamar `onNodeDragStop(undefined, nó, nodes)` depois marca a alteração pendente — sem isso o **Salvar** não grava. Tamanho real de cada bloco: `offsetWidth`/`offsetHeight` do elemento.
- **Copiar blocos**: clique no nó e ctrl+c (vários nós: Shift+arrastar). O editor grava via `navigator.clipboard.writeText` — dá para interceptar com um gancho na página. ctrl+a não seleciona nós.
- Automações e scripts usam só os endereços públicos `https://api.g1.datacrazy.io/api/v1/<serviço>/`, com a chave de API da conta (KB-07 e KB-08). Os domínios internos `crm.g1`, `messaging.g1` e `accounts.g1` deixam de responder na próxima release, conforme o [comunicado oficial](https://help.datacrazy.io/pt-br/articles/10670832-comunicado-sobre-rotas-internas-datacrazy-mudancas-nas-apis-internas).
- No navegador, depois que o usuário faz login, o editor chama `https://crm.g1.datacrazy.io/api/crm` com o token de sessão dele. Ela não aceita `fetch` cross-origin a partir da página; para ler payloads, instrumente `window.fetch` antes de navegar via SPA.
- O `body` de blocos de API em fluxos reais pode conter **tokens Bearer**. Nunca copie esses valores para arquivos, relatórios ou artifacts.

## Gerar o JSON de uma automação

Para **construir** fluxos em JSON (importáveis em Automações → Adicionar automação → Importar), a referência canônica são os arquivos `KB-*` em `referencia/`:

- [KB-01](referencia/KB-01-schema-e-importacao.md) — envelope, dependências em `data.*`, os **dois modos de roteamento de condição**, formatos de item (`stepId` em Mensagem, Operações de campos e IA), checklist e exemplo validado.
- [KB-02](referencia/KB-02-catalogo-de-blocos.md) — mapa dos blocos e todos os itens com nível. Itens ⚠️ e ⛔ nunca vão no JSON.
- **KB-10 a KB-19** — um por bloco (tabela acima): opções, sub-opções e quando usar.
- [KB-03](referencia/KB-03-variaveis-e-javascript.md) — variáveis, fontes de dados e JavaScript.
- [KB-04](referencia/KB-04-padroes-e-receitas.md) — arquiteturas reais e erros que quebram fluxos.
- [KB-05](referencia/KB-05-template-canvas.html) — página de entrega com validação, download e cópia de blocos.
- [KB-06](referencia/KB-06-roteiro-de-descoberta.md) — consultoria antes de construir.
- [KB-07](referencia/KB-07-api-datacrazy.md) — **API pública do Datacrazy** (`https://api.g1.datacrazy.io/api/v1`): os 69 endpoints, autenticação, limite de 60/min por rota, filtros `filter[...]`, objetos de resposta e o auxiliar `dc()` para o bloco JavaScript. Use quando o nativo não alcança (métricas do lead, negócios do lead, ações em lote, outra conversa, status da conexão, ID de etapa pelo nome). Nunca invente endpoint fora dele.
- [KB-08](referencia/KB-08-rotas-internas.md) — **rotas internas** do CRM (crm, messaging, accounts) e a **regra nova**: `crm.g1`, `messaging.g1` e `accounts.g1` deixam de funcionar; use `https://api.g1.datacrazy.io/api/v1/crm/…` e `…/api/v1/messaging/…`. Webhooks não mudam. Catálogo de rotas, corpos confirmados, auxiliar `dcInterna()` e receitas (métricas do funil, executar fluxo para um lead, atendentes online, conversas em lote).

Método: **Mapear → Descobrir → Planejar juntos → Construir → Entregar**. Nunca comece pelo JSON: mostre o plano passo a passo (cada passo com bloco, item, opções, mensagens e para onde vai cada saída) e só gere o JSON depois que o usuário aprovar.

Depois de gerar, organize as posições e valide (o organizador também valida; regras de disposição no KB-01, seção 6):

```bash
node scripts/organizar.js caminho/automacao.json caminho/automacao.json
node scripts/validar.js caminho/automacao.json
```

Onde as referências antigas (`blocos.md`, `gatilhos.md`, `receitas.md`, `variaveis-e-schema.md`) divergirem dos `KB-*`, os `KB-*` valem.


### Colar blocos num fluxo existente

O editor copia e cola blocos como uma **lista de nós do canvas**: `[{ "data": <bloco>, "id", "type", "deletable": true, "position", "width", "height", "selected": true }]` — sem gatilho, sem envelope e **sem dependências** (tags, etapas e campos precisam existir na conta). Detalhes no KB-01, seção 10. O `scripts/validar.js` reconhece os dois formatos.

### Consultoria antes de construir e pergunta ao lead

- Antes de gerar fluxos a partir de transcrição, formulário ou briefing, siga o KB-06: plano de automações; descoberta uma automação por vez, com até 5 perguntas por rodada e sugestão padrão em cada; pergunta sobre usar IA, API ou JavaScript; e só então o JSON.
- **Pergunta ao lead**: Mensagem de texto + Entrada do usuário **sem campo do CRM** e com texto vazio, no mesmo bloco. "Próximo passo" (`nextBlockId`) = respondeu; "caso o contato não responda" (`timeoutNextBlockId`) = não respondeu. Detalhes no KB-11.
