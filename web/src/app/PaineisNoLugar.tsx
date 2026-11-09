import { useCallback, useState, type ReactNode } from "react";
import { useLocation, useNavigate } from "react-router-dom";
import { AvisoDeChecklistEmMassa } from "../pages/checklists/AvisoDeChecklistEmMassa";
import { JanelaDoEventoLigada } from "../pages/eventos/JanelaDoEventoLigada";
import type { AbaDoEvento } from "../pages/eventos/JanelaDoEvento";
import { useDadosDeEventos } from "../pages/eventos/useDadosDeEventos";
import { VeiculoNoLugar } from "../pages/veiculos/VeiculoNoLugar";
import { NoLugarContext } from "./noLugar";

type Aberto = { tipo: "evento" | "veiculo"; id: string; aba: AbaDoEvento; chave: number };
const ABAS: AbaDoEvento[] = ["dados", "veiculos", "transportes", "contratos"];

function EventoNoLugar({ item, onAba, onFechar }: { item: Aberto; onAba: (a: AbaDoEvento) => void; onFechar: () => void }) {
  const d = useDadosDeEventos();
  return <><JanelaDoEventoLigada d={d} id={item.id} aba={item.aba} onAba={onAba} onFechar={onFechar} onExcluido={onFechar} /><AvisoDeChecklistEmMassa d={d} /></>;
}

/**
 * Evento e veículo abrem o painel lateral POR CIMA da página em que a pessoa está (o endereço não muda): ao fechar, ela continua onde estava.
 * Nas telas "de casa" do painel (Eventos para evento, Veículos para veículo) o painel continua sendo o da própria tela.
 */
export function PaineisNoLugar({ children }: { children: ReactNode }) {
  const navigate = useNavigate();
  const { pathname } = useLocation();
  const [pilha, setPilha] = useState<Aberto[]>([]);
  const fechar = useCallback((chave: number) => setPilha((p) => p.filter((x) => x.chave !== chave)), []);

  const abrir = useCallback((caminho: string) => {
    const m = /^\/(eventos|veiculos)\/([^/?#]+)(?:\?aba=([a-z]+))?/.exec(caminho);
    if (!m || pathname.startsWith(`/${m[1]}`)) { navigate(caminho); return; }
    const tipo = m[1] === "eventos" ? "evento" : "veiculo";
    const aba = (ABAS as string[]).includes(m[3] ?? "") ? (m[3] as AbaDoEvento) : "dados";
    setPilha((p) => (p.at(-1)?.tipo === tipo && p.at(-1)?.id === m[2] ? p : [...p, { tipo, id: m[2]!, aba, chave: Date.now() + p.length }]));
  }, [pathname, navigate]);

  return (
    <NoLugarContext.Provider value={abrir}>
      {children}
      {pilha.map((item) => item.tipo === "evento"
        ? <EventoNoLugar key={item.chave} item={item} onAba={(a) => setPilha((p) => p.map((x) => (x.chave === item.chave ? { ...x, aba: a } : x)))} onFechar={() => fechar(item.chave)} />
        : <VeiculoNoLugar key={item.chave} id={item.id} onFechar={() => fechar(item.chave)} />)}
    </NoLugarContext.Provider>
  );
}
