import { useEffect, useMemo, useState } from "react";
import { Link, useNavigate } from "react-router-dom";
import { CaretDown, CaretUp, Columns, MagnifyingGlass, Plus, Table, Car } from "@phosphor-icons/react";
import { Badge, Button, Card, Chips, EmptyState, Input, Page, Sheet, Skeleton } from "../../ds";
import { listarVeiculos } from "../../lib/veiculos/dados";
import { CICLO, rotuloCiclo, rotuloSeguro, type Veiculo } from "../../lib/veiculos/tipos";
import "./veiculos.css";

type Col = { id: string; titulo: string; valor: (v: Veiculo) => string; padrao: boolean; badge?: (v: Veiculo) => "success" | "warning" | "error" | "info" | "neutral" | "accent" };
const dataBR = (d: string | null) => (d ? `${d.slice(8, 10)}/${d.slice(5, 7)}/${d.slice(0, 4)}` : "");
const TOM_CICLO: Record<string, "success" | "warning" | "error" | "info" | "neutral" | "accent"> = {
  disponivel: "success", disponivel_sem_faturamento: "info", gravame: "error", em_devolucao: "warning", devolvido: "neutral", venda_vip: "accent",
};

const COLUNAS: Col[] = [
  { id: "codigo", titulo: "Código", valor: (v) => v.codigo ?? `${v.modelo}${v.versao ? " " + v.versao : ""}`.toUpperCase(), padrao: true },
  { id: "placa", titulo: "Placa", valor: (v) => v.placa ?? "", padrao: true },
  { id: "vin", titulo: "VIN (chassi)", valor: (v) => v.vin ?? "", padrao: true },
  { id: "modelo", titulo: "Modelo", valor: (v) => v.modelo, padrao: false },
  { id: "versao", titulo: "Versão", valor: (v) => v.versao ?? "", padrao: false },
  { id: "cor", titulo: "Cor", valor: (v) => v.cor ?? "", padrao: true },
  { id: "my", titulo: "MY", valor: (v) => v.my ?? "", padrao: true },
  { id: "pedido", titulo: "Pedido", valor: (v) => v.pedido ?? "", padrao: false },
  { id: "ciclo", titulo: "Ciclo de vida", valor: (v) => rotuloCiclo(v.status_ciclo), padrao: true, badge: (v) => TOM_CICLO[v.status_ciclo] ?? "neutral" },
  { id: "seguro", titulo: "Seguro", valor: (v) => rotuloSeguro(v.seguro_status), padrao: true, badge: (v) => (v.seguro_status === "cadastrado" ? "success" : v.seguro_status === "cancelado" ? "error" : "warning") },
  { id: "blindado", titulo: "Blindado", valor: (v) => (v.blindado ? "Sim" : "Não"), padrao: false },
  { id: "faturamento", titulo: "Faturamento", valor: (v) => dataBR(v.data_faturamento), padrao: false },
  { id: "emplacamento", titulo: "Emplacamento", valor: (v) => dataBR(v.data_emplacamento), padrao: false },
  { id: "comentarios", titulo: "Comentários", valor: (v) => v.comentarios ?? "", padrao: false },
];
const CHAVE = "frota.veiculos.colunas";
const lerColunas = (): string[] => {
  try { const s = JSON.parse(localStorage.getItem(CHAVE) ?? "null"); if (Array.isArray(s)) { const ok = s.filter((i) => COLUNAS.some((c) => c.id === i)); if (ok.length) return ok; } } catch { /* sem armazenamento */ }
  return COLUNAS.filter((c) => c.padrao).map((c) => c.id);
};

