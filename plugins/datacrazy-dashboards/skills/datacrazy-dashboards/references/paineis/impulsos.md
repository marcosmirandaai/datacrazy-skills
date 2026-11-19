# Impulsos (disparo em massa)

Projetos: Relatórios Base B (aba Impulsos do painel, 08/10/2026) e Painel Base A (porte da tela
da Base B, PR #18 em produção desde 10/10/2026) ·
Atualizado em 10/10/2026

## A pergunta que o painel responde

O que cada disparo em massa ("impulso", `boost` na API) mandou e o que voltou: quantos receberam,
leram, responderam, pediram para sair e compraram/se matricularam — por impulso, e lead por lead.

Leitura por projeto: para a **Base A**, as subseções "Ingestão", "Servidor (Base A)" e "Tela"; para a
**Base B**, "Ingestão", "Gerador (Base B)" e "Tela". As decisões valem para os dois, salvo
indicação.

## De onde vem cada número

| Número | Fonte | Base | "Não medido" quando |
|---|---|---|---|
| Lista (registros) | CRM: `recordsCount` do impulso | — | nunca (fato) |
| Não iniciados, pendentes, em execução, concluídos, com erro | CRM: `/boosts/{id}/metrics` | lista | nunca; estado sem gente não vem na resposta = 0 |
| Enviados | estado `completed` do lead no impulso | o percentual é sobre os leads com negócio no painel (Base A) / sobre a lista (Base B) | — |
| Entregue, lido | status da mensagem da automação logo depois do gatilho `campaign_event_trigger` na conversa (`RECEIVED`/`READ`) | entregues (para lidos) | conversa não relida; sem a mensagem da automação (entrega nula) |
| Engajou / respondeu | 1ª fala do cliente depois do gatilho | conversas medidas | conversa não relida |
| Pediu para sair | qualquer fala do cliente depois do gatilho que casa com `SAIR_DA_LISTA` | conversas medidas | conversa não relida; `-1` = não dá mais para medir |
| Matrícula (Base A) | negócio em "Matrícula Realizada" com `ultimo_movimento` dentro da janela do disparo | enviados | — |
| Interessado/sinais (Base B) | leitura das respostas no contexto do fluxo (`relatorio_disparo.js`) | responderam | — |

Por que entrega e leitura não vêm do impulso: os impulsos dos dois clientes são do tipo `automation`
(acionam um fluxo), e `messageStatus`, `errorCode` e `template` vêm **nulos** em `/boosts/{id}/leads`.
A ponte é `lead_id`: impulso → lead → negócio/conversa.

## Como é montado

### Ingestão (os dois)
- `GET /crm/boosts` (`order[createdAt]=desc`, `take=50`; página repetida = skip ignorado → pare).
- Por impulso, `GET /crm/boosts/{id}/metrics?cache=no-cache` → contagem por estado (só os estados com
  gente aparecem).
- A lista de quem recebeu só é relida quando o `updatedAt` do impulso mudou, ou quando o gravado não
  cobre `recordsCount`. Leitura por estado (`filter[status]`), `take=1000`, **sem `order`**, até 3
  passadas até fechar com as métricas. Duas páginas cheias seguidas sem ninguém novo = rota ignorando
  o `skip`: pare aquele estado. Impulso em `started`: leia cada estado uma vez, sem alvo (gente muda de
  estado entre ler as métricas e ler a lista).
- **Público** (Base A, 10/10/2026): `b.params.filter` gravado cru (`impulsos.parametros`) e por extenso
  (`impulsos.publico`), com os nomes de `/tags`, `/pipelines` e `/pipelines/{id}/stages` (60/min cada),
  buscados só quando o filtro mudou e cita tag ou etapa. Base B faz o mesmo no gerador
  (`publico()` em `gerar_dashboard.js`, a partir de `boosts.params_json`).
- **Pedido para sair** (Base A, 10/10/2026): `medirCampanha` grava `disparo_saiu` (1/0); disparo medido
  antes da regra entra numa releitura dirigida e única (`precisaMedirSaida`); quem perdeu o gatilho da
  janela de 20 mensagens vira `-1`.

### Servidor (Base A)
- `GET /api/impulsos` → `disparosEmMassa`: uma linha por impulso no período (`COALESCE(iniciado_em,
  criado_em)`), com os cinco estados, o retorno de `sqlDoRetornoDosDisparos` (CTE `chegadas` com
  `LEAD() OVER (PARTITION BY lead_id ORDER BY chegou, id)`), `publico`, velocidade/lote/intervalo e o
  grupo `fora_de_impulso` (`foraDeImpulso`: gatilho na conversa, sem impulso concluído no lead, pelo
  dia do gatilho).
- `GET /api/impulsos/disparo?id=<id|fora>` → `disparoDoImpulso`: o impulso (com `estados` e
  `gravados`) e os leads, um por linha (`sqlDosLeadsDoImpulso`), com marcas em **três estados** (SQL
  devolve 2 sim / 1 não / 0 não sei; a API devolve 1 / 0 / null). Lead da lista sem negócio visível não é
  listado: entra em `sem_negocio`. Mesma permissão da página (admin e supervisor).

### Gerador (Base B)
- `gerar_dashboard.js` embute `D.impulsos[]` (modelos, público por extenso, métricas `m.*`, `casados`)
  e **uma linha por lead em vetor de 30 posições** (posições 28 = impulso, 29 = status no impulso). O
  navegador filtra e recalcula tudo.

### Tela (mesma estrutura nos dois)
- **Lista em grade**, igual à tela do CRM: cartão por impulso com título, descrição (ou "fluxo: X"),
  chip "Aciona fluxo", status, número de leads, data e "entregues · lidos · engajados · matrículas".
  Busca local filtra os cartões por `data-busca`, sem redesenhar (o campo não perde o foco). Cartão a
  mais: **Fora de impulso** (gatilho de campanha sem impulso; na Base B, 240 leads da tag).
- **Página do impulso** (no lugar do resto da página; Base A também abre pelo seletor "Impulso"):
  caminho de volta ("Impulsos › título"), status, descrição, barra de progresso
  `(completed + error) / lista`, os cinco estados do CRM, e as métricas que **abrem o funil**:
  Total, Enviados, Lidos, Engajados, (Matrículas na Base A), Erro/saíram.
- **Funil por etapa** (`segmentos()`): a 1ª barra é a base dos percentuais; barra com `pred` é
  clicável e lista os leads dela; `crit` (alarme) e `rec` (segundo plano). Barra escolhida ao abrir:
  `{ total: 1, enviados: 2, lidos: 1, engajados: 1, matriculas: 2, erros: 0 }`.
- **Cartões ao lado**: Automação/Template (Base B mostra os modelos; Base A não guarda o texto),
  Informações (criado, início, término ou status, velocidade lenta/média/rápida, "N a cada M min",
  tipo) e Público (texto por extenso; Base A: "ainda não lido do CRM" quando nulo).
- **Leads do disparo**: pílulas por estágio e busca por nome/telefone/atendente; cada linha com nome,
  telefone · atendente, a **trilha** e o selo do estágio; clique (ou Enter/Espaço) abre a ficha.
  - Estágio, do mais adiante ao mais atrás: Base A `sair > erro > matriculou > engajado > lido >
    entregue > enviado > fila`; Base B `sair > erro > engajado > aberto > entregue > enviado > fila`.
  - Trilha: Base B 4 passos (entrou, enviado, lido, engajou); Base A 5 (+ matriculou). Feito =
    verde; falha = vermelho (erro marca o envio, "sair" marca a resposta); **não dá para afirmar** =
    borda tracejada com a dica "ainda não medido" ou "não deu para medir".
  - Lista com 60 linhas e "Mostrar mais" de 200; no funil, 25 e +100.

## Decisões e porquês

- 23/09/2026 — Medir impulso pelo CRM e não pela tag: "Disparo 10 a 14" tinha 200 na lista e 197
  erros; "Campanha Agosto", 2.083 na lista, 53 enviados, 208 erros e 1.822 parados (pausado).
- 04/10/2026 — `/boosts/{id}/leads` com `take=100` e `order[statusChangedAt]` trouxe 1.465 ids distintos
  de 1.822 (páginas repetindo até 45%); `take=1000` sem `order` trouxe tudo em 2 requisições.
- 04/10/2026 — Retorno só de quem teve o disparo concluído: das 8 matrículas creditadas ao "Campanha Agosto", 7 eram de leads em "não iniciado" e 1 de lead com erro; dos 53 que receberam, nenhuma.
- 08/10/2026 — "Medido" exige o gatilho **deste** disparo na janela: um único lead com gatilho de
  campanha anterior ligava a bandeira e a tela escrevia "0 · 0,0%".
- Janela fecha no próximo disparo concluído do mesmo lead (último toque): o negócio guarda um gatilho
  só, e a resposta de outubro aparecia também na linha de agosto.
- 10/10/2026 (Base A) — Detalhe por rota própria, sob demanda: a lista vem agregada e os leads só ao
  abrir, já no recorte de quem olha (a Base B embute tudo porque é um retrato estático).
- 10/10/2026 (Base A) — Marcas em três estados na página do lead: medido sem a mensagem da automação
  (entrega nula) ou com `disparo_saiu = -1` aparecia como "não".
- 10/10/2026 (Base A) — Cliques trocam só o pedaço que mudou (funil, lista, ficha): redesenhar a página
  inteira levava 200–2.800 ms no painel do navegador em segundo plano e jogava fora foco e rolagem;
  passou a 1–20 ms. A ficha abre só onde o lead foi clicado (o mesmo lead pode estar no funil e na
  lista) e a linha clicada não sai do lugar.
- Funil com barra de alarme deixa as outras neutras: o acento (ouro na Base B, laranja na Base A)
  e o vermelho se confundem sob daltonismo.

## Pegadinhas

- `/metrics` só lista estados com gente; trate ausente como 0.
- O atendente da linha do lead (Base A) é `colaborador` = `atendente_efetivo` do negócio **hoje**
  (não o da data do disparo, e sem seguir o filtro "Atribuir por"); com dois negócios do mesmo lead, a
  SQL pega `MAX()` por coluna. Um painel "por atendente" precisa decidir isso por escrito.
- Lead que recebeu dois disparos aparece nos dois, cada um com a sua janela; o "Fora de impulso" é um
  grupo à parte (quem tem gatilho sem impulso concluído) e não entra na soma dos impulsos.
- Lead excluído no CRM vem em `/boosts/{id}/leads` com `lead.id` nulo: conta na lista gravada, não em
  "quem recebeu".
- A rota de mensagens devolve só as 20 últimas: o gatilho pode cair fora da janela. Disparo medido não
  some quando a releitura não o encontra (os campos de disparo são preservados).
- A contagem do CRM não segue a equipe escolhida; escreva isso na tela, senão "23 com negócio de 380"
  parece lista mal lida.
- Gráficos do resto da página medem a largura do contêiner: desenhados enquanto a página do impulso
  estava aberta (contêiner escondido), ficam estreitos — redesenhe ao voltar para a lista.
- Na Base B, o botão do menu também tem `data-tela`: o seletor precisa ser `section.tela[data-tela=…]`,
  senão a tela é escrita dentro do botão.

## Testes e verificação

- Base A `scripts/testar-campanha.mjs`: `/boosts` (só relê o que andou), retorno só de quem recebeu,
  taxa sobre os medidos, gatilho de outra campanha, janela entre dois disparos, lead excluído, recorte,
  paginação instável (1.500 em 4 chamadas), skip ignorado em 3 chamadas, impulso rodando; pedido para
  sair (regex e medição), público por extenso e sincronização com falha dos nomes, página de um
  impulso (estados, janela, três estados, recorte, fora de impulso, período) e as regras da tela
  (`_regras` de `public/impulsos.js`: estágio, funil, métricas, trilha).
- `testar-sincronizacao.mjs`: releitura dirigida do pedido para sair, ordem na fila e o `-1`.
- `testar-postgres.mjs`: `sqlDoRetornoDosDisparos` e `sqlDosLeadsDoImpulso` num Postgres real (PGlite).
- `testar-supervisor-equipe.mjs` e `testar-telas.mjs`: a página do impulso é 403 para supervisor de
  equipe e atendente; 404 para impulso inexistente; 400 sem id.
- Tela: harness com base sintética (4 status, público, entrega/leitura, fora de impulso), 1280 px,
  375 px sem rolagem lateral, tema escuro.
- Base B: detector de transbordo em 375/768/1024/1366/1440 px.

## Arquivos

- Base A `public/impulsos.js` — lista, página, funil, trilha, cliques (`renderImpulsos`,
  `ligarImpulsos`, `fecharImpulso`).
- Base A `src/api/consultas.js` — `disparosEmMassa`, `sqlDoRetornoDosDisparos`,
  `sqlDosLeadsDoImpulso`, `disparoDoImpulso`, `foraDeImpulso`, `tresEstados`.
- Base A `src/ingest/impulsos.js` — `sincronizarImpulsos`, `lerLeadsDoImpulso`, `descreverPublico`.
- Base A `src/ingest/metrics.js` — `medirCampanha`, `SAIR_DA_LISTA`, `pediuParaSair`;
  `src/ingest/mudancas.js` — `precisaMedirSaida`; `src/ingest/run.js` — `montarLinha` (o `-1`).
- Base B `baixar_impulsos.js` (tabelas `boosts`, `boost_leads`), `gerar_dashboard.js` (`publico()`,
  linha em vetor), `modelos/dashboard_disparo.html` (`segmentos`, `funilEtapa`, `estagioImp`,
  `listaImpulsos`, `detalheImpulso`, `trilhaLead`), `lib/classificacao.js` (`SAIR_DA_LISTA`).
