import { describe, expect, it } from "vitest";
import type { Veiculo } from "../veiculos/tipos";
import type { Evento, EventoLocal, ReservaDoEvento } from "./tipos";
import { textoDoEvento } from "./textoDoEvento";

const ev = { id: "e", nome: "Convenção X", status: "planejado", chegada_prevista: "2026-11-10", retirada_prevista: "2026-11-14", contato: "Ana 11 99999-0000", contato_origem: "Beto 11 98888-0000", origem: "Rua A, 1 - Santo André/SP - CEP 09280-510" } as unknown as Evento;
const v = { id: "v1", codigo: "SILVERADO 0069", placa: "TLS5E28", vin: "3GCUK9ED5SG100069", modelo: "SILVERADO 4WD HIGH COUNTRY", cor: "STERLING GRAY METALLIC", my: "2025" } as Veiculo;
const r = { id: "r1", evento_id: "e", veiculo_id: "v1", reserva_inicio: "2026-11-06", reserva_fim: "2026-11-16", chegada: null, retirada: null, estado: "reservado" } as unknown as ReservaDoEvento;
const local = { id: "l", evento_id: "e", rotulo: "Pavilhão", endereco: "Av. B, 2 - Cuiabá/MT - CEP 78000-000", posicao: 0 } as EventoLocal;

describe("texto do evento", () => {
  it("segue o modelo: datas, endereços com contato e a tabela dos carros", () => {
    const { texto, html } = textoDoEvento({ evento: ev, reservas: [r], veiculos: [v], locais: [local], origensExtras: [], transportes: [] });
    expect(texto).toContain("EVENTO: Convenção X");
    expect(texto).toContain("COLETA DIA 06/11 (DIA QUE A TRANSPORTADORA DEVE PEGAR O CARRO - DATA DO ENVIO)");
    expect(texto).toContain("ENTREGA NO EVENTO DIA 10/11");
    expect(texto).toContain("RETORNO DIA 14/11");
    expect(texto).toContain("Endereço de Coleta:\n- Rua A, 1 - Santo André/SP - CEP 09280-510\n- Contato: Beto 11 98888-0000");
    expect(texto).toContain("Endereço de Entrega:\n- Pavilhão: Av. B, 2 - Cuiabá/MT - CEP 78000-000\n- Contato: Ana 11 99999-0000");
    expect(texto).toContain("| SILVERADO 0069 | TLS5E28 | 3GCUK9ED5SG100069 | SILVERADO 4WD HIGH COUNTRY | STERLING GRAY METALLIC | 2025 |");
    expect(html).toContain("#4472C4");
  });
  it("sem reserva com data, a coleta sai da chegada menos os dias da ida; sem nada, XX/XX", () => {
    const t = { evento_id: "e", sentido: "ida", dias_viagem: 3 } as never;
    expect(textoDoEvento({ evento: ev, reservas: [], veiculos: [], locais: [], origensExtras: [], transportes: [t] }).texto).toContain("COLETA DIA 07/11");
    expect(textoDoEvento({ evento: { ...ev, chegada_prevista: null, retirada_prevista: null }, reservas: [], veiculos: [], locais: [], origensExtras: [], transportes: [] }).texto).toContain("ENTREGA NO EVENTO DIA XX/XX");
  });
});
