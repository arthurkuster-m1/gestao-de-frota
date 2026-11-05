import { useEffect, useMemo, useState } from "react";
import { useNavigate, useParams } from "react-router-dom";
import { Plus, Wrench } from "@phosphor-icons/react";
import { Button, EmptyState } from "../../ds";
import { TelaDoMotor } from "../../components/motor/TelaDoMotor";
import { barraDaManutencao } from "../../lib/manutencoes/barras";
import type { Manutencao } from "../../lib/manutencoes/tipos";
import { hojeLocal } from "../../lib/motor/datas";
import { useDadosDeEventos } from "../eventos/useDadosDeEventos";
import { camposDaManutencao, type ContextoDeManutencoes } from "./camposDaManutencao";
import { JanelaDaManutencao } from "./JanelaDaManutencao";
import { NovaManutencao } from "./NovaManutencao";
import { reservasPorVeiculo } from "../../lib/eventos/uso";

/** Manutenções e sinistros: tabela, cards e linha do tempo, tudo editável no lugar. */
export function Manutencoes() {
  const navigate = useNavigate();
  const { id: idAberto } = useParams<{ id?: string }>();
  const d = useDadosDeEventos();
  const [criando, setCriando] = useState(false);

  const nomes = useMemo(() => new Map((d.eventos ?? []).map((e) => [e.id, e.nome])), [d.eventos]);
  const ctx = useMemo<ContextoDeManutencoes>(() => ({ veiculos: new Map(d.veiculos.map((v) => [v.id, v])), reservasDoCarro: reservasPorVeiculo(d.reservas), nomeDoEvento: (id) => nomes.get(id) ?? "?", carregado: d.eventos !== null }), [d.veiculos, d.reservas, nomes, d.eventos]);
  const campos = useMemo(() => camposDaManutencao(ctx), [ctx]);
  const carregado = d.eventos !== null;
  const lista = carregado ? d.manutencoes : null;
  const aberto = idAberto && lista ? (lista.find((x) => x.id === idAberto) ?? null) : null;
  useEffect(() => { if (idAberto && lista && !lista.some((x) => x.id === idAberto)) navigate("/manutencoes", { replace: true }); }, [idAberto, lista, navigate]);

  return (
    <>
      <TelaDoMotor<Manutencao> tela="manutencoes" titulo="Manutenções" subtitulo="Manutenções e sinistros. Enquanto o carro está na oficina e bloqueado, o Status de uso dele mostra Manutenção."
        acoes={<Button icon={<Plus size={20} />} onClick={() => setCriando(true)} data-testid="nova-manutencao">Nova manutenção</Button>}
        linhas={lista} erro={d.erro} campos={campos} idDe={(m) => m.id} onEditar={d.editarManutencao} onAbrir={(m) => navigate(`/manutencoes/${m.id}`)}
        linhaDoTempo={{ barrasDe: (m) => barraDaManutencao(m, hojeLocal()), onAlterarBarra: (m, _b, modo, delta) => d.moverManutencao(m.id, modo, delta), onAbrirBarra: (m) => navigate(`/manutencoes/${m.id}`) }}
        rotuloDoTotal={(n) => `${n} manutenç${n === 1 ? "ão" : "ões"}`} placeholderDaBusca="Buscar manutenção, carro, evento…"
        vazio={<EmptyState icon={<Wrench size={30} />} title="Nenhuma manutenção ainda" action={<Button icon={<Plus size={20} />} onClick={() => setCriando(true)}>Registrar a primeira</Button>}>Registre a manutenção ou o sinistro. O carro passa a aparecer como Manutenção no Status de uso enquanto estiver bloqueado.</EmptyState>}
        filhos={<JanelaDaManutencao manutencao={aberto} campos={campos} onEditar={d.editarManutencao} onExcluir={async (m) => { await d.excluirDeManutencao(m); navigate("/manutencoes"); }} onFechar={() => navigate("/manutencoes")} />} />
      <NovaManutencao aberto={criando} onFechar={() => setCriando(false)} veiculos={d.veiculos} onCriar={d.criarDeManutencao} onCriada={(m) => navigate(`/manutencoes/${m.id}`)} />
    </>
  );
}
