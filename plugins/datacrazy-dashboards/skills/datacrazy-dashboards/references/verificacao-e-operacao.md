# Verificar, publicar e operar

## Conteúdo
1. Regra de ouro: nada de tela contra a produção
2. Testes (Base A)
3. Conferir a tela no navegador
4. Fluxo de trabalho: worktree, PR, merge
5. Publicar na Vercel
6. Agendar a ingestão
7. Escrever código, comentário, commit e documentação
8. Segurança de credenciais e de dados

## 1. Regra de ouro: nada de tela contra a produção

O `.env` do Painel Base A aponta para o Postgres de **produção** (Neon), e `npm start` também sobe o
agendador de ingestão. Abrir a tela com ele é mexer em dado real de aluno para conferir alinhamento de
botão, e uma rodada real leva perto de uma hora e gasta a cota da API.

- Tela: harness local com base sintética (abaixo).
- Teste: banco descartável (SQLite) ou Postgres em memória (PGlite).
- Leitura de produção só agregada e com motivo; se o classificador de permissões barrar uma leitura de
  produção, pare — não contorne.

## 2. Testes (Base A)

- Um arquivo por assunto, `scripts/testar-<assunto>.mjs`, com `npm run test:<assunto>`; saída
  `  ok  ` / ` FALHA` e `exit 1` se houver falha. Docblock com a lista do que a suíte prova. Testes
  escritos a partir do caso real (datas e números da base).
- **Banco descartável:** antes de qualquer import do projeto, zere `DATABASE_URL`, `POSTGRES_URL`,
  `NEON_DATABASE_URL`, aponte `DB_PATH=./data/teste-<suite>.db` e defina um `SESSION_SECRET` de teste;
  os imports do projeto são **dinâmicos** (`await import`) — o import estático rodaria antes, o
  `config.js` leria o `.env` e o teste cairia na produção. Apague `.db`, `-wal`, `-shm` no início e no
  fim.
- **Sem HTTP:** chame `tratarApi(new URL('http://teste' + rota), { metodo, corpo, cabecalhos, agora })`;
  cookie forjado com `criarToken({ id, token_versao })`; relógio fixo em `ctx.agora`.
- **Clientes falsos:** `ClienteFalso` da API (páginas de 2 para forçar empate de `lastMovedAt` na
  virada, teto do skip simulado, `count` 999), `crmFalso` de impulsos, `fetch` falso do GitHub, SMTP e
  Matrícula de mentira.
- **Mesma SQL no Postgres:** exporte o construtor da SQL (`sqlDoRetornoDosDisparos`,
  `sqlDosLeadsDoImpulso`) e rode no PGlite (`@electric-sql/pglite`, dependência de desenvolvimento) —
  os testes de tela rodam em SQLite e a produção é Postgres; CTE, janela, `LIKE` sensível a maiúscula e
  `GROUP BY` sobre expressão divergem.
- **Regras do navegador:** módulo do front que importa só utilitários sem DOM pode ser importado no Node;
  exporte as regras puras (ex.: `_regras = { estagio, segmentos, metricas, trilha }`) e teste.
- **Rode todas as suítes** antes de abrir a PR e de novo antes do merge (em 10/10/2026: 18 suítes, 888
  verificações). `testar-telas` precisa de servidor e login: rode contra o harness
  (`BASE=http://127.0.0.1:<porta> ADMIN_EMAIL=admin@harness.local ADMIN_SENHA=<senha do harness>`),
  nunca contra o `npm start` (produção, e ele cria e apaga usuários).
- Teste que depende do relógio: use o dia de Brasília, não o de UTC — o teste da auditoria falhava toda
  noite das 21h à meia-noite.
- Base B não tem suíte: valida com branch temporário do Neon, detector de transbordo em 5 larguras,
  modo de calibração e conferência por amostra na API.

## 3. Conferir a tela no navegador

- `scripts/harness-plantao.mjs` (Base A): SQLite descartável em `data/harness-plantao.db`, recriado a
  cada subida; segredos de teste; 3 departamentos com todas as situações do plantão; um acesso de cada
  papel (`admin@`, `supervisor@`, `equipe1@`, `atendente@harness.local`, senha no cabeçalho do script);
  base comercial de `scripts/base-sintetica.mjs` (determinística, semente fixa: negócios dos dois funis
  e do suporte, conversas sem negócio, impulsos nos quatro status com público e entrega/leitura,
  conexões com uma caída, rodadas com uma falha).
- Quando o painel novo precisa de dado, **acrescente-o à base sintética** — mantenha determinístico e
  use um sorteador próprio para não mudar o resto da base.
- Para rodar o harness de um worktree, registre uma configuração temporária no `.claude/launch.json`
  com o caminho absoluto do script e outra porta; apague depois.
