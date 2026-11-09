import { LinkNoLugar } from "../../app/noLugar";
import { Tag } from "../../components/motor/Tag";
import { STATUS_DE_USO, type ItemDaAgenda as ItemDeTexto } from "../../lib/eventos/uso";

/** A agenda do carro em tags coloridas pelo status de uso ("Reservado - Evento X 05/11 até 07/11"); cada tag leva ao evento (ou à manutenção). */
export function AgendaEmTags({ itens }: { itens: readonly ItemDeTexto[] }) {
  if (itens.length === 0) return <span className="mt-vazio">—</span>;
  return (
    <span className="mt-agenda-tags">
      {itens.map((it, k) => (
        <LinkNoLugar key={k} to={it.href} className="mt-agenda-link" onClick={(e) => e.stopPropagation()} title="Abrir">
          <Tag campoId="statusUso" opcao={{ value: it.uso, label: it.texto, tom: STATUS_DE_USO.find((o) => o.value === it.uso)?.tom }} />
        </LinkNoLugar>
      ))}
    </span>
  );
}
