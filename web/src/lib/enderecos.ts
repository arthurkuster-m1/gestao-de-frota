/** Endereço numa linha só, sempre na mesma máscara: "Rua nome, número, complemento (opcional) - Cidade/UF - CEP 00000-000". */
export type EnderecoPartes = { rua: string; numero: string; complemento: string; cidade: string; uf: string; cep: string };
export const ENDERECO_VAZIO: EnderecoPartes = { rua: "", numero: "", complemento: "", cidade: "", uf: "", cep: "" };

export const soDigitos = (t: string) => t.replace(/\D/g, "");
export const mascaraCep = (t: string) => { const d = soDigitos(t).slice(0, 8); return d.length > 5 ? `${d.slice(0, 5)}-${d.slice(5)}` : d; };
const um = (t: string) => t.trim().replace(/\s+/g, " ");

/** Monta a linha. Devolve "" enquanto faltar rua, número, cidade, UF ou CEP completo. */
export function formatarEndereco(p: EnderecoPartes): string {
  const rua = um(p.rua), numero = um(p.numero), comp = um(p.complemento), cidade = um(p.cidade), uf = um(p.uf).toUpperCase(), cep = mascaraCep(p.cep);
  if (!rua || !numero || !cidade || uf.length !== 2 || cep.length !== 9) return "";
  return `${rua}, ${numero}${comp ? `, ${comp}` : ""} - ${cidade}/${uf} - CEP ${cep}`;
}

const REGEX = /^(.+?), ([^,]+?)(?:, (.+?))? - ([^/]+?)\/([A-Za-z]{2}) - CEP (\d{5})-(\d{3})$/;
/** Lê uma linha na máscara de volta para as partes (null se o texto não segue a máscara). */
export function lerEndereco(texto: string | null | undefined): EnderecoPartes | null {
  const m = REGEX.exec((texto ?? "").trim());
  return m ? { rua: m[1]!, numero: m[2]!, complemento: m[3] ?? "", cidade: m[4]!, uf: m[5]!.toUpperCase(), cep: `${m[6]}-${m[7]}` } : null;
}
export const enderecoValido = (texto: string) => lerEndereco(texto) !== null;
export const MENSAGEM_DO_ENDERECO = "Use: Rua, número, complemento (opcional) - Cidade/UF - CEP 00000-000";
/** Para os campos de endereço aceitarem vazio (limpar) ou a máscara. */
export const validarEndereco = (texto: string): string | null => (enderecoValido(texto) ? null : MENSAGEM_DO_ENDERECO);
/** Cidade e UF de uma linha na máscara (os campos antigos de cidade/estado do local ficam preenchidos sozinhos). */
export function cidadeEUf(texto: string | null | undefined): { cidade: string | null; estado: string | null } {
  const p = lerEndereco(texto); return { cidade: p?.cidade ?? null, estado: p?.uf ?? null };
}

const UF_LISTA = new Set(["AC","AL","AP","AM","BA","CE","DF","ES","GO","MA","MT","MS","MG","PA","PB","PR","PE","PI","RJ","RN","RS","RO","RR","SC","SP","SE","TO"]);
/**
 * Lê um endereço colado em formatos comuns (Google Maps, Correios…), ex.: "Av. Goiás, 1805 - Santa Paula, São Caetano do Sul - SP, 09521-300".
 * Devolve só as partes que achou (o bairro vai para o complemento). null se não parece um endereço.
 */
