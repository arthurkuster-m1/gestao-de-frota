import { describe, expect, it, vi } from "vitest";

vi.mock("../clientes/dados", () => ({ buscarCliente: async () => ({ id: "c", tipo_pessoa: "juridica", nome: "ACME", documento: "", email: "", telefone: "", cep: "", endereco: "", numero: "", complemento: "", cidade: "", estado: "", testemunha_nome: "", testemunha_email: "", comentarios: "", motoristas: [] }) }));
import { montarSnapshotDoContrato } from "./montar";
import type { Evento, EventoLocal } from "../eventos/tipos";

const ev = (id: string) => ({ id, nome: `Evento ${id}`, status: "planejado", chegada_prevista: null, retirada_prevista: null, origem: null }) as unknown as Evento;
const local = (id: string, evento_id: string, endereco: string, posicao = 0) => ({ id, evento_id, rotulo: null, endereco, cidade: null, estado: null, posicao, tipo: "local" }) as EventoLocal;

describe("contrato de comodato: local_endereco", () => {
  it("usa o endereço do PRÓPRIO evento, mesmo recebendo os locais de todos os eventos", async () => {
    const locais = [local("l1", "outro", "Rua do Outro Evento, 1", 0), local("l2", "meu", "Av. do Meu Evento, 2", 0)];
    const s = await montarSnapshotDoContrato({ evento: ev("meu"), clienteId: "c", veiculos: new Map(), carroIds: [], reservas: [], locais, vigencia: { inicio: null, fim: null } });
    expect(s.localEndereco).toBe("Av. do Meu Evento, 2");
  });
  it("evento sem local não herda o de outro: fica vazio", async () => {
    const s = await montarSnapshotDoContrato({ evento: ev("meu"), clienteId: "c", veiculos: new Map(), carroIds: [], reservas: [], locais: [local("l1", "outro", "Rua do Outro Evento, 1")], vigencia: { inicio: null, fim: null } });
    expect(s.localEndereco).toBe("");
  });
});
