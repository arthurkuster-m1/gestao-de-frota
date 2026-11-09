import { useEffect, useMemo, useState } from "react";
import { useNavigate, useParams, useSearchParams } from "react-router-dom";
import { CurrencyDollar, Plus, Truck } from "@phosphor-icons/react";
import { Button, EmptyState, Segmented } from "../../ds";
import { TelaDoMotor } from "../../components/motor/TelaDoMotor";
import type { Pagamento, Transporte } from "../../lib/transportes/tipos";
import { SubpaginasDeEventos } from "../eventos/SubpaginasDeEventos";
import { useDadosDeEventos } from "../eventos/useDadosDeEventos";
import { camposDoPagamento, camposDoTransporte, type ContextoDeTransportes } from "./camposDeTransportes";
import { JanelaDoPagamento } from "./JanelaDoPagamento";
import { JanelaDoTransporte } from "./JanelaDoTransporte";
import { NovoPagamento } from "./NovoPagamento";
import { NovoTransporte } from "./NovoTransporte";
import "../veiculos/veiculos.css";

/** Transportes e Pagamentos: duas listas da mesma tela. O transporte leva carros; o pagamento (PTA ou NF da TSO) pode cobrir vários transportes. */
export function Transportes() {
  const navigate = useNavigate();
  const { id: idTransporte } = useParams<{ id?: string }>();
  const [busca, setBusca] = useSearchParams();
  const aba = busca.get("aba") === "pagamentos" ? "pagamentos" : "transportes";
  const idPagamento = busca.get("abrir");
  const d = useDadosDeEventos();
  const tr = d.tr;
  const [novoT, setNovoT] = useState(false);
  const [novoP, setNovoP] = useState(false);

  const ctx = useMemo<ContextoDeTransportes>(() => ({ eventos: new Map((d.eventos ?? []).map((e) => [e.id, e])), veiculos: new Map(d.veiculos.map((v) => [v.id, v])), reservas: d.reservas, vinculos: tr.vinculos, pagamentos: tr.pagamentos, transportes: tr.transportes }), [d.eventos, d.veiculos, d.reservas, tr.vinculos, tr.pagamentos, tr.transportes]);
  const camposT = useMemo(() => camposDoTransporte(ctx), [ctx]);
  const camposP = useMemo(() => camposDoPagamento(ctx), [ctx]);
  const pronto = d.eventos !== null && tr.carregado;
  const abertoT = idTransporte && pronto ? (tr.transportes.find((x) => x.id === idTransporte) ?? null) : null;
  const abertoP = idPagamento && pronto ? (tr.pagamentos.find((x) => x.id === idPagamento) ?? null) : null;
  useEffect(() => { if (idTransporte && pronto && !tr.transportes.some((x) => x.id === idTransporte)) navigate("/transportes", { replace: true }); }, [idTransporte, pronto, tr.transportes, navigate]);
  useEffect(() => { if (idPagamento && pronto && !tr.pagamentos.some((x) => x.id === idPagamento)) setBusca({ aba: "pagamentos" }, { replace: true }); }, [idPagamento, pronto, tr.pagamentos, setBusca]);

  const trocarAba = (v: string) => navigate(v === "pagamentos" ? "/transportes?aba=pagamentos" : "/transportes");
  const aviso = tr.erro ? <p className="t-body-sm" role="alert" data-testid="aviso-transportes">{tr.erro}</p> : null;

  return (
    <>
      {aba === "transportes" ? (
        <TelaDoMotor<Transporte> key="t" tela="transportes" titulo="Transportes e Pagamentos" subtitulo="Cada ida e cada volta, com os carros que levam, a distância e o pagamento." cabecalhoDireita={<SubpaginasDeEventos ativa={aba} />} avisos={aviso}
          acoes={<Button icon={<Plus size={20} />} onClick={() => setNovoT(true)} data-testid="novo-transporte">Novo transporte</Button>}
          linhas={pronto ? tr.transportes : null} erro={d.erro} campos={camposT} idDe={(t) => t.id} onEditar={tr.editarTransporte} onAbrir={(t) => navigate(`/transportes/${t.id}`)}
          rotuloDoTotal={(n) => `${n} transporte${n === 1 ? "" : "s"}`} placeholderDaBusca="Buscar referência, evento, transportadora…"
          vazio={<EmptyState icon={<Truck size={30} />} title="Nenhum transporte ainda" action={<Button icon={<Plus size={20} />} onClick={() => setNovoT(true)}>Criar o primeiro</Button>}>Crie a ida ou a volta de um evento e escolha os carros que vão nela. Os dias de viagem saem do km ÷ 500.</EmptyState>}
          filhos={<JanelaDoTransporte transporte={abertoT} campos={camposT} reservas={d.reservas} veiculos={d.veiculos} vinculos={tr.vinculos} pagamentos={tr.pagamentos} onEditar={tr.editarTransporte} onLigar={tr.ligarCarros}
            onExcluir={async (t) => { await tr.excluirT(t); navigate("/transportes"); }} onFechar={() => navigate("/transportes")} />} />
      ) : (
        <TelaDoMotor<Pagamento> key="p" tela="pagamentos" titulo="Transportes e Pagamentos" subtitulo="PTAs e NFs da TSO: aprovar e pagar." cabecalhoDireita={<SubpaginasDeEventos ativa={aba} />} avisos={aviso}
          acoes={<Button icon={<Plus size={20} />} onClick={() => setNovoP(true)} data-testid="novo-pagamento">Novo pagamento</Button>}
          linhas={pronto ? tr.pagamentos : null} erro={d.erro} campos={camposP} idDe={(p) => p.id} onEditar={tr.editarPagamento} onAbrir={(p) => navigate(`/transportes?aba=pagamentos&abrir=${p.id}`)}
          rotuloDoTotal={(n) => `${n} pagamento${n === 1 ? "" : "s"}`} placeholderDaBusca="Buscar número, departamento…"
          vazio={<EmptyState icon={<CurrencyDollar size={30} />} title="Nenhum pagamento ainda" action={<Button icon={<Plus size={20} />} onClick={() => setNovoP(true)}>Criar o primeiro</Button>}>Cadastre a PTA ou a NF da TSO e ligue aos transportes que ela cobre.</EmptyState>}
          filhos={<JanelaDoPagamento pagamento={abertoP} campos={camposP} onEditar={tr.editarPagamento} onExcluir={async (p) => { await tr.excluirP(p); setBusca({ aba: "pagamentos" }); }} onFechar={() => setBusca({ aba: "pagamentos" })} />} />
      )}
      <NovoTransporte aberto={novoT} onFechar={() => setNovoT(false)} eventos={d.eventos ?? []} reservas={d.reservas} veiculos={d.veiculos} onCriar={tr.criarT} onCriado={(t) => navigate(`/transportes/${t.id}`)} />
      <NovoPagamento aberto={novoP} onFechar={() => setNovoP(false)} onCriar={tr.criarP} onCriado={(p) => navigate(`/transportes?aba=pagamentos&abrir=${p.id}`)} />
    </>
  );
}
