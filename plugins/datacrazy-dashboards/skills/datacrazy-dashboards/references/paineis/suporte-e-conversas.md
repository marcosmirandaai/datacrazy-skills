# Suporte ao Aluno e Conversas sem negócio

Projeto: Painel Base A (abas Suporte e Conversas) · Atualizado em 10/10/2026

## A pergunta que o painel responde

- **Suporte:** como anda a fila do pipeline de Suporte — o que entrou, o que foi
  resolvido, quem atendeu e em quanto tempo. É fila de atendimento, não venda: sem matrícula nem
  conversão.
- **Conversas sem negócio:** o que chegou pelos números da empresa e não virou negócio em pipeline
  nenhum — quem respondeu, quem ficou sem resposta.

## De onde vem cada número

- Suporte: os mesmos `negocios`, com `area = 'suporte'` (pipeline marcado `area: 'suporte'` no
  domínio). `filtro()` tira o suporte de todo número comercial; aqui ele entra sozinho.
  "Na fila" = total − resolvidos; resolvido = etapa em `suporte.etapasResolvidas`
  (`['Resolvido / Finalizado']`).
- Conversas: tabela `conversas` (contatos sem negócio, grupos fora), com assinatura própria e o que
  sobrou do teto de mensagens da rodada. Conversa que ganhou negócio, ou sumiu do CRM, é removida.

## Como é montado

### Suporte
- `GET /api/suporte` → `suporte()` com `area: 'suporte', destino: 'todos'`; lista em
  `/api/negocios?area=suporte&destino=todos`; opções em `/api/filtros` com a mesma área.
- Filtros da página: Etapa (leva o pipeline), Atendente, Busca; o período vem da barra comum.
- KPIs: Na fila (`--s1`), Resolvidos (`--ok`), 1ª resposta (mediana; p90 · n) (`--s2`), Sem resposta
  (`--alert`), Sem atendente definido (`--f4`).
- Gráficos: fila por etapa (a resolvida em `--ok`), entradas por dia (entradas e resolvidas), por
  número. Tabelas: Atendentes (LIMIT 25) e Atendimentos. Exporta o recorte da área.
- Menu visível só com `areas.suporte` (`areasDoUsuario`): o supervisor do Suporte cai direto aqui.

### Conversas
- `GET /api/conversas` junta `conversas`, `listarConversas` e `opcoesConversas`, com o escopo próprio
  `filtroConversas` (departamento do número; atendente para o atendente).
- Filtros: Número, Departamento, Atendente, Status, Busca. KPIs: Conversas (contatos), 1ª resposta
  mediana, Sem resposta, Sem atendente. Gráficos: por número, rosca de status, por dia, por
  departamento. Tabela ordenada por `conversa_atualizada_em`.
- **Não exporta** (o menu some).

## Decisões e porquês

- 14/09/2026 — 4.733 negócios do suporte entraram de uma vez; como "novos", tomariam o teto de
  mensagens das rodadas por dias. O suporte vem depois de todo o comercial na fila de mensagens.
- 14/09/2026 — 713 conversas sem negócio (301, 198 e 214 em três conexões).
- Conversas sem negócio só são lidas com o índice de conversas **completo**: com índice cortado, "não
  está no índice" não prova "não tem negócio".

## Pegadinhas

- Em 03/10/2026, com a varredura de negócios voltando vazia, as rodadas "concluíram" gravando as 11 mil
  conversas como sem negócio. Daí a trava `conferirLeitura` (ver `verificacao-e-operacao.md`).
- O status da conversa vem da 1ª conversa escolhida (`escolherConversa`): com até 3 conversas, prefere
  a instância principal; com mais, só o canal, atendente nulo.

## Testes e verificação

- `testar-sincronizacao.mjs` (conversas sem negócio, suporte depois do comercial),
  `testar-permissoes.mjs` e `testar-supervisor-equipe.mjs` (suporte e conversas por área).

## Arquivos

- `src/api/consultas.js` — `suporte`, `conversas`, `listarConversas`, `filtroConversas`,
  `areasDoUsuario`; `src/ingest/conversas.js`; `public/app.js` (páginas Suporte e Conversas).
