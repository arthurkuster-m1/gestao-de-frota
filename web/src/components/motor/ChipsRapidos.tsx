import { useMemo, useState } from "react";
import { DndContext, PointerSensor, closestCenter, useSensor, useSensors, type DragEndEvent } from "@dnd-kit/core";
import { SortableContext, arrayMove, horizontalListSortingStrategy, useSortable } from "@dnd-kit/sortable";
import { CSS } from "@dnd-kit/utilities";
import { cx } from "../../ds";

export type NivelDeChip<T> = { rotulo: string; valorDe: (l: T) => string | null };
export type ConfigDeChips<T> = { id: string; rotulo: string; semValor: string; niveis: readonly [NivelDeChip<T>, NivelDeChip<T>] };
export type SelecaoDeChips = readonly [string | null, string | null];

const chave = (v: string) => v.trim().toLowerCase();

/** Aplica a escolha das chips: nível 1 (modelo mãe) e nível 2 (versão). Comparação sem diferenciar maiúsculas. */
export function filtrarPorChips<T>(linhas: readonly T[], cfg: ConfigDeChips<T>, sel: SelecaoDeChips): readonly T[] {
  if (sel[0] === null) return linhas;
  return linhas.filter((l) => {
    if (chave(cfg.niveis[0].valorDe(l) ?? "") !== sel[0]) return false;
    return sel[1] === null || chave(cfg.niveis[1].valorDe(l) ?? "") === sel[1];
  });
}

type Chip = { chave: string; rotulo: string; n: number };
function contar<T>(linhas: readonly T[], valorDe: (l: T) => string | null): Chip[] {
  const m = new Map<string, Chip>();
  for (const l of linhas) { const v = valorDe(l); const k = chave(v ?? ""); const c = m.get(k); if (c) c.n++; else m.set(k, { chave: k, rotulo: v ?? "", n: 1 }); }
  return [...m.values()];
}
/** Chips na ordem escolhida; as novas vão para o fim em ordem alfabética. */
function ordenar(chips: Chip[], ordem: readonly string[], prefixo: string): Chip[] {
  const pos = new Map(ordem.map((k, i) => [k, i]));
  return [...chips].sort((a, b) => (pos.get(prefixo + a.chave) ?? 1e6) - (pos.get(prefixo + b.chave) ?? 1e6) || a.rotulo.localeCompare(b.rotulo, "pt-BR", { numeric: true }));
}
/** Move `de` para a posição de `para` na lista completa de chaves. */
export function mover(todas: readonly string[], de: string, para: string): string[] {
  const sem = todas.filter((k) => k !== de); const i = sem.indexOf(para);
  if (i < 0 || de === para) return [...todas];
  const origem = todas.indexOf(de), destino = todas.indexOf(para);
  sem.splice(origem < destino ? i + 1 : i, 0, de);
  return sem;
}

function ChipOrdenavel({ id, children }: { id: string; children: React.ReactNode }) {
  const { attributes, listeners, setNodeRef, transform, transition, isDragging } = useSortable({ id });
  return <span ref={setNodeRef} {...attributes} {...listeners} tabIndex={undefined} role={undefined} aria-roledescription={undefined} className="mt-rap__item" style={{ transform: CSS.Translate.toString(transform), transition, opacity: isDragging ? 0.5 : 1, zIndex: isDragging ? 5 : undefined }}>{children}</span>;
}

