import { NavLink, Link } from "react-router-dom";
import { Car, Moon, SignOut, Sun } from "@phosphor-icons/react";
import { Avatar, Badge, Button, useTheme } from "../ds";
import { useAuth } from "../lib/auth";
import { useEspaco } from "../lib/espaco";
import { DESTINOS } from "./modules";

/** Conteúdo do menu: usado na barra fixa (computador) e dentro da gaveta (celular). */
export function SidebarContent({ onNavigate }: { onNavigate?: () => void }) {
  const { sair } = useAuth();
  const { eu } = useEspaco();
  const { resolvido, alternar } = useTheme();

  return (
    <div className="ds-side">
      <Link to="/" className="ds-side__brand" onClick={onNavigate}>
        <span className="ds-avatar ds-avatar--brand" aria-hidden><Car size={22} weight="fill" /></span>
        <span className="t-h3">Frota</span>
      </Link>

      <nav className="ds-side__nav" aria-label="Menu">
        {DESTINOS.map((d) => (
          <NavLink key={d.path} to={d.path} end={d.path === "/"} className="ds-side__link" onClick={onNavigate}>
            {({ isActive }) => (<><d.Icon size={22} weight={isActive ? "fill" : "regular"} />{d.label}{!d.pronto && <Badge tone="neutral">em breve</Badge>}</>)}
          </NavLink>
        ))}
      </nav>

      <div className="ds-side__foot">
        <div className="ds-row">
          {eu && <Avatar nome={eu.display_name} />}
          <div style={{ minWidth: 0, flex: 1 }}>
            <p className="t-body" style={{ fontWeight: 700 }}>{eu?.display_name ?? "…"}</p>
          </div>
          <Button variant="ghost" size="icon" aria-label="Alternar tema" onClick={alternar}>{resolvido === "dark" ? <Sun size={22} /> : <Moon size={22} />}</Button>
        </div>
        <button type="button" className="ds-side__sub" onClick={sair}><SignOut size={20} />Sair</button>
      </div>
    </div>
  );
}
