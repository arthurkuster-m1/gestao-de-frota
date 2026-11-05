import { createContext, useContext, useEffect, useState, type ReactNode } from "react";
import { useAuth } from "./auth";
import { supabase } from "./supabase";

export type Membro = { user_id: string; display_name: string };
type Ctx = { carregando: boolean; erro: string | null; espaco: string | null; membros: Membro[]; eu: Membro | null };
const EspacoCtx = createContext<Ctx>({ carregando: true, erro: null, espaco: null, membros: [], eu: null });

/** Quem sou eu e qual é o espaço de trabalho. Carrega uma vez após o login (a RLS só devolve o que é meu). */
export function EspacoProvider({ children }: { children: ReactNode }) {
  const { session } = useAuth();
  const [estado, setEstado] = useState<Omit<Ctx, "eu">>({ carregando: true, erro: null, espaco: null, membros: [] });

  useEffect(() => {
    let vivo = true;
    supabase
      .from("workspace_members")
      .select("user_id, display_name, workspaces(name)")
      .then(({ data, error }) => {
        if (!vivo) return;
        if (error) return setEstado({ carregando: false, erro: error.message, espaco: null, membros: [] });
        const linhas = (data ?? []) as unknown as { user_id: string; display_name: string; workspaces: { name: string } | null }[];
        setEstado({
          carregando: false, erro: null,
          espaco: linhas[0]?.workspaces?.name ?? null,
          membros: linhas.map(({ user_id, display_name }) => ({ user_id, display_name })),
        });
      });
    return () => { vivo = false; };
  }, []);

  const eu = estado.membros.find((m) => m.user_id === session?.user.id) ?? null;
  return <EspacoCtx.Provider value={{ ...estado, eu }}>{children}</EspacoCtx.Provider>;
}

export const useEspaco = () => useContext(EspacoCtx);
