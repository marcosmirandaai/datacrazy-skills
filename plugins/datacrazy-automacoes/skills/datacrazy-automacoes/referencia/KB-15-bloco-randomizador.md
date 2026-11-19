# KB-15 — Bloco Randomizador — `type: "randomizer"`

"Divida o fluxo em ramificações aleatórias." Cada sessão que entra sai por **uma** das ramificações, sorteada segundo os percentuais. 47 blocos e 156 ramificações nos modelos.

Níveis ✅ 🟡 ⚠️ ⛔: ver KB-10. O bloco é ✅.

---

## 1. Estrutura

```json
{
  "id": "uuid-v4",
  "type": "randomizer",
  "presentation": { "x": 914, "y": 0 },
  "sourceBlockId": null,
  "options": {
    "randomizers": [
      { "id": "uuid-v4", "name": "A", "perc": 34, "nextBlockId": "uuid-caminho-a" },
      { "id": "uuid-v4", "name": "B", "perc": 33, "nextBlockId": "uuid-caminho-b" },
      { "id": "uuid-v4", "name": "C", "perc": 33, "nextBlockId": "uuid-caminho-c" }
    ]
  }
}
```

- **Sem** `nextBlockId` no bloco e **sem** saída de erro. Cada ramificação é uma saída.
- Ramificação: `{ "id", "name", "perc", "nextBlockId" }`.
- `name`: o editor nomeia pela posição, **A, B, C … Z**, e depois A1, B1. Use as letras na ordem.
- `perc`: número (aceita decimais: `33.33`, `33.34`). Nos modelos: 33.33/33.34, 25, 20 e 50.

### Percentuais

- "Modifique as ramificações e seus percentuais." O editor alerta: "A soma dos percentuais deve ser **100%** para correta distribuição." Valores acima ou abaixo são aceitos, mas distorcem a divisão.
- "Adicionar ramificação" redistribui igualmente quando as ramificações já estavam iguais.
- **Pesos diferentes** são permitidos: vendedora sênior com 40 e duas juniores com 30.
- **Ramificação com `perc: 0`** (3 nos modelos): mantém o caminho desenhado, mas **pausa** aquele destino (vendedor de férias) sem apagar ligações.
- **Uma ramificação com 100**: equivale a um caminho único. Serve para "desligar" o sorteio temporariamente.

---

## 2. Quando usar

| Objetivo | Como | Nos modelos |
|---|---|---|
| **Distribuir leads entre atendentes** | Uma ramificação por atendente → bloco de Ações "Transferir atendente ao negócio" + "Transferir atendente da conversa" (KB-12). | 132 ramificações vão direto para transferência de atendente. |
| **Teste A/B de mensagem** | A e B com 50 cada → Mensagens diferentes → a mesma tag de variante (`teste-a`, `teste-b`) para medir. | — |
| **Variar respostas públicas** para não parecer robô | 3 ramificações → 3 "Resposta do Comentário" diferentes → convergem no mesmo direct. | Modelo oficial de comentário do Instagram. |
| **Distribuição por turno** | Condição de horário (KB-13) por turno → um Randomizador por turno com o time daquele horário. | "Distribuição Equipe 2": 28 condições de tempo → Randomizador. |
| **Amostragem** | 10 / 90: só 10% dos leads recebem a pesquisa. | — |

## 3. Quando não usar

- **Round-robin exato** (um para cada, na ordem): o sorteio é aleatório, e em amostras pequenas um atendente pode receber três seguidos. Para rodízio estrito, guarde um contador (campo adicional da empresa ou fonte externa) e decida com JavaScript + condição.
- **Critério de negócio** (região, produto, faixa de valor): use Condições. O Randomizador ignora os dados do lead.
- **Lead que já tem dono**: antes do sorteio, "Conversa possui atendente responsável" ou "Negócio possui atendentes" (KB-13). Se já tem, mantém.

## 4. Padrão completo de distribuição

```text
[Iniciado por outra automação]
   → Condição: Conversa possui atendente responsável? ── sim → Notificação ao atendente atual
   → não → Condição de horário (turno)
        → Randomizador (A 34 · B 33 · C 33)
             A → Ações: Transferir atendente ao negócio (Ana, addSameAttendantToLead: true) + Transferir atendente da conversa (Ana)
             B → idem (Bruno)
             C → idem (Carla)
        → Espera 10 min (refresh true) → Condição: Conversa possui atendente? não → Notificação ao gestor
```

## 5. Erros comuns

1. **`nextBlockId` no bloco** em vez de nas ramificações.
2. **Soma diferente de 100** sem intenção.
3. **Ramificação sem destino**: quem cai nela para ali.
4. **Sortear quem já tem atendente**: o lead troca de vendedor a cada mensagem.
5. **IDs de atendentes inventados** nas ações de cada ramificação: são Pendência.
