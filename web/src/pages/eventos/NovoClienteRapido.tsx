import { useEffect, useState } from "react";
import { Button, Field, Input, Segmented, Sheet } from "../../ds";
import { CampoDeEndereco } from "../../components/motor/EditorDeEndereco";
import { clienteVazio, salvarCliente, type TipoPessoa } from "../../lib/clientes/dados";
import { cnpjValido, cpfValido, maskCep, maskCnpj, maskCpf } from "../../lib/clientes/documentos";
import { lerEndereco } from "../../lib/enderecos";

/** Cadastro rápido de cliente (dentro do novo evento): tipo, CNPJ/CPF, nome e endereço (CEP ou endereço colado). O resto se completa na ficha do cliente. */
export function NovoClienteRapido({ aberto, onFechar, onCriado }: { aberto: boolean; onFechar: () => void; onCriado: (c: { id: string; nome: string }) => void }) {
  const [tipo, setTipo] = useState<TipoPessoa>("juridica");
  const [nome, setNome] = useState("");
  const [documento, setDocumento] = useState("");
  const [endereco, setEndereco] = useState("");
  const [tocado, setTocado] = useState(false);
  const [falha, setFalha] = useState<string | null>(null);
  const [enviando, setEnviando] = useState(false);
  useEffect(() => { if (aberto) { setTipo("juridica"); setNome(""); setDocumento(""); setEndereco(""); setTocado(false); setFalha(null); } }, [aberto]);
  const pj = tipo === "juridica";
  const erroNome = nome.trim() ? null : pj ? "Informe a razão social." : "Informe o nome completo.";
  const erroDoc = !documento.trim() ? null : (pj ? cnpjValido(documento) : cpfValido(documento)) ? null : pj ? "CNPJ inválido." : "CPF inválido.";

  async function salvar() {
    setTocado(true);
    if (erroNome || erroDoc) return;
    setFalha(null); setEnviando(true);
    try {
      const p = lerEndereco(endereco);
      const id = await salvarCliente({ ...clienteVazio(), tipo_pessoa: tipo, nome: nome.trim(), documento,
        ...(p ? { cep: maskCep(p.cep), endereco: p.rua, numero: p.numero, complemento: p.complemento, cidade: p.cidade, estado: p.uf } : {}) });
      onCriado({ id, nome: nome.trim() });
    } catch (e) { setFalha((e as Error).message); } finally { setEnviando(false); }
  }

  return (
    <Sheet open={aberto} onClose={onFechar} title="Novo cliente">
      <form className="ds-stack" noValidate data-testid="form-cliente-rapido"
        onSubmit={(e) => { e.preventDefault(); e.stopPropagation(); void salvar(); }}
        onKeyDown={(e) => { if (e.key === "Enter" && (e.ctrlKey || e.metaKey)) e.stopPropagation(); }}>
        <Field label="Tipo de pessoa"><Segmented block options={[{ value: "juridica", label: "Pessoa jurídica" }, { value: "fisica", label: "Pessoa física" }]} value={tipo} onChange={(v: TipoPessoa) => { setTipo(v); setDocumento(""); }} /></Field>
        <Field label={pj ? "CNPJ" : "CPF"} error={tocado ? erroDoc : null}><Input value={documento} inputMode="numeric" placeholder={pj ? "00.000.000/0000-00" : "000.000.000-00"} onChange={(e) => setDocumento(pj ? maskCnpj(e.target.value) : maskCpf(e.target.value))} autoFocus /></Field>
        <Field label={pj ? "Razão social" : "Nome completo"} error={tocado ? erroNome : null}><Input value={nome} onChange={(e) => setNome(e.target.value)} /></Field>
        <Field label="Endereço"><CampoDeEndereco valor={endereco} onChange={setEndereco} titulo="Endereço do cliente" /></Field>
        {falha && <p className="t-body-sm" role="alert" style={{ color: "var(--color-error-fg)" }}>{falha}</p>}
        <Button type="submit" size="lg" block loading={enviando} data-testid="salvar-cliente-rapido">Cadastrar cliente</Button>
      </form>
    </Sheet>
  );
}
