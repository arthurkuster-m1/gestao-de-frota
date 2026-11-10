import { useEffect, useLayoutEffect, useRef, useState } from "react";
import { Check, X } from "@phosphor-icons/react";
import { DateField, cx } from "../../ds";
import { usePopover } from "../../ds/popover";
import type { TipoDeCampo } from "../../lib/motor/consulta";
import type { ValorEditavel } from "./edicao";
import { EditorDeEndereco } from "./EditorDeEndereco";
import { Tag } from "./Tag";
import type { EdicaoDoCampo, OpcaoDoCampo } from "./tipos";

export type Movimento = "proximo" | "anterior";
type Props = {
  campoId?: string; tipo: TipoDeCampo; valor: ValorEditavel; opcoes?: readonly OpcaoDoCampo[]; obrigatorio?: boolean; edicao?: EdicaoDoCampo; rotulo: string; invalido?: boolean;
  /** Confere o valor ANTES de concluir: devolve a mensagem de erro (o editor continua aberto) ou null. */
  validar?: (v: ValorEditavel) => string | null;
  onConfirmar: (v: ValorEditavel, mover?: Movimento) => void; onCancelar: () => void;
  /** Lista de opções: texto que já abre digitado no filtro (a tecla que abriu o editor). */
  filtroInicial?: string | (() => string);
};

/** O controle de edição no lugar: o MESMO para a célula da tabela, o campo do card e a barra da linha do tempo. */
export function EditorDeCelula({ campoId, tipo, valor, opcoes, obrigatorio, edicao, rotulo, invalido, validar, onConfirmar, onCancelar, filtroInicial }: Props) {
  if (edicao?.endereco) return <EditorDeEndereco sugestao={edicao.sugestaoDeEndereco} valor={typeof valor === "string" ? valor : null} rotulo={rotulo} onConfirmar={onConfirmar} onCancelar={onCancelar} />;
  if (tipo === "opcao" || tipo === "pessoa") return <EditorDeOpcao filtroInicial={filtroInicial} campoId={campoId} valor={typeof valor === "string" ? valor : null} opcoes={opcoes ?? []} obrigatorio={obrigatorio} rotulo={rotulo} onConfirmar={onConfirmar} onCancelar={onCancelar} />;
  if (tipo === "data") return <EditorDeData valor={typeof valor === "string" ? valor : null} obrigatorio={obrigatorio} rotulo={rotulo} onConfirmar={onConfirmar} onCancelar={onCancelar} />;
  return <EditorDeTexto tipo={tipo} valor={valor} edicao={edicao} rotulo={rotulo} invalido={invalido} validar={validar} onConfirmar={onConfirmar} onCancelar={onCancelar} />;
}

function EditorDeTexto({ tipo, valor, edicao, rotulo, invalido, validar, onConfirmar, onCancelar }: Pick<Props, "tipo" | "valor" | "edicao" | "rotulo" | "invalido" | "validar" | "onConfirmar" | "onCancelar">) {
  const inicial = typeof valor === "string" ? valor : "";
  const [texto, setTexto] = useState(inicial);
  const [erro, setErro] = useState<string | null>(null);
  const campo = useRef<HTMLInputElement>(null);
  const feito = useRef(false);
  useLayoutEffect(() => { campo.current?.focus(); campo.current?.select(); }, []);
  /** `daTecla`: Enter/Tab com erro mantêm o editor aberto (a pessoa corrige); sair clicando fora descarta e avisa. */
  const fim = (mover?: Movimento, daTecla = false) => {
    if (feito.current) return;
    if (texto === inicial && !mover) { feito.current = true; onCancelar(); return; }
    const e = validar?.(texto) ?? null;
    if (e) { if (daTecla) { setErro(e); return; } feito.current = true; onCancelar(); return; }
    feito.current = true; onConfirmar(texto, mover);
  };
  return (
    <input ref={campo} className={cx("mt-ed", (invalido || erro) && "is-erro")} value={texto} aria-label={`Editar ${rotulo}`} aria-invalid={invalido || !!erro || undefined} title={erro ?? undefined} data-testid="editor-celula"
      inputMode={tipo === "numero" ? "decimal" : undefined} maxLength={edicao?.maxLength} placeholder={edicao?.placeholder} spellCheck={false}
      onChange={(e) => { setTexto(e.target.value); setErro(null); }} onBlur={() => fim(undefined, false)}
      onKeyDown={(e) => {
        if (e.key === "Enter") { e.preventDefault(); fim(undefined, true); }
        else if (e.key === "Tab") { e.preventDefault(); fim(e.shiftKey ? "anterior" : "proximo", true); }
        else if (e.key === "Escape") { e.preventDefault(); feito.current = true; onCancelar(); }
      }} />
  );
}

function EditorDeData({ valor, obrigatorio, rotulo, onConfirmar, onCancelar }: Pick<Props, "obrigatorio" | "rotulo" | "onConfirmar" | "onCancelar"> & { valor: string | null }) {
  const raiz = useRef<HTMLDivElement>(null);
  const feito = useRef(false);
  const fim = (v: ValorEditavel) => { if (feito.current) return; feito.current = true; onConfirmar(v); };
  useEffect(() => {
    const campo = raiz.current?.querySelector("input"); campo?.focus(); campo?.select(); // seleciona tudo: digitar substitui a data atual
    // clicar fora (e fora do calendário, que fica na camada de cima do navegador) cancela
    const fora = (e: PointerEvent) => { const el = e.target as HTMLElement; if (raiz.current?.contains(el) || el.closest(".ds-pop, .ds-cal")) return; if (!feito.current) { feito.current = true; onCancelar(); } };
    document.addEventListener("pointerdown", fora, true);
    return () => document.removeEventListener("pointerdown", fora, true);
  }, [onCancelar]);
  return (
    <div ref={raiz} className="mt-ed-data" onKeyDown={(e) => { if (e.key === "Escape") { e.preventDefault(); feito.current = true; onCancelar(); } }}>
      <DateField value={valor ?? ""} aria-label={`Editar ${rotulo}`} onChange={(e) => fim(e.target.value || null)} />
      {!obrigatorio && valor && <button type="button" className="mt-ed-limpar" aria-label={`Limpar ${rotulo}`} onClick={() => fim(null)}><X size={16} /></button>}
    </div>
  );
}

