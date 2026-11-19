# Atendimento (plantão)

Projeto: Painel Base A (aba Atendimento, `public/atendimento.js`) · Atualizado em 23/10/2026

## A pergunta que o painel responde

Quem está na escala de cada área e quem está **recebendo lead agora** — e, para o atendente, o que
falta fazer para começar a receber (ponto → fila → rotina). A distribuição automática do CRM consulta
esta mesma resposta.

## De onde vem cada número

| Dado | Fonte | Quem decide |
|---|---|---|
| Quem é de cada departamento | CRM (`/messaging/departments`, atendentes do departamento), sincronizado a cada rodada | o CRM manda na lista |
| Aptidão (está na escala) | tabela `atendimento_aptidao`, por departamento | supervisão |
| Status (recebendo/pausado) | `atendimento_status`, um por pessoa (vale para todas as áreas) | a própria pessoa |
| Ponto do dia | `atendimento_ponto` | a pessoa (ou a supervisão por ela) |
| Jornada (entrada, almoço, volta, saída) | `atendimento_jornada`, só cresce; histórico sem tela | a pessoa ou a supervisão |
| Rotina da pessoa | `atendimento_status.rotina` | só a supervisão (atendente lê) |
| Rotinas salvas | `atendimento_rotina_modelos`, uma por departamento | supervisão |
| Bloqueado | flag do cadastro do CRM | o CRM |
| Sequência sem atendimento | `atendimento_distribuicoes` (avisos da automação de distribuição) | regra dos 5 |

## Como é montado

- `GET /api/atendimento` → `plantao()`: uma linha por par departamento × atendente, sempre derivada de
  `departamento_atendentes` com JOIN em aptidão, status, ponto do dia e pessoas. Fichas duplicadas da
  mesma pessoa são agrupadas pelo nome canônico, com `MAX(bloqueado)`.
- Escritas (sessão): `POST /api/atendimento/ponto`, `/rotina`, `/status` (ligar exige o ponto de hoje
  → 409 com `falta: 'ponto'`; motivo até 140 caracteres) e `/aptidao` (409 se a pessoa não está no
  departamento no CRM).
- **Situação agora** (`situacaoAgora` em `src/plantao.js`), em camadas: ponto do dia → "na mão" vale até
  a próxima virada da rotina (ou meia-noite) → rotina. A pausa automática não é religada pela rotina.
  Fuso fixo −03:00.

| Situação | Classe | Rótulo |
|---|---|---|
| `sem_ponto` | neutro | Sem ponto hoje |
| `aguardando` | neutro | Fora da fila |
| `rotina` / `manual` | ok | Recebendo leads |
| `fora_da_rotina` | neutro | Fora do horário |
| `pausa_manual` | alert | Pausado |
| `pausa_automatica` | alert | Pausa automática |
| bloqueado | alert | Bloqueada no CRM |
| não apto | neutro | Fora da escala |

- **Rotas novas (13/10/2026):** `POST /api/atendimento/jornada` {evento: entrada | pausa_inicio |
  pausa_fim | saida} — entrada bate o ponto; saida põe origem `encerrado` → situação `dia_encerrado`
  (a rotina não religa no dia; dá para reabrir). `/rotinas` (GET/POST, `?departamento=`),
  `/rotinas/{id}` (PATCH/DELETE), `/rotinas/{id}/aplicar` (só quem é do departamento da rotina),
  `/rotinas/{id}/copiar` (para outro departamento), `/sincronizar`. `/rotina` dá 403 para atendente.
- **Perfil de atendente (13/10/2026):** sem Exportar (menu some e `/api/export.*` dá 403 — flag
  `exportar` em PAPEIS); bloco Jornada no Meu plantão (Bater ponto → Pausa para o almoço / Voltar →
  Finalizar o dia → Reabrir); rotina só leitura. Botão da fila: tabela estado → botões, toda situação
  tem a ação contrária visível (o bug era o botão sumir sem área na escala).
