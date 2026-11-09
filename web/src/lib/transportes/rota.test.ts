import { describe, expect, it } from "vitest";
import type { Evento, EventoLocal, Reserva } from "../eventos/tipos";
import { consultaDoLugar, distanciaEntre, haversineKm, nomeCurtoDoLugar, rotaDoTransporte } from "./rota";

const evento = { id: "e", nome: "X", status: "planejado", chegada_prevista: null, retirada_prevista: null, origem: "Rua A, 1 - São Bernardo do Campo/SP - CEP 09000-000" } as unknown as Evento;
const locais: EventoLocal[] = [{ id: "l", evento_id: "e", rotulo: null, endereco: "Av B, 2 - Cuiabá/MT - CEP 78000-000", cidade: "Cuiabá", estado: "MT", posicao: 0 }];

describe("rota do transporte", () => {
  it("ida: da origem do evento até o endereço; volta: o contrário", () => {
    expect(rotaDoTransporte("ida", undefined, evento, locais)).toEqual({ origem: evento.origem, destino: locais[0]!.endereco });
    expect(rotaDoTransporte("volta", undefined, evento, locais)).toEqual({ origem: locais[0]!.endereco, destino: evento.origem });
  });
  it("o carro com origem própria manda no lugar do evento", () => {
    const r = { origem: "Rua C, 3 - Curitiba/PR - CEP 80000-000" } as Reserva;
    expect(rotaDoTransporte("ida", r, evento, locais).origem).toBe(r.origem);
  });
  it("consulta e nome curto usam cidade/UF", () => {
    expect(consultaDoLugar(evento.origem!)).toBe("São Bernardo do Campo, SP, Brasil");
    expect(nomeCurtoDoLugar(evento.origem)).toBe("São Bernardo do Campo/SP");
    expect(consultaDoLugar("Planta Anchieta")).toBe("Planta Anchieta, Brasil");
  });
  it("haversine: São Paulo–Rio ≈ 360 km", () => { expect(Math.round(haversineKm({ lat: -23.55, lon: -46.63 }, { lat: -22.91, lon: -43.17 }))).toBeGreaterThan(340); });
});

describe("distância", () => {
  const resposta = (corpo: unknown, ok = true) => ({ ok, json: async () => corpo }) as Response;
  it("usa a rota de carro quando o serviço responde", async () => {
    const f = (async (url: string) => (String(url).includes("nominatim") ? resposta([{ lat: "-20", lon: "-50" }]) : resposta({ routes: [{ distance: 1234567 }] }))) as unknown as typeof fetch;
    expect(await distanciaEntre("Rua A, 1 - Aaa/SP - CEP 00000-001", "Rua B, 2 - Bbb/MT - CEP 00000-002", f)).toEqual({ km: 1235, metodo: "rota" });
  });
  it("sem o serviço de rotas, estima em linha reta +25%", async () => {
    let n = 0;
    const f = (async (url: string) => { if (String(url).includes("nominatim")) return resposta([{ lat: n++ ? "-22.91" : "-23.55", lon: n > 1 ? "-43.17" : "-46.63" }]); throw new Error("fora"); }) as unknown as typeof fetch;
    const r = await distanciaEntre("Cidade Um, SP", "Cidade Dois, RJ", f);
    expect(r?.metodo).toBe("reta");
  });
  it("devolve null se não achar o endereço", async () => {
    const f = (async () => resposta([])) as unknown as typeof fetch;
    expect(await distanciaEntre("Lugar Que Nao Existe, XX", "Outro, YY", f)).toBeNull();
  });
});