function EditorDeOpcao({ campoId, valor, opcoes, obrigatorio, rotulo, onConfirmar, onCancelar, filtroInicial }: Pick<Props, "opcoes" | "obrigatorio" | "rotulo" | "onConfirmar" | "onCancelar" | "campoId" | "filtroInicial"> & { valor: string | null }) {
  const gatilho = useRef<HTMLButtonElement>(null);
  const { ref, aberto, setAberto } = usePopover(gatilho, { largura: 300, alturaMax: 420 });
  const abriu = useRef(false);
  const feito = useRef(false);
  useEffect(() => { setAberto(true); }, [setAberto]);
  useEffect(() => { if (aberto) abriu.current = true; else if (abriu.current && !feito.current) { feito.current = true; onCancelar(); } }, [aberto, onCancelar]);
  const escolher = (v: string | null) => { feito.current = true; setAberto(false); onConfirmar(v); };
  const atual = opcoes?.find((o) => o.value === valor);
  // digitar filtra as opções (sem acento, sem maiúsculas); setas movem a opção marcada e Enter escolhe
  const inicial = typeof filtroInicial === "function" ? filtroInicial() : (filtroInicial ?? "");
  const [q, setQ] = useState(inicial);
  const [marcada, setMarcada] = useState(inicial.trim() ? 0 : -1);
  const campoFiltro = useRef<HTMLInputElement>(null);
  const norm = (t: string) => t.normalize("NFD").replace(/[̀-ͯ]/g, "").toLowerCase().trim();
  const filtradas = (opcoes ?? []).filter((o) => !norm(q) || norm(o.label).includes(norm(q)) || norm(o.value.replace(/_/g, " ")).includes(norm(q)));
  const semValorVisivel = !obrigatorio && !norm(q);
  const total = filtradas.length + (semValorVisivel ? 1 : 0);
  const valorDoIndice = (i: number): string | null | undefined => (semValorVisivel ? (i === 0 ? null : filtradas[i - 1]?.value) : filtradas[i]?.value);
  useEffect(() => {
    if (!aberto) return;
    const t = window.setTimeout(() => {
      campoFiltro.current?.focus();
      // teclas digitadas na célula enquanto o editor abria (rápido demais para o campo): entram também
      const mais = typeof filtroInicial === "function" ? filtroInicial() : "";
      if (mais && mais.length > (campoFiltro.current?.value.length ?? 0)) { setQ(mais); setMarcada(0); }
    }, 0);
    return () => window.clearTimeout(t);
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [aberto]);
  const aoTeclar = (e: React.KeyboardEvent) => {
    if (e.key === "ArrowDown" || e.key === "ArrowUp") { e.preventDefault(); if (total) setMarcada((m) => (e.key === "ArrowDown" ? Math.min(total - 1, m + 1) : Math.max(0, m - 1))); }
    else if (e.key === "Enter") {
      e.preventDefault();
      const i = marcada >= 0 ? marcada : norm(q) ? 0 : -1;   // digitou e deu Enter: vale a primeira que sobrou
      const v = i >= 0 ? valorDoIndice(i) : undefined;
      if (v !== undefined) escolher(v);
    }
  };
  return (
    <>
      <button ref={gatilho} type="button" className="mt-ed mt-ed--opcao" aria-label={`Editar ${rotulo}`} aria-expanded={aberto} data-testid="editor-celula">{atual?.label ?? "—"}</button>
      <div ref={ref} popover="auto" role="listbox" aria-label={rotulo} className="ds-pop mt-lista" data-testid="lista-opcoes">
        <input ref={campoFiltro} className="mt-lista__filtro" value={q} placeholder="Digite para filtrar…" aria-label={`Filtrar ${rotulo}`} data-testid="filtro-opcoes" autoComplete="off"
          onChange={(e) => { setQ(e.target.value); setMarcada(e.target.value.trim() ? 0 : -1); }} onKeyDown={aoTeclar} />
        {semValorVisivel && <button type="button" role="option" aria-selected={valor === null} className={cx("mt-lista__item", marcada === 0 && "is-marcada")} onClick={() => escolher(null)}><span className="mt-lista__sem">Sem valor</span></button>}
        {filtradas.length === 0 && <p className="t-body-sm t-muted" style={{ padding: "6px 10px", margin: 0 }}>Nenhuma opção com “{q}”.</p>}
        {filtradas.map((o, k) => (
          <div key={o.value} className={cx("mt-lista__item", o.value === valor && "is-atual", marcada === k + (semValorVisivel ? 1 : 0) && "is-marcada")} role="presentation">
            <Tag opcao={o} campoId={campoId} selecionada={o.value === valor} comCheck comoOpcao onClick={() => escolher(o.value)} />
          </div>
        ))}
      </div>
    </>
  );
}
