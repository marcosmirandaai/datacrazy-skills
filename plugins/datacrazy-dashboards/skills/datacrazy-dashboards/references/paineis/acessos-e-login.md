# Acessos e login

Projetos: Painel Base A (aba Acessos, `login.html`, `src/auth/`) e Relatórios Base B
(`login.html`, `senha.html`, `acessos.html`, `site/middleware.js`, `site/api/*`) · Atualizado em 23/10/2026

## A pergunta que o painel responde

Quem entra, o que cada um enxerga e o que pode fazer — e o histórico do que foi feito. Painel de CRM
mostra dado pessoal de aluno/cliente: o acesso é parte do produto, não detalhe.

## Como é montado (o que os dois têm em comum)

- **Senha:** scrypt (Base A N=32768, r=8, p=1, ~100 ms). Mensagem igual para e-mail inexistente e senha
  errada, e o tempo do scrypt é gasto mesmo assim (hash fictício).
- **Sessão:** cookie `HttpOnly; Secure; SameSite=Lax` de **12 h**, com payload base64url + HMAC-SHA256
  (`SESSION_SECRET` com 32+ caracteres). `token_versao` no usuário: trocar senha, papel ou ativação
  incrementa e derruba as outras sessões.
- **Freio de força bruta:** 5 falhas em 15 min bloqueiam por 1, 5, 15 e depois 60 min, contadas por
  e-mail e por IP.
- **Link de acesso:** 256 bits, só o hash SHA-256 no banco, uso único gasto de forma atômica
  (`update … where usado_em is null`). Convite vale 72 h; entrada por e-mail, 15 min. O token chega no
  fragmento (`#link=`), sai da barra com `history.replaceState` e **só é gasto no clique** — a prévia
  do WhatsApp e antivírus abrem o link antes da pessoa. Pedido de link: 3 por pessoa e 10 por IP a cada
  15 min, resposta igual exista o e-mail ou não (Base A com piso de ~1 s).
- **Link em lote (Base A, 23/10/2026):** caixa de seleção por linha em Acessos (só quem tem "Ajudar a entrar": ativo, não é você, não é admin acima de quem pede), "marcar todos os visíveis" no cabeçalho (filtre "Nunca entraram" e marque) e "Enviar link para N". A tela chama o mesmo POST /api/usuarios/:id/link um por vez, esperando sessao.email.pausaMs entre envios (Neon 5 s, Resend 600 ms) — a função da Vercel tem 30 s, então o laço é no navegador. Diálogo com andamento por pessoa, Parar, e "Copiar os links" quando o e-mail não sai.
- **Travas de acesso:** ninguém se desativa nem se remove; o último admin ativo não sai nem perde o
  papel; senha provisória legível (sem 0/O e 1/l) aparece uma vez.
- **Auditoria:** login, exportação (quem, quando, IP, arquivo, linhas, filtros, escopo), mudanças de
  acesso, disparo de rodada.

## Base A: papéis e recorte

| Flag | admin | supervisor | supervisor_equipe | atendente |
|---|---|---|---|---|
| verTudo | sim | sim | não | não |
| gerenciarUsuarios | sim | sim | não | não |
| gerenciarEquipe | não | não | sim | não |
| remover, auditarBase, integracoes, matricula | sim | não | não | não |
| plantao | todos | todos | equipe | próprio |

- **Supervisor** (papel `supervisor`) vê o grupo inteiro; quem tem recorte é o **supervisor de equipe**
  e o **atendente**. Painéis do grupo inteiro (Impulsos, Ingestão) são de admin e supervisor; os
  outros papéis levam 403. Inconsistências é só admin.
- **Onde a permissão mora no código:** cada rota confere o papel em `src/api/rotas.js`
  (`podeGerenciarUsuarios(usuario)` para Impulsos, Ingestão e Acessos; `podeAuditarBase` para
  Inconsistências; o plantão decide dentro de `src/api/atendimento.js` com `alcanceDoPlantao`) e
  devolve 403; a consulta aplica o recorte com `filtro()` (ou `recorteDosNegocios` nos impulsos) a
  partir de `escopoDoUsuario`. No front, `estado.pode` esconde o item do menu e `podeAbrir` confere de
  novo na navegação — cortesia; o 403 é que protege. Painel novo: rota nova com a mesma checagem, e uma
  linha na matriz de `scripts/testar-telas.mjs`.
- `escopoDoUsuario` devolve SQL: admin/supervisor sem restrição; supervisor de equipe = equipes cujos
  funis são dos seus departamentos, ou negócio fora de toda equipe que entrou pelo número do
  departamento; atendente = `atendente_efetivo IN (nomes)` (estreitado pelo departamento, nunca
  alargado). Sem sessão, papel desconhecido ou recorte vazio → `1 = 0`.
