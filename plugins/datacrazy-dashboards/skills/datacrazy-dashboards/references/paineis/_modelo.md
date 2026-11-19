# <Nome do painel>

Projeto(s): <Painel Base A | Relatórios Base B | outro> · Atualizado em <dd/mm/aaaa> ·
PR/commit: <link ou hash>

## A pergunta que o painel responde

Quem usa, para decidir o quê. Uma ou duas frases. Se o painel tem mais de uma pergunta, liste.

## De onde vem cada número

| Número na tela | Fonte | Base / denominador | "Não medido" quando |
|---|---|---|---|
| ex.: Lidos | mensagens da conversa (`disparo_lido`), dentro da janela do disparo | entregues | conversa ainda não relida, ou sem a mensagem da automação |

Diga para cada número se é **contagem do CRM** (fato, não segue filtro) ou **medição nossa** (pode
faltar, segue filtro e escopo).

## Como é montado

- **Servidor / gerador:** rota ou script, função de consulta, SQL (ou o essencial dela), o que vem em
  paralelo, o que é calculado em JS e por quê.
- **Tela:** blocos na ordem em que aparecem; o que é clicável e o que abre; filtros próprios da página;
  o que se recalcula no navegador.
- **Permissão:** quem abre, e qual recorte cada papel vê.

## Decisões e porquês

Uma linha por decisão, com data e, se houver, a medida que a motivou:
- dd/mm/aaaa — <decisão> — <por quê, com número>.

## Pegadinhas

Coisas que já deram errado ou quase: da API, do SQL nos dois bancos, da tela.

## Testes e verificação

- Suítes que cobrem (nome do arquivo e o que provam).
- Como foi conferido na tela (harness, base sintética, larguras, tema escuro).

## Arquivos

- `<caminho>` — `<função>`: papel no painel.