export function lerEnderecoColado(texto: string): Partial<EnderecoPartes> | null {
  const mascarado = lerEndereco(texto);
  if (mascarado) return mascarado;
  let t = um(texto);
  if (!t) return null;
  const out: Partial<EnderecoPartes> = {};
  const c = /(\d{5})-?(\d{3})/.exec(t);
  if (c) { out.cep = `${c[1]}-${c[2]}`; t = t.replace(c[0], " "); }
  t = t.replace(/\bCEP\b:?/gi, " ").replace(/,?\s*Brasil\s*$/i, "");
  const segs = t.split(",").map((x) => um(x).replace(/^[-–\s]+|[-–\s]+$/g, "")).filter(Boolean);
  // a cidade vem como "Cidade - UF", "Cidade/UF" ou "Cidade, UF"
  let iCidade = -1;
  for (let i = segs.length - 1; i >= 0; i--) {
    const m = /^(.+?)\s*[-–/]\s*([A-Za-z]{2})$/.exec(segs[i]!);
    if (m && UF_LISTA.has(m[2]!.toUpperCase())) { out.cidade = m[1]!.trim(); out.uf = m[2]!.toUpperCase(); iCidade = i; break; }
    if (UF_LISTA.has(segs[i]!.toUpperCase()) && i > 0 && segs[i]!.length === 2) { out.cidade = segs[i - 1]!; out.uf = segs[i]!.toUpperCase(); iCidade = i - 1; break; }
  }
  const antes = iCidade >= 0 ? segs.slice(0, iCidade) : segs;
  if (antes.length === 0) return out.cep || out.cidade ? out : null;
  let rua = antes[0]!; const resto = antes.slice(1); const extras: string[] = [];
  let numero = "";
  const iNum = resto.findIndex((x) => /^(\d+[A-Za-z]?|s\/?n)\b/i.test(x));
  if (iNum >= 0) {
    const m = /^(\d+[A-Za-z]?|s\/?n)\b\s*(?:[-–]\s*(.+))?$/i.exec(resto[iNum]!);
    if (m) { numero = m[1]!.toUpperCase().replace("S/N", "S/N").replace(/^SN$/, "S/N"); if (m[2]) extras.push(m[2].trim()); } else numero = resto[iNum]!;
    resto.splice(iNum, 1);
  } else {
    const m = /^(.*\D)\s+(\d+[A-Za-z]?)$/.exec(rua);   // "Rua X 123"
    if (m) { rua = m[1]!.replace(/[-–,\s]+$/, ""); numero = m[2]!; }
  }
  // "Rua X - Bairro" sem número
  const sep = /^(.+?)\s+[-–]\s+(.+)$/.exec(rua);
  if (sep && !numero) { rua = sep[1]!; extras.push(sep[2]!); }
  out.rua = rua; if (numero) out.numero = numero;
  const comp = [...extras, ...resto].join(", ");
  if (comp) out.complemento = comp;
  return out;
}

export type RespostaCep = { rua: string; bairro: string; cidade: string; uf: string };
/** Consulta o CEP (ViaCEP; se falhar, BrasilAPI) para preencher rua, cidade e UF sozinhos. null se não achar ou se estiver sem internet. CEP de cidade pequena vem sem rua. */
export async function buscarCep(cep: string, buscar: typeof fetch = fetch): Promise<RespostaCep | null> {
  const d = soDigitos(cep);
  if (d.length !== 8) return null;
  try {
    const r = await buscar(`https://viacep.com.br/ws/${d}/json/`);
    if (r.ok) {
      const j = (await r.json()) as { erro?: boolean | string; logradouro?: string; bairro?: string; localidade?: string; uf?: string };
      if (!j.erro && (j.localidade || j.logradouro)) return { rua: j.logradouro ?? "", bairro: j.bairro ?? "", cidade: j.localidade ?? "", uf: (j.uf ?? "").toUpperCase() };
    }
  } catch { /* tenta o outro serviço */ }
  try {
    const r = await buscar(`https://brasilapi.com.br/api/cep/v2/${d}`);
    if (!r.ok) return null;
    const j = (await r.json()) as { city?: string; state?: string; street?: string; neighborhood?: string };
    if (!j.city) return null;
    return { rua: j.street ?? "", bairro: j.neighborhood ?? "", cidade: j.city, uf: (j.state ?? "").toUpperCase() };
  } catch { return null; }
}