- **Supervisão (13/10/2026):** cartão "Rotinas da equipe" agrupado por departamento (Nova rotina,
  Aplicar a pessoas, editar, copiar para…, apagar); colunas Jornada e Rotina na tabela; por pessoa:
  bater ponto, pausar/liberar, tirar/pôr na escala, finalizar/reabrir o dia. Nome de rotina é único
  só dentro do departamento.
- **Sincronizar participantes (13/10/2026):** botão ao lado do seletor de departamento. Lê com prazo
  (8 s pessoas, 18 s departamentos — a Vercel corta em 30 s), grava por diferença numa transação, roda
  `sincronizarPlantao` e `sincronizarAcessos` como a rodada; convites por clique limitados (1 com
  Neon, 13 com Resend); 409 com rodada ativa. A rodada passou a usar o mesmo caminho: lê tudo antes,
  grava tudo ou nada.
- **Tela:** cartão "Meu plantão" (ponto → fila → rotina; o passo que falta tem a borda da marca); KPIs
  Recebendo agora, Ponto batido hoje, Pausados, Fora da escala; filtros só no cliente (departamento,
  pessoa, chips Todos/Recebendo/Fora do ar); um cartão por departamento com Pessoa · Escala · Ponto ·
  Agora · Rotina · ação. Releitura a cada 60 s com a página visível e nenhum diálogo aberto. Sem
  barra de filtros comerciais e sem Exportar.
- **Assistentes:** Montar escala (2 passos, lista quem sai, inclusive quem está recebendo), Pausar
  (Almoço, Intervalo, Reunião, Treinamento, Atestado, Outro, Sem motivo), Rotina (dias → horário →
  conferir; modelos Comercial 08–12/13–18, Manhã, Tarde, Noite 18–22, Outro). Editar a rotina
  continua na grade.
