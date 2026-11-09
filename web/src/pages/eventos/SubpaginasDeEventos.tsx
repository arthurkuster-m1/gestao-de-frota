import { useNavigate } from "react-router-dom";
import { SeletorPilula } from "../../ds";

export const SUBPAGINAS_DE_EVENTOS = [
  { id: "eventos", rotulo: "Eventos", to: "/eventos" },
  { id: "clientes", rotulo: "Clientes", to: "/clientes" },
  { id: "contratos", rotulo: "Contratos", to: "/contratos" },
  { id: "transportes", rotulo: "Transportes", to: "/transportes" },
] as const;
export type SubpaginaDeEventos = (typeof SUBPAGINAS_DE_EVENTOS)[number]["id"];

/** Os eventos mandam em clientes, contratos, transportes e pagamentos: essas telas são subpáginas de Eventos, escolhidas no canto superior direito. */
export function SubpaginasDeEventos({ ativa }: { ativa: SubpaginaDeEventos }) {
  const navigate = useNavigate();
  return <SeletorPilula rotulo="Subpáginas de Eventos" opcoes={SUBPAGINAS_DE_EVENTOS} ativo={ativa} aoEscolher={(id) => navigate(SUBPAGINAS_DE_EVENTOS.find((s) => s.id === id)!.to)} />;
}
