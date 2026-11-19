// Uso: node validar.js arquivo.json
// Aceita o JSON de importação ({ data: { automations } }) ou a lista de blocos para colar no editor.
const fs = require("fs"), path = require("path");
const { validarAutomacao, validarColagem } = require(path.join(__dirname, "validador-core.js"));
const arquivo = process.argv[2];
if (!arquivo) { console.error("Uso: node validar.js arquivo.json"); process.exit(2); }
let doc;
try { doc = JSON.parse(fs.readFileSync(arquivo, "utf8")); }
catch (e) { console.error("JSON inválido:", e.message); process.exit(2); }
const colagem = Array.isArray(doc);
console.log("Formato:", colagem ? "colagem (" + doc.length + " blocos)" : "importação");
const r = colagem ? validarColagem(doc) : validarAutomacao(doc);
const secao = (titulo, lista, marca) => { if (lista.length) { console.log(titulo + " (" + lista.length + ")"); lista.forEach(x => console.log("  " + marca + " " + x)); } };
secao("ERROS", r.erros, "✗");
secao("AVISOS", r.avisos, "!");
secao("PENDÊNCIAS", r.pendencias, "→");
if (!r.erros.length && !r.avisos.length) console.log("✓ Estrutura válida.");
process.exit(r.erros.length ? 1 : 0);