- `filtrosDaUrl` remove `usuario` da query: o escopo vem só do cookie.
- Acesso automático dos atendentes: a rodada cria acesso para quem está em departamento ativo, tem
  e-mail e não está bloqueado (convite por e-mail, uma vez), acompanha saída e volta, nunca suspende
  com cadastro lido pela metade, e respeita o que foi mexido à mão (`gerido_pelo_crm`).
- Tela: tabela (Pessoa, Papel, O que enxerga, Último acesso, Situação), "Novo acesso" em assistente
  (pessoa do CRM → papel → o que enxerga → conferir e entregar), histórico com filtros e paginação.
  13/10/2026: busca (nome, e-mail ou departamento, sem acento), filtros de papel e situação, contagem.
- 13/10/2026 — Salvar um acesso manda só os campos visíveis para o papel: um vínculo de atendente
  escondido ficava gravado (o acesso "Usuário Teste" ganhou a Atendente E assim). Supervisora de equipe pode,
  opcionalmente, ser também atendente ("Também atende como").
- O botão "Sincronizar participantes" (aba Atendimento) também roda `sincronizarAcessos`: quem entra
  num departamento ganha acesso na hora; convites por clique limitados.
- 16/10/2026 — **Fora da ferramenta** (aba Atendimento): sem área nenhuma, o acesso de atendente que é
  só da pessoa é desativado com `token_versao` + 1 e `gerido_pelo_crm = 0`; quem está fora de uma área
  não a recebe no escopo automático. "Devolver" religa com o `gerido_pelo_crm` de antes. A carteira do
  consultor e a lista de uma transferência entram no histórico como `exportar`; tirar/devolver e as
  ações de transferência ficam no grupo do plantão.
- O painel de Matrícula abre em `/matricula` por rewrite externo e confere o mesmo cookie
  (`DASHBOARD_SESSION_SECRET` lá = `SESSION_SECRET` aqui), só para admin — dois deploys, um endereço.

## Base B: middleware sem banco

- `site/middleware.js` roda antes de qualquer arquivo e **não consulta o banco** (o Neon não acorda a
  cada arquivo): cookie válido passa; sem cookie, `/api/*` recebe 401 e o resto vai para
  `/login.html?voltar=`. Sem `SESSION_SECRET`, responde 500 de propósito ("melhor fora do ar do que
  aberto").
- `quemEsta`, a cada chamada de API, confere no banco `ativo` e `token_versao`.
- `/api/dados` faz uma única consulta e devolve o retrato como texto; 403 se a pessoa precisa trocar a
  senha.
- Papel do banco `painel_site` com permissões mínimas, **criado por SQL**: papel criado pela API do
  Neon entra em `neon_superuser` e passa por cima das permissões (pego no teste de 07/10/2026).

## Pegadinhas

- **Brecha Base B:** `relatorio.html` e `relatorio.pdf` são estáticos, com nomes de lead, e só passam
  pelo middleware (cookie, não banco): pessoa desativada ainda lê até o cookie vencer (até 12 h).
- **Link de entrada Base B** (trabalho não commitado em 10/10/2026): depois de `/api/link`, o login
  sempre manda para `/senha.html`, que pede a senha atual a quem pediu link por ter esquecido.
- Vercel Authentication (proteção de deploy) barra cron externo, automação do CRM e quem abre o link
  do e-mail; a saída é o "Protection Bypass for Automation" (Base A `docs/DEPLOY.md`).

## Testes e verificação

- Base A: `testar-permissoes`, `testar-senhas`, `testar-links`, `testar-acessos-crm`,
  `testar-acessos-entrada`, `testar-supervisor-equipe`, `testar-auditoria`, `testar-telas` (matriz por
  papel e tentativas de furar o escopo, contra o harness).
- Base B: 15 de 15 casos de segurança em branch temporário do Neon; tela de Acessos 28 de 28.

## Arquivos

- Base A `src/auth/index.js`, `src/auth/escopo.js` (`PAPEIS`, `escopoDoUsuario`, `alcanceDoPlantao`),
  `src/auth/links.js`, `src/api/usuarios.js`, `src/ingest/acessos.js`, `public/acessos.js`,
  `public/login.html`.
- Base B `site/middleware.js`, `site/lib/sessao.js`, `site/lib/servidor.js`, `site/api/*.js`,
  `neon/painel.sql`, `configurar_neon.js`, `usuarios.js`.
