import { useEffect, useMemo, useState } from "react";
import { Button, Combobox, DateField, Field, Input, Select, Sheet, Switch, Textarea, ValorInput } from "../../ds";
import { hojeLocal } from "../../lib/motor/datas";
import { STATUS_MANUTENCAO, TIPOS_MANUTENCAO, type Manutencao, type ManutencaoNova, type StatusManutencao } from "../../lib/manutencoes/tipos";
import type { Veiculo } from "../../lib/veiculos/tipos";
import "../veiculos/veiculos.css";

type Estado = { veiculo: string; nome: string; tipo: string; status: StatusManutencao; inicio: string; ocorrencia: string; da: string; bloqueia: boolean; valor: number; descricao: string };
const vazio = (veiculo: string, inicio?: string | null): Estado => ({ veiculo, nome: "", tipo: "", status: "solicitar_da", inicio: inicio || hojeLocal(), ocorrencia: "", da: "", bloqueia: true, valor: 0, descricao: "" });

/** Nova manutenção (ou sinistro): escolhe o carro, dá o nome e as datas. "Bloqueia o uso" diz se o carro pode ir a evento enquanto está na oficina. */
export function NovaManutencao({ aberto, onFechar, veiculos, veiculoInicial, dataInicial, onCriar, onCriada }: {
  aberto: boolean; onFechar: () => void; veiculos: Veiculo[]; veiculoInicial?: string | null; dataInicial?: string | null;
  onCriar: (m: ManutencaoNova) => Promise<Manutencao>; onCriada?: (m: Manutencao) => void;
}) {
  const [f, setF] = useState<Estado>(vazio(veiculoInicial ?? ""));
  const [falha, setFalha] = useState<string | null>(null);
  const [enviando, setEnviando] = useState(false);
  useEffect(() => { if (aberto) { setF(vazio(veiculoInicial ?? "", dataInicial)); setFalha(null); } }, [aberto, veiculoInicial, dataInicial]);
  const opcoes = useMemo(() => [...veiculos].sort((a, b) => (a.codigo ?? a.modelo).localeCompare(b.codigo ?? b.modelo, "pt-BR", { numeric: true }))
    .map((v) => ({ value: v.id, label: v.codigo ?? v.modelo.toUpperCase(), sub: [v.cor, v.placa].filter(Boolean).join(" · ") })), [veiculos]);
  const set = <K extends keyof Estado>(k: K, v: Estado[K]) => setF((x) => ({ ...x, [k]: v }));

  async function criar() {
    setFalha(null); setEnviando(true);
    try {
      const m = await onCriar({ veiculo_id: f.veiculo, nome: f.nome, tipo: f.tipo || null, status: f.status, data_inicio: f.inicio || hojeLocal(),
        data_ocorrencia: f.ocorrencia || null, data_da_solicitada: f.da || null, bloqueia_uso: f.bloqueia, valor: f.valor / 100, descricao: f.descricao.trim() || null });
      onFechar(); onCriada?.(m);
    } catch (e) { setFalha((e as Error).message); } finally { setEnviando(false); }
  }

  return (
    <Sheet open={aberto} onClose={onFechar} title="Nova manutenção">
      <form className="ds-stack" onSubmit={(e) => { e.preventDefault(); void criar(); }} data-testid="form-manutencao">
        <Field label="Veículo"><Combobox value={f.veiculo} onChange={(e) => set("veiculo", e.target.value)} opcoes={opcoes} placeholder="Buscar carro…" aria-label="Veículo da manutenção" /></Field>
        <Field label="Nome da manutenção" error={falha}><Input value={f.nome} onChange={(e) => set("nome", e.target.value)} placeholder="Ex.: Batida na traseira" maxLength={120} /></Field>
        <div className="vei-form__linha">
          <Field label="Tipo"><Select value={f.tipo} onChange={(e) => set("tipo", e.target.value)} placeholder="Escolher…"><option value="">Sem tipo</option>{TIPOS_MANUTENCAO.map((t) => <option key={t} value={t}>{t}</option>)}</Select></Field>
          <Field label="Status"><Select value={f.status} onChange={(e) => set("status", e.target.value as StatusManutencao)}>{STATUS_MANUTENCAO.map((s) => <option key={s.value} value={s.value}>{s.label}</option>)}</Select></Field>
        </div>
        <div className="vei-form__linha">
          <Field label="Entrou na oficina em"><DateField value={f.inicio} onChange={(e) => set("inicio", e.target.value)} /></Field>
          <Field label="Data do acidente"><DateField value={f.ocorrencia} onChange={(e) => set("ocorrencia", e.target.value)} /></Field>
        </div>
        <div className="vei-form__linha">
          <Field label="DA solicitada em"><DateField value={f.da} onChange={(e) => set("da", e.target.value)} /></Field>
          <Field label="Valor (R$)"><ValorInput value={f.valor} onChange={(c) => set("valor", c)} aria-label="Valor da manutenção em reais" data-testid="valor-manutencao" /></Field>
        </div>
        <div className="ds-row" style={{ justifyContent: "space-between" }}><span className="t-body" style={{ fontWeight: 600 }}>Bloqueia o uso do carro</span><Switch checked={f.bloqueia} onChange={(v) => set("bloqueia", v)} label="Bloqueia o uso do carro" /></div>
        <Field label="Descrição do acidente"><Textarea rows={4} value={f.descricao} onChange={(e) => set("descricao", e.target.value)} /></Field>
        <Button type="submit" size="lg" block disabled={!f.nome.trim() || !f.veiculo} loading={enviando} data-testid="criar-manutencao">Criar manutenção</Button>
      </form>
    </Sheet>
  );
}
