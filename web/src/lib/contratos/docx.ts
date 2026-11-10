import JSZip from "jszip";

/**
 * Gera o DOCX de um contrato/aditivo a partir de um modelo com marcadores {{assim}}. O Word costuma quebrar um marcador em vários
 * pedaços de texto (formatação): aqui o parágrafo é lido inteiro e o marcador é trocado mesmo assim. Linhas de tabela que têm marcadores
 * de uma lista (ex.: {{veiculo_modelo}}) se repetem, uma por item.
 */
const esc = (s: string) => s.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;");
const desesc = (s: string) => s.replace(/&lt;/g, "<").replace(/&gt;/g, ">").replace(/&quot;/g, '"').replace(/&apos;/g, "'").replace(/&amp;/g, "&");
const T = /(<w:t(?: [^>]*)?>)([\s\S]*?)(<\/w:t>)/g;
const MARCADOR = /\{\{\s*([a-z0-9_]+)\s*\}\}/g;

/** Troca os marcadores de UM parágrafo (xml), mesmo quebrados em vários trechos de texto. */
export function trocarNoParagrafo(p: string, valores: Record<string, string>): string {
  const nos = [...p.matchAll(T)];
  if (nos.length === 0) return p;
  const textos = nos.map((n) => desesc(n[2]!));
  let cheio = textos.join("");
  if (!cheio.includes("{{")) return p;
  for (let guarda = 0; guarda < 200; guarda++) {
    MARCADOR.lastIndex = 0;
    const m = MARCADOR.exec(cheio); if (!m) break;
    const nome = m[1]!; const novo = nome in valores ? valores[nome]! : m[0];
    // acha o nó onde o marcador começa
    let pos = 0, i = 0;
    for (; i < textos.length; i++) { if (pos + textos[i]!.length > m.index) break; pos += textos[i]!.length; }
    if (novo === m[0]) { textos[i] = textos[i]!.slice(0, m.index - pos) + "\u0000" + textos[i]!.slice(m.index - pos + 1); cheio = textos.join(""); continue; }
    let restante = m[0].length, off = m.index - pos, primeiro = true;
    for (; restante > 0 && i < textos.length; i++) {
      const t = textos[i]!;
      if (primeiro) { const tira = Math.min(t.length - off, restante); textos[i] = t.slice(0, off) + novo + t.slice(off + tira); restante -= tira; primeiro = false; }
      else { const tira = Math.min(t.length, restante); textos[i] = t.slice(tira); restante -= tira; }
    }
    cheio = textos.join("");
  }
  let k = 0, ultimo = 0, saida = "";
  for (const n of nos) {
    saida += p.slice(ultimo, n.index);
    let abre = n[1]!; if (!/xml:space/.test(abre)) abre = abre.slice(0, -1) + ' xml:space="preserve">';
    saida += abre + esc(textos[k]!.replace(/\u0000/g, "{")) + n[3]!; ultimo = n.index! + n[0].length; k++;
  }
  return saida + p.slice(ultimo);
}

const PARAGRAFO = /<w:p[ >][\s\S]*?<\/w:p>/g;
const LINHA = /<w:tr[ >][\s\S]*?<\/w:tr>/g;
export const trocarMarcadores = (xml: string, valores: Record<string, string>) => xml.replace(PARAGRAFO, (p) => trocarNoParagrafo(p, valores));

/** Linhas de tabela com marcadores `{{lista_campo}}` viram uma linha por item (sem itens: uma linha com "—"). */
export function repetirLinhas(xml: string, listas: Record<string, Record<string, string>[]>): string {
  return xml.replace(LINHA, (linha) => {
    const texto = [...linha.matchAll(T)].map((n) => desesc(n[2]!)).join("");
    for (const [lista, itens] of Object.entries(listas)) {
      if (!texto.includes(`{{${lista}_`)) continue;
      const modelo = (item: Record<string, string>) => trocarMarcadores(linha, Object.fromEntries(Object.entries(item).map(([c, v]) => [`${lista}_${c}`, v])));
      if (itens.length === 0) { const vazio = new Proxy({} as Record<string, string>, { has: () => true, get: () => "—" }); return trocarMarcadores(linha, vazio); }
      return itens.map(modelo).join("");
    }
    return linha;
  });
}

const PARTES = /^word\/(document|header\d*|footer\d*)\.xml$/;
export async function gerarDocx(modelo: ArrayBuffer | Uint8Array, valores: Record<string, string>, listas: Record<string, Record<string, string>[]> = {}): Promise<Blob> {
  const zip = await JSZip.loadAsync(modelo);
  for (const nome of Object.keys(zip.files)) {
    if (!PARTES.test(nome)) continue;
    const xml = await zip.file(nome)!.async("string");
    zip.file(nome, trocarMarcadores(repetirLinhas(xml, listas), valores));
  }
  return zip.generateAsync({ type: "blob", mimeType: "application/vnd.openxmlformats-officedocument.wordprocessingml.document" });
}
/** Os marcadores que um modelo usa (para conferir antes de gerar). */
export async function marcadoresDoModelo(modelo: ArrayBuffer | Uint8Array): Promise<string[]> {
  const zip = await JSZip.loadAsync(modelo); const achados = new Set<string>();
  for (const nome of Object.keys(zip.files)) {
    if (!PARTES.test(nome)) continue;
    const xml = await zip.file(nome)!.async("string");
    for (const p of xml.match(PARAGRAFO) ?? []) { const t = [...p.matchAll(T)].map((n) => desesc(n[2]!)).join(""); for (const m of t.matchAll(MARCADOR)) achados.add(m[1]!); }
  }
  return [...achados].sort();
}
