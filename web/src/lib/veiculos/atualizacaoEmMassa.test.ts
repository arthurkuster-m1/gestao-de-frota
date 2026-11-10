import { describe, expect, it } from "vitest";
import { acharVeiculo, linhasDeMatriz, validarLista } from "./atualizacaoEmMassa";
import type { Veiculo } from "./tipos";

const v = (id: string, o: Partial<Veiculo>): Veiculo => ({ id, codigo: null, modelo: "Onix", cor: null, my: null, pedido: null, vin: null, placa: null, blindado: false, status_ciclo: "disponivel_sem_faturamento", data_faturamento: null, data_emplacamento: null, ...o }) as Veiculo;
const frota = [
  v("1", { codigo: "ONIX RS 1111", vin: "11111111111111111", pedido: "P1", status_ciclo: "disponivel_sem_faturamento" }),
  v("2", { codigo: "ONIX RS 2222", vin: "22222222222222222", pedido: "P1", status_ciclo: "disponivel_sem_faturamento", data_faturamento: "2026-11-01" }),
  v("3", { codigo: "S10 3333", vin: "33333333333333333", placa: "ABC1D23", status_ciclo: "disponivel", data_emplacamento: "2026-11-02", data_faturamento: "2026-11-01" }),
  v("4", { codigo: "S10 4444", vin: "44444444444444444", status_ciclo: "devolvido" }),
];
const ctx = { veiculos: frota, data: "2026-11-12" };

