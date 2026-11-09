import type { Evento, EventoLocal, Reserva } from "../eventos/tipos";
import { valoresEfetivos } from "../eventos/linhasDoEvento";
import { lerEndereco } from "../enderecos";
import type { Sentido } from "./tipos";

export type Rota = { origem: string | null; destino: string | null };

/**
 * A rota de um transporte vem do EVENTO (ou do carro, se ele tem origem/endereço próprios):
 * ida = da origem do carro até o endereço do evento; volta = do endereço do evento de volta à origem.
 */
export function rotaDoTransporte(sentido: Sentido, reserva: Reserva | undefined, evento: Evento, locais: readonly EventoLocal[]): Rota {
  const ef = valoresEfetivos({ reserva } as never, evento, locais);
  const origem = ef.origem.valor, local = ef.enderecoChegada.valor;
  return sentido === "ida" ? { origem, destino: local } : { origem: local, destino: origem };
}

/** O texto que se manda ao mapa: "Cidade, UF, Brasil" quando o endereço segue a máscara (basta para a distância), senão o texto todo. */
export function consultaDoLugar(endereco: string): string {
  const p = lerEndereco(endereco);
  return p ? `${p.cidade}, ${p.uf}, Brasil` : `${endereco.trim()}, Brasil`;
}
/** Nome curto para mostrar: "Cidade/UF". */
export function nomeCurtoDoLugar(endereco: string | null | undefined): string {
  if (!endereco) return "—";
  const p = lerEndereco(endereco);
  return p ? `${p.cidade}/${p.uf}` : endereco;
}

type Ponto = { lat: number; lon: number };
export const haversineKm = (a: Ponto, b: Ponto) => {
  const rad = (g: number) => (g * Math.PI) / 180, R = 6371;
  const dLat = rad(b.lat - a.lat), dLon = rad(b.lon - a.lon);
  const h = Math.sin(dLat / 2) ** 2 + Math.cos(rad(a.lat)) * Math.cos(rad(b.lat)) * Math.sin(dLon / 2) ** 2;
  return 2 * R * Math.asin(Math.sqrt(h));
};

export type ResultadoDeDistancia = { km: number; metodo: "rota" | "reta" };
const FATOR_ESTRADA = 1.25;   // quando só dá para medir em linha reta, estrada costuma ser ~25% maior
const cacheDePontos = new Map<string, Ponto | null>();

async function localizar(consulta: string, buscar: typeof fetch): Promise<Ponto | null> {
  if (cacheDePontos.has(consulta)) return cacheDePontos.get(consulta)!;
  try {
    const r = await buscar(`https://nominatim.openstreetmap.org/search?format=json&limit=1&countrycodes=br&q=${encodeURIComponent(consulta)}`, { headers: { Accept: "application/json" } });
    if (!r.ok) return null;
    const j = (await r.json()) as { lat: string; lon: string }[];
    const ponto = j[0] ? { lat: Number(j[0].lat), lon: Number(j[0].lon) } : null;
    if (ponto && Number.isFinite(ponto.lat) && Number.isFinite(ponto.lon)) { cacheDePontos.set(consulta, ponto); return ponto; }
    cacheDePontos.set(consulta, null); return null;
  } catch { return null; }
}

/**
 * Quilômetros entre dois endereços: acha os dois pontos no mapa (OpenStreetMap), mede a rota de carro (OSRM) e,
 * se o serviço de rotas não responder, usa a linha reta + 25%. null se algum endereço não for encontrado ou estiver sem internet.
 */
export async function distanciaEntre(origem: string, destino: string, buscar: typeof fetch = fetch): Promise<ResultadoDeDistancia | null> {
  const a = await localizar(consultaDoLugar(origem), buscar); if (!a) return null;
  const b = await localizar(consultaDoLugar(destino), buscar); if (!b) return null;
  try {
    const r = await buscar(`https://router.project-osrm.org/route/v1/driving/${a.lon},${a.lat};${b.lon},${b.lat}?overview=false`);
    if (r.ok) { const j = (await r.json()) as { routes?: { distance: number }[] }; const m = j.routes?.[0]?.distance; if (typeof m === "number" && m >= 0) return { km: Math.round(m / 1000), metodo: "rota" }; }
  } catch { /* cai na linha reta */ }
  return { km: Math.round(haversineKm(a, b) * FATOR_ESTRADA), metodo: "reta" };
}
