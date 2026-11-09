import { Select } from "./Select";
import { cx } from "../cx";

export type OpcaoDoSeletor = { id: string; rotulo: string };

/**
 * Seletor de subpáginas: no computador, uma linha arredondada com todas as opções; no celular, uma caixa de seleção.
 * `aoEscolher` recebe o id (quem usa navega ou troca a aba).
 */
export function SeletorPilula({ opcoes, ativo, aoEscolher, rotulo, className }: { opcoes: readonly OpcaoDoSeletor[]; ativo: string; aoEscolher: (id: string) => void; rotulo: string; className?: string }) {
  return (
    <div className={cx("ds-pilula", className)} data-testid="seletor-subpaginas">
      <div className="ds-pilula__pc" role="tablist" aria-label={rotulo}>
        {opcoes.map((o) => <button key={o.id} type="button" role="tab" aria-selected={o.id === ativo} className={cx("ds-pilula__opcao", o.id === ativo && "is-on")} onClick={() => aoEscolher(o.id)}>{o.rotulo}</button>)}
      </div>
      <div className="ds-pilula__cel">
        <Select aria-label={rotulo} value={ativo} onChange={(e) => aoEscolher(e.target.value)}>{opcoes.map((o) => <option key={o.id} value={o.id}>{o.rotulo}</option>)}</Select>
      </div>
    </div>
  );
}