describe("atualização em massa", () => {
  it("acha por VIN, código, placa e pedido (só nos campos da ação); pedido repetido é ambíguo", () => {
    expect("veiculo" in acharVeiculo(frota, " 11111111111111111 ", ["vin"])).toBe(true);
    expect("veiculo" in acharVeiculo(frota, "onix rs 2222", ["codigo"])).toBe(true);
    expect("veiculo" in acharVeiculo(frota, "abc-1d23", ["placa"])).toBe(true);
    expect(acharVeiculo(frota, "P1", ["pedido"])).toEqual({ erro: '"P1" bate com 2 veículos: use o VIN' });
    expect("erro" in acharVeiculo(frota, "ABC1D23", ["vin", "codigo"])).toBe(true);
  });
  it("faturamento: registra data e ciclo; já faturado é ignorado; devolvido dá erro", () => {
    const r = validarLista("faturamento", [{ ref: "11111111111111111" }, { ref: "22222222222222222" }, { ref: "44444444444444444" }, { ref: "999" }, {}], ctx);
    expect(r.map((x) => x.tom)).toEqual(["ok", "dup", "erro", "erro", "ign"]);
    expect(r[0]!.plano!.patch).toEqual({ data_faturamento: "2026-11-12" });
  });
  it("emplacamento: exige faturado, placa válida e única", () => {
    const r = validarLista("emplacamento", [{ ref: "22222222222222222", placa: "xyz9k88" }, { ref: "11111111111111111", placa: "XYZ9K88" }, { ref: "33333333333333333", placa: "AAA1B22" }, { ref: "22222222222222222", placa: "ZZZ" }], ctx);
    expect(r[0]).toMatchObject({ tom: "ok" }); expect(r[0]!.plano!.patch).toMatchObject({ placa: "XYZ9K88", data_emplacamento: "2026-11-12", status_ciclo: "disponivel" });
    expect(r[1]!.texto).toContain("ainda não foi faturado");
    expect(r[2]!.tom).toBe("dup");
    expect(r[3]!.texto).toContain("mais de uma vez");
  });
  it("devolução e reserva", () => {
    expect(validarLista("devolucao", [{ ref: "ABC1D23" }, { ref: "S10 4444" }], ctx).map((x) => x.tom)).toEqual(["ok", "dup"]);
    expect(validarLista("reserva", [{ ref: "ONIX RS 1111" }, { ref: "ONIX RS 2222" }], { ...ctx, eventoId: "e1", jaNoEvento: new Set(["2"]) }).map((x) => x.tom)).toEqual(["ok", "dup"]);
  });
  it("matriz: ignora cabeçalho, lê referência e placa", () => {
    expect(linhasDeMatriz([["VIN", "Placa"], ["111", "ABC1D23"], ["222", ""]])).toEqual([{ ref: "111", placa: "ABC1D23" }, { ref: "222", placa: undefined }]);
    expect(linhasDeMatriz([["11111111111111111"]])).toEqual([{ ref: "11111111111111111", placa: undefined }]);
  });
  it("liberação, chegada na planta e devolução para a CVO seguem a ordem do ciclo", () => {
    const f2 = [v("a", { codigo: "A", vin: "AAAAAAAAAAAAAAAAA", status_ciclo: "pedido_recebido" }), v("b", { codigo: "B", vin: "BBBBBBBBBBBBBBBBB", status_ciclo: "liberado", data_liberacao: "2026-11-01" }), v("c", { codigo: "C", vin: "CCCCCCCCCCCCCCCCC", status_ciclo: "disponivel_sem_faturamento" }), v("d", { codigo: "D", vin: "DDDDDDDDDDDDDDDDD", status_ciclo: "em_devolucao" })];
    const c2 = { veiculos: f2, data: "2026-11-12" };
    expect(validarLista("liberacao", [{ ref: "A" }, { ref: "B" }], c2).map((x) => x.tom)).toEqual(["ok", "dup"]);
    expect(validarLista("chegada", [{ ref: "A" }, { ref: "B" }, { ref: "C" }], c2).map((x) => x.tom)).toEqual(["erro", "ok", "dup"]);
    const r = validarLista("devolucaoCvo", [{ ref: "C" }, { ref: "D" }], c2);
    expect(r.map((x) => x.tom)).toEqual(["ok", "dup"]); expect(r[0]!.plano!.patch).toEqual({ status_ciclo: "em_devolucao" });
  });
  it("saiu e retornou do evento: acha a reserva do carro, respeita o evento escolhido e ignora quem já tem o checklist", () => {
    const reservas = [{ id: "r1", veiculo_id: "1", evento_id: "e1", estado: "reservado" }, { id: "r2", veiculo_id: "2", evento_id: "e1", estado: "em_uso" }, { id: "r3", veiculo_id: "2", evento_id: "e2", estado: "reservado" }];
    const base = { veiculos: frota, data: "2026-11-12", reservas, checklistsFeitos: new Set(["r2:retorno"]), nomeDoEvento: (id: string) => `Evento ${id}` };
    const s = validarLista("saida", [{ ref: "ONIX RS 1111" }, { ref: "ONIX RS 2222" }, { ref: "S10 3333" }], base);
    expect(s.map((x) => x.tom)).toEqual(["ok", "erro", "erro"]);   // o 2 está em dois eventos abertos; o 3 não tem reserva
    expect(s[0]!.reservaId).toBe("r1");
    expect(validarLista("saida", [{ ref: "ONIX RS 2222" }], { ...base, eventoId: "e2" })[0]!.reservaId).toBe("r3");
    const rt = validarLista("retorno", [{ ref: "ONIX RS 2222" }], { ...base, eventoId: "e1" });
    expect(rt[0]!.tom).toBe("dup");
  });
  it("chegou na planta e placas solicitadas: data, ordem das etapas e prazo", () => {
    const vs = [
      v("1", { codigo: "A", vin: "11111111111111111", status_ciclo: "liberado" }),
      v("2", { codigo: "B", vin: "22222222222222222", status_ciclo: "disponivel_sem_faturamento", data_chegada_planta: "2026-11-01", data_faturamento: "2026-11-02" }),
      v("3", { codigo: "C", vin: "33333333333333333", status_ciclo: "disponivel_sem_faturamento", data_chegada_planta: "2026-11-01" }),
    ];
    const c = validarLista("chegada", [{ ref: "A", data: "05/11/2026" }, { ref: "B" }], { veiculos: vs, data: "2026-11-12" });
    expect(c.map((x) => x.tom)).toEqual(["ok", "dup"]);
    expect(c[0]!.plano!.patch).toEqual({ data_chegada_planta: "2026-11-05", status_ciclo: "disponivel_sem_faturamento" });
    const p = validarLista("placas", [{ ref: "B" }, { ref: "C" }, { ref: "A" }], { veiculos: vs, data: "2026-11-04" });
    expect(p.map((x) => x.tom)).toEqual(["ok", "erro", "erro"]);   // B ok; C não foi faturado; A nem chegou
    expect(p[0]!.plano!.patch).toEqual({ data_placas_solicitadas: "2026-11-04" });
    expect(p[0]!.texto).toMatch(/3 dias desde a chegada na planta/);
  });
});
