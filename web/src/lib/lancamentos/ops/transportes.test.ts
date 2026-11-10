import { describe, expect, it } from "vitest";
import type { Transporte } from "../../transportes/tipos";
import type { Dados } from "../tipos";
import { LANCAMENTOS_DE_TRANSPORTES, repartirValor, transportesDaReferencia } from "./transportes";

const t = (id: string, o: Partial<Transporte>) => ({ id, evento_id: "e", sentido: "ida", modalidade: "pta", referencia: "PTAS1", valor_planejado: 1000, valor_real: null, status_pagamento: "aprovado", data_pagamento: null, ...o }) as Transporte;
const dados = (transportes: Transporte[]) => ({ veiculos: [], eventos: [], reservas: [], manutencoes: [], clientes: [], checklists: [], transportes, hoje: "2026-11-12" }) as Dados;
const op = LANCAMENTOS_DE_TRANSPORTES[0]!;

describe("repartir o valor pago", () => {
  it("na proporção do valor planejado, com os centavos no último", () => {
    expect(repartirValor(1500, [{ valor_planejado: 1000 }, { valor_planejado: 500 }])).toEqual([1000, 500]);
    expect(repartirValor(100, [{ valor_planejado: null }, { valor_planejado: null }, { valor_planejado: null }])).toEqual([33.33, 33.33, 33.34]);
    expect(repartirValor(900, [{ valor_planejado: 1000 }])).toEqual([900]);
  });
});

describe("lançamento: pagamento de PTA / NF", () => {
  it("acha todos os transportes da referência (sem maiúsculas) e ignora retirada", () => {
    const d = dados([t("a", {}), t("b", { sentido: "volta", referencia: "ptas1" }), t("c", { modalidade: "retirada" }), t("d", { referencia: "OUTRA" })]);
    expect(transportesDaReferencia(d, " PTAS1 ").map((x) => x.id)).toEqual(["a", "b"]);
  });
  it("marca como paga, grava o valor real em todos e divide quando são vários", () => {
    const d = dados([t("a", { valor_planejado: 1000 }), t("b", { sentido: "volta", valor_planejado: 500 })]);
    const [r] = op.validar([{ ref: "PTAS1", valor: "1.500,00", data: "10/11/2026" }], d, {});
    expect(r!.tom).toBe("ok");
    const passos = r!.pronto as { id: string; patch: Record<string, unknown> }[];
    expect(passos.map((p) => p.id)).toEqual(["a", "b"]);
    expect(passos[0]!.patch).toEqual({ status_pagamento: "pago", data_pagamento: "2026-11-10", valor_real: 1000 });
    expect(passos[1]!.patch.valor_real).toBe(500);
  });
  it("NF da TSO termina em Aprovado com a data; 'não paga' só grava o valor", () => {
    const d = dados([t("n", { modalidade: "tso", referencia: "NF9", status_pagamento: "aprovar_nf" })]);
    const [pago] = op.validar([{ ref: "NF9", valor: "800" }], d, {});
    expect((pago!.pronto as { patch: Record<string, unknown> }[])[0]!.patch).toEqual({ status_pagamento: "aprovado", data_pagamento: "2026-11-12", valor_real: 800 });
    const [nao] = op.validar([{ ref: "NF9", pago: "nao", valor: "800" }], d, {});
    expect((nao!.pronto as { patch: Record<string, unknown> }[])[0]!.patch).toEqual({ valor_real: 800 });
  });
  it("erros: sem referência, número desconhecido, valor ou data inválidos, linha só 'não paga'; vazia é ignorada", () => {
    const d = dados([t("a", { status_pagamento: "pago", data_pagamento: "2026-11-01", valor_real: 1000 })]);
    const r = op.validar([{ ref: "", valor: "1" }, { ref: "XXX", valor: "1" }, { ref: "PTAS1", valor: "abc" }, {}], d, {});
    expect(r.map((x) => x.tom)).toEqual(["erro", "erro", "erro", "ign"]);
    expect(op.validar([{ ref: "PTAS1", valor: "1", data: "31/02/2026" }], d, {})[0]!.tom).toBe("erro");
    expect(op.validar([{ ref: "PTAS1", pago: "nao" }], d, {})[0]!.tom).toBe("erro");
  });
  it("já está assim vira 'sem mudança'; a mesma referência duas vezes na lista é erro", () => {
    const d = dados([t("a", { status_pagamento: "pago", data_pagamento: "2026-11-01", valor_real: 1000 })]);
    expect(op.validar([{ ref: "PTAS1", valor: "1000", data: "01/11/2026" }], d, {})[0]!.tom).toBe("dup");
    expect(op.validar([{ ref: "PTAS1", valor: "5" }, { ref: "ptas1", valor: "6" }], d, {}).map((x) => x.tom)).toEqual(["ok", "erro"]);
  });
});
