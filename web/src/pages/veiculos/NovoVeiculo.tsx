import { useMemo, useState } from "react";
import { Button, DateField, Field, Input, Segmented, Select, Sheet, Switch, Textarea, useToast } from "../../ds";
import { criarVeiculo } from "../../lib/veiculos/dados";
import { CICLO, SEGURO, normalizarPlaca, normalizarVin, placaValida, vazioParaNulo, vinValido, type Ciclo, type Seguro, type Veiculo, type VeiculoNovo } from "../../lib/veiculos/tipos";
import "./veiculos.css";

type Estado = {
  modelo: string; cor: string; my: string; pedido: string; vin: string; placa: string; blindado: boolean;
  seguro: Seguro; ciclo: Ciclo; d_pedido: string; d_lib: string; d_fat: string; d_empl: string; d_dev: string; comentarios: string;
};
const VAZIO: Estado = { modelo: "", cor: "", my: "", pedido: "", vin: "", placa: "", blindado: false, seguro: "pendente", ciclo: "pedido_recebido", d_pedido: "", d_lib: "", d_fat: "", d_empl: "", d_dev: "", comentarios: "" };

/** "ONIX RS 3456": a mesma conta do banco (modelo + 4 últimos do VIN), só para mostrar enquanto digita. */
export const codigoPrevisto = (modelo: string, vin: string) => {
  const v = normalizarVin(vin);
  return v.length >= 4 && modelo.trim() ? `${modelo.trim().toUpperCase()} ${v.slice(-4)}` : "";
};

