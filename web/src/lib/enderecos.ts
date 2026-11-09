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

export type RespostaCep = { rua: string; bairro: string; cidade: string; uf: string };
/** Consulta o CEP (ViaCEP) para preencher rua, cidade e UF sozinhos. null se não achar ou se estiver sem internet. */
export async function buscarCep(cep: string, buscar: typeof fetch = fetch): Promise<RespostaCep | null> {
  const d = soDigitos(cep);
  if (d.length !== 8) return null;
  try {
    const r = await buscar(`https://viacep.com.br/ws/${d}/json/`);
    if (!r.ok) return null;
    const j = (await r.json()) as { erro?: boolean | string; logradouro?: string; bairro?: string; localidade?: string; uf?: string };
    if (j.erro) return null;
    return { rua: j.logradouro ?? "", bairro: j.bairro ?? "", cidade: j.localidade ?? "", uf: (j.uf ?? "").toUpperCase() };
  } catch { return null; }
}
