import { useState } from "react";
import { ClipboardText, PencilSimple, Warning } from "@phosphor-icons/react";
import { Button } from "../../ds";
import { kmTexto, quandoFoi } from "../../lib/checklists/regras";
import { MOMENTOS, rotuloCombustivel, rotuloLimpeza, type Checklist, type ChecklistNovo, type Momento } from "../../lib/checklists/tipos";
import { FormularioDeChecklist } from "./FormularioDeChecklist";

/** Os dois checklists de uma reserva (envio e retorno): resumo de cada um, com botão para fazer ou editar. */
export function ChecklistsDaReserva({ reservaId, carro, checklists, onSalvar }: {
  reservaId: string; carro: string; checklists: Checklist[];
  onSalvar: (reservaId: string, momento: Momento, existente: Checklist | null, dados: Omit<ChecklistNovo, "reserva_id" | "momento">) => Promise<void>;
}) {
  const [aberto, setAberto] = useState<Momento | null>(null);
  const doMomento = (m: Momento) => checklists.find((c) => c.reserva_id === reservaId && c.momento === m) ?? null;
  const atual = aberto ? doMomento(aberto) : null;
  return (
    <div className="mt-checklists" data-testid="checklists-da-reserva">
      {MOMENTOS.map((m) => {
        const c = doMomento(m.value);
        return (
          <div key={m.value} className="mt-checklist" data-testid={`checklist-${m.value}`}>
            <div className="ds-row" style={{ justifyContent: "space-between" }}>
              <span className="t-body" style={{ fontWeight: 600 }}><ClipboardText size={16} style={{ verticalAlign: "-3px" }} /> {m.label}</span>
              <Button size="sm" variant={c ? "ghost" : "secondary"} icon={c ? <PencilSimple size={16} /> : undefined} onClick={() => setAberto(m.value)} data-testid={`fazer-${m.value}`}>{c ? "Editar" : `Fazer checklist de ${m.label.toLowerCase()}`}</Button>
            </div>
            {c && (
              <p className="t-body-sm" data-testid={`resumo-${m.value}`}>
                {[quandoFoi(c.data_hora), kmTexto(c.km), rotuloCombustivel(c.combustivel) && `combustível ${rotuloCombustivel(c.combustivel)}`, rotuloLimpeza(c.limpeza) && rotuloLimpeza(c.limpeza)!.toLowerCase(), c.recebido_por && `recebeu: ${c.recebido_por}`].filter(Boolean).join(" · ")}
                {c.teve_avarias ? <span className="mt-escolha__aviso" role="note"><Warning size={16} weight="fill" />Avarias: {c.avarias}</span> : <span className="t-muted"> · sem avarias</span>}
                {c.observacoes && <span className="t-muted"> · {c.observacoes}</span>}
              </p>
            )}
          </div>
        );
      })}
      <FormularioDeChecklist aberto={!!aberto} onFechar={() => setAberto(null)} momento={aberto ?? "saida"} carro={carro} existente={atual} onSalvar={(d) => onSalvar(reservaId, aberto!, atual, d)} />
    </div>
  );
}
