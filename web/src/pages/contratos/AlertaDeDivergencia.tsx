import { Warning } from "@phosphor-icons/react";
import { LinkNoLugar } from "../../app/noLugar";
import type { AlertaDeContrato } from "../../lib/contratos/alertas";

/** Aviso de "Dados divergentes": o contrato não bate mais com o evento. Mostra o que mudou e leva ao contrato (onde se gera o aditivo). */
export function AlertaDeDivergencia({ alertas, comEvento = false }: { alertas: readonly AlertaDeContrato[]; comEvento?: boolean }) {
  if (alertas.length === 0) return null;
  return (
    <section className="mt-escolha__aviso" role="alert" data-testid="alerta-divergencia" style={{ display: "grid", gap: 6 }}>
      <b><Warning size={16} weight="fill" /> Dados divergentes no contrato</b>
      {alertas.map((a) => (
        <div key={a.contratoId}>
          {comEvento && <LinkNoLugar to={`/eventos/${a.eventoId}`} className="mt-reserva__evento">{a.eventoNome}</LinkNoLugar>}
          <ul style={{ paddingLeft: 18 }}>{a.textos.map((t, i) => <li key={i} className="t-body-sm">{t}</li>)}</ul>
          <LinkNoLugar to={`/contratos/${a.contratoId}`} className="mt-reserva__evento">Ver o contrato e gerar o aditivo</LinkNoLugar>
        </div>
      ))}
    </section>
  );
}
