# Arquiteturas: servidor vivo (Base A) ou retrato estático (Base B)

Dois jeitos de pôr um painel no ar em cima do Datacrazy, os dois em produção. Escolha pelo uso, não
pelo gosto.

## Conteúdo
1. Quando escolher cada um
2. Base A: servidor + SPA + ingestão
3. Base B: sync local + gerador + retrato
4. Banco em dois dialetos (Base A)
5. SQLite como cache do CRM (Base B)
6. Neon
7. Vercel
8. Onde a ingestão roda

## 1. Quando escolher cada um

| Pergunta | Servidor vivo (Base A) | Retrato estático (Base B) |
|---|---|---|
| Quantas pessoas e papéis? | muitos, com recorte por pessoa/equipe | poucos (supervisor/admin), todos veem o mesmo |
| Frescor | de hora em hora | quando alguém roda a rotina |
| Ações na tela (escala, ponto, acessos, disparar rodada) | sim | não (só leitura) |
| Cálculo | SQL no servidor a cada pedido | tudo pronto no retrato; o navegador filtra e recalcula |
| Volume | ~27 mil negócios, 19 mil conversas | ~18 mil negócios, 2.912 leads da campanha embutidos |
| Custo de operação | ingestão agendada + banco consultado | rotina na máquina + uma linha no Neon |
| Relatório/PDF | não | sim (página estática + Chrome headless) |

Painel novo num projeto que já existe segue o desenho do projeto. Projeto novo: comece pelo retrato se
for leitura para poucos; vá de servidor quando houver recorte por pessoa, ação na tela ou frescor de
hora em hora.

## 2. Base A: servidor + SPA + ingestão

```
cron externo / automação do CRM / tarefa agendada
   → rodada de ingestão (src/cli.js ingest --tipo horaria|consolidacao)
   → API Datacrazy → Postgres (Neon)
SPA (public/) → /api/* (api/index.js na Vercel; servidor-local.js no PC) → consultas SQL → JSON
```

- **Sem framework, sem build:** Node ≥ 22.5, ESM, uma dependência (`pg`). O front são ES modules
  servidos crus (`app.js` + módulos por área: `charts.js`, `atendimento.js`, `acessos.js`,
  `impulsos.js`, `assistente.js`, `dialogos.js`).
- **Roteador único independente do transporte:** `tratarApi(url, ctx)` com
  `ctx = { metodo, cabecalhos, corpo, ip, dispararIngestao, agora, semEspera }`. O servidor local e a
  função da Vercel chamam a mesma função; os testes também, sem HTTP.
- **Consultas em `src/api/consultas.js`:** cada página tem uma função agregadora que roda as consultas
  em paralelo (`Promise.all`) e devolve um JSON pronto para desenhar. Tudo passa por `filtro()` (escopo
  obrigatório).
- **Domínio em `config.js` (`dominio`):** ids de pipeline, regras de equipe, tags de atendente,
  categorias de tag, instâncias e corpos ignorados. Regra de negócio fica ali, não espalhada.
- **Erros:** 4xx com `{ erro, detalhe }` dizendo o que fazer; "pular" (rodada desnecessária) é 200.

## 3. Base B: sync local + gerador + retrato

```
CRM (REST + MCP) → sync.js → SQLite data/datacrazy.db
  → relatorio_disparo.js (tabelas disparo_*) → gerar_dashboard.js / gerar_pagina_disparo.js
  → publicar_neon.js (retrato numa linha) → site estático na Vercel lê /api/dados
```

- `atualizar.js` roda a rotina inteira em ordem (cadastros → leads/negócios completos → atividades,
  conversas, vínculos → mensagens → erros REST → histórico → mensagens dos vendedores → impulsos →
  relatório → páginas → Neon → site); passo obrigatório que falha interrompe tudo. `--rapido` pula os
  lentos. Log em `data/atualizacao-AAAA-MM-DD.log` (data de Brasília).
- O retrato e o registro da rodada vão ao Neon **na mesma transação**: o painel nunca vê retrato novo
  sem a rodada registrada.
- O que vai ao Neon é só o retrato (inclui nome, telefone e resumo de quem respondeu) e o controle de
  acesso; o cache do CRM nunca sobe. Repositório privado por isso.
- LGPD pesou contra servidor fora do Brasil: Vercel em gru1, Neon em sa-east-1, rotina na máquina.

## 4. Banco em dois dialetos (Base A)

- Postgres quando existe `POSTGRES_URL || DATABASE_URL || NEON_DATABASE_URL`; senão SQLite
  (`DB_PATH`). Os testes e o harness zeram essas variáveis antes de qualquer import do projeto.
- Interface comum: `consultar`, `um`, `executar`, `inserirRetornandoId`, `bruto`, `transacao`,
  `colunasDe`, `fechar`, `dialeto`, `diaLocal`.
