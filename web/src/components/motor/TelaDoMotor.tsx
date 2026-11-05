import { useEffect, useMemo, useState, type ReactNode } from "react";
import { MagnifyingGlass, Rows, SquaresFour } from "@phosphor-icons/react";
import { Card, Input, Page, Segmented, Skeleton } from "../../ds";
import { useVisoes } from "../../lib/motor/useVisoes";
import type { PreferenciasDaTabela } from "../../lib/motor/layout";
import { prefsIguais } from "../../lib/motor/prefs";
import { configSegura, type VisaoSalva } from "../../lib/motor/visoes";
import { AbasDeVisualizacao } from "./AbasDeVisualizacao";
import { BarraDeConsulta } from "./BarraDeConsulta";
import { CartoesDoMotor } from "./CartoesDoMotor";
import { Propriedades } from "./Propriedades";
import { TabelaDoMotor } from "./TabelaDoMotor";
import type { CampoDaTela } from "./tipos";
import type { OnEditar } from "./useEdicao";
import "./motor.css";

type Props<T> = {
  /** Identifica a tela nas visualizações salvas ("veiculos", "eventos"…). */
  tela: string; titulo: string; subtitulo: string; acoes?: ReactNode; avisos?: ReactNode;
  linhas: readonly T[] | null; erro: string | null; campos: readonly CampoDaTela<T>[]; idDe: (l: T) => string;
  onEditar: OnEditar<T>; onAbrir: (l: T) => void; vazio: ReactNode; rotuloDoTotal: (n: number) => string; placeholderDaBusca: string;
  /** Janelas e outros elementos por cima da tela (ex.: a janela do veículo). */
  filhos?: ReactNode;
};

/**
 * A casca de toda tela de lista do Frota: cabeçalho, abas de visualização (salvas), Filtrar/Ordenar/Agrupar/Propriedades,
 * Tabela ⇄ Cards, busca e a edição no lugar. Veículos, Eventos e as próximas telas só trazem os campos e os dados.
 */
