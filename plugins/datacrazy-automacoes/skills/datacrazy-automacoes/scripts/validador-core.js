/* Validador de automações Datacrazy — o mesmo código roda no canvas (KB-05), no build e na skill. */

// Converte uma automação (formato de importação) no formato que o editor do CRM aceita ao colar blocos:
// uma lista de nós do canvas, sem gatilho e sem envelope.
function paraColagem(automacao) {
  var ALTURA = { chat: 250, action: 276, condition: 289, delay: 213 };
  return ((automacao && automacao.blocks) || []).filter(function (b) { return b.type !== "trigger"; }).map(function (b) {
    var pos = b.presentation || { x: 0, y: 0 };
    return {
      data: { id: b.id, type: b.type, sourceBlockId: b.sourceBlockId === undefined ? null : b.sourceBlockId, options: b.options, presentation: pos },
      id: b.id,
      type: b.type,
      deletable: true,
      position: { x: pos.x, y: pos.y },
      width: 312,
      height: ALTURA[b.type] || 250,
      selected: true
    };
  });
}

// Classifica uma URL do Datacrazy (KB-07 e KB-08). Regra de set/2026: os domínios internos crm.g1, messaging.g1
// e accounts.g1 deixam de responder; o mesmo caminho vai para api.g1.datacrazy.io/api/v1/<serviço>/. Webhooks não mudam.
function classificarUrlDatacrazy(url) {
  var u = String(url || "");
  if (!/datacrazy\.io/i.test(u)) return null;
  if (/\/api\/crm\/flows\/webhooks\//i.test(u)) return { tipo: "webhook" };
  var m = u.match(/^https?:\/\/(crm|messaging|accounts)\.g1\.datacrazy\.io\/api\/(?:crm|messaging|accounts)(\/[^?#\s]*)?/i);
  if (m) return { tipo: "interna", publica: "https://api.g1.datacrazy.io/api/v1/" + m[1].toLowerCase() + (m[2] || "") };
  if (/^https?:\/\/[a-z0-9-]+\.g1\.datacrazy\.io\/api\//i.test(u) && !/^https?:\/\/api\.g1\.datacrazy\.io\//i.test(u)) return { tipo: "servico-interno" };
  if (/^https?:\/\/api\.g1\.datacrazy\.io\//i.test(u) && !/^https?:\/\/api\.g1\.datacrazy\.io\/api\/v1(\/|$)/i.test(u)) return { tipo: "fora-v1" };
  return { tipo: "ok" };
}
// Mensagem do validador para uma URL do Datacrazy, ou null quando está certa.
function problemaUrlDatacrazy(url) {
  var c = classificarUrlDatacrazy(url);
  if (!c) return null;
  if (c.tipo === "interna") return ["erro", "rota interna " + String(url).split("?")[0] + " deixa de funcionar na próxima release do Datacrazy — use " + c.publica + " (KB-08)."];
  if (c.tipo === "servico-interno") return ["erro", "serviço interno do Datacrazy fora do comunicado (" + String(url).split("/").slice(0, 3).join("/") + ") — não use em automação (KB-08)."];
  if (c.tipo === "fora-v1") return ["aviso", "API do Datacrazy fora de https://api.g1.datacrazy.io/api/v1/ (KB-07 e KB-08)."];
  return null;
}

// Automações que uma automação chama com "Iniciar outra automação", direta ou indiretamente (inclui ela mesma), na ordem do arquivo.
function automacoesChamadas(doc, ids) {
  var autos = ((doc && doc.data) || {}).automations || [], porId = {}, vistos = {}, fila = [].concat(ids);
  autos.forEach(function (a) { porId[a.id] = a; });
  while (fila.length) {
    var id = fila.shift();
    if (vistos[id] || !porId[id]) continue;
    vistos[id] = 1;
    (porId[id].blocks || []).forEach(function (b) {
      ((b.options || {}).actions || []).forEach(function (x) { if (x.name === "start-another-automation-action" && x.options) fila.push(x.options.automationId); });
    });
  }
  return autos.filter(function (a) { return vistos[a.id]; }).map(function (a) { return a.id; });
}

// Grupos de automações ligadas por "Iniciar outra automação" (quem chama e quem é chamado vão no mesmo arquivo).
function gruposDeAutomacoes(doc) {
  var autos = ((doc && doc.data) || {}).automations || [], grupo = {}, n = 0;
  autos.forEach(function (a) {
    if (grupo[a.id] !== undefined) return;
    var fila = [a.id];
    while (fila.length) {
      var id = fila.shift();
      if (grupo[id] !== undefined) continue;
      grupo[id] = n;
      automacoesChamadas(doc, [id]).forEach(function (x) { fila.push(x); });
      autos.forEach(function (o) { if (automacoesChamadas(doc, [o.id]).indexOf(id) > -1) fila.push(o.id); });
    }
    n++;
  });
  var saida = [];
  autos.forEach(function (a) { (saida[grupo[a.id]] = saida[grupo[a.id]] || []).push(a.id); });
  return saida;
}

// Arquivo de importação só com as automações pedidas, as que elas chamam e as dependências de data.* que usam.
function separarAutomacoes(doc, ids) {
  var d = (doc && doc.data) || {}, manter = automacoesChamadas(doc, ids);
  var autos = (d.automations || []).filter(function (a) { return manter.indexOf(a.id) > -1; });
  var texto = JSON.stringify(autos);
  var usa = function (r) { return !!(r && r.id && texto.indexOf(r.id) > -1); };
  var campoUsado = function (f) {
    if (usa(f) || texto.indexOf("additional-field[" + f.name + "]") > -1) return true;
    return ['AdditionalValue(\\"', "AdditionalValue('", "AdditionalValue(`"].some(function (p) { return texto.indexOf(p + f.name) > -1; });
  };
  var horarios = (d.workingHours || []).filter(usa);
  var deptos = (d.departments || []).filter(function (x) { return usa(x) || horarios.some(function (h) { return h.departmentId === x.id; }); });
  return {
    hasInvalidReferences: false,
    data: {
      tags: (d.tags || []).filter(usa),
      additionalFields: (d.additionalFields || []).filter(campoUsado),
      businessLossReasons: (d.businessLossReasons || []).filter(usa),
      activityTypes: (d.activityTypes || []).filter(usa),
      pipelines: (d.pipelines || []).filter(function (p) { return usa(p) || (p.stages || []).some(usa); }),
      departments: deptos,
      workingHours: horarios,
      automations: autos
    }
  };
}

// Saídas de um bloco: [rótulo, id do bloco de destino], só as ligadas.
function saidasDoBloco(b) {
  var o = b.options || {}, e = [];
  if (b.type === "condition") {
    (o.conditions || []).forEach(function (c) { e.push(["condição " + c.name, c.nextBlockId]); });
    e.push(["todas verdadeiras", o.trueNextBlockId], ["nenhuma atendida", o.falseNextBlockId]);
  }
  else if (b.type === "randomizer") { (o.randomizers || []).forEach(function (r) { e.push(["ramificação " + r.name, r.nextBlockId]); }); }
  else {
    (o.triggers || []).forEach(function (t) {
      var tp = t.options || {};
      (tp.events || []).forEach(function (x) { e.push(["evento " + (x.name || x.eventType), x.nextBlockId]); });
      (tp.buttons || []).forEach(function (x) { e.push(["botão do impulso", x.nextBlockId]); });
    });
    (o.messages || []).forEach(function (m) {
      var p = m.options || {};
      (p.buttons || []).forEach(function (x) { e.push(["botão " + x.text, x.nextBlockId]); });
      if (p.timeoutNextBlockId) e.push(["timeout", p.timeoutNextBlockId]);
    });
    (o.ais || []).forEach(function (i) {
      var p = i.options || {};
      (p.intentions || []).forEach(function (x) { e.push(["intenção " + x.intention, x.nextBlockId]); });
      (p.sentiments || []).forEach(function (x) { e.push(["sentimento " + x.sentiment, x.nextBlockId]); });
      (p.parameters || []).forEach(function (x) { if (x.emptyBlockId) e.push(["parâmetro vazio " + x.parameter, x.emptyBlockId]); });
      if (p.noneNextBlockId) e.push(["nenhuma intenção", p.noneNextBlockId]);
      if (p.neutralNextBlockId) e.push(["neutro", p.neutralNextBlockId]);
    });
    (o.fieldOperations || []).forEach(function (f) { if (f.options && f.options.nextBlockId) e.push(["corpo do loop", f.options.nextBlockId]); });
    (o.actions || []).forEach(function (a) {
      var ap = a.options || {};
      (ap.attendants || []).forEach(function (x, k) { if (x && typeof x === "object" && x.nextBlockId) e.push(["atendente " + (k + 1), x.nextBlockId]); });
      if (ap.noAttendantNextBlockId) e.push(["nenhum atendente disponível", ap.noAttendantNextBlockId]);
    });
    if (b.type === "delay" && o.delay && o.delay.options && o.delay.options.invalidDateNextBlock) e.push(["data inválida", o.delay.options.invalidDateNextBlock]);
    if (o.errorNextBlockId) e.push(["erro", o.errorNextBlockId]);
    e.push(["próximo", o.nextBlockId]);
  }
  return e.filter(function (x) { return x[1]; });
}

// Altura estimada de um bloco no canvas. Medidas do editor com 1 item: ação 276, condição 289, mensagem 229–250 (usa 250),
// espera 213; cada item ou saída a mais estica o bloco. Superestimar só gasta espaço; subestimar sobrepõe blocos.
function alturaEstimada(b) {
  var o = b.options || {};
  var BASE = { trigger: 220, chat: 250, action: 276, condition: 289, delay: 213, randomizer: 240, api: 260, "field-operation": 260, ai: 300, javascript: 260 };
  var lista = o.triggers || o.messages || o.actions || o.conditions || o.randomizers || o.apis || o.fieldOperations || o.ais || [];
  var extras = Math.max(0, lista.length - 1) * 70 + Math.max(0, saidasDoBloco(b).length - 2) * 30;
  return (BASE[b.type] || 260) + extras;
}

// Reorganiza as posições (presentation) dos blocos de uma automação (regras do KB-01, seção 6):
// colunas da esquerda para a direita pela profundidade (o bloco fica à direita de todos os que chegam nele),
// saídas de cada bloco empilhadas de cima para baixo (itens/botões/intenções na ordem, depois "próximo" e
// "todas verdadeiras", depois os desvios — sem resposta, nenhuma atendida, neutro — e a saída de erro por último),
// caminho principal reto no mesmo y e cada ramo numa faixa própria, sem sobreposição. Laços (saída que volta para
// um bloco anterior) não contam para a profundidade. Anotações que ficarem por cima de blocos sobem para cima do fluxo.
// opcoes: { coluna: espaço horizontal entre blocos (145 → passo de 457 px, o mediano dos fluxos reais), linha: espaço vertical (80) }.
function organizarLayout(automacao, opcoes) {
  opcoes = opcoes || {};
  var LARG = 312, COL = opcoes.coluna === undefined ? 145 : opcoes.coluna, LIN = opcoes.linha === undefined ? 80 : opcoes.linha;
  var blocos = (automacao && automacao.blocks) || [], porId = {}, entra = {};
  blocos.forEach(function (b) { porId[b.id] = b; });
  var RANK = function (rotulo) {
    if (rotulo === "erro") return 3;
    if (rotulo === "próximo" || rotulo === "todas verdadeiras") return 1;
    if (/^(timeout|nenhuma |nenhum |neutro|data inválida|parâmetro vazio)/.test(rotulo)) return 2;
    return 0;
  };
  var filhos = {}, chegadas = {};
  blocos.forEach(function (b) {
    var vistos = {};
    filhos[b.id] = saidasDoBloco(b).map(function (s, i) { return { r: RANK(s[0]), i: i, id: s[1], erro: s[0] === "erro" }; })
      .sort(function (a, c) { return a.r - c.r || a.i - c.i; })
      .filter(function (s) {
        if (!porId[s.id] || vistos[s.id] || s.id === b.id) return false;
        vistos[s.id] = 1; entra[s.id] = 1;
        (chegadas[s.id] = chegadas[s.id] || []).push(s.erro);
        return true;
      })
      .map(function (s) { return s.id; });
  });
  // Tratador de erro compartilhado: recebe 2+ ligações e pelo menos metade delas é saída de erro. Fica numa faixa
  // acima do caminho principal (como nos fluxos montados à mão), e não empurra o resto do fluxo para a direita.
  var tratador = {};
  blocos.forEach(function (b) {
    var c = chegadas[b.id] || [];
    if (b.type !== "trigger" && c.length > 1 && c.filter(Boolean).length * 2 >= c.length) tratador[b.id] = 1;
  });
  // Raízes: o gatilho; sem gatilho (colagem), os blocos sem entrada; o que sobrar solto vira raiz também, na ordem do arquivo.
  var raizes = blocos.filter(function (b) { return b.type === "trigger"; });
  if (!raizes.length) raizes = blocos.filter(function (b) { return !entra[b.id]; });
  // Busca em profundidade: marca as arestas de volta (laços) e define o pai de cada bloco na árvore (1ª descoberta).
  var estado = {}, volta = {}, pai = {}, ordem = [];
  var dfs = function (id) {
    estado[id] = 1;
    filhos[id].forEach(function (f) {
      if (estado[f] === 1) volta[id + ">" + f] = 1;
      else if (!estado[f]) { pai[f] = id; dfs(f); }
    });
    estado[id] = 2;
    ordem.push(id);
  };
  raizes.forEach(function (b) { if (!estado[b.id]) dfs(b.id); });
  blocos.forEach(function (b) { if (!estado[b.id]) { raizes.push(b); dfs(b.id); } });
  // Coluna = caminho mais longo desde a raiz, sem as arestas de volta (ordem topológica = pós-ordem invertida).
  // O tratador fica na coluna média de quem chega nele (mais um), para encurtar as ligações.
  var coluna = {}, soma = {}, conta = {};
  ordem.slice().reverse().forEach(function (id) {
    if (tratador[id] && conta[id]) coluna[id] = Math.round(soma[id] / conta[id]);
    else if (coluna[id] === undefined) coluna[id] = 0;
    filhos[id].forEach(function (f) {
      if (volta[id + ">" + f]) return;
      if (tratador[f]) { soma[f] = (soma[f] || 0) + coluna[id] + 1; conta[f] = (conta[f] || 0) + 1; }
      else coluna[f] = Math.max(coluna[f] || 0, coluna[id] + 1);
    });
  });
  // Linhas: o 1º filho fica na altura do pai (caminho reto); cada irmão seguinte, abaixo do anterior. Um bloco que
  // bate em outro da mesma coluna desce até caber. A árvore é percorrida em profundidade, então o ramo de cima ocupa
  // a coluna antes do de baixo e a ordem das saídas se mantém.
  var y = {}, ocupado = {};
  var encaixar = function (id, desejado) {
    var c = coluna[id], h = alturaEstimada(porId[id]), lista = ocupado[c] = ocupado[c] || [], yy = desejado;
    lista.sort(function (a, b) { return a[0] - b[0]; }).forEach(function (iv) { if (yy < iv[1] + LIN && yy + h + LIN > iv[0]) yy = iv[1] + LIN; });
    lista.push([yy, yy + h]);
    return (y[id] = yy);
  };
  var posicionar = function (id, desejado) {
    var yy = encaixar(id, desejado), proximo = yy;
    filhos[id].filter(function (f) { return pai[f] === id && !tratador[f]; }).forEach(function (f) {
      posicionar(f, proximo);
      proximo = y[f] + alturaEstimada(porId[f]) + LIN;
    });
  };
  raizes.forEach(function (b) { if (pai[b.id] === undefined) posicionar(b.id, 0); });
  // Tratadores: acima do que já está na coluna, empilhados para cima; o que vem depois deles segue na mesma linha.
  blocos.filter(function (b) { return tratador[b.id]; }).sort(function (a, b) { return coluna[a.id] - coluna[b.id]; }).forEach(function (b) {
    var c = coluna[b.id], h = alturaEstimada(b), lista = ocupado[c] = ocupado[c] || [];
    var topo = lista.reduce(function (m, iv) { return Math.min(m, iv[0]); }, 0);
    y[b.id] = topo - LIN - h;
    lista.push([y[b.id], y[b.id] + h]);
    filhos[b.id].filter(function (f) { return pai[f] === b.id && !tratador[f]; }).forEach(function (f) { posicionar(f, y[b.id]); });
  });
  blocos.forEach(function (b) { b.presentation = { x: coluna[b.id] * (LARG + COL), y: y[b.id] }; });
  // Anotações sobre algum bloco sobem para cima do fluxo, mantendo o x.
  var caixas = blocos.map(function (b) { return { x: b.presentation.x, y: b.presentation.y, w: LARG, h: alturaEstimada(b) }; });
  var acima = Math.min.apply(null, caixas.map(function (c) { return c.y; }).concat([0])) - LIN;
  ((automacao && automacao.notes) || []).forEach(function (n) {
    var p = n.presentation || { x: 0, y: 0 }, o = n.options || {}, w = o.width || 388, h = o.height || 200;
    var bate = caixas.some(function (c) { return p.x < c.x + c.w && p.x + w > c.x && p.y < c.y + c.h && p.y + h > c.y; });
    if (bate) { n.presentation = { x: p.x, y: acima - h }; acima -= h + LIN; }
  });
  return automacao;
}

// Valida uma lista de blocos no formato de colagem do editor.
function validarColagem(nos) {
  var erros = [], avisos = [];
  if (!Array.isArray(nos) || !nos.length) {
    return { erros: ["A colagem precisa ser uma lista com pelo menos um bloco."], avisos: [], pendencias: [] };
  }
  var blocks = [];
  nos.forEach(function (n, i) {
    var onde = "nó " + (i + 1);
    if (!n || typeof n !== "object" || !n.data || typeof n.data !== "object") { erros.push(onde + ': falta o objeto "data" com o bloco.'); return; }
    if (n.id !== n.data.id) erros.push(onde + ': "id" do nó precisa ser igual a data.id.');
    if (n.type !== n.data.type) erros.push(onde + ': "type" do nó precisa ser igual a data.type.');
    if (!n.position || typeof n.position.x !== "number" || typeof n.position.y !== "number") erros.push(onde + ': falta "position" com x e y.');
    if (typeof n.width !== "number" || typeof n.height !== "number") avisos.push(onde + ': sem "width" e "height" — o editor copia com largura e altura do nó.');
    blocks.push(n.data);
  });
  var r = validarAutomacao({
    hasInvalidReferences: false,
    data: {
      tags: [], additionalFields: [], businessLossReasons: [], activityTypes: [], pipelines: [], departments: [], workingHours: [],
      automations: [{ id: "00000000-0000-4000-8000-000000000000", versionId: "00000000-0000-4000-8000-000000000001", name: "Colagem", versionName: "Colagem", active: false, notes: [], blocks: blocks }]
    }
  }, { colagem: true });
  var limpa = function (lista) { return lista.map(function (x) { return x.replace(/^«Colagem»(: | › )/, ""); }); };
  return { erros: erros.concat(limpa(r.erros)), avisos: avisos.concat(limpa(r.avisos)), pendencias: limpa(r.pendencias) };
}

function validarAutomacao(doc, opcoes) {
  var colagem = !!(opcoes && opcoes.colagem);
  var erros = [], avisos = [], pendencias = [];

  // Catálogo utilizável (KB-02), extraído do editor do CRM e das automações reais: grupo -> nomes.
  // ✅ produção; 🟡 em AMARELO (confirmado no editor, sem uso nos modelos); ⚠️ em INTERFACE; ⛔ em OCULTO.
  var G = {
    messages: "message-received-trigger message-sended-trigger thread-initialized-trigger thread-finished-trigger department-changed-trigger send-text-message text-input-message send-file-message send-url-file-message start-conversation-action finish-conversation-action change-conversation-attendant-action change-conversation-department-action stop-chat-automations-action start-chat-automations-action change-conversation-suggestion-action conversation-has-attendant-condition conversation-window-is-open-condition conversation-has-department-condition conversation-has-finalized-condition conversation-automation-is-enabled chat-assistant-ai chat-completion-llm-ai chat-intent-ai chat-sentiment-ai chat-parameters-ai audio-transcription-ai",
    agents: "agent-completion-ai",
    time: "delay-message current-time-interval-condition",
    "whatsapp-cloud": "whatsapp-send-template-message",
    http: "json-http-request-trigger json-http-request-api json-http-request-file-api",
    system: "initiated-by-another-automation-trigger mcp-server-tool-trigger cron-job-trigger send-notification-action start-another-automation-action set-tool-result-action",
    lead: "manually-lead-trigger lead-tag-added-trigger lead-tag-removed-trigger lead-created-trigger lead-won-businesses-count-trigger lead-won-businesses-value-trigger lead-without-buying-trigger lead-birthday-trigger create-lead-action delete-lead-action add-tag-action remove-tag-action create-tag-action add-list-action remove-list-action create-list-action add-lead-comment-action add-attendant-on-lead-action clean-attendant-on-lead-action change-attendant-action lead-exists-condition lead-with-phone-exists-condition lead-with-email-exists-condition lead-with-name-exists-condition lead-with-taxid-exists-condition lead-with-additional-field-exists-condition lead-has-tag-condition lead-has-attendant-condition lead-has-business-on-pipeline-condition lead-has-business-on-stage-condition lead-has-open-conversation-condition",
    business: "business-entered-trigger business-created-trigger business-won-trigger business-lost-trigger business-restore-status-trigger business-attendant-included-trigger business-attendant-removed-trigger create-business-action move-business-action clone-business-action win-business-action lose-business-action restore-business-action remove-business-action add-attendant-on-business-action clean-attendant-on-business-action add-product-on-business-action remove-product-on-business-action add-discount-shipping-action business-has-attendants-condition business-attendant-empty-condition business-is-won-condition business-is-lost-condition business-is-pending-condition business-is-on-stage-condition business-has-product-condition business-with-external-id-exists-condition business-with-additional-field-exists-condition",
    product: "create-product-action",
    activities: "activity-executed-trigger create-activity-action",
    field: "field-changed-trigger field-is-equal-condition field-contains-condition field-has-value-condition between-condition field-matches-n-text-values set-field-operation parse-phone-field-operation parse-date-field-operation loop-array-field-operation",
    instagram: "instagram-comment-received-trigger live-instagram-comment-received-trigger send-comment-instagram instagram-follower",
    facebook: "facebook-comment-received-trigger live-facebook-comment-received-trigger meta-form-trigger send-comment-facebook"
  };
  var AMARELO = " lead-tag-added-trigger lead-tag-removed-trigger lead-won-businesses-count-trigger lead-won-businesses-value-trigger lead-without-buying-trigger lead-birthday-trigger business-lost-trigger business-restore-status-trigger business-attendant-removed-trigger instagram-comment-received-trigger live-instagram-comment-received-trigger facebook-comment-received-trigger live-facebook-comment-received-trigger meta-form-trigger field-changed-trigger activity-executed-trigger send-comment-instagram send-comment-facebook restore-business-action delete-lead-action create-list-action remove-list-action change-attendant-action start-chat-automations-action change-conversation-suggestion-action set-tool-result-action lead-with-additional-field-exists-condition lead-has-open-conversation-condition business-is-pending-condition business-has-product-condition conversation-has-department-condition conversation-automation-is-enabled instagram-follower until-date-delay ";
  var INTERFACE = " send-audio-message tray-trigger boost-buttons-trigger ";
  var OCULTO = " manually-business-trigger lead-has-additional-fields-condition company-has-additional-field-condition ";
  // Chaves de options de cada item, medidas nos exports reais e nos exemplos dos KBs (só itens com uso real).
  var OPCOES = { "add-attendant-on-business-action": "attendantId addSameAttendantToLead", "add-attendant-on-lead-action": "attendantId", "add-discount-shipping-action": "coupon addition discount shipping shippingType", "add-lead-comment-action": "comment", "add-list-action": "listIds listName", "add-product-on-business-action": "price quantity productId productSku", "add-tag-action": "tagIds tagName", "audio-transcription-ai": "model prompt messagesQtd datasourceName datasourceColor transcriptionSource transcriptionLanguage onlyCurrentThread", "between-condition": "parameter lessOrEqualsTo greaterOrEqualsTo", "business-attendant-empty-condition": "", "business-has-attendants-condition": "attendantsIds", "business-is-won-condition": "", "business-with-additional-field-exists-condition": "type value additionalFieldId", "business-with-external-id-exists-condition": "externalId", "business-won-trigger": "type stageId pipelineId", "change-conversation-attendant-action": "type instanceId attendantId platform changeCurrentSession", "change-conversation-department-action": "type instanceId departmentId", "chat-assistant-ai": "model prompt messagesQtd datasourceName datasourceColor onlyCurrentThread messageMaxHours", "chat-completion-llm-ai": "model prompt messagesQtd datasourceName datasourceColor onlyCurrentThread considerAnnotations", "chat-intent-ai": "model intentions messagesQtd noneNextBlockId onlyCurrentThread considerAnnotations", "chat-parameters-ai": "model parameters messagesQtd datasourceName datasourceColor onlyCurrentThread messageMaxHours", "chat-sentiment-ai": "model sentiments messagesQtd neutralNextBlockId", "conversation-has-attendant-condition": "attendantIds", "create-activity-action": "title flowId typeId required durationMs attendantId description hasBusiness belongsToStage workingHoursId creationDelayMs", "create-business-action": "stageId", "create-lead-action": "type", "create-product-action": "sku name price", "create-tag-action": "name color colorClass description useRandomColor", "cron-job-trigger": "id mode intervalInMinutes cronExpression timezone", "current-time-interval-condition": "endTime timezone startTime daysOfWeek", "days-delay": "days", "delay-message": "seconds", "field-contains-condition": "contains parameter", "field-has-value-condition": "parameter", "field-is-equal-condition": "equalsTo parameter", "field-matches-n-text-values": "type keywords parameter", "finish-conversation-action": "type instanceId", "hours-delay": "hours", "initiated-by-another-automation-trigger": "datasourceName datasourceColor", "json-http-request-api": "url body query method headers retryCount datasourceName datasourceColor retryIntervalSeconds responseHeadersOverrides", "json-http-request-file-api": "url body query method headers retryCount datasourceName datasourceColor retryIntervalSeconds responseHeadersOverrides", "json-http-request-trigger": "datasourceName datasourceColor", "lead-exists-condition": "", "lead-has-attendant-condition": "attendantIds", "lead-has-business-on-pipeline-condition": "pipelineId", "lead-has-business-on-stage-condition": "stageId", "lead-has-tag-condition": "tagIds", "lead-birthday-trigger": "id timezone executeAt leadsTagsFilter daysBeforeBirthday", "change-attendant-action": "attendants assignToLead assignToBusiness assignToConversation onlyOnline noAttendantNextBlockId type instanceId retryCount retryIntervalSeconds", "lead-with-email-exists-condition": "email", "lead-with-name-exists-condition": "name", "lead-with-phone-exists-condition": "phone", "lead-with-taxid-exists-condition": "taxId", "loop-array-field-operation": "parameter nextBlockId datasourceName datasourceColor", "lose-business-action": "lossReasonId justification", "manually-lead-trigger": "", "message-received-trigger": "type keywords instanceId listenGroup receiveJson initializeSession datasourceName datasourceColor", "message-sended-trigger": "type keywords instanceId listenGroup receiveJson initializeSession includeScheduledMessages datasourceName datasourceColor", "minutes-delay": "minutes", "move-business-action": "stageId", "parse-date-field-operation": "add date addType timezone datasourceName datasourceColor", "parse-phone-field-operation": "phone datasourceName defaultCountry datasourceColor", "remove-business-action": "", "remove-product-on-business-action": "quantity productId productSku", "remove-tag-action": "tagIds tagName", "seconds-delay": "seconds", "send-file-message": "url size text filename mimeType platforms", "send-notification-action": "url notification attendantsIds", "send-text-message": "text buttons breakMessages breakMessagesIntervalInSeconds", "send-url-file-message": "url clearUrl", "set-field-operation": "value parameter", "start-another-automation-action": "parameters automationId", "start-conversation-action": "type instanceId", "stop-chat-automations-action": "type instanceId", "text-input-message": "text acceptMediaUrl timeoutWaitType timeoutInSeconds timeoutNextBlockId invalidResponseMessage parameter", "thread-finished-trigger": "instanceId", "thread-initialized-trigger": "instanceId", "time-interval-delay": "endTime timezone startTime daysOfWeek", "user-stop-chatting-delay": "timeInSeconds", "whatsapp-send-template-message": "buttons template", "win-business-action": "", "lead-created-trigger": "", "business-entered-trigger": "stageId", "business-created-trigger": "stageId", "business-attendant-included-trigger": "attendantId", "department-changed-trigger": "instanceId departmentId", "mcp-server-tool-trigger": "name parameters description includeLeadId datasourceName datasourceColor includeBusinessId includeConversationId", "clean-attendant-on-business-action": "cleanAttendantOnLead", "clean-attendant-on-lead-action": "attendantId", "business-is-on-stage-condition": "stageId", "business-is-lost-condition": "", "conversation-has-finalized-condition": "", "agent-completion-ai": "prompt agentId messagesQtd datasourceName datasourceColor onlyCurrentThread considerAnnotations" };
  // Chaves de options de cada tipo de bloco e da automação, presentes em 100% dos exports reais.
  var CHAVES_BLOCO = { trigger: "triggers nextBlockId", chat: "messages platform provider instanceId contactId timezone scheduledDate isAnnotation nextBlockId errorNextBlockId", action: "actions nextBlockId errorNextBlockId", condition: "conditions trueNextBlockId falseNextBlockId", delay: "delay nextBlockId refreshLeadDataOnResume", randomizer: "randomizers", api: "apis nextBlockId errorNextBlockId", "field-operation": "fieldOperations nextBlockId errorNextBlockId", ai: "ais nextBlockId errorNextBlockId", javascript: "javascriptCode timeout datasourceName datasourceColor nextBlockId errorNextBlockId" };
  var CHAVES_AUTOMACAO = "id name description group active imageUrl loopLevel versionId versionName version tenantId notes blocks";
  var faltam = function (obj, chaves) { return chaves.split(" ").filter(function (k) { return k && !(k in obj); }); };
  var GRUPO = {};
  Object.keys(G).forEach(function (g) { G[g].split(" ").forEach(function (n) { GRUPO[n] = g; }); });

  var ARR = { trigger: "triggers", chat: "messages", action: "actions", condition: "conditions", api: "apis", "field-operation": "fieldOperations", ai: "ais" };
  var TIPOS = " trigger chat action condition delay randomizer api field-operation ai javascript ";
  var DELAYS = " seconds-delay minutes-delay hours-delay days-delay time-interval-delay until-date-delay user-stop-chatting-delay ";
  var GATILHO_CONVERSA = " message-received-trigger message-sended-trigger thread-initialized-trigger thread-finished-trigger department-changed-trigger initiated-by-another-automation-trigger "; // o subfluxo herda a conversa de quem o iniciou
  var CAMINHO_PURO = " field-is-equal-condition field-contains-condition field-has-value-condition between-condition field-matches-n-text-values set-field-operation loop-array-field-operation text-input-message field-changed-trigger ";
  var COM_STEP = " chat field-operation ai ";
  var UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
  var OBJECT_ID = /^[0-9a-f]{24}$/i;
  var tem = function (lista, nome) { return lista.indexOf(" " + nome + " ") > -1; };

  if (!doc || typeof doc !== "object" || !doc.data || typeof doc.data !== "object") {
    erros.push('Envelope inválido: falta o objeto "data".');
    return { erros: erros, avisos: avisos, pendencias: pendencias };
  }
  var d = doc.data;
  ["tags", "additionalFields", "businessLossReasons", "activityTypes", "pipelines", "departments", "workingHours", "automations"].forEach(function (k) {
    if (!Array.isArray(d[k])) erros.push("data." + k + " precisa existir como lista, mesmo vazia.");
  });
  if (doc.hasInvalidReferences !== false) avisos.push("hasInvalidReferences deveria ser false.");

  var vistos = {};
  // formato: "uuid" (padrão) ou "objectid" (departamentos, horários, conexões).
  // interno: IDs de itens dentro de blocos — exports reais repetem esses IDs ao copiar blocos.
  var regId = function (id, onde, formato, interno) {
    if (!id) return;
    if (vistos[id]) (interno ? avisos : erros).push("ID duplicado " + id + " (" + vistos[id] + " e " + onde + ")" + (interno ? " — em JSON gerado, use IDs únicos." : "."));
    else vistos[id] = onde;
    var valido = formato === "objectid" ? OBJECT_ID.test(id) : UUID.test(id);
    if (!valido) avisos.push("ID fora do formato " + (formato === "objectid" ? "ObjectId (24 hexadecimais)" : "UUID") + ": " + id + " (" + onde + ").");
  };
  var decl = { tag: {}, pipeline: {}, stage: {}, field: {}, fieldName: {}, dept: {}, loss: {}, wh: {}, auto: {}, autoName: {} };
  (d.tags || []).forEach(function (t) { regId(t.id, "tag " + t.name); decl.tag[t.id] = 1; });
  (d.pipelines || []).forEach(function (p) {
    regId(p.id, "pipeline " + p.name); decl.pipeline[p.id] = 1;
    (p.stages || []).forEach(function (s) { regId(s.id, "etapa " + s.name); decl.stage[s.id] = 1; });
  });
  (d.additionalFields || []).forEach(function (f) { regId(f.id, "campo " + f.name); decl.field[f.id] = 1; decl.fieldName[f.name] = 1; });
  (d.departments || []).forEach(function (x) { regId(x.id, "departamento " + x.name, "objectid"); decl.dept[x.id] = 1; });
  (d.businessLossReasons || []).forEach(function (x) { regId(x.id, "motivo de perda " + x.name); decl.loss[x.id] = 1; });
  (d.workingHours || []).forEach(function (x) { regId(x.id, "horário " + x.name, "objectid"); decl.wh[x.id] = 1; });

  var CHAVES_REG = { tags: "id name color", departments: "id name color main", pipelines: "id name stages", additionalFields: "id name type entity", businessLossReasons: "id name", workingHours: "id departmentId name timezone weekDays" };
  if (!colagem) Object.keys(CHAVES_REG).forEach(function (k) {
    (d[k] || []).forEach(function (reg) { var f = faltam(reg, CHAVES_REG[k]); if (f.length) avisos.push("data." + k + " «" + (reg.name || reg.id) + "»: faltam as chaves " + f.join(", ") + " (KB-01, seção 3)."); });
  });

  var autos = Array.isArray(d.automations) ? d.automations : [];
  if (!autos.length) erros.push("Nenhuma automação em data.automations.");
  autos.forEach(function (a) {
    decl.auto[a.id] = 1;
    if (decl.autoName[a.name]) erros.push("Duas automações com o mesmo nome no arquivo: " + a.name + ".");
    decl.autoName[a.name] = 1;
  });

  var saidas = saidasDoBloco;

  autos.forEach(function (a) {
    var A = "«" + (a.name || "sem nome") + "»";
    regId(a.id, "automação " + A);
    regId(a.versionId, "versão de " + A);
    if (!colagem && a.active !== false) avisos.push(A + ": active deveria ser false — ative só depois de testar.");
    if (!colagem) {
      var faltaA = faltam(a, CHAVES_AUTOMACAO).filter(function (k) { return k !== "group"; });
      if (faltaA.length) avisos.push(A + ": faltam as chaves " + faltaA.join(", ") + " (KB-01, seção 2).");
      if (!a.group) erros.push(A + ': sem "group" — a automação precisa de um grupo (pasta).');
      if (a.versionName !== a.name) avisos.push(A + ": versionName deveria ser igual ao name.");
    }
    var blocks = Array.isArray(a.blocks) ? a.blocks : [];
    var porId = {};
    blocks.forEach(function (b) { regId(b.id, "bloco " + b.type + " em " + A); porId[b.id] = b; });
    (a.notes || []).forEach(function (n) { regId(n.id, "anotação em " + A, "uuid", true); });

    var gatilhos = blocks.filter(function (b) { return b.type === "trigger"; });
    if (colagem) { if (gatilhos.length) erros.push(A + ": não inclua o bloco de gatilho — o fluxo de destino já tem o nó Início."); }
    else if (gatilhos.length !== 1) erros.push(A + ": precisa de exatamente 1 bloco de gatilho (tem " + gatilhos.length + ").");
    var nomesGatilho = [];
    gatilhos.forEach(function (t) { ((t.options || {}).triggers || []).forEach(function (i) { nomesGatilho.push(i.name); }); });
    if (!colagem && gatilhos.length === 1 && !nomesGatilho.length) pendencias.push(A + ": adicionar o gatilho manualmente no nó Início.");
    var temConversa = nomesGatilho.some(function (n) { return tem(GATILHO_CONVERSA, n); });
    var webhooks = nomesGatilho.filter(function (n) { return n === "json-http-request-trigger"; }).length;
    if (webhooks > 1) erros.push(A + ": " + webhooks + " gatilhos de webhook no Início — só o primeiro é acionado (a URL é única por automação).");
    if (nomesGatilho.indexOf("mcp-server-tool-trigger") > -1 && !blocks.some(function (b) { return b.type === "action" && ((b.options || {}).actions || []).some(function (x) { return x.name === "set-tool-result-action"; }); })) {
      avisos.push(A + ': gatilho MCP Server Tool sem a ação "Retornar resultado da tool" — o agente fica sem resposta.');
    }
    // Gatilho de negócio: "ainda está na etapa?" é do negócio da sessão, não de qualquer negócio do lead (KB-13, seção 4).
    if (nomesGatilho.some(function (n) { return /^business-/.test(n); }) && blocks.some(function (b) { return b.type === "condition" && ((b.options || {}).conditions || []).some(function (x) { return x.name === "lead-has-business-on-stage-condition"; }); })) {
      avisos.push(A + ': gatilho de negócio com "Lead possui negócio na etapa" — para conferir o negócio da sessão use "Negócio atual está na etapa" (business-is-on-stage-condition); a outra procura entre todos os negócios do lead e pode trocar o negócio da sessão.');
    }

    var fontes = {}, comSource = 0;
    blocks.forEach(function (b) {
      var o = b.options || {}, onde = A + " › " + b.type;
      if (!tem(TIPOS, b.type)) { erros.push(onde + ": type desconhecido."); return; }
      if (b.sourceBlockId !== null && b.sourceBlockId !== undefined) comSource++;
      if (o.datasourceName) fontes[o.datasourceName] = 1;
      if (!colagem) {
        var faltaB = faltam(o, CHAVES_BLOCO[b.type] || "");
        if (faltaB.length) avisos.push(onde + ": faltam as chaves " + faltaB.join(", ") + " em options (KB-01, seção 4).");
      }
      ["nextBlockId", "errorNextBlockId", "trueNextBlockId", "falseNextBlockId"].forEach(function (k) { if (o[k] === null) avisos.push(onde + ": " + k + ' null — saída vazia é "" (texto vazio).'); });

      var itens = [];
      if (ARR[b.type]) {
        if (!Array.isArray(o[ARR[b.type]])) erros.push(onde + ": options." + ARR[b.type] + " precisa ser uma lista.");
        else itens = o[ARR[b.type]];
      }
      if (b.type === "delay") {
        if (!o.delay || !tem(DELAYS, o.delay.name)) erros.push(onde + ": delay.name inválido (" + (o.delay && o.delay.name) + ").");
        else {
          if ("group" in o.delay) avisos.push(onde + ": o item de espera não leva group.");
          var sobraD = OPCOES[o.delay.name] === undefined ? [] : Object.keys(o.delay.options || {}).filter(function (k) { return !tem(" " + OPCOES[o.delay.name] + " ", k); });
          if (sobraD.length) avisos.push(onde + " › " + o.delay.name + ": opções que o item não tem: " + sobraD.join(", ") + " (use: " + OPCOES[o.delay.name] + ").");
          if (o.delay.name === "until-date-delay") {
            pendencias.push(onde + ": Espera o dia/horário confirmada no editor, sem uso nos modelos — conferir no CRM após importar.");
            if (!(o.delay.options || {}).invalidDateNextBlock) avisos.push(onde + ': sem a saída "caso a data for vazia ou inválida" — lead sem data fica parado.');
          }
        }
      }
      if (b.type === "javascript" && typeof o.javascriptCode !== "string") erros.push(onde + ": javascriptCode ausente.");
      if (b.type === "javascript" && typeof o.javascriptCode === "string") {
        if (/Bearer\s+[A-Za-z0-9._\-]{20,}/.test(o.javascriptCode)) erros.push(onde + ": token escrito no código — deixe a constante vazia (Pendência).");
        if (/datacrazy\.io/i.test(o.javascriptCode)) {
          if (/TOKEN_DATACRAZY\s*=\s*""/.test(o.javascriptCode)) pendencias.push(onde + ": colar a chave da API do Datacrazy na constante TOKEN_DATACRAZY do código.");
          (o.javascriptCode.match(/https?:\/\/[a-z0-9.\-]*datacrazy\.io[^\s"'`)]*/gi) || []).forEach(function (url) {
            var probJs = problemaUrlDatacrazy(url);
            if (probJs) (probJs[0] === "erro" ? erros : avisos).push(onde + ": código usa " + probJs[1]);
          });
        }
      }
      if (b.type === "randomizer") {
        var rs = o.randomizers || [];
        var soma = rs.reduce(function (s, r) { return s + Number(r.perc || 0); }, 0);
        if (Math.abs(soma - 100) > 0.05) erros.push(onde + ": percentuais somam " + soma + "; precisam somar 100.");
        rs.forEach(function (r) { regId(r.id, "ramificação em " + A, "uuid", true); });
      }
      if (b.type === "chat") {
        var msgs = itens;
        if (!colagem && !o.instanceId && !temConversa) pendencias.push(onde + ": fluxo sem conversa de origem — fixe a Conexão neste bloco de mensagem.");
        if (o.instanceId && !o.provider) avisos.push(onde + ": instanceId preenchido sem platform/provider.");
        if (o.instanceId && !OBJECT_ID.test(o.instanceId)) avisos.push(onde + ": instanceId fora do formato ObjectId (24 hexadecimais).");
        // Template + Entrada do usuário no mesmo bloco aparece em automações reais de set/2026; misturar com outras etapas, não.
        if (msgs.some(function (m) { return m.name === "whatsapp-send-template-message"; }) && msgs.some(function (m) { return m.name !== "whatsapp-send-template-message" && m.name !== "text-input-message"; })) erros.push(onde + ": o Template do WhatsApp só pode dividir o bloco com a Entrada do usuário.");
        for (var k = 0; k + 1 < msgs.length; k++) {
          if (msgs[k].name === "delay-message" && msgs[k + 1].name === "text-input-message") avisos.push(onde + ": Atraso de tempo logo antes da Entrada do usuário — respostas enviadas durante o atraso não são capturadas.");
        }
      }
      if (b.type === "condition") {
        var porItem = (o.conditions || []).some(function (c) { return c.nextBlockId; });
        if (porItem && o.trueNextBlockId) avisos.push(onde + ': mistura roteamento por item com "todas verdadeiras" — use um modo só.');
        if (!porItem && !o.trueNextBlockId && !o.falseNextBlockId) avisos.push(onde + ": condição sem nenhuma saída ligada.");
      }

      itens.forEach(function (it) {
        var p = it.options || {}, w = onde + " › " + it.name;
        if (tem(OCULTO, it.name)) erros.push(w + ": item oculto no catálogo do CRM — não use (KB-02, seção 4).");
        else if (tem(INTERFACE, it.name)) erros.push(w + ": item só configurável na interface (upload ou integração) — construa o resto e registre a Pendência (KB-02, seção 4).");
        else if (!GRUPO[it.name]) erros.push(w + ": item fora do catálogo utilizável (KB-02).");
        else if (it.group !== GRUPO[it.name]) (tem(AMARELO, it.name) ? avisos : erros).push(w + ': group deveria ser "' + GRUPO[it.name] + '".');
        if (tem(AMARELO, it.name)) pendencias.push(w + ": item confirmado no editor, sem uso nos modelos — conferir no CRM após importar.");
        if (b.type !== "condition" && "id" in it) avisos.push(w + ': itens de ' + b.type + ' não levam "id" — só itens de condição.');
        if (b.type === "trigger" && "nextBlockId" in p) erros.push(w + ": o gatilho não roteia pelo item — a saída do Início é options.nextBlockId do bloco (KB-01, seção 5).");
        if (OPCOES[it.name] !== undefined) {
          var sobra = Object.keys(p).filter(function (k) { return k !== "resolvedReferences" && !(b.type === "trigger" && k === "nextBlockId") && !tem(" " + OPCOES[it.name] + " ", k); });
          if (sobra.length) avisos.push(w + ": opções que o item não tem: " + sobra.join(", ") + (OPCOES[it.name] ? " (use: " + OPCOES[it.name] + ")." : " (o item não leva opções)."));
        }
        if (it.name === "add-lead-comment-action" && !p.comment) erros.push(w + ': comentário vazio — o texto vai em "comment".');
        if (it.name === "send-text-message" && !(typeof p.text === "string" && p.text.trim())) erros.push(w + ': mensagem sem "text".');
        if (it.name === "send-notification-action" && !p.notification) erros.push(w + ': notificação sem o texto em "notification".');
        if (it.name === "whatsapp-send-template-message" && (!p.template || typeof p.template !== "object")) erros.push(w + ': falta o objeto "template" (id, name, language, body). Sem os dados do template aprovado, use Mensagem de texto marcadora + Pendência (KB-11).');
        if (/^message-(received|sended)-trigger$/.test(it.name) && "keywords" in p && !Array.isArray(p.keywords)) erros.push(w + ": keywords precisa ser uma lista de textos.");
        if (p.datasourceName) fontes[p.datasourceName] = 1;

        // Referências a registros: declarados no envelope (importação) ou existentes na conta (colagem)
        var ref = function (valor, conjunto, rotulo) {
          if (!valor || conjunto[valor]) return;
          if (colagem) pendencias.push(w + ": " + rotulo + " " + valor + " precisa existir na conta — confira ou reselecione depois de colar.");
          else erros.push(w + ": " + rotulo + " " + valor + " não está declarado em data.*.");
        };
        var gatilhoNegocio = /^business-(won|lost|restore-status)-trigger$/.test(it.name);
        if ("stageId" in p) {
          var dispensa = (gatilhoNegocio && p.type === "pipeline") || it.name === "manually-lead-trigger";
          if (!p.stageId && !dispensa) erros.push(w + ": stageId vazio.");
          ref(p.stageId, decl.stage, "etapa");
        }
        if ("pipelineId" in p) {
          if (!p.pipelineId && it.name === "lead-has-business-on-pipeline-condition") erros.push(w + ": pipelineId vazio.");
          if (!p.pipelineId && gatilhoNegocio && p.type === "pipeline") pendencias.push(w + ": pipelineId vazio dispara para qualquer pipeline — confirme se é isso.");
          ref(p.pipelineId, decl.pipeline, "pipeline");
        }
        if ("tagIds" in p) {
          var tagPorNome = (it.name === "add-tag-action" || it.name === "remove-tag-action") && p.tagName;
          if ((!p.tagIds || !p.tagIds.length) && !tagPorNome) erros.push(w + ": tagIds vazio" + (it.name === "add-tag-action" || it.name === "remove-tag-action" ? " (ou informe tagName para buscar a tag pelo nome)." : "."));
          (p.tagIds || []).forEach(function (t) { ref(t, decl.tag, "tag"); });
        }
        if ("departmentId" in p) {
          if (!p.departmentId && it.name !== "conversation-has-department-condition") erros.push(w + ": departmentId vazio.");
          ref(p.departmentId, decl.dept, "departamento");
        }
        if ("lossReasonId" in p) { if (!p.lossReasonId) erros.push(w + ": lossReasonId vazio."); ref(p.lossReasonId, decl.loss, "motivo de perda"); }
        if ("additionalFieldId" in p) { if (!p.additionalFieldId) erros.push(w + ": additionalFieldId vazio."); ref(p.additionalFieldId, decl.field, "campo adicional"); }
        if (p.workingHoursId) ref(p.workingHoursId, decl.wh, "horário");
        if (it.name === "start-another-automation-action" && !decl.auto[p.automationId]) {
          if (colagem) pendencias.push(w + ": escolher a automação a iniciar.");
          else erros.push(w + ": automationId precisa apontar para uma automação deste arquivo.");
        }

        // Caminho puro não leva chaves
        if (tem(CAMINHO_PURO, it.name) && typeof p.parameter === "string" && /[{}|]/.test(p.parameter)) erros.push(w + ': parameter é caminho puro — sem { } nem | ("' + p.parameter + '").');

        // IDs internos
        if (b.type === "condition") {
          if (!it.id) avisos.push(w + ': item de condição sem "id" — itens reais sempre têm "id" e "nextBlockId".');
          else regId(it.id, "condição em " + A, "uuid", true);
          if (!("nextBlockId" in it)) avisos.push(w + ': item de condição sem "nextBlockId" (use null quando o bloco rotear por "todas verdadeiras").');
        }
        if (tem(COM_STEP, b.type)) {
          if (!it.stepId) avisos.push(w + ': item sem "stepId" — itens reais de Mensagem, Operações de campos e IA sempre têm um UUID em "stepId".');
          else regId(it.stepId, "stepId em " + A, "uuid", true);
        }
        (p.buttons || []).forEach(function (x) { regId(x.id, "botão em " + A, "uuid", true); });
        (p.intentions || []).forEach(function (x) { regId(x.id, "intenção em " + A, "uuid", true); });
        (p.sentiments || []).forEach(function (x) { regId(x.id, "sentimento em " + A, "uuid", true); });
        (p.parameters || []).forEach(function (x) { if (x.id) regId(x.id, "parâmetro em " + A, "uuid", true); });

        // Regras do editor
        if (it.name === "send-text-message") (p.buttons || []).forEach(function (x) { if (x.text && Array.from(x.text).length > 20) avisos.push(w + ': botão "' + x.text + '" passa de 20 caracteres (limite do editor).'); });
        if (b.type === "ai" && p.model && p.model !== "Basic" && p.model !== "Transcription") avisos.push(w + ': model "' + p.model + '" não é oferecido no editor — use "Basic" (ou "Transcription" na transcrição).');
        if (it.name === "cron-job-trigger") {
          if (!p.id) avisos.push(w + ': sem "id" (UUID v4) — o editor sempre gera um.');
          if ((p.mode || "interval") === "interval" && !(Number(p.intervalInMinutes) >= 15)) erros.push(w + ": intervalo mínimo de 15 minutos.");
          if (p.mode === "cron" && !p.cronExpression) erros.push(w + ': modo cron sem "cronExpression".');
        }
        if (it.name === "change-attendant-action") {
          var tentativas = p.retryCount === undefined ? 0 : Number(p.retryCount);
          if (!(tentativas >= 0 && tentativas <= 10)) erros.push(w + ": retryCount precisa estar entre 0 e 10 (limite do editor).");
          if (!Array.isArray(p.attendants) || !p.attendants.length) pendencias.push(w + ": adicionar os atendentes e ligar a saída de cada um na interface.");
          else pendencias.push(w + ": conferir no CRM os atendentes e a saída de cada um (formato ainda não visto numa exportação).");
          if (p.onlyOnline && !p.noAttendantNextBlockId) avisos.push(w + ': "Apenas atendentes online" sem a saída "Nenhum atendente disponível" — quem chegar sem ninguém online fica parado.');
        }
        if (it.name === "lead-birthday-trigger") {
          if (!p.id) avisos.push(w + ': sem "id" (UUID v4) — o editor sempre gera um.');
          if (!/^([01]\d|2[0-3]):[0-5]\d$/.test(String(p.executeAt || ""))) erros.push(w + ': executeAt precisa ser um horário no formato "HH:MM".');
          var diasAntes = Number(p.daysBeforeBirthday);
          if (!(diasAntes >= 0 && diasAntes <= 30)) erros.push(w + ": daysBeforeBirthday precisa estar entre 0 e 30 (limite do editor).");
          if (Array.isArray(p.leadsTagsFilter) && p.leadsTagsFilter.length) pendencias.push(w + ": conferir o filtro de tags no CRM após importar (formato do filtro ainda não visto numa exportação).");
        }
        if (it.name === "field-changed-trigger") {
          if (!p.parameter) erros.push(w + ": parameter (campo monitorado) vazio.");
          if (p.changeType === "specific" && !p.operator) erros.push(w + ': changeType "specific" precisa de operator.');
        }

        // Pendências para o usuário
        if ("attendantId" in p && !p.attendantId) pendencias.push(w + ": escolher o atendente.");
        ["attendantsIds", "attendantIds"].forEach(function (k) { if (k in p && (!p[k] || !p[k].length)) pendencias.push(w + (it.name === "send-notification-action" ? ": escolher quem recebe a notificação." : ": escolher os atendentes.")); });
        if ("agentId" in p && !p.agentId) pendencias.push(w + ": escolher o agente de IA.");
        var apiDC = /datacrazy\.io/i.test(String(p.url || ""));
        (p.headers || []).forEach(function (h) {
          if (!/^authorization$/i.test(h.key || "")) return;
          if (!h.value) pendencias.push(w + (apiDC ? ": colar a chave da API do Datacrazy (Configurações › Chaves de API) no header Authorization, como Bearer <chave>." : ": preencher o token no header Authorization."));
          else if (h.value.indexOf("{") < 0) erros.push(w + ": token escrito no header Authorization — deixe vazio (Pendência) ou use uma variável.");
        });
        if (apiDC) {
          var probUrl = problemaUrlDatacrazy(p.url);
          if (probUrl) (probUrl[0] === "erro" ? erros : avisos).push(w + ": " + probUrl[1]);
          if (String(p.method || "").toUpperCase() === "DELETE") avisos.push(w + ": DELETE na API do Datacrazy — ação destrutiva, confirme que foi pedida.");
          if (/api\.g1\.datacrazy\.io\/api\/v1\/(crm|messaging|accounts)\//i.test(String(p.url))) pendencias.push(w + ": rota interna migrada (KB-08) — testar a chamada com a chave da API antes de ativar.");
        }
        if (it.name === "json-http-request-trigger") pendencias.push(w + ": copiar a URL do webhook no nó Início e configurar na origem dos dados.");
        if (it.name === "meta-form-trigger" && (!p.integrationId || !p.formId)) pendencias.push(w + ": selecionar integração, página e formulário do Facebook no nó Início.");
        if (it.name === "whatsapp-send-template-message") pendencias.push(w + ": conferir o template aprovado no bloco.");
        if (it.name === "create-activity-action" && !p.typeId) pendencias.push(w + ": escolher o tipo da atividade.");
        if (it.name === "remove-business-action" || it.name === "delete-lead-action") avisos.push(w + ": ação destrutiva — confirme que foi pedida.");
        if (it.name === "text-input-message") {
          if (p.parameter) avisos.push(w + ": Entrada do usuário com campo do CRM selecionado (" + p.parameter + ") — use sem campo, só para aguardar a resposta.");
          if (p.text) avisos.push(w + ": a pergunta vai numa Mensagem de texto antes; a Entrada do usuário fica com texto vazio.");
          if (!p.timeoutNextBlockId) avisos.push(w + ': sem a saída "caso o usuário não responda" — quem não responder fica parado.');
          if (!o.nextBlockId) avisos.push(w + ': sem a saída "próximo passo" — quem responder fica parado.');
        }
        var marcadores = JSON.stringify(p).match(/\[PREENCHER[^\]\[]*\]/g) || [];
        marcadores.forEach(function (m) { pendencias.push(w + ": substituir " + m + "."); });
      });

      saidas(b).forEach(function (s) {
        if (porId[s[1]]) return;
        if (colagem) avisos.push(onde + ': saída "' + s[0] + '" aponta para um bloco fora da colagem — vai ficar desconectada.');
        else erros.push(onde + ': saída "' + s[0] + '" aponta para um bloco inexistente.');
      });
    });

    if (comSource) avisos.push(A + ": " + comSource + " bloco(s) com sourceBlockId preenchido — em JSON gerado, use null.");

    // Dentro do corpo de um Loop de array, criar ou alterar lead/negócio só mexe no registro do 1º item (fica preso na sessão) — KB-17, seção 4
    var MEXE_LEAD = /^(create-lead-action|create-business-action|move-business-action|win-business-action|lose-business-action|add-tag-action|remove-tag-action|add-lead-comment-action)$/;
    blocks.forEach(function (lb) {
      (((lb.options || {}).fieldOperations) || []).forEach(function (op) {
        if (op.name !== "loop-array-field-operation" || !op.options || !op.options.nextBlockId) return;
        var vistos = {}, fila = [op.options.nextBlockId], achados = [];
        while (fila.length) {
          var bid = fila.pop();
          if (!bid || bid === lb.id || vistos[bid] || !porId[bid]) continue;
          vistos[bid] = 1;
          var bb = porId[bid], oo = bb.options || {};
          (oo.actions || []).forEach(function (it) { if (MEXE_LEAD.test(it.name)) achados.push(it.name); });
          (oo.fieldOperations || []).forEach(function (it) { if (it.name === "set-field-operation" && /^(lead[A-Z]|business[A-Z]|additional-field\[)/.test(String((it.options || {}).parameter || ""))) achados.push("set-field-operation " + it.options.parameter); });
          saidas(bb).forEach(function (s) { fila.push(s[1]); });
        }
        if (achados.length) erros.push(A + ': o corpo do Loop de array ("' + (op.options.datasourceName || "") + '") cria ou altera lead/negócio (' + achados.slice(0, 3).join(", ") + ") — só o 1º item vira registro e os outros o sobrescrevem. Use Loop → API no webhook de outra automação → Espera de 1 s (KB-17, seção 4).");
      });
    });

    if (colagem) {
      var alvos = {};
      blocks.forEach(function (b) { saidas(b).forEach(function (s) { alvos[s[1]] = 1; }); });
      blocks.filter(function (b) { return !alvos[b.id]; }).forEach(function (b) {
        pendencias.push(A + ": depois de colar, ligue o nó Início (ou o bloco anterior) a este bloco de entrada: " + b.type + " em x=" + Math.round((b.presentation || {}).x || 0) + ".");
      });
    } else if (gatilhos.length === 1) {
      var alcancados = {}, pilha = [gatilhos[0].id];
      while (pilha.length) {
        var id = pilha.pop();
        if (!id || alcancados[id] || !porId[id]) continue;
        alcancados[id] = 1;
        saidas(porId[id]).forEach(function (s) { pilha.push(s[1]); });
      }
      var soltos = blocks.filter(function (b) { return !alcancados[b.id]; }).length;
      if (soltos) avisos.push(A + ": " + soltos + " bloco(s) não alcançável(is) a partir do gatilho.");
    }

    var texto = JSON.stringify(blocks, function (k, v) { return k === "javascriptCode" ? "" : v; });
    // [^\]\[] e não [^\]]: com muitos "additional-field[" e nenhum "]", cada tentativa varria até o fim do texto (tempo quadrático; 8 MB travavam o servidor por mais de uma hora).
    var semCampos = texto.replace(/additional-field\[[^\]\[]*\]/g, "").replace(/\[PREENCHER[^\]\[]*\]/g, "").replace(/\b(filter|complete)\[[^\]\[]*\]/g, ""); // filter[...] e complete[...]: query da API do Datacrazy
    (semCampos.match(/\[[A-Za-z][A-Za-z0-9_\-]*\]/g) || []).forEach(function (m) {
      var nome = m.slice(1, -1);
      if (fontes[nome]) return;
      if (colagem) pendencias.push(A + ": a fonte de dados [" + nome + "] precisa existir no fluxo onde você colar.");
      else avisos.push(A + ": a fonte de dados [" + nome + "] é lida, mas nenhum bloco a cria.");
    });
    (texto.match(/additional-field\[[^\]\[]+\]/g) || []).forEach(function (m) {
      var nome = m.slice(17, -1);
      if (decl.fieldName[nome]) return;
      if (colagem) pendencias.push(A + ": o campo adicional " + nome + " precisa existir na conta.");
      else avisos.push(A + ": additional-field[" + nome + "] não está declarado em data.additionalFields.");
    });
  });

  // Com mapa e não indexOf: centenas de milhares de mensagens viravam 10^10 comparações.
  var unico = function (l) { var visto = {}; return l.filter(function (x) { return visto["$" + x] ? false : (visto["$" + x] = true); }); };
  return { erros: unico(erros), avisos: unico(avisos), pendencias: unico(pendencias) };
}
if (typeof module !== "undefined") module.exports = { validarAutomacao: validarAutomacao, validarColagem: validarColagem, paraColagem: paraColagem, organizarLayout: organizarLayout, alturaEstimada: alturaEstimada, saidasDoBloco: saidasDoBloco, automacoesChamadas: automacoesChamadas, gruposDeAutomacoes: gruposDeAutomacoes, separarAutomacoes: separarAutomacoes, classificarUrlDatacrazy: classificarUrlDatacrazy };
