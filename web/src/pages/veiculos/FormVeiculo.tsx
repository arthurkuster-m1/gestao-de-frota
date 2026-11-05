import { useEffect, useMemo, useState, type FormEvent } from "react";
import { Link, useNavigate, useParams } from "react-router-dom";
import { ArrowLeft } from "@phosphor-icons/react";
import { Button, Card, DateField, Field, Input, Page, Segmented, Select, Skeleton, Switch, Textarea, useToast } from "../../ds";
import { atualizarVeiculo, buscarVeiculo, criarVeiculo, listarAtividades, type Atividade } from "../../lib/veiculos/dados";
import { CICLO, SEGURO, normalizarPlaca, normalizarVin, placaValida, vazioParaNulo, vinValido, type Ciclo, type Seguro, type VeiculoNovo } from "../../lib/veiculos/tipos";
import "./veiculos.css";

type Estado = {
  modelo: string; cor: string; my: string; pedido: string; vin: string; placa: string; blindado: boolean;
  seguro: Seguro; ciclo: Ciclo; d_pedido: string; d_lib: string; d_fat: string; d_empl: string; d_dev: string; comentarios: string;
};
const VAZIO: Estado = { modelo: "", cor: "", my: "", pedido: "", vin: "", placa: "", blindado: false, seguro: "pendente", ciclo: "pedido_recebido", d_pedido: "", d_lib: "", d_fat: "", d_empl: "", d_dev: "", comentarios: "" };

/** "ONIX RS 3456": a mesma conta do banco (modelo + 4 últimos do VIN; a versão vai escrita no modelo), só para mostrar enquanto digita. */
export const codigoPrevisto = (modelo: string, vin: string) => {
  const v = normalizarVin(vin);
  return v.length >= 4 && modelo.trim() ? `${modelo.trim().toUpperCase()} ${v.slice(-4)}` : "";
};

const textoAtividade = (t: string) => CICLO.reduce((s, c) => s.split(c.value).join(c.label), t);
const quando = (iso: string) => new Intl.DateTimeFormat("pt-BR", { day: "2-digit", month: "2-digit", year: "numeric", hour: "2-digit", minute: "2-digit", timeZone: "America/Sao_Paulo" }).format(new Date(iso));

