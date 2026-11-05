import { useEffect, useMemo, useState, type FormEvent } from "react";
import { Link, useNavigate, useParams } from "react-router-dom";
import { ArrowLeft, LockKey, Plus, Trash } from "@phosphor-icons/react";
import { Button, Card, DateField, Field, Input, Page, Segmented, Select, Skeleton, Textarea, useToast } from "../../ds";
import { buscarCliente, clienteVazio, motoristaVazio, salvarCliente, type Cliente, type Motorista, type TipoPessoa } from "../../lib/clientes/dados";
import { cnpjValido, cpfValido, maskCep, maskCnpj, maskCpf } from "../../lib/clientes/documentos";
import "../veiculos/veiculos.css";

const UFS = ["AC", "AL", "AP", "AM", "BA", "CE", "DF", "ES", "GO", "MA", "MT", "MS", "MG", "PA", "PB", "PR", "PE", "PI", "RJ", "RN", "RS", "RO", "RR", "SC", "SP", "SE", "TO"];
const emailOk = (s: string) => !s.trim() || /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(s.trim());

export function FormCliente() {
  const { id } = useParams();
  const editando = !!id;
  const navigate = useNavigate();
  const toast = useToast();
  const [c, setC] = useState<Cliente>(clienteVazio);
  const [carregando, setCarregando] = useState(editando);
  const [erro, setErro] = useState<string | null>(null);
  const [enviando, setEnviando] = useState(false);
  const [tocado, setTocado] = useState(false);
  const set = <K extends keyof Cliente>(k: K, v: Cliente[K]) => { setC((s) => ({ ...s, [k]: v })); setErro(null); };
  const setMot = (i: number, k: keyof Motorista, v: string) => { setC((s) => ({ ...s, motoristas: s.motoristas.map((m, j) => (j === i ? { ...m, [k]: v } : m)) })); setErro(null); };

  useEffect(() => {
    if (!id) return;
    buscarCliente(id).then((x) => { if (!x) setErro("Cliente não encontrado."); else setC({ ...x, documento: x.tipo_pessoa === "juridica" ? maskCnpj(x.documento) : maskCpf(x.documento), cep: maskCep(x.cep), motoristas: x.motoristas.map((m) => ({ ...m, cpf: maskCpf(m.cpf) })) }); }, (e: Error) => setErro(e.message)).finally(() => setCarregando(false));
  }, [id]);

  const pj = c.tipo_pessoa === "juridica";
  const erros = useMemo(() => ({
    nome: c.nome.trim() ? null : (pj ? "Informe a razão social." : "Informe o nome completo."),
    documento: !c.documento.trim() ? null : (pj ? cnpjValido(c.documento) : cpfValido(c.documento)) ? null : (pj ? "CNPJ inválido." : "CPF inválido."),
    email: emailOk(c.email) ? null : "E-mail inválido.",
    testemunha_email: emailOk(c.testemunha_email) ? null : "E-mail inválido.",
    motoristas: c.motoristas.map((m) => ({ nome: m.nome.trim() ? null : "Informe o nome.", cpf: !m.cpf.trim() || cpfValido(m.cpf) ? null : "CPF inválido." })),
  }), [c, pj]);
  const invalido = !!(erros.nome || erros.documento || erros.email || erros.testemunha_email || erros.motoristas.some((m) => m.nome || m.cpf));

  async function salvar(e: FormEvent) {
    e.preventDefault();
    setTocado(true);
    if (invalido) return;
    setEnviando(true);
    try { await salvarCliente(c); toast("Cliente salvo"); navigate("/clientes"); }
    catch (x) { setErro((x as Error).message); } finally { setEnviando(false); }
  }

  if (carregando) return <Page><Card><Skeleton h={28} /><div style={{ height: 12 }} /><Skeleton h={28} /></Card></Page>;
  const mostra = (m: string | null) => (tocado ? m : null);

  return (
    <Page>
      <form className="vei-form" onSubmit={(e) => void salvar(e)} noValidate>
        <Link to="/clientes" className="ds-row" style={{ textDecoration: "none" }}><ArrowLeft size={20} />Clientes</Link>
        <h1 className="t-h1">{editando ? "Editar cliente" : "Novo cliente"}</h1>
        <p className="t-body-sm t-muted ds-row"><LockKey size={16} />CPF, CNPJ, e-mails e CNH ficam criptografados no banco.</p>

        <Card>
          <div className="vei-form">
            <Field label="Tipo de pessoa"><Segmented block options={[{ value: "juridica", label: "Pessoa jurídica" }, { value: "fisica", label: "Pessoa física" }]} value={c.tipo_pessoa} onChange={(v: TipoPessoa) => set("tipo_pessoa", v)} /></Field>
            <div className="vei-form__linha">
              <Field label={pj ? "Razão social" : "Nome completo"} error={mostra(erros.nome)}><Input value={c.nome} onChange={(e) => set("nome", e.target.value)} /></Field>
              <Field label={pj ? "CNPJ" : "CPF"} error={mostra(erros.documento)}><Input value={c.documento} inputMode="numeric" placeholder={pj ? "00.000.000/0000-00" : "000.000.000-00"} onChange={(e) => set("documento", pj ? maskCnpj(e.target.value) : maskCpf(e.target.value))} /></Field>
            </div>
            <div className="vei-form__linha">
              <Field label="E-mail" error={mostra(erros.email)}><Input type="email" value={c.email} onChange={(e) => set("email", e.target.value)} /></Field>
              <Field label="CEP"><Input value={c.cep} inputMode="numeric" placeholder="00000-000" onChange={(e) => set("cep", maskCep(e.target.value))} /></Field>
            </div>
            <div className="vei-form__linha">
              <Field label="Endereço"><Input value={c.endereco} onChange={(e) => set("endereco", e.target.value)} /></Field>
              <Field label="Número"><Input value={c.numero} onChange={(e) => set("numero", e.target.value)} /></Field>
            </div>
            <div className="vei-form__linha">
              <Field label="Complemento"><Input value={c.complemento} onChange={(e) => set("complemento", e.target.value)} /></Field>
              <Field label="Cidade"><Input value={c.cidade} onChange={(e) => set("cidade", e.target.value)} /></Field>
            </div>
            <div className="vei-form__linha">
              <Field label="Estado"><Select value={c.estado} onChange={(e) => set("estado", e.target.value)} placeholder="Selecionar…">{UFS.map((u) => <option key={u} value={u}>{u}</option>)}</Select></Field>
              <span />
            </div>
          </div>
        </Card>

        <Card>
          <div className="vei-form">
            <h2 className="t-h3">Testemunha</h2>
            <div className="vei-form__linha">
              <Field label="Nome da testemunha"><Input value={c.testemunha_nome} onChange={(e) => set("testemunha_nome", e.target.value)} /></Field>
              <Field label="E-mail da testemunha" error={mostra(erros.testemunha_email)}><Input type="email" value={c.testemunha_email} onChange={(e) => set("testemunha_email", e.target.value)} /></Field>
            </div>
          </div>
        </Card>

        <Card>
          <div className="vei-form">
            <div className="ds-row" style={{ justifyContent: "space-between" }}>
              <h2 className="t-h3">Pessoas autorizadas a dirigir ({c.motoristas.length})</h2>
              <Button type="button" variant="secondary" size="sm" icon={<Plus size={18} />} onClick={() => setC((s) => ({ ...s, motoristas: [...s.motoristas, motoristaVazio()] }))}>Adicionar</Button>
            </div>
            {c.motoristas.length === 0 && <p className="t-body t-muted">Nenhuma pessoa autorizada cadastrada.</p>}
            {c.motoristas.map((m, i) => (
              <div key={i} className="vei-motorista" data-testid="motorista">
                <div className="ds-row" style={{ justifyContent: "space-between" }}>
                  <span className="t-body" style={{ fontWeight: 700 }}>Pessoa {i + 1}</span>
                  <Button type="button" variant="ghost" size="icon" aria-label={`Remover pessoa ${i + 1}`} onClick={() => setC((s) => ({ ...s, motoristas: s.motoristas.filter((_, j) => j !== i) }))}><Trash size={20} /></Button>
                </div>
                <div className="vei-form__linha">
                  <Field label="Nome completo" error={mostra(erros.motoristas[i]?.nome)}><Input value={m.nome} onChange={(e) => setMot(i, "nome", e.target.value)} /></Field>
                  <Field label="CPF" error={mostra(erros.motoristas[i]?.cpf)}><Input value={m.cpf} inputMode="numeric" placeholder="000.000.000-00" onChange={(e) => setMot(i, "cpf", maskCpf(e.target.value))} /></Field>
                </div>
                <div className="vei-form__linha">
                  <Field label="CNH (nº do registro)"><Input value={m.cnh_registro} inputMode="numeric" onChange={(e) => setMot(i, "cnh_registro", e.target.value)} /></Field>
                  <Field label="Validade da CNH"><DateField value={m.cnh_validade} onChange={(e) => setMot(i, "cnh_validade", e.target.value)} /></Field>
                </div>
              </div>
            ))}
          </div>
        </Card>

        <Card><Field label="Comentários"><Textarea rows={3} value={c.comentarios} onChange={(e) => set("comentarios", e.target.value)} /></Field></Card>

        {erro && <p className="t-body" role="alert" style={{ color: "var(--color-error-fg)" }}>{erro}</p>}
        <div className="ds-row"><Button type="submit" size="lg" loading={enviando}>{editando ? "Salvar" : "Cadastrar"}</Button></div>
      </form>
    </Page>
  );
}
