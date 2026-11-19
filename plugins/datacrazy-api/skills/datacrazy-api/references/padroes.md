# Padrões de código para a API Datacrazy

Node 22+/24, ESM, sem dependências (fetch nativo). Adapte nomes ao projeto; mantenha a lógica.

## 1. Cliente com cota por rota

Um balde por rota (janela deslizante), compartilhado por todos os tokens, reservas serializadas por
fila, limites aprendidos dos cabeçalhos, 429 congela a rota. Origem: Base A `src/datacrazy/client.js`.

```js
const dormir = (ms) => new Promise((r) => setTimeout(r, ms));

class CotaDeRota {
  constructor(limite, janelaS) { this.limite = limite; this.janelaMs = janelaS * 1000; this.carimbos = []; this.bloqueadoAte = 0; this.fila = Promise.resolve(); }
  reservar() { const p = this.fila.then(() => this.#agora()); this.fila = p.catch(() => {}); return p; }
  async #agora() {
    for (;;) {
      const t = Date.now();
      if (t < this.bloqueadoAte) { await dormir(this.bloqueadoAte - t); continue; }
      this.carimbos = this.carimbos.filter((c) => t - c < this.janelaMs);
      if (this.carimbos.length < this.limite) { this.carimbos.push(t); return; }
      await dormir(this.janelaMs - (t - this.carimbos[0]) + 60);
    }
  }
  aprender(h) {
    const lim = Number(h.get('x-ratelimit-limit')), reset = Number(h.get('x-ratelimit-reset'));
    if (lim > 0) this.limite = lim;
    if (reset > 0) this.janelaMs = Math.max(this.janelaMs, reset * 1000);   // reset é o que falta: só piso
  }
  bloquear(ms) { this.bloqueadoAte = Math.max(this.bloqueadoAte, Date.now() + ms); this.carimbos = []; }
}

// ids viram :id, senão cada lead/conversa ganha um balde próprio
const rotaDe = (p) => p.split('?')[0]
  .replace(/\/[0-9a-f]{24}(?=\/|$)/gi, '/:id')
  .replace(/\/[0-9a-f-]{36}(?=\/|$)/gi, '/:id');

const COTAS = { '/businesses': 60, '/leads': 60, '/conversations': 20, '/conversations/:id/messages': 60,
  '/attendants': 20, '/departments': 20, '/company-users': 20, '/instances': 20, '/boosts': 20,
  '/tags': 60, '/pipelines': 60, '/pipelines/:id/stages': 60 };   // as três últimas: 10/10/2026
```

`get(caminho, params)`:
1. `await cota(rotaDe(caminho)).reservar()` (cota desconhecida começa em 20/60).
2. `fetch` com `Authorization: Bearer`, timeout ~45 s (`AbortSignal.timeout`).
3. `cota.aprender(res.headers)`.
4. 429 → `cota.bloquear((Retry-After || recuo) * 1000 + 1000)` e repete. `Retry-After` 0 → recuo
   5·2^tentativa s, teto 120.
5. 400 com `/timeout/i` no corpo → repete 2× com 5 s; depois lança erro com `err.timeout = true`
   (o paginador reduz o `take`).
6. 5xx/rede → recuo exponencial com jitter (teto 30 s), até N tentativas. Outros 4xx → lança.

Query string no formato da API: objeto vira `chave[sub]=valor`
(`{ filter: { lastMovedAfter: x }, order: { lastMovedAt: 'desc' } }`).

## 2. Varredura por cursor (passa do teto de skip 11.000)

Negócios: `campo = 'lastMovedAt'`, `filtroAte = 'lastMovedAtLessOrEqual'`.
Leads: `campo = 'createdAt'`, `filtroAte = 'createdAtLessOrEqual'`.

