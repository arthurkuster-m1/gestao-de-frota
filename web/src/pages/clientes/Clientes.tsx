import { useEffect, useMemo, useState } from "react";
import { Link, useNavigate } from "react-router-dom";
import { MagnifyingGlass, Plus, Users } from "@phosphor-icons/react";
import { Badge, Button, Card, EmptyState, Input, Page, Skeleton } from "../../ds";
import { listarClientes, type ClienteResumo } from "../../lib/clientes/dados";
import "../veiculos/veiculos.css";

export function Clientes() {
  const navigate = useNavigate();
  const [lista, setLista] = useState<ClienteResumo[] | null>(null);
  const [erro, setErro] = useState<string | null>(null);
  const [busca, setBusca] = useState("");
  useEffect(() => { listarClientes().then(setLista, (e: Error) => setErro(e.message)); }, []);
  const linhas = useMemo(() => { const q = busca.trim().toLowerCase(); return (lista ?? []).filter((c) => !q || `${c.nome} ${c.cidade ?? ""} ${c.estado ?? ""}`.toLowerCase().includes(q)); }, [lista, busca]);

  return (
    <Page wide>
      <div className="ds-stack">
        <div className="ds-row" style={{ justifyContent: "space-between", flexWrap: "wrap" }}>
          <div><h1 className="t-h1">Clientes</h1><p className="t-body t-muted">Dados para o contrato de comodato.</p></div>
          <Link to="/clientes/novo"><Button icon={<Plus size={20} />}>Novo cliente</Button></Link>
        </div>
        <div className="vei-barra">
          <div style={{ position: "relative", flex: "1 1 220px", maxWidth: 320 }}>
            <Input value={busca} onChange={(e) => setBusca(e.target.value)} placeholder="Buscar por nome ou cidade…" aria-label="Buscar cliente" />
            <MagnifyingGlass size={18} style={{ position: "absolute", right: 14, top: 13, color: "var(--color-text-subtle)" }} aria-hidden />
          </div>
        </div>
        {erro ? <Card><p className="t-body" role="alert">Não consegui carregar os clientes: {erro}</p></Card>
          : !lista ? <Card><Skeleton h={24} /><div style={{ height: 8 }} /><Skeleton h={24} /></Card>
          : lista.length === 0 ? <Card><EmptyState icon={<Users size={30} />} title="Nenhum cliente ainda" action={<Link to="/clientes/novo"><Button icon={<Plus size={20} />}>Cadastrar o primeiro</Button></Link>}>CPF, CNPJ, e-mails e CNH ficam criptografados.</EmptyState></Card>
          : linhas.length === 0 ? <Card><p className="t-body t-muted">Nenhum cliente bate com a busca.</p></Card>
          : (
            <div className="vei-tabela" data-testid="tabela-clientes">
              <table>
                <thead><tr><th>Nome / razão social</th><th>Tipo</th><th>Cidade</th></tr></thead>
                <tbody>{linhas.map((c) => (
                  <tr key={c.id} onClick={() => navigate(`/clientes/${c.id}`)} data-testid="linha-cliente">
                    <td>{c.nome}</td><td><Badge tone="neutral">{c.tipo_pessoa === "fisica" ? "Pessoa física" : "Pessoa jurídica"}</Badge></td>
                    <td className={c.cidade ? undefined : "vazio"}>{c.cidade ? `${c.cidade}${c.estado ? "/" + c.estado : ""}` : "—"}</td>
                  </tr>))}</tbody>
              </table>
            </div>
          )}
      </div>
    </Page>
  );
}
