import { atualizarEvento } from "../../eventos/dados";
import { CAMPOS as CAMPOS_EVENTO, agruparEventos, lerData, validarTudo as validarEventos, type EventoPronto } from "../../eventos/importacao";
import { importarEventos } from "../../eventos/importar";
import { STATUS_EVENTO, TIPOS_EVENTO } from "../../eventos/tipos";
import type { Coluna, Lancamento, Linha } from "../tipos";

const opcoesDeTipo = TIPOS_EVENTO.map((t) => ({ value: t, label: t }));

const novoEvento: Lancamento = {
  id: "novo-evento", grupo: "Eventos", rotulo: "Novos eventos (inclusive históricos)", descricao: "Cadastra vários eventos de uma vez. Retirada que já passou entra como Concluído. Vários carros: separe por ; na mesma célula ou repita o título em várias linhas.",
  botao: (n) => `Cadastrar ${n} evento${n === 1 ? "" : "s"}`,
  colunas: (d) => CAMPOS_EVENTO.map((c): Coluna => ({ id: c.id, titulo: c.titulo, largura: c.largura,
    ...(c.id === "tipo" ? { opcoes: opcoesDeTipo } : c.id === "status" ? { opcoes: STATUS_EVENTO } : c.id === "cliente" ? { opcoes: d.clientes.map((x) => ({ value: x.nome, label: x.nome })) } : {}) })),
  validar: (linhas, d) => validarEventos(linhas as never, { veiculos: d.veiculos, clientes: d.clientes, nomesDeEventos: d.eventos.map((e) => e.nome), hoje: d.hoje }).map((r) => ({ tom: r.tom, texto: r.texto, pronto: r.evento })),
  aplicar: async (prontos, d) => {
    const eventos = prontos.map((x) => x.pronto as EventoPronto);
    const r = await importarEventos(agruparEventos(eventos), d.hoje);
    const criados = new Set(r.criados.map((n) => n.toLowerCase()));
    return { feitos: prontos.filter((x) => criados.has((x.pronto as EventoPronto).nome.toLowerCase())).map((x) => x.indice), falha: r.falha ? `Parou em “${r.falha.nome}”: ${r.falha.erro}` : null };
  },
};

type Plano = { id: string; nome: string; patch: Record<string, unknown> };
const atualizarEventos: Lancamento = {
  id: "atualizar-evento", grupo: "Eventos", rotulo: "Atualizar eventos (status, tipo, contatos…)", descricao: "Muda status, tipo, solicitante, contato ou datas de vários eventos. Só preencha o que quer mudar. Datas só mudam em evento sem carros datados.",
  botao: (n) => `Atualizar ${n} evento${n === 1 ? "" : "s"}`,
  colunas: () => [
    { id: "ref", titulo: "Evento (título)", largura: 260 }, { id: "status", titulo: "Status", largura: 190, opcoes: STATUS_EVENTO }, { id: "tipo", titulo: "Tipo", largura: 200, opcoes: opcoesDeTipo },
    { id: "solicitante", titulo: "Solicitante", largura: 160 }, { id: "contato", titulo: "Contato", largura: 170 }, { id: "chegada", titulo: "Data de chegada", largura: 140 }, { id: "retirada", titulo: "Data de retirada", largura: 140 },
  ],
  validar: (linhas, d) => {
    const vistos = new Set<string>();
    return linhas.map((l: Linha) => {
      if (Object.values(l).every((v) => !(v ?? "").trim())) return { tom: "ign" as const, texto: "Linha vazia" };
      const e = d.eventos.filter((x) => x.nome.trim().toLowerCase() === (l.ref ?? "").trim().toLowerCase());
      if (e.length === 0) return { tom: "erro" as const, texto: `Evento não encontrado: "${l.ref ?? ""}"` };
      const ev = e[0]!; if (vistos.has(ev.id)) return { tom: "erro" as const, texto: `${ev.nome} aparece mais de uma vez` }; vistos.add(ev.id);
      const patch: Record<string, unknown> = {};
      if (l.status && l.status !== ev.status) patch.status = l.status;
      if (l.tipo && l.tipo !== ev.tipo) patch.tipo = l.tipo;
      if (l.solicitante?.trim() && l.solicitante.trim() !== ev.solicitante) patch.solicitante = l.solicitante.trim();
      if (l.contato?.trim() && l.contato.trim() !== ev.contato) patch.contato = l.contato.trim();
      for (const [col, campo] of [["chegada", "chegada_prevista"], ["retirada", "retirada_prevista"]] as const) {
        if (!l[col]?.trim()) continue; const dt = lerData(l[col]);
        if (dt === "x" || !dt) return { tom: "erro" as const, texto: `Data inválida: "${l[col]}" (use dd/mm/aaaa)` };
        if (d.reservas.some((r) => r.evento_id === ev.id && r.estado !== "cancelado" && r.reserva_inicio)) return { tom: "erro" as const, texto: `${ev.nome} tem carros com data: as datas seguem as reservas` };
        patch[campo] = dt;
      }
      if (Object.keys(patch).length === 0) return { tom: "dup" as const, texto: `${ev.nome}: nada para mudar` };
      const quer = Object.keys(patch).map((k) => ({ status: "status", tipo: "tipo", solicitante: "solicitante", contato: "contato", chegada_prevista: "chegada", retirada_prevista: "retirada" } as Record<string, string>)[k]);
      return { tom: "ok" as const, texto: `${ev.nome}: ${quer.join(", ")}${patch.status === "em_uso" ? " (em uso: faça o checklist de saída dos carros)" : ""}`, pronto: { id: ev.id, nome: ev.nome, patch } as Plano };
    });
  },
  aplicar: async (prontos) => {
    const feitos: number[] = [];
    for (const { indice, pronto } of prontos) { const p = pronto as Plano; try { await atualizarEvento(p.id, p.patch as never); feitos.push(indice); } catch (e) { return { feitos, falha: `${p.nome}: ${(e as Error).message}` }; } }
    return { feitos, falha: null };
  },
};

export const LANCAMENTOS_DE_EVENTOS: Lancamento[] = [novoEvento, atualizarEventos];
