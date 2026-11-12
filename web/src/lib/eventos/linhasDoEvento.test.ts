import { describe, expect, it } from "vitest";
import { acharTransporte, codigoDaLinha, custoDoEvento, montarLinhas, tabelaParaOutlook, valoresEfetivos } from "./linhasDoEvento";
import type { Transporte } from "../transportes/tipos";
import type { ModeloDesejado, Reserva } from "./tipos";
import type { Veiculo } from "../veiculos/tipos";

const v = (id: string, o: Partial<Veiculo> = {}) => ({ id, codigo: null, modelo: "S10 High", versao: null, cor: "Branco", my: "2027", pedido: null, vin: "VIN1", placa: "ABC1D23", ...o }) as Veiculo;
const r = (id: string, veiculo_id: string, o: Partial<Reserva> = {}): Reserva => ({ id, evento_id: "e", veiculo_id, reserva_inicio: "2026-11-01", reserva_fim: "2026-11-10", chegada: null, retirada: null, estado: "reservado", comentarios: null, ...o });
const p = (id: string, o: Partial<ModeloDesejado> = {}): ModeloDesejado => ({ id, evento_id: "e", modelo: "S10", versao: null, cor: "Branco", my: "2027", reserva_id: null, nao_atendido: false, nota: null, posicao: 0, ...o });

describe("linhas do evento", () => {
  it("definidos primeiro, pedidos abertos depois; cancelada some; pedido atendido liga à reserva", () => {
    const l = montarLinhas("e", [r("r1", "v1"), r("r2", "v2", { estado: "cancelado" })], [p("p1", { reserva_id: "r1" }), p("p2")], [v("v1"), v("v2")]);
    expect(l.map((x) => x.key)).toEqual(["r:r1", "p:p2"]);
    expect(l[0]!.pedido?.id).toBe("p1");
  });
  it("pedido que um carro já atende (sem vínculo gravado) não sobra como linha aberta", () => {
    const l = montarLinhas("e", [r("r1", "v1")], [p("p1")], [v("v1")]);
    expect(l.map((x) => x.key)).toEqual(["r:r1"]);
    expect(l[0]!.pedido?.id).toBe("p1");
  });
  it("sem carro, o código é MODELO COR MY", () => expect(codigoDaLinha({ key: "p:p2", reserva: null, pedido: p("p2"), veiculo: null })).toBe("S10 BRANCO 2027"));
  it("herda do evento até individualizar", () => {
    const ev = { status: "planejado" as const, chegada_prevista: "2026-11-05", retirada_prevista: "2026-11-08" };
    const l = { key: "r:r1", reserva: r("r1", "v1", { chegada: "2026-11-06", origem: "Curitiba" }), pedido: null, veiculo: v("v1") };
    const e = valoresEfetivos(l, ev, [{ id: "l", evento_id: "e", rotulo: null, endereco: "Rua A, 1 - SP/SP - CEP 01000-000", cidade: "SP", estado: "SP", posicao: 0 }]);
    expect(e.chegada).toEqual({ valor: "2026-11-06", herdado: false });
    expect(e.retirada).toEqual({ valor: "2026-11-08", herdado: true });
    expect(e.enderecoChegada.valor).toBe("Rua A, 1 - SP/SP - CEP 01000-000");
    expect(e.origem).toEqual({ valor: "Curitiba", herdado: false });
    expect(e.status).toEqual({ valor: "planejado", herdado: true });
  });
  it("o carro que já voltou mostra Concluído mesmo com o evento Em uso; status próprio manda", () => {
    const ev = { status: "em_uso" as const, chegada_prevista: null, retirada_prevista: null };
    const com = (o: Partial<Reserva>) => ({ key: "r:r1", reserva: r("r1", "v1", o), pedido: null, veiculo: v("v1") });
    expect(valoresEfetivos(com({ estado: "concluido" }), ev, []).status).toEqual({ valor: "concluido", herdado: true });
    expect(valoresEfetivos(com({ estado: "reservado" }), ev, []).status.valor).toBe("em_uso");
    expect(valoresEfetivos(com({ estado: "concluido", status_individual: "retorno_solicitado" }), ev, []).status).toEqual({ valor: "retorno_solicitado", herdado: false });
  });
  it("tabela do Outlook: títulos + só carros definidos, com HTML escapado", () => {
    const t = tabelaParaOutlook([{ key: "r:1", reserva: r("r1", "v1"), pedido: null, veiculo: v("v1", { modelo: "A<B" }) }, { key: "p:1", reserva: null, pedido: p("p1"), veiculo: null }]);
    expect(t.texto).toBe("Código\tPlaca\tVIN\tModelo\tCor\tMY\nA<B\tABC1D23\tVIN1\tA<B\tBranco\t2027");
    expect(t.html).toContain("A&lt;B");
  });
  it("transporte: mesma PTA no mesmo evento é reaproveitada; custo conta cada transporte uma vez", () => {
    const t = (id: string, o: Partial<Transporte>): Transporte => ({ id, evento_id: "e", sentido: "ida", modalidade: "pta", distancia_km: null, dias_viagem: 0, referencia: "PTA1", transportadora: null, valor_planejado: 100, comentarios: null, created_at: "", origem: null, destino: null, status_pagamento: null, valor_real: null, data_pagamento: null, departamento: null, ...o });
    const ts = [t("a", {}), t("b", { referencia: "PTA2", valor_planejado: 50 }), t("c", { evento_id: "outro" })];
    expect(acharTransporte(ts, "e", "ida", "pta", " pta1 ")?.id).toBe("a");
    expect(acharTransporte(ts, "e", "volta", "pta", "PTA1")).toBeNull();
    expect(acharTransporte(ts, "e", "ida", "pta", "")).toBeNull();
    expect(custoDoEvento(ts, "e")).toEqual({ total: 150, quantidade: 2 });
  });
});
