import { baixarArquivo, gerarAditivoDocx, gerarContratoDocx, nomeDoArquivoDoAditivo, nomeDoArquivoDoContrato, tituloDoAditivo, type SnapshotDoContrato } from "../../lib/contratos/documentos";
import { montarSnapshotDoAditivo, montarSnapshotDoContrato } from "../../lib/contratos/montar";
import type { Aditivo, AditivoVeiculo, Contrato, ContratoVeiculo } from "../../lib/contratos/tipos";
import type { ContextoDeContratos } from "./camposDeContratos";

/** O DOCX do contrato: depois de assinado sai SEMPRE igual (do snapshot); antes, com os dados de agora. */
export async function baixarContratoDocx(c: Contrato, ctx: ContextoDeContratos, carros: readonly ContratoVeiculo[]) {
  const evento = ctx.eventos.get(c.evento_id); if (!evento) throw new Error("Evento não encontrado.");
  const salvo = c.snapshot as unknown as SnapshotDoContrato | null;
  const travado = c.status === "assinado" || c.status === "encerrado";
  const snap = travado && salvo ? salvo : await montarSnapshotDoContrato({ evento, clienteId: c.cliente_id, veiculos: ctx.veiculos, carroIds: carros.filter((x) => x.contrato_id === c.id).map((x) => x.veiculo_id), reservas: ctx.reservasDoEvento.get(c.evento_id) ?? [], locais: ctx.locais, vigencia: { inicio: c.vigencia_inicio, fim: c.vigencia_fim } });
  baixarArquivo(await gerarContratoDocx(snap), nomeDoArquivoDoContrato(evento.nome));
}
export async function baixarAditivoDocx(c: Contrato, a: Aditivo, numero: number, ctx: ContextoDeContratos, itens: readonly AditivoVeiculo[]) {
  const evento = ctx.eventos.get(c.evento_id); if (!evento) throw new Error("Evento não encontrado.");
  const doAditivo = itens.filter((i) => i.aditivo_id === a.id);
  const snap = await montarSnapshotDoAditivo({ contrato: c, aditivo: a, numero, veiculos: ctx.veiculos, sai: doAditivo.filter((i) => i.acao === "sai").map((i) => i.veiculo_id), entra: doAditivo.filter((i) => i.acao === "entra").map((i) => i.veiculo_id) });
  baixarArquivo(await gerarAditivoDocx(a.tipo, snap), nomeDoArquivoDoAditivo(evento.nome, a.titulo ?? tituloDoAditivo(numero, a.tipo)));
}
