import { useEffect, useRef, useState } from "react";
import { ArrowRight } from "@phosphor-icons/react";
import { Button, Field, Input, Select, Sheet } from "../../ds";
import { distanciaEntre, nomeCurtoDoLugar, type Rota } from "../../lib/transportes/rota";
import { acharTransporte } from "../../lib/eventos/linhasDoEvento";
import { MODALIDADES, type Modalidade, type Sentido, type Transporte } from "../../lib/transportes/tipos";
import { diasDeViagem, paraNumero, reais } from "../../lib/transportes/regras";
import type { useTransportes } from "../transportes/useTransportes";

type Tr = ReturnType<typeof useTransportes>;
const ROTULO: Record<Sentido, string> = { ida: "Transporte de ida", volta: "Transporte de volta" };

/**
 * O transporte de ida (ou de volta) de UM carro, cadastrado ali mesmo: modalidade, nº da PTA, transportadora, valor.
 * A mesma PTA (mesma referência, sentido e modalidade) no mesmo evento é UM transporte só, dividido entre os carros;
 * salvar liga o carro a ele (e cria o transporte se ainda não existe). Tudo soma no custo do evento.
 * A origem e o destino vêm do evento e a distância (km) é calculada sozinha; os dias de viagem saem dos km.
 */
export function TransporteDoCarroSheet({ aberto, onFechar, tr, eventoId, reservaIds, carro, sentido, atual, rota }: {
  aberto: boolean; onFechar: () => void; tr: Tr; eventoId: string; /** Um carro, ou vários (aplicar o mesmo transporte em massa). */ reservaIds: string[]; carro: string; sentido: Sentido; atual: Transporte | null; /** De onde sai e para onde vai, puxado do evento. */ rota: Rota;
}) {
  const [f, setF] = useState({ modalidade: "pta" as Modalidade, referencia: "", transportadora: "", valor: "", km: "" });
  const [falha, setFalha] = useState<string | null>(null);
  const [enviando, setEnviando] = useState(false);
  useEffect(() => {
    if (!aberto) return; setFalha(null);
    setF(atual ? { modalidade: atual.modalidade, referencia: atual.referencia ?? "", transportadora: atual.transportadora ?? "", valor: atual.valor_planejado != null ? String(atual.valor_planejado).replace(".", ",") : "", km: atual.distancia_km != null ? String(atual.distancia_km) : "" }
      : { modalidade: sentido === "volta" ? "retirada" : "pta", referencia: "", transportadora: "", valor: "", km: "" });
  }, [aberto, atual, sentido]);
  const [medindo, setMedindo] = useState(false);
  const [nota, setNota] = useState<string | null>(null);
  const digitouKm = useRef(false);
  const temRota = !!rota.origem && !!rota.destino;
  async function medir() {
    if (!rota.origem || !rota.destino) return;
    setMedindo(true); setNota(null);
    const r = await distanciaEntre(rota.origem, rota.destino);
    setMedindo(false);
    if (!r) { setNota("Não consegui medir (endereço não encontrado ou sem internet). Digite o km à mão."); return; }
    setF((x) => ({ ...x, km: String(r.km) })); digitouKm.current = false;
    setNota(r.metodo === "rota" ? "Distância de estrada calculada." : "Estimada em linha reta + 25% (o serviço de rotas não respondeu).");
  }
  // ao abrir, se o transporte ainda não tem km, calcula sozinho a partir da rota do evento
  useEffect(() => { digitouKm.current = false; setNota(null); if (aberto && temRota && sentido && !atual?.distancia_km) void medir(); /* eslint-disable-next-line react-hooks/exhaustive-deps */ }, [aberto, rota.origem, rota.destino]);
  const set = (p: Partial<typeof f>) => setF((x) => ({ ...x, ...p }));
  const compartilhado = atual ? tr.vinculos.filter((v) => (sentido === "ida" ? v.transporte_ida_id : v.transporte_volta_id) === atual.id).length : 0;

  async function salvar() {
    if (reservaIds.length === 0) return;
    setFalha(null); setEnviando(true);
    try {
      const valor = f.valor.trim() ? paraNumero(f.valor) : null; const km = f.km.trim() ? paraNumero(f.km) : null;
      if (f.valor.trim() && valor === null) throw new Error("Digite um valor válido.");
      const dados = { transportadora: f.transportadora.trim() || null, valor_planejado: valor, distancia_km: km != null ? Math.round(km) : null, origem: rota.origem, destino: rota.destino };
      const mesmoDaquele = atual && atual.modalidade === f.modalidade && (atual.referencia ?? "").trim().toLowerCase() === f.referencia.trim().toLowerCase();
      const alvo = mesmoDaquele ? atual : acharTransporte(tr.transportes, eventoId, sentido, f.modalidade, f.referencia);
      if (alvo) {
        // já existe: atualiza o que mudou (vale para todos os carros dele) e liga este carro
        const campos: [string, unknown][] = [["transportadora", dados.transportadora], ["valor_planejado", dados.valor_planejado], ["distancia_km", dados.distancia_km], ["origem", dados.origem], ["destino", dados.destino]];
        for (const [coluna, valorNovo] of campos) if ((alvo as Record<string, unknown>)[coluna] !== valorNovo && (valorNovo !== null || mesmoDaquele)) await tr.editarTransporte(alvo, { edicao: { coluna } } as never, valorNovo as never);
        if (!atual || atual.id !== alvo.id || reservaIds.length > 1) await tr.ligarCarros(reservaIds, sentido, alvo.id);
      } else {
        await tr.criarT({ evento_id: eventoId, sentido, modalidade: f.modalidade, referencia: f.referencia.trim() || null, ...dados }, reservaIds);
      }
      onFechar();
    } catch (e) { setFalha((e as Error).message); } finally { setEnviando(false); }
  }
  async function tirar() {
    if (reservaIds.length === 0) return; setEnviando(true);
    try { await tr.ligarCarros(reservaIds, sentido, null); onFechar(); } catch (e) { setFalha((e as Error).message); } finally { setEnviando(false); }
  }

  return (
    <Sheet open={aberto} onClose={onFechar} title={ROTULO[sentido]}>
      <form className="ds-stack" onSubmit={(e) => { e.preventDefault(); void salvar(); }} data-testid="form-transporte-do-carro">
        <p className="t-body-sm t-muted">{reservaIds.length > 1 ? "Carros" : "Carro"}: <b>{carro}</b>. A mesma PTA no mesmo evento vira um transporte só, dividido entre os carros que usam o mesmo número.</p>
        <div className="vei-form__linha">
          <Field label="Modalidade"><Select value={f.modalidade} onChange={(e) => set({ modalidade: e.target.value as Modalidade })}>{MODALIDADES.map((m) => <option key={m.value} value={m.value}>{m.label}</option>)}</Select></Field>
          <Field label={f.modalidade === "pta" ? "Nº da PTA" : "Referência"}><Input value={f.referencia} onChange={(e) => set({ referencia: e.target.value })} placeholder="Ex.: PTAS00666314" maxLength={60} autoFocus /></Field>
        </div>
        <div className="vei-form__linha">
          <Field label="Transportadora"><Input value={f.transportadora} onChange={(e) => set({ transportadora: e.target.value })} maxLength={80} /></Field>
          <Field label="Valor planejado (R$)"><Input inputMode="decimal" value={f.valor} onChange={(e) => set({ valor: e.target.value })} placeholder="0,00" /></Field>
        </div>
        <div className="ds-stack" data-testid="rota-do-transporte">
          <span className="t-body" style={{ fontWeight: 600 }}>Rota (puxada do evento)</span>
          {temRota
            ? <p className="t-body" title={`${rota.origem} → ${rota.destino}`}>{nomeCurtoDoLugar(rota.origem)} <ArrowRight size={14} aria-label="até" style={{ verticalAlign: "-2px" }} /> {nomeCurtoDoLugar(rota.destino)}</p>
            : <p className="t-body-sm" role="note" style={{ color: "var(--color-warning-fg)" }}>Falta {!rota.origem ? "a origem" : "o endereço de chegada"} no evento. Preencha lá para o app calcular a distância; dá para digitar o km à mão.</p>}
          <div className="vei-form__linha">
            <Field label="Distância aproximada (km)"><Input inputMode="numeric" value={f.km} onChange={(e) => { digitouKm.current = true; set({ km: e.target.value }); }} placeholder={medindo ? "Calculando…" : "Calculada pela rota"} /></Field>
            <Field label="Dias de viagem"><Input readOnly value={f.modalidade === "retirada" ? "0 (retirada)" : paraNumero(f.km) ? `≈ ${diasDeViagem(paraNumero(f.km), f.modalidade)} (km ÷ 500)` : "—"} aria-label="Dias de viagem calculados" /></Field>
          </div>
          {temRota && <div><Button type="button" variant="ghost" size="sm" loading={medindo} onClick={() => void medir()}>Recalcular distância</Button></div>}
          {nota && <p className="t-body-sm t-muted" role="status">{nota}</p>}
        </div>
        {atual && compartilhado > 1 && <p className="t-body-sm" role="note" style={{ color: "var(--color-warning-fg)" }}>Este transporte é dividido por {compartilhado} carros: mudar valor ou transportadora vale para todos. Valor atual: {atual.valor_planejado != null ? reais(atual.valor_planejado) : "—"}.</p>}
        {falha && <p className="t-body-sm" role="alert" style={{ color: "var(--color-error-fg)" }}>{falha}</p>}
        <Button type="submit" size="lg" block loading={enviando} disabled={reservaIds.length === 0}>{reservaIds.length > 1 ? `Aplicar a ${reservaIds.length} carros` : "Salvar transporte"}</Button>
        {(atual || reservaIds.length > 1) && <Button type="button" variant="ghost" block onClick={() => void tirar()}>{reservaIds.length > 1 ? "Tirar estes carros do transporte" : "Tirar este carro do transporte"}</Button>}
      </form>
    </Sheet>
  );
}
