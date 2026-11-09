import { useEffect, useState } from "react";
import { Trash } from "@phosphor-icons/react";
import { Button, DateField, Field, Input, Sheet } from "../../ds";
import { SUGESTOES_DE_ANOTACAO } from "../../lib/veiculos/anotacoes";
import type { AnotacaoDoCarro, AnotacaoNova } from "../../lib/eventos/tipos";

/** Criar ou editar uma anotação do carro (faixa livre na linha do tempo dele: Produção, Em faturamento, Emplacamento…). */
export function AnotacaoDoCarroSheet({ aberto, onFechar, carro, veiculoId, dataInicial, anotacao, onCriar, onExcluir, onEditar }: {
  aberto: boolean; onFechar: () => void; carro: string; veiculoId: string | null; dataInicial: string | null; anotacao: AnotacaoDoCarro | null;
  onCriar: (a: AnotacaoNova) => Promise<unknown>; onExcluir: (id: string) => Promise<void>; onEditar: (id: string, patch: Partial<Pick<AnotacaoDoCarro, "titulo" | "inicio" | "fim" | "comentarios">>) => Promise<void>;
}) {
  const [f, setF] = useState({ titulo: "", inicio: "", fim: "", comentarios: "" });
  const [falha, setFalha] = useState<string | null>(null);
  const [enviando, setEnviando] = useState(false);
  useEffect(() => {
    if (!aberto) return;
    setFalha(null);
    setF(anotacao ? { titulo: anotacao.titulo, inicio: anotacao.inicio, fim: anotacao.fim, comentarios: anotacao.comentarios ?? "" } : { titulo: "", inicio: dataInicial ?? "", fim: dataInicial ?? "", comentarios: "" });
  }, [aberto, anotacao, dataInicial]);
  const ok = f.titulo.trim() && f.inicio && f.fim && f.fim >= f.inicio;

  async function salvar() {
    setFalha(null); setEnviando(true);
    try {
      if (anotacao) await onEditar(anotacao.id, { titulo: f.titulo.trim(), inicio: f.inicio, fim: f.fim, comentarios: f.comentarios.trim() || null });
      else if (veiculoId) await onCriar({ veiculo_id: veiculoId, titulo: f.titulo, inicio: f.inicio, fim: f.fim, comentarios: f.comentarios });
      onFechar();
    } catch (e) { setFalha((e as Error).message); } finally { setEnviando(false); }
  }

  return (
    <Sheet open={aberto} onClose={onFechar} title={anotacao ? "Anotação do carro" : "Nova anotação do carro"}>
      <form className="ds-stack" onSubmit={(e) => { e.preventDefault(); void salvar(); }} data-testid="form-anotacao">
        <p className="t-body-sm t-muted">Carro: <b>{carro}</b>. A anotação aparece só na linha do tempo do carro (não é evento nem manutenção).</p>
        <Field label="Título" error={falha}><Input value={f.titulo} onChange={(e) => setF({ ...f, titulo: e.target.value })} placeholder="Ex.: Em faturamento" maxLength={80} autoFocus /></Field>
        {!anotacao && <div className="ds-row" style={{ flexWrap: "wrap", gap: 6 }}>{SUGESTOES_DE_ANOTACAO.map((s) => <button key={s} type="button" className="mt-rap__chip" onClick={() => setF({ ...f, titulo: s })}>{s}</button>)}</div>}
        <div className="vei-form__linha">
          <Field label="Início"><DateField value={f.inicio} onChange={(e) => setF({ ...f, inicio: e.target.value, fim: f.fim && f.fim >= e.target.value ? f.fim : e.target.value })} /></Field>
          <Field label="Fim" error={f.inicio && f.fim && f.fim < f.inicio ? "O fim não pode ser antes do início." : null}><DateField value={f.fim} onChange={(e) => setF({ ...f, fim: e.target.value })} /></Field>
        </div>
        <Field label="Observação (opcional)"><Input value={f.comentarios} onChange={(e) => setF({ ...f, comentarios: e.target.value })} /></Field>
        <Button type="submit" size="lg" block disabled={!ok} loading={enviando} data-testid="salvar-anotacao">{anotacao ? "Salvar" : "Criar anotação"}</Button>
        {anotacao && <Button type="button" variant="danger" block icon={<Trash size={18} />} onClick={() => void onExcluir(anotacao.id).then(onFechar).catch((e: Error) => setFalha(e.message))}>Excluir anotação</Button>}
      </form>
    </Sheet>
  );
}
