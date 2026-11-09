import { Check } from "@phosphor-icons/react";
import { DateField, Input, Select, cx } from "../../ds";
import { DATAS_RELATIVAS, PERIODOS_RELATIVOS, type Filtro } from "../../lib/motor/consulta";
import { ROTULO_DA_DATA, ROTULO_DO_PERIODO } from "./rotulos";
import { Tag } from "./Tag";
import type { OpcaoDoCampo } from "./tipos";

/** O valor de um filtro, no controle certo para o tipo do campo e o operador. */
export function CampoDeValor({ tipo, campoId, operador, valor, opcoes, onChange }: { tipo: string; campoId?: string; operador: Filtro["operador"]; valor: Filtro["valor"]; opcoes: readonly OpcaoDoCampo[]; onChange: (v: Filtro["valor"]) => void }) {
  if (tipo === "texto") return <Input value={typeof valor === "string" ? valor : ""} onChange={(e) => onChange(e.target.value)} placeholder="Valor…" aria-label="Valor do filtro" />;
  if (tipo === "numero") return <Input type="number" inputMode="decimal" value={valor === undefined ? "" : String(valor)} onChange={(e) => onChange(e.target.value === "" ? undefined : Number(e.target.value))} aria-label="Valor do filtro" />;
  if (tipo === "opcao" || tipo === "pessoa" || tipo === "multi") {
    const marcados = Array.isArray(valor) ? valor : typeof valor === "string" && valor ? [valor] : [];
    const alterna = (v: string) => onChange(marcados.includes(v) ? marcados.filter((x) => x !== v) : [...marcados, v]);
    if (opcoes.length === 0) return <p className="t-body-sm t-muted">Sem valores para escolher ainda.</p>;
    return (
      <div className="mt-notion" data-testid="lista-de-valores">
        <div className="mt-notion__lista" role="group" aria-label="Valores do filtro">
          {opcoes.map((o) => { const on = marcados.includes(o.value); return (
            <button key={o.value} type="button" role="checkbox" aria-checked={on} className={cx("mt-notion__linha", on && "is-on")} onClick={() => alterna(o.value)}>
              <span className={cx("mt-chk", on && "is-on")} aria-hidden>{on && <Check size={11} weight="bold" />}</span><Tag opcao={o} campoId={campoId} />
            </button>); })}
        </div>
        {marcados.length > 0 && <button type="button" className="mt-notion__limpar" onClick={() => onChange([])}>Limpar seleção</button>}
      </div>
    );
  }
  if (tipo === "data") {
    const v = typeof valor === "string" ? valor : "";
    if (operador === "periodo") return <Select value={v || "esta_semana"} onChange={(e) => onChange(e.target.value)}>{PERIODOS_RELATIVOS.map((p) => <option key={p} value={p}>{ROTULO_DO_PERIODO[p]}</option>)}</Select>;
    const relativa = (DATAS_RELATIVAS as readonly string[]).includes(v);
    return (
      <div className="mt-data">
        <Select value={relativa ? v : "exata"} onChange={(e) => onChange(e.target.value === "exata" ? "" : e.target.value)}>
          <option value="exata">Data exata</option>{DATAS_RELATIVAS.map((d) => <option key={d} value={d}>{ROTULO_DA_DATA[d]}</option>)}
        </Select>
        {!relativa && <DateField value={v} onChange={(e) => onChange(e.target.value)} />}
      </div>
    );
  }
  return null;
}
