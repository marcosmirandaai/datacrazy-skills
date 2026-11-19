# KB-06 — Roteiro de Descoberta

Como o consultor transforma material bruto (transcrição de reunião, formulário de perguntas e respostas, briefing, áudio transcrito) em automações bem especificadas, conversando com quem usa o agente antes de gerar qualquer JSON.

---

## 1. Plano de automações

### Como extrair do material

- **Leia tudo antes de responder.** Informação do fim da reunião costuma corrigir o começo.
- **Marque os gatilhos de trabalho**: "quando o lead…", "depois que comprar…", "se não responder…", "todo dia…", "avisar o time quando…". Cada um vira uma automação ou um ramo de uma.
- **Agrupe** o que tem o mesmo gatilho e o mesmo público numa automação só. **Separe** quando muda o gatilho, o público ou o canal.
- **Ordene por dependência**: quem cria o lead, o negócio, a tag ou a etapa usada por outra vem antes. Roteador e subfluxos andam juntos.
- **Separe o claro do vago**: o que foi dito com clareza vira confirmação; o que ficou vago, implícito ou contraditório vira pergunta.

### Modelo de resposta

> **🗺️ Plano de automações**
>
> Li a transcrição e identifiquei **4 automações**:
>
> | nº | Automação | Objetivo | Gatilho provável | Já está claro | Falta entender |
> |---|---|---|---|---|---|
> | 1 | Captação da landing page | Criar lead e negócio sem duplicar | Formulário (webhook) | Campos do formulário; pipeline Comercial | Quem é avisado; o que fazer com lead repetido |
> | 2 | Boas-vindas e qualificação | Qualificar em até 24h | Negócio criado em "Novo lead" | As 3 perguntas de qualificação | Tom das mensagens; quem não responde |
> | 3 | Follow-up de proposta | Recuperar propostas paradas | Negócio em "Proposta enviada" | Cadência de 2, 5 e 10 dias | Critério de parada; horário comercial |
> | 4 | Pós-venda | Ativar o cliente | Negócio ganho | Mensagem de boas-vindas | Como saber se o cliente acessou |
>
> **Ordem sugerida:** 1 → 2 → 3 → 4. A 1 cria o lead e o negócio que as outras usam.
>
> Faltou alguma automação? Posso começar pela **1**?

---

## 2. Roteiro por automação: os 10 temas

Cubra todos. Não pergunte o que o material já responde: confirme em uma frase.

**1. Objetivo e sucesso** — o resultado de negócio e como medir.
- "O que precisa ter acontecido para você considerar que a automação funcionou?"

**2. Gatilho e público** — quem entra, quando e por onde.
- "Entra todo lead do formulário ou só de uma campanha?"
- "Quem já é cliente também passa por esse fluxo?"

**3. Jornada e mensagens** — passos, textos, perguntas ao lead, botões, mídias.
- "Você já tem os textos ou eu proponho?"
- "A pergunta é aberta ou com opções em botão?"

**4. Tempo** — esperas, horário comercial, prazo de resposta.
- "Quanto tempo esperamos a resposta antes de considerar que não respondeu?"
- "Pode enviar à noite ou no fim de semana?"

**5. Decisões** — o critério de cada caminho.
- "Se ele responder que não tem interesse, o que acontece?"
- "O que diferencia um lead quente de um frio?"

**6. Dados** — o que captar, onde guardar, o que já existe na conta.
- "Esse dado vai para campo adicional, tag ou etapa?" (lead Pessoa, lead Empresa ou negócio)
- "Tem token, chave ou URL da conta?" → parâmetro do sistema; token no tipo Secreto (KB-03, seção 4.2).
- "A tag ou etapa já existe? Qual o nome exato?"

**7. Integrações e lacunas** — sistemas externos e a informação que falta para decidir.
- "Essa informação está em algum sistema com API?"
- "Posso usar IA para interpretar a resposta do lead?"

**8. Pessoas** — quem é avisado, quem assume, departamentos.
- "Quem recebe o aviso quando o lead qualificar?"
- "Em que momento um humano assume a conversa?"

**9. Encerramento** — critério de parada e destino de quem não responde.
- "Depois da última tentativa, o negócio vai para perdido?"

**10. Entrega** — automação nova ou trecho num fluxo existente.
- "É uma automação nova ou vamos acrescentar num fluxo que já existe?" Colagem não cria tags, etapas nem campos (KB-01, seção 10).

---

## 3. Como perguntar

**Anuncie o foco.**
> Vamos começar pela **Automação 1 — Captação da landing page**. Para montá-la, preciso entender quem é avisado, o que fazer com lead repetido e se a pipeline já existe.

**Até 5 perguntas por rodada**, numeradas, das que mudam a estrutura para as de detalhe.

**Motivo curto e sugestão padrão em cada pergunta**, para o usuário poder responder só "ok":
> 2. **O que fazer quando o lead já existe?** Isso muda o começo do fluxo.
> *Sugestão: atualizar os dados e criar negócio só se não houver um aberto na pipeline.*

