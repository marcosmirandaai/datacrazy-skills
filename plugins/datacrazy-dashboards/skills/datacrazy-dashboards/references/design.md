# Padrão de tela

O que os dois painéis têm em comum, e onde cada marca muda a pele. Detalhe da Base A em
`docs/DESIGN.md` do projeto; da Base B em `modelos/tema-base-b.css` e `design-system/`.

## Conteúdo
1. Princípios
2. Cor: marca para a interface, passo escuro para o dado
3. Base A: tokens e paletas
4. Base B: tema ouro sobre o "Violeta"
5. Gráficos à mão (SVG)
6. Componentes
7. Interação e desempenho
8. Acessibilidade, tema escuro e larguras

## 1. Princípios

- Cada número diz a base: nota embaixo do KPI ("das 42 conversas medidas"), dica na célula, frase
  explicando o cartão. Explicação curta acima da tabela vale mais que legenda.
- "Não medido" tem forma própria ("—", "ainda não medido", passo tracejado) e nunca vira zero.
- Estado sempre com texto ao lado da cor; vermelho só para alarme.
- Sem biblioteca de gráfico: SVG e HTML à mão, poucas formas, bem escolhidas.
- O que se faz na tela (pausar, montar escala, criar acesso) é assistente: uma pergunta por vez, atalho
  para o caso comum, conferir em frase antes de gravar; editar continua em formulário.
- Mensagem de erro diz o que fazer ("Bata o ponto de hoje antes de começar a receber.").

## 2. Cor: marca para a interface, passo escuro para o dado

A cor da marca raramente serve como marca de gráfico: um laranja de marca sobre branco deu 2,89:1, e um
amarelo, menos ainda. A marca veste botão, aba ativa, foco e faixa de título; o dado
usa um passo mais escuro da mesma família, validado para contraste (3:1 mínimo em marca de gráfico) e
daltonismo nos dois temas.

- **Acento × alarme não dividem o mesmo gráfico:** laranja/ouro e vermelho se confundem sob
  deuteranopia. Funil com barra de alarme deixa as outras neutras; no relatório da Base B, enviados e
  erros são dois gráficos na mesma escala.
- No máximo 3 séries categóricas por gráfico (Base A validou todos os pares com 3; com 4 nenhuma
  ordem passa): a quarta vira "Outros" ou outro gráfico.
- Ordinal (etapas de funil): uma matiz, claro → escuro, pela **posição** da etapa.

## 5. Gráficos à mão (SVG)

- **Série temporal** (Base A `serieTemporal`): área + linha, eixo único, 4 linhas de grade sólidas,
  teto "bonito" (1/2/5/10), até 7 rótulos no eixo X, traço 2 px, área com opacidade ~0,12, crosshair e
  marcador no hover, dica com uma linha por série, `<title>` acessível. Mínimo 320 px de largura.
- **Barras horizontais** (funil, canais, ranking): rótulo à esquerda (`minmax(130px, 38%)` na Base B;
  168 px na Base A), preenchimento `calc((100% − ~110px) × fração)` para reservar o número, ponta
  arredondada 3–4 px, mínimo 3 px, valor direto, percentual sobre a 1ª barra.
- **Colunas** (Base B): viewBox fixo, passo do eixo por faixa (>600 → 250; >200 → 100; >60 → 25;
  senão 10), rótulo só se ≥ 50% do topo, área de clique transparente e `<title>` como dica.
- **Rosca:** até 6 fatias (Base A usa 3 para status), 2 px entre fatias, total no centro.
- **Calendário de calor:** grade de 7 colunas `minmax(0, 1fr)`, intensidade com `color-mix`.
- Cores lidas das variáveis CSS na hora de desenhar (`getComputedStyle`): trocar o tema exige redesenhar.
- Gráfico só desenha com o contêiner visível — escondido, ele mede 0 px. Redesenhe ao mostrar e no
  resize (espera ~180 ms).
- Evite: eixo duplo, gradiente em bloco grande, rosca com muitas fatias, sombra pesada.

## 6. Componentes

- **KPI:** rótulo em maiúsculas pequenas, valor grande (~28 px), nota de 12 px com a base, barra lateral
  de 3 px no acento. Grade `repeat(auto-fit, minmax(178px, 1fr))`.
