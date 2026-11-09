import { useMemo, useState } from "react";
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

function Fileira({ chips, prefixo, ordem, onOrdem, ativa, onEscolher, rotulo }: { chips: Chip[]; prefixo: string; ordem: readonly string[]; onOrdem: (o: string[]) => void; ativa: string | null; onEscolher: (k: string | null) => void; rotulo: string }) {
  const [arrastando, setArrastando] = useState<string | null>(null);
  const lista = useMemo(() => ordenar(chips, ordem, prefixo), [chips, ordem, prefixo]);
  const chaves = lista.map((c) => prefixo + c.chave);
  return (
    <div className="mt-rap" role="group" aria-label={rotulo} data-testid={`chips-${prefixo ? "versao" : "modelo"}`}>
      {lista.map((c) => {
        const k = prefixo + c.chave;
        return (
          <button key={k} type="button" draggable aria-pressed={ativa === c.chave} className={cx("mt-rap__chip", ativa === c.chave && "is-on", arrastando === k && "is-arrastando")} title="Arraste para mudar a ordem"
            onClick={() => onEscolher(ativa === c.chave ? null : c.chave)}
            onDragStart={(e) => { setArrastando(k); e.dataTransfer.effectAllowed = "move"; e.dataTransfer.setData("text/plain", k); }}
            onDragOver={(e) => { if (arrastando) e.preventDefault(); }}
            onDrop={(e) => { e.preventDefault(); if (arrastando && arrastando !== k) onOrdem(mover(chaves, arrastando, k)); setArrastando(null); }}
            onDragEnd={() => setArrastando(null)}>
            {c.rotulo}<span className="mt-rap__n">{c.n}</span>
          </button>
        );
      })}
    </div>
  );
}

/** Chips pré-montadas de uma visualização fixa: 1ª linha = modelos mães; escolhido um, aparece a linha das versões dele. Arrastar muda a ordem. */
export function ChipsRapidos<T>({ cfg, linhas, selecao, onSelecao, ordem, onOrdem }: { cfg: ConfigDeChips<T>; linhas: readonly T[]; selecao: SelecaoDeChips; onSelecao: (s: SelecaoDeChips) => void; ordem: readonly string[]; onOrdem: (o: string[]) => void }) {
  const maes = useMemo(() => contar(linhas, (l) => cfg.niveis[0].valorDe(l)).map((c) => (c.chave === "" ? { ...c, rotulo: cfg.semValor } : c)), [linhas, cfg]);
  const doModelo = useMemo(() => (selecao[0] === null ? [] : linhas.filter((l) => chave(cfg.niveis[0].valorDe(l) ?? "") === selecao[0])), [linhas, cfg, selecao]);
  const versoes = useMemo(() => contar(doModelo, (l) => cfg.niveis[1].valorDe(l)).filter((c) => c.chave !== "" || doModelo.some((l) => chave(cfg.niveis[1].valorDe(l) ?? "") !== "")).map((c) => (c.chave === "" ? { ...c, rotulo: "Sem versão" } : c)), [doModelo, cfg]);
  if (linhas.length === 0) return null;
  return (
    <div className="mt-rap-wrap" data-testid="chips-rapidos">
      <Fileira chips={maes} prefixo="" ordem={ordem} onOrdem={onOrdem} ativa={selecao[0]} onEscolher={(k) => onSelecao([k, null])} rotulo={cfg.niveis[0].rotulo} />
      {selecao[0] !== null && versoes.length > 0 && <Fileira chips={versoes} prefixo={`${selecao[0]}/`} ordem={ordem} onOrdem={onOrdem} ativa={selecao[1]} onEscolher={(k) => onSelecao([selecao[0], k])} rotulo={cfg.niveis[1].rotulo} />}
    </div>
  );
}
