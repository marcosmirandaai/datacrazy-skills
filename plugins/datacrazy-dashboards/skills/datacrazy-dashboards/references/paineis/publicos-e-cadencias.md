# Públicos de disparo e retorno das cadências (Base A)

Criado em 04/11/2026. PRs #61 a #64 do Painel Base A. Desenho aprovado em `docs/PUBLICOS-DESENHO.md`.

## Para que serve

Listas de leads para disparo e exportação, montadas toda noite e levadas às **listas do CRM**. Mostra também o retorno de cada cadência: impulso, tag FLW/Follow-up e público de reativação.

## Fontes, sem requisição a mais

- **Última mensagem.** `negocios.ultima_recebida_em`, `ultima_enviada_em` e `ultima_do_lead` vêm da **listagem de conversas** que a rodada já lê (`lastReceivedMessageDate`, `lastSendedMessageDate`, `lastMessage.received`).
  - "Sem resposta": a última mensagem foi nossa, há mais de 2 dias.
  - "Parado": a maior das duas datas, com fallback para `conversa_atualizada_em`.
- **"SAIR" geral.** `pediu_sair_em`, vindo de qualquer conversa relida. Não se desfaz.
- **Meta Ads.** Campanha, conjunto e criativo vêm do texto de `origem_lead`: "*Campanha:* … *Conjunto* *de* *anuncio:* … *Criativo:* …".
- **Região.** Pelo DDD do telefone. Número com "+" que não é +55 fica sem região.
- **Pix e matrícula.** Tabelas `cobrancas` e `matriculas` do Matrícula, no mesmo banco. O casamento é **pelo telefone**: em 04/11/2026, 0 de 19 matrículas de produção traziam `negocio_id`, e 18 casaram pela chave DDD + 8 dígitos.
- **Tags de cadência.** O CRM não data a tag. `cadencia_tags` guarda a primeira vez que a rodada a viu.

## Regras

- Cada lead entra uma vez por público e departamento, pelo negócio mais recente.
- Pediu para sair, matrícula paga e aluno ficam fora dos públicos de venda. Suporte fica fora.
- `publico_membros` guarda cada passagem do lead pelo público: entrou_em, saiu_em e motivo (respondeu, avancou, matriculou, pediu-sair, regra, sumiu).
- "Recuperado" é quem saiu de parado ou sem resposta por resposta ou avanço, nos últimos 30 dias. Entra na mesma noite, porque a rodada faz duas passadas.
- Base vazia cancela a rodada, para não esvaziar os públicos.

## Listas no CRM

- Há 10 listas: "Público · <Departamento> · <rótulo>", para parado 15d, parado 30d, sem resposta, Pix não pago e pediu para sair, em Comercial e Comercial 2.
- A escrita é `PATCH /leads/{id} {lists}`, que **substitui** o conjunto (ver skill datacrazy-api). Por isso vai sempre o conjunto inteiro, e uma lista que não seja de público é lida antes e preservada.
- Só o lead cujo conjunto mudou recebe escrita (`publico_crm_estado`). Teto de 4.000 por noite e prazo de 70 min.
- Ordem de gravação: pediu para sair, depois quem sai de lista, depois quem entra.
- Se o público cair pela metade de uma noite para outra, a sincronização é cancelada.

## Retorno das cadências

- `cadencia_toques` grava um toque por cadência, lead e instante.
- Etapa, canal e status ficam como estavam na primeira vez que a rodada viu o toque.
- O retorno é atualizado toda noite: respondeu, avançou, matriculou e saiu.
- "Respondeu" tem como base quem tem a última mensagem medida. Não dá o tempo até a resposta.

## Quem vê

- Todo papel com área comercial vê a página. O recorte é `escopoDoUsuario`, aplicado numa subconsulta sobre `negocios`.
- Exportar segue `podeExportar`: a atendente recebe 403. Toda exportação entra na auditoria.

## Operação

- O job `publicos` roda às 01:40 no servidor, entre a última rodada horária e a consolidação.
- `--sem-crm` só monta os públicos no banco; `--teto-crm N` limita as escritas da noite.
- Testes: `test:publicos`, `test:publicos-crm`, `test:cadencias`, `test:ultima-mensagem` e `test:pg`.
