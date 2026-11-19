# Visão geral

Projetos: Painel Base A (`pagina-visao`) e Relatórios Base B (tela "Visão geral" do painel de
disparo) · Atualizado em 05/11/2026

## A pergunta que o painel responde

- **Base A:** como estão entrando e andando os leads das duas equipes comerciais (Equipe 2 e Equipe 1) —
  volume, matrícula, agilidade da 1ª resposta e quem está sem resposta.
- **Base B:** o que a campanha de disparo produziu na semana — quantos receberam, viram,
  responderam e se interessaram, e onde cada lead parou.

## De onde vem cada número

### Base A (KPIs — `resumo` em `src/api/consultas.js`)

| Cartão | Valor | Nota | Acento |
|---|---|---|---|
| Leads | `COUNT(*)` de negócios no recorte | telefones únicos (`COUNT(DISTINCT telefone)`) | `--s1` |
| Matrículas | etapa = `'Matrícula Realizada'` | % de conversão | `--ok` |
| 1ª resposta (mediana) | mediana | p90 | `--s2` |
| Dentro da meta (15 min) | `tempo_primeira_resposta ≤ 15/60` | N acima de 45 min · N respondidos | `--s2` |
| Sem resposta | `status_conversa = 'Aguardando'` | — | `--alert` |
| Inconsistências | erratas + outros | "N {tipo maior} · N em outros k tipos" | `--f4` |

- Mediana e p90 calculados em JS sobre a lista ordenada (`percentil`: índice `floor(n·p)`) — o SQL
  dos dois bancos não tem a mesma função de percentil.
- A contagem por tipo de inconsistência usa `destino: 'todos'` com os demais filtros.
- Os tempos vêm das mensagens (só mensagens com atendente humano contam): ver `medicao.md`.

### Base A — cartão "Jornada da IA" (`jornadaIA` em `src/api/consultas.js`, 05/11/2026)

Logo abaixo dos KPIs; some quando a Equipe escolhida não é a IA (a API devolve `null`).

| Passo | Regra | Nota |
|---|---|---|
| Atendidos pela IA | leads distintos com negócio da equipe IA no recorte | "um por lead · N já eram alunos" (etapa `Aluno…`) |
| Passados para humano | negócio da IA em `Transferir para consultor` (follow-up e `transferir_para_consultor` deixam lá) | % dos atendidos |
| Matrícula com humano | o mesmo `lead_id` tem negócio de outra equipe em `Matrícula Realizada` com `COALESCE(ultimo_movimento, criado_em) >= ` início da IA | % dos passados · +N aguardando pagamento |

- À parte, na nota: matriculados por humano sem a passagem e matrículas no próprio funil da IA.
- Período, departamento, canal, consistência e escopo valem; etapa, pipeline, atendente e tag da
  tela não (são de outra pergunta).
- **Por que existe:** com Equipe = IA, o cartão Matrículas mostrava 7 (0,4%), só o funil da IA; a
  maior parte da venda sai depois da passagem, no funil da Equipe 2 ou da Equipe 1.
- **Limite medido em 04/11/2026:** das 23 matrículas depois da passagem, 14 só tinham a mensagem de
  boas-vindas na conversa, com o negócio parado. O cartão conta só o negócio na etapa — a nota diz.
- Teste: `scripts/testar-jornada-ia.mjs` (um lead por caminho). Harness: `harness-plantao.mjs` passa
  um terço da IA para "Transferir para consultor" e liga quatro matrículas de gente a esses leads.

### Base B (recalculado no navegador a cada filtro)

- 6 a 7 KPIs, cada um com minigráfico por semana; "Excluídos do CRM" só aparece se houver.
- Funil Disparados → Receberam → Visualizaram → Responderam → Interessados.
- "Onde o lead parou": rosca com até 6 fatias, pela etapa do funil do lead.

## Como é montado

### Base A
- `GET /api/painel` junta em paralelo `resumo`, `serieDiaria`, `funil`, `porStatus`, `porEquipe`,
  `ranking`, `porCanal` e, só para quem gerencia, `statusIngestao` (senão `ingestao: null`). Em
  paralelo a SPA pede `GET /api/filtros` (`opcoesFiltro`). As rotas avulsas (`/api/resumo`, `/serie`…)
  existem, mas a SPA usa a agregada.
- Gráficos: "Entrada de leads por dia" (área de leads + linha de matrículas, `GROUP BY` dia local);
  "Status das conversas" (rosca: Finalizada `--ok`, Em andamento `--info`, Aguardando `--alert`, resto
  `--text-3`); "Funil por etapa" (barras horizontais, rampa ordinal `--f1..--f5`); "Canais de entrada"
  (cor única, top 12); ranking de atendentes (ver `equipes-e-ranking.md`).
