import { ClipboardText, Copy } from "@phosphor-icons/react";
import { paraTsv } from "../../components/motor/selecao";
import { useToast } from "../../ds";
import { codigoDoVeiculo, copiarTabela, tabelaDeVeiculosParaOutlook } from "../../lib/eventos/linhasDoEvento";
import type { Veiculo } from "../../lib/veiculos/tipos";

/** Dois botões no canto do título da coluna de códigos: copiar só os códigos, ou a tabela (Código, Placa, VIN, Modelo, Cor, MY) dos veículos que estão filtrados. */
export function BotoesDeCopia({ veiculos }: { veiculos: readonly Veiculo[] }) {
  const toast = useToast();
  const sem = (e: React.SyntheticEvent) => e.stopPropagation();   // o clique não abre o menu da coluna
  async function codigos() {
    if (veiculos.length === 0) { toast("Nenhum veículo para copiar"); return; }
    try { await navigator.clipboard.writeText(veiculos.map(codigoDoVeiculo).join("\n")); toast(`${veiculos.length} código${veiculos.length === 1 ? "" : "s"} copiado${veiculos.length === 1 ? "" : "s"}`); }
    catch { toast("Não consegui copiar. Libere a área de transferência no navegador."); }
  }
  async function tabela() {
    if (veiculos.length === 0) { toast("Nenhum veículo para copiar"); return; }
    toast((await copiarTabela(tabelaDeVeiculosParaOutlook(veiculos))) ? `Tabela de ${veiculos.length} veículo${veiculos.length === 1 ? "" : "s"} copiada: cole no Outlook` : "Não consegui copiar. Libere a área de transferência no navegador.");
  }
  return (
    <span className="mt-copias" onClick={sem} onDoubleClick={sem} onPointerDown={sem} onMouseDown={sem}>
      <button type="button" className="mt-btn mt-btn--icone" aria-label="Copiar só os códigos" title="Copiar só os códigos (filtrados)" onClick={() => void codigos()} data-testid="copiar-codigos"><Copy size={16} /></button>
      <button type="button" className="mt-btn mt-btn--icone" aria-label="Copiar código, placa, VIN, modelo, cor e MY" title="Copiar Código | Placa | VIN | Modelo | Cor | MY (filtrados)" onClick={() => void tabela()} data-testid="copiar-codigos-info"><ClipboardText size={16} /></button>
    </span>
  );
}

const ROTULO: Record<string, string> = { placa: "placas", vin: "chassis (VIN)", comentarios: "comentários" };
/** Botão de copiar a coluna inteira (placa, VIN ou comentários) dos veículos filtrados, uma linha por veículo (branco quando vazio, para manter o alinhamento). */
export function BotaoCopiarColuna({ campoId, veiculos }: { campoId: string; veiculos: readonly Veiculo[] }) {
  const toast = useToast();
  const sem = (e: React.SyntheticEvent) => e.stopPropagation();
  const rotulo = ROTULO[campoId] ?? campoId;
  async function copiar() {
    if (veiculos.length === 0) { toast("Nenhum veículo para copiar"); return; }
    const valor = (v: Veiculo) => (campoId === "placa" ? v.placa : campoId === "vin" ? v.vin : v.comentarios) ?? "";
    try { await navigator.clipboard.writeText(paraTsv(veiculos.map((v) => [valor(v)]))); toast(`${veiculos.length} linha${veiculos.length === 1 ? "" : "s"} de ${rotulo} copiada${veiculos.length === 1 ? "" : "s"}`); }
    catch { toast("Não consegui copiar. Libere a área de transferência no navegador."); }
  }
  return (
    <span className="mt-copias" onClick={sem} onDoubleClick={sem} onPointerDown={sem} onMouseDown={sem}>
      <button type="button" className="mt-btn mt-btn--icone" aria-label={`Copiar ${rotulo}`} title={`Copiar ${rotulo} (filtrados)`} onClick={() => void copiar()} data-testid={`copiar-coluna-${campoId}`}><Copy size={16} /></button>
    </span>
  );
}
