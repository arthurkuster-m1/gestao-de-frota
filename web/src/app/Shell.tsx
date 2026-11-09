import { useEffect, useRef, useState } from "react";
import { Outlet, useLocation, useNavigate } from "react-router-dom";
import { List, X } from "@phosphor-icons/react";
import { Avatar, Button, FloatingNav } from "../ds";
import { useEspaco } from "../lib/espaco";
import { SidebarContent } from "./Sidebar";
import { PaineisNoLugar } from "./PaineisNoLugar";
import { DESTINOS, destinoDoCaminho } from "./modules";

export function Shell() {
  const { pathname } = useLocation();
  const navigate = useNavigate();
  const { eu } = useEspaco();
  const [gaveta, setGaveta] = useState(false);
  const ref = useRef<HTMLDialogElement>(null);
  const titulo = destinoDoCaminho(pathname)?.label ?? "Início";
  const principais = DESTINOS.filter((d) => d.principal);

  useEffect(() => { setGaveta(false); }, [pathname]);
  useEffect(() => {
    const d = ref.current;
    if (!d) return;
    if (gaveta && !d.open) d.showModal();
    if (!gaveta && d.open) d.close();
  }, [gaveta]);

  // clientes, contratos, transportes e pagamentos são subpáginas de Eventos
  const caminhoDoMenu = /^\/(clientes|contratos|transportes)(\/|$)/.test(pathname) ? "/eventos" : pathname;
  const ativo = principais.find((d) => (d.path === "/" ? caminhoDoMenu === "/" : caminhoDoMenu.startsWith(d.path)))?.path ?? "";

  return (
    <div className="ds-shell">
      <aside className="ds-sidebar" aria-label="Menu lateral"><SidebarContent /></aside>

      <div className="ds-shell__main">
        <header className="ds-topbar">
          <Button variant="ghost" size="icon" aria-label="Abrir menu" onClick={() => setGaveta(true)}><List size={24} /></Button>
          <span className="t-h3">{titulo}</span>
          {eu ? <Avatar nome={eu.display_name} /> : <span style={{ width: 40 }} />}
        </header>
        <PaineisNoLugar><Outlet /></PaineisNoLugar>
      </div>

      <dialog ref={ref} className="ds-drawer" aria-label="Menu" onClose={() => setGaveta(false)} onClick={(e) => { if (e.target === ref.current) setGaveta(false); }}>
        <div className="ds-drawer__bar"><Button variant="ghost" size="icon" aria-label="Fechar menu" onClick={() => setGaveta(false)}><X size={22} /></Button></div>
        <SidebarContent onNavigate={() => setGaveta(false)} />
      </dialog>

      <FloatingNav
        className="ds-nav--mobile"
        active={ativo}
        onSelect={(p) => navigate(p)}
        items={principais.map((d) => ({ id: d.path, label: d.curto ?? d.label, href: d.path, icon: <d.Icon size={22} weight={d.path === ativo ? "fill" : "regular"} /> }))}
      />
    </div>
  );
}
