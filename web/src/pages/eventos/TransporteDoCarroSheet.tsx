import { useEffect, useState } from "react";
import { Button, Field, Input, Select, Sheet } from "../../ds";
import { acharTransporte } from "../../lib/eventos/linhasDoEvento";
import { MODALIDADES, type Modalidade, type Sentido, type Transporte } from "../../lib/transportes/tipos";
import { paraNumero, reais } from "../../lib/transportes/regras";
import type { useTransportes } from "../transportes/useTransportes";

type Tr = ReturnType<typeof useTransportes>;
const ROTULO: Record<Sentido, string> = { ida: "Transporte de ida", volta: "Transporte de volta" };

/**
 * O transporte de ida (ou de volta) de UM carro, cadastrado ali mesmo: modalidade, nº da PTA, transportadora, valor.
 * A mesma PTA (mesma referência, sentido e modalidade) no mesmo evento é UM transporte só, dividido entre os carros;
 * salvar liga o carro a ele (e cria o transporte se ainda não existe). Tudo soma no custo do evento.
 */
export function TransporteDoCarroSheet({ aberto, onFechar, tr, eventoId, reservaId, carro, sentido, atual }: {
  aberto: boolean; onFechar: () => void; tr: Tr; eventoId: string; reservaId: string | null; carro: string; sentido: Sentido; atual: Transporte | null;
}) {
  const [f, setF] = useState({ modalidade: "pta" as Modalidade, referencia: "", transportadora: "", valor: "", km: "" });
  const [falha, setFalha] = useState<string | null>(null);
  const [enviando, setEnviando] = useState(false);
  useEffect(() => {
    if (!aberto) return; setFalha(null);
    setF(atual ? { modalidade: atual.modalidade, referencia: atual.referencia ?? "", transportadora: atual.transportadora ?? "", valor: atual.valor_planejado != null ? String(atual.valor_planejado).replace(".", ",") : "", km: atual.distancia_km != null ? String(atual.distancia_km) : "" }
      : { modalidade: sentido === "volta" ? "retirada" : "pta", referencia: "", transportadora: "", valor: "", km: "" });
  }, [aberto, atual, sentido]);
  const set = (p: Partial<typeof f>) => setF((x) => ({ ...x, ...p }));
  const compartilhado = atual ? tr.vinculos.filter((v) => (sentido === "ida" ? v.transporte_ida_id : v.transporte_volta_id) === atual.id).length : 0;

  async function salvar() {
    if (!reservaId) return;
    setFalha(null); setEnviando(true);
    try {
      const valor = f.valor.trim() ? paraNumero(f.valor) : null; const km = f.km.trim() ? paraNumero(f.km) : null;
      if (f.valor.trim() && valor === null) throw new Error("Digite um valor válido.");
      const dados = { transportadora: f.transportadora.trim() || null, valor_planejado: valor, distancia_km: km != null ? Math.round(km) : null };
      const mesmoDaquele = atual && atual.modalidade === f.modalidade && (atual.referencia ?? "").trim().toLowerCase() === f.referencia.trim().toLowerCase();
      const alvo = mesmoDaquele ? atual : acharTransporte(tr.transportes, eventoId, sentido, f.modalidade, f.referencia);
      if (alvo) {
        // já existe: atualiza o que mudou (vale para todos os carros dele) e liga este carro
        const campos: [string, unknown][] = [["transportadora", dados.transportadora], ["valor_planejado", dados.valor_planejado], ["distancia_km", dados.distancia_km]];
        for (const [coluna, valorNovo] of campos) if ((alvo as Record<string, unknown>)[coluna] !== valorNovo && (valorNovo !== null || mesmoDaquele)) await tr.editarTransporte(alvo, { edicao: { coluna } } as never, valorNovo as never);
        if (!atual || atual.id !== alvo.id) await tr.ligarCarros([reservaId], sentido, alvo.id);
      } else {
        await tr.criarT({ evento_id: eventoId, sentido, modalidade: f.modalidade, referencia: f.referencia.trim() || null, ...dados }, [reservaId]);
      }
      onFechar();
    } catch (e) { setFalha((e as Error).message); } finally { setEnviando(false); }
  }
  async function tirar() {
    if (!reservaId) return; setEnviando(true);
    try { await tr.ligarCarros([reservaId], sentido, null); onFechar(); } catch (e) { setFalha((e as Error).message); } finally { setEnviando(false); }
  }

  return (
    <Sheet open={aberto} onClose={onFechar} title={ROTULO[sentido]}>
      <form className="ds-stack" onSubmit={(e) => { e.preventDefault(); void salvar(); }} data-testid="form-transporte-do-carro">
        <p className="t-body-sm t-muted">Carro: <b>{carro}</b>. A mesma PTA no mesmo evento vira um transporte só, dividido entre os carros que usam o mesmo número.</p>
        <div className="vei-form__linha">
          <Field label="Modalidade"><Select value={f.modalidade} onChange={(e) => set({ modalidade: e.target.value as Modalidade })}>{MODALIDADES.map((m) => <option key={m.value} value={m.value}>{m.label}</option>)}</Select></Field>
          <Field label={f.modalidade === "pta" ? "Nº da PTA" : "Referência"}><Input value={f.referencia} onChange={(e) => set({ referencia: e.target.value })} placeholder="Ex.: PTAS00666314" maxLength={60} autoFocus /></Field>
        </div>
        <div className="vei-form__linha">
          <Field label="Transportadora"><Input value={f.transportadora} onChange={(e) => set({ transportadora: e.target.value })} maxLength={80} /></Field>
          <Field label="Valor planejado (R$)"><Input inputMode="decimal" value={f.valor} onChange={(e) => set({ valor: e.target.value })} placeholder="0,00" /></Field>
        </div>
        <Field label="Distância (km)"><Input inputMode="numeric" value={f.km} onChange={(e) => set({ km: e.target.value })} placeholder="Opcional: os dias de viagem saem dos km" /></Field>
        {atual && compartilhado > 1 && <p className="t-body-sm" role="note" style={{ color: "var(--color-warning-fg)" }}>Este transporte é dividido por {compartilhado} carros: mudar valor ou transportadora vale para todos. Valor atual: {atual.valor_planejado != null ? reais(atual.valor_planejado) : "—"}.</p>}
        {falha && <p className="t-body-sm" role="alert" style={{ color: "var(--color-error-fg)" }}>{falha}</p>}
        <Button type="submit" size="lg" block loading={enviando} disabled={!reservaId}>Salvar transporte</Button>
        {atual && <Button type="button" variant="ghost" block onClick={() => void tirar()}>Tirar este carro do transporte</Button>}
      </form>
    </Sheet>
  );
}
