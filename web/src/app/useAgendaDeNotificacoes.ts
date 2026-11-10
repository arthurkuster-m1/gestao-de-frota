import { useEffect } from "react";
import { useToast } from "../ds";
import { disparosDevidos, lerNotificacoes, mostrarNotificacao } from "../lib/notificacoes/notificacoes";

const marca = (chave: string) => `frota:notif-disparada:${chave}`;
const jaDisparou = (chave: string) => { try { return localStorage.getItem(marca(chave)) !== null; } catch { return false; } };
const guardar = (chave: string) => { try { localStorage.setItem(marca(chave), "1"); } catch { /* sem armazenamento */ } };

/**
 * Confere de 15 em 15 segundos (e quando a aba volta ao foco) se chegou a hora de alguma notificação e a mostra.
 * Funciona enquanto o app está aberto (aba ou app instalado, mesmo em segundo plano). Com o app fechado, só com o envio pelo servidor (próxima etapa).
 */
export function useAgendaDeNotificacoes() {
  const toast = useToast();
  useEffect(() => {
    const checar = () => {
      for (const d of disparosDevidos(lerNotificacoes(), new Date(), jaDisparou)) {
        guardar(d.chave);
        void mostrarNotificacao(d.notificacao).then((ok) => { if (!ok) toast(`${d.notificacao.titulo}: ${d.notificacao.corpo}`); });
      }
    };
    checar();
    const t = window.setInterval(checar, 15000);
    const volta = () => { if (document.visibilityState === "visible") checar(); };
    document.addEventListener("visibilitychange", volta);
    return () => { window.clearInterval(t); document.removeEventListener("visibilitychange", volta); };
  }, [toast]);
}
