import { useEffect, useRef, useState } from "react";
import { MapPin } from "@phosphor-icons/react";
import { Button, Field, Input, Select, Sheet, cx } from "../../ds";
import { ENDERECO_VAZIO, buscarCep, formatarEndereco, lerEndereco, mascaraCep, soDigitos, type EnderecoPartes } from "../../lib/enderecos";
import { UFS } from "../../lib/eventos/tipos";

/**
 * Janela do endereço: o CEP preenche rua, cidade e UF sozinhos; o resultado é UMA linha na máscara
 * "Rua, número, complemento (opcional) - Cidade/UF - CEP 00000-000".
 */
export function JanelaDeEndereco({ aberto, titulo, valor, onSalvar, onFechar }: { aberto: boolean; titulo: string; valor: string | null; onSalvar: (texto: string | null) => void; onFechar: () => void }) {
  const [p, setP] = useState<EnderecoPartes>(ENDERECO_VAZIO);
  const [achando, setAchando] = useState(false);
  const [aviso, setAviso] = useState<string | null>(null);
  const numero = useRef<HTMLInputElement>(null);
  useEffect(() => {
    if (!aberto) return;
    setAviso(null);
    const lido = lerEndereco(valor);
    setP(lido ?? { ...ENDERECO_VAZIO, rua: (valor ?? "").trim() });   // texto antigo fora da máscara entra na rua para ser arrumado
  }, [aberto, valor]);
  const set = (x: Partial<EnderecoPartes>) => setP((s) => ({ ...s, ...x }));
  const linha = formatarEndereco(p);

  async function aoDigitarCep(t: string) {
    const cep = mascaraCep(t); set({ cep }); setAviso(null);
    if (soDigitos(cep).length !== 8) return;
    setAchando(true);
    const r = await buscarCep(cep);
    setAchando(false);
    if (!r) { setAviso("CEP não encontrado: preencha rua, cidade e UF."); return; }
    setP((s) => ({ ...s, rua: r.rua || s.rua, cidade: r.cidade, uf: r.uf }));
    window.setTimeout(() => numero.current?.focus(), 0);
  }

  return (
    <Sheet open={aberto} onClose={onFechar} title={titulo}>
      <form className="ds-stack" onSubmit={(e) => { e.preventDefault(); if (linha) onSalvar(linha); }} data-testid="form-endereco">
        <Field label="CEP"><Input value={p.cep} onChange={(e) => void aoDigitarCep(e.target.value)} inputMode="numeric" placeholder="00000-000" maxLength={9} autoFocus aria-label="CEP" /></Field>
        {achando && <p className="t-body-sm t-muted">Procurando o CEP…</p>}
        {aviso && <p className="t-body-sm" role="status" style={{ color: "var(--color-warning-fg)" }}>{aviso}</p>}
        <Field label="Rua"><Input value={p.rua} onChange={(e) => set({ rua: e.target.value })} aria-label="Rua" /></Field>
        <div className="vei-form__linha">
          <Field label="Número"><Input ref={numero} value={p.numero} onChange={(e) => set({ numero: e.target.value })} aria-label="Número" /></Field>
          <Field label="Complemento (opcional)"><Input value={p.complemento} onChange={(e) => set({ complemento: e.target.value })} aria-label="Complemento" /></Field>
        </div>
        <div className="vei-form__linha">
          <Field label="Cidade"><Input value={p.cidade} onChange={(e) => set({ cidade: e.target.value })} aria-label="Cidade" /></Field>
          <Field label="UF"><Select value={p.uf} onChange={(e) => set({ uf: e.target.value })} placeholder="UF"><option value="">—</option>{UFS.map((u) => <option key={u} value={u}>{u}</option>)}</Select></Field>
        </div>
        <p className="t-body-sm" data-testid="previa-endereco" style={{ color: linha ? "var(--color-text)" : "var(--color-text-subtle)" }}>{linha || "Rua, número, complemento (opcional) - Cidade/UF - CEP 00000-000"}</p>
        <Button type="submit" size="lg" block disabled={!linha} data-testid="salvar-endereco">Salvar endereço</Button>
        {valor && <Button type="button" variant="ghost" block onClick={() => onSalvar(null)}>Limpar endereço</Button>}
      </form>
    </Sheet>
  );
}

/** Editor de célula para campos de endereço: abre a janela do endereço direto. */
export function EditorDeEndereco({ valor, rotulo, onConfirmar, onCancelar }: { valor: string | null; rotulo: string; onConfirmar: (v: string | null) => void; onCancelar: () => void }) {
  const feito = useRef(false);
  return (
    <>
      <span className="mt-valor">{valor || "—"}</span>
      <JanelaDeEndereco aberto titulo={rotulo} valor={valor} onFechar={() => { if (!feito.current) { feito.current = true; onCancelar(); } }} onSalvar={(t) => { feito.current = true; onConfirmar(t); }} />
    </>
  );
}

/** Campo de endereço para formulários: mostra a linha e abre a janela do endereço ao clicar. */
export function CampoDeEndereco({ valor, onChange, titulo = "Endereço", placeholder = "Clique para informar (CEP preenche cidade e UF)" }: { valor: string; onChange: (v: string) => void; titulo?: string; placeholder?: string }) {
  const [aberto, setAberto] = useState(false);
  return (
    <>
      <button type="button" className={cx("mt-campo-endereco", !valor && "is-vazio")} onClick={() => setAberto(true)} aria-label={titulo} data-testid="campo-endereco"><MapPin size={16} aria-hidden /><span>{valor || placeholder}</span></button>
      <JanelaDeEndereco aberto={aberto} titulo={titulo} valor={valor || null} onFechar={() => setAberto(false)} onSalvar={(t) => { onChange(t ?? ""); setAberto(false); }} />
    </>
  );
}
