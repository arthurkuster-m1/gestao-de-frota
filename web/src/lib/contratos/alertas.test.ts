import { describe, expect, it } from "vitest";
import { alertasDeContratos } from "./alertas";
import type { Contrato } from "./tipos";

const c = (o: Partial<Contrato> = {}): Contrato => ({ id: "k", evento_id: "e", cliente_id: "c1", status: "assinado", vigencia_inicio: "2026-11-10", vigencia_fim: "2026-11-20", assinado_em: null, observacoes: null, snapshot: null, created_at: "", ...o });
const base = { aditivos: [], itens: [], eventos: [{ id: "e", nome: "Evento X", chegada_prevista: "2026-11-10", retirada_prevista: "2026-11-25", cliente_id: "c1" }] as never, reservas: [], veiculos: [], carros: [], clientes: new Map<string, string>() };

describe("alertas de contrato", () => {
  it("avisa quando o evento passa da vigência; planejado e encerrado não avisam", () => {
    expect(alertasDeContratos({ ...base, contratos: [c()] })[0]).toMatchObject({ contratoId: "k", eventoNome: "Evento X", textos: [expect.stringContaining("depois do fim da vigência")] });
    expect(alertasDeContratos({ ...base, contratos: [c({ status: "rascunho" })] })).toEqual([]);
    expect(alertasDeContratos({ ...base, contratos: [c({ status: "encerrado" })] })).toEqual([]);
  });
  it("sem divergência, sem alerta", () => {
    expect(alertasDeContratos({ ...base, contratos: [c({ vigencia_fim: "2026-11-25" })] })).toEqual([]);
  });
});
