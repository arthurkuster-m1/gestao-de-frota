import { AlcaDoPainel } from "../../components/motor/AlcaDoPainel";
import { LinkNoLugar } from "../../app/noLugar";
import { useEffect, useMemo, useRef, useState } from "react";
import { Link } from "react-router-dom";
import { DownloadSimple, Plus, Trash, Warning, X } from "@phosphor-icons/react";
import { Button, Sheet, useToast } from "../../ds";
import { CampoEditavel, clicarNaLinha } from "../../components/motor/CampoEditavel";
import { formatar } from "../../components/motor/formatar";
import type { CampoDaTela } from "../../components/motor/tipos";
import { useEdicao, type OnEditar } from "../../components/motor/useEdicao";
import type { Aditivo, AditivoNovo, AditivoVeiculo, Contrato, ContratoVeiculo } from "../../lib/contratos/tipos";
import { baixarArquivo, gerarAditivoDocx, gerarContratoDocx, nomeDoArquivoDoAditivo, nomeDoArquivoDoContrato, tituloDoAditivo, type SnapshotDoContrato } from "../../lib/contratos/documentos";
import { montarSnapshotDoAditivo, montarSnapshotDoContrato } from "../../lib/contratos/montar";
import { baixarAditivoDocx, baixarContratoDocx } from "./baixar";
import { planoDeAditivos } from "../../lib/contratos/regras";
import { hojeLocal } from "../../lib/motor/datas";
import type { Reserva } from "../../lib/eventos/tipos";
import type { Veiculo } from "../../lib/veiculos/tipos";
import { camposDoAditivo, codigoDoCarro, divergenciasDoContrato, type ContextoDeContratos } from "./camposDeContratos";
import { NovoAditivo } from "./NovoAditivo";
import "../veiculos/veiculos.css";

type Props = {
  contrato: Contrato | null; campos: readonly CampoDaTela<Contrato>[]; ctx: ContextoDeContratos; veiculos: Veiculo[]; carrosDoContrato: ContratoVeiculo[]; itens: AditivoVeiculo[]; reservasDoEvento: Reserva[];
  onEditar: OnEditar<Contrato>; onEditarAditivo: OnEditar<Aditivo>; onIncluirCarro: (contratoId: string, veiculoId: string) => Promise<void>; onTirarCarro: (v: ContratoVeiculo) => Promise<void>;
  onNovoAditivo: (a: AditivoNovo, linhas: { veiculo_id: string; acao: "sai" | "entra" }[]) => Promise<Aditivo>; onTirarAditivo: (a: Aditivo) => Promise<void>; onExcluir: (c: Contrato) => Promise<void>; onFechar: () => void;
};

