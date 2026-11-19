---
name: datacrazy-dashboards
description: Construir, evoluir e revisar painéis (dashboards) e relatórios em cima dos dados do CRM Datacrazy, com o que foi aprendido nos dois projetos de referência — Painel Base A (servidor Node + SPA + ingestão agendada em Postgres/Neon) e Relatórios Base B (cache SQLite local + gerador de página estática + retrato no Neon). Use sempre que for criar ou mudar um painel, aba, KPI, funil, gráfico, tabela ou relatório alimentado pelo Datacrazy; medir disparo em massa/impulso, campanha, entrega, leitura, resposta, pedido para sair, matrícula ou venda; medir atendimento (1ª resposta, SLA, plantão, quem atendeu, inconsistências); decidir de onde vem cada número (REST, MCP ou banco local) e quanto ele custa em requisição; ou trabalhar nos projetos Painel Base A ou Relatórios Base B — mesmo que a pessoa não diga "dashboard". Para o cliente HTTP, limites e paginação da API, use junto a skill datacrazy-api; para fluxos do CRM, a datacrazy-automacoes.
---

# Painéis sobre o CRM Datacrazy

Este é o caderno dos painéis que já construímos sobre o Datacrazy: **como cada um foi montado, de onde
sai cada número e por quê**. Ele cresce a cada painel — a seção "Como atualizar esta skill", no fim,
diz como. Quando o que está aqui divergir do código ou da API de hoje, vale o código e a API: confira,
siga, e corrija a skill.

O que mora em outro lugar:
- cliente HTTP, cota por rota, paginação, teto do skip, MCP como transporte → skill **datacrazy-api**;
- fluxos (automações) do CRM, blocos e gatilhos → skill **datacrazy-automacoes**;
- servidor próprio (VPS, Docker, rotinas agendadas) → fora desta coleção.

## Onde ler o quê

| Vai fazer | Leia |
|---|---|
| Painel ou aba nova | este arquivo, depois `references/paineis/_modelo.md` e o(s) painel(is) mais parecido(s) — um painel que cruza dois assuntos (ex.: impulsos por atendente) lê os dois |
| Mexer num painel que existe | `references/paineis/<painel>.md` (catálogo abaixo) |
| Decidir quem vê (papéis, recorte por SQL, 403 na rota) | `references/paineis/acessos-e-login.md` |
| Projeto novo de dashboard (outro cliente) | `references/arquiteturas.md` |
| Trazer um dado novo do CRM | `references/dados-do-crm.md`, e a `datacrazy-api` para o cliente |
| Definir um número: taxa, base, "medido", atribuição | `references/medicao.md` |
| Desenhar a tela | `references/design.md` |
| Testar, conferir na tela, publicar, agendar a ingestão | `references/verificacao-e-operacao.md` |

## Os dois projetos de referência

| | Painel Base A | Relatórios Base B |
|---|---|---|
| Pasta | `Painel Base A` | `Relatórios Base B` |
| Desenho | servidor Node (ESM, sem framework) + SPA em ES modules; a ingestão grava no banco e o servidor agrega por SQL a cada pedido | `sync.js` copia o CRM para um SQLite local; geradores montam o painel com os dados **embutidos**; o retrato sobe para o Neon e um site estático o lê |
| Banco | Postgres (Neon) em produção; SQLite nos testes e no harness, com o mesmo SQL (`src/db/driver.js`) | SQLite `data/datacrazy.db` (~408 MB); no Neon, só o retrato numa linha (`painel_retrato`) |
| Ingestão | rodada horária + consolidação noturna, com assinatura por negócio (só relê o que mudou) | `atualizar.js`, rotina inteira quando pedida (completa ~10 a 36 min) |
| Onde roda hoje (11/10/2026) | VPS (projeto `painel-base-a`): horária 07–22h no minuto 12 e consolidação às 03:12; o servidor puxa o `main` sozinho de 30 em 30 min | VPS (projeto `base-b`): `completo` seg a sex 06:17 e 14:17, mais o `rapido` |
| Publicação | Vercel `painel-base-a` (`api/index.js` + `public/`), região gru1 | Vercel `painel-base-b` (pasta `site/` montada), publicado de uma cópia fora do repositório |
| Acesso | login próprio, 4 papéis, recorte por SQL no servidor | login próprio no middleware da Vercel, papéis supervisor/admin |
| API | só REST | REST + MCP (vínculo conversa→lead, mensagens com atendente) |