export function Veiculos() {
  const navigate = useNavigate();
  const [lista, setLista] = useState<Veiculo[] | null>(null);
  const [erro, setErro] = useState<string | null>(null);
  const [busca, setBusca] = useState("");
  const [ciclo, setCiclo] = useState<string>("todos");
  const [visiveis, setVisiveis] = useState<string[]>(lerColunas);
  const [ordem, setOrdem] = useState<{ id: string; dir: 1 | -1 }>({ id: "codigo", dir: 1 });
  const [escolhendo, setEscolhendo] = useState(false);

  useEffect(() => { listarVeiculos().then(setLista, (e: Error) => setErro(e.message)); }, []);
  useEffect(() => { try { localStorage.setItem(CHAVE, JSON.stringify(visiveis)); } catch { /* ok */ } }, [visiveis]);

  const cols = COLUNAS.filter((c) => c.id === "codigo" || visiveis.includes(c.id));
  const contagem = useMemo(() => { const m = new Map<string, number>(); for (const v of lista ?? []) m.set(v.status_ciclo, (m.get(v.status_ciclo) ?? 0) + 1); return m; }, [lista]);
  const linhas = useMemo(() => {
    const q = busca.trim().toLowerCase();
    const col = COLUNAS.find((c) => c.id === ordem.id) ?? COLUNAS[0];
    return (lista ?? [])
      .filter((v) => (ciclo === "todos" || v.status_ciclo === ciclo) && (!q || COLUNAS.some((c) => c.valor(v).toLowerCase().includes(q))))
      .sort((a, b) => col.valor(a).localeCompare(col.valor(b), "pt-BR", { numeric: true }) * ordem.dir);
  }, [lista, busca, ciclo, ordem]);

  const opcoesCiclo = [{ value: "todos", label: `Todos${lista ? ` (${lista.length})` : ""}` }, ...CICLO.filter((c) => contagem.get(c.value)).map((c) => ({ value: c.value, label: `${c.label} (${contagem.get(c.value)})` }))];

  return (
    <Page wide>
      <div className="ds-stack">
        <div className="ds-row" style={{ justifyContent: "space-between", flexWrap: "wrap" }}>
          <div>
            <h1 className="t-h1">Veículos</h1>
            <p className="t-body t-muted">Todos os carros, do pedido à devolução.</p>
          </div>
          <div className="ds-row" style={{ flexWrap: "wrap" }}>
            <Link to="/veiculos/massa"><Button variant="secondary" icon={<Table size={20} />}>Importar em massa</Button></Link>
            <Link to="/veiculos/novo"><Button icon={<Plus size={20} />}>Novo veículo</Button></Link>
          </div>
        </div>

        <div className="vei-barra">
          <div style={{ position: "relative", flex: "1 1 220px", maxWidth: 320 }}>
            <Input value={busca} onChange={(e) => setBusca(e.target.value)} placeholder="Buscar placa, VIN, modelo…" aria-label="Buscar veículo" />
            <MagnifyingGlass size={18} style={{ position: "absolute", right: 14, top: 13, color: "var(--color-text-subtle)" }} aria-hidden />
          </div>
          <Button variant="secondary" icon={<Columns size={20} />} onClick={() => setEscolhendo(true)}>Propriedades</Button>
        </div>
        {opcoesCiclo.length > 1 && <Chips options={opcoesCiclo} value={ciclo} onChange={setCiclo} />}

        {erro ? <Card><p className="t-body" role="alert">Não consegui carregar os veículos: {erro}</p></Card>
          : !lista ? <Card><Skeleton h={24} /><div style={{ height: 8 }} /><Skeleton h={24} /><div style={{ height: 8 }} /><Skeleton h={24} /></Card>
          : lista.length === 0 ? (
            <Card><EmptyState icon={<Car size={30} />} title="Nenhum veículo ainda" action={<Link to="/veiculos/novo"><Button icon={<Plus size={20} />}>Cadastrar o primeiro</Button></Link>}>
              Cadastre um por um ou cole a tabela do Excel em <Link to="/veiculos/massa">Importar em massa</Link>.</EmptyState></Card>
          ) : linhas.length === 0 ? <Card><p className="t-body t-muted">Nenhum veículo bate com a busca ou o filtro.</p></Card>
          : (
            <div className="vei-tabela" data-testid="tabela-veiculos">
              <table>
                <thead><tr>{cols.map((c) => (
                  <th key={c.id} onClick={() => setOrdem((o) => ({ id: c.id, dir: o.id === c.id ? (o.dir === 1 ? -1 : 1) : 1 }))} aria-sort={ordem.id === c.id ? (ordem.dir === 1 ? "ascending" : "descending") : undefined}>
                    {c.titulo}{ordem.id === c.id && (ordem.dir === 1 ? <CaretUp size={12} weight="bold" style={{ marginLeft: 4 }} /> : <CaretDown size={12} weight="bold" style={{ marginLeft: 4 }} />)}
                  </th>))}</tr></thead>
                <tbody>{linhas.map((v) => (
                  <tr key={v.id} onClick={() => navigate(`/veiculos/${v.id}`)} data-testid="linha-veiculo">
                    {cols.map((c) => { const t = c.valor(v); return <td key={c.id} className={t ? undefined : "vazio"}>{t ? (c.badge ? <Badge tone={c.badge(v)}>{t}</Badge> : t) : "—"}</td>; })}
                  </tr>))}</tbody>
              </table>
            </div>
          )}
      </div>

      <Sheet open={escolhendo} onClose={() => setEscolhendo(false)} title="Propriedades visíveis">
        <div className="vei-colunas">
          <p className="t-body-sm t-muted">A primeira coluna (Código) fica sempre fixa. As outras, você escolhe. Fica salvo neste aparelho.</p>
          {COLUNAS.filter((c) => c.id !== "codigo").map((c) => (
            <label key={c.id}><input type="checkbox" checked={visiveis.includes(c.id)} onChange={(e) => setVisiveis((v) => (e.target.checked ? [...v, c.id] : v.filter((i) => i !== c.id)))} />{c.titulo}</label>
          ))}
          <Button variant="secondary" onClick={() => setVisiveis(COLUNAS.filter((c) => c.padrao).map((c) => c.id))}>Voltar ao padrão</Button>
        </div>
      </Sheet>
    </Page>
  );
}
