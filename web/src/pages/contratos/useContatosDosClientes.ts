import { useEffect, useState } from "react";
import { buscarCliente } from "../../lib/clientes/dados";
import { useVersaoDosDados } from "../../lib/sincronia";
import type { ContatosDoCliente } from "./camposDeContratos";

/** E-mail da parte e da testemunha de cada cliente (campos confidenciais: vêm da ficha, um cliente por vez). */
export function useContatosDosClientes(ids: readonly string[]): Map<string, ContatosDoCliente> {
  const [mapa, setMapa] = useState<Map<string, ContatosDoCliente>>(new Map());
  const versao = useVersaoDosDados();
  const chave = [...new Set(ids)].sort().join(",");
  useEffect(() => {
    let vivo = true;
    const lista = chave ? chave.split(",") : [];
    void Promise.all(lista.map((id) => buscarCliente(id).then((c) => [id, c ? { email: c.email, testemunha: c.testemunha_nome, testemunhaEmail: c.testemunha_email } : null] as const, () => [id, null] as const)))
      .then((pares) => { if (vivo) setMapa(new Map(pares.filter((p): p is readonly [string, ContatosDoCliente] => !!p[1]))); });
    return () => { vivo = false; };
  }, [chave, versao]);
  return mapa;
}