Os dois nasceram do mesmo jeito de trabalhar: medir na base real antes de decidir, comentar o porquê com
data e número, e nunca conferir tela contra a produção.

## Antes de construir: as perguntas que decidem o painel

1. **Que decisão o painel apoia, e de quem?** Supervisor que redistribui lead, gestor que avalia
   campanha, atendente que olha a própria fila. A pergunta escolhe a métrica e o recorte.
2. **De onde vem cada número?** Contagem do CRM (lista do impulso, etapa, status) é fato; o que sai de
   reler mensagens (entrega, leitura, resposta, "SAIR") é medição nossa e pode faltar. Escreva a
   origem de cada cartão antes de escrever o SQL.
3. **Qual é a base de cada taxa?** "Respondeu" sobre quem foi medido, não sobre quem recebeu;
   "matrícula" sobre quem recebeu, não sobre a lista. Base errada já fez campanha parecer boa (ver
   `medicao.md`).
4. **O que é "não medido" e como aparece?** Nulo é "não sei" — travessão, passo tracejado, "ainda não
   medido". Zero é fato. Misturar os dois foi o erro mais repetido nos dois projetos.
5. **Quem vê o quê?** O recorte é aplicado no servidor (SQL), nunca só escondendo botão. Painéis de
   campanha costumam ser do grupo inteiro (admin e supervisor).
6. **Quanto custa e com que frescor?** Some as requisições por rodada (a `datacrazy-api` ensina a
   estimar). `/conversations` a 20/min e `/messages` (1 por conversa) mandam no tempo.
7. **Como vai ser conferido sem tocar em produção?** Base sintética e harness local (Base A) ou
   SQLite com o retrato (Base B). Planeje o dado de teste junto com o painel.

## Regras que valem para todo painel

- **Nulo é "não sei"; zero é "medido, nenhum".** O banco guarda nulo quando não deu para medir; a API
  devolve nulo; a tela escreve "—" ou "ainda não medido". Nunca some nulo como zero numa taxa.
- **Retorno só de quem recebeu, e só no que veio depois.** Disparo leva crédito do que aconteceu
  depois que a mensagem chegou naquele lead e antes do próximo disparo concluído no mesmo lead
  (atribuição ao último toque). Medido em 04/10/2026: das 8 matrículas creditadas a uma campanha, 0
  eram de quem recebeu.
- **O que o CRM conta não segue os filtros; o que o lead fez, segue.** Lista e estados do envio são do
  impulso inteiro; entrega, resposta e matrícula acompanham equipe e escopo. Diga isso na tela.
- **Escopo no servidor, falhando fechado.** Sem usuário, papel desconhecido ou recorte vazio → `1 = 0`.
  Esconder item de menu é cortesia: todo botão tem um 403 do outro lado.
- **Texto do CRM é escapado sempre.** Nome de lead, título de impulso e tag entram no HTML por `esc()`
  ou `textContent`.
- **Dado pessoal com cuidado.** Telefone e resumo de conversa só onde o papel precisa; nada de cache do
  CRM fora do banco protegido; nada de dado real em teste ou captura de tela.
- **Comentário com data e medida.** "Medido em 04/10/2026: 1.465 de 1.822" explica uma regra melhor que
  qualquer adjetivo — e diz quando ela pode ter envelhecido.

## Como o dado sai do CRM (resumo)

- **Base A (servidor):** cada rodada lê cadastros (atendentes, departamentos, conexões, impulsos),
  monta os índices em lote (leads por cursor de data, conversas em fatias por status/conexão), varre
  todos os negócios por cursor de `lastMovedAt` (~30 requisições para ~27 mil), compara a assinatura
  de cada negócio e só relê mensagens de quem mudou, com teto por rodada e fila de prioridade.