- **Aviso de "Ficar online" (05/11/2026, PR #67):** bater o ponto não liga a chave — a pessoa fica
  "Recebendo · rotina" e, em área com *online primeiro*, fica atrás de quem ligou a chave (05/11: Atendente A
  bateu às 08:23, Atendente B ficou online às 09:10 e levou 41 leads). `GET /api/atendimento` leva
  `online_primeiro` em cada departamento; o Meu plantão mostra "Ficar online" + "Pausar" na Fila e um aviso
  uma vez por dia, com a caixa "Não mostrar mais" (localStorage `aviso-online`, por nome). Presença do CRM
  (bolinha cinza) não entra no sorteio — dúvida que a equipe teve no grupo.
- **Ponto liga o online (05/11/2026, PR #69):** desde esta PR, `baterPonto` grava a chave `manual` ligada;
  voltar da pausa e reabrir o dia também (antes: origem `jornada`, que não era online). `online` = recebe agora
  **e** ligou a chave na mão hoje (`ligouHoje`), então não cai na virada da rotina. "Na rotina" sobra para quem
  pausou e a rotina religou. Motivo: Atendente L, única online no Comercial, levou 24 leads seguidos (os não atendidos
  voltavam para ela). Com isso o aviso da PR #67 só aparece nesses casos de rotina religada.
- **Limite de leads por pessoa (06/11/2026, PR #70):** regra da área ganha `limite_leads` e `limite_janela_min`
  (passo "Limite" no assistente; 0/vazio = sem limite). `cheiosNaJanela` conta `atendimento_distribuicoes` da
  área nos últimos X min (sem `redistribuido`); cheios saem antes de `candidatosDaVez` — online cheios → rotina;
  todos cheios (até uma pessoa só) → 409 "todos no limite" com `tentar_em`, sem IA. O fluxo do CRM já repete o
  sorteio a cada ~15 min no 409. Motivo: 40 leads da noite numa pessoa só (Atendente C, 08:33–09:24 de 06/11).
- **Distribuição dos leads (16/10/2026):** cartão da supervisão, uma regra por área
  (`src/api/distribuicao.js`, `public/distribuicao.js`): *online primeiro* (quem ligou "recebendo
  lead" na mão — `situacao.codigo = manual` — antes de quem está só no turno, `rotina`; sem ninguém
  online, a rotina) ou *juntos*; divisão *por igual* (menos leads hoje) ou *por percentual* (soma 100,
  reescalada entre quem recebe; vai para quem está mais atrás da parte nos sorteios de hoje da área).
  Uma pessoa só recebendo leva tudo. O sorteio segue a regra; o rótulo da linha virou "Recebendo ·
  online" / "Recebendo · rotina".
- **Cartões recolhíveis (17/10/2026):** Rotinas da equipe, IA na distribuição e Distribuição dos leads abrem e fecham pelo título (`public/recolher.js`, `data-recolher` + `.cartao-alternar` + `.cartao-corpo`); nascem fechados e lembram o estado no localStorage do navegador. Pedido do responsável: com muitas áreas, empurravam o plantão para baixo.
- **Promoções do follow-up (28/10/2026, PR #51):** cartão recolhível da supervisão (`src/api/promocoes.js`, `public/promocoes.js`, tabela `atendimento_promocoes`). Por área: nome, cupom (o código do ERP do cliente, só `A-Z0-9_-`), modo *retomada* (mensagem da 1ª/2ª/3ª retomada; em branco = não oferece) ou *sortear* (até 10, uma ao acaso por consulta). As mensagens orientam a IA, não são texto pronto. Uma ativa por área (ativar desativa as outras). Auditoria `promocao` no grupo "atendimento". O follow-up do CRM lê `GET /api/atendimento/promocoes/vigente?departamento=&retomada=` com a chave de **leitura** (`token_plantao`): 200 `{cupom, mensagem, mensagem_numero, modo, promocao}`; 404 = retomada sem oferta (saída de erro do bloco = segue sem cupom). Passo a passo do fluxo em `docs/crm/PROMOCOES.md`; o cupom chega ao ERP pelo `cupom` do `criar_matricula` (MCP de matrícula).
- **Follow-ups e promoções em passo a passo (31/10/2026, PR #58):** o cartão mudou de nome e tem duas portas, *Cadastrar follow-ups* e *Nova promoção*; áreas sem cadastro viram uma linha só. Telas: área → oferta → voucher e em qual follow-up (`voucher_em`: `1`, `2`, `3`, `ia`, ou `nenhum` nos só de follow-ups) → 1º, 2º e 3º, cada um com "Pular: a IA decide" → conferir. O nome sai da oferta. No `vigente`, cadastro novo ganha `oferta`, `voucher_em`, `ofertar_voucher`, `ia_escreve`; `mensagem` nunca vem vazia num 200 (o fluxo a põe direto no prompt); `cupom` vem `""` antes do follow-up da oferta e preenchido dele em diante, porque o lead ainda pode aceitar; pulado sem voucher = 404, a retomada de sempre. `voucher_em` nulo = cadastro antigo, regras de antes até ser editado.
- **Liberar todos / Pausar todos (23/10/2026):** botões no cabeçalho de cada área (supervisão, no alcance). POST /api/atendimento/em-lote {departamento, acao: liberar|pausar, motivo?}: liberar põe na escala, bate o ponto e liga a chave (manual = online) de quem falta, pula bloqueado no CRM; pausar tira da fila quem recebe. Auditoria por pessoa (definir_aptidao, bater_ponto, definir_status "… · em lote") em nome de quem clicou, mais plantao_em_lote com o resumo.
- **API do painel (16/10/2026, só admin):** página própria no menu (`#pagina-api`, item "API", visível com `PAPEIS.integracoes`; o estado das chaves vem de `GET /api/atendimento/chaves`, 403 para os outros papéis). Substituiu o cartão "Consulta do CRM" do Atendimento por uma referência no
  formato do docs.datacrazy.io (`public/api-referencia.js`): rotas à esquerda, página com método,
  caminho, chave, parâmetros, "na resposta", e painel escuro com cURL/JavaScript/Python e as respostas
  por status. As rotas e exemplos vivem no arquivo — mudou rota no servidor, muda lá.
- **Fora da ferramenta (16/10/2026, PR "fora-da-ferramenta-e-carteira"):** da supervisora de equipe
  para cima, no alcance. `POST /api/atendimento/fora` grava `atendimento_fora` (departamento × pessoa):
  some do plantão, da leitura por chave e do sorteio, sai da escala (`/aptidao` dá 409 enquanto estiver
  fora), a supervisora de equipe deixa de alcançá-la, e o acesso automático não conta a área. Sem área
  nenhuma: chave pausa ("Fora da ferramenta") e o acesso de atendente desliga com `gerido_pelo_crm = 0`
  (a rodada não religa). Tabela do painel → **a sincronização com o CRM não traz de volta**; só
  `/fora/devolver`. Cartão "Fora da ferramenta" e links "carteira · transferir · tirar da ferramenta" na
  linha.
- **Carteira do consultor:** `GET /api/atendimento/carteira.xlsx?atendente=` (supervisão que exporta),
  abas Negócios e Conversas sem negócio. Critério: dono do card no CRM (`atendente_negocio`) **ou** quem
  o painel conta (`atendente_efetivo`) **ou** quem recebeu por transferência (`atendente_atual`), coluna
  `vinculo`; recorte de quem baixa. Conta como `exportar` na auditoria.
- **Transferência de carteira (16/10/2026, PR "transferir-carteira"):** quem recebe (gente das áreas,
  fora quem saiu) e o que entra (etapas; conversas todas ou dos últimos 7/30/90 dias) → divisão por igual
  (cada item para quem tem menos; a conversa vai com o negócio). O site grava o pedido
  (`carteira_transferencias`); o job `transferencias` da VPS lê o **CRM** para a prévia (varredura de
  negócios, `/conversations?filter[attendants]=` por status aberto), espera a **confirmação explícita**,
  relê e troca: `PATCH /businesses/{id}` `{attendantId}` (id do CRM, um a um) e
  `POST /messaging/conversations/change-attendant` (id do multiatendimento, lotes de 50). Item a item em
  `carteira_transferencia_itens` (pendente/feito/pulado/erro, com motivo), retomável pelo pulso.
  Histórico congelado antes da primeira troca (ver `references/medicao.md` § 4). Desfazer = nova
  transferência de volta. Estimativa instantânea pelo painel; número exato só na prévia.
- **Integração:** a automação de distribuição do CRM consulta `GET /api/atendimento` com
  cabeçalho `Authorization` (chave `ATENDIMENTO_TOKEN`, só leitura — o navegador nunca manda esse
  cabeçalho, então sessão não cai ali por acidente) e avisa a quem deu cada lead em
  `/api/atendimento/avisos/…` com outra chave, de escrita (`ATENDIMENTO_AVISOS_TOKEN`): um "não
  atendido" pode tirar alguém da fila. Contrato em `docs/crm/AVISOS-DA-DISTRIBUICAO.md`.

## Decisões e porquês

- Aptidão por departamento, status por pessoa: quem sai para o almoço sai de todas as áreas; a escala
  de cada área é decidida por quem responde por ela.
- Cores: verde = recebendo; vermelho = precisa de uma pessoa (pausado, pausa automática, bloqueado);
  cinza = o relógio ou o ponto resolvem. "Pausado" e "fora da escala" se resolvem por pessoas
  diferentes, então não partilham rótulo nem cor.
- 04/10/2026 — Prazo do "não atendido": 1 h; limite de 5 leads seguidos sem atendimento
  (`PLANTAO_LIMITE_SEM_ATENDIMENTO`); alerta de risco a `max(2, limite − 2)`.
- 01/11/2026 (PR #60) — Substitui a linha acima: 6 seguidos abrem pop-up para a supervisão em qualquer tela
  (`GET /api/atendimento/alertas`) e 11 abrem aviso sério e tiram da fila (`PLANTAO_AVISO_SEM_ATENDIMENTO`,
  `PLANTAO_TIRAR_SEM_ATENDIMENTO`). Em 23–31/10, de 69 pessoa-dia: 30 com 5 ou mais seguidos, 5 com mais de 10
  seguidos e 26 com mais de 10 no total do dia, por isso a conta segue em "seguidos". O "não atendido" chega aos
  15 min (mediana medida), não aos 10.
- Revogar aptidão órfã só com o cadastro lido na rodada. Até 13/10/2026 o `DELETE + INSERT` deixava
  o departamento vazio por um instante; agora é diferença numa transação, mas a regra continua.
- 13/10/2026 — Rotinas valem por departamento (pedido do responsável): incluídas em cada um ou copiadas de
  outra. Aplicar copia a rotina para a pessoa; mudar ou apagar a rotina salva não mexe em quem recebeu.
- Jornada é histórico, não decide a fila: quem decide continua sendo ponto + status + rotina.
- 16/10/2026 — "Tirar da ferramenta" é do painel, não do CRM: a pessoa pode seguir no departamento do
  Datacrazy (quem tira de lá é quem administra o CRM). Por isso a marca mora numa tabela que a
  sincronização não toca.
- 16/10/2026 — Transferir é pedido na fila, não chamada direta: ~1.400 PATCH a 60/min passam de 20 min e a
  Vercel corta em 30 s. Prévia lida do CRM porque o painel não guarda status (ganho/perdido/aberto).
- 16/10/2026 — "Online" é do painel, não do CRM: o responsável escolheu a chave ligada na mão, e não a
  bolinha verde do Datacrazy (`GET /crm/presence/online`, que existe e devolve os user_id). A
  leitura por chave ganhou `online`/`na_rotina`, `online_agora`/`rotina_agora` e
  `filtro=online|rotina|distribuicao`, para quem quiser montar a escolha no fluxo do CRM.

## Pegadinhas

- "Fulana não aparece na escala" quase sempre é departamento no CRM: em 14/10/2026 a Atendente D estava em
  áreas A, B e C, nenhum no acesso da supervisora (áreas D e E). Entrou na área E do Datacrazy e apareceu na rodada seguinte. A tela agora diz isso acima das áreas.
- `GET /businesses?filter[attendant]=` é ignorado pela API (devolve tudo); `/conversations?filter[attendants]=`
  funciona. As rotas de escrita ainda não foram exercidas contra o CRM real: pilotar com um item.

- Nos fluxos de distribuição havia 23 ids fixos de atendente e os fluxos redistribuíam em 10 min,
  contra a regra de 1 h — o lado do CRM precisa acompanhar (skill `datacrazy-automacoes`).
- Atendente tem id do CRM e id do multiatendimento: a consulta aceita os dois, e e-mail.

## Testes e verificação

- `testar-atendimento.mjs` (relógio, rotina, travas por papel, recorte, consulta por chave, dia inteiro
  com relógio fixo) e `testar-avisos.mjs` (sequência sem atendimento, regra dos 5, idempotência).
- `testar-jornada.mjs` (94: jornada, export 403, rotinas por departamento, cópia, aplicar) e
  `testar-sincronizar-departamento.mjs` (51: papéis, diferença, falha do CRM sem gravar, prazo, 409).
- `testar-carteira.mjs` (papéis, alcance, saída, sincronização que não traz de volta, devolver, planilha)
  e `testar-transferencia.mjs` (CRM de mentira por `fetch`: prévia, confirmação, execução, retomada,
  relatórios de setembro iguais antes e depois, desfazer). O harness ganhou uma VPS de mentira que
  atende a fila a cada 5 s.
- `testar-distribuicao.mjs` (escolha sem banco — 50/30/20 em 20 leads dá 10/6/4 —, papéis,
  validação da soma, online primeiro no sorteio, filtros da leitura por chave).
- Tela: `npm run harness:plantao` (o Comercial vem com online primeiro e 40/20/25/15) (com um CRM de mentira: Atendente A entra no Comercial ao
  sincronizar) monta todas as situações em volta da hora em que sobe.

## Arquivos

- `src/api/atendimento.js` — `plantao`, rotas de escrita, consulta e avisos; `src/plantao.js` —
  `situacaoAgora`, `normalizarRotina`, `descreverRotina`; `src/ingest/atendimento.js` —
  `sincronizarPlantao`; `public/atendimento.js`; `src/api/distribuicao.js` + `public/distribuicao.js` (regra por área);
  `public/api-referencia.js` (referência da API); `scripts/harness-plantao.mjs`;
  `src/api/carteira.js` + `public/carteira.js` (fora da ferramenta e carteira);
  `src/api/transferencias.js` + `src/ingest/transferencias.js` + `public/transferencias.js` (transferência).