/** Cadastro de veículo em janela larga (como o de eventos). Ctrl + Enter cadastra. Só a importação em massa abre página inteira. */
export function NovoVeiculo({ aberto, onFechar, onCriado }: { aberto: boolean; onFechar: () => void; onCriado: (v: Veiculo) => void }) {
  const toast = useToast();
  const [f, setF] = useState<Estado>(VAZIO);
  const [erro, setErro] = useState<string | null>(null);
  const [enviando, setEnviando] = useState(false);
  const [tocado, setTocado] = useState(false);
  const set = <K extends keyof Estado>(k: K, v: Estado[K]) => { setF((s) => ({ ...s, [k]: v })); setErro(null); };

  const vin = normalizarVin(f.vin), placa = normalizarPlaca(f.placa);
  const erros = useMemo(() => ({
    modelo: f.modelo.trim() ? null : "Informe o modelo.",
    vin: !vin || vinValido(vin) ? null : `O VIN tem 17 letras e números (digitou ${vin.length}).`,
    placa: !placa || placaValida(placa) ? null : `A placa tem 7 caracteres (digitou ${placa.length}).`,
  }), [f.modelo, vin, placa]);
  const invalido = Object.values(erros).some(Boolean);
  const codigo = codigoPrevisto(f.modelo, f.vin);

  const corpo = (): VeiculoNovo => ({
    modelo: f.modelo.trim(), cor: vazioParaNulo(f.cor), my: vazioParaNulo(f.my), pedido: vazioParaNulo(f.pedido),
    vin: vin || null, placa: placa || null, blindado: f.blindado, seguro_status: f.seguro, status_ciclo: f.ciclo,
    data_pedido: f.d_pedido || null, data_liberacao: f.d_lib || null, data_faturamento: f.d_fat || null, data_emplacamento: f.d_empl || null, data_devolucao: f.d_dev || null,
    comentarios: vazioParaNulo(f.comentarios),
  });

  async function salvar(outro = false) {
    setTocado(true);
    if (invalido || enviando) return;
    setEnviando(true);
    try {
      const v = await criarVeiculo(corpo());
      toast(`Cadastrado: ${v.codigo ?? v.modelo}`);
      onCriado(v);
      if (outro) { setF({ ...VAZIO, modelo: f.modelo, cor: f.cor, my: f.my }); setTocado(false); } else { setF(VAZIO); setTocado(false); onFechar(); }
    } catch (x) { setErro((x as Error).message); } finally { setEnviando(false); }
  }

  return (
    <Sheet open={aberto} onClose={onFechar} title="Novo veículo" wide>
      <form className="ds-stack" onSubmit={(e) => { e.preventDefault(); void salvar(); }} onKeyDown={(e) => { if ((e.ctrlKey || e.metaKey) && e.key === "Enter") { e.preventDefault(); void salvar(); } }} noValidate data-testid="form-novo-veiculo">
        <div className="mt-evf mt-evf--3">
          <Field label="Modelo" error={tocado ? erros.modelo : null}><Input value={f.modelo} onChange={(e) => set("modelo", e.target.value)} placeholder="Onix RS" autoCapitalize="characters" autoFocus /></Field>
          <Field label="Cor"><Input value={f.cor} onChange={(e) => set("cor", e.target.value)} /></Field>
          <Field label="MY (ano-modelo)"><Input value={f.my} onChange={(e) => set("my", e.target.value)} placeholder="2026" inputMode="numeric" /></Field>
        </div>
        <div className="mt-evf mt-evf--3">
          <Field label="VIN (chassi)" error={tocado || vin.length > 17 ? erros.vin : null}><Input value={f.vin} onChange={(e) => set("vin", e.target.value.toUpperCase())} placeholder="17 caracteres" autoCapitalize="characters" spellCheck={false} maxLength={20} /></Field>
          <Field label="Placa" error={tocado ? erros.placa : null}><Input value={f.placa} onChange={(e) => set("placa", e.target.value.toUpperCase())} placeholder="ABC1D23" autoCapitalize="characters" spellCheck={false} maxLength={8} /></Field>
          <Field label="Pedido"><Input value={f.pedido} onChange={(e) => set("pedido", e.target.value)} placeholder="Nº do pedido na fábrica" /></Field>
        </div>
        <div className="mt-evf mt-evf--3">
          <Field label="Ciclo de vida"><Select value={f.ciclo} onChange={(e) => set("ciclo", e.target.value as Ciclo)}>{CICLO.map((c) => <option key={c.value} value={c.value}>{c.label}</option>)}</Select></Field>
          <Field label="Seguro"><Segmented block options={SEGURO.map((s) => ({ value: s.value, label: s.label }))} value={f.seguro} onChange={(v) => set("seguro", v)} /></Field>
          <Field label="Blindado"><Switch checked={f.blindado} onChange={(v) => set("blindado", v)} label={f.blindado ? "Sim" : "Não"} /></Field>
        </div>
        <div className="mt-evf mt-evf--5">
          <Field label="Pedido recebido em"><DateField value={f.d_pedido} onChange={(e) => set("d_pedido", e.target.value)} /></Field>
          <Field label="Liberado em"><DateField value={f.d_lib} onChange={(e) => set("d_lib", e.target.value)} /></Field>
          <Field label="Faturado em"><DateField value={f.d_fat} onChange={(e) => set("d_fat", e.target.value)} /></Field>
          <Field label="Emplacado em"><DateField value={f.d_empl} onChange={(e) => set("d_empl", e.target.value)} /></Field>
          <Field label="Devolvido em"><DateField value={f.d_dev} onChange={(e) => set("d_dev", e.target.value)} /></Field>
        </div>
        <Field label="Comentários"><Textarea rows={3} value={f.comentarios} onChange={(e) => set("comentarios", e.target.value)} /></Field>
        {erro && <p className="t-body" role="alert" style={{ color: "var(--color-error-fg)" }}>{erro}</p>}
        <div className="mt-evf__rodape">
          <span className="t-body-sm t-muted" data-testid="codigo-previsto">{codigo ? `Código: ${codigo}` : "Código: aparece com o VIN"} · <kbd>Ctrl</kbd> + <kbd>Enter</kbd> cadastra</span>
          <div className="ds-row" style={{ flexWrap: "wrap" }}>
            <Button type="button" size="lg" variant="secondary" loading={enviando} onClick={() => void salvar(true)}>Cadastrar e adicionar outro</Button>
            <Button type="submit" size="lg" loading={enviando}>Cadastrar</Button>
          </div>
        </div>
      </form>
    </Sheet>
  );
}