export function TelaDoMotor<T>({ tela, titulo, subtitulo, acoes, avisos, linhas, erro, campos, idDe, onEditar, onAbrir, vazio, rotuloDoTotal, placeholderDaBusca, filhos }: Props<T>) {
  const chaveTodas = `frota.motor.${tela}.todas`;
  const v = useVisoes(tela);
  const [busca, setBusca] = useState("");
  const [abaId, setAbaId] = useState("todas");
  const [todas, setTodas] = useState<PreferenciasDaTabela>(() => { try { return configSegura(JSON.parse(localStorage.getItem(chaveTodas) ?? "{}")); } catch { return {}; } });
  const [rascunho, setRascunho] = useState<PreferenciasDaTabela | null>(null);
  const [ocupado, setOcupado] = useState(false);
  const [erroVisao, setErroVisao] = useState<string | null>(null);

  useEffect(() => { try { localStorage.setItem(chaveTodas, JSON.stringify(todas)); } catch { /* sem armazenamento */ } }, [todas, chaveTodas]);
  const ativa: VisaoSalva | undefined = v.visoes.find((x) => x.id === abaId);
  const abaValida = abaId === "todas" || !!ativa || v.carregando;
  useEffect(() => { if (!abaValida) setAbaId("todas"); }, [abaValida]);
  const prefs = ativa ? (rascunho ?? ativa.config) : todas;
  const alterada = ativa ? rascunho !== null && !prefsIguais(rascunho, ativa.config) : !prefsIguais(todas, {});
  const onPrefs = (p: PreferenciasDaTabela) => { if (ativa) setRascunho(p); else setTodas(p); };
  const irParaAba = (id: string) => { setAbaId(id); setRascunho(null); setErroVisao(null); };
  const modo = prefs.visualizacao === "galeria" ? "cards" : "tabela";

  const buscadas = useMemo(() => {
    const q = busca.trim().toLowerCase();
    if (!q || !linhas) return linhas ?? [];
    return linhas.filter((x) => campos.some((c) => c.tipo === "texto" && String(c.valorDe(x) ?? "").toLowerCase().includes(q)));
  }, [linhas, busca, campos]);

  async function comAviso<R>(fn: () => Promise<R>): Promise<R | undefined> { setOcupado(true); setErroVisao(null); try { return await fn(); } catch (e) { setErroVisao((e as Error).message); throw e; } finally { setOcupado(false); } }

  return (
    <Page wide>
      <div className="ds-stack">
        <div className="ds-row" style={{ justifyContent: "space-between", flexWrap: "wrap" }}>
          <div><h1 className="t-h1">{titulo}</h1><p className="t-body t-muted">{subtitulo}</p></div>
          {acoes && <div className="ds-row" style={{ flexWrap: "wrap" }}>{acoes}</div>}
        </div>
        {avisos}

        <AbasDeVisualizacao visoes={v.visoes} abaId={abaId} onAba={irParaAba} alterada={alterada} ocupado={ocupado} erro={erroVisao ?? v.erro}
          onCriar={async (nome, tipo) => { const nova = await comAviso(() => v.criar(nome, tipo, { ...prefs, visualizacao: tipo })); if (nova) { if (!ativa) setTodas({}); irParaAba(nova.id); } }}
          onSalvar={async () => { if (ativa && rascunho) { await comAviso(() => v.atualizar(ativa.id, { config: rascunho })); setRascunho(null); } }}
          onDescartar={() => { if (ativa) setRascunho(null); else setTodas({}); }}
          onRenomear={async (id, nome) => { await comAviso(() => v.atualizar(id, { nome })); }}
          onDuplicar={async (x) => { const nova = await comAviso(() => v.criar(`${x.nome} (cópia)`, x.tipo, ativa?.id === x.id ? prefs : x.config)); if (nova) irParaAba(nova.id); }}
          onExcluir={async (id) => { await comAviso(() => v.excluir(id)); irParaAba("todas"); }} />

        <div className="mt-linha-ferramentas">
          <BarraDeConsulta campos={campos} linhas={linhas ?? []} consulta={prefs} onChange={(c) => onPrefs({ ...prefs, ...c })} />
          <Propriedades campos={campos} prefs={prefs} onChange={onPrefs} />
          <Segmented options={[{ value: "tabela", label: <span className="mt-modo"><Rows size={16} />Tabela</span> }, { value: "cards", label: <span className="mt-modo"><SquaresFour size={16} />Cards</span> }]} value={modo}
            onChange={(m) => onPrefs({ ...prefs, visualizacao: m === "cards" ? "galeria" : "tabela" })} />
          <div style={{ position: "relative", flex: "1 1 200px", maxWidth: 300, marginLeft: "auto" }}>
            <Input value={busca} onChange={(e) => setBusca(e.target.value)} placeholder={placeholderDaBusca} aria-label={`Buscar em ${titulo}`} />
            <MagnifyingGlass size={18} style={{ position: "absolute", right: 14, top: 13, color: "var(--color-text-subtle)" }} aria-hidden />
          </div>
        </div>

        {erro ? <Card><p className="t-body" role="alert">Não consegui carregar {titulo.toLowerCase()}: {erro}</p></Card>
          : !linhas ? <Card><Skeleton h={24} /><div style={{ height: 8 }} /><Skeleton h={24} /><div style={{ height: 8 }} /><Skeleton h={24} /></Card>
          : modo === "cards"
            ? <CartoesDoMotor linhas={buscadas} campos={campos} prefs={prefs} idDe={idDe} onAbrir={onAbrir} rotuloDoTotal={rotuloDoTotal} onEditar={onEditar} vazio={vazio} />
            : <TabelaDoMotor linhas={buscadas} campos={campos} prefs={prefs} onPrefs={onPrefs} idDe={idDe} onAbrir={onAbrir} rotuloDoTotal={rotuloDoTotal} onEditar={onEditar} vazio={vazio} />}
      </div>
      {filhos}
    </Page>
  );
}