```js
export async function* paginarPorCursor(caminho, params = {}, { campo, filtroAte, take = 1000, maxPaginas = 500 }) {
  let cursor = new Date().toISOString();
  let skip = 0;
  for (let pagina = 1; ; pagina++) {
    let corpo;
    try {
      corpo = await get(caminho, { ...params, skip, take,
        order: { [campo]: 'desc', id: 'desc' },
        filter: { ...(params.filter || {}), [filtroAte]: cursor } });
    } catch (err) {
      if (err.timeout && take > 100) { take = Math.max(100, Math.floor(take / 2)); pagina--; continue; }
      throw err;
    }
    const itens = Array.isArray(corpo) ? corpo : corpo?.data ?? [];
    yield itens;
    if (itens.length < take) break;
    if (pagina >= maxPaginas) throw new Error('cursor não anda');            // defeito, não fim
    const ultimo = itens.at(-1)[campo];
    if (!ultimo) throw new Error(`item ${itens.at(-1).id} sem ${campo}`);
    const empatados = itens.filter((i) => i[campo] === ultimo).length;
    skip = ultimo === cursor ? skip + empatados : empatados;                 // skip só dentro do instante
    cursor = ultimo;
  }
}
```

Depois da varredura de negócios, uma página com `filter[lastMovedAfter] = <instante do início>` traz
o que se moveu durante a leitura. Validação: ids únicos lidos = `count` da API (Base A: 14.881/14.881;
Base B 07/10/2026: 16.809 sem repetição, antes ~11 mil).

## 3. Índice de conversas em fatias

`/conversations` ignora ordem e filtro de data, então não há cursor. Fatie:

1. as 1000 mais recentes sem filtro (a "vitrine", prova que nenhum status ficou de fora);
2. cada `filter[status]` ∈ `unstarted, waiting, opened, automation, finished, error`, por skip até 10.000;
3. status que encheu o teto → de novo por `filter[instances]=<id da conexão>` dentro dele.

Página vazia logo após uma cheia = **cortada**, não completa. Devolva `{ porContato, completo }` e só
trate "não está no índice" como "não tem conversa" se `completo`. Medido 04/10/2026: maior status
(automação) com 10.786; a soma por conexão fechou sem sobra. A 20 req/min, ~45 req ≈ 2–3 min.

Indexe em memória por `contact.contactId` (mesma chave do `search`) e guarde só os campos usados
(o payload traz token de instância em `instance.config`).

## 4. Detecção de mudança (gasta /messages só no que andou)

```js
import { createHash } from 'node:crypto';
const VERSAO_DA_REGRA = 3;   // suba quando a regra de cálculo mudar: força recalcular tudo
const assinatura = (n, conversa) => createHash('sha1').update(JSON.stringify([
  VERSAO_DA_REGRA, n.stageId, n.pipelineId, (n.tags || []).map((t) => t.id).sort(),
  n.attendantId, conversa?.id, conversa?.updatedAt,
])).digest('base64url');
```

Por negócio da varredura:
- assinatura igual à gravada → pula (0 requisição);
- mudou, mas a conversa não andou (`updatedAt` igual) → recalcula com o que está no banco (0 req);
- conversa nova ou andou → entra na fila de `/messages`.

Fila com prioridade (novos → conversas que andaram → histórico), teto por tipo de rodada
(ex.: 300 horária, 3000 noturna). O excedente é gravado **sem assinatura**, para entrar na próxima.

## 5. Trava de plausibilidade e exclusão segura

```js
function conferirLeitura({ lidosAgora, lidosAntes, indiceCompleto, conhecidas, noIndice }) {
  if (lidosAntes && lidosAgora < lidosAntes * 0.5) throw new Error(`varredura trouxe ${lidosAgora} de ${lidosAntes}: abortado sem gravar`);
  if (indiceCompleto && conhecidas && noIndice < conhecidas * 0.5) throw new Error('índice "completo" sem metade das conversas conhecidas');
}
```

Carga completa que remove o que não veio: só se faltantes ≤ 10% da tabela; acima, mantenha e avise.
Antes de apagar algo que importa para relatório, copie para uma tabela de excluídos (métrica à parte).

## 6. Escrita em lote no Postgres (Neon/Supabase)

Upsert multi-linha de ~400 por instrução, deduplicando dentro do lote (senão
`ON CONFLICT DO UPDATE command cannot affect row a second time`), e `COALESCE` no lugar de SELECT
prévio. Pool pequeno (`max: 3`), host `-pooler` do Neon, `pool.on('error')` porque o Neon suspende o
endpoint ocioso. Medido: de 20+ min (15 mil idas e voltas) para 11,5 s.

## 7. Uma rodada por vez