- **Base B (snapshot):** `sync.js` faz carga completa de leads e negócios por cursor, incremental do
  resto, mensagens pelo MCP (paginadas, com atendente) e códigos de erro pela REST (as 20 últimas);
  depois o relatório roda **só em cima do SQLite**, nunca da API.
- **Impulsos (os dois):** `/crm/boosts`, `/metrics` e `/leads` por estado — paginação instável, sem
  `order`, relida até bater com as métricas. Entrega e leitura não vêm do impulso (tipo `automation`):
  saem das mensagens da conversa.

Detalhe, custo e pegadinhas de cada fonte: `references/dados-do-crm.md`.

## Padrão de tela (resumo)

- Sem biblioteca de gráfico: SVG e HTML à mão, cores lidas das variáveis CSS na hora de desenhar.
- KPIs no topo com nota explicando a base; tabela com barra na célula para ranking; funil em barras
  horizontais; rosca só com poucas fatias; série temporal com eixo único.
- Paleta validada para daltonismo, vermelho só como alarme e sempre com texto; tema escuro escolhido,
  não invertido; foco visível; nada de rolagem lateral a 375 px.
- Interação: clicar numa métrica abre o funil dela, clicar numa barra lista os leads; redesenhe só o
  pedaço que mudou (foco e rolagem ficam no lugar).

Tokens, regras e exemplos dos dois temas: `references/design.md`.

## Verificar e publicar (resumo)

- Testes por assunto (`scripts/testar-<assunto>.mjs`), banco descartável, cliente falso da API, e a
  mesma SQL rodada num Postgres de verdade em memória (PGlite).
- Tela conferida no harness local com base sintética — o `.env` aponta para a produção.
- Uma PR por assunto; merge só depois do ensaio e de todas as suítes; publicação na Vercel.

Comandos, armadilhas de navegador e de deploy: `references/verificacao-e-operacao.md`.

## Catálogo de painéis

| Painel | Projeto | Referência | Atualizado |
|---|---|---|---|
| Visão geral | Base A, Base B | `references/paineis/visao-geral.md` | 05/11/2026 |
| Equipes, ranking e vendedores | Base A, Base B | `references/paineis/equipes-e-ranking.md` | 10/10/2026 |
| Negócios e Inconsistências | Base A | `references/paineis/negocios-e-inconsistencias.md` | 10/10/2026 |
| Atendimento (plantão) | Base A | `references/paineis/atendimento-plantao.md` | 16/10/2026 |
| Suporte e Conversas sem negócio | Base A | `references/paineis/suporte-e-conversas.md` | 10/10/2026 |
| Impulsos (disparo em massa) | Base A, Base B | `references/paineis/impulsos.md` | 10/10/2026 |
| Disparo Base B: funil, interessados, erros, calendário, relatório PDF | Base B | `references/paineis/disparo-base-b.md` | 10/10/2026 |
| Ingestão (saúde da extração) | Base A | `references/paineis/ingestao.md` | 10/10/2026 |
| Acessos e login | Base A, Base B | `references/paineis/acessos-e-login.md` | 10/10/2026 |
| Públicos de disparo (listas do CRM) e retorno das cadências | Base A | `references/paineis/publicos-e-cadencias.md` | 04/11/2026 |

## Como atualizar esta skill

Atualize no mesmo dia em que o painel muda — é quando os porquês ainda estão frescos.

1. **Painel novo:** copie `references/paineis/_modelo.md` para `references/paineis/<nome>.md`,
   preencha e acrescente a linha no catálogo acima.
2. **Painel mudou:** edite o arquivo dele e a data do catálogo. Decisão revertida não se apaga:
   escreva o que era, o que é e por quê.
3. **Regra de medição nova** (base de taxa, janela, o que conta como resposta) → `medicao.md`.
4. **Fato novo da API** (limite, rota, filtro, campo) → skill **datacrazy-api**, não aqui; aqui fica só
   como o painel usa.
5. **Padrão visual novo** → `design.md`. **Armadilha de teste, deploy ou agenda** →
   `verificacao-e-operacao.md`.
6. Todo fato com data (dd/mm/aaaa) e, se medido, o número. Referência a código como
   `arquivo` + nome da função — linha envelhece rápido.
