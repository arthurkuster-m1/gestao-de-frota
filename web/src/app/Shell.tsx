import { useAgendaDeNotificacoes } from "./useAgendaDeNotificacoes";
import { useEffect, useRef, useState } from "react";
import { Outlet, useLocation, useNavigate } from "react-router-dom";
import { CaretDoubleLeft, List, SidebarSimple, X } from "@phosphor-icons/react";
import { Avatar, Button, FloatingNav } from "../ds";
import { useEspaco } from "../lib/espaco";
import { SidebarContent } from "./Sidebar";
import { PaineisNoLugar } from "./PaineisNoLugar";
import { DESTINOS, destinoDoCaminho } from "./modules";

export function Shell() {
  useAgendaDeNotificacoes();
  const { pathname } = useLocation();
  const navigate = useNavigate();
  const { eu } = useEspaco();
  const [gaveta, setGaveta] = useState(false);
  /** Menu lateral recolhido (computador), como no Notion: fica guardado neste aparelho; Ctrl + \ alterna; o mouse na borda esquerda mostra o menu por cima. */
  const [recolhido, setRecolhido] = useState(() => { try { return localStorage.getItem("frota:menu-recolhido") === "1"; } catch { return false; } });
  const alternarMenu = () => { (document.activeElement as HTMLElement | null)?.blur?.(); setRecolhido((r) => { const n = !r; try { localStorage.setItem("frota:menu-recolhido", n ? "1" : "0"); } catch { /* sem armazenamento */ } return n; }); };
  useEffect(() => {
    const tecla = (e: KeyboardEvent) => { if ((e.ctrlKey || e.metaKey) && e.key === "\\") { e.preventDefault(); alternarMenu(); } };
    document.addEventListener("keydown", tecla);
    return () => document.removeEventListener("keydown", tecla);
  }, []);
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
    <div className={recolhido ? "ds-shell is-recolhido" : "ds-shell"}>
      <div className="ds-borda-do-menu" aria-hidden />
      <aside className="ds-sidebar" aria-label="Menu lateral">
        <button type="button" className="ds-sidebar__recolher" aria-label="Fechar o menu lateral" title="Fechar o menu (Ctrl + \)" onClick={alternarMenu} data-testid="recolher-menu"><CaretDoubleLeft size={18} /></button>
        <SidebarContent />
      </aside>
      <button type="button" className="ds-shell__abrir-menu" aria-label="Abrir o menu lateral" title="Abrir o menu (Ctrl + \)" onClick={alternarMenu} data-testid="abrir-menu"><SidebarSimple size={20} /></button>

      <div className="ds-shell__main">
        <nav className="ds-migalhas" aria-label="Onde você está" data-testid="migalhas"><span>Frota</span><span aria-hidden>/</span><b>{titulo}</b></nav>
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
