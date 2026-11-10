import { useEffect } from "react";
import { useToast } from "../ds";
import { useDivergenciasDeContratos } from "../pages/contratos/useDivergencias";
import { mostrarNotificacao } from "../lib/notificacoes/notificacoes";

const chave = (id: string) => `frota:divergencia-avisada:${id}`;
const lida = (id: string) => { try { return localStorage.getItem(chave(id)); } catch { return null; } };
const grava = (id: string, v: string) => { try { localStorage.setItem(chave(id), v); } catch { /* sem armazenamento */ } };

/** Avisa (notificação do aparelho, ou aviso na tela) quando um contrato passa a ter dados divergentes, e de novo só se aparecer divergência nova. */
export function useAvisoDeDivergencias() {
  const alertas = useDivergenciasDeContratos();
  const toast = useToast();
  useEffect(() => {
    for (const a of alertas) {
      if (lida(a.contratoId) === a.assinatura) continue;
      grava(a.contratoId, a.assinatura);
      const corpo = `${a.eventoNome}: ${a.textos[0]}${a.textos.length > 1 ? ` (+${a.textos.length - 1})` : ""}`;
      void mostrarNotificacao({ id: `divergencia-${a.contratoId}`, titulo: "Contrato com dados divergentes", corpo, botao: "Ver contrato", url: `/contratos/${a.contratoId}` }).then((ok) => { if (!ok) toast(`Contrato com dados divergentes. ${corpo}`); });
    }
  }, [alertas, toast]);
}
