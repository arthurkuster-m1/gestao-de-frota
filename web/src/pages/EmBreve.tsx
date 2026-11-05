import { Hammer } from "@phosphor-icons/react";
import { Card, EmptyState, Page } from "../ds";
import type { Destino } from "../app/modules";

/** Tela ainda não construída: diz o que ela vai ter (o menu já mostra o desenho final). */
export function EmBreve({ destino }: { destino: Destino }) {
  return (
    <Page wide>
      <div className="ds-stack">
        <div>
          <h1 className="t-h1">{destino.label}</h1>
          <p className="t-body t-muted">{destino.desc}</p>
        </div>
        <Card>
          <EmptyState icon={<Hammer size={30} />} title="Em construção">
            <ul style={{ textAlign: "left", margin: "8px auto 0", paddingLeft: 20, maxWidth: 520 }}>
              {destino.itens.map((i) => <li key={i} className="t-body">{i}</li>)}
            </ul>
          </EmptyState>
        </Card>
      </div>
    </Page>
  );
}
