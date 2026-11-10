import { useVersaoDosDados } from "../../lib/sincronia";
import { useEffect, useMemo, useState } from "react";
import { useNavigate, useParams } from "react-router-dom";
import { FileText } from "@phosphor-icons/react";
import { EmptyState } from "../../ds";
import { TelaDoMotor } from "../../components/motor/TelaDoMotor";
import { listarClientes, type ClienteResumo } from "../../lib/clientes/dados";
import type { Contrato } from "../../lib/contratos/tipos";
import { SubpaginasDeEventos } from "../eventos/SubpaginasDeEventos";
import { useDadosDeEventos } from "../eventos/useDadosDeEventos";
import { camposDoContrato, type ContextoDeContratos } from "./camposDeContratos";
import { baixarAditivoDocx, baixarContratoDocx } from "./baixar";
import { JanelaDoContrato } from "./JanelaDoContrato";
import { useContratos } from "./useContratos";
import { useContatosDosClientes } from "./useContatosDosClientes";
import "../veiculos/veiculos.css";

/** Contratos de comodato: um por evento, com cliente, vigência, carros e aditivos. A conferência com o evento é calculada. */
export function Contratos() {
  const navigate = useNavigate();
  const { id: idAberto } = useParams<{ id?: string }>();
  const d = useDadosDeEventos();
  const k = useContratos();
  const [clientes, setClientes] = useState<ClienteResumo[]>([]);
  const [erroClientes, setErroClientes] = useState<string | null>(null);
  const versao = useVersaoDosDados();
  useEffect(() => { listarClientes().then(setClientes, (e: Error) => setErroClientes(e.message)); }, [versao]);

  const contatos = useContatosDosClientes(k.contratos.map((c) => c.cliente_id));
  const ctx = useMemo<ContextoDeContratos>(() => {
    const rs = new Map<string, typeof d.reservas>();
    for (const r of d.reservas) { const l = rs.get(r.evento_id); if (l) l.push(r); else rs.set(r.evento_id, [r]); }
    return { eventos: new Map((d.eventos ?? []).map((e) => [e.id, e])), clientes: new Map(clientes.map((c) => [c.id, c.nome])), veiculos: new Map(d.veiculos.map((v) => [v.id, v])), reservasDoEvento: rs, emVigor: k.emVigor, locais: d.locais, contatos };
  }, [d.eventos, d.reservas, d.veiculos, d.locais, clientes, k.emVigor, contatos]);
  const ctxDocs = useMemo<ContextoDeContratos>(() => ({ ...ctx, docs: {
    carros: k.carros, itens: k.itens,
    baixarContrato: (c) => void baixarContratoDocx(c, ctx, k.carros).catch((e: Error) => setErroClientes(e.message)),
    baixarAditivo: (c, a, n) => void baixarAditivoDocx(c, a, n, ctx, k.itens).catch((e: Error) => setErroClientes(e.message)),
  } }), [ctx, k.carros, k.itens]);
  const campos = useMemo(() => camposDoContrato(ctxDocs), [ctxDocs]);
  const pronto = d.eventos !== null && k.carregado;
  const lista = pronto ? k.contratos : null;
  const aberto = idAberto && lista ? (lista.find((x) => x.id === idAberto) ?? null) : null;
  useEffect(() => { if (idAberto && lista && !lista.some((x) => x.id === idAberto)) navigate("/contratos", { replace: true }); }, [idAberto, lista, navigate]);

  return (
    <>
      <TelaDoMotor<Contrato> tela="contratos" cabecalhoDireita={<SubpaginasDeEventos ativa="contratos" />} titulo="Contratos" subtitulo="Os contratos nascem dentro de cada evento. Comodato com cliente, vigência, carros e aditivos. A coluna Divergência confere o contrato com as reservas."
        avisos={(k.erro || erroClientes) ? <p className="t-body-sm" role="alert" data-testid="aviso-contratos">{k.erro ?? erroClientes}</p> : null}
        linhas={lista} erro={d.erro} campos={campos} idDe={(c) => c.id} onEditar={k.editar} onAbrir={(c) => navigate(`/contratos/${c.id}`)}
        rotuloDoTotal={(n) => `${n} contrato${n === 1 ? "" : "s"}`} placeholderDaBusca="Buscar evento, cliente…"
        vazio={<EmptyState icon={<FileText size={30} />} title="Nenhum contrato ainda">Os contratos são criados dentro de cada evento (aba Contratos). Eles aparecem aqui para acompanhar.</EmptyState>}
        filhos={<JanelaDoContrato contrato={aberto} campos={campos} ctx={ctx} veiculos={d.veiculos} carrosDoContrato={aberto ? k.carros.filter((c) => c.contrato_id === aberto.id) : []} itens={k.itens} reservasDoEvento={aberto ? (ctx.reservasDoEvento.get(aberto.evento_id) ?? []) : []}
          onEditar={k.editar} onEditarAditivo={k.editarAditivo} onIncluirCarro={k.incluirCarro} onTirarCarro={k.tirarCarro} onNovoAditivo={k.novoAditivo} onTirarAditivo={k.tirarAditivo}
          onExcluir={async (c) => { await k.excluir(c); navigate("/contratos"); }} onFechar={() => navigate("/contratos")} />} />
    </>
  );
}