/** A janela do contrato: dados editáveis, carros, conferência com o evento e aditivos. */
export function JanelaDoContrato({ contrato, campos, ctx, veiculos, carrosDoContrato, itens, reservasDoEvento, onEditar, onEditarAditivo, onIncluirCarro, onTirarCarro, onNovoAditivo, onTirarAditivo, onExcluir, onFechar }: Props) {
  const ref = useRef<HTMLDialogElement>(null);
  const ed = useEdicao<Contrato>((c) => c.id, onEditar);
  const edAd = useEdicao<Aditivo>((a) => a.id, onEditarAditivo);
  const [excluindo, setExcluindo] = useState(false);
  const [novoAd, setNovoAd] = useState(false);
  const [falha, setFalha] = useState<string | null>(null);
  const [gerando, setGerando] = useState(false);
  const toast = useToast();
  const id = contrato?.id;
  useEffect(() => { const d = ref.current; if (!d) return; if (id && !d.open) d.showModal(); if (!id && d.open) d.close(); }, [id]);
  const editaveis = campos.filter((c) => c.edicao).map((c) => c.id);
  const emVigor = contrato ? ctx.emVigor.get(contrato.id) : undefined;
  const div = contrato ? divergenciasDoContrato(contrato, ctx) : [];
  const reservados = useMemo(() => new Set(reservasDoEvento.filter((r) => r.estado !== "cancelado").map((r) => r.veiculo_id)), [reservasDoEvento]);
  const originais = new Set(carrosDoContrato.map((c) => c.veiculo_id));
  const faltam = [...reservados].filter((v) => !originais.has(v));
  const aditivos = emVigor?.aditivos ?? [];
  const guardar = (p: Promise<unknown>) => { setFalha(null); void p.catch((e: Error) => setFalha(e.message)); };
  const travado = !!contrato && (contrato.status === "assinado" || contrato.status === "encerrado");
  const evento = contrato ? ctx.eventos.get(contrato.evento_id) : undefined;
  const mapaDeVeiculos = useMemo(() => new Map(veiculos.map((v) => [v.id, v])), [veiculos]);
  /** O DOCX do contrato: depois de assinado sai SEMPRE igual (do snapshot); antes, com os dados de agora. */
  async function baixarContrato() {
    if (!contrato) return;
    setFalha(null); setGerando(true);
    try { await baixarContratoDocx(contrato, ctx, carrosDoContrato); } catch (e) { setFalha((e as Error).message); } finally { setGerando(false); }
  }
  const numeroDoAditivo = (a: Aditivo) => aditivos.findIndex((x) => x.id === a.id) + 1;
  async function baixarAditivo(a: Aditivo) {
    if (!contrato) return;
    setFalha(null);
    try { await baixarAditivoDocx(contrato, a, numeroDoAditivo(a), ctx, itens); } catch (e) { setFalha((e as Error).message); }
  }
  /** Os aditivos que as divergências pedem: extensão de prazo (evento passou do fim) e/ou troca de carros. Já baixa os DOCX. */
  const plano = contrato && emVigor ? planoDeAditivos({ vigenciaFim: emVigor.vigencia.fim, carros: emVigor.carros, reservas: reservasDoEvento, evento: evento ?? { retirada_prevista: null } }) : null;
  const temPlano = !!plano && (!!plano.novoFim || plano.sai.length > 0 || plano.entra.length > 0);
  const novoAditivoComTitulo = (a: AditivoNovo, linhas: { veiculo_id: string; acao: "sai" | "entra" }[]) => onNovoAditivo({ ...a, titulo: a.titulo ?? tituloDoAditivo(aditivos.length + 1, a.tipo), data_efeito: a.data_efeito ?? hojeLocal() }, linhas);
  async function gerarAditivos() {
    if (!contrato || !plano || !emVigor) return;
    setFalha(null); setGerando(true);
    try {
      let n = aditivos.length;
      const criados: Aditivo[] = [];
      if (plano.novoFim) { n++; criados.push(await onNovoAditivo({ contrato_id: contrato.id, tipo: "extensao_prazo", titulo: tituloDoAditivo(n, "extensao_prazo"), data_efeito: hojeLocal(), vigencia_fim_anterior: emVigor.vigencia.fim, vigencia_fim_nova: plano.novoFim, motivo: "Data do evento ampliada" }, [])); }
      if (plano.sai.length || plano.entra.length) { n++; criados.push(await onNovoAditivo({ contrato_id: contrato.id, tipo: "troca_carros", titulo: tituloDoAditivo(n, "troca_carros"), data_efeito: hojeLocal(), vigencia_fim_anterior: emVigor.vigencia.fim, motivo: "Carros do evento mudaram" }, [...plano.sai.map((v) => ({ veiculo_id: v, acao: "sai" as const })), ...plano.entra.map((v) => ({ veiculo_id: v, acao: "entra" as const }))])); }
      toast(`${criados.length} aditivo${criados.length === 1 ? "" : "s"} gerado${criados.length === 1 ? "" : "s"}: baixe o DOCX de cada um`);
    } catch (e) { setFalha((e as Error).message); } finally { setGerando(false); }
  }

  return (
    <dialog ref={ref} className="mt-janela" aria-label={`Contrato ${contrato ? (ctx.eventos.get(contrato.evento_id)?.nome ?? "") : ""}`} onClose={(e) => { if (e.target === e.currentTarget) onFechar(); }} onClick={(e) => { if (e.target === ref.current) onFechar(); }}>
      {contrato && (
        <div className="mt-janela__corpo" data-testid="janela-contrato">
          <AlcaDoPainel />
          <header className="mt-janela__topo">
            <div><h2 className="t-h2" data-testid="titulo-janela">{ctx.eventos.get(contrato.evento_id)?.nome ?? "Contrato"} <Button variant="secondary" size="sm" icon={<DownloadSimple size={18} />} loading={gerando} onClick={() => void baixarContrato()} data-testid="baixar-contrato" title="Baixar o contrato em DOCX">Baixar DOCX</Button></h2><div className="mt-janela__sub">{formatar(campos.find((c) => c.id === "status")!, contrato)}</div></div>
            <button type="button" className="mt-janela__fechar" aria-label="Fechar" onClick={onFechar}><X size={22} /></button>
          </header>
          <div className="mt-janela__conteudo">
            {(ed.erro || edAd.erro || falha) && <p className="mt-erro" role="alert" data-testid="erro-edicao"><span>{ed.erro ?? edAd.erro ?? falha}</span><button type="button" aria-label="Fechar aviso" onClick={() => { ed.setErro(null); edAd.setErro(null); setFalha(null); }}><X size={16} /></button></p>}
            <dl className="mt-ficha" data-testid="ficha-dados">
              {campos.filter((c) => c.id !== "carros" && c.id !== "aditivos").map((c) => (
                <div key={c.id} className="mt-ficha__linha" onClick={clicarNaLinha}><dt>{c.titulo}</dt><dd>{c.id === "evento" ? <LinkNoLugar to={`/eventos/${contrato.evento_id}`} className="mt-reserva__evento">{formatar(c, contrato)}</LinkNoLugar> : <CampoEditavel linha={contrato} campo={c} ed={ed} navegaveis={editaveis} />}</dd></div>
              ))}
            </dl>

            {travado && <p className="t-body-sm t-muted" data-testid="contrato-travado">Contrato assinado: os dados não mudam mais. O que mudar no evento entra como aditivo.</p>}
            {div.length === 0 ? <p className="t-body t-muted" data-testid="confere">O evento confere com o contrato: cliente, datas e carros.</p> : (
              <section className="mt-escolha__aviso" role="alert" data-testid="dados-divergentes" style={{ display: "grid", gap: 8 }}>
                <b><Warning size={16} weight="fill" /> Dados divergentes</b>
                <ul className="mt-reservas" data-testid="divergencias">{div.map((d, i) => <li key={i}>{d.texto}</li>)}</ul>
                {temPlano && <div><Button size="sm" loading={gerando} onClick={() => void gerarAditivos()} data-testid="gerar-aditivo-divergencia">Gerar aditivo{plano!.novoFim && (plano!.sai.length || plano!.entra.length) ? "s" : ""}</Button></div>}
                {!temPlano && <p className="t-body-sm">Cliente e datas anteriores ao início não têm aditivo automático: ajuste o evento ou fale com o jurídico.</p>}
              </section>
            )}

            <h3 className="t-h3">Carros do contrato</h3>
            <ul className="mt-escolha" role="list" data-testid="carros-do-contrato">
              {carrosDoContrato.length === 0 && <li className="t-body t-muted">Nenhum carro no contrato ainda.</li>}
              {carrosDoContrato.map((c) => (
                <li key={c.id} className="mt-escolha__item"><div className="mt-escolha__linha"><span className="mt-escolha__nome">{codigoDoCarro(ctx.veiculos.get(c.veiculo_id))}</span>
                  {emVigor && !emVigor.carros.has(c.veiculo_id) && <span className="t-body-sm t-muted">saiu por aditivo</span>}
                  {!travado && <Button variant="ghost" size="icon" aria-label={`Tirar ${codigoDoCarro(ctx.veiculos.get(c.veiculo_id))} do contrato`} onClick={() => guardar(onTirarCarro(c))}><Trash size={18} /></Button>}</div></li>
              ))}
            </ul>
            {!travado && faltam.length > 0 && <div className="ds-row" style={{ flexWrap: "wrap" }}>{faltam.map((v) => <Button key={v} size="sm" variant="secondary" icon={<Plus size={16} />} onClick={() => guardar(onIncluirCarro(contrato.id, v))} data-testid="incluir-carro">Incluir {codigoDoCarro(ctx.veiculos.get(v))}</Button>)}</div>}
            <p className="t-body-sm t-muted">Os carros em vigor (depois dos aditivos assinados): <b>{emVigor ? [...emVigor.carros].map((v) => codigoDoCarro(ctx.veiculos.get(v))).join(", ") || "nenhum" : "—"}</b>.</p>

            <div className="ds-row" style={{ justifyContent: "space-between" }}><h3 className="t-h3">Aditivos</h3><Button icon={<Plus size={18} />} onClick={() => setNovoAd(true)} data-testid="novo-aditivo">Novo aditivo</Button></div>
            {aditivos.length === 0 && <p className="t-body t-muted">Nenhum aditivo. Troca de carros e extensão de prazo entram aqui.</p>}
            {aditivos.map((a, n) => (
              <article key={a.id} className="mt-reserva-ed" data-testid="aditivo">
                <div className="mt-reserva-ed__topo"><span className="mt-reserva__evento">{a.titulo ?? tituloDoAditivo(n + 1, a.tipo)}</span><Button variant="secondary" size="sm" icon={<DownloadSimple size={16} />} onClick={() => void baixarAditivo(a)} data-testid="baixar-aditivo">Baixar DOCX</Button><Button variant="ghost" size="icon" aria-label={`Excluir ${n + 1}º aditivo`} onClick={() => guardar(onTirarAditivo(a))}><Trash size={20} /></Button></div>
                <div className="mt-reserva-ed__campos">
                  {camposDoAditivo.filter((c) => c.id !== "novoFim" || a.tipo === "extensao_prazo").map((c) => <div key={c.id}><span className="rot">{c.titulo}</span><CampoEditavel linha={a} campo={c} ed={edAd} navegaveis={camposDoAditivo.filter((x) => x.edicao).map((x) => x.id)} /></div>)}
                </div>
                {a.tipo === "troca_carros" && <p className="t-body-sm">{itens.filter((i) => i.aditivo_id === a.id).map((i) => `${i.acao === "sai" ? "Sai" : "Entra"}: ${codigoDoCarro(ctx.veiculos.get(i.veiculo_id))}`).join(" · ")}</p>}
                {a.status !== "assinado" && <p className="t-body-sm t-muted">Ainda não vale: só entra na vigência e nos carros depois de Assinado.</p>}
              </article>
            ))}
            <div><Button variant="danger" icon={<Trash size={18} />} onClick={() => setExcluindo(true)} data-testid="excluir-contrato">Excluir contrato</Button></div>
          </div>
          <NovoAditivo aberto={novoAd} onFechar={() => setNovoAd(false)} contratoId={contrato.id} fimAtual={emVigor?.vigencia.fim ?? null} carrosEmVigor={emVigor?.carros ?? new Set()} veiculos={veiculos} onCriar={novoAditivoComTitulo} />
          <Sheet open={excluindo} onClose={() => setExcluindo(false)} title="Excluir contrato">
            <div className="ds-stack">
              <p className="t-body">Excluir este contrato? Os {aditivos.length} aditivo{aditivos.length === 1 ? "" : "s"} também somem. O evento e os carros não são afetados. Não dá para desfazer.</p>
              <Button variant="danger" size="lg" block onClick={() => void onExcluir(contrato).then(() => setExcluindo(false)).catch((e: Error) => { setFalha(e.message); setExcluindo(false); })} data-testid="confirmar-exclusao">Excluir contrato</Button>
            </div>
          </Sheet>
        </div>
      )}
    </dialog>
  );
}
