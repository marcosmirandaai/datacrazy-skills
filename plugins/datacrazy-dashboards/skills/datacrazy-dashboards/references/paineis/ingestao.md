# Ingestão (saúde da extração)

Projeto: Painel Base A (aba Ingestão; botão "Extrair agora") · Atualizado em 13/10/2026.
Na Base B não há aba: o log de `atualizar.js` e a tabela `painel_execucoes` no Neon fazem esse papel.

## A pergunta que o painel responde

Os números da tela estão em dia? Quando foi a última rodada, o que ela leu, o que falhou, que número
de WhatsApp caiu e quantos negócios esperam leitura de mensagens.

## De onde vem cada número

- `execucoes` (uma linha por rodada: tipo, status, início/fim, duração, páginas, lidos, novos,
  atualizados, inalterados, mensagens lidas/pendentes, requisições, erros, mensagem-resumo,
  `pulsacao_em`).
- `falhas` em aberto por etapa; `conexoes` (`GET /instances`: `api_oficial` = existe `config.wabaId`,
  `status`, `ativa`).
- Negócios com mensagens pendentes = linhas sem assinatura (adiadas pelo teto).

## Como é montado

- Os dados chegam com `/api/painel` (`statusIngestao`, só para quem gerencia) e há
  `GET /api/ingestao`. Cartões: Base (negócios, via API, via planilha, conversas sem negócio, última
  gravação), Última rodada, Falhas em aberto, Conexões ("API Oficial" e no ar). Avisos: números fora do
  ar; N negócios com mensagens pendentes. Tabela das 10 últimas execuções com o tipo traduzido.
- **Extrair agora** (admin e supervisor): rodada viva → 409; no servidor local roda no próprio processo
  (202); na Vercel grava um pedido em `pedidos_extracao` (202 com `pedido`; segundo clique com pedido
  na fila → 409). O job `pedidos` da VPS (`node src/cli.js pedidos`, `*-*-* 07..22:0/2`) pega a fila
  inteira (vários cliques = uma rodada) e roda `manual` com teto 600 (`TETO_DO_BOTAO`); resultado
  `rodou`/`falhou`/`dispensado` (outra rodada viva cobriu). O front acompanha
  `/api/ingestao/disparo?pedido=N` (10 s na fila, 30 s rodando; avisa se a fila não andar em 6 min) e
  mostra sucesso/falha pela linha de `execucoes` aberta depois de `atendido_em`. Auditoria
  `disparar_ingestao`, alvo `vps`. Polling a cada 2 min não custa Neon: a rodada do Matrícula (mesmo
  banco, a cada 5 min) já o mantém acordado.
- **Agendadas:** timers da VPS (ver Decisões). A rota `/api/ingestao/agendada`, o `CRON_SECRET` do
  Dashboard e o disparo pelo GitHub saíram em 13/10/2026 (PR #19).

## Decisões e porquês

- 11/09/2026 — Ingestão fora da Vercel: só os índices levam ~73 s, a função tem `maxDuration` 30 s, e o
  cron do plano hobby roda 1×/dia.
- 13/09/2026 — O `schedule` do GitHub criou 3 de 11 rodadas, com até 55 min de atraso (a das 03:12 saiu
  às 08:45): cron externo como principal, `schedule` só de reserva com `--se-faltar`.
- 10/10/2026 — Actions bloqueado pela cobrança da conta: workflow desligado e ingestão movida para
  tarefas agendadas do Windows no PC. 11/10/2026 — Ingestão movida para a VPS (projeto `painel-base-a`): `horaria` em `*-*-* 07..22:12` e `consolidacao` às 03:12,
  ambas com `--se-faltar` (1024M/50 min e 1536M/2 h); as tarefas do Windows ficaram desativadas. A VPS
  puxa o `main` sozinha de 30 em 30 min (desde 11/10/2026). Por algumas horas PC e
  VPS rodaram juntos (PC no minuto :01, VPS no :12) — o `--se-faltar` não segura rodadas espaçadas mais
  que a janela.
- 13/10/2026 — "Tirar tudo do GitHub Actions" (pedido do usuário): botão Extrair agora vira fila no
  banco atendida pela VPS; somem `disparo-github.js`, `ingestao.yml`, a rota agendada e a automação
  do CRM que a chamava (já inativa na conta). Fila no banco em vez de webhook na VPS: a VPS não recebe chamada de fora e não roda servidor web.
- Janela contra repetição: horária é dispensada por qualquer rodada nos últimos 40 min; consolidação,
  só por outra consolidação nas últimas 20 h.

## Pegadinhas

- Uma única conversa "sem conexão conhecida" no status cortado marca o índice como incompleto e, em
  10/10/2026, adiou ~1.700 negócios por rodada (40 buscas avulsas e o resto para depois).
- Rodada que morre deixa `executando`: a próxima marca como `interrompida` quando a pulsação passa de
  15 min.
- Não edite nem troque de branch na pasta que roda a ingestão agendada enquanto `cli.js ingest` está
  rodando: trabalhe em worktree.

## Testes e verificação

- `testar-disparo.mjs` (fila sem rede: travas de papel, 202 e auditoria, 409 com pedido ou rodada,
  VPS atende, sucesso/falha/dispensado, local sem fila, rotas antigas 404), `testar-agenda.mjs`
  (17 rodadas, `CRON_HORAS`, janelas), `testar-sincronizacao.mjs` (rodada viva, interrompida, tipos).

## Arquivos

- `src/api/rotas.js` — `/api/ingestao*`; `src/ingest/pedidos.js` — `pedirExtracao`, `atenderPedidos`,
  `concluirPedidos`, `situacaoDaExtracao`; `src/agenda.js`; `src/scheduler.js`; `src/cli.js`
  (`ingest`, `pedidos`); tabela `pedidos_extracao` nos dois schemas.
