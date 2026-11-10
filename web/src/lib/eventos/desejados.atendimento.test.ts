import { describe, expect, it } from "vitest";
import { atendimentoDosPedidos, combina } from "./desejados";
import type { ModeloDesejado } from "./tipos";

const ped = (id: string, o: Partial<ModeloDesejado> = {}): ModeloDesejado => ({ id, evento_id: "e", modelo: "S10", versao: null, cor: null, my: null, blindado: null, reserva_id: null, nao_atendido: false, nota: null, posicao: 0, ...o });
const carro = (modelo: string, o: { cor?: string | null; my?: string | null; blindado?: boolean } = {}) => ({ modelo, cor: o.cor ?? null, my: o.my ?? null, blindado: o.blindado ?? false });

describe("pedidos do evento", () => {
  it("a blindagem pedida precisa bater; vazio = tanto faz", () => {
    expect(combina(carro("S10 LT"), ped("p", { blindado: true }))).toBe(false);
    expect(combina(carro("S10 LT", { blindado: true }), ped("p", { blindado: true }))).toBe(true);
    expect(combina(carro("S10 LT"), ped("p", { blindado: false }))).toBe(true);
    expect(combina(carro("S10 LT", { blindado: true }), ped("p"))).toBe(true);
  });
  it("atendimento: o pedido ligado manda; os soltos pegam carros do evento que caibam, sem repetir carro", () => {
    const veiculos = new Map([["v1", carro("S10 LT")], ["v2", carro("S10 HC")], ["v3", carro("ONIX")]]);
    const reservas = [{ id: "r1", veiculo_id: "v1", estado: "reservado" }, { id: "r2", veiculo_id: "v2", estado: "reservado" }, { id: "r3", veiculo_id: "v3", estado: "cancelado" }];
    const r = atendimentoDosPedidos([ped("a", { reserva_id: "r1" }), ped("b"), ped("c"), ped("d", { modelo: "ONIX" }), ped("e", { nao_atendido: true })], reservas, veiculos);
    expect(Object.fromEntries(r)).toEqual({ a: "v1", b: "v2" });   // c não tem carro sobrando; d só tem reserva cancelada; e foi marcado como indisponível
  });
});
