# Equipes, ranking de atendentes e vendedores

Projetos: Painel Base A (aba Equipes e ranking da Visão geral) e Relatórios Base B (tela
Vendedores) · Atualizado em 10/10/2026

## A pergunta que o painel responde

Quem está atendendo quanto, com que resultado e com que agilidade — por equipe e por pessoa — sem
creditar a alguém o lead que outra pessoa atendeu.

## De onde vem cada número

| Número | Fonte | Observação |
|---|---|---|
| Atendente da linha | `atendente_efetivo` (Base A), resolvido pela regra de tags e evidências (`medicao.md`) | "Atribuir por: negócio" troca para `atendente_negocio`, o critério antigo, para reconciliar com as planilhas |
| Funil | pipeline do negócio, **não** a equipe da pessoa | Atendente F atende nos dois departamentos |
| Leads, matrículas, conversão | negócios no recorte | — |
| 1ª resposta, resposta média | mensagens com atendente humano | — |
| "Pela tag" | % com `atendente_origem` `tag` ou `tag-desempate` | a dica mostra os ambíguos |
| Vendedor (Base B) | 1ª troca de atendente na conexão da campanha depois da tag/disparo (histórico do lead), com reservas em ordem | ver `disparo-base-b.md` |

## Como é montado

### Base A
- **Ranking:** `GROUP BY colaborador, equipe`, `LIMIT 25`. Colunas: Atendente, Funil, Leads (barra na
  célula), Matrículas, Conversão, 1ª resposta, Resposta média, Sem resposta, Pela tag. A nota inclui
  "N sem atendente definido" — quem não tem evidência fica fora do ranking e é contado à parte, para
  não inflar a líder.
- **Equipes:** `porEquipe` força `equipe: 'todas'` para as duas aparecerem lado a lado mesmo com uma
  escolhida. Cartões por equipe (Leads, Matrículas, Conversão, 1ª resposta média) e barras nas cores
  categóricas `--s1`/`--s2`/`--s3`, matrículas na dica. A aba some para o atendente.
- Duas equipes: "o número é o gráfico" — cartões de números, não gráfico com eixo.

### Base B
- Top 10 vendedores clicável e tabela ordenável pelo cabeçalho (`aria-sort`). Clicar na linha
  **filtra** o painel pelo vendedor (não abre detalhe); "(sem vendedor)" é uma opção do filtro.

## Decisões e porquês

- 11/09/2026 (Base A, 6.395 negócios com tag de atendente) — A tag de atendente confere com o
  atendente da última conversa em 91,0%, com o dono do negócio em 67,5% e com o atendente do lead em
  4,1%. Pelo dono, Equipe 1 tinha 1.924 negócios; pela tag, 473. A tag virou a fonte principal.
- 8,3% dos negócios têm mais de uma tag de atendente: desempate pela evidência datada mais recente.
- 13–14/09/2026 — 282 negócios creditados a gente de fora do departamento; 39 do funil da Equipe 1 com
  gente da Equipe 2 e 61 no sentido inverso. Daí a regra "só vale tag de alguém da equipe do funil".
- Nomes canônicos: "Atendente K" era outra pessoa sem o mapa `nomeDaTag`; "Equipe 1", "Equipe 1 " e "Equipe 1 (com sobrenome)" eram três sem `canonizarNome` (aparar espaços).

## Pegadinhas

- Atendentes têm dois ids no Datacrazy (CRM em negócio/lead; multiatendimento em conversa) e um
  terceiro no login (`company-users`): agrupe pelo `userId`, ligue pelo e-mail.
- O CRM aceita espaço nas pontas de tag e de nome: normalize ao gravar, senão o seletor mostra 70 e o
  filtro traz 3.
- Cinco atendentes faltavam no mapa de tags na base inicial (Atendente G 107, Atendente H 56, Atendente I 22, Atendente J 17,
  Atendente B 5): pessoa nova no CRM precisa entrar no domínio (`tagsDeAtendentes`, `nomeDaTag`).

## Testes e verificação

- Base A `testar-atribuicao.mjs` (casos reais da base de 13/09, função pura) e `testar-permissoes.mjs`
  (o ranking respeita o recorte de cada papel).

## Arquivos

- Base A `src/ingest/metrics.js` — `resolverAtendente`, `resolverPorDepartamento`, `canonizarNome`;
  `src/api/consultas.js` — `ranking`, `porEquipe`, `colunaAtendente`; `public/app.js` —
  `renderRanking`, aba Equipes; `src/config.js` — `dominio.tagsDeAtendentes`, `nomeDaTag`.
- Base B `modelos/dashboard_disparo.html` (tela Vendedores), `relatorio_disparo.js` (vendedor
  distribuído, continuidade, "mesma pessoa").
