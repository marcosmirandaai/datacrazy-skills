# Regras de medição

As regras que decidem o que cada número quer dizer. Quase todas nasceram de um número que estava
errado na tela; a data e a medida estão junto para saber de onde vieram.

## Conteúdo
1. "Não sei" não é zero — os dois projetos
2. Bases das taxas — os dois
3. Tempos de atendimento (SLA) — Base A
4. Quem atendeu (atribuição) — Base A; vendedor do disparo — Base B
5. Disparo lido na conversa — Base A
6. Retorno do disparo: janela e atribuição ao último toque — Base A
7. Pedido para sair da lista — os dois
8. Leitura das respostas no contexto do fluxo — Base B
9. Erros de envio e códigos da Meta — os dois (o mapeamento `tipoErro` é da Base B)

## 1. "Não sei" não é zero

- **No banco:** nulo quando não deu para medir (conversa ainda não relida; mensagem da automação não
  encontrada; janela de 20 mensagens sem o começo do ticket). Valor que encerra uma pendência sem
  medida tem código próprio (`disparo_saiu = -1`: "não dá mais para medir").
- **Na API:** agregados nulos quando nada foi medido (`responderam: null`, `taxa_resposta: null`); marca
  por lead em três estados (1 sim, 0 não, nulo não sei). No SQL, `MAX(CASE … THEN 2 … THEN 1 ELSE 0)`
  junta vários negócios do mesmo lead sem perder o "não sei".
- **Na tela:** "—" (com dica "sem leitura das mensagens ainda"), "ainda não medido", "não deu para
  medir", passo tracejado na trilha. `fmt.*` devolve "—" para nulo.
- **Zero vindo do CRM é fato** ("nenhum saiu", "0 pendentes"): mostre 0.
- Exceções conscientes em que "—" é zero ou ausência (tabela equipe × tipo, "Sem conversa" nas
  origens, "Pela tag" sem leads): documente quando fizer.

## 2. Bases das taxas

| Taxa | Numerador | Denominador | Por quê |
|---|---|---|---|
| Conversão (Base A) | negócios em "Matrícula Realizada" | negócios no recorte | — |
| Resposta ao disparo | responderam | **conversas medidas** (gatilho deste disparo na janela) | "0 de 53" quando só 5 foram medidos afirma mais do que se sabe |
| Leitura | lidos | entregues | quem desliga a confirmação de leitura não aparece como lido |
| Matrícula do disparo | matricularam na janela | enviados (concluídos) | quem ficou "não iniciado" nunca viu a mensagem |
| Pediu para sair | `disparo_saiu = 1` dentro da janela | conversas medidas **com a marca medida** (`disparo_saiu` 0 ou 1) | `-1` e nulo são "não sei": entram em "medidas" para entrega e resposta, mas não na base do pedido para sair. Hoje as telas mostram a contagem (e o KPI "Erro / saíram" soma erro + saíram sobre os leads com negócio); para uma taxa de pedido para sair, use esta base |
| Taxa de erro do impulso | `com_erro` (CRM) | lista do impulso | — |
| Dentro da meta | 1ª resposta ≤ 15 min | negócios respondidos | — |
| Funil (barras) | cada barra | a **primeira** barra | percentuais comparáveis dentro do funil |

## 3. Tempos de atendimento (SLA)

`calcularTempos` (Base A `src/ingest/metrics.js`) só conta mensagem com atendente humano:
- **1ª resposta:** da 1ª fala do cliente até a 1ª resposta humana.
- **Tempo médio de resposta:** média das esperas, uma por bloco de fala do cliente.
- **Tempo de atendimento:** da 1ª resposta humana até o fim, ou até agora se a conversa está aberta —
  por isso cresce sozinho (mediana ~306 h na carga histórica) e fica fora dos KPIs de gestão.
- Status da conversa: sem resposta humana, `Aguardando` (é o "Sem resposta" dos KPIs); com resposta,
  `Finalizada` se a conversa escolhida está finalizada, senão `Em andamento`.
- O gatilho de campanha (`campaign_event_trigger`) não é fala do cliente: fica fora do SLA
  (`dominio.corpoIgnorado`).
- Meta: 15 min; faixa de alerta: acima de 45 min. Mediana e p90 em JS (`floor(n·p)`).

## 4. Quem atendeu (atribuição)

`resolverPorDepartamento` (Base A), medido contra a base em 11–14/09/2026:
1. Exatamente uma tag de alguém da equipe do **funil** do negócio → `origem = 'tag'` (negócio fora dos
   funis de equipe usa o departamento do número de entrada).
2. Duas ou mais tags da equipe → vence a evidência datada mais recente (`tag-desempate`).
3. Sem tag da equipe → a evidência datada mais recente de alguém da equipe: conversa (`updatedAt`) ou
   negócio do lead no mesmo funil (`createdAt`) → `conversa` ou `negocio`.