Linha em `execucoes` com status `executando` e `pulsacao_em` atualizada a cada ~30 s; outra rodada
só começa se não houver batimento nos últimos 15 min. No Actions, também
`concurrency: { group: <nome>, cancel-in-progress: false }`.

## 8. Lista sem ordem estável (`/boosts/{id}/leads`)

Todos os leads de um impulso entram no mesmo instante: com `order`, a janela do `skip` escorrega
(repete uns, some com outros); sem `order`, o embaralhamento muda a cada chamada. Leia por estado,
página do tamanho máximo, e releia enquanto faltar gente perto do número de `/metrics`. Origem: Base A
`src/ingest/impulsos.js` (`lerLeadsDoImpulso`).

```js
const POR_PAGINA = 1000, MAX_PAGINAS = 60, MAX_PASSADAS = 3;   // 1500 responde 400
const ESTADOS = ['created', 'pending', 'started', 'completed', 'error'];

async function lerLeadsDoImpulso(id, { esperado = {}, andando = false }) {
  const linhas = new Map();
  // Rodando, as métricas envelhecem entre as duas leituras: sem alvo, lê cada estado uma vez.
  const comAlvo = !andando && Object.keys(esperado).length > 0;
  for (const status of ESTADOS) {
    const alvo = comAlvo ? Number(esperado[status] ?? 0) : null;
    if (alvo === 0) continue;                       // /metrics só lista estado com gente
    const vistos = new Set();
    let skipIgnorado = false;
    for (let passada = 1; passada <= MAX_PASSADAS && !skipIgnorado; passada++) {
      const antes = vistos.size, nestaPassada = new Set();
      let cheiasSemNovidade = 0;
      for (let pagina = 0; pagina < MAX_PAGINAS; pagina++) {
        const lote = (await get(`/crm/boosts/${id}/leads`,
          { filter: { status }, skip: pagina * POR_PAGINA, take: POR_PAGINA }))?.data ?? [];
        let novos = 0;
        for (const i of lote) {
          if (!nestaPassada.has(i.id)) { nestaPassada.add(i.id); novos++; }
          vistos.add(i.id); linhas.set(i.id, i);    // i.lead?.id é nulo para lead excluído no CRM
        }
        if (lote.length < POR_PAGINA) break;        // página incompleta: fim da lista
        cheiasSemNovidade = novos ? 0 : cheiasSemNovidade + 1;
        if (cheiasSemNovidade >= 2) { skipIgnorado = true; break; }   // a rota ignorou o skip
      }
      if (alvo === null || vistos.size >= alvo || vistos.size === antes) break;
    }
  }
  return [...linhas.values()];   // grave substituindo a lista do impulso
}
```

Releia a lista só quando o impulso andou (`updatedAt` mudou) ou quando o gravado não cobre
`recordsCount`. Validação: 1.500 de 1.500 em 4 chamadas com janela instável simulada; rota que ignora o
`skip` percebida em 3 chamadas.

## 9. Releitura dirigida (regra nova que depende do texto)

A assinatura (seção 4) só manda reler mensagens quando a conversa andou, e subir `VERSAO_DA_REGRA`
remonta a linha **sem** reler. Uma regra nova que precisa do texto da mensagem (ex.: detectar "SAIR"
depois de um disparo) não alcança o que já foi medido. Faça uma releitura dirigida e única:

```js
// quem precisa: tem o fato antigo e não tem o novo
const precisaMedirSaida = (salvo) => !!salvo && Number(salvo.disparos) > 0 && salvo.disparo_saiu == null;

function decidir({ salvo, conversa, assinatura }) {
  if (precisaMedirSaida(salvo) && conversa?.id) return 'mensagens';   // antes do "igual"
  // … regra normal (igual / mensagens / remontar)
}
```

- Na fila do teto de mensagens, ponha a releitura **depois** das conversas que andaram (são números
  desatualizados de verdade) e antes do histórico.
- Feche a pendência quando não der para medir (o gatilho saiu da janela das 20 mensagens): grave um
  valor próprio (`-1`) — sem ele, a mesma conversa seria relida em toda rodada, para sempre.
- O custo é finito e conhecido: uma requisição de mensagens por registro pendente, diluída pelos tetos
  das rodadas.
