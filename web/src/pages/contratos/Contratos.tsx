import { useEffect, useMemo, useState } from "react";
import { useNavigate, useParams } from "react-router-dom";
import { FileText, Plus } from "@phosphor-icons/react";
import { Button, EmptyState } from "../../ds";
import { TelaDoMotor } from "../../components/motor/TelaDoMotor";
import { listarClientes, type ClienteResumo } from "../../lib/clientes/dados";
import type { Contrato } from "../../lib/contratos/tipos";
import { SubpaginasDeEventos } from "../eventos/SubpaginasDeEventos";
import { useDadosDeEventos } from "../eventos/useDadosDeEventos";
import { camposDoContrato, type ContextoDeContratos } from "./camposDeContratos";
import { JanelaDoContrato } from "./JanelaDoContrato";
import { NovoContrato } from "./NovoContrato";
import { useContratos } from "./useContratos";
import "../veiculos/veiculos.css";

/** Contratos de comodato: um por evento, com cliente, vigência, carros e aditivos. A conferência com o evento é calculada. */
export function Contratos() {
  const navigate = useNavigate();
  const { id: idAberto } = useParams<{ id?: string }>();
  const d = useDadosDeEventos();
  const k = useContratos();
  const [clientes, setClientes] = useState<ClienteResumo[]>([]);
  const [erroClientes, setErroClientes] = useState<string | null>(null);
  const [criando, setCriando] = useState(false);
  useEffect(() => { listarClientes().then(setClientes, (e: Error) => setErroClientes(e.message)); }, []);

  const ctx = useMemo<ContextoDeContratos>(() => {
    const rs = new Map<string, typeof d.reservas>();
    for (const r of d.reservas) { const l = rs.get(r.evento_id); if (l) l.push(r); else rs.set(r.evento_id, [r]); }
    return { eventos: new Map((d.eventos ?? []).map((e) => [e.id, e])), clientes: new Map(clientes.map((c) => [c.id, c.nome])), veiculos: new Map(d.veiculos.map((v) => [v.id, v])), reservasDoEvento: rs, emVigor: k.emVigor };
  }, [d.eventos, d.reservas, d.veiculos, clientes, k.emVigor]);
  const campos = useMemo(() => camposDoContrato(ctx), [ctx]);
  const pronto = d.eventos !== null && k.carregado;
  const lista = pronto ? k.contratos : null;
  const aberto = idAberto && lista ? (lista.find((x) => x.id === idAberto) ?? null) : null;
  useEffect(() => { if (idAberto && lista && !lista.some((x) => x.id === idAberto)) navigate("/contratos", { replace: true }); }, [idAberto, lista, navigate]);
  const comContrato = useMemo(() => new Set(k.contratos.map((c) => c.evento_id)), [k.contratos]);

  return (
    <>
      <TelaDoMotor<Contrato> tela="contratos" cabecalhoDireita={<SubpaginasDeEventos ativa="contratos" />} titulo="Contratos" subtitulo="Comodato por evento, com cliente, vigência, carros e aditivos. A coluna Divergência confere o contrato com as reservas."
        avisos={(k.erro || erroClientes) ? <p className="t-body-sm" role="alert" data-testid="aviso-contratos">{k.erro ?? erroClientes}</p> : null}
        acoes={<Button icon={<Plus size={20} />} onClick={() => setCriando(true)} data-testid="novo-contrato">Novo contrato</Button>}
        linhas={lista} erro={d.erro} campos={campos} idDe={(c) => c.id} onEditar={k.editar} onAbrir={(c) => navigate(`/contratos/${c.id}`)}
        rotuloDoTotal={(n) => `${n} contrato${n === 1 ? "" : "s"}`} placeholderDaBusca="Buscar evento, cliente…"
        vazio={<EmptyState icon={<FileText size={30} />} title="Nenhum contrato ainda" action={<Button icon={<Plus size={20} />} onClick={() => setCriando(true)}>Criar o primeiro</Button>}>Crie o contrato de um evento: escolha o cliente e os carros. Trocas de carro e extensões de prazo entram depois como aditivos.</EmptyState>}
        filhos={<JanelaDoContrato contrato={aberto} campos={campos} ctx={ctx} veiculos={d.veiculos} carrosDoContrato={aberto ? k.carros.filter((c) => c.contrato_id === aberto.id) : []} itens={k.itens} reservasDoEvento={aberto ? (ctx.reservasDoEvento.get(aberto.evento_id) ?? []) : []}
          onEditar={k.editar} onEditarAditivo={k.editarAditivo} onIncluirCarro={k.incluirCarro} onTirarCarro={k.tirarCarro} onNovoAditivo={k.novoAditivo} onTirarAditivo={k.tirarAditivo}
          onExcluir={async (c) => { await k.excluir(c); navigate("/contratos"); }} onFechar={() => navigate("/contratos")} />} />
      <NovoContrato aberto={criando} onFechar={() => setCriando(false)} eventos={d.eventos ?? []} eventosComContrato={comContrato} clientes={clientes} reservas={d.reservas} veiculos={d.veiculos} onCriar={k.criar} onCriado={(c) => navigate(`/contratos/${c.id}`)} />
    </>
  );
}