function Fileira({ chips, prefixo, ordem, onOrdem, ativa, onEscolher, rotulo, arquivados, onArquivar, mostrandoArquivados }: {
  chips: Chip[]; prefixo: string; ordem: readonly string[]; onOrdem: (o: string[]) => void; ativa: string | null; onEscolher: (k: string | null) => void; rotulo: string;
  arquivados: readonly string[]; onArquivar: (chave: string, arquivar: boolean) => void; mostrandoArquivados: boolean;
}) {
  const sensores = useSensors(useSensor(PointerSensor, { activationConstraint: { distance: 6 } }));   // clicar escolhe a chip; arrastar muda a ordem
  const lista = useMemo(() => ordenar(chips, ordem, prefixo), [chips, ordem, prefixo]);
  const visiveis = lista.filter((c) => mostrandoArquivados || !arquivados.includes(prefixo + c.chave) || ativa === c.chave);
  const chaves = visiveis.map((c) => prefixo + c.chave);
  const aoSoltar = (e: DragEndEvent) => {
    if (!e.over || e.active.id === e.over.id) return;
    const de = chaves.indexOf(String(e.active.id)), para = chaves.indexOf(String(e.over.id));
    if (de < 0 || para < 0) return;
    const nova = arrayMove(chaves, de, para);
    onOrdem([...ordem.filter((k) => !chaves.includes(k)), ...nova]);   // as outras fileiras mantêm a ordem delas
  };
  return (
    <DndContext sensors={sensores} collisionDetection={closestCenter} onDragEnd={aoSoltar}>
      <SortableContext items={chaves} strategy={horizontalListSortingStrategy}>
        <div className="mt-rap" role="group" aria-label={rotulo} data-testid={`chips-${prefixo ? "versao" : "modelo"}`}>
          {visiveis.map((c) => {
            const k = prefixo + c.chave, arq = arquivados.includes(k);
            return (
              <ChipOrdenavel key={k} id={k}>
                <span className={cx("mt-rap__chip", ativa === c.chave && "is-on", arq && "is-arquivada")} title="Arraste para mudar a ordem">
                  <button type="button" className="mt-rap__main" aria-pressed={ativa === c.chave} onClick={() => onEscolher(ativa === c.chave ? null : c.chave)}>{c.rotulo}<span className="mt-rap__n">{c.n}</span></button>
                  <button type="button" className="mt-rap__arq" aria-label={arq ? `Desarquivar ${c.rotulo}` : `Arquivar ${c.rotulo}`} title={arq ? "Desarquivar esta chip" : "Arquivar esta chip (some da lista; os carros continuam em Todas)"} data-testid={arq ? "desarquivar-chip" : "arquivar-chip"}
                    onPointerDown={(e) => e.stopPropagation()} onClick={(e) => { e.stopPropagation(); onArquivar(k, !arq); }}>{arq ? "↺" : "×"}</button>
                </span>
              </ChipOrdenavel>
            );
          })}
        </div>
      </SortableContext>
    </DndContext>
  );
}

/** Chips pré-montadas de uma visualização fixa: 1ª linha = modelos mães; escolhido um, aparece a linha das versões dele. Arrastar muda a ordem. */
export function ChipsRapidos<T>({ cfg, linhas, selecao, onSelecao, ordem, onOrdem, arquivados = [], onArquivados }: { cfg: ConfigDeChips<T>; linhas: readonly T[]; selecao: SelecaoDeChips; onSelecao: (s: SelecaoDeChips) => void; ordem: readonly string[]; onOrdem: (o: string[]) => void; /** chips guardadas (somem da lista, como "Bolt" e "Ômega") */ arquivados?: readonly string[]; onArquivados?: (a: string[]) => void }) {
  const [verArquivadas, setVerArquivadas] = useState(false);
  const arquivar = (k: string, arq: boolean) => onArquivados?.(arq ? [...new Set([...arquivados, k])] : arquivados.filter((x) => x !== k));
  const maes = useMemo(() => contar(linhas, (l) => cfg.niveis[0].valorDe(l)).map((c) => (c.chave === "" ? { ...c, rotulo: cfg.semValor } : c)), [linhas, cfg]);
  const doModelo = useMemo(() => (selecao[0] === null ? [] : linhas.filter((l) => chave(cfg.niveis[0].valorDe(l) ?? "") === selecao[0])), [linhas, cfg, selecao]);
  const versoes = useMemo(() => contar(doModelo, (l) => cfg.niveis[1].valorDe(l)).filter((c) => c.chave !== "" || doModelo.some((l) => chave(cfg.niveis[1].valorDe(l) ?? "") !== "")).map((c) => (c.chave === "" ? { ...c, rotulo: "Sem versão" } : c)), [doModelo, cfg]);
  if (linhas.length === 0) return null;
  return (
    <div className="mt-rap-wrap" data-testid="chips-rapidos">
      <Fileira chips={maes} prefixo="" ordem={ordem} onOrdem={onOrdem} ativa={selecao[0]} onEscolher={(k) => onSelecao([k, null])} rotulo={cfg.niveis[0].rotulo} arquivados={arquivados} onArquivar={arquivar} mostrandoArquivados={verArquivadas} />
      {selecao[0] !== null && versoes.length > 0 && <Fileira chips={versoes} prefixo={`${selecao[0]}/`} ordem={ordem} onOrdem={onOrdem} ativa={selecao[1]} onEscolher={(k) => onSelecao([selecao[0], k])} rotulo={cfg.niveis[1].rotulo} arquivados={arquivados} onArquivar={arquivar} mostrandoArquivados={verArquivadas} />}
      {onArquivados && arquivados.length > 0 && <button type="button" className="mt-rap__ver" aria-pressed={verArquivadas} onClick={() => setVerArquivadas((v) => !v)} data-testid="ver-arquivadas">{verArquivadas ? "Esconder arquivadas" : `Arquivadas (${arquivados.length})`}</button>}
    </div>
  );
}