4. Tag da equipe sem evidência datada → a 1ª tag, marcada `ambiguo`.
5. Nenhuma evidência → sem atendente: fora do ranking, contado à parte.

Sem cadastro de departamentos: tag → atendente da conversa → dono do negócio. Nomes passam por
`canonizarNome` e pelo mapa tag → pessoa (`nomeDaTag`).

**Transferência de carteira — o histórico não muda de dono (Base A, 16/10/2026).** A resolução acima
roda a cada rodada com o CRM de agora; quando a supervisão passa a carteira de alguém para outra pessoa,
o CRM passa a dizer outro dono e o negócio contaria para quem recebeu também nos meses anteriores. Regra
("não vamos mudar o histórico, e nem podemos" — responsável):
- no CRM, só se transfere o que está **em aberto** (negócio `in_process` fora de "Matrícula Realizada",
  conversa não finalizada); nada de editar ganho, perdido, mensagem ou evento;
- antes da primeira troca, a atribuição de agora (dono, efetivo, dono do lead, última conversa,
  colaborador) de **toda a carteira de quem sai** — e dos negócios da mesma conversa e do mesmo lead dos
  itens — vai para `atribuicao_congelada` (`INSERT … DO NOTHING`: a primeira foto vale para sempre).
  Toda a carteira, e não só o transferido: a matrícula que fica com quem vendeu pode ter outra conversa do
  lead transferida, e o passo 3 daria a venda a quem recebeu;
- o upsert do negócio (`salvarLote`) e da conversa sem negócio (`salvarConversas`) aplica a foto ao que
  **nasceu antes dela** e põe o dono de agora em `atendente_atual`. Medição por coorte: o que nasceu antes
  fica com quem tinha (inclusive uma matrícula que quem recebeu feche depois); o que nasce depois é de quem
  recebeu;
- desfazer é uma transferência nova, de volta — nunca apagar a anterior.
Prova: `testar-transferencia.mjs` compara os relatórios de setembro antes e depois da transferência, da
rodada que relê o CRM e do desfazer. Painel: `references/paineis/atendimento-plantao.md`.

Base B (vendedor do disparo): 1ª `conversation-attendant-changed` na conexão da campanha a partir de
(tag ou 1º template) − 10 min → distribuição do negócio/lead com `session_name` contendo "distribui" →
atendente atual da conversa → dono do negócio na pipeline Campanhas; a origem fica registrada.

## 5. Disparo lido na conversa

`medirCampanha` (Base A), sobre as mensagens que a rodada já busca:
- **Gatilho:** mensagem de entrada com corpo `campaign_event_trigger` (`firstTicketMessage`). Vale o
  **último** gatilho; `disparos` = quantos gatilhos.
- **Mensagem do disparo:** a 1ª com `received: false` e sem `attendant` depois do gatilho (a automação
  responde no mesmo minuto).
- **Entregue** = status `RECEIVED` ou `READ`; **lido** = `READ`; sem essa mensagem, os dois ficam nulos.
- **Respondeu** = existe fala do cliente depois do gatilho; tempo de resposta em horas.
- **Sem gatilho:** `disparos = 0`, a não ser que a janela esteja cheia (20) e sem o começo do ticket —
  aí `disparos = null` ("não sei").

## 6. Retorno do disparo: janela e atribuição ao último toque

Disparo só leva crédito do que causou: **de quem recebeu** (`status = 'completed'` no impulso), **depois
que chegou** naquele lead e **antes do próximo disparo concluído no mesmo lead**. É a mesma SQL na lista
e na página do impulso (Base A `src/api/consultas.js`):

```sql
WITH chegadas AS (
  SELECT id, chegou,
         LEAD(chegou) OVER (PARTITION BY lead_id ORDER BY chegou, id) AS proximo
  FROM (SELECT id, lead_id, COALESCE(finalizado_em, iniciado_em, status_mudou_em) AS chegou
        FROM impulso_leads
        WHERE status = 'completed' AND lead_id IS NOT NULL
          AND COALESCE(finalizado_em, iniciado_em, status_mudou_em) IS NOT NULL) e
)
-- dentro da janela:  col >= c.chegou AND (c.proximo IS NULL OR col < c.proximo)
-- MEDIDO:      c.id IS NOT NULL AND n.disparos > 0 AND <disparo_em dentro da janela>
-- MATRICULOU:  c.id IS NOT NULL AND n.etapa = 'Matrícula Realizada'
--              AND n.ultimo_movimento > c.chegou
--              AND (c.proximo IS NULL OR n.ultimo_movimento <= c.proximo)
```

- Entrega, leitura, resposta e "saiu" só contam com `MEDIDO` (o gatilho **deste** disparo está na
  conversa): em 08/10/2026 um único lead com gatilho de campanha anterior fazia a tela escrever
  "0 · 0,0%".