- **Painel do navegador em segundo plano:** timers ficam lentos (até ~1 por minuto) e capturas de tela
  podem falhar. Prefira avaliações **síncronas** em JavaScript (clicar e ler na mesma chamada), meça o
  layout por script (`scrollWidth`, `getBoundingClientRect`), e neutralize `scrollIntoView` suave só
  durante o teste se a ferramenta engasgar. Captura de tela vale como prova final, quando a janela
  estiver visível.
- Confira: console sem erro, cada interação (abrir, voltar, filtros, teclado, foco), 375 px sem rolagem
  lateral, 1280 px, tema escuro.

## 4. Fluxo de trabalho: worktree, PR, merge

- A pasta principal da Base A roda a ingestão agendada: não edite nem troque de branch nela enquanto
  `cli.js ingest` roda. Trabalhe em worktree (`git worktree add`), com `node_modules` por junção.
- **Uma PR por assunto**; trabalho misturado vira PRs empilhadas. Branch em kebab-case português.
- Merge: ensaie antes (merge local, confira que a árvore resultante é a esperada), rode todas as
  suítes, faça o merge e não apague a branch sem avisar.
- Depois do merge, a produção é publicada pela Vercel a partir do `main`; confira o deploy.

## 5. Publicar na Vercel

- Comandos da CLI pedem o time: `--scope <seu-time>`; `vercel redeploy <id do
  deploy> --scope …` (sem o escopo: "Deployment belongs to a different team").
- **Preview que falha sem log** ("Builds 0 ms", "never reached READY") pode ser passageiro: confira se
  os outros deploys estão bons e reimplante o preview (`vercel redeploy <id> --scope … --no-wait`,
  depois `vercel inspect <url> --wait`). Em 10/10/2026 o preview da PR #18 falhou assim e passou no
  segundo.
- Variáveis: `vercel env ls` mostra só os nomes — use para conferir em qual projeto a variável foi
  parar (`vercel env add` na pasta errada já gravou segredo no projeto errado).
- Base B publica de uma cópia fora do repositório (a CLI manda o autor do commit e a Vercel
  bloqueia).
- Vercel Authentication barra cron externo, automação do CRM e link de e-mail: use o bypass de
  automação quando ligar.

## 6. Agendar a ingestão

- Base A: rodada horária (07–22h, minuto 12) e consolidação (03:12) na VPS (projeto `painel-base-a`, `--se-faltar`).
  Depois do merge, a VPS puxa o `main` sozinha em até 30 min (minutos 07 e 37). Antes: `workflow_dispatch` do GitHub Actions (parado pela cobrança) e, por um
  dia, tarefas do Windows no PC (desativadas). Nunca deixe duas máquinas agendadas ao mesmo tempo.
- Marque fora da hora cheia (minuto 12 ou 17): o `schedule` do GitHub atrasa e pula na hora cheia.
- Toda rodada: uma por vez (linha `executando` + `pulsacao_em`; morta após 15 min), trava de
  plausibilidade antes de gravar, teto de mensagens e de buscas avulsas, resumo no histórico.

## 7. Escrever código, comentário, commit e documentação

- Tudo em português do Brasil: identificadores, mensagens, docs, commits. Números em pt-BR nos textos
  (15.355; 51,1%); datas dd/mm/aaaa nos textos, ISO no código e no banco.
- Comentário explica o **porquê**, com incidente datado e número ("medido em 04/10/2026: 1.465 de
  1.822"). Separadores `/* ── Título ── */`.
- Commit: assunto "Área: o que muda, como resultado", sem ponto final; corpo com problema medido →
  o que muda → testes → como foi conferido; trailer `Co-Authored-By`.
- Docs da Base A: `README.md` (uso e configuração), `docs/ARQUITETURA.md` (seções numeradas, decisões
  com data e medida), `docs/DEPLOY.md`, `docs/DESIGN.md`, `docs/ESCOPO.md`, `docs/crm/*` (lado do CRM).
  Painel novo atualiza a seção dele na arquitetura e, se mexeu em cor, o DESIGN.
- Windows: `process.exitCode` em vez de `process.exit` em scripts que fecham recursos; heredoc do Bash
  estraga barras invertidas de regex — escreva scripts com arquivo e troque texto com função que
  respeita CRLF.

## 8. Segurança de credenciais e de dados

- Token do Datacrazy só do `.env` do projeto, nunca impresso, nunca em linha de comando, nunca colado no
  chat; segredo de CI por stdin.
- Payload cru do CRM pode trazer token de provedor (`instance.config`): enxugue antes de gravar.
- Dado pessoal (nome, telefone, resumo de conversa) só onde o papel precisa; base sintética para teste
  e captura de tela.
- Credencial de teste (harness) fica no script do projeto; não repita em chat.
