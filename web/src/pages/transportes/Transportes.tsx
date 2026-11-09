import { useEffect, useMemo, useState } from "react";
import { useNavigate, useParams } from "react-router-dom";
import { MapPin, Truck } from "@phosphor-icons/react";
import { Button, EmptyState, useToast } from "../../ds";
import { TelaDoMotor } from "../../components/motor/TelaDoMotor";
import { rotaDoTransporte, distanciaEntre } from "../../lib/transportes/rota";
import { reservasDoTransporte } from "../../lib/transportes/regras";
import type { Transporte } from "../../lib/transportes/tipos";
import { SubpaginasDeEventos } from "../eventos/SubpaginasDeEventos";
import { useDadosDeEventos } from "../eventos/useDadosDeEventos";
import { camposDoTransporte, type ContextoDeTransportes } from "./camposDeTransportes";
import { JanelaDoTransporte } from "./JanelaDoTransporte";
import { useRotasDosTransportes } from "./useRotasDosTransportes";
import "../veiculos/veiculos.css";

/**
 * Transportes: só acompanhamento. Cada transporte nasce no evento (aba Veículos, linha do carro) e traz de lá a origem e o destino;
 * aqui se vê a distância aproximada, os dias de viagem e o pagamento (status, valor real, data), tudo no mesmo cadastro.
 */
export function Transportes() {
  const navigate = useNavigate();
  const { id: idTransporte } = useParams<{ id?: string }>();
  const d = useDadosDeEventos();
  const tr = d.tr;
  const ctx = useMemo<ContextoDeTransportes>(() => ({ eventos: new Map((d.eventos ?? []).map((e) => [e.id, e])), veiculos: new Map(d.veiculos.map((v) => [v.id, v])), reservas: d.reservas, vinculos: tr.vinculos, transportes: tr.transportes }), [d.eventos, d.veiculos, d.reservas, tr.vinculos, tr.transportes]);
  const campos = useMemo(() => camposDoTransporte(ctx), [ctx]);
  const pronto = d.eventos !== null && tr.carregado;
  const aberto = idTransporte && pronto ? (tr.transportes.find((x) => x.id === idTransporte) ?? null) : null;
  useEffect(() => { if (idTransporte && pronto && !tr.transportes.some((x) => x.id === idTransporte)) navigate("/transportes", { replace: true }); }, [idTransporte, pronto, tr.transportes, navigate]);
  const aviso = tr.erro ? <p className="t-body-sm" role="alert" data-testid="aviso-transportes">{tr.erro}</p> : null;
  const rotas = useRotasDosTransportes({ tr, eventos: d.eventos ?? [], reservas: d.reservas, locais: d.locais });

  return (
    <TelaDoMotor<Transporte> tela="transportes" titulo="Transportes" subtitulo="Cadastre pelo evento (aba Veículos). Aqui você acompanha a rota, a distância e o pagamento." cabecalhoDireita={<SubpaginasDeEventos ativa="transportes" />} avisos={aviso}
      acoes={<Button variant="secondary" icon={<MapPin size={20} />} onClick={() => void rotas.calcularPendentes()} loading={rotas.calculando} data-testid="calcular-rotas">Calcular rotas pendentes</Button>}
      linhas={pronto ? tr.transportes : null} erro={d.erro} campos={campos} idDe={(t) => t.id} onEditar={tr.editarTransporte} onAbrir={(t) => navigate(`/transportes/${t.id}`)}
      rotuloDoTotal={(n) => `${n} transporte${n === 1 ? "" : "s"}`} placeholderDaBusca="Buscar referência, evento, cidade, transportadora…"
      vazio={<EmptyState icon={<Truck size={30} />} title="Nenhum transporte ainda">No evento, aba Veículos, ligue “Transporte de ida/volta” em Colunas e cadastre a PTA na linha do carro. Ele aparece aqui com a rota e o pagamento.</EmptyState>}
      filhos={<JanelaDoTransporte transporte={aberto} campos={campos} reservas={d.reservas} veiculos={d.veiculos} vinculos={tr.vinculos} onEditar={tr.editarTransporte} onLigar={tr.ligarCarros} onAtualizarRota={rotas.atualizar}
        onExcluir={async (t) => { await tr.excluirT(t); navigate("/transportes"); }} onFechar={() => navigate("/transportes")} />} />
  );
}
