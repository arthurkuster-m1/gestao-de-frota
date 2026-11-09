import { createContext, useContext, type ComponentProps, type MouseEvent } from "react";
import { Link, useNavigate } from "react-router-dom";

/** Abre um caminho "no lugar": evento e veículo abrem o painel lateral POR CIMA da página atual, sem sair dela. Fora do provedor, navega normalmente. */
export type AbrirNoLugar = (caminho: string) => void;
export const NoLugarContext = createContext<AbrirNoLugar | null>(null);

export function useAbrirNoLugar(): AbrirNoLugar {
  const abrir = useContext(NoLugarContext);
  const navigate = useNavigate();
  return abrir ?? ((caminho) => navigate(caminho));
}

/** Link que, para eventos e veículos, abre o painel por cima da página em que a pessoa está. */
export function LinkNoLugar({ to, onClick, ...resto }: Omit<ComponentProps<typeof Link>, "to"> & { to: string }) {
  const abrir = useAbrirNoLugar();
  return <Link to={to} {...resto} onClick={(e: MouseEvent<HTMLAnchorElement>) => { onClick?.(e); if (e.defaultPrevented || e.metaKey || e.ctrlKey || e.shiftKey || e.button !== 0) return; e.preventDefault(); abrir(to); }} />;
}
