import { describe, expect, it } from "vitest";
import type { Evento, EventoLocal, ReservaDoEvento } from "./tipos";
import { calcularDatasDoEvento } from "./rotasDoEvento";

const ev = { id: "e", nome: "X", status: "planejado", chegada_prevista: "2026-11-10", retirada_prevista: "2026-11-14", origem: "ORIGEM", envio_previsto: null, retorno_previsto: null } as unknown as Evento;
const local = { id: "l", evento_id: "e", rotulo: null, endereco: "LOCAL", posicao: 0 } as EventoLocal;
const carro = (id: string, o: Partial<ReservaDoEvento> = {}) => ({ id, evento_id: "e", veiculo_id: id, estado: "reservado", reserva_inicio: "2026-11-01", reserva_fim: "2026-11-20", chegada: null, retirada: null, ...o }) as ReservaDoEvento;
const dist = (tabela: Record<string, number>) => async (o: string, d: string) => (tabela[`${o}→${d}`] !== undefined ? { km: tabela[`${o}→${d}`]!, metodo: "rota" as const } : null);

describe("datas de envio e retorno", () => {
  it("envio = chegada − dias da ida; retorno = retirada + dias da volta (km ÷ 500 para cima)", async () => {
    const r = await calcularDatasDoEvento({ evento: ev, reservas: [carro("a")], locais: [local], distancia: dist({ "ORIGEM→LOCAL": 2600, "LOCAL→ORIGEM": 2600 }) });
    expect(r.kmIda).toBe(2600);
    expect(r.envio).toBe("2026-11-04");     // 6 dias antes de 10/11
    expect(r.retorno).toBe("2026-11-20");   // 6 dias depois de 14/11
    expect(r.porCarro[0]).toMatchObject({ envio: "2026-11-04", retorno: "2026-11-20" });
  });
  it("carro com retorno em outro lugar usa a rota dele; o evento fica com o envio mais cedo e o retorno mais tarde", async () => {
    const r = await calcularDatasDoEvento({ evento: ev, reservas: [carro("a"), carro("b", { endereco_retorno: "OUTRO" })], locais: [local], distancia: dist({ "ORIGEM→LOCAL": 400, "LOCAL→ORIGEM": 400, "LOCAL→OUTRO": 1200 }) });
    expect(r.porCarro[1]!.retorno).toBe("2026-11-17");   // 14/11 + 3 dias
    expect(r.retorno).toBe("2026-11-17");
    expect(r.envio).toBe("2026-11-09");
    expect(r.kmVolta).toBe(1200);
  });
  it("sem rota ou sem datas avisa o que falta", async () => {
    const r = await calcularDatasDoEvento({ evento: { ...ev, chegada_prevista: null } as Evento, reservas: [carro("a")], locais: [], distancia: dist({}) });
    expect(r.envio).toBeNull();
    expect(r.avisos.join(" ")).toMatch(/data de chegada/);
    expect(r.avisos.join(" ")).toMatch(/Faltou origem/);
  });
});
