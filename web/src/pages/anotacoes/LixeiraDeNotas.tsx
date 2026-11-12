import { useState } from "react";
import { ArrowCounterClockwise, Trash } from "@phosphor-icons/react";
import { Button, Sheet } from "../../ds";
import { raizesDaLixeira } from "../../lib/anotacoes/acoes";
import { idsDaSubarvore, type ResumoDaNota } from "../../lib/anotacoes/paginas";

const quando = (iso: string | null) => (iso ? new Date(iso).toLocaleString("pt-BR", { day: "2-digit", month: "2-digit", hour: "2-digit", minute: "2-digit" }) : "");

/** A lixeira: o que foi apagado (cada exclusão uma vez, com as subpáginas dentro), para restaurar ou apagar de vez (pede confirmação). */
export function LixeiraDeNotas({ aberta, onFechar, notas, onRestaurar, onApagarDeVez }: { aberta: boolean; onFechar: () => void; notas: readonly ResumoDaNota[]; onRestaurar: (id: string) => void; onApagarDeVez: (id: string) => void }) {
  const raizes = raizesDaLixeira(notas);
  const [confirmando, setConfirmando] = useState<string | null>(null);
  return (
    <Sheet open={aberta} onClose={() => { setConfirmando(null); onFechar(); }} title="Lixeira" wide>
      <div className="ds-stack" data-testid="lixeira-de-notas">
        <p className="t-body-sm t-muted">As páginas apagadas ficam aqui. Restaurar traz de volta a página e as subpáginas que foram junto. “Apagar de vez” não tem volta.</p>
        {raizes.length === 0 && <p className="t-body t-muted">A lixeira está vazia.</p>}
        <ul className="mt-escolha" role="list">
          {raizes.map((n) => {
            const dentro = idsDaSubarvore(notas, n.id).length - 1;
            return (
              <li key={n.id} className="mt-escolha__item">
                <div className="mt-escolha__linha" style={{ gap: 10, flexWrap: "wrap" }}>
                  <span aria-hidden>{n.icon || "📝"}</span><span className="mt-escolha__nome" style={{ flex: 1 }}>{n.title || "Sem título"}</span>
                  <span className="t-body-sm t-muted">{dentro > 0 ? `+ ${dentro} subpágina${dentro === 1 ? "" : "s"} · ` : ""}apagada em {quando(n.deleted_at)}</span>
                  <Button size="sm" variant="secondary" icon={<ArrowCounterClockwise size={16} />} onClick={() => onRestaurar(n.id)} data-testid="restaurar-nota">Restaurar</Button>
                  {confirmando === n.id
                    ? <Button size="sm" variant="danger" onClick={() => { setConfirmando(null); onApagarDeVez(n.id); }} data-testid="confirmar-apagar-de-vez">Apagar de vez: confirmar</Button>
                    : <Button size="sm" variant="ghost" icon={<Trash size={16} />} onClick={() => setConfirmando(n.id)} data-testid="apagar-de-vez">Apagar de vez</Button>}
                </div>
              </li>
            );
          })}
        </ul>
      </div>
    </Sheet>
  );
}