- **Barra de filtros comum:** período (chips 7/30/90/Tudo, padrão 30, + De/Até), Equipe, Etapa,
  Atendente, Departamento (só quem vê tudo), Tag (agrupada por categoria, com contagem), Atribuir por,
  Consistência e Busca (espera de 320 ms).
  - **Etapa** leva pipeline e etapa num só `<option>`, separados por um caractere de controle:
    "Novo Lead" e "Matrícula Realizada" existem nos dois funis.
  - **Facetas** (`opcoesFiltro`): cada lista respeita o escopo e todos os filtros, menos o dela —
    senão escolher uma opção apaga as outras e não dá para trocar sem voltar a "Todas".
  - `manterEscolha`: a escolha que sumiu da lista volta como "X (0)" em vez de trocar sozinha.
- **Filtro central** (`filtro()`): exige usuário ou `SEM_ESCOPO` (sem ele, lança "escopo não é
  opcional"); escopo primeiro; suporte sempre fora do comercial; período pelo dia de Brasília
  (`DIA_LOCAL`); tag exata entre vírgulas (`(',' || replace(tags, ', ', ',') || ',') LIKE '%,X,%'`).
- **Exportar** (`/api/export.xlsx|.csv`): a mesma consulta e o mesmo escopo da tela, 24 colunas, nome do
  arquivo com os filtros, e auditoria (`exportar`) com linhas, filtros e escopo. O .xlsx é escrito à
  mão (ZIP + CRC32 próprios) e sai ~2,3× menor que o CSV.

### Base B
- Tudo recalculado no navegador sobre `D.leads` (vetores) a cada filtro: base, impulso, fluxo,
  vendedor, sinal, etapa do funil, período (dia do disparo em Brasília), dia do calendário e busca.
- Colunas "leads disparados por semana" agrupadas a partir da segunda-feira em horário de Brasília.
- Top 8 vendedores, clicável: clicar **filtra** o painel inteiro pelo vendedor; clicar de novo desfaz.

## Decisões e porquês

- 11/09/2026 (Base A) — Tempo de atendimento fica fora dos KPIs de gestão: com a conversa aberta ele
  cresce sozinho (mediana ~306 h na carga histórica). Use 1ª resposta e tempo médio.
- 14/09/2026 (Base A) — "Equipe é o funil, não o número de entrada": até ali o supervisor da Equipe 1 via
  147 negócios da Equipe 2 e deixava de ver 799 da própria equipe.
- Meta de 15 min e faixa acima de 45 min vêm do escopo do projeto (`docs/ESCOPO.md`): na base
  inicial, 51,1% dentro da meta e 1.761 negócios acima de 45 min.

## Pegadinhas

- **Funil ordenado por volume** (`ORDER BY total DESC`): a rampa ordinal acompanha o volume, não a
  posição real da etapa, embora a nota diga "tom acompanha o avanço". Se for corrigir, ordene pelas
  etapas do pipeline.
- **Período em UTC no front**: `aplicarPeriodo` usa `toISOString().slice(0, 10)`; entre 21h e
  meia-noite de Brasília o período anda um dia. Calcule o dia com `America/Sao_Paulo`.
- **Busca sem `LOWER`** em `filtro()`: no Postgres o `LIKE` diferencia maiúscula. O histórico de
  acessos já usa `LOWER` dos dois lados.
- A API sem `destino` devolve tudo; o padrão "Válidos" é do front.
- Base B: rosca e minigráfico leem a cor na hora de desenhar — não trocam ao alternar o tema até o
  próximo redesenho (as colunas usam classe e acompanham).

## Testes e verificação

- Base A: `testar-permissoes` (escopo por papel, facetas, CSV recortado), `testar-inconsistencias`,
  `testar-planilha` (xlsx: ZIP, CRC, datas no fuso, paridade com o CSV), `testar-auditoria`
  (registro da exportação), `testar-telas` (matriz por papel, contra o harness).
- Base B: detector de transbordo em 5 larguras.

## Arquivos

- Base A `src/api/consultas.js` — `filtro`, `resumo`, `serieDiaria`, `funil`, `porStatus`, `porCanal`,
  `opcoesFiltro`, `listarNegocios`; `src/api/rotas.js` — `/api/painel`, export; `src/api/planilha.js`;
  `public/app.js` — `renderKpis`, `renderGraficos`, filtros; `public/charts.js`.
- Base B `modelos/dashboard_disparo.html` (tela Visão geral, filtros `F`), `gerar_dashboard.js`.