**Cite o material** para confirmar em vez de perguntar:
> Na reunião, a Ana disse que o prazo de resposta é 24 horas. Mantenho?

**Aponte contradições** e peça decisão:
> No formulário está 3 dias; na reunião ficou 5. Qual vale?

**Fale a língua do usuário**, não a do JSON: "etapa", "tag", "aviso para o time". Nunca `stageId` ou `send-notification-action` numa pergunta.

**Feche cada rodada** dizendo o que ainda falta:
> Com isso resolvo o gatilho e a deduplicação. Na próxima rodada: mensagens e tempos.

**Aceite respostas curtas.** "ok", "pode ser", "segue a sugestão" confirmam a sugestão daquela pergunta. Resposta ambígua pede uma confirmação curta, não uma nova rodada inteira.

---

## 4. Recursos extras para preencher lacunas

Sempre pergunte se pode usar recursos que buscam ou interpretam informação. Proponha onde ajudariam, com o custo:

**IA: Intenção de conversa** — interpretar uma resposta livre e escolher o caminho.
- Exemplo: "tem interesse", "agora não", "quer falar com uma pessoa".
- Custo: tokens por execução.

**IA: Extrator de parâmetros** — tirar dados estruturados da conversa.
- Exemplo: nome da empresa, faturamento, cidade.
- Custo: tokens; conferir a extração no teste.

**IA: Assistente de chat** — responder dúvidas e conduzir a conversa.
- Exemplo: SDR que qualifica e agenda.
- Custo: tokens; exige um prompt bem escrito.

**API** — buscar informação em sistema externo para decidir.
- Exemplo: o aluno acessou a plataforma? O pedido foi pago? Qual o endereço do CEP?
- Custo: token de API; depende do sistema estar no ar.

**API do Datacrazy** — consultar ou alterar o próprio CRM além dos blocos nativos (KB-07).
- Exemplo: quanto o lead já gastou? Ele tem outros negócios abertos? A conexão está no ar?
- Custo: uma chave de API da conta; limite de 60 chamadas por minuto por rota.

**JavaScript** — calcular ou aplicar regra de negócio.
- Exemplo: dias desde a última compra; faixa de preço; data de agendamento.
- Custo: manutenção do código.

Formato sugerido:
> **Posso usar recursos extras?** Para saber se o cliente já acessou a plataforma, posso consultar a **API** dela a cada checagem, em vez de depender de alguém mover o card. Vai precisar de um token da plataforma. Sigo assim?

Se o usuário recusar, construa com o que é determinístico (condições, tags, etapas) e registre a limitação no resumo.

---

## 5. Quando parar de perguntar

Pode planejar quando:

- Gatilho, público, jornada, decisões e encerramento estão definidos, ou com suposição aceita.
- **Todo caminho tem destino**, incluindo "não respondeu" e erro.
- Os recursos extras foram aceitos ou recusados.
- O formato de entrega (importar ou colar) está definido.

Faltam só valores da conta (atendente, conexão, token, link)? **Não trave**: siga e liste em Pendências.

Diga explicitamente:
> Tenho o que preciso para a **Automação 1**. Antes do JSON, vamos revisar o plano juntos.

Mostre o **📋 Plano da automação** (prompt, passo 3): resumo, passo a passo numerado com bloco, item, opções, mensagens e destino de cada saída, diagrama, dados e Pendências. Termine com "Quer ajustar algum passo ou posso gerar o JSON?" e **só gere o JSON depois da aprovação**.

---

## 6. Acompanhar o plano

Depois de cada entrega:

> **🗺️ Plano** · ✅ 1. Captação da landing page · 🔄 2. Boas-vindas e qualificação · ⏳ 3. Follow-up de proposta · ⏳ 4. Pós-venda
>
> Próxima: **Automação 2 — Boas-vindas e qualificação**. Para ela, preciso entender: …

Automações que dependem umas das outras (roteador e subfluxos, ou uma que cria as tags usadas por outra) podem sair **no mesmo arquivo** de importação.

---

## 7. Perguntas ao lead dentro do fluxo

Toda pergunta feita ao lead usa o mesmo padrão (detalhes no KB-11, Entrada do usuário):

1. **Mensagem de texto** com a pergunta, com ou sem botões.
2. **Entrada do usuário** logo em seguida, no mesmo bloco de Mensagem, **sem campo do CRM selecionado**. Ela só aguarda a resposta.
3. Saída **"próximo passo"** (`nextBlockId` do bloco) → o lead respondeu digitando.
4. Saída **"caso o usuário não responda"** (`timeoutNextBlockId` da Entrada do usuário) → o lead não respondeu no prazo.
5. Botões, quando houver, levam cada um ao próprio caminho.

Na descoberta, para cada pergunta ao lead, confirme: o texto, o prazo de espera e o que acontece em cada saída.
