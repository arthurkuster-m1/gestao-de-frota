import { useEffect, useState } from "react";
import { Trash, Warning } from "@phosphor-icons/react";
import { Button, Field, Input, Sheet, useToast } from "../../ds";
import { excluirVeiculos } from "../../lib/veiculos/dados";
import type { Veiculo } from "../../lib/veiculos/tipos";

export const PALAVRA_DE_CONFIRMACAO = "EXCLUIR";
const codigo = (v: Pick<Veiculo, "codigo" | "modelo">) => v.codigo ?? v.modelo.toUpperCase();

/**
 * Exclusão de veículos com DUPLA confirmação: 1º passo mostra o que será apagado junto; 2º passo pede para digitar EXCLUIR.
 * `consequencias`: quantas reservas em eventos e manutenções os carros têm (vão embora com eles).
 */
export function ExcluirVeiculos({ aberto, onFechar, veiculos, consequencias, onExcluido }: {
  aberto: boolean; onFechar: () => void; veiculos: readonly Veiculo[]; consequencias: { reservas: number; manutencoes: number }; onExcluido: () => void;
}) {
  const toast = useToast();
  const [passo, setPasso] = useState<1 | 2>(1);
  const [texto, setTexto] = useState("");
  const [falha, setFalha] = useState<string | null>(null);
  const [excluindo, setExcluindo] = useState(false);
  useEffect(() => { if (aberto) { setPasso(1); setTexto(""); setFalha(null); setExcluindo(false); } }, [aberto]);
  const n = veiculos.length;
  const plural = (q: number, um: string, varios: string) => `${q} ${q === 1 ? um : varios}`;
  const liberado = texto.trim().toUpperCase() === PALAVRA_DE_CONFIRMACAO;

  async function excluir() {
    if (!liberado || excluindo) return;
    setExcluindo(true); setFalha(null);
    try { const feitos = await excluirVeiculos(veiculos.map((v) => v.id)); toast(`${plural(feitos, "veículo excluído", "veículos excluídos")}`); onExcluido(); onFechar(); }
    catch (e) { setFalha((e as Error).message); } finally { setExcluindo(false); }
  }

  return (
    <Sheet open={aberto} onClose={onFechar} title={passo === 1 ? `Excluir ${plural(n, "veículo", "veículos")}?` : "Confirmação final"}>
      {passo === 1 ? (
        <div className="ds-stack" data-testid="excluir-passo-1">
          <p className="t-body"><Warning size={20} weight="fill" style={{ verticalAlign: "-4px", color: "var(--color-warning-fg)" }} /> Isto apaga {n === 1 ? "o veículo" : "os veículos"} de vez. <b>Não dá para desfazer.</b></p>
          <ul className="mt-escolha" role="list" style={{ maxHeight: 180, overflow: "auto" }}>
            {veiculos.slice(0, 8).map((v) => <li key={v.id} className="mt-escolha__item"><span className="mt-escolha__nome">{codigo(v)}</span></li>)}
            {n > 8 && <li className="t-body-sm t-muted">e mais {n - 8}…</li>}
          </ul>
          <p className="t-body-sm">Vai embora junto: <b>{plural(consequencias.reservas, "reserva em evento", "reservas em eventos")}</b> (com os checklists), <b>{plural(consequencias.manutencoes, "manutenção", "manutenções")}</b>, o histórico do carro e a presença dele em contratos. Pedidos de modelo que ele atendia voltam a ficar em aberto.</p>
          <div className="ds-row" style={{ justifyContent: "flex-end", gap: 8 }}>
            <Button variant="ghost" onClick={onFechar}>Cancelar</Button>
            <Button variant="danger" icon={<Trash size={18} />} onClick={() => setPasso(2)} data-testid="excluir-continuar">Continuar</Button>
          </div>
        </div>
      ) : (
        <form className="ds-stack" data-testid="excluir-passo-2" onSubmit={(e) => { e.preventDefault(); e.stopPropagation(); void excluir(); }}>
          <p className="t-body">Para confirmar, digite <b>{PALAVRA_DE_CONFIRMACAO}</b> abaixo. Serão excluídos <b>{plural(n, "veículo", "veículos")}</b>{n === 1 ? ` (${codigo(veiculos[0]!)})` : ""}.</p>
          <Field label="Digite EXCLUIR" error={falha}><Input value={texto} onChange={(e) => setTexto(e.target.value)} autoFocus autoComplete="off" aria-label="Digite EXCLUIR para confirmar" data-testid="excluir-palavra" /></Field>
          <div className="ds-row" style={{ justifyContent: "space-between", gap: 8 }}>
            <Button type="button" variant="ghost" onClick={() => setPasso(1)}>Voltar</Button>
            <Button type="submit" variant="danger" icon={<Trash size={18} />} disabled={!liberado} loading={excluindo} data-testid="excluir-definitivo">Excluir definitivamente</Button>
          </div>
        </form>
      )}
    </Sheet>
  );
}
