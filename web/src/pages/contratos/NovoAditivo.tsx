import { useEffect, useMemo, useState } from "react";
import { Button, DateField, Field, Input, Select, Sheet, Textarea } from "../../ds";
import { rotuloTipoAditivo, TIPOS_ADITIVO, type Aditivo, type AditivoNovo, type TipoAditivo } from "../../lib/contratos/tipos";
import type { Veiculo } from "../../lib/veiculos/tipos";
import "../veiculos/veiculos.css";

/** Novo aditivo: troca de carros (quais saem e quais entram) ou extensão de prazo (nova data de fim). Só vale na vigência depois de assinado. */
export function NovoAditivo({ aberto, onFechar, contratoId, fimAtual, carrosEmVigor, veiculos, onCriar }: {
  aberto: boolean; onFechar: () => void; contratoId: string; fimAtual: string | null; carrosEmVigor: Set<string>; veiculos: Veiculo[];
  onCriar: (a: AditivoNovo, itens: { veiculo_id: string; acao: "sai" | "entra" }[]) => Promise<Aditivo>;
}) {
  const [tipo, setTipo] = useState<TipoAditivo>("troca_carros");
  const [motivo, setMotivo] = useState("");
  const [novoFim, setNovoFim] = useState("");
  const [saem, setSaem] = useState<Set<string>>(new Set());
  const [entram, setEntram] = useState<Set<string>>(new Set());
  const [busca, setBusca] = useState("");
  const [falha, setFalha] = useState<string | null>(null);
  const [enviando, setEnviando] = useState(false);
  useEffect(() => { if (aberto) { setTipo("troca_carros"); setMotivo(""); setNovoFim(""); setSaem(new Set()); setEntram(new Set()); setBusca(""); setFalha(null); } }, [aberto]);
  const porId = useMemo(() => new Map(veiculos.map((v) => [v.id, v])), [veiculos]);
  const nome = (id: string) => { const v = porId.get(id); return v ? (v.codigo ?? v.modelo.toUpperCase()) : "?"; };
  const candidatos = useMemo(() => { const q = busca.trim().toLowerCase(); return veiculos.filter((v) => !carrosEmVigor.has(v.id) && v.status_ciclo !== "devolvido" && (!q || `${v.codigo ?? ""} ${v.modelo} ${v.placa ?? ""}`.toLowerCase().includes(q))).slice(0, 60); }, [veiculos, carrosEmVigor, busca]);
  const alterna = (set: Set<string>, mudar: (s: Set<string>) => void, id: string) => { const n = new Set(set); if (n.has(id)) n.delete(id); else n.add(id); mudar(n); };
  const fimRuim = tipo === "extensao_prazo" && !!fimAtual && !!novoFim && novoFim <= fimAtual;
  const pronto = tipo === "extensao_prazo" ? !!novoFim && !fimRuim : saem.size + entram.size > 0;

  async function criar() {
    setFalha(null); setEnviando(true);
    try {
      const itens = tipo === "troca_carros" ? [...[...saem].map((id) => ({ veiculo_id: id, acao: "sai" as const })), ...[...entram].map((id) => ({ veiculo_id: id, acao: "entra" as const }))] : [];
      await onCriar({ contrato_id: contratoId, tipo, motivo: motivo.trim() || null, vigencia_fim_anterior: fimAtual, vigencia_fim_nova: tipo === "extensao_prazo" ? novoFim : null }, itens);
      onFechar();
    } catch (e) { setFalha((e as Error).message); } finally { setEnviando(false); }
  }
  return (
    <Sheet open={aberto} onClose={onFechar} title="Novo aditivo">
      <form className="ds-stack" onSubmit={(e) => { e.preventDefault(); void criar(); }} data-testid="form-aditivo">
        <Field label="Tipo de aditivo" error={falha}><Select value={tipo} onChange={(e) => setTipo(e.target.value as TipoAditivo)} aria-label="Tipo de aditivo">{TIPOS_ADITIVO.map((t) => <option key={t.value} value={t.value}>{t.label}</option>)}</Select></Field>
        {tipo === "extensao_prazo" ? (
          <Field label="Novo fim da vigência" error={fimRuim ? "A nova data precisa ser depois do fim atual." : null}><DateField value={novoFim} onChange={(e) => setNovoFim(e.target.value)} /></Field>
        ) : (
          <>
            <div className="ds-stack" data-testid="aditivo-saem"><span className="t-body" style={{ fontWeight: 600 }}>Carros que saem do contrato</span>
              {carrosEmVigor.size === 0 && <p className="t-body-sm t-muted">O contrato não tem carros em vigor.</p>}
              <ul className="mt-escolha" role="list">{[...carrosEmVigor].map((id) => <li key={id} className="mt-escolha__item"><label className="mt-escolha__linha"><input type="checkbox" checked={saem.has(id)} onChange={() => alterna(saem, setSaem, id)} aria-label={`Sai: ${nome(id)}`} /><span className="mt-escolha__nome">{nome(id)}</span></label></li>)}</ul></div>
            <div className="ds-stack" data-testid="aditivo-entram"><span className="t-body" style={{ fontWeight: 600 }}>Carros que entram</span>
              <Input value={busca} onChange={(e) => setBusca(e.target.value)} placeholder="Buscar carro (código, modelo, placa)…" aria-label="Buscar carro que entra" />
              <ul className="mt-escolha" role="list">{candidatos.map((v) => <li key={v.id} className="mt-escolha__item"><label className="mt-escolha__linha"><input type="checkbox" checked={entram.has(v.id)} onChange={() => alterna(entram, setEntram, v.id)} aria-label={`Entra: ${nome(v.id)}`} /><span className="mt-escolha__nome">{nome(v.id)}</span></label></li>)}</ul></div>
          </>
        )}
        <Field label="Motivo"><Textarea rows={3} value={motivo} onChange={(e) => setMotivo(e.target.value)} aria-label="Motivo do aditivo" /></Field>
        <Button type="submit" size="lg" block disabled={!pronto} loading={enviando} data-testid="criar-aditivo">Criar aditivo de {rotuloTipoAditivo(tipo).toLowerCase()}</Button>
      </form>
    </Sheet>
  );
}
