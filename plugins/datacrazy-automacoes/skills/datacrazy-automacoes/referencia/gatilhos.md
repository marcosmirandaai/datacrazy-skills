# Gatilhos (nó Início → "Adicionar gatilho")

Um mesmo Início aceita **vários gatilhos**; qualquer um deles dispara o fluxo.
No JSON eles ficam em `options.triggers[]` com `{ name, group, options }`.

## Negócios (`group: business`)
| Gatilho | Quando dispara | Config |
|---|---|---|
| Negócio movido | negócio é movido para a etapa | etapa |
| Negócio criado | negócio é criado em uma etapa | `stageId` |
| Atendente atribuído ao negócio | atendente é atribuído | — |
| Atendente retirado do negócio | atendente é removido | — |
| Negócio ganho | marcado como ganho | — |
| Negócio perdido | marcado como perdido | — |
| Situação do negócio restaurada | status é restaurado | — |

## Leads (`group: lead`)
| Gatilho | Quando dispara |
|---|---|
| Execução manual da automação por lead ou contato | você roda à mão a partir de uma seleção/filtro de leads ou pelo contato no multiatendimento (`manually-lead-trigger`) |
| Tag adicionada ao lead | tag é adicionada |
| Tag removida do lead | tag é removida |
| Lead criado | lead é criado |
| Lead atingir uma quantidade definida de negócios ganhos | contagem de ganhos alcança N |
| Lead ultrapassar um valor definido de negócios ganhos | soma de ganhos passa de R$ X |
| Lead não realiza compras nos últimos dias | inatividade de compra |

## Mensagens (`group: messages`)
| Gatilho | Config observada |
|---|---|
| Mensagem recebida | `type`, `keywords`, `instanceId`, `listenGroup`, `receiveJson`, `initializeSession`, `datasourceName` |
| Mensagem enviada | — |
| Atendimento iniciado | — |
| Atendimento finalizado | `instanceId` |
| Departamento alterado | `instanceId`, `departmentId` |

`keywords` filtra por palavra-chave; `listenGroup` inclui mensagens de grupo;
`receiveJson` expõe o payload cru como fonte de dados.

## Instagram
- Comentário do Instagram recebido
- Comentário em live do Instagram recebido

(apenas comentários — mensagens de Instagram caem em **Mensagens**)

## Facebook
- Comentário do Facebook recebido
- Comentário em live do Facebook recebido

## Campos
- **Campo alterado** — quando um campo do lead ou do negócio muda
  (campos do sistema ou campos adicionais)

## HTTP
- **Requisição HTTP (Webhook)** — o fluxo ganha uma URL; qualquer POST/GET
  nela dispara a automação e o corpo vira fonte de dados.

## Sistema (`group: system`)
| Gatilho | Uso |
|---|---|
| Iniciado por outra automação | fluxo é chamado pela ação "Iniciar outra automação"; recebe parâmetros (`datasourceName`) |
| MCP Server Tool | um agente de IA chama esta automação como *tool* via MCP — combine com a ação **Retornar resultado da tool** |
| Execução Agendada | dispara em intervalo de tempo fixo (cron) |

## Atividades
- **Atividade executada** — quando uma atividade marcada com automação é executada
