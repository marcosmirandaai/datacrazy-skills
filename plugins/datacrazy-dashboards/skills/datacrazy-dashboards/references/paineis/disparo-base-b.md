# Disparo Base B: funil, interessados, erros, calendário e relatório PDF

Projeto: Relatórios Base B (`modelos/dashboard_disparo.html` → `site/index.html`;
`modelos/pagina_disparo.html` → `site/relatorio.html` + PDF) · Atualizado em 10/10/2026

## A pergunta que o painel responde

Para a campanha de disparo por WhatsApp (templates da Meta, fluxos do CRM): quem recebeu, quem viu,
quem respondeu e se interessou, quem ficou com que vendedor e se a conversa continuou — e por que quem
não recebeu não recebeu.

## De onde vem cada número

Tudo sai do SQLite depois do sync, em `relatorio_disparo.js` (tabela `disparo_leads`, uma linha por
lead da tag), e é embutido no painel por `gerar_dashboard.js`.

| Número | Regra |
|---|---|
| Enviado | template com status `SENT`, `RECEIVED` ou `READ` (`ERROR` e `PENDING` fora) |
| Entregue | `RECEIVED` ou `READ` |
| Visualizou | `READ`, ou ter respondido (quem desliga a confirmação de leitura não aparece) |
| Respondeu | resposta que não é automática nem teste (inclui "ok" e o pedido para sair) |
| Interessado / sinais | leitura no contexto do fluxo (consultor, projeto, chamar depois, outra data, período), máscara de bits |
| Erro | código da Meta só pela REST (as 20 últimas mensagens); vale o **último envio** |
| Vendedor | 1ª troca de atendente na conexão da campanha a partir de (tag ou 1º template) − 10 min, com reservas em ordem |
| Continuidade | conversas do lead em outras conexões, só mensagens posteriores ao disparo |

Etapa do funil do lead, por precedência: respondeu → só resposta automática → visualizou sem
responder → recebeu sem visualizar → enviado sem confirmação → erro no envio → pendente → sem
template → sem conversa na API. Detalhe das regras em `medicao.md`.

## Como é montado

- **Linha por lead em vetor de 30 posições**, não objeto, para o arquivo não inchar (2.912 leads =
  764 KB embutido; versão online 102 KB + retrato de 665 KB no Neon em 09/10/2026). Dicionários para
  fluxos, vendedores, etapas, erros, base, funil; −1 = nulo. Posição 13 é a máscara de sinais (1
  consultor, 2 projeto, 4 chamar depois, 8 outra data, 16 pediu para sair, 32 clicou botão, 64 recusou).
- **Telas** recalculadas no navegador a cada filtro: Visão geral, Impulsos (ver `impulsos.md`), Funil
  (etapa alcançada clicável, templates por lead, funil por base), Interessados (3 KPIs, continuidade,
  tabela clicável), Vendedores, Erros (por que não receberam, barras por semana, códigos da Meta —
  conta envios e não segue os filtros —, leads que nunca receberam), Calendário (meses em grade de 7
  colunas, intensidade `0.18 + 0.82·√(n/max)` com `color-mix`, ponto no dia com resposta; clicar no dia
  filtra o painel inteiro) e Todos os leads.
- **Filtros** (`F`): base (controle segmentado), impulso (com "Fora de impulso"), fluxo, vendedor (com
  "(sem vendedor)"), sinal (bit AND), etapa do funil, período De/Até pelo dia do disparo em Brasília,
  dia (do calendário) e busca (180 ms). Clicar de novo no mesmo filtro desfaz. Escopo "N de M leads".
- **Detalhe do lead** em gaveta lateral, com telefone e resumo da conversa (dado pessoal — só para quem
  tem acesso ao painel). Esc fecha; Enter e Espaço acionam qualquer clicável.
- **Inicialização:** com dados embutidos, monta direto; sem eles (site), `fetch('/api/dados')`; 401 →
  login com `?voltar=`; 403 → `/senha.html`.
- **Relatório** (`gerar_pagina_disparo.js`): `D` agregado por SQL; capa, 4 KPIs, "Em resumo" com frases
  geradas, funil, interesse, vendedor, continuidade, erros com **dois gráficos de colunas na mesma
  escala** (enviados em ouro, erros em vermelho — não no mesmo gráfico), tabela por vendedor,
  interessados filtráveis, "Como os números foram contados".
- **PDF:** Chrome headless sobre um `print.html` que força `data-theme="light"` (senão imprime escuro):
  `--headless=new --disable-gpu --no-pdf-header-footer --virtual-time-budget=15000`; A4 com margens de
  13 × 12 mm e `.quebra { break-before: page }`.
- **Modelos são fragmentos** (sem `<!doctype>`/`<head>`) porque também viram Artifact da claude.ai;
  marcadores `__TEMA__`, `__TEMA_JS__`, `__DADOS__` (JSON em `<script type="application/json">` com `<`
  escapado como `<`), `<!--LINKS-->`; troca sempre com `.replace('X', () => valor)` para o `$&`
  não ser interpretado. Republicar o Artifact passando o `url` existente mantém o link.

## Decisões e porquês

- Relatório nunca chama a API: roda o sync antes e lê o SQLite — "relatório com dado pela metade engana
  mais do que ajuda" (passo obrigatório que falha interrompe a rotina).
- Erro de envio vale o último envio: 499 de 1.293 conversas com erro se recuperaram.
- Continuidade sem resposta do lead não conta: contar conversas só com anotação inflou 68 para 113.
- Leads excluídos do CRM vão para tabela acumulada à parte (131 sumiram entre 23 e 26/09, 21 tinham
  respondido): métrica separada, não buraco no funil.
- Distribuição de vendedor acontece segundos depois da tag, não no clique; o fluxo "+180 Dias" não
  distribuía (648 de 758 sem vendedor) e no "Sem Compra" a distribuição não roda quando o template
  falha (475 de 479).

## Pegadinhas

- Números fixos no texto do modelo do relatório ("10 clientes…", "9 envios ficaram sem código")
  envelhecem sem aviso.
- O retrato carrega campos que o painel não usa (`dias`, `respostas`, `errosFluxo`, `modelos`) e viajam
  ao Neon à toa.
- Tokens que faltam no tema (`--radius-control`): selects e botões ficam com canto reto.
- `design-system/components/data/` está fora do git por causa do `.gitignore` de `data/`.

## Testes e verificação

- Sem suíte automatizada: calibração `relatorio_conversas.js --padroes`, detector de transbordo em 5
  larguras, segurança em branch temporário do Neon, e o resumo da rotina (duração e contagem de cada
  passo) a cada execução.

## Arquivos

- `relatorio_disparo.js` (regras, `disparo_*`), `lib/classificacao.js` (`tipoResposta`,
  `SAIR_DA_LISTA`, `modeloTemplate`, `tipoErro`), `gerar_dashboard.js`, `gerar_pagina_disparo.js`,
  `modelos/dashboard_disparo.html`, `modelos/pagina_disparo.html`, `modelos/tema-base-b.css`,
  `montar_site.js`, `publicar_neon.js`, `publicar_site.js`, `atualizar.js`.