- Com recorte — a equipe escolhida no filtro, ou um papel com recorte (supervisor de equipe, atendente)
  —, "recebidos" é só quem tem negócio visível, e a API avisa (`so_equipe`) para a tela não chamar a
  parte de lista. (O supervisor, papel `supervisor`, vê o grupo inteiro.)
- **Unidade:** um lead que recebeu dois disparos conta uma vez em cada um, cada vez com a sua janela.
- **Atendente do lead** numa visão por disparo: `colaborador` (= `atendente_efetivo`, resolvido por tag
  e evidência) do negócio **hoje**, não o da data do disparo; com dois negócios do mesmo lead, a SQL
  pega `MAX()` por coluna. Para um painel "por atendente", decida e escreva qual vale.
- **Fora de impulso:** quem tem gatilho na conversa e nenhum impulso concluído no lead; o período vale
  pelo dia do gatilho; todos são "medidos" por definição.
- Medido em 04/10/2026 ("Campanha Agosto"): das 8 matrículas que a tela creditava, 7 eram de leads em
  "não iniciado" e 1 de lead com erro; dos 53 que receberam, nenhuma.

## 7. Pedido para sair da lista

Regra da Base B (`lib/classificacao.js`), medida contra as respostas reais e portada para a Base A
(`SAIR_DA_LISTA` em `src/ingest/metrics.js`). Texto normalizado (sem acento, sem pontuação,
minúsculas, espaços colapsados) e testado contra:

```js
/^(sair|sai|parar|pare|stop|remover|remova|descadastrar|cancelar)$/
/sair da (sua |dessa |desta )?lista/
/me (tire|tira|remova|remove|exclua|exclui) (da|dessa|desta|de sua|da sua) lista/
/(tire|tira|remova|remove|exclua|apague) (o )?meu (numero|contato)/
/parar de receber/, /pare de (me )?(mandar|enviar)/
/nao (me )?(mande|envie|mandem|enviem|mandar|enviar) mais/, /nao quero (mais )?receber/
/descadastr/, /parar promoc/, /stop promotions/, /nao tenho interesse em receber/
```

- A palavra solta só vale sozinha: "quero cancelar minha matrícula" não é pedido para sair.
- "Não quero, obrigado" é recusa da oferta, não pedido para parar — fica de fora.
- Conte **qualquer** fala do cliente depois do disparo, não só a primeira: o "SAIR" costuma vir depois
  de um "quem é?".
- Na Base B, o pedido para sair é o 1º teste da leitura no contexto do fluxo e conta como resposta.

## 8. Leitura das respostas no contexto do fluxo (Base B)

- `tipoResposta`, em ordem: anexo sem texto → humana; `^teste\s*\d*$` → teste; auto-resposta do
  WhatsApp Business do próprio lead ("agradece seu contato", "fora do horário") → automática; até 6
  palavras: interesse → botão de interesse, recusa → botão de recusa, "ok/bom dia" → ack; até 3
  palavras sem sinal → ack; o resto → humana.
- No contexto (só respostas não automáticas nem teste): sair da lista → falar com consultor → chamar
  mais tarde → adiar para outra data → período manhã/tarde (se o bot perguntou) → tem/sem projeto (se o
  bot falou em projeto); ramo "Excelente!": a última resposta livre antes dela vira `tem_projeto`.
- Template = mensagem do bot que começa com "Olá" e diz a marca nos primeiros 250 caracteres; o modelo
  sai do texto (`sem_compra`, `inativos`, `reengajamento`…); a base do disparo sai do texto do 1º
  template, com desempate pelas compras do lead.
- Etapa do funil do lead, por precedência: respondeu → só resposta automática → visualizou sem
  responder → recebeu sem visualizar → enviado sem confirmação → erro no envio → pendente → sem
  template → sem conversa na API.
- "Contato promissor" exige resposta humana ou botão de interesse e **4 ou mais mensagens trocadas** a
  partir da 1ª resposta. Continuidade só com resposta do lead (anotação não conta).

## 9. Erros de envio e códigos da Meta

- O código só vem pela REST de mensagens (as 20 últimas), em `erroCode`/`errorMessage`. Vale o **último
  envio**: erro recuperado não é erro atual.
- Códigos: 131026 não entregue; 131049 engajamento (bloqueio da Meta); 131047 fora da janela de 24 h;
  131042 pagamento; 130472 número em experimento; 131053 mídia.
- `tipoErro` (Base B): `eligibility|payment` → pagamento; `131049|ecosystem` → engajamento;
  `131047|re-engagement|more than 24 hours` → janela de 24 h; `undeliverable` → não entregue;
  `experiment` → experimento; `contact not found`; `media upload|downloading media` → mídia; outro;
  sem código.
- Impulso do tipo `automation` não traz erro por lead (`errorCode` nulo): na Base A, o card mostra
  "Erro no fluxo do CRM — o CRM não informa o motivo".
