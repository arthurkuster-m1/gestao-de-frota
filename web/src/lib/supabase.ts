import { createClient } from "@supabase/supabase-js";
import { avisarMudanca } from "./sincronia";

const url = import.meta.env.VITE_SUPABASE_URL as string | undefined;
const key = import.meta.env.VITE_SUPABASE_ANON_KEY as string | undefined;

export const supabaseConfigurado = Boolean(url && key);

/** Toda gravação que dá certo (menos as visualizações salvas, que não mudam dados) avisa as telas abertas para recarregar. */
const fetchComAviso: typeof fetch = async (entrada, init) => {
  const r = await fetch(entrada, init);
  const metodo = (init?.method ?? (entrada instanceof Request ? entrada.method : "GET")).toUpperCase();
  const alvo = typeof entrada === "string" ? entrada : entrada instanceof URL ? entrada.href : entrada.url;
  if (r.ok && metodo !== "GET" && metodo !== "HEAD" && alvo.includes("/rest/v1/") && !/visoes_salvas|notes_pages|notes_user_state/.test(alvo)) avisarMudanca();
  return r;
};

// Nunca lança: sem variáveis o app mostra a tela de configuração em vez de quebrar.
export const supabase = createClient(url ?? "http://localhost", key ?? "sem-chave", {
  auth: { persistSession: true, autoRefreshToken: true },
  global: { fetch: fetchComAviso },
});
