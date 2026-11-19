# Negócios e Inconsistências

Projeto: Painel Base A (abas Negócios e Inconsistências) · Atualizado em 10/10/2026

## A pergunta que o painel responde

- **Negócios:** a lista de trabalho — cada negócio com etapa, atendente, tempos e, quando há, o motivo
  de não ter passado nas regras da equipe.
- **Inconsistências** (só admin): a saúde da base — que tipos de problema existem, onde, desde quando,
  e o que dá para consertar (inclusive a mesma pessoa em duas fichas).

## De onde vem cada número

| Número | Fonte |
|---|---|
| Destino (`equipe`, `errata`, `outros`) e motivo | `classificar()` na ingestão (mesma regra nos testes e na base sintética) |
| Tipo de inconsistência | `TIPO_DE_INCONSISTENCIA_SQL`: `CASE` com `LIKE` pelo começo da frase do motivo |
| Mesma pessoa em duas fichas | negócio "sem conversa" cujo telefone casa com uma conversa sem negócio |

Tipos, na ordem: `funil_renomeado`, `sem_conversa`, `numero_da_outra_equipe`, `responsavel_do_lead`,
`outro_motivo`, `fora_das_equipes`.

## Como é montado

### Negócios
- `GET /api/negocios` → `listarNegocios`: paginação `porPagina` 10–200 (padrão 50), ordenação por lista
  branca (`criado_em`, `nome_lead`, `colaborador`, `tempo_primeira_resposta`, `tempo_atendimento`,
  `etapa`).
- Linha: nome com o tipo de inconsistência embaixo (motivo inteiro na dica), "sem atendente definido"
  em cinza, pipeline embaixo da etapa, status como `.tag-status`.
- Quadro "Inconsistências por tipo" acima da tabela: tipo, quantidade com barra, parte do total e
  "Ver na tabela" (seta `destino=<tipo>` e rola até a tabela). Tipo zerado some, a não ser o
  escolhido. A explicação dos tipos fica na página Inconsistências.

### Inconsistências
- `GET /api/inconsistencias` (só `podeAuditarBase` = admin).
- KPIs: Inconsistências (% dos negócios), Tipo que mais pesa, Entraram nos últimos 7 dias (corte no dia
  de Brasília), Mesma pessoa em duas fichas.
- Quadro de tipos com explicação; "Novas por dia" com as 2 maiores + "Outros tipos" (teto de 3 séries);
  tabela equipe × tipo (zero aparece como "—" aqui, exceção à regra do travessão); etapas e números de
  entrada (top 10).
- **Mesma pessoa em duas fichas** (`mesmaPessoaEmDuasFichas`): chave DDD + 8 dígitos finais; com os dois
  lados de 11 dígitos vale a chave forte (11 dígitos). Mostra os 100 mais recentes.
- A lista de equipes do seletor ignora o próprio filtro de equipe (faceta).

## Decisões e porquês

- 21/09/2026 — Base com 1.902 inconsistências: sem conversa 1.207 (Equipe 1 695, Equipe 2 512), número da
  outra equipe 277, lead com outro responsável 93, funil fora das equipes 325. Na Equipe 2, 576 quebram
  duas regras.
- 467 dos "sem conversa" têm conversa com o mesmo telefone; em 464 o lead tem 13 dígitos e a conversa
  12 (o 9º dígito). Daí a chave DDD + 8 finais, e a forte só quando os dois lados estão completos.
- Três bugs do n8n antigo foram corrigidos, não portados (coluna trocada na planilha da Equipe 2,
  `{{ "a" || "b" }}` nas condições de canal, `skip+1` pulando o 1º negócio): o ponto de reversão está
  comentado no código.

## Pegadinhas

- `TIPO_DE_INCONSISTENCIA_SQL` usa `LIKE` — no Postgres diferencia maiúscula; o teste de PGlite cobre.
- O par lado a lado `classificar`/`TIPOS_DE_INCONSISTENCIA` tem teste que quebra se divergirem.
- Inconsistência é do comercial: o suporte é sempre `destino = 'equipe'`.

## Testes e verificação

- `testar-inconsistencias.mjs` (tipo esperado, contagem, filtro, valores antigos `errata`/`outros`,
  CSV, nome do arquivo, página de análise, chave de telefone, duplicados), `testar-postgres.mjs`
  (`CASE` + `LIKE`), `testar-supervisor-equipe.mjs` e `testar-telas.mjs` (403 para quem não é admin).

## Arquivos

- `src/ingest/classify.js` — `classificar`, `TIPOS_DE_INCONSISTENCIA`, `TIPO_DE_INCONSISTENCIA_SQL`.
- `src/api/consultas.js` — `listarNegocios`, `inconsistencias`, `mesmaPessoaEmDuasFichas`,
  `chaveDoTelefone`, `chaveForte`.
- `public/app.js` — quadro de tipos, tabela de negócios, página Inconsistências.
