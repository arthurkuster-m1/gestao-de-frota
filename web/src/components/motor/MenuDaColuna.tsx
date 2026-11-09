import { useEffect, useRef } from "react";
import { ArrowDown, ArrowUp, EyeSlash, Funnel, PushPin, Rows, X } from "@phosphor-icons/react";
import { usePopover } from "../../ds/popover";
import { OPERADORES_DO_TIPO } from "../../lib/motor/consulta";
import type { PreferenciasDaTabela } from "../../lib/motor/layout";
import type { CampoDaTela } from "./tipos";

/** O mini menu de uma coluna (clique no título): filtrar, ordenar, agrupar, ocultar e congelar já naquela coluna. */
export function MenuDaColuna<T>({ ancora, campo, indice, prefs, onPrefs, aoFiltrar, onFechar }: {
  ancora: HTMLElement | null; campo: CampoDaTela<T> | undefined; indice: number; prefs: PreferenciasDaTabela; onPrefs: (p: PreferenciasDaTabela) => void; aoFiltrar?: (i: number) => void; onFechar: () => void;
}) {
  const gatilho = useRef<HTMLElement | null>(null);
  gatilho.current = ancora;
  const { ref, aberto, setAberto } = usePopover(gatilho, { largura: 248, alturaMax: 420 });
  useEffect(() => { setAberto(!!ancora && !!campo); }, [ancora, campo, setAberto]);
  const estavaAberto = useRef(false);
  useEffect(() => { if (estavaAberto.current && !aberto) onFechar(); estavaAberto.current = aberto; }, [aberto, onFechar]);
  const fecha = () => setAberto(false);
  const faz = (p: Partial<PreferenciasDaTabela>) => { onPrefs({ ...prefs, ...p }); fecha(); };
  if (!campo) return <div ref={ref} popover="auto" className="ds-pop mt-painel" />;

  const ordem = prefs.ordenacao?.[0]?.campo === campo.id ? prefs.ordenacao[0]!.direcao : null;
  const agrupada = prefs.agrupar === campo.id;
  const filtros = prefs.filtros ?? [];
  const podeOcultar = !campo.fixa && !campo.semOcultar;
  const congelada = (prefs.congelar ?? 1) === indice + 1;
  return (
    <div ref={ref} popover="auto" className="ds-pop mt-painel mt-menucol" role="menu" aria-label={`Coluna ${campo.titulo}`} data-testid="menu-coluna">
      <p className="mt-menucol__titulo">{campo.titulo}</p>
      <button type="button" role="menuitem" className="mt-item" data-testid="coluna-filtrar" onClick={() => { faz({ filtros: [...filtros, { campo: campo.id, operador: OPERADORES_DO_TIPO[campo.tipo][0]!, ...(filtros.length ? { juncao: "e" as const } : {}) }] }); aoFiltrar?.(filtros.length); }}><Funnel size={18} />Filtrar</button>
      <button type="button" role="menuitem" className="mt-item" aria-current={ordem === "asc"} data-testid="coluna-asc" onClick={() => faz({ ordenacao: ordem === "asc" ? undefined : [{ campo: campo.id, direcao: "asc" }] })}><ArrowUp size={18} />Ordenar crescente{ordem === "asc" && " ✓"}</button>
      <button type="button" role="menuitem" className="mt-item" aria-current={ordem === "desc"} data-testid="coluna-desc" onClick={() => faz({ ordenacao: ordem === "desc" ? undefined : [{ campo: campo.id, direcao: "desc" }] })}><ArrowDown size={18} />Ordenar decrescente{ordem === "desc" && " ✓"}</button>
      <button type="button" role="menuitem" className="mt-item" data-testid="coluna-agrupar" onClick={() => faz({ agrupar: agrupada ? undefined : campo.id })}>{agrupada ? <X size={18} /> : <Rows size={18} />}{agrupada ? "Remover agrupamento" : "Agrupar por esta coluna"}</button>
      <button type="button" role="menuitem" className="mt-item" data-testid="coluna-congelar" onClick={() => faz({ congelar: congelada ? 0 : indice + 1 })}><PushPin size={18} />{congelada ? "Descongelar colunas" : "Congelar até aqui"}</button>
      {podeOcultar && <button type="button" role="menuitem" className="mt-item" data-testid="coluna-ocultar" onClick={() => faz({ visiveis: { ...prefs.visiveis, [campo.id]: false } })}><EyeSlash size={18} />Ocultar coluna</button>}
    </div>
  );
}
