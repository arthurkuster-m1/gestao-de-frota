import { CheckCircle, WarningCircle } from "@phosphor-icons/react";
import { Card, Page, Spinner } from "../ds";
import { useEspaco } from "../lib/espaco";
import { DESTINOS } from "../app/modules";
import { Link } from "react-router-dom";
import { ProximosDoInicio } from "./home/ProximosDoInicio";
import "./veiculos/veiculos.css";

export function Home() {
  const { carregando, erro, espaco, eu } = useEspaco();
  return (
    <Page wide>
      <div className="ds-stack">
        <div>
          <h1 className="t-display">{eu ? `Olá, ${eu.display_name}` : "Frota"}</h1>
          <p className="t-body t-muted">Gestão da frota de marketing.</p>
        </div>

        <Card>
          {carregando ? <p className="t-body t-muted"><Spinner /> Conferindo a conexão…</p>
            : erro ? <p className="t-body" role="alert"><WarningCircle size={20} weight="fill" style={{ verticalAlign: "-4px" }} /> Erro de permissão ou banco: {erro}</p>
            : espaco ? <p className="t-body" data-testid="conexao-ok"><CheckCircle size={20} weight="fill" style={{ verticalAlign: "-4px", color: "var(--color-success)" }} /> Supabase conectado · Espaço “{espaco}”</p>
            : <p className="t-body" role="alert"><WarningCircle size={20} weight="fill" style={{ verticalAlign: "-4px" }} /> Seu login ainda não foi vinculado a um espaço. Rode o <code>seed.example.sql</code> (passo 4 de <code>supabase/README.md</code>).</p>}
        </Card>

        <ProximosDoInicio />

        <Card>
          <h2 className="t-h3" style={{ marginBottom: 12 }}>Telas</h2>
          <div className="ds-stack">
            {DESTINOS.filter((d) => d.path !== "/").map((d) => (
              <Link key={d.path} to={d.path} className="ds-row" style={{ textDecoration: "none", color: "inherit" }}>
                <d.Icon size={22} /><span className="t-body" style={{ fontWeight: 600 }}>{d.label}</span><span className="t-body-sm t-muted">{d.desc}</span>
              </Link>
            ))}
          </div>
        </Card>
      </div>
    </Page>
  );
}