export function FormVeiculo() {
  const { id } = useParams();
  const editando = !!id;
  const navigate = useNavigate();
  const toast = useToast();
  const [f, setF] = useState<Estado>(VAZIO);
  const [carregando, setCarregando] = useState(editando);
  const [erro, setErro] = useState<string | null>(null);
  const [enviando, setEnviando] = useState(false);
  const [hist, setHist] = useState<Atividade[]>([]);
  const [tocado, setTocado] = useState(false);
  const set = <K extends keyof Estado>(k: K, v: Estado[K]) => { setF((s) => ({ ...s, [k]: v })); setErro(null); };

  useEffect(() => {
    if (!id) return;
    buscarVeiculo(id).then((v) => {
      if (!v) { setErro("Veículo não encontrado."); return; }
      setF({ modelo: v.modelo, cor: v.cor ?? "", my: v.my ?? "", pedido: v.pedido ?? "", vin: v.vin ?? "", placa: v.placa ?? "", blindado: v.blindado, seguro: v.seguro_status, ciclo: v.status_ciclo,
        d_pedido: v.data_pedido ?? "", d_lib: v.data_liberacao ?? "", d_fat: v.data_faturamento ?? "", d_empl: v.data_emplacamento ?? "", d_dev: v.data_devolucao ?? "", comentarios: v.comentarios ?? "" });
      void listarAtividades(id).then(setHist, () => setHist([]));
    }, (e: Error) => setErro(e.message)).finally(() => setCarregando(false));
  }, [id]);

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

  async function salvar(e: FormEvent, outro = false) {
    e.preventDefault();
    setTocado(true);
    if (invalido) return;
    setEnviando(true);
    try {
      if (id) { await atualizarVeiculo(id, corpo()); toast("Veículo salvo"); navigate("/veiculos"); }
      else {
        const v = await criarVeiculo(corpo());
        toast(`Cadastrado: ${v.codigo ?? v.modelo}`);
        if (outro) { setF({ ...VAZIO, modelo: f.modelo, cor: f.cor, my: f.my }); setTocado(false); window.scrollTo({ top: 0 }); }
        else navigate("/veiculos");
      }
    } catch (x) { setErro((x as Error).message); } finally { setEnviando(false); }
  }

  if (carregando) return <Page><Card><Skeleton h={28} /><div style={{ height: 12 }} /><Skeleton h={28} /></Card></Page>;

  return (
    <Page>
      <form className="vei-form" onSubmit={(e) => void salvar(e)} noValidate>
        <div className="ds-row" style={{ justifyContent: "space-between" }}>
          <Link to="/veiculos" className="ds-row" style={{ textDecoration: "none" }}><ArrowLeft size={20} />Veículos</Link>
          <span className="vei-codigo" data-testid="codigo-previsto">{codigo || "Código: aparece com o VIN"}</span>
        </div>
        <h1 className="t-h1">{editando ? "Editar veículo" : "Novo veículo"}</h1>

        <Card>
          <div className="vei-form">
            <div className="vei-form__linha">
              <Field label="Modelo" error={tocado ? erros.modelo : null}><Input value={f.modelo} onChange={(e) => set("modelo", e.target.value)} placeholder="Onix RS" autoCapitalize="characters" /></Field>
              <Field label="Cor"><Input value={f.cor} onChange={(e) => set("cor", e.target.value)} /></Field>
            </div>
            <div className="vei-form__linha">
              <Field label="MY (ano-modelo)"><Input value={f.my} onChange={(e) => set("my", e.target.value)} placeholder="2026" inputMode="numeric" /></Field>
              <Field label="Pedido"><Input value={f.pedido} onChange={(e) => set("pedido", e.target.value)} placeholder="Nº do pedido na fábrica" /></Field>
            </div>
            <div className="vei-form__linha">
              <Field label="VIN (chassi)" error={tocado || vin.length > 17 ? erros.vin : null}><Input value={f.vin} onChange={(e) => set("vin", e.target.value.toUpperCase())} placeholder="17 caracteres" autoCapitalize="characters" spellCheck={false} maxLength={20} /></Field>
              <Field label="Placa" error={tocado ? erros.placa : null}><Input value={f.placa} onChange={(e) => set("placa", e.target.value.toUpperCase())} placeholder="ABC1D23" autoCapitalize="characters" spellCheck={false} maxLength={8} /></Field>
            </div>
            <div className="ds-row" style={{ justifyContent: "space-between" }}><span className="t-body" style={{ fontWeight: 600 }}>Blindado</span><Switch checked={f.blindado} onChange={(v) => set("blindado", v)} label="Blindado" /></div>
          </div>
        </Card>

        <Card>
          <div className="vei-form">
            <Field label="Ciclo de vida"><Select value={f.ciclo} onChange={(e) => set("ciclo", e.target.value as Ciclo)}>{CICLO.map((c) => <option key={c.value} value={c.value}>{c.label}</option>)}</Select></Field>
            <Field label="Seguro"><Segmented block options={SEGURO.map((s) => ({ value: s.value, label: s.label }))} value={f.seguro} onChange={(v) => set("seguro", v)} /></Field>
            <div className="vei-form__linha">
              <Field label="Pedido recebido em"><DateField value={f.d_pedido} onChange={(e) => set("d_pedido", e.target.value)} /></Field>
              <Field label="Liberado em"><DateField value={f.d_lib} onChange={(e) => set("d_lib", e.target.value)} /></Field>
              <Field label="Faturado em"><DateField value={f.d_fat} onChange={(e) => set("d_fat", e.target.value)} /></Field>
              <Field label="Emplacado em"><DateField value={f.d_empl} onChange={(e) => set("d_empl", e.target.value)} /></Field>
              <Field label="Devolvido em"><DateField value={f.d_dev} onChange={(e) => set("d_dev", e.target.value)} /></Field>
            </div>
          </div>
        </Card>

        <Card><Field label="Comentários"><Textarea rows={4} value={f.comentarios} onChange={(e) => set("comentarios", e.target.value)} /></Field></Card>

        {erro && <p className="t-body" role="alert" style={{ color: "var(--color-error-fg)" }}>{erro}</p>}
        <div className="ds-row" style={{ flexWrap: "wrap" }}>
          <Button type="submit" size="lg" loading={enviando}>{editando ? "Salvar" : "Cadastrar"}</Button>
          {!editando && <Button type="button" size="lg" variant="secondary" loading={enviando} onClick={(e) => void salvar(e as unknown as FormEvent, true)}>Cadastrar e adicionar outro</Button>}
        </div>

        {editando && (
          <Card>
            <h2 className="t-h3" style={{ marginBottom: 12 }}>Atividade</h2>
            {hist.length === 0 ? <p className="t-body t-muted">Sem atividade registrada.</p> : (
              <ul className="vei-hist" data-testid="historico">{hist.map((a) => <li key={a.id}><span className="t-body">{textoAtividade(a.descricao)}</span><span className="t-body-sm t-muted">{quando(a.ocorreu_em)}</span></li>)}</ul>
            )}
          </Card>
        )}
      </form>
    </Page>
  );
}
