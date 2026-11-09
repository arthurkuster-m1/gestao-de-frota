import { useState } from "react";
import { Check } from "@phosphor-icons/react";
import { Sheet, cx, useToast } from "../../ds";
import { COR_DO_TOM, PALETA, corDaOpcao, salvarCor, useCores, type CorDaTag } from "../../lib/motor/cores";
import { Tag } from "./Tag";
import type { OpcaoDoCampo } from "./tipos";

/** Janela para escolher a cor de cada opção de um campo (status, ciclo de vida…). Vale para a tabela, os filtros e as listas. */
export function EditorDeCores({ aberto, onFechar, campoId, titulo, opcoes }: { aberto: boolean; onFechar: () => void; campoId: string; titulo: string; opcoes: readonly OpcaoDoCampo[] }) {
  const mapa = useCores();
  const toast = useToast();
  const [erro, setErro] = useState<string | null>(null);
  const escolher = async (valor: string, cor: CorDaTag | null) => { setErro(null); try { await salvarCor(campoId, valor, cor); } catch (e) { setErro((e as Error).message); toast("Não salvou a cor"); } };
  return (
    <Sheet open={aberto} onClose={onFechar} title={`Cores de ${titulo}`}>
      <div className="ds-stack" data-testid="editor-de-cores">
        {erro && <p className="t-body-sm" role="alert" style={{ color: "var(--color-error-fg)" }}>{erro}</p>}
        {opcoes.map((o) => {
          const atual = corDaOpcao(mapa, campoId, o.value, o.tom);
          const padrao = (o.tom ? COR_DO_TOM[o.tom] : undefined) ?? "cinza";
          return (
            <div key={o.value} className="mt-cor-linha">
              <Tag opcao={o} campoId={campoId} />
              <div className="mt-cor-paleta" role="radiogroup" aria-label={`Cor de ${o.label}`}>
                {PALETA.map((c) => (
                  <button key={c.id} type="button" role="radio" aria-checked={atual === c.id} title={c.nome} aria-label={c.nome} className={cx("mt-cor", `ds-badge--cor-${c.id}`, atual === c.id && "is-on")} onClick={() => void escolher(o.value, c.id === padrao ? null : c.id)}>{atual === c.id && <Check size={12} weight="bold" />}</button>
                ))}
              </div>
            </div>
          );
        })}
      </div>
    </Sheet>
  );
}