- **Tabela:** cabeçalho em maiúsculas 11 px; `.num` à direita com tabular-nums; `.truncar` com o texto
  inteiro no `title`; segunda linha `.sub`; barra na célula para volume; `.vazio` com frase em vez de
  tabela vazia; ordenação por cabeçalho (`aria-sort`); paginação.
- **Status:** `.tag-status` com ponto + texto (`st-ok`, `st-info`, `st-alert`, `st-neutro`).
- **Cartão de lista em grade** (impulsos): título, descrição de uma linha, chip, rodapé com status e
  contagens, linha de resumo; busca local que filtra sem redesenhar.
- **Trilha do lead:** ícones em círculos ligados por traço; feito verde, falha vermelho, "não sei"
  tracejado; selo do estágio com ponto colorido.
- **Pílulas de filtro:** `aria-pressed`, contagem em selo, a pressionada invertida (texto/fundo).
- **Diálogos:** `<dialog>` nativo; `avisar`/`confirmar` no lugar de `alert`/`confirm`; confirmação
  destrutiva foca "Cancelar".

## 7. Interação e desempenho

- Clicar numa métrica abre o funil dela; clicar numa barra lista os leads; clicar de novo desfaz.
  Clicar num vendedor/dia/barra com `data-filtro` filtra o painel inteiro (Base B).
- **Redesenhe só o pedaço que mudou** (funil, lista, ficha). Redesenhar a página inteira a cada clique
  joga fora foco e rolagem e, na Base A, custava 200–2.800 ms no navegador em segundo plano; passou a
  1–20 ms. Quando o conteúdo acima muda de altura, ancore a linha clicada (meça antes e depois e role a
  diferença).
- Busca que só esconde (`hidden`) não perde o foco do campo; busca que redesenha troca só a caixa da
  lista.
- Listas longas: 60 linhas e "Mostrar mais" de 200; ao mostrar mais, foco no primeiro item novo.
- Enter e Espaço acionam qualquer elemento clicável que não seja botão (`role="button"`, `tabindex=0`).
- Texto do CRM sempre escapado (`esc()`/`textContent`). Dado entre página e script vai em
  `<script type="application/json">` com `<` escapado.

## 8. Acessibilidade, tema escuro e larguras

- Foco visível em todo controle: anel de 3 px na cor da marca (`color-mix` a ~22%).
- Identidade nunca só por cor: legenda com 2+ séries, rótulo direto, estado com texto.
- Tema escuro é paleta escolhida e validada, não inversão; impressão força o claro.
- `prefers-reduced-motion` respeitado; transições abaixo de 200 ms, de cor e opacidade.
- **Larguras:** nada de rolagem lateral a 375 px (meça `scrollWidth > clientWidth` e procure quem passa
  da borda). Pontos de quebra usados: ~1180/1280 (grades empilham), 960 (corpo do impulso empilha), 860
  (trilho lateral vira barra), 640 (linha do lead em áreas de grade), 560/480 (métricas encolhem,
  funil em uma coluna). Meta `viewport` obrigatória — sem ela o celular desenha com 980 px.
- Tabelas largas dentro de `.tabela-rolagem` (rolam sozinhas, a página não).
- 23/10/2026 (Base A, PR #47): "não estourar" não basta no telefone. Medido em 375/768/1024/1280/1366:
  - **Filtros recolhidos** em ≤ 640 px, com o período visível e um botão "Filtros (n)" que diz
    quantos estão em uso. Com dez filtros abertos, a primeira tela era só filtro.
  - **Tabela de cinco colunas ou mais vira cartões** em ≤ 640 px. O JS põe `data-rotulo` com o
    título da coluna em cada `td`, e o CSS mostra o rótulo em `::before`, posicionado, com o
    conteúdo num recuo de 34%. Não use grid na célula: texto, link e sublinha virariam itens soltos.
  - **Indicadores em linhas iguais:** o JS conta os cartões (`--kpis`); no notebook, todos numa
    linha (≥ 1200 px); no tablet, até quatro por linha, por igual (seis viram 3 + 3). O auto-fit
    deixava sete como 6 + 1.
  - **Toque:** `@media (pointer: coarse)` com 40 px de altura mínima. **Navegação** em faixa
    fixa no alto, rolando até o item aberto.
