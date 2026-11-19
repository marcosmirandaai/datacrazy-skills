// Uso: node organizar.js arquivo.json [saida.json]
// Reorganiza as posições dos blocos (colunas por profundidade, saídas empilhadas, sem sobreposição) e valida.
// Aceita o JSON de importação ({ data: { automations } }) ou a lista de blocos para colar no editor.
// Sem saida.json, grava ao lado como <nome>.organizado.json.
const fs = require("fs"), path = require("path");
const { organizarLayout, alturaEstimada, validarAutomacao, validarColagem } = require(path.join(__dirname, "validador-core.js"));
const arquivo = process.argv[2];
if (!arquivo) { console.error("Uso: node organizar.js arquivo.json [saida.json]"); process.exit(2); }
let doc;
try { doc = JSON.parse(fs.readFileSync(arquivo, "utf8")); }
catch (e) { console.error("JSON inválido:", e.message); process.exit(2); }
const colagem = Array.isArray(doc);
if (colagem) {
  organizarLayout({ blocks: doc.map(n => n.data) });
  doc.forEach(n => { n.position = { x: n.data.presentation.x, y: n.data.presentation.y }; n.height = alturaEstimada(n.data); });
} else (((doc || {}).data || {}).automations || []).forEach(a => organizarLayout(a));
const saida = process.argv[3] || arquivo.replace(/(\.json)?$/i, ".organizado.json");
fs.writeFileSync(saida, JSON.stringify(doc, null, 2));
const r = colagem ? validarColagem(doc) : validarAutomacao(doc);
console.log("Organizado em", saida, "| erros:", r.erros.length, "| avisos:", r.avisos.length, "| pendências:", r.pendencias.length);
process.exit(r.erros.length ? 1 : 0);
