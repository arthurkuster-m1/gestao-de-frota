import { useEffect, useMemo, useState } from "react";
import { Link, useNavigate } from "react-router-dom";
import { MagnifyingGlass, Plus, Table, Car } from "@phosphor-icons/react";
import { Button, Card, EmptyState, Input, Page, Skeleton } from "../../ds";
import { AbasDeVisualizacao } from "../../components/motor/AbasDeVisualizacao";
import { BarraDeConsulta } from "../../components/motor/BarraDeConsulta";
import { Propriedades } from "../../components/motor/Propriedades";
import { TabelaDoMotor } from "../../components/motor/TabelaDoMotor";
import type { CampoDaTela, OpcaoDoCampo } from "../../components/motor/tipos";
import { atualizarCampos, listarVeiculos } from "../../lib/veiculos/dados";
import { CICLO, SEGURO, normalizarPlaca, normalizarVin, placaValida, vinValido, type Veiculo } from "../../lib/veiculos/tipos";
import { useVisoes } from "../../lib/motor/useVisoes";
import type { PreferenciasDaTabela } from "../../lib/motor/layout";
import { configSegura, type VisaoSalva } from "../../lib/motor/visoes";
import { prefsIguais } from "../../lib/motor/prefs";
import "../veiculos/veiculos.css";

const TELA = "veiculos";
const dia = (iso: string | null) => (iso ? iso.slice(0, 10) : null);
const TOM_CICLO: Record<string, OpcaoDoCampo["tom"]> = { disponivel: "success", disponivel_sem_faturamento: "info", gravame: "error", em_devolucao: "warning", devolvido: "neutral", venda_vip: "accent" };
const OPCOES_CICLO: OpcaoDoCampo[] = CICLO.map((c) => ({ value: c.value, label: c.label, tom: TOM_CICLO[c.value] ?? "neutral" }));
const OPCOES_SEGURO: OpcaoDoCampo[] = SEGURO.map((s) => ({ value: s.value, label: s.label, tom: s.value === "cadastrado" ? "success" : s.value === "cancelado" ? "error" : "warning" }));

/** Os campos de veículo: o que a consulta filtra/ordena/agrupa e o que a tabela mostra. Os não marcados `padrao:false` começam visíveis. */
export const CAMPOS_VEICULO: CampoDaTela<Veiculo>[] = [
  { id: "codigo", titulo: "Código", tipo: "texto", valorDe: (v) => v.codigo ?? v.modelo.toUpperCase(), largura: 180, fixa: true },
  { id: "placa", titulo: "Placa", tipo: "texto", valorDe: (v) => v.placa, largura: 110, edicao: { coluna: "placa", maxLength: 8, placeholder: "ABC1D23", normalizar: normalizarPlaca, validar: (t) => (placaValida(t) ? null : "A placa tem 7 caracteres.") } },
  { id: "vin", titulo: "VIN (chassi)", tipo: "texto", valorDe: (v) => v.vin, largura: 190, edicao: { coluna: "vin", maxLength: 20, placeholder: "17 caracteres", normalizar: normalizarVin, validar: (t) => (vinValido(t) ? null : "O VIN tem 17 letras e números.") } },
  { id: "modelo", titulo: "Modelo", tipo: "texto", valorDe: (v) => v.modelo, largura: 160, padrao: false, edicao: { coluna: "modelo", obrigatorio: true } },
  { id: "cor", titulo: "Cor", tipo: "texto", valorDe: (v) => v.cor, largura: 130, edicao: { coluna: "cor" } },
  { id: "my", titulo: "MY", tipo: "texto", valorDe: (v) => v.my, largura: 90, edicao: { coluna: "my", maxLength: 9 } },
  { id: "pedido", titulo: "Pedido", tipo: "texto", valorDe: (v) => v.pedido, largura: 140, padrao: false, edicao: { coluna: "pedido" } },
  { id: "ciclo", titulo: "Ciclo de vida", tipo: "opcao", valorDe: (v) => v.status_ciclo, opcoes: OPCOES_CICLO, rotuloDoValor: (x) => OPCOES_CICLO.find((o) => o.value === x)?.label ?? x, ordemDoValor: (x) => CICLO.findIndex((c) => c.value === x), largura: 230, edicao: { coluna: "status_ciclo", obrigatorio: true } },
  { id: "seguro", titulo: "Seguro", tipo: "opcao", valorDe: (v) => v.seguro_status, opcoes: OPCOES_SEGURO, rotuloDoValor: (x) => OPCOES_SEGURO.find((o) => o.value === x)?.label ?? x, ordemDoValor: (x) => SEGURO.findIndex((s) => s.value === x), largura: 130, edicao: { coluna: "seguro_status", obrigatorio: true } },
  { id: "blindado", titulo: "Blindado", tipo: "caixa", valorDe: (v) => v.blindado, largura: 110, padrao: false, edicao: { coluna: "blindado" } },
  { id: "pedidoEm", titulo: "Pedido recebido em", tipo: "data", valorDe: (v) => v.data_pedido, largura: 170, padrao: false, edicao: { coluna: "data_pedido" } },
  { id: "liberadoEm", titulo: "Liberado em", tipo: "data", valorDe: (v) => v.data_liberacao, largura: 140, padrao: false, edicao: { coluna: "data_liberacao" } },
  { id: "faturadoEm", titulo: "Faturado em", tipo: "data", valorDe: (v) => v.data_faturamento, largura: 140, padrao: false, edicao: { coluna: "data_faturamento" } },
  { id: "emplacadoEm", titulo: "Emplacado em", tipo: "data", valorDe: (v) => v.data_emplacamento, largura: 150, padrao: false, edicao: { coluna: "data_emplacamento" } },
  { id: "devolvidoEm", titulo: "Devolvido em", tipo: "data", valorDe: (v) => v.data_devolucao, largura: 140, padrao: false, edicao: { coluna: "data_devolucao" } },
  { id: "comentarios", titulo: "Comentários", tipo: "texto", valorDe: (v) => v.comentarios, largura: 280, padrao: false, edicao: { coluna: "comentarios" } },
  { id: "cadastradoEm", titulo: "Cadastrado em", tipo: "data", valorDe: (v) => dia(v.created_at), largura: 150, padrao: false },
];

