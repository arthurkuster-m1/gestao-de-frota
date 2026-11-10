import { useEffect, useRef, useState } from "react";
import { MapPin } from "@phosphor-icons/react";
import { Button, Field, Input, Select, Sheet, cx } from "../../ds";
import { ENDERECO_VAZIO, buscarCep, formatarEndereco, lerEndereco, lerEnderecoColado, mascaraCep, soDigitos, type EnderecoPartes } from "../../lib/enderecos";
import { UFS } from "../../lib/eventos/tipos";

/**
 * Janela do endereço: o CEP preenche rua, cidade e UF sozinhos; o resultado é UMA linha na máscara
 * "Rua, número, complemento (opcional) - Cidade/UF - CEP 00000-000".
 */
export function JanelaDeEndereco({ aberto, titulo, valor, onSalvar, onFechar, sugestao }: { aberto: boolean; titulo: string; valor: string | null; onSalvar: (texto: string | null) => void; onFechar: () => void; /** Endereço oferecido: com o campo vazio, Tab preenche tudo com ele. */ sugestao?: string }) {
  const [p, setP] = useState<EnderecoPartes>(ENDERECO_VAZIO);
  const [achando, setAchando] = useState(false);
  const [aviso, setAviso] = useState<string | null>(null);
  const numero = useRef<HTMLInputElement>(null);
  const rua = useRef<HTMLInputElement>(null);
  const colar = useRef<HTMLInputElement>(null);
  const [colado, setColado] = useState("");
  useEffect(() => {
    if (!aberto) return;
    setAviso(null); setColado("");
    if (sugestao && !valor) window.setTimeout(() => colar.current?.focus(), 60);   // com sugestão e endereço vazio, o cursor já fica no campo de colar (Tab aceita a sugestão)
    const lido = lerEndereco(valor);
    setP(lido ?? { ...ENDERECO_VAZIO, rua: (valor ?? "").trim() });   // texto antigo fora da máscara entra na rua para ser arrumado
  }, [aberto, valor]);
  const set = (x: Partial<EnderecoPartes>) => setP((s) => ({ ...s, ...x }));
  const linha = formatarEndereco(p);

  /** Procura o CEP e completa só o que falta (o que a pessoa digitou ou colou não é sobrescrito). */
  async function completarPeloCep(cep: string, atual: EnderecoPartes) {
    setAchando(true);
    const r = await buscarCep(cep);
    setAchando(false);
    if (!r) { setAviso("Não achei esse CEP: preencha rua, cidade e UF à mão."); return; }
    const novo = { ...atual, rua: atual.rua || r.rua, cidade: atual.cidade || r.cidade, uf: atual.uf || r.uf };
    setP((s) => ({ ...s, rua: s.rua || r.rua, cidade: s.cidade || r.cidade, uf: s.uf || r.uf }));
    if (!novo.rua) { setAviso("Esse CEP é da cidade inteira (não tem rua própria): digite a rua e o número."); window.setTimeout(() => rua.current?.focus(), 0); }
    else window.setTimeout(() => (novo.numero ? undefined : numero.current?.focus()), 0);
  }
  async function aoDigitarCep(t: string) {
    const cep = mascaraCep(t); set({ cep }); setAviso(null);
    if (soDigitos(cep).length === 8) await completarPeloCep(cep, { ...p, cep, rua: "", cidade: "", uf: "" });
  }
  /** Endereço colado de uma vez ("Av. Goiás, 1805 - Santa Paula, São Caetano do Sul - SP, 09521-300"): separa CEP, rua, número, cidade e UF. */
  async function aplicarColado(texto: string) {
    const l = lerEnderecoColado(texto);
    if (!l) { setAviso("Não consegui separar esse endereço. Cole algo como: Rua, número - Bairro, Cidade - UF, CEP."); return; }
    const novo: EnderecoPartes = { rua: l.rua ?? "", numero: l.numero ?? "", complemento: l.complemento ?? "", cidade: l.cidade ?? "", uf: l.uf ?? "", cep: l.cep ?? "" };
    setP(novo); setAviso(null); setColado("");
    if (soDigitos(novo.cep).length === 8 && (!novo.rua || !novo.cidade || !novo.uf)) await completarPeloCep(novo.cep, novo);
    else if (!novo.numero) window.setTimeout(() => numero.current?.focus(), 0);
  }

  return (
    <Sheet open={aberto} onClose={onFechar} title={titulo}>
      <form className="ds-stack" onSubmit={(e) => { e.preventDefault(); e.stopPropagation(); if (linha) onSalvar(linha); }} data-testid="form-endereco">
        <Field label="Colar o endereço inteiro (opcional)"><Input ref={colar} value={colado} onChange={(e) => setColado(e.target.value)} onPaste={(e) => { const t = e.clipboardData.getData("text"); if (t.trim()) { e.preventDefault(); void aplicarColado(t); } }} onKeyDown={(e) => { if (e.key === "Enter" && colado.trim()) { e.preventDefault(); void aplicarColado(colado); } if (e.key === "Tab" && !e.shiftKey && !colado.trim() && sugestao) { e.preventDefault(); void aplicarColado(sugestao); } }} placeholder={sugestao ? `${sugestao}  (Tab preenche)` : "Av. Goiás, 1805 - Santa Paula, São Caetano do Sul - SP, 09521-300"} aria-label="Colar o endereço inteiro" data-testid="colar-endereco" /></Field>
        {colado.trim() && <div><Button type="button" variant="secondary" size="sm" onClick={() => void aplicarColado(colado)}>Separar nos campos</Button></div>}
        <Field label="CEP"><Input value={p.cep} onChange={(e) => void aoDigitarCep(e.target.value)} inputMode="numeric" placeholder="00000-000" maxLength={9} aria-label="CEP" /></Field>
        {achando && <p className="t-body-sm t-muted">Procurando o CEP…</p>}
        {aviso && <p className="t-body-sm" role="status" style={{ color: "var(--color-warning-fg)" }}>{aviso}</p>}
        <Field label="Rua"><Input ref={rua} value={p.rua} onChange={(e) => set({ rua: e.target.value })} aria-label="Rua" /></Field>
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
export function EditorDeEndereco({ valor, rotulo, onConfirmar, onCancelar, sugestao }: { valor: string | null; rotulo: string; onConfirmar: (v: string | null) => void; onCancelar: () => void; sugestao?: string }) {
  const feito = useRef(false);
  return (
    <>
      <span className="mt-valor">{valor || "—"}</span>
      <JanelaDeEndereco aberto titulo={rotulo} valor={valor} sugestao={sugestao} onFechar={() => { if (!feito.current) { feito.current = true; onCancelar(); } }} onSalvar={(t) => { feito.current = true; onConfirmar(t); }} />
    </>
  );
}

/** Campo de endereço para formulários: mostra a linha e abre a janela do endereço ao clicar. */
export function CampoDeEndereco({ valor, onChange, titulo = "Endereço", placeholder = "Clique para informar (CEP preenche cidade e UF)", sugestao }: { valor: string; onChange: (v: string) => void; titulo?: string; placeholder?: string; sugestao?: string }) {
  const [aberto, setAberto] = useState(false);
  return (
    <>
      <button type="button" className={cx("mt-campo-endereco", !valor && "is-vazio")} onClick={() => setAberto(true)} aria-label={titulo} data-testid="campo-endereco"><MapPin size={16} aria-hidden /><span>{valor || placeholder}</span></button>
      <JanelaDeEndereco aberto={aberto} titulo={titulo} valor={valor || null} sugestao={sugestao} onFechar={() => setAberto(false)} onSalvar={(t) => { onChange(t ?? ""); setAberto(false); }} />
    </>
  );
}