- SQL escrito com `?`; `paraPlaceholdersPg` troca por `$n` respeitando literais.
- **Dia local:** SQLite `date(col, '-3 hours')`; Postgres
  `((((col::timestamptz) AT TIME ZONE 'America/Sao_Paulo')::date)::text)` — o `::text` impede o `pg` de
  devolver `Date` à meia-noite no fuso de quem roda. Datas são TEXT ISO-8601 UTC nos dois.
- Postgres: parsers de DATE/TIMESTAMP devolvem texto; `numerizar` converte número em texto para número,
  menos `telefone` e `id`; TLS verificado; pool `max 3`, `pool.on('error')`.
- **Migração sem passo manual:** o schema inteiro (`CREATE … IF NOT EXISTS`) e depois `migrar()` com
  `ALTER TABLE ADD COLUMN` para cada coluna nova (índices de coluna migrada também ali). `schema.sql` e
  `schema.pg.sql` só diferem em `REAL`↔`DOUBLE PRECISION` e `AUTOINCREMENT`↔`IDENTITY`.
- **Gravação em lote:** upsert de 400 linhas por instrução (49 colunas × 400 = 19.600 parâmetros, contra
  o teto de 65.535), deduplicando no lote; 15 mil idas viraram 11,5 s.
- **Pegadinha:** durante uma transação no Postgres, o cliente fica numa variável do módulo — toda query
  do processo vai para ele enquanto ela dura.
- Funções de janela (`LEAD() OVER`), CTE e `GROUP BY` sobre expressão funcionam nos dois; prove com o
  teste em PGlite antes de confiar.

## 5. SQLite como cache do CRM (Base B)

- `node:sqlite`, WAL, `synchronous NORMAL`, `busy_timeout 30000`.
- Datas em texto ISO UTC como vêm da API; Brasília com `datetime(col, '-3 hours')`; booleanos 0/1.
- `raw_json` sanitizado em toda tabela principal (remove `config`, `webhook`, `token`, `apiKey`,
  `password`, `secret`…), consultável com `json_extract`.
- `upsert(tabela, linha, pk, { keep })`: as colunas de `keep` usam `COALESCE(excluded.x, x)` — uma fonte
  (MCP) não apaga o que a outra (REST) gravou.
- Views para leitura (`vw_leads` pivota `utm_*`; `vw_negocios`, `vw_conversas`…). Consultas com
  `query.js` (não há `sqlite3` nem Python na máquina).
- Tabelas do relatório são recriadas a cada rodada (`DROP TABLE`); a de excluídos é acumulada.

## 6. Neon

- Host `-pooler`; pool pequeno; o endpoint suspende após 5 min ocioso (compute 0,25 CU) — trate o erro
  do pool.
- Papel de aplicação com permissão mínima **criado por SQL**: papel criado pela API do Neon entra em
  `neon_superuser` e ignora as permissões.
- O `.env` local da Base A aponta para o Postgres de **produção**: nada de abrir a tela, rodar teste de
  tela ou script de manutenção sem saber para onde ele aponta.

## 7. Vercel

- **Base A:** `vercel.json` com `framework: null`, `outputDirectory: "public"`, região gru1, e rewrite
  de `/api/:caminho*` para `/api/index?__caminho=:caminho*` — o catch-all `api/[...rota].js` só recebia
  rotas de um segmento em produção. O arquivo do servidor local não pode se chamar `server.js` (a
  Vercel o trataria como entrypoint). `.vercelignore` tira `data/`, `logs/`, `docs/`, `scripts/` e
  `.env*`. `maxDuration` 30 s: nada de ingestão aqui.
- **Base B:** `montar_site.js` monta `site/` (ignorado pelo git) e `publicar_site.js` publica de uma
  cópia em pasta temporária — publicado de dentro do repositório, a CLI manda o autor do commit e a
  Vercel bloqueia (23/09/2026). Cabeçalhos `noindex`, `no-store`, `no-referrer`, `DENY`.
- Comandos da CLI pedem o time: `--scope <seu-time>` (sem ele, "Deployment
  belongs to a different team"). Ver `verificacao-e-operacao.md`.

## 8. Onde a ingestão roda

- Ingestão longa não cabe em função serverless. Ordem de preferência que vivemos:
  1. GitHub Actions (`workflow_dispatch` + `concurrency`, timeout 90–180 min) disparado por cron
     externo — **parou em 10/2026 nos dois projetos**: na Base B acabaram os minutos do repositório
     privado; na Base A a cobrança da conta passou a barrar todos os jobs;
  2. tarefa agendada do Windows na máquina do responsável (ponte de 10/10/2026; a rodada morria quando a
     janela fechava ou o PC dormia);
  3. VPS própria com rotinas — **estado atual dos dois projetos** desde
     11/10/2026 (systemd timer por job, fila, limite de memória e de duração, alerta de falha).
- Qualquer que seja o lugar: uma rodada por vez (linha `executando` + pulsação), `--se-faltar` para não
  repetir, log em arquivo, e a tela de Ingestão (ou o log) dizendo se os números estão em dia.
