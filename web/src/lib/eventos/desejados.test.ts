import { describe, expect, it } from "vitest";
import { cabeNosPedidos, combina, pedidoQueAtende } from "./desejados";
import type { ModeloDesejado } from "./tipos";

const ped = (p: Partial<ModeloDesejado>): ModeloDesejado => ({ id: "1", evento_id: "e", modelo: "S10", versao: null, cor: null, my: null, reserva_id: null, nao_atendido: false, nota: null, posicao: 0, ...p });
const v = (modelo: string, cor: string | null = null, my: string | null = null) => ({ modelo, cor, my });

describe("modelos desejados", () => {
  it("só modelo mãe: qualquer versão serve", () => { expect(combina(v("S10 High Country"), ped({}))).toBe(true); expect(combina(v("Onix RS"), ped({}))).toBe(false); });
  it("modelo, versão, cor e MY informados precisam bater (sem caixa)", () => {
    const d = ped({ versao: "TRAILBOSS PITCH", cor: "branco", my: "2027" });
    expect(combina(v("s10 trailboss pitch", "Branco", "2027"), d)).toBe(true);
    expect(combina(v("S10 TRAILBOSS PITCH", "Preto", "2027"), d)).toBe(false);
    expect(combina(v("S10 TRAILBOSS", "Branco", "2027"), d)).toBe(false);
    expect(combina(v("S10 TRAILBOSS PITCH", "Branco", "2026"), d)).toBe(false);
  });
  it("pedidos atendidos ou indisponíveis não filtram mais; sem pedido em aberto, tudo serve", () => {
    expect(cabeNosPedidos(v("Onix"), [ped({})])).toBe(false);
    expect(cabeNosPedidos(v("Onix"), [ped({ reserva_id: "r" }), ped({ nao_atendido: true })])).toBe(true);
    expect(cabeNosPedidos(v("Onix"), [])).toBe(true);
  });
  it("acha o pedido que o carro atende", () => { const a = ped({ id: "a", modelo: "Onix" }), b = ped({ id: "b" }); expect(pedidoQueAtende(v("S10 X"), [a, b])?.id).toBe("b"); });
});