const CHAVE_TODAS = `frota.motor.${TELA}.todas`;
const lerTodas = (): PreferenciasDaTabela => { try { return configSegura(JSON.parse(localStorage.getItem(CHAVE_TODAS) ?? "{}")); } catch { return {}; } };

export function Veiculos() {
  const navigate = useNavigate();
  const [lista, setLista] = useState<Veiculo[] | null>(null);
  const [erro, setErro] = useState<string | null>(null);
  const [busca, setBusca] = useState("");
  const v = useVisoes(TELA);
  const [abaId, setAbaId] = useState("todas");
  const [todas, setTodas] = useState<PreferenciasDaTabela>(lerTodas);
  const [rascunho, setRascunho] = useState<PreferenciasDaTabela | null>(null);
  const [ocupado, setOcupado] = useState(false);
  const [erroVisao, setErroVisao] = useState<string | null>(null);

  useEffect(() => { listarVeiculos().then(setLista, (e: Error) => setErro(e.message)); }, []);
  useEffect(() => { try { localStorage.setItem(CHAVE_TODAS, JSON.stringify(todas)); } catch { /* sem armazenamento */ } }, [todas]);

  const ativa: VisaoSalva | undefined = v.visoes.find((x) => x.id === abaId);
  const abaValida = abaId === "todas" || !!ativa || v.carregando;
  useEffect(() => { if (!abaValida) setAbaId("todas"); }, [abaValida]);
  const prefs = ativa ? (rascunho ?? ativa.config) : todas;
  const alterada = ativa ? rascunho !== null && !prefsIguais(rascunho, ativa.config) : !prefsIguais(todas, {});
  const onPrefs = (p: PreferenciasDaTabela) => { if (ativa) setRascunho(p); else setTodas(p); };
  const irParaAba = (id: string) => { setAbaId(id); setRascunho(null); setErroVisao(null); };

  const buscadas = useMemo(() => {
    const q = busca.trim().toLowerCase();
    if (!q || !lista) return lista ?? [];
    return lista.filter((x) => CAMPOS_VEICULO.some((c) => c.tipo === "texto" && String(c.valorDe(x) ?? "").toLowerCase().includes(q)));
  }, [lista, busca]);

  async function comAviso<R>(fn: () => Promise<R>): Promise<R | undefined> { setOcupado(true); setErroVisao(null); try { return await fn(); } catch (e) { setErroVisao((e as Error).message); throw e; } finally { setOcupado(false); } }

  return (
    <Page wide>
      <div className="ds-stack">
        <div className="ds-row" style={{ justifyContent: "space-between", flexWrap: "wrap" }}>
          <div><h1 className="t-h1">Veículos</h1><p className="t-body t-muted">Todos os carros, do pedido à devolução.</p></div>
          <div className="ds-row" style={{ flexWrap: "wrap" }}>
            <Link to="/veiculos/massa"><Button variant="secondary" icon={<Table size={20} />}>Importar em massa</Button></Link>
            <Link to="/veiculos/novo"><Button icon={<Plus size={20} />}>Novo veículo</Button></Link>
          </div>
        </div>

        <AbasDeVisualizacao visoes={v.visoes} abaId={abaId} onAba={irParaAba} alterada={alterada} ocupado={ocupado} erro={erroVisao ?? v.erro}
          onCriar={async (nome, tipo) => { const nova = await comAviso(() => v.criar(nome, tipo, { ...prefs, visualizacao: tipo })); if (nova) { if (!ativa) setTodas({}); irParaAba(nova.id); } }}
          onSalvar={async () => { if (ativa && rascunho) { await comAviso(() => v.atualizar(ativa.id, { config: rascunho })); setRascunho(null); } }}
          onDescartar={() => { if (ativa) setRascunho(null); else setTodas({}); }}
          onRenomear={async (id, nome) => { await comAviso(() => v.atualizar(id, { nome })); }}
          onDuplicar={async (x) => { const nova = await comAviso(() => v.criar(`${x.nome} (cópia)`, x.tipo, ativa?.id === x.id ? prefs : x.config)); if (nova) irParaAba(nova.id); }}
          onExcluir={async (id) => { await comAviso(() => v.excluir(id)); irParaAba("todas"); }} />

        <div className="mt-linha-ferramentas">
          <BarraDeConsulta campos={CAMPOS_VEICULO} linhas={lista ?? []} consulta={prefs} onChange={(c) => onPrefs({ ...prefs, ...c })} />
          <Propriedades campos={CAMPOS_VEICULO} prefs={prefs} onChange={onPrefs} />
          <div style={{ position: "relative", flex: "1 1 200px", maxWidth: 300, marginLeft: "auto" }}>
            <Input value={busca} onChange={(e) => setBusca(e.target.value)} placeholder="Buscar placa, VIN, modelo…" aria-label="Buscar veículo" />
            <MagnifyingGlass size={18} style={{ position: "absolute", right: 14, top: 13, color: "var(--color-text-subtle)" }} aria-hidden />
          </div>
        </div>

        {erro ? <Card><p className="t-body" role="alert">Não consegui carregar os veículos: {erro}</p></Card>
          : !lista ? <Card><Skeleton h={24} /><div style={{ height: 8 }} /><Skeleton h={24} /><div style={{ height: 8 }} /><Skeleton h={24} /></Card>
          : <TabelaDoMotor linhas={buscadas} campos={CAMPOS_VEICULO} prefs={prefs} onPrefs={onPrefs} idDe={(x) => x.id} onAbrir={(x) => navigate(`/veiculos/${x.id}`)}
              rotuloDoTotal={(n) => `${n} veículo${n === 1 ? "" : "s"}`}
              onEditar={async (linha, campo, valor) => { const novo = await atualizarCampos(linha.id, { [campo.edicao!.coluna]: valor } as Partial<Veiculo>); setLista((l) => (l ?? []).map((x) => (x.id === linha.id ? novo : x))); }}
              vazio={<EmptyState icon={<Car size={30} />} title="Nenhum veículo ainda" action={<Link to="/veiculos/novo"><Button icon={<Plus size={20} />}>Cadastrar o primeiro</Button></Link>}>Cadastre um por um ou cole a tabela do Excel em <Link to="/veiculos/massa">Importar em massa</Link>.</EmptyState>} />}
      </div>
    </Page>
  );
}
